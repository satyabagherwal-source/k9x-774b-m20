# Forensic Learning Record (Deep Inspection): kestra-io/kestra

> **Canonical Artifact**: `07_PROJECT_LEARNING/kestra-io-kestra-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kestra-io/kestra](https://github.com/kestra-io/kestra))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:37.511Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kestra-io/kestra`
- **Description**: Event Driven Orchestration & Scheduling Platform for Mission Critical Applications
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 28545 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/api/base.api.ts`
```
import {APIRequestContext} from "playwright/test"
import {shared} from "../fixtures/shared"

export class BaseApi {
    protected static get AUTH(): string {
        return `Basic ${Buffer.from(`${shared.username}:${shared.password}`).toString("base64")}`
    }

    protected readonly apiUrl: string

    constructor(public readonly request: APIRequestContext, protected readonly baseURL: string | undefined) {
        this.apiUrl = `${baseURL}/api/v1`
    }
}
```

### Core Architecture Module: `e2e/api/executions.api.ts`
```
import {APIRequestContext} from "playwright/test"
import {shared} from "../fixtures/shared"
import {BaseApi} from "./base.api"

export class ExecutionsApi extends BaseApi {
    private readonly executionIds: string[] = []

    constructor(public readonly requests: APIRequestContext, public readonly flowId: string, protected readonly baseURL: string | undefined) {
        super(requests, baseURL)
    }

    async generateExecutionViaApi(labels: [string, string][] = []) {
        const formData = new FormData()
        formData.append("INPUT_A", "test")

        const params = new URLSearchParams()
        labels.forEach((tuple) => {
            params.append("labels", `${tuple[0]}:${tuple[1]}`)
        })

        const response = this.request.post(`${this.apiUrl}/executions/${shared.namespace}/${this.flowId}`, {
            headers: {
                "Accept": "application/json",
                "Authorization": ExecutionsApi.AUTH,
            },
            params,
            multipart: formData,
        })

        const status = (await response).status()

        if (status !== 200) {
            throw new Error(`Execution creation failed with HTTP ${status}: ${await (await response).text()}`)
        }

        const responseJson = await (await response).json()

        this.executionIds.push(responseJson["id"])
    }

    /** Concurrent bulk variant of {@link generateExecutionViaApi} — the calls are independent. */
    async generateExecutionsViaApi(count: number, labels: [string, string][] = []) {
        await Promise.all(Array.from({length: count}, () => this.generateExecutionViaApi(labels)))
    }

    async removeExecutionsViaApi() {
        await Promise.all(this.executionIds.map(async (executionId) => {
            const params = new URLSearchParams()
            params.append("deleteLogs", "true")
            params.append("deleteMetric", "true")
            params.append("deleteStorage", "true")

            const status = (await this.request.delete(`${this.apiUrl}/executions/${executionId}`, {
                headers: {
                    "Authorization": ExecutionsApi.AUTH,
                },
                params,
            })).status()

            if (status !== 204) {
                throw new Error(`Deletion of execution ${executionId} failed with HTTP ${status}`)
            }
        }))
    }

}
```

### Core Architecture Module: `e2e/api/flows.api.ts`
```
import {BaseApi} from "./base.api"
import {shared} from "../fixtures/shared"
import {v4 as uuid} from "uuid"
import {fileURLToPath} from "url"
import {dirname} from "path"
import fs from "fs"
import path from "path"

export class FlowsApi extends BaseApi {
    private readonly flowIds: string[] = []

    async generateFlowViaApi(fileName: string, fileFlowId: string) {
        const flowId = `test-flow-${uuid()}`

        // Create flow via API
        const response = this.request.post(`${this.apiUrl}/flows`, {
            headers: {
                "Content-Type": "application/x-yaml",
                "Accept": "application/json",
                "Authorization": FlowsApi.AUTH,
            },
            data: this.getFlowYaml(fileName, fileFlowId, flowId),
        })

        const status = (await response).status()

        if (status !== 200) {
            throw new Error(`Flow creation failed with HTTP ${status}`)
        }

        this.flowIds.push(flowId)

        return flowId
    }

    async removeFlowsViaApi() {
        for(const flowId of this.flowIds) {
            const status = (await this.request.delete(`${this.apiUrl}/flows/${shared.namespace}/${flowId}`, {
                headers: {
                    "Authorization": FlowsApi.AUTH,
                },
            })).status()

            if (status !== 204) {
                throw new Error(`Deletion of flow ${flowId} failed with HTTP ${status}`)
            }
        };
    }

    protected getFlowYaml(fileName: string, fileFlowId: string, desiredFlowId: string): string {
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = dirname(__filename)
        const flowYaml = fs.readFileSync(
            path.resolve(__dirname, `../fixtures/flows/${fileName}`),
            "utf-8",
        )

        return flowYaml.replace(fileFlowId, desiredFlowId)
    }
}

```

### Core Architecture Module: `e2e/api/kv.api.ts`
```
import {BaseApi} from "./base.api"
import {shared} from "../fixtures/shared"

/** What `GET /namespaces/{namespace}/kv/{key}` answers, once the stored ION has been parsed. */
export type KvDetail = {
    type: string;
    value: unknown;
}

export class KvApi extends BaseApi {
    private readonly keys: string[] = []

    /** Records a key created through the UI so the spec can clean it up. */
    track(key: string) {
        this.keys.push(key)
        return key
    }

    async setKvViaApi(key: string, value: string, ttl?: string) {
        const response = await this.request.put(`${this.apiUrl}/namespaces/${shared.namespace}/kv/${key}`, {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": KvApi.AUTH,
                ...(ttl === undefined ? {} : {ttl}),
            },
            data: value,
        })

        if (response.status() !== 200) {
            throw new Error(`Writing KV ${key} failed with HTTP ${response.status()}`)
        }
    }

    async getExpirationDateViaApi(key: string): Promise<string | undefined> {
        const response = await this.request.get(`${this.apiUrl}/kv?page=1&size=100&filters[namespace][EQUALS]=${shared.namespace}`, {
            headers: {
                "Accept": "application/json",
                "Authorization": KvApi.AUTH,
            },
        })

        if (response.status() !== 200) {
            throw new Error(`Listing KVs failed with HTTP ${response.status()}`)
        }

        const {results} = await response.json()

        return results.find((entry: {key: string}) => entry.key === key)?.expirationDate
    }

    async getKvViaApi(key: string): Promise<KvDetail> {
        const response = await this.request.get(`${this.apiUrl}/namespaces/${shared.namespace}/kv/${key}`, {
            headers: {
                "Accept": "application/json",
                "Authorization": KvApi.AUTH,
            },
        })

        if (response.status() !== 200) {
            throw new Error(`Reading KV ${key} failed with HTTP ${response.status()}`)
        }

        return response.json()
    }

    async removeKvsViaApi() {
        for (const key of this.keys) {
            const status = (await this.request.delete(`${this.apiUrl}/namespaces/${shared.namespace}/kv/${key}`, {
                headers: {
                    "Authorization": KvApi.AUTH,
                },
            })).status()

            if (status !== 200 && status !== 404) {
                throw new Error(`Deletion of KV ${key} failed with HTTP ${status}`)
            }
        }

        this.keys.length = 0
    }
}

```

### Core Architecture Module: `e2e/auth.setup.ts`
```
import {expect, test as setup} from "@playwright/test"
import {shared} from "./fixtures/shared"
import {PRODUCT_TOUR_STORAGE_KEY, SKIPPED_PRODUCT_TOUR, STORAGE_STATE} from "./fixtures/auth"

/**
 * Signs in once per run and parks the resulting cookie jar for every other project
 * to reuse, so no spec pays for the login form.
 */
setup("authenticate", async ({page, context}) => {
    // On an empty instance the post-login redirect lands on the AI Copilot page, where the
    // product tour auto-starts — and the guided card it opens would be captured below and
    // inherited by every project, covering the app under test.
    await context.addInitScript(([tourKey, tourState]) => {
        localStorage.setItem(tourKey, tourState)
    }, [PRODUCT_TOUR_STORAGE_KEY, SKIPPED_PRODUCT_TOUR])

    await page.goto("/ui")

    await page.getByRole("textbox", {name: "Email"}).fill(shared.username)
    await page.getByRole("textbox", {name: "Password"}).fill(shared.password)
    await page.getByRole("button", {name: "Login"}).click()

    // Anchor on the app shell, not the dashboard: on an instance with no flows yet the
    // post-login redirect lands on the AI Copilot welcome page instead of the dashboard.
    await expect(page.getByRole("button", {name: "Toggle panel"})).toBeVisible({timeout: 30000})

    await context.storageState({path: STORAGE_STATE})
})

```

### Core Architecture Module: `e2e/blocks/blocks.fixture.ts`
```
import {expect, test as base} from "@playwright/test"
import {PRODUCT_TOUR_STORAGE_KEY, SKIPPED_PRODUCT_TOUR} from "../fixtures/auth"

/*
 * A deliberately cookie-free API context, same as executions.fixture.ts.
 *
 * The built-in `request` fixture inherits `use.storageState`, which carries the
 * BASIC_AUTH cookie. CsrfTokenFilter#hasCookieAuth then treats every POST/DELETE as
 * cookie-authenticated and rejects it with a 403 unless it also carries an
 * X-CSRF-TOKEN — but FlowsApi authenticates with the CSRF-exempt
 * `Authorization: Basic` header instead. A fresh context keeps that path open.
 *
 * `page` keeps the shared storageState, so login() and the UI are unaffected.
 *
 * This suite builds its own context rather than reusing fixtures/auth (its specs sign in
 * through the form), so it also has to neutralise the product tour itself: left running,
 * its card covers the canvas and swallows every click.
 */
export const test = base.extend({
    context: async ({context}, use) => {
        await context.addInitScript(([tourKey, tourState]) => {
            localStorage.setItem(tourKey, tourState)
        }, [PRODUCT_TOUR_STORAGE_KEY, SKIPPED_PRODUCT_TOUR])
        await use(context)
    },

    request: async ({playwright, baseURL}, use) => {
        const context = await playwright.request.newContext({
            baseURL,
            // Explicitly empty: `newContext` otherwise picks up the config's `use.storageState`.
            storageState: {cookies: [], origins: []},
        })
        await use(context)
        await context.dispose()
    },
})

export {expect}

```

### Core Architecture Module: `e2e/blocks/blocks.helpers.ts`
```
import type {APIRequestContext, Locator, Page} from "@playwright/test"
import {expect} from "@playwright/test"
import {shared} from "../fixtures/shared"

export const TENANT = process.env.E2E_TENANT ?? "main"

// The generated task-edit form loads its plugin schema asynchronously and
// re-renders (recreating its Monaco instances) once it lands — same for
// switching tabs or expanding an accordion group, which mount fresh fields.
// Wait for the Monaco editor count within scope to settle before touching one,
// so an index-based locator doesn't grab a node that's about to be detached.
export async function waitForMonacoStable(page: Page, scope: Page | Locator = page) {
    const editors = scope.locator(".monaco-editor")
    await expect(async () => {
        const before = await editors.count()
        await page.waitForTimeout(150)
        const after = await editors.count()
        expect(after).toBe(before)
    }).toPass({timeout: 10000})
}

// Click a Monaco field and PROVE the click took the focus before typing —
// the dock's async side-effects (plugin-doc auto-open, schema re-render) can
// steal focus right between a click and the first keystroke, silently sending
// the whole edit nowhere.
export async function replaceMonacoContent(page: Page, editor: Locator, text: string) {
    await expect(async () => {
        await editor.click()
        await expect(editor.locator("textarea.inputarea")).toBeFocused({timeout: 1000})
        await page.keyboard.press("ControlOrMeta+a")
        await page.keyboard.insertText(text)
        // Prove the edit LANDED — an async form re-render can recreate the
        // editor right under a keystroke and silently swallow it.
        await expect(editor).toContainText(text.split("\n")[0], {timeout: 1000})
    }).toPass({timeout: 15000})
}

export async function login(page: Page) {
    await page.goto("/ui")

    // The parked cookie jar can carry the session on its own, in which case the app boots
    // straight into the shell and there is no form to fill — whether it does is a race between
    // the router guard's own auth call and the redirect to the login page. Wait for whichever
    // of the two actually lands, then sign in only if asked to.
    const email = page.getByRole("textbox", {name: "Email"})
    const shell = page.getByRole("button", {name: "Toggle panel"})
    await expect(email.or(shell).first()).toBeVisible({timeout: 30000})

    if (await email.isVisible()) {
        await email.fill(shared.username)
        await page.getByRole("textbox", {name: "Password"}).fill(shared.password)
        await page.getByRole("button", {name: "Login"}).click()
    }
    await expect(shell).toBeVisible({timeout: 30000})
    // The Login button click leaves the cursor parked at a fixed viewport
    // position. If a later hover-highlighted overlay (task picker, command
    // menu) happens to render an option under that exact stale point, the
    // browser fires a real mouseenter and hijacks the highlighted selection
    // away from index 0 with no keyboard action involved. Park it out of the
    // way once, up front, instead of chasing this in every test that opens one.
    await page.mouse.move(0, 0)
}

// Blocks is now the "nocode" tab's engine inside the flow editor's shared
// dock (see MERGE-PLAN.md), not a standalone page — force the flag so this
// stays true regardless of the current rollout default, then open the tab.
// Also force TAB edit mode: this suite asserts the dock-tab editing flow
// (block-editor-task-edit + a "<section> / <id>" tab), so pin it regardless of
// the "Default Task Edit Mode" preference, whose default is MODAL.
export async function openBlockEditor(page: Page, flowId: string) {
    await page.evaluate(() => {
        localStorage.setItem("nocodeEngine", "blocks")
        localStorage.setItem("taskEditDefaultMode", "TAB")
    })
    await page.goto(`/ui/${TENANT}/flows/edit/${shared.namespace}/${flowId}/edit`)
    await page.getByRole("button", {name: "No Code", exact: true}).click()
    await expect(page.locator("[data-test='block-editor']")).toBeVisible()
    await expect(page.locator("[data-block-id]").first()).toBeVisible()
}

// The id of the block currently carrying the keyboard focus ring. The ring
// class lands on the card root for leaves/sentinels and on the header for
// flowable clusters, hence the closest() fallback.
export async function ringId(page: Page): Promise<string | null> {
    return page.evaluate(() => {
        const el = document.querySelector(".block-kbd-focused")
        if (!el) return null
        return el.getAttribute("data-block-id")
            ?? el.closest("[data-block-id]")?.getAttribute("data-block-id")
            ?? null
    })
}

export async function expectRing(page: Page, id: string) {
    await expect(async () => {
        expect(await ringId(page)).toBe(id)
    }).toPass({timeout: 5000})
}

// Reads the ring id, retrying briefly — the ring can lag a tick behind an
// action that creates a brand-new block (insertion, duplication).
export async function waitForRing(page: Page): Promise<string> {
    let id: string | null = null
    await expect(async () => {
        id = await ringId(page)
        expect(id).toBeTruthy()
    }).toPass({timeout: 5000})
    return id as unknown as string
}

// Press ArrowDown/ArrowUp until the ring lands on the target block. Bounded so
// a regression fails fast instead of looping forever.
export async function walkTo(page: Page, targetId: string, direction: "down" | "up" = "down") {
    const key = direction === "down" ? "ArrowDown" : "ArrowUp"
    for (let i = 0; i < 25; i++) {
        if (await ringId(page) === targetId) return
        await page.keyboard.press(key)
    }
    expect(await ringId(page), `walkTo(${targetId}) never reached its target`).toBe(targetId)
}

// Open the command menu and activate its "Go to <section>" entry.
//
// Everything here is scoped to the menu itself. A page-wide getByText for the
// section name can resolve to a block label on the canvas carrying the same
// words — the card sits behind the overlay, which still looks visible to
// Playwright — the same hazard pickTask documents for the insert picker.
//
// Activated by click rather than Enter: the same term also matches
// "Insert <section>", and Enter takes whatever sorted first rather than the
// entry the test asked for.
export async function goToSectionViaPalette(page: Page, section: string) {
    await page.keyboard.press("ControlOrMeta+Shift+p")
    const menu = page.locator("[data-test='block-command-menu']")
    await expect(menu).toBeVisible()

    const input = menu.getByRole("textbox")
    await expect(input).toBeFocused()
    await input.fill(section)

    await menu.getByText(`Go to ${section}`, {exact: true}).click()
    await expect(menu).toBeHidden()
}

// Search the insert picker and confirm the named match. Confirms with a
// click rather than Enter: the picker preselects whatever landed first in
// the filtered list, which for a broad search term (e.g. "if" substring-
// matches dozens of unrelated plugins) is often not the entry the test
// actually asked for. The lookup is scoped to the picker's own listbox — an
// unscoped page-wide text match can resolve to an identically named block
// already on the canvas (e.g. an existing "Log" task) sitting underneath the
// picker overlay, which looks "visible" to Playwright but is a different
// element entirely.
export async function pickTask(page: Page, search: string, optionTitle: string) {
    const input = page.getByPlaceholder("Search or describe a task…")
    await expect(input).toBeVisible()
    await input.fill(search)
    const listbox = page.locator("#block-editor-picker-listbox")
    const option = listbox.getByText(optionTitle, {exact: true}).first()
    await expect(option).toBeVisible()
    await option.click()
    await expect(input).toBeHidden()
}

// Opening a block lands it as a same-place tab in the shared dock (the
// intende
```

### Core Architecture Module: `e2e/fixtures/auth.ts`
```
import {expect, test as base, type BrowserContext, type Page} from "@playwright/test"
import path from "path"
import {fileURLToPath} from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Where the `setup` project parks the authenticated browser state (absolute
 *  so it resolves the same whatever the working directory). */
export const STORAGE_STATE = path.resolve(__dirname, "../.auth/user.json")

/** Mirrors `AUTH_FLAG_KEY` in `ui/src/utils/basicAuth.ts`. */
export const AUTH_FLAG_KEY = "kestraBasicAuthenticated"

/** Mirrors `MISSING_KEY_MESSAGE` in `ui/src/translations/i18n.ts`. */
export const MISSING_KEY_MESSAGE = "[i18n] Missing translation key"

/** Mirrors `STORAGE_KEY` in `ui/src/stores/productTour.ts`. */
export const PRODUCT_TOUR_STORAGE_KEY = "kestra.productTour.state"

/** Seeds the state the tour overlay reads as "already answered", so it never
 *  renders a card over the app under test. */
export const SKIPPED_PRODUCT_TOUR = JSON.stringify({status: "skipped"})

type SharedContextFixtures = {
    sharedContext: BrowserContext
}

/** The `test` every spec should import: login is shared per worker, each
 *  test still gets its own tab (fresh DOM/JS heap, no leaked state). */
export const test = base.extend<{page: Page}, SharedContextFixtures>({
    sharedContext: [async ({browser}, use) => {
        // The production build registers a service worker (workbox `NetworkOnly` for `/api/*`,
        // `clientsClaim: true`). It doesn't control the very first page, but claims every page
        // after that — and once it does, `/api/*` fetches are handled inside the worker's own
        // fetch listener, a layer `page.route()` doesn't see through. Any spec that stubs an API
        // response and then does a second hard navigation would silently stop being stubbed.
        // Blocking service workers for the test context sidesteps this entirely.
        const context = await browser.newContext({storageState: STORAGE_STATE, serviceWorkers: "block"})

        // storageState skips sessionStorage, so the login-flag cookie alone
        // still bounces the SPA to /ui/login — re-seed the flag per document.
        await context.addInitScript(([authKey, tourKey, tourState]) => {
            sessionStorage.setItem(authKey, "true")
            localStorage.setItem(tourKey, tourState)
        }, [AUTH_FLAG_KEY, PRODUCT_TOUR_STORAGE_KEY, SKIPPED_PRODUCT_TOUR])

        await use(context)
        await context.close()
    }, {scope: "worker"}],

    context: async ({sharedContext}, use) => {
        await use(sharedContext)
    },

    page: async ({sharedContext}, use) => {
        const page = await sharedContext.newPage()

        // Auto-accept the native beforeunload confirm an unsaved editor arms,
        // so leaving a dirty editor never hangs a test.
        page.on("dialog", (dialog) => {
            dialog.accept().catch(() => {})
        })

        // The app reports every translation key it could not resolve; a raw key on screen is a bug
        // no locator would notice, so the test that rendered it fails here instead.
        const missingTranslationKeys: string[] = []
        page.on("console", (message) => {
            if (message.type() === "error" && message.text().startsWith(MISSING_KEY_MESSAGE)) {
                missingTranslationKeys.push(message.text())
            }
        })

        await use(page)
        await page.close()
        expect(missingTranslationKeys, "translation keys rendered as their raw id").toEqual([])
    },
})

export {expect} from "@playwright/test"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14216** (2026-01-20): **ForEach Expression doesn't work with Concat task**
  *Symptoms*: ### Describe the issue  `{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}` works with ForEach with the `values` property but does not work with Concat for `files`.  The expression works in Debug Expressions and returns an array of string paths. However, the flow fails for this task because invalid character `Last error was: Illegal character in scheme name at index 0: [“kestra:///company/team/.......` aka it doesn't like that it's an array. However the next example which is the same works.  ```yaml id: concat_files namespace: company.team  tasks:   - id: foreach     type: io.kestra.plugin.core.flow.ForEach     values: ["value1", "value2", "value3"]     tasks:       - id: start_api_call         type: io.kestra.plugin.scripts.shell.Commands         commands:           - echo {{ taskrun.value }} > generated         outputFiles:           - generated    - id: foreach_example     type: io.kestra.plugin.core.flow.ForEach     values: "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}"     tasks:       - id: log         type: io.kestra.plugin.core.log.Log         message: "{{ taskrun.value }}"    - id: concat_dynamic_foreach     type: io.kestra.plugin.core.storage.Concat     files:       - "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}" ```  In this example, we can generate 3 files from the same task. We can access all of these dynamically using `{{ outputs.echo_one.outputFiles | jq('.[]') }}`. This returns an array of string paths, similar
  **Post-Mortem & Fix Analysis**:
  > I think there is just a syntax error in the first example  ```yaml   - id: concat_dynamic_foreach     type: io.kestra.plugin.core.storage.Concat     files:       - "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}" ```  should be  ```yaml   - id: concat_dynamic_foreach     type: io.kestra.plugin.core.storage.Concat     files: "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}" ```  <img width="872" height="513" alt="Image" src="https://github.com/user-attachments/assets/f6d329d4-e94c-4d56-82dc-5fb8e87c7c0f" />   ---  while neither is "pretty", this will only be fixed with a rework how forEach outputs work :( 

- **Issue #14214** (2026-01-20): **Preview text file buttons not visible for 1 line files**
  *Symptoms*: ### Describe the issue  <img width="1439" height="424" alt="Image" src="https://github.com/user-attachments/assets/b06a6af6-0978-4608-9662-caf21069cf72" />   Preview 1.txt:  ```yaml id: output_file_example namespace: company.team  tasks:   - id: echo     type: io.kestra.plugin.scripts.shell.Commands     commands:       - echo "Hello John" > {{ workingDir }}/1.txt     outputFiles:       - "*.txt" ```  ### Environment  - Kestra Version: `develop` 
  **Post-Mortem & Fix Analysis**:
  > hi @wrussell1999 @MilosPaunovic  can you assign this issue to me. Thanks !
  > Hey @wrussell1999, could you double check this, as it was amended as part of https://github.com/kestra-io/kestra/issues/13775 few days ago?
  > Seems to be working on OSS and EE `develop` today. Thanks!  <img width="783" height="320" alt="Image" src="https://github.com/user-attachments/assets/566d9f11-54c2-403a-bb97-1d0c5e379503" />

- **Issue #14212** (2026-01-21): **Flows page table doesn't show the correct number per page when filters load**
  *Symptoms*: ### Describe the issue  Seems the number per page doesn't always get added to the URL when the other filters get loaded in.  OSS:  https://github.com/user-attachments/assets/27139b7e-e389-47eb-b740-24a77415099c  EE:  https://github.com/user-attachments/assets/8136a7f4-e534-461a-9626-138072cec26a   ### Environment  - Kestra Version: `develop` 
  **Post-Mortem & Fix Analysis**:
  > Hey @wrussell1999,  Can you check if this is fixed now that the https://github.com/kestra-io/kestra/issues/14171 is closed?
  > Thanks so much! Fixed on OSS and EE.  However it seems that it's not adding `size` to Logs global page on both OSS and EE. Didn't notice it happening on other places when I opened this issue. Will close this and open a new issue: https://github.com/kestra-io/kestra/issues/14257

- **Issue #14209** (2026-01-19): **[UI] Profile icon text is not readable in sidebar on light mode**
  *Symptoms*: ### Describe the issue  In light mode, the profile icon in the sidebar has a dark background and dark user initial text inside the icon. Because of this, the text inside the profile icon is hard to read.  ### Reproducibility and Visuals  <img width="963" height="1077" alt="Image" src="https://github.com/user-attachments/assets/3a47785f-139f-4d90-b969-357ecd8f2646" />  ### Environment  - Kestra Version: 1.0.23 
  **Post-Mortem & Fix Analysis**:
  > Closing this, as this a EE only issue

- **Issue #14201** (2026-01-20): **Irrelevant editor error**
  *Symptoms*: ```yaml  triggers:   - id: every_day     type: io.kestra.plugin.core.trigger.Schedule     cron: "@daily"     conditions:       - type: io.kestra.plugin.core.condition.ExpressionCondition         expression: "{{  globals['trigger-enabled'] is defined }}" ```  The error shows :  ``` Value must be "io.kestra.plugin.core.condition.ExecutionOutputs" | "io.kestra.plugin.core.condition.Expression".yaml-schema: Condition based on the outputs of an upstream execution. | Condition based on variable expression.(1) ```  Totally unrelated and the syntax is valid   <img width="1335" height="231" alt="Image" src="https://github.com/user-attachments/assets/078669b8-fcd3-4f43-952c-3275f65e9c93" />
  **Post-Mortem & Fix Analysis**:
  > Hey can I work on this issue?
  > can you assign this issue i want to work 

- **Issue #14199** (2026-01-20): **Purple is back in tables (regression)**
  *Symptoms*: ### Describe the issue  There is a regression on these two tables. We previously agreed to stop using purple in tables. On hover, only a highlight should indicate the presence of a link, without using the purple color.  <img width="975" height="783" alt="Image" src="https://github.com/user-attachments/assets/d73e6011-5863-4a1d-b3ca-00cff48112e1" /> <img width="1732" height="1031" alt="Image" src="https://github.com/user-attachments/assets/425dd5df-78d0-447a-b537-60c005aa298f" />  For example:   <img width="677" height="432" alt="Image" src="https://github.com/user-attachments/assets/f7756867-4e60-4fc8-9850-4bd4555ad5e6" />  <img width="765" height="976" alt="Image" src="https://github.com/user-attachments/assets/d8e8425e-5b9a-4065-b649-b4d4b7259f4c" />  ### Environment  - Kestra Version: develop 
  **Post-Mortem & Fix Analysis**:
  > hey @MilosPaunovic   I would like to work on this small bug if it is not assigned.
  > Thanks for the contribution @oion, it's much appreciated! 🚀

- **Issue #14176** (2026-01-20): **[UI] Z-Index of Menu icons is wrong**
  *Symptoms*: ### Describe the issue  is <img width="268" height="73" alt="Image" src="https://github.com/user-attachments/assets/8c17293f-f0dc-4431-9304-077eb6a1ce43" />  should <img width="250" height="82" alt="Image" src="https://github.com/user-attachments/assets/b0b23356-55f2-40d2-9b43-5be91153d29b" />  ### Environment  - Kestra Version: develop 
  **Post-Mortem & Fix Analysis**:
  > can i do it ? 
  > Absolutely, go for it @neelamber-mishra, thanks! 🚀
  > Thanks for the contribution @neelamber-mishra, it's much appreciated! 🚀

- **Issue #14171** (2026-01-20): **Filters cleared clicking twice on some left side tabs**
  *Symptoms*: ### Describe the issue  If I click twice on Dashboards, Flows, Executions, or Logs the filters are cleared on that page/view. This appears to be a bug.  https://github.com/user-attachments/assets/0be74624-790b-4aa4-bc4c-8a5eaa58535c  ### Environment  - Kestra Version: develop  (I'm running EE 1.2.0, but it sounds like this is happening in other environments too.) 
  **Post-Mortem & Fix Analysis**:
  > I can work on this issue!
  > Thanks for the contribution @mahadevaperuka, it's much appreciated! 🚀

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

### Incident Patch 1: `937442e7` (2026-09-30)
**Commit Message**: fix(executions): bulk actions for namespace-scoped and restart/replay rights (#20007)

* fix(executions): show bulk selection for restart and replay rights

The checkbox column ignored RESTART and REPLAY, so a Launcher-style user
got no bulk actions. The Restart button now checks RESTART, not UPDATE.

Refs https://github.com/kestra-io/kestra-ee/issues/11413

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H4kFhhQA8uWoP4h52w1pTu

* fix(executions): show bulk actions for namespace-scoped rights

On the global page props.namespace is undefined, so isAllowed checked
tenant-wide rights and hid the bulk actions from namespace-scoped roles.
The backend already checks each execution.

Refs https://github.com/kestra-io/kestra-ee/issues/11413

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H4kFhhQA8uWoP4h52w1pTu

* fix(executions): gate set labels, pause and resume on their own actions

Set labels, pause and resume were gated on UPDATE while the backend checks
CHANGE_LABELS, PAUSE and RESUME. All three now count towards the selection
column, and canCheck sits below the compu

**File**: `ui/src/components/executions/Executions.vue` (modified, +35/-12)
```diff
@@ -81,7 +81,7 @@
                 <KsButton v-if="canUpdate" :icon="StateMachine" @click="changeStatusDialogVisible = !changeStatusDialogVisible">
                     {{ $t("change state") }}
                 </KsButton>
-                <KsButton v-if="canUpdate" :icon="Restart" @click="isOpenRestartModal = !isOpenRestartModal">
+                <KsButton v-if="canRestart" :icon="Restart" @click="isOpenRestartModal = !isOpenRestartModal">
                     {{ $t("restart") }}
                 </KsButton>
                 <KsButton v-if="canReplay" :icon="PlayBoxMultiple" @click="isOpenReplayModal = !isOpenReplayModal">
@@ -111,13 +111,13 @@
                     </KsButton>
                     <template #dropdown>
                         <KsDropdownMenu>
-                            <KsDropdownItem v-if="canUpdate" :icon="LabelMultiple" @click=" isOpenLabelsModal = !isOpenLabelsModal">
+                            <KsDropdownItem v-if="canChangeLabels" :icon="LabelMultiple" @click=" isOpenLabelsModal = !isOpenLabelsModal">
                                 {{ $t("Set labels") }}
                             </KsDropdownItem>
-                            <KsDropdownItem v-if="canUpdate" :icon="PlayBox" @click="resumeExecutions()">
+                            <KsDropdownItem v-if="canResume" :icon="PlayBox" @click="resumeExecutions()">
                                 {{ $t("resume") }}
                             </KsDropdownItem>
-                            <KsDropdownItem v-if="canUpdate" :icon="PauseBox" @click="pauseExecutions()">
+                            <KsDropdownItem v-if="canPause" :icon="PauseBox" @click="pauseExecutions()">
                                 {{ $t("pause") }}
                             </KsDropdownItem>
                             <KsDropdownItem v-if="canUnqueue" :icon="QueueFirstInLastOut" @click="unqueueDialogVisible = true">
@@ -789,32 +789,55 @@
         return (routeFamily(route.name) === "flows/update") || (route.name === "executions/list")
     })
 
-    const canCheck = computed(() => {
-        return canDelete.value || canUpdate.value || canKill.value || canForceRun.value || canUnqueue.value
+    const isAllowedOnExecutions = (executionAction: string) => props.namespace
+        ? authStore.user?.isAllowed(resource.EXECUTION, executionAction, props.namespace)
+        : authStore.user?.hasAnyActionOnAnyNamespace(resource.EXECUTION, executionAction)
+
+    const canRestart = computed(() => {
+        return isAllowedOnExecutions(action.RESTART)
     })
 
     const canReplay = computed(() => {
-        return authStore.user?.isAllowed(resource.EXECUTION, action.REPLAY, props.namespace)
+        return isAllowedOnExecutions(action.REPLAY)
     })
 
     const canUpdate = computed(() => {
-        return authStore.user?.isAllowed(resource.EXECUTION, action.UPDATE, props.namespace)
+        return isAllowedOnExecutions(action.UPDATE)
     })
 
     const canDelete = computed(() => {
-        return authStore.user?.isAllowed(resource.EXECUTION, action.DELETE, props.namespace)
+        return isAllowedOnExecutions(action.DELETE)
     })
 
     const canKill = computed(() => {
-        return authStore.user?.isAllowed(resource.EXECUTION, action.KILL, props.namespace)
+        return isAllowedOnExecutions(action.KILL)
     })
 
     const canForceRun = computed(() => {
-        return authStore.user?.isAllowed(resource.EXECUTION, action.FORCE_RUN, props.namespace)
+        return isAllowedOnExecutions(action.FORCE_RUN)
     })
 
     const canUnqueue = computed(() => {
-        return authStore.user?.isAllowed(resource.EXECUTION, action.UNQUEUE, props.namespace)
+        return isAllowedOnExecutions(action.UNQUEUE)
+    })
+
+    const canChangeLabels = computed(() => {
+        return isAllowedOnExecutions(action.CHANGE_LABELS)
+    })
+
+    const canPause = computed(() => {
+        return isAllowedOnExecutions(action.PAUSE)
+    })
+
+    const canResume = computed(() => {
+     
```

---

### Incident Patch 2: `a057ba3c` (2026-09-30)
**Commit Message**: fix(ui): type plugin components (#19841)

Signed-off-by: vansh-nagar <vansh.nagar.dev@gmail.com>
Co-authored-by: Rémi Barthe <50530063+RemiBarthe@users.noreply.github.com>

**File**: `ui/scripts/explicit-any/baseline.json` (modified, +0/-6)
```diff
@@ -165,12 +165,6 @@
   "src/components/no-code/utils/cleanUp.ts": 4,
   "src/components/no-code/utils/types.ts": 4,
   "src/components/no-code/utils/useFieldNavigation.ts": 1,
-  "src/components/plugins/BlueprintIconStack.vue": 1,
-  "src/components/plugins/PluginCard.vue": 1,
-  "src/components/plugins/PluginDocumentation.vue": 1,
-  "src/components/plugins/PluginList.vue": 14,
-  "src/components/plugins/PluginSelect.vue": 5,
-  "src/components/plugins/PluginUnified.vue": 7,
   "src/composables/entityIterator.ts": 2,
   "src/composables/monaco/artifacts/editorArtifacts.ts": 1,
   "src/composables/monaco/languages/pebbleLanguageConfigurator.ts": 1,
```

**File**: `ui/src/components/plugins/BlueprintIconStack.vue` (modified, +2/-2)
```diff
@@ -16,13 +16,13 @@
 
 <script setup lang="ts">
     import {ref, computed, onMounted, onBeforeUnmount} from "vue"
-    import TaskIcon from "./TaskIcon.vue"
+    import TaskIcon, {type TaskIconData} from "./TaskIcon.vue"
     import type {PluginIconMap} from "../../utils/pluginUtils"
 
     const props = defineProps<{
         clses: string[]
         icons: PluginIconMap
-        loadIcon?: (cls: string) => Promise<any>
+        loadIcon?: (cls: string) => Promise<TaskIconData | undefined>
     }>()
 
     const ICON_PX = 24
```

**File**: `ui/src/components/plugins/PluginCard.vue` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@
 
     const props = withDefaults(defineProps<{
         iconCls?: string
-        icons?: Record<string, any>
+        icons?: Record<string, TaskIconData>
         loadIcon?: (cls: string) => Promise<TaskIconData | undefined>
         title: string
         description?: string | null
```

**File**: `ui/src/components/plugins/PluginDocumentation.vue` (modified, +7/-8)
```diff
@@ -1,6 +1,6 @@
 <template>
     <div class="plugin-doc">
-        <template v-if="fetchPluginDocumentation && currentPlugin">
+        <template v-if="fetchPluginDocumentation && currentPlugin?.schema && currentPlugin.cls">
             <div class="dp-sticky">
                 <div class="dp-header">
                     <div class="dp-kicker">{{ packagePath }}</div>
@@ -67,8 +67,8 @@
                 <SchemaToHtml
                     class="plugin-schema"
                     :darkMode="isDarkTheme"
-                    :schema="currentPlugin?.schema"
-                    :pluginType="currentPlugin?.cls"
+                    :schema="currentPlugin.schema"
+                    :pluginType="currentPlugin.cls"
                     :forceIncludeProperties="pluginsStore.forceIncludeProperties"
                     noUrlChange
                     compact
@@ -281,6 +281,7 @@
     import {getTheme, copy} from "../../utils/utils"
     import {useMiscStore} from "override/stores/misc"
     import {usePluginsStore} from "../../stores/plugins"
+    import type {PluginComponent} from "../../stores/plugins"
     import {useI18n} from "vue-i18n"
     import GitHub from "vue-material-design-icons/Github.vue"
     import ContentCopy from "vue-material-design-icons/ContentCopy.vue"
@@ -301,7 +302,7 @@
         overrideIntro?: string | null;
         absolute?: boolean;
         fetchPluginDocumentation?: boolean;
-        plugin?: any;
+        plugin?: PluginComponent | null;
     }>(), {
         overrideIntro: null,
         absolute: false,
@@ -331,13 +332,11 @@
     })
 
     const pluginName = computed(() => {
-        const parts = currentPlugin.value?.cls.split(".")
-        return parts[parts.length - 1]
+        return currentPlugin.value?.cls?.split(".").at(-1) ?? ""
     })
 
     const packagePath = computed(() => {
-        const parts = currentPlugin.value?.cls.split(".")
-        return parts.slice(0, -1).join(".")
+        return currentPlugin.value?.cls?.split(".").slice(0, -1).join(".") ?? ""
     })
 
     const pluginKind = computed(() => {
```

**File**: `ui/src/components/plugins/PluginList.vue` (modified, +45/-49)
```diff
@@ -57,26 +57,25 @@
     import {useI18n} from "vue-i18n"
     import {type KsBreadcrumbItem} from "@kestra-io/design-system"
     import TaskIcon from "./TaskIcon.vue"
-    import {isEntryAPluginElementPredicate, isPluginMatched, type PluginIconMap} from "../../utils/pluginUtils"
+    import {isEntryAPluginElementPredicate, isPluginMatched, type Plugin, type PluginIconMap} from "../../utils/pluginUtils"
     import ChevronRight from "vue-material-design-icons/ChevronRight.vue"
     import ChevronLeft from "vue-material-design-icons/ChevronLeft.vue"
     import PluginUnified from "./PluginUnified.vue"
     import PluginDocumentation from "./PluginDocumentation.vue"
     import SearchField from "../layout/SearchField.vue"
-    import {usePluginsStore} from "../../stores/plugins"
+    import {usePluginsStore, type PluginComponent} from "../../stores/plugins"
     import {useScrollMemory} from "../../composables/useScrollMemory"
     import {capitalize, formatPluginTitle} from "../../utils/global"
     import {useMiscStore} from "override/stores/misc"
 
     interface Props {
-        plugins: any[];
+        plugins: Plugin[];
     }
 
-    interface NavigationItem {
-        title: string;
-        type: "group" | "subgroup" | "element";
-        data: any;
-    }
+    type NavigationItem =
+        | {title: string; type: "group"; data: {group: string}}
+        | {title: string; type: "subgroup"; data: {subgroup: string}}
+        | {title: string; type: "element"; data: {cls: string}}
 
     const props = defineProps<Props>()
 
@@ -88,7 +87,7 @@
     const searchQuery = ref<string>("")
     const icons = ref<PluginIconMap>({})
     const navigationStack = ref<NavigationItem[]>([])
-    const currentDocumentationPlugin = ref<any>(null)
+    const currentDocumentationPlugin = ref<PluginComponent | null>(null)
     const currentView = ref<"list" | "group" | "documentation">("documentation")
     const listRef = ref<HTMLDivElement | null>(null)
     const groupRef = ref<HTMLDivElement | null>(null)
@@ -105,11 +104,11 @@
 
     const getSimpleType = (item: string) => item.split(".").pop() || item
 
-    const pushNavigationItem = (title: string, type: NavigationItem["type"], data: any) => {
-        navigationStack.value.push({title, type, data})
+    const pushNavigationItem = (item: NavigationItem) => {
+        navigationStack.value.push(item)
     }
 
-    const getPluginElements = (plugin: any): string[] =>
+    const getPluginElements = (plugin: Plugin): string[] =>
         Object.entries(plugin ?? {})
             .filter(([elementType, elements]) => isEntryAPluginElementPredicate(elementType, elements))
             .flatMap(([, elements]) =>
@@ -118,12 +117,11 @@
                     : [],
             )
 
-    const getPluginDisplayName = (plugin: any): string => {
+    const getPluginDisplayName = (plugin: Plugin): string | undefined => {
         return plugin?.manifest?.["X-Kestra-Title"]
     }
 
-    const isPluginVisible = (plugin: any): boolean => {
-        if (!plugin) return false
+    const isPluginVisible = (plugin: Plugin): boolean => {
         return getPluginElements(plugin).length > 0
     }
 
@@ -136,13 +134,13 @@
     }
 
     const basePlugins = computed(() => {
-        const grouped = (props.plugins ?? []).reduce((acc: Record<string, any[]>, plugin: any) => {
+        const grouped = props.plugins.reduce((acc: Record<string, Plugin[]>, plugin) => {
             (acc[plugin.group] ??= []).push(plugin)
             return acc
         }, {})
 
         const filtered = Object.values(grouped).flatMap(group =>
-            group.filter((p: any) => p.subGroup).length ? group.filter((p: any) => p.subGroup) : group.filter((p: any) => !p.subGroup),
+            group.some(p => p.subGroup) ? group.filter(p => p.subGroup) : group.filter(p => !p.subGroup),
         )
 
         return filtered
@@ -181,7 +179,7 @@
         navigationStack.value.at(-1)?.title ?? t("plugins.names"),
     )
 
-    const openGrou
```

---

### Incident Patch 3: `56913d7f` (2026-09-30)
**Commit Message**: fix(core): pick the right russian plural form (#20006)

Register a `russianPluralIndex` rule for `ru` next to `polishPluralIndex`. Without it, vue-i18n's default rule read three Russian forms as zero | one | many, so a count of 1 rendered the 2-4 form and 2-4 rendered the 5+ form.

Both Slavic rules now also read a four-form message as zero | one | few | many, the only correct layout for a message whose English source has a zero form.

The generator prompt gets a "Russian Plural Forms" line, and for `pl` and `ru` `generateTranslations.ts` now adds a key-specific instruction with the expected form count and rerolls a translation that has the wrong one. The `ru` text of `executions replayed` and `executions resumed`, which was Polish, is regenerated, and the bulk-action success toasts in `Executions.vue` now pass the count as the plural index so the Polish and Russian forms are actually selected.

Related to https://github.com/kestra-io/kestra-ee/pull/11417.
Related to https://github.com/kestra-io/kestra-ee/pull/11373.

**File**: `ui/scripts/translations/ADDING_A_LANGUAGE.md` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ This guide covers everything needed to ship a new UI locale end to end, based on
 | `pl` | Polish | Tone + declension overhauled 2026-08 (https://github.com/kestra-io/kestra/pull/18212, EE https://github.com/kestra-io/kestra-ee/pull/9984); custom plural rule (`polishPluralIndex` in `i18n.ts`) |
 | `pt` | Portuguese | |
 | `pt_BR` | Portuguese (Brazil) | Moment locale key differs: `pt-br` |
-| `ru` | Russian | Three-form plurals, deliberately left on the default rule (unreviewed) |
+| `ru` | Russian | Custom plural rule (`russianPluralIndex` in `i18n.ts`) |
 | `zh_CN` | Simplified Chinese | Moment locale key differs: `zh-cn` |
 
 Volume per new language (as of 2026-08): **~1,900 OSS keys** (`ui/src/translations/en.json`) + **~1,900 EE keys** (`ui-ee/src/translations/ee_translations/en.json` in EE) + the design-system `*.locale.ts` strings. All of it is generated via Gemini, one request per key, so a full new language is roughly 4,000 API calls - plan for the generator to run for a long time (run it in the background).
@@ -72,7 +72,7 @@ This list is hand-maintained and does NOT derive from `languages.ts` - forgettin
 
 ### 3.4 Plural rule (only if the language needs one)
 
-vue-i18n's default rule handles two-form languages (and `tr`, `vi`, `id`, `zh_TW` are fine with it). For a language with three or more plural forms (Slavic family, Arabic), add a custom rule to the `pluralRules` option in `ui/src/translations/i18n.ts`, next to `polishPluralIndex`, and have a native speaker review the three-form messages before enabling it - see the Russian comment there for why an unreviewed rule is worse than the default.
+vue-i18n's default rule handles two-form languages (and `tr`, `vi`, `id`, `zh_TW` are fine with it). For a language with three or more plural forms (Slavic family, Arabic), add a custom rule to the `pluralRules` option in `ui/src/translations/i18n.ts`, next to `polishPluralIndex` and `russianPluralIndex`, and add a matching "Plural Forms" line to the generator prompt so the model writes the form layout the rule expects. Audit the existing three-form messages of that locale before enabling the rule: a message whose English source has a zero form ("no workers | worker | workers") needs four forms (zero | one | few | many) under these rules, and a three-form one in that layout renders the zero text for a count of 1.
 
 ### 3.5 Write the language's generator rules BEFORE generating
 
```

**File**: `ui/scripts/translations/generateTranslations.spec.ts` (modified, +27/-0)
```diff
@@ -27,4 +27,31 @@ describe("generateTranslations", () => {
             rmSync(dir, {recursive: true, force: true})
         }
     })
+
+    it("rerolls a Slavic translation until it has the plural forms the locale rule reads", async () => {
+        const dir = mkdtempSync(join(tmpdir(), "translations-"))
+        writeFileSync(join(dir, "en.json"), JSON.stringify({en: {online: "no workers online | worker online | workers online"}}))
+        const replies = ["нет worker'ов онлайн | worker онлайн | worker'ы онлайн", "нет worker'ов онлайн | worker онлайн | worker'а онлайн | worker'ов онлайн"]
+        const prompts: string[] = []
+        const client = {
+            models: {
+                generateContent: async ({contents}: {contents: string}) => {
+                    prompts.push(contents)
+                    return {text: replies.shift()}
+                },
+            },
+        } as unknown as TranslationClient
+
+        try {
+            await generateTranslations({client, translationsDir: dir, languages: [["ru", "Russian"]]})
+
+            expect(prompts).toHaveLength(2)
+            expect(prompts[0]).toContain("Output exactly four forms")
+            expect(JSON.parse(readFileSync(join(dir, "ru.json"), "utf-8"))).toEqual({
+                ru: {online: "нет worker'ов онлайн | worker онлайн | worker'а онлайн | worker'ов онлайн"},
+            })
+        } finally {
+            rmSync(dir, {recursive: true, force: true})
+        }
+    })
 })
```

**File**: `ui/scripts/translations/generateTranslations.ts` (modified, +42/-5)
```diff
@@ -102,14 +102,43 @@ const withRequestSlot = createGate(CONCURRENCY)
 // PR gate then rejected a file the generator itself had produced.
 const PLACEHOLDER_RETRIES = 3
 
+// Locales whose `pluralRules` entry in `ui/src/translations/i18n.ts` reads [one, few, many], and
+// [zero, one, few, many] for a source that has a zero form. The general prompt line alone was not
+// enough: asked for a zero-first source, the model answered with three forms for 9 of 10 keys,
+// which those rules then render as the zero text for a count of 1.
+const SLAVIC_PLURAL_LOCALES = new Set(["pl", "ru"])
+
+/** vue-i18n separates plural forms with `|`; a literal pipe is escaped as `{'|'}`. */
+const pluralFormCount = (message: string) => message.replace(/\{'[^']*'\}/g, "").split("|").length
+
+/**
+ * How many plural forms a translation into `languageCode` must have, or `undefined` when any count
+ * is fine. English writes one | other, or zero | one | other; the Slavic rules need one more form.
+ */
+function expectedPluralForms(languageCode: string, english: string): number | undefined {
+    if (!SLAVIC_PLURAL_LOCALES.has(languageCode)) return undefined
+
+    const forms = pluralFormCount(english)
+    if (forms === 2) return 3
+    if (forms === 3) return 4
+    return undefined
+}
+
+/** A key-specific line for the prompt, because the general Plural Forms rule is easy to miss. */
+function pluralFormsInstruction(expected: number | undefined): string {
+    if (expected === 3) return "The text has two plural forms separated by `|` (one | other). Output exactly three forms separated by ` | `: one, few, many."
+    if (expected === 4) return "The text has three plural forms separated by `|`, and the first is the zero case (zero | one | other). Output exactly four forms separated by ` | `: zero, one, few, many."
+    return ""
+}
+
 /**
  * Translates one string, or returns `undefined` if the call failed.
  *
  * The failure is reported rather than papered over with the English text, so the caller can leave
  * that key's fingerprint alone — recording it would claim a translation exists and suppress every
  * future retry.
  */
-async function requestTranslation(client: TranslationClient, text: string, targetLanguage: string): Promise<string | undefined> {
+async function requestTranslation(client: TranslationClient, text: string, targetLanguage: string, extraInstruction = ""): Promise<string | undefined> {
     const prompt = `Translate the text provided after "----------" into ${targetLanguage} for use in Kestra’s orchestration UI. Follow these guidelines:
         - Output Only the Translation: Provide only the translated text, with no additional commentary or explanation.
         - Maintain Technical Accuracy: Use correct translations for technical terms (avoid literal translations that change the meaning).
@@ -138,7 +167,8 @@ async function requestTranslation(client: TranslationClient, text: string, targe
           - Polish writes the KV Store's pairs as "pary KV", never "pary Key-Value" or "pary klucz-wartość". The literal label syntax stays "Key:Value".
           - Polish keeps "kill" and "stop" apart: "zabić" / "Zabij" for the kill action, "zatrzymać" for stop. Collapsing them produces nonsense like "musisz zatrzymać egzekucję, aby ją zatrzymać".
         - Polish Prefers a Participle to a Short Relative Clause: when the English is a short noun phrase with a passive relative clause, use the Polish participle. "Executions triggered from Playground mode" is "egzekucje uruchomione w trybie Playground", not "egzekucje, które zostały uruchomione w trybie Playground". Keep the relative clause when the modifier is long.
-        - Polish Plural Forms: Polish has three plural forms (1 / 2-4 / 5+), and \`ui/src/translations/i18n.ts\` registers a pluralRules entry for "pl" so all three work. When the English source already uses the \`|\` plural syntax, write three Polish forms separated by \`|\` (e.g. "{count} plik | {count} pliki | {count} plikó
```

**File**: `ui/src/components/executions/Executions.vue` (modified, +4/-2)
```diff
@@ -983,7 +983,8 @@
             const ac = actionMap[queryAction]
             return ac(options)
                 .then((r) => {
-                    toast.success(t(success, {executionCount: affectedCount(r)}))
+                    const count = affectedCount(r)
+                    toast.success(t(success, {executionCount: count}, count))
                     toggleAllUnselected()
                     dataTable.value?.reload()
                 })
@@ -997,7 +998,8 @@
             const ac = actionMap[byIdAction]
             return ac(options)
                 .then((r) => {
-                    toast.success(t(success, {executionCount: affectedCount(r)}))
+                    const count = affectedCount(r)
+                    toast.success(t(success, {executionCount: count}, count))
                     toggleAllUnselected()
                     dataTable.value?.reload()
                 }).catch((e: unknown) => {
```

**File**: `ui/src/translations/i18n.ts` (modified, +34/-14)
```diff
@@ -53,33 +53,53 @@ function onMissingKey(locale: string, key: string): void {
  * Plural selection for locales that vue-i18n's default rule gets wrong.
  *
  * Given three forms, the default rule picks index 1 for n === 1 and index 2 for
- * everything else, which is the [zero, one, other] shape. Polish is [one, few, many]:
- * 1, then 2-4, then 5+ with 12-14 as an exception. Without this rule a three-form
- * Polish message renders "1 pliki" and "2 plików" — both wrong, and the first is the
- * most common case.
+ * everything else, which is the [zero, one, other] shape. Polish and Russian are
+ * [one, few, many], so without a rule a three-form message renders "1 pliki" and
+ * "2 plików" - both wrong, and the first is the most common case.
  *
- * Russian has the same three-form structure and the same bug, but its messages have not
- * been reviewed against a correct rule, so it deliberately stays on the default.
+ * A message whose English source has a zero form ("no workers | worker | workers")
+ * needs four forms in these languages: [zero, one, few, many].
  *
  * @param choice the count being pluralised
  * @param choicesLength how many forms the message declares
+ * @param oneFewMany the [one, few, many] index for a non-negative count
  */
-function polishPluralIndex(choice: number, choicesLength: number): number {
+function slavicPluralIndex(choice: number, choicesLength: number, oneFewMany: (n: number) => number): number {
   if (choicesLength < 3) return choice === 1 ? 0 : 1
 
   const n = Math.abs(choice)
-  if (n === 1) return 0
+  if (choicesLength === 4) return n === 0 ? 0 : oneFewMany(n) + 1
+
+  return oneFewMany(n)
+}
+
+/** Polish: 1, then 2-4, then 5+, with 12-14 as an exception. 21 is "many" ("21 plików"). */
+function polishPluralIndex(choice: number, choicesLength: number): number {
+  return slavicPluralIndex(choice, choicesLength, (n) => {
+    if (n === 1) return 0
+
+    const mod10 = n % 10
+    const mod100 = n % 100
+    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 1
+
+    return 2
+  })
+}
 
-  const mod10 = n % 10
-  const mod100 = n % 100
-  // 2-4, 22-24, 32-34 … take the "few" form; 12-14 fall through to "many".
-  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 1
+/** Russian: 1, 21, 31... then 2-4, 22-24... then the rest, with 11-14 as exceptions. */
+function russianPluralIndex(choice: number, choicesLength: number): number {
+  return slavicPluralIndex(choice, choicesLength, (n) => {
+    const mod10 = n % 10
+    const mod100 = n % 100
+    if (mod10 === 1 && mod100 !== 11) return 0
+    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 1
 
-  return 2
+    return 2
+  })
 }
 
 export function setupI18n(options: {locale: Locales} = {locale: "en"}) {
-  const i18n = createI18n<false>({...options, legacy: false, pluralRules: {pl: polishPluralIndex}, missing: onMissingKey, missingWarn: false})
+  const i18n = createI18n<false>({...options, legacy: false, pluralRules: {pl: polishPluralIndex, ru: russianPluralIndex}, missing: onMissingKey, missingWarn: false})
   setI18nLanguage(i18n, options.locale)
   globalI18n.value = i18n.global
   return i18n
```

---

### Incident Patch 4: `f9a64a8c` (2026-09-30)
**Commit Message**: fix(flows): close plugin documentation when switching editor (#19889)

Closes https://github.com/kestra-io/kestra/issues/18469.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018TG2Pr6Nwa9djag5QRhCxk

**File**: `ui/src/stores/plugins.ts` (modified, +4/-0)
```diff
@@ -500,6 +500,10 @@ export const usePluginsStore = defineStore("plugins", () => {
             return
         }
 
+        if (currentlyLoading?.cls !== cls || currentlyLoading?.version !== version) {
+            return
+        }
+
         editorPlugin.value = {
             cls,
             version,
```

**File**: `ui/src/utils/documentationGuard.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import type {RouteLocationNormalized} from "vue-router"
+import {useDocStore} from "../stores/doc"
+import {usePluginsStore} from "../stores/plugins"
+
+function section(route: RouteLocationNormalized): string {
+    return String(route.name ?? "").split("/")[0]
+}
+
+export function documentationGuard(to: RouteLocationNormalized, from: RouteLocationNormalized) {
+    const pathArray = to.path.split("/")
+    useDocStore().docId = pathArray[pathArray.length - 1]
+
+    // Every editor shares one plugin documentation, so a dashboard's KPI doc would otherwise open in the flow editor (kestra-io/kestra#18469).
+    if (section(to) !== section(from)) {
+        usePluginsStore().updateDocumentation()
+    }
+
+    if (to.query["showDocId"] === undefined && from.query["showDocId"] !== undefined) {
+        return {path: to.path, query: {...to.query, showDocId: from.query["showDocId"]}}
+    }
+}
```

**File**: `ui/src/utils/init.ts` (modified, +2/-19)
```diff
@@ -13,7 +13,7 @@ import {setDesignSystemLocale, dateUtils, registerDesignSystemI18n} from "@kestr
 import createUnsavedChanged from "./unsavedChange"
 import createEventsRouter from "./eventsRouter"
 import "./global"
-import {useDocStore} from "../stores/doc"
+import {documentationGuard} from "./documentationGuard"
 import {entityNotFoundGuard} from "./routeEntityGuard"
 
 
@@ -40,24 +40,7 @@ export default async (
     const piniaStore = createPinia()
     app.use(piniaStore)
 
-    /**
-     * Manage docId initialization for Contextual docs
-     */
-    router.beforeEach((to, from) => {
-        // set the docId from the path
-        // so it has a default
-        const pathArray = to.path.split("/")
-        const docId = pathArray[pathArray.length-1]
-
-        const docStore = useDocStore()
-        docStore.docId = docId
-
-        // propagate showDocId query param
-        // to the next page to facilitate docs binding
-        if(to.query["showDocId"] === undefined && from.query["showDocId"] !== undefined){
-            return {path: to.path, query: {...to.query, showDocId: from.query["showDocId"]}}
-        }
-    })
+    router.beforeEach(documentationGuard)
 
     if(guards.beforeEach){
         router.beforeEach(guards.beforeEach.bind(null, router) as Parameters<typeof router.beforeEach>[0])
```

**File**: `ui/tests/unit/utils/documentationGuard.spec.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import {describe, it, expect, vi, beforeEach} from "vitest"
+import {setActivePinia, createPinia} from "pinia"
+import type {RouteLocationNormalized} from "vue-router"
+
+import type {Plugin} from "../../../src/utils/pluginUtils"
+import type {usePluginsStore} from "../../../src/stores/plugins"
+import type {documentationGuard as DocumentationGuard} from "../../../src/utils/documentationGuard"
+
+const pluginDocumentationMock = vi.fn()
+
+vi.mock("@kestra-io/kestra-sdk", () => ({
+    useClient: () => ({get: vi.fn(), post: vi.fn()}),
+}))
+
+vi.mock("@kestra-io/kestra-sdk/plugins", () => ({
+    pluginDocumentation: pluginDocumentationMock,
+    pluginDocumentationFromVersion: vi.fn(),
+}))
+
+vi.mock("override/utils/route", () => ({
+    apiUrl: () => "/api/v1",
+    apiUrlWithoutTenants: () => "/api/v1",
+    baseUrl: "/",
+}))
+
+vi.mock("../../../src/stores/api", () => ({
+    API_URL: "https://api.kestra.io",
+}))
+
+vi.mock("../../../src/utils/tabTracking", () => ({
+    trackPluginDocumentationView: vi.fn(),
+}))
+
+const KPI = "io.kestra.plugin.core.dashboard.chart.KPI"
+
+const CORE: Plugin = {
+    name: "core",
+    title: "Core",
+    group: "io.kestra.plugin.core",
+    tasks: [],
+    charts: [{cls: KPI, deprecated: false}],
+}
+
+function route(name: string, path: string): RouteLocationNormalized {
+    return {name, path, query: {}, params: {}} as unknown as RouteLocationNormalized
+}
+
+const DASHBOARD = route("dashboards/create", "/dashboards/new")
+const FLOW_CREATE = route("flows/create", "/flows/new")
+const FLOW_UPDATE = route("flows/update", "/flows/edit/io.kestra/hello")
+
+describe("documentationGuard", () => {
+    let store: ReturnType<typeof usePluginsStore>
+    let documentationGuard: typeof DocumentationGuard
+
+    beforeEach(async () => {
+        vi.resetModules()
+        pluginDocumentationMock.mockReset()
+        pluginDocumentationMock.mockResolvedValue({schema: {properties: {properties: {}}}})
+        setActivePinia(createPinia())
+        const {usePluginsStore} = await import("../../../src/stores/plugins")
+        ;({documentationGuard} = await import("../../../src/utils/documentationGuard"))
+        store = usePluginsStore()
+        store.plugins = [CORE]
+    })
+
+    it("closes the plugin documentation when leaving for another editor", async () => {
+        await store.updateDocumentation({cls: KPI})
+
+        documentationGuard(FLOW_CREATE, DASHBOARD)
+
+        expect(store.editorPlugin).toBeUndefined()
+    })
+
+    it("keeps the plugin documentation within the same editor", async () => {
+        await store.updateDocumentation({cls: KPI})
+
+        documentationGuard(FLOW_UPDATE, FLOW_CREATE)
+
+        expect(store.editorPlugin?.cls).toBe(KPI)
+    })
+
+    it("drops a documentation still loading when leaving for another editor", async () => {
+        const loading = store.updateDocumentation({cls: KPI})
+
+        documentationGuard(FLOW_CREATE, DASHBOARD)
+        await loading
+
+        expect(store.editorPlugin).toBeUndefined()
+    })
+})
```

---

### Incident Patch 5: `7b82f7e3` (2026-09-30)
**Commit Message**: fix(core): fall back to the default tab when no tab is requested (#19919)

`resolveDefaultTab` now returns the `fallback` for a nullish `requested` tab instead of matching a route without `meta.tab` and returning `undefined`.

Closes https://github.com/kestra-io/kestra/issues/19918.

**File**: `ui/src/utils/routeTabs.ts` (modified, +2/-1)
```diff
@@ -7,5 +7,6 @@ import type {RouteRecordRaw} from "vue-router"
  * registered child route, which would otherwise make vue-router throw.
  */
 export function resolveDefaultTab(tabRoutes: RouteRecordRaw[], requested: string | null | undefined, fallback: string): string {
-    return tabRoutes.some((tabRoute) => tabRoute.meta?.tab === requested) ? (requested as string) : fallback
+    // A nullish `requested` would otherwise match a route without `meta.tab` (`undefined === undefined`).
+    return requested != null && tabRoutes.some((tabRoute) => tabRoute.meta?.tab === requested) ? requested : fallback
 }
```

**File**: `ui/tests/unit/utils/routeTabs.spec.ts` (modified, +6/-0)
```diff
@@ -29,4 +29,10 @@ describe("resolveDefaultTab", () => {
         expect(resolveDefaultTab(mixed, "edit", "overview")).toBe("edit")
         expect(resolveDefaultTab([{path: "a"}] as RouteRecordRaw[], "edit", "overview")).toBe("overview")
     })
+
+    it("returns the fallback for a nullish requested value when a route has no meta.tab", () => {
+        const untagged = [{path: "a"}, {path: "b", meta: {}}, {meta: {tab: "edit"}}] as RouteRecordRaw[]
+        expect(resolveDefaultTab(untagged, undefined, "overview")).toBe("overview")
+        expect(resolveDefaultTab(untagged, null, "overview")).toBe("overview")
+    })
 })
```

---

### Incident Patch 6: `2bf2729a` (2026-09-28)
**Commit Message**: fix(worker): check the tenant of OpaqueData payloads sent by workers

The metadata save RPCs now declare a tenant_id that overrides the
payload's tenant. A WorkerTenantAccessGuard hook, a no-op in OSS, filters
decoded records. A task or trigger result is kept while its job is still
held by the worker that sent it, so work dispatched before a subscription
change still completes.
Closes https://github.com/kestra-io/kestra-ee/issues/11340.

**File**: `core/src/main/java/io/kestra/core/executor/WorkerJobRunningStateStore.java` (modified, +6/-0)
```diff
@@ -48,6 +48,12 @@ public interface WorkerJobRunningStateStore {
      */
     void deleteByKeyAndWorker(TransactionContext txContext, String key, String workerUid);
 
+    /**
+     * Returns whether the running worker job for the given key is held by the given worker, reading the
+     * latest write rather than a possibly stale search index.
+     */
+    boolean existsByKeyAndWorker(String key, String workerUid);
+
     /**
      * Save a running worker job.
      *
```

**File**: `jdbc/src/main/java/io/kestra/jdbc/runner/AbstractJdbcWorkerJobRunningStateStore.java` (modified, +16/-0)
```diff
@@ -122,6 +122,22 @@ private void deleteByKeyAndWorker(DSLContext dslContext, String key, String work
             );
     }
 
+    @Override
+    public boolean existsByKeyAndWorker(String key, String workerUid) {
+        return this.jdbcRepository
+            .getDslContextWrapper()
+            .transactionResult(
+                configuration -> DSL
+                    .using(configuration)
+                    .fetchExists(
+                        DSL.selectOne()
+                            .from(this.jdbcRepository.getTable())
+                            .where(field("key").eq(key))
+                            .and(field("worker_uid").eq(workerUid))
+                    )
+            );
+    }
+
     @Override
     public Set<String> findWorkerUidsWithRunningJobs() {
         return this.jdbcRepository
```

**File**: `jdbc/src/test/java/io/kestra/jdbc/runner/JdbcWorkerJobRunningStateStoreTest.java` (modified, +12/-0)
```diff
@@ -196,6 +196,18 @@ void shouldDeleteEntryOnlyWhenTheGivenWorkerStillHoldsIt() {
         assertThat(existsByKey(workerTaskRunning.uid())).isFalse();
     }
 
+    @Test
+    void shouldFindEntryOnlyForTheWorkerHoldingIt() {
+        // Given
+        WorkerTaskRunning workerTaskRunning = workerTaskRunning("worker-a");
+        workerJobRunningStateStore.save(NoTransactionContext.INSTANCE, workerTaskRunning);
+
+        // Then
+        assertThat(workerJobRunningStateStore.existsByKeyAndWorker(workerTaskRunning.uid(), "worker-a")).isTrue();
+        assertThat(workerJobRunningStateStore.existsByKeyAndWorker(workerTaskRunning.uid(), "worker-b")).isFalse();
+        assertThat(workerJobRunningStateStore.existsByKeyAndWorker(IdUtils.create(), "worker-a")).isFalse();
+    }
+
     @Test
     void shouldProcessOnlyEntriesOfGivenWorkersWhenProcessingOrphans() {
         // Given
```

**File**: `worker-controller/src/main/java/io/kestra/controller/grpc/services/GrpcKVMetadataControllerService.java` (modified, +11/-2)
```diff
@@ -9,6 +9,7 @@
 import io.kestra.controller.RequiresControllerServer;
 import io.kestra.controller.grpc.BooleanResponse;
 import io.kestra.controller.grpc.KVMetadataRequest;
+import io.kestra.controller.grpc.KVMetadataSaveRequest;
 import io.kestra.controller.grpc.KVMetadataServiceGrpc;
 import io.kestra.controller.grpc.NamespaceRequest;
 import io.kestra.controller.grpc.OpaqueData;
@@ -37,12 +38,15 @@ public class GrpcKVMetadataControllerService extends KVMetadataServiceGrpc.KVMet
 
     private final KVMetadataStateStore kvMetadataStateStore;
     private final WorkerInfo workerInfo;
+    private final WorkerTenantAccessGuard workerTenantAccessGuard;
 
     @Inject
     public GrpcKVMetadataControllerService(final KVMetadataStateStore kvMetadataStateStore,
-        final WorkerInfo workerInfo) {
+        final WorkerInfo workerInfo,
+        final WorkerTenantAccessGuard workerTenantAccessGuard) {
         this.kvMetadataStateStore = kvMetadataStateStore;
         this.workerInfo = workerInfo;
+        this.workerTenantAccessGuard = workerTenantAccessGuard;
     }
 
     @Override
@@ -117,11 +121,16 @@ public void existsByNamespace(NamespaceRequest request, StreamObserver<BooleanRe
     }
 
     @Override
-    public void save(OpaqueData request, StreamObserver<OpaqueData> responseObserver) {
+    public void save(KVMetadataSaveRequest request, StreamObserver<OpaqueData> responseObserver) {
         try {
             log.trace("Received save request");
 
             PersistedKvMetadata item = MESSAGE_FORMAT.fromByteString(request.getMessage(), PersistedKvMetadata.class);
+            if (request.getTenantId().isEmpty()) {
+                workerTenantAccessGuard.checkUndeclaredTenant(request.getHeader(), item.getTenantId());
+            } else {
+                item = item.toBuilder().tenantId(request.getTenantId()).build();
+            }
 
             PersistedKvMetadata result = kvMetadataStateStore.save(item);
 
```

**File**: `worker-controller/src/main/java/io/kestra/controller/grpc/services/GrpcNSMetadataControllerService.java` (modified, +10/-2)
```diff
@@ -32,12 +32,15 @@ public class GrpcNSMetadataControllerService extends NamespaceFileMetadataServic
 
     private final NamespaceFileMetadataStateStore stateStore;
     private final WorkerInfo workerInfo;
+    private final WorkerTenantAccessGuard workerTenantAccessGuard;
 
     @Inject
     public GrpcNSMetadataControllerService(final NamespaceFileMetadataStateStore stateStore,
-        final WorkerInfo workerInfo) {
+        final WorkerInfo workerInfo,
+        final WorkerTenantAccessGuard workerTenantAccessGuard) {
         this.stateStore = stateStore;
         this.workerInfo = workerInfo;
+        this.workerTenantAccessGuard = workerTenantAccessGuard;
     }
 
     @Override
@@ -196,11 +199,16 @@ public void existsByNamespace(NamespaceRequest request, StreamObserver<BooleanRe
     }
 
     @Override
-    public void save(OpaqueData request, StreamObserver<OpaqueData> responseObserver) {
+    public void save(NamespaceFileMetadataSaveRequest request, StreamObserver<OpaqueData> responseObserver) {
         try {
             log.trace("Received save request");
 
             NamespaceFileMetadata item = MESSAGE_FORMAT.fromByteString(request.getMessage(), NamespaceFileMetadata.class);
+            if (request.getTenantId().isEmpty()) {
+                workerTenantAccessGuard.checkUndeclaredTenant(request.getHeader(), item.getTenantId());
+            } else {
+                item = item.toBuilder().tenantId(request.getTenantId()).build();
+            }
 
             NamespaceFileMetadata result = stateStore.save(item);
 
```

---

### Incident Patch 7: `c89ab4f1` (2026-09-23)
**Commit Message**: fix(execution): Loop with a pause

The Loop task was not handling correctly a Pause sub-task so the execution never terminates.

Now, when resumed, the loop and the parent execution are themselves resumed.

Fixes https://github.com/kestra-io/kestra/issues/19373

**File**: `core/src/main/java/io/kestra/core/models/executions/LoopExecutionEvent.java` (modified, +2/-1)
```diff
@@ -11,7 +11,8 @@
 /**
  * Event emitted by the executor to communicate a loop sub-execution state change to its parent execution.
  * The {@code state} field drives how the parent reacts: a {@link State.Type#PAUSED} state pauses the
- * parent loop task run; any terminated state ends or advances the loop iteration.
+ * parent loop task run, a {@link State.Type#RESTARTED} restart from a pause;
+ * any terminated state ends or advances the loop iteration.
  */
 public record LoopExecutionEvent(
     LoopRun loopRun,
```

**File**: `core/src/main/java/io/kestra/core/services/ExecutionService.java` (modified, +32/-4)
```diff
@@ -107,6 +107,9 @@ public class ExecutionService {
     @Inject
     private BroadcastQueueInterface<ExecutionKilled> killQueue;
 
+    @Inject
+    private DispatchQueueInterface<LoopExecutionEvent> loopExecutionEventQueue;
+
     @Inject
     private AsyncOperationWaiter asyncOperationWaiter;
 
@@ -227,9 +230,18 @@ private boolean isDescendantOf(TaskRun taskRun, String ancestorId, Map<String, T
         return false;
     }
 
+    /**
+     * Pause a flowable task: set both the taskrun and the execution to {@link State.Type#PAUSED}.
+     */
     public Execution pauseFlowable(Execution execution, TaskRun updateFlowableTaskRun) throws InternalException {
+        return execution.withTaskRun(updateFlowableTaskRun.withStateAndAttempt(State.Type.PAUSED)).withState(State.Type.PAUSED);
+    }
 
-        return execution.withTaskRun(updateFlowableTaskRun.withState(State.Type.PAUSED)).withState(State.Type.PAUSED);
+    /**
+     * Resume a flowable task: set both the taskrun and the execution to {@link State.Type#RUNNING}.
+     */
+    public Execution resumeFlowable(Execution execution, TaskRun updateFlowableTaskRun) throws InternalException {
+        return execution.withTaskRun(updateFlowableTaskRun.withStateAndAttempt(State.Type.RUNNING)).withState(State.Type.RUNNING);
     }
 
     public Execution create(Create createCommand, ProcessedFlow processedFlow) {
@@ -674,7 +686,7 @@ private Execution markAs(final Execution execution, FlowInterface flow, String t
                 }
                 newTaskRun = originalTaskRun.withState(targetState);
 
-                if (originalTaskRun.getAttempts() != null && !originalTaskRun.getAttempts().isEmpty()) {
+                if (!ListUtils.isEmpty(originalTaskRun.getAttempts())) {
                     List<TaskRunAttempt> attempts = new ArrayList<>(originalTaskRun.getAttempts());
                     attempts.set(attempts.size() - 1, attempts.getLast().withState(targetState));
                     newTaskRun = newTaskRun.withAttempts(attempts);
@@ -813,7 +825,7 @@ public void delete(
      * @throws Exception if the state of the execution cannot be updated
      */
     public Execution resume(Execution execution, FlowInterface flow, State.Type newState, Pause.Resumed resumed) throws Exception {
-        return this.resume(execution, flow, newState, (Map<String, Object>) null, resumed);
+        return this.resume(execution, flow, newState, null, resumed);
     }
 
     /**
@@ -920,7 +932,19 @@ public Execution resume(final Execution execution, FlowInterface flow, State.Typ
 
         Execution unpausedExecution;
         if (pausedTaskRun.isPresent()) {
-            unpausedExecution = this.markAs(execution, flow, pausedTaskRun.get().getId(), newState, inputs, resumed);
+            final FlowWithSource flowWithSource = flow instanceof FlowWithSource fws ? fws : flowParsingService.parse(flow, false);
+            Task task = flowWithSource.findTaskByTaskId(pausedTaskRun.get().getTaskId());
+            if (task instanceof Loop) {
+                // find the first loop sub-execution that is paused and its corresponding taskrun
+                var subExecution = executionRepository.findLoopSubExecutions(execution.getTenantId(), execution.getId(), task.getId())
+                    .stream()
+                    .filter(e -> e.getState().isPaused())
+                    .findFirst()
+                    .orElseThrow(() -> new IllegalArgumentException("No paused loop sub-execution found"));
+                return resume(subExecution, flow, newState, inputs, resumed);
+            } else {
+                unpausedExecution = this.markAs(execution, flow, pausedTaskRun.get().getId(), newState, inputs, resumed);
+            }
         } else {
             // we are in a manual execution pause, not triggered by the Pause task, so we just switch the execution to the new state.
             if (!execution.getState().isPaused()) {
@@ -930,6 +954,10 @@ public Execution resume(final Execu
```

**File**: `core/src/test/java/io/kestra/core/runners/AbstractRunnerTest.java` (modified, +6/-0)
```diff
@@ -661,6 +661,12 @@ public void loopWithSubflow(Execution execution) {
         loopCaseTest.loopWithSubflow(execution);
     }
 
+    @Test
+    @ExecuteFlow("flows/valids/loop-with-pause.yaml")
+    public void loopWithPause(Execution execution) {
+        loopCaseTest.loopWithPause(execution);
+    }
+
     @Test
     @LoadFlows(value = { "flows/valids/minimal.yaml" }, tenantId = TENANT_1)
     void shouldScheduleOnDate() throws Exception {
```

**File**: `core/src/test/java/io/kestra/plugin/core/flow/LoopCaseTest.java` (modified, +11/-0)
```diff
@@ -30,6 +30,7 @@
 import static io.kestra.core.utils.Await.await;
 import static io.kestra.core.utils.Rethrow.throwPredicate;
 import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatStream;
 
 @Singleton
 public class LoopCaseTest {
@@ -591,6 +592,16 @@ public void loopWithSubflow(Execution execution) {
         assertThat(subflowExecution2.getTaskRunList()).hasSize(1);
     }
 
+    public void loopWithPause(Execution execution) {
+        assertThat(execution.getTaskRunList()).hasSize(1);
+        assertThat(execution.getState().getCurrent()).isEqualTo(State.Type.SUCCESS);
+        assertThatStream(execution.getState().getHistories().stream().map(h -> h.getState())).contains(State.Type.PAUSED);
+        assertThatStream(execution.getTaskRunList().getFirst().getState().getHistories().stream().map(h -> h.getState())).contains(State.Type.PAUSED);
+
+        var subExecutions = executionRepository.findLoopSubExecutions(execution.getTenantId(), execution.getId(), null);
+        assertThat(subExecutions).hasSize(2);
+    }
+
     private Execution findSubflowExecution(Execution parent) {
         return executionRepository.find(
             Pageable.UNPAGED,
```

**File**: `core/src/test/resources/flows/valids/loop-pause-resume.yaml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+id: loop-pause-resume
+namespace: io.kestra.tests
+
+tasks:
+  - id: loop
+    type: io.kestra.plugin.core.flow.Loop
+    values:
+      - 1
+      - 2
+    tasks:
+      - id: pause
+        type: io.kestra.plugin.core.flow.Pause
\ No newline at end of file
```

---

### Incident Patch 8: `8f9ea5d8` (2026-09-29)
**Commit Message**: fix(execution): restrict replaying executions to terminated executions

Fixes https://github.com/kestra-io/kestra-ee/issues/11126

**File**: `ui/src/components/executions/overview/components/actions/Restart.spec.ts` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+import {describe, expect, it, vi} from "vitest"
+import {mount} from "@vue/test-utils"
+import {createPinia, setActivePinia} from "pinia"
+import {createI18n} from "vue-i18n"
+import KestraDesignSystem from "@kestra-io/design-system"
+import Restart from "./Restart.vue"
+
+vi.mock("vue-router", () => ({
+    useRoute: () => ({query: {}, params: {}, name: "executions/update"}),
+    useRouter: () => ({push: vi.fn(), resolve: vi.fn(() => ({href: ""})), currentRoute: {value: {params: {}}}}),
+}))
+
+function mountRestart(state: string) {
+    setActivePinia(createPinia())
+    return mount(Restart, {
+        props: {
+            isReplay: true,
+            execution: {id: "exec1", namespace: "tests", flowId: "flow1", state: {current: state}},
+        },
+        global: {
+            plugins: [createI18n({legacy: false, locale: "en", missingWarn: false, fallbackWarn: false, messages: {en: {}}}), KestraDesignSystem],
+        },
+    })
+}
+
+describe("Restart (replay)", () => {
+    it.each([
+        // QUEUED and RETRYING are not running but not terminated either: the API rejects a
+        // replay of either with a 409, so the button must stay disabled for them too.
+        ["QUEUED", true],
+        ["RETRYING", true],
+        ["RUNNING", true],
+        ["SUCCESS", false],
+        ["FAILED", false],
+        ["KILLED", false],
+    ])("disables replay when execution state is %s: disabled=%s", (state, expectDisabled) => {
+        const wrapper = mountRestart(state)
+
+        expect(wrapper.find("button").attributes("disabled") !== undefined).toBe(expectDisabled)
+    })
+})
```

**File**: `ui/src/components/executions/overview/components/actions/Restart.vue` (modified, +3/-2)
```diff
@@ -285,8 +285,9 @@
             return false
         }
 
-        const isRunning = State.isRunning(props.execution.state.current)
-        return props.isReplay ? !isRunning : props.execution.state.current === State.FAILED
+        return props.isReplay
+            ? State.isTerminated(props.execution.state.current)
+            : props.execution.state.current === State.FAILED
     })
 
     const tooltip = computed(() =>
```

**File**: `webserver/src/main/java/io/kestra/webserver/controllers/api/ExecutionController.java` (modified, +26/-5)
```diff
@@ -1471,6 +1471,7 @@ public HttpResponse<Execution> replayExecution(
         @Parameter(description = "Set a list of breakpoints at specific tasks 'id.value', separated by a coma.") @QueryValue Optional<String> breakpoints) throws Exception {
         Execution execution = executionRepository.findById(tenantService.resolveTenant(), executionId).orElseThrow(NotFoundException::new);
 
+        controlReplayable(execution);
         this.controlRevision(execution, revision);
 
         Flow flow = flowService.getFlowIfExecutableOrThrow(tenantService.resolveTenant(), execution.getNamespace(), execution.getFlowId(), Optional.ofNullable(revision));
@@ -1509,12 +1510,9 @@ public Mono<HttpResponse<Execution>> replayExecutionWithinputs(
                 )
             )
         ) @Body MultipartBody inputs) {
-        Optional<Execution> execution = executionRepository.findById(tenantService.resolveTenant(), executionId);
-        if (execution.isEmpty()) {
-            return null;
-        }
-        Execution current = execution.get();
+        Execution current = executionRepository.findById(tenantService.resolveTenant(), executionId).orElseThrow(NotFoundException::new);
 
+        controlReplayable(current);
         this.controlRevision(current, revision);
 
         Flow flow = flowService.getFlowIfExecutableOrThrow(tenantService.resolveTenant(), current.getNamespace(), current.getFlowId(), Optional.ofNullable(revision));
@@ -1607,6 +1605,14 @@ private static void controlDraftExecutableAs(Flow flow, @Nullable ExecutionKind
         }
     }
 
+    private static void controlReplayable(Execution execution) {
+        if (!execution.getState().isTerminated()) {
+            throw new ConflictException(
+                "Cannot replay execution: current state is '%s', expected terminated.".formatted(execution.getState().getCurrent())
+            );
+        }
+    }
+
     private void controlRevision(Execution execution, Integer revision) {
         if (revision != null) {
             Optional<Flow> flowRevision = this.flowRepository.findById(
@@ -2083,6 +2089,21 @@ public MutableHttpResponse<ApiAsyncOperationResponse> replayExecutionsByIds(
     private MutableHttpResponse<ApiAsyncOperationResponse> replayExecutions(Boolean latestRevision, List<Execution> executions) throws QueueException {
         validateBulkExecutionACL(executions, BulkOperation.REPLAY);
 
+        List<ProblemError> invalids = new ArrayList<>();
+        for (Execution execution : executions) {
+            if (!execution.getState().isTerminated()) {
+                invalids.add(executionProblem(
+                    execution.getId(),
+                    "Execution '%s' must be terminated to be replayed, current state is '%s' !"
+                        .formatted(execution.getId(), execution.getState().getCurrent()),
+                    ProblemTypes.CONFLICT
+                ));
+            }
+        }
+        if (!invalids.isEmpty()) {
+            throw new BulkValidationException("One or more executions could not be replayed.", invalids);
+        }
+
         this.replayCounter.increment(executions.size());
 
         return submitBatchAction(executions, (execution, opId) ->
```

**File**: `webserver/src/test/java/io/kestra/webserver/controllers/api/ExecutionControllerRunnerTest.java` (modified, +73/-0)
```diff
@@ -970,6 +970,25 @@ void replayExecutionFromTaskIdWithInputs() throws Exception {
             .forEach(state -> assertThat(state.getCurrent()).isIn(State.Type.SUCCESS, State.Type.SKIPPED));
     }
 
+    @Test
+    void shouldReturnNotFoundWhenReplayWithInputsCalledOnUnknownExecution() {
+        MultipartBody multipartBody = MultipartBody.builder()
+            .addPart("condition", "success")
+            .build();
+
+        HttpClientResponseException e = assertThrows(
+            HttpClientResponseException.class,
+            () -> client.toBlocking().retrieve(
+                HttpRequest
+                    .POST("/api/v1/main/executions/notfound/actions/replay-with-inputs", multipartBody)
+                    .contentType(MediaType.MULTIPART_FORM_DATA_TYPE),
+                Execution.class
+            )
+        );
+
+        assertThat(e.getStatus().getCode()).isEqualTo(HttpStatus.NOT_FOUND.getCode());
+    }
+
     @Test
     @LoadFlows({ "flows/valids/replay-loop.yaml" })
     void restartExecutionFromTaskIdWithSequential() throws Exception {
@@ -3547,6 +3566,60 @@ void shouldReturnConflictWhenRestartExecutionCalledOnKilledExecution(String tena
         assertThat(bulkErrorResponse.get()).contains("must be terminated to be restarted, current state is 'KILLED'");
     }
 
+    @Test
+    @LoadFlowsWithTenant({ "flows/valids/pause-test.yaml" })
+    void shouldReturnConflictWhenReplayCalledOnPausedExecution(String tenantId) throws QueueException {
+        when(tenantService.resolveTenant()).thenReturn(tenantId);
+        Execution pausedExecution = runnerUtils.runOneUntilPaused(tenantId, TESTS_FLOW_NS, "pause-test");
+        assertThat(pausedExecution.getState().isPaused()).isTrue();
+
+        HttpClientResponseException e = assertThrows(
+            HttpClientResponseException.class,
+            () -> client.toBlocking().retrieve(
+                POST(
+                    "/api/v1/%s/executions/%s/actions/replay".formatted(tenantId, pausedExecution.getId()),
+                    List.of(pausedExecution.getId())
+                ),
+                Execution.class
+            )
+        );
+
+        assertThat(e.getStatus().getCode()).isEqualTo(HttpStatus.CONFLICT.getCode());
+        assertThat(e.getMessage()).contains("Cannot replay execution: current state is 'PAUSED', expected terminated.");
+
+        e = assertThrows(
+            HttpClientResponseException.class,
+            () -> client.toBlocking().retrieve(
+                POST(
+                    "/api/v1/%s/executions/replay/by-ids".formatted(tenantId),
+                    List.of(pausedExecution.getId())
+                ),
+                MutableHttpResponse.class
+            )
+        );
+
+        assertThat(e.getStatus().getCode()).isEqualTo(HttpStatus.BAD_REQUEST.getCode());
+        Optional<String> bulkErrorResponse = e.getResponse().getBody(String.class);
+        assertThat(bulkErrorResponse).isPresent();
+        assertThat(bulkErrorResponse.get()).contains("must be terminated to be replayed, current state is 'PAUSED'");
+
+        e = assertThrows(
+            HttpClientResponseException.class,
+            () -> client.toBlocking().retrieve(
+                POST(
+                    "/api/v1/%s/executions/replay/by-query?filters[q][EQUALS]=%s".formatted(tenantId, pausedExecution.getId()),
+                    List.of(pausedExecution.getId())
+                ),
+                MutableHttpResponse.class
+            )
+        );
+
+        assertThat(e.getStatus().getCode()).isEqualTo(HttpStatus.BAD_REQUEST.getCode());
+        bulkErrorResponse = e.getResponse().getBody(String.class);
+        assertThat(bulkErrorResponse).isPresent();
+        assertThat(bulkErrorResponse.get()).contains("must be terminated to be replayed, current state is 'PAUSED'");
+    }
+
     @Test
     @LoadFlows({ "flows/valids/logs.yaml" })
     void shouldReturnBadRequestWhenKillByIdsCalledOnInvalidExecutions() {
```

---

### Incident Patch 9: `a3fc2712` (2026-09-29)
**Commit Message**: fix(dashboards): keep a chart's own filters when a dashboard filter is applied (#19795)

**File**: `core/src/main/java/io/kestra/plugin/core/dashboard/data/IExecutions.java` (modified, +0/-5)
```diff
@@ -35,7 +35,6 @@ default List<AbstractFilter<Fields>> whereWithGlobalFilters(List<QueryFilter> fi
         if (filters != null) {
             List<QueryFilter> namespaceFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.NAMESPACE)).toList();
             if (!namespaceFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.NAMESPACE));
                 namespaceFilters.forEach(f ->
                 {
                     updatedWhere.add(f.toDashboardFilterBuilder(Fields.NAMESPACE, f.value()));
@@ -44,7 +43,6 @@ default List<AbstractFilter<Fields>> whereWithGlobalFilters(List<QueryFilter> fi
 
             List<QueryFilter> labelFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.LABELS)).toList();
             if (!labelFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.LABELS));
                 labelFilters.forEach(f ->
                 {
                     if (f.value() instanceof Map<?, ?> m) {
@@ -66,7 +64,6 @@ default List<AbstractFilter<Fields>> whereWithGlobalFilters(List<QueryFilter> fi
 
             List<QueryFilter> flowFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.FLOW_ID)).toList();
             if (!flowFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.FLOW_ID));
                 flowFilters.forEach(f ->
                 {
                     updatedWhere.add(f.toDashboardFilterBuilder(Fields.FLOW_ID, f.value()));
@@ -75,7 +72,6 @@ default List<AbstractFilter<Fields>> whereWithGlobalFilters(List<QueryFilter> fi
 
             List<QueryFilter> stateFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.STATE)).toList();
             if (!stateFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.STATE));
                 stateFilters.forEach(f ->
                 {
                     updatedWhere.add(f.toDashboardFilterBuilder(Fields.STATE, f.value()));
@@ -84,7 +80,6 @@ default List<AbstractFilter<Fields>> whereWithGlobalFilters(List<QueryFilter> fi
 
             List<QueryFilter> scopeFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.SCOPE)).toList();
             if (!scopeFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.SCOPE));
                 scopeFilters.forEach(f -> updatedWhere.add(f.toDashboardFilterBuilder(Fields.SCOPE, f.value())));
             }
         }
```

**File**: `core/src/main/java/io/kestra/plugin/core/dashboard/data/IFlows.java` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ default List<AbstractFilter<IFlows.Fields>> whereWithGlobalFilters(List<QueryFil
 
         List<QueryFilter> namespaceFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.NAMESPACE)).toList();
         if (!namespaceFilters.isEmpty()) {
-            updatedWhere.removeIf(filter -> filter.getField().equals(IFlows.Fields.NAMESPACE));
             namespaceFilters.forEach(f ->
             {
                 updatedWhere.add(f.toDashboardFilterBuilder(IFlows.Fields.NAMESPACE, f.value()));
```

**File**: `core/src/main/java/io/kestra/plugin/core/dashboard/data/ILogs.java` (modified, +0/-3)
```diff
@@ -24,7 +24,6 @@ default List<AbstractFilter<ILogs.Fields>> whereWithGlobalFilters(List<QueryFilt
 
             List<QueryFilter> namespaceFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.NAMESPACE)).toList();
             if (!namespaceFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.NAMESPACE));
                 namespaceFilters.forEach(f ->
                 {
                     updatedWhere.add(f.toDashboardFilterBuilder(Fields.NAMESPACE, f.value()));
@@ -33,7 +32,6 @@ default List<AbstractFilter<ILogs.Fields>> whereWithGlobalFilters(List<QueryFilt
 
             List<QueryFilter> flowFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.FLOW_ID)).toList();
             if (!flowFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.FLOW_ID));
                 flowFilters.forEach(f ->
                 {
                     updatedWhere.add(f.toDashboardFilterBuilder(Fields.FLOW_ID, f.value()));
@@ -42,7 +40,6 @@ default List<AbstractFilter<ILogs.Fields>> whereWithGlobalFilters(List<QueryFilt
 
             List<QueryFilter> levelFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.LEVEL)).toList();
             if (!levelFilters.isEmpty()) {
-                updatedWhere.removeIf(filter -> filter.getField().equals(Fields.LEVEL));
                 levelFilters.forEach(f ->
                 {
                     List<Level> levels;
```

**File**: `core/src/main/java/io/kestra/plugin/core/dashboard/data/IMetrics.java` (modified, +0/-2)
```diff
@@ -19,7 +19,6 @@ default List<AbstractFilter<IMetrics.Fields>> whereWithGlobalFilters(List<QueryF
 
         List<QueryFilter> namespaceFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.NAMESPACE)).toList();
         if (!namespaceFilters.isEmpty()) {
-            updatedWhere.removeIf(filter -> filter.getField().equals(Fields.NAMESPACE));
             namespaceFilters.forEach(f ->
             {
                 updatedWhere.add(f.toDashboardFilterBuilder(Fields.NAMESPACE, f.value()));
@@ -28,7 +27,6 @@ default List<AbstractFilter<IMetrics.Fields>> whereWithGlobalFilters(List<QueryF
 
         List<QueryFilter> flowFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.FLOW_ID)).toList();
         if (!flowFilters.isEmpty()) {
-            updatedWhere.removeIf(filter -> filter.getField().equals(Fields.FLOW_ID));
             flowFilters.forEach(f ->
             {
                 updatedWhere.add(f.toDashboardFilterBuilder(Fields.FLOW_ID, f.value()));
```

**File**: `core/src/main/java/io/kestra/plugin/core/dashboard/data/ITriggers.java` (modified, +0/-2)
```diff
@@ -19,7 +19,6 @@ default List<AbstractFilter<ITriggers.Fields>> whereWithGlobalFilters(List<Query
 
         List<QueryFilter> namespaceFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.NAMESPACE)).toList();
         if (!namespaceFilters.isEmpty()) {
-            updatedWhere.removeIf(filter -> filter.getField().equals(ITriggers.Fields.NAMESPACE));
             namespaceFilters.forEach(f ->
             {
                 updatedWhere.add(f.toDashboardFilterBuilder(ITriggers.Fields.NAMESPACE, f.value()));
@@ -28,7 +27,6 @@ default List<AbstractFilter<ITriggers.Fields>> whereWithGlobalFilters(List<Query
 
         List<QueryFilter> flowFilters = filters.stream().filter(f -> f.field().equals(QueryFilter.Field.FLOW_ID)).toList();
         if (!flowFilters.isEmpty()) {
-            updatedWhere.removeIf(filter -> filter.getField().equals(Fields.FLOW_ID));
             flowFilters.forEach(f ->
             {
                 updatedWhere.add(f.toDashboardFilterBuilder(Fields.FLOW_ID, f.value()));
```

---

### Incident Patch 10: `b1606e88` (2026-09-29)
**Commit Message**: fix(core): handle Kestra markers inside OTLP log bodies (#19890)

* fix(core): handle Kestra markers inside OTLP log bodies

kotlp wraps every line the command prints in an OTLP log record, so an outputs marker arrived as log text and the task lost its outputs. A body that is itself a marker is now handled as if printed directly.

* fix(core): keep parseOtlp and malformed marker bodies as before

Marker handling stays on framed lines, handleOtlp keeps its void signature, a body that does not parse is logged as text, and warnings redact encrypted outputs.

**File**: `core/src/main/java/io/kestra/core/models/tasks/runners/TaskLogLineMatcher.java` (modified, +39/-7)
```diff
@@ -7,6 +7,7 @@
 import java.nio.charset.StandardCharsets;
 import java.time.Instant;
 import java.util.ArrayList;
+import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
@@ -135,7 +136,12 @@ protected TaskLogMatch handle(Logger logger, RunContext runContext, Instant inst
         }
 
         if (match.otlp() != null && !match.otlp().isEmpty()) {
-            handleOtlp(logger, runContext, instant, match.otlp(), logData);
+            Map<String, Object> otlpOutputs = forwardOtlp(logger, runContext, instant, match.otlp(), logData, true);
+            if (!otlpOutputs.isEmpty()) {
+                Map<String, Object> outputs = new HashMap<>(match.outputs());
+                outputs.putAll(otlpOutputs);
+                return new TaskLogMatch(outputs, match.metrics(), match.logs(), match.assets(), match.otlp());
+            }
         }
 
         return match;
@@ -146,8 +152,9 @@ protected TaskLogMatch handle(Logger logger, RunContext runContext, Instant inst
      * {@code ::{...}::} framing — as produced by the
      * <a href="https://opentelemetry.io/docs/specs/otel/protocol/file-exporter/">OTLP File Exporter</a>.
      * <p>
-     * OTLP logs and metrics are forwarded to the {@link RunContext} exactly as for framed log
-     * lines; OTLP traces are only parsed and returned. Blank lines and lines that cannot be
+     * OTLP logs and metrics are forwarded to the {@link RunContext} as for framed log lines, except
+     * that a {@code ::{...}::} marker in a log body is logged as text; OTLP traces are only parsed
+     * and returned. Blank lines and lines that cannot be
      * parsed (e.g. a line truncated by file rotation) are skipped with a warning. The given
      * stream is fully consumed and closed.
      *
@@ -208,19 +215,33 @@ public OtlpRecord parseOtlpLine(String line) throws JsonProcessingException {
      * untouched as they are only exposed to the caller for now.
      */
     protected void handleOtlp(Logger logger, RunContext runContext, Instant instant, OtlpRecord record, String data) {
+        forwardOtlp(logger, runContext, instant, record, data, false);
+    }
+
+    // Only framed lines handle markers in log bodies, as parseOtlp has no way to return their outputs.
+    private Map<String, Object> forwardOtlp(Logger logger, RunContext runContext, Instant instant, OtlpRecord record, String data, boolean handleMarkers) {
+        Map<String, Object> outputs = new HashMap<>();
         ListUtils.emptyOnNull(record.resourceLogs()).stream()
             .flatMap(resourceLogs -> ListUtils.emptyOnNull(resourceLogs.scopeLogs()).stream())
             .flatMap(scopeLogs -> ListUtils.emptyOnNull(scopeLogs.logRecords()).stream())
             .forEach(logRecord ->
             {
                 try {
+                    Instant logInstant = toInstant(logRecord.timeUnixNano(), instant);
+                    String body = logRecord.body() != null ? logRecord.body().asText() : null;
+                    Optional<Map<String, Object>> markerOutputs = handleMarkers && body != null ? markerOutputs(body, logger, runContext, logInstant) : Optional.empty();
+                    if (markerOutputs.isPresent()) {
+                        outputs.putAll(markerOutputs.get());
+                        return;
+                    }
+
                     runContext
                         .logger()
                         .atLevel(otlpSeverityToLevel(logRecord))
-                        .addKeyValue(ORIGINAL_TIMESTAMP_KEY, toInstant(logRecord.timeUnixNano(), instant))
-                        .log(logRecord.body() != null ? redactEncryptedOutputs(logRecord.body().asText()) : null);
+                        .addKeyValue(ORIGINAL_TIMESTAMP_KEY, logInstant)
+                        .log(body != null ? redactEncryptedOutputs(body) : null);
                 } catch (Exception e) {
-                    logger.warn("Invalid OTLP log '{}'", data, e);
+                    logger.warn("I
```

**File**: `core/src/test/java/io/kestra/core/models/tasks/runners/TaskLogLineMatcherTest.java` (modified, +64/-0)
```diff
@@ -63,6 +63,70 @@ void shouldForwardOtlpLogWhenFramedLineContainsResourceLogs() throws IOException
         assertThat(originalTimestamp(event)).isEqualTo(Instant.ofEpochSecond(0, TIME_UNIX_NANO));
     }
 
+    @Test
+    void shouldReturnOutputsWhenOtlpLogBodyIsMarker() throws IOException {
+        var runContext = runContext();
+        var listAppender = appender(runContext);
+
+        Optional<TaskLogMatch> match = matcher.matches(
+            framed(logRecord(
+                "{\"severityNumber\":9,\"body\":{\"stringValue\":\"::{\\\"outputs\\\":{\\\"myKey\\\":\\\"myValue\\\"}}::\"}}," +
+                    "{\"severityNumber\":9,\"body\":{\"stringValue\":\"plain line\"}}"
+            )),
+            runContext.logger(),
+            runContext,
+            FALLBACK_INSTANT
+        );
+
+        assertThat(match).isPresent();
+        assertThat(match.get().outputs()).containsEntry("myKey", "myValue");
+        assertThat(listAppender.list).extracting(ILoggingEvent::getFormattedMessage).containsExactly("plain line");
+    }
+
+    @Test
+    void shouldEmitMarkerMetricsOnceWhenOtlpLogBodyIsMarker() throws IOException {
+        var runContext = runContext();
+
+        matcher.matches(
+            framed(logRecord("{\"body\":{\"stringValue\":\"::{\\\"metrics\\\":[{\\\"name\\\":\\\"rows\\\",\\\"type\\\":\\\"counter\\\",\\\"value\\\":5}]}::\"}}")),
+            runContext.logger(),
+            runContext,
+            FALLBACK_INSTANT
+        );
+
+        assertThat(runContext.metrics()).singleElement().satisfies(metric -> {
+            assertThat(metric.getName()).isEqualTo("rows");
+            assertThat(metric.getValue()).isEqualTo(5d);
+        });
+    }
+
+    @Test
+    void shouldLogBodyAsTextWhenOtlpLogBodyIsMalformedMarker() throws IOException {
+        var runContext = runContext();
+        var listAppender = appender(runContext);
+
+        Optional<TaskLogMatch> match = matcher.matches(
+            framed(logRecord("{\"severityNumber\":9,\"body\":{\"stringValue\":\"::{not json}::\"}}")),
+            runContext.logger(),
+            runContext,
+            FALLBACK_INSTANT
+        );
+
+        assertThat(match.orElseThrow().outputs()).isEmpty();
+        assertThat(listAppender.list).extracting(ILoggingEvent::getFormattedMessage).containsExactly("::{not json}::");
+    }
+
+    @Test
+    void shouldLogMarkerAsTextWhenParsingBareNdjson() throws IOException {
+        var runContext = runContext();
+        var listAppender = appender(runContext);
+        String line = logRecord("{\"severityNumber\":9,\"body\":{\"stringValue\":\"::{\\\"outputs\\\":{\\\"myKey\\\":\\\"myValue\\\"}}::\"}}");
+
+        matcher.parseOtlp(new ByteArrayInputStream(line.getBytes(StandardCharsets.UTF_8)), runContext.logger(), runContext, FALLBACK_INSTANT);
+
+        assertThat(listAppender.list).extracting(ILoggingEvent::getFormattedMessage).containsExactly("::{\"outputs\":{\"myKey\":\"myValue\"}}::");
+    }
+
     @Test
     void shouldMapSeverityNumberToSlf4jLevel() throws IOException {
         var runContext = runContext();
```

#### Recent Merged Pull Requests:
- **PR #20034** (closed): fix(loop): complete empty URI loops (@Pushpen2005)
- **PR #20031** (closed): build(deps): store gradlew.bat with CRLF so wrapper bumps stay clean (@elevatebart)
- **PR #20020** (closed): feat(executions): chart switcher on the execution overview (@flcarre)
- **PR #20017** (2026-09-30): [backport releases/v2.0.x] feat(plugins): add the ticketing-task marker interface (@brian-mulier-p)
- **PR #20007** (2026-09-30): fix(executions): bulk actions for namespace-scoped and restart/replay rights (@elevatebart)
- **PR #20006** (2026-09-30): fix(core): pick the right russian plural form (@MilosPaunovic)
- **PR #20000** (closed): feat(ui): search flows and namespaces from the command palette (@Ms-Kulkarni)
- **PR #19957** (2026-09-30): build(deps): bump github/codeql-action/upload-sarif from 4.38.0 to 4.38.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
