# Forensic Learning Record (Deep Inspection): react-native-elements/react-native-elements

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-elements-react-native-elements-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-elements/react-native-elements](https://github.com/react-native-elements/react-native-elements))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:43:15.484Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-elements/react-native-elements`
- **Description**: Cross-Platform React Native UI Toolkit
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25872 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/base/src/helpers/renderNode.tsx`
```
import React from 'react';

const renderNode = (Component: any, content: any, defaultProps: any = {}) => {
  const { key, ...remainingDefaultProps } = defaultProps; //Issue Fix: Warning about a prop is spread containing key prop upstream#3956
  if (content == null || content === false) {
    return null;
  }
  if (React.isValidElement(content)) {
    return content;
  }
  if (typeof content === 'function') {
    return content();
  }
  // Just in case
  if (content === true) {
    return <Component key={key} {...remainingDefaultProps} />;
  }
  if (typeof content === 'string') {
    if (content.length === 0) {
      return null;
    }
    return (
      <Component key={key} {...remainingDefaultProps}>
        {content}
      </Component>
    );
  }
  if (typeof content === 'number') {
    return (
      <Component key={key} {...remainingDefaultProps}>
        {content}
      </Component>
    );
  }
  return <Component key={key} {...remainingDefaultProps} {...content} />;
};
export default renderNode;

```

### Core Architecture Module: `packages/base/src/utils/math.ts`
```
/**
 * Keep value between 0 and 1
 */
export const clamp = (value: number = 0): number =>
  Math.max(0, Math.min(value, 1)) || 0;

```

### Core Architecture Module: `scripts/docgen/src/utils/common.ts`
```
import { transform, types as t } from '@babel/core';
import dedent from 'dedent';
import glob from 'fast-glob';
import { posix, dirname } from 'path';
import fs from 'fs';

const join = posix.join;

export const tabify = (str: string) => {
  return transform(`<>\n${str}\n</>`, {
    plugins: [
      '@babel/plugin-syntax-jsx',
      /**
       * @returns {import('@babel/core').PluginItem}
       */
      function () {
        return {
          visitor: {
            JSXExpressionContainer(path) {
              const { node } = path;
              if (node.expression.type === 'BinaryExpression') {
                const { left, right, operator } = node.expression;
                if (left.name === '$' && operator === '+') {
                  const { properties } = right;
                  const keys = [];
                  properties.forEach(({ key }) => {
                    keys.push(key.value);
                  });
                  if (keys.length < 1) {
                    return;
                  }
                  const element = t.jsxElement(
                    t.jsxOpeningElement(t.jsxIdentifier('Tabs'), [
                      t.jsxAttribute(
                        t.jsxIdentifier('defaultValue'),
                        t.stringLiteral(keys[0])
                      ),
                      t.jsxAttribute(
                        t.jsxIdentifier('values'),
                        t.jsxExpressionContainer(
                          t.arrayExpression(
                            keys.map((key) =>
                              t.objectExpression([
                                t.objectProperty(
                                  t.identifier('label'),
                                  t.stringLiteral(key)
                                ),
                                t.objectProperty(
                                  t.identifier('value'),
                                  t.stringLiteral(key)
                                ),
                              ])
                            )
                          )
                        )
                      ),
                    ]),
                    t.jsxClosingElement(t.jsxIdentifier('Tabs')),
                    [
                      ...properties.map(({ key, value }) => {
                        return t.jsxElement(
                          t.jsxOpeningElement(t.jsxIdentifier('TabItem'), [
                            t.jsxAttribute(
                              t.jsxIdentifier('value'),
                              t.stringLiteral(key.value)
                            ),
                          ]),
                          t.jsxClosingElement(t.jsxIdentifier('TabItem')),
                          [value]
                        );
                      }),
                    ]
                  );
                  path.replaceWith(element);
                }
              }
            },
          },
        };
      },
    ],
  }).code.replace(/<>|<\/>;|{" "}/g, '');
};

export const codify = (str: string) => (str ? `\`${str?.trim()}\`` : '');
export const isTrue = (cond: number | boolean, value: string) =>
  cond ? dedent(value) : '';
export const removeNewline = (str: string) => str?.replace(/\n/g, '');

export const snippetToCode = (snippet = '') =>
  snippet
    .replace(/%live (.*)/g, '```jsx live\n$1\n```')
    .replace(/%jsx (.*)/g, '```jsx\n$1\n```');

export const filterPropType = (value: string) => {
  if (!value) {
    return '`None`';
  }
  if (value.includes('|')) {
    return value.replace(/"/g, '').split('|').map(codify).join(' \\| ');
  }
  if (value.includes('&')) {
    return value.replace(/"/g, '').split('&').map(codify).join(' & ');
  }
  return value;
};

export function findIgnoredComponents(rootPath: string) {
  const docgenIgnoreFiles = glob.sync(join(rootPath, '**/.docgenignore'), {
    absolute: true,
    onlyFiles: true,
  });
  const ignoredFiles = [];
  docgenIgnoreFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    content.split('\n').forEach((componentPath) => {
      const trimmedPath = componentPath.trim();
      if (trimmedPath) {
        ignoredFiles.push(join(dirname(filePath), trimmedPath));
      }
    });
  });

  return ignoredFiles;
}

```

### Core Architecture Module: `scripts/docgen/src/utils/parentProps.ts`
```
import { ComponentDoc } from 'react-docgen-typescript';
import { ParentType } from 'react-docgen-typescript/lib/parser';

const ALLOWED_INCLUDES = {
  TextProps: '[Text](https://reactnative.dev/docs/text#props)',
  ViewProps: '[View](https://reactnative.dev/docs/view#props)',
  ImageProps: '[React Native Image](https://reactnative.dev/docs/image#props)',
  ImagePropsBase:
    '[React Native Image](https://reactnative.dev/docs/image#props)',
  TouchableOpacityProps:
    '[TouchableOpacityProps](https://reactnative.dev/docs/touchableopacity#props)',
  TextInputProps:
    '[React Native TextInput](https://reactnative.dev/docs/textinput#props)',
  SwitchPropsIOS:
    '[React Native Switch](https://reactnative.dev/docs/switch.html#props)',
};

export const MUST_INCLUDE_PROP_TYPES = [
  'InlinePressableProps',
  'SearchBarBaseProps',
  'ParentProps',
];

export function separateParent(components: ComponentDoc[]) {
  const parentComp: Record<string, ParentType[]> = {};
  components.forEach(({ displayName, props }) => {
    for (const id in props) {
      const { parent } = props[id];
      if (!parentComp[displayName]) {
        parentComp[displayName] = [];
      }
      if (!parent) {
        continue;
      }
      const is = parentComp[displayName].some((prop) => {
        return prop.name === parent.name;
      });
      if (!is) {
        parentComp[displayName].push(parent);
      }
    }
  });
  let finalParent = {};

  for (let componentName in parentComp) {
    finalParent[componentName] = parentComp[componentName]
      .reduce((all, single) => {
        const name = single.name.replace('Props', '');
        if (parentComp[name] && name !== componentName) {
          return [
            single,
            ...all.filter((a) => {
              return !parentComp[name].some((n) => n.name === a.name);
            }),
          ];
        }
        return all;
      }, parentComp[componentName])
      .map((parent) => {
        if (parent.fileName.includes('node_modules')) {
          if (ALLOWED_INCLUDES[parent.name]) {
            return ALLOWED_INCLUDES[parent.name];
          }
          return undefined;
        }
        if (
          componentName.replace('.', '') + 'Props' === parent.name ||
          MUST_INCLUDE_PROP_TYPES.includes(parent.name)
        ) {
          return undefined;
        }

        const compName = parent.name.replace(/Props|\./, '');
        return `[${compName}](${compName.toLowerCase()}#props)`;
      })
      .filter(Boolean);
  }
  return finalParent;
}

```

### Core Architecture Module: `scripts/docgen/src/utils/platformMappingHandler.ts`
```
export function platformMappingHandler(value) {
  const formattedString = value
    .substring(value?.lastIndexOf('{') + 1, value?.lastIndexOf('}') - 1)
    .replace(/ /g, '')
    .replace(/\r\n/g, '');
  const platforms = formattedString.split(',');

  const platformTypes = { ios: '', android: '', web: '' };

  platforms.map((item) => {
    if (item !== '') {
      const [platform, type] = item.split(':');
      if (platform !== 'default') {
        platformTypes[platform] = type;
      } else {
        Object.keys(platformTypes).map((key) => {
          if (!platformTypes[key]) {
            platformTypes[key] = type;
          }
        });
      }
    }
  });
  const defaultValue = Object.keys(platformTypes)
    .map((key) => {
      return `${platformTypes[key]}(${key})`;
    })
    .join(',');

  return defaultValue;
}

```

### Core Architecture Module: `website/playground/utils/createReactViewBaseConfig.js`
```
export default function createReactViewBaseConfig(componentName, RNComponent) {
  if (!componentName || !RNComponent) {
    throw new Error(
      'createBaseComponent needs a componentName name and RNComponent'
    );
  }

  return {
    componentName,
    scope: {
      RNComponent,
    },
    imports: {
      '@rneui/base': {
        named: [componentName],
      },
    },
  };
}

```

### Core Architecture Module: `example/App.tsx`
```
import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@rneui/themed';
import RootNavigator from './src/navigation/RootNavigator';
import { cacheImages, cacheFonts } from './src/helpers/AssetsCaching';
import vectorFonts from './src/helpers/vector-fonts';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default () => {
  const [isReady, setIsReady] = useState(false);

  const colorScheme = useColorScheme();
  theme.mode = colorScheme;

  React.useEffect(() => {
    loadAssetsAsync();
  }, []);

  const loadAssetsAsync = async () => {
    const imageAssets = cacheImages([
      require('./assets/images/bg_screen1.jpg'),
      require('./assets/images/bg_screen2.jpg'),
      require('./assets/images/bg_screen3.jpg'),
      require('./assets/images/bg_screen4.jpg'),
      require('./assets/images/user-cool.png'),
      require('./assets/images/user-hp.png'),
      require('./assets/images/user-student.png'),
      require('./assets/images/avatar1.jpg'),
    ]);

    const fontAssets = cacheFonts([
      ...vectorFonts,
      { georgia: require('./assets/fonts/Georgia.ttf') },
      { regular: require('./assets/fonts/Montserrat-Regular.ttf') },
      { light: require('./assets/fonts/Montserrat-Light.ttf') },
      { bold: require('./assets/fonts/Montserrat-Bold.ttf') },
      { UbuntuLight: require('./assets/fonts/Ubuntu-Light.ttf') },
      { UbuntuBold: require('./assets/fonts/Ubuntu-Bold.ttf') },
      { UbuntuLightItalic: require('./assets/fonts/Ubuntu-Light-Italic.ttf') },
    ]);
    await Promise.all([...imageAssets, ...fontAssets]);
    setIsReady(true);
  };

  const onLayoutRootView = React.useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <ThemeProvider theme={theme}>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

const theme = createTheme({
  lightColors: {
    primary: '#3d5afe',
  },
  darkColors: {
    primary: '#3d5afe',
  },
  mode: 'dark',
  components: {
    Text: {
      h1Style: {
        fontSize: 80,
      },
    },
  },
});

```

### Core Architecture Module: `example/eslint.config.js`
```
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);

```

### Core Architecture Module: `example/index.js`
```
import { registerRootComponent } from 'expo';

import App from './App';

// // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// // It also ensures that whether you load the app in Expo Go or in a native build,
// // the environment is set up appropriately
registerRootComponent(App);

```

### Core Architecture Module: `example/metro.config.js`
```
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro handle the monorepo packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Custom resolver to point to src instead of dist
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @rneui packages - redirect to src instead of dist
  if (moduleName.startsWith('@rneui/base')) {
    const packagePath = path.resolve(workspaceRoot, 'packages/base');
    
    // Remove the package name prefix
    let subpath = moduleName.replace('@rneui/base', '').replace(/^\//, '');
    
    // Remove 'dist/' if it's in the path (e.g., '@rneui/base/dist/Badge/Badge')
    subpath = subpath.replace(/^dist\//, '');
    
    // Build the base path
    const basePath = subpath 
      ? path.join(packagePath, 'src', subpath)
      : path.join(packagePath, 'src', 'index');
    
    // Try different extensions for files
    const extensions = ['.tsx', '.ts', '.native.tsx', '.native.ts', '.js', '.jsx'];
    for (const ext of extensions) {
      const filePath = basePath + ext;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return {
          type: 'sourceFile',
          filePath: filePath,
        };
      }
    }
    
    // If no file found, try as directory with /index
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of extensions) {
        const filePath = path.join(basePath, 'index' + ext);
        if (fs.existsSync(filePath)) {
          return {
            type: 'sourceFile',
            filePath: filePath,
          };
        }
      }
    }
  }
  
  if (moduleName.startsWith('@rneui/themed')) {
    const packagePath = path.resolve(workspaceRoot, 'packages/themed');
    
    // Remove the package name prefix
    let subpath = moduleName.replace('@rneui/themed', '').replace(/^\//, '');
    
    // Remove 'dist/' if it's in the path
    subpath = subpath.replace(/^dist\//, '');
    
    // Build the base path
    const basePath = subpath
      ? path.join(packagePath, 'src', subpath)
      : path.join(packagePath, 'src', 'index');
    
    // Try different extensions for files
    const extensions = ['.tsx', '.ts', '.native.tsx', '.native.ts', '.js', '.jsx'];
    for (const ext of extensions) {
      const filePath = basePath + ext;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return {
          type: 'sourceFile',
          filePath: filePath,
        };
      }
    }
    
    // If no file found, try as directory with /index
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of extensions) {
        const filePath = path.join(basePath, 'index' + ext);
        if (fs.existsSync(filePath)) {
          return {
            type: 'sourceFile',
            filePath: filePath,
          };
        }
      }
    }
  }
  
  // Let the default resolver handle everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

```

### Core Architecture Module: `example/src/components/AppLoading.web.tsx`
```
import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
});

const emptyFunc = () => null;

const callbackHandler = (startAsync, successCb, errorCb) => {
  Promise.resolve(startAsync()).then(successCb).catch(errorCb);
};

const AppLoading = (props) => {
  useEffect(() => {
    const { startAsync, onError, onFinish } = props;
    const successCb = onFinish || emptyFunc;
    const errorCb = onError || emptyFunc;
    return !startAsync
      ? successCb()
      : callbackHandler(startAsync, successCb, errorCb);
  }, [props]);
  const { startAsync, onError, onFinish, autoHideSplash, ...others } = props;
  return (
    <View style={styles.container}>
      <ActivityIndicator size={'large'} {...others} />
    </View>
  );
};

export default AppLoading;

```

### Core Architecture Module: `example/src/components/LinearGradient.ts`
```
export { LinearGradient } from 'expo-linear-gradient';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4028** (2026-03-16): **Button's buttonStyle backgroundColor not reactive - Android**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Explain what you did  I created a simple test using the Button component from react-native-elements where the buttonStyle.backgroundColor is controlled by React state.  When the button is pressed, the state updates and changes the backgroundColor value. However, the button style does not update on screen.  A minimal reproduction is available here: https://snack.expo.dev/@yagofrancia/surprised-violet-cashew?platform=android  **Please note that is is only happening in Android.**  Relevant code:  ```typescript const [backgroundColor, setBackgroundColor] = React.useState('black');  <Button   title="Change color to red"   buttonStyle={{     backgroundColor,   }}   onPress={() => {     setBackgroundColor('red');   }} /> ```  ### Expected behavior  Expected behavior  In the give example **when running on Android**, when backgroundColor state changes, the Button component should re-render and apply the new background color defined in buttonStyle.  Pressing the button should update the button background from black to red.  ### Describe the bug  Changes to buttonStyle.backgroundColor are not reactive. Even after updating the React state, the button background color remains the same.  This suggests the Button component may not be reapplying the style when the buttonStyle prop changes.  The state update is confirmed to run, but the visual style of the button does not update.  ### Steps To Reproduce  
  **Post-Mortem & Fix Analysis**:
  > Same here

- **Issue #4026** (2026-05-21): **Refactor(Button): update ViewComponent type and enhance documentation…**
  *Symptoms*: … examples. Include usage of expo-linear-gradient and Custom View Component in the Button  ## Motivation  <!-- A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]  Please include a summary of the change and which issue is fixed. Please also include relevant motivation and context. List any dependencies that are required for this change. -->  Fixes # (issue) Update the LinearGradient Docs usage, and also update the type of ViewComponent  from  `typeof React.Component`  to `React.ComponentType<any>` ## Type of change  <!-- Please delete options that are not relevant. -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [x] This change requires a documentation update  # How Has This Been Tested? Tested locally- No, build or test failures  - [ ] Jest Unit Test - [x] Checked with `example` app  ## Checklist  - [ x] My code follows the style guidelines of this project - [ x] I have performed a self-review of my own code - [ ] I have commented my code, particularly in hard-to-understand areas - [ ] I have made corresponding changes to the documentation using `yarn docs-build-api` - [ ] My changes generate no new warnings - [ ] I have added tests that prove my fix is effective or that my feature works - [x ] New and existing unit tes
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/react-native-elements/react-native-elements/pull/4026?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 79.40%. Comparing base ([`70290c6`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/70290c6c6a3608eb6330a370fdb8d53243df8861?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)) to head ([`e774673`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/e774673cf391813fef69154b394105764877dc32?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)). :warning: Report is 1 commits behind head on next.  <details><s

- **Issue #4025** (2026-01-27): **fix(ci): yarn install type for website deployment**
  *Symptoms*: Update website install command to use --no-immutable flag Replace --mode=update-lockfile with --no-immutable flag to allow lockfile updates during website dependency installation.

- **Issue #4024** (2026-01-27): **fix(ci): resolve website build failures due to lockfile mismatch**
  *Symptoms*: **Problem** The website CI build was failing with `YN0028: The lockfile would have been modified by this install, which is explicitly forbidden.`  This occurred because:  1. The website depends on rneui/base via `file:../packages/base` 2. Yarn Berry automatically enables immutable mode in CI environments 3. When `packages/base` changes, the lockfile hash becomes out of sync 4. `yarn install --immutable` fails when the hash doesn't match  **Solution** Replace `yarn install --immutable` with `yarn install --mode=update-lockfile` in the website install step. This flag explicitly allows lockfile updates when workspace dependencies change.  **Changes**  - .github/actions/install/action.yml: Update website install command  **Additional Improvements**  - Added .gitattributes to enforce consistent LF line endings across platforms - Renormalized repository files to use LF line endings  This ensures the website builds successfully in CI while maintaining reproducibility for external npm dependencies.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/react-native-elements/react-native-elements/pull/4024?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements) Report :x: Patch coverage is `71.23656%` with `107 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 79.40%. Comparing base ([`4eb18f8`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/4eb18f8b469e5aee47a58264d0fa5a10bf9eeebd?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)) to head ([`1ef3543`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/1ef3543967f7e5df56a0e92682e619aabc6723d7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)). :warning: Report is 6 commits behind 

- **Issue #4023** (2026-01-27): **fix(docs): fix github actions docs workflow dependencies and yarn lockfiles**
  *Symptoms*: ## Motivation  <!-- A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]  Please include a summary of the change and which issue is fixed. Please also include relevant motivation and context. List any dependencies that are required for this change. -->  Fixes # (issue)  ## Type of change  <!-- Please delete options that are not relevant. -->  - [X] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] This change requires a documentation update  # How Has This Been Tested?  <!-- Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce. Please also list any relevant details for your test configuration -->  - [ ] Jest Unit Test - [ ] Checked with `example` app  ## Checklist  - [X] My code follows the style guidelines of this project - [X] I have performed a self-review of my own code - [ ] I have commented my code, particularly in hard-to-understand areas - [ ] I have made corresponding changes to the documentation using `yarn docs-build-api` - [X] My changes generate no new warnings - [ ] I have added tests that prove my fix is effective or that my feature works - [ ] New and existing unit tests pass locally with my changes - [ ] Any dependent changes have been merged and published in downstre
  **Post-Mortem & Fix Analysis**:
  > @theianmay 
  > ## [Codecov](https://app.codecov.io/gh/react-native-elements/react-native-elements/pull/4023?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 79.40%. Comparing base ([`1ef3543`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/1ef3543967f7e5df56a0e92682e619aabc6723d7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)) to head ([`70290c6`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/70290c6c6a3608eb6330a370fdb8d53243df8861?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)). :warning: Report is 6 commits behind head on next.  <details><s

- **Issue #4021** (2026-01-19): **fix(ci): Fix website deployment workflow**
  *Symptoms*: Add Corepack activation step to prepare Yarn 3.2.4 before installing website dependencies. Update install command to use --immutable flag for reproducible builds.  fix(ci): Fix website deployment workflow  **Problem:** - Website CI was failing with "lockfile would have been modified" error - Yarn version mismatch between root (4.5.2) and website (3.2.4) - Committed Yarn binary in website/.yarnrc.yml was overriding Corepack  **Solution:** - Use Corepack to manage Yarn versions instead of committed binary - Activate Yarn 3.2.4 explicitly for website installs - Run `yarn install --immutable` in CI for reproducible builds - Updated lockfile with current @rneui/base hash  **Changes:** - .github/actions/install/action.yml: Added Yarn activation for website - website/.yarnrc.yml: Removed yarnPath, use Corepack - website/yarn.lock: Updated workspace dependency hash
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/react-native-elements/react-native-elements/pull/4021?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 79.40%. Comparing base ([`0e8430b`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/0e8430b2731cacd800bb8315d2c58887262d1360?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)) to head ([`4eb18f8`](https://app.codecov.io/gh/react-native-elements/react-native-elements/commit/4eb18f8b469e5aee47a58264d0fa5a10bf9eeebd?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=react-native-elements)). :warning: Report is 9 commits behind head on next.  <details><s

- **Issue #4020** (2026-01-19): **fix(Actions): update yarn version approach**
  *Symptoms*: ## Fix CI Yarn Version Conflicts  ### Problem The CI workflows were failing during `yarn install` due to a version mismatch between the dynamically resolved `yarn@stable` (Yarn 4.x) and the project's pinned Yarn versions. This caused the docs deployment workflow and potentially other workflows to fail.  ### Root Cause - The shared install action ([.github/actions/install/action.yml](cci:7://file:///c:/Users/ianma/VSCodeProjects/react-native-elements/.github/actions/install/action.yml:0:0-0:0)) was hardcoding `yarn@stable` - Individual workflows were also using `yarn@stable` - The website requires Yarn 3.2.4 for Docusaurus plugin compatibility - The root monorepo uses Yarn 4.5.2 - Using `@stable` created non-reproducible builds and version conflicts  ### Changes 1. **Commented out hardcoded Yarn version** in [.github/actions/install/action.yml](cci:7://file:///c:/Users/ianma/VSCodeProjects/react-native-elements/.github/actions/install/action.yml:0:0-0:0) to allow workflows to control their own versions 2. **Updated [docs.yml](cci:7://file:///c:/Users/ianma/VSCodeProjects/react-native-elements/.github/workflows/docs.yml:0:0-0:0)** to explicitly use `yarn@3.2.4` for website builds (Docusaurus compatibility) 3. **Updated all other workflows** to explicitly use `yarn@4.5.2` for root package operations:    - [ci-checks.yml](cci:7://file:///c:/Users/ianma/VSCodeProjects/react-native-elements/.github/workflows/ci-checks.yml:0:0-0:0)    - [bleeding-edge-dist.yml](cci:

- **Issue #4019** (2026-01-19): **Update docs.yml**
  *Symptoms*: Pin yarn version to 3.2.4 to match website's .yarnrc.yml file - goal is to fix GitHub Action named "Docs"

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

### Incident Patch 1: `99746879` (2026-01-27)
**Commit Message**: Merge pull request #4023 from louveshh/fix-docs

fix(docs): fix github actions docs workflow dependencies and yarn lockfiles

**File**: `package.json` (modified, +0/-1)
```diff
@@ -11,7 +11,6 @@
   },
   "resolutions": {
     "form-data": "^4.0.4",
-    "js-yaml": "^4.1.1",
     "lodash": "^4.17.21",
     "node-gyp": "^10.0.0",
     "parse-path": "^7.0.0",
```

**File**: `website/package.json` (modified, +10/-9)
```diff
@@ -20,7 +20,6 @@
     "http-cache-semantics": "^4.1.1",
     "eta": "^2.0.0",
     "json5": "^2.2.2",
-    "js-yaml": "^4.1.1",
     "ip": "^2.0.1",
     "loader-utils": "^2.0.4",
     "minimatch": "^3.0.5",
@@ -71,13 +70,13 @@
   "version": "4.0.0",
   "dependencies": {
     "@babel/core": "^7.17.10",
-    "@docusaurus/core": "^2.3.0",
-    "@docusaurus/plugin-client-redirects": "^2.3.0",
-    "@docusaurus/plugin-google-analytics": "^2.3.0",
-    "@docusaurus/plugin-google-gtag": "^2.3.0",
-    "@docusaurus/preset-classic": "^2.3.0",
-    "@docusaurus/theme-live-codeblock": "2.3.0",
-    "@docusaurus/types": "^2.3.0",
+    "@docusaurus/core": "2.4.3",
+    "@docusaurus/plugin-client-redirects": "2.4.3",
+    "@docusaurus/plugin-google-analytics": "2.4.3",
+    "@docusaurus/plugin-google-gtag": "2.4.3",
+    "@docusaurus/preset-classic": "2.4.3",
+    "@docusaurus/theme-live-codeblock": "2.4.3",
+    "@docusaurus/types": "2.4.3",
     "@rneui/base": "../packages/base",
     "@rneui/layout": "^0.0.0-alpha.6",
     "assert": "^2.0.0",
@@ -101,17 +100,19 @@
     "style-loader": "^3.3.1"
   },
   "devDependencies": {
-    "@docusaurus/module-type-aliases": "^2.3.0",
+    "@docusaurus/module-type-aliases": "2.4.3",
     "@tsconfig/docusaurus": "^1.0.4",
     "@types/assert": "^1.5.6",
     "@types/jest": "^27.0.3",
     "@types/node": "^17.0.23",
     "@types/react": "^17.0.43",
     "@types/react-dom": "^17.0.14",
+    "autoprefixer": "^10.4.16",
     "babel-loader": "^8.2.4",
     "fast-glob": "^3.2.11",
     "jest": "^27.5.1",
     "process": "^0.11.10",
+    "tailwindcss": "^3.4.0",
     "typescript": "^4.6.3"
   }
 }
```

---

### Incident Patch 2: `70290c6c` (2026-01-27)
**Commit Message**: Merge branch 'next' into fix-docs

**File**: `.gitattributes` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Enforce LF line endings for all text files
+* text=auto eol=lf
+
+# Binary files
+*.png binary
+*.jpg binary
+*.jpeg binary
+*.gif binary
+*.ico binary
+*.mov binary
+*.mp4 binary
+*.mp3 binary
+*.zip binary
+*.gz binary
+*.tgz binary
+*.ttf binary
+*.otf binary
+*.woff binary
+*.woff2 binary
+*.eot binary
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +62/-62)
```diff
@@ -1,62 +1,62 @@
-name: 🐛 Bug report
-description: Create a report to help us improve
-labels: ['Needs Triage']
-body:
-  - type: markdown
-    attributes:
-      value: |
-        A bug means that there is something broken or outside expectations in `react-native-elements`. If you only need help writing your own components, check out the [Discord server](https://discord.com/invite/e9RBHjkKHa) FIRST.
-  - type: checkboxes
-    attributes:
-      label: Is there an existing issue for this?
-      description: Please [search the history](https://github.com/react-native-elements/react-native-elements/issues) to see if an issue already exists for the same problem.
-      options:
-        - label: I have searched the existing issues
-          required: true
-  - type: textarea
-    attributes:
-      label: Explain what you did
-      description: What you were trying to accomplish.
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Expected behavior
-      description: Describe what happens instead of the expected behavior.
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Describe the bug
-      description: A clear and concise description of what the bug is.
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Steps To Reproduce
-      render: Markdown
-      description: |
-        We highly recommend that you re-create the bug on [Snack](https://snack.expo.io). If not, list the steps that a reviewer can take to reproduce the behaviour:
-        1. Go to '...'
-        2. Click on '....'
-        3. Scroll down to '....'
-        4. See error
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Screenshots
-      description: If applicable, add screenshots to help explain your problem.
-  - type: textarea
-    attributes:
-      label: Your Environment
-      description: Run `npx @rneui/envinfo` and paste the results.
-      value: |
-        <details>
-        <summary>`npx @rneui/envinfo`</summary>
-
-              ```
-                Output from `npx @rneui/envinfo` goes here.
-              ```
-
-        </details>
+name: 🐛 Bug report
+description: Create a report to help us improve
+labels: ['Needs Triage']
+body:
+  - type: markdown
+    attributes:
+      value: |
+        A bug means that there is something broken or outside expectations in `react-native-elements`. If you only need help writing your own components, check out the [Discord server](https://discord.com/invite/e9RBHjkKHa) FIRST.
+  - type: checkboxes
+    attributes:
+      label: Is there an existing issue for this?
+      description: Please [search the history](https://github.com/react-native-elements/react-native-elements/issues) to see if an issue already exists for the same problem.
+      options:
+        - label: I have searched the existing issues
+          required: true
+  - type: textarea
+    attributes:
+      label: Explain what you did
+      description: What you were trying to accomplish.
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Expected behavior
+      description: Describe what happens instead of the expected behavior.
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Describe the bug
+      description: A clear and concise description of what the bug is.
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Steps To Reproduce
+      render: Markdown
+      description: |
+        We highly recommend that you re-create the bug on [Snack](https://snack.expo.io). If not, list the steps that a reviewer can take to reproduce the behaviour:
+        1. Go to '...'
+        2. Click on '....'
+        3. Scroll down to '....'
+        4. See error
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Screenshots
+      description: If applicable, add screenshots to help explain your problem.
+  - type: textarea
+    attributes:
+      label: Your Environment
+      description: Run `npx @rneui/envinfo` and paste the results.
+      value: |
+        <details>
+        <summary>`npx @rneui/envinfo`</summary>
+
+              ```
+                Output from `npx @rneui/envinfo` goes here.
+              ```
+
+        </details>
```

**File**: `.github/actions/install/action.yml` (modified, +59/-59)
```diff
@@ -1,59 +1,59 @@
-name: Install dependencies
-author: arpitBhalla
-description: ''
-inputs:
-  install_website:
-    description: 'If true, install website dependencies.'
-    required: false
-runs:
-  using: composite
-  steps:
-    - uses: actions/checkout@v2
-
-    - name: Setup Node.js Environment
-      uses: actions/setup-node@v2
-      with:
-        node-version: 20
-
-    - name: Cache root dependencies
-      uses: actions/cache@v3
-      id: root_cache
-      with:
-        path: node_modules
-        key: ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
-
-    - name: Enable Corepack
-      run: corepack enable
-      shell: bash
-    # Commented out to allow workflows to specify their own Yarn version
-    # - name: Enable Yarn with Corepack
-    #   run: corepack prepare yarn@stable --activate
-    #   shell: bash
-
-    - name: Install root dependencies
-      if: steps.root_cache.outputs.cache-hit != 'true'
-      run: yarn install
-      shell: bash
-
-    - name: Cache website dependencies
-      uses: actions/cache@v3
-      if: inputs.install_website == 'true'
-      id: website_cache
-      with:
-        path: website/node_modules
-        key: ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
-
-    - name: Activate Yarn for website
-      if: inputs.install_website == 'true'
-      run: corepack prepare yarn@3.2.4 --activate
-      shell: bash
-
-    - name: Install website dependencies
-      if: steps.website_cache.outputs.cache-hit != 'true' && inputs.install_website == 'true'
-      run: yarn install --immutable
-      working-directory: website
-      shell: bash
+name: Install dependencies
+author: arpitBhalla
+description: ''
+inputs:
+  install_website:
+    description: 'If true, install website dependencies.'
+    required: false
+runs:
+  using: composite
+  steps:
+    - uses: actions/checkout@v2
+
+    - name: Setup Node.js Environment
+      uses: actions/setup-node@v2
+      with:
+        node-version: 20
+
+    - name: Cache root dependencies
+      uses: actions/cache@v3
+      id: root_cache
+      with:
+        path: node_modules
+        key: ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
+        restore-keys: |
+          ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
+
+    - name: Enable Corepack
+      run: corepack enable
+      shell: bash
+    # Commented out to allow workflows to specify their own Yarn version
+    # - name: Enable Yarn with Corepack
+    #   run: corepack prepare yarn@stable --activate
+    #   shell: bash
+
+    - name: Install root dependencies
+      if: steps.root_cache.outputs.cache-hit != 'true'
+      run: yarn install
+      shell: bash
+
+    - name: Cache website dependencies
+      uses: actions/cache@v3
+      if: inputs.install_website == 'true'
+      id: website_cache
+      with:
+        path: website/node_modules
+        key: ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
+        restore-keys: |
+          ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
+
+    - name: Activate Yarn for website
+      if: inputs.install_website == 'true'
+      run: corepack prepare yarn@3.2.4 --activate
+      shell: bash
+
+    - name: Install website dependencies
+      if: steps.website_cache.outputs.cache-hit != 'true' && inputs.install_website == 'true'
+      run: yarn install --no-immutable
+      working-directory: website
+      shell: bash
```

**File**: `.github/workflows/bleeding-edge-dist-PR.yml` (modified, +92/-92)
```diff
@@ -1,92 +1,92 @@
-name: (manual) PR's Bleeding Edge Version
-
-on:
-  workflow_dispatch:
-    inputs:
-      pr:
-        type: string
-        description: PR Number
-        required: true
-
-jobs:
-  preview:
-    runs-on: ubuntu-latest
-    steps:
-      - name: Get PR SHA
-        id: sha
-        uses: actions/github-script@v4
-        with:
-          result-encoding: string
-          script: |
-            const { owner, repo } = context.issue;
-            const pr = await github.pulls.get({
-              owner,
-              repo,
-              pull_number: ${{github.event.inputs.pr}},
-            });
-            return pr.data.head.sha
-
-      - uses: actions/checkout@v3 # Updated to v3 for the latest checkout improvements
-        with:
-          ref: ${{ steps.sha.outputs.result }}
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-
-      - name: Build packages
-        run: yarn build
-
-      - name: Config git
-        run: |
-          git config --local user.email "104670806+rneui@users.noreply.github.com"
-          git config --local user.name "RNEUI"
-      - name: Create local changes
-        run: |
-          sed -i -e 's/dist/src/g' .gitignore
-          git rm -rf packages/*/src
-          jq 'del(.devDependencies."@rneui/base",.peerDependencies."@rneui/base")'  packages/themed/package.json >  packages/themed/package.json.temp
-          mv packages/themed/package.json.temp packages/themed/package.json
-          git add .
-          git commit -m "Bleeding Edge Version" -a --no-verify
-
-      - name: Deploy Bleeding Edge version '@rneui/*' packages
-        run: |
-          for pkg in $(find ./packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n'); do
-               echo "Deploying @rneui/$pkg"
-               git subtree split --prefix packages/$pkg -b $pkg-${{ github.event.inputs.pr }} || exit 1  # Added error handling
-               git push origin $pkg-${{ github.event.inputs.pr }}:refs/heads/$pkg-${{ github.event.inputs.pr }} --force
-          done
-
-      - name: Message success
-        if: ${{ success() }}
-        uses: actions/github-script@v4
-        with:
-          github-token: ${{ secrets.RNE_BOT_TOKEN }}
-          script: |
-            github.issues.createComment({
-              issue_number: ${{github.event.inputs.pr}},
-              owner: context.repo.owner,
-              repo: context.repo.repo,
-              body: 'Hey, @${{github.actor}} PR Preview Build succeeded! ✅\n \n Install using \n```bash\n npm i ${{github.repository}}#base-${{ github.event.inputs.pr }} ${{github.repository}}#themed-${{ github.event.inputs.pr }}\n```',
-            });
-
-      - name: Message failure
-        if: ${{ failure() }}
-        uses: actions/github-script@v4
-        with:
-          github-token: ${{ secrets.RNE_BOT_TOKEN }}
-          script: |
-            github.issues.createComment({
-              issue_number: ${{github.event.inputs.pr}},
-              owner: context.repo.owner,
-              repo: context.repo.repo,
-              body: 'Deployment failed! ❌',
-            });
+name: (manual) PR's Bleeding Edge Version
+
+on:
+  workflow_dispatch:
+    inputs:
+      pr:
+        type: string
+        description: PR Number
+        required: true
+
+jobs:
+  preview:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Get PR SHA
+        id: sha
+        uses: actions/github-script@v4
+        with:
+          result-encoding: string
+          script: |
+            const { owner, repo } = context.issue;
+            const pr = await github.pulls.get({
+              owner,
+              repo,
+              pull_number: ${{github.event.inputs.pr}},
+            });
+            return pr.data.head.sha
+
+      - uses: actions/checkout@v3 # Updated to v3 for the latest checkout improvements
+        with:
+          ref: ${{ steps.sha.outputs.result }}
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+
+      - name: Build packages
+        run: yarn build
+
+      - name: Config git
+        run: |
+          git config --local user.email "104670806+rneui@users.noreply.github.com"
+          git config --local user.name "RNEUI"
+      - name: Create local changes
+        run: |
+          sed -i -e 's/dist/src/g' .gitignore
+          git rm -rf packages/*/src
+          jq 'del(.devDependencies."@rneui/base",.peerDependencies
```

**File**: `.github/workflows/bleeding-edge-dist.yml` (modified, +57/-57)
```diff
@@ -1,57 +1,57 @@
-name: Bleeding Edge version
-
-on:
-  push:
-    branches:
-      - 'next'
-    paths-ignore:
-      - 'website/**'
-      - 'example/**'
-      - 'scripts/**'
-      - '.github/**'
-
-jobs:
-  checks:
-    uses: ./.github/workflows/ci-checks.yml
-
-  build:
-    needs: checks
-    runs-on: ubuntu-latest
-    steps:
-      - name: Git checkout
-        uses: actions/checkout@v3 # Updated to v3 for latest improvements
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-
-      - name: Build packages
-        run: yarn build
-
-      - name: Config git
-        run: |
-          git config --local user.email "react-native-elements-ci@users.noreply.github.com"
-          git config --local user.name "React Native Elements CI"
-      - name: Create local changes
-        run: |
-          sed -i -e 's/dist/src/g' .gitignore
-          git rm -rf packages/*/src
-          jq 'del(.devDependencies."@rneui/base",.peerDependencies."@rneui/base")' packages/themed/package.json > packages/themed/package.json.temp || { echo "Error modifying package.json"; exit 1; }
-          mv packages/themed/package.json.temp packages/themed/package.json || { echo "Error renaming package.json"; exit 1; }
-          git add . 
-          git commit -m "Prepare Bleeding Edge Version" -a --no-verify
-
-      - name: Deploy Bleeding Edge version '@rneui/*' packages
-        run: |
-          for pkg in $(find ./packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n'); do
-               echo "Deploying @rneui/$pkg"
-               git subtree split --prefix packages/$pkg -b $pkg || { echo "Error splitting subtree for $pkg"; exit 1; }
-               git push origin $pkg:refs/heads/$pkg --force || { echo "Error pushing subtree for $pkg"; exit 1; }
-          done
+name: Bleeding Edge version
+
+on:
+  push:
+    branches:
+      - 'next'
+    paths-ignore:
+      - 'website/**'
+      - 'example/**'
+      - 'scripts/**'
+      - '.github/**'
+
+jobs:
+  checks:
+    uses: ./.github/workflows/ci-checks.yml
+
+  build:
+    needs: checks
+    runs-on: ubuntu-latest
+    steps:
+      - name: Git checkout
+        uses: actions/checkout@v3 # Updated to v3 for latest improvements
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+
+      - name: Build packages
+        run: yarn build
+
+      - name: Config git
+        run: |
+          git config --local user.email "react-native-elements-ci@users.noreply.github.com"
+          git config --local user.name "React Native Elements CI"
+      - name: Create local changes
+        run: |
+          sed -i -e 's/dist/src/g' .gitignore
+          git rm -rf packages/*/src
+          jq 'del(.devDependencies."@rneui/base",.peerDependencies."@rneui/base")' packages/themed/package.json > packages/themed/package.json.temp || { echo "Error modifying package.json"; exit 1; }
+          mv packages/themed/package.json.temp packages/themed/package.json || { echo "Error renaming package.json"; exit 1; }
+          git add . 
+          git commit -m "Prepare Bleeding Edge Version" -a --no-verify
+
+      - name: Deploy Bleeding Edge version '@rneui/*' packages
+        run: |
+          for pkg in $(find ./packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n'); do
+               echo "Deploying @rneui/$pkg"
+               git subtree split --prefix packages/$pkg -b $pkg || { echo "Error splitting subtree for $pkg"; exit 1; }
+               git push origin $pkg:refs/heads/$pkg --force || { echo "Error pushing subtree for $pkg"; exit 1; }
+          done
```

**File**: `.github/workflows/bump-version.yml` (modified, +88/-88)
```diff
@@ -1,88 +1,88 @@
-name: (manual PR) Bump release version
-
-on:
-  workflow_dispatch:
-    inputs:
-      name:
-        type: string
-        description: Release name
-        required: true
-
-jobs:
-  publish:
-    continue-on-error: true
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: 🏗 Setup repo
-        uses: actions/checkout@v3
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-
-      - name: Set env
-        run: |
-          BRANCH_NAME="bump-docs-$(date "+%Y%m%d%H%M%S")"
-          echo "BRANCH_NAME=${BRANCH_NAME}" >> $GITHUB_ENV
-
-      - name: Bump docs version
-        working-directory: website
-        run: |
-          yarn install
-          yarn version --new-version v${{ github.event.inputs.name }}
-
-      - name: Bump base version
-        working-directory: packages/base
-        run: |
-          yarn install
-          yarn version --new-version v${{ github.event.inputs.name }}
-
-      - name: Bump themed version
-        working-directory: packages/themed
-        run: |
-          yarn install
-          yarn version --new-version v${{ github.event.inputs.name }}
-
-      - name: Config git
-        run: |
-          git config --local user.email "76097094+deepktp@users.noreply.github.com"
-          git config --local user.name "GitHub Actions Bot"
-
-      - name: Checkout
-        run: |
-          git add .
-          git commit -m "Bump v${{ github.event.inputs.name }}"
-          git checkout -b "${{ env.BRANCH_NAME }}"
-          git push --set-upstream origin "${{ env.BRANCH_NAME }}" --force
-
-      - name: Create Pull Request
-        continue-on-error: true
-        uses: actions/github-script@v6
-        with:
-          script: |
-            const { repo, owner } = context.repo;
-            const result = await github.rest.pulls.create({
-              title: 'chore: bump v${{ github.event.inputs.name }}',
-              owner,
-              repo,
-              head: "${{ env.BRANCH_NAME }}",
-              base: 'next',
-              body: [
-                'This PR is auto-generated by',
-                '[actions/github-script](https://github.com/actions/github-script).'
-              ].join('\n')
-            });
-            github.rest.issues.addLabels({
-              owner,
-              repo,
-              issue_number: result.data.number,
-              labels: ['feature', 'automated pr', 'need-review']
-            });
+name: (manual PR) Bump release version
+
+on:
+  workflow_dispatch:
+    inputs:
+      name:
+        type: string
+        description: Release name
+        required: true
+
+jobs:
+  publish:
+    continue-on-error: true
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: 🏗 Setup repo
+        uses: actions/checkout@v3
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+
+      - name: Set env
+        run: |
+          BRANCH_NAME="bump-docs-$(date "+%Y%m%d%H%M%S")"
+          echo "BRANCH_NAME=${BRANCH_NAME}" >> $GITHUB_ENV
+
+      - name: Bump docs version
+        working-directory: website
+        run: |
+          yarn install
+          yarn version --new-version v${{ github.event.inputs.name }}
+
+      - name: Bump base version
+        working-directory: packages/base
+        run: |
+          yarn install
+          yarn version --new-version v${{ github.event.inputs.name }}
+
+      - name: Bump themed version
+        working-directory: packages/themed
+        run: |
+          yarn install
+          yarn version --new-version v${{ github.event.inputs.name }}
+
+      - name: Config git
+        run: |
+          git config --local user.email "76097094+deepktp@users.noreply.github.com"
+          git config --local user.name "GitHub Actions Bot"
+
+      - name: Checkout
+        run: |
+          git add .
+          git commit -m "Bump v${{ github.event.inputs.name }}"
+          git checkout -b "${{ env.BRANCH_NAME }}"
+          git push --set-upstream origin "${{ env.BRANCH_NAME }}" --force
+
+      - name: Create Pull Request
+        continue-on-error: true
+        uses: actions/github-script@v6
+        with:
+          script: |
+            const { repo, owner } = context.repo;
+            const result = await github.rest.pulls.create({
+              title: 'chore: bump v${{ github.event.inputs.name }}',
+              owner,
+              repo,
+              head: "${{ env.BR
```

**File**: `.github/workflows/ci-checks.yml` (modified, +78/-78)
```diff
@@ -1,78 +1,78 @@
-name: ci
-on:
-  workflow_call:
-  pull_request:
-    branches:
-      - next
-    paths-ignore:
-      - '.github/**'
-      - '.website/**'
-      - '.example/**'
-
-jobs:
-  test:
-    name: 'check_unit_tests'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - run: yarn test
-
-      - name: Upload coverage reports to Codecov
-        uses: codecov/codecov-action@v5
-        with:
-          token: ${{ secrets.CODECOV_TOKEN }}
-
-  typescript:
-    name: 'check_types'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - run: yarn typescript
-
-  lint:
-    name: 'check_lint'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - run: yarn lint
-      - run: yarn format
-
-  docs-api:
-    name: 'check_docs_api'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - name: Build 🔧
-        run: yarn docs-build-api
-      - name: Check for API changes
-        run: git diff --exit-code
-
-  # If dep changes this will cache them, else each job will try to update cache
-  install:
-    name: 'yarn_install'
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
+name: ci
+on:
+  workflow_call:
+  pull_request:
+    branches:
+      - next
+    paths-ignore:
+      - '.github/**'
+      - '.website/**'
+      - '.example/**'
+
+jobs:
+  test:
+    name: 'check_unit_tests'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - run: yarn test
+
+      - name: Upload coverage reports to Codecov
+        uses: codecov/codecov-action@v5
+        with:
+          token: ${{ secrets.CODECOV_TOKEN }}
+
+  typescript:
+    name: 'check_types'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - run: yarn typescript
+
+  lint:
+    name: 'check_lint'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - run: yarn lint
+      - run: yarn format
+
+  docs-api:
+    name: 'check_docs_api'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - name: Build 🔧
+        run: yarn docs-build-api
+      - name: Check for API changes
+        run: git diff --exit-code
+
+  # If dep changes this will cache them, else each job will try to update cache
+  install:
+    name: 'yarn_install'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
```

**File**: `.github/workflows/docs.yml` (modified, +45/-45)
```diff
@@ -1,45 +1,45 @@
-name: docs
-on:
-  push:
-    branches:
-      - master
-    paths:
-      - 'website/**'
-    
-  workflow_dispatch:
-
-jobs:
-  docs:
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout code
-        uses: actions/checkout@v3
-        with:
-          persist-credentials: false # avoid using GITHUB_TOKEN for push
-          fetch-depth: 0 # fetch all history to allow pushing refs to dest repo
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@3.2.4 --activate  # Website uses Yarn 3.2.4 for Docusaurus compatibility
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-        with:
-          install_website: true
-
-      - name: Build 🔧
-        run: yarn docs-build
-
-      - name: Deploy to gh-pages
-        uses: peaceiris/actions-gh-pages@v4
-        with:
-          github_token: ${{ secrets.GITHUB_TOKEN }}
-          publish_dir: ./website/build
-          user_name: "React Native Elements CI"
-          user_email: "react-native-elements-ci@users.noreply.github.com"
-          cname: reactnativeelements.com
-
+name: docs
+on:
+  push:
+    branches:
+      - master
+    paths:
+      - 'website/**'
+    
+  workflow_dispatch:
+
+jobs:
+  docs:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v3
+        with:
+          persist-credentials: false # avoid using GITHUB_TOKEN for push
+          fetch-depth: 0 # fetch all history to allow pushing refs to dest repo
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@3.2.4 --activate  # Website uses Yarn 3.2.4 for Docusaurus compatibility
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+        with:
+          install_website: true
+
+      - name: Build 🔧
+        run: yarn docs-build
+
+      - name: Deploy to gh-pages
+        uses: peaceiris/actions-gh-pages@v4
+        with:
+          github_token: ${{ secrets.GITHUB_TOKEN }}
+          publish_dir: ./website/build
+          user_name: "React Native Elements CI"
+          user_email: "react-native-elements-ci@users.noreply.github.com"
+          cname: reactnativeelements.com
+
```

---

### Incident Patch 3: `7661c645` (2026-01-27)
**Commit Message**: Merge pull request #4024 from theianmay/fix/ci-lockfile

fix(ci): resolve website build failures due to lockfile mismatch

**File**: `.gitattributes` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Enforce LF line endings for all text files
+* text=auto eol=lf
+
+# Binary files
+*.png binary
+*.jpg binary
+*.jpeg binary
+*.gif binary
+*.ico binary
+*.mov binary
+*.mp4 binary
+*.mp3 binary
+*.zip binary
+*.gz binary
+*.tgz binary
+*.ttf binary
+*.otf binary
+*.woff binary
+*.woff2 binary
+*.eot binary
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +62/-62)
```diff
@@ -1,62 +1,62 @@
-name: 🐛 Bug report
-description: Create a report to help us improve
-labels: ['Needs Triage']
-body:
-  - type: markdown
-    attributes:
-      value: |
-        A bug means that there is something broken or outside expectations in `react-native-elements`. If you only need help writing your own components, check out the [Discord server](https://discord.com/invite/e9RBHjkKHa) FIRST.
-  - type: checkboxes
-    attributes:
-      label: Is there an existing issue for this?
-      description: Please [search the history](https://github.com/react-native-elements/react-native-elements/issues) to see if an issue already exists for the same problem.
-      options:
-        - label: I have searched the existing issues
-          required: true
-  - type: textarea
-    attributes:
-      label: Explain what you did
-      description: What you were trying to accomplish.
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Expected behavior
-      description: Describe what happens instead of the expected behavior.
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Describe the bug
-      description: A clear and concise description of what the bug is.
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Steps To Reproduce
-      render: Markdown
-      description: |
-        We highly recommend that you re-create the bug on [Snack](https://snack.expo.io). If not, list the steps that a reviewer can take to reproduce the behaviour:
-        1. Go to '...'
-        2. Click on '....'
-        3. Scroll down to '....'
-        4. See error
-    validations:
-      required: true
-  - type: textarea
-    attributes:
-      label: Screenshots
-      description: If applicable, add screenshots to help explain your problem.
-  - type: textarea
-    attributes:
-      label: Your Environment
-      description: Run `npx @rneui/envinfo` and paste the results.
-      value: |
-        <details>
-        <summary>`npx @rneui/envinfo`</summary>
-
-              ```
-                Output from `npx @rneui/envinfo` goes here.
-              ```
-
-        </details>
+name: 🐛 Bug report
+description: Create a report to help us improve
+labels: ['Needs Triage']
+body:
+  - type: markdown
+    attributes:
+      value: |
+        A bug means that there is something broken or outside expectations in `react-native-elements`. If you only need help writing your own components, check out the [Discord server](https://discord.com/invite/e9RBHjkKHa) FIRST.
+  - type: checkboxes
+    attributes:
+      label: Is there an existing issue for this?
+      description: Please [search the history](https://github.com/react-native-elements/react-native-elements/issues) to see if an issue already exists for the same problem.
+      options:
+        - label: I have searched the existing issues
+          required: true
+  - type: textarea
+    attributes:
+      label: Explain what you did
+      description: What you were trying to accomplish.
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Expected behavior
+      description: Describe what happens instead of the expected behavior.
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Describe the bug
+      description: A clear and concise description of what the bug is.
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Steps To Reproduce
+      render: Markdown
+      description: |
+        We highly recommend that you re-create the bug on [Snack](https://snack.expo.io). If not, list the steps that a reviewer can take to reproduce the behaviour:
+        1. Go to '...'
+        2. Click on '....'
+        3. Scroll down to '....'
+        4. See error
+    validations:
+      required: true
+  - type: textarea
+    attributes:
+      label: Screenshots
+      description: If applicable, add screenshots to help explain your problem.
+  - type: textarea
+    attributes:
+      label: Your Environment
+      description: Run `npx @rneui/envinfo` and paste the results.
+      value: |
+        <details>
+        <summary>`npx @rneui/envinfo`</summary>
+
+              ```
+                Output from `npx @rneui/envinfo` goes here.
+              ```
+
+        </details>
```

**File**: `.github/actions/install/action.yml` (modified, +59/-59)
```diff
@@ -1,59 +1,59 @@
-name: Install dependencies
-author: arpitBhalla
-description: ''
-inputs:
-  install_website:
-    description: 'If true, install website dependencies.'
-    required: false
-runs:
-  using: composite
-  steps:
-    - uses: actions/checkout@v2
-
-    - name: Setup Node.js Environment
-      uses: actions/setup-node@v2
-      with:
-        node-version: 20
-
-    - name: Cache root dependencies
-      uses: actions/cache@v3
-      id: root_cache
-      with:
-        path: node_modules
-        key: ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
-
-    - name: Enable Corepack
-      run: corepack enable
-      shell: bash
-    # Commented out to allow workflows to specify their own Yarn version
-    # - name: Enable Yarn with Corepack
-    #   run: corepack prepare yarn@stable --activate
-    #   shell: bash
-
-    - name: Install root dependencies
-      if: steps.root_cache.outputs.cache-hit != 'true'
-      run: yarn install
-      shell: bash
-
-    - name: Cache website dependencies
-      uses: actions/cache@v3
-      if: inputs.install_website == 'true'
-      id: website_cache
-      with:
-        path: website/node_modules
-        key: ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
-
-    - name: Activate Yarn for website
-      if: inputs.install_website == 'true'
-      run: corepack prepare yarn@3.2.4 --activate
-      shell: bash
-
-    - name: Install website dependencies
-      if: steps.website_cache.outputs.cache-hit != 'true' && inputs.install_website == 'true'
-      run: yarn install --immutable
-      working-directory: website
-      shell: bash
+name: Install dependencies
+author: arpitBhalla
+description: ''
+inputs:
+  install_website:
+    description: 'If true, install website dependencies.'
+    required: false
+runs:
+  using: composite
+  steps:
+    - uses: actions/checkout@v2
+
+    - name: Setup Node.js Environment
+      uses: actions/setup-node@v2
+      with:
+        node-version: 20
+
+    - name: Cache root dependencies
+      uses: actions/cache@v3
+      id: root_cache
+      with:
+        path: node_modules
+        key: ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
+        restore-keys: |
+          ${{ runner.os }}-rne-cache-${{ hashFiles('yarn.lock') }}
+
+    - name: Enable Corepack
+      run: corepack enable
+      shell: bash
+    # Commented out to allow workflows to specify their own Yarn version
+    # - name: Enable Yarn with Corepack
+    #   run: corepack prepare yarn@stable --activate
+    #   shell: bash
+
+    - name: Install root dependencies
+      if: steps.root_cache.outputs.cache-hit != 'true'
+      run: yarn install
+      shell: bash
+
+    - name: Cache website dependencies
+      uses: actions/cache@v3
+      if: inputs.install_website == 'true'
+      id: website_cache
+      with:
+        path: website/node_modules
+        key: ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
+        restore-keys: |
+          ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
+
+    - name: Activate Yarn for website
+      if: inputs.install_website == 'true'
+      run: corepack prepare yarn@3.2.4 --activate
+      shell: bash
+
+    - name: Install website dependencies
+      if: steps.website_cache.outputs.cache-hit != 'true' && inputs.install_website == 'true'
+      run: yarn install --mode=update-lockfile
+      working-directory: website
+      shell: bash
```

**File**: `.github/workflows/bleeding-edge-dist-PR.yml` (modified, +92/-92)
```diff
@@ -1,92 +1,92 @@
-name: (manual) PR's Bleeding Edge Version
-
-on:
-  workflow_dispatch:
-    inputs:
-      pr:
-        type: string
-        description: PR Number
-        required: true
-
-jobs:
-  preview:
-    runs-on: ubuntu-latest
-    steps:
-      - name: Get PR SHA
-        id: sha
-        uses: actions/github-script@v4
-        with:
-          result-encoding: string
-          script: |
-            const { owner, repo } = context.issue;
-            const pr = await github.pulls.get({
-              owner,
-              repo,
-              pull_number: ${{github.event.inputs.pr}},
-            });
-            return pr.data.head.sha
-
-      - uses: actions/checkout@v3 # Updated to v3 for the latest checkout improvements
-        with:
-          ref: ${{ steps.sha.outputs.result }}
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-
-      - name: Build packages
-        run: yarn build
-
-      - name: Config git
-        run: |
-          git config --local user.email "104670806+rneui@users.noreply.github.com"
-          git config --local user.name "RNEUI"
-      - name: Create local changes
-        run: |
-          sed -i -e 's/dist/src/g' .gitignore
-          git rm -rf packages/*/src
-          jq 'del(.devDependencies."@rneui/base",.peerDependencies."@rneui/base")'  packages/themed/package.json >  packages/themed/package.json.temp
-          mv packages/themed/package.json.temp packages/themed/package.json
-          git add .
-          git commit -m "Bleeding Edge Version" -a --no-verify
-
-      - name: Deploy Bleeding Edge version '@rneui/*' packages
-        run: |
-          for pkg in $(find ./packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n'); do
-               echo "Deploying @rneui/$pkg"
-               git subtree split --prefix packages/$pkg -b $pkg-${{ github.event.inputs.pr }} || exit 1  # Added error handling
-               git push origin $pkg-${{ github.event.inputs.pr }}:refs/heads/$pkg-${{ github.event.inputs.pr }} --force
-          done
-
-      - name: Message success
-        if: ${{ success() }}
-        uses: actions/github-script@v4
-        with:
-          github-token: ${{ secrets.RNE_BOT_TOKEN }}
-          script: |
-            github.issues.createComment({
-              issue_number: ${{github.event.inputs.pr}},
-              owner: context.repo.owner,
-              repo: context.repo.repo,
-              body: 'Hey, @${{github.actor}} PR Preview Build succeeded! ✅\n \n Install using \n```bash\n npm i ${{github.repository}}#base-${{ github.event.inputs.pr }} ${{github.repository}}#themed-${{ github.event.inputs.pr }}\n```',
-            });
-
-      - name: Message failure
-        if: ${{ failure() }}
-        uses: actions/github-script@v4
-        with:
-          github-token: ${{ secrets.RNE_BOT_TOKEN }}
-          script: |
-            github.issues.createComment({
-              issue_number: ${{github.event.inputs.pr}},
-              owner: context.repo.owner,
-              repo: context.repo.repo,
-              body: 'Deployment failed! ❌',
-            });
+name: (manual) PR's Bleeding Edge Version
+
+on:
+  workflow_dispatch:
+    inputs:
+      pr:
+        type: string
+        description: PR Number
+        required: true
+
+jobs:
+  preview:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Get PR SHA
+        id: sha
+        uses: actions/github-script@v4
+        with:
+          result-encoding: string
+          script: |
+            const { owner, repo } = context.issue;
+            const pr = await github.pulls.get({
+              owner,
+              repo,
+              pull_number: ${{github.event.inputs.pr}},
+            });
+            return pr.data.head.sha
+
+      - uses: actions/checkout@v3 # Updated to v3 for the latest checkout improvements
+        with:
+          ref: ${{ steps.sha.outputs.result }}
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+
+      - name: Build packages
+        run: yarn build
+
+      - name: Config git
+        run: |
+          git config --local user.email "104670806+rneui@users.noreply.github.com"
+          git config --local user.name "RNEUI"
+      - name: Create local changes
+        run: |
+          sed -i -e 's/dist/src/g' .gitignore
+          git rm -rf packages/*/src
+          jq 'del(.devDependencies."@rneui/base",.peerDependencies
```

**File**: `.github/workflows/bleeding-edge-dist.yml` (modified, +57/-57)
```diff
@@ -1,57 +1,57 @@
-name: Bleeding Edge version
-
-on:
-  push:
-    branches:
-      - 'next'
-    paths-ignore:
-      - 'website/**'
-      - 'example/**'
-      - 'scripts/**'
-      - '.github/**'
-
-jobs:
-  checks:
-    uses: ./.github/workflows/ci-checks.yml
-
-  build:
-    needs: checks
-    runs-on: ubuntu-latest
-    steps:
-      - name: Git checkout
-        uses: actions/checkout@v3 # Updated to v3 for latest improvements
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-
-      - name: Build packages
-        run: yarn build
-
-      - name: Config git
-        run: |
-          git config --local user.email "react-native-elements-ci@users.noreply.github.com"
-          git config --local user.name "React Native Elements CI"
-      - name: Create local changes
-        run: |
-          sed -i -e 's/dist/src/g' .gitignore
-          git rm -rf packages/*/src
-          jq 'del(.devDependencies."@rneui/base",.peerDependencies."@rneui/base")' packages/themed/package.json > packages/themed/package.json.temp || { echo "Error modifying package.json"; exit 1; }
-          mv packages/themed/package.json.temp packages/themed/package.json || { echo "Error renaming package.json"; exit 1; }
-          git add . 
-          git commit -m "Prepare Bleeding Edge Version" -a --no-verify
-
-      - name: Deploy Bleeding Edge version '@rneui/*' packages
-        run: |
-          for pkg in $(find ./packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n'); do
-               echo "Deploying @rneui/$pkg"
-               git subtree split --prefix packages/$pkg -b $pkg || { echo "Error splitting subtree for $pkg"; exit 1; }
-               git push origin $pkg:refs/heads/$pkg --force || { echo "Error pushing subtree for $pkg"; exit 1; }
-          done
+name: Bleeding Edge version
+
+on:
+  push:
+    branches:
+      - 'next'
+    paths-ignore:
+      - 'website/**'
+      - 'example/**'
+      - 'scripts/**'
+      - '.github/**'
+
+jobs:
+  checks:
+    uses: ./.github/workflows/ci-checks.yml
+
+  build:
+    needs: checks
+    runs-on: ubuntu-latest
+    steps:
+      - name: Git checkout
+        uses: actions/checkout@v3 # Updated to v3 for latest improvements
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+
+      - name: Build packages
+        run: yarn build
+
+      - name: Config git
+        run: |
+          git config --local user.email "react-native-elements-ci@users.noreply.github.com"
+          git config --local user.name "React Native Elements CI"
+      - name: Create local changes
+        run: |
+          sed -i -e 's/dist/src/g' .gitignore
+          git rm -rf packages/*/src
+          jq 'del(.devDependencies."@rneui/base",.peerDependencies."@rneui/base")' packages/themed/package.json > packages/themed/package.json.temp || { echo "Error modifying package.json"; exit 1; }
+          mv packages/themed/package.json.temp packages/themed/package.json || { echo "Error renaming package.json"; exit 1; }
+          git add . 
+          git commit -m "Prepare Bleeding Edge Version" -a --no-verify
+
+      - name: Deploy Bleeding Edge version '@rneui/*' packages
+        run: |
+          for pkg in $(find ./packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n'); do
+               echo "Deploying @rneui/$pkg"
+               git subtree split --prefix packages/$pkg -b $pkg || { echo "Error splitting subtree for $pkg"; exit 1; }
+               git push origin $pkg:refs/heads/$pkg --force || { echo "Error pushing subtree for $pkg"; exit 1; }
+          done
```

**File**: `.github/workflows/bump-version.yml` (modified, +88/-88)
```diff
@@ -1,88 +1,88 @@
-name: (manual PR) Bump release version
-
-on:
-  workflow_dispatch:
-    inputs:
-      name:
-        type: string
-        description: Release name
-        required: true
-
-jobs:
-  publish:
-    continue-on-error: true
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: 🏗 Setup repo
-        uses: actions/checkout@v3
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-
-      - name: Set env
-        run: |
-          BRANCH_NAME="bump-docs-$(date "+%Y%m%d%H%M%S")"
-          echo "BRANCH_NAME=${BRANCH_NAME}" >> $GITHUB_ENV
-
-      - name: Bump docs version
-        working-directory: website
-        run: |
-          yarn install
-          yarn version --new-version v${{ github.event.inputs.name }}
-
-      - name: Bump base version
-        working-directory: packages/base
-        run: |
-          yarn install
-          yarn version --new-version v${{ github.event.inputs.name }}
-
-      - name: Bump themed version
-        working-directory: packages/themed
-        run: |
-          yarn install
-          yarn version --new-version v${{ github.event.inputs.name }}
-
-      - name: Config git
-        run: |
-          git config --local user.email "76097094+deepktp@users.noreply.github.com"
-          git config --local user.name "GitHub Actions Bot"
-
-      - name: Checkout
-        run: |
-          git add .
-          git commit -m "Bump v${{ github.event.inputs.name }}"
-          git checkout -b "${{ env.BRANCH_NAME }}"
-          git push --set-upstream origin "${{ env.BRANCH_NAME }}" --force
-
-      - name: Create Pull Request
-        continue-on-error: true
-        uses: actions/github-script@v6
-        with:
-          script: |
-            const { repo, owner } = context.repo;
-            const result = await github.rest.pulls.create({
-              title: 'chore: bump v${{ github.event.inputs.name }}',
-              owner,
-              repo,
-              head: "${{ env.BRANCH_NAME }}",
-              base: 'next',
-              body: [
-                'This PR is auto-generated by',
-                '[actions/github-script](https://github.com/actions/github-script).'
-              ].join('\n')
-            });
-            github.rest.issues.addLabels({
-              owner,
-              repo,
-              issue_number: result.data.number,
-              labels: ['feature', 'automated pr', 'need-review']
-            });
+name: (manual PR) Bump release version
+
+on:
+  workflow_dispatch:
+    inputs:
+      name:
+        type: string
+        description: Release name
+        required: true
+
+jobs:
+  publish:
+    continue-on-error: true
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: 🏗 Setup repo
+        uses: actions/checkout@v3
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+
+      - name: Set env
+        run: |
+          BRANCH_NAME="bump-docs-$(date "+%Y%m%d%H%M%S")"
+          echo "BRANCH_NAME=${BRANCH_NAME}" >> $GITHUB_ENV
+
+      - name: Bump docs version
+        working-directory: website
+        run: |
+          yarn install
+          yarn version --new-version v${{ github.event.inputs.name }}
+
+      - name: Bump base version
+        working-directory: packages/base
+        run: |
+          yarn install
+          yarn version --new-version v${{ github.event.inputs.name }}
+
+      - name: Bump themed version
+        working-directory: packages/themed
+        run: |
+          yarn install
+          yarn version --new-version v${{ github.event.inputs.name }}
+
+      - name: Config git
+        run: |
+          git config --local user.email "76097094+deepktp@users.noreply.github.com"
+          git config --local user.name "GitHub Actions Bot"
+
+      - name: Checkout
+        run: |
+          git add .
+          git commit -m "Bump v${{ github.event.inputs.name }}"
+          git checkout -b "${{ env.BRANCH_NAME }}"
+          git push --set-upstream origin "${{ env.BRANCH_NAME }}" --force
+
+      - name: Create Pull Request
+        continue-on-error: true
+        uses: actions/github-script@v6
+        with:
+          script: |
+            const { repo, owner } = context.repo;
+            const result = await github.rest.pulls.create({
+              title: 'chore: bump v${{ github.event.inputs.name }}',
+              owner,
+              repo,
+              head: "${{ env.BR
```

**File**: `.github/workflows/ci-checks.yml` (modified, +78/-78)
```diff
@@ -1,78 +1,78 @@
-name: ci
-on:
-  workflow_call:
-  pull_request:
-    branches:
-      - next
-    paths-ignore:
-      - '.github/**'
-      - '.website/**'
-      - '.example/**'
-
-jobs:
-  test:
-    name: 'check_unit_tests'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - run: yarn test
-
-      - name: Upload coverage reports to Codecov
-        uses: codecov/codecov-action@v5
-        with:
-          token: ${{ secrets.CODECOV_TOKEN }}
-
-  typescript:
-    name: 'check_types'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - run: yarn typescript
-
-  lint:
-    name: 'check_lint'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - run: yarn lint
-      - run: yarn format
-
-  docs-api:
-    name: 'check_docs_api'
-    needs: install
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
-      - name: Build 🔧
-        run: yarn docs-build-api
-      - name: Check for API changes
-        run: git diff --exit-code
-
-  # If dep changes this will cache them, else each job will try to update cache
-  install:
-    name: 'yarn_install'
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v3
-      - name: Install dependencies
-        uses: ./.github/actions/install
+name: ci
+on:
+  workflow_call:
+  pull_request:
+    branches:
+      - next
+    paths-ignore:
+      - '.github/**'
+      - '.website/**'
+      - '.example/**'
+
+jobs:
+  test:
+    name: 'check_unit_tests'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - run: yarn test
+
+      - name: Upload coverage reports to Codecov
+        uses: codecov/codecov-action@v5
+        with:
+          token: ${{ secrets.CODECOV_TOKEN }}
+
+  typescript:
+    name: 'check_types'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - run: yarn typescript
+
+  lint:
+    name: 'check_lint'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - run: yarn lint
+      - run: yarn format
+
+  docs-api:
+    name: 'check_docs_api'
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
+      - name: Build 🔧
+        run: yarn docs-build-api
+      - name: Check for API changes
+        run: git diff --exit-code
+
+  # If dep changes this will cache them, else each job will try to update cache
+  install:
+    name: 'yarn_install'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Install dependencies
+        uses: ./.github/actions/install
```

**File**: `.github/workflows/docs.yml` (modified, +45/-45)
```diff
@@ -1,45 +1,45 @@
-name: docs
-on:
-  push:
-    branches:
-      - master
-    paths:
-      - 'website/**'
-    
-  workflow_dispatch:
-
-jobs:
-  docs:
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout code
-        uses: actions/checkout@v3
-        with:
-          persist-credentials: false # avoid using GITHUB_TOKEN for push
-          fetch-depth: 0 # fetch all history to allow pushing refs to dest repo
-
-      - name: Enable Corepack
-        run: corepack enable
-        shell: bash
-
-      - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@3.2.4 --activate  # Website uses Yarn 3.2.4 for Docusaurus compatibility
-        shell: bash
-
-      - name: Install dependencies
-        uses: ./.github/actions/install
-        with:
-          install_website: true
-
-      - name: Build 🔧
-        run: yarn docs-build
-
-      - name: Deploy to gh-pages
-        uses: peaceiris/actions-gh-pages@v4
-        with:
-          github_token: ${{ secrets.GITHUB_TOKEN }}
-          publish_dir: ./website/build
-          user_name: "React Native Elements CI"
-          user_email: "react-native-elements-ci@users.noreply.github.com"
-          cname: reactnativeelements.com
-
+name: docs
+on:
+  push:
+    branches:
+      - master
+    paths:
+      - 'website/**'
+    
+  workflow_dispatch:
+
+jobs:
+  docs:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v3
+        with:
+          persist-credentials: false # avoid using GITHUB_TOKEN for push
+          fetch-depth: 0 # fetch all history to allow pushing refs to dest repo
+
+      - name: Enable Corepack
+        run: corepack enable
+        shell: bash
+
+      - name: Enable Yarn with Corepack
+        run: corepack prepare yarn@3.2.4 --activate  # Website uses Yarn 3.2.4 for Docusaurus compatibility
+        shell: bash
+
+      - name: Install dependencies
+        uses: ./.github/actions/install
+        with:
+          install_website: true
+
+      - name: Build 🔧
+        run: yarn docs-build
+
+      - name: Deploy to gh-pages
+        uses: peaceiris/actions-gh-pages@v4
+        with:
+          github_token: ${{ secrets.GITHUB_TOKEN }}
+          publish_dir: ./website/build
+          user_name: "React Native Elements CI"
+          user_email: "react-native-elements-ci@users.noreply.github.com"
+          cname: reactnativeelements.com
+
```

---

### Incident Patch 4: `2a40e193` (2026-01-24)
**Commit Message**: fix(docs): fix depenedencies and yarn lock

**File**: `package.json` (modified, +0/-1)
```diff
@@ -11,7 +11,6 @@
   },
   "resolutions": {
     "form-data": "^4.0.4",
-    "js-yaml": "^4.1.1",
     "lodash": "^4.17.21",
     "node-gyp": "^10.0.0",
     "parse-path": "^7.0.0",
```

**File**: `website/package.json` (modified, +10/-9)
```diff
@@ -20,7 +20,6 @@
     "http-cache-semantics": "^4.1.1",
     "eta": "^2.0.0",
     "json5": "^2.2.2",
-    "js-yaml": "^4.1.1",
     "ip": "^2.0.1",
     "loader-utils": "^2.0.4",
     "minimatch": "^3.0.5",
@@ -71,13 +70,13 @@
   "version": "4.0.0",
   "dependencies": {
     "@babel/core": "^7.17.10",
-    "@docusaurus/core": "^2.3.0",
-    "@docusaurus/plugin-client-redirects": "^2.3.0",
-    "@docusaurus/plugin-google-analytics": "^2.3.0",
-    "@docusaurus/plugin-google-gtag": "^2.3.0",
-    "@docusaurus/preset-classic": "^2.3.0",
-    "@docusaurus/theme-live-codeblock": "2.3.0",
-    "@docusaurus/types": "^2.3.0",
+    "@docusaurus/core": "2.4.3",
+    "@docusaurus/plugin-client-redirects": "2.4.3",
+    "@docusaurus/plugin-google-analytics": "2.4.3",
+    "@docusaurus/plugin-google-gtag": "2.4.3",
+    "@docusaurus/preset-classic": "2.4.3",
+    "@docusaurus/theme-live-codeblock": "2.4.3",
+    "@docusaurus/types": "2.4.3",
     "@rneui/base": "../packages/base",
     "@rneui/layout": "^0.0.0-alpha.6",
     "assert": "^2.0.0",
@@ -101,17 +100,19 @@
     "style-loader": "^3.3.1"
   },
   "devDependencies": {
-    "@docusaurus/module-type-aliases": "^2.3.0",
+    "@docusaurus/module-type-aliases": "2.4.3",
     "@tsconfig/docusaurus": "^1.0.4",
     "@types/assert": "^1.5.6",
     "@types/jest": "^27.0.3",
     "@types/node": "^17.0.23",
     "@types/react": "^17.0.43",
     "@types/react-dom": "^17.0.14",
+    "autoprefixer": "^10.4.16",
     "babel-loader": "^8.2.4",
     "fast-glob": "^3.2.11",
     "jest": "^27.5.1",
     "process": "^0.11.10",
+    "tailwindcss": "^3.4.0",
     "typescript": "^4.6.3"
   }
 }
```

---

### Incident Patch 5: `4eb18f8b` (2026-01-19)
**Commit Message**: fix(Actions): activate Yarn 3.2.4 for website installation step

Add Corepack activation step to prepare Yarn 3.2.4 before installing website dependencies. Update install command to use --immutable flag for reproducible builds.

**File**: `.github/actions/install/action.yml` (modified, +6/-1)
```diff
@@ -47,8 +47,13 @@ runs:
         restore-keys: |
           ${{ runner.os }}-rne-website-${{ hashFiles('website/yarn.lock') }}
 
+    - name: Activate Yarn for website
+      if: inputs.install_website == 'true'
+      run: corepack prepare yarn@3.2.4 --activate
+      shell: bash
+
     - name: Install website dependencies
       if: steps.website_cache.outputs.cache-hit != 'true' && inputs.install_website == 'true'
-      run: yarn install
+      run: yarn install --immutable
       working-directory: website
       shell: bash
```

**File**: `website/.yarnrc.yml` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 nodeLinker: node-modules
 
-yarnPath: .yarn/releases/yarn-3.2.4.cjs
+# Commented out to use Corepack instead of committed binary
+# yarnPath: .yarn/releases/yarn-3.2.4.cjs
 
 plugins:
   - path: .yarn/plugins/@yarnpkg/plugin-interactive-tools.cjs
```

**File**: `website/yarn.lock` (modified, +2/-2)
```diff
@@ -3140,7 +3140,7 @@ __metadata:
 
 "@rneui/base@file:../packages/base::locator=rne-website%40workspace%3A.":
   version: 5.0.0
-  resolution: "@rneui/base@file:../packages/base#../packages/base::hash=431a73&locator=rne-website%40workspace%3A."
+  resolution: "@rneui/base@file:../packages/base#../packages/base::hash=bd5bf2&locator=rne-website%40workspace%3A."
   dependencies:
     color: ^3.2.1
     deepmerge: ^4.2.2
@@ -3150,7 +3150,7 @@ __metadata:
     "@testing-library/jest-native": ^5.4.3
     "@testing-library/react-native": ^13.2.0
     react-native-safe-area-context: ">= 3.0.0"
-  checksum: eddc0938f478e93031d03ca190701cc46d8417b547858e6ede653a6483ed6f815b91f5129a40c2518c2b3c95a59da21caa8d812c56636b5cd5da2740b53a26d8
+  checksum: 91ceb37db188f44ff93c1992af9a786734cf028f992809ab6b2f74921032b5809bd6f7b0a0b4278d5183f4b4b6361bb9fe0d60818584746db423a47cb6ddb320
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 6: `7290fd3a` (2026-01-19)
**Commit Message**: Merge pull request #4020 from theianmay/fix/ci-yarn

fix(Actions): update yarn version approach

**File**: `.github/actions/install/action.yml` (modified, +4/-3)
```diff
@@ -27,9 +27,10 @@ runs:
     - name: Enable Corepack
       run: corepack enable
       shell: bash
-    - name: Enable Yarn with Corepack
-      run: corepack prepare yarn@stable --activate
-      shell: bash
+    # Commented out to allow workflows to specify their own Yarn version
+    # - name: Enable Yarn with Corepack
+    #   run: corepack prepare yarn@stable --activate
+    #   shell: bash
 
     - name: Install root dependencies
       if: steps.root_cache.outputs.cache-hit != 'true'
```

**File**: `.github/workflows/bleeding-edge-dist-PR.yml` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@stable --activate
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
         shell: bash
 
       - name: Install dependencies
```

**File**: `.github/workflows/bleeding-edge-dist.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@stable --activate
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
         shell: bash
 
       - name: Install dependencies
```

**File**: `.github/workflows/bump-version.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@stable --activate
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
         shell: bash
 
       - name: Install dependencies
```

**File**: `.github/workflows/ci-checks.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@stable --activate
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
         shell: bash
 
       - name: Install dependencies
```

**File**: `.github/workflows/docs.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@3.2.4 --activate
+        run: corepack prepare yarn@3.2.4 --activate  # Website uses Yarn 3.2.4 for Docusaurus compatibility
         shell: bash
 
       - name: Install dependencies
```

**File**: `.github/workflows/expo-preview-PR.yml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@stable --activate
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
         shell: bash
 
       - name: Install dependencies
```

**File**: `.github/workflows/expo.yml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ jobs:
         shell: bash
 
       - name: Enable Yarn with Corepack
-        run: corepack prepare yarn@stable --activate
+        run: corepack prepare yarn@4.5.2 --activate  # Root packages use Yarn 4.5.2
         shell: bash
 
       - name: Install dependencies
```

---

### Incident Patch 7: `96070e49` (2025-11-26)
**Commit Message**: Merge pull request #4006 from theianmay/fix/ci-build-errors

chore: update @rneui/base dependency to 5.0.0-beta.1

**File**: `packages/themed/package.json` (modified, +2/-2)
```diff
@@ -64,10 +64,10 @@
     "logo": "https://opencollective.com/react-native-elements/logo.txt"
   },
   "peerDependencies": {
-    "@rneui/base": "4.0.0-rc.8"
+    "@rneui/base": "5.0.0-beta.1"
   },
   "devDependencies": {
-    "@rneui/base": "4.0.0-rc.8"
+    "@rneui/base": "5.0.0-beta.1"
   },
   "repository": {
     "type": "git",
```

---

### Incident Patch 8: `6fedc3fc` (2025-11-26)
**Commit Message**: chore: update @rneui/base dependency to 5.0.0-beta.1

**File**: `packages/themed/package.json` (modified, +2/-2)
```diff
@@ -64,10 +64,10 @@
     "logo": "https://opencollective.com/react-native-elements/logo.txt"
   },
   "peerDependencies": {
-    "@rneui/base": "4.0.0-rc.8"
+    "@rneui/base": "5.0.0-beta.1"
   },
   "devDependencies": {
-    "@rneui/base": "4.0.0-rc.8"
+    "@rneui/base": "5.0.0-beta.1"
   },
   "repository": {
     "type": "git",
```

---

### Incident Patch 9: `111bb73f` (2025-11-25)
**Commit Message**: Merge pull request #4003 from deepktp/rne-slider-alignment-issue-fix

fix: slider track alignment issue fix for new rn versions

**File**: `packages/base/src/Slider/Slider.tsx` (modified, +3/-13)
```diff
@@ -11,20 +11,19 @@ import {
   Animated,
   Easing,
   PanResponder,
-  Platform,
   ViewStyle,
   StyleProp,
   GestureResponderEvent,
   PanResponderGestureState,
   LayoutChangeEvent,
+  Platform,
 } from 'react-native';
 import { RneFunctionComponent } from '../helpers';
 import { Rect } from './components/Rect';
 import { SliderThumb } from './components/SliderThumb';
 
 const TRACK_SIZE = 4;
 const THUMB_SIZE = 40;
-const TRACK_STYLE = Platform.select({ web: 0, default: -1 });
 const DEFAULT_ANIMATION_CONFIGS = {
   spring: {
     friction: 7,
@@ -52,7 +51,7 @@ const getBoundedValue = (
 const handlePanResponderRequestEnd = () => false;
 
 // Should we become active when the user moves a touch over the thumb?
-const handleMoveShouldSetPanResponder = () => !TRACK_STYLE;
+const handleMoveShouldSetPanResponder = () => Platform.OS !== 'web';
 
 type Sizable = {
   width: number;
@@ -502,21 +501,12 @@ export const Slider: RneFunctionComponent<SliderProps> = ({
           thumbStart,
           thumbSize.height / 2
         );
-        minimumTrackStyle.marginLeft = trackSize.width * TRACK_STYLE;
       } else {
         minimumTrackStyle.width = Animated.add(thumbStart, thumbSize.width / 2);
-        minimumTrackStyle.marginTop = trackSize.height * TRACK_STYLE;
       }
       return minimumTrackStyle;
     },
-    [
-      allMeasured,
-      isVertical,
-      thumbSize.height,
-      thumbSize.width,
-      trackSize.height,
-      trackSize.width,
-    ]
+    [allMeasured, isVertical, thumbSize.height, thumbSize.width]
   );
 
   const panResponder = useMemo(
```

**File**: `packages/base/src/Slider/__tests__/__snapshots__/Slider.test.tsx.snap` (modified, +0/-2)
```diff
@@ -41,7 +41,6 @@ exports[`Slider component should handle all onLayout actions 1`] = `
           "backgroundColor": "#3f3f3f",
           "borderRadius": 2,
           "height": 4,
-          "marginTop": -20,
           "position": "absolute",
           "width": 150,
         }
@@ -144,7 +143,6 @@ exports[`Slider component should handle all onLayout actions with vertical orien
           "borderRadius": 2,
           "flex": 1,
           "height": 150,
-          "marginLeft": -20,
           "position": "absolute",
           "width": 4,
         }
```

---

### Incident Patch 10: `939ba43f` (2025-11-24)
**Commit Message**: Merge branch 'next' into rne-slider-alignment-issue-fix

**File**: `package.json` (modified, +2/-0)
```diff
@@ -51,9 +51,11 @@
     "@testing-library/react-native": "^13.2.0",
     "@tsconfig/react-native": "^3.0.0",
     "@types/babel__preset-env": "^7",
+    "@types/copyfiles": "^2",
     "@types/react": "^19.1.0",
     "@types/react-test-renderer": "^19.1.0",
     "babel-jest": "^29.6.3",
+    "copyfiles": "^2.4.1",
     "eslint": "^8.19.0",
     "eslint-plugin-ft-flow": "^3.0.11",
     "eslint-plugin-prettier": "^4.0.0",
```

**File**: `packages/base/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     "bootstrap"
   ],
   "scripts": {
-    "build": "yarn run -T tsc --composite false",
+    "build": "yarn run -T tsc --composite false && yarn run -T copyfiles -u 1 \"src/**/images/**\" dist",
     "test": "yarn run -T jest  --coverage",
     "test:update": "yarn run -T jest -u  --coverage",
     "test:ci": "yarn run -T jest --runInBand  --coverage",
```

**File**: `yarn.lock` (modified, +75/-5)
```diff
@@ -5243,6 +5243,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@types/copyfiles@npm:^2":
+  version: 2.4.4
+  resolution: "@types/copyfiles@npm:2.4.4"
+  checksum: 10/0513199240828feda5f6ed04c69d6a642c47e6ab66b81214716807f948ed3e865e9b3d2b69f75cbcc6fbe2154630755c47ca473b3913f0a831179366c709a8cc
+  languageName: node
+  linkType: hard
+
 "@types/dedent@npm:^0.7.0":
   version: 0.7.2
   resolution: "@types/dedent@npm:0.7.2"
@@ -8007,6 +8014,24 @@ __metadata:
   languageName: node
   linkType: hard
 
+"copyfiles@npm:^2.4.1":
+  version: 2.4.1
+  resolution: "copyfiles@npm:2.4.1"
+  dependencies:
+    glob: "npm:^7.0.5"
+    minimatch: "npm:^3.0.3"
+    mkdirp: "npm:^1.0.4"
+    noms: "npm:0.0.0"
+    through2: "npm:^2.0.1"
+    untildify: "npm:^4.0.0"
+    yargs: "npm:^16.1.0"
+  bin:
+    copyfiles: copyfiles
+    copyup: copyfiles
+  checksum: 10/17070f88cbeaf62a9355341cb2521bacd48069e1ac8e7f95a3f69c848c53646f16ff0f94807a789e0f3eedc11407ec8d3980a13ab62e2add6ef81d0a5900fd85
+  languageName: node
+  linkType: hard
+
 "core-js-compat@npm:^3.43.0":
   version: 3.46.0
   resolution: "core-js-compat@npm:3.46.0"
@@ -10631,7 +10656,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"glob@npm:^7.0.3, glob@npm:^7.1.1, glob@npm:^7.1.3, glob@npm:^7.1.4, glob@npm:^7.1.6":
+"glob@npm:^7.0.3, glob@npm:^7.0.5, glob@npm:^7.1.1, glob@npm:^7.1.3, glob@npm:^7.1.4, glob@npm:^7.1.6":
   version: 7.2.3
   resolution: "glob@npm:7.2.3"
   dependencies:
@@ -11310,7 +11335,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"inherits@npm:2, inherits@npm:2.0.4, inherits@npm:^2.0.1, inherits@npm:^2.0.3, inherits@npm:^2.0.4, inherits@npm:~2.0.3":
+"inherits@npm:2, inherits@npm:2.0.4, inherits@npm:^2.0.1, inherits@npm:^2.0.3, inherits@npm:^2.0.4, inherits@npm:~2.0.1, inherits@npm:~2.0.3":
   version: 2.0.4
   resolution: "inherits@npm:2.0.4"
   checksum: 10/cd45e923bee15186c07fa4c89db0aace24824c482fb887b528304694b2aa6ff8a898da8657046a5dcf3e46cd6db6c61629551f9215f208d7c3f157cf9b290521
@@ -11904,6 +11929,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"isarray@npm:0.0.1":
+  version: 0.0.1
+  resolution: "isarray@npm:0.0.1"
+  checksum: 10/49191f1425681df4a18c2f0f93db3adb85573bcdd6a4482539d98eac9e705d8961317b01175627e860516a2fc45f8f9302db26e5a380a97a520e272e2a40a8d4
+  languageName: node
+  linkType: hard
+
 "isarray@npm:^2.0.5":
   version: 2.0.5
   resolution: "isarray@npm:2.0.5"
@@ -14174,7 +14206,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"minimatch@npm:^3.0.2, minimatch@npm:^3.0.4, minimatch@npm:^3.0.5, minimatch@npm:^3.1.1, minimatch@npm:^3.1.2":
+"minimatch@npm:^3.0.2, minimatch@npm:^3.0.3, minimatch@npm:^3.0.4, minimatch@npm:^3.0.5, minimatch@npm:^3.1.1, minimatch@npm:^3.1.2":
   version: 3.1.2
   resolution: "minimatch@npm:3.1.2"
   dependencies:
@@ -14567,6 +14599,16 @@ __metadata:
   languageName: node
   linkType: hard
 
+"noms@npm:0.0.0":
+  version: 0.0.0
+  resolution: "noms@npm:0.0.0"
+  dependencies:
+    inherits: "npm:^2.0.1"
+    readable-stream: "npm:~1.0.31"
+  checksum: 10/a05f056dabf764c86472b6b5aad10455f3adcb6971f366cdf36a72b559b29310a940e316bca30802f2804fdd41707941366224f4cba80c4f53071512245bf200
+  languageName: node
+  linkType: hard
+
 "nopt@npm:^7.0.0":
   version: 7.2.1
   resolution: "nopt@npm:7.2.1"
@@ -16883,6 +16925,18 @@ __metadata:
   languageName: node
   linkType: hard
 
+"readable-stream@npm:~1.0.31":
+  version: 1.0.34
+  resolution: "readable-stream@npm:1.0.34"
+  dependencies:
+    core-util-is: "npm:~1.0.0"
+    inherits: "npm:~2.0.1"
+    isarray: "npm:0.0.1"
+    string_decoder: "npm:~0.10.x"
+  checksum: 10/20537fca5a8ffd4af0f483be1cce0e981ed8cbb1087e0c762e2e92ae77f1005627272cebed8422f28047b465056aa1961fefd24baf532ca6a3616afea6811ae0
+  languageName: node
+  linkType: hard
+
 "readdir-scoped-modules@npm:^1.0.0":
   version: 1.1.0
   resolution: "readdir-scoped-modules@npm:1.1.0"
@@ -17291,9 +17345,11 @@ __metadata:
     "@testing-library/react-native": "npm:^13.2.0"
     "@tsconfig/react-native": "npm:^3.0.0"
     "@types/babel__preset-env": "npm:^7"
+    "@types/copyfiles": "npm:^2"
     "@types/react": "npm:^19.1.0"
     "@types/react-test-renderer": "npm:^19.1.0"
     babel-jest: "npm:^29.6.3"
+    copyfiles: "npm:^2.4.1"
     eslint: "npm:^8.19.0"
     eslint-plugin-ft-flow: "npm:^3.0.11"
     eslint-plugin-prettier: "npm:^4.0.0"
@@ -18409,6 +18465,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"string_decoder@npm:~0.10.x":
+  version: 0.10.31
+  resolution: "string_decoder@npm:0.10.31"
+  checksum: 10/cc43e6b1340d4c7843da0e37d4c87a4084c2342fc99dcf6563c3ec273bb082f0cbd4ebf25d5da19b04fb16400d393885fda830be5128e1c416c73b5a6165f175
+  languageName: node
+  linkType: hard
+
 "string_decoder@npm:~1.1.1":
   version: 1.1.1
   resolution: "string_decoder@npm:1.1.1"
@@ -18825,7 +18888,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"through2@npm:^2.0.0":
+"through2@npm:^2.0.0, through2@npm:^2.0.1":
   version: 
```

---

### Incident Patch 11: `7c16f41f` (2025-11-23)
**Commit Message**: Merge pull request #4004 from theianmay/fix/ratings-images

fix: build process excluding image assets in published package

**File**: `package.json` (modified, +2/-0)
```diff
@@ -51,9 +51,11 @@
     "@testing-library/react-native": "^13.2.0",
     "@tsconfig/react-native": "^3.0.0",
     "@types/babel__preset-env": "^7",
+    "@types/copyfiles": "^2",
     "@types/react": "^19.1.0",
     "@types/react-test-renderer": "^19.1.0",
     "babel-jest": "^29.6.3",
+    "copyfiles": "^2.4.1",
     "eslint": "^8.19.0",
     "eslint-plugin-ft-flow": "^3.0.11",
     "eslint-plugin-prettier": "^4.0.0",
```

**File**: `packages/base/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     "bootstrap"
   ],
   "scripts": {
-    "build": "yarn run -T tsc --composite false",
+    "build": "yarn run -T tsc --composite false && yarn run -T copyfiles -u 1 \"src/**/images/**\" dist",
     "test": "yarn run -T jest  --coverage",
     "test:update": "yarn run -T jest -u  --coverage",
     "test:ci": "yarn run -T jest --runInBand  --coverage",
```

**File**: `yarn.lock` (modified, +75/-5)
```diff
@@ -5243,6 +5243,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@types/copyfiles@npm:^2":
+  version: 2.4.4
+  resolution: "@types/copyfiles@npm:2.4.4"
+  checksum: 10/0513199240828feda5f6ed04c69d6a642c47e6ab66b81214716807f948ed3e865e9b3d2b69f75cbcc6fbe2154630755c47ca473b3913f0a831179366c709a8cc
+  languageName: node
+  linkType: hard
+
 "@types/dedent@npm:^0.7.0":
   version: 0.7.2
   resolution: "@types/dedent@npm:0.7.2"
@@ -8007,6 +8014,24 @@ __metadata:
   languageName: node
   linkType: hard
 
+"copyfiles@npm:^2.4.1":
+  version: 2.4.1
+  resolution: "copyfiles@npm:2.4.1"
+  dependencies:
+    glob: "npm:^7.0.5"
+    minimatch: "npm:^3.0.3"
+    mkdirp: "npm:^1.0.4"
+    noms: "npm:0.0.0"
+    through2: "npm:^2.0.1"
+    untildify: "npm:^4.0.0"
+    yargs: "npm:^16.1.0"
+  bin:
+    copyfiles: copyfiles
+    copyup: copyfiles
+  checksum: 10/17070f88cbeaf62a9355341cb2521bacd48069e1ac8e7f95a3f69c848c53646f16ff0f94807a789e0f3eedc11407ec8d3980a13ab62e2add6ef81d0a5900fd85
+  languageName: node
+  linkType: hard
+
 "core-js-compat@npm:^3.43.0":
   version: 3.46.0
   resolution: "core-js-compat@npm:3.46.0"
@@ -10631,7 +10656,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"glob@npm:^7.0.3, glob@npm:^7.1.1, glob@npm:^7.1.3, glob@npm:^7.1.4, glob@npm:^7.1.6":
+"glob@npm:^7.0.3, glob@npm:^7.0.5, glob@npm:^7.1.1, glob@npm:^7.1.3, glob@npm:^7.1.4, glob@npm:^7.1.6":
   version: 7.2.3
   resolution: "glob@npm:7.2.3"
   dependencies:
@@ -11310,7 +11335,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"inherits@npm:2, inherits@npm:2.0.4, inherits@npm:^2.0.1, inherits@npm:^2.0.3, inherits@npm:^2.0.4, inherits@npm:~2.0.3":
+"inherits@npm:2, inherits@npm:2.0.4, inherits@npm:^2.0.1, inherits@npm:^2.0.3, inherits@npm:^2.0.4, inherits@npm:~2.0.1, inherits@npm:~2.0.3":
   version: 2.0.4
   resolution: "inherits@npm:2.0.4"
   checksum: 10/cd45e923bee15186c07fa4c89db0aace24824c482fb887b528304694b2aa6ff8a898da8657046a5dcf3e46cd6db6c61629551f9215f208d7c3f157cf9b290521
@@ -11904,6 +11929,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"isarray@npm:0.0.1":
+  version: 0.0.1
+  resolution: "isarray@npm:0.0.1"
+  checksum: 10/49191f1425681df4a18c2f0f93db3adb85573bcdd6a4482539d98eac9e705d8961317b01175627e860516a2fc45f8f9302db26e5a380a97a520e272e2a40a8d4
+  languageName: node
+  linkType: hard
+
 "isarray@npm:^2.0.5":
   version: 2.0.5
   resolution: "isarray@npm:2.0.5"
@@ -14174,7 +14206,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"minimatch@npm:^3.0.2, minimatch@npm:^3.0.4, minimatch@npm:^3.0.5, minimatch@npm:^3.1.1, minimatch@npm:^3.1.2":
+"minimatch@npm:^3.0.2, minimatch@npm:^3.0.3, minimatch@npm:^3.0.4, minimatch@npm:^3.0.5, minimatch@npm:^3.1.1, minimatch@npm:^3.1.2":
   version: 3.1.2
   resolution: "minimatch@npm:3.1.2"
   dependencies:
@@ -14567,6 +14599,16 @@ __metadata:
   languageName: node
   linkType: hard
 
+"noms@npm:0.0.0":
+  version: 0.0.0
+  resolution: "noms@npm:0.0.0"
+  dependencies:
+    inherits: "npm:^2.0.1"
+    readable-stream: "npm:~1.0.31"
+  checksum: 10/a05f056dabf764c86472b6b5aad10455f3adcb6971f366cdf36a72b559b29310a940e316bca30802f2804fdd41707941366224f4cba80c4f53071512245bf200
+  languageName: node
+  linkType: hard
+
 "nopt@npm:^7.0.0":
   version: 7.2.1
   resolution: "nopt@npm:7.2.1"
@@ -16883,6 +16925,18 @@ __metadata:
   languageName: node
   linkType: hard
 
+"readable-stream@npm:~1.0.31":
+  version: 1.0.34
+  resolution: "readable-stream@npm:1.0.34"
+  dependencies:
+    core-util-is: "npm:~1.0.0"
+    inherits: "npm:~2.0.1"
+    isarray: "npm:0.0.1"
+    string_decoder: "npm:~0.10.x"
+  checksum: 10/20537fca5a8ffd4af0f483be1cce0e981ed8cbb1087e0c762e2e92ae77f1005627272cebed8422f28047b465056aa1961fefd24baf532ca6a3616afea6811ae0
+  languageName: node
+  linkType: hard
+
 "readdir-scoped-modules@npm:^1.0.0":
   version: 1.1.0
   resolution: "readdir-scoped-modules@npm:1.1.0"
@@ -17291,9 +17345,11 @@ __metadata:
     "@testing-library/react-native": "npm:^13.2.0"
     "@tsconfig/react-native": "npm:^3.0.0"
     "@types/babel__preset-env": "npm:^7"
+    "@types/copyfiles": "npm:^2"
     "@types/react": "npm:^19.1.0"
     "@types/react-test-renderer": "npm:^19.1.0"
     babel-jest: "npm:^29.6.3"
+    copyfiles: "npm:^2.4.1"
     eslint: "npm:^8.19.0"
     eslint-plugin-ft-flow: "npm:^3.0.11"
     eslint-plugin-prettier: "npm:^4.0.0"
@@ -18409,6 +18465,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"string_decoder@npm:~0.10.x":
+  version: 0.10.31
+  resolution: "string_decoder@npm:0.10.31"
+  checksum: 10/cc43e6b1340d4c7843da0e37d4c87a4084c2342fc99dcf6563c3ec273bb082f0cbd4ebf25d5da19b04fb16400d393885fda830be5128e1c416c73b5a6165f175
+  languageName: node
+  linkType: hard
+
 "string_decoder@npm:~1.1.1":
   version: 1.1.1
   resolution: "string_decoder@npm:1.1.1"
@@ -18825,7 +18888,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"through2@npm:^2.0.0":
+"through2@npm:^2.0.0, through2@npm:^2.0.1":
   version: 
```

---

### Incident Patch 12: `fbaae850` (2025-11-23)
**Commit Message**: chore: copy image assets during base package build

**File**: `packages/base/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     "bootstrap"
   ],
   "scripts": {
-    "build": "yarn run -T tsc --composite false",
+    "build": "yarn run -T tsc --composite false && yarn run -T copyfiles -u 1 \"src/**/images/**\" dist",
     "test": "yarn run -T jest  --coverage",
     "test:update": "yarn run -T jest -u  --coverage",
     "test:ci": "yarn run -T jest --runInBand  --coverage",
```

---

### Incident Patch 13: `743d37c5` (2025-10-23)
**Commit Message**: fix: slider track alignment issue fix for new rn versions

**File**: `packages/base/src/Slider/Slider.tsx` (modified, +3/-13)
```diff
@@ -11,20 +11,19 @@ import {
   Animated,
   Easing,
   PanResponder,
-  Platform,
   ViewStyle,
   StyleProp,
   GestureResponderEvent,
   PanResponderGestureState,
   LayoutChangeEvent,
+  Platform,
 } from 'react-native';
 import { RneFunctionComponent } from '../helpers';
 import { Rect } from './components/Rect';
 import { SliderThumb } from './components/SliderThumb';
 
 const TRACK_SIZE = 4;
 const THUMB_SIZE = 40;
-const TRACK_STYLE = Platform.select({ web: 0, default: -1 });
 const DEFAULT_ANIMATION_CONFIGS = {
   spring: {
     friction: 7,
@@ -52,7 +51,7 @@ const getBoundedValue = (
 const handlePanResponderRequestEnd = () => false;
 
 // Should we become active when the user moves a touch over the thumb?
-const handleMoveShouldSetPanResponder = () => !TRACK_STYLE;
+const handleMoveShouldSetPanResponder = () => Platform.OS !== 'web';
 
 type Sizable = {
   width: number;
@@ -502,21 +501,12 @@ export const Slider: RneFunctionComponent<SliderProps> = ({
           thumbStart,
           thumbSize.height / 2
         );
-        minimumTrackStyle.marginLeft = trackSize.width * TRACK_STYLE;
       } else {
         minimumTrackStyle.width = Animated.add(thumbStart, thumbSize.width / 2);
-        minimumTrackStyle.marginTop = trackSize.height * TRACK_STYLE;
       }
       return minimumTrackStyle;
     },
-    [
-      allMeasured,
-      isVertical,
-      thumbSize.height,
-      thumbSize.width,
-      trackSize.height,
-      trackSize.width,
-    ]
+    [allMeasured, isVertical, thumbSize.height, thumbSize.width]
   );
 
   const panResponder = useMemo(
```

**File**: `packages/base/src/Slider/__tests__/__snapshots__/Slider.test.tsx.snap` (modified, +0/-2)
```diff
@@ -41,7 +41,6 @@ exports[`Slider component should handle all onLayout actions 1`] = `
           "backgroundColor": "#3f3f3f",
           "borderRadius": 2,
           "height": 4,
-          "marginTop": -20,
           "position": "absolute",
           "width": 150,
         }
@@ -144,7 +143,6 @@ exports[`Slider component should handle all onLayout actions with vertical orien
           "borderRadius": 2,
           "flex": 1,
           "height": 150,
-          "marginLeft": -20,
           "position": "absolute",
           "width": 4,
         }
```

---

### Incident Patch 14: `a4a6d13e` (2025-11-15)
**Commit Message**: Merge pull request #3978 from karanmonu/fix/button-spacing

fix: replace magic number with spacing token in Button component

**File**: `packages/base/src/Button/Button.tsx` (modified, +1/-1)
```diff
@@ -261,7 +261,7 @@ export const Button: RneFunctionComponent<ButtonProps> = ({
             styles.button,
             {
               padding: theme.spacing[size],
-              paddingHorizontal: theme.spacing[size] + 2,
+              paddingHorizontal: theme.spacing[size] + theme.spacing.xs,
               borderRadius,
               // flex direction based on iconPosition
               // if iconRight is true, default to right
```

---

### Incident Patch 15: `deb5834a` (2025-11-15)
**Commit Message**: Merge branch 'next' into fix/button-spacing

**File**: `.github/workflows/ci-checks.yml` (modified, +5/-0)
```diff
@@ -29,6 +29,11 @@ jobs:
         uses: ./.github/actions/install
       - run: yarn test
 
+      - name: Upload coverage reports to Codecov
+        uses: codecov/codecov-action@v5
+        with:
+          token: ${{ secrets.CODECOV_TOKEN }}
+
   typescript:
     name: 'check_types'
     needs: install
```

**File**: `example/.eslintignore` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-web-build
\ No newline at end of file
```

**File**: `example/.eslintrc` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-{
-  "extends": "@react-native-community",
-  "rules": {
-    "react-native/no-inline-styles": 0,
-    "@typescript-eslint/no-unused-vars": [
-      "error",
-      {
-        "ignoreRestSiblings": true
-      }
-    ]
-  }
-}
```

**File**: `example/.gitignore` (modified, +38/-10)
```diff
@@ -1,15 +1,43 @@
-.idea
-.vscode
-.DS_Store
+# Learn more https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files
+
+# dependencies
+node_modules/
+
+# Expo
+.expo/
+dist/
 web-build/
-web-report/
+expo-env.d.ts
+
+# Native
+.kotlin/
+*.orig.*
+*.jks
+*.p8
+*.p12
+*.key
+*.mobileprovision
+
+# Metro
+.metro-health-check*
 
-node_modules/*
-dist/*
-.expo/*
+# debug
 npm-debug.*
-*.log
+yarn-debug.*
+yarn-error.*
+
+# macOS
+.DS_Store
+*.pem
+
+# local env files
+.env*.local
+
+# typescript
+*.tsbuildinfo
 
-/beta
+app-example
 
-.expo-shared/
+# generated native folders
+/ios
+/android
```

**File**: `example/.prettierignore` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-/node_modules
-/.expo
-/web
-/*.json
```

**File**: `example/.prettierrc` (removed, +0/-6)
```diff
@@ -1,6 +0,0 @@
-{
-  "singleQuote": true,
-  "trailingComma": "es5",
-  "tabWidth": 2,
-  "semi": true
-}
```

**File**: `example/.watchmanconfig` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-{}
```

**File**: `example/README.md` (modified, +10/-9)
```diff
@@ -22,9 +22,10 @@ This app also works on the `web` platform using [React Native Web](https://githu
 
 2. Clone the project
 
-   ```bash
-   git clone https://github.com/react-native-elements/react-native-elements.git
-   ```
+   ````bash
+   git clone https://github.com/react-native-elements/react-native-elements.git   ```
+
+   ````
 
 3. Install dependencies
 
@@ -42,13 +43,13 @@ This app also works on the `web` platform using [React Native Web](https://githu
 
 4. Run the cross-platform app (uses [Expo](https://expo.io/learn))
 
-   ```bash
-   # Using yarn
-   yarn start
+```bash
+ # Using yarn
+ yarn start
 
-   # Using npm
-   npm start
-   ```
+ # Using npm
+ npm start
+```
 
 ### Deploy Web App
 
```

#### Recent Merged Pull Requests:
- **PR #4026** (2026-05-21): Refactor(Button): update ViewComponent type and enhance documentation… (@codewithshinde)
- **PR #4025** (2026-01-27): fix(ci): yarn install type for website deployment (@theianmay)
- **PR #4024** (2026-01-27): fix(ci): resolve website build failures due to lockfile mismatch (@theianmay)
- **PR #4023** (2026-01-27): fix(docs): fix github actions docs workflow dependencies and yarn lockfiles (@louveshh)
- **PR #4021** (2026-01-19): fix(ci): Fix website deployment workflow (@theianmay)
- **PR #4020** (2026-01-19): fix(Actions): update yarn version approach (@theianmay)
- **PR #4019** (2026-01-19): Update docs.yml (@theianmay)
- **PR #4017** (closed): release: v5.0.0 (next to master) (@theianmay)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
