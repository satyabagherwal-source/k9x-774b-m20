# Forensic Learning Record (Deep Inspection): akveo/react-native-ui-kitten

> **Canonical Artifact**: `07_PROJECT_LEARNING/akveo-react-native-ui-kitten-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/akveo/react-native-ui-kitten](https://github.com/akveo/react-native-ui-kitten))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:27.283Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `akveo/react-native-ui-kitten`
- **Description**: React Native UI library built on the Eva Design System: 30+ themeable, accessible components for iOS, Android and web. TypeScript, React 19 / RN 0.81, Eva and Material themes with runtime light/dark switching, on-demand style compilation.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10664 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  overrides: [
    {
      // Plain Node build scripts: no TypeScript project, so no type-aware rules.
      files: ['scripts/**/*.js'],
      parser: 'espree',
      parserOptions: {
        project: null,
        ecmaVersion: 2022,
        sourceType: 'script',
      },
      env: {
        node: true,
        es2022: true,
      },
      extends: ['eslint:recommended'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        // Keep meaningful rules
        '@typescript-eslint/no-shadow': ['error'],
        'no-shadow': 'off',
        'no-undef': 'off',
        'react-native/no-raw-text': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'no-bitwise': 'off',

        // Disable formatting — let prettier handle this separately
        'prettier/prettier': 'off',
        'quotes': 'off',
        'jsx-quotes': 'off',
        'semi': 'off',
        'comma-dangle': 'off',
        'object-curly-spacing': 'off',
        'arrow-parens': 'off',
        'eol-last': 'off',
        'no-trailing-spaces': 'off',
        'indent': 'off',
        'react/self-closing-comp': 'off',
        'react-native/no-inline-styles': 'off',
        'curly': 'off',
      },
      extends: [
        '@react-native-community',
      ],
    },
  ],
  parserOptions: {
    project: ['./tsconfig.json'],
    sourceType: 'module',
  },
  settings: {
    react: {
      version: '19.0.0',
    },
  },
  ignorePatterns: [
    // Deliberately-broken v5 sources the codemod transforms; they must not typecheck or lint.
    'src/codemod/__testfixtures__',
    'src/codemod/__e2e__',
    'lib',
    'dist',
    'docs/',
    '**/*.d.ts',
    'babel.config.js',
    'jest.config.js',
    'src/processor/',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
};

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: [
    'module:@react-native/babel-preset',
  ],
};

```

### Core Architecture Module: `jest.config.js`
```
module.exports = {
  preset: 'react-native',
  cacheDirectory: '<rootDir>/dist/jest/cache',
  coverageDirectory: '<rootDir>/dist/jest/coverage',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-svg|@eva-design|@ui-kitten)/)',
  ],
  moduleNameMapper: {
    '^@ui-kitten/components/(.*)$': '<rootDir>/src/components/$1',
    '^@ui-kitten/components$': '<rootDir>/src/components',
    '^@ui-kitten/eva-icons/(.*)$': '<rootDir>/src/eva-icons/$1',
    '^@ui-kitten/eva-icons$': '<rootDir>/src/eva-icons',
    '^@ui-kitten/metro-config/(.*)$': '<rootDir>/src/metro-config/$1',
    '^@ui-kitten/metro-config$': '<rootDir>/src/metro-config',
    '^@ui-kitten/processor/(.*)$': '<rootDir>/src/processor/$1',
    '^@ui-kitten/processor$': '<rootDir>/src/processor',
    '^@ui-kitten/eva/(.*)$': '<rootDir>/src/eva/$1',
    '^@ui-kitten/eva$': '<rootDir>/src/eva',
    '^@ui-kitten/material/(.*)$': '<rootDir>/src/material/$1',
    '^@ui-kitten/material$': '<rootDir>/src/material',
    '^@ui-kitten/date-fns/(.*)$': '<rootDir>/src/date-fns/$1',
    '^@ui-kitten/date-fns$': '<rootDir>/src/date-fns',
    '^@ui-kitten/moment/(.*)$': '<rootDir>/src/moment/$1',
    '^@ui-kitten/moment$': '<rootDir>/src/moment',
    '^@ui-kitten/core/(.*)$': '<rootDir>/src/core/$1',
    '^@ui-kitten/core$': '<rootDir>/src/core',
    '^@ui-kitten/mapping-base/(.*)$': '<rootDir>/src/mapping-base/$1',
    '^@ui-kitten/mapping-base$': '<rootDir>/src/mapping-base',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/src/showcases/',
    '<rootDir>/src/codemod/__testfixtures__/',
    '<rootDir>/src/codemod/__e2e__/',
    '/lib/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules',
    '<rootDir>/dist',
    '<rootDir>/docs',
    '<rootDir>/src/codemod/__testfixtures__/',
    '<rootDir>/src/codemod/__e2e__/',
    '/lib/',
  ],
};

```

### Core Architecture Module: `jest.setup.js`
```
// Suppress specific warnings during tests
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((msg) => {
    // Suppress useNativeDriver and removeListeners warnings
    if (
      typeof msg === 'string' &&
      (msg.includes('useNativeDriver') || msg.includes('removeListeners'))
    ) {
      return;
    }
  });

  jest.spyOn(console, 'error').mockImplementation((msg) => {
    // Suppress act() warnings in some cases
    if (typeof msg === 'string' && msg.includes('act(...)')) {
      return;
    }
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

```

### Core Architecture Module: `scripts/esm-declaration-extensions.js`
```
#!/usr/bin/env node
/**
 * Adds explicit `.js` extensions to relative module specifiers in generated `.d.ts` files.
 *
 * react-native-builder-bob marks the ESM declaration output (`lib/typescript/module`) with
 * `{"type":"module"}`, which puts every `.d.ts` in ECMAScript module scope. In that scope,
 * TypeScript's `node16`/`nodenext` resolution rejects extensionless relative imports
 * (TS2834), and `tsc` never rewrites specifiers when emitting declarations. Bob's Babel pass
 * already adds the extensions to the compiled JavaScript; this does the same for the types.
 *
 * Usage: node esm-declaration-extensions.js [directory ...]
 * Defaults to `lib/typescript/module` relative to the current working directory.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DIRECTORY = path.join('lib', 'typescript', 'module');
const DECLARATION_SUFFIX = '.d.ts';
const KNOWN_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json'];

/*
 * Matches the specifier of:
 *   import ... from './x'   export ... from './x'   import './x'   import('./x')
 * with either quote style, as long as the specifier is relative.
 */
const SPECIFIER_PATTERN = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\n]*)\2/g;

const listDeclarationFiles = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listDeclarationFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(DECLARATION_SUFFIX) ? [entryPath] : [];
  });
};

const resolveSpecifier = (fileDirectory, specifier) => {
  if (KNOWN_EXTENSIONS.some((extension) => specifier.endsWith(extension))) {
    return specifier;
  }

  const target = path.resolve(fileDirectory, specifier);

  if (fs.existsSync(`${target}${DECLARATION_SUFFIX}`)) {
    return `${specifier}.js`;
  }

  if (fs.existsSync(path.join(target, `index${DECLARATION_SUFFIX}`))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }

  return null;
};

const rewriteDeclarationFile = (filePath) => {
  const fileDirectory = path.dirname(filePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const unresolved = [];

  const output = source.replace(SPECIFIER_PATTERN, (match, prefix, quote, specifier) => {
    const resolved = resolveSpecifier(fileDirectory, specifier);

    if (resolved === null) {
      unresolved.push(specifier);
      return match;
    }

    return `${prefix}${quote}${resolved}${quote}`;
  });

  if (output !== source) {
    fs.writeFileSync(filePath, output);
  }

  return unresolved;
};

const run = (directories) => {
  let rewritten = 0;
  const failures = [];

  directories.forEach((directory) => {
    if (!fs.existsSync(directory)) {
      failures.push(`${directory}: directory does not exist`);
      return;
    }

    listDeclarationFiles(directory).forEach((filePath) => {
      const unresolved = rewriteDeclarationFile(filePath);
      rewritten += 1;
      unresolved.forEach((specifier) => failures.push(`${filePath}: cannot resolve '${specifier}'`));
    });
  });

  if (failures.length > 0) {
    console.error(`esm-declaration-extensions: ${failures.length} problem(s)\n${failures.join('\n')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`esm-declaration-extensions: processed ${rewritten} declaration file(s) in ${directories.join(', ')}`);
};

run(process.argv.length > 2 ? process.argv.slice(2) : [DEFAULT_DIRECTORY]);

```

### Core Architecture Module: `scripts/generate-eva-icons.js`
```
#!/usr/bin/env node
/**
 * Generates `src/eva-icons/icons/*.ts` from the SVG files published in the `eva-icons` npm
 * package (https://github.com/akveo/eva-icons, MIT, Copyright (c) 2018 Akveo).
 *
 * Every icon becomes one module exporting plain data: the SVG child elements as
 * `[tag, attributes]` tuples plus the root `viewBox` when it is not the default `0 0 24 24`.
 * A single React component in `@ui-kitten/eva-icons` renders that data with react-native-svg,
 * so icon modules stay inert and consumers can import only the icons they use.
 *
 * Eva's SVGs are Illustrator exports normalised by svgo: two nested `<g>` wrappers, one
 * invisible `opacity="0"` rectangle or polyline that keeps the 24x24 bounding box for the sprite
 * pipeline, then the real shapes. The wrappers and the bounding-box shims are dropped here;
 * `viewBox` on the root already fixes the coordinate system.
 *
 * The output is committed. CI reruns this script and fails when the tree changes, so the files
 * always match the pinned `eva-icons` version. Run `yarn eva-icons:generate` after upgrading it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { parseSync } = require('svgson');

const EVA_ROOT = path.dirname(require.resolve('eva-icons/package.json'));
const EVA_VERSION = require('eva-icons/package.json').version;
const OUTPUT_DIRECTORY = path.resolve(__dirname, '..', 'src', 'eva-icons', 'icons');
const DEFAULT_VIEW_BOX = '0 0 24 24';

/*
 * The elements Eva icons are drawn with, and the attributes each may carry. Anything else in an
 * SVG aborts the run: a new upstream element or attribute must be reviewed (and the renderer in
 * `evaIcon.component.tsx` taught about it) rather than silently dropped.
 */
const SHAPES = {
  path: { required: ['d'], optional: [] },
  rect: { required: ['width', 'height'], optional: ['x', 'y', 'rx', 'ry', 'transform'] },
  circle: { required: ['cx', 'cy', 'r'], optional: [] },
  polygon: { required: ['points'], optional: [] },
  polyline: { required: ['points'], optional: [] },
};
const NUMERIC_ATTRIBUTES = new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r']);
const CONTAINER_ELEMENTS = new Set(['g']);
const IGNORED_ELEMENTS = new Set(['defs', 'style', 'title']);
const IGNORED_ATTRIBUTES = /^(id|class|data-.*|xmlns(:.*)?)$/;

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'implements', 'interface',
  'package', 'private', 'protected', 'public', 'await', 'arguments', 'eval',
]);

const HEADER = [
  '/**',
  ' * @license',
  ` * Generated from Eva Icons ${EVA_VERSION} (https://github.com/akveo/eva-icons).`,
  ' * Eva Icons is MIT licensed, Copyright (c) 2018 Akveo. See LICENSE in this package.',
  ' *',
  ' * Do not edit: run `yarn eva-icons:generate`.',
  ' */',
].join('\n');

const camelCase = (kebab) => kebab.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());

const listSvgFiles = (directory) => {
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => ({ name: file.slice(0, -'.svg'.length), file: path.join(directory, file) }));
};

const toAttributeValue = (name, value) => {
  if (!NUMERIC_ATTRIBUTES.has(name)) {
    return value;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || String(number) !== value.replace(/^(-?)\./, '$10.')) {
    throw new Error(`attribute ${name}="${value}" is not a plain number`);
  }
  return number;
};

const convertShape = (element) => {
  const shape = SHAPES[element.name];
  const attributes = {};

  for (const [name, value] of Object.entries(element.attributes)) {
    if (IGNORED_ATTRIBUTES.test(name)) {
      continue;
    }
    if (!shape.required.includes(name) && !shape.optional.includes(name)) {
      throw new Error(`<${element.name}> carries unsupported attribute ${name}="${value}"`);
    }
    attributes[name] = toAttributeValue(name, value);
  }

  for (const name of shape.required) {
    if (!(name in attributes)) {
      throw new Error(`<${element.name}> is missing required attribute ${name}`);
    }
  }

  if (element.children.length > 0) {
    throw new Error(`<${element.name}> has children`);
  }

  return [element.name, attributes];
};

const collectNodes = (element, nodes) => {
  for (const child of element.children) {
    if (child.type !== 'element') {
      continue;
    }
    if (IGNORED_ELEMENTS.has(child.name)) {
      continue;
    }
    if (CONTAINER_ELEMENTS.has(child.name)) {
      const attributeNames = Object.keys(child.attributes).filter((name) => !IGNORED_ATTRIBUTES.test(name));
      if (attributeNames.length > 0) {
        throw new Error(`<g> carries attributes that would be lost: ${attributeNames.join(', ')}`);
      }
      collectNodes(child, nodes);
      continue;
    }
    if (!(child.name in SHAPES)) {
      throw new Error(`unsupported element <${child.name}>`);
    }
    if (child.attributes.opacity === '0') {
      // Invisible bounding-box shim from the upstream sprite pipeline.
      continue;
    }
    nodes.push(convertShape(child));
  }
  return nodes;
};

const parseIcon = ({ name, file }) => {
  const root = parseSync(fs.readFileSync(file, 'utf8'));
  if (root.name !== 'svg') {
    throw new Error('root element is not <svg>');
  }

  const viewBox = root.attributes.viewBox;
  if (!/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/.test(viewBox || '')) {
    throw new Error(`unexpected viewBox "${viewBox}"`);
  }

  const nodes = collectNodes(root, []);
  if (nodes.length === 0) {
    throw new Error('icon has no visible shapes');
  }

  /*
   * `cloud-download.svg` ships its whole drawing twice. Repeating an opaque shape on top of
   * itself changes nothing, so exact duplicates are dropped rather than rendered twice.
   */
  const seen = new Set();
  const uniqueNodes = nodes.filter((node) => {
    const key = JSON.stringify(node);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const identifier = camelCase(name);
  if (!/^[a-z][A-Za-z0-9]*$/.test(identifier) || RESERVED_WORDS.has(identifier)) {
    throw new Error(`"${name}" does not map to a usable identifier (${identifier})`);
  }

  return {
    name,
    identifier,
    viewBox: viewBox === DEFAULT_VIEW_BOX ? undefined : viewBox,
    nodes: uniqueNodes,
    deduplicated: nodes.length - uniqueNodes.length,
  };
};

const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const renderAttributes = (attributes) => {
  const entries = Object.entries(attributes).map(([name, value]) => {
    return `${name}: ${typeof value === 'number' ? value : quote(value)}`;
  });
  return `{ ${entries.join(', ')} }`;
};

const renderIconModule = ({ name, identifier, viewBox, nodes }) => {
  const lines = [
    HEADER,
    '',
    "import type { IconData } from '../iconData';",
    '',
    `const ${identifier}: IconData = {`,
    `  name: ${quote(name)},`,
  ];
  if (viewBox) {
    lines.push(`  viewBox: ${quote(viewBox)},`);
  }
  lines.push('  node: [');
  for (const [tag, attributes] of nodes) {
    lines.push(`    [${quote(tag)}, ${renderAttributes(attributes)}],`);
  }
  lines.push('  ],', '};', '', `export default ${identifier};`, '');
  return lines.join('\n');
};

const renderBarrel = (icons) => {
  const lines = [HEADER, ''];
  for (const { name, identifier } of icons) {
    lines.push(`export { default as ${identifier} } from './${name}';`);
  }
  lines.push('');
  return lines.join('\n');
};

const renderAll = (icons) => {
  const lines = [HEADER, '', "import type { IconData } from '../iconData';"];
  for (const { name, identifier } of icons) {
    lines.push(`import ${identifier} from './${na
```

### Core Architecture Module: `src/codemod/__e2e__/v5-app/App.tsx`
```
/**
 * The `@ui-kitten/template-ts` App.tsx as shipped in v5.3.1, extended with the ref patterns from the
 * v5 showcases plus one case from each group the codemod refuses to rewrite.
 *
 * Every line here is a pattern a real v5 app contains. The point of the file is that
 * `tsc --strict` fails on it against v6 *before* the codemod and passes *after* — see
 * `src/codemod/__e2e__/run.sh`.
 *
 * @format
 */

import React from 'react';
import {
  ImageProps,
  StyleSheet,
} from 'react-native';
import {
  ApplicationProvider,
  Button,
  Calendar,
  Icon,
  IconRegistry,
  Input,
  Layout,
  MenuGroup,
  Select,
  Text,
  ViewPager,
} from '@ui-kitten/components';
import { EvaIconsPack } from '@ui-kitten/eva-icons';
import * as eva from '@eva-design/eva';
import { ThemeStyleType } from '@eva-design/dss';

/**
 * Use any valid `name` property from eva icons (e.g `github`, or `heart-outline`)
 * https://akveo.github.io/eva-icons
 */
const HeartIcon = (props?: Partial<ImageProps>): React.ReactElement<ImageProps> => (
  <Icon
    {...props}
    name='heart'
  />
);

export default (): React.ReactElement => {
  // Group A: v6 exports a matching ref type.
  const inputRef = React.useRef<Input>(null);
  const selectRef: React.RefObject<Select> = React.createRef();

  // Group A′: the v5 type argument has to be dropped — `IconRef` is not generic.
  const iconRef = React.useRef<Icon<Partial<ImageProps>>>();

  // Group B: the v6 ref type is generic too, so the argument is carried across.
  const calendarRef = React.useRef<Calendar>(null);

  // Group C: `ViewPagerRef` is real but v6 does not export it.
  const pagerRef = React.useRef<ViewPager>(null);

  // Group E: still a class in v6. This must survive untouched.
  const menuGroupRef = React.useRef<MenuGroup>(null);

  const styleType: ThemeStyleType = {} as ThemeStyleType;

  return (
    <>
      <IconRegistry icons={EvaIconsPack} />
      <ApplicationProvider
        {...eva}
        theme={eva.light}
      >
        <Layout style={styles.container}>
          <Text
            style={styles.text}
            category='h1'
          >
            Welcome to UI Kitten 😻
          </Text>
          <Input ref={inputRef} />
          <Select ref={selectRef} />
          <Icon
            ref={iconRef}
            name='star'
          />
          <Calendar ref={calendarRef} />
          <ViewPager ref={pagerRef} />
          <MenuGroup
            ref={menuGroupRef}
            title='Group'
          />
          <Button
            style={styles.likeButton}
            accessoryLeft={HeartIcon}
          >
            LIKE
          </Button>
          <Text>{Object.keys(styleType).length}</Text>
        </Layout>
      </ApplicationProvider>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
  likeButton: {
    marginVertical: 16,
  },
});

```

### Core Architecture Module: `src/codemod/__e2e__/v5-app/ManualCases.tsx`
```
/**
 * The cases the codemod deliberately does not rewrite.
 *
 * Unlike `App.tsx`, this file is *expected* to still fail `tsc` after the codemod runs — that is
 * the point. What the end-to-end check asserts here is that every one of these produced a report
 * entry telling the user exactly what to do, rather than being silently left behind.
 */

import React from 'react';
import { Button, MenuGroup, Modal, Tooltip } from '@ui-kitten/components';
import merge from 'lodash.merge';

// Group D: `Tooltip` and `Modal` are plain function components in v6 and accept no ref.
export const tooltipRef = React.useRef<Tooltip>(null);
export const modalRef = React.useRef<Modal>(null);

// No type argument and no initial value: `useRef(null)` would infer `RefObject<null>`, which no
// `ref` prop accepts, so the type has to come from a human.
export const untyped = React.useRef();

// `lodash.merge` came in transitively through v5's `@ui-kitten/components`. v6 dropped it.
export const combined = merge({}, { a: 1 }, { b: 2 });

// A UI Kitten name in a type position that is not a ref: in v5 this was the class's instance type.
export declare const group: MenuGroup;

export const Screen = (): React.ReactElement => (
  <>
    <Tooltip
      anchor={() => <Button>Anchor</Button>}
      visible={false}
      ref={tooltipRef}
    >
      Hint
    </Tooltip>
    <Modal
      visible={false}
      ref={modalRef}
    />
  </>
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1909** (2026-09-27): **docs(branding): explain Android font weight fallback**
  *Symptoms*: ## Summary  - Adds a "Font weights on Android" section to the typography guide. - Explains why a custom font shows on paragraphs but not on headings, labels or button text on Android: React Native asks the family for a bold face for weights of 700 and up, `expo-font` registers only a regular face, and asset fonts provide a bold face only from a `<family>_bold.ttf` file. - Documents the two setups that resolve every weight: the `expo-font` config plugin with `fontDefinitions`, or suffixed asset files / `addCustomFont` in bare React Native.  Closes the investigation of #1793: the mapping side works (a `strict` `text-font-family` override reaches `Text` in every category, `Button`, and `Input` labels and captions, verified with a spec on 6.1.3); the Android fallback is in font registration.

- **Issue #1908** (2026-09-27): **fix(autocomplete): float the options without a backdrop**
  *Symptoms*: Closes #1578, closes #1755.  ## Problem  `Autocomplete` opened its options in a `Popover`, which is a native modal with a backdrop. Two consequences, reproduced on 6.1.2 with a new `AutocompleteBlur` showcase (an `Autocomplete` beside a `Button`, counting `onBlur` calls and button presses):  - the first tap on the button only hit the backdrop and closed the list; the second tap pressed the button (#1578); - the field in the modal was a second, mirrored `Input`; on iOS it never held focus, so tapping outside gave `blurs: 0` (#1755). On Android the mirror did blur, so the count went up there.  ## Design  Two options were on the table: keep the modal and blur on backdrop press (closes #1755 only, the first tap still dies on the backdrop), or render the options without a modal. The honest fix is the second one, but rendering the list in place has known Android problems (touches outside the parent's bounds are dropped, later siblings draw over it), so the list still goes through the `ApplicationProvider` panel, just not as a native modal: a plain absolutely positioned view with `pointerEvents='box-none'` and no backdrop, so touches outside the content fall through to the app.  ## Changes  - `Modal`: new `blocking` prop (default `true`). With `false` and a panel, the content is a plain view laid over the window (its own window offset measured through `MeasureElement` so the coordinates match the anchors), no `RNModal`, no backdrop, no `aria-modal`. Inline rendering keeps blocking. 

- **Issue #1907** (2026-09-27): **feat(popover): add anchorContainerStyle**
  *Symptoms*: Closes #1791.  ## Problem  `Popover` renders `anchor()` inside a plain `View` that it measures for placement. That wrapper has no style, so a `flex` on the anchor element only sizes the anchor inside the wrapper, and the wrapper itself stays content-sized in its parent row. Two popovers whose anchors should share a row through `flex` cannot.  ## Fix  New `anchorContainerStyle` prop on `Popover`, applied to the anchor wrapper (both before and after the popover has ever been shown). `Tooltip` and `OverflowMenu` spread their remaining props into `Popover`, so they accept it too. `Select`, `Autocomplete` and `Datepicker` already style their own outer view, so they are unaffected.  ## Verification  - Spec: the wrapper carrying `anchorContainerStyle` contains the anchor and has the style applied. - New showcase section `PopoverAnchorFlex` (last in the list): two popovers in a row with `anchorContainerStyle` `flex: 1` / `flex: 2`. On master both anchors stay content-sized; on this branch they split the row 1:2 on the iPhone 17 simulator and the Pixel 7 emulator, and the opened popover is centred under the flexed anchor on both. - Docs: props row in `popover.mdx`; Storybook story `Anchors sharing a row`. - `yarn turbo run build --filter=@ui-kitten/components`, `yarn typecheck:all`, `yarn lint`, `yarn test --runInBand` (1874 tests) pass.  Changeset: `@ui-kitten/components` patch.

- **Issue #1906** (2026-09-27): **fix(view-pager): hide off-screen pages from screen readers**
  *Symptoms*: Closes #1658.  ## Problem  `ViewPager` keeps every page mounted and moves the non-selected ones off screen with a translate. Nothing hides them from assistive technology, so VoiceOver / TalkBack read the content of pages the user cannot see. `TabView` is built on `ViewPager`, so it has the same problem.  ## Fix  The page wrapper `View` gets `aria-hidden={index !== selectedIndex}`. React Native maps it to `accessibilityElementsHidden` on iOS, `importantForAccessibility='no-hide-descendants'` on Android and `aria-hidden` on web. This is the workaround from the issue, applied inside the component.  ## Verification  - Spec: with `selectedIndex={1}` and three pages the wrappers carry `aria-hidden` `[true, false, true]`; the hidden page is still mounted (`includeHiddenElements: true`) but not returned by the default query. Two existing assertions in the `ViewPager` / `TabView` specs now query the non-selected page with `includeHiddenElements: true`, since Testing Library hides it the same way a screen reader does. - iOS iPhone 17 simulator, `ViewPager` showcase section: the accessibility tree listed the `ORDERS` and `TRANSACTIONS` page texts on master; with this branch only `USERS` (the selected page) remains. - Android Pixel 7 emulator: the page wrapper now appears as its own native view in the accessibility dump (React Native only creates one when the view carries accessibility props). Neither uiautomator (drops off-screen nodes) nor the automation helper (includes not-important 

- **Issue #1905** (2026-09-27): **fix(datepicker): keep the calendar inside narrow windows**
  *Symptoms*: Closes #1784.  ## Problem  `Calendar` has a fixed `width: 344` in both the Eva and Material mappings. On a 320 dp screen the `Datepicker` popover inherits that width, the popover bounds fix from #1893 clamps it to `x = 0`, and the Saturday column is clipped at the right edge. A standalone `Calendar` / `RangeCalendar` on the same screen overflows its parent the same way.  ## Fix  - `Calendar` / `RangeCalendar` container: `maxWidth: '100%'` next to the mapping `width`, so a narrow parent shrinks the calendar and the `flex: 1` day cells absorb the difference. - `Datepicker` / `RangeDatepicker` popover: `maxWidth` of the window width minus an 8 dp inset on each side, so the calendar inside shrinks with it.  Wide screens are unchanged: the popover and the standalone calendar stay at 344 dp.  ## Verification  - Specs: calendar container style carries `maxWidth: '100%'`; the Datepicker popover is capped at `320 - 16` when `Dimensions.get('window')` reports a 320 dp window. Both fail on master. - Android Pixel 7 emulator forced to 320 x 568 dp (`wm size 640x1136; wm density 320`): master clips the Saturday column, this branch shows all seven columns with 8 dp on each side. Reset geometry: Datepicker popover and standalone calendar still 344 dp. - iOS iPhone 17 simulator (402 pt): Datepicker popover and standalone calendar unchanged at 344 pt. - `yarn typecheck:all`, `yarn lint`, `yarn test --runInBand` (1875 tests) pass.  Changeset: `@ui-kitten/components` patch.

- **Issue #1904** (2026-09-27): **test(web): add lazy TabView story and check**
  *Symptoms*: Records the 6.x behaviour behind #1234 (TabView with `shouldLoadComponent` bounced between tabs on 5.x). New Storybook story *TabView lazy pages* echoes the selected index and every `onSelect` call; `website/qa/tabview.mjs` taps Four, One, Three and expects `selected: 2, calls: 3,0,2`, which is what headless Chrome reports on 6.1.2. No library change, no changeset.

- **Issue #1903** (2026-09-27): **fix(toggle): keep the press highlight rounded on Android**
  *Symptoms*: ## Summary  Closes #1895  While a `Toggle` is pressed (or focused) its outline highlight drew as a square-cornered rectangle on Android. The same outline is used by `CheckBox` and `Radio`.  The styles are correct: the highlight view receives `borderRadius: 21` in every state. The cause is an open Fabric bug, facebook/react-native#52415 (React Native 0.80 and newer): a view whose `backgroundColor` changes from `transparent` to a colour after it is mounted loses its border radius. Eva maps `outlineBackgroundColor` to `transparent` by default and to `outline-color` in the active and focused states, which is exactly that transition.  Probing on device showed that clipping the view (`overflow: 'hidden'`), a border of any width, or a not-quite-transparent initial colour all keep the radius. The highlight has no children, so it now clips to its own shape.  ## Verification  - Reproduced on a fresh Expo 57 app (RN 0.86.3) on a Pixel 7 API 34 emulator; with the change the pressed highlight is rounded again. - New spec in `toggle.spec.tsx`, `checkbox.spec.tsx` and `radio.spec.tsx` asserts the highlight keeps `borderRadius` and `overflow: 'hidden'`. - `yarn lint`, `yarn typecheck`, `yarn typecheck:all`, `yarn test` (1876 tests) pass. `yarn e2e:ios` was not run. 

- **Issue #1902** (2026-09-27): **fix(measure): stop double status bar offset on RN 0.86**
  *Symptoms*: ## Summary  Closes #1894  On Expo 57 / React Native 0.86 the `Select` options (and every other popover-based component: `Popover`, `Tooltip`, `Autocomplete`, `Datepicker`, `OverflowMenu`) opened one status bar below their anchor on Android.  React Native 0.81 through 0.85 subtract the visible display frame in `RootViewUtil.getViewportOffset`, so `measureInWindow` reports positions below the status bar while `Modal` windows start at the top of the screen. `MeasureElement` compensates by adding `StatusBar.currentHeight` when the app runs edge-to-edge. React Native 0.86 stopped subtracting anything when edge-to-edge is on, so the two coordinate spaces already match and the compensation pushed the frame down by one bar.  The offset is now applied only when `Platform.constants.reactNativeVersion` is below 0.86 (or unknown). The `shouldUseTopInsets` path for translucent status bars is unchanged.  ## Verification  - Reproduced with a fresh Expo 57 app (RN 0.86.3, `@ui-kitten/components` 6.1.1) on a Pixel 7 API 34 emulator: gap between the `Select` and its options was 137 px, the status bar height. With this change the options start 1 px below the control. - `measure.spec.tsx` covers 0.81, unknown version, 0.86 with edge-to-edge and 0.86 with `shouldUseTopInsets`. - `yarn lint`, `yarn typecheck`, `yarn typecheck:all`, `yarn test` pass. `yarn e2e:ios` was not run; the change is Android-only. 

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

### Incident Patch 1: `c7c9d257` (2026-09-27)
**Commit Message**: fix(autocomplete): float the options without a backdrop

The options list was a modal with a backdrop, so the first tap on a
control beside the field only closed the list, and the field was mirrored
by a second input inside the modal whose blur never reached the consumer
on iOS. Modal and Popover gain a `blocking` prop; with `blocking={false}`
the content is a plain view in the ApplicationProvider panel with no
native modal and no backdrop, so touches outside it reach the app.
Autocomplete uses it with a single real input: the list opens on focus,
closes on blur, selection, submit and keyboard dismissal, and `onBlur` is
the input's own event. Default placement is now `bottom`.
Closes #1578, closes #1755.

**File**: `.changeset/autocomplete-non-blocking-list.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Autocomplete` no longer opens its suggestions in a modal. The list floats above the app through the `ApplicationProvider` panel without a backdrop, so the first tap on a button beside the field reaches that button instead of only closing the list, and the field is a single real `TextInput`: `onFocus` / `onBlur` are its own focus events and `onBlur` fires when it loses focus. The list closes on blur, on selection, on submit and when the keyboard is dismissed. The default `placement` is now `bottom` (the `inner` placements cover the field). `Modal` and `Popover` gain a `blocking` prop (default `true`) that exposes the same non-blocking presentation.
```

**File**: `src/components/ui/autocomplete/autocomplete.component.tsx` (modified, +42/-52)
```diff
@@ -7,6 +7,7 @@
 
 import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, memo } from 'react';
 import {
+  Keyboard,
   ListRenderItemInfo,
   NativeSyntheticEvent,
   StyleSheet,
@@ -61,11 +62,13 @@ export interface AutocompleteRef {
  *
  * @property {(number) => void} onSelect - Called when option is pressed.
  *
- * @note Setting `keyboardShouldPersistTaps='handled'` on an enclosing `ScrollView`, `FlatList` or
- * `SectionList` is no longer required as of 6.0.0-beta.3; it is still harmless. The options popup
- * is presented through the `ApplicationProvider` panel, so it is no longer a React descendant of
- * the enclosing list and the first tap on an option selects it instead of only dismissing the
- * keyboard.
+ * @note The options list floats above the app through the `ApplicationProvider` panel without a
+ * backdrop: the first tap on an option selects it, and the first tap on a control next to the
+ * field reaches that control. The list closes when the input blurs, when an option is selected,
+ * on submit and when the keyboard is dismissed. With the React Native default
+ * `keyboardShouldPersistTaps='never'` on an enclosing `ScrollView`, a tap outside the focused
+ * input first dismisses the keyboard, which blurs the input and closes the list; set
+ * `keyboardShouldPersistTaps='handled'` on that list to let such a tap reach its target at once.
  *
  * @property {string} status - Status of the component.
  * Can be `basic`, `primary`, `success`, `info`, `warning`, `danger` or `control`.
@@ -91,12 +94,13 @@ export interface AutocompleteRef {
  *
  * @property {string | PopoverPlacement} placement - Position of the options list relative to the input field.
  * Can be `left`, `top`, `right`, `bottom`, `left start`, `left end`, `top start`, `top end`, `right start`,
- * `right end`, `bottom start` or `bottom end`.
+ * `right end`, `bottom start` or `bottom end`. The `inner` placements cover the field.
  * Defaults to *bottom*.
  *
- * @property {() => void} onFocus - Called when options list becomes visible.
+ * @property {(event) => void} onFocus - Called when the input field gains focus; the options list opens
+ * when there are options to show.
  *
- * @property {() => void} onBlur - Called when options list becomes invisible.
+ * @property {(event) => void} onBlur - Called when the input field loses focus; the options list closes.
  *
  * @property {InputProps} ...InputProps - Any props applied to Input component.
  *
@@ -118,15 +122,15 @@ export interface AutocompleteRef {
 const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
   children,
   onSelect,
-  placement = 'inner top',
+  placement = 'bottom',
   testID,
   onFocus: onFocusProp,
+  onBlur: onBlurProp,
   onSubmitEditing: onSubmitEditingProp,
   ...inputProps
 }, ref) => {
   const [listVisible, setListVisible] = useState(false);
   const inputRef = useRef<InputRef>(null);
-  const inputRefAnchor = useRef<InputRef>(null);
   const prevChildCountRef = useRef(React.Children.count(children));
 
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
@@ -161,6 +165,19 @@ const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
     prevChildCountRef.current = currentChildCount;
   }, [data.length, listVisible]);
 
+  // The list floats above the app without a backdrop (#1578), so nothing outside the component
+  // reports an outside tap. Closing the keyboard is the one signal the platform gives for
+  // "done with this field" that does not come through the input itself.
+  useEffect(() => {
+    if (!listVisible) {
+      return;
+    }
+    const subscription = Keyboard.addListener('keyboardDidHide', () => {
+      setListVisible(false);
+    });
+    return () => subscription.remove();
+  }, [listVisible]);
+
   const setOptionsListVisible = useCallback(() => {
     const hasData = data.length > 0;
     if (hasData) {
@@ -177,24 +194,16 @@ const Aut
```

**File**: `src/components/ui/autocomplete/autocomplete.spec.tsx` (modified, +43/-11)
```diff
@@ -9,11 +9,13 @@ import React from 'react';
 import {
   Image,
   ImageProps,
+  Keyboard,
   Text,
   TextInput,
   TouchableOpacity,
 } from 'react-native';
 import {
+  act,
   fireEvent,
   render,
   waitFor,
@@ -300,29 +302,59 @@ describe('@autocomplete: component checks', () => {
     expect(onSelect).toBeCalledWith(1);
   });
 
-  it('should hide options when backdrop is pressed', async () => {
+  it('should not block the screen while options are visible', async () => {
     const component = render(
       <TestAutocomplete />,
     );
 
     fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
     await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
 
-    const backdrop = await waitFor(() => {
-      const el = component.queryByTestId('@backdrop');
-      expect(el).toBeTruthy();
-      return el;
-    });
-    // Backdrop uses PanResponder - call the handler directly
-    const responderRelease = backdrop.props.onResponderRelease;
-    if (responderRelease) {
-      responderRelease({ nativeEvent: {} });
-    }
+    // No backdrop: the first tap on anything beside the field reaches it (#1578).
+    expect(component.queryByTestId('@backdrop')).toBeFalsy();
+    expect(component.queryByTestId('@modal/overlay')).toBeTruthy();
+  });
+
+  it('should hide options when the input blurs', async () => {
+    const onBlur = jest.fn();
+    const component = render(
+      <TestAutocomplete onBlur={onBlur} />,
+    );
+
+    fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
+    await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
+
+    fireEvent(component.UNSAFE_queryByType(TextInput), 'blur');
 
     await waitFor(() => {
       expect(component.queryByText('Option 1')).toBeFalsy();
       expect(component.queryByText('Option 2')).toBeFalsy();
     });
+    // The field's own blur reaches the consumer (#1755).
+    expect(onBlur).toBeCalledTimes(1);
+  });
+
+  it('should hide options when the keyboard is dismissed', async () => {
+    const listeners: Record<string, () => void> = {};
+    const addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
+      listeners[event] = handler as () => void;
+      return { remove: jest.fn() } as never;
+    });
+
+    const component = render(
+      <TestAutocomplete />,
+    );
+
+    fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
+    await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
+    expect(listeners.keyboardDidHide).toBeTruthy();
+
+    act(() => {
+      listeners.keyboardDidHide();
+    });
+
+    await waitFor(() => expect(component.queryByText('Option 1')).toBeFalsy());
+    addListener.mockRestore();
   });
 
   it('should call onFocus', async () => {
```

**File**: `src/components/ui/modal/modal.component.tsx` (modified, +78/-4)
```diff
@@ -23,6 +23,7 @@ import {
   ViewStyle,
   Modal as RNModal,
   ModalProps as ReactNativeModalProps,
+  useWindowDimensions,
 } from 'react-native';
 import {
   Frame,
@@ -55,6 +56,13 @@ export interface ModalProps extends ViewProps, BackdropPresentingConfig, RNModal
    * Modals nested inside an inline modal render inline as well.
    */
   renderInline?: boolean;
+  /**
+   * Whether the presented content blocks the screen behind it. With `blocking={false}` the
+   * content floats above the app in the `ApplicationProvider` panel without a native modal or a
+   * backdrop: touches outside it reach the views underneath and `onBackdropPress` never fires.
+   * Falls back to the blocking native modal when the content renders inline.
+   */
+  blocking?: boolean;
   children?: React.ReactNode;
 }
 
@@ -106,6 +114,13 @@ export type ModalElement = React.ReactElement<ModalProps>;
  * @property {string} backdropAccessibilityLabel - Accessible name for the dismissable backdrop.
  * When omitted, the backdrop is hidden from assistive technology.
  *
+ * @property {boolean} blocking - Whether the content blocks the screen behind it. With `false`, the content
+ * floats above the app through the `ApplicationProvider` panel without a native modal or a backdrop: touches
+ * outside it reach the views underneath and `onBackdropPress` is never called. Use it for transient
+ * content such as suggestion lists that must not steal the first tap on a neighbouring control.
+ * Inline rendering (`renderInline`, or no `ApplicationProvider`) always blocks.
+ * Defaults to true.
+ *
  * @property {ViewProps} ...ViewProps - Any props applied to View component.
  *
  * @overview-example ModalSimpleUsage
@@ -122,6 +137,7 @@ const ModalComponent: React.FC<ModalProps> = ({
   visible = false,
   shouldUseContainer = true,
   renderInline = false,
+  blocking = true,
   children,
   backdropStyle,
   backdropAccessibilityLabel,
@@ -143,6 +159,7 @@ const ModalComponent: React.FC<ModalProps> = ({
   const themeStore = useContext(ThemeStoreContext);
   const id = useId();
   const usePanel = !!registry && !renderInline;
+  const useOverlay = usePanel && !blocking;
   const itemContextValue = useMemo(() => ({ id }), [id]);
 
   if (registry === undefined && !renderInline && !didWarnMissingPanel && process.env.NODE_ENV !== 'production') {
@@ -187,8 +204,9 @@ const ModalComponent: React.FC<ModalProps> = ({
       <View
         // Scopes VoiceOver to the modal contents on iOS, and emits
         // `aria-modal` on the web. Android already gets this from the
-        // underlying native modal window.
-        aria-modal={true}
+        // underlying native modal window. Non-blocking content is not a
+        // modal: the rest of the screen stays reachable.
+        aria-modal={blocking}
         onAccessibilityEscape={onBackdropPress}
         {...viewProps}
         style={[style, styles.modalView, contentFlexPosition]}
@@ -201,14 +219,30 @@ const ModalComponent: React.FC<ModalProps> = ({
   const renderMeasuringContentElement = (): MeasuringElement => {
     return (
       <MeasureElement
-        shouldUseTopInsets={ModalService.getShouldUseTopInsets}
+        shouldUseTopInsets={useOverlay ? false : ModalService.getShouldUseTopInsets}
         onMeasure={onContentMeasure}
       >
         {renderContentElement()}
       </MeasureElement>
     );
   };
 
+  // Non-blocking content is a plain view in the panel, laid out over the whole window so that
+  // the window coordinates produced by `MeasureElement` apply directly. The panel usually sits
+  // at the window origin; when it does not (a header above `ApplicationProvider`), the view
+  // measures its own offset and shifts itself back to the origin.
+  const renderOverlay = (): React.ReactElement => {
+    const content = shouldUseContainer ? renderMeasuringContentElement() : children;
+    return (
+      <ModalPanelItemContext.Provider value={itemContextValue}>
+        <ModalOverlay>
+          {c
```

**File**: `src/components/ui/modal/modal.spec.tsx` (modified, +21/-0)
```diff
@@ -374,6 +374,27 @@ describe('@modal: panel checks', () => {
     warn.mockRestore();
   });
 
+  it('should float above the app without a native modal when not blocking', () => {
+    const component = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Modal
+          visible={true}
+          blocking={false}
+        >
+          <Text>Suggestions</Text>
+        </Modal>
+      </ApplicationProvider>,
+    );
+
+    expect(component.UNSAFE_queryByType(RNModal)).toBeFalsy();
+    expect(component.queryByTestId('@backdrop')).toBeFalsy();
+    expect(component.getByTestId('@modal/overlay').props.pointerEvents).toEqual('box-none');
+    expect(component.queryByText('Suggestions')).toBeTruthy();
+  });
+
   it('should render inline when renderInline is set', () => {
     const component = render(
       <Provider>
```

---

### Incident Patch 2: `f73b265b` (2026-09-27)
**Commit Message**: fix(view-pager): hide off-screen pages from screen readers

Every page stays mounted and is only translated off screen, so VoiceOver
and TalkBack walked into pages the user could not see. The page wrapper
now carries aria-hidden for every index other than selectedIndex, which
React Native maps to accessibilityElementsHidden on iOS and
importantForAccessibility='no-hide-descendants' on Android. Closes #1658.

**File**: `.changeset/view-pager-hidden-pages.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Hide the non-selected `ViewPager` (and therefore `TabView`) pages from assistive technology. Every page stays mounted and translated off screen, so VoiceOver and TalkBack walked into pages the user could not see; the page wrappers now carry `aria-hidden` (`accessibilityElementsHidden` on iOS, `importantForAccessibility='no-hide-descendants'` on Android) for every index other than `selectedIndex`.
```

**File**: `src/components/ui/tab/tab.spec.tsx` (modified, +3/-2)
```diff
@@ -212,8 +212,9 @@ describe('@tab-view: component checks', () => {
       <TestTabView />,
     );
 
+    // The non-selected page is mounted but hidden from assistive technology.
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeTruthy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeTruthy();
   });
 
   it('should not render content elements if disabled by shouldLoadComponent prop', () => {
@@ -222,7 +223,7 @@ describe('@tab-view: component checks', () => {
     );
 
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeFalsy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeFalsy();
   });
 
   it('should render tab indicator correctly', () => {
```

**File**: `src/components/ui/viewPager/viewPager.component.tsx` (modified, +8/-1)
```diff
@@ -196,8 +196,15 @@ function ViewPagerComponent<ChildrenProps = {}>(
 
   const renderComponentChild = (source: React.ReactElement<ChildrenProps>, index: number): React.ReactElement => {
     const contentView = shouldLoadComponent(index) ? source : null;
+    // Pages other than the selected one are translated off screen but still mounted, so screen
+    // readers would walk into them (#1658). `aria-hidden` maps to `accessibilityElementsHidden`
+    // on iOS, `importantForAccessibility='no-hide-descendants'` on Android and `aria-hidden` on web.
     return (
-      <View key={index} style={styles.contentContainer}>
+      <View
+        key={index}
+        style={styles.contentContainer}
+        aria-hidden={index !== selectedIndex}
+      >
         {contentView}
       </View>
     );
```

**File**: `src/components/ui/viewPager/viewPager.spec.tsx` (modified, +32/-3)
```diff
@@ -6,7 +6,11 @@
  */
 
 import React from 'react';
-import { GestureResponderHandlers, Text } from 'react-native';
+import {
+  GestureResponderHandlers,
+  Text,
+  View,
+} from 'react-native';
 import {
   act,
   fireEvent,
@@ -69,8 +73,9 @@ describe('@view-pager: component checks', () => {
       </TestViewPager>,
     );
 
+    // The non-selected page is mounted but hidden from assistive technology.
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeTruthy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeTruthy();
   });
 
   it('should call shouldLoadComponent for each child', () => {
@@ -102,7 +107,31 @@ describe('@view-pager: component checks', () => {
     );
 
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeFalsy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeFalsy();
+  });
+
+  it('should hide every page but the selected one from assistive technology', () => {
+    const component = render(
+      <TestViewPager selectedIndex={1}>
+        <Text>
+          Tab 0
+        </Text>
+        <Text>
+          Tab 1
+        </Text>
+        <Text>
+          Tab 2
+        </Text>
+      </TestViewPager>,
+    );
+
+    const pages = component.UNSAFE_getAllByType(View)
+      .filter(view => typeof view.props['aria-hidden'] === 'boolean');
+
+    expect(pages.map(page => page.props['aria-hidden'])).toEqual([true, false, true]);
+    expect(component.queryByText('Tab 1')).toBeTruthy();
+    expect(component.queryByText('Tab 0')).toBeFalsy();
+    expect(component.queryByText('Tab 0', { includeHiddenElements: true })).toBeTruthy();
   });
 
   it('should disable swipe gesture when swipeEnabled is false', () => {
```

---

### Incident Patch 3: `af419a39` (2026-09-27)
**Commit Message**: fix(datepicker): keep the calendar inside narrow windows

The Eva and Material mappings give Calendar a fixed width of 344, wider
than a 320 dp screen. The Datepicker popover took that width, was clamped
to x=0 by the popover bounds fix and lost the Saturday column past the
right edge. The Calendar container is now capped at its parent width and
the picker popover at the window width minus an 8 dp inset, so the day
cells (already flex: 1) absorb the difference. Closes #1784.

**File**: `.changeset/datepicker-narrow-screen.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Keep the `Datepicker` and `RangeDatepicker` calendar inside the window on screens narrower than the mapping's 344 dp calendar width (320 dp devices): the picker popover is clamped to the window width with an 8 dp inset on each side, and the `Calendar` / `RangeCalendar` container is capped at its parent width so day cells flex instead of the Saturday column being clipped at the right edge.
```

**File**: `src/components/ui/calendar/calendar.spec.tsx` (modified, +10/-0)
```diff
@@ -11,6 +11,7 @@ import {
   TouchableWithoutFeedback,
 } from '../../devsupport';
 import {
+  StyleSheet,
   TouchableOpacity,
   View,
 } from 'react-native';
@@ -478,4 +479,13 @@ describe('@calendar: component checks', () => {
     expect((componentRef.current.getPickerDate() as Date).getFullYear()).toEqual(2020);
   });
 
+  it('should cap the container at the parent width so narrow screens do not clip a column', () => {
+    const component = render(<TestCalendar testID='calendar' />);
+
+    const containerStyle = StyleSheet.flatten(component.getByTestId('calendar').props.style);
+
+    expect(containerStyle.width).toEqual(expect.any(Number));
+    expect(containerStyle.maxWidth).toEqual('100%');
+  });
+
 });
```

**File**: `src/components/ui/calendar/hooks/useCalendarStyles.ts` (modified, +4/-0)
```diff
@@ -29,6 +29,10 @@ export function useCalendarStyles(evaStyle: StyleType): CalendarStyles {
   return useMemo(() => ({
     container: {
       width: evaStyle.width,
+      // The mapping width is a target, not a floor: a screen narrower than it (320 dp devices,
+      // #1784) must not push the last weekday column off the edge. Cells are `flex: 1`, so they
+      // absorb the difference.
+      maxWidth: '100%',
       paddingVertical: evaStyle.paddingVertical,
       borderColor: evaStyle.borderColor,
       borderWidth: evaStyle.borderWidth,
```

**File**: `src/components/ui/datepicker/datepicker.spec.tsx` (modified, +26/-0)
```diff
@@ -8,6 +8,7 @@
 import React from 'react';
 import { TouchableWithoutFeedback } from '../../devsupport';
 import {
+  Dimensions,
   StyleSheet,
   Text,
   TouchableOpacity,
@@ -690,4 +691,29 @@ describe('@datepicker: component checks', () => {
     expect(onVisibleDateChange).toBeCalled();
   });
 
+  describe('popover width', () => {
+    const findViewMaxWidths = (api: RenderAPI): number[] => api.UNSAFE_getAllByType(View)
+      .map(view => StyleSheet.flatten(view.props.style)?.maxWidth)
+      .filter((maxWidth): maxWidth is number => typeof maxWidth === 'number');
+
+    afterEach(() => {
+      jest.restoreAllMocks();
+    });
+
+    it('should cap the popover at the window width minus the inset', async () => {
+      const dimensionsGet = Dimensions.get;
+      jest.spyOn(Dimensions, 'get').mockImplementation((dimension) => {
+        const actual = dimensionsGet.call(Dimensions, dimension);
+        return dimension === 'window' ? { ...actual, width: 320, height: 568 } : actual;
+      });
+
+      const component = render(<TestDatepicker />);
+
+      fireEvent.press(touchables.findInputTouchable(component));
+      await waitFor(() => component.UNSAFE_getByType(Calendar));
+
+      expect(findViewMaxWidths(component)).toContain(320 - 2 * 8);
+    });
+  });
+
 });
```

**File**: `src/components/ui/datepicker/useDatepickerStyles.ts` (modified, +13/-1)
```diff
@@ -5,8 +5,15 @@
  */
 
 import { useMemo } from 'react';
+import { useWindowDimensions } from 'react-native';
 import { StyleType } from '../../theme';
 
+/**
+ * Space kept between the picker popover and each window edge when the window is narrower than
+ * the mapping's `popoverWidth` (#1784).
+ */
+export const DATEPICKER_POPOVER_WINDOW_INSET = 8;
+
 export interface DatepickerStyles {
   control: StyleType;
   text: StyleType;
@@ -18,6 +25,8 @@ export interface DatepickerStyles {
 }
 
 export function useDatepickerStyles(evaStyle: StyleType): DatepickerStyles {
+  const { width: windowWidth } = useWindowDimensions();
+
   return useMemo(() => {
     const {
       textMarginHorizontal,
@@ -81,8 +90,11 @@ export function useDatepickerStyles(evaStyle: StyleType): DatepickerStyles {
       },
       popover: {
         width: popoverWidth,
+        // The calendar inside sizes the popover (its mapping width is 344); cap the popover at the
+        // window so the calendar, which is `maxWidth: '100%'`, shrinks with it on narrow screens.
+        maxWidth: windowWidth - 2 * DATEPICKER_POPOVER_WINDOW_INSET,
         marginBottom: captionMarginTop,
       },
     };
-  }, [evaStyle]);
+  }, [evaStyle, windowWidth]);
 }
```

---

### Incident Patch 4: `29c44246` (2026-09-27)
**Commit Message**: fix(toggle): keep the press highlight rounded on Android

Fabric drops the border radius of a view whose background changes
from transparent to a colour after mount (facebook/react-native
#52415), and the outline highlight of Toggle, CheckBox and Radio
does exactly that on press and focus, so it drew as a rectangle.
Clip the highlight to its own shape.

Closes #1895

**File**: `.changeset/outline-highlight-radius.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Keep the press and focus highlight of `Toggle`, `CheckBox` and `Radio` rounded on Android. Fabric drops the border radius of a view whose background turns from transparent into a colour after it is mounted (facebook/react-native#52415, React Native 0.80 and newer), so the outline drew as a rectangle while pressed. The highlight now clips to its own shape.
```

**File**: `src/components/ui/checkbox/checkbox.component.tsx` (modified, +4/-0)
```diff
@@ -268,6 +268,10 @@ const styles = StyleSheet.create({
   },
   highlight: {
     position: 'absolute',
+    // Fabric on Android drops the border radius of a view whose background goes from
+    // transparent to a colour after mount (facebook/react-native#52415), which is exactly what
+    // the outline does on press and focus. Clipping keeps the highlight rounded.
+    overflow: 'hidden',
   },
   iconContainer: {
     justifyContent: 'center',
```

**File**: `src/components/ui/checkbox/checkbox.spec.tsx` (modified, +13/-0)
```diff
@@ -8,8 +8,10 @@
 import React from 'react';
 import { TouchableWeb } from '../../devsupport';
 import {
+  StyleSheet,
   Text,
   TouchableOpacity,
+  View,
 } from 'react-native';
 import {
   fireEvent,
@@ -246,4 +248,15 @@ describe('@checkbox component checks', () => {
     });
   });
 
+  it('should clip the outline highlight to its border radius', () => {
+    const component = render(<TestCheckBox />);
+    const highlight = component.UNSAFE_getAllByType(View)
+      .find((view) => StyleSheet.flatten(view.props.style).width === 32);
+
+    expect(StyleSheet.flatten(highlight.props.style)).toEqual(expect.objectContaining({
+      borderRadius: 6,
+      overflow: 'hidden',
+    }));
+  });
+
 });
```

**File**: `src/components/ui/radio/radio.component.tsx` (modified, +4/-0)
```diff
@@ -248,5 +248,9 @@ const styles = StyleSheet.create({
   },
   highlight: {
     position: 'absolute',
+    // Fabric on Android drops the border radius of a view whose background goes from
+    // transparent to a colour after mount (facebook/react-native#52415), which is exactly what
+    // the outline does on press and focus. Clipping keeps the highlight rounded.
+    overflow: 'hidden',
   },
 });
```

**File**: `src/components/ui/radio/radio.spec.tsx` (modified, +13/-0)
```diff
@@ -8,8 +8,10 @@
 import React from 'react';
 import { TouchableWeb } from '../../devsupport';
 import {
+  StyleSheet,
   Text,
   TouchableOpacity,
+  View,
 } from 'react-native';
 import {
   fireEvent,
@@ -201,4 +203,15 @@ I love Babel
     });
   });
 
+  it('should clip the outline highlight to its border radius', () => {
+    const component = render(<TestRadio />);
+    const highlight = component.UNSAFE_getAllByType(View)
+      .find((view) => StyleSheet.flatten(view.props.style).width === 32);
+
+    expect(StyleSheet.flatten(highlight.props.style)).toEqual(expect.objectContaining({
+      borderRadius: 16,
+      overflow: 'hidden',
+    }));
+  });
+
 });
```

---

### Incident Patch 5: `f31918be` (2026-09-27)
**Commit Message**: fix(measure): stop double status bar offset on RN 0.86

React Native 0.86 changed Android measureInWindow to report positions
from the top of an edge-to-edge window, the same space its Modal
windows use, so the status bar height added for 0.81 through 0.85
now pushed every popover-based component down by one bar. Add the
offset only on the React Native versions that still measure below
the status bar.

Closes #1894

**File**: `.changeset/measure-rn86-status-bar.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Stop adding the status bar height to measured frames on edge-to-edge Android with React Native 0.86 and newer. React Native 0.86 changed Android `measureInWindow` to report positions from the top of an edge-to-edge window, the same coordinate space its `Modal` windows use, so the compensation that closed the gap on 0.81 through 0.85 now pushed every `Select`, `Popover`, `Tooltip`, `Autocomplete`, `Datepicker` and `OverflowMenu` down by one status bar. The offset is now applied only on the React Native versions that still measure below the status bar.
```

**File**: `src/components/devsupport/components/measure/measure.component.tsx` (modified, +35/-4)
```diff
@@ -24,6 +24,15 @@ interface DeviceInfoModule {
   getConstants?: () => DeviceInfoConstants;
 }
 
+interface ReactNativeVersion {
+  major: number;
+  minor: number;
+}
+
+interface PlatformConstantsWithVersion {
+  reactNativeVersion?: ReactNativeVersion;
+}
+
 /**
  * Whether React Native draws the Android app edge-to-edge (React Native 0.81+ reports it through
  * the `DeviceInfo` constants). In that mode every native `Modal` window is presented edge-to-edge
@@ -43,6 +52,27 @@ const isAndroidEdgeToEdge = (): boolean => {
   return constants?.isEdgeToEdge === true;
 };
 
+/**
+ * Whether Android `measureInWindow` still reports positions below the status bar in edge-to-edge
+ * mode. React Native 0.81 through 0.85 subtract the visible display frame from the root view
+ * offset, so an edge-to-edge window is measured from under the status bar while its `Modal`
+ * windows start at the top of the screen. React Native 0.86 stopped subtracting anything when
+ * edge-to-edge is on (`RootViewUtil.getViewportOffset`), so both coordinate spaces already match
+ * and adding the status bar height again pushes every popover down by one bar (#1894).
+ */
+const measuresBelowStatusBarInEdgeToEdge = (): boolean => {
+  const constants = Platform.constants as PlatformConstantsWithVersion | undefined;
+  const version = constants?.reactNativeVersion;
+  if (!version) {
+    return true;
+  }
+  return version.major === 0 && version.minor < 86;
+};
+
+const needsStatusBarOffset = (): boolean => {
+  return isAndroidEdgeToEdge() && measuresBelowStatusBarInEdgeToEdge();
+};
+
 export interface MeasureElementProps {
   force?: boolean;
   shouldUseTopInsets?: boolean;
@@ -117,10 +147,11 @@ export const MeasureElement: React.FC<MeasureElementProps> = ({
         measureSelf();
       }
     } else {
-      // Modal windows with a translucent status bar (and every modal on edge-to-edge Android)
-      // start at the top of the screen, so the status bar height has to be added to land the
-      // measured frame in the modal coordinate space.
-      const useTopInsets = shouldUseTopInsets || isAndroidEdgeToEdge();
+      // Modal windows with a translucent status bar (and every modal on edge-to-edge Android
+      // before React Native 0.86) start at the top of the screen while the measurement does not,
+      // so the status bar height has to be added to land the measured frame in the modal
+      // coordinate space.
+      const useTopInsets = shouldUseTopInsets || needsStatusBarOffset();
       const originY = useTopInsets ? y + (StatusBar.currentHeight || 0) : y;
       // Snap to whole points. Native layout lands fractional sizes on the pixel grid, so a content
       // view measured at a fractional origin comes back a fraction narrower or wider than the last
```

**File**: `src/components/devsupport/components/measure/measure.spec.tsx` (modified, +45/-1)
```diff
@@ -148,6 +148,13 @@ describe('@measure: element position checks', () => {
     return onMeasure.mock.calls[onMeasure.mock.calls.length - 1][0];
   };
 
+  const mockReactNativeVersion = (version: { major: number; minor: number } | undefined): void => {
+    jest.spyOn(Platform, 'constants', 'get').mockReturnValue({
+      ...Platform.constants,
+      reactNativeVersion: version,
+    } as typeof Platform.constants);
+  };
+
   afterEach(() => {
     UIManager.measureInWindow = measureInWindowOriginal;
     StatusBar.currentHeight = statusBarHeightOriginal;
@@ -177,9 +184,10 @@ describe('@measure: element position checks', () => {
     expect(frame.size.height).toEqual(259);
   });
 
-  it('should add status bar height on edge-to-edge android', async () => {
+  it('should add status bar height on edge-to-edge android before react native 0.86', async () => {
     jest.replaceProperty(Platform, 'OS', 'android');
     mockDeviceInfo(DeviceInfo);
+    mockReactNativeVersion({ major: 0, minor: 81 });
     StatusBar.currentHeight = 52;
     mockMeasureInWindow(16, 413, 379, 46);
 
@@ -189,6 +197,42 @@ describe('@measure: element position checks', () => {
     expect(frame.origin.y).toEqual(465);
   });
 
+  it('should add status bar height on edge-to-edge android when the version is unknown', async () => {
+    jest.replaceProperty(Platform, 'OS', 'android');
+    mockDeviceInfo(DeviceInfo);
+    mockReactNativeVersion(undefined);
+    StatusBar.currentHeight = 52;
+    mockMeasureInWindow(16, 413, 379, 46);
+
+    const frame = await renderAndMeasure();
+
+    expect(frame.origin.y).toEqual(465);
+  });
+
+  it('should not add status bar height on edge-to-edge android since react native 0.86', async () => {
+    jest.replaceProperty(Platform, 'OS', 'android');
+    mockDeviceInfo(DeviceInfo);
+    mockReactNativeVersion({ major: 0, minor: 86 });
+    StatusBar.currentHeight = 52;
+    mockMeasureInWindow(16, 413, 379, 46);
+
+    const frame = await renderAndMeasure();
+
+    expect(frame.origin.y).toEqual(413);
+  });
+
+  it('should still add status bar height with shouldUseTopInsets since react native 0.86', async () => {
+    jest.replaceProperty(Platform, 'OS', 'android');
+    mockDeviceInfo(null);
+    mockReactNativeVersion({ major: 0, minor: 86 });
+    StatusBar.currentHeight = 52;
+    mockMeasureInWindow(16, 413, 379, 46);
+
+    const frame = await renderAndMeasure({ shouldUseTopInsets: true });
+
+    expect(frame.origin.y).toEqual(465);
+  });
+
   it('should not add status bar height on android without edge-to-edge', async () => {
     jest.replaceProperty(Platform, 'OS', 'android');
     mockDeviceInfo(null);
```

---

### Incident Patch 6: `c7efa0b8` (2026-09-27)
**Commit Message**: fix(popover): keep content inside the window

The content was measured while parked off screen, where layout
offered it far more than the screen width, so a long text came
back as one wide line, no placement fit, and the fallback left it
cut off at the edge. Cap the content at the window width and clamp
the final frame into the bounds when nothing fits.

Closes #1693

**File**: `.changeset/popover-fit-bounds.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Keep `Popover` and `Tooltip` content on screen. The content is now capped at the window width, so a long text measures the same wherever it is placed instead of one very wide line off screen, and when no placement fits next to the anchor the chosen frame is moved back inside the window rather than left cut off at the edge.
```

**File**: `src/components/ui/popover/placement.service.ts` (modified, +20/-0)
```diff
@@ -31,6 +31,26 @@ export class PopoverPlacementService {
     return placement || preferredValue;
   }
 
+  /**
+   * Moves a frame inside `bounds` when no placement fits (a content wider than every gap next to
+   * the anchor, for example). A frame that already fits is returned as is; a frame larger than the
+   * bounds is pinned to their start so that at least its beginning stays visible.
+   */
+  public fit(frame: Frame, bounds: Frame): Frame {
+    const clamp = (origin: number, size: number, boundsOrigin: number, boundsSize: number): number => {
+      const max = boundsOrigin + boundsSize - size;
+      return Math.max(boundsOrigin, Math.min(origin, max));
+    };
+
+    const x = clamp(frame.origin.x, frame.size.width, bounds.origin.x, bounds.size.width);
+    const y = clamp(frame.origin.y, frame.size.height, bounds.origin.y, bounds.size.height);
+
+    if (x === frame.origin.x && y === frame.origin.y) {
+      return frame;
+    }
+    return new Frame(x, y, frame.size.width, frame.size.height);
+  }
+
   private findRecursive(
     placement: PopoverPlacement,
     families: string[],
```

**File**: `src/components/ui/popover/popover.component.tsx` (modified, +11/-3)
```diff
@@ -12,6 +12,7 @@ import {
   View,
   StyleProp,
   ViewStyle,
+  useWindowDimensions,
 } from 'react-native';
 import {
   Frame,
@@ -132,10 +133,16 @@ export function usePopoverMeasurement({
   }, [actualPlacement, onPlacementChange]);
 
   // Computed style for positioning
+  // The content is laid out at `left`, where Yoga only offers it the width that remains to the
+  // right (and, while it is still measured off screen, far more than the screen). Capping it at
+  // the window width makes the measured width independent of where the content sits, so the
+  // placement chosen from that measurement holds once the content moves there (#1693).
+  const { width: windowWidth } = useWindowDimensions();
+
   const contentFlexPosition = useMemo((): StyleProp<ViewStyle> => {
     const { x: left, y: top } = contentPosition;
-    return { left, top };
-  }, [contentPosition]);
+    return { left, top, maxWidth: windowWidth };
+  }, [contentPosition, windowWidth]);
 
   // Callback when anchor element is measured
   const onChildMeasure = useCallback((frame: Frame): void => {
@@ -165,7 +172,8 @@ export function usePopoverMeasurement({
       const placementOptions = findPlacementOptions(anchorFrame, childFrameRef.current);
       const computedPlacement = placementService.find(preferredPlacement, placementOptions);
 
-      const displayFrame = computedPlacement.frame(placementOptions);
+      // `find` falls back to the preferred placement when nothing fits; keep that frame on screen.
+      const displayFrame = placementService.fit(computedPlacement.frame(placementOptions), placementOptions.bounds);
       const newContentPosition = displayFrame.origin;
 
       // A move of at most one point is ignored: a fractional content size measures one point
```

**File**: `src/components/ui/popover/popover.spec.tsx` (modified, +31/-0)
```diff
@@ -24,6 +24,7 @@ import {
 } from '@ui-kitten/eva';
 import { ApplicationProvider } from '../../theme';
 import { Frame } from '../../devsupport';
+import { PopoverPlacementService } from './placement.service';
 import {
   Popover,
   PopoverProps,
@@ -252,6 +253,36 @@ describe('@popover: service checks', () => {
 
 });
 
+describe('@popover: service fit checks', () => {
+
+  const service = new PopoverPlacementService();
+  const bounds = new Frame(0, 0, 411, 838);
+
+  it('should keep a frame that already fits', () => {
+    const frame = new Frame(170, 560, 230, 52);
+    expect(service.fit(frame, bounds)).toBe(frame);
+  });
+
+  it('should move a frame that runs past the end back inside the bounds', () => {
+    const { origin } = service.fit(new Frame(263, 560, 230, 52), bounds);
+    expect(origin.x).toEqual(181);
+    expect(origin.y).toEqual(560);
+  });
+
+  it('should move a frame that starts before the bounds to their start', () => {
+    const { origin } = service.fit(new Frame(-80, -10, 230, 52), bounds);
+    expect(origin.x).toEqual(0);
+    expect(origin.y).toEqual(0);
+  });
+
+  it('should pin a frame larger than the bounds to their start', () => {
+    const { origin, size } = service.fit(new Frame(100, 20, 600, 52), bounds);
+    expect(origin.x).toEqual(0);
+    expect(size.width).toEqual(600);
+  });
+
+});
+
 describe('* placement - offset', () => {
 
   const options: PlacementOptions = {
```

**File**: `src/showcases/components/tooltip/tooltipEdge.component.tsx` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import React from 'react';
+import { StyleSheet, View } from 'react-native';
+import { Button, Layout, Tooltip } from '@ui-kitten/components';
+
+// #1693: a tooltip with a long text anchored near a screen edge used to run off screen.
+
+const LONG = 'This tooltip carries a long sentence so that it is much wider than its anchor and ends up beyond the edge of the screen unless the placement service keeps it inside';
+const MEDIUM = 'Wider than the anchor, narrower than the screen';
+
+interface EdgeTooltipProps {
+  testID: string;
+  align: 'flex-start' | 'center' | 'flex-end';
+  text: string;
+  placement?: string;
+}
+
+const EdgeTooltip = ({ testID, align, text, placement }: EdgeTooltipProps): React.ReactElement => {
+  const [visible, setVisible] = React.useState(false);
+
+  const renderAnchor = (): React.ReactElement => (
+    <Button
+      testID={`${testID}-anchor`}
+      size='small'
+      onPress={() => setVisible(true)}
+    >
+      TIP
+    </Button>
+  );
+
+  return (
+    <View style={[styles.row, { alignItems: align }]}>
+      <Tooltip
+        testID={testID}
+        anchor={renderAnchor}
+        visible={visible}
+        placement={placement}
+        onBackdropPress={() => setVisible(false)}
+      >
+        {text}
+      </Tooltip>
+    </View>
+  );
+};
+
+export const TooltipEdgeShowcase = (): React.ReactElement => (
+  <Layout level='1'>
+    <EdgeTooltip testID='tooltip-edge-right' align='flex-end' text={LONG} />
+    <EdgeTooltip testID='tooltip-edge-right-medium' align='flex-end' text={MEDIUM} />
+    <EdgeTooltip testID='tooltip-edge-left' align='flex-start' text={LONG} placement='bottom' />
+    <EdgeTooltip testID='tooltip-edge-center' align='center' text={LONG} />
+  </Layout>
+);
+
+const styles = StyleSheet.create({
+  row: {
+    marginBottom: 12,
+  },
+});
```

---

### Incident Patch 7: `9e38cc23` (2026-09-27)
**Commit Message**: fix(view-pager): ignore zero-width layouts

A pager laid out at zero width (a hidden screen on react-native-web)
divided its offset by zero, reported NaN through onSelect, and the
owner's setState scheduled the next animation, forever. Skip the
scroll on a zero-width layout and never report a non-finite index.

Closes #1397

**File**: `.changeset/view-pager-zero-width.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`ViewPager` and `TabView` stay quiet while laid out at zero width. On react-native-web a navigator keeps inactive screens mounted but hidden, and the pager used to report `NaN` as the selected index from there, which re-triggered its own animation in a loop and left the tabs unresponsive once the screen was shown again.
```

**File**: `src/components/ui/viewPager/viewPager.component.tsx` (modified, +13/-4)
```diff
@@ -107,9 +107,16 @@ function ViewPagerComponent<ChildrenProps = {}>(
       useNativeDriver: Platform.OS !== 'web',
     });
     animation.start((result) => {
-      const currentSelectedIndex = contentOffsetValueRef.current / contentWidthRef.current;
-      if (currentSelectedIndex !== selectedIndexRef.current && onSelect && result.finished) {
-        onSelect(Math.round(currentSelectedIndex));
+      // A pager that is laid out at zero width (a screen react-native-web keeps mounted but hidden,
+      // for example) has no page width to divide by; reporting NaN here made the owner set NaN as
+      // the selected index, which scheduled the next animation, and so on for as long as the screen
+      // stayed hidden.
+      if (!result.finished || !onSelect || contentWidthRef.current <= 0) {
+        return;
+      }
+      const currentSelectedIndex = Math.round(contentOffsetValueRef.current / contentWidthRef.current);
+      if (Number.isFinite(currentSelectedIndex) && currentSelectedIndex !== selectedIndexRef.current) {
+        onSelect(currentSelectedIndex);
       }
     });
   }, [animationDuration, contentOffsetAnimatedValue, onSelect]);
@@ -174,7 +181,9 @@ function ViewPagerComponent<ChildrenProps = {}>(
 
   const onLayout = useCallback((event: LayoutChangeEvent) => {
     contentWidthRef.current = event.nativeEvent.layout.width / childrenArray.length;
-    scrollToIndex({ index: selectedIndexRef.current, animated: true });
+    if (contentWidthRef.current > 0) {
+      scrollToIndex({ index: selectedIndexRef.current, animated: true });
+    }
   }, [childrenArray.length, scrollToIndex]);
 
   const getContainerStyle = useCallback((): ViewStyle => {
```

**File**: `src/components/ui/viewPager/viewPager.spec.tsx` (modified, +35/-1)
```diff
@@ -7,7 +7,11 @@
 
 import React from 'react';
 import { GestureResponderHandlers, Text } from 'react-native';
-import { render } from '@testing-library/react-native';
+import {
+  act,
+  fireEvent,
+  render,
+} from '@testing-library/react-native';
 import {
   ViewPager,
   ViewPagerProps,
@@ -23,6 +27,36 @@ describe('@view-pager: component checks', () => {
     <ViewPager {...props} />
   );
 
+  it('should not report a selection while laid out at zero width', () => {
+    jest.useFakeTimers();
+    try {
+      const onSelect = jest.fn();
+      const component = render(
+        <TestViewPager
+          testID='pager'
+          selectedIndex={1}
+          onSelect={onSelect}
+        >
+          <Text>Tab 0</Text>
+          <Text>Tab 1</Text>
+        </TestViewPager>,
+      );
+      const pager = component.getByTestId('pager');
+
+      // A hidden screen on react-native-web lays the pager out at 0 x 0.
+      act(() => fireEvent(pager, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } } }));
+      act(() => jest.advanceTimersByTime(1000));
+      expect(onSelect).not.toHaveBeenCalled();
+
+      // Once it has a width again, page changes are reported as before.
+      act(() => fireEvent(pager, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 600, height: 400 } } }));
+      act(() => jest.advanceTimersByTime(1000));
+      expect(onSelect.mock.calls.every(([index]) => Number.isFinite(index))).toBe(true);
+    } finally {
+      jest.useRealTimers();
+    }
+  });
+
   it('should render two tabs', () => {
     const component = render(
       <TestViewPager>
```

**File**: `website/qa/README.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ yarn storybook                                   # :6006
   --user-data-dir=/tmp/qa-chrome --window-size=1000,800 --no-first-run about:blank &
 yarn storybook:qa                                # node qa/run.mjs qa/out http://localhost:6006
 node qa/taborder.mjs                             # full keyboard Tab order + focusable list
+node qa/tabview.mjs                              # TabView: wheel-scrolls tab content, hides/shows the pager (#1397, #1498)
 ```
 
 `run.mjs` prints one `PASS` / `FAIL` line per check, writes crops of the interesting states into
```

**File**: `website/qa/tabview.mjs` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+// TabView web checks for #1397 (hidden pager must stay quiet) and #1498 (tab content must scroll).
+// Usage: node qa/tabview.mjs [storybookBase]   (Storybook on :6006, headless Chrome on :9333)
+import { connect } from './cdp.mjs';
+const base = process.argv[2] || 'http://localhost:6006';
+const c = await connect();
+const T = (id) => `[data-testid="${id}"]`;
+const rep = (name, pass, detail = '') => console.log((pass ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
+const clickText = async (text) => {
+  const r = await c.ev(`(() => { const e = [...document.querySelectorAll('div,span')].find(n => n.textContent.toUpperCase() === ${JSON.stringify(text)} && n.children.length === 0); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
+  if (!r) throw new Error('no element with text ' + text);
+  await c.click(r.x, r.y);
+};
+
+// ---- #1498 scrolling content
+await c.goto(base + '/iframe.html?id=components-tab--tab-view-scroll&viewMode=story');
+await c.waitFor(`!!document.querySelector('${T('tab-scroll')}')`);
+await c.sleep(600);
+const before = await c.ev(`document.querySelector('${T('tab-scroll')}').scrollTop`);
+const r = await c.rect(T('tab-scroll'));
+await c.mouseMove(r.cx, r.cy);
+for (let i = 0; i < 5; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.cx, y: r.cy, deltaX: 0, deltaY: 300 }); await c.sleep(80); }
+await c.sleep(300);
+const after = await c.ev(`document.querySelector('${T('tab-scroll')}').scrollTop`);
+const box = await c.ev(`(() => { const e = document.querySelector('${T('tab-scroll')}'); return { client: e.clientHeight, scroll: e.scrollHeight, overflowY: getComputedStyle(e).overflowY }; })()`);
+rep('tab content scrolls with the wheel', after > before, `scrollTop ${before} -> ${after}, ${JSON.stringify(box)}`);
+await c.shot('qa/out/tabview-scroll.png');
+
+// ---- #1397 hidden pager
+await c.goto(base + '/iframe.html?id=components-tab--tab-view-hidden&viewMode=story');
+await c.waitFor(`!!document.querySelector('${T('tab-state')}')`);
+await c.sleep(600);
+const state = () => c.ev(`document.querySelector('${T('tab-state')}').textContent`);
+await clickText('SECOND'); await c.sleep(600);
+const s1 = await state();
+const h = await c.rect(T('tab-hide')); await c.click(h.cx, h.cy); await c.sleep(2000);
+const s2 = await state();
+rep('hidden pager reports no selections', s1 === s2 && /calls: 1$/.test(s2), `${s1} | after hide ${s2}`);
+await c.click(h.cx, h.cy); await c.sleep(800);
+await clickText('FIRST'); await c.sleep(800);
+const s3 = await state();
+rep('pager responds again after show', /selected: 0, onSelect calls: 2$/.test(s3), s3);
+const errors = c.console.filter((m) => /error|Maximum update depth/i.test(m));
+rep('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
+await c.close?.();
+process.exit(0);
```

---

### Incident Patch 8: `07f77acd` (2026-09-27)
**Commit Message**: fix(theme): key style cache by mapping, document mapping recipes

The style cache key held component, variants, interactions and
theme id, so a custom mapping was ignored once the same component
had been styled under another mapping in the process: a runtime
customMapping change did nothing and two providers shared styles.
The key now carries a per-mapping id. ApplicationProvider warns
when customMapping is passed next to build-time styles.

Docs: transparent shade caution in the branding guide, mapping
recipes (Input radius, text size, strict tokens, runtime values),
and art for the four overview cards that reused placeholders.

Closes #1877
Closes #1816

**File**: `.changeset/style-cache-per-mapping.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Style cache entries are now keyed by the compiled mapping as well, so a `customMapping` that changes at runtime restyles the components, and two `ApplicationProvider`s with different mappings no longer share styles. `ApplicationProvider` warns in development when `customMapping` is passed next to build-time `styles`, where it is ignored.
```

**File**: `src/components/theme/application/applicationProvider.component.tsx` (modified, +11/-0)
```diff
@@ -98,10 +98,21 @@ function createStyles(mapping: SchemaType, custom?: CustomSchemaType): ThemeStyl
  * );
  * ```
  */
+let didWarnIgnoredCustomMapping = false;
+
 export function ApplicationProvider(props: ApplicationProviderProps): React.ReactElement {
   const buildtimeStyles = (props as EvaBuildtimeProcessingProps).styles;
   const { mapping, customMapping } = props as EvaRuntimeProcessingProps;
 
+  if (buildtimeStyles && customMapping && !didWarnIgnoredCustomMapping && process.env.NODE_ENV !== 'production') {
+    didWarnIgnoredCustomMapping = true;
+    console.warn(
+      'ApplicationProvider received both `styles` (compiled by @ui-kitten/metro-config) and ' +
+      '`customMapping`; `customMapping` is ignored when `styles` is present. Pass `mapping` instead ' +
+      'of `styles` to merge a mapping at runtime, or move the customization into the file Metro compiles.',
+    );
+  }
+
   // Clear style cache when mapping or theme changes so components recompute
   const prevMappingRef = React.useRef(mapping);
   const prevThemeRef = React.useRef(props.theme);
```

**File**: `src/components/theme/application/customMapping.spec.tsx` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+/**
+ * @license
+ * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
+ * Licensed under the MIT License. See License.txt in the project root for license information.
+ */
+
+import React from 'react';
+import {
+  StyleSheet,
+  View,
+} from 'react-native';
+import { render } from '@testing-library/react-native';
+import {
+  light,
+  mapping,
+} from '@ui-kitten/eva';
+import { CustomSchemaType } from '@ui-kitten/processor';
+import { ApplicationProvider } from './applicationProvider.component';
+import { createOnDemandStyles } from '../style/onDemandStyles';
+import { Text } from '../../ui/text/text.component';
+
+const fontSizeOf = (api: ReturnType<typeof render>, testID: string): number => {
+  return (StyleSheet.flatten(api.getByTestId(testID).props.style) as { fontSize: number }).fontSize;
+};
+
+const textMapping = (fontSize: number): CustomSchemaType => ({
+  components: {
+    Text: {
+      appearances: {
+        default: {
+          mapping: {},
+          variantGroups: { category: { p1: { fontSize } } },
+        },
+      },
+    },
+  },
+} as unknown as CustomSchemaType);
+
+describe('@application-provider: custom mapping checks', () => {
+
+  it('should apply a custom mapping after another provider styled the same component', () => {
+    const plain = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Text testID='text'>Text</Text>
+      </ApplicationProvider>,
+    );
+    expect(fontSizeOf(plain, 'text')).toEqual(15);
+
+    const custom = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+        customMapping={textMapping(19)}
+      >
+        <Text testID='text'>Text</Text>
+      </ApplicationProvider>,
+    );
+    expect(fontSizeOf(custom, 'text')).toEqual(19);
+
+    const plainAgain = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Text testID='text'>Text</Text>
+      </ApplicationProvider>,
+    );
+    expect(fontSizeOf(plainAgain, 'text')).toEqual(15);
+  });
+
+  it('should keep the styles of two providers with different custom mappings apart', () => {
+    const api = render(
+      <View>
+        <ApplicationProvider
+          mapping={mapping}
+          theme={light}
+          customMapping={textMapping(23)}
+        >
+          <Text testID='custom'>Text</Text>
+        </ApplicationProvider>
+        <ApplicationProvider
+          mapping={mapping}
+          theme={light}
+        >
+          <Text testID='plain'>Text</Text>
+        </ApplicationProvider>
+      </View>,
+    );
+
+    expect(fontSizeOf(api, 'custom')).toEqual(23);
+    expect(fontSizeOf(api, 'plain')).toEqual(15);
+  });
+
+  it('should restyle when the custom mapping changes at runtime', () => {
+    const Scaled = ({ size }: { size: number }): React.ReactElement => (
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+        customMapping={textMapping(size)}
+      >
+        <Text testID='text'>Text</Text>
+      </ApplicationProvider>
+    );
+    const api = render(<Scaled size={17} />);
+    expect(fontSizeOf(api, 'text')).toEqual(17);
+
+    api.rerender(<Scaled size={21} />);
+    expect(fontSizeOf(api, 'text')).toEqual(21);
+  });
+
+  it('should warn once when customMapping is passed next to compiled styles', () => {
+    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
+    const styles = createOnDemandStyles(mapping);
+
+    // The union type does not admit both props; the runtime tolerates it, which is what the warning is for.
+    const props = { styles, theme: light, customMapping: textMapping(29) } as unknown as React.ComponentProps<typeof ApplicationProvider>;
+    const api = render(
+      <ApplicationProvider {...props}>
+        <Text testID='text'>Text</Text>
+      </ApplicationProvider>,
+    );
+
+    expect(fontSizeOf(api, 'text')).toEqual(15);
+ 
```

**File**: `src/components/theme/style/styleCache.ts` (modified, +23/-4)
```diff
@@ -24,18 +24,36 @@ export class StyleCacheClass {
     this.maxSize = maxSize;
   }
 
+  private mappingIds = new WeakMap<object, number>();
+  private nextMappingId = 1;
+
+  /**
+   * Stable identifier of a compiled mapping (the `styles` object an ApplicationProvider hands
+   * down). Two providers with different `customMapping`s, or one provider whose `customMapping`
+   * changes at runtime, produce different objects and must not share cached styles.
+   */
+  mappingId(mapping: object): string {
+    let id = this.mappingIds.get(mapping);
+    if (id === undefined) {
+      id = this.nextMappingId++;
+      this.mappingIds.set(mapping, id);
+    }
+    return String(id);
+  }
+
   /**
    * Build a deterministic cache key from style parameters.
    *
-   * Key format: {componentName}::{appearance}::{variants}::{interactions}::{themeId}
-   * Example: "Button::filled::status:primary|size:medium::active::light"
+   * Key format: {componentName}::{appearance}::{variants}::{interactions}::{themeId}[::m{mappingId}]
+   * Example: "Button::filled::status:primary|size:medium::active::light::m1"
    */
   buildKey(
     componentName: string,
     appearance: string | undefined,
     variants: Record<string, string | boolean | undefined>,
     interactions: string[],
     themeId: string,
+    mappingId?: string,
   ): string {
     // Deterministic key: variant keys in sorted order, interactions sorted.
     let variantPairs = '';
@@ -49,7 +67,8 @@ export class StyleCacheClass {
 
     const interactionKey = interactions.length > 1 ? [...interactions].sort().join('|') : (interactions[0] ?? '');
 
-    return `${componentName}::${appearance ?? 'default'}::${variantPairs}::${interactionKey}::${themeId}`;
+    const key = `${componentName}::${appearance ?? 'default'}::${variantPairs}::${interactionKey}::${themeId}`;
+    return mappingId === undefined ? key : `${key}::m${mappingId}`;
   }
 
   /**
@@ -110,7 +129,7 @@ export class StyleCacheClass {
     const keysToDelete: string[] = [];
 
     for (const key of this.cache.keys()) {
-      if (key.endsWith(`::${themeId}`)) {
+      if (key.endsWith(`::${themeId}`) || key.includes(`::${themeId}::m`)) {
         keysToDelete.push(key);
       }
     }
```

**File**: `src/components/theme/style/useStyled.ts` (modified, +1/-0)
```diff
@@ -179,6 +179,7 @@ export function useStyled(
       variants,
       interactions,
       themeId,
+      styleCache.mappingId(mapping as object),
     );
 
     const cached = styleCache.get(cacheKey);
```

---

### Incident Patch 9: `7fcbe88f` (2026-09-27)
**Commit Message**: fix(top-navigation): stack subtitle below title

The start-aligned title container was a row since 5.0.0, so the
subtitle rendered beside the title unless alignment was center.

Closes #1824

**File**: `.changeset/top-navigation-subtitle-stack.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`TopNavigation` renders the subtitle below the title for the default (`start`) alignment. The title container was a row, so the subtitle sat next to the title unless `alignment='center'` was set.
```

**File**: `src/components/ui/topNavigation/topNavigation.component.tsx` (modified, +2/-1)
```diff
@@ -198,8 +198,9 @@ const styles = StyleSheet.create({
     justifyContent: 'center',
     alignItems: 'center',
   },
+  // Title above subtitle, like the centered layout. A row here put the subtitle
+  // next to the title whenever `alignment` was not `center`.
   titleContainer: {
-    flexDirection: 'row',
     flex: 1,
   },
   leftControlContainer: {
```

**File**: `src/components/ui/topNavigation/topNavigation.spec.tsx` (modified, +29/-0)
```diff
@@ -10,13 +10,18 @@ import { TouchableWeb } from '../../devsupport';
 import {
   Image,
   ImageProps,
+  StyleProp,
+  StyleSheet,
   Text,
   TouchableOpacity,
+  ViewStyle,
 } from 'react-native';
 import {
   fireEvent,
   render,
+  within,
 } from '@testing-library/react-native';
+import type { ReactTestInstance } from 'react-test-renderer';
 import {
   light,
   mapping,
@@ -232,6 +237,30 @@ describe('@top-navigation: component checks', () => {
     expect(component.queryByText('I love Babel')).toBeTruthy();
   });
 
+  it('should stack the subtitle below the title for every alignment', () => {
+    const titleContainerStyle = (alignment?: 'start' | 'center'): ViewStyle => {
+      const component = render(
+        <TestTopNavigation
+          alignment={alignment}
+          title='I love Babel'
+          subtitle='I love Jest'
+        />,
+      );
+      // Both texts share the title container; walk up from the subtitle to the host view
+      // that also contains the title.
+      let node: ReactTestInstance | null = component.getByText('I love Jest').parent;
+      while (node && !(String(node.type) === 'View' && within(node).queryByText('I love Babel'))) {
+        node = node.parent;
+      }
+      expect(node).toBeTruthy();
+      return StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) as ViewStyle;
+    };
+
+    expect(titleContainerStyle().flexDirection).not.toEqual('row');
+    expect(titleContainerStyle('start').flexDirection).not.toEqual('row');
+    expect(titleContainerStyle('center').flexDirection).not.toEqual('row');
+  });
+
   it('should render function component passed to accessoryLeft prop', () => {
     const component = render(
       <TestTopNavigation subtitle={props => (
```

**File**: `src/showcases/components/topNavigation/topNavigationSubtitle.component.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import React from 'react';
+import { StyleSheet } from 'react-native';
+import { Icon, IconElement, Layout, TopNavigation, TopNavigationAction } from '@ui-kitten/components';
+
+// #1824: with the default (start) alignment the subtitle used to render beside the title.
+
+const MenuIcon = (props): IconElement => (
+  <Icon
+    {...props}
+    name='menu'
+  />
+);
+
+const MenuAction = (): React.ReactElement => (
+  <TopNavigationAction icon={MenuIcon} />
+);
+
+export const TopNavigationSubtitleShowcase = (): React.ReactElement => (
+  <Layout level='1'>
+    <TopNavigation
+      testID='top-navigation-subtitle-start'
+      style={styles.bar}
+      title='Welcome'
+      subtitle='How are you doing today'
+      accessoryRight={MenuAction}
+    />
+    <TopNavigation
+      testID='top-navigation-subtitle-center'
+      style={styles.bar}
+      alignment='center'
+      title='Welcome'
+      subtitle='How are you doing today'
+      accessoryLeft={MenuAction}
+    />
+  </Layout>
+);
+
+const styles = StyleSheet.create({
+  bar: {
+    marginBottom: 8,
+  },
+});
```

**File**: `src/showcases/navigation/app.navigator.tsx` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@ import { RadioSimpleUsageShowcase } from '../components/radio/radioSimpleUsage.c
 import { RadioGroupSimpleUsageShowcase } from '../components/radioGroup/radioGroupSimpleUsage.component';
 import { CardSimpleUsageShowcase } from '../components/card/cardSimpleUsage.component';
 import { CardLayoutShowcase } from '../components/card/cardLayout.component';
+import { TopNavigationSubtitleShowcase } from '../components/topNavigation/topNavigationSubtitle.component';
 import { AvatarSimpleUsageShowcase } from '../components/avatar/avatarSimpleUsage.component';
 import { SpinnerSimpleUsageShowcase } from '../components/spinner/spinnerSimpleUsage.component';
 import { DividerSimpleUsageShowcase } from '../components/divider/dividerSimpleUsage.component';
@@ -191,6 +192,7 @@ const SECTIONS: ShowcaseSection[] = [
   { title: 'IconGallery5', Component: IconGallery5Showcase },
   { title: 'ModalDecimalSize', Component: ModalDecimalSizeShowcase },
   { title: 'CardLayout', Component: CardLayoutShowcase },
+  { title: 'TopNavigationSubtitle', Component: TopNavigationSubtitleShowcase },
 ];
 
 const keyExtractor = (item: ShowcaseSection): string => item.title;
```

---

### Incident Patch 10: `8f29793e` (2026-09-27)
**Commit Message**: fix(modal): stop 1px vibration at fractional sizes

Native layout snaps a fractional content width to the pixel grid,
so re-measuring after each reposition came back one point wider or
narrower, the centred origin moved by a point, and the cycle never
ended. MeasureElement now rounds the frame to whole points, and
Modal and Popover ignore a move of at most one point.

Closes #1767
Closes #1802

**File**: `.changeset/measure-tolerate-pixel-snap.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Stop `Modal` and `Popover` from vibrating by one pixel when their content has a fractional size. `MeasureElement` now reports whole points, and a re-measure that moves the content by at most one point no longer repositions it: native layout snaps a fractional width to the pixel grid, so the measured width alternated with every move and the modal repositioned itself forever.
```

**File**: `src/components/devsupport/components/measure/measure.component.tsx` (modified, +8/-1)
```diff
@@ -122,7 +122,14 @@ export const MeasureElement: React.FC<MeasureElementProps> = ({
       // measured frame in the modal coordinate space.
       const useTopInsets = shouldUseTopInsets || isAndroidEdgeToEdge();
       const originY = useTopInsets ? y + (StatusBar.currentHeight || 0) : y;
-      const frame: Frame = bindToWindow(new Frame(x, originY, w, h), Frame.window());
+      // Snap to whole points. Native layout lands fractional sizes on the pixel grid, so a content
+      // view measured at a fractional origin comes back a fraction narrower or wider than the last
+      // time; consumers that position the view from its measured frame then re-lay it out, and the
+      // two measurements alternate forever (Modal flickering by 1px, #1767 / #1802).
+      const frame: Frame = bindToWindow(
+        new Frame(Math.round(x), Math.round(originY), Math.round(w), Math.round(h)),
+        Frame.window(),
+      );
       onMeasure(frame);
     }
   };
```

**File**: `src/components/devsupport/components/measure/measure.spec.tsx` (modified, +21/-0)
```diff
@@ -101,6 +101,16 @@ describe('@measure: frame class instance checks', () => {
     expect(Frame.zero().equals(null)).toBeFalsy();
   });
 
+  it('point is near', () => {
+    expect(new Point(89, 289).isNear(new Point(90, 289))).toBeTruthy();
+    expect(new Point(89, 289).isNear(new Point(90, 290))).toBeTruthy();
+    expect(new Point(89, 289).isNear(new Point(91, 289))).toBeFalsy();
+    expect(new Point(89, 289).isNear(new Point(89, 291))).toBeFalsy();
+    expect(new Point(89, 289).isNear(new Point(92, 289), 3)).toBeTruthy();
+    expect(Point.outscreen().isNear(new Point(0, 0))).toBeFalsy();
+    expect(Point.zero().isNear(null)).toBeFalsy();
+  });
+
 });
 
 describe('@measure: element position checks', () => {
@@ -156,6 +166,17 @@ describe('@measure: element position checks', () => {
     expect(frame.size.height).toEqual(46);
   });
 
+  it('should round the measured frame to whole points', async () => {
+    mockMeasureInWindow(89.9047622680664, 289.1428527832031, 231.61904907226562, 259.4285583496094);
+
+    const frame = await renderAndMeasure();
+
+    expect(frame.origin.x).toEqual(90);
+    expect(frame.origin.y).toEqual(289);
+    expect(frame.size.width).toEqual(232);
+    expect(frame.size.height).toEqual(259);
+  });
+
   it('should add status bar height on edge-to-edge android', async () => {
     jest.replaceProperty(Platform, 'OS', 'android');
     mockDeviceInfo(DeviceInfo);
```

**File**: `src/components/devsupport/components/measure/type.ts` (modified, +15/-0)
```diff
@@ -23,6 +23,21 @@ export class Point {
     }
     return this.x === other.x && this.y === other.y;
   }
+
+  /**
+   * Whether both coordinates are within `tolerance` points of the other point.
+   *
+   * Native layout snaps a view with a fractional size to the pixel grid, so re-measuring it after
+   * moving it by a fraction can come back one point narrower or wider; a consumer that positions
+   * the view from that measurement then moves it again, and so on. Treating a move of at most one
+   * point as "did not move" breaks the cycle.
+   */
+  public isNear(other: Point, tolerance: number = 1): boolean {
+    if (!other) {
+      return false;
+    }
+    return Math.abs(this.x - other.x) <= tolerance && Math.abs(this.y - other.y) <= tolerance;
+  }
 }
 
 export class Size {
```

**File**: `src/components/ui/modal/modal.component.tsx` (modified, +4/-1)
```diff
@@ -176,7 +176,10 @@ const ModalComponent: React.FC<ModalProps> = ({
 
   const onContentMeasure = useCallback((contentFrame: Frame): void => {
     const displayFrame: Frame = contentFrame.centerOf(Frame.window());
-    setContentPosition(displayFrame.origin);
+    // A fractional content size measures one point wider or narrower depending on where the
+    // content sits, so every re-position would trigger another measurement forever (the modal
+    // vibrating by 1px, #1767 / #1802). A move of at most one point is not a move.
+    setContentPosition((current) => current.isNear(displayFrame.origin) ? current : displayFrame.origin);
   }, []);
 
   const renderContentElement = (): React.ReactElement<ViewProps> => {
```

#### Recent Merged Pull Requests:
- **PR #1909** (2026-09-27): docs(branding): explain Android font weight fallback (@bataevvlad)
- **PR #1908** (2026-09-27): fix(autocomplete): float the options without a backdrop (@bataevvlad)
- **PR #1907** (2026-09-27): feat(popover): add anchorContainerStyle (@bataevvlad)
- **PR #1906** (2026-09-27): fix(view-pager): hide off-screen pages from screen readers (@bataevvlad)
- **PR #1905** (2026-09-27): fix(datepicker): keep the calendar inside narrow windows (@bataevvlad)
- **PR #1904** (2026-09-27): test(web): add lazy TabView story and check (@bataevvlad)
- **PR #1903** (2026-09-27): fix(toggle): keep the press highlight rounded on Android (@bataevvlad)
- **PR #1902** (2026-09-27): fix(measure): stop double status bar offset on RN 0.86 (@bataevvlad)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
