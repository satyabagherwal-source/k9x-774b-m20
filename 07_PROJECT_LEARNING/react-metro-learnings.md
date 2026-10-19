> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-metro-learnings.md`  
> **Source**: github ([https://github.com/react/metro](https://github.com/react/metro))  
> **Source Version**: `2641b08f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:53:46.696Z  
> **Learning ID**: `learn-github-react-metro`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): react/metro

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-metro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/metro](https://github.com/react/metro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T03:53:46.688Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/metro`
- **Description**: 🚇 The JavaScript bundler for React Native
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5650 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1347** (2024-09-07): **[0.80.11] breaks package exports with symlinks**
  *Symptoms*: Hello, having an issue with `0.80.11` and `pnpm` + `expo` + symlinks + package exports  In `0.80.10` package exports are resolved correctly. In `0.80.11` package exports are not resolved.  I have created a reproduction of this issue here: https://github.com/franksmule/expo-repo/tree/main   Symlinks are enabled, although I've enabled `shamefully-hoist=true` - I believe local packages are still symlinked - so it seems to be an issue with the combination of symlinks and package exports?  Metro Config: (https://github.com/franksmule/expo-repo/blob/main/expo-app/metro.config.js) ``` config.resolver.unstable_enablePackageExports = true; config.resolver.unstable_enableSymlinks = true; ```  ``` iOS Bundling failed 756ms index.js (1013 modules) Unable to resolve "@internal/another-dep/hi" from "app/(tabs)/index.tsx" ```  Reproduction: https://github.com/franksmule/expo-repo - change https://github.com/franksmule/expo-repo/blob/main/package.json#L5 - to `0.80.10` and notice bundle will load.

- **Issue #1211** (2026-10-03): **React Native application does not update on many code changes when using vim**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?** *bug*  **What is the current behavior?** Newly-created React Native app doesn't reflect every code change during development when using Metro. The behavior is intermittent. Some code changes will be reflected in the app, then some won't be after saving the file. None of the following work to "force" an update:  * Saving the file repeatedly. * Hitting the "r" key to force reload in the Metro terminal window * Hitting the "r" key on the emulator to get it to reload. * Running with `--reset-cache`.  It looks minor, but it's really disruptive to development, since when I'm debugging, I can't tell which version of the app is currently being displayed. The only "workaround" I have is to add unique `console.log()` statements until one of them appears in the terminal that matches what I last wrote.  Usually the first code change is reflected after starting Metro. After that it's totally it or miss. I might get two or three successful updates in a row, and then none for a while.  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.**  1. Create a new React Native+metro application

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

### Incident Patch 1: `a33cc669` (2026-10-06)
**Commit Message**: metro-file-map: Fix recrawl of a directory that replaced a file or symlink (#2009)

## Bugs in `getDifference`

`getDifference` is used in two places, at startup and on a mid-session `'recrawl'`, to reconcile new state with old. This affects `'recrawl'` only. Watchers emit `'recrawl'` events when a directory is moved or hard-linked into the project, and the watcher alone can't determine the contents.

 The bug occurs when a fresh directory appears where the previous state holds a file (or symlink) of the same name.

https://github.com/react/metro/blob/818594effd02842bb56569c639a24171b53bd209/packages/metro-file-map/src/lib/TreeFS.js#L180-L186

There are actually two bugs here:
1. We're using `followLeaf` incorrectly - we shouldn't be following here:
    - A working symlink pointing to a directory in the file map will result in the symlink's target being compared with the new crawl result, which is totally wrong and will report incorrectly that all of the symlink's target's contents have been deleted.
    - A broken symlink or a link to outside the watched roots will return a `exists: false` when looked up with `followLeaf`, and so will never be removed when replaced by a directory 

**File**: `packages/metro-file-map/src/lib/TreeFS.js` (modified, +8/-2)
```diff
@@ -178,12 +178,18 @@ export default class TreeFS implements MutableFileSystem {
     let prefix: string = '';
     if (subpath != null && subpath !== '') {
       const lookupResult = this.#lookupByNormalPath(subpath, {
-        followLeaf: true,
+        followLeaf: false,
       });
-      if (!lookupResult.exists || !isDirectory(lookupResult.node)) {
+      if (!lookupResult.exists) {
         // Directory doesn't exist, nothing to compare - all files are new
         return {changedFiles, removedFiles};
       }
+      if (!isDirectory(lookupResult.node)) {
+        // A file or symlink has been replaced by this directory, so it is
+        // removed and everything under the directory is new.
+        removedFiles.add(lookupResult.canonicalPath);
+        return {changedFiles, removedFiles};
+      }
       rootNode = lookupResult.node;
       prefix = lookupResult.canonicalPath;
     }
```

**File**: `packages/metro-file-map/src/lib/__tests__/TreeFS-test.js` (modified, +17/-0)
```diff
@@ -447,6 +447,23 @@ describe.each([['win32'], ['posix']])('TreeFS on %s', platform => {
       });
     });
 
+    test.each([
+      ['regular file', p('bar.js'), p('bar.js/file.js')],
+      ['symlink', p('link-to-foo'), p('link-to-foo/file.js')],
+    ])(
+      'with subpath of a %s replaced by a directory removes it, and returns all as new',
+      (_, subpath, filePath) => {
+        const newFiles: FileData = new Map<CanonicalPath, FileMetadata>([
+          [filePath, [123, 0, 0, null, 0, null]],
+        ]);
+
+        expect(tfs.getDifference(newFiles, {subpath})).toEqual({
+          changedFiles: newFiles,
+          removedFiles: new Set([subpath]),
+        });
+      },
+    );
+
     test('with empty subpath behaves like no subdirectory specified', () => {
       const newFiles: FileData = new Map<CanonicalPath, FileMetadata>([
         [p('foo/another.js'), [123, 0, 0, null, 0, null]],
```

---

### Incident Patch 2: `ded095db` (2026-10-14)
**Commit Message**: Graph: Carry require.context inputs as a VirtualSource (#2041)

`Graph` threads a `RequireContext` per module from `buildSubgraph` through commit, snapshots and release, so that the transformer can render a context module's template. It's the one place Metro carries a transform's input on a dependency edge rather than reading it from disk.

This generalises that slot to `VirtualSource`, a tagged union whose only arm for now is a `require.context`'s parameters, so that a virtual module's source can travel the same way (https://github.com/react/metro/pull/2036) rather than through a second mechanism beside it. `ModuleData.resolvedContexts` becomes `virtualSources`, and `markModifiedContextModules` only considers context entries.

Changelog: Internal

**File**: `packages/metro/src/DeltaBundler/Graph.js` (modified, +24/-22)
```diff
@@ -29,7 +29,6 @@
  *    nodes and entries in the importBundleNodes set.
  */
 
-import type {RequireContext} from '../lib/contextModule';
 import type {RequireContextParams} from '../ModuleGraph/worker/collectDependencies';
 import type {
   Dependencies,
@@ -41,6 +40,7 @@ import type {
   Options,
   ResolvedDependency,
   TransformInputOptions,
+  VirtualSource,
 } from './types';
 
 import {fileMatchesContext} from '../lib/contextModule';
@@ -149,8 +149,11 @@ export class Graph<T = MixedOutput> {
     possibleCycleRoots: new Set(),
   };
 
-  /** Resolved context parameters from `require.context`. */
-  #resolvedContexts: Map<string, RequireContext> = new Map();
+  /**
+   * Sources of the modules in the graph that have no file, keyed by module
+   * path.
+   */
+  #virtualSources: Map<string, VirtualSource> = new Map();
 
   constructor(options: GraphInputOptions) {
     this.entryPoints = options.entryPoints;
@@ -348,17 +351,17 @@ export class Graph<T = MixedOutput> {
     options: InternalOptions<T>,
     moduleFilter?: (path: string) => boolean,
   ): Promise<Delta<T>> {
-    const subGraph = await buildSubgraph(pathsToVisit, this.#resolvedContexts, {
+    const subGraph = await buildSubgraph(pathsToVisit, this.#virtualSources, {
       resolve: options.resolve,
       shouldTraverse: (dependency: ResolvedDependency) => {
         if (options.shallow || isWeakOrLazy(dependency, options)) {
           return false;
         }
         return moduleFilter == null || moduleFilter(dependency.absolutePath);
       },
-      transform: async (absolutePath, requireContext) => {
+      transform: async (absolutePath, virtualSource) => {
         options.onDependencyAdd();
-        const result = await options.transform(absolutePath, requireContext);
+        const result = await options.transform(absolutePath, virtualSource);
         options.onDependencyAdded();
         return result;
       },
@@ -394,7 +397,7 @@ export class Graph<T = MixedOutput> {
     const previousDependencies = previousModule?.dependencies ?? new Map();
     const {
       dependencies: currentDependencies,
-      resolvedContexts,
+      virtualSources,
       ...transformResult
     } = currentModule;
 
@@ -449,7 +452,7 @@ export class Graph<T = MixedOutput> {
             nextModule,
             key,
             curDependency,
-            resolvedContexts.get(key),
+            virtualSources.get(key),
             delta,
             options,
           );
@@ -507,7 +510,7 @@ export class Graph<T = MixedOutput> {
     parentModule: Module<T>,
     key: string,
     dependency: Dependency,
-    requireContext: ?RequireContext,
+    virtualSource: ?VirtualSource,
     delta: Delta<T>,
     options: InternalOptions<T>,
   ): void {
@@ -555,12 +558,12 @@ export class Graph<T = MixedOutput> {
 
     if (isResolvedDependency(dependency)) {
       const path = dependency.absolutePath;
-      if (requireContext) {
-        this.#resolvedContexts.set(path, requireContext);
+      if (virtualSource) {
+        this.#virtualSources.set(path, virtualSource);
       } else {
         // This dependency may have existed previously as a require.context -
         // clean it up.
-        this.#resolvedContexts.delete(path);
+        this.#virtualSources.delete(path);
       }
     }
 
@@ -623,10 +626,11 @@ export class Graph<T = MixedOutput> {
     filePath: string,
     modifiedPaths: Set<string> | CountingSet<string>,
   ) {
-    for (const [absolutePath, context] of this.#resolvedContexts) {
+    for (const [absolutePath, virtualSource] of this.#virtualSources) {
       if (
+        virtualSource.type === 'requireContext' &&
         !modifiedPaths.has(absolutePath) &&
-        fileMatchesContext(filePath, context)
+        fileMatchesContext(filePath, virtualSource.requireContext)
       ) {
         modifiedPaths.add(absolutePath);
       }
@@ -761,23 +765,21 @@ export class Graph<T = MixedOutput> {
     const {dependencies, getSource, output, unstable_transformResultKey} =
       module;
 
-    const resolvedContexts: Map<string, RequireContext> = new Map();
+    const virtualSources: Map<string, VirtualSource> = new Map();
     for (const [key, dependency] of dependencies) {
       if (!isResolvedDependency(dependency)) {
         continue;
       }
-      const resolvedContext = this.#resolvedContexts.get(
-        dependency.absolutePath,
-      );
-      if (resolvedContext != null) {
-        resolvedContexts.set(key, resolvedContext);
+      const virtualSource = this.#virtualSources.get(dependency.absolutePath);
+      if (virtualSource != null) {
+        virtualSources.set(key, virtualSource);
       }
     }
     return {
       dependencies: new Map(dependencies),
       getSource,
       output,
-      resolvedContexts,
+      virtualSources,
       unstable_transformResultKey,
     };
   }
@@ -828,7 +830,7 @@ export class Graph<T = MixedOutput> {
     this.dependencies.delete(module.path);
     this.#gc.possibleCycleRo
```

**File**: `packages/metro/src/DeltaBundler/__tests__/Graph-test.js` (modified, +20/-14)
```diff
@@ -32,7 +32,6 @@
  *   boxes/lines as needed).
  */
 
-import type {RequireContext} from '../../lib/contextModule';
 import type {RequireContextParams} from '../../ModuleGraph/worker/collectDependencies';
 import type {Result} from '../Graph';
 import type {
@@ -46,6 +45,7 @@ import type {
   TransformFn,
   TransformResultDependency,
   TransformResultWithSource,
+  VirtualSource,
 } from '../types';
 
 import {deriveAbsolutePathFromContext} from '../../lib/contextModule';
@@ -357,10 +357,10 @@ beforeEach(async () => {
 
   mockTransform = jest
     .fn<
-      [string, ?RequireContext],
+      [string, ?VirtualSource],
       Promise<TransformResultWithSource<MixedOutput>>,
     >()
-    .mockImplementation(async (path: string, context: ?RequireContext) => {
+    .mockImplementation(async (path: string, context: ?VirtualSource) => {
       const override = transformOverrides.get(path);
       if (override != null) {
         return override(path, context);
@@ -556,7 +556,7 @@ test('should retry traversing dependencies after a transform error', async () =>
 
   const localOptions = {
     ...options,
-    transform(path: string, context: ?RequireContext) {
+    transform(path: string, context: ?VirtualSource) {
       if (path === '/bad') {
         throw new BadError();
       }
@@ -2351,7 +2351,7 @@ describe('edge cases', () => {
       let fastResolved = false;
 
       localMockTransform.mockImplementation(
-        async (path: string, context: ?RequireContext) => {
+        async (path: string, context: ?VirtualSource) => {
           const result = await mockTransform(path, context);
 
           if (path === slowPath && !fastResolved) {
@@ -2967,10 +2967,13 @@ describe('require.context', () => {
   };
 
   const ctxResolved = {
-    recursive: true,
-    mode: 'sync',
-    filter: /.*/,
-    from: p('/ctx'),
+    type: 'requireContext',
+    requireContext: {
+      recursive: true,
+      mode: 'sync',
+      filter: /.*/,
+      from: p('/ctx'),
+    },
   };
 
   const ctxPath = deriveAbsolutePathFromContext(p('/ctx'), ctxParams);
@@ -3301,10 +3304,13 @@ describe('require.context', () => {
     };
 
     const narrowCtxResolved = {
-      recursive: true,
-      mode: 'sync',
-      filter: /\.\/narrow\/.*/,
-      from: p('/ctx'),
+      type: 'requireContext',
+      requireContext: {
+        recursive: true,
+        mode: 'sync',
+        filter: /\.\/narrow\/.*/,
+        from: p('/ctx'),
+      },
     };
 
     const narrowCtxPath = deriveAbsolutePathFromContext(
@@ -3592,7 +3598,7 @@ describe('optional dependencies', () => {
   const createMockTransform = (notOptional?: string[]) => {
     /* $FlowFixMe[missing-this-annot] The 'this' type annotation(s) required by
      * Flow's LTI update could not be added via codemod */
-    return async function (path: string, context: ?RequireContext) {
+    return async function (path: string, context: ?VirtualSource) {
       const result = await mockTransform.call(this, path, context);
       return {
         ...result,
```

**File**: `packages/metro/src/DeltaBundler/__tests__/buildSubgraph-test.js` (modified, +12/-6)
```diff
@@ -117,7 +117,7 @@ describe('GraphTraversal', () => {
       ]),
       getSource: expect.any(Function),
       output: [],
-      resolvedContexts: new Map(),
+      virtualSources: new Map(),
     });
   });
 
@@ -139,7 +139,7 @@ describe('GraphTraversal', () => {
     };
     expect(params.transform).toHaveBeenCalledWith(
       p('/virtual?ctx=af3bf59b8564d441084c02bdf04c4d662d74d3bd'),
-      expectedResolvedContext,
+      {type: 'requireContext', requireContext: expectedResolvedContext},
     );
     expect(params.transform).toHaveBeenCalledWith(
       p('/contextMatch'),
@@ -167,8 +167,14 @@ describe('GraphTraversal', () => {
                 },
               ],
             ]),
-            resolvedContexts: new Map([
-              ['key-virtual', expectedResolvedContext],
+            virtualSources: new Map([
+              [
+                'key-virtual',
+                {
+                  type: 'requireContext',
+                  requireContext: expectedResolvedContext,
+                },
+              ],
             ]),
             output: [],
             getSource: expect.any(Function),
@@ -178,7 +184,7 @@ describe('GraphTraversal', () => {
           p('/contextMatch'),
           {
             dependencies: new Map(),
-            resolvedContexts: new Map(),
+            virtualSources: new Map(),
             output: [],
             getSource: expect.any(Function),
           },
@@ -201,7 +207,7 @@ describe('GraphTraversal', () => {
                 },
               ],
             ]),
-            resolvedContexts: new Map(),
+            virtualSources: new Map(),
             output: [],
             getSource: expect.any(Function),
           },
```

**File**: `packages/metro/src/DeltaBundler/buildSubgraph.js` (modified, +13/-9)
```diff
@@ -16,6 +16,7 @@ import type {
   ResolveFn,
   TransformFn,
   TransformResultDependency,
+  VirtualSource,
 } from './types';
 
 import {deriveAbsolutePathFromContext} from '../lib/contextModule';
@@ -34,10 +35,10 @@ function resolveDependencies(
   resolve: ResolveFn,
 ): {
   dependencies: Map<string, Dependency>,
-  resolvedContexts: Map<string, RequireContext>,
+  virtualSources: Map<string, VirtualSource>,
 } {
   const maybeResolvedDeps = new Map<string, Dependency>();
-  const resolvedContexts = new Map<string, RequireContext>();
+  const virtualSources = new Map<string, VirtualSource>();
 
   for (const dep of dependencies) {
     let maybeResolvedDep: Dependency;
@@ -61,7 +62,10 @@ function resolveDependencies(
         recursive: contextParams.recursive,
       };
 
-      resolvedContexts.set(key, resolvedContext);
+      virtualSources.set(key, {
+        type: 'requireContext',
+        requireContext: resolvedContext,
+      });
 
       maybeResolvedDep = {
         absolutePath,
@@ -95,13 +99,13 @@ function resolveDependencies(
 
   return {
     dependencies: maybeResolvedDeps,
-    resolvedContexts,
+    virtualSources,
   };
 }
 
 export async function buildSubgraph<T>(
   entryPaths: ReadonlySet<string>,
-  resolvedContexts: ReadonlyMap<string, ?RequireContext>,
+  virtualSources: ReadonlyMap<string, ?VirtualSource>,
   {resolve, transform, shouldTraverse}: Parameters<T>,
 ): Promise<{
   moduleData: Map<string, ModuleData<T>>,
@@ -113,13 +117,13 @@ export async function buildSubgraph<T>(
 
   async function visit(
     absolutePath: string,
-    requireContext: ?RequireContext,
+    virtualSource: ?VirtualSource,
   ): Promise<void> {
     if (visitedPaths.has(absolutePath)) {
       return;
     }
     visitedPaths.add(absolutePath);
-    const transformResult = await transform(absolutePath, requireContext);
+    const transformResult = await transform(absolutePath, virtualSource);
 
     // Get the absolute path of all sub-dependencies (some of them could have been
     // moved but maintain the same relative path).
@@ -143,15 +147,15 @@ export async function buildSubgraph<T>(
         .map(dependency =>
           visit(
             dependency.absolutePath,
-            resolutionResult.resolvedContexts.get(dependency.data.data.key),
+            resolutionResult.virtualSources.get(dependency.data.data.key),
           ).catch(error => errors.set(dependency.absolutePath, error)),
         ),
     );
   }
 
   await Promise.all(
     [...entryPaths].map(absolutePath =>
-      visit(absolutePath, resolvedContexts.get(absolutePath)).catch(error =>
+      visit(absolutePath, virtualSources.get(absolutePath)).catch(error =>
         errors.set(absolutePath, error),
       ),
     ),
```

**File**: `packages/metro/src/DeltaBundler/types.js` (modified, +13/-2)
```diff
@@ -90,9 +90,20 @@ export type Module<T = MixedOutput> = Readonly<{
   unstable_transformResultKey?: ?string,
 }>;
 
+/**
+ * How the transform obtains the source of a module that has no file, as
+ * supplied by the resolution that produced it. A `require.context` module
+ * arrives as the parameters the transform expands by enumerating the file map.
+ */
+export type VirtualSource = Readonly<{
+  type: 'requireContext',
+  requireContext: RequireContext,
+}>;
+
 export type ModuleData<T = MixedOutput> = Readonly<{
   dependencies: ReadonlyMap<string, Dependency>,
-  resolvedContexts: ReadonlyMap<string, RequireContext>,
+  /** Keyed by dependency key, for the dependencies that resolved to a module with no file. */
+  virtualSources: ReadonlyMap<string, VirtualSource>,
   output: ReadonlyArray<T>,
   getSource: () => Buffer,
   unstable_transformResultKey?: ?string,
@@ -137,7 +148,7 @@ export type TransformResultWithSource<T = MixedOutput> = Readonly<{
 
 export type TransformFn<T = MixedOutput> = (
   string,
-  ?RequireContext,
+  ?VirtualSource,
 ) => Promise<TransformResultWithSource<T>>;
 
 export type ResolveFn = (
```

**File**: `packages/metro/src/lib/transformHelpers.js` (modified, +7/-6)
```diff
@@ -15,10 +15,10 @@ import type {
   BundlerResolution,
   TransformInputOptions,
   TransformResultDependency,
+  VirtualSource,
 } from '../DeltaBundler/types';
 import type {TransformOptions} from '../DeltaBundler/Worker';
 import type {ResolverInputOptions} from '../shared/types';
-import type {RequireContext} from './contextModule';
 import type {ConfigT} from 'metro-config';
 import type {Type} from 'metro-transform-worker';
 
@@ -152,10 +152,11 @@ export async function getTransformFn(
   );
   const assetExts = new Set(config.resolver.assetExts);
 
-  return async (modulePath: string, requireContext: ?RequireContext) => {
-    let templateBuffer: Buffer;
+  return async (modulePath: string, virtualSource: ?VirtualSource) => {
+    let fileBuffer: ?Buffer;
 
-    if (requireContext) {
+    if (virtualSource?.type === 'requireContext') {
+      const {requireContext} = virtualSource;
       const graph = await bundler.getDependencyGraph();
 
       // TODO: Check delta changes to avoid having to look over all files each time
@@ -175,7 +176,7 @@ export async function getTransformFn(
         files,
       );
 
-      templateBuffer = Buffer.from(template);
+      fileBuffer = Buffer.from(template);
     }
 
     return await bundler.transformFile(
@@ -188,7 +189,7 @@ export async function getTransformFn(
         ),
         type: getType(transformOptions.type, modulePath, assetExts),
       },
-      templateBuffer,
+      fileBuffer ?? undefined,
     );
   };
 }
```

---

### Incident Patch 3: `60903e64` (2026-10-07)
**Commit Message**: DeltaCalculator: Apply changes made during a (failed or successful) build on top (#2007)

* DeltaCalculator: Apply changes made during a failed build on top

When a delta build fails, getDelta put back the change sets it took as a
plain union with the changes that arrived during the build. A file deleted
before the build and recreated during it then sat in both the added and the
deleted set and was skipped by the next delta, so the client kept the old
module; a file modified before the build and deleted during it was
traversed after its deletion.

The taken sets are now restored as the base, and the later changes are
replayed on top through the transitions the change handler uses.

* DeltaCalculator: Revisit a file recreated while a build was in flight

A file deleted before a build and recreated before its importer re-resolves it leaves the build green with the graph still holding the old module. The recreated file then only ever sits in the added set, which nothing traverses, so the client keeps stale code until the file changes again.

An added file that already has a module in the graph can only be one the graph never saw deleted, so it is now treated as modified and revisited 

**File**: `packages/metro/src/DeltaBundler/DeltaCalculator.js` (modified, +52/-26)
```diff
@@ -147,9 +147,17 @@ export default class DeltaCalculator<T> extends EventEmitter {
       // processed (since we haven't actually created any delta). If we do not
       // do so, asking for a delta after an error will produce an empty Delta,
       // which is not correct.
-      modifiedFiles.forEach((file: string) => this._modifiedFiles.add(file));
-      deletedFiles.forEach((file: string) => this._deletedFiles.add(file));
-      addedFiles.forEach((file: string) => this._addedFiles.add(file));
+      // Changes that arrived while this delta was being built happened after
+      // the ones it took, so they are applied on top of them.
+      const laterAddedFiles = this._addedFiles;
+      const laterModifiedFiles = this._modifiedFiles;
+      const laterDeletedFiles = this._deletedFiles;
+      this._addedFiles = addedFiles;
+      this._modifiedFiles = modifiedFiles;
+      this._deletedFiles = deletedFiles;
+      laterAddedFiles.forEach((file: string) => this.#markAdded(file));
+      laterModifiedFiles.forEach((file: string) => this.#markModified(file));
+      laterDeletedFiles.forEach((file: string) => this.#markDeleted(file));
 
       throw error;
     } finally {
@@ -199,51 +207,60 @@ export default class DeltaCalculator<T> extends EventEmitter {
     return false;
   }
 
+  // Deleted+added = modified, otherwise added.
+  #markAdded(absolutePath: string): void {
+    if (this._deletedFiles.has(absolutePath)) {
+      this._deletedFiles.delete(absolutePath);
+      this._modifiedFiles.add(absolutePath);
+    } else {
+      this._addedFiles.add(absolutePath);
+      this._modifiedFiles.delete(absolutePath);
+    }
+  }
+
+  // Added+modified stays added, otherwise modified.
+  #markModified(absolutePath: string): void {
+    if (!this._addedFiles.has(absolutePath)) {
+      this._modifiedFiles.add(absolutePath);
+    }
+    this._deletedFiles.delete(absolutePath);
+  }
+
+  // Added+deleted = no change, otherwise deleted.
+  #markDeleted(absolutePath: string): void {
+    if (this._addedFiles.has(absolutePath)) {
+      this._addedFiles.delete(absolutePath);
+    } else {
+      this._deletedFiles.add(absolutePath);
+      this._modifiedFiles.delete(absolutePath);
+    }
+  }
+
   _handleMultipleFileChanges = (changeEvent: ChangeEvent) => {
     const {changes, logger, rootDir} = changeEvent;
 
-    // Process added files: deleted+added = modified, otherwise added
     for (const [canonicalPath, metadata] of changes.addedFiles) {
       debug('Handling add: %s', canonicalPath);
       if (this.#shouldReset(canonicalPath, metadata)) {
         this._requiresReset = true;
       }
-      const absolutePath = path.join(rootDir, canonicalPath);
-      if (this._deletedFiles.has(absolutePath)) {
-        this._deletedFiles.delete(absolutePath);
-        this._modifiedFiles.add(absolutePath);
-      } else {
-        this._addedFiles.add(absolutePath);
-        this._modifiedFiles.delete(absolutePath);
-      }
+      this.#markAdded(path.join(rootDir, canonicalPath));
     }
 
-    // Process modified files: added+modified stays added, otherwise modified
     for (const [canonicalPath, metadata] of changes.modifiedFiles) {
       debug('Handling change: %s', canonicalPath);
       if (this.#shouldReset(canonicalPath, metadata)) {
         this._requiresReset = true;
       }
-      const absolutePath = path.join(rootDir, canonicalPath);
-      if (!this._addedFiles.has(absolutePath)) {
-        this._modifiedFiles.add(absolutePath);
-      }
-      this._deletedFiles.delete(absolutePath);
+      this.#markModified(path.join(rootDir, canonicalPath));
     }
 
-    // Process removed files: added+deleted = no change, otherwise deleted
     for (const [canonicalPath, metadata] of changes.removedFiles) {
       debug('Handling delete: %s', canonicalPath);
       if (this.#shouldReset(canonicalPath, metadata)) {
         this._requiresReset = true;
       }
-      const absolutePath = path.resolve(rootDir, canonicalPath);
-      if (this._addedFiles.has(absolutePath)) {
-        this._addedFiles.delete(absolutePath);
-      } else {
-        this._deletedFiles.add(absolutePath);
-        this._modifiedFiles.delete(absolutePath);
-      }
+      this.#markDeleted(path.resolve(rootDir, canonicalPath));
     }
 
     let changeId = changeEventIds.get(changeEvent);
@@ -287,6 +304,15 @@ export default class DeltaCalculator<T> extends EventEmitter {
       }
     });
 
+    // An added file that already has a module in the graph was deleted and
+    // recreated while a build was in flight. The graph never saw the deletion,
+    // so the module it holds is stale and needs revisiting.
+    addedFiles.forEach((filePath: string) => {
+      if (this._graph.dependencies.has(filePath)) {
+        modifiedFiles.add(filePath);
+      }
+    });
+
     // NOTE(EvanBacon): This check adds extra complexity so we feature gate it
     // to enable users to opt out.
     if (this._options.unstable_allowRequireContext) {
```

**File**: `packages/metro/src/DeltaBundler/__tests__/DeltaCalculator-test.js` (modified, +98/-1)
```diff
@@ -304,7 +304,7 @@ describe.each(['posix', 'win32'])('DeltaCalculator (%s)', osPlatform => {
   test('should calculate a delta after a file addition', async () => {
     await deltaCalculator.getDelta({reset: false, shallow: false});
 
-    emitChange({addedFiles: ['foo']});
+    emitChange({addedFiles: ['unrelated']});
 
     traverseDependencies.mockResolvedValueOnce({
       added: new Map([[p('/foo'), fooModule]]),
@@ -566,6 +566,103 @@ describe.each(['posix', 'win32'])('DeltaCalculator (%s)', osPlatform => {
     expect(traverseDependencies.mock.calls[0][0]).toEqual([p('/foo')]);
   });
 
+  test('should traverse a file re-added while a failed delta was being built', async () => {
+    await deltaCalculator.getDelta({reset: false, shallow: false});
+
+    emitChange({removedFiles: ['foo']});
+
+    let rejectTraversal: (error: Error) => void = () => {};
+    traverseDependencies.mockReturnValueOnce(
+      new Promise((resolve, reject) => {
+        rejectTraversal = reject;
+      }),
+    );
+    const failedDelta = deltaCalculator.getDelta({
+      reset: false,
+      shallow: false,
+    });
+
+    // The file is recreated while the delta that saw it deleted is still being built.
+    emitChange({addedFiles: ['foo']});
+    rejectTraversal(new Error('Unable to resolve module'));
+    await expect(failedDelta).rejects.toBeInstanceOf(Error);
+
+    traverseDependencies.mockResolvedValueOnce({
+      added: new Map(),
+      modified: new Map([[p('/foo'), fooModule]]),
+      deleted: new Set(),
+    });
+    await deltaCalculator.getDelta({reset: false, shallow: false});
+
+    expect(traverseDependencies).toHaveBeenCalledTimes(2);
+    expect(traverseDependencies.mock.calls[1][0]).toContain(p('/foo'));
+  });
+
+  test('should not traverse a file deleted while a failed delta was being built', async () => {
+    await deltaCalculator.getDelta({reset: false, shallow: false});
+
+    emitChange({modifiedFiles: ['foo']});
+
+    let rejectTraversal: (error: Error) => void = () => {};
+    traverseDependencies.mockReturnValueOnce(
+      new Promise((resolve, reject) => {
+        rejectTraversal = reject;
+      }),
+    );
+    const failedDelta = deltaCalculator.getDelta({
+      reset: false,
+      shallow: false,
+    });
+
+    emitChange({removedFiles: ['foo']});
+    rejectTraversal(new Error('Unable to resolve module'));
+    await expect(failedDelta).rejects.toBeInstanceOf(Error);
+
+    traverseDependencies.mockResolvedValueOnce({
+      added: new Map(),
+      modified: new Map([[p('/bundle'), entryModule]]),
+      deleted: new Set([p('/foo')]),
+    });
+    await deltaCalculator.getDelta({reset: false, shallow: false});
+
+    expect(traverseDependencies).toHaveBeenCalledTimes(2);
+    expect(traverseDependencies.mock.calls[1][0]).toEqual([p('/bundle')]);
+  });
+
+  test('should traverse a file re-added while a successful delta was being built', async () => {
+    await deltaCalculator.getDelta({reset: false, shallow: false});
+
+    emitChange({removedFiles: ['foo']});
+
+    let resolveTraversal: (result: Result<$FlowFixMe>) => void = () => {};
+    traverseDependencies.mockReturnValueOnce(
+      new Promise(resolve => {
+        resolveTraversal = resolve;
+      }),
+    );
+    const delta = deltaCalculator.getDelta({reset: false, shallow: false});
+
+    // The file is recreated before its importer re-resolves it, so the build
+    // succeeds without revisiting the module the graph already holds.
+    emitChange({addedFiles: ['foo']});
+    resolveTraversal({
+      added: new Map(),
+      modified: new Map([[p('/bundle'), entryModule]]),
+      deleted: new Set(),
+    });
+    await delta;
+
+    traverseDependencies.mockResolvedValueOnce({
+      added: new Map(),
+      modified: new Map([[p('/foo'), fooModule]]),
+      deleted: new Set(),
+    });
+    await deltaCalculator.getDelta({reset: false, shallow: false});
+
+    expect(traverseDependencies).toHaveBeenCalledTimes(2);
+    expect(traverseDependencies.mock.calls[1][0]).toEqual([p('/foo')]);
+  });
+
   test.each(['add', 'delete'])(
     "should re-traverse everything after a symlink '%s'",
     async eventType => {
```

#### Recent Merged Pull Requests:
- **PR #2074** (2026-10-17): Resolver: Fall through unmatched nested conditions (@maximilliangrand)
- **PR #2073** (2026-10-16): Deploy 0.336.0 to xplat (#2073) (@gkz)
- **PR #2071** (2026-10-15): metro-file-map: Let plugin filters decide on node_modules files (@robhogan)
- **PR #2069** (2026-10-14): Use `any` for untyped `Object`/`Function` in flow-typed and debugger-shell (@SamChou19815)
- **PR #2068** (2026-10-14): Use `any` where Flow `Object`/`Function` meant `any` (#2068) (@SamChou19815)
- **PR #2067** (2026-10-14): `Function` and `Object` -> `any` in node.js libdefs (@SamChou19815)

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

## X. metro-file-map: Fix recrawl of a directory that replaced a file or symlink (#200

**RULE**:
When implementing operations in `packages/metro-file-map/src/lib/TreeFS.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/metro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a33cc669`: metro-file-map: Fix recrawl of a directory that replaced a file or symlink (#2009). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/metro-file-map/src/lib/TreeFS.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
        followLeaf: false,
      if (!lookupResult.exists) {
      if (!isDirectory(lookupResult.node)) {
        // A file or symlink has been replaced by this directory, so it is
        // removed and everything under the directory is new.
        removedFiles.add(lookupResult.canonicalPath);
        return {changedFiles, removedFiles};
      }
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
        followLeaf: true,
      if (!lookupResult.exists || !isDirectory(lookupResult.node)) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a33cc669` are properly handled with clean fallback behavior.
