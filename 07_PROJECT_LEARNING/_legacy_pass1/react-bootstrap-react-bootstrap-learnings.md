# Forensic Learning Record (Deep Inspection): react-bootstrap/react-bootstrap

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-bootstrap-react-bootstrap-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-bootstrap/react-bootstrap](https://github.com/react-bootstrap/react-bootstrap))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:25:12.709Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-bootstrap/react-bootstrap`
- **Description**: Bootstrap components built with React
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 22602 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.babelrc.js`
```
export default (api) => {
  const env = api.env();

  let dev = false;
  let setUseClient = false;
  let modules;

  switch (env) {
    case 'docs':
    case 'test':
    case 'dist-dev':
      dev = true;
      modules = false;
      break;
    case 'dist-prod':
      modules = false;
      break;
    case 'esm':
      modules = false;
      setUseClient = true;
      break;
    case 'cjs':
    default:
      modules = 'commonjs';
      setUseClient = true;
      break;
  }

  return {
    presets: [
      [
        '@react-bootstrap',
        {
          dev,
          modules,
          removePropTypes: !dev,
          setUseClient,
          customClientImports: [
            'useBootstrapPrefix',
            'createWithBsPrefix',
            'useCol',
          ],
        },
      ],
      '@babel/preset-typescript',
    ],
    plugins: [env === 'test' && 'istanbul'].filter(Boolean),
  };
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import eslint from '@eslint/js';
import globals from 'globals';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,

  prettierPlugin,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],

  {
    plugins: {
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: {
          jsx: true,
        },
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: false,
        },
      ],
    },
  },
  {
    ignores: ['**/node_modules/**', '**/lib/**', '**/www/**'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    files: ['**/test/**/*'],
    rules: {
      'no-script-url': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'padded-blocks': 'off',
      'react/no-multi-comp': 'off',
      'react/display-name': 'off',
    },
  },
  {
    rules: {
      'react/prop-types': 'off',
      'react/no-unknown-property': ['error', { ignore: ['x-placement'] }],
    },
  },
);

```

### Core Architecture Module: `src/AbstractModalHeader.tsx`
```
import * as React from 'react';
import { useContext } from 'react';
import useEventCallback from '@restart/hooks/useEventCallback';
import CloseButton, { type CloseButtonVariant } from './CloseButton.js';
import ModalContext from './ModalContext.js';

export interface AbstractModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Provides an accessible label for the close
   * button. It is used for Assistive Technology when the label text is not
   * readable.
   */
  closeLabel?: string | undefined;

  /**
   * Sets the variant for close button.
   */
  closeVariant?: CloseButtonVariant | undefined;

  /**
   * Specify whether the Component should contain a close button
   */
  closeButton?: boolean | undefined;

  /**
   * A Callback fired when the close button is clicked. If used directly inside
   * a ModalContext, the onHide will automatically be propagated up
   * to the parent `onHide`.
   *
   * @type {(() => void) | undefined}
   */
  onHide?: (() => void) | undefined;
}

const AbstractModalHeader = React.forwardRef<
  HTMLDivElement,
  AbstractModalHeaderProps
>(
  (
    {
      closeLabel = 'Close',
      closeVariant,
      closeButton = false,
      onHide,
      children,
      ...props
    },
    ref,
  ) => {
    const context = useContext(ModalContext);

    const handleClick = useEventCallback(() => {
      context?.onHide();
      onHide?.();
    });

    return (
      <div ref={ref} {...props}>
        {children}

        {closeButton && (
          <CloseButton
            aria-label={closeLabel}
            variant={closeVariant}
            onClick={handleClick}
          />
        )}
      </div>
    );
  },
);

AbstractModalHeader.displayName = 'AbstractModalHeader';

export default AbstractModalHeader;

```

### Core Architecture Module: `src/Accordion.tsx`
```
import clsx from 'clsx';
import * as React from 'react';
import { useMemo } from 'react';
import { useUncontrolled } from 'uncontrollable';
import type { DynamicRefForwardingComponent } from '@restart/ui/types';
import { useBootstrapPrefix } from './ThemeProvider.js';
import AccordionBody from './AccordionBody.js';
import AccordionButton from './AccordionButton.js';
import AccordionCollapse from './AccordionCollapse.js';
import AccordionContext, {
  type AccordionSelectCallback,
  type AccordionEventKey,
} from './AccordionContext.js';
import AccordionHeader from './AccordionHeader.js';
import AccordionItem from './AccordionItem.js';

export interface AccordionProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'onSelect'
> {
  /**
   * Element used to render the component.
   */
  as?: React.ElementType | undefined;

  /**
   * @default 'accordion'
   */
  bsPrefix?: string | undefined;

  /**
   * The current active key that corresponds to the currently expanded card.
   */
  activeKey?: AccordionEventKey | undefined;

  /**
   * The default active key that is expanded on start
   */
  defaultActiveKey?: AccordionEventKey | undefined;

  /**
   * Callback fired when the active item changes.
   *
   * ```js
   * (eventKey: string | string[] | null, event: Object) => void
   * ```
   *
   * @controllable activeIndex
   */
  onSelect?: AccordionSelectCallback | undefined;

  /**
   * Renders accordion edge-to-edge with its parent container.
   */
  flush?: boolean | undefined;

  /**
   * Allow accordion items to stay open when another item is opened.
   */
  alwaysOpen?: boolean | undefined;
}

const Accordion: DynamicRefForwardingComponent<'div', AccordionProps> =
  React.forwardRef<HTMLElement, AccordionProps>((props, ref) => {
    const {
      // Need to define the default "as" during prop destructuring to be compatible with styled-components github.com/react-bootstrap/react-bootstrap/issues/3595
      as: Component = 'div',
      activeKey,
      bsPrefix,
      className,
      onSelect,
      flush,
      alwaysOpen,
      ...controlledProps
    } = useUncontrolled(props, {
      activeKey: 'onSelect',
    });

    const prefix = useBootstrapPrefix(bsPrefix, 'accordion');
    const contextValue = useMemo(
      () => ({
        activeEventKey: activeKey,
        onSelect,
        alwaysOpen,
      }),
      [activeKey, onSelect, alwaysOpen],
    );

    return (
      <AccordionContext.Provider value={contextValue}>
        <Component
          ref={ref}
          {...controlledProps}
          className={clsx(className, prefix, flush && `${prefix}-flush`)}
        />
      </AccordionContext.Provider>
    );
  });

Accordion.displayName = 'Accordion';

export default Object.assign(Accordion, {
  Button: AccordionButton,
  Collapse: AccordionCollapse,
  Item: AccordionItem,
  Header: AccordionHeader,
  Body: AccordionBody,
});

```

### Core Architecture Module: `src/AccordionBody.tsx`
```
import clsx from 'clsx';
import * as React from 'react';
import { useContext } from 'react';
import type { DynamicRefForwardingComponent } from '@restart/ui/types';
import { useBootstrapPrefix } from './ThemeProvider.js';
import AccordionCollapse from './AccordionCollapse.js';
import AccordionItemContext from './AccordionItemContext.js';
import type { TransitionCallbacks } from './types.js';

export interface AccordionBodyProps
  extends TransitionCallbacks, React.HTMLAttributes<HTMLElement> {
  /**
   * Element used to render the component.
   */
  as?: React.ElementType | undefined;

  /**
   * @default 'accordion-body'
   */
  bsPrefix?: string | undefined;
}

const AccordionBody: DynamicRefForwardingComponent<'div', AccordionBodyProps> =
  React.forwardRef<HTMLElement, AccordionBodyProps>(
    (
      {
        // Need to define the default "as" during prop destructuring to be compatible with styled-components github.com/react-bootstrap/react-bootstrap/issues/3595
        as: Component = 'div',
        bsPrefix,
        className,
        onEnter,
        onEntering,
        onEntered,
        onExit,
        onExiting,
        onExited,
        ...props
      },
      ref,
    ) => {
      bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-body');
      const { eventKey } = useContext(AccordionItemContext);

      return (
        <AccordionCollapse
          eventKey={eventKey}
          onEnter={onEnter}
          onEntering={onEntering}
          onEntered={onEntered}
          onExit={onExit}
          onExiting={onExiting}
          onExited={onExited}
        >
          <Component
            ref={ref}
            {...props}
            className={clsx(className, bsPrefix)}
          />
        </AccordionCollapse>
      );
    },
  );

AccordionBody.displayName = 'AccordionBody';

export default AccordionBody;

```

### Core Architecture Module: `src/AccordionButton.tsx`
```
import * as React from 'react';
import { useContext } from 'react';
import clsx from 'clsx';
import type { DynamicRefForwardingComponent } from '@restart/ui/types';
import AccordionContext, {
  isAccordionItemSelected,
} from './AccordionContext.js';
import AccordionItemContext from './AccordionItemContext.js';
import { useBootstrapPrefix } from './ThemeProvider.js';
import useAccordionButton from './useAccordionButton.js';

export interface AccordionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Element used to render the component.
   */
  as?: React.ElementType | undefined;

  /**
   * @default 'accordion-button'
   */
  bsPrefix?: string | undefined;
}

const AccordionButton: DynamicRefForwardingComponent<
  'div',
  AccordionButtonProps
> = React.forwardRef<HTMLButtonElement, AccordionButtonProps>(
  (
    {
      // Need to define the default "as" during prop destructuring to be compatible with styled-components github.com/react-bootstrap/react-bootstrap/issues/3595
      as: Component = 'button',
      bsPrefix,
      className,
      onClick,
      ...props
    },
    ref,
  ) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-button');
    const { eventKey } = useContext(AccordionItemContext);
    const accordionOnClick = useAccordionButton(eventKey, onClick);
    const { activeEventKey } = useContext(AccordionContext);

    if (Component === 'button') {
      props.type = 'button';
    }

    return (
      <Component
        ref={ref}
        onClick={accordionOnClick}
        {...props}
        aria-expanded={
          Array.isArray(activeEventKey)
            ? activeEventKey.includes(eventKey)
            : eventKey === activeEventKey
        }
        className={clsx(
          className,
          bsPrefix,
          !isAccordionItemSelected(activeEventKey, eventKey) && 'collapsed',
        )}
      />
    );
  },
);

AccordionButton.displayName = 'AccordionButton';

export default AccordionButton;

```

### Core Architecture Module: `src/AccordionCollapse.tsx`
```
import clsx from 'clsx';
import * as React from 'react';
import { useContext } from 'react';
import type { DynamicRefForwardingComponent } from '@restart/ui/types';
import { Transition } from 'react-transition-group';
import { useBootstrapPrefix } from './ThemeProvider.js';
import Collapse, { type CollapseProps } from './Collapse.js';
import AccordionContext, {
  isAccordionItemSelected,
} from './AccordionContext.js';

export interface AccordionCollapseProps extends CollapseProps {
  /**
   * Element used to render the component.
   */
  as?: React.ElementType | undefined;

  /**
   * A key that corresponds to the toggler that triggers this collapse's expand or collapse.
   */
  eventKey: string;

  /**
   * @default 'accordion-collapse'
   */
  bsPrefix?: string | undefined;
}

/**
 * This component accepts all of [`Collapse`'s props](/docs/utilities/transitions#collapse-1).
 */
const AccordionCollapse: DynamicRefForwardingComponent<
  'div',
  AccordionCollapseProps
> = React.forwardRef<Transition<any>, AccordionCollapseProps>(
  (
    {
      as: Component = 'div',
      bsPrefix,
      className,
      children,
      eventKey,
      ...props
    },
    ref,
  ) => {
    const { activeEventKey } = useContext(AccordionContext);
    bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-collapse');

    return (
      <Collapse
        ref={ref}
        in={isAccordionItemSelected(activeEventKey, eventKey)}
        {...props}
        className={clsx(className, bsPrefix)}
      >
        <Component>{React.Children.only(children)}</Component>
      </Collapse>
    );
  },
);

AccordionCollapse.displayName = 'AccordionCollapse';

export default AccordionCollapse;

```

### Core Architecture Module: `src/AccordionContext.ts`
```
import * as React from 'react';

export type AccordionEventKey = string | string[] | null;

export declare type AccordionSelectCallback = (
  eventKey: AccordionEventKey,
  e: React.SyntheticEvent<unknown>,
) => void;

export interface AccordionContextValue {
  activeEventKey?: AccordionEventKey;
  onSelect?: AccordionSelectCallback;
  alwaysOpen?: boolean;
}

export function isAccordionItemSelected(
  activeEventKey: AccordionEventKey | undefined,
  eventKey: string,
): boolean {
  return Array.isArray(activeEventKey)
    ? activeEventKey.includes(eventKey)
    : activeEventKey === eventKey;
}

const context = React.createContext<AccordionContextValue>({});
context.displayName = 'AccordionContext';

export default context;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6991** (2026-04-14): **OverlayTrigger appears to leak detached nodes**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  Looking at the demo site here https://react-bootstrap.netlify.app/docs/components/overlays/#overlaytrigger  Using the chrome dev tools memory profiler capturing detached nodes shows a leak each time the mouse hovers over the button and the tooltip is rendered  <img width="1535" height="417" alt="Image" src="https://github.com/user-attachments/assets/65c77355-2bd9-41b0-955b-f77dd7a76e4f" />  Those nodes remain even if the user navigates away from that page.  ### Expected behavior  Detached nodes should be cleaned up when the tooltip component is unmounted.   ### To Reproduce  1. Go to https://react-bootstrap.netlify.app/docs/components/overlays/#overlaytrigger 2. Use chrome dev tool memory profiler 3. capture detached element dump 4. hover over the tooltip to trigger it 5. capture detached element dump again  ### Reproducible Example  https://react-bootstrap.netlify.app/docs/components/overlays/#overlaytrigger  ### Screenshots  <img width="1535" height="417" alt="Image" src="https://github.com/user-attachments/assets/65c77355-
  **Post-Mortem & Fix Analysis**:
  > Can i work on it  
  > This is somewhat related to #6987 and https://github.com/react-restart/ui/pull/133, as the issue seems to be linked to Popper.js

- **Issue #6969** (2025-10-27): **Carousel breaks when clicking previous icon with no items**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  Carousel can break and become unable to display any items when clicking previous button when there are no items.  ### Expected behavior  Carousel should not break and become unable to display any items when clicking previous button with no items.  ### To Reproduce  1. Create a carousel with dynamically populated items based on an array. Initial array is empty. 2. Click previous button. Active index gets set to -1. 3. Add an item to the array and update the active index to 0 to display the newly added item. The item indicator appears but the item itself does not actually appear in the carousel and previous, next, and indicator buttons don't do anything so you can never view any of the items that get added to the carousel.  In minimal reproduction pressing the next button before adding results in the item not being displayed and clicking the previous button makes it appear just before it gets transitioned off-screen then bricks the carousel. This does not occur in my actual project and the item gets displayed immediately after 

- **Issue #6967** (2025-11-29): **React 19 + Bootstrap 4 = findDOMNode is not a function**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  "react-bootstrap": "^1.6.8", "bootstrap": "^4.6.2", "react": "19.1.1",  We just upgraded React from 18 to 19, and now react-bootstrap is broken.  `findDOMNode`, which was deprecated in React 18 is now removed in React 19.  I saw that this issue [was fixed in react-bootstrap v2](https://github.com/react-bootstrap/react-bootstrap/issues/5075) which was made for Bootstrap 5, but we cannot upgrade to bootstrap 5 right now, unfortunately.  Do we also have a fix for react-bootstrap v1? Or what would you suggest? Thank you 🙏  <img width="545" height="111" alt="Image" src="https://github.com/user-attachments/assets/939d07e0-b3e9-4d28-8169-0feaa813d77c" />  ### Expected behavior  _No response_  ### To Reproduce  _No response_  ### Reproducible Example  https://codesandbox.io/p/sandbox/nostalgic-water-gjqkyj  ### Screenshots  <img width="545" height="111" alt="Image" src="https://github.com/user-attachments/assets/3124f484-4d74-4f7e-a201-e0cb21b60d42" />  ### What operating system(s) are you seeing the problem on?  macOS  ### What bro
  **Post-Mortem & Fix Analysis**:
  > Unfortunately v1 is no longer being worked on.  If you don't need react 19 features, it's perfectly fine to stay on 18. Alternatively, you can try copying the component source code from the latest branch and tweaking it to work for any bootstrap 4 related feature.  

- **Issue #6964** (2025-09-19): **3.0.0-beta.4 Tab.Container is not working anymore**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  ```shell Type error: Type '{ children: Element; defaultActiveKey: string; }' is not assignable to type 'IntrinsicAttributes & TabContainerProps'.   Property 'children' does not exist on type 'IntrinsicAttributes & TabContainerProps'. ```  ```jsx     <Tab.Container id="left-tabs-example" defaultActiveKey="first">       <Row>         <Col sm={3}>           <Nav variant="pills" className="flex-column">             <Nav.Item>               <Nav.Link eventKey="first">Tab 1</Nav.Link>             </Nav.Item>             <Nav.Item>               <Nav.Link eventKey="second">Tab 2</Nav.Link>             </Nav.Item>           </Nav>         </Col>         <Col sm={9}>           <Tab.Content>             <Tab.Pane eventKey="first">First tab content</Tab.Pane>             <Tab.Pane eventKey="second">Second tab content</Tab.Pane>           </Tab.Content>         </Col>       </Row>     </Tab.Container> ```   ### Expected behavior  _No response_  ### To Reproduce  _No response_  ### Reproducible Example  https://react-bootstrap.netlify.app

- **Issue #6958** (2025-09-19): **Bug**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  When installing ```react-bootstrap``` I get the following warning.  ```warning "react-bootstrap > @restart/ui > @react-aria/ssr@3.8.0" has incorrect peer dependency "react@^16.8.0 || ^17.0.0-rc.1 || ^18.0.0".```  ### Expected behavior  I don't get a warning  ### To Reproduce  yarn add react-bootstrap  ### Reproducible Example  N/A  ### Screenshots  _No response_  ### What operating system(s) are you seeing the problem on?  _No response_  ### What browser(s) are you seeing the problem on?  _No response_  ### What version of React-Bootstrap are you using?  2.10.10  ### What version of Bootstrap are you using?  5.3.7  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Can I work on this?
  > @sarathkumarsasi feel free to work on any issue, no need to ask.  But on that note, this isn't an issue in v3 anymore because we don't use react aria.  The warning shouldn't cause any issues in your application

- **Issue #6955** (2025-08-25): **Toast role and aria-live attributes cannot be changed**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  React Bootstrap Toast components will always have role="alert" and aria-live="assertive", even if the role and aria-live attributes are explicitly set to "status" and "polite", respectively.  ### Expected behavior  Setting the role or aria-live attributes of a toast within the (Toast component's) tag should successfully change the attributes. This is the way toasts work in vanilla Bootstrap.  ### To Reproduce  1. Go to the Toast component tag. 2. Add role="status" and aria-live="polite" 3. Inspect the generated toast using developer tools. The generated toast should incorrectly have role="alert" and aria-live="status"  ### Reproducible Example  https://react-bootstrap.netlify.app/docs/components/toasts#basic  ### Screenshots  _No response_  ### What operating system(s) are you seeing the problem on?  Windows  ### What browser(s) are you seeing the problem on?  Firefox, Microsoft Edge  ### What version of React-Bootstrap are you using?  2.10.10  ### What version of Bootstrap are you using?  5.3.7  ### Additional context  The h

- **Issue #6953** (2025-08-22): **Modals lack a closing animation**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  Native Bootstrap modals play a slide/fade animation on close; the `Modal` component from `react-bootstrap` does not.  The desired animation can be seen on the "Live demo" section of the Bootstrap Modal docs (https://getbootstrap.com/docs/5.3/components/modal/#live-demo). Click "Launch demo modal", then click "Close", and observe the slide/fade animation.  ### Expected behavior  The `Modal` component from `react-bootstrap` should animate on close.  ### To Reproduce  1. Visit the Modal docs: https://react-bootstrap.netlify.app/docs/components/modal#live-demo 2. Scroll to "Live demo". 3. Click "Launch demo modal". 4. Click "Close". Observe that the modal just disappears instead of animating away.  ### Reproducible Example  https://react-bootstrap.netlify.app/docs/components/modal#live-demo  ### Screenshots  _No response_  ### What operating system(s) are you seeing the problem on?  macOS  ### What browser(s) are you seeing the problem on?  Chrome, Safari, Firefox  ### What version of React-Bootstrap are you using?  v3.0.0-beta3 

- **Issue #6944** (2025-08-16): **Bug - Form.Group no longer supported in Bootstrap v5**
  *Symptoms*: ### Prerequisites  - [x] I am using the [correct version](https://github.com/react-bootstrap/react-bootstrap#bootstrap-compatibility) of React-Bootstrap for my version of Bootstrap - [x] I have [searched](https://github.com/react-bootstrap/react-bootstrap/issues?q=is%3Aissue) for duplicate or closed issues - [x] I have read the [contributing guidelines](https://github.com/react-bootstrap/react-bootstrap/blob/master/CONTRIBUTING.md)  ### Describe the bug  Hello, as someone that has been a Bootstrap user for 10 years, and relatively new to the React/Next.js ecosystem, I recently ran into a pesky issue trying to build my first form.  I was following the form instructions at https://react-bootstrap.netlify.app/docs/forms/overview, copy and pasting into a new blank page in my project.  Eventually, I got an error that helpful in pointing in a direction:  > Runtime Error >  > Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports. >  > Check the render method of FormGroup.  I initially tried a bunch of combinations of default/named imports and had a couple sessions of trying to solve this.  Today I created a brand new project with the create-next-app to further try and narrow the issue to make sure it wasn't a conflict with existing code.  Searched the web with very few o
  **Post-Mortem & Fix Analysis**:
  > Form group is still available, but it's not used for styling anymore in bootstrap v5.  This component is kept around in react-bootstrap as a convenience component to inject ids into labels and controls within.    If you want to use FormGroup, in nextjs you cannot use the dot notation when referencing components in app router.  Try something like this  ``` import FormGroup from 'react-bootstrap/FormGroup'  <FormGroup>   ... </FormGroup> ```  
  > Unfortunately this still not working in Next.js. As soon as I remove the `<FormGroup>` component, it fixes. But the convenience to inject ids into labels and controls is very nice, I would like to use it. `<InputGroup>` is working. So maybe something wrong with the export?  ```jsx import Form from "react-bootstrap/Form"; import FormControl from "react-bootstrap/FormControl"; import FormGroup from "react-bootstrap/FormGroup"; import FormLabel from "react-bootstrap/FormLabel"; import FormText from "react-bootstrap/FormText";  <FormGroup className="mb-3" controlId="formBasicEmail">   <FormLabel>Email address</FormLabel>   <FormControl type="email" placeholder="Enter email" />   <FormText className="text-muted">     We'll never share your email with anyone else.   </FormText> </FormGroup> ```  The error:  > Runtime Error >  >  > Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export

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

### Incident Patch 1: `63f1e632` (2026-04-14)
**Commit Message**: Fix #6991: Clear cached popper references when overlays hide (#6995)

* Clear cached popper state when overlays unmount

* Fix OverlaySpec formatting

* Update test/OverlaySpec.tsx

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

**File**: `src/Overlay.tsx` (modified, +13/-0)
```diff
@@ -70,6 +70,11 @@ function wrapRefs(props, arrowProps) {
   arrowProps.ref = aRef.__wrapped || (aRef.__wrapped = (r) => aRef(r));
 }
 
+function clearPopperCache(popperRef: Partial<PopperRef>) {
+  popperRef.state = undefined;
+  popperRef.scheduleUpdate = undefined;
+}
+
 const Overlay = React.forwardRef<HTMLElement, OverlayProps>(
   (
     {
@@ -108,9 +113,17 @@ const Overlay = React.forwardRef<HTMLElement, OverlayProps>(
     useEffect(() => {
       if (!outerShow) {
         setFirstRenderedState(null);
+        clearPopperCache(popperRef.current);
       }
     }, [outerShow]);
 
+    useEffect(
+      () => () => {
+        clearPopperCache(popperRef.current);
+      },
+      [],
+    );
+
     return (
       <BaseOverlay
         {...outerProps}
```

**File**: `test/OverlaySpec.tsx` (modified, +88/-1)
```diff
@@ -1,6 +1,6 @@
 import * as React from 'react';
 import { describe, expect, it } from 'vitest';
-import { render, screen } from '@testing-library/react';
+import { fireEvent, render, screen, waitFor } from '@testing-library/react';
 import Overlay from '../src/Overlay';
 import Popover from '../src/Popover';
 
@@ -41,4 +41,91 @@ describe('<Overlay>', () => {
     const popoverElem = screen.getByTestId('test');
     expect(popoverElem.classList).not.toContain('fade');
   });
+
+  it('should clear cached popper state when an overlay hides', async () => {
+    let capturedPopper: any;
+
+    function OverlayExample() {
+      const target = React.useRef<HTMLButtonElement>(null);
+      const [show, setShow] = React.useState(false);
+
+      return (
+        <>
+          <button
+            ref={target}
+            type="button"
+            data-testid="target"
+            onClick={() => setShow((value) => !value)}
+          >
+            toggle
+          </button>
+          <Overlay show={show} transition={false} target={target.current}>
+            {(props) => {
+              capturedPopper = props.popper;
+
+              return (
+                <Popover id="my-overlay" data-testid="test-overlay" {...props}>
+                  test
+                </Popover>
+              );
+            }}
+          </Overlay>
+        </>
+      );
+    }
+
+    render(<OverlayExample />);
+
+    fireEvent.click(screen.getByTestId('target'));
+
+    await screen.findByTestId('test-overlay');
+    await waitFor(() => expect(capturedPopper.state).toBeDefined());
+    expect(capturedPopper.scheduleUpdate).toBeDefined();
+
+    fireEvent.click(screen.getByTestId('target'));
+
+    await waitFor(() =>
+      expect(screen.queryByTestId('test-overlay')).toBeNull(),
+    );
+    await waitFor(() => expect(capturedPopper.state).toBeUndefined());
+    expect(capturedPopper.scheduleUpdate).toBeUndefined();
+  });
+
+  it('should clear cached popper state when an overlay unmounts', async () => {
+    let capturedPopper: any;
+
+    function OverlayExample() {
+      const target = React.useRef<HTMLButtonElement>(null);
+
+      return (
+        <>
+          <button ref={target} type="button" data-testid="target">
+            toggle
+          </button>
+          <Overlay show transition={false} target={() => target.current}>
+            {(props) => {
+              capturedPopper = props.popper;
+
+              return (
+                <Popover id="my-overlay" data-testid="test-overlay" {...props}>
+                  test
+                </Popover>
+              );
+            }}
+          </Overlay>
+        </>
+      );
+    }
+
+    const { unmount } = render(<OverlayExample />);
+
+    await screen.findByTestId('test-overlay');
+    await waitFor(() => expect(capturedPopper.state).toBeDefined());
+    expect(capturedPopper.scheduleUpdate).toBeDefined();
+
+    unmount();
+
+    expect(capturedPopper.state).toBeUndefined();
+    expect(capturedPopper.scheduleUpdate).toBeUndefined();
+  });
 });
```

---

### Incident Patch 2: `761a3e53` (2025-10-27)
**Commit Message**: chore(deps): update dependency playwright to v1.55.1 [security] (#6973)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +8/-8)
```diff
@@ -5845,17 +5845,17 @@ pkg-dir@^3.0.0:
   dependencies:
     find-up "^3.0.0"
 
-playwright-core@1.55.0:
-  version "1.55.0"
-  resolved "https://registry.yarnpkg.com/playwright-core/-/playwright-core-1.55.0.tgz#ec8a9f8ef118afb3e86e0f46f1393e3bea32adf4"
-  integrity sha512-GvZs4vU3U5ro2nZpeiwyb0zuFaqb9sUiAJuyrWpcGouD8y9/HLgGbNRjIph7zU9D3hnPaisMl9zG9CgFi/biIg==
+playwright-core@1.56.1:
+  version "1.56.1"
+  resolved "https://registry.yarnpkg.com/playwright-core/-/playwright-core-1.56.1.tgz#24a66481e5cd33a045632230aa2c4f0cb6b1db3d"
+  integrity sha512-hutraynyn31F+Bifme+Ps9Vq59hKuUCz7H1kDOcBs+2oGguKkWTU50bBWrtz34OUWmIwpBTWDxaRPXrIXkgvmQ==
 
 playwright@^1.55.0:
-  version "1.55.0"
-  resolved "https://registry.yarnpkg.com/playwright/-/playwright-1.55.0.tgz#7aca7ac3ffd9e083a8ad8b2514d6f9ba401cc78b"
-  integrity sha512-sdCWStblvV1YU909Xqx0DhOjPZE4/5lJsIS84IfN9dAZfcl/CIZ5O8l3o0j7hPMjDvqoTF8ZUcc+i/GL5erstA==
+  version "1.56.1"
+  resolved "https://registry.yarnpkg.com/playwright/-/playwright-1.56.1.tgz#62e3b99ddebed0d475e5936a152c88e68be55fbf"
+  integrity sha512-aFi5B0WovBHTEvpM3DzXTUaeN6eN0qWnTkKx4NQaH4Wvcmc153PdaY2UBdSYKaGYw+UyWXSVyxDUg5DoPEttjw==
   dependencies:
-    playwright-core "1.55.0"
+    playwright-core "1.56.1"
   optionalDependencies:
     fsevents "2.3.2"
 
```

---

### Incident Patch 3: `b652b00c` (2025-10-27)
**Commit Message**: fix(Carousel): ensure nextActiveIndex is non-negative when no children are present (#6972)

Co-authored-by: noeHernandez94 <noe@expresate.io>

**File**: `src/Carousel.tsx` (modified, +1/-1)
```diff
@@ -311,7 +311,7 @@ const Carousel: DynamicRefForwardingComponent<'div', CarouselProps> =
               return;
             }
 
-            nextActiveIndex = numChildren - 1;
+            nextActiveIndex = numChildren > 0 ? numChildren - 1 : 0;
           }
 
           nextDirectionRef.current = 'prev';
```

---

### Incident Patch 4: `5c87f931` (2025-09-19)
**Commit Message**: fix(TabContainer): fix children prop type (#6965)

**File**: `src/TabContainer.tsx` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import type { EventKey, SelectCallback } from '@restart/ui/types';
 import getTabTransitionComponent from './getTabTransitionComponent.js';
 import type { TransitionType } from './helpers.js';
 
-export interface TabContainerProps {
+export interface TabContainerProps extends React.PropsWithChildren {
   /**
    * ID of the TabContainer.
    */
```

**File**: `tests/simple-types-test.tsx` (modified, +3/-1)
```diff
@@ -956,7 +956,9 @@ const MegaComponent = () => (
       onSelect={noop}
       transition={false}
       unmountOnExit
-    />
+    >
+      <div />
+    </Tab.Container>
     <Tab.Content id="id" as="div" bsPrefix="prefix" style={style} />
     <Tab.Pane
       active
```

---

### Incident Patch 5: `3ccb86ed` (2025-08-25)
**Commit Message**: fix(Toast): allow attribute overrides (#6957)

**File**: `src/Toast.tsx` (modified, +3/-3)
```diff
@@ -128,6 +128,9 @@ const Toast: DynamicRefForwardingComponent<'div', ToastProps> =
 
       const toast = (
         <div
+          role="alert"
+          aria-live="assertive"
+          aria-atomic="true"
           {...props}
           ref={ref}
           className={clsx(
@@ -136,9 +139,6 @@ const Toast: DynamicRefForwardingComponent<'div', ToastProps> =
             bg && `bg-${bg}`,
             !hasAnimation && (show ? 'show' : 'hide'),
           )}
-          role="alert"
-          aria-live="assertive"
-          aria-atomic="true"
         />
       );
 
```

**File**: `test/ToastSpec.tsx` (modified, +9/-1)
```diff
@@ -1,6 +1,6 @@
 import * as React from 'react';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
-import { act, fireEvent, render } from '@testing-library/react';
+import { act, fireEvent, render, screen } from '@testing-library/react';
 import Toast from '../src/Toast';
 
 const getToast = ({
@@ -58,6 +58,14 @@ describe('<Toast>', () => {
     );
   });
 
+  it('should allow attribute overrides', () => {
+    render(<Toast role="status" aria-live="polite" />);
+
+    const toast = screen.getByRole('status');
+    expect(toast).toBeDefined();
+    expect(toast.getAttribute('aria-live')).toEqual('polite');
+  });
+
   it('should render without transition if animation is false', () => {
     const { container } = render(
       <Toast animation={false}>
```

---

### Incident Patch 6: `dcfe5dab` (2025-08-22)
**Commit Message**: fix: fix exit animations for various transitions (#6954)

**File**: `src/transitionEndListener.ts` (modified, +2/-2)
```diff
@@ -1,10 +1,10 @@
 import transitionEnd from 'dom-helpers/transitionEnd';
 
-function parseDuration(
+export function parseDuration(
   node: HTMLElement,
   property: 'transition-duration' | 'transition-delay',
 ) {
-  const str = node.style.getPropertyValue(property);
+  const str = getComputedStyle(node).getPropertyValue(property);
   const mult = str.indexOf('ms') === -1 ? 1000 : 1;
   return parseFloat(str) * mult;
 }
```

**File**: `test/transitionEndListenerSpec.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+import * as React from 'react';
+import { render } from '@testing-library/react';
+import { injectCss } from './helpers';
+import Fade from '../src/Fade';
+import { parseDuration } from '../src/transitionEndListener';
+
+describe('transitionEndListener', () => {
+  beforeEach(() => {
+    injectCss(`
+      .test-transition {
+        transition-duration: 0.15s;
+        transition-delay: 1s;
+      }
+    `);
+  });
+
+  afterEach(() => {
+    injectCss.reset();
+  });
+
+  it('should render the Fade component', () => {
+    const ref = React.createRef<HTMLDivElement>();
+    render(
+      <Fade in>
+        <div ref={ref} className="test-transition">
+          test
+        </div>
+      </Fade>,
+    );
+    expect(ref.current).toBeDefined();
+    expect(parseDuration(ref.current!, 'transition-duration')).toEqual(150);
+    expect(parseDuration(ref.current!, 'transition-delay')).toEqual(1000);
+  });
+});
```

---

### Incident Patch 7: `d963283e` (2025-07-24)
**Commit Message**: docs: fix typo in CONTRIBUTING.md (#6438) (#6947)

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ All commits that fix bugs or add features need a test. You can run `npm run tdd
 
 ## API Design
 
-Try and be consistent with the overall style and API of the library as a whole. Generally, we avoid monolithic or very high level component APIs. React bootstrap is a toolbox! Prefer to split components out into "sub components" as they make sense. This is usually indicated by the bootstrap CSS classes, e.g. `.nav`, `.nav-item`, and `.nav-link` translate into `<Nav>`, `<NavItem>`, and `<NavLink>` components.
+Try and be consistent with the overall style and API of the library as a whole. Generally, we avoid monolithic or very high level component APIs. React-Bootstrap is a toolbox! Prefer to split components out into "sub components" as they make sense. This is usually indicated by the bootstrap CSS classes, e.g. `.nav`, `.nav-item`, and `.nav-link` translate into `<Nav>`, `<NavItem>`, and `<NavLink>` components.
 
 Avoid unnecessary Higher Order Components (HOCs), unless they add a significant amount of value or abstract away something that would otherwise complicate many components (like `uncontrollable`). It's not that HOCs are bad, but we want to try and keep these low level UI blocks as flat and straightforward as possible. Prefer to work explicitly in the component and avoid over optimization up front.
 
```

---

### Incident Patch 8: `007167ea` (2025-07-24)
**Commit Message**: chore: fix some minor issues in comments (#6943)

Signed-off-by: yumeiyin <yin.yumei@qq.com>

**File**: `src/Navbar.tsx` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export interface NavbarProps
   bsPrefix?: string | undefined;
 
   /**
-   * The general visual variant a the Navbar.
+   * The general visual variant of the Navbar.
    * Use in combination with the `bg` prop, `background-color` utilities,
    * or your own background styles.
    */
```

**File**: `test/NavbarOffcanvasSpec.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import Navbar from '../src/Navbar';
 import Offcanvas from '../src/Offcanvas';
 
 describe('<NavbarOffcanvas>', () => {
-  it('should should open the offcanvas', () => {
+  it('should open the offcanvas', () => {
     render(
       <Navbar>
         <Navbar.Toggle data-testid="toggle" />
```

---

### Incident Patch 9: `ce560136` (2025-05-24)
**Commit Message**: fix(Col): add missing use client directive (#6930)

**File**: `.babelrc.js` (modified, +5/-1)
```diff
@@ -35,7 +35,11 @@ module.exports = (api) => {
           modules,
           removePropTypes: !dev,
           setUseClient,
-          customClientImports: ['useBootstrapPrefix', 'createWithBsPrefix'],
+          customClientImports: [
+            'useBootstrapPrefix',
+            'createWithBsPrefix',
+            'useCol',
+          ],
         },
       ],
       '@babel/preset-typescript',
```

---

### Incident Patch 10: `71d59e4a` (2025-04-30)
**Commit Message**: chore: fix syntax of generated package.json files (#6918)

**File**: `package.json` (modified, +2/-2)
```diff
@@ -58,8 +58,8 @@
   "scripts": {
     "bootstrap": "yarn --network-timeout 100000 && yarn --cwd www --network-timeout 100000",
     "build": "rimraf lib && yarn build:esm && yarn build:esm:types && yarn build:cjs && yarn build:cjs:types",
-    "build:esm": "babel src --out-dir lib --delete-dir-on-start --env-name esm --extensions .ts,.tsx --ignore '**/*.d.ts' && echo {\"type\": \"module\"} > lib/package.json",
-    "build:cjs": "babel src --out-dir cjs --env-name cjs --delete-dir-on-start --extensions .ts,.tsx --ignore '**/*.d.ts' && echo {\"type\": \"commonjs\"} > cjs/package.json",
+    "build:esm": "babel src --out-dir lib --delete-dir-on-start --env-name esm --extensions .ts,.tsx --ignore '**/*.d.ts' && echo '{\"type\": \"module\"}' > lib/package.json",
+    "build:cjs": "babel src --out-dir cjs --env-name cjs --delete-dir-on-start --extensions .ts,.tsx --ignore '**/*.d.ts' && echo '{\"type\": \"commonjs\"}' > cjs/package.json",
     "build:esm:types": "tsc --emitDeclarationOnly",
     "build:cjs:types": "tsc --emitDeclarationOnly --outDir cjs",
     "build-docs": "yarn --cwd www build",
```

#### Recent Merged Pull Requests:
- **PR #7022** (closed): chore(deps-dev): bump @vitest/browser from 4.1.5 to 4.1.8 (@dependabot[bot])
- **PR #7015** (closed): chore(deps-dev): bump @vitest/browser from 4.1.5 to 4.1.6 (@dependabot[bot])
- **PR #7013** (closed): chore(deps): bump webpack-dev-server from 5.2.3 to 5.2.4 in /www (@dependabot[bot])
- **PR #7010** (closed): chore(deps): bump fast-uri from 3.0.6 to 3.1.2 in /www (@dependabot[bot])
- **PR #7007** (2026-04-26): docs: update docusaurus to 3.10.0 (@kyletsang)
- **PR #7006** (closed): chore(deps): update dependency typescript to v6 - autoclosed (@renovate[bot])
- **PR #7004** (2026-04-25): chore: update to vitest 4 (@kyletsang)
- **PR #7003** (2026-04-25): chore: update to eslint 9 (@kyletsang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
