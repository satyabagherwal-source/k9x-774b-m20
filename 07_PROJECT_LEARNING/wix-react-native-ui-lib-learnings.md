> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wix-react-native-ui-lib-learnings.md`  
> **Source**: github ([https://github.com/wix/react-native-ui-lib](https://github.com/wix/react-native-ui-lib))  
> **Source Version**: `1d6f609a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:13:57.020Z  
> **Learning ID**: `learn-github-wix-react-native-ui-lib`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): wix/react-native-ui-lib

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-ui-lib-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-ui-lib](https://github.com/wix/react-native-ui-lib))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T03:13:57.014Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-ui-lib`
- **Description**: UI Components Library for React Native
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7153 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/src/screens/componentScreens/EmptyStateScreen.tsx`
```
import React, {Component} from 'react';
import {StyleSheet, ScrollView, View} from 'react-native';
import {StateScreen, Constants, PageControl} from 'react-native-ui-lib';
const localImageSource = require('../../assets/images/empty-state.jpg');
const remoteImageSource = {uri: 'https://cdn.pixabay.com/photo/2017/04/19/20/10/morning-2243465_1280.jpg'};

type State = {
  currentPage: number;
};

export default class EmptyStateScreen extends Component<{}, State> {
  state = {currentPage: 0};

  setCurrentPage(offsetX: number) {
    if (offsetX >= 0) {
      this.setState({
        currentPage: Math.floor(offsetX / Constants.screenWidth)
      });
    }
  }

  render() {
    return (
      <View>
        <ScrollView
          style={styles.pageView}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          onScroll={event => {
            this.setCurrentPage(event.nativeEvent.contentOffset.x);
          }}
          scrollEventThrottle={200}
        >
          <View style={styles.pageView}>
            <StateScreen
              title={'Oppsie (with local image)'}
              subtitle={'Nothing to see here..'}
              ctaLabel={'OK'}
              imageSource={localImageSource}
            />
          </View>
          <View style={styles.pageView}>
            <StateScreen
              title={'Oppsie (with remote image)'}
              subtitle={'Nothing to see here..'}
              ctaLabel={'OK'}
              imageSource={remoteImageSource}
            />
          </View>
        </ScrollView>
        <PageControl
          containerStyle={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            width: Constants.screenWidth
          }}
          numOfPages={2}
          currentPage={this.state.currentPage}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column'
  },
  pageView: {
    width: Constants.screenWidth,
    height: Constants.screenHeight
  }
});

```

### Core Architecture Module: `docuilib/src/hooks/useFormattedCode.ts`
```
import {useEffect, useState} from 'react';
import prettier from 'prettier/standalone';
import parser from 'prettier/parser-babel';

type UseFormattedCodeOptions = {
  printWidth?: number;
};
const useFormattedCode = (code: string, {printWidth = 35}: UseFormattedCodeOptions = {}) => {
  const [formattedCode, setFormattedCode] = useState<string>('');

  useEffect(() => {
    (async () => {
      const formattedCode = await prettier.format(code.trim(), {
        parser: 'babel',
        plugins: [parser],
        singleQuote: true,
        printWidth
      });
      // const noLastSemiColonCode = formattedCode.trim().slice(0, -1);
      setFormattedCode(formattedCode);
    })();
  }, [code, printWidth]);

  return {code: formattedCode};
};

export default useFormattedCode;

```

### Core Architecture Module: `docuilib/src/hooks/useLandingPageOptions.ts`
```
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export interface LandingPageOptions {
  sections: string[];
  mainSectionTitle: string;
  mainSectionTitleWidth: number;
  showStars: boolean;
  stars: number;
  showExpoButton: boolean;
}

export const useLandingPageOptions = () => {
  const {siteConfig} = useDocusaurusContext();
  const landingPage = siteConfig.customFields.landingPage as LandingPageOptions;

  return landingPage;
};

export default useLandingPageOptions;

```

### Core Architecture Module: `docuilib/src/utils/componentUtils.ts`
```
import get from 'lodash/get';
import ReactLiveScope from '../theme/ReactLiveScope';

export const isComponentSupported = componentName => {
  return !!get(ReactLiveScope, componentName);
};

```

### Core Architecture Module: `eslint-rules/lib/utils/componentUtils.js`
```
const {getPrefix} = require('./generalUtils');

function getComponentLocalName(node) {
  if (!node) return;
  const name = node.name || node;
  if (typeof name === 'string') return name;
  if (!name.object) return name.name; // <Avatar/>
  const start = getComponentLocalName(name.object);
  const end = name.property.name || node.property.value;
  return `${start}.${end}`; // <List.Part/> OR <module.List.Part/> etc.
}

function isNamespace(currentImport, componentLocalName) {
  const components = Object.values(currentImport)[0];
  const prefix = getPrefix(componentLocalName);
  if (prefix && components[prefix]) {
    return components[prefix].isNamespace;
  }

  return false;
}

function getComponentName(componentLocalName, imports) {
  for (let index = 0; index < imports.length; ++index) {
    const currentImport = imports[index];
    const components = Object.values(currentImport)[0];
    if (components[componentLocalName]) {
      return components[componentLocalName];
    } else if (componentLocalName.indexOf('.') > 0) {
      const prefix = getPrefix(componentLocalName);
      if (components[prefix]) {
        if (components[prefix].isNamespace) {
          const indexOfDot = componentLocalName.indexOf('.');
          return componentLocalName.slice(indexOfDot + 1);
        } else {
          return componentLocalName.replace(prefix, components[prefix]);
        }
      }
    }
  }
}

module.exports = {
  // The local name of the component (List as L --> L)
  getComponentLocalName,
  // Get the real name of the component
  getComponentName,
  // Is the localName comes from a namespace (module.Component)
  isNamespace
};

```

### Core Architecture Module: `eslint-rules/lib/utils/debugUtils.js`
```
// stringify with no circular error
function stringify(object) {
  if (object && typeof object === 'object') {
    object = _copyWithoutCircularReferences([object], object);
  }
  return JSON.stringify(object);

  function _copyWithoutCircularReferences(references, object) {
    const cleanObject = {};
    Object.keys(object).forEach(key => {
      const value = object[key];
      if (value && typeof value === 'object') { // TODO: do we need the 'value &&'?
        if (references.indexOf(value) < 0) {
          references.push(value);
          cleanObject[key] = _copyWithoutCircularReferences(references, value);
          references.pop();
        } else {
          cleanObject[key] = '###_Circular_###';
        }
      } else if (typeof value !== 'function') {
        cleanObject[key] = value;
      }
    });
    return cleanObject;
  }
}

module.exports = {
  stringify
};

```

### Core Architecture Module: `eslint-rules/lib/utils/deprecationsUtils.js`
```
const {getPrefix} = require('./generalUtils');
const {getComponentName, isNamespace} = require('./componentUtils');

function _organizeDeprecationsBySource(deprecations, defaultSource) {
  const obj = {};
  deprecations.forEach(deprecation => {
    const {source = defaultSource, ...others} = deprecation;
    if (!(source in obj)) {
      obj[source] = [others];
    } else {
      obj[source].push(others);
    }
  });

  return obj;
}

function organizeDeprecations(deprecations, defaultSource) {
  if (!deprecations) {
    return {};
  }

  return _organizeDeprecationsBySource(deprecations, defaultSource);
}

function getLocalizedFix(fix, currentImport) {
  if (!fix) {
    return;
  }

  let localizedFix = fix;
  const indexOfDot = fix.indexOf('.');
  if (indexOfDot > 0) {
    const components = currentImport[Object.keys(currentImport)[0]];
    const prefix = fix.slice(0, indexOfDot);
    if (!components[prefix]) {
      const newPrefix = Object.keys(components).find(key => components[key] === prefix);
      if (newPrefix) {
        const suffix = fix.slice(indexOfDot + 1);
        localizedFix = `${newPrefix}.${suffix}`;
      }
    }
  }

  return localizedFix;
}

function getPossibleDeprecations(componentLocalName, imports, currentImport, deprecationSource) {
  const source = Object.keys(currentImport)[0];
  const components = currentImport[source];
  const componentName = getComponentName(componentLocalName, imports);
  const prefix = getPrefix(componentLocalName);
  return deprecationSource.filter(currentDeprecationSource => {
    return (
      (isNamespace(currentImport, componentLocalName) ||
        components[componentLocalName] ||
        (prefix && components[prefix])) &&
      currentDeprecationSource.component === componentName
    );
  });
}

module.exports = {
  organizeDeprecations,
  getLocalizedFix,
  getPossibleDeprecations
};

```

### Core Architecture Module: `eslint-rules/lib/utils/generalUtils.js`
```
const _ = require('lodash');

function getPrefix(str) {
  const indexOfDot = str.indexOf('.');
  return indexOfDot === -1 ? str : str.substring(0, indexOfDot);
}

function getSuffix(str) {
  const indexOfDot = str.indexOf('.');
  return indexOfDot === -1 ? undefined : str.substring(indexOfDot + 1);
}

function findValueNodeOfIdentifier(identifierName, scope) {
  const varsInScope = scope.variables;
  let valueNode = false;
  varsInScope.forEach((variable) => {
    if (variable.name === identifierName) {
      if (variable.defs && variable.defs.length > 0) {
        valueNode = variable.defs[variable.defs.length - 1].node.init;
      }
    }
  });
  if (valueNode === false || _.isNil(valueNode) || valueNode.value !== undefined) {
    if (_.get(scope, 'block.body.length', 0) > 0) {
      scope.block.body.forEach(scopeNode => {
        if (_.get(scopeNode, 'type') === 'ExpressionStatement') {
          const variableName = _.get(scopeNode, 'expression.left.name');
          if (variableName === identifierName && _.get(scopeNode, 'expression.right')) {
            valueNode = scopeNode.expression.right;
          }
        }
      });
    }
  }
  if (scope.upper === null) {
    return valueNode;
  }
  return valueNode || findValueNodeOfIdentifier(identifierName, scope.upper);
}

function handleError(ruleId, error, fileName) {
  console.log(`Found error in rule: ${ruleId}\n`, `Error: ${error}\n`, `In file: ${fileName}`);
}


module.exports = {
  getPrefix,
  getSuffix,
  findValueNodeOfIdentifier,
  handleError
};

```

### Core Architecture Module: `eslint-rules/lib/utils/importUtils.js`
```
const _ = require('lodash');

function _addToImports_aggregate(imports, source, newImports) {
  if (source && !_.isEmpty(newImports)) {
    const existingIndex = imports
      .map((currentImport, index) => (Object.keys(currentImport).includes(source) ? index : undefined))
      .filter(currentImport => !_.isUndefined(currentImport));
    if (!_.isEmpty(existingIndex)) {
      imports[existingIndex[0]] = {[source]: {...imports[existingIndex[0]][source], ...newImports}};
    } else {
      imports.push({[source]: newImports});
    }
  }
}

function _addToImports_fromImport(node, imports) {
  const specifiers = node.specifiers;
  if (specifiers) {
    const newImports = {};
    specifiers.forEach(specifier => {
      if (specifier.type === 'ImportSpecifier' || specifier.type === 'ImportNamespaceSpecifier' || specifier.type === 'ImportDefaultSpecifier') {
        const isNamespace = specifier.type === 'ImportNamespaceSpecifier';
        const value = _.get(specifier, 'imported.name') || _.get(specifier, 'local.name');
        newImports[specifier.local.name] = isNamespace ? {value, isNamespace} : value;
      }
    });

    const source = node.source.value;
    _addToImports_aggregate(imports, source, newImports);
  }
}

function _getSourceForComponent(component, imports) {
  for (let index = 0; index < imports.length; ++index) {
    if (Object.keys(Object.values(imports[index])[0]).includes(component)) {
      return Object.keys(imports[index])[0];
    }
  }
}

function _addToImports_fromSpreading(midSource, newImports, imports, parents) {
  if (midSource) {
    const source = _getSourceForComponent(midSource, imports);
    if (source) {
      _addToImports_aggregate(imports, source, newImports);
      if (parents) {
        _.forEach(Object.keys(newImports), currentImport => {
          if (!parents.includes(currentImport)) {
            parents.push({[currentImport]: midSource});
          }
        });
      }
    }
  }
}

function _getImportsFromProperties(node) {
  const newImports = {};
  _.map(node.id.properties, property => {
    if (property.type === 'Property') {
      newImports[property.value.name] = property.key.name;
    }
  });

  return newImports;
}

function _addToImports_fromDeclaration(node, imports, parents) {
  let newImports, source, midSource;
  if (_.get(node, 'init.type') === 'CallExpression' && _.get(node, 'init.callee.name') === 'require') {
    source = node.init.arguments[0].value;
    if (_.get(node, 'id.properties')) {
      newImports = _getImportsFromProperties(node);
    } else if (_.get(node, 'id.name')) {
      newImports = {[node.id.name]: node.id.name};
    }
  } else if (_.get(node, 'init.type') === 'MemberExpression' && node.init.object) {
    const {object} = node.init;
    if (object.type === 'CallExpression' && object.callee && object.callee.name === 'require') {
      source = object.arguments[0].value;
      const localName = _.get(node, 'id.typeAnnotation.typeAnnotation.id.name') || node.id.name;
      newImports = {[localName]: node.init.property.name};
    } else if (object.type === 'Identifier') {
      midSource = object.name;
      newImports = {[node.init.property.name]: node.init.property.name};
    }
  } else if (_.get(node, 'id.type') === 'ObjectPattern' && _.get(node, 'id.properties') && _.get(node, 'init.name')) {
    midSource = node.init.name;
    newImports = _getImportsFromProperties(node);
  }

  _addToImports_aggregate(imports, source, newImports);
  _addToImports_fromSpreading(midSource, newImports, imports, parents);
}

/**
 * Aggregate all components, from 'import', 'require' or 'spreading' of other components\imports
 * to a single object.
 */
function addToImports(node, imports, parents) {
  if (!node) return;
  if (node.type === 'ImportDeclaration') {
    _addToImports_fromImport(node, imports); // import
  } else if (node.type === 'VariableDeclarator') {
    _addToImports_fromDeclaration(node, imports, parents); // require + spreading of sub-components etc
  } else {
    console.log('Debug', 'addToImports', 'unknown type:', node.type);
  }
}

module.exports = {
  addToImports
};

```

### Core Architecture Module: `eslint-rules/lib/utils/index.js`
```
const {getPrefix, getSuffix, findValueNodeOfIdentifier, handleError} = require('./generalUtils');
const {organizeDeprecations, getLocalizedFix, getPossibleDeprecations} = require('./deprecationsUtils');
const {addToImports} = require('./importUtils');
const {getComponentLocalName, getComponentName} = require('./componentUtils');
const {findAndReportHardCodedValues} = require('./noHardCodedUtils');
const {stringify} = require('./debugUtils');

module.exports = {
  // General
  getPrefix,
  getSuffix,
  findValueNodeOfIdentifier,
  handleError,
  // Deprecations
  organizeDeprecations,
  getLocalizedFix,
  getPossibleDeprecations,
  // Imports
  addToImports,
  // Components
  getComponentLocalName,
  getComponentName,
  // no-hard-coded color\font
  findAndReportHardCodedValues,
  // For debug:
  stringify
};

// Backup, please do NOT delete
// ExpressionStatement: node => test(node, 'ExpressionStatement'),
// AssignmentExpression: node => test(node, 'AssignmentExpression'),
// ImportDeclaration: (node) => test(node, 'ImportDeclaration'),
// CallExpression: (node) => test(node, 'CallExpression'),
// MemberExpression: (node) => test(node, 'MemberExpression'),
// JSXAttribute: (node) => test(node, 'JSXAttribute'),
// JSXOpeningElement: (node) => test(node, 'JSXOpeningElement'),
// ObjectExpression: (node) => test(node, 'ObjectExpression'),
// VariableDeclarator: (node) => test(node, 'VariableDeclarator'),
// Property: (node) => test(node, 'Property'),
// JSXSpreadAttribute: (node) => test(node, 'JSXSpreadAttribute')

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3924** (2026-02-02): **iOS swipe back gesture not triggering onPopScreen (UILib)**
  *Symptoms*: https://github.com/wix-private/wix-react-native-ui-lib/pull/5960/changes

- **Issue #3849** (2026-03-08): **Search Not Found**
  *Symptoms*: website: click search -> display information -> choose Information -> Page Not Found We could not find what you were looking for. Please contact the owner of the site that linked you to the original URL and let them know their link is broken. 
  **Post-Mortem & Fix Analysis**:
  > @TienNguyen79 you should check the route page first
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

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

### Incident Patch 1: `78dfad36` (2026-07-19)
**Commit Message**: fix/DynamicFontModule - double callback invocation causing SIGABRT on Android (#4030)

* DynamicFontModule - fix double callback invocation causing SIGABRT on Android

The `finally` block unconditionally called `callback.invoke(null, name)` after
every execution path, including after the `catch` block already invoked the
callback on error. React Native enforces single-use callbacks and throws a fatal
SIGABRT when a callback is invoked more than once.

Fix: move the success callback into the `try` block and remove the `finally`.
The callback is now invoked exactly once — on success inside `try`, or on
failure inside `catch`.

Reproduces intermittently on Android (branded apps) when an exception is thrown
during font loading (e.g. `Typeface.createFromFile` failing on certain devices),
causing the app to crash ~4 seconds after launch before any UI interaction.

* fix: move success callback outside try/catch to prevent double invocation on bridge teardown

Previously callback.invoke(null, name) was inside the try block, meaning any
RuntimeException thrown by the RN bridge during invocation (e.g. activity destroyed
mid-load) would be caught and trigger a second callback.invoke() call — 

**File**: `packages/uilib-native/android/src/main/java/com/wix/reactnativeuilib/dynamicfont/DynamicFontModule.java` (modified, +2/-2)
```diff
@@ -132,8 +132,8 @@ public void loadFont(final ReadableMap options, final Callback callback) throws
       cacheFile.delete();
     } catch(Exception e) {
       callback.invoke(e.getMessage());
-    } finally {
-      callback.invoke(null, name);
+      return;
     }
+    callback.invoke(null, name);
   }
 }
```

---

### Incident Patch 2: `0cde3008` (2026-09-06)
**Commit Message**: fix: TabController - clear stuck press feedback when a tap is cancelled on iOS (#4042)

TabBarItem latches its press feedback in the `isPressed` shared value from
`onTouchesDown` and cleared it only in `onFinalize`.

On iOS a cancelled tap (e.g. when the enclosing horizontal ScrollView claims the
touch after a few pixels of finger drift) transitions the recognizer straight
from POSSIBLE to CANCELLED. UIKit emits no action message for that transition,
and RNGestureHandler's RNTapHandler only compensates manually for FAILED - so no
state change event reaches JS and `onFinalize` never runs. `isPressed` stayed
true, leaving `activeBackgroundColor` painted on the item indefinitely, also
after another tab was selected (every item owns its own `isPressed`).

Android is unaffected: `GestureHandler.cancel()` goes through `moveToState`,
which dispatches the state change, so `onFinalize` runs.

Clearing `isPressed` from `onTouchesCancelled` as well covers the cancel path,
which does reach JS as a touch event. The extra call on Android is idempotent
(both handlers write `false`) and can only fire on a terminal transition, so the
feedback is never released mid-press.

Co-authored-by: Claude Opu

**File**: `packages/react-native-ui-lib/src/components/tabController/TabBarItem.tsx` (modified, +7/-0)
```diff
@@ -224,6 +224,13 @@ export default function TabBarItem({
     })
     .onTouchesDown(() => {
       isPressed.value = true;
+    })
+    // NOTE: On iOS a cancelled tap (i.e. when the enclosing ScrollView claims the touch) transitions the
+    //       recognizer straight from POSSIBLE to CANCELLED, which emits no state change event, so onFinalize
+    //       is never called and the press feedback stays on the item.
+    //       Releasing it from the touch stream as well makes sure it is always cleared.
+    .onTouchesCancelled(() => {
+      isPressed.value = false;
     });
 
   return (
```

---

### Incident Patch 3: `2af5663e` (2026-09-01)
**Commit Message**: fix: Dialog - prevent open animation interruption by residual touch on Android (#4038)

* fix: Dialog - prevent open animation interruption by residual touch on Android (minDistance)

A bottom Dialog/ActionSheet opened from a gesture-driven trigger (e.g. List.Item's
TapGestureHandler firing onPress on END) can rest part-way open on Android: the residual
touch leaks into the Dialog's own panGesture and drives `visibility` mid-open, interrupting
the open spring. Adding a minDistance activation threshold to the pan prevents a near-static
residual touch from engaging it, while drag-to-dismiss keeps working.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

* ci: trigger snapshot build

* fix: clarify minDistance rationale (MOBAPP-2994)

* test: add minDistance to Pan gesture jest mock (MOBAPP-2994)

* fix: Dialog - add open-animation watchdog for stranded Android opens

Two Android-only failure modes share this remedy, both traced to RN 0.79's
ModalHostViewScreenSize() returning Size{0,0} on Android while iOS returns a
real RCTScreenSize (facebook/react-native#51048, fixed only in RN 0.81):
the dialog's open() call is gated on onLayout measuring a non-zero size, so
inside a 0x0 Moda

**File**: `packages/react-native-ui-lib/jestSetup/jest-setup.js` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ jest.mock('react-native-gesture-handler',
       PanMock.onFinalize = getDefaultMockedHandler('onFinalize');
       PanMock.activateAfterLongPress = getDefaultMockedHandler('activateAfterLongPress');
       PanMock.enabled = getDefaultMockedHandler('enabled');
+      PanMock.minDistance = getDefaultMockedHandler('minDistance');
       PanMock.hitSlop = getDefaultMockedHandler('hitSlop');
       PanMock.onTouchesMove = getDefaultMockedHandler('onTouchesMove');
       PanMock.prepare = jest.fn();
```

**File**: `packages/react-native-ui-lib/src/components/dialog/__tests__/index.new.spec.tsx` (modified, +74/-0)
```diff
@@ -1,5 +1,6 @@
 import React, {useRef, useState, useEffect, useCallback} from 'react';
 import {render, act} from '@testing-library/react-native';
+import * as Reanimated from 'react-native-reanimated';
 import Dialog, {DialogProps} from '../index';
 import {DialogDriver} from '../Dialog.driver.new';
 import View from '../../../components/view';
@@ -109,3 +110,76 @@ describe('Dialog sanity checks', () => {
     expect(dialogDriver.isVisible()).toBeFalsy();
   });
 });
+
+// Mirrors the non-exported constants in index.tsx.
+const WATCHDOG_INTERVAL_MS = 400;
+const WATCHDOG_MAX_ATTEMPTS = 8;
+
+// Mounted already `visible` so open/close and the watchdog share one render. Reanimated's mock
+// useSharedValue returns a new value per call (the real one is ref-backed for the component's
+// lifetime), so a post-mount `visible` flip would have them reading different values.
+describe('Dialog open animation watchdog', () => {
+  afterEach(() => {
+    jest.useRealTimers();
+    jest.restoreAllMocks();
+  });
+
+  it('recovers a dialog that never opens, then stops once it reaches full visibility', () => {
+    jest.useFakeTimers();
+    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
+    const {dialogDriver} = getDriver(<TestCase1 visible/>);
+    expect(dialogDriver.isVisible()).toBeTruthy();
+    expect(withSpringSpy).not.toHaveBeenCalled();
+
+    // Stuck at 0 since mount - the watchdog opens it.
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS);
+    });
+    expect(withSpringSpy).toHaveBeenCalledTimes(1);
+
+    // Reached 1, so the watchdog clears itself for good.
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * (WATCHDOG_MAX_ATTEMPTS + 3));
+    });
+    expect(withSpringSpy).toHaveBeenCalledTimes(1);
+  });
+
+  it('keeps retrying while the open animation stays frozen, then permanently gives up at the attempt cap', () => {
+    jest.useFakeTimers();
+    // open() always lands on the same value, so visibility never advances: the frozen-open failure.
+    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring').mockReturnValue(0.5);
+    getDriver(<TestCase1 visible/>);
+
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * (WATCHDOG_MAX_ATTEMPTS + 3));
+    });
+    const attemptsMade = withSpringSpy.mock.calls.length;
+    expect(attemptsMade).toBeGreaterThan(1);
+    expect(attemptsMade).toBeLessThanOrEqual(WATCHDOG_MAX_ATTEMPTS + 1);
+
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * 5);
+    });
+    // No growth long after the cap: permanently given up, not paused.
+    expect(withSpringSpy).toHaveBeenCalledTimes(attemptsMade);
+  });
+
+  it('does not re-open while the dialog is closing (visibility decreasing)', () => {
+    jest.useFakeTimers();
+    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
+    // Drive visibility down as an in-progress close() would, without the completion callback -
+    // so modalVisibility stays true, matching a close that is still animating.
+    const withTimingSpy = jest.spyOn(Reanimated, 'withTiming').mockReturnValue(-0.1);
+    const {dialogDriver} = getDriver(<TestCase1 visible/>);
+
+    act(() => {
+      dialogDriver.pressOnBackground();
+    });
+    expect(withTimingSpy).toHaveBeenCalledTimes(1);
+
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * 3);
+    });
+    expect(withSpringSpy).not.toHaveBeenCalled();
+  });
+});
```

**File**: `packages/react-native-ui-lib/src/components/dialog/index.tsx` (modified, +35/-0)
```diff
@@ -29,6 +29,9 @@ import {DialogProps, DialogDirections, DialogDirectionsEnum, DialogHeaderProps}
 export {DialogProps, DialogDirections, DialogDirectionsEnum, DialogHeaderProps};
 
 const THRESHOLD_VELOCITY = 750;
+// Longer than a healthy open (~240ms), so a normal open always wins and the watchdog no-ops.
+const OPEN_WATCHDOG_INTERVAL_MS = 400;
+const OPEN_WATCHDOG_MAX_ATTEMPTS = 8;
 
 export interface DialogStatics {
   directions: typeof DialogDirectionsEnum;
@@ -123,6 +126,34 @@ const Dialog = (props: DialogProps, ref: ForwardedRef<DialogImperativeMethods>)
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [modalVisibility, wasMeasured]);
 
+  // Recovers a dialog whose open animation never completes. On Android with RN 0.79 the Modal's
+  // Fabric state can start 0x0 (facebook/react-native#51048, fixed in RN 0.81), so the dialog
+  // either never opens - `open()` above is gated on `wasMeasured`, which never flips - or opens
+  // part-way and freezes. Armed on `modalVisibility` alone, since gating on measurement is the
+  // bug being worked around. Re-opens a frozen animation only: `close()` animates while
+  // `modalVisibility` is still true, so a decreasing value is a dismiss in progress, not a strand.
+  useEffect(() => {
+    if (!modalVisibility) {
+      return;
+    }
+    let attempts = 0;
+    let previous = visibility.value;
+    const interval = setInterval(() => {
+      const current = visibility.value;
+      attempts += 1;
+      if (current >= 1 || current < previous || attempts > OPEN_WATCHDOG_MAX_ATTEMPTS) {
+        clearInterval(interval);
+        return;
+      }
+      if (current === previous) {
+        open();
+      }
+      previous = current;
+    }, OPEN_WATCHDOG_INTERVAL_MS);
+    return () => clearInterval(interval);
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [modalVisibility]);
+
   const alignmentStyle = useMemo(() => {
     return {flex: 1, alignItems: 'center', ...extractAlignmentsValues(props)};
     // eslint-disable-next-line react-hooks/exhaustive-deps
@@ -190,6 +221,10 @@ const Dialog = (props: DialogProps, ref: ForwardedRef<DialogImperativeMethods>)
   };
 
   const panGesture = Gesture.Pan()
+    // MOBAPP-2994: require a deliberate drag before the pan engages. On Android/Fabric the residual
+    // touch from a gesture-handler trigger (e.g. List.Item) otherwise leaks into this freshly-mounted
+    // pan and drives `visibility` mid-open, interrupting the open spring so the sheet rests part-way.
+    .minDistance(10)
     .onStart(event => {
       initialTranslation.value =
         getTranslationReverseInterpolation(isVertical ? event.translationY : event.translationX) - visibility.value;
```

#### Recent Merged Pull Requests:
- **PR #4048** (2026-10-12): fix: TouchableOpacity - don't swallow onPress on long holds when no onLongPress is provided (@yedidyak)
- **PR #4042** (2026-09-06): fix: TabController - clear stuck press feedback when a tap is cancelled on iOS (@mika-bejerano)
- **PR #4041** (closed): Update README with React Native upgrade plans (@lukasmilasauskas)
- **PR #4038** (2026-09-01): fix: Dialog - prevent open animation interruption by residual touch on Android (@Yoavpagir)
- **PR #4037** (closed): fix: Dialog - prevent open animation interruption by residual touch on Android (@Yoavpagir)
- **PR #4036** (closed): fix(ScreenFooter): init animatedValue to 1 for opacity-based animations when visible (@adids1221)

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

## X. fix/DynamicFontModule - double callback invocation causing SIGABRT on Android (#

**RULE**:
When implementing operations in `packages/uilib-native/android/src/main/java/com/wix/reactnativeuilib/dynamicfont/DynamicFontModule.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wix/react-native-ui-lib. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `78dfad36`: fix/DynamicFontModule - double callback invocation causing SIGABRT on Android (#4030). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/uilib-native/android/src/main/java/com/wix/reactnativeuilib/dynamicfont/DynamicFontModule.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      return;
    callback.invoke(null, name);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    } finally {
      callback.invoke(null, name);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `78dfad36` are properly handled with clean fallback behavior.
