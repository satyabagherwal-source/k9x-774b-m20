# Forensic Learning Record (Deep Inspection): linkwarden/linkwarden

> **Canonical Artifact**: `07_PROJECT_LEARNING/linkwarden-linkwarden-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/linkwarden/linkwarden](https://github.com/linkwarden/linkwarden))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:42:16.117Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `linkwarden/linkwarden`
- **Description**: ⚡️⚡️⚡️ Self-hosted collaborative bookmark manager to collect, read, annotate, and fully preserve what matters, all in one place.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 19883 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/extension/manifest.config.ts`
```
/**
 * Single source of truth for the extension manifest.
 *
 * Every browser gets the same manifest apart from the handful of keys collected
 * in `targets` below. The vite plugin in vite.config.ts writes the result into
 * the build output, so there is no manifest.json checked into the repo. The same
 * plugin writes `version` out to version.xcconfig for the Safari Xcode project,
 * which cannot read this file itself.
 */

/**
 * `default` is the Chrome and Firefox build (`dist/`), which the two browsers
 * share, so it carries the keys for both. `safari` is `dist-safari/`.
 */
export type ManifestTarget = "default" | "safari";

type TargetOptions = {
  /** `minimum_chrome_version`, left off where it means nothing. */
  minimumChromeVersion?: string;
  /** Safari web extensions have no bookmarks API. */
  bookmarks: boolean;
  /** Chrome runs the background as a service worker; the others use `scripts`. */
  serviceWorker: boolean;
  /** Address bar keyword, which Safari does not support. */
  omnibox: boolean;
  browserSpecificSettings: Record<string, unknown>;
};

const targets: Record<ManifestTarget, TargetOptions> = {
  default: {
    minimumChromeVersion: "121",
    bookmarks: true,
    serviceWorker: true,
    omnibox: true,
    browserSpecificSettings: {
      gecko: {
        id: "jordanlinkwarden@gmail.com",
        strict_min_version: "121.0",
      },
    },
  },
  safari: {
    bookmarks: false,
    serviceWorker: false,
    omnibox: false,
    browserSpecificSettings: {
      safari: {
        strict_min_version: "15.4",
      },
    },
  },
};

/**
 * The version for every target, including Safari: the vite plugin mirrors this
 * into `version.xcconfig`, which the Xcode project reads as its base
 * configuration. Bump it here and nowhere else.
 */
export const version = "1.5.6";

const icons = {
  "16": "16.png",
  "32": "32.png",
  "48": "48.png",
  "128": "128.png",
};

export function buildManifest(target: ManifestTarget) {
  const options = targets[target];

  return {
    manifest_version: 3,
    ...(options.minimumChromeVersion
      ? { minimum_chrome_version: options.minimumChromeVersion }
      : {}),
    name: "Linkwarden",
    description:
      "Save webpages, capture screenshots, and organize links in your Linkwarden collections.",
    homepage_url: "https://linkwarden.app/",
    version,
    action: {
      default_popup: "index.html",
      default_icon: icons,
      default_title: "Linkwarden",
    },
    options_ui: {
      page: "src/pages/Options/options.html",
      browser_style: false,
    },
    icons,
    permissions: [
      "storage",
      "scripting",
      "activeTab",
      "tabs",
      ...(options.bookmarks ? ["bookmarks"] : []),
      "contextMenus",
    ],
    host_permissions: ["<all_urls>"],
    background: {
      ...(options.serviceWorker ? { service_worker: "background.js" } : {}),
      scripts: ["background.js"],
      type: "module",
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' http: https:;",
    },
    ...(options.omnibox ? { omnibox: { keyword: "lk" } } : {}),
    commands: {
      _execute_action: {
        suggested_key: { default: "Ctrl+Shift+F", mac: "Command+Shift+Y" },
      },
    },
    browser_specific_settings: options.browserSpecificSettings,
  };
}

export function resolveTarget(value = process.env.EXT_TARGET): ManifestTarget {
  if (value === undefined || value === "default") return "default";
  if (value === "safari") return "safari";
  throw new Error(
    `Unknown EXT_TARGET "${value}". Expected "default" or "safari".`
  );
}

```

### Core Architecture Module: `apps/extension/safari/Linkwarden/Linkwarden/Resources/Script.js`
```
function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "Linkwarden for Safari is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-off')[0].innerText = "Linkwarden for Safari is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-unknown')[0].innerText = "You can turn on Linkwarden for Safari in the Extensions section of Safari Settings.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Open Safari Settings";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function showPreferencesError() {
    document.querySelector(".state-error").hidden = false;
}

function openPreferences() {
    document.querySelector(".state-error").hidden = true;
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);

```

### Core Architecture Module: `apps/extension/scripts/safari-next-steps.mjs`
```
const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const cyan = (text) => (colour ? `\x1b[36m${text}\x1b[0m` : text);

console.log(
  "Now run `open safari/Linkwarden/Linkwarden.xcodeproj` and then Cmd+R in Xcode."
);
console.log(
  cyan(
    "For submission, run `yarn bump:build` first, then in Xcode: Product → Archive, then Organizer → Distribute App → App Store Connect → Upload."
  )
);

```

### Core Architecture Module: `apps/extension/src/@/components/BookmarkForm.tsx`
```
import { useForm } from "react-hook-form";
import {
  bookmarkFormSchema,
  bookmarkFormValues,
} from "../lib/validators/bookmarkForm.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/Form.tsx";
import { Input } from "./ui/Input.tsx";
import { Button } from "./ui/Button.tsx";
import TagInput from "./TagInput.tsx";
import CollectionInput from "./CollectionInput.tsx";
import { Textarea } from "./ui/Textarea.tsx";
import {
  getCurrentTabInfo,
  getStorageItem,
  setStorageItem,
  updateBadge,
} from "../lib/utils.ts";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { getConfig, isConfigured as getIsConfigured } from "../lib/config.ts";
import { checkLinkExists, postLink } from "../lib/actions/links.ts";
import { AxiosError } from "axios";
import { toast } from "../../hooks/useToast.ts";
import { Toaster } from "./ui/Toaster.tsx";
import { getCollections } from "../lib/actions/collections.ts";
import { getShouldUseTagSearch, getTags } from "../lib/actions/tags.ts";
import { ExternalLink } from "lucide-react";
import { Checkbox } from "./ui/CheckBox.tsx";
import { Label } from "./ui/Label.tsx";

// The popup is torn down every time it loses focus, so remember whether the
// user had the extra options expanded and bring them back that way.
const MORE_OPTIONS_KEY = "lw_more_options_open";

const BookmarkForm = () => {
  const [openOptions, setOpenOptions] = useState<boolean>(false);
  const [openCollections, setOpenCollections] = useState<boolean>(false);
  const [uploadImage, setUploadImage] = useState<boolean>(false);
  const [state, setState] = useState<"capturing" | "uploading" | null>(null);
  const [tagSearch, setTagSearch] = useState<string>("");

  const [isConfigured, setIsConfigured] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const [config, setConfig] = useState<{
    baseUrl: string;
    defaultCollection: string;
    apiKey: string;
    syncBookmarks: boolean;
  }>();
  const [tabInfo, setTabInfo] = useState<{
    id: number | undefined;
    title: string | undefined;
    url: string | undefined;
  }>();

  const handleCheckedChange = (s: boolean | "indeterminate") => {
    if (s === "indeterminate") return;
    setUploadImage(s);
    form.setValue("image", s ? "png" : undefined);
  };

  const handleOptionsToggle = () => {
    const next = !openOptions;
    setOpenOptions(next);
    void setStorageItem(MORE_OPTIONS_KEY, next ? "true" : "false");
  };

  const form = useForm<bookmarkFormValues>({
    resolver: zodResolver(bookmarkFormSchema),
    defaultValues: {
      url: "",
      name: "",
      collection: {
        name: "Unorganized",
      },
      tags: [],
      description: "",
      image: undefined,
    },
  });

  const { mutate: onSubmit, isPending } = useMutation({
    mutationFn: async (values: bookmarkFormValues) => {
      await postLink(
        config?.baseUrl as string,
        uploadImage,
        values,
        setState,
        config?.apiKey as string
      );

      return;
    },
    onError: (error) => {
      console.error(error);
      if (error instanceof AxiosError) {
        toast({
          title: "Error",
          description:
            error.response?.data.response ||
            "There was an error while trying to save the link. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description:
            "There was an error while trying to save the link. Please try again.",
          variant: "destructive",
        });
      }
      return;
    },
    onSuccess: () => {
      // Update badge to show link is saved
      updateBadge(tabInfo?.id, true);
      setTimeout(() => {
        window.close();
        // I want to show some confirmation before it's closed...
      }, 3500);
      toast({
        title: "Success",
        description: "Link saved successfully!",
        variant: "success",
      });
    },
  });

  useEffect(() => {
    const setTabInformation = async () => {
      setOpenOptions((await getStorageItem(MORE_OPTIONS_KEY)) === "true");

      const t = await getCurrentTabInfo();
      const c = await getConfig();

      setTabInfo(t);
      setConfig(c);

      form.setValue("url", t.url ? t.url : "");
      form.setValue("name", t.title ? t.title : "");
      form.setValue("collection", {
        name: c.defaultCollection,
      });

      const configured = await getIsConfigured();
      setIsConfigured(configured);

      if (!configured) return;

      const duplicate = await checkLinkExists(c.baseUrl, c.apiKey, t.url);
      setIsDuplicate(duplicate);
      updateBadge(t.id, duplicate);
    };

    setTabInformation();
  }, []);

  const { handleSubmit, control } = form;

  // useEffect(() => {
  //   const syncBookmarks = async () => {
  //     try {
  //       const { syncBookmarks, baseUrl, defaultCollection } = await getConfig();
  //       form.setValue('collection', {
  //         name: defaultCollection,
  //       });
  //       if (!syncBookmarks) {
  //         return;
  //       }
  //       if (await isConfigured()) {
  //         await saveLinksInCache(baseUrl);
  //         await syncLocalBookmarks(baseUrl);
  //       }
  //     } catch (error) {
  //       console.error(error);
  //     }
  //   };
  //   syncBookmarks();
  // }, [form]);

  const {
    isLoading: loadingCollections,
    data: collections,
    error: collectionError,
  } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const response = await getCollections(
        config?.baseUrl as string,
        config?.apiKey as string
      );

      return response.data.response.sort((a, b) => {
        return a.pathname.localeCompare(b.pathname);
      });
    },
    enabled: isConfigured,
  });

  const { data: shouldUseTagSearch = false } = useQuery({
    queryKey: ["tag-search-support", config?.baseUrl, config?.apiKey],
    queryFn: async () =>
      await getShouldUseTagSearch(
        config?.baseUrl as string,
        config?.apiKey as string
      ),
    enabled: isConfigured && openOptions,
  });
  const effectiveTagSearch = shouldUseTagSearch ? tagSearch : "";
  const {
    isLoading: loadingTags,
    data: tagsData,
    error: tagsError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["tags", config?.baseUrl, config?.apiKey, effectiveTagSearch],
    queryFn: async ({ pageParam }) => {
      return await getTags(
        config?.baseUrl as string,
        config?.apiKey as string,
        pageParam,
        effectiveTagSearch
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isConfigured && openOptions,
  });

  const tags = useMemo(() => {
    return (
      tagsData?.pages
        .flatMap((page) => page.tags)
        .sort((a, b) => a.name.localeCompare(b.name)) ?? []
    );
  }, [tagsData]);

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={handleSubmit((e) => onSubmit(e))}
          className="py-1 space-y-5"
        >
          {collectionError ? (
            <p className="text-red-600">
              There was an error, please make sure the website is available.
            </p>
          ) : null}
          <FormField
            control={control}
            name="collection"
            render={({ field }) => (
              <FormItem className={`my-2`}>
                <FormLabel>Collection</FormLabel>
                <CollectionInput
                  value={field.value}
                  onChange={field.onChange}
                  collections={collections}
                  isLoading={loadingCollections}
                  open={openCollections}
                  onOpenChange={setOpenColle
```

### Core Architecture Module: `apps/extension/src/@/components/CollectionInput.tsx`
```
import { useMemo, useState } from "react";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { Search, X } from "lucide-react";
import { Button } from "./ui/Button.tsx";
import { FormControl } from "./ui/Form.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover.tsx";
import { Collection } from "../lib/actions/collections.ts";
import { useListboxKeys } from "../../hooks/useListboxKeys.ts";

type Props = {
  value?: { id?: number; ownerId?: number; name: string };
  onChange: (collection: {
    id?: number;
    ownerId?: number;
    name: string;
  }) => void;
  collections: Collection[] | undefined;
  isLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullScreen: boolean;
};

export default function CollectionInput({
  value,
  onChange,
  collections,
  isLoading,
  open,
  onOpenChange,
  fullScreen,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredCollections = useMemo(() => {
    if (!Array.isArray(collections)) return [];

    const query = search.trim().toLowerCase();
    if (!query) return collections;

    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(query)
    );
  }, [search, collections]);

  const handleSelect = (collection: Collection) => {
    onChange({
      id: collection.id,
      ownerId: collection.ownerId,
      name: collection.name,
    });

    onOpenChange(false);
  };

  const { activeIndex, listId, optionId, handleKeyDown } = useListboxKeys({
    options: filteredCollections,
    onEnter: (collection) => collection && handleSelect(collection),
    onClose: () => onOpenChange(false),
  });

  const list = (
    <div
      onKeyDown={handleKeyDown}
      className={`flex h-full w-full flex-col bg-popover text-popover-foreground ${
        fullScreen ? "rounded-none" : "rounded-md"
      }`}
    >
      <div className="flex items-center border-b px-3">
        <Search aria-hidden className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          autoFocus={fullScreen}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex === null ? undefined : optionId(activeIndex)
          }
          className="flex h-11 w-full min-w-[280px] bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search Collection..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="w-full text-center my-auto">Loading...</p>
      ) : filteredCollections.length === 0 ? (
        <p className="py-6 text-center text-sm">No Collection found.</p>
      ) : (
        <div
          id={listId}
          role="listbox"
          className="w-full overflow-y-auto p-1 text-foreground"
        >
          {filteredCollections.map((collection, index) => (
            <div
              key={collection.id}
              id={optionId(index)}
              role="option"
              aria-selected={collection.name === value?.name}
              onClick={() => handleSelect(collection)}
              className={`relative flex cursor-pointer select-none flex-col items-start justify-start rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${
                index === activeIndex ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <p>{collection.name}</p>
              <p className="text-xs text-neutral-500">{collection.pathname}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-w-full">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              aria-haspopup={fullScreen ? "dialog" : "listbox"}
              aria-expanded={open}
              className="w-full justify-between bg-neutral-100 dark:bg-neutral-900"
            >
              {isLoading
                ? "Unorganized"
                : value?.name || "Select a collection..."}
              <CaretSortIcon
                aria-hidden
                className="ml-2 h-4 w-4 shrink-0 opacity-50"
              />
            </Button>
          </FormControl>
        </PopoverTrigger>

        {open &&
          (fullScreen ? (
            <div
              role="dialog"
              aria-modal
              aria-label="Select a collection"
              className="fade-up fixed inset-0 z-50 h-full w-full bg-white"
            >
              <Button
                type="button"
                aria-label="Close"
                className="absolute top-1 right-1 bg-transparent hover:bg-transparent hover:opacity-50 transition-colors ease-in-out duration-200"
                onClick={() => onOpenChange(false)}
              >
                <X aria-hidden className="h-4 w-4 text-black dark:text-white" />
              </Button>
              {list}
            </div>
          ) : (
            <PopoverContent className="min-w-full p-0 h-[250px]">
              {list}
            </PopoverContent>
          ))}
      </Popover>
    </div>
  );
}

```

### Core Architecture Module: `apps/extension/src/@/components/Container.tsx`
```
import { FC } from 'react';

interface ContainerProps {
  children: React.ReactNode;
}

const Container: FC<ContainerProps> = ({ children }) => {
  return <div className="flex flex-col w-[386px] h-full px-6 py-3 overflow-y-hidden">{children}</div>;
};

export default Container;

```

### Core Architecture Module: `apps/extension/src/@/components/ModeToggle.tsx`
```
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider.tsx';
import { Button } from './ui/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/DropDownMenu.tsx';

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ring-0 focus:ring-0 outline-none focus:outline-none ring-offset-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus-visible:ring-0 focus-visible:outline-none"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

```

### Core Architecture Module: `apps/extension/src/@/components/NotConfigured.tsx`
```
import { FC } from 'react';
import { Button } from './ui/Button.tsx';

const NotConfigured: FC<{ open: boolean; onConfigure: () => void }> = ({
  open,
  onConfigure,
}) => {
  if (!open) return null;

  return (
    <div className="fixed top-0 bottom-0 left-0 right-0 inset-0 bg-background z-10">
      <div className="container flex flex-col gap-3 justify-center items-center h-full max-w-lg mx-auto">
        <img
          src="./128.png"
          height="40px"
          width="40px"
          className="rounded"
          alt="Linkwarden Logo"
        />
        <h1 className="font-medium text-lg" style={{ fontSize: '1.65rem' }}>
          Initial Setup
        </h1>

        <div className="flex justify-center items-center">
          <Button onClick={onConfigure} className="w-40" variant="outline">
            Configure
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotConfigured;

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

- **Issue #1695** (2026-07-30): **Inconsistency with jpg and jpeg file extensions**
  *Symptoms*: **Describe the bug** Files are created as *.jpeg but deletion is *.jpg  **To Reproduce** Steps to reproduce the behavior: 1. Add a link 2. See error in application logs  **Expected behavior** No errors.  **Screenshots** <img width="641" height="225" alt="Image" src="https://github.com/user-attachments/assets/6d6f8639-ea03-437f-a90a-e04d3d165b81" />  <img width="2367" height="120" alt="Image" src="https://github.com/user-attachments/assets/dc0e1a5f-5ef3-4156-b21e-d30cbbd113bd" />  **Desktop (please complete the following information):**  - Version: Linkwarden v2.14.1

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
 
-// Listen for URL changes (navigation, page lo
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
-  
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
-const SelectSeparator = React.for
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

### Incident Patch 8: `fb9d6d67` (2026-09-02)
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

### Incident Patch 9: `e3e68ff9` (2026-09-01)
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

### Incident Patch 10: `ea78af11` (2026-08-28)
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
