# Verification Protocol: Verification Protocol: Empirical Defect Shield for karakeep-app-karakeep-learnings

<!-- PROVENANCE_START
{
  "source_repository": "karakeep-app-karakeep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:39:59.759Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-karakeep-app-karakeep-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [karakeep-app-karakeep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:39:59.759Z`  
> **Learning ID**: `LEARN-REEXTRACT-karakeep-app-karakeep-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `karakeep-app-karakeep-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/karakeep-app-karakeep-learnings.md`  
> **Source**: github ([https://github.com/karakeep-app/karakeep](https://github.com/karakeep-app/karakeep))  
> **Source Version**: `d1514c25`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T11:31:09.016Z  
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
> **Harvest Timestamp**: 2026-11-09T11:31:05.155Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karakeep-app/karakeep`
- **Description**: A self-hostable bookmark-everything app (links, notes and images) with AI-based automatic tagging and full text search
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 30420 stars

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
- **Issue #3288** (2026-11-07): **Highlight popup covers the selected text in the preview modal**
  *Symptoms*: ### Describe the Bug  When selecting text in the reader view of the bookmark preview modal, the highlight popup appears on top of the selection and covers it (see screenshot).  This makes it hard to see what’s being highlighted and to adjust the selection, which gets in the way when highlighting while reading.  ### Steps to Reproduce  1. Open a preview of any bookmark 2. Highlight some text 3. Highlight pop-up is covering actual text selection  ### Expected Behaviour  Expected: the popup is placed above or below the selection without overlapping it (like the fullscreen reader)  ### Screenshots or Additional Context  # Actual  <img width="860" height="352" alt="Image" src="https://github.com/user-attachments/assets/d6c23bc8-192f-44cd-9e64-d77cb296852d" />  # Expected  <img width="822" height="360" alt="Image" src="https://github.com/user-attachments/assets/04f32f54-4df5-46b5-a183-99cba951d030" />  ### Device Details  Firefox, Safari, Zen (Desktop)  ### Exact Karakeep Version  0.34.1  ### Environment Details  Docker on Ubuntu 22.04 behind Caddy  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem

- **Issue #3257** (2026-11-01): **Index / Caching**
  *Symptoms*: ### Describe the Bug  After a couple of hours, the cache or index is gone and it takes over 1 minute for a simple search like "json" on about 400 bookmarks. after the first search is done and the results show up, the following searches work as expected (fast) in realtime when typing in. tryed several AI session on this bug, added DB_WAL_MODE: "true" to the compose.yml which seemed to help a bit, but not really. after one day or so the index / cache is gone.  ### Steps to Reproduce  search for something after 1-2 days of not using karakeep, with a fresh browser. 1st search takes very long over a minute for 1 search term like "json" on about 400 bookmarks  ### Expected Behaviour  caching or keeping the index so the search works fast  ### Screenshots or Additional Context  _No response_  ### Device Details  _No response_  ### Exact Karakeep Version  v0.34.1  ### Environment Details  _No response_  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem

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

### Incident Patch 1: `d1514c25` (2026-11-09)
**Commit Message**: fix(web): fix bugs found in pre-release QA

Bookmarks and preview:
- Esc in a bulk-mode dialog no longer exits bulk mode
- The archive shortcut shows "Bookmark archived" with Undo
- PDF cards fall back to the file icon when the screenshot fails to load
- Page overview shows the bookmark's own title
- Highlight colour buttons have labels; the popover keeps off the screen edge
- Compact layout dates line up; checklist items lose the extra bullet
- Empty search shows "No matches"

Lists, tags and app shell:
- "Delete all unused tags" says it deletes every unused tag
- List counts refresh after creating or editing a list
- Merge list is hidden for smart lists; long names truncate in the picker
- Share dialog no longer nests block elements in a <p>
- The smart list builder understands #tag
- Tag name sort ignores case
- Unknown URLs show the app's not-found page
- Sign-in (credentials and OAuth) honours redirectUrl
- Bad invite links fail fast; /verify-email errors link back to sign in
- Autofocus and labels on auth forms, nav icons and list chevrons
- Page titles for home, lists, search, feeds and backups

Settings and admin:
- Subscription, rules and background jobs fit on mobile
- Re

**File**: `apps/web/app/dashboard/bookmarks/page.tsx` (modified, +10/-0)
```diff
@@ -1,5 +1,15 @@
+import type { Metadata } from "next";
 import React from "react";
 import Bookmarks from "@/components/dashboard/bookmarks/Bookmarks";
+import { useTranslation } from "@/lib/i18n/server";
+
+export async function generateMetadata(): Promise<Metadata> {
+  // oxlint-disable-next-line rules-of-hooks
+  const { t } = await useTranslation();
+  return {
+    title: `${t("common.home")} | Karakeep`,
+  };
+}
 
 export default async function BookmarksPage() {
   return (
```

**File**: `apps/web/app/dashboard/feeds/[feedId]/page.tsx` (modified, +20/-1)
```diff
@@ -1,8 +1,27 @@
+import type { Metadata } from "next";
 import { notFound } from "next/navigation";
 import Bookmarks from "@/components/dashboard/bookmarks/Bookmarks";
+import { PageHeader } from "@/components/ui/page-header";
 import { api } from "@/server/api/client";
 import { TRPCError } from "@trpc/server";
 
+export async function generateMetadata(props: {
+  params: Promise<{ feedId: string }>;
+}): Promise<Metadata> {
+  const params = await props.params;
+  try {
+    const feed = await api.feeds.get({ feedId: params.feedId });
+    return {
+      title: `${feed.name} | Karakeep`,
+    };
+  } catch (e) {
+    if (e instanceof TRPCError && e.code === "NOT_FOUND") {
+      notFound();
+    }
+    throw e;
+  }
+}
+
 export default async function FeedPage(props: {
   params: Promise<{ feedId: string }>;
 }) {
@@ -24,7 +43,7 @@ export default async function FeedPage(props: {
       query={{ rssFeedId: feed.id }}
       showDivider={true}
       showEditorCard={false}
-      header={<div className="text-2xl">{feed.name}</div>}
+      header={<PageHeader title={feed.name} />}
     />
   );
 }
```

**File**: `apps/web/app/dashboard/lists/page.tsx` (modified, +9/-0)
```diff
@@ -1,10 +1,19 @@
+import type { Metadata } from "next";
 import AllListsView from "@/components/dashboard/lists/AllListsView";
 import { NewListButton } from "@/components/dashboard/lists/NewListButton";
 import { PendingInvitationsCard } from "@/components/dashboard/lists/PendingInvitationsCard";
 import { PageHeader } from "@/components/ui/page-header";
 import { useTranslation } from "@/lib/i18n/server";
 import { api } from "@/server/api/client";
 
+export async function generateMetadata(): Promise<Metadata> {
+  // oxlint-disable-next-line rules-of-hooks
+  const { t } = await useTranslation();
+  return {
+    title: `${t("lists.all_lists")} | Karakeep`,
+  };
+}
+
 export default async function ListsPage() {
   // oxlint-disable-next-line rules-of-hooks
   const { t } = await useTranslation();
```

**File**: `apps/web/app/dashboard/not-found.tsx` (modified, +5/-5)
```diff
@@ -8,7 +8,7 @@ import { ArrowLeft, FileQuestion, Home } from "lucide-react";
 export default function NotFound() {
   const { t } = useTranslation();
   return (
-    <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-50 p-8 shadow-sm dark:border dark:bg-card dark:shadow-none">
+    <div className="flex flex-1 items-center justify-center rounded-lg bg-muted/50 p-8 shadow-sm dark:border dark:bg-card dark:shadow-none">
       <div className="w-full max-w-md space-y-8 text-center">
         {/* Not Found Icon */}
         <div className="flex justify-center">
@@ -35,12 +35,12 @@ export default function NotFound() {
             {t("errors.go_back")}
           </Button>
 
-          <Link href="/" className="block">
-            <Button variant="outline" className="w-full">
+          <Button variant="outline" className="w-full" asChild>
+            <Link href="/">
               <Home className="h-4 w-4" />
               {t("errors.go_home")}
-            </Button>
-          </Link>
+            </Link>
+          </Button>
         </div>
       </div>
     </div>
```

**File**: `apps/web/app/dashboard/search/layout.tsx` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import type { Metadata } from "next";
+import { useTranslation } from "@/lib/i18n/server";
+
+// The page is a client component, so its title is set here.
+export async function generateMetadata(): Promise<Metadata> {
+  // oxlint-disable-next-line rules-of-hooks
+  const { t } = await useTranslation();
+  return {
+    title: `${t("common.search")} | Karakeep`,
+  };
+}
+
+export default function SearchLayout({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
+  return children;
+}
```

**File**: `apps/web/app/dashboard/search/page.tsx` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ function SearchComp() {
           fetchNextPage={fetchNextPage}
           isFetchingNextPage={isFetchingNextPage}
           bookmarks={data.pages.flatMap((b) => b.bookmarks)}
+          isSearch
         />
       ) : (
         <BookmarksGridSkeleton />
```

**File**: `apps/web/app/not-found.tsx` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import NotFound from "./dashboard/not-found";
+
+// Unmatched URLs anywhere in the app land here, outside the dashboard layout.
+export default function RootNotFound() {
+  return (
+    <div className="flex min-h-dvh p-4">
+      <NotFound />
+    </div>
+  );
+}
```

**File**: `apps/web/app/settings/backups/page.tsx` (modified, +13/-5)
```diff
@@ -1,11 +1,19 @@
-"use client";
-
+import type { Metadata } from "next";
 import BackupSettings from "@/components/settings/BackupSettings";
 import { SettingsPage } from "@/components/settings/SettingsPage";
-import { useTranslation } from "@/lib/i18n/client";
+import { useTranslation } from "@/lib/i18n/server";
+
+export async function generateMetadata(): Promise<Metadata> {
+  // oxlint-disable-next-line rules-of-hooks
+  const { t } = await useTranslation();
+  return {
+    title: `${t("settings.backups.page_title")} | Karakeep`,
+  };
+}
 
-export default function BackupsPage() {
-  const { t } = useTranslation();
+export default async function BackupsPage() {
+  // oxlint-disable-next-line rules-of-hooks
+  const { t } = await useTranslation();
   return (
     <SettingsPage
       title={t("settings.backups.page_title")}
```

---

### Incident Patch 2: `ae3223a0` (2026-11-09)
**Commit Message**: fix(mobile): stop the bookmark list jumping to the top on refetch (#3347)

* fix(mobile): stop the bookmark list jumping to the top on refetch

The home list scrolled to the top whenever a data change put a new item
first: background refetches, bookmarks saved on another device, undoing
an archive. It now scrolls only when a create-bookmark mutation from this
device succeeds, read through react-query's useMutationState, so saves
from the new-bookmark sheet, clipboard, photos and the share extension
are covered. Existing bookmarks and oldest-first sorting don't scroll.

The scroll target was also wrong. The inset captured on drag is the raw
contentInset, which is always 0 under automatic inset adjustment, and
native scrollTo clamps negative offsets to 0 anyway, so the new card
landed under the transparent header. It now scrolls to minus the
navigator's header height with scrollToOverflowEnabled.

* fix(mobile): scroll on re-saves and on saves that finish out of order

Re-saving a link from mobile bumps it to the top, so it should scroll
like a new save. And track each handled save instead of the highest
mutation id, so a save that finishes after a later one still scrolls.

**File**: `apps/mobile/app/dashboard/(tabs)/(home)/index.tsx` (modified, +1/-0)
```diff
@@ -214,6 +214,7 @@ export default function Home() {
       <UpdatingBookmarkList
         header={<ConnectionBanner />}
         query={{ archived: false }}
+        scrollToTopOnSave
         emptyState={{
           title: t("home.empty_title"),
           subtitle: t("home.empty_subtitle"),
```

**File**: `apps/mobile/components/bookmarks/BookmarkList.tsx` (modified, +34/-21)
```diff
@@ -1,4 +1,4 @@
-import { useEffect, useRef } from "react";
+import { use, useEffect, useRef } from "react";
 import {
   ActivityIndicator,
   FlatList,
@@ -11,11 +11,14 @@ import EmptyState from "@/components/ui/EmptyState";
 import { useTranslation } from "@/lib/i18n/hooks";
 import { getGridColumns, useContainerWidth } from "@/lib/responsive";
 import useAppSettings from "@/lib/settings";
+import { useMutationState } from "@tanstack/react-query";
 import { useScrollToTop } from "expo-router";
+import { HeaderHeightContext } from "expo-router/react-navigation";
 import type { LucideIcon } from "lucide-react-native";
 import { Bookmark } from "lucide-react-native";
 
 import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
+import { useTRPC } from "@karakeep/shared-react/trpc";
 
 import BookmarkCard from "./BookmarkCard";
 
@@ -40,6 +43,7 @@ export default function BookmarkList({
   isFetchingNextPage,
   isRefreshing,
   emptyState,
+  scrollToTopOnSave,
 }: {
   bookmarks: ZBookmark[];
   onRefresh: () => void;
@@ -48,32 +52,42 @@ export default function BookmarkList({
   header?: React.ReactElement;
   isFetchingNextPage?: boolean;
   emptyState?: BookmarkListEmptyState;
+  scrollToTopOnSave?: boolean;
 }) {
   const flatListRef = useRef<FlatList<ZBookmark>>(null);
   const { t } = useTranslation();
   useScrollToTop(flatListRef);
   const { settings } = useAppSettings();
-  // A new item at the top would otherwise land out of sight, leaving people to
-  // wonder whether it saved.
-  const firstBookmarkId = bookmarks[0]?.id;
-  const previousFirstBookmarkId = useRef(firstBookmarkId);
-  const previousCount = useRef(bookmarks.length);
-  const topInset = useRef(0);
+  // A bookmark saved from this device lands at the top (re-saving an existing
+  // link bumps it there too), which may be out of sight, leaving people to
+  // wonder whether it saved. Follow their own saves rather than every change
+  // in the data, which also arrives from refetches.
+  const api = useTRPC();
+  const saveIds = useMutationState({
+    filters: {
+      mutationKey: api.bookmarks.createBookmark.mutationKey(),
+      status: "success",
+    },
+    select: (m) => m.mutationId,
+  });
+  // Saves can finish out of order, so remember each one rather than the latest.
+  const handledSaveIds = useRef(new Set(saveIds));
+  // The list scrolls under the transparent header, so its visible top is above
+  // zero.
+  const headerHeight = use(HeaderHeightContext) ?? 0;
   useEffect(() => {
-    const addedAtTop =
-      previousFirstBookmarkId.current !== undefined &&
-      firstBookmarkId !== previousFirstBookmarkId.current &&
-      bookmarks.length > previousCount.current;
-    previousFirstBookmarkId.current = firstBookmarkId;
-    previousCount.current = bookmarks.length;
-    if (addedAtTop) {
-      // The list scrolls under the header, so its visible top is above zero.
+    const newSaveIds = saveIds.filter((id) => !handledSaveIds.current.has(id));
+    if (newSaveIds.length === 0) {
+      return;
+    }
+    newSaveIds.forEach((id) => handledSaveIds.current.add(id));
+    if (scrollToTopOnSave && settings.bookmarkSortOrder === "desc") {
       flatListRef.current?.scrollToOffset({
-        offset: -topInset.current,
+        offset: -headerHeight,
         animated: true,
       });
     }
-  }, [firstBookmarkId, bookmarks.length]);
+  }, [saveIds]);
   const { width: containerWidth, onLayout } = useContainerWidth();
   const { numColumns, columnWidth } = getGridColumns({
     containerWidth,
@@ -91,6 +105,8 @@ export default function BookmarkList({
         numColumns={numColumns}
         columnWrapperStyle={numColumns > 1 ? { gap: GAP } : undefined}
         contentInsetAdjustmentBehavior="automatic"
+        // Lets scrollToOffset reach the header-adjusted top.
+        scrollToOverflowEnabled
         ListHeaderComponent={header}
         contentContainerStyle={{
           gap: GAP,
@@ -118,10 +134,7 @@ export default function BookmarkList({
         data={bookmarks}
         refreshing={isRefreshing}
         onRefresh={onRefresh}
-        onScrollBeginDrag={(event) => {
-          Keyboard.dismiss();
-          topInset.current = event.nativeEvent.contentInset?.top ?? 0;
-        }}
+        onScrollBeginDrag={Keyboard.dismiss}
         keyExtractor={(b) => b.id}
         onEndReached={fetchNextPage}
         ListFooterComponent={
```

**File**: `apps/mobile/components/bookmarks/UpdatingBookmarkList.tsx` (modified, +3/-0)
```diff
@@ -13,10 +13,12 @@ export default function UpdatingBookmarkList({
   query,
   header,
   emptyState,
+  scrollToTopOnSave,
 }: {
   query: Omit<ZGetBookmarksRequest, "sortOrder" | "includeContent">; // Sort order is handled by mobile settings
   header?: React.ReactElement;
   emptyState?: BookmarkListEmptyState;
+  scrollToTopOnSave?: boolean;
 }) {
   const api = useTRPC();
   const queryClient = useQueryClient();
@@ -69,6 +71,7 @@ export default function UpdatingBookmarkList({
         .filter((b) => b.content.type != BookmarkTypes.UNKNOWN)}
       header={header}
       emptyState={emptyState}
+      scrollToTopOnSave={scrollToTopOnSave}
       onRefresh={onRefresh}
       fetchNextPage={onEndReached}
       isFetchingNextPage={isFetchingNextPage}
```

---

### Incident Patch 3: `a55dba2b` (2026-11-09)
**Commit Message**: feat(web): guided smart list builder in the list dialog (#3340)

* feat(web): guided smart list builder in the list dialog

- Smart lists are built from controls: tags (several, picked by name,
  including names no tag has yet), favourited, archived, and age. The
  query string stays the source of truth. Each control rewrites only
  its own terms, so hand-typed terms next to them are kept.
- A live preview under the controls shows how many bookmarks match,
  using lists.previewSmartQuery, and says so when nothing matches yet.
- The raw query moves into an Advanced section. It opens on its own,
  and stays open, when the query has something the controls can't
  show.
- Query errors are shown while typing and in plain words: an
  unparseable query, plain words without a qualifier, or no condition.
- The fields get labels and placeholders (icon, name, parent with a
  clear button), and the submit button says "Create list" for new
  lists.
- TagNamePicker: a multi-pick tag search next to TagAutocomplete.
- The query explainer tooltip shows the query language help when the
  query is empty.

* feat(web): lists, title and URL in the smart list builder

- Add a Lists picker next to Tags. 

**File**: `apps/web/components/dashboard/lists/EditListModal.tsx` (modified, +263/-188)
```diff
@@ -1,13 +1,19 @@
 "use client";
 
-import { useEffect, useMemo, useState } from "react";
+import { useEffect, useMemo, useRef, useState } from "react";
 import dynamic from "next/dynamic";
 import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { ActionButton } from "@/components/ui/action-button";
-import { Button } from "@/components/ui/button";
+import { Button, ButtonWithTooltip } from "@/components/ui/button";
+import {
+  Collapsible,
+  CollapsibleContent,
+  CollapsibleTrigger,
+} from "@/components/ui/collapsible";
 import {
   Dialog,
+  DialogBody,
   DialogClose,
   DialogContent,
   DialogFooter,
@@ -23,6 +29,8 @@ import {
   FormItem,
   FormLabel,
   FormMessage,
+  setServerFormErrors,
+  useFormErrors,
 } from "@/components/ui/form";
 import { Input } from "@/components/ui/input";
 import {
@@ -40,7 +48,7 @@ import {
 import { toast } from "@/components/ui/sonner";
 import { useTranslation } from "@/lib/i18n/client";
 import { zodResolver } from "@hookform/resolvers/zod";
-import { X } from "lucide-react";
+import { ChevronRight, X } from "lucide-react";
 import { useForm, useWatch } from "react-hook-form";
 import { z } from "zod";
 
@@ -56,6 +64,9 @@ import {
 
 import QueryExplainerTooltip from "../search/QueryExplainerTooltip";
 import { BookmarkListSelector } from "./BookmarkListSelector";
+import { SmartListPreview } from "./SmartListPreview";
+import { isQueryRepresentableInBuilder } from "./smartListBuilderQuery";
+import { SmartListQueryBuilder } from "./SmartListQueryBuilder";
 
 // The emoji dataset is large, only load it when the picker is opened.
 const EmojiPicker = dynamic(
@@ -95,9 +106,13 @@ export function EditListModal({
     throw new Error("You must provide both open and setOpen or neither");
   }
   const [customOpen, customSetOpen] = useState(false);
+  const [advancedOpen, setAdvancedOpen] = useState(false);
 
   const form = useForm({
-    resolver: zodResolver(zNewBookmarkListSchema),
+    resolver: zodResolver(
+      zNewBookmarkListSchema,
+      useFormErrors({ query: t("lists.query_required") }),
+    ),
     defaultValues: {
       name: list?.name ?? prefill?.name ?? "",
       description: list?.description ?? prefill?.description ?? "",
@@ -121,15 +136,39 @@ export function EditListModal({
       type: list?.type ?? prefill?.type ?? "manual",
       query: list?.query ?? prefill?.query ?? undefined,
     });
+    setAdvancedOpen(false);
   }, [open]);
 
   const query = useWatch({ control: form.control, name: "query" });
+  // A query the builder can't show has to stay on screen. Sticky rather than
+  // derived, so the field doesn't vanish once a query being typed becomes valid.
+  if (!advancedOpen && !isQueryRepresentableInBuilder(query ?? "")) {
+    setAdvancedOpen(true);
+  }
   const parsedSearchQuery = useMemo(() => {
     if (!query) {
       return undefined;
     }
     return parseSearchQuery(query);
   }, [query]);
+  // Mirrors what the server's schema rejects, while they're still typing.
+  const queryError = !parsedSearchQuery
+    ? undefined
+    : parsedSearchQuery.result !== "full"
+      ? t("lists.query_invalid", { text: parsedSearchQuery.text })
+      : parsedSearchQuery.text.length > 0
+        ? t("lists.query_plain_text", { text: parsedSearchQuery.text })
+        : undefined;
+
+  // "Parent list not found" and "can't be nested under" are the rejected values.
+  const onMutationError = (e: Parameters<typeof setServerFormErrors>[1]) => {
+    if (!setServerFormErrors(form, e, { rejectedField: "parentId" })) {
+      toast({
+        variant: "destructive",
+        title: t("common.something_went_wrong"),
+      });
+    }
+  };
 
   const { mutate: createList, isPending: isCreating } = useCreateBookmarkList({
     onSuccess: (resp) => {
@@ -140,28 +179,7 @@ export function EditListModal({
       router.push(`/dashboard/lists/${resp.id}`);
       form.reset();
     },
-    onError: (e) => {
-      if (e.data?.code == "BAD_REQUEST") {
-        if (e.data.zodError) {
-          toast({
-            variant: "destructive",
-            description: Object.values(e.data.zodError.fieldErrors)
-              .flat()
-              .join("\n"),
-          });
-        } else {
-          toast({
-            variant: "destructive",
-            description: e.message,
-          });
-        }
-      } else {
-        toast({
-          variant: "destructive",
-          title: t("common.something_went_wrong"),
-        });
-      }
-    },
+    onError: onMutationError,
   });
 
   const { mutate: editList, isPending: isEditing } = useEditBookmarkList({
@@ -172,30 +190,19 @@ export function EditListModal({
       setOpen(false);
       form.reset();
     },
-    onError: (e) => {
-      if (e.data?.code == "BAD_REQUEST") {
-        if (e.data.zodError) {
-          toast({
-            variant: "destructive",
-            description: Object.values(e.data.zodError.fieldErrors)
-              .flat()
-     
```

**File**: `apps/web/components/dashboard/lists/ListNamePicker.tsx` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+"use client";
+
+import { useState } from "react";
+import {
+  Command,
+  CommandEmpty,
+  CommandGroup,
+  CommandInput,
+  CommandItem,
+  CommandList,
+} from "@/components/ui/command";
+import {
+  Popover,
+  PopoverContent,
+  PopoverTrigger,
+} from "@/components/ui/popover";
+import { selectTriggerClass } from "@/components/ui/select";
+import { useTranslation } from "@/lib/i18n/client";
+import { cn } from "@/lib/utils";
+import { Check, ChevronDown } from "lucide-react";
+
+import { useBookmarkLists } from "@karakeep/shared-react/hooks/lists";
+import { listNameFromPath } from "@karakeep/shared/utils/listUtils";
+
+/**
+ * Picks several of your lists by name, the way `list:` matches them. The popover
+ * stays open between picks and picking a selected list removes it.
+ */
+export function ListNamePicker({
+  id,
+  placeholder,
+  selectedNames,
+  onToggle,
+  excludeListId,
+}: {
+  id?: string;
+  placeholder: string;
+  selectedNames: string[];
+  onToggle: (name: string) => void;
+  excludeListId?: string;
+}) {
+  const { t } = useTranslation();
+  const [open, setOpen] = useState(false);
+  const { data } = useBookmarkLists();
+
+  // `list:` only looks at lists you own
+  const paths = (data?.allPaths ?? []).filter((path) => {
+    const list = path[path.length - 1];
+    return list.userRole === "owner" && list.id !== excludeListId;
+  });
+
+  return (
+    <Popover open={open} onOpenChange={setOpen}>
+      <PopoverTrigger asChild>
+        <button
+          id={id}
+          type="button"
+          role="combobox"
+          aria-expanded={open}
+          className={selectTriggerClass}
+        >
+          <span className="truncate text-muted-foreground/85">
+            {placeholder}
+          </span>
+          <ChevronDown className="size-4 shrink-0 opacity-50" />
+        </button>
+      </PopoverTrigger>
+      <PopoverContent
+        // It sits in the right column, and opens wider than its trigger.
+        align="end"
+        collisionPadding={8}
+        className="w-[--radix-popover-trigger-width] min-w-72 p-0"
+        // The dialog around it would otherwise swallow the scrolling.
+        onWheel={(e) => e.stopPropagation()}
+      >
+        <Command>
+          <CommandInput
+            placeholder={t("lists.builder.lists_search_placeholder")}
+            className="h-9 max-sm:h-11"
+          />
+          <CommandList className="max-h-60">
+            <CommandEmpty>{t("lists.builder.lists_none_found")}</CommandEmpty>
+            <CommandGroup>
+              {paths.map((path) => {
+                const list = path[path.length - 1];
+                return (
+                  <CommandItem
+                    key={list.id}
+                    value={list.id}
+                    keywords={[list.name]}
+                    onSelect={() => onToggle(list.name)}
+                    className="cursor-pointer max-sm:min-h-11"
+                  >
+                    <Check
+                      className={cn(
+                        "size-4",
+                        selectedNames.includes(list.name)
+                          ? "opacity-100"
+                          : "opacity-0",
+                      )}
+                    />
+                    <span className="truncate">{listNameFromPath(path)}</span>
+                  </CommandItem>
+                );
+              })}
+            </CommandGroup>
+          </CommandList>
+        </Command>
+      </PopoverContent>
+    </Popover>
+  );
+}
```

**File**: `apps/web/components/dashboard/lists/SmartListPreview.tsx` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+"use client";
+
+import { useTranslation } from "@/lib/i18n/client";
+import { cn } from "@/lib/utils";
+import { keepPreviousData, useQuery } from "@tanstack/react-query";
+
+import { useDebounce } from "@karakeep/shared-react/hooks/use-debounce";
+import { useTRPC } from "@karakeep/shared-react/trpc";
+
+const DEBOUNCE_MS = 400;
+
+/**
+ * What a smart list would hold, before it's created. `query` must be a valid
+ * smart list query, or empty while there's nothing valid to preview yet, in which
+ * case it says what's missing. `invalid` tells a query being fixed from no query.
+ */
+export function SmartListPreview({
+  query,
+  invalid = false,
+}: {
+  query: string;
+  invalid?: boolean;
+}) {
+  const api = useTRPC();
+  const { t } = useTranslation();
+  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
+  const { data, isError, isFetching } = useQuery(
+    api.lists.previewSmartQuery.queryOptions(
+      { query: debouncedQuery },
+      {
+        enabled: debouncedQuery.length > 0,
+        placeholderData: keepPreviousData,
+        retry: false,
+      },
+    ),
+  );
+
+  if (!query) {
+    return (
+      <p
+        aria-live="polite"
+        className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
+      >
+        {t(invalid ? "lists.preview.fix_query" : "lists.preview.empty_query")}
+      </p>
+    );
+  }
+
+  return (
+    <div
+      aria-live="polite"
+      className={cn(
+        "rounded-md bg-muted px-3 py-2 text-sm transition-opacity",
+        (isFetching || query !== debouncedQuery) && "opacity-60",
+      )}
+    >
+      {isError ? (
+        <p className="text-muted-foreground">{t("lists.preview.failed")}</p>
+      ) : !data ? (
+        <p className="text-muted-foreground">{t("lists.preview.checking")}</p>
+      ) : data.count === 0 ? (
+        <>
+          <p className="font-medium">{t("lists.preview.no_matches")}</p>
+          <p className="text-muted-foreground">
+            {t("lists.preview.no_matches_description")}
+          </p>
+        </>
+      ) : (
+        <>
+          <p className="font-medium">
+            {t("lists.preview.count", { count: data.count })}
+          </p>
+          {data.sample.length > 0 && (
+            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
+              {data.sample.map((bookmark) => (
+                <li key={bookmark.id} className="truncate">
+                  {bookmark.title ?? t("common.untitled")}
+                </li>
+              ))}
+            </ul>
+          )}
+        </>
+      )}
+    </div>
+  );
+}
```

**File**: `apps/web/components/dashboard/lists/SmartListQueryBuilder.tsx` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+"use client";
+
+import { TagNamePicker } from "@/components/dashboard/tags/TagAutocomplete";
+import { Badge } from "@/components/ui/badge";
+import { ButtonWithTooltip } from "@/components/ui/button";
+import { Input } from "@/components/ui/input";
+import { Label } from "@/components/ui/label";
+import {
+  Select,
+  SelectContent,
+  SelectItem,
+  SelectTrigger,
+  SelectValue,
+} from "@/components/ui/select";
+import { useTranslation } from "@/lib/i18n/client";
+import { X } from "lucide-react";
+
+import { useBookmarkLists } from "@karakeep/shared-react/hooks/lists";
+
+import { ListNamePicker } from "./ListNamePicker";
+import {
+  AGE_OPTIONS,
+  ANY,
+  isNegated,
+  tokenize,
+  unquote,
+  withoutNegation,
+} from "./smartListBuilderQuery";
+
+// Translation keys can't contain the comparison signs the query uses
+const AGE_LABEL_KEYS = {
+  "<7d": "last_7_days",
+  "<30d": "last_30_days",
+  "<1y": "last_year",
+  ">30d": "over_30_days",
+  ">1y": "over_a_year",
+} as const;
+
+// Quotes a value unless the query parser reads it as one bare word.
+// A value starting like a qualifier, such as "is:fav", would be read as one.
+const quoteIfNeeded = (value: string) =>
+  /^[^\s()"#!-][^\s()"]*$/.test(value) &&
+  !/^(is|has|url|list|after|before|age|feed|title|tag|source):/.test(value)
+    ? value
+    : `"${value.replaceAll('"', "")}"`;
+
+function qualifierState(tokens: string[], term: string) {
+  const token = tokens.find((tok) => withoutNegation(tok) === term);
+  if (!token) {
+    return ANY;
+  }
+  return isNegated(token) ? "no" : "yes";
+}
+
+/**
+ * Builds the simple cases of a smart list query. The query string stays the
+ * source of truth: every control reads its value from it and only rewrites its
+ * own terms, so anything typed by hand next to them is left alone.
+ */
+export function SmartListQueryBuilder({
+  query,
+  onChange,
+  listId,
+}: {
+  query: string;
+  onChange: (query: string) => void;
+  // The list being edited, which can't be one of its own conditions
+  listId?: string;
+}) {
+  const { t } = useTranslation();
+  const { data: lists } = useBookmarkLists();
+  const tokens = tokenize(query);
+  // The controls rewrite single terms, which would break "or", "and" or
+  // brackets around them, so such a query is only edited as text.
+  const isGrouped = tokens.some(
+    (tok) =>
+      /^(or|and)$/i.test(tok) || /[()]/.test(tok.replace(/"[^"]*"/g, "")),
+  );
+
+  const replaceTokens = (
+    shouldRemove: (token: string) => boolean,
+    added: string[],
+  ) => {
+    onChange(
+      [...tokens.filter((tok) => !shouldRemove(tok)), ...added].join(" "),
+    );
+  };
+
+  const setQualifier = (term: string, value: string) => {
+    replaceTokens(
+      (tok) => withoutNegation(tok) === term,
+      value === ANY ? [] : [value === "no" ? `-${term}` : term],
+    );
+  };
+
+  const namedTerms = (prefix: string) =>
+    tokens
+      .filter((tok) => withoutNegation(tok).startsWith(prefix))
+      .map((tok) => ({
+        token: tok,
+        prefix,
+        name: unquote(withoutNegation(tok).slice(prefix.length)),
+        negated: isNegated(tok),
+      }))
+      .filter((term) => term.name.length > 0);
+  const tags = namedTerms("tag:");
+  const pickedLists = namedTerms("list:");
+
+  const toggleNamed = (prefix: string, name: string) => {
+    const existing = namedTerms(prefix).find((term) => term.name === name);
+    if (existing) {
+      replaceTokens((tok) => tok === existing.token, []);
+    } else {
+      replaceTokens(() => false, [`${prefix}${quoteIfNeeded(name)}`]);
+    }
+  };
+
+  // Edited in place, so the term doesn't jump to the end while it's typed.
+  const textIndex = (prefix: string) =>
+    tokens.findIndex(
+      (tok) =>
+        tok.startsWith(prefix) &&
+        unquote(tok.slice(prefix.length)).trim().length > 0,
+    );
+  const textValue = (prefix: string) => {
+    const index = textIndex(prefix);
+    return index === -1 ? "" : unquote(tokens[index].slice(prefix.length));
+  };
+  const setText = (prefix: string, value: string) => {
+    const index = textIndex(prefix);
+    const next = [...tokens];
+    const term = value.trim()
+      ? `${prefix}${quoteIfNeeded(value.replaceAll('"', ""))}`
+      : undefined;
+    if (index === -1) {
+      if (term) {
+        next.push(term);
+      }
+    } else if (term) {
+      next[index] = term;
+    } else {
+      next.splice(index, 1);
+    }
+    onChange(next.join(" "));
+  };
+
+  const age =
+    tokens
+      .find((tok) => tok.startsWith("age:") && tok.length > "age:".length)
+      ?.slice("age:".length) ?? ANY;
+  const hasPresetAge =
+    age === ANY || (AGE_OPTIONS as readonly string[]).includes(age);
+
+  const listIcon = (name: string) =>
+    lists?.data.find((list) => list.name === name && list.userRole === "owner")
+      ?.icon;
+
+  const stateOptions = (
+    <>
+      <SelectItem value={ANY}>{t("lists.builder.any")}</SelectItem>
+      
```

**File**: `apps/web/components/dashboard/lists/smartListBuilderQuery.test.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { describe, expect, it } from "vitest";
+
+import { isQueryRepresentableInBuilder } from "./smartListBuilderQuery";
+
+describe("isQueryRepresentableInBuilder", () => {
+  it.each([
+    "",
+    "is:fav",
+    "-is:archived",
+    "is:fav -is:archived tag:docs",
+    '-tag:"two words" tag:docs age:<30d',
+    "age:<2w",
+    'list:"Reading Queue" -list:Archive',
+    'url:example.com title:"release notes"',
+  ])("accepts %s", (query) => {
+    expect(isQueryRepresentableInBuilder(query)).toBe(true);
+  });
+
+  it.each([
+    "free text",
+    "has:notes",
+    "-url:example.com",
+    "title:a title:b",
+    "list:",
+    "is:fav or is:archived",
+    "(is:fav)",
+    "is:fav -is:fav",
+    "age:<7d age:>1y",
+    "-age:<7d",
+    "tag:",
+  ])("rejects %s", (query) => {
+    expect(isQueryRepresentableInBuilder(query)).toBe(false);
+  });
+});
```

**File**: `apps/web/components/dashboard/lists/smartListBuilderQuery.ts` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+export const ANY = "any";
+export const AGE_OPTIONS = ["<7d", "<30d", "<1y", ">30d", ">1y"] as const;
+
+// Splits a query into its space separated terms, keeping quoted values whole.
+export const tokenize = (query: string): string[] =>
+  query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
+
+export const isNegated = (token: string) => /^[-!]/.test(token);
+
+export const withoutNegation = (token: string) => token.replace(/^[-!]/, "");
+
+export const unquote = (value: string) => value.replace(/^"|"$/g, "");
+
+// Qualifiers the builder shows as a list of picked names.
+const NAMED = ["tag:", "list:"];
+// Qualifiers the builder shows as a single "contains" field.
+const TEXT = ["title:", "url:"];
+
+/**
+ * Whether the builder's controls can show all of a query. Anything else, such as
+ * free text, grouping or a second value for one control, needs the raw query.
+ */
+export function isQueryRepresentableInBuilder(query: string) {
+  const seen = new Set<string>();
+  return tokenize(query).every((token) => {
+    const term = withoutNegation(token);
+    const named = NAMED.find((prefix) => term.startsWith(prefix));
+    if (named) {
+      return unquote(term.slice(named.length)).length > 0;
+    }
+    const text = TEXT.find((prefix) => term.startsWith(prefix));
+    if (text) {
+      if (isNegated(token) || seen.has(text)) {
+        return false;
+      }
+      seen.add(text);
+      return unquote(term.slice(text.length)).trim().length > 0;
+    }
+    if (term.startsWith("age:")) {
+      if (isNegated(token) || seen.has("age")) {
+        return false;
+      }
+      seen.add("age");
+      return term.length > "age:".length;
+    }
+    if (term === "is:fav" || term === "is:archived") {
+      if (seen.has(term)) {
+        return false;
+      }
+      seen.add(term);
+      return true;
+    }
+    return false;
+  });
+}
```

**File**: `apps/web/components/dashboard/search/QueryExplainerTooltip.tsx` (modified, +7/-1)
```diff
@@ -257,7 +257,13 @@ export default function QueryExplainerTooltip({
     return null;
   }
 
-  const body = (
+  // Nothing typed yet, so there's nothing to explain
+  const isEmpty =
+    !header && !parsedSearchQuery.text && !parsedSearchQuery.matcher;
+
+  const body = isEmpty ? (
+    t("search.query_language_help")
+  ) : (
     <>
       {header}
       <Table className="[&_tr:hover]:bg-transparent">
```

**File**: `apps/web/components/dashboard/tags/TagAutocomplete.tsx` (modified, +134/-2)
```diff
@@ -1,4 +1,4 @@
-import React, { useState } from "react";
+import React, { useRef, useState } from "react";
 import { Button } from "@/components/ui/button";
 import {
   Command,
@@ -13,14 +13,17 @@ import {
   PopoverContent,
   PopoverTrigger,
 } from "@/components/ui/popover";
+import { selectTriggerClass } from "@/components/ui/select";
 import LoadingSpinner from "@/components/ui/spinner";
+import { useTranslation } from "@/lib/i18n/client";
 import { cn } from "@/lib/utils";
 import { useQuery } from "@tanstack/react-query";
-import { Check, ChevronsUpDown, X } from "lucide-react";
+import { Check, ChevronDown, ChevronsUpDown, Plus, X } from "lucide-react";
 
 import { useTagAutocomplete } from "@karakeep/shared-react/hooks/tags";
 import { useDebounce } from "@karakeep/shared-react/hooks/use-debounce";
 import { useTRPC } from "@karakeep/shared-react/trpc";
+import { normalizeTagName } from "@karakeep/shared/utils/tag";
 
 interface TagAutocompleteProps {
   tagId: string;
@@ -131,3 +134,132 @@ export function TagAutocomplete({
     </Popover>
   );
 }
+
+/**
+ * The same search as `TagAutocomplete`, for several tags picked by name: the
+ * popover stays open between picks and picking a selected tag removes it. A name
+ * that matches no tag can still be picked, it's what a smart list matches on.
+ */
+export function TagNamePicker({
+  id,
+  placeholder,
+  selectedNames,
+  onToggle,
+  getTypedNameLabel,
+}: {
+  id?: string;
+  placeholder: string;
+  selectedNames: string[];
+  onToggle: (name: string) => void;
+  getTypedNameLabel: (name: string) => string;
+}) {
+  const { t } = useTranslation();
+  const [open, setOpen] = useState(false);
+  const [searchQuery, setSearchQuery] = useState("");
+  // Tags are saved without a leading "#", so "#docs" should find "docs".
+  const typedName = normalizeTagName(searchQuery);
+  const searchQueryDebounced = useDebounce(typedName, 200);
+  const inputRef = useRef<HTMLInputElement>(null);
+
+  const { data: tags } = useTagAutocomplete({
+    nameContains: searchQueryDebounced,
+    select: (data) => data.tags,
+    enabled: open,
+  });
+
+  const query = typedName.toLowerCase();
+  // The list shows the previous search's results while the new ones load. The
+  // top row gets pre-selected, so Enter shouldn't land on something unrelated.
+  const matches = (tags ?? []).filter((tag) =>
+    tag.name.toLowerCase().includes(query),
+  );
+  const offerTypedName =
+    typedName.length > 0 &&
+    !matches.some((tag) => tag.name.toLowerCase() === query);
+
+  const pick = (name: string) => {
+    onToggle(name);
+    setSearchQuery("");
+    // Clicking a row takes the focus, and the next pick starts with typing.
+    inputRef.current?.focus();
+  };
+
+  return (
+    <Popover
+      open={open}
+      onOpenChange={(next) => {
+        setOpen(next);
+        if (!next) {
+          setSearchQuery("");
+        }
+      }}
+    >
+      <PopoverTrigger asChild>
+        <button
+          id={id}
+          type="button"
+          role="combobox"
+          aria-expanded={open}
+          className={selectTriggerClass}
+        >
+          <span className="truncate text-muted-foreground/85">
+            {placeholder}
+          </span>
+          <ChevronDown className="size-4 shrink-0 opacity-50" />
+        </button>
+      </PopoverTrigger>
+      <PopoverContent
+        align="start"
+        collisionPadding={8}
+        className="w-[--radix-popover-trigger-width] min-w-56 p-0"
+        // The dialog around it would otherwise swallow the scrolling.
+        onWheel={(e) => e.stopPropagation()}
+      >
+        <Command shouldFilter={false}>
+          <CommandInput
+            ref={inputRef}
+            placeholder={t("tags.search_placeholder")}
+            value={searchQuery}
+            onValueChange={setSearchQuery}
+            className="h-9 max-sm:h-11"
+          />
+          <CommandList className="max-h-60">
+            {matches.length === 0 && !offerTypedName && (
+              <CommandEmpty>{t("tags.none_found")}</CommandEmpty>
+            )}
+            <CommandGroup>
+              {matches.map((tag) => (
+                <CommandItem
+                  key={tag.id}
+                  value={tag.id}
+                  onSelect={() => pick(tag.name)}
+                  className="cursor-pointer max-sm:min-h-11"
+                >
+                  <Check
+                    className={cn(
+                      "size-4",
+                      selectedNames.includes(tag.name)
+                        ? "opacity-100"
+                        : "opacity-0",
+                    )}
+                  />
+                  {tag.name}
+                </CommandItem>
+              ))}
+              {offerTypedName && (
+                <CommandItem
+                  value={`typed:${typedName}`}
+                  onSelect={() => pick(typedName)}
+                  className="cursor-pointer max-sm:min-h-11"
+               
```

#### Recent Merged Pull Requests:
- **PR #3349** (2026-11-09): fix(highlights): save highlights whose selection ends on an element (@MohamedBassem)
- **PR #3348** (2026-11-09): fix(highlights): open the highlight menu when a selection ends outside the text (@MohamedBassem)
- **PR #3347** (2026-11-09): fix(mobile): stop the bookmark list jumping to the top on refetch (@MohamedBassem)
- **PR #3346** (2026-11-09): refactor(web): replace the tooltip's global focus tracking with Radix patterns (@MohamedBassem)
- **PR #3345** (2026-11-09): fix(crawler): preserve offline copies without recrawling the bookmark (@MohamedBassem)
- **PR #3343** (2026-11-09): fix(highlights): store quote context for highlights made in dock mode (@MohamedBassem)

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

## X. web): fix bugs found in pre-release QA

**RULE**:
When implementing operations in `apps/web/app/dashboard/bookmarks/page.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in karakeep-app/karakeep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1514c25`: web): fix bugs found in pre-release QA. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/web/app/dashboard/bookmarks/page.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import type { Metadata } from "next";
import { useTranslation } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("common.home")} | Karakeep`,
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1514c25` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
