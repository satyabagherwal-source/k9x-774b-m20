# Forensic Learning Record (Deep Inspection): BuilderIO/builder

> **Canonical Artifact**: `07_PROJECT_LEARNING/builderio-builder-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BuilderIO/builder](https://github.com/BuilderIO/builder))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:28.201Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BuilderIO/builder`
- **Description**: Visual Development for React, Vue, Svelte, Qwik, and more
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8858 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/angular-gen1/e2e/app.po.ts`
```
import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo() {
    return browser.get('/');
  }

  getParagraphText() {
    return element(by.css('app-root h1')).getText();
  }
}

```

### Core Architecture Module: `examples/angular-gen1/karma.conf.js`
```
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, 'coverage'),
      reports: ['html', 'lcovonly'],
      fixWebpackSourcePaths: true,
    },

    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
  });
};

```

### Core Architecture Module: `examples/angular-gen1/protractor.conf.js`
```
// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter } = require('jasmine-spec-reporter');

exports.config = {
  allScriptsTimeout: 11000,
  specs: ['./e2e/**/*.e2e-spec.ts'],
  capabilities: {
    browserName: 'chrome',
  },
  directConnect: true,
  baseUrl: 'http://localhost:4200/',
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    print: function () {},
  },
  onPrepare() {
    require('ts-node').register({
      project: 'e2e/tsconfig.e2e.json',
    });
    jasmine.getEnv().addReporter(new SpecReporter({ spec: { displayStacktrace: true } }));
  },
};

```

### Core Architecture Module: `examples/angular-gen1/src/app/app.component.ts`
```
import { BuilderBlock } from '@builder.io/angular';
import { Component, Input } from '@angular/core';
import './with-children';

@Component({
  selector: 'custom-thing',
  template: 'Hello: {{name}}',
})
export class CustomThing {
  @Input()
  name = '';
}

BuilderBlock({
  tag: 'custom-thing',
  name: 'Custom thing',
  inputs: [
    {
      name: 'name',
      type: 'string',
    },
  ],
})(CustomThing);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'app';
  options: any = {
    cacheSeconds: 1,
    data: {
      locale: 'en-US',
    },
  };

  data = {
    property: 'hello',
    fn: (text: string) => alert(text),
  };

  load(event: any) {
    console.log('load', event);
  }

  error(event: any) {
    console.log('error', event);
  }
}

```

### Core Architecture Module: `examples/angular-gen1/src/app/app.module.ts`
```
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BuilderModule } from '@builder.io/angular';

import { AppComponent, CustomThing } from './app.component';
import { FooComponent } from './foo.component';
import { CustomThingChildren } from './with-children';
@NgModule({
  declarations: [AppComponent, FooComponent, CustomThing, CustomThingChildren],
  imports: [
    BrowserModule,
    BuilderModule.forRoot('1f3bf1d766354f32ba70dde440fcef97'),
    RouterModule.forRoot([
      {
        path: '**',
        component: FooComponent,
      },
    ]),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}

```

### Core Architecture Module: `examples/angular-gen1/src/app/foo.component.ts`
```
import { Component } from '@angular/core';

@Component({
  selector: 'foo',
  template: '',
})
export class FooComponent {}

```

### Core Architecture Module: `examples/angular-gen1/src/app/with-children.ts`
```
import { Component, Input } from '@angular/core';
import { BuilderBlock } from '@builder.io/angular';

@Component({
  selector: 'custom-thing-children',
  template: `
    <h2>Section A</h2>
    <builder-blocks-outlet
      [blocks]="sectionA"
      [builderState]="builderState"
      [builderBlock]="builderBlock"
      dataPath="component.options.sectionA"
    ></builder-blocks-outlet>
    <h2>Section B</h2>
    <builder-blocks-outlet
      [blocks]="sectionB"
      [builderState]="builderState"
      [builderBlock]="builderBlock"
      dataPath="component.options.sectionB"
    ></builder-blocks-outlet>
  `,
})
export class CustomThingChildren {
  @Input()
  name = '';

  @Input()
  builderBlock = null;

  @Input()
  builderState = null;

  @Input()
  sectionA = null;

  @Input()
  sectionB = null;
}

BuilderBlock({
  tag: 'custom-thing-children',
  name: 'Custom thing with children',
  canHaveChildren: true,
  inputs: [
    {
      name: 'name',
      type: 'string',
    },
    {
      name: 'sectionA',
      type: 'blocks',
      hideFromUI: true,
      helperText: 'This is an editable region where you can drag and drop blocks.',
      defaultValue: [
        {
          '@type': '@builder.io/sdk:Element',
          component: {
            name: 'Text',
            options: {
              text: 'Section A Editable in Builder...',
            },
          },
          responsiveStyles: {
            large: {
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              flexShrink: '0',
              boxSizing: 'border-box',
              marginTop: '20px',
              lineHeight: 'normal',
              height: 'auto',
              textAlign: 'center',
            },
          },
        },
      ],
    },
    {
      name: 'sectionB',
      type: 'blocks',
      hideFromUI: true,
      helperText: 'This is an editable region where you can drag and drop blocks.',
      defaultValue: [
        {
          '@type': '@builder.io/sdk:Element',
          component: {
            name: 'Text',
            options: {
              text: 'Section B Editable in Builder...',
            },
          },
          responsiveStyles: {
            large: {
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              flexShrink: '0',
              boxSizing: 'border-box',
              marginTop: '20px',
              lineHeight: 'normal',
              height: 'auto',
              textAlign: 'center',
            },
          },
        },
      ],
    },
  ],
})(CustomThingChildren);

```

### Core Architecture Module: `examples/angular-gen1/src/environments/environment.prod.ts`
```
export const environment = {
  production: true,
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3985** (2025-04-02): **fix[ENG-8003]: Changing the entry on a symbol does not update the preview window**
  *Symptoms*: ## Description  This PR fixes an issue where symbol content was not updating correctly. The fix compares the previous symbol entry with the incoming symbol entry—if they are not equal, it triggers `fetchSymbolContent` to ensure the latest content is loaded.    **Changes Made:**   - Added a comparison check between the previous and incoming symbol entries.   - Triggered `fetchSymbolContent` if the entries differ to update the content.    **Why This Change Was Made:**   To ensure symbol content updates correctly when the symbol entry changes, improving accuracy and consistency in the preview.   _Loom_ https://www.loom.com/share/032123ec4a7f449db7690eb9ca022f3e?sid=3964bfa8-ac48-428a-a376-91568c447213 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: eb5362fe9039425668dd59c341b5843b186d359b  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 7 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-qwik         | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch | | @builder.io/sdk-vue          | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8003?filename=.changeset/blue-tools-complain.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patc
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67ed42bc62e2084339b8d514?utm_source=pull-request&utm_medium=comment) for commit eb5362fe9039425668dd59c341b5843b186d359b.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 8m 41s | [View ↗](https://cloud.nx.app/runs/ysFRNb6X6L?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 8m 11s | [View ↗](https://cloud.nx.app/runs/RTdePQ2gSw?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 8m 16s | [View ↗](https://cloud.nx.app/runs/UQoY1rk7QK?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 6m 58s | [View ↗](https://cloud.nx.app/runs/9wOsExDNfr?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16` | ✅ Succeeded | 6m 48s | [View ↗](https://cloud.nx.app/runs/DOyaDyLSu5?utm_source=pull-request&utm_medium=comment) |
  > #### ⚠️ GitGuardian has uncovered 1 secret following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secret in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [11707119](https://dashboard.gitguardian.com/workspace/81635/incidents/11707119) | Triggered | Generic High E

- **Issue #3975** (2025-03-25): **fix: [ENG-8644] overriding omit in fetchOneEntry to be empty string**
  *Symptoms*: ### **Description:**   This PR fixes an issue where `meta.componentsUsed` is omitted by default when using `fetchOneEntry`. Previously, to include `meta.componentsUsed`, you had to explicitly set `omit: ' '` (a space) as a workaround.    ### **Changes Made:**   - Updated the logic to include `meta.componentsUsed` by default unless explicitly omitted.   - Added `omit ?? 'meta.componentsUsed'` to ensure `componentsUsed` is not omitted when `omit` is set to an empty string (`''`).    ### **Why This Change Was Made:**   To allow `meta.componentsUsed` to be included without requiring a workaround and to ensure better handling of the `omit` parameter.     __Loom__ https://www.loom.com/share/938cd062796c4e2aaaf42b408039713e?sid=f087a66d-478d-42ce-ae41-b8e809535da6 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: a75c8fe63c19a60f254019ac3f90809d59533ba7  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 10 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk              | Patch | | @builder.io/react            | Patch | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-react-nextjs | Patch | | @builder.io/sdk-qwik         | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch | | @builder.io/sdk-vue          | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67e28d5dd1aaa1684f691d15?utm_source=pull-request&utm_medium=comment) for commit 6e1b15cae6cc20e95251c36e4e1b2aa54b82501e.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/nuxt` | ✅ Succeeded | 10m 27s | [View ↗](https://cloud.nx.app/runs/7Dc4mcvTux?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 9m 13s | [View ↗](https://cloud.nx.app/runs/MRJbbhdNsl?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 9m 1s | [View ↗](https://cloud.nx.app/runs/hqYScRkE5y?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16` | ✅ Succeeded | 7m 29s | [View ↗](https://cloud.nx.app/runs/j9I2yLOU9g?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 7m 27s | [View ↗](https://cloud.nx.app/runs/to7Lwsx7Gv?utm_source=pull-request&utm_medium=comment) |
  > @yash-builder could you add tests for this? https://github.com/BuilderIO/builder/blob/e3ce1d80af54cbad9a4ab982bf97011cbc6a02a6/packages/sdks-tests/src/e2e-tests/hit-content-api.spec.ts#L73 this could be a reference

- **Issue #3967** (2025-03-28): **fix: [ENG-8172] Content Inputs of type "list" do not update in the preview when changed**
  *Symptoms*: ## Description  This PR fixes an issue where content inputs of type "list" in Gen 2 SDKs were not updating in the preview when modified. Previously, changes to list item properties within symbols required a manual browser refresh to reflect updates.    ### **Changes Made:**   - Resolved the reactivity issue causing list inputs to not update in the preview.   - Ensured that changes to list properties are immediately reflected without requiring a browser refresh.    ### **Why This Change Was Made:**   To improve the editing experience by ensuring real-time updates for list-type inputs within symbols in the Gen 2 SDKs.  _Jira_ https://builder-io.atlassian.net/browse/ENG-8172  _Screenshot_ Adding soon... 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: c1ae957a1dbfae5884a0553350453e55c3b08bd3  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 7 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-react-nextjs | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch | | @builder.io/sdk-vue          | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8172?filename=.changeset/old-avocados-cross.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67e6470e3050ae4e8f2190ae?utm_source=pull-request&utm_medium=comment) for commit c1ae957a1dbfae5884a0553350453e55c3b08bd3.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/nuxt` | ✅ Succeeded | 9m 38s | [View ↗](https://cloud.nx.app/runs/hI9JfInzx3?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 9m 21s | [View ↗](https://cloud.nx.app/runs/iXeWSfKGWW?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 8m 52s | [View ↗](https://cloud.nx.app/runs/cIPA2GAsFo?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/vue` | ✅ Succeeded | 6m 5s | [View ↗](https://cloud.nx.app/runs/YMMksAA0HH?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/sveltekit` | ✅ Succeeded | 6m 30s | [View ↗](https://cloud.nx.app/runs/EIaGIfL4ae?utm_source=pull-request&utm_medium=comment) | | `nx test @
  > #### ⚠️ GitGuardian has uncovered 1 secret following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secret in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [11707119](https://dashboard.gitguardian.com/workspace/81635/incidents/11707119) | Triggered | Generic High E

- **Issue #3947** (2025-04-02): **fix[qwik]: ENG-7299 Default value not updating for custom components on ContentEditor**
  *Symptoms*: ## Description  This PR addresses a critical reactivity issue in the Qwik SDK where deeply nested content updates weren't properly triggering.   The core problem was that when content was updated through the Builder.io editor, the changes were correctly stored in state but weren't causing components to re-render.   I've implemented a key-based approach for the `InteractiveElement` component that uses a dynamic key derived from the component options, forcing `Qwik` to update it's component when `options` changes. This effectively bypasses limitations in Qwik's resumability model where prop changes to dynamic components aren't always detected. While using `JSON.stringify` in keys isn't ideal for **_performance_**, but it provides a reliable solution that ensures content updates are immediately reflected in the UI without requiring page refreshes.  JIRA https://builder-io.atlassian.net/browse/ENG-7299  _Loom_ https://www.loom.com/share/2b4d1b2872fe4151b1a9f2f131bab780?sid=7fc0f143-0623-41f4-aa94-e947530dde55 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 7620d4866b6aded3844508721553ed5e2e437812  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @builder.io/sdk-qwik | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-7299?filename=.changeset/slimy-lies-accept.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40e2e%2Fqwik-city%22%3A%20patch%0A%22%40e2e%2Freact%22%3A%20patch%0A---%0A%0Afix%5Bqwik%5D%3A%20ENG-7299%20Default%20value%20not%20updating%20for%20custom%20components%20on%20ContentEditor%0A
  > #### ⚠️ GitGuardian has uncovered 3 secrets following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secrets in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [2708648](https://dashboard.gitguardian.com/workspace/81635/incidents/2708648) | Triggered | Generic High E
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67ebd9041d718113934c32c6?utm_source=pull-request&utm_medium=comment) for commit 7620d4866b6aded3844508721553ed5e2e437812.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 8m 28s | [View ↗](https://cloud.nx.app/runs/dUpxgxOZwt?utm_source=pull-request&utm_medium=comment) |  ---  ☁️ [Nx Cloud](https://cloud.nx.app?utm_source=pull-request&utm_medium=comment) last updated this comment at `2025-04-01 12:24:40` UTC  <!-- NX_CLOUD_APP_COMMENT_END -->

- **Issue #3937** (2025-03-05): **fix[dynamic-renderer]: ENG-8440 Button links cannot be used in Angular Gen 2 SDK**
  *Symptoms*: ## Description  This PR replaces the switch-case logic with a Map for dynamically selecting components in `dynamic-renderer`. The previous approach caused an assertion error when users typed.  _Loom_ https://www.loom.com/share/1229e7974db44743921df588ca1bd1bb?sid=ea3ccc9c-41de-4efe-b499-f61ca9244cbd
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: d14b625142e05b7b9925738d24245c35bb88f119  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                    | Type  | | ----------------------- | ----- | | @builder.io/sdk-angular | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8440?filename=.changeset/soft-jobs-invite.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40builder.io%2Fsdk-angular%22%3A%20patch%0A---%0A%0Afix%5Bdynamic-renderer%5D%3A%20ENG-8440%20Button%20links%20cannot%20be%20used%20in%20Angular%20Gen%202%20SDK%0A)  
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67c737bd1fdea46784cac388?utm_source=pull-request&utm_medium=comment) for commit d14b625142e05b7b9925738d24245c35bb88f119.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 7m 33s | [View ↗](https://cloud.nx.app/runs/rKdtU9XvQe?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 7m 11s | [View ↗](https://cloud.nx.app/runs/5VDSBGArtD?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 7m 32s | [View ↗](https://cloud.nx.app/runs/0JmbCsY7Tp?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 6m 48s | [View ↗](https://cloud.nx.app/runs/V7bRwDtxHT?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16` | ✅ Succeeded | 6m 41s | [View ↗](https://cloud.nx.app/runs/S2NJPyhBcq?utm_source=pull-request&utm_medium=comment) |
  > LGTM... need to consider the case for dynamic-elements for unknown. PR - https://github.com/BuilderIO/builder/pull/3892

- **Issue #3896** (2025-02-12): **fix: ensure correct variation tracking for impressions**
  *Symptoms*: ## Description  ### **Pull Request Description**    #### **What Changed?**   - Fixed an issue where **two impressions** were being tracked—one for the default content and another for the variation.   - Updated the logic to ensure that **only the variation impression is tracked**, preventing duplicate tracking.   - Added a **Playwright test** to verify that impressions are logged correctly with the right `variationId`.    #### **Why This Change?**   - Previously, the analytics data incorrectly counted extra impressions for the default content.   - Now, only the actual **winning variation** sends an impression event, ensuring accurate A/B testing results.     _Screenshot_ **Before**: _Impression for variation getting send without variationId_ <img width="1512" alt="Screenshot 2025-02-07 at 4 29 48 PM" src="https://github.com/user-attachments/assets/5b506262-b03a-4a7d-a857-a1085d4c5fc3" />  **After**: _Sending only winning variation_ <img width="1512" alt="Screenshot 2025-02-07 at 4 32 39 PM" src="https://github.com/user-attachments/assets/72ab419f-6ec9-4940-9d87-261eece01c3e" />  <img width="1512" alt="Screenshot 2025-02-07 at 4 33 22 PM" src="https://github.com/user-attachments/assets/4013386c-2937-4c9e-a941-51a3ddc704fd" /> 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 5a2aca2f39bd65a006030d5b60ba05f9ea692376  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 7 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-react-nextjs | Patch | | @builder.io/sdk-qwik         | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8180?filename=.changeset/modern-bees-repair.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67acc1fc9e5dfe5ac6ddc974?utm_source=pull-request&utm_medium=comment) for commit 5a2aca2f39bd65a006030d5b60ba05f9ea692376.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 8m 52s | [View ↗](https://cloud.nx.app/runs/4DPzs2pKmu?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/gen1-next14-pages` | ✅ Succeeded | 8m 56s | [View ↗](https://cloud.nx.app/runs/aNE3kq9GsK?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/vue` | ✅ Succeeded | 7m 27s | [View ↗](https://cloud.nx.app/runs/w3kh1lpybF?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 8m | [View ↗](https://cloud.nx.app/runs/4a6k8Kg72S?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 7m 50s | [View ↗](https://cloud.nx.app/runs/Rh6t9l6D70?utm_source=pull-request&utm_medium=comment)
  > #### ⚠️ GitGuardian has uncovered 2 secrets following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secrets in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [9071768](https://dashboard.gitguardian.com/workspace/81635/incidents/9071768) | Triggered | Generic High E

- **Issue #3865** (2025-02-04): **fix[qwik-sdk]: ENG-6695 visual editor hangs if editable area (<Content />) is not in the iframe viewport**
  *Symptoms*: ## Description The `CustomEvent` `"initeditingbldr"` was not triggering as expected by ensuring proper event dispatch timing and listener registration. The `useOnDocument("readystatechange")` handler was updated to dispatch the event only after the DOM is fully loaded (`document.readyState === "complete"`)  **JIRA**: https://builder-io.atlassian.net/browse/ENG-6695  **Loom** https://www.loom.com/share/0ab5296adbe24bb2b22319f0588f0bbf?sid=4e4b4066-4b18-459e-bc62-7dae1e45c1f9
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 7d6ae717744f5ad0382e664802ddbec4a295c03a  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @builder.io/sdk-qwik | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/qwik-load-fix?filename=.changeset/dirty-walls-smash.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40e2e%2Fqwik-city%22%3A%20patch%0A---%0A%0Afix%5Bqwik-sdk%5D%3A%20ENG-6695%20visual%20editor%20hangs%20if%20editable%20area%20(%3CContent%20%2F%3E)%20is%20not%20in%20the%20iframe%20viewp
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67a23f7e37a3c345af724314?utm_source=pull-request&utm_medium=comment) for commit 587f834f36fba42ac88cc69529823e3ca58e6818.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 8m 1s | [View ↗](https://cloud.nx.app/runs/bcZb2dzyOC?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 7m 48s | [View ↗](https://cloud.nx.app/runs/dTNMY1W9dH?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 7m 17s | [View ↗](https://cloud.nx.app/runs/IE5ZDXcf6K?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/svelte` | ✅ Succeeded | 5m 50s | [View ↗](https://cloud.nx.app/runs/L9toAKTHUc?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/react-native-76-fabric` | ✅ Succeeded | 5m 51s | [View ↗](https://cloud.nx.app/runs/pjt4ZsOh1Y?utm_source=pull-request&utm_medium=comment

- **Issue #3814** (2025-01-24): **perf[react-native]: Memoized Blocks Component to free up UI thread.**
  *Symptoms*: ## Description  `Suspense`: Added `React.Suspense` to defer the rendering of the `Content` component until it is fully loaded.  `Memoization`: `React.memo` to memoize computationally expensive operations within the `Blocks` component. To prevents unnecessary recalculations of processed blocks during re-renders, reducing the load on the UI thread.  _Screenshot_ Before: <img width="798" alt="Screenshot 2025-01-13 at 12 20 38 PM" src="https://github.com/user-attachments/assets/91ddb89c-2ddd-4930-b62f-7497783ad948" />  After: <img width="798" alt="Screenshot 2025-01-13 at 12 37 41 PM" src="https://github.com/user-attachments/assets/6dd776b0-3d82-46f1-a98a-7d28e553d44c" /> 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 553372047c8ee088415aaa29006e22152714b554  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-react-native | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/perf-react-native?filename=.changeset/quiet-squids-wash.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40builder.io%2Fsdk-react-native%22%3A%20patch%0A---%0A%0Aperf%5Breact-native%5D%3A%20Memoized%20Blocks%20Component%20to%20free%20up%20UI%20thread.%0A)  
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67930fdbd5bb8174179ab909?utm_source=pull-request&utm_medium=comment) for commit 553372047c8ee088415aaa29006e22152714b554.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 7m 45s | [View ↗](https://cloud.nx.app/runs/fgXZQdJ8HX?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 7m 22s | [View ↗](https://cloud.nx.app/runs/qTEevky96r?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 6m 59s | [View ↗](https://cloud.nx.app/runs/e7krUf7NQj?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/react-sdk-next-15-app` | ✅ Succeeded | 5m 45s | [View ↗](https://cloud.nx.app/runs/Kl0at4q5zR?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/hydrogen` | ✅ Succeeded | 5m 40s | [View ↗](https://cloud.nx.app/runs/ajqmogbao8?utm_source=pull-request&utm_medium=comme
  > > I see `large-reactive-state.spec.ts` is failing for React Native now. This is an integration stress-test for SDK performance: it renders thousands of interactive elements on the same page, performs multiple state updates and makes sure it all gets done in a reasonable time frame. >  > It's a bit surprising that your PR is causing it to fail. Can you investigate this failure and make sure there aren't any unintended performance drawbacks to this solution?  Hmm...that's weird let me take a look into it

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

### Incident Patch 1: `9689cbcc` (2026-09-30)
**Commit Message**: fix[sdks][set]: ENG-14025 block prototype pollution via __proto__, constructor and prototype binding keys (#4878)

**File**: `.changeset/unlucky-mugs-lie.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": patch
+"@builder.io/sdk-react-native": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Prevent prototype pollution by ignoring `__proto__`, `constructor` and `prototype` segments in block binding keys
```

**File**: `packages/sdks/src/functions/set.test.ts` (modified, +41/-0)
```diff
@@ -17,3 +17,44 @@ test('can deeply create arrays', () => {
   set(obj, 'foo.bar.0', 'hi');
   expect((obj.foo as any).bar).toEqual(['hi']);
 });
+
+test.each([
+  '__proto__.polluted',
+  'constructor.prototype.polluted',
+  'foo.__proto__.polluted',
+  '__proto__[polluted]',
+])('does not pollute Object.prototype via %s', (path) => {
+  const obj = {};
+  set(obj, path, 'yes');
+  expect(({} as any).polluted).toBeUndefined();
+  expect((Object.prototype as any).polluted).toBeUndefined();
+});
+
+test('does not pollute Object.prototype via array path', () => {
+  set({}, ['__proto__', 'polluted'], 'yes');
+  expect(({} as any).polluted).toBeUndefined();
+});
+
+test('does not pollute the Object constructor via non-terminal constructor', () => {
+  set({}, 'constructor.polluted', 'yes');
+  expect((Object as any).polluted).toBeUndefined();
+});
+
+test('does not change the prototype via terminal __proto__', () => {
+  const obj: any = { foo: {} };
+  set(obj, 'foo.__proto__', { polluted: 'yes' });
+  expect(obj.foo.polluted).toBeUndefined();
+  expect(Object.getPrototypeOf(obj.foo)).toBe(Object.prototype);
+});
+
+test('allows terminal constructor and prototype keys as own properties', () => {
+  const obj: any = {};
+  set(obj, 'fields.constructor', 'a');
+  set(obj, 'fields.prototype', 'b');
+  expect(Object.prototype.hasOwnProperty.call(obj.fields, 'constructor')).toBe(
+    true
+  );
+  expect(obj.fields.constructor).toBe('a');
+  expect(obj.fields.prototype).toBe('b');
+  expect(({} as any).constructor).toBe(Object);
+});
```

**File**: `packages/sdks/src/functions/set.ts` (modified, +11/-0)
```diff
@@ -12,6 +12,17 @@ export const set = (obj: any, _path: string | string[], value: any) => {
     ? _path
     : (_path.toString().match(/[^.[\]]+/g) as string[]);
 
+  if (
+    !path ||
+    path.some(
+      (key, i) =>
+        key === '__proto__' ||
+        (i < path.length - 1 && (key === 'constructor' || key === 'prototype'))
+    )
+  ) {
+    return obj;
+  }
+
   path
     .slice(0, -1)
     .reduce(
```

---

### Incident Patch 2: `b5e5c6e2` (2026-09-29)
**Commit Message**: fix[gen2]: ENG-14049 prevent URL parameters from overriding API key (#4869)

**File**: `.changeset/cuddly-tomatoes-sneeze.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": patch
+"@builder.io/sdk-react-native": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Prevent content fetch options from overriding the configured API key
```

**File**: `packages/sdks/src/functions/get-content/generate-content-url.test.ts` (modified, +32/-0)
```diff
@@ -290,6 +290,38 @@ describe('Generate Content URL', () => {
     expect(output).toMatchSnapshot();
   });
 
+  test('does not allow preview parameters to override the configured API key', () => {
+    vi.stubGlobal('window', {
+      location: {
+        search:
+          '?builder.preview=BUILDER_STUDIO&builder.apiKey=other-space&builder.userAttributes.audience=members',
+        pathname: '/reproduction',
+        host: 'www.example.com',
+      },
+    });
+    vi.stubGlobal('document', {});
+
+    try {
+      const output = generateContentUrl({ apiKey: testKey, model: testModel });
+      const outputWithOptions = generateContentUrl({
+        apiKey: testKey,
+        model: testModel,
+        options: { apiKey: 'another-space' },
+      });
+
+      expect(output.searchParams.get('apiKey')).toBe(testKey);
+      expect(outputWithOptions.searchParams.get('apiKey')).toBe(testKey);
+      expect(output.searchParams.get('preview')).toBe('BUILDER_STUDIO');
+      expect(JSON.parse(output.searchParams.get('userAttributes')!)).toEqual({
+        audience: 'members',
+        urlPath: '/reproduction',
+        host: 'www.example.com',
+      });
+    } finally {
+      vi.unstubAllGlobals();
+    }
+  });
+
   test('converts Studio boolean user attributes from query parameters', () => {
     vi.stubGlobal('window', {
       location: {
```

**File**: `packages/sdks/src/functions/get-content/generate-content-url.ts` (modified, +3/-1)
```diff
@@ -109,7 +109,9 @@ export const generateContentUrl = (options: GetContentOptions): URL => {
 
   const flattened = flatten(queryOptions);
   for (const key in flattened) {
-    url.searchParams.set(key, String(flattened[key]));
+    if (key !== 'apiKey') {
+      url.searchParams.set(key, String(flattened[key]));
+    }
   }
 
   if (Object.keys(finalUserAttributes).length > 0) {
```

---

### Incident Patch 3: `72f2bc8c` (2026-09-28)
**Commit Message**: fix[sdks][image]: ENG-13982 remove redundant presentation role (#4864)

**File**: `.changeset/heavy-foxes-drop.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/react": patch
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Remove the redundant presentation role from Image blocks with empty alt text.
```

**File**: `packages/react/src/blocks/Image.tsx` (modified, +0/-1)
```diff
@@ -346,7 +346,6 @@ class ImageComponent extends React.Component<any, { imageLoaded: boolean; load:
                   ? (typeof this.image === 'string' && this.image.split('?')[0]) || undefined
                   : undefined
               }
-              role={!this.props.altText ? 'presentation' : undefined}
               css={{
                 opacity: amp ? 1 : this.useLazyLoading && !this.state.imageLoaded ? 0 : 1,
                 transition: 'opacity 0.2s ease-in-out',
```

**File**: `packages/react/test/image.test.tsx` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ describe('Image', () => {
     const image = tree.children.find((child: any) => child.type === 'img');
 
     expect(image.props.alt).toBe('');
+    expect(image.props.role).toBeUndefined();
   });
 
   it('Shopify image url', () => {
```

**File**: `packages/sdks-tests/src/e2e-tests/blocks.spec.ts` (modified, +2/-0)
```diff
@@ -157,7 +157,9 @@ test.describe('Blocks', () => {
 
       const images = page.locator('.builder-image');
       await expect(images.first()).toHaveAttribute('alt', '');
+      await expect(images.first()).not.toHaveAttribute('role');
       await expect(images.nth(1)).toHaveAttribute('alt', 'alt text test');
+      await expect(images.nth(1)).not.toHaveAttribute('role');
     });
 
     test('Image sizes attribute', async ({ page, sdk }) => {
```

**File**: `packages/sdks-tests/src/specs/image.ts` (modified, +2/-0)
```diff
@@ -38,6 +38,7 @@ export const CONTENT = {
           options: {
             image:
               'https://cdn.builder.io/api/v1/image/assets%2Ff1a790f8c3204b3b8c5c1795aeac4660%2F7054b4049c3745a4a18a537eff0fe74b?width=982',
+            altText: '',
             backgroundSize: 'cover',
             backgroundPosition: 'top right',
             lazy: false,
@@ -243,6 +244,7 @@ export const CONTENT_2 = {
           options: {
             image:
               'https://cdn.builder.io/api/v1/image/assets%2Ff1a790f8c3204b3b8c5c1795aeac4660%2F7054b4049c3745a4a18a537eff0fe74b?width=982',
+            altText: '',
             backgroundSize: 'cover',
             backgroundPosition: 'top right',
             lazy: false,
```

---

### Incident Patch 4: `ac687928` (2026-09-25)
**Commit Message**: fix[sdk-tests]: mock Studio refetch in personalization container e2e test (#4866)

## Description

Fixes the react-sdk-next-pages e2e failure that's blocking the Publish
SDKs PR (#4865).

**Why it fails:**
The Studio preview test added in #4863 loads the page with
builder.preview=BUILDER_STUDIO. That flag makes the SDK fetch fresh
content from the live Builder API. The test pages use a fake API key, so
the API returns a 401. The SDK then throws that error without catching
it, and the test fails.

It's not flaky. It failed on all 7 reruns.

**Fix:**
The test now intercepts that content request and returns the page's own
test content, the same way other e2e tests handle content API calls. No
SDK code changes.

**Link to JIRA ticket (if applicable):**
https://builder-io.atlassian.net/browse/...

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Only adjusts an e2e test mock; no production or SDK runtime code is
modified.
> 
> **Overview**
> The **Studio preview** e2e case in `personalization-container.spec.ts`
now **intercepts** live Builder content API calls before navigation.
With `builder.preview=BUILDER_STUDIO`, the SDK refetches from
`cdn.builder.io`; the test’s mock API ke

**File**: `packages/sdks-tests/src/e2e-tests/personalization-container.spec.ts` (modified, +6/-0)
```diff
@@ -136,6 +136,12 @@ test.describe('Personalization Container', () => {
     }
 
     test('Studio preview URL selects the variant with no cookie set', async ({ page }) => {
+      // BUILDER_STUDIO triggers a live refetch. Unmocked, the mock apiKey gets a 401 that
+      // rejects unhandled; empty results resolve to null so no content merge re-renders.
+      await page.route(/https:\/\/cdn\.builder\.io\/api\/v3\/content/, route =>
+        route.fulfill({ status: 200, json: { results: [] } })
+      );
+
       // The pre-hydration inline selector reads the cookie, which Studio cannot write on
       // this origin. Asserting the default is hidden catches it falling back to that.
       await page.goto(
```

---

### Incident Patch 5: `2587fea5` (2026-09-24)
**Commit Message**: fix[studioTab][gen2]: ENG-13049 Fix Studio tab date override for Variant Containers (#4863)

## Description

Changing the date in Builder's Studio tab does nothing to Variant
Containers on Gen 2 sites. The preview keeps showing the default variant
no matter which date you pick, so you can't check scheduled content
before it goes live.

Root Cause:
Studio sends the date two ways and Gen 2 ignores both.

1. It puts `builder.userAttributes.date` in the preview URL. The SDK
does read that, but only when building the content API request. The
Variant Container never looks at the URL.

2. It also posts a `builder.evaluate` message into the iframe. The SDK
only starts listening for those inside `setupBrowserForEditing()`, which
runs when isEditing() is true. That requires `builder.frameEditing` in
the URL, and Studio never sets it. Nothing is listening, so the message
goes nowhere.

The Variant Container reads its targeting attributes from exactly one
place, the `builder.userAttributes` cookie. Studio can't write that
cookie because it's on a different origin, and browsers block cross-site
iframe cookie writes anyway. With no date to work from, the SDK falls
back to the real current time, 

**File**: `.changeset/studio-user-attributes-targeting.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+'@builder.io/sdk-react-nextjs': patch
+'@builder.io/sdk-react-native': patch
+'@builder.io/sdk-angular': patch
+'@builder.io/sdk-svelte': patch
+'@builder.io/sdk-react': patch
+'@builder.io/sdk-solid': patch
+'@builder.io/sdk-qwik': patch
+'@builder.io/sdk-vue': patch
+---
+
+Fix Variant Containers ignoring Builder Studio targeting overrides, which are passed as `builder.userAttributes.*` query params rather than through the cookie.
```

**File**: `packages/sdks-tests/src/e2e-tests/personalization-container.spec.ts` (modified, +13/-0)
```diff
@@ -134,6 +134,19 @@ test.describe('Personalization Container', () => {
         await expect(page.getByText(TEXTS.DEFAULT_CONTENT).locator('visible=true')).toBeHidden();
       });
     }
+
+    test('Studio preview URL selects the variant with no cookie set', async ({ page }) => {
+      // The pre-hydration inline selector reads the cookie, which Studio cannot write on
+      // this origin. Asserting the default is hidden catches it falling back to that.
+      await page.goto(
+        '/personalization-container?builder.preview=BUILDER_STUDIO&builder.userAttributes.experiment=A'
+      );
+
+      await expect(page.getByText(TEXTS.EXPERIMENT_A).locator('visible=true')).toBeVisible();
+      await expect(page.getByText(TEXTS.NON_PERSONALIZED).locator('visible=true')).toBeVisible();
+      await expect(page.getByText(TEXTS.EXPERIMENT_B).locator('visible=true')).toBeHidden();
+      await expect(page.getByText(TEXTS.DEFAULT_CONTENT).locator('visible=true')).toBeHidden();
+    });
   });
 
   test('setClientUserAttributes and builder.setUserAttributes sets cookie and renders variant after the first render', async ({
```

**File**: `packages/sdks/src/blocks/personalization-container/helpers.ts` (modified, +5/-0)
```diff
@@ -7,6 +7,7 @@ import type { Target } from '../../types/targets.js';
 import {
   FILTER_WITH_CUSTOM_TARGETING_SCRIPT,
   PERSONALIZATION_SCRIPT,
+  STUDIO_USER_ATTRIBUTES_SCRIPT,
   UPDATE_VISIBILITY_STYLES_SCRIPT,
 } from './helpers/inlined-fns.js';
 import type { PersonalizationContainerProps } from './personalization-container.types.js';
@@ -16,6 +17,7 @@ export const DEFAULT_INDEX = 'default';
 const FILTER_WITH_CUSTOM_TARGETING_SCRIPT_FN_NAME = 'filterWithCustomTargeting';
 const BUILDER_IO_PERSONALIZATION_SCRIPT_FN_NAME = 'builderIoPersonalization';
 const UPDATE_VARIANT_VISIBILITY_SCRIPT_FN_NAME = 'updateVisibilityStylesScript';
+const STUDIO_USER_ATTRIBUTES_SCRIPT_FN_NAME = 'builderIoStudioUserAttributes';
 
 const PERSONALIZATION_CONTAINER_COMPONENT_NAME = 'PersonalizationContainer';
 
@@ -180,6 +182,9 @@ export const hasPersonalizationContainer = (
 export const getInitPersonalizationVariantsFnsScriptString = () => {
   return `
   (function() {
+    if (!window.${STUDIO_USER_ATTRIBUTES_SCRIPT_FN_NAME}) {
+      window.${STUDIO_USER_ATTRIBUTES_SCRIPT_FN_NAME} = ${STUDIO_USER_ATTRIBUTES_SCRIPT};
+    }
     if (!window.${FILTER_WITH_CUSTOM_TARGETING_SCRIPT_FN_NAME}) {
       window.${FILTER_WITH_CUSTOM_TARGETING_SCRIPT_FN_NAME} = ${FILTER_WITH_CUSTOM_TARGETING_SCRIPT};
     }
```

**File**: `packages/sdks/src/blocks/personalization-container/helpers/inlined-fns.ts` (modified, +27/-0)
```diff
@@ -6,6 +6,30 @@
 import type { Query, UserAttributes } from '../helpers.js';
 import { type PersonalizationContainerProps } from '../personalization-container.types.js';
 
+/**
+ * Mirrors helpers/studio-user-attributes.ts; stringification rules out sharing the code.
+ * Anything referenced from module scope becomes an undefined global at runtime.
+ */
+export function getStudioUserAttributes() {
+  const params = new URLSearchParams(window.location.search);
+
+  if (params.get('builder.preview') !== 'BUILDER_STUDIO') {
+    return {};
+  }
+
+  const prefix = 'builder.userAttributes.';
+  const attributes: Record<string, unknown> = {};
+
+  params.forEach(function (value, key) {
+    if (key.indexOf(prefix) === 0) {
+      attributes[key.slice(prefix.length)] =
+        value === 'true' ? true : value === 'false' ? false : value;
+    }
+  });
+
+  return attributes;
+}
+
 function getPersonalizedVariant(
   variants: PersonalizationContainerProps['variants'],
   blockId: string,
@@ -31,6 +55,7 @@ function getPersonalizedVariant(
   if (locale) {
     attributes.locale = locale;
   }
+  Object.assign(attributes, (window as any).builderIoStudioUserAttributes());
 
   const winningVariantIndex = variants?.findIndex(function (variant) {
     return (window as any).filterWithCustomTargeting(
@@ -213,6 +238,7 @@ export function updateVisibilityStylesScript(
     if (locale) {
       attributes.locale = locale;
     }
+    Object.assign(attributes, (window as any).builderIoStudioUserAttributes());
     const winningVariantIndex = variants?.findIndex(function (variant) {
       return (window as any).filterWithCustomTargeting(
         attributes,
@@ -236,6 +262,7 @@ export function updateVisibilityStylesScript(
   }
 }
 
+export const STUDIO_USER_ATTRIBUTES_SCRIPT = getStudioUserAttributes.toString();
 export const PERSONALIZATION_SCRIPT = getPersonalizedVariant.toString();
 export const FILTER_WITH_CUSTOM_TARGETING_SCRIPT =
   filterWithCustomTargeting.toString();
```

**File**: `packages/sdks/src/helpers/studio-user-attributes.test.ts` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import {
+  STUDIO_USER_ATTRIBUTES_SCRIPT,
+  getStudioUserAttributes as getStudioUserAttributesInline,
+} from '../blocks/personalization-container/helpers/inlined-fns';
+import { isBrowser } from '../functions/is-browser';
+import { getStudioUserAttributes } from './studio-user-attributes';
+
+vi.mock('../functions/is-browser', () => ({
+  isBrowser: vi.fn().mockReturnValue(true),
+}));
+
+const setLocationSearch = (search: string) => {
+  vi.stubGlobal('window', { location: { search } });
+};
+
+const withStudioPreview = (params: string) =>
+  '?builder.preview=BUILDER_STUDIO&' + params;
+
+describe('getStudioUserAttributes', () => {
+  afterEach(() => {
+    vi.unstubAllGlobals();
+  });
+
+  it('returns nothing outside the browser', () => {
+    vi.mocked(isBrowser).mockReturnValueOnce(false);
+
+    expect(getStudioUserAttributes()).toEqual({});
+  });
+
+  it('returns nothing when the Studio preview flag is absent', () => {
+    setLocationSearch('?builder.userAttributes.device=mobile');
+
+    expect(getStudioUserAttributes()).toEqual({});
+  });
+
+  it('returns nothing for a non-Studio preview value', () => {
+    // builder.preview=<modelName> is the normal editor preview, not Studio.
+    setLocationSearch(
+      '?builder.preview=page&builder.userAttributes.device=mobile'
+    );
+
+    expect(getStudioUserAttributes()).toEqual({});
+  });
+
+  it('extracts userAttributes params, stripping the prefix', () => {
+    setLocationSearch(
+      withStudioPreview(
+        'builder.userAttributes.device=mobile&builder.userAttributes.date=2026-09-25T18:30:00.000Z'
+      )
+    );
+
+    expect(getStudioUserAttributes()).toEqual({
+      device: 'mobile',
+      date: '2026-09-25T18:30:00.000Z',
+    });
+  });
+
+  it('ignores unrelated builder params', () => {
+    setLocationSearch(
+      withStudioPreview(
+        'builder.cachebust=true&builder.options.locale=Default&builder.userAttributes.device=tablet'
+      )
+    );
+
+    expect(getStudioUserAttributes()).toEqual({ device: 'tablet' });
+  });
+
+  it('coerces boolean-like values so they match boolean targeting rules', () => {
+    setLocationSearch(
+      withStudioPreview(
+        'builder.userAttributes.isLoggedIn=true&builder.userAttributes.isNew=false'
+      )
+    );
+
+    expect(getStudioUserAttributes()).toEqual({
+      isLoggedIn: true,
+      isNew: false,
+    });
+  });
+
+  it('leaves other values as strings', () => {
+    setLocationSearch(
+      withStudioPreview('builder.userAttributes.audienceSize=42')
+    );
+
+    expect(getStudioUserAttributes()).toEqual({ audienceSize: '42' });
+  });
+
+  it('keeps dotted attribute names flat rather than nesting them', () => {
+    // filterWithCustomTargeting does a flat userattr[property] lookup, so nesting these
+    // the way generate-content-url.ts does for the API would stop the rule matching.
+    setLocationSearch(
+      withStudioPreview('builder.userAttributes.account.plan=pro')
+    );
+
+    expect(getStudioUserAttributes()).toEqual({ 'account.plan': 'pro' });
+  });
+});
+
+describe('inlined copy of getStudioUserAttributes', () => {
+  afterEach(() => {
+    vi.unstubAllGlobals();
+  });
+
+  const searches = [
+    '',
+    '?builder.userAttributes.device=mobile',
+    '?builder.preview=page&builder.userAttributes.device=mobile',
+    withStudioPreview('builder.userAttributes.date=2026-09-25T18:30:00.000Z'),
+    withStudioPreview(
+      'builder.cachebust=true&builder.userAttributes.isLoggedIn=true&builder.userAttributes.isNew=false'
+    ),
+    withStudioPreview('builder.userAttributes.account.plan=pro'),
+  ];
+
+  it.each(searches)('matches the module helper for %s', (search) => {
+    setLocationSearch(search);
+
+    expect(getStudioUserAttributesInline()).toEqual(getStudioUserAttributes());
+  });
+
+  it('still works once stringified into the page', () => {
+    // Catches a module-scope r
```

---

### Incident Patch 6: `23d99c3d` (2026-09-18)
**Commit Message**: fix[smartling][utils]: ENG-13950 non-translatable link fields get overwritten after Smartling translation (#4860)

## Description

Fixes non-translatable link fields being overwritten with the English
URL after a Smartling translation is applied.

When a list field is localized (one array per locale) and its subfields
are marked `nonTranslatableInputs`, applying a translation rebuilds the
target locale's array from the source array. Translated text gets
patched back in, but non-translatable fields are never sent for
translation, so nothing patches them, and they silently inherit the
source value.

Anything the author had set for that locale is lost.

**Example:**

A carousel slide with a German link, before translation:
`"link": { "de-DE": "https://www.sumup.com/de-de/zahlungen-annehmen/" }`

**After:**
```
"link": {
  "Default": "https://www.sumup.com/en-gb/take-payments/",
  "de-DE":   "https://www.sumup.com/en-gb/take-payments/"
}
```
The German URL is gone and every locale points at the English page.

**Fix:**
- Added `restoreExcludedLeaves` in `translation-helpers.ts`
- Before writing the rebuilt payload to the target locale, it copies
back any value the locale already had at 

**File**: `packages/utils/src/translation-helpers.test.ts` (modified, +43/-0)
```diff
@@ -2040,3 +2040,46 @@ test('applyTranslation restores a skipped relative path into the target locale',
 
   expect((result.data as any).sibling['de-DE']).toEqual('./checkout');
 });
+
+test('applyTranslation keeps non-translatable values the target locale already had', () => {
+  const slide = (link: any) => ({
+    title: { '@type': localizedType, Default: 'Hospitality' },
+    link,
+  });
+  const content: BuilderContent = {
+    data: {
+      blocks: [
+        {
+          '@type': '@builder.io/sdk:Element',
+          id: 'builder-carousel',
+          meta: {
+            localizedTextInputs: ['slides'],
+            nonTranslatableInputs: ['slides.*.link'],
+          },
+          component: {
+            name: 'GenericCarousel',
+            options: {
+              slides: {
+                '@type': localizedType,
+                Default: [slide({ '@type': localizedType, Default: '/en-gb/take-payments/' })],
+                'de-DE': [slide({ '@type': localizedType, 'de-DE': '/de-de/zahlungen/' })],
+              },
+            },
+          },
+        },
+      ],
+    },
+  };
+
+  const translation = getTranslateableFields(content, 'en-US', 'instructions');
+  const translated: typeof translation = {};
+  Object.keys(translation).forEach(key => {
+    translated[key] = { ...translation[key], value: 'DE ' + translation[key].value };
+  });
+
+  const result = applyTranslation(content, translated, 'de-DE', 'en-US');
+  const slides = (result.data as any).blocks[0].component.options.slides['de-DE'];
+
+  expect(slides[0].link).toEqual({ '@type': localizedType, 'de-DE': '/de-de/zahlungen/' });
+  expect(slides[0].title['de-DE']).toBe('DE Hospitality');
+});
```

**File**: `packages/utils/src/translation-helpers.ts` (modified, +65/-1)
```diff
@@ -644,6 +644,62 @@ function setTranslatedLeaf({
   }
 }
 
+// Non-translatable leaves would inherit the source value from the rebuilt payload; keep what
+// the locale had. Paths mirror extraction: `#index`, `#key`, none for a LocalizedValue branch.
+function restoreExcludedLeaves(
+  next: any,
+  previous: any,
+  basePath: string,
+  locale: string,
+  excluded: Set<string> | undefined
+): any {
+  if (!excluded || next == null || previous == null) {
+    return next;
+  }
+  if (isExcludedPath(excluded, basePath)) {
+    return JSON.parse(JSON.stringify(previous));
+  }
+  if (Array.isArray(next)) {
+    if (Array.isArray(previous)) {
+      next.forEach((item, index) => {
+        next[index] = restoreExcludedLeaves(
+          item,
+          previous[index],
+          `${basePath}#${index}`,
+          locale,
+          excluded
+        );
+      });
+    }
+    return next;
+  }
+  if (typeof next !== 'object' || typeof previous !== 'object') {
+    return next;
+  }
+  if (next['@type'] === localizedType) {
+    if (previous['@type'] === localizedType && next[locale] != null && previous[locale] != null) {
+      next[locale] = restoreExcludedLeaves(
+        next[locale],
+        previous[locale],
+        basePath,
+        locale,
+        excluded
+      );
+    }
+    return next;
+  }
+  Object.keys(next).forEach(key => {
+    next[key] = restoreExcludedLeaves(
+      next[key],
+      previous[key],
+      `${basePath}#${key}`,
+      locale,
+      excluded
+    );
+  });
+  return next;
+}
+
 export function applyTranslation(
   content: BuilderContent,
   translation: TranslateableFields,
@@ -986,7 +1042,15 @@ export function applyTranslation(
             });
           });
 
-          set(options, key, { ...(existing || {}), [locale]: localeValue });
+          const merged = restoreExcludedLeaves(
+            localeValue,
+            existing?.[locale],
+            flatKey,
+            locale,
+            excludedPaths
+          );
+
+          set(options, key, { ...(existing || {}), [locale]: merged });
           markTranslated();
         });
       }
```

---

### Incident Patch 7: `6b45a4f2` (2026-09-18)
**Commit Message**: fix[sdk][image]: ENG-13713 support responsive image positions across breakpoints (#4857)

**File**: `.changeset/warm-dolls-poke.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/sdk-react": patch
+"@builder.io/react": patch
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Allow Image blocks to honor breakpoint-specific image positions while preserving the configured image position as a fallback.
```

**File**: `packages/react/src/blocks/Image.tsx` (modified, +6/-2)
```diff
@@ -351,7 +351,9 @@ class ImageComponent extends React.Component<any, { imageLoaded: boolean; load:
                 opacity: amp ? 1 : this.useLazyLoading && !this.state.imageLoaded ? 0 : 1,
                 transition: 'opacity 0.2s ease-in-out',
                 objectFit: this.props.backgroundSize || 'cover',
-                objectPosition: this.props.backgroundPosition || 'center',
+                objectPosition: `var(--builder-image-position, ${
+                  this.props.backgroundPosition || 'center'
+                })`,
                 ...(aspectRatio &&
                   !amp && {
                     position: 'absolute',
@@ -363,7 +365,9 @@ class ImageComponent extends React.Component<any, { imageLoaded: boolean; load:
                 ...(amp && {
                   ['& img']: {
                     objectFit: this.props.backgroundSize,
-                    objectPosition: this.props.backgroundPosition,
+                    objectPosition: `var(--builder-image-position, ${
+                      this.props.backgroundPosition || 'center'
+                    })`,
                   },
                 }),
               }}
```

**File**: `packages/react/src/components/builder-block.component.tsx` (modified, +13/-4)
```diff
@@ -184,7 +184,8 @@ export class BuilderBlock extends React.Component<
 
     const reversedNames = sizeNames.slice().reverse();
     const styles: any = {};
-    if (responsiveStyles) {
+    const isBuilderImage = block.component?.name === 'Image';
+    if (responsiveStyles || isBuilderImage) {
       const contentHasXSmallBreakpoint = Boolean(
         this.privateState.context.builderContent?.meta?.breakpoints?.xsmall
       );
@@ -194,20 +195,28 @@ export class BuilderBlock extends React.Component<
           continue;
         }
 
+        const stylesForSize = responsiveStyles?.[size];
+        const imagePosition = isBuilderImage
+          ? stylesForSize?.objectPosition || (size === 'large' ? 'initial' : undefined)
+          : undefined;
+        const responsiveStylesForSize = imagePosition
+          ? { ...stylesForSize, '--builder-image-position': imagePosition }
+          : stylesForSize;
+
         if (size === 'large') {
           if (!this.props.emailMode) {
             styles[`&.builder-block`] = Object.assign(
               {},
-              responsiveStyles[size],
+              responsiveStylesForSize,
               initialAnimationStepStyles
             );
           }
-        } else {
+        } else if (responsiveStylesForSize) {
           const sizesPerBreakpoints = getSizesForBreakpoints(
             this.privateState.context.builderContent?.meta?.breakpoints || {}
           );
           styles[`@media only screen and (max-width: ${sizesPerBreakpoints[size].max}px)`] = {
-            '&.builder-block': responsiveStyles[size],
+            '&.builder-block': responsiveStylesForSize,
           };
         }
       }
```

**File**: `packages/sdks-tests/src/e2e-tests/blocks.spec.ts` (modified, +13/-0)
```diff
@@ -137,6 +137,19 @@ test.describe('Blocks', () => {
       }
     });
 
+    test('Image position is responsive', async ({ page, sdk }) => {
+      test.skip(checkIsRN(sdk));
+
+      await page.goto('/image');
+
+      const images = page.locator('.builder-image');
+      await expect(images.first()).toHaveCSS('object-position', '0% 0%');
+      await expect(images.nth(1)).toHaveCSS('object-position', '50% 50%');
+
+      await page.setViewportSize({ width: 500, height: 720 });
+      await expect(images.first()).toHaveCSS('object-position', '100% 100%');
+    });
+
     test('Image alt attribute', async ({ page, sdk }) => {
       test.skip(checkIsRN(sdk));
 
```

**File**: `packages/sdks-tests/src/specs/image.ts` (modified, +8/-0)
```diff
@@ -63,6 +63,10 @@ export const CONTENT = {
             overflow: 'hidden',
             marginLeft: 'auto',
             maxWidth: '604px',
+            objectPosition: 'top left',
+          },
+          small: {
+            objectPosition: 'bottom right',
           },
         },
       },
@@ -265,6 +269,10 @@ export const CONTENT_2 = {
             overflow: 'hidden',
             marginLeft: 'auto',
             maxWidth: '604px',
+            objectPosition: 'top left',
+          },
+          small: {
+            objectPosition: 'bottom right',
           },
         },
       },
```

---

### Incident Patch 8: `456c70af` (2026-09-11)
**Commit Message**: fix[smartling][utils]: ENG-13890 exclude URL, image and link fields from translation jobs (#4852)

## Description

Image links, button URLs and page links from Builder content were all
showing up as strings for Smartling to translate.

**Root Cause:**
This is a regression from #4651 (June). That PR taught the extractor to
look inside a localized list or object and send each string it finds as
its own translation unit, which was the right fix for text fields that
were previously being skipped.

The catch is that the extractor has no idea what type a field is. So
once it starts walking a payload, it picks up every string in there.
`imageUrl`, `link` and `screenImage` are strings, so off they went.

We already patched one version of this in #4826, where the same walk was
sending dropdown values like "White" and "Left". That fix relied on the
editor recording which fields are non-translatable, which only helps for
localized list fields on blocks that carry that metadata. URLs on
symbols and on model fields go through different code paths and were
never covered.

**Fix:**
Added one small check: a string is not translatable if it has no
whitespace and starts with /, http://, https:// or 

**File**: `packages/utils/src/translation-helpers.test.ts` (modified, +286/-0)
```diff
@@ -1754,3 +1754,289 @@ test('applyTranslation seeds the source when an input had nothing to translate',
   // Without the locale branch the SDK renders undefined and the rows disappear.
   expect(rows['de-DE']).toEqual(rows.Default);
 });
+
+// URLs and asset references are routing values a translator cannot produce; sending them
+// pollutes the job and lets a translator overwrite a live link.
+const assetFieldsContent = (): BuilderContent => ({
+  data: {
+    heroImage: { '@type': localizedType, Default: 'https://cdn.builder.io/api/v1/image/hero.png' },
+    intro: { '@type': localizedType, Default: 'Visit https://example.com for more' },
+    blocks: [
+      {
+        '@type': '@builder.io/sdk:Element',
+        id: 'builder-slides',
+        meta: { localizedTextInputs: ['heroLink', 'slides'] },
+        component: {
+          name: 'Carousel',
+          options: {
+            heroLink: { '@type': localizedType, Default: 'https://example.com/en-gb/hero' },
+            slides: {
+              '@type': localizedType,
+              Default: [
+                {
+                  caption: 'Food and drink',
+                  imageUrl: 'https://cdn.builder.io/api/v1/image/slide.png',
+                  link: '/en-gb/business-types/food-and-drink',
+                },
+              ],
+            },
+          },
+        },
+      },
+      {
+        '@type': '@builder.io/sdk:Element',
+        id: 'builder-symbol',
+        component: {
+          name: 'Symbol',
+          options: {
+            symbol: {
+              data: {
+                buttonUrl: { '@type': localizedType, Default: 'https://example.com/en-gb' },
+                label: { '@type': localizedType, Default: 'Get started' },
+              },
+            },
+          },
+        },
+      },
+    ],
+  },
+});
+
+test('getTranslateableFields skips url and asset values but keeps prose containing a url', () => {
+  expect(getTranslateableFields(assetFieldsContent(), 'en-GB', 'instructions')).toEqual({
+    'metadata.intro': { value: 'Visit https://example.com for more', instructions: 'instructions' },
+    'blocks.builder-slides#slides#0#caption': {
+      value: 'Food and drink',
+      instructions: 'instructions',
+    },
+    'blocks.builder-symbol.symbolInput#label': {
+      value: 'Get started',
+      instructions: 'instructions',
+    },
+  });
+});
+
+test('applyTranslation keeps skipped urls readable in the target locale', () => {
+  const result = applyTranslation(
+    assetFieldsContent(),
+    {
+      'blocks.builder-slides#slides#0#caption': { value: 'Essen und Trinken' },
+      'blocks.builder-symbol.symbolInput#label': { value: 'Jetzt starten' },
+      'metadata.intro': { value: 'DE intro' },
+    },
+    'de-DE',
+    'en-GB'
+  );
+  const data = result.data as any;
+  const options = data.blocks[0].component.options;
+  const symbolData = data.blocks[1].component.options.symbol.data;
+
+  expect(options.slides['de-DE']).toEqual([
+    {
+      caption: 'Essen und Trinken',
+      imageUrl: 'https://cdn.builder.io/api/v1/image/slide.png',
+      link: '/en-gb/business-types/food-and-drink',
+    },
+  ]);
+  expect(options.heroLink['de-DE']).toEqual('https://example.com/en-gb/hero');
+  expect(symbolData.buttonUrl['de-DE']).toEqual('https://example.com/en-gb');
+  expect(data.heroImage['de-DE']).toEqual('https://cdn.builder.io/api/v1/image/hero.png');
+});
+
+test('applyTranslation does not seed real copy that a pending job has not returned yet', () => {
+  const result = applyTranslation(assetFieldsContent(), {}, 'de-DE', 'en-GB');
+  const data = result.data as any;
+
+  expect(data.blocks[1].component.options.symbol.data.label['de-DE']).toBeUndefined();
+  expect(data.intro['de-DE']).toBeUndefined();
+  expect(data.blocks[0].component.options.slides['de-DE']).toBeUndefined();
+});
+
+test('applyTranslation does not overwrite a url already localized for the target locale', () => {
+  const content = assetFieldsConten
```

**File**: `packages/utils/src/translation-helpers.ts` (modified, +77/-7)
```diff
@@ -14,6 +14,31 @@ export type TranslateableFields = {
   };
 };
 
+// A bare url or asset is routing config, never copy. Whitespace means prose
+// ("Visit https://x.com for more"), which stays translatable.
+function isNonTranslatableValue(value: string) {
+  const trimmed = value.trim();
+  if (!trimmed || /\s/.test(trimmed)) {
+    return false;
+  }
+  const lower = trimmed.toLowerCase();
+  return (
+    lower.startsWith('/') ||
+    // './x' and '../x' are clearly links. Bare 'foo/bar' is not: it looks like 'and/or'.
+    lower.startsWith('./') ||
+    lower.startsWith('../') ||
+    lower.startsWith('http://') ||
+    lower.startsWith('https://') ||
+    lower.startsWith('cdn.builder.io/') ||
+    lower.startsWith('mailto:') ||
+    lower.startsWith('tel:') ||
+    lower.startsWith('sms:') ||
+    lower.startsWith('data:') ||
+    // Bare '#' is an empty placeholder; '#anchor' looks like a hashtag, so it stays in.
+    lower === '#'
+  );
+}
+
 function unescapeStringOrObject(input: string | Record<string, any>) {
   // Check if input is a string
   if (typeof input === 'string') {
@@ -62,7 +87,7 @@ function recordValue({
       const extractedValue = value?.[sourceLocaleId] || value?.Default;
 
       // If the extracted value is a string, store it directly
-      if (typeof extractedValue === 'string') {
+      if (typeof extractedValue === 'string' && !isNonTranslatableValue(extractedValue)) {
         results[path] = {
           value: extractedValue,
           instructions,
@@ -103,6 +128,7 @@ function resolveTranslation({
   translation,
   transformedMeta,
   locale,
+  sourceLocaleId,
 }: {
   data: any;
   basePath: string;
@@ -112,6 +138,7 @@ function resolveTranslation({
   translation: any;
   transformedMeta: Record<string, string>;
   locale: string;
+  sourceLocaleId?: string;
 }) {
   if (Array.isArray(value)) {
     value.forEach((item, index) => {
@@ -124,6 +151,7 @@ function resolveTranslation({
         translation,
         transformedMeta,
         locale,
+        sourceLocaleId,
       });
     });
   } else if (typeof value === 'object' && value !== null) {
@@ -141,6 +169,16 @@ function resolveTranslation({
       } else {
         // No direct translation - check if Default value contains nested LocalizedValues
         const defaultValue = value?.Default;
+        // Restore a skipped leaf. Picking the source the same way the extractor does
+        // avoids seeding a url over prose still out for translation.
+        const skippedSource = (sourceLocaleId && value?.[sourceLocaleId]) || value?.Default;
+        if (
+          typeof skippedSource === 'string' &&
+          isNonTranslatableValue(skippedSource) &&
+          value[locale] == null
+        ) {
+          set(data, dataPath, { ...value, [locale]: skippedSource });
+        }
         if (
           Array.isArray(defaultValue) ||
           (typeof defaultValue === 'object' && defaultValue !== null)
@@ -156,6 +194,7 @@ function resolveTranslation({
             translation,
             transformedMeta,
             locale,
+            sourceLocaleId,
           });
         }
 
@@ -175,6 +214,7 @@ function resolveTranslation({
             translation,
             transformedMeta,
             locale,
+            sourceLocaleId,
           });
         }
       }
@@ -189,6 +229,7 @@ function resolveTranslation({
           translation,
           transformedMeta,
           locale,
+          sourceLocaleId,
         });
       });
     }
@@ -230,7 +271,7 @@ function extractNestedStrings(
   excluded?: Set<string>
 ) {
   if (typeof value === 'string') {
-    if (value && !isExcludedPath(excluded, basePath)) {
+    if (value && !isExcludedPath(excluded, basePath) && !isNonTranslatableValue(value)) {
       results[basePath] = { value, instructions };
     }
   } else if (Array.isArray(value)) {
@@ -250,7 +291,7 @@ function extractNestedStrings(
       const nested = value[sourceLocaleId] || value.Default;
       const nes
```

---

### Incident Patch 9: `08321f65` (2026-09-10)
**Commit Message**: fix[gen1][symbol]: ENG-13693 Editor flickers when using symbol with slot (#4849)

## Description

Blocks you drop into a Slot are not stored as normal children. They live
on the parent Symbol block under `symbol.data.<slotName>`, which you can
see in `Slot.tsx`:
`<BuilderBlocks dataPath={`symbol.data.${name}`}
blocks={context.state[name] || []} />`

`Symbol.tsx` builds the React key for its nested BuilderComponent from a
hash of that same symbol.data object. So every keystroke changed the
slot content, which changed the hash, which changed the key. React then
threw away the whole symbol subtree and rebuilt it.

This leads to the flickering in the editor when we try to update
content.

**Fix:**
Leave block arrays out of the key while editing. Slot content renders
through `BuilderBlocks` and already updates in place when the `data`
prop changes, so the remount was not buying us anything.

Live rendering keeps the exact key it has today, so nothing changes for
published pages.

**Link to JIRA ticket (if applicable):**
https://builder-io.atlassian.net/browse/ENG-13693

**Screenshot/Clip**
Bug: https://clips.agent-native.com/r/XujJySpqNeDH
Fix: https://clips.agent-native.com/r/1kFnRc088

**File**: `.changeset/lucky-moons-listen.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@builder.io/react': patch
+---
+
+Fix: editing a block inside a Symbol's Slot no longer remounts the Symbol. Slot content lives in `symbol.data.<slotName>`, which keyed the nested `BuilderComponent`, so every keystroke rebuilt the subtree and made the Visual Editor's inline edit popup flicker.
```

**File**: `packages/react/src/blocks/Symbol.tsx` (modified, +10/-1)
```diff
@@ -11,6 +11,14 @@ import { omit } from '../functions/utils';
 
 const size = (thing: object) => Object.keys(thing).length;
 
+const isBuilderElementArray = (value: any) =>
+  Array.isArray(value) && value.some(item => item?.['@type'] === '@builder.io/sdk:Element');
+
+// Slot content lives in `symbol.data.<name>`, so keying on it remounts the symbol on every edit to
+// a block inside a slot, tearing down the node the editor has selected. Blocks update in place.
+const omitBlockValues = (data: Record<string, any>) =>
+  omit(data, ...Object.keys(data).filter(key => isBuilderElementArray(data[key])));
+
 const isShopify = Builder.isBrowser && 'Shopify' in window;
 
 const refs: Record<string, Element> = {};
@@ -113,7 +121,8 @@ class SymbolComponent extends React.Component<PropsWithChildren<SymbolProps>> {
     }
 
     let key = dynamic ? this.props.builderBlock?.id : [model, entry].join(':');
-    const dataString = data && size(data) && hash(data);
+    const keyData = data && (Builder.isEditing ? omitBlockValues(data) : data);
+    const dataString = keyData && size(keyData) && hash(keyData);
 
     if (key && dataString && dataString.length < 300) {
       key += ':' + dataString;
```

**File**: `packages/react/test/symbol-slot-remount.test.tsx` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+/**
+ * @jest-environment jsdom
+ */
+
+import * as React from 'react';
+import { render } from '@testing-library/react';
+import { Builder, builder } from '@builder.io/sdk';
+import { BuilderPage } from '../src/builder-react';
+import { block } from './functions/render-block';
+
+builder.init('null');
+
+let mountCount = 0;
+
+const MountCounter = (props: { title?: string; testid?: string }) => {
+  React.useEffect(() => {
+    mountCount++;
+  }, []);
+  return <div data-testid={props.testid || 'counter'}>{props.title}</div>;
+};
+
+Builder.registerComponent(MountCounter, {
+  name: 'MountCounter',
+  inputs: [
+    { name: 'title', type: 'text' },
+    { name: 'testid', type: 'text' },
+  ],
+});
+
+const slotChild = (title: string, id = 'builder-child-1', testid?: string) =>
+  block('MountCounter', { title, testid }, { id } as any);
+
+const symbolBlock = (opts: {
+  id?: string;
+  entry?: string;
+  children?: any[];
+  heading?: string;
+  slotName?: string;
+}) =>
+  block(
+    'Symbol',
+    {
+      symbol: {
+        model: 'symbol',
+        entry: opts.entry || 'entry-1',
+        content: {
+          id: 'sym-1',
+          data: {
+            blocks: [
+              block('Slot', { name: opts.slotName || 'children' }, { id: 'builder-slot-1' } as any),
+            ],
+          },
+        },
+        data: {
+          ...(opts.heading !== undefined && { heading: opts.heading }),
+          [opts.slotName || 'children']: opts.children ?? [slotChild('A')],
+        },
+      },
+    },
+    { id: opts.id || 'builder-symbol-1' } as any
+  );
+
+const page = (blocks: any[]) => ({ id: 'page-1', data: { blocks } });
+
+describe('symbol + slot editing (editor)', () => {
+  beforeEach(() => {
+    mountCount = 0;
+    Builder.isEditing = true;
+  });
+
+  afterEach(() => {
+    Builder.isEditing = false;
+  });
+
+  it('does not remount slot children when their options change', () => {
+    const testApi = render(<BuilderPage model="page" content={page([symbolBlock({})]) as any} />);
+
+    const nodeBefore = testApi.getByTestId('counter');
+    expect(nodeBefore).toHaveTextContent('A');
+    expect(mountCount).toBe(1);
+
+    testApi.rerender(
+      <BuilderPage
+        model="page"
+        content={page([symbolBlock({ children: [slotChild('AB')] })]) as any}
+      />
+    );
+
+    expect(testApi.getByTestId('counter')).toBe(nodeBefore);
+    expect(nodeBefore).toHaveTextContent('AB');
+    expect(mountCount).toBe(1);
+  });
+
+  it('still applies adds and removes of slot children', () => {
+    const testApi = render(<BuilderPage model="page" content={page([symbolBlock({})]) as any} />);
+    expect(testApi.getByTestId('counter')).toHaveTextContent('A');
+
+    testApi.rerender(
+      <BuilderPage
+        model="page"
+        content={
+          page([
+            symbolBlock({
+              children: [slotChild('A'), slotChild('B', 'builder-child-2', 'counter-2')],
+            }),
+          ]) as any
+        }
+      />
+    );
+    expect(testApi.getByTestId('counter-2')).toHaveTextContent('B');
+
+    testApi.rerender(
+      <BuilderPage model="page" content={page([symbolBlock({ children: [] })]) as any} />
+    );
+    expect(testApi.queryByTestId('counter')).toBeNull();
+    expect(testApi.queryByTestId('counter-2')).toBeNull();
+  });
+
+  it('still remounts when a non-slot symbol input changes', () => {
+    const testApi = render(
+      <BuilderPage model="page" content={page([symbolBlock({ heading: 'one' })]) as any} />
+    );
+    const nodeBefore = testApi.getByTestId('counter');
+    expect(mountCount).toBe(1);
+
+    testApi.rerender(
+      <BuilderPage model="page" content={page([symbolBlock({ heading: 'two' })]) as any} />
+    );
+
+    expect(testApi.getByTestId('counter')).not.toBe(nodeBefore);
+    expect(mountCount).toBe(2);
+  });
+
+  it('renders two instances of the same symbol with different slot content', () => {
+    const testApi = render(
+      <
```

---

### Incident Patch 10: `5604e14e` (2026-09-07)
**Commit Message**: fix[abTests][gen1]: ENG-13175 A/B Variation Hydration Mismatch on First Server Render (#4844)

## Description

When you preview a non-default A/B variation, the page briefly shows the
default variation before switching to the one you asked for. This causes
a layout shift and a React hydration error. Reloading fixes it, so it
only happens on the first visit.

**Root Cause:**
The editor's preview link carries the chosen variation in the URL as
`builder.tests.<contentId>=<variationId>`, but nothing reads it early
enough:

- The server doesn't look at it, so the HTML ships all variations.
- The inlined variants script only checks the cookie. On a first visit
there is no cookie, so it picks a variation at random, usually the
default.
- The SDK then writes the URL's variation into the cookie, and React
hydrates with that value. It no longer matches the DOM, so React
re-renders and you see the switch.

**Fix:**
Both places that choose a variation now check the URL parameter first,
then fall back to the cookie, then to the random assignment as before:

- the inlined SSR script, so the correct variation is on screen at first
paint
- `VariantsProvider`'s browser branch, so hydration agrees w

**File**: `.changeset/tricky-pugs-invite.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@builder.io/react': patch
+---
+
+Fix: A/B test variation previews no longer flash the default variation before switching. The `builder.tests.<contentId>` URL parameter is now applied when the SSR variants script selects a variation, so the first paint matches what React renders during hydration.
```

**File**: `packages/react/src/components/variants-provider.component.tsx` (modified, +51/-2)
```diff
@@ -18,6 +18,28 @@ function getData(content: BuilderContentVariation) {
   return newData;
 }
 
+// Mirrors the precedence used by the inlined variants script below, so that the DOM
+// the script produces before hydration matches what React renders while hydrating.
+function getVariantIdFromUrl(contentId: string) {
+  const search = (Builder.isBrowser && location.search) || '';
+  if (search.indexOf('builder') === -1) {
+    return null;
+  }
+  const names = ['builder.tests.' + contentId, 'builder_tests_' + contentId];
+  const entries = (search.charAt(0) === '?' ? search.substring(1) : search).split('&');
+  for (const entry of entries) {
+    const parts = entry.split('=');
+    if (names.indexOf(parts[0]) > -1) {
+      try {
+        return decodeURIComponent(parts[1] || '');
+      } catch (err) {
+        return parts[1] || null;
+      }
+    }
+  }
+  return null;
+}
+
 const variantsScript = (variantsString: string, contentId: string) =>
   `
 (function() {
@@ -58,11 +80,34 @@ const variantsScript = (variantsString: string, contentId: string) =>
     }
     return null;
   }
+  function getVariantFromUrl() {
+    var search = location.search || '';
+    if (search.indexOf('builder') === -1) {
+      return null;
+    }
+    var names = ['builder.tests.${contentId}', 'builder_tests_${contentId}'];
+    var entries = (search.charAt(0) === '?' ? search.substring(1) : search).split('&');
+    for (var i = 0; i < entries.length; i++) {
+      var parts = entries[i].split('=');
+      if (names.indexOf(parts[0]) > -1) {
+        try {
+          return decodeURIComponent(parts[1] || '');
+        } catch (err) {
+          return parts[1] || null;
+        }
+      }
+    }
+    return null;
+  }
   var cookieName = 'builder.tests.${contentId}';
   var variantInCookie = getCookie(cookieName);
   var availableIDs = variants.map(function(vr) { return vr.id }).concat('${contentId}');
   var variantId;
-  if (availableIDs.indexOf(variantInCookie) > -1) {
+  var variantInUrl = getVariantFromUrl();
+  if (availableIDs.indexOf(variantInUrl) > -1) {
+    variantId = variantInUrl;
+    setCookie(cookieName, variantId);
+  } else if (availableIDs.indexOf(variantInCookie) > -1) {
     variantId = variantInCookie;
   }
   if (!variantId) {
@@ -141,7 +186,11 @@ export const VariantsProvider = ({ initialContent, children, nonce }: VariantsPr
 
   const cookieName = `builder.tests.${initialContent.id}`;
 
-  let variantId = builder.getCookie(cookieName);
+  const variantIdFromUrl = getVariantIdFromUrl(initialContent.id!);
+
+  let variantId = allVariants.some(item => item.id === variantIdFromUrl)
+    ? variantIdFromUrl
+    : builder.getCookie(cookieName);
 
   if (!variantId && Builder.isBrowser) {
     let n = 0;
```

**File**: `packages/react/test/variants-ab-hydration.test.tsx` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/**
+ * @jest-environment jsdom
+ * @jest-environment-options {"url": "https://example.com/?builder.tests.contentid1=variationa1"}
+ */
+jest.mock(
+  'src/functions/extract-localized-values',
+  () => ({ containsLocalizedValues: () => false, extractLocalizedValues: () => ({}) }),
+  { virtual: true }
+);
+
+import React from 'react';
+import { TextEncoder, TextDecoder } from 'util';
+
+Object.assign(global, { TextEncoder, TextDecoder });
+
+import { BuilderComponent } from '../src/components/builder-component.component';
+import { builder } from '@builder.io/sdk';
+
+builder.init('abc123');
+
+const CONTENT_ID = 'contentid1';
+const VARIATION_ID = 'variationa1';
+
+const textBlock = (text: string) => ({
+  '@type': '@builder.io/sdk:Element' as const,
+  id: 'blk-' + text,
+  component: { name: 'Text', options: { text } },
+});
+
+const content: any = {
+  id: CONTENT_ID,
+  name: 'test',
+  data: { blocks: [textBlock('CONTROL')] },
+  variations: {
+    [VARIATION_ID]: {
+      id: VARIATION_ID,
+      name: 'Variation A',
+      // Below the mocked Math.random (0.1234), so the random path never picks it.
+      testRatio: 0.05,
+      data: { blocks: [textBlock('VARIATION_A')] },
+    },
+  },
+};
+
+test('browser render honours the builder.tests url param when the cookie is unavailable', () => {
+  document.cookie = 'builder.tests.' + CONTENT_ID + '=; Max-Age=0; path=/';
+  expect(document.cookie).not.toContain(VARIATION_ID);
+
+  const { renderToString } = require('react-dom/server');
+  const html = renderToString(<BuilderComponent model="page" content={content} />);
+
+  // Must match what the inlined script put in the DOM before hydration.
+  expect(html).toContain('blk-VARIATION_A');
+  expect(html).not.toContain('blk-CONTROL');
+});
```

**File**: `packages/react/test/variants-ab-ssr.test.tsx` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+jest.mock(
+  'src/functions/extract-localized-values',
+  () => ({ containsLocalizedValues: () => false, extractLocalizedValues: () => ({}) }),
+  { virtual: true }
+);
+
+import React from 'react';
+import { renderToString } from 'react-dom/server';
+import { JSDOM } from 'jsdom';
+import { CookieJar } from 'tough-cookie';
+import { BuilderComponent } from '../src/components/builder-component.component';
+import { builder } from '@builder.io/sdk';
+
+builder.init('abc123');
+
+const CONTENT_ID = 'contentid1';
+const VARIATION_ID = 'variationa1';
+
+const textBlock = (text: string) => ({
+  '@type': '@builder.io/sdk:Element' as const,
+  id: 'blk-' + text,
+  component: { name: 'Text', options: { text } },
+});
+
+const getContent = () => ({
+  id: CONTENT_ID,
+  name: 'test',
+  data: { blocks: [textBlock('CONTROL')] },
+  variations: {
+    [VARIATION_ID]: {
+      id: VARIATION_ID,
+      name: 'Variation A',
+      // Lower than the mocked Math.random (0.1234), so the random path never
+      // picks this variation. Anything that selects it did so deliberately.
+      testRatio: 0.05,
+      data: { blocks: [textBlock('VARIATION_A')] },
+    },
+  },
+});
+
+const ssrHtml = () =>
+  renderToString(<BuilderComponent model="page" content={getContent() as any} />);
+
+/** Parses the SSR output in jsdom, which runs the inlined variants script as a browser would. */
+const runInBrowser = (html: string, { url, cookie }: { url: string; cookie?: string }) => {
+  const cookieJar = new CookieJar();
+  if (cookie) {
+    cookieJar.setCookieSync(cookie + '; Path=/', url);
+  }
+  const dom = new JSDOM('<html><body>' + html + '</body></html>', {
+    url,
+    cookieJar,
+    runScripts: 'dangerously',
+    // the inlined script runs inside this window, so it needs its own stub. 0.9999 is
+    // above every testRatio below, so the random path always lands on the control.
+    beforeParse(window) {
+      window.Math.random = () => 0.9999;
+    },
+  });
+  return dom.window.document.body.innerHTML;
+};
+
+const CONTROL_BLOCK = 'blk-CONTROL';
+const VARIATION_BLOCK = 'blk-VARIATION_A';
+
+describe('SSR a/b test variant selection', () => {
+  test('inlined variants script is syntactically valid', () => {
+    const script = ssrHtml().match(/<script id="variants-script-[^"]+">([\s\S]*?)<\/script>/);
+    expect(script).toBeTruthy();
+    expect(() => new Function(script![1])).not.toThrow();
+  });
+
+  test('builder.tests url param wins over the random assignment', () => {
+    const text = runInBrowser(ssrHtml(), {
+      url: `https://example.com/?builder.tests.${CONTENT_ID}=${VARIATION_ID}`,
+    });
+    expect(text).toContain(VARIATION_BLOCK);
+    expect(text).not.toContain(CONTROL_BLOCK);
+  });
+
+  test('url param is ignored when it is not a known variation', () => {
+    const text = runInBrowser(ssrHtml(), {
+      url: `https://example.com/?builder.tests.${CONTENT_ID}=not-a-variation`,
+    });
+    expect(text).toContain(CONTROL_BLOCK);
+    expect(text).not.toContain(VARIATION_BLOCK);
+  });
+
+  test('falls back to the cookie when no url param is present', () => {
+    const text = runInBrowser(ssrHtml(), {
+      url: 'https://example.com/',
+      cookie: `builder.tests.${CONTENT_ID}=${VARIATION_ID}`,
+    });
+    expect(text).toContain(VARIATION_BLOCK);
+    expect(text).not.toContain(CONTROL_BLOCK);
+  });
+
+  test('falls back to the random assignment with no url param and no cookie', () => {
+    const text = runInBrowser(ssrHtml(), { url: 'https://example.com/' });
+    expect(text).toContain(CONTROL_BLOCK);
+    expect(text).not.toContain(VARIATION_BLOCK);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #4882** (2026-09-30): 📦 Publish SDKs (@builder-io-integration[bot])
- **PR #4880** (2026-09-30): fix(sdks): review fixes for gen2 perf pass (#4874) (@mrkoreye)
- **PR #4879** (closed): Fix Bynder plugin deleting selected block on Backspace (@JasonYangCIS)
- **PR #4878** (2026-09-30): fix[sdks][set]: ENG-14025 block prototype pollution via __proto__, constructor and prototype binding keys (@floating-dynamo)
- **PR #4873** (2026-09-29): 📦 Publish SDKs (@builder-io-integration[bot])
- **PR #4869** (2026-09-29): fix[gen2]: ENG-14049 prevent URL parameters from overriding API key (@floating-dynamo)
- **PR #4868** (2026-09-28): 📦 Publish SDKs (@builder-io-integration[bot])
- **PR #4866** (2026-09-25): fix[sdk-tests]: mock Studio refetch in personalization container e2e test (@AishwaryaParab)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
