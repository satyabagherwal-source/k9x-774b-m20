# Forensic Learning Record (Deep Inspection): silexlabs/Silex

> **Canonical Artifact**: `07_PROJECT_LEARNING/silexlabs-silex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/silexlabs/Silex](https://github.com/silexlabs/Silex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:39:17.916Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `silexlabs/Silex`
- **Description**: Silex is an online tool for visually creating static sites with dynamic data. With the free/libre spirit of internet, together.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2991 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `common/constants.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @fileoverview define constants for Silex client and server
 */

export const WEBSITE_DATA_FILE = 'website.json'
export const WEBSITE_META_DATA_FILE = 'meta.json'
export const LEGACY_WEBSITE_PAGES_FOLDER = 'src' // This is used in legacy websites, check the value in EMPTY_WEBSITE
export const WEBSITE_PAGES_FOLDER = 'pages' // This is the default now, if not specified in the website data

export const DEFAULT_WEBSITE_ID = 'default'
export const DEFAULT_LANGUAGE = 'en'
export const CLIENT_CONFIG_FILE_NAME = 'silex.js'

export const API_PATH = '/api'

export const API_CONNECTOR_PATH = '/connector'
export const API_CONNECTOR_USER = '/user'
export const API_CONNECTOR_LIST = ''
export const API_CONNECTOR_LOGOUT = '/logout'
export const API_CONNECTOR_LOGIN = '/login'
export const API_CONNECTOR_SETTINGS = '/settings'
export const API_CONNECTOR_LOGIN_CALLBACK = '/login/callback'

export const API_PUBLICATION_PATH = '/publication'
export const API_PUBLICATION_PUBLISH = ''
export const API_PUBLICATION_STATUS = '/publication/status'

export const API_WEBSITE_PATH = '/website'
export const API_WEBSITE_READ = ''
export const API_WEBSITE_WRITE = ''
export const API_WEBSITE_CREATE = ''
export const API_WEBSITE_DELETE = ''
export const API_WEBSITE_DUPLICATE = '/duplicate'
export const API_WEBSITE_FORK = '/fork'
export const API_WEBSITE_LIST = ''
export const API_WEBSITE_ASSET_READ = '/assets'
export const API_WEBSITE_ASSETS_WRITE = '/assets'
export const API_WEBSITE_META_READ = '/meta'
export const API_WEBSITE_META_WRITE = '/meta'

// Env vars (build time)
// Get env vars from webpack
// @see webpack.config.js
declare const SILEX_VERSION_ENV: string
export let SILEX_VERSION
try { SILEX_VERSION = SILEX_VERSION_ENV } catch (e) {
  // fallback to default value
  SILEX_VERSION = SILEX_VERSION || '3.0.0'
}

export const DEV_MESSAGE = `
__________________________________________________________

  Create static websites visually, with dynamic content,
  in the free spirit of the web.

  ███████ ██ ██      ███████ ██   ██     ██    ██ ██████
  ██      ██ ██      ██       ██ ██      ██    ██      ██
  ███████ ██ ██      █████     ███       ██    ██  █████
       ██ ██ ██      ██       ██ ██       ██  ██       ██
  ███████ ██ ███████ ███████ ██   ██       ████   ██████ ${SILEX_VERSION.slice(1)}

  Users are expected to contribute:

  * Web designers: https://docs.silex.me/en/user/contribute
  * Developers: https://docs.silex.me/en/dev/contribute

__________________________________________________________
`

```

### Core Architecture Module: `common/examples/plugin.js`
```
// This example is used in unit tests
module.exports = function(config) {
  return {
    test: 'example',
  }
}

```

### Core Architecture Module: `common/externs.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */



```

### Core Architecture Module: `common/page.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Page related functions
// This is used on the client and the server
export function getPageSlug(pageName: string | undefined) {
  return (pageName || 'index')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    // Collapse whitespace and replace by -
    .replace(/\s+/g, '-')
    // Collapse dashes
    .replace(/-+/g, '-')
}
export function getPageLink(pageName) {
  return `./${getPageSlug(pageName)}.html`
}

```

### Core Architecture Module: `common/silex-plugins/config.ts`
```
import { Plugin, loadPlugins, } from './plugin.js'
import EventEmitter from 'component-emitter'

export default function( baseUrl: string = null) {
  return new Config(baseUrl)
}

export class Config extends EventEmitter {
  constructor(public baseUrl: string = null) {
    super()
  }

  /**
   * Add one or multiple plugins
   * @param plugin One or more plugin definition object
   * @param options An object containing the plugin options or each plugin options in `options[pluginName]`
   * @returns A Config object which merges the objects returned by the plugin(s)
   */
  public async addPlugin(plugin: Plugin | Plugin[], options: object) {
    // Load plugin if necessary
    const result = await loadPlugins(this, [].concat(plugin), options, this.baseUrl)
    Object.assign(this, result)
    return this
  }
}

```

### Core Architecture Module: `common/silex-plugins/index.ts`
```
export * from './config.js'
export * from './plugin.js'

```

### Core Architecture Module: `common/silex-plugins/plugin.ts`
```
import { Config, } from './config.js'

/**
 * Plugin type
 */
export type Plugin = ((config: Config, options?: object) => object) | Promise<(config: Config, options?: object) => object> | string

/**
 *
 * @param config The initial config object
 * @param plugins The plugins to load
 * @returns Merged results objects
 */
export async function loadPlugins(config: Config, plugins: Plugin[], options: object, baseUrl: string = null): Promise<Config> {
  return Promise.all<Config>(plugins
    // Load plugins
    .map(async (plugin: Plugin) => {
      const [construct, name,] = await ( async () => {
        switch(typeof plugin) {
        case 'function': return [plugin as (config: Config) => Config, plugin.toString(),]
        case 'string': return [await loadPlugin<(config: Config, options: object) => Promise<Config>>(plugin, baseUrl), plugin as string,]
        default: throw new Error(`Unknown type for plugin: ${typeof plugin}`)
        }
      })()
      return construct(config, name && options ? options[name] ?? options : options) as Promise<Config>
    }))
    // Merge the results
    .then((results: Config[]): Config => {
      return results.reduce((finalConfig: Config, result: Config): Config => {
        return {
          ...finalConfig,
          ...result,
        } as Config
      }, config)
    })
}

/**
 * Load a plugin
 * @param location The path, absolute, relative or online
 * @returns The result of the plugin default function
 */
async function loadPlugin<T>(location: string, baseUrl: string): Promise<T> {
  const path = getLocation(location, baseUrl)
  const imported: {default?: () => void} = await dynamicImport(path)
  const result = imported?.default ?? imported
  return result as T
}

function getLocation(urlOrPath: string, baseUrl: string = null): string {
  try {
    return new URL(urlOrPath, baseUrl).toString()
  } catch {
    return urlOrPath
  }
}

/**
 * This is isolated here for unit tests to mock it
 * @param path The absolute path to laod
 * @returns The loaded module
 */
async function dynamicImport<T>(path: string): Promise<T> {
  return import(/* webpackIgnore: true */path)
}

```

### Core Architecture Module: `common/types.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Page } from 'grapesjs'

/**
 * @fileoverview define types for Silex client and server
 */

// Publication API
export interface PublicationSettings {
  connector?: ConnectorData, // Set by the postMessage from the login callback page
  options?: ConnectorOptions, // Options for the publication connector saved with the site
}

export interface WebsiteFile {
  html: string,
  css: string,
  htmlPath: string,
  cssPath: string,
}

export class ApiError extends Error {
  constructor(message: string, public readonly httpStatusCode: number) {
    super(message)
    console.info('API error', httpStatusCode, message)
  }
}

// **
// HTTP API types
export type ApiResponseError = { message: string }
export type ApiPublicationPublishBody = WebsiteData // this contains the connectorId
export type ApiPublicationPublishQuery = { websiteId: WebsiteId, hostingId: ConnectorId, storageId: ConnectorId, options: ConnectorOptions}
/**
 * What publishing answers
 *
 * Always a job: turning the files into a website somebody can visit takes
 * longer than a request. `url` is null until something serves them.
 */
export type ApiPublicationPublishResponse = { url: string | null, job: PublicationJobData }
export type ApiPublicationStatusQuery = { jobId: JobId }
export type ApiPublicationStatusResponse = PublicationJobData
export type ApiWebsiteReadQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteReadResponse = WebsiteData
export type ApiWebsiteListQuery = { connectorId?: ConnectorId }
export type ApiWebsiteListResponse = WebsiteMeta[]
export type ApiWebsiteWriteQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteWriteBody = WebsiteData
export type ApiWebsiteWriteResponse = { message: string }
export type ApiWebsiteCreateQuery = { connectorId?: ConnectorId }
export type ApiWebsiteCreateBody = WebsiteMetaFileContent
export type ApiWebsiteCreateResponse = { message: string }
export type ApiWebsiteDeleteQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteDuplicateQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteForkQuery = { connectorId?: ConnectorId }
export type ApiWebsiteForkBody = { gitlabUrl: string }
export type ApiWebsiteForkResponse = { websiteId: WebsiteId, message: string }
export type ApiWebsiteMetaReadQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteMetaReadResponse = WebsiteMeta
export type ApiWebsiteMetaWriteQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteMetaWriteBody = WebsiteMetaFileContent
export type ApiWebsiteMetaWriteResponse = { message: string }
export type ApiWebsiteAssetsReadQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteAssetsReadParams = { path: string }
export type ApiWebsiteAssetsReadResponse = string
export type ApiWebsiteAssetsWriteQuery = { websiteId: WebsiteId, connectorId?: ConnectorId }
export type ApiWebsiteAssetsWriteBody = ClientSideFile[]
export type ApiWebsiteAssetsWriteResponse = { data: string[] }
export type ApiConnectorListQuery = { type: ConnectorType }
export type ApiConnectorListResponse = ConnectorData[]
export type ApiConnectorLoginQuery = { connectorId: ConnectorId, type: ConnectorType }
export type ApiConnectorLoggedInPostMessage = { type: string, error: boolean, message: string, connectorId: ConnectorId, options: ConnectorOptions, redirect?: string }
export type ApiConnectorLoginCbkQuery = { connectorId?: ConnectorId, type: ConnectorType, error?: string } // May have any other query params from oauth
export type ApiConnectorLoginCbkBody = object // Body from basic auth, POST only, contains options and token
export type ApiConnectorSettingsQuery = { connectorId?: ConnectorId, type: ConnectorType }
export type ApiConnectorSettingsResponse = string // HTML
export type ApiConnectorSettingsPostQuery = { connectorId?: ConnectorId, type: ConnectorType }
export type ApiConnectorSettingsPostBody = ConnectorUserSettings
export type ApiConnectorSettingsPostResponse = { message: string }
export type ApiConnectorLogoutQuery = { connectorId?: ConnectorId, type: ConnectorType }
export type ApiConnectorUserQuery = { connectorId?: ConnectorId, type: ConnectorType }
export type ApiConnectorUserResponse = ConnectorUser

// **
// Website API
export const EMPTY_PAGES = [{}] as Page[] // This is what grapesjs understands, it will create an empty page

export const EMPTY_WEBSITE: WebsiteData = {
  //pages: [],
  //assets: [],
  //styles: [],
  //settings: {},
  //fonts: [],
  //symbols: [],
  //publication: {},
  pages: EMPTY_PAGES,
  pagesFolder: 'pages',
} as WebsiteData

export interface WebsiteData {
  pages: Page[],
  assets: Asset[],
  styles: Style[],
  //name: string,
  settings: WebsiteSettings,
  pagesFolder: string,
  fonts: Font[],
  symbols: symbol[],
  publication: PublicationSettings,
}

export interface PublicationData extends WebsiteData {
  files?: ClientSideFile[], // Added by the client for publish
}

export interface WebsiteSettings {
  description?: string,
  title?: string,
  lang?: string,
  head?: string,
  favicon?: string,
  'og:title'?: string,
  'og:description'?: string,
  'og:image'?: string,
}

/**
 * A step of the site's build.json, `build` = the Silex build commands of the moment
 */
export type BuildStep = { type: 'build' } | { type: 'sh', value: string }

export interface Font {
  name: string,
  value: string,
  variants: string[],
}

//export interface Frame {
//  component: { type: string, stylable: string[] },
//  components: Component[],
//}
//
//export interface Component {
//  type: string,
//  content?: string,
//  attributes: { [key: string]: string },
//  conponents: Component[],
//}

export enum Unit {
  PX = 'px',
}

export interface Asset {
  type: string,
  src: string,
  unitDim: Unit,
  height: number,
  width: number,
  name: string,
  path?: string, // Set by the publication renderer, this is the path in the hosting storage after publication
}

export interface Style {
  selectors: Selector[],
  style: { [key: string]: string },
}

export type Selector = string | {
  name: string,
  type: number,
}

// **
// Connector API
/**
 * Type for a connector id
 */
export type ConnectorId = string

export type ConnectorOptions = {
  websiteUrl?: string, // For publication UI
  [key: string]: any,
}

export enum ClientSideFileType {
  HTML = 'html',
  ASSET = 'asset',
  CSS = 'css',
  OTHER = 'other',
}

export enum Initiator {
  HTML = 'html',
  CSS = 'css',
}

/**
 * Type for a client side file when the content is not available, used to handle file names and paths and urls
 */
export interface ClientSideFileWithPermalink {
  path: string, // Path in the connector
  permalink?: string, // Defaults to path, this the path where the file is served, it is used to link to the file
  type: ClientSideFileType,
}

/**
 * Type for a client side file when the content is available as a string
 */
export interface ClientSideFileWithContent extends ClientSideFileWithPermalink {
  content: string, // Not buffer because it's sent from the client in JSON
}

/**
 * Type for a client side file when the content is in the connector
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1860** (2026-09-18): **MCP symbols_unlink fails with "missing param component"**
  *Symptoms*: Calling `symbols_unlink` returns an error: `Can not unlink the component: missing param component`. Seen on Silex Desktop built from `main` on 16 September 2026.  1. Open Silex Desktop and connect an AI agent to its MCP server. 2. Ask the agent to create a website, add a text and turn it into a symbol. 3. Ask the agent to unlink the symbol. The agent gets the error above.  The tool takes no parameter, but the command it runs expects a `component`. It should unlink the selected element. 

- **Issue #1855** (2026-09-27): **Opening a template fails when the user is connected to another GitLab instance**
  *Symptoms*: Reported by ceubri on the forum: https://community.silex.me/d/317  A user connected with the gitlab connector but from another instance than gitlab.com - e.g. framagit.org, cannot open any template. They get `Project not found: silex-templates/silex_devdocs-template`. The template does exist, but on gitlab.com, and Silex looks for it on framagit.org.  How to reproduce:  1. Open https://v3.silex.me/ and log in with framagit.org 2. Create a new website, click on "from a template" 3. Click "Open in Silex" on any template 4. You get `Project not found: silex-templates/silex_devdocs-template`  The same steps work when you log in with gitlab.com.  Why this happens:  - templates are always on gitlab.com, in a public repo - GitLab cannot fork a project of a different instance  How to fix it:  * GitLab connector should fork only if the user is logged in on gitlab.com * otherwise, create the project with `import_url`, the "Repository by URL" import of the GitLab API * the destination instance must have this import source enabled. It is on by default on gitlab.com, to be checked on framagit.org  FTP and the local storage will be covered separately in #1856. Templates never worked there at all.  

- **Issue #1850** (2026-09-11): **Text align "justified" writes an invalid CSS value**
  *Symptoms*: Thanks to Saumon for reporting this on the forum, and thanks to Brice (ceubri) for finding the cause.  Forum thread: https://community.silex.me/d/315-question-alignement-de-texte  ## What we want  Set a text to justified, with the Text align option in the Typography section.  ## What we get  An invalid CSS value: `text-align: justified`  The valid CSS value is `justify`. The browser ignores the invalid one, so the text stays aligned to the left. Left, center and right work fine, only "justified" is broken.  Workaround until this is fixed: open the gear icon on the left, go to the "Code" tab, and add your own CSS rule with `text-align: justify`  ## Also  The same kind of mistake can be somewhere else. Please look at the other style options too, in every section, and check that each one writes a valid CSS value.  ## How to test  1. Run the editor: `pnpm install` then `pnpm run dev`, and open http://localhost:6805 2. Add a text block with two long paragraphs 3. In the Typography section, set Text align to "justified" 4. Look at the generated CSS: it must be `text-align: justify` 5. Look at the page in the browser: the text must really be justified, with both edges aligned  Please test it yourself in a browser and add a screenshot in your pull request. It helps us review much faster. 
  **Post-Mortem & Fix Analysis**:
  > While looking at the style options, we saw three other things. They are not confirmed bugs, so please check each one before you change it:  - `text-decoration-line` offers `blink`. This value is deprecated and does nothing in modern browsers. It should probably be removed. - `text-align` has no `start` and `end` options. Both are valid CSS and they help with right to left languages. Adding them is optional, tell us what you think. - `scroll-snap-type` is a composite option with two parts named `scroll-snap-type-direction` and `scroll-snap-type-mode`. These two names are not real CSS properties. Please check in the browser what the editor really writes. It should be one rule like `scroll-snap-type: x mandatory` 

- **Issue #1845** (2026-09-27): **Removing an attribute does not remove it from the canvas**
  *Symptoms*: When you remove an attribute in the Attributes section of the element settings, the attribute stays on the element in the canvas. It only goes away after a reload.  Steps to reproduce, in Silex:  1. Select any element in the editor 2. Open the element settings and go to the Attributes section 3. Click "+" and add an attribute named `title` with the value `hello` 4. Remove that same attribute from the list  Then, in the browser developer tools:  5. Inspect the element inside the editor canvas 6. The attribute `title="hello"` is still on the element  Expected: the attribute is removed from the element in the canvas as soon as you remove it from the list.  Actual: the attribute stays until you reload the page. After a reload the website opens without the attribute, so the saved data is correct and only the canvas is out of date.  Tested on v3.silex.me and on canary.silex.me.  One more thing to check: the HTML content and Visibility condition fields are rendered the same way. Please check if they have the same problem.  @SparshM07 you have worked on the editor recently. Would you like to take this one? 
  **Post-Mortem & Fix Analysis**:
  > Sure lexoyo! I would love to work on this...but I'm currently working on my college project..So i would need 4-5 days time!! 
  > Hi lexoyo!! Now, I am going to work on this 
  > Excellent :) Let me know if I can help

- **Issue #1841** (2026-09-27): **Preview mode cannot be left with the keyboard**
  *Symptoms*: ### What happens  There is no way out of preview mode with the keyboard. Escape was pressed twice, nothing happened.  The only way out is the `gjs-off-prv` icon: 24 px, no label, in the very corner of the screen at (0,0). In the desktop app there is no browser tab to fall back on, so a user who does not find that icon is stuck in the preview.  ### Expected  Escape leaves the preview.  Found during the manual test session of #1837, 26 August 2026. 

- **Issue #1839** (2026-09-11): **Deleting a page asks nothing, and the trash icon is in the middle of the row**
  *Symptoms*: ### What happens  Clicking the trash icon in the Pages panel deletes the page at once. There is no confirmation, and there is no undo for it. A page was really lost this way while testing.  The icon is also in the middle of the row. Measured at the default panel width (147 px), across the height of a row:  | position in the row | what is there | |---|---| | 10 % | the page name, selects the page | | 25 % | the drag handle | | **50 %** | **the trash icon, deletes the page** | | 75 % and 90 % | the gear icon |  So the area that selects a page is about 15 % of the row, and the natural click "I want this page" lands on delete.  ### Where it is  `editor/grapesjs/page-panel.ts:275` wires the trash icon to `removePage()`.  A `removePageWithConfirm()` already exists in the same file, line 104, with an "Are you sure?" dialog and a Cancel button. It is only wired to the `cmdRemovePage` command, line 315. There are two ways to delete a page, only one asks, and it is not the one users click.  ### Expected  Deleting a page asks for confirmation, whichever way it is triggered. And the click target that selects a page is bigger than the one that destroys it.  Found during the manual test session of #1837, 26 August 2026. 

- **Issue #1824** (2026-08-19): **[Windows] Server crashes at startup loading .silex.js — ESM loader rejects C:\ paths (even when no config file exists)**
  *Symptoms*: Reported by @SparshM07 while testing #1807 on Windows (thank you!): the dev server crashes at startup while loading `server/deploy/.silex.js`, because Node's ESM loader rejects the Windows absolute path. This blocks every Windows contributor at their first server start.  ## Reproduction  On Windows, clone the repo, install, build, then start the server. It aborts with `ERR_UNSUPPORTED_ESM_URL_SCHEME` (protocol `c:`) while loading the default config file — whether or not a `.silex.js` file exists.  ## Root cause  - `server/config.ts` resolves the default config path to a Windows absolute path (`C:\...\server\deploy\.silex.js`) and always attempts to load it. - `common/silex-plugins/plugin.ts` (`getLocation`) runs the path through `new URL()`. On Windows this does not throw: the drive letter `C:` parses as a URL scheme, so the dynamic `import()` receives a `c:` protocol URL, which Node's ESM loader rejects (`Only URLs with a scheme in: file, data, node are supported`). - The catch in `loadSilexConfig()` only treats `MODULE_NOT_FOUND` as "no config file, continue" — the ESM error doesn't match, so it is fatal even when no config file exists.  ## Fix direction  - Convert filesystem paths to `file://` URLs with `pathToFileURL()` (from `node:url`) before the dynamic import. This belongs on the server side (`server/config.ts`, or a server-only branch in the plugin loader): `common/silex-plugins/plugin.ts` also runs in the browser, where the current URL handling is correct. - A missi
  **Post-Mortem & Fix Analysis**:
  > Hi, I’d like to work on a fix for this Windows ESM path issue. I’ll convert the server-side config paths to file: URLs and add regression tests.. ..Please let me know if there’s a preferred approach...
  > Great, thank you @SparshM07  I'll take a look soon 👍 

- **Issue #1820** (2026-08-12): **CSS variables always get deleted**
  *Symptoms*: ### What happened?  CSS variables are cleared everytime the project is closed.  ### Steps to reproduce  1. Open a silex project (in this case its the desktop app) 2. Make a css variable 3. Leave the project and reenter 4. CSS variables no longer show in the menu, however, you can create a new one with the same name, and it works as expected.  <img width="981" height="654" alt="Image" src="https://github.com/user-attachments/assets/2d6cb17c-a202-4850-a36a-fcf0f95c1f43" />  ### Silex version  Selfhosted desktop app  ### Environment  _No response_  ### Logs, screenshots, or anything else  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hello Got it! I reproduced and it should be fixed in the next release Stay tuned, this issue will be updated Thank you for the bug report (feel free to share your use case here or in the forums, I need more feedback :)
  > Thank you for the quick response! The usecase of my app is to control our scorebug! I just use CSS variables for development, in production the team color's are controlled from the backend.   I'll mark it as closed, thanks again for fixing this.

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

### Incident Patch 1: `95018d37` (2026-09-30)
**Commit Message**: fix(server): keep file paths inside the storage folder (#1882)

**File**: `server/connectors/FsHosting.ts` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@
 import fs from 'fs/promises'
 import { ConnectorFile, StorageConnector, HostingConnector, StatusCallback, ConnectorSession, contentToString, toConnectorData, ConnectorFileContent} from './connectors.js'
 import { join } from 'path'
-import { FsStorage } from './FsStorage.js'
+import { FsStorage, underPath } from './FsStorage.js'
 import { ConnectorType, JobData, JobStatus, PublicationJobData, WebsiteId } from '~/common/types.js'
 import { JobManager } from '../jobs.js'
 
@@ -59,7 +59,7 @@ export class FsHosting extends FsStorage implements HostingConnector<FsSession>
   }
 
   async getUrl(session: FsSession, id: WebsiteId): Promise<string> {
-    const filePath = join(this.options.path, id, 'index.html')
+    const filePath = underPath(this.options.path, id, 'index.html')
     const fileUrl = new URL(filePath, 'file://')
     return fileUrl.toString()
   }
```

**File**: `server/connectors/FsStorage.test.ts` (modified, +28/-0)
```diff
@@ -53,3 +53,31 @@ describe('FsStorage website', () => {
     expect(parsed).toEqual(EMPTY_WEBSITE)
   })
 })
+
+describe('FsStorage path confinement', () => {
+  function connector() {
+    return new FsStorage({} as ServerConfig, {
+      path: storageRootPath,
+      assetsFolder,
+    })
+  }
+
+  it('should read an asset of the website', async () => {
+    const storage = connector()
+    const id = await storage.createWebsite(dummySession, { name: 'dummy name', connectorUserSettings: {} })
+    await storage.writeAssets(dummySession, id, [{ path: '/asset.txt', content: 'hello' }])
+    const content = await storage.readAsset(dummySession, id, 'asset.txt')
+    expect(content.toString()).toBe('hello')
+  })
+
+  it('should refuse an asset name which leads out of the website', async () => {
+    const storage = connector()
+    const id = await storage.createWebsite(dummySession, { name: 'dummy name', connectorUserSettings: {} })
+    await expect(storage.readAsset(dummySession, id, '../../../../etc/hostname')).rejects.toThrow()
+    await expect(storage.writeAssets(dummySession, id, [{ path: '/../../../pwned.txt', content: 'pwned' }])).rejects.toThrow()
+  })
+
+  it('should refuse a website id which leads out of the storage folder', async () => {
+    await expect(connector().updateWebsite(dummySession, '../../evil', dummyWebsite as any)).rejects.toThrow()
+  })
+})
```

**File**: `server/connectors/FsStorage.ts` (modified, +28/-17)
```diff
@@ -18,8 +18,8 @@
 import fs from 'fs/promises'
 import { createWriteStream } from 'fs'
 import { ConnectorFile, StorageConnector, StatusCallback, ConnectorSession, toConnectorData, ConnectorFileContent} from './connectors.js'
-import { dirname, join } from 'path'
-import { ConnectorUser, WebsiteMeta, JobStatus, WebsiteId, ConnectorType, WebsiteMetaFileContent, WebsiteData, EMPTY_WEBSITE, ConnectorOptions } from '~/common/types.js'
+import { dirname, join, resolve, sep } from 'path'
+import { ApiError, ConnectorUser, WebsiteMeta, JobStatus, WebsiteId, ConnectorType, WebsiteMetaFileContent, WebsiteData, EMPTY_WEBSITE, ConnectorOptions } from '~/common/types.js'
 import { userInfo } from 'os'
 import { requiredParam } from '../utils/validation.js'
 import { ServerConfig } from '../config.js'
@@ -52,6 +52,17 @@ async function copyDir(src, dest) {
 }
 
 
+// Website ids, page paths and asset names come from the client, and the file
+// may not exist yet, so `..` is resolved on the path itself, not on the disk
+export function underPath(root: string, ...parts: string[]): string {
+  const rootPath = resolve(root)
+  const path = resolve(join(rootPath, ...parts))
+  if (path !== rootPath && !path.startsWith(rootPath + sep)) {
+    throw new ApiError('Invalid path: it leads out of the storage folder', 400)
+  }
+  return path
+}
+
 type FsSession = ConnectorSession
 
 const USER_ICON = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' height=\'1em\' viewBox=\'0 0 448 512\'%3E%3Cpath d=\'M304 128a80 80 0 1 0 -160 0 80 80 0 1 0 160 0zM96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM49.3 464H398.7c-8.9-63.3-63.3-112-129-112H178.3c-65.7 0-120.1 48.7-129 112zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3z\'/%3E%3C/svg%3E'
@@ -147,15 +158,15 @@ export class FsStorage implements StorageConnector<FsSession> {
   async setWebsiteMeta(session: any, id: string, data: WebsiteMetaFileContent): Promise<void> {
     const websiteId = requiredParam<WebsiteId>(id, 'website id')
     const content = stringify(data)
-    const path = join(this.options.path, id, WEBSITE_META_DATA_FILE)
+    const path = underPath(this.options.path, id, WEBSITE_META_DATA_FILE)
     await fs.writeFile(path, content)
   }
 
   async getWebsiteMeta(session: FsSession, id: WebsiteId): Promise<WebsiteMeta> {
     const websiteId = requiredParam<WebsiteId>(id, 'website id')
     // Get stats for website folder
-    const fileStat = await fs.stat(join(this.options.path, websiteId))
-    const path = join(this.options.path, websiteId, WEBSITE_META_DATA_FILE)
+    const fileStat = await fs.stat(underPath(this.options.path, websiteId))
+    const path = underPath(this.options.path, websiteId, WEBSITE_META_DATA_FILE)
     // Get meta file
     const content = await fs.readFile(path)
     const meta = await JSON.parse(content.toString())
@@ -183,7 +194,7 @@ export class FsStorage implements StorageConnector<FsSession> {
 
   async readWebsite(session: FsSession, websiteId: WebsiteId): Promise<WebsiteData> {
     const id = requiredParam<WebsiteId>(websiteId, 'website id')
-    const path = join(this.options.path, id, WEBSITE_DATA_FILE)
+    const path = underPath(this.options.path, id, WEBSITE_DATA_FILE)
 
     const content = await fs.readFile(path)
     const websiteDataContent = content.toString()
@@ -192,7 +203,7 @@ export class FsStorage implements StorageConnector<FsSession> {
     const parsedData = JSON.parse(websiteDataContent)
     // Use the merge function to reconstruct website data
     const pageLoader = async (pagePath: string): Promise<string> => {
-      const fullPath = join(this.options.path, id, pagePath)
+      const fullPath = underPath(this.options.path, id, pagePath)
       const pageContent = await fs.readFile(fullPath)
       return pageContent.toString()
     }
@@ -202,7 +213,7 @@ export class FsStorage implements StorageConnector<FsSession> {
 
   async updateW
```

---

### Incident Patch 2: `18b50ab2` (2026-09-27)
**Commit Message**: fix(gitlab): import templates by URL when connected to another GitLab instance (#1863)

**File**: `server/plugins/GitlabConnector.test.ts` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+import { expect, jest, beforeEach, afterEach, it, describe } from '@jest/globals'
+import { ServerConfig } from '~/server/config'
+import { ApiError } from '~/common/types'
+import GitlabConnector from './GitlabConnector'
+
+const TEMPLATE_PATH = 'silex-templates/silex_devdocs-template'
+const TEMPLATE_API_URL = 'https://gitlab.com/api/v4/projects/silex-templates%2Fsilex_devdocs-template'
+const TEMPLATE_REPO_URL = 'https://gitlab.com/silex-templates/silex_devdocs-template.git'
+const ACCESS_TOKEN = 'dummy-access-token'
+const NEW_PROJECT_ID = 42
+
+const fetchMock = jest.fn<typeof fetch>()
+const realFetch = global.fetch
+
+const session = {
+  gitlab: {
+    token: { access_token: ACCESS_TOKEN },
+  },
+}
+
+function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
+  return new Response(JSON.stringify(body), {
+    status,
+    statusText,
+    headers: { 'content-type': 'application/json' },
+  })
+}
+
+function createConnector(domain: string): GitlabConnector {
+  return new GitlabConnector({} as ServerConfig, {
+    clientId: 'dummy client id',
+    clientSecret: 'dummy client secret',
+    domain,
+  })
+}
+
+type Route = [method: string, url: string, response: () => Response]
+
+// Route each mocked request by method and URL (without the query string), so the tests read like the GitLab API
+function mockGitlab(routes: Route[]) {
+  fetchMock.mockImplementation(async (input, init) => {
+    const url = String(input)
+    const method = init?.method ?? 'GET'
+    const route = routes.find(([m, u]) => m === method && url.split('?')[0] === u)
+    if (!route) throw new Error(`Unexpected request ${method} ${url}`)
+    return route[2]()
+  })
+}
+
+function requests(): Array<{ method: string, url: string, body?: any }> {
+  return fetchMock.mock.calls.map(([input, init]) => ({
+    method: init?.method ?? 'GET',
+    url: String(input),
+    body: init?.body ? JSON.parse(String(init.body)) : undefined,
+  }))
+}
+
+beforeEach(() => {
+  global.fetch = fetchMock as typeof fetch
+  fetchMock.mockReset()
+  // The connector logs every API error, keep the test output readable
+  jest.spyOn(console, 'error').mockImplementation(() => {})
+  jest.spyOn(console, 'info').mockImplementation(() => {})
+})
+
+afterEach(() => {
+  global.fetch = realFetch
+  jest.restoreAllMocks()
+})
+
+describe('GitlabConnector forkWebsite on gitlab.com', () => {
+  const DOMAIN = 'https://gitlab.com'
+  let connector: GitlabConnector
+
+  beforeEach(() => {
+    connector = createConnector(DOMAIN)
+  })
+
+  it('forks the project and waits for the fork to finish', async () => {
+    mockGitlab([
+      ['GET', `${TEMPLATE_API_URL}`, () => jsonResponse({ id: 1, name: 'silex_devdocs-template' })],
+      ['POST', `${TEMPLATE_API_URL}/fork`, () => jsonResponse({ id: NEW_PROJECT_ID, import_status: 'scheduled' })],
+      ['GET', `${DOMAIN}/api/v4/projects/${NEW_PROJECT_ID}`, () => jsonResponse({ id: NEW_PROJECT_ID, import_status: 'finished' })],
+    ])
+
+    await expect(connector.forkWebsite(session, TEMPLATE_PATH)).resolves.toBe(String(NEW_PROJECT_ID))
+
+    const calls = requests()
+    expect(calls.map(({ method, url }) => `${method} ${url.split('?')[0]}`)).toEqual([
+      `GET ${TEMPLATE_API_URL}`,
+      `POST ${TEMPLATE_API_URL}/fork`,
+      `GET ${DOMAIN}/api/v4/projects/${NEW_PROJECT_ID}`,
+    ])
+    // Every call is made with the user's token, on gitlab.com
+    calls.forEach(({ url }) => expect(url).toContain(`access_token=${ACCESS_TOKEN}`))
+    // The fork request is unchanged
+    expect(calls[1].body).toEqual({
+      name: expect.stringMatching(/^silex_devdocs-template \d{4}-\d{2}-\d{2} [a-z0-9]*$/),
+      path: expect.stringMatching(/^silex_devdocs-template-\d{4}-\d{2}-\d{2}-?[a-z0-9]*$/),
+      visibility: 'private',
+    })
+    expect(calls[1].body).not.toHaveProperty('import_url')
+  })
+})
+
+describe('GitlabConnector forkWebsite on another GitLab instance', () => {
+  const DOMAIN
```

**File**: `server/plugins/GitlabConnector.ts` (modified, +66/-26)
```diff
@@ -36,6 +36,8 @@ import { stringify, split, merge, getPagesFolder } from '~/server/utils/websiteD
 const MAX_BATCH_UPLOAD_SIZE = 100
 const MAX_BODY_SIZE_KB = 8 * 1000 * 1024 // 8MB (note that 10 MB PNG → becomes ~13.3 MB → ❌ often too big for Gitlab)
 const WEBSITE_DATA_FILE_FORMAT_VERSION = '1.0.0'
+// The templates are public projects on gitlab.com, whatever instance the user is connected to
+const TEMPLATES_DOMAIN = 'https://gitlab.com'
 
 export interface GitlabOptions {
   clientId: string
@@ -120,6 +122,13 @@ interface GitlabFetchCommits {
   since: string
 }
 
+interface GitlabCreateProject {
+  name: string
+  path?: string
+  visibility?: 'private' | 'internal' | 'public'
+  import_url?: string
+}
+
 
 // interface MetaRepoFileContent {
 //   websites: {
@@ -306,7 +315,7 @@ export default class GitlabConnector implements StorageConnector {
     session: GitlabSession,
     path: string,
     method?: 'POST' | 'GET' | 'PUT' | 'DELETE',
-    requestBody?: GitlabWriteFile | GitlabGetToken | GitlabWebsiteName | GitlabCreateBranch | GitlabGetTags | GitlabCreateTag | GitlabFetchCommits | null,
+    requestBody?: GitlabWriteFile | GitlabGetToken | GitlabWebsiteName | GitlabCreateBranch | GitlabGetTags | GitlabCreateTag | GitlabFetchCommits | GitlabCreateProject | null,
     params?: any,
     responseHeaders?: any,
   }): Promise<any> {
@@ -934,6 +943,9 @@ export default class GitlabConnector implements StorageConnector {
 
   /**
    * Fork an external/public GitLab project (from any user/organization)
+   * The source project lives on gitlab.com, where the templates are. GitLab can only
+   * fork within one instance, so when the user is connected to another instance
+   * (e.g. framagit.org) the project is created from the source repository URL instead
    * @param session - The user session
    * @param gitlabUrl - The project path in the "username/repo" format
    * @returns The new website ID (project ID)
@@ -947,41 +959,43 @@ export default class GitlabConnector implements StorageConnector {
 
     // URL-encode the project path for the API
     const encodedPath = encodeURIComponent(projectPath)
+    const canFork = this.isUsingOfficialInstance()
 
     // First, get the source project info to extract its name
-    let sourceProject: any
+    const sourceProject = await this.getSourceProject(session, projectPath, canFork)
+
+    // Generate a unique name for the fork
+    const sourceName = sourceProject.name.replace(this.options.repoPrefix, '')
+    const forkName = `${sourceName} ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).substring(2, 4)}`
+    const newProject: GitlabCreateProject = {
+      name: this.options.repoPrefix + forkName,
+      path: sanitizeGitlabPath(this.options.repoPrefix + forkName),
+      visibility: 'private',
+    }
+
+    // Fork the project to the user's namespace, or import it by URL on another instance
+    let forkedProject: any
     try {
-      sourceProject = await this.callApi({
+      forkedProject = await this.callApi(canFork ? {
         session,
-        path: `api/v4/projects/${encodedPath}`,
-        method: 'GET',
+        path: `api/v4/projects/${encodedPath}/fork`,
+        method: 'POST',
+        requestBody: newProject,
+      } : {
+        session,
+        path: 'api/v4/projects/',
+        method: 'POST',
+        requestBody: { ...newProject, import_url: sourceProject.http_url_to_repo },
       })
     } catch (e) {
-      if (e.httpStatusCode === 404) {
-        throw new ApiError(`Project not found: ${projectPath}. Make sure the project exists and is public or you have access to it.`, 404)
+      // GitLab answers 403 when the "Repository by URL" import source is disabled on the instance
+      if (!canFork && e.httpStatusCode === 403) {
+        throw new ApiError(`Could not import the project ${projectPath}: the "Repository by URL" import source is disabled on ${this.options.domain}. Ask the administrator of this GitLab instance to ena
```

---

### Incident Patch 3: `c98ca7a6` (2026-09-27)
**Commit Message**: fix(editor): allow leaving preview mode with Escape key (#1844)

**File**: `editor/grapesjs/keymaps.ts` (modified, +4/-2)
```diff
@@ -28,15 +28,17 @@ function resetPanel(editor: Editor): void {
 }
 
 /**
- * Escapes the current context in this order : modal, Publish dialog, left panel.
+ * Escapes the current context in this order : preview mode, modal, Publish dialog, left panel.
  * If none of these are open, it selects the body.
  * @param editor The editor.
  */
 function escapeContext(editor: Editor): void {
   const publishDialog = (editor as PublishableEditor).PublicationManager.dialog
   const projectBarPanel = editor.Panels.getPanel('project-bar-panel')
 
-  if (editor.Modal.isOpen()) {
+  if (editor.Commands.isActive('preview')) {
+    editor.stopCommand('preview')
+  } else if (editor.Modal.isOpen()) {
     editor.Modal.close()
   } else if (publishDialog && publishDialog.isOpen) {
     publishDialog.closeDialog()
```

---

### Incident Patch 4: `b91d4596` (2026-09-27)
**Commit Message**: fix(data-source): synchronize live canvas DOM (#1862)

**File**: `grapesjs-plugins/grapesjs-data-source/src/integration.test.ts` (modified, +592/-3)
```diff
@@ -5,22 +5,23 @@
 import { jest } from '@jest/globals'
 import fs from 'fs'
 import path from 'path'
-import grapesjs from 'grapesjs'
+import grapesjs, { Editor } from 'grapesjs'
 import plugin from './index'
-import { Type, Field, DataSourceType } from './types'
+import { Type, Field, DataSourceType, Properties, COMPONENT_STATE_CHANGED } from './types'
 import { addDataSource } from './api'
 import { GQLField, GQLType } from './datasources/GraphQL'
 import { FieldKind, IDataSource } from '../dist'
 import { setPreviewData } from './api'
 import { compare, GroupingReporter } from 'dom-compare'
 import { diff as jestDiff } from 'jest-diff'
+import { setState, removeState } from './model/state'
+import { getFixedToken } from './utils'
 
 // ////
 // Use require instead of import so the TextEncoder/TextDecoder polyfill is set before jsdom loads (avoids hoisting).
 /* @ts-expect-error Workaround jest+jsdom bug */
 import { TextEncoder, TextDecoder } from 'util'
 import { doRender } from './view/canvas'
-;import { act } from 'react'
 (global as any).TextEncoder = TextEncoder
 ;(global as any).TextDecoder = TextDecoder
 ;(global as any).ReadableStream = require('stream/web').ReadableStream
@@ -502,3 +503,591 @@ _______________________
     })
   })
 })
+
+describe('Issue #1845 - Live canvas synchronization', () => {
+  let container: HTMLDivElement
+  let editor: Editor
+
+  beforeEach((done) => {
+    container = document.createElement('div')
+    document.body.appendChild(container)
+
+    editor = grapesjs.init({
+      container,
+      headless: false,
+      plugins: [plugin],
+      pluginsOpts: {
+        [plugin.toString()]: {
+          view: {
+            el: null,
+            previewRefreshEvents: '',
+          },
+          filters: 'liquid',
+        },
+      },
+    })
+
+    editor.on('load', () => {
+      done()
+    })
+  })
+
+  afterEach(async () => {
+    try {
+      editor.select(null)
+    } catch {
+      // Ignore if editor already destroyed or no selection
+    }
+    await new Promise(resolve => setTimeout(resolve, 250))
+    editor.destroy()
+    container.remove()
+  })
+
+  test('A. Attribute addition: model attribute title="hello" -> canvas DOM contains title="hello"', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-add">Test</div>')
+    expect(comp.view?.el.hasAttribute('title')).toBe(false)
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+
+    doRender(editor)
+
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+  })
+
+  test('B. Attribute update: title="hello" -> title="world" -> canvas DOM contains title="world"', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-update">Test</div>')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('world')],
+    }, false)
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('world')
+  })
+
+  test('C. Attribute removal: title="hello" -> remove title -> canvas DOM no longer contains title', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-rm">Test</div>')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+
+    // Remove the attribute
+    removeState(comp, 'test-attr-title', false)
+
+    // Render preview again
+    doRender(editor)
+
+    // Expected: title attribute must disappear from canvas DOM immediately without reload
+    expect(comp.view?.el.hasAttribute('title')).toBe(false)
+  })
+
+  test('D. Multiple attributes: title="hello", data-test="123" -> remove 
```

**File**: `grapesjs-plugins/grapesjs-data-source/src/view/canvas.ts` (modified, +99/-6)
```diff
@@ -357,9 +357,73 @@ export function isComponentVisible(
   }
 }
 
+// Tracks attribute names that were dynamically applied by data-source to each live DOM element
+const renderedAttributesMap = new WeakMap<Element, Set<string>>()
+
+// Tracks elements that currently have dynamic innerHTML applied
+const renderedInnerHTMLMap = new WeakSet<Element>()
+
+function restoreAttribute(
+  component: Component,
+  el: Element,
+  attrName: string,
+): void {
+  if (attrName === 'class') {
+    // If GrapesJS view provides updateClasses, use it directly as it properly
+    // restores the model classes and re-applies runtime status classes (e.g. gjs-selected)
+    const view = component.view as (Component['view'] & { updateClasses?: () => void; updateStatus?: () => void }) | undefined
+    if (view?.updateClasses) {
+      view.updateClasses()
+      return
+    }
+
+    const classes = (component.getClasses ? component.getClasses() : []) as (string | { get?: (k: string) => unknown; name?: string })[]
+    const classList = classes
+      .map(c => (typeof c === 'string' ? c : (c?.get ? String(c.get('name')) : c?.name) || String(c)))
+      .filter(Boolean)
+    if (classList.length > 0) {
+      el.setAttribute('class', classList.join(' '))
+    } else {
+      const baseAttrs: Record<string, unknown> = (component.getAttributes ? component.getAttributes() : component.get?.('attributes')) || {}
+      const baseVal = baseAttrs['class']
+      if (baseVal !== undefined && baseVal !== null && baseVal !== '') {
+        el.setAttribute('class', String(baseVal))
+      } else {
+        el.removeAttribute('class')
+      }
+    }
+    view?.updateStatus?.()
+    return
+  }
+
+  const baseAttrs: Record<string, unknown> = (component.getAttributes ? component.getAttributes() : component.get?.('attributes')) || {}
+  const baseVal = baseAttrs[attrName]
+  if (baseVal !== undefined && baseVal !== null) {
+    if (typeof baseVal === 'boolean') {
+      if (baseVal) {
+        el.setAttribute(attrName, '')
+      } else {
+        el.removeAttribute(attrName)
+      }
+    } else {
+      el.setAttribute(attrName, String(baseVal))
+    }
+  } else {
+    el.removeAttribute(attrName)
+  }
+}
+
 function renderAttributes(
   component: Component,
 ): void {
+  const el = component.view?.el
+  if (!el) {
+    return
+  }
+
+  const prevAttributes = renderedAttributesMap.get(el) || new Set<string>()
+  const currentAttributes = new Set<string>()
+
   const privateStates = component.get('privateStates') || []
   privateStates.forEach((state: {id: string, expression: StoredToken[], label?: string}) => {
     // Skip condition states and internal data states - they should not become HTML attributes
@@ -369,16 +433,32 @@ function renderAttributes(
         state.id !== Properties.condition &&
         state.id !== Properties.condition2 &&
         state.expression) {
+      const attrName = state.label || state.id
       try {
         const value = evaluateExpression(state.expression, component, true)
         if (value !== null && value !== undefined) {
-          component.view?.el.setAttribute(state.label || state.id, String(value))
+          el.setAttribute(attrName, String(value))
+          if (attrName === 'class') {
+            const view = component.view as (Component['view'] & { updateStatus?: () => void }) | undefined
+            view?.updateStatus?.()
+          }
+          currentAttributes.add(attrName)
         }
       } catch (e) {
         console.warn(`Error evaluating attribute ${state.id}:`, e)
       }
     }
   })
+
+  // Clean up any attributes that were previously rendered by data-source
+  // but are no longer present or evaluated to null/undefined
+  prevAttributes.forEach(attrName => {
+    if (!currentAttributes.has(attrName)) {
+      restoreAttribute(component, el, attrName)
+    }
+  })
+
+  renderedAttributesMap.set(el, currentAttributes)
 }
 
 // // Helper to extend a component instance
@@ -409,10 +489,16 @@ functi
```

---

### Incident Patch 5: `9a6e4390` (2026-09-26)
**Commit Message**: fix(editor): make native selects readable in the desktop app (#1889)

**File**: `editor/css/design-system.scss` (modified, +6/-0)
```diff
@@ -23,6 +23,12 @@
 
 @use "variables" as silex-vars;
 
+// Without it WebKitGTK paints native selects light, ignoring their dark background.
+// Not on :root: iframes whose document has another color-scheme get an opaque white backdrop
+select {
+  color-scheme: dark;
+}
+
 :root {
   // ============================================================
   // BASE COLORS - Modern Dark 2025
```

---

### Incident Patch 6: `f68e43a6` (2026-09-26)
**Commit Message**: fix(css-variables): keep the chosen unit of a size variable (#1890)

**File**: `grapesjs-plugins/grapesjs-css-variables/package.json` (modified, +4/-2)
```diff
@@ -19,7 +19,8 @@
   "scripts": {
     "start": "grapesjs-cli serve",
     "build": "grapesjs-cli build --patch=false",
-    "lint": "eslint src"
+    "lint": "eslint src",
+    "test": "node --conditions=browser --test test/*.test.js"
   },
   "keywords": [
     "silex",
@@ -32,7 +33,8 @@
   ],
   "devDependencies": {
     "eslint": "^10.6.0",
-    "grapesjs-cli": "^4.1.3"
+    "grapesjs-cli": "^4.1.3",
+    "jsdom": "^24.1.3"
   },
   "peerDependencies": {
     "grapesjs": ">=0.19.0 <0.23.0",
```

**File**: `grapesjs-plugins/grapesjs-css-variables/src/modal.js` (modified, +2/-2)
```diff
@@ -286,7 +286,7 @@ function parseSizeValue(val) {
   if (!val) return { number: '', unit: 'px' }
   const match = val.match(/^(-?[\d.]+)\s*(.*)$/)
   if (!match) return { number: val, unit: '' }
-  return { number: match[1], unit: match[2] || 'px' }
+  return { number: match[1], unit: match[2] }
 }
 
 /**
@@ -569,7 +569,7 @@ export function renderModal(el, editor, options) {
     if (num) onSizeChange(varItem, wm, num, e.target.value)
   }}
         >
-          ${SIZE_UNITS.map(u => html`<option value=${u} ?selected=${(hasValue ? parsed.unit : 'px') === u}>${u}</option>`)}
+          ${SIZE_UNITS.map(u => html`<option value=${u} ?selected=${(parsed.unit || 'px') === u}>${u}</option>`)}
         </select>
       </div>
     `
```

**File**: `grapesjs-plugins/grapesjs-css-variables/test/modal.test.js` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+const { test } = require('node:test')
+const assert = require('node:assert')
+const { JSDOM, VirtualConsole } = require('jsdom')
+
+const { window } = new JSDOM('<!DOCTYPE html><div id="gjs"></div>', { pretendToBeVisual: true, virtualConsole: new VirtualConsole() })
+for (const key of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'Event', 'getComputedStyle', 'requestAnimationFrame']) {
+  Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
+}
+
+test('changing the unit of a size variable updates its value', async () => {
+  const grapesjs = require('grapesjs')
+  const { setVariable } = await import('../src/variables.js')
+  const { renderModal } = await import('../src/modal.js')
+  const editor = grapesjs.init({ container: '#gjs', headless: true, storageManager: false })
+  editor.getModel().set('cssVarOrder', [{ type: 'size', name: 'size' }])
+  setVariable(editor, { name: 'size', value: '16px' })
+  const el = document.createElement('div')
+  renderModal(el, editor, { enableSizes: true })
+
+  const select = el.querySelector('.css-vars-size-unit')
+  select.value = 'rem'
+  select.dispatchEvent(new window.Event('change'))
+
+  assert.match(editor.getCss(), /--size:16rem/)
+})
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -393,6 +393,9 @@ importers:
       grapesjs-cli:
         specifier: ^4.1.3
         version: 4.1.3(@types/node@26.0.1)(postcss@8.5.19)(typescript@6.0.3)
+      jsdom:
+        specifier: ^24.1.3
+        version: 24.1.3(canvas@3.2.3)
 
   grapesjs-plugins/grapesjs-data-source:
     dependencies:
```

---

### Incident Patch 7: `4be7fdcd` (2026-09-26)
**Commit Message**: fix(desktop): show the address the host gives, not a stale one (#1888)

**File**: `desktop/src-tauri/src/integrations/glab.rs` (modified, +6/-9)
```diff
@@ -49,15 +49,12 @@ impl Deploy for Glab {
         let web_url = json_string(&repo, "web_url")
             .ok_or_else(|| format!("{} did not say where the repository is", self.program()))?;
 
-        // The address the user named rather than the one GitLab would answer:
-        // that request costs a round trip, and before a first publication
-        // there is nothing to ask for anyway
-        let site_url = match options.named(WEBSITE_URL) {
-            Some(url) => Some(url.to_string()),
-            None => run(cli, site, &["api", "projects/:fullpath/pages"])
-                .ok()
-                .and_then(|pages| json_string(&pages, "url")),
-        };
+        // Asked again at each publication in case it changed, so the address
+        // saved with the website stays right
+        let site_url = run(cli, site, &["api", "projects/:fullpath/pages"])
+            .ok()
+            .and_then(|pages| json_string(&pages, "url"))
+            .or_else(|| options.named(WEBSITE_URL).map(String::from));
 
         Ok(Some(Urls {
             site: site_url,
```

**File**: `editor/grapesjs/PublicationManager.test.ts` (modified, +14/-2)
```diff
@@ -4,8 +4,8 @@
 
 import { expect, jest, describe, it, beforeEach } from '@jest/globals'
 import grapesjs, { Editor } from 'grapesjs'
-import { WebsiteSettings } from '~/common/types'
-import { PublicationManager } from './PublicationManager'
+import { ConnectorData, ConnectorType, WebsiteSettings } from '~/common/types'
+import { PublicationManager, withConnectorOptions } from './PublicationManager'
 
 // Prevent lit-html from being imported (it is a peer dependency and breaks the tests)
 jest.mock('lit-html', () => ({}))
@@ -61,3 +61,15 @@ describe('PublicationManager html output', () => {
     expect(settings?.title).toBeUndefined()
   })
 })
+
+describe('withConnectorOptions', () => {
+  const host: ConnectorData = {
+    connectorId: 'fs-hosting', type: ConnectorType.HOSTING, displayName: 'gitlab.com', icon: '', disableLogout: true,
+    isLoggedIn: true, oauthUrl: null, color: '', background: '',
+    options: { websiteUrl: 'https://now.gitlab.io' },
+  }
+
+  it('takes the address of the host over one saved from an earlier answer', () => {
+    expect(withConnectorOptions({ options: { websiteUrl: 'https://before.gitlab.io' } }, host).websiteUrl).toBe('https://now.gitlab.io')
+  })
+})
```

**File**: `editor/grapesjs/PublicationManager.ts` (modified, +4/-8)
```diff
@@ -67,15 +67,11 @@ export default function publishPlugin(editor, opts) {
   (editor as PublishableEditor).PublicationManager = new PublicationManager(editor, opts)
 }
 
-/**
- * The publication options of a website, once the connector has had its say
- *
- * What a connector answers is a starting point. What the user filled in is
- * saved with the website and wins, or publishing would move a site away from
- * the domain somebody chose for it.
- */
+// What the user filled in wins, anything else comes from the host, which knows better than an old copy
 export function withConnectorOptions(settings: PublicationSettings, connector: ConnectorData): ConnectorOptions {
-  return { ...connector.options, ...settings.options }
+  const asked = new Set(connector.optionsForm?.fields.map(field => field.name))
+  const filledIn = Object.fromEntries(Object.entries(settings.options ?? {}).filter(([name]) => asked.has(name)))
+  return { ...settings.options, ...connector.options, ...filledIn }
 }
 
 function jobStatusToPublicationStatus(status: JobStatus): PublicationStatus {
```

---

### Incident Patch 8: `fe65cc7e` (2026-09-25)
**Commit Message**: fix(desktop): block DNS rebinding and cross-site requests on local servers (#1883)

**File**: `Cargo.lock` (modified, +88/-42)
```diff
@@ -199,9 +199,9 @@ dependencies = [
 
 [[package]]
 name = "anyhow"
-version = "1.0.101"
+version = "1.0.104"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5f0e0fee31ef5ed1ba1316088939cea399010ed7731dba877ed44aeb407a75ea"
+checksum = "330a5ed07fa54e4702c9d6c4174f74427fc0ef6e214bbd677ae50a5099946470"
 
 [[package]]
 name = "arbitrary"
@@ -380,24 +380,25 @@ checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
 [[package]]
 name = "aws-lc-rs"
-version = "1.15.4"
+version = "1.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b7b6141e96a8c160799cc2d5adecd5cbbe5054cb8c7c4af53da0f83bb7ad256"
+checksum = "b281d307588d634de920874890732659e2e7672f72b5e10e81badc1a8a83621e"
 dependencies = [
  "aws-lc-sys",
  "zeroize",
 ]
 
 [[package]]
 name = "aws-lc-sys"
-version = "0.37.1"
+version = "0.45.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b092fe214090261288111db7a2b2c2118e5a7f30dc2569f1732c4069a6840549"
+checksum = "9bff6c3b54fad79a2e60b8102caf565819711497c1f5f092f49508e2f5c31b27"
 dependencies = [
  "cc",
  "cmake",
  "dunce",
  "fs_extra",
+ "pkg-config",
 ]
 
 [[package]]
@@ -713,6 +714,17 @@ version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
 
+[[package]]
+name = "chacha20"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "65c35e4b699c7e15ccbe7ee35c005e4fc0a278d22238a2857e6ce2dadeda1b06"
+dependencies = [
+ "cfg-if",
+ "cpufeatures 0.3.1",
+ "rand_core 0.10.1",
+]
+
 [[package]]
 name = "chrono"
 version = "0.4.43"
@@ -839,6 +851,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "cpufeatures"
+version = "0.3.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5ca28b0ae3115b884660db4118d803791fd6756b6e88f39c0f3f7859060d7566"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "crc32fast"
 version = "1.5.0"
@@ -1001,11 +1022,10 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.5.6"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc3dc5ad92c2e2d1c193bbbbdf2ea477cb81331de4f3103f267ca18368b988c4"
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 dependencies = [
- "powerfmt",
  "serde_core",
 ]
 
@@ -1678,11 +1698,9 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "899def5c37c4fd7b2664648c28120ecec138e4d395b459e5ca34f9cce2dd77fd"
 dependencies = [
  "cfg-if",
- "js-sys",
  "libc",
  "r-efi",
  "wasip2",
- "wasm-bindgen",
 ]
 
 [[package]]
@@ -1692,10 +1710,13 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "139ef39800118c7683f2fd3c98c1b23c09ae076556b435f8e9064ae108aaeeec"
 dependencies = [
  "cfg-if",
+ "js-sys",
  "libc",
  "r-efi",
+ "rand_core 0.10.1",
  "wasip2",
  "wasip3",
+ "wasm-bindgen",
 ]
 
 [[package]]
@@ -1866,9 +1887,9 @@ dependencies = [
 
 [[package]]
 name = "h2"
-version = "0.4.13"
+version = "0.4.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2f44da3a8150a6703ed5d34e164b875fd14c2cdab9af1252a9a1020bde2bdc54"
+checksum = "ef8e5e5a340588f4452631496976cf8636d4a7ecf600239fdc27615d2530bc16"
 dependencies = [
  "atomic-waker",
  "bytes",
@@ -2787,9 +2808,9 @@ dependencies = [
 
 [[package]]
 name = "num-conv"
-version = "0.2.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cf97ec579c3c42f953ef76dbf8d55ac91fb219dde70e49aa4a6b7d74e9919050"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "num-traits"
@@ -3634,15 +3655,16 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.13"
+version = "0.11.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1906b
```

**File**: `desktop/src-tauri/Cargo.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ tracing-subscriber = { version = "0.3", features = ["env-filter"] }
 
 # MCP (Model Context Protocol) support
 reqwest = { version = "0.13", features = ["json"] }
-rmcp = { version = "0.15", features = ["server", "transport-streamable-http-server", "transport-io"] }
+rmcp = { version = "1", features = ["server", "transport-streamable-http-server", "transport-io"] }
 # Required as a direct dependency: the JsonSchema derive expands to ::schemars paths
 schemars = "1"
 
```

**File**: `desktop/src-tauri/src/main.rs` (modified, +41/-0)
```diff
@@ -424,6 +424,46 @@ async fn trace_without_query(
     next.run(request).await
 }
 
+fn is_local_authority(authority: &str) -> bool {
+    axum::http::uri::Authority::try_from(authority).is_ok_and(|a| {
+        let host = a.host().trim_start_matches('[').trim_end_matches(']');
+        ["localhost", "127.0.0.1", "::1"]
+            .iter()
+            .any(|local| host.eq_ignore_ascii_case(local))
+    })
+}
+
+// A web page can point its own domain at 127.0.0.1 (DNS rebinding) and then
+// call this API as same-origin; only the Host header gives it away.
+// A plain cross-site form POST keeps a local Host, but not a local Origin
+async fn reject_foreign_host(
+    request: axum::extract::Request,
+    next: axum::middleware::Next,
+) -> axum::response::Response {
+    use axum::http::{header, Method};
+    use axum::response::IntoResponse;
+
+    let headers = request.headers();
+    let host = headers
+        .get(header::HOST)
+        .and_then(|h| h.to_str().ok())
+        .unwrap_or("");
+    let safe_method = matches!(*request.method(), Method::GET | Method::HEAD);
+    let same_origin = match headers.get(header::ORIGIN) {
+        None => true,
+        Some(origin) => origin
+            .to_str()
+            .ok()
+            .and_then(|o| o.strip_prefix("http://"))
+            .is_some_and(|o| o.eq_ignore_ascii_case(host)),
+    };
+    if is_local_authority(host) && (safe_method || same_origin) {
+        next.run(request).await
+    } else {
+        axum::http::StatusCode::FORBIDDEN.into_response()
+    }
+}
+
 async fn start_server(
     pending_evals: mcp::PendingEvals,
     data_path: std::path::PathBuf,
@@ -466,6 +506,7 @@ async fn start_server(
 
     let app = app
         .layer(axum::middleware::from_fn(trace_without_query))
+        .layer(axum::middleware::from_fn(reject_foreign_host))
         .layer(sentry::integrations::tower::SentryHttpLayer::new().enable_transaction());
 
     let app = frontend::configure(app);
```

**File**: `desktop/src-tauri/src/mcp.rs` (modified, +24/-46)
```diff
@@ -289,30 +289,19 @@ impl SilexMcp {
                 _ => serde_json::Map::new(),
             };
 
-            let annotations = ToolAnnotations {
-                read_only_hint: cap.read_only.or(Some(false)),
-                destructive_hint: if cap.read_only == Some(true) {
-                    None
-                } else {
-                    cap.destructive.or(Some(false))
-                },
-                idempotent_hint: cap.idempotent,
-                open_world_hint: cap.open_world,
-                ..Default::default()
+            let mut annotations = ToolAnnotations::new();
+            annotations.read_only_hint = cap.read_only.or(Some(false));
+            annotations.destructive_hint = if cap.read_only == Some(true) {
+                None
+            } else {
+                cap.destructive.or(Some(false))
             };
+            annotations.idempotent_hint = cap.idempotent;
+            annotations.open_world_hint = cap.open_world;
 
-            let tool = Tool {
-                // ':' in capability ids is not allowed in tool names (clients require ^[a-zA-Z0-9_-]+$)
-                name: cap.id.replace(':', "_").into(),
-                title: None,
-                description: Some(cap.description.into()),
-                input_schema: Arc::new(schema_obj),
-                output_schema: None,
-                annotations: Some(annotations),
-                execution: None,
-                icons: None,
-                meta: None,
-            };
+            // ':' in capability ids is not allowed in tool names (clients require ^[a-zA-Z0-9_-]+$)
+            let tool = Tool::new(cap.id.replace(':', "_"), cap.description, schema_obj)
+                .with_annotations(annotations);
 
             let cap_command = Arc::new(cap.command);
 
@@ -350,11 +339,11 @@ impl SilexMcp {
                                         || v.get("success").map_or(false, |s| s == false)
                                 })
                                 .unwrap_or(false);
-                            Ok(CallToolResult {
-                                content: vec![Content::text(text)],
-                                structured_content: None,
-                                is_error: if is_error { Some(true) } else { None },
-                                meta: None,
+                            let content = vec![Content::text(text)];
+                            Ok(if is_error {
+                                CallToolResult::error(content)
+                            } else {
+                                CallToolResult::success(content)
                             })
                         }
                         Err(e) => Ok(tool_error(e)),
@@ -376,12 +365,7 @@ impl SilexMcp {
 
 /// Create an error CallToolResult (is_error = true).
 fn tool_error(msg: impl Into<String>) -> CallToolResult {
-    CallToolResult {
-        content: vec![Content::text(msg.into())],
-        structured_content: None,
-        is_error: Some(true),
-        meta: None,
-    }
+    CallToolResult::error(vec![Content::text(msg.into())])
 }
 
 // ==========================================================================
@@ -753,11 +737,10 @@ pub async fn eval_callback(
 
 impl ServerHandler for SilexMcp {
     fn get_info(&self) -> ServerInfo {
-        ServerInfo {
-            protocol_version: ProtocolVersion::V_2024_11_05,
-            capabilities: ServerCapabilities::builder().enable_tools().build(),
-            server_info: Implementation::from_build_env(),
-            instructions: Some(
+        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
+            .with_protocol_version(ProtocolVersion::V_2024_11_05)
+            .with_server_info(Implementation::from_build_env())
+            .with_instructions(
                 r#"Silex Desktop MCP — controls the Silex no-code visual website builder.
 
 GETTING STARTED:
@@ -775,10 +758,8 @@ RULES:
 - Homepage page name must be "in
```

**File**: `server-rust/Cargo.lock` (removed, +0/-1645)
```diff
@@ -1,1645 +0,0 @@
-# This file is automatically @generated by Cargo.
-# It is not intended for manual editing.
-version = 4
-
-[[package]]
-name = "adler2"
-version = "2.0.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
-
-[[package]]
-name = "aho-corasick"
-version = "1.1.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
-dependencies = [
- "memchr",
-]
-
-[[package]]
-name = "android_system_properties"
-version = "0.1.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
-dependencies = [
- "libc",
-]
-
-[[package]]
-name = "anyhow"
-version = "1.0.100"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a23eb6b1614318a8071c9b2521f36b424b2c83db5eb3a0fead4a6c0809af6e61"
-
-[[package]]
-name = "async-compression"
-version = "0.4.37"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d10e4f991a553474232bc0a31799f6d24b034a84c0971d80d2e2f78b2e576e40"
-dependencies = [
- "compression-codecs",
- "compression-core",
- "pin-project-lite",
- "tokio",
-]
-
-[[package]]
-name = "async-trait"
-version = "0.1.89"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9035ad2d096bed7955a320ee7e2230574d28fd3c3a0f186cbea1ff3c7eed5dbb"
-dependencies = [
- "proc-macro2",
- "quote",
- "syn",
-]
-
-[[package]]
-name = "atomic-waker"
-version = "1.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
-
-[[package]]
-name = "autocfg"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
-
-[[package]]
-name = "axum"
-version = "0.7.9"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "edca88bc138befd0323b20752846e6587272d3b03b0343c8ea28a6f819e6e71f"
-dependencies = [
- "async-trait",
- "axum-core",
- "axum-macros",
- "bytes",
- "futures-util",
- "http",
- "http-body",
- "http-body-util",
- "hyper",
- "hyper-util",
- "itoa",
- "matchit",
- "memchr",
- "mime",
- "multer",
- "percent-encoding",
- "pin-project-lite",
- "rustversion",
- "serde",
- "serde_json",
- "serde_path_to_error",
- "serde_urlencoded",
- "sync_wrapper",
- "tokio",
- "tower 0.5.3",
- "tower-layer",
- "tower-service",
- "tracing",
-]
-
-[[package]]
-name = "axum-core"
-version = "0.4.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "09f2bd6146b97ae3359fa0cc6d6b376d9539582c7b4220f041a33ec24c226199"
-dependencies = [
- "async-trait",
- "bytes",
- "futures-util",
- "http",
- "http-body",
- "http-body-util",
- "mime",
- "pin-project-lite",
- "rustversion",
- "sync_wrapper",
- "tower-layer",
- "tower-service",
- "tracing",
-]
-
-[[package]]
-name = "axum-macros"
-version = "0.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "57d123550fa8d071b7255cb0cc04dc302baa6c8c4a79f55701552684d8399bce"
-dependencies = [
- "proc-macro2",
- "quote",
- "syn",
-]
-
-[[package]]
-name = "base64"
-version = "0.22.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
-
-[[package]]
-name = "bitflags"
-version = "2.10.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "812e12b5285cc515a9c72a5c1d3b6d46a19dac5acfef5265968c166106e31dd3"
-
-[[package]]
-name = "bumpalo"
-version = "3.19.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5dd9dc738b7a8311c7ade152424974d8115f2cdad61e8dab8dac9f2362298510"
-
-[[package]]
-name = "bytes"
-version = "1.11.0"
-source = "registry+https://github.com/rust-lang/c
```

---

### Incident Patch 9: `8171bc57` (2026-09-22)
**Commit Message**: fix(desktop): fix cursor on blocks in webviews (#1881)

**File**: `editor/css/grapesjs.scss` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@
   flex: 1 1 auto;
 }
 
+// Fix for webview / silex desktop
+.gjs-block {
+  cursor: grab;
+}
 
 // GrapesJS color utility classes - using CSS custom properties
 .#{$prefix} {
```

---

### Incident Patch 10: `6cf0234d` (2026-09-21)
**Commit Message**: fix(desktop): say how silex was installed, and stop counting every launch twice (#1859)

**File**: `desktop/src-tauri/scripts/desktop-bridge.js` (modified, +11/-1)
```diff
@@ -27,13 +27,23 @@
         release: ctx.release,
         environment: ctx.environment,
         tracesSampleRate: 1.0,
-        integrations: [window.Sentry.browserTracingIntegration()],
+        // The native side owns the session: counted here too, every launch would count twice
+        integrations: (defaults) => [
+          ...defaults.filter((integration) => integration.name !== 'BrowserSession'),
+          window.Sentry.browserTracingIntegration(),
+        ],
         beforeSend: withoutQuery,
         beforeSendTransaction: withoutQuery,
+        // A console line often prints the website being edited
+        beforeBreadcrumb: (breadcrumb) => {
+          if (breadcrumb.category === 'console') delete breadcrumb.data;
+          return breadcrumb;
+        },
       });
       window.Sentry.setUser({ id: ctx.user_id });
       window.Sentry.setTag('os', ctx.os);
       window.Sentry.setTag('arch', ctx.arch);
+      window.Sentry.setTag('package', ctx.package);
       window.Sentry.setTag('context', 'webview');
     };
     document.head.appendChild(script);
```

**File**: `desktop/src-tauri/src/main.rs` (modified, +51/-1)
```diff
@@ -139,6 +139,43 @@ fn glitchtip_dsn(resource_dir: Option<PathBuf>) -> Option<String> {
     }
 }
 
+/// How this copy of Silex was installed, which is what a bug report leaves out
+fn package_kind() -> &'static str {
+    if cfg!(debug_assertions) {
+        return "dev";
+    }
+    for (variable, kind) in [
+        ("APPIMAGE", "appimage"),
+        ("FLATPAK_ID", "flatpak"),
+        ("SNAP", "snap"),
+    ] {
+        if std::env::var_os(variable).is_some() {
+            return kind;
+        }
+    }
+    let Ok(program) = std::env::current_exe() else {
+        return "unknown";
+    };
+    if cfg!(target_os = "macos") {
+        return "app";
+    }
+    if cfg!(target_os = "windows") {
+        return "exe";
+    }
+    if !program.starts_with("/usr") {
+        return "portable";
+    }
+    // deb and rpm install the same files in the same places, so what tells them
+    // apart is which package manager the machine keeps
+    if PathBuf::from("/var/lib/dpkg/status").exists() {
+        "deb"
+    } else if PathBuf::from("/var/lib/rpm").exists() {
+        "rpm"
+    } else {
+        "linux-package"
+    }
+}
+
 /// Map a release version to a GlitchTip environment channel (canary/alpha/beta/stable).
 fn telemetry_environment(version: &str) -> &'static str {
     if cfg!(debug_assertions) {
@@ -178,6 +215,7 @@ struct TelemetryContext {
     user_id: String,
     os: String,
     arch: String,
+    package: String,
 }
 
 #[tauri::command]
@@ -192,6 +230,7 @@ fn get_telemetry_context(app: tauri::AppHandle) -> Option<TelemetryContext> {
         user_id: get_or_create_install_id(&data_dir),
         os: std::env::consts::OS.to_string(),
         arch: std::env::consts::ARCH.to_string(),
+        package: package_kind().to_string(),
     })
 }
 
@@ -508,7 +547,14 @@ fn main() {
     let mut options = sentry::ClientOptions::new()
         .release(app_version.clone())
         .environment(telemetry_environment(&app_version))
-        .traces_sample_rate(1.0)
+        // The editor asks for the status of a publication every second
+        .traces_sampler(|ctx| {
+            if ctx.name().contains("/publication/status") {
+                0.0
+            } else {
+                1.0
+            }
+        })
         // Named rather than left out: unset, sentry puts the hostname of the
         // machine in every event, which names the user
         .server_name("desktop")
@@ -546,6 +592,10 @@ fn main() {
     sentry::configure_scope(|scope| {
         scope.set_tag("os", std::env::consts::OS);
         scope.set_tag("arch", std::env::consts::ARCH);
+        scope.set_tag("package", package_kind());
+        if let Ok(webview) = tauri::webview_version() {
+            scope.set_tag("webview", webview);
+        }
         // Anonymous install id → distinguishes distinct installs from repeat crashes.
         scope.set_user(Some(sentry::protocol::User {
             id: Some(install_id.clone()),
```

#### Recent Merged Pull Requests:
- **PR #1890** (2026-09-26): fix(css-variables): keep the chosen unit of a size variable (@lexoyo)
- **PR #1889** (2026-09-26): fix(editor): make native selects readable in the desktop app (@lexoyo)
- **PR #1888** (2026-09-26): fix(desktop): show the address the host gives, not a stale one (@lexoyo)
- **PR #1887** (closed): fix(data-source): do not turn an unset append/prepend option into the text "null" (@aniruddhaadak80)
- **PR #1886** (closed): fix(editor): write composite style properties as their own declarations (@aniruddhaadak80)
- **PR #1884** (2026-09-25): chore: license the desktop app and all plugins under AGPL-3.0-or-later (@lexoyo)
- **PR #1883** (2026-09-25): fix(desktop): block DNS rebinding and cross-site requests on local servers (@lexoyo)
- **PR #1882** (2026-09-30): fix(server): keep file paths inside the storage folder (@lexoyo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
