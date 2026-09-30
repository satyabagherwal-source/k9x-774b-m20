# Forensic Learning Record (Deep Inspection): uber/baseweb

> **Canonical Artifact**: `07_PROJECT_LEARNING/uber-baseweb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/uber/baseweb](https://github.com/uber/baseweb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:28:23.690Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `uber/baseweb`
- **Description**: A React Component library implementing the Base design language
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9008 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.ladle/components.tsx`
```
import * as React from "react";
import { Provider as StyletronProvider } from "styletron-react";
import type { GlobalProvider } from "@ladle/react";
import { Client as Styletron } from "styletron-engine-monolithic";
import {
  LightTheme,
  DarkTheme,
} from "../src/themes/index.js";
import BaseProvider from "../src/helpers/base-provider.js";

const engine = new Styletron();

export const Provider: GlobalProvider = ({
  children,
  globalState,
}) => {
  return (
    <StyletronProvider value={engine}>
      <BaseProvider
        theme={{
          ...(globalState.theme === "dark"
            ? DarkTheme
            : LightTheme),
          direction: globalState.rtl ? "rtl" : "ltr",
        }}
      >
        {children}
      </BaseProvider>
    </StyletronProvider>
  );
};

```

### Core Architecture Module: `documentation-site/@types/just-clone.d.ts`
```
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

declare module "just-clone" {
  function clone<T>(input: T): T;
  export default clone;
}

```

### Core Architecture Module: `documentation-site/@types/just-omit.d.ts`
```
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

declare module "just-omit" {
  function omit<T, U extends keyof T>(obj: T, select: U[]): Omit<T, U>;
  function omit<T, U extends keyof T>(
    obj: T,
    select1: U,
    ...selectn: U[]
  ): Omit<T, U>;
  export default omit;
}

```

### Core Architecture Module: `documentation-site/cheat-sheet.jsx`
```
const outlines = [
  {
    file: "src/a11y/types.ts",
    definitions: [
      {
        name: "ViolationProps",
        lineStart: 9,
        children: [
          { name: "target", lineStart: 10 },
          { name: "violations", lineStart: 11 },
        ],
      },
    ],
  },
  {
    file: "src/accordion/types.ts",
    definitions: [
      {
        name: "AccordionState",
        lineStart: 12,
        children: [{ name: "expanded", lineStart: 13 }],
      },
      {
        name: "PanelState",
        lineStart: 16,
        children: [{ name: "expanded", lineStart: 17 }],
      },
      { name: "StateChangeType", lineStart: 20, children: [] },
      { name: "StateReducer", lineStart: 22, children: [] },
      { name: "PanelStateReducer", lineStart: 28, children: [] },
      {
        name: "AccordionOverrides",
        lineStart: 34,
        children: [
          { name: "Content", lineStart: 35 },
          { name: "ContentAnimationContainer", lineStart: 36 },
          { name: "Header", lineStart: 37 },
          { name: "PanelContainer", lineStart: 38 },
          { name: "Root", lineStart: 39 },
          { name: "ToggleIcon", lineStart: 40 },
          { name: "ToggleIconGroup", lineStart: 41 },
        ],
      },
      {
        name: "PanelOverrides",
        lineStart: 44,
        children: [
          { name: "PanelContainer", lineStart: 45 },
          { name: "Header", lineStart: 46 },
          { name: "ToggleIcon", lineStart: 47 },
          { name: "ToggleIconGroup", lineStart: 48 },
          { name: "Content", lineStart: 49 },
          { name: "ContentAnimationContainer", lineStart: 50 },
        ],
      },
      { name: "OnChangeHandler", lineStart: 53, children: [] },
      { name: "AccordionOnChangeHandler", lineStart: 55, children: [] },
      {
        name: "AccordionProps",
        lineStart: 57,
        children: [
          { name: "accordion", lineStart: 61 },
          { name: "children", lineStart: 63 },
          { name: "disabled", lineStart: 65 },
          { name: "initialState", lineStart: 66 },
          { name: "onChange", lineStart: 69 },
          { name: "overrides", lineStart: 70 },
          { name: "stateReducer", lineStart: 73 },
          { name: "renderAll", lineStart: 78 },
        ],
      },
      {
        name: "StatelessAccordionOnChangeHandler",
        lineStart: 81,
        children: [],
      },
      {
        name: "StatelessAccordionProps",
        lineStart: 86,
        children: [
          { name: "accordion", lineStart: 90 },
          { name: "children", lineStart: 92 },
          { name: "disabled", lineStart: 94 },
          { name: "expanded", lineStart: 96 },
          { name: "onChange", lineStart: 98 },
          { name: "overrides", lineStart: 99 },
          { name: "renderPanelContent", lineStart: 104 },
          { name: "renderAll", lineStart: 109 },
        ],
      },
      { name: "PanelProps", lineStart: 145, children: [] },
      { name: "StatefulPanelContainerProps", lineStart: 160, children: [] },
      { name: "StatefulPanelProps", lineStart: 165, children: [] },
      {
        name: "SharedStylePropsArg",
        lineStart: 167,
        children: [
          { name: "$color", lineStart: 168 },
          { name: "$disabled", lineStart: 169 },
          { name: "$expanded", lineStart: 170 },
          { name: "$size", lineStart: 171 },
          { name: "$isFocusVisible", lineStart: 172 },
        ],
      },
    ],
  },
  {
    file: "src/app-nav-bar/types.ts",
    definitions: [
      {
        name: "AppNavBarOverrides",
        lineStart: 12,
        children: [
          { name: "Root", lineStart: 13 },
          { name: "AppName", lineStart: 14 },
          { name: "DesktopMenu", lineStart: 15 },
          { name: "DesktopMenuContainer", lineStart: 16 },
          { name: "MainMenuItem", lineStart: 17 },
          { name: "PrimaryMenuContainer", lineStart: 18 },
          { name: "ProfileTileContainer", lineStart: 19 },
          { name: "SecondaryMenuContainer", lineStart: 20 },
          { name: "Spacing", lineStart: 21 },
          { name: "SubnavContainer", lineStart: 22 },
          { name: "UserMenuProfileListItem", lineStart: 23 },
          { name: "UserProfileInfoContainer", lineStart: 24 },
          { name: "UserProfilePictureContainer", lineStart: 25 },
          { name: "UserProfileTileContainer", lineStart: 26 },
          { name: "MobileDrawer", lineStart: 28 },
          { name: "MobileMenu", lineStart: 29 },
          { name: "SideMenuButton", lineStart: 30 },
          { name: "UserMenuButton", lineStart: 31 },
          { name: "UserMenu", lineStart: 32 },
        ],
      },
      {
        name: "NavItem",
        lineStart: 35,
        children: [
          { name: "active", lineStart: 36 },
          { name: "icon", lineStart: 38 },
          { name: "info", lineStart: 40 },
          { name: "label", lineStart: 41 },
          { name: "children", lineStart: 42 },
          { name: "navExitIcon", lineStart: 44 },
          { name: "navPosition", lineStart: 45 },
        ],
      },
      {
        name: "UserMenuProps",
        lineStart: 51,
        children: [
          { name: "userItems", lineStart: 52 },
          { name: "username", lineStart: 53 },
          { name: "usernameSubtitle", lineStart: 54 },
          { name: "userImgUrl", lineStart: 55 },
          { name: "onUserItemSelect", lineStart: 56 },
        ],
      },
      { name: "AppNavBarProps", lineStart: 59, children: [] },
    ],
  },
  {
    file: "src/aspect-ratio-box/types.ts",
    definitions: [{ name: "AspectRatioBoxProps", lineStart: 10, children: [] }],
  },
  {
    file: "src/avatar/types.ts",
    definitions: [
      { name: "InitialsStyleProps", lineStart: 9, children: [] },
      {
        name: "AvatarStyleProps",
        lineStart: 10,
        children: [
          { name: "$didImageFailToLoad", lineStart: 11 },
          { name: "$imageLoaded", lineStart: 12 },
          { name: "$size", lineStart: 13 },
        ],
      },
      {
        name: "RootStyleProps",
        lineStart: 15,
        children: [
          { name: "$didImageFailToLoad", lineStart: 16 },
          { name: "$size", lineStart: 17 },
        ],
      },
      { name: "StyleProps", lineStart: 19, children: [] },
      {
        name: "AvatarOverrides",
        lineStart: 21,
        children: [
          { name: "Avatar", lineStart: 22 },
          { name: "Initials", lineStart: 23 },
          { name: "Root", lineStart: 24 },
        ],
      },
      {
        name: "AvatarProps",
        lineStart: 27,
        children: [
          { name: "initials", lineStart: 29 },
          { name: "name", lineStart: 31 },
          { name: "overrides", lineStart: 32 },
          { name: "size", lineStart: 34 },
          { name: "src", lineStart: 36 },
        ],
      },
    ],
  },
  {
    file: "src/badge/types.ts",
    definitions: [
      { name: "Hierarchy", lineStart: 11, children: [] },
      { name: "Shape", lineStart: 12, children: [] },
      { name: "Color", lineStart: 13, children: [] },
      { name: "Placement", lineStart: 14, children: [] },
      { name: "Role", lineStart: 15, children: [] },
      {
        name: "BadgeOverrides",
        lineStart: 17,
        children: [
          { name: "Root", lineStart: 18 },
          { name: "Positioner", lineStart: 19 },
          { name: "Badge", lineStart: 20 },
        ],
      },
      {
        name: "BadgeProps",
        lineStart: 23,
        children: [
          { name: "content", lineStart: 24 },
          { name: "hierarchy", lineStart: 25 },
          { name: "shape", lineStart: 26 },
          { name: "color", lineStart: 27 },
          { name: "placement", lineStart: 28 },
          { name: "hidden", lineStart: 29 },
          { name: "horizontalOffset", lineStart: 30 },
          { name: "verticalOffset", lineStart: 31 },
          { name: "overrides", lineStart: 32 },
          { name: "children", lineStart: 33
```

### Core Architecture Module: `documentation-site/components/align-left-icon.jsx`
```
/* eslint-disable */
// this is a font awesome Icon
// license https://fontawesome.com/license
//

import * as React from "react";

const AlignLeft = (props) => (
  <svg
    width={props.size}
    height={props.size}
    viewBox="0 0 512 512"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      fill={props.color}
      d="M 84 40 L 84 88 L 404 88 L 404 40 L 84 40 z M 84 136 L 84 184 L 484 184 L 484 136 L 84 136 z M 84 232 L 84 280 L 308 280 L 308 232 L 84 232 z M 84 328 L 84 376 L 244 376 L 244 328 L 84 328 z M 84 424 L 84 472 L 356 472 L 356 424 L 84 424 z"
    />
  </svg>
);

export default AlignLeft;

```

### Core Architecture Module: `documentation-site/components/align-right-icon.jsx`
```
/* eslint-disable */
// this is a font awesome Icon
// license https://fontawesome.com/license
//

import * as React from "react";

const AlignLeft = (props) => (
  <svg
    width={props.size}
    height={props.size}
    viewBox="0 0 512 512"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      fill={props.color}
      d="M 108 40 L 108 88 L 428 88 L 428 40 L 108 40 z M 28 136 L 28 184 L 428 184 L 428 136 L 28 136 z M 204 232 L 204 280 L 428 280 L 428 232 L 204 232 z M 268 328 L 268 376 L 428 376 L 428 328 L 268 328 z M 156 424 L 156 472 L 428 472 L 428 424 L 156 424 z"
    />
  </svg>
);

export default AlignLeft;

```

### Core Architecture Module: `documentation-site/components/anchor.jsx`
```
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

import * as React from "react";

import { themedStyled } from "../pages/_app";

const Wrapper = themedStyled("a", ({ $isVisible, $theme }) => ({
  visibility: $isVisible ? "visible" : "hidden",
  color: $theme.colors.primary,
  ":focus": {
    outline: `3px solid ${$theme.colors.accent}`,
    outlineOffset: "1px",
  },
}));

const elementToSize = (element) => {
  switch (element) {
    case "h1":
      return 22;
    case "h2":
      return 18;
    case "h3":
      return 16;
    default:
      return 14;
  }
};

const Anchor = ({ isVisible, slug, element }) => (
  <Wrapper $isVisible={isVisible} href={`#${slug}`}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={elementToSize(element)}
      height={elementToSize(element)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="feather feather-link"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  </Wrapper>
);

export default Anchor;

```

### Core Architecture Module: `documentation-site/components/blog.jsx`
```
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

import * as React from "react";
import { Block } from "baseui/block";
import Head from "next/head";
import { H1 } from "./markdown-elements";
import { themedStyled } from "../pages/_app";

export const Caption = themedStyled("figcaption", ({ $theme }) => ({
  color: $theme.colors.contentSecondary,
  fontFamily: $theme.typography.font100.fontFamily,
  fontSize: $theme.sizing.scale500,
  fontWeight: 300,
  textAlign: "center",
  padding: "4px 4px 0 0",
}));

export const BlogImage = ({ full, alt, caption, src, style }) => (
  <figure style={{ margin: 0 }}>
    <img
      src={src.src}
      alt={alt}
      style={{
        width: "100%",
        height: "auto",
      }}
    />
    {caption ? <Caption>{caption}</Caption> : null}
  </figure>
);

export const Demo = themedStyled("iframe", {
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderTopWidth: 0,
  borderBottomWidth: 0,
  borderTopLeftRadius: "4px",
  borderTopRightRadius: "4px",
  borderBottomRightRadius: "4px",
  borderBottomLeftRadius: "4px",
  height: "500px",
  overflow: "hidden",
  width: "100%",
});

const Tagline = themedStyled("span", ({ $theme }) => ({
  color: $theme.colors.contentSecondary,
  fontFamily: $theme.typography.font100.fontFamily,
  fontSize: $theme.sizing.scale800,
  fontWeight: 300,
}));

const AuthorLink = themedStyled("a", ({ $theme }) => ({
  color: $theme.colors.contentSecondary,
  fontFamily: $theme.typography.font100.fontFamily,
  ":hover": {
    color: $theme.colors.contentPrimary,
  },
  ":focus": {
    outline: `3px solid ${$theme.colors.accent}`,
    textDecoration: "none",
    outlineOffset: "2px",
  },
}));

const ArticleDate = themedStyled("span", ({ $theme }) => ({
  color: $theme.colors.contentSecondary,
}));

export const Meta = ({
  data: {
    title,
    tagline,
    author,
    authorLink,
    date,
    coverImage,
    coverImageWidth,
    coverImageHeight,
    keyWords = [],
  },
}) => (
  <React.Fragment>
    <Head>
      <meta property="og:title" content={title} name="title" />
      <meta property="og:type" content="article" />
      <meta
        property="og:description"
        content={tagline}
        key="description"
        name="description"
      />
      <meta property="article:author" content={author} name="author" />
      {keyWords.map((kw) => (
        <meta property="article:tag" content={kw} key={`article:tag:${kw}`} />
      ))}
      <meta
        property="article:published_time"
        content={new Date(date).toISOString()}
      />
      <meta property="og:image" content={coverImage} />
      {/* Best practice to specify these, but will usually work regardless. Ideal dimensions are 1200x630. */}
      {coverImageWidth ? (
        <meta property="og:image:width" content={coverImageWidth} />
      ) : null}
      {coverImageHeight ? (
        <meta property="og:image:height" content={coverImageHeight} />
      ) : null}
    </Head>
    <Block
      overrides={{
        Block: {
          style: ({ $theme }) => ({
            marginBottom: $theme.sizing.scale1400,
          }),
        },
      }}
    >
      <H1>{title}</H1>
      <Tagline>{tagline}</Tagline>
      <Block
        overrides={{
          Block: {
            style: ({ $theme }) => ({
              color: $theme.colors.contentSecondary,
              fontFamily: $theme.typography.font100.fontFamily,
              margin: `${$theme.sizing.scale400} 0`,
            }),
          },
        }}
      >
        <AuthorLink
          $as={authorLink ? "a" : "span"}
          rel="noopener noreferrer"
          target="_blank"
          href={authorLink ? authorLink : "/"}
        >
          {author}
        </AuthorLink>{" "}
        <ArticleDate> - {date}</ArticleDate>
      </Block>
    </Block>
  </React.Fragment>
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2078** (2019-10-12): **bug(styletron): updates dependency to 5.2.2**
  *Symptoms*: we updated the peer dep, but did not include internal dependency
  **Post-Mortem & Fix Analysis**:
  >  This pull request is being automatically deployed with ZEIT Now ([learn more](https://zeit.co/docs/v2/integrations/now-for-github?utm_source=automated&utm_medium=github&utm_campaign=now_bot)). To see the status of your deployment, click below or on the icon next to each commit.    🔍 Inspect: https://zeit.co/uber-ui-platform/baseweb/jkystx8u1   🌍 Preview: https://baseweb-git-update-styletron-react.uber-ui-platform.now.sh   	

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

### Incident Patch 1: `e4669834` (2026-09-06)
**Commit Message**: fix: highlight BottomNavigation overflow selector for the first overflow item

isActive={displayOverflow || activeKey > 4} was off-by-one: when
navItems.length > 5, only indices 0-3 get their own Selector (MAX_SELECTORS - 1
of them), so index 4 is already only reachable via the overflow "More"
selector/panel, but activeKey > 4 required index 5 before the More tab
lit up. Use activeKey >= MAX_SELECTORS - 1 to match the actual cutoff.

**File**: `src/bottom-navigation/bottom-navigation.tsx` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ const BottomNavigation = ({
       title="More"
       icon={Overflow}
       onChange={() => setDisplayOverflow(true)}
-      isActive={displayOverflow || activeKey > 4}
+      isActive={displayOverflow || activeKey >= MAX_SELECTORS - 1}
       overrides={{ Title: overrides.OverflowTitle, Selector: overrides.OverflowSelector }}
       key={'more'}
     />
```

---

### Incident Patch 2: `e140c933` (2026-09-06)
**Commit Message**: fix: preserve injected aria-checked/role when child sets overrides.BaseButton

ButtonGroup spread `...child.props.overrides` after its own injected
`overrides.BaseButton`, so a child that also set `overrides.BaseButton`
(even for unrelated props like `style`) replaced the whole object and
silently dropped the `aria-checked`/`role` ButtonGroup relies on for
radio/checkbox semantics. Merge the child's BaseButton override on top
of the injected one instead of replacing it wholesale.

**File**: `src/button-group/button-group.tsx` (modified, +3/-2)
```diff
@@ -138,7 +138,9 @@ export default class ButtonGroup extends React.Component<ButtonGroupProps> {
                 shape,
                 size,
                 overrides: {
+                  ...child.props.overrides,
                   BaseButton: {
+                    ...child.props.overrides?.BaseButton,
                     props: {
                       ...(typeof child.props['aria-checked'] === 'boolean'
                         ? {
@@ -153,10 +155,9 @@ export default class ButtonGroup extends React.Component<ButtonGroupProps> {
                           : !isSimpleClickableBtnGroup
                           ? 'checkbox'
                           : undefined,
+                      ...child.props.overrides?.BaseButton?.props,
                     },
                   },
-
-                  ...child.props.overrides,
                 },
               });
             })}
```

---

### Incident Patch 3: `a035f38f` (2026-09-17)
**Commit Message**: docs: fix DURATION.infinite reference and typos in docs

- snackbar: DURATION.inifinite -> DURATION.infinite (matches the exported constant)
- seo guide: "should we wrapped" -> "should be wrapped"
- remove doubled words ("from from", "to to")
- fix spelling: below, greatly, components, necessary, positioned,
  every time, Location, palette, similarly, wherever, situations, each other

**File**: `documentation-site/pages/blog/drag-and-drop-list/index.mdx` (modified, +1/-1)
```diff
@@ -214,7 +214,7 @@ On the other hand, we use
 transition: 0.3s cubic-bezier(0.2, 1, 0.1, 1);
 ```
 
-bellow to make the item fly back which gives user a nice additional feedback:
+below to make the item fly back which gives user a nice additional feedback:
 
 <BlogImage
   src="https://res.cloudinary.com/flycatcher/image/upload/v1572410952/drop2_vamnka.gif"
```

**File**: `documentation-site/pages/blog/nested-overrides-playground/index.mdx` (modified, +3/-3)
```diff
@@ -56,15 +56,15 @@ How can you tell that `Text` is the right override that targets the tag's conten
 
 ## Playground
 
-That's where the interactive playground at the top of each component page can greately help! (powered by [react-view](https://github.com/uber/react-view))
+That's where the interactive playground at the top of each component page can greatly help! (powered by [react-view](https://github.com/uber/react-view))
 
 <LiveEditorTag />
 
 Once you open the `Style Overrides` tab, you see the list of all available override identifiers. You can toggle them to visually highlight the related component part and change its styles as needed. At the same time, the code snippet is automatically updated so you can copy&paste the resulting output into your project without typing a single line of code.
 
 ## Nested Overrides
 
-Most of our compontents represent basic UI pieces: buttons, links, inputs or tags. However, some are more complex like [Date Picker](/components/datepicker) or [Select](/components/select). They provide a rich functionality and compose other existing Base Web components. We say that they have nested components. For example, Select nests these components:
+Most of our components represent basic UI pieces: buttons, links, inputs or tags. However, some are more complex like [Date Picker](/components/datepicker) or [Select](/components/select). They provide a rich functionality and compose other existing Base Web components. We say that they have nested components. For example, Select nests these components:
 
 - Icon
 - Spinner
@@ -89,7 +89,7 @@ So what if you want to customize Tag's color and corners as a part of the multiv
 
 While this recursive structure should be logical if you fully understand the concept of overrides, it might be a head scratcher at the beginning. We also did not provide a good individualized documentation for each instance when nested overrides are needed.
 
-This changes today! Our interactive playground now fully supports nested overrides and gets recursive when neccessary. This is a simplified playground for the Select component demonstrating the nested Tag style override:
+This changes today! Our interactive playground now fully supports nested overrides and gets recursive when necessary. This is a simplified playground for the Select component demonstrating the nested Tag style override:
 
 <LiveEditor />
 
```

**File**: `documentation-site/pages/components/combobox.mdx` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ text. Use this example as a reference if the options are known to the applicatio
   <FilteredOptions />
 </Example>
 
-Applications will often need to fetch suggestions from from a remote API. The example below shows how to make
+Applications will often need to fetch suggestions from a remote API. The example below shows how to make
 asynchronous requests on input change to populate the listbox.
 
 <Example title="Async options" path="combobox/async-options.tsx">
```

**File**: `documentation-site/pages/components/fixed-marker.mdx` (modified, +2/-2)
```diff
@@ -49,7 +49,7 @@ For more information on the design principles behind the Base map markers, pleas
   - The `small` can only have an icon as a content.
   - The `mediumText` can have a text content. It adds padding to the sides.
   - The `mediumIcon` can have an icon as a content. Displayed as a circle.
-- A fixed marker can have a label enhancer that can be poistioned at the `top`, `bottom`, `left`, `right` of the marker.
+- A fixed marker can have a label enhancer that can be positioned at the `top`, `bottom`, `left`, `right` of the marker.
 
 ### Start/End Enhancer sizing
 
@@ -135,7 +135,7 @@ A fixed map marker rendered inside of a [react-map-gl](https://visgl.github.io/r
   <ReactMapGLDragging />
 </Example>
 
-A draggable fixed map marker rendered inside of a [react-map-gl](https://visgl.github.io/react-map-gl/) view. Everytime the marker is dragged, the `dragging` prop is updated and the marker position is updated.
+A draggable fixed map marker rendered inside of a [react-map-gl](https://visgl.github.io/react-map-gl/) view. Every time the marker is dragged, the `dragging` prop is updated and the marker position is updated.
 
 <Exports
   component={FixedMarkerExports}
```

**File**: `documentation-site/pages/components/location-puck.mdx` (modified, +1/-1)
```diff
@@ -92,6 +92,6 @@ A consumer location puck rendered in a [react-map-gl](https://visgl.github.io/re
 
 <Exports
   component={LocationPuckExports}
-  title="Loction Puck exports"
+  title="Location Puck exports"
   path="baseui/map-marker"
 />
```

---

### Incident Patch 4: `f30c15e1` (2026-09-04)
**Commit Message**: fix: exclude center-anchored `topEdge/bottomEdge` from Badge `LEFT_PLACEMENTS` (#5408)

* fix: exclude center-anchored topEdge/bottomEdge from Badge LEFT_PLACEMENTS

topEdge and bottomEdge are centered via `left: 50%` + `translateX(-50%)`,
but they were also listed in LEFT_PLACEMENTS. Setting horizontalOffset on
a badge with one of these placements overwrote `left: 50%` while leaving
the translateX(-50%) in place, shifting the badge off-center instead of
nudging it from its centered position. RIGHT_PLACEMENTS already excluded
both, so this brings LEFT_PLACEMENTS in line with that.

* test: add Badge scenario case for topEdge/bottomEdge with horizontalOffset

Visually verifies that horizontalOffset no longer shifts center-anchored
topEdge/bottomEdge badges off-center.

**File**: `src/badge/__tests__/badge.scenario.tsx` (modified, +28/-0)
```diff
@@ -137,6 +137,34 @@ export function Scenario() {
           </Box>
         </Badge>
       </div>
+
+      <div style={layout}>
+        {/* topEdge/bottomEdge are center-anchored (left: 50%, translateX(-50%)).
+            horizontalOffset should have no effect on them and they should stay
+            centered, not drift left. See src/badge/styled-components.ts LEFT_PLACEMENTS. */}
+        <Badge
+          placement={PLACEMENT.topEdge}
+          content="Badge"
+          horizontalOffset="20px"
+          verticalOffset="0"
+        >
+          <Box>
+            <div>topEdge</div>
+            <div>horizontalOffset: 20px (should stay centered)</div>
+          </Box>
+        </Badge>
+        <Badge
+          placement={PLACEMENT.bottomEdge}
+          content="Badge"
+          horizontalOffset="20px"
+          verticalOffset="0"
+        >
+          <Box>
+            <div>bottomEdge</div>
+            <div>horizontalOffset: 20px (should stay centered)</div>
+          </Box>
+        </Badge>
+      </div>
     </div>
   );
 }
```

**File**: `src/badge/styled-components.ts` (modified, +0/-2)
```diff
@@ -209,10 +209,8 @@ const BOTTOM_PLACEMENTS: Placement[] = [
 const LEFT_PLACEMENTS: Placement[] = [
   PLACEMENT.topLeft,
   PLACEMENT.topLeftEdge,
-  PLACEMENT.topEdge,
   PLACEMENT.bottomLeft,
   PLACEMENT.bottomLeftEdge,
-  PLACEMENT.bottomEdge,
   PLACEMENT.leftTopEdge,
   PLACEMENT.leftBottomEdge,
 ];
```

---

### Incident Patch 5: `59417ce2` (2026-09-04)
**Commit Message**: fix: prevent unbounded itemRefs growth and ArrowUp crash in Accordion (#5406)

* fix: prevent unbounded itemRefs growth and ArrowUp crash in Accordion

itemRefs was a plain array that getItems() only ever pushed to on every
render, so refs from earlier renders (nulled out by React once the key's
ref object changes) piled up forever and Home/keyboard nav could target
stale, detached refs after a re-render. Switch to a Map keyed by panel
key so refs are reused/dropped in sync with the current children, and
guard ArrowUp so it no longer indexes itemRefs[-1] when focus is already
on the first panel header.

* test: add e2e regression coverage for Accordion ArrowUp/re-render focus bugs

Covers pressing ArrowUp while focus is already on the first panel header
(previously threw), and keyboard navigation (Home/End) after a re-render
has occurred (previously targeted stale, detached refs).

**File**: `src/accordion/__tests__/accordion.e2e.ts` (modified, +35/-0)
```diff
@@ -91,4 +91,39 @@ test.describe('accordion', () => {
     const firstPanel = await page.$(selectors.collapsed);
     expect(await isSameNode(page, activeEl, firstPanel)).toBe(true);
   });
+
+  test('pressing Arrow Up while on the first panel does not throw and keeps focus in place', async ({
+    page,
+  }) => {
+    const pageErrors: Error[] = [];
+    page.on('pageerror', (error) => pageErrors.push(error));
+
+    await mount(page, 'accordion--accordion');
+
+    await page.keyboard.press('Tab');
+    await page.keyboard.press('ArrowUp');
+
+    const activeEl = await page.evaluateHandle(() => window.document.activeElement);
+    const firstPanel = await page.$(selectors.collapsed);
+    expect(await isSameNode(page, activeEl, firstPanel)).toBe(true);
+    expect(pageErrors).toEqual([]);
+  });
+
+  test('keyboard navigation still targets the right panels after a re-render', async ({ page }) => {
+    await mount(page, 'accordion--accordion');
+
+    await page.keyboard.press('Tab');
+    // Expanding a panel triggers a state change and re-render of the accordion.
+    await page.keyboard.press('Enter');
+
+    await page.keyboard.press('End');
+    const activeEl = await page.evaluateHandle(() => window.document.activeElement);
+    const lastPanel = await page.$(selectors.lastPanel);
+    expect(await isSameNode(page, activeEl, lastPanel)).toBe(true);
+
+    await page.keyboard.press('Home');
+    const activeEl2 = await page.evaluateHandle(() => window.document.activeElement);
+    const firstPanel = await page.$(selectors.expanded);
+    expect(await isSameNode(page, activeEl2, firstPanel)).toBe(true);
+  });
 });
```

**File**: `src/accordion/accordion.tsx` (modified, +14/-9)
```diff
@@ -30,7 +30,7 @@ export default class Accordion extends React.Component<AccordionProps, Accordion
     ...this.props.initialState,
   };
 
-  itemRefs: React.RefObject<HTMLDivElement>[] = [];
+  itemRefs: Map<React.Key, React.RefObject<HTMLDivElement>> = new Map();
 
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   onPanelChange(key: React.Key, onChange: (...args: any[]) => {}, ...args: Array<any>) {
@@ -67,7 +67,7 @@ export default class Accordion extends React.Component<AccordionProps, Accordion
       return;
     }
 
-    const itemRefs = this.itemRefs;
+    const itemRefs = Array.from(this.itemRefs.values());
 
     const HOME = 36;
     const END = 35;
@@ -77,16 +77,16 @@ export default class Accordion extends React.Component<AccordionProps, Accordion
     if (e.keyCode === HOME) {
       e.preventDefault();
       const firstItem = itemRefs[0];
-      firstItem.current && firstItem.current.focus();
+      firstItem && firstItem.current && firstItem.current.focus();
     }
     if (e.keyCode === END) {
       e.preventDefault();
       const lastItem = itemRefs[itemRefs.length - 1];
-      lastItem.current && lastItem.current.focus();
+      lastItem && lastItem.current && lastItem.current.focus();
     }
     if (e.keyCode === ARROW_UP) {
       const activeItemIdx = itemRefs.findIndex((item) => item.current === document.activeElement);
-      if (activeItemIdx >= 0) {
+      if (activeItemIdx > 0) {
         e.preventDefault();
         const prevItem = itemRefs[activeItemIdx - 1];
         prevItem.current && prevItem.current.focus();
@@ -105,15 +105,18 @@ export default class Accordion extends React.Component<AccordionProps, Accordion
   getItems() {
     const { expanded } = this.state;
     const { accordion, disabled, children, renderAll, overrides } = this.props;
+    const nextItemRefs: Map<React.Key, React.RefObject<HTMLDivElement>> = new Map();
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
-    return React.Children.map(children, (child: any, index) => {
+    const items = React.Children.map(children, (child: any, index) => {
       if (!child) return;
 
-      const itemRef = React.createRef<HTMLDivElement>();
-      this.itemRefs.push(itemRef);
-
       // If there is no key provided use the panel order as a default key
       const key = child.key || String(index);
+      // Reuse the ref from the previous render when the key is unchanged, so
+      // panel identity (and focus) is preserved instead of growing unbounded.
+      const itemRef = this.itemRefs.get(key) || React.createRef<HTMLDivElement>();
+      nextItemRefs.set(key, itemRef);
+
       let isExpanded = false;
       if (accordion) {
         isExpanded = expanded[0] === key;
@@ -134,6 +137,8 @@ export default class Accordion extends React.Component<AccordionProps, Accordion
       };
       return React.cloneElement(child, props);
     });
+    this.itemRefs = nextItemRefs;
+    return items;
   }
 
   render() {
```

---

### Incident Patch 6: `cf8bb45c` (2026-04-22)
**Commit Message**: fix: replace dead via.placeholder URL

**File**: `documentation-site/pages/components/menu.mdx` (modified, +2/-2)
```diff
@@ -135,7 +135,7 @@ The provided id will be set as a value for the item container's `id` attribute t
           title: "David Smith",
           subtitle: "Senior Engineering Manager",
           body: "Uber Everything",
-          imgUrl: "https://via.placeholder.com/60x60",
+          imgUrl: "https://placehold.co/60x60",
         }))}
         overrides={{
           ...props.overrides,
@@ -166,7 +166,7 @@ The provided id will be set as a value for the item container's `id` attribute t
                 title: 'David Smith',
                 subtitle: 'Senior Engineering Manager',
                 body: 'Uber Everything',
-                imgUrl: 'https://via.placeholder.com/60x60',
+                imgUrl: 'https://placehold.co/60x60',
               }))}
               overrides={{
                 List: {},
```

---

### Incident Patch 7: `c10b736a` (2026-06-08)
**Commit Message**: Fix/trusted publisher OIDC auth (#5401)

* Correcting trusted publisher setup

**File**: `.github/workflows/release.yml` (modified, +2/-0)
```diff
@@ -45,3 +45,5 @@ jobs:
 
       - name: Publishing next version
         run: ./publish/publish-next.js
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**File**: `publish/publish-next.js` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ const publishNext = () => {
   fs.writeFileSync("./dist/package.json", JSON.stringify(pkgJson, null, 2));
 
   try {
-    execSync("cd dist && npm publish --tag next");
+    execSync("cd dist && npm publish --tag next", { stdio: "inherit" });
   } catch (e) {
     console.log(e);
     console.log("Next publish failed.");
@@ -33,7 +33,7 @@ fetch(`https://registry.npmjs.org/baseui`)
       delete pkgJson.scripts.prepare;
       fs.writeFileSync("./dist/package.json", JSON.stringify(pkgJson, null, 2));
       try {
-        execSync("cd dist && npm publish");
+        execSync("cd dist && npm publish", { stdio: "inherit" });
       } catch (e) {
         console.log(e);
         console.log("Stable publish failed.");
```

---

### Incident Patch 8: `a2c7918c` (2026-04-24)
**Commit Message**: Revert "sync(badge): update from web-code" (#5397)

This reverts commit 153ed0520d4b5af0413583575e81ceab6e5c1d09.

**File**: `documentation-site/examples/badge/hint-dot.tsx` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-import * as React from "react";
-import { HintDot, COLOR } from "baseui/badge";
-import { Skeleton } from "baseui/skeleton";
-
-export default function Example() {
-  return (
-    <HintDot color={COLOR.accent}>
-      <Skeleton width="48px" height="48px" />
-    </HintDot>
-  );
-}
```

**File**: `documentation-site/examples/badge/notification-circle.tsx` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-import * as React from "react";
-import { NotificationCircle, COLOR } from "baseui/badge";
-import { Skeleton } from "baseui/skeleton";
-
-export default function Example() {
-  return (
-    <NotificationCircle content={5} color={COLOR.accent}>
-      <Skeleton width="48px" height="48px" />
-    </NotificationCircle>
-  );
-}
```

**File**: `documentation-site/pages/components/badge.mdx` (modified, +1/-23)
```diff
@@ -11,8 +11,6 @@ import badgeYardConfig from "../../components/yard/config/badge";
 import PrimaryInline from "examples/badge/primary-inline.tsx";
 import SecondaryInline from "examples/badge/secondary-inline.tsx";
 import Offset from "examples/badge/offset.tsx";
-import NotificationCircleExample from "examples/badge/notification-circle.tsx";
-import HintDotExample from "examples/badge/hint-dot.tsx";
 
 export default Layout;
 
@@ -26,7 +24,7 @@ Badge content should generally be 3 words or less.
 
 ## Hierarchy
 
-Primary badges are bright in color to grab a user's attention to an entry point of either a new product/feature, promotion or alert. Another usage is for transit lines. Avoid using multiple primary badges in the same view.
+Primary badges are bright in color to grab a user’s attention to an entry point of either a new product/feature, promotion or alert. Another usage is for transit lines. Avoid using multiple primary badges in the same view.
 
 Secondary badges should be part of the content inside the component. They are often meta data, highlighted information or simplified information.
 
@@ -55,24 +53,4 @@ There may be situations where it makes sense to deviate from the standard badge
 - `horizontalOffset` sets the `right` CSS attribute when `placement` is `topRight` or `bottomRight`. Otherwise it sets the `left` attribute.
 - `verticalOffset` sets the `top` CSS attribute when `placement` is `topLeft`, `top`, or `topRight`. Otherwise it sets the `bottom` attribute.
 
-## NotificationCircle
-
-Use `NotificationCircle` to display a count or icon indicator anchored to an element — for example, an unread message count on a navigation icon.
-
-<Example title="Notification circle" path="badge/notification-circle.tsx">
-  <NotificationCircleExample />
-</Example>
-
-The `content` prop accepts a number, an icon element, or a render prop `(size: number) => ReactNode`. Numbers greater than 99 are automatically clamped to `99+`. Use the `size` prop (`small` or `medium`, defaults to `medium`) to control the circle dimensions. `NotificationCircle` supports `topLeft`, `topRight`, `bottomLeft`, and `bottomRight` placements.
-
-## HintDot
-
-Use `HintDot` to render a small colored dot anchored to an element, drawing attention without conveying specific information.
-
-<Example title="Hint dot" path="badge/hint-dot.tsx">
-  <HintDotExample />
-</Example>
-
-The dot supports `topRight`, `topLeft`, `bottomRight`, and `bottomLeft` placements (defaults to `topRight`). By default a border separates the dot from its anchor; set `hasBorder={false}` to remove it. When no `children` are provided the dot renders inline without an anchor.
-
 <Exports component={BadgeExports} title="Badge exports" path="baseui/badge" />
```

**File**: `src/badge/__tests__/utils.test.tsx` (removed, +0/-42)
```diff
@@ -1,42 +0,0 @@
-import React from 'react';
-import { getAnchorFromChildren } from '../utils';
-
-describe('getAnchorFromChildren', () => {
-  it('returns undefined when no children are provided', () => {
-    expect(getAnchorFromChildren()).toBeUndefined();
-  });
-
-  it('returns the child with id and role when one child is provided', () => {
-    const child = (
-      <div id="test-id" role="button">
-        Child
-      </div>
-    );
-    const result = getAnchorFromChildren(child) as React.ReactElement;
-    expect(result.type).toBe(child.type);
-    expect(result.props.id).toBe('test-id');
-    expect(result.props.role).toBe('button');
-  });
-
-  it('logs an error and returns the first child when multiple children are provided', () => {
-    const child1 = (
-      <div id="test-id" role="button">
-        Child
-      </div>
-    );
-    const child2 = (
-      <div id="test-id-2" role="img">
-        Child
-      </div>
-    );
-    console.error = jest.fn();
-
-    const result = getAnchorFromChildren([child1, child2]) as React.ReactElement;
-    expect(result.type).toBe(child1.type);
-    expect(result.props.id).toBe('test-id');
-    expect(result.props.role).toBe('button');
-    expect(console.error).toHaveBeenCalledWith(
-      `[baseui] No more than 1 child may be passed to Badge, found 2 children`
-    );
-  });
-});
```

**File**: `src/badge/constants.ts` (modified, +1/-7)
```diff
@@ -9,23 +9,17 @@ export const HIERARCHY = Object.freeze({
   secondary: 'secondary',
 });
 
-export const NOTIFICATION_CIRCLE_SIZE = {
-  small: 'small',
-  medium: 'medium',
-} as const;
-
 export const SHAPE = Object.freeze({
   pill: 'pill',
   rectangle: 'rectangle',
 });
 
 export const COLOR = Object.freeze({
   accent: 'accent',
-  primary: 'primary', // deprecated
+  primary: 'primary',
   positive: 'positive',
   negative: 'negative',
   warning: 'warning',
-  onBrand: 'onBrand',
 });
 
 export const PLACEMENT = Object.freeze({
```

---

### Incident Patch 9: `77c2d139` (2026-04-07)
**Commit Message**: [Bug]Fixed ladle ubook scrolling issue + bump node version (#5395)

* [Bug]Fixed ladle ubook scrolling issue + bump node version

* 18.0.0

* bump node version to match with uber internal repo

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "baseui",
-  "version": "17.1.0",
+  "version": "18.0.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "baseui",
-      "version": "17.1.0",
+      "version": "18.0.0",
       "license": "MIT",
       "dependencies": {
         "@date-io/date-fns": "^2.13.1",
```

**File**: `package.json` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "baseui",
-  "version": "17.1.0",
+  "version": "18.0.0",
   "description": "A React Component library implementing the Base design language",
   "keywords": [
     "react",
@@ -70,7 +70,7 @@
     "@babel/template": "^7.22.15",
     "@babel/traverse": "^7.23.6",
     "@babel/types": "^7.23.6",
-    "@ladle/react": "^4.0.2",
+    "@ladle/react": "^4.1.2",
     "@mdx-js/loader": "^3.0.0",
     "@mdx-js/react": "^3.0.0",
     "@next/mdx": "^14.0.4",
@@ -110,7 +110,7 @@
     "provenance": true
   },
   "engines": {
-    "node": ">=18.0.0"
+    "node": ">=24.0.0"
   },
   "pnpm": {
     "peerDependencyRules": {
```

---

### Incident Patch 10: `ce1dc304` (2026-04-03)
**Commit Message**: [datepicker] Add fixes for composed date range selections (#5391)

* [datepicker] Add fixes for composed date range selections

* Add major version

---------

Co-authored-by: Jimmy Li <jimmy.li+UBER@uber.com>

**File**: `documentation-site/examples/datepicker/composed-range-pickers.tsx` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ export default function Example() {
               value={dates[0]}
               onChange={(time) => {
                 if (time) {
-                  if (isAfter(time, dates[1])) {
+                  if (dates[1] && isAfter(time, dates[1])) {
                     setDates([time, time]);
                   } else {
                     setDates([time, dates[1]]);
@@ -108,7 +108,7 @@ export default function Example() {
               value={dates[1]}
               onChange={(time) => {
                 if (time) {
-                  if (isBefore(time, dates[0])) {
+                  if (dates[0] && isBefore(time, dates[0])) {
                     setDates([time, time]);
                   } else {
                     setDates([dates[0], time]);
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "baseui",
-  "version": "16.2.1",
+  "version": "17.0.0",
   "description": "A React Component library implementing the Base design language",
   "keywords": [
     "react",
```

**File**: `src/datepicker/__tests__/calendar.test.tsx` (modified, +64/-0)
```diff
@@ -63,4 +63,68 @@ describe('Component', () => {
     fireEvent.click(await getByText(container.parentElement as any as HTMLElement, 'Past Week'));
     expect(onQuickSelectChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'Past Week' }));
   });
+
+  it('constrains time options when selected date matches minDate', () => {
+    const minDate = new Date('2021-11-10T14:00:00');
+    const value = new Date('2021-11-10T15:00:00');
+    const { container } = render(
+      <TestBaseProvider>
+        <Calendar
+          value={value}
+          minDate={minDate}
+          timeSelectStart
+          overrides={{
+            TimeSelectContainer: { props: { 'data-testid': 'time-select' } },
+          }}
+        />
+      </TestBaseProvider>
+    );
+
+    const timeSelect = queryByTestId(container, 'time-select');
+    expect(timeSelect).not.toBeNull();
+
+    const selectInput = timeSelect!.querySelector('[data-baseweb="select"]');
+    if (selectInput?.firstChild) {
+      fireEvent.click(selectInput.firstChild as HTMLElement);
+    }
+
+    const listbox = container.parentElement!.querySelector('[role="listbox"]');
+    expect(listbox).not.toBeNull();
+    const options = Array.from(listbox!.querySelectorAll('[role="option"]'));
+    const optionTexts = options.map((o) => o.textContent);
+    expect(optionTexts).not.toContain('12:00 PM');
+    expect(optionTexts).toContain('3:00 PM');
+  });
+
+  it('does not constrain time when selected date differs from minDate', () => {
+    const minDate = new Date('2021-11-10T14:00:00');
+    const value = new Date('2021-11-11T10:00:00');
+    const { container } = render(
+      <TestBaseProvider>
+        <Calendar
+          value={value}
+          minDate={minDate}
+          timeSelectStart
+          overrides={{
+            TimeSelectContainer: { props: { 'data-testid': 'time-select' } },
+          }}
+        />
+      </TestBaseProvider>
+    );
+
+    const timeSelect = queryByTestId(container, 'time-select');
+    expect(timeSelect).not.toBeNull();
+
+    const selectInput = timeSelect!.querySelector('[data-baseweb="select"]');
+    if (selectInput?.firstChild) {
+      fireEvent.click(selectInput.firstChild as HTMLElement);
+    }
+
+    const listbox = container.parentElement!.querySelector('[role="listbox"]');
+    expect(listbox).not.toBeNull();
+    const options = Array.from(listbox!.querySelectorAll('[role="option"]'));
+    const optionTexts = options.map((o) => o.textContent);
+    expect(optionTexts).toContain('12:00 AM');
+    expect(optionTexts).toContain('12:00 PM');
+  });
 });
```

**File**: `src/datepicker/__tests__/datepicker-range.test.tsx` (added, +506/-0)
```diff
@@ -0,0 +1,506 @@
+/*
+Copyright (c) Uber Technologies, Inc.
+
+This source code is licensed under the MIT license found in the
+LICENSE file in the root directory of this source tree.
+*/
+import * as React from 'react';
+import MockDate from 'mockdate';
+import { render, fireEvent, queryByTestId, getByText } from '@testing-library/react';
+
+import { TestBaseProvider } from '../../test/test-utils';
+import { Datepicker } from '..';
+import { TimePicker } from '../../timepicker';
+
+function ComposedRangePicker({
+  initialDates = [] as Array<Date | null>,
+  minDate,
+  maxDate,
+  onDatesChange,
+}: {
+  initialDates?: Array<Date | null>;
+  minDate?: Date;
+  maxDate?: Date;
+  onDatesChange?: (dates: Array<Date | null>) => void;
+}) {
+  const [dates, setDates] = React.useState<Array<Date | undefined | null>>(initialDates);
+
+  const update = (next: Array<Date | undefined | null>) => {
+    setDates(next);
+    onDatesChange?.(next as Array<Date | null>);
+  };
+
+  return (
+    <TestBaseProvider>
+      <Datepicker
+        value={dates}
+        onChange={({ date }) => update(date as any)}
+        range
+        displayValueAtRangeIndex={0}
+        mask="9999/99/99"
+        minDate={minDate}
+        maxDate={maxDate}
+        timeSelectStart
+        overrides={{
+          CalendarContainer: { props: { 'data-testid': 'start-calendar' } },
+          TimeSelectContainer: { props: { 'data-testid': 'start-time-select' } },
+        }}
+      />
+      <Datepicker
+        value={dates}
+        onChange={({ date }) => update(date as any)}
+        range
+        displayValueAtRangeIndex={1}
+        mask="9999/99/99"
+        minDate={minDate}
+        maxDate={maxDate}
+        timeSelectEnd
+        overrides={{
+          CalendarContainer: { props: { 'data-testid': 'end-calendar' } },
+          TimeSelectContainer: { props: { 'data-testid': 'end-time-select' } },
+        }}
+      />
+      <button data-testid="clear-btn" onClick={() => update([])}>
+        clear
+      </button>
+      <span data-testid="start-date">{dates[0] ? dates[0].toISOString() : 'null'}</span>
+      <span data-testid="end-date">{dates[1] ? dates[1].toISOString() : 'null'}</span>
+    </TestBaseProvider>
+  );
+}
+
+describe('Composed range datepicker', () => {
+  beforeEach(() => {
+    MockDate.set('2021-11-25 10:30');
+  });
+
+  afterEach(() => {
+    MockDate.reset();
+  });
+
+  it('fires onChange with partial range on first click so parent state updates', () => {
+    const onDatesChange = jest.fn();
+    const { container } = render(<ComposedRangePicker onDatesChange={onDatesChange} />);
+
+    const inputs = container.querySelectorAll('input');
+    fireEvent.focus(inputs[0]);
+
+    const calendar = queryByTestId(container, 'start-calendar');
+    expect(calendar).not.toBeNull();
+
+    fireEvent.click(getByText(calendar!, '15'));
+
+    const lastCall = onDatesChange.mock.calls[onDatesChange.mock.calls.length - 1][0];
+    expect(Array.isArray(lastCall)).toBe(true);
+    expect(lastCall[0]).toBeTruthy();
+    expect(lastCall[0].getDate()).toBe(15);
+  });
+
+  it('popover stays open after first click for second click', () => {
+    const startDate = new Date(2021, 10, 10, 12, 0, 0);
+    const { container } = render(<ComposedRangePicker initialDates={[startDate, null]} />);
+
+    const inputs = container.querySelectorAll('input');
+    fireEvent.focus(inputs[0]);
+
+    expect(queryByTestId(container, 'start-calendar')).not.toBeNull();
+
+    // With value=[Nov10, null], clicking Nov 20 completes the range.
+    const calendar = queryByTestId(container, 'start-calendar')!;
+    fireEvent.click(getByText(calendar, '20'));
+
+    // Both dates set → popover closes
+    expect(queryByTestId(container, 'start-calendar')).toBeNull();
+  });
+
+  it('two-click range selection from cleared state', () => {
+    const onDatesChange = jest.fn();
+    const { container } = render(<ComposedRangePicker onDatesChange={onDatesChange} />)
```

**File**: `src/datepicker/__tests__/datepicker.stories.tsx` (modified, +2/-0)
```diff
@@ -25,6 +25,7 @@ import { Scenario as DatepickerDefault } from './datepicker.scenario';
 import { Scenario as DatepickerTimeScenario } from './datepicker-time.scenario';
 import { Scenario as DatepickersColorStates } from './datepickers-color-states.scenario';
 import { Scenario as DatepickersComposedRange } from './datepickers-composed-range.scenario';
+import { Scenario as DatepickersComposedRangeMinMax } from './datepickers-composed-range-min-max.scenario';
 import { Scenario as DatepickersComposedSingle } from './datepickers-composed-single.scenario';
 import { Scenario as StatefulCalendarOverridesScenario } from './stateful-calendar-overrides.scenario';
 import { Scenario as StatefulCalendarScenario } from './stateful-calendar.scenario';
@@ -54,6 +55,7 @@ export const DatepickerTime = () => <DatepickerTimeScenario />;
 export const OnChangeFlow = () => <DatepickerOnChangeFlow />;
 export const StatefulColorStates = () => <DatepickersColorStates />;
 export const StatefulComposedRange = () => <DatepickersComposedRange />;
+export const StatefulComposedRangeMinMax = () => <DatepickersComposedRangeMinMax />;
 export const StatefulComposedSingle = () => <DatepickersComposedSingle />;
 export const StatefulCalendarOverrides = () => <StatefulCalendarOverridesScenario />;
 export const StatefulCalendar = () => <StatefulCalendarScenario />;
```

#### Recent Merged Pull Requests:
- **PR #5427** (closed): Update theme object to include direction property (@MaddipatlaChetan24)
- **PR #5426** (closed): Add onMouseUp handler to changeHandlers (@MaddipatlaChetan24)
- **PR #5425** (2026-09-22): Update index.jsx (@MaddipatlaChetan24)
- **PR #5422** (2026-09-22): docs: fix DURATION.infinite reference and typos in docs (@toyeshhm)
- **PR #5419** (closed): Refactor badge props to use BaseBadgeProps (@MaddipatlaChetan24)
- **PR #5417** (closed): test(avatar): cover explicit initials prop override (@TruptiAgrawal)
- **PR #5416** (closed): Refactor Knob component styles for performance (@MaddipatlaChetan24)
- **PR #5415** (closed): Update card.tsx (@MaddipatlaChetan24)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
