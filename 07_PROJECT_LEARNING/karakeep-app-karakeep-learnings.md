# Forensic Learning Record (Deep Inspection): karakeep-app/karakeep

> **Canonical Artifact**: `07_PROJECT_LEARNING/karakeep-app-karakeep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/karakeep-app/karakeep](https://github.com/karakeep-app/karakeep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:02:10.306Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karakeep-app/karakeep`
- **Description**: A self-hostable bookmark-everything app (links, notes and images) with AI-based automatic tagging and full text search
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 29363 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/browser-extension/postcss.config.js`
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `apps/browser-extension/src/BookmarkDeletedPage.tsx`
```
export default function BookmarkDeletedPage() {
  return <p className="text-xl">Bookmark Deleted!</p>;
}

```

### Core Architecture Module: `apps/browser-extension/src/BookmarkSavedPage.tsx`
```
import { useState } from "react";
import { ArrowUpRightFromSquare, Trash } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useDeleteBookmark } from "@karakeep/shared-react/hooks/bookmarks";

import BookmarkLists from "./components/BookmarkLists";
import { ListsSelector } from "./components/ListsSelector";
import { NoteEditor } from "./components/NoteEditor";
import TagList from "./components/TagList";
import { TagsSelector } from "./components/TagsSelector";
import { Button, buttonVariants } from "./components/ui/button";
import Spinner from "./Spinner";
import { cn } from "./utils/css";
import usePluginSettings from "./utils/settings";
import { MessageType } from "./utils/type";

export default function BookmarkSavedPage() {
  const { bookmarkId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const { mutate: deleteBookmark, isPending } = useDeleteBookmark({
    onSuccess: async () => {
      try {
        const [currentTab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        await chrome.runtime.sendMessage({
          type: MessageType.BOOKMARK_REFRESH_BADGE,
          currentTab: currentTab,
        });
      } catch {
        // Badge refresh is best-effort — on Firefox Android the background
        // script may not be reachable from the popup context.
      }
      navigate("/bookmarkdeleted");
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  const { settings } = usePluginSettings();

  if (!bookmarkId) {
    return <div>NOT FOUND</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-red-500">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl">Hoarded!</p>
        <div className="flex gap-2">
          <Link
            className={cn(
              buttonVariants({ variant: "link" }),
              "flex gap-2 rounded-md p-3",
            )}
            target="_blank"
            rel="noreferrer"
            to={`${settings.address}/dashboard/preview/${bookmarkId}`}
          >
            <ArrowUpRightFromSquare className="my-auto" size="20" />
            <p className="my-auto">Open</p>
          </Link>
          <Button
            variant="link"
            onClick={() => deleteBookmark({ bookmarkId })}
            className="flex gap-2 text-red-500 hover:text-red-500"
          >
            {!isPending ? (
              <>
                <Trash className="my-auto" size="20" />
                <p className="my-auto">Delete</p>
              </>
            ) : (
              <span className="m-auto">
                <Spinner />
              </span>
            )}
          </Button>
        </div>
      </div>
      <hr />
      <p className="text-lg">Notes</p>
      <NoteEditor bookmarkId={bookmarkId} />
      <hr />
      <p className="text-lg">Tags</p>
      <TagList bookmarkId={bookmarkId} />
      <TagsSelector bookmarkId={bookmarkId} />
      <hr />
      <p className="text-lg">Lists</p>
      <BookmarkLists bookmarkId={bookmarkId} />
      <ListsSelector bookmarkId={bookmarkId} />
    </div>
  );
}

```

### Core Architecture Module: `apps/browser-extension/src/CustomHeadersPage.tsx`
```
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import Logo from "./Logo";
import usePluginSettings from "./utils/settings";

export default function CustomHeadersPage() {
  const navigate = useNavigate();
  const { settings, setSettings } = usePluginSettings();

  // Convert headers object to array of entries for easier manipulation
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  // Update headers when settings change (e.g., when loaded from storage)
  useEffect(() => {
    setHeaders(
      Object.entries(settings.customHeaders || {}).map(([key, value]) => ({
        key,
        value,
      })),
    );
  }, [settings.customHeaders]);

  const handleAddHeader = () => {
    if (!newHeaderKey.trim() || !newHeaderValue.trim()) {
      return;
    }

    // Check if header already exists
    const existingIndex = headers.findIndex((h) => h.key === newHeaderKey);
    if (existingIndex >= 0) {
      // Update existing header
      const updatedHeaders = [...headers];
      updatedHeaders[existingIndex].value = newHeaderValue;
      setHeaders(updatedHeaders);
    } else {
      // Add new header
      setHeaders([...headers, { key: newHeaderKey, value: newHeaderValue }]);
    }

    setNewHeaderKey("");
    setNewHeaderValue("");
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Convert array back to object
    const headersObject = headers.reduce(
      (acc, { key, value }) => {
        if (key.trim() && value.trim()) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    setSettings((s) => ({ ...s, customHeaders: headersObject }));
    navigate(-1);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="flex flex-col space-y-2">
      <Logo />
      <span className="text-lg">Custom Headers</span>
      <p className="text-sm text-muted-foreground">
        Add custom HTTP headers that will be sent with every API request.
      </p>
      <hr />

      {/* Existing Headers List */}
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {headers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No custom headers configured
          </p>
        ) : (
          headers.map((header, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border bg-background p-3"
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">{header.key}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {header.value}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveHeader(index)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <hr />

      {/* Add New Header */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Add New Header</p>
        <Input
          placeholder="Header Name (e.g., X-Custom-Header)"
          value={newHeaderKey}
          onChange={(e) => setNewHeaderKey(e.target.value)}
          autoCapitalize="none"
        />
        <Input
          placeholder="Header Value"
          value={newHeaderValue}
          onChange={(e) => setNewHeaderValue(e.target.value)}
          autoCapitalize="none"
        />
        <Button
          variant="secondary"
          onClick={handleAddHeader}
          disabled={!newHeaderKey.trim() || !newHeaderValue.trim()}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Header
        </Button>
      </div>

      <hr />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} className="flex-1">
          Save
        </Button>
      </div>
    </div>
  );
}

```

### Core Architecture Module: `apps/browser-extension/src/Layout.tsx`
```
import { Home, RefreshCw, Settings, X } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";
import usePluginSettings from "./utils/settings";

export default function Layout() {
  const navigate = useNavigate();
  const { settings, isPending: isInit } = usePluginSettings();
  if (!isInit) {
    return <div className="p-4">Loading ... </div>;
  }

  if (!settings.apiKey || !settings.address) {
    navigate("/notconfigured");
    return;
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-900">
        <Outlet />
      </div>
      <hr />
      <div className="flex justify-between space-x-3">
        <div className="my-auto">
          <a
            className="flex gap-2 text-foreground"
            target="_blank"
            rel="noreferrer"
            href={`${settings.address}/dashboard/bookmarks`}
          >
            <Home />
            <span className="text-md my-auto">Bookmarks</span>
          </a>
        </div>
        <div className="flex space-x-3">
          {process.env.NODE_ENV == "development" && (
            <Button onClick={() => navigate(0)}>
              <RefreshCw className="w-4" />
            </Button>
          )}
          <Button onClick={() => navigate("/options")}>
            <Settings className="w-4" />
          </Button>
          <Button onClick={() => window.close()}>
            <X className="w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

```

### Core Architecture Module: `apps/browser-extension/src/Logo.tsx`
```
import logoImgWhite from "../public/logo-full-white.png";
import logoImg from "../public/logo-full.png";

export default function Logo() {
  return (
    <span className="flex items-center justify-center">
      <img src={logoImg} alt="karakeep logo" className="h-14 dark:hidden" />
      <img
        src={logoImgWhite}
        alt="karakeep logo"
        className="hidden h-14 dark:block"
      />
    </span>
  );
}

```

### Core Architecture Module: `apps/browser-extension/src/NotConfiguredPage.tsx`
```
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import Logo from "./Logo";
import usePluginSettings from "./utils/settings";
import { isHttpUrl } from "./utils/url";

export default function NotConfiguredPage() {
  const navigate = useNavigate();

  const { settings, setSettings } = usePluginSettings();

  const [error, setError] = useState("");
  const [serverAddress, setServerAddress] = useState(settings.address);

  useEffect(() => {
    setServerAddress(settings.address);
  }, [settings.address]);

  const onSave = () => {
    const input = serverAddress.trim();
    if (input == "") {
      setError("Server address is required");
      return;
    }

    // Add URL protocol validation
    if (!isHttpUrl(input)) {
      setError("Server address must start with http:// or https://");
      return;
    }

    setSettings((s) => ({ ...s, address: input.replace(/\/$/, "") }));
    navigate("/signin");
  };

  return (
    <div className="flex flex-col space-y-2">
      <Logo />
      <span className="pt-3">
        To use the plugin, you need to configure it first.
      </span>
      <p className="text-red-500">{error}</p>
      <div className="flex gap-2">
        <label className="my-auto">Server Address</label>
        <Input
          name="address"
          value={serverAddress}
          className="h-8 flex-1 rounded-lg border border-gray-300 p-2"
          onChange={(e) => setServerAddress(e.target.value)}
        />
      </div>
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => navigate("/customheaders")}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Configure Custom Headers
          {settings.customHeaders &&
            Object.keys(settings.customHeaders).length > 0 &&
            ` (${Object.keys(settings.customHeaders).length})`}
        </button>
      </div>
      <Button onClick={onSave}>Configure</Button>
    </div>
  );
}

```

### Core Architecture Module: `apps/browser-extension/src/OptionsPage.tsx`
```
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import Logo from "./Logo";
import Spinner from "./Spinner";
import {
  hasHostPermission,
  removeHostPermission,
  requestHostPermission,
} from "./utils/permissions";
import usePluginSettings, {
  DEFAULT_BADGE_CACHE_EXPIRE_MS,
} from "./utils/settings";
import { useTheme } from "./utils/ThemeProvider";
import { useTRPC } from "./utils/trpc";

export default function OptionsPage() {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { settings, setSettings } = usePluginSettings();
  const { setTheme, theme } = useTheme();

  // `<all_urls>` is an optional host permission that the user grants when they
  // opt in to client-side crawling. Keep the switch in sync with whether it's
  // actually granted (it can be revoked from the browser's extension settings).
  const [hostPermissionGranted, setHostPermissionGranted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    hasHostPermission().then((granted) => {
      if (!cancelled) setHostPermissionGranted(granted);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientSideCrawlingEnabled =
    settings.useSingleFile && hostPermissionGranted;

  const onToggleClientSideCrawling = async (checked: boolean) => {
    if (checked) {
      // Must run synchronously off the user gesture — don't await anything else
      // before requesting the permission.
      const granted = await requestHostPermission();
      if (!granted) {
        return;
      }
      setHostPermissionGranted(true);
      await setSettings((s) => ({ ...s, useSingleFile: true }));
    } else {
      await setSettings((s) => ({ ...s, useSingleFile: false }));
      await removeHostPermission();
      setHostPermissionGranted(false);
    }
  };

  const { data: whoami, error: whoAmIError } = useQuery(
    api.users.whoami.queryOptions(undefined, {
      enabled: settings.address != "",
    }),
  );

  const { mutate: deleteKey } = useMutation(
    api.apiKeys.revoke.mutationOptions(),
  );

  const invalidateWhoami = () => {
    queryClient.refetchQueries(api.users.whoami.queryFilter());
  };

  useEffect(() => {
    invalidateWhoami();
  }, [settings]);

  let loggedInMessage: React.ReactNode;
  if (whoAmIError) {
    if (whoAmIError.data?.code == "UNAUTHORIZED") {
      loggedInMessage = <span>Not logged in</span>;
    } else {
      loggedInMessage = (
        <span>Something went wrong: {whoAmIError.message}</span>
      );
    }
  } else if (whoami) {
    loggedInMessage = <span>{whoami.email}</span>;
  } else {
    loggedInMessage = <Spinner />;
  }

  const onLogout = () => {
    if (settings.apiKeyId) {
      deleteKey({ id: settings.apiKeyId });
    }
    setSettings((s) => ({ ...s, apiKey: "", apiKeyId: undefined }));
    invalidateWhoami();
    navigate("/notconfigured");
  };

  return (
    <div className="flex flex-col space-y-2">
      <Logo />
      <span className="text-lg">Settings</span>
      <hr />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Show count badge</span>
        <Switch
          checked={settings.showCountBadge}
          onCheckedChange={(checked) =>
            setSettings((s) => ({ ...s, showCountBadge: checked }))
          }
        />
      </div>
      {settings.showCountBadge && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Use badge cache</span>
            <Switch
              checked={settings.useBadgeCache}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, useBadgeCache: checked }))
              }
            />
          </div>
          {settings.useBadgeCache && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  Badge cache expire time (second)
                </span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={settings.badgeCacheExpireMs / 1000}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      badgeCacheExpireMs:
                        parseInt(e.target.value) * 1000 ||
                        DEFAULT_BADGE_CACHE_EXPIRE_MS,
                    }))
                  }
                  className="w-32"
                />
              </div>
            </>
          )}
        </>
      )}
      <hr />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Client-side crawling</span>
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
              Experimental
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Captures the page in the browser instead of on the server. Slower,
            but captures the page more accurately as you see it. Enabling this
            asks for permission to read the content of pages you save.
          </span>
        </div>
        <Switch
          checked={clientSideCrawlingEnabled}
          onCheckedChange={onToggleClientSideCrawling}
        />
      </div>
      {clientSideCrawlingEnabled && (
        <div className="flex items-start justify-between gap-2 pl-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Include images</span>
            <span className="text-xs text-gray-500">
              Including images makes the upload slower.
            </span>
          </div>
          <Switch
            checked={settings.singleFileIncludeImages}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, singleFileIncludeImages: checked }))
            }
          />
        </div>
      )}
      <hr />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Auto-save on open</span>
        <Switch
          checked={settings.autoSave}
          onCheckedChange={(checked) =>
            setSettings((s) => ({ ...s, autoSave: checked }))
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        When disabled, you&apos;ll confirm before saving bookmarks.
      </p>
      <hr />
      <div className="flex gap-2">
        <span className="my-auto">Server Address:</span>
        {settings.address}
      </div>
      <div className="flex gap-2">
        <span className="my-auto">Logged in as:</span>
        {loggedInMessage}
      </div>
      <div className="flex gap-2">
        <span className="my-auto">Theme:</span>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onLogout}>Logout</Button>
    </div>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #3014** (2026-08-12): **Mobile web regression - bulk edit**
  *Symptoms*: ### Describe the Bug  In Karakeep 0.33.1, the bulk edit functionality on web was changed to require a mouse hover to start selecting items.  On mobile web that breaks down as there is no ability to hover with touch.  This has broken my ability to bulk archive rss bookmarks.  I did try to use the mobile app as well, but can’t find a way to bulk edit there either.  ### Steps to Reproduce  1. Bring up the logged in homepage on mobile web 2. No ability to bulk edit as the toolbar button is gone  ### Expected Behaviour  Toolbar button on mobile web, or some alternative way to start the bulk edit workflow  ### Screenshots or Additional Context  _No response_  ### Device Details  Firefox iOS 153.2 On iOS 26.6  ### Exact Karakeep Version  0.33.1  ### Environment Details  Docker on Ubuntu 26.04, behind Traefik proxy and Tailscale VPN  ### Debug Logs  _No response_  ### Have you checked the troubleshooting guide?  - [x] I have checked the troubleshooting guide and I haven't found a solution to my problem
  **Post-Mortem & Fix Analysis**:
  > Ah, that's an oversight from my side, I'll fix it. Thanks for the report.

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

### Incident Patch 1: `f908b02e` (2026-09-27)
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

---

### Incident Patch 2: `1ecbf2b4` (2026-09-27)
**Commit Message**: fix(db): load .env before the shared config in migrate.ts

The shared config parses process.env at import time, before drizzle.ts
loaded dotenv, so DATA_DIR was empty and `pnpm db:migrate` migrated a
stray packages/db/db.db instead of the real database.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `packages/db/migrate.ts` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+// Must load before @karakeep/shared/config, which parses process.env at import time.
+import "dotenv/config";
+
 import { migrate } from "drizzle-orm/better-sqlite3/migrator";
 
 import serverConfig from "@karakeep/shared/config";
```

---

### Incident Patch 3: `f5e56b42` (2026-09-27)
**Commit Message**: fix(web): fix duplicate sort by in all tags page

**File**: `apps/web/components/dashboard/tags/AllTagsView.tsx` (modified, +0/-3)
```diff
@@ -299,9 +299,6 @@ export default function AllTagsView() {
                   className="flex-shrink-0 bg-background"
                 >
                   <ArrowDownAZ className="mr-2 size-4" />
-                  <span className="mr-1 text-sm">
-                    {t("actions.sort.title")}
-                  </span>
                   <span className="hidden text-sm font-medium sm:inline">
                     {sortLabels[sortBy]}
                   </span>
```

---

### Incident Patch 4: `c1dff000` (2026-09-26)
**Commit Message**: chore: fix warnings around claude perms

**File**: `.claude/settings.json` (modified, +4/-4)
```diff
@@ -2,13 +2,13 @@
   "permissions": {
     "allow": [
       "Bash(pnpm typecheck:*)",
-      "Bash(pnpm --filter * typecheck:*)",
+      "Bash(pnpm --filter * typecheck *)",
       "Bash(pnpm lint:*)",
-      "Bash(pnpm --filter * lint:*)",
+      "Bash(pnpm --filter * lint *)",
       "Bash(pnpm format:*)",
-      "Bash(pnpm --filter * format:*)",
+      "Bash(pnpm --filter * format *)",
       "Bash(pnpm test:*)",
-      "Bash(pnpm --filter * test:*)"
+      "Bash(pnpm --filter * test *)"
     ],
     "deny": []
   }
```

---

### Incident Patch 5: `b1bdf586` (2026-09-26)
**Commit Message**: chore: fix turbo warning

**File**: `package.json` (modified, +11/-11)
```diff
@@ -4,10 +4,10 @@
   "version": "0.1.0",
   "private": true,
   "scripts": {
-    "build": "turbo --no-daemon build",
-    "dev": "turbo --no-daemon dev --parallel",
+    "build": "turbo build",
+    "dev": "turbo dev --parallel",
     "clean": "git clean -xdf node_modules",
-    "clean:workspaces": "turbo --no-daemon clean",
+    "clean:workspaces": "turbo clean",
     "db:generate": "pnpm --filter @karakeep/db run generate",
     "db:migrate": "pnpm --filter @karakeep/db run migrate",
     "db:studio": "pnpm --filter @karakeep/db studio",
@@ -19,14 +19,14 @@
     "android": "pnpm --filter @karakeep/mobile android",
     "ios": "pnpm --filter @karakeep/mobile ios",
     "prepare": "husky",
-    "format": "turbo --no-daemon format --continue",
-    "format:fix": "turbo --no-daemon format:fix --continue",
-    "lint": "turbo --no-daemon lint --continue",
-    "lint:fix": "turbo --no-daemon lint:fix --continue",
-    "test": "turbo --no-daemon test",
-    "typecheck": "turbo --no-daemon typecheck",
-    "preflight": "turbo run --no-daemon typecheck lint format",
-    "preflight:fix": "turbo run --no-daemon typecheck lint:fix format:fix"
+    "format": "turbo format --continue",
+    "format:fix": "turbo format:fix --continue",
+    "lint": "turbo lint --continue",
+    "lint:fix": "turbo lint:fix --continue",
+    "test": "turbo test",
+    "typecheck": "turbo typecheck",
+    "preflight": "turbo run typecheck lint format",
+    "preflight:fix": "turbo run typecheck lint:fix format:fix"
   },
   "dependencies": {
     "husky": "^9.0.11"
```

---

### Incident Patch 6: `55be088f` (2026-09-26)
**Commit Message**: chore: fix the stupid agent files from nextjs

**File**: `apps/web/next.config.mjs` (modified, +2/-0)
```diff
@@ -59,6 +59,8 @@ const nextConfig = {
   typescript: { ignoreBuildErrors: true },
 
   allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(","),
+
+  agentRules: false,
 };
 
 export default withBundleAnalyzer(nextConfig);
```

---

### Incident Patch 7: `fee12686` (2026-09-26)
**Commit Message**: fix(docker): make /run owned by node so non-root runs work (#3114)

* fix(docker): make /run owned by node so non-root runs work

s6-overlay requires /run to be owned by the container user and normally
fixes that at runtime by elevating through the setuid suexec helper —
which Kubernetes runAsNonRoot, rootless docker and no-new-privileges
setups deny. Baking the ownership into the image makes user 1000:1000
work everywhere with no extra mounts. Docs section added.

* docs: drop non-root documentation

---------

Co-authored-by: pullfrog[bot] <226033991+pullfrog[bot]@users.noreply.github.com>

**File**: `docker/Dockerfile` (modified, +6/-0)
```diff
@@ -183,6 +183,12 @@ COPY --from=web_builder --chown=node:node /app/apps/web/.next/static ./apps/web/
 ######################
 COPY --from=workers_builder /prod/workers /app/apps/workers
 
+# s6-overlay requires /run to be owned by the container user. Its init fixes
+# this at runtime via the setuid suexec helper, which Kubernetes runAsNonRoot
+# (no_new_privs), rootless docker and no-new-privileges setups deny — so bake
+# it for the node user.
+RUN chown node:node /run
+
 ENTRYPOINT ["/init"]
 
 ################# The AIO ##############
```

---

### Incident Patch 8: `86a7a8ea` (2026-09-26)
**Commit Message**: fix(mobile): ignore unreliable Android internet reachability (#3127)

- Use network connection state for online manager status
- Leave server reachability checks to useConnectionStatus

**File**: `apps/mobile/lib/offlineCache.ts` (modified, +7/-1)
```diff
@@ -320,7 +320,13 @@ export function setupOnlineManager() {
   onlineManager.setEventListener((setOnline) => {
     let active = true;
     const updateOnlineState = (state: Network.NetworkState) => {
-      setOnline(state.isInternetReachable ?? state.isConnected ?? true);
+      // Deliberately ignore isInternetReachable. On Android it requires the
+      // network to pass the OS's own connectivity validation, which VPNs
+      // (e.g. Cloudflare WARP) and LAN-only setups can fail even though the
+      // self-hosted server is reachable. Treating that as offline pauses all
+      // queries and skips the server health check, so the app never recovers.
+      // Whether the server itself is reachable is left to useConnectionStatus.
+      setOnline(state.isConnected ?? true);
     };
 
     void Network.getNetworkStateAsync()
```

---

### Incident Patch 9: `f7ce61b1` (2026-09-26)
**Commit Message**: Home end search fix (#3110)

* fix(web): allow Home/End to move the caret in the search input

* test(web): cover Home/End handling in the search input

* fix(web): preserve caller onKeyDown in search input

* test(web): cover caller onKeyDown composition

* Apply suggestion from @pullfrog[bot]

Co-authored-by: pullfrog[bot] <226033991+pullfrog[bot]@users.noreply.github.com>

* fix(web): drop duplicate props spread and redundant onKeyDown wrapper

* test(web): drop SearchInput component test

---------

Co-authored-by: pullfrog[bot] <226033991+pullfrog[bot]@users.noreply.github.com>

**File**: `apps/web/components/dashboard/search/SearchInput.tsx` (modified, +16/-1)
```diff
@@ -77,7 +77,7 @@ function useFocusSearchOnKeyPress(
 const SearchInput = React.forwardRef<
   HTMLInputElement,
   React.HTMLAttributes<HTMLInputElement> & { loading?: boolean }
->(({ className, ...props }, ref) => {
+>(({ className, onKeyDown, ...props }, ref) => {
   const { t } = useTranslation();
   const { semanticSearchEnabled } = useClientConfig().search;
   const {
@@ -128,6 +128,20 @@ const SearchInput = React.forwardRef<
     [debounceSearch],
   );
 
+  const handleInputKeyDown = useCallback(
+    (e: React.KeyboardEvent<HTMLInputElement>) => {
+      // Let callers handle the event first, then apply our Home/End fix.
+      onKeyDown?.(e);
+      // cmdk's root handler prevents the default for Home/End to move the
+      // list selection. The search box is a text field, so let the browser
+      // move the caret (and handle shift-selection) instead.
+      if (e.key === "Home" || e.key === "End") {
+        e.stopPropagation();
+      }
+    },
+    [onKeyDown],
+  );
+
   const {
     suggestionGroups,
     hasSuggestions,
@@ -250,6 +264,7 @@ const SearchInput = React.forwardRef<
                   className,
                 )}
                 {...props}
+                onKeyDown={handleInputKeyDown}
               />
             </div>
           </PopoverTrigger>
```

---

### Incident Patch 10: `3c441143` (2026-09-22)
**Commit Message**: fix(web): take 3 of fixing safari search bar

**File**: `apps/web/components/dashboard/header/ProfileOptions.tsx` (modified, +2/-1)
```diff
@@ -78,8 +78,9 @@ export default function SidebarProfileOptions() {
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button
-          className="border-new-gray-200 aspect-square rounded-full border-4 bg-black p-0 text-white"
+          className="border-new-gray-200 shrink-0 rounded-full border-4 bg-black p-0 text-white"
           variant="ghost"
+          size="icon"
         >
           <UserAvatar
             image={avatarUrl}
```

#### Recent Merged Pull Requests:
- **PR #3127** (2026-09-26): fix(mobile): ignore unreliable Android internet reachability (@MohamedBassem)
- **PR #3126** (2026-09-26): deps: upgrade to expo 57 (@MohamedBassem)
- **PR #3125** (2026-09-26): ci: optimize docker image building for caching (@MohamedBassem)
- **PR #3124** (2026-09-26): docs: add KaraClone to community projects (@gowinder)
- **PR #3114** (2026-09-26): fix(docker): make /run owned by node so non-root runs work (@lightsabit)
- **PR #3111** (2026-09-26): i18n(tr): add missing Turkish translations (@qwist1233-cpu)
- **PR #3110** (2026-09-26): Home end search fix (@eriktews)
- **PR #3104** (2026-09-19): tests: add e2e ui tests (@MohamedBassem)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
