# Forensic Learning Record (Deep Inspection): gluestack/gluestack-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/gluestack-gluestack-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gluestack/gluestack-ui](https://github.com/gluestack/gluestack-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:23.726Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gluestack/gluestack-ui`
- **Description**: React & React Native Components & Patterns (copy-paste components & patterns crafted with Tailwind CSS (NativeWind))
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5320 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/website/components/custom/utils/helperFunction.ts`
```
export function convertSidebarItemsToPathsArray(sidebarItems: any): any {
  const pages: any[] = [];

  if (
    !sidebarItems ||
    !sidebarItems.navigation ||
    !sidebarItems.navigation.sections
  ) {
    return pages;
  }

  const sections = sidebarItems.navigation.sections;

  function extractPagesFromSection(section: any) {
    if (section.subsections) {
      for (const subsection of section.subsections) {
        // Handle direct path items in subsections
        if (subsection.path) {
          const pageObj: any = {};
          pageObj[subsection.title] = subsection.path;
          pages.push(pageObj);
        }

        // Handle items within subsections
        if (subsection.items) {
          for (const item of subsection.items) {
            if (item.path) {
              const pageObj: any = {};
              pageObj[item.title] = item.path;
              pages.push(pageObj);
            }
          }
        }
      }
    }
  }

  for (const section of sections) {
    extractPagesFromSection(section);
  }

  return pages;
}

export function getPrevAndNextLinks(pages: any, currentRoute: any) {
  const currentIndex = pages.findIndex(
    (page: any) => Object.values(page)[0] === currentRoute
  );

  if (currentIndex === -1) {
    return {
      prev: null,
      prevLink: null,
      next: null,
      nextLink: null,
    };
  }

  const prevIndex = currentIndex - 1;
  const nextIndex = currentIndex + 1;

  const prevLink = prevIndex >= 0 ? Object.values(pages[prevIndex])[0] : null;
  const prevText = prevIndex >= 0 ? Object.keys(pages[prevIndex])[0] : null;
  const nextLink =
    nextIndex < pages.length ? Object.values(pages[nextIndex])[0] : null;
  const nextText =
    nextIndex < pages.length ? Object.keys(pages[nextIndex])[0] : null;

  return {
    prev: prevText,
    prevLink: prevLink,
    next: nextText,
    nextLink: nextLink,
  };
}

export function getGithubLink(sidebarItems: any, pathName: any) {
  if (
    !sidebarItems ||
    !sidebarItems.navigation ||
    !sidebarItems.navigation.sections
  ) {
    return null;
  }

  const sections = sidebarItems.navigation.sections;

  function searchInSection(section: any): any {
    if (section.subsections) {
      for (const subsection of section.subsections) {
        // Check direct path items in subsections
        if (subsection.path === pathName && subsection.githubPath) {
          return subsection.githubPath;
        }

        // Check items within subsections
        if (subsection.items) {
          for (const item of subsection.items) {
            if (item.path === pathName && item.githubPath) {
              return item.githubPath;
            }
          }
        }
      }
    }
    return null;
  }

  // First try to find an explicit githubPath
  for (const section of sections) {
    const githubLink = searchInSection(section);
    if (githubLink) {
      return githubLink;
    }
  }

  // If no explicit githubPath found, generate one based on the current path
  if (pathName && pathName.startsWith('/ui/docs/')) {
    // Convert path like '/ui/docs/components/button' to GitHub file path
    // Remove '/ui/docs/' prefix and add appropriate file extensions
    const relativePath = pathName.replace('/ui/docs/', '');

    // Map different sections to their corresponding file paths
    if (relativePath.startsWith('components/')) {
      const componentName = relativePath.replace('components/', '');
      return `https://github.com/gluestack/gluestack-ui/tree/${process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main'}/src/components/ui/${componentName}/docs/index.mdx`;
    } else if (relativePath.startsWith('home/')) {
      const pagePath = relativePath.replace('home/', '');
      return `https://github.com/gluestack/gluestack-ui/tree/${process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main'}/src/docs/${pagePath}/index.mdx`;
    } else if (relativePath.startsWith('apps/')) {
      const appPath = relativePath.replace('apps/', '');
      return `https://github.com/gluestack/gluestack-ui/tree/${process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main'}/src/docs/apps/${appPath}/index.mdx`;
    } else {
      // For other paths, try a generic approach
      return `https://github.com/gluestack/gluestack-ui/tree/${process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main'}/src/docs/${relativePath}/index.mdx`;
    }
  }

  return null;
}

export function showToc(sidebarItems: any, pathName: any) {
  const page = findPageByPath(pathName, sidebarItems);
  if (page?.metaData?.toc === false) {
    return false;
  } else {
    return true;
  }
}

export function findPageByPath(pathName: any, sidebarItems: any) {
  if (
    !sidebarItems ||
    !sidebarItems.navigation ||
    !sidebarItems.navigation.sections
  ) {
    return null;
  }

  const sections = sidebarItems.navigation.sections;

  function searchInSection(section: any): any {
    if (section.subsections) {
      for (const subsection of section.subsections) {
        // Check direct path items in subsections
        if (subsection.path === pathName) {
          return subsection;
        }

        // Check items within subsections
        if (subsection.items) {
          for (const item of subsection.items) {
            if (item.path === pathName) {
              return item;
            }
          }
        }
      }
    }
    return null;
  }

  for (const section of sections) {
    const result = searchInSection(section);
    if (result) {
      return result;
    }
  }

  return null;
}

// Legacy function name for backward compatibility
export function findPageById(id: any, pages: any) {
  return findPageByPath(id, pages);
}

```

### Core Architecture Module: `apps/website/hooks/useSearch.ts`
```
'use client';

import { create, insert, search, type AnyOrama } from '@orama/orama';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchDocument } from '@/types/search';

export interface SearchHit {
  id: string;
  score: number;
  document: SearchDocument;
}

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  hits: SearchHit[];
  isLoading: boolean;
  isReady: boolean;
}

// Module-level cache — only one Orama instance for the whole session
let dbCache: AnyOrama | null = null;
let loadPromise: Promise<AnyOrama> | null = null;

async function getDb(): Promise<AnyOrama> {
  if (dbCache) return dbCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch('/search-index.json');
    if (!res.ok) throw new Error(`Failed to load search index: ${res.status}`);
    const documents: SearchDocument[] = await res.json();

    const db = await create({
      schema: {
        id: 'string',
        title: 'string',
        description: 'string',
        content: 'string',
        path: 'string',
        section: 'string',
        subsection: 'string',
      } as const,
    });

    for (const doc of documents) {
      await insert(db, doc);
    }

    dbCache = db;
    return db;
  })();

  return loadPromise;
}

export function useSearch(): UseSearchReturn {
  const [query, setQueryState] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-warm the index the first time the hook mounts
  useEffect(() => {
    getDb()
      .then(() => setIsReady(true))
      .catch(() => setIsReady(false));
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setHits([]);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const db = await getDb();
        setIsReady(true);

        const results = await search(db, {
          term: q,
          properties: ['title', 'description', 'content'],
          boost: { title: 3, description: 1.5, content: 1 },
          limit: 12,
          tolerance: 1,
        });

        setHits(
          results.hits.map((hit) => ({
            id: hit.id as string,
            score: hit.score,
            document: hit.document as unknown as SearchDocument,
          }))
        );
      } catch {
        setHits([]);
      } finally {
        setIsLoading(false);
      }
    }, 150);
  }, []);

  return { query, setQuery, hits, isLoading, isReady };
}

```

### Core Architecture Module: `apps/website/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


```

### Core Architecture Module: `apps/website/utils/context/local-theme-context.tsx`
```
import React, { createContext, useContext, useState, useMemo } from 'react';

type ThemeMode =
  | 'orange'
  | 'blue'
  | 'green'
  | 'violet'
  | 'cyan'
  | 'rose'
  | 'bluegray'
  | 'default';

type LocalThemeContextType = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const LocalThemeContext = createContext<LocalThemeContextType | undefined>(
  undefined
);

// Define a type for our CSS variables
type ThemeVars = Partial<Record<`--primary`, string>>;

const themeVars: Record<ThemeMode, ThemeVars> = {
  default: {}, // Default mode doesn't override primary color
  orange: {
    '--primary': '249 115 22', // #F97316
  },
  blue: {
    '--primary': '14 165 233', // #0EA5E9
  },
  green: {
    '--primary': '16 185 129', // #10B981
  },
  violet: {
    '--primary': '139 92 246', // #8B5CF6
  },
  cyan: {
    '--primary': '6 182 212', // #06B6D4
  },
  rose: {
    '--primary': '244 63 94', // #F43F5E
  },
  bluegray: {
    '--primary': '100 116 139', // #64748B
  },
};

export const LocalThemeProvider: React.FC<{
  initialTheme?: ThemeMode;
  children: React.ReactNode;
}> = ({ initialTheme = 'default', children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);

  const style = useMemo(() => {
    const vars = themeVars[themeMode];
    return Object.fromEntries(
      Object.entries(vars).map(([k, v]) => [k, v])
    ) as React.CSSProperties;
  }, [themeMode]);

  return (
    <LocalThemeContext.Provider value={{ themeMode, setThemeMode }}>
      <div style={style}>{children}</div>
    </LocalThemeContext.Provider>
  );
};

export const useLocalTheme = () => {
  const ctx = useContext(LocalThemeContext);
  if (!ctx)
    throw new Error('useLocalTheme must be used within a LocalThemeProvider');
  return ctx;
};

```

### Core Architecture Module: `apps/website/utils/context/theme-context/index.tsx`
```
'use client';
import { createContext, useState, useEffect } from 'react';

type ThemeContextType = {
  colorMode: 'light' | 'dark' | 'system';
  setColorMode: (mode: 'light' | 'dark' | 'system') => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colorMode: 'dark',
  setColorMode: () => {},
});

// Cookie helper functions
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [colorMode, setColorMode] = useState<'light' | 'dark' | 'system'>(
    'dark'
  );

  const [mounted, setMounted] = useState(false);

  // Load theme from cookies after mount
  useEffect(() => {
    const savedColorMode = getCookie('colorMode') as
      | 'light'
      | 'dark'
      | 'system';

    if (savedColorMode) {
      setColorMode(savedColorMode);
    }

    setMounted(true);
  }, []);

  const handleColorModeChange = (mode: 'light' | 'dark' | 'system') => {
    setColorMode(mode);
    if (mounted) {
      setCookie('colorMode', mode);
    }
  };

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        colorMode,
        setColorMode: handleColorModeChange,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export { ThemeContext, ThemeProvider };

```

### Core Architecture Module: `packages/create-gluestack/src/utils.ts`
```
import templatesMap from './data.js';
import { existsSync, rmSync, renameSync, readdirSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

const { gitRepo, branch } = templatesMap;

// Helper function to prompt user for input
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function cloneProject(projectName: string, templateName: string) {
  const dirPath = path.join(process.cwd(), projectName);
  if (existsSync(dirPath)) {
    console.log(`Folder already exists with name: ${projectName}`);
    
    const userChoice = await promptUser(
      'Do you want to override the existing folder? (yes/no | y/n): '
    );
    
    if (userChoice === 'yes' || userChoice === 'y') {
      console.log('Overriding the existing folder...\n');
      // Delete directory recursively
      rmSync(projectName, { recursive: true, force: true });
    } else {
      console.log('Operation cancelled. Please choose a different project name.');
      process.exit(0);
    }
  }

  try {
    // Single command shallow clone with sparse checkout - much faster!
    execSync(
      `git clone --depth=1 --filter=blob:none --sparse ${gitRepo} ${projectName} --branch ${branch}`
    );

    // Initialize sparse checkout with no cone mode and explicit patterns
    execSync(`git sparse-checkout init --no-cone`, { cwd: dirPath });
    execSync(`git sparse-checkout set "apps/${templateName}/*"`, {
      cwd: dirPath,
    });

    // Move files
    moveAllFiles(dirPath, templateName);

    // Clean up .git directory (apps/ was already removed inside moveAllFiles)
    try {
      rmSync(path.join(dirPath, '.git'), { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn(
        'Warning: Some cleanup operations failed, but project should still be usable'
      );
    }
  } catch (error: any) {
    console.error(
      'Failed to clone project. Ensure git is installed and try again.'
    );
    console.error(error?.message || error);
    process.exit(1);
  }
}

async function installDependencies(
  projectName: string,
  selectedPackageManager: string
) {
  console.log('Installing dependencies...');
  // npm's strict pre-release peer dep resolution breaks alpha packages where
  // e.g. 5.0.1-alpha.0 doesn't satisfy ">=5.0.0-alpha.0" (different patch).
  // --legacy-peer-deps restores the npm v6 behavior that ignores this.
  const installCmd =
    selectedPackageManager === 'npm'
      ? 'npm install --legacy-peer-deps'
      : `${selectedPackageManager} install`;
  execSync(installCmd, {
    cwd: path.join(process.cwd(), projectName),
  });
  console.log('Dependencies installed!');
}

async function gitInit(projectName: string) {
  const dirPath = path.join(process.cwd(), projectName);
  execSync('git init', { cwd: dirPath });
  execSync('git branch -M main', { cwd: dirPath });
  execSync(`git add --all`, { cwd: dirPath });
  execSync(`git commit -m "Init"`, { cwd: dirPath });
}

function moveAllFiles(dirPath: string, templateName: string) {
  const sourcePath = path.join(dirPath, 'apps', templateName);
  const tempPath = path.join(dirPath, '__gluestack_temp__');

  // Move template to a temp location to avoid conflicts with the existing
  // 'apps/' directory (e.g. monorepo templates that contain their own 'apps/' subdir)
  renameSync(sourcePath, tempPath);

  // Remove the now-empty apps directory so items can be moved to the root
  rmSync(path.join(dirPath, 'apps'), { recursive: true, force: true });

  // Read all files/directories in the temp directory
  const items = readdirSync(tempPath);

  // Move each item to the project root
  items.forEach((item) => {
    const sourceItem = path.join(tempPath, item);
    const destItem = path.join(dirPath, item);
    renameSync(sourceItem, destItem);
  });

  // Remove temp directory
  rmSync(tempPath, { recursive: true, force: true });
}

export { cloneProject, installDependencies, gitInit };

```

### Core Architecture Module: `packages/gluestack-core/accordion/aria.ts`
```
export * from '../lib/esm/accordion/aria';
```

### Core Architecture Module: `packages/gluestack-core/accordion/creator.ts`
```
export * from '../lib/esm/accordion/creator';
```

### Core Architecture Module: `packages/gluestack-core/actionsheet/creator.ts`
```
export * from '../lib/esm/actionsheet/creator';
```

### Core Architecture Module: `packages/gluestack-core/alert-dialog/creator.ts`
```
export * from '../lib/esm/alert-dialog/creator';
```

### Core Architecture Module: `packages/gluestack-core/alert/creator.ts`
```
export * from '../lib/esm/alert/creator';
```

### Core Architecture Module: `packages/gluestack-core/avatar/creator.ts`
```
export * from '../lib/esm/avatar/creator';
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3239** (2026-03-20): **Styles are not loading after upgrading from v2 to v3**
  *Symptoms*: I just upgraded a react native project from expo sdk 53 to sdk 54 and then from gluestack v2 to v3 as followed in the official steps:  https://gluestack.io/ui/docs/home/getting-started/installation https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/  Problem is that all gluestack elements are not styling as expected. A single <Button> element is not rendering as it should be.]  With expo 53 and gluestack v2 worked smoothly, but I had to upgrade in order to render the project in physical mobile devides through expo go.  Login.js:  return (     <Box height={150} className="bg-primary-0">       {/* <Animated.View style={{          flex: 1,         transform: [{ translateY: slideAnim }],         opacity: fadeAnim,       }}> */}          {/* <Box alignItems="center" justifyContent="center" paddingTop={80} >           <Image             source={require("./../../assets/images/logo-oro-miel.png")}             alt="OroyMiel Logo"             size="xl"             borderRadius={17}           />         </Box> */}          <Heading size="lg" style={styles.titleHeader}>           Accede a tu cuenta         </Heading>          <Box style={styles.textInput}>           <Text bold className="text-primary-0">             Email           </Text>           <Input className="text-center border border-primary-0" variant="rounded" backgroundColor="white">             <InputField               className="text-primary-0"               type="text"               placeholder="abc@gmail.com" 
  **Post-Mortem & Fix Analysis**:
  > This applies to create-react-native apps too. 
  > @vish404 @brokenerk  , The issue could very likely be related to `react-native-css-interop` or `nativewind` conflicting dependency after the upgrade. We’re looking into it, thanks for pointing that out and for reporting the issue!
  > Hi @vish404 @brokenerk , Could you please check your root layout (or the equivalent entry file) and ensure that the `global.css` (or `globals.css`) file is imported there?

- **Issue #3152** (2025-09-04): **Pin input component documentation is incomplete**
  *Symptoms*: ### Description  I would like to implement an otp field in my app but the documentation seems incomplete. The doc mentions a `numberOfFields` prop that doesn't exist in the component code, and I can't find the doc for it in gluestack v3.  ### CodeSandbox/Snack link  https://gluestack.io/ui/docs/components/pin-input  ### Steps to reproduce  1. Go to https://gluestack.io/ui/docs/components/pin-input 2. Scroll down to PinInput with caption 3. See error TypeError: Cannot read properties of null (reading 'useState')    ### gluestack-ui Version  0.0.14  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @raphaelbadia,  Thanks for trying out the component and sharing the details. The PinInput is currently an unreleased component and still a work in progress (WIP), which is why some props and docs may not match the actual implementation yet.  We’ll update the documentation and release it properly once it’s ready for production use.  Appreciate your patience! 🙏  Best, Sanchit
  > Oh alright ! I didn't know it was not yet released :D THanks !

- **Issue #3139** (2025-08-25): **react dom issue which is imported by @react-aria/utils**
  *Symptoms*: ### Description  Plain new setup of RN 0.81 & gluestack-ui v2 causes issue with peer deps  ### CodeSandbox/Snack link  not present  ### Steps to reproduce  nvm install 20.19.4 nvm use 20.19.4 npx @react-native-community/cli@latest init npx gluestack-ui init (failed on iOS pods) Manual Gluestack setup - Created provider manually in components/ui/ Fixed import path - Changed @/ to ./ in App.tsx Fixed react-native-reanimated - Downgraded to 3.15.0 (v4+ incompatible with RN 0.81) Fixed react-native-svg - Used 15.12.1 (other versions had build errors)  npm start npm run android  ### gluestack-ui Version  2  ### Platform  - [ ] Expo - [x] React Native CLI - [ ] Next - [ ] Web - [x] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  {   "name": "wms",   "version": "0.0.1",   "private": true,   "scripts": {     "android": "react-native run-android",     "ios": "react-native run-ios",     "lint": "eslint .",     "start": "react-native start",     "test": "jest"   },   "dependencies": {     "@gluestack-ui/nativewind-utils": "^1.0.26",     "@gluestack-ui/overlay": "^0.1.22",     "@gluestack-ui/toast": "^1.0.9",     "@react-native/new-app-screen": "0.81.0",     "nativewind": "^4.1.23",     "react": "19.1.0",     "react-native": "0.81.0",     "react-native-css-interop": "^0.1.22",     "react-native-reanimated": "^3.15.0",     "react-native-safe-area-context": "^5.6.1",     "react-native-svg": "^15.12.1",     "tailwindcss": "^3.4.17"   },   "devDependencies":
  **Post-Mortem & Fix Analysis**:
  > Solved. installed react-dom as dev dependency. Need to know why I needed to do that for the React Native application
  > > Solved. installed react-dom as dev dependency. Need to know why I needed to do that for the React Native application  That’s expected 🙂 — we ship our components as universal (web + native), so react-dom ends up being a dependency for most of our components. Even if you’re running React Native only, it’s required in the tree for type safety and compatibility with our universal setup
  > @Sanchitv3 Why react-dom is not automatically installed when we setup gluestack ? Also shouldn't we keep seperation of modules for web, native so we don't end up in conflicts ?

- **Issue #3131** (2026-03-20): **[v3] Upgrade CLI command doesn't have same package-manager behavior as other commands**
  *Symptoms*: ### Description  The new `upgrade` command doesn't use the same package-manager selection options as the other commands in the CLI.  ### CodeSandbox/Snack link  This is a CLI bug - can be proven on a vanilla project from gluestack init.  ### Steps to reproduce  1. Remove `yarn.lock`. 2. Run `npx gluestack-ui@alpha upgrade --use-yarn` 3. Note that the command still uses `npm` instead of `yarn` because in the repro project there is no `yarn.lock` file and the use-yarn command is ignored. ### gluestack-ui Version  alpha  ### Platform  - [x] Expo - [x] React Native CLI - [x] Next - [x] Web - [x] Android - [x] iOS  ### Other Platform  (this is a CLI issue - it is universal)  ### Additional Information  I will open a PR in like 5 minutes to fix this.

- **Issue #3124** (2025-10-31): **Actionsheet onClose state out of sync**
  *Symptoms*: ### Description  When I close an actionsheet by dragging, the saved state is behind by one. When I close by clicking the backdrop, the state on close is correct.  ### CodeSandbox/Snack link  https://snack.expo.dev/@nathan-hadley/actionsheet-state-bug-example  ### Steps to reproduce  1. Use the sandbox link to get a reproducible example. 2. Run the code in an environment with ActionSheet and Radio Gluestack components installed. 3. Open the sheet and select "Houses." 4. Close the sheet by dragging and you will see "Apartments" logged in console. 5. Open the sheet and select "Apartments." 6. Close the sheet and you will see "Houses" logged in console. 7. Open the sheet and select "Houses." 8. Close the sheet by clicking the backdrop and you will see "Houses" logged in console.   ### gluestack-ui Version  0.2.53 of @gluestack-ui/actionsheet  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [x] Android - [x] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Oh, I understand the issue now — it’s related to the `RadioGroup`. I’ll get back to you with a solution soon.
  > @Sanchitv3 thanks! I think the `RadioGroup` might be a red herring. I think it could be anything using `useState`. I have another sheet with a date picker and the same issue occurs. A workaround is to use a ref, and reference that in the `onClose` but I still want to use `useState` for the UI state, and thus duplicate state, which is not ideal.

- **Issue #3101** (2025-08-08): **Actionsheet onClose state out of sync**
  *Symptoms*: ### Description  When I close an actionsheet by dragging, the saved state is behind by one. When I close by clicking the backdrop, the state on close is correct.  ### CodeSandbox/Snack link  https://snack.expo.dev/@nathan-hadley/actionsheet-state-bug-example  ### Steps to reproduce  1. Use the sandbox link to get a reproducible example.  2. Run the code in an environment with ActionSheet and Radio Gluestack components installed.  3. Open the sheet and select "Houses."  4. Close the sheet by dragging and you will see "Apartments" logged in console. 5. Open the sheet and select "Apartments." 6. Close the sheet and you will see "Houses" logged in console. 7. Open the sheet and select "Houses." 8. Close the sheet by clicking the backdrop and you will see "Houses" logged in console.   ### gluestack-ui Version  0.2.53 of @gluestack-ui/actionsheet  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @nathan-hadley , Your code seems to be incorrect , here is the updated code: ``` // RadioSheet.tsx import React from 'react'; import {   Actionsheet,   ActionsheetBackdrop,   ActionsheetContent,   ActionsheetDragIndicator,   ActionsheetDragIndicatorWrapper, } from '@/components/ui/actionsheet'; import { VStack } from '@/components/ui/vstack'; import {   Radio,   RadioGroup,   RadioIcon,   RadioIndicator,   RadioLabel, } from '@/components/ui/radio'; import { CircleIcon } from './ui/icon';  export const RadioSheet = ({   isOpen,   onClose, }: {   isOpen: boolean;   onClose: () => void; }) => {   const [value, setValue] = React.useState('Apartments');    function handleBackdropClose() {     console.log('Handle backdrop close', value);   }    function handleDragClose() {     onClose();     console.log('Handle drag close', value);   }    return (     <Actionsheet isOpen={isOpen} onClose={handleDragClose}>       <ActionsheetBackdrop onPress={handleBackdropClose} />       <ActionsheetCont
  > @Sanchitv3 would you mind trying to reproduce the issue with your corrected code? I accidentally removed the `onClose` when I was trying to simplify the example as much as possible
  > @Sanchitv3 for visibility, I'm reopening this issue with the corrected code here: https://github.com/gluestack/gluestack-ui/issues/3124

- **Issue #3099** (2026-03-27): **useRadio WeakMap returns undefined**
  *Symptoms*: ### Description  useRadio hook fails to return the incoming state value and instead returns `undefined`. Values are destructured from `undefined`, resulting in a runtime error.  ### CodeSandbox/Snack link  https://snack.expo.dev/@tim-headway/useradio-undefined-error  ### Steps to reproduce  Simply call `useRadio` with any values using `@react-native-aria/radio` version `0.2.13`   ### gluestack-ui Version  3.3.1  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [x] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi! 👋 I’d love to work on this issue as my first contribution.
  > Thanks for reporting!  This is no longer applicable with the current version of the codebase.  Closing for now, please open a new issue if it still persists 🙌

- **Issue #3086** (2026-03-26): **Modal avoidkeyboard not working on android**
  *Symptoms*: ### Description  when using adding the prop avoidKeyboard  to  <Modal/> i works on ios but not android  ### CodeSandbox/Snack link  couldn't have one.  ### Steps to reproduce ```html <Modal avoidKeyboard={true}> ... </Modal> it will avoid the keyboard on ios but not android. ``` same with: ```html <KeyboardAvoidingView       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}       style={{ flex: 1 }} // with or witout     > <Modal> ... </Modal> </KeyboardAvoidingView ``` ### gluestack-ui Version  "@gluestack-ui/modal": "^0.1.39"  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > We’ve released the fix in `@gluestack-ui/utils@3.0.19` and `@gluestack-ui/utils@5.0.3-alpha.0`. Please update to the latest version and let us know if you’re still facing any issues 🙌 

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

### Incident Patch 1: `b712c854` (2026-09-02)
**Commit Message**: Merge pull request #3456 from gluestack/fix/remove-product-hunt-banner

fix: remove Product Hunt banner from header

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +221/-221)
```diff
@@ -27,9 +27,12 @@ import { Link } from '@/components/ui/link';
 import { Text } from '@/components/ui/text';
 import { Box } from '@/components/ui/box';
 import { Icon } from '@/components/ui/icon';
-import { Menu as VersionMenu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
+import {
+  Menu as VersionMenu,
+  MenuItem,
+  MenuItemLabel,
+} from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
-import ProductHuntBanner from '../landing-page/ProductHuntBanner';
 
 const Header = ({
   isOpenSidebar: propsIsOpenSidebar,
@@ -43,7 +46,6 @@ const Header = ({
   const pathname = usePathname();
   const { colorMode, setColorMode } = useColorMode();
   const [showModal, setShowModal] = useState(false);
-  const [showPHBanner, setShowPHBanner] = useState(true);
 
   // Check if current route is documentation
   const isDocsRoute = pathname?.includes('/ui/docs/');
@@ -57,246 +59,244 @@ const Header = ({
 
   return (
     <>
-      <ProductHuntBanner
-        showPHBanner={showPHBanner}
-        setShowPHBanner={setShowPHBanner}
-      />
       <div className="h-[53px] w-full sticky top-0 z-10 flex justify-center bg-white/80 border-b border-border dark:bg-background/80 backdrop-blur-md">
-      {/* @ts-ignore */}
-      <Nav className="items-center justify-center w-full mx-auto py-6">
-        <div
-          className={`flex flex-row justify-between items-center  ${
-            pathname?.includes('/ui/docs/')
-              ? 'w-[100%] px-5'
-              : 'w-[85%] max-w-[1440px]'
-          }`}
-        >
-          <div className="flex flex-row  gap-3 items-center shrink-0">
-            <NextLink
-              href="/"
-              className="no-underline z-1 flex sm:flex-row gap-1 items-center"
-            >
-              <Image
-                alt="gluestack-ui logo"
-                className="h-[20px] w-full max-w-fit"
-                src={colorMode === 'dark' ? GluestackLogoDark : GluestackLogo}
-                priority
-              />
-            </NextLink>
-            {/* Version selector */}
-            <VersionMenu
-              placement="bottom"
-              offset={18}
-              trigger={({ ...triggerProps }) => {
-                return (
-                  <Pressable
-                    {...triggerProps}
-                    className="flex-row items-center pb-0.5"
-                  >
-                    <Text className="font-bold text-foreground text-sm">
-                      v5
-                    </Text>
-                    <Icon
-                      as={ChevronDownIcon}
-                      className="w-3 h-3 ml-1 text-foreground"
-                    />
-                  </Pressable>
-                );
-              }}
-            >
-              <MenuItem className="min-w-fit px-5 py-2">
-                <MenuItemLabel>v5</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v4.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v4</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v3.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v3</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v2.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v2</MenuItemLabel>
-              </MenuItem>
-            </VersionMenu>
-            {/* Desktop: Show Docs and Demo buttons */}
-            <div className="hidden md:flex items-center xl:ml-10">
+        {/* @ts-ignore */}
+        <Nav className="items-center justify-center w-full mx-auto py-6">
+          <div
+            className={`flex flex-row justify-between items-center  ${
+              pathname?.includes('/ui/docs/')
+                ? 'w-[100%] px-5'
+                : 'w-[85%] max-w-[1440px]'
+            }`}
+          >
+            <div className="flex flex-row  gap-3 items-center shrink-0">
               <NextLink
-                className="lg:flex hidden rounded-full px-3 py-1 hover:bg-primary/10 active:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-primary"
-                href="/ui/docs"
+                href="/"
+                className="no-underline z-1 flex sm:flex-row gap-1 items-center"
               >
-                <div className="rounded-full flex items-center justify-center">
-                  <span className="leading-normal font-normal text-sm text-foreground/70">
-                    Docs
-                  </span>
-                </div>
+                <Image
+          
```

---

### Incident Patch 2: `9dd869c1` (2026-09-02)
**Commit Message**: fix(header): remove unused state for Product Hunt banner

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +0/-2)
```diff
@@ -33,7 +33,6 @@ import {
   MenuItemLabel,
 } from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
-import ProductHuntBanner from '../landing-page/ProductHuntBanner';
 
 const Header = ({
   isOpenSidebar: propsIsOpenSidebar,
@@ -47,7 +46,6 @@ const Header = ({
   const pathname = usePathname();
   const { colorMode, setColorMode } = useColorMode();
   const [showModal, setShowModal] = useState(false);
-  const [showPHBanner, setShowPHBanner] = useState(true);
 
   // Check if current route is documentation
   const isDocsRoute = pathname?.includes('/ui/docs/');
```

---

### Incident Patch 3: `3fe691c1` (2026-09-02)
**Commit Message**: fix: remove Product Hunt banner from header

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +221/-219)
```diff
@@ -27,7 +27,11 @@ import { Link } from '@/components/ui/link';
 import { Text } from '@/components/ui/text';
 import { Box } from '@/components/ui/box';
 import { Icon } from '@/components/ui/icon';
-import { Menu as VersionMenu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
+import {
+  Menu as VersionMenu,
+  MenuItem,
+  MenuItemLabel,
+} from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
 import ProductHuntBanner from '../landing-page/ProductHuntBanner';
 
@@ -57,246 +61,244 @@ const Header = ({
 
   return (
     <>
-      <ProductHuntBanner
-        showPHBanner={showPHBanner}
-        setShowPHBanner={setShowPHBanner}
-      />
       <div className="h-[53px] w-full sticky top-0 z-10 flex justify-center bg-white/80 border-b border-border dark:bg-background/80 backdrop-blur-md">
-      {/* @ts-ignore */}
-      <Nav className="items-center justify-center w-full mx-auto py-6">
-        <div
-          className={`flex flex-row justify-between items-center  ${
-            pathname?.includes('/ui/docs/')
-              ? 'w-[100%] px-5'
-              : 'w-[85%] max-w-[1440px]'
-          }`}
-        >
-          <div className="flex flex-row  gap-3 items-center shrink-0">
-            <NextLink
-              href="/"
-              className="no-underline z-1 flex sm:flex-row gap-1 items-center"
-            >
-              <Image
-                alt="gluestack-ui logo"
-                className="h-[20px] w-full max-w-fit"
-                src={colorMode === 'dark' ? GluestackLogoDark : GluestackLogo}
-                priority
-              />
-            </NextLink>
-            {/* Version selector */}
-            <VersionMenu
-              placement="bottom"
-              offset={18}
-              trigger={({ ...triggerProps }) => {
-                return (
-                  <Pressable
-                    {...triggerProps}
-                    className="flex-row items-center pb-0.5"
-                  >
-                    <Text className="font-bold text-foreground text-sm">
-                      v5
-                    </Text>
-                    <Icon
-                      as={ChevronDownIcon}
-                      className="w-3 h-3 ml-1 text-foreground"
-                    />
-                  </Pressable>
-                );
-              }}
-            >
-              <MenuItem className="min-w-fit px-5 py-2">
-                <MenuItemLabel>v5</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v4.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v4</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v3.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v3</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v2.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v2</MenuItemLabel>
-              </MenuItem>
-            </VersionMenu>
-            {/* Desktop: Show Docs and Demo buttons */}
-            <div className="hidden md:flex items-center xl:ml-10">
+        {/* @ts-ignore */}
+        <Nav className="items-center justify-center w-full mx-auto py-6">
+          <div
+            className={`flex flex-row justify-between items-center  ${
+              pathname?.includes('/ui/docs/')
+                ? 'w-[100%] px-5'
+                : 'w-[85%] max-w-[1440px]'
+            }`}
+          >
+            <div className="flex flex-row  gap-3 items-center shrink-0">
               <NextLink
-                className="lg:flex hidden rounded-full px-3 py-1 hover:bg-primary/10 active:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-primary"
-                href="/ui/docs"
+                href="/"
+                className="no-underline z-1 flex sm:flex-row gap-1 items-center"
               >
-                <div className="rounded-full flex items-center justify-center">
-                  <span className="leading-normal font-normal text-sm text-foreground/70">
-                    Docs
-                  </span>
-                </div>
+                <Image
+                  alt="gluestack-ui logo"
+                  className="h-[20px] w-full max-w-fit"
+                  src={colorMode === 'dark' ? GluestackLogoDark : GluestackLogo}
+                  priority
+                />
               </NextLink>
-              <NextLink
-                className="lg:flex hidden rounded-full px-3 py-1 hover:bg-primary/10 active:bg-primary/20 outline-none focus-vis
```

---

### Incident Patch 4: `f87eaae7` (2026-08-19)
**Commit Message**: Merge pull request #3451 from gluestack/fix/landing-page-muted-text

fix: update landing page components for improved styling and function…

**File**: `apps/kitchen-sink/.gitignore` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ expo-env.d.ts
 
 # Native
 .kotlin/
+android/
+ios/
 *.orig.*
 *.jks
 *.p8
```

**File**: `apps/website/components/page-components/landing-page/Example/index.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const Example = () => {
         <Heading size="2xl" className="text-3xl md:text-4xl font-bold">
           Same code for Next.js and Expo
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] w-full md:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] w-full md:w-[75%]">
           Build universal apps with consistent code across Next.js and Expo
           projects. Boost productivity, ensure code consistency, and simplify
           maintenance for both web and mobile platforms using a powerful React
```

**File**: `apps/website/components/page-components/landing-page/Inspiration/index.tsx` (modified, +2/-6)
```diff
@@ -12,17 +12,13 @@ const Inspiration = () => {
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Inspiration
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           This project wouldn't have been possible without the great work by
           community members and inspiration from these libraries.
         </Text>
       </VStack>
       <Box className="relative max-w-4xl w-full h-full aspect-[844/311]">
-        <Image
-          alt="tech logos"
-          src={insImg}
-          className="w-full h-full"
-        />
+        <Image alt="tech logos" src={insImg} className="w-full h-full" />
       </Box>
     </Box>
   );
```

**File**: `apps/website/components/page-components/landing-page/Kitchensink/index.tsx` (modified, +2/-2)
```diff
@@ -15,13 +15,13 @@ import { kitchensink } from '@/components/docs-components/apps/appConfig';
 
 const Kitchensink = () => {
   return (
-    <Box className="gap-10 p-4 bg-muted mt-[120px] sm:mt-0 sm:bg-background sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
+    <Box className="gap-10 p-4  mt-[120px] sm:mt-0  sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
       <VStack className="max-w-[1024px] sm:mt-[120px] gap-3">
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Kitchensink
         </Heading>
         <VStack className="gap-4">
-          <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+          <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
             <a
               href="https://gluestack.io/ui/docs/apps/kitchensink-app"
               className="underline underline-offset-4 group-hover/link:underline"
```

**File**: `apps/website/components/page-components/landing-page/MCPServer/index.tsx` (modified, +2/-2)
```diff
@@ -78,7 +78,7 @@ const VadimStream = () => {
         <Heading className="text-3xl font-roboto font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           MCP Server
         </Heading>
-        <Text className="text-lg font-roboto font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           Our MCP (Model Context Protocol) Server is an intelligent code
           generation tool that creates production-ready, consistent UI
           components using gluestack-ui v2. It streamlines your development
@@ -95,7 +95,7 @@ const VadimStream = () => {
           src="https://www.youtube.com/embed/5lSvkESJgmY"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
           allowFullScreen
-          loading='lazy'
+          loading="lazy"
         />
       </Box>
     </Box>
```

**File**: `apps/website/components/page-components/landing-page/MainContent/index.tsx` (modified, +1/-1)
```diff
@@ -945,7 +945,7 @@ const MainContent = () => {
       <VStack className="gap-20 flex-1">
         <VStack className="gap-3">
           <Heading className="text-5xl">Same code for Next.js and Expo</Heading>
-          <Text>
+          <Text className="text-muted-foreground">
             Lorem ipsum dolor sit amet consectetur. Pretium mauris maecenas
             lobortis libero orci orci pellentesque. Hendrerit penatibus mauris
             adipiscing egestas. Nec risus malesuada habitant diam fermentum.
```

**File**: `apps/website/components/page-components/landing-page/MeetCreators/index.tsx` (modified, +2/-2)
```diff
@@ -33,8 +33,8 @@ function MeetCreators({ geekyantsLink }: { geekyantsLink: string }) {
         </Text>
         <Text className="text-lg font-normal leading-[30px] mt-3 text-muted-foreground">
           GeekyAnts is a team of React Native experts who love open-source and
-          solving developer problems. We've been working on React Native since
-          2015 and have designed and built{' '}
+          solving developer problems. We&apos;ve been working on React Native
+          since 2015 and have designed and built{' '}
           <a
             href="https://theappmarket.io/"
             className="underline underline-offset-4 group-hover/link:underline"
```

**File**: `apps/website/components/page-components/landing-page/Newsletter/index.tsx` (modified, +12/-10)
```diff
@@ -86,13 +86,12 @@ export const Newsletter = ({
       setLoading(true);
       setError(false);
       setErrorMessage('');
-  
-      const response = await axios.post('/api/listmonk', { 
-       
+
+      const response = await axios.post('/api/listmonk', {
         email: email,
-        name: '' // You can add a name field to your form if needed
+        name: '', // You can add a name field to your form if needed
       });
-  
+
       if (response.status === 200) {
         setSuccess(true);
         setError(false);
@@ -102,16 +101,19 @@ export const Newsletter = ({
     } catch (error: any) {
       setError(true);
       setSuccess(false);
-      
+
       // Handle different error cases based on status code
       if (error.response?.status === 409) {
         setErrorMessage('This email is already subscribed!');
       } else if (error.response?.status === 400) {
         setErrorMessage('Please enter a valid email address!');
       } else {
-        setErrorMessage(error.response?.data?.message || 'Error subscribing to newsletter. Please try again!');
+        setErrorMessage(
+          error.response?.data?.message ||
+            'Error subscribing to newsletter. Please try again!'
+        );
       }
-      
+
       setEmail('');
     } finally {
       setLoading(false);
@@ -136,7 +138,7 @@ export const Newsletter = ({
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 mb-3 text-foreground sm:text-4xl">
           Get exclusive updates!
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           We can&apos;t do this alone, we would love feedback and the fastest
           way for us to reach out to you is via emails. We won&apos;t spam, I
           promise!
@@ -178,7 +180,7 @@ export const Newsletter = ({
             onPress={subscribeToNewsLetter}
           >
             {loading ? (
-             <ButtonText>loading</ButtonText>
+              <ButtonText>loading</ButtonText>
             ) : (
               <>
                 <ButtonText className="font-medium leading-normal">
```

---

### Incident Patch 5: `9b7f7735` (2026-08-19)
**Commit Message**: fix: update landing page components for improved styling and functionality

- Added 'android/' and 'ios/' to .gitignore for better project management.
- Updated text styles to use 'text-muted-foreground' for consistency across landing page components.
- Cleaned up code formatting in various components for better readability.
- Adjusted loading attributes for images to use double quotes for consistency.

**File**: `apps/kitchen-sink/.gitignore` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ expo-env.d.ts
 
 # Native
 .kotlin/
+android/
+ios/
 *.orig.*
 *.jks
 *.p8
```

**File**: `apps/website/components/page-components/landing-page/Example/index.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const Example = () => {
         <Heading size="2xl" className="text-3xl md:text-4xl font-bold">
           Same code for Next.js and Expo
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] w-full md:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] w-full md:w-[75%]">
           Build universal apps with consistent code across Next.js and Expo
           projects. Boost productivity, ensure code consistency, and simplify
           maintenance for both web and mobile platforms using a powerful React
```

**File**: `apps/website/components/page-components/landing-page/Inspiration/index.tsx` (modified, +2/-6)
```diff
@@ -12,17 +12,13 @@ const Inspiration = () => {
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Inspiration
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           This project wouldn't have been possible without the great work by
           community members and inspiration from these libraries.
         </Text>
       </VStack>
       <Box className="relative max-w-4xl w-full h-full aspect-[844/311]">
-        <Image
-          alt="tech logos"
-          src={insImg}
-          className="w-full h-full"
-        />
+        <Image alt="tech logos" src={insImg} className="w-full h-full" />
       </Box>
     </Box>
   );
```

**File**: `apps/website/components/page-components/landing-page/Kitchensink/index.tsx` (modified, +2/-2)
```diff
@@ -15,13 +15,13 @@ import { kitchensink } from '@/components/docs-components/apps/appConfig';
 
 const Kitchensink = () => {
   return (
-    <Box className="gap-10 p-4 bg-muted mt-[120px] sm:mt-0 sm:bg-background sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
+    <Box className="gap-10 p-4  mt-[120px] sm:mt-0  sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
       <VStack className="max-w-[1024px] sm:mt-[120px] gap-3">
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Kitchensink
         </Heading>
         <VStack className="gap-4">
-          <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+          <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
             <a
               href="https://gluestack.io/ui/docs/apps/kitchensink-app"
               className="underline underline-offset-4 group-hover/link:underline"
```

**File**: `apps/website/components/page-components/landing-page/MCPServer/index.tsx` (modified, +2/-2)
```diff
@@ -78,7 +78,7 @@ const VadimStream = () => {
         <Heading className="text-3xl font-roboto font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           MCP Server
         </Heading>
-        <Text className="text-lg font-roboto font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           Our MCP (Model Context Protocol) Server is an intelligent code
           generation tool that creates production-ready, consistent UI
           components using gluestack-ui v2. It streamlines your development
@@ -95,7 +95,7 @@ const VadimStream = () => {
           src="https://www.youtube.com/embed/5lSvkESJgmY"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
           allowFullScreen
-          loading='lazy'
+          loading="lazy"
         />
       </Box>
     </Box>
```

**File**: `apps/website/components/page-components/landing-page/MainContent/index.tsx` (modified, +1/-1)
```diff
@@ -945,7 +945,7 @@ const MainContent = () => {
       <VStack className="gap-20 flex-1">
         <VStack className="gap-3">
           <Heading className="text-5xl">Same code for Next.js and Expo</Heading>
-          <Text>
+          <Text className="text-muted-foreground">
             Lorem ipsum dolor sit amet consectetur. Pretium mauris maecenas
             lobortis libero orci orci pellentesque. Hendrerit penatibus mauris
             adipiscing egestas. Nec risus malesuada habitant diam fermentum.
```

**File**: `apps/website/components/page-components/landing-page/MeetCreators/index.tsx` (modified, +2/-2)
```diff
@@ -33,8 +33,8 @@ function MeetCreators({ geekyantsLink }: { geekyantsLink: string }) {
         </Text>
         <Text className="text-lg font-normal leading-[30px] mt-3 text-muted-foreground">
           GeekyAnts is a team of React Native experts who love open-source and
-          solving developer problems. We've been working on React Native since
-          2015 and have designed and built{' '}
+          solving developer problems. We&apos;ve been working on React Native
+          since 2015 and have designed and built{' '}
           <a
             href="https://theappmarket.io/"
             className="underline underline-offset-4 group-hover/link:underline"
```

**File**: `apps/website/components/page-components/landing-page/Newsletter/index.tsx` (modified, +12/-10)
```diff
@@ -86,13 +86,12 @@ export const Newsletter = ({
       setLoading(true);
       setError(false);
       setErrorMessage('');
-  
-      const response = await axios.post('/api/listmonk', { 
-       
+
+      const response = await axios.post('/api/listmonk', {
         email: email,
-        name: '' // You can add a name field to your form if needed
+        name: '', // You can add a name field to your form if needed
       });
-  
+
       if (response.status === 200) {
         setSuccess(true);
         setError(false);
@@ -102,16 +101,19 @@ export const Newsletter = ({
     } catch (error: any) {
       setError(true);
       setSuccess(false);
-      
+
       // Handle different error cases based on status code
       if (error.response?.status === 409) {
         setErrorMessage('This email is already subscribed!');
       } else if (error.response?.status === 400) {
         setErrorMessage('Please enter a valid email address!');
       } else {
-        setErrorMessage(error.response?.data?.message || 'Error subscribing to newsletter. Please try again!');
+        setErrorMessage(
+          error.response?.data?.message ||
+            'Error subscribing to newsletter. Please try again!'
+        );
       }
-      
+
       setEmail('');
     } finally {
       setLoading(false);
@@ -136,7 +138,7 @@ export const Newsletter = ({
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 mb-3 text-foreground sm:text-4xl">
           Get exclusive updates!
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           We can&apos;t do this alone, we would love feedback and the fastest
           way for us to reach out to you is via emails. We won&apos;t spam, I
           promise!
@@ -178,7 +180,7 @@ export const Newsletter = ({
             onPress={subscribeToNewsLetter}
           >
             {loading ? (
-             <ButtonText>loading</ButtonText>
+              <ButtonText>loading</ButtonText>
             ) : (
               <>
                 <ButtonText className="font-medium leading-normal">
```

---

### Incident Patch 6: `2b1650c0` (2026-08-10)
**Commit Message**: Merge pull request #3450 from gluestack/fix/modal-scroll-overflow

fix(modal): enable scroll when content overflows viewport

**File**: `src/components/ui/modal/index.tsx` (modified, +1/-2)
```diff
@@ -47,7 +47,7 @@ const modalBackdropStyle = tva({
 });
 
 const modalContentStyle = tva({
-  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6',
+  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6 max-h-[85vh]',
   parentVariants: {
     size: {
       xs: 'w-[60%] max-w-[360px]',
@@ -173,7 +173,6 @@ const ModalBody = React.forwardRef<
 >(function ModalBody({ className, ...props }, ref) {
   return (
     <UIModal.Body
-      scrollEnabled={false}
       ref={ref}
       {...props}
       className={modalBodyStyle({
```

---

### Incident Patch 7: `d758d98a` (2026-08-10)
**Commit Message**: fix(modal): enable scroll when content overflows viewport

- Remove scrollEnabled={false} from ModalBody so ScrollView can scroll
- Add max-h-[85vh] to ModalContent so overflowing content scrolls instead of spilling out

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `src/components/ui/modal/index.tsx` (modified, +1/-2)
```diff
@@ -47,7 +47,7 @@ const modalBackdropStyle = tva({
 });
 
 const modalContentStyle = tva({
-  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6',
+  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6 max-h-[85vh]',
   parentVariants: {
     size: {
       xs: 'w-[60%] max-w-[360px]',
@@ -173,7 +173,6 @@ const ModalBody = React.forwardRef<
 >(function ModalBody({ className, ...props }, ref) {
   return (
     <UIModal.Body
-      scrollEnabled={false}
       ref={ref}
       {...props}
       className={modalBodyStyle({
```

---

### Incident Patch 8: `ba8a7003` (2026-08-10)
**Commit Message**: Merge pull request #3449 from gluestack/fix/v5-docs-and-avatar-size

fix: align docs and examples with v5 component props, add Avatar size…

**File**: `src/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-12)
```diff
@@ -5,7 +5,7 @@ description: Troubleshoot common Nativewind issues, including dark mode, Toast i
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
 
 ## Common Issues
 
@@ -40,23 +40,16 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+To ensure Tailwind styles override with higher specificity in Tailwind v4, use the `important` configuration in your `global.css`:
 
-```jsx
-// tailwind.config.js
-module.exports = {
-  ...
-  important: 'html',
-  ...
-}
+```css
+@import "tailwindcss/utilities.css" important(html);
 ```
 
-**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
-
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
+- `dark:` class strategy now works on both web and native in v5.
 
 ## Still Facing Issues?
 
```

**File**: `src/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +39/-36)
```diff
@@ -115,15 +115,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `global.css`
+#### Step 2: Map tokens in `global.css`
 
-In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+NativeWind v5 uses a CSS-first approach. Map your tokens to Tailwind utilities in `global.css` using `@theme inline`:
 
 ```css
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
-  --color-border: rgb(var(--border));
-  --color-input: rgb(var(--input));
-  --color-ring: rgb(var(--ring));
   --color-background: rgb(var(--background));
   --color-foreground: rgb(var(--foreground));
   --color-primary: rgb(var(--primary));
@@ -138,41 +140,44 @@ In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` usin
   --color-popover: rgb(var(--popover));
   --color-popover-foreground: rgb(var(--popover-foreground));
   --color-card: rgb(var(--card));
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
 }
 ```
 
+The `vars()` in `config.ts` sets the CSS custom properties (like `--primary: 23 23 23`), and `@theme inline` in `global.css` maps them to Tailwind utilities (like `bg-primary`, `text-primary-foreground`).
+
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-<>
-  {/* Primary button */}
-  <Button className="bg-primary text-primary-foreground">
-    <ButtonText>Primary Action</ButtonText>
-  </Button>
-
-  {/* Secondary button */}
-  <Button className="bg-secondary text-secondary-foreground">
-    <ButtonText>Secondary Action</ButtonText>
-  </Button>
-
-  {/* Card with proper contrast */}
-  <Box className="bg-card border border-border p-4">
-    <Text className="text-foreground">Card content</Text>
-    <Text className="text-muted-foreground">Muted description</Text>
-  </Box>
-
-  {/* Destructive action */}
-  <Button className="bg-destructive text-primary-foreground">
-    <ButtonText>Delete</ButtonText>
-  </Button>
-
-  {/* With opacity */}
-  <Box className="bg-primary/10">
-    <Text className="text-primary">Subtle primary background</Text>
-  </Box>
-</>
+// Primary button
+<Button className="bg-primary text-primary-foreground">
+  <ButtonText>Primary Action</ButtonText>
+</Button>
+
+// Secondary button
+<Button className="bg-secondary text-secondary-foreground">
+  <ButtonText>Secondary Action</ButtonText>
+</Button>
+
+// Card with proper contrast
+<Box className="bg-card border border-border p-4">
+  <Text className="text-foreground">Card content</Text>
+  <Text className="text-muted-foreground">Muted description</Text>
+</Box>
+
+// Destructive action
+<Button className="bg-destructive text-primary-foreground">
+  <ButtonText>Delete</ButtonText>
+</Button>
+
+// With opacity
+<Box className="bg-primary/10">
+  <Text className="text-primary">Subtle primary background</Text>
+</Box>
 ```
 
 ### Adding Custom Tokens
@@ -200,7 +205,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -231,7 +236,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -240,8 +245,6 @@ export const config = {
 }
 ```
 
-Then use it in your components with the `text-custom-heading-xl` class.
-
 #### Step 3: Configure tva for the component
 
 For custom font sizes to work with `tva` (Tailwind Variants Authority), add configuration:
```

**File**: `src/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +10/-7)
```diff
@@ -20,26 +20,31 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+1. First, map the color token in your `global.css` file using `@theme inline`:
 
 ```css
 /* global.css */
+
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
   --color-primary: rgb(var(--color-primary));
 }
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
 
 ```js
 // config.ts
-import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,9 +120,7 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
-
-For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 automatically handles the color scheme switching — no `tailwind.config.js` configuration is required.
 
 ## Persist Color Mode
 
```

**File**: `src/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +8/-34)
```diff
@@ -82,13 +82,11 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-<>
-  {/* Full opacity — bg-primary (100% opacity) */}
-  <Box className="bg-primary" />
+// Full opacity
+<Box className="bg-primary" />
 
-  {/* 50% opacity — bg-primary/50 */}
-  <Box className="bg-primary/50" />
-</>
+// 50% opacity
+<Box className="bg-primary/50" />
 ```
 
 ### Benefits of This System
@@ -102,41 +100,17 @@ To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`.
 
 ## Typography
 
-To manage Typography options, add tokens in `global.css` via `@theme inline`.
+To manage Typography options, update `global.css` using `@theme inline` or `@theme` in Tailwind v4.
 
-To add or update **Font Family**, use `@theme inline` in `global.css`:
+To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in `global.css`.
 
-```css
-@theme inline {
-  --font-family-roboto: 'Roboto', sans-serif;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
-
-To add or update **font sizes**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-size-2xs: 10px;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
+To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `global.css` with a value of '**10px**'.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-weight-extrablack: 950;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
+To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `global.css` with a value of '**950**'.
 
 <FontWeightComponent />
 
```

---

### Incident Patch 9: `59ba4aca` (2026-08-10)
**Commit Message**: fix: align docs and examples with v5 component props, add Avatar size support

- Remove stale size/variant/action props from 8 component docs
- Remove stale size props from menu and form-control examples
- Add missing size/variant docs for radio, tooltip, textarea, toast
- Fix heading default size (md -> lg)
- Add size prop (sm/md/lg) to Avatar with React context propagation

**File**: `src/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-12)
```diff
@@ -5,7 +5,7 @@ description: Troubleshoot common Nativewind issues, including dark mode, Toast i
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
 
 ## Common Issues
 
@@ -40,23 +40,16 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+To ensure Tailwind styles override with higher specificity in Tailwind v4, use the `important` configuration in your `global.css`:
 
-```jsx
-// tailwind.config.js
-module.exports = {
-  ...
-  important: 'html',
-  ...
-}
+```css
+@import "tailwindcss/utilities.css" important(html);
 ```
 
-**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
-
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
+- `dark:` class strategy now works on both web and native in v5.
 
 ## Still Facing Issues?
 
```

**File**: `src/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +39/-36)
```diff
@@ -115,15 +115,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `global.css`
+#### Step 2: Map tokens in `global.css`
 
-In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+NativeWind v5 uses a CSS-first approach. Map your tokens to Tailwind utilities in `global.css` using `@theme inline`:
 
 ```css
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
-  --color-border: rgb(var(--border));
-  --color-input: rgb(var(--input));
-  --color-ring: rgb(var(--ring));
   --color-background: rgb(var(--background));
   --color-foreground: rgb(var(--foreground));
   --color-primary: rgb(var(--primary));
@@ -138,41 +140,44 @@ In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` usin
   --color-popover: rgb(var(--popover));
   --color-popover-foreground: rgb(var(--popover-foreground));
   --color-card: rgb(var(--card));
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
 }
 ```
 
+The `vars()` in `config.ts` sets the CSS custom properties (like `--primary: 23 23 23`), and `@theme inline` in `global.css` maps them to Tailwind utilities (like `bg-primary`, `text-primary-foreground`).
+
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-<>
-  {/* Primary button */}
-  <Button className="bg-primary text-primary-foreground">
-    <ButtonText>Primary Action</ButtonText>
-  </Button>
-
-  {/* Secondary button */}
-  <Button className="bg-secondary text-secondary-foreground">
-    <ButtonText>Secondary Action</ButtonText>
-  </Button>
-
-  {/* Card with proper contrast */}
-  <Box className="bg-card border border-border p-4">
-    <Text className="text-foreground">Card content</Text>
-    <Text className="text-muted-foreground">Muted description</Text>
-  </Box>
-
-  {/* Destructive action */}
-  <Button className="bg-destructive text-primary-foreground">
-    <ButtonText>Delete</ButtonText>
-  </Button>
-
-  {/* With opacity */}
-  <Box className="bg-primary/10">
-    <Text className="text-primary">Subtle primary background</Text>
-  </Box>
-</>
+// Primary button
+<Button className="bg-primary text-primary-foreground">
+  <ButtonText>Primary Action</ButtonText>
+</Button>
+
+// Secondary button
+<Button className="bg-secondary text-secondary-foreground">
+  <ButtonText>Secondary Action</ButtonText>
+</Button>
+
+// Card with proper contrast
+<Box className="bg-card border border-border p-4">
+  <Text className="text-foreground">Card content</Text>
+  <Text className="text-muted-foreground">Muted description</Text>
+</Box>
+
+// Destructive action
+<Button className="bg-destructive text-primary-foreground">
+  <ButtonText>Delete</ButtonText>
+</Button>
+
+// With opacity
+<Box className="bg-primary/10">
+  <Text className="text-primary">Subtle primary background</Text>
+</Box>
 ```
 
 ### Adding Custom Tokens
@@ -200,7 +205,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -231,7 +236,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -240,8 +245,6 @@ export const config = {
 }
 ```
 
-Then use it in your components with the `text-custom-heading-xl` class.
-
 #### Step 3: Configure tva for the component
 
 For custom font sizes to work with `tva` (Tailwind Variants Authority), add configuration:
```

**File**: `src/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +10/-7)
```diff
@@ -20,26 +20,31 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+1. First, map the color token in your `global.css` file using `@theme inline`:
 
 ```css
 /* global.css */
+
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
   --color-primary: rgb(var(--color-primary));
 }
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
 
 ```js
 // config.ts
-import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,9 +120,7 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
-
-For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 automatically handles the color scheme switching — no `tailwind.config.js` configuration is required.
 
 ## Persist Color Mode
 
```

**File**: `src/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +8/-34)
```diff
@@ -82,13 +82,11 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-<>
-  {/* Full opacity — bg-primary (100% opacity) */}
-  <Box className="bg-primary" />
+// Full opacity
+<Box className="bg-primary" />
 
-  {/* 50% opacity — bg-primary/50 */}
-  <Box className="bg-primary/50" />
-</>
+// 50% opacity
+<Box className="bg-primary/50" />
 ```
 
 ### Benefits of This System
@@ -102,41 +100,17 @@ To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`.
 
 ## Typography
 
-To manage Typography options, add tokens in `global.css` via `@theme inline`.
+To manage Typography options, update `global.css` using `@theme inline` or `@theme` in Tailwind v4.
 
-To add or update **Font Family**, use `@theme inline` in `global.css`:
+To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in `global.css`.
 
-```css
-@theme inline {
-  --font-family-roboto: 'Roboto', sans-serif;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
-
-To add or update **font sizes**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-size-2xs: 10px;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
+To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `global.css` with a value of '**10px**'.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-weight-extrablack: 950;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
+To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `global.css` with a value of '**950**'.
 
 <FontWeightComponent />
 
```

---

### Incident Patch 10: `28689a71` (2026-08-10)
**Commit Message**: Merge pull request #3447 from gluestack/fix/v5-theming-docs

fix(docs): update theming docs from tailwind.config.js to NativeWind …

**File**: `apps/website/app/ui/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-3)
```diff
@@ -2,7 +2,7 @@ import { CodeBlock } from "@/components/custom/markdown/code-block";
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -37,7 +37,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -48,10 +48,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +66/-85)
```diff
@@ -105,82 +105,64 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `tailwind.config.js`
-
-Ensure your Tailwind config maps the CSS variables to Tailwind classes:
-
-```jsx
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        border: 'rgb(var(--border))',
-        input: 'rgb(var(--input))',
-        ring: 'rgb(var(--ring))',
-        background: 'rgb(var(--background))',
-        foreground: 'rgb(var(--foreground))',
-        primary: {
-          DEFAULT: 'rgb(var(--primary))',
-          foreground: 'rgb(var(--primary-foreground))',
-        },
-        secondary: {
-          DEFAULT: 'rgb(var(--secondary))',
-          foreground: 'rgb(var(--secondary-foreground))',
-        },
-        destructive: {
-          DEFAULT: 'rgb(var(--destructive))',
-        },
-        muted: {
-          DEFAULT: 'rgb(var(--muted))',
-          foreground: 'rgb(var(--muted-foreground))',
-        },
-        accent: {
-          DEFAULT: 'rgb(var(--accent))',
-          foreground: 'rgb(var(--accent-foreground))',
-        },
-        popover: {
-          DEFAULT: 'rgb(var(--popover))',
-          foreground: 'rgb(var(--popover-foreground))',
-        },
-        card: {
-          DEFAULT: 'rgb(var(--card))',
-        },
-      },
-    },
-  },
-};
+#### Step 2: Map tokens to Tailwind in `global.css`
+
+In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+
+```css
+@theme inline {
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
+  --color-background: rgb(var(--background));
+  --color-foreground: rgb(var(--foreground));
+  --color-primary: rgb(var(--primary));
+  --color-primary-foreground: rgb(var(--primary-foreground));
+  --color-secondary: rgb(var(--secondary));
+  --color-secondary-foreground: rgb(var(--secondary-foreground));
+  --color-destructive: rgb(var(--destructive));
+  --color-muted: rgb(var(--muted));
+  --color-muted-foreground: rgb(var(--muted-foreground));
+  --color-accent: rgb(var(--accent));
+  --color-accent-foreground: rgb(var(--accent-foreground));
+  --color-popover: rgb(var(--popover));
+  --color-popover-foreground: rgb(var(--popover-foreground));
+  --color-card: rgb(var(--card));
+}
 ```
 
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-// Primary button
-<Button className="bg-primary text-primary-foreground">
-  <ButtonText>Primary Action</ButtonText>
-</Button>
-
-// Secondary button
-<Button className="bg-secondary text-secondary-foreground">
-  <ButtonText>Secondary Action</ButtonText>
-</Button>
-
-// Card with proper contrast
-<Box className="bg-card border border-border p-4">
-  <Text className="text-foreground">Card content</Text>
-  <Text className="text-muted-foreground">Muted description</Text>
-</Box>
-
-// Destructive action
-<Button className="bg-destructive text-primary-foreground">
-  <ButtonText>Delete</ButtonText>
-</Button>
-
-// With opacity
-<Box className="bg-primary/10">
-  <Text className="text-primary">Subtle primary background</Text>
-</Box>
+<>
+  {/* Primary button */}
+  <Button className="bg-primary text-primary-foreground">
+    <ButtonText>Primary Action</ButtonText>
+  </Button>
+
+  {/* Secondary button */}
+  <Button className="bg-secondary text-secondary-foreground">
+    <ButtonText>Secondary Action</ButtonText>
+  </Button>
+
+  {/* Card with proper contrast */}
+  <Box className="bg-card border border-border p-4">
+    <Text className="text-foreground">Card content</Text>
+    <Text className="text-muted-foreground">Muted description</Text>
+  </Box>
+
+  {/* Destructive action */}
+  <Button className="bg-destructive text-primary-foreground">
+    <ButtonText>Delete</ButtonText>
+  </Button>
+
+  {/* With opacity */}
+  <Box className="bg-primary/10">
+    <Text className="text-primary">Subtle primary background</Text>
+  </Box>
+</>
 ```
 
 ### Adding Custom Tokens
@@ -208,19 +190,15 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-colors: {
-  // ... existing colors
-  success: {
-    DEFAULT: 'rgb(var(--success))',
-    foreground: 'rgb(var(--success-foreground))',
-  },
-  warning: {
-    DEFAULT: 'rgb(var(--warning))',
-    foreground: 'rgb(var(--warning-foreground))',
-  },
+```css
+@theme inline {
+  /* ... existing tokens */
+  --color-success: rgb(var(--success));
+  --color-success-foreground: rgb(var(--success-foreground));
+  --color-warning: rgb(var(--warning));
+  --color-warning-foreground: rgb(var(--warning-foreground));
 }
 ```
 
@@ -243,14 +221,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-fontSize: {
-  'custom-heading-xl': 'var(--font-size-custom)',
+```css
+@theme inline {
+  /* ... existing tokens */
+  --font-size-custom-heading-xl: va
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +11/-40)
```diff
@@ -14,32 +14,26 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v4/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, define the color token in your `tailwind.config.js` file and assign a variable value as shown below, following Tailwind's recommendation for [using CSS variables in Tailwind](https://tailwindcss.com/docs/customizing-colors#using-css-variables).
+1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
 
-```js
-// tailwind.config.js
-
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        primary: 'rgb(var(--color-primary)/<alpha-value>)',
-      },
-    },
-  },
-};
+```css
+/* global.css */
+@theme inline {
+  --color-primary: rgb(var(--color-primary));
+}
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
 
 ```js
 // config.ts
+import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,32 +109,9 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. To use dark mode, we need to change the `darkMode` strategy to `"class"` for the web and `"media"` for native devices in the `tailwind.config.js` file. You can achieve this by setting the `DARK_MODE` environment variable as shown below.
-
-```js
-// tailwind.config.js
-
-module.exports = {
-  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : 'media',
-  // rest of the config
-};
-```
-
-After this, we need to update our scripts in the `package.json` file as shown below:
-
-```json
-{
-  "scripts": {
-    "android": "DARK_MODE=media expo start --android",
-    "ios": "DARK_MODE=media expo start --ios",
-    "web": "DARK_MODE=class expo start --web"
-  }
-}
-```
-
-For Next.js projects, you can directly set the `darkMode` strategy to `"class"` without needing to change the scripts.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
 
-> Note: This is a temporary solution until we fix the issue with nativewind for the `darkMode:"class"` strategy.
+For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
 
 ## Persist Color Mode
 
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +35/-9)
```diff
@@ -72,11 +72,13 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-// Full opacity
-<Box className="bg-primary" />
+<>
+  {/* Full opacity — bg-primary (100% opacity) */}
+  <Box className="bg-primary" />
 
-// 50% opacity
-<Box className="bg-primary/50" />
+  {/* 50% opacity — bg-primary/50 */}
+  <Box className="bg-primary/50" />
+</>
 ```
 
 ### Benefits of This System
@@ -86,21 +88,45 @@ Usage with opacity:
 3. **Guaranteed contrast** - Foreground tokens ensure readable text
 4. **Design system consistency** - Follows industry-standard patterns
 
-To customize colors, update `gluestack-ui-provider/config.ts` and `tailwind.config.js`. For detailed instructions, see [Customizing Theme](/ui/docs/home/theme-configuration/customizing-theme).
+To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`. For detailed instructions, see [Customizing Theme](/ui/docs/home/theme-configuration/customizing-theme).
 
 ## Typography
 
-To manage Typography options, update **theme** in `tailwind.config.js`.
+To manage Typography options, add tokens in `global.css` via `@theme inline`.
 
-To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in our `tailwind.config.js`.
+To add or update **Font Family**, use `@theme inline` in `global.css`:
 
-To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `tailwind.config.js` with a value of '**10px**'.
+```css
+@theme inline {
+  --font-family-roboto: 'Roboto', sans-serif;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
+
+To add or update **font sizes**, use `@theme inline` in `global.css`:
+
+```css
+@theme inline {
+  --font-size-2xs: 10px;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `tailwind.config.js` with a value of '**950**'.
+To add or update **font weights**, use `@theme inline` in `global.css`:
+
+```css
+@theme inline {
+  --font-weight-extrablack: 950;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
 
 <FontWeightComponent />
 
```

**File**: `apps/website/public/llms-full.txt` (modified, +143/-160)
```diff
@@ -2284,14 +2284,16 @@ const RootComponent = withStyleContext(View, SCOPE);
 const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
 const AnimatedView = Animated.createAnimatedComponent(View);
 
+const StyledAnimatedPressable = styled(AnimatedPressable, { className: 'style' });
+
 const UIAccessibleAlertDialog = createAlertDialog({
   Root: RootComponent,
   Body: ScrollView,
   Content: AnimatedView,
   CloseButton: Pressable,
   Header: View,
   Footer: View,
-  Backdrop: AnimatedPressable,
+  Backdrop: StyledAnimatedPressable,
 });
 
 const alertDialogStyle = tva({
@@ -2335,7 +2337,7 @@ const alertDialogFooterStyle = tva({
 const alertDialogBodyStyle = tva({ base: '' });
 
 const alertDialogBackdropStyle = tva({
-  base: 'absolute left-0 top-0 right-0 bottom-0 bg-black/50 web:cursor-default',
+  base: 'absolute left-0 top-0 right-0 bottom-0 bg-[#000]/50 web:cursor-default',
 });
 
 type IAlertDialogProps = React.ComponentPropsWithoutRef<
@@ -26134,6 +26136,10 @@ Create an intuitive UI using the gluestack-ui Tooltip component in React & React
 This is an illustration of **Tooltip** component.
 
 
+
+
+
+
 ```jsx
 function Example() {
   return (
@@ -28002,7 +28008,7 @@ URL: /ui/docs/guides/more/troubleshooting/index
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -28035,7 +28041,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -28046,10 +28052,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
@@ -29582,7 +29590,7 @@ Both engines eliminate `tailwind.config.js` in favor of defining theme tokens di
 ## Automated Upgrade (Recommended)
 
 ```bash
-npx gluestack-ui@alpha upgrade
+npx gluestack-ui@latest upgrade
 ```
 
 The CLI auto-detects your current version and asks which engine to upgrade to:
@@ -29605,7 +29613,7 @@ The CLI auto-detects your current version and asks which engine to upgrade to:
 | Area | Before (NativeWind v4) | After (NativeWind v5) |
 | --- | --- | --- |
 | Tailwind version | `tailwindcss@^3.x` | `tailwindcss@^4.2.0` |
-| NativeWind version | `nativewind@^4.1.23` | `nativewind@^5.0.0-preview.2` |
+| NativeWind version | `nativewind@^4.1.23` | `nativewind@^5.0.0-preview.4` |
 | New package | — | `react-native-css@^3.0.4` |
 | PostCSS config | — | `postcss.config.js` with `@tailwindcss/postcss` |
 | Theme tokens | `tailwind.config.js` | `global.css` via `@layer theme` |
@@ -29616,13 +29624,13 @@ The CLI auto-detects your current version and asks which engine to upgrade to:
 ## Automated CLI Upgrade
 
 ```bash
-npx gluestack-ui@alpha upgrade
+npx gluestack-ui@latest upgrade
 ```
 
 Select **NativeWind v5 (Tailwind CSS v4)**. The CLI will:
 
 1. Pin `lightningcss@1.30.1` in `package.json` overrides/resolutions
-2. Replace `nativewind@^4.x` with `nativewind@^5.0.0-preview.2`, add `react-native-css`
+2. Replace `nativewind@^4.x` with `nativewind@^5.0.0-preview.4`, add `react-native-css`
 3. Upgrade `tailwindcss` to v4, add `@tailwindcss/postcss`
 4. Rewrite `global.css` with Tailwind v4 imports and theme tokens
 5. Create `postcss.config.js`
@@ -29632,7 +29640,7 @@ Select **NativeWind v5 (Tailwind CSS v4)**. The CLI will:
 
 > **After upgrading:** Commit your changes, then re-add components to get NativeWind v5 versions:
 > ```bash
-> npx gluestack-ui@alpha add button accordion modal # all components you use
+> npx gluestack-ui@latest add button accordion modal # all components you use
 > ```
 
 ## Manual Migration to NativeWind v5
@@ -29653,14 +29661,14 @@ Add to `package.json` **before** installing other packages:
 **npm:**
 
 ```bash
-npm install nativewind@^5.0.0-preview.2 react-native-css@^3.0.4 @gluestack-ui/core@^5.0.0-alpha.0 @gluestack-ui/utils@^5.0.1-alpha.0
+npm install nativewind@^5.0.0-preview.4 react-native-css@^3.0.4 @gluestack-ui/core@^5.0.15 @gluestack-ui/utils@^5.0.6
 npm inst
```

**File**: `apps/website/public/search-index.json` (modified, +6/-6)
```diff
@@ -453,7 +453,7 @@
     "id": "ui-docs-components-tooltip",
     "title": "Tooltip",
     "description": "",
-    "content": "Tooltip\n\nCreate an intuitive UI using the gluestack-ui Tooltip component in React & React Native. Add hints & tooltips seamlessly.\n\nThis is an illustration of Tooltip component.\n\n return (\n Hover on me!\n \n )\n }}\n >\n Tooltip\n \n \n )\n}`}\n argTypes={{\n \"placement\": {\n \"control\": {\n \"type\": \"select\"\n },\n \"options\": [\n \"top\",\n \"top left\",\n \"top right\",\n \"bottom\",\n \"bottom left\",\n \"bottom right\",\n \"left\",\n \"left top\",\n \"left bottom\",\n \"right\",\n \"right top\",\n \"right bottom\"\n ],\n \"defaultValue\": \"top\"\n\n}}\n reactLive={{ Tooltip, TooltipContent, TooltipText, Button, ButtonText }}\n importMap={{\"@/components/ui/tooltip\":[\"Tooltip\",\"TooltipContent\",\"TooltipText\"],\"@/components/ui/button\":[\"Button\",\"ButtonText\"]}}\n\n/>\n\nInstallation\n\nRun the following command:\n\nNote: At present, we have integrated the for animation. You have the option to remove this and implement your own custom animation wrapper.\n\nStep 1: Install the following dependencies:\n\nStep 2: Copy and paste the following code into your project.\n\nStep 3: Update the import paths to match your project setup.\n\nAPI Reference\n\nTo use this component in your project, include the following import statement in your file.\n\nComponent Props\n\nThis section provides a comprehensive reference list for the component props, detailing descriptions, properties, types, and default behavior for easy project integration.\n\nTooltip\n\nIt inherits all the properties of React Native's View component.\n\n Prop\n Type\n Default\n Description\n \n \n isOpen\n \n boolean\n false\n Whether the tooltip is opened. Useful for controlling the open state.\n \n \n isDisabled\n \n boolean\n false\n Whether the tooltip is disabled.\n \n defaultIsOpen\n \n boolean\n false\n If true, the popover will be opened by default.\n \n onOpen\n \n () => void\n true\n This function will be invoked when the tooltip is opened.\n \n \n onClose\n \n () => void\n This function will be invoked when tooltip is closed. It will also be\n called when the user attempts to close the tooltip via Escape key or\n backdrop press.\n \n \n openDelay\n \n number\n Duration in ms to wait till displaying the tooltip.\n \n closeDelay\n \n number\n Duration in ms to wait till hiding the tooltip.\n \n placement\n \n \"bottom\" | \"top\" | \"right\" | \"left\" | \"top left\" | \"top right\" | \"bottom\n left\" | \"bottom right\" | \"right top\" | \"right bottom\" | \"left top\" |\n \"left bottom\"\n \n bottom left\n Tooltip placement\n \n children\n \n any\n The content to display inside the tooltip.\n \n closeOnClick\n \n boolean\n true\n Whether tooltip should be closed on Trigger click.\n \n trigger\n \n () => any\n Function that returns a React Element. This element will be used as a\n Trigger for the tooltip.\n \n \n offset\n \n number\n Distance between the trigger and the tooltip.\n \n crossOffset\n \n number\n The additional offset applied along the cross axis between the element\n and its trigger element.\n \n \n shouldOverlapWithTrigger\n \n boolean\n false\n Determines whether tooltip content should overlap with the trigger.\n \n \n shouldFlip\n \n boolean\n true\n Whether the element should fl",
+    "content": "Tooltip\n\nCreate an intuitive UI using the gluestack-ui Tooltip component in React & React Native. Add hints & tooltips seamlessly.\n\nThis is an illustration of Tooltip component.\n\n return (\n Hover on me!\n \n )\n }}\n >\n Tooltip\n \n \n )\n}`}\n argTypes={{\n \"placement\": {\n \"control\": {\n \"type\": \"select\"\n },\n \"options\": [\n \"top\",\n \"top left\",\n \"top right\",\n \"bottom\",\n \"bottom left\",\n \"bottom right\",\n \"left\",\n \"left top\",\n \"left bottom\",\n \"right\",\n \"right top\",\n \"right bottom\"\n ],\n \"defaultValue\": \"top\"\n\n}}\n reactLive={{ Tooltip, TooltipContent, TooltipText, Button, ButtonText }}\n importMap={{\"@/components/ui/tooltip\":[\"Tooltip\",\"TooltipContent\",\"TooltipText\"],\"@/components/ui/button\":[\"Button\",\"ButtonText\"]}}\n \n/>\n\nInstallation\n\nRun the following command:\n\nNote: At present, we have integrated the for animation. You have the option to remove this and implement your own custom animation wrapper.\n\nStep 1: Install the following dependencies:\n\nStep 2: Copy and paste the following code into your project.\n\nStep 3: Update the import paths to match your project setup.\n\nAPI Reference\n\nTo use this component in your project, include the following import statement in your file.\n\nComponent Props\n\nThis section provides a comprehensive reference list for the component props, detailing descriptions, properties, types, and default behavior for easy project integration.\n\nTooltip\n\nIt inherits all the properties of React Native's View component.\n\n Prop\n Type\n Default\n Description\n \n \n isOp
```

**File**: `src/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-3)
```diff
@@ -5,7 +5,7 @@ description: Troubleshoot common Nativewind issues, including dark mode, Toast i
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -40,7 +40,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -51,10 +51,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
```

**File**: `src/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +66/-85)
```diff
@@ -115,82 +115,64 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `tailwind.config.js`
-
-Ensure your Tailwind config maps the CSS variables to Tailwind classes:
-
-```jsx
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        border: 'rgb(var(--border))',
-        input: 'rgb(var(--input))',
-        ring: 'rgb(var(--ring))',
-        background: 'rgb(var(--background))',
-        foreground: 'rgb(var(--foreground))',
-        primary: {
-          DEFAULT: 'rgb(var(--primary))',
-          foreground: 'rgb(var(--primary-foreground))',
-        },
-        secondary: {
-          DEFAULT: 'rgb(var(--secondary))',
-          foreground: 'rgb(var(--secondary-foreground))',
-        },
-        destructive: {
-          DEFAULT: 'rgb(var(--destructive))',
-        },
-        muted: {
-          DEFAULT: 'rgb(var(--muted))',
-          foreground: 'rgb(var(--muted-foreground))',
-        },
-        accent: {
-          DEFAULT: 'rgb(var(--accent))',
-          foreground: 'rgb(var(--accent-foreground))',
-        },
-        popover: {
-          DEFAULT: 'rgb(var(--popover))',
-          foreground: 'rgb(var(--popover-foreground))',
-        },
-        card: {
-          DEFAULT: 'rgb(var(--card))',
-        },
-      },
-    },
-  },
-};
+#### Step 2: Map tokens to Tailwind in `global.css`
+
+In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+
+```css
+@theme inline {
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
+  --color-background: rgb(var(--background));
+  --color-foreground: rgb(var(--foreground));
+  --color-primary: rgb(var(--primary));
+  --color-primary-foreground: rgb(var(--primary-foreground));
+  --color-secondary: rgb(var(--secondary));
+  --color-secondary-foreground: rgb(var(--secondary-foreground));
+  --color-destructive: rgb(var(--destructive));
+  --color-muted: rgb(var(--muted));
+  --color-muted-foreground: rgb(var(--muted-foreground));
+  --color-accent: rgb(var(--accent));
+  --color-accent-foreground: rgb(var(--accent-foreground));
+  --color-popover: rgb(var(--popover));
+  --color-popover-foreground: rgb(var(--popover-foreground));
+  --color-card: rgb(var(--card));
+}
 ```
 
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-// Primary button
-<Button className="bg-primary text-primary-foreground">
-  <ButtonText>Primary Action</ButtonText>
-</Button>
-
-// Secondary button
-<Button className="bg-secondary text-secondary-foreground">
-  <ButtonText>Secondary Action</ButtonText>
-</Button>
-
-// Card with proper contrast
-<Box className="bg-card border border-border p-4">
-  <Text className="text-foreground">Card content</Text>
-  <Text className="text-muted-foreground">Muted description</Text>
-</Box>
-
-// Destructive action
-<Button className="bg-destructive text-primary-foreground">
-  <ButtonText>Delete</ButtonText>
-</Button>
-
-// With opacity
-<Box className="bg-primary/10">
-  <Text className="text-primary">Subtle primary background</Text>
-</Box>
+<>
+  {/* Primary button */}
+  <Button className="bg-primary text-primary-foreground">
+    <ButtonText>Primary Action</ButtonText>
+  </Button>
+
+  {/* Secondary button */}
+  <Button className="bg-secondary text-secondary-foreground">
+    <ButtonText>Secondary Action</ButtonText>
+  </Button>
+
+  {/* Card with proper contrast */}
+  <Box className="bg-card border border-border p-4">
+    <Text className="text-foreground">Card content</Text>
+    <Text className="text-muted-foreground">Muted description</Text>
+  </Box>
+
+  {/* Destructive action */}
+  <Button className="bg-destructive text-primary-foreground">
+    <ButtonText>Delete</ButtonText>
+  </Button>
+
+  {/* With opacity */}
+  <Box className="bg-primary/10">
+    <Text className="text-primary">Subtle primary background</Text>
+  </Box>
+</>
 ```
 
 ### Adding Custom Tokens
@@ -218,19 +200,15 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-colors: {
-  // ... existing colors
-  success: {
-    DEFAULT: 'rgb(var(--success))',
-    foreground: 'rgb(var(--success-foreground))',
-  },
-  warning: {
-    DEFAULT: 'rgb(var(--warning))',
-    foreground: 'rgb(var(--warning-foreground))',
-  },
+```css
+@theme inline {
+  /* ... existing tokens */
+  --color-success: rgb(var(--success));
+  --color-success-foreground: rgb(var(--success-foreground));
+  --color-warning: rgb(var(--warning));
+  --color-warning-foreground: rgb(var(--warning-foreground));
 }
 ```
 
@@ -253,14 +231,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-fontSize: {
-  'custom-heading-xl': 'var(--font-size-custom)',
+```css
+@theme inline {
+  /* ... existing tokens */
+  --font-size-custom-heading-xl: va
```

---

### Incident Patch 11: `0f4afdf1` (2026-08-10)
**Commit Message**: Merge pull request #3448 from gluestack/fix/v5-docs-and-avatar-size

fix: align docs and examples with v5 component props, add Avatar size…

**File**: `apps/kitchen-sink/app/(home)/components/menu.tsx` (modified, +11/-11)
```diff
@@ -8,7 +8,7 @@ import React from 'react';
 import { UsageVariantFlatList } from '@/components/custom/component-presentation/usage-variant-flatlist';
 
 const ExampleBasic = () => {
-return (
+  return (
     <Menu
       placement="top"
       offset={5}
@@ -18,27 +18,27 @@ return (
           <Button {...triggerProps}>
             <ButtonText>Menu</ButtonText>
           </Button>
-        )
+        );
       }}
     >
       <MenuItem key="Add account" textValue="Add account">
-        <Icon as={AddIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Add account</MenuItemLabel>
+        <Icon as={AddIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Add account</MenuItemLabel>
       </MenuItem>
       <MenuItem key="Community" textValue="Community">
-        <Icon as={GlobeIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Community</MenuItemLabel>
+        <Icon as={GlobeIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Community</MenuItemLabel>
       </MenuItem>
       <MenuItem key="Plugins" textValue="Plugins">
-        <Icon as={PlayIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Plugins</MenuItemLabel>
+        <Icon as={PlayIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Plugins</MenuItemLabel>
       </MenuItem>
       <MenuItem key="Settings" textValue="Settings">
-        <Icon as={SettingsIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Settings</MenuItemLabel>
+        <Icon as={SettingsIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Settings</MenuItemLabel>
       </MenuItem>
     </Menu>
-  )
+  );
 };
 
 const ExampleMenuWithTag = () => {
```

**File**: `src/components/ui/alert/docs/index.mdx` (modified, +2/-12)
```diff
@@ -33,8 +33,6 @@ This is an illustration of **Alert** component.
 <br />
 ## Installation
 
-
-
 <Tabs>
 <TabItem label="CLI">
 ### Run the following command:
@@ -94,20 +92,12 @@ Contains all alert related layout style props and actions. It inherits all the p
       </TableRow>
     </TableHeader>
     <TableBody>
-      <TableRow>
-        <TableCell>
-          <InlineCode>action</InlineCode>
-        </TableCell>
-        <TableCell>error | warning | success | info | muted</TableCell>
-        <TableCell>info</TableCell>
-        <TableCell>Determines the color scheme of the alert.</TableCell>
-      </TableRow>
       <TableRow>
         <TableCell>
           <InlineCode>variant</InlineCode>
         </TableCell>
-        <TableCell>solid | outline</TableCell>
-        <TableCell>solid</TableCell>
+        <TableCell>default | destructive</TableCell>
+        <TableCell>default</TableCell>
         <TableCell>Determines the visual style of the alert.</TableCell>
       </TableRow>
     </TableBody>
```

**File**: `src/components/ui/avatar/docs/index.mdx` (modified, +7/-5)
```diff
@@ -10,7 +10,6 @@ pageDescription: Enhance your UI with our React Native Avatar component. Explore
 showHeader: true
 ---
 
-
 import {
   Table,
   TableHeader,
@@ -23,7 +22,6 @@ import { InlineCode } from '@/docs-components/inline-code';
 import { AnatomyImage } from '@/docs-components/anatomy-image';
 import { Tabs, TabItem } from '@/docs-components/tabs';
 
-
 # Avatar
 
 Enhance your UI with our React Native Avatar component. Explore gluestack's-ui Avatar for seamless design and customization. Check out the docs to add an Avatar component to your app!
@@ -40,12 +38,14 @@ This is an illustration of **Avatar** component.
 <TabItem label="CLI">
 ### Run the following command:
 
-<CodeBlock code={`${process.env.NEXT_PUBLIC_GLUESTACK_COMMAND || 'npx gluestack-ui'} add avatar`} language="bash" />
+<CodeBlock
+  code={`${process.env.NEXT_PUBLIC_GLUESTACK_COMMAND || 'npx gluestack-ui'} add avatar`}
+  language="bash"
+/>
 
 </TabItem>
 <TabItem label="Manual">
 
-
 ### Step 1: Copy and paste the following code into your project.
 
 ```tsx
@@ -138,7 +138,7 @@ Avatar component is created using View component from react-native. It extends a
       <TableCell>
         <InlineCode>size</InlineCode>
       </TableCell>
-      <TableCell>xs | sm | md | lg | xl | 2xl</TableCell>
+      <TableCell>sm | md | lg</TableCell>
       <TableCell>md</TableCell>
       <TableCell>Determines the size of the avatar.</TableCell>
     </TableRow>
@@ -149,6 +149,8 @@ Avatar component is created using View component from react-native. It extends a
 
 The Examples section provides visual representations of the different variants of the component, allowing you to quickly and easily determine which one best fits your needs. Simply copy the code and integrate it into your project.
 
+/// {Example:sizes} ///
+
 /// {Example:with-letters} ///
 
 /// {Example:with-icons} ///
```

**File**: `src/components/ui/avatar/examples/sizes/meta.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "title": "Avatar Sizes",
+  "description": "Use the size prop to change the size of the avatar. Available sizes are sm, md, and lg.",
+  "argTypes": {},
+  "reactLive": {
+    "Avatar": "@/components/ui/avatar",
+    "AvatarFallbackText": "@/components/ui/avatar",
+    "HStack": "@/components/ui/hstack"
+  }
+}
```

**File**: `src/components/ui/avatar/examples/sizes/template.handlebars` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+function Example() {
+  return (
+    <HStack space="lg" className="items-center">
+      <Avatar size="sm">
+        <AvatarFallbackText>JD</AvatarFallbackText>
+      </Avatar>
+      <Avatar size="md">
+        <AvatarFallbackText>JD</AvatarFallbackText>
+      </Avatar>
+      <Avatar size="lg">
+        <AvatarFallbackText>JD</AvatarFallbackText>
+      </Avatar>
+    </HStack>
+  );
+}
\ No newline at end of file
```

**File**: `src/components/ui/avatar/index.tsx` (modified, +48/-13)
```diff
@@ -6,6 +6,8 @@ import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
 import { tva, withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
 const SCOPE = 'AVATAR';
 
+const AvatarSizeContext = React.createContext<'sm' | 'md' | 'lg'>('md');
+
 const UIAvatar = createAvatar({
   Root: withStyleContext(View, SCOPE),
   Badge: View,
@@ -15,19 +17,40 @@ const UIAvatar = createAvatar({
 });
 
 const avatarStyle = tva({
-  base: 'relative flex h-12 w-12 shrink-0 rounded-full bg-muted items-center justify-center group-[.avatar-group]/avatar-group:-ml-2.5',
+  base: 'relative flex shrink-0 rounded-full bg-muted items-center justify-center group-[.avatar-group]/avatar-group:-ml-2.5',
+  variants: {
+    size: {
+      sm: 'h-8 w-8',
+      md: 'h-12 w-12',
+      lg: 'h-16 w-16',
+    },
+  },
 });
 
 const avatarFallbackTextStyle = tva({
-  base: 'text-foreground text-xs font-medium text-transform:uppercase',
+  base: 'text-foreground font-medium text-transform:uppercase',
+  parentVariants: {
+    size: {
+      sm: 'text-2xs',
+      md: 'text-xs',
+      lg: 'text-sm',
+    },
+  },
 });
 
 const avatarGroupStyle = tva({
   base: 'group/avatar-group flex-row-reverse relative avatar-group',
 });
 
 const avatarBadgeStyle = tva({
-  base: 'absolute h-3 w-3 rounded-full border-2 border-background right-0 bottom-0 bg-green-500',
+  base: 'absolute rounded-full border-2 border-background right-0 bottom-0 bg-green-500',
+  parentVariants: {
+    size: {
+      sm: 'h-1.5 w-1.5',
+      md: 'h-3 w-3',
+      lg: 'h-3.5 w-3.5',
+    },
+  },
 });
 
 const avatarImageStyle = tva({
@@ -43,14 +66,18 @@ type IAvatarProps = Omit<
 const Avatar = React.forwardRef<
   React.ComponentRef<typeof UIAvatar>,
   IAvatarProps
->(function Avatar({ className, ...props }, ref) {
+>(function Avatar({ className, size = 'md', children, ...props }, ref) {
   return (
-    <UIAvatar
-      ref={ref}
-      {...props}
-      className={avatarStyle({ class: className })}
-      context={{}}
-    />
+    <AvatarSizeContext.Provider value={size}>
+      <UIAvatar
+        ref={ref}
+        {...props}
+        className={avatarStyle({ size, class: className })}
+        context={{}}
+      >
+        {children}
+      </UIAvatar>
+    </AvatarSizeContext.Provider>
   );
 });
 
@@ -61,11 +88,15 @@ const AvatarBadge = React.forwardRef<
   React.ComponentRef<typeof UIAvatar.Badge>,
   IAvatarBadgeProps
 >(function AvatarBadge({ className, ...props }, ref) {
+  const size = React.useContext(AvatarSizeContext);
   return (
     <UIAvatar.Badge
       ref={ref}
       {...props}
-      className={avatarBadgeStyle({ class: className })}
+      className={avatarBadgeStyle({
+        parentVariants: { size },
+        class: className,
+      })}
     />
   );
 });
@@ -78,11 +109,15 @@ const AvatarFallbackText = React.forwardRef<
   React.ComponentRef<typeof UIAvatar.FallbackText>,
   IAvatarFallbackTextProps
 >(function AvatarFallbackText({ className, ...props }, ref) {
+  const size = React.useContext(AvatarSizeContext);
   return (
     <UIAvatar.FallbackText
       ref={ref}
       {...props}
-      className={avatarFallbackTextStyle({ class: className })}
+      className={avatarFallbackTextStyle({
+        parentVariants: { size },
+        class: className,
+      })}
     />
   );
 });
@@ -134,5 +169,5 @@ export {
   AvatarFallback,
   AvatarFallbackText,
   AvatarGroup,
-  AvatarImage
+  AvatarImage,
 };
```

**File**: `src/components/ui/badge/docs/index.mdx` (modified, +2/-18)
```diff
@@ -107,30 +107,14 @@ Badge component is created using View component from react-native. It extends al
     </TableRow>
   </TableHeader>
   <TableBody>
-    <TableRow>
-      <TableCell>
-        <InlineCode>action</InlineCode>
-      </TableCell>
-      <TableCell>error | warning | success | info | muted</TableCell>
-      <TableCell>success</TableCell>
-      <TableCell>Determines the color scheme of the badge.</TableCell>
-    </TableRow>
     <TableRow>
       <TableCell>
         <InlineCode>variant</InlineCode>
       </TableCell>
-      <TableCell>solid | outline</TableCell>
-      <TableCell>solid</TableCell>
+      <TableCell>default | secondary | destructive | outline</TableCell>
+      <TableCell>default</TableCell>
       <TableCell>Determines the visual style of the badge.</TableCell>
     </TableRow>
-    <TableRow>
-      <TableCell>
-        <InlineCode>size</InlineCode>
-      </TableCell>
-      <TableCell>sm | md | lg</TableCell>
-      <TableCell>md</TableCell>
-      <TableCell>Determines the size of the badge.</TableCell>
-    </TableRow>
   </TableBody>
 </Table>
 
```

**File**: `src/components/ui/card/docs/index.mdx` (modified, +3/-11)
```diff
@@ -43,10 +43,10 @@ This is an illustration of **Card** component.
 
 ### Step 1: Copy and paste the following code into index.tsx in your project.
 
-
 ```jsx
 %%-- File: src/components/ui/card/index.tsx --%%
 ```
+
 > Note: **Step 2** is optional and only required if you want to add support for [React Server Components](https://vercel.com/blog/understanding-react-server-components), You can skip this and jump to **Step 3** directly if you don't have this requirement.
 
 ### Step 2(optional): Copy and paste the following code into index.web.tsx in your project.
@@ -66,7 +66,6 @@ This is an illustration of **Card** component.
 </TabItem>
 </Tabs>
 
-
 ## API Reference
 
 To use this component in your project, include the following import statement in your file.
@@ -126,15 +125,8 @@ Renders a `<div />` on web and a `View` on native.
         <TableCell>
           <InlineCode>size</InlineCode>
         </TableCell>
-        <TableCell>sm | md | lg</TableCell>
-        <TableCell>md</TableCell>
-      </TableRow>
-      <TableRow>
-        <TableCell>
-          <InlineCode>variant</InlineCode>
-        </TableCell>
-        <TableCell>elevated | outline | ghost | filled</TableCell>
-        <TableCell>elevated</TableCell>
+        <TableCell>default | sm</TableCell>
+        <TableCell>default</TableCell>
       </TableRow>
     </TableBody>
   </Table>
```

---

### Incident Patch 12: `ebe6e0df` (2026-08-10)
**Commit Message**: fix: align docs and examples with v5 component props, add Avatar size support

- Remove stale size/variant/action props from 8 component docs
- Remove stale size props from menu and form-control examples
- Add missing size/variant docs for radio, tooltip, textarea, toast
- Fix heading default size (md -> lg)
- Add size prop (sm/md/lg) to Avatar with React context propagation

**File**: `apps/kitchen-sink/app/(home)/components/menu.tsx` (modified, +11/-11)
```diff
@@ -8,7 +8,7 @@ import React from 'react';
 import { UsageVariantFlatList } from '@/components/custom/component-presentation/usage-variant-flatlist';
 
 const ExampleBasic = () => {
-return (
+  return (
     <Menu
       placement="top"
       offset={5}
@@ -18,27 +18,27 @@ return (
           <Button {...triggerProps}>
             <ButtonText>Menu</ButtonText>
           </Button>
-        )
+        );
       }}
     >
       <MenuItem key="Add account" textValue="Add account">
-        <Icon as={AddIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Add account</MenuItemLabel>
+        <Icon as={AddIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Add account</MenuItemLabel>
       </MenuItem>
       <MenuItem key="Community" textValue="Community">
-        <Icon as={GlobeIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Community</MenuItemLabel>
+        <Icon as={GlobeIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Community</MenuItemLabel>
       </MenuItem>
       <MenuItem key="Plugins" textValue="Plugins">
-        <Icon as={PlayIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Plugins</MenuItemLabel>
+        <Icon as={PlayIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Plugins</MenuItemLabel>
       </MenuItem>
       <MenuItem key="Settings" textValue="Settings">
-        <Icon as={SettingsIcon} size="sm" className="mr-2 " />
-        <MenuItemLabel size="sm">Settings</MenuItemLabel>
+        <Icon as={SettingsIcon} size="sm" className="mr-2" />
+        <MenuItemLabel>Settings</MenuItemLabel>
       </MenuItem>
     </Menu>
-  )
+  );
 };
 
 const ExampleMenuWithTag = () => {
```

**File**: `src/components/ui/alert/docs/index.mdx` (modified, +2/-12)
```diff
@@ -33,8 +33,6 @@ This is an illustration of **Alert** component.
 <br />
 ## Installation
 
-
-
 <Tabs>
 <TabItem label="CLI">
 ### Run the following command:
@@ -94,20 +92,12 @@ Contains all alert related layout style props and actions. It inherits all the p
       </TableRow>
     </TableHeader>
     <TableBody>
-      <TableRow>
-        <TableCell>
-          <InlineCode>action</InlineCode>
-        </TableCell>
-        <TableCell>error | warning | success | info | muted</TableCell>
-        <TableCell>info</TableCell>
-        <TableCell>Determines the color scheme of the alert.</TableCell>
-      </TableRow>
       <TableRow>
         <TableCell>
           <InlineCode>variant</InlineCode>
         </TableCell>
-        <TableCell>solid | outline</TableCell>
-        <TableCell>solid</TableCell>
+        <TableCell>default | destructive</TableCell>
+        <TableCell>default</TableCell>
         <TableCell>Determines the visual style of the alert.</TableCell>
       </TableRow>
     </TableBody>
```

**File**: `src/components/ui/avatar/docs/index.mdx` (modified, +7/-5)
```diff
@@ -10,7 +10,6 @@ pageDescription: Enhance your UI with our React Native Avatar component. Explore
 showHeader: true
 ---
 
-
 import {
   Table,
   TableHeader,
@@ -23,7 +22,6 @@ import { InlineCode } from '@/docs-components/inline-code';
 import { AnatomyImage } from '@/docs-components/anatomy-image';
 import { Tabs, TabItem } from '@/docs-components/tabs';
 
-
 # Avatar
 
 Enhance your UI with our React Native Avatar component. Explore gluestack's-ui Avatar for seamless design and customization. Check out the docs to add an Avatar component to your app!
@@ -40,12 +38,14 @@ This is an illustration of **Avatar** component.
 <TabItem label="CLI">
 ### Run the following command:
 
-<CodeBlock code={`${process.env.NEXT_PUBLIC_GLUESTACK_COMMAND || 'npx gluestack-ui'} add avatar`} language="bash" />
+<CodeBlock
+  code={`${process.env.NEXT_PUBLIC_GLUESTACK_COMMAND || 'npx gluestack-ui'} add avatar`}
+  language="bash"
+/>
 
 </TabItem>
 <TabItem label="Manual">
 
-
 ### Step 1: Copy and paste the following code into your project.
 
 ```tsx
@@ -138,7 +138,7 @@ Avatar component is created using View component from react-native. It extends a
       <TableCell>
         <InlineCode>size</InlineCode>
       </TableCell>
-      <TableCell>xs | sm | md | lg | xl | 2xl</TableCell>
+      <TableCell>sm | md | lg</TableCell>
       <TableCell>md</TableCell>
       <TableCell>Determines the size of the avatar.</TableCell>
     </TableRow>
@@ -149,6 +149,8 @@ Avatar component is created using View component from react-native. It extends a
 
 The Examples section provides visual representations of the different variants of the component, allowing you to quickly and easily determine which one best fits your needs. Simply copy the code and integrate it into your project.
 
+/// {Example:sizes} ///
+
 /// {Example:with-letters} ///
 
 /// {Example:with-icons} ///
```

**File**: `src/components/ui/avatar/examples/sizes/meta.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "title": "Avatar Sizes",
+  "description": "Use the size prop to change the size of the avatar. Available sizes are sm, md, and lg.",
+  "argTypes": {},
+  "reactLive": {
+    "Avatar": "@/components/ui/avatar",
+    "AvatarFallbackText": "@/components/ui/avatar",
+    "HStack": "@/components/ui/hstack"
+  }
+}
```

**File**: `src/components/ui/avatar/examples/sizes/template.handlebars` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+function Example() {
+  return (
+    <HStack space="lg" className="items-center">
+      <Avatar size="sm">
+        <AvatarFallbackText>JD</AvatarFallbackText>
+      </Avatar>
+      <Avatar size="md">
+        <AvatarFallbackText>JD</AvatarFallbackText>
+      </Avatar>
+      <Avatar size="lg">
+        <AvatarFallbackText>JD</AvatarFallbackText>
+      </Avatar>
+    </HStack>
+  );
+}
\ No newline at end of file
```

**File**: `src/components/ui/avatar/index.tsx` (modified, +48/-13)
```diff
@@ -6,6 +6,8 @@ import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
 import { tva, withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
 const SCOPE = 'AVATAR';
 
+const AvatarSizeContext = React.createContext<'sm' | 'md' | 'lg'>('md');
+
 const UIAvatar = createAvatar({
   Root: withStyleContext(View, SCOPE),
   Badge: View,
@@ -15,19 +17,40 @@ const UIAvatar = createAvatar({
 });
 
 const avatarStyle = tva({
-  base: 'relative flex h-12 w-12 shrink-0 rounded-full bg-muted items-center justify-center group-[.avatar-group]/avatar-group:-ml-2.5',
+  base: 'relative flex shrink-0 rounded-full bg-muted items-center justify-center group-[.avatar-group]/avatar-group:-ml-2.5',
+  variants: {
+    size: {
+      sm: 'h-8 w-8',
+      md: 'h-12 w-12',
+      lg: 'h-16 w-16',
+    },
+  },
 });
 
 const avatarFallbackTextStyle = tva({
-  base: 'text-foreground text-xs font-medium text-transform:uppercase',
+  base: 'text-foreground font-medium text-transform:uppercase',
+  parentVariants: {
+    size: {
+      sm: 'text-2xs',
+      md: 'text-xs',
+      lg: 'text-sm',
+    },
+  },
 });
 
 const avatarGroupStyle = tva({
   base: 'group/avatar-group flex-row-reverse relative avatar-group',
 });
 
 const avatarBadgeStyle = tva({
-  base: 'absolute h-3 w-3 rounded-full border-2 border-background right-0 bottom-0 bg-green-500',
+  base: 'absolute rounded-full border-2 border-background right-0 bottom-0 bg-green-500',
+  parentVariants: {
+    size: {
+      sm: 'h-1.5 w-1.5',
+      md: 'h-3 w-3',
+      lg: 'h-3.5 w-3.5',
+    },
+  },
 });
 
 const avatarImageStyle = tva({
@@ -43,14 +66,18 @@ type IAvatarProps = Omit<
 const Avatar = React.forwardRef<
   React.ComponentRef<typeof UIAvatar>,
   IAvatarProps
->(function Avatar({ className, ...props }, ref) {
+>(function Avatar({ className, size = 'md', children, ...props }, ref) {
   return (
-    <UIAvatar
-      ref={ref}
-      {...props}
-      className={avatarStyle({ class: className })}
-      context={{}}
-    />
+    <AvatarSizeContext.Provider value={size}>
+      <UIAvatar
+        ref={ref}
+        {...props}
+        className={avatarStyle({ size, class: className })}
+        context={{}}
+      >
+        {children}
+      </UIAvatar>
+    </AvatarSizeContext.Provider>
   );
 });
 
@@ -61,11 +88,15 @@ const AvatarBadge = React.forwardRef<
   React.ComponentRef<typeof UIAvatar.Badge>,
   IAvatarBadgeProps
 >(function AvatarBadge({ className, ...props }, ref) {
+  const size = React.useContext(AvatarSizeContext);
   return (
     <UIAvatar.Badge
       ref={ref}
       {...props}
-      className={avatarBadgeStyle({ class: className })}
+      className={avatarBadgeStyle({
+        parentVariants: { size },
+        class: className,
+      })}
     />
   );
 });
@@ -78,11 +109,15 @@ const AvatarFallbackText = React.forwardRef<
   React.ComponentRef<typeof UIAvatar.FallbackText>,
   IAvatarFallbackTextProps
 >(function AvatarFallbackText({ className, ...props }, ref) {
+  const size = React.useContext(AvatarSizeContext);
   return (
     <UIAvatar.FallbackText
       ref={ref}
       {...props}
-      className={avatarFallbackTextStyle({ class: className })}
+      className={avatarFallbackTextStyle({
+        parentVariants: { size },
+        class: className,
+      })}
     />
   );
 });
@@ -134,5 +169,5 @@ export {
   AvatarFallback,
   AvatarFallbackText,
   AvatarGroup,
-  AvatarImage
+  AvatarImage,
 };
```

**File**: `src/components/ui/badge/docs/index.mdx` (modified, +2/-18)
```diff
@@ -107,30 +107,14 @@ Badge component is created using View component from react-native. It extends al
     </TableRow>
   </TableHeader>
   <TableBody>
-    <TableRow>
-      <TableCell>
-        <InlineCode>action</InlineCode>
-      </TableCell>
-      <TableCell>error | warning | success | info | muted</TableCell>
-      <TableCell>success</TableCell>
-      <TableCell>Determines the color scheme of the badge.</TableCell>
-    </TableRow>
     <TableRow>
       <TableCell>
         <InlineCode>variant</InlineCode>
       </TableCell>
-      <TableCell>solid | outline</TableCell>
-      <TableCell>solid</TableCell>
+      <TableCell>default | secondary | destructive | outline</TableCell>
+      <TableCell>default</TableCell>
       <TableCell>Determines the visual style of the badge.</TableCell>
     </TableRow>
-    <TableRow>
-      <TableCell>
-        <InlineCode>size</InlineCode>
-      </TableCell>
-      <TableCell>sm | md | lg</TableCell>
-      <TableCell>md</TableCell>
-      <TableCell>Determines the size of the badge.</TableCell>
-    </TableRow>
   </TableBody>
 </Table>
 
```

**File**: `src/components/ui/card/docs/index.mdx` (modified, +3/-11)
```diff
@@ -43,10 +43,10 @@ This is an illustration of **Card** component.
 
 ### Step 1: Copy and paste the following code into index.tsx in your project.
 
-
 ```jsx
 %%-- File: src/components/ui/card/index.tsx --%%
 ```
+
 > Note: **Step 2** is optional and only required if you want to add support for [React Server Components](https://vercel.com/blog/understanding-react-server-components), You can skip this and jump to **Step 3** directly if you don't have this requirement.
 
 ### Step 2(optional): Copy and paste the following code into index.web.tsx in your project.
@@ -66,7 +66,6 @@ This is an illustration of **Card** component.
 </TabItem>
 </Tabs>
 
-
 ## API Reference
 
 To use this component in your project, include the following import statement in your file.
@@ -126,15 +125,8 @@ Renders a `<div />` on web and a `View` on native.
         <TableCell>
           <InlineCode>size</InlineCode>
         </TableCell>
-        <TableCell>sm | md | lg</TableCell>
-        <TableCell>md</TableCell>
-      </TableRow>
-      <TableRow>
-        <TableCell>
-          <InlineCode>variant</InlineCode>
-        </TableCell>
-        <TableCell>elevated | outline | ghost | filled</TableCell>
-        <TableCell>elevated</TableCell>
+        <TableCell>default | sm</TableCell>
+        <TableCell>default</TableCell>
       </TableRow>
     </TableBody>
   </Table>
```

---

### Incident Patch 13: `11990d24` (2026-08-10)
**Commit Message**: fix(docs): update theming docs from tailwind.config.js to NativeWind v5 global.css

Replace all tailwind.config.js theming instructions with the v5 CSS-first
approach using @theme inline in global.css across:
- theme-configuration/customizing-theme
- theme-configuration/dark-mode
- theme-configuration/default-tokens
- guides/more/troubleshooting

**File**: `apps/website/app/ui/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-3)
```diff
@@ -2,7 +2,7 @@ import { CodeBlock } from "@/components/custom/markdown/code-block";
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -37,7 +37,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -48,10 +48,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +66/-85)
```diff
@@ -105,82 +105,64 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `tailwind.config.js`
-
-Ensure your Tailwind config maps the CSS variables to Tailwind classes:
-
-```jsx
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        border: 'rgb(var(--border))',
-        input: 'rgb(var(--input))',
-        ring: 'rgb(var(--ring))',
-        background: 'rgb(var(--background))',
-        foreground: 'rgb(var(--foreground))',
-        primary: {
-          DEFAULT: 'rgb(var(--primary))',
-          foreground: 'rgb(var(--primary-foreground))',
-        },
-        secondary: {
-          DEFAULT: 'rgb(var(--secondary))',
-          foreground: 'rgb(var(--secondary-foreground))',
-        },
-        destructive: {
-          DEFAULT: 'rgb(var(--destructive))',
-        },
-        muted: {
-          DEFAULT: 'rgb(var(--muted))',
-          foreground: 'rgb(var(--muted-foreground))',
-        },
-        accent: {
-          DEFAULT: 'rgb(var(--accent))',
-          foreground: 'rgb(var(--accent-foreground))',
-        },
-        popover: {
-          DEFAULT: 'rgb(var(--popover))',
-          foreground: 'rgb(var(--popover-foreground))',
-        },
-        card: {
-          DEFAULT: 'rgb(var(--card))',
-        },
-      },
-    },
-  },
-};
+#### Step 2: Map tokens to Tailwind in `global.css`
+
+In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+
+```css
+@theme inline {
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
+  --color-background: rgb(var(--background));
+  --color-foreground: rgb(var(--foreground));
+  --color-primary: rgb(var(--primary));
+  --color-primary-foreground: rgb(var(--primary-foreground));
+  --color-secondary: rgb(var(--secondary));
+  --color-secondary-foreground: rgb(var(--secondary-foreground));
+  --color-destructive: rgb(var(--destructive));
+  --color-muted: rgb(var(--muted));
+  --color-muted-foreground: rgb(var(--muted-foreground));
+  --color-accent: rgb(var(--accent));
+  --color-accent-foreground: rgb(var(--accent-foreground));
+  --color-popover: rgb(var(--popover));
+  --color-popover-foreground: rgb(var(--popover-foreground));
+  --color-card: rgb(var(--card));
+}
 ```
 
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-// Primary button
-<Button className="bg-primary text-primary-foreground">
-  <ButtonText>Primary Action</ButtonText>
-</Button>
-
-// Secondary button
-<Button className="bg-secondary text-secondary-foreground">
-  <ButtonText>Secondary Action</ButtonText>
-</Button>
-
-// Card with proper contrast
-<Box className="bg-card border border-border p-4">
-  <Text className="text-foreground">Card content</Text>
-  <Text className="text-muted-foreground">Muted description</Text>
-</Box>
-
-// Destructive action
-<Button className="bg-destructive text-primary-foreground">
-  <ButtonText>Delete</ButtonText>
-</Button>
-
-// With opacity
-<Box className="bg-primary/10">
-  <Text className="text-primary">Subtle primary background</Text>
-</Box>
+<>
+  {/* Primary button */}
+  <Button className="bg-primary text-primary-foreground">
+    <ButtonText>Primary Action</ButtonText>
+  </Button>
+
+  {/* Secondary button */}
+  <Button className="bg-secondary text-secondary-foreground">
+    <ButtonText>Secondary Action</ButtonText>
+  </Button>
+
+  {/* Card with proper contrast */}
+  <Box className="bg-card border border-border p-4">
+    <Text className="text-foreground">Card content</Text>
+    <Text className="text-muted-foreground">Muted description</Text>
+  </Box>
+
+  {/* Destructive action */}
+  <Button className="bg-destructive text-primary-foreground">
+    <ButtonText>Delete</ButtonText>
+  </Button>
+
+  {/* With opacity */}
+  <Box className="bg-primary/10">
+    <Text className="text-primary">Subtle primary background</Text>
+  </Box>
+</>
 ```
 
 ### Adding Custom Tokens
@@ -208,19 +190,15 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-colors: {
-  // ... existing colors
-  success: {
-    DEFAULT: 'rgb(var(--success))',
-    foreground: 'rgb(var(--success-foreground))',
-  },
-  warning: {
-    DEFAULT: 'rgb(var(--warning))',
-    foreground: 'rgb(var(--warning-foreground))',
-  },
+```css
+@theme inline {
+  /* ... existing tokens */
+  --color-success: rgb(var(--success));
+  --color-success-foreground: rgb(var(--success-foreground));
+  --color-warning: rgb(var(--warning));
+  --color-warning-foreground: rgb(var(--warning-foreground));
 }
 ```
 
@@ -243,14 +221,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-fontSize: {
-  'custom-heading-xl': 'var(--font-size-custom)',
+```css
+@theme inline {
+  /* ... existing tokens */
+  --font-size-custom-heading-xl: va
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +11/-40)
```diff
@@ -14,32 +14,26 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v4/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, define the color token in your `tailwind.config.js` file and assign a variable value as shown below, following Tailwind's recommendation for [using CSS variables in Tailwind](https://tailwindcss.com/docs/customizing-colors#using-css-variables).
+1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
 
-```js
-// tailwind.config.js
-
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        primary: 'rgb(var(--color-primary)/<alpha-value>)',
-      },
-    },
-  },
-};
+```css
+/* global.css */
+@theme inline {
+  --color-primary: rgb(var(--color-primary));
+}
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
 
 ```js
 // config.ts
+import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,32 +109,9 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. To use dark mode, we need to change the `darkMode` strategy to `"class"` for the web and `"media"` for native devices in the `tailwind.config.js` file. You can achieve this by setting the `DARK_MODE` environment variable as shown below.
-
-```js
-// tailwind.config.js
-
-module.exports = {
-  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : 'media',
-  // rest of the config
-};
-```
-
-After this, we need to update our scripts in the `package.json` file as shown below:
-
-```json
-{
-  "scripts": {
-    "android": "DARK_MODE=media expo start --android",
-    "ios": "DARK_MODE=media expo start --ios",
-    "web": "DARK_MODE=class expo start --web"
-  }
-}
-```
-
-For Next.js projects, you can directly set the `darkMode` strategy to `"class"` without needing to change the scripts.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
 
-> Note: This is a temporary solution until we fix the issue with nativewind for the `darkMode:"class"` strategy.
+For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
 
 ## Persist Color Mode
 
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +35/-9)
```diff
@@ -72,11 +72,13 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-// Full opacity
-<Box className="bg-primary" />
+<>
+  {/* Full opacity — bg-primary (100% opacity) */}
+  <Box className="bg-primary" />
 
-// 50% opacity
-<Box className="bg-primary/50" />
+  {/* 50% opacity — bg-primary/50 */}
+  <Box className="bg-primary/50" />
+</>
 ```
 
 ### Benefits of This System
@@ -86,21 +88,45 @@ Usage with opacity:
 3. **Guaranteed contrast** - Foreground tokens ensure readable text
 4. **Design system consistency** - Follows industry-standard patterns
 
-To customize colors, update `gluestack-ui-provider/config.ts` and `tailwind.config.js`. For detailed instructions, see [Customizing Theme](/ui/docs/home/theme-configuration/customizing-theme).
+To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`. For detailed instructions, see [Customizing Theme](/ui/docs/home/theme-configuration/customizing-theme).
 
 ## Typography
 
-To manage Typography options, update **theme** in `tailwind.config.js`.
+To manage Typography options, add tokens in `global.css` via `@theme inline`.
 
-To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in our `tailwind.config.js`.
+To add or update **Font Family**, use `@theme inline` in `global.css`:
 
-To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `tailwind.config.js` with a value of '**10px**'.
+```css
+@theme inline {
+  --font-family-roboto: 'Roboto', sans-serif;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
+
+To add or update **font sizes**, use `@theme inline` in `global.css`:
+
+```css
+@theme inline {
+  --font-size-2xs: 10px;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `tailwind.config.js` with a value of '**950**'.
+To add or update **font weights**, use `@theme inline` in `global.css`:
+
+```css
+@theme inline {
+  --font-weight-extrablack: 950;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
 
 <FontWeightComponent />
 
```

**File**: `apps/website/public/llms-full.txt` (modified, +143/-160)
```diff
@@ -2284,14 +2284,16 @@ const RootComponent = withStyleContext(View, SCOPE);
 const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
 const AnimatedView = Animated.createAnimatedComponent(View);
 
+const StyledAnimatedPressable = styled(AnimatedPressable, { className: 'style' });
+
 const UIAccessibleAlertDialog = createAlertDialog({
   Root: RootComponent,
   Body: ScrollView,
   Content: AnimatedView,
   CloseButton: Pressable,
   Header: View,
   Footer: View,
-  Backdrop: AnimatedPressable,
+  Backdrop: StyledAnimatedPressable,
 });
 
 const alertDialogStyle = tva({
@@ -2335,7 +2337,7 @@ const alertDialogFooterStyle = tva({
 const alertDialogBodyStyle = tva({ base: '' });
 
 const alertDialogBackdropStyle = tva({
-  base: 'absolute left-0 top-0 right-0 bottom-0 bg-black/50 web:cursor-default',
+  base: 'absolute left-0 top-0 right-0 bottom-0 bg-[#000]/50 web:cursor-default',
 });
 
 type IAlertDialogProps = React.ComponentPropsWithoutRef<
@@ -26134,6 +26136,10 @@ Create an intuitive UI using the gluestack-ui Tooltip component in React & React
 This is an illustration of **Tooltip** component.
 
 
+
+
+
+
 ```jsx
 function Example() {
   return (
@@ -28002,7 +28008,7 @@ URL: /ui/docs/guides/more/troubleshooting/index
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -28035,7 +28041,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -28046,10 +28052,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
@@ -29582,7 +29590,7 @@ Both engines eliminate `tailwind.config.js` in favor of defining theme tokens di
 ## Automated Upgrade (Recommended)
 
 ```bash
-npx gluestack-ui@alpha upgrade
+npx gluestack-ui@latest upgrade
 ```
 
 The CLI auto-detects your current version and asks which engine to upgrade to:
@@ -29605,7 +29613,7 @@ The CLI auto-detects your current version and asks which engine to upgrade to:
 | Area | Before (NativeWind v4) | After (NativeWind v5) |
 | --- | --- | --- |
 | Tailwind version | `tailwindcss@^3.x` | `tailwindcss@^4.2.0` |
-| NativeWind version | `nativewind@^4.1.23` | `nativewind@^5.0.0-preview.2` |
+| NativeWind version | `nativewind@^4.1.23` | `nativewind@^5.0.0-preview.4` |
 | New package | — | `react-native-css@^3.0.4` |
 | PostCSS config | — | `postcss.config.js` with `@tailwindcss/postcss` |
 | Theme tokens | `tailwind.config.js` | `global.css` via `@layer theme` |
@@ -29616,13 +29624,13 @@ The CLI auto-detects your current version and asks which engine to upgrade to:
 ## Automated CLI Upgrade
 
 ```bash
-npx gluestack-ui@alpha upgrade
+npx gluestack-ui@latest upgrade
 ```
 
 Select **NativeWind v5 (Tailwind CSS v4)**. The CLI will:
 
 1. Pin `lightningcss@1.30.1` in `package.json` overrides/resolutions
-2. Replace `nativewind@^4.x` with `nativewind@^5.0.0-preview.2`, add `react-native-css`
+2. Replace `nativewind@^4.x` with `nativewind@^5.0.0-preview.4`, add `react-native-css`
 3. Upgrade `tailwindcss` to v4, add `@tailwindcss/postcss`
 4. Rewrite `global.css` with Tailwind v4 imports and theme tokens
 5. Create `postcss.config.js`
@@ -29632,7 +29640,7 @@ Select **NativeWind v5 (Tailwind CSS v4)**. The CLI will:
 
 > **After upgrading:** Commit your changes, then re-add components to get NativeWind v5 versions:
 > ```bash
-> npx gluestack-ui@alpha add button accordion modal # all components you use
+> npx gluestack-ui@latest add button accordion modal # all components you use
 > ```
 
 ## Manual Migration to NativeWind v5
@@ -29653,14 +29661,14 @@ Add to `package.json` **before** installing other packages:
 **npm:**
 
 ```bash
-npm install nativewind@^5.0.0-preview.2 react-native-css@^3.0.4 @gluestack-ui/core@^5.0.0-alpha.0 @gluestack-ui/utils@^5.0.1-alpha.0
+npm install nativewind@^5.0.0-preview.4 react-native-css@^3.0.4 @gluestack-ui/core@^5.0.15 @gluestack-ui/utils@^5.0.6
 npm inst
```

**File**: `apps/website/public/search-index.json` (modified, +6/-6)
```diff
@@ -453,7 +453,7 @@
     "id": "ui-docs-components-tooltip",
     "title": "Tooltip",
     "description": "",
-    "content": "Tooltip\n\nCreate an intuitive UI using the gluestack-ui Tooltip component in React & React Native. Add hints & tooltips seamlessly.\n\nThis is an illustration of Tooltip component.\n\n return (\n Hover on me!\n \n )\n }}\n >\n Tooltip\n \n \n )\n}`}\n argTypes={{\n \"placement\": {\n \"control\": {\n \"type\": \"select\"\n },\n \"options\": [\n \"top\",\n \"top left\",\n \"top right\",\n \"bottom\",\n \"bottom left\",\n \"bottom right\",\n \"left\",\n \"left top\",\n \"left bottom\",\n \"right\",\n \"right top\",\n \"right bottom\"\n ],\n \"defaultValue\": \"top\"\n\n}}\n reactLive={{ Tooltip, TooltipContent, TooltipText, Button, ButtonText }}\n importMap={{\"@/components/ui/tooltip\":[\"Tooltip\",\"TooltipContent\",\"TooltipText\"],\"@/components/ui/button\":[\"Button\",\"ButtonText\"]}}\n\n/>\n\nInstallation\n\nRun the following command:\n\nNote: At present, we have integrated the for animation. You have the option to remove this and implement your own custom animation wrapper.\n\nStep 1: Install the following dependencies:\n\nStep 2: Copy and paste the following code into your project.\n\nStep 3: Update the import paths to match your project setup.\n\nAPI Reference\n\nTo use this component in your project, include the following import statement in your file.\n\nComponent Props\n\nThis section provides a comprehensive reference list for the component props, detailing descriptions, properties, types, and default behavior for easy project integration.\n\nTooltip\n\nIt inherits all the properties of React Native's View component.\n\n Prop\n Type\n Default\n Description\n \n \n isOpen\n \n boolean\n false\n Whether the tooltip is opened. Useful for controlling the open state.\n \n \n isDisabled\n \n boolean\n false\n Whether the tooltip is disabled.\n \n defaultIsOpen\n \n boolean\n false\n If true, the popover will be opened by default.\n \n onOpen\n \n () => void\n true\n This function will be invoked when the tooltip is opened.\n \n \n onClose\n \n () => void\n This function will be invoked when tooltip is closed. It will also be\n called when the user attempts to close the tooltip via Escape key or\n backdrop press.\n \n \n openDelay\n \n number\n Duration in ms to wait till displaying the tooltip.\n \n closeDelay\n \n number\n Duration in ms to wait till hiding the tooltip.\n \n placement\n \n \"bottom\" | \"top\" | \"right\" | \"left\" | \"top left\" | \"top right\" | \"bottom\n left\" | \"bottom right\" | \"right top\" | \"right bottom\" | \"left top\" |\n \"left bottom\"\n \n bottom left\n Tooltip placement\n \n children\n \n any\n The content to display inside the tooltip.\n \n closeOnClick\n \n boolean\n true\n Whether tooltip should be closed on Trigger click.\n \n trigger\n \n () => any\n Function that returns a React Element. This element will be used as a\n Trigger for the tooltip.\n \n \n offset\n \n number\n Distance between the trigger and the tooltip.\n \n crossOffset\n \n number\n The additional offset applied along the cross axis between the element\n and its trigger element.\n \n \n shouldOverlapWithTrigger\n \n boolean\n false\n Determines whether tooltip content should overlap with the trigger.\n \n \n shouldFlip\n \n boolean\n true\n Whether the element should fl",
+    "content": "Tooltip\n\nCreate an intuitive UI using the gluestack-ui Tooltip component in React & React Native. Add hints & tooltips seamlessly.\n\nThis is an illustration of Tooltip component.\n\n return (\n Hover on me!\n \n )\n }}\n >\n Tooltip\n \n \n )\n}`}\n argTypes={{\n \"placement\": {\n \"control\": {\n \"type\": \"select\"\n },\n \"options\": [\n \"top\",\n \"top left\",\n \"top right\",\n \"bottom\",\n \"bottom left\",\n \"bottom right\",\n \"left\",\n \"left top\",\n \"left bottom\",\n \"right\",\n \"right top\",\n \"right bottom\"\n ],\n \"defaultValue\": \"top\"\n\n}}\n reactLive={{ Tooltip, TooltipContent, TooltipText, Button, ButtonText }}\n importMap={{\"@/components/ui/tooltip\":[\"Tooltip\",\"TooltipContent\",\"TooltipText\"],\"@/components/ui/button\":[\"Button\",\"ButtonText\"]}}\n \n/>\n\nInstallation\n\nRun the following command:\n\nNote: At present, we have integrated the for animation. You have the option to remove this and implement your own custom animation wrapper.\n\nStep 1: Install the following dependencies:\n\nStep 2: Copy and paste the following code into your project.\n\nStep 3: Update the import paths to match your project setup.\n\nAPI Reference\n\nTo use this component in your project, include the following import statement in your file.\n\nComponent Props\n\nThis section provides a comprehensive reference list for the component props, detailing descriptions, properties, types, and default behavior for easy project integration.\n\nTooltip\n\nIt inherits all the properties of React Native's View component.\n\n Prop\n Type\n Default\n Description\n \n \n isOp
```

**File**: `src/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-3)
```diff
@@ -5,7 +5,7 @@ description: Troubleshoot common Nativewind issues, including dark mode, Toast i
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -40,7 +40,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -51,10 +51,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
```

**File**: `src/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +66/-85)
```diff
@@ -115,82 +115,64 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `tailwind.config.js`
-
-Ensure your Tailwind config maps the CSS variables to Tailwind classes:
-
-```jsx
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        border: 'rgb(var(--border))',
-        input: 'rgb(var(--input))',
-        ring: 'rgb(var(--ring))',
-        background: 'rgb(var(--background))',
-        foreground: 'rgb(var(--foreground))',
-        primary: {
-          DEFAULT: 'rgb(var(--primary))',
-          foreground: 'rgb(var(--primary-foreground))',
-        },
-        secondary: {
-          DEFAULT: 'rgb(var(--secondary))',
-          foreground: 'rgb(var(--secondary-foreground))',
-        },
-        destructive: {
-          DEFAULT: 'rgb(var(--destructive))',
-        },
-        muted: {
-          DEFAULT: 'rgb(var(--muted))',
-          foreground: 'rgb(var(--muted-foreground))',
-        },
-        accent: {
-          DEFAULT: 'rgb(var(--accent))',
-          foreground: 'rgb(var(--accent-foreground))',
-        },
-        popover: {
-          DEFAULT: 'rgb(var(--popover))',
-          foreground: 'rgb(var(--popover-foreground))',
-        },
-        card: {
-          DEFAULT: 'rgb(var(--card))',
-        },
-      },
-    },
-  },
-};
+#### Step 2: Map tokens to Tailwind in `global.css`
+
+In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+
+```css
+@theme inline {
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
+  --color-background: rgb(var(--background));
+  --color-foreground: rgb(var(--foreground));
+  --color-primary: rgb(var(--primary));
+  --color-primary-foreground: rgb(var(--primary-foreground));
+  --color-secondary: rgb(var(--secondary));
+  --color-secondary-foreground: rgb(var(--secondary-foreground));
+  --color-destructive: rgb(var(--destructive));
+  --color-muted: rgb(var(--muted));
+  --color-muted-foreground: rgb(var(--muted-foreground));
+  --color-accent: rgb(var(--accent));
+  --color-accent-foreground: rgb(var(--accent-foreground));
+  --color-popover: rgb(var(--popover));
+  --color-popover-foreground: rgb(var(--popover-foreground));
+  --color-card: rgb(var(--card));
+}
 ```
 
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-// Primary button
-<Button className="bg-primary text-primary-foreground">
-  <ButtonText>Primary Action</ButtonText>
-</Button>
-
-// Secondary button
-<Button className="bg-secondary text-secondary-foreground">
-  <ButtonText>Secondary Action</ButtonText>
-</Button>
-
-// Card with proper contrast
-<Box className="bg-card border border-border p-4">
-  <Text className="text-foreground">Card content</Text>
-  <Text className="text-muted-foreground">Muted description</Text>
-</Box>
-
-// Destructive action
-<Button className="bg-destructive text-primary-foreground">
-  <ButtonText>Delete</ButtonText>
-</Button>
-
-// With opacity
-<Box className="bg-primary/10">
-  <Text className="text-primary">Subtle primary background</Text>
-</Box>
+<>
+  {/* Primary button */}
+  <Button className="bg-primary text-primary-foreground">
+    <ButtonText>Primary Action</ButtonText>
+  </Button>
+
+  {/* Secondary button */}
+  <Button className="bg-secondary text-secondary-foreground">
+    <ButtonText>Secondary Action</ButtonText>
+  </Button>
+
+  {/* Card with proper contrast */}
+  <Box className="bg-card border border-border p-4">
+    <Text className="text-foreground">Card content</Text>
+    <Text className="text-muted-foreground">Muted description</Text>
+  </Box>
+
+  {/* Destructive action */}
+  <Button className="bg-destructive text-primary-foreground">
+    <ButtonText>Delete</ButtonText>
+  </Button>
+
+  {/* With opacity */}
+  <Box className="bg-primary/10">
+    <Text className="text-primary">Subtle primary background</Text>
+  </Box>
+</>
 ```
 
 ### Adding Custom Tokens
@@ -218,19 +200,15 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-colors: {
-  // ... existing colors
-  success: {
-    DEFAULT: 'rgb(var(--success))',
-    foreground: 'rgb(var(--success-foreground))',
-  },
-  warning: {
-    DEFAULT: 'rgb(var(--warning))',
-    foreground: 'rgb(var(--warning-foreground))',
-  },
+```css
+@theme inline {
+  /* ... existing tokens */
+  --color-success: rgb(var(--success));
+  --color-success-foreground: rgb(var(--success-foreground));
+  --color-warning: rgb(var(--warning));
+  --color-warning-foreground: rgb(var(--warning-foreground));
 }
 ```
 
@@ -253,14 +231,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to tailwind.config.js
+#### Step 2: Add to `global.css`
 
-```jsx
-fontSize: {
-  'custom-heading-xl': 'var(--font-size-custom)',
+```css
+@theme inline {
+  /* ... existing tokens */
+  --font-size-custom-heading-xl: va
```

---

### Incident Patch 14: `be060b5d` (2026-07-06)
**Commit Message**: Merge pull request #3431 from gluestack/fix/header-polish

refactor(header): enhance version menu and clean up header layout

**File**: `apps/website/components/page-components/header/MobileSidebarMenu.tsx` (modified, +0/-32)
```diff
@@ -162,38 +162,6 @@ export const headerItems: SidebarSectionProps[] = [
           </svg>
         ),
       },
-      {
-        title: 'LLMs.txt',
-        link: '/llms.txt',
-        logo: (
-          <svg
-            width="22"
-            height="22"
-            fill="none"
-            viewBox="0 0 24 24"
-            xmlns="http://www.w3.org/2000/svg"
-          >
-            <path
-              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM8 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2Zm4-7H8v-2h4v2Zm5-7.5V8h-4V4h2.5L17 5.5Z"
-              fill="#272625"
-            />
-          </svg>
-        ),
-        logoDark: (
-          <svg
-            width="22"
-            height="22"
-            fill="none"
-            viewBox="0 0 24 24"
-            xmlns="http://www.w3.org/2000/svg"
-          >
-            <path
-              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM8 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2Zm4-7H8v-2h4v2Zm5-7.5V8h-4V4h2.5L17 5.5Z"
-              fill="#F6F6F6"
-            />
-          </svg>
-        ),
-      },
       {
         title: 'Support',
         link: '/support',
```

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +112/-104)
```diff
@@ -27,7 +27,7 @@ import { Link } from '@/components/ui/link';
 import { Text } from '@/components/ui/text';
 import { Box } from '@/components/ui/box';
 import { Icon } from '@/components/ui/icon';
-import { Menu as VersionMenu, MenuItem } from '@/components/ui/menu';
+import { Menu as VersionMenu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
 
 const Header = ({
@@ -58,12 +58,13 @@ const Header = ({
       {/* @ts-ignore */}
       <Nav className="items-center justify-center w-full mx-auto py-6">
         <div
-          className={`flex flex-row justify-between items-center  ${pathname?.includes('/ui/docs/')
-            ? 'w-[100%] px-5'
-            : 'w-[85%] max-w-[1440px]'
-            }`}
+          className={`flex flex-row justify-between items-center  ${
+            pathname?.includes('/ui/docs/')
+              ? 'w-[100%] px-5'
+              : 'w-[85%] max-w-[1440px]'
+          }`}
         >
-          <div className="flex flex-row gap-6 items-center shrink-0">
+          <div className="flex flex-row  gap-3 items-center shrink-0">
             <NextLink
               href="/"
               className="no-underline z-1 flex sm:flex-row gap-1 items-center"
@@ -88,35 +89,40 @@ const Header = ({
                     <Text className="font-bold text-foreground text-sm">
                       v5
                     </Text>
-                    <Icon as={ChevronDownIcon} className="w-3 h-3 ml-1 text-foreground" />
+                    <Icon
+                      as={ChevronDownIcon}
+                      className="w-3 h-3 ml-1 text-foreground"
+                    />
                   </Pressable>
                 );
               }}
             >
-              <MenuItem className="min-w-fit px-5 py-2">v5</MenuItem>
+              <MenuItem className="min-w-fit px-5 py-2">
+                <MenuItemLabel>v5</MenuItemLabel>
+              </MenuItem>
               <MenuItem
                 className="min-w-fit px-5 py-2"
                 onPress={() => {
                   window.open('https://v4.gluestack.io', '_blank');
                 }}
               >
-                v4
+                <MenuItemLabel>v4</MenuItemLabel>
               </MenuItem>
               <MenuItem
                 className="min-w-fit px-5 py-2"
                 onPress={() => {
                   window.open('https://v3.gluestack.io', '_blank');
                 }}
               >
-                v3
+                <MenuItemLabel>v3</MenuItemLabel>
               </MenuItem>
               <MenuItem
                 className="min-w-fit px-5 py-2"
                 onPress={() => {
                   window.open('https://v2.gluestack.io', '_blank');
                 }}
               >
-                v2
+                <MenuItemLabel>v2</MenuItemLabel>
               </MenuItem>
             </VersionMenu>
             {/* Desktop: Show Docs and Demo buttons */}
@@ -141,16 +147,6 @@ const Header = ({
                   </span>
                 </div>
               </NextLink>
-              <NextLink
-                className="lg:flex hidden rounded-full px-3 py-1 hover:bg-primary/10 active:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-primary"
-                href="/llms.txt"
-              >
-                <div className="rounded-full flex items-center justify-center">
-                  <span className="leading-normal font-normal text-sm text-foreground/70">
-                    LLMs.txt
-                  </span>
-                </div>
-              </NextLink>
               <ProductDropdown />
               <ResourcesDropdown />
               {!isDocsRoute && (
@@ -167,96 +163,110 @@ const Header = ({
               )}
             </div>
           </div>
-          <div className="flex flex-row xl:gap-10 gap-6 items-center">
+          <div className="flex flex-row xl:gap-10 gap-6 items-center ">
             {/* Desktop: Show full search */}
             <div className="flex items-center justify-center">
               <SearchTrigger />
             </div>
 
-            <NextLink
-              className="sm:flex hidden"
-              aria-label="github link"
-              href="https://github.com/gluestack/gluestack-ui"
-            >
-              <div className="flex flex-row items-center gap-1">
-                <svg
-                  xmlns="http://www.w3.org/2000/svg"
-                  width="24"
-                  height="24"
-                  viewBox="0 0 24 24"
-                  fill="none"
-                  className="h-[16px] w-[16px]"
-                >
-                  <path
-                    d="M12 2C10.6868 2 9.38642 2.25866 8.17317 2.7612C6.95991 3.26375 5.85752 4.00035 4.92893 4.92893C3.05357 6.8043 2 9.34784 2 12C2 16.42 4.87 20.17 8.84 21.5C9.34 21.58 9.5 21.27 9.5 21V19.31C6.73 19.91 6.14 17.97 6.14 17.97C5.68 16.81 5.03 16.5 5.03 16.5C4.12 15.88 5.1 15.9 5.1 15.
```

**File**: `apps/website/public/svg/gluestack_logo.svg` (modified, +20/-22)
```diff
@@ -1,30 +1,28 @@
-<svg width="236" height="28" viewBox="0 0 236 28" fill="none" xmlns="http://www.w3.org/2000/svg">
+<svg width="200" height="28" viewBox="0 0 190 28" fill="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M0 7.66815L9.99991 0.302246V3.77839L0 11.1443V7.66815Z" fill="white"/>
-<path d="M20 7.66815L10.0001 0.302246V3.77839L20 11.1443V7.66815Z" fill="white"/>
+<path d="M19.9999 7.66815L9.99997 0.302246V3.77839L19.9999 11.1443V7.66815Z" fill="white"/>
 <path d="M0 15.6684L9.99991 8.30249V11.7786L0 19.1445V15.6684Z" fill="white"/>
-<path d="M20 15.6684L10.0001 8.30249V11.7786L20 19.1445V15.6684Z" fill="white"/>
-<path d="M5.25049 11.9603L14.0004 5.51514V8.55676L5.25049 15.0019V11.9603Z" fill="white"/>
-<path d="M22.7505 11.9603L14.0006 5.51514V8.55676L22.7505 15.0019V11.9603Z" fill="white"/>
+<path d="M19.9999 15.6684L9.99997 8.30249V11.7786L19.9999 19.1445V15.6684Z" fill="white"/>
+<path d="M5.25024 11.9603L14.0002 5.51514V8.55676L5.25024 15.0019V11.9603Z" fill="white"/>
+<path d="M22.7502 11.9603L14.0003 5.51514V8.55676L22.7502 15.0019V11.9603Z" fill="white"/>
 <path d="M5.25 18.9601L13.9999 12.5149V15.5565L5.25 22.0017V18.9601Z" fill="white"/>
-<path d="M22.75 18.9603L14.0001 12.5151V15.5568L22.75 22.0019V18.9603Z" fill="white"/>
-<rect x="0.000488281" width="27.9999" height="27.9999" rx="1.99999" fill="white"/>
-<rect x="0.000488281" width="27.9999" height="27.9999" rx="1.99999" fill="#181718"/>
-<path d="M6.00049 12.3558L14.0002 6.46313V9.244L6.00049 15.1366V12.3558Z" fill="white"/>
-<path d="M22 12.3558L14.0003 6.46313V9.244L22 15.1366V12.3558Z" fill="white"/>
-<path d="M6.00049 18.7557L14.0002 12.863V15.6439L6.00049 21.5365V18.7557Z" fill="white"/>
-<path d="M22 18.7557L14.0003 12.863V15.6439L22 21.5365V18.7557Z" fill="white"/>
-<path d="M46.792 26.318C45.848 26.318 44.976 26.166 44.176 25.862C43.376 25.558 42.688 25.134 42.112 24.59C41.536 24.062 41.104 23.438 40.816 22.718L43.312 21.686C43.536 22.294 43.944 22.798 44.536 23.198C45.144 23.598 45.888 23.798 46.768 23.798C47.456 23.798 48.072 23.662 48.616 23.39C49.16 23.134 49.592 22.75 49.912 22.238C50.232 21.742 50.392 21.1421 50.392 20.4381V17.5101L50.872 18.0621C50.424 18.8941 49.8 19.5261 49 19.9581C48.216 20.3901 47.328 20.6061 46.336 20.6061C45.136 20.6061 44.056 20.3261 43.096 19.7661C42.136 19.2061 41.376 18.4381 40.816 17.4621C40.272 16.4861 40 15.3901 40 14.1741C40 12.9421 40.272 11.8461 40.816 10.8861C41.376 9.92609 42.128 9.16609 43.072 8.6061C44.016 8.0461 45.096 7.7661 46.312 7.7661C47.304 7.7661 48.184 7.9821 48.952 8.4141C49.736 8.8301 50.376 9.43809 50.872 10.2381L50.512 10.9101V8.0541H53.08V20.4381C53.08 21.5581 52.808 22.558 52.264 23.438C51.736 24.334 51 25.038 50.056 25.55C49.112 26.062 48.024 26.318 46.792 26.318ZM46.648 18.0861C47.368 18.0861 48.008 17.9181 48.568 17.5821C49.128 17.2301 49.568 16.7661 49.888 16.1901C50.224 15.5981 50.392 14.9341 50.392 14.1981C50.392 13.4621 50.224 12.7981 49.888 12.2061C49.552 11.6141 49.104 11.1501 48.544 10.8141C47.984 10.4621 47.352 10.2861 46.648 10.2861C45.912 10.2861 45.256 10.4621 44.68 10.8141C44.104 11.1501 43.648 11.6141 43.312 12.2061C42.992 12.7821 42.832 13.4461 42.832 14.1981C42.832 14.9181 42.992 15.5741 43.312 16.1661C43.648 16.7581 44.104 17.2301 44.68 17.5821C45.256 17.9181 45.912 18.0861 46.648 18.0861Z" fill="#272625"/>
-<path d="M56.2545 21.0381V2.87012H58.9665V21.0381H56.2545Z" fill="#272625"/>
-<path d="M66.7693 21.3261C65.7933 21.3261 64.9373 21.1101 64.2013 20.6781C63.4653 20.2301 62.8893 19.6141 62.4733 18.8301C62.0733 18.0301 61.8733 17.1101 61.8733 16.0701V8.0541H64.5853V15.8301C64.5853 16.4221 64.7053 16.9421 64.9453 17.3901C65.1853 17.8381 65.5213 18.1901 65.9533 18.4461C66.3853 18.6861 66.8813 18.8061 67.4413 18.8061C68.0173 18.8061 68.5213 18.6781 68.9533 18.4221C69.3853 18.1661 69.7213 17.8061 69.9613 17.3421C70.2173 16.8781 70.3453 16.3341 70.3453 15.7101V8.0541H73.0333V21.0381H70.4653V18.4941L70.7533 18.8301C70.4493 19.6301 69.9453 20.2461 69.2413 20.6781C68.5373 21.1101 67.7133 21.3261 66.7693 21.3261Z" fill="#272625"/>
-<path d="M82.2957 21.3261C80.9997 21.3261 79.8477 21.0301 78.8397 20.4381C77.8477 19.8301 77.0717 19.0141 76.5117 17.9901C75.9517 16.9501 75.6717 15.7901 75.6717 14.5101C75.6717 13.1981 75.9517 12.0381 76.5117 11.0301C77.0877 10.0221 77.8557 9.23009 78.8157 8.6541C79.7757 8.0621 80.8637 7.7661 82.0797 7.7661C83.0557 7.7661 83.9277 7.9341 84.6957 8.2701C85.4637 8.6061 86.1117 9.07009 86.6397 9.66209C87.1677 10.2381 87.5677 10.9021 87.8397 11.6541C88.1277 12.4061 88.2717 13.2061 88.2717 14.0541C88.2717 14.2621 88.2637 14.4781 88.2477 14.7021C88.2317 14.9261 88.1997 15.1341 88.1517 15.3261H77.8077V13.1661H86.6157L85.3197 14.1501C85.4797 13.3661 85.4237 12.6701 85.1517 12.0621C84.8957 11.4381 84.4957 10.9501 83.9517 10.5981C83.4237 10.2301 82.7997 10.0461 82.0797 10.0461C81.3597 10.0461 80.7197 10.2301 80.1597 10.5981C79.5997 10.9501 79.1677 11.4621 78.8637 12.1341C78.5597 12.7901 78.4397 13.5901 78.5037 14.5341C78.4237 15.4141 
```

**File**: `apps/website/public/svg/gluestack_logo_dark.svg` (modified, +9/-11)
```diff
@@ -1,4 +1,4 @@
-<svg width="236" height="28" viewBox="0 0 236 28" fill="none" xmlns="http://www.w3.org/2000/svg">
+<svg width="200" height="28" viewBox="0 0 190 28" fill="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M0 7.66815L9.99991 0.302246V3.77839L0 11.1443V7.66815Z" fill="white"/>
 <path d="M20 7.66815L10.0001 0.302246V3.77839L20 11.1443V7.66815Z" fill="white"/>
 <path d="M0 15.6684L9.99991 8.30249V11.7786L0 19.1445V15.6684Z" fill="white"/>
@@ -8,23 +8,21 @@
 <path d="M5.25 18.9601L13.9999 12.5149V15.5565L5.25 22.0017V18.9601Z" fill="white"/>
 <path d="M22.75 18.9603L14.0001 12.5151V15.5568L22.75 22.0019V18.9603Z" fill="white"/>
 <rect x="0.000244141" width="27.9999" height="27.9999" rx="1.99999" fill="white"/>
-<rect x="0.000244141" width="27.9999" height="27.9999" rx="1.99999" fill="white"/>
-<path d="M6.00024 12.3558L14 6.46313V9.244L6.00024 15.1366V12.3558Z" fill="black"/>
-<path d="M21.9998 12.3558L14 6.46313V9.244L21.9998 15.1366V12.3558Z" fill="black"/>
-<path d="M6.00024 18.7557L14 12.863V15.6439L6.00024 21.5365V18.7557Z" fill="black"/>
-<path d="M21.9998 18.7557L14 12.863V15.6439L21.9998 21.5365V18.7557Z" fill="black"/>
+<rect x="0.000244141" width="27.9999" height="27.9999" rx="1.99999" fill="#FEFEFE"/>
+<path d="M6.00024 12.3558L14 6.46313V9.244L6.00024 15.1366V12.3558Z" fill="#121212"/>
+<path d="M21.9998 12.3558L14 6.46313V9.244L21.9998 15.1366V12.3558Z" fill="#121212"/>
+<path d="M6.00024 18.7557L14 12.863V15.6439L6.00024 21.5365V18.7557Z" fill="#121212"/>
+<path d="M21.9998 18.7557L14 12.863V15.6439L21.9998 21.5365V18.7557Z" fill="#121212"/>
 <path d="M46.7917 26.318C45.8477 26.318 44.9757 26.166 44.1757 25.862C43.3757 25.558 42.6877 25.134 42.1117 24.59C41.5358 24.062 41.1038 23.438 40.8158 22.718L43.3117 21.686C43.5357 22.294 43.9437 22.798 44.5357 23.198C45.1437 23.598 45.8877 23.798 46.7677 23.798C47.4557 23.798 48.0717 23.662 48.6157 23.39C49.1597 23.134 49.5917 22.75 49.9117 22.238C50.2317 21.742 50.3917 21.1421 50.3917 20.4381V17.5101L50.8717 18.0621C50.4237 18.8941 49.7997 19.5261 48.9997 19.9581C48.2157 20.3901 47.3277 20.6061 46.3357 20.6061C45.1357 20.6061 44.0557 20.3261 43.0957 19.7661C42.1357 19.2061 41.3758 18.4381 40.8158 17.4621C40.2718 16.4861 39.9998 15.3901 39.9998 14.1741C39.9998 12.9421 40.2718 11.8461 40.8158 10.8861C41.3758 9.92609 42.1277 9.16609 43.0717 8.6061C44.0157 8.0461 45.0957 7.7661 46.3117 7.7661C47.3037 7.7661 48.1837 7.9821 48.9517 8.4141C49.7357 8.8301 50.3757 9.43809 50.8717 10.2381L50.5117 10.9101V8.0541H53.0797V20.4381C53.0797 21.5581 52.8077 22.558 52.2637 23.438C51.7357 24.334 50.9997 25.038 50.0557 25.55C49.1117 26.062 48.0237 26.318 46.7917 26.318ZM46.6477 18.0861C47.3677 18.0861 48.0077 17.9181 48.5677 17.5821C49.1277 17.2301 49.5677 16.7661 49.8877 16.1901C50.2237 15.5981 50.3917 14.9341 50.3917 14.1981C50.3917 13.4621 50.2237 12.7981 49.8877 12.2061C49.5517 11.6141 49.1037 11.1501 48.5437 10.8141C47.9837 10.4621 47.3517 10.2861 46.6477 10.2861C45.9117 10.2861 45.2557 10.4621 44.6797 10.8141C44.1037 11.1501 43.6477 11.6141 43.3117 12.2061C42.9917 12.7821 42.8317 13.4461 42.8317 14.1981C42.8317 14.9181 42.9917 15.5741 43.3117 16.1661C43.6477 16.7581 44.1037 17.2301 44.6797 17.5821C45.2557 17.9181 45.9117 18.0861 46.6477 18.0861Z" fill="#F6F6F6"/>
 <path d="M56.2543 21.0381V2.87012H58.9662V21.0381H56.2543Z" fill="#F6F6F6"/>
 <path d="M66.769 21.3261C65.793 21.3261 64.937 21.1101 64.201 20.6781C63.465 20.2301 62.889 19.6141 62.473 18.8301C62.073 18.0301 61.8731 17.1101 61.8731 16.0701V8.0541H64.585V15.8301C64.585 16.4221 64.705 16.9421 64.945 17.3901C65.185 17.8381 65.521 18.1901 65.953 18.4461C66.385 18.6861 66.881 18.8061 67.441 18.8061C68.017 18.8061 68.521 18.6781 68.953 18.4221C69.385 18.1661 69.721 17.8061 69.961 17.3421C70.217 16.8781 70.345 16.3341 70.345 15.7101V8.0541H73.033V21.0381H70.465V18.4941L70.753 18.8301C70.449 19.6301 69.945 20.2461 69.241 20.6781C68.537 21.1101 67.713 21.3261 66.769 21.3261Z" fill="#F6F6F6"/>
 <path d="M82.2955 21.3261C80.9995 21.3261 79.8475 21.0301 78.8395 20.4381C77.8475 19.8301 77.0715 19.0141 76.5115 17.9901C75.9515 16.9501 75.6715 15.7901 75.6715 14.5101C75.6715 13.1981 75.9515 12.0381 76.5115 11.0301C77.0875 10.0221 77.8555 9.23009 78.8155 8.6541C79.7755 8.0621 80.8635 7.7661 82.0795 7.7661C83.0555 7.7661 83.9275 7.9341 84.6955 8.2701C85.4635 8.6061 86.1115 9.07009 86.6395 9.66209C87.1675 10.2381 87.5675 10.9021 87.8395 11.6541C88.1275 12.4061 88.2715 13.2061 88.2715 14.0541C88.2715 14.2621 88.2635 14.4781 88.2475 14.7021C88.2315 14.9261 88.1995 15.1341 88.1515 15.3261H77.8075V13.1661H86.6155L85.3195 14.1501C85.4795 13.3661 85.4235 12.6701 85.1515 12.0621C84.8955 11.4381 84.4955 10.9501 83.9515 10.5981C83.4235 10.2301 82.7995 10.0461 82.0795 10.0461C81.3595 10.0461 80.7195 10.2301 80.1595 10.5981C79.5995 10.9501 79.1675 11.4621 78.8635 12.1341C78.5595 12.7901 78.4395 13.5901 78.5035 14.5341C78.4235 15.4141 78.5435 16.1821 78.8635 16.8381C79.1995 17.4941 79.6635 18.0061 80.2555 18.3741C80.8635 1
```

---

### Incident Patch 15: `79cf9fe6` (2026-07-01)
**Commit Message**: chore: update Figma UI Kit community file link across documentation and navigation components

**File**: `apps/website/app/ui/docs/home/getting-started/figma-ui-kit/index.mdx` (modified, +2/-2)
```diff
@@ -8,9 +8,9 @@ import { TryItOutNow } from './tryItOutNow';
 
 # Figma UI Kit
 
-The [Figma UI Kit](https://www.figma.com/community/file/1577667149474894602) provides a collection of ready-to-use UI components from the gluestack-ui library. So you can directly use these components in Figma and design your app. The developers won't have a chance to say this is not possible!
+The [Figma UI Kit](https://www.figma.com/community/file/1654085106966764966) provides a collection of ready-to-use UI components from the gluestack-ui library. So you can directly use these components in Figma and design your app. The developers won't have a chance to say this is not possible!
+
 
-<img src="/images/figma-kit.png" />
 
 ## What is included?
 
```

**File**: `apps/website/components/page-components/header/MobileSidebarMenu.tsx` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ export const headerItems: SidebarSectionProps[] = [
       },
       {
         title: 'Figma',
-        link: 'https://www.figma.com/community/file/1577667149474894602/gluestack-ui-v3-0-design-kit',
+        link: 'https://www.figma.com/community/file/1654085106966764966',
         logo: (
           <svg
             xmlns="http://www.w3.org/2000/svg"
```

**File**: `apps/website/components/page-components/header/ResourcesDropdown.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { useState } from 'react';
 
 const SocialLinksOptions = [
   {
-    href: 'https://www.figma.com/community/file/1577667149474894602',
+    href: 'https://www.figma.com/community/file/1654085106966764966',
     title: 'Figma',
     description: 'View our design files and components in Figma.',
     icon: (
```

**File**: `src/docs/home/getting-started/figma-ui-kit/index.mdx` (modified, +2/-2)
```diff
@@ -11,9 +11,9 @@ import { TryItOutNow } from './tryItOutNow';
 
 # Figma UI Kit
 
-The [Figma UI Kit](https://www.figma.com/community/file/1577667149474894602) provides a collection of ready-to-use UI components from the gluestack-ui library. So you can directly use these components in Figma and design your app. The developers won't have a chance to say this is not possible!
+The [Figma UI Kit](https://www.figma.com/community/file/1654085106966764966) provides a collection of ready-to-use UI components from the gluestack-ui library. So you can directly use these components in Figma and design your app. The developers won't have a chance to say this is not possible!
+
 
-<img src="/images/figma-kit.png" />
 
 ## What is included?
 
```

#### Recent Merged Pull Requests:
- **PR #3461** (closed): fix (#3460): add option to disable native select on web (@holyarsenic)
- **PR #3456** (2026-09-02): fix: remove Product Hunt banner from header (@T-Reddappa)
- **PR #3451** (2026-08-19): fix: update landing page components for improved styling and function… (@T-Reddappa)
- **PR #3450** (2026-08-10): fix(modal): enable scroll when content overflows viewport (@T-Reddappa)
- **PR #3449** (2026-08-10): fix: align docs and examples with v5 component props, add Avatar size… (@T-Reddappa)
- **PR #3448** (2026-08-10): fix: align docs and examples with v5 component props, add Avatar size… (@T-Reddappa)
- **PR #3447** (2026-08-10): fix(docs): update theming docs from tailwind.config.js to NativeWind … (@T-Reddappa)
- **PR #3445** (2026-08-06): feat: add Product Hunt banner to website header (@T-Reddappa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
