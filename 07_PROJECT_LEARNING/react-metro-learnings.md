# Forensic Learning Record (Deep Inspection): react/metro

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-metro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/metro](https://github.com/react/metro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:58:51.546Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/metro`
- **Description**: 🚇 The JavaScript bundler for React Native
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5643 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `flow-typed/environment/utility-types.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall react_native
 */

/**
 * Flow allows optional properties ({foo?: number}) to be present and set to
 * undefined, but does not distinguish that case from an omitted prop.
 *
 * In particular, when a var with type {foo?: number} is spread over a
 * {foo: number}, the resulting type is {foo: number}, even though
 * {...{foo: 42}, ...{foo: undefined}} is {foo: undefined} at runtime,
 *
 * This utility turns {foo?: number} into {foo?: void | number}, which
 * can be safely spread, forcing handling of potentially present but undefined
 * props.
 */
declare type SafeOptionalProps<T extends {...}> = {
  [K in keyof T]: T[K] extends void ? void | T[K] : T[K],
};

```

### Core Architecture Module: `flow-typed/jest-worker.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

declare module 'jest-worker' {
  declare export var CHILD_MESSAGE_INITIALIZE: 0;
  declare export var CHILD_MESSAGE_CALL: 1;
  declare export var CHILD_MESSAGE_END: 2;
  declare export var CHILD_MESSAGE_MEM_USAGE: 3;
  declare export var CHILD_MESSAGE_CALL_SETUP: 4;

  declare export var PARENT_MESSAGE_OK: 0;
  declare export var PARENT_MESSAGE_CLIENT_ERROR: 1;
  declare export var PARENT_MESSAGE_SETUP_ERROR: 2;
  declare export var PARENT_MESSAGE_CUSTOM: 3;
  declare export var PARENT_MESSAGE_MEM_USAGE: 4;

  declare export type PARENT_MESSAGE_ERROR =
    typeof PARENT_MESSAGE_CLIENT_ERROR | typeof PARENT_MESSAGE_SETUP_ERROR;

  declare export type WorkerPoolOptions = Readonly<{
    setupArgs: ReadonlyArray<unknown>,
    forkOptions: child_process$forkOpts,
    maxRetries: number,
    numWorkers: number,
    enableWorkerThreads: boolean,
  }>;

  declare export type ChildMessageInitialize = [
    typeof CHILD_MESSAGE_INITIALIZE, // type
    boolean, // processed
    string, // file
    Array<unknown> | void, // setupArgs
    number | void, // workerId
  ];

  declare export type ChildMessageCall = [
    typeof CHILD_MESSAGE_CALL, // type
    boolean, // processed
    string, // method
    Array<unknown>, // args
  ];

  declare export type ChildMessageEnd = [
    typeof CHILD_MESSAGE_END, // type
    boolean, // processed
  ];

  declare export type ChildMessageMemUsage = [
    typeof CHILD_MESSAGE_MEM_USAGE, // type
  ];

  declare export type ChildMessageCallSetup = [
    typeof CHILD_MESSAGE_CALL_SETUP, // type
  ];

  declare export type ChildMessage =
    | ChildMessageInitialize
    | ChildMessageCall
    | ChildMessageEnd
    | ChildMessageMemUsage
    | ChildMessageCallSetup;

  declare export type ParentMessageOk = [
    typeof PARENT_MESSAGE_OK, // type
    unknown, // result
  ];

  declare export type ParentMessageCustom = [
    typeof PARENT_MESSAGE_CUSTOM, // type
    unknown, // result
  ];

  declare export type ParentMessageMemUsage = [
    typeof PARENT_MESSAGE_MEM_USAGE, // type
    number, // usedMemory
  ];

  declare export type ParentMessageError = [
    PARENT_MESSAGE_ERROR, // type
    string, // constructor
    string, // message
    string, // stack
    unknown, // extra
  ];

  declare export type ParentMessage =
    | ParentMessageOk
    | ParentMessageError
    | ParentMessageCustom
    | ParentMessageMemUsage;

  declare export interface WorkerInterface {
    send(
      request: ChildMessage,
      onProcessStart: OnStart,
      onProcessEnd: OnEnd,
      onCustomMessage: OnCustomMessage,
    ): void;

    waitForExit(): Promise<void>;
    forceExit(): void;

    getWorkerId(): number;
    getStderr(): stream$Readable | null;
    getStdout(): stream$Readable | null;
    /**
     * Some system level identifier for the worker. IE, process id, thread id, etc.
     */
    getWorkerSystemId(): number;
    getMemoryUsage(): Promise<number | null>;
    /**
     * Checks to see if the child worker is actually running.
     */
    isWorkerRunning(): boolean;
    /**
     * When the worker child is started and ready to start handling requests.
     *
     * @remarks
     * This mostly exists to help with testing so that you don't check the status
     * of things like isWorkerRunning before it actually is.
     */
    waitForWorkerReady(): Promise<void>;
  }

  declare export type OnStart = (worker: WorkerInterface) => void;
  declare export type OnEnd = (err: Error | null, result: unknown) => void;
  declare export type OnCustomMessage = (
    message: ReadonlyArray<unknown> | unknown,
  ) => void;

  declare export interface WorkerPoolInterface {
    getStderr(): stream$Readable;
    getStdout(): stream$Readable;
    getWorkers(): Array<WorkerInterface>;
    createWorker(options: WorkerOptions): WorkerInterface;
    send(
      workerId: number,
      request: ChildMessage,
      onStart: OnStart,
      onEnd: OnEnd,
      onCustomMessage: OnCustomMessage,
    ): void;
    start(): Promise<void>;
    end(): Promise<{
      forceExited: boolean,
    }>;
  }

  declare export type WorkerOptions = Readonly<{
    forkOptions: child_process$forkOpts,
    resourceLimits: ResourceLimits,
    setupArgs: ReadonlyArray<unknown>,
    maxRetries: number,
    workerId: number,
    workerData?: unknown,
    workerPath: string,
    /**
     * After a job has executed the memory usage it should return to.
     *
     * @remarks
     * Note this is different from ResourceLimits in that it checks at idle, after
     * a job is complete. So you could have a resource limit of 500MB but an idle
     * limit of 50MB. The latter will only trigger if after a job has completed the
     * memory usage hasn't returned back down under 50MB.
     */
    idleMemoryLimit?: number,
    /**
     * This mainly exists so the path can be changed during testing.
     * https://github.com/jestjs/jest/issues/9543
     */
    childWorkerPath?: string,
    /**
     * This is useful for debugging individual tests allowing you to see
     * the raw output of the worker.
     */
    silent?: boolean,
    /**
     * Used to immediately bind event handlers.
     */
    on?: {
      'state-change':
        OnStateChangeHandler | ReadonlyArray<OnStateChangeHandler>,
    },
  }>;

  declare export type WorkerState =
    'starting' | 'ok' | 'oom' | 'restarting' | 'shutting-down' | 'shut-down';

  declare export type OnStateChangeHandler = (
    state: WorkerState,
    oldState: WorkerState,
  ) => void;

  declare export type QueueChildMessage = {
    request: ChildMessageCall,
    onStart: OnStart,
    onEnd: OnEnd,
    onCustomMessage: OnCustomMessage,
  };

  declare export type ResourceLimits = Readonly<{
    maxYoungGenerationSizeMb?: number,
    maxOldGenerationSizeMb?: number,
    codeRangeSizeMb?: number,
    stackSizeMb?: number,
    ...
  }>;

  export interface TaskQueue {
    /**
     * Enqueues the task in the queue for the specified worker or adds it to the
     * queue shared by all workers
     * @param task the task to queue
     * @param workerId the id of the worker that should process this task or undefined
     * if there's no preference.
     */
    enqueue(task: QueueChildMessage, workerId?: number): void;

    /**
     * Dequeues the next item from the queue for the specified worker
     * @param workerId the id of the worker for which the next task should be retrieved
     */
    dequeue(workerId: number): QueueChildMessage | null;
  }

  declare export type FarmOptions<TSetupArgs extends ReadonlyArray<unknown>> =
    Readonly<{
      computeWorkerKey?: (
        method: string,
        ...args: ReadonlyArray<unknown>
      ) => string | null,
      exposedMethods?: ReadonlyArray<string>,
      forkOptions?: child_process$forkOpts,
      setupArgs?: TSetupArgs,
      maxRetries?: number,
      numWorkers?: number,
      WorkerPool?: (
        workerPath: string,
        options?: WorkerPoolOptions,
      ) => WorkerPoolInterface,
      enableWorkerThreads?: boolean,
      idleMemoryLimit?: number,
      resourceLimits?: ResourceLimits,
      taskQueue?: TaskQueue,
      workerSchedulingPolicy?: 'round-robin' | 'in-order',
    }>;

  declare export type IJestWorker<TExposed extends {...} = {}> = Readonly<{
    // dynamically exposed methods from the worker
    ...TExposed,

    getStderr: () => stream$Readable,
    getStdout: () => stream$Readable,
    end: () => Promise<void>,
  }>;

  declare export class Worker<
    TExposed extends Readonly<{
      [string]: (...Array<$FlowFixMe>) => Promise<$FlowFixMe>,
    }> = {},
    TSetupArgs extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
  > {
    constructor(
      workerPath: string,
      options?: FarmOptions<TSetupArgs>,
    ): IJestWorker<TExposed>;

    getStderr(): stream$Readable;
    getStdout(): stream$Readable;
    end(): Promise<void>;
  }
}

```

### Core Architecture Module: `packages/buck-worker-tool/src/CommandFailedError.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @oncall react_native
 */

/**
 * Thrown to indicate the command failed and already output relevant error
 * information on the console.
 */
export default class CommandFailedError extends Error {
  constructor() {
    super(
      'The Buck worker-tool command failed. Diagnostics should have ' +
        'been printed on the standard error output.',
    );
  }
}

```

### Core Architecture Module: `packages/buck-worker-tool/src/profiling.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall react_native
 */

import fs from 'node:fs';

let currentInspectorSession;
let isProfiling = false;

function getInspectorSession() {
  if (currentInspectorSession) {
    return currentInspectorSession;
  }
  // eslint-disable-next-line import/no-commonjs
  const inspector = require('node:inspector');
  currentInspectorSession = new inspector.Session();
  currentInspectorSession.connect();
  return currentInspectorSession;
}

export async function startProfiling() {
  if (isProfiling) {
    return;
  }

  const session = getInspectorSession();
  await new Promise(resolve => session.post('Profiler.enable', resolve));
  await new Promise(resolve => session.post('Profiler.start', resolve));
  isProfiling = true;
}

export async function stopProfilingAndWrite(workerName: ?string) {
  if (!isProfiling) {
    return;
  }
  const session = getInspectorSession();

  const {profile} = await new Promise<any>((resolve, reject) =>
    session.post('Profiler.stop', (err, data) =>
      err ? reject(err) : resolve(data),
    ),
  );
  const name = 'buck-worker-tool' + (workerName ? '-' + workerName : '');
  fs.writeFileSync(
    `${name}-${process.pid}-${Date.now()}.cpuprofile`,
    JSON.stringify(profile),
    'utf8',
  );
  isProfiling = false;
}

```

### Core Architecture Module: `packages/buck-worker-tool/src/third-party/JSONStream.js`
```
/**
 * Portions (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable import/no-commonjs */

/**
 * Copyright (c) 2011 Dominic Tarr.
 * Based on the JSONStream package: https://github.com/dominictarr/JSONStream
 */

'use strict'

var Parser = require('jsonparse')
  , through = require('through')

var bufferFrom = Buffer.from && Buffer.from !== Uint8Array.from

/*

  the value of this.stack that creationix's jsonparse has is weird.

  it makes this code ugly, but his problem is way harder that mine,
  so i'll forgive him.

*/

exports.parse = function (path, map) {
  var header, footer
  var parser = new Parser()
  var stream = through(function (chunk) {
    if('string' === typeof chunk)
      chunk = bufferFrom ? Buffer.from(chunk) : new Buffer(chunk)
    parser.write(chunk)
  },
  function (data) {
    if(data)
      stream.write(data)
    if (header)
        stream.emit('header', header)
    if (footer)
      stream.emit('footer', footer)
    stream.queue(null)
  })

  if('string' === typeof path)
    path = path.split('.').map(function (e) {
      if (e === '$*')
        return {emitKey: true}
      else if (e === '*')
        return true
      else if (e === '') // '..'.split('.') returns an empty string
        return {recurse: true}
      else
        return e
    })


  var count = 0, _key
  if(!path || !path.length)
    path = null

  parser.onValue = function (value) {
    if (!this.root)
      stream.root = value

    if(! path) return

    var i = 0 // iterates on path
    var j  = 0 // iterates on stack
    var emitKey = false;
    var emitPath = false;
    while (i < path.length) {
      var key = path[i]
      var c
      j++

      if (key && !key.recurse) {
        c = (j === this.stack.length) ? this : this.stack[j]
        if (!c) return
        if (! check(key, c.key)) {
          setHeaderFooter(c.key, value)
          return
        }
        emitKey = !!key.emitKey;
        emitPath = !!key.emitPath;
        i++
      } else {
        i++
        var nextKey = path[i]
        if (! nextKey) return
        while (true) {
          c = (j === this.stack.length) ? this : this.stack[j]
          if (!c) return
          if (check(nextKey, c.key)) {
            i++;
            if (!Object.isFrozen(this.stack[j]))
              this.stack[j].value = null
            break
          } else {
            setHeaderFooter(c.key, value)
          }
          j++
        }
      }

    }

    // emit header
    if (header) {
      stream.emit('header', header);
      header = false;
    }
    if (j !== this.stack.length) return

    count ++
    var actualPath = this.stack.slice(1).map(function(element) { return element.key }).concat([this.key])
    var data = value
    if(null != data)
      if(null != (data = map ? map(data, actualPath) : data)) {
        if (emitKey || emitPath) {
          data = { value: data };
          if (emitKey)
            data["key"] = this.key;
          if (emitPath)
            data["path"] = actualPath;
        }

        stream.queue(data)
      }
    if (this.value) delete this.value[this.key]
    for(var k in this.stack)
      if (!Object.isFrozen(this.stack[k]))
        this.stack[k].value = null
  }
  parser._onToken = parser.onToken;

  parser.onToken = function (token, value) {
    parser._onToken(token, value);
    if (this.stack.length === 0) {
      if (stream.root) {
        if(!path)
          stream.queue(stream.root)
        count = 0;
        stream.root = null;
        stream.emit('root_end');
      }
    }
  }

  parser.onError = function (err) {
    if(err.message.indexOf("at position") > -1)
      err.message = "Invalid JSON (" + err.message + ")";
    stream.emit('error', err)
  }

  return stream

  function setHeaderFooter(key, value) {
    // header has not been emitted yet
    if (header !== false) {
      header = header || {}
      header[key] = value
    }

    // footer has not been emitted yet but header has
    if (footer !== false && header === false) {
      footer = footer || {}
      footer[key] = value
    }
  }
}

function check (x, y) {
  if ('string' === typeof x)
    return y == x
  else if (x && 'function' === typeof x.exec)
    return x.exec(y)
  else if ('boolean' === typeof x || 'object' === typeof x)
    return x
  else if ('function' === typeof x)
    return x(y)
  return false
}

exports.stringify = function (op, sep, cl, indent) {
  indent = indent || 0
  if (op === false){
    op = ''
    sep = '\n'
    cl = ''
  } else if (op == null) {

    op = '[\n'
    sep = '\n,\n'
    cl = '\n]\n'

  }

  //else, what ever you like

  var stream
    , first = true
    , anyData = false
  stream = through(function (data) {
    anyData = true
    try {
      var json = JSON.stringify(data, null, indent)
    } catch (err) {
      return stream.emit('error', err)
    }
    if(first) { first = false ; stream.queue(op + json)}
    else stream.queue(sep + json)
  },
  function (data) {
    if(!anyData)
      stream.queue(op)
    stream.queue(cl)
    stream.queue(null)
  })

  return stream
}

exports.stringifyObject = function (op, sep, cl, indent) {
  indent = indent || 0
  if (op === false){
    op = ''
    sep = '\n'
    cl = ''
  } else if (op == null) {

    op = '{\n'
    sep = '\n,\n'
    cl = '\n}\n'

  }

  //else, what ever you like

  var first = true
  var anyData = false
  var stream = through(function (data) {
    anyData = true
    var json = JSON.stringify(data[0]) + ':' + JSON.stringify(data[1], null, indent)
    if(first) { first = false ; this.queue(op + json)}
    else this.queue(sep + json)
  },
  function (data) {
    if(!anyData) this.queue(op)
    this.queue(cl)

    this.queue(null)
  })

  return stream
}

```

### Core Architecture Module: `packages/buck-worker-tool/src/worker-tool.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall react_native
 */

import type {Duplex, Writable} from 'node:stream';

import {startProfiling, stopProfilingAndWrite} from './profiling';
import JSONStream from './third-party/JSONStream';
import duplexer from 'duplexer';
import invariant from 'invariant';
import {Console} from 'node:console';
import fs from 'node:fs';

export type Command = (
  argv: Array<string>,
  structuredArgs: unknown,
  console: Console,
) => Promise<void> | void;
export type Commands = {[key: string]: Command, ...};

type Message<Type extends string, Data> = Data & {
  id: number,
  type: Type,
  ...
};

type HandshakeMessage = Message<
  'handshake',
  {
    protocol_version: '0',
    capabilities: [],
    ...
  },
>;

type CommandMessage = Message<
  'command',
  {
    args_path: string,
    stdout_path: string,
    stderr_path: string,
    ...
  },
>;

type HandshakeResponse = Message<
  'handshake',
  {
    protocol_version: '0',
    capabilities: [],
    ...
  },
>;

type CommandResponse = Message<'result', {exit_code: 0, ...}>;

type ErrorResponse = Message<'error', {exit_code: number, ...}>;

type IncomingMessage = HandshakeMessage | CommandMessage;
type Response = HandshakeResponse | CommandResponse | ErrorResponse;
type RespondFn = (response: Response) => void;

type JSONReaderDataHandler = IncomingMessage => unknown;
type JSONReaderEndHandler = () => unknown;

type JSONReaderDataListener = ('data', JSONReaderDataHandler) => JSONReader;
type JSONReaderEndListener = ('end', JSONReaderEndHandler) => JSONReader;
type JSONReaderRootEndListener = (
  'root_end',
  JSONReaderEndHandler,
) => JSONReader;
type JSONReaderListener = JSONReaderDataListener &
  JSONReaderEndListener &
  JSONReaderRootEndListener;

type JSONReader = {
  on: JSONReaderListener,
  removeListener: JSONReaderListener,
  ...
};

type JSONWriter = {
  write(object: Response): void,
  end(object?: Response): void,
  ...
};

function buckWorker(commands: Commands): Duplex {
  const reader: JSONReader = JSONStream.parse('*');
  const writer: JSONWriter = JSONStream.stringify();

  function handleHandshake(message: IncomingMessage): void {
    const response = handshakeResponse(message);

    if (response.type === 'handshake') {
      if (JS_WORKER_TOOL_CPU_PROFILE) {
        // $FlowFixMe[unused-promise]
        startProfiling().then(() => writer.write(response));
      } else {
        writer.write(response);
      }
      reader.removeListener('data', handleHandshake).on('data', handleCommand);
    } else {
      writer.write(response);
    }
  }

  function handleCommand(message: IncomingMessage): void {
    const {id} = message;

    if (message.type !== 'command') {
      writer.write(unknownMessage(id));
      return;
    }

    if (!message.args_path || !message.stdout_path || !message.stderr_path) {
      writer.write(invalidMessage(id));
      return;
    }

    let responded: boolean = false;
    let stdout, stderr;

    try {
      stdout = fs.createWriteStream(message.stdout_path);
      stderr = fs.createWriteStream(message.stderr_path);
    } catch (e) {
      respond(invalidMessage(id));
      return;
    }

    readArgsAndExecCommand(message, commands, stdout, stderr, respond);

    function respond(response: Response) {
      // 'used for lazy `.stack` access'
      invariant(!responded, `Already responded to message id ${id}.`);
      responded = true;

      void Promise.all(
        [stdout, stderr]
          .filter(Boolean)
          .map(stream => new Promise(resolve => stream.end(resolve))),
      ).then(() => {
        writer.write(response);
      });
    }
  }

  let ended = false;
  function end() {
    if (ended) {
      return;
    }
    ended = true;
    // $FlowFixMe[unused-promise]
    stopProfilingAndWrite(JS_WORKER_TOOL_NAME).then(() => writer.end());
  }
  reader.on('data', handleHandshake);
  reader.on('end', end);
  reader.on('root_end', end);
  return duplexer(reader, writer);
}

function handshakeResponse(message: IncomingMessage) {
  if (message.type !== 'handshake') {
    return unknownMessage(message.id);
  }

  if (message.protocol_version !== '0') {
    return invalidMessage(message.id);
  }

  return {
    id: message.id,
    type: 'handshake' as const,
    protocol_version: '0' as const,
    capabilities: [] as [],
  };
}

function readArgsAndExecCommand(
  message: CommandMessage,
  commands: Commands,
  stdout: Writable,
  stderr: Writable,
  respond: RespondFn,
) {
  const {id} = message;

  fs.readFile(message.args_path, 'utf8', (readError, argsString) => {
    if (readError) {
      respond(invalidMessage(id));
      return;
    }

    let commandName;
    let args: Array<string> = [];
    let structuredArgs = null;

    // If it starts with a left brace, we assume it's JSON-encoded. This works
    // because the non-JSON encoding always starts the string with the
    // command name, thus a letter.
    if (argsString[0] === '{') {
      ({command: commandName, ...structuredArgs} = JSON.parse(argsString));
    } else {
      // FIXME: if there are files names with escaped
      // whitespace, this will not work.
      [commandName, ...args] = argsString.split(/\s+/);
    }

    if (commands.hasOwnProperty(commandName)) {
      const command = commands[commandName];
      const commandSpecificConsole = new Console(stdout, stderr);
      // $FlowFixMe[unused-promise]
      execCommand(
        command,
        commandName,
        argsString,
        args,
        structuredArgs,
        commandSpecificConsole,
        respond,
        id,
      );
    } else {
      stderr.write(
        `This worker does not have a command named \`${commandName}\`. ` +
          `Available commands are: ${Object.keys(commands).join(', ')}`,
      );
      respond(invalidMessage(id));
    }
  });
}

const {
  JS_WORKER_TOOL_DEBUG_RE,
  JS_WORKER_TOOL_CPU_PROFILE,
  JS_WORKER_TOOL_NAME,
} = process.env;
const DEBUG_RE = JS_WORKER_TOOL_DEBUG_RE
  ? new RegExp(JS_WORKER_TOOL_DEBUG_RE)
  : null;

async function execCommand(
  command: Command,
  commandName: string,
  argsString: string,
  args: Array<string>,
  structuredArgs: unknown,
  commandSpecificConsole: Console,
  respond: RespondFn,
  messageId: number,
) {
  let makeResponse: (id: number) => Response = success;
  try {
    if (shouldDebugCommand(argsString)) {
      throw new Error(
        `Stopping for debugging. Command '${commandName} ...' matched by the 'JS_WORKER_TOOL_DEBUG_RE' environment variable`,
      );
    }
    await command(args.slice(), structuredArgs, commandSpecificConsole);
  } catch (e) {
    commandSpecificConsole.error(e.stack);
    makeResponse = commandError;
  }

  respond(makeResponse(messageId));
}

function shouldDebugCommand(argsString: string) {
  return DEBUG_RE && DEBUG_RE.test(argsString);
}

const error = (id: number, exitCode: number) => ({
  type: 'error' as const,
  id,
  exit_code: exitCode,
});
const unknownMessage = (id: number) => error(id, 1);
const invalidMessage = (id: number) => error(id, 2);
const commandError = (id: number) => error(id, 3);
const success = (id: number) => ({
  type: 'result' as const,
  id,
  exit_code: 0 as const,
});

export {buckWorker};

```

### Core Architecture Module: `packages/metro-cache/src/stores/NetworkError.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

export default class NetworkError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);

    this.code = code;
  }
}

```

### Core Architecture Module: `packages/metro-config/src/defaults/getMaxWorkers.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @oncall react_native
 */

import os from 'node:os';

export default function getMaxWorkers(workers: ?number): number {
  const cores = os.availableParallelism();
  return typeof workers === 'number' && Number.isInteger(workers)
    ? Math.min(cores, workers > 0 ? workers : 1)
    : Math.max(1, Math.ceil(cores * (0.5 + 0.5 * Math.exp(-cores * 0.07)) - 1));
}

```

### Core Architecture Module: `packages/metro-core/src/Logger.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall react_native
 */

import type {BundleOptions} from 'metro/private/shared/types';

import EventEmitter from 'node:events';
import os from 'node:os';

// eslint-disable-next-line import/no-commonjs
const VERSION = require('../package.json').version;

export type ActionLogEntryData = {
  action_name: string,
  log_entry_label?: string,
  ...
};

export type ActionStartLogEntry = {
  action_name?: string,
  action_phase?: string,
  log_entry_label: string,
  log_session?: string,
  start_timestamp?: [number, number],
  ...
};

export type LogEntry = {
  action_name?: string,
  action_phase?: string,
  action_result?: string,
  duration_ms?: number,
  entry_point?: string,
  file_name?: string,
  log_entry_label: string,
  log_session?: string,
  start_timestamp?: [number, number],
  outdated_modules?: number,
  bundle_size?: number,
  bundle_options?: BundleOptions,
  bundle_hash?: string,
  build_id?: string,
  error_message?: string,
  error_stack?: string,
  ...
};

const log_session = `${os.hostname()}-${Date.now()}`;
const eventEmitter = new EventEmitter();

function on(event: string, handler: (logEntry: LogEntry) => void): void {
  eventEmitter.on(event, handler);
}

function createEntry(data: LogEntry | string): LogEntry {
  const logEntry: LogEntry =
    typeof data === 'string' ? {log_entry_label: data} : data;

  return {
    ...logEntry,
    log_session,
    metro_bundler_version: VERSION,
  };
}

function createActionStartEntry(data: ActionLogEntryData | string): LogEntry {
  const logEntry = typeof data === 'string' ? {action_name: data} : data;
  const {action_name} = logEntry;

  return createEntry({
    log_entry_label: action_name,
    ...logEntry,
    action_name,
    action_phase: 'start',
    start_timestamp: process.hrtime(),
  });
}

function createActionEndEntry(
  logEntry: ActionStartLogEntry,
  error?: ?Error,
): LogEntry {
  const {action_name, action_phase, start_timestamp} = logEntry;

  if (action_phase !== 'start' || !Array.isArray(start_timestamp)) {
    throw new Error('Action has not started or has already ended');
  }

  const timeDelta = process.hrtime(start_timestamp);
  const duration_ms = Math.round((timeDelta[0] * 1e9 + timeDelta[1]) / 1e6);

  return createEntry({
    log_entry_label: action_name as ?string,
    ...logEntry,
    action_name,
    action_phase: 'end',
    duration_ms,
    ...(error != null
      ? {error_message: error.message, error_stack: error.stack}
      : null),
  });
}

function log(logEntry: LogEntry): LogEntry {
  eventEmitter.emit('log', logEntry);
  return logEntry;
}

export {on, createEntry, createActionStartEntry, createActionEndEntry, log};

```

### Core Architecture Module: `packages/metro-core/src/Terminal.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall react_native
 */

import type {Socket} from 'node:net';
import type {Writable} from 'node:stream';

import throttle from 'lodash.throttle';
import readline from 'node:readline';
import tty from 'node:tty';
import util from 'node:util';

const {promisify} = util;

type UnderlyingStream = Socket | Writable;

// use "readline/promises" instead when not experimental anymore
const moveCursor = promisify(readline.moveCursor);
const clearScreenDown = promisify(readline.clearScreenDown);
const streamWrite = promisify(
  (
    stream: UnderlyingStream,
    chunk: Buffer | Uint8Array | string,
    callback?: (data: any) => void,
  ) => {
    return stream.write(chunk, callback);
  },
);

/**
 * Cut a string into an array of strings of the specified maximum size. A newline
 * ends a chunk immediately (it's not included in the "." RegExp operator), and
 * is not included in the result.
 * When counting we should ignore non-printable characters. In particular the
 * ANSI escape sequences (regex: /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?m/)
 * (Not an exhaustive match, intended to match ANSI color escapes)
 * https://en.wikipedia.org/wiki/ANSI_escape_code
 */
function chunkString(str: string, size: number): Array<string> {
  const ANSI_COLOR = '\x1B\\[([0-9]{1,2}(;[0-9]{1,2})?)?m';
  const SKIP_ANSI = `(?:${ANSI_COLOR})*`;
  return str.match(new RegExp(`(?:${SKIP_ANSI}.){1,${size}}`, 'g')) || [];
}

/**
 * Get the stream as a TTY if it effectively looks like a valid TTY.
 */
function getTTYStream(stream: UnderlyingStream): ?tty.WriteStream {
  if (
    stream instanceof tty.WriteStream &&
    stream.isTTY &&
    stream.columns >= 1
  ) {
    return stream;
  }
  return null;
}

/**
 * We don't just print things to the console, sometimes we also want to show
 * and update progress. This utility just ensures the output stays neat: no
 * missing newlines, no mangled log lines.
 *
 *     const terminal = Terminal.default;
 *     terminal.status('Updating... 38%');
 *     terminal.log('warning: Something happened.');
 *     terminal.status('Updating, done.');
 *     terminal.persistStatus();
 *
 * The final output:
 *
 *     warning: Something happened.
 *     Updating, done.
 *
 * Without the status feature, we may get a mangled output:
 *
 *     Updating... 38%warning: Something happened.
 *     Updating, done.
 *
 * This is meant to be user-readable and TTY-oriented. We use stdout by default
 * because it's more about status information than diagnostics/errors (stderr).
 *
 * Do not add any higher-level functionality in this class such as "warning" and
 * "error" printers, as it is not meant for formatting/reporting. It has the
 * single responsibility of handling status messages.
 */
export default class Terminal {
  #logLines: Array<string>;
  #nextStatusStr: string;
  #statusStr: string;
  #stream: UnderlyingStream;
  #ttyStream: ?tty.WriteStream;
  #updatePromise: Promise<void> | null;
  #isUpdating: boolean;
  #isPendingUpdate: boolean;
  #shouldFlush: boolean;
  #writeStatusThrottled: string => void;

  constructor(stream: UnderlyingStream, opts: {ttyPrint?: boolean} = {}) {
    this.#logLines = [];
    this.#nextStatusStr = '';
    this.#statusStr = '';
    this.#stream = stream;
    this.#ttyStream = (opts.ttyPrint ?? true) ? getTTYStream(stream) : null;
    this.#updatePromise = null;
    this.#isUpdating = false;
    this.#isPendingUpdate = false;
    this.#shouldFlush = false;
    this.#writeStatusThrottled = throttle(
      status => this.#stream.write(status),
      3500,
    );
  }

  /**
   * Schedule an update of the status and log lines.
   * If there's an ongoing update, schedule another one after the current one.
   * If there are two updates scheduled, do nothing, as the second update will
   * take care of the latest status and log lines.
   */
  #scheduleUpdate() {
    if (this.#isUpdating) {
      this.#isPendingUpdate = true;
      return;
    }

    this.#isUpdating = true;
    this.#updatePromise = this.#update().then(async () => {
      while (this.#isPendingUpdate) {
        if (!this.#shouldFlush) {
          await new Promise(resolve => setTimeout(resolve, 33));
        }
        this.#isPendingUpdate = false;
        await this.#update();
      }
      this.#isUpdating = false;
      this.#shouldFlush = false;
    });
  }

  async waitForUpdates(): Promise<void> {
    await (this.#updatePromise || Promise.resolve());
  }

  /**
   * Useful for calling console/stdout directly after terminal logs
   * Otherwise, you could end up with mangled output when the queued
   * update starts writing to stream after a delay.
   */
  async flush(): Promise<void> {
    if (this.#isUpdating) {
      this.#shouldFlush = true;
    }
    await this.waitForUpdates();
    // $FlowFixMe[prop-missing]
    this.#writeStatusThrottled.flush();
  }

  /**
   * Clear and write the new status, logging in bulk in-between. Doing this in a
   * throttled way (in a different tick than the calls to `log()` and
   * `status()`) prevents us from repeatedly rewriting the status in case
   * `terminal.log()` is called several times.
   */
  async #update(): Promise<void> {
    const ttyStream = this.#ttyStream;

    const nextStatusStr = this.#nextStatusStr;
    const statusStr = this.#statusStr;
    const logLines = this.#logLines;

    // reset these here to not have them changed while updating
    this.#statusStr = nextStatusStr;
    this.#logLines = [];

    if (statusStr === nextStatusStr && logLines.length === 0) {
      return;
    }

    if (ttyStream && statusStr.length > 0) {
      const statusLinesCount = statusStr.split('\n').length - 1;
      // extra -1 because we print the status with a trailing new line
      await moveCursor(ttyStream, -ttyStream.columns, -statusLinesCount - 1);
      await clearScreenDown(ttyStream);
    }

    if (logLines.length > 0) {
      await streamWrite(this.#stream, logLines.join('\n') + '\n');
    }

    if (ttyStream) {
      if (nextStatusStr.length > 0) {
        await streamWrite(this.#stream, nextStatusStr + '\n');
      }
    } else {
      this.#writeStatusThrottled(
        nextStatusStr.length > 0 ? nextStatusStr + '\n' : '',
      );
    }
  }

  /**
   * Shows some text that is meant to be overridden later. Return the previous
   * status that was shown and is no more. Calling `status()` with no argument
   * removes the status altogether. The status is never shown in a
   * non-interactive terminal: for example, if the output is redirected to a
   * file, then we don't care too much about having a progress bar.
   */
  status(format: string, ...args: Array<unknown>): string {
    const nextStatusStr = this.#nextStatusStr;

    const statusStr = util.format(format, ...args);
    this.#nextStatusStr = this.#ttyStream
      ? chunkString(statusStr, this.#ttyStream.columns).join('\n')
      : statusStr;

    this.#scheduleUpdate();

    return nextStatusStr;
  }

  /**
   * Similar to `console.log`, except it moves the status/progress text out of
   * the way correctly. In non-interactive terminals this is the same as
   * `console.log`.
   */
  log(format: string, ...args: Array<unknown>): void {
    const line = util.format(format, ...args);

    if (this.#ttyStream) {
      this.#logLines.push(line);
    } else {
      void streamWrite(this.#stream, line + '\n');
    }

    this.#scheduleUpdate();
  }

  /**
   * Log the current status and start from scratch. This is useful if the last
   * status was the last one of a series of updates.
   */
  persistStatus(): void {
    this.log(this.#nextStatusStr);
    this.#nextStatusStr = '';
  }
}

```

### Core Architecture Module: `packages/metro-core/src/canonicalize.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall react_native
 */

export default function canonicalize(key: string, value: unknown): unknown {
  if (
    // eslint-disable-next-line lint/strictly-null
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return value;
  }

  const keys = Object.keys(value).sort();
  const length = keys.length;
  const object: {[string]: unknown} = {};

  for (let i = 0; i < length; i++) {
    object[keys[i]] = value[keys[i]];
  }

  return object;
}

```

### Core Architecture Module: `packages/metro-core/src/errors.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall react_native
 */

import AmbiguousModuleResolutionError from './errors/AmbiguousModuleResolutionError';
import PackageResolutionError from './errors/PackageResolutionError';

export {AmbiguousModuleResolutionError, PackageResolutionError};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1347** (2024-09-07): **[0.80.11] breaks package exports with symlinks**
  *Symptoms*: Hello, having an issue with `0.80.11` and `pnpm` + `expo` + symlinks + package exports  In `0.80.10` package exports are resolved correctly. In `0.80.11` package exports are not resolved.  I have created a reproduction of this issue here: https://github.com/franksmule/expo-repo/tree/main   Symlinks are enabled, although I've enabled `shamefully-hoist=true` - I believe local packages are still symlinked - so it seems to be an issue with the combination of symlinks and package exports?  Metro Config: (https://github.com/franksmule/expo-repo/blob/main/expo-app/metro.config.js) ``` config.resolver.unstable_enablePackageExports = true; config.resolver.unstable_enableSymlinks = true; ```  ``` iOS Bundling failed 756ms index.js (1013 modules) Unable to resolve "@internal/another-dep/hi" from "app/(tabs)/index.tsx" ```  Reproduction: https://github.com/franksmule/expo-repo - change https://github.com/franksmule/expo-repo/blob/main/package.json#L5 - to `0.80.10` and notice bundle will load.
  **Post-Mortem & Fix Analysis**:
  > Huge thanks for the report @franksmule - confirmed this is a bug with the new `TreeFS.hierarchicalLookup` and I can repro in a unit test (f409bde4).  Working on it...
  > Should be fixed in [v0.80.12](https://github.com/facebook/metro/releases/tag/v0.80.12)

- **Issue #1211** (2026-10-03): **React Native application does not update on many code changes when using vim**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?** *bug*  **What is the current behavior?** Newly-created React Native app doesn't reflect every code change during development when using Metro. The behavior is intermittent. Some code changes will be reflected in the app, then some won't be after saving the file. None of the following work to "force" an update:  * Saving the file repeatedly. * Hitting the "r" key to force reload in the Metro terminal window * Hitting the "r" key on the emulator to get it to reload. * Running with `--reset-cache`.  It looks minor, but it's really disruptive to development, since when I'm debugging, I can't tell which version of the app is currently being displayed. The only "workaround" I have is to add unique `console.log()` statements until one of them appears in the terminal that matches what I last wrote.  Usually the first code change is reflected after starting Metro. After that it's totally it or miss. I might get two or three successful updates in a row, and then none for a while.  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.**  1. Create a new React Native+metro application
  **Post-Mortem & Fix Analysis**:
  > Hi @antun - thanks for reporting. Something’s clearly wrong there but it’s hard to tell exactly where, since there are a few steps between a file event being detected and the app rendering updated modules (not all of them in Metro).   Just to clarify, when you hit `r` you see the client reload (the reloading indicator appears briefly and the state resets?), but the content doesn’t reflect your changes?  Could you possibly run a similar video starting Metro with `DEBUG=Metro:*` (eg `DEBUG=Metro:* yarn start`)? That should tell us more about whether file events are reaching Metro from Watchman, and whether the app is requesting updates.  
  > Hi @robhogan , thanks for reviewing this so quickly!  Here's an updated video in debug mode:  https://github.com/facebook/metro/assets/2186326/98206164-2ad2-4fd3-aa2d-67958a389b0d  In this video, only the very first change to code was captured (about 0:22 in the video).  When I hit `r`, you can see the client reload. (Go to about 1:02 in the video, that's when I hit the reload button.)  Observations:  When a change is captured correctly, and the app updates, this is the output:  ```   Metro:WatchmanWatcher Handling change to: App.tsx (new: false, exists: true, type: f) +0ms   Metro:WatchmanWatcher Handling change to: App.tsx~ (new: true, exists: false, type: f) +1ms   Metro:DeltaCalculator Handling change: /Users/akarlovac/git/nissan/react_native_update_test/App.tsx (type: f) +12m   Metro:DeltaCalculator Calculating delta (reset: false, shallow: false) +51ms   Metro:DeltaCalculator Traversing dependencies for 1 paths +0ms   Metro:DeltaCalculator Calculated graph del
  > **UPDATE**  I did a bit more digging and found that with vim (editor) the default behavior is to write the buffer to a new file (I'm guessing this is `App.tsx~`), delete the original file (`App.tsx`) and then rename the new file (presumably `App.tsx~` -> `App.tsx`). See [this SO post](https://stackoverflow.com/a/607475/1597106).  If I set `set nowritebackup` in my `.vimrc` file, then the app updates on every code change. So I guess vim's save process is confusing Metro.  It sounds like it's not recommended to leave `set nowritebackup` since there's a risk of losing the file if something goes wrong during the save.

- **Issue #1197** (2024-01-23): **[0.80.4] Metro bundle duplicated code when use unstable_enablePackageExports and unstable_enableSymlinks**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?**  bug  **What is the current behavior?**  My project uses `pnpm` + `monorepo` + `react-native`, and other self-developed libraries.  In my example project, I have three sub-projects, of which tool-demo is the react-native project, tool-runtime and tool-utils are other function libraries.  In the metro.config.js, unstable_enablePackageExports and unstable_enableSymlinks are true.  The dependencies are like this: 1. tool-demo use tool-utils 2. tool-utils uses tool-runtime/index and tool-runtime/setget. 3. tool-runtime/index also uses  tool-runtime/setget  When I bundle the react-native project，the code of tool-runtime/setget has been bundled twice.  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.**  Here is my example project: https://github.com/orochi97/monorepo/tree/main  steps:  1. `pnpm install` 2. `cd packages/tool-demo` and `pnpm run build:ios`, then will output the `index.bundle.ios.js` in the tool-demo dir. 3.  search the keyword `console.log('setRuntimeHelper');` in the `index.bundle.ios.js`, will find that the code is duplicated.  This will cause f
  **Post-Mortem & Fix Analysis**:
  > Huge thanks @orochi97 for the detailed report and repro - confirmed this is a previously-unknown bug due to a non-real absolute path ending up in the dependency graph, which [shouldn't happen](https://github.com/facebook/metro/blob/19f4c65fc56902d44616df488f81b0070f78c646/packages/metro-resolver/src/resolve.js#L491).   I'm looking into this now - in the mean time your commented out `realPathSync` custom resolver looks like a good workaround.
  > This turned out to be an issue with the package exports resolver, and the fix also ended up reducing bundle size by ~5% in the case of your demo. Thanks again for the report.  https://github.com/facebook/metro/pull/1198
  > @robhogan  Thank you for your reply and fix  :)

- **Issue #1015** (2023-09-14): **metro-file-map: Got unexpected null error (in `onTimeout`)**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?** Bug report  **What is the current behavior?** This started to happen after updating from RN 0.71 to 0.72.  Metro crashes with the following error: ``` /Users/renchap/dev/notos/node_modules/.pnpm/nullthrows@1.1.1/node_modules/nullthrows/nullthrows.js:9   throw error;   ^  Error: Got unexpected null     at nullthrows (/Users/renchap/dev/notos/node_modules/.pnpm/nullthrows@1.1.1/node_modules/nullthrows/nullthrows.js:7:15)     at Timeout.emitChange [as _onTimeout] (/Users/renchap/dev/notos/node_modules/.pnpm/metro-file-map@0.76.5/node_modules/metro-file-map/src/index.js:823:48)     at listOnTimeout (node:internal/timers:569:17)     at process.processTimers (node:internal/timers:512:7) {   framesToPop: 1 } ```  This seems to be happening what I start a build, or when I run `pnpm`.  This was not happening when running RN 0.71 (Metro 0.73.9).  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.** I do not have a repro, this happens randomly  **What is the expected behavior?** Metro does not crash  **Please provide your exact Metro configuration and mention your Me
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I've seen this a very intermittently as well - just noting for now that the offending assertion is this one https://github.com/facebook/metro/blob/6d46078e74ae9a43aa90bed46dbd6610e2696cd0/packages/metro-file-map/src/index.js#L921  So `eventStartTimestamp` is `null` for some reason, possibly a parallel Fast Refresh race - pretty sure it's unrelated to `unstable_enableSymlinks` or PNPM. We'll backport a fix once we pin this down.
  > I have this issue consistently since upgrading to 0.72.4 from 0.71.6. I also have `unstable_enableSymlinks = true`, and have watchman configured to watch folders outside the yarn workspace my RN project is in.  I use a custom bash script that detects existing instances of metro and launches a new instance if necessary before building and running the Android and iOS emulator/sim (in that order, by chance). This error always occurs while the Android emulator is connected and building on-device.  It doesn't happen if I launch the sims manually.  I'm running metro `v0.76.7`.  Here's the output from `npx react-native info`:  ``` bash System:   OS: macOS 13.5.1   CPU: (8) arm64 Apple M1   Memory: 135.63 MB / 16.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 18.16.1     path: ~/.nvm/versions/node/v18.16.1/bin/node   Yarn:     version: 3.2.2     path: ~/.yarn/bin/yarn   npm:     version: 9.5.1     path: ~/.nvm/versions/node/v18.16
  > In my case this bug seems to be triggered by operations in `node_modules` such as when you `yarn add something`.

- **Issue #660** (2026-08-30): **Symbolicate fails when using metro CLI directly**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?**  Bug 🐛   **What is the current behavior?**  When running the metro CLI directly there are many errors like:  ``` SyntaxError: Unexpected token u in JSON at position 0     at JSON.parse (<anonymous>)     at node_modules/metro/src/Server.js:1025:28     at Generator.next (<anonymous>)     at asyncGeneratorStep (node_modules/metro/src/Server.js:99:24)     at _next (node_modules/metro/src/Server.js:119:9) ```  Some debugging shows that rawBody is `undefined` and it's trying to be json parsed.  There is a comment in the code about not understanding where `rawBody` comes from:  https://github.com/facebook/metro/blob/af23a1b27bcaaff2e43cb795744b003e145e78dd/packages/metro/src/Server.js#L1028-L1029 I believe this isn't a bigger issue because the react native CLI provides this middleware automatically:  https://github.com/react-native-community/cli/blob/760708fc3216aee565f59877a103a7e35df2d77d/packages/cli-server-api/src/index.ts#L60  Should that middleware be moved down a layer or the code rewritten to not use this field?  <!-- **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and 
  **Post-Mortem & Fix Analysis**:
  > I had a similar issue in my codebase. It is a little bit strange, bc this problem is not reproducible on the fresh react native app.  In my codebase I had a below error:  `Unable to symbolicate stack trace: JSON Parse error: Unexpected EOF`  I was comparing both JSON (from the fresh app and from my app) and they are identical. so I don't know, where the issue can be.  
  > Just bumped into this issue today when trying to run metro manually from JS.  As @rockwotj pointed out, seems that metro assumes that it will always be used with a middleware that's added from the react-native cli which is not always the case.
  > We’re triaging older issues. Metro now parses the `/symbolicate` request body itself rather than depending on middleware from the React Native CLI. This was fixed in #1475 and released in Metro 0.82.2.

- **Issue #625** (2023-05-20): **Filename in babel plugins wrong in metro server**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->   **Do you want to request a *feature* or report a *bug*?** bug **What is the current behavior?** When using a custom --projectRoot or --entry-file babel plugins have a different path for `state.file.opts.filename` with the one passed in when running `start` being incorrect, missing the entire path of whatever was passed in with `projectRoot`. I made a simple test repo [here](https://github.com/imownbey/babelwrongpath) and you can see my babel plugin [here](https://github.com/imownbey/babelwrongpath/blob/master/babel.config.js) it just outputs `state.file.opts.filename` to console.  The resulting console log is: `yarn react-native start --projectRoot src/packages/app --reset-cache` results in: ``` transform[stdout]: /Users/ianownbey/src/babelPathWRong/index.js ```  `npx react-native bundle --entry-file src/packages/app/index.js --platform ios --bundle-output foo` results in: ``` transform[stdout]: /Users/ianownbey/src/babelPathWRong/src/packages/app/index.js ```  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.** ``` git clone git@github.com:imownbey/babelwrongpath.git cd babelwrongpath npx react-native start --projectRoot
  **Post-Mortem & Fix Analysis**:
  > Applied the following and it seems to resolve our issues. ``` diff --git a/node_modules/metro-react-native-babel-transformer/src/index.js b/node_modules/metro-react-native-babel-transformer/src/index.js index c34c047..9c9348a 100644 --- a/node_modules/metro-react-native-babel-transformer/src/index.js +++ b/node_modules/metro-react-native-babel-transformer/src/index.js @@ -170,8 +170,9 @@ function buildBabelConfig(      ...config,    };  } -function transform({ filename, options, src, plugins }) { +function transform({ filename: relativeFileName, options, src, plugins }) {    const OLD_BABEL_ENV = process.env.BABEL_ENV; +  const filename = path.join(options.projectRoot, relativeFileName)    process.env.BABEL_ENV = options.dev      ? "development"      : process.env.BABEL_ENV || "production"; ```
  > I hadn’t seen this issue but it looks like the one fixed in https://github.com/facebook/metro/commit/de19bbd33f239de1b29aac5db290ffffe26ec468 (Metro 0.76.1 / RN 72). Thanks @asherLZR for the pointer for folks on previous versions.  I’m going to close this as fixed, but please open a new issue if anyone sees this in RN 0.72+

- **Issue #18** (2017-08-17): **NPM modules being preferred over Haste modules**
  *Symptoms*: I've debugged https://github.com/facebook/react-native/issues/13765#issuecomment-312557021 down to an issue where RN's `var merge = require('merge')` will import `node_modules/merge`, instead of the expected `react-native/Libraries/vendor/core/merge.js` (which contains a `@providesModule merge` directive).  According to the dozens of users affected, it seems to be non-deterministic behavior that sometimes resolves itself with reinstallation, different versions of node, or recreation of the directory and node_modules directory. I'm not yet sure if this nondeterminisim is a bug in React-Native library code layout, or a bug in the RN packager (aka metro-bundler?) itself...but I'm leaning towards the latter, since it seems to violate my expectations for Haste module imports.     
  **Post-Mortem & Fix Analysis**:
  > I think Haste modules are always preferred, but it's possible it is a problem in `jest-haste-map` that make it not detect the existence of the `merge` Haste module as expected in particular conditions. The resolution logic wasn't changed so I'm surprised it appears to be a recent regression. We did add some bug fixes to `jest-haste-map`, possibly one could have caused a regression.
  > So another few hours of debugging, and I found that resetting the cache fixes things. Posted a follow-up with my analysis of why various voodoo magic fixes worked: https://github.com/facebook/react-native/issues/13765#issuecomment-312609314  No idea what led to a corrupted cache in the first place. I have my [old "busted" cache](https://gist.github.com/mikelambert/8430f24daec0366ea2997753dbb04478), if you are interested still.  The relevant merge bit, which explains why it was skipping the haste resolution and falling back on node module resolution: ``` "mergeInto":{"g":["/fullpath/mobile/node_modules/react-native/Libraries/vendor/core/mergeInto.js",0]}, "mergeHelpers":{"g":["/fullpath/mobile/node_modules/react-native/Libraries/vendor/core/mergeHelpers.js",0]}, "merge":{} ```  And the `"duplicates"` property, which included: ``` "merge":{"g":{   "/fullpath/mobile/node_modules/react-native/node_modules/merge/package.json":1,   "/fullpath/mobile/node_modules/react-native/L
  > Ohhh! This is very useful, thank you. Unfortunately, I expect thing to get broken again. This is actually a legitimate problem, and it needs to generate an error more proeminently. The duplication of modules stored in the `duplicates` field is real. I think there are 2 action items from there:  1. we need to make the `HasteMap#getModule` function crash immediately if there is module duplication for the requested module name. Right now, it's silent, so callsites believe the module is just not there. This is incorrect. 2. we may want to ignore "haste packages" contained inside `node_modules`, and/or the duplication detection system should keep packages and modules separate, that it doesn't look like to do right now.

- **Issue #2** (2017-08-14): **watchman: support any flavor of slashes on Windows**
  *Symptoms*: **Do you want to request a *feature* or report a *bug*?**  `metro-bundler`, and its dependency `jest-haste-map`, should support any flavor of slashes coming from watchman on Windows. On non-windows OSes we probabyl should still consider `\` as a non-special character.  This would solve https://github.com/facebook/watchman/issues/479  
  **Post-Mortem & Fix Analysis**:
  > Trying to solve this in https://github.com/facebook/jest/pull/3887.
  > https://github.com/facebook/jest/pull/4018 should have been the final fix needed. Please feel free to reopen if the problem is still happening on the latest version of jest/metro.

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

### Incident Patch 1: `0bff1b83` (2026-10-05)
**Commit Message**: Fix getCodeFrame resolution for watchFolder source files (#2018)

*Recreating #1710 / [D104259454](https://www.internalfb.com/diff/D104259454) (@motiz88) for GH first without a diff attachment*

The `getCodeFrame` helper in the symbolicate handler resolves stack frame file paths against `projectRoot` only. When source maps use `SourcePathsMode.ServerUrl`, the `file` field may be a server-relative URL pathname (e.g. `/src/App.js`) or a virtual-prefix path (e.g. `/[metro-watchFolders]/0/foo.js`). These resolve incorrectly against `projectRoot`.

Here, we check `path.isAbsolute(file)` first (for `SourcePathsMode.Absolute` source maps), then try `filePathOfUrlDecodedPathname` (for virtual-prefix paths), and fall back to the original `path.resolve(projectRoot, file)`.

Changelog: Internal

Test plan:
See [D104259454](https://www.internalfb.com/diff/D104259454)

Co-authored-by: Moti Zilberman <[REDACTED_EMAIL]>

**File**: `packages/metro/src/Server.js` (modified, +21/-1)
```diff
@@ -1358,6 +1358,17 @@ export default class Server {
   async _symbolicate(req: IncomingMessage, res: ServerResponse): Promise<void> {
     const depGraph = await this._bundler.getBundler().getDependencyGraph();
 
+    // A frame's file may be a virtual-prefixed path from a source map with
+    // server URL source paths, whose segments are percent-encoded. One that
+    // does not decode is taken as it is.
+    const filePathOfVirtualPathname = (file: string): ?string => {
+      try {
+        return this._rootUrlMap.filePathOfUrlPathname(file);
+      } catch {
+        return this._rootUrlMap.filePathOfUrlDecodedPathname(file);
+      }
+    };
+
     const getCodeFrame = (
       urls: Set<string>,
       symbolicatedStack: ReadonlyArray<StackFrameOutput>,
@@ -1379,7 +1390,16 @@ export default class Server {
           continue;
         }
 
-        const fileAbsolute = path.resolve(this._config.projectRoot, file ?? '');
+        const fileAbsolute =
+          file != null
+            ? (filePathOfVirtualPathname(file) ??
+              (path.isAbsolute(file)
+                ? file
+                : path.resolve(this._config.projectRoot, file)))
+            : null;
+        if (fileAbsolute == null) {
+          continue;
+        }
         if (!depGraph.doesFileExist(fileAbsolute)) {
           debug(
             'Skipping code frame for file not in dependency graph.',
```

**File**: `packages/metro/src/Server/__tests__/Server-test.js` (modified, +48/-0)
```diff
@@ -1485,6 +1485,54 @@ describe('processRequest', () => {
         expect(result.codeFrame).toBeNull();
       });
 
+      test.each([
+        ['/[metro-project]/mybundle.js', '/root/mybundle.js'],
+        ['/[metro-project]/My%20App.js', '/root/My App.js'],
+        ['/%5Bmetro-project%5D/My%20App.js', '/root/My App.js'],
+        ['/[metro-project]/My App.js', '/root/My App.js'],
+        ['/[metro-project]/100%.js', '/root/100%.js'],
+      ])(
+        'should return codeFrame when file is the virtual path %s',
+        async (file, filePath) => {
+          fs.writeFileSync(p(filePath), 'this\nis\nfake source');
+
+          const response = await makeRequest('/symbolicate', {
+            headers: {'content-type': 'application/json'},
+            data: JSON.stringify({
+              stack: [{file, lineNumber: 2, column: 0, methodName: 'test'}],
+            }),
+          });
+
+          const result = response._getJSON();
+          expect(result.stack[0].file).toBe(file);
+          expect(result.codeFrame).not.toBeNull();
+          expect(result.codeFrame.fileName).toBe(file);
+          expect(result.codeFrame.content).toEqual(expect.any(String));
+        },
+      );
+
+      test('should return codeFrame when file is a relative path (resolved against projectRoot)', async () => {
+        const response = await makeRequest('/symbolicate', {
+          headers: {'content-type': 'application/json'},
+          data: JSON.stringify({
+            stack: [
+              {
+                file: 'mybundle.js',
+                lineNumber: 2,
+                column: 0,
+                methodName: 'test',
+              },
+            ],
+          }),
+        });
+
+        const result = response._getJSON();
+        expect(result.stack[0].file).toBe('mybundle.js');
+        expect(result.codeFrame).not.toBeNull();
+        expect(result.codeFrame.fileName).toBe('mybundle.js');
+        expect(result.codeFrame.content).toEqual(expect.any(String));
+      });
+
       // TODO: This probably should restore the *original* file before rewrite
       // or normalisation.
       test('should leave original file and position when cannot symbolicate (after normalisation and rewriting?)', async () => {
```

---

### Incident Patch 2: `666ad390` (2026-10-05)
**Commit Message**: Fix HmrServer crash when entry point uses virtual URL prefix (#2017)

*Recreating #1709 / [D104223071](https://www.internalfb.com/diff/D104223071) (@motiz88) for GH first without a diff attachment*

D102004228 added support for serving bundles from `Server` with the handling `[metro-watchFolders]/<N>/...` or `[metro-project]/...` virtual URL prefixes, but did not add the same support in `HmrServer`.

Here, `HmrServer` constructs its own `RootUrlMap` to match `Server`'s behaviour exactly.

Changelog:

* **[Fix]:** Prevent HMR crash on `[metro-watchFolders]` or `[metro-project]` URLs

Test plan:
See [D104223071](https://www.internalfb.com/diff/D104223071)

Co-authored-by: Moti Zilberman <[REDACTED_EMAIL]>

**File**: `packages/metro/src/HmrServer.js` (modified, +16/-14)
```diff
@@ -28,6 +28,7 @@ import debounceAsyncQueue from './lib/debounceAsyncQueue';
 import formatBundlingError from './lib/formatBundlingError';
 import getGraphId from './lib/getGraphId';
 import parseBundleOptionsFromBundleRequestUrl from './lib/parseBundleOptionsFromBundleRequestUrl';
+import RootUrlMap from './lib/RootUrlMap';
 import splitBundleOptions from './lib/splitBundleOptions';
 import * as transformHelpers from './lib/transformHelpers';
 import debugModule from 'debug';
@@ -71,6 +72,7 @@ export default class HmrServer<TClient extends Client> {
   _bundler: IncrementalBundler;
   _createModuleId: (path: string) => number;
   _clientGroups: Map<RevisionId, ClientGroup>;
+  _rootUrlMap: RootUrlMap;
 
   constructor(
     bundler: IncrementalBundler,
@@ -81,6 +83,7 @@ export default class HmrServer<TClient extends Client> {
     this._bundler = bundler;
     this._createModuleId = createModuleId;
     this._clientGroups = new Map();
+    this._rootUrlMap = new RootUrlMap(config);
   }
 
   onClientConnect: (
@@ -121,19 +124,19 @@ export default class HmrServer<TClient extends Client> {
       transformOptions.platform,
       resolverOptions,
     );
-    const resolvedEntryFilePath = resolutionFn(
-      (this._config.server.unstable_serverRoot ?? this._config.projectRoot) +
-        '/.',
-      {
-        name: entryFile,
-        data: {
-          key: entryFile,
-          asyncType: null,
-          isESMImport: false,
-          locs: [],
-        },
+    const absolutePath =
+      this._rootUrlMap.filePathOfUrlDecodedPathname(entryFile);
+    const rootDir = absolutePath != null ? '/' : this._rootUrlMap.serverRootDir;
+    const resolvedEntryFile = absolutePath ?? entryFile;
+    const resolvedEntryFilePath = resolutionFn(rootDir + '/.', {
+      name: resolvedEntryFile,
+      data: {
+        key: resolvedEntryFile,
+        asyncType: null,
+        isESMImport: false,
+        locs: [],
       },
-    ).filePath;
+    }).filePath;
     const graphId = getGraphId(resolvedEntryFilePath, transformOptions, {
       resolverOptions,
       shallow: graphOptions.shallow,
@@ -379,8 +382,7 @@ export default class HmrServer<TClient extends Client> {
         createModuleId: this._createModuleId,
         includeAsyncPaths: group.graphOptions.lazy,
         projectRoot: this._config.projectRoot,
-        serverRoot:
-          this._config.server.unstable_serverRoot ?? this._config.projectRoot,
+        serverRoot: this._rootUrlMap.serverRootDir,
       });
 
       logger?.point('serialize_end');
```

**File**: `packages/metro/src/__tests__/HmrServer-test.js` (modified, +55/-0)
```diff
@@ -131,6 +131,7 @@ describe('HmrServer', () => {
         unstable_allowRequireContext: false,
       },
       resolver: {platforms: []},
+      watchFolders: [p('/external/node_modules')],
       server: {
         rewriteRequestUrl(requrl) {
           const rewritten = requrl.replace(
@@ -650,6 +651,60 @@ describe('HmrServer', () => {
     ]);
   });
 
+  test('should resolve [metro-watchFolders] prefix in entry point', async () => {
+    await connect(
+      '/hot?bundleEntry=./[metro-watchFolders]/0/expo-router/entry.js&platform=ios',
+    );
+
+    expect(getRevisionByGraphIdMock).toBeCalledWith(
+      getGraphId(
+        p('/external/node_modules/expo-router/entry.js'),
+        {
+          customTransformOptions: {},
+          dev: true,
+          minify: false,
+          platform: 'ios',
+          type: 'module',
+          unstable_transformProfile: 'default',
+        },
+        {
+          shallow: false,
+          lazy: false,
+          unstable_allowRequireContext: false,
+          resolverOptions: {
+            dev: true,
+          },
+        },
+      ),
+    );
+  });
+
+  test('should resolve [metro-project] prefix in entry point', async () => {
+    await connect('/hot?bundleEntry=./[metro-project]/src/App.js&platform=ios');
+
+    expect(getRevisionByGraphIdMock).toBeCalledWith(
+      getGraphId(
+        p('/root/src/App.js'),
+        {
+          customTransformOptions: {},
+          dev: true,
+          minify: false,
+          platform: 'ios',
+          type: 'module',
+          unstable_transformProfile: 'default',
+        },
+        {
+          shallow: false,
+          lazy: false,
+          unstable_allowRequireContext: false,
+          resolverOptions: {
+            dev: true,
+          },
+        },
+      ),
+    );
+  });
+
   test('should return error messages when there is a transform error', async () => {
     jest.useRealTimers();
     const sendMessage = jest.fn();
```

---

### Incident Patch 3: `edfc17ea` (2026-10-05)
**Commit Message**: Add integration tests for virtual-prefix URL routing (#2014)

*Recreating #1706 / [D104259281](https://www.internalfb.com/diff/D104259281) (@motiz88) for GH first without a diff attachment*

Adds integration tests for `[metro-project]` and `[metro-watchFolders]` virtual URL prefixes: bundle requests, out-of-bounds index 404, and asset serving.

Removes Server unit tests that tested private methods (`_resolveWatchFolderPrefix`, `_getEntryPointAbsolutePath`) directly. The behaviours they covered are now tested end-to-end by the new integration tests and will also be covered by `ProjectRouteMap` unit tests in the next diff.

All tests pass without any production code changes.

Test plan:
See [D104259281](https://www.internalfb.com/diff/D104259281)

Co-authored-by: Moti Zilberman <[REDACTED_EMAIL]>

**File**: `packages/metro/src/Server/__tests__/Server-test.js` (modified, +0/-61)
```diff
@@ -1614,67 +1614,6 @@ describe('processRequest', () => {
       );
     });
 
-    test('resolves [metro-watchFolders]/N/ prefix against the Nth watch folder', () => {
-      expect(
-        watchFolderServer._resolveWatchFolderPrefix(
-          './[metro-watchFolders]/1/expo-router/entry',
-        ),
-      ).toEqual({
-        rootDir: p('/external/packages'),
-        filePath: p('./expo-router/entry'),
-      });
-    });
-
-    test('resolves [metro-watchFolders]/0/ prefix against the first watch folder', () => {
-      expect(
-        watchFolderServer._resolveWatchFolderPrefix(
-          './[metro-watchFolders]/0/app/index',
-        ),
-      ).toEqual({
-        rootDir: p('/project'),
-        filePath: p('./app/index'),
-      });
-    });
-
-    test('resolves [metro-project]/ prefix against projectRoot', () => {
-      expect(
-        watchFolderServer._resolveWatchFolderPrefix(
-          './[metro-project]/src/App',
-        ),
-      ).toEqual({
-        rootDir: p('/project'),
-        filePath: p('./src/App'),
-      });
-    });
-
-    test('returns null for paths without a recognized prefix', () => {
-      expect(
-        watchFolderServer._resolveWatchFolderPrefix('./mybundle'),
-      ).toBeNull();
-    });
-
-    test('returns null for out-of-bounds watchFolder index', () => {
-      expect(
-        watchFolderServer._resolveWatchFolderPrefix(
-          './[metro-watchFolders]/99/mybundle',
-        ),
-      ).toBeNull();
-    });
-
-    test('_getEntryPointAbsolutePath resolves prefixed entry against the corresponding watch folder', () => {
-      expect(
-        watchFolderServer._getEntryPointAbsolutePath(
-          './[metro-watchFolders]/1/expo-router/entry',
-        ),
-      ).toBe(p('/external/packages/expo-router/entry'));
-    });
-
-    test('_getEntryPointAbsolutePath resolves non-prefixed entry against server root', () => {
-      expect(watchFolderServer._getEntryPointAbsolutePath('./mybundle')).toBe(
-        p('/project/mybundle'),
-      );
-    });
-
     test.each([
       [p('/project/imgs/a.png')],
       [p('/project/nested/deep/b.png')],
```

**File**: `packages/metro/src/integration_tests/__tests__/build-test.js` (modified, +35/-0)
```diff
@@ -118,6 +118,41 @@ test('allows specifying paths to save bundle and maps', async () => {
   );
 });
 
+// $FlowFixMe[prop-missing] - test.failing is not in Flow's Jest types
+test.failing(
+  'builds a bundle from a file in a directory literally named [metro-project]',
+  async () => {
+    const config = await Metro.loadConfig({
+      config: require.resolve('../metro.config.js'),
+    });
+
+    const result = await Metro.runBuild(config, {
+      entry: './[metro-project]/LiteralDir.js',
+    });
+
+    expect(execBundle(result.code)).toBe('from-literal-dir');
+  },
+);
+
+// $FlowFixMe[prop-missing] - test.failing is not in Flow's Jest types
+test.failing(
+  'runBuild resolves entry against projectRoot, not unstable_serverRoot',
+  async () => {
+    const baseConfig = await Metro.loadConfig({
+      config: require.resolve('../metro.config.js'),
+    });
+    const config = MetroConfig.mergeConfig(baseConfig, {
+      server: {unstable_serverRoot: path.resolve(INPUT_PATH, '..')},
+    });
+
+    const result = await Metro.runBuild(config, {
+      entry: 'TestBundle.js',
+    });
+
+    expect(execBundle(result.code)).toBeDefined();
+  },
+);
+
 test('(unstable) allows specifying a transform profile', async () => {
   const config = await Metro.loadConfig({
     config: require.resolve('../metro.config.js'),
```

**File**: `packages/metro/src/integration_tests/__tests__/rambundle-test.js` (modified, +22/-8)
```diff
@@ -19,32 +19,46 @@ const vm = require('node:vm');
 
 jest.setTimeout(30 * 1000);
 
-test('builds and executes a RAM bundle', async () => {
-  const config = await Metro.loadConfig({
+let config;
+
+beforeAll(async () => {
+  config = await Metro.loadConfig({
     config: require.resolve('../metro.config.js'),
   });
-  const bundlePath = path.join(os.tmpdir(), 'rambundle.js');
+});
 
+async function buildAndExecRamBundle(entry: string): mixed {
+  const bundlePath = path.join(os.tmpdir(), `rambundle-${Date.now()}.js`);
   try {
     await Metro.runBuild(config, {
-      entry: 'TestBundle.js',
+      entry,
       output: ramBundleOutput,
       out: bundlePath,
     });
 
     const bundleBuffer = fs.readFileSync(bundlePath);
     const parser = new RamBundleParser(bundleBuffer);
 
-    // Create a context with a global nativeRequire function, which reads the
-    // module code from the RAM bundle and injects it into the VM.
     const context = vm.createContext({
       nativeRequire(id) {
         vm.runInContext(parser.getModule(id), context);
       },
     });
 
-    expect(vm.runInContext(parser.getStartupCode(), context)).toMatchSnapshot();
+    return vm.runInContext(parser.getStartupCode(), context);
   } finally {
-    fs.unlinkSync(bundlePath);
+    if (fs.existsSync(bundlePath)) {
+      fs.unlinkSync(bundlePath);
+    }
   }
+}
+
+test('builds and executes a RAM bundle', async () => {
+  expect(await buildAndExecRamBundle('TestBundle.js')).toMatchSnapshot();
+});
+
+test('rejects [metro-project] virtual prefix in runBuild entry', async () => {
+  await expect(
+    buildAndExecRamBundle('./[metro-project]/TestBundle.js'),
+  ).rejects.toThrow('was not found');
 });
```

**File**: `packages/metro/src/integration_tests/__tests__/server-test.js` (modified, +87/-0)
```diff
@@ -25,6 +25,14 @@ const fetchAndClose = (path: string) =>
     headers: {Connection: 'close'},
   });
 
+const sourcesOfIndexMap = (indexMap: {
+  readonly sections: ReadonlyArray<{
+    readonly map: {readonly sources: ReadonlyArray<string>, ...},
+    ...
+  }>,
+  ...
+}): Array<string> => indexMap.sections.flatMap(section => section.map.sources);
+
 describe('Metro development server serves bundles via HTTP', () => {
   let httpServer;
   const bundlesDownloaded = new Set();
@@ -122,6 +130,85 @@ describe('Metro development server serves bundles via HTTP', () => {
     );
   });
 
+  // TODO(T000000): Fix virtual-prefix URL resolution on Windows.
+  // path.sep differences cause entry point resolution to fail.
+  (process.platform === 'win32' ? test.skip : test)(
+    'should serve bundles with [metro-watchFolders] entry point',
+    async () => {
+      expect(
+        await downloadAndExec(
+          '/[metro-watchFolders]/1/metro/src/integration_tests/basic_bundle/TestBundle.bundle?platform=ios&dev=true&minify=false',
+        ),
+      ).toBeDefined();
+    },
+  );
+
+  (process.platform === 'win32' ? test.skip : test)(
+    'should serve bundles with [metro-project] entry point',
+    async () => {
+      expect(
+        await downloadAndExec(
+          '/[metro-project]/TestBundle.bundle?platform=ios&dev=true&minify=false',
+        ),
+      ).toBeDefined();
+    },
+  );
+
+  (process.platform === 'win32' ? test.skip : test)(
+    '[metro-project] source map resolves same modules as non-prefixed',
+    async () => {
+      const directResponse = await fetchAndClose(
+        'http://localhost:' +
+          httpServer.address().port +
+          '/TestBundle.map?platform=ios&dev=true&minify=false',
+      );
+      expect(directResponse.ok).toBe(true);
+      const directMap = await directResponse.json();
+      const prefixedResponse = await fetchAndClose(
+        'http://localhost:' +
+          httpServer.address().port +
+          '/[metro-project]/TestBundle.map?platform=ios&dev=true&minify=false',
+      );
+      expect(prefixedResponse.ok).toBe(true);
+      const prefixedMap = await prefixedResponse.json();
+      expect(sourcesOfIndexMap(prefixedMap).sort()).toEqual(
+        sourcesOfIndexMap(directMap).sort(),
+      );
+    },
+  );
+
+  (process.platform === 'win32' ? test.skip : test)(
+    '[metro-watchFolders] source map resolves same modules as non-prefixed',
+    async () => {
+      const directResponse = await fetchAndClose(
+        'http://localhost:' +
+          httpServer.address().port +
+          '/TestBundle.map?platform=ios&dev=true&minify=false',
+      );
+      expect(directResponse.ok).toBe(true);
+      const directMap = await directResponse.json();
+      const watchFolderResponse = await fetchAndClose(
+        'http://localhost:' +
+          httpServer.address().port +
+          '/[metro-watchFolders]/1/metro/src/integration_tests/basic_bundle/TestBundle.map?platform=ios&dev=true&minify=false',
+      );
+      expect(watchFolderResponse.ok).toBe(true);
+      const watchFolderMap = await watchFolderResponse.json();
+      expect(sourcesOfIndexMap(watchFolderMap).sort()).toEqual(
+        sourcesOfIndexMap(directMap).sort(),
+      );
+    },
+  );
+
+  test('responds with 404 for [metro-watchFolders] with out-of-bounds index', async () => {
+    const response = await fetchAndClose(
+      'http://localhost:' +
+        httpServer.address().port +
+        '/[metro-watchFolders]/99/TestBundle.bundle?platform=ios&dev=true&minify=false',
+    );
+    expect(response.status).toBe(404);
+  });
+
   test('responds with 404 when the bundle cannot be resolved', async () => {
     const response = await fetchAndClose(
       'http://localhost:' + httpServer.address().port + '/doesnotexist.bundle',
```

**File**: `packages/metro/src/integration_tests/basic_bundle/[metro-project]/LiteralDir.js` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow strict-local
+ * @format
+ */
+
+module.exports = 'from-literal-dir';
```

---

### Incident Patch 4: `26689e0b` (2026-10-01)
**Commit Message**: Replace react-test-renderer with @testing-library/react (#1995)

Summary:

`react-test-renderer` is deprecated in React 19. This migrates the Fast Refresh integration tests in `metro-runtime` to `testing-library/react` over `react-dom`.

- `MetroFastRefreshMockRuntime` loads `react-dom/client` and `testing-library/react/pure` while the DevTools hook is aliased to the runtime's global, and exposes `render`/`screen` instead of `renderer`. Tests call `cleanupRuntimes()` in `afterEach` because the pure entry point skips auto-cleanup.
- The test runs under `jsdom` (adds `jest-environment-jsdom`). The module system is created with `window` shadowed as `undefined`, so the simulated environment still has no window, like React Native.
- `jest.config.js` maps `react` to metro-runtime's copy. In the xplat/js workspace, `react-dom@19.3.0` is hoisted to `xplat/js/node_modules` and would otherwise resolve `react@19.0.0`, which means two React instances and empty renders.
- Replaces the `react-test-renderer` libdef with minimal `react-dom/client` and `testing-library/react/pure` declarations in `flow-typed/react-testing.js`.
- Updates both lockfiles and adds the new offline-mirror tarballs.

Diff

**File**: `flow-typed/npm/react-test-renderer_v16.x.x.js` (removed, +0/-93)
```diff
@@ -1,93 +0,0 @@
-/**
- * Copyright (c) Meta Platforms, Inc. and affiliates.
- *
- * This source code is licensed under the MIT license found in the
- * LICENSE file in the root directory of this source tree.
- */
-
-// Type definitions for react-test-renderer 16.x.x
-// Ported from: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react-test-renderer
-
-type TestRendererOptions = {
-  createNodeMock(element: React.MixedElement): any,
-  ...
-};
-
-declare module 'react-test-renderer' {
-  import type {Component as ReactComponent} from 'react';
-
-  type ReactComponentInstance = ReactComponent<any>;
-
-  export type ReactTestRendererJSON = {
-    type: string,
-    props: {[propName: string]: any, ...},
-    children: null | ReactTestRendererJSON[],
-    ...
-  };
-
-  export type ReactTestRendererTree = ReactTestRendererJSON & {
-    nodeType: 'component' | 'host',
-    instance: ?ReactComponentInstance,
-    rendered: null | ReactTestRendererTree,
-    ...
-  };
-
-  export type ReactTestInstance = {
-    instance: ?ReactComponentInstance,
-    type: string,
-    props: {[propName: string]: any, ...},
-    parent: null | ReactTestInstance,
-    children: Array<ReactTestInstance | string>,
-    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance,
-    findByType(type: React.ElementType): ReactTestInstance,
-    findByProps(props: {[propName: string]: any, ...}): ReactTestInstance,
-    findAll(
-      predicate: (node: ReactTestInstance) => boolean,
-      options?: {deep: boolean, ...},
-    ): ReactTestInstance[],
-    findAllByType(
-      type: React.ElementType,
-      options?: {deep: boolean, ...},
-    ): ReactTestInstance[],
-    findAllByProps(
-      props: {[propName: string]: any, ...},
-      options?: {deep: boolean, ...},
-    ): ReactTestInstance[],
-    ...
-  };
-
-  export type ReactTestRenderer = {
-    toJSON(): null | ReactTestRendererJSON,
-    toTree(): null | ReactTestRendererTree,
-    unmount(nextElement?: React.MixedElement): void,
-    update(nextElement: React.MixedElement): void,
-    getInstance(): ?ReactComponentInstance,
-    root: ReactTestInstance,
-    ...
-  };
-
-  declare type Thenable = {
-    then(resolve: () => unknown, reject?: () => unknown): unknown,
-    ...
-  };
-
-  declare function create(
-    nextElement: React.MixedElement,
-    options?: TestRendererOptions,
-  ): ReactTestRenderer;
-
-  declare function act(callback: () => void | Promise<void>): Thenable;
-}
-
-declare module 'react-test-renderer/shallow' {
-  import type {ReactTestInstance} from 'react-test-renderer';
-
-  declare export default class ShallowRenderer {
-    static createRenderer(): ShallowRenderer;
-    getMountedInstance(): ReactTestInstance;
-    getRenderOutput<E: React.MixedElement>(): E;
-    getRenderOutput(): React.MixedElement;
-    render(element: React.MixedElement, context?: any): void;
-    unmount(): void;
-  }
-}
```

**File**: `flow-typed/react-testing.js` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow strict
+ * @format
+ * @oncall react_native
+ */
+
+// Subsets of `react-dom/client` and `@testing-library/react` used by Metro.
+
+declare module 'react-dom/client' {
+  import type {Node} from 'react';
+
+  declare export type ErrorInfo = {readonly componentStack?: ?string, ...};
+
+  declare export type RootOptions = {
+    identifierPrefix?: string,
+    onCaughtError?: (error: unknown, errorInfo: ErrorInfo) => void,
+    onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void,
+    onUncaughtError?: (error: unknown, errorInfo: ErrorInfo) => void,
+  };
+
+  declare export type Root = {
+    render(children: Node): void,
+    unmount(): void,
+  };
+
+  declare module.exports: {
+    createRoot(
+      container: Element | DocumentFragment,
+      options?: RootOptions,
+    ): Root,
+    hydrateRoot(
+      container: Element | Document | DocumentFragment,
+      initialChildren: Node,
+      options?: RootOptions,
+    ): Root,
+  };
+}
+
+declare module '@testing-library/react/pure' {
+  import type {ComponentType, Node} from 'react';
+
+  declare export type MatcherFunction = (
+    content: string,
+    element: Element | null,
+  ) => boolean;
+
+  declare export type Matcher = MatcherFunction | RegExp | number | string;
+
+  declare export type SelectorMatcherOptions = {
+    collapseWhitespace?: boolean,
+    exact?: boolean,
+    ignore?: boolean | string,
+    normalizer?: (text: string) => string,
+    selector?: string,
+    suggest?: boolean,
+    trim?: boolean,
+  };
+
+  declare export type BoundQueries = {
+    getByText: (text: Matcher, options?: SelectorMatcherOptions) => HTMLElement,
+    queryByText: (
+      text: Matcher,
+      options?: SelectorMatcherOptions,
+    ) => HTMLElement | null,
+    ...
+  };
+
+  declare export type RenderOptions = {
+    baseElement?: HTMLElement,
+    container?: HTMLElement,
+    hydrate?: boolean,
+    wrapper?: ComponentType<{children: Node}>,
+  };
+
+  declare export type RenderResult = {
+    ...BoundQueries,
+    asFragment: () => DocumentFragment,
+    baseElement: HTMLElement,
+    container: HTMLElement,
+    rerender: (ui: Node) => void,
+    unmount: () => void,
+    ...
+  };
+
+  declare export var screen: BoundQueries;
+
+  declare export function render(
+    ui: Node,
+    options?: RenderOptions,
+  ): RenderResult;
+
+  declare export function cleanup(): void;
+
+  declare export function act(callback: () => void): void;
+  declare export function act<T>(callback: () => T | Promise<T>): Promise<T>;
+}
```

**File**: `jest.config.js` (modified, +11/-0)
```diff
@@ -8,6 +8,15 @@
  * @oncall react_native
  */
 
+const path = require('node:path');
+
+// react-dom may be hoisted away from metro-runtime's react; share one instance.
+const reactDir = path.dirname(
+  require.resolve('react/package.json', {
+    paths: [path.join(__dirname, 'packages/metro-runtime')],
+  }),
+);
+
 /** @type {import('jest').Config} **/
 module.exports = {
   filter: '<rootDir>/scripts/jestFilter.js',
@@ -22,6 +31,8 @@ module.exports = {
   },
   moduleNameMapper: {
     '^prettier$': '<rootDir>/scripts/nativePrettier.js',
+    '^react$': reactDir,
+    '^react/(.*)$': `${reactDir}/$1`,
   },
   testEnvironment: 'node',
   testRegex: '/__tests__/.*-test\\.js$',
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@
     "istanbul-api": "3.0.0",
     "istanbul-lib-coverage": "3.0.0",
     "jest": "^29.7.0",
+    "jest-environment-jsdom": "^29.7.0",
     "jest-junit": "^16.0.0",
     "jest-watch-typeahead": "^2.2.0",
     "jsonc-eslint-parser": "^2.3.0",
```

**File**: `packages/metro-runtime/package.json` (modified, +4/-2)
```diff
@@ -29,9 +29,11 @@
   },
   "devDependencies": {
     "@babel/core": "^7.25.2",
+    "@testing-library/dom": "^10.0.0",
+    "@testing-library/react": "^16.1.0",
     "react": "19.3.0",
-    "react-refresh": "^0.14.0",
-    "react-test-renderer": "19.3.0"
+    "react-dom": "19.3.0",
+    "react-refresh": "^0.14.0"
   },
   "engines": {
     "node": "^22.13.0 || ^24.3.0 || >= 26.0.0"
```

**File**: `packages/metro-runtime/src/polyfills/__tests__/MetroFastRefreshMockRuntime.js` (modified, +50/-8)
```diff
@@ -10,18 +10,31 @@
  */
 
 import type {DefineFn, RequireFn} from '../require';
+import typeof {
+  act as Act,
+  render as Render,
+  screen as Screen,
+} from '@testing-library/react/pure';
 import typeof * as ReactModule from 'react';
 import typeof ReactRefreshRuntime from 'react-refresh/runtime';
-import typeof ReactTestRenderer from 'react-test-renderer';
 
 import {transformSync} from '@babel/core';
 import fs from 'node:fs';
 
 type RuntimeGlobal = Object;
 
+const runtimeCleanups: Set<() => void> = new Set();
+
+export function cleanupRuntimes(): void {
+  runtimeCleanups.forEach(cleanup => {
+    cleanup();
+  });
+  runtimeCleanups.clear();
+}
+
 /**
  * A runtime that combines Metro's module system, a React renderer
- * (react-test-renderer) and Fast Refresh.
+ * (@testing-library/react over react-dom) and Fast Refresh.
  *
  * The runtime has its own global object and dedicated instances of the relevant
  * Metro/React modules, but otherwise runs in the enclosing JS context without
@@ -61,10 +74,16 @@ export class Runtime {
   React: ReactModule;
 
   /**
-   * The React renderer running in this runtime. Conceptually equivalent to
-   * require('react-test-renderer').
+   * Testing Library render bound to this runtime's renderer instance.
+   * Conceptually equivalent to require('@testing-library/react/pure').render.
+   */
+  render: Render;
+
+  /**
+   * Testing Library screen bound to this runtime's renderer instance.
+   * Conceptually equivalent to require('@testing-library/react/pure').screen.
    */
-  renderer: ReactTestRenderer;
+  screen: Screen;
 
   /**
    * Jest mock functions used as event handlers.
@@ -86,12 +105,19 @@ export class Runtime {
 
   // $FlowFixMe[value-as-type]: react-refresh/runtime is untyped
   #reactRefreshRuntime: ReactRefreshRuntime;
+  #act: Act;
   #global: RuntimeGlobal = {};
   #globalPrefix: string = '';
 
   constructor() {
     // Set up the module system and expose relevant APIs.
-    createModuleSystem(this.#global, /* __DEV__ */ true, this.#globalPrefix);
+    // See comment above this function's declaration.
+    createModuleSystem(
+      this.#global,
+      /* __DEV__ */ true,
+      this.#globalPrefix,
+      /* window */ undefined,
+    );
     this.define = this.#global[this.#globalPrefix + '__d'];
     this.metroRequire = this.#global[this.#globalPrefix + '__r'];
     this.registerSegment = this.#global.__registerSegment;
@@ -109,7 +135,14 @@ export class Runtime {
       // NOTE: Strictly speaking, this is an implementation detail of React.
       global.__REACT_DEVTOOLS_GLOBAL_HOOK__ =
         this.#global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
-      this.renderer = require('react-test-renderer');
+      // Loaded while the hook is aliased so the renderer binds to this runtime.
+      // The pure entry point skips auto-cleanup; tests call cleanupRuntimes().
+      require('react-dom/client');
+      const testingLibrary = require('@testing-library/react/pure');
+      this.render = testingLibrary.render;
+      this.screen = testingLibrary.screen;
+      this.#act = testingLibrary.act;
+      runtimeCleanups.add(testingLibrary.cleanup);
       delete global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
     });
 
@@ -133,7 +166,7 @@ export class Runtime {
           this.events.onFullReload('Fast Refresh - Unrecoverable');
           return;
         }
-        this.renderer.act(() => {
+        this.#act(() => {
           this.#reactRefreshRuntime.performReactRefresh();
         });
         this.events.onFastRefresh();
@@ -156,16 +189,25 @@ const moduleSystemCode = (() => {
   }).code;
 })();
 
+// Evaluates the transformed require.js with its free variables bound to the
+// arguments, installing Metro's module system (`__d`, `__r`,
+// `__registerSegment`, ...) on the given global object.
+// React Native has no `window` object, but jsdom does, so `window` is bound
+// to undefined to simulate React Native. Otherwise require.js'
+// `performFullRefresh` would call jsdom's `window.location.reload()`
+// instead of `__ReactRefresh.performFullRefresh`.
 const createModuleSystem: (
   this: any,
   RuntimeGlobal,
   boolean,
   string,
+  void,
 ) => unknown =
   // eslint-disable-next-line no-new-func
   new Function(
     'global',
     '__DEV__',
     '__METRO_GLOBAL_PREFIX__',
+    'window',
     moduleSystemCode,
   );
```

**File**: `packages/metro-runtime/src/polyfills/__tests__/fast-refresh-integration-test.js` (modified, +16/-19)
```diff
@@ -7,13 +7,16 @@
  * @flow strict-local
  * @format
  * @oncall react_native
+ * @jest-environment jsdom
  */
 
-import {Runtime} from './MetroFastRefreshMockRuntime';
+import {Runtime, cleanupRuntimes} from './MetroFastRefreshMockRuntime';
 
 describe('Fast Refresh integration with require()', () => {
-  test('preserves state in a single-module bundle', async () => {
-    const {renderer, define, metroRequire, React, events} = new Runtime();
+  afterEach(cleanupRuntimes);
+
+  test('preserves state in a single-module bundle', () => {
+    const {render, screen, define, metroRequire, React, events} = new Runtime();
 
     const ids = {
       'Component.js': 0,
@@ -36,11 +39,8 @@ describe('Fast Refresh integration with require()', () => {
 
     // Initial render
     const Component = metroRequire(ids['Component.js']);
-    let rendered;
-    await renderer.act(async () => {
-      rendered = renderer.create(<Component />);
-    });
-    expect(rendered?.toJSON()).toBe('version1: initialState1');
+    render(<Component />);
+    expect(screen.getByText('version1: initialState1')).toBeDefined();
 
     // Edit the component
     define(
@@ -63,13 +63,13 @@ describe('Fast Refresh integration with require()', () => {
     jest.runAllTimers();
 
     // Fast Refresh: Render the new version of the component with the old state.
-    expect(rendered?.toJSON()).toBe('version2: initialState1');
+    expect(screen.getByText('version2: initialState1')).toBeDefined();
     expect(events.onFastRefresh).toHaveBeenCalled();
     expect(events.onFullReload).not.toHaveBeenCalled();
   });
 
-  test('reloads a single-module bundle when invalidated by component signatures', async () => {
-    const {renderer, define, metroRequire, React, events} = new Runtime();
+  test('reloads a single-module bundle when invalidated by component signatures', () => {
+    const {render, screen, define, metroRequire, React, events} = new Runtime();
 
     const ids = {
       'Component.js': 0,
@@ -92,11 +92,8 @@ describe('Fast Refresh integration with require()', () => {
 
     // Initial render
     const Component = metroRequire(ids['Component.js']);
-    let rendered;
-    await renderer.act(async () => {
-      rendered = renderer.create(<Component />);
-    });
-    expect(rendered?.toJSON()).toBe('version1: initialState1');
+    render(<Component />);
+    expect(screen.getByText('version1: initialState1')).toBeDefined();
 
     // Edit the component
     define(
@@ -120,16 +117,16 @@ describe('Fast Refresh integration with require()', () => {
 
     // Full refresh: The component does not rerender. Instead, we signal a
     // reload.
-    // $FlowFixMe[incompatible-use]
-    expect(rendered.toJSON()).toBe('version1: initialState1');
+    expect(screen.getByText('version1: initialState1')).toBeDefined();
+    expect(screen.queryByText('version2: initialState2')).toBeNull();
     expect(events.onFastRefresh).not.toHaveBeenCalled();
     expect(events.onFullReload).toHaveBeenCalled();
     expect(events.onFullReload.mock.calls).toEqual([
       ['Fast Refresh - Invalidated boundary <Component.js> <Component.js>'],
     ]);
   });
 
-  test('handles a lazily-registered (unloaded) parent during Fast Refresh', async () => {
+  test('handles a lazily-registered (unloaded) parent during Fast Refresh', () => {
     const {define, metroRequire, registerSegment, events} = new Runtime();
 
     const ids = {
```

**File**: `yarn.lock` (modified, +435/-17)
```diff
@@ -7,7 +7,7 @@
   resolved "https://registry.yarnpkg.com/@aashutoshrathi/word-wrap/-/word-wrap-1.2.6.tgz#bd9154aec9983f77b3a034ecaa015c2e4201f6cf"
   integrity sha512-1Yjs2SvM8TflER/OD3cOjhWWOZb58A2t7wpE2S9XfBYTiIl+XFhQG2bjy4Pu1I+EAlCNUzRDYDdFwFYUKvXcIA==
 
-"@babel/code-frame@^7.0.0", "@babel/code-frame@^7.12.13", "@babel/code-frame@^7.16.0", "@babel/code-frame@^7.29.0", "@babel/code-frame@^7.29.7":
+"@babel/code-frame@^7.0.0", "@babel/code-frame@^7.10.4", "@babel/code-frame@^7.12.13", "@babel/code-frame@^7.16.0", "@babel/code-frame@^7.29.0", "@babel/code-frame@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.29.7.tgz#f2fbbfea87c44a21590ec515b778b2c26d8866e7"
   integrity sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==
@@ -669,7 +669,7 @@
   dependencies:
     core-js-pure "^3.48.0"
 
-"@babel/runtime@^7.10.2", "@babel/runtime@^7.18.3", "@babel/runtime@^7.25.0":
+"@babel/runtime@^7.10.2", "@babel/runtime@^7.12.5", "@babel/runtime@^7.18.3", "@babel/runtime@^7.25.0":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/runtime/-/runtime-7.29.7.tgz#12022450c45a4da6d8d8287b18a4ff2ddb23f768"
   integrity sha512-Nq8OhGWiZIZGV6hLHoyAKLLcJihP/xFeBMGJoUrxTX2psI8dCifzLhZISFb+VWS3wFMRDmCGw5R+dOySCqPLhw==
@@ -1403,6 +1403,32 @@
   dependencies:
     "@sinonjs/commons" "^3.0.0"
 
+"@testing-library/dom@^10.0.0":
+  version "10.4.2"
+  resolved "https://registry.yarnpkg.com/@testing-library/dom/-/dom-10.4.2.tgz#e996827c4e5e1f13589527293b4b3958de2f709f"
+  integrity sha512-yzr2S9HyAIdhz2/6qHgbs665Q7PKVcDF05vsOlHPxG1mo36gKVesdYVeDLnXgfjJ03CrKRk08knc6+E/9m8v2Q==
+  dependencies:
+    "@babel/code-frame" "^7.10.4"
+    "@babel/runtime" "^7.12.5"
+    "@types/aria-query" "^5.0.1"
+    aria-query "5.3.0"
+    dom-accessibility-api "^0.5.9"
+    lz-string "^1.5.0"
+    picocolors "1.1.1"
+    pretty-format "^27.0.2"
+
+"@testing-library/react@^16.1.0":
+  version "16.3.3"
+  resolved "https://registry.yarnpkg.com/@testing-library/react/-/react-16.3.3.tgz#426907e7716f37038dab8aa69d8f0459f9ec24b2"
+  integrity sha512-Uo193NgQbPMz6lrrhtRQQFcMC6Re/ELLFbbuVL30WDlZxlpZf9/lMHTAVxPRLw1q1iu9OJmR1c2BLiENRstdBg==
+  dependencies:
+    "@babel/runtime" "^7.12.5"
+
+"@tootallnate/once@2":
+  version "2.0.1"
+  resolved "https://registry.yarnpkg.com/@tootallnate/once/-/once-2.0.1.tgz#35adc6222e3662fa2222ce123b961476a746b9ea"
+  integrity sha512-HqmEUIGRJ5fSXchkVgR5F7qn48bDBzv0kWj/Kfu5e6uci4UlEeng4331LnBkWffb++Ei3FOVLxo8JJWMFBDMeQ==
+
 "@tsconfig/node20@^20.1.4":
   version "20.1.4"
   resolved "https://registry.yarnpkg.com/@tsconfig/node20/-/node20-20.1.4.tgz#3457d42eddf12d3bde3976186ab0cd22b85df928"
@@ -1413,6 +1439,11 @@
   resolved "https://registry.yarnpkg.com/@types/argparse/-/argparse-1.0.38.tgz#a81fd8606d481f873a3800c6ebae4f1d768a56a9"
   integrity sha512-ebDJ9b0e702Yr7pWgB0jzm+CX4Srzz8RcXtLJDJB+BSccqMa36uyH/zUsSYao5+BD1ytv3k3rPYCq4mAE1hsXA==
 
+"@types/aria-query@^5.0.1":
+  version "5.0.4"
+  resolved "https://registry.yarnpkg.com/@types/aria-query/-/aria-query-5.0.4.tgz#1a31c3d378850d2778dabb6374d036dcba4ba708"
+  integrity sha512-rfT93uj5s0PRL7EzccGMs3brplhcrghnDoV26NqKhCAS1hVo+WdNsPvE/yb6ilfr5hi2MEk6d5EWJTKdxg8jVw==
+
 "@types/babel__core@^7.1.14":
   version "7.1.19"
   resolved "https://registry.yarnpkg.com/@types/babel__core/-/babel__core-7.1.19.tgz#7b497495b7d1b4812bdb9d02804d0576f43ee460"
@@ -1484,6 +1515,15 @@
   dependencies:
     "@types/istanbul-lib-report" "*"
 
+"@types/jsdom@^20.0.0":
+  version "20.0.1"
+  resolved "https://registry.yarnpkg.com/@types/jsdom/-/jsdom-20.0.1.tgz#07c14bc19bd2f918c1929541cdaacae894744808"
+  integrity sha512-d0r18sZPmMQr1eG35u12FZfhIXNrnsPU/g5wvRKCUf/tOGilKKwYMYGqh33BNR6ba+2gkHw1EUiHoN3mn7E5IQ==
+  dependencies:
+    "@types/node" "*"
+    "@types/tough-cookie" "*"
+    parse5 "^7.0.0"
+
 "@types/json5@^0.0.29":
   version "0.0.29"
   resolved "https://registry.yarnpkg.com/@types/json5/-/json5-0.0.29.tgz#ee28707ae94e11d2b827bcbe5270bcea7f3e71ee"
@@ -1501,6 +1541,11 @@
   resolved "https://registry.yarnpkg.com/@types/stack-utils/-/stack-utils-2.0.0.tgz#7036640b4e21cc2f259ae826ce843d277dad8cff"
   integrity sha512-RJJrrySY7A8havqpGObOB4W92QXKJo63/jFLLgpvOtsGUqbQZ9Sbgl35KMm1DjC6j7AvmmU2bIno+3IyEaemaw==
 
+"@types/tough-cookie@*":
+  version "4.0.5"
+  resolved "https://registry.yarnpkg.com/@types/tough-cookie/-/tough-cookie-4.0.5.tgz#cb6e2a691b70cb177c6e3ae9c1d2e8b2ea8cd304"
+  integrity sha512-/Ad8+nIOV7Rl++6f1BdKxFSMgmoqEoYbHRpPcx3JEfv8VRsQe9Z4mCXeJBzxs7mbHY/XOZZuXlRNfhpVPbs6ZA==
+
 "@types/ws@^7.4.7":
   version "7.4.7"
   resolved "https://registry.yarnpkg.com/@types/ws/-/ws-7.4.7.tgz#f7c390a36f7a0679aa69de2d501319f4f8d9b702"
@@ -1744,6 +1789,11 @@
   resolved "https://registry.yarnpkg.com/@ungap/structured-clone/-/structured-clone-1.2.0.tgz#756641adb587851b5ccb3e095daf27ae581c8406"
   integrity sha512-zuVdFrMJiuCDQUMCzQaD6KL28MjnqqN8XnAqiEq9PNm/hCPTSGfrXCOfwj1ow4LFb/
```

---

### Incident Patch 5: `c857f0f6` (2026-09-30)
**Commit Message**: Fix symbolication of stack traces with Windows absolute paths (#1939)

Summary:
`metro-symbolicate` parses stack frames with a regex that doesn't allow `:` in file names, so a frame with a Windows absolute path is misparsed at the drive letter:

```
someFunc@D:\app\foo.js:4:0
```

is read as function `D`, file `\app\foo.js`. The match starts at the drive letter, so `someFunc@` is left in the output, and the file name loses its drive - which matters for directory contexts (`symbolicate <dir>`), where the file name is used to find the source map.

This allows an optional `X:\` drive prefix on the function-name-or-file slot and the file slot. Posix paths, module IDs (`123.js`), Android (`bar:4:18063`, `bar:123.js:4:18063`) and `[native code]` frames parse exactly as before - the prefix requires a backslash, so e.g. a single-letter function before a posix path (`a:/js/foo.js:4:1`) is unaffected.

Changelog: [Fix] Fix `metro-symbolicate` stack trace parsing of Windows absolute paths

Test Plan:
Adds a platform-independent test that symbolicates `testfile.stack` with `C:\app\` prefixed file names, and expects the same output as the original. Without this change it fails on all platforms:

**File**: `packages/metro-symbolicate/src/Symbolication.js` (modified, +3/-1)
```diff
@@ -160,11 +160,13 @@ class SymbolicationContext<ModuleIdsT> {
   //  IOS: foo@123.js:4:18131, Android: bar:123.js:4:18063
   // sample stack trace without function name:
   //  123.js:4:18131
+  // sample stack trace with a Windows absolute path:
+  //  foo@C:\app\123.js:4:18131
   // sample result:
   //  IOS: foo.js:57:foo, Android: bar.js:75:bar
   symbolicate(stackTrace: string): string {
     return stackTrace.replace(
-      /(?:([^@: \n(]+)(@|:))?(?:(?:([^@: \n(]+):)?(\d+):(\d+)|\[native code\](?::\d+:\d+)?)/g,
+      /(?:((?:[A-Za-z]:\\)?[^@: \n(]+)(@|:))?(?:(?:((?:[A-Za-z]:\\)?[^@: \n(]+):)?(\d+):(\d+)|\[native code\](?::\d+:\d+)?)/g,
       (match, func, delimiter, fileName, line, column) => {
         if (delimiter === ':' && func && !fileName) {
           fileName = func;
```

**File**: `packages/metro-symbolicate/src/__tests__/symbolicate-test.js` (modified, +12/-0)
```diff
@@ -210,6 +210,18 @@ test('symbolicating a stack trace', async () =>
     execute([TESTFILE_MAP], read('testfile.stack')),
   ).resolves.toMatchSnapshot());
 
+test('symbolicating a stack trace with Windows absolute paths', async () => {
+  const stack = read('testfile.stack');
+  const windowsStack = stack.replaceAll(
+    /(^|@)(thrower\.min\.js)/gm,
+    '$1C:\\app\\$2',
+  );
+  expect(windowsStack).not.toEqual(stack);
+  expect(await execute([TESTFILE_MAP], windowsStack)).toEqual(
+    await execute([TESTFILE_MAP], stack),
+  );
+});
+
 test('symbolicating a stack trace in Node format', async () =>
   await expect(
     execute([TESTFILE_MAP], read('testfile.node.stack')),
```

**File**: `scripts/jestFilter.js` (modified, +0/-4)
```diff
@@ -15,10 +15,6 @@ const SKIPPED_ON_WINDOWS = [
   // flow-api-translator emits os.EOL line endings in generated comments.
   // Snapshots are generated and verified on posix only.
   'scripts/__tests__/api-snapshots-sync-test.js',
-
-  // TODO: Windows product bugs
-  // Stack trace parsing does not support drive letters
-  'packages/metro-symbolicate/src/__tests__/symbolicate-test.js',
 ];
 
 const SKIPPED_PATHS = process.platform === 'win32' ? SKIPPED_ON_WINDOWS : [];
```

---

### Incident Patch 6: `d52ee797` (2026-09-29)
**Commit Message**: Fix backslashes in async bundle paths on Windows (#1938)

Summary:
With `includeAsyncPaths`, Metro writes a server-relative URL for each async dependency into the `paths` argument of `__d(...)`, which the client uses to fetch the split bundle. `getDefaultAsyncDependencyPath` builds that URL with `path.relative` and `path.join`, and never converts separators, so on Windows a dependency at `C:\root\src\bar.js` under server root `C:\root` produces:

```
/src\bar.bundle?modulesOnly=true&runModule=false
```

This is a URL, and Metro's own parsing of bundle URLs treats the pathname as posix (`split('/')` in `parseBundleOptionsFromBundleRequestUrl`), so it should be `/src/bar.bundle?...` on every platform. This passes the joined path through `normalizePathSeparatorsToPosix`, already used in the same file for module debug names. No change on posix.

Changelog: [Fix] Fix backslashes in async bundle paths on Windows (`includeAsyncPaths`)

Test Plan:
Removes `js-test.js` from the Windows skip list. Its three async `paths` tests already assert forward-slash URLs from Windows-style inputs.

Before this change, on Windows CI:

```
  ✕ includes the paths of async dependencies when requested
  - "

**File**: `packages/metro/src/DeltaBundler/Serializers/helpers/js.js` (modified, +7/-5)
```diff
@@ -108,11 +108,13 @@ function getDefaultAsyncDependencyPath(
   const bundlePath = path.relative(options.serverRoot, dependency.absolutePath);
   return (
     '/' +
-    path.join(
-      // TODO: This is not the proper Metro URL encoding of a file path
-      path.dirname(bundlePath),
-      // Strip the file extension
-      path.basename(bundlePath, path.extname(bundlePath)),
+    normalizePathSeparatorsToPosix(
+      path.join(
+        // TODO: This is not the proper Metro URL encoding of a file path
+        path.dirname(bundlePath),
+        // Strip the file extension
+        path.basename(bundlePath, path.extname(bundlePath)),
+      ),
     ) +
     '.bundle?' +
     searchParams.toString()
```

**File**: `scripts/jestFilter.js` (modified, +0/-2)
```diff
@@ -17,8 +17,6 @@ const SKIPPED_ON_WINDOWS = [
   'scripts/__tests__/api-snapshots-sync-test.js',
 
   // TODO: Windows product bugs
-  // Async bundle paths are built with platform path separators
-  'packages/metro/src/DeltaBundler/Serializers/helpers/__tests__/js-test.js',
   // Stack trace parsing does not support drive letters
   'packages/metro-symbolicate/src/__tests__/symbolicate-test.js',
 ];
```

---

### Incident Patch 7: `13604e02` (2026-09-29)
**Commit Message**: Fix Windows-incompatible Jest tests (#1937)

Summary:
`scripts/jestFilter.js` skipped 30 test suites on Windows. Most were failing because of posix assumptions in the tests themselves, not Metro. This fixes those tests and removes them from the skip list, so they run in Windows CI.

The fixes remove posix assumptions without weakening what's asserted:
- Filesystem paths in inputs and expectations are written as posix and made portable with the existing `p()` helpers (`posixToSystemPath`, `createPathNormalizer`), so tests use realistic `C:\...` paths on Windows.
- Client-facing values - URLs, `httpServerLocation`, `sourceURL`s, specifiers, package.json keys - stay asserted with forward slashes on every platform.
- Suites parameterised over `posix`/`win32` now mock `node:path` with `path.posix` for the posix half, rather than the host's `path`, which on Windows is `path.win32`.
- `metro-resolver`'s `getPackageForModule` test helper looped forever on Windows (`path.win32.parse('/root').root` is `/` but `dirname` returns `\`), hanging three suites.
- Some inline and file snapshots embedding absolute paths are replaced by exact assertions built with `p()`.

Still skipped on Windows:
- `

**File**: `packages/buck-worker-tool/src/__tests__/worker-test.js` (modified, +3/-2)
```diff
@@ -111,13 +111,14 @@ describe('Buck worker:', () => {
       writeFiles(files, '/');
     }
 
+    // The mocked fs is a posix memory fs on every platform.
     function writeFiles(files, dirPath) {
       for (const key in files) {
         const entry = files[key];
         if (entry == null || typeof entry === 'string') {
-          fs.writeFileSync(path.join(dirPath, key), entry || '');
+          fs.writeFileSync(path.posix.join(dirPath, key), entry || '');
         } else {
-          const subDirPath = path.join(dirPath, key);
+          const subDirPath = path.posix.join(dirPath, key);
           fs.mkdirSync(subDirPath, {recursive: true});
           writeFiles(entry, subDirPath);
         }
```

**File**: `packages/metro-file-map/src/__tests__/index-test.js` (modified, +176/-294)
```diff
@@ -38,6 +38,20 @@ import {serialize} from 'node:v8';
 
 jest.useRealTimers();
 
+// Convenience function to write paths with posix separators but convert them
+// to system separators
+const p = (filePath: string): string =>
+  process.platform === 'win32'
+    ? filePath.replace(/\//g, '\\').replace(/^\\/, 'C:\\')
+    : filePath;
+
+// The inverse of `p` for messages containing system paths, for portable
+// snapshots
+const toPosixMessage = (message: string): string =>
+  process.platform === 'win32'
+    ? message.replaceAll('C:\\', '/').replaceAll('\\', '/')
+    : message;
+
 function mockHashContents(contents: string | Buffer) {
   return crypto.createHash('sha1').update(contents).digest('hex');
 }
@@ -291,26 +305,26 @@ describe('FileMap', () => {
 
     mockEmitters = Object.create(null);
     mockFs = object({
-      [path.join('/', 'project', 'fruits', 'Banana.js')]: `
+      [p('/project/fruits/Banana.js')]: `
         const Strawberry = require("Strawberry");
       `,
-      [path.join('/', 'project', 'fruits', 'Pear.js')]: `
+      [p('/project/fruits/Pear.js')]: `
         const Banana = require("Banana");
         const Strawberry = require("Strawberry");
       `,
-      [path.join('/', 'project', 'fruits', 'Strawberry.js')]: `
+      [p('/project/fruits/Strawberry.js')]: `
         // Strawberry!
       `,
-      [path.join('/', 'project', 'fruits', '__mocks__', 'Pear.js')]: `
+      [p('/project/fruits/__mocks__/Pear.js')]: `
         const Melon = require("Melon");
       `,
-      [path.join('/', 'project', 'vegetables', 'Melon.js')]: `
+      [p('/project/vegetables/Melon.js')]: `
         // Melon!
       `,
-      [path.join('/', 'project', 'video', 'video.mp4')]: Buffer.from([
+      [p('/project/video/video.mp4')]: Buffer.from([
         0xfa, 0xce, 0xb0, 0x0c,
       ]).toString(),
-      [path.join('/', 'project', 'fruits', 'LinkToStrawberry.js')]: {
+      [p('/project/fruits/LinkToStrawberry.js')]: {
         link: 'Strawberry.js',
       },
     });
@@ -363,11 +377,8 @@ describe('FileMap', () => {
       maxWorkers: 1,
       resetCache: false,
       retainAllFiles: false,
-      rootDir: path.join('/', 'project'),
-      roots: [
-        path.join('/', 'project', 'fruits'),
-        path.join('/', 'project', 'vegetables'),
-      ],
+      rootDir: p('/project'),
+      roots: [p('/project/fruits'), p('/project/vegetables')],
       useWatchman: true,
       cacheManagerFactory: () => mockCacheManager,
     };
@@ -435,26 +446,26 @@ describe('FileMap', () => {
   });
 
   test('ignores files given a pattern', async () => {
-    mockFs[path.join('/', 'project', 'fruits', 'Kiwi.js')] = `
+    mockFs[p('/project/fruits/Kiwi.js')] = `
       // Kiwi!
     `;
     const {fileSystem} = await buildNewFileMap({ignorePattern: /Kiwi/});
     expect([...fileSystem.matchFiles({filter: /Kiwi/})]).toEqual([]);
   });
 
   test('ignores vcs directories without ignore pattern', async () => {
-    mockFs[path.join('/', 'project', 'fruits', '.git', 'fruit-history.js')] = `
+    mockFs[p('/project/fruits/.git/fruit-history.js')] = `
       // test
     `;
     const {fileSystem} = await buildNewFileMap();
     expect([...fileSystem.matchFiles({filter: /\.git/})]).toEqual([]);
   });
 
   test('ignores vcs directories with ignore pattern regex', async () => {
-    mockFs[path.join('/', 'project', 'fruits', 'Kiwi.js')] = `
+    mockFs[p('/project/fruits/Kiwi.js')] = `
       // Kiwi!
     `;
-    mockFs[path.join('/', 'project', 'fruits', '.git', 'fruit-history.js')] = `
+    mockFs[p('/project/fruits/.git/fruit-history.js')] = `
       // test
     `;
     const {fileSystem} = await buildNewFileMap({ignorePattern: /Kiwi/});
@@ -463,7 +474,7 @@ describe('FileMap', () => {
   });
 
   test('throw on ignore pattern except for regex', async () => {
-    mockFs['/project/fruits/Kiwi.js'] = `
+    mockFs[p('/project/fruits/Kiwi.js')] = `
       // Kiwi!
     `;
 
@@ -479,79 +490,35 @@ describe('FileMap', () => {
 
   test('builds a haste map on a fresh cache', async () => {
     // Include these files in the map
-    mockFs[
-      path.join('/', 'project', 'fruits', 'node_modules', 'react', 'React.js')
-    ] = `
+    mockFs[p('/project/fruits/node_modules/react/React.js')] = `
       const Component = require("Component");
     `;
-    mockFs[
-      path.join(
-        '/',
-        'project',
-        'fruits',
-        'node_modules',
-        'fbjs',
-        'lib',
-        'flatMap.js',
-      )
-    ] = `
+    mockFs[p('/project/fruits/node_modules/fbjs/lib/flatMap.js')] = `
       // flatMap
     `;
 
     // Ignore these
     mockFs[
-      path.join(
-        '/',
-        'project',
-        'fruits',
-        'node_modules',
-        'react',
-        'node_modules',
-        'fbjs',
-        'lib',
-        'mapObject.js',
-      )
+      p('/project/fruits/node_modules/react/node_modules/fbjs/lib/mapObject.js')
     ] = `
       // mapObject
     `;
     mockFs[
-      path.join(
-  
```

**File**: `packages/metro-file-map/src/crawlers/__tests__/node-test.js` (modified, +73/-57)
```diff
@@ -8,7 +8,13 @@
  * @oncall react_native
  */
 
-import TreeFS from '../../lib/TreeFS';
+import type TreeFSType from '../../lib/TreeFS';
+
+let mockPathModule;
+jest.mock('node:path', () => mockPathModule);
+
+// The platform-specific path helper `p` for the graceful-fs mock
+let mockP: string => string;
 
 jest.useRealTimers();
 
@@ -49,7 +55,7 @@ jest.mock('graceful-fs', () => {
         throw new Error('readdir: callback is not a function!');
       }
 
-      if (slash(dir) === '/project/fruits') {
+      if (dir === mockP('/project/fruits')) {
         setTimeout(
           () =>
             callback(null, [
@@ -71,7 +77,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) === '/project/fruits/directory') {
+      } else if (dir === mockP('/project/fruits/directory')) {
         setTimeout(
           () =>
             callback(null, [
@@ -83,7 +89,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) === '/project/prototype') {
+      } else if (dir === mockP('/project/prototype')) {
         setTimeout(
           () =>
             callback(
@@ -102,7 +108,7 @@ jest.mock('graceful-fs', () => {
             ),
           0,
         );
-      } else if (slash(dir) === '/project') {
+      } else if (dir === mockP('/project')) {
         setTimeout(
           () =>
             callback(null, [
@@ -114,7 +120,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) === '/') {
+      } else if (dir === mockP('/')) {
         setTimeout(
           () =>
             callback(null, [
@@ -126,7 +132,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) == '/error') {
+      } else if (dir === mockP('/error')) {
         setTimeout(() => callback({code: 'ENOTDIR'}, undefined), 0);
       }
     }),
@@ -135,19 +141,30 @@ jest.mock('graceful-fs', () => {
 });
 
 const pearMatcher = path => /pear/.test(path);
-const normalize = path =>
-  process.platform === 'win32' ? path.replace(/\//g, '\\') : path;
-const createMap = obj =>
-  new Map(Object.keys(obj).map(key => [normalize(key), obj[key]]));
 
-const rootDir = '/project';
-const emptyFS = new TreeFS({rootDir, files: new Map()});
-const getFS = (files: FileData) => new TreeFS({rootDir, files});
-let nodeCrawl;
+describe.each([['win32'], ['posix']])('node crawler on %s', platform => {
+  // Convenience function to write paths with posix separators but convert them
+  // to system separators
+  const p: string => string = filePath =>
+    platform === 'win32'
+      ? filePath.replace(/\//g, '\\').replace(/^\\/, 'C:\\')
+      : filePath;
+  const createMap = obj =>
+    new Map(Object.keys(obj).map(key => [p(key), obj[key]]));
+
+  const rootDir = p('/project');
+  let TreeFS: Class<TreeFSType>;
+  let emptyFS: TreeFSType;
+  let getFS: (files: FileData) => TreeFSType;
+  let nodeCrawl;
 
-describe('node crawler', () => {
   beforeEach(() => {
     jest.resetModules();
+    mockPathModule = jest.requireActual<{}>('path')[platform];
+    mockP = p;
+    TreeFS = require('../../lib/TreeFS').default;
+    emptyFS = new TreeFS({rootDir, files: new Map()});
+    getFS = files => new TreeFS({rootDir, files});
   });
 
   test('updates only changed files', async () => {
@@ -167,7 +184,7 @@ describe('node crawler', () => {
       extensions: ['js'],
       ignore: pearMatcher,
       rootDir,
-      roots: ['/project/fruits'],
+      roots: [p('/project/fruits')],
     });
 
     // Tomato is not included because its mtime is unchanged
@@ -197,11 +214,11 @@ describe('node crawler', () => {
       extensions: ['js'],
       ignore: pearMatcher,
       rootDir,
-      roots: ['/project/fruits'],
+      roots: [p('/project/fruits')],
     });
 
     expect(changedFiles).toEqual(new Map());
-    expect(removedFiles).toEqual(new Set(['fruits/previouslyExisted.js']));
+    expect(removedFiles).toEqual(new Set([p('fruits/previouslyExisted.js')]));
   });
 
   test('completes with empty roots', async () => {
@@ -234,11 +251,13 @@ describe('node crawler', () => {
       extensions: ['js'],
       ignore: pearMatcher,
       rootDir,
-      roots: ['/error'],
+      roots: [p('/error')],
     });
 
     expect(mockConsole.warn).toHaveBeenCalledWith(
-      expect.stringContaining('Error "ENOTDIR" reading contents of "/error"'),
+      expect.stringContaining(
+        `Error "ENOTDIR" reading contents of "${p('/error')}"`,
+      ),
     );
     expect(changedFiles).toEqual(new Map());
     expect(removedFiles).toEqual(new Set());
@@ -254,7 +273,7 @@ describe('node crawler', () => {
       extensions: ['js'],
       ignore: pearMatcher,
       rootDir,
-      roots: ['/project/fruits'],
+      roots: [p('/project/fruits')],
     });
 
     expect(changedFiles).toEqual(
@@ -281,7 +300,7 @@ describe('node crawler', () => {
         extensions: ['js', 'j
```

**File**: `packages/metro-resolver/src/__tests__/__snapshots__/index-test.js.snap` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-// Jest Snapshot v1, https://goo.gl/fbAQLP
-
-exports[`throws on invalid package name 1`] = `
-"The package \`/root/node_modules/invalid/package.json\` is invalid because it specifies a \`main\` module field that could not be resolved (\`/root/node_modules/invalid/main\`. None of these files exist:
-
-  * /root/node_modules/invalid/main(.js|.jsx|.json|.ts|.tsx)
-  * /root/node_modules/invalid/main/index(.js|.jsx|.json|.ts|.tsx)"
-`;
```

**File**: `packages/metro-resolver/src/__tests__/assets-test.js` (modified, +11/-11)
```diff
@@ -10,19 +10,19 @@
  */
 
 import * as Resolver from '../index';
-import {createResolutionContext} from './utils';
+import {createResolutionContext, posixToSystemPath as p} from './utils';
 import path from 'node:path';
 
 describe('asset resolutions', () => {
   const baseContext = {
     ...createResolutionContext({
-      '/root/project/index.js': '',
-      '/root/project/src/data.json': '',
-      '/root/project/assets/example.asset.json': '',
-      '/root/project/assets/icon.png': '',
-      '/root/project/assets/icon@2x.png': '',
+      [p('/root/project/index.js')]: '',
+      [p('/root/project/src/data.json')]: '',
+      [p('/root/project/assets/example.asset.json')]: '',
+      [p('/root/project/assets/icon.png')]: '',
+      [p('/root/project/assets/icon@2x.png')]: '',
     }),
-    originModulePath: '/root/project/index.js',
+    originModulePath: p('/root/project/index.js'),
   };
   const assetResolutions = ['1', '2'];
   const resolveAsset = (
@@ -53,8 +53,8 @@ describe('asset resolutions', () => {
     expect(Resolver.resolve(context, './assets/icon.png', null)).toEqual({
       type: 'assetFiles',
       filePaths: [
-        '/root/project/assets/icon.png',
-        '/root/project/assets/icon@2x.png',
+        p('/root/project/assets/icon.png'),
+        p('/root/project/assets/icon@2x.png'),
       ],
     });
   });
@@ -70,15 +70,15 @@ describe('asset resolutions', () => {
     // Source file matching `sourceExts`
     expect(Resolver.resolve(context, './src/data.json', null)).toEqual({
       type: 'sourceFile',
-      filePath: '/root/project/src/data.json',
+      filePath: p('/root/project/src/data.json'),
     });
 
     // Asset file matching more specific asset ext
     expect(
       Resolver.resolve(context, './assets/example.asset.json', null),
     ).toEqual({
       type: 'assetFiles',
-      filePaths: ['/root/project/assets/example.asset.json'],
+      filePaths: [p('/root/project/assets/example.asset.json')],
     });
   });
 });
```

**File**: `packages/metro-resolver/src/__tests__/browser-spec-test.js` (modified, +30/-23)
```diff
@@ -10,7 +10,11 @@
  */
 
 import * as Resolver from '../index';
-import {createPackageAccessors, createResolutionContext} from './utils';
+import {
+  createPackageAccessors,
+  createResolutionContext,
+  posixToSystemPath as p,
+} from './utils';
 
 describe('browser field spec', () => {
   describe('alternate main fields', () => {
@@ -22,13 +26,14 @@ describe('browser field spec', () => {
     };
     const baseContext = {
       ...createResolutionContext({
-        '/root/src/main.js': '',
-        '/root/node_modules/test-pkg/package.json': JSON.stringify(packageJson),
-        '/root/node_modules/test-pkg/index.js': '',
-        '/root/node_modules/test-pkg/index-browser.js': '',
-        '/root/node_modules/test-pkg/index-react-native.js': '',
+        [p('/root/src/main.js')]: '',
+        [p('/root/node_modules/test-pkg/package.json')]:
+          JSON.stringify(packageJson),
+        [p('/root/node_modules/test-pkg/index.js')]: '',
+        [p('/root/node_modules/test-pkg/index-browser.js')]: '',
+        [p('/root/node_modules/test-pkg/index-react-native.js')]: '',
       }),
-      originModulePath: '/root/src/main.js',
+      originModulePath: p('/root/src/main.js'),
     };
 
     test('should resolve package entry point using passed `mainFields` in order', () => {
@@ -43,7 +48,7 @@ describe('browser field spec', () => {
         ),
       ).toEqual({
         type: 'sourceFile',
-        filePath: '/root/node_modules/test-pkg/index-browser.js',
+        filePath: p('/root/node_modules/test-pkg/index-browser.js'),
       });
 
       expect(
@@ -57,15 +62,15 @@ describe('browser field spec', () => {
         ),
       ).toEqual({
         type: 'sourceFile',
-        filePath: '/root/node_modules/test-pkg/index-react-native.js',
+        filePath: p('/root/node_modules/test-pkg/index-react-native.js'),
       });
 
       expect(
         Resolver.resolve(
           {
             ...baseContext,
             ...createPackageAccessors({
-              '/root/node_modules/test-pkg/package.json': {
+              [p('/root/node_modules/test-pkg/package.json')]: {
                 name: 'test-pkg',
                 main: 'index.js',
               },
@@ -77,15 +82,15 @@ describe('browser field spec', () => {
         ),
       ).toEqual({
         type: 'sourceFile',
-        filePath: '/root/node_modules/test-pkg/index.js',
+        filePath: p('/root/node_modules/test-pkg/index.js'),
       });
     });
 
     test('should resolve .js and .json file extensions implicitly', () => {
       const context = {
         ...baseContext,
         ...createPackageAccessors({
-          '/root/node_modules/test-pkg/package.json': {
+          [p('/root/node_modules/test-pkg/package.json')]: {
             ...packageJson,
             browser: 'index-browser',
           },
@@ -95,7 +100,7 @@ describe('browser field spec', () => {
 
       expect(Resolver.resolve(context, 'test-pkg', null)).toEqual({
         type: 'sourceFile',
-        filePath: '/root/node_modules/test-pkg/index-browser.js',
+        filePath: p('/root/node_modules/test-pkg/index-browser.js'),
       });
     });
   });
@@ -115,18 +120,20 @@ describe('browser field spec', () => {
       };
       const context = {
         ...createResolutionContext({
-          '/root/node_modules/origin-pkg/package.json':
+          [p('/root/node_modules/origin-pkg/package.json')]:
             JSON.stringify(packageJson),
-          '/root/node_modules/origin-pkg/lib/nested/index.js': '',
-          '/root/node_modules/origin-pkg/shims/foo.js': '',
+          [p('/root/node_modules/origin-pkg/lib/nested/index.js')]: '',
+          [p('/root/node_modules/origin-pkg/shims/foo.js')]: '',
         }),
-        originModulePath: '/root/node_modules/origin-pkg/lib/nested/index.js',
+        originModulePath: p(
+          '/root/node_modules/origin-pkg/lib/nested/index.js',
+        ),
         mainFields: ['browser', 'main'],
       };
 
       expect(Resolver.resolve(context, 'foo-pkg', null)).toEqual({
         type: 'sourceFile',
-        filePath: '/root/node_modules/origin-pkg/shims/foo.js',
+        filePath: p('/root/node_modules/origin-pkg/shims/foo.js'),
       });
     });
 
@@ -136,23 +143,23 @@ describe('browser field spec', () => {
       // misbehave. The redirect must resolve against the package root.
       const context = {
         ...createResolutionContext({
-          '/root/project/package.json': JSON.stringify({
+          [p('/root/project/package.json')]: JSON.stringify({
             name: 'project',
             main: 'src/index.js',
             browser: {
               'foo-pkg': './shims/foo.js',
             },
           }),
-          '/root/project/src/index.js': '',
-          '/root/project/shims/foo.js': '',
+          [p('/root/project/src/index.js')]: '',
+          [p('/root/project/shims/foo.js')]: '',
         }),
-        originModulePath: '/root/project/src/index.js',
+        originModulePath: p('/root/pr
```

**File**: `packages/metro-resolver/src/__tests__/index-test.js` (modified, +176/-177)
```diff
@@ -13,69 +13,70 @@
 
 import type {ResolutionContext} from '../index';
 
-import {createResolutionContext} from './utils';
+import {createResolutionContext, posixToSystemPath as p} from './utils';
 
 const Resolver = require('../index');
 
 const fileMap = {
-  '/root/project/foo.js': '',
-  '/root/project/foo/index.js': '',
-  '/root/project/bar.js': '',
-  '/root/smth/beep.js': '',
-  '/root/node_modules/apple/package.json': JSON.stringify({
+  [p('/root/project/foo.js')]: '',
+  [p('/root/project/foo/index.js')]: '',
+  [p('/root/project/bar.js')]: '',
+  [p('/root/smth/beep.js')]: '',
+  [p('/root/node_modules/apple/package.json')]: JSON.stringify({
     name: 'apple',
     main: 'main',
   }),
-  '/root/node_modules/apple/main.js': '',
-  '/root/node_modules/invalid/package.json': JSON.stringify({
+  [p('/root/node_modules/apple/main.js')]: '',
+  [p('/root/node_modules/invalid/package.json')]: JSON.stringify({
     name: 'invalid',
     main: 'main',
   }),
-  '/root/node_modules/flat-file-in-node-modules.js': '',
-  '/node_modules/root-module/main.js': '',
-  '/node_modules/root-module/package.json': JSON.stringify({
+  [p('/root/node_modules/flat-file-in-node-modules.js')]: '',
+  [p('/node_modules/root-module/main.js')]: '',
+  [p('/node_modules/root-module/package.json')]: JSON.stringify({
     name: 'root-module',
     main: 'main',
   }),
-  '/other-root/node_modules/banana-module/main.js': '',
-  '/other-root/node_modules/banana-module/package.json': JSON.stringify({
+  [p('/other-root/node_modules/banana-module/main.js')]: '',
+  [p('/other-root/node_modules/banana-module/package.json')]: JSON.stringify({
     name: 'banana-module',
     main: 'main',
   }),
-  '/other-root/node_modules/banana/main.js': '',
-  '/other-root/node_modules/banana/package.json': JSON.stringify({
+  [p('/other-root/node_modules/banana/main.js')]: '',
+  [p('/other-root/node_modules/banana/package.json')]: JSON.stringify({
     name: 'banana',
     main: 'main',
   }),
-  '/other-root/node_modules/banana/node_modules/banana-module/main.js': '',
-  '/other-root/node_modules/banana/node_modules/banana-module/package.json':
-    JSON.stringify({
-      name: 'banana-module',
-      main: 'main',
-    }),
-  '/haste/Foo.js': '',
-  '/haste/Bar.js': '',
-  '/haste/Override.js': '',
-  '/haste/some-package/package.json': JSON.stringify({
+  [p('/other-root/node_modules/banana/node_modules/banana-module/main.js')]: '',
+  [p(
+    '/other-root/node_modules/banana/node_modules/banana-module/package.json',
+  )]: JSON.stringify({
+    name: 'banana-module',
+    main: 'main',
+  }),
+  [p('/haste/Foo.js')]: '',
+  [p('/haste/Bar.js')]: '',
+  [p('/haste/Override.js')]: '',
+  [p('/haste/some-package/package.json')]: JSON.stringify({
     name: 'some-package',
     main: 'main',
   }),
-  '/haste/some-package/subdir/other-file.js': '',
-  '/haste/some-package/main.js': '',
+  [p('/haste/some-package/subdir/other-file.js')]: '',
+  [p('/haste/some-package/main.js')]: '',
 };
 
 const CONTEXT: ResolutionContext = {
   ...createResolutionContext(fileMap),
-  originModulePath: '/root/project/foo.js',
+  originModulePath: p('/root/project/foo.js'),
   resolveHasteModule: (name: string) => {
-    const candidate = '/haste/' + name + '.js';
+    const candidate = p(`/haste/${name}.js`);
     if (candidate in fileMap) {
       return candidate;
     }
     return null;
   },
   resolveHastePackage: (name: string) => {
-    const candidate = '/haste/' + name + '/package.json';
+    const candidate = p(`/haste/${name}/package.json`);
     if (candidate in fileMap) {
       return candidate;
     }
@@ -86,21 +87,21 @@ const CONTEXT: ResolutionContext = {
 test('resolves a relative path', () => {
   expect(Resolver.resolve(CONTEXT, './bar', null)).toEqual({
     type: 'sourceFile',
-    filePath: '/root/project/bar.js',
+    filePath: p('/root/project/bar.js'),
   });
 });
 
 test('resolves a relative path ending in a slash as a directory', () => {
   expect(Resolver.resolve(CONTEXT, './foo/', null)).toEqual({
     type: 'sourceFile',
-    filePath: '/root/project/foo/index.js',
+    filePath: p('/root/project/foo/index.js'),
   });
 });
 
 test('resolves a relative path in another folder', () => {
   expect(Resolver.resolve(CONTEXT, '../smth/beep', null)).toEqual({
     type: 'sourceFile',
-    filePath: '/root/smth/beep.js',
+    filePath: p('/root/smth/beep.js'),
   });
 });
 
@@ -110,7 +111,7 @@ test('does not resolve a relative path ending in a slash as a file', () => {
       file: null,
       dir: {
         type: 'sourceFile',
-        filePathPrefix: '/root/project/bar/',
+        filePathPrefix: p('/root/project/bar/'),
         candidateExts: [],
       },
     }),
@@ -120,14 +121,14 @@ test('does not resolve a relative path ending in a slash as a file', () => {
 test('resolves a package in `node_modules`', () => {
   expect(Resolver.resolve(CONTEXT, 'apple', null)).toEqual({
     type: 'sourceFile',
-    filePath: '/root/nod
```

**File**: `packages/metro-resolver/src/__tests__/package-exports-test.js` (modified, +280/-269)
```diff
@@ -10,7 +10,11 @@
  */
 
 import * as Resolver from '../index';
-import {createPackageAccessors, createResolutionContext} from './utils';
+import {
+  createPackageAccessors,
+  createResolutionContext,
+  posixToSystemPath as p,
+} from './utils';
 import path from 'node:path';
 
 // Tests validating Package Exports resolution behaviour. See RFC0534:
@@ -24,46 +28,46 @@ describe('with package exports resolution disabled', () => {
   test('should ignore "exports" field for main entry point', () => {
     const context = {
       ...createResolutionContext({
-        '/root/src/main.js': '',
-        '/root/node_modules/test-pkg/package.json': JSON.stringify({
+        [p('/root/src/main.js')]: '',
+        [p('/root/node_modules/test-pkg/package.json')]: JSON.stringify({
           main: 'index.js',
           exports: './index-exports.js',
         }),
-        '/root/node_modules/test-pkg/index.js': '',
-        '/root/node_modules/test-pkg/index-exports.js': '',
+        [p('/root/node_modules/test-pkg/index.js')]: '',
+        [p('/root/node_modules/test-pkg/index-exports.js')]: '',
       }),
-      originModulePath: '/root/src/main.js',
+      originModulePath: p('/root/src/main.js'),
       unstable_enablePackageExports: false,
     };
 
     expect(Resolver.resolve(context, 'test-pkg', null)).toEqual({
       type: 'sourceFile',
-      filePath: '/root/node_modules/test-pkg/index.js',
+      filePath: p('/root/node_modules/test-pkg/index.js'),
     });
   });
 
   test('should ignore "exports" field for subpaths', () => {
     const context = {
       ...createResolutionContext({
-        '/root/src/main.js': '',
-        '/root/node_modules/test-pkg/package.json': JSON.stringify({
+        [p('/root/src/main.js')]: '',
+        [p('/root/node_modules/test-pkg/package.json')]: JSON.stringify({
           main: 'index.js',
           exports: {
             './foo.js': './lib/foo.js',
           },
         }),
-        '/root/node_modules/test-pkg/index.js': '',
-        '/root/node_modules/test-pkg/foo.js': '',
-        '/root/node_modules/test-pkg/foo.ios.js': '',
-        '/root/node_modules/test-pkg/lib/foo.js': '',
+        [p('/root/node_modules/test-pkg/index.js')]: '',
+        [p('/root/node_modules/test-pkg/foo.js')]: '',
+        [p('/root/node_modules/test-pkg/foo.ios.js')]: '',
+        [p('/root/node_modules/test-pkg/lib/foo.js')]: '',
       }),
-      originModulePath: '/root/src/main.js',
+      originModulePath: p('/root/src/main.js'),
       unstable_enablePackageExports: false,
     };
 
     expect(Resolver.resolve(context, 'test-pkg/foo.js', null)).toEqual({
       type: 'sourceFile',
-      filePath: '/root/node_modules/test-pkg/foo.js',
+      filePath: p('/root/node_modules/test-pkg/foo.js'),
     });
 
     const logWarning = jest.fn();
@@ -76,31 +80,31 @@ describe('with package exports resolution disabled', () => {
       ),
     ).toEqual({
       type: 'sourceFile',
-      filePath: '/root/node_modules/test-pkg/foo.ios.js',
+      filePath: p('/root/node_modules/test-pkg/foo.ios.js'),
     });
     expect(logWarning).not.toHaveBeenCalled();
   });
 
   test('should ignore invalid "exports" field', () => {
     const context = {
       ...createResolutionContext({
-        '/root/src/main.js': '',
-        '/root/node_modules/test-pkg/package.json': JSON.stringify({
+        [p('/root/src/main.js')]: '',
+        [p('/root/node_modules/test-pkg/package.json')]: JSON.stringify({
           main: 'index.js',
           exports: {
             '.': './index-exports.js',
             browser: './index.js',
           },
         }),
-        '/root/node_modules/test-pkg/index.js': '',
+        [p('/root/node_modules/test-pkg/index.js')]: '',
       }),
-      originModulePath: '/root/src/main.js',
+      originModulePath: p('/root/src/main.js'),
       unstable_enablePackageExports: false,
     };
 
     expect(Resolver.resolve(context, 'test-pkg', null)).toEqual({
       type: 'sourceFile',
-      filePath: '/root/node_modules/test-pkg/index.js',
+      filePath: p('/root/node_modules/test-pkg/index.js'),
     });
   });
 });
@@ -109,25 +113,25 @@ describe('with package exports resolution enabled', () => {
   describe('main entry point', () => {
     const baseContext = {
       ...createResolutionContext({
-        '/root/src/main.js': '',
-        '/root/node_modules/test-pkg/package.json': '',
-        '/root/node_modules/test-pkg/index.js': '',
-        '/root/node_modules/test-pkg/index-main.js': '',
-        '/root/node_modules/test-pkg/index-exports.js.js': '',
-        '/root/node_modules/test-pkg/index-exports.ios.js': '',
-        '/root/node_modules/test-pkg/symlink.js': {
-          realPath: '/root/node_modules/test-pkg/symlink-target.js',
+        [p('/root/src/main.js')]: '',
+        [p('/root/node_modules/test-pkg/package.json')]: '',
+        [p('/root/node_modules/test-pkg/index.js')]: '',
+        [p('/root/node_modules/test-pkg/index-main.js')]: '',
+  
```

---

### Incident Patch 8: `5d6eaeab` (2026-09-29)
**Commit Message**: fix: skip errors that occurred on virtual lines (#1226)

* skip errors that occurred on virtual lines

* Update ModuleResolution.js

* Add regression test for resolution errors past the end of the source

This fix has had no test since the PR was opened, which is what the review asked for in 2024. Adds one at the integration level, in `build-errors-test.js`, so it exercises the real transform and resolution path rather than constructing the error directly.

`injectImportPastEndOfFileTransformer.js` wraps `@react-native/metro-babel-transformer` and, for one fixture, appends `import './does-not-exist';` parsed with `startLine` one line past the end of the source — which is what a plugin that generates and appends code does. The dependency Metro collects then reports a location with no counterpart in the file on disk, so building the code frame for the resolution error walks off the end of `lines`.

Without the guard, the build rejects with `TypeError: Cannot read properties of undefined (reading 'length')` in place of the resolution error. With it, the error survives and the code frame degrades to the lines that do exist.

The assertion is deliberately not a snapshot: the resolver's 

**File**: `packages/metro/src/integration_tests/__tests__/build-errors-test.js` (modified, +33/-0)
```diff
@@ -113,6 +113,39 @@ describe('formatting edge cases', () => {
     await expect(buildPromise).rejects.toMatchSnapshot();
   });
 
+  test('reports resolution errors on locations past the end of the source', async () => {
+    // A Babel plugin appends an unresolvable import whose source location is
+    // past the end of the file on disk. The resolution error must survive:
+    // before, building the code frame threw a TypeError that replaced it.
+    const config = await Metro.loadConfig({
+      config: require.resolve('../metro.config.js'),
+    });
+
+    const buildPromise = Metro.runBuild(
+      {
+        ...config,
+        transformer: {
+          ...config.transformer,
+          babelTransformerPath:
+            require.resolve('../injectImportPastEndOfFileTransformer'),
+        },
+      },
+      {entry: 'build-errors/transform-injected-import.js'},
+    );
+
+    // Deliberately not a snapshot: the resolver's list of candidate paths
+    // varies between versions, and what matters here is only that the
+    // resolution error survives with a code frame of the lines that do exist.
+    const error = await buildPromise.then(
+      () => null,
+      (e: Error) => e,
+    );
+    expect(error?.message).toMatch(
+      /^Unable to resolve module \.\/does-not-exist/,
+    );
+    expect(error?.message).toContain('13 | global.x = 1;');
+  });
+
   test('reports resolution errors with embedded comment after the specifier', async () => {
     const config = await Metro.loadConfig({
       config: require.resolve('../metro.config.js'),
```

**File**: `packages/metro/src/integration_tests/basic_bundle/build-errors/transform-injected-import.js` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow strict-local
+ * @format
+ */
+
+// The unresolvable import in this module is added by a Babel plugin, not
+// written here - see injectImportPastEndOfFileTransformer.js.
+global.x = 1;
```

**File**: `packages/metro/src/integration_tests/injectImportPastEndOfFileTransformer.js` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow
+ * @format
+ * @oncall react_native
+ */
+
+'use strict';
+
+import type {PluginObj} from '@babel/core';
+import type {
+  BabelTransformer,
+  BabelTransformerArgs,
+} from 'metro-babel-transformer';
+
+const {parse} = require('@babel/parser');
+const baseTransformer = require('@react-native/metro-babel-transformer');
+
+const TARGET_FILE = 'transform-injected-import.js';
+const INJECTED_SPECIFIER = './does-not-exist';
+
+/**
+ * Returns a Babel plugin that appends `import './does-not-exist';` to the
+ * module, parsed at `startLine` - which is what a plugin that generates and
+ * appends code does, so that the generated code's locations do not overlap the
+ * author's.
+ *
+ * Given a `startLine` past the end of the file, the dependency Metro collects
+ * reports a source location that has no counterpart in the file on disk, which
+ * is what the resolution error's code frame has to tolerate.
+ */
+function injectImportAt(startLine: number): () => PluginObj<> {
+  return () => ({
+    name: 'metro-test-inject-import-past-end-of-file',
+    visitor: {
+      Program(path) {
+        const generated = parse(`import '${INJECTED_SPECIFIER}';`, {
+          sourceType: 'module',
+          startLine,
+        });
+        path.node.body.push(...generated.program.body);
+      },
+    },
+  });
+}
+
+function transform(args: BabelTransformerArgs) {
+  if (!args.filename.endsWith(TARGET_FILE)) {
+    return baseTransformer.transform(args);
+  }
+  // One line past the last line of the source, so the injected import's
+  // location does not exist in the file on disk.
+  const startLine = args.src.split('\n').length + 1;
+  return baseTransformer.transform({
+    ...args,
+    plugins: [...(args.plugins ?? []), injectImportAt(startLine)],
+  });
+}
+
+module.exports = {
+  transform,
+  getCacheKey: baseTransformer.getCacheKey,
+} as BabelTransformer;
```

**File**: `packages/metro/src/node-haste/DependencyGraph/ModuleResolution.js` (modified, +5/-0)
```diff
@@ -373,6 +373,11 @@ function refineDependencyLocation(
   // Note that module names may not always be found in the source code verbatim,
   // whether because of escaping or because of exotic dependency APIs.
   for (let line = loc.end.line - 1; line >= loc.start.line - 1; line--) {
+    // The error occurred in code that was added by a transform, then it
+    // won't be present in the original source code.
+    if (lines[line] == null) {
+      continue;
+    }
     const maxColumn =
       line === loc.end.line ? loc.end.column + 2 : lines[line].length;
     const minColumn = line === loc.start.line ? loc.start.column - 1 : 0;
```

---

### Incident Patch 9: `f8269d5f` (2026-09-27)
**Commit Message**: Fix exact "exports" and "imports" keys with no target falling back to a pattern (#1987)

**File**: `packages/metro-resolver/src/__tests__/package-exports-test.js` (modified, +39/-0)
```diff
@@ -655,6 +655,45 @@ describe('with package exports resolution enabled', () => {
       });
     });
 
+    test.each([
+      ['null', 'internal'],
+      ['no matching condition', 'server'],
+    ])(
+      'exact subpath with %s target does not fall back to a pattern',
+      (_, subpath) => {
+        const logWarning = jest.fn();
+        const context = {
+          ...createResolutionContext({
+            '/root/src/main.js': '',
+            '/root/node_modules/test-pkg/package.json': JSON.stringify({
+              name: 'test-pkg',
+              exports: {
+                './*': './lib/*.js',
+                './internal': null,
+                './server': {browser: './server-browser.js'},
+              },
+            }),
+            '/root/node_modules/test-pkg/lib/internal.js': '',
+            '/root/node_modules/test-pkg/lib/server.js': '',
+            '/root/node_modules/test-pkg/internal.js': '',
+            '/root/node_modules/test-pkg/server.js': '',
+          }),
+          originModulePath: '/root/src/main.js',
+          unstable_enablePackageExports: true,
+          unstable_logWarning: logWarning,
+        };
+
+        expect(Resolver.resolve(context, `test-pkg/${subpath}`, null)).toEqual({
+          type: 'sourceFile',
+          filePath: `/root/node_modules/test-pkg/${subpath}.js`,
+        });
+        expect(logWarning).toHaveBeenCalledTimes(1);
+        expect(logWarning.mock.calls[0][0]).toContain(
+          `"/root/node_modules/test-pkg/${subpath}" which is listed in the "exports"`,
+        );
+      },
+    );
+
     describe('package encapsulation', () => {
       test('[nonstrict] should fall back to "browser" spec resolution and log inaccessible import warning', () => {
         const logWarning = jest.fn();
```

**File**: `packages/metro-resolver/src/__tests__/package-imports-test.js` (modified, +25/-0)
```diff
@@ -84,6 +84,31 @@ describe('import subpath patterns resolution support', () => {
       filePath: p('/root/node_modules/test-pkg/src/features/foo.js.js'),
     });
   });
+
+  test('exact subpath with a null or unmatched target does not fall back to a pattern', () => {
+    const logWarning = jest.fn();
+    const context = {
+      ...createResolutionContext({
+        [p('/root/node_modules/test-pkg/package.json')]: JSON.stringify({
+          name: 'test-pkg',
+          imports: {
+            '#features/*': './src/features/*.js',
+            '#features/foo': null,
+            '#features/bar': {browser: './src/features/bar.web.js'},
+          },
+        }),
+        [p('/root/node_modules/test-pkg/src/index.js')]: '',
+        [p('/root/node_modules/test-pkg/src/features/foo.js')]: '',
+        [p('/root/node_modules/test-pkg/src/features/bar.js')]: '',
+      }),
+      originModulePath: p('/root/node_modules/test-pkg/src/index.js'),
+      unstable_logWarning: logWarning,
+    };
+
+    expect(() => Resolver.resolve(context, '#features/foo', null)).toThrow();
+    expect(() => Resolver.resolve(context, '#features/bar', null)).toThrow();
+    expect(logWarning).toHaveBeenCalledTimes(2);
+  });
 });
 
 describe('import subpath conditional imports resolution', () => {
```

**File**: `packages/metro-resolver/src/utils/matchSubpathFromExportsLike.js` (modified, +8/-3)
```diff
@@ -49,11 +49,16 @@ export function matchSubpathFromExportsLike(
     createConfigError,
   );
 
-  let target = exportsLikeMapAfterConditions.get(subpath);
+  let target = null;
   let patternMatch = null;
 
-  // Attempt to match after expanding any subpath pattern keys
-  if (target == null) {
+  // Attempt to match subpath pattern keys only if there is no exact key. An
+  // exact key takes precedence even when its target is null. See step 2 of
+  // `PACKAGE_IMPORTS_EXPORTS_RESOLVE` in:
+  // https://nodejs.org/api/esm.html#resolution-algorithm-specification
+  if (exportsLikeMapAfterConditions.has(subpath)) {
+    target = exportsLikeMapAfterConditions.get(subpath);
+  } else {
     // Gather keys which are subpath patterns in descending order of specificity
     // For ordering, see `PATTERN_KEY_COMPARE` in:
     // https://nodejs.org/api/esm.html#resolution-algorithm-specification
```

---

### Incident Patch 10: `b7c20552` (2026-09-26)
**Commit Message**: Fix typos, grammatical errors, and misspelled identifiers (#1975)

**File**: `docs/API.md` (modified, +1/-1)
```diff
@@ -76,4 +76,4 @@ Starts a full Metro HTTP server. It will listen on the specified `host:port`, an
 
 **Basic options:** `port`, `onBundleBuilt`
 
-Instead of creating the full server, creates a Connect middleware that answers to bundle requests. This middleware can then be plugged into your own servers. The `port` parameter is optional and only used for logging purposes. The `onBundleBuilt` function is optional, is passed the bundle name, and is called when the server has finishing creating the bundle.
+Instead of creating the full server, creates a Connect middleware that answers to bundle requests. This middleware can then be plugged into your own servers. The `port` parameter is optional and only used for logging purposes. The `onBundleBuilt` function is optional, is passed the bundle name, and is called when the server has finished creating the bundle.
```

**File**: `docs/GettingStarted.md` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@ Given a configuration and a set of options that you would typically pass to a se
 * `platform ('web' | 'android' | 'ios')`: Which platform to bundle for if a list of platforms is provided.
 * `sourceMap (boolean)`: Whether Metro should generate source maps.
 * `sourceMapOut (string)`: Where to save the source map, if `sourceMap == true`. No extension will be added.
-* `sourceMapUrl (string)`: URL where the source map can be found. It defaults to the same same URL as the bundle, but changing the extension from `.bundle` to `.map`. When `inlineSourceMap` is `true`, this property has no effect.
+* `sourceMapUrl (string)`: URL where the source map can be found. It defaults to the same URL as the bundle, but changing the extension from `.bundle` to `.map`. When `inlineSourceMap` is `true`, this property has no effect.
 
 ```js
 const config = await Metro.loadConfig();
@@ -226,7 +226,7 @@ module.exports.transform = (file: {filename: string, src: string}) => {
 };
 ```
 
-If you would like to plug-in Babel, you can simply do that by passing the code to it:
+If you would like to plug in Babel, you can simply do that by passing the code to it:
 
 ```js
 const {transformSync} = require('@babel/core');
```

**File**: `docs/LocalDevelopment.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ Our recommended workflow is to use [`yarn link`][1] to register local `metro` pa
     yarn link metro metro-config metro-runtime
     ```
 
-    Note: At mininum, the `metro` and `metro-runtime` packages need to be linked.
+    Note: At minimum, the `metro` and `metro-runtime` packages need to be linked.
 
 3. **Configure Metro `watchFolders` to work with our linked packages**
 
```

**File**: `docs/PackageExports.md` (modified, +2/-2)
```diff
@@ -172,7 +172,7 @@ The Node.js spec gives guidance on migrating to `"exports"` in a non-breaking ma
 
 Each subpath is an exact specifier ([see section in RFC](https://github.com/react-native-community/discussions-and-proposals/blob/main/proposals/0534-metro-package-exports-support.md#exact-path-specifiers)).
 
-We recommend continuing to use **extensionless specifiers** for subpaths in packages targeting React Native — or **defining both extensioned and extensionless specifiers**. This will match matching existing user expectations.
+We recommend continuing to use **extensionless specifiers** for subpaths in packages targeting React Native — or **defining both extensioned and extensionless specifiers**. This will match existing user expectations.
 
 ```json
   "exports": {
@@ -262,7 +262,7 @@ Using subpath patterns can be a convenient method to export many assets. We reco
 
 ## Troubleshooting
 
-### Package/ESM incompatibilites
+### Package/ESM incompatibilities
 Some issues that can come from Metro resolving to a file not designed for React Native include:
  - *"`import.meta` can not be used outside a module"*. `import.meta` support is coming.
  - Errors relating to `document` or other web globals in your mobile app.
```

**File**: `docs/Resolution.md` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ Parameters: (*context*, *moduleName*, *platform*)
 1. If a [custom resolver](#resolverequest-customresolver) is defined, then
     1. Return the result of the custom resolver.
 2. If *moduleName* is an absolute path, or equal to `'.'` or `'..'`, or begins `'./'` or `'../'`
-    1. Let *absoluteModuleName* be *moduleName* if it is absolute path, otherwise the result of prepending the current directory (i.e. parent of [`context.originModulePath`](#originmodulepath-string)) with *moduleName*.
+    1. Let *absoluteModuleName* be *moduleName* if it is an absolute path, otherwise the result of prepending the current directory (i.e. parent of [`context.originModulePath`](#originmodulepath-string)) with *moduleName*.
     2. Return the result of [**RESOLVE_MODULE**](#resolve_module)(*context*, *absoluteModuleName*, *platform*), or continue.
 3. If *moduleName* begins `'#'`
     1. Throw an error. This will be replaced with subpath imports support in a non-breaking future release.
@@ -301,7 +301,7 @@ Any custom options passed to the resolver. By default, Metro populates this base
 
 #### `resolveRequest: CustomResolver`
 
-A alternative resolver function to which the current request may be delegated. Defaults to [`resolver.resolveRequest`](./Configuration.md#resolverequest).
+An alternative resolver function to which the current request may be delegated. Defaults to [`resolver.resolveRequest`](./Configuration.md#resolverequest).
 
 Metro expects `resolveRequest` to have the following signature:
 
```

**File**: `packages/buck-worker-tool/src/__tests__/worker-test.js` (modified, +1/-1)
```diff
@@ -386,7 +386,7 @@ describe('Buck worker:', () => {
       });
     });
 
-    test('responds with success if the command finishes succesfully', () => {
+    test('responds with success if the command finishes successfully', () => {
       commands.transform = (args, _) => {};
       mockFiles({path: {to: {args: 'transform'}}});
       inStream.write(
```

**File**: `packages/buck-worker-tool/src/worker-tool.js` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@ type CommandMessage = Message<
   },
 >;
 
-type HandshakeReponse = Message<
+type HandshakeResponse = Message<
   'handshake',
   {
     protocol_version: '0',
@@ -64,7 +64,7 @@ type CommandResponse = Message<'result', {exit_code: 0, ...}>;
 type ErrorResponse = Message<'error', {exit_code: number, ...}>;
 
 type IncomingMessage = HandshakeMessage | CommandMessage;
-type Response = HandshakeReponse | CommandResponse | ErrorResponse;
+type Response = HandshakeResponse | CommandResponse | ErrorResponse;
 type RespondFn = (response: Response) => void;
 
 type JSONReaderDataHandler = IncomingMessage => unknown;
```

**File**: `packages/metro-config/src/defaults/__tests__/exclusionList-test.js` (modified, +7/-7)
```diff
@@ -16,7 +16,7 @@ const path = require('node:path');
 describe('exclusionList', () => {
   let originalSeparator;
 
-  function setPathSeperator(sep: string) {
+  function setPathSeparator(sep: string) {
     // $FlowFixMe[cannot-write]: property sep is not writable.
     path.sep = sep;
   }
@@ -31,14 +31,14 @@ describe('exclusionList', () => {
   });
 
   test('proves we can write to path.sep for setting up the tests', () => {
-    setPathSeperator('/');
+    setPathSeparator('/');
     expect(require('node:path').sep).toBe('/');
-    setPathSeperator('\\');
+    setPathSeparator('\\');
     expect(require('node:path').sep).toBe('\\');
   });
 
-  describe('simulate macOS/linux enviornment', () => {
-    beforeEach(() => setPathSeperator('/'));
+  describe('simulate macOS/linux environment', () => {
+    beforeEach(() => setPathSeparator('/'));
 
     test('converts forward slashes in the RegExp to the OS specific path separator', () => {
       // Simple case
@@ -73,8 +73,8 @@ describe('exclusionList', () => {
     });
   });
 
-  describe('simulate windows enviornment', () => {
-    beforeEach(() => setPathSeperator('\\'));
+  describe('simulate windows environment', () => {
+    beforeEach(() => setPathSeparator('\\'));
 
     test('converts forward slashes in the RegExp to the OS specific path separator', () => {
       // Simple case
```

---

### Incident Patch 11: `ab82c6a2` (2026-09-26)
**Commit Message**: Fix section offsets in generatedMappings() for indexed source maps (#1976)

**File**: `packages/metro-source-map/src/Consumer/SectionsConsumer.js` (modified, +6/-6)
```diff
@@ -69,8 +69,8 @@ export default class SectionsConsumer
           (get1(mapping.generatedLine) > 1 || get0(mapping.generatedColumn) > 0)
         ) {
           yield {
-            generatedLine: FIRST_LINE,
-            generatedColumn: FIRST_COLUMN,
+            generatedLine: add(FIRST_LINE, generatedOffset.lines),
+            generatedColumn: add(FIRST_COLUMN, generatedOffset.columns),
             source: null,
             name: null,
             originalLine: null,
@@ -81,10 +81,10 @@ export default class SectionsConsumer
         yield {
           ...mapping,
           generatedLine: add(mapping.generatedLine, generatedOffset.lines),
-          generatedColumn: add(
-            mapping.generatedColumn,
-            generatedOffset.columns,
-          ),
+          generatedColumn:
+            mapping.generatedLine === FIRST_LINE
+              ? add(mapping.generatedColumn, generatedOffset.columns)
+              : mapping.generatedColumn,
         };
       }
     }
```

**File**: `packages/metro-source-map/src/__tests__/Consumer-test.js` (modified, +42/-0)
```diff
@@ -527,6 +527,48 @@ describe('indexed (sectioned) maps', () => {
     });
   });
 
+  describe('generatedMappings()', () => {
+    test('applies the section offset to generated positions', () => {
+      const consumer = new Consumer({
+        version: 3,
+        sections: [
+          {
+            offset: {line: 0, column: 0},
+            map: {
+              version: 3,
+              names: [],
+              sources: ['section0_source0'],
+              mappings: 'AAAA',
+            },
+          },
+          {
+            offset: {line: 0, column: 4},
+            map: {
+              version: 3,
+              names: [],
+              sources: ['section1_source0'],
+              mappings: 'CAAA;AACA',
+            },
+          },
+        ],
+      });
+      expect(
+        [...consumer.generatedMappings()].map(mapping => [
+          mapping.generatedLine,
+          mapping.generatedColumn,
+          mapping.source,
+        ]),
+      ).toEqual([
+        [1, 0, 'section0_source0'],
+        // Unmapped from the start of section 1 until its first mapping
+        [1, 4, null],
+        [1, 5, 'section1_source0'],
+        // The column offset only applies to the first line of a section
+        [2, 0, 'section1_source0'],
+      ]);
+    });
+  });
+
   describe('sourceContentFor', () => {
     test('empty map', () => {
       const consumer = new Consumer({
```

**File**: `packages/metro-source-map/src/__tests__/composeSourceMaps-test.js` (modified, +34/-0)
```diff
@@ -329,6 +329,40 @@ describe('composeSourceMaps', () => {
     `);
   });
 
+  test('composes a last map with multi-line sections at a column offset', () => {
+    const indexedMap: IndexMap = {
+      version: 3,
+      sections: [
+        {
+          offset: {line: 0, column: 0},
+          map: {version: 3, names: [], sources: ['a.js'], mappings: 'AAAA'},
+        },
+        {
+          offset: {line: 0, column: 4},
+          map: {
+            version: 3,
+            names: [],
+            sources: ['b.js'],
+            mappings: 'CAAA;AACA',
+          },
+        },
+      ],
+    };
+    const composed = new Consumer(composeSourceMaps([indexedMap]));
+    const indexed = new Consumer(indexedMap);
+    for (const [line, column] of [
+      [1, 0],
+      [1, 4],
+      [1, 5],
+      [2, 0],
+    ]) {
+      const position = {line: add1(line - 1), column: add0(column)};
+      expect(composed.originalPositionFor(position)).toEqual(
+        indexed.originalPositionFor(position),
+      );
+    }
+  });
+
   test('Propagate x_hermes_function_offsets', () => {
     const map1 = {
       version: 3,
```

---

### Incident Patch 12: `88f95b09` (2026-09-25)
**Commit Message**: NativeWatcher: Emit events in the order fs.watch reported them - fix flaky integration tests (#1974)

**File**: `packages/metro-file-map/src/watchers/NativeWatcher.js` (modified, +44/-14)
```diff
@@ -8,6 +8,7 @@
  * @format
  */
 
+import type {WatcherBackendChangeEvent} from '../flow-types';
 import type {FSWatcher} from 'node:fs';
 
 import {AbstractWatcher} from './AbstractWatcher';
@@ -46,6 +47,11 @@ const RECRAWL_EVENT = 'recrawl';
 export default class NativeWatcher extends AbstractWatcher {
   #fsWatcher: ?FSWatcher;
 
+  /**
+   * Promise chain to emit events in the order they were received.
+   */
+  #emitQueue: Promise<void> = Promise.resolve();
+
   static isSupported(): boolean {
     return platform() === 'darwin';
   }
@@ -59,7 +65,7 @@ export default class NativeWatcher extends AbstractWatcher {
       ...
     }>,
   ) {
-    if (!NativeWatcher.isSupported) {
+    if (!NativeWatcher.isSupported()) {
       throw new Error('This watcher can only be used on macOS');
     }
     super(dir, opts);
@@ -76,7 +82,26 @@ export default class NativeWatcher extends AbstractWatcher {
         recursive: true,
       },
       (event, relativePath) => {
-        this._handleEvent(event, relativePath).catch(error => {
+        // Start handling immediately so that stats are gathered concurrently
+        // and as close as possible to the event, but emit in arrival order.
+        const settled = this.#handleEvent(event, relativePath).then(
+          change => ({change, error: null}),
+          (error: Error) => ({change: null, error}),
+        );
+        const emitted = this.#emitQueue.then(() =>
+          settled.then(({change, error}) => {
+            if (error != null) {
+              throw error;
+            }
+            if (change != null) {
+              this.emitFileEvent(change);
+            }
+          }),
+        );
+        // Report failures outside the queue, so that a throwing emitError
+        // (e.g. with no error listener) can't suppress later events.
+        this.#emitQueue = emitted.catch(() => {});
+        emitted.catch(error => {
           this.emitError(error);
         });
       },
@@ -95,7 +120,14 @@ export default class NativeWatcher extends AbstractWatcher {
     }
   }
 
-  async _handleEvent(event: string, relativePath: string) {
+  /**
+   * Resolve a raw `fs.watch` event into the event to emit for it, or `null` if
+   * it should be dropped.
+   */
+  async #handleEvent(
+    event: string,
+    relativePath: string,
+  ): Promise<?Omit<WatcherBackendChangeEvent, 'root'>> {
     const absolutePath = path.resolve(this.root, relativePath);
     if (this.doIgnore(relativePath)) {
       debug(
@@ -104,7 +136,7 @@ export default class NativeWatcher extends AbstractWatcher {
         relativePath,
         this.root,
       );
-      return;
+      return null;
     }
     debug(
       'Handling event "%s" on %s (root: %s)',
@@ -119,11 +151,11 @@ export default class NativeWatcher extends AbstractWatcher {
 
       // Ignore files of an unrecognized type
       if (!type) {
-        return;
+        return null;
       }
 
       if (!includedByGlob(type, this.globs, this.dot, relativePath)) {
-        return;
+        return null;
       }
 
       // For directory "rename" events, notify that we need a recrawl since we
@@ -136,29 +168,27 @@ export default class NativeWatcher extends AbstractWatcher {
           'Directory rename detected on %s, requesting recrawl',
           relativePath,
         );
-        this.emitFileEvent({
+        return {
           event: RECRAWL_EVENT,
           relativePath,
-        });
-        return;
+        };
       }
 
-      this.emitFileEvent({
+      return {
         event: TOUCH_EVENT,
         relativePath,
         metadata: {
           type,
           modifiedTime: stat.mtime.getTime(),
           size: stat.size,
         },
-      });
+      };
     } catch (error) {
       if (error?.code !== 'ENOENT') {
-        this.emitError(error);
-        return;
+        throw error;
       }
 
-      this.emitFileEvent({event: DELETE_EVENT, relativePath});
+      return {event: DELETE_EVENT, relativePath};
     }
   }
 }
```

**File**: `packages/metro-file-map/src/watchers/__tests__/NativeWatcher-test.js` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow strict-local
+ * @format
+ * @oncall react_native
+ */
+
+import type {WatcherBackendChangeEvent} from '../../flow-types';
+
+import NativeWatcher from '../NativeWatcher';
+import fs from 'node:fs';
+import os from 'node:os';
+import {join, resolve} from 'node:path';
+
+jest.useRealTimers();
+
+// Absolute on every platform, with a drive letter on Windows, as the watcher
+// resolves its root.
+const ROOT = resolve('/', 'project');
+
+type Deferred<T> = {
+  promise: Promise<T>,
+  resolve: T => void,
+  reject: Error => void,
+};
+
+function deferred<T>(): Deferred<T> {
+  let resolve: T => void = () => {};
+  let reject: Error => void = () => {};
+  const promise = new Promise<T>((res, rej) => {
+    resolve = res;
+    reject = rej;
+  });
+  return {promise, resolve, reject};
+}
+
+function fileStat(mtimeMs: number): fs.Stats {
+  // $FlowFixMe[incompatible-type] - only the fields NativeWatcher reads
+  return {
+    isSymbolicLink: () => false,
+    isDirectory: () => false,
+    isFile: () => true,
+    mtime: new Date(mtimeMs),
+    size: 42,
+  };
+}
+
+function enoent(): Error {
+  const error = new Error('ENOENT: no such file or directory');
+  // $FlowFixMe[prop-missing] - Node system errors carry a code
+  error.code = 'ENOENT';
+  return error;
+}
+
+// Run every pending promise continuation, including those queued by others.
+const flush = () => new Promise(resolve => setImmediate(resolve));
+
+describe('NativeWatcher', () => {
+  let watcher: NativeWatcher;
+  let emitFsEvent: (event: string, relativePath: string) => void;
+  let pendingStats: Map<string, Deferred<fs.Stats>>;
+  let events: Array<WatcherBackendChangeEvent>;
+
+  beforeEach(async () => {
+    jest.spyOn(os, 'platform').mockReturnValue('darwin');
+    jest.spyOn(fs, 'watch').mockImplementation((_root, _opts, listener) => {
+      emitFsEvent = listener;
+      return {close: () => {}};
+    });
+    pendingStats = new Map();
+    jest.spyOn(fs.promises, 'lstat').mockImplementation(absolutePath => {
+      const stat = deferred<fs.Stats>();
+      pendingStats.set(String(absolutePath), stat);
+      return stat.promise;
+    });
+
+    watcher = new NativeWatcher(ROOT, {dot: true, globs: [], ignored: null});
+    events = [];
+    watcher.onFileEvent(event => {
+      events.push(event);
+    });
+    await watcher.startWatching();
+  });
+
+  afterEach(async () => {
+    await watcher.stopWatching();
+    jest.restoreAllMocks();
+  });
+
+  function settleStat(relativePath: string, result: fs.Stats | Error): void {
+    const stat = pendingStats.get(join(ROOT, relativePath));
+    if (stat == null) {
+      throw new Error(`No lstat pending for ${relativePath}`);
+    }
+    if (result instanceof Error) {
+      stat.reject(result);
+    } else {
+      stat.resolve(result);
+    }
+  }
+
+  test('emits events in the order fs.watch reported them, however their stats settle', async () => {
+    emitFsEvent('rename', join('app', 'moved-in', 'file.js'));
+    emitFsEvent('rename', join('app', 'moved-in'));
+    emitFsEvent('change', join('app', 'other.js'));
+
+    // All stats start immediately, before any has settled.
+    expect([...pendingStats.keys()]).toEqual([
+      join(ROOT, 'app', 'moved-in', 'file.js'),
+      join(ROOT, 'app', 'moved-in'),
+      join(ROOT, 'app', 'other.js'),
+    ]);
+
+    // Settle in reverse order. Nothing can be emitted until the first settles.
+    settleStat(join('app', 'other.js'), fileStat(1000));
+    settleStat(join('app', 'moved-in'), enoent());
+    await flush();
+    expect(events).toEqual([]);
+
+    settleStat(join('app', 'moved-in', 'file.js'), enoent());
+    await flush();
+    expect(events).toEqual([
+      {
+        event: 'delete',
+        relativePath: join('app', 'moved-in', 'file.js'),
+        root: ROOT,
+      },
+      {event: 'delete', relativePath: join('app', 'moved-in'), root: ROOT},
+      {
+        event: 'touch',
+        relativePath: join('app', 'other.js'),
+        root: ROOT,
+        metadata: {type: 'f', modifiedTime: 1000, size: 42},
+      },
+    ]);
+  });
+
+  test('an lstat failure is reported in order and does not block later events', async () => {
+    const order: Array<string> = [];
+    watcher.onFileEvent(event => {
+      order.push(`${event.event}:${event.relativePath}`);
+    });
+    watcher.onError(error => {
+      order.push(`error:${error.message}`);
+    });
+
+    emitFsEvent('change', 'first.js');
+    emitFsEvent('change', 'second.js');
+    emitFsEvent('change', 'third.js');
+
+    settleStat('third.js', fileStat(3000));
+    settleStat('second.js', new Error('EACCES'));
+    await flush();
+    expect(order).toEqual([]);
+
+    settleStat('first.js', fileStat(1000));
+    await flush();
+    expect(order).to
```

---

### Incident Patch 13: `a95869a0` (2026-09-25)
**Commit Message**: Fix SVG dimension parsing treating stroke-width as width (#1972)

**File**: `packages/metro/src/lib/__tests__/imageSize-test.js` (modified, +26/-0)
```diff
@@ -53,6 +53,32 @@ describe('getImageDimensions', () => {
     ).toEqual({width: WIDTH, height: HEIGHT});
   });
 
+  test.each([
+    [
+      'stroke-width after width and height',
+      `<svg width="${WIDTH}" height="${HEIGHT}" stroke-width="2"/>`,
+    ],
+    [
+      'stroke-width with only a viewBox',
+      `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" stroke-width="1.5"/>`,
+    ],
+    [
+      'other hyphenated attributes',
+      `<svg width="${WIDTH}" height="${HEIGHT}" data-width="7" border-height="9"/>`,
+    ],
+    [
+      'a namespaced attribute after width and height',
+      `<svg width="${WIDTH}" height="${HEIGHT}" xlink:width="5"/>`,
+    ],
+  ])(
+    'ignores SVG attributes that only end in a dimension name: %s',
+    (_, svg) => {
+      expect(
+        getImageDimensions('svg', Buffer.from(svg), '/root/icon.svg'),
+      ).toEqual({width: WIDTH, height: HEIGHT});
+    },
+  );
+
   test('rejects unsupported SVG units', () => {
     expect(() =>
       getImageDimensions(
```

**File**: `packages/metro/src/lib/imageSize.js` (modified, +1/-1)
```diff
@@ -312,7 +312,7 @@ function parseSvg(content: Buffer): ?Dimensions {
   const root = header.slice(rootStart, rootEnd + 1);
   const attributes: {[string]: string} = {};
   const attributePattern =
-    /\b(width|height|viewBox)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
+    /(?<![\w:-])(width|height|viewBox)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
   let match = attributePattern.exec(root);
   while (match != null) {
     const name = match[1];
```

---

### Incident Patch 14: `5e87b2ca` (2026-09-25)
**Commit Message**: metro-file-map: Fix missed changes and a stop hang in FallbackWatcher (#1967)

**File**: `packages/metro-file-map/src/watchers/FallbackWatcher.js` (modified, +46/-50)
```diff
@@ -31,6 +31,7 @@ const fsPromises = fs.promises;
 
 const TOUCH_EVENT = common.TOUCH_EVENT;
 const DELETE_EVENT = common.DELETE_EVENT;
+const RECRAWL_EVENT = common.RECRAWL_EVENT;
 
 /**
  * This setting delays all events. It suppresses 'change' events that
@@ -196,7 +197,15 @@ export default class FallbackWatcher extends AbstractWatcher {
     }
     this.#watched[dir] = watcher;
 
-    watcher.on('error', this.#checkedEmitError);
+    watcher.on('error', error => {
+      // Node has already closed the watcher, and will not emit 'close'. Forget
+      // it, so that stopping doesn't wait on it and the path can be watched
+      // again.
+      if (this.#watched[dir] === watcher) {
+        delete this.#watched[dir];
+      }
+      this.#checkedEmitError(error);
+    });
 
     if (this.root !== dir) {
       this.#register(dir, 'd');
@@ -228,67 +237,48 @@ export default class FallbackWatcher extends AbstractWatcher {
     await Promise.all(promises);
   }
 
-  /**
-   * On some platforms, as pointed out on the fs docs (most likely just win32)
-   * the file argument might be missing from the fs event. Try to detect what
-   * change by detecting if something was deleted or the most recent file change.
-   */
-  #detectChangedFile(
-    dir: string,
-    event: string,
-    callback: (file: string) => void,
-  ) {
-    if (!this.#dirRegistry[dir]) {
-      return;
-    }
-
-    let found = false;
-    let closest: ?Readonly<{file: string, mtime: Stats['mtime']}> = null;
-    let c = 0;
-    Object.keys(this.#dirRegistry[dir]).forEach((file, i, arr) => {
-      fs.lstat(path.join(dir, file), (error, stat) => {
-        if (found) {
-          return;
-        }
-
-        if (error) {
-          if (isIgnorableFileError(error)) {
-            found = true;
-            callback(file);
-          } else {
-            this.emitError(error);
-          }
-        } else {
-          if (closest == null || stat.mtime > closest.mtime) {
-            closest = {file, mtime: stat.mtime};
-          }
-          if (arr.length === ++c) {
-            callback(closest.file);
-          }
-        }
-      });
-    });
-  }
-
   /**
    * Normalize fs events and pass it on to be processed.
    */
   #normalizeChange(dir: string, event: string, file: string) {
     if (!file) {
-      this.#detectChangedFile(dir, event, actualFile => {
-        if (actualFile) {
-          this.#processChange(dir, event, actualFile).catch(error =>
-            this.emitError(error),
-          );
-        }
-      });
+      this.#processUnnamedChange(dir).catch(error => this.emitError(error));
     } else {
       this.#processChange(dir, event, path.normalize(file)).catch(error =>
         this.emitError(error),
       );
     }
   }
 
+  /**
+   * Process an event that doesn't name the changed entry. Windows sends these
+   * when changes to a directory overflow the buffer they're reported through,
+   * so any number of entries under `dir` may have been added, changed or
+   * removed.
+   */
+  async #processUnnamedChange(dir: string) {
+    // Watch and register anything new, so that later changes are reported.
+    await recReaddir(
+      dir,
+      subdir => {
+        this.#watchdir(subdir);
+      },
+      filename => {
+        this.#register(filename, 'f');
+      },
+      symlink => {
+        this.#register(symlink, 'l');
+      },
+      this.#checkedEmitError,
+      this.ignored,
+    );
+    // Then have the file map reconcile everything under `dir`.
+    this.#emitEvent({
+      event: RECRAWL_EVENT,
+      relativePath: path.relative(this.root, dir),
+    });
+  }
+
   /**
    * Process changes.
    */
@@ -356,6 +346,12 @@ export default class FallbackWatcher extends AbstractWatcher {
           this.#checkedEmitError,
           this.ignored,
         );
+        // A directory we already knew about has been replaced, so entries we
+        // registered under it may since have changed or been removed. Have the
+        // file map reconcile it.
+        if (registered) {
+          this.#emitEvent({event: RECRAWL_EVENT, relativePath});
+        }
       } else {
         const type = common.typeFromStat(stat);
         if (type == null) {
```

**File**: `packages/metro-file-map/src/watchers/__tests__/FallbackWatcher-test.js` (modified, +137/-2)
```diff
@@ -9,8 +9,11 @@
  * @oncall react_native
  */
 
+import type {WatcherBackendChangeEvent} from '../../flow-types';
+
 import FallbackWatcher from '../FallbackWatcher';
 import {createTempWatchRoot} from './helpers';
+import EventEmitter from 'node:events';
 import fs from 'node:fs';
 import {join} from 'node:path';
 
@@ -19,11 +22,22 @@ jest.setTimeout(10 * 1000);
 
 const {mkdir, rm, writeFile} = fs.promises;
 
+// An `FSWatcher` after it has reported an error: Node closes the handle before
+// emitting 'error', so a subsequent `close()` returns early and emits nothing.
+class ErroredFSWatcher extends EventEmitter {
+  close() {}
+}
+
 describe('FallbackWatcher', () => {
   let watchRoot: string;
   let watcher: ?FallbackWatcher;
   let calls: Array<string>;
   let watchFailure: ?{code: string, path: string};
+  let watchOverride: ?{path: string, watcher: ErroredFSWatcher};
+  // The listener passed to `fs.watch` for each directory, and the directories
+  // whose events are withheld from it.
+  let listeners: Map<string, (event: string, filename: ?string) => void>;
+  let mutedDirs: Set<string>;
 
   const indexOfCall = (op: 'watch' | 'readdir', dir: string) =>
     calls.indexOf(`${op}:${dir}`);
@@ -37,18 +51,32 @@ describe('FallbackWatcher', () => {
     watchRoot = await createTempWatchRoot('Fallback', false);
     calls = [];
     watchFailure = null;
+    watchOverride = null;
+    listeners = new Map();
+    mutedDirs = new Set();
 
     const {watch} = fs;
-    jest.spyOn(fs, 'watch').mockImplementation((dir, ...args) => {
+    jest.spyOn(fs, 'watch').mockImplementation((dir, options, listener) => {
       calls.push(`watch:${String(dir)}`);
+      const override = watchOverride;
+      if (override != null && dir === override.path) {
+        watchOverride = null;
+        // $FlowFixMe[incompatible-type] - models an errored FSWatcher
+        return override.watcher;
+      }
       const failure = watchFailure;
       if (failure != null && dir === failure.path) {
         const error = new Error(`Cannot watch path '${String(dir)}'.`);
         // $FlowFixMe[prop-missing] code
         error.code = failure.code;
         throw error;
       }
-      return watch(dir, ...args);
+      listeners.set(String(dir), listener);
+      return watch(dir, options, (event, filename) => {
+        if (!mutedDirs.has(String(dir))) {
+          listener(event, filename);
+        }
+      });
     });
     const {readdir} = fs.promises;
     jest.spyOn(fs.promises, 'readdir').mockImplementation((dir, ...args) => {
@@ -126,8 +154,115 @@ describe('FallbackWatcher', () => {
       }
     },
   );
+
+  describe('after a directory watcher errors', () => {
+    let erroredWatcher: ErroredFSWatcher;
+
+    beforeEach(async () => {
+      await mkdir(join(watchRoot, 'a'));
+      erroredWatcher = new ErroredFSWatcher();
+      watchOverride = {path: join(watchRoot, 'a'), watcher: erroredWatcher};
+      await watcher?.startWatching();
+      erroredWatcher.emit('error', fsError('ENOENT', join(watchRoot, 'a')));
+    });
+
+    test('stopWatching resolves', async () => {
+      await expect(
+        Promise.race([
+          watcher?.stopWatching().then(() => 'stopped'),
+          new Promise(resolve => setTimeout(resolve, 1000, 'timed out')),
+        ]),
+      ).resolves.toBe('stopped');
+    });
+
+    // The directory is replaced before we process the change, so we never see
+    // it missing and there is no deletion to clear the old watch.
+    test('watches a directory replaced at the same path', async () => {
+      calls = [];
+      fs.rmSync(join(watchRoot, 'a'), {recursive: true});
+      fs.mkdirSync(join(watchRoot, 'a'));
+      fs.writeFileSync(join(watchRoot, 'a', 'file.js'), '');
+
+      await waitFor(() => indexOfCall('readdir', join(watchRoot, 'a')) >= 0);
+      expectWatchedBeforeListed(join(watchRoot, 'a'));
+    });
+
+    // Entries registered under the old directory may be gone or changed.
+    test('requests a recrawl of a directory replaced at the same path', async () => {
+      const events: Array<WatcherBackendChangeEvent> = [];
+      watcher?.onFileEvent(event => {
+        events.push(event);
+      });
+      fs.rmSync(join(watchRoot, 'a'), {recursive: true});
+      fs.mkdirSync(join(watchRoot, 'a'));
+
+      await waitFor(() => events.some(event => event.event === 'recrawl'));
+      expect(events).toContainEqual({
+        event: 'recrawl',
+        relativePath: 'a',
+        root: watchRoot,
+      });
+    });
+  });
+
+  // Windows reports a change with no filename when changes to a directory
+  // overflow its buffer, so any number of entries under it may have changed.
+  describe('when an event does not name the changed entry', () => {
+    const emitUnnamedChange = (dir: string) => {
+      const listener = listeners.get(dir);
+      if (listener == null) {
+        throw new Error(`Not watching ${dir}`);
+      }
+      listener('change', null);
+    };
+
+    beforeEa
```

---

### Incident Patch 15: `a650ce43` (2026-09-25)
**Commit Message**: Remove 83 unused or trivially fixable Flow suppressions (#1965)

**File**: `flow-typed/graceful-fs.js` (modified, +0/-1)
```diff
@@ -9,7 +9,6 @@
  * @oncall react_native
  */
 
-// $FlowFixMe[unsupported-syntax]
 declare module 'graceful-fs' {
   declare module.exports: {
     ...$Exports<'fs'>,
```

**File**: `flow-typed/jest-worker.js` (modified, +0/-1)
```diff
@@ -254,7 +254,6 @@ declare module 'jest-worker' {
 
   declare export type IJestWorker<TExposed extends {...} = {}> = Readonly<{
     // dynamically exposed methods from the worker
-    // $FlowFixMe[incompatible-exact]
     ...TExposed,
 
     getStderr: () => stream$Readable,
```

**File**: `packages/metro-babel-register/src/babel-register.js` (modified, +0/-1)
```diff
@@ -90,7 +90,6 @@ function config(
       {
         test: /\.js$/,
         plugins: [
-          /* $FlowFixMe[cannot-resolve-module] */
           [require('flow-parser/babel-plugin')],
           [require('babel-plugin-transform-flow-enums')],
           [require('@babel/plugin-transform-flow-strip-types').default],
```

**File**: `packages/metro-cache/src/Cache.js` (modified, +0/-1)
```diff
@@ -48,7 +48,6 @@ export default class Cache<T> {
       try {
         const valueOrPromise = store.get(key);
 
-        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
         if (valueOrPromise && typeof valueOrPromise.then === 'function') {
           value = await valueOrPromise;
         } else {
```

**File**: `packages/metro-cache/src/__tests__/Cache-test.js` (modified, +3/-6)
```diff
@@ -230,17 +230,15 @@ describe('Cache', () => {
 
   describe('disabled cache', () => {
     test('returns null for reads', async () => {
-      // $FlowFixMe[missing-empty-array-annot]
-      const cache = new Cache([]);
+      const cache = new Cache<string>([]);
 
       const result = await cache.get(Buffer.from('foo'));
 
       expect(result).toBe(null);
     });
 
     test('ignores writes', async () => {
-      // $FlowFixMe[missing-empty-array-annot]
-      const cache = new Cache([]);
+      const cache = new Cache<string>([]);
 
       await cache.set(Buffer.from('foo'), 'value');
       const result = await cache.get(Buffer.from('foo'));
@@ -249,8 +247,7 @@ describe('Cache', () => {
     });
 
     test('logs nothing', async () => {
-      // $FlowFixMe[missing-empty-array-annot]
-      const cache = new Cache([]);
+      const cache = new Cache<string>([]);
 
       await cache.set(Buffer.from('foo'), 'value');
       await cache.get(Buffer.from('foo'));
```

**File**: `packages/metro-cache/src/stores/AutoCleanFileStore.js` (modified, +0/-1)
```diff
@@ -61,7 +61,6 @@ export default class AutoCleanFileStore<T> extends FileStore<T> {
       .filter(dirent => dirent.isFile())
       .forEach(dirent => {
         const absolutePath = path.join(
-          // $FlowFixMe[prop-missing] - dirent.parentPath added in Node 20.12
           dirent.parentPath,
           dirent.name.toString(),
         );
```

**File**: `packages/metro-config/src/__tests__/mergeConfig-test.js` (modified, +0/-4)
```diff
@@ -154,7 +154,6 @@ describe('mergeConfig', () => {
 
       test('override tls: undefined (explicit) keeps base tls: object', () => {
         const base: InputConfigT = {server: {tls: {key: 'key', cert: 'cert'}}};
-        // $FlowExpectedError[incompatible-type] - testing explicit undefined
         const override: InputConfigT = {server: {tls: undefined}};
         const result = mergeConfig(base, override);
         expect(result.server?.tls).toStrictEqual({key: 'key', cert: 'cert'});
@@ -169,7 +168,6 @@ describe('mergeConfig', () => {
 
       test('override tls: undefined (explicit) keeps base tls: false', () => {
         const base: InputConfigT = {server: {tls: false}};
-        // $FlowExpectedError[incompatible-type] - testing untyped runtime behavior
         const override: InputConfigT = {server: {tls: undefined}};
         const result = mergeConfig(base, override);
         expect(result.server?.tls).toBe(false);
@@ -199,9 +197,7 @@ describe('mergeConfig', () => {
       });
 
       test('both tls undefined (explicit) results in no tls property', () => {
-        // $FlowExpectedError[incompatible-type] - testing untyped runtime behavior
         const base: InputConfigT = {server: {tls: undefined}};
-        // $FlowExpectedError[incompatible-type] - testing untyped runtime behavior
         const override: InputConfigT = {server: {tls: undefined}};
         const result = mergeConfig(base, override);
         expect(result.server?.tls).toBeUndefined();
```

**File**: `packages/metro-config/src/defaults/__tests__/getMaxWorkers-test.js` (modified, +0/-9)
```diff
@@ -18,19 +18,10 @@ import getMaxWorkers from '../getMaxWorkers';
 const os = jest.requireMock('node:os');
 
 test('calculates the number of max workers', () => {
-  /* $FlowFixMe[prop-missing](>=0.99.0 site=react_native_fb) This comment suppresses an error
-   * found when Flow v0.99 was deployed. To see the error, delete this comment
-   * and run Flow. */
   os.availableParallelism.mockReturnValue(1);
   expect(getMaxWorkers()).toBe(1);
-  /* $FlowFixMe[prop-missing](>=0.99.0 site=react_native_fb) This comment suppresses an error
-   * found when Flow v0.99 was deployed. To see the error, delete this comment
-   * and run Flow. */
   os.availableParallelism.mockReturnValue(8);
   expect(getMaxWorkers()).toBe(6);
-  /* $FlowFixMe[prop-missing](>=0.99.0 site=react_native_fb) This comment suppresses an error
-   * found when Flow v0.99 was deployed. To see the error, delete this comment
-   * and run Flow. */
   os.availableParallelism.mockReturnValue(24);
   expect(getMaxWorkers()).toBe(14);
   expect(getMaxWorkers(5)).toBe(5);
```

#### Recent Merged Pull Requests:
- **PR #2025** (2026-10-05): Deploy 0.334.0 to xplat (@SamChou19815)
- **PR #2024** (2026-10-05): metro-file-map: Restore change events for dotfiles like `.env` (@robhogan)
- **PR #2018** (2026-10-05): Fix getCodeFrame resolution for watchFolder source files (@robhogan)
- **PR #2017** (2026-10-05): Fix HmrServer crash when entry point uses virtual URL prefix (@robhogan)
- **PR #2015** (2026-10-05): Extract `RootUrlMap`, refactor path<-->URL mappings in Server (@robhogan)
- **PR #2014** (2026-10-05): Add integration tests for virtual-prefix URL routing (@robhogan)
- **PR #2004** (2026-10-02): metro-file-map: Close every watch handle under a deleted directory (@YevheniiKotyrlo)
- **PR #2001** (2026-09-30): Label PRs touching package.json, yarn.lock or Flow config as needs-meta-import (@vzaidman)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
