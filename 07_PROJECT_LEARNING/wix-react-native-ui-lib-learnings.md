# Forensic Learning Record (Deep Inspection): wix/react-native-ui-lib

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-ui-lib-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-ui-lib](https://github.com/wix/react-native-ui-lib))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:26.408Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-ui-lib`
- **Description**: UI Components Library for React Native
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7157 stars

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

### Core Architecture Module: `eslint-rules/lib/utils/noHardCodedUtils.js`
```
const {findValueNodeOfIdentifier} = require('./generalUtils');

function _isLiteral(type) {
  return (type === 'Literal' || type === 'TemplateLiteral');
}

function findAndReportHardCodedValues(value, reporter, context, depthOfSearch = 4) {
  if (depthOfSearch === 0) return;
  if (value === undefined || value === false) return;
  if (_isLiteral(value.type)) {
    reporter(value);
  } else if (value.type === 'ConditionalExpression') {
    findAndReportHardCodedValues(value.consequent, reporter, context, depthOfSearch - 1);
    findAndReportHardCodedValues(value.alternate, reporter, context, depthOfSearch - 1);
  } else if (value.type === 'Identifier') {
    findAndReportHardCodedValues(findValueNodeOfIdentifier(value.name, context.getScope()), reporter, context, depthOfSearch - 1);
  }
}

module.exports = {
  findAndReportHardCodedValues
};

```

### Core Architecture Module: `packages/react-native-ui-lib/src/components/hint/hooks/useHintAccessibility.ts`
```
import {ElementRef, useCallback, useMemo} from 'react';
import {AccessibilityInfo, findNodeHandle, View as RNView} from 'react-native';
import _ from 'lodash';
import {HintProps} from '../types';

export default function useHintAccessibility(message?: HintProps['message']) {
  const focusAccessibilityOnHint = useCallback((targetRef: ElementRef<typeof RNView>, hintRef: ElementRef<typeof RNView>) => {
    const targetRefTag = findNodeHandle(targetRef);
    const hintRefTag = findNodeHandle(hintRef);

    if (targetRefTag && _.isString(message)) {
      AccessibilityInfo.setAccessibilityFocus(targetRefTag);
    } else if (hintRefTag) {
      AccessibilityInfo.setAccessibilityFocus(hintRefTag);
    }
  },
  [message]);

  const accessibilityInfo = useMemo(() => {
    if (_.isString(message)) {
      return {
        accessible: true,
        accessibilityLabel: `hint: ${message}`
      };
    }
  }, [message]);

  return {
    focusAccessibilityOnHint,
    accessibilityInfo
  };
}

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

- **Issue #3848** (2026-03-08): **Demo app is broken**
  *Symptoms*: Demo is broken. Would you please fix it?
  **Post-Mortem & Fix Analysis**:
  > I've create a new repository using expo last version, so you can clone this repository and run with expo https://github.com/Vn-ChemGio/react-native-ui-lib
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #3846** (2025-11-20): **Fix for https://github.com/wix/react-native-ui-lib/issues/3845**
  *Symptoms*: ## Description KeyboardTrackingView - fix  ## Changelog KeyboardTrackingView - fix  ## Additional info None 
  **Post-Mortem & Fix Analysis**:
  > ## ✅ PR Description Validation Passed  All required sections are properly filled out:  - ✅ **Description** - ✅ **Changelog** - ✅ **Additional info**  Your PR is good for review! 🚀  --- _This validation ensures all sections from the [PR template](/wix/react-native-ui-lib/blob/master/.github/pull_request_template.md) are properly filled._

- **Issue #3845** (2025-11-20): **UI Lib keyboard tracking bug**
  *Symptoms*: UILib Keyboard tracking is broken because of a previous fix

- **Issue #3834** (2025-11-12): **4**
  *Symptoms*: 

- **Issue #3827** (2025-11-09): **ConnectedKeyboardAccessoryView tracks incorrectly when used with Navigation.showModal**
  *Symptoms*: https://wix.atlassian.net/browse/MADS-4861

- **Issue #3822** (2026-03-08): **ChipsInput's nested TextInput inherits height of entire container even when leadingAccessory causes a flex-wrap**
  *Symptoms*: <!-- NOTE: please submit only bug reports here, any new questions or feature requests should be submitted in Discussions: https://github.com/wix/react-native-ui-lib/discussions  -->  ## Description  <!-- A clear and concise description of what is the bug. -->  - When using Chips Input, when the chips cause a wrap, the TextInput component inherits the resulting parent container height and overflows.  - This is seemingly due to the [nested View for the TextInput compoenent using the centerV prop](https://github.com/wix/react-native-ui-lib/blob/00480e9c6e4b55130145d53371c6b8e4bec449f4/src/components/textField/index.tsx#L168)  <img width="272" height="101" alt="Image" src="https://github.com/user-attachments/assets/12039181-d559-49ae-80a2-7cbaa6b2e99e" />  - Initial chips input  - Text field shown in red for visual clairty  <img width="266" height="56" alt="Image" src="https://github.com/user-attachments/assets/92d1a74c-5607-4aad-b5ad-91a202cc44fb" />  - When not wrapping behaves as expected  <img width="268" height="96" alt="Image" src="https://github.com/user-attachments/assets/24f896b5-403f-4613-8497-f9e899d4c3fd" />  - When wrapped, the TextInput component inherited the parent components height, and overflows. (Chips/"Suggested" text from the 3rd row in the image are from a seperate component) - Also causes unwanted spacing from first and second row  - Can work on/provide a PR for fix if requested!  ### Related to  - [x] Components - [ ] Demo - [ ] Docs - [ ] Typings  ### Ste
  **Post-Mortem & Fix Analysis**:
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

### Incident Patch 1: `0cde3008` (2026-09-06)
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

### Incident Patch 2: `2af5663e` (2026-09-01)
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

---

### Incident Patch 3: `4c988b56` (2026-07-29)
**Commit Message**: fix: ScreenFooter - correct initial opacity for animationType 'none' (Android touch blocking) (#4035)

**File**: `packages/react-native-ui-lib/src/components/screenFooter/useAnimatedFooterStyle.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ const useAnimatedFooterStyle = (
   });
 
   const [height, setHeight] = useState(0);
-  const animatedValue = useSharedValue(animationType === 'fade' && visible ? 1 : 0);
+  const animatedValue = useSharedValue(animationType !== 'slide' && visible ? 1 : 0);
 
   useEffect(() => {
     if (animationType === 'slide') {
```

---

### Incident Patch 4: `373b4c78` (2026-07-28)
**Commit Message**: fix: guard isGravatarUrl against invalid URL strings (#4034)

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `packages/react-native-ui-lib/src/helpers/AvatarHelper.ts` (modified, +6/-2)
```diff
@@ -90,8 +90,12 @@ export function getBackgroundColor(name?: string,
 }
 
 export function isGravatarUrl(url: string) {
-  const {hostname, pathname} = new URL(url);
-  return _.split(hostname, '.').includes('gravatar') && pathname.startsWith('/avatar/');
+  try {
+    const {hostname, pathname} = new URL(url);
+    return _.split(hostname, '.').includes('gravatar') && pathname.startsWith('/avatar/');
+  } catch {
+    return false;
+  }
 }
 
 export function isBlankGravatarUrl(url: string) {
```

**File**: `packages/react-native-ui-lib/src/helpers/__tests__/AvatarHelper.spec.js` (modified, +6/-0)
```diff
@@ -114,6 +114,12 @@ describe('services/AvatarService', () => {
       expect(uut.isGravatarUrl('https://www.gravatars.com/avatar/00000000000000000000000000000000')).toEqual(false);
       expect(uut.isGravatarUrl('https://www.grava.tar/avatar/00000000000000000000000000000000')).toEqual(false);
     });
+
+    it('should return false for an invalid url', () => {
+      expect(uut.isGravatarUrl('fakeUrl')).toEqual(false);
+      expect(uut.isGravatarUrl('fakeUri1')).toEqual(false);
+      expect(uut.isGravatarUrl('')).toEqual(false);
+    });
   });
 
   describe('isBlankGravatarUrl', () => {
```

---

### Incident Patch 5: `5110454d` (2026-07-19)
**Commit Message**: fix: replace url-parse with native URL API (#4033)

Remove the url-parse dependency and use the built-in URL and
URLSearchParams APIs in AvatarHelper instead.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +0/-1)
```diff
@@ -49,7 +49,6 @@
     "@types/react": "19.0.0",
     "@types/react-test-renderer": "^19.0.0",
     "@types/tinycolor2": "^1.4.2",
-    "@types/url-parse": "^1.4.3",
     "@typescript-eslint/eslint-plugin": "^5.62.0",
     "@typescript-eslint/parser": "^5.62.0",
     "@welldone-software/why-did-you-render": "^3.2.1",
```

**File**: `packages/react-native-ui-lib/package.json` (modified, +0/-2)
```diff
@@ -39,7 +39,6 @@
         "react-native-redash": "^12.0.3",
         "semver": "^5.5.0",
         "tinycolor2": "^1.4.2",
-        "url-parse": "^1.2.0",
         "wix-react-native-text-size": "1.0.9"
     },
     "devDependencies": {
@@ -71,7 +70,6 @@
         "@types/react": "19.0.0",
         "@types/react-test-renderer": "19.0.0",
         "@types/tinycolor2": "^1.4.2",
-        "@types/url-parse": "^1.4.3",
         "@welldone-software/why-did-you-render": "^3.2.1",
         "babel-plugin-lodash": "^3.3.4",
         "babel-plugin-module-resolver": "^5.0.0",
```

**File**: `packages/react-native-ui-lib/src/helpers/AvatarHelper.ts` (modified, +3/-6)
```diff
@@ -1,5 +1,4 @@
 import _ from 'lodash';
-import URL from 'url-parse';
 import Colors from '../style/colors';
 import {Typography} from 'style';
 
@@ -100,10 +99,8 @@ export function isBlankGravatarUrl(url: string) {
 }
 
 export function patchGravatarUrl(gravatarUrl: string) {
-  const url = new URL(gravatarUrl, true);
-  const {query} = url;
-  query.d = '404';
-  delete query.default;
-  url.set('query', query);
+  const url = new URL(gravatarUrl);
+  url.searchParams.set('d', '404');
+  url.searchParams.delete('default');
   return url.toString();
 }
```

**File**: `yarn.lock` (modified, +0/-34)
```diff
@@ -3088,13 +3088,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@types/url-parse@npm:^1.4.3":
-  version: 1.4.11
-  resolution: "@types/url-parse@npm:1.4.11"
-  checksum: 10c0/24a470a28393871c83e94006a80f6fb2e7c6dd9c0b031ee575fe792291cf28aec1f0523512b77a09190a4918158e7c68c03c04b8aa97e76b0153aec52f767bd6
-  languageName: node
-  linkType: hard
-
 "@types/yargs-parser@npm:*":
   version: 21.0.3
   resolution: "@types/yargs-parser@npm:21.0.3"
@@ -9351,13 +9344,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"querystringify@npm:^2.1.1":
-  version: 2.2.0
-  resolution: "querystringify@npm:2.2.0"
-  checksum: 10c0/3258bc3dbdf322ff2663619afe5947c7926a6ef5fb78ad7d384602974c467fadfc8272af44f5eb8cddd0d011aae8fabf3a929a8eee4b86edcc0a21e6bd10f9aa
-  languageName: node
-  linkType: hard
-
 "queue-microtask@npm:^1.2.2":
   version: 1.2.3
   resolution: "queue-microtask@npm:1.2.3"
@@ -9659,7 +9645,6 @@ __metadata:
     "@types/react": "npm:19.0.0"
     "@types/react-test-renderer": "npm:^19.0.0"
     "@types/tinycolor2": "npm:^1.4.2"
-    "@types/url-parse": "npm:^1.4.3"
     "@typescript-eslint/eslint-plugin": "npm:^5.62.0"
     "@typescript-eslint/parser": "npm:^5.62.0"
     "@welldone-software/why-did-you-render": "npm:^3.2.1"
@@ -9710,7 +9695,6 @@ __metadata:
     "@types/react": "npm:19.0.0"
     "@types/react-test-renderer": "npm:19.0.0"
     "@types/tinycolor2": "npm:^1.4.2"
-    "@types/url-parse": "npm:^1.4.3"
     "@welldone-software/why-did-you-render": "npm:^3.2.1"
     babel-plugin-lodash: "npm:^3.3.4"
     babel-plugin-module-resolver: "npm:^5.0.0"
@@ -9753,7 +9737,6 @@ __metadata:
     tinycolor2: "npm:^1.4.2"
     typescript: "npm:5.0.4"
     uilib-native: "workspace:*"
-    url-parse: "npm:^1.2.0"
     wix-react-native-text-size: "npm:1.0.9"
   peerDependencies:
     react: ">=19.0.0"
@@ -10077,13 +10060,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"requires-port@npm:^1.0.0":
-  version: 1.0.0
-  resolution: "requires-port@npm:1.0.0"
-  checksum: 10c0/b2bfdd09db16c082c4326e573a82c0771daaf7b53b9ce8ad60ea46aa6e30aaf475fe9b164800b89f93b748d2c234d8abff945d2551ba47bf5698e04cd7713267
-  languageName: node
-  linkType: hard
-
 "reselect@npm:^4.1.7":
   version: 4.1.8
   resolution: "reselect@npm:4.1.8"
@@ -11421,16 +11397,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"url-parse@npm:^1.2.0":
-  version: 1.5.10
-  resolution: "url-parse@npm:1.5.10"
-  dependencies:
-    querystringify: "npm:^2.1.1"
-    requires-port: "npm:^1.0.0"
-  checksum: 10c0/bd5aa9389f896974beb851c112f63b466505a04b4807cea2e5a3b7092f6fbb75316f0491ea84e44f66fed55f1b440df5195d7e3a8203f64fcefa19d182f5be87
-  languageName: node
-  linkType: hard
-
 "use-memo-one@npm:^1.1.1":
   version: 1.1.3
   resolution: "use-memo-one@npm:1.1.3"
```

---

### Incident Patch 6: `78dfad36` (2026-07-19)
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

### Incident Patch 7: `82736d71` (2026-05-25)
**Commit Message**: ScrollFooter - fix another issue with touch not working after scroll (Android real device) | no animation + hide on scroll (#4019)

**File**: `packages/react-native-ui-lib/src/components/screenFooter/useAnimatedFooterStyle.ts` (modified, +2/-2)
```diff
@@ -42,15 +42,15 @@ const useAnimatedFooterStyle = (
     let translateY = 0;
     if (animationType === 'slide') {
       translateY = animatedValue.value;
-    } else if (animationType === 'fade') {
+    } else {
       style = {opacity: animatedValue.value};
     }
 
     if (keyboardBehavior === 'sticky' && Constants.isAndroid) {
       translateY += keyboard.height.value;
     }
 
-    if (animationType === 'slide' || translateY !== 0) {
+    if (translateY !== 0) {
       style.transform = [{translateY}];
     }
 
```

---

### Incident Patch 8: `d0e3857f` (2026-05-24)
**Commit Message**: Fix demo release script (2) (#4018)

**File**: `demo/scripts/releaseDemo.js` (modified, +2/-1)
```diff
@@ -54,7 +54,8 @@ function versionTagAndPublish() {
 }
 
 function findCurrentPublishedVersion() {
-  return exec.execSyncRead(`npm view ${process.env.npm_package_name} dist-tags.latest`);
+  const pkg = isRelease ? process.env.npm_package_name : 'react-native-ui-lib';
+  return exec.execSyncRead(`npm view ${pkg} dist-tags.latest`);
 }
 
 function tryPublishAndTag(version) {
```

---

### Incident Patch 9: `8d24a497` (2026-05-24)
**Commit Message**: Fix demo release script (#4017)

**File**: `demo/scripts/releaseDemo.js` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ function validateEnv() {
   }
   return (
     process.env.BUILDKITE_BRANCH === 'master' ||
-    process.env.BUILDKITE_BRANCH === 'release' ||
+    process.env.BUILDKITE_MESSAGE?.match?.(/^release$/i) ||
     process.env.BUILDKITE_MESSAGE === 'snapshot'
   );
 }
```

---

### Incident Patch 10: `1774e304` (2026-05-24)
**Commit Message**: Infra/fix release script 24 05 26 (#4015)

* Fix release script

* Add release script tests

**File**: `package.json` (modified, +3/-1)
```diff
@@ -11,11 +11,12 @@
     "android": "yarn workspace react-native-ui-lib android",
     "iPad": "yarn workspace react-native-ui-lib iPad",
     "test": "yarn workspace react-native-ui-lib test",
+    "test:releaseScript": "jest scripts/release/__tests__",
     "pretest": "yarn lint",
     "lint": "eslint packages -c .eslintrc.js --ext .tsx,.ts,.js",
     "lint:fix": "eslint packages -c .eslintrc.js --fix",
     "build:dev": "tsc --p tsconfig.dev.json",
-    "pre-push": "yarn build:dev && yarn test",
+    "pre-push": "yarn build:dev && yarn test && yarn test:releaseScript",
     "prepush": "node ./scripts/prepush.js",
     "build": "yarn workspace react-native-ui-lib build",
     "build:local": "yarn workspace react-native-ui-lib build:local",
@@ -61,6 +62,7 @@
     "eslint-plugin-react": "^7.24.0",
     "eslint-plugin-react-hooks": "^4.0.4",
     "eslint-plugin-react-native": "^4.0.0",
+    "jest": "^29.6.3",
     "prettier-eslint": "16.3.0",
     "typescript": "5.0.4"
   }
```

**File**: `scripts/release/__tests__/release.spec.js` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+const {execSync} = require('child_process');
+const fs = require('fs');
+const path = require('path');
+
+const REPO_ROOT = path.resolve(__dirname, '../../..');
+
+jest.setTimeout(30000);
+
+function revertPackageJsons() {
+  const cmd = 'git checkout -- packages/react-native-ui-lib/package.json packages/uilib-native/package.json';
+  execSync(cmd, {cwd: REPO_ROOT, stdio: 'pipe'});
+}
+
+function setPackageJsonVersion(pkgName, version) {
+  const pkgPath = path.join(REPO_ROOT, 'packages', pkgName, 'package.json');
+  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
+  pkg.version = version;
+  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
+}
+
+function npmLatest(pkgName) {
+  return execSync(`npm view ${pkgName} dist-tags.latest`, {encoding: 'utf8'}).trim();
+}
+
+function runRelease(flags) {
+  const out = execSync(`node scripts/release/release.js ${flags.join(' ')}`, {
+    cwd: REPO_ROOT,
+    env: {...process.env, CI: '1', BUILDKITE_BUILD_NUMBER: '99999'},
+    encoding: 'utf8'
+  });
+  const match = out.match(/Packages information:\s*(\[[\s\S]*?\n\])/);
+  if (!match) {
+    throw new Error('Could not parse Packages information JSON from output:\n' + out);
+  }
+  return JSON.parse(match[1]);
+}
+
+const find = (pkgs, name) => pkgs.find(p => p.name === name);
+
+afterEach(() => revertPackageJsons());
+
+describe('react-native-ui-lib', () => {
+  test('release: BK version > npm latest -> releases at BK version', () => {
+    const pkgs = runRelease(['-release', '-bkVersion=99.0.0']);
+    const p = find(pkgs, 'react-native-ui-lib');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toBe('99.0.0');
+  });
+
+  test('release: BK version == npm latest -> does NOT release', () => {
+    const latest = npmLatest('react-native-ui-lib');
+    const pkgs = runRelease(['-release', `-bkVersion=${latest}`]);
+    expect(find(pkgs, 'react-native-ui-lib').shouldRelease).toBe(false);
+  });
+
+  test('release: package.json > npm latest -> releases (OR-fallback gate)', () => {
+    setPackageJsonVersion('react-native-ui-lib', '99.0.0');
+    const pkgs = runRelease(['-release', '-bkVersion=0.0.0']);
+    expect(find(pkgs, 'react-native-ui-lib').shouldRelease).toBe(true);
+  });
+
+  test('master -> releases a snapshot', () => {
+    const pkgs = runRelease(['-master']);
+    const p = find(pkgs, 'react-native-ui-lib');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toMatch(/-snapshot\.99999$/);
+  });
+
+  test('snapshot -> releases a snapshot', () => {
+    const pkgs = runRelease(['-snapshot']);
+    const p = find(pkgs, 'react-native-ui-lib');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toMatch(/-snapshot\.99999$/);
+  });
+});
+
+describe('uilib-native', () => {
+  test('release: BK version > npm latest -> does NOT release (BK does not apply)', () => {
+    const pkgs = runRelease(['-release', '-bkVersion=99.0.0']);
+    expect(find(pkgs, 'uilib-native').shouldRelease).toBe(false);
+  });
+
+  test('release: BK version == npm latest -> does NOT release', () => {
+    const latest = npmLatest('react-native-ui-lib');
+    const pkgs = runRelease(['-release', `-bkVersion=${latest}`]);
+    expect(find(pkgs, 'uilib-native').shouldRelease).toBe(false);
+  });
+
+  test('release: package.json > npm latest -> releases at package.json version', () => {
+    setPackageJsonVersion('uilib-native', '99.0.0');
+    const pkgs = runRelease(['-release', '-bkVersion=0.0.0']);
+    const p = find(pkgs, 'uilib-native');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toBe('99.0.0');
+  });
+
+  test('master -> does NOT release', () => {
+    const pkgs = runRelease(['-master']);
+    expect(find(pkgs, 'uilib-native').shouldRelease).toBe(false);
+  });
+
+  test('snapshot -> releases a snapshot', () => {
+    const pkgs = runRelease(['-snapshot']);
+    const p = find(pkgs, 'uilib-native');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toMatch(/-snapshot\.99999$/);
+  });
+});
```

**File**: `scripts/release/release.js` (modified, +9/-3)
```diff
@@ -38,14 +38,22 @@ const PACKAGES = [
     shouldUpdatePackageJson: true,
     releaseVersionStrategy: isRelease ? 'buildKiteVersion' : 'packageJsonVersion',
     workspaceDeps: ['uilib-native'],
-    shouldRelease: pkg => (isMaster || isRelease ? semver.gt(pkg.packageJsonVersion, pkg.publishedVersion) : !!isSnapshot)
+    shouldRelease: pkg => {
+      if (isRelease) {
+        return semver.gt(pkg.packageJsonVersion, pkg.publishedVersion)
+          || semver.gt(pkg.version, pkg.publishedVersion);
+      }
+      return isMaster || !!isSnapshot;
+    }
   }
 ];
 
 logDebug('Checking if packages should be released...');
 PACKAGES.forEach(package => {
   package.publishedVersion = getPublishedVersion(package.name);
   package.packageJsonVersion = getPackageJsonVersion(package.name);
+  package.path = `packages/${package.name}`;
+  package.version = getVersion(package, dryRun);
   package.shouldRelease = package.shouldRelease(package);
 });
 
@@ -60,8 +68,6 @@ if (!PACKAGES.some(package => package.shouldRelease)) {
 
 logDebug('Getting packages information...');
 PACKAGES.forEach(package => {
-  package.path = `packages/${package.name}`;
-  package.version = getVersion(package, dryRun);
   if (package.workspaceDeps?.length > 0) {
     package.workSpaceTempDeps = [];
     package.workspaceDeps.forEach(dep => {
```

**File**: `scripts/release/releaseUtils.js` (modified, +3/-1)
```diff
@@ -24,6 +24,8 @@ let testSnapshot =
   (process.argv?.find(arg => arg.toLowerCase().includes('-snap'))?.length ?? 0) > 0 ||
   (process.argv?.find(arg => arg.toLowerCase().includes('-s'))?.length ?? 0) > 0;
 
+const bkVersionArg = process.argv.find(arg => arg.startsWith('-bkVersion='))?.split('=')[1];
+
 if (testRelease || testMaster || testSnapshot) {
   dryRun = true;
 }
@@ -58,7 +60,7 @@ function getVersion(package, dryRun) {
       break;
     case 'buildKiteVersion':
       releaseVersion = dryRun
-        ? `${semver.inc(package.packageJsonVersion, 'patch')}-dry-run`
+        ? (bkVersionArg ?? `${semver.inc(package.packageJsonVersion, 'patch')}-dry-run`)
         : childProcess.execSync(`buildkite-agent meta-data get version`).toString();
       break;
   }
```

**File**: `yarn.lock` (modified, +1/-0)
```diff
@@ -9672,6 +9672,7 @@ __metadata:
     eslint-plugin-react: "npm:^7.24.0"
     eslint-plugin-react-hooks: "npm:^4.0.4"
     eslint-plugin-react-native: "npm:^4.0.0"
+    jest: "npm:^29.6.3"
     prettier-eslint: "npm:16.3.0"
     typescript: "npm:5.0.4"
   languageName: unknown
```

---

### Incident Patch 11: `0beec380` (2026-05-20)
**Commit Message**: SkeletonView - fix types (static types) (#4012)

**File**: `packages/react-native-ui-lib/src/components/skeletonView/index.tsx` (modified, +2/-1)
```diff
@@ -7,6 +7,7 @@ import {createShimmerPlaceholder, LinearGradientPackage} from 'optionalDeps';
 import View from '../view';
 import {Constants, AlignmentModifiers, PaddingModifiers, MarginModifiers} from '../../commons/new';
 import {LogService} from 'services';
+import type {ComponentStatics} from '../../typings/common';
 
 const LinearGradient = LinearGradientPackage?.default;
 
@@ -443,7 +444,7 @@ class SkeletonView extends Component<SkeletonViewProps, SkeletonState> {
   }
 }
 
-export default SkeletonView;
+export default SkeletonView as React.ComponentClass<SkeletonViewProps> & ComponentStatics<typeof SkeletonView>;
 
 const styles = StyleSheet.create({
   listItem: {
```

---

### Incident Patch 12: `51da3af4` (2026-05-17)
**Commit Message**: Fix docs (#4001)

**File**: `docs/getting-started/v8.md` (modified, +0/-3)
```diff
@@ -54,9 +54,6 @@ Check out the full API: https://wix.github.io/react-native-ui-lib/docs/component
 ### ExpandableOverlay (Incubator)
 This component is affected by the Dialog migration  
 
-### Marquee
-This component has been moved to the Incubator
-Android does not start scrolling automatically
 
 ### PanView (new)
  One component to replace all the previous views (`PanGestureView`, `PanDismissibleView`, `PanResponderView`, `PanListenerView`, `PanningProvider`, `asPanViewConsumer` and `PanningContext`).
```

**File**: `docs/getting-started/v9.md` (modified, +5/-1)
```diff
@@ -12,7 +12,11 @@ Now supports react-native 0.78 and React 19
 ## Components
 
 ### MaskedInput
-Only the newer version is now available (the `migrate` prop is removed)  
+Only the newer version is now available (the `migrate` prop is removed) 
+
+### Marquee
+This component has been moved to the Incubator
+Android does not start scrolling automatically
 
 ## Utils
 
```

---

### Incident Patch 13: `9bd567e5` (2026-05-17)
**Commit Message**: Fix/release script 17 05 26 v2 (#4000)

* Release script - only update package when needed

* Do not publish uilib-native if not bumped

**File**: `scripts/release/release.js` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ const PACKAGES = [
     name: 'uilib-native',
     shouldUpdatePackageJson: !!isSnapshot,
     releaseVersionStrategy: 'packageJsonVersion',
-    shouldRelease: () => !!isSnapshot || !!isRelease
+    shouldRelease: pkg => !!isSnapshot || (!!isRelease && semver.gt(pkg.packageJsonVersion, pkg.publishedVersion))
   },
   {
     name: 'react-native-ui-lib',
@@ -100,7 +100,7 @@ try {
     logDebug(`Trying to release ${package.name} in ${package.path}`);
     process.chdir(package.path);
     // Update version in package.json
-    if (package.shouldUpdatePackageJson) {
+    if (package.shouldUpdatePackageJson && package.packageJsonVersion !== package.version) {
       if (dryRun) {
         exec.execSync(`npm --no-git-tag-version --no-workspaces-update version ${package.version}`, true);
       } else {
```

---

### Incident Patch 14: `afc95ba2` (2026-05-17)
**Commit Message**: Fix/release script 17 05 26 (#3999)

* Release script - use proper tagName

* Bump uilib-native version

* Release script - fix uilib-native version name (snapshot)

**File**: `packages/uilib-native/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "uilib-native",
-    "version": "5.1.0",
+    "version": "5.1.2",
     "homepage": "https://github.com/wix/react-native-ui-lib",
     "description": "uilib native components (separated from js components)",
     "main": "components/index",
```

**File**: `scripts/release/release.js` (modified, +16/-8)
```diff
@@ -2,15 +2,16 @@
 const exec = require('shell-utils').exec;
 const fs = require('fs');
 const path = require('path');
+const semver = require('semver');
 const {logDebug, logGreen, logError} = require('../utils');
 const {
   dryRun,
+  isMaster,
   isRelease,
   isSnapshot,
   versionTag,
   getPublishedVersion,
   getPackageJsonVersion,
-  getShouldRelease,
   getVersion,
   setupGit,
   createNpmRc
@@ -29,24 +30,26 @@ const PACKAGES = [
   {
     name: 'uilib-native',
     shouldUpdatePackageJson: !!isSnapshot,
-    releaseVersionStrategy: 'packageJsonVersion'
+    releaseVersionStrategy: 'packageJsonVersion',
+    shouldRelease: () => !!isSnapshot || !!isRelease
   },
   {
     name: 'react-native-ui-lib',
     shouldUpdatePackageJson: true,
     releaseVersionStrategy: isRelease ? 'buildKiteVersion' : 'packageJsonVersion',
-    workspaceDeps: ['uilib-native']
+    workspaceDeps: ['uilib-native'],
+    shouldRelease: pkg => (isMaster || isRelease ? semver.gt(pkg.packageJsonVersion, pkg.publishedVersion) : !!isSnapshot)
   }
 ];
 
 logDebug('Checking if packages should be released...');
 PACKAGES.forEach(package => {
   package.publishedVersion = getPublishedVersion(package.name);
   package.packageJsonVersion = getPackageJsonVersion(package.name);
-  package.shouldRelease = getShouldRelease(package);
+  package.shouldRelease = package.shouldRelease(package);
 });
 
-if (!PACKAGES.every(package => package.shouldRelease)) {
+if (!PACKAGES.some(package => package.shouldRelease)) {
   logGreen('No packages to release');
   if (dryRun) {
     logDebug('Dry run - not exiting');
@@ -90,6 +93,10 @@ const originalCwd = process.cwd();
 logDebug(`Starting release process with ${versionTag}`);
 try {
   for (const package of PACKAGES) {
+    if (!package.shouldRelease) {
+      logDebug(`Skipping release for ${package.name}`);
+      continue;
+    }
     logDebug(`Trying to release ${package.name} in ${package.path}`);
     process.chdir(package.path);
     // Update version in package.json
@@ -108,9 +115,10 @@ try {
       exec.execSync(`npm publish --tag ${versionTag}`);
       // Create git tag for releases (not snapshots)
       if (isRelease) {
-        exec.execSync(`git tag -a ${package.version} -m "${package.version}"`);
-        exec.execSync(`git push deploy ${package.version}`);
-        // TODO: backup - exec.execSyncSilent(`git push deploy ${package.version} || true`);
+        const tagName = `${package.name}@${package.version}`;
+        exec.execSync(`git tag -a ${tagName} -m "${tagName}"`);
+        exec.execSync(`git push deploy ${tagName}`);
+        // TODO: backup - exec.execSyncSilent(`git push deploy ${tagName} || true`);
       }
       logGreen(`Successfully released ${package.name}@${package.version}`);
     } else {
```

**File**: `scripts/release/releaseUtils.js` (modified, +0/-5)
```diff
@@ -50,10 +50,6 @@ function getPackageJsonVersion(packageName) {
   return require(path.join(rootDir, `packages/${packageName}/package.json`)).version;
 }
 
-function getShouldRelease(package) {
-  return isMaster || isRelease ? semver.gt(package.packageJsonVersion, package.publishedVersion) : !!isSnapshot;
-}
-
 function getVersion(package, dryRun) {
   let releaseVersion;
   switch (package.releaseVersionStrategy) {
@@ -105,7 +101,6 @@ module.exports = {
   versionTag,
   getPublishedVersion,
   getPackageJsonVersion,
-  getShouldRelease,
   getVersion,
   setupGit,
   createNpmRc
```

---

### Incident Patch 15: `4977d978` (2026-05-03)
**Commit Message**: Revert "textField - a11y label improvements, testID fix. (#3947)" (#3992)

This reverts commit 08deb1c9a755f78a165058382d7e47d98f351c5b.

**File**: `packages/react-native-ui-lib/src/components/textField/TextField.driver.new.ts` (modified, +7/-10)
```diff
@@ -10,7 +10,6 @@ import {ViewDriver} from '../view/View.driver.new';
 
 export const TextFieldDriver = (props: ComponentProps, options?: ComponentDriverOptions) => {
   const driver = usePressableDriver(useComponentDriver(props, options));
-  const inputDriver = useComponentDriver({renderTree: props.renderTree, testID: `${props.testID}.input`}, options);
 
   const floatingPlaceholderDriver = TextDriver({
     renderTree: props.renderTree,
@@ -45,37 +44,35 @@ export const TextFieldDriver = (props: ComponentProps, options?: ComponentDriver
     testID: `${props.testID}.clearButton.container`
   });
 
-  const getInputElement = () => inputDriver.queryElement() ?? driver.getElement();
-
   const getValue = (): string | undefined => {
-    return getInputElement().props.value ?? getInputElement().props.defaultValue;
+    return driver.getElement().props.value ?? driver.getElement().props.defaultValue;
   };
 
   const changeText = (text: string): void => {
-    fireEvent.changeText(getInputElement(), text);
+    fireEvent.changeText(driver.getElement(), text);
   };
 
   const focus = (): void => {
-    fireEvent(getInputElement(), 'focus');
+    fireEvent(driver.getElement(), 'focus');
   };
 
   const blur = (): void => {
-    fireEvent(getInputElement(), 'blur');
+    fireEvent(driver.getElement(), 'blur');
   };
 
   const isEnabled = (): boolean => {
-    return !getInputElement().props.accessibilityState?.disabled;
+    return !driver.getElement().props.accessibilityState?.disabled;
   };
 
   const getPlaceholder = () => {
     const exists = (): boolean => {
-      const hasPlaceholder = !!getInputElement().props.placeholder;
+      const hasPlaceholder = !!driver.getElement().props.placeholder;
       const hasText = !!getValue();
       return hasPlaceholder && (!hasText || (hasText && floatingPlaceholderDriver.exists()));
     };
     const getText = (): string | undefined => {
       if (exists()) {
-        return getInputElement().props.placeholder;
+        return driver.getElement().props.placeholder;
       }
     };
 
```

**File**: `packages/react-native-ui-lib/src/components/textField/index.tsx` (modified, +8/-40)
```diff
@@ -92,8 +92,6 @@ const TextField = (props: InternalTextFieldProps) => {
     readonly = false,
     showMandatoryIndication,
     clearButtonStyle,
-    testID,
-    accessibilityLabel: accessibilityLabelProp,
     ...others
   } = usePreset(props);
 
@@ -140,38 +138,9 @@ const TextField = (props: InternalTextFieldProps) => {
     [typographyStyle, colorStyle, others.style, centeredTextStyle, hasValue]);
   const dummyPlaceholderStyle = useMemo(() => [inputStyle, styles.dummyPlaceholder], [inputStyle]);
 
-  const defaultAccessibilityLabel = useMemo(() => {
-    const parts: string[] = [];
-
-    if (label) {
-      parts.push(label);
-    }
-
-    if (context.isMandatory) {
-      parts.push('required');
-    }
-
-    parts.push('textField');
-
-    if (helperText) {
-      parts.push(helperText);
-    } else if (placeholder) {
-      parts.push(placeholder);
-    }
-
-    if (showCharCounter && others.maxLength) {
-      parts.push(`you can enter up to ${others.maxLength} characters`);
-    }
-
-    return parts.join(', ');
-
-  }, [label, context.isMandatory, helperText, placeholder, showCharCounter, others.maxLength]);
-
-  const accessibilityLabel = accessibilityLabelProp ?? defaultAccessibilityLabel;
-
   return (
     <FieldContext.Provider value={context}>
-      <View {...containerProps} testID={testID} accessible accessibilityLabel={accessibilityLabel} style={[margins, positionStyle, containerStyle, centeredContainerStyle]}>
+      <View {...containerProps} style={[margins, positionStyle, containerStyle, centeredContainerStyle]}>
         <View row spread style={centeredContainerStyle}>
           <Label
             label={label}
@@ -180,7 +149,7 @@ const TextField = (props: InternalTextFieldProps) => {
             labelProps={labelProps}
             floatingPlaceholder={floatingPlaceholder}
             validationMessagePosition={validationMessagePosition}
-            testID={`${testID}.label`}
+            testID={`${props.testID}.label`}
             showMandatoryIndication={showMandatoryIndication}
             enableErrors={enableErrors}
           />
@@ -191,7 +160,7 @@ const TextField = (props: InternalTextFieldProps) => {
               validationMessage={others.validationMessage}
               validationMessageStyle={_validationMessageStyle}
               retainValidationSpace={retainValidationSpace && retainTopMessageSpace}
-              testID={`${testID}.validationMessage`}
+              testID={`${props.testID}.validationMessage`}
             />
           )}
           {topTrailingAccessory && <View>{topTrailingAccessory}</View>}
@@ -220,7 +189,7 @@ const TextField = (props: InternalTextFieldProps) => {
                   floatOnFocus={floatOnFocus}
                   validationMessagePosition={validationMessagePosition}
                   extraOffset={leadingAccessoryMeasurements?.width}
-                  testID={`${testID}.floatingPlaceholder`}
+                  testID={`${props.testID}.floatingPlaceholder`}
                   showMandatoryIndication={showMandatoryIndication}
                 />
               )}
@@ -229,7 +198,6 @@ const TextField = (props: InternalTextFieldProps) => {
                 placeholderTextColor={hidePlaceholder ? 'transparent' : placeholderTextColor}
                 value={fieldState.value}
                 {...others}
-                testID={`${testID}.input`}
                 readonly={readonly}
                 style={inputStyle}
                 onFocus={onFocus}
@@ -244,7 +212,7 @@ const TextField = (props: InternalTextFieldProps) => {
           {showClearButton && (
             <ClearButton
               onClear={onClear}
-              testID={`${testID}.clearButton`}
+              testID={`${props.testID}.clearButton`}
               onChangeText={onChangeText}
               clearButtonStyle={clearButtonStyle}
             />
@@ -262,11 +230,11 @@ const TextField = (props: InternalTextFieldProps) => {
                 validationIcon={validationIcon}
                 validationMessageStyle={_validationMessageStyle}
                 retainValidationSpace={retainValidationSpace}
-                testID={`${testID}.validationMessage`}
+                testID={`${props.testID}.validationMessage`}
               />
             )}
             {helperText && (
-              <Text $textNeutralHeavy subtext marginT-s1 testID={`${testID}.helperText`}>
+              <Text $textNeutralHeavy subtext marginT-s1 testID={`${props.testID}.helperText`}>
                 {helperText}
               </Text>
             )}
@@ -277,7 +245,7 @@ const TextField = (props: InternalTextFieldProps) => {
               <CharCounter
                 maxLength={others.maxLength}
                 charCounterStyle={charCounterStyle}
-                testID={`${testID}.charCounter`}
+                testID={`${props.testID}.charCounter`}
               />
             )}
           </View>
```

#### Recent Merged Pull Requests:
- **PR #4042** (2026-09-06): fix: TabController - clear stuck press feedback when a tap is cancelled on iOS (@mika-bejerano)
- **PR #4041** (closed): Update README with React Native upgrade plans (@lukasmilasauskas)
- **PR #4038** (2026-09-01): fix: Dialog - prevent open animation interruption by residual touch on Android (@Yoavpagir)
- **PR #4037** (closed): fix: Dialog - prevent open animation interruption by residual touch on Android (@Yoavpagir)
- **PR #4036** (closed): fix(ScreenFooter): init animatedValue to 1 for opacity-based animations when visible (@adids1221)
- **PR #4035** (2026-07-29): fix: ScreenFooter - correct initial opacity for animationType 'none' (Android touch blocking) (@adids1221)
- **PR #4034** (2026-07-28): fix: guard isGravatarUrl against invalid URL strings (@adids1221)
- **PR #4033** (2026-07-19): fix: replace url-parse with native URL API (@alexandergolbergwix)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
