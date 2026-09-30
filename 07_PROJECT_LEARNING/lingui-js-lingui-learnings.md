# Forensic Learning Record (Deep Inspection): lingui/js-lingui

> **Canonical Artifact**: `07_PROJECT_LEARNING/lingui-js-lingui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lingui/js-lingui](https://github.com/lingui/js-lingui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:30:54.786Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lingui/js-lingui`
- **Description**: 🌍 📖 A readable, automated, and optimized (2 kb) internationalization for JavaScript
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5902 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.js`
```
import { defineConfig } from "eslint/config"
import pluginJs from "@eslint/js"
import { configs as typescriptEslintConfigs } from "typescript-eslint"
import importPlugin from "eslint-plugin-import"

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/fixtures/**",
      "**/locale/**",
      "**/test/**/expected/**",
      "**/test/**/expected-*/**",
      "**/test/**/actual/**",
      "**/loader/test/**",
      "website/src/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    extends: [
      pluginJs.configs.recommended,
      ...typescriptEslintConfigs.recommended,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    settings: {
      "import/resolver": {
        typescript: {
          noWarnOnMultipleProjects: true,
          project: ["./tsconfig.json", "./packages/*/tsconfig.json"],
        },
        node: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          allowShortCircuit: true,
          allowTernary: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "**/test/**",
            "**/*.test.{ts,tsx}",
            "**/*.tst.{ts,tsx}",
            "**/*.config.ts",
            "**/*.config.js",
            "scripts/**",
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.tst.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: {
      "import/no-extraneous-dependencies": "off",
    },
  },
  {
    files: ["**/next-env.d.ts"],
    rules: {
      "import/no-unresolved": "off",
    },
  },
)

```

### Core Architecture Module: `examples/js/babel.config.js`
```
module.exports = {
  presets: ["@babel/env"],
  plugins: ["@lingui/babel-plugin-lingui-macro"],
}

```

### Core Architecture Module: `examples/js/lingui.config.js`
```
/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  locales: ["en", "cs"],
  
  catalogs: [
    {
      path: "./src/locale/{locale}/messages",
      include: ["./src"],
    },
  ],
  sourceLocale: "en",
}

```

### Core Architecture Module: `examples/js/src/ids.js`
```
import { i18n } from "@lingui/core"
import { t, plural, defineMessage } from "@lingui/core/macro"

i18n.load({
  en: require("./locale/en/messages").messages,
  cs: require("./locale/cs/messages").messages,
})

export const common = {
  yes: defineMessage({
    id: "common.yes",
    comment: "Agreement",
    message: "Yes",
  }),
  no: defineMessage({
    id: "common.no",
    comment: "Disagreement",
    message: "No",
  }),
}

export function getStatic() {
  return i18n._(
    defineMessage({
      id: "static",
      comment: "Title of example",
      message: "@lingui/core example",
    })
  )
}

export function getVariables(name) {
  return i18n._(
    defineMessage({
      id: "variables",
      message: t`Hello ${name}`,
    })
  )
}

export function getPlural(value) {
  return i18n._(
    defineMessage({
      id: "plural",
      message: t`There are ${plural(value, {
        one: "# bottle",
        other: "# bottles",
      })} hanging on the wall`,
    })
  )
}

export function getLazy() {
  const yes = i18n._(common.yes)
  const no = i18n._(common.no)
  return i18n._(
    defineMessage({
      id: "lazy",
      message: t`Do you want to proceed? ${yes}/${no}`,
    })
  )
}

function main() {
  const header = getStatic()

  console.log(header)
  console.log("*".repeat(header.length))
  console.log()

  console.log(getVariables("Joe"))
  console.log(getPlural(1))
  console.log(getPlural(100))
  console.log()

  console.log(getLazy())
  console.log()
}

if (require.main === module) {
  i18n.activate("en")
  main()

  console.log()
  i18n.activate("cs")
  main()
}

```

### Core Architecture Module: `examples/js/src/locale/cs/messages.js`
```
/*eslint-disable*/module.exports={messages:JSON.parse("{\"static\":\"Ukázka @lingui/core\",\"zziTz4\":\"Ukázka @lingui/core\",\"lazy\":[\"Chcete pokračovat? \",[\"yes\"],\"/\",[\"no\"]],\"+GYOc0\":[\"Chcete pokračovat? \",[\"yes\"],\"/\",[\"no\"]],\"variables\":[\"Ahoj \",[\"name\"]],\"OVaF9k\":[\"Ahoj \",[\"name\"]],\"common.no\":\"Ne\",\"1UzENP\":\"Ne\",\"plural\":[[\"value\",\"plural\",{\"one\":[\"#\",\" láhev\"],\"few\":[\"#\",\" láhve\"],\"other\":[\"#\",\" láhví\"]}],\" visí na stěně\"],\"KE/K99\":[[\"value\",\"plural\",{\"one\":[\"#\",\" láhev\"],\"few\":[\"#\",\" láhve\"],\"other\":[\"#\",\" láhví\"]}],\" visí na stěně\"],\"common.yes\":\"Ano\",\"l75CjT\":\"Ano\"}")};
```

### Core Architecture Module: `examples/js/src/locale/en/messages.js`
```
/*eslint-disable*/module.exports={messages:JSON.parse("{\"static\":\"@lingui/core example\",\"zziTz4\":\"@lingui/core example\",\"lazy\":[\"Do you want to proceed? \",[\"yes\"],\"/\",[\"no\"]],\"+GYOc0\":[\"Do you want to proceed? \",[\"yes\"],\"/\",[\"no\"]],\"variables\":[\"Hello \",[\"name\"]],\"OVaF9k\":[\"Hello \",[\"name\"]],\"common.no\":\"No\",\"1UzENP\":\"No\",\"plural\":[\"There are \",[\"value\",\"plural\",{\"one\":[\"#\",\" bottle\"],\"other\":[\"#\",\" bottles\"]}],\" hanging on the wall\"],\"KE/K99\":[\"There are \",[\"value\",\"plural\",{\"one\":[\"#\",\" bottle\"],\"other\":[\"#\",\" bottles\"]}],\" hanging on the wall\"],\"common.yes\":\"Yes\",\"l75CjT\":\"Yes\"}")};
```

### Core Architecture Module: `examples/js/src/messages.js`
```
import { i18n } from "@lingui/core"
import { t, plural, defineMessage } from "@lingui/core/macro"

i18n.load({
  en: require("./locale/en/messages").messages,
  cs: require("./locale/cs/messages").messages,
})

/**
 * Example: Lazy messages - common phrases are only defined, but not translated.
 */
export const common = {
  yes: defineMessage({
    comment: "Agreement",
    message: "Yes",
  }),
  no: defineMessage({
    comment: "Disagreement",
    message: "No",
  }),
}

/**
 * Example: Static messages - add comment beginning with `i18n:` to add description.
 */
export function getStatic() {
  return i18n._(
    defineMessage({
      comment: "Title of example",
      message: "@lingui/core example",
    })
  )
}

/**
 * Example: Interpolation - variables are passed to messages using template literals
 */
export function getVariables(name) {
  return t`Hello ${name}`
}

/**
 * Example: Plurals - Template literals can contain formats, like `plural`
 */
export function getPlural(value) {
  return t`There are ${plural(value, {
    one: "# bottle",
    other: "# bottles",
  })} hanging on the wall`
}

/**
 * Example: Lazy translation - Message definitions are passed to `i18n._` to get
 * translation.
 */
export function getLazy() {
  const yes = i18n._(common.yes)
  const no = i18n._(common.no)
  return t`Do you want to proceed? ${yes}/${no}`
}

function main(locale) {
  const header = getStatic()

  console.log(header)
  console.log("*".repeat(header.length))
  console.log()

  console.log(getVariables("Joe"))
  console.log(getPlural(1))
  console.log(getPlural(100))
  console.log()

  console.log(getLazy())
  console.log()
}

if (require.main === module) {
  i18n.activate("en")
  main()

  console.log()
  i18n.activate("cs")
  main()
}

```

### Core Architecture Module: `examples/nextjs-babel/lingui.config.ts`
```
import {defineConfig} from "@lingui/cli"
import nextConfig from "./next.config.js"

export default defineConfig({
  locales: nextConfig.i18n.locales as string[],
  pseudoLocale: "pseudo",
  sourceLocale: nextConfig.i18n.defaultLocale,
  fallbackLocales: {
    default: "en",
  },
  catalogs: [
    {
      path: "src/locales/{locale}",
      include: ["src/"],
    },
  ],
})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2681** (2026-09-28): **lingui compile crashes when NODE_ENV=test**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  In our repo, we run lingui compile right before we run tests, to make sure we have the latest compiled messages while running our tests.  `NODE_ENV=test lingui compile && jest`  There's an issue with the cli if you are running it while having a `NODE_ENV === "test"` because of resolveWorkerFile in https://github.com/lingui/js-lingui/blame/main/packages/cli/src/api/typedPool.ts#L25 that picks the worker file based on NODE_ENV:  ```typescript process.env.NODE_ENV === "test" ? `${basePath}.jiti.js` : `${basePath}.prod.js` ```  The *.jiti.js wrappers files are not found in dist build.  This used to work in v5  ### Reproduction Link  https://stackblitz.com/github/MPeloquin/lingui-node-env-test-repro?file=package.json  ### Reproduction Steps  In stackblitz https://stackblitz.com/github/MPeloquin/lingui-node-env-test-repro?file=package.json  ``` npm install npm run compile:test-env ```  ``` Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../node_modules/@lingui/cli/dist/workers/compileWorkerWrapper.jiti.js' ```   ```npm run compile:test-env-no-workers``` works (no pool). ```npx lingui compile``` without `NODE_ENV` works.  The same applies to extract (and extract-experimen

- **Issue #2676** (2026-09-21): **Macro accepts JSX placeholder names containing `-` or `.`, but the React runtime renders them as literal text**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  The macro and the React runtime disagree on which placeholder names are valid, and the mismatch fails silently.  `tokenizeElement` in `packages/babel-plugin-lingui-macro/src/macroJsx.ts` validates names against:  ```js /^[a-zA-Z_]([\w.-]*\w)?$/ ```  and its error message states that names "may contain `.-` in between".  `formatElements` in `packages/react/src/format.tsx` substitutes the components back in using:  ```js const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/ ```  The runtime pattern is narrower than the one the macro enforces. A name containing `-`, `.` or `_` passes validation, extracts and compiles without a warning, and then fails to match at render time — so the tag is emitted as literal text.  Kebab-case is a natural way to name a link placeholder, which makes this easy to hit:  | `_t` value | macro accepts | runtime matches | | --- | --- | --- | | `termsLink` | yes | yes | | `terms-link` | yes | **no** | | `terms_link` | yes | **no** | | `terms.link` | yes | **no** |   ### Reproduction Link  _No response_  ### Reproduction Steps  With `macro: { jsxPlaceholderAttribute: "_t" }` in the lingui config:  ```jsx <Trans>   I agree to the <a 
  **Post-Mortem & Fix Analysis**:
  > Taking this — the macro and React runtime disagree on placeholder names.  `tokenizeElement` already accepts names matching `/^[a-zA-Z_]([\w.-]*\w)?$/` (so `terms-link`, `terms_link`, `terms.link` extract/compile), but `formatElements` `tagRe` is `[a-zA-Z0-9]+` and leaves those tags as literal text at render time.  No open Fixes PR on #2676. I'll widen the runtime regex to the documented macro charset (preferred over a build-time reject: a silent render bug is worse) and add `formatElements` regression tests. Extraction message IDs stay unchanged.
  > Opened https://github.com/lingui/js-lingui/pull/2680 against `main` (**Fixes #2676**).  Approach: widen `formatElements` `tagRe` to the documented macro charset so `terms-link` / `terms_link` / `terms.link` (and existing camelCase / numeric names) are substituted at render time. Extraction IDs are unchanged.

- **Issue #2671** (2026-09-23): **"Translation" moved from start to end of json object in 2nd extract**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  <img width="728" height="574" alt="Image" src="https://github.com/user-attachments/assets/70c2a1c8-5427-4390-b6a8-23e6b70c83ad" />  <img width="1769" height="381" alt="Image" src="https://github.com/user-attachments/assets/66033cd8-102a-41d4-994a-c6ce284ff77d" />  Since the first extract adds the translation to the front then it gets moved on merge there are PRs that show a json diff of this line being moved. Just add it to the end from the start  ### Reproduction Link  _No response_  ### Reproduction Steps  1. Create a new string 2. Run extract and merge PR 3. Pull latest and add different strings 4. Notice the json diffs will include the "translation" line being moved from the top to the bottom  ### Expected Behavior  "Translation" line is added to the bottom on every extract run  ### Macro Support  Babel with @lingui/babel-plugin-lingui-macro  ### Lingui Version  6.4.0  ### Babel / SWC Version  _No response_  ### Node Version  _No response_  ### Framework  _No response_
  **Post-Mortem & Fix Analysis**:
  > @KBaldwin2 thanks for reporting this, confirmed. The catalog merge builds a brand-new entry with translation first, but rebuilds an existing one with translation last, and the JSON formatter writes whatever order it gets. It's a regression from 5.2.0, before that both paths agreed. The fix is small: build new entries the same way, with translation at the end, as you suggested.

- **Issue #2662** (2026-09-11): **`orderByMessageId` never got the #1808 fix, and custom `orderBy` functions throw**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  Hello!  I found two related gaps in the catalog sorting code, both still present on `main`. 1. `orderByMessage` was fixed to use a hardcoded collator in #1808 to stop catalogs from sorting differently depending on the machine's locale, but that fix was never applied to `orderByMessageId`. 2. #2394 added support for passing a custom `orderBy` function, but seems like `makeConfig.ts`'s `jest-validate` schema was never updated to allow it. `exampleConfig.orderBy` is still just `"message"` (a bare string), so `validate(config, configValidation)` rejects a function.   The only way around these right now is by patching. Patches are small, so I am happy to open a PR if that lightens the load for the maintainers. 😄  ### Reproduction Link  _No response_  ### Reproduction Steps  ```ts // lingui.config.ts import { defineConfig } from "@lingui/cli" import { formatter } from "@lingui/format-json"  export default defineConfig({   locales: ["en", "es"],   sourceLocale: "en",   format: formatter({ style: "minimal" }),   orderBy: "messageId",   catalogs: [{ path: "src/locales/{locale}/messages", include: ["src"] }], }) ```  - Run `lingui extract` with different locales. The same sour
  **Post-Mortem & Fix Analysis**:
  > I can work on this if you have not already started a fix. I traced the sorting regression to the switch from code-point comparison to localeCompare, and the function validation problem to the example-derived orderBy schema. My plan is to restore deterministic code-point ordering, accept Function as a valid orderBy option, and add focused regression tests for both behaviors. Please let me know if you are already preparing a PR so we do not duplicate work.
  > @carloitaben thanks for reporting this! #1808 only touched `orderByMessage`, and #2394 carried the bare `localeCompare` over in the refactor. The validation gap is exactly as you describe - the schema in `makeConfig.ts` was never updated, so passing a function in the config has never actually worked.
  > I see #2665 now covers this issue, so I will hold my local branch to avoid creating a duplicate PR. Thanks for picking it up.

- **Issue #2643** (2026-08-31): **`t` with `selectOrdinal` doesn't capture values on build**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  When using `t` macro together with `selectOrdinal`, the emitted JavaScript does not pass in the required values to `_`.  Swapping `t` with `msg` (then t'ing that) works.  Using `_` directly also works fine.  t with selectOrdinal works fine with Dev/HMR build and serve, this only impacts production build   ### Reproduction Link  Can see what it was and what works in this PR implementing work around: https://github.com/FFXIVVenues/ffxiv-venues-web2/pull/63   ### Reproduction Steps  1. Take the [given example](https://lingui.dev/ref/macro#selectordinal) raw from the docs ```js const count = 28; const message = t({     id: "my.custom.id",     comment: "My Comment",     message: selectOrdinal(count, {         one: "#st",         two: "#nd",         few: "#rd",         other: "#th",     }), }); console.log(message);   // NaNth ```  2. `lingui extract` -> `lingui compile` -> `npx vite build` -> `npx serve`  3. The output will be:  `const p=n._({id:"my.custom.id"});console.log(p);`  and console.log gives `NaNth`  ### Expected Behavior  Should emit `n._({id:"my.custom.id", values: { count }});` ? and print `28th` in console.  ### Macro Support  SWC with @lingui/swc-plugin  ###
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to take a look at this issue and, if it's still available, work on a fix. I'll first reproduce the production-build behavior and investigate how the SWC macro transformation handles selectOrdinal values. If I can identify the root cause, I'd be happy to submit a PR with a regression test.
  > Update: I investigated this on a local reproduction using Lingui 6.6.0, @lingui/swc-plugin 6.6.0, Vite 7.3.0, and the production build pipeline.  The current SWC transformation preserves values: { count } for the object-form t({ message: selectOrdinal(...) }) case, including the descriptorFields: "id-only" configuration.  I also ran the Vite production build and inspected the generated bundle. The final production output still contains:  _{id:"my.custom.id",values:{count:A1}}  so I couldn't reproduce the reported loss of values with the current stack.  One notable difference is that the issue reports Lingui 6.6.0 but Babel/SWC version 6.5.1. This may indicate a version-specific or environment-specific issue. I don't have a source-level fix to propose at this point. 
  > I can confirm, i could not reproduce this in the SWC plugin tests using this snippet:   ```rust to!(     case_github,     LinguiOptions {         descriptor_fields: DescriptorFields::IdOnly,         ..Default::default()     },     // language=js     r#"  import { selectOrdinal } from '@lingui/core/macro'; import { useLingui } from '@lingui/react/macro';  function Component() {   const {t} = useLingui();   const count = 28;    const message = t({     id: '#my.custom.id',     comment: "My Comment",     message: selectOrdinal(count, {         one: "st",         two: "sd",         few: "rd",         other: "th",     }),   }); }      "# ```  This produces:   ```js          23 │+import { useLingui as $_useLingui } from "@lingui/react";                                                                                                                                                                                               24 │+function Component() {                                           

- **Issue #2631** (2026-07-28): **jsxPlaceholderDefaults fails when passing the same tag twice in the same message**
  *Symptoms*: ### Description  Using the same tag with `jsxPlaceholderDefaults` twice results in an error. Likely a collision?  Error: ``` SyntaxError: Multiple distinct JSX elements with the same placeholder name (`link`). Differentiate them by setting `macro.jsxPlaceholderAttribute` in the lingui config and then adding the attribute to your JSX elements (e.g. `<element _t="newName" />`). ```  Like, I do understand `jsxPlaceholderAttribute` works as an alternative, and I did use it to work around this problem, but I feel like it's not the right solution to error out.  ### Verifications  - [x] I've checked [the docs](https://lingui.dev) and this isn't covered there. - [x] I've searched existing issues on [GitHub](https://github.com/lingui/js-lingui/issues).  ### Reproduction Steps  Code  ```tsx import { Trans } from "@lingui/react/macro"  export default function App() {    return <Trans><a>hi</a><a>bye</a></Trans> } ```  Config  ```ts {   // ....   macro: {     jsxPlaceholderDefaults: { a: "link" },   } } ```  ### Expected Behavior  I expected the reuslt to be:  ```html <link>hi</link><link_1>bye</link_1> ```  or  ```html <link_0>hi</link_0><link_1>bye</link_1> ```  ### Macro Support  Babel with babel-macro-plugin  ### Lingui Version  6.5.0  ### Babel Version  7.29.7  ### Framework  React, Vite
  **Post-Mortem & Fix Analysis**:
  > That is expected behavior. You need to specify name for collided elements manually, no magic like `_0` automatically applied. 
  > I understand that this is the implemented behavior. However, I am hoping you could reconsider for the following reasons:  - It is not obvious from the documentation this is intended, and _why_ it is.  - It essentially waters down the value of `jsxPlaceholderDefaults` as a simple "compile-time check" to enforce that we always add a custom `jsxPlaceholderAttribute`.  ---  For example, in the following example  ```tsx <Trans>   Click here to learn the <a>Privacy Policy</a> and here to read the <a>Terms of Serivce</a> </Trans> ```  This fails: _ 💥 Multiple distinct JSX elements with the same placeholder name (`link`)_  So the user has to do the following (assume `jsxPlaceholderAttribute: 'ph'`)  ```tsx <Trans>   Click here to learn the <a>Privacy Policy</a> and here to read the <a ph="link_1">Terms of Serivce</a> </Trans> ```  ---  In this case, I can see the argument that `link_1` aint helpful for translators. But all in all, I think it just means that `jsxPlaceholderDefaults` real value
  > (i.e. maybe rather than being "this is a bug", should I file a "improve docs for `jsxPlaceholderDefaults`"?)

- **Issue #2628** (2026-09-22): **Cannot find package '@babel/types' when run messages:extract**
  *Symptoms*: ### Description ``` npm notice run messages:extract npm notice run lingui extract node:internal/modules/package_json_reader:301   throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);         ^  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@babel/types' imported from D:\Documents\xxxx\xxxx\node_modules\@lingui\babel-plugin-lingui-macro\dist\shared\babel-plugin-lingui-macro.BYtM9YP7.mjs     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)     at packageResolve (node:internal/modules/esm/resolve:768:81)     at moduleResolve (node:internal/modules/esm/resolve:859:18)     at defaultResolve (node:internal/modules/esm/resolve:992:11)     at #cachedDefaultResolve (node:internal/modules/esm/loader:691:20)     at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:708:38)     at ModuleLoader.resolveSync (node:internal/modules/esm/loader:740:52)     at #resolve (node:internal/modules/esm/loader:673:17)     at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:593:35)     at ModuleJob.syncLink (node:internal/modules/esm/module_job:163:33) {   code: 'ERR_MODULE_NOT_FOUND' }  Node.js v24.16.0 ```  ### Verifications  - [x] I've checked [the docs](https://lingui.dev) and this isn't covered there. - [x] I've searched existing issues on [GitHub](https://github.com/lingui/js-lingui/issues).  ### Reproduction Steps  After upgrading from version 6.5.0 to 6.6.0, running `npm run messages:extract` results the e
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this!  This is a regression from #2623. `@lingui/babel-plugin-lingui-macro` has a top-level `import * as t from "@babel/types"` in its compiled output, so `@babel/types` must be resolvable from the macro package the moment it loads. #2623 changed it from a direct dependency to an optional peer dependency - and npm doesn't install optional peers at all, so nothing guarantees it's there anymore.  Most installs still work by luck: `@lingui/cli`'s own copy of `@babel/types` usually gets hoisted to the root `node_modules`. In your tree it ended up nested (e.g. under `node_modules/@lingui/cli/node_modules/`), where the macro can't see it. It wasn't caught by CI because Yarn workspace hoisting always keeps a copy resolvable in the monorepo.  Workaround until a fix is out: install it directly in your project - `npm i -D @babel/types`.  @youdie006 could you please take a look? 
  > I actually refrained from proposing a PR with a babel update to v8 because i haven't found any official instructions how to make a plugin working with both v7 and v8 versions. All possible options i'm seeing requiring to choose one or another.   There is also a way to not using `@babel/types`, babel is injecting it to the plugin - but that would require to pass this object to every function in the plugin (now it's available globally), hence a big change.   I think the best option for now would be to revert this change. 
  > Should use `import type` instead of `import` to import types from `@babel/types`.

- **Issue #2584** (2026-06-29): **Plural React macro do not work properly**
  *Symptoms*: ### Description  Trying to follow the documentation [here](https://lingui.dev/ref/macro#plural-1).  This exact usage of the `<Plural>` macro causes a "Unsupported macro usage" error at runtime. Extracting locales work as expected.  ### Verifications  - [x] I've checked [the docs](https://lingui.dev) and this isn't covered there. - [x] I've searched existing issues on [GitHub](https://github.com/lingui/js-lingui/issues).  ### Reproduction Steps  **Here is a full reproduction on a minimal project:** https://github.com/AFCMS/vite-lingui-test/tree/plural_bug  `App.tsx`: ```tsx import { Plural } from "@lingui/react/macro"  export default function App() {    return <Plural value={tt} one="One item" other="Many items" /> } ```  `lingui.config.ts`: ```ts import { defineConfig } from "@lingui/cli";  export default defineConfig({   sourceLocale: "en",   locales: ["en", "fr"],   catalogs: [     {       path: "<rootDir>/src/locales/{locale}/messages",       include: ["src"],       exclude: ["**/node_modules/**"],     },   ], }); ```  `vite.config.ts`: ```ts import { defineConfig } from "vite"; import react, { reactCompilerPreset } from "@vitejs/plugin-react"; import babel from "@rolldown/plugin-babel"; import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";  // https://vite.dev/config/ export default defineConfig({   plugins: [     react(),     lingui(),     babel({ presets: [linguiTransformerBabelPreset(), reactCompilerPreset()] }),   ], });  ```  Causes a "Unsupport
  **Post-Mortem & Fix Analysis**:
  > > Here is a full reproduction on a minimal project: https://github.com/AFCMS/vite-lingui-test/tree/plural_bug  The repository is probably private, i could not open it.   It seems, that this is caused by some incopatible version of something. Probably babel. Would like to check the repro first to make a correct investigation. 
  > @timofei-iatsenko I am really really sorry I completely forgot to make the repository public 😓  Should be fixed now.
  > @AFCMS i tested it now and it builds and runs fine on my end. Try to delete and reinstall `node_modules`, you probably has some corrupted state in here  <img width="976" height="254" alt="Image" src="https://github.com/user-attachments/assets/660e4dfa-ca19-49a5-8b1b-677cd942132c" />

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

### Incident Patch 1: `cac98805` (2026-09-28)
**Commit Message**: fix(cli): resolve workers from caller source (#2682)

**File**: `packages/cli/src/api/typedPool.test.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { existsSync } from "node:fs"
+import { Tinypool } from "tinypool"
+import { afterEach, describe, expect, test, vi } from "vitest"
+import { createWorkerPool } from "./typedPool.js"
+
+vi.mock("tinypool")
+
+afterEach(() => {
+  vi.clearAllMocks()
+  vi.unstubAllEnvs()
+})
+
+const workerPaths = [
+  "../workers/compileWorkerWrapper",
+  "../workers/extractWorkerWrapper",
+  "../extract-experimental/workers/extractWorkerWrapper",
+  "../workers/missingWorkerWrapper",
+] as const
+
+describe.each(["test", "production", "development", undefined])(
+  "worker resolution with NODE_ENV=%s",
+  (environment) => {
+    test.each(workerPaths)(
+      "uses shipped JavaScript for %s from a built module",
+      (workerPath) => {
+        vi.stubEnv("NODE_ENV", environment)
+        const baseUrl = new URL(
+          "../../dist/api/workerPools.js",
+          import.meta.url,
+        )
+
+        createWorkerPool(workerPath, baseUrl.href, 1)
+
+        expect(Tinypool).toHaveBeenCalledExactlyOnceWith({
+          filename: new URL(`${workerPath}.prod.js`, baseUrl).href,
+          minThreads: 1,
+          maxThreads: 1,
+        })
+      },
+    )
+
+    test.each(workerPaths)(
+      "uses an existing source harness for %s from a TypeScript module",
+      (workerPath) => {
+        vi.stubEnv("NODE_ENV", environment)
+        const baseUrl = new URL("./workerPools.ts", import.meta.url)
+        const wrapperUrl = new URL(`${workerPath}.jiti.js`, baseUrl)
+
+        createWorkerPool(workerPath, baseUrl.href, 1)
+
+        expect(Tinypool).toHaveBeenCalledExactlyOnceWith({
+          filename: wrapperUrl.href,
+          minThreads: 1,
+          maxThreads: 1,
+        })
+        expect(existsSync(wrapperUrl)).toBe(true)
+      },
+    )
+  },
+)
```

**File**: `packages/cli/src/api/typedPool.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export type WorkerPool<TFn extends (...args: never[]) => unknown> = TypedPool<
 
 const resolveWorkerFile = (basePath: string, baseUrl: string) =>
   new URL(
-    process.env.NODE_ENV === "test"
+    new URL(baseUrl).pathname.endsWith(".ts")
       ? `${basePath}.jiti.js`
       : `${basePath}.prod.js`,
     baseUrl,
```

---

### Incident Patch 2: `f97cb921` (2026-09-28)
**Commit Message**: fix(solid): match macro-accepted placeholder names in formatElements (#2687)

**File**: `packages/solid/src/format.test.tsx` (modified, +36/-0)
```diff
@@ -82,6 +82,42 @@ describe("formatElements", function () {
     ).toEqual('<a href="/about">About</a>')
   })
 
+  it("should format paired elements whose names use the macro charset", function () {
+    const link = (props: { children?: JSX.Element }) => (
+      <a href="/terms">{props.children}</a>
+    )
+
+    for (const name of ["terms-link", "terms_link", "terms.link"]) {
+      expect(
+        html(() =>
+          formatElements(`<${name}>Terms</${name}>`, { [name]: link }),
+        ),
+      ).toEqual('<a href="/terms">Terms</a>')
+    }
+
+    expect(
+      html(() =>
+        formatElements(
+          "I agree to the <terms-link>Terms</terms-link> and the <privacy-link>Privacy Policy</privacy-link>.",
+          {
+            "terms-link": link,
+            "privacy-link": (props) => <a href="/privacy">{props.children}</a>,
+          },
+        ),
+      ),
+    ).toEqual(
+      'I agree to the <a href="/terms">Terms</a> and the <a href="/privacy">Privacy Policy</a>.',
+    )
+  })
+
+  it("should format unpaired elements whose names use the macro charset", function () {
+    for (const name of ["terms-link", "terms_link", "terms.link"]) {
+      expect(
+        html(() => formatElements(`text<${name}/>`, { [name]: () => <br /> })),
+      ).toEqual("text<br>")
+    }
+  })
+
   it("should preserve nested named element props", function () {
     expect(
       html(() =>
```

**File**: `packages/solid/src/format.tsx` (modified, +3/-1)
```diff
@@ -5,7 +5,9 @@ import {
 } from "solid-js"
 
 // match <tag>paired</tag> and <tag/> unpaired tags
-const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/
+// Names use the same charset the macro accepts, so `_`, `.` and `-` are valid in between.
+const tagRe =
+  /<([a-zA-Z0-9_](?:[\w.-]*\w)?)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_](?:[\w.-]*\w)?)\/>/
 
 /**
  * `formatElements` - parse string and return tree of Solid elements
```

---

### Incident Patch 3: `202a5f05` (2026-09-23)
**Commit Message**: fix(cli): add translation as the last key of a new message (#2677)

**File**: `packages/cli/src/api/catalog/mergeCatalog.test.ts` (modified, +42/-0)
```diff
@@ -188,4 +188,46 @@ describe("mergeCatalog", () => {
       }
     `)
   })
+
+  describe("key order", () => {
+    // key order is what a formatter writes out, so it is what shows up in the
+    // catalog diff
+    const serializedKeys = (entry: unknown) =>
+      Object.keys(JSON.parse(JSON.stringify(entry)))
+
+    it("should add translation as the last key of a new message", () => {
+      const result = mergeCatalog(
+        undefined,
+        nextCatalog,
+        false,
+        defaultMergeOptions,
+      )
+
+      expect(serializedKeys(result["custom.id"]).at(-1)).toBe("translation")
+      expect(
+        serializedKeys(result["Message with <0>auto-generated</0> ID"]).at(-1),
+      ).toBe("translation")
+    })
+
+    it("should keep the key order of a message stable between extract runs", () => {
+      // first extract, both messages are new
+      const firstRun = mergeCatalog(
+        undefined,
+        nextCatalog,
+        false,
+        defaultMergeOptions,
+      )
+      // second extract, the very same messages are merged from the catalog
+      const secondRun = mergeCatalog(
+        firstRun,
+        nextCatalog,
+        false,
+        defaultMergeOptions,
+      )
+
+      expect(JSON.stringify(secondRun, null, 2)).toEqual(
+        JSON.stringify(firstRun, null, 2),
+      )
+    })
+  })
 })
```

**File**: `packages/cli/src/api/catalog/mergeCatalog.ts` (modified, +3/-1)
```diff
@@ -31,12 +31,14 @@ export function mergeCatalog(
   }
 
   // Initialize new catalog with new keys
+  // `translation` is added last, so a message keeps the same key order once it
+  // is merged from the previous catalog on the next extract
   const newMessages: CatalogType = Object.fromEntries(
     newKeys.map((key) => [
       key,
       {
-        translation: forSourceLocale ? nextCatalog[key]!.message || key : "",
         ...nextCatalog[key],
+        translation: forSourceLocale ? nextCatalog[key]!.message || key : "",
       },
     ]),
   )
```

---

### Incident Patch 4: `db5f57c8` (2026-09-22)
**Commit Message**: fix(babel-plugin-lingui-macro): restore `@babel/types` as a runtime dependency (#2634)

**File**: `packages/babel-plugin-lingui-macro/package.json` (modified, +2/-6)
```diff
@@ -55,19 +55,16 @@
     "node": ">=22.19.0"
   },
   "dependencies": {
+    "@babel/types": "^7.20.7",
     "@lingui/conf": "workspace:*",
     "@lingui/message-utils": "workspace:*"
   },
   "peerDependencies": {
-    "@babel/core": "^7.20.12 || ^8.0.0",
-    "@babel/types": "^7.20.7 || ^8.0.0"
+    "@babel/core": "^7.20.12 || ^8.0.0"
   },
   "peerDependenciesMeta": {
     "@babel/core": {
       "optional": true
-    },
-    "@babel/types": {
-      "optional": true
     }
   },
   "devDependencies": {
@@ -76,7 +73,6 @@
     "@babel/plugin-syntax-jsx": "^7.28.6",
     "@babel/preset-typescript": "^7.18.6",
     "@babel/traverse": "^7.20.12",
-    "@babel/types": "^7.29.0",
     "babel-plugin-macros": "^3.1.0",
     "babel-plugin-react-compiler": "^1.0.0",
     "prettier": "3.9.6",
```

**File**: `yarn.lock` (modified, +1/-4)
```diff
@@ -1502,7 +1502,7 @@ __metadata:
     "@babel/plugin-syntax-jsx": "npm:^7.28.6"
     "@babel/preset-typescript": "npm:^7.18.6"
     "@babel/traverse": "npm:^7.20.12"
-    "@babel/types": "npm:^7.29.0"
+    "@babel/types": "npm:^7.20.7"
     "@lingui/conf": "workspace:*"
     "@lingui/message-utils": "workspace:*"
     babel-plugin-macros: "npm:^3.1.0"
@@ -1513,12 +1513,9 @@ __metadata:
     vitest: "catalog:"
   peerDependencies:
     "@babel/core": ^7.20.12 || ^8.0.0
-    "@babel/types": ^7.20.7 || ^8.0.0
   peerDependenciesMeta:
     "@babel/core":
       optional: true
-    "@babel/types":
-      optional: true
   languageName: unknown
   linkType: soft
 
```

---

### Incident Patch 5: `74089ab0` (2026-09-21)
**Commit Message**: fix(react): substitute macro-accepted placeholder names in formatElements (#2680)

**File**: `packages/react/src/format.test.tsx` (modified, +67/-0)
```diff
@@ -54,6 +54,73 @@ describe("formatElements", function () {
     ).toEqual('<a href="/about">About</a>')
   })
 
+  it("should format paired placeholders whose names use the macro charset", function () {
+    // camelCase already works; hyphen / underscore / dot must as well (#2676)
+    expect(
+      html(
+        formatElements("<termsLink>Terms</termsLink>", {
+          termsLink: <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements("<terms-link>Terms</terms-link>", {
+          "terms-link": <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements("<terms_link>Terms</terms_link>", {
+          terms_link: <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements("<terms.link>Terms</terms.link>", {
+          "terms.link": <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements(
+          "I agree to the <terms-link>Terms of Service</terms-link> and the <privacy-link>Privacy Policy</privacy-link>.",
+          {
+            "terms-link": <a href="/terms" />,
+            "privacy-link": <a href="/privacy" />,
+          },
+        ),
+      ),
+    ).toEqual(
+      'I agree to the <a href="/terms">Terms of Service</a> and the <a href="/privacy">Privacy Policy</a>.',
+    )
+  })
+
+  it("should format unpaired placeholders whose names use the macro charset", function () {
+    expect(
+      html(formatElements("text<termsLink/>", { termsLink: <br /> })),
+    ).toEqual("text<br>")
+
+    expect(
+      html(formatElements("text<terms-link/>", { "terms-link": <br /> })),
+    ).toEqual("text<br>")
+
+    expect(
+      html(formatElements("text<terms_link/>", { terms_link: <br /> })),
+    ).toEqual("text<br>")
+
+    expect(
+      html(formatElements("text<terms.link/>", { "terms.link": <br /> })),
+    ).toEqual("text<br>")
+  })
+
   it("should preserve nested named element props", function () {
     expect(
       html(
```

**File**: `packages/react/src/format.tsx` (modified, +4/-1)
```diff
@@ -1,7 +1,10 @@
 import { cloneElement } from "react"
 
 // match <tag>paired</tag> and <tag/> unpaired tags
-const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/
+// Names: auto-generated digits, or the macro charset from tokenizeElement —
+// /^[a-zA-Z_]([\w.-]*\w)?$/ — so `_`, `.` and `-` are valid in between.
+const tagRe =
+  /<([a-zA-Z0-9_](?:[\w.-]*\w)?)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_](?:[\w.-]*\w)?)\/>/
 
 // For HTML, certain tags should omit their close tag. We keep a whitelist for
 // those special-case tags.
```

---

### Incident Patch 6: `fd416f9e` (2026-09-17)
**Commit Message**: revert: "feat(cli): add support for `BatchExtractor` (#2562)" (#2673)

**File**: `packages/cli/src/api/catalog.test.ts` (modified, +6/-23)
```diff
@@ -15,27 +15,10 @@ import {
   defaultMergeOptions,
   makeCatalog,
 } from "../tests.js"
-import { AllCatalogsType, ExtractedCatalogType } from "./types.js"
-import {
-  extractFromFiles,
-  mergeExtractedMessage,
-} from "./catalog/extractFromFiles.js"
+import { AllCatalogsType } from "./types.js"
+import { extractFromFiles } from "./catalog/extractFromFiles.js"
 import { FormatterWrapper, getFormat } from "./formats/index.js"
 import { createBabelExtractor } from "./extractors/babel.js"
-import type { ExtractedMessage, LinguiConfigNormalized } from "@lingui/conf"
-
-async function extractMessages(
-  paths: string[],
-  config: LinguiConfigNormalized,
-) {
-  const messages: ExtractedCatalogType = {}
-  const success = await extractFromFiles(
-    paths,
-    (msg: ExtractedMessage) => mergeExtractedMessage(msg, messages, config),
-    config,
-  )
-  return success ? messages : undefined
-}
 
 export const fixture = (...dirs: string[]) =>
   (
@@ -226,7 +209,7 @@ describe("Catalog", () => {
 
   describe("collect", () => {
     it("should support JSX and Typescript", async () => {
-      const messages = await extractMessages(
+      const messages = await extractFromFiles(
         [
           fixture("collect-typescript-jsx/jsx-in-js.js"),
           fixture("collect-typescript-jsx/jsx-syntax.jsx"),
@@ -240,15 +223,15 @@ describe("Catalog", () => {
     })
 
     it("should sort placeholders to keep them stable between runs", async () => {
-      const runA = await extractMessages(
+      const runA = await extractFromFiles(
         [
           fixture("collect-placeholders-sorting/a.ts"),
           fixture("collect-placeholders-sorting/b.ts"),
         ],
         mockConfig(),
       )
 
-      const runB = await extractMessages(
+      const runB = await extractFromFiles(
         [
           fixture("collect-placeholders-sorting/b.ts"),
           fixture("collect-placeholders-sorting/a.ts"),
@@ -271,7 +254,7 @@ describe("Catalog", () => {
     })
 
     it("should support experimental typescript decorators under a flag", async () => {
-      const messages = await extractMessages(
+      const messages = await extractFromFiles(
         [fixture("collect-typescript-jsx/tsx-experimental-decorators.tsx")],
         mockConfig({
           extractors: [
```

**File**: `packages/cli/src/api/catalog.ts` (modified, +7/-91)
```diff
@@ -4,8 +4,6 @@ import { globSync } from "node:fs"
 import normalize from "normalize-path"
 
 import {
-  ExtractedMessage,
-  ExtractorType,
   LinguiConfigNormalized,
   MessageType,
   OrderBy,
@@ -22,7 +20,6 @@ import { mergeCatalog } from "./catalog/mergeCatalog.js"
 import {
   extractFromFiles,
   extractFromFilesWithWorkerPool,
-  mergeExtractedMessage,
 } from "./catalog/extractFromFiles.js"
 import {
   isDirectory,
@@ -33,10 +30,6 @@ import {
 } from "./utils.js"
 import { AllCatalogsType, CatalogType, ExtractedCatalogType } from "./types.js"
 import { ExtractWorkerPool } from "./workerPools.js"
-import {
-  getConfiguredExtractors,
-  isBatchExtractor,
-} from "./extractors/index.js"
 
 const LOCALE = "{locale}"
 const LOCALE_SUFFIX_RE = /\{locale\}.*$/
@@ -185,92 +178,15 @@ export class Catalog {
       paths = paths.filter((path: string) => regex.test(normalize(path)))
     }
 
-    const messages: ExtractedCatalogType = {}
-    const onMessageExtracted = (next: ExtractedMessage) => {
-      mergeExtractedMessage(next, messages, this.config)
-    }
-
-    const extractors = getConfiguredExtractors(this.config)
-
-    // Optimized hot path: if there are no batch extractors defined, skip the more complex logic.
-    if (!extractors.some(isBatchExtractor)) {
-      const success = options.workerPool
-        ? await extractFromFilesWithWorkerPool(
-            options.workerPool,
-            paths,
-            onMessageExtracted,
-            this.config,
-          )
-        : await extractFromFiles(paths, onMessageExtracted, this.config)
-
-      return success ? messages : undefined
-    }
-
-    return await this.collectWithExtractors(
-      extractors,
-      paths,
-      onMessageExtracted,
-      messages,
-      options,
-    )
-  }
-
-  private async collectWithExtractors(
-    extractors: ExtractorType[],
-    paths: string[],
-    onMessageExtracted: (msg: ExtractedMessage) => void,
-    messages: ExtractedCatalogType,
-    options: { workerPool?: ExtractWorkerPool },
-  ): Promise<ExtractedCatalogType | undefined> {
-    let remaining = paths
-    let catalogSuccess = true
-
-    for (const extractor of extractors) {
-      if (remaining.length === 0) break
-
-      const matched: string[] = []
-      const unmatched: string[] = []
-
-      for (const f of remaining) {
-        if (extractor.match(f)) {
-          matched.push(f)
-        } else {
-          unmatched.push(f)
-        }
-      }
-
-      if (matched.length === 0) continue
-
-      remaining = unmatched
-
-      if (isBatchExtractor(extractor)) {
-        try {
-          await extractor.extractFromFiles(matched, onMessageExtracted, {
-            linguiConfig: this.config,
-          })
-        } catch (e) {
-          console.error(`Extractor failed: ${(e as Error).message}`)
-          console.error((e as Error).stack)
-          catalogSuccess = false
-        }
-      } else {
-        const success = options.workerPool
-          ? await extractFromFilesWithWorkerPool(
-              options.workerPool,
-              matched,
-              onMessageExtracted,
-              this.config,
-            )
-          : await extractFromFiles(matched, onMessageExtracted, this.config)
-
-        if (!success) {
-          catalogSuccess = false
-        }
-      }
+    if (options.workerPool) {
+      return await extractFromFilesWithWorkerPool(
+        options.workerPool,
+        paths,
+        this.config,
+      )
     }
 
-    if (!catalogSuccess) return undefined
-    return messages
+    return await extractFromFiles(paths, this.config)
   }
 
   /*
```

**File**: `packages/cli/src/api/catalog/collectWithBatchExtractor.test.ts` (removed, +0/-316)
```diff
@@ -1,316 +0,0 @@
-import path from "path"
-import type {
-  Experimental__BatchExtractorType,
-  ExtractedMessage,
-  ExtractorType,
-  PerFileExtractorType,
-} from "@lingui/conf"
-import { makeConfig } from "@lingui/conf"
-import { describe, expect, it, vi } from "vitest"
-import { Catalog } from "../catalog.js"
-import { getFormat } from "../formats/index.js"
-import { mockConsole } from "@lingui/test-utils"
-
-const fixturesDir = path.resolve(import.meta.dirname, "../fixtures")
-const collectDir = path.join(fixturesDir, "collect")
-
-const matchAll = () => true
-
-async function makeCatalogWithExtractors(extractors: ExtractorType[]) {
-  const config = makeConfig(
-    {
-      rootDir: fixturesDir,
-      locales: ["en"],
-      sourceLocale: "en",
-      extractors,
-    },
-    { skipValidation: true },
-  )
-
-  return new Catalog(
-    {
-      name: "messages",
-      path: "locales/{locale}/messages",
-      include: [collectDir],
-      exclude: [],
-      format: await getFormat(config.format, config.sourceLocale),
-    },
-    config,
-  )
-}
-
-describe("Catalog.collect with batch extractor", () => {
-  it("passes matched paths to extractFromFiles", async () => {
-    const extractFromFilesFn: Experimental__BatchExtractorType["extractFromFiles"] =
-      vi.fn(async () => {})
-
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: extractFromFilesFn,
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-    await catalog.collect()
-
-    const mock = vi.mocked(extractFromFilesFn)
-    expect(mock).toHaveBeenCalledTimes(1)
-    const filenames = mock.mock.calls[0]![0]
-    expect(filenames.length).toBeGreaterThan(0)
-    expect(filenames.every((f) => path.isAbsolute(f))).toBe(true)
-  })
-
-  it("merges extracted messages into catalog", async () => {
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: async (
-        filenames: string[],
-        onMessageExtracted: (msg: ExtractedMessage) => void,
-      ) => {
-        onMessageExtracted({
-          id: "msg.hello",
-          message: "Hello",
-          origin: [filenames[0]!, 1],
-        })
-        onMessageExtracted({
-          id: "msg.world",
-          message: "World",
-          origin: [filenames[0]!, 5],
-        })
-      },
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-    const result = await catalog.collect()
-
-    expect(result).toBeDefined()
-    expect(result!["msg.hello"]?.message).toBe("Hello")
-    expect(result!["msg.world"]?.message).toBe("World")
-  })
-
-  it("should throw an error when duplicate identifier with different defaults found", async () => {
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: async (
-        filenames: string[],
-        onMessageExtracted: (msg: ExtractedMessage) => void,
-      ) => {
-        onMessageExtracted({
-          id: "custom.id",
-          message: "Hello",
-          origin: [filenames[0]!, 1],
-        })
-        onMessageExtracted({
-          id: "custom.id",
-          message: "World",
-          origin: [filenames[0]!, 5],
-        })
-      },
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-
-    expect.assertions(2)
-    await mockConsole(async (console) => {
-      const result = await catalog.collect()
-
-      expect(result).toBeUndefined()
-
-      expect(console.error).toHaveBeenCalledWith(
-        expect.stringContaining(
-          `Encountered different default translations for message`,
-        ),
-      )
-    })
-  })
-
-  it("returns undefined on extractor error", async () => {
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: async () => {
-        throw new Error("native crash")
-      },
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])

```

**File**: `packages/cli/src/api/catalog/extractFromFiles.test.ts` (modified, +2/-11)
```diff
@@ -74,19 +74,10 @@ describe("extractFromFilesWithWorkerPool", () => {
 
     const pool = { run, destroy: vi.fn() } as unknown as ExtractWorkerPool
 
-    const messages: Record<string, any> = {}
-
-    await extractFromFilesWithWorkerPool(
-      pool,
-      paths,
-      (next) => {
-        mergeExtractedMessage(next, messages, config)
-      },
-      config,
-    )
+    const catalog = await extractFromFilesWithWorkerPool(pool, paths, config)
 
     expect(run).toHaveBeenCalledTimes(2)
-    expect(messages.one?.origin).toEqual([
+    expect(catalog?.one?.origin).toEqual([
       ["a.ts", 1],
       ["z.ts", 1],
     ])
```

**File**: `packages/cli/src/api/catalog/extractFromFiles.ts` (modified, +23/-11)
```diff
@@ -4,7 +4,7 @@ import path from "path"
 import extract from "../extractors/index.js"
 import { ExtractedCatalogType, MessageOrigin } from "../types.js"
 import { prettyOrigin } from "../utils.js"
-import type { ExtractWorkerPool } from "../workerPools.js"
+import { ExtractWorkerPool } from "../workerPools.js"
 
 function compareOrigins(a: MessageOrigin, b: MessageOrigin): number {
   const byPath = a[0].localeCompare(b[0])
@@ -50,17 +50,26 @@ function mergePlaceholders(
 
 export async function extractFromFiles(
   paths: string[],
-  onMessageExtracted: (msg: ExtractedMessage) => void,
   config: LinguiConfigNormalized,
-): Promise<boolean> {
+) {
+  const messages: ExtractedCatalogType = {}
+
   let catalogSuccess = true
 
   for (const filename of paths) {
-    const fileSuccess = await extract(filename, onMessageExtracted, config)
+    const fileSuccess = await extract(
+      filename,
+      (next: ExtractedMessage) => {
+        mergeExtractedMessage(next, messages, config)
+      },
+      config,
+    )
     catalogSuccess &&= fileSuccess
   }
 
-  return catalogSuccess
+  if (!catalogSuccess) return undefined
+
+  return messages
 }
 
 export function mergeExtractedMessage(
@@ -113,9 +122,12 @@ export function mergeExtractedMessage(
 export async function extractFromFilesWithWorkerPool(
   workerPool: ExtractWorkerPool,
   paths: string[],
-  onMessageExtracted: (msg: ExtractedMessage) => void,
   config: LinguiConfigNormalized,
-): Promise<boolean> {
+): Promise<ExtractedCatalogType | undefined> {
+  const messages: ExtractedCatalogType = {}
+
+  let catalogSuccess = true
+
   const resolvedConfigPath = config.resolvedConfigPath
 
   if (!resolvedConfigPath) {
@@ -124,8 +136,6 @@ export async function extractFromFilesWithWorkerPool(
     )
   }
 
-  let catalogSuccess = true
-
   const results = await Promise.all(
     paths.map((filename) => workerPool.run(filename, resolvedConfigPath)),
   )
@@ -135,10 +145,12 @@ export async function extractFromFilesWithWorkerPool(
       catalogSuccess = false
     } else {
       result.messages.forEach((message) => {
-        onMessageExtracted(message)
+        mergeExtractedMessage(message, messages, config)
       })
     }
   })
 
-  return catalogSuccess
+  if (!catalogSuccess) return undefined
+
+  return messages
 }
```

---

### Incident Patch 7: `279de2dc` (2026-09-14)
**Commit Message**: fix(cli): export all types that are part of the public API (#2668)

**File**: `packages/cli/src/index.ts` (modified, +2/-1)
```diff
@@ -1 +1,2 @@
-export { defineConfig } from "@lingui/conf"
+// Re-export both the `defineConfig` function and the types it depends on
+export { defineConfig, type LinguiConfig } from "@lingui/conf"
```

---

### Incident Patch 8: `8cff1f0a` (2026-09-11)
**Commit Message**: fix: make orderBy handling consistent (#2665)

**File**: `packages/cli/src/api/catalog.test.ts` (modified, +19/-0)
```diff
@@ -668,6 +668,25 @@ describe("order", () => {
     expect(Object.keys(orderedCatalogs)).toMatchSnapshot()
   })
 
+  it("should not depend on String.localeCompare when ordering message ids", () => {
+    const localeCompare = vi
+      .spyOn(String.prototype, "localeCompare")
+      .mockImplementation(() => {
+        throw new Error("host-locale-dependent comparison")
+      })
+    const catalog = {
+      z: makeNextMessage({ translation: "Z" }),
+      a: makeNextMessage({ translation: "A" }),
+    }
+
+    try {
+      expect(Object.keys(order("messageId", catalog))).toEqual(["a", "z"])
+      expect(localeCompare).not.toHaveBeenCalled()
+    } finally {
+      localeCompare.mockRestore()
+    }
+  })
+
   it("should order messages by origin", () => {
     const catalog = {
       LabelB: makeNextMessage({
```

**File**: `packages/cli/src/api/catalog.ts` (modified, +5/-5)
```diff
@@ -458,12 +458,16 @@ export function order<T extends CatalogType>(by: OrderBy, catalog: T): T {
       return acc
     }, {} as T)
 }
+// hardcoded en-US locale to have consistent sorting
+// @see https://github.com/lingui/js-lingui/pull/1808
+const collator = new Intl.Collator("en-US")
+
 /**
  * Object keys are in the same order as they were created
  * https://stackoverflow.com/a/31102605/1535540
  */
 const orderByMessageId: OrderByFn = (a, b) => {
-  return a.messageId.localeCompare(b.messageId)
+  return collator.compare(a.messageId, b.messageId)
 }
 
 const orderByOrigin: OrderByFn = (a, b) => {
@@ -516,10 +520,6 @@ export async function writeCompiled(
   return filename
 }
 
-// hardcoded en-US locale to have consistent sorting
-// @see https://github.com/lingui/js-lingui/pull/1808
-const collator = new Intl.Collator("en-US")
-
 export const orderByMessage: OrderByFn = (a, b) => {
   const aMsg = a.entry.message || ""
   const bMsg = b.entry.message || ""
```

**File**: `packages/conf/src/index.test.ts` (modified, +11/-0)
```diff
@@ -60,6 +60,17 @@ describe("@lingui/conf", () => {
     })
   })
 
+  it("should accept a custom `orderBy` function", () => {
+    mockConsole((console) => {
+      const orderBy = () => 0
+      const config = makeConfig({ locales: ["en"], orderBy })
+
+      expect(config.orderBy).toBe(orderBy)
+      expect(console.warn).not.toBeCalled()
+      expect(console.error).not.toBeCalled()
+    })
+  })
+
   it("should validate `format` and throw error if old string format passed (remove in v7)", () => {
     expect(() =>
       makeConfig({
```

**File**: `packages/conf/src/makeConfig.ts` (modified, +1/-0)
```diff
@@ -112,6 +112,7 @@ export const defaultConfig = {
 
 export const exampleConfig = {
   ...defaultConfig,
+  orderBy: multipleValidOptions("message", Function),
   macro: {
     ...defaultConfig.macro,
     idPrefixLeader: ".",
```

---

### Incident Patch 9: `6dfa30d6` (2026-09-04)
**Commit Message**: fix(core): look up select choices and message ids as own properties (#2664)

**File**: `packages/core/src/i18n.test.ts` (modified, +13/-0)
```diff
@@ -427,6 +427,19 @@ describe("I18n", () => {
     expect(handler).toHaveBeenCalledTimes(2)
   })
 
+  it("._ should treat an id inherited from Object.prototype as missing", () => {
+    const i18n = setupI18n({
+      locale: "en",
+      messages: { en: { exists: "exists" } },
+    })
+
+    const handler = vi.fn()
+    i18n.on("missing", handler)
+    expect(i18n._("constructor")).toEqual("constructor")
+    expect(i18n._("toString")).toEqual("toString")
+    expect(handler).toHaveBeenCalledTimes(2)
+  })
+
   it("._ should emit missing event for undefined id", () => {
     const i18n = setupI18n({
       locale: "en",
```

**File**: `packages/core/src/i18n.ts` (modified, +7/-1)
```diff
@@ -236,7 +236,13 @@ export class I18n extends EventEmitter<Events> {
       id = id.id
     }
 
-    const messageForId = this.messages[id]
+    // Own-property check so an id like "constructor" or "toString" is
+    // reported as missing instead of resolving to a member inherited from
+    // Object.prototype.
+    const messages = this.messages
+    const messageForId = Object.prototype.hasOwnProperty.call(messages, id)
+      ? messages[id]
+      : undefined
     const messageMissing = messageForId === undefined
 
     // replace missing messages with custom message for debugging
```

**File**: `packages/core/src/interpolate.test.ts` (modified, +7/-0)
```diff
@@ -142,6 +142,13 @@ describe("interpolate", () => {
     expect(cache2({ value: "n/a" })).toEqual("They")
   })
 
+  it("should use the other choice for a value inherited from Object.prototype", () => {
+    const cache = prepare("{value, select, female {She} other {They}}")
+    expect(cache({ value: "constructor" })).toEqual("They")
+    expect(cache({ value: "toString" })).toEqual("They")
+    expect(cache({ value: "hasOwnProperty" })).toEqual("They")
+  })
+
   describe("Custom format", () => {
     const testVector = [
       ["en", undefined, "0.1", "10%", "20%", "€0.10", "€1.00"],
```

**File**: `packages/core/src/interpolate.ts` (modified, +6/-1)
```diff
@@ -73,7 +73,12 @@ const getDefaultFormats = (
 }
 
 const selectFormatter = (value: string, rules: Record<string, any>) =>
-  rules[value] ?? rules.other
+  // Own-property check so a runtime value like "constructor" or "toString"
+  // falls back to the `other` branch instead of resolving to a member
+  // inherited from Object.prototype.
+  (Object.prototype.hasOwnProperty.call(rules, value)
+    ? rules[value]
+    : undefined) ?? rules.other
 
 /**
  * @param translation compiled message
```

---

### Incident Patch 10: `9b7986c7` (2026-09-02)
**Commit Message**: fix(core): prevent prototype pollution via __proto__ locale key in i18n.load (#2658)

**File**: `packages/core/src/i18n.test.ts` (modified, +32/-0)
```diff
@@ -55,6 +55,38 @@ describe("I18n", () => {
       i18n.activate("fr")
       expect(i18n.messages).toEqual(frMessages)
     })
+
+    describe("prototype pollution", () => {
+      afterEach(() => {
+        delete (Object.prototype as any).polluted
+      })
+
+      it("should not pollute Object.prototype via __proto__ locale key", () => {
+        const i18n = setupI18n()
+        i18n.load(JSON.parse('{"__proto__":{"polluted":"yes"}}'))
+        expect(({} as any).polluted).toBeUndefined()
+      })
+
+      it("should not pollute Object.prototype via __proto__ string locale", () => {
+        const i18n = setupI18n()
+        i18n.load("__proto__", { polluted: "yes" })
+        expect(({} as any).polluted).toBeUndefined()
+      })
+
+      it("should not pollute Object.prototype via __proto__ message key", () => {
+        const i18n = setupI18n()
+        i18n.load("en", JSON.parse('{"__proto__":"yes"}'))
+        expect(({} as any).polluted).toBeUndefined()
+      })
+
+      it("should still load and merge a normal locale", () => {
+        const i18n = setupI18n()
+        i18n.load({ en: { Hello: "Hello" } })
+        i18n.load({ en: { World: "World" } })
+        i18n.activate("en")
+        expect(i18n.messages).toEqual({ Hello: "Hello", World: "World" })
+      })
+    })
   })
 
   describe("I18n.activate", () => {
```

**File**: `packages/core/src/i18n.ts` (modified, +8/-1)
```diff
@@ -151,7 +151,14 @@ export class I18n extends EventEmitter<Events> {
     return this
   }
   private _load(locale: Locale, messages: Messages) {
-    const maybeMessages = this._messages[locale]
+    // Own-property check so a "__proto__" locale key can't resolve to
+    // Object.prototype and get merged into (prototype pollution).
+    const maybeMessages = Object.prototype.hasOwnProperty.call(
+      this._messages,
+      locale,
+    )
+      ? this._messages[locale]
+      : undefined
     if (!maybeMessages) {
       this._messages[locale] = messages
     } else {
```

#### Recent Merged Pull Requests:
- **PR #2687** (2026-09-28): fix(solid): match macro-accepted placeholder names in formatElements (@giaBaoJS)
- **PR #2686** (2026-09-29): feat(vite-plugin): add native macro transformer (@timofei-iatsenko)
- **PR #2685** (2026-09-25): feat: use native macro transformer in experimental extractor (@timofei-iatsenko)
- **PR #2683** (2026-09-23): chore(release): published v6.8.0 [skip ci] (@andrii-bodnar)
- **PR #2682** (2026-09-28): fix(cli): resolve workers from caller source (@otrumb)
- **PR #2680** (2026-09-21): fix(react): substitute macro-accepted placeholder names in formatElements (@dyk1454683243-sudo)
- **PR #2677** (2026-09-23): fix(cli): add translation as the last key of a new message (@askalf)
- **PR #2674** (2026-09-17): docs: document new rules and Oxlint support (@andrii-bodnar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
