# Verification Protocol: Verification Protocol: Empirical Defect Shield for karakeep-app-karakeep-learnings

<!-- PROVENANCE_START
{
  "source_repository": "karakeep-app-karakeep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T10:11:13.879Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-karakeep-app-karakeep-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [karakeep-app-karakeep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T10:11:13.879Z`  
> **Learning ID**: `LEARN-EVO-karakeep-app-karakeep-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `karakeep-app-karakeep-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/karakeep-app-karakeep-learnings.md`  
> **Source**: github ([https://github.com/karakeep-app/karakeep](https://github.com/karakeep-app/karakeep))  
> **Source Version**: `bcc4b90a`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T10:11:01.015Z  
> **Learning ID**: `learn-github-karakeep-app-karakeep`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): karakeep-app/karakeep

> **Canonical Artifact**: `07_PROJECT_LEARNING/karakeep-app-karakeep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/karakeep-app/karakeep](https://github.com/karakeep-app/karakeep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T10:11:01.010Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karakeep-app/karakeep`
- **Description**: A self-hostable bookmark-everything app (links, notes and images) with AI-based automatic tagging and full text search
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 30630 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/browser-extension/src/single-file-core.d.ts`
```
/**
 * Type definitions for single-file-core
 */

declare module "single-file-core/single-file.js" {
  export interface SingleFileOptions {
    removeHiddenElements?: boolean;
    removeUnusedStyles?: boolean;
    removeUnusedFonts?: boolean;
    compressHTML?: boolean;
    blockScripts?: boolean;
    blockImages?: boolean;
    saveOriginalURLs?: boolean;
    removeFrames?: boolean;
    removeAlternativeFonts?: boolean;
    removeAlternativeMedias?: boolean;
    removeAlternativeImages?: boolean;
    groupDuplicateImages?: boolean;
    maxResourceSizeEnabled?: boolean;
    maxResourceSize?: number;
  }

  export interface PageData {
    content: string;
    title?: string;
    url?: string;
  }

  export function init(options?: Record<string, unknown>): void;

  export function getPageData(
    options?: SingleFileOptions,
    initOptions?: Record<string, unknown>,
    doc?: Document,
    win?: Window,
  ): Promise<PageData>;
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/ThemeProvider.tsx`
```
import { createContext, useContext, useEffect } from "react";

import usePluginSettings from "./settings";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const { settings, setSettings } = usePluginSettings();
  const theme = settings.theme;

  useEffect(() => {
    const root = window.document.documentElement;

    const updateIcon = (useDarkModeIcons: boolean) => {
      const iconSuffix = useDarkModeIcons ? "-darkmode.png" : ".png";

      const iconPaths = {
        "16": `logo-16${iconSuffix}`,
        "48": `logo-48${iconSuffix}`,
        "128": `logo-128${iconSuffix}`,
      };
      chrome.action.setIcon({ path: iconPaths });
    };

    const applyThemeAndIcon = () => {
      root.classList.remove("light", "dark");

      let currentTheme: "light" | "dark";
      if (theme === "system") {
        currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } else {
        currentTheme = theme;
      }

      root.classList.add(currentTheme);
      updateIcon(currentTheme === "dark");
    };

    applyThemeAndIcon();
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setSettings((s) => ({ ...s, theme: newTheme }));
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

```

### Core Architecture Module: `apps/browser-extension/src/utils/badgeCache.ts`
```
// Badge count cache helpers
import { getPluginSettings } from "./settings";
import { getApiClient, getQueryClient } from "./trpc";

/**
 * Fetches the bookmark status for a given URL from the API.
 * This function will be used by our cache as the "fetcher".
 * @param url The URL to check.
 * @returns The bookmark id if found, null if not found.
 */
async function fetchBadgeStatus(url: string): Promise<string | null> {
  const api = await getApiClient();
  if (!api) {
    // This case should ideally not happen if settings are correct
    throw new Error("[badgeCache] API client not configured");
  }
  try {
    const data = await api.bookmarks.checkUrl.query({ url });
    return data.bookmarkId;
  } catch (error) {
    console.error(`[badgeCache] Failed to fetch status for ${url}:`, error);
    // In case of API error, return a non-cacheable empty status
    // Propagate so cache treats this as a miss and doesn't store
    throw error;
  }
}

/**
 * Get badge status for a URL using the SWR cache.
 * @param url The URL to get the status for.
 */
export async function getBadgeStatus(url: string): Promise<string | null> {
  const { useBadgeCache, badgeCacheExpireMs } = await getPluginSettings();
  if (!useBadgeCache) return fetchBadgeStatus(url);

  const queryClient = await getQueryClient();
  if (!queryClient) return fetchBadgeStatus(url);

  return await queryClient.fetchQuery({
    queryKey: ["badgeStatus", url],
    queryFn: () => fetchBadgeStatus(url),
    // Keep in memory for twice as long as stale time
    gcTime: badgeCacheExpireMs * 2,
    // Use the user-configured cache expire time
    staleTime: badgeCacheExpireMs,
  });
}

/**
 * Clear badge status cache for a specific URL or all URLs.
 * @param url The URL to clear. If not provided, clears the entire cache.
 */
export async function clearBadgeStatus(url?: string): Promise<void> {
  const queryClient = await getQueryClient();
  if (!queryClient) return;

  if (url) {
    await queryClient.invalidateQueries({ queryKey: ["badgeStatus", url] });
  } else {
    await queryClient.invalidateQueries({ queryKey: ["badgeStatus"] });
  }
  console.log(`[badgeCache] Invalidated cache for: ${url || "all"}`);
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/css.ts`
```
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/permissions.ts`
```
/**
 * Host-permission helpers for the client-side crawling feature.
 *
 * `<all_urls>` is declared as an *optional* host permission so it isn't granted
 * at install time. It's only needed when the user opts in to client-side
 * crawling (capturing pages in the browser via SingleFile), at which point we
 * ask for it via `chrome.permissions.request()` — which must be called from a
 * user gesture (e.g. flipping the settings switch).
 */

const HOST_PERMISSIONS: chrome.permissions.Permissions = {
  origins: ["<all_urls>"],
};

export function hasHostPermission(): Promise<boolean> {
  return chrome.permissions.contains(HOST_PERMISSIONS);
}

export function requestHostPermission(): Promise<boolean> {
  return chrome.permissions.request(HOST_PERMISSIONS);
}

export function removeHostPermission(): Promise<boolean> {
  return chrome.permissions.remove(HOST_PERMISSIONS);
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/providers.tsx`
```
import { TRPCSettingsProvider } from "@karakeep/shared-react/providers/trpc-provider";

import usePluginSettings from "./settings";
import { ThemeProvider } from "./ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const { settings } = usePluginSettings();

  return (
    <TRPCSettingsProvider settings={settings}>
      <ThemeProvider>{children}</ThemeProvider>
    </TRPCSettingsProvider>
  );
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/settings.ts`
```
import React from "react";
import { z } from "zod";

export const DEFAULT_BADGE_CACHE_EXPIRE_MS = 60 * 60 * 1000; // 1 hour
export const DEFAULT_SHOW_COUNT_BADGE = false;

const zSettingsSchema = z.object({
  apiKey: z.string(),
  apiKeyId: z.string().optional(),
  address: z.string().optional().default("https://cloud.karakeep.com"),
  theme: z.enum(["light", "dark", "system"]).optional().default("system"),
  showCountBadge: z.boolean().default(DEFAULT_SHOW_COUNT_BADGE),
  useBadgeCache: z.boolean().default(true),
  badgeCacheExpireMs: z.number().min(0).default(DEFAULT_BADGE_CACHE_EXPIRE_MS),
  customHeaders: z.record(z.string(), z.string()).optional().default({}),
  useSingleFile: z.boolean().default(false),
  singleFileIncludeImages: z.boolean().default(true),
  autoSave: z.boolean().default(true),
});

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  address: "https://cloud.karakeep.com",
  theme: "system",
  showCountBadge: DEFAULT_SHOW_COUNT_BADGE,
  useBadgeCache: true,
  badgeCacheExpireMs: DEFAULT_BADGE_CACHE_EXPIRE_MS,
  customHeaders: {},
  useSingleFile: false,
  singleFileIncludeImages: true,
  autoSave: true,
};

export type Settings = z.infer<typeof zSettingsSchema>;

const STORAGE = chrome.storage.sync;

export default function usePluginSettings() {
  const [settings, setSettingsInternal] =
    React.useState<Settings>(DEFAULT_SETTINGS);

  const [isInit, setIsInit] = React.useState(false);

  React.useEffect(() => {
    if (!isInit) {
      getPluginSettings().then((settings) => {
        setSettingsInternal(settings);
        setIsInit(true);
      });
    }
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (changes.settings === undefined) {
        return;
      }
      const parsedSettings = zSettingsSchema.safeParse(
        changes.settings.newValue,
      );
      if (parsedSettings.success) {
        setSettingsInternal(parsedSettings.data);
      }
    };
    STORAGE.onChanged.addListener(onChange);
    return () => {
      STORAGE.onChanged.removeListener(onChange);
    };
  }, []);

  const setSettings = async (s: (_: Settings) => Settings) => {
    const newVal = s(settings);
    await STORAGE.set({ settings: newVal });
  };

  return { settings, setSettings, isLoaded: isInit };
}

export async function getPluginSettings() {
  const parsedSettings = zSettingsSchema.safeParse(
    (await STORAGE.get("settings")).settings,
  );
  if (parsedSettings.success) {
    return parsedSettings.data;
  } else {
    return DEFAULT_SETTINGS;
  }
}

export function subscribeToSettingsChanges(
  callback: (settings: Settings) => void,
) {
  STORAGE.onChanged.addListener((changes) => {
    if (changes.settings === undefined) {
      return;
    }
    const parsedSettings = zSettingsSchema.safeParse(changes.settings.newValue);
    if (parsedSettings.success) {
      callback(parsedSettings.data);
    } else {
      callback(DEFAULT_SETTINGS);
    }
  });
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/singlefile.ts`
```
/**
 * Utilities for SingleFile integration
 */

import { getPluginSettings } from "./settings";

const CAPTURE_TIMEOUT_MS = 60_000;

/**
 * Capture the current page using SingleFile
 */
export async function capturePageWithSingleFile(
  tabId: number,
  opts: { includeImages: boolean },
): Promise<string> {
  const blockImages = !opts.includeImages;
  let response;
  try {
    response = await sendCaptureMessage(tabId, blockImages);
  } catch (e) {
    // Content script not yet present in the tab (e.g. page loaded before the
    // extension was installed or the browser was restarted). Inject on demand
    // and retry.
    const msg = e instanceof Error ? e.message : String(e);
    if (
      !/Could not establish connection|Receiving end does not exist/i.test(msg)
    ) {
      throw e;
    }
    await injectSingleFileContentScript(tabId);
    response = await sendCaptureMessage(tabId, blockImages);
  }

  if (!response.success) {
    throw new Error(response.error || "Failed to capture page");
  }

  return response.html;
}

async function sendCaptureMessage(
  tabId: number,
  blockImages: boolean,
): Promise<{ success: boolean; html: string; error?: string }> {
  return await Promise.race([
    chrome.tabs.sendMessage(tabId, { type: "CAPTURE_PAGE", blockImages }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`Capture timed out after ${CAPTURE_TIMEOUT_MS / 1000}s`),
          ),
        CAPTURE_TIMEOUT_MS,
      ),
    ),
  ]);
}

async function injectSingleFileContentScript(tabId: number): Promise<void> {
  const contentScripts = chrome.runtime.getManifest().content_scripts;
  const files = contentScripts?.find((cs) =>
    cs.js?.some((f) => f.includes("singlefile-content-script")),
  )?.js;
  if (!files || files.length === 0) {
    throw new Error("SingleFile content script not declared in manifest");
  }
  // The content script is built as a standalone IIFE (see `standaloneFiles` in
  // vite.config.ts), so it registers its CAPTURE_PAGE listener synchronously
  // and the listener exists once `executeScript` resolves.
  await chrome.scripting.executeScript({ target: { tabId }, files });
}

/**
 * Upload the captured HTML as an asset and return the asset id.
 */
export async function uploadSingleFileAsset(
  html: string,
  title?: string,
): Promise<string> {
  const settings = await getPluginSettings();

  const blob = new Blob([html], { type: "text/html" });
  const filename = sanitizeFilename(title || "page") + ".html";
  const file = new File([blob], filename, { type: "text/html" });

  const formData = new FormData();
  formData.append("file", file);

  const apiUrl = `${settings.address}/api/assets`;

  const headers: HeadersInit = {
    Authorization: `Bearer ${settings.apiKey}`,
  };

  if (settings.customHeaders) {
    Object.entries(settings.customHeaders).forEach(([key, value]) => {
      headers[key] = value;
    });
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload asset: ${response.status} ${errorText}`);
  }

  const { assetId } = (await response.json()) as { assetId: string };
  return assetId;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9-_\s]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/storagePersister.ts`
```
import {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

export const TANSTACK_QUERY_CACHE_KEY = "tanstack-query-cache-key";

// Declare chrome namespace for TypeScript
declare const chrome: {
  storage: {
    local: {
      set: (items: Record<string, string>) => Promise<void>;
      get: (keys: string | string[]) => Promise<Record<string, string>>;
      remove: (keys: string | string[]) => Promise<void>;
    };
  };
};

/**
 * Creates an AsyncStorage-like interface for Chrome's extension storage.
 *
 * @param storage The Chrome storage area to use (e.g., `chrome.storage.local`).
 * @returns An object that mimics the AsyncStorage interface.
 */
export const createChromeStorage = (
  storage: typeof chrome.storage.local = globalThis.chrome?.storage?.local,
): Persister => {
  // Check if we are in a Chrome extension environment
  if (typeof chrome === "undefined" || !chrome.storage) {
    // Return a noop persister for non-extension environments
    return {
      persistClient: async () => {
        return;
      },
      restoreClient: async () => undefined,
      removeClient: async () => {
        return;
      },
    };
  }

  return {
    persistClient: async (client: PersistedClient) => {
      await storage.set({ [TANSTACK_QUERY_CACHE_KEY]: JSON.stringify(client) });
    },
    restoreClient: async () => {
      const result = await storage.get(TANSTACK_QUERY_CACHE_KEY);
      return result[TANSTACK_QUERY_CACHE_KEY]
        ? JSON.parse(result[TANSTACK_QUERY_CACHE_KEY])
        : undefined;
    },
    removeClient: async () => {
      await storage.remove(TANSTACK_QUERY_CACHE_KEY);
    },
  };
};

```

### Core Architecture Module: `apps/browser-extension/src/utils/trpc.ts`
```
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "@karakeep/trpc/routers/_app";

import { getPluginSettings } from "./settings";
import { createChromeStorage } from "./storagePersister";

export { useTRPC } from "@karakeep/shared-react/trpc";

let apiClient: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;
let queryClient: QueryClient | null = null;
let currentSettings: {
  address: string;
  apiKey: string;
  badgeCacheExpireMs: number;
  useBadgeCache: boolean;
  customHeaders: Record<string, string>;
} | null = null;

export async function initializeClients() {
  const { address, apiKey, badgeCacheExpireMs, useBadgeCache, customHeaders } =
    await getPluginSettings();

  if (currentSettings) {
    const addressChanged = currentSettings.address !== address;
    const apiKeyChanged = currentSettings.apiKey !== apiKey;
    const cacheTimeChanged =
      currentSettings.badgeCacheExpireMs !== badgeCacheExpireMs;
    const useBadgeCacheChanged =
      currentSettings.useBadgeCache !== useBadgeCache;
    const customHeadersChanged =
      JSON.stringify(currentSettings.customHeaders) !==
      JSON.stringify(customHeaders);

    if (!address || !apiKey) {
      // Invalid configuration, clean
      const persisterForCleanup = createChromeStorage();
      await persisterForCleanup.removeClient();
      cleanupApiClient();
      return;
    }

    if (addressChanged || apiKeyChanged || customHeadersChanged) {
      // Switch context completely → discard the old instance and wipe persisted cache
      const persisterForCleanup = createChromeStorage();
      await persisterForCleanup.removeClient();
      cleanupApiClient();
    } else if ((cacheTimeChanged || useBadgeCacheChanged) && queryClient) {
      // Change the cache policy only → Clean up the data, but reuse the instance
      queryClient.clear();
    }

    // If there is already existing and there is no major change in settings, reuse it
    if (
      queryClient &&
      apiClient &&
      currentSettings &&
      !addressChanged &&
      !apiKeyChanged &&
      !cacheTimeChanged &&
      !useBadgeCacheChanged &&
      !customHeadersChanged
    ) {
      return;
    }
  }

  if (address && apiKey) {
    // Store current settings
    currentSettings = {
      address,
      apiKey,
      badgeCacheExpireMs,
      useBadgeCache,
      customHeaders,
    };

    // Create new QueryClient with updated settings
    queryClient = new QueryClient();

    const persister = createChromeStorage();
    if (useBadgeCache) {
      persistQueryClient({
        queryClient,
        persister,
        // Avoid restoring very old data and bust on policy changes
        maxAge: badgeCacheExpireMs * 2,
        buster: `badge:${address}:${badgeCacheExpireMs}`,
      });
    } else {
      // Ensure disk cache is cleared when caching is disabled
      await persister.removeClient();
    }

    apiClient = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${address}/api/trpc`,
          headers() {
            return {
              Authorization: `Bearer ${apiKey}`,
              ...customHeaders,
            };
          },
          transformer: superjson,
        }),
      ],
    });
  }
}

export async function getApiClient() {
  if (!apiClient) {
    await initializeClients();
  }
  return apiClient;
}

export async function getQueryClient() {
  // Check if settings have changed and reinitialize if needed
  await initializeClients();
  return queryClient;
}

export function cleanupApiClient() {
  apiClient = null;
  queryClient = null;
  currentSettings = null;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3369** (2026-11-15): **`@karakeep/sdk` cannot be imported or required in Node.js (`exports` points at CJS `dist/index.js` under `"type": "module"`)**
  *Symptoms*: ### Describe the Bug  Loading `@karakeep/sdk` in Node.js fails for both ESM `import` (including the usage snippet in `packages/sdk/README.md`) and CommonJS `require`.  In `packages/sdk/package.json`, `"type"` is `"module"` and `publishConfig` sets `"exports": "./dist/index.js"`, while `packages/sdk/vite.config.mts` writes the CommonJS bundle (`Object.defineProperty(exports, ...)`) to `dist/index.js` and the ESM bundle to `dist/index.mjs`. Because `"exports"` takes precedence over `"module"` (and blocks subpath imports such as `@karakeep/sdk/dist/index.mjs`) and `"type": "module"` causes Node.js to parse `.js` files as ES modules, `dist/index.mjs` is unreachable and `dist/index.js` fails to load as ESM.  All published versions of `@karakeep/sdk` (`0.23.2` through `0.34.0`) and `main` (`0b66183dc`) ship this configuration.  ### Steps to Reproduce  ```sh npm init -y npm install @karakeep/sdk@0.34.0 ```  ```js // app.mjs import { createKarakeepClient } from "@karakeep/sdk"; console.log(typeof createKarakeepClient); ```  ```js // app.cjs const { createKarakeepClient } = require("@karakeep/sdk"); console.log(typeof createKarakeepClient); ```  Running `node app.mjs` and `node app.cjs`:  ```text $ node app.mjs SyntaxError: The requested module '@karakeep/sdk' does not provide an export named 'createKarakeepClient'  $ node app.cjs ReferenceError: exports is not defined in ES module scope This file is being treated as an ES module because it has a '.js' file extension and '.../node_mod

- **Issue #3288** (2026-11-07): **Highlight popup covers the selected text in the preview modal**
  *Symptoms*: ### Describe the Bug  When selecting text in the reader view of the bookmark preview modal, the highlight popup appears on top of the selection and covers it (see screenshot).  This makes it hard to see what’s being highlighted and to adjust the selection, which gets in the way when highlighting while reading.  ### Steps to Reproduce  1. Open a preview of any bookmark 2. Highlight some text 3. Highlight pop-up is covering actual text selection  ### Expected Behaviour  Expected: the popup is placed above or below the selection without overlapping it (like the fullscreen reader)  ### Screenshots or Additional Context  # Actual  <img width="860" height="352" alt="Image" src="https://github.com/user-attachments/assets/d6c23bc8-192f-44cd-9e64-d77cb296852d" />  # Expected  <img width="822" height="360" alt="Image" src="https://github.com/user-attachments/assets/04f32f54-4df5-46b5-a183-99cba951d030" />  ### Device Details  Firefox, Safari, Zen (Desktop)  ### Exact Karakeep Version  0.34.1  ### Environment Details  Docker on Ubuntu 22.04 behind Caddy  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem

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

### Incident Patch 1: `8e09a55c` (2026-11-15)
**Commit Message**: fix(workers): parse PDFs with pdf.js in a subprocess (#3368)

* fix(workers): parse PDFs with pdf.js in a subprocess

PDF text extraction ran pdf2json on the workers' main thread. It's CPU-bound
for the whole parse and builds a full page model, decoding every embedded
image even though only the text is used. A 392-page scanned book (1,176
JPEG 2000/JBIG2 images) pinned the event loop, so every other job in the
process (search indexing, embeddings, tagging) timed out. The job timeout
couldn't stop it either: it only aborts a signal the parser never checks, so
each retry started another parse next to the stuck one.

- Extract text in a separate node process with a bounded heap
  (ASSET_PREPROCESSING_PDF_PARSER_MEM_LIMIT_MB, default 1024). It's killed
  when the job is aborted or times out, and an OOM only fails that job.
- Swap pdf2json for pdfjs-dist's getTextContent, which never decodes images.
  Skip pdf.js's optional native canvas, which is only needed for rendering.
- Don't pass the worker's environment (API keys, storage credentials) to the
  subprocess that parses untrusted files.
- Share the subprocess launch logic with the HTML parser.

Co-Authored-By: Claude Opus 5.5 <[REDA

**File**: `apps/workers/package.json` (modified, +1/-1)
```diff
@@ -52,8 +52,8 @@
     "node-cron": "^3.0.3",
     "node-fetch": "^3.3.2",
     "patchright": "1.59.4",
-    "pdf2json": "^3.1.5",
     "pdf2pic": "^3.1.3",
+    "pdfjs-dist": "6.4.299",
     "prom-client": "^15.1.3",
     "rss-parser": "^3.13.0",
     "sharp": "^0.35.5",
```

**File**: `apps/workers/scripts/parsePdfSubprocess.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// Extracts the text of a PDF with pdf.js. It runs as its own process because
+// parsing is CPU-bound and would starve the worker's event loop on large PDFs,
+// and because the parent can only stop it by killing it.
+import { readFile, writeFile } from "node:fs/promises";
+import { createRequire } from "node:module";
+import * as path from "node:path";
+import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
+
+import type { ParsePdfSubprocessOutput } from "../workers/utils/parsePdfSubprocessIpc";
+import {
+  parsePdfSubprocessInputSchema,
+  parsePdfSubprocessOutputSchema,
+} from "../workers/utils/parsePdfSubprocessIpc";
+
+// pdf.js reads the predefined CMaps (needed to map CJK text to unicode) and the
+// standard fonts from the files shipped in its package.
+const pdfjsDir = path.dirname(
+  createRequire(import.meta.url).resolve("pdfjs-dist/package.json"),
+);
+
+async function readStdin(): Promise<string> {
+  const chunks: Buffer[] = [];
+  for await (const chunk of process.stdin) {
+    chunks.push(chunk as Buffer);
+  }
+  return Buffer.concat(chunks).toString("utf8");
+}
+
+async function parsePdf(
+  data: Uint8Array,
+): Promise<{ text: string; metadata: Record<string, unknown> | null }> {
+  const loadingTask = getDocument({
+    data,
+    cMapUrl: path.join(pdfjsDir, "cmaps") + path.sep,
+    standardFontDataUrl: path.join(pdfjsDir, "standard_fonts") + path.sep,
+    // Only the text is needed: don't turn fonts into font faces for rendering.
+    disableFontFace: true,
+    useSystemFonts: false,
+    verbosity: 0,
+  });
+  try {
+    const doc = await loadingTask.promise;
+
+    // getTextContent only walks the text operators of each page. Unlike
+    // rendering it never decodes images, which is where the time goes on
+    // scanned books.
+    const pages: string[] = [];
+    for (let i = 1; i <= doc.numPages; i++) {
+      const page = await doc.getPage(i);
+      const content = await page.getTextContent();
+      pages.push(
+        content.items
+          .map((item) =>
+            "str" in item ? item.str + (item.hasEOL ? "\n" : "") : "",
+          )
+          .join(""),
+      );
+      page.cleanup();
+    }
+
+    const { info } = await doc.getMetadata();
+    return {
+      text: pages.join("\n\n").trim(),
+      metadata: (info as Record<string, unknown> | undefined) ?? null,
+    };
+  } finally {
+    await loadingTask.destroy();
+  }
+}
+
+async function main() {
+  const input = parsePdfSubprocessInputSchema.parse(
+    JSON.parse(await readStdin()),
+  );
+
+  let output: ParsePdfSubprocessOutput;
+  try {
+    const parsed = await parsePdf(
+      new Uint8Array(await readFile(input.pdfPath)),
+    );
+    output = { ok: true, ...parsed };
+  } catch (err) {
+    output = {
+      ok: false,
+      error: err instanceof Error ? err.message : String(err),
+    };
+  }
+
+  await writeFile(
+    input.outputPath,
+    JSON.stringify(parsePdfSubprocessOutputSchema.parse(output)),
+    "utf8",
+  );
+}
+
+main().catch((err: unknown) => {
+  console.error(err);
+  process.exitCode = 1;
+});
```

**File**: `apps/workers/tsdown.config.ts` (modified, +5/-1)
```diff
@@ -1,7 +1,11 @@
 import { defineConfig } from "tsdown";
 
 export default defineConfig({
-  entry: ["index.ts", "scripts/parseHtmlSubprocess.ts"],
+  entry: [
+    "index.ts",
+    "scripts/parseHtmlSubprocess.ts",
+    "scripts/parsePdfSubprocess.ts",
+  ],
   format: ["esm"],
   target: "node22",
   outDir: "dist",
```

**File**: `apps/workers/workers/assetPreprocessingWorker.ts` (modified, +4/-19)
```diff
@@ -33,6 +33,7 @@ import {
 
 import { workerStatsCounter } from "../metrics";
 import { withWorkerEventLog, withWorkerTracing } from "../workerTracing";
+import { runPdfParseSubprocess } from "./utils/pdfSubprocess";
 
 export class AssetPreprocessingWorker {
   static async build() {
@@ -168,24 +169,6 @@ async function readImageTextWithLLM(
   return extractedText;
 }
 
-async function readPDFText(buffer: Buffer): Promise<{
-  text: string;
-  metadata: Record<string, object>;
-}> {
-  const { default: PDFParser } = await import("pdf2json");
-  return new Promise((resolve, reject) => {
-    const pdfParser = new PDFParser(null, true);
-    pdfParser.on("pdfParser_dataError", reject);
-    pdfParser.on("pdfParser_dataReady", (pdfData) => {
-      resolve({
-        text: pdfParser.getRawTextContent(),
-        metadata: pdfData.Meta,
-      });
-    });
-    pdfParser.parseBuffer(buffer);
-  });
-}
-
 export async function extractAndSavePDFScreenshot(
   jobId: string,
   asset: Buffer,
@@ -342,6 +325,7 @@ async function extractAndSavePDFText(
   asset: Buffer,
   bookmark: NonNullable<Awaited<ReturnType<typeof getBookmark>>>,
   isFixMode: boolean,
+  abortSignal: AbortSignal,
 ): Promise<boolean> {
   {
     const alreadyHasText = !!bookmark.asset.content;
@@ -355,7 +339,7 @@ async function extractAndSavePDFText(
   logger.info(
     `[assetPreprocessing][${jobId}] Attempting to extract text from pdf.`,
   );
-  const pdfParse = await readPDFText(asset);
+  const pdfParse = await runPdfParseSubprocess(asset, jobId, abortSignal);
   if (!pdfParse?.text) {
     throw new Error(
       `[assetPreprocessing][${jobId}] PDF text is empty. Please make sure that the PDF includes text and not just images.`,
@@ -450,6 +434,7 @@ async function run(req: DequeuedJob<AssetPreprocessingRequest>) {
         asset,
         bookmark,
         isFixMode,
+        req.abortSignal,
       );
       const extractedScreenshot = await extractAndSavePDFScreenshot(
         jobId,
```

**File**: `apps/workers/workers/utils/parsePdfSubprocessIpc.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { z } from "zod";
+
+export const parsePdfSubprocessInputSchema = z.object({
+  // Path to a temp file containing the PDF. The parent process owns this file
+  // and deletes it once the subprocess exits.
+  pdfPath: z.string(),
+  // Path the subprocess writes its result to. A file is used instead of stdout
+  // so nothing the PDF library logs can corrupt the result.
+  outputPath: z.string(),
+});
+
+export const parsePdfSubprocessOutputSchema = z.discriminatedUnion("ok", [
+  z.object({
+    ok: z.literal(true),
+    text: z.string(),
+    metadata: z.record(z.string(), z.unknown()).nullable(),
+  }),
+  z.object({
+    ok: z.literal(false),
+    error: z.string(),
+  }),
+]);
+
+export type ParsePdfSubprocessInput = z.infer<
+  typeof parsePdfSubprocessInputSchema
+>;
+export type ParsePdfSubprocessOutput = z.infer<
+  typeof parsePdfSubprocessOutputSchema
+>;
```

**File**: `apps/workers/workers/utils/parseSubprocess.ts` (modified, +5/-29)
```diff
@@ -15,6 +15,7 @@ import type {
   ParseSubprocessError,
   ParseSubprocessOutput,
 } from "./parseHtmlSubprocessIpc";
+import { getScriptCommand } from "./subprocessScript";
 import type { RunProxyConfig } from "../../network";
 import { getBookmarkDomain } from "../../network";
 import { truncateUrl } from "./crawlerUtils";
@@ -25,34 +26,6 @@ import {
 
 const tracer = getTracer("@karakeep/workers");
 
-function getSubprocessScriptPath(): string {
-  const currentUrl = import.meta.url;
-  if (currentUrl.includes("/dist/")) {
-    // Production: running from built output
-    return new URL("./scripts/parseHtmlSubprocess.js", currentUrl).pathname;
-  }
-  // Dev mode: running via tsx
-  return new URL("../../scripts/parseHtmlSubprocess.ts", currentUrl).pathname;
-}
-
-function getSubprocessCommand(): { cmd: string; args: string[] } {
-  const scriptPath = getSubprocessScriptPath();
-  const maxOldSpaceSize = serverConfig.crawler.parserMemLimitMb;
-
-  if (scriptPath.endsWith(".ts")) {
-    // Dev mode: use tsx to run TypeScript directly
-    return {
-      cmd: "tsx",
-      args: [`--max-old-space-size=${maxOldSpaceSize}`, scriptPath],
-    };
-  }
-
-  return {
-    cmd: process.execPath,
-    args: [`--max-old-space-size=${maxOldSpaceSize}`, scriptPath],
-  };
-}
-
 export async function runParseSubprocess(
   htmlContent: string,
   url: string,
@@ -80,7 +53,10 @@ export async function runParseSubprocess(
         `[Crawler][${jobId}] Spawning parse subprocess for "${truncateUrl(url)}" ...`,
       );
 
-      const { cmd, args } = getSubprocessCommand();
+      const { cmd, args } = getScriptCommand(
+        "parseHtmlSubprocess",
+        serverConfig.crawler.parserMemLimitMb,
+      );
       const timeoutMs = serverConfig.crawler.parseTimeoutSec * 1000;
 
       // Hand the HTML to the subprocess via a temp file instead of stdin. The
```

**File**: `apps/workers/workers/utils/pdfSubprocess.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+// Runs PDF text extraction in a separate node process. Parsing is CPU-bound and
+// would otherwise hog the event loop shared by every worker in this process, and
+// it can't observe the job's abort signal: a timed-out parse would keep running
+// (and pile up with its own retries) unless the process is killed.
+import * as fs from "node:fs/promises";
+import * as os from "node:os";
+import * as path from "node:path";
+import { execa } from "execa";
+
+import serverConfig from "@karakeep/shared/config";
+import { tryCatch } from "@karakeep/shared/tryCatch";
+
+import { parsePdfSubprocessOutputSchema } from "./parsePdfSubprocessIpc";
+import { getScriptCommand } from "./subprocessScript";
+
+export async function runPdfParseSubprocess(
+  pdf: Buffer,
+  jobId: string,
+  abortSignal: AbortSignal,
+): Promise<{ text: string; metadata: Record<string, unknown> | null }> {
+  const memLimitMb = serverConfig.assetPreprocessing.pdfParserMemLimitMb;
+  const { cmd, args } = getScriptCommand("parsePdfSubprocess", memLimitMb);
+
+  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "karakeep-pdf-"));
+  const pdfPath = path.join(tmpDir, "input.pdf");
+  const outputPath = path.join(tmpDir, "output.json");
+  try {
+    await fs.writeFile(pdfPath, pdf);
+    const result = await execa({
+      input: JSON.stringify({ pdfPath, outputPath }),
+      cancelSignal: abortSignal,
+      timeout: serverConfig.assetPreprocessing.jobTimeoutSec * 1000,
+      reject: false,
+      // The subprocess parses untrusted files and needs nothing from the
+      // environment, so it doesn't get the worker's secrets (API keys, storage
+      // credentials, ...). PATH is only there for dev mode to find tsx.
+      extendEnv: false,
+      env: { PATH: process.env.PATH },
+      // The result comes back through `outputPath`; nobody reads stdout.
+      stdout: "ignore",
+      // pdf.js warns on every load that the canvas it only needs for rendering
+      // is missing, so stderr is only surfaced when the subprocess fails.
+      stderr: "pipe",
+    })(cmd, args);
+
+    if (result.isCanceled) {
+      throw new Error(
+        `[assetPreprocessing][${jobId}] PDF parse subprocess was cancelled (job aborted)`,
+      );
+    }
+    if (result.timedOut) {
+      throw new Error(
+        `[assetPreprocessing][${jobId}] PDF parse subprocess timed out. Consider increasing ASSET_PREPROCESSING_JOB_TIMEOUT_SEC (currently ${serverConfig.assetPreprocessing.jobTimeoutSec}s).`,
+      );
+    }
+    if (result.exitCode !== 0) {
+      // SIGKILL (137) from the OS OOM killer, SIGABRT (134) from V8 running out
+      // of heap. The exit codes show up when a wrapper (tsx in dev) relays them.
+      const isOom =
+        result.exitCode === 137 ||
+        result.exitCode === 134 ||
+        result.signal === "SIGKILL" ||
+        result.signal === "SIGABRT";
+      const reason = isOom
+        ? `ran out of memory. Consider increasing ASSET_PREPROCESSING_PDF_PARSER_MEM_LIMIT_MB (currently ${memLimitMb}MB).`
+        : `exited with code ${result.exitCode}${result.signal ? ` (signal: ${result.signal})` : ""}`;
+      const stderr = result.stderr?.trim().slice(-2000);
+      throw new Error(
+        `[assetPreprocessing][${jobId}] PDF parse subprocess ${reason}${stderr ? `\n${stderr}` : ""}`,
+      );
+    }
+
+    const output = parsePdfSubprocessOutputSchema.parse(
+      JSON.parse(await fs.readFile(outputPath, "utf8")),
+    );
+    if (!output.ok) {
+      throw new Error(
+        `[assetPreprocessing][${jobId}] Failed to parse PDF: ${output.error}`,
+      );
+    }
+    return { text: output.text, metadata: output.metadata };
+  } finally {
+    await tryCatch(fs.rm(tmpDir, { recursive: true, force: true }));
+  }
+}
```

**File**: `apps/workers/workers/utils/subprocessScript.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+// Resolves how to launch one of the standalone scripts in `apps/workers/scripts`
+// as a separate node process with a bounded heap.
+import { fileURLToPath } from "node:url";
+
+// fileURLToPath rather than `.pathname`, which keeps URL escapes: a checkout in
+// "/home/me/My Projects" would otherwise resolve to ".../My%20Projects/...".
+function getScriptPath(scriptName: string): string {
+  const currentUrl = import.meta.url;
+  if (currentUrl.includes("/dist/")) {
+    // Production: running from built output
+    return fileURLToPath(new URL(`./scripts/${scriptName}.js`, currentUrl));
+  }
+  // Dev mode: running via tsx
+  return fileURLToPath(new URL(`../../scripts/${scriptName}.ts`, currentUrl));
+}
+
+export function getScriptCommand(
+  scriptName: string,
+  maxOldSpaceSizeMb: number,
+): { cmd: string; args: string[] } {
+  const scriptPath = getScriptPath(scriptName);
+  const args = [`--max-old-space-size=${maxOldSpaceSizeMb}`, scriptPath];
+
+  if (scriptPath.endsWith(".ts")) {
+    // Dev mode: use tsx to run TypeScript directly
+    return { cmd: "tsx", args };
+  }
+
+  return { cmd: process.execPath, args };
+}
```

---

### Incident Patch 2: `41de03b6` (2026-11-15)
**Commit Message**: fix(inference): summarize text and asset bookmarks (#3080)

* fix(inference): summarize text and asset bookmarks

Summarization only ever handled `link` bookmarks, and the other two types
failed in different silent ways.

`text`: no summarization job was ever enqueued. `createBookmark`'s TEXT case
enqueued tagging only, while the LINK (crawler) and ASSET (asset preprocessing)
paths both enqueue `type: "summarize"`. A note therefore kept
`summarizationStatus = NULL` forever — never attempted, so nothing surfaced as
a failure either.

`asset`: the job was enqueued, but `runSummarization` returned early for any
non-LINK type. Since that early return is not an error, the worker's
`onComplete` marked the bookmark `summarizationStatus = 'success'` with no
summary. The content was there all along: `assetPreprocessingWorker` writes
extracted PDF (and image) text into `bookmarkAssets.content`, which
`tagging.ts` already consumes.

The warning covering these cases claimed the bookmark "is not a LINK or TEXT
type with content", but TEXT was never handled by that branch.

Prompt building moves into a pure `buildSummarizationInput()` in
`@karakeep/shared` so both the worker and the on-demand `s

**File**: `apps/mobile/app/dashboard/bookmarks/[slug]/info.tsx` (modified, +3/-1)
```diff
@@ -261,7 +261,9 @@ function AISummarySection({
       },
     });
 
-  if (bookmark.content.type !== BookmarkTypes.LINK) {
+  // Unknown bookmarks carry no content relation, so there is nothing to
+  // summarize and the action would always fail.
+  if (bookmark.content.type === BookmarkTypes.UNKNOWN) {
     return null;
   }
 
```

**File**: `apps/web/components/dashboard/bookmarks/SummarizeBookmarkArea.tsx` (modified, +3/-1)
```diff
@@ -142,7 +142,9 @@ export default function SummarizeBookmarkArea({
   });
 
   const clientConfig = useClientConfig();
-  if (bookmark.content.type !== BookmarkTypes.LINK) {
+  // Unknown bookmarks carry no content relation, so there is nothing to
+  // summarize and the action would always fail.
+  if (bookmark.content.type === BookmarkTypes.UNKNOWN) {
     return null;
   }
 
```

**File**: `apps/workers/workers/inference/inferenceWorker.ts` (modified, +64/-9)
```diff
@@ -1,4 +1,4 @@
-import { eq } from "drizzle-orm";
+import { and, eq } from "drizzle-orm";
 
 import type { ZOpenAIRequest } from "@karakeep/shared-server";
 import { db } from "@karakeep/db";
@@ -15,7 +15,7 @@ import { DequeuedJob, getQueueClient } from "@karakeep/shared/queueing";
 
 import { workerStatsCounter } from "../../metrics";
 import { withWorkerEventLog, withWorkerTracing } from "../../workerTracing";
-import { runSummarization } from "./summarize";
+import { runSummarization, SummarizationOutcome } from "./summarize";
 import { runTagging } from "./tagging";
 
 async function attemptMarkStatus(
@@ -41,20 +41,69 @@ async function attemptMarkStatus(
   }
 }
 
+function isSummarizeJob(jobData: object | undefined): boolean {
+  if (!jobData) {
+    return false;
+  }
+  const parsed = zOpenAIRequestSchema.safeParse(jobData);
+  return parsed.success && parsed.data.type === "summarize";
+}
+
+/**
+ * Clears the `pending` status of a job that was skipped without doing any work,
+ * so it does not sit as "summarizing" forever. Mirrors what the crawler does
+ * when a job will never produce a result.
+ */
+async function attemptClearPendingStatus(jobData: object | undefined) {
+  if (!jobData) {
+    return;
+  }
+  try {
+    const request = zOpenAIRequestSchema.parse(jobData);
+    if (request.type !== "summarize") {
+      return;
+    }
+    await db
+      .update(bookmarks)
+      .set({ summarizationStatus: null })
+      .where(
+        and(
+          eq(bookmarks.id, request.bookmarkId),
+          eq(bookmarks.summarizationStatus, "pending"),
+        ),
+      );
+  } catch (e) {
+    logger.error(
+      `Something went wrong when clearing the summarization status: ${e}`,
+    );
+  }
+}
+
 export class OpenAiWorker {
   static async build() {
     logger.info("Starting inference worker ...");
-    const worker = (await getQueueClient())!.createRunner<ZOpenAIRequest>(
+    const worker = (await getQueueClient())!.createRunner<
+      ZOpenAIRequest,
+      SummarizationOutcome | undefined
+    >(
       OpenAIQueue,
       {
         run: withWorkerTracing(
           "inferenceWorker.run",
           withWorkerEventLog("inferenceWorker.run", runOpenAI),
         ),
-        onComplete: async (job) => {
+        onComplete: async (job, result) => {
           workerStatsCounter.labels("inference", "completed").inc();
           const jobId = job.id;
           logger.info(`[inference][${jobId}] Completed successfully`);
+          // A summarization only counts as successful when the job reports it
+          // actually wrote one. Anything else — disabled in the config or by
+          // the user, no content to summarize, no inference client — leaves no
+          // summary behind, so claiming success would be a lie.
+          if (isSummarizeJob(job.data) && result !== "summarized") {
+            await attemptClearPendingStatus(job.data);
+            return;
+          }
           await attemptMarkStatus(job.data, "success");
         },
         onError: async (job) => {
@@ -80,15 +129,22 @@ export class OpenAiWorker {
   }
 }
 
-async function runOpenAI(job: DequeuedJob<ZOpenAIRequest>) {
+async function runOpenAI(
+  job: DequeuedJob<ZOpenAIRequest>,
+): Promise<SummarizationOutcome | undefined> {
   const jobId = job.id;
 
   const inferenceClient = InferenceClientFactory.build();
   if (!inferenceClient) {
     logger.debug(
       `[inference][${jobId}] No inference client configured, nothing to do now`,
     );
-    return;
+    // A summarize job that never reached a model produced no summary, so it
+    // must not be recorded as one. Tagging is left as it was.
+    const parsed = zOpenAIRequestSchema.safeParse(job.data);
+    return parsed.success && parsed.data.type === "summarize"
+      ? "skipped"
+      : undefined;
   }
 
   const request = zOpenAIRequestSchema.safeParse(job.data);
@@ -113,11 +169,10 @@ async function runOpenAI(job: DequeuedJob<ZOpenAIRequest>) {
   });
   switch (request.data.type) {
     case "summarize":
-      await runSummarization(bookmarkId, job, inferenceClient);
-      break;
+      return await runSummarization(bookmarkId, job, inferenceClient);
     case "tag":
       await runTagging(bookmarkId, job, inferenceClient);
-      break;
+      return undefined;
     default:
       throw new Error(`Unknown inference type: ${request.data.type}`);
   }
```

**File**: `apps/workers/workers/inference/summarize.ts` (modified, +42/-38)
```diff
@@ -13,6 +13,7 @@ import { InferenceClient } from "@karakeep/shared/inference";
 import logger from "@karakeep/shared/logger";
 import { buildSummaryPrompt } from "@karakeep/shared/prompts.server";
 import { DequeuedJob } from "@karakeep/shared/queueing";
+import { buildSummarizationInput } from "@karakeep/shared/summarization";
 import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";
 import { Bookmark } from "@karakeep/trpc/models/bookmarks";
 
@@ -35,7 +36,17 @@ async function fetchBookmarkDetailsForSummary(bookmarkId: string) {
           url: true,
         },
       },
-      // If assets (like PDFs with extracted text) should be summarized, extend here
+      text: {
+        columns: {
+          text: true,
+        },
+      },
+      asset: {
+        columns: {
+          content: true,
+          fileName: true,
+        },
+      },
     },
   });
 
@@ -45,16 +56,24 @@ async function fetchBookmarkDetailsForSummary(bookmarkId: string) {
   return bookmark;
 }
 
+/**
+ * Whether a summarization job actually produced a summary.
+ *
+ * A skipped job must not be recorded as a successful summarization: that is what
+ * left asset bookmarks with `summarizationStatus = 'success'` and no summary.
+ */
+export type SummarizationOutcome = "summarized" | "skipped";
+
 export async function runSummarization(
   bookmarkId: string,
   job: DequeuedJob<ZOpenAIRequest>,
   inferenceClient: InferenceClient,
-) {
+): Promise<SummarizationOutcome> {
   if (!serverConfig.inference.enableAutoSummarization) {
     logger.debug(
       `[inference][${job.id}] Skipping summarization job for bookmark with id "${bookmarkId}" because it's disabled in the config.`,
     );
-    return;
+    return "skipped";
   }
   const jobId = job.id;
 
@@ -91,46 +110,29 @@ export async function runSummarization(
     logger.debug(
       `[inference][${jobId}] Skipping summarization job for bookmark with id "${bookmarkId}" because user has disabled auto-summarization.`,
     );
-    return;
+    return "skipped";
   }
 
-  let textToSummarize = "";
-  if (bookmarkData.type === BookmarkTypes.LINK && bookmarkData.link) {
-    const link = bookmarkData.link;
-
-    // Extract plain text content from HTML for summarization
-    let content =
-      (await Bookmark.getBookmarkPlainTextContent(link, bookmarkData.userId)) ??
-      "";
-
-    if (!link.description && !content) {
-      // No content to infer from; skip summarization
-      logger.info(
-        `[inference] No content found for link "${bookmarkId}". Skipping summary.`,
-      );
-      return;
-    }
-
-    textToSummarize = `
-Title: ${link.title ?? ""}
-Description: ${link.description ?? ""}
-Content: ${content}
-Publisher: ${link.publisher ?? ""}
-Author: ${link.author ?? ""}
-URL: ${link.url ?? ""}
-`;
-  } else {
-    logger.warn(
-      `[inference][${jobId}] Bookmark ${bookmarkId} (type: ${bookmarkData.type}) is not a LINK or TEXT type with content, or content is missing. Skipping summary.`,
-    );
-    return;
-  }
+  // Extracting the plain text content of a link hits the asset store, so it's
+  // only resolved for the bookmark type that needs it.
+  const linkPlainTextContent =
+    bookmarkData.type === BookmarkTypes.LINK && bookmarkData.link
+      ? ((await Bookmark.getBookmarkPlainTextContent(
+          bookmarkData.link,
+          bookmarkData.userId,
+        )) ?? "")
+      : "";
+
+  const textToSummarize = buildSummarizationInput(
+    bookmarkData,
+    linkPlainTextContent,
+  );
 
-  if (!textToSummarize.trim()) {
+  if (!textToSummarize) {
     logger.info(
-      `[inference][${jobId}] No content to summarize for bookmark ${bookmarkId}.`,
+      `[inference][${jobId}] No content to summarize for bookmark ${bookmarkId} (type: ${bookmarkData.type}). Skipping summary.`,
     );
-    return;
+    return "skipped";
   }
 
   const prompts = await db.query.customPrompts.findMany({
@@ -190,4 +192,6 @@ URL: ${link.url ?? ""}
     priority: job.priority,
     groupId: bookmarkData.userId,
   });
+
+  return "summarized";
 }
```

**File**: `packages/e2e_tests/tests/workers/inference.test.ts` (modified, +159/-1)
```diff
@@ -2,7 +2,8 @@ import { assert, beforeEach, describe, expect, inject, it } from "vitest";
 
 import { createKarakeepClient } from "@karakeep/sdk";
 
-import { createTestUser } from "../../utils/api";
+import { createTestUser, uploadTestAsset } from "../../utils/api";
+import { createTestPdfFileWithText } from "../../utils/assets";
 import { waitUntil } from "../../utils/general";
 import { getTrpcClient } from "../../utils/trpc";
 
@@ -74,6 +75,163 @@ describe("Inference Worker Tests", () => {
     );
   }, 120000);
 
+  it("auto-summarizes text bookmarks", async () => {
+    await trpc.users.updateSettings.mutate({
+      autoSummarizationEnabled: true,
+    });
+
+    const { data: createdBookmark, error } = await client.POST("/bookmarks", {
+      body: {
+        type: "text",
+        title: "Inference text bookmark",
+        text: "Karakeep should summarize this bookmark through the inference worker.",
+      },
+    });
+
+    if (error) {
+      throw error;
+    }
+    assert(createdBookmark);
+
+    await waitUntil(
+      async () => {
+        const { data: bookmark } = await client.GET("/bookmarks/{bookmarkId}", {
+          params: {
+            path: {
+              bookmarkId: createdBookmark.id,
+            },
+          },
+        });
+
+        return bookmark?.summarizationStatus === "success";
+      },
+      "Text bookmark summarization completes",
+      120000,
+    );
+
+    const { data: bookmark } = await client.GET("/bookmarks/{bookmarkId}", {
+      params: {
+        path: {
+          bookmarkId: createdBookmark.id,
+        },
+      },
+    });
+
+    assert(bookmark);
+    expect(bookmark.summarizationStatus).toBe("success");
+    expect(bookmark.summary).toBe(
+      "This page contains a short Hello World test document used to verify Karakeep's inference worker end-to-end.",
+    );
+  }, 120000);
+
+  it("does not record a summary for a text bookmark with no content", async () => {
+    await trpc.users.updateSettings.mutate({
+      autoSummarizationEnabled: true,
+    });
+
+    const { data: createdBookmark, error } = await client.POST("/bookmarks", {
+      body: {
+        type: "text",
+        title: "Blank note",
+        text: "   ",
+      },
+    });
+
+    if (error) {
+      throw error;
+    }
+    assert(createdBookmark);
+    expect(createdBookmark.summarizationStatus).toBe("pending");
+
+    // The job runs and finds nothing to summarize, so it must clear the pending
+    // state rather than claim a success it never produced.
+    await waitUntil(
+      async () => {
+        const { data: bookmark } = await client.GET("/bookmarks/{bookmarkId}", {
+          params: {
+            path: {
+              bookmarkId: createdBookmark.id,
+            },
+          },
+        });
+
+        return bookmark?.summarizationStatus !== "pending";
+      },
+      "Blank text bookmark summarization settles",
+      120000,
+    );
+
+    const { data: bookmark } = await client.GET("/bookmarks/{bookmarkId}", {
+      params: {
+        path: {
+          bookmarkId: createdBookmark.id,
+        },
+      },
+    });
+
+    assert(bookmark);
+    expect(bookmark.summarizationStatus).toBeNull();
+    expect(bookmark.summary).toBeNull();
+  }, 120000);
+
+  it("auto-summarizes asset bookmarks from their extracted text", async () => {
+    await trpc.users.updateSettings.mutate({
+      autoSummarizationEnabled: true,
+    });
+
+    const upload = await uploadTestAsset(
+      apiKey,
+      port,
+      createTestPdfFileWithText(),
+    );
+
+    const { data: createdBookmark, error } = await client.POST("/bookmarks", {
+      body: {
+        type: "asset",
+        assetType: "pdf",
+        assetId: upload.assetId,
+        fileName: upload.fileName,
+      },
+    });
+
+    if (error) {
+      throw error;
+    }
+    assert(createdBookmark);
+
+    // Asset preprocessing extracts the PDF text first, and only then is a
+    // summarization job enqueued.
+    await waitUntil(
+      async () => {
+        const { data: bookmark } = await client.GET("/bookmarks/{bookmarkId}", {
+          params: {
+            path: {
+              bookmarkId: createdBookmark.id,
+            },
+          },
+        });
+
+        return bookmark?.summarizationStatus === "success";
+      },
+      "Asset bookmark summarization completes",
+      120000,
+    );
+
+    const { data: bookmark } = await client.GET("/bookmarks/{bookmarkId}", {
+      params: {
+        path: {
+          bookmarkId: createdBookmark.id,
+        },
+      },
+    });
+
+    assert(bookmark);
+    expect(bookmark.summarizationStatus).toBe("success");
+    expect(bookmark.summary).toBe(
+      "This page contains a short Hello World test document used to verify Karakeep's inference worker end-to-end.",
+    );
+  }, 120000);
+
   it("auto-tags and summarizes crawled link bookmarks", async () => {
     await trpc.users.updateSettings.mutate({
       autoTaggingEnabled: true,
```

**File**: `packages/e2e_tests/utils/assets.ts` (modified, +20/-0)
```diff
@@ -9,3 +9,23 @@ export function createTestPdfFile(fileName = "test.pdf"): File {
     type: "application/pdf",
   });
 }
+
+const pdfWithTextFixturePath = path.join(
+  __dirname,
+  "..",
+  "fixtures",
+  "test-with-text.pdf",
+);
+const pdfWithTextContent = fs.readFileSync(pdfWithTextFixturePath);
+
+/**
+ * A PDF that actually carries extractable text, so asset preprocessing has
+ * something to put in `bookmarkAssets.content`. `test.pdf` has an empty page.
+ */
+export function createTestPdfFileWithText(
+  fileName = "test-with-text.pdf",
+): File {
+  return new File([pdfWithTextContent], fileName, {
+    type: "application/pdf",
+  });
+}
```

**File**: `packages/shared/summarization.ts` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+import { BookmarkTypes } from "./types/bookmarks";
+
+/**
+ * The bookmark fields summarization needs. Declared explicitly rather than
+ * derived from a drizzle query: drizzle types the `link`/`text`/`asset`
+ * relations as non-nullable, but only the relation matching the bookmark's
+ * `type` is actually present at runtime.
+ */
+export interface SummarizableBookmark {
+  type: string;
+  link?: {
+    title: string | null;
+    description: string | null;
+    publisher: string | null;
+    author: string | null;
+    url: string | null;
+  } | null;
+  text?: {
+    text: string | null;
+  } | null;
+  asset?: {
+    content: string | null;
+    fileName: string | null;
+  } | null;
+}
+
+/**
+ * Builds the text handed to the inference client for a given bookmark.
+ *
+ * Returns `null` when the bookmark carries nothing worth summarizing, so the
+ * caller can skip the inference call instead of sending an empty prompt.
+ *
+ * `linkPlainTextContent` is resolved by the caller because extracting it hits
+ * the asset store, which keeps this function pure and unit testable.
+ */
+export function buildSummarizationInput(
+  bookmark: SummarizableBookmark,
+  linkPlainTextContent: string,
+): string | null {
+  switch (bookmark.type) {
+    case BookmarkTypes.LINK: {
+      const link = bookmark.link;
+      if (!link) {
+        return null;
+      }
+      if (!link.description?.trim() && !linkPlainTextContent.trim()) {
+        return null;
+      }
+      return `
+Title: ${link.title ?? ""}
+Description: ${link.description ?? ""}
+Content: ${linkPlainTextContent}
+Publisher: ${link.publisher ?? ""}
+Author: ${link.author ?? ""}
+URL: ${link.url ?? ""}
+`;
+    }
+    case BookmarkTypes.TEXT: {
+      const content = bookmark.text?.text;
+      if (!content?.trim()) {
+        return null;
+      }
+      return `
+Content: ${content}
+`;
+    }
+    case BookmarkTypes.ASSET: {
+      // Populated by the asset preprocessing worker: extracted PDF text, or
+      // text recovered from an image.
+      const content = bookmark.asset?.content;
+      if (!content?.trim()) {
+        return null;
+      }
+      return `
+Title: ${bookmark.asset?.fileName ?? ""}
+Content: ${content}
+`;
+    }
+    default:
+      return null;
+  }
+}
```

**File**: `packages/trpc/routers/bookmarks.test.ts` (modified, +84/-0)
```diff
@@ -10,6 +10,7 @@ import {
 } from "vitest";
 
 import {
+  bookmarkAssets,
   bookmarkLinks,
   bookmarks,
   rssFeedImportsTable,
@@ -1268,6 +1269,89 @@ describe("Bookmark Routes", () => {
         summarizationStatus: "failure",
       });
     });
+
+    test<CustomTestContext>("summarizes a text bookmark", async ({
+      apiCallers,
+    }) => {
+      inferFromText.mockResolvedValue({
+        response: "A note summary",
+        totalTokens: 10,
+      });
+
+      const created = await apiCallers[0].bookmarks.createBookmark({
+        type: BookmarkTypes.TEXT,
+        text: "A note that is worth summarizing",
+      });
+
+      const result = await apiCallers[0].bookmarks.summarizeBookmark({
+        bookmarkId: created.id,
+      });
+
+      expect(result.summary).toBe("A note summary");
+      const [prompt] = inferFromText.mock.calls[0];
+      expect(prompt).toContain("A note that is worth summarizing");
+    });
+
+    test<CustomTestContext>("summarizes an asset bookmark with extracted content", async ({
+      apiCallers,
+      db,
+    }) => {
+      inferFromText.mockResolvedValue({
+        response: "A pdf summary",
+        totalTokens: 10,
+      });
+
+      // Asset bookmarks in `createBookmark` require a pre-uploaded asset, so
+      // this inserts the bookmark and its (already-extracted) asset content
+      // directly, the same way the asset preprocessing worker would have
+      // left them.
+      const userId = (await apiCallers[0].users.whoami()).id;
+      const [created] = await db
+        .insert(bookmarks)
+        .values({ userId, type: BookmarkTypes.ASSET })
+        .returning();
+      await db.insert(bookmarkAssets).values({
+        id: created.id,
+        assetId: "test-asset-id",
+        assetType: "pdf",
+        fileName: "paper.pdf",
+        content: "The extracted pdf text",
+      });
+
+      const result = await apiCallers[0].bookmarks.summarizeBookmark({
+        bookmarkId: created.id,
+      });
+
+      expect(result.summary).toBe("A pdf summary");
+      const [prompt] = inferFromText.mock.calls[0];
+      expect(prompt).toContain("The extracted pdf text");
+    });
+
+    test<CustomTestContext>("fails with a clear error when there's nothing to summarize yet", async ({
+      apiCallers,
+      db,
+    }) => {
+      // An asset bookmark whose text hasn't been extracted yet (the asset
+      // preprocessing worker hasn't run, or extraction failed).
+      const userId = (await apiCallers[0].users.whoami()).id;
+      const [created] = await db
+        .insert(bookmarks)
+        .values({ userId, type: BookmarkTypes.ASSET })
+        .returning();
+      await db.insert(bookmarkAssets).values({
+        id: created.id,
+        assetId: "test-asset-id-2",
+        assetType: "pdf",
+        fileName: "not-yet-processed.pdf",
+      });
+
+      await expect(
+        apiCallers[0].bookmarks.summarizeBookmark({
+          bookmarkId: created.id,
+        }),
+      ).rejects.toThrow("Nothing to summarize for this bookmark");
+      expect(inferFromText).not.toHaveBeenCalled();
+    });
   });
 
   describe("preserveVideo", () => {
```

---

### Incident Patch 3: `b2bef591` (2026-11-15)
**Commit Message**: fix(workers): stop image OCR and Ollama requests when the job is aborted (#3372)

* fix(workers): stop image OCR when the job is aborted

Tesseract runs in a worker thread that ignored the job's abort signal: a
timed-out OCR kept a core busy until it finished on its own (minutes for a
large, noisy image), and the retry started another one next to it. The
worker is now terminated as soon as the job aborts.

Aborts are also rethrown instead of being logged and ignored, so a timed-out
job stops rather than going on to enqueue tagging and indexing next to its
retry, and the LLM OCR request gets the signal too.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(workers): cover image OCR cancellation

Move readImageText into workers/utils/imageOcr.ts and test it against a fake
tesseract worker. The mid-OCR abort tests fail if recognize() is awaited
directly again, which is the change that brought back the worker pile-up.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(inference): don't start an Ollama request with an aborted signal

The Ollama client only cancels through the signal's onabort handler, which
never fires for a signal that has already aborted, and generat

**File**: `apps/workers/workers/assetPreprocessingWorker.ts` (modified, +33/-5)
```diff
@@ -118,35 +118,52 @@ export class AssetPreprocessingWorker {
   }
 }
 
-async function readImageText(buffer: Buffer) {
+async function readImageText(buffer: Buffer, abortSignal: AbortSignal) {
   if (serverConfig.ocr.langs.length == 1 && serverConfig.ocr.langs[0] == "") {
     return null;
   }
   const { createWorker } = await import("tesseract.js");
   const worker = await createWorker(serverConfig.ocr.langs, undefined, {
     cachePath: serverConfig.ocr.cacheDir ?? os.tmpdir(),
   });
+  // OCR runs in a worker thread that keeps going after the job times out.
+  // terminate() (in the finally) stops it at once, but then recognize()'s
+  // promise never settles, so it's raced against the abort.
+  let onAbort: () => void = () => undefined;
+  const aborted = new Promise<never>((_, reject) => {
+    onAbort = () =>
+      reject(
+        abortSignal.reason instanceof Error
+          ? abortSignal.reason
+          : new Error("Image OCR aborted"),
+      );
+    abortSignal.addEventListener("abort", onAbort, { once: true });
+  });
   try {
-    const ret = await worker.recognize(buffer);
+    // The signal may have fired while the worker was starting up.
+    abortSignal.throwIfAborted();
+    const ret = await Promise.race([worker.recognize(buffer), aborted]);
     if (ret.data.confidence <= serverConfig.ocr.confidenceThreshold) {
       return null;
     }
     return ret.data.text;
   } finally {
+    abortSignal.removeEventListener("abort", onAbort);
     await worker.terminate();
   }
 }
 
 async function readImageTextWithLLM(
   buffer: Buffer,
   contentType: string,
+  abortSignal: AbortSignal,
 ): Promise<string | null> {
   const inferenceClient = InferenceClientFactory.build();
   if (!inferenceClient) {
     logger.warn(
       "[assetPreprocessing] LLM OCR is enabled but no inference client is configured. Falling back to Tesseract.",
     );
-    return readImageText(buffer);
+    return readImageText(buffer, abortSignal);
   }
 
   const base64 = buffer.toString("base64");
@@ -158,6 +175,7 @@ async function readImageTextWithLLM(
     base64,
     {
       schema: null,
+      abortSignal,
     },
   );
 
@@ -267,6 +285,7 @@ async function extractAndSaveImageText(
   contentType: string,
   bookmark: NonNullable<Awaited<ReturnType<typeof getBookmark>>>,
   isFixMode: boolean,
+  abortSignal: AbortSignal,
 ): Promise<boolean> {
   {
     const alreadyHasText = !!bookmark.asset.content;
@@ -284,8 +303,13 @@ async function extractAndSaveImageText(
       `[assetPreprocessing][${jobId}] Attempting to extract text from image using LLM OCR.`,
     );
     try {
-      imageText = await readImageTextWithLLM(asset, contentType);
+      imageText = await readImageTextWithLLM(asset, contentType, abortSignal);
     } catch (e) {
+      // A timed-out job must stop here, not carry on and enqueue follow-up
+      // work next to its own retry.
+      if (abortSignal.aborted) {
+        throw e;
+      }
       logger.error(
         `[assetPreprocessing][${jobId}] Failed to read image text with LLM: ${e}`,
       );
@@ -295,8 +319,11 @@ async function extractAndSaveImageText(
       `[assetPreprocessing][${jobId}] Attempting to extract text from image using Tesseract.`,
     );
     try {
-      imageText = await readImageText(asset);
+      imageText = await readImageText(asset, abortSignal);
     } catch (e) {
+      if (abortSignal.aborted) {
+        throw e;
+      }
       logger.error(
         `[assetPreprocessing][${jobId}] Failed to read image text: ${e}`,
       );
@@ -424,6 +451,7 @@ async function run(req: DequeuedJob<AssetPreprocessingRequest>) {
         metadata.contentType,
         bookmark,
         isFixMode,
+        req.abortSignal,
       );
       anythingChanged ||= extractedText;
       break;
```

**File**: `packages/shared/inference.test.ts` (modified, +70/-1)
```diff
@@ -1,7 +1,7 @@
 import { beforeEach, describe, expect, it, vi } from "vitest";
 import { z } from "zod";
 
-import { OpenAIInferenceClient } from "./inference";
+import { OllamaInferenceClient, OpenAIInferenceClient } from "./inference";
 import type { OpenAIInferenceConfig } from "./inference";
 
 const capturedBodies: Record<string, unknown>[] = [];
@@ -29,6 +29,17 @@ vi.mock("openai", () => {
   return { default: OpenAIMock };
 });
 
+const ollamaMocks = vi.hoisted(() => ({
+  generate: vi.fn(),
+  abort: vi.fn(),
+}));
+
+vi.mock("ollama", () => ({
+  Ollama: vi.fn().mockImplementation(function () {
+    return { generate: ollamaMocks.generate, abort: ollamaMocks.abort };
+  }),
+}));
+
 vi.mock("openai/helpers/zod", () => ({
   zodResponseFormat: (schema: unknown, name: string) => ({
     type: "json_schema",
@@ -165,3 +176,61 @@ describe("OpenAIInferenceClient response handling", () => {
     ).rejects.toThrow(/refused the request: I can't help with that/);
   });
 });
+
+describe("OllamaInferenceClient abort handling", () => {
+  const makeClient = () =>
+    new OllamaInferenceClient({
+      baseUrl: "http://ollama.test",
+      textModel: "test-text-model",
+      imageModel: "test-image-model",
+      contextLength: 2048,
+      maxOutputTokens: 1024,
+      outputSchema: "plain",
+    });
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    ollamaMocks.generate.mockImplementation(async () =>
+      (async function* () {
+        yield { response: "some text", eval_count: 2, prompt_eval_count: 3 };
+      })(),
+    );
+  });
+
+  it("doesn't start a request when the signal has already aborted", async () => {
+    const controller = new AbortController();
+    controller.abort(new Error("Job timed out"));
+
+    await expect(
+      makeClient().inferFromImage("prompt", "image/png", "aGVsbG8=", {
+        abortSignal: controller.signal,
+      }),
+    ).rejects.toThrow("Job timed out");
+    expect(ollamaMocks.generate).not.toHaveBeenCalled();
+  });
+
+  it("aborts the in-flight request when the signal fires", async () => {
+    const controller = new AbortController();
+    ollamaMocks.generate.mockImplementation(async () => {
+      controller.abort(new Error("Job timed out"));
+      return (async function* () {
+        yield { response: "partial" };
+      })();
+    });
+
+    await makeClient().inferFromText("prompt", {
+      abortSignal: controller.signal,
+    });
+    expect(ollamaMocks.abort).toHaveBeenCalledOnce();
+  });
+
+  it("runs normally with a live signal", async () => {
+    await expect(
+      makeClient().inferFromText("prompt", {
+        abortSignal: new AbortController().signal,
+      }),
+    ).resolves.toEqual({ response: "some text", totalTokens: 5 });
+    expect(ollamaMocks.generate).toHaveBeenCalledOnce();
+    expect(ollamaMocks.abort).not.toHaveBeenCalled();
+  });
+});
```

**File**: `packages/shared/inference.ts` (modified, +6/-1)
```diff
@@ -450,7 +450,7 @@ export interface OllamaInferenceConfig {
   outputSchema: "structured" | "json" | "plain";
 }
 
-class OllamaInferenceClient implements InferenceClient {
+export class OllamaInferenceClient implements InferenceClient {
   ollama: Ollama;
   private config: OllamaInferenceConfig;
 
@@ -485,6 +485,11 @@ class OllamaInferenceClient implements InferenceClient {
       ..._opts,
     };
 
+    // The request is only cancelled through `onabort` below, which never fires
+    // for a signal that has already aborted (e.g. the job timed out before
+    // getting here), so check it up front.
+    optsWithDefaults.abortSignal?.throwIfAborted();
+
     let newAbortSignal = undefined;
     if (optsWithDefaults.abortSignal) {
       newAbortSignal = AbortSignal.any([optsWithDefaults.abortSignal]);
```

#### Recent Merged Pull Requests:
- **PR #3376** (2026-11-15): fix(mobile): show loading skeletons on cards while crawling and tagging (@MohamedBassem)
- **PR #3374** (2026-11-15): feat(workers): run video downloads and asset preprocessing in the remote sandbox (@MohamedBassem)
- **PR #3373** (2026-11-15): fix: poll old bookmarks after a recrawl until it finishes (@MohamedBassem)
- **PR #3372** (2026-11-15): fix(workers): stop image OCR and Ollama requests when the job is aborted (@MohamedBassem)
- **PR #3371** (2026-11-15): feat(web): offer the immersive reader from the preview's view menu (@MohamedBassem)
- **PR #3370** (2026-11-15): fix(sdk): make the published package loadable from Node again (@MohamedBassem)

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

## X. workers): parse PDFs with pdf.js in a subprocess

**RULE**:
When implementing operations in `apps/workers/package.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in karakeep-app/karakeep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8e09a55c`: workers): parse PDFs with pdf.js in a subprocess. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/workers/package.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    "pdfjs-dist": "6.4.299",
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    "pdf2json": "^3.1.5",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8e09a55c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
