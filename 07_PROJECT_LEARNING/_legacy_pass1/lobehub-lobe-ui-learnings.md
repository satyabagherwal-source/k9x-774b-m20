# Forensic Learning Record (Deep Inspection): lobehub/lobe-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/lobehub-lobe-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lobehub/lobe-ui](https://github.com/lobehub/lobe-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:15:31.578Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lobehub/lobe-ui`
- **Description**: 🍭  Lobe UI - an open-source UI component library for building AIGC web apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2212 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.changelogrc.mjs`
```
import { changelog } from '@lobehub/lint';

export default changelog;

```

### Core Architecture Module: `.i18nrc.mjs`
```
export default {
  markdown: {
    entry: ['./README.md'],
    entryLocale: 'en-US',
    outputLocales: ['zh-CN'],
  },
};

```

### Core Architecture Module: `.releaserc.mjs`
```
import { createReleaseConfig } from './scripts/release/config.mjs';

// `docs` is excluded here but claimed by no stream: it has been used both for
// docs-kit source and for repo-level content, so it releases nothing at all
// rather than releasing the wrong package.
export default createReleaseConfig({
  exclude: true,
  scopes: ['docs', 'docs-kit'],
});

```

### Core Architecture Module: `.remarkrc.mjs`
```
import { remarklint } from '@lobehub/lint';

export default remarklint;

```

### Core Architecture Module: `commitlint.config.mjs`
```
import { commitlint } from '@lobehub/lint';

export default commitlint;

```

### Core Architecture Module: `config/packageNamespaces.ts`
```
export const packageNamespaces = [
  'awesome',
  'brand',
  'chat',
  'dashboard',
  'color',
  'icons',
  'mdx',
  'mobile',
  'storybook',
  'base-ui',
] as const;

```

### Core Architecture Module: `eslint.config.mjs`
```
import { defineConfig } from '@lobehub/eslint-config';
import sortKeysFix from 'eslint-plugin-sort-keys-fix';

export default defineConfig(
  {
    ignores: [
      'node_modules',
      'coverage',
      '.coverage',
      'jest*',
      '_test_',
      '__test__',
      'dist',
      'es',
      'lib',
      'logs',
    ],
    regexp: false,
    react: true,
    typescript: true,
  },
  {
    rules: {
      'no-undef': 'off',
      '@eslint-react/jsx-key-before-spread': 'off',
      '@eslint-react/no-children-only': 'off',
      '@eslint-react/no-children-to-array': 'off',
      '@eslint-react/no-clone-element': 'off',
      '@eslint-react/no-nested-component-definitions': 'off',
      '@eslint-react/no-unnecessary-use-prefix': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'off',
      'import-x/consistent-type-specifier-style': 'off',
      'unicorn/better-regex': 'off',
      'unicorn/no-anonymous-default-export': 'off',
      'unicorn/prefer-logical-operator-over-ternary': 'off',
    },
  },
  {
    plugins: {
      'sort-keys-fix': sortKeysFix,
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      'react/self-closing-comp': [
        'error',
        {
          component: true,
          html: true,
        },
      ],
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // React Router framework mode requires default exports from route modules,
    // root, server entry, and the route config; the .d.ts mirrors a virtual
    // module's default export shape; home page components must default-export
    // to satisfy the virtual:lobedocs/home-page module contract.
    files: [
      'packages/docs-kit/site/app/routes/*.tsx',
      'packages/docs-kit/site/root.tsx',
      'packages/docs-kit/site/entry.server.tsx',
      'packages/docs-kit/site/routes.ts',
      'packages/docs-kit/site/types/*.d.ts',
      'packages/docs-kit/site/components/Home/DefaultHome.tsx',
      'docs/home/home.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);

```

### Core Architecture Module: `prettier.config.mjs`
```
import { prettier } from '@lobehub/lint';

export default prettier;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #681** (2026-09-27): **🐛 fix(base-ui): render a custom Result icon without the status circle**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [ ] ✨ feat - [x] 🐛 fix - [ ] ♻️ refactor - [ ] 💄 style - [ ] 🔨 chore - [ ] 📝 docs  #### 🔀 变更说明 | Description of Change  `base-ui` `Result` wrapped any custom `icon` in the 72px tinted status circle and forced every nested `svg` to 36×36. antd `Result` rendered a custom icon as-is, so callers migrating from antd broke:  - A full-page brand loader passed as `icon` (LobeHub OAuth consent pending page) was squashed into a green circle, with its content collapsed into a vertical column. - 96px `FluentEmoji` icons overflowed the 72px circle.  Now the status circle and the SVG sizing apply only to the built-in status icons. A custom `icon` renders in a plain centered slot, matching antd.  #### 📝 补充信息 | Additional Information  - Regression test: `renders a custom icon without the status circle` fails before this change and passes after it (Result suite 12/12). - Downstream: lobehub/lobehub has about 11 `Result` usages with custom `FluentEmoji` icons that recover once this is released and bumped. - Acceptance for the downstream page (the lobe-chat side is verified; the `Result` pages that need this release are marked blocked until it ships): https://app.lobehub.com/acceptance/6e2bb489-b7a2-456a-bbf5-7873ff43dd41 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BdhThxmJucWxETi/qjrzxrrFXuZBcYYkma6zwOb9PDQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9IY1A1eEtVSDFycGQ5Tjc2NWY1RGI3RG5RaW93IiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZpeC1yZXN1bHQtY3VzdG9tLWljb24tbG9iZS1odWItb3NzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1maXgtcmVzdWx0LWN1c3RvbS1pY29uLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9NjgxIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-27T15:30:53.805908Z">2026-09-27T15:30:53.805908Z</relative-time> | `05d5779` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #674** (2026-09-26): **🐛 fix(base-ui): let Spin inherit color and center its glyph**
  *Symptoms*: ## Problem  - `glyph` / `network` classes hard-set `color: colorTextSecondary` on the inner glyph, so `<Spin style={{ color }} />` and parent colors (e.g. an orange running badge) were ignored. - The `aria-hidden` wrapper span was a block with a line box, so a small Spin (e.g. `size={9}`) grew to the line-height and sat off-center inside tight containers.  ## Fix  - Move `color: colorTextSecondary` to the Spin root; glyphs inherit `currentColor`. `style.color` and `color: inherit` now work. - Make the glyph wrapper `inline-flex` so the Spin box equals the glyph size.  Verified in lobe-chat: `size={9}` renders 9×9 centered in a 14px badge and follows the parent / `style` color.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #aBciMdLMWYijUUJlqvHk9NEmK6NLZMt4UhS/lI85orU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS80aWVwQXhmV3hvR0VWTnFEcE40VXBVS0FoeUs2IiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZpeC1zcGluLWNvbG9yLWluaGVyaXQtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1maXgtc3Bpbi1jb2xvci1pbmhlcml0LWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9Njc0In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-26T16:07:00.461203Z">2026-09-26T16:07:00.461203Z</relative-time> | `31ff90d` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #673** (2026-09-26): **🐛 fix(base-ui): fit circle Progress label inside the ring and restore Result visual weight**
  *Symptoms*: Found while regression-testing the lobehub antd → base-ui migration (lobehub/lobehub#19606) with before/after screenshots.  ## Progress (circle) - The centered label was a fixed 16px monospace for every diameter ≥ 40, so `62.5%` overflowed a 56px ring (CreditGauge). - Now sized from the diameter (`d * 0.15 + 6`, antd's formula: 40 → 12px, 56 → 14px, 120 → 24px), body font with tabular numbers, `nowrap`. - Regression test: `scales the centered info with a %ipx circle` (fails on master for 56/120).  ## Result - Custom `icon` (e.g. `<Icon icon={CheckCircle} />`) rendered at the Icon's own small default inside the badge; the icon slot now sizes any svg like the built-in status icons. - `extra` was a centered flex row, so block children (an `Alert`, a `Flexbox` column) shrank to content width; block children now span the full row while buttons stay centered. - Visual weight was much lower than the antd Result it replaces; badge 56 → 72px, icon 28 → 36px, title 16 → 20px (option picked from a side-by-side review).  ## Not changed - Circles under 40px still hide the label.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #0UMFNMOXSKeQGNk53MtVSfUGSrhY0AEQrPhPzaNp6zk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9CY1pmMVRZNXl5QkxkNnA5WTcxZ2RtZko4cVBZIiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZpeC1wcm9ncmVzcy1jaXJjbGUtcmVzdWx0LWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IlBFTkRJTkciLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoibG9iZS11aS1naXQtZml4LXByb2dyZXNzLWNpcmNsZS1yZXN1bHQtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAifX1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1sb2JlaHViJnJlcG89bG9iZS11aSZwcj02NzMifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-26T12:56:18.599853Z">2026-09-26T12:56:18.599853Z</relative-time> | `f0e687b` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #672** (2026-09-24): **🐛 fix(markdown): sanitize allowed raw HTML**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [x] 🐛 fix  #### 🔀 变更说明 | Description of Change  - Sanitize opt-in raw HTML immediately after parsing it in the shared Markdown plugin pipeline. - Apply the guard to both standard and streaming renderers. - Document the `allowHtml` behavior and add DOM regression coverage for unsafe embedded elements alongside safe formatting and mathematics.  #### 📝 补充信息 | Additional Information  - Verified: 4 focused tests, `pnpm type-check`, scoped ESLint, and `git diff --check`. - HTML outside the sanitizer's safe allowlist is intentionally omitted. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #rdqakboPJKRuWzeHNeoL/Kmx2iie6Jai9WWEFUW2Rng=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS82Y1JvTXhpdXR5Q01lb05kUmJxQ1ZoWkR1RlBtIiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZpeC1tYXJrZG93bi1zYW5pdGl6ZS1hbGxvdy1odG1sLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImxvYmUtdWktZ2l0LWZpeC1tYXJrZG93bi1zYW5pdGl6ZS1hbGxvdy1odG1sLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOm51bGx9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9NjcyIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :-
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-24T14:44:42.198378Z">2026-09-24T14:44:42.198378Z</relative-time> | `fe3b1fc` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/8e611b1d-0cff-4fa5-8fc1-c0aa7e8e4b61)     ```   npm i https://pkg.pr.new/@lobehub/ui@672   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/107686854318"><code>fe3b1fc</code></a>_ 

- **Issue #671** (2026-09-23): **✨ feat(ui): add landing and dashboard kits and rebuild docs chrome**
  *Symptoms*: Ship reusable landing sections and a console dashboard namespace, and move the docs site onto DocsShell with generated agent documents.  #### 💻 变更类型 | Change Type  <!-- For change type, change [ ] to [x]. -->  - [ ] ✨ feat - [ ] 🐛 fix - [ ] ♻️ refactor - [ ] 💄 style - [ ] 🔨 chore - [ ] 📝 docs  #### 🔀 变更说明 | Description of Change  <!-- Thank you for your Pull Request. Please provide a description above. -->  #### 📝 补充信息 | Additional Information  <!-- Add any other context about the Pull Request here. --> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #ANiAz+JGJ0DyT78lMxJyXHQcaVnp9LGsEcUs4G065Yc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvNnd2TVNCc2hTNWs4Y3FlWFEzTXpyTkd1cWprUCIsInByZXZpZXdVcmwiOiJsb2JlLXVpLWdpdC1mZWF0LWxhbmRpbmctZGFzaGJvYXJkLWRvY3Mtc2hlbGwtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoibG9iZS11aS1naXQtZmVhdC1sYW5kaW5nLWRhc2hib2FyZC1kb2NzLXNoZWxsLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOm51bGwsInYwIjpmYWxzZX1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1sb2JlaHViJnJlcG89bG9iZS11aSZwcj02NzEifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- 

- **Issue #670** (2026-09-22): **👷 ci: publish GitHub releases as lobe-tsukumo App**
  *Symptoms*: Replace `secrets.GH_TOKEN` with a `lobe-tsukumo` GitHub App installation token so releases are not authored by a personal PAT.  Expects org (or repo) config:  - `vars.LOBEHUB_BOT_APP_ID` - `secrets.LOBEHUB_BOT_APP_PRIVATE_KEY`  Org secrets will be added separately. Until then this job cannot mint a token.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #F6C5RJQ9KFiLCyMLdRYSMto6HSIlzQ8d/1ZkKI90Myk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvOHBqZ2VFOE1uN29RdExXeUFtbm5QV252OUJ2RSIsInByZXZpZXdVcmwiOiJsb2JlLXVpLWdpdC1jaS1sb2JlLXRzdWt1bW8tYXBwLXRva2VuLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOm51bGx9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9NjcwIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/lobe-hub
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-21T11:09:19.437937Z">2026-09-21T11:09:19.437937Z</relative-time> | `9afc7b3` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/c3d3953f-1394-4acf-a652-671b3c957fb4)     ```   npm i https://pkg.pr.new/@lobehub/ui@670   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/106330609154"><code>7c03e0e</code></a>_ 

- **Issue #669** (2026-09-27): **✨ feat(eslint): ban antd Badge, Empty, Pagination, Popover, Progress, Result, Spin, Tooltip and Upload imports**
  *Symptoms*: ## Why  Split out of #660. The eslint ban rule is independent of the component code and should land after #660 is released, so downstream can bump first and then pick up the lint rule.  ## What  - `src/eslint/index.ts`: add `Badge`, `Empty`, `Pagination`, `Popover`, `Progress`, `Result`, `Spin`, `Tooltip`, `Upload` to the banned antd import list, pointing at their `@lobehub/ui` / `@lobehub/ui/base-ui` replacements - `src/eslint/index.test.ts`: covers every banned specifier and the allowed ones  ## Verification  - `vitest run src/eslint/index.test.ts` — 29 passed - eslint clean on changed files
  **Post-Mortem & Fix Analysis**:
  > [vc]: #5cJ9fz9nOVJTnLiLK2MRiyM78LaMBrTbyJ00jzza0dA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS83S3JkclZ1M215RXZNajV1c0Y3WEMxeU5uUzI2IiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZlYXQtZXNsaW50LWJhbi1iYXRjaC1zZXZlbi1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1mZWF0LWVzbGludC1iYW4tYmF0Y2gtc2V2ZW4tbG9iZS1odWItb3NzLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6bnVsbH1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1sb2JlaHViJnJlcG89bG9iZS11aSZwcj02NjkifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :----
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-20T09:02:53.024929Z">2026-09-20T09:02:53.024929Z</relative-time> | `78f9705` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/005cbf62-b2f6-488a-aa65-e33bdfd49ed2)     ```   npm i https://pkg.pr.new/@lobehub/ui@669   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/106380609234"><code>2301aee</code></a>_ 

- **Issue #667** (2026-09-13): **✨ feat(base-ui): animate Accordion panel height to auto and fade content**
  *Symptoms*: - Panel: `interpolate-size: allow-keywords; height: auto` — native 0→auto transition, no `scrollHeight` measurement (owner: no legacy-engine fallback needed). - Content: rises 6px while fading in on expand, rises 6px while fading out on collapse; `prefers-reduced-motion` disables both. - Outlined: open header pads 8px below and the panel 4px above (total unchanged), so the header hover highlight keeps a gap from the content. Borderless keeps its inset hover pill.  Frame-sampled in the docs demo: height 0 → 13 → 34 → 46 → 52 → 55 → 56.6 → 56.8, no overshoot.  https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc
  **Post-Mortem & Fix Analysis**:
  > [vc]: #NjXwhRdgzT5jHOyDiupDX0B8uewHyjaQttQGfspNxeQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvRzVKMWlCOUE2d1RiWllyblcxNHk5S3NhZFlOTiIsInByZXZpZXdVcmwiOiJsb2JlLXVpLWdpdC1mZWF0LWFjY29yZGlvbi1jb250ZW50LW1vdGlvbi1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1mZWF0LWFjY29yZGlvbi1jb250ZW50LW1vdGlvbi1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5IjpudWxsLCJ2MCI6ZmFsc2V9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9NjY3In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-13T15:45:08.542961Z">2026-09-13T15:45:08.542961Z</relative-time> | `31c42ab` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

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

### Incident Patch 1: `99e6a55d` (2026-09-27)
**Commit Message**: 🐛 fix(base-ui): render a custom Result icon without the status circle (#681)

**File**: `src/base-ui/Result/Result.tsx` (modified, +7/-3)
```diff
@@ -26,9 +26,13 @@ const Result = memo<ResultProps>(
 
     return (
       <section className={cx(styles.root, className)} ref={ref} style={style} {...rest}>
-        <div className={styles.icon} style={iconStyle}>
-          {icon ?? statusIcon[status]}
-        </div>
+        {icon ? (
+          <div className={styles.customIcon}>{icon}</div>
+        ) : (
+          <div className={styles.icon} style={iconStyle}>
+            {statusIcon[status]}
+          </div>
+        )}
         {title && <h3 className={styles.title}>{title}</h3>}
         {subTitle && <p className={styles.subTitle}>{subTitle}</p>}
         {extra && <div className={styles.extra}>{extra}</div>}
```

**File**: `src/base-ui/Result/__tests__/Result.test.tsx` (modified, +9/-0)
```diff
@@ -27,6 +27,15 @@ describe('Result', () => {
     expect(screen.getByTestId('custom-icon')).toBeTruthy();
   });
 
+  test('renders a custom icon without the status circle', () => {
+    render(<Result icon={<span data-testid="custom-icon" />} status="success" />);
+
+    const slot = screen.getByTestId('custom-icon').parentElement!;
+    expect(slot.getAttribute('style')).toBeNull();
+    expect(getComputedStyle(slot).width).not.toBe('72px');
+    expect(getComputedStyle(slot).borderRadius).not.toBe('50%');
+  });
+
   test('renders title, subTitle, extra, and children', () => {
     render(
       <Result
```

**File**: `src/base-ui/Result/style.ts` (modified, +6/-0)
```diff
@@ -1,6 +1,12 @@
 import { createStaticStyles, cssVar } from 'antd-style';
 
 export const styles = createStaticStyles(({ css, cssVar }) => ({
+  customIcon: css`
+    display: flex;
+    flex-shrink: 0;
+    justify-content: center;
+    margin-block-end: 12px;
+  `,
   extra: css`
     display: flex;
     flex-wrap: wrap;
```

---

### Incident Patch 2: `5111bfc3` (2026-09-27)
**Commit Message**: 🐛 fix(dashboard): keep sidebar icons in place while the rail collapses

**File**: `packages/docs-kit/site/components/DocsShell/DocsShell.tsx` (modified, +4/-18)
```diff
@@ -1,12 +1,6 @@
 import { Hotkey } from '@lobehub/ui';
 import { LobeHub } from '@lobehub/ui/brand';
-import {
-  Breadcrumb,
-  ConsoleBrand,
-  ConsoleNav,
-  ConsoleShell,
-  useConsoleShell,
-} from '@lobehub/ui/dashboard';
+import { Breadcrumb, ConsoleBrand, ConsoleNav, ConsoleShell } from '@lobehub/ui/dashboard';
 import { GithubIcon } from '@lobehub/ui/icons';
 import { Search } from 'lucide-react';
 import type { ReactNode } from 'react';
@@ -29,16 +23,6 @@ interface DocsShellProps {
 
 const LOGO_SIZE = 24;
 
-function DocsBrandLogo({ productName }: { productName: string }) {
-  const { collapsed } = useConsoleShell();
-
-  return collapsed ? (
-    <LobeHub size={LOGO_SIZE} />
-  ) : (
-    <LobeHub extra={productName} size={LOGO_SIZE} type="combine" />
-  );
-}
-
 const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
 
 /**
@@ -92,7 +76,9 @@ export function DocsShell({ children, documents, navigation, onSearchOpen }: Doc
   const brand = (
     <ConsoleBrand
       label={`${siteConfig.title} documentation home`}
-      logo={<DocsBrandLogo productName={productName} />}
+      logo={
+        <LobeHub className={styles.brandLogo} extra={productName} size={LOGO_SIZE} type="combine" />
+      }
       renderLink={({ children: content, href, ...linkProps }) => (
         <Link {...linkProps} to={href}>
           {content}
```

**File**: `packages/docs-kit/site/components/DocsShell/style.ts` (modified, +15/-0)
```diff
@@ -61,6 +61,21 @@ export const styles = createStaticStyles(({ css }) => {
       }
     `,
 
+    brandLogo: css`
+      > :not(:first-child) {
+        transition: opacity 120ms ease 80ms;
+
+        [data-collapsed='true'] & {
+          opacity: 0;
+          transition-delay: 0s;
+        }
+
+        @media (prefers-reduced-motion: reduce) {
+          transition: none;
+        }
+      }
+    `,
+
     iconButton,
 
     search: css`
```

**File**: `src/dashboard/ConsoleNav/ConsoleNav.test.tsx` (modified, +11/-0)
```diff
@@ -108,6 +108,17 @@ describe('ConsoleNav', () => {
     expect(links[0].getAttribute('data-active')).toBe('true');
   });
 
+  it('keeps the same link elements when toggling the rail', () => {
+    const railItems = [{ end: true, href: '/', icon: BookOpen, label: 'Home' }];
+    const { rerender } = render(<ConsoleNav groups={groups} items={railItems} pathname="/" />);
+    const home = screen.getByRole('link', { name: 'Home' });
+
+    rerender(<ConsoleNav collapsed groups={groups} items={railItems} pathname="/" />);
+
+    expect(screen.getByRole('link', { name: 'Home' })).toBe(home);
+    expect(home.textContent).toBe('Home');
+  });
+
   it('routes clicks through onNavigate and leaves external links alone', () => {
     const onNavigate = vi.fn();
     render(
```

**File**: `src/dashboard/ConsoleNav/ConsoleNav.tsx` (modified, +171/-154)
```diff
@@ -1,7 +1,7 @@
 'use client';
 
 import { ChevronDown, Play } from 'lucide-react';
-import { useCallback, useEffect, useId, useRef, useState } from 'react';
+import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
 
 import Tooltip from '@/base-ui/Tooltip';
 import Icon from '@/Icon';
@@ -14,6 +14,7 @@ import { styles } from './style';
 import type { ConsoleNavGroup, ConsoleNavItem, ConsoleNavLinkProps, ConsoleNavProps } from './type';
 
 const PANEL_TRANSITION_MS = 160;
+const RAIL_TRANSITION_MS = 200;
 
 type ExpandedOverrides = Record<string, boolean>;
 
@@ -25,23 +26,49 @@ function readOverrides(value: unknown): ExpandedOverrides {
   return value && typeof value === 'object' ? (value as ExpandedOverrides) : {};
 }
 
-function scrollActiveIntoView(container: HTMLElement) {
+function scrollActiveIntoView(container: HTMLElement, behavior: ScrollBehavior = 'auto') {
   const link =
     container.querySelector<HTMLElement>('[aria-current="page"]') ??
     [...container.querySelectorAll<HTMLElement>('button[data-active="true"]')].at(-1);
   if (!link) return;
   const containerRect = container.getBoundingClientRect();
   const linkRect = link.getBoundingClientRect();
   if (linkRect.top >= containerRect.top && linkRect.bottom <= containerRect.bottom) return;
-  container.scrollTop +=
-    linkRect.top - containerRect.top - (containerRect.height - linkRect.height) / 2;
+  container.scrollBy({
+    behavior,
+    top: linkRect.top - containerRect.top - (containerRect.height - linkRect.height) / 2,
+  });
 }
 
 interface LinkContext {
   onNavigate?: (href: string) => void;
   renderLink?: ConsoleNavProps['renderLink'];
 }
 
+function renderAnchor(context: LinkContext, linkProps: ConsoleNavLinkProps, onFollow: () => void) {
+  if (context.renderLink) return context.renderLink(linkProps);
+  return (
+    <a
+      aria-current={linkProps['aria-current']}
+      aria-label={linkProps['aria-label']}
+      className={linkProps.className}
+      data-active={linkProps['data-active']}
+      data-collapsed={linkProps['data-collapsed']}
+      data-indent={linkProps['data-indent']}
+      href={linkProps.href}
+      rel={linkProps.external ? 'noreferrer' : undefined}
+      target={linkProps.external ? '_blank' : undefined}
+      title={linkProps.title}
+      onClick={(event) => {
+        if (context.onNavigate && !linkProps.external) event.preventDefault();
+        onFollow();
+      }}
+    >
+      {linkProps.children}
+    </a>
+  );
+}
+
 function NavLink({
   active,
   collapsed,
@@ -51,6 +78,7 @@ function NavLink({
   indent = 0,
   item,
   name,
+  overlay = false,
 }: {
   active: boolean;
   collapsed: boolean;
@@ -60,6 +88,7 @@ function NavLink({
   indent?: number;
   item?: ConsoleNavItem;
   name: string;
+  overlay?: boolean;
 }) {
   const shell = useConsoleShellState();
   const label = item?.label ?? name;
@@ -70,15 +99,15 @@ function NavLink({
   const linkProps: ConsoleNavLinkProps = {
     'aria-current': active ? 'page' : undefined,
     'aria-label': collapsed ? name : undefined,
-    'children': (
+    'children': overlay ? null : (
       <>
         {icon ? <Icon icon={icon} size={18} /> : null}
-        {collapsed ? null : <span className={styles.itemLabel}>{label}</span>}
-        {!collapsed && item?.badge ? <span className={styles.badge}>{item.badge}</span> : null}
-        {collapsed && item?.badge ? <span aria-hidden className={styles.dot} /> : null}
+        <span className={styles.itemLabel}>{label}</span>
+        {item?.badge ? <span className={styles.badge}>{item.badge}</span> : null}
+        {item?.badge ? <span aria-hidden className={styles.dot} /> : null}
       </>
     ),
-    'className': styles.item,
+    'className': overlay ? styles.railLink : styles.item,
     'data-active': active,
     'data-collapsed': collapsed,
     'data-indent': indent,
@@ -88,37 +117,30 @@ function NavLink({
     'title': collapsed ? undefined : label,
   };
 
-  const lin
```

**File**: `src/dashboard/ConsoleNav/demos/index.tsx` (modified, +8/-1)
```diff
@@ -28,7 +28,14 @@ export default () => {
 
   return (
     <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
-      <Surface style={{ inlineSize: collapsed ? 72 : 240, paddingBlock: 8 }}>
+      <Surface
+        style={{
+          inlineSize: collapsed ? 56 : 240,
+          overflow: 'hidden',
+          paddingBlock: 8,
+          transition: 'inline-size 200ms ease',
+        }}
+      >
         <ConsoleNav
           collapsed={collapsed}
           groups={groups}
```

---

### Incident Patch 3: `8d88a976` (2026-09-27)
**Commit Message**: 🐛 fix(base-ui): give the outlined Segmented indicator a visible fill

**File**: `src/base-ui/Segmented/style.ts` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ export const styles = createStaticStyles(({ css, cssVar }) => {
     transition-duration: 240ms;
     transition-property: inset-inline-start, inset-block-start, width, height;
 
+    [data-variant='outlined'] > & {
+      background: ${cssVar.colorFillSecondary};
+    }
+
     [data-orientation='horizontal'] &:dir(rtl) {
       inset-inline-start: var(--active-item-right);
     }
```

---

### Incident Patch 4: `0a684c8f` (2026-09-26)
**Commit Message**: 🐛 fix(base-ui): let Spin inherit color and center its glyph (#674)

**File**: `src/base-ui/Spin/Spin.tsx` (modified, +6/-2)
```diff
@@ -85,7 +85,9 @@ const Spin = memo<SpinProps>(
           style={style}
           {...rest}
         >
-          <span aria-hidden>{glyph}</span>
+          <span aria-hidden className={styles.glyphBox}>
+            {glyph}
+          </span>
         </div>
       );
     }
@@ -94,7 +96,9 @@ const Spin = memo<SpinProps>(
       <div className={cx(styles.wrapper, className)} ref={ref} style={style} {...rest}>
         {children}
         <div aria-busy aria-live="polite" className={styles.overlay} role="status">
-          <span aria-hidden>{glyph}</span>
+          <span aria-hidden className={styles.glyphBox}>
+            {glyph}
+          </span>
           {tip && <span className={styles.tip}>{tip}</span>}
         </div>
       </div>
```

**File**: `src/base-ui/Spin/style.ts` (modified, +4/-2)
```diff
@@ -49,12 +49,13 @@ const reducedMotion = `
 export const styles = createStaticStyles(({ css, cssVar }) => ({
   glyph: css`
     display: inline-flex;
-    color: ${cssVar.colorTextSecondary};
+  `,
+  glyphBox: css`
+    display: inline-flex;
   `,
   network: css`
     position: relative;
     display: inline-block;
-    color: ${cssVar.colorTextSecondary};
   `,
   networkBox: css`
     position: absolute;
@@ -156,6 +157,7 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
   root: css`
     display: inline-flex;
     align-items: center;
+    color: ${cssVar.colorTextSecondary};
   `,
   tip: css`
     font-size: ${cssVar.fontSizeSM};
```

---

### Incident Patch 5: `2dacc817` (2026-09-26)
**Commit Message**: 🐛 fix(base-ui): fit circle Progress label inside the ring and restore Result visual weight (#673)

- Progress (circle): size the centered label from the diameter (antd formula: d * 0.15 + 6) in the body font instead of a fixed 16px monospace, so '62.5%' no longer overflows a 56px ring.
- Result: size any svg in the icon slot like the built-in status icons, so custom icons are no longer tiny; let block children in extra (Alert, Flexbox) span the full width as in antd.
- Result: raise visual weight (72px badge, 36px icon, 20px title).

**File**: `src/base-ui/Progress/Progress.tsx` (modified, +4/-1)
```diff
@@ -114,7 +114,10 @@ const Progress = memo<ProgressProps>(
             />
           </svg>
           {showInfo && diameter >= 40 && (
-            <span className={styles.circleInfo} style={{ fontSize: diameter <= 40 ? 12 : 16 }}>
+            <span
+              className={styles.circleInfo}
+              style={{ fontSize: Math.round(diameter * 0.15 + 6) }}
+            >
               {info}
             </span>
           )}
```

**File**: `src/base-ui/Progress/__tests__/Progress.test.tsx` (modified, +12/-0)
```diff
@@ -123,6 +123,18 @@ describe('Progress', () => {
     expect(screen.getByText('62%')).toBeTruthy();
   });
 
+  test.each([
+    [40, '12px'],
+    [56, '14px'],
+    [120, '24px'],
+  ])('scales the centered info with a %ipx circle so it stays inside the ring', (size, font) => {
+    render(
+      <Progress format={(v) => `${v.toFixed(1)}%`} percent={62.5} size={size} type="circle" />,
+    );
+
+    expect(screen.getByText('62.5%').style.fontSize).toBe(font);
+  });
+
   test('exposes progressbar aria attributes on the circle type', () => {
     render(<Progress percent={33} type="circle" />);
 
```

**File**: `src/base-ui/Progress/style.ts` (modified, +3/-1)
```diff
@@ -41,9 +41,11 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
   `,
   circleInfo: css`
     position: absolute;
-    font-family: ${cssVar.fontFamilyCode};
+
     font-variant-numeric: tabular-nums;
+    line-height: 1;
     color: ${cssVar.colorText};
+    white-space: nowrap;
   `,
   circleRoot: css`
     position: relative;
```

**File**: `src/base-ui/Result/Result.tsx` (modified, +4/-4)
```diff
@@ -8,10 +8,10 @@ import { statusColor, styles } from './style';
 import type { ResultProps } from './type';
 
 const statusIcon = {
-  error: <X size={28} strokeWidth={2.5} />,
-  info: <Info size={28} strokeWidth={2} />,
-  success: <Check size={28} strokeWidth={2.5} />,
-  warning: <TriangleAlert size={28} strokeWidth={2} />,
+  error: <X size={36} strokeWidth={2.5} />,
+  info: <Info size={36} strokeWidth={2} />,
+  success: <Check size={36} strokeWidth={2.5} />,
+  warning: <TriangleAlert size={36} strokeWidth={2} />,
 };
 
 const Result = memo<ResultProps>(
```

**File**: `src/base-ui/Result/style.ts` (modified, +15/-4)
```diff
@@ -3,22 +3,33 @@ import { createStaticStyles, cssVar } from 'antd-style';
 export const styles = createStaticStyles(({ css, cssVar }) => ({
   extra: css`
     display: flex;
+    flex-wrap: wrap;
     gap: 8px;
     align-items: center;
+    align-self: stretch;
     justify-content: center;
 
     margin-block-start: 10px;
+
+    > :is(div, section, form) {
+      flex: 1 1 100%;
+    }
   `,
   icon: css`
     display: flex;
     flex-shrink: 0;
     align-items: center;
     justify-content: center;
 
-    width: 56px;
-    height: 56px;
-    margin-block-end: 8px;
+    width: 72px;
+    height: 72px;
+    margin-block-end: 12px;
     border-radius: 50%;
+
+    svg {
+      width: 36px;
+      height: 36px;
+    }
   `,
   root: css`
     display: flex;
@@ -39,7 +50,7 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
   `,
   title: css`
     margin: 0;
-    font-size: 16px;
+    font-size: 20px;
     font-weight: 600;
     text-wrap: balance;
   `,
```

---

### Incident Patch 6: `4f736cb1` (2026-09-24)
**Commit Message**: 🐛 fix(markdown): sanitize allowed raw HTML (#672)

**File**: `package.json` (modified, +1/-0)
```diff
@@ -217,6 +217,7 @@
     "react-zoom-pan-pinch": "^4.0.3",
     "rehype-github-alerts": "^4.2.0",
     "rehype-raw": "^7.0.0",
+    "rehype-sanitize": "^6.0.0",
     "remark-breaks": "^4.0.0",
     "remark-cjk-friendly": "^2.3.1",
     "remark-gfm": "^4.0.1",
```

**File**: `src/Markdown/SyntaxMarkdown/MarkdownRender.test.tsx` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import { render, screen } from '@testing-library/react';
+import { describe, expect, it } from 'vitest';
+
+import { MarkdownProvider } from '../components/MarkdownProvider';
+import MarkdownRender from './MarkdownRender';
+import StreamdownRender from './StreamdownRender';
+
+const content = `**Markdown text** and <em>safe HTML</em>
+
+<iframe srcdoc="<p>embedded document</p>"></iframe>
+<object data="https://example.com/file"></object>
+<embed src="https://example.com/file">
+<base href="https://example.com/">`;
+
+describe.each([
+  ['standard', MarkdownRender],
+  ['streaming', StreamdownRender],
+] as const)('%s Markdown rendering', (_, Renderer) => {
+  it('keeps formatting while removing unsafe raw HTML', async () => {
+    const { container } = render(
+      <MarkdownProvider allowHtml enableLatex={false}>
+        <Renderer>{content}</Renderer>
+      </MarkdownProvider>,
+    );
+
+    expect(await screen.findByText('safe HTML')).toHaveProperty('tagName', 'EM');
+    expect(container.querySelector('strong')?.textContent).toBe('Markdown text');
+    expect(document.querySelector('iframe, object, embed, base')).toBeNull();
+  });
+
+  it('preserves mathematical expressions when raw HTML is enabled', async () => {
+    const { container } = render(
+      <MarkdownProvider allowHtml enableLatex>
+        <Renderer>{'$a^2$'}</Renderer>
+      </MarkdownProvider>,
+    );
+
+    expect(container.querySelector('.katex')).not.toBeNull();
+  });
+});
```

**File**: `src/Markdown/type.ts` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ export interface TypographyProps extends DivProps {
 export type { StreamAnimationGranularity, StreamSmoothingPreset };
 
 export interface SyntaxMarkdownProps {
+  /** Parse and render sanitized inline HTML in Markdown content. */
   allowHtml?: boolean;
   allowHtmlList?: ElementType[];
   animated?: boolean;
```

**File**: `src/hooks/useMarkdown/useMarkdownRehypePlugins.ts` (modified, +3/-0)
```diff
@@ -3,6 +3,7 @@
 import { useMemo } from 'react';
 import { rehypeGithubAlerts } from 'rehype-github-alerts';
 import rehypeRaw from 'rehype-raw';
+import rehypeSanitize from 'rehype-sanitize';
 import type { Pluggable } from 'unified';
 
 import { useMarkdownContext } from '@/Markdown/components/MarkdownProvider';
@@ -24,6 +25,8 @@ export const useMarkdownRehypePlugins = (): Pluggable[] => {
     () =>
       [
         allowHtml && rehypeRaw,
+        // Parse untrusted HTML into nodes, then remove unsafe elements and attributes.
+        allowHtml && rehypeSanitize,
         enableGithubAlert && rehypeGithubAlerts,
         enableLatex && rehypeKatex,
         enableLatex && rehypeKatexDir,
```

---

### Incident Patch 7: `abe2263b` (2026-09-23)
**Commit Message**: 🐛 fix(docs-kit): drop leftover Geist font resources

The docs site no longer loads Geist, so remove the registry preconnect, the stale head assertion, and the leftover font names.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `packages/docs-kit/site/root.test.ts` (modified, +0/-17)
```diff
@@ -2,23 +2,6 @@ import { expect, it } from 'vitest';
 
 import { links } from './root';
 
-const GEIST_FONT_STYLESHEET =
-  'https://registry.npmmirror.com/@lobehub/webfont-geist/1.0.0/files/css/index.css';
-const GEIST_MONO_FONT_STYLESHEET =
-  'https://registry.npmmirror.com/@lobehub/webfont-geist-mono/1.0.0/files/css/index.css';
-
-it('publishes the exact Geist font resources in the document head', async () => {
-  const descriptors = await links();
-
-  expect(descriptors).toEqual(
-    expect.arrayContaining([
-      { crossOrigin: 'anonymous', href: 'https://registry.npmmirror.com', rel: 'preconnect' },
-      { href: GEIST_FONT_STYLESHEET, rel: 'stylesheet' },
-      { href: GEIST_MONO_FONT_STYLESHEET, rel: 'stylesheet' },
-    ]),
-  );
-});
-
 it('publishes favicon link tags for browsers and Apple devices', async () => {
   const descriptors = await links();
 
```

**File**: `packages/docs-kit/site/root.tsx` (modified, +0/-3)
```diff
@@ -7,8 +7,6 @@ import { SiteProviders } from './app/providers/SiteProviders';
 import { ThemeBootstrap } from './app/providers/ThemeBootstrap';
 import { styles } from './styles/globalStyles';
 
-const FONT_REGISTRY_ORIGIN = 'https://registry.npmmirror.com';
-
 const DEFAULT_FAVICONS: Record<string, string> = {
   appleTouchIcon: '/apple-touch-icon.png',
   icon: '/favicon.ico',
@@ -20,7 +18,6 @@ export const links: LinksFunction = () => {
   const favicons = { ...DEFAULT_FAVICONS, ...siteConfig.favicons };
 
   return [
-    { crossOrigin: 'anonymous', href: FONT_REGISTRY_ORIGIN, rel: 'preconnect' },
     { href: favicons.icon, rel: 'icon', sizes: 'any' },
     { href: favicons.icon16, rel: 'icon', sizes: '16x16', type: 'image/png' },
     { href: favicons.icon32, rel: 'icon', sizes: '32x32', type: 'image/png' },
```

**File**: `packages/docs-kit/site/styles/globalStyles.ts` (modified, +3/-4)
```diff
@@ -10,9 +10,8 @@ injectGlobal`
     --docs-radius-lg: 0.75rem;
     --docs-radius-md: 0.5rem;
     --docs-radius-sm: 0.375rem;
-    --docs-font-sans:
-      'Geist', 'SF Pro Text', 'SF Pro Display', Inter, ui-sans-serif, system-ui, sans-serif;
-    --docs-font-mono: 'Geist Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
+    --docs-font-sans: 'SF Pro Text', 'SF Pro Display', Inter, ui-sans-serif, system-ui, sans-serif;
+    --docs-font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
     --docs-background: #ffffff;
     --docs-surface-raised: #ffffff;
     --docs-surface-muted: #f7f7f8;
@@ -95,7 +94,7 @@ injectGlobal`
     color: var(--docs-text-primary);
     background-color: var(--docs-background);
     font-family: var(--docs-font-sans);
-    font-feature-settings: 'kern', 'cv01';
+    font-feature-settings: 'kern';
     font-kerning: normal;
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
```

---

### Incident Patch 8: `36d65894` (2026-09-20)
**Commit Message**: 🐛 fix(base-ui): render empty Avatar text instead of "UN" when avatar and title are missing

**File**: `src/base-ui/Avatar/Avatar.tsx` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ const Avatar = memo<AvatarProps>(
       [avatar, isStringAvatar, isUrlOrElement],
     );
 
-    const text = String(isUrlOrElement ? title : avatar);
+    const text = isUrlOrElement ? title : typeof avatar === 'string' ? avatar : undefined;
 
     const imgAlt = alt || title || 'avatar';
 
```

**File**: `src/base-ui/Avatar/__tests__/Avatar.test.tsx` (modified, +6/-0)
```diff
@@ -21,6 +21,12 @@ describe('Avatar', () => {
     expect((container.firstChild as HTMLElement).style.fontSize).toBe('24px');
   });
 
+  test('renders empty text when avatar and title are missing', () => {
+    const { container } = renderWithProvider(<Avatar />);
+
+    expect(container.textContent).toBe('');
+  });
+
   test('keeps the full text when sliceText is false', () => {
     renderWithProvider(<Avatar avatar="chat" sliceText={false} />);
 
```

---

### Incident Patch 9: `42b9235a` (2026-09-20)
**Commit Message**: 🐛 fix(base-ui): commit DraggablePanel size when pointer capture is lost mid-drag

**File**: `src/base-ui/DraggablePanel/__tests__/DraggablePanel.test.tsx` (modified, +26/-0)
```diff
@@ -89,6 +89,32 @@ describe('DraggablePanel', () => {
     );
   });
 
+  test('losing pointer capture mid-drag commits the current size instead of reverting', () => {
+    const onSizeChange = vi.fn();
+    render(
+      <DraggablePanel
+        defaultSize={{ width: 280 }}
+        maxWidth={500}
+        minWidth={200}
+        placement="left"
+        onSizeChange={onSizeChange}
+      >
+        content
+      </DraggablePanel>,
+    );
+
+    const handle = screen.getByRole('separator');
+    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
+    fireEvent.pointerMove(handle, { clientX: 60, clientY: 0, pointerId: 1 });
+    fireEvent.lostPointerCapture(handle, { pointerId: 1 });
+
+    expect(onSizeChange).toHaveBeenCalledWith(
+      { height: 0, width: 60 },
+      { height: '100%', width: 340 },
+    );
+    expect(handle.getAttribute('aria-valuenow')).toBe('340');
+  });
+
   test('arrow keys resize the panel', () => {
     const onSizeChange = vi.fn();
     render(
```

**File**: `src/base-ui/DraggablePanel/atoms.tsx` (modified, +4/-1)
```diff
@@ -300,8 +300,11 @@ export const DraggablePanelHandle = memo<DraggablePanelHandleProps>(
         onDoubleClick={() => {
           if (!draggedRef.current) controller.reset();
         }}
+        // Capture can be stolen mid-drag (another setPointerCapture, an OOPIF under the
+        // cursor) and the pointerup then never reaches us; the pointer is wherever the
+        // user last dragged it, so commit rather than snap back.
         onLostPointerCapture={() => {
-          if (draggingRef.current) controller.drag.cancel();
+          if (draggingRef.current) controller.drag.end();
           pressedRef.current = null;
           draggingRef.current = false;
         }}
```

---

### Incident Patch 10: `b54b565c` (2026-09-20)
**Commit Message**: 🐛 fix(accordion): skip enter animation when panels start expanded

Default-open Accordion panels still went through height/fade enter
because Base UI only suppresses CSS animations. Keep transitions for
open/close, and skip the first paint when Base UI sets animation-name
none. Add a remount demo to verify.

**File**: `src/base-ui/Accordion/__tests__/Accordion.test.tsx` (modified, +16/-0)
```diff
@@ -62,6 +62,22 @@ describe('Accordion', () => {
     expect(getComputedStyle(content).paddingInlineStart).not.toBe('24px');
   });
 
+  test('default-open panel skips the enter animation', () => {
+    render(<Accordion defaultValue={['a']} items={items} />);
+
+    const openPanel = screen.getByText('Panel A').parentElement;
+    expect(openPanel?.style.animationName).toBe('none');
+    expect(getComputedStyle(screen.getByText('Panel A')).opacity).not.toBe('0');
+  });
+
+  test('opening a closed panel does not keep enter animation suppressed', () => {
+    render(<Accordion defaultValue={['a']} items={items} />);
+
+    fireEvent.click(screen.getByRole('button', { name: 'Item B' }));
+    const openedPanel = screen.getByText('Panel B').parentElement;
+    expect(openedPanel?.style.animationName).not.toBe('none');
+  });
+
   test('AccordionRoot keeps several items open by default', () => {
     render(
       <AccordionRoot defaultValue={['a']}>
```

**File**: `src/base-ui/Accordion/demos/defaultOpen.tsx` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { Flexbox } from '@lobehub/ui';
+import { Accordion, type AccordionProps, Button } from '@lobehub/ui/base-ui';
+import { useState } from 'react';
+
+const items: AccordionProps['items'] = [
+  {
+    children: (
+      <Flexbox gap={4} style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.75 }}>
+        <div>Intelligence 100 · Agentic 99 · Writing 78</div>
+        <div>Design 75 · Speed 53 · Price 31</div>
+      </Flexbox>
+    ),
+    key: 'rating',
+    title: 'Benchmarks',
+  },
+  {
+    children: '1M tokens',
+    key: 'context',
+    title: 'Context length',
+  },
+  {
+    children: (
+      <Flexbox gap={4} style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.75 }}>
+        <div>Vision</div>
+        <div>Tool calling</div>
+        <div>Reasoning</div>
+      </Flexbox>
+    ),
+    key: 'abilities',
+    title: 'Abilities',
+  },
+  {
+    children: 'Collapsed on purpose — click to compare the expand motion.',
+    key: 'pricing',
+    title: 'Pricing',
+  },
+];
+
+export default () => {
+  const [mountKey, setMountKey] = useState(0);
+
+  return (
+    <Flexbox gap={12} padding={16} style={{ maxWidth: 480 }}>
+      <Flexbox horizontal align="center" gap={8}>
+        <Button size="small" onClick={() => setMountKey((key) => key + 1)}>
+          Remount
+        </Button>
+        <span style={{ fontSize: 12, opacity: 0.55 }}>
+          Default-open sections should appear instantly. A collapsed item still animates on click.
+        </span>
+      </Flexbox>
+      <Accordion
+        defaultValue={['rating', 'context', 'abilities']}
+        gap={8}
+        indicatorPlacement="inline"
+        items={items}
+        key={mountKey}
+      />
+    </Flexbox>
+  );
+};
```

**File**: `src/base-ui/Accordion/index.mdx` (modified, +7/-0)
```diff
@@ -9,6 +9,7 @@ import DemoFilled from './demos/filled.tsx?demo';
 import DemoInline from './demos/inline.tsx?demo';
 import DemoOutlined from './demos/outlined.tsx?demo';
 import DemoAtoms from './demos/atoms.tsx?demo';
+import DemoDefaultOpen from './demos/defaultOpen.tsx?demo';
 
 ## Default
 
@@ -32,6 +33,12 @@ Container border with dividers between items. The first example is single-open (
 
 <Demo of={DemoInline} layout="bare" />
 
+## Default-open mount
+
+Sections that start expanded should paint fully open — no height or fade enter. Remount to replay first paint. Click **Pricing** to compare the expand motion.
+
+<Demo of={DemoDefaultOpen} layout="bare" />
+
 ## Atom Components
 
 <Demo of={DemoAtoms} layout="bare" />
```

**File**: `src/base-ui/Accordion/style.ts` (modified, +14/-0)
```diff
@@ -40,6 +40,14 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
       opacity: 0;
     }
 
+    /* Base UI sets animation-name: none on initially-open panels */
+    [style*='animation-name: none'] &,
+    [style*='animation-name:none'] & {
+      translate: none;
+      opacity: 1;
+      transition: none;
+    }
+
     @media (prefers-reduced-motion: reduce) {
       transition-duration: 0s;
     }
@@ -157,6 +165,12 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
       height: 0;
     }
 
+    &[data-starting-style][style*='animation-name: none'],
+    &[data-starting-style][style*='animation-name:none'] {
+      height: auto;
+      transition: none;
+    }
+
     @media (prefers-reduced-motion: reduce) {
       transition-duration: 0s;
     }
```

#### Recent Merged Pull Requests:
- **PR #681** (2026-09-27): 🐛 fix(base-ui): render a custom Result icon without the status circle (@Innei)
- **PR #674** (2026-09-26): 🐛 fix(base-ui): let Spin inherit color and center its glyph (@Innei)
- **PR #673** (2026-09-26): 🐛 fix(base-ui): fit circle Progress label inside the ring and restore Result visual weight (@Innei)
- **PR #672** (2026-09-24): 🐛 fix(markdown): sanitize allowed raw HTML (@Innei)
- **PR #671** (2026-09-23): ✨ feat(ui): add landing and dashboard kits and rebuild docs chrome (@canisminor1990)
- **PR #670** (2026-09-22): 👷 ci: publish GitHub releases as lobe-tsukumo App (@Innei)
- **PR #669** (2026-09-27): ✨ feat(eslint): ban antd Badge, Empty, Pagination, Popover, Progress, Result, Spin, Tooltip and Upload imports (@Innei)
- **PR #667** (2026-09-13): ✨ feat(base-ui): animate Accordion panel height to auto and fade content (@Innei)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
