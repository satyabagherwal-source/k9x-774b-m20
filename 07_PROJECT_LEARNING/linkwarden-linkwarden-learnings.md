# Forensic Learning Record (Deep Inspection): linkwarden/linkwarden

> **Canonical Artifact**: `07_PROJECT_LEARNING/linkwarden-linkwarden-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/linkwarden/linkwarden](https://github.com/linkwarden/linkwarden))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:28:59.527Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `linkwarden/linkwarden`
- **Description**: ⚡️⚡️⚡️ Self-hosted collaborative bookmark manager to collect, read, annotate, and fully preserve what matters, all in one place.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 19934 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/extension/src/@/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TabInfo {
  url: string;
  title: string;
}

export async function getCurrentTabInfo(): Promise<{
  id: number | undefined;
  title: string | undefined;
  url: string | undefined;
}> {
  const tabs = await getBrowser().tabs.query({
    active: true,
    currentWindow: true,
  });
  const { id, url, title } = tabs[0];
  return { id, url, title };
}

// Firefox exposes `browser`, Chromium exposes `chrome`. The two are API
// compatible for everything used here, and the rest of the codebase already
// refers to the `chrome.*` type namespace, so pin the return type to it rather
// than leaking a `chrome | browser` union that no call site can narrow.
export function getBrowser(): typeof chrome {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  return typeof browser !== "undefined" ? browser : chrome;
}

export function getChromeStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage;
}

export async function getStorageItem(key: string): Promise<string | undefined> {
  if (getChromeStorage()) {
    const result = await getBrowser().storage.local.get([key]);
    return result[key] as string | undefined;
  } else {
    const result = await getBrowser().storage.local.get(key);
    return result[key] as string | undefined;
  }
}

export async function setStorageItem(key: string, value: string) {
  if (getChromeStorage()) {
    return await chrome.storage.local.set({ [key]: value });
  } else {
    await getBrowser().storage.local.set({ [key]: value });
    return Promise.resolve();
  }
}

export function isSafari(): boolean {
  try {
    return /^safari-web-extension:/.test(getBrowser().runtime.getURL(""));
  } catch {
    return false;
  }
}

export function hasAPI(api: string): boolean {
  const b = getBrowser();
  let obj: any = b;
  for (const part of api.split(".")) {
    if (!obj || typeof obj[part] === "undefined") return false;
    obj = obj[part];
  }
  return true;
}

export async function updateBadge(
  tabId: number | undefined,
  linkExists: boolean
) {
  if (!tabId) return;

  const browser = getBrowser();
  const action = browser.action ?? browser.browserAction;
  if (!action) return;

  if (linkExists) {
    action.setBadgeText({ tabId, text: "✓" });
    action.setBadgeBackgroundColor({ tabId, color: "#98c0ff" });
  } else {
    action.setBadgeText({ tabId, text: "" });
  }
}

```

### Core Architecture Module: `apps/extension/src/hooks/useListboxKeys.ts`
```
import { KeyboardEvent, useEffect, useId, useState } from "react";

type Props<T> = {
  options: T[];
  onEnter: (option: T | null) => void;
  onClose: () => void;
};

export function useListboxKeys<T>({ options, onEnter, onClose }: Props<T>) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listId = useId();

  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => setActiveIndex(null), [options]);

  useEffect(() => {
    if (activeIndex === null) return;

    document
      .getElementById(`${listId}-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();

      if (!options.length) return;

      const step = e.key === "ArrowDown" ? 1 : -1;

      setActiveIndex((index) =>
        index === null
          ? step === 1
            ? 0
            : options.length - 1
          : (index + step + options.length) % options.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      onEnter(activeIndex === null ? null : options[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return { activeIndex, listId, optionId, handleKeyDown };
}

```

### Core Architecture Module: `apps/extension/src/hooks/useToast.ts`
```
import * as React from "react";

import type {
  ToastActionElement,
  ToastProps,
} from "../@/components/ui/Toast.tsx";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

const SUCCESS_TOAST_DURATION = 1000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      duration:
        props.variant === "success" ? SUCCESS_TOAST_DURATION : undefined,
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };

```

### Core Architecture Module: `apps/mobile/components/EmptyState.tsx`
```
import React from "react";
import {
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  /** Whether to render the message. Hidden e.g. while still fetching. */
  showMessage?: boolean;
  message?: string;
  refreshControl?: ScrollViewProps["refreshControl"];
};

/**
 * Empty-state for the list screens. A full-window ScrollView keeps pull-to-refresh
 * working, with the message centered via an absolute overlay.
 *
 * The overlay is used (instead of flexGrow/centerContent) because on iOS the
 * transparent large-title header makes the scroll container full-window and the
 * header inset is invisible to JS, so layout-based centering fails/races on cold
 * start. On Android the header is opaque, so the overlay instead fills down behind
 * the bottom system inset and the message lands slightly low — pad it back up.
 */
export default function EmptyState({
  showMessage = true,
  message = "Nothing found...",
  refreshControl,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
      {showMessage && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              justifyContent: "center",
              alignItems: "center",
              paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
            },
          ]}
        >
          <Text className="text-center text-xl text-neutral">{message}</Text>
        </View>
      )}
    </View>
  );
}

```

### Core Architecture Module: `apps/web/hooks/useArchivalTags.ts`
```
import { Tag } from "@linkwarden/prisma/client";
import {
  ArchivalOptionKeys,
  ArchivalTagOption,
} from "@linkwarden/types/inputSelect";
import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { isArchivalTag } from "@linkwarden/lib/isArchivalTag";

const useArchivalTags = (initialTags: Tag[]) => {
  const [archivalTags, setArchivalTags] = useState<ArchivalTagOption[]>([]);
  const [options, setOptions] = useState<ArchivalTagOption[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (!initialTags) return;

    const transformTag = (tag: Tag): ArchivalTagOption => ({
      label: tag.name,
      archiveAsScreenshot: tag.archiveAsScreenshot || false,
      archiveAsMonolith: tag.archiveAsMonolith || false,
      archiveAsPDF: tag.archiveAsPDF || false,
      archiveAsReadable: tag.archiveAsReadable || false,
      archiveAsWaybackMachine: tag.archiveAsWaybackMachine || false,
      aiTag: tag.aiTag || false,
    });

    const archival = initialTags.filter(isArchivalTag).map(transformTag);
    const nonArchival = initialTags
      .filter((tag) => !isArchivalTag(tag))
      .map(transformTag);

    setArchivalTags(archival);
    setOptions(nonArchival);
  }, [initialTags]);

  const addTags = (newTags: ArchivalTagOption[]) => {
    const newTag = newTags.map(({ value, ...tag }) => {
      // Check if a tag with the same label already exists
      const existingTag = archivalTags.find(
        (archiveTag) => archiveTag.label === tag.label
      );

      // If it exists, return the existing tag with archive values set to false
      if (existingTag) {
        return {
          ...existingTag,
          archiveAsScreenshot: false,
          archiveAsMonolith: false,
          archiveAsPDF: false,
          archiveAsReadable: false,
          archiveAsWaybackMachine: false,
          aiTag: false,
        };
      }

      // If it doesn't exist, create a new tag with default values
      return {
        ...tag,
        archiveAsScreenshot: false,
        archiveAsMonolith: false,
        archiveAsPDF: false,
        archiveAsReadable: false,
        archiveAsWaybackMachine: false,
        aiTag: false,
      };
    });

    // Filter out any existing tags with matching labels before adding new ones
    setArchivalTags((prev) => {
      const filteredPrev = prev.filter(
        (prevTag) => !newTags.some(({ label }) => label === prevTag.label)
      );
      return [...filteredPrev, ...newTag];
    });

    setOptions((prev) =>
      prev.filter(
        (option) => !newTags.some(({ label }) => label === option.label)
      )
    );
  };

  const toggleOption = (
    tag: ArchivalTagOption,
    option: keyof ArchivalTagOption
  ) => {
    setArchivalTags((prev) =>
      prev.map((t) =>
        t.label === tag.label ? { ...t, [option]: !t[option] } : t
      )
    );
  };

  const removeTag = (tagToDelete: ArchivalTagOption) => {
    if (!tagToDelete.__isNew__) {
      // Set all the values to null so we can delete the archive settings from the database
      setArchivalTags((prev) =>
        prev.map((t) =>
          t.label === tagToDelete.label
            ? {
                ...t,
                archiveAsScreenshot: null,
                archiveAsMonolith: null,
                archiveAsPDF: null,
                archiveAsReadable: null,
                archiveAsWaybackMachine: null,
                aiTag: null,
              }
            : t
        )
      );

      const resetTag: ArchivalTagOption = {
        ...tagToDelete,
        archiveAsScreenshot: false,
        archiveAsMonolith: false,
        archiveAsPDF: false,
        archiveAsReadable: false,
        archiveAsWaybackMachine: false,
        aiTag: false,
      };

      setOptions((prev) => {
        if (!prev.some((t) => t.label === resetTag.label)) {
          return [...prev, resetTag];
        }
        return prev;
      });
    } else {
      setArchivalTags((prev) =>
        prev.filter((t) => t.label !== tagToDelete.label)
      );
    }
  };

  const ARCHIVAL_OPTIONS: {
    type: ArchivalOptionKeys;
    icon: string;
    label: string;
  }[] = [
    { type: "aiTag", icon: "bi-tag", label: t("ai_tagging") },
    {
      type: "archiveAsScreenshot",
      icon: "bi-file-earmark-image",
      label: t("screenshot"),
    },
    {
      type: "archiveAsMonolith",
      icon: "bi-filetype-html",
      label: t("webpage"),
    },
    { type: "archiveAsPDF", icon: "bi-file-earmark-pdf", label: t("pdf") },
    {
      type: "archiveAsReadable",
      icon: "bi-file-earmark-text",
      label: t("readable"),
    },
    {
      type: "archiveAsWaybackMachine",
      icon: "bi-archive",
      label: t("archive_org_snapshot"),
    },
  ];

  return {
    ARCHIVAL_OPTIONS,
    archivalTags,
    options,
    addTags,
    toggleOption,
    removeTag,
  };
};

export { useArchivalTags };

```

### Core Architecture Module: `apps/web/hooks/useCollectivePermissions.ts`
```
import { Member } from "@linkwarden/types/global";
import { useEffect, useState } from "react";
import { useCollections } from "@linkwarden/router/collections";
import { useUser } from "@linkwarden/router/user";

export default function useCollectivePermissions(collectionIds: number[]) {
  const { data: collections = [] } = useCollections();

  const { data: user } = useUser();

  const [permissions, setPermissions] = useState<Member | true>();
  useEffect(() => {
    for (const collectionId of collectionIds) {
      const collection = collections.find((e) => e.id === collectionId);

      if (collection) {
        let getPermission: Member | undefined = collection.members.find(
          (e) => e.userId === user?.id
        );

        if (
          getPermission?.canCreate === false &&
          getPermission?.canUpdate === false &&
          getPermission?.canDelete === false
        )
          getPermission = undefined;

        setPermissions(user?.id === collection.ownerId || getPermission);
      }
    }
  }, [user, collections, collectionIds]);

  return permissions;
}

```

### Core Architecture Module: `apps/web/hooks/useDetectPageBottom.tsx`
```
import { useState, useEffect } from "react";

const useDetectPageBottom = () => {
  const [reachedBottom, setReachedBottom] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight;
      const scrolledHeight = window.scrollY + window.innerHeight;

      if (scrolledHeight >= totalHeight) {
        setReachedBottom(true);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return { reachedBottom, setReachedBottom };
};

export default useDetectPageBottom;

```

### Core Architecture Module: `apps/web/hooks/useInitialData.tsx`
```
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import useLocalSettingsStore from "@/store/localSettings";

export default function useInitialData() {
  const { status, data } = useSession();
  const { setSettings } = useLocalSettingsStore();
  useEffect(() => {
    setSettings();
  }, [status, data]);

  return status;
}

```

### Core Architecture Module: `apps/web/hooks/useMediaQuery.tsx`
```
import { useEffect, useState } from "react";

export default function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);
  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    // Set initial state
    setMatches(mediaQueryList.matches);
    // Add listener for changes
    mediaQueryList.addEventListener("change", handleChange);
    // Cleanup listener on unmount
    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);
  return matches;
}

```

### Core Architecture Module: `apps/web/hooks/usePermissions.tsx`
```
import { Member } from "@linkwarden/types/global";
import { useEffect, useState } from "react";
import { useCollections } from "@linkwarden/router/collections";
import { useUser } from "@linkwarden/router/user";

export default function usePermissions(collectionId: number) {
  const { data: collections = [] } = useCollections();

  const { data: user } = useUser();

  const [permissions, setPermissions] = useState<Member | true>();
  useEffect(() => {
    const collection = collections.find((e) => e.id === collectionId);

    if (collection) {
      let getPermission: Member | undefined = collection.members.find(
        (e) => e.userId === user?.id
      );

      if (
        getPermission?.canCreate === false &&
        getPermission?.canUpdate === false &&
        getPermission?.canDelete === false
      )
        getPermission = undefined;

      setPermissions(user?.id === collection.ownerId || getPermission);
    }
  }, [user, collections, collectionId]);

  return permissions;
}

```

### Core Architecture Module: `apps/web/hooks/useSidebarCollapse.ts`
```
import { useEffect, useState } from "react";

export default function useSidebarCollapse() {
  const [sidebarIsCollapsed, setSidebarIsCollapsed] = useState<boolean>(
    () => localStorage.getItem("sidebarIsCollapsed") === "true"
  );

  useEffect(() => {
    localStorage.setItem(
      "sidebarIsCollapsed",
      sidebarIsCollapsed ? "true" : "false"
    );
  }, [sidebarIsCollapsed]);

  const toggleSidebar = () => setSidebarIsCollapsed(!sidebarIsCollapsed);

  return { sidebarIsCollapsed, toggleSidebar };
}

```

### Core Architecture Module: `apps/web/hooks/useSort.tsx`
```
import {
  CollectionIncludingMembersAndLinkCount,
  LinkIncludingShortenedCollectionAndTags,
  Sort,
} from "@linkwarden/types/global";
import { SetStateAction, useEffect } from "react";

type Props<
  T extends
    | CollectionIncludingMembersAndLinkCount
    | LinkIncludingShortenedCollectionAndTags,
> = {
  sortBy: Sort;

  data: T[];
  setData: (value: SetStateAction<T[]>) => void;
};

export default function useSort<
  T extends
    | CollectionIncludingMembersAndLinkCount
    | LinkIncludingShortenedCollectionAndTags,
>({ sortBy, data, setData }: Props<T>) {
  useEffect(() => {
    const dataArray = [...data];

    if (sortBy === Sort.NameAZ)
      setData(dataArray.sort((a, b) => a.name.localeCompare(b.name)));
    else if (sortBy === Sort.NameZA)
      setData(dataArray.sort((a, b) => b.name.localeCompare(a.name)));
    else if (sortBy === Sort.DateNewestFirst)
      setData(
        dataArray.sort(
          (a, b) =>
            new Date(b.createdAt as string).getTime() -
            new Date(a.createdAt as string).getTime()
        )
      );
    else if (sortBy === Sort.DateOldestFirst)
      setData(
        dataArray.sort(
          (a, b) =>
            new Date(a.createdAt as string).getTime() -
            new Date(b.createdAt as string).getTime()
        )
      );
  }, [sortBy, data]);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1820** (2026-09-09): **Screenshot can't be uploaded, limit exceeded 10 MB**
  *Symptoms*: **Describe the bug** I try to add bookmark via firefox addon. But I am getting an error that the limit of 10 MB exceeded. I have a self-hosted version and I see that default limit is 100 MB (SCREENSHOT_MAX_BUFFER). I even tried increasing it to 500 MB) didn't help.  **To Reproduce** Steps to reproduce the behavior: 1. Go to any website. It happens for me on [this website](https://www.sautershop.com/en-int/drilling-screws/drilling-jigs/kreg-pocket-hole-drilling-templates/kreg-drilling-jigs/). 2. Click on Linwarden addon and make sure the "Upload image from browser" is ticked. 3. The page auto scrolls as the addon is making the screenshot. 4. See error  **Expected behavior** Screenshot is saved  **Screenshots** <img width="365" height="128" alt="Image" src="https://github.com/user-attachments/assets/2f9605cf-c733-4d27-9a67-96c564ca2376" />  **Desktop (please complete the following information):**  - OS: Fedora Workstation  - Browser: Firefox  - Version: 140  **Smartphone (please complete the following information):**  - Device: [e.g. iPhone6]  - OS: [e.g. iOS8.1]  - Browser [e.g. stock browser, safari]  - Version [e.g. 22]  **Additional context** Linkwarden is cool 😊   
  **Post-Mortem & Fix Analysis**:
  > NEXT_PUBLIC_MAX_FILE_BUFFER is the environment variable to increase the upload limit.  More info: https://docs.linkwarden.app/self-hosting/environment-variables#runtime-upload-and-archiving
  > > NEXT_PUBLIC_MAX_FILE_BUFFER is the environment variable to increase the upload limit.  All right, that worked, thanks!  

- **Issue #1809** (2026-10-06): **Unable to preserve links due to persistent timeouts**
  *Symptoms*: **Describe the bug** When adding new links, none of the preservation formats work, and refreshing the preserved formats fails due to timeout  **To Reproduce** Steps to reproduce the behavior: 1. Add a new link/refresh preserved links 2. See timeout error in docker logs  **Expected behavior** Preserved links to populate  **Desktop (please complete the following information):**  - Version 2.16.1  - Any access to web interface/app displays the same issue 
  **Post-Mortem & Fix Analysis**:
  > This seems to be an issue for certain websites, such as Reddit. Preservation works fine for most websites.

- **Issue #1806** (2026-09-09): **Breaking Change from 2.16.0 to 2.16.1 docker-compose.yml :  Meilisearch Version Bump breaks Meilisearch**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. get and run docker-compose from 2.16.0 2. run and use 2.16.0 3. update docker-compose from 2.16.1 (meilisearch 1.13.3 from 1.12.8) 4. meilisearch does not start: `ERROR meilisearch: error=Your database version (1.12.8) is incompatible with your current engine version (1.13.3).`  **Expected behavior** I would have expected an Integrated Migration, or an update guide  **Desktop (please complete the following information):**  - OS: Fedora Linux 44 Server Edition x86_64  - Browser not applicable  - Version 2.16.1   **Additional context** running 2.16.1 with Meilisearch 1.12.8 runs no problem. the upgrade guide could just tell the user to delete meili_data and recreate it 
  **Post-Mortem & Fix Analysis**:
  > addendum, deleting meili_data makes the search not work at all.
  > Oops, the bump in meilisearch was intended for new setups, but you can easily fix this by clearing the indexed state of links by running the following in the folder where your docker-compose.yml file is located:  ``` docker compose exec postgres psql -U postgres -d postgres -c 'UPDATE "Link" SET "indexVersion" = NULL;' docker compose restart linkwarden ```
  > > Oops, the bump in meilisearch was intended for new setups, but you can easily fix this by clearing the indexed state of links by running the following in the folder where your docker-compose.yml file is located: >  > ``` > docker compose exec postgres psql -U postgres -d postgres -c 'UPDATE "Link" SET "indexVersion" = NULL;' > docker compose restart linkwarden > ```  Thanks! that enables the search after removing meili_data, for anyone wondering

- **Issue #1780** (2026-08-16): **Linkwarden ignores ALLOW_PRIVATE_NETWORK_ACCESS**
  *Symptoms*: **Describe the bug** Either linkwarden 2.15 or 2.16 stopped respecting this setting.  **To Reproduce** Steps to reproduce the behavior: 1. Set env URL `ALLOW_PRIVATE_NETWORK_ACCESS=true` 2. Try to archive `http://localhost`  **Expected behavior** The site gets archived  **Additional context** The problem is most likely the missing `options` parameter here: https://github.com/linkwarden/linkwarden/blob/main/packages/lib/safeFetch.ts#L104 
  **Post-Mortem & Fix Analysis**:
  > Related to https://github.com/linkwarden/linkwarden/issues/1734, but now it also happens for normal archiving
  > This will be fixed in the next minor release, thanks for bringing it up!

- **Issue #1760** (2026-08-19): **iOS app logs out if connection to server is not available**
  *Symptoms*: **Describe the bug** I am using a self hosted instance v2.15.0 iPhone 15 pro app v 1.3.0  Everything appears to work fine when I'm on my local network or when connected to my VPN. I can log in and sync and load content.  When I am not local or if the VPN is not available the app logs me out when I launch it. there is an error message:  `The server could not be reached and no cached user data was available. Check your connection and sign in again`  I definitely have cached content so the message is odd. Getting logged out is unexpected and inconvenient when in a low/no connectivity environment.    **To Reproduce** Steps to reproduce the behavior: 1. Launch app and log into my self hosted server while connected locally or on VPN - OK 2. Wait for items to cache - OK 3. Close the app - OK 4. Disconnect from local network OR disconnect from VPN OR put phone in airplane mode with no connections - OK 5. Open Linkwarden app - spinning loading icon is show for several seconds and then a pop up: `The server could not be reached and no cached user data was available. Check your connection and sign in again`  - NOK 6. Press OK and then it presents the log in screen again - NOK  **Expected behavior** User should be able to stay logged in and view cached content in low/no connectivity situations.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Desktop (please complete the following information):**  - OS: [e.g. iOS]  - Browser [e.g. chrome, safari]  - Versio
  **Post-Mortem & Fix Analysis**:
  > This is now fixed in the latest version of the mobile app, thanks for reporting it!
  > I am still seeing this behavior in 1.4.2  I just spent this past weekend in a low/no cell coverage area and had constant log outs.
  > Strange, can you provide the _exact_ steps to reproduce this issue?  I couldn’t reproduce it with the steps above.

- **Issue #1752** (2026-07-28): **2.15.1 Misconfigured**
  *Symptoms*: **Describe the bug** Update to v2.15.1 results in container that will not start. Instructions in log cannot be followed since container does not start.  **To Reproduce** Steps to reproduce the behavior: 1. Pull v2.15.1 image 2. Attempt to restart container  **Expected behavior** Container should start instead of crashing and restarting in a loop.  **Additional context** Excerpt from log that grows continuously until container is killed.  2026-07-15T02:20:26.347929090Z error This project's package.json defines "packageManager": "yarn@4.12.0". However the current global version of Yarn is 1.22.22. 2026-07-15T02:20:26.347976464Z  2026-07-15T02:20:26.347985250Z Presence of the "packageManager" field indicates that the project is meant to be used with Corepack, a tool included by default with all official Node.js distributions starting from 16.9 and 14.19. 2026-07-15T02:20:26.347993848Z Corepack must currently be enabled by running corepack enable in your terminal. For more information, check out https://yarnpkg.com/corepack. 2026-07-15T02:20:28.569556757Z error This project's package.json defines "packageManager": "yarn@4.12.0". However the current global version of Yarn is 1.22.22. 2026-07-15T02:20:28.569620224Z  2026-07-15T02:20:28.569641886Z Presence of the "packageManager" field indicates that the project is meant to be used with Corepack, a tool included by default with all official Node.js distributions starting from 16.9 and 14.19. 2026-07-15T02:20:28.569650394Z Corepack m
  **Post-Mortem & Fix Analysis**:
  > Can confirm this bug is present, straight docker upgrade to latest and this is the result.  Rolled back to linkwarden:v2.15.0 and working.  
  > Can you completely remove the image and recreate the container and let me know if it works?  That being said, you just have to head inside the container and run `corepack enable`, not sure why this isn't working as I wasn't able to reproduce this issue.
  > Removing the image and recreating the container fixed it for me.

- **Issue #1751** (2026-07-30): **Linkwarden 2.15.1 reports incorrect version at `/api/v1/config`**
  *Symptoms*: **Describe the bug** Linkwarden 2.15.1 reports incorrect version at `/api/v1/config` - it returns `INSTANCE_VERSION: "v2.15.0"`.  **To Reproduce** Steps to reproduce the behavior: 1. Install v2.15.1 2. Go to `/api/v1/config` at your instance 3. Check value of INSTANCE_VERSION - it does not match the installed version  **Expected behavior** Version matches.  
  **Post-Mortem & Fix Analysis**:
  > Yes this was a minor typo, you can confirm the version by looking at the Docker image tag.
  > @daniel31x13 that causes issues with update monitoring software which considers the deployment being out-of-date, based on its API response - and there's no other way to get the actual version from the frontend/API.
  > We’ll be releasing the next version pretty soon, so the only impact on you would be skipping one minor release.

- **Issue #1707** (2026-07-30): **Copy Icon Doesn't Work for Access Tokens**
  *Symptoms*: **Describe the bug** When creating an access token a modal appears with the code and a copy icon. Clicking the copy icon doesn't copy the code to the clipboard. Not sure if this is just the self hosted version.  **To Reproduce** Steps to reproduce the behavior: 1. Create Access Token 2. Click Icon, check clipboard.  **Expected behavior** I would expect the code to be on the clipboard  **Desktop (please complete the following information):**  - Win 11, 64Bit, Portable Chrome Browser  Not a big deal, but wanted to report it. :) 
  **Post-Mortem & Fix Analysis**:
  > This is already fixed.

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

### Incident Patch 1: `4656f79b` (2026-09-09)
**Commit Message**: fix(mobile): fix "waiting for connection" persisting

**File**: `apps/mobile/app/(tabs)/settings/index.tsx` (modified, +5/-3)
```diff
@@ -63,14 +63,16 @@ export default function SettingsScreen() {
   const router = useRouter();
 
   const syncStatus = useOfflineSyncStore((s) => s.status);
+  const syncOnline = useOfflineSyncStore((s) => s.online);
   const syncProcessed = useOfflineSyncStore((s) => s.processed);
   const syncTotal = useOfflineSyncStore((s) => s.total);
   const bytesUsed = useOfflineSyncStore((s) => s.bytesUsed);
   const syncPercent =
     syncTotal > 0 ? Math.floor((syncProcessed / syncTotal) * 100) : null;
-  const syncStatusLabel =
-    syncStatus === "paused"
-      ? "Waiting for connection"
+  const syncStatusLabel = !syncOnline
+    ? "Waiting for connection"
+    : syncStatus === "paused"
+      ? "Retrying…"
       : syncStatus !== "syncing"
         ? "Up to date"
         : syncPercent === null
```

**File**: `apps/mobile/lib/offlineSync.ts` (modified, +39/-3)
```diff
@@ -21,12 +21,14 @@ type SyncStatus = "idle" | "syncing" | "paused";
 
 type OfflineSyncState = {
   status: SyncStatus;
+  online: boolean;
   processed: number;
   total: number;
   failed: number;
   currentLinkId: number | null;
   bytesUsed: number;
   setStatus: (status: SyncStatus) => void;
+  setOnline: (online: boolean) => void;
   setProgress: (processed: number, total: number) => void;
   incrementProcessed: () => void;
   incrementFailed: () => void;
@@ -38,12 +40,14 @@ type OfflineSyncState = {
 
 export const useOfflineSyncStore = create<OfflineSyncState>((set) => ({
   status: "idle",
+  online: true,
   processed: 0,
   total: 0,
   failed: 0,
   currentLinkId: null,
   bytesUsed: 0,
   setStatus: (status) => set({ status }),
+  setOnline: (online) => set({ online }),
   setProgress: (processed, total) =>
     set((s) => ({ processed, total, failed: processed === 0 ? 0 : s.failed })),
   incrementProcessed: () => set((s) => ({ processed: s.processed + 1 })),
@@ -131,7 +135,7 @@ const isOnline = (state: {
   isInternetReachable?: boolean | null;
 }) => state.isConnected === true && state.isInternetReachable !== false;
 
-const connectionRetryMs = 30_000;
+const connectionRetryMs = 60_000;
 
 let connectionRetryTimeout: ReturnType<typeof setTimeout> | null = null;
 
@@ -513,6 +517,10 @@ export const startSync = async (
 
   if (runPromise && targetUnchanged) {
     pendingRescan = true;
+
+    if (useOfflineSyncStore.getState().status === "paused")
+      scheduleConnectionRetry();
+
     return runPromise;
   }
 
@@ -527,6 +535,9 @@ export const startSync = async (
 
   const net = await NetInfo.fetch();
   if (generation !== syncGeneration) return;
+
+  useOfflineSyncStore.getState().setOnline(isOnline(net));
+
   if (!isOnline(net)) {
     pauseForConnection();
     return;
@@ -542,6 +553,7 @@ export const startSync = async (
     const pausesAtStart = connectionPauses;
     const processedRevisions = new Map<number, unknown>();
     let previousLinkIds: Set<number> | null = null;
+    let serverFailures = 0;
 
     try {
       do {
@@ -622,11 +634,32 @@ export const startSync = async (
           );
 
           if (lostConnection) {
-            if (generation === syncGeneration) {
+            if (generation !== syncGeneration) break;
+
+            const net = await NetInfo.fetch();
+            if (generation !== syncGeneration) break;
+
+            store.setOnline(isOnline(net));
+
+            if (!isOnline(net)) {
               cancelled = true;
               pauseForConnection();
+              break;
             }
-            break;
+
+            console.warn(
+              `[offlineSync] Could not fetch link ${fullLink.id}, skipping`
+            );
+            serverFailures += 1;
+            store.incrementFailed();
+            store.incrementProcessed();
+
+            if (waitingForConnection) {
+              waitingForConnection = false;
+              store.setStatus("syncing");
+            }
+
+            continue;
           }
 
           if (waitingForConnection) {
@@ -646,6 +679,7 @@ export const startSync = async (
       if (generation === syncGeneration && connectionPauses === pausesAtStart) {
         currentStore.setStatus("idle");
       }
+      if (serverFailures > 0) scheduleConnectionRetry();
     }
   })();
 
@@ -686,6 +720,8 @@ export const subscribeToConnectivity = () => {
   if (netUnsubscribe) return;
 
   netUnsubscribe = NetInfo.addEventListener((state) => {
+    useOfflineSyncStore.getState().setOnline(isOnline(state));
+
     if (!activeAuth) return;
 
     if (!isOnline(state)) {
```

---

### Incident Patch 2: `bd2a09f9` (2026-09-09)
**Commit Message**: fix(mobile): fixes #1807

**File**: `apps/mobile/app/_layout.tsx` (modified, +17/-13)
```diff
@@ -6,7 +6,7 @@ import {
 } from "expo-router";
 import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
 import { queryPersister } from "@/lib/queryPersister";
-import { useState, useEffect } from "react";
+import { useState, useEffect, useRef } from "react";
 import "../styles/global.css";
 import { SheetProvider } from "react-native-actions-sheet";
 import "@/components/ActionSheets/Sheets";
@@ -44,6 +44,7 @@ export default Sentry.wrap(function RootLayout() {
 
   const { setAuth } = useAuthStore();
   const rootNavState = useRootNavigationState();
+  const redirectingToIncoming = useRef(false);
 
   useEffect(() => {
     setAuth();
@@ -54,13 +55,15 @@ export default Sentry.wrap(function RootLayout() {
   useEffect(() => {
     if (!rootNavState?.key || isLoading) return;
 
-    if (hasShareIntent && shareIntent.webUrl) {
-      updateData({
-        shareIntent: {
-          hasShareIntent: true,
-          url: shareIntent.webUrl || "",
-        },
-      });
+    if (hasShareIntent) {
+      if (shareIntent.webUrl) {
+        updateData({
+          shareIntent: {
+            hasShareIntent: true,
+            url: shareIntent.webUrl,
+          },
+        });
+      }
 
       resetShareIntent();
     }
@@ -71,11 +74,12 @@ export default Sentry.wrap(function RootLayout() {
       pathname !== "/incoming";
 
     if (needsRewrite) {
-      router.replace("/incoming");
-    }
-    if (hasShareIntent) {
-      resetShareIntent();
-      router.replace("/incoming");
+      if (!redirectingToIncoming.current) {
+        redirectingToIncoming.current = true;
+        router.replace("/incoming");
+      }
+    } else if (pathname === "/incoming") {
+      redirectingToIncoming.current = false;
     }
   }, [
     rootNavState?.key,
```

**File**: `apps/mobile/app/incoming.tsx` (modified, +53/-26)
```diff
@@ -17,6 +17,8 @@ import { SheetManager } from "react-native-actions-sheet";
 import { LinkIncludingShortenedCollectionAndTags } from "@linkwarden/types/global";
 import { SafeAreaView } from "react-native-safe-area-context";
 
+let pendingSubmission: { url: string; promise: Promise<any> } | null = null;
+
 export default function IncomingScreen() {
   const { auth } = useAuthStore();
   const router = useRouter();
@@ -27,33 +29,58 @@ export default function IncomingScreen() {
   const [link, setLink] = useState<LinkIncludingShortenedCollectionAndTags>();
 
   useEffect(() => {
-    if (auth.status === "authenticated" && data.shareIntent.url)
-      addLink.mutate(
-        {
-          url: data.shareIntent.url,
+    const url = data.shareIntent.url;
+
+    if (!url) {
+      pendingSubmission = null;
+      return;
+    }
+
+    if (auth.status !== "authenticated") return;
+
+    if (pendingSubmission?.url !== url) {
+      pendingSubmission = {
+        url,
+        promise: addLink.mutateAsync({
+          url,
           collection: { id: data.preferredCollection?.id },
-        },
-        {
-          onSuccess: (e) => {
-            setLink(e as unknown as LinkIncludingShortenedCollectionAndTags);
-            setShowSuccess(true);
-            setTimeout(() => {
-              updateData({
-                shareIntent: {
-                  hasShareIntent: false,
-                  url: "",
-                },
-              });
-              router.replace("/dashboard");
-            }, 1500);
-          },
-          onError: (error) => {
-            Alert.alert("Error", "There was an error adding the link.");
-            console.error("Error adding link:", error);
-          },
-        }
-      );
-  }, [auth, data.shareIntent.url]);
+        }),
+      };
+    }
+
+    let ignore = false;
+
+    pendingSubmission.promise.then(
+      (e) => {
+        if (ignore) return;
+
+        setLink(e as unknown as LinkIncludingShortenedCollectionAndTags);
+        setShowSuccess(true);
+        setTimeout(() => {
+          pendingSubmission = null;
+          updateData({
+            shareIntent: {
+              hasShareIntent: false,
+              url: "",
+            },
+          });
+          router.replace("/dashboard");
+        }, 1500);
+      },
+      (error) => {
+        pendingSubmission = null;
+
+        if (ignore) return;
+
+        Alert.alert("Error", "There was an error adding the link.");
+        console.error("Error adding link:", error);
+      }
+    );
+
+    return () => {
+      ignore = true;
+    };
+  }, [auth.status, data.shareIntent.url]);
 
   if (auth.status === "unauthenticated") return <Redirect href="/" />;
 
```

---

### Incident Patch 3: `6894f775` (2026-09-08)
**Commit Message**: fix(web): improved performance for the collections api route

**File**: `apps/web/lib/api/controllers/collections/getCollections.ts` (modified, +21/-4)
```diff
@@ -1,7 +1,7 @@
 import { prisma } from "@linkwarden/prisma";
 
 export default async function getCollection(userId: number) {
-  const [user, collections] = await Promise.all([
+  const [user, collectionsWithoutCount] = await Promise.all([
     prisma.user.findUnique({
       where: { id: userId },
       select: { collectionOrder: true },
@@ -14,9 +14,6 @@ export default async function getCollection(userId: number) {
         ],
       },
       include: {
-        _count: {
-          select: { links: true },
-        },
         parent: {
           select: {
             id: true,
@@ -38,6 +35,26 @@ export default async function getCollection(userId: number) {
     }),
   ]);
 
+  const linkCounts =
+    collectionsWithoutCount.length > 0
+      ? await prisma.link.groupBy({
+          by: ["collectionId"],
+          where: {
+            collectionId: { in: collectionsWithoutCount.map((c) => c.id) },
+          },
+          _count: { _all: true },
+        })
+      : [];
+
+  const linkCountByCollectionId = new Map(
+    linkCounts.map((row) => [row.collectionId, row._count._all])
+  );
+
+  const collections = collectionsWithoutCount.map((collection) => ({
+    ...collection,
+    _count: { links: linkCountByCollectionId.get(collection.id) ?? 0 },
+  }));
+
   const orderIndex = new Map<number, number>(
     (user?.collectionOrder ?? []).map((id, index) => [Number(id), index])
   );
```

---

### Incident Patch 4: `2d2da5b5` (2026-09-08)
**Commit Message**: fix(web): improved performance for the tags api route

**File**: `apps/web/lib/api/controllers/tags/getTags.ts` (modified, +56/-49)
```diff
@@ -1,5 +1,20 @@
 import { prisma } from "@linkwarden/prisma";
 import { TagRequestQuery, TagSort } from "@linkwarden/types/global";
+import { Tag } from "@linkwarden/prisma/client";
+
+async function withLinkCounts<T extends Tag>(
+  tags: T[]
+): Promise<(T & { _count: { links: number } })[]> {
+  if (tags.length === 0) return [];
+
+  const counts = await prisma.$transaction(
+    tags.map((tag) =>
+      prisma.link.count({ where: { tags: { some: { id: tag.id } } } })
+    )
+  );
+
+  return tags.map((tag, i) => ({ ...tag, _count: { links: counts[i] } }));
+}
 
 export default async function getTags({
   userId,
@@ -59,40 +74,37 @@ export default async function getTags({
       (memberCollection) => memberCollection.collectionId
     );
 
-    const tags = await prisma.tag.findMany({
-      take: paginationTakeCount,
-      skip: query.cursor ? 1 : undefined,
-      cursor: query.cursor ? { id: query.cursor } : undefined,
-      where: {
-        AND: [
-          ...(searchCondition ? [searchCondition] : []),
-          {
-            OR: [
-              { ownerId: userId }, // Tags owned by the user
-              ...(memberCollectionIds.length > 0
-                ? [
-                    {
-                      links: {
-                        some: {
-                          collectionId: {
-                            in: memberCollectionIds,
+    const tags = await withLinkCounts(
+      await prisma.tag.findMany({
+        take: paginationTakeCount,
+        skip: query.cursor ? 1 : undefined,
+        cursor: query.cursor ? { id: query.cursor } : undefined,
+        where: {
+          AND: [
+            ...(searchCondition ? [searchCondition] : []),
+            {
+              OR: [
+                { ownerId: userId }, // Tags owned by the user
+                ...(memberCollectionIds.length > 0
+                  ? [
+                      {
+                        links: {
+                          some: {
+                            collectionId: {
+                              in: memberCollectionIds,
+                            },
                           },
                         },
                       },
-                    },
-                  ]
-                : []),
-            ],
-          },
-        ],
-      },
-      include: {
-        _count: {
-          select: { links: true },
+                    ]
+                  : []),
+              ],
+            },
+          ],
         },
-      },
-      orderBy,
-    });
+        orderBy,
+      })
+    );
 
     return {
       data: {
@@ -105,28 +117,23 @@ export default async function getTags({
       message: "Success",
     };
   } else if (collectionId) {
-    const tags = await prisma.tag.findMany({
-      where: {
-        AND: [
-          ...(searchCondition ? [searchCondition] : []),
-          {
-            links: {
-              some: {
-                collectionId,
+    const tags = await withLinkCounts(
+      await prisma.tag.findMany({
+        where: {
+          AND: [
+            ...(searchCondition ? [searchCondition] : []),
+            {
+              links: {
+                some: {
+                  collectionId,
+                },
               },
             },
-          },
-        ],
-      },
-      include: {
-        _count: {
-          select: {
-            links: true,
-          },
+          ],
         },
-      },
-      orderBy: [{ name: "asc" }, { id: "asc" }],
-    });
+        orderBy: [{ name: "asc" }, { id: "asc" }],
+      })
+    );
 
     return {
       data: {
```

---

### Incident Patch 5: `01c1587d` (2026-09-08)
**Commit Message**: fix(extension): fix #1643

**File**: `apps/extension/manifest.config.ts` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ const targets: Record<ManifestTarget, TargetOptions> = {
  * into `version.xcconfig`, which the Xcode project reads as its base
  * configuration. Bump it here and nowhere else.
  */
-export const version = "1.5.5";
+export const version = "1.5.6";
 
 const icons = {
   "16": "16.png",
```

**File**: `apps/extension/src/@/components/BookmarkForm.tsx` (modified, +7/-7)
```diff
@@ -107,9 +107,7 @@ const BookmarkForm = () => {
     },
     onSuccess: () => {
       // Update badge to show link is saved
-      getCurrentTabInfo().then(({ id }) => {
-        updateBadge(id);
-      });
+      updateBadge(tabInfo?.id, true);
       setTimeout(() => {
         window.close();
         // I want to show some confirmation before it's closed...
@@ -130,18 +128,20 @@ const BookmarkForm = () => {
       setTabInfo(t);
       setConfig(c);
 
-      updateBadge(t.id);
-
       form.setValue("url", t.url ? t.url : "");
       form.setValue("name", t.title ? t.title : "");
       form.setValue("collection", {
         name: c.defaultCollection,
       });
 
       const configured = await getIsConfigured();
-      const duplicate = await checkLinkExists(c.baseUrl, c.apiKey);
-      setIsDuplicate(duplicate);
       setIsConfigured(configured);
+
+      if (!configured) return;
+
+      const duplicate = await checkLinkExists(c.baseUrl, c.apiKey, t.url);
+      setIsDuplicate(duplicate);
+      updateBadge(t.id, duplicate);
     };
 
     setTabInformation();
```

**File**: `apps/extension/src/@/lib/actions/links.ts` (modified, +30/-29)
```diff
@@ -1,22 +1,21 @@
-import captureScreenshot from '../screenshot.ts';
-import { bookmarkFormValues } from '../validators/bookmarkForm.ts';
-import axios from 'axios';
+import captureScreenshot from "../screenshot.ts";
+import { bookmarkFormValues } from "../validators/bookmarkForm.ts";
+import axios from "axios";
 // import { bookmarkMetadata } from '../cache.ts';
-import { getCurrentTabInfo } from '../utils.ts';
 
 export async function postLink(
   baseUrl: string,
   uploadImage: boolean,
   data: bookmarkFormValues,
-  setState: (state: 'capturing' | 'uploading' | null) => void,
+  setState: (state: "capturing" | "uploading" | null) => void,
   apiKey: string
 ) {
   const url = `${baseUrl}/api/v1/links`;
 
   if (uploadImage) {
-    setState('capturing');
+    setState("capturing");
     const screenshot = await captureScreenshot();
-    setState('uploading');
+    setState("uploading");
 
     const link = await axios.post(url, data, {
       headers: {
@@ -28,11 +27,11 @@ export async function postLink(
     const archiveUrl = `${baseUrl}/api/v1/archives/${id}?format=0`;
 
     const formData = new FormData();
-    formData.append('file', screenshot, 'screenshot.png');
+    formData.append("file", screenshot, "screenshot.png");
 
     await axios.post(archiveUrl, formData, {
       headers: {
-        'Content-Type': 'multipart/form-data',
+        "Content-Type": "multipart/form-data",
         Authorization: `Bearer ${apiKey}`,
       },
     });
@@ -43,7 +42,7 @@ export async function postLink(
   } else {
     return await axios.post(url, data, {
       headers: {
-        'Content-Type': 'application/json',
+        "Content-Type": "application/json",
         Authorization: `Bearer ${apiKey}`,
       },
     });
@@ -58,10 +57,10 @@ export async function postLinkFetch(
   const url = `${baseUrl}/api/v1/links`;
 
   return await fetch(url, {
-    method: 'POST',
+    method: "POST",
     body: JSON.stringify(data),
     headers: {
-      'Content-Type': 'application/json',
+      "Content-Type": "application/json",
       Authorization: `Bearer ${apiKey}`,
     },
   });
@@ -76,10 +75,10 @@ export async function updateLinkFetch(
   const url = `${baseUrl}/api/v1/links/${id}`;
 
   return await fetch(url, {
-    method: 'PUT',
+    method: "PUT",
     body: JSON.stringify(data),
     headers: {
-      'Content-Type': 'application/json',
+      "Content-Type": "application/json",
       Authorization: `Bearer ${apiKey}`,
     },
   });
@@ -93,7 +92,7 @@ export async function deleteLinkFetch(
   const url = `${baseUrl}/api/v1/links/${id}`;
 
   return await fetch(url, {
-    method: 'DELETE',
+    method: "DELETE",
     headers: {
       Authorization: `Bearer ${apiKey}`,
     },
@@ -115,27 +114,29 @@ export async function deleteLinkFetch(
 
 export async function checkLinkExists(
   baseUrl: string,
-  apiKey: string
+  apiKey: string,
+  linkUrl: string | undefined
 ): Promise<boolean> {
-  const tabInfo = await getCurrentTabInfo();
-  if (!tabInfo.url) {
-    console.error('No URL found for current tab');
+  if (!baseUrl || !apiKey || !linkUrl) {
     return false;
   }
 
   const url =
     `${baseUrl}/api/v1/search?sort=0&searchQueryString=` +
-    encodeURIComponent(`url:${tabInfo.url}`);
-
-  const response = await fetch(url, {
-    headers: {
-      Authorization: `Bearer ${apiKey}`,
-    },
-  });
+    encodeURIComponent(`url:${linkUrl}`);
 
-  const { data } = await response.json();
+  try {
+    const response = await fetch(url, {
+      headers: {
+        Authorization: `Bearer ${apiKey}`,
+      },
+    });
 
-  const exists = !!data && data.links?.length > 0;
+    const { data } = await response.json();
 
-  return exists;
+    return !!data && data.links?.length > 0;
+  } catch (error) {
+    console.error(error);
+    return false;
+  }
 }
```

**File**: `apps/extension/src/@/lib/utils.ts` (modified, +17/-30)
```diff
@@ -1,7 +1,5 @@
-import { type ClassValue, clsx } from 'clsx';
-import { twMerge } from 'tailwind-merge';
-import { checkLinkExists } from './actions/links.ts';
-import { getConfig } from './config.ts';
+import { type ClassValue, clsx } from "clsx";
+import { twMerge } from "tailwind-merge";
 
 export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
@@ -32,11 +30,11 @@ export async function getCurrentTabInfo(): Promise<{
 export function getBrowser(): typeof chrome {
   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
   //@ts-ignore
-  return typeof browser !== 'undefined' ? browser : chrome;
+  return typeof browser !== "undefined" ? browser : chrome;
 }
 
 export function getChromeStorage() {
-  return typeof chrome !== 'undefined' && !!chrome.storage;
+  return typeof chrome !== "undefined" && !!chrome.storage;
 }
 
 export async function getStorageItem(key: string): Promise<string | undefined> {
@@ -60,7 +58,7 @@ export async function setStorageItem(key: string, value: string) {
 
 export function isSafari(): boolean {
   try {
-    return /^safari-web-extension:/.test(getBrowser().runtime.getURL(''));
+    return /^safari-web-extension:/.test(getBrowser().runtime.getURL(""));
   } catch {
     return false;
   }
@@ -69,38 +67,27 @@ export function isSafari(): boolean {
 export function hasAPI(api: string): boolean {
   const b = getBrowser();
   let obj: any = b;
-  for (const part of api.split('.')) {
-    if (!obj || typeof obj[part] === 'undefined') return false;
+  for (const part of api.split(".")) {
+    if (!obj || typeof obj[part] === "undefined") return false;
     obj = obj[part];
   }
   return true;
 }
 
-export async function updateBadge(tabId: number | undefined) {
+export async function updateBadge(
+  tabId: number | undefined,
+  linkExists: boolean
+) {
   if (!tabId) return;
 
   const browser = getBrowser();
-  const cachedConfig = await getConfig();
-  const linkExists = await checkLinkExists(
-    cachedConfig.baseUrl,
-    cachedConfig.apiKey
-  );
+  const action = browser.action ?? browser.browserAction;
+  if (!action) return;
+
   if (linkExists) {
-    if (browser.action) {
-      browser.action.setBadgeText({ tabId, text: '✓' });
-      browser.action.setBadgeBackgroundColor({ tabId, color: '#98c0ff' });
-    } else {
-      browser.browserAction.setBadgeText({ tabId, text: '✓' });
-      browser.browserAction.setBadgeBackgroundColor({
-        tabId,
-        color: '#98c0ff',
-      });
-    }
+    action.setBadgeText({ tabId, text: "✓" });
+    action.setBadgeBackgroundColor({ tabId, color: "#98c0ff" });
   } else {
-    if (browser.action) {
-      browser.action.setBadgeText({ tabId, text: '' });
-    } else {
-      browser.browserAction.setBadgeText({ tabId, text: '' });
-    }
+    action.setBadgeText({ tabId, text: "" });
   }
 }
```

**File**: `apps/extension/src/pages/Background/index.ts` (modified, +31/-67)
```diff
@@ -4,22 +4,22 @@ import {
   hasAPI,
   isSafari,
   updateBadge,
-} from '../../@/lib/utils.ts';
+} from "../../@/lib/utils.ts";
 // import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
-import { getConfig, isConfigured } from '../../@/lib/config.ts';
+import { getConfig, isConfigured } from "../../@/lib/config.ts";
 import {
   // deleteLinkFetch,
   // updateLinkFetch,
   postLinkFetch,
-} from '../../@/lib/actions/links.ts';
+} from "../../@/lib/actions/links.ts";
 import {
   bookmarkMetadata,
   // deleteBookmarkMetadata,
   // getBookmarkMetadataByBookmarkId,
   // getBookmarkMetadataByUrl,
   getBookmarksMetadata,
   saveBookmarkMetadata,
-} from '../../@/lib/cache.ts';
+} from "../../@/lib/cache.ts";
 import OnClickData = chrome.contextMenus.OnClickData;
 
 // @types/chrome models these as TS enums, but the runtime APIs take and hand
@@ -211,24 +211,24 @@ async function genericOnClick(
     return;
   }
   switch (info.menuItemId) {
-    case 'save-all-tabs': {
+    case "save-all-tabs": {
       const tabs = await browser.tabs.query({ currentWindow: true });
       const config = await getConfig();
 
       for (const tab of tabs) {
         if (
           tab.url &&
-          !tab.url.startsWith('chrome://') &&
-          !tab.url.startsWith('about:')
+          !tab.url.startsWith("chrome://") &&
+          !tab.url.startsWith("about:")
         ) {
           try {
             if (new URL(tab.url))
               await postLinkFetch(
                 config.baseUrl,
                 {
                   url: tab.url,
-                  name: tab.title || '',
-                  description: tab.title || '',
+                  name: tab.title || "",
+                  description: tab.title || "",
                   collection: {
                     name: config.defaultCollection,
                   },
@@ -245,9 +245,9 @@ async function genericOnClick(
     }
     default:
       // Handle cases where sync is enabled or not
-      if (syncBookmarks && hasAPI('bookmarks.create')) {
+      if (syncBookmarks && hasAPI("bookmarks.create")) {
         browser.bookmarks.create({
-          parentId: '1',
+          parentId: "1",
           title: tab.title,
           url: tab.url,
         });
@@ -260,7 +260,7 @@ async function genericOnClick(
             {
               url: tab.url,
               collection: {
-                name: 'Unorganized',
+                name: "Unorganized",
               },
               tags: [],
               name: tab.title,
@@ -283,76 +283,40 @@ async function genericOnClick(
 browser.runtime.onInstalled.addListener(async function () {
   // Create one test item for each context type.
   const contexts: ContextType[] = isSafari()
-    ? ['page', 'selection', 'link']
-    : ['page', 'selection', 'link', 'editable', 'image', 'video', 'audio'];
+    ? ["page", "selection", "link"]
+    : ["page", "selection", "link", "editable", "image", "video", "audio"];
   for (const context of contexts) {
-    const title: string = 'Add link to Linkwarden';
+    const title: string = "Add link to Linkwarden";
     browser.contextMenus.create({
       title: title,
       contexts: [context],
       id: context,
     });
   }
   browser.contextMenus.create({
-    id: 'save-all-tabs',
-    title: 'Save all tabs to Linkwarden',
-    contexts: ['page'],
+    id: "save-all-tabs",
+    title: "Save all tabs to Linkwarden",
+    contexts: ["page"],
   });
-
-  const { id: tabId } = await getCurrentTabInfo();
-  await updateBadge(tabId);
-});
-
-browser.tabs.onActivated.addListener(async ({ tabId }) => {
-  try {
-    await updateBadge(tabId);
-  } catch (error) {
-    console.error(`Error checking tab ${tabId} on activation:`, error);
-  }
-});
-
-browser.tabs.onUpdated.addListener(async (tabId) => {
-  try {
-    await updateBadge(tabId);
-  } catch (error) {
-    console.error(`Error checking tab ${tabId} on activation:`, error);
-  }
 });
 
-// Listen for URL changes (navigation, page loads)
-browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
+browser.tabs.onUpdated.addListener(async (tabId: any, changeInfo: any) => {
+  if (!changeInfo.url) return;
   try {
-    if (changeInfo.status === 'complete' && tab?.active) {
-      await updateBadge(tabId);
-    }
+    await updateBadge(tabId, false);
   } catch (error) {
-    console.error(`Error checking tab ${tabId} on update:`, error);
+    console.error(`Error clearing the badge of tab ${tabId}:`, error);
   }
 });
 
-// On extension startup - check current tab
-(async () => {
-  try {
-    const [tab] = await browser.tabs.query({
-      active: true,
-      currentWindow: true,
-    });
-    if (tab?.id) {
-      await updateBadge(tab.id);
-    }
-  } catch (error) {
-    console.error(`Error checking tab on startup:`, error);
-  }
-})();
-
 // Omnibox implementation (not available in Safari)
 
-if (hasAPI('omnibox.onInputStarted')) {
+if (hasAPI("omnibox.onInputStarted")) {
   browser.omnibox.onInpu
```

---

### Incident Patch 6: `9528e300` (2026-09-04)
**Commit Message**: refactor(extension): improved UX + bug fix

**File**: `apps/extension/package.json` (modified, +0/-1)
```diff
@@ -20,7 +20,6 @@
     "@radix-ui/react-icons": "^1.3.2",
     "@radix-ui/react-label": "^2.1.15",
     "@radix-ui/react-popover": "^1.1.23",
-    "@radix-ui/react-select": "^2.3.7",
     "@radix-ui/react-separator": "^1.1.7",
     "@radix-ui/react-slot": "^1.2.3",
     "@radix-ui/react-toast": "^1.2.23",
```

**File**: `apps/extension/src/@/components/BookmarkForm.tsx` (modified, +1/-0)
```diff
@@ -117,6 +117,7 @@ const BookmarkForm = () => {
       toast({
         title: "Success",
         description: "Link saved successfully!",
+        variant: "success",
       });
     },
   });
```

**File**: `apps/extension/src/@/components/OptionsForm.tsx` (modified, +48/-41)
```diff
@@ -26,43 +26,59 @@ import {
   isConfigured,
   saveConfig,
 } from "../lib/config.ts";
+import { configType } from "../lib/validators/config.ts";
 import { Toaster } from "./ui/Toaster.tsx";
 import { toast } from "../../hooks/useToast.ts";
 import { AxiosError } from "axios";
 import { clearBookmarksMetadata } from "../lib/cache.ts";
 import { getSession } from "../lib/auth/auth.ts";
-import {
-  Select,
-  SelectContent,
-  SelectItem,
-  SelectTrigger,
-  SelectValue,
-} from "./ui/Select.tsx";
+import SelectInput, { SelectOption } from "./SelectInput.tsx";
 
 interface OptionsFormProps {
   onSaved?: () => void;
   onCleared?: () => void;
+  initialConfig?: configType;
 }
 
+const EMPTY_FORM: optionsFormInput = {
+  baseUrl: "https://cloud.linkwarden.app",
+  method: "username",
+  username: "",
+  password: "",
+  apiKey: "",
+  syncBookmarks: false,
+  defaultCollection: "Unorganized",
+};
+
+const METHOD_OPTIONS: SelectOption[] = [
+  { value: "username", label: "Username and Password" },
+  { value: "apiKey", label: "API Key" },
+];
+
 const displayInstance = (baseUrl: string) =>
   baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
 
-const OptionsForm = ({ onSaved, onCleared }: OptionsFormProps) => {
+const signedInInstance = (config: configType | undefined) => {
+  if (config === undefined) return undefined;
+  return config.baseUrl && config.apiKey ? config.baseUrl : null;
+};
+
+const OptionsForm = ({
+  onSaved,
+  onCleared,
+  initialConfig,
+}: OptionsFormProps) => {
+  const initialSignedInTo = signedInInstance(initialConfig);
+
   const [signedInTo, setSignedInTo] = useState<string | undefined | null>(
-    undefined
+    initialSignedInTo
   );
 
   const form = useForm<optionsFormInput, unknown, optionsFormValues>({
     resolver: zodResolver(optionsFormSchema),
-    defaultValues: {
-      baseUrl: "https://cloud.linkwarden.app",
-      method: "username",
-      username: "",
-      password: "",
-      apiKey: "",
-      syncBookmarks: false,
-      defaultCollection: "Unorganized",
-    },
+    defaultValues: initialSignedInTo
+      ? { ...EMPTY_FORM, ...initialConfig }
+      : EMPTY_FORM,
   });
 
   const { mutate: onSignOut, isPending: signOutLoading } = useMutation({
@@ -183,25 +199,23 @@ const OptionsForm = ({ onSaved, onCleared }: OptionsFormProps) => {
       toast({
         title: "Saved",
         description: "Your settings have been saved.",
-        variant: "default",
+        variant: "success",
       });
 
       onSaved?.();
     },
   });
 
   useEffect(() => {
+    if (initialSignedInTo !== undefined) return;
+
     (async () => {
-      const configured = await isConfigured();
-      if (configured) {
-        const cachedOptions = await getConfig();
-        form.reset(cachedOptions);
-        setSignedInTo(cachedOptions.baseUrl);
-      } else {
-        setSignedInTo(null);
-      }
+      const cachedOptions = await getConfig();
+      const instance = signedInInstance(cachedOptions);
+      if (instance) form.reset({ ...EMPTY_FORM, ...cachedOptions });
+      setSignedInTo(instance);
     })();
-  }, [form]);
+  }, [form, initialSignedInTo]);
 
   const { handleSubmit, control, watch } = form;
   const method = watch("method");
@@ -268,19 +282,12 @@ const OptionsForm = ({ onSaved, onCleared }: OptionsFormProps) => {
                 <FormDescription>
                   Choose your preferred authentication method.
                 </FormDescription>
-                <FormControl>
-                  <Select value={field.value} onValueChange={field.onChange}>
-                    <SelectTrigger className="w-full justify-between bg-neutral-100 dark:bg-neutral-900 outline-none focus:outline-none ring-0 focus:ring-0">
-                      <SelectValue placeholder="Select authentication method" />
-                    </SelectTrigger>
-                    <SelectContent>
-                      <SelectItem value="username">
-                        Username and Password
-                      </SelectItem>
-                      <SelectItem value="apiKey">API Key</SelectItem>
-                    </SelectContent>
-                  </Select>
-                </FormControl>
+                <SelectInput
+                  value={field.value ?? ""}
+                  onChange={field.onChange}
+                  options={METHOD_OPTIONS}
+                  placeholder="Select authentication method"
+                />
                 <FormMessage />
               </FormItem>
             )}
```

**File**: `apps/extension/src/@/components/SelectInput.tsx` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+import { useState } from "react";
+import { CaretSortIcon } from "@radix-ui/react-icons";
+import { Check } from "lucide-react";
+import { Button } from "./ui/Button.tsx";
+import { FormControl } from "./ui/Form.tsx";
+import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover.tsx";
+import { useListboxKeys } from "../../hooks/useListboxKeys.ts";
+
+export type SelectOption = { value: string; label: string };
+
+type Props = {
+  value: string;
+  onChange: (value: string) => void;
+  options: SelectOption[];
+  placeholder?: string;
+};
+
+export default function SelectInput({
+  value,
+  onChange,
+  options,
+  placeholder = "Select...",
+}: Props) {
+  const [open, setOpen] = useState(false);
+
+  const handleSelect = (option: SelectOption) => {
+    onChange(option.value);
+    setOpen(false);
+  };
+
+  const { activeIndex, listId, optionId, handleKeyDown } = useListboxKeys({
+    options,
+    onEnter: (option) => option && handleSelect(option),
+    onClose: () => setOpen(false),
+  });
+
+  const selected = options.find((option) => option.value === value);
+
+  return (
+    <div className="min-w-full">
+      <Popover open={open} onOpenChange={setOpen}>
+        <PopoverTrigger asChild>
+          <FormControl>
+            <Button
+              variant="outline"
+              aria-haspopup="listbox"
+              aria-expanded={open}
+              className="w-full justify-between bg-neutral-100 dark:bg-neutral-900"
+            >
+              {selected?.label || placeholder}
+              <CaretSortIcon
+                aria-hidden
+                className="ml-2 h-4 w-4 shrink-0 opacity-50"
+              />
+            </Button>
+          </FormControl>
+        </PopoverTrigger>
+
+        {open && (
+          <PopoverContent
+            className="w-[var(--radix-popper-anchor-width)] p-0"
+            onKeyDown={handleKeyDown}
+          >
+            <div
+              id={listId}
+              role="listbox"
+              className="w-full overflow-y-auto p-1 text-foreground"
+            >
+              {options.map((option, index) => (
+                <div
+                  key={option.value}
+                  id={optionId(index)}
+                  role="option"
+                  aria-selected={option.value === value}
+                  onClick={() => handleSelect(option)}
+                  className={`relative flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${
+                    index === activeIndex
+                      ? "bg-accent text-accent-foreground"
+                      : ""
+                  }`}
+                >
+                  {option.label}
+                  {option.value === value && (
+                    <Check aria-hidden className="ml-2 h-4 w-4 shrink-0" />
+                  )}
+                </div>
+              ))}
+            </div>
+          </PopoverContent>
+        )}
+      </Popover>
+    </div>
+  );
+}
```

**File**: `apps/extension/src/@/components/ui/Select.tsx` (removed, +0/-119)
```diff
@@ -1,119 +0,0 @@
-import * as React from 'react';
-import * as SelectPrimitive from '@radix-ui/react-select';
-import { Check, ChevronDown } from 'lucide-react';
-
-import { cn } from '../../lib/utils.ts';
-
-const Select = SelectPrimitive.Root;
-
-const SelectGroup = SelectPrimitive.Group;
-
-const SelectValue = SelectPrimitive.Value;
-
-const SelectTrigger = React.forwardRef<
-  React.ElementRef<typeof SelectPrimitive.Trigger>,
-  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
->(({ className, children, ...props }, ref) => (
-  <SelectPrimitive.Trigger
-    ref={ref}
-    className={cn(
-      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
-      className,
-    )}
-    {...props}
-  >
-    {children}
-    <SelectPrimitive.Icon asChild>
-      <ChevronDown className='h-4 w-4 opacity-50' />
-    </SelectPrimitive.Icon>
-  </SelectPrimitive.Trigger>
-));
-SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
-
-const SelectContent = React.forwardRef<
-  React.ElementRef<typeof SelectPrimitive.Content>,
-  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
->(({ className, children, position = 'popper', ...props }, ref) => (
-  <SelectPrimitive.Portal>
-    <SelectPrimitive.Content
-      ref={ref}
-      className={cn(
-        'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
-        position === 'popper' &&
-        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
-        className,
-      )}
-      position={position}
-      {...props}
-    >
-      <SelectPrimitive.Viewport
-        className={cn(
-          'p-1',
-          position === 'popper' &&
-          'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
-        )}
-      >
-        {children}
-      </SelectPrimitive.Viewport>
-    </SelectPrimitive.Content>
-  </SelectPrimitive.Portal>
-));
-SelectContent.displayName = SelectPrimitive.Content.displayName;
-
-const SelectLabel = React.forwardRef<
-  React.ElementRef<typeof SelectPrimitive.Label>,
-  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
->(({ className, ...props }, ref) => (
-  <SelectPrimitive.Label
-    ref={ref}
-    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
-    {...props}
-  />
-));
-SelectLabel.displayName = SelectPrimitive.Label.displayName;
-
-const SelectItem = React.forwardRef<
-  React.ElementRef<typeof SelectPrimitive.Item>,
-  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
->(({ className, children, ...props }, ref) => (
-  <SelectPrimitive.Item
-    ref={ref}
-    className={cn(
-      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
-      className,
-    )}
-    {...props}
-  >
-    <span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
-      <SelectPrimitive.ItemIndicator>
-        <Check className='h-4 w-4' />
-      </SelectPrimitive.ItemIndicator>
-    </span>
-
-    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
-  </SelectPrimitive.Item>
-));
-SelectItem.displayName = SelectPrimitive.Item.displayName;
-
-const SelectSeparator = React.forwardRef<
-  React.ElementRef<typeof SelectPrimitive.Separator>,
-  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
->(({ className, ...props }, ref) => (
-  <SelectPrimitive.Separator
-    ref={ref}
-    className={cn('-mx-1 my-1 h-px bg-muted', className)}
-    {...props}
-  />
-));
-SelectSeparator.displayName = SelectPrimitive.Separator.displayName;
-
-export {
-  Select,
-  SelectGroup,
-  SelectValue,
-  SelectTrigger,
-  SelectContent,
-  SelectLabel,
-  SelectItem,
-  SelectSeparator,
-};
```

**File**: `apps/extension/src/@/components/ui/Toast.tsx` (modified, +16/-14)
```diff
@@ -1,9 +1,9 @@
-import * as React from 'react';
-import * as ToastPrimitives from '@radix-ui/react-toast';
-import { cva, type VariantProps } from 'class-variance-authority';
-import { X } from 'lucide-react';
+import * as React from "react";
+import * as ToastPrimitives from "@radix-ui/react-toast";
+import { cva, type VariantProps } from "class-variance-authority";
+import { X } from "lucide-react";
 
-import { cn } from '../../lib/utils';
+import { cn } from "../../lib/utils";
 
 const ToastProvider = ToastPrimitives.Provider;
 
@@ -14,7 +14,7 @@ const ToastViewport = React.forwardRef<
   <ToastPrimitives.Viewport
     ref={ref}
     className={cn(
-      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 mx-auto right-0 left-0 sm:top-auto sm:flex-col md:max-w-[420px]',
+      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 mx-auto right-0 left-0 sm:top-auto sm:flex-col md:max-w-[420px]",
       className
     )}
     {...props}
@@ -23,17 +23,19 @@ const ToastViewport = React.forwardRef<
 ToastViewport.displayName = ToastPrimitives.Viewport.displayName;
 
 const toastVariants = cva(
-  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
+  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
   {
     variants: {
       variant: {
-        default: 'border bg-background',
+        default: "border bg-background",
         destructive:
-          'destructive group border-destructive bg-destructive text-destructive-foreground',
+          "destructive group border-destructive bg-destructive text-destructive-foreground",
+        success:
+          "success group border-green-600/60 bg-background text-foreground",
       },
     },
     defaultVariants: {
-      variant: 'default',
+      variant: "default",
     },
   }
 );
@@ -60,7 +62,7 @@ const ToastAction = React.forwardRef<
   <ToastPrimitives.Action
     ref={ref}
     className={cn(
-      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive',
+      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
       className
     )}
     {...props}
@@ -75,7 +77,7 @@ const ToastClose = React.forwardRef<
   <ToastPrimitives.Close
     ref={ref}
     className={cn(
-      'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600',
+      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
       className
     )}
     toast-close=""
@@ -
```

**File**: `apps/extension/src/@/components/ui/Toaster.tsx` (modified, +22/-6)
```diff
@@ -6,21 +6,37 @@ import {
   ToastTitle,
   ToastViewport,
 } from "../ui/Toast";
+import { CheckCircle2 } from "lucide-react";
 import { useToast } from "../../../hooks/useToast";
 
 export function Toaster() {
   const { toasts } = useToast();
 
   return (
     <ToastProvider>
-      {toasts.map(function ({ id, title, description, action, ...props }) {
+      {toasts.map(function ({
+        id,
+        title,
+        description,
+        action,
+        variant,
+        ...props
+      }) {
         return (
-          <Toast key={id} {...props}>
-            <div className="grid gap-1">
-              {title && <ToastTitle>{title}</ToastTitle>}
-              {description && (
-                <ToastDescription>{description}</ToastDescription>
+          <Toast key={id} variant={variant} {...props}>
+            <div className="flex items-start gap-3">
+              {variant === "success" && (
+                <CheckCircle2
+                  aria-hidden
+                  className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
+                />
               )}
+              <div className="grid gap-1">
+                {title && <ToastTitle>{title}</ToastTitle>}
+                {description && (
+                  <ToastDescription>{description}</ToastDescription>
+                )}
+              </div>
             </div>
             {action}
             <ToastClose />
```

**File**: `apps/extension/src/hooks/useToast.ts` (modified, +4/-0)
```diff
@@ -8,6 +8,8 @@ import type {
 const TOAST_LIMIT = 1;
 const TOAST_REMOVE_DELAY = 1000000;
 
+const SUCCESS_TOAST_DURATION = 1000;
+
 type ToasterToast = ToastProps & {
   id: string;
   title?: React.ReactNode;
@@ -150,6 +152,8 @@ function toast({ ...props }: Toast) {
   dispatch({
     type: "ADD_TOAST",
     toast: {
+      duration:
+        props.variant === "success" ? SUCCESS_TOAST_DURATION : undefined,
       ...props,
       id,
       open: true,
```

---

### Incident Patch 7: `59243b38` (2026-09-04)
**Commit Message**: fix(extension): bug fix

**File**: `apps/extension/src/@/components/CollectionInput.tsx` (modified, +4/-4)
```diff
@@ -62,7 +62,7 @@ export default function CollectionInput({
   const list = (
     <div
       onKeyDown={handleKeyDown}
-      className={`flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground ${
+      className={`flex h-full w-full flex-col bg-popover text-popover-foreground ${
         fullScreen ? "rounded-none" : "rounded-md"
       }`}
     >
@@ -92,7 +92,7 @@ export default function CollectionInput({
         <div
           id={listId}
           role="listbox"
-          className="w-full overflow-hidden p-1 text-foreground"
+          className="w-full overflow-y-auto p-1 text-foreground"
         >
           {filteredCollections.map((collection, index) => (
             <div
@@ -142,7 +142,7 @@ export default function CollectionInput({
               role="dialog"
               aria-modal
               aria-label="Select a collection"
-              className="fade-up fixed inset-0 z-50 h-full w-full overflow-y-auto bg-white"
+              className="fade-up fixed inset-0 z-50 h-full w-full bg-white"
             >
               <Button
                 type="button"
@@ -155,7 +155,7 @@ export default function CollectionInput({
               {list}
             </div>
           ) : (
-            <PopoverContent className="min-w-full p-0 overflow-y-auto max-h-[200px]">
+            <PopoverContent className="min-w-full p-0 h-[250px]">
               {list}
             </PopoverContent>
           ))}
```

---

### Incident Patch 8: `fa619a8d` (2026-09-04)
**Commit Message**: extension: add action to build the extensions

**File**: `.github/workflows/extension-build.yml` (added, +328/-0)
```diff
@@ -0,0 +1,328 @@
+name: Extension (build)
+
+on:
+  workflow_dispatch:
+    inputs:
+      chrome:
+        description: Build the Chrome package
+        type: boolean
+        default: true
+      firefox:
+        description: Build the Firefox package and its AMO source archive
+        type: boolean
+        default: true
+      safari:
+        description: Build and sign the Safari .pkg for App Store Connect
+        type: boolean
+        default: true
+
+concurrency:
+  group: extension-build
+  cancel-in-progress: false
+
+permissions:
+  contents: read
+
+jobs:
+  chrome:
+    name: Chrome
+    if: ${{ inputs.chrome }}
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
+
+      - name: Read version
+        run: |
+          VERSION=$(sed -n 's/^export const version = "\(.*\)";$/\1/p' apps/extension/manifest.config.ts | head -n 1)
+          # Two jobs at once. VERSION is written to $GITHUB_ENV, where a value
+          # carrying a newline would let the manifest define arbitrary
+          # environment variables for every step after this one. And a version
+          # the stores reject is better caught here than after a build: this
+          # takes two or three dot-separated numbers and nothing else. Three is the
+          # ceiling because Safari's MARKETING_VERSION is a
+          # CFBundleShortVersionString, so "1.5.4.1" would build and sign and
+          # then be rejected on upload. "1..2" and "v1.5.4" stop here too.
+          if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+(\.[0-9]+){1,2}$'; then
+            echo "Bad or missing version in manifest.config.ts: '$VERSION'"
+            exit 1
+          fi
+          echo "Extension version: $VERSION"
+          echo "VERSION=$VERSION" >> "$GITHUB_ENV"
+
+      - name: Setup Node
+        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
+        with:
+          node-version: 20
+
+      - name: Enable corepack (Yarn 4)
+        run: corepack enable
+
+      - name: Install dependencies
+        run: yarn install --immutable --mode=skip-build
+
+      - name: Build
+        run: yarn build
+        working-directory: apps/extension
+
+      - name: Check output
+        run: test -f apps/extension/dist/manifest.json
+
+      - name: Upload
+        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
+        with:
+          name: linkwarden-chrome-v${{ env.VERSION }}
+          path: apps/extension/dist
+          if-no-files-found: error
+          overwrite: true
+
+  firefox:
+    name: Firefox
+    if: ${{ inputs.firefox }}
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
+
+      - name: Read version
+        run: |
+          VERSION=$(sed -n 's/^export const version = "\(.*\)";$/\1/p' apps/extension/manifest.config.ts | head -n 1)
+          # Two jobs at once. VERSION is written to $GITHUB_ENV, where a value
+          # carrying a newline would let the manifest define arbitrary
+          # environment variables for every step after this one. And a version
+          # the stores reject is better caught here than after a build: this
+          # takes two or three dot-separated numbers and nothing else. Three is the
+          # ceiling because Safari's MARKETING_VERSION is a
+          # CFBundleShortVersionString, so "1.5.4.1" would build and sign and
+          # then be rejected on upload. "1..2" and "v1.5.4" stop here too.
+          if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+(\.[0-9]+){1,2}$'; then
+            echo "Bad or missing version in manifest.config.ts: '$VERSION'"
+            exit 1
+          fi
+          echo "Extension version: $VERSION"
+          echo "VERSION=$VERSION" >> "$GITHUB_ENV"
+
+      - name: Setup Node
+        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
+        with:
+          node-version: 20
+
+      - name: Enable corepack (Yarn 4)
+        run: corepack enable
+
+      - name: Install dependencies
+        run: yarn install --immutable --mode=skip-build
+
+      - name: Build
+        run: yarn build
+        working-directory: apps/extension
+
+      - name: Check file sizes
+        run: |
+          if find apps/extension/dist -type f -size +5M | grep -q .; then
+            echo "AMO rejects uploads containing files larger than 5MB:"
+            find apps/extension/dist -type f -size +5M -exec du -h {} +
+            exit 1
+          fi
+          echo "No file exceeds 5MB."
+
+      - name: Lint
+        continue-on-error: true
+        run: yarn web-ext lint --source-dir dist
+        working-directory: apps/extension
+
+      - name: Upload
+        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
+        with:
+          name: linkwarden-firefox-v${{ env.VERSION }}
```

---

### Incident Patch 9: `fb9d6d67` (2026-09-02)
**Commit Message**: minor fix

**File**: `yarn.lock` (modified, +4/-20)
```diff
@@ -6026,7 +6026,6 @@ __metadata:
     axios: "npm:^1.18.0"
     class-variance-authority: "npm:^0.7.1"
     clsx: "npm:^2.1.1"
-    cmdk: "npm:^1.1.1"
     concurrently: "npm:^9.1.2"
     eslint: "npm:8.46.0"
     eslint-plugin-react-hooks: "npm:^5.2.0"
@@ -6992,7 +6991,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@radix-ui/react-compose-refs@npm:1.1.5, @radix-ui/react-compose-refs@npm:^1.1.1":
+"@radix-ui/react-compose-refs@npm:1.1.5":
   version: 1.1.5
   resolution: "@radix-ui/react-compose-refs@npm:1.1.5"
   peerDependencies:
@@ -7100,7 +7099,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@radix-ui/react-dialog@npm:^1.1.23, @radix-ui/react-dialog@npm:^1.1.6":
+"@radix-ui/react-dialog@npm:^1.1.23":
   version: 1.1.23
   resolution: "@radix-ui/react-dialog@npm:1.1.23"
   dependencies:
@@ -7463,7 +7462,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@radix-ui/react-id@npm:1.1.4, @radix-ui/react-id@npm:^1.1.0":
+"@radix-ui/react-id@npm:1.1.4":
   version: 1.1.4
   resolution: "@radix-ui/react-id@npm:1.1.4"
   dependencies:
@@ -7903,7 +7902,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@radix-ui/react-primitive@npm:2.1.10, @radix-ui/react-primitive@npm:^2.0.2":
+"@radix-ui/react-primitive@npm:2.1.10":
   version: 2.1.10
   resolution: "@radix-ui/react-primitive@npm:2.1.10"
   dependencies:
@@ -12983,21 +12982,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"cmdk@npm:^1.1.1":
-  version: 1.1.1
-  resolution: "cmdk@npm:1.1.1"
-  dependencies:
-    "@radix-ui/react-compose-refs": "npm:^1.1.1"
-    "@radix-ui/react-dialog": "npm:^1.1.6"
-    "@radix-ui/react-id": "npm:^1.1.0"
-    "@radix-ui/react-primitive": "npm:^2.0.2"
-  peerDependencies:
-    react: ^18 || ^19 || ^19.0.0-rc
-    react-dom: ^18 || ^19 || ^19.0.0-rc
-  checksum: 10c0/5605ac4396ec9bc65c82f954da19dd89a0636a54026df72780e2470da1381f9d57434a80a53f2d57eaa4e759660a3ebba9232b74258dc09970576591eae03116
-  languageName: node
-  linkType: hard
-
 "co@npm:^4.6.0":
   version: 4.6.0
   resolution: "co@npm:4.6.0"
```

---

### Incident Patch 10: `e3e68ff9` (2026-09-01)
**Commit Message**: fix(extension): fix tailwind auto-completion

**File**: `apps/extension/tailwind.config.js` (modified, +2/-7)
```diff
@@ -1,12 +1,7 @@
 /** @type {import('tailwindcss').Config} */
 module.exports = {
   darkMode: ["class"],
-  content: [
-    './pages/**/*.{ts,tsx}',
-    './components/**/*.{ts,tsx}',
-    './app/**/*.{ts,tsx}',
-    './src/**/*.{ts,tsx}',
-	],
+  content: ["./src/**/*.{ts,tsx}"],
   theme: {
     container: {
       center: true,
@@ -73,4 +68,4 @@ module.exports = {
     },
   },
   plugins: [require("tailwindcss-animate")],
-}
\ No newline at end of file
+};
```

---

### Incident Patch 11: `6f47ba7e` (2026-09-01)
**Commit Message**: feat(extension): improved ux by moving the options page into the main view

**File**: `apps/extension/src/@/components/NotConfigured.tsx` (modified, +7/-12)
```diff
@@ -1,12 +1,14 @@
 import { FC } from 'react';
-import { openOptions } from '../lib/utils.ts';
 import { Button } from './ui/Button.tsx';
 
-const NotConfigured: FC<{ open: boolean }> = ({ open }) => {
+const NotConfigured: FC<{ open: boolean; onConfigure: () => void }> = ({
+  open,
+  onConfigure,
+}) => {
   if (!open) return null;
 
   return (
-    <div className="fixed top-0 bottom-0 left-0 right-0 inset-0 bg-white z-10">
+    <div className="fixed top-0 bottom-0 left-0 right-0 inset-0 bg-background z-10">
       <div className="container flex flex-col gap-3 justify-center items-center h-full max-w-lg mx-auto">
         <img
           src="./128.png"
@@ -15,19 +17,12 @@ const NotConfigured: FC<{ open: boolean }> = ({ open }) => {
           className="rounded"
           alt="Linkwarden Logo"
         />
-        <h1
-          className="font-medium text-lg text-zinc-700"
-          style={{ fontSize: '1.65rem' }}
-        >
+        <h1 className="font-medium text-lg" style={{ fontSize: '1.65rem' }}>
           Initial Setup
         </h1>
 
         <div className="flex justify-center items-center">
-          <Button
-            onClick={() => openOptions()}
-            className="w-40"
-            variant="outline"
-          >
+          <Button onClick={onConfigure} className="w-40" variant="outline">
             Configure
           </Button>
         </div>
```

**File**: `apps/extension/src/@/components/OptionsForm.tsx` (modified, +53/-20)
```diff
@@ -19,7 +19,7 @@ import {
 import { Input } from "./ui/Input.tsx";
 import { Button } from "./ui/Button.tsx";
 import { useMutation } from "@tanstack/react-query";
-import { useEffect } from "react";
+import { useEffect, useState } from "react";
 import {
   clearConfig,
   getConfig,
@@ -39,7 +39,19 @@ import {
   SelectValue,
 } from "./ui/Select.tsx";
 
-const OptionsForm = () => {
+interface OptionsFormProps {
+  onSaved?: () => void;
+  onCleared?: () => void;
+}
+
+const displayInstance = (baseUrl: string) =>
+  baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
+
+const OptionsForm = ({ onSaved, onCleared }: OptionsFormProps) => {
+  const [signedInTo, setSignedInTo] = useState<string | undefined | null>(
+    undefined
+  );
+
   const form = useForm<optionsFormInput, unknown, optionsFormValues>({
     resolver: zodResolver(optionsFormSchema),
     defaultValues: {
@@ -53,7 +65,7 @@ const OptionsForm = () => {
     },
   });
 
-  const { mutate: onReset, isPending: resetLoading } = useMutation({
+  const { mutate: onSignOut, isPending: signOutLoading } = useMutation({
     mutationFn: async () => {
       const configured = await isConfigured();
 
@@ -67,7 +79,7 @@ const OptionsForm = () => {
       toast({
         title: "Error",
         description:
-          "Either you didn't configure the extension or there was an error while trying to log out. Please try again.",
+          "Either you didn't configure the extension or there was an error while trying to sign out. Please try again.",
         variant: "destructive",
       });
       return;
@@ -85,6 +97,8 @@ const OptionsForm = () => {
       });
       await clearConfig();
       await clearBookmarksMetadata();
+      setSignedInTo(null);
+      onCleared?.();
       return;
     },
   });
@@ -164,12 +178,15 @@ const OptionsForm = () => {
             : values.data.response.token,
       });
 
+      setSignedInTo(values.baseUrl);
+
       toast({
         title: "Saved",
-        description:
-          "Your settings have been saved, you can now close this tab.",
+        description: "Your settings have been saved.",
         variant: "default",
       });
+
+      onSaved?.();
     },
   });
 
@@ -179,19 +196,47 @@ const OptionsForm = () => {
       if (configured) {
         const cachedOptions = await getConfig();
         form.reset(cachedOptions);
+        setSignedInTo(cachedOptions.baseUrl);
+      } else {
+        setSignedInTo(null);
       }
     })();
   }, [form]);
 
   const { handleSubmit, control, watch } = form;
   const method = watch("method");
 
+  if (signedInTo === undefined) return null;
+
+  if (signedInTo) {
+    return (
+      <div className="px-2 space-y-4">
+        <p className="text-sm">
+          Signed in to{" "}
+          <span className="font-medium break-all">
+            {displayInstance(signedInTo)}
+          </span>
+        </p>
+        <Button
+          type="button"
+          variant="outline"
+          className="w-full"
+          onClick={() => onSignOut()}
+          disabled={signOutLoading}
+        >
+          Sign Out
+        </Button>
+        <Toaster />
+      </div>
+    );
+  }
+
   return (
     <div>
       <Form {...form}>
         <form
           onSubmit={handleSubmit((data) => onSubmit(data))}
-          className="space-y-3 p-2"
+          className="space-y-3 px-2"
         >
           <FormField
             control={control}
@@ -346,19 +391,7 @@ const OptionsForm = () => {
           />
           */}
 
-          <div className="flex justify-between">
-            <div>
-              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
-              {/*@ts-ignore*/}
-              <Button
-                type="button"
-                className="mb-2"
-                onClick={() => onReset()}
-                disabled={resetLoading}
-              >
-                Reset
-              </Button>
-            </div>
+          <div className="flex justify-end pb-2">
             <Button disabled={isPending} type="submit">
               Save
             </Button>
```

**File**: `apps/extension/src/@/lib/utils.ts` (modified, +0/-4)
```diff
@@ -58,10 +58,6 @@ export async function setStorageItem(key: string, value: string) {
   }
 }
 
-export function openOptions() {
-  getBrowser().runtime.openOptionsPage();
-}
-
 export function isSafari(): boolean {
   try {
     return /^safari-web-extension:/.test(getBrowser().runtime.getURL(''));
```

**File**: `apps/extension/src/pages/Popup/App.tsx` (modified, +54/-22)
```diff
@@ -1,28 +1,33 @@
-import Container from '../../@/components/Container.tsx';
-import WholeContainer from '../../@/components/WholeContainer.tsx';
-import BookmarkForm from '../../@/components/BookmarkForm.tsx';
-import { openOptions } from '../../@/lib/utils.ts';
-import { useEffect, useState } from 'react';
-import { getConfig, isConfigured } from '../../@/lib/config.ts';
-import NotConfigured from '../../@/components/NotConfigured.tsx';
-import { ModeToggle } from '../../@/components/ModeToggle.tsx';
-import { Button } from '@/@/components/ui/Button.tsx';
-import { Settings } from 'lucide-react';
+import Container from "../../@/components/Container.tsx";
+import WholeContainer from "../../@/components/WholeContainer.tsx";
+import BookmarkForm from "../../@/components/BookmarkForm.tsx";
+import OptionsForm from "../../@/components/OptionsForm.tsx";
+import { useCallback, useEffect, useState } from "react";
+import { getConfig, isConfigured } from "../../@/lib/config.ts";
+import NotConfigured from "../../@/components/NotConfigured.tsx";
+import { ModeToggle } from "../../@/components/ModeToggle.tsx";
+import { Button } from "@/@/components/ui/Button.tsx";
+import { Settings, X } from "lucide-react";
 
 function App() {
   const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
   const [baseUrl, setBaseUrl] = useState<string>();
+  const [showSettings, setShowSettings] = useState(false);
 
-  useEffect(() => {
-    (async () => {
-      const cachedOptions = await isConfigured();
-      const cachedConfig = await getConfig();
+  const refreshConfig = useCallback(async () => {
+    const cachedOptions = await isConfigured();
+    const cachedConfig = await getConfig();
+
+    setBaseUrl(cachedConfig.baseUrl);
+    setIsAllConfigured(cachedOptions);
 
-      setBaseUrl(cachedConfig.baseUrl);
-      setIsAllConfigured(cachedOptions);
-    })();
+    return cachedOptions;
   }, []);
 
+  useEffect(() => {
+    refreshConfig();
+  }, [refreshConfig]);
+
   return (
     <WholeContainer>
       <Container>
@@ -43,22 +48,49 @@ function App() {
                 alt="Linkwarden Logo"
               />
             </a>
-            <h1 className="text-lg">Add Link</h1>
+            <h1 className="text-lg">
+              {showSettings ? "Settings" : "Add Link"}
+            </h1>
           </div>
           <div className="flex items-center justify-center space-x-2">
             <ModeToggle />
             <Button
               variant="ghost"
               size="icon"
               className="ring-0 focus:ring-0 outline-none focus:outline-none ring-offset-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus-visible:ring-0 focus-visible:outline-none"
-              onClick={openOptions}
+              onClick={() => setShowSettings((prevState) => !prevState)}
             >
-              <Settings className="h-[1.2rem] w-[1.2rem] transition-colors" />
+              {showSettings ? (
+                <X className="h-[1.2rem] w-[1.2rem] transition-colors" />
+              ) : (
+                <Settings className="h-[1.2rem] w-[1.2rem] transition-colors" />
+              )}
+              <span className="sr-only">
+                {showSettings ? "Close settings" : "Open settings"}
+              </span>
             </Button>
           </div>
         </div>
-        <BookmarkForm />
-        <NotConfigured open={!isAllConfigured} />
+
+        {showSettings ? (
+          <div className="max-h-[500px] overflow-y-auto mt-1">
+            <OptionsForm
+              onSaved={async () => {
+                const configured = await refreshConfig();
+                if (configured) setShowSettings(false);
+              }}
+              onCleared={refreshConfig}
+            />
+          </div>
+        ) : (
+          <>
+            <BookmarkForm />
+            <NotConfigured
+              open={isAllConfigured === false}
+              onConfigure={() => setShowSettings(true)}
+            />
+          </>
+        )}
       </Container>
     </WholeContainer>
   );
```

---

### Incident Patch 12: `ea78af11` (2026-08-28)
**Commit Message**: bug fixed

**File**: `packages/filesystem/s3Client.ts` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ const s3Client: S3 | undefined =
         forcePathStyle: process.env.SPACES_FORCE_PATH_STYLE === "true",
         endpoint: process.env.SPACES_ENDPOINT,
         region: process.env.SPACES_REGION,
+        maxAttempts: 10,
         credentials: {
           accessKeyId: process.env.SPACES_KEY,
           secretAccessKey: process.env.SPACES_SECRET,
```

---

### Incident Patch 13: `de73777e` (2026-08-19)
**Commit Message**: minor fix

**File**: `apps/web/components/Preservation/PreservationContent.tsx` (modified, +1/-1)
```diff
@@ -228,7 +228,7 @@ export const PreservationContent: React.FC<Props> = ({ link, format }) => {
               <img
                 alt=""
                 ref={imgRef}
-                src={`/api/v1/archives/${link.id}?format=${currentFormat}`}
+                src={`/api/v1/archives/${link.id}?format=${currentFormat}&_=${link.updatedAt}`}
                 className={clsx("w-fit mx-auto", !imageLoaded && "hidden")}
                 onLoad={(e) => {
                   const img = e.currentTarget;
```

**File**: `packages/filesystem/createFile.ts` (modified, +12/-1)
```diff
@@ -1,4 +1,5 @@
 import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";
+import crypto from "crypto";
 import { promises as fs } from "fs";
 import path from "path";
 import s3Client from "./s3Client";
@@ -22,10 +23,20 @@ export async function createFile({
   }
 
   if (s3Client) {
+    const bytes = new Uint8Array(bufferData);
+
+    let contentMD5: string | undefined;
+    try {
+      contentMD5 = crypto.createHash("md5").update(bytes).digest("base64");
+    } catch (err) {
+      console.warn("Skipping Content-MD5, unable to hash:", err);
+    }
+
     const bucketParams: PutObjectCommandInput = {
       Bucket: process.env.SPACES_BUCKET_NAME!,
       Key: filePath,
-      Body: new Uint8Array(bufferData),
+      Body: bytes,
+      ContentMD5: contentMD5,
     };
 
     try {
```

---

### Incident Patch 14: `1ca6f2a3` (2026-08-19)
**Commit Message**: minor fix to apple oauth

**File**: `apps/web/lib/api/apple.ts` (modified, +16/-0)
```diff
@@ -96,6 +96,22 @@ export async function verifyAppleIdentityToken(
   };
 }
 
+export function parseAppleSignupName(body: any): string | undefined {
+  if (typeof body?.user !== "string") return undefined;
+
+  try {
+    const user = JSON.parse(body.user);
+    const name = [user?.name?.firstName, user?.name?.lastName]
+      .filter(Boolean)
+      .join(" ")
+      .trim();
+
+    return name || undefined;
+  } catch {
+    return undefined;
+  }
+}
+
 export function getAppleClientSecret() {
   const now = Math.floor(Date.now() / 1000);
 
```

**File**: `apps/web/pages/api/v1/auth/[...nextauth].ts` (modified, +20/-0)
```diff
@@ -3,6 +3,7 @@ import sendInvitationRequest from "@/lib/api/sendInvitationRequest";
 import sendVerificationRequest from "@/lib/api/sendVerificationRequest";
 import updateSeats from "@/lib/api/billing/updateSeats";
 import verifySubscription from "@/lib/api/billing/verifySubscription";
+import { parseAppleSignupName } from "@/lib/api/apple";
 import { authProviders, isAuthProviderEnabled } from "@/lib/api/authProviders";
 import { ssoEmailVerified } from "@/lib/api/ssoEmailVerified";
 import { PrismaAdapter } from "@auth/prisma-adapter";
@@ -191,6 +192,11 @@ for (const entry of authProviders) {
 }
 
 export default async function auth(req: NextApiRequest, res: NextApiResponse) {
+  const appleSignupName =
+    Array.isArray(req.query.nextauth) && req.query.nextauth.includes("apple")
+      ? parseAppleSignupName(req.body)
+      : undefined;
+
   return await NextAuth(req, res, {
     adapter: adapter as Adapter,
     session: {
@@ -364,6 +370,13 @@ export default async function auth(req: NextApiRequest, res: NextApiResponse) {
               },
             });
           }
+
+          if (userExists && !userExists.name && appleSignupName) {
+            await prisma.user.update({
+              where: { id: userExists.id },
+              data: { name: appleSignupName },
+            });
+          }
         } else if (trigger === "signIn") {
           const user = await prisma.user.findUnique({
             where: {
@@ -380,6 +393,13 @@ export default async function auth(req: NextApiRequest, res: NextApiResponse) {
               data: { username: autoGeneratedUsername },
             });
           }
+
+          if (user && !user.name && appleSignupName) {
+            await prisma.user.update({
+              where: { id: user.id },
+              data: { name: appleSignupName },
+            });
+          }
         }
 
         return token;
```

---

### Incident Patch 15: `538c3468` (2026-08-19)
**Commit Message**: minor fix

**File**: `packages/lib/schemaValidation.ts` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export const UpdateUserSchema = () => {
     process.env.EMAIL_FROM && process.env.EMAIL_SERVER ? true : false;
 
   return z.object({
-    name: z.string().trim().min(0).max(50).optional(),
+    name: z.string().trim().max(50).nullish(),
     email: emailEnabled
       ? z.string().trim().email().toLowerCase()
       : z.string().nullish(),
```

#### Recent Merged Pull Requests:
- **PR #1839** (closed): Significant changes to improve Browser Extension (@nicolaipre)
- **PR #1836** (closed): Feat/editable publication date (@bvdbos)
- **PR #1834** (2026-09-10): Dev (@daniel31x13)
- **PR #1833** (2026-09-09): v2.16.3 (@daniel31x13)
- **PR #1831** (closed): [Browser Extension] Add account-backed default collection setting (@MichaelvanLaar)
- **PR #1828** (2026-09-08): Dev (@daniel31x13)
- **PR #1825** (2026-08-31): Dev (@daniel31x13)
- **PR #1822** (closed): fix(web): prefer Open Graph article titles (@mikemikimike)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
