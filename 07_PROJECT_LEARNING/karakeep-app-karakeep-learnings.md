# Forensic Learning Record (Deep Inspection): karakeep-app/karakeep

> **Canonical Artifact**: `07_PROJECT_LEARNING/karakeep-app-karakeep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/karakeep-app/karakeep](https://github.com/karakeep-app/karakeep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:31.780Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karakeep-app/karakeep`
- **Description**: A self-hostable bookmark-everything app (links, notes and images) with AI-based automatic tagging and full text search
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 29442 stars

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
  address: z.string().optional().default("https://cloud.karakeep.app"),
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
  address: "https://cloud.karakeep.app",
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

  return { settings, setSettings, isPending: isInit };
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
  // The bundle is an ES module (crxjs emits chunks with `import.meta`), so
  // `executeScript({ files })` — which loads as a classic script — fails.
  // Use a dynamic import in the isolated world instead.
  const urls = files.map((f) => chrome.runtime.getURL(f));
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (moduleUrls: string[]) => {
      try {
        for (const url of moduleUrls) {
          await import(/* @vite-ignore */ url);
        }
        return { ok: true as const };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    args: [urls],
  });
  const res = result?.result;
  // Treat the re-entry guard as success — the listener is already registered
  // from a concurrent injection, so the retried sendMessage will succeed.
  if (!res || (!res.ok && !res.error?.includes("already loaded"))) {
    throw new Error(
      `Failed to inject SingleFile content script: ${res?.error ?? "unknown error"}`,
    );
  }
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

### Core Architecture Module: `apps/browser-extension/src/utils/type.ts`
```
export const enum MessageType {
  BOOKMARK_REFRESH_BADGE = 1,
}

```

### Core Architecture Module: `apps/browser-extension/src/utils/url.ts`
```
/**
 * Check if a URL is an HTTP or HTTPS URL.
 * @param url The URL to check.
 * @returns True if the URL starts with "http://" or "https://", false otherwise.
 */
export function isHttpUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

/**
 * Normalize a URL by removing the hash and trailing slash.
 * @param url The URL to process.
 * @param base Optional base URL for relative URLs.
 * @returns Normalized URL as string.
 */
export function normalizeUrl(url: string, base?: string): string {
  const u = new URL(url, base);
  u.hash = ""; // Remove hash fragment
  let pathname = u.pathname;
  if (pathname.endsWith("/") && pathname !== "/") {
    pathname = pathname.slice(0, -1); // Remove trailing slash except for root "/"
  }
  u.pathname = pathname;
  return u.toString();
}

/**
 * Compare two URLs ignoring hash and trailing slash.
 * @param url1 First URL.
 * @param url2 Second URL.
 * @param base Optional base URL for relative URLs.
 * @returns True if URLs match after normalization.
 */
export function urlsMatchIgnoringAnchorAndTrailingSlash(
  url1: string,
  url2: string,
  base?: string,
): boolean {
  return normalizeUrl(url1, base) === normalizeUrl(url2, base);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3133** (2026-10-04): **Screenshots render CJK (Chinese/Japanese/Korean) text as tofu boxes — karakeep-chrome image is missing CJK fonts**
  *Symptoms*: ### Describe the Bug  After migrating to the new `ghcr.io/karakeep-app/karakeep-chrome:release` image, page screenshots taken during crawling no longer render Chinese characters correctly. All Chinese text in the screenshot appears as empty boxes (tofu, □), while English/Latin text on the same page renders fine.   ### Steps to Reproduce  1. Deploy Karakeep using the standard docker-compose setup with the new chrome image: ```yaml    chrome:      image: ghcr.io/karakeep-app/karakeep-chrome:release      restart: unless-stopped      init: true      command:        - --disable-gpu        - --disable-dev-shm-usage        - --hide-scrollbars        - --disable-blink-features=AutomationControlled        - --window-size=1440,900 ``` 2. Bookmark a URL whose page content is primarily in Simplified Chinese (e.g. a Chinese news site or blog post). 3. Wait for the crawler to finish and open the bookmark's Screenshot tab. 4. Observe that all Chinese characters are rendered as empty rectangles (□□□□), while any English text on the same page displays normally.   ### Expected Behaviour  Screenshots should render CJK text correctly, the same way they render Latin text.      ### Screenshots or Additional Context  _No response_  ### Device Details  _No response_  ### Exact Karakeep Version  0.33.2  ### Environment Details  _No response_  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to
  **Post-Mortem & Fix Analysis**:
  > Added the screen shot pic for reference. <img width="1440" height="900" alt="Image" src="https://github.com/user-attachments/assets/d458830a-0a19-4bf4-9b6f-6f11f4205b2c" />
  > I'll take a look at the Chrome image's installed fonts and prepare a focused fix with a CJK rendering check.
  > Should be fixed in https://github.com/karakeep-app/karakeep/commit/ea57af18d90d56f87d21f3359c55e43521638236.

- **Issue #3123** (2026-09-26): **Android 1.11.1 stays Offline with WARP while browser access and login work**
  *Symptoms*: ### Describe the Bug  The official Android app stays **Offline** and is effectively unusable, while the Karakeep website works, including in Chrome on the same phone. I noticed this after upgrading to the 0.33 series; the installed mobile app reports **1.11.1**.  My network setup uses Cloudflare Zero Trust / WARP. Signing out and signing back in succeeds, but the app still reports Offline and the account name only shows **User**. It feels as though some requests work while others never load.  WARP is part of the affected environment, but I have not confirmed that it causes the problem. The source analysis below is a possible explanation, not a device-level diagnosis.  ### Steps to Reproduce  These are the steps in my affected environment; I have not established a minimal reproduction on another device:  1. Use the official Karakeep Android app 1.11.1 with a self-hosted instance and Cloudflare Zero Trust / WARP in the network path. 2. Open the app: it reports Offline and does not load normally. 3. Open the same instance in Chrome on the same phone: the web UI works. 4. Sign out of the app and sign back in: login completes, but Offline persists and the account name displays User.  ### Expected Behaviour  The app should attempt to reach the configured Karakeep server when there is a network connection. An OS-level determination of general Internet reachability should not, by itself, prevent access to a self-hosted server that may be reachable over a VPN or local network.  ### Sc
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and rootcause! This will be fixed in the next release!

- **Issue #3112** (2026-09-22): **Search bar does not appear at top of page when using Safari on Mac OS**
  *Symptoms*: ### Describe the Bug  Search bar does not appear at top of page when using Safari on Mac OS using nightly builds.  No issues on Chrome.  ### Steps to Reproduce  Run the nightly build. Open Karakeep with Safari in Mac OS. The search bar does not appear at the top of the page.  ### Expected Behaviour  Search bar at top of page, as per loading the page using Chrome.  ### Screenshots or Additional Context  <img width="2548" height="76" alt="Image" src="https://github.com/user-attachments/assets/e08fcd09-6951-44de-bf07-632bde9b9904" />  ### Device Details  Safari on Mac OS 27  ### Exact Karakeep Version  nightly build  ### Environment Details  Docker on Ubuntu  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem
  **Post-Mortem & Fix Analysis**:
  > Should be fixed by https://github.com/karakeep-app/karakeep/commit/daa89562cb57b8030f35e2ae462ebe94e03c3209 & https://github.com/karakeep-app/karakeep/commit/3c4411430a5386b6cfb84331a788372e1dcea95e thanks a lot for the report. The nightly image with the fix should be ready in 10mins.
  > Working in the new build. Thanks!

- **Issue #3109** (2026-09-22): **Hover actions seem to be broken in the latest nightly build**
  *Symptoms*: ### Describe the Bug  The hover actions seem to be broken in the latest nightly build. I am talking about things like bulk edit, favorite, and archive on hover. Also being able to delete a tag from the tags view. When you hovered over a tag, an X appeared that you could click on to delete the tag. None of the hover options are appearing when I hover on items. I tried in Chrome, Firefox, and Safari to make sure that a browser plugin wasn't interfering.  I rolled back to 0.33.2 and the hover actions work as expected.   ### Steps to Reproduce  Run the latest nightly build. Hover the mouse pointer over items in the bookmark list or tag list. The hover event doesn't seem to fire, or at least the hover controls don't appear.  ### Expected Behaviour  Previously released hover functionality mentioned above should still work  ### Screenshots or Additional Context  _No response_  ### Device Details  _No response_  ### Exact Karakeep Version  Nightly build from September 20, 2026  ### Environment Details  Docker on Unraid  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/karakeep-app/karakeep/commit/2d58d906c89e5f6b08a28f9d45a3c617d506a4b4. Thanks for the report!

- **Issue #3092** (2026-09-16): **1.11.1 release missing from mobile-releases**
  *Symptoms*: ### Describe the Bug  Version 1.11.1 was released on google play, but not published to the https://github.com/karakeep-app/mobile-releases/releases page.  ### Steps to Reproduce  1. check version available on google play store (1.11.1) 2. check mobile-releases github releases page (1.11.0) 3. Notice the github page isn't updated.  ### Expected Behaviour  The github releases page has the same version release as google play  ### Screenshots or Additional Context  _No response_  ### Device Details  _No response_  ### Exact Karakeep Version  1.11.1  ### Environment Details  github  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem
  **Post-Mortem & Fix Analysis**:
  >  <!-- PULLFROG_DIVIDER_DO_NOT_REMOVE_PLZ --> <sup><a href="https://pullfrog.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pullfrog.com/logos/frog-white-full-18px.png"><img src="https://pullfrog.com/logos/frog-green-full-18px.png" width="9px" height="9px" style="vertical-align: middle; " alt="Pullfrog"></picture></a>&nbsp;&nbsp;｜ [Build this ➔](https://pullfrog.com/trigger/karakeep-app/karakeep/3092?action=build) ｜ [Make a plan ➔](https://pullfrog.com/trigger/karakeep-app/karakeep/3092?action=plan)</sup>
  > Thanks for the reminder, I'll upload 1.11.2 there soon.
  > Done.

- **Issue #3083** (2026-09-12): **iPad app can’t login with local ip**
  *Symptoms*: ### Describe the Bug  Running connection test ...  Using address: http://192.168.0.10:3456  Network connection failed: The Internet connection appears to be offline.  ### Steps to Reproduce  Connection test on local ip  ### Expected Behaviour  Should log on  ### Screenshots or Additional Context  _No response_  ### Device Details  _No response_  ### Exact Karakeep Version  1.11.1  ### Environment Details  _No response_  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem

- **Issue #3078** (2026-09-13): **Precrawled archive processing gets JavaScript heap out of memory error**
  *Symptoms*: ### Describe the Bug  I have a link that requires login and I want to save. https://www.aarp.org/health/healthy-living/food-swaps-to-save-money-and-boost-health/  I used the Chrome plugin with client-side crawling enabled.  <img width="407" height="599" alt="Image" src="https://github.com/user-attachments/assets/c1ef115f-0e1e-4a67-ac83-f8647f8e149a" />  The result is a page with no content, even though there is a precrawled archive.  <img width="974" height="801" alt="Image" src="https://github.com/user-attachments/assets/8d6649ff-258c-4756-bdfa-2bf1916686cb" />  ### Steps to Reproduce  1. Find someone who is old and has an AARP membership :) 2. Log in to the AARP website 3. Load the page https://www.aarp.org/health/healthy-living/food-swaps-to-save-money-and-boost-health/ 4. Click on the Karakeep Chrome extension to save the page  Here is the precrawled archive in case that helps: [Precrawled Archive.html](https://github.com/user-attachments/files/32062391/Precrawled.Archive.html)  ### Expected Behaviour  Content would be saved.  ### Screenshots or Additional Context  See log files below.  ### Device Details  Chrome Version 152.0.7977.82 (Official Build) (x86_64) running on Linux Debian Trixie  ### Exact Karakeep Version  0.33.2  ### Environment Details  Docker on Debian Trixie  ### Debug Logs  Here are the log files, first is production, second is from a development docker.  I watched the server memory, and the karakeep web container grew from 1.09 GB to 1.77 GB, but the se
  **Post-Mortem & Fix Analysis**:
  > I had to dig for a while, but I eventually found CRAWLER_PARSER_MEM_LIMIT_MB. I set it to 4096 and now the page loads.  I see that `parseSubprocess.ts` is checking for error code `137` for out of memory, please add `134` as well.
  > Thanks for the report. I'm constantly iterating on the parser to reduce the memory usage for singlefile archives. The problem is usually inline assets in heavy pages. Let's track this in #3050.

- **Issue #3072** (2026-09-13): **RSS subscription pulling incorrect YT playlist all of a sudden**
  *Symptoms*: ### Describe the Bug  On cloud.karakeep.app. No recent changes to user config / RSS feeds. Been stable for months. Behaviour started 48hrs ago.  I have a series of RSS subscriptions that point to Youtube 'UULF' playlists. These are auto-generated playlists in the format e.g. https://www.youtube.com/feeds/videos.xml?playlist_id=UULFafxR2HWJRmMfSdyZXvZMTw  That playlist ID always starts with UULF & is important - it tells Youtube to construct the playlist excluding all shorts. This has always worked very well in karakeep for the channels I cover.  2 days ago Karakeep started ignoring that RSS address, and taking a channel's main UU playlist, which includes all content posted, shorts, live streams etc. e.g. https://www.youtube.com/feeds/videos.xml?playlist_id=UUafxR2HWJRmMfSdyZXvZMTw for the above channel - note the UULF now being just UU  But more importantly, that means something in Karakeep is taking an URL other than the one listed in the RSS subscription settings for Youtube domains.  TLDR: for Youtube, hosted Karakeep is ignoring the specific URL specified in the RSS subscription setting, and taking a different feed.  ### Steps to Reproduce  1. Compare RSS content of https://www.youtube.com/feeds/videos.xml?playlist_id=UULFafxR2HWJRmMfSdyZXvZMTw 2. and https://www.youtube.com/feeds/videos.xml?playlist_id=UUafxR2HWJRmMfSdyZXvZMTw 3. Specify the former as an RSSsub in karakeep 4. Note that you will receive the latter  ### Expected Behaviour  To receive RSS content from the s
  **Post-Mortem & Fix Analysis**:
  > I actually think this may have been a temporary issue at YT's end. I shall monitor for another couple of days, and reopen if necessary. For the meantime, issues seem to be backlogging, so misidentified ones such as this might be won't help MB when he gets back.

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

### Incident Patch 1: `75aeaaa4` (2026-10-04)
**Commit Message**: fix(web): use post in pre-login pages when react fails to render

**File**: `apps/web/components/invite/InviteAcceptForm.tsx` (modified, +2/-0)
```diff
@@ -188,6 +188,8 @@ export default function InviteAcceptForm({ token }: InviteAcceptFormProps) {
 
         <Form {...form}>
           <form
+            // POST so a submit before hydration doesn't put the password in the URL.
+            method="post"
             onSubmit={form.handleSubmit(async (value) => {
               try {
                 await acceptInviteMutation.mutateAsync({
```

**File**: `apps/web/components/settings/ChangePassword.tsx` (modified, +6/-1)
```diff
@@ -75,7 +75,12 @@ export function ChangePassword() {
   return (
     <SettingsSection id="security" title="Security">
       <Form {...form}>
-        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
+        <form
+          // POST so a submit before hydration doesn't put the password in the URL.
+          method="post"
+          onSubmit={form.handleSubmit(onSubmit)}
+          className="space-y-4"
+        >
           <FormField
             control={form.control}
             name="currentPassword"
```

**File**: `apps/web/components/signin/CredentialsForm.tsx` (modified, +2/-0)
```diff
@@ -71,6 +71,8 @@ export default function CredentialsForm() {
     <div className="space-y-6">
       <Form {...form}>
         <form
+          // POST so a submit before hydration doesn't put the password in the URL.
+          method="post"
           onSubmit={form.handleSubmit(async (value) => {
             const resp = await signIn("credentials", {
               email: value.email.trim(),
```

**File**: `apps/web/components/signin/ResetPasswordForm.tsx` (modified, +2/-0)
```diff
@@ -104,6 +104,8 @@ export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
           <>
             <Form {...form}>
               <form
+                // POST so a submit before hydration doesn't put the password in the URL.
+                method="post"
                 onSubmit={form.handleSubmit(onSubmit)}
                 className="space-y-4"
               >
```

**File**: `apps/web/components/signup/SignUpForm.tsx` (modified, +2/-0)
```diff
@@ -100,6 +100,8 @@ export default function SignUpForm({ redirectUrl }: SignUpFormProps) {
       <CardContent className="space-y-6">
         <Form {...form}>
           <form
+            // POST so a submit before hydration doesn't put the password in the URL.
+            method="post"
             onSubmit={form.handleSubmit(async (value) => {
               if (turnstileSiteKey && !value.turnstileToken) {
                 form.setError("turnstileToken", {
```

---

### Incident Patch 2: `6f56f74b` (2026-10-04)
**Commit Message**: fix: lowercase emails in endpoints that accept it

**File**: `packages/trpc/routers/invites.ts` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ export const invitesAppRouter = router({
   create: adminUsersProcedure
     .input(
       z.object({
-        email: z.string().email(),
+        email: z.string().trim().toLowerCase().email(),
       }),
     )
     .mutation(async ({ input, ctx }) => {
@@ -177,7 +177,7 @@ export const invitesAppRouter = router({
       }
 
       const existingUser = await ctx.db.query.users.findFirst({
-        where: eq(users.email, invite.email),
+        where: eq(users.email, invite.email.toLowerCase()),
       });
 
       if (existingUser) {
```

**File**: `packages/trpc/routers/lists.ts` (modified, +1/-1)
```diff
@@ -250,7 +250,7 @@ export const listsAppRouter = router({
     .input(
       z.object({
         listId: z.string(),
-        email: z.string().email(),
+        email: z.string().trim().toLowerCase().email(),
         role: z.enum(["viewer", "editor"]),
       }),
     )
```

**File**: `packages/trpc/routers/sharedLists.test.ts` (modified, +23/-0)
```diff
@@ -95,6 +95,29 @@ describe("Shared Lists", () => {
       ).rejects.toThrow("Cannot add the list owner as a collaborator");
     });
 
+    test<CustomTestContext>("should match collaborator email case-insensitively", async ({
+      apiCallers,
+    }) => {
+      const ownerApi = apiCallers[0];
+      const collaboratorApi = apiCallers[1];
+
+      const list = await ownerApi.lists.create({
+        name: "Test List",
+        icon: "📚",
+        type: "manual",
+      });
+
+      const collaboratorUser = await collaboratorApi.users.whoami();
+
+      const { invitationId } = await ownerApi.lists.addCollaborator({
+        listId: list.id,
+        email: `  ${collaboratorUser.email!.toUpperCase()} `,
+        role: "viewer",
+      });
+
+      await collaboratorApi.lists.acceptInvitation({ invitationId });
+    });
+
     test<CustomTestContext>("should not allow adding duplicate collaborator", async ({
       apiCallers,
     }) => {
```

**File**: `packages/trpc/routers/subscriptions.ts` (modified, +1/-1)
```diff
@@ -604,7 +604,7 @@ export const subscriptionsRouter = router({
   updateSubscriptionTier: adminSubscriptionsProcedure
     .input(
       z.object({
-        email: z.string().email(),
+        email: z.string().trim().toLowerCase().email(),
         manualTierName: z.string().trim().min(1).max(100).nullable(),
         bookmarkQuota: z.number().int().min(0).nullable().optional(),
         storageQuota: z.number().int().min(0).nullable().optional(),
```

---

### Incident Patch 3: `7ef82473` (2026-10-04)
**Commit Message**: fix(workers): fix headers timeout for AI interference jobs. (#2888)

* Fix headers timeout for AI interference jobs.

* Take greptile feedback into account

* Fix  OpenAI timeouts and node 24 incompatibility.

Use undici's own fetch together with its Agent/ProxyAgent so that both
always come from the same undici copy. Passing an npm undici Agent as
the dispatcher of the runtime's built-in fetch fails immediately on
Node >= 24, which bundles a different undici major (undici 7).

The OpenAI client now sets headersTimeout/bodyTimeout from
OPENAI_TIMEOUT_SEC via the Agent dispatcher, so slow OpenAI-compatible
servers are no longer cut off by undici's default 5 minute header
timeout. Log fetch failures with their underlying cause for easier
debugging.

* refactor: simplify inference fetch timeout handling

Replace the manual header/body timers, signal merging and dynamic undici
import with a single helper that pairs undici's fetch with an Agent (or
ProxyAgent) whose headersTimeout/bodyTimeout match the configured timeout.
Overall deadlines are already enforced by the inference job timeout and
the OpenAI SDK's own timeout.

* Reuse undici dispatchers across inference client builds

-----

**File**: `docs/docs/03-configuration/01-environment-variables.md` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ Either `OPENAI_API_KEY` or `OLLAMA_BASE_URL` need to be set for automatic taggin
 | OPENAI_API_KEY                       | No       | Not set                 | The OpenAI key used for automatic tagging. More on that in [here](../06-administration/03-openai.md).                                                                                                                                                                                                                                                                                 |
 | OPENAI_BASE_URL                      | No       | Not set                 | If you just want to use OpenAI you don't need to pass this variable. If, however, you want to use some other openai compatible API (e.g. azure openai service), set this to the url of the API.                                                                                                                                                                                       |
 | OPENAI_PROXY_URL                     | No       | Not set                 | HTTP proxy server URL for OpenAI API requests (e.g., `http://proxy.example.com:8080`).                                                                                                                                                                                                                                                                                                |
-| OPENAI_TIMEOUT_SEC                   | No       | Not set                 | Timeout for OpenAI API requests in seconds. If unset, the OpenAI SDK default of 10 minutes is used. Increase this alongside `INFERENCE_JOB_TIMEOUT_SEC` when slow inference providers need more time.                                                                                                                                                                                 |
+| OPENAI_TIMEOUT_SEC                   | No       | Not set                 | Timeout for OpenAI API requests in seconds. If unset, the OpenAI SDK default of 10 minutes is used. The HTTP headers/body timeouts are set to the same value. Note that the OpenAI SDK retries timed-out requests up to 2 times by default. Increase this alongside `INFERENCE_JOB_TIMEOUT_SEC` when slow inference providers need more time.                                                                                                                                                                                 |
 | OPENAI_SERVICE_TIER                  | No       | Not set                 | Set to `auto`, `default`, or `flex`. Flex processing provides lower costs in exchange for slower response times and occasional resource unavailability. See [OpenAI Flex Processing](https://platform.openai.com/docs/guides/flex-processing) and [Chat Service Tier](https://platform.openai.com/docs/api-reference/chat/object#chat-object-service_tier) for more details.          |
 | OPENAI_REASONING_EFFORT              | No       | Not set                 | Set to `none`, `minimal`, `low`, `medium`, `high` or `xhigh`. Controls the reasoning effort in reasoning models. See [OpenAI: How Reasoning Works](https://developers.openai.com/api/docs/guides/reasoning#how-reasoning-works).                                                                                                                                                      |
 | OLLAMA_BASE_URL                      | No       | Not set                 | If you want to use ollama for local inference, set the address of ollama API here.                                                                                                                                                                                                                                                                                                    |
@@ -122,7 +122,7 @@ Either `OPENAI_API_KEY` or `OLLAMA_BASE_URL` need to be set for automatic taggin
 | INFERENCE_ENABLE_AUTO_TAGGING        | No       | true                    | Whether automatic AI tagging is enabled or disabled.                                                                                                                                                                                                                                                                                                                                  |
 | INFERENCE_ENABLE_AUTO_SUMMARIZATION  | No       | false                   | Whether automatic AI summarization is enabled or disabled.                                                                                                                                                                                                                                                                                                                            |
 | INFERENCE_JOB_TIMEOUT_SEC            | No       | 30                      | How long to wait for the inference 
```

**File**: `packages/shared/customFetch.ts` (modified, +31/-20)
```diff
@@ -1,24 +1,35 @@
-import serverConfig from "./config";
+import { Agent, Dispatcher, ProxyAgent, fetch as undiciFetch } from "undici";
 
-// Generic fetch function type that works across environments
-type FetchFunction = (
-  input: RequestInfo | URL | string,
-  init?: RequestInit,
-) => Promise<Response>;
+// Dispatchers are reused across calls so that clients built per job (e.g. the
+// inference, embeddings and asset-preprocessing workers) share a connection
+// pool instead of opening fresh sockets each time.
+const dispatchers = new Map<string, Dispatcher>();
 
-// Factory function to create a custom fetch with timeout for any fetch implementation
-export function createCustomFetch(fetchImpl: FetchFunction = globalThis.fetch) {
-  return function customFetch(
-    input: Parameters<typeof fetchImpl>[0],
-    init?: Parameters<typeof fetchImpl>[1],
-  ): ReturnType<typeof fetchImpl> {
-    const timeout = serverConfig.inference.fetchTimeoutSec * 1000; // Convert to milliseconds
-    return fetchImpl(input, {
-      signal: AbortSignal.timeout(timeout),
-      ...init,
-    });
-  };
+function getDispatcher(timeoutMs: number, proxyUrl?: string): Dispatcher {
+  const key = `${proxyUrl ?? ""}:${timeoutMs}`;
+  let dispatcher = dispatchers.get(key);
+  if (!dispatcher) {
+    const opts = { headersTimeout: timeoutMs, bodyTimeout: timeoutMs };
+    dispatcher = proxyUrl
+      ? new ProxyAgent({ uri: proxyUrl, ...opts })
+      : new Agent(opts);
+    dispatchers.set(key, dispatcher);
+  }
+  return dispatcher;
 }
 
-// Default export for backward compatibility - uses global fetch
-export const customFetch = createCustomFetch();
+// Creates a fetch whose undici headers/body timeouts match the given timeout.
+// Without this, undici's defaults (5 mins) cut off slow inference requests
+// regardless of the configured timeout. We use undici's own fetch alongside
+// its Agent so that the fetch and the dispatcher come from the same undici copy.
+export function createCustomFetch(
+  timeoutMs: number,
+  proxyUrl?: string,
+): typeof fetch {
+  const dispatcher = getDispatcher(timeoutMs, proxyUrl);
+  return ((input: RequestInfo | URL, init?: RequestInit) =>
+    undiciFetch(
+      input as Parameters<typeof undiciFetch>[0],
+      { ...init, dispatcher } as Parameters<typeof undiciFetch>[1],
+    )) as unknown as typeof fetch;
+}
```

**File**: `packages/shared/inference.ts` (modified, +8/-6)
```diff
@@ -1,11 +1,10 @@
 import { Ollama } from "ollama";
 import OpenAI from "openai";
 import { zodResponseFormat } from "openai/helpers/zod";
-import * as undici from "undici";
 import { z } from "zod";
 
 import serverConfig from "./config";
-import { customFetch } from "./customFetch";
+import { createCustomFetch } from "./customFetch";
 import logger from "./logger";
 
 export interface InferenceResponse {
@@ -200,9 +199,12 @@ const buildOpenAIClient = (config: OpenAIEmbeddingConfig) =>
       "X-Title": "Karakeep",
       "HTTP-Referer": "https://karakeep.app",
     },
-    fetchOptions: config.proxyUrl
-      ? { dispatcher: new undici.ProxyAgent(config.proxyUrl) }
-      : undefined,
+    fetch: createCustomFetch(
+      config.timeoutSec !== undefined
+        ? config.timeoutSec * 1000
+        : OpenAI.DEFAULT_TIMEOUT,
+      config.proxyUrl,
+    ),
   });
 
 export class InferenceClientFactory {
@@ -427,7 +429,7 @@ class OllamaInferenceClient implements InferenceClient {
     this.config = config;
     this.ollama = new Ollama({
       host: config.baseUrl,
-      fetch: customFetch, // Use the custom fetch with configurable timeout
+      fetch: createCustomFetch(serverConfig.inference.fetchTimeoutSec * 1000),
     });
   }
 
```

---

### Incident Patch 4: `06b1985d` (2026-10-04)
**Commit Message**: chore: fix claude perms

**File**: `.claude/settings.json` (modified, +1/-5)
```diff
@@ -2,13 +2,9 @@
   "permissions": {
     "allow": [
       "Bash(pnpm typecheck:*)",
-      "Bash(pnpm --filter * typecheck *)",
       "Bash(pnpm lint:*)",
-      "Bash(pnpm --filter * lint *)",
       "Bash(pnpm format:*)",
-      "Bash(pnpm --filter * format *)",
-      "Bash(pnpm test:*)",
-      "Bash(pnpm --filter * test *)"
+      "Bash(pnpm test:*)"
     ],
     "deny": []
   }
```

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@ The project is organized into `apps` and `packages`:
 - `pnpm format`: Format the codebase.
 - `pnpm format:fix`: Fix formatting issues.
 - `pnpm test`: Run tests.
+- To scope any of the above to one package, pass a turbo filter: `pnpm typecheck --filter=@karakeep/web` (prefer this over `pnpm --filter`).
 - `pnpm db:generate --name description_of_schema_change`: db migration after making schema changes
 
 Starting services:
```

---

### Incident Patch 5: `8451ce9e` (2026-10-04)
**Commit Message**: fix(mobile): enlarge toolbar hit targets with hitSlop (#2813)

The toolbar Pressables wrapped 22px icons with no hitSlop, well below
Apple's 44px HIG minimum, so taps near the icon edges would silently
miss.

Co-authored-by: Claude Opus 4.7 <[REDACTED_EMAIL]>

**File**: `apps/mobile/components/bookmarks/BottomActions.tsx` (modified, +3/-1)
```diff
@@ -33,6 +33,7 @@ import { useWhoAmI } from "@karakeep/shared-react/hooks/users";
 import { BookmarkTypes, ZBookmark } from "@karakeep/shared/types/bookmarks";
 
 const TOOLBAR_ICON_GAP = 28;
+const TOOLBAR_HIT_SLOP = { top: 13, bottom: 13, left: 13, right: 13 };
 
 function triggerHaptic() {
   Haptics.selectionAsync().catch(() => {
@@ -428,6 +429,7 @@ export default function BottomActions({ bookmark }: BottomActionsProps) {
                 disabled={a.disabled}
                 key={a.id}
                 onPress={a.onClick}
+                hitSlop={TOOLBAR_HIT_SLOP}
                 className="py-auto"
               >
                 {a.icon}
@@ -442,7 +444,7 @@ export default function BottomActions({ bookmark }: BottomActionsProps) {
           actions={menuActionsWithEdit}
           shouldOpenOnLongPress={false}
         >
-          <Pressable onPress={() => triggerHaptic()}>
+          <Pressable hitSlop={TOOLBAR_HIT_SLOP} onPress={() => triggerHaptic()}>
             <TailwindResolver
               className="text-foreground"
               comp={(styles) => (
```

---

### Incident Patch 6: `f9a09b09` (2026-10-04)
**Commit Message**: fix(web): Add scheme-aware theme-color for dark mode (#3051)

* fix(web): Add scheme-aware theme-color for dark mode

The web app declares no `theme-color` at all, and the manifest carries a
single light `theme_color: "#ffffff"`. Browser and installed-web-app
chrome is painted from that value, so on macOS (Safari > Add to Dock)
the title bar stays white while the UI is in dark mode.

Adds `themeColor` to the existing `viewport` export with light and dark
variants, so the chrome follows the active scheme. This mirrors the
`prefers-color-scheme` pattern already used for the icons in `metadata`.

The dark value is `#020817`, the hex form of the `--background` token
defined for `.dark` in `tooling/tailwind/globals.css`
(`222.2 84% 4.9%`), so the title bar matches the app background exactly.
The manifest is left alone, as `theme_color` there accepts only a single
value.

* docs(web): Clarify that theme-color follows the OS scheme only

**File**: `apps/web/app/layout.tsx` (modified, +8/-0)
```diff
@@ -55,6 +55,14 @@ export const viewport: Viewport = {
   initialScale: 1,
   maximumScale: 1,
   userScalable: false,
+  // Values match the `--background` token in tooling/tailwind/globals.css.
+  // These follow the OS color scheme only. An in-app theme override via
+  // next-themes is not reflected here, so chrome can differ from the page
+  // when a user picks a theme opposite to their system preference.
+  themeColor: [
+    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
+    { media: "(prefers-color-scheme: dark)", color: "#020817" },
+  ],
 };
 
 export default async function RootLayout({
```

---

### Incident Patch 7: `1820693e` (2026-09-29)
**Commit Message**: fix(mobile): let API keys revoke themselves

- Allow API key authentication to revoke its own key for sign out
- Prevent API keys from revoking other keys

**File**: `packages/trpc/routers/apiKeys.test.ts` (modified, +54/-0)
```diff
@@ -283,6 +283,60 @@ describe("API Keys Routes", () => {
         unauthedAPICaller.apiKeys.revoke({ id: "some-id" }),
       ).rejects.toThrow(/UNAUTHORIZED/);
     });
+
+    test<CustomTestContext>("an API key can revoke itself", async ({
+      unauthedAPICaller,
+      db,
+    }) => {
+      const user = await unauthedAPICaller.users.create({
+        name: "Test User",
+        email: "test@test.com",
+        password: "password123",
+        confirmPassword: "password123",
+      });
+
+      const key = await unauthedAPICaller.apiKeys.exchange({
+        keyName: "Mobile App",
+        email: user.email,
+        password: "password123",
+      });
+      const keyCaller = await getApiKeyCallerForPlainKey(db, key.key);
+
+      await keyCaller.apiKeys.revoke({ id: key.id });
+
+      const remainingKeys = await db
+        .select()
+        .from(apiKeys)
+        .where(eq(apiKeys.id, key.id));
+      expect(remainingKeys).toHaveLength(0);
+    });
+
+    test<CustomTestContext>("an API key cannot revoke other keys", async ({
+      unauthedAPICaller,
+      db,
+    }) => {
+      const user = await unauthedAPICaller.users.create({
+        name: "Test User",
+        email: "test@test.com",
+        password: "password123",
+        confirmPassword: "password123",
+      });
+
+      const api = getApiCaller(db, user.id, user.email).apiKeys;
+      const otherKey = await api.create({ name: "Other Key" });
+      const key = await api.create({ name: "Caller Key" });
+      const keyCaller = await getApiKeyCallerForPlainKey(db, key.key);
+
+      await expect(
+        keyCaller.apiKeys.revoke({ id: otherKey.id }),
+      ).rejects.toThrow(/API keys can only revoke themselves/);
+
+      const remainingKeys = await db
+        .select()
+        .from(apiKeys)
+        .where(eq(apiKeys.id, otherKey.id));
+      expect(remainingKeys).toHaveLength(1);
+    });
   });
 
   describe("validate", () => {
```

**File**: `packages/trpc/routers/apiKeys.ts` (modified, +17/-1)
```diff
@@ -17,6 +17,7 @@ import {
   validatePassword,
 } from "../auth";
 import {
+  authedProcedure,
   createEventLogMiddleware,
   createRateLimitMiddleware,
   publicProcedure,
@@ -86,7 +87,10 @@ export const apiKeysAppRouter = router({
         key: await regenerateApiKey(existingKey.id, ctx.user.id, ctx.db),
       };
     }),
-  revoke: sessionProcedure
+  // Sessions can revoke any of the user's keys. An API key can only revoke
+  // itself, which is how the mobile app and the extension clean up their key
+  // on sign out.
+  revoke: authedProcedure
     .use(createEventLogMiddleware("apiKey.revoke"))
     .input(
       z.object({
@@ -95,6 +99,18 @@ export const apiKeysAppRouter = router({
     )
     .mutation(async ({ input, ctx }) => {
       addLogFields<"apiKey.revoke">({ "apiKey.id": input.id });
+      if (ctx.auth?.type === "apiKey") {
+        const key = await ctx.db.query.apiKeys.findFirst({
+          where: and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)),
+          columns: { keyId: true },
+        });
+        if (key?.keyId !== ctx.auth.keyId) {
+          throw new TRPCError({
+            code: "FORBIDDEN",
+            message: "API keys can only revoke themselves",
+          });
+        }
+      }
       await ctx.db
         .delete(apiKeys)
         .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));
```

---

### Incident Patch 8: `f70cd784` (2026-10-04)
**Commit Message**: fix(ci): fix uncommitted pnpm-lock

**File**: `pnpm-lock.yaml` (modified, +5/-3)
```diff
@@ -20,7 +20,7 @@ overrides:
 
 patchedDependencies:
   expo-modules-jsi@57.1.1: 0de91114675edaf8158061b65f08995617cd872a813892f81e28394ded741a77
-  expo-share-intent@8.0.1: b6e86be022ff16e70e0e69bcca5ad3191471b7020bf8c4edaa69fed488ad1680
+  expo-share-intent@8.0.1: 5ebddca7c2068ddba29b6d3345e388950f28054b27d4991a3b9fe8cc176274d1
   react-native@0.86.3: 7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1
   react-tweet@3.2.2: d7b79c3ae412d8e700a8c176df42ee89112c9bdc91d2aad0ebb7d5b011b49993
   xcode@3.0.1: 725863c0591d89ca053226c49fe7bc321f320391ec5f78b6c2e8e41ab1868805
@@ -449,7 +449,7 @@ importers:
         version: 57.0.4(expo@57.0.25)
       expo-share-intent:
         specifier: ^8.0.1
-        version: 8.0.1(patch_hash=b6e86be022ff16e70e0e69bcca5ad3191471b7020bf8c4edaa69fed488ad1680)(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3)
+        version: 8.0.1(patch_hash=5ebddca7c2068ddba29b6d3345e388950f28054b27d4991a3b9fe8cc176274d1)(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3)
       expo-sharing:
         specifier: ~57.0.22
         version: 57.0.22(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3)
@@ -23878,7 +23878,9 @@ snapshots:
       metro-runtime: 0.84.6
     transitivePeerDependencies:
       - '@babel/core'
+      - bufferutil
       - supports-color
+      - utf-8-validate
 
   '@react-native/normalize-color@2.1.0': {}
 
@@ -28126,7 +28128,7 @@ snapshots:
 
   expo-server@57.0.3: {}
 
-  expo-share-intent@8.0.1(patch_hash=b6e86be022ff16e70e0e69bcca5ad3191471b7020bf8c4edaa69fed488ad1680)(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3):
+  expo-share-intent@8.0.1(patch_hash=5ebddca7c2068ddba29b6d3345e388950f28054b27d4991a3b9fe8cc176274d1)(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3):
     dependencies:
       '@expo/config-plugins': 57.0.9(typescript@5.9.3)
       expo: 57.0.25(6b33b2113934110f2459ad3be3e8fb0f)
```

---

### Incident Patch 9: `c3669b35` (2026-10-04)
**Commit Message**: fix(mobile): fix image shares from the Android Files app failing to upload

expo-share-intent resolved `primary:` external storage documents (e.g. a
file shared from the Files app's storage view) to a raw
/storage/emulated/0/... path. Under scoped storage the app can't read
that path, so the upload failed with EACCES. Copy those documents into
the cache through the content resolver like every other content uri.

Same change as upstream achorein/expo-share-intent#237.

**File**: `patches/expo-share-intent@8.0.1.patch` (modified, +20/-1)
```diff
@@ -1,5 +1,5 @@
 diff --git a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
-index ff5b1001e7bb3443482727cec48c22579465c73b..1ae6de08f1c8481121521d637f621ad86c073775 100644
+index ff5b1001e7bb3443482727cec48c22579465c73b..ea6c49ae22e8cc9126e45ffe163b3cc492413a7a 100644
 --- a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
 +++ b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
 @@ -41,6 +41,9 @@ class ExpoShareIntentModule : Module() {
@@ -59,6 +59,25 @@ index ff5b1001e7bb3443482727cec48c22579465c73b..1ae6de08f1c8481121521d637f621ad8
          }
  
          OnCreate {
+@@ -223,15 +242,9 @@ class ExpoShareIntentModule : Module() {
+             if (DocumentsContract.isDocumentUri(context, uri)) {
+                 // ExternalStorageProvider
+                 if (isExternalStorageDocument(uri)) {
+-                    val docId = DocumentsContract.getDocumentId(uri)
+-                    val split = docId.split(":".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
+-                    val type = split[0]
+-
+-                    return if ("primary".equals(type, ignoreCase = true)) {
+-                        Environment.getExternalStorageDirectory().toString() + "/" + split[1]
+-                    } else {
+-                        getDataColumn(uri, null, null)
+-                    }
++                    // Copy it like any other content uri: with scoped storage the app can't read
++                    // the file path of a document in shared storage, even on the primary volume.
++                    return getDataColumn(uri, null, null)
+                 } else if (isDownloadsDocument(uri)) {
+                     return try {
+                         val id = DocumentsContract.getDocumentId(uri)
 diff --git a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt
 index db573ecbd560de3c71aa443b7ad88d1b5e1c8dc7..17a0efcb3839b883814c35697fde8b2759bfea19 100644
 --- a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt
```

---

### Incident Patch 10: `e7fbaab7` (2026-10-04)
**Commit Message**: fix(mobile): fix lost and duplicated Android shares after process death

When Android kills the app in the background but keeps its task, sharing
into it recreates MainActivity with the task's original intent and
delivers the share through onNewIntent before expo-share-intent's native
module exists, so the share was dropped. If the task was itself started
by a share, every recreation replayed that old share, causing duplicates
or the wrong item being saved.

Patch expo-share-intent to buffer shares that arrive via onNewIntent
until JS reads them, and to skip replayed launch intents (launched from
history, or already consumed in the same task).

Fixes #513

**File**: `patches/expo-share-intent@8.0.1.patch` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+diff --git a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
+index ff5b1001e7bb3443482727cec48c22579465c73b..1ae6de08f1c8481121521d637f621ad86c073775 100644
+--- a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
++++ b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
+@@ -41,6 +41,9 @@ class ExpoShareIntentModule : Module() {
+     private val currentActivity: Activity?
+         get() = appContext.currentActivity
+ 
++    @Volatile
++    private var hasJsListeners = false
++
+     companion object {
+         private var instance: ExpoShareIntentModule? = null
+ 
+@@ -180,24 +183,40 @@ class ExpoShareIntentModule : Module() {
+         Events("onChange", "onStateChange", "onError")
+ 
+         AsyncFunction("getShareIntent") { _: String ->
+-            // get the Intent from onCreate activity (app not running in background)
++            // get the Intent stored by the activity lifecycle listener (onCreate / onNewIntent)
+             ExpoShareIntentSingleton.isPending = false
+-            if (ExpoShareIntentSingleton.intent?.type != null) {
+-                handleShareIntent(ExpoShareIntentSingleton.intent!!);
+-                ExpoShareIntentSingleton.intent = null
++            ExpoShareIntentSingleton.takePendingIntent(appContext.reactContext)?.let {
++                handleShareIntent(it)
+             }
+         }
+ 
+         Function("clearShareIntent") { _: String ->
+-            ExpoShareIntentSingleton.intent = null
++            ExpoShareIntentSingleton.clearPendingIntent()
+         }
+ 
+         Function("hasShareIntent") { _: String ->
+             ExpoShareIntentSingleton.isPending
+         }
+ 
++        OnStartObserving("onChange") {
++            hasJsListeners = true
++        }
++
++        OnStopObserving("onChange") {
++            hasJsListeners = false
++        }
++
+         OnNewIntent {
+-            handleShareIntent(it)
++            if (it.type != null) {
++                ExpoShareIntentSingleton.setPendingIntent(it, null)
++            }
++            // Events sent before JS subscribes are dropped. In that case leave the intent pending,
++            // JS fetches it with getShareIntent once it's mounted.
++            if (hasJsListeners) {
++                ExpoShareIntentSingleton.takePendingIntent(appContext.reactContext)?.let {
++                    handleShareIntent(it)
++                }
++            }
+         }
+ 
+         OnCreate {
+diff --git a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt
+index db573ecbd560de3c71aa443b7ad88d1b5e1c8dc7..17a0efcb3839b883814c35697fde8b2759bfea19 100644
+--- a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt
++++ b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentReactActivityLifecycleListener.kt
+@@ -13,10 +13,20 @@ import expo.modules.core.interfaces.ReactActivityLifecycleListener
+ class ExpoShareIntentReactActivityLifecycleListener(activityContext: Context) : ReactActivityLifecycleListener {
+ 
+     override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
++        val intent = activity?.intent ?: return
+         // only store when the new intent is not empty
+-        if (activity?.intent?.type != null) {
+-            ExpoShareIntentSingleton.intent = activity?.intent
+-            ExpoShareIntentSingleton.isPending = true
++        if (intent.type == null) return
++        if (ExpoShareIntentSingleton.isReplayedLaunchIntent(activity, activity.taskId, intent)) return
++        ExpoShareIntentSingleton.setPendingIntent(intent, activity.taskId)
++    }
++
++    // When the process was killed in the background, sharing recreates the activity with the task's
++    // original intent and delivers the share through onNewIntent right away, before the native
++    // module exists. Store it here so JS can still pick it up with getShareIntent.
++    override fun onNewIntent(intent: Intent?): Boolean {
++        if (intent?.type != null) {
++            ExpoShareIntentSingleton.setPendingIntent(intent, null)
+         }
++        return false
+     }
+ }
+diff --git a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentSingleton.kt b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentSingleton.kt
+index 7f93abe410557d8f909148e57d7311cabbe75b36..538c6be0274b9d8cc022e00c11e0efb1d5c5b2c4 100644
+--- a/android/src/main/java/expo/modules/shareintent/ExpoShareIntentSingleton.kt
++++ b/android/src/main/java/expo/modules/shareintent/ExpoShareIntentSingleton.kt
+@@ -1,5 +1,6 @@
+ package expo.modules.shareintent
+ 
++import android.content.Context
+ import android.content.Intent
+ import expo.modules.core.interfaces.Singleto
```

**File**: `pnpm-lock.yaml` (modified, +3/-2)
```diff
@@ -20,6 +20,7 @@ overrides:
 
 patchedDependencies:
   expo-modules-jsi@57.1.1: 0de91114675edaf8158061b65f08995617cd872a813892f81e28394ded741a77
+  expo-share-intent@8.0.1: b6e86be022ff16e70e0e69bcca5ad3191471b7020bf8c4edaa69fed488ad1680
   react-native@0.86.3: 7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1
   react-tweet@3.2.2: d7b79c3ae412d8e700a8c176df42ee89112c9bdc91d2aad0ebb7d5b011b49993
   xcode@3.0.1: 725863c0591d89ca053226c49fe7bc321f320391ec5f78b6c2e8e41ab1868805
@@ -448,7 +449,7 @@ importers:
         version: 57.0.4(expo@57.0.25)
       expo-share-intent:
         specifier: ^8.0.1
-        version: 8.0.1(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3)
+        version: 8.0.1(patch_hash=b6e86be022ff16e70e0e69bcca5ad3191471b7020bf8c4edaa69fed488ad1680)(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3)
       expo-sharing:
         specifier: ~57.0.22
         version: 57.0.22(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3)
@@ -28125,7 +28126,7 @@ snapshots:
 
   expo-server@57.0.3: {}
 
-  expo-share-intent@8.0.1(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3):
+  expo-share-intent@8.0.1(patch_hash=b6e86be022ff16e70e0e69bcca5ad3191471b7020bf8c4edaa69fed488ad1680)(expo-constants@57.0.19)(expo-linking@57.0.11)(expo@57.0.25)(react-native@0.86.3(patch_hash=7d74c7fbd33e9f3f3f8a8ba47a013acfc098948e39c7faab1232e6edca358ac1)(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.15)(react@19.2.3))(react@19.2.3)(typescript@5.9.3):
     dependencies:
       '@expo/config-plugins': 57.0.9(typescript@5.9.3)
       expo: 57.0.25(6b33b2113934110f2459ad3be3e8fb0f)
```

**File**: `pnpm-workspace.yaml` (modified, +3/-0)
```diff
@@ -30,6 +30,9 @@ patchedDependencies:
   # Disables React 19.2's dev "component performance track" prop serialization,
   # which crashes when a changed prop is a tRPC proxy (RN 0.86 + new arch).
   react-native@0.86.3: patches/react-native@0.86.3.patch
+  # Android: don't drop shares that arrive while the app is being recreated after
+  # process death, and don't replay the task's launch share on reopen (#513).
+  expo-share-intent@8.0.1: patches/expo-share-intent@8.0.1.patch
 
 # Docker builds can prune packages that use one of the root patches.
 allowUnusedPatches: true
```

---

### Incident Patch 11: `25824627` (2026-10-04)
**Commit Message**: fix(web): improve the look of focus rings

**File**: `apps/web/components/dashboard/bookmarks/BookmarkOptions.tsx` (modified, +1/-4)
```diff
@@ -506,10 +506,7 @@ export default function BookmarkOptions({ bookmark }: { bookmark: ZBookmark }) {
       />
       <DropdownMenu>
         <DropdownMenuTrigger asChild>
-          <Button
-            variant="ghost"
-            className="px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
-          >
+          <Button variant="ghost" className="px-1 focus-visible:ring-0">
             <MoreHorizontal />
           </Button>
         </DropdownMenuTrigger>
```

**File**: `apps/web/components/dashboard/bookmarks/TagsEditor.tsx` (modified, +2/-2)
```diff
@@ -313,7 +313,7 @@ export function TagsEditor({
           <PopoverTrigger asChild>
             <div
               className={cn(
-                "relative flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
+                "relative flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
                 isDisabled && "cursor-not-allowed opacity-50",
               )}
             >
@@ -337,7 +337,7 @@ export function TagsEditor({
                         {!isDisabled && (
                           <button
                             type="button"
-                            className="rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-2"
+                            className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                             onClick={(e) => {
                               e.stopPropagation();
                               onChange({
```

**File**: `apps/web/components/dashboard/lists/BookmarkListSelector.tsx` (modified, +2/-2)
```diff
@@ -222,7 +222,7 @@ function BookmarkListMultiSelector({
         aria-disabled={disabled}
         aria-expanded={disabled ? false : open}
         className={cn(
-          "relative flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background transition-colors",
+          "relative flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
           disabled && "cursor-not-allowed opacity-50",
           className,
         )}
@@ -251,7 +251,7 @@ function BookmarkListMultiSelector({
                     <button
                       type="button"
                       disabled={disabled}
-                      className="cursor-pointer rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed"
+                      className="cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
                       onClick={(e) => {
                         e.stopPropagation();
                         removeSelection(listId);
```

**File**: `apps/web/components/shared/sidebar/SidebarVersion.tsx` (modified, +1/-1)
```diff
@@ -200,7 +200,7 @@ export default function SidebarVersion({
           aria-label={
             shouldNotify ? t("version.new_release_available") : undefined
           }
-          className="flex w-full items-center justify-between text-left text-sm text-gray-400 transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
+          className="flex w-full items-center justify-between rounded-sm text-left text-sm text-gray-400 transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
         >
           <span aria-hidden={shouldNotify}>{versionLabel}</span>
           {shouldNotify && (
```

**File**: `apps/web/components/ui/badge.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { cn } from "@/lib/utils";
 import { cva } from "class-variance-authority";
 
 const badgeVariants = cva(
-  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
+  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
   {
     variants: {
       variant: {
```

**File**: `apps/web/components/ui/dialog.tsx` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ const DialogContent = React.forwardRef<
     >
       {children}
       {!hideCloseBtn && (
-        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none">
+        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none">
           <X className="size-4" />
           <span className="sr-only">Close</span>
         </DialogPrimitive.Close>
```

**File**: `apps/web/components/ui/input.tsx` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ const Input = React.forwardRef<HTMLInputElement, InputProps>(
         <input
           type={type}
           className={cn(
-            "flex h-10 w-full rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
+            "flex h-10 w-full rounded-md border border-input bg-background px-4 py-2 text-sm transition-[color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
             startIcon ? "pl-8" : "",
             endIcon ? "pr-8" : "",
             className,
```

**File**: `apps/web/components/ui/radio-group.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ const RadioGroupItem = React.forwardRef<
     <RadioGroupPrimitive.Item
       ref={ref}
       className={cn(
-        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
+        "aspect-square h-4 w-4 rounded-full border border-primary text-primary transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
         className,
       )}
       {...props}
```

---

### Incident Patch 12: `2fe651ff` (2026-10-04)
**Commit Message**: fix(web): refresh the look of dropdown menus

**File**: `apps/web/components/dashboard/ViewOptions.tsx` (modified, +77/-102)
```diff
@@ -12,6 +12,7 @@ import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
+  DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
@@ -138,37 +139,31 @@ export default function ViewOptions() {
         </ButtonWithTooltip>
       </DropdownMenuTrigger>
       <DropdownMenuContent className="w-56">
-        <div className="px-2 py-1.5 text-sm font-semibold">
+        <DropdownMenuLabel className="text-xs text-muted-foreground">
           {t("view_options.layout")}
-        </div>
+        </DropdownMenuLabel>
         {(Object.keys(iconMap) as LayoutType[]).map((key) => (
           <DropdownMenuItem
             key={key}
-            className="cursor-pointer justify-between"
+            className="cursor-pointer"
             onSelect={(e) => {
               e.preventDefault();
               handleLayoutChange(key);
             }}
           >
-            <div className="flex items-center gap-2">
-              {createElement(iconMap[key as LayoutType], { size: 18 })}
-              <span>{t(`layouts.${key}`)}</span>
-            </div>
-            {optimisticLayout === key && <Check className="ml-2 size-4" />}
+            {createElement(iconMap[key])}
+            <span>{t(`layouts.${key}`)}</span>
+            {optimisticLayout === key && <Check className="ml-auto" />}
           </DropdownMenuItem>
         ))}
 
         {showColumnSlider && (
           <>
             <DropdownMenuSeparator />
-            <div className="px-2 py-3">
-              <div className="mb-2 flex items-center justify-between">
-                <span className="text-sm font-semibold">
-                  {t("view_options.columns")}
-                </span>
-                <span className="text-sm text-muted-foreground">
-                  {tempColumns}
-                </span>
+            <div className="px-2 pb-3 pt-1.5">
+              <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
+                <span>{t("view_options.columns")}</span>
+                <span>{tempColumns}</span>
               </div>
               <Slider
                 value={[tempColumns]}
@@ -179,103 +174,83 @@ export default function ViewOptions() {
                 step={1}
                 className="w-full"
               />
-              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
-                <span>1</span>
-                <span>6</span>
-              </div>
             </div>
           </>
         )}
 
         <DropdownMenuSeparator />
-        <div className="px-2 py-1.5 text-sm font-semibold">
+        <DropdownMenuLabel className="text-xs text-muted-foreground">
           {t("view_options.display_options")}
+        </DropdownMenuLabel>
+        <div className="flex items-center justify-between px-2 py-1.5">
+          <Label
+            htmlFor="show-notes"
+            className="flex flex-1 cursor-pointer items-center gap-2 font-normal leading-normal"
+          >
+            <NotepadText className="size-4 text-muted-foreground" />
+            <span>{t("view_options.show_note_previews")}</span>
+          </Label>
+          <Switch
+            id="show-notes"
+            checked={optimisticDisplaySettings.showNotes}
+            onCheckedChange={handleShowNotesChange}
+          />
         </div>
-
-        <div className="space-y-3 px-2 py-2">
-          <div className="flex items-center justify-between">
-            <Label
-              htmlFor="show-notes"
-              className="flex cursor-pointer items-center gap-2 text-sm"
-            >
-              <NotepadText size={16} />
-              <span>{t("view_options.show_note_previews")}</span>
-            </Label>
-            <Switch
-              id="show-notes"
-              checked={optimisticDisplaySettings.showNotes}
-              onCheckedChange={handleShowNotesChange}
-            />
-          </div>
-
-          <div className="flex items-center justify-between">
-            <Label
-              htmlFor="show-tags"
-              className="flex cursor-pointer items-center gap-2 text-sm"
-            >
-              <Tag size={16} />
-              <span>{t("view_options.show_tags")}</span>
-            </Label>
-            <Switch
-              id="show-tags"
-              checked={optimisticDisplaySettings.showTags}
-              onCheckedChange={handleShowTagsChange}
-            />
-          </div>
-
-          <div className="flex items-center justify-between">
-            <Label
-              htmlFor="show-title"
-              className="flex cursor-pointer items-center gap-2 text-sm"
-            >
-              <Heading size={16} />
-              <span>{t("view_options.show_title")}</span>
-            </Label>
-            <Switch
-              id="show-title"
-              checked={optimisticDisplaySettings.showTitle}
-              onCheckedChange={handle
```

**File**: `apps/web/components/dashboard/bookmarks/BookmarkOptions.tsx` (modified, +277/-261)
```diff
@@ -1,11 +1,12 @@
 "use client";
 
-import { ChangeEvent, useEffect, useRef, useState } from "react";
+import { ChangeEvent, Fragment, useEffect, useRef, useState } from "react";
 import { Button } from "@/components/ui/button";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
+  DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
@@ -17,7 +18,7 @@ import { useClientConfig } from "@/lib/clientConfig";
 import useUpload from "@/lib/hooks/upload-file";
 import { useTranslation } from "@/lib/i18n/client";
 import {
-  Archive,
+  HardDriveDownload,
   Circle,
   Download,
   FileDown,
@@ -65,7 +66,7 @@ interface ActionItem {
   icon: React.ReactNode;
   visible: boolean;
   disabled: boolean;
-  className?: string;
+  variant?: "destructive";
   onClick: () => void;
 }
 
@@ -244,234 +245,244 @@ export default function BookmarkOptions({ bookmark }: { bookmark: ZBookmark }) {
   };
 
   // Define action items array
-  const actionItems: ActionItemType[] = [
-    {
-      id: "select",
-      title: t("actions.select"),
-      icon: <Circle className="mr-2 size-4" />,
-      visible: isOwner && isTouchDevice,
-      disabled: false,
-      onClick: () => enableBulkEditForBookmark(bookmark.id),
-    },
-    {
-      id: "edit",
-      title: t("actions.edit"),
-      icon: <Pencil className="mr-2 size-4" />,
-      visible: isOwner,
-      disabled: false,
-      onClick: () => setEditBookmarkDialogOpen(true),
-    },
-    {
-      id: "open-editor",
-      title: t("actions.open_editor"),
-      icon: <SquarePen className="mr-2 size-4" />,
-      visible: isOwner && bookmark.content.type === BookmarkTypes.TEXT,
-      disabled: false,
-      onClick: () => setTextEditorOpen(true),
-    },
-    {
-      id: "favorite",
-      title: bookmark.favourited
-        ? t("actions.unfavorite")
-        : t("actions.favorite"),
-      icon: (
-        <FavouritedActionIcon
-          className="mr-2 size-4"
-          favourited={bookmark.favourited}
-        />
-      ),
-      visible: isOwner,
-      disabled: demoMode,
-      onClick: () =>
-        updateBookmarkMutator.mutate({
-          bookmarkId: linkId,
-          favourited: !bookmark.favourited,
-        }),
-    },
-    {
-      id: "archive",
-      title: bookmark.archived ? t("actions.unarchive") : t("actions.archive"),
-      icon: (
-        <ArchivedActionIcon
-          className="mr-2 size-4"
-          archived={bookmark.archived}
-        />
-      ),
-      visible: isOwner,
-      disabled: demoMode,
-      onClick: () =>
-        updateBookmarkMutator.mutate({
-          bookmarkId: linkId,
-          archived: !bookmark.archived,
-        }),
-    },
-    {
-      id: "copy-link",
-      title: t("actions.copy_link"),
-      icon: <Link className="mr-2 size-4" />,
-      visible: bookmark.content.type === BookmarkTypes.LINK,
-      disabled: !isClipboardAvailable,
-      onClick: () => {
-        navigator.clipboard.writeText(
-          (bookmark.content as ZBookmarkedLink).url,
-        );
-        toast.success(t("toasts.bookmarks.clipboard_copied"));
+  const actionGroups: ActionItemType[][] = [
+    [
+      {
+        id: "select",
+        title: t("actions.select"),
+        icon: <Circle className="size-4" />,
+        visible: isOwner && isTouchDevice,
+        disabled: false,
+        onClick: () => enableBulkEditForBookmark(bookmark.id),
       },
-    },
-    {
-      id: "manage-lists",
-      title: t("actions.manage_lists"),
-      icon: <List className="mr-2 size-4" />,
-      visible: isOwner,
-      disabled: false,
-      onClick: () => setManageListsModalOpen(true),
-    },
-    {
-      id: "remove-from-list",
-      title: t("actions.remove_from_list"),
-      icon: <ListX className="mr-2 size-4" />,
-      visible: Boolean(
-        (isOwner ||
-          (withinListContext &&
-            (withinListContext.userRole === "editor" ||
-              withinListContext.userRole === "owner"))) &&
-        !!listId &&
-        !!withinListContext &&
-        withinListContext.type === "manual",
-      ),
-      disabled: demoMode,
-      onClick: () =>
-        removeFromListMutator.mutate({
-          listId: listId!,
-          bookmarkId: bookmark.id,
-        }),
-    },
-    {
-      id: "offline-copies",
-      title: t("actions.offline_copies"),
-      icon: <Archive className="mr-2 size-4" />,
-      visible: isOwner && bookmark.content.type === BookmarkTypes.LINK,
-      items: [
-        {
-          id: "download-full-page",
-          title: t("actions.preserve_offline_archive"),
-          icon: <FileDown className="mr-2 size-4" />,
-          visible: true,
-          disabled: demoMode,
-          onClick: () => {
-            fullPageArchiveBookmarkMutator.mutate({
-              bookmarkId: bookmark.id,
-              archiveFullPage: true,
-            });
-          },
+      {
+        id: "edit",
+        title: t("actions.edit"),
+      
```

**File**: `apps/web/components/dashboard/header/ProfileOptions.tsx` (modified, +9/-9)
```diff
@@ -42,14 +42,14 @@ function DarkModeToggle() {
   if (theme == "dark") {
     return (
       <>
-        <Sun className="mr-2 size-4" />
+        <Sun className="size-4" />
         <span>{t("options.light_mode")}</span>
       </>
     );
   } else {
     return (
       <>
-        <Moon className="mr-2 size-4" />
+        <Moon className="size-4" />
         <span>{t("options.dark_mode")}</span>
       </>
     );
@@ -106,7 +106,7 @@ export default function SidebarProfileOptions() {
         <Separator className="my-2" />
         <DropdownMenuItem asChild>
           <Link href="/settings">
-            <Settings className="mr-2 size-4" />
+            <Settings className="size-4" />
             {t("settings.user_settings")}
           </Link>
         </DropdownMenuItem>
@@ -124,7 +124,7 @@ export default function SidebarProfileOptions() {
         <Separator className="my-2" />
         <DropdownMenuItem asChild>
           <Link href="/dashboard/cleanups">
-            <Paintbrush className="mr-2 size-4" />
+            <Paintbrush className="size-4" />
             {t("cleanups.cleanups")}
           </Link>
         </DropdownMenuItem>
@@ -133,32 +133,32 @@ export default function SidebarProfileOptions() {
         </DropdownMenuItem>
         {inBookmarkGrid && (
           <DropdownMenuItem onClick={() => setShortcutsDialogOpen(true)}>
-            <Keyboard className="mr-2 size-4" />
+            <Keyboard className="size-4" />
             {t("keyboard_shortcuts.title")}
           </DropdownMenuItem>
         )}
         <Separator className="my-2" />
         <DropdownMenuItem asChild>
           <a href="https://karakeep.app/apps" target="_blank" rel="noreferrer">
-            <Puzzle className="mr-2 size-4" />
+            <Puzzle className="size-4" />
             {t("options.apps_extensions")}
           </a>
         </DropdownMenuItem>
         <DropdownMenuItem asChild>
           <a href="https://docs.karakeep.app" target="_blank" rel="noreferrer">
-            <BookOpen className="mr-2 size-4" />
+            <BookOpen className="size-4" />
             {t("options.documentation")}
           </a>
         </DropdownMenuItem>
         <DropdownMenuItem asChild>
           <a href="https://x.com/karakeep_app" target="_blank" rel="noreferrer">
-            <Twitter className="mr-2 size-4" />
+            <Twitter className="size-4" />
             {t("options.follow_us_on_x")}
           </a>
         </DropdownMenuItem>
         <Separator className="my-2" />
         <DropdownMenuItem onClick={() => router.push("/logout")}>
-          <LogOut className="mr-2 size-4" />
+          <LogOut className="size-4" />
           <span>{t("actions.sign_out")}</span>
         </DropdownMenuItem>
       </DropdownMenuContent>
```

**File**: `apps/web/components/dashboard/lists/ListOptions.tsx` (modified, +3/-3)
```diff
@@ -118,7 +118,7 @@ export function ListOptions({
       icon: <DoorOpen className="size-4" />,
       visible: isCollaborator,
       disabled: false,
-      className: "flex gap-2 text-destructive",
+      variant: "destructive" as const,
       onClick: () => setLeaveListDialogOpen(true),
     },
     {
@@ -127,7 +127,7 @@ export function ListOptions({
       icon: <Trash2 className="size-4" />,
       visible: isOwner,
       disabled: false,
-      className: "flex gap-2 text-destructive",
+      variant: "destructive" as const,
       onClick: () => setDeleteListDialogOpen(true),
     },
   ];
@@ -185,7 +185,7 @@ export function ListOptions({
         {visibleItems.map((item) => (
           <DropdownMenuItem
             key={item.id}
-            className={item.className ?? "flex gap-2"}
+            variant={item.variant}
             disabled={item.disabled}
             onClick={item.onClick}
           >
```

**File**: `apps/web/components/dashboard/tags/TagOptions.tsx` (modified, +4/-13)
```diff
@@ -48,32 +48,23 @@ export function TagOptions({
       />
       <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
       <DropdownMenuContent>
-        <DropdownMenuItem
-          className="flex gap-2"
-          onClick={() => setRenameTagDialogOpen(true)}
-        >
+        <DropdownMenuItem onClick={() => setRenameTagDialogOpen(true)}>
           <Pencil className="size-4" />
           <span>{t("actions.rename")}</span>
         </DropdownMenuItem>
-        <DropdownMenuItem
-          className="flex gap-2"
-          onClick={() => setMergeTagDialogOpen(true)}
-        >
+        <DropdownMenuItem onClick={() => setMergeTagDialogOpen(true)}>
           <Combine className="size-4" />
           <span>{t("actions.merge")}</span>
         </DropdownMenuItem>
-        <DropdownMenuItem className="flex gap-2" onClick={onClickShowArchived}>
+        <DropdownMenuItem onClick={onClickShowArchived}>
           {showArchived ? (
             <SquareCheck className="size-4" />
           ) : (
             <Square className="size-4" />
           )}
           <span>{t("actions.toggle_show_archived")}</span>
         </DropdownMenuItem>
-        <DropdownMenuItem
-          className="flex gap-2"
-          onClick={() => setDeleteTagDialogOpen(true)}
-        >
+        <DropdownMenuItem onClick={() => setDeleteTagDialogOpen(true)}>
           <Trash2 className="size-4" />
           <span>{t("actions.delete")}</span>
         </DropdownMenuItem>
```

**File**: `apps/web/components/ui/dropdown-menu.tsx` (modified, +15/-10)
```diff
@@ -26,7 +26,7 @@ const DropdownMenuSubTrigger = React.forwardRef<
   <DropdownMenuPrimitive.SubTrigger
     ref={ref}
     className={cn(
-      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
+      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
       inset && "pl-8",
       className,
     )}
@@ -46,7 +46,7 @@ const DropdownMenuSubContent = React.forwardRef<
   <DropdownMenuPrimitive.SubContent
     ref={ref}
     className={cn(
-      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
+      "z-50 min-w-[8rem] origin-[--radix-dropdown-menu-content-transform-origin] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
       className,
     )}
     {...props}
@@ -64,7 +64,7 @@ const DropdownMenuContent = React.forwardRef<
       ref={ref}
       sideOffset={sideOffset}
       className={cn(
-        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
+        "z-50 max-h-[--radix-dropdown-menu-content-available-height] min-w-[8rem] origin-[--radix-dropdown-menu-content-transform-origin] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
         className,
       )}
       {...props}
@@ -77,12 +77,14 @@ const DropdownMenuItem = React.forwardRef<
   React.ElementRef<typeof DropdownMenuPrimitive.Item>,
   React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
     inset?: boolean;
+    variant?: "default" | "destructive";
   }
->(({ className, inset, ...props }, ref) => (
+>(({ className, inset, variant = "default", ...props }, ref) => (
   <DropdownMenuPrimitive.Item
     ref={ref}
+    data-variant={variant}
     className={cn(
-      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
+      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[variant=destructive]:text-destructive data-[disabled]:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&[data-variant=destructive]_svg]:!text-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
       inset && "pl-8",
       className,
     )}
@@ -98,7 +100,7 @@ const DropdownMenuCheckboxItem = React.forwardRef<
   <DropdownMenuPrimitive.CheckboxItem
     ref={ref}
     className={cn(
-      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
+      "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-event
```

**File**: `apps/web/components/ui/switch.tsx` (modified, +2/-2)
```diff
@@ -10,15 +10,15 @@ const Switch = React.forwardRef<
 >(({ className, ...props }, ref) => (
   <SwitchPrimitives.Root
     className={cn(
-      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
+      "peer inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-sm transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
       className,
     )}
     {...props}
     ref={ref}
   >
     <SwitchPrimitives.Thumb
       className={cn(
-        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
+        "pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
       )}
     />
   </SwitchPrimitives.Root>
```

---

### Incident Patch 13: `ed774c13` (2026-09-27)
**Commit Message**: fix(workers): detect PerimeterX's "Robot or human?" challenge page

PerimeterX serves its captcha interstitial with a 200 and the title
"Robot or human?", which isLikelyChallengePage didn't recognize, so the
block page's metadata could win over the probe's.

**File**: `apps/workers/workers/utils/metadataResolver.test.ts` (modified, +1/-0)
```diff
@@ -80,6 +80,7 @@ describe("isLikelyChallengePage", () => {
     ).toBe(true);
     expect(isLikelyChallengePage({ title: "Access Denied" })).toBe(true);
     expect(isLikelyChallengePage({ title: "Robot Check" })).toBe(true);
+    expect(isLikelyChallengePage({ title: "Robot or human?" })).toBe(true);
   });
 
   it("does not match challenge titles as substrings of real titles", () => {
```

**File**: `apps/workers/workers/utils/metadataResolver.ts` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ const CHALLENGE_PAGE_TITLES = new Set([
   // PerimeterX
   "access to this page has been denied",
   "access to this page has been denied.",
+  "robot or human?",
   // Amazon / Bloomberg
   "robot check",
   "are you a robot?",
```

---

### Incident Patch 14: `dae09664` (2026-10-03)
**Commit Message**: fix: fix a memory leak caused by gcTime calls on the server (#3138)

**File**: `apps/web/components/dashboard/bookmarks/TagsEditor.tsx` (modified, +8/-2)
```diff
@@ -15,7 +15,7 @@ import {
 import { useClientConfig } from "@/lib/clientConfig";
 import { useTranslation } from "@/lib/i18n/client";
 import { cn } from "@/lib/utils";
-import { keepPreviousData, useQuery } from "@tanstack/react-query";
+import { isServer, keepPreviousData, useQuery } from "@tanstack/react-query";
 import { Command as CommandPrimitive } from "cmdk";
 import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
 
@@ -114,7 +114,13 @@ export function TagsEditor({
                 : ("ai" as const),
           })),
         placeholderData: keepPreviousData,
-        gcTime: inputValue.length > 0 ? 60_000 : 3_600_000,
+        // A finite gcTime on the server schedules a timer that pins the
+        // request's query cache in memory; keep the default (Infinity) there.
+        gcTime: isServer
+          ? Infinity
+          : inputValue.length > 0
+            ? 60_000
+            : 3_600_000,
       },
     ),
   );
```

**File**: `packages/shared-react/hooks/tags.ts` (modified, +9/-2)
```diff
@@ -1,4 +1,5 @@
 import {
+  isServer,
   keepPreviousData,
   useInfiniteQuery,
   useMutation,
@@ -21,7 +22,9 @@ export function usePaginatedSearchTags(
     ...api.tags.list.infiniteQueryOptions(input, {
       placeholderData: keepPreviousData,
       getNextPageParam: (lastPage) => lastPage.nextCursor,
-      gcTime: 60_000,
+      // On the server, a finite gcTime schedules a timer that pins the
+      // request's query cache in memory; leave it at the default (Infinity).
+      gcTime: isServer ? Infinity : 60_000,
     }),
     select: (data) => ({
       tags: data.pages.flatMap((page) => page.tags),
@@ -44,7 +47,11 @@ export function useTagAutocomplete<T = ZTagListResponse>(opts: {
       },
       {
         placeholderData: keepPreviousData,
-        gcTime: opts.nameContains?.length > 0 ? 60_000 : 3_600_000,
+        gcTime: isServer
+          ? Infinity
+          : opts.nameContains?.length > 0
+            ? 60_000
+            : 3_600_000,
         enabled: opts.enabled,
       },
     ),
```

---

### Incident Patch 15: `f908b02e` (2026-09-27)
**Commit Message**: fix(web): a better looking dialog backdrop

**File**: `apps/web/components/ui/dialog.tsx` (modified, +5/-8)
```diff
@@ -20,7 +20,7 @@ const DialogOverlay = React.forwardRef<
   <DialogPrimitive.Overlay
     ref={ref}
     className={cn(
-      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
+      "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
       className,
     )}
     {...props}
@@ -39,14 +39,14 @@ const DialogContent = React.forwardRef<
     <DialogPrimitive.Content
       ref={ref}
       className={cn(
-        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
+        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border bg-background p-6 shadow-2xl duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2",
         className,
       )}
       {...props}
     >
       {children}
       {!hideCloseBtn && (
-        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
+        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none">
           <X className="size-4" />
           <span className="sr-only">Close</span>
         </DialogPrimitive.Close>
@@ -62,7 +62,7 @@ const DialogHeader = ({
 }: React.HTMLAttributes<HTMLDivElement>) => (
   <div
     className={cn(
-      "flex flex-col space-y-1.5 text-center sm:text-left",
+      "flex flex-col gap-1.5 text-center sm:pr-8 sm:text-left",
       className,
     )}
     {...props}
@@ -90,10 +90,7 @@ const DialogTitle = React.forwardRef<
 >(({ className, ...props }, ref) => (
   <DialogPrimitive.Title
     ref={ref}
-    className={cn(
-      "text-lg font-semibold leading-none tracking-tight",
-      className,
-    )}
+    className={cn("text-base font-semibold leading-snug", className)}
     {...props}
   />
 ));
```

#### Recent Merged Pull Requests:
- **PR #3140** (2026-10-04): feat(web): Migrate from next-auth to better-auth (@MohamedBassem)
- **PR #3138** (2026-10-03): fix: fix a memory leak caused by gcTime calls on the server (@MohamedBassem)
- **PR #3136** (closed): fix(chrome): include CJK fonts in browser image (@pentaoa)
- **PR #3135** (closed): docs: add bagcarry (wallabag import) to community projects (@Rezarys)
- **PR #3127** (2026-09-26): fix(mobile): ignore unreliable Android internet reachability (@MohamedBassem)
- **PR #3126** (2026-09-26): deps: upgrade to expo 57 (@MohamedBassem)
- **PR #3125** (2026-09-26): ci: optimize docker image building for caching (@MohamedBassem)
- **PR #3124** (2026-09-26): docs: add KaraClone to community projects (@gowinder)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
