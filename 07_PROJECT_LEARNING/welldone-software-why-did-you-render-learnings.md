# Forensic Learning Record (Deep Inspection): welldone-software/why-did-you-render

> **Canonical Artifact**: `07_PROJECT_LEARNING/welldone-software-why-did-you-render-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/welldone-software/why-did-you-render](https://github.com/welldone-software/why-did-you-render))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:32.292Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `welldone-software/why-did-you-render`
- **Description**: why-did-you-render by Welldone Software monkey patches React to notify you about potentially avoidable re-renders. (Works with React Native as well.)
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12526 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cypress/e2e/hooks-use-context.js`
```
it('Hooks - useContext', () => {
  cy.visitAndSpyConsole('/#useContext', console => {
    expect(console.group).to.be.calledWithMatches([
      {match: /ComponentWithContextHook$/, times: 2},
      {match: 'Rendered by Main', times: 1},
      {match: 'ComponentWithContextHookInsideMemoizedParent', times: 1},
      {match: '[hook useState result]', times: 1},
      {match: '[hook useContext result]', times: 2},
    ]);

    expect(console.log).to.be.calledWithMatches([
      {match: [() => true, 'Re-rendered because the props object itself changed but its values are all equal.'], times: 1},
      {match: [() => true, 'Re-rendered because of hook changes'], times: 3},
    ]);
  });
});

```

### Core Architecture Module: `cypress/e2e/hooks-use-memo-and-callback-child.js`
```
it('Hooks - useMemo and useCallback Child', () => {
  cy.visitAndSpyConsole('/#useMemoAndCallbackChild', console => {
    cy.contains('button', 'count: 0').click();

    expect(console.group).to.be.calledWithMatches([
      {match: 'Comp', times: 2},
      {match: /useMemoFn/, times: 2},
      {match: /useCallbackFn/, times: 2},
      {match: /props.*\..*count/, times: 1},
    ]);
  });
});

```

### Core Architecture Module: `cypress/e2e/hooks-use-reducer.js`
```
it('Hooks - useReducer', () => {
  const checkConsole = (console, times) => {
    expect(console.group).to.be.calledWithMatches([
      {match: 'Main', times},
      {match: '[hook useReducer result]', times},
    ]);

    expect(console.log).to.be.calledWithMatches([
      {match: 'different objects that are equal by value.', times},
    ]);
  };

  cy.visitAndSpyConsole('/#useReducer', console => {
    cy.contains('button', 'broken set count').click();

    checkConsole(console, 1);
  
    cy.contains('button', 'broken set count').click();
  
    checkConsole(console, 2);
  
    cy.contains('button', 'correct set count').click();
  
    checkConsole(console, 2); // should not cause a re-render because of a current useRender user
  });
});

```

### Core Architecture Module: `cypress/e2e/hooks-use-state.js`
```
it('Hooks - useState', () => {
  cy.visitAndSpyConsole('/#useState', console => {
    cy.get('button:contains("Re-render")')
      .should('have.length', 4)
      .each($btn => {
        cy.wrap($btn).click();
      });

    expect(console.group).to.be.calledWithMatches([
      {match: 'BrokenHooksPureComponent', times: 2},
      {match: '[hook useState result]', times: 2},
    ]);
  });
});

```

### Core Architecture Module: `cypress/e2e/props-and-state-change.js`
```
it('Props And State Changes', () => {
  cy.visitAndSpyConsole('/#bothChanges', console => {
    expect(console.group).to.be.calledWithMatches([
      {match: 'ClassDemo', times: 1},
      {match: /props.*a\W/, times: 1},
      {match: /state.*c\W/, times: 1},
    ]);

    expect(console.log).to.be.calledWithMatches([
      {match: 'different objects that are equal by value.', times: 2},
    ]);
  });
});

```

### Core Architecture Module: `cypress/e2e/state-changes.js`
```
it('state changes', () => {
  cy.visitAndSpyConsole('/#stateChanges', console => {
    expect(console.group).to.be.calledWithMatches([
      {match: 'ClassDemo', times: 2},
      {match: /state.*objectKey\W/, times: 1},
    ]);

    expect(console.log).to.be.calledWithMatches([
      {match: [() => true, 'Re-rendered because the state object itself changed but its values are all equal'], times: 1},
    ]);
  });
});

```

### Core Architecture Module: `demo/src/hooks/useContext.js`
```
import React from 'react';
import createStepLogger from '../createStepLogger';

export default {
  description: 'Hooks - useContext',
  fn({reactDomRoot, whyDidYouRender}) {
    whyDidYouRender(React);

    const stepLogger = createStepLogger();

    const MyContext = React.createContext({c: 'c'});

    let alreadyMountedComponentWithContextHook = false;
    function ComponentWithContextHook() {
      if (alreadyMountedComponentWithContextHook) {
        stepLogger('renders ComponentWithContextHook with deep equal context', true);
      } else {
        alreadyMountedComponentWithContextHook = true;
      }

      const currentContext = React.useContext(MyContext);

      return (
        <p>{currentContext.c}</p>
      );
    }
    ComponentWithContextHook.whyDidYouRender = true;

    let alreadyMountedComponentWithContextHookInsideMemoizedParent = false;
    function ComponentWithContextHookInsideMemoizedParent() {
      if (alreadyMountedComponentWithContextHookInsideMemoizedParent) {
        stepLogger('renders ComponentWithContextHookInsideMemoizedParent with deep equal context', true);
      } else {
        alreadyMountedComponentWithContextHookInsideMemoizedParent = true;
      }

      const currentContext = React.useContext(MyContext);

      return (
        <p>{currentContext.c}</p>
      );
    }
    ComponentWithContextHookInsideMemoizedParent.whyDidYouRender = true;

    const MemoizedParent = React.memo(() => (
      <div>
        <ComponentWithContextHookInsideMemoizedParent/>
      </div>
    ));

    MemoizedParent.displayName = 'MemoizedParent';
    MemoizedParent.whyDidYouRender = true;

    let alreadyMountedMain = false;
    function Main() {
      const [currentState, setCurrentState] = React.useState({c: 'context value'});

      if (alreadyMountedMain) {
        stepLogger('renders Main and it would trigger the render of ComponentWithContextHook because it\'s not pure', true);
      } else {
        alreadyMountedMain = true;
      }

      React.useLayoutEffect(() => {
        setCurrentState({c: 'context value'});
      }, []);

      return (
        <MyContext value={currentState}>
          <h3>
            {`While somehow weird, we have two notifications for "ComponentWithContextHook"
            since it is re-rendered regardless of context changes because "Main" is
            re-rendered and ComponentWithContextHook is not pure`}
          </h3>
          <div>
            ComponentWithContextHook
            <ComponentWithContextHook />
            <br/>
            <br/>
            MemoizedParent
            <MemoizedParent />
          </div>
        </MyContext>
      );
    }

    stepLogger('initial render');
    reactDomRoot.render(<Main/>);
  },
};

```

### Core Architecture Module: `demo/src/hooks/useMemoAndCallbackChild.js`
```
import React from 'react';

import createStepLogger from '../createStepLogger';

export default {
  description: 'Hooks - useMemo and useCallback Child',
  fn({reactDomRoot, whyDidYouRender}) {
    const stepLogger = createStepLogger();

    whyDidYouRender(React);

    const Comp = ({useMemoFn, useCallbackFn}) => {
      const onClick = (...args) => {
        useMemoFn(...args);
        useCallbackFn(...args);
      };
      return <div onClick={onClick}>hi!</div>;
    };
    Comp.displayName = 'Comp';
    Comp.whyDidYouRender = true;

    const ComponentWithNewResultsForNewDeps = React.memo(({count}) => {
      stepLogger('render component with always new results for new deps');

      const useMemoFn = React.useMemo(() => () => 'a', [count]);
      const useCallbackFn = React.useCallback(() => 'a', [count]);

      return (
        <Comp useMemoFn={useMemoFn} useCallbackFn={useCallbackFn}/>
      );
    });
    ComponentWithNewResultsForNewDeps.displayName = 'ComponentWithNewResultsForNewDeps';

    const ComponentWithNewResultsForDeepEqualsDeps = React.memo(({count}) => {
      if (count === 0) {
        stepLogger('render component with always deep equals results - first render', false);
      } else {
        stepLogger('render component with always deep equals results - next render', true);
      }

      const useMemoFn = React.useMemo(() => () => 'a', [{dep1: 'dep1'}]);
      const useCallbackFn = React.useCallback(() => 'a', [{dep2: 'dep2'}]);

      return (
        <Comp useMemoFn={useMemoFn} useCallbackFn={useCallbackFn}/>
      );
    });
    ComponentWithNewResultsForDeepEqualsDeps.displayName = 'ComponentWithNewResultsForDeepEqualsDeps';

    function Main() {
      const [count, setCount] = React.useState(0);

      return (
        <div>
          <button onClick={() => setCount(count + 1)}>
            Current count: {count}
          </button>
          <ComponentWithNewResultsForNewDeps count={count}/>
          <ComponentWithNewResultsForDeepEqualsDeps count={count}/>
        </div>
      );
    }

    Main.displayName = 'Main';

    reactDomRoot.render(<Main/>);
  },
};

```

### Core Architecture Module: `demo/src/hooks/useReducer.js`
```
/* eslint-disable no-console */
import React from 'react';

export default {
  description: 'Hooks - useReducer',
  fn({reactDomRoot, whyDidYouRender}) {
    whyDidYouRender(React);

    function reducer(state, action) {
      switch (action.type) {

      case 'broken-set-count':
        return {count: action.payload.count};

      case 'set-count':
        if (action.payload.count === state.count) {
          return state;
        }
        return {count: action.payload.count};
      }
    }

    const initialState = {count: '0'};

    function Main() {
      const [state, dispatch] = React.useReducer(reducer, initialState);
      const inputRef = React.createRef();

      return (
        <div>
          <p>current count: {state.count}</p>
          <input ref={inputRef} defaultValue="0"/>
          <button
            onClick={() => dispatch({
              type: 'broken-set-count',
              payload: {count: inputRef.current.value},
            })}
          >
            broken set count
          </button>
          <button
            onClick={() => dispatch({
              type: 'set-count',
              payload: {count: inputRef.current.value},
            })}
          >
            correct set count
          </button>
          <br />
          <button onClick={() => console.clear()}>clear console</button>
        </div>
      );
    }
    Main.whyDidYouRender = true;

    reactDomRoot.render(<Main/>);
  },
};

```

### Core Architecture Module: `demo/src/hooks/useState.js`
```
/* eslint-disable no-console */
import React from 'react';

export default {
  description: 'Hooks - useState',
  fn({reactDomRoot, whyDidYouRender}) {
    whyDidYouRender(React);

    function BrokenHooksComponent() {
      console.log('render BrokenHooksComponent');
      const [numObj, setNumObj] = React.useState({num: 0});
      return (
        <>
          <p>{'Will cause a re-render since {num: 0} !== {num: 0}'}</p>
          <button onClick={() => setNumObj({num: 0})}>
            Will Cause a Re-render: {numObj.num}
          </button>
        </>
      );
    }
    BrokenHooksComponent.whyDidYouRender = true;

    const BrokenHooksPureComponent = React.memo(BrokenHooksComponent);
    BrokenHooksPureComponent.displayName = 'BrokenHooksPureComponent';
    BrokenHooksPureComponent.whyDidYouRender = true;

    function CorrectHooksComponent() {
      console.log('render CorrectHooksComponent');
      const [num, setNum] = React.useState(0);
      return (
        <>
          <p>{'Will NOT cause a re-render since 0 === 0'}</p>
          <button onClick={() => setNum(0)}>
            Will NOT Cause a Re-render: {num}
          </button>
        </>
      );
    }
    CorrectHooksComponent.whyDidYouRender = true;

    function useNumState(defState) {
      const [state, setState] = React.useState(defState);

      function smartSetState(newState) {
        if (state.num !== newState.num) {
          setState(newState);
        }
      }

      return [state, smartSetState];
    }

    function SmartHooksComponent() {
      console.log('render SmartHooksComponent');
      const [numObj, setNumObj] = useNumState({num: 0});
      return (
        <>
          <p>{'Will NOT cause a re-render setState won\'t be called'}</p>
          <button onClick={() => setNumObj({num: 0})}>
            Will NOT Cause a Re-render: {numObj.num}
          </button>
        </>
      );
    }
    SmartHooksComponent.whyDidYouRender = true;

    function Main() {
      return (
        <div>
          BrokenHooksPureComponent
          <BrokenHooksPureComponent />
          <br />
          <br />
          BrokenHooksComponent
          <BrokenHooksComponent />
          <br />
          <br />
          CorrectHooksComponent
          <CorrectHooksComponent />
          <br />
          <br />
          SmartHooksComponent
          <SmartHooksComponent />
        </div>
      );
    }

    reactDomRoot.render(<Main/>);
  },
};

```

### Core Architecture Module: `demo/src/stateChanges/index.js`
```
import React from 'react';

import createStepLogger from '../createStepLogger';

export default {
  description: 'State Changes',
  fn({reactDomRoot, whyDidYouRender}) {
    const stepLogger = createStepLogger();

    whyDidYouRender(React);

    class ClassDemo extends React.Component {
      static whyDidYouRender = true;

      state = {
        stateKey: 'stateValue',
      };

      componentDidMount() {
        stepLogger('Set an existing state key with the same value', true);
        this.setState({stateKey: 'stateValue'}, () => {

          stepLogger('Add object entry');
          this.setState({objectKey: {a: 'a'}}, () => {

            stepLogger('Add a new object entry that equals by value', true);
            this.setState({objectKey: {a: 'a'}});
          });
        });
      }

      render() {
        return <div>State Changes</div>;
      }
    }

    stepLogger('First Render');
    reactDomRoot.render(<ClassDemo a={1}/>);
  },
};

```

### Core Architecture Module: `src/utils.js`
```
// copied from https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactTypeOfMode.js
import {REACT_FORWARD_REF_TYPE, REACT_MEMO_TYPE, REACT_STRICT_MODE} from './consts';

// based on "findStrictRoot" from https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactStrictModeWarnings.js
// notice: this is only used for class components. functional components doesn't render twice inside strict mode
export function checkIfInsideAStrictModeTree(reactComponentInstance) {
  let reactInternalFiber = reactComponentInstance && (
    reactComponentInstance._reactInternalFiber ||
    reactComponentInstance._reactInternals
  );

  while (reactInternalFiber) {
    if (reactInternalFiber.mode & REACT_STRICT_MODE) {
      return true;
    }
    reactInternalFiber = reactInternalFiber.return;
  }
  return false;
}

export function isReactClassComponent(Component) {
  return Component.prototype && !!Component.prototype.isReactComponent;
}

export function isMemoComponent(Component) {
  return Component.$$typeof === REACT_MEMO_TYPE;
}

export function isForwardRefComponent(Component) {
  return Component.$$typeof === REACT_FORWARD_REF_TYPE;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #313** (2025-06-09): **Not compatible with React Transition Group on React 19**
  *Symptoms*: The project is on React 19 with new JSX runtime. This is Babel preset config  ```js [   require.resolve("@babel/preset-react"),   {     development: inDevMode,     throwIfNamespace: true,     useBuiltIns: true,     useSpread: true,     runtime: "automatic",     importSource: inDevMode       ? "@welldone-software/why-did-you-render"       : "react"   } ] ``` The build fails in development mode with the error in the 3rd party component `TransitionGroup` (source code https://github.com/reactjs/react-transition-group/blob/master/src/TransitionGroup.js)  ![Image](https://github.com/user-attachments/assets/c98397f5-955d-48ec-990d-b732e018e3d9)  But if `importSource` is commented, then build is successfull  ```js [   require.resolve("@babel/preset-react"),   {     development: inDevMode,     throwIfNamespace: true,     useBuiltIns: true,     useSpread: true,     runtime: "automatic",     // importSource: inDevMode     //   ? "@welldone-software/why-did-you-render"     //   : "react"   } ] ``` But then WhyDidYouRender not working
  **Post-Mortem & Fix Analysis**:
  > I think I found the cause of the issue.  We have the very first import in `index.js`  ```js import "./wdyr"; // other imports ```  and it looks like this  ```js /* eslint-disable global-require */ if (process.env.NODE_ENV === "development") {   const React = require("react");   const whyDidYouRender = require("@welldone-software/why-did-you-render");   whyDidYouRender(React, {     trackAllPureComponents: false   }); } ```  The problem is that `wdyr.js` do not run at all. Webpack tree shaking for some reason drop it from the bundle as side-effect free code. This is another question why? But if I explicitly set this file as side-effect in `package.json`  ```json   "sideEffects": [     "./src/wdyr.js",   ] ```  everyhing starts to work as expected.  So not an issue of this plugin but of Webpack configuration. I close this issue.

- **Issue #213** (2022-04-02): **Wydr is causing bug in @react-navigation/bottom-tabs version 5?**
  *Symptoms*: Whenever I am switching bottom tabs my LogBox gives me a warning saying `Accessing the 'state' property of the 'route' object is not supported. If you want to get the focused route name, use the 'getFocusedRouteNameFromRoute' helper instead:`. But when I uncomment `wydr` import the error resolves. I have posted on StackOverflow about this question too [stackoverflow-question](https://stackoverflow.com/questions/69187743/whenever-i-am-moving-to-different-tab-screens-it-shows-the-error-accessing-the)
  **Post-Mortem & Fix Analysis**:
  > Same issue with StackNavigator
  > +1, same problem with bottom tabs
  > Can you please try again with the latest version of `react-navigation`? I see that they changed the relevant code a little: https://github.com/react-navigation/react-navigation/commit/ebab5183522f5ae03f50f88289c0e7acc208dc02#diff-ac26dec88d71b31af2479666afdc8aaff2b1c846459c603034bf5b7727184516L40

- **Issue #202** (2021-07-08): **Unable to make it work with vite**
  *Symptoms*: Here's my `vite.config.ts`  ```ts import { babel } from "@rollup/plugin-babel"; import reactRefresh from "@vitejs/plugin-react-refresh"; import { defineConfig } from "vite";  // https://vitejs.dev/config/ export default defineConfig({   build: { sourcemap: true },   plugins: [babel(), reactRefresh()], }); ```  and here's my `.babelrc.js` ```js module.exports = {   plugins: ["styled-components"],   presets: [     "@babel/preset-react",     {       runtime: "automatic",       development: process.env.NODE_ENV === "development",       importSource: "@welldone-software/why-did-you-render",     },   ], }; ```  After following the instructions for `wydr.ts`, all I get is a blank screen without anything in the browser console but the vite process throws this:  ``` [BABEL] Note: The code generator has deoptimised the styling of /home/xeoneux/Projects/demo/client/node_modules/.vite/chunk-KROTNZEN.js?v=4aa348e4 as it exceeds the max of 500KB. 2:08:52 AM [vite] Internal server error: ENOENT: no such file or directory, open '/home/xeoneux/Projects/demo/node_modules/vite/src/client/env.ts' ```
  **Post-Mortem & Fix Analysis**:
  > Have you cleared all cache and reinstalled all the dependencies?  It seems like I can't really get to work on it for a while.
  > also, in `.babelrc.js`, you are missing one set of square bracers: ``` presets: [  //  V      ["@babel/preset-react", {        runtime: "automatic",        development: process.env.NODE_ENV === "development",        importSource: "@welldone-software/why-did-you-render",      }] //    ^   ], ```

- **Issue #196** (2021-05-21): **Typescript definition**
  *Symptoms*: I tried to add this lib to my Typescript project (with new the JSX transformation), but I get an error in all of my React code: > Could not find a declaration file for module '@welldone-software/why-did-you-render/jsx-runtime'  This is my `wdyr.ts` file: ``` /// <reference types="@welldone-software/why-did-you-render" />  import React from 'react';  if (process.env.NODE_ENV === 'development') {     const whyDidYouRender = require('@welldone-software/why-did-you-render');     whyDidYouRender(React, {         trackAllPureComponents: true,     }); } ```  What is the correct way to add the types?
  **Post-Mortem & Fix Analysis**:
  > seems like there are no types for the transformation indeed. I'll try adding them asap.
  > hey @hrazmsft ! using ```     // tsconfig.js     "jsx": "react-jsx",     "jsxImportSource": "@welldone-software/why-did-you-render", ``` I don't see any problem.  How do I reproduce this issue?
  > Exactly like that! This is how I have configured my project. Then all the jsx code marked with the error above.  I will try to create a repo that will repro this issue and post it here.

- **Issue #176** (2021-01-29): **Crash after migrating webpack 4 -> 5 with new JSX transforms**
  *Symptoms*: Hello. I'm in the process of migrating from `webpack@4` to `webpack@5`. After doing so, I started getting an uncaught TypeError from `why-did-you-render`.  ![crash](https://user-images.githubusercontent.com/22347954/105021987-1b295600-5a41-11eb-97f0-56415133563a.png)  I believe this is also connected with the latest React JSX transform (I'm using `react@16.14`). At the top of the file I have:  ```js import * as React from 'react';  if (process.env.NODE_ENV === 'development') {   const whyDidYouRender = require('@welldone-software/why-did-you-render');   whyDidYouRender(React); } ```  If I revert back to `webpack@4` and keep the latest JSX transform - it works. If I keep `webpack@5` and revert back to the old React imports - it works. If I use both together - I get the crash above.  Thanks!
  **Post-Mortem & Fix Analysis**:
  > related to #85. i hope it's possible to solve in the first place. ill look at it asap
  > @delyanr, can you please try importing `React` as: ``` import React from 'react'; ``` I reproduced the issue and solved it with this change here: https://github.com/vzaidman/react-webpack5-typescript-with-wdyr/commit/547dbf1e5c6b5300cfdaea3eb0b6f8bf8d782869
  > @vzaidman, yes this stops the crash. As per my original post, also `webpack@4` with the new JSX transforms does NOT crash either. However, after retaining `webpack@4` and migrating to the new JSX transforms, `why-did-you-render` no longer reports anything in the console (basically stopped working for me).  Finally, I don't believe changing the imports is the right solution here anyway, since the React team is likely to change the behavior of the default imports in the future as stated in their [blog post here](https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html).  Thanks for looking into this.

- **Issue #168** (2020-12-30): **RangeError: Maximum call stack size exceeded**
  *Symptoms*: Hello, i implemented your thing to my project And it goes fine.  "@babel/preset-react": "^7.9.4", "react": "^16.13.1", "react-dom": "^16.13.1", "react-redux": "^7.2.0", "@welldone-software/why-did-you-render": "^6.0.3",  When i use it with [hrm], after some changes in files with code, it reloads fine. But, if i press f5, for example, my app crashes with error **RangeError: Maximum call stack size exceeded...**  `RangeError: Maximum call stack size exceeded     at Object.apply (C:\Develop\auchan-ecom-food-front\.yarn\$$virtual\@welldone-software-why-did-you-render-virtual-0f42de02d0\0\cache\@welldone-software-why-did-you-render-npm-6.0.3-f9d43ade3b-2.zip\node_modules\@welldone-software\why-did-you-render\src\whyDidYouRender.js:236:22)     at Object.apply (C:\Develop\auchan-ecom-food-front\.yarn\$$virtual\@welldone-software-why-did-you-render-virtual-0f42de02d0\0\cache\@welldone-software-why-did-you-render-npm-6.0.3-f9d43ade3b-2.zip\node_modules\@welldone-software\why-did-you-render\src\whyDidYouRender.js:257:40)     at Object.apply (C:\Develop\auchan-ecom-food-front\.yarn\$$virtual\@welldone-software-why-did-you-render-virtual-0f42de02d0\0\cache\@welldone-software-why-did-you-render-npm-6.0.3-f9d43ade3b-2.zip\node_modules\@welldone-software\why-did-you-render\src\whyDidYouRender.js:257:40)     at Object.apply (C:\Develop\auchan-ecom-food-front\.yarn\$$virtual\@welldone-software-why-did-you-render-virtual-0f42de02d0\0\cache\@welldone-software-why-did-you-render-
  **Post-Mortem & Fix Analysis**:
  > Upd. tried to watch one component by option `include` , and got the same thing.
  > thanks ill look at it soon
  > @odeal4ik can you please check what is on line 257 of: `node_modules\@welldone-software\why-did-you-render\src\whyDidYouRender.js` and also line 236  also, there is actually no "src" in `node_modules\@welldone-software\why-did-you-render` what kind of system do you use that it exists there?

- **Issue #159** (2020-11-16): **[react-hook-form lib] Different objects that are equal by value for proxied hooks objects**
  *Symptoms*: **Describe the bug** First I've [reported a issue here](https://github.com/react-hook-form/react-hook-form/issues/3451) but investigating, looks like WDYR says that objects are equal by value when they aren't.  **Codesandbox link** https://codesandbox.io/s/react-hook-form-useform-template-forked-rdtej  **Steps to reproduce the behavior:** - Open Codesandbox; - Click on LastName input; - DON'T Type anything; - Leave field; - See console log:  > - Firsts logs showing empty `errors` objects; > - Then WDYR sayng "different objects that are equal by value.", when they aren't the same; > - And last log shows the new, changed, error object  **Expected behavior** WDYR should not log when props changed by reference and value
  **Post-Mortem & Fix Analysis**:
  > Ok, the problem is with the library `react-hook-form` here: https://github.com/react-hook-form/react-hook-form/blob/master/src/useForm.ts#L409  useState should not be mutated, but this library does it, by changing errors directly which is part of the state.  It's actually a great bug to open on them if it's not open because WDYR is far from being the only thing affected by this bug. 
  > bug opened: https://github.com/react-hook-form/react-hook-form/issues/3455
  > sadly, this library does something non-standard, so i can't help with it. I'll try to implement #114 asap so we can turn it off for the library though.

- **Issue #158** (2020-11-13): **static whyDidYouRender = true doesn't have any effect in 5.0.0 **
  *Symptoms*: Using `trackAllPureComponents: true` works fine, but using the static method doesn't do anything after upgrading.
  **Post-Mortem & Fix Analysis**:
  > it seems to work. please check: https://codesandbox.io/s/84xv0nk310. you are free to reopen the issue if I've missed anything
  > Thanks for your reply @vzaidman! Looks good! It hadn't been working for us but that seems to have mysteriously resolved ¯\\\_(ツ)\_/¯
  > can you please try version `6.0.0-rc.1` ? :)

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

### Incident Patch 1: `d6a259dc` (2025-04-04)
**Commit Message**: README: fix negligible spelling

**File**: `README.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ It can also help you to simply track when and why a certain component re-renders
 > The library was not tested with [React Compiler](https://react.dev/learn/react-compiler) at all. I believe it's completely incompatible with it.
 
 > [!CAUTION]
-> Not all re-renders are *"bad"*. Sometimes shenanigan to reduce re-renders can either hurt your App's performance or have a neglagable effect, in which case it would be just a waste of your efforts, and complicate your code. Try to focus on heavier components when optimizing and use the [React DevTools Profiler](https://legacy.reactjs.org/blog/2018/09/10/introducing-the-react-profiler.html) to measure the effects of any changes.
+> Not all re-renders are *"bad"*. Sometimes shenanigan to reduce re-renders can either hurt your App's performance or have a negligible effect, in which case it would be just a waste of your efforts, and complicate your code. Try to focus on heavier components when optimizing and use the [React DevTools Profiler](https://legacy.reactjs.org/blog/2018/09/10/introducing-the-react-profiler.html) to measure the effects of any changes.
 
 > [!NOTE]
 I've joined the React team, specifically working on React tooling. This role has opened up exciting opportunities to enhance the developer experience for React users— and your input could offer valuable insights to help me with this effort. Please join the conversation in the [discussion thread](https://github.com/welldone-software/why-did-you-render/discussions/309)!
```

---

### Incident Patch 2: `5623596e` (2025-01-18)
**Commit Message**: fixed the snyk volurnability badge

**File**: `README.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 [![npm version](https://badge.fury.io/js/%40welldone-software%2Fwhy-did-you-render.svg)](https://badge.fury.io/js/%40welldone-software%2Fwhy-did-you-render)
 [![Build Status](https://github.com/welldone-software/why-did-you-render/actions/workflows/main.yml/badge.svg)](https://github.com/welldone-software/why-did-you-render/actions/workflows/main.yml)
 ![NPM](https://img.shields.io/npm/l/@welldone-software/why-did-you-render?style=flat)
-![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/@welldone-software/why-did-you-render)
+[![@welldone-software/why-did-you-render](https://snyk.io/advisor/npm-package/@welldone-software/why-did-you-render/badge.svg)](https://snyk.io/advisor/npm-package/@welldone-software/why-did-you-render)
 [![Coverage Status](https://coveralls.io/repos/github/welldone-software/why-did-you-render/badge.svg?branch=add-e2e-tests-using-cypress)](https://coveralls.io/github/welldone-software/why-did-you-render?branch=add-e2e-tests-using-cypress)
 
 `why-did-you-render` by [Welldone Software](https://welldone.software/) monkey patches **`React`** to notify you about potentially avoidable re-renders. (Works with **`React Native`** as well.)
```

---

### Incident Patch 3: `25b32e23` (2025-01-18)
**Commit Message**: fix notifier not exposing ownerDataMap

**File**: `src/getUpdateInfo.js` (modified, +1/-0)
```diff
@@ -66,5 +66,6 @@ export default function getUpdateInfo({Component, displayName, hookName, prevOwn
     nextState,
     nextHookResult,
     reason: getUpdateReason(prevOwner, prevProps, prevState, prevHookResult, nextOwner, nextProps, nextState, nextHookResult),
+    ownerDataMap: wdyrStore.ownerDataMap,
   };
 }
```

**File**: `tests/getUpdateInfo.test.js` (modified, +15/-0)
```diff
@@ -34,6 +34,7 @@ describe('getUpdateInfo', () => {
 
     expect(updateInfo).toEqual({
       ...input,
+      ownerDataMap: expect.any(WeakMap),
       displayName: 'TestComponent',
       reason: {
         propsDifferences: [],
@@ -58,6 +59,7 @@ describe('getUpdateInfo', () => {
 
     expect(updateInfo).toEqual({
       ...input,
+      ownerDataMap: expect.any(WeakMap),
       displayName: 'TestComponent',
       reason: {
         propsDifferences: [],
@@ -82,6 +84,7 @@ describe('getUpdateInfo', () => {
 
     expect(updateInfo).toEqual({
       ...input,
+      ownerDataMap: expect.any(WeakMap),
       displayName: 'TestComponent',
       reason: {
         propsDifferences: [],
@@ -106,6 +109,7 @@ describe('getUpdateInfo', () => {
 
     expect(updateInfo).toEqual({
       ...input,
+      ownerDataMap: expect.any(WeakMap),
       displayName: 'TestComponent',
       reason: {
         propsDifferences: [],
@@ -131,6 +135,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -162,6 +167,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [],
         stateDifferences: [
@@ -193,6 +199,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -231,6 +238,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -264,6 +272,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [],
         stateDifferences: [
@@ -297,6 +306,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -335,6 +345,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -366,6 +377,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [],
         stateDifferences: [
@@ -397,6 +409,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -435,6 +448,7 @@ describe('getUpdateInfo', () => {
     expect(updateInfo).toEqual({
       ...input,
       displayName: 'TestComponent',
+      ownerDataMap: expect.any(WeakMap),
       reason: {
         propsDifferences: [
           {
@@ -489,6 +503,7 @@ describe('getUpdateInfo', () => {
 
     expect(updateInfo).toEqual({
       ...input,
+      ownerDataMap: expect.any(WeakMap),
       displayName: 'TestComponent',
       reason: {
         propsDifferences: [
```

---

### Incident Patch 4: `807d7b80` (2025-01-18)
**Commit Message**: cypress testing locally fix

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@welldone-software/why-did-you-render",
   "description": "Monkey patches React to notify you about avoidable re-renders.",
-  "version": "8.0.3",
+  "version": "9.0.0",
   "repository": "git+https://github.com/welldone-software/why-did-you-render.git",
   "license": "MIT",
   "authors": [
@@ -34,7 +34,7 @@
     "lint": "eslint . --max-warnings 0 --cache --cache-location .cache/eslint-cache",
     "clear": "rimraf .cache dist demo/dist node_modules",
     "watch": "concurrently --names \"Serve,Test\" \"npm:start\" \"npm:test:watch\"",
-    "checkHealth": "yarn build && yarn lint && yarn test && yarn cypress:ci",
+    "checkHealth": "yarn build && yarn lint && yarn test && yarn cypress:test",
     "version": "yarn checkHealth",
     "postversion": "git push && git push --tags",
     "cypress:open": "cypress open",
```

---

### Incident Patch 5: `395d14dc` (2025-01-18)
**Commit Message**: fix for react native automatic jsx

**File**: `jsx-dev-runtime.js` (modified, +28/-26)
```diff
@@ -5,33 +5,35 @@ var WDYR = require('@welldone-software/why-did-you-render')
 var origJsxDev = jsxDevRuntime.jsxDEV
 var wdyrStore = WDYR.wdyrStore
 
-module.exports = jsxDevRuntime
-module.exports.jsxDEV = function jsxDEV(...args){
-  if (wdyrStore.React && wdyrStore.React.__IS_WDYR__) {
-    var origType = args[0]
-    var rest = args.slice(1)
-
-    var WDYRType = WDYR.getWDYRType(origType)
-    if (WDYRType) {
-      try {
-        wdyrStore.ownerBeforeElementCreation = WDYR.getCurrentOwner();
-        var element = origJsxDev.apply(null, [WDYRType].concat(rest))
-        if (wdyrStore.options.logOwnerReasons) {
-          WDYR.storeOwnerData(element)
-        }
-        return element
-      } catch(e) {
-        wdyrStore.options.consoleLog('whyDidYouRender JSX transform error. Please file a bug at https://github.com/welldone-software/why-did-you-render/issues.', {
-          errorInfo: {
-            error: e,
-            componentNameOrComponent: origType,
-            rest: rest,
-            options: wdyrStore.options
+module.exports = {
+  ...jsxDevRuntime,
+  jsxDEV(...args) {
+    if (wdyrStore.React && wdyrStore.React.__IS_WDYR__) {
+      var origType = args[0]
+      var rest = args.slice(1)
+  
+      var WDYRType = WDYR.getWDYRType(origType)
+      if (WDYRType) {
+        try {
+          wdyrStore.ownerBeforeElementCreation = WDYR.getCurrentOwner();
+          var element = origJsxDev.apply(null, [WDYRType].concat(rest))
+          if (wdyrStore.options.logOwnerReasons) {
+            WDYR.storeOwnerData(element)
           }
-        })
+          return element
+        } catch(e) {
+          wdyrStore.options.consoleLog('whyDidYouRender JSX transform error. Please file a bug at https://github.com/welldone-software/why-did-you-render/issues.', {
+            errorInfo: {
+              error: e,
+              componentNameOrComponent: origType,
+              rest: rest,
+              options: wdyrStore.options
+            }
+          })
+        }
       }
     }
+    
+    return origJsxDev.apply(null, args)
   }
-  
-  return origJsxDev.apply(null, args)
-}
+};
```

---

### Incident Patch 6: `1fb49ffd` (2025-01-18)
**Commit Message**: fix cypress ci

**File**: `.github/workflows/main.yml` (modified, +0/-10)
```diff
@@ -17,16 +17,6 @@ jobs:
       - name: Run Cypress tests
         run: yarn cypress:ci
 
-  cypress-tests-classic:
-    runs-on: ubuntu-latest
-    strategy:
-      fail-fast: false
-    steps:
-      - uses: actions/checkout@v4
-      - uses: ./.github/actions/setup
-      - name: Run Cypress tests
-        run: yarn cypress:ci:classic
-
   unit-tests:
     runs-on: ubuntu-latest
     steps:
```

**File**: `package.json` (modified, +4/-3)
```diff
@@ -34,12 +34,13 @@
     "lint": "eslint . --max-warnings 0 --cache --cache-location .cache/eslint-cache",
     "clear": "rimraf .cache dist demo/dist node_modules",
     "watch": "concurrently --names \"Serve,Test\" \"npm:start\" \"npm:test:watch\"",
-    "checkHealth": "yarn lint && yarn test",
-    "version": "yarn checkHealth && yarn build",
+    "checkHealth": "yarn build && yarn lint && yarn test && yarn cypress:ci",
+    "version": "yarn checkHealth",
     "postversion": "git push && git push --tags",
     "cypress:open": "cypress open",
     "cypress:run": "cypress run --browser chrome",
-    "cypress:ci": "start-server-and-test start http://localhost:3003 _cypress:run:ci",
+    "cypress:test": "start-server-and-test start http://localhost:3003 cypress:run",
+    "cypress:ci": "start-server-and-test start http://localhost:3003 _cypress:ci",
     "_cypress:ci": "yarn cypress:run --record --group main"
   },
   "comments": {
```

---

### Incident Patch 7: `1562bfc1` (2024-12-29)
**Commit Message**: quick fix to dark mode support

**File**: `README.md` (modified, +3/-1)
```diff
@@ -244,6 +244,7 @@ Optionally you can pass in `options` as the second parameter. The following opti
 - `titleColor`
 - `diffNameColor`
 - `diffPathColor`
+- `textBackgroundColor`
 - `notifier: ({Component, displayName, hookName, prevProps, prevState, prevHookResult, nextProps, nextState, nextHookResult, reason, options, ownerDataMap}) => void`
 - `getAdditionalOwnerData: (element) => {...}`
 
@@ -328,10 +329,11 @@ If you don't want to use `console.group` to group logs you can print them as sim
 
 Grouped logs can be collapsed.
 
-#### titleColor / diffNameColor / diffPathColor
+#### titleColor / diffNameColor / diffPathColor / textBackgroundColor
 ##### (default titleColor: `'#058'`)
 ##### (default diffNameColor: `'blue'`)
 ##### (default diffPathColor: `'red'`)
+##### (default textBackgroundColor: `'white`)
 
 Controls the colors used in the console notifications
 
```

**File**: `src/defaultNotifier.js` (modified, +4/-2)
```diff
@@ -44,7 +44,9 @@ function logDifference({Component, displayName, hookName, prefixMessage, diffObj
       }
       wdyrStore.options.consoleGroup(
         `%c${diffObjType === 'hook' ? `[hook ${hookName} result]` : `${diffObjType}.`}%c${pathString}%c`,
-        `color:${wdyrStore.options.diffNameColor};`, `color:${wdyrStore.options.diffPathColor};`, 'color:default;'
+        `background-color: ${wdyrStore.options.textBackgroundColor};color:${wdyrStore.options.diffNameColor};`,
+        `background-color: ${wdyrStore.options.textBackgroundColor};color:${wdyrStore.options.diffPathColor};`,
+        'background-color: ${wdyrStore.options.textBackgroundColor};color:default;'
       );
       wdyrStore.options.consoleLog(
         `${diffTypesDescriptions[diffType]}. (more info at ${hookName ? moreInfoHooksUrl : moreInfoUrl})`,
@@ -76,7 +78,7 @@ export default function defaultNotifier(updateInfo) {
     return;
   }
 
-  wdyrStore.options.consoleGroup(`%c${displayName}`, `color: ${wdyrStore.options.titleColor};`);
+  wdyrStore.options.consoleGroup(`%c${displayName}`, `background-color: ${wdyrStore.options.textBackgroundColor};color: ${wdyrStore.options.titleColor};`);
 
   let prefixMessage = 'Re-rendered because';
 
```

**File**: `src/normalizeOptions.js` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ export default function normalizeOptions(userOptions = {}) {
     titleColor: '#058',
     diffNameColor: 'blue',
     diffPathColor: 'red',
+    textBackgroundColor: 'white',
     trackExtraHooks: [],
     trackAllPureComponents: false,
     ...userOptions,
```

**File**: `types.d.ts` (modified, +2/-1)
```diff
@@ -43,11 +43,12 @@ export interface WhyDidYouRenderOptions {
   titleColor?: string;
   diffNameColor?: string;
   diffPathColor?: string;
+  textBackgroundColor?: string;
   notifier?: Notifier;
   customName?: string;
 }
 
-export type WhyDidYouRenderComponentMember = WhyDidYouRenderOptions|boolean
+export type WhyDidYouRenderComponentMember = WhyDidYouRenderOptions | boolean
 
 export type Notifier = (options: UpdateInfo) => void
 
```

---

### Incident Patch 8: `5e927f29` (2024-12-29)
**Commit Message**: fixed ssr example

**File**: `demo/serve.js` (modified, +2/-3)
```diff
@@ -16,11 +16,10 @@ if (!port) {
 const app = express();
 
 app.get('/ssrComponent', (req, res) => {
-  const stream = ReactDomServer.renderToNodeStream(
+  const html = ReactDomServer.renderToString(
     React.createElement(DemoComponent, {text: 'hydrated hi'})
   );
-  stream.pipe(res, {end: false});
-  stream.on('end', () => res.end());
+  res.send(html);
 });
 
 const server = http.createServer(app);
```

**File**: `demo/src/App.js` (modified, +11/-6)
```diff
@@ -54,13 +54,18 @@ const defaultDemoName = 'bigList';
 const domElement = document.getElementById('demo');
 let reactDomRoot;
 
-function changeDemo(demoFn) {
+function changeDemo(demoFn, {shouldCreateRoot = true} = {}) {
   console.clear && console.clear(); // eslint-disable-line no-console
   React.__REVERT_WHY_DID_YOU_RENDER__ && React.__REVERT_WHY_DID_YOU_RENDER__();
   reactDomRoot?.unmount();
-  reactDomRoot = ReactDom.createRoot(domElement);
+  if (shouldCreateRoot) {
+    reactDomRoot = ReactDom.createRoot(domElement);
+  }
   setTimeout(() => {
-    demoFn({whyDidYouRender, reactDomRoot});
+    const reactDomRootPromise = demoFn({whyDidYouRender, domElement, reactDomRoot});
+    if (reactDomRootPromise) {
+      reactDomRootPromise.then(r => reactDomRoot = r);
+    }
   }, 1);
 }
 
@@ -70,10 +75,10 @@ if (!demoFromHash) {
   window.location.hash = defaultDemoName;
 }
 
-changeDemo(initialDemo.fn);
+changeDemo(initialDemo.fn, initialDemo.settings);
 
-const DemoLink = ({name, description, fn}) => (
-  <li><a href={`#${name}`} onClick={() => changeDemo(fn)}>{description}</a></li>
+const DemoLink = ({name, description, fn, settings}) => (
+  <li><a href={`#${name}`} onClick={() => changeDemo(fn, settings)}>{description}</a></li>
 );
 
 const App = () => (
```

**File**: `demo/src/ssr/index.js` (modified, +11/-6)
```diff
@@ -1,27 +1,32 @@
 import React from 'react';
-import ReactDom from 'react-dom';
+import ReactDom from 'react-dom/client';
 
 import createStepLogger from '../createStepLogger';
 
 import DemoComponent from './DemoComponent';
 
 export default {
   description: 'Server Side (hydrate)',
-  fn({reactDomRoot, domElement, whyDidYouRender}) {
+  fn({domElement, whyDidYouRender}) {
     const stepLogger = createStepLogger();
 
-    fetch('/ssrComponent')
+    return fetch('/ssrComponent')
       .then(response => response.text())
       .then(initialDemoHTML => {
         domElement.innerHTML = initialDemoHTML;
 
         whyDidYouRender(React);
 
         stepLogger('hydrate');
-        ReactDom.hydrate(<DemoComponent text="hydrated hi"/>, domElement);
+        const hydratedRoot = ReactDom.hydrateRoot(domElement, <DemoComponent text="hydrated hi"/>);
 
-        stepLogger('render with same props', true);
-        reactDomRoot.render(<DemoComponent text="hydrated hi"/>);
+        setTimeout(() => {
+          stepLogger('render with same props', true);
+          hydratedRoot.render(<DemoComponent text="hydrated hi"/>);
+        }, 1);
+
+        return hydratedRoot;
       });
   },
+  settings: {shouldCreateRoot: false},
 };
```

---

### Incident Patch 9: `6c617d6e` (2024-12-29)
**Commit Message**: fixed missing owner display name printing

**File**: `src/defaultNotifier.js` (modified, +37/-35)
```diff
@@ -119,46 +119,48 @@ export default function defaultNotifier(updateInfo) {
     const prevOwnerData = wdyrStore.ownerDataMap.get(prevOwner);
     const nextOwnerData = wdyrStore.ownerDataMap.get(nextOwner);
 
-    wdyrStore.options.consoleGroup(`Rendered by ${nextOwnerData.displayName}`);
-    let prefixMessage = 'Re-rendered because';
-
-    if (reason.ownerDifferences.propsDifferences) {
-      logDifference({
-        Component: nextOwnerData.Component,
-        displayName: nextOwnerData.displayName,
-        prefixMessage,
-        diffObjType: 'props',
-        differences: reason.ownerDifferences.propsDifferences,
-        values: {prev: prevOwnerData.props, next: nextOwnerData.props},
-      });
-      prefixMessage = 'And because';
-    }
-
-    if (reason.ownerDifferences.stateDifferences) {
-      logDifference({
-        Component: nextOwnerData.Component,
-        displayName: nextOwnerData.displayName,
-        prefixMessage,
-        diffObjType: 'state',
-        differences: reason.ownerDifferences.stateDifferences,
-        values: {prev: prevOwnerData.state, next: nextOwnerData.state},
-      });
-    }
-
-    if (reason.ownerDifferences.hookDifferences) {
-      reason.ownerDifferences.hookDifferences.forEach(({hookName, differences}, i) =>
+    if (prevOwnerData && nextOwnerData) {
+      wdyrStore.options.consoleGroup(`Rendered by ${nextOwnerData.displayName}`);
+      let prefixMessage = 'Re-rendered because';
+  
+      if (reason.ownerDifferences.propsDifferences) {
         logDifference({
           Component: nextOwnerData.Component,
           displayName: nextOwnerData.displayName,
           prefixMessage,
-          diffObjType: 'hook',
-          differences,
-          values: {prev: prevOwnerData.hooksInfo[i].result, next: nextOwnerData.hooksInfo[i].result},
-          hookName,
-        })
-      );
+          diffObjType: 'props',
+          differences: reason.ownerDifferences.propsDifferences,
+          values: {prev: prevOwnerData.props, next: nextOwnerData.props},
+        });
+        prefixMessage = 'And because';
+      }
+  
+      if (reason.ownerDifferences.stateDifferences) {
+        logDifference({
+          Component: nextOwnerData.Component,
+          displayName: nextOwnerData.displayName,
+          prefixMessage,
+          diffObjType: 'state',
+          differences: reason.ownerDifferences.stateDifferences,
+          values: {prev: prevOwnerData.state, next: nextOwnerData.state},
+        });
+      }
+  
+      if (reason.ownerDifferences.hookDifferences) {
+        reason.ownerDifferences.hookDifferences.forEach(({hookName, differences}, i) =>
+          logDifference({
+            Component: nextOwnerData.Component,
+            displayName: nextOwnerData.displayName,
+            prefixMessage,
+            diffObjType: 'hook',
+            differences,
+            values: {prev: prevOwnerData.hooksInfo[i].result, next: nextOwnerData.hooksInfo[i].result},
+            hookName,
+          })
+        );
+      }
+      wdyrStore.options.consoleGroupEnd();
     }
-    wdyrStore.options.consoleGroupEnd();
   }
 
   if (!reason.propsDifferences && !reason.stateDifferences && !reason.hookDifferences) {
```

**File**: `src/getUpdateInfo.js` (modified, +2/-0)
```diff
@@ -57,9 +57,11 @@ export default function getUpdateInfo({Component, displayName, hookName, prevOwn
     Component,
     displayName,
     hookName,
+    prevOwner,
     prevProps,
     prevState,
     prevHookResult,
+    nextOwner,
     nextProps,
     nextState,
     nextHookResult,
```

**File**: `src/whyDidYouRender.js` (modified, +4/-4)
```diff
@@ -51,16 +51,16 @@ function trackHookChanges(hookName, {path: pathToGetTrackedHookResult}, rawHookR
 
   const isShouldTrack = shouldTrack(Component, {isHookChange: true});
   if (isShouldTrack && prevResult !== initialHookValue) {
-    const notification = getUpdateInfo({
+    const updateInfo = getUpdateInfo({
       Component: Component,
       displayName,
       hookName,
       prevHookResult: prevResult,
       nextHookResult: nextResult,
     });
-
-    if (notification.reason.hookDifferences) {
-      wdyrStore.options.notifier(notification);
+ 
+    if (updateInfo.reason.hookDifferences) {
+      wdyrStore.options.notifier(updateInfo);
     }
   }
 
```

---

### Incident Patch 10: `db2914c1` (2024-12-29)
**Commit Message**: fix eslint

**File**: `.eslintignore` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-dist
-_*.js
-*.ts
```

**File**: `.eslintrc` (removed, +0/-50)
```diff
@@ -1,50 +0,0 @@
-{
-  "parser": "@babel/eslint-parser",
-  "parserOptions": {
-    "ecmaVersion": 6,
-    "ecmaFeatures": {
-      "jsx": true
-    }
-  },
-  "extends": [
-    "eslint:recommended",
-    "plugin:react/recommended"
-  ],
-  "plugins": [
-    "react"
-  ],
-  "globals": {
-    "flushConsoleOutput": true,
-    "jest": true
-  },
-  "settings": {
-    "react": {
-      "version": "18"
-    }
-  },
-  "env": {
-    "es6": true,
-    "node": true,
-    "browser": true
-  },
-  "rules": {
-    "semi": ["error", "always"],
-    "curly": "error",
-    "no-var": "error",
-    "quotes": ["error", "single"],
-    "no-console": "error",
-    "no-debugger": "warn",
-    "no-unused-vars": ["error", {"ignoreRestSiblings": true}],
-    "eol-last": "error",
-    "object-curly-spacing": ["error", "always"],
-    "react/prop-types": "off",
-    "react/display-name": "off",
-    "space-before-function-paren": ["error", "never"],
-    "space-before-blocks": ["error", "always"],
-    "space-in-parens": ["error", "never"],
-    "comma-dangle": ["error", "only-multiline"],
-    "func-call-spacing": ["error", "never"],
-    "no-multi-spaces": "error",
-    "indent": ["error", 2]
-  }
-}
```

**File**: `.vscode/settings.json` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@
   "eslint.alwaysShowStatus": true,
   "eslint.format.enable": true,
   "eslint.codeActionsOnSave.mode": "problems",
+  "editor.formatOnSave": true,
 
   "flow.enabled": false,
 
@@ -19,6 +20,7 @@
 
   "jestrunner.debugOptions": {"args": ["--watch"]},
   "jestrunner.configPath": "jest.config.js",
+
   "cSpell.words": [
     "astring",
     "lcov",
```

**File**: `demo/src/hooks/useContext.js` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-/* eslint-disable no-console */
 import React from 'react';
 import createStepLogger from '../createStepLogger';
 
```

**File**: `demo/src/ssr/index.js` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import DemoComponent from './DemoComponent';
 
 export default {
   description: 'Server Side (hydrate)',
-  fn({ reactDomRoot, whyDidYouRender }) {
+  fn({ reactDomRoot, domElement, whyDidYouRender }) {
     const stepLogger = createStepLogger();
 
     fetch('/ssrComponent')
```

**File**: `eslint.config.js` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+const reactPlugin = require('eslint-plugin-react');
+const js = require('@eslint/js');
+const globals = require('globals');
+const { includeIgnoreFile } = require('@eslint/compat');
+const pluginCypress = require('eslint-plugin-cypress/flat');
+
+// TODO: remove once all deps are using the latest version
+globals.browser['AudioWorkletGlobalScope'] = globals.browser['AudioWorkletGlobalScope '];
+delete globals.browser['AudioWorkletGlobalScope '];
+
+
+module.exports = [
+  includeIgnoreFile(__dirname +'/.gitignore'),
+  js.configs.recommended,
+  pluginCypress.configs.globals,
+  {
+    plugins: {
+      cypress: pluginCypress
+    },
+    rules: {
+      'cypress/unsafe-to-chain-command': 'error'
+    },
+  },
+  {
+    ...reactPlugin.configs.flat.recommended,
+    languageOptions: {
+      ...reactPlugin.configs.flat.recommended.languageOptions,
+      globals: {
+        ...globals.browser,
+        ...globals.jest,
+        ...globals.node,
+        ...globals.console,
+        flushConsoleOutput: 'readable',
+      },
+    },
+    rules: {
+      'semi': ['error', 'always'],
+      'curly': 'error',
+      'no-var': 'error',
+      'quotes': ['error', 'single'],
+      'no-console': 'error',
+      'no-debugger': 'warn',
+      'react/jsx-uses-vars': 'error',
+      'react/jsx-uses-react': 'error',
+      'no-unused-vars': ['error', {
+        'ignoreRestSiblings': true,
+        'varsIgnorePattern': '^_',
+        'argsIgnorePattern': '^_',
+        'caughtErrorsIgnorePattern': '^_',
+        'destructuredArrayIgnorePattern': '^_'
+      }],
+      'eol-last': 'error',
+      'object-curly-spacing': ['error', 'always'],
+      'react/prop-types': 'off',
+      'react/display-name': 'off',
+      'space-before-function-paren': ['error', 'never'],
+      'space-before-blocks': ['error', 'always'],
+      'space-in-parens': ['error', 'never'],
+      'comma-dangle': ['error', 'only-multiline'],
+      'func-call-spacing': ['error', 'never'],
+      'no-multi-spaces': 'error',
+      'indent': ['error', 2]
+    }
+  }
+];
```

**File**: `jest.polyfills.js` (modified, +2/-2)
```diff
@@ -10,14 +10,14 @@
  */
  
 const { TextDecoder, TextEncoder } = require('node:util');
-// eslint-disable-next-line no-undef
+ 
 Object.defineProperties(globalThis, {
   TextDecoder: { value: TextDecoder },
   TextEncoder: { value: TextEncoder },
 });
  
 const { Blob, File } = require('node:buffer'); 
-// eslint-disable-next-line no-undef
+ 
 Object.defineProperties(globalThis, {
   Blob: { value: Blob },
   File: { value: File },
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -31,7 +31,7 @@
     "build": "cross-env NODE_ENV=production rollup --config --bundleConfigAsCjs",
     "test": "jest --config=jest.config.js",
     "test:ci": "yarn test --coverage",
-    "lint": "eslint . --ext=js --max-warnings 0 --cache --cache-location .cache/eslint-cache",
+    "lint": "eslint . --max-warnings 0 --cache --cache-location .cache/eslint-cache",
     "clear": "rimraf .cache dist demo/dist",
     "watch": "concurrently --names \"Serve,Test\" \"npm:start\" \"npm:test:watch\"",
     "checkHealth": "yarn lint && yarn test",
@@ -82,6 +82,7 @@
     "@babel/plugin-transform-class-properties": "^7.25.9",
     "@babel/preset-env": "^7.26.0",
     "@babel/preset-react": "^7.26.3",
+    "@eslint/compat": "^1.2.4",
     "@rollup/plugin-alias": "^5.1.1",
     "@rollup/plugin-babel": "^6.0.4",
     "@rollup/plugin-commonjs": "^28.0.2",
```

---

### Incident Patch 11: `6bd8f0c9` (2024-12-28)
**Commit Message**: fixed nollup running the demo app + migrated from react-hot-loader to react-refresh

**File**: `README.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ In [Typescript](https://github.com/welldone-software/why-did-you-render/issues/1
 /// <reference types="@welldone-software/why-did-you-render" />
 ```
 
-Import `wdyr` as the first import (even before `react-hot-loader`):
+Import `wdyr` as the first import (even before `react-hot-loader` if you use it):
 
 `index.js`:
 ```jsx
```

**File**: `babel.config.cjs` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ module.exports = function(api) {
   ];
 
   const plugins = compact([
-    (!isProd && !isTest) && 'react-hot-loader/babel',
+    (!isProd && !isTest) && 'react-refresh/babel',
     !isProd && '@babel/plugin-transform-class-properties',
   ]);
 
```

**File**: `demo/nollup.config.js` (modified, +2/-0)
```diff
@@ -3,6 +3,7 @@ const babel = require('@rollup/plugin-babel').default;
 const nodeResolve = require('rollup-plugin-node-resolve');
 const alias = require('rollup-plugin-alias');
 const commonjs = require('rollup-plugin-commonjs-alternate');
+const refresh = require('rollup-plugin-react-refresh');
 
 module.exports = {
   input: 'demo/src/index.js',
@@ -32,5 +33,6 @@ module.exports = {
       mainFields: ['module', 'browser', 'main'],
     }),
     commonjs({}),
+    refresh(),
   ],
 };
```

**File**: `demo/src/App.js` (modified, +8/-7)
```diff
@@ -1,7 +1,6 @@
-import ReactHotLoader from 'react-hot-loader';
-
 import React from 'react';
-import ReactDom from 'react-dom';
+import ReactDom from 'react-dom/client';
+
 import whyDidYouRender from '@welldone-software/why-did-you-render';
 
 import Menu from './Menu';
@@ -52,14 +51,16 @@ const demosList = {
 
 const defaultDemoName = 'bigList';
 
-const domDemoElement = document.getElementById('demo');
+const domElement = document.getElementById('demo');
+let reactDomRoot;
 
 function changeDemo(demoFn) {
   console.clear && console.clear(); // eslint-disable-line no-console
   React.__REVERT_WHY_DID_YOU_RENDER__ && React.__REVERT_WHY_DID_YOU_RENDER__();
-  ReactDom.unmountComponentAtNode(domDemoElement);
+  reactDomRoot?.unmount();
+  reactDomRoot = ReactDom.createRoot(domElement);
   setTimeout(() => {
-    demoFn({ whyDidYouRender, domElement: domDemoElement });
+    demoFn({ whyDidYouRender, reactDomRoot });
   }, 1);
 }
 
@@ -85,6 +86,6 @@ const App = () => (
   </Menu>
 );
 
-export default ReactHotLoader.hot(module)(App);
+export default App;
 
 
```

**File**: `demo/src/bigList/index.js` (modified, +2/-3)
```diff
@@ -1,10 +1,9 @@
 import React from 'react';
-import ReactDom from 'react-dom';
 import { times } from 'lodash';
 
 export default {
   description: 'Big List (Main Demo)',
-  fn({ domElement, whyDidYouRender }) {
+  fn({ reactDomRoot, whyDidYouRender }) {
     whyDidYouRender(React);
 
     class BigListPureComponent extends React.PureComponent {
@@ -49,6 +48,6 @@ export default {
       }
     }
 
-    ReactDom.render(<Main/>, domElement);
+    reactDomRoot.render(<Main/>);
   },
 };
```

**File**: `demo/src/bothChanges/index.js` (modified, +3/-4)
```diff
@@ -1,11 +1,10 @@
 import React from 'react';
-import ReactDom from 'react-dom';
 
 import createStepLogger from '../createStepLogger';
 
 export default {
   description: 'Props And State Changes',
-  fn({ domElement, whyDidYouRender }) {
+  fn({ reactDomRoot, whyDidYouRender }) {
     const stepLogger = createStepLogger();
 
     whyDidYouRender(React);
@@ -29,9 +28,9 @@ export default {
     }
 
     stepLogger('First Render');
-    ReactDom.render(<ClassDemo a={{ b: 'b' }}/>, domElement);
+    reactDomRoot.render(<ClassDemo a={{ b: 'b' }}/>);
 
     stepLogger('Second Render', true);
-    ReactDom.render(<ClassDemo a={{ b: 'b' }}/>, domElement);
+    reactDomRoot.render(<ClassDemo a={{ b: 'b' }}/>);
   },
 };
```

**File**: `demo/src/childOfPureComponent/index.js` (modified, +2/-3)
```diff
@@ -1,9 +1,8 @@
 import React from 'react';
-import ReactDom from 'react-dom';
 
 export default {
   description: 'Child of Pure Component',
-  fn({ domElement, whyDidYouRender }) {
+  fn({ reactDomRoot, whyDidYouRender }) {
     whyDidYouRender(React, {
       trackAllPureComponents: true,
     });
@@ -38,6 +37,6 @@ export default {
       }
     }
 
-    ReactDom.render(<Main/>, domElement);
+    reactDomRoot.render(<Main/>);
   },
 };
```

**File**: `demo/src/cloneElement/index.js` (modified, +3/-4)
```diff
@@ -1,9 +1,8 @@
 import React from 'react';
-import ReactDom from 'react-dom';
 
 export default {
   description: 'Creating react element using React.cloneElement',
-  fn({ domElement, whyDidYouRender }) {
+  fn({ reactDomRoot, whyDidYouRender }) {
     whyDidYouRender(React);
 
     class TestComponent extends React.Component {
@@ -20,7 +19,7 @@ export default {
     const testElement = <TestComponent a={1}/>;
     const testElement2 = React.cloneElement(testElement);
 
-    ReactDom.render(testElement, domElement);
-    ReactDom.render(testElement2, domElement);
+    reactDomRoot.render(testElement);
+    reactDomRoot.render(testElement2);
   },
 };
```

---

### Incident Patch 12: `5fbdd060` (2024-12-28)
**Commit Message**: fix react-redux and improve tests

**File**: `tests/librariesTests/react-redux.test.js` (modified, +1/-0)
```diff
@@ -115,6 +115,7 @@ describe('react-redux - simple', () => {
         {a.b}
       </div>
     );
+    
     const ConnectedSimpleComponent = connect(
       state => ({ a: state.a })
     )(SimpleComponent);
```

**File**: `tests/librariesTests/react-router-dom.test.js` (modified, +25/-16)
```diff
@@ -18,7 +18,6 @@ beforeEach(() => {
   updateInfos = [];
   whyDidYouRender(React, {
     notifier: updateInfo => updateInfos.push(updateInfo),
-    trackAllPureComponents: true,
   });
 });
 
@@ -28,14 +27,19 @@ afterEach(() => {
 
 describe('react-router-dom', () => {
   test('simple', () => {
-    const InnerComp = () => {
+    const InnerComp = ({ a }) => {
       const location = useLocation();
 
+      const [state, setState] = React.useState(0);
+      React.useLayoutEffect(() => {
+        setState(a => a + 1);
+      }, []);
+
       // eslint-disable-next-line no-console
       console.log(`location is: ${location.pathname}`);
 
       return (
-        <div>hi!</div>
+        <div>hi! {JSON.stringify(a)} {state}</div>
       );
     };
 
@@ -44,7 +48,7 @@ describe('react-router-dom', () => {
     const Comp = () => (
       <BrowserRouter>
         <Routes>
-          <Route exact path="/" element={<InnerComp a={[]}/>}/>
+          <Route exact path="/" element={<InnerComp a={{ b: 'c' }}/>}/>
         </Routes>
       </BrowserRouter>
     );
@@ -57,18 +61,25 @@ describe('react-router-dom', () => {
     expect(consoleOutputs).toEqual([
       expect.objectContaining({ args: ['location is: /'] }),
       expect.objectContaining({ args: ['location is: /'] }),
+      expect.objectContaining({ args: ['location is: /'] }),
     ]);
 
+    expect(updateInfos).toHaveLength(2);
     expect(updateInfos).toEqual([
       expect.objectContaining({
+        displayName: 'InnerComp',
+        hookName: 'useState',
+      }),
+      expect.objectContaining({
+        displayName: 'InnerComp',
         reason: {
           hookDifferences: false,
           stateDifferences: false,
           propsDifferences: [{
             diffType: 'deepEquals',
-            nextValue: [],
+            nextValue: { b: 'c' },
             pathString: 'a',
-            prevValue: []
+            prevValue: { b: 'c' },
           }],
           ownerDifferences: {
             hookDifferences: false,
@@ -100,24 +111,22 @@ describe('react-router-dom', () => {
     const InnerFn = ({ a, setDeepEqlState }) => {
       const location = useLocation();
 
-      // eslint-disable-next-line no-console
-      console.log(`location is: ${location.pathname}`);
-
       React.useLayoutEffect(() => {
         setDeepEqlState();
       }, []);
 
+      // eslint-disable-next-line no-console
+      console.log(`location is: ${location.pathname}`);
+
       return <div>hi! {a.b}</div>;
     };
 
-    InnerFn.whyDidYouRender = true;
+    const InnerComp = connect(
+      state => ({ a: state.a }),
+      { setDeepEqlState: () => ({ type: 'deepEqlState' }) }
+    )(InnerFn);
 
-    const InnerComp = (
-      connect(
-        state => ({ a: state.a }),
-        { setDeepEqlState: () => ({ type: 'deepEqlState' }) }
-      )(InnerFn)
-    );
+    InnerFn.whyDidYouRender = true;
 
     const Comp = () => (
       <Provider store={store}>
```

---

### Incident Patch 13: `7325c08f` (2024-12-28)
**Commit Message**: fix forward ref tests

**File**: `jestSetup.js` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@ import { errorOnConsoleOutput } from '@welldone-software/jest-console-handler';
 const substringsToIgnore = [
   'Selectors that return the entire state are almost certainly a mistake',
   'Warning: ReactDOM.render is no longer supported in React 19',
-  'Support for defaultProps will be removed from'
+  'Support for defaultProps will be removed from',
+  'forwardRef render functions accept exactly two parameters'
 ];
 const regexToIgnore = new RegExp(`(${substringsToIgnore.join('|')})`);
 
```

---

### Incident Patch 14: `0b3cdd9f` (2024-09-15)
**Commit Message**: fix detection of current processed component

**File**: `src/whyDidYouRender.js` (modified, +37/-30)
```diff
@@ -20,34 +20,37 @@ export { wdyrStore };
 
 const initialHookValue = Symbol('initial-hook-value');
 
+function getCurrentOwner() {
+  const reactSharedInternals = wdyrStore.React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
+  const reactDispatcher = reactSharedInternals?.A;
+  return reactDispatcher?.getOwner();
+}
+
 function trackHookChanges(hookName, { path: hookPath }, hookResult) {
   const nextHook = hookPath ? get(hookResult, hookPath) : hookResult;
 
-  const renderNumberForTheHook = wdyrStore.React.useRef(true);
+  const prevHookRef = wdyrStore.React.useRef(initialHookValue);
 
-  // TODO: improve
-  const isSecondCycleOfRenders = (
-    wdyrStore.hooksPerRender[0] &&
-    wdyrStore.hooksPerRender[0].renderNumberForTheHook !== renderNumberForTheHook.current
+  // If a new component is rendered, wdyrStore.hooksPerRender is reset with "resetHooksPerRenderIfNeeded".
+  // The below code resets hooksPerRender if the same component is being rendered for a consecutive time
+  // by detecting the increasment of the render count in the first component in wdyrStore.hooksPerRender
+  const newRenderNumberForTheHook = wdyrStore.React.useRef(0);
+  newRenderNumberForTheHook.current++;
+  const isNewComponentRender = (
+    wdyrStore.hooksPerRender.length > 0 &&
+    wdyrStore.hooksPerRender[0].renderNumberForTheHook !== newRenderNumberForTheHook.current
   );
-
-  if (isSecondCycleOfRenders) {
+  if (isNewComponentRender) {
     wdyrStore.hooksPerRender = [];
   }
+  wdyrStore.hooksPerRender.push({ hookName, result: nextHook, renderNumberForTheHook: newRenderNumberForTheHook.current });
 
-  wdyrStore.hooksPerRender.push({ hookName, result: nextHook, renderNumberForTheHook: renderNumberForTheHook.current });
-
-  renderNumberForTheHook.current++;
-
-  const OwnerInstance = wdyrStore.React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.A?.getOwner();
-
-  const prevHookRef = wdyrStore.React.useRef(initialHookValue);
-
-  if (!OwnerInstance) {
+  const ownerInstance = getCurrentOwner();
+  if (!ownerInstance) {
     return hookResult;
   }
 
-  const Component = OwnerInstance.type.ComponentForHooksTracking || OwnerInstance.type;
+  const Component = ownerInstance.type.ComponentForHooksTracking || ownerInstance.type;
   const displayName = getDisplayName(Component);
 
   const isShouldTrack = shouldTrack(Component, { isHookChange: true });
@@ -131,9 +134,9 @@ export const hooksConfig = {
 };
 
 export function storeOwnerData(element) {
-  const OwnerInstance = wdyrStore.React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.A?.getOwner();
-  if (OwnerInstance) {
-    const Component = OwnerInstance.type.ComponentForHooksTracking || OwnerInstance.type;
+  const ownerInstance = getCurrentOwner();
+  if (ownerInstance) {
+    const Component = ownerInstance.type.ComponentForHooksTracking || ownerInstance.type;
     const displayName = getDisplayName(Component);
 
     let additionalOwnerData = {};
@@ -144,24 +147,27 @@ export function storeOwnerData(element) {
     wdyrStore.ownerDataMap.set(element.props, {
       Component,
       displayName,
-      props: OwnerInstance.pendingProps,
-      state: OwnerInstance.stateNode ? OwnerInstance.stateNode.state : null,
+      props: ownerInstance.pendingProps,
+      state: ownerInstance.stateNode ? ownerInstance.stateNode.state : null,
       hooks: wdyrStore.hooksPerRender,
       additionalOwnerData,
     });
   }
 }
 
 function resetHooksPerRenderIfNeeded() {
-  // Intercept assignments to ReactCurrentOwner.current to reset hooksPerRender
-  let currentA = null;
-  if (wdyrStore.React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
-    Object.defineProperty(wdyrStore.React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, 'A', {
+  // Intercept assignments to ReactSharedInternals dispatcher (H) to reset hooksPerRender
+  // Notice: asyncDispatcher (A) is not fit for this purpose because it may only change after hooks
+  // from the next component are processed
+  let currentDispatcher = null;
+  const ReactSharedInternals = wdyrStore.React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
+  if (ReactSharedInternals) {
+    Object.defineProperty(ReactSharedInternals, 'H', {
       get() {
-        return currentA;
+        return currentDispatcher;
       },
       set(value) {
-        currentA = value;
+        currentDispatcher = value;
         wdyrStore.hooksPerRender = [];
       },
     });
@@ -185,13 +191,14 @@ function trackHooksIfNeeded() {
       const originalHook = hookParent[hookName];
       const newHookName = hookName[0].toUpperCase() + hookName.slice(1);
 
-      const newHook = function WhyDidYouRenderReWrittenHook(...args) {
+      const newHook = function useWhyDidYouRenderReWrittenHook(...args) {
         const hookResult = originalHook.call(this, ...args);
         const { dependenciesPath, dontReport } = hookTrackingConfig;
+        const s
```

**File**: `tests/hooks/useContext.test.js` (modified, +52/-13)
```diff
@@ -33,7 +33,7 @@ describe('hooks - useContext', () => {
     const OuterComponent = () => {
       const [currentState, setCurrentState] = React.useState('c');
 
-      React.useLayoutEffect(() => {
+      React.useEffect(() => {
         setCurrentState('c');
       }, []);
 
@@ -68,7 +68,7 @@ describe('hooks - useContext', () => {
     const OuterComponent = () => {
       const [currentState, setCurrentState] = React.useState({ c: 'c' });
 
-      React.useLayoutEffect(() => {
+      React.useEffect(() => {
         setCurrentState({ c: 'c' });
       }, []);
 
@@ -114,7 +114,7 @@ describe('hooks - useContext', () => {
     const OuterComponent = () => {
       const [currentState, setCurrentState] = React.useState({ c: 'c' });
 
-      React.useLayoutEffect(() => {
+      React.useEffect(() => {
         setCurrentState({ c: 'c' });
       }, []);
 
@@ -131,7 +131,11 @@ describe('hooks - useContext', () => {
       <OuterComponent/>
     );
 
-    expect(updateInfos).toHaveLength(2);
+    rtl.render(
+      <OuterComponent/>
+    );
+
+    expect(updateInfos).toHaveLength(4);
     expect(updateInfos[0].reason).toEqual({
       hookDifferences: false,
       propsDifferences: [],
@@ -150,16 +154,51 @@ describe('hooks - useContext', () => {
         stateDifferences: false,
       },
     });
-    expect(updateInfos[1].reason).toEqual({
-      hookDifferences: [{
-        diffType: diffTypes.deepEquals,
-        pathString: '',
-        nextValue: { c: 'c' },
-        prevValue: { c: 'c' },
-      }],
-      propsDifferences: false,
+    expect(updateInfos[1]).toEqual(expect.objectContaining({
+      hookName: 'useContext',
+      reason: {
+        hookDifferences: [{
+          diffType: diffTypes.deepEquals,
+          pathString: '',
+          nextValue: { c: 'c' },
+          prevValue: { c: 'c' },
+        }],
+        propsDifferences: false,
+        stateDifferences: false,
+        ownerDifferences: false,
+      }
+    }));
+    expect(updateInfos[2].reason).toEqual({
+      hookDifferences: false,
+      propsDifferences: [],
       stateDifferences: false,
-      ownerDifferences: false,
+      ownerDifferences: {
+        hookDifferences: [{
+          differences: [{
+            diffType: diffTypes.deepEquals,
+            pathString: '',
+            nextValue: { c: 'c' },
+            prevValue: { c: 'c' },
+          }],
+          hookName: 'useState',
+        }],
+        propsDifferences: false,
+        stateDifferences: false,
+      },
     });
+    expect(updateInfos[3]).toEqual(expect.objectContaining({
+      hookName: 'useContext',
+      reason: {
+        hookDifferences: [{
+          diffType: diffTypes.deepEquals,
+          pathString: '',
+          nextValue: { c: 'c' },
+          prevValue: { c: 'c' },
+        }],
+        propsDifferences: false,
+        stateDifferences: false,
+        ownerDifferences: false,
+      }
+    }));
   });
 });
```

---

### Incident Patch 15: `8cb3d36c` (2024-09-15)
**Commit Message**: fixed error reported when component fails to mount

**File**: `tests/index.test.js` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ test('dont swallow errors', () => {
     );
   };
 
-  expect(mountBrokenComponent).toThrow(/(Cannot read property 'propTypes' of null|Cannot read properties of null \(reading 'propTypes'\))/);
+  expect(mountBrokenComponent).toThrow(/expected a string.*but got.*null/);
 
   global.flushConsoleOutput()
     .map(output => ({
```

#### Recent Merged Pull Requests:
- **PR #328** (closed): Bump lodash from 4.17.21 to 4.17.23 (@dependabot[bot])
- **PR #322** (2025-07-07): dispaly -> display (@John-Colvin)
- **PR #317** (2025-04-15): chore: new feature for convenient documentation browsing (@Olexandr88)
- **PR #316** (2025-04-07): README: fix negligible spelling (@alxndrsn)
- **PR #315** (closed): Update README.md - Replace broken link with another one (@itaikla)
- **PR #314** (closed): Update README.md - change broken link (@itaikla1)
- **PR #312** (2025-02-25): chore: added a link to the license (@Olexandr88)
- **PR #308** (2024-11-15): Add docs for expo managed workflows (@andreazllin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
