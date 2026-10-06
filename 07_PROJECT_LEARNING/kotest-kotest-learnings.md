# Forensic Learning Record (Deep Inspection): kotest/kotest

> **Canonical Artifact**: `07_PROJECT_LEARNING/kotest-kotest-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kotest/kotest](https://github.com/kotest/kotest))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:47:27.939Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kotest/kotest`
- **Description**: Powerful, elegant and flexible test framework for Kotlin with assertions, property testing and data driven tests.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4789 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `documentation/babel.config.js`
```
module.exports = {
  presets: [require.resolve('@docusaurus/core/lib/babel/preset')],
};

```

### Core Architecture Module: `documentation/docusaurus.config.js`
```
module.exports = {
   title: 'Kotest',
   tagline: 'Flexible and elegant multiplatform test framework, assertions, and property test library for Kotlin',
   url: 'https://kotest.io',
   baseUrl: '/',
   onBrokenLinks: 'throw',
   onBrokenMarkdownLinks: 'throw',
   markdown: {
      format: 'detect',
   },
   favicon: 'img/favicon.ico',
   organizationName: 'kotest', // Usually your GitHub org/user name.
   projectName: 'kotest.io', // Usually your repo name.
   themeConfig: {
      algolia: {
         // The application ID provided by Algolia
         appId: 'UGZ6V0USY6',

         // Public API key: it is safe to commit it
         apiKey: 'f170b39d801f28d7bf2deb2a4a731908',

         indexName: 'kotest',

         // Contextual search is enabled by default.
         // It ensures that search results are relevant to the current language and version.
         // contextualSearch: true,

         // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
         // externalUrlRegex: 'external\\.com|domain\\.com',

         // Optional: Algolia search parameters
         searchParameters: {},

         // Optional: path for search page that enabled by default (`false` to disable it)
         searchPagePath: 'search',

         //... other Algolia params
      },
      navbar: {
         title: 'Kotest',
         logo: {
            alt: 'Kotest',
            src: 'img/logo.png',
         },
         items: [
            {
               type: 'doc',
               docId: 'quickstart',
               label: 'Overview',
               position: 'left'
            },
            {
               type: 'doc',
               docId: 'framework/index',
               label: 'Framework',
               position: 'left'
            },
            {
               type: 'doc',
               docId: 'extensions/index',
               label: 'Extensions',
               position: 'left'
            },
            {
               type: 'doc',
               docId: 'assertions/index',
               label: 'Assertions',
               position: 'left'
            },
            {
               type: 'doc',
               docId: 'proptest/index',
               label: 'Property Testing',
               position: 'left'
            },
            {
               type: 'doc',
               docId: 'intellij/index',
               label: 'Intellij Plugin',
               position: 'left'
            },
            {
               type: 'doc',
               docId: 'ai/index',
               label: 'AI',
               position: 'left'
            },
            {
               type:'search',
               position: 'right'
            },
            {
               type: 'docsVersionDropdown',
               position: 'right',
               dropdownActiveClassDisabled: true,
            },
            {
               href: 'https://github.com/kotest/kotest',
               className: 'header-github-link',
               'aria-label': 'GitHub repository',
               position: 'right',
            },
         ],
      },
      footer: {
         style: 'dark',
         links: [
            {
               title: 'Community',
               items: [
                  {
                     label: 'Slack',
                     href: 'https://kotlinlang.slack.com/archives/CT0G9SD7Z',
                  },
                  {
                     label: 'Github',
                     href: 'https://github.com/kotest/kotest',
                  },
                  {
                     label: 'Stack Overflow',
                     href: 'https://stackoverflow.com/questions/tagged/kotest',
                  },
               ],
            },
            {
               title: 'Updates',
               items: [
                  {
                     label: 'Changelog',
                     href: 'https://github.com/kotest/kotest/releases',
                  },
                  {
                     label: 'Releases',
                     href: 'https://github.com/kotest/kotest/releases',
                  },
                  {
                     label: 'Blogs and articles',
                     href: 'https://kotest.io/docs/next/blogs',
                  },
               ],
            },
         ],
         copyright: `Copyright © ${new Date().getFullYear()} Kotest Team. Built with Docusaurus.`,
      },
      prism: {
         additionalLanguages: ['kotlin', 'groovy'],
         theme: require('prism-react-renderer').themes.github,
         darkTheme: require('prism-react-renderer').themes.dracula,
      },
   },
   presets: [
      [
         '@docusaurus/preset-classic',
         {
            theme: {
               customCss: [require.resolve('./src/css/custom.css')],
            },
            docs: {
               versions: {
                  current: {
                     label: `6.3 🚧`,
                  },
               },
               sidebarPath: require.resolve('./sidebars.js'),
               editUrl: 'https://github.com/kotest/kotest/blob/master/documentation',
            }
         },
      ],
   ],
   plugins: [
      [
         '@docusaurus/plugin-client-redirects',
         {
            redirects: [
               {
                  to: '/docs/quickstart',
                  from: ['/quick_start'],
               },
               {
                  to: '/docs/assertions/clues.html',
                  from: ['/clues'],
               },
               {
                  to: '/docs/framework/testing-styles.html',
                  from: ['/styles'],
               },
            ],
         },
      ],
   ]
};

```

### Core Architecture Module: `documentation/sidebars.js`
```
module.exports = {
  "docs": [
    "quickstart",
    "release6",
    "blogs"
  ],
  "ai": [
    "ai/index"
  ],
  "proptest": [
    "proptest/index",
    "proptest/testfunctions",
    "proptest/gens",
    "proptest/genslist",
    "proptest/genops",
    "proptest/assumptions",
    "proptest/seeds",
    "proptest/proptestconfig",
    "proptest/customgens",
    "proptest/shrinking",
    "proptest/statistics",
    "proptest/globalconfig",
    "proptest/permutations",
    "proptest/arrow",
    "proptest/date_gens",
    "proptest/extra_arbs",
    "proptest/reflective_arbs"
  ],
  "intellij": [
    "intellij/index",
    "intellij/test_explorer",
    "intellij/props"
  ],
  "extensions": [
     "extensions/index",
     "extensions/allure",
     "extensions/blockhound",
     "extensions/clock",
     "extensions/decoroutinator",
     "extensions/instant",
     "extensions/junit_xml",
     "extensions/koin",
     "extensions/ktor",
     "extensions/html_reporter",
     "extensions/mockserver",
     "extensions/pitest",
     "extensions/spring",
     "extensions/system_extensions",
     "extensions/test_containers",
     "extensions/wiremock"
  ],
  "assertions": [
    "assertions/index",
    "assertions/matchers",
    "assertions/shouldbe",
    "assertions/custom_matchers",
    "assertions/composed_matchers",
    "assertions/exceptions",
    "assertions/similarity",
    "assertions/power-assert",
    "assertions/clues",
    "assertions/soft_assertions",
    {
      "type": "category",
      "label": "Non-deterministic Testing",
      "collapsed": false,
      "items": [
        "assertions/eventually",
        "assertions/continually",
        "assertions/until",
        "assertions/retry"
      ]
    },
    "assertions/inspectors",
    "assertions/assertion_mode",
    {
      "type": "category",
      "label": "Matcher Modules",
      "collapsed": false,
      "items": [
        "assertions/core",
        {
          "type": "category",
          "label": "JSON",
          "collapsed": true,
          "link": {
            "type": "doc",
            "id": "assertions/json/overview"
          },
          "items": [
            "assertions/json/overview",
            "assertions/json/content",
            "assertions/json/schema"
          ]
        },
        "assertions/ktor",
        "assertions/kotlinx_datetime",
        "assertions/arrow",
        "assertions/sql-matchers",
        "assertions/konform",
        "assertions/compiler",
        "assertions/field-matching",
        "assertions/jsoup",
        "assertions/ranges",
        "assertions/yaml"
      ]
    }
  ],
  "framework": [
    "framework/index",
    "framework/setup",
    "framework/writing_tests",
    "framework/styles",
    "framework/custom_styles",
    {
      "type": "category",
      "label": "Conditional Evaluation",
      "collapsed": true,
      "items": [
        "framework/conditional/enabled_config_flags",
        "framework/conditional/focus_and_bang",
        "framework/conditional/xmethods",
        "framework/conditional/annotations",
        "framework/conditional/conditional_exceptions",
        "framework/conditional/gradle"
      ]
    },
    "framework/isolation_mode",
    "framework/concurrency6",
    "framework/lifecycle_hooks",
    {
      "type": "category",
      "label": "Extensions",
      "collapsed": true,
      "items": [
        "framework/extensions/extensions_introduction",
        "framework/extensions/simple_extensions",
        "framework/extensions/advanced_extensions",
        "framework/extensions/extension_examples",
        "framework/extensions/mountables"
      ]
    },
    {
      "type": "category",
      "label": "Coroutines",
      "collapsed": true,
      "items": [
        "framework/coroutines/test_coroutine_dispatcher",
        "framework/coroutines/coroutine_debugging"
      ]
    },
    "framework/exceptions",
    {
      "type": "category",
      "label": "Data Driven Testing",
      "collapsed": true,
      "items": [
        "framework/datatesting/introduction",
        "framework/datatesting/test_names",
        "framework/datatesting/nested"
      ]
    },
    {
      "type": "category",
      "label": "Non-deterministic Testing",
      "collapsed": true,
      "items": [
        "assertions/eventually",
        "assertions/continually",
        "assertions/until",
        "assertions/retry"
      ]
    },
    {
      "type": "category",
      "label": "Integrations",
      "collapsed": true,
      "items": [
        "framework/integrations/mocks",
        "framework/integrations/jacoco"
      ]
    },
    {
      "type": "category",
      "label": "Ordering",
      "collapsed": true,
      "items": [
        "framework/spec_ordering",
        "framework/test_ordering"
      ]
    },
    "framework/tags",
    {
      "type": "category",
      "label": "Resources",
      "collapsed": true,
      "items": [
        "framework/autoclose",
        "framework/tempfile"
      ]
    },
    {
      "type": "category",
      "label": "Configuration",
      "collapsed": true,
      "items": [
        "framework/test_case_config",
        "framework/project_config",
        "framework/package_level_config",
        "framework/shared_test_config",
        "framework/framework_config_props"
      ]
    },
    "framework/test_factories",
    "framework/fake_functions",
    "framework/race_conditions",
    "framework/test_output",
    {
      "type": "category",
      "label": "Timeouts",
      "collapsed": true,
      "items": [
        "framework/timeouts/test_timeouts",
        "framework/timeouts/project_timeout",
        "framework/timeouts/blocking_tests"
      ]
    },
    {
      "type": "category",
      "label": "Other settings",
      "collapsed": true,
      "items": [
        "framework/fail_fast",
        "framework/fail_on_empty",
        "framework/config_dump"
      ]
    }
  ]
};

```

### Core Architecture Module: `documentation/src/pages/index.js`
```
import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const features = [
   {
      title: 'Test Framework',
      imageUrl: 'img/index_graphic_test_framework.png',
      description: (
         <>
            The Kotest test framework supports multiple test styles with unlimited nesting, natural language test names, and coroutine support at every level.
            <br/><br/>
            The out of the box DSL provides support for parameterized tests, data-driven testing, conditional evaluation, test lifecycle callbacks, extensive parallelism and more.
            <br/><br/>
            <a href="/docs/framework/framework.html">Read more</a>
         </>
      ),
   },
   {
      title: 'Multiplatform Support',
      imageUrl: 'img/index_graphic_kmp.png',
      description: (
         <>
            Kotest is fully multiplatform with support for JVM, JS, Native (Linux, Windows, iOS, macOS, tvOS, watchOS), Wasm, and Android unit and instrumented tests.
            <br/><br/>
            Multiplatform support leverages the existing Kotlin Gradle tasks for seamless integration into the Kotlin ecosystem.
            <br/><br/>
            <a href="/docs/framework/framework.html">Read more</a>
         </>
      ),
   },
   {
      title: 'Powerful Assertions',
      imageUrl: 'img/index_graphic_assertions.png',
      description: (
         <>
            The assertions library provides over 350 rich assertions to verify code state with fluent, expressive, and idiomatic Kotlin syntax.
            <br/><br/>
            It comes equipped with collection inspectors, non-determistic utilities, grouped assertion support, support for power-assertion and extensions for
            Arrow, JSON, kotlinx-datetime and more.
            <br/><br/>
            <a href="/docs/assertions/assertions.html">Read more</a>
         </>
      ),
   },
   {
      title: 'Property Testing',
      imageUrl: 'img/index_graphic_property_testing.png',
      description: (
         <>
            The property testing module uses Kotlin's powerful DSL support to create succinent and powerful property
            based tests.
            <br/><br/>
            It supports generating values for over 100 types, failure shrinking, compose and extend generators,
            exhaustive checks, repeatable random seeds, coverage metrics, and more.
            <br/><br/>
            <a href="/docs/proptest/property-based-testing.html">Read more</a>
         </>
      ),
   },
   {
      title: 'Third Party Extensions',
      imageUrl: 'img/index_graphic_extensions.png',
      description: (
         <>
            Many projects in the Kotlin and JVM ecosystem have Kotest integration available, such as Spring, Koin, Test Containers, Blockhound, Micronaut and more.
            <br/><br/>
            It is easy to add your own integration using Kotest's extensive extensibility model.
            <br/><br/>
            <a href="/docs/extensions/extensions.html">Read more</a>
         </>
      ),
   },
];

function Feature({imageUrl, title, description}) {
   const imgUrl = useBaseUrl(imageUrl);
   return (
      <div className={clsx('col col--4', styles.feature)}>
         {imgUrl && (
            <div className="text--center">
               <img className={styles.featureImage} src={imgUrl} alt={title}/>
            </div>
         )}
         <h3>{title}</h3>
         <p>{description}</p>
      </div>
   );
}

function Home() {
   const context = useDocusaurusContext();
   const {siteConfig = {}} = context;
   return (
      <Layout
         title="Kotest"
         description="Flexible, powerful and elegant kotlin test framework with multiplatform support">
         <header className={clsx('hero hero--primary', styles.heroBanner)}>
            <div className="container">
               <p className={clsx(styles.heroSlogan)}>
                  Kotest is a <strong>multiplatform</strong> Kotlin test framework with powerful <strong>assertions</strong>, integrated <strong>property</strong> testing, and multiple expressive <strong>styles</strong>.
               </p>
               <div className={styles.buttons}>
                  <Link
                     className={clsx(
                        'button button--outline button--secondary button--lg',
                        styles.gettingStartedButton,
                     )}
                     to={useBaseUrl('docs/quickstart')}>
                     Get Started
                  </Link>

                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

                  <iframe
                     src="https://ghbtns.com/github-btn.html?user=kotest&repo=kotest&type=star&count=true&size=large"
                     frameBorder="0" scrolling="0" width="170" height="30" title="GitHub"/>

               </div>
            </div>
         </header>
         <main>
            <section className={styles.features}>
               <div className="container">
                  <div className="row">
                     <a href="https://kotlinlang.slack.com/archives/CT0G9SD7Z">
                        <img
                           src="https://img.shields.io/static/v1?label=kotlinlang&message=kotest&color=blue&logo=slack&style=for-the-badge"
                           alt="Slack"/>
                     </a>

                     &nbsp;

                     <a href="https://search.maven.org/search?q=g:io.kotest%20OR%20g:io.kotest.extensions">
                        <img
                           src="https://img.shields.io/maven-central/v/io.kotest/kotest-property.svg?label=release&style=for-the-badge"
                           alt="version badge"/>
                     </a>

                     &nbsp;

                     <a href="https://central.sonatype.com/repository/maven-snapshots/io/kotest/kotest-framework-engine/maven-metadata.xml">
                        <img
                           src="https://img.shields.io/maven-metadata/v?metadataUrl=https%3A%2F%2Fcentral.sonatype.com%2Frepository%2Fmaven-snapshots%2Fio%2Fkotest%2Fkotest-framework-engine%2Fmaven-metadata.xml&style=for-the-badge"
                           alt="link"/>
                     </a>

                     &nbsp;

                     <a href="https://github.com/kotest/kotest/blob/master/LICENSE">
                        <img
                           src="https://img.shields.io/badge/license-apache2.0-green?style=for-the-badge"
                           alt="license"/>
                     </a>

                     &nbsp;

                     <a href="https://stackoverflow.com/questions/tagged/kotest">
                        <img
                           src="https://img.shields.io/badge/stackoverflow-kotest-blue?style=for-the-badge"
                           alt="stack overflow"/>
                     </a>
                  </div>
                  <div className={clsx('row', styles.featuresRow)}>
                     {features.map((props, idx) => (
                        <Feature key={idx} {...props} />
                     ))}
                  </div>
               </div>
            </section>
         </main>
      </Layout>
   );
}

export default Home;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6240** (2026-09-26): **propagate coroutine context via TestCoroutineInterceptor**
  *Symptoms*: <!--  If this PR updates documentation, please update all relevant versions of the docs, see: https://github.com/kotest/kotest/tree/master/documentation/versioned_docs The documentation at https://github.com/kotest/kotest/tree/master/documentation/docs is the documentation for the next minor or major version _TO BE RELEASED_ --> propagate coroutine context via TestCoroutineInterceptor. I noticed this as I tried to use `coroutineTestScope` in a Spring test and got `IllegalStateException: No TestContextManager defined in this coroutine` - this should ensure that the whole context (except what is not required) gets passed through

- **Issue #6239** (2026-09-25): **release gradle plugin along core deps for consistency**
  *Symptoms*: <!--  If this PR updates documentation, please update all relevant versions of the docs, see: https://github.com/kotest/kotest/tree/master/documentation/versioned_docs The documentation at https://github.com/kotest/kotest/tree/master/documentation/docs is the documentation for the next minor or major version _TO BE RELEASED_ --> follow up of https://github.com/kotest/kotest/pull/6238#pullrequestreview-5318095165

- **Issue #6238** (2026-09-25): **Expose kotestVersion on the Kotest Gradle plugin extension**
  *Symptoms*: <!-- If this PR updates documentation, please update all relevant versions of the docs, see: https://github.com/kotest/kotest/tree/master/documentation/versioned_docs The documentation at https://github.com/kotest/kotest/tree/master/documentation/docs is the documentation for the next minor or major version _TO BE RELEASED_ -->  Fixes #6231  The `io.kotest` plugin adds some Kotest dependencies itself: the symbol processor for KSP, and `kotest-assertions-core` when power assert is enabled. It uses its own version for them, but that version wasn't exposed anywhere, so builds had to keep a separate version property for any other Kotest modules they use.  ### Changes  - `KotestGradleExtension` gets a `kotestVersion: Property<String>`. The plugin sets it to the version it already uses for those dependencies and then calls `disallowChanges()`, so it's read-only. Setting it fails with Gradle's "cannot be changed any further" error instead of being silently ignored. - Updated the API dump. - Added a short note to the Kotest Gradle plugin section of `documentation/docs/framework/setup.mdx`. I only changed the unreleased docs because this is a new feature. - The plugin module didn't have any tests yet, so I added a test source set that runs Kotest on the JUnit Platform, like the rest of the repo. The new `ProjectBuilder` test applies the plugin, checks the value and checks that it can't be changed.  Usage:  ```kotlin plugins {    id("io.kotest") version "<kotest-version>" }  kotlin {  

- **Issue #6233** (2026-09-17): **Fix outdated doc reference to kotlinx-datetime proptest artifact**
  *Symptoms*: This artifact was moved to the core io.kotest group, but the doc was not updated  Renamed io.kotest.extensions to io.kotest  Fixes #6232  <!--  If this PR updates documentation, please update all relevant versions of the docs, see: https://github.com/kotest/kotest/tree/master/documentation/versioned_docs The documentation at https://github.com/kotest/kotest/tree/master/documentation/docs is the documentation for the next minor or major version _TO BE RELEASED_ --> 

- **Issue #6231** (2026-09-25): **expose library version of Gradle plugin**
  *Symptoms*: It would be more handy if the Gradle plugin exposes the version used internally for kotest library dependencies. Currently you have to manage the plugin version and a property with (typically the same) version to be used for additional kotest test dependencies of the project.  The Kotlin plugin itself has such a feature (you can use `kotlin.coreLibrariesVersion`), it would be nice to habe something similar in the `KotestGradleExtension`.

- **Issue #6230** (2026-09-15): **fix(kotest-tests-timeout-project): Format timeout in exception message**
  *Symptoms*: Prior to this commit, a timeout of `20m` was formatted as `1.2s seconds` (sic!). 
  **Post-Mortem & Fix Analysis**:
  > LGTM. why are some build steps failing?
  > Looks like an unrelated failure of `SourceRefTest > source ref should be performant`

- **Issue #6228** (2026-09-11): **Bump kotest-skills plugin version to 6.2.5**
  *Symptoms*: Automated version bump for the kotest-skills plugin as part of the 6.2.5 release.

- **Issue #6226** (2026-09-09): **add back jsoup assertions**
  *Symptoms*: <!--  If this PR updates documentation, please update all relevant versions of the docs, see: https://github.com/kotest/kotest/tree/master/documentation/versioned_docs The documentation at https://github.com/kotest/kotest/tree/master/documentation/docs is the documentation for the next minor or major version _TO BE RELEASED_ --> `kotest-assertions-jsoup` was never ported to the main repo, and the old archive started failing after 6.x due to the new way of declaring Matchers - this ports it into the main repo

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

### Incident Patch 1: `8fabcdb6` (2026-09-17)
**Commit Message**: Fix outdated doc reference to kotlinx-datetime proptest artifact (#6233)

This artifact was moved to the core io.kotest group, but the doc was not
updated

Renamed io.kotest.extensions to io.kotest

Fixes #6232

<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->

**File**: `documentation/versioned_docs/version-6.1/proptest/date_gens.md` (modified, +2/-2)
```diff
@@ -8,10 +8,10 @@ sidebar_label: Kotlinx DateTime
 Kotest provides an optional module that provides generators for [KotlinX DateTime](https://github.com/Kotlin/kotlinx-datetime).
 
 :::note
-To use, add `io.kotest.extensions:kotest-property-datetime:version` to your build.
+To use, add `io.kotest:kotest-property-datetime:version` to your build.
 :::
 
-[<img src="https://img.shields.io/maven-central/v/io.kotest.extensions/kotest-property-datetime?label=latest%20release"/>](https://search.maven.org/search?q=kotest-property-datetime)
+[<img src="https://img.shields.io/maven-central/v/io.kotest/kotest-property-datetime?label=latest%20release"/>](https://search.maven.org/search?q=kotest-property-datetime)
 
 
 | Generator                                                      | Description                                                                                                                       | JVM | JS  | Native |
```

**File**: `documentation/versioned_docs/version-6.2/proptest/date_gens.md` (modified, +2/-2)
```diff
@@ -8,10 +8,10 @@ sidebar_label: Kotlinx DateTime
 Kotest provides an optional module that provides generators for [KotlinX DateTime](https://github.com/Kotlin/kotlinx-datetime).
 
 :::note
-To use, add `io.kotest.extensions:kotest-property-datetime:version` to your build.
+To use, add `io.kotest:kotest-property-datetime:version` to your build.
 :::
 
-[<img src="https://img.shields.io/maven-central/v/io.kotest.extensions/kotest-property-datetime?label=latest%20release"/>](https://search.maven.org/search?q=kotest-property-datetime)
+[<img src="https://img.shields.io/maven-central/v/io.kotest/kotest-property-datetime?label=latest%20release"/>](https://search.maven.org/search?q=kotest-property-datetime)
 
 
 | Generator                                                      | Description                                                                                                                       | JVM | JS  | Native |
```

---

### Incident Patch 2: `09a0c41e` (2026-09-15)
**Commit Message**: fix(kotest-tests-timeout-project): Format timeout in exception message (#6230)

Prior to this commit, a timeout of `20m` was formatted as `1.2s seconds`
(sic!).

**File**: `kotest-framework/kotest-framework-engine/src/commonMain/kotlin/io/kotest/engine/engineExceptions.kt` (modified, +1/-1)
```diff
@@ -14,4 +14,4 @@ class EmptyTestSuiteException : Exception("No specs were available to test")
  */
 @KotestInternal
 class ProjectTimeoutException(val timeout: Duration) :
-   Exception("Test suite did not complete with ${timeout / 1000} seconds")
+   Exception("Test suite did not complete within $timeout")
```

**File**: `kotest-tests/kotest-tests-timeout-project/src/jvmTest/kotlin/com/sksamuel/kotest/timeout/ProjectTimeoutTest.kt` (modified, +5/-1)
```diff
@@ -9,6 +9,7 @@ import io.kotest.engine.ProjectTimeoutException
 import io.kotest.engine.TestEngineLauncher
 import io.kotest.engine.listener.NoopTestEngineListener
 import io.kotest.inspectors.forOne
+import io.kotest.matchers.shouldBe
 import io.kotest.matchers.types.shouldBeInstanceOf
 import kotlinx.coroutines.delay
 import kotlin.time.Duration.Companion.milliseconds
@@ -30,7 +31,10 @@ class ProjectTimeoutTest : FunSpec({
          .withProjectConfig(c)
          .execute()
 
-      result.errors.forOne { it.shouldBeInstanceOf<ProjectTimeoutException>() }
+      result.errors.forOne {
+         it.shouldBeInstanceOf<ProjectTimeoutException>()
+         it.message shouldBe "Test suite did not complete within 100ms"
+      }
    }
 })
 
```

---

### Incident Patch 3: `41df99d6` (2026-09-10)
**Commit Message**: Fix Android StackWalker compatibility (#6222)

Fixes #6221

Restores Android compatibility for stack-based source lookup introduced
in #6203.

- Keeps the `StackWalker`-based implementation on supported JVMs
- Falls back to `Thread.currentThread().stackTrace` when `StackWalker`
is unavailable
- Isolates `StackWalker` references so Android ART does not resolve them
during class initialization
- Applies the same compatibility handling to source references and
data-test call-site lookup
- Adds an Android instrumentation regression test covering regular test
registration and data-driven tests

The existing source-reference semantics and JVM performance optimization
are preserved.

Validation:
- Relevant JVM tests passed
- Engine `jvmTest` passed
- Existing performance tests passed
- `git diff --check` passed
- Android instrumentation test could not be executed locally because the
Android SDK was not configured

---------

Signed-off-by: 박하민 <[REDACTED_EMAIL]>
Co-authored-by: Sam <[REDACTED_EMAIL]>

**File**: `kotest-framework/kotest-framework-engine/build.gradle.kts` (modified, +18/-1)
```diff
@@ -1,5 +1,6 @@
 plugins {
    id("kotest-jvm-conventions")
+   id("kotest-android-conventions")
    id("kotest-js-conventions")
    id("kotest-wasi-conventions")
    id("kotest-native-conventions")
@@ -13,6 +14,13 @@ plugins {
 }
 
 kotlin {
+
+   androidLibrary {
+      namespace = "io.kotest.framework.engine"
+      compileSdk = 34
+      minSdk = 24
+   }
+
    sourceSets {
 
       commonMain {
@@ -51,7 +59,8 @@ kotlin {
          }
       }
 
-      jvmMain {
+      val jvmCommonMain by creating {
+         dependsOn(commonMain.get())
          dependencies {
 
             // we use AssertionFailedError from OpenTest4J
@@ -65,6 +74,14 @@ kotlin {
          }
       }
 
+      androidMain {
+         dependsOn(jvmCommonMain)
+      }
+
+      jvmMain {
+         dependsOn(jvmCommonMain)
+      }
+
       commonTest {
          dependencies {
             implementation(projects.kotestAssertions.kotestAssertionsCore)
```

**File**: `kotest-framework/kotest-framework-engine/src/androidMain/kotlin/io/kotest/core/source/stackFrame.android.kt` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+package io.kotest.core.source
+
+internal actual fun findFirstStackFrame(
+   excludeDataTest: Boolean,
+   predicate: (JvmStackFrame) -> Boolean,
+): JvmStackFrame? {
+   return SourceRefUtils.filteredUserFrames(Thread.currentThread().stackTrace, excludeDataTest).firstNotNullOfOrNull {
+      val frame = try {
+         JvmStackFrame(Class.forName(it.className), it.lineNumber)
+      } catch (_: ReflectiveOperationException) {
+         JvmStackFrame(null, it.lineNumber)
+      } catch (_: LinkageError) {
+         JvmStackFrame(null, it.lineNumber)
+      }
+      try {
+         frame.takeIf(predicate)
+      } catch (_: ReflectiveOperationException) {
+         null
+      } catch (_: LinkageError) {
+         null
+      }
+   }
+}
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmCommonMain/kotlin/io/kotest/core/source/sourceRef.kt` (renamed, +16/-19)
```diff
@@ -6,11 +6,15 @@ import io.kotest.engine.config.KotestEngineProperties
 
 private val specJavaClass: Class<*> = Spec::class.java
 
-// RETAIN_CLASS_REFERENCE gives us the live java.lang.Class for each frame directly,
-// avoiding a Class.forName lookup, and StackWalker.walk() lets us stop as soon as we
-// find the first user frame instead of always materializing the whole call stack
-// the way Thread.currentThread().stackTrace would do.
-private val stackWalker: StackWalker = StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
+internal data class JvmStackFrame(
+   val declaringClass: Class<*>?,
+   val lineNumber: Int,
+)
+
+internal expect fun findFirstStackFrame(
+   excludeDataTest: Boolean,
+   predicate: (JvmStackFrame) -> Boolean,
+): JvmStackFrame?
 
 /**
  * On the JVM we can create a stack trace to get the line number.
@@ -19,12 +23,16 @@ private val stackWalker: StackWalker = StackWalker.getInstance(StackWalker.Optio
 internal actual fun sourceRef(): SourceRef {
    if (sysprop(KotestEngineProperties.DISABLE_SOURCE_REF, "false") == "true") return SourceRef.None
 
-   val frame = SourceRefUtils.firstUserFrame(stackWalker) ?: return SourceRef.None
+   val frame = findFirstStackFrame(excludeDataTest = true) { true } ?: return SourceRef.None
 
    // preference is given to the class name, but we must try to find the enclosing spec
    var kclass: Class<*>? = frame.declaringClass
-   while (kclass != null && !specJavaClass.isAssignableFrom(kclass)) {
-      kclass = kclass.enclosingClass
+   try {
+      while (kclass != null && !specJavaClass.isAssignableFrom(kclass)) {
+         kclass = kclass.enclosingClass
+      }
+   } catch (_: LinkageError) {
+      return SourceRef.None
    }
 
    val lineNumber = frame.lineNumber.takeIf { it > 0 }
@@ -37,17 +45,6 @@ internal actual fun sourceRef(): SourceRef {
 }
 
 object SourceRefUtils {
-
-   /**
-    * Returns the first user-land frame from the given [StackWalker], walking the live call
-    * stack lazily so frames beyond the match are never materialized.
-    */
-   internal fun firstUserFrame(walker: StackWalker): StackWalker.StackFrame? {
-      return walker.walk { frames ->
-         frames.filter { !isExcludedFrame(it.className, excludeDataTest = true) }.findFirst()
-      }.orElse(null)
-   }
-
    /**
     * Returns the first user-land frame from the given stack trace.
     *
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmCommonMain/kotlin/io/kotest/datatest/DataTestTag.jvm.kt` (renamed, +4/-14)
```diff
@@ -1,28 +1,19 @@
 package io.kotest.datatest
 
-import io.kotest.core.source.SourceRefUtils
+import io.kotest.core.source.findFirstStackFrame
 import io.kotest.core.spec.Spec
 
 private val specJavaClass: Class<*> = Spec::class.java
 
-// RETAIN_CLASS_REFERENCE gives us the live java.lang.Class for each frame directly,
-// avoiding a Class.forName lookup, and StackWalker.walk() lets us stop as soon as we
-// find the first user frame instead of always materializing the whole call stack
-// the way Thread.currentThread().stackTrace would do.
-private val stackWalker: StackWalker = StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
-
 /**
  * JVM implementation that gets the line number from the stack trace.
  * Looks for the first frame that is inside a Spec subclass or a nested class within a Spec.
  * Highly (ok fully) inspired from [io.kotest.core.source.sourceRef]
  */
 internal actual fun getDataTestCallSiteLineNumber(): String {
-   val frame = stackWalker.walk { frames ->
-      frames
-         .filter { !SourceRefUtils.isExcludedFrame(it.className, excludeDataTest = false) }
-         .filter { isSpecOrNestedInSpec(it.declaringClass) }
-         .findFirst()
-   }.orElse(null)
+   val frame = findFirstStackFrame(excludeDataTest = false) {
+      it.declaringClass?.let(::isSpecOrNestedInSpec) == true
+   }
 
    return frame?.lineNumber?.takeIf { it > 0 }?.toString() ?: "unknown"
 }
@@ -40,4 +31,3 @@ private fun isSpecOrNestedInSpec(clazz: Class<*>): Boolean {
    }
    return false
 }
-
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmMain/kotlin/io/kotest/core/source/stackFrame.jvm.kt` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+package io.kotest.core.source
+
+private val stackWalker: StackWalker = StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
+
+internal actual fun findFirstStackFrame(
+   excludeDataTest: Boolean,
+   predicate: (JvmStackFrame) -> Boolean,
+): JvmStackFrame? {
+   return stackWalker.walk { frames ->
+      frames
+         .filter { !SourceRefUtils.isExcludedFrame(it.className, excludeDataTest) }
+         .map { JvmStackFrame(it.declaringClass, it.lineNumber) }
+         .filter(predicate)
+         .findFirst()
+   }.orElse(null)
+}
```

**File**: `kotest-tests/kotest-tests-android-instrumentation/src/androidTest/kotlin/io/kotest/android/StackWalkerCompatibilityTest.kt` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+package io.kotest.android
+
+import io.kotest.core.spec.style.FunSpec
+import io.kotest.datatest.withData
+import io.kotest.matchers.shouldBe
+import io.kotest.runner.junit4.KotestTestRunner
+import org.junit.runner.RunWith
+
+@RunWith(KotestTestRunner::class)
+class StackWalkerCompatibilityTest : FunSpec({
+
+   test("ordinary tests can be registered on Android") {
+      true shouldBe true
+   }
+
+   withData(1, 2) { value ->
+      value shouldBe value
+   }
+})
```

---

### Incident Patch 4: `56301a62` (2026-09-03)
**Commit Message**: Make the `shouldBeSingleton` block overloads infix (#6223)

Fixes #6220

`shouldBeSingleton` was the odd one out among the collection matchers:
it could
not be written in infix form.

The three `shouldBeSingleton(fn: (T) -> Unit)` overloads (`Collection`,
`Iterable`,
`Array`) now carry the `infix` modifier, so both of these are valid:

```kotlin
listOf(1).shouldBeSingleton { it shouldBe 1 }
listOf(1) shouldBeSingleton { it shouldBe 1 }
```

This matches the existing `inline infix fun ... (fn: (T) -> Unit)` style
used by
the inspector aliases (`shouldForAll`, `shouldForOne`, etc.) in
`InspectorAliases.kt`.

Notes:

- Only the block overloads can gain `infix`. The no-arg
`shouldBeSingleton()` /
`shouldNotBeSingleton()` forms take no parameter, so `infix` does not
apply to
  them, and `shouldNotBeSingleton` has no lambda overload to change.
- `infix` is a Kotlin-level modifier and does not affect the JVM
signature, so the
  API dump is unchanged; `apiCheck` passes as-is.
- Added tests covering the infix form for the `Collection`, `Iterable`
and `Array`
  receivers, plus the failing cases.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Claude Opus 5 (

**File**: `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/matchers/collections/singleton.kt` (modified, +8/-3)
```diff
@@ -121,8 +121,13 @@ fun <T> Array<T>.shouldNotBeSingle(): Array<T> {
 
 /**
  * Verifies this collection contains only one element and executes the given lambda against that element.
+ *
+ * ```
+ * listOf(1).shouldBeSingleton { it shouldBe 1 } // Assertion passes
+ * listOf(1) shouldBeSingleton { it shouldBe 1 } // Same, using the infix form
+ * ```
  */
-inline fun <T, C : Collection<T>> C.shouldBeSingleton(fn: (T) -> Unit): C {
+inline infix fun <T, C : Collection<T>> C.shouldBeSingleton(fn: (T) -> Unit): C {
    this.shouldBeSingleton()
    fn(this.first())
    return this
@@ -131,15 +136,15 @@ inline fun <T, C : Collection<T>> C.shouldBeSingleton(fn: (T) -> Unit): C {
 /**
  * Verifies this collection contains only one element and executes the given lambda against that element.
  */
-inline fun <T, I : Iterable<T>> I.shouldBeSingleton(fn: (T) -> Unit): I {
+inline infix fun <T, I : Iterable<T>> I.shouldBeSingleton(fn: (T) -> Unit): I {
    toList().shouldBeSingleton(fn)
    return this
 }
 
 /**
  * Verifies this collection contains only one element and executes the given lambda against that element.
  */
-inline fun <T> Array<T>.shouldBeSingleton(fn: (T) -> Unit): Array<T> {
+inline infix fun <T> Array<T>.shouldBeSingleton(fn: (T) -> Unit): Array<T> {
    asList().shouldBeSingleton(fn)
    return this
 }
```

**File**: `kotest-assertions/kotest-assertions-core/src/jvmTest/kotlin/com/sksamuel/kotest/matchers/collections/CollectionMatchersTest.kt` (modified, +39/-0)
```diff
@@ -428,6 +428,45 @@ expected:<1> but was:<4>"""
          }
       }
 
+      "should be singleton with infix block" should {
+         "pass for collection with a single element" {
+            listOf(1) shouldBeSingleton { it shouldBe 1 }
+         }
+
+         "pass for iterable with a single element" {
+            val iterable = Iterable { listOf(1).iterator() }
+            iterable shouldBeSingleton { it shouldBe 1 }
+         }
+
+         "pass for array with a single element" {
+            arrayOf(1) shouldBeSingleton { it shouldBe 1 }
+         }
+
+         "fail for collection with 0 elements" {
+            shouldThrow<AssertionError> {
+               listOf<Int>() shouldBeSingleton { it shouldBe 1 }
+            }.shouldHaveMessage(
+               """Collection should have size 1 but has size 0. Values: []
+expected:<1> but was:<0>"""
+            )
+         }
+
+         "fail for collection with a single incorrect element" {
+            shouldThrow<AssertionError> {
+               listOf(2) shouldBeSingleton { it shouldBe 1 }
+            }.shouldHaveMessage("expected:<1> but was:<2>")
+         }
+
+         "fail for collection with 2+ elements" {
+            shouldThrow<AssertionError> {
+               listOf(1, 2) shouldBeSingleton { it shouldBe 1 }
+            }.shouldHaveMessage(
+               """Collection should have size 1 but has size 2. Values: [1, 2]
+expected:<1> but was:<2>"""
+            )
+         }
+      }
+
       "should not be singleton" should {
          "pass for collection with 0 elements" {
             listOf<Int>().shouldNotBeSingleton()
```

---

### Incident Patch 5: `2403f4fb` (2026-08-07)
**Commit Message**: fix kdoc on StrictThrowableHandling (#6212)

<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->

**File**: `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/assertions/throwables/StrictThrowableHandling.kt` (modified, +8/-8)
```diff
@@ -35,7 +35,7 @@ inline fun <reified T : Throwable> shouldThrowExactlyUnit(block: () -> Unit): T
  * Verifies that a block of code doesn't throw a Throwable of type [T], not including subclasses of [T]
  *
  * Use this function to wrap a block of code that you'd like to verify whether it throws [T] (not including) or not.
- * If [T] is thrown, this will thrown an [AssertionError]. If anything else is thrown, the throwable will be propagated.
+ * If [T] is thrown, this will throw an [AssertionError]. If anything else is thrown, the throwable will be propagated.
  * This is done so that no unexpected error is silently ignored.
  *
  * This should be used when [shouldNotThrowExactly] can't be used, such as when doing assignments (assignments are statements,
@@ -48,7 +48,7 @@ inline fun <reified T : Throwable> shouldThrowExactlyUnit(block: () -> Unit): T
  *
  * If you don't care about the thrown exception, use [shouldNotThrowAnyUnit]
  *
- * * ```
+ * ```
  *     shouldNotThrowExactlyUnit<FooException> {
  *        throw FooException() // Fails
  *     }
@@ -77,7 +77,7 @@ inline fun <reified T : Throwable> shouldNotThrowExactlyUnit(block: () -> Unit)
  * **Attention to assignment operations**:
  *
  * When doing an assignment to a variable, the code won't compile, because an assignment is not of type [Any], as required
- * by [block]. If you need to test that an assignment throws a [Throwable], use [shouldThrowExactlyUnit] or it's variations.
+ * by [block]. If you need to test that an assignment throws a [Throwable], use [shouldThrowExactlyUnit] or its variations.
  *
  * ```
  *     val thrown: FooException = shouldThrowExactly<FooException> {
@@ -114,7 +114,7 @@ inline fun <reified T : Throwable> shouldThrowExactly(block: () -> Any?): T {
  * Verifies that a block of code doesn't throw a Throwable of type [T], not including subclasses of [T]
  *
  * Use this function to wrap a block of code that you'd like to verify whether it throws [T] (not including) or not.
- * If [T] is thrown, this will thrown an [AssertionError]. If anything else is thrown, the throwable will be propagated.
+ * If [T] is thrown, this will throw an [AssertionError]. If anything else is thrown, the throwable will be propagated.
  * This is done so that no unexpected error is silently ignored.
  *
  *
@@ -128,12 +128,12 @@ inline fun <reified T : Throwable> shouldThrowExactly(block: () -> Any?): T {
  * **Attention to assignment operations**:
  *
  * When doing an assignment to a variable, the code won't compile, because an assignment is not of type [Any], as required
- * by [block]. If you need to test that an assignment doesn't throw a [Throwable], use [shouldNotThrowExactlyUnit] or it's variations.
+ * by [block]. If you need to test that an assignment doesn't throw a [Throwable], use [shouldNotThrowExactlyUnit] or its variations.
  *
  * ```
- *     val thrown: FooException = shouldThrowExactly<FooException> {
- *         // Code that we expect to throw FooException
- *         throw FooException()
+ *     shouldNotThrowExactly<FooException> {
+ *         // Code that we expect not to throw FooException
+ *         doSomethingSafe()
  *     }
  * ```
  *
```

---

### Incident Patch 6: `f96cf2a6` (2026-08-07)
**Commit Message**: introduce a TeamCity renderer that allows tree view and force it for our IJ plugin (#6210)

<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->
For https://github.com/kotest/kotest/issues/5925
- introduce a TeamCity renderer that allows tree view (nested tests)
when prompted
- force this flag to be on when the IJ plugin runs tests in legacy mode

**File**: `kotest-framework/kotest-framework-engine/src/commonMain/kotlin/io/kotest/engine/listener/TeamCityTestEngineListener.kt` (modified, +43/-16)
```diff
@@ -33,13 +33,23 @@ import kotlin.reflect.KClass
  *
  * Decisions:
  *
- * Intermediate containers will only be output if configured
- * All tests will be output as root tests under the spec as a suite, with the path flattened.
+ * By default, intermediate containers are not output as suites: all tests are output as root
+ * tests under the spec as a suite, with the path flattened. This is because some TeamCity
+ * consumers (e.g. Native and JS) ignore containers without direct tests, so flattening guarantees
+ * every test remains visible.
+ *
+ * When [nestContainers] is enabled, containers are instead reported as nested
+ * testSuiteStarted/testSuiteFinished messages, and test names are not flattened. This gives a
+ * consumer capable of rendering nested suites (e.g. IntelliJ parsing these messages directly from
+ * a forked JVM, as our IJ plugin does for non-Gradle run configurations) a real tree instead of one flattened
+ * leaf per test. This is opt-in so that existing consumers relying on the flattened format are
+ * unaffected.
  *
  */
 @KotestInternal
 class TeamCityTestEngineListener(
    private val prefix: String = TeamCityMessage.TEAM_CITY_PREFIX,
+   private val nestContainers: Boolean = false,
 ) : TestEngineListener {
 
    private val logger = Logger(TeamCityTestEngineListener::class)
@@ -75,8 +85,10 @@ class TeamCityTestEngineListener(
       // if the spec itself has an error, we must insert a placeholder test
       when (val t = result.errorOrNull) {
          null -> Unit
-         is MultipleExceptions -> t.causes.forEach { insertPlaceholderTest(renderer.testPath(ref, it), it) }
-         else -> insertPlaceholderTest(renderer.testPath(ref, t), t)
+         is MultipleExceptions -> t.causes.forEach {
+            insertPlaceholderTest(if (nestContainers) it::class.simpleName ?: "Error" else renderer.testPath(ref, it), it)
+         }
+         else -> insertPlaceholderTest(if (nestContainers) t::class.simpleName ?: "Error" else renderer.testPath(ref, t), t)
       }
 
       TeamCityMessage(prefix, TeamCityMessage.Types.TEST_SUITE_FINISHED) {
@@ -88,16 +100,23 @@ class TeamCityTestEngineListener(
 
    override suspend fun testStarted(testCase: TestCase) {
       logger.log { Pair(testCase.name.name, "testStarted $testCase") }
-      if (testCase.type == TestType.Test)
-         TeamCityMessage(prefix, TeamCityMessage.Types.TEST_STARTED) {
-            name(renderer.testPath(testCase))
-            locationHint(Locations.location(testCase.source))
-         }.output()
+      when {
+         nestContainers && testCase.type == TestType.Container ->
+            TeamCityMessage(prefix, TeamCityMessage.Types.TEST_SUITE_STARTED) {
+               name(renderer.localName(testCase))
+               locationHint(Locations.location(testCase.source))
+            }.output()
+         testCase.type == TestType.Test ->
+            TeamCityMessage(prefix, TeamCityMessage.Types.TEST_STARTED) {
+               name(if (nestContainers) renderer.localName(testCase) else renderer.testPath(testCase))
+               locationHint(Locations.location(testCase.source))
+            }.output()
+      }
    }
 
    override suspend fun testIgnored(testCase: TestCase, reason: String?) {
       TeamCityMessage(prefix, TeamCityMessage.Types.TEST_IGNORED) {
-         name(renderer.testPath(testCase))
+         name(if (nestContainers) renderer.localName(testCase) else renderer.testPath(testCase))
          locationHint(Locations.location(testCase.source))
          message(reason)
          result(TestResult.Ignored(reason))
@@ -108,19 +127,25 @@ class TeamCityTestEngineListener(
       logger.log { Pair(testCase.name.name, "testFinished $testCase") }
       results[testCase.descriptor] = result
 
-      if (testCase.type == TestType.Container)
+      if (testCase.type == TestType.Container) {
          failTestSuiteIfError(testCase, result)
-      else {
+         if (nestContainers)
+            TeamCityMessage(prefix, TeamCityMessage.Types.TEST_SUITE_FINISHED) {
+               name(renderer.localName(testCase))
+            }.output()
+      } else {
+         val testName = if (nestContainers) renderer.localName(testCase) else renderer.testPath(testCase)
+
          if (result.isErrorOrFailure) {
             TeamCityMessage(prefix, TeamCityMessage.Types.TEST_FAILED) {
-               name(renderer.testPath(testCase))
+               name(testName)
                exception(result.errorOrNull)
                result(result)
             }.output()
          }
 
          TeamCityMessage(prefix, TeamCityMessage.Types.TEST_FINISHED) {
-            name(renderer.testPath(testCase))
+            name(testName)
             duration(result.duration)
             result(result)
          }.output()
@@ -132,8 +157,10 @@ class TeamCityTestEngineListener(
       // test suites cannot be in a failed state, so we must insert a placeholder to hold any error
       when (val t = result.errorOrNull) {
          null -
```

**File**: `kotest-framework/kotest-framework-engine/src/commonMain/kotlin/io/kotest/engine/teamcity/TeamCityPathRenderer.kt` (modified, +10/-0)
```diff
@@ -49,4 +49,14 @@ internal class TeamCityPathRenderer(private val formatting: DisplayNameFormattin
    fun testPath(testCase: TestCase, t: Throwable): String {
       return testPath(testCase) + DELIMITER + t::class.simpleName
    }
+
+   /**
+    * Builds the display name for a single test case, without any ancestor context.
+    * Used when [io.kotest.engine.listener.TeamCityTestEngineListener] is configured to nest
+    * suites, so ancestry is conveyed by nesting testSuiteStarted/testSuiteFinished messages
+    * around this name, rather than by concatenating it with ancestor names.
+    */
+   fun localName(testCase: TestCase): String {
+      return TeamCityTestNameEscaper.escape(formatting.format(testCase))
+   }
 }
```

**File**: `kotest-framework/kotest-framework-engine/src/commonTest/kotlin/com/sksamuel/kotest/engine/teamcity/TeamCityPathRendererTest.kt` (modified, +22/-0)
```diff
@@ -80,5 +80,27 @@ class TeamCityPathRendererTest : FreeSpec() {
          renderer.testPath(SpecRef.Reference(TeamCityPathRendererTest::class))
          renderer.testPath(tc) shouldBe "$fqn.foo bar ⇢ boo far"
       }
+      "localName should render only the test's own name, ignoring ancestors" {
+         val parent = TestCase(
+            TeamCityPathRendererTest::class.toDescriptor().append("foo"),
+            TestNameBuilder.builder("foo").build(),
+            TeamCityPathRendererTest(),
+            {},
+            SourceRef.None,
+            TestType.Test,
+            parent = null
+         )
+         val tc = TestCase(
+            parent.descriptor.append("boo.far"),
+            TestNameBuilder.builder("boo.far").build(),
+            TeamCityPathRendererTest(),
+            {},
+            SourceRef.None,
+            TestType.Test,
+            parent = parent
+         )
+         val renderer = TeamCityPathRenderer(DisplayNameFormatting(null))
+         renderer.localName(tc) shouldBe "boo far"
+      }
    }
 }
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmMain/kotlin/io/kotest/engine/launcher/TestEngineListenerBuilder.kt` (modified, +10/-2)
```diff
@@ -22,21 +22,29 @@ data class TestEngineListenerBuilder(
 
       internal const val IDEA_PROP = "idea.active"
 
+      // set only by the IntelliJ plugin's non-Gradle (e.g. Maven) run configuration launcher,
+      // so that IntelliJ can render a real nested test tree when it is parsing these TeamCity
+      // messages directly from a forked JVM, without changing the flattened format relied on
+      // by other TeamCity consumers (JS/Native etc).
+      internal const val NEST_CONTAINERS_PROP = "kotest.engine.listener.teamcity.nestContainers"
+
       fun builder(): TestEngineListenerBuilder = TestEngineListenerBuilder(null)
    }
 
    fun withType(type: String?): TestEngineListenerBuilder = copy(type = type)
 
    fun build(): TestEngineListener {
       return when (type) {
-         LISTENER_TC -> TeamCityTestEngineListener()
+         LISTENER_TC -> TeamCityTestEngineListener(nestContainers = nestContainers())
          LISTENER_CONSOLE -> ConsoleTestEngineListener()
          // if not speciifed, we'll try to detect instead
-         else if isIntellij() -> TeamCityTestEngineListener()
+         else if isIntellij() -> TeamCityTestEngineListener(nestContainers = nestContainers())
          else -> ConsoleTestEngineListener()
       }
    }
 
    // this system property is added by intellij itself when running tasks
    private fun isIntellij() = System.getProperty(IDEA_PROP) != null
+
+   private fun nestContainers() = System.getProperty(NEST_CONTAINERS_PROP) == "true"
 }
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmTest/kotlin/com/sksamuel/kotest/engine/listener/TeamCityTestEngineListenerTest.kt` (modified, +61/-0)
```diff
@@ -349,6 +349,67 @@ a[testSuiteStarted name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineL
 a[testStarted name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest.a b c' locationHint='kotest://foo.bar.Test:17']
 a[testFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest.a b c' duration='124' result_status='Success']
 a[testSuiteFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest']
+"""
+      }
+
+      test("nestContainers should report nested containers as nested suites") {
+         val output = captureStandardOut {
+            val listener = TeamCityTestEngineListener("a", nestContainers = true)
+            listener.engineStarted()
+            listener.specStarted(SpecRef.Reference(TeamCityTestEngineListenerTest::class))
+            listener.testStarted(a)
+            listener.testStarted(b)
+            listener.testStarted(c)
+            listener.testFinished(c, TestResult.Success(123.milliseconds))
+            listener.testFinished(b, TestResult.Success(324.milliseconds))
+            listener.testFinished(a, TestResult.Success(653.milliseconds))
+            listener.specFinished(
+               SpecRef.Reference(TeamCityTestEngineListenerTest::class),
+               TestResult.Success(0.seconds)
+            )
+            listener.engineFinished(emptyList())
+         }
+         stripDetails(output) shouldBe """a[enteredTheMatrix]
+a[testSuiteStarted name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest' locationHint='kotest://com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest:1']
+a[testSuiteStarted name='a' locationHint='kotest://foo.bar.Test:12']
+a[testSuiteStarted name='b' locationHint='kotest://foo.bar.Test:17']
+a[testStarted name='c' locationHint='kotest://foo.bar.Test:33']
+a[testFinished name='c' duration='123' result_status='Success']
+a[testSuiteFinished name='b']
+a[testSuiteFinished name='a']
+a[testSuiteFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest']
+"""
+      }
+
+      test("nestContainers should insert a placeholder test within the failing container's suite") {
+         val output = captureStandardOut {
+            val listener = TeamCityTestEngineListener("a", nestContainers = true)
+            listener.engineStarted()
+            listener.specStarted(SpecRef.Reference(TeamCityTestEngineListenerTest::class))
+            listener.testStarted(a)
+            listener.testStarted(b)
+            listener.testStarted(c)
+            listener.testFinished(c, TestResult.Success(123.milliseconds))
+            listener.testFinished(b, TestResult.Error(653.milliseconds, Exception("boom")))
+            listener.testFinished(a, TestResult.Success(324.milliseconds))
+            listener.specFinished(
+               SpecRef.Reference(TeamCityTestEngineListenerTest::class),
+               TestResult.Success(0.seconds)
+            )
+            listener.engineFinished(emptyList())
+         }
+         stripDetails(output) shouldBe """a[enteredTheMatrix]
+a[testSuiteStarted name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest' locationHint='kotest://com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest:1']
+a[testSuiteStarted name='a' locationHint='kotest://foo.bar.Test:12']
+a[testSuiteStarted name='b' locationHint='kotest://foo.bar.Test:17']
+a[testStarted name='c' locationHint='kotest://foo.bar.Test:33']
+a[testFinished name='c' duration='123' result_status='Success']
+a[testStarted name='Exception']
+a[testFailed name='Exception' message='boom']
+a[testFinished name='Exception']
+a[testSuiteFinished name='b']
+a[testSuiteFinished name='a']
+a[testSuiteFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest']
 """
       }
    }
```

**File**: `kotest-intellij-plugin/src/main/kotlin/io/kotest/plugin/intellij/run/idea/KotestRunnableState.kt` (modified, +6/-0)
```diff
@@ -34,6 +34,12 @@ class KotestRunnableState(
       // it is a main function that will launch the KotestConsoleRunner
       params.mainClass = launcherConfig.mainClass
 
+      // this run configuration parses TeamCity service messages directly from the forked JVM's
+      // stdout (unlike Gradle runs, where IntelliJ reads the test tree from real JUnit Platform
+      // events), so it can render nested suites. Opt in to a nested tree instead of the flattened
+      // format other TeamCity consumers rely on.
+      params.vmParametersList.addProperty("kotest.engine.listener.teamcity.nestContainers", "true")
+
       val packageName = configuration.getPackageName()
       if (!packageName.isNullOrBlank())
          params.programParametersList.add("--package", packageName)
```

---

### Incident Patch 7: `38048812` (2026-07-29)
**Commit Message**: fix jump to source (#6195)

<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->
Addresses: https://github.com/kotest/kotest/issues/6194

Problem

"Jump to Source" on test results in the IntelliJ test tree had regressed
in several cases:
- Top-level (non-nested) tests, e.g. test("a test") { } directly in a
spec.
- Nested tests whose literal source name has irregular whitespace
(double spaces, tabs, etc.).
- Nested tests run via the Gradle test runner specifically — e.g.
context("outer") { test("inner") { } } — while the top-level container
navigated fine.

Root causes

1. Top-level tests bailing to the default locator
(EmbeddedLocationSMTRunnerEventsAdapter.kt).
EmbeddedLocationParser.parseLocationUrl treated any single-segment
methodName (no /) as "must be a real JVM method" and left it to
IntelliJ's default locator. But a top-level Kotest test also produces a
single-segment methodName, and it isn't a real J

**File**: `kotest-intellij-plugin/src/main/kotlin/io/kotest/plugin/intellij/Test.kt` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ data class TestName(
    }
 }
 
-private fun String.flattenTestName() = this.trim().replace("\\s+".toRegex(), " ")
+internal fun String.flattenTestName() = this.trim().replace("\\s+".toRegex(), " ")
 // components for the path should not include prefixes
 data class TestPathEntry(val name: String)
 
```

**File**: `kotest-intellij-plugin/src/main/kotlin/io/kotest/plugin/intellij/locations/EmbeddedLocationSMTRunnerEventsAdapter.kt` (modified, +83/-13)
```diff
@@ -2,6 +2,13 @@ package io.kotest.plugin.intellij.locations
 
 import com.intellij.execution.testframework.sm.runner.SMTRunnerEventsAdapter
 import com.intellij.execution.testframework.sm.runner.SMTestProxy
+import com.intellij.openapi.application.ReadAction
+import com.intellij.openapi.project.DumbService
+import com.intellij.openapi.project.Project
+import com.intellij.psi.search.GlobalSearchScope
+import io.kotest.plugin.intellij.psi.kotestStyleSyntactic
+import org.jetbrains.kotlin.idea.stubindex.KotlinFullClassNameIndex
+import org.jetbrains.plugins.gradle.execution.test.runner.GradleSMTestProxy
 
 /**
  * Listens to SMTest events and installs an [EmbeddedLocationTestLocator] on each Kotest
@@ -12,16 +19,19 @@ import com.intellij.execution.testframework.sm.runner.SMTestProxy
  *  1. **`locationUrl` strategy** (preferred, no displayName mangling). The IDEA JUnit5 launcher
  *     converts a [org.junit.platform.engine.support.descriptor.MethodSource] of the form
  *     `(className=fqn, methodName=seg/seg/...)` into a `java:test://<fqn>/<seg>/<seg>` URL on
- *     [SMTestProxy.getLocationUrl]. We detect those URLs (whose method-name component contains a
- *     `/`, which is impossible for a real JVM method) and install our locator without touching
- *     the displayName. This is what Kotest 6.x (and later) emits.
+ *     [SMTestProxy.getLocationUrl]. We detect those URLs and install our locator without touching
+ *     the displayName. This is what Kotest 6.x (and later) emits. A single-segment methodName
+ *     (no `/`) can't be told apart from a plain JVM method (i.e. `@Test`) by shape alone, so we resolve
+ *     the FQN to confirm it's actually a Kotest spec before taking over navigation from it -
+ *     Kotest's own single-level (non-nested) tests aren't real JVM methods, so IntelliJ's default
+ *     locator can't resolve them and "Jump to Source" silently does nothing for them otherwise.
  *
  *  2. **Legacy displayName tag strategy**. Older Kotest engines wrapped the path in a
  *     `<kotest>fqn/test -- nested</kotest>` prefix on the proxy display name. We still strip the
  *     tag and install the locator so users on the new plugin see clean names and working
  *     navigation against older engine versions.
  */
-internal class EmbeddedLocationSMTRunnerEventsAdapter : SMTRunnerEventsAdapter() {
+internal class EmbeddedLocationSMTRunnerEventsAdapter(private val project: Project) : SMTRunnerEventsAdapter() {
 
    override fun onSuiteStarted(suite: SMTestProxy) {
       handleKotestLocator(suite)
@@ -45,8 +55,13 @@ internal class EmbeddedLocationSMTRunnerEventsAdapter : SMTRunnerEventsAdapter()
          return
       }
 
+      // Only Gradle-run proxies carry a parentId - the IntelliJ-native JUnit launcher path uses
+      // plain SMTestProxy, so this is empty there and parseLocationUrl falls back to the
+      // single-segment behaviour it already has.
+      val ancestorNames = GradleParentIdParser.ancestorContextNames((proxy as? GradleSMTestProxy)?.parentId)
+
       // Strategy 2: java:test://<fqn>/<segment>/<segment> URL produced from a JUnit MethodSource
-      val fromUrl = EmbeddedLocationParser.parseLocationUrl(proxy.locationUrl, proxy.name)
+      val fromUrl = EmbeddedLocationParser.parseLocationUrl(proxy.locationUrl, proxy.name, ancestorNames, ::isKotestSpec)
       if (fromUrl != null) {
          proxy.locator = EmbeddedLocationTestLocator(fromUrl)
          return
@@ -59,6 +74,18 @@ internal class EmbeddedLocationSMTRunnerEventsAdapter : SMTRunnerEventsAdapter()
       }
    }
 
+   // resolves whether the given FQN is a Kotest spec class, so a single-segment methodName (which
+   // can't be distinguished from a plain JVM @Test method by shape alone) is only handed to our
+   // locator when it genuinely belongs to Kotest. Fails closed (false) while indexing, leaving the
+   // default locator in place rather than risking a stub-index query on a half-built index.
+   private fun isKotestSpec(fqn: String): Boolean {
+      if (DumbService.isDumb(project)) return false
+      return ReadAction.compute<Boolean, Throwable> {
+         KotlinFullClassNameIndex[fqn, project, GlobalSearchScope.allScope(project)]
+            .any { it.kotestStyleSyntactic() != null }
+      }
+   }
+
    // returns true if a class not a test
    internal fun isJavaSuiteClass(proxy: SMTestProxy): Boolean =
       proxy.locationUrl?.matches("java:suite://[a-zA-Z_.]+".toRegex()) == true
@@ -81,10 +108,21 @@ internal object EmbeddedLocationParser {
     * [EmbeddedLocation] in the `fqn/seg -- seg` format expected by [EmbeddedLocationTestLocator].
     *
     * Returns null if the URL is not in this form, the FQN doesn't look like a Kotlin/Java FQN,
-    * or the method-name component contains no `/` (in which case it is most likely a real JVM
-    * method on a non-Kotest class, and we should leave the default locator alone).
+    * or the method-name component contains no `/` (single-method URL)
```

**File**: `kotest-intellij-plugin/src/main/kotlin/io/kotest/plugin/intellij/locations/EmbeddedLocationTestLocator.kt` (modified, +23/-2)
```diff
@@ -12,6 +12,7 @@ import com.intellij.psi.PsiManager
 import com.intellij.psi.search.GlobalSearchScope
 import com.intellij.psi.util.ClassUtil
 import io.kotest.plugin.intellij.TestElement
+import io.kotest.plugin.intellij.flattenTestName
 import io.kotest.plugin.intellij.psi.specStyleOnEdt
 import org.jetbrains.kotlin.idea.stubindex.KotlinFullClassNameIndex
 import org.jetbrains.kotlin.psi.KtClassOrObject
@@ -55,11 +56,31 @@ internal class EmbeddedLocationTestLocator(private val location: EmbeddedLocatio
    }
 
    private fun findTest(tests: List<TestElement>, contexts: List<String>): TestElement? {
-      val test = tests.find { it.test.name.name == contexts.first() } ?: return null
-      if (contexts.size == 1) return test
+      // A single-segment path is ambiguous: it's either a genuine top-level test, or a nested
+      // test whose ancestor containers were dropped upstream - IntelliJ's Gradle test event
+      // integration only carries a leaf test's own name (unlike the JUnit Platform launcher's
+      // MethodSource, which joins every ancestor segment), so a nested "foo" test running under
+      // Gradle arrives here as a single-segment path indistinguishable from a top-level "foo".
+      // Search the whole tree rather than only the top level, so nested tests still resolve -
+      // to some matching test, at least, even though we can no longer disambiguate same-named
+      // tests under different containers without the full path.
+      if (contexts.size == 1) return findByNameAtAnyDepth(tests, contexts.first())
+
+      // contexts segments come from the engine's runtime test names, which collapse internal/
+      // leading/trailing whitespace (TestNameBuilder.removeAllExtraWhitespaces) - the PSI-side
+      // raw name must be flattened the same way or an otherwise-matching test won't be found.
+      val test = tests.find { it.test.name.name.flattenTestName() == contexts.first() } ?: return null
       return findTest(test.nestedTests, contexts.drop(1))
    }
 
+   private fun findByNameAtAnyDepth(tests: List<TestElement>, name: String): TestElement? {
+      for (test in tests) {
+         if (test.test.name.name.flattenTestName() == name) return test
+         findByNameAtAnyDepth(test.nestedTests, name)?.let { return it }
+      }
+      return null
+   }
+
    private fun createPsiClassNavigable(psiClass: PsiClass): Location<PsiElement> {
       return PsiLocation(psiClass.project, psiClass)
    }
```

**File**: `kotest-intellij-plugin/src/test/kotlin/io/kotest/plugin/intellij/locations/EmbeddedLocationSMTRunnerEventsAdapterTest.kt` (modified, +128/-47)
```diff
@@ -1,158 +1,239 @@
 package io.kotest.plugin.intellij.locations
 
 import com.intellij.execution.testframework.sm.runner.SMTestProxy
+import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
 import io.kotest.matchers.nulls.shouldBeNull
 import io.kotest.matchers.shouldBe
 import io.kotest.matchers.types.shouldBeInstanceOf
-import org.junit.Test
 
-class EmbeddedLocationSMTRunnerEventsAdapterTest {
+class EmbeddedLocationSMTRunnerEventsAdapterTest : LightJavaCodeInsightFixtureTestCase() {
+
+   private fun adapter() = EmbeddedLocationSMTRunnerEventsAdapter(project)
 
    // -------- Strategy 1: legacy <kotest>...</kotest> displayName tag (older engines) --------
 
-   @Test
-   fun shouldResetPresentablePathOnEmbeddedLocationOnTestStart() {
+   fun `test should reset presentable path on embedded location on test start`() {
       val proxy = SMTestProxy(
          /* testName = */ "<kotest>io.kotest.Spec.test -- nested</kotest>nested",
          /* isSuite = */ false,
          /* locationUrl = */ "java:suite:io.kotest.Spec/test"
       )
-      EmbeddedLocationSMTRunnerEventsAdapter().onTestStarted(proxy)
+      adapter().onTestStarted(proxy)
       proxy.locator.shouldBeInstanceOf<EmbeddedLocationTestLocator>()
       proxy.presentableName shouldBe "nested"
    }
 
-
-   @Test
-   fun shouldResetPresentablePathOnEmbeddedLocationOnTestIgnored() {
+   fun `test should reset presentable path on embedded location on test ignored`() {
       val proxy = SMTestProxy(
          /* testName = */ "<kotest>io.kotest.Spec.test -- nested</kotest>nested",
          /* isSuite = */ false,
          /* locationUrl = */ "java:suite:io.kotest.Spec/test"
       )
-      EmbeddedLocationSMTRunnerEventsAdapter().onTestIgnored(proxy)
+      adapter().onTestIgnored(proxy)
       proxy.locator.shouldBeInstanceOf<EmbeddedLocationTestLocator>()
       proxy.presentableName shouldBe "nested"
    }
 
-   @Test
-   fun shouldResetPresentablePathOnEmbeddedLocationOnTestSuiteStart() {
+   fun `test should reset presentable path on embedded location on test suite start`() {
       val proxy = SMTestProxy(
          /* testName = */ "<kotest>io.kotest.Spec.test -- nested</kotest>nested",
          /* isSuite = */ false,
          /* locationUrl = */ "java:suite:io.kotest.Spec/test"
       )
-      EmbeddedLocationSMTRunnerEventsAdapter().onSuiteStarted(proxy)
+      adapter().onSuiteStarted(proxy)
       proxy.locator.shouldBeInstanceOf<EmbeddedLocationTestLocator>()
       proxy.presentableName shouldBe "nested"
    }
 
    // -------- Strategy 2: java:test://<fqn>/<segment>/<segment> URL (current engines) --------
 
-   @Test
-   fun shouldInstallLocatorWhenLocationUrlEncodesNestedPath() {
+   fun `test should install locator when location url encodes nested path`() {
       val proxy = SMTestProxy(
          /* testName = */ "leaf",
          /* isSuite = */ false,
          /* locationUrl = */ "java:test://io.kotest.Spec/outer/middle/leaf"
       )
-      EmbeddedLocationSMTRunnerEventsAdapter().onTestStarted(proxy)
+      adapter().onTestStarted(proxy)
       proxy.locator.shouldBeInstanceOf<EmbeddedLocationTestLocator>()
       // displayName is left untouched - the engine no longer mangles it
       proxy.presentableName shouldBe "leaf"
    }
 
-   @Test
-   fun shouldInstallLocatorForSuiteUrl() {
+   fun `test should install locator for suite url`() {
       val proxy = SMTestProxy(
          /* testName = */ "middle",
          /* isSuite = */ true,
          /* locationUrl = */ "java:suite://io.kotest.Spec/outer/middle"
       )
-      EmbeddedLocationSMTRunnerEventsAdapter().onSuiteStarted(proxy)
+      adapter().onSuiteStarted(proxy)
       proxy.locator.shouldBeInstanceOf<EmbeddedLocationTestLocator>()
    }
 
-   @Test
-   fun shouldNotInstallLocatorForSingleSegmentLocationUrl() {
-      // Single-segment methodName (no '/' after the FQN) cannot encode a nested Kotest path,
-      // and could be a regular JUnit @Test method - leave the default locator in place.
+   fun `test should not install locator for single segment location url on non kotest class`() {
+      // Single-segment methodName (no '/' after the FQN) cannot encode a nested Kotest path.
+      // No class with this FQN is registered in the fixture project, so it isn't recognised as
+      // a Kotest spec, and this looks like a regular JUnit @Test method - leave the default
+      // locator in place.
       val proxy = SMTestProxy(
          /* testName = */ "myTest",
          /* isSuite = */ false,
          /* locationUrl = */ "java:test://io.kotest.examples.native.KotlinTest/myTest"
       )
-      EmbeddedLocationSMTRunnerEventsAdapter().onTestStarted(proxy)
+      adapter().onTestStarted(proxy)
       // locator should not be replaced
       (proxy.locator is EmbeddedLocationTestLocator) shouldBe false
    }
 
-   @Test
-   fun shouldDetectJavaSuiteClasses() {
+   fun `test should install locator for single segment location url 
```

**File**: `kotest-intellij-plugin/src/test/kotlin/io/kotest/plugin/intellij/locations/EmbeddedLocationTestLocatorTest.kt` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package io.kotest.plugin.intellij.locations
+
+import com.intellij.psi.search.GlobalSearchScope
+import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
+import io.kotest.matchers.collections.shouldHaveSize
+import io.kotest.matchers.ints.shouldBeGreaterThan
+import java.nio.file.Paths
+
+/**
+ * The `contexts` segments passed to [EmbeddedLocationTestLocator] come from the engine's runtime
+ * test names, which are whitespace-normalized ([io.kotest.core.names.TestNameBuilder]). The PSI
+ * side must normalize the literal source name the same way before comparing, or a nested test
+ * whose source string has irregular whitespace never resolves - "Jump to Source" then silently
+ * does nothing for it, even though its parent container (which navigates via a different,
+ * class-level mechanism) works fine.
+ */
+class EmbeddedLocationTestLocatorTest : LightJavaCodeInsightFixtureTestCase() {
+
+   override fun getTestDataPath(): String {
+      return Paths.get("./src/test/resources/").toAbsolutePath().toString()
+   }
+
+   private fun resolve(location: EmbeddedLocation) =
+      EmbeddedLocationTestLocator(location).getLocation("kotest", location.path, project, GlobalSearchScope.allScope(project))
+
+   fun `test resolves a top level test with a clean literal name`() {
+      myFixture.configureByFiles("/whitespace-funspec.kt", "/io/kotest/core/spec/style/specs.kt")
+      val location = EmbeddedLocation(
+         "io.kotest.samples.gradle.WhitespaceFunSpecExampleTest/outer context",
+         "outer context"
+      )
+      resolve(location) shouldHaveSize 1
+   }
+
+   fun `test resolves a nested test whose literal source name has irregular whitespace`() {
+      myFixture.configureByFiles("/whitespace-funspec.kt", "/io/kotest/core/spec/style/specs.kt")
+      // the engine normalizes "a  nested   test" (double/triple spaces in source) down to
+      // "a nested test" before it ever reaches the locationUrl/contexts path.
+      val location = EmbeddedLocation(
+         "io.kotest.samples.gradle.WhitespaceFunSpecExampleTest/outer context -- a nested test",
+         "a nested test"
+      )
+      resolve(location) shouldHaveSize 1
+   }
+
+   fun `test resolves a nested test from a single segment path`() {
+      // IntelliJ's Gradle test event integration only carries a leaf test's own name on the
+      // locationUrl - unlike the JUnit Platform launcher's MethodSource, it drops every ancestor
+      // container segment. A nested test therefore arrives here as a single-segment path
+      // indistinguishable in shape from a top-level test, and must still resolve by searching
+      // the whole tree rather than only the top level.
+      myFixture.configureByFiles("/funspec.kt", "/io/kotest/core/spec/style/specs.kt")
+      val location = EmbeddedLocation(
+         "io.kotest.samples.gradle.FunSpecExampleTest/a nested test",
+         "a nested test"
+      )
+      resolve(location) shouldHaveSize 1
+   }
+
+   fun `test resolves the correct leaf when the same name is nested under two different top level containers`() {
+      // "child1" appears twice - once under "base", once under "base 2" - a bare single-segment
+      // path can't tell these apart (see EmbeddedLocationTestLocator#findByNameAtAnyDepth), but
+      // once GradleParentIdParser restores the real ancestor chain onto the path (as
+      // EmbeddedLocationParser#parseLocationUrl now does), navigation must land on the exact one.
+      myFixture.configureByFiles("/duplicate-leaf-funspec.kt", "/io/kotest/core/spec/style/specs.kt")
+      val location = EmbeddedLocation(
+         "io.kotest.samples.gradle.DuplicateLeafFunSpecExampleTest/base 2 -- inner root -- child1",
+         "child1"
+      )
+      val results = resolve(location)
+      results shouldHaveSize 1
+
+      val fileText = results.first().psiElement.containingFile.text
+      val resolvedOffset = results.first().psiElement.textRange.startOffset
+      // the "base 2" block starts strictly after the "base" block in source, so landing after
+      // "base 2"'s own declaration (and not merely after "base"'s) proves we resolved the leaf
+      // nested under "base 2", not the identically-named one under "base".
+      resolvedOffset shouldBeGreaterThan fileText.indexOf("context(\"base 2\")")
+   }
+}
```

**File**: `kotest-intellij-plugin/src/test/resources/duplicate-leaf-funspec.kt` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package io.kotest.samples.gradle
+
+import io.kotest.core.spec.style.FunSpec
+
+class DuplicateLeafFunSpecExampleTest : FunSpec({
+
+   context("base") {
+      context("inner root") {
+         test("child1") {
+         }
+         test("child2") {
+         }
+      }
+   }
+
+   context("base 2") {
+      context("inner root") {
+         test("child1") {
+         }
+         test("child2") {
+         }
+      }
+   }
+})
```

**File**: `kotest-intellij-plugin/src/test/resources/whitespace-funspec.kt` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+package io.kotest.samples.gradle
+
+import io.kotest.core.spec.style.FunSpec
+
+class WhitespaceFunSpecExampleTest : FunSpec({
+
+   context("outer context") {
+
+      test("a  nested   test") {
+      }
+   }
+})
```

---

### Incident Patch 8: `07fe93c1` (2026-07-25)
**Commit Message**: fix(assertions): state the containExactCopies lower bound as at least 1 (#6193)

## Summary

Fixes #6182.

`shouldContainExactCopies` / `shouldNotContainExactCopies` reject
`copies = 0`
with `IllegalArgumentException: Copies should be positive, was 0`. Per
the
discussion on the issue the rejection itself is intentional - `copies`
was
designed so that zero is impossible, and a zero-count assertion belongs
in
`shouldContain` / `shouldNotContain`. So this keeps the behaviour and
only makes
the boundary explicit.

## Why this matters

The current message says "should be positive", which does not tell the
caller
what the accepted range actually is. On the issue, `copies = 0` was read
as a
matcher bug rather than an out-of-range argument, precisely because the
message
describes a property instead of a bound - the reporter's first
assumption was
that `listOf(1, 2, 3).shouldContainExactCopies(element = 4, copies = 0)`
should
pass, since the list does contain exactly zero copies of `4`.

Nothing in the test suite pinned the boundary either: the existing specs
cover
`copies = 1` and mismatched counts, so the `require` could have been
loosened or
tightened without a failing test. Both halves 

**File**: `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/matchers/collections/ContainExactCopies.kt` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ fun <T> Array<T>.shouldContainExactCopies(element: T, copies: Int): Array<T> = a
 }
 fun <T, C : Collection<T>> containExactCopies(element: T, copies: Int) = object : Matcher<C> {
    override fun test(value: C) : MatcherResult {
-      require(copies > 0) { "Copies should be positive, was $copies" }
+      require(copies > 0) { "Copies must be at least 1, was $copies." }
       val passedAtIndexes = value.mapIndexedNotNull {
             index, it -> if(it == element) index else null
       }
```

**File**: `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/matchers/string/containExactCopies.kt` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ fun String.containExactCopies(
    ) = object : Matcher<String> {
    override fun test(value: String) : MatcherResult {
       require(substring.isNotEmpty()) { "Element should not be empty" }
-      require(copies > 0) { "Copies should be positive, was $copies" }
+      require(copies > 0) { "Copies must be at least 1, was $copies." }
       val containsAtIndexes = substringFoundAtIndexes(
          value,
          substring,
```

**File**: `kotest-assertions/kotest-assertions-core/src/jvmTest/kotlin/com/sksamuel/kotest/matchers/collections/ContainExactCopiesTest.kt` (modified, +6/-0)
```diff
@@ -4,6 +4,7 @@ import io.kotest.assertions.throwables.shouldThrow
 import io.kotest.core.spec.style.WordSpec
 import io.kotest.matchers.collections.shouldContainExactCopies
 import io.kotest.matchers.collections.shouldNotContainExactCopies
+import io.kotest.matchers.shouldBe
 import io.kotest.matchers.string.shouldContain
 import io.kotest.matchers.string.shouldContainInOrder
 
@@ -32,6 +33,11 @@ class ContainExactCopiesTest : WordSpec() {
                "but contained 2 copies at index(es) [2, 3]"
             )
          }
+         "reject zero copies with a clear boundary message" {
+            shouldThrow<IllegalArgumentException> {
+               listOf(1, 2, 3).shouldContainExactCopies(element = 4, copies = 0)
+            }.message shouldBe "Copies must be at least 1, was 0."
+         }
          "find similar element" {
             shouldThrow<AssertionError> {
                listOf(sweetRedApple, sweetRedCherry).shouldContainExactCopies(
```

**File**: `kotest-assertions/kotest-assertions-core/src/jvmTest/kotlin/com/sksamuel/kotest/matchers/string/ContainExactCopiesTest.kt` (modified, +6/-0)
```diff
@@ -2,6 +2,7 @@ package com.sksamuel.kotest.matchers.string
 
 import io.kotest.assertions.throwables.shouldThrow
 import io.kotest.core.spec.style.WordSpec
+import io.kotest.matchers.shouldBe
 import io.kotest.matchers.string.shouldContainExactCopies
 import io.kotest.matchers.string.shouldContainInOrder
 import io.kotest.matchers.string.shouldNotContainExactCopies
@@ -34,6 +35,11 @@ class ContainExactCopiesTest : WordSpec() {
                "but contained 1 copies at index(es) [0]"
             )
          }
+         "reject zero copies with a clear boundary message" {
+            shouldThrow<IllegalArgumentException> {
+               "Mayday".shouldContainExactCopies("ay", copies = 0, allowOverlaps = false)
+            }.message shouldBe "Copies must be at least 1, was 0."
+         }
       }
       "shouldNotContainExactCopies" should {
          "fail if the count matches" {
```

---

### Incident Patch 9: `3e0202f2` (2026-07-08)
**Commit Message**: fix: attach Fail fast scope tracker for each root test case in instance per spec mode (#6160)

fixes #6157 


In 6.1.11 (pre 6.2) it seems like FailFastInterceptor was directly tied
to SpecContext and the state was stored on the context itself. Within
The Instance per root spec inspector, a new spec context was created
hence tracking was clean.

In the new system the tracking was moved to its own coroutine level
context FailFastScopeTracker, and that is not being instantiated fresh
in between root spec executions. The errors then share the same fail
fast execution tracker (at the seed spec level ), and fail fast gets
conflated between root specs.

Wrote two regression tests (the majority of this PR) that verify that
both spec level and project level fail fast do not have the same state
conflation issue.


```kt
// verify that a failure in first root spec does not affect the second root spec

private class InstancePerRootProjectFailFastFreeSpec : FreeSpec({
   "Test root with failure test" - {
      "Test a" { }
      "Test b" { error("fail") }
      "Test c" {}
   }

   "Second root test" - {
      "second test" { }
      "third test" { }
      "fourth test" { }
   }
})
```

Co-aut

**File**: `kotest-framework/kotest-framework-engine/src/commonMain/kotlin/io/kotest/engine/spec/execution/InstancePerRootSpecExecutor.kt` (modified, +1/-2)
```diff
@@ -120,7 +120,7 @@ internal class InstancePerRootSpecExecutor(
       val specContext = SpecContext.create()
 
       // we switch to a new coroutine for each spec instance
-      withContext(CoroutineName("spec-scope-" + spec.hashCode())) {
+      withContext(CoroutineName("spec-scope-" + spec.hashCode()) + FailFastScopeTracker()) {
          pipeline.execute(spec, ref) {
             val result = executeTest(freshRoot, specContext)
             Result.success(mapOf(freshRoot to result))
@@ -153,4 +153,3 @@ internal class InstancePerRootSpecExecutor(
    }
 }
 
-
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmTest/kotlin/com/sksamuel/kotest/engine/test/FailFastInstancePerRootTest.kt` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+package com.sksamuel.kotest.engine.test
+
+import io.kotest.core.annotation.EnabledIf
+import io.kotest.core.annotation.LinuxOnlyGithubCondition
+import io.kotest.core.config.AbstractProjectConfig
+import io.kotest.core.spec.IsolationMode
+import io.kotest.core.spec.SpecRef
+import io.kotest.core.spec.style.FreeSpec
+import io.kotest.core.spec.style.FunSpec
+import io.kotest.engine.TestEngineLauncher
+import io.kotest.engine.listener.CollectingTestEngineListener
+import io.kotest.matchers.shouldBe
+
+@EnabledIf(LinuxOnlyGithubCondition::class)
+class FailFastInstancePerRootTest : FunSpec({
+
+   test("project failfast should not skip sibling roots in InstancePerRoot mode") {
+      val config = object : AbstractProjectConfig() {
+         override val failfast = true
+         override val isolationMode = IsolationMode.InstancePerRoot
+      }
+
+      val listener = CollectingTestEngineListener()
+
+      TestEngineLauncher()
+         .withListener(listener)
+         .withProjectConfig(config)
+         .withSpecRefs(SpecRef.Reference(InstancePerRootProjectFailFastFreeSpec::class))
+         .execute()
+
+      listener.result("Test a")?.isSuccess shouldBe true
+      listener.result("Test b")?.isError shouldBe true
+      listener.result("Test c")?.isIgnored shouldBe true
+
+      listener.result("second test")?.isSuccess shouldBe true
+      listener.result("third test")?.isSuccess shouldBe true
+      listener.result("fourth test")?.isSuccess shouldBe true
+   }
+
+   test("spec failfast should not skip sibling roots in InstancePerRoot mode") {
+      val config = object : AbstractProjectConfig() {
+         override val isolationMode = IsolationMode.InstancePerRoot
+      }
+
+      val listener = CollectingTestEngineListener()
+
+      TestEngineLauncher()
+         .withListener(listener)
+         .withProjectConfig(config)
+         .withSpecRefs(SpecRef.Reference(InstancePerRootSpecFailFastFreeSpec::class))
+         .execute()
+
+      listener.result("spec Test a")?.isSuccess shouldBe true
+      listener.result("spec Test b")?.isError shouldBe true
+      listener.result("spec Test c")?.isIgnored shouldBe true
+
+      listener.result("spec second test")?.isSuccess shouldBe true
+      listener.result("spec third test")?.isSuccess shouldBe true
+      listener.result("spec fourth test")?.isSuccess shouldBe true
+   }
+})
+
+private class InstancePerRootProjectFailFastFreeSpec : FreeSpec({
+   "Test root with failure test" - {
+      "Test a" { }
+      "Test b" { error("fail") }
+      "Test c" {}
+   }
+
+   "Second root test" - {
+      "second test" { }
+      "third test" { }
+      "fourth test" { }
+   }
+})
+
+private class InstancePerRootSpecFailFastFreeSpec : FreeSpec({
+   failfast = true
+
+   "Spec root with failure test" - {
+      "spec Test a" { }
+      "spec Test b" { error("fail") }
+      "spec Test c" {}
+   }
+
+   "Spec second root test" - {
+      "spec second test" { }
+      "spec third test" { }
+      "spec fourth test" { }
+   }
+})
```

---

### Incident Patch 10: `01c7429b` (2026-07-07)
**Commit Message**: fix(kotest-assertions-core): Handle null map values in shouldBeEqualUsingFields (#6112)

## Bug

`compareMaps` in `compare.kt` used a non-null assertion on the actual
map's values:

```kotlin
compareValue(a, b, a!!::class, "$field[$key]", config, prop)
```

If the actual map contains a `null` value (e.g. a `Map<String, String?>`
field with `"foo" to null` on both sides), `a!!` throws a
`KotlinNullPointerException`. The `runCatching` in `beEqualUsingFields`
converts it into a failure with the message "Error using
shouldBeEqualUsingFields matcher" — so two equal objects fail
`shouldBeEqualUsingFields`.

## Repro

```kotlin
data class Container(val map: Map<String, String?>)
Container(mapOf("foo" to null)) shouldBeEqualUsingFields Container(mapOf("foo" to null))
// fails with "Error using shouldBeEqualUsingFields matcher"
```

## Fix

Handle null map values explicitly, mirroring `compareCollections`
directly above:
- both values null → match
- only one side null → reported as a regular field difference (`Expected
X but actual was null` / `Expected null but actual was X`)
- otherwise compare as before using `a::class`

## Tests

Added to `EqualToComparingFieldsTest`:
- both maps have a

**File**: `kotest-assertions/kotest-assertions-core/src/jvmMain/kotlin/io/kotest/matchers/equality/compare.kt` (modified, +15/-1)
```diff
@@ -139,7 +139,21 @@ private fun compareMaps(
       actual.keys.map { key ->
          val a = actual[key]
          val b = expected[key]
-         compareValue(a, b, a!!::class, "$field[$key]", config, prop)
+         val entryName = "$field[$key]"
+         when {
+            a == null && b == null -> CompareResult.empty
+            a == null -> CompareResult.single(
+               entryName,
+               AssertionErrorBuilder.create().withMessage("Expected ${b.print().value} but actual was null").build()
+            )
+
+            b == null -> CompareResult.single(
+               entryName,
+               AssertionErrorBuilder.create().withMessage("Expected null but actual was ${a.print().value}").build()
+            )
+
+            else -> compareValue(a, b, a::class, entryName, config, prop)
+         }
       }.reduce { a, op -> a.reduce(op) }
    }
 }
```

**File**: `kotest-assertions/kotest-assertions-core/src/jvmTest/kotlin/com/sksamuel/kotest/matchers/equality/EqualToComparingFieldsTest.kt` (modified, +29/-0)
```diff
@@ -51,6 +51,7 @@ class EqualToComparingFieldsTest : FunSpec() {
    class MapContainer(val map: Map<String, Box>)
    class NullableListContainer(val list: List<Box>?)
    class NullableMapContainer(val map: Map<String, Box>?)
+   data class NullableValueMapContainer(val map: Map<String, String?>)
 
    data class CompletelyDifferent1(val field1: String, val field2: String)
    class CompletelyDifferent2(numberField: Int) {
@@ -446,6 +447,34 @@ Fields that differ:
          a shouldBeEqualUsingFields b
       }
 
+      test("should compare maps with null values") {
+         val a = NullableValueMapContainer(mapOf("foo" to null))
+         val b = NullableValueMapContainer(mapOf("foo" to null))
+         a shouldBeEqualUsingFields b
+      }
+
+      test("should fail when actual map value is null but expected is not") {
+         val a = NullableValueMapContainer(mapOf("foo" to null))
+         val b = NullableValueMapContainer(mapOf("foo" to "bar"))
+         val message = shouldFail {
+            a shouldBeEqualUsingFields b
+         }.message
+         message shouldNotContain "Error using shouldBeEqualUsingFields matcher"
+         message shouldContain """Fields that differ:
+ - map[foo]  =>  Expected "bar" but actual was null"""
+      }
+
+      test("should fail when expected map value is null but actual is not") {
+         val a = NullableValueMapContainer(mapOf("foo" to "bar"))
+         val b = NullableValueMapContainer(mapOf("foo" to null))
+         val message = shouldFail {
+            a shouldBeEqualUsingFields b
+         }.message
+         message shouldNotContain "Error using shouldBeEqualUsingFields matcher"
+         message shouldContain """Fields that differ:
+ - map[foo]  =>  Expected null but actual was "bar""""
+      }
+
       test("should handle nullable maps") {
          val a = NullableMapContainer(null)
          val b = NullableMapContainer(mapOf())
```

---

### Incident Patch 11: `44887a50` (2026-07-07)
**Commit Message**: fix(kotest-framework-engine): Use display-name rendering for ignored tests in TeamCity listener (#6119)

## Bug

`TeamCityTestEngineListener.testIgnored` emitted the raw descriptor path
(`fqn/name -- child`) via `testCase.descriptor.path().value`, while
`testStarted`/`testFinished` use `renderer.testPath(testCase)`
(display-name formatting, `@DisplayName` support, TeamCity name
escaping, flattened `fqn.name ⇢ child` form). As a result, ignored tests
appeared in IntelliJ under a different, unformatted name than the same
test when it runs, and bypassed display-name formatting entirely.

## Fix

`testIgnored` now renders the test name via the same
`TeamCityPathRenderer` path as started/finished events. The renderer
builds the flattened parent chain from the `TestCase` itself, so ignored
tests render consistently even when their parents never emitted start
events.

## Tests

- Updated `TeamCityTestEngineListenerTest` "should support ignored tests
with reason" to expect the formatted `fqn.a ⇢ b ⇢ c` name (matching what
started/finished would produce for the same test).
- Added a case for a nested ignored test whose parents were never
started.

🤖 Generated with [Claude Code](https://cla

**File**: `kotest-framework/kotest-framework-engine/src/commonMain/kotlin/io/kotest/engine/listener/TeamCityTestEngineListener.kt` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ class TeamCityTestEngineListener(
 
    override suspend fun testIgnored(testCase: TestCase, reason: String?) {
       TeamCityMessage(prefix, TeamCityMessage.Types.TEST_IGNORED) {
-         name(testCase.descriptor.path().value)
+         name(renderer.testPath(testCase))
          locationHint(Locations.location(testCase.source))
          message(reason)
          result(TestResult.Ignored(reason))
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmTest/kotlin/com/sksamuel/kotest/engine/listener/TeamCityTestEngineListenerEmbeddedLocationsTest.kt` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@ import io.kotest.matchers.string.shouldStartWith
  * The engine no longer wraps test names with `<kotest>...</kotest>` location tags - jump-to-source
  * navigation now flows via the JUnit Platform `MethodSource` (and `proxy.locationUrl`).  This test
  * pins the resulting [TeamCityTestEngineListener] output: every lifecycle message names the test
- * by its plain descriptor path, with no embedded `<kotest>` tag and no legacy ` -- ` separator
+ * via the display-name renderer, with no embedded `<kotest>` tag and no legacy ` -- ` separator
  * between nested segments.
  */
 class TeamCityTestEngineListenerEmbeddedLocationsTest : FunSpec() {
@@ -54,7 +54,7 @@ class TeamCityTestEngineListenerEmbeddedLocationsTest : FunSpec() {
          stdout shouldNotContain "<kotest>"
          stdout shouldNotContain " -- "
          stdout shouldStartWith "tc[testIgnored "
-         stdout shouldContain "name='$specFqn/a'"
+         stdout shouldContain "name='$specFqn.a'"
          stdout shouldContain "result_status='Ignored'"
       }
 
```

**File**: `kotest-framework/kotest-framework-engine/src/jvmTest/kotlin/com/sksamuel/kotest/engine/listener/TeamCityTestEngineListenerTest.kt` (modified, +20/-1)
```diff
@@ -121,7 +121,26 @@ a[testSuiteFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngine
          }
          stripDetails(output) shouldBe """a[enteredTheMatrix]
 a[testSuiteStarted name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest' locationHint='kotest://com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest:1']
-a[testIgnored name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest/a -- b -- c' locationHint='kotest://foo.bar.Test:33' message='don|'t like it' result_status='Ignored']
+a[testIgnored name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest.a ⇢ b ⇢ c' locationHint='kotest://foo.bar.Test:33' message='don|'t like it' result_status='Ignored']
+a[testSuiteFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest']
+"""
+      }
+
+      test("should use display name rendering for nested ignored tests when parents were not started") {
+         val output = captureStandardOut {
+            val listener = TeamCityTestEngineListener("a")
+            listener.engineStarted()
+            listener.specStarted(SpecRef.Reference(TeamCityTestEngineListenerTest::class))
+            listener.testIgnored(c, "skipped")
+            listener.specFinished(
+               SpecRef.Reference(TeamCityTestEngineListenerTest::class),
+               TestResult.Success(0.seconds)
+            )
+            listener.engineFinished(emptyList())
+         }
+         stripDetails(output) shouldBe """a[enteredTheMatrix]
+a[testSuiteStarted name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest' locationHint='kotest://com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest:1']
+a[testIgnored name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest.a ⇢ b ⇢ c' locationHint='kotest://foo.bar.Test:33' message='skipped' result_status='Ignored']
 a[testSuiteFinished name='com.sksamuel.kotest.engine.listener.TeamCityTestEngineListenerTest']
 """
       }
```

---

### Incident Patch 12: `86a7d93c` (2026-06-29)
**Commit Message**: Fix typo in proptest config docs (#6155)

Change the header for the `maxFailure` configuration property from "Min
Failure" to "Max Failure" to mirror the configuration property name.

<img width="855" height="380" alt="image"
src="https://github.com/user-attachments/assets/45016e3a-75b2-4fcc-8aad-5cfa47eafc2a"
/>


<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->

Co-authored-by: Alex Kuznetsov <[REDACTED_EMAIL]>

**File**: `documentation/docs/proptest/config.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ test.
 
 For full details on how the seed is used [click here](seed.md).
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.2.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ class PropertyExample: StringSpec({
 })
 ```
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.3.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ class PropertyExample: StringSpec({
 })
 ```
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.4.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ test.
 
 For full details on how the seed is used [click here](seed.md).
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.5.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ test.
 
 For full details on how the seed is used [click here](seed.md).
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.6.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ test.
 
 For full details on how the seed is used [click here](seed.md).
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.7.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ test.
 
 For full details on how the seed is used [click here](seed.md).
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

**File**: `documentation/versioned_docs/version-5.8.x/proptest/config.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ test.
 
 For full details on how the seed is used [click here](seed.md).
 
-### Min Failure
+### Max Failure
 
 By default, Kotest tolerates no failure. Perhaps you want to run some non-deterministic test a bunch of times, and you're happy
 to accept some small number of failures. You can specify that in config.
```

---

### Incident Patch 13: `a16146f6` (2026-06-18)
**Commit Message**: Fix data objects being considered equal in DataClassEq (#6144) (#6145)

Fixes #6144

## Problem

Distinct data objects are reported as equal:

```kotlin
sealed class BoolState(bytes: ByteArray?) {
   data object True : BoolState(byteArrayOf(1))
   data object False : BoolState(byteArrayOf(0))
   data object Unknown : BoolState(null)
}

BoolState.True shouldNotBe BoolState.False // fails — they are considered equal
```

## Root cause

`KClass.isData == true` for a `data object`, so `DefaultEqResolver`
routes the comparison to `DataClassEq`. `DataClassEq` determines
equality from a structural diff over the **primary constructor
members**, but a data object has no primary constructor, so the diff is
always empty.

Since #5602, an empty diff was treated as `EqResult.Success` (equal).
For data classes with members this is correct (it lets a registered
custom `Eq` on a field type override a strict `equals`, the #5601 case).
For data objects there is nothing to compare, so the empty diff silently
overrode the `equals()` verdict and made distinct objects compare equal.

This first shipped in 6.2.0 (regression commit e93a0b660).

## Fix

When `equals()` reports not-equal **and** there are n

**File**: `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/assertions/eq/DataClassEq.kt` (modified, +12/-1)
```diff
@@ -48,7 +48,18 @@ internal object DataClassEq : Eq<Any> {
             runCatching {
                val differences = dataClassDiff(actual, expected, context = context)
                if (differences == null || differences.differences.isEmpty()) {
-                  EqResult.Success
+                  // The structural diff only compares primary constructor members. When there are
+                  // none to compare (e.g. data objects), an empty diff does not establish equality,
+                  // so we must honor the equals() result, which already determined they are not equal.
+                  if (reflection.primaryConstructorMembers(expected::class).isEmpty()) {
+                     EqResult.Failure {
+                        AssertionErrorBuilder.create()
+                           .withValues(Expected(expected.print()), Actual(actual.print()))
+                           .build()
+                     }
+                  } else {
+                     EqResult.Success
+                  }
                } else {
                   val detailedDiffMsg = runCatching {
                      formatDifferences(differences) + "\n\n"
```

**File**: `kotest-assertions/kotest-assertions-core/src/jvmTest/kotlin/com/sksamuel/kotest/eq/DataClassEqTest.kt` (modified, +19/-0)
```diff
@@ -57,12 +57,31 @@ object InstantWithoutNanosEq : Eq<Instant> {
    }
 }
 
+sealed class BoolState(val bytes: ByteArray?) {
+   data object True : BoolState(byteArrayOf(1))
+   data object False : BoolState(byteArrayOf(0))
+   data object Unknown : BoolState(null)
+}
+
 class DataClassEqTest : StringSpec({
 
    "respects custom equals implementations in data classes" {
       IntRatio(1, 2) shouldBe IntRatio(2, 4)
    }
 
+   // https://github.com/kotest/kotest/issues/6144
+   "distinct data objects must not be considered equal" {
+      isDataClassInstance(BoolState.True) shouldBe true
+
+      BoolState.True shouldNotBe BoolState.False
+      BoolState.True shouldNotBe BoolState.Unknown
+      BoolState.False shouldNotBe BoolState.Unknown
+   }
+
+   "the same data object must be considered equal to itself" {
+      BoolState.True shouldBe BoolState.True
+   }
+
    "respects custom registered Eq function" {
       val i1 = Instant.fromEpochMilliseconds(1640995200000).plus(200.nanoseconds)
       val i2 = i1.plus(400.nanoseconds)
```

---

### Incident Patch 14: `b39700cd` (2026-06-17)
**Commit Message**: fix docs (#6147)

<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->

**File**: `documentation/README.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ Use `./cut-docs.sh` to automate steps 1–4
 2. Create the directory `./versioned_docs/version-<RELEASED_VERSION>`
 3. Copy the contents of `./docs/` to the folder
 4. Copy `./sidebars.js` to `./verioned_sidebars/version-<RELEASED_VERSION>-sidebars.json` and remove `module.exports = ` from the start of the file
-5. update the current version to the next value in docusaurus.config.js after running the script or executing steps 1-4 manually
+5. update the current version (normally line 155 - under `docs.versions.current.label`) to the next value (meaning if you are releasing 10.1 - this value should be 10.2) in docusaurus.config.js after running the script or executing steps 1-4 manually
 6. Push/merge to master to update [kotest.io](https://kotest.io)
 7. A crawl of newly added docs will be triggered by [github action _crawl_](/.github/workflows/crawl.yaml)
    * To manually initiate crawling, go to [crawler.algolia.com](https://crawler.algolia.com/admin/crawlers?sort=status&order=ASC&limit=20)
```

**File**: `documentation/docusaurus.config.js` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ module.exports = {
             docs: {
                versions: {
                   current: {
-                     label: `6.2 🚧`,
+                     label: `6.3 🚧`,
                   },
                },
                sidebarPath: require.resolve('./sidebars.js'),
```

---

### Incident Patch 15: `28d5cdfc` (2026-06-14)
**Commit Message**: allow building all targets via dispatch of kotest-test-examples (#6136)

<!-- 
If this PR updates documentation, please update all relevant versions of
the docs, see:
https://github.com/kotest/kotest/tree/master/documentation/versioned_docs
The documentation at
https://github.com/kotest/kotest/tree/master/documentation/docs is the
documentation for the next minor or major version _TO BE RELEASED_
-->
- allow building all targets via dispatch of kotest-test-examples

**File**: `.github/workflows/test-kotest-examples.yml` (modified, +3/-0)
```diff
@@ -30,6 +30,9 @@ concurrency:
 
 env:
    GRADLE_OPTS: -Dorg.gradle.configureondemand=true -Dorg.gradle.parallel=false -Dkotlin.incremental=false -Dorg.gradle.jvmargs="-Xmx3g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8"
+   # On non-master branches isMaster=false in Ci.kt, so Apple targets are skipped.
+   # This flag re-enables them so macOS publish jobs can produce iOS/tvOS/watchOS artifacts.
+   KOTEST_EXAMPLES_WORKFLOW: ${{ github.ref_name != 'master' && 'true' || '' }}
 
 jobs:
    publish-local-linux:
```

**File**: `buildSrc/src/main/kotlin/Ci.kt` (modified, +3/-2)
```diff
@@ -40,9 +40,10 @@ object Ci {
 
    /**
     * We only include watchos, tvsos and ios builds if it's a non-CI build or if it's master build
-    * due to the limited availability of the github macos runners
+    * due to the limited availability of the github macos runners.
+    * Can be overridden by setting KOTEST_EXAMPLES_WORKFLOW=true (set by test-kotest-examples.yml on non-master branches).
     */
-   val shouldRunWatchTvIosModules = isLocal || isMaster
+   val shouldRunWatchTvIosModules = isLocal || isMaster || System.getenv("KOTEST_EXAMPLES_WORKFLOW").toBoolean()
    val shouldAddLinuxTargets = isLocal || isLinuxRunner
 
    /**
```

#### Recent Merged Pull Requests:
- **PR #6240** (2026-09-26): propagate coroutine context via TestCoroutineInterceptor (@alfonsoristorato)
- **PR #6239** (2026-09-25): release gradle plugin along core deps for consistency (@alfonsoristorato)
- **PR #6238** (2026-09-25): Expose kotestVersion on the Kotest Gradle plugin extension (@dlwhdgus0810)
- **PR #6233** (2026-09-17): Fix outdated doc reference to kotlinx-datetime proptest artifact (@EdricChan03)
- **PR #6230** (2026-09-15): fix(kotest-tests-timeout-project): Format timeout in exception message (@marcphilipp)
- **PR #6228** (2026-09-11): Bump kotest-skills plugin version to 6.2.5 (@github-actions[bot])
- **PR #6226** (2026-09-09): add back jsoup assertions (@alfonsoristorato)
- **PR #6224** (2026-09-07): Bound the short/byte/uShort/uByte shrinkers by the generator range (@sksamuel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
