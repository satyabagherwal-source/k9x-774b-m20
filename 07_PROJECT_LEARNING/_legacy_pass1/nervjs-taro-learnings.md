# Forensic Learning Record (Deep Inspection): NervJS/taro

> **Canonical Artifact**: `07_PROJECT_LEARNING/nervjs-taro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NervJS/taro](https://github.com/NervJS/taro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:57:45.280Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NervJS/taro`
- **Description**: 开放式跨端跨框架解决方案，支持使用 React/Vue 等框架来开发微信/京东/百度/支付宝/字节跳动/ QQ 小程序/H5/React Native 等应用。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 37704 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'import',
    'jest',
    'react',
    'simple-import-sort',
    'taro',
  ],
  extends: [
    'eslint:recommended',
    'standard',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react/recommended'
  ],
  rules: {
    '@typescript-eslint/ban-ts-comment': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/indent': [2, 2],
    '@typescript-eslint/member-delimiter-style': [
      1,
      { multiline: { delimiter: 'none' }, singleline: { delimiter: 'comma' } },
    ],
    '@typescript-eslint/no-empty-function': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-namespace': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/no-this-alias': 0,
    '@typescript-eslint/no-unused-vars': [2, { argsIgnorePattern: '^_', args: 'after-used' }],
    '@typescript-eslint/no-use-before-define': [1, { functions: false, classes: false }],
    '@typescript-eslint/no-var-requires': 0,
    camelcase: 0,
    'comma-dangle': 0,
    'comma-spacing': 2,
    complexity: [2, 50],
    'eol-last': 2,
    'max-depth': [2, 10],
    'no-console': [2, { allow: ['warn', 'error'] }],
    'no-empty': 1,
    'no-multi-spaces': 2,
    'no-multiple-empty-lines': 0,
    'no-mixed-operators': 0,
    'no-prototype-builtins': 0,
    'no-unused-expressions': 0,
    'no-unused-vars': 'off',
    'no-use-before-define': 0,
    'import/first': 2,
    'import/newline-after-import': 2,
    'import/no-duplicates': 2,
    'import/no-named-default': 'off',
    indent: 0,
    'keyword-spacing': 2,
    'object-curly-spacing': 2,
    'operator-linebreak': [2, 'after', {
      overrides: { '?': 'before', ':': 'before' },
    }],
    'prefer-spread': 0,
    'prefer-rest-params': 0,
    'react/jsx-uses-vars': 1,
    'react/prop-types': 0,
    'react/no-find-dom-node': 0,
    'react/no-unknown-property': 0,
    quotes: [2, 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    semi: [2, 'never'],
    'simple-import-sort/imports': [
      2,
      {
        groups: [
          // Side effect imports.
          ['^\\u0000'],
          // Node.js builtins prefixed with `node:`.
          ['^node:'],
          // Packages.
          // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
          ['^@?\\w'],
          // Absolute imports and other imports such as Vue-style `@/foo`.
          // Anything not matched in another group.
          ['^'],
          // Relative imports.
          // Anything that starts with a dot.
          ['^\\.'],
          // Types Group
          ['^node:.*\\u0000$', '^@?\\w.*\\u0000$', '(?<=\\u0000)$', '^\\..*\\u0000$'],
        ],
      },
    ],
    'simple-import-sort/exports': 2,
    'space-before-function-paren': 0,
    'standard/no-callback-literal': 0,
    'taro/max-ternary-depth': [2, 3],
  },
  env: {
    'jest/globals': true,
    browser: true,
    node: true,
    es6: true,
  },
  globals: {
    testRule: 'readonly',
    wx: 'readonly',
    qq: 'readonly',
    tt: 'readonly',
    swan: 'readonly',
    my: 'readonly',
    getCurrentPages: 'readonly',
    getApp: 'readonly',
    requirePlugin: 'readonly',
    jd: 'readonly',
    ks: 'readonly',
    LOCATION_APIKEY: 'readonly',
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}

```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always', Infinity]
  }
}

```

### Core Architecture Module: `crates/native_binding/binding.d.ts`
```
/* auto-generated by NAPI-RS */
/* eslint-disable */

export class Creator {
  templateRoot: string
  destinationRoot: string
  constructor(templateRoot: string, destinationRoot: string)
  createFileFromTemplate(templateName: string, templatePath: string, destPath: string, options: CreateOptions): Promise<void>
}

export const enum CompilerType {
  Webpack4 = 'Webpack4',
  Webpack5 = 'Webpack5',
  Vite = 'Vite'
}

export interface CreateOptions {
  css?: CSSType
  cssExt?: string
  framework?: FrameworkType
  description?: string
  projectName: string
  version?: string
  date?: string
  typescript?: boolean
  buildEs5?: boolean
  template: string
  pageName?: string
  compiler?: CompilerType
  setPageName?: string
  subPkg?: string
  pageDir?: string
  setSubPkgPageName?: string
  changeExt?: boolean
  isCustomTemplate?: boolean
  pluginType?: string
  platforms?: Array<string>
}

export function createPage(conf: Page, handlers: Record<string, (err: Error | null, arg: CreateOptions) => any>): Promise<void>

export function createPlugin(conf: Plugin): Promise<void>

export function createProject(conf: Project, handlers: Record<string, (err: Error | null, arg: CreateOptions) => any>): Promise<void>

export const enum CSSType {
  None = 'None',
  Sass = 'Sass',
  Stylus = 'Stylus',
  Less = 'Less'
}

export const enum FrameworkType {
  React = 'React',
  Preact = 'Preact',
  Vue3 = 'Vue3',
  Solid = 'Solid',
  None = 'None'
}

export const enum NpmType {
  Yarn = 'Yarn',
  Cnpm = 'Cnpm',
  Pnpm = 'Pnpm',
  Npm = 'Npm'
}

export interface Page {
  projectDir: string
  projectName: string
  template: string
  templateRoot: string
  description?: string
  pageName: string
  date?: string
  framework: FrameworkType
  css: CSSType
  typescript?: boolean
  compiler?: CompilerType
  version?: string
  isCustomTemplate?: boolean
  customTemplatePath?: string
  basePageFiles: Array<string>
  period: PeriodType
  subPkg?: string
  pageDir?: string
}

export const enum PeriodType {
  CreateAPP = 'CreateAPP',
  CreatePage = 'CreatePage'
}

export interface Plugin {
  projectRoot: string
  projectName: string
  description?: string
  pluginType: string
  templateRoot: string
  version: string
  template: string
}

export interface Project {
  projectRoot: string
  projectName: string
  npm: NpmType
  description?: string
  typescript?: boolean
  buildEs5?: boolean
  template: string
  css: CSSType
  autoInstall?: boolean
  framework: FrameworkType
  templateRoot: string
  version: string
  date?: string
  compiler?: CompilerType
  period: PeriodType
  platforms?: Array<string>
}


```

### Core Architecture Module: `crates/native_binding/binding.js`
```
// prettier-ignore
/* eslint-disable */
/* auto-generated by NAPI-RS */

const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

const { platform, arch } = process

let nativeBinding = null
let localFileExisted = false
let loadError = null

function isMusl() {
  // For Node 10
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim()
      return readFileSync(lddPath, 'utf8').includes('musl')
    } catch (e) {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

switch (platform) {
  case 'android':
    switch (arch) {
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'taro.android-arm64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.android-arm64.node')
          } else {
            nativeBinding = require('@tarojs/binding-android-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm':
        localFileExisted = existsSync(join(__dirname, 'taro.android-arm-eabi.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.android-arm-eabi.node')
          } else {
            nativeBinding = require('@tarojs/binding-android-arm-eabi')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Android ${arch}`)
    }
    break
  case 'win32':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(
          join(__dirname, 'taro.win32-x64-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.win32-x64-msvc.node')
          } else {
            nativeBinding = require('@tarojs/binding-win32-x64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'ia32':
        localFileExisted = existsSync(
          join(__dirname, 'taro.win32-ia32-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.win32-ia32-msvc.node')
          } else {
            nativeBinding = require('@tarojs/binding-win32-ia32-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'taro.win32-arm64-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.win32-arm64-msvc.node')
          } else {
            nativeBinding = require('@tarojs/binding-win32-arm64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Windows: ${arch}`)
    }
    break
  case 'darwin':
    localFileExisted = existsSync(join(__dirname, 'taro.darwin-universal.node'))
    try {
      if (localFileExisted) {
        nativeBinding = require('./taro.darwin-universal.node')
      } else {
        nativeBinding = require('@tarojs/binding-darwin-universal')
      }
      break
    } catch {}
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(join(__dirname, 'taro.darwin-x64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.darwin-x64.node')
          } else {
            nativeBinding = require('@tarojs/binding-darwin-x64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'taro.darwin-arm64.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.darwin-arm64.node')
          } else {
            nativeBinding = require('@tarojs/binding-darwin-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`)
    }
    break
  case 'freebsd':
    if (arch !== 'x64') {
      throw new Error(`Unsupported architecture on FreeBSD: ${arch}`)
    }
    localFileExisted = existsSync(join(__dirname, 'taro.freebsd-x64.node'))
    try {
      if (localFileExisted) {
        nativeBinding = require('./taro.freebsd-x64.node')
      } else {
        nativeBinding = require('@tarojs/binding-freebsd-x64')
      }
    } catch (e) {
      loadError = e
    }
    break
  case 'linux':
    switch (arch) {
      case 'x64':
        if (isMusl()) {
          localFileExisted = existsSync(
            join(__dirname, 'taro.linux-x64-musl.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./taro.linux-x64-musl.node')
            } else {
              nativeBinding = require('@tarojs/binding-linux-x64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(
            join(__dirname, 'taro.linux-x64-gnu.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./taro.linux-x64-gnu.node')
            } else {
              nativeBinding = require('@tarojs/binding-linux-x64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm64':
        if (isMusl()) {
          localFileExisted = existsSync(
            join(__dirname, 'taro.linux-arm64-musl.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./taro.linux-arm64-musl.node')
            } else {
              nativeBinding = require('@tarojs/binding-linux-arm64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(
            join(__dirname, 'taro.linux-arm64-gnu.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./taro.linux-arm64-gnu.node')
            } else {
              nativeBinding = require('@tarojs/binding-linux-arm64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm':
        localFileExisted = existsSync(
          join(__dirname, 'taro.linux-arm-gnueabihf.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./taro.linux-arm-gnueabihf.node')
          } else {
            nativeBinding = require('@tarojs/binding-linux-arm-gnueabihf')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`)
    }
    break
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

module.exports.default = module.exports = nativeBinding

```

### Core Architecture Module: `crates/native_binding/postinstall.js`
```
const { execSync } = require('child_process')
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { join, resolve } = require('path')
const { platform, arch } = require('os')

const { platformArchTriples } = require('@napi-rs/triples')

const PLATFORM_NAME = platform()
const ARCH_NAME = arch()

if (process.env.npm_config_build_from_source || process.env.BUILD_TARO_FROM_SOURCE) {
  let libExt
  let dylibName = 'taro_binding'
  switch (PLATFORM_NAME) {
    case 'darwin':
      libExt = '.dylib'
      dylibName = `lib${dylibName}`
      break
    case 'win32':
      libExt = '.dll'
      break
    case 'linux':
    case 'freebsd':
    case 'openbsd':
    case 'android':
    case 'sunos':
      dylibName = `lib${dylibName}`
      libExt = '.so'
      break
    default:
      throw new TypeError('Operating system not currently supported or recognized by the build script')
  }
  execSync('cargo build --release', {
    stdio: 'inherit',
    env: process.env,
  })
  let dylibPath = join(__dirname, 'target', 'release', `${dylibName}${libExt}`)
  if (!existsSync(dylibPath)) {
    dylibPath = join(resolve(__dirname, '..', '..'), 'target', 'release', `${dylibName}${libExt}`)
  }
  const dylibContent = readFileSync(dylibPath)
  const triples = platformArchTriples[PLATFORM_NAME][ARCH_NAME]
  const tripe = triples[0]
  writeFileSync(join(__dirname, `taro.${tripe.platformArchABI}.node`), dylibContent)
}

```

### Core Architecture Module: `crates/native_binding/src/lib.rs`
```
#![deny(clippy::all)]
#[macro_use]
extern crate napi_derive;

use std::collections::HashMap;

use napi::{threadsafe_function::ThreadsafeFunction, Result};
use taro_init::{creator::CreateOptions, page::Page, plugin::Plugin, project::Project};

#[napi]
pub async fn create_project(
  conf: Project,
  handlers: HashMap<String, ThreadsafeFunction<CreateOptions>>,
) -> Result<()> {
  let project: Project = Project::new(
    conf.project_root,
    conf.project_name,
    conf.npm,
    conf.description,
    conf.typescript,
    conf.build_es5,
    conf.template,
    conf.css,
    conf.framework,
    conf.auto_install,
    conf.template_root,
    conf.version,
    conf.date,
    conf.compiler,
    conf.period,
    conf.platforms,
  );
  let mut thread_safe_functions = HashMap::new();
  for (key, callback) in handlers {
    thread_safe_functions.insert(key, callback);
  }
  if let Err(e) = project.create(thread_safe_functions).await {
    println!("创建项目错误，原因如下：");
    println!("{:?}", e);
    return Err(napi::Error::from_reason(format!("{:?}", e)));
  }
  Ok(())
}

#[napi]
pub async fn create_page(
  conf: Page,
  handlers: HashMap<String, ThreadsafeFunction<CreateOptions>>,
) -> Result<()> {
  let page = Page::new(
    conf.project_dir,
    conf.project_name,
    conf.template,
    conf.template_root,
    conf.description,
    conf.page_name,
    conf.date,
    conf.framework,
    conf.css,
    conf.typescript,
    conf.compiler,
    conf.version,
    conf.is_custom_template,
    conf.custom_template_path,
    conf.base_page_files,
    conf.period,
    conf.sub_pkg,
    conf.page_dir,
  );
  let mut thread_safe_functions = HashMap::new();
  for (key, callback) in handlers {
    thread_safe_functions.insert(key, callback);
  }
  if let Err(e) = page.create(thread_safe_functions).await {
    println!("创建页面错误，原因如下：");
    println!("{:?}", e);
    return Err(napi::Error::from_reason(format!("{:?}", e)));
  }
  Ok(())
}

#[napi]
pub async fn create_plugin(conf: Plugin) -> Result<()> {
  let plugin = Plugin::new(
    conf.project_root,
    conf.project_name,
    conf.description,
    conf.plugin_type,
    conf.template_root,
    conf.version,
    conf.template,
  );
  if let Err(e) = plugin.create().await {
    println!("创建插件错误，原因如下：");
    println!("{:?}", e);
    return Err(napi::Error::from_reason(format!("{:?}", e)));
  }
  Ok(())
}

```

### Core Architecture Module: `crates/swc_plugin_compile_mode/src/lib.rs`
```
use serde::Deserialize;
use std::collections::HashMap;
use swc_core::{
  ecma::{
    ast::Program,
    visit::{as_folder, FoldWith, VisitMut},
  },
  plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

#[cfg(test)]
mod tests;
mod transform;
mod transform_harmony;
mod utils;

struct SerdeDefault;
impl SerdeDefault {
  fn platform_default() -> String {
    String::from("WEAPP")
  }
  fn is_use_xs_default() -> bool {
    true
  }
  fn template_tag_default() -> String {
    String::from("")
  }
}

#[derive(Deserialize, Debug)]
pub struct ComponentReplace {
  pub current_init: String,
  pub dependency_define: String,
}
#[derive(Deserialize, Debug)]
pub struct PluginConfig {
  pub tmpl_prefix: String,
  #[serde(default = "SerdeDefault::platform_default")]
  pub platform: String,
  #[serde(default)]
  pub is_harmony: bool,
  #[serde(default)]
  pub components: HashMap<String, HashMap<String, String>>,
  #[serde(default)]
  pub adapter: HashMap<String, String>,
  #[serde(default)]
  pub support_events: Vec<String>,
  #[serde(default)]
  pub support_components: Vec<String>,
  #[serde(default)]
  pub event_adapter: HashMap<String, String>,
  #[serde(default)]
  pub component_replace: HashMap<String, ComponentReplace>,
  #[serde(default = "SerdeDefault::is_use_xs_default")]
  pub is_use_xs: bool,
  #[serde(default = "SerdeDefault::template_tag_default")]
  pub template_tag: String,
}

/// An example plugin function with macro support.
/// `plugin_transform` macro interop pointers into deserialized structs, as well
/// as returning ptr back to host.
///
/// It is possible to opt out from macro by writing transform fn manually
/// if plugin need to handle low-level ptr directly via
/// `__transform_plugin_process_impl(
///     ast_ptr: *const u8, ast_ptr_len: i32,
///     unresolved_mark: u32, should_enable_comments_proxy: i32) ->
///     i32 /*  0 for success, fail otherwise.
///             Note this is only for internal pointer interop result,
///             not actual transform result */`
///
/// This requires manual handling of serialization / deserialization from ptrs.
/// Refer swc_plugin_macro to see how does it work internally.
#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
  let config =
    serde_json::from_str::<PluginConfig>(&metadata.get_transform_plugin_config().unwrap()).unwrap();

  // 如果 config 中的 is_harmony 字段为 true 则走 harmony_transform, 否则则走 transform
  let visitor: Box<dyn VisitMut> = if config.is_harmony {
    Box::new(transform_harmony::TransformVisitor::new(config))
  } else {
    Box::new(transform::TransformVisitor::new(config))
  };

  program.fold_with(&mut as_folder(visitor))
}

```

### Core Architecture Module: `crates/swc_plugin_compile_mode/src/transform.rs`
```
use crate::utils::{self, constants::*, transform_taro_components};
use crate::{utils::as_xscript_expr_string, PluginConfig};
use std::collections::HashMap;
use std::vec;
use swc_core::{
  atoms::Atom,
  common::{iter::IdentifyLast, util::take::Take, Spanned, DUMMY_SP as span},
  ecma::{
    self,
    ast::*,
    utils::{quote_ident, quote_str},
    visit::{VisitMut, VisitMutWith},
  },
  plugin::errors::HANDLER,
};

struct PreVisitor {
  // HashMap<导出名, 模块标识符>
  pub import_specifiers: HashMap<String, String>,
  // HashMap<导出名, 别名>
  // import { x as y } from 'pkg'; import_aliases: [[x -> y]]
  pub import_aliases: HashMap<String, String>,
}

impl PreVisitor {
  fn new(
    import_specifiers: HashMap<String, String>,
    import_aliases: HashMap<String, String>,
  ) -> Self {
    Self {
      import_specifiers,
      import_aliases,
    }
  }
}
impl VisitMut for PreVisitor {
  fn visit_mut_jsx_element_children(&mut self, children: &mut Vec<JSXElementChild>) {
    let len = children.len();

    // 当 JSX 循环表达式存在兄弟节点，且这些兄弟节点中有动态节点（存在 JSX 表达式）时，
    // 自动为该循环体外层包裹一个 <block>。
    // 对应测试用例：should_loop_be_wrapped_when_its_not_the_only_child
    if len > 1 {
      let mut list: Vec<usize> = vec![];

      // 收集 JSX 循环表达式到 list
      children.iter_mut().enumerate().for_each(|(i, child)| {
        if let JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(expr),
          ..
        }) = child
        {
          if let Expr::Call(CallExpr {
            callee: Callee::Expr(callee_expr),
            args,
            ..
          }) = &mut **expr
          {
            if utils::is_call_expr_of_loop(callee_expr, args) {
              list.push(i);
            }
          }
        }
      });

      // 遍历 list，为每个 child 的外层包裹 <block>
      fn wrap(list: Vec<usize>, children: &mut Vec<JSXElementChild>) {
        list.into_iter().for_each(|i| {
          let child = &mut children[i];
          if let JSXElementChild::JSXExprContainer(JSXExprContainer {
            expr: JSXExpr::Expr(expr),
            ..
          }) = child
          {
            let expr = expr.take();
            *child = JSXElementChild::JSXElement(Box::new(JSXElement {
              span,
              opening: JSXOpeningElement {
                name: JSXElementName::Ident(quote_ident!("block")),
                span,
                attrs: vec![],
                self_closing: false,
                type_args: None,
              },
              children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
                span,
                expr: JSXExpr::Expr(expr),
              })],
              closing: Some(JSXClosingElement {
                span,
                name: JSXElementName::Ident(quote_ident!("block")),
              }),
            }));
          }
        });
      }

      if list.len() == 1 {
        // 只有一个 JSX 循环表达式时，检查兄弟节点是否全是静态节点，如果不是则要包裹 <block>
        let mut pure = true;
        let index = list[0];
        for i in 0..len {
          if i != index && !utils::is_static_jsx_element_child(&children[i]) {
            pure = false;
            break;
          }
        }
        if !pure {
          wrap(list, children);
        }
      } else if list.len() > 1 {
        // 有多个 JSX 循环表达式时一定要包裹 <block>
        wrap(list, children);
      }
    }

    children.visit_mut_children_with(self);
  }
  fn visit_mut_jsx_element_child(&mut self, child: &mut JSXElementChild) {
    if let JSXElementChild::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::Expr(expr),
      ..
    }) = child
    {
      if let Expr::Paren(ParenExpr { expr: e, .. }) = &mut **expr {
        *expr = e.take();
      }

      match &mut **expr {
        Expr::Bin(BinExpr {
          op, left, right, ..
        }) => {
          // C&&A 替换为 C?A:A'，原因是为了无论显示还是隐藏都保留一个元素，从而不影响兄弟节点的变量路径
          if *op == op!("&&") {
            fn inject_compile_if(el: &mut Box<JSXElement>, condition: &mut Box<Expr>) -> () {
              el.opening
                .attrs
                .push(utils::create_jsx_expr_attr(COMPILE_IF, condition.clone()));
            }
            fn get_element_double(
              element_name: JSXElementName,
              condition: &mut Box<Expr>,
              right: &mut Box<Expr>,
            ) -> Expr {
              Expr::Cond(CondExpr {
                span,
                test: condition.take(),
                cons: right.take(),
                alt: Box::new(utils::create_self_closing_jsx_element_expr(
                  element_name, // element 替换为同类型的元素。在显示/隐藏切换时，让运行时 diff 只更新必要属性而不是整个节点刷新
                  Some(vec![utils::create_jsx_bool_attr(COMPILE_IGNORE)]),
                )),
              })
            }
            match &mut **right {
              Expr::JSXElement(el) => {
                let element_name = el.opening.name.clone();
                inject_compile_if(el, left);
                **expr = get_element_double(element_name, left, right);
              }
              Expr::Paren(ParenExpr {
                expr: paren_expr, ..
              }) => {
                if paren_expr.is_jsx_element() {
                  let el: &mut Box<JSXElement> = paren_expr.as_mut_jsx_element().unwrap();
                  let element_name = el.opening.name.clone();
                  inject_compile_if(el, left);
                  **expr = get_element_double(element_name, left, paren_expr);
                }
              }
              Expr::Lit(_) => {
                **expr = Expr::Cond(CondExpr {
                  span,
                  test: left.take(),
                  cons: right.take(),
                  alt: Box::new(Expr::Lit(Lit::Str(quote_str!(COMPILE_IGNORE)))),
                })
              }
              _ => {
                let jsx_el_name = JSXElementName::Ident(quote_ident!("block"));
                let mut block = Box::new(JSXElement {
                  span,
                  opening: JSXOpeningElement {
                    name: jsx_el_name.clone(),
                    span,
                    attrs: vec![],
                    self_closing: false,
                    type_args: None,
                  },
                  children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
                    span,
                    expr: JSXExpr::Expr(right.take()),
                  })],
                  closing: Some(JSXClosingElement {
                    span,
                    name: jsx_el_name.clone(),
                  }),
                });
                inject_compile_if(&mut block, left);
                **expr =
                  get_element_double(jsx_el_name, left, &mut Box::new(Expr::JSXElement(block)));
              }
            }
          }
        }
        Expr::Cond(CondExpr {
          test, cons, alt, ..
        }) => {
          let compile_if = utils::create_jsx_expr_attr(COMPILE_IF, test.clone());
          let compile_else = utils::create_jsx_bool_attr(COMPILE_ELSE);
          let process_cond_arm = |arm: &mut Box<Expr>, attr: JSXAttrOrSpread| match &mut **arm {
            Expr::JSXElement(el) => {
              el.opening.attrs.push(attr);
            }
            _ => {
              let temp = arm.take();
              let jsx_el_name = JSXElementName::Ident(quote_ident!("block"));
              **arm = Expr::JSXElement(Box::new(JSXElement {
                span,
                opening: JSXOpeningElement {
                  name: jsx_el_name.clone(),
                  span,
                  attrs: vec![attr],
                  self_closing: false,
                  type_args: None,
                },
                children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
                  span,
                  expr: JSXExpr::Expr(temp),
                })],
                closing: Some(JSXClosingElement {
                  span,
                  name: jsx_el_name,
                }),
              }))
            }
          };
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #19505** (2026-09-29): **RN下的uploadFile中的createFormData方法存在name写死的问题**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  _No response_  ### 使用框架  React  ### 相关平台  - [ ] 所有平台 - [ ] Web 端（H5） - [x] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [ ] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  _No response_  ### 问题描述  下方是file.js的源码，可以看出fileObj的name被写死成了file，导致文件上传时，后端错误的获取了name，对于我的场景是，xxxx.jpg格式的文件，name为file，后端无法通过name获取正确的文件后缀区分文件类型 ``` const createFormData = (filePath, body, name) => {     const data = new FormData();     const uri = isAndroid ? filePath : filePath.replace('file://', '');     const fileObj = { uri: uri, type: 'application/octet-stream', name: 'file' };     Object.keys(body).forEach(key => {         data.append(key, body[key]);     });     // @ts-ignore     data.append(name, fileObj);     return data; }; ``` 解决方法也很简单，只要在createFormData添加第四个参数fileName即可，uploadFile调用的时候fileName并没有被使用，并且文档上标出fileName只对h5生效，按照这种修改方式，可以在RN下生效了，即使name值在某些情况下有必须为file的必要，可以对其设置缺省值‘file’  ### 复现链接  -  ### 复现步骤  如上  ### 环境信息  ```bash 👽 Taro v4.2.1     Taro CLI 4.2.1 environment info:     System:       OS: macOS 27.0       Shell: 5.9 - /bin/zsh     Binaries:       Node: 26.8.2 - /opt/homebrew/bin/node       npm: 11.19.1 - /opt/homebrew/bin/npm     npmPackages:       @tarojs/cli: 4.2.1 => 4.2.1        @tarojs/components: 4.2.1 => 4.2.1        @tarojs/components-rn: 4.2.1 => 4.2.1

- **Issue #19485** (2026-09-21): **不同页面有相同样式时不生成页面样式文件**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  None  ### 使用框架  Vue3  ### 相关平台  - [x] 所有平台 - [ ] Web 端（H5） - [ ] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [ ] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  _No response_  ### 问题描述  1、页面src/pages/index/index.vue 样式代码：<style> .ct-page{     display: block;   } </style> 2、页面src/pages/list/index.vue 样式代码： <style> .ct-page{     display: block;   } </style> 3、因为两个页面有相同样式代码，此时进行命令构建：npm run build:weapp 4、生成时src/pages/index/index.vue无样式文件，如下图：  <img width="1742" height="610" alt="Image" src="https://github.com/user-attachments/assets/fba3263c-a836-4c37-a064-2831f12c304e" />  ### 复现链接  https://github.com/leiming19877/test-taro-style1.git  ### 复现步骤  1、进入工程命令行 2、运行npm run build:weapp 3、查看构建结果  ### 环境信息  ```bash xxx@192 test-taro-style1 % npx taro info 👽 Taro v4.2.1     Taro CLI 4.2.1 environment info:     System:       OS: macOS 26.5.2       Shell: 5.9 - /bin/zsh     Binaries:       Node: 22.21.0 - /Users/leiming/.nvm/versions/node/v22.21.0/bin/node       Yarn: 1.22.22 - /Users/leiming/.nvm/versions/node/v22.21.0/bin/yarn       npm: 10.9.4 - /Users/leiming/.nvm/versions/node/v22.21.0/bin/npm     npmPackages:       @tarojs/cli: 4.2.1 => 4.2.1        @tarojs/components: 4.2.1 => 4.2.1        @tarojs/helper: 4.2.1 => 4.2.1        @tarojs/plugin-framework-vu

- **Issue #19452** (2026-08-21): **官方文档的网站证书过期了**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### 问题描述  <img width="2872" height="1898" alt="Image" src="https://github.com/user-attachments/assets/1763b41e-ccdb-4a79-ba94-8feed269fd3f" />  ### 复现链接  https://docs.taro.zone/  ### 复现步骤  证书已经过期两天了，影响使用，麻烦处理一下 
  **Post-Mortem & Fix Analysis**:
  > 4天啦
  > 还没好。。
  > 有没有人在官方交流群里的，能艾特相关人员处理一下吗

- **Issue #19380** (2026-07-30): **物料市场挂了，啥时候恢复**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  None  ### 使用框架  React  ### 相关平台  - [x] 所有平台 - [ ] Web 端（H5） - [ ] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [ ] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  _No response_  ### 问题描述  <img width="1224" height="261" alt="Image" src="https://github.com/user-attachments/assets/cdf6045c-5c34-4f01-b8b0-f6ac1a2b4034" />  ### 复现链接  https://taro-ext.jd.com/  ### 复现步骤  1. 访问物料市场官网  ### 环境信息  ```bash 1 ```  ### 开源贡献  - [ ] 我愿意修复这个错误。请参考 [(贡献指南)](https://github.com/NervJS/taro/blob/main/CONTRIBUTING.md)

- **Issue #19372** (2026-07-17): **由于@tarojs/webpack5-prebundle使用的enhanced-resolve包参数roots 传入为非数组, 导致编译时报错**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  Webpack runner  ### 使用框架  React  ### 相关平台  - [x] 所有平台 - [ ] Web 端（H5） - [ ] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [ ] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  _No response_  ### 问题描述  由于 enhanced-resolve包 在5.17.0 后强制roots参数需要传入数组,  在webpack 开启prebundle后,  由于新版的webpack 使用的enhanced-resolve都是最新版本, 就会报 "TypeError: options.roots.map is not a function"  请将 taro/packages/taro-webpack5-prebundle/src/utils/index.ts, 26行 roots 改为数组传入  ### 复现链接  https://github.com/NervJS/taro/blob/main/packages/taro-webpack5-prebundle/src/utils/index.ts  ### 复现步骤  升级webpack为最新  ### 环境信息  ```bash @tarojs/cli: 4.2.0 => 4.2.0        @tarojs/components: 4.2.0 => 4.2.0        @tarojs/plugin-framework-react: 4.2.0 => 4.2.0        @tarojs/plugin-html: 4.2.0 => 4.2.0        @tarojs/plugin-platform-alipay: ^4.2.0 => 4.2.0        @tarojs/plugin-platform-h5: 4.2.0 => 4.2.0        @tarojs/plugin-platform-weapp: ^4.2.0 => 4.2.0        @tarojs/react: 4.2.0 => 4.2.0        @tarojs/taro: 4.2.0 => 4.2.0        @tarojs/taro-loader: 4.2.0 => 4.2.0        @tarojs/webpack5-runner: 4.2.0 => 4.2.0        babel-preset-taro: 4.2.0 => 4.2.0        eslint-config-taro: 4.2.0 => 4.2.0        react: ^18.3.1 => 18.3.1 ```  ### 开源贡献  - [ ] 我愿意修复这个错误。请参考 [(贡献指南)](https://github.com/NervJS/taro/b
  **Post-Mortem & Fix Analysis**:
  > +1，在 Taro v3 和 v4 下均遇到了这个问题，临时 pin 包版本  ```json   "resolutions": {     "enhanced-resolve": "5.22.2"   } ```  可解决 

- **Issue #19327** (2026-06-11): **taro4 打包支付包报错小程序TypeError: Constructor Map requires 'new'**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  None  ### 使用框架  React  ### 相关平台  - [ ] 所有平台 - [ ] Web 端（H5） - [ ] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [x] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  _No response_  ### 问题描述  TypeError: Constructor Map requires 'new'     at EventSource.Map (<anonymous>)     at new EventSource (event-source.ts:8:1)     at Object.node_modulesTarojsRuntimeDistDomEventSourceJs [as ./node_modules/@tarojs/runtime/dist/dom/event-source.js] (event-source.ts:22:1)  ### 复现链接  官方模板 react+mobx+webpack  ### 复现步骤  官方模板直接打包  ### 环境信息  ```bash 👽 Taro v4.1.7     Taro CLI 4.1.7 environment info:     System:       OS: Windows 11 10.0.22631     Binaries:       Node: 24.13.0 - D:\SDK\node.EXE       Yarn: 4.3.0 - C:\Users\14997\AppData\Roaming\npm\yarn.CMD       npm: 11.6.2 - D:\SDK\npm.CMD     npmPackages:       @tarojs/cli: 4.1.7 => 4.1.7       @tarojs/components: 4.1.7 => 4.1.7       @tarojs/helper: 4.1.7 => 4.1.7       @tarojs/plugin-framework-react: 4.1.7 => 4.1.7       @tarojs/plugin-platform-alipay: 4.1.7 => 4.1.7       @tarojs/plugin-platform-h5: 4.1.7 => 4.1.7       @tarojs/plugin-platform-jd: 4.1.7 => 4.1.7       @tarojs/plugin-platform-qq: 4.1.7 => 4.1.7       @tarojs/plugin-platform-swan: 4.1.7 => 4.1.7       @tarojs/plugin-platform-tt: 4.1.7 => 4.1.7       @tar
  **Post-Mortem & Fix Analysis**:
  > 请问这个问题是怎么解决的？我也遇到这个问题了
  > > 请问这个问题如何解决？我也遇到了这个问题  具体的不记得了，好像是版本问题
  > > 请问这个问题是怎么解决的？我也遇到这个问题了  把支付宝小程序的代码压缩配置关了就好了

- **Issue #19029** (2026-07-17): **属性disablePrerender 没定义**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  TypeScript 类型  ### 使用框架  React  ### 相关平台  - [x] 所有平台 - [ ] Web 端（H5） - [ ] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [ ] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  _No response_  ### 问题描述  不能将类型“{ children: Element; disablePrerender: true; className: any; }”分配给类型“IntrinsicAttributes & ViewProps”。   类型“IntrinsicAttributes & ViewProps”上不存在属性“disablePrerender”。   希望在StandardProps种增加disablePrerender 禁用预渲染的 ts 类型定义  ### 复现链接  https://www.baidu.com  ### 复现步骤  在 View 标签的属性中写disablePrerender  ### 环境信息  ```bash 👽 Taro v4.1.9     Taro CLI 4.1.9 environment info:     System:       OS: macOS 26.3.1       Shell: 5.9 - /bin/zsh     Binaries:       Node: 22.19.0 - ~/.nvm/versions/node/v22.19.0/bin/node       npm: 10.9.3 - ~/.nvm/versions/node/v22.19.0/bin/npm     npmPackages:       @tarojs/cli: 4.1.9 => 4.1.9        @tarojs/components: 4.1.9 => 4.1.9        @tarojs/plugin-framework-react: 4.1.9 => 4.1.9        @tarojs/plugin-inject: 4.1.9 => 4.1.9        @tarojs/plugin-platform-alipay: ^4.1.9 => 4.1.9        @tarojs/plugin-platform-weapp: ^4.1.9 => 4.1.9        @tarojs/react: 4.1.9 => 4.1.9        @tarojs/runtime: 4.1.9 => 4.1.9        @tarojs/taro: 4.1.9 => 4.1.9        @tarojs/webpack5-runner: 4.1.9 => 4.1.9        babel-preset-taro: 4.1.9 => 4.1.9     

- **Issue #18992** (2026-03-16): **新建项目 build 编译支付宝小程序后报错**
  *Symptoms*: ### 请先确认  - [x] 我已搜索并确定这个提交不是重复的  ### Taro 版本  v4  ### 相关领域  None  ### 使用框架  React  ### 相关平台  - [ ] 所有平台 - [ ] Web 端（H5） - [ ] 移动端（React-Native） - [ ] 鸿蒙（Harmony） - [ ] 鸿蒙容器（Harmony Hybrid） - [ ] ASCF 元服务 - [ ] 快应用（QuickApp） - [ ] 所有小程序 - [ ] 微信小程序 - [ ] 企业微信小程序 - [ ] 京东小程序 - [ ] 百度小程序 - [x] 支付宝小程序 - [ ] 支付宝 IOT 小程序 - [ ] 头条小程序 - [ ] QQ 小程序 - [ ] 钉钉小程序 - [ ] 飞书小程序 - [ ] 快手小程序  ### 小程序基础库版本  2.10.15  ### 问题描述  taro init 一个空白小程序，执行执行 npm run build:alipay，在支付宝小程序开发者工具预览，直接报错  <img width="2602" height="742" alt="Image" src="https://github.com/user-attachments/assets/54a23f07-11a2-42bc-8565-e4d066a71986" />  ### 复现链接  https://gitee.com/bluescurry/taro-demo/tree/taro-4.0.11/  ### 复现步骤  1. taro init 创建项目 2. npm run build:alipay 构建支付宝小程序  ### 环境信息  ```bash Taro CLI 4.1.11 environment info:     System:       OS: macOS 13.6.3       Shell: 5.9 - /bin/zsh     Binaries:       Node: 20.19.6 - /Users/hanshuo/.nvs/default/bin/node       Yarn: 1.22.19 - /usr/local/bin/yarn       npm: 10.8.2 - /Users/hanshuo/.nvs/default/bin/npm     npmPackages:       @tarojs/cli: 4.1.11 => 4.1.11       @tarojs/components: 4.1.11 => 4.1.11       @tarojs/helper: 4.1.11 => 4.1.11       @tarojs/plugin-framework-react: 4.1.11 => 4.1.11       @tarojs/plugin-platform-alipay: 4.1.11 => 4.1.11       @tarojs/plugin-platform-h5: 4.1.11 => 4.1.11       @tarojs/plugin-platform-harmony-hybrid: 4.1.11 => 4.1.11       @tarojs/plugin-platform-jd: 4.1.11 => 4.1.11       @tarojs/plugin-platform-qq: 4.1.11 => 4.1.11       @taroj
  **Post-Mortem & Fix Analysis**:
  > 已解决，在 project.alipay.json 文件中设置 skipTranspile: true 即可 ```json {   "format": 2,   "developOptions": {     "skipTranspile": true   } }  ```

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

### Incident Patch 1: `73d9cb05` (2026-09-29)
**Commit Message**: fix(rn): uploadFile sends the real file name instead of hardcoded 'file' (#19507)

On React Native, createFormData hardcoded the multipart file object's
name to 'file', so backends could not read the original file name or
extension (e.g. to distinguish image types). The H5 implementation
already forwards a meaningful name (option fileName, blob name, or a
generated fallback).

RN now resolves the name as: explicit fileName option, then the
filePath basename, then the historical 'file' fallback. The public
Taro.uploadFile.Option type already exposes fileName; its @supported
tag is updated to include rn.

Adds regression tests covering the basename derivation, the explicit
fileName override, and the 'file' fallback.

Fixes #19505

**File**: `packages/taro-rn/__tests__/uploadFile.test.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import { uploadFile } from '../src/lib/file'
+
+describe('uploadFile', () => {
+  const realFetch = global.fetch
+
+  afterEach(() => {
+    global.fetch = realFetch
+    jest.restoreAllMocks()
+  })
+
+  const mockFetchOk = () => {
+    global.fetch = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }))
+  }
+
+  test('uses the real file name derived from filePath', async () => {
+    mockFetchOk()
+    const appendSpy = jest.spyOn(FormData.prototype, 'append')
+    const success = jest.fn()
+    const fail = jest.fn()
+
+    await uploadFile({
+      url: 'https://example.com/upload',
+      filePath: '/data/user/0/com.example/cache/xxxx.jpg',
+      name: 'file',
+      success,
+      fail
+    })
+
+    const fileCall = appendSpy.mock.calls.find(([key]) => key === 'file')
+    expect(fileCall).toBeDefined()
+    expect(fileCall![1]).toMatchObject({ name: 'xxxx.jpg', type: 'application/octet-stream' })
+    expect(success).toHaveBeenCalledTimes(1)
+    expect(fail).not.toHaveBeenCalled()
+  })
+
+  test('honors an explicit fileName option over the filePath basename', async () => {
+    mockFetchOk()
+    const appendSpy = jest.spyOn(FormData.prototype, 'append')
+
+    await uploadFile({
+      url: 'https://example.com/upload',
+      filePath: '/data/user/0/com.example/cache/xxxx.jpg',
+      name: 'file',
+      fileName: 'custom-name.png'
+    })
+
+    const fileCall = appendSpy.mock.calls.find(([key]) => key === 'file')
+    expect(fileCall).toBeDefined()
+    expect(fileCall![1]).toMatchObject({ name: 'custom-name.png' })
+  })
+
+  test('keeps the historical "file" fallback when no name can be derived', async () => {
+    mockFetchOk()
+    const appendSpy = jest.spyOn(FormData.prototype, 'append')
+
+    await uploadFile({
+      url: 'https://example.com/upload',
+      filePath: '/data/user/0/com.example/cache/',
+      name: 'file'
+    })
+
+    const fileCall = appendSpy.mock.calls.find(([key]) => key === 'file')
+    expect(fileCall).toBeDefined()
+    expect(fileCall![1]).toMatchObject({ name: 'file' })
+  })
+})
```

**File**: `packages/taro-rn/src/lib/file.ts` (modified, +4/-4)
```diff
@@ -32,10 +32,10 @@ const _fetch = (requestPromise, timeout) => {
 
 const isAndroid = Platform.OS === 'android'
 
-const createFormData = (filePath, body, name) => {
+const createFormData = (filePath, body, name, fileName) => {
   const data = new FormData()
   const uri = isAndroid ? filePath : filePath.replace('file://', '')
-  const fileObj = { uri: uri, type: 'application/octet-stream', name: 'file' }
+  const fileObj = { uri: uri, type: 'application/octet-stream', name: fileName || filePath.split('/').pop() || 'file' }
 
   Object.keys(body).forEach(key => {
     data.append(key, body[key])
@@ -59,11 +59,11 @@ const createFormData = (filePath, body, name) => {
  * @return UploadTask - 一个可以监听上传进度进度变化的事件和取消上传的对象
  */
 function uploadFile (opts: Taro.uploadFile.Option): Promise<Taro.uploadFile.SuccessCallbackResult & Taro.UploadTask> {
-  const { url, timeout = 2000, filePath, name, header, formData = {}, success, fail, complete } = opts
+  const { url, timeout = 2000, filePath, name, header, formData = {}, fileName, success, fail, complete } = opts
 
   const execFetch = fetch(url, {
     method: 'POST',
-    body: createFormData(filePath, formData, name),
+    body: createFormData(filePath, formData, name, fileName),
     headers: header
   })
 
```

**File**: `packages/taro/types/api/network/upload.d.ts` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ declare module '../../index' {
        */
       enableQuic?: boolean
       /** 上传的文件名
-       * @supported h5
+       * @supported h5, rn
        */
       fileName?: string
       /** 是否应使用传出凭据 (cookie) 发送此请求
```

---

### Incident Patch 2: `0f748299` (2026-09-29)
**Commit Message**: fix(runtime): handle css variables in Style removeProperty and getPropertyValue (#19509)

**File**: `packages/taro-runtime/src/dom/style.ts` (modified, +2/-2)
```diff
@@ -169,7 +169,7 @@ export class Style {
   }
 
   public removeProperty (propertyName: string): string {
-    propertyName = toCamelCase(propertyName)
+    propertyName = isCssVariable(propertyName) ? propertyName : toCamelCase(propertyName)
     if (!this._usedStyleProp.has(propertyName)) {
       return ''
     }
@@ -180,7 +180,7 @@ export class Style {
   }
 
   public getPropertyValue (propertyName: string) {
-    propertyName = toCamelCase(propertyName)
+    propertyName = isCssVariable(propertyName) ? propertyName : toCamelCase(propertyName)
     const value = this[propertyName]
     if (!value) {
       return ''
```

**File**: `packages/taro-runtime/tests/style.spec.ts` (modified, +12/-0)
```diff
@@ -40,4 +40,16 @@ describe('style', () => {
     expect(style.fontWeight).toBe('bold')
     expect(style.color).toBe('red')
   })
+
+  test('css variables', () => {
+    const root = document.createElement('root')
+    const style = new Style(root)
+    style.setProperty('--main-color', 'red')
+    expect(style.getPropertyValue('--main-color')).toBe('red')
+    expect(style.removeProperty('--main-color')).toBe('red')
+    expect(style.cssText).toBe('')
+    style.setProperty('--main-color', 'blue')
+    style.cssText = 'color: red;'
+    expect(style.cssText).toBe('color: red;')
+  })
 })
```

---

### Incident Patch 3: `4a0775cf` (2026-09-29)
**Commit Message**: fix(weapp): support phone number quota toast prop (#19493)

* fix(weapp): support phone number quota toast prop

* test: update snapshots for phone quota toast option

* test: update snapshots for phone quota toast option

**File**: `packages/taro-components/types/Button.d.ts` (modified, +7/-0)
```diff
@@ -138,6 +138,13 @@ interface ButtonProps extends StandardProps {
    * @default false
    */
   showMessageCard?: boolean
+  /** 当手机号快速验证或手机号实时验证额度用尽时，是否对用户展示平台默认提示
+   *
+   * 生效时机：`open-type="getPhoneNumber"` 或 `open-type="getRealtimePhoneNumber"`
+   * @supported weapp
+   * @default true
+   */
+  phoneNumberNoQuotaToast?: boolean
   /** 生活号 id，必须是当前小程序同主体且已关联的生活号，open-type="lifestyle" 时有效。
    * @supported alipay, qq
    */
```

**File**: `packages/taro-platform-weapp/src/components.ts` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ export const components = {
     'send-message-img': _empty,
     'app-parameter': _empty,
     'show-message-card': _false,
+    'phone-number-no-quota-toast': _true,
     'business-id': _empty,
     bindGetUserInfo: _empty,
     bindContact: _empty,
```

**File**: `tests/__tests__/__snapshots__/babel.spec.ts.snap` (modified, +1/-0)
```diff
@@ -130,6 +130,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
```

**File**: `tests/__tests__/__snapshots__/compiler-macros.spec.ts.snap` (modified, +1/-0)
```diff
@@ -130,6 +130,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
```

**File**: `tests/__tests__/__snapshots__/config.spec.ts.snap` (modified, +5/-0)
```diff
@@ -130,6 +130,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
@@ -1959,6 +1960,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
@@ -3650,6 +3652,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
@@ -5357,6 +5360,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
@@ -7006,6 +7010,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
```

---

### Incident Patch 4: `4a00fd0c` (2026-09-29)
**Commit Message**: fix: isolate subpackage indie to weapp and sanitize example (#19508)

* fix: isolate subpackage indie to weapp and sanitize example

* fix(tests): normalize path separators in comp template assertion

MiniPlugin.getCompTemplatePath() returns a path.resolve'd string whose
separator is backslash on Windows, so the template/comp regex failed
on Windows CI. Normalize the path to forward slashes before asserting.

* fix(webpack-runner): decouple forceCustomWrapper from subpackage indie platform gate

**File**: `examples/README.md` (modified, +1/-0)
```diff
@@ -11,4 +11,5 @@
 - custom-tabbar-vue3: 微信小程序自定义 TabBar（Vue3）
 - external-prebundle: 第三方使用 PreBundle 特性
 - mini-split-chunks-plugin: 智能提取分包依赖
+- [subpackage-indie](subpackage-indie/README.md): 微信混合开发的子分包独立模板示例
 - weapp-independent-subpackages: 微信小程序独立分包功能演示
```

**File**: `examples/subpackage-indie/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+miniapp/pages/order/
+**/project.private.config.json
```

**File**: `examples/subpackage-indie/README.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+## 微信混合开发：子分包独立模板
+
+本示例将 Taro 页面和两个组件接入原生微信小程序，演示 `subPackageIndie` 的分包模板布局。构建使用 Webpack 5 和 `--type weapp --new-blended`。配置见 [app.config.js](taro-project/src/app.config.js)，平台开关见 [platform.ts](../../packages/taro-webpack5-runner/src/utils/platform.ts)。
+
+本示例只面向微信小程序。`tt`、支付宝等其他平台不会启用这项能力，复制插件也不会改写微信宿主。本例没有配置 `asyncSubPackage`，不演示业务代码的 `require.async` 加载；`subPackageIndie` 也不等同于原生分包的 `independent: true`。
+
+### 构建与预览
+
+前提：已在 Taro 仓库中安装依赖并编译本地框架包。本例使用 `workspace:*` 依赖，不能将示例目录单独复制出去安装。以下命令均在仓库根目录执行：
+
+```bash
+pnpm --filter subpackage-indie-example run build
+```
+
+构建成功后，[复制插件](taro-project/plugin-mv/index.js) 将 `taro-project/dist/` 的运行文件同步到 `miniapp/pages/order/`。插件先检查平台、`newBlended`、编译结果及三个入口文件组；编译失败或入口不完整时保留已有宿主产物。同步会替换整个目标目录，请勿在该目录手工维护代码。
+
+使用微信开发者工具导入 `examples/subpackage-indie/miniapp/`，不要导入 `dist/`。项目配置中的 `touristappid` 是占位值；如果调试需要自己的 AppID，仅在本地设置，提交前恢复占位值。不要提交开发者工具生成的 `project.private.config.json`。
+
+监听构建：
+
+```bash
+pnpm --filter subpackage-indie-example run dev
+```
+
+构建产物、开发者工具私有配置由 [.gitignore](.gitignore) 忽略。宿主所需的运行文件需要通过构建生成；复制时排除 `app.json`、项目配置和 source map，宿主使用自己的 [app.json](miniapp/app.json)。
+
+### 配置与产物对应
+
+三个路径均相对于 `taro-project/src/`，配置值包含入口文件名。原生宿主的分包根目录不包含入口文件名。
+
+| Taro 配置 | 入口 | 复制后的宿主目录 |
+| --- | --- | --- |
+| `mainPackageRoot` | `pages/index/index` | `miniapp/pages/order/pages/index/` |
+| `subPackageRoots[0]` | `pages/sub1/index` | `miniapp/pages/order/pages/sub1/` |
+| `subPackageRoots[1]` | `pages/sub2/index` | `miniapp/pages/order/pages/sub2/` |
+
+`pages/index` 保存运行时和全局样式；三个目录分别使用本地的 `base.wxml`、`utils.wxs` 和 `comp` 文件。跨分包组件引用及占位组件配置见 [index.config.js](taro-project/src/pages/index/index.config.js)。修改入口路径时，需同步更新上述配置、原生导航路径及复制插件的入口检查列表。
+
+### 验证
+
+自动化测试覆盖复制插件的平台隔离、编译失败、入口缺失、成功复制及重复构建，并检查 Babel helper 使用包名引用以避免暴露本地路径：
+
+```bash
+pnpm --filter subpackage-indie-example run test
+```
+
+下列项目需在微信开发者工具或真机上手工检查，Node 测试不覆盖渲染和真实分包加载：
+
+1. 从原生首页点击“打开 Taro 订单组件”，确认能够进入 Taro 页面。
+2. 分别显示、隐藏 List 和 Detail 组件，检查组件内容与样式。
+3. 检查三个产物目录中的模板和 `comp` 引用，确认没有跨分包引用其他目录的 `base.wxml`。
+4. 检查调试器是否出现缺失模板、组件或样式错误。
+
+订单内容均为本地模拟数据。示例源码不需要登录、用户信息采集或业务服务地址；添加自己的调试配置时，应避免提交账号标识、凭据、内部地址及含本地路径的日志。
```

**File**: `examples/subpackage-indie/miniapp/app.js` (modified, +1/-40)
```diff
@@ -1,40 +1 @@
-// app.js
-App({
-  onLaunch() {
-    // 展示本地存储能力
-    const logs = wx.getStorageSync('logs') || []
-    logs.unshift(Date.now())
-    wx.setStorageSync('logs', logs)
-
-    // 登录
-    wx.login({
-      success: res => {
-        // 发送 res.code 到后台换取 openId, sessionKey, unionId
-      }
-    })
-    // 获取用户信息
-    wx.getSetting({
-      success: res => {
-        if (res.authSetting['scope.userInfo']) {
-          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
-          wx.getUserInfo({
-            success: res => {
-              // 可以将 res 发送给后台解码出 unionId
-              this.globalData.userInfo = res.userInfo
-
-              // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
-              // 所以此处加入 callback 以防止这种情况
-              if (this.userInfoReadyCallback) {
-                this.userInfoReadyCallback(res)
-              }
-            }
-          })
-        }
-      }
-    })
-  },
-
-  globalData: {
-    userInfo: null
-  }
-})
+App({})
```

**File**: `examples/subpackage-indie/miniapp/pages/order/app.json` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-{
-  "pages": ["pages/index/index"],
-  "subPackageIndie": {
-    "mainPackageRoot": "pages/index/index",
-    "subPackageRoots": ["pages/sub1/index", "pages/sub2/index"]
-  }
-}
```

---

### Incident Patch 5: `36fc9e5f` (2026-09-23)
**Commit Message**: fix(shared): make Events#once fire exactly once (#19506)

* fix(shared): 修复 Events#once 在回调内重复触发或报错时被多次执行的问题

once 的 wrapper 先执行回调再调用 off 解绑，回调内如果再次 trigger 同一事件，
wrapper 会在解绑前被重入并无限重复执行；回调抛错时 off 也不会执行，监听器
残留在链上，下一次 trigger 仍会命中。改为用 fired 标记保证回调只执行一次，
并把 off 放进 finally 保证异常路径也会解绑。

* test(shared): 补充 Events#once 的边界用例

覆盖 symbol 事件名、多事件名、传入 context、回调内多次 trigger、
先重入再报错、空回调等路径，并断言回调报错后事件不再残留在监听链上
（这一条用于锁定 finally 中的 off，缺少它时仅靠 fired 标记也能通过）。
另把在修复前后都通过的用例标注为 control。

**File**: `packages/shared/src/event-emitter.ts` (modified, +12/-2)
```diff
@@ -36,9 +36,19 @@ export class Events {
   }
 
   once (events: EventName, callback: (...r: any[]) => void, context?: any): this {
+    let fired = false
     const wrapper = (...args: any[]) => {
-      callback.apply(this, args)
-      this.off(events, wrapper, context)
+      // Note: 监听器内再次 trigger 同一事件时，wrapper 会在 off 之前被重入，
+      // 因此用 fired 标记保证回调只执行一次；回调报错时也需要解绑。
+      if (fired) {
+        return
+      }
+      fired = true
+      try {
+        callback.apply(this, args)
+      } finally {
+        this.off(events, wrapper, context)
+      }
     }
 
     this.on(events, wrapper, context)
```

**File**: `packages/shared/tests/event-emitter.spec.ts` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+import { describe, expect, test, vi } from 'vitest'
+
+import { Events } from '../src/event-emitter'
+
+describe('Events', () => {
+  test('#once 回调内再次 trigger 同一事件时只执行一次', () => {
+    const events = new Events()
+    const spy = vi.fn(() => {
+      if (spy.mock.calls.length < 10) {
+        events.trigger('reenter')
+      }
+    })
+
+    events.once('reenter', spy)
+    events.trigger('reenter')
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 回调报错后监听器也会被解绑', () => {
+    const events = new Events()
+    const spy = vi.fn(() => {
+      throw new Error('boom')
+    })
+
+    events.once('throwing', spy)
+    expect(() => events.trigger('throwing')).toThrow('boom')
+    events.trigger('throwing')
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 只响应一次，并且透传参数 (control)', () => {
+    const events = new Events()
+    const spy = vi.fn()
+
+    events.once('normal', spy)
+    events.trigger('normal', 1, 'two', { three: 3 })
+    events.trigger('normal', 4)
+
+    expect(spy).toBeCalledTimes(1)
+    expect(spy).toBeCalledWith(1, 'two', { three: 3 })
+  })
+
+  test('#once 不影响同一事件上的其它监听器 (control)', () => {
+    const events = new Events()
+    const onceSpy = vi.fn()
+    const onSpy = vi.fn()
+
+    events.once('mixed', onceSpy)
+    events.on('mixed', onSpy)
+    events.trigger('mixed')
+    events.trigger('mixed')
+
+    expect(onceSpy).toBeCalledTimes(1)
+    expect(onSpy).toBeCalledTimes(2)
+  })
+
+  test('#once 回调内可以重新注册同一事件 (control)', () => {
+    const events = new Events()
+    const second = vi.fn()
+    const first = vi.fn(() => {
+      events.once('again', second)
+    })
+
+    events.once('again', first)
+    events.trigger('again')
+    events.trigger('again')
+    events.trigger('again')
+
+    expect(first).toBeCalledTimes(1)
+    expect(second).toBeCalledTimes(1)
+  })
+
+  test('#once 支持 symbol 事件名 (control)', () => {
+    const events = new Events()
+    const eventName = Symbol('symbol-event')
+    const spy = vi.fn()
+
+    events.once(eventName, spy)
+    events.trigger(eventName)
+    events.trigger(eventName)
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 以 symbol 事件名注册时，回调内再次 trigger 也只执行一次', () => {
+    const events = new Events()
+    const eventName = Symbol('symbol-reenter')
+    const spy = vi.fn(() => {
+      if (spy.mock.calls.length < 10) {
+        events.trigger(eventName)
+      }
+    })
+
+    events.once(eventName, spy)
+    events.trigger(eventName)
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 以 symbol 事件名注册时，回调报错后也会被解绑', () => {
+    const events = new Events()
+    const eventName = Symbol('symbol-throwing')
+    const spy = vi.fn(() => {
+      throw new Error('boom')
+    })
+
+    events.once(eventName, spy)
+    expect(() => events.trigger(eventName)).toThrow('boom')
+    events.trigger(eventName)
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 以多个事件名注册时，回调内 trigger 其中另一个事件也只执行一次', () => {
+    const events = new Events()
+    const spy = vi.fn(() => {
+      if (spy.mock.calls.length < 10) {
+        events.trigger('multi-b')
+      }
+    })
+
+    events.once('multi-a,multi-b', spy)
+    events.trigger('multi-a')
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 传入 context 时，回调内再次 trigger 也只执行一次', () => {
+    const events = new Events()
+    const context = {}
+    const spy = vi.fn(() => {
+      if (spy.mock.calls.length < 10) {
+        events.trigger('ctx')
+      }
+    })
+
+    events.once('ctx', spy, context)
+    events.trigger('ctx')
+    events.trigger('ctx')
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 回调内多次 trigger 同一事件时也只执行一次', () => {
+    const events = new Events()
+    const spy = vi.fn(() => {
+      if (spy.mock.calls.length < 5) {
+        events.trigger('double')
+        events.trigger('double')
+      }
+    })
+
+    events.once('double', spy)
+    events.trigger('double')
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 回调先重
```

---

### Incident Patch 6: `57a44279` (2026-09-23)
**Commit Message**: fix(mini-runner): include sub-package pages in prerender page set (#19503)

Previously getPages() only fed main-package appPages into this.prerenderPages.
Prerender.render() iterates all webpack entrypoints (including sub-packages)
and validatePrerenderPages accepts any path matching the match glob, so
configuring prerender for sub-package pages passed validation but the page
loader never got prerender: true (this.prerenderPages.has(module.name) was
false for sub-package modules). As a result taro-loader did not inject
wx._prerender, and every sub-package page's prerender snapshot silently
fell back to the previous page's instance.

Fix by unioning sub-package page paths into the prerender page set, so
sub-package pages are eligible for prerender when their path matches the
config (same as main-package pages).

**File**: `packages/taro-webpack5-runner/src/plugins/MiniPlugin.ts` (modified, +16/-1)
```diff
@@ -760,7 +760,22 @@ export default class TaroMiniPlugin {
     const { newBlended, frameworkExts, combination } = this.options
     const { prerender } = combination.config
 
-    this.prerenderPages = new Set(validatePrerenderPages(appPages, prerender).map(p => p.path))
+    // Collect sub-package pages so they are also eligible for prerender.
+    // `getPages` previously only fed main-package `appPages` into `prerenderPages`,
+    // so sub-package pages never received the `wx._prerender` injection and their
+    // prerender snapshots silently fell back to the previous page's instance.
+    const subPackages = this.appConfig.subPackages || this.appConfig.subpackages || []
+    const subPages: string[] = []
+    for (const sp of subPackages) {
+      const root = sp.root || ''
+      for (const pg of (sp.pages || [])) {
+        subPages.push(`${root}/${pg}`.replace(/\/{2,}/g, '/'))
+      }
+    }
+
+    this.prerenderPages = new Set(
+      validatePrerenderPages([...appPages, ...subPages], prerender).map(p => p.path)
+    )
     this.getTabBarFiles(this.appConfig)
     this.pages = new Set([
       ...appPages.map<IComponent>(item => {
```

---

### Incident Patch 7: `62056521` (2026-09-22)
**Commit Message**: fix(swan): support hold-keyboard for input fields (#19494)

**File**: `packages/taro-components/types/Input.d.ts` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ interface InputProps extends StandardProps, FormItemProps {
   adjustPosition?: boolean
   /** focus 时，点击页面的时候不收起键盘
    * @default false
-   * @supported weapp, tt
+   * @supported weapp, swan, tt
    */
   holdKeyboard?: boolean
   /**
```

**File**: `packages/taro-components/types/Textarea.d.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ interface TextareaProps extends StandardProps, FormItemProps {
   adjustPosition?: boolean
   /** focus 时，点击页面的时候不收起键盘
    * @default false
-   * @supported weapp, tt
+   * @supported weapp, swan, tt
    */
   holdKeyboard?: boolean
   /** 是否去掉 iOS 下的默认内边距
```

**File**: `packages/taro-platform-swan/src/components.ts` (modified, +4/-2)
```diff
@@ -46,13 +46,15 @@ export const components = {
     'skip-subscribe-authorize': 'false'
   },
   Input: {
-    'adjust-position': 'true'
+    'adjust-position': 'true',
+    'hold-keyboard': 'false'
   },
   Textarea: {
     'confirm-type': singleQuote('default'),
     'confirm-hold': 'false',
     'show-confirm-bar': 'true',
-    'adjust-position': 'true'
+    'adjust-position': 'true',
+    'hold-keyboard': 'false'
   },
   Navigator: {
     target: singleQuote('self'),
```

---

### Incident Patch 8: `2dc2036f` (2026-09-21)
**Commit Message**: fix(vite-runner): emit shared page style assets (#19492)

**File**: `packages/taro-vite-runner/package.json` (modified, +3/-1)
```diff
@@ -11,7 +11,9 @@
     "prod": "pnpm run build",
     "dev": "pnpm run mv:comp && tsc -w",
     "build": "tsc && pnpm run mv:comp",
-    "mv:comp": "node ./mv-comp.js"
+    "mv:comp": "node ./mv-comp.js",
+    "test": "vitest run",
+    "test:ci": "vitest run --coverage"
   },
   "dependencies": {
     "@ampproject/remapping": "^2.3.0",
```

**File**: `packages/taro-vite-runner/src/mini/style.ts` (modified, +26/-4)
```diff
@@ -13,6 +13,7 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
         const appStyleFileName = `app${nativeStyleExt}`
         const commonStyleChunks = viteCompilerContext.commonChunks.map(item => `${item}${nativeStyleExt}`)
         const commonStyleFileNames: string[] = []
+        const styleAssetFileNames = new Map<string, Set<string>>()
         let appStyleChunk: OutputAsset | null = null
 
         for (const name in bundle) {
@@ -23,17 +24,38 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
               for (const item of importedCss) {
                 const chunkFileName = chunk.fileName
                 const fileName = chunkFileName.replace(path.extname(chunkFileName), nativeStyleExt)
-                bundle[item].fileName = fileName
-                if (fileName === appStyleFileName) {
-                  appStyleChunk = bundle[item] as OutputAsset
-                } else if (commonStyleChunks.includes(path.basename(fileName))) {
+                const fileNames = styleAssetFileNames.get(item) || new Set<string>()
+                fileNames.add(fileName)
+                styleAssetFileNames.set(item, fileNames)
+
+                if (commonStyleChunks.includes(path.basename(fileName)) && !commonStyleFileNames.includes(fileName)) {
                   commonStyleFileNames.push(fileName)
                 }
               }
             }
           }
         }
 
+        for (const [item, fileNames] of styleAssetFileNames) {
+          const styleChunk = bundle[item] as OutputAsset
+          const primaryFileName = fileNames.has(appStyleFileName) ? appStyleFileName : fileNames.values().next().value!
+          styleChunk.fileName = primaryFileName
+
+          for (const fileName of fileNames) {
+            if (fileName !== primaryFileName) {
+              this.emitFile({
+                type: 'asset',
+                fileName,
+                source: styleChunk.source
+              })
+            }
+          }
+
+          if (primaryFileName === appStyleFileName) {
+            appStyleChunk = styleChunk
+          }
+        }
+
         // 小程序全局样式文件中引入 common chunks 中的公共样式文件
         if (appStyleChunk) {
           const APP_STYLE_NAME = 'app-origin' + nativeStyleExt
```

**File**: `packages/taro-vite-runner/tests/mini/style.spec.ts` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+import { describe, expect, test, vi } from 'vitest'
+
+import stylePlugin from '../../src/mini/style'
+
+import type { OutputAsset, OutputBundle, OutputChunk, Plugin } from 'rollup'
+
+const styleSource = '.ct-page{display:block}\n'
+
+const createChunk = (fileName: string, importedCss: string[]): OutputChunk => ({
+  code: '',
+  dynamicImports: [],
+  exports: [],
+  facadeModuleId: null,
+  fileName,
+  implicitlyLoadedBefore: [],
+  importedBindings: {},
+  imports: [],
+  isDynamicEntry: false,
+  isEntry: true,
+  isImplicitEntry: false,
+  map: null,
+  modules: {},
+  moduleIds: [],
+  name: fileName,
+  preliminaryFileName: fileName,
+  referencedFiles: [],
+  sourcemapFileName: null,
+  type: 'chunk',
+  viteMetadata: {
+    importedAssets: new Set(),
+    importedCss: new Set(importedCss),
+  },
+})
+
+const createStyleAsset = (fileName: string, source = styleSource): OutputAsset => ({
+  fileName,
+  name: fileName,
+  needsCodeReference: false,
+  source,
+  type: 'asset',
+})
+
+const runPlugin = (bundle: OutputBundle, commonChunks: string[] = []): Map<string, string> => {
+  const emitFile = vi.fn()
+  const plugin = stylePlugin({
+    commonChunks,
+    fileType: { style: '.wxss' },
+    sourceDir: 'src',
+  } as never) as Plugin
+
+  const generateBundle =
+    typeof plugin.generateBundle === 'function' ? plugin.generateBundle : plugin.generateBundle?.handler
+  if (!generateBundle) throw new Error('Expected the style plugin to define generateBundle')
+  generateBundle.call({ emitFile } as never, {} as never, bundle, false)
+
+  const styleAssets = [...Object.values(bundle), ...emitFile.mock.calls.map(([asset]) => asset)].filter(
+    (asset): asset is OutputAsset => asset.type === 'asset'
+  )
+  return new Map(styleAssets.map((asset) => [asset.fileName, String(asset.source)]))
+}
+
+describe('mini style plugin', () => {
+  test('emits a style file for every chunk that shares the same CSS asset', () => {
+    const styles = runPlugin({
+      'pages/index/index.js': createChunk('pages/index/index.js', ['index.css']),
+      'pages/list/index.js': createChunk('pages/list/index.js', ['index.css']),
+      'index.css': createStyleAsset('index.css'),
+    })
+
+    expect(styles.get('pages/index/index.wxss')).toBe(styleSource)
+    expect(styles.get('pages/list/index.wxss')).toBe(styleSource)
+  })
+
+  test('keeps app styles mutable when their CSS asset is shared with a page', () => {
+    const styles = runPlugin({
+      'pages/index/index.js': createChunk('pages/index/index.js', ['app.css']),
+      'app.js': createChunk('app.js', ['app.css']),
+      'app.css': createStyleAsset('app.css'),
+    })
+
+    expect(styles.get('app-origin.wxss')).toBe(styleSource)
+    expect(styles.get('app.wxss')).toBe('@import "app-origin.wxss";\n')
+    expect(styles.get('pages/index/index.wxss')).toBe(styleSource)
+  })
+
+  test('adds common styles to the app style when the app has no CSS asset', () => {
+    const styles = runPlugin(
+      {
+        'common.js': createChunk('common.js', ['common.css']),
+        'common.css': createStyleAsset('common.css', '.common{display:block}\n'),
+      },
+      ['common']
+    )
+
+    expect(styles.get('common.wxss')).toBe('.common{display:block}\n')
+    expect(styles.get('app.wxss')).toBe('@import "common.wxss";')
+  })
+
+  test('preserves app styles while importing common styles', () => {
+    const styles = runPlugin(
+      {
+        'app.js': createChunk('app.js', ['app.css']),
+        'common.js': createChunk('common.js', ['common.css']),
+        'app.css': createStyleAsset('app.css'),
+        'common.css': createStyleAsset('common.css', '.common{display:block}\n'),
+      },
+      ['common']
+    )
+
+    expect(styles.get('app-origin.wxss')).toBe(styleSource)
+    expect(styles.get('app.wxss')).toBe('@import "app-origin.wxss";\n@import "common.wxss";\n')
+    expect(styles.get('common.wxss')).toBe('.common{display:block}\n')
+  })
+})
```

**File**: `packages/taro-vite-runner/vitest.config.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { defineConfig } from 'vitest/config'
+
+export default defineConfig({
+  test: {
+    include: ['tests/**/*.spec.ts'],
+    coverage: {
+      provider: 'istanbul',
+      include: ['src/mini/style.ts'],
+    },
+  },
+})
```

---

### Incident Patch 9: `f90e76f9` (2026-09-21)
**Commit Message**: fix(types): resolve request declaration errors (#19495)

**File**: `packages/taro/types/api/network/request.d.ts` (modified, +7/-3)
```diff
@@ -2,7 +2,7 @@ import Taro from '../../index'
 
 declare module '../../index' {
   namespace request {
-    interface Option<T = any, U extends string | TaroGeneral.IAnyObject | ArrayBuffer = any | any> {
+    interface Option<T = any, U = any> {
       /** 开发者服务器接口地址 */
       url: string
       /** 请求的参数 */
@@ -150,8 +150,7 @@ declare module '../../index' {
       storeCheck?(): boolean
     }
 
-    interface SuccessCallbackResult<T extends string | TaroGeneral.IAnyObject | ArrayBuffer = any | any>
-      extends TaroGeneral.CallbackResult {
+    interface SuccessCallbackResult<T = any> extends TaroGeneral.CallbackResult {
       /** 开发者服务器返回的数据 */
       data: T
       /** 开发者服务器返回的 HTTP Response Header */
@@ -379,6 +378,11 @@ declare module '../../index' {
     }
   }
 
+  /** @ignore */
+  interface RequestParams<T = any> extends request.Option<T, any> {
+    [propName: string]: any
+  }
+
   /** @ignore */
   type interceptor = (chain: Chain) => any
 
```

---

### Incident Patch 10: `647c47f1` (2026-09-21)
**Commit Message**: fix(components): center aspectFit images horizontally (#19491)

**File**: `packages/taro-components/__tests__/image.e2e.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { E2EPage, newE2EPage } from '@stencil/core/testing'
+
+const IMAGE =
+  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIzMiI+PC9zdmc+'
+
+describe('Image e2e', () => {
+  let page: E2EPage
+
+  it('centers aspectFit images on both axes', async () => {
+    page = await newE2EPage({
+      html: `<taro-image-core
+        mode="aspectFit"
+        src="${IMAGE}"
+        style="width: 48px; height: 48px;"
+      ></taro-image-core>`,
+    })
+
+    await page.waitForFunction(() => {
+      const image = document.querySelector<HTMLImageElement>('taro-image-core img')
+      return Boolean(image?.complete && image.naturalWidth > 0)
+    })
+
+    const centers = await page.evaluate(() => {
+      const host = document.querySelector('taro-image-core')!
+      const image = host.querySelector('img')!
+      const hostRect = host.getBoundingClientRect()
+      const imageRect = image.getBoundingClientRect()
+
+      return {
+        hostWidth: hostRect.width,
+        imageWidth: imageRect.width,
+        hostX: hostRect.left + hostRect.width / 2,
+        hostY: hostRect.top + hostRect.height / 2,
+        imageX: imageRect.left + imageRect.width / 2,
+        imageY: imageRect.top + imageRect.height / 2,
+      }
+    })
+
+    expect(centers.imageWidth).toBeLessThan(centers.hostWidth)
+    expect(centers.imageX).toBeCloseTo(centers.hostX, 5)
+    expect(centers.imageY).toBeCloseTo(centers.hostY, 5)
+  })
+})
```

**File**: `packages/taro-components/src/components/image/style/index.scss` (modified, +4/-3)
```diff
@@ -29,11 +29,12 @@ img[src=""] {
     }
 
     &-aspectfit {
-      max-width: 100%;
-      max-height: 100%;
       position: absolute;
+      left: 50%;
       top: 50%;
-      transform: translate(0, -50%);
+      max-width: 100%;
+      max-height: 100%;
+      transform: translate(-50%, -50%);
     }
 
     &-aspectfill {
```

#### Recent Merged Pull Requests:
- **PR #19510** (2026-09-29): chore(release): publish 4.3.0 (@Single-Dancer)
- **PR #19509** (2026-09-29): fix(runtime): handle css variables in Style removeProperty and getPropertyValue (@kwy404)
- **PR #19508** (2026-09-29): fix: isolate subpackage indie to weapp and sanitize example (@sammyfeng0530)
- **PR #19507** (2026-09-29): fix(rn): uploadFile sends the real file name instead of hardcoded 'file' (@dvd233)
- **PR #19506** (2026-09-23): fix(shared): make Events#once fire exactly once (@askalf)
- **PR #19503** (2026-09-23): fix(mini-runner): include sub-package pages in prerender page set (@Edward-Roshan)
- **PR #19502** (2026-09-20): Feat/4.2.2 (@Muyouz)
- **PR #19500** (2026-09-20): fix(vite-runner): 修复小程序页面模板缺少 page-meta 导致 PageMeta 失效的问题 (@INK-MapleShadow)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
