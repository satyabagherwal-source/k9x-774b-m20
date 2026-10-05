# Forensic Learning Record (Deep Inspection): u14app/deep-research

> **Canonical Artifact**: `07_PROJECT_LEARNING/u14app-deep-research-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/u14app/deep-research](https://github.com/u14app/deep-research))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:49:18.662Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `u14app/deep-research`
- **Description**: Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4691 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.mjs`
```
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;

```

### Core Architecture Module: `next.config.ts`
```
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import pkg from "./package.json";

const BUILD_MODE = process.env.NEXT_PUBLIC_BUILD_MODE;
// AI provider API base url
const API_PROXY_BASE_URL = process.env.API_PROXY_BASE_URL || "";
const GOOGLE_GENERATIVE_AI_API_BASE_URL =
  process.env.GOOGLE_GENERATIVE_AI_API_BASE_URL ||
  "https://generativelanguage.googleapis.com";
const OPENROUTER_API_BASE_URL =
  process.env.OPENROUTER_API_BASE_URL || "https://openrouter.ai/api";
const OPENAI_API_BASE_URL =
  process.env.OPENAI_API_BASE_URL || "https://api.openai.com";
const ANTHROPIC_API_BASE_URL =
  process.env.ANTHROPIC_API_BASE_URL || "https://api.anthropic.com";
const DEEPSEEK_API_BASE_URL =
  process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com";
const ATLASCLOUD_API_BASE_URL =
  process.env.ATLASCLOUD_API_BASE_URL || "https://api.atlascloud.ai";
const XAI_API_BASE_URL = process.env.XAI_API_BASE_URL || "https://api.x.ai";
const MISTRAL_API_BASE_URL =
  process.env.MISTRAL_API_BASE_URL || "https://api.mistral.ai";
const AZURE_API_BASE_URL = `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments`;
const GOOGLE_VERTEX_API_BASE_URL = `https://${process.env.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`;
const OPENAI_COMPATIBLE_API_BASE_URL =
  process.env.OPENAI_COMPATIBLE_API_BASE_URL || "";
const POLLINATIONS_API_BASE_URL =
  process.env.POLLINATIONS_API_BASE_URL ||
  "https://text.pollinations.ai/openai";
const OLLAMA_API_BASE_URL =
  process.env.OLLAMA_API_BASE_URL || "http://0.0.0.0:11434";
// Search provider API base url
const TAVILY_API_BASE_URL =
  process.env.TAVILY_API_BASE_URL || "https://api.tavily.com";
const FIRECRAWL_API_BASE_URL =
  process.env.FIRECRAWL_API_BASE_URL || "https://api.firecrawl.dev";
const CRW_API_BASE_URL =
  process.env.CRW_API_BASE_URL || "https://fastcrw.com/api";
const EXA_API_BASE_URL = process.env.EXA_API_BASE_URL || "https://api.exa.ai";
const BOCHA_API_BASE_URL =
  process.env.BOCHA_API_BASE_URL || "https://api.bochaai.com";
const BRAVE_API_BASE_URL =
  process.env.BRAVE_API_BASE_URL || "https://api.search.brave.com/res";
const SEARXNG_API_BASE_URL =
  process.env.SEARXNG_API_BASE_URL || "http://0.0.0.0:8080";

export default async function Config(phase: string) {
  const nextConfig: NextConfig = {
    /* config options here */
    experimental: {
      reactCompiler: true,
    },
    env: {
      NEXT_PUBLIC_VERSION: pkg.version,
    },
    transpilePackages: ["pdfjs-dist", "mermaid"],
  };

  if (BUILD_MODE === "export") {
    nextConfig.output = "export";
    // Only used for static deployment, the default deployment directory is the root directory
    nextConfig.basePath = "";
    // Statically exporting a Next.js application via `next export` disables API routes and middleware.
    nextConfig.webpack = (config) => {
      config.module.rules.push({
        test: /src\/app\/api/,
        loader: "ignore-loader",
      });
      config.module.rules.push({
        test: /src\/middleware/,
        loader: "ignore-loader",
      });
      return config;
    };
  } else if (BUILD_MODE === "standalone") {
    nextConfig.output = "standalone";
  } else {
    nextConfig.rewrites = async () => {
      return [
        {
          source: "/api/ai/google/:path*",
          destination: `${
            GOOGLE_GENERATIVE_AI_API_BASE_URL || API_PROXY_BASE_URL
          }/:path*`,
        },
        {
          source: "/api/ai/google-vertex/:path*",
          destination: `${GOOGLE_VERTEX_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/openrouter/:path*",
          destination: `${OPENROUTER_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/openai/:path*",
          destination: `${OPENAI_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/anthropic/:path*",
          destination: `${ANTHROPIC_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/deepseek/:path*",
          destination: `${DEEPSEEK_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/atlascloud/:path*",
          destination: `${ATLASCLOUD_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/xai/:path*",
          destination: `${XAI_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/mistral/:path*",
          destination: `${MISTRAL_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/azure/:path*",
          destination: `${AZURE_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/openaicompatible/:path*",
          destination: `${OPENAI_COMPATIBLE_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/pollinations/:path*",
          destination: `${POLLINATIONS_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/ai/ollama/:path*",
          destination: `${OLLAMA_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/tavily/:path*",
          destination: `${TAVILY_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/firecrawl/:path*",
          destination: `${FIRECRAWL_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/crw/:path*",
          destination: `${CRW_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/exa/:path*",
          destination: `${EXA_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/bocha/:path*",
          destination: `${BOCHA_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/brave/:path*",
          destination: `${BRAVE_API_BASE_URL}/:path*`,
        },
        {
          source: "/api/search/searxng/:path*",
          destination: `${SEARXNG_API_BASE_URL}/:path*`,
        },
      ];
    };
  }

  if (phase === PHASE_PRODUCTION_BUILD) {
    const withSerwist = withSerwistInit({
      // Note: This is only an example. If you use Pages Router,
      // use something else that works, such as "service-worker/index.ts".
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",
      register: false,
    });

    return withSerwist(nextConfig);
  }

  return nextConfig;
}

```

### Core Architecture Module: `postcss.config.mjs`
```
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;

```

### Core Architecture Module: `src/app/api/ai/anthropic/[...slug]/route.ts`
```
import { NextResponse, type NextRequest } from "next/server";
import { ANTHROPIC_BASE_URL } from "@/constants/urls";

export const runtime = "edge";
export const preferredRegion = [
  "cle1",
  "iad1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
  "hnd1",
  "kix1",
];

const API_PROXY_BASE_URL =
  process.env.ANTHROPIC_API_BASE_URL || ANTHROPIC_BASE_URL;

async function handler(req: NextRequest) {
  let body;
  if (req.method.toUpperCase() !== "GET") {
    body = await req.json();
  }
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.getAll("slug");
  searchParams.delete("slug");
  const params = searchParams.toString();

  try {
    let url = `${API_PROXY_BASE_URL}/${decodeURIComponent(path.join("/"))}`;
    if (params) url += `?${params}`;
    const payload: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        "x-api-key": req.headers.get("x-api-key") || "",
        "anthropic-version":
          req.headers.get("anthropic-version") || "2023-06-01",
      },
    };
    if (body) payload.body = JSON.stringify(body);
    const response = await fetch(url, payload);
    return new NextResponse(response.body, response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };

```

### Core Architecture Module: `src/app/api/ai/azure/[...slug]/route.ts`
```
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "edge";
export const preferredRegion = [
  "cle1",
  "iad1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
  "hnd1",
  "kix1",
];

const API_PROXY_BASE_URL = `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments`;
const API_VERSION = process.env.AZURE_API_VERSION || "";

async function handler(req: NextRequest) {
  let body;
  if (req.method.toUpperCase() !== "GET") {
    body = await req.json();
  }
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.getAll("slug");
  searchParams.delete("slug");
  if (API_VERSION) searchParams.append("api-version", API_VERSION);
  const params = searchParams.toString();

  try {
    if (API_PROXY_BASE_URL === "") {
      throw new Error("API base url is missing.");
    }
    let url = `${API_PROXY_BASE_URL}/${decodeURIComponent(path.join("/"))}`;
    if (params) url += `?${params}`;
    console.log(url);
    const payload: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        "api-key": req.headers.get("api-key") || "",
      },
    };
    if (body) payload.body = JSON.stringify(body);
    const response = await fetch(url, payload);
    return new NextResponse(response.body, response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };

```

### Core Architecture Module: `src/app/api/ai/deepseek/[...slug]/route.ts`
```
import { NextResponse, type NextRequest } from "next/server";
import { DEEPSEEK_BASE_URL } from "@/constants/urls";

export const runtime = "edge";
export const preferredRegion = [
  "cle1",
  "iad1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
  "hnd1",
  "kix1",
];

const API_PROXY_BASE_URL =
  process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_BASE_URL;

async function handler(req: NextRequest) {
  let body;
  if (req.method.toUpperCase() !== "GET") {
    body = await req.json();
  }
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.getAll("slug");
  searchParams.delete("slug");
  const params = searchParams.toString();

  try {
    let url = `${API_PROXY_BASE_URL}/${decodeURIComponent(path.join("/"))}`;
    if (params) url += `?${params}`;
    const payload: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        Authorization: req.headers.get("Authorization") || "",
      },
    };
    if (body) payload.body = JSON.stringify(body);
    const response = await fetch(url, payload);
    return new NextResponse(response.body, response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };

```

### Core Architecture Module: `src/app/api/ai/google-vertex/[...slug]/route.ts`
```
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "edge";
export const preferredRegion = [
  "cle1",
  "iad1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
  "hnd1",
  "kix1",
];

const API_PROXY_BASE_URL = `https://${process.env.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`;

async function handler(req: NextRequest) {
  let body;
  if (req.method.toUpperCase() !== "GET") {
    body = await req.json();
  }
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.getAll("slug");
  searchParams.delete("slug");
  const params = searchParams.toString();

  try {
    let url = `${API_PROXY_BASE_URL}/${decodeURIComponent(path.join("/"))}`;
    if (params) url += `?${params}`;
    const payload: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        Authorization: req.headers.get("Authorization") || "",
      },
    };
    if (body) payload.body = JSON.stringify(body);
    const response = await fetch(url, payload);
    return new NextResponse(response.body, response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };

```

### Core Architecture Module: `src/app/api/ai/google/[...slug]/route.ts`
```
import { NextResponse, type NextRequest } from "next/server";
import { GEMINI_BASE_URL } from "@/constants/urls";

export const runtime = "edge";
export const preferredRegion = [
  "cle1",
  "iad1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
  "hnd1",
  "kix1",
];

const API_PROXY_BASE_URL =
  process.env.API_PROXY_BASE_URL ||
  process.env.GOOGLE_GENERATIVE_AI_API_BASE_URL ||
  GEMINI_BASE_URL;

async function handler(req: NextRequest) {
  let body;
  if (req.method.toUpperCase() !== "GET") {
    body = await req.json();
  }
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.getAll("slug");
  searchParams.delete("slug");
  const params = searchParams.toString();

  try {
    let url = `${API_PROXY_BASE_URL}/${decodeURIComponent(path.join("/"))}`;
    if (params) url += `?${params}`;
    const payload: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        "x-goog-api-client":
          req.headers.get("x-goog-api-client") || "genai-js/0.24.0",
        "x-goog-api-key": req.headers.get("x-goog-api-key") || "",
      },
    };
    if (body) payload.body = JSON.stringify(body);
    const response = await fetch(url, payload);
    return new NextResponse(response.body, response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #145** (2025-11-11): **[Bug]: Google wil drop the default model in this project in 1108**
  *Symptoms*: ### Bug Description  Google wil drop the default model in this project in this week, so any update for the model changing ?  Thanks your awesome projects, it is very useful for review sth quickly.  ### Steps to Reproduce  Google wil drop the default model in this project in this week, so any update for the model changing ?  Thanks your awesome projects, it is very useful for review sth quickly.  ### Expected Behavior  Google wil drop the default model in this project in this week, so any update for the model changing ?  Thanks your awesome projects, it is very useful for review sth quickly.  ### Screenshots  _No response_  ### Deployment Method  - [ ] Docker - [ ] Vercel - [ ] Server  ### Desktop OS  _No response_  ### Desktop Browser  _No response_  ### Desktop Browser Version  _No response_  ### Smartphone Device  _No response_  ### Smartphone OS  _No response_  ### Smartphone Browser  _No response_  ### Smartphone Browser Version  _No response_  ### Additional Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > I will be upgrading the project's default model soon.

- **Issue #144** (2025-10-22): **[Question] 403 Forbidden Error When Using Proxy Mode**
  *Symptoms*: ### Bug Description  Hello dear maintainers, I'm encountering an issue specifically when trying to use the "Proxy mode". While "Local mode" works perfectly, the proxy functionality seems to be blocked.  #### **Environment** *   **Deployment:** Docker *   **Docker Command:**     ```bash     docker run -d --name deep-research \       -p 3333:3000 \       -e GOOGLE_GENERATIVE_AI_API_KEY=AIz... \       xiangfa/deep-research     ``` *   **Access URL:** `http://<my-server-ip>:3333`   ### Steps to Reproduce  1.  Start the container using the command above on a remote server. 2.  Access the web interface at `http://<my-server-ip>:3333`. 3.  **Test Local Mode:**     *   Select "Local" as the AI provider mode.     *   All features work correctly.     *   The browser's developer tools (F12 Network tab) show direct and successful requests to `https://generativelanguage.googleapis.com/v1beta/models/...`. 4.  **Test Proxy Mode:**     *   Switch to "Proxy" as the AI provider mode.     *   Attempt to perform any action that requires an AI call (e.g., initiate a search).     *   The action fails.  ### Expected Behavior  In Proxy mode, the backend server should successfully proxy the request to the Google Generative AI API and return a valid response to the frontend. The functionality should be the same as in Local mode.  #### **Actual Behavior** In Proxy mode, the request from the frontend to the backend's proxy endpoint fails with a **`403 Forbidden`** HTTP status code.  The browser's develo
  **Post-Mortem & Fix Analysis**:
  > sorry about that, I use [https://deepwiki.com/u14app/deep-research](url) ask the same question, I solve this naive problem.  I just set ACCESS_PASSWORD when I run docker image and paste the PWD in web Proxy Mode form 

- **Issue #118** (2025-07-25): **[Bug]: Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently**
  *Symptoms*: ### Bug Description  I'm encountering an issue where using any model other than gemini-2.5-pro results in errors during the information collection phase (Step 3) of my in-depth research. Below are the relevant details: Time        API Key (Partial)        Model        Status 2025/7/25 14:02:11        AIza...BF_s        gemini-2.5-pro        success 2025/7/25 14:01:33        AIza...hgEo        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...7aY4        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...gg2U        gemini-2.0-flash        failure 2025/7/25 13:55:09        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...7aY4        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:59        AIza...gg2U        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:30        AIza...7aY4        gemini-2.5-pro        success  ### Steps to Reproduce  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Expected Behavior  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Screenshots  _No response
  **Post-Mortem & Fix Analysis**:
  > You need to confirm whether your Gemini Key has search quota. Currently, the search quota for all models of Gemini free users is shared by accounts, that is, the search quota for all models of all keys under the same account is the same.  If the account's search limit is exceeded, the API will return a 429 error.
  > 我也是同样的问题也，搜索全部失败。我确认我的key最近几周都完全没有用过，不可能存在quota的问题，同时通过cherry可以搜索成功。
  >   > Bot detected the issue body's language is not English, translate it automatically.          ----     I have the same problem, all searches failed. I confirm that my key has not been used in the last few weeks, so it is impossible to have a quota problem, and at the same time, I can search successfully through cherry.         

- **Issue #117** (2025-07-25): **[Bug]: Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently**
  *Symptoms*: ### Bug Description  I'm encountering an issue where using any model other than gemini-2.5-pro results in errors during the information collection phase (Step 3) of my in-depth research. Below are the relevant details: Time        API Key (Partial)        Model        Status 2025/7/25 14:02:11        AIza...BF_s        gemini-2.5-pro        success 2025/7/25 14:01:33        AIza...hgEo        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...7aY4        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...gg2U        gemini-2.0-flash        failure 2025/7/25 13:55:09        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...7aY4        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:59        AIza...gg2U        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:30        AIza...7aY4        gemini-2.5-pro        success  ### Steps to Reproduce  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Expected Behavior  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Screenshots  _No response

- **Issue #116** (2025-07-25): **[Bug]: Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently**
  *Symptoms*: ### Bug Description  I'm encountering an issue where using any model other than gemini-2.5-pro results in errors during the information collection phase (Step 3) of my in-depth research. Below are the relevant details: Time        API Key (Partial)        Model        Status 2025/7/25 14:02:11        AIza...BF_s        gemini-2.5-pro        success 2025/7/25 14:01:33        AIza...hgEo        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...7aY4        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...gg2U        gemini-2.0-flash        failure 2025/7/25 13:55:09        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...7aY4        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:59        AIza...gg2U        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:30        AIza...7aY4        gemini-2.5-pro        success  ### Steps to Reproduce  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Expected Behavior  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Screenshots  _No response

- **Issue #112** (2025-07-21): **[Bug]: Anwser in Spanish language**
  *Symptoms*: ### Bug Description  Version 0.9.18  I ask in English, my location not in Spain (or Spain speaking country), my locale in OS not Spanish, but I receive an answer in Spanish.  Possible related PR https://github.com/u14app/deep-research/pull/64 which might cause the issue.  My deployment with Helm Chart, here is `deployment.yaml` <details>   <summary>Kubernetes deployment manifest</summary>          ```yaml apiVersion: apps/v1 kind: Deployment metadata:   name: {{ .Release.Name }}   labels:     app: {{ .Release.Name }}     version: {{ .Chart.AppVersion }} spec:   replicas: 1   selector:     matchLabels:       app: {{ .Release.Name }}   template:     metadata:       labels:         app: {{ .Release.Name }}         version: {{ .Chart.AppVersion }}     spec:       serviceAccountName: {{ .Release.Name }}       containers:         - name: deep-research           image: xiangfa/deep-research:v0.9.18           imagePullPolicy: Always           ports:             - containerPort: 3000               name: http           env:             - name: OPENAI_API_KEY               valueFrom:                 secretKeyRef:                   name: "{{ .Release.Name }}-secrets"                   key: "openai-api-key"           volumeMounts:             - name: secrets-store-inline               mountPath: "/secrets/openai"               readOnly: true           resources:             requests:               memory: "256Mi"               cpu: "100m"             limits:               memory: "512Mi" 
  **Post-Mortem & Fix Analysis**:
  > Sometimes the AI fails to follow the prompt correctly, so you can add additional instructions like "Please respond in English" after asking the question.

- **Issue #108** (2025-07-18): **[Bug]: gemini font rendering anamolies**
  *Symptoms*: ### Bug Description  Using Gemini 2.5 Flash  Deep Search: v0.9.18  When Gemini generates certain responses —  the rendered text appears garbled. This severely affects readability and comprehension.  This issue appears to be Gemini specific issue. I have seen these type of weird characters in their AI playground as well. Doing some kind of parsing on the results could resolve this.   Possible Cause (Speculation): Markdown rendering issue with bold/italic text. Improper parsing Unicode or invisible character artifacts causing display issues.  ### Steps to Reproduce  Use Gemini Flash for deep research  ### Expected Behavior  Clear and legible text.  ### Screenshots  <img width="2128" height="1055" alt="Image" src="https://github.com/user-attachments/assets/0ae79868-030a-4962-b8c3-f268aae1723a" />  <img width="1454" height="566" alt="Image" src="https://github.com/user-attachments/assets/e114da3b-bf22-42c9-9456-28aec2c0975f" />  ### Deployment Method  - [ ] Docker - [x] Vercel - [ ] Server  ### Desktop OS  Windows 10  ### Desktop Browser  Edge  ### Desktop Browser Version  138.0.3351.83  ### Smartphone Device  _No response_  ### Smartphone OS  _No response_  ### Smartphone Browser  _No response_  ### Smartphone Browser Version  _No response_  ### Additional Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > This font is for inline formulas. These text segments are judged by AI as formulas and rendered in inlineMath. You can request not to use any LaTeX syntax or prohibit the use of Inline formula when writing the final report.

- **Issue #107** (2025-07-15): **[Bug]: Can't connect to deployment on Vercel**
  *Symptoms*: ### Bug Description  I deployed to Vercel with all `MCP_*` env variables and an `ACCESS_PASSWORD` set. After not being able to connect from Langgraph, Flowise, n8n while connection to localhost all worked, I tried a MCP-type request with Postman which raises the error:  ``` Couldn't run the request: Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32001,"message":"Session not found"},"id":null} ``` path is `/api/mcp/sse`, method `HTTP` (Postman apparently means SSE, not streamable-http with "HTTP"). Langgraph fails with a `400 Bad Request`.  Anything I can check?   ### Steps to Reproduce  1. Click the "Deploy to Vercel" link in the readme 2. Deploy the app   ### Expected Behavior  Successful connection with capabilities returned  ### Screenshots  _No response_  ### Deployment Method  - [ ] Docker - [ ] Vercel - [ ] Server  ### Desktop OS  _No response_  ### Desktop Browser  _No response_  ### Desktop Browser Version  _No response_  ### Smartphone Device  _No response_  ### Smartphone OS  _No response_  ### Smartphone Browser  _No response_  ### Smartphone Browser Version  _No response_  ### Additional Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > `/api/mcp/sse` is the SSE mode of the MCP protocol. It is a composite port and involves the protocol upgrade mode. You cannot directly request it using Postman. You need to use the MCP client to request it.  If you want to use the `SSE` API directly, you need to access `/api/sse`. For the request parameters, please refer to the [document description](https://github.com/u14app/deep-research?tab=readme-ov-file#server-sent-events-api).
  > Thanks! Postman offers "MCP" as additional protocol next to HTTP, WS and others in beta and acts as a MCP client. It lets you list capabilities, call tools etc. Regardless, the URL is not the issue.  Simply put, localhost and fly (newly tested) work fine. The one-click Vercel deployment does not respond:  ```python from langchain_mcp_adapters.client import MultiServerMCPClient   url = "http://localhost:3000/api/mcp" # Locally hosted OK url = "https://deep-research-snowy-paper-9176.fly.dev/api/mcp" # Fly.io hosted OK url = "https://deep-research-qojm.vercel.app/api/mcp" # Vercel hosted FAILS  client = MultiServerMCPClient(     {         "deep-research": {             "url": url,             "transport": "streamable_http",         } ) tools = await client.get_tools() model = init_chat_model("google_genai:gemini-2.5-flash").bind_tools(tools) model.invoke(...) ```
  > Have you confirmed that the vercel default domain name can be accessed normally?

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

### Incident Patch 1: `4645efd5` (2026-04-18)
**Commit Message**: fix: handle empty request body for searxng

The frontend sends a request to POST /api/search/searxng/search with no request body, but the code tries to extract it as json, which effectly parses empty string to json, which fails. This commit sets the body to null if the request body is absent.

Refs: #91

**File**: `src/app/api/search/searxng/[...slug]/route.ts` (modified, +2/-1)
```diff
@@ -18,7 +18,8 @@ const API_PROXY_BASE_URL = process.env.SEARXNG_API_BASE_URL || SEARXNG_BASE_URL;
 export async function POST(req: NextRequest) {
   let body;
   if (req.method.toUpperCase() !== "GET") {
-    body = await req.json();
+    const text = await req.text();
+    body = text ? JSON.parse(text) : null;
   }
   const searchParams = req.nextUrl.searchParams;
   const path = searchParams.getAll("slug");
```

---

### Incident Patch 2: `e11c4a1d` (2026-04-14)
**Commit Message**: fix: Fix Ollama token validation logic.

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.11.0",
+  "version": "0.11.1",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/middleware.ts` (modified, +78/-76)
```diff
@@ -62,25 +62,25 @@ export async function middleware(request: NextRequest) {
   const hasDisabledGeminiModel = () => {
     if (request.method.toUpperCase() === "GET") return false;
     const { availableModelList, disabledModelList } = getCustomModelList(
-      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
+      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : [],
     );
     const isAvailableModel = availableModelList.some((availableModel) =>
-      request.nextUrl.pathname.includes(`models/${availableModel}:`)
+      request.nextUrl.pathname.includes(`models/${availableModel}:`),
     );
     if (isAvailableModel) return false;
     if (disabledModelList.includes("all")) return true;
     return disabledModelList.some((disabledModel) =>
-      request.nextUrl.pathname.includes(`models/${disabledModel}:`)
+      request.nextUrl.pathname.includes(`models/${disabledModel}:`),
     );
   };
   const hasDisabledAIModel = async () => {
     if (request.method.toUpperCase() === "GET") return false;
     const { model = "" } = await request.json();
     const { availableModelList, disabledModelList } = getCustomModelList(
-      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
+      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : [],
     );
     const isAvailableModel = availableModelList.some(
-      (availableModel) => availableModel === model
+      (availableModel) => availableModel === model,
     );
     if (isAvailableModel) return false;
     if (disabledModelList.includes("all")) return true;
@@ -97,19 +97,19 @@ export async function middleware(request: NextRequest) {
     ) {
       return NextResponse.json(
         { error: ERRORS.NO_PERMISSIONS },
-        { status: 403 }
+        { status: 403 },
       );
     } else {
       const apiKey = multiApiKeyPolling(GOOGLE_GENERATIVE_AI_API_KEY);
       if (apiKey) {
         const requestHeaders = new Headers();
         requestHeaders.set(
           "Content-Type",
-          request.headers.get("Content-Type") || "application/json"
+          request.headers.get("Content-Type") || "application/json",
         );
         requestHeaders.set(
           "x-goog-api-client",
-          request.headers.get("x-goog-api-client") || "genai-js/0.24.0"
+          request.headers.get("x-goog-api-client") || "genai-js/0.24.0",
         );
         requestHeaders.set("x-goog-api-key", apiKey);
         return NextResponse.next({
@@ -122,7 +122,7 @@ export async function middleware(request: NextRequest) {
           {
             error: ERRORS.NO_API_KEY,
           },
-          { status: 500 }
+          { status: 500 },
         );
       }
     }
@@ -134,22 +134,22 @@ export async function middleware(request: NextRequest) {
       !verifySignature(
         authorization.substring(7),
         accessPassword,
-        Date.now()
+        Date.now(),
       ) ||
       disabledAIProviders.includes("openrouter") ||
       isDisabledModel
     ) {
       return NextResponse.json(
         { error: ERRORS.NO_PERMISSIONS },
-        { status: 403 }
+        { status: 403 },
       );
     } else {
       const apiKey = multiApiKeyPolling(OPENROUTER_API_KEY);
       if (apiKey) {
         const requestHeaders = new Headers();
         requestHeaders.set(
           "Content-Type",
-          request.headers.get("Content-Type") || "application/json"
+          request.headers.get("Content-Type") || "application/json",
         );
         requestHeaders.set("Authorization", `Bearer ${apiKey}`);
         return NextResponse.next({
@@ -162,7 +162,7 @@ export async function middleware(request: NextRequest) {
           {
             error: ERRORS.NO_API_KEY,
           },
-          { status: 500 }
+          { status: 500 },
         );
       }
     }
@@ -174,22 +174,22 @@ export async function middleware(request: NextRequest) {
       !verifySignature(
         authorization.substring(7),
         accessPassword,
-        Date.now()
+        Date.now(),
       ) ||
       
```

---

### Incident Patch 3: `dfcf9add` (2026-02-10)
**Commit Message**: Implement feature X to enhance user experience and fix bug Y in module Z



---

### Incident Patch 4: `02122562` (2025-12-06)
**Commit Message**: build: Fix the next.js vulnerability

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.10.1",
+  "version": "0.10.2",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
@@ -60,7 +60,7 @@
     "marked": "^15.0.12",
     "mermaid": "^11.6.0",
     "nanoid": "^5.1.5",
-    "next": "^15.3.1",
+    "next": "^15.5.7",
     "next-themes": "^0.4.4",
     "ollama-ai-provider": "^1.2.0",
     "p-limit": "^6.2.0",
```

**File**: `pnpm-lock.yaml` (modified, +44/-44)
```diff
@@ -82,7 +82,7 @@ importers:
         version: 1.2.7(@types/react-dom@19.1.6(@types/react@19.1.8))(@types/react@19.1.8)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
       '@serwist/next':
         specifier: ^9.0.14
-        version: 9.1.0(next@15.4.1(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(typescript@5.8.3)
+        version: 9.1.0(next@15.5.7(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(typescript@5.8.3)
       '@xiangfa/mdeditor':
         specifier: ^0.2.3
         version: 0.2.3
@@ -138,8 +138,8 @@ importers:
         specifier: ^5.1.5
         version: 5.1.5
       next:
-        specifier: ^15.3.1
-        version: 15.4.1(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
+        specifier: ^15.5.7
+        version: 15.5.7(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
       next-themes:
         specifier: ^0.4.4
         version: 0.4.6(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
@@ -856,56 +856,56 @@ packages:
   '@napi-rs/wasm-runtime@0.2.12':
     resolution: {integrity: sha512-ZVWUcfwY4E/yPitQJl481FjFo3K22D6qF0DuFH6Y/nbnE11GY5uguDxZMGXPQ8WQ0128MXQD7TnfHyK4oWoIJQ==}
 
-  '@next/env@15.4.1':
-    resolution: {integrity: sha512-DXQwFGAE2VH+f2TJsKepRXpODPU+scf5fDbKOME8MMyeyswe4XwgRdiiIYmBfkXU+2ssliLYznajTrOQdnLR5A==}
+  '@next/env@15.5.7':
+    resolution: {integrity: sha512-4h6Y2NyEkIEN7Z8YxkA27pq6zTkS09bUSYC0xjd0NpwFxjnIKeZEeH591o5WECSmjpUhLn3H2QLJcDye3Uzcvg==}
 
   '@next/eslint-plugin-next@15.1.7':
     resolution: {integrity: sha512-kRP7RjSxfTO13NE317ek3mSGzoZlI33nc/i5hs1KaWpK+egs85xg0DJ4p32QEiHnR0mVjuUfhRIun7awqfL7pQ==}
 
-  '@next/swc-darwin-arm64@15.4.1':
-    resolution: {integrity: sha512-L+81yMsiHq82VRXS2RVq6OgDwjvA4kDksGU8hfiDHEXP+ncKIUhUsadAVB+MRIp2FErs/5hpXR0u2eluWPAhig==}
+  '@next/swc-darwin-arm64@15.5.7':
+    resolution: {integrity: sha512-IZwtxCEpI91HVU/rAUOOobWSZv4P2DeTtNaCdHqLcTJU4wdNXgAySvKa/qJCgR5m6KI8UsKDXtO2B31jcaw1Yw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@15.4.1':
-    resolution: {integrity: sha512-jfz1RXu6SzL14lFl05/MNkcN35lTLMJWPbqt7Xaj35+ZWAX342aePIJrN6xBdGeKl6jPXJm0Yqo3Xvh3Gpo3Uw==}
+  '@next/swc-darwin-x64@15.5.7':
+    resolution: {integrity: sha512-UP6CaDBcqaCBuiq/gfCEJw7sPEoX1aIjZHnBWN9v9qYHQdMKvCKcAVs4OX1vIjeE+tC5EIuwDTVIoXpUes29lg==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@15.4.1':
-    resolution: {integrity: sha512-k0tOFn3dsnkaGfs6iQz8Ms6f1CyQe4GacXF979sL8PNQxjYS1swx9VsOyUQYaPoGV8nAZ7OX8cYaeiXGq9ahPQ==}
+  '@next/swc-linux-arm64-gnu@15.5.7':
+    resolution: {integrity: sha512-NCslw3GrNIw7OgmRBxHtdWFQYhexoUCq+0oS2ccjyYLtcn1SzGzeM54jpTFonIMUjNbHmpKpziXnpxhSWLcmBA==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-arm64-musl@15.4.1':
-    resolution: {integrity: sha512-4ogGQ/3qDzbbK3IwV88ltihHFbQVq6Qr+uEapzXHXBH1KsVBZOB50sn6BWHPcFjwSoMX2Tj9eH/fZvQnSIgc3g==}
+  '@next/swc-linux-arm64-musl@15.5.7':
+    resolution: {integrity: sha512-nfymt+SE5cvtTrG9u1wdoxBr9bVB7mtKTcj0ltRn6gkP/2Nu1zM5ei8rwP9qKQP0Y//umK+TtkKgNtfboBxRrw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-x64-gnu@15.4.1':
-    resolution: {integrity: sha512-Jj0Rfw3wIgp+eahMz/tOGwlcYYEFjlBPKU7NqoOkTX0LY45i5W0WcDpgiDWSLrN8KFQq/LW7fZq46gxGCiOYlQ==}
+  '@next/swc-linux-x64-gnu@15.5.7':
+    resolution: {integrity: sha512-hvXcZvCaaEbCZcVzcY7E1uXN9xWZfFvkNHwbe/n4OkRhFWrs1J1QV+4U1BN06tXLdaS4DazEGXwgqnu/VMcmqw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
 
-  '@next/swc-linux-x64-musl@15.4.1':
-    resolution: {integrity: sha512-9WlEZfnw1vFqkWsTMzZDgNL7AUI1aiBHi0S2m8jvycPyCq/fbZjtE/nDkhJRYbSjXbtRHYLDBlmP95kpjEmJbw==}
+  '@next/swc-linux-x64-musl@15.5
```

---

### Incident Patch 5: `92a11f7f` (2025-09-11)
**Commit Message**: fix: Fixing Type Error

**File**: `src/utils/parser/officeParser.ts` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ function extractFiles(
     const extractedFiles: ExtractedFiles[] = [];
     const processZipfile = async (entry: Entry) => {
       if (filterFn(entry.filename)) {
-        if (entry.getData) {
+        if ("getData" in entry && typeof entry.getData === "function") {
           const data = await entry.getData(new BlobWriter());
           extractedFiles.push({
             filename: entry.filename,
```

---

### Incident Patch 6: `bebe7485` (2025-09-09)
**Commit Message**: fix: Compatible with openrouter default api base url

**File**: `src/hooks/useAiProvider.ts` (modified, +3/-2)
```diff
@@ -150,9 +150,10 @@ function useModelProvider() {
         const { openRouterApiKey = "", openRouterApiProxy } =
           useSettingStore.getState();
         if (mode === "local") {
+          const baseUrl = openRouterApiProxy || OPENROUTER_BASE_URL;
           options.baseURL = completePath(
-            openRouterApiProxy || OPENROUTER_BASE_URL,
-            "/api/v1"
+            baseUrl,
+            baseUrl.endsWith("/api") ? "/v1" : "/api/v1"
           );
           options.apiKey = multiApiKeyPolling(openRouterApiKey);
         } else {
```

---

### Incident Patch 7: `c389ea0e` (2025-09-05)
**Commit Message**: fix: Fix the error description of openrouter default path

**File**: `env.tpl` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ GOOGLE_PRIVATE_KEY_ID=
 
 # (Optional) Server-side OpenRouter API Key (Required for server API calls)
 OPENROUTER_API_KEY=
-# (Optional) Server-side OpenRouter API Proxy URL. Default, `https://openrouter.ai`
+# (Optional) Server-side OpenRouter API Proxy URL. Default, `https://openrouter.ai/api`
 OPENROUTER_API_BASE_URL=
 
 # (Optional) Server-side OpenAI API Key (Required for server API calls)
```

---

### Incident Patch 8: `388dba1c` (2025-08-01)
**Commit Message**: fix: Fixed the issue of abnormal google-vertex model call

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.21",
+  "version": "0.9.22",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/app/api/utils.ts` (modified, +4/-0)
```diff
@@ -44,6 +44,7 @@ const XAI_API_KEY = process.env.XAI_API_KEY || "";
 const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
 const AZURE_API_KEY = process.env.AZURE_API_KEY || "";
 const OPENAI_COMPATIBLE_API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY || "";
+const GOOGLE_VERTEX_API_BASE_URL = `https://${process.env.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`;
 // Search provider API key
 const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
 const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
@@ -74,6 +75,8 @@ export function getAIProviderBaseURL(provider: string) {
       return completePath(POLLINATIONS_API_BASE_URL, "/v1");
     case "ollama":
       return completePath(OLLAMA_API_BASE_URL, "/api");
+    case "google-vertex":
+      return completePath(GOOGLE_VERTEX_API_BASE_URL);
     default:
       throw new Error("Unsupported Provider: " + provider);
   }
@@ -99,6 +102,7 @@ export function getAIProviderApiKey(provider: string) {
       return OPENROUTER_API_KEY;
     case "openaicompatible":
       return OPENAI_COMPATIBLE_API_KEY;
+    case "google-vertex":
     case "pollinations":
     case "ollama":
       return "";
```

---

### Incident Patch 9: `aa98f46d` (2025-07-30)
**Commit Message**: fix: Fixed `Failed to execute 'atob' on 'Window'` error

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.20",
+  "version": "0.9.21",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/app/api/sse/route.ts` (modified, +0/-2)
```diff
@@ -75,8 +75,6 @@ export async function POST(req: NextRequest) {
           } else if (event === "error") {
             console.error(data);
             controller.close();
-          } else {
-            console.warn(`Unknown event: ${event}`);
           }
           controller.enqueue(
             encoder.encode(
```

**File**: `src/utils/vertexAuth.ts` (modified, +5/-1)
```diff
@@ -22,6 +22,10 @@ export interface GoogleCredentials {
 const base64url = (str: string) => {
   return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
 };
+
+const decodeBase64 = (base64: string) => {
+  return Buffer.from(base64, "base64").toString("utf-8");
+};
 const importPrivateKey = async (pemKey: string) => {
   const pemHeader = "-----BEGIN PRIVATE KEY-----";
   const pemFooter = "-----END PRIVATE KEY-----";
@@ -33,7 +37,7 @@ const importPrivateKey = async (pemKey: string) => {
     .replace(/\s/g, "");
 
   // Decode base64 to binary
-  const binaryString = atob(pemContents);
+  const binaryString = decodeBase64(pemContents);
 
   // Convert binary string to Uint8Array
   const binaryData = new Uint8Array(binaryString.length);
```

---

### Incident Patch 10: `9536ab27` (2025-07-18)
**Commit Message**: build: Fixed node version number

**File**: `.node-version` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+23.11.1
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #170** (closed): feat: add optional you.com search provider (@mouse-value-add)
- **PR #164** (2026-06-15): feat: add fastCRW (Firecrawl-compatible) search provider (@us)
- **PR #162** (2026-04-22): ci: add GitHub Actions workflow for linting on PRs and manual trigger (@druppelt)
- **PR #161** (2026-04-22): fix: handle empty request body for searxng (@druppelt)
- **PR #155** (closed): Add Codex plugin quality gate CI (@internet-dot)
- **PR #151** (2026-02-10): Dev jdb (@jamesbmour)
- **PR #149** (2025-12-29): Add MCP tool annotations for better AI understanding (@bryankthompson)
- **PR #148** (closed): refactor: migrate storage from localStorage to IndexedDB (@ITOTI-Y)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
