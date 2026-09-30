# Forensic Learning Record (Deep Inspection): chakra-ui/ark

> **Canonical Artifact**: `07_PROJECT_LEARNING/chakra-ui-ark-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chakra-ui/ark](https://github.com/chakra-ui/ark))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:46:28.386Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chakra-ui/ark`
- **Description**: Unstyled, accessible UI components for your design System. Works in React, Vue, Solid, and Svelte.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5399 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.storybook/modules/css-modules.d.ts`
```
declare module 'styles/*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module 'styles/*.css'

```

### Core Architecture Module: `packages/mcp/src/http.ts`
```
import { randomUUID } from 'node:crypto'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { server } from './server.js'
import { initializeTools } from './tools/index.js'

export async function main() {
  const app = express()
  app.use(express.json())

  // Store transports for each session type
  const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>,
  }

  // Modern Streamable HTTP endpoint
  app.post('/mcp', async (req, res) => {
    // Check for existing session ID
    const apiKey = req.headers['x-api-key'] as string | undefined
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport

    if (sessionId && transports.streamable[sessionId]) {
      // Reuse existing transport
      transport = transports.streamable[sessionId]
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports.streamable[sessionId] = transport
        },
      })

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports.streamable[transport.sessionId]
        }
      }

      await initializeTools(server, { apiKey })

      // Connect to the MCP server
      await server.connect(transport)
    } else {
      // Invalid request
      console.error('Invalid Streamable HTTP request: ', JSON.stringify(req.body, null, 2))
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      })
      return
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body)
  })

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId || !transports.streamable[sessionId]) {
      console.error('Invalid Streamable HTTP request (invalid/missing session ID): ', JSON.stringify(req.body, null, 2))
      res.status(400).send('Invalid or missing session ID')
      return
    }

    console.log('Handling session request for ID:', sessionId)

    const transport = transports.streamable[sessionId]
    await transport.handleRequest(req, res)
  }

  app.get('/mcp', handleSessionRequest)
  app.delete('/mcp', handleSessionRequest)

  // Legacy SSE endpoint for older clients
  app.get('/sse', async (req, res) => {
    // Create SSE transport for legacy clients
    const apiKey = req.headers['x-api-key'] as string | undefined
    const transport = new SSEServerTransport('/messages', res)
    transports.sse[transport.sessionId] = transport

    res.on('close', () => {
      delete transports.sse[transport.sessionId]
    })

    await initializeTools(server, { apiKey })
    await server.connect(transport)
  })

  // Legacy message endpoint for older clients
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string
    const transport = transports.sse[sessionId]
    if (transport) {
      await transport.handlePostMessage(req, res, req.body)
    } else {
      console.error('No transport found for sessionId', sessionId)
      res.status(400).send('No transport found for sessionId')
    }
  })

  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  app.listen(port, () => {
    console.error(`Ark MCP SSE Server running on http://localhost:${port}`)
  })
}

main().catch(console.error)

```

### Core Architecture Module: `packages/mcp/src/lib/fetch.ts`
```
import type {
  GetComponentPropsResponse,
  GetDocsResponse,
  GetExampleResponse,
  GetStyleGuideResponse,
  ListComponentExamplesResponse,
  ListDocsResponse,
  ListExamplesResponse,
  SearchDocsResponse,
} from './types.js'

const API_BASE = 'https://ark-ui.com/api'

const fetchJson = async <T>(path: string, label: string): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const fetchComponentList = (framework: string) => fetchJson<string[]>(`/types/${framework}`, 'component list')

export const listExamples = (framework: string) => fetchJson<ListExamplesResponse>(`/examples/${framework}`, 'examples')

export const listComponentExamples = async ({ framework, component }: { framework: string; component: string }) => {
  const data = await fetchJson<ListComponentExamplesResponse>(`/examples/${framework}/${component}`, 'examples')
  return data.examples.map((example) => example.id)
}

export const getExample = ({
  framework,
  component,
  exampleId,
}: {
  framework: string
  component: string
  exampleId: string
}) => fetchJson<GetExampleResponse>(`/examples/${framework}/${component}/${exampleId}`, 'example')

export const getStyleGuide = (component: string) =>
  fetchJson<GetStyleGuideResponse>(`/style-guide/${component}`, 'style guide')

export const getComponentProps = async ({
  framework,
  component,
}: {
  framework: string
  component: string
}): Promise<GetComponentPropsResponse> => {
  const props = await fetchJson<Record<string, unknown>>(`/types/${framework}/${component}`, 'component props')

  return {
    framework,
    component,
    props,
  }
}

export const listDocs = () => fetchJson<ListDocsResponse>('/docs', 'docs list')

export const searchDocs = (query: string) =>
  fetchJson<SearchDocsResponse>(`/docs?q=${encodeURIComponent(query)}`, 'docs search')

export const getDocs = (slug: string) => fetchJson<GetDocsResponse>(`/docs/${slug}`, 'docs page')

```

### Core Architecture Module: `packages/mcp/src/lib/types.ts`
```
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface ToolConfig {
  apiKey?: string
}

export interface Tool<T = unknown> {
  name: string
  description: string
  ctx?(): Promise<T>
  disabled?(config?: ToolConfig): boolean
  exec(
    server: McpServer,
    opts: { ctx: T; name: string; description: string; config?: ToolConfig },
  ): Promise<void> | undefined
}
export interface ListExamplesResponse {
  framework: string
  components: {
    component: string
    examples: {
      id: string
      path: string
    }[]
  }[]
}

export interface ListComponentExamplesResponse {
  framework: string
  component: string
  count: number
  examples: Example[]
  path: string
}

export interface GetExampleResponse {
  id: string
  framework: string
  component: string
  files: { name: string; content: string; npmDependencies: string[] }[]
}

export interface GetStyleGuideResponse {
  dataAttr?: Record<string, string>
  cssVar?: Record<string, string>
}

export interface GetComponentPropsResponse {
  framework: string
  component: string
  props: Record<string, any>
}

export interface DocsEntry {
  slug: string
  title: string
  description: string
  category: string
  url: string
}

export interface GetDocsResponse extends DocsEntry {
  content: string
}

export interface SearchDocsResponse {
  query: string
  results: DocsEntry[]
}

export interface ListDocsResponse {
  docs: DocsEntry[]
}

export interface Example {
  id: string
  filename: string
  url: string
}

export const FRAMEWORKS = ['react', 'vue', 'svelte', 'solid'] as const

```

### Core Architecture Module: `packages/mcp/src/server.ts`
```
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export const server = new McpServer({
  name: 'ark-ui',
  version: '1.0.0',
  capabilities: {
    prompts: {},
    resources: {},
    tools: {},
  },
})

```

### Core Architecture Module: `packages/mcp/src/stdio.ts`
```
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { server } from './server.js'
import { initializeTools } from './tools/index.js'

async function main() {
  await initializeTools(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Ark UI MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})

```

### Core Architecture Module: `packages/mcp/src/tools/get-component-props.ts`
```
import { z } from 'zod'
import { fetchComponentList, getComponentProps } from '../lib/fetch.js'
import { FRAMEWORKS, type Tool } from '../lib/types.js'

export const getComponentPropsTool: Tool<{ componentList: string[] }> = {
  name: 'get_component_props',
  description:
    'Get the props/properties for a specific Ark UI component in a given framework. This tool retrieves detailed information about the available props for the specified component.',
  ctx: async () => {
    const componentList = await fetchComponentList('react') // Default to 'react' for initial context
    return { componentList }
  },
  async exec(server, { name, description, ctx }) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: {
          framework: z.enum(FRAMEWORKS).describe('The framework type to get component props for.'),
          component: z
            .enum(ctx.componentList as [string, ...string[]])
            .describe('The name of the component to get props for.'),
        },
      },
      async ({ framework, component }) => {
        const componentProps = await getComponentProps({ framework, component })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(componentProps, null, 2),
            },
          ],
        }
      },
    )
  },
}

```

### Core Architecture Module: `packages/mcp/src/tools/get-example.ts`
```
import { z } from 'zod'
import { fetchComponentList, getExample } from '../lib/fetch.js'
import { FRAMEWORKS, type Tool } from '../lib/types.js'

export const getExampleTool: Tool<{ componentList: string[] }> = {
  name: 'get_example',
  description: 'Retrieve a specific example from Ark UI based on the framework and component type.',
  ctx: async () => {
    const componentList = await fetchComponentList('react') // Default to 'react' for initial context
    return { componentList }
  },
  async exec(server, { ctx, name, description }) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: {
          exampleId: z
            .string()
            .describe(
              'The ID of the example of the component to retrieve. This can be derived from call the list_examples tool.',
            ),
          framework: z.enum(FRAMEWORKS).describe('The framework type.'),
          component: z
            .enum(ctx.componentList as [string, ...string[]])
            .describe('The name of the component to retrieve the example for.'),
        },
      },
      async ({ framework, component, exampleId }) => {
        const example = await getExample({ framework, component, exampleId })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(example, null, 2),
            },
          ],
        }
      },
    )
  },
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3304** (2025-02-16): **Fix: Field Helper Text missing data-disabled attribute when field is disabled**
  *Symptoms*: Added `data-disabled` attribute to `getHelperTextProps()` for the Field component (React, Solid and Vue). Added disabled example for the Field component (React, Solid and Vue). Added tests to check on the `data-disabled` attribute when the Field is disabled  (React, Solid and Vue).  Fixes: #3286  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #iq7RjUphO/R+P2nq5GJU+za9e/2H9wHLLNmcMYHq7Mw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJhcmstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvYXJrLWRvY3MvSDlwa2NHa05SaGJYNmE3RDNrcVRFWHltaWRERSIsInByZXZpZXdVcmwiOiJhcmstZG9jcy1naXQtYi1maWVsZC1oZWxwZXItdGV4dC1kYXRhLWF0dHItY2hha3JhLXVpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJyb290RGlyZWN0b3J5Ijoid2Vic2l0ZSJ9XX0= **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | **ark-docs** | ✅ Ready ([Inspect](https://vercel.com/chakra-ui/ark-docs/H9pkcGkNRhbX6a7D3kqTEXymidDE)) | [Visit Preview](https://ark-docs-git-b-field-helper-text-data-attr-chakra-ui.vercel.app) | Feb 15, 2025 9:42pm |  
  >  [Open in Stackblitz](https://pkg.pr.new/template/f9a9877a-8fe6-4613-b99d-93c374aa61ec)   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/react@3304 ```   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/solid@3304 ```   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/vue@3304 ```   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/svelte@3304 ```   _commit: <a href="https://github.com/chakra-ui/ark/runs/37282820738"><code>941014d</code></a>_ 
  > @carwack awesome mate. thanks for your contribution

- **Issue #3174** (2024-12-28): **Inconsistent indeterminate checkbox behavior**
  *Symptoms*: ### Description  When using `indeterminate` prop in the Checkbox it behaves differently across frameworks.  In React: - With `indeterminate` on, it is impossible to toggle state by clicking  In Vue, Svelte: - Clicking on the indeterminated checkbox changes state to `checked = true`  Solid: I couldn't check because of some broken build  Zag.js: - Machine seems to be able to update state from `indeterminate` to boolean values.  In terms of design, I found that many software installers have the Vue/Svelte option - possibility to remove the intermediate state.   ### Link to Reproduction (or Detailed Explanation)  Storybook  ### Steps to Reproduce  1. Use Storybook 2. You may check on [Zag.js website ](https://zagjs.com/components/react/checkbox) too 3. Set `indeterminate` prop on the checkbox's root 4. Click on the checkbox  ### Ark UI Version  4.5.0  ### Framework  - [X] React - [X] Solid - [X] Vue  ### Browser  Brave 1.73.104  ### Additional Information  _No response_

- **Issue #3136** (2024-12-22): **Scroll Restoration in Overflowing Select Menus**
  *Symptoms*: ### Description  I had a select component which was working fine prior to 4.5.0.  Issues are there with keyboard navigation and scrolling to selected item.  I also confirmed with the official Select examples on ark-ui  ### Link to Reproduction (or Detailed Explanation)  https://stackblitz.com/edit/vitejs-vite-fpkbyy?file=src%2FApp.tsx  ### Steps to Reproduce  1. Open the repro link, select any item after the scroll and re-open it. 2. Click the select trigger and try to navigate the items using keyboard.  ### Ark UI Version  4.5.0  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  Google Chrome Dev  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @thevipinmishra   Thanks for taking your time to report this issue. I could reproduce this in your Stackblitz and our Storybook setup.
  > This regression was introduced by https://github.com/chakra-ui/ark/pull/3081  I just pushed a fix for this. We'll release an update shortly to see if it fixes the issue.

- **Issue #3066** (2024-11-22): **NumberInput render issue**
  *Symptoms*: ### Description  When the NumberInput is rendered, the resulting UI is in disarray.   ### Link to Reproduction (or Detailed Explanation)  https://ark-ui.com/react/docs/components/number-input  ### Steps to Reproduce  Got to NumberInput in Ark component gallery and you should immediately see the issue.  ### Ark UI Version  4.4.4  ### Framework  - [X] React - [X] Solid - [X] Vue  ### Browser  Google Chrome  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @rollercodester Thanks for taking your time to report the issue. I could fix it. Cheers

- **Issue #3065** (2024-12-04): **Component Tabs bugs with controlled mode on first change**
  *Symptoms*: ### Description  When I create a controlled tabs, during the first onValueChange call, I do not change the index and the Tabs.Content unmounts when it shouldn't.  ### Link to Reproduction  https://stackblitz.com/edit/chakra-ui-v3-o9atp5?file=src%2FApp.tsx  ### Steps to reproduce  1. Click on "Second tab" 2. The text "First panel" disappears when it shouldn't  ### Chakra UI Version  3.1.2  ### Browser  Firefox 132.0.2 (latest), Chromium 130.0.6723.116  ### Operating System  - [ ] macOS - [ ] Windows - [X] Linux  ### Additional Information  Initial render is ok :  ![image](https://github.com/user-attachments/assets/536e4696-74e8-48d6-a463-e8dca0c64655)  Click on "Second tab" (text has disappeared)  ![image](https://github.com/user-attachments/assets/1eb096c7-e467-4fe4-ae8d-938a3a997eae)
  **Post-Mortem & Fix Analysis**:
  > @PlayeurZero I transferred the issue to Ark where the underlying issue lives.
  > @segunadebayo   I debugged this a bit and machines returns the value for the second tab, and immediately the value for the first. That should not be the case. What your thoughts?

- **Issue #3043** (2024-12-28): **React Carousel forces sliding animation when using `defaultIndex`**
  *Symptoms*: ### Description  When I use `defaultIndex` prop, I expect the carousel to be rendered with that slide initially. But instead, it would render the first image then slide through all the slides inbetween with a slide animation to the chosen default image.  ### Link to Reproduction (or Detailed Explanation)  See steps.  ### Steps to Reproduce  1. Implement a basic Ark UI carousel (Reect) 2. Have more than 1 image 3. Set prop `defaultIndex` to be larger than `0`  ### Ark UI Version  4.4.0  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @itsJimmyQ   Thanks for reaching out. Good catch. Will see what we can do :)
  > Hey @cschroeter  Is there any update on this bug?
  > This has been fixed in a recent PR. We’ll publish a new version shortly.

- **Issue #2680** (2024-07-20): **fix(docs): fix z-index of docs navbar to 2**
  *Symptoms*: This PR should fix: https://github.com/chakra-ui/ark/issues/2625 and is addition to this PR: #2676   Noticed the same behavior on the docs navbar on the mobile view. I bumped the z-index of the docs navbar to 2, this will be higher than the z-index of the tabs (which is 1).
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BomDpcbwghXGxoWXQTnwOqtQOBg1691TVR52CJM+nWw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJhcmstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvYXJrLWRvY3MvNEpvcTZLblQ3cndzU3FFY1R4YXNYMm5ocGlZNCIsInByZXZpZXdVcmwiOiJhcmstZG9jcy1naXQtZG9jcy1maXgtY29kZS10YWJzLXRleHQtZGlzcGxheXMtNWYzMWU0LWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwicm9vdERpcmVjdG9yeSI6IndlYnNpdGUifV19 **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | **ark-docs** | ✅ Ready ([Inspect](https://vercel.com/chakra-ui/ark-docs/4Joq6KnT7rwsSqEcTxasX2nhpiY4)) | [Visit Preview](https://ark-docs-git-docs-fix-code-tabs-text-displays-5f31e4-chakra-ui.vercel.app) | Jul 20, 2024 9:42pm |  

- **Issue #2676** (2024-07-20): **fix(docs): fix z-index of top navigation to 2**
  *Symptoms*: This PR should fix: #2625   I bumped the z-index of the navbar to 2, this will be higher than the z-index of the tabs (which is 1).
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uZQ/vu0aSU+ObnYP8C7fhMVUlffI1bHpwDbXccSZcG8=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJhcmstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvYXJrLWRvY3MvOW9uUDJ4YXpmUGJ5dTFqWkZDTE44N0x4S0pyUSIsInByZXZpZXdVcmwiOiJhcmstZG9jcy1naXQtZG9jcy1maXgtY29kZS10YWJzLXRleHQtZGlzcGxheXMtNWYzMWU0LWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dfQ== **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | **ark-docs** | ✅ Ready ([Inspect](https://vercel.com/chakra-ui/ark-docs/9onP2xazfPbyu1jZFCLN87LxKJrQ)) | [Visit Preview](https://ark-docs-git-docs-fix-code-tabs-text-displays-5f31e4-chakra-ui.vercel.app) | Jul 19, 2024 11:17pm |  

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

### Incident Patch 1: `c1062eba` (2026-09-29)
**Commit Message**: fix: render default value in value text parts across frameworks (#4130)

NumberInput.ValueText rendered empty without a default slot in Vue and
without children in Solid. AngleSlider.ValueText had the same gap in
Svelte. Solid Select.ValueText ignored custom children.

Closes #4125

**File**: `.changeset/solid-value-text-fallbacks.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/solid': patch
+---
+
+- **NumberInput**: Fix `NumberInput.ValueText` rendering empty when used without children. It now displays the current
+  value.
+- **Select**: Fix `Select.ValueText` ignoring custom children.
```

**File**: `.changeset/svelte-angle-slider-value-text.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/svelte': patch
+---
+
+- **AngleSlider**: Fix `AngleSlider.ValueText` rendering empty when used without children. It now displays the current
+  value in degrees.
```

**File**: `.changeset/vue-number-input-value-text.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **NumberInput**: Fix `NumberInput.ValueText` rendering empty when used without a default slot. It now displays the
+  current value.
```

**File**: `packages/solid/src/components/number-input/number-input-value-text.tsx` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@ export const NumberInputValueText = (props: NumberInputValueTextProps) => {
   const numberInput = useNumberInputContext()
   const mergedProps = mergeProps(() => numberInput().getValueTextProps(), props)
 
-  return <ark.span {...mergedProps} />
+  return <ark.span {...mergedProps}>{props.children || numberInput().value}</ark.span>
 }
```

**File**: `packages/solid/src/components/number-input/tests/number-input.test.tsx` (modified, +5/-0)
```diff
@@ -149,4 +149,9 @@ describe('NumberInput / Field', () => {
       expect(input).toHaveValue('5.5')
     })
   })
+
+  it('should render the value in value text without children', async () => {
+    const { container } = render(() => <ComponentUnderTest defaultValue="42" />)
+    expect(container.querySelector('[data-part="value-text"]')).toHaveTextContent('42')
+  })
 })
```

---

### Incident Patch 2: `d77e3795` (2026-09-29)
**Commit Message**: fix(vue): forward image cropper root props and keep zag boolean defaults (#4129)

ImageCropper.Root never passed its props to the machine. Several parts
also let Vue coerce omitted boolean props to false, overriding Zag
defaults (accordion item disabled, swatch respectAlpha, date picker
fixOnBlur, navigation menu link closeOnClick, toc autoScroll).

Closes #4124

**File**: `.changeset/vue-boolean-prop-defaults.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **ImageCropper**: Fix `ImageCropper.Root` ignoring all of its props, such as `fixedCropArea`, `aspectRatio`, and
+  `initialCrop`.
+- **Accordion**: Fix `Accordion.Item` not inheriting `disabled` from `Accordion.Root`.
+- **ColorPicker**: Fix `ColorPicker.Swatch` and `ColorPicker.ValueSwatch` dropping the alpha channel by default.
+- **DatePicker**: Fix `DatePicker.Input` not committing the typed date on blur by default.
+- **NavigationMenu**: Fix `NavigationMenu.Link` not closing the menu when clicked.
+- **Toc**: Fix `Toc.Root` not auto-scrolling to the active item by default.
```

**File**: `packages/vue/src/components/accordion/accordion-item.vue` (modified, +3/-1)
```diff
@@ -23,7 +23,9 @@ import { AccordionItemProvider } from './use-accordion-item-context.ts'
 import { AccordionItemPropsProvider } from './use-accordion-item-props-context.ts'
 
 const accordion = useAccordionContext()
-const props = defineProps<AccordionItemProps>()
+const props = withDefaults(defineProps<AccordionItemProps>(), {
+  disabled: undefined,
+})
 const item = computed(() => accordion.value.getItemState(props))
 const renderStrategyProps = useRenderStrategyProps()
 const itemContentProps = computed(() => accordion.value.getItemContentProps(props))
```

**File**: `packages/vue/src/components/accordion/tests/accordion-disabled.test.vue` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<script setup lang="ts">
+import { Accordion } from '@ark-ui/vue/accordion'
+</script>
+
+<template>
+  <Accordion.Root disabled>
+    <Accordion.Item value="React">
+      <Accordion.ItemTrigger>React Trigger</Accordion.ItemTrigger>
+      <Accordion.ItemContent>React Content</Accordion.ItemContent>
+    </Accordion.Item>
+  </Accordion.Root>
+</template>
```

**File**: `packages/vue/src/components/accordion/tests/accordion.test.ts` (modified, +6/-0)
```diff
@@ -1,6 +1,7 @@
 import user from '@testing-library/user-event'
 import { render, screen, waitFor } from '@testing-library/vue'
 import ComponentUnderTest from './accordion.test.vue'
+import DisabledComponentUnderTest from './accordion-disabled.test.vue'
 
 describe('Accordion', () => {
   it('should not have an expanded item by default', async () => {
@@ -151,4 +152,9 @@ describe('Accordion', () => {
     await user.click(button)
     await waitFor(() => expect(screen.queryByText('React Content')).not.toBeInTheDocument())
   })
+
+  it('should inherit disabled from root when item does not set it', async () => {
+    render(DisabledComponentUnderTest)
+    expect(screen.getByRole('button', { name: 'React Trigger' })).toBeDisabled()
+  })
 })
```

**File**: `packages/vue/src/components/color-picker/color-picker-swatch.vue` (modified, +3/-1)
```diff
@@ -19,7 +19,9 @@ import { useColorPickerContext } from './use-color-picker-context.ts'
 import { ColorPickerSwatchPropsProvider } from './use-color-picker-swatch-props-context.ts'
 import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 
-const props = defineProps<ColorPickerSwatchProps>()
+const props = withDefaults(defineProps<ColorPickerSwatchProps>(), {
+  respectAlpha: undefined,
+})
 const colorPicker = useColorPickerContext()
 
 ColorPickerSwatchPropsProvider(props)
```

---

### Incident Patch 3: `e3116c61` (2026-09-27)
**Commit Message**: fix(vue): emit combobox select and menu/popover requestDismiss (#4119)

useCombobox never forwarded Zag's onSelect, so @select on
Combobox.Root never fired. Menu and Popover declared a requestDismiss
emit but never forwarded onRequestDismiss either.

Closes #4115

**File**: `.changeset/vue-missing-emits.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **Combobox**: Fix `select` event not being emitted when an item is selected.
+- **Menu, Popover**: Fix `requestDismiss` event not being emitted when a parent layer closes.
```

**File**: `packages/vue/src/components/combobox/tests/combobox.test.ts` (modified, +11/-0)
```diff
@@ -34,6 +34,17 @@ describe('Combobox', () => {
     await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
   })
 
+  it('should emit select when item is selected', async () => {
+    const onSelect = vi.fn()
+    render(ComponentUnderTest, { props: { onSelect } })
+
+    fireEvent.click(screen.getByText('Open'))
+    await waitFor(() => expect(screen.getByRole('option', { name: 'React' })).toBeVisible())
+
+    fireEvent.click(screen.getByRole('option', { name: 'React' }))
+    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ value: ['react'], itemValue: 'react' }))
+  })
+
   it('should open menu when onOpenChange is called', async () => {
     const onOpenChange = vi.fn()
     render(ComponentUnderTest, { props: { onOpenChange } })
```

**File**: `packages/vue/src/components/combobox/use-combobox.ts` (modified, +4/-0)
```diff
@@ -68,6 +68,10 @@ export const useCombobox = <T extends CollectionItem>(
         emit?.('pointerDownOutside', details)
         localeProps.onPointerDownOutside?.(details)
       },
+      onSelect: (details) => {
+        emit?.('select', details)
+        localeProps.onSelect?.(details)
+      },
       onOpenChange: (details) => {
         emit?.('openChange', details)
         emit?.('update:open', details.open)
```

**File**: `packages/vue/src/components/menu/tests/menu-nested.test.vue` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+<script setup lang="ts">
+import { Dialog } from '@ark-ui/vue/dialog'
+import { Menu } from '@ark-ui/vue/menu'
+
+defineProps<{ dialogOpen: boolean }>()
+const emit = defineEmits<{ requestDismiss: [event: CustomEvent] }>()
+</script>
+
+<template>
+  <Dialog.Root :open="dialogOpen">
+    <Dialog.Positioner>
+      <Dialog.Content>
+        <Menu.Root @request-dismiss="emit('requestDismiss', $event)">
+          <Menu.Trigger>click me</Menu.Trigger>
+          <Menu.Positioner>
+            <Menu.Content>
+              <Menu.Item value="edit">Edit</Menu.Item>
+            </Menu.Content>
+          </Menu.Positioner>
+        </Menu.Root>
+      </Dialog.Content>
+    </Dialog.Positioner>
+  </Dialog.Root>
+</template>
```

**File**: `packages/vue/src/components/menu/tests/menu.test.ts` (modified, +11/-0)
```diff
@@ -1,6 +1,7 @@
 import { userEvent as user } from '@testing-library/user-event'
 import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
 import SeparatorAsChildComponentUnderTest from './menu-separator-as-child.test.vue'
+import NestedComponentUnderTest from './menu-nested.test.vue'
 import ComponentUnderTest from './menu.test.vue'
 
 describe('Menu', () => {
@@ -119,4 +120,14 @@ describe('Menu', () => {
     expect(separator).toHaveAttribute('data-scope', 'menu')
     expect(separator).toHaveAttribute('data-part', 'separator')
   })
+
+  it('should emit requestDismiss when the parent layer closes', async () => {
+    const onRequestDismiss = vi.fn()
+    const { rerender } = render(NestedComponentUnderTest, { props: { dialogOpen: true, onRequestDismiss } })
+    await user.click(screen.getByText('click me'))
+    await waitFor(() => expect(screen.getByText('Edit')).toBeVisible())
+
+    await rerender({ dialogOpen: false })
+    await waitFor(() => expect(onRequestDismiss).toHaveBeenCalledTimes(1))
+  })
 })
```

---

### Incident Patch 4: `cee13c74` (2026-09-27)
**Commit Message**: fix(vue): infer context item types and emit slot types in declarations (#4118)

* fix(vue): infer context item types and emit slot types in declarations

SelectContext, ListboxContext and TreeViewContext declare a generic item
type but take no props to infer it from, so the slot item resolved to
unknown inside generic wrappers. Default the parameter to the collection
item type.

Fourteen parts called defineSlots() untyped, which made vue-tsc emit a
reference to __VLS_Slots without declaring it in the published .d.ts.

Refs #4116

* chore: simplify changeset

**File**: `.changeset/vue-context-generic-defaults.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **Select, Listbox, TreeView**: Fix `Context` slot items typed as `unknown` inside generic wrapper components.
+- Fix `Cannot find name '__VLS_Slots'` type errors when `skipLibCheck` is disabled.
```

**File**: `packages/vue/src/components/angle-slider/angle-slider-value-text.vue` (modified, +3/-1)
```diff
@@ -19,7 +19,9 @@ import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 
 defineProps<AngleSliderValueTextProps>()
 const angleSlider = useAngleSliderContext()
-const slots = defineSlots()
+const slots = defineSlots<{
+  default?(): unknown
+}>()
 
 useForwardExpose()
 </script>
```

**File**: `packages/vue/src/components/color-picker/color-picker-channel-slider-value-text.vue` (modified, +3/-1)
```diff
@@ -22,7 +22,9 @@ import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 defineProps<ColorPickerChannelSliderValueTextProps>()
 const colorPicker = useColorPickerContext()
 const channelProps = useColorPickerChannelPropsContext()
-const slots = defineSlots()
+const slots = defineSlots<{
+  default?(): unknown
+}>()
 const localeContext = useLocaleContext(DEFAULT_LOCALE)
 
 useForwardExpose()
```

**File**: `packages/vue/src/components/color-picker/color-picker-value-text.vue` (modified, +3/-1)
```diff
@@ -22,7 +22,9 @@ import { useColorPickerContext } from './use-color-picker-context.ts'
 
 const props = defineProps<ColorPickerValueTextProps>()
 const colorPicker = useColorPickerContext()
-const slots = defineSlots()
+const slots = defineSlots<{
+  default?(): unknown
+}>()
 
 useForwardExpose()
 
```

**File**: `packages/vue/src/components/file-upload/file-upload-item-name.vue` (modified, +3/-1)
```diff
@@ -21,7 +21,9 @@ import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 defineProps<FileUploadItemNameProps>()
 const fileUpload = useFileUploadContext()
 const itemProps = useFileUploadItemPropsContext()
-const slots = defineSlots()
+const slots = defineSlots<{
+  default?(): unknown
+}>()
 
 useForwardExpose()
 </script>
```

---

### Incident Patch 5: `d0337ebc` (2026-09-24)
**Commit Message**: fix(vue): forward aria-label props that Vue camelizes (#4113)

Vue normalizes declared props to camelCase, so aria-label on
AngleSlider.Root reached the hook as ariaLabel. Zag reads
prop("aria-label"), so the label was dropped and the thumb had no
accessible name. cleanProps now restores aria* keys to their hyphenated
form, which fixes AngleSlider, Slider, Dialog, Menu, and Tooltip.

Closes #4111

**File**: `.changeset/vue-aria-label-props.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+Fix `aria-label` and `aria-labelledby` being ignored on `AngleSlider.Root`, `Slider.Root`, `Dialog.Root`, `Menu.Root`,
+and `Tooltip.Root`. For example, `<AngleSlider.Root aria-label="Rotation">` now names the thumb.
```

**File**: `packages/vue/src/components/angle-slider/tests/angle-slider-aria-label.test.vue` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+<script setup lang="ts">
+import { AngleSlider } from '@ark-ui/vue/angle-slider'
+</script>
+
+<template>
+  <AngleSlider.Root aria-label="Rotation">
+    <AngleSlider.Control>
+      <AngleSlider.Thumb />
+    </AngleSlider.Control>
+  </AngleSlider.Root>
+</template>
```

**File**: `packages/vue/src/components/angle-slider/tests/angle-slider.test.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import { render, screen } from '@testing-library/vue'
+import AriaLabelComponentUnderTest from './angle-slider-aria-label.test.vue'
+
+describe('AngleSlider', () => {
+  it('should name the thumb with the root aria-label', () => {
+    render(AriaLabelComponentUnderTest)
+
+    expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Rotation')
+  })
+})
```

**File**: `packages/vue/src/utils/clean-props.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { cleanProps } from './clean-props.ts'
+
+describe('Util: cleanProps', () => {
+  it('should drop undefined values', () => {
+    expect(cleanProps({ a: 1, b: undefined })).toEqual({ a: 1 })
+  })
+
+  it('should restore aria props that Vue camelized', () => {
+    expect(cleanProps({ ariaLabel: 'Rotation', ariaLabelledby: 'label-id' })).toEqual({
+      'aria-label': 'Rotation',
+      'aria-labelledby': 'label-id',
+    })
+  })
+
+  it('should keep aria props that are already hyphenated', () => {
+    expect(cleanProps({ 'aria-label': 'Rotation' })).toEqual({ 'aria-label': 'Rotation' })
+  })
+})
```

**File**: `packages/vue/src/utils/clean-props.ts` (modified, +6/-1)
```diff
@@ -1,8 +1,13 @@
+const ARIA_PROP_REGEX = /^aria[A-Z]/
+
+const toAriaAttribute = (key: string) => `aria-${key.slice(4).toLowerCase()}`
+
 export const cleanProps = <T extends object>(obj: T): { [K in keyof T]: T[K] } => {
   const result: Partial<T> = {}
   for (const [key, value] of Object.entries(obj)) {
     if (value !== undefined) {
-      result[key as keyof T] = value
+      const resolvedKey = ARIA_PROP_REGEX.test(key) ? toAriaAttribute(key) : key
+      result[resolvedKey as keyof T] = value
     }
   }
   return result as { [K in keyof T]: T[K] }
```

---

### Incident Patch 6: `4c0dfeb0` (2026-09-24)
**Commit Message**: fix: let tour content and spotlight play their exit animations (#4112)

* fix(solid): keep tour content mounted during its exit animation

Tour.Content created its own presence while Tour.Positioner followed the
root presence from context. The root presence never received a node, so
it unmounted on close and took the positioner and content with it before
the content's exit animation could run. Content now uses the shared
presence, like the React, Vue, and Svelte adapters.

Closes #4049

* fix: let tour spotlight animate out

The spotlight set hidden from `!tour.open`, which hid it the moment the
tour closed and overrode the presence's hidden state. It now uses the
presence's hidden value, which stays false until the exit animation
ends, and still hides on steps without a target. Vue's spotlight also
binds its presence props so it gets data-state and a node ref.

* fix: export missing tour types

Re-export StepsChangeDetails, StepActionType, StepActionFn,
StepEffectCleanup, ElementIds, and IntlTranslations from the Tour
namespace, and add flat Tour* aliases for the step, action, and callback
detail types, matching how other components export theirs.

**File**: `.changeset/solid-tour-content-exit.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@ark-ui/solid': patch
+---
+
+Fix `Tour.Content` unmounting before its exit animation finishes when using `lazyMount` and `unmountOnExit`.
```

**File**: `.changeset/tour-spotlight-exit-react.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@ark-ui/react': patch
+---
+
+Fix `Tour.Spotlight` disappearing immediately when the tour closes, so its exit animation can run.
```

**File**: `.changeset/tour-spotlight-exit-solid.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@ark-ui/solid': patch
+---
+
+Fix `Tour.Spotlight` disappearing immediately when the tour closes, so its exit animation can run.
```

**File**: `.changeset/tour-spotlight-exit-svelte.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@ark-ui/svelte': patch
+---
+
+Fix `Tour.Spotlight` disappearing immediately when the tour closes, so its exit animation can run.
```

**File**: `.changeset/tour-spotlight-exit-vue.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+Fix `Tour.Spotlight` disappearing immediately when the tour closes, so its exit animation can run. It also now sets
+`data-state`.
```

---

### Incident Patch 7: `bbea09c3` (2026-09-24)
**Commit Message**: fix(vue): render the default slot in void-element parts with asChild (#4110)

Avatar.Image, ImageCropper.Image, Menu.Separator, and PasswordInput.Input
self-closed their ark element without a slot, so asChild had no child to
render and the part disappeared. They now pass the default slot through,
like the other input parts. The factory still drops it for void tags when
asChild is off.

Closes #4108

**File**: `.changeset/vue-as-child-void-parts.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+Fix `Avatar.Image`, `ImageCropper.Image`, `Menu.Separator`, and `PasswordInput.Input` rendering nothing when using
+`asChild`.
```

**File**: `packages/vue/src/components/avatar/avatar-image.vue` (modified, +3/-1)
```diff
@@ -24,5 +24,7 @@ useForwardExpose()
 </script>
 
 <template>
-  <ark.img v-bind="avatar.getImageProps()" :as-child="asChild" />
+  <ark.img v-bind="avatar.getImageProps()" :as-child="asChild">
+    <slot />
+  </ark.img>
 </template>
```

**File**: `packages/vue/src/components/avatar/tests/avatar-as-child.test.vue` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<script setup lang="ts">
+import { Avatar } from '@ark-ui/vue/avatar'
+</script>
+
+<template>
+  <Avatar.Root>
+    <Avatar.Fallback>PA</Avatar.Fallback>
+    <Avatar.Image as-child>
+      <img data-testid="image" src="https://i.pravatar.cc/300" alt="avatar" />
+    </Avatar.Image>
+  </Avatar.Root>
+</template>
```

**File**: `packages/vue/src/components/avatar/tests/avatar.test.ts` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+import { render, screen } from '@testing-library/vue'
+import AsChildComponentUnderTest from './avatar-as-child.test.vue'
+
+describe('Avatar', () => {
+  it('should render the slotted element when Image uses asChild', () => {
+    render(AsChildComponentUnderTest)
+
+    const image = screen.getByTestId('image')
+    expect(image).toHaveAttribute('data-scope', 'avatar')
+    expect(image).toHaveAttribute('data-part', 'image')
+    expect(image).toHaveAttribute('src', 'https://i.pravatar.cc/300')
+  })
+})
```

**File**: `packages/vue/src/components/image-cropper/image-cropper-image.vue` (modified, +3/-1)
```diff
@@ -24,5 +24,7 @@ useForwardExpose()
 </script>
 
 <template>
-  <ark.img v-bind="imageCropper.getImageProps()" :as-child="asChild" />
+  <ark.img v-bind="imageCropper.getImageProps()" :as-child="asChild">
+    <slot />
+  </ark.img>
 </template>
```

---

### Incident Patch 8: `00466d7a` (2026-09-24)
**Commit Message**: fix: update broken MCP Server link in README (#4107)

Closes #4106

**File**: `README.md` (modified, +1/-1)
```diff
@@ -299,7 +299,7 @@ Ark UI works seamlessly with:
 
 ### Developer Tools
 
-- **[MCP Server](https://github.com/chakra-ui/ark/tree/main/integrations/mcp)** - AI-assisted development with Claude
+- **[MCP Server](https://github.com/chakra-ui/ark/tree/main/packages/mcp)** - AI-assisted development with Claude
   and other AI agents
 
 ## Community
```

---

### Incident Patch 9: `e3a3ac8a` (2026-09-24)
**Commit Message**: fix(svelte): cancel pending portal mount on cleanup (#4109)

The portal defers mount to the next tick, but cleanup only removed an
instance that already existed. Unmounting before the tick resolved left
the children in the container. Each effect run now owns its instance and
a cancelled flag, so a pending mount is skipped once cleanup runs.

`container` is also read synchronously so the effect tracks it and moves
the content when the prop changes.

Closes #4098

**File**: `.changeset/svelte-portal-pending-mount.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/svelte': patch
+---
+
+- Fix `Portal` leaving its content in the DOM when unmounted immediately after mounting.
+- Fix `Portal` not moving its content when the `container` prop changes.
```

**File**: `packages/svelte/src/lib/components/portal/portal.svelte` (modified, +12/-13)
```diff
@@ -20,25 +20,24 @@
 
   const context = getAllContexts()
 
-  let instance: any = null
   $effect(() => {
-    const cleanup = () => {
-      if (instance) {
-        void unmount(instance)
-        instance = null
-      }
-    }
+    if (disabled) return
 
-    if (disabled) {
-      cleanup()
-      return
-    }
+    const target = container
+    let cancelled = false
+    let instance: ReturnType<typeof mount> | null = null
 
     tick().then(() => {
-      instance = mount(children, { target: container, context })
+      if (cancelled) return
+      instance = mount(children, { target, context })
     })
+
     return () => {
-      cleanup()
+      cancelled = true
+      if (instance) {
+        void unmount(instance)
+        instance = null
+      }
     }
   })
 </script>
```

**File**: `packages/svelte/src/lib/components/portal/portal.test.ts` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+import { render, screen, waitFor } from '@testing-library/svelte'
+import { flushSync, tick } from 'svelte'
+import { describe, expect, it } from 'vitest'
+import PortalContainerFixture from './tests/portal-container-fixture.svelte'
+import PortalFixture from './tests/portal-fixture.svelte'
+
+describe('Portal', () => {
+  it('should render children into the container', async () => {
+    render(PortalFixture)
+    await waitFor(() => expect(screen.getByTestId('portal-content')).toBeInTheDocument())
+  })
+
+  it('should remove children on unmount', async () => {
+    const { unmount } = render(PortalFixture)
+    await waitFor(() => expect(screen.getByTestId('portal-content')).toBeInTheDocument())
+    unmount()
+    expect(screen.queryByTestId('portal-content')).not.toBeInTheDocument()
+  })
+
+  it('should not mount children when unmounted before the deferred mount resolves', async () => {
+    const { unmount } = render(PortalFixture)
+    unmount()
+    await tick()
+    await tick()
+    flushSync()
+    expect(screen.queryByTestId('portal-content')).not.toBeInTheDocument()
+  })
+
+  it('should move children when the container changes', async () => {
+    const a = document.body.appendChild(document.createElement('div'))
+    const b = document.body.appendChild(document.createElement('div'))
+    const { rerender } = render(PortalContainerFixture, { container: a })
+    await waitFor(() => expect(a).toContainElement(screen.getByTestId('portal-content')))
+
+    await rerender({ container: b })
+    await waitFor(() => expect(b).toContainElement(screen.getByTestId('portal-content')))
+    expect(screen.getAllByTestId('portal-content')).toHaveLength(1)
+    a.remove()
+    b.remove()
+  })
+})
```

**File**: `packages/svelte/src/lib/components/portal/tests/portal-container-fixture.svelte` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<script lang="ts">
+  import { Portal } from '@ark-ui/svelte/portal'
+
+  let { container }: { container: HTMLElement } = $props()
+</script>
+
+<Portal {container}><span data-testid="portal-content">Portal content</span></Portal>
```

**File**: `packages/svelte/src/lib/components/portal/tests/portal-fixture.svelte` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+<script lang="ts">
+  import { Portal } from '@ark-ui/svelte/portal'
+</script>
+
+<Portal><span data-testid="portal-content">Portal content</span></Portal>
```

---

### Incident Patch 10: `b2386430` (2026-09-23)
**Commit Message**: fix: align the last six parts that diverge across adapters (#4094)

Closes the table in #4047. Each part's element is part of its contract, and
these six rendered a different one depending on the framework, so a stylesheet
or a selector written against one adapter did not hold on another.

Toggle.Indicator becomes a span on react, solid and svelte: Toggle.Root is a
button, whose content model is phrasing content only, so a div inside it was
invalid markup on three of the four adapters. AngleSlider.Marker and
AngleSlider.ValueText follow their Slider twins, Listbox.ItemText follows
select, combobox and tree-view, and Popover.Title becomes an h2 like
Dialog.Title, since the content is a labelled role="dialog". Svelte's
NumberInput.Scrubber becomes a div, the pointer-drag surface being a
root-level, role="presentation" block rather than a span.

knownDivergences in check-nodes.ts is now empty, so any new divergence fails
the check rather than joining a list.

**File**: `.changeset/element-parity-remaining-rows.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+'@ark-ui/react': patch
+'@ark-ui/solid': patch
+'@ark-ui/svelte': patch
+'@ark-ui/vue': patch
+---
+
+Align the last six parts that rendered a different element across adapters: `Toggle.Indicator`, `AngleSlider.Marker`,
+`AngleSlider.ValueText` and `Listbox.ItemText` render `span`, `Popover.Title` renders `h2`, and Svelte's
+`NumberInput.Scrubber` renders `div`.
```

**File**: `packages/react/src/components/angle-slider/angle-slider-marker.tsx` (modified, +3/-3)
```diff
@@ -9,17 +9,17 @@ import { type HTMLProps, type PolymorphicProps, ark } from '../factory.ts'
 import { useAngleSliderContext } from './use-angle-slider-context.ts'
 
 export interface AngleSliderMarkerBaseProps extends MarkerProps, PolymorphicProps {}
-export interface AngleSliderMarkerProps extends Assign<HTMLProps<'div'>, AngleSliderMarkerBaseProps> {}
+export interface AngleSliderMarkerProps extends Assign<HTMLProps<'span'>, AngleSliderMarkerBaseProps> {}
 
 const splitMarkerProps = createSplitProps<MarkerProps>()
 
-export const AngleSliderMarker = forwardRef<HTMLDivElement, AngleSliderMarkerProps>((props, ref) => {
+export const AngleSliderMarker = forwardRef<HTMLSpanElement, AngleSliderMarkerProps>((props, ref) => {
   const [markerProps, localProps] = splitMarkerProps(props, ['value'])
 
   const angleSlider = useAngleSliderContext()
   const mergedProps = mergeProps(angleSlider.getMarkerProps(markerProps), localProps)
 
-  return <ark.div {...mergedProps} ref={ref} />
+  return <ark.span {...mergedProps} ref={ref} />
 })
 
 AngleSliderMarker.displayName = 'AngleSliderMarker'
```

**File**: `packages/react/src/components/angle-slider/angle-slider-value-text.tsx` (modified, +4/-4)
```diff
@@ -5,14 +5,14 @@ import { type HTMLProps, type PolymorphicProps, ark } from '../factory.ts'
 import { useAngleSliderContext } from './use-angle-slider-context.ts'
 
 export interface AngleSliderValueTextBaseProps extends PolymorphicProps {}
-export interface AngleSliderValueTextProps extends HTMLProps<'div'>, AngleSliderValueTextBaseProps {}
+export interface AngleSliderValueTextProps extends HTMLProps<'span'>, AngleSliderValueTextBaseProps {}
 
-export const AngleSliderValueText = forwardRef<HTMLDivElement, AngleSliderValueTextProps>((props, ref) => {
+export const AngleSliderValueText = forwardRef<HTMLSpanElement, AngleSliderValueTextProps>((props, ref) => {
   const angleSlider = useAngleSliderContext()
   return (
-    <ark.div {...props} ref={ref}>
+    <ark.span {...props} ref={ref}>
       {props.children || angleSlider.valueAsDegree}
-    </ark.div>
+    </ark.span>
   )
 })
 
```

**File**: `packages/react/src/components/listbox/listbox-item-text.tsx` (modified, +3/-3)
```diff
@@ -7,14 +7,14 @@ import { useListboxContext } from './use-listbox-context.ts'
 import { useListboxItemPropsContext } from './use-listbox-item-props-context.ts'
 
 export interface ListboxItemTextBaseProps extends PolymorphicProps {}
-export interface ListboxItemTextProps extends HTMLProps<'div'>, ListboxItemTextBaseProps {}
+export interface ListboxItemTextProps extends HTMLProps<'span'>, ListboxItemTextBaseProps {}
 
-export const ListboxItemText = forwardRef<HTMLDivElement, ListboxItemTextProps>((props, ref) => {
+export const ListboxItemText = forwardRef<HTMLSpanElement, ListboxItemTextProps>((props, ref) => {
   const listbox = useListboxContext()
   const itemProps = useListboxItemPropsContext()
   const mergedProps = mergeProps(listbox.getItemTextProps(itemProps), props)
 
-  return <ark.div {...mergedProps} ref={ref} />
+  return <ark.span {...mergedProps} ref={ref} />
 })
 
 ListboxItemText.displayName = 'ListboxItemText'
```

**File**: `packages/react/src/components/popover/popover-title.tsx` (modified, +3/-3)
```diff
@@ -6,13 +6,13 @@ import { type HTMLProps, type PolymorphicProps, ark } from '../factory.ts'
 import { usePopoverContext } from './use-popover-context.ts'
 
 export interface PopoverTitleBaseProps extends PolymorphicProps {}
-export interface PopoverTitleProps extends HTMLProps<'div'>, PopoverTitleBaseProps {}
+export interface PopoverTitleProps extends HTMLProps<'h2'>, PopoverTitleBaseProps {}
 
-export const PopoverTitle = forwardRef<HTMLDivElement, PopoverTitleProps>((props, ref) => {
+export const PopoverTitle = forwardRef<HTMLHeadingElement, PopoverTitleProps>((props, ref) => {
   const popover = usePopoverContext()
   const mergedProps = mergeProps(popover.getTitleProps(), props)
 
-  return <ark.div {...mergedProps} ref={ref} />
+  return <ark.h2 {...mergedProps} ref={ref} />
 })
 
 PopoverTitle.displayName = 'PopoverTitle'
```

#### Recent Merged Pull Requests:
- **PR #4143** (2026-09-30): fix(website): trace runtime-read files into functions and 404 unknown examples (@Adebesin-Cell)
- **PR #4140** (2026-09-29): fix(react): give virtualizer hooks a new reference on each update (@Adebesin-Cell)
- **PR #4139** (2026-09-29): perf(website): enable cache components and partial prefetching (@Adebesin-Cell)
- **PR #4138** (2026-09-29): fix(website): land hash links on their heading and send each example's CSS once (@Adebesin-Cell)
- **PR #4137** (2026-09-29): perf(website): prefetch sidebar links on intent, lazy Copy Page markdown, React Compiler (@Adebesin-Cell)
- **PR #4136** (2026-09-29): perf(website): lazy-load each example instead of bundling all of them (@Adebesin-Cell)
- **PR #4135** (2026-09-29): fix(website): self-host broken showcase images and lazy-load the cards (@Adebesin-Cell)
- **PR #4134** (2026-09-29): fix(examples): observe the scroll element size in the virtualizer examples (@Adebesin-Cell)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
