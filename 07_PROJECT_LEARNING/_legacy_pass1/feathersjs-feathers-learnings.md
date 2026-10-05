# Forensic Learning Record (Deep Inspection): feathersjs/feathers

> **Canonical Artifact**: `07_PROJECT_LEARNING/feathersjs-feathers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feathersjs/feathers](https://github.com/feathersjs/feathers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:15:15.995Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feathersjs/feathers`
- **Description**: The API and real-time application framework
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15259 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "mocha": true,
        "node": true
    },
    "extends": [
        "plugin:@typescript-eslint/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint",
        "prettier"
    ],
    "ignorePatterns": ["**/lib/", "**/dist/"],
    "rules": {
        "prettier/prettier": "error",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn", // or "error"
            { 
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_",
                "ignoreRestSiblings": true
            }
        ]
    }
};

```

### Core Architecture Module: `generators/package.ts`
```
import type { Callable, PinionContext } from '@featherscloud/pinion'
import { generator, install, prompt, runGenerators, toFile } from '@featherscloud/pinion'

export interface ModuleContext extends PinionContext {
  name: string
  uppername: string
  description: string
  moduleName: string
  packagePath: Callable<string, ModuleContext>
}

export const generate = (context: ModuleContext) =>
  generator(context)
    .then(
      prompt<ModuleContext>([
        {
          type: 'input',
          name: 'name',
          message: 'What is the name of the module?'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Write a short description'
        }
      ])
    )
    .then((ctx) => {
      return {
        ...ctx,
        moduleName: `@feathersjs/${ctx.name}`,
        uppername: ctx.name.charAt(0).toUpperCase() + ctx.name.slice(1),
        packagePath: toFile('packages', ctx.name)
      }
    })
    .then(runGenerators(__dirname, 'package'))
    .then(
      install<ModuleContext>(
        ['@types/node', 'shx', 'ts-node', 'typescript', 'mocha'],
        true,
        (context) => `npm --workspace packages/${context.name}`
      )
    )

```

### Core Architecture Module: `generators/package/index.tpl.ts`
```
import { generator, renderTemplate, toFile } from '@featherscloud/pinion'
import { ModuleContext } from '../package'

interface Context extends ModuleContext {}

const template = ({ name }: Context) => `
export function ${name}() {
  return 'Hello from ${name}'
}
`

export const generate = (context: Context) =>
  generator(context).then(renderTemplate(template, toFile(context.packagePath, 'src', 'index.ts')))

```

### Core Architecture Module: `generators/package/license.tpl.ts`
```
import { generator, renderTemplate, toFile } from '@featherscloud/pinion'
import { ModuleContext } from '../package'

interface Context extends ModuleContext {}

export const generate = (context: Context) =>
  generator(context).then(
    renderTemplate(
      `The MIT License (MIT)

Copyright (c) ${new Date().getFullYear()} Feathers Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
  `,
      toFile<Context>(context.packagePath, 'LICENSE')
    )
  )

```

### Core Architecture Module: `generators/package/package.json.tpl.ts`
```
import { generator, toFile, writeJSON } from '@featherscloud/pinion'
import { ModuleContext } from '../package'

interface Context extends ModuleContext {}

export const generate = (context: Context) =>
  generator(context).then(
    writeJSON<Context>(
      ({ moduleName, description, name }) => ({
        name: moduleName,
        description,
        version: '0.0.0',
        homepage: 'https://feathersjs.com',
        keywords: ['feathers'],
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'git://github.com/feathersjs/feathers.git',
          directory: `packages/${name}`
        },
        author: {
          name: 'Feathers contributor',
          email: 'hello@feathersjs.com',
          url: 'https://feathersjs.com'
        },
        contributors: [],
        bugs: {
          url: 'https://github.com/feathersjs/feathers/issues'
        },
        engines: {
          node: '>= 20'
        },
        files: ['CHANGELOG.md', 'LICENSE', 'README.md', 'src/**', 'lib/**', 'esm/**'],
        // module: './esm/index.js',
        main: './lib/index.js',
        types: './src/index.ts',
        exports: {
          '.': {
            // import: './esm/index.js',
            require: './lib/index.js',
            types: './src/index.ts'
          }
        },
        scripts: {
          prepublish: 'npm run compile',
          pack: 'npm pack --pack-destination ../generators/test/build',
          compile: 'shx rm -rf lib/ && tsc && npm run pack',
          test: 'mocha --config ../../.mocharc.json --recursive test/**.test.ts test/**/*.test.ts'
        },
        publishConfig: {
          access: 'public'
        },
        dependencies: {},
        devDependencies: {}
      }),
      toFile('packages', context.name, 'package.json')
    )
  )

```

### Core Architecture Module: `generators/package/readme.md.tpl.ts`
```
import { generator, renderTemplate, toFile } from '@featherscloud/pinion'
import { ModuleContext } from '../package'

const template = ({ description, moduleName }: ModuleContext) => `# ${moduleName}

[![CI](https://github.com/feathersjs/feathers/workflows/CI/badge.svg)](https://github.com/feathersjs/feathers/actions?query=workflow%3ACI)
[![Download Status](https://img.shields.io/npm/dm/${moduleName}.svg?style=flat-square)](https://www.npmjs.com/package/${moduleName})
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

> ${description}

## Installation

\`\`\`
npm install ${moduleName} --save
\`\`\`

## Documentation

Refer to the [Feathers API documentation](https://feathersjs.com/api) for more details.

## License

Copyright (c) ${new Date().getFullYear()} [Feathers contributors](https://github.com/feathersjs/feathers/graphs/contributors)

Licensed under the [MIT license](LICENSE).
`

export const generate = (context: ModuleContext) =>
  generator(context).then(renderTemplate(template, toFile(context.packagePath, 'README.md')))

```

### Core Architecture Module: `generators/package/tsconfig.json.tpl.ts`
```
import { generator, toFile, writeJSON } from '@featherscloud/pinion'
import { ModuleContext } from '../package'

export const generate = (context: ModuleContext) =>
  generator(context).then(
    writeJSON(
      {
        extends: '../../tsconfig',
        include: ['src/**/*.ts'],
        compilerOptions: {
          outDir: 'lib'
        }
      },
      toFile(context.packagePath, 'tsconfig.json')
    )
  )

```

### Core Architecture Module: `packages/adapter-commons/src/declarations.ts`
```
import { Query, Params, Paginated, Id, PaginationParams, PaginationOptions } from '@feathersjs/feathers'

export type FilterQueryOptions = {
  filters?: FilterSettings
  operators?: string[]
  paginate?: PaginationParams
}

export type QueryFilter = (value: any, options: FilterQueryOptions) => any

export type FilterSettings = {
  [key: string]: QueryFilter | true
}

// re-export from @feathersjs/feathers to prevent breaking changes
export { PaginationOptions, PaginationParams }

export interface AdapterServiceOptions {
  /**
   * Whether to allow multiple updates for everything (`true`) or specific methods (e.g. `['create', 'remove']`)
   */
  multi?: boolean | string[]
  /**
   * The name of the id property
   */
  id?: string
  /**
   * Pagination settings for this service
   */
  paginate?: PaginationParams
  /**
   * A list of additional property query operators to allow in a query
   *
   * @deprecated No longer needed when a query schema is used
   */
  operators?: string[]
  /**
   * An object of additional top level query filters, e.g. `{ $populate: true }`
   * Can also be a converter function like `{ $ignoreCase: (value) => value === 'true' ? true : false }`
   *
   * @deprecated No longer needed when a query schema is used
   */
  filters?: FilterSettings
  /**
   * @deprecated Use service `events` option when registering the service with `app.use`.
   */
  events?: string[]
  /**
   * @deprecated No longer needed when a query schema is used
   */
  whitelist?: string[]
}

export interface AdapterQuery extends Query {
  $limit?: number
  $skip?: number
  $select?: string[]
  $sort?: { [key: string]: 1 | -1 }
}
/**
 * Additional `params` that can be passed to an adapter service method call.
 */
export interface AdapterParams<
  Q = AdapterQuery,
  A extends Partial<AdapterServiceOptions> = Partial<AdapterServiceOptions>
> extends Params<Q> {
  adapter?: A
  paginate?: PaginationParams
}

/**
 * Hook-less (internal) service methods. Directly call database adapter service methods
 * without running any service-level hooks or sanitization. This can be useful if you need the raw data
 * from the service and don't want to trigger any of its hooks.
 *
 * Important: These methods are only available internally on the server, not on the client
 * side and only for the Feathers database adapters.
 *
 * These methods do not trigger events.
 *
 * @see {@link https://docs.feathersjs.com/guides/migrating.html#hook-less-service-methods}
 */
export interface InternalServiceMethods<
  Result = any,
  Data = Result,
  PatchData = Partial<Data>,
  Params extends AdapterParams = AdapterParams,
  IdType = Id
> {
  /**
   * Retrieve all resources from this service.
   * Does not sanitize the query and should only be used on the server.
   *
   * @param _params - Service call parameters {@link Params}
   */
  _find(_params?: Params & { paginate?: PaginationOptions }): Promise<Paginated<Result>>
  _find(_params?: Params & { paginate: false }): Promise<Result[]>
  _find(params?: Params): Promise<Result[] | Paginated<Result>>

  /**
   * Retrieve a single resource matching the given ID, skipping any service-level hooks.
   * Does not sanitize the query and should only be used on the server.
   *
   * @param id - ID of the resource to locate
   * @param params - Service call parameters {@link Params}
   * @see {@link HookLessServiceMethods}
   * @see {@link https://docs.feathersjs.com/api/services.html#get-id-params|Feathers API Documentation: .get(id, params)}
   */
  _get(id: IdType, params?: Params): Promise<Result>

  /**
   * Create a new resource for this service, skipping any service-level hooks.
   * Does not sanitize data or checks if multiple updates are allowed and should only be used on the server.
   *
   * @param data - Data to insert into this service.
   * @param params - Service call parameters {@link Params}
   * @see {@link HookLessServiceMethods}
   * @see {@link https://docs.feathersjs.com/api/services.html#create-data-params|Feathers API Documentation: .create(data, params)}
   */
  _create(data: Data, params?: Params): Promise<Result>
  _create(data: Data[], params?: Params): Promise<Result[]>
  _create(data: Data | Data[], params?: Params): Promise<Result | Result[]>

  /**
   * Completely replace the resource identified by id, skipping any service-level hooks.
   * Does not sanitize data or query and should only be used on the server.
   *
   * @param id - ID of the resource to be updated
   * @param data - Data to be put in place of the current resource.
   * @param params - Service call parameters {@link Params}
   * @see {@link HookLessServiceMethods}
   * @see {@link https://docs.feathersjs.com/api/services.html#update-id-data-params|Feathers API Documentation: .update(id, data, params)}
   */
  _update(id: IdType, data: Data, params?: Params): Promise<Result>

  /**
   * Merge any resources matching the given ID with the given data, skipping any service-level hooks.
   * Does not sanitize the data or query and should only be used on the server.
   *
   * @param id - ID of the resource to be patched
   * @param data - Data to merge with the current resource.
   * @param params - Service call parameters {@link Params}
   * @see {@link HookLessServiceMethods}
   * @see {@link https://docs.feathersjs.com/api/services.html#patch-id-data-params|Feathers API Documentation: .patch(id, data, params)}
   */
  _patch(id: null, data: PatchData, params?: Params): Promise<Result[]>
  _patch(id: IdType, data: PatchData, params?: Params): Promise<Result>
  _patch(id: IdType | null, data: PatchData, params?: Params): Promise<Result | Result[]>

  /**
   * Remove resources matching the given ID from the this service, skipping any service-level hooks.
   * Does not sanitize query and should only be used on the server.
   *
   * @param id - ID of the resource to be removed
   * @param params - Service call parameters {@link Params}
   * @see {@link HookLessServiceMethods}
   * @see {@link https://docs.feathersjs.com/api/services.html#remove-id-params|Feathers API Documentation: .remove(id, params)}
   */
  _remove(id: null, params?: Params): Promise<Result[]>
  _remove(id: IdType, params?: Params): Promise<Result>
  _remove(id: IdType | null, params?: Params): Promise<Result | Result[]>
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3084** (2023-04-05): **service.get(id) looses the where clause if query created in hook **
  *Symptoms*: Ran into a weird issue, whenever I add a before get hook like this:  ```   before: {     get: [       async (context: HookContext<TeamMembershipsService>) => {         const query = context.service.createQuery(context.params)         context.params.knex = query       }     ],    ...   } ``` which basically should do nothing. I get error: `NotFound: No record found for id 'cb36a3b0-007c-4719-9298-dcdea66705f8'.` That's because the query executed by knex looses the `where` clause and returns more than 1 entry: `knex:query select "team_memberships".* from "team_memberships" order by "team_memberships"."id" asc`  When `get(id)` is invoked it trickles down to this line in `_find()` in `KnexAdapter`: ``` const builder = params.knex ? params.knex.clone() : this.createQuery(params) ```  Since I've already created the query, `createQuery` is not invoked, and the `id` filter doesn't get added. The `id` query parameter is not added in my hook either when I call `createQuery(context.params)` because `id` is not present in params it's in `context.id`  Adding the id filter to the query in the hook helps: ``` async (context: HookContext<TeamMembershipsService>) => {   const query = context.service.createQuery(context.params)   query.where('id', context.id)   context.params.knex = query } ```  ### Expected behavior I expected the id filter to be appended to the query i create in the hook automatically  ### Actual behavior where id=abc filter doesn't get 

- **Issue #3065** (2023-04-05): **$select=['id'] in query returns an array of ID's**
  *Symptoms*: I'm receiving an array of 2 IDs when using $select argument in my query object.  ### Steps to reproduce  URL:  http://localhost:3003/submissions?$select[]=id&$select[]=title  ### Expected behavior {   "total": 1,   "limit": 10,   "skip": 0,   "data": [{       "id": 1,       "title": "First submission"     }] }  ### Actual behavior  This is the response: {   "total": 1,   "limit": 10,   "skip": 0,   "data": [{       "id": [         1,         1       ],       "title": "First submission"     }] }  ### System configuration  I'm using MSSQL and Knex.  **Module versions** (especially the part that's not working): feathers 5.0.0-pre.35  **NodeJS version**: v18.13.0  **Operating System**: macOS Ventura 13.2 

- **Issue #2835** (2022-11-25): **[dove/feathers-authentication] Access token not removed on logout when user is not found**
  *Symptoms*: ### Steps to reproduce  Create an OAuth based app which reauthenticates the user using `reAuthenticate()` in the index when an access token is available. In the app add a try/catch block like this: ``` try {         const response = await app.reAuthenticate()         ...       } catch (error) {         // This ensure an old token is not kept when the user has been deleted         if (error.code === 404) await app.logout()         ...       } ```  Now delete the user in the database and try to reauthenticate, the authentication fails probably because it is still using the old token: `error: api/authentication - Method: create: No record found for id '62c5b5921c535f8f68440c17'`  ### Expected behavior  The access token referring to the old user should be deleted so that a new authentication is performed from scratch. It seems that the remove operation performed by `logout()` does not work as the user is not found and the token is not removed as well.  I agree this is a race use case but as with OAuth users should not be persistent it could be possible. Typically to be GDPR compliant you should be forced to purge users in the DB on a regular basis.  Not sure if this is a bug or expected behavior but this code worked with Feathers v3. Maybe it is now expected to call `api.authentication.removeAccessToken()` explicitely as using `logout()` is not sufficient ?  ### Actual behavior  The token is not deleted.  ### System configuration  **Module versions*
  **Post-Mortem & Fix Analysis**:
  > So there was a legit problem with the error being cached which has been fixed in #2892 but I'm not sure if the access token should be removed on all errors. For example, any 5xx error might only be temporary as well as e.g. a 429 (Too Many Requests) in which case retrying with the existing access token could work.
  > I agree we should filter which error requires the token being removed. Typically in the issue use case a 404 should remove the token. 
  > That makes sense. https://github.com/feathersjs/feathers/pull/2894 will remove the access token for all unrecoverable 400 errors. I think for other errors it is up to the developer if they want to remove the access token or not.

- **Issue #2825** (2022-11-04): **dove-docs: footer on mobile is displaced**
  *Symptoms*: The footer of the new docs looks like this on mobile:  ![Screenshot_20221021-063803_Chrome](https://user-images.githubusercontent.com/22286818/197113419-35347a23-123f-499e-bd19-1feca11fd1e2.jpg)  For example here: https://dove.feathersjs.com/api/hooks.html  System: Android Device: Samsung S21 FE Browser: Webview (Samsung Browser (?) and Android Chrome) 
  **Post-Mortem & Fix Analysis**:
  > Can confirm. This must've gotten borked when @marshallswain and I fiddled with it. For some reason it adds a `sidebar-adjust` with a huge margin:  <img width="419" alt="Screenshot 2022-10-21 at 8 17 52 AM" src="https://user-images.githubusercontent.com/338316/197230786-a39f7274-3044-4cd6-ade7-72d711ecfd42.png"> 
  > The problem is the   ```html <style> /* Only indent the footer on pages other than home-page */ #app:not(.home-page) .feathers-footer.sidebar-open .sidebar-adjust {   margin-left: 272px; } </style> ```  in https://github.com/feathersjs/feathers/blob/dove/docs/components/Footer.vue#L61-L66

- **Issue #2764** (2022-10-15): **getGrantConfig being hard-coded to use http on local dev not ideal for some setups**
  *Symptoms*: We recently did a long-overdue dependency update, with one of those updates being a conversion from pre.10 versions of Feathers packages to pre.29. I noticed that in local dev, our oauth logins weren't working any more. I see in the new getGrantConfig in authentication-oauth/src/utils.ts  that, if NODE_ENV is 'development', it's hard-coding the protocol to be 'http' and adding a non-'80' port onto the host. We use https when running locally and were already adding the port onto the host in order to work in prior versions. The latter isn't too much of an issue to change, but the former is more of a problem, since we're not going to switch to http.  I don't think assuming that everyone runs http locally is a good assumption, as we can't be the only people who use https in order to more closely mirror production (and prevent warnings/issues with mixed fetching of http and https resources).   I can get around this by setting NODE_ENV to production locally, and as it turns out we don't seem to be running any important logic off of NODE_ENV so this shouldn't mess up our local dev process, but I don't think NODE_ENV !== 'production' should be forcing http. There may very well be others who are using NODE_ENV to set other logic, which would force them to either not be able to easily test OAuth locally, have to switch to http (which may be impractical), or change that other logic to be conditional on something else.  ### Expected behavior http vs. https for origin urls on local
  **Post-Mortem & Fix Analysis**:
  > I added a test in #2795 that shows how to override the origin in the default settings. It looks like this:  ```ts {   defaults: {     prefix: '/auth',     origin: 'https://localhost:3344'   },   github: {     key: 'some-key',     secret: 'a secret secret',     dynamic: true   } } ```  This will use `https://localhost:3344` as the base URL.

- **Issue #2451** (2021-10-05): **returned hook context not used anymore in workflow**
  *Symptoms*: ### Steps to reproduce  As long as feathers dove should behave like feathers crow, it is currently not possible to create a new context object which will returned and reused in the following hooks.  If I create a new context object with spread operators during the hook, changing some query parameters and returning this context at the end of the hook. It will be used in the following hooks in feathers v4, in feathers v5 the original context from the function parameter will be reused in the next hooks and not the object what was return by the previous hooks. That means the return object isn't available in the following workflow (service and hooks).  Example:  ```js const worksInV4AndV5 = (context) => {   context.params.query.foo = 'worksInV4AndV5';   return context;  };  const worksInV4NotInV5 = (context) => {   return {     ...context,     params: {       ...context.params,       query: {         ...context.params.query,         foo: 'worksInV4NotInV5'       }     }   }; };  const logHook = (context) => {     // logs in v4  'worksInV4NotInV5'      // logs in v5  'worksInV4AndV5'      console.log(context.params.query.foo); };  const hooks = {     before: {       all: [],       get: [         worksInV4AndV5,         worksInV4NotInV5,         logHook       ],       find: [         worksInV4AndV5,         worksInV4NotInV5,         logHook       ],       create: [],       update: [],       patch: [],       remove: [],     },     af

- **Issue #2327** (2021-05-09): **Can not add route with placeholder, using version 5.0-pre3**
  *Symptoms*: ### Steps to reproduce  Use 5.0-pre3  Assuming we have a Message service: ``` const app = feathers();  // Register the message service on the Feathers application app.use('messages', new MessageService()); ```  I wouldn't be able to write a FlagMessageService like so anymore:  ``` app.use('messages/:messageId/flag', new FlagMessageService ()); ```  Nor would I be able to specify it like so:  ```  app.use('messages/:messageId/flag', new FlagMessageService ()); ```  But I could specify it like so: ``` app.use('messages/:__id/flag', new FlagMessageService ()); ```  This seems to not be documented in the Migration to v5 instructions, and I'm not sure if it's intended to be limit the user on this or not.  When using `:id` in the path, I'd get this error: `Can not add route with placeholder ':id' because placeholder ':__id' already exists` This is why I assumed using `:__id` would work and it seems to unblock the initialization of the app.      ### Expected behavior It would be nice if we could specify any route params as we wish, as we could in v4.   ### Actual behavior Getting an error in the form of: `Can not add route with placeholder ':id' because placeholder ':__id' already exists`  ### System configuration  Tell us about the applicable parts of your setup.  **Module versions**  Verison 5.0-pre3  **NodeJS version**: N/A  **Operating System**: N/A  **Browser Version**: N/A  **React Native Version**: N/A  **Module Loa
  **Post-Mortem & Fix Analysis**:
  > This is definitely a regression in the new built-in radix tree router that should be fixed. I just have to get the semantics right because a  ```js app.use('messages', new MessageService()); app.use('messages/:messageId/flag', new FlagMessageService ()); ```  is fine since you can always say which request belongs where, but a  ```js app.use('messages', new MessageService()); app.use('messages/:messageId', new SomeMessageService ()); ```  wouldn't work because you couldn't tell if going to `messages/something` is a `SomeMessageService.find()` or a `MessageService.get('something')`
  > Correct, the 2nd case you mentioned is probably a user error. I'm not expecting the latter case to be valid and the error that is given is probably accurate.

- **Issue #2207** (2021-03-26): **Server Crash when subscribing to undefined connection**
  *Symptoms*: In some edge cases, such as _deleting_ a user or _creating_ and then subscribing a user with _internal_ provider, the connection object might be lost or not active yet. In that case the server will crash, with:  ``` myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:12                 mappings.set(connection, channel.data);                          ^  TypeError: Invalid value used as weak map key     at WeakMap.set (<anonymous>)     at myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:12:26     at Array.forEach (<anonymous>)     at myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:9:29     at Array.forEach (<anonymous>)     at collectConnections (myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:8:14)     at new CombinedChannel (myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:20:43)     at Function.channel (myApp/node_modules/@feathersjs/transport-commons/lib/channels/mixins.js:43:20)     at Function.channel (myApp/node_modules/@feathersjs/transport-commons/lib/channels/mixins.js:30:33)     at Function.leaveChannels (myApp/node_modules/@feathersjs/transport-commons/lib/socket/index.js:17:21)     at Function.emit (events.js:327:22)     at Socket.<anonymous> (myApp/node_modules/@feathersjs/socketio/lib/middleware.js:4:39)     at Object.onceWrapper (events.js:422:26)     at Socket.emit (events.js:315

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

### Incident Patch 1: `572574e3` (2026-09-24)
**Commit Message**: fix(schema): recheck external dispatch after resolving (#3705)

**File**: `packages/schema/src/hooks/resolve.ts` (modified, +3/-2)
```diff
@@ -173,7 +173,8 @@ export const resolveExternal =
           {} as Record<string, any>
         )
 
-        return setDispatch(current, currentDispatch)
+        // Nested or concurrent resolutions may have set dispatch while the resolvers were awaited.
+        return getDispatch(current) ?? setDispatch(current, currentDispatch)
       }
 
       const result = await (Array.isArray(data)
@@ -186,7 +187,7 @@ export const resolveExternal =
           }
         : result
 
-      context.dispatch = setDispatch(context.result, dispatch)
+      context.dispatch = getDispatch(context.result) ?? setDispatch(context.result, dispatch)
     }
   }
 
```

**File**: `packages/schema/test/hooks.test.ts` (modified, +112/-2)
```diff
@@ -1,8 +1,8 @@
-import { createContext, feathers } from '@feathersjs/feathers'
+import { createContext, feathers, HookContext } from '@feathersjs/feathers'
 import assert from 'assert'
 import { VALIDATED } from '@feathersjs/adapter-commons'
 import { MemoryService } from '@feathersjs/memory'
-import { validateQuery } from '../src'
+import { getDispatch, resolve, resolveExternal, validateQuery } from '../src'
 import { app, Message, User } from './fixture'
 
 describe('@feathersjs/schema/hooks', () => {
@@ -197,6 +197,116 @@ describe('@feathersjs/schema/hooks', () => {
     assert.deepStrictEqual(await service.find(), [{ message: 'Hello' }])
   })
 
+  for (const paginated of [false, true]) {
+    it(`resolves repeated result objects with paginated=${paginated} (#3476)`, async () => {
+      const record = { message: 'Hello', password: 'secret' }
+      const records = [record, record]
+      const result = paginated ? { total: 2, limit: 10, skip: 0, data: records } : records
+      const localApp = feathers().use('shared', {
+        async find() {
+          return result
+        }
+      })
+      const service = localApp.service('shared')
+
+      service.hooks({
+        around: {
+          all: [resolveExternal(resolve<typeof record, HookContext>({ password: async () => undefined }))]
+        }
+      })
+
+      const context = await service.find({}, createContext(service, 'find'))
+      const dispatch = [{ message: 'Hello' }, { message: 'Hello' }]
+
+      assert.strictEqual(context.result, result)
+      assert.deepStrictEqual(
+        context.dispatch,
+        paginated ? { total: 2, limit: 10, skip: 0, data: dispatch } : dispatch
+      )
+      const dispatchedRecords = Array.isArray(context.dispatch) ? context.dispatch : context.dispatch.data
+      assert.strictEqual(dispatchedRecords[0], dispatchedRecords[1])
+      assert.strictEqual(dispatchedRecords[0], getDispatch(record))
+      assert.strictEqual(record.password, 'secret')
+    })
+
+    it(`resolves concurrent calls sharing paginated=${paginated} results (#3476)`, async () => {
+      const record = { message: 'Hello', password: 'secret' }
+      const records = [record]
+      const result = paginated ? { total: 1, limit: 10, skip: 0, data: records } : records
+      const localApp = feathers().use('shared', {
+        async find() {
+          return result
+        }
+      })
+      const service = localApp.service('shared')
+
+      service.hooks({
+        around: {
+          all: [resolveExternal(resolve<typeof record, HookContext>({ password: async () => undefined }))]
+        }
+      })
+
+      const [first, second] = await Promise.all([
+        service.find({}, createContext(service, 'find')),
+        service.find({}, createContext(service, 'find'))
+      ])
+      const dispatch = [{ message: 'Hello' }]
+
+      assert.deepStrictEqual(
+        first.dispatch,
+        paginated ? { total: 1, limit: 10, skip: 0, data: dispatch } : dispatch
+      )
+      assert.strictEqual(first.dispatch, second.dispatch)
+      assert.strictEqual(first.result, result)
+      assert.strictEqual(second.result, result)
+      assert.strictEqual(record.password, 'secret')
+    })
+  }
+
+  it('keeps dispatch set by a resolver service call (#3476)', async () => {
+    const record = { message: 'Hello', password: 'secret' }
+    const localApp = feathers()
+
+    for (const name of ['inner', 'outer']) {
+      localApp.use(name, {
+        async get() {
+          return record
+        }
+      })
+    }
+
+    localApp.service('inner').hooks({
+      around: {
+        all: [resolveExternal(resolve<typeof record, HookContext>({ password: async () => undefined }))]
+      }
+    })
+    const service = localApp.service('outer')
+    service.hooks({
+      around: {
+        all: [
+          resolveExternal(
+            resolve<typeof record, HookContext>(
+              {},
+              {
+                converter: async (data, context) => {
+  
```

---

### Incident Patch 2: `05bb6c8d` (2026-09-17)
**Commit Message**: fix(generators): use entity camelName for auth params in schema templates (#3706)

**File**: `packages/generators/src/service/templates/schema.json.tpl.ts` (modified, +2/-2)
```diff
@@ -115,8 +115,8 @@ export const ${camelName}QueryResolver = resolve<${upperName}Query, HookContext<
       ? `
   // If there is a user (e.g. with authentication), they are only allowed to see their own data
   ${type === 'mongodb' ? '_id' : 'id'}: async (value, user, context) => {
-    if (context.params.user) {
-      return context.params.user.${type === 'mongodb' ? '_id' : 'id'}
+    if (context.params.${camelName}) {
+      return context.params.${camelName}.${type === 'mongodb' ? '_id' : 'id'}
     }
 
     return value
```

**File**: `packages/generators/src/service/templates/schema.typebox.tpl.ts` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ export const ${camelName}QueryResolver = resolve<${upperName}Query, HookContext<
       ? `
   // If there is a user (e.g. with authentication), they are only allowed to see their own data
   ${type === 'mongodb' ? '_id' : 'id'}: async (value, user, context) => {
-    if (context.params.user) {
-      return context.params.user.${type === 'mongodb' ? '_id' : 'id'}
+    if (context.params.${camelName}) {
+      return context.params.${camelName}.${type === 'mongodb' ? '_id' : 'id'}
     }
 
     return value
```

---

### Incident Patch 3: `4dd36da8` (2026-09-11)
**Commit Message**: fix: Update dependencies (#3703)

**File**: `docs/package.json` (modified, +16/-16)
```diff
@@ -11,30 +11,30 @@
     "start": "npm run dev"
   },
   "dependencies": {
-    "@vueuse/core": "^14.3.0",
+    "@vueuse/core": "^14.4.0",
     "date-fns": "^4.4.0",
-    "element-plus": "^2.14.2",
-    "query-string": "^9.4.0",
-    "shiki": "^4.2.0",
-    "vue": "^3.5.38"
+    "element-plus": "^2.14.5",
+    "query-string": "^9.5.1",
+    "shiki": "^4.4.3",
+    "vue": "^3.5.42"
   },
   "devDependencies": {
-    "@feathersjs/generators": "^5.0.45",
-    "@iconify-json/carbon": "^1.2.23",
+    "@feathersjs/generators": "^5.0.49",
+    "@iconify-json/carbon": "^1.2.27",
     "@types/node": "^26.0.0",
-    "@unocss/preset-typography": "^66.7.2",
-    "@unocss/reset": "^66.7.2",
-    "@unocss/transformer-directives": "^66.7.2",
-    "@vitejs/plugin-vue": "^6.0.7",
+    "@unocss/preset-typography": "^66.10.2",
+    "@unocss/reset": "^66.10.2",
+    "@unocss/transformer-directives": "^66.10.2",
+    "@vitejs/plugin-vue": "^6.0.8",
     "esno": "^4.8.0",
     "fast-glob": "^3.3.3",
     "flexsearch": "^0.7.31",
-    "https-localhost": "^4.7.1",
-    "markdown-it": "^14.2.0",
-    "sass": "^1.101.0",
+    "https-localhost": "^4.7.2",
+    "markdown-it": "^15.0.2",
+    "sass": "^1.104.0",
     "sitemap": "^9.0.1",
-    "unocss": "^66.7.2",
-    "unplugin-auto-import": "^21.0.0",
+    "unocss": "^66.10.2",
+    "unplugin-auto-import": "^21.1.0",
     "unplugin-vue-components": "^32.1.0",
     "vite-plugin-pwa": "^1.3.0",
     "vitepress": "^1.6.4",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
     "lint": "npm run prettier && npm run eslint",
     "compile": "lerna run compile",
     "build:docs": "npm run build --workspace docs",
-    "update-dependencies": "npm exec --workspaces --include-workspace-root -- ncu -u --dep prod,dev,optional,peer -x node-fetch,\"@sinclair/typebox\",\"@types/express\",\"@types/express-serve-static-core\",commander,express,flexsearch,uuid,mongodb",
+    "update-dependencies": "npm exec --workspaces --include-workspace-root -- ncu -u --dep prod,dev,optional,peer -x node-fetch,\"@sinclair/typebox\",\"@types/express\",\"@types/express-serve-static-core\",commander,express,flexsearch,uuid,mongodb,typescript",
     "clean": "find . -name node_modules -exec rm -rf '{}' + && find . -name package-lock.json -exec rm -rf '{}' +",
     "test:deno": "deno test --config deno/tsconfig.json deno/test.ts",
     "test": "npm run lint && npm run compile && c8 lerna run test --ignore @feathersjs/tests",
```

**File**: `packages/adapter-commons/package.json` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@
     "@types/mocha": "^10.0.10",
     "@types/mongodb": "^4.0.6",
     "@types/node": "^26.0.0",
-    "mocha": "^11.7.6",
+    "mocha": "^12.0.1",
     "mongodb": "^6.19.0",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
```

**File**: `packages/adapter-tests/package.json` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
   "devDependencies": {
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
-    "mocha": "^11.7.6",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-client/package.json` (modified, +2/-2)
```diff
@@ -67,8 +67,8 @@
     "@feathersjs/socketio-client": "^5.0.49",
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
-    "axios": "^1.18.0",
-    "mocha": "^11.7.6",
+    "axios": "^1.20.0",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

---

### Incident Patch 4: `fcbf602c` (2026-09-11)
**Commit Message**: fix(transport-commons): map HEAD requests like GET for REST services (#3701)

**File**: `packages/transport-commons/src/http.ts` (modified, +3/-1)
```diff
@@ -38,7 +38,9 @@ export function getServiceMethod(_httpMethod: string, id: unknown, headerOverrid
     return mappedMethod
   }
 
-  if (httpMethod === 'get') {
+  // HEAD is semantically a GET without a body (RFC 9110). Map it the same
+  // way so Express/Koa REST endpoints do not 405/500 on HEAD probes.
+  if (httpMethod === 'get' || httpMethod === 'head') {
     return id === null ? 'find' : 'get'
   }
 
```

**File**: `packages/transport-commons/test/http.test.ts` (modified, +3/-0)
```diff
@@ -68,6 +68,9 @@ describe('@feathersjs/transport-commons HTTP helpers', () => {
   it('getServiceMethod', () => {
     assert.strictEqual(http.getServiceMethod('GET', 2), 'get')
     assert.strictEqual(http.getServiceMethod('GET', null), 'find')
+    assert.strictEqual(http.getServiceMethod('HEAD', 2), 'get')
+    assert.strictEqual(http.getServiceMethod('HEAD', null), 'find')
+    assert.strictEqual(http.getServiceMethod('head', null), 'find')
     assert.strictEqual(http.getServiceMethod('PoST', null), 'create')
     assert.strictEqual(http.getServiceMethod('PoST', null, 'customMethod'), 'customMethod')
     assert.strictEqual(http.getServiceMethod('delete', null), 'remove')
```

---

### Incident Patch 5: `ab6f0eb7` (2026-08-14)
**Commit Message**: fix(core): Set version back to development

**File**: `packages/feathers/src/version.ts` (modified, +1/-1)
```diff
@@ -1 +1 @@
-export default '5.0.49'
+export default 'development'
```

---

### Incident Patch 6: `304a1aac` (2026-08-14)
**Commit Message**: fix(adapter-commons): validate query operators nested in arrays (#3700)

* fix(adapter-commons): validate query operators nested in arrays

validateQueryProperty skipped array values because isPlainObject
excludes arrays. That let unknown $ operators through when wrapped
in an extra array level, e.g. $or: [[{ $where: '1==1' }]]. Recurse
into arrays so the operator allow-list applies at every level.

* fix: validate filter values and tighten ObjectIdSchema

filterQuery left $select, $or, $and, and $sort object values
unvalidated, so unknown $ operators could ride through those
filters. ObjectIdSchema accepted any object, which let operator
documents pass querySyntax on generated MongoDB services.

Validate those filter values with validateQueryProperty. The
objectid keyword now accepts ObjectId instances and rejects
other objects, and ObjectIdSchema uses that for its object branch.

* fix(schema): allow $exists on queryProperty after ObjectIdSchema tighten

Tightening ObjectIdSchema dropped { _id: { $exists: true } }, which
only passed because the old any-object branch treated the operator
document as an id. Add $exists as a boolean operator on queryProperty
so it is allowed on ever

**File**: `docs/api/databases/knex.md` (modified, +6/-4)
```diff
@@ -113,19 +113,21 @@ In addition to the [common querying mechanism](./querying.md), this adapter also
 ```ts
 const messageQuerySchema = Type.Intersect(
   [
-    // This will additionally allow querying for `{ name: { $ilike: 'Dav%' } }`
     querySyntax(messageQueryProperties, {
       name: {
-        $ilike: Type.String()
+        $like: Type.String(),
+        $notlike: Type.String(),
+        $ilike: Type.String() // PostgreSQL
       }
     }),
-    // Add additional query properties here
-    Type.Object({})
+    Type.Object({}, { additionalProperties: false })
   ],
   { additionalProperties: false }
 )
 ```
 
+More extension examples are in [querySyntax](../schema/typebox.md#querysyntax). `{ age: null }` and `{ age: { $ne: null } }` work when the query property type includes `null` (see the `age` field in the adapter tests).
+
 ### $like
 
 Find all records where the value matches the given string pattern. The following query retrieves all messages that start with `Hello`:
```

**File**: `docs/api/databases/mongodb.md` (modified, +16/-3)
```diff
@@ -215,13 +215,13 @@ new MongoDBService({
 
 <BlockQuote type="warning" label="Important">
 
-Note that in a normal application all MongoDB specific operators have to explicitly be added to the [TypeBox query schema](../schema/typebox.md#query-schemas) or [JSON query schema](../schema/schema.md#querysyntax).
+Note that in a normal application all MongoDB specific operators have to explicitly be added to the [TypeBox query schema](../schema/typebox.md#querysyntax) or [JSON query schema](../schema/schema.md#querysyntax).
 
 </BlockQuote>
 
 There are two ways to perform search queries with MongoDB:
 
-- Perform basic Regular Expression matches using the `$regex` filter.
+- Perform basic Regular Expression matches using the `$regex` operator.
 - Perform full-text search using the `$search` filter.
 
 ### Basic Regex Search
@@ -234,6 +234,19 @@ You can perform basic search using regular expressions with the `$regex` operato
 }
 ```
 
+Allow those operators on the properties that need them:
+
+```ts
+querySyntax(messageQueryProperties, {
+  text: {
+    $regex: Type.String(),
+    $options: Type.String()
+  }
+})
+```
+
+If you also use [`validateQuery(schema, { skipSanitize: false })`](../schema/validators.md#keeping-adapter-sanitization), list them on the service as well: `operators: ['$regex', '$options']`.
+
 ### Full-Text Search
 
 See the MongoDB documentation for instructions on performing full-text search using the `$search` operator:
@@ -456,7 +469,7 @@ validator.addKeyword(keywordObjectId)
 
 ### ObjectIdSchema
 
-Both, `@feathersjs/typebox` and `@feathersjs/schema` export an `ObjectIdSchema` helper that creates a schema which can be both, a MongoDB ObjectId or a string that will be converted with the `objectid` keyword:
+Both, `@feathersjs/typebox` and `@feathersjs/schema` export an `ObjectIdSchema` helper that creates a schema which can be a MongoDB ObjectId instance or a string that will be converted with the `objectid` keyword. Arbitrary objects — including query operator documents like `{ $ne: null }` or `{ $where: '…' }` — are not valid ObjectIds.
 
 ```ts
 import { ObjectIdSchema } from '@feathersjs/typebox' // or '@feathersjs/schema'
```

**File**: `docs/api/schema/schema.md` (modified, +2/-4)
```diff
@@ -171,7 +171,7 @@ const userQuery: UserQuery = {
 }
 ```
 
-Additional special query properties [that are not already included in the query syntax](../databases/querying.md) like `$ilike` can be added like this:
+Additional operators that are [not already in the common query syntax](../databases/querying.md) (`$like`, `$regex`, …) are added per property. Only add operators your adapter supports. See [TypeBox querySyntax](./typebox.md#querysyntax) for more examples.
 
 ```ts
 import { querySyntax } from '@feathersjs/schema'
@@ -184,9 +184,7 @@ export const userQuerySchema = {
   properties: {
     ...querySyntax(userSchema.properties, {
       email: {
-        $ilike: {
-          type: 'string'
-        }
+        $ilike: { type: 'string' }
       }
     } as const)
   }
```

**File**: `docs/api/schema/typebox.md` (modified, +16/-8)
```diff
@@ -101,30 +101,38 @@ const messageQuerySchema = querySyntax(messageQueryProperties)
 type MessageQuery = Static<typeof messageQuerySchema>
 ```
 
-Additional special query properties [that are not already included in the query syntax](../databases/querying.md) like `$ilike` can be added like this:
+Additional operators that are [not already in the common query syntax](../databases/querying.md) must be added per property. Only add operators your adapter actually supports.
 
 ```ts
-import { querySyntax } from '@feathersjs/typebox'
+import { querySyntax, Type } from '@feathersjs/typebox'
 
-// Schema for allowed query properties
 const messageQueryProperties = Type.Pick(messageSchema, ['id', 'text', 'createdAt', 'userId'], {
   additionalProperties: false
 })
+
 const messageQuerySchema = Type.Intersect(
   [
-    // This will additionally allow querying for `{ name: { $ilike: 'Dav%' } }`
     querySyntax(messageQueryProperties, {
-      name: {
-        $ilike: Type.String()
+      text: {
+        $like: Type.String(),
+        $notlike: Type.String(),
+        $ilike: Type.String(), // PostgreSQL
+        $regex: Type.String(),
+        $options: Type.String()
       }
     }),
-    // Add additional query properties here
-    Type.Object({})
+    Type.Object({}, { additionalProperties: false })
   ],
   { additionalProperties: false }
 )
 ```
 
+That allows `{ text: { $like: 'Hello%' } }` and `{ text: { $regex: 'feathers', $options: 'i' } }`.
+
+`$ne: null` and `{ userId: null }` are allowed when the **query** property type includes `null` (for example `Type.Union([Type.Number(), Type.Null()])` or `Type.Union([ObjectIdSchema(), Type.Null()])`). That is a field type, not a new operator. Do not change the create/patch data schema unless you also want to store nulls.
+
+Mongo `$meta` / `$slice` in object `$select` or `$sort` are not part of the common syntax. On the adapter sanitizer path, list them on the existing service `operators` option if you need them. `querySyntax` `$select` remains a string array.
+
 To allow additional query properties outside of the query syntax use the intersection type:
 
 ```ts
```

**File**: `docs/api/schema/validators.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ This is intentional. Schema validation and the legacy sanitizer are alternative
 
 - Prefer [`querySyntax`](./typebox.md#querysyntax) (or the [JSON schema helpers](./schema.md#query-helpers)) so only the common operators are allowed on each property.
 - Set `additionalProperties: false` on query objects so unknown keys (including unexpected `$` operators) are rejected. Generated applications already do this.
-- Only add extra operators (for example `$ilike` or `$regex`) when your adapter supports them and your application needs them.
+- Only add extra operators (for example `$ilike` or `$regex`) when your adapter supports them and your application needs them. Copy-paste examples: [querySyntax](./typebox.md#querysyntax).
 - Avoid permissive schemas such as `additionalProperties: true` or an open object on external query validation unless you intentionally want clients to send those keys.
 
 <BlockQuote type="warning" label="TypeBox and JSON Schema defaults">
```

---

### Incident Patch 7: `1a58896a` (2026-08-11)
**Commit Message**: fix(authentication-oauth): allow any port on loopback OAuth origins (#3699)

* fix(authentication-oauth): allow any port on loopback OAuth origins

Exact origin matching from the 5.0.40 security fix rejected common local
dev setups where the frontend runs on a different port than the configured
origin (e.g. http://localhost vs http://localhost:5173).

For localhost, 127.0.0.1, and ::1 only, match on scheme + host and ignore
port, then redirect using the referer origin so the token returns to the
correct local port. Non-loopback hosts still require an exact origin match.

Closes #3684

* fix(authentication-oauth): treat 0.0.0.0 as loopback and improve origin errors

Include 0.0.0.0 in the loopback port-flex allowlist used for local OAuth
redirects. When a referer is rejected, report the normalized origin,
configured allowlist, and a short hint about ports and loopback matching.

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +53/-5)
```diff
@@ -11,6 +11,51 @@ import qs from 'qs'
 
 const debug = createDebug('@feathersjs/authentication-oauth/strategy')
 
+// Local machine addresses: match any port when scheme + host are allowlisted.
+const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])
+
+/** Strip IPv6 brackets so `[::1]` and `::1` compare the same. */
+function normalizeHostname(hostname: string) {
+  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
+}
+
+function isLoopbackHost(hostname: string) {
+  return LOOPBACK_HOSTS.has(normalizeHostname(hostname))
+}
+
+/**
+ * Match key for origin allowlisting.
+ * Non-loopback hosts use the full WHATWG origin (scheme + host + port).
+ * Loopback hosts drop the port so local frontends on any port can match a single allowlist entry.
+ */
+function originMatchKey(value: string) {
+  const url = new URL(value)
+  const host = normalizeHostname(url.hostname)
+
+  if (isLoopbackHost(host)) {
+    return `${url.protocol}//${host}`
+  }
+
+  return url.origin.toLowerCase()
+}
+
+function isOriginAllowed(refererOrigin: string, configured: string) {
+  try {
+    return originMatchKey(refererOrigin) === originMatchKey(configured)
+  } catch {
+    return false
+  }
+}
+
+function originNotAllowedMessage(refererOrigin: string, origins: string[]) {
+  return (
+    `Referer origin "${refererOrigin}" is not allowed. ` +
+    `Configured origins: ${origins.join(', ')}. ` +
+    `Use a full origin (scheme + host + port when non-default). ` +
+    `Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.`
+  )
+}
+
 /**
  * Validates that appending a user-supplied path to a base URL does not change the origin.
  * Uses both URL resolution and string concatenation checks to catch all open redirect vectors:
@@ -117,17 +162,20 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
       try {
         refererOrigin = new URL(referer).origin
       } catch {
-        throw new NotAuthenticated(`Invalid referer "${referer}".`)
+        throw new NotAuthenticated(
+          `Invalid referer "${referer}". Expected an absolute URL (e.g. http://localhost:3000).`
+        )
       }
 
-      // Compare full origins
-      const allowedOrigin = origins.find((current) => refererOrigin.toLowerCase() === current.toLowerCase())
+      // Exact origin match; loopback hosts also match any port (see originMatchKey).
+      // Always return the referer origin so redirects use the port the client came from.
+      const allowedOrigin = origins.find((current) => isOriginAllowed(refererOrigin, current))
 
       if (!allowedOrigin) {
-        throw new NotAuthenticated(`Referer "${referer}" is not allowed.`)
+        throw new NotAuthenticated(originNotAllowedMessage(refererOrigin, origins))
       }
 
-      return allowedOrigin
+      return refererOrigin
     }
 
     return redirect
```

**File**: `packages/authentication-oauth/test/strategy.test.ts` (modified, +166/-3)
```diff
@@ -202,7 +202,11 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
             }
           ),
         {
-          message: 'Referer "https://target.com.attacker.com/login" is not allowed.'
+          message:
+            'Referer origin "https://target.com.attacker.com" is not allowed. ' +
+            'Configured origins: https://target.com. ' +
+            'Use a full origin (scheme + host + port when non-default). ' +
+            'Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.'
         }
       )
     })
@@ -220,7 +224,11 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
             }
           ),
         {
-          message: 'Referer "https://target.com-evil.attacker.com/login" is not allowed.'
+          message:
+            'Referer origin "https://target.com-evil.attacker.com" is not allowed. ' +
+            'Configured origins: https://target.com. ' +
+            'Use a full origin (scheme + host + port when non-default). ' +
+            'Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.'
         }
       )
     })
@@ -238,6 +246,157 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
       assert.equal(redirect, 'https://target.com#access_token=testing')
     })
   })
+
+  describe('loopback origin port matching (#3684)', () => {
+    afterEach(() => {
+      delete app.get('authentication').oauth.origins
+    })
+
+    it('should allow any port on localhost when configured without a port', async () => {
+      app.get('authentication').oauth.origins = ['http://localhost']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://localhost:5173/login'
+          }
+        }
+      )
+
+      // Redirect must use the referer port, not the config string
+      assert.equal(redirect, 'http://localhost:5173#access_token=testing')
+    })
+
+    it('should allow a different loopback port than the configured one', async () => {
+      app.get('authentication').oauth.origins = ['http://localhost:3030']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://localhost:3000/app'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://localhost:3000#access_token=testing')
+    })
+
+    it('should allow any port on 127.0.0.1', async () => {
+      app.get('authentication').oauth.origins = ['http://127.0.0.1:8080']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://127.0.0.1:5173/'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://127.0.0.1:5173#access_token=testing')
+    })
+
+    it('should allow any port on IPv6 loopback', async () => {
+      app.get('authentication').oauth.origins = ['http://[::1]']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://[::1]:4173/path'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://[::1]:4173#access_token=testing')
+    })
+
+    it('should allow any port on 0.0.0.0', async () => {
+      app.get('authentication').oauth.origins = ['http://0.0.0.0:3030']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://0.0.0.0:5173/app'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://0.0.0.0:5173#access_token=testing')
+    })
+
+    it('should not treat localhost and 127.0.0.1 as the same host', async () => {
+      app.get('authentication').oauth.origins = ['http://localhost']
+
+      await assert.rejects(
+        () =>
+          strategy.getRedirect(
+            { accessToken: 'testing' },
+ 
```

---

### Incident Patch 8: `15f5ee92` (2026-08-11)
**Commit Message**: docs(authentication): clarify OAuth authStrategies security (#3698)

Document that OAuth providers belong under authentication.oauth and
must not be listed in public authStrategies for browser redirect SSO.
Rewrite flow #2 guidance so provider-token login requires a verifying
getProfile, and cross-link guides and cookbooks.

**File**: `docs/api/authentication/oauth.md` (modified, +74/-9)
```diff
@@ -56,6 +56,55 @@ The following settings for `app.configure(oauth())` are available:
 - `expressSession` - An Express middleware for handling sessions. By default will use an HTTP cookie that is only available for the oAuth flow. **This normally does not need to be changed.**
 - `koaSession` - A Koa middleware for handling sessions. By default will use an HTTP cookie that is only available for the oAuth flow. **This normally does not need to be changed.**
 
+### Configuration and security
+
+OAuth setup uses three separate pieces. Only the first two are required for the usual browser redirect login:
+
+| Piece | Role |
+| --- | --- |
+| `authentication.register('google', new OAuthStrategy())` | Registers the strategy so the OAuth callback can run it |
+| `authentication.oauth.google` in configuration | Grant provider options (`key`, `secret`, `scope`, …) |
+| `authentication.authStrategies` | Strategy names clients may use on **external** `POST /authentication` |
+
+Browser redirect SSO (`/oauth/<provider>`) only needs **register** + **`authentication.oauth`**. The OAuth callback allows that provider for the internal authentication call after Grant finishes. Provider names do **not** need to be listed in public [`authStrategies`](./service.md#configuration).
+
+The [Feathers generator](../../guides/cli/authentication.md) already follows this pattern: OAuth providers are configured under `authentication.oauth`, while `authStrategies` typically stays `["jwt", "local"]`.
+
+```json
+// Typical safe config for browser-only OAuth (matches the generator)
+{
+  "authentication": {
+    "authStrategies": ["jwt", "local"],
+    "oauth": {
+      "google": {
+        "key": "<Client ID>",
+        "secret": "<Client secret>"
+      }
+    }
+  }
+}
+```
+
+```json
+// Unsafe for the default OAuthStrategy when you only need browser SSO.
+// Do not list provider names here unless you implement verified token login (flow #2).
+{
+  "authentication": {
+    "authStrategies": ["jwt", "local", "google", "microsoft"]
+  }
+}
+```
+
+<BlockQuote type="warning" label="Important">
+
+Putting an OAuth provider name (for example `google` or `github`) in [`authStrategies`](./service.md#configuration) exposes that strategy on external `POST /authentication`.
+
+The default [`getProfile`](#getprofile-data-params) implementation returns `data.profile` from the authentication payload. That is safe when the payload is built **server-side** by the OAuth callback after Grant. It is **not** safe to accept a client-supplied `profile` (for example `{ strategy: 'google', profile: { sub: '...' } }`) as proof of identity. A provider `sub` or `id` is an identifier, not a credential.
+
+Only add a provider to `authStrategies` when you intentionally support [flow #2](#flow) (existing provider access token) **and** override `getProfile` to verify that token with the provider. See the [Facebook](../../cookbook/authentication/facebook.md) and [Firebase](../../cookbook/authentication/firebase.md) cookbooks for verified-token patterns.
+
+</BlockQuote>
+
 ### Providers
 
 For specific OAuth provider setup see the following [cookbook](../../cookbook/) guides:
@@ -73,22 +122,29 @@ There are two ways to initiate OAuth authentication:
    - User clicks on link to OAuth URL (`oauth/<provider>`)
    - Gets redirected to provider and authorizes the application
    - Callback to the [OauthStrategy](#oauthstrategy) which
-     - Gets the users profile
+     - Gets the users profile (from the server-side Grant response)
      - Finds or creates the user (entity) for that profile
    - The [AuthenticationService](./service.md) creates an access token for that entity
    - Redirects back to the origin URL including the generated access token
    - The frontend (e.g. the Feathers [authentication client](./client.md)) uses the returned access token to authenticate
 
-2. With an existing access token, e.g. obtained through the Facebook mobile SDK
-   - Authenticate normally through t
```

**File**: `docs/api/authentication/service.md` (modified, +2/-2)
```diff
@@ -63,7 +63,7 @@ The following options are available:
 
 - `secret`: The JWT signing secret.
 - `service`: The path of the entity service
-- `authStrategies`: A list of authentication strategy names to allow on this authentication service to create access tokens.
+- `authStrategies`: A list of authentication strategy names allowed for **external** `create` calls (`POST /authentication` / `app.service('authentication').create`). Typical values are `jwt`, `local`, API keys, and only those custom strategies that accept external credentials. [OAuth](./oauth.md) providers used solely via the `/oauth/<provider>` redirect flow should be [registered](#register-name-strategy) and configured under `authentication.oauth`, but are usually **omitted** from this list. See [OAuth configuration and security](./oauth.md#configuration-and-security).
 - `parseStrategies`: A list of authentication strategies that should be used to parse HTTP requests. Defaults to the same as `authStrategies`.
 - `entity`: The name of the field that will contain the entity after successful authentication. Will also be used to set `params[entity]` (usually `params.user`) when using the [authenticate hook](./hook). Can be `null` if no entity is used (see [stateless tokens](../../cookbook/authentication/stateless.md)).
 - `entityId`: The id property of an entity object. Only necessary if the entity service does not have an `id` property (e.g. when using a custom entity service).
@@ -95,7 +95,7 @@ An authentication service configuration in `config/default.json` can look like t
 
 </BlockQuote>
 
-Additionally to the above configuration, most [strategies](./strategy.md) will look for their own configuration under the name it was registered. An example can be found in the [local strategy configuration](./local.md#configuration).
+Additionally to the above configuration, most [strategies](./strategy.md) will look for their own configuration under the name it was registered. An example can be found in the [local strategy configuration](./local.md#configuration). OAuth provider settings live under `authentication.oauth` (see [OAuth options](./oauth.md#options)), which is separate from `authStrategies`.
 
 ## Authentication flows
 
```

**File**: `docs/cookbook/authentication/facebook.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ The client id (App ID) and secret can be found in the Settings of the [Facebook
 
 The standard OAuth strategy only returns the default profile fields (`id` and `name`). To get other fields, like the email or profile picture, the [getProfile](../../api/authentication/oauth.md#getprofile-data-params) method of the [OAuth strategy needs to be customized](../../api/authentication/oauth.md#customization) to call the Graph API profile endpoint `https://graph.facebook.com/me` with an HTTP request library like [Axios](https://developers.facebook.com/tools/explorer/) requesting the additional fields.
 
+This `getProfile` pattern (call Graph with the provider access token) is also **required** if you put `"facebook"` in [`authStrategies`](../../api/authentication/service.md#configuration) so clients can authenticate with `{ strategy: 'facebook', accessToken: '...' }` on `POST /authentication`. Never accept a client-supplied `profile` as identity. Browser-only Facebook login via `/oauth/facebook` does not need the provider in `authStrategies`. See [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
 > __Pro tip:__ Facebook API requests can be tested via the [Graph API explorer](https://developers.facebook.com/tools/explorer/).
 
 The following example allows to log in with Facebook in the [chat application from the guide](../../guides/index.md):
```

**File**: `docs/cookbook/authentication/firebase.md` (modified, +3/-0)
```diff
@@ -16,6 +16,7 @@ Update `config/default.json`:
 ```json
 {
   "authentication": {
+    "authStrategies": ["jwt", "firebase"],
     "oauth": {}
   },
   "firebase": {
@@ -28,6 +29,8 @@ Update `config/default.json`:
 ```
 > Note: Since Firebase can be used for more than just authentication, we'll store our service account in the root of our config. Otherwise, if preferred, you can store under `authentication.oauth`.
 
+`"firebase"` must be listed in `authStrategies` because clients authenticate with `POST /authentication` (flow #2). That is only safe because `getProfile` below calls `verifyIdToken` — never trust a client-supplied profile. See [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
 ## Authentication Strategy
 
 Create a file under `src/firebase.js`:
```

**File**: `docs/cookbook/authentication/google.md` (modified, +2/-0)
```diff
@@ -111,4 +111,6 @@ module.exports = app => {
 ```
 **Important**: googleId, profilePicture and email are properties that should exist on the database model!
 
+Browser Google login uses `/oauth/google`. You do **not** need to add `"google"` to `authentication.authStrategies` for that redirect flow. Only add it if you implement verified provider-token login on `POST /authentication` — see [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
 
```

---

### Incident Patch 9: `4e312b49` (2026-06-27)
**Commit Message**: fix(mongodb): let objectid keyword fail validation (#3691)

Co-authored-by: Deepak kudi <deepakkudi23@adsl-172-10-9-116.dsl.sndg02.sbcglobal.net>

**File**: `packages/mongodb/src/converters.ts` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ export const keywordObjectId = {
         parentData[parentDataProperty] = new ObjectId(value)
         return true
       } catch (error) {
-        throw new Error(`invalid objectid for property "${parentDataProperty}"`)
+        return false
       }
     }
   }
```

**File**: `packages/mongodb/test/converters.test.ts` (modified, +24/-2)
```diff
@@ -89,7 +89,7 @@ describe('objectid keyword', () => {
     assert.equal(typeof data.otherId, 'string')
   })
 
-  it('fails on invalid objectids', async () => {
+  it('fails validation on invalid objectids', async () => {
     const schema = {
       type: 'object',
       properties: {
@@ -104,6 +104,28 @@ describe('objectid keyword', () => {
     }
     assert.equal(typeof data._id, 'string')
 
-    assert.throws(() => validate(data), /invalid objectid for property "_id"/)
+    assert.equal(validate(data), false)
+    assert.equal(validate.errors?.[0].keyword, 'objectid')
+  })
+
+  it('continues validating nullable unions when an objectid branch fails', async () => {
+    const nullableValidator = new Ajv({ coerceTypes: true, useDefaults: true })
+    nullableValidator.addKeyword(keywordObjectId)
+
+    const schema: any = {
+      type: 'object',
+      properties: {
+        refId: {
+          anyOf: [{ type: 'string', objectid: true }, { type: 'null' }],
+          default: null
+        }
+      },
+      additionalProperties: false
+    }
+    const validate = nullableValidator.compile(schema)
+    const data: { refId?: ObjectId | null } = {}
+
+    assert.equal(validate(data), true)
+    assert.equal(data.refId, null)
   })
 })
```

---

### Incident Patch 10: `d7e4cc95` (2026-06-27)
**Commit Message**: fix: Update all dependencies (#3692)

**File**: `docs/package.json` (modified, +19/-19)
```diff
@@ -11,35 +11,35 @@
     "start": "npm run dev"
   },
   "dependencies": {
-    "@vueuse/core": "^14.2.1",
-    "date-fns": "^4.1.0",
-    "element-plus": "^2.13.6",
-    "query-string": "^9.3.1",
-    "shiki": "^4.0.2",
-    "vue": "^3.5.31"
+    "@vueuse/core": "^14.3.0",
+    "date-fns": "^4.4.0",
+    "element-plus": "^2.14.2",
+    "query-string": "^9.4.0",
+    "shiki": "^4.2.0",
+    "vue": "^3.5.38"
   },
   "devDependencies": {
-    "@feathersjs/generators": "^5.0.43",
-    "@iconify-json/carbon": "^1.2.20",
-    "@types/node": "^25.5.0",
-    "@unocss/preset-typography": "^66.6.7",
-    "@unocss/reset": "^66.6.7",
-    "@unocss/transformer-directives": "^66.6.7",
-    "@vitejs/plugin-vue": "^6.0.5",
+    "@feathersjs/generators": "^5.0.45",
+    "@iconify-json/carbon": "^1.2.23",
+    "@types/node": "^26.0.0",
+    "@unocss/preset-typography": "^66.7.2",
+    "@unocss/reset": "^66.7.2",
+    "@unocss/transformer-directives": "^66.7.2",
+    "@vitejs/plugin-vue": "^6.0.7",
     "esno": "^4.8.0",
     "fast-glob": "^3.3.3",
     "flexsearch": "^0.7.31",
     "https-localhost": "^4.7.1",
-    "markdown-it": "^14.1.1",
-    "sass": "^1.98.0",
+    "markdown-it": "^14.2.0",
+    "sass": "^1.101.0",
     "sitemap": "^9.0.1",
-    "unocss": "^66.6.7",
+    "unocss": "^66.7.2",
     "unplugin-auto-import": "^21.0.0",
-    "unplugin-vue-components": "^32.0.0",
-    "vite-plugin-pwa": "^1.2.0",
+    "unplugin-vue-components": "^32.1.0",
+    "vite-plugin-pwa": "^1.3.0",
     "vitepress": "^1.6.4",
     "vitepress-plugin-google-analytics": "^1.0.2",
     "vitepress-plugin-search": "^1.0.4-alpha.22",
-    "workbox-window": "^7.4.0"
+    "workbox-window": "^7.4.1"
   }
 }
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -55,6 +55,6 @@
     "lerna": "^8.1.2",
     "npm-check-updates": "^16.14.20",
     "prettier": "^3.2.5",
-    "typescript": "^5.4.5"
+    "typescript": "^5.9.3"
   }
 }
```

**File**: `packages/adapter-commons/package.json` (modified, +2/-2)
```diff
@@ -57,8 +57,8 @@
   "devDependencies": {
     "@types/mocha": "^10.0.10",
     "@types/mongodb": "^4.0.6",
-    "@types/node": "^25.5.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "mocha": "^11.7.6",
     "mongodb": "^6.19.0",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
```

**File**: `packages/adapter-tests/package.json` (modified, +2/-2)
```diff
@@ -51,8 +51,8 @@
   },
   "devDependencies": {
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-client/package.json` (modified, +3/-3)
```diff
@@ -66,9 +66,9 @@
     "@feathersjs/socketio": "^5.0.45",
     "@feathersjs/socketio-client": "^5.0.45",
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
-    "axios": "^1.14.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "axios": "^1.18.0",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

#### Recent Merged Pull Requests:
- **PR #3706** (2026-09-17): fix(authentication): reject leftover codegen params for user (#3599) (@tonycoder-hub)
- **PR #3705** (2026-09-24): fix(schema): recheck external dispatch after resolving (@akasakariko)
- **PR #3704** (2026-09-11): fix: Update all dependencies (@daffl)
- **PR #3703** (2026-09-11): fix: Update dependencies (@daffl)
- **PR #3701** (2026-09-11): fix(transport-commons): map HEAD requests like GET for REST services (@rome-xi)
- **PR #3700** (2026-08-14): fix(adapter-commons): validate query operators nested in arrays (@marshallswain)
- **PR #3699** (2026-08-11): fix(authentication-oauth): allow any port on loopback OAuth origins (@marshallswain)
- **PR #3698** (2026-08-11): docs(authentication): clarify OAuth authStrategies security (@marshallswain)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
