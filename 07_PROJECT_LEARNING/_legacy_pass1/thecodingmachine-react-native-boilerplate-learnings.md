# Forensic Learning Record (Deep Inspection): thecodingmachine/react-native-boilerplate

> **Canonical Artifact**: `07_PROJECT_LEARNING/thecodingmachine-react-native-boilerplate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thecodingmachine/react-native-boilerplate](https://github.com/thecodingmachine/react-native-boilerplate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:24:09.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thecodingmachine/react-native-boilerplate`
- **Description**: A React Native template for building solid applications 🐙, using JavaScript 💛 or Typescript 💙 (you choose).
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5567 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `documentation/.eslintrc.js`
```
module.exports = {
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'plugin:react/recommended',
    'airbnb',
    'plugin:@docusaurus/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  plugins: [
    'react',
    '@typescript-eslint',
    '@docusaurus',
  ],
  rules: {
    'react/jsx-filename-extension': [2, { extensions: ['.js', '.jsx', '.ts', '.tsx'] }],
    'import/no-unresolved': [2, { ignore: ['^@theme', '^@docusaurus', '^@site'] }],
    'react/jsx-props-no-spreading': 'off',
    'react/no-array-index-key': 'off',
    'import/no-relative-packages': 'off',
    'global-require': 'off',
  },
};

```

### Core Architecture Module: `documentation/babel.config.js`
```
module.exports = {
  presets: [require.resolve('@docusaurus/core/lib/babel/preset')],
  plugins: [
    ['module-resolver', {
      alias: {
        'react-native': './mocks/react-native-mock',
      },
    }],
  ],
};

```

### Core Architecture Module: `documentation/docusaurus.config.ts`
```
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

export default {
  title: 'The React Native Boilerplate',
  tagline: 'Simple, Lightweight and Scalable.',
  url: 'https://thecodingmachine.github.io',
  baseUrl: '/react-native-boilerplate/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/TOM-small.webp',
  organizationName: 'thecodingmachine',
  projectName: 'react-native-boilerplate',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  plugins: [
    async function myPlugin() {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions) {
          // eslint-disable-next-line global-require,import/no-extraneous-dependencies
          postcssOptions.plugins.push(require('tailwindcss'));
          // eslint-disable-next-line global-require,import/no-extraneous-dependencies
          postcssOptions.plugins.push(require('autoprefixer'));
          return postcssOptions;
        },
      };
    },
  ],
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/thecodingmachine/react-native-boilerplate/edit/main/website-documentation/docs',
        },
        blog: {
          showReadingTime: true,
          editUrl:
            'https://github.com/thecodingmachine/react-native-boilerplate/edit/main/website-documentation/blog',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig: {
    algolia: {
      appId: '9PEYN0H12D',
      indexName: 'rnboilerplate',
      apiKey: '983439b6ebef49ed3394ecfa290f1c6a',
      contextualSearch: true,
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'React Native Boilerplate',
      logo: {
        alt: 'octopus tentacle logo',
        src: 'img/TOM-small.webp',
      },
      items: [
        {
          type: 'doc',
          docId: 'getting-started',
          position: 'left',
          label: 'Docs',
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          to: 'https://github.com/thecodingmachine/react-native-boilerplate',
          label: ' ',
          className: 'header-github-link group',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Features',
          items: [
            {
              label: 'Javascript or TypeScript ? You choose !',
              to: '/docs/installation#using-the-boilerplate',
            },
            {
              label: 'Navigation',
              to: '/docs/navigate',
            },
            {
              label: 'Data fetching',
              to: '/docs/data-fetching',
            },
            {
              label: 'Internationalization',
              to: '/docs/internationalization',
            },
            {
              label: 'Multi theming',
              to: '/docs/theming/how-to-use',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              to: 'https://github.com/thecodingmachine/react-native-boilerplate',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} React Native Boilerplate, by TheCodingMachine. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
} satisfies Config;

```

### Core Architecture Module: `documentation/mocks/react-native-mock.ts`
```
// eslint-disable-next-line import/prefer-default-export
export const StyleSheet = {
  create: (arg: any) => arg,
};

```

### Core Architecture Module: `documentation/sidebars.js`
```
// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [{ type: 'autogenerated', dirName: '.' }],
};

module.exports = sidebars;

```

### Core Architecture Module: `documentation/src/components/Backgrounds.tsx`
```
import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';

function Backgrounds() {
  const [primaryColorName, setPrimaryColorName] = useState('primary');
  const [primaryColor, setPrimaryColor] = useState('#ff0000');

  const [secondaryColorName, setSecondaryColorName] = useState('secondary');
  const [secondaryColor, setSecondaryColor] = useState('#00ff00');

  return (
    <div className="dark:bg-gray-900 bg-gray-100 pt-3 px-3 rounded-lg">
      <CodeBlock title="/src/theme/theme.config.ts" metastring="ts">
        {'export const config = { \n  //... \n  backgrounds: {\n    '}
        <input
          type="text"
          className="w-[90px]"
          value={primaryColorName}
          onChange={(e) => setPrimaryColorName(e.target.value)}
        />
        {': '}
        <input
          type="text"
          className="w-[70px]"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
        />
        {',\n    '}
        <input
          type="text"
          className="w-[90px]"
          value={secondaryColorName}
          onChange={(e) => setSecondaryColorName(e.target.value)}
        />
        {': '}
        <input
          type="text"
          className="w-[70px]"
          value={secondaryColor}
          onChange={(e) => setSecondaryColor(e.target.value)}
        />
        {',\n    // you can add more key/value here\n  },\n  //...\n}'}
      </CodeBlock>
      <p className="
          dark:text-gray-300 text-gray-500
          font-bold text-2xl text-center mb-4 border
          dark:border-gray-700 border-gray-200 p-2
          "
      >
        Generated classes
      </p>
      <div className="max-h-[300px] overflow-auto">
        <table className="table-fixed">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{`backgrounds.${primaryColorName}`}</td>
              <td><code>{`{ backgroundColor: ${primaryColor} }`}</code></td>
            </tr>
            <tr>
              <td>{`backgrounds.${secondaryColorName}`}</td>
              <td><code>{`{ backgroundColor: ${secondaryColor} }`}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Backgrounds;

```

### Core Architecture Module: `documentation/src/components/Borders.tsx`
```
import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';

function Borders() {
  const [sizes, setSizes] = useState('1, 2');
  const [sizeValues, setSizeValues] = useState([1, 2]);
  const [radius, setRadius] = useState('5, 10');
  const [radiusValues, setRadiusValues] = useState([5, 10]);
  const [colorName, setColorName] = useState('red');
  const [color, setColor] = useState('#ff0000');

  const onSizesBlur = () => {
    const arr = sizes.split(',');
    const valuesToNumbers = arr.map((item) => {
      if (!Number.isNaN(parseInt(item, 10))) {
        return parseInt(item, 10);
      }
      return null;
    }).filter((item) => item !== null);
    setSizeValues(valuesToNumbers);
    setSizes(valuesToNumbers.join(', '));
  };

  const onRadiusBlur = () => {
    const arr = radius.split(',');
    const valuesToNumbers = arr.map((item) => {
      if (!Number.isNaN(parseInt(item, 10))) {
        return parseInt(item, 10);
      }
      return null;
    }).filter((item) => item !== null);
    setRadiusValues(valuesToNumbers);
    setRadius(valuesToNumbers.join(', '));
  };

  return (
    <div className="dark:bg-gray-900 bg-gray-100 pt-3 px-3 rounded-lg">
      <CodeBlock title="/src/theme/theme.config.ts" metastring="ts">
        {'export const config = { \n  //... \n  border: {\n    widths: ['}
        <input
          type="text"
          className="w-fit"
          value={sizes}
          onChange={(e) => setSizes(e.target.value)}
          onBlur={onSizesBlur}
        />
        {']\n    radius: ['}
        <input
          type="text"
          className="w-fit"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          onBlur={onRadiusBlur}
        />
        {'], \n    colors: {\n      '}
        <input
          type="text"
          className="w-[50px]"
          value={colorName}
          onChange={(e) => setColorName(e.target.value)}
        />
        {': '}
        <input
          type="text"
          className="w-[70px]"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        {',\n      // you can add more key/value here\n    },\n  }\n  //...\n}'}
      </CodeBlock>
      <p className="
          dark:text-gray-300 text-gray-500
          font-bold text-2xl text-center mb-4 border
          dark:border-gray-700 border-gray-200 p-2
          "
      >
        Generated classes
      </p>
      <div className="max-h-[300px] overflow-auto">
        <table className="table-fixed">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {
                sizeValues.map((value) => (
                  <>
                    <tr>
                      <td>{`borders.w_${value}`}</td>
                      <td><code>{`{ borderWidth: ${value} }`}</code></td>
                    </tr>
                    <tr>
                      <td>{`borders.wTop_${value}`}</td>
                      <td><code>{`{ borderTopWidth: ${value} }`}</code></td>
                    </tr>
                    <tr>
                      <td>{`borders.wRight_${value}`}</td>
                      <td><code>{`{ borderRightWidth: ${value} }`}</code></td>
                    </tr>
                    <tr>
                      <td>{`borders.wBottom_${value}`}</td>
                      <td><code>{`{ borderBottomWidth: ${value} }`}</code></td>
                    </tr>
                    <tr>
                      <td>{`borders.wLeft_${value}`}</td>
                      <td><code>{`{ borderLeftWidth: ${value} }`}</code></td>
                    </tr>
                  </>
                ))
            }
            {
                radiusValues.map((value) => (
                  <>
                    <tr>
                      <td>{`borders.rounded_${value}`}</td>
                      <td><code>{`{ borderRadius: ${value} }`}</code></td>
                    </tr>
                    <tr>
                      <td>{`borders.roundedTop_${value}`}</td>
                      <td><code>{`{ borderRadius: ${value} }`}</code></td>
                    </tr>
                    <tr>
                      <td>{`borders.roundedBottom_${value}`}</td>
                      <td><code>{`{ borderRadius: ${value} }`}</code></td>
                    </tr>
                  </>
                ))
            }
            <tr>
              <td>{`borders.${colorName}`}</td>
              <td><code>{`{ borderColor: ${color} }`}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Borders;

```

### Core Architecture Module: `documentation/src/components/Features.tsx`
```
import React from 'react';

type FeatureItem = {
  title: string;
  icon: string
  color: string
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Easy to Use',
    icon: '👌',
    color: 'yellow',
    description: (
      <>
        A straightforward starter kit equipped with essential and widely recognized dependencies.
      </>
    ),
  },
  {
    title: 'Lightweight',
    icon: '🍃',
    color: 'green',
    description: (
      <>
        It includes just the bare minimum code required to create amazing apps.
      </>
    ),
  },
  {
    title: 'TypeScript or JavaScript?',
    icon: '🎛️',
    color: 'cyan',
    description: (
      <>
        We believe in giving you the freedom to select your preferred codebase language.
      </>
    ),
  },
  {
    title: 'Scalable',
    icon: '🧱',
    color: 'orange',
    description: (
      <>
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        Effortlessly expand your app's capabilities and scale it up as needed.
      </>
    ),
  },
];

const colors = {
  yellow: 'bg-yellow-300 shadow-xl shadow-yellow-500/50',
  green: 'bg-green-400 shadow-xl shadow-green-500/50',
  orange: 'bg-orange-400 shadow-xl shadow-orange-500/50',
  cyan: 'bg-cyan-400 shadow-xl shadow-cyan-500/50',
};

function Feature({
  title, icon, color, description,
}: FeatureItem) {
  const colorClass = colors[color];
  return (
    <div
      className="
        transition-all
        ease-in
        flex
        items-center
        bg-slate-100/40
        dark:bg-slate-800/40
        backdrop-blur-xl
        rounded-xl
        p-4
        hover:shadow-xl
     "
    >
      <div
        className={`
          flex
          items-center
          justify-center
          ${colorClass}
          border-sm
          w-[50px]
          h-[50px]
          min-w-[50px]
          min-h-[50px]
          mr-4
          rounded-xl
        `}
      >
        <p className="text-2xl">{icon}</p>
      </div>
      <div className="flex flex-col">
        <div className="font-bold mb-4">{title}</div>
        <p className="text-xs text-slate-500 dark:text-slate-300">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className="relative">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 sm:px-16 sm:pb-16 pt-0">
        {FeatureList.map((props, idx) => (
          <Feature key={`feature-${idx}`} {...props} />
        ))}
      </div>
    </section>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #523** (2026-04-13): **chore(deps): bump lodash from 4.17.23 to 4.18.1 in /template**
  *Symptoms*: Bumps [lodash](https://github.com/lodash/lodash) from 4.17.23 to 4.18.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/lodash/lodash/releases">lodash's releases</a>.</em></p> <blockquote> <h2>4.18.1</h2> <h2>Bugs</h2> <p>Fixes a <code>ReferenceError</code> issue in <code>lodash</code> <code>lodash-es</code> <code>lodash-amd</code> and <code>lodash.template</code> when using the <code>template</code> and <code>fromPairs</code> functions from the modular builds. See <a href="https://redirect.github.com/lodash/lodash/issues/6167#issuecomment-4165269769">lodash/lodash#6167</a></p> <p>These defects were related to how lodash distributions are built from the main branch using <a href="https://github.com/lodash-archive/lodash-cli">https://github.com/lodash-archive/lodash-cli</a>. When internal dependencies change inside lodash functions, equivalent updates need to be made to a mapping in the lodash-cli. (hey, it was ahead of its time once upon a time!). We know this, but we missed it in the last release. It's the kind of thing that passes in CI, but fails bc the build is not the same thing you tested.</p> <p>There is no diff on main for this, but you can see the diffs for each of the npm packages on their respective branches:</p> <ul> <li><code>lodash</code>: <a href="https://github.com/lodash/lodash/compare/4.18.0-npm...4.18.1-npm">https://github.com/lodash/lodash/compare/4.18.0-npm...4.18.1-npm</a></li> <li><code>lodash-es</code>: <a hr

- **Issue #522** (2026-04-13): **chore(deps): bump lodash from 4.17.23 to 4.18.1 in /documentation**
  *Symptoms*: Bumps [lodash](https://github.com/lodash/lodash) from 4.17.23 to 4.18.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/lodash/lodash/releases">lodash's releases</a>.</em></p> <blockquote> <h2>4.18.1</h2> <h2>Bugs</h2> <p>Fixes a <code>ReferenceError</code> issue in <code>lodash</code> <code>lodash-es</code> <code>lodash-amd</code> and <code>lodash.template</code> when using the <code>template</code> and <code>fromPairs</code> functions from the modular builds. See <a href="https://redirect.github.com/lodash/lodash/issues/6167#issuecomment-4165269769">lodash/lodash#6167</a></p> <p>These defects were related to how lodash distributions are built from the main branch using <a href="https://github.com/lodash-archive/lodash-cli">https://github.com/lodash-archive/lodash-cli</a>. When internal dependencies change inside lodash functions, equivalent updates need to be made to a mapping in the lodash-cli. (hey, it was ahead of its time once upon a time!). We know this, but we missed it in the last release. It's the kind of thing that passes in CI, but fails bc the build is not the same thing you tested.</p> <p>There is no diff on main for this, but you can see the diffs for each of the npm packages on their respective branches:</p> <ul> <li><code>lodash</code>: <a href="https://github.com/lodash/lodash/compare/4.18.0-npm...4.18.1-npm">https://github.com/lodash/lodash/compare/4.18.0-npm...4.18.1-npm</a></li> <li><code>lodash-es</code>: <a hr

- **Issue #521** (2026-04-13): **chore(deps): bump fast-xml-parser from 4.5.3 to 4.5.6 in /template**
  *Symptoms*: Bumps [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) from 4.5.3 to 4.5.6. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/releases">fast-xml-parser's releases</a>.</em></p> <blockquote> <h2>Summary update on all the previous releases from v4.2.4</h2> <ul> <li>Multiple minor fixes provided in the validator and parser</li> <li>v6 is added for experimental use.</li> <li>ignoreAttributes support function, and array of string or regex</li> <li>Add support for parsing HTML numeric entities</li> <li>v5 of the application is ESM module now. However, JS is also supported</li> </ul> <p><strong>Note</strong>: Release section in not updated frequently. Please check <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">CHANGELOG</a> or <a href="https://github.com/NaturalIntelligence/fast-xml-parser/tags">Tags</a> for latest release information.</p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/42fbb0bc95e753e03fe52cb0805a8774bba4bf28"><code>42fbb0b</code></a> update release info</li> <li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/805671cb6c19108b171b876cf3e8865f18cdb8fd"><code>805671c</code></a> increase expansion limit as many system need it</li> <li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/9a2cf0

- **Issue #520** (2026-04-13): **chore(deps): bump addressable from 2.8.8 to 2.9.0 in /template**
  *Symptoms*: Bumps [addressable](https://github.com/sporkmonger/addressable) from 2.8.8 to 2.9.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/sporkmonger/addressable/blob/main/CHANGELOG.md">addressable's changelog</a>.</em></p> <blockquote> <h2>Addressable 2.9.0 <!-- raw HTML omitted --></h2> <ul> <li>fixes ReDoS vulnerability in Addressable::Template#match (fixes incomplete remediation in 2.8.10)</li> </ul> <h2>Addressable 2.8.10 <!-- raw HTML omitted --></h2> <ul> <li>fixes ReDoS vulnerability in Addressable::Template#match</li> </ul> <h2>Addressable 2.8.9 <!-- raw HTML omitted --></h2> <ul> <li>Reduce gem size by excluding test files (<a href="https://redirect.github.com/sporkmonger/addressable/issues/569">#569</a>)</li> <li>No need for bundler as development dependency (<a href="https://redirect.github.com/sporkmonger/addressable/issues/571">#571</a>, <a href="https://github.com/sporkmonger/addressable/commit/5fc1d93">5fc1d93</a>)</li> <li>idna/pure: stop building the useless <code>COMPOSITION_TABLE</code> (removes the <code>Addressable::IDNA::COMPOSITION_TABLE</code> constant) (<a href="https://redirect.github.com/sporkmonger/addressable/issues/564">#564</a>)</li> </ul> <p><a href="https://redirect.github.com/sporkmonger/addressable/issues/569">#569</a>: <a href="https://redirect.github.com/sporkmonger/addressable/pull/569">sporkmonger/addressable#569</a> <a href="https://redirect.github.com/sporkmonger/addressable/issues/571">#571</a>: <a h

- **Issue #519** (2026-04-13): **chore(deps): bump node-forge from 1.3.2 to 1.4.0 in /documentation**
  *Symptoms*: Bumps [node-forge](https://github.com/digitalbazaar/forge) from 1.3.2 to 1.4.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/digitalbazaar/forge/blob/main/CHANGELOG.md">node-forge's changelog</a>.</em></p> <blockquote> <h2>1.4.0 - 2026-03-24</h2> <h3>Security</h3> <ul> <li><strong>HIGH</strong>: Denial of Service in <code>BigInteger.modInverse()</code> <ul> <li>A Denial of Service (DoS) vulnerability exists due to an infinite loop in the <code>BigInteger.modInverse()</code> function (inherited from the bundled jsbn library). When <code>modInverse()</code> is called with a zero value as input, the internal Extended Euclidean Algorithm enters an unreachable exit condition, causing the process to hang indefinitely and consume 100% CPU.</li> <li>Reported by Kr0emer.</li> <li>CVE ID: <a href="https://www.cve.org/CVERecord?id=CVE-2026-33891">CVE-2026-33891</a></li> <li>GHSA ID: <a href="https://github.com/digitalbazaar/forge/security/advisories/GHSA-5m6q-g25r-mvwx">GHSA-5gfm-wpxj-wjgq</a></li> </ul> </li> <li><strong>HIGH</strong>: Signature forgery in RSA-PKCS due to ASN.1 extra field. <ul> <li>RSASSA PKCS#1 v1.5 signature verification accepts forged signatures for low public exponent keys (e=3). Attackers can forge signatures by stuffing &quot;garbage&quot; bytes within the ASN.1 structure in order to construct a signature that passes verification, enabling Bleichenbacher style forgery. This issue is similar to CVE-2022-24771, but adds by

- **Issue #518** (2026-04-13): **chore(deps): bump yaml from 2.8.2 to 2.8.3 in /template**
  *Symptoms*: Bumps [yaml](https://github.com/eemeli/yaml) from 2.8.2 to 2.8.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/eemeli/yaml/releases">yaml's releases</a>.</em></p> <blockquote> <h2>v2.8.3</h2> <ul> <li>Add <code>trailingComma</code> ToString option for multiline flow formatting (<a href="https://redirect.github.com/eemeli/yaml/issues/670">#670</a>)</li> <li>Catch stack overflow during node composition (1e84ebb)</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/eemeli/yaml/commit/ce14587484822bffb0f7d31aefedcaf2dc0d0387"><code>ce14587</code></a> 2.8.3</li> <li><a href="https://github.com/eemeli/yaml/commit/1e84ebbea7ec35011a4c61bbb820a529ee4f359b"><code>1e84ebb</code></a> fix: Catch stack overflow during node composition</li> <li><a href="https://github.com/eemeli/yaml/commit/6b24090280eaaab5040112bba41ccef57f39c2d5"><code>6b24090</code></a> ci: Include Prettier check in lint action</li> <li><a href="https://github.com/eemeli/yaml/commit/9424dee38c85163fad53ac27533c7c4bdaf7495d"><code>9424dee</code></a> chore: Refresh lockfile</li> <li><a href="https://github.com/eemeli/yaml/commit/d1aca82bc15a4c261bdc58561d32189a5d3a45ef"><code>d1aca82</code></a> Add trailingComma ToString option for multiline flow formatting (<a href="https://redirect.github.com/eemeli/yaml/issues/670">#670</a>)</li> <li><a href="https://github.com/eemeli/yaml/commit/43215099f7fcdac422d778c15e70d83c691b0e

- **Issue #517** (2026-04-13): **chore(deps): bump picomatch from 2.3.1 to 2.3.2 in /documentation**
  *Symptoms*: Bumps [picomatch](https://github.com/micromatch/picomatch) from 2.3.1 to 2.3.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/micromatch/picomatch/releases">picomatch's releases</a>.</em></p> <blockquote> <h2>2.3.2</h2> <p>This is a security release fixing several security relevant issues.</p> <h2>What's Changed</h2> <ul> <li>fix: exception when glob pattern contains constructor by <a href="https://github.com/Jason3S"><code>@​Jason3S</code></a> in <a href="https://redirect.github.com/micromatch/picomatch/pull/144">micromatch/picomatch#144</a></li> <li>Fix for <a href="https://github.com/micromatch/picomatch/security/advisories/GHSA-c2c7-rcm5-vvqj">CVE-2026-33671</a></li> <li>Fix for <a href="https://github.com/micromatch/picomatch/security/advisories/GHSA-3v7f-55p6-f55p">CVE-2026-33672</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/micromatch/picomatch/compare/2.3.1...2.3.2">https://github.com/micromatch/picomatch/compare/2.3.1...2.3.2</a></p> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/micromatch/picomatch/blob/master/CHANGELOG.md">picomatch's changelog</a>.</em></p> <blockquote> <h1>Release history</h1> <p><strong>All notable changes to this project will be documented in this file.</strong></p> <p>The format is based on <a href="http://keepachangelog.com/en/1.0.0/">Keep a Changelog</a> and this project adheres to <a href="http://se

- **Issue #516** (2026-04-13): **chore(deps): bump activesupport from 7.2.3 to 7.2.3.1 in /template**
  *Symptoms*: Bumps [activesupport](https://github.com/rails/rails) from 7.2.3 to 7.2.3.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rails/rails/releases">activesupport's releases</a>.</em></p> <blockquote> <h2>7.2.3.1</h2> <h2>Active Support</h2> <ul> <li> <p>Reject scientific notation in NumberConverter</p> <p>[CVE-2026-33176]</p> <p><em>Jean Boussier</em></p> </li> <li> <p>Fix <code>SafeBuffer#%</code> to preserve unsafe status</p> <p>[CVE-2026-33170]</p> <p><em>Jean Boussier</em></p> </li> <li> <p>Improve performance of NumberToDelimitedConverter</p> <p>[CVE-2026-33169]</p> <p><em>Jean Boussier</em></p> </li> </ul> <h2>Active Model</h2> <ul> <li>No changes.</li> </ul> <h2>Active Record</h2> <ul> <li>No changes.</li> </ul> <h2>Action View</h2> <ul> <li> <p>Skip blank attribute names in tag helpers to avoid generating invalid HTML.</p> <p>[CVE-2026-33168]</p> <p><em>Mike Dalessio</em></p> </li> </ul> <h2>Action Pack</h2> <ul> <li>No changes.</li> </ul> <h2>Active Job</h2> <ul> <li>No changes.</li> </ul> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/rails/rails/commit/ba76fca032a66f3716ca8a661c9ddb006acaf885"><code>ba76fca</code></a> Preparing for 7.2.3.1 release</li> <li><a href="https://github.com/rails/rails/commit/8a379f43ea3e1c62fc7f6eabc1808ae9f74f726d"><code>8a379f4</code></a> Update changelog</li> <li><a href="https://github.com/rai

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

### Incident Patch 1: `a4cf0587` (2026-03-09)
**Commit Message**: fix: resolve Windows compatibility issues in compile-js plugin (#507)

* fix: resolve Windows compatibility issues in compile-js plugin

**File**: `template/plugins/compile-js/plugin.js` (modified, +19/-13)
```diff
@@ -1,6 +1,8 @@
 /* eslint-disable @typescript-eslint/no-require-imports */
 /* eslint-disable no-console */
 const { execSync, spawnSync } = require('node:child_process');
+const fs = require('node:fs');
+const path = require('node:path');
 
 const TYPESCRIPT_VERSION = '5.6.3';
 
@@ -9,17 +11,20 @@ function isYarnAvailable() {
     return !!(
       execSync('yarn --version', {
         stdio: [0, 'pipe', 'ignore'],
+        shell: true,
       }).toString() || ''
     ).trim();
   } catch {
     return null;
   }
 }
+
 function isNpmAvailable() {
   try {
     return !!(
       execSync('npm --version', {
         stdio: [0, 'pipe', 'ignore'],
+        shell: true,
       }).toString() || ''
     ).trim();
   } catch {
@@ -33,7 +38,6 @@ module.exports = {
       let packageManager = null;
       let addCmd = null;
 
-      // react-native cli prefer yarn so we follow the same logic
       if (isYarnAvailable()) {
         packageManager = 'yarn';
         addCmd = 'add';
@@ -56,7 +60,7 @@ module.exports = {
         const installTypeScriptCmd = spawnSync(
           packageManager,
           [addCmd, '-D', `typescript@${TYPESCRIPT_VERSION}`],
-          { stdio: 'inherit' },
+          { stdio: 'inherit', shell: true },
         );
         if (installTypeScriptCmd.error) {
           console.error(installTypeScriptCmd.error);
@@ -67,7 +71,7 @@ module.exports = {
         const transpileCmd = spawnSync(
           'npx',
           ['tsc', '--project', `plugins/compile-js/tsconfig.build.json`],
-          { stdio: 'inherit' },
+          { stdio: 'inherit', shell: true },
         );
         if (transpileCmd.error) {
           console.error(transpileCmd.error);
@@ -76,23 +80,25 @@ module.exports = {
 
         try {
           console.log('🖼️  Copying assets...');
-          execSync('cp -R src/theme/assets/images js/src/theme/assets/images');
-
+          fs.cpSync(
+            path.join('src', 'theme', 'assets', 'images'),
+            path.join('js', 'src', 'theme', 'assets', 'images'),
+            { recursive: true }
+          );
           console.log('♻️  Replacing source...');
-          execSync('rm -rf src', { stdio: 'pipe' });
-          execSync('cp -R js/src ./src', { stdio: 'pipe' });
-          execSync('rm -rf js', { stdio: 'pipe' });
+          fs.rmSync('src', { recursive: true, force: true });
+          fs.cpSync(path.join('js', 'src'), 'src', { recursive: true });
+          fs.rmSync('js', { recursive: true, force: true });
         } catch {
           console.error(
-            '🚨 Failed to copy assets or replace source. If you are using windows, please use git bash.',
+            '🚨 Failed to copy assets or replace source.',
           );
           process.exit(1);
         }
-
         console.log('🌀 Removing types ...');
-        execSync('rm -rf src/theme/types', { stdio: 'pipe' });
-        execSync('rm -f src/navigation/paths.js', { stdio: 'pipe' });
-        execSync('rm -f src/navigation/types.js', { stdio: 'pipe' });
+        fs.rmSync(path.join('src', 'theme', 'types'), { recursive: true, force: true });
+        fs.rmSync(path.join('src', 'navigation', 'paths.js'), { force: true });
+        fs.rmSync(path.join('src', 'navigation', 'types.js'), { force: true });
       }
 
       resolve();
```

---

### Incident Patch 2: `bba6bd8f` (2025-04-07)
**Commit Message**: fix: update lock



---

### Incident Patch 3: `11e6f9a6` (2025-04-07)
**Commit Message**: fix: resolve npm conflict

**File**: `template/eslint.config.mjs` (modified, +11/-0)
```diff
@@ -1,9 +1,11 @@
 import eslintConfigPrettier from 'eslint-config-prettier';
 import importPlugin from 'eslint-plugin-import';
+import jest from 'eslint-plugin-jest';
 import perfectionist from 'eslint-plugin-perfectionist';
 import react from 'eslint-plugin-react';
 import reactHooks from 'eslint-plugin-react-hooks';
 import reactRefresh from 'eslint-plugin-react-refresh';
+import testingLibrary from 'eslint-plugin-testing-library';
 import unicorn from 'eslint-plugin-unicorn';
 
 const ERROR = 2;
@@ -24,6 +26,7 @@ export default tseslint.config(
   react.configs.flat.all,
   react.configs.flat['jsx-runtime'],
   reactRefresh.configs.recommended,
+  testingLibrary.configs['flat/react'],
   eslintConfigPrettier, // last
   {
     languageOptions: {
@@ -55,6 +58,7 @@ export default tseslint.config(
       'react-hooks': reactHooks,
     },
     rules: {
+      ...reactHooks.configs.recommended.rules,
       '@typescript-eslint/consistent-type-definitions': [ERROR, 'type'],
       '@typescript-eslint/dot-notation': [ERROR, { allowKeywords: true }],
       '@typescript-eslint/no-empty-function': OFF,
@@ -142,6 +146,13 @@ export default tseslint.config(
       'unicorn/prefer-module': OFF,
     },
   },
+  {
+    files: ['**/*.spec.{js,ts,jsx,tsx}', '**/*.test.{js,ts,jsx,tsx}'],
+    ...jest.configs['flat/recommended'],
+    rules: {
+      ...jest.configs['flat/recommended'].rules,
+    },
+  },
   {
     ignores: ['plugins/**'],
   },
```

**File**: `template/jest.setup.js` (modified, +2/-2)
```diff
@@ -1,2 +1,2 @@
-import './__mocks__/libs';
-import './__mocks__/getAssetsContext';
+import './tests/__mocks__/libs';
+import './tests/__mocks__/getAssetsContext';
```

**File**: `template/package.json` (modified, +0/-1)
```diff
@@ -68,7 +68,6 @@
     "eslint-plugin-react-refresh": "^0.4.19",
     "eslint-plugin-testing-library": "^7.1.1",
     "eslint-plugin-unicorn": "^58.0.0",
-    "eslint-plugin-unused-imports": "^4.1.4",
     "jest": "^29.7.0",
     "prettier": "^3.5.3",
     "react-native-svg-transformer": "^1.5.0",
```

**File**: `template/src/components/atoms/Skeleton/Skeleton.test.tsx` (modified, +10/-11)
```diff
@@ -1,5 +1,5 @@
-import TestAppWrapper from '@/../__mocks__/TestAppWrapper';
-import { render } from '@testing-library/react-native';
+import TestAppWrapper from '@/../tests/TestAppWrapper';
+import { render, screen } from '@testing-library/react-native';
 import { Text } from 'react-native';
 
 import SkeletonLoader from './Skeleton';
@@ -12,32 +12,31 @@ describe('SkeletonLoader', () => {
   });
 
   it('renders children when not loading', () => {
-    const { getByText } = render(
+    render(
       <SkeletonLoader loading={false}>
         <Text>Loaded Content</Text>
       </SkeletonLoader>,
       {
         wrapper: TestAppWrapper,
       },
     );
-    expect(getByText('Loaded Content')).toBeTruthy();
+    expect(screen.getByText('Loaded Content')).toBeTruthy();
   });
 
   it('renders skeleton when loading', () => {
-    const { getByTestId } = render(<SkeletonLoader loading />, {
+    render(<SkeletonLoader loading />, {
       wrapper: TestAppWrapper,
     });
-    const skeleton = getByTestId('skeleton-loader');
+    const skeleton = screen.getByTestId('skeleton-loader');
     jest.advanceTimersByTime(WAIT);
     expect(skeleton).toBeTruthy();
   });
 
   it('applies correct height and width', () => {
-    const { getByTestId } = render(
-      <SkeletonLoader height={50} loading width={100} />,
-      { wrapper: TestAppWrapper },
-    );
-    const skeleton = getByTestId('skeleton-loader');
+    render(<SkeletonLoader height={50} loading width={100} />, {
+      wrapper: TestAppWrapper,
+    });
+    const skeleton = screen.getByTestId('skeleton-loader');
 
     const animatedStyle: {
       value: { opacity: number };
```

**File**: `template/src/reactotron.config.ts` (modified, +1/-13)
```diff
@@ -2,25 +2,13 @@ import type { ReactotronReactNative } from 'reactotron-react-native';
 
 import Reactotron from 'reactotron-react-native';
 import mmkvPlugin from 'reactotron-react-native-mmkv';
-import {
-  QueryClientManager,
-  reactotronReactQuery,
-} from 'reactotron-react-query';
 
 import config from '../app.json';
-import { queryClient, storage } from './App';
-
-const queryClientManager = new QueryClientManager({
-  queryClient,
-});
+import { storage } from './App';
 
 Reactotron.configure({
   name: config.name,
-  onDisconnect: () => {
-    queryClientManager.unsubscribe();
-  },
 })
   .useReactNative()
   .use(mmkvPlugin<ReactotronReactNative>({ storage }))
-  .use(reactotronReactQuery(queryClientManager))
   .connect();
```

---

### Incident Patch 4: `ca448fca` (2024-11-12)
**Commit Message**: fix eslint peerDependencies (#452)

* fix eslint peerDependencies

**File**: `template/eslint.config.mjs` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ export default [
     },
     rules: {
       // `import/default`, `import/namespace` and `import/no-duplicates` are slow.
+      '@typescript-eslint/no-var-requires': 0,
       curly: 2,
       'import/default': 0,
       'import/named': 0,
```

**File**: `template/package.json` (modified, +2/-2)
```diff
@@ -58,7 +58,7 @@
     "babel-plugin-module-resolver": "^5.0.0",
     "babel-plugin-root-import": "^6.6.0",
     "dotenv": "^16.3.1",
-    "eslint": "^9.12.0",
+    "eslint": "^8.56.0",
     "eslint-plugin-import": "^2.31.0",
     "eslint-plugin-jest": "^28.8.3",
     "eslint-plugin-no-instanceof": "^1.0.1",
@@ -76,7 +76,7 @@
     "reactotron-react-native-mmkv": "^0.2.7",
     "reactotron-react-query": "^1.0.4",
     "typescript": "5.6.3",
-    "typescript-eslint": "^8.8.1"
+    "typescript-eslint": "^7.1.1"
   },
   "engines": {
     "node": ">=18"
```

**File**: `template/yarn.lock` (modified, +119/-172)
```diff
@@ -1101,56 +1101,30 @@
   dependencies:
     eslint-visitor-keys "^3.4.3"
 
-"@eslint-community/regexpp@^4.10.0", "@eslint-community/regexpp@^4.12.1":
+"@eslint-community/regexpp@^4.10.0", "@eslint-community/regexpp@^4.6.1":
   version "4.12.1"
   resolved "https://registry.yarnpkg.com/@eslint-community/regexpp/-/regexpp-4.12.1.tgz#cfc6cffe39df390a3841cde2abccf92eaa7ae0e0"
   integrity sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ==
 
-"@eslint/config-array@^0.18.0":
-  version "0.18.0"
-  resolved "https://registry.yarnpkg.com/@eslint/config-array/-/config-array-0.18.0.tgz#37d8fe656e0d5e3dbaea7758ea56540867fd074d"
-  integrity sha512-fTxvnS1sRMu3+JjXwJG0j/i4RT9u4qJ+lqS/yCGap4lH4zZGzQ7tu+xZqQmcMZq5OBZDL4QRxQzRjkWcGt8IVw==
-  dependencies:
-    "@eslint/object-schema" "^2.1.4"
-    debug "^4.3.1"
-    minimatch "^3.1.2"
-
-"@eslint/core@^0.7.0":
-  version "0.7.0"
-  resolved "https://registry.yarnpkg.com/@eslint/core/-/core-0.7.0.tgz#a1bb4b6a4e742a5ff1894b7ee76fbf884ec72bd3"
-  integrity sha512-xp5Jirz5DyPYlPiKat8jaq0EmYvDXKKpzTbxXMpT9eqlRJkRKIz9AGMdlvYjih+im+QlhWrpvVjl8IPC/lHlUw==
-
-"@eslint/eslintrc@^3.1.0":
-  version "3.1.0"
-  resolved "https://registry.yarnpkg.com/@eslint/eslintrc/-/eslintrc-3.1.0.tgz#dbd3482bfd91efa663cbe7aa1f506839868207b6"
-  integrity sha512-4Bfj15dVJdoy3RfZmmo86RK1Fwzn6SstsvK9JS+BaVKqC6QQQQyXekNaC+g+LKNgkQ+2VhGAzm6hO40AhMR3zQ==
+"@eslint/eslintrc@^2.1.4":
+  version "2.1.4"
+  resolved "https://registry.yarnpkg.com/@eslint/eslintrc/-/eslintrc-2.1.4.tgz#388a269f0f25c1b6adc317b5a2c55714894c70ad"
+  integrity sha512-269Z39MS6wVJtsoUl10L60WdkhJVdPG24Q4eZTH3nnF6lpvSShEK3wQjDX9JRWAUPvPh7COouPpU9IrqaZFvtQ==
   dependencies:
     ajv "^6.12.4"
     debug "^4.3.2"
-    espree "^10.0.1"
-    globals "^14.0.0"
+    espree "^9.6.0"
+    globals "^13.19.0"
     ignore "^5.2.0"
     import-fresh "^3.2.1"
     js-yaml "^4.1.0"
     minimatch "^3.1.2"
     strip-json-comments "^3.1.1"
 
-"@eslint/js@9.14.0":
-  version "9.14.0"
-  resolved "https://registry.yarnpkg.com/@eslint/js/-/js-9.14.0.tgz#2347a871042ebd11a00fd8c2d3d56a265ee6857e"
-  integrity sha512-pFoEtFWCPyDOl+C6Ift+wC7Ro89otjigCf5vcuWqWgqNSQbRrpjSvdeE6ofLz4dHmyxD5f7gIdGT4+p36L6Twg==
-
-"@eslint/object-schema@^2.1.4":
-  version "2.1.4"
-  resolved "https://registry.yarnpkg.com/@eslint/object-schema/-/object-schema-2.1.4.tgz#9e69f8bb4031e11df79e03db09f9dbbae1740843"
-  integrity sha512-BsWiH1yFGjXXS2yvrf5LyuoSIIbPrGUWob917o+BTKuZ7qJdxX8aJLRxs1fS9n6r7vESrq1OUqb68dANcFXuQQ==
-
-"@eslint/plugin-kit@^0.2.0":
-  version "0.2.2"
-  resolved "https://registry.yarnpkg.com/@eslint/plugin-kit/-/plugin-kit-0.2.2.tgz#5eff371953bc13e3f4d88150e2c53959f64f74f6"
-  integrity sha512-CXtq5nR4Su+2I47WPOlWud98Y5Lv8Kyxp2ukhgFx/eW6Blm18VXJO5WuQylPugRo8nbluoi6GvvxBLqHcvqUUw==
-  dependencies:
-    levn "^0.4.1"
+"@eslint/js@8.57.1":
+  version "8.57.1"
+  resolved "https://registry.yarnpkg.com/@eslint/js/-/js-8.57.1.tgz#de633db3ec2ef6a3c89e2f19038063e8a122e2c2"
+  integrity sha512-d9zaMRSTIKDLhctzH12MtXvJKSSUhaHcjV+2Z+GK+EEY7XKpP5yR4x+N3TAcHTcu963nIr+TMcCb4DBCYX1z6Q==
 
 "@hapi/hoek@^9.0.0", "@hapi/hoek@^9.3.0":
   version "9.3.0"
@@ -1164,33 +1138,24 @@
   dependencies:
     "@hapi/hoek" "^9.0.0"
 
-"@humanfs/core@^0.19.1":
-  version "0.19.1"
-  resolved "https://registry.yarnpkg.com/@humanfs/core/-/core-0.19.1.tgz#17c55ca7d426733fe3c561906b8173c336b40a77"
-  integrity sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==
-
-"@humanfs/node@^0.16.6":
-  version "0.16.6"
-  resolved "https://registry.yarnpkg.com/@humanfs/node/-/node-0.16.6.tgz#ee2a10eaabd1131987bf0488fd9b820174cd765e"
-  integrity sha512-YuI2ZHQL78Q5HbhDiBA1X4LmYdXCKCMQIfw0pw7piHJwyREFebJUvrQN4cMssyES6x+vfUbx1CIpaQUKYdQZOw==
+"@humanwhocodes/config-array@^0.13.0":
+  version "0.13.0"
+  resolved "https://registry.yarnpkg.com/@humanwhocodes/config-array/-/config-array-0.13.0.tgz#fb907624df3256d04b9aa2df50d7aa97ec648748"
+
```

---

### Incident Patch 5: `d5d2571e` (2024-10-15)
**Commit Message**: Update bug_report.yml

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +4/-4)
```diff
@@ -33,15 +33,15 @@ body:
     attributes:
       label: Do you use TypeScript?
       options:
-        - Yes
-        - No
+        - "Yes"
+        - "No"
   - type: dropdown
     id: device
     attributes:
       label: On which OS this issue appear on?
       options:
-        - IOS
-        - Android
+        - "IOS"
+        - "Android"
   - type: input
     id: os
     attributes:
```

---

### Incident Patch 6: `b4e5be75` (2024-10-15)
**Commit Message**: Update bug_report.yml

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +4/-4)
```diff
@@ -33,15 +33,15 @@ body:
     attributes:
       label: Do you use TypeScript?
       options:
-        - label: "Yes"
-        - label: "No"
+        - Yes
+        - No
   - type: dropdown
     id: device
     attributes:
       label: On which OS this issue appear on?
       options:
-        - label: IOS
-        - label: Android
+        - IOS
+        - Android
   - type: input
     id: os
     attributes:
```

---

### Incident Patch 7: `79e3db3d` (2024-10-15)
**Commit Message**: Update bug_report.yml

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +2/-2)
```diff
@@ -28,14 +28,14 @@ body:
       description: What boilerplate version does this appear on?
     validations:
       required: true
-  - type: checkboxes
+  - type: dropdown
     id: typed
     attributes:
       label: Do you use TypeScript?
       options:
         - label: "Yes"
         - label: "No"
-  - type: checkboxes
+  - type: dropdown
     id: device
     attributes:
       label: On which OS this issue appear on?
```

---

### Incident Patch 8: `c794a049` (2024-10-10)
**Commit Message**: fix: fix react-native-screens installation for android

**File**: `template/android/app/src/main/java/com/boilerplate/MainActivity.kt` (modified, +5/-0)
```diff
@@ -1,5 +1,6 @@
 package com.boilerplate
 
+import android.os.Bundle;
 import com.facebook.react.ReactActivity
 import com.facebook.react.ReactActivityDelegate
 import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
@@ -19,4 +20,8 @@ class MainActivity : ReactActivity() {
    */
   override fun createReactActivityDelegate(): ReactActivityDelegate =
       DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
+
+  override fun onCreate(savedInstanceState: Bundle?) {
+    super.onCreate(null);
+  }
 }
```

**File**: `template/src/App.tsx` (modified, +10/-1)
```diff
@@ -9,7 +9,16 @@ import ApplicationNavigator from '@/navigations/Application';
 
 import '@/translations';
 
-export const queryClient = new QueryClient();
+export const queryClient = new QueryClient({
+  defaultOptions: {
+    queries: {
+      retry: false,
+    },
+    mutations: {
+      retry: false,
+    },
+  },
+});
 
 export const storage = new MMKV();
 
```

**File**: `template/src/components/templates/SafeScreen/SafeScreen.tsx` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ function SafeScreen({
       <StatusBar
         backgroundColor={navigationTheme.colors.background}
         barStyle={variant === 'dark' ? 'light-content' : 'dark-content'}
-        translucent
       />
       <ErrorBoundary fallback={<DefaultError onReset={onResetError} />}>
         {isError ? <DefaultError onReset={onResetError} /> : children}
```

**File**: `template/src/hooks/domain/user/useUser.ts` (modified, +5/-4)
```diff
@@ -18,12 +18,13 @@ const useFetchOneQuery = (currentId: User['id']) =>
 export const useUser = () => {
   const client = useQueryClient();
 
-  const invalidateFetchOneQuery = client.invalidateQueries({
-    queryKey: [UserQueryKey.fetchOne],
-  });
+  const invalidateQuery = (queryKeys: UserQueryKey[]) =>
+    client.invalidateQueries({
+      queryKey: queryKeys,
+    });
 
   return {
     useFetchOneQuery,
-    invalidateFetchOneQuery,
+    invalidateQuery,
   };
 };
```

**File**: `template/yarn.lock` (modified, +6/-6)
```diff
@@ -6591,15 +6591,15 @@ react-native-reanimated@^3.9.0-rc.1:
     convert-source-map "^2.0.0"
     invariant "^2.2.4"
 
-react-native-safe-area-context@^4.10.1:
+react-native-safe-area-context@^4.11.0:
   version "4.11.0"
-  resolved "https://registry.npmjs.org/react-native-safe-area-context/-/react-native-safe-area-context-4.11.0.tgz"
+  resolved "https://registry.yarnpkg.com/react-native-safe-area-context/-/react-native-safe-area-context-4.11.0.tgz#d45271363672dc1923ddb0ce5a6ad588e210c85d"
   integrity sha512-Bg7bozxEB+ZS+H3tVYs5yY1cvxNXgR6nRQwpSMkYR9IN5CbxohLnSprrOPG/ostTCd4F6iCk0c51pExEhifSKQ==
 
-react-native-screens@3.31.1:
-  version "3.31.1"
-  resolved "https://registry.npmjs.org/react-native-screens/-/react-native-screens-3.31.1.tgz"
-  integrity sha512-8fRW362pfZ9y4rS8KY5P3DFScrmwo/vu1RrRMMx0PNHbeC9TLq0Kw1ubD83591yz64gLNHFLTVkTJmWeWCXKtQ==
+react-native-screens@^3.34.0:
+  version "3.34.0"
+  resolved "https://registry.yarnpkg.com/react-native-screens/-/react-native-screens-3.34.0.tgz#1291a460c5bc59e2ba581b42d40fa9a58d3b1197"
+  integrity sha512-8ri3Pd9QcpfXnVckOe/Lnto+BXmSPHV/Q0RB0XW0gDKsCv5wi5k7ez7g1SzgiYHl29MSdiqgjH30zUyOOowOaw==
   dependencies:
     react-freeze "^1.0.0"
     warn-once "^0.1.0"
```

---

### Incident Patch 9: `7c39361a` (2024-10-09)
**Commit Message**: fix: Remove unnecessary conditional statement in boilerplate-release.yml

**File**: `.github/workflows/boilerplate-release.yml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ on:
 
 jobs:
   publish:
-    if: !github.event.release.prerelease
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
```

---

### Incident Patch 10: `7d462fe5` (2024-10-09)
**Commit Message**: fix: Update conditional statement in boilerplate-release.yml

**File**: `.github/workflows/boilerplate-release.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ on:
 
 jobs:
   publish:
-    if: "!github.event.release.prerelease"
+    if: !github.event.release.prerelease
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
```

#### Recent Merged Pull Requests:
- **PR #523** (2026-04-13): chore(deps): bump lodash from 4.17.23 to 4.18.1 in /template (@dependabot[bot])
- **PR #522** (2026-04-13): chore(deps): bump lodash from 4.17.23 to 4.18.1 in /documentation (@dependabot[bot])
- **PR #521** (2026-04-13): chore(deps): bump fast-xml-parser from 4.5.3 to 4.5.6 in /template (@dependabot[bot])
- **PR #520** (2026-04-13): chore(deps): bump addressable from 2.8.8 to 2.9.0 in /template (@dependabot[bot])
- **PR #519** (2026-04-13): chore(deps): bump node-forge from 1.3.2 to 1.4.0 in /documentation (@dependabot[bot])
- **PR #518** (2026-04-13): chore(deps): bump yaml from 2.8.2 to 2.8.3 in /template (@dependabot[bot])
- **PR #517** (2026-04-13): chore(deps): bump picomatch from 2.3.1 to 2.3.2 in /documentation (@dependabot[bot])
- **PR #516** (2026-04-13): chore(deps): bump activesupport from 7.2.3 to 7.2.3.1 in /template (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
