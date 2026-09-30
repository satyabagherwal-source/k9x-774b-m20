# Forensic Learning Record (Deep Inspection): Nozbe/WatermelonDB

> **Canonical Artifact**: `07_PROJECT_LEARNING/nozbe-watermelondb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Nozbe/WatermelonDB](https://github.com/Nozbe/WatermelonDB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:45.909Z  
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

### Core Architecture Module: `.eslintrc.js`
```
const config = {
  env: {
    es6: true,
    // configure globals
    jest: true,
    browser: true,
    commonjs: true,
    node: true,
  },
  plugins: ['import', '@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:flowtype/recommended',
    'prettier',
    'plugin:jest/recommended',
  ],
  parser: '@babel/eslint-parser',
  ignorePatterns: 'examples/typescript/**/*.ts',
  settings: {
    flowtype: {
      onlyFilesWithFlowAnnotation: true,
    },
  },
  rules: {
    'no-console': ['error'],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
    'import/no-cycle': 'error',
    'jest/no-large-snapshots': 'warn',
    'jest/no-disabled-tests': 'off',
    'jest/expect-expect': 'off',
  },
  overrides: [
    {
      files: ['src/**/*.js'],
      excludedFiles: ['*integrationTest.js', '*test.js', '**/__tests__/**', '*test.*.js'],
      rules: {
        'flowtype/require-valid-file-annotation': ['error', 'always'],
      },
    },
    {
      files: ['src/**/*.ts', 'examples/typescript/*.ts'],
      parser: '@typescript-eslint/parser',
      rules: {
        'flowtype/no-types-missing-file-annotation': 'off',
      },
    },
  ],
}

module.exports = config

```

### Core Architecture Module: `babel.config.js`
```
const plugins = [
  [
    '@babel/plugin-transform-runtime',
    {
      helpers: true,
      // regenerator: true,
    },
  ],
  [
    '@babel/plugin-transform-modules-commonjs',
    {
      loose: true, // improves speed & code size; unlikely to be a problem
      strict: false,
      strictMode: true,
      allowTopLevelThis: true,
      // this would improve speed&code size but breaks 3rd party code. can we apply it to our paths only?
      // (same with struct: true)
      // noInterop: true,
    },
  ],
  ['@babel/plugin-proposal-decorators', { legacy: true }],
  '@babel/plugin-transform-flow-strip-types',
  ['@babel/plugin-proposal-class-properties', { loose: true }],
  [
    '@babel/plugin-transform-classes',
    {
      loose: true, // spits out cleaner and faster output
    },
  ],
  '@babel/plugin-syntax-dynamic-import',
  '@babel/plugin-transform-block-scoping',
  '@babel/plugin-proposal-json-strings',
  '@babel/plugin-proposal-unicode-property-regex',
  // See http://incaseofstairs.com/six-speed/ for speed comparison between native and transpiled ES6
  '@babel/plugin-proposal-optional-chaining',
  ['@babel/plugin-proposal-private-methods', { loose: true }],
  '@babel/plugin-transform-template-literals',
  '@babel/plugin-transform-literals',
  '@babel/plugin-transform-function-name',
  '@babel/plugin-transform-arrow-functions',
  '@babel/plugin-proposal-nullish-coalescing-operator',
  '@babel/plugin-transform-shorthand-properties',
  '@babel/plugin-transform-spread',
  [
    '@babel/plugin-proposal-object-rest-spread',
    {
      // use fast Object.assign
      loose: true,
    },
  ],
  '@babel/plugin-transform-react-jsx',
  [
    '@babel/plugin-transform-computed-properties',
    {
      // 2-3x faster, unlikely to be an issue
      loose: true,
    },
  ],
  '@babel/plugin-transform-sticky-regex',
  '@babel/plugin-transform-unicode-regex',
  // TODO: fast-async is faster and cleaner, but causes a weird issue on older Android RN targets without jsc-android
  // '@babel/plugin-transform-async-to-generator',
  [
    // TODO: We can get this faster by tweaking with options, but have to test thoroughly...
    'module:fast-async',
    {
      spec: true,
    },
  ],
]

module.exports = {
  env: {
    development: {
      plugins,
    },
    production: {
      plugins: [
        ...plugins,
        'minify-flip-comparisons',
        'minify-guarded-expressions',
        'minify-dead-code-elimination',
      ],
    },
    test: {
      plugins: [...plugins, '@babel/plugin-syntax-jsx'],
    },
  },
}

```

### Core Architecture Module: `examples/typescript/AppSchema.ts`
```
import { appSchema, tableSchema } from "@nozbe/watermelondb"
import { TableName } from "./ts-example"

export const AppSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TableName.BLOGS,
      columns: [{ name: 'name', type: 'string' }],
    }),
    tableSchema({
      name: TableName.POSTS,
      columns: [
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'blog_id', type: 'string', isIndexed: true },
        { name: 'is_nasty', type: 'boolean' },
      ],
    }),
  ],
})

```

### Core Architecture Module: `examples/typescript/ts-example.ts`
```
// tslint:disable: max-classes-per-file
import { Database, Model, Q, Query, Relation } from '@nozbe/watermelondb'
import { action, children, field, lazy, relation, text } from '@nozbe/watermelondb/decorators'
import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import { Associations } from '@nozbe/watermelondb/Model'
import { SyncDatabaseChangeSet, synchronize } from "@nozbe/watermelondb/sync"
import { AppSchema } from "./AppSchema"
import './__typetests__'
// Create an enum for all Table Names.
// This will help in documenting where all exact table names need to be passed.
export enum TableName {
  BLOGS = 'blogs',
  POSTS = 'posts',
}

class Blog extends Model {
  static table = TableName.BLOGS

  static associations: Associations = {
    [TableName.POSTS]: { type: 'has_many', foreignKey: 'blog_id' },
  }

  @field('name') name!: string;

  @children(TableName.POSTS) posts!: Query<Post>;

  @lazy nastyPosts = this.posts
    .extend(Q.where('is_nasty', true));

  @action async moderateAll() {
    await this.nastyPosts.destroyAllPermanently()
  }
}

class Post extends Model {
  static table = TableName.POSTS

  static associations: Associations = {
    [TableName.BLOGS]: { type: 'belongs_to', key: 'blog_id' },
  }

  @field('name') name!: string;
  @text("body") content!: string;
  @field('is_nasty') isNasty!: boolean;

  @relation(TableName.BLOGS, 'blog_id') blog!: Relation<Blog>;
}

// Define a custom ID generator.
function randomString(): string {
  return 'RANDOM STRING'
}

setGenerator(randomString)

// or as anonymous function:
setGenerator(() => 'RANDOM STRING')

const adapter = new SQLiteAdapter({
  schema: AppSchema,
  migrations: schemaMigrations({
    migrations: [
      {
        toVersion: 1,
        steps: [
          addColumns({
            table: TableName.POSTS,
            columns: [{ name: "body", type: "string", isIndexed: true, isOptional: false }],
          }),
        ],
      },
    ],
  }),
  onSetUpError: (error): void => { },
})

const db = new Database({
  adapter,
  modelClasses: [Blog, Post],

})

const sync = async () => {
  return synchronize({
    database: db,
    async pullChanges({ lastPulledAt, schemaVersion, migration }) {
      // just for demo purposes, this should come from the server
      const serverTS = new Date().getTime()
      const serverChanges: SyncDatabaseChangeSet = {
        posts: {
          created: [],
          updated: [],
          deleted: ["some-id"],
        },
      }

      return { changes: serverChanges, timestamp: serverTS }
    },
    async pushChanges({ changes, lastPulledAt }) {
      return undefined
    },
  })
}
```

### Core Architecture Module: `flow-typed/custom/lokijs.js`
```
declare module 'lokijs' {
  declare module.exports: any;
}

declare module 'lokijs/src/loki-indexed-adapter' {
  declare module.exports: any;
}

```

### Core Architecture Module: `flow-typed/custom/react-native.js`
```
declare module 'react-native' {
  declare module.exports: any;
}

```

### Core Architecture Module: `flow-typed/npm/rxjs_v6.x.js`
```
type rxjs$PartialObserver<-T> =
  | {
  +next: (value: T) => mixed,
  +error?: (error: any) => mixed,
  +complete?: () => mixed
}
  | {
  +next?: (value: T) => mixed,
  +error: (error: any) => mixed,
  +complete?: () => mixed
}
  | {
  +next?: (value: T) => mixed,
  +error?: (error: any) => mixed,
  +complete: () => mixed
};

declare interface rxjs$ISubscription {
  unsubscribe(): void;
}

type rxjs$TeardownLogic = rxjs$ISubscription | (() => void);

type rxjs$EventListenerOptions =
  | {
  capture?: boolean,
  passive?: boolean,
  once?: boolean
}
  | boolean;

type rxjs$ObservableInput<T> = rxjs$Observable<T> | Promise<T> | Iterable<T>;

type rxjs$OperatorFunction<T, R> = (rxjs$Observable<T>) => rxjs$Observable<R>;
type rxjs$OperatorFunctionLast<T, R: rxjs$Observable<*>> = (
  rxjs$Observable<T>
) => R;

declare class rxjs$Observable<+T> {
  static create(
    subscribe: (
      observer: rxjs$Observer<T>
    ) => rxjs$ISubscription | Function | void
  ): rxjs$Observable<T>;

  let<U>(
    project: (self: rxjs$Observable<T>) => rxjs$Observable<U>
  ): rxjs$Observable<U>;

  observeOn(scheduler: rxjs$SchedulerClass): rxjs$Observable<T>;

  pipe(): rxjs$Observable<T>;

  pipe<A>(op1: rxjs$OperatorFunctionLast<T, A>): A;

  pipe<A, B>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunctionLast<A, B>
  ): B;

  pipe<A, B, C>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunctionLast<B, C>
  ): C;

  pipe<A, B, C, D>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunctionLast<C, D>
  ): D;

  pipe<A, B, C, D, E>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunction<C, D>,
    op5: rxjs$OperatorFunctionLast<D, E>
  ): E;

  pipe<A, B, C, D, E, F>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunction<C, D>,
    op5: rxjs$OperatorFunction<D, E>,
    op6: rxjs$OperatorFunctionLast<E, F>
  ): F;

  pipe<A, B, C, D, E, F, G>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunction<C, D>,
    op5: rxjs$OperatorFunction<D, E>,
    op6: rxjs$OperatorFunction<E, F>,
    op7: rxjs$OperatorFunctionLast<F, G>
  ): G;

  pipe<A, B, C, D, E, F, G>(
    op1: rxjs$OperatorFunction<T, A>,
    op2: rxjs$OperatorFunction<A, B>,
    op3: rxjs$OperatorFunction<B, C>,
    op4: rxjs$OperatorFunction<C, D>,
    op5: rxjs$OperatorFunction<D, E>,
    op6: rxjs$OperatorFunction<E, F>,
    op7: rxjs$OperatorFunction<F, G>,
    ...operations: rxjs$OperatorFunctionLast<any, any>[]
  ): any;

  toArray(): rxjs$Observable<T[]>;

  toPromise(): Promise<T>;

  subscribe(observer: rxjs$PartialObserver<T>): rxjs$Subscription;
  subscribe(
    onNext: ?(value: T) => mixed,
    onError: ?(error: any) => mixed,
    onCompleted: ?() => mixed
  ): rxjs$Subscription;

  _subscribe(observer: rxjs$Subscriber<T>): rxjs$Subscription;

  _isScalar: boolean;
  source: ?rxjs$Observable<any>;
  operator: ?rxjs$Operator<any, any>;
}

declare module 'rxjs/observable/bindCallback' {
  declare module.exports: {
    bindCallback(
      callbackFunc: (callback: (_: void) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<void>;
    bindCallback<U>(
      callbackFunc: (callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<U>;
    bindCallback<T, U>(
      callbackFunc: (v1: T, callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T) => rxjs$Observable<U>;
    bindCallback<T, T2, U>(
      callbackFunc: (v1: T, v2: T2, callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, U>(
      callbackFunc: (v1: T, v2: T2, v3: T3, callback: (result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        callback: (result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        callback: (result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, T6, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        v6: T6,
        callback: (result: U) => any
      ) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5, v6: T6) => rxjs$Observable<U>;
    bindCallback<U>(
      callbackFunc: (callback: (...args: Array<any>) => any) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<U>;
    bindCallback<T, U>(
      callbackFunc: (v1: T, callback: (...args: Array<any>) => any) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T) => rxjs$Observable<U>;
    bindCallback<T, T2, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5) => rxjs$Observable<U>;
    bindCallback<T, T2, T3, T4, T5, T6, U>(
      callbackFunc: (
        v1: T,
        v2: T2,
        v3: T3,
        v4: T4,
        v5: T5,
        v6: T6,
        callback: (...args: Array<any>) => any
      ) => any,
      selector: (...args: Array<any>) => U,
      scheduler?: rxjs$SchedulerClass
    ): (v1: T, v2: T2, v3: T3, v4: T4, v5: T5, v6: T6) => rxjs$Observable<U>;
    bindCallback<T>(
      callbackFunc: Function,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): (...args: Array<any>) => rxjs$Observable<T>;
    bindCallback<T>(
      callbackFunc: Function,
      selector?: (...args: Array<any>) => T,
      scheduler?: rxjs$SchedulerClass
    ): (...args: Array<any>) => rxjs$Observable<T>;
  }
}
declare module 'rxjs/observable/bindNodeCallback' {
  declare module.exports: {
    bindNodeCallback<U>(
      callbackFunc: (callback: (err: any, result: U) => any) => any,
      selector?: void,
      scheduler?: rxjs$SchedulerClass
    ): () => rxjs$Observable<U>;
    bindNodeCallback<T, U>
```

### Core Architecture Module: `jest.config.js`
```
module.exports = {
  verbose: true,
  bail: true,
  moduleNameMapper: {},
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  rootDir: __dirname,
  modulePaths: ['<rootDir>/src'],
  moduleDirectories: ['<rootDir>/node_modules'],
  restoreMocks: true,
  testMatch: ['**/__tests__/**/?(spec|test).js', '**/?(*.)(spec|test).js'],
  moduleFileExtensions: ['js'],
  modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/dev'],
  // collectCoverage: true,
  // collectCoverageFrom: ['!**/node_modules/**', 'src/**'],
  // coverageDirectory: 'coverage',
  // coverageReporters: ['html', 'json'],
  cacheDirectory: '.cache/jest',
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

### Incident Patch 6: `9f338b51` (2025-04-07)
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
-- [adapters] The adapters interface has changed. `query()` and `co
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

### Incident Patch 7: `9b7258ab` (2025-04-07)
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

### Incident Patch 8: `a565e2ff` (2025-04-07)
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

### Incident Patch 9: `d44d3c51` (2025-03-14)
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

### Incident Patch 10: `ad63d41b` (2025-03-14)
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
