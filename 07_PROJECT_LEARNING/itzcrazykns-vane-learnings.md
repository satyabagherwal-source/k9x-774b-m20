# Forensic Learning Record (Deep Inspection): ItzCrazyKns/Vane

> **Canonical Artifact**: `07_PROJECT_LEARNING/itzcrazykns-vane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:07:31.094Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ItzCrazyKns/Vane`
- **Description**: Vane is an AI-powered answering engine.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 36945 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.prettierrc.js`
```
/** @type {import("prettier").Config} */

const config = {
  printWidth: 80,
  trailingComma: 'all',
  endOfLine: 'auto',
  singleQuote: true,
  tabWidth: 2,
};

module.exports = config;

```

### Core Architecture Module: `drizzle.config.ts`
```
import path from 'path';

export default {
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: path.join(process.cwd(), 'data', 'db.sqlite'),
  },
};

```

### Core Architecture Module: `next-env.d.ts`
```
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import './.next/dev/types/routes.d.ts';

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.

```

### Core Architecture Module: `next.config.mjs`
```
import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: [
    'pdf-parse',
    'playwright',
    'officeparser',
    'file-type',
  ],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**',
    ],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

```

### Core Architecture Module: `postcss.config.js`
```
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `src/app/api/chat/route.ts`
```
import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import db from '@/lib/db';
import { eq } from 'drizzle-orm';
import { chats } from '@/lib/db/schema';
import UploadManager from '@/lib/uploads/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
}) => {
  try {
    const exists = await db.query.chats
      .findFirst({
        where: eq(chats.id, input.id),
      })
      .execute();

    if (!exists) {
      await db.insert(chats).values({
        id: input.id,
        createdAt: new Date().toISOString(),
        sources: input.sources,
        title: input.query,
        files: input.fileIds.map((id) => {
          return {
            fileId: id,
            name: UploadManager.getFile(id)?.name || 'Uploaded File',
          };
        }),
      });
    }
  } catch (err) {
    console.error('Failed to check/save chat:', err);
  }
};

export const POST = async (req: Request) => {
  try {
    const reqBody = (await req.json()) as Body;

    const parseBody = safeValidateBody(reqBody);

    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();

    const [llm, embedding] = await Promise.all([
      registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
      registry.loadEmbeddingModel(
        body.embeddingModel.providerId,
        body.embeddingModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return {
          role: 'user',
          content: msg[1],
        };
      } else {
        return {
          role: 'assistant',
          content: msg[1],
        };
      }
    });

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const disconnect = session.subscribe((event: string, data: any) => {
      if (event === 'data') {
        if (data.type === 'block') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'block',
                block: data.block,
              }) + '\n',
            ),
          );
        } else if (data.type === 'updateBlock') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'updateBlock',
                blockId: data.blockId,
                patch: data.patch,
              }) + '\n',
            ),
          );
        } else if (data.type === 'researchComplete') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'researchComplete',
              }) + '\n',
            ),
          );
        }
      } else if (event === 'end') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'messageEnd',
            }) + '\n',
          ),
        );
        writer.close();
        session.removeAllListeners();
      } else if (event === 'error') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'error',
              data: data.data,
            }) + '\n',
          ),
        );
        writer.close();
        session.removeAllListeners();
      }
    });

    agent.searchAsync(session, {
      chatHistory: history,
      followUp: message.content,
      chatId: body.message.chatId,
      messageId: body.message.messageId,
      config: {
        llm,
        embedding: embedding,
        sources: body.sources as SearchSources[],
        mode: body.optimizationMode,
        fileIds: body.files,
        systemInstructions: body.systemInstructions || 'None',
      },
    });

    ensureChatExists({
      id: body.message.chatId,
      sources: body.sources as SearchSources[],
      fileIds: body.files,
      query: body.message.content,
    });

    req.signal.addEventListener('abort', () => {
      disconnect();
      writer.close();
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};

```

### Core Architecture Module: `src/app/api/chats/[id]/route.ts`
```
import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, id),
    });

    return Response.json(
      {
        chat: chatExists,
        messages: chatMessages,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    await db.delete(chats).where(eq(chats.id, id)).execute();
    await db.delete(messages).where(eq(messages.chatId, id)).execute();

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

```

### Core Architecture Module: `src/app/api/chats/route.ts`
```
import db from '@/lib/db';

export const GET = async (req: Request) => {
  try {
    let chats = await db.query.chats.findMany();
    chats = chats.reverse();
    return Response.json({ chats: chats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1190** (2026-09-01): **[BUG] 0 search results - No results were found**
  *Symptoms*: search engines give 0 results... I tried different in the searXNG inside the full docker container. "No results were found. "  itzcrazykns1337/vane:latest vane  1.12.2 searXNG inside this docker container 2026.4.10+67af4894d  just installed the docker container today and tried to search, also verified not working over the searXNG gui inside the docker container.  My own searXNG docker container on my machine works, but this has version  2026.8.29+d226b78bc   I really wonder why is searXNG inside the vane container this old? could this be the reason?  Thanks for your support and work <3   Edit: I see it sadly just might be general searxng problems...

- **Issue #1127** (2026-08-27): **Trying to access nonexistant config.json**
  *Symptoms*: **Describe the bug** Starting up a new instance of Vane. getting the following error. ``` com.docker.swarm.node.id=... Error: An error occurred while loading instrumentation hook: ENOENT: no such file or directory, open '/app/backend/data/data/config.json' com.docker.swarm.node.id=...     at rH.initializeConfig (.next/server/chunks/68.js:48:58539) com.docker.swarm.node.id=...     at rH.initialize (.next/server/chunks/68.js:48:57886) com.docker.swarm.node.id=...     at new rH (.next/server/chunks/68.js:48:57855) com.docker.swarm.node.id=...     at 54687 (.next/server/chunks/68.js:48:61165) com.docker.swarm.node.id=...     at k (.next/server/webpack-runtime.js:1:159) com.docker.swarm.node.id=...     at async Module.d (.next/server/instrumentation.js:1:572) { com.docker.swarm.node.id=...   errno: -2, com.docker.swarm.node.id=...   code: 'ENOENT', com.docker.swarm.node.id=...   syscall: 'open', com.docker.swarm.node.id=...   path: '/app/backend/data/data/config.json' com.docker.swarm.node.id=... } ``` When trying to access the webpage from browser I get back 500 Internal Server error  **To Reproduce** Steps to reproduce the behavior:  1. Create new compose/stack (see example below 2. docker compose up  3. follow container logs  **Expected behavior** Container should first start normally, should be able to reach webpage  **Screenshots** If applicable, add screenshots to help explain your problem.  **Additional context** example compose ``` ---   services:     vane:       image: it
  **Post-Mortem & Fix Analysis**:
  > Think I found the issue. had DATA_DIR set for openwebui in same stack. Think it was picking that up.

- **Issue #1112** (2026-04-15): **Search is broken**
  *Symptoms*: **Describe the bug** All searches now produce 0 results using SearXNG (full fat Vane, not slim Vane). All providers return errors.  **To Reproduce** Test query: do a test search on the latest Starlink info  **Additional context** Log attached.  [Vane_log.txt](https://github.com/user-attachments/files/26748227/Vane_log.txt)
  **Post-Mortem & Fix Analysis**:
  > Issue resolved by closing/reopening browser & restarting container. 

- **Issue #1101** (2026-04-11): **Playwright is missing from Dockerfile.slim**
  *Symptoms*: **Describe the bug**  The Dockerfile.slim file requires Playwright to be installed, just like the standard Dockerfile :   ``` Error scraping data from https://docs.olares.com/use-cases/perplexica.html Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell ╔════════════════════════════════════════════════════════════╗ ║ Looks like Playwright was just installed or updated.       ║ ║ Please run the following command to download new browsers: ║ ║                                                            ║ ║     npx playwright install                                 ║ ║                                                            ║ ║ <3 Playwright Team                                         ║ ╚════════════════════════════════════════════════════════════╝     at <unknown> (.next/server/chunks/641.js:645:683) ```  **Additional context** v1.12.2  Thanks
  **Post-Mortem & Fix Analysis**:
  > Closed by https://github.com/ItzCrazyKns/Vane/commit/adc68fc0502068e85b8b9796db8015c92a9da469

- **Issue #1075** (2026-03-26): **Client-side error: "t.searching.map is not a function" on self-hosted Vane (Windows + Docker)**
  *Symptoms*: ## Description  When I self-host Vane with Docker on Windows and run a web search, I frequently get this error in the browser:  > Application error: a client-side exception has occurred while loading localhost (see the browser console for more information).  The browser console always shows:  ```text 2415-19b4fa5968a788ca.js:25 Uncaught TypeError: t.searching.map is not a function     at 2415-19b4fa5968a788ca.js:25:17315     at Array.map (<anonymous>)     at es (2415-19b4fa5968a788ca.js:25:14918)     at ak (4bd1b696-6b5c0c72b0eadc5f.js:1:53104)     at o0 (4bd1b696-6b5c0c72b0eadc5f.js:1:73556)     at is (4bd1b696-6b5c0c72b0eadc5f.js:1:84988)     at sp (4bd1b696-6b5c0c72b0eadc5f.js:1:128009)     at 4bd1b696-6b5c0c72b0eadc5f.js:1:127854     at sd (4bd1b696-6b5c0c72b0eadc5f.js:1:127862)     at sn (4bd1b696-6b5c0c72b0eadc5f.js:1:123787)  It looks like searching / queries is sometimes not an array, but the code assumes it is and calls .map() on it.  Environment Vane version: itzcrazykns1337/vane:latest (pulled on 2026‑03‑21)  Deployment: Docker on Windows 11 (Docker Desktop, default settings)  Container name: vane  Ports:  3000:3000 (Vane)  Browser: Chrome / Edge (same behaviour)  SearXNG: bundled with the vane:latest image, working fine on its own  SearXNG + Brave Search API are working correctly:  I configured braveapi in /etc/searxng/settings.yml with my Brave Web Search API key.  Testing directly in SearXNG UI with KF-21 returns results.  Brave dashboard shows the API usage inc

- **Issue #1066** (2026-03-26): **Cannot get gpt-oss-20b to work with Vane**
  *Symptoms*: **Describe the bug** I have tried to use gpt-oss-20b served by llama.cpp as a model for Vane and have not been able to make it work, it is always stuck in the first "Brainstorming" phase and does not get to the point of making searches or writing an answer. Inspecting llama-server logs shows a few "error 500" messages that do not appear when using other models, after the third or so 500 error any process on the prompt stops.   Here is one of the errors: `[47735] srv operator(): got exception: {"error":{"code":500,"message":"Failed to parse input at pos 1246: <|start|>assistant<|channel|>final <|constrain|>json<|message|>{\"classification\":{\"skipSearch\":false,\"personalSearch\":false,\"academicSearch\":false,\"discussionSearch\":false,\"showWeatherWidget\":false,\"showStockWidget\":false,\"showCalculationWidget\":false},\"standaloneFollowUp\":\"What is the capital of France?\"}","type":"server_error"}}`  **To Reproduce** Set up llama.cpp's llama-server to serve gpt-oss-20b (unsloth, bartowski or ggml-org quants doesn't matter), then set up Vane to use this model. Submit a prompt in Vane, it should not get beyond the Brainstorming phase. For reference, here is my llama-server command: `llama-server -hf unsloth/gpt-oss-20b-GGUF:F16 --jinja --ctx-size 32768 --temp 1.0 --top-p 1.0 --top-k 0`  **Expected behavior** The model is making web searches and successfully answers the prompt, like other models (Qwen 3.5 series, Ministral 3 series) do.  **Additional context**   - The issu
  **Post-Mortem & Fix Analysis**:
  > Looks like its an issue on Llama CPP's side, it is failing to parse the JSON response. GPT OSS had a lot of issues following the template and hence the inference engines fail to parse the output, please try using another model or file an issue with Llama CPP.

- **Issue #1064** (2026-03-27): **unable to upload pdf file**
  *Symptoms*: unable to upload pdf file, it just spins.   expected should be to ingest  the file and be able to search the content.  <img width="1065" height="655" alt="Image" src="https://github.com/user-attachments/assets/2879336a-fca4-4f2b-b967-dbd2d01201a0" />  Environment - vane running on docker - using wsl container on windows 11  Ollama using qwen3.5:4b model on RTX 4060

- **Issue #1012** (2026-03-10): **can't save settings with new models... claude found a bug**
  *Symptoms*: <img width="1105" height="486" alt="Image" src="https://github.com/user-attachments/assets/d192cf2a-5ab9-4af4-ac9d-cc57f94ac1c5" />
  **Post-Mortem & Fix Analysis**:
  > Hello, the cross button is there to delete any additional models that the user has added. We don't allow using it to delete default models (that are returned by the provider's model list) so this is intended.

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

### Incident Patch 1: `97c0ad59` (2026-04-10)
**Commit Message**: Merge pull request #1097 from lawrence3699/fix/weather-switch-fallthrough

fix: add missing break statements in weather code switch

**File**: `src/app/api/weather/route.ts` (modified, +32/-0)
```diff
@@ -62,57 +62,79 @@ export const POST = async (req: Request) => {
         break;
 
       case 1:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Mainly Clear';
+        break;
       case 2:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Partly Cloudy';
+        break;
       case 3:
         weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Cloudy';
         break;
 
       case 45:
+        weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
+        break;
       case 48:
         weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
         break;
 
       case 51:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Light Drizzle';
+        break;
       case 53:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Moderate Drizzle';
+        break;
       case 55:
         weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Dense Drizzle';
         break;
 
       case 56:
+        weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Light Freezing Drizzle';
+        break;
       case 57:
         weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Dense Freezing Drizzle';
         break;
 
       case 61:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Slight Rain';
+        break;
       case 63:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Moderate Rain';
+        break;
       case 65:
         weather.condition = 'Heavy Rain';
         weather.icon = `rainy-2-${dayOrNight}`;
         break;
 
       case 66:
+        weather.icon = 'rain-and-sleet-mix';
         weather.condition = 'Light Freezing Rain';
+        break;
       case 67:
         weather.condition = 'Heavy Freezing Rain';
         weather.icon = 'rain-and-sleet-mix';
         break;
 
       case 71:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Slight Snow Fall';
+        break;
       case 73:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Moderate Snow Fall';
+        break;
       case 75:
         weather.condition = 'Heavy Snow Fall';
         weather.icon = `snowy-2-${dayOrNight}`;
@@ -124,18 +146,26 @@ export const POST = async (req: Request) => {
         break;
 
       case 80:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Slight Rain Showers';
+        break;
       case 81:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Moderate Rain Showers';
+        break;
       case 82:
         weather.condition = 'Heavy Rain Showers';
         weather.icon = `rainy-3-${dayOrNight}`;
         break;
 
       case 85:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Slight Snow Showers';
+        break;
       case 86:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Moderate Snow Showers';
+        break;
       case 87:
         weather.condition = 'Heavy Snow Showers';
         weather.icon = `snowy-3-${dayOrNight}`;
@@ -147,7 +177,9 @@ export const POST = async (req: Request) => {
         break;
 
       case 96:
+        weather.icon = 'severe-thunderstorm';
         weather.condition = 'Thunderstorm with Slight Hail';
+        break;
       case 99:
         weather.condition = 'Thunderstorm with Heavy Hail';
         weather.icon = 'severe-thunderstorm';
```

---

### Incident Patch 2: `e0aac65e` (2026-04-09)
**Commit Message**: fix: add missing break statements in weather code switch

WMO weather codes 1, 2, 45, 51, 53, 56, 61, 63, 66, 71, 73, 80, 81,
85, 86, and 96 were missing break statements, causing fall-through
that overwrote each condition with the last label in its group. For
example, code 1 (Mainly Clear) fell through to code 3, so the widget
always displayed 'Cloudy'. Also adds the shared group icon to each
early case so the widget renders an icon for every code.

**File**: `src/app/api/weather/route.ts` (modified, +32/-0)
```diff
@@ -62,57 +62,79 @@ export const POST = async (req: Request) => {
         break;
 
       case 1:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Mainly Clear';
+        break;
       case 2:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Partly Cloudy';
+        break;
       case 3:
         weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Cloudy';
         break;
 
       case 45:
+        weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
+        break;
       case 48:
         weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
         break;
 
       case 51:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Light Drizzle';
+        break;
       case 53:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Moderate Drizzle';
+        break;
       case 55:
         weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Dense Drizzle';
         break;
 
       case 56:
+        weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Light Freezing Drizzle';
+        break;
       case 57:
         weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Dense Freezing Drizzle';
         break;
 
       case 61:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Slight Rain';
+        break;
       case 63:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Moderate Rain';
+        break;
       case 65:
         weather.condition = 'Heavy Rain';
         weather.icon = `rainy-2-${dayOrNight}`;
         break;
 
       case 66:
+        weather.icon = 'rain-and-sleet-mix';
         weather.condition = 'Light Freezing Rain';
+        break;
       case 67:
         weather.condition = 'Heavy Freezing Rain';
         weather.icon = 'rain-and-sleet-mix';
         break;
 
       case 71:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Slight Snow Fall';
+        break;
       case 73:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Moderate Snow Fall';
+        break;
       case 75:
         weather.condition = 'Heavy Snow Fall';
         weather.icon = `snowy-2-${dayOrNight}`;
@@ -124,18 +146,26 @@ export const POST = async (req: Request) => {
         break;
 
       case 80:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Slight Rain Showers';
+        break;
       case 81:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Moderate Rain Showers';
+        break;
       case 82:
         weather.condition = 'Heavy Rain Showers';
         weather.icon = `rainy-3-${dayOrNight}`;
         break;
 
       case 85:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Slight Snow Showers';
+        break;
       case 86:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Moderate Snow Showers';
+        break;
       case 87:
         weather.condition = 'Heavy Snow Showers';
         weather.icon = `snowy-3-${dayOrNight}`;
@@ -147,7 +177,9 @@ export const POST = async (req: Request) => {
         break;
 
       case 96:
+        weather.icon = 'severe-thunderstorm';
         weather.condition = 'Thunderstorm with Slight Hail';
+        break;
       case 99:
         weather.condition = 'Thunderstorm with Heavy Hail';
         weather.icon = 'severe-thunderstorm';
```

---

### Incident Patch 3: `a889fdc3` (2026-04-08)
**Commit Message**: feat(app): fix build issues

**File**: `src/components/MessageRenderer/CodeBlock/index.tsx` (modified, +5/-2)
```diff
@@ -7,6 +7,9 @@ import SyntaxHighlighter from 'react-syntax-highlighter';
 import darkTheme from './CodeBlockDarkTheme';
 import lightTheme from './CodeBlockLightTheme';
 
+const SyntaxHighlighterComponent =
+  SyntaxHighlighter as unknown as React.ComponentType<any>;
+
 const CodeBlock = ({
   language,
   children,
@@ -50,13 +53,13 @@ const CodeBlock = ({
           />
         )}
       </button>
-      <SyntaxHighlighter
+      <SyntaxHighlighterComponent
         language={language}
         style={syntaxTheme}
         showInlineLineNumbers
       >
         {children as string}
-      </SyntaxHighlighter>
+      </SyntaxHighlighterComponent>
     </div>
   );
 };
```

---

### Incident Patch 4: `0e336419` (2026-03-26)
**Commit Message**: fix: handle upload errors and reset spinner state

**File**: `src/components/MessageInputActions/Attach.tsx` (modified, +47/-18)
```diff
@@ -18,6 +18,7 @@ import { Fragment, useRef, useState } from 'react';
 import { useChat } from '@/lib/hooks/useChat';
 import { AnimatePresence } from 'motion/react';
 import { motion } from 'framer-motion';
+import { toast } from 'sonner';
 
 const Attach = () => {
   const { files, setFiles, setFileIds, fileIds } = useChat();
@@ -26,31 +27,59 @@ const Attach = () => {
   const fileInputRef = useRef<any>();
 
   const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
-    setLoading(true);
-    const data = new FormData();
+    const selectedFiles = e.target.files;
 
-    for (let i = 0; i < e.target.files!.length; i++) {
-      data.append('files', e.target.files![i]);
+    if (!selectedFiles?.length) {
+      return;
     }
 
-    const embeddingModelProvider = localStorage.getItem(
-      'embeddingModelProviderId',
-    );
-    const embeddingModel = localStorage.getItem('embeddingModelKey');
+    setLoading(true);
+
+    try {
+      const data = new FormData();
+
+      for (let i = 0; i < selectedFiles.length; i++) {
+        data.append('files', selectedFiles[i]);
+      }
+
+      const embeddingModelProvider = localStorage.getItem(
+        'embeddingModelProviderId',
+      );
+      const embeddingModel = localStorage.getItem('embeddingModelKey');
 
-    data.append('embedding_model_provider_id', embeddingModelProvider!);
-    data.append('embedding_model_key', embeddingModel!);
+      if (!embeddingModelProvider || !embeddingModel) {
+        throw new Error('Please select an embedding model before uploading.');
+      }
 
-    const res = await fetch(`/api/uploads`, {
-      method: 'POST',
-      body: data,
-    });
+      data.append('embedding_model_provider_id', embeddingModelProvider);
+      data.append('embedding_model_key', embeddingModel);
 
-    const resData = await res.json();
+      const res = await fetch(`/api/uploads`, {
+        method: 'POST',
+        body: data,
+      });
 
-    setFiles([...files, ...resData.files]);
-    setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
-    setLoading(false);
+      const resData = await res.json().catch(() => ({}));
+
+      if (!res.ok) {
+        throw new Error(resData.message || 'Failed to upload file(s).');
+      }
+
+      if (!Array.isArray(resData.files)) {
+        throw new Error('Invalid upload response from server.');
+      }
+
+      setFiles([...files, ...resData.files]);
+      setFileIds([
+        ...fileIds,
+        ...resData.files.map((file: any) => file.fileId),
+      ]);
+    } catch (err: any) {
+      toast(err?.message || 'Failed to upload file(s).');
+    } finally {
+      setLoading(false);
+      e.target.value = '';
+    }
   };
 
   return loading ? (
```

**File**: `src/components/MessageInputActions/AttachSmall.tsx` (modified, +47/-18)
```diff
@@ -9,6 +9,7 @@ import { Fragment, useRef, useState } from 'react';
 import { useChat } from '@/lib/hooks/useChat';
 import { AnimatePresence } from 'motion/react';
 import { motion } from 'framer-motion';
+import { toast } from 'sonner';
 
 const AttachSmall = () => {
   const { files, setFiles, setFileIds, fileIds } = useChat();
@@ -17,31 +18,59 @@ const AttachSmall = () => {
   const fileInputRef = useRef<any>();
 
   const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
-    setLoading(true);
-    const data = new FormData();
+    const selectedFiles = e.target.files;
 
-    for (let i = 0; i < e.target.files!.length; i++) {
-      data.append('files', e.target.files![i]);
+    if (!selectedFiles?.length) {
+      return;
     }
 
-    const embeddingModelProvider = localStorage.getItem(
-      'embeddingModelProviderId',
-    );
-    const embeddingModel = localStorage.getItem('embeddingModelKey');
+    setLoading(true);
+
+    try {
+      const data = new FormData();
+
+      for (let i = 0; i < selectedFiles.length; i++) {
+        data.append('files', selectedFiles[i]);
+      }
+
+      const embeddingModelProvider = localStorage.getItem(
+        'embeddingModelProviderId',
+      );
+      const embeddingModel = localStorage.getItem('embeddingModelKey');
 
-    data.append('embedding_model_provider_id', embeddingModelProvider!);
-    data.append('embedding_model_key', embeddingModel!);
+      if (!embeddingModelProvider || !embeddingModel) {
+        throw new Error('Please select an embedding model before uploading.');
+      }
 
-    const res = await fetch(`/api/uploads`, {
-      method: 'POST',
-      body: data,
-    });
+      data.append('embedding_model_provider_id', embeddingModelProvider);
+      data.append('embedding_model_key', embeddingModel);
 
-    const resData = await res.json();
+      const res = await fetch(`/api/uploads`, {
+        method: 'POST',
+        body: data,
+      });
 
-    setFiles([...files, ...resData.files]);
-    setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
-    setLoading(false);
+      const resData = await res.json().catch(() => ({}));
+
+      if (!res.ok) {
+        throw new Error(resData.message || 'Failed to upload file(s).');
+      }
+
+      if (!Array.isArray(resData.files)) {
+        throw new Error('Invalid upload response from server.');
+      }
+
+      setFiles([...files, ...resData.files]);
+      setFileIds([
+        ...fileIds,
+        ...resData.files.map((file: any) => file.fileId),
+      ]);
+    } catch (err: any) {
+      toast(err?.message || 'Failed to upload file(s).');
+    } finally {
+      setLoading(false);
+      e.target.value = '';
+    }
   };
 
   return loading ? (
```

---

### Incident Patch 5: `3fede054` (2026-03-26)
**Commit Message**: Merge pull request #1076 from saschabuehrle/fix/issue-1075

fix: guard against non-array searching queries in research steps

**File**: `src/components/AssistantSteps.tsx` (modified, +3/-1)
```diff
@@ -37,7 +37,8 @@ const getStepTitle = (
   if (step.type === 'reasoning') {
     return isStreaming && !step.reasoning ? 'Thinking...' : 'Thinking';
   } else if (step.type === 'searching') {
-    return `Searching ${step.searching.length} ${step.searching.length === 1 ? 'query' : 'queries'}`;
+    const queries = Array.isArray(step.searching) ? step.searching : [];
+    return `Searching ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`;
   } else if (step.type === 'search_results') {
     return `Found ${step.reading.length} ${step.reading.length === 1 ? 'result' : 'results'}`;
   } else if (step.type === 'reading') {
@@ -160,6 +161,7 @@ const AssistantSteps = ({
                       )}
 
                       {step.type === 'searching' &&
+                        Array.isArray(step.searching) &&
                         step.searching.length > 0 && (
                           <div className="flex flex-wrap gap-1.5 mt-1.5">
                             {step.searching.map((query, idx) => (
```

**File**: `src/lib/agents/search/researcher/actions/academicSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const academicSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.academicSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/socialSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const socialSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.discussionSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/webSearch.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ const webSearchAction: ResearchAction<typeof actionSchema> = {
     config.sources.includes('web') &&
     config.classification.classification.skipSearch === false,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

---

### Incident Patch 6: `21bd8878` (2026-03-22)
**Commit Message**: fix: guard against non-array searching queries in research steps (fixes #1075)

**File**: `src/components/AssistantSteps.tsx` (modified, +3/-1)
```diff
@@ -37,7 +37,8 @@ const getStepTitle = (
   if (step.type === 'reasoning') {
     return isStreaming && !step.reasoning ? 'Thinking...' : 'Thinking';
   } else if (step.type === 'searching') {
-    return `Searching ${step.searching.length} ${step.searching.length === 1 ? 'query' : 'queries'}`;
+    const queries = Array.isArray(step.searching) ? step.searching : [];
+    return `Searching ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`;
   } else if (step.type === 'search_results') {
     return `Found ${step.reading.length} ${step.reading.length === 1 ? 'result' : 'results'}`;
   } else if (step.type === 'reading') {
@@ -160,6 +161,7 @@ const AssistantSteps = ({
                       )}
 
                       {step.type === 'searching' &&
+                        Array.isArray(step.searching) &&
                         step.searching.length > 0 && (
                           <div className="flex flex-wrap gap-1.5 mt-1.5">
                             {step.searching.map((query, idx) => (
```

**File**: `src/lib/agents/search/researcher/actions/academicSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const academicSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.academicSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/socialSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const socialSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.discussionSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/webSearch.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ const webSearchAction: ResearchAction<typeof actionSchema> = {
     config.sources.includes('web') &&
     config.classification.classification.skipSearch === false,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

---

### Incident Patch 7: `b02f5aa3` (2026-03-10)
**Commit Message**: Merge pull request #1015 from joaquinescalante23/fix/search-resilience-and-timeouts

feat: improve search resilience with timeouts and widget error handling

**File**: `src/lib/agents/search/api.ts` (modified, +3/-0)
```diff
@@ -19,6 +19,9 @@ class APISearchAgent {
       chatHistory: input.chatHistory,
       followUp: input.followUp,
       llm: input.config.llm,
+    }).catch((err) => {
+      console.error(`Error executing widgets: ${err}`);
+      return [];
     });
 
     let searchPromise: Promise<ResearcherOutput> | null = null;
```

**File**: `src/lib/searxng.ts` (modified, +24/-5)
```diff
@@ -38,11 +38,30 @@ export const searchSearxng = async (
     });
   }
 
-  const res = await fetch(url);
-  const data = await res.json();
+  const controller = new AbortController();
+  const timeoutId = setTimeout(() => controller.abort(), 10000);
 
-  const results: SearxngSearchResult[] = data.results;
-  const suggestions: string[] = data.suggestions;
+  try {
+    const res = await fetch(url, {
+      signal: controller.signal,
+    });
+
+    if (!res.ok) {
+      throw new Error(`SearXNG error: ${res.statusText}`);
+    }
+
+    const data = await res.json();
 
-  return { results, suggestions };
+    const results: SearxngSearchResult[] = data.results;
+    const suggestions: string[] = data.suggestions;
+
+    return { results, suggestions };
+  } catch (err: any) {
+    if (err.name === 'AbortError') {
+      throw new Error('SearXNG search timed out');
+    }
+    throw err;
+  } finally {
+    clearTimeout(timeoutId);
+  }
 };
```

---

### Incident Patch 8: `7ab23d63` (2026-03-09)
**Commit Message**: feat(setup-screen): fix spacing

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ RUN git clone "https://github.com/searxng/searxng" \
                    "/usr/local/searxng/searxng-src"
 
 RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
-RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec
+RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec typing_extensions
 RUN cd "/usr/local/searxng/searxng-src" && \
     "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .
 
```

**File**: `src/components/Setup/SetupWizard.tsx` (modified, +2/-2)
```diff
@@ -46,7 +46,7 @@ const SetupWizard = ({
                 animate={{ opacity: 1, translateY: '0px' }}
                 className="text-4xl md:text-6xl xl:text-8xl font-normal font-['Instrument_Serif'] tracking-tight"
               >
-                Welcome to{' '}
+                Welcome to
                 <span className="text-[#24A0ED] italic font-['PP_Editorial']">
                   Vane
                 </span>
@@ -91,7 +91,7 @@ const SetupWizard = ({
                   }}
                   className="text-2xl md:text-4xl xl:text-6xl font-normal font-['Instrument_Serif'] tracking-tight"
                 >
-                  Let us get{' '}
+                  Let us get
                   <span className="text-[#24A0ED] italic font-['PP_Editorial']">
                     Vane
                   </span>{' '}
```

---

### Incident Patch 9: `80d4f237` (2026-03-08)
**Commit Message**: fix: add typing_extensions to Dockerfile to resolve build error

Add typing_extensions to the list of installed packages.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ RUN git clone "https://github.com/searxng/searxng" \
                    "/usr/local/searxng/searxng-src"
 
 RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
-RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec
+RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec typing_extensions
 RUN cd "/usr/local/searxng/searxng-src" && \
     "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .
 
```

---

### Incident Patch 10: `a691f3ba` (2025-12-27)
**Commit Message**: feat(chat-hook): fix history saving delay (async state), add delay before media search to allow component refresh

**File**: `src/lib/hooks/useChat.tsx` (modified, +53/-33)
```diff
@@ -175,7 +175,7 @@ const loadMessages = async (
   chatId: string,
   setMessages: (messages: Message[]) => void,
   setIsMessagesLoaded: (loaded: boolean) => void,
-  setChatHistory: (history: [string, string][]) => void,
+  chatHistory: React.MutableRefObject<[string, string][]>,
   setSources: (sources: string[]) => void,
   setNotFound: (notFound: boolean) => void,
   setFiles: (files: File[]) => void,
@@ -233,7 +233,7 @@ const loadMessages = async (
   setFiles(files);
   setFileIds(files.map((file: File) => file.fileId));
 
-  setChatHistory(history);
+  chatHistory.current = history;
   setSources(data.chat.sources);
   setIsMessagesLoaded(true);
 };
@@ -281,7 +281,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
 
   const [researchEnded, setResearchEnded] = useState(false);
 
-  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
+  const chatHistory = useRef<[string, string][]>([]);
   const [messages, setMessages] = useState<Message[]>([]);
 
   const [files, setFiles] = useState<File[]>([]);
@@ -402,7 +402,12 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
     });
   }, [messages]);
 
+  const isReconnectingRef = useRef(false);
+  const handledMessageEndRef = useRef<Set<string>>(new Set());
+
   const checkReconnect = async () => {
+    if (isReconnectingRef.current) return;
+
     setIsReady(true);
     console.debug(new Date(), 'app:ready');
 
@@ -414,6 +419,8 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
         setResearchEnded(false);
         setMessageAppeared(false);
 
+        isReconnectingRef.current = true;
+
         const res = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
           method: 'POST',
         });
@@ -427,23 +434,27 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
 
         const messageHandler = getMessageHandler(lastMsg);
 
-        while (true) {
-          const { value, done } = await reader.read();
-          if (done) break;
+        try {
+          while (true) {
+            const { value, done } = await reader.read();
+            if (done) break;
 
-          partialChunk += decoder.decode(value, { stream: true });
+            partialChunk += decoder.decode(value, { stream: true });
 
-          try {
-            const messages = partialChunk.split('\n');
-            for (const msg of messages) {
-              if (!msg.trim()) continue;
-              const json = JSON.parse(msg);
-              messageHandler(json);
+            try {
+              const messages = partialChunk.split('\n');
+              for (const msg of messages) {
+                if (!msg.trim()) continue;
+                const json = JSON.parse(msg);
+                messageHandler(json);
+              }
+              partialChunk = '';
+            } catch (error) {
+              console.warn('Incomplete JSON, waiting for next chunk...');
             }
-            partialChunk = '';
-          } catch (error) {
-            console.warn('Incomplete JSON, waiting for next chunk...');
           }
+        } finally {
+          isReconnectingRef.current = false;
         }
       }
     }
@@ -463,7 +474,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
     if (params.chatId && params.chatId !== chatId) {
       setChatId(params.chatId);
       setMessages([]);
-      setChatHistory([]);
+      chatHistory.current = [];
       setFiles([]);
       setFileIds([]);
       setIsMessagesLoaded(false);
@@ -483,7 +494,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
         chatId,
         setMessages,
         setIsMessagesLoaded,
-        setChatHistory,
+        chatHistory,
         setSources,
         setNotFound,
         setFiles,
@@ -519,9 +530,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
 
     setMessages((prev)
```

#### Recent Merged Pull Requests:
- **PR #1191** (closed): fix(researcher): drop the narration pseudo-tool, lean no-search writer prompt (@epheo)
- **PR #1165** (closed): Add MiniMax provider support (@octo-patch)
- **PR #1157** (closed): feat(helm): add Helm chart for Kubernetes deployment (@wwagops)
- **PR #1156** (closed): feat: improve UI — copy buttons, follow-up styling, stop generation, OpenRouter fix (@DigitalBeer)
- **PR #1141** (closed): feat(priorart): clearance pipeline with Deep Research reframe + paten… (@OliveAcres)
- **PR #1129** (closed): Codex/stabilize provider runtime (@goshitsarch-eng)
- **PR #1118** (closed): fix: consolidate search pipeline robustness fixes (@reverb256)
- **PR #1097** (2026-04-10): fix: add missing break statements in weather code switch (@lawrence3699)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
