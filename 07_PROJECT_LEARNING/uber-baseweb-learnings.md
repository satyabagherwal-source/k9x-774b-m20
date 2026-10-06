# Forensic Learning Record (Deep Inspection): uber/baseweb

> **Canonical Artifact**: `07_PROJECT_LEARNING/uber-baseweb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/uber/baseweb](https://github.com/uber/baseweb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:39.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `uber/baseweb`
- **Description**: A React Component library implementing the Base design language
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9009 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `documentation-site/components/hooks.jsx`
```
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

import { useRef, useState, useEffect } from "react";

export function useHover() {
  const [value, setValue] = useState(false);

  const ref = useRef(null);

  const handleMouseOver = () => setValue(true);
  const handleMouseOut = () => setValue(false);

  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener("mouseover", handleMouseOver);
      node.addEventListener("mouseout", handleMouseOut);

      return () => {
        node.removeEventListener("mouseover", handleMouseOver);
        node.removeEventListener("mouseout", handleMouseOut);
      };
    }
  });

  return [ref, value];
}

```

### Core Architecture Module: `documentation-site/components/yard/utils.ts`
```
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

import type { TProp } from "react-view";
import type { TProviderValue } from "./provider";

export type TPropValueOverrides = {
  [key: string]: {
    active: boolean;
    style: string;
  };
};

export const countProps = (
  props: { [key: string]: TProp },
  propsConfig: { [key: string]: TProp },
) => {
  let changedProps = 0;
  Object.keys(props).forEach((prop) => {
    if (
      prop !== "overrides" &&
      props[prop].value !== "" &&
      typeof props[prop].value !== "undefined" &&
      //@ts-ignore
      props[prop].value !== propsConfig[prop].value
    ) {
      changedProps++;
    }
  });
  return changedProps;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const countOverrides = (overrides: any) => {
  if (!overrides) {
    return 0;
  }
  const existingOverrides = overrides.value ? Object.keys(overrides.value) : [];
  return existingOverrides.filter((key) => overrides.value[key].active).length;
};

export const countThemeValues = (themeState: TProviderValue) => {
  if (!themeState) return 0;
  return Object.keys(themeState).length;
};

```

### Core Architecture Module: `documentation-site/examples/accordion/renderpanelcontent.tsx`
```
import * as React from "react";
import { Accordion, Panel } from "baseui/accordion";

const content =
  "Praesent condimentum ante ac ipsum aliquam, ac scelerisque velit sagittis. Ut sit amet libero scelerisque, accumsan ante vitae, hendrerit tellus. Nullam metus est, vehicula a aliquet id, lobortis in mauris.";

export default function Example() {
  return (
    <Accordion renderAll>
      <Panel title="Accordion panel 1">{content}</Panel>
      <Panel title="Accordion panel 2">{content}</Panel>
      <Panel title="Accordion panel 3">{content}</Panel>
    </Accordion>
  );
}

```

### Core Architecture Module: `documentation-site/examples/accordion/stateful-panel.tsx`
```
import * as React from "react";
import { StatefulPanel } from "baseui/accordion";

const content =
  "Praesent condimentum ante ac ipsum aliquam, ac scelerisque velit sagittis. Ut sit amet libero scelerisque, accumsan ante vitae, hendrerit tellus. Nullam metus est, vehicula a aliquet id, lobortis in mauris.";

export default function Example() {
  return (
    <ul>
      <StatefulPanel title="Expandable panel">{content}</StatefulPanel>
    </ul>
  );
}

```

### Core Architecture Module: `documentation-site/examples/accordion/stateless.tsx`
```
import * as React from "react";
import { StatelessAccordion, Panel } from "baseui/accordion";

export default function Example() {
  const [expanded, setExpanded] = React.useState<React.Key[]>(["P1", "P2"]);
  return (
    <StatelessAccordion
      expanded={expanded}
      onChange={({ key, expanded }) => {
        console.log(key);
        setExpanded(expanded);
      }}
    >
      <Panel key="P1" title="Panel 1">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Panel>
      <Panel key="P2" title="Panel 2">
        Quisque luctus eu sem et pharetra.
      </Panel>
      <Panel key="P3" title="Panel 3">
        Proin egestas dui sed semper iaculis.
      </Panel>
    </StatelessAccordion>
  );
}

```

### Core Architecture Module: `documentation-site/examples/button-group/stateful-checkbox.tsx`
```
import * as React from "react";
import { Button } from "baseui/button";
import { StatefulButtonGroup, MODE } from "baseui/button-group";

export default function Example() {
  return (
    <StatefulButtonGroup
      mode={MODE.checkbox}
      initialState={{ selected: [0, 1] }}
    >
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </StatefulButtonGroup>
  );
}

```

### Core Architecture Module: `documentation-site/examples/button-group/stateful-radio.tsx`
```
import * as React from "react";
import { Button } from "baseui/button";
import { StatefulButtonGroup, MODE } from "baseui/button-group";

export default function Example() {
  return (
    <StatefulButtonGroup mode={MODE.radio} initialState={{ selected: 0 }}>
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </StatefulButtonGroup>
  );
}

```

### Core Architecture Module: `documentation-site/examples/button/states.tsx`
```
import * as React from "react";
import { Button } from "baseui/button";
import { useStyletron } from "baseui";

export default function Example() {
  const [css, theme] = useStyletron();
  const space = css({ marginLeft: theme.sizing.scale300 });
  return (
    <React.Fragment>
      <Button>No state</Button>
      <span className={space} />
      <Button isLoading>Loading</Button>
      <span className={space} />
      <Button isSelected>Selected</Button>
      <span className={space} />
      <Button disabled>Disabled</Button>
    </React.Fragment>
  );
}

```

### Core Architecture Module: `documentation-site/examples/data-table/customized-empty-state.tsx`
```
import React from "react";
import { useStyletron } from "baseui";
import {
  StatefulDataTable,
  BooleanColumn,
  CategoricalColumn,
  CustomColumn,
  NumericalColumn,
  StringColumn,
  NUMERICAL_FORMATS,
} from "baseui/data-table";

type RowDataT = [
  string,
  string,
  number,
  number,
  number,
  { color: string },
  boolean,
  string,
];

const columns = [
  CategoricalColumn({
    title: "categorical",
    mapDataToValue: (data: RowDataT) => data[0],
  }),
  StringColumn({
    title: "string",
    mapDataToValue: (data: RowDataT) => data[1],
  }),
  NumericalColumn({
    title: "three",
    mapDataToValue: (data: RowDataT) => data[2],
  }),
  NumericalColumn({
    title: "neg std",
    highlight: (n: number) => n < 0,
    mapDataToValue: (data: RowDataT) => data[3],
  }),
  NumericalColumn({
    title: "accounting",
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: RowDataT) => data[4],
  }),
  CustomColumn<{ color: string }, {}>({
    title: "custom color",
    mapDataToValue: (data: RowDataT) => data[5],
    renderCell: function Cell(props: any) {
      const [css] = useStyletron();
      return (
        <div
          className={css({
            alignItems: "center",
            fontFamily: '"Comic Sans MS", cursive, sans-serif',
            display: "flex",
          })}
        >
          <div
            className={css({
              backgroundColor: props.value.color,
              height: "12px",
              marginRight: "24px",
              width: "12px",
            })}
          />
          <div>{props.value.color}</div>
        </div>
      );
    },
  }),
  BooleanColumn({
    title: "boolean",
    mapDataToValue: (data: RowDataT) => data[6],
  }),
  CategoricalColumn({
    title: "second category",
    mapDataToValue: (data: RowDataT) => data[7],
  }),
];

export default function Example() {
  const [css] = useStyletron();
  return (
    <React.Fragment>
      <div className={css({ height: "400px" })}>
        <StatefulDataTable
          columns={columns}
          rows={[]}
          emptyMessage="custom empty message"
        />
      </div>
      <div className={css({ height: "400px" })}>
        <StatefulDataTable
          columns={columns}
          rows={[]}
          emptyMessage={() => <h1>custom empty component</h1>}
        />
      </div>
    </React.Fragment>
  );
}

```

### Core Architecture Module: `documentation-site/examples/datepicker/datepickers-color-states.tsx`
```
import React from "react";

import { useStyletron } from "baseui";
import { FormControl } from "baseui/form-control";
import { StatefulDatePicker } from "baseui/datepicker";
import { TimezonePicker } from "baseui/timezonepicker";
import { TimePicker } from "baseui/timepicker";

export default function Example() {
  const [css, theme] = useStyletron();
  return (
    <React.Fragment>
      Disabled state
      <div
        className={css({
          display: "flex",
        })}
      >
        <div
          className={css({
            width: "120px",
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="Datepicker">
            <StatefulDatePicker disabled />
          </FormControl>
        </div>
        <div
          className={css({
            width: "120px",
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="TimePicker">
            <TimePicker disabled />
          </FormControl>
        </div>
        <div className={css({ flex: 1 })}>
          <FormControl label="TimezonePicker">
            <TimezonePicker disabled />
          </FormControl>
        </div>
      </div>
      Positive state
      <div
        className={css({
          display: "flex",
        })}
      >
        <div
          className={css({
            width: "120px",
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="Datepicker">
            <StatefulDatePicker positive />
          </FormControl>
        </div>
        <div
          className={css({
            width: "120px",
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="TimePicker">
            <TimePicker positive />
          </FormControl>
        </div>
        <div className={css({ flex: 1 })}>
          <FormControl label="TimezonePicker">
            <TimezonePicker positive />
          </FormControl>
        </div>
      </div>
      Error state
      <div
        className={css({
          display: "flex",
        })}
      >
        <div
          className={css({
            width: "120px",
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="Datepicker">
            <StatefulDatePicker error />
          </FormControl>
        </div>
        <div
          className={css({
            width: "120px",
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="TimePicker">
            <TimePicker error />
          </FormControl>
        </div>
        <div className={css({ flex: 1 })}>
          <FormControl label="TimezonePicker">
            <TimezonePicker error />
          </FormControl>
        </div>
      </div>
    </React.Fragment>
  );
}

```

### Core Architecture Module: `documentation-site/examples/dnd-list/overrides_state_props.tsx`
```
import * as React from "react";
import { StatefulList } from "baseui/dnd-list";

export default function Example() {
  return (
    <StatefulList
      initialState={{
        items: ["Item 1", "Item 2", "Item 3"],
      }}
      overrides={{
        Label: {
          style: ({ $theme, $isDragged }) => ({
            color: $isDragged ? $theme.colors.primary : $theme.colors.accent400,
          }),
        },
      }}
    />
  );
}

```

### Core Architecture Module: `documentation-site/examples/dnd-list/stateless.tsx`
```
import * as React from 'react';
import {List, arrayMove} from 'baseui/dnd-list';

export default class Example extends React.Component<
  {},
  {items: Array<React.ReactNode>}
> {
  state = {
    items: [
      'Item 1',
      'Item 2',
      'Item 3',
      'Item 4',
      'Item 5',
      'Item 6',
    ],
  };
  render() {
    return (
      <List
        items={this.state.items}
        onChange={({oldIndex, newIndex}) =>
          this.setState((prevState) => ({
            items: arrayMove(prevState.items, oldIndex, newIndex),
          }))
        }
      />
    );
  }
}

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

### Incident Patch 1: `ed21081e` (2026-09-06)
**Commit Message**: test: cover BottomNavigation overflow selector active state

Regression test for the off-by-one bug: with 6 items and activeKey=4
(the first item only reachable via the overflow panel), the "More"
tab must be marked aria-selected.

**File**: `src/bottom-navigation/__tests__/bottom-navigation.test.tsx` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+/*
+Copyright (c) Uber Technologies, Inc.
+
+This source code is licensed under the MIT license found in the
+LICENSE file in the root directory of this source tree.
+*/
+import * as React from 'react';
+import { render } from '@testing-library/react';
+import '@testing-library/jest-dom';
+
+import { BottomNavigation, NavItem } from '..';
+import { Overflow } from '../../icon';
+
+describe('BottomNavigation', () => {
+  it('highlights the overflow selector when the active item is only reachable via More', () => {
+    const items = Array.from({ length: 6 }).map((_, idx) => (
+      <NavItem key={idx} title={`Item ${idx}`} icon={Overflow}>
+        {`panel ${idx}`}
+      </NavItem>
+    ));
+
+    const { getByText } = render(<BottomNavigation activeKey={4}>{items}</BottomNavigation>);
+
+    // Item 4 only renders inside the overflow panel/selector (the first 4 items get
+    // direct selectors), so its being active must highlight the "More" tab.
+    const moreTab = getByText('More').closest('[role="tab"]');
+    expect(moreTab).toHaveAttribute('aria-selected', 'true');
+  });
+});
```

---

### Incident Patch 2: `e4669834` (2026-09-06)
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

### Incident Patch 3: `e140c933` (2026-09-06)
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

### Incident Patch 4: `a035f38f` (2026-09-17)
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

**File**: `documentation-site/pages/components/message-card.mdx` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ Unlike UI components that “flip” in dark mode, cards with rich illustrations
   <CustomColorMessageCard />
 </Example>
 
-When using a color outside of the Base Web primitive color pallete, use the `backgroundColorType` prop to indicate whether the color is light or dark. MessageCard will determine the appropriate font color accordingly.
+When using a color outside of the Base Web primitive color palette, use the `backgroundColorType` prop to indicate whether the color is light or dark. MessageCard will determine the appropriate font color accordingly.
 
 <Example title="Layout" path="message-card/layout.tsx">
   <LayoutMessageCard />
```

**File**: `documentation-site/pages/components/snackbar.mdx` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ before exiting. By default, it will choose the shortest duration.
 </Example>
 
 In some circumstances, you will want to not auto-hide the snackbar and wait until a task
-completes. The example below shows `DURATION.inifinite` usage, how to manually dequeue a
+completes. The example below shows `DURATION.infinite` usage, how to manually dequeue a
 snackbar, as well as demonstrates the `progress` flag that will render a spinner element.
 
 <Example title="Infinite duration" path="snackbar/infinite-duration.tsx">
```

**File**: `documentation-site/pages/components/switch.mdx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export default Layout;
 
 <Yard placeholderHeight={48} {...switchYardConfig} />
 
-Switches are used to allow users to to toggle an option on/off.
+Switches are used to allow users to toggle an option on/off.
 
 Switch is used as a toggle to allow the user to make a binary choice usually (but not limited) in
 the form of a yes/no or on/off suggestion. Switches are often used in product settings or as filter
```

---

### Incident Patch 5: `f30c15e1` (2026-09-04)
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

### Incident Patch 6: `59417ce2` (2026-09-04)
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

### Incident Patch 7: `cf8bb45c` (2026-04-22)
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

### Incident Patch 8: `c10b736a` (2026-06-08)
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

### Incident Patch 9: `a2c7918c` (2026-04-24)
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

**File**: `src/badge/hint-dot.tsx` (modified, +5/-11)
```diff
@@ -5,6 +5,7 @@ This source code is licensed under the MIT license found in the
 LICENSE file in the root directory of this source tree.
 */
 import * as React from 'react';
+import { useStyletron } from '../styles/index';
 import { getOverrides } from '../helpers/overrides';
 import { StyledHintDot, StyledRoot, StyledPositioner } from './styled-components';
 import type { HintDotProps } from './types';
@@ -17,15 +18,14 @@ const HintDot = ({
   horizontalOffset: horizontalOffsetProp,
   verticalOffset: verticalOffsetProp,
   hidden,
-  // placement was not there for hintBadge, but we need to support in for Avatar and other potential use cases.
-  placement = PLACEMENT.topRight,
-  hasBorder = true,
   overrides = {},
 }: HintDotProps) => {
   const [HintDot, hintDotProps] = getOverrides(overrides.Badge, StyledHintDot);
   const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
   const [Positioner, positionerProps] = getOverrides(overrides.Positioner, StyledPositioner);
 
+  const [, theme] = useStyletron();
+
   const anchor = getAnchorFromChildren(children);
 
   // if the anchor is a string, we supply default offsets
@@ -39,28 +39,22 @@ const HintDot = ({
       verticalOffset = '-4px';
     }
   }
-
   return (
     <Root {...rootProps}>
       {anchor}
 
       <Positioner
-        aria-hidden={true}
         $horizontalOffset={horizontalOffset}
         $verticalOffset={verticalOffset}
-        $placement={placement}
+        $placement={theme.direction === 'rtl' ? PLACEMENT.topLeft : PLACEMENT.topRight}
         $role={ROLE.hintDot}
-        $noAnchor={!anchor}
-        $hasBorder={hasBorder}
         {...positionerProps}
       >
         <HintDot
-          data-baseweb="hint-badge"
+          {...hintDotProps}
           $color={color}
           $horizontalOffset={horizontalOffset}
           $hidden={hidden}
-          $hasBorder={hasBorder}
-          {...hintDotProps}
         />
       </Positioner>
     </Root>
```

**File**: `src/badge/index.ts` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ export { default as Badge } from './badge';
 export { default as NotificationCircle } from './notification-circle';
 export { default as HintDot } from './hint-dot';
 
-export { HIERARCHY, SHAPE, COLOR, PLACEMENT, NOTIFICATION_CIRCLE_SIZE } from './constants';
+export { HIERARCHY, SHAPE, COLOR, PLACEMENT } from './constants';
 
 export * from './styled-components';
 
```

**File**: `src/badge/notification-circle.tsx` (modified, +7/-42)
```diff
@@ -8,7 +8,7 @@ import * as React from 'react';
 import { getOverrides } from '../helpers/overrides';
 import { StyledNotificationCircle, StyledRoot, StyledPositioner } from './styled-components';
 import type { NotificationCircleProps } from './types';
-import { PLACEMENT, ROLE, NOTIFICATION_CIRCLE_SIZE } from './constants';
+import { PLACEMENT, ROLE } from './constants';
 import { getAnchorFromChildren } from './utils';
 
 const NotificationCircle = ({
@@ -19,7 +19,6 @@ const NotificationCircle = ({
   horizontalOffset,
   verticalOffset,
   hidden,
-  size = NOTIFICATION_CIRCLE_SIZE.medium,
   overrides = {},
 }: NotificationCircleProps) => {
   const [NotificationCircle, NotificationCircleProps] = getOverrides(
@@ -35,48 +34,22 @@ const NotificationCircle = ({
     if (typeof contentProp === 'string') {
       console.error(`[baseui] NotificationCircle child must be number or icon, found string`);
     }
-    if (
-      placement &&
-      placement !== PLACEMENT.topLeft &&
-      placement !== PLACEMENT.topRight &&
-      placement !== PLACEMENT.bottomLeft &&
-      placement !== PLACEMENT.bottomRight
-    ) {
+    if (placement && placement !== PLACEMENT.topLeft && placement !== PLACEMENT.topRight) {
       console.error(
-        `[baseui] NotificationCircle must be placed topLeft, topRight, bottomLeft, or bottomRight, found ${placement}`
+        `[baseui] NotificationCircle must be placed topLeft or topRight, found ${placement}`
       );
     }
   }
 
   let content = contentProp;
-  const ICON_SIZE = size === NOTIFICATION_CIRCLE_SIZE.small ? 10 : 12;
-  const isContentNumber = typeof content === 'number';
-  if (typeof content === 'number' && content > 99) {
-    content = '99+';
-  } else if (typeof content === 'function') {
-    // add support for render prop, content = (size) => <Icon size={size} />
-    content = content(ICON_SIZE);
-  } else if (React.isValidElement(content)) {
-    // backwards compatibility for icon element as child, clone the element and pass size as prop
-    // content = <Icon />
-    // React.cloneElement is not recommended but we need this to support the old way of passing icon element as content
-    content = React.cloneElement(content as React.ReactElement<{ size?: number }>, {
-      size: ICON_SIZE,
-    });
+  if (typeof content === 'number' && content > 9) {
+    content = '9+';
   }
 
   // If there's no anchor, render the badge inline
   if (!anchor) {
     return (
-      <NotificationCircle
-        data-baseweb="notification-badge"
-        $color={color}
-        $hidden={hidden}
-        $size={size}
-        $extraPadding={isContentNumber}
-        aria-hidden={true}
-        {...NotificationCircleProps}
-      >
+      <NotificationCircle $color={color} $hidden={hidden} {...NotificationCircleProps}>
         {content}
       </NotificationCircle>
     );
@@ -91,17 +64,9 @@ const NotificationCircle = ({
         $verticalOffset={verticalOffset}
         $placement={placement}
         $role={ROLE.notificationCircle}
-        aria-hidden={true}
         {...positionerProps}
       >
-        <NotificationCircle
-          data-baseweb="notification-badge"
-          $color={color}
-          $hidden={hidden}
-          $size={size}
-          $extraPadding={isContentNumber}
-          {...NotificationCircleProps}
-        >
+        <NotificationCircle {...NotificationCircleProps} $color={color} $hidden={hidden}>
           {content}
         </NotificationCircle>
       </Positioner>
```

---

### Incident Patch 10: `77c2d139` (2026-04-07)
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

### Incident Patch 11: `ce1dc304` (2026-04-03)
**Commit Message**: [datepicker] Add fixes for composed date range selections (#5391)

* [datepicker] Add fixes for composed date range selections

* Add major version

---------

Co-authored-by: Jimmy Li <[REDACTED_EMAIL]>

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
+    const { container } = render(<ComposedRangePicker onDatesChange={onDatesChange} />);
+
+    const inputs = container.querySelectorAll('input');
+    fireEvent.focus(inputs[0]);
+
+    const calendar = queryByTestId(container, 'start-calendar');
+    expect(calendar).not.toBeNull();
+
+    fireEvent.click(getByText(calendar!, '10'));
+
+    expect(onDatesChange).toHaveBeenCalled();
+    const firstCall = onDatesChange.mock.calls[onDatesChange.mock.calls.length - 1][0];
+    expect(firstCall[0]).toBeTruthy();
+    expect(firstCall[0].getDate()).toBe(10);
+
+    expect(queryByTestId(container, 'start-calendar')).not.toBeNull();
+  });
+
+  it('clearing end date input preserves start date', () => {
+    const startDate = new Date(2021, 10, 10, 12, 0, 0);
+    const endDate = new Date(2021, 10, 20, 12, 0, 0);
+    const onDatesChange = jest.fn();
+    const { container } = render(
+      <ComposedRangePicker initialDates={[startDate, endDate]} onDatesChange={onDatesChange} />
+    );
+
+    const inputs = container.querySelectorAll('input');
+    fireEvent.focus(inputs[1]
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

**File**: `src/datepicker/__tests__/datepicker.test.tsx` (modified, +96/-0)
```diff
@@ -316,4 +316,100 @@ describe('Datepicker', () => {
       fireEvent.focus(getByTestId(container, 'input'));
     }).not.toThrowError();
   });
+
+  it('fires onChange with partial range in composed picker so parent state updates', () => {
+    const onChange = jest.fn();
+    const { container } = render(
+      <TestBaseProvider>
+        <Datepicker
+          onChange={onChange}
+          value={[]}
+          range
+          displayValueAtRangeIndex={0}
+          mask="9999/99/99"
+          overrides={{
+            CalendarContainer: { props: { 'data-testid': 'calendar' } },
+          }}
+        />
+      </TestBaseProvider>
+    );
+
+    const input = container.querySelector('input');
+    if (input) fireEvent.focus(input);
+
+    const calendar = queryByTestId(container, 'calendar');
+    expect(calendar).not.toBeNull();
+
+    const day15 = getByText(calendar!, '15');
+    fireEvent.click(day15);
+
+    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
+    const calledDate = lastCall[0].date;
+    expect(Array.isArray(calledDate)).toBe(true);
+    expect(calledDate[0].getDate()).toBe(15);
+    expect(queryByTestId(container, 'calendar')).not.toBeNull();
+  });
+
+  it('completes range on second click and closes popover in composed picker', () => {
+    const startDate = new Date('2021-11-10T12:00:00');
+    const onChange = jest.fn();
+    const { container } = render(
+      <TestBaseProvider>
+        <Datepicker
+          onChange={onChange}
+          value={[startDate, null]}
+          range
+          displayValueAtRangeIndex={0}
+          mask="9999/99/99"
+          overrides={{
+            CalendarContainer: { props: { 'data-testid': 'calendar' } },
+          }}
+        />
+      </TestBaseProvider>
+    );
+
+    const input = container.querySelector('input');
+    if (input) fireEvent.focus(input);
+
+    expect(queryByTestId(container, 'calendar')).not.toBeNull();
+
+    const day20 = getByText(container, '20');
+    fireEvent.click(day20);
+
+    expect(onChange).toHaveBeenCalled();
+    const calledDate = onChange.mock.calls[0][0].date;
+    expect(Array.isArray(calledDate)).toBe(true);
+    expect(calledDate[0].getDate()).toBe(10);
+    expect(calledDate[1].getDate()).toBe(20);
+    expect(queryByTestId(container, 'calendar')).toBeNull();
+  });
+
+  it('clearing one input in composed picker preserves the other date', () => {
+    const startDate = new Date('2021-11-10T12:00:00');
+    const endDate = new Date('2021-11-20T12:00:00');
+    const onChange = jest.fn();
+    const { container } = render(
+      <TestBaseProvider>
+        <Datepicker
+          onChange={onChange}
+          value={[startDate, endDate]}
+          range
+          displayValueAtRangeIndex={1}
+          mask="9999/99/99"
+        />
+      </TestBaseProvider>
+    );
+
+    const input = container.querySelector('input');
+    if (input) {
+      fireEvent.focus(input);
+      fireEvent.change(input, { target: { value: '' } });
+    }
+
+    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
+    const calledDate = lastCall[0].date;
+    expect(Array.isArray(calledDate)).toBe(true);
+    expect(calledDate[0].getDate()).toBe(10);
+    expect(calledDate[1]).toBeNull();
+  });
 });
```

**File**: `src/datepicker/__tests__/datepickers-composed-range-min-max.scenario.tsx` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+/*
+Copyright (c) Uber Technologies, Inc.
+
+This source code is licensed under the MIT license found in the
+LICENSE file in the root directory of this source tree.
+*/
+import React, { useState } from 'react';
+import { isAfter, isBefore } from 'date-fns';
+
+import { useStyletron } from '../../styles';
+import { FormControl } from '../../form-control';
+import ArrowRight from '../../icon/arrow-right';
+import { Datepicker, TimePicker } from '..';
+
+const MIN_DATE = new Date(2019, 3, 1, 11, 0, 0);
+const MAX_DATE = new Date(2019, 3, 10, 18, 0, 0);
+const START_DATE = new Date(2019, 3, 1, 12, 0, 0);
+const END_DATE = new Date(2019, 3, 10, 16, 0, 0);
+
+function printDate(dt) {
+  if (!dt) return 'undefined';
+  return dt.getFullYear() + '/' + (dt.getMonth() + 1) + '/' + dt.getDate();
+}
+
+function printTime(dt) {
+  if (!dt) return 'undefined';
+  return dt.toLocaleTimeString();
+}
+
+export function Scenario() {
+  const [css, theme] = useStyletron();
+  const [dates, setDates] = useState<Array<Date | undefined | null>>([START_DATE, END_DATE]);
+
+  const inputGap = theme.sizing.scale300;
+
+  return (
+    <div>
+      <div
+        className={css({
+          [theme.mediaQuery.medium]: {
+            display: 'flex',
+            alignItems: 'center',
+          },
+        })}
+      >
+        <div className={css({ display: 'flex' })}>
+          <div id="start-date" className={css({ width: '120px', marginRight: inputGap })}>
+            <FormControl label="Start Date" caption="YYYY/MM/DD">
+              <Datepicker
+                value={dates}
+                minDate={MIN_DATE}
+                maxDate={MAX_DATE}
+                // typecast to any because if datepicker is range, value is always array type
+
+                onChange={({ date }) => setDates(date as any)}
+                timeSelectStart
+                range
+                placeholder="Start Date"
+                displayValueAtRangeIndex={0}
+                mask="9999/99/99"
+                overrides={{
+                  TimeSelectContainer: {
+                    props: { id: 'time-select-start' },
+                  },
+                }}
+              />
+            </FormControl>
+          </div>
+
+          <div id="start-time" className={css({ width: '120px', marginRight: inputGap })}>
+            <FormControl label="Start Time" caption="HH:MM">
+              <TimePicker
+                value={dates[0]}
+                minTime={MIN_DATE}
+                maxTime={MAX_DATE}
+                onChange={(time) => {
+                  if (time) {
+                    if (dates[1] && isAfter(time, dates[1])) {
+                      setDates([time, time]);
+                    } else {
+                      setDates([time, dates[1]]);
+                    }
+                  }
+                }}
+              />
+            </FormControl>
+          </div>
+        </div>
+
+        <div
+          className={css({
+            display: 'none',
+            marginRight: inputGap,
+            [theme.mediaQuery.medium]: {
+              display: 'block',
+            },
+          })}
+        >
+          <ArrowRight size={24} />
+        </div>
+
+        <div className={css({ display: 'flex' })}>
+          <div id="end-date" className={css({ width: '120px', marginRight: inputGap })}>
+            <FormControl label="End Date" caption="YYYY/MM/DD">
+              <Datepicker
+                value={dates}
+                minDate={MIN_DATE}
+                maxDate={MAX_DATE}
+                // typecast to any because if datepicker is range, value is always array type
+
+                onChange={({ date }) => setDates(date as any)}
+                timeSelectEnd
+                range
+                placeholder="End Date"
+                displayValueAtRangeIndex={1}
+                mask="9999/99/99"
+              />
+            </FormControl>
+          </div>
+
+          <div id="end-time" className={css({ width: '120px' })}>
+            <FormControl label="End Time" caption="HH:MM">
+              <TimePicker
+                value={dates[1]}
+                minTime={MIN_DATE}
+                maxTime={MAX_DATE}
+                onChange={(time) => {
+                  if (time) {
+                    if (dates[0] && isBefore(time, dates[0])) {
+                      setDates([time, time]);
+                    } else {
+                      setDates([dates[0], time]);
+                    }
+                  }
+                }}
+              />
+            </FormControl>
+          </div>
+        </div>
+      </div>
+
+      <button id="set-undefined" onClick={() => setDates([])}>
+        set undefined
+      </button>
+
+      <div>
+        <p id="display-start-date">{printDate(dates[0])}</p>
+        <p id="display-start-time">{printTime(dates[0])}</p>
+        <p id="display-end-date">{printDate(dates[1])}</p>
+        <p id="display-end-time">{printTime(dates
```

**File**: `src/datepicker/__tests__/datepickers-composed-range.scenario.tsx` (modified, +5/-6)
```diff
@@ -47,7 +47,6 @@ export function Scenario() {
               <Datepicker
                 value={dates}
                 // typecast to any because if datepicker is range, value is always array type
-                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 onChange={({ date }) => setDates(date as any)}
                 timeSelectStart
                 range
@@ -68,8 +67,8 @@ export function Scenario() {
               <TimePicker
                 value={dates[0]}
                 onChange={(time) => {
-                  if (time && dates[1]) {
-                    if (isAfter(time, dates[1])) {
+                  if (time) {
+                    if (dates[1] && isAfter(time, dates[1])) {
                       setDates([time, time]);
                     } else {
                       setDates([time, dates[1]]);
@@ -99,7 +98,7 @@ export function Scenario() {
               <Datepicker
                 value={dates}
                 // typecast to any because if datepicker is range, value is always array type
-                // eslint-disable-next-line @typescript-eslint/no-explicit-any
+
                 onChange={({ date }) => setDates(date as any)}
                 timeSelectEnd
                 range
@@ -115,8 +114,8 @@ export function Scenario() {
               <TimePicker
                 value={dates[1]}
                 onChange={(time) => {
-                  if (time && dates[0]) {
-                    if (isBefore(time, dates[0])) {
+                  if (time) {
+                    if (dates[0] && isBefore(time, dates[0])) {
                       setDates([time, time]);
                     } else {
                       setDates([dates[0], time]);
```

---

### Incident Patch 12: `fa3470ef` (2025-12-24)
**Commit Message**: [Bug fix]Toggle variant in checkbox component - multi line and error checked state (#5375)

* [Bug fix]Toggle variant in checkbox component - multi line and error checked status

* 15.0.2

**File**: `documentation-site/next-env.d.ts` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 /// <reference types="next/image-types/global" />
 
 // NOTE: This file should not be edited
-// see https://nextjs.org/docs/basic-features/typescript for more information.
+// see https://nextjs.org/docs/pages/building-your-application/configuring/typescript for more information.
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "baseui",
-  "version": "15.0.1",
+  "version": "15.0.2",
   "description": "A React Component library implementing the Base design language",
   "keywords": [
     "react",
```

**File**: `src/checkbox/__tests__/checkbox-toggle.scenario.tsx` (modified, +10/-2)
```diff
@@ -6,11 +6,11 @@ LICENSE file in the root directory of this source tree.
 */
 import * as React from 'react';
 
-import { Checkbox, STYLE_TYPE } from '../index';
+import { Checkbox, StatefulCheckbox, STYLE_TYPE } from '../index';
 
 export function Scenario() {
   return (
-    <div style={{ width: '200px' }}>
+    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
       <Checkbox checkmarkType={STYLE_TYPE.toggle}>default unchecked</Checkbox>
       <Checkbox checkmarkType={STYLE_TYPE.toggle} checked>
         default checked
@@ -29,6 +29,14 @@ export function Scenario() {
       <Checkbox checkmarkType={STYLE_TYPE.toggle} checked error>
         error checked
       </Checkbox>
+
+      <Checkbox checkmarkType={STYLE_TYPE.toggle} checked>
+        long label that should wrap to multiple lines to test how the toggle aligns with the text
+      </Checkbox>
+      <StatefulCheckbox checkmarkType={STYLE_TYPE.toggle}>stateful toggle</StatefulCheckbox>
+      <StatefulCheckbox checkmarkType={STYLE_TYPE.toggle} error>
+        stateful error toggle
+      </StatefulCheckbox>
     </div>
   );
 }
```

**File**: `src/checkbox/styled-components.ts` (modified, +5/-6)
```diff
@@ -260,13 +260,12 @@ export const Toggle = styled<'div', SharedStyleProps>('div', (props) => {
 Toggle.displayName = 'Toggle';
 
 export const ToggleTrack = styled<'div', SharedStyleProps>('div', (props) => {
-  let backgroundColor = props.$theme.colors.toggleTrackFill;
-  if (props.$disabled) {
-    backgroundColor = props.$theme.colors.toggleTrackFillDisabled;
-  } else if (props.$error && props.$checked) {
-    backgroundColor = props.$theme.colors.tickFillError;
-  }
+  const backgroundColor = props.$disabled
+    ? props.$theme.colors.toggleTrackFillDisabled
+    : props.$theme.colors.toggleTrackFill;
+
   return {
+    flex: '0 0 auto',
     alignItems: 'center',
     backgroundColor,
     borderTopLeftRadius: '7px',
```

---

### Incident Patch 13: `c610a752` (2025-12-10)
**Commit Message**: [chore] fix ts errors on main (#5372)

* chore: fix typecheck

**File**: `package.json` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@
   "dependencies": {
     "@date-io/date-fns": "^2.13.1",
     "@date-io/moment": "^2.13.1",
+    "axe-core": "^4.11.0",
     "card-validator": "^6.2.0",
     "csstype": "2.6.11",
     "d3": "^6.7.0",
```

**File**: `pnpm-lock.yaml` (modified, +158/-180)
```diff
@@ -14,6 +14,9 @@ importers:
       '@date-io/moment':
         specifier: ^2.13.1
         version: 2.17.0(moment@2.29.4)
+      axe-core:
+        specifier: ^4.11.0
+        version: 4.11.0
       card-validator:
         specifier: ^6.2.0
         version: 6.2.0
@@ -239,7 +242,7 @@ packages:
     engines: {node: '>=6.0.0'}
 
   '@angular/compiler@7.2.16':
-    resolution: {integrity: sha1-CB9Y6fUDmf8O7zRv/zfJxiAc2o0=}
+    resolution: {integrity: sha512-8iX+E9Cnet2167RdP8wM5PGPoEnw/jZNvHrtTRHs4g53n/Rg45iLmE9qFzxCqXGBmUO9LXKYdcXnettFKFLifg==}
 
   '@babel/cli@7.23.4':
     resolution: {integrity: sha512-j3luA9xGKCXVyCa5R7lJvOMM+Kc2JEnAEIgz2ggtjQ/j5YUVgfsg/WsG95bbsgq7YLHuiCOzMnoSasuY16qiCw==}
@@ -919,142 +922,142 @@ packages:
         optional: true
 
   '@emnapi/runtime@0.44.0':
-    resolution: {integrity: sha1-HvcC+EbPzVWdKOt2c5GQh7pbY+M=}
+    resolution: {integrity: sha512-ZX/etZEZw8DR7zAB1eVQT40lNo0jeqpb6dCgOvctB6FIQ5PoXfMuNY8+ayQfu8tNQbAB8gQWSSJupR8NxeiZXw==}
 
   '@esbuild/aix-ppc64@0.19.10':
-    resolution: {integrity: sha1-+zkioBg9J0Rt4Az2DU97qq35jYQ=}
+    resolution: {integrity: sha512-Q+mk96KJ+FZ30h9fsJl+67IjNJm3x2eX+GBWGmocAKgzp27cowCOOqSdscX80s0SpdFXZnIv/+1xD1EctFx96Q==}
     engines: {node: '>=12'}
     cpu: [ppc64]
     os: [aix]
 
   '@esbuild/android-arm64@0.19.10':
-    resolution: {integrity: sha1-7zEBVBbdeTmAgkCbd6qqKt5NUxo=}
+    resolution: {integrity: sha512-1X4CClKhDgC3by7k8aOWZeBXQX8dHT5QAMCAQDArCLaYfkppoARvh0fit3X2Qs+MXDngKcHv6XXyQCpY0hkK1Q==}
     engines: {node: '>=12'}
     cpu: [arm64]
     os: [android]
 
   '@esbuild/android-arm@0.19.10':
-    resolution: {integrity: sha1-HCPH51Rzqun7Mjvl2dsiUUL0f1I=}
+    resolution: {integrity: sha512-7W0bK7qfkw1fc2viBfrtAEkDKHatYfHzr/jKAHNr9BvkYDXPcC6bodtm8AyLJNNuqClLNaeTLuwURt4PRT9d7w==}
     engines: {node: '>=12'}
     cpu: [arm]
     os: [android]
 
   '@esbuild/android-x64@0.19.10':
-    resolution: {integrity: sha1-32pObW642lWVz84W1OP2vCRGRwc=}
+    resolution: {integrity: sha512-O/nO/g+/7NlitUxETkUv/IvADKuZXyH4BHf/g/7laqKC4i/7whLpB0gvpPc2zpF0q9Q6FXS3TS75QHac9MvVWw==}
     engines: {node: '>=12'}
     cpu: [x64]
     os: [android]
 
   '@esbuild/darwin-arm64@0.19.10':
-    resolution: {integrity: sha1-hGKlXbB8Gy+tYcgkTOBEae8QQ74=}
+    resolution: {integrity: sha512-YSRRs2zOpwypck+6GL3wGXx2gNP7DXzetmo5pHXLrY/VIMsS59yKfjPizQ4lLt5vEI80M41gjm2BxrGZ5U+VMA==}
     engines: {node: '>=12'}
     cpu: [arm64]
     os: [darwin]
 
   '@esbuild/darwin-x64@0.19.10':
-    resolution: {integrity: sha1-0d4gv9Qbt1uVW6hqaxAEU56CGME=}
+    resolution: {integrity: sha512-alfGtT+IEICKtNE54hbvPg13xGBe4GkVxyGWtzr+yHO7HIiRJppPDhOKq3zstTcVf8msXb/t4eavW3jCDpMSmA==}
     engines: {node: '>=12'}
     cpu: [x64]
     os: [darwin]
 
   '@esbuild/freebsd-arm64@0.19.10':
-    resolution: {integrity: sha1-FpBIeeNMU6LgOdEoRpXS2z5mTVc=}
+    resolution: {integrity: sha512-dMtk1wc7FSH8CCkE854GyGuNKCewlh+7heYP/sclpOG6Cectzk14qdUIY5CrKDbkA/OczXq9WesqnPl09mj5dg==}
     engines: {node: '>=12'}
     cpu: [arm64]
     os: [freebsd]
 
   '@esbuild/freebsd-x64@0.19.10':
-    resolution: {integrity: sha1-itnlypeGyj8e8UEb/RCwjc2dTO8=}
+    resolution: {integrity: sha512-G5UPPspryHu1T3uX8WiOEUa6q6OlQh6gNl4CO4Iw5PS+Kg5bVggVFehzXBJY6X6RSOMS8iXDv2330VzaObm4Ag==}
     engines: {node: '>=12'}
     cpu: [x64]
     os: [freebsd]
 
   '@esbuild/linux-arm64@0.19.10':
-    resolution: {integrity: sha1-2CzyxZD67OgtKLvxz7428iriW9I=}
+    resolution: {integrity: sha512-QxaouHWZ+2KWEj7cGJmvTIHVALfhpGxo3WLmlYfJ+dA5fJB6lDEIg+oe/0//FuyVHuS3l79/wyBxbHr0NgtxJQ==}
     engines: {node: '>=12'}
     cpu: [arm64]
     os: [linux]
 
   '@esbuild/linux-arm@0.19.10':
-    resolution: {integrity: sha1-R3uOfHvNNDaXF7BN2e5pcshPQCk=}
+    resolution: {integrity: sha512-j6gUW5aAaPgD416Hk9FHxn27On28H4eVI9rJ4az7oCGTFW48+LcgNDBN+9f8rKZz7EEowo889CPKyeaD0iw9Kg==}
     engines: {node: '>=12'}
     cpu: [arm]
     os: [linux]
 
   '@esbuild/linux-ia32@0.19.10':
-    resolution: {integrity: sha1-1V/4Is9bAlKlcRL4aFf/I75sqw4=}
+    resolution: {integrity: sha512-4ub1YwXxYjj9h1UIZs2hYbnTZBtenPw5NfXCRgEkGb0b6OJ2gpkMvDqRDYIDRjRdWSe/TBiZltm3Y3Q8SN1xNg==}
     engines: {node: '>=12'}
     cpu: [ia32]
     os: [linux]
 
   '@esbuild/linux-loong64@0.19.10':
-    resolution: {integrity: sha1-qa0FfX5I1sn2L/UPbyCOMxxFQ8c=}
+    resolution: {integrity: sha512-lo3I9k+mbEKoxtoIbM0yC/MZ1i2wM0cIeOejlVdZ3D86LAcFXFRdeuZmh91QJvUTW51bOK5W2BznGNIl4+mDaA==}
     engines: {node: '>=12'}
     cpu: [loong64]
     os: [linux]
 
   '@esbuild/linux-mips64el@0.19.10':
-    resolution: {integrity: sha1-sBGpaSR3PWDrqzlvvXoI3mZmgXk=}
+    resolution: {integrity: sha512-J4gH3zhHNbdZN0Bcr1QUGVNkHTdpijgx5VMxeetSk6ntdt+vR1DqGmHxQYHRmNb77tP6GVvD+K0NyO4xjd7y4A==}
     engines: {node: '>=12'}
     cpu: [mips64el]
     os: [linux]
 
   '@esbuild/linux-ppc64@0.19.10':
-    resolution: {integrity: sha1-XYtZkpwCmBHkc/JUR5DqEdWI1N0=}
+    resolution: {integrity: sha512-tgT/7u+QhV6ge8wFMzaklOY7KqiyitgT1AUHMApau32ZlvTB/+efeCtMk4eXS+uEymYK249JsoiklZN64xt6oQ==}
```

**File**: `src/accordion/stateless-accordion.tsx` (modified, +8/-11)
```diff
@@ -24,16 +24,13 @@ function StatelessAccordion({
   return (
     <Root data-baseweb="accordion" {...rootProps}>
       {React.Children.map(children, (child, index) => {
-        let normalizedChild =
-          isElement(child) || isPortal(child) ? (
-            child
-          ) : (
-            // if primitive value - wrap it in a fragment
-            <>{child}</>
-          );
-        const key = normalizedChild.key || String(index);
-        return React.cloneElement(normalizedChild, {
-          disabled: normalizedChild.props.disabled || disabled,
+        if (!isElement(child) && !isPortal(child)) {
+          return child;
+        }
+        const element = child as React.ReactElement;
+        const key = element.key || String(index);
+        return React.cloneElement(element, {
+          disabled: element.props.disabled || disabled,
           expanded: expanded.includes(key),
           key,
           onChange:
@@ -59,7 +56,7 @@ function StatelessAccordion({
                   onChange({ key, expanded: next });
                 }
               : onChange,
-          overrides: normalizedChild.props.overrides || PanelOverrides,
+          overrides: element.props.overrides || PanelOverrides,
           renderAll,
         });
       })}
```

**File**: `src/bottom-navigation/bottom-navigation.tsx` (modified, +0/-3)
```diff
@@ -47,15 +47,13 @@ const BottomNavigation = ({
   const NavItemPanelRefs = React.useRef([]);
 
   function scrollToTop(idx) {
-    // @ts-expect-error todo(ts-migration) TS2339 Property 'scrollTo' does not exist on type 'never'.
     NavItemPanelRefs.current[idx].scrollTo({ top: 0, left: 0, behavior: 'smooth' });
   }
 
   function handleNavItemChange(activeKey) {
     if (displayOverflow) {
       setDisplayOverflow(false);
     }
-    // @ts-expect-error todo(ts-migration) TS2722 Cannot invoke an object which is possibly 'undefined'.
     onChange({ activeKey });
   }
 
@@ -97,7 +95,6 @@ const BottomNavigation = ({
         return (
           <Panel
             isActive={isActive}
-            // @ts-expect-error todo(ts-migration) TS2345 Argument of type 'unknown' is not assignable to parameter of type 'never'.
             ref={(element) => NavItemPanelRefs.current.push(element)}
             overrides={navItem.props.overrides}
             key={idx}
```

**File**: `src/data-table/column-numerical.tsx` (modified, +1/-12)
```diff
@@ -94,8 +94,7 @@ type HistogramProps = {
   precision;
 };
 
-// eslint-disable-next-line @typescript-eslint/no-explicit-any
-const Histogram = React.memo<any>(function Histogram({
+const Histogram = React.memo<HistogramProps>(function Histogram({
   data,
   lower,
   upper,
@@ -110,7 +109,6 @@ const Histogram = React.memo<any>(function Histogram({
     const bins = bin().thresholds(Math.min(data.length, MAX_BIN_COUNT))(data);
 
     const xScale = scaleLinear()
-      // @ts-expect-error todo(ts-migration) TS2345 Argument of type '(number | undefined)[]' is not assignable to parameter of type 'Iterable<NumberValue>'.
       .domain([bins[0].x0, bins[bins.length - 1].x1])
       .range([0, HISTOGRAM_SIZE.width])
       .clamp(true);
@@ -146,20 +144,16 @@ const Histogram = React.memo<any>(function Histogram({
       <svg {...HISTOGRAM_SIZE}>
         {/* @ts-ignore */}
         {bins.map((d, index) => {
-          // @ts-expect-error todo(ts-migration) TS2345 Argument of type 'number | undefined' is not assignable to parameter of type 'NumberValue'.
           const x = xScale(d.x0) + 1;
           const y = yScale(d.length);
-          // @ts-expect-error todo(ts-migration) TS2345 Argument of type 'number | undefined' is not assignable to parameter of type 'NumberValue'.
           const width = Math.max(0, xScale(d.x1) - xScale(d.x0) - 1);
           const height = yScale(0) - yScale(d.length);
 
           let included;
           if (singleIndexNearest != null) {
             included = index === singleIndexNearest;
           } else {
-            // @ts-expect-error todo(ts-migration) TS18048 'd.x1' is possibly 'undefined'.
             const withinLower = d.x1 > lower;
-            // @ts-expect-error todo(ts-migration) TS18048 'd.x0' is possibly 'undefined'.
             const withinUpper = d.x0 <= upper;
             included = withinLower && withinUpper;
           }
@@ -255,11 +249,9 @@ function NumericalFilter(props) {
     // once the user is done inputting.
     // we validate then format to the given precision
     let l = isRange ? lv : sv;
-    // @ts-expect-error todo(ts-migration) TS2322 Type 'string | number | undefined' is not assignable to type 'number'.
     l = validateInput(l) ? l : min;
     let h = validateInput(uv) ? uv : max;
 
-    // @ts-expect-error todo(ts-migration) TS2345 Argument of type 'string | number | undefined' is not assignable to parameter of type 'number'.
     return [roundToFixed(l, precision), roundToFixed(h, precision)];
   }, [isRange, focused, sv, lv, uv, precision]);
 
@@ -268,7 +260,6 @@ function NumericalFilter(props) {
   const sliderScale = React.useMemo(
     () =>
       scaleLinear()
-        // @ts-expect-error todo(ts-migration) TS2345 Argument of type '(string | undefined)[]' is not assignable to parameter of type 'Iterable<NumberValue>'.
         .domain([min, max])
         .rangeRound([1, MAX_BIN_COUNT])
         // We clamp the values within our min and max even if a user enters a huge number
@@ -422,7 +413,6 @@ function NumericalFilter(props) {
           justifyContent: 'space-between',
         })}
       >
-        {/* @ts-expect-error todo(ts-migration) TS2769 No overload matches this call. */}
         <Input
           min={min}
           max={max}
@@ -442,7 +432,6 @@ function NumericalFilter(props) {
           onBlur={() => setFocus(false)}
         />
         {isRange && (
-          // @ts-expect-error todo(ts-migration) TS2769 No overload matches this call.
           <Input
             min={min}
             max={max}
```

**File**: `src/dnd-list/index.ts` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ Copyright (c) Uber Technologies, Inc.
 This source code is licensed under the MIT license found in the
 LICENSE file in the root directory of this source tree.
 */
+// @ts-ignore - react-movable is an ES module but we're in a CommonJS context
 import { arrayMove, arrayRemove } from 'react-movable';
 import type { SharedStylePropsArg } from './types';
 
```

**File**: `src/dnd-list/list.tsx` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ import {
   CloseHandle as StyledCloseHandle,
   Label as StyledLabel,
 } from './styled-components';
+// @ts-ignore - react-movable is an ES module but we're in a CommonJS context
 import { List as MovableList } from 'react-movable';
 import Grab from '../icon/grab';
 import Delete from '../icon/delete';
```

**File**: `src/dnd-list/stateful-list-container.ts` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ import type {
   StateChangeType,
   StateReducer,
 } from './types';
+// @ts-ignore - react-movable is an ES module but we're in a CommonJS context
 import { arrayMove, arrayRemove } from 'react-movable';
 
 const defaultStateReducer: StateReducer = (type, nextState) => nextState;
```

---

### Incident Patch 14: `888e77d9` (2025-12-10)
**Commit Message**: chore: allow to trigger release from GH UI (#5369)

**File**: `.github/workflows/release.yml` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ on:
   push:
     branches:
       - main
+  workflow_dispatch: {}
 
 concurrency: ${{ github.workflow }}-${{ github.ref }}
 
```

---

### Incident Patch 15: `f7b840f8` (2025-03-19)
**Commit Message**: Fix Cloudflare deployment for baseweb.design (#5358)

* Revert "[list]: Added documentation for hasDivider prop (#5348)"

This reverts commit 3f133a5086ec08373a5131b67fb3319d4ee35507.

* Run pnpm install

* Keep the documentation change from https://github.com/uber/baseweb/pull/5348

**File**: `package-lock.json` (modified, +3/-50)
```diff
@@ -1,17 +1,16 @@
 {
   "name": "baseui",
-  "version": "15.0.0",
+  "version": "14.0.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "baseui",
-      "version": "15.0.0",
+      "version": "14.0.0",
       "license": "MIT",
       "dependencies": {
         "@date-io/date-fns": "^2.13.1",
         "@date-io/moment": "^2.13.1",
-        "baseui": "^14.0.0",
         "card-validator": "^6.2.0",
         "csstype": "2.6.11",
         "d3": "^6.7.0",
@@ -92,7 +91,7 @@
       "peerDependencies": {
         "react": ">=18",
         "react-dom": ">=18",
-        "styletron-react": "^6.1.1"
+        "styletron-react": ">=6"
       }
     },
     "node_modules/@ampproject/remapping": {
@@ -6021,52 +6020,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/baseui": {
-      "version": "14.0.0",
-      "resolved": "https://unpm.uberinternal.com/baseui/-/baseui-14.0.0.tgz",
-      "integrity": "sha1-GoOuc/YRRaInEJifRL9/9xhtcQ0=",
-      "license": "MIT",
-      "dependencies": {
-        "@date-io/date-fns": "^2.13.1",
-        "@date-io/moment": "^2.13.1",
-        "card-validator": "^6.2.0",
-        "csstype": "2.6.11",
-        "d3": "^6.7.0",
-        "d3-array": "2.4.0",
-        "date-fns": "^2.28.0",
-        "date-fns-tz": "^1.2.2",
-        "just-extend": "4.1.1",
-        "memoize-one": "5.0.0",
-        "mockdate": "2.0.5",
-        "moment": "^2.29.4",
-        "polished": "^4.2.2",
-        "popper.js": "^1.16.1",
-        "prop-types": "^15.8.1",
-        "react-dropzone": "9.0.0",
-        "react-focus-lock": "^2.8.1",
-        "react-hook-form": "^7.30.0",
-        "react-input-mask": "^2.0.4",
-        "react-is": "^17.0.2",
-        "react-map-gl": "5.2.13",
-        "react-movable": "^3.0.4",
-        "react-multi-ref": "^1.0.0",
-        "react-range": "^1.8.12",
-        "react-uid": "2.3.0",
-        "react-virtualized": "^9.22.3",
-        "react-virtualized-auto-sizer": "1.0.2",
-        "react-window": "1.8.5",
-        "resize-observer-polyfill": "1.5.1",
-        "styletron-standard": "^3.1.0"
-      },
-      "engines": {
-        "node": ">=18.0.0"
-      },
-      "peerDependencies": {
-        "react": ">=18",
-        "react-dom": ">=18",
-        "styletron-react": ">=6"
-      }
-    },
     "node_modules/bcp-47-match": {
       "version": "2.0.3",
       "resolved": "https://unpm.uberinternal.com/bcp-47-match/-/bcp-47-match-2.0.3.tgz",
```

**File**: `package.json` (modified, +1/-2)
```diff
@@ -25,7 +25,6 @@
   "dependencies": {
     "@date-io/date-fns": "^2.13.1",
     "@date-io/moment": "^2.13.1",
-    "baseui": "^14.0.0",
     "card-validator": "^6.2.0",
     "csstype": "2.6.11",
     "d3": "^6.7.0",
@@ -58,7 +57,7 @@
   "peerDependencies": {
     "react": ">=18",
     "react-dom": ">=18",
-    "styletron-react": "^6.1.1"
+    "styletron-react": ">=6"
   },
   "devDependencies": {
     "@babel/cli": "^7.23.4",
```

#### Recent Merged Pull Requests:
- **PR #5427** (closed): Update theme object to include direction property (@MaddipatlaChetan24)
- **PR #5426** (closed): Add onMouseUp handler to changeHandlers (@MaddipatlaChetan24)
- **PR #5425** (2026-09-22): Update index.jsx (@MaddipatlaChetan24)
- **PR #5424** (closed): Update checkbox-v2.ts (@MaddipatlaChetan24)
- **PR #5423** (closed): Update knob.tsx (@MaddipatlaChetan24)
- **PR #5422** (2026-09-22): docs: fix DURATION.infinite reference and typos in docs (@toyeshhm)
- **PR #5419** (closed): Refactor badge props to use BaseBadgeProps (@MaddipatlaChetan24)
- **PR #5417** (closed): test(avatar): cover explicit initials prop override (@TruptiAgrawal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
