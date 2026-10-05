# Forensic Learning Record (Deep Inspection): NervJS/taro

> **Canonical Artifact**: `07_PROJECT_LEARNING/nervjs-taro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NervJS/taro](https://github.com/NervJS/taro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:32:04.347Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NervJS/taro`
- **Description**: 开放式跨端跨框架解决方案，支持使用 React/Vue 等框架来开发微信/京东/百度/支付宝/字节跳动/ QQ 小程序/H5/React Native 等应用。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 37710 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/swc_plugin_compile_mode/src/utils/constants.rs`
```
pub const COMPILE_MODE: &str = "compileMode";
pub const COMPILE_IF: &str = "compileIf";
pub const COMPILE_ELSE: &str = "compileElse";
pub const COMPILE_IGNORE: &str = "compileIgnore";
pub const COMPILE_FOR: &str = "compileFor";
pub const COMPILE_FOR_KEY: &str = "compileForKey";
pub const SLOT_ITEM: &str = "slotItem";
pub const EVENT_HANDLER: &str = "eh";
pub const DATA_SID: &str = "data-sid";
pub const TMPL_DATA_ROOT: &str = "i.";
pub const ID: &str = "id";
pub const LOOP_WRAPPER_ID: i32 = -1;
pub const DYNAMIC_ID: &str = "_dynamicID";
pub const REACT_RESERVED: [&str; 2] = ["key", "ref"];

pub const VIEW_TAG: &str = "view";
pub const TEXT_TAG: &str = "text";
pub const IMAGE_TAG: &str = "image";
pub const SCRIPT_TAG: &str = "script";

pub const STYLE_ATTR: &str = "style";
pub const DIRECTION_ATTR: &str = "harmonyDirection";

pub const HARMONY_IMPORTER: &str = "import {
  rowModify,
  FlexManager,
  columnModify,
  DynamicCenter,
  getButtonColor,
  TOUCH_EVENT_MAP,
  getFontAttributes,
  commonStyleModify,
  getNodeThresholds,
  BUTTON_THEME_COLOR,
  getStyleAttr,
  getNormalAttributes,
  shouldBindEvent,
  textModify,
  setNormalTextAttributeIntoInstance,
  getImageMode
} from '@tarojs/components'
import {
  NodeType,
  convertNumber2VP,
  TaroElement,
  eventHandler,
  getComponentEventCallback,
  AREA_CHANGE_EVENT_NAME,
  VISIBLE_CHANGE_EVENT_NAME
} from '@tarojs/runtime'
import { 
  createLazyChildren, 
  createChildItem 
} from '../render'

import type {
  TaroTextElement,
  HarmonyStyle,
  TaroButtonElement,
  TaroViewElement,
  TaroAny,
  TaroStyleType,
  TaroTextStyleType
} from '@tarojs/runtime'
import { isString } from '@tarojs/shared'

";

pub const HARMONY_TEXT_HELPER_FUNCITON: &str = r#"


class SpanStyleModify implements AttributeModifier<SpanAttribute> {
  node: TaroTextElement | null = null
  style: HarmonyStyle | null = null
  overwriteStyle: Record<string, TaroAny> = {}
  withNormal = false

  setNode (node: TaroTextElement) {
    this.node = node
    this.style = getNormalAttributes(this.node)
    return this
  }

  applyNormalAttribute(instance: SpanAttribute): void {
    if (this.node && this.style) {
      setNormalTextAttributeIntoInstance(instance, this.style, this.node)
    }
  }
}


function getButtonFontSize (node: TaroButtonElement): string | number {
  const isMini = node._attrs.size === 'mini'

  return isMini ? convertNumber2VP(26) : convertNumber2VP(36)
}

function getTextInViewWidth (node: TaroElement | null): TaroAny {
  if (node) {
    const hmStyle: TaroAny = node.hmStyle || {}
    const isFlexView = hmStyle.display === 'flex'
    const width: TaroAny = getStyleAttr(node, 'width')
    const isPercentWidth = isString(width) && width.includes('%')

    return isFlexView || isPercentWidth ? null : getStyleAttr(node, 'width')
  }
}

"#;

pub const HARMONY_TEXT_BUILDER: &str = r#"@Builder
function createText (node: TaroTextElement) {
  if (node.nodeType === NodeType.TEXT_NODE) {
    if (node.parentNode) {
      if ((node.parentNode as TaroElement).tagName === 'BUTTON') {
        Text(node.textContent)
          .attributeModifier(textModify.setNode(node?.parentElement as TaroElement, {
            fontSize: getButtonFontSize(node.parentNode as TaroButtonElement),
            color: getButtonColor(node.parentNode as TaroButtonElement, BUTTON_THEME_COLOR.get((node.parentNode as TaroButtonElement)._attrs.type || '').text)
          }))
      } else {
        Text(node.textContent)
          .attributeModifier(textModify.setNode(node?.parentElement as TaroElement))
          .width(getTextInViewWidth(node.parentElement))
      }
    }
  } else {
    Text(node.textContent) {
      // text 下还有标签
      if (node.childNodes.length > 1 || ((node.childNodes[0] && node.childNodes[0] as TaroElement)?.nodeType === NodeType.ELEMENT_NODE)) {
        ForEach(node.childNodes, (item: TaroElement) => {
          if (item.tagName === 'IMAGE') {
            ImageSpan(item.getAttribute('src'))
              .attributeModifier(commonStyleModify.setNode(item))
              .objectFit(getImageMode(item.getAttribute('mode')))
              .verticalAlign(getImageSpanAlignment(node?.hmStyle?.verticalAlign))
              .onClick(shouldBindEvent((e: ClickEvent) => { eventHandler(e, 'click', item) }, item, ['click']))
          } else if (item.nodeType === NodeType.TEXT_NODE) {
            Span(item.textContent)
          } else if (item.tagName === 'TEXT') {
            Span(item.textContent)
              .attributeModifier((new SpanStyleModify()).setNode(item as TaroTextElement))
              .letterSpacing(item._st.hmStyle.letterSpacing)
              .textBackgroundStyle({
                color: item._st.hmStyle.backgroundColor,
                radius: {
                  topLeft: item._st.hmStyle.borderTopLeftRadius,
                  topRight: item._st.hmStyle.borderTopRightRadius,
                  bottomLeft: item._st.hmStyle.borderBottomLeftRadius,
                  bottomRight: item._st.hmStyle.borderBottomRightRadius,
                }
              })
              .onClick(shouldBindEvent((e: ClickEvent) => { eventHandler(e, 'click', item) }, item, ['click']))
          }
        }, (item: TaroElement) => item._nid.toString())
      }
    }
    .onClick(shouldBindEvent((e: ClickEvent) => { eventHandler(e, 'click', node) }, node, ['click']))
    .attributeModifier(textModify.setNode(node).withNormalStyle())
    .onVisibleAreaChange(getNodeThresholds(node) || [0.0, 1.0], getComponentEventCallback(node, VISIBLE_CHANGE_EVENT_NAME))
    .onAreaChange(getComponentEventCallback(node, AREA_CHANGE_EVENT_NAME, (res: TaroAny) => {
      node._nodeInfo.areaInfo = res[1]
    }))
  }
}

function getImageSpanAlignment (align: TaroAny): TaroAny {
  if (align === Alignment.Top) {
    return ImageSpanAlignment.TOP
  } else if (align === Alignment.Bottom) {
    return ImageSpanAlignment.BOTTOM
  } else if (align === Alignment.Center) {
    return ImageSpanAlignment.CENTER
  }
}
"#;

```

### Core Architecture Module: `crates/swc_plugin_compile_mode/src/utils/harmony/components.rs`
```
use crate::transform_harmony::EtsDirection;

pub fn get_component_attr_str(node_name: &str, tag_name: &str) -> String {
  if tag_name == "text" {
    format!(
            ".attributeModifier(commonStyleModify.setNode({} as TaroElement))\n.textSpecialFontStyle(getFontAttributes({} as TaroElement))",
            node_name,
            node_name
        )
  } else if tag_name == "row" {
    format!(
      ".attributeModifier(rowModify.setNode({} as TaroElement))",
      node_name
    )
  } else if tag_name == "column" {
    format!(
      ".attributeModifier(columnModify.setNode({} as TaroElement))",
      node_name
    )
  } else {
    format!(
      ".attributeModifier(commonStyleModify.setNode({} as TaroElement))",
      node_name
    )
  }
}

pub fn get_component_style_str(node_name: &str, tag_name: &str) -> String {
  format!(
    r#"{}
.onVisibleAreaChange(getNodeThresholds({node_id} as TaroElement) || [0.0, 1.0], getComponentEventCallback({node_id} as TaroElement, VISIBLE_CHANGE_EVENT_NAME))
.onAreaChange(getComponentEventCallback({node_id} as TaroElement, AREA_CHANGE_EVENT_NAME, (res: TaroAny) => {{
  ({node_id} as TaroElement)._nodeInfo.areaInfo = res[1]
}}))"#,
    get_component_attr_str(node_name, tag_name),
    node_id = node_name
  )
}

pub fn get_view_component_str(
  node_name: &str,
  child_content: &str,
  direction: EtsDirection,
) -> String {
  let component_name;
  let mut component_param = "".to_string();
  let component_children = match child_content {
    "" => "".to_string(),
    _ => format!("\n{}", child_content),
  };

  match direction {
    EtsDirection::Row => {
      component_name = "Row";
    }
    EtsDirection::Column => {
      component_name = "Column";
    }
    EtsDirection::Flex => {
      component_name = "Flex";
      component_param = format!("FlexManager.flexOptions({} as TaroElement)", node_name);
    }
  }
  let style = get_component_style_str(node_name, component_name.to_lowercase().as_str());

  format!(
    "{name}({param}) {{{children}}}\n{style}",
    name = component_name,
    param = component_param,
    children = component_children,
    style = style
  )
}

pub fn get_image_component_str(node_name: &str) -> String {
  format!(
        "Image(({node_id} as TaroElement).getAttribute('src'))\n.objectFit(getImageMode(({node_id} as TaroElement).getAttribute('mode')))\n{style}\n.borderRadius({{
  topLeft: ({node_id} as TaroElement)._st.hmStyle.borderTopLeftRadius,
  topRight: ({node_id} as TaroElement)._st.hmStyle.borderTopRightRadius,
  bottomLeft: ({node_id} as TaroElement)._st.hmStyle.borderBottomLeftRadius,
  bottomRight: ({node_id} as TaroElement)._st.hmStyle.borderBottomRightRadius
}})",
        node_id = node_name,
        style = get_component_style_str(node_name, "image")
    )
}

pub fn get_text_component_str(node_name: &str) -> String {
  format!(
    "createText({node_id} as TaroTextElement)",
    node_id = node_name
  )
}

pub fn create_component_event(event_name: &str, node_name: &str) -> String {
  let process_event_trigger_name = |name: &str| -> String {
    if name == "touch" {
      String::from("TOUCH_EVENT_MAP.get(e.type)")
    } else {
      format!("'{}'", name)
    }
  };

  format!(
    "\n.{}(e => {{ eventHandler(e, {}, {} as TaroElement) }} )",
    event_name,
    process_event_trigger_name(&event_name.get(2..).unwrap().to_lowercase()),
    node_name
  )
}

```

### Core Architecture Module: `crates/swc_plugin_compile_mode/src/utils/harmony/mod.rs`
```
pub mod components;

```

### Core Architecture Module: `crates/swc_plugin_compile_mode/src/utils/mod.rs`
```
use regex::Regex;
use std::collections::{HashMap, HashSet};
use swc_core::{
  common::{iter::IdentifyLast, util::take::Take, DUMMY_SP as span},
  ecma::{
    ast::*,
    atoms::Atom,
    utils::{quote_ident, quote_str},
    visit::{Visit, VisitWith},
  },
};

use self::{constants::*, harmony::components::get_text_component_str};
use crate::PluginConfig;
use crate::{transform_harmony::TransformVisitor, ComponentReplace};

pub mod constants;
pub mod harmony;

pub fn named_iter(str: String) -> impl FnMut() -> String {
  let mut count = -1;
  return move || {
    count += 1;
    format!("{str}{count}")
  };
}

pub fn jsx_text_to_string(atom: &Atom) -> String {
  let content = atom.replace("\t", " ");

  let res = content.lines().enumerate().identify_last().fold(
    String::new(),
    |mut acc, (is_last, (index, line))| {
      // 首行不 trim 头
      let line = if index == 0 { line } else { line.trim_start() };

      // 尾行不 trim 尾
      let line = if is_last { line } else { line.trim_end() };

      if !acc.is_empty() && !line.is_empty() {
        acc.push(' ');
      }

      acc.push_str(line);
      acc
    },
  );
  res
}

// 将驼峰写法转换为 kebab-case，即 aBcD -> a-bc-d
pub fn to_kebab_case(val: &str) -> String {
  let mut res = String::new();
  val.chars().enumerate().for_each(|(idx, c)| {
    if idx != 0 && c.is_uppercase() {
      res.push('-');
    }
    res.push(c.to_ascii_lowercase());
  });
  res
}

pub fn convert_jsx_attr_key(jsx_key: &str, adapter: &HashMap<String, String>) -> String {
  if jsx_key == "className" {
    return String::from("class");
  } else if jsx_key == COMPILE_IF
    || jsx_key == COMPILE_ELSE
    || jsx_key == COMPILE_FOR
    || jsx_key == COMPILE_FOR_KEY
  {
    let expr = match jsx_key {
      COMPILE_IF => "if",
      COMPILE_ELSE => "else",
      COMPILE_FOR => "for",
      COMPILE_FOR_KEY => "key",
      _ => "",
    };
    let adapter = adapter
      .get(expr)
      .expect(&format!("[compile mode] 模板 {} 语法未配置", expr));
    return adapter.clone();
  }
  to_kebab_case(jsx_key)
}

pub fn check_is_event_attr(val: &str) -> bool {
  val.starts_with("on") && val.chars().nth(2).is_some_and(|x| x.is_uppercase())
}

pub fn identify_jsx_event_key(val: &str, platform: &str) -> Option<String> {
  // 处理worklet事件及callback
  // 事件：     onScrollUpdateWorklet         ->  worklet:onscrollupdate
  // callback：shouldResponseOnMoveWorklet   ->  worklet:should-response-on-move
  if val.ends_with("Worklet") {
    let worklet_name = val.trim_end_matches("Worklet");
    if worklet_name.starts_with("on") {
      return Some(format!("worklet:{}", worklet_name.to_lowercase()));
    } else {
      return Some(format!("worklet:{}", to_kebab_case(worklet_name)));
    }
  }

  if check_is_event_attr(val) {
    let event_name = val.get(2..).unwrap().to_lowercase();
    let event_name = if event_name == "click" {
      "tap"
    } else {
      &event_name
    };
    let event_binding_name = match platform {
      "ALIPAY" => {
        if event_name == "tap" {
          String::from("onTap")
        } else {
          String::from(val)
        }
      }
      _ => {
        format!("bind{}", event_name)
      }
    };
    Some(event_binding_name)
  } else {
    return None;
  }
}

pub fn is_inner_component(el: &JSXElement, config: &PluginConfig) -> bool {
  let opening = &el.opening;
  if let JSXElementName::Ident(Ident { sym, .. }) = &opening.name {
    let name = to_kebab_case(&sym);
    return config.components.get(&name).is_some();
  }

  false
}

pub fn is_static_jsx(el: &Box<JSXElement>) -> bool {
  if el.opening.attrs.len() > 0 {
    return false;
  }

  for child in &el.children {
    if let JSXElementChild::JSXText(_) = child {
    } else {
      return false;
    }
  }

  true
}

pub fn create_self_closing_jsx_element_expr(
  name: JSXElementName,
  attrs: Option<Vec<JSXAttrOrSpread>>,
) -> Expr {
  Expr::JSXElement(Box::new(JSXElement {
    span,
    opening: JSXOpeningElement {
      name,
      span,
      attrs: attrs.unwrap_or(vec![]),
      self_closing: true,
      type_args: None,
    },
    children: vec![],
    closing: None,
  }))
}

pub fn create_jsx_expr_attr(name: &str, expr: Box<Expr>) -> JSXAttrOrSpread {
  JSXAttrOrSpread::JSXAttr(JSXAttr {
    span,
    name: JSXAttrName::Ident(Ident::new(name.into(), span)),
    value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
      span,
      expr: JSXExpr::Expr(expr),
    })),
  })
}

pub fn create_jsx_bool_attr(name: &str) -> JSXAttrOrSpread {
  JSXAttrOrSpread::JSXAttr(JSXAttr {
    span,
    name: JSXAttrName::Ident(Ident::new(name.into(), span)),
    value: None,
  })
}

pub fn create_jsx_lit_attr(name: &str, lit: Lit) -> JSXAttrOrSpread {
  JSXAttrOrSpread::JSXAttr(JSXAttr {
    span,
    name: JSXAttrName::Ident(Ident::new(name.into(), span)),
    value: Some(JSXAttrValue::Lit(lit)),
  })
}

pub fn create_jsx_dynamic_id(el: &mut JSXElement, visitor: &mut TransformVisitor) -> String {
  let node_name = (visitor.get_node_name)();

  visitor.node_name_vec.push(node_name.clone());
  el.opening
    .attrs
    .push(create_jsx_lit_attr(DYNAMIC_ID, node_name.clone().into()));
  node_name
}

pub fn add_spaces_to_lines_with_count(input: &str, count: usize) -> String {
  let mut result = String::new();

  for line in input.lines() {
    let spaces = " ".repeat(count);
    result.push_str(&format!("{}{}\n", spaces, line));
  }

  result
}

pub fn add_spaces_to_lines(input: &str) -> String {
  let count = 2;

  add_spaces_to_lines_with_count(input, count)
}

pub fn get_harmony_replace_component_dependency_define(visitor: &mut TransformVisitor) -> String {
  let component_set = &visitor.component_set;
  let component_replace = &visitor.config.component_replace;
  let mut harmony_component_style = String::new();

  component_replace.iter().for_each(|(k, v)| {
    if component_set.contains(k) {
      let ComponentReplace {
        dependency_define, ..
      } = v;

      harmony_component_style.push_str(dependency_define);
      harmony_component_style.push_str("\n");
    }
  });

  harmony_component_style
}

pub fn get_harmony_component_style(visitor: &mut TransformVisitor) -> String {
  let component_set = &visitor.component_set;
  let component_replace = &visitor.config.component_replace;
  let mut harmony_component_style = String::new();

  let mut build_component = |component_tag: &str, component_style: &str| {
    if component_set.contains(component_tag) && !component_replace.contains_key(component_tag) {
      harmony_component_style.push_str(component_style);
    }
  };

  // build_component(IMAGE_TAG, HARMONY_IMAGE_STYLE_BIND);
  // build_component(TEXT_TAG, HARMONY_TEXT_STYLE_BIND);
  build_component(TEXT_TAG, HARMONY_TEXT_BUILDER);
  build_component(TEXT_TAG, HARMONY_TEXT_HELPER_FUNCITON);

  harmony_component_style
}

pub fn check_jsx_element_has_compile_ignore(el: &JSXElement) -> bool {
  for attr in &el.opening.attrs {
    if let JSXAttrOrSpread::JSXAttr(JSXAttr { name, .. }) = attr {
      if let JSXAttrName::Ident(Ident { sym, .. }) = name {
        if sym == COMPILE_IGNORE {
          return true;
        }
      }
    }
  }
  false
}

/**
 * identify: `xx.map(function () {})` or `xx.map(() => {})`
 */
pub fn is_call_expr_of_loop(callee_expr: &mut Box<Expr>, args: &mut Vec<ExprOrSpread>) -> bool {
  if let Expr::Member(MemberExpr {
    prop: MemberProp::Ident(Ident { sym, .. }),
    ..
  }) = &mut **callee_expr
  {
    if sym == "map" {
      if let Some(ExprOrSpread { expr, .. }) = args.get_mut(0) {
        return expr.is_arrow() || expr.is_fn_expr();
      }
    }
  }
  return false;
}

pub fn is_render_fn(callee_expr: &mut Box<Expr>) -> bool {
  fn is_starts_with_render(name: &str) -> bool {
    name.starts_with("render")
  }
  match &**callee_expr {
    Expr::Member(MemberExpr {
      prop: MemberProp::Ident(Ident { sym: name, .. }),
      ..
    }) => is_starts_with_render(name),
    Expr::Ident(Ident { sym: name, .. }) => is_starts_with_render(name),
    _ => false,
  }
}

pub fn extract_jsx_loop<'a>(
  callee_expr: &mut Box<Expr>,
  args: &'a mut Vec<ExprOrSpread>,
) -> Option<&'a mut Box<JSXElement>> {
  if is_call_expr_of_loop(callee_expr, args) {
    if let Some(ExprOrSpread { expr, .. }) = args.get_mut(0) {
      fn update_return_el(return_value: &mut Box<Expr>) -> Option<&mut Box<JSXElement>> {
        if let Expr::Paren(ParenExpr { expr, .. }) = &mut **return_value {
          *return_value = expr.take();
        }
        if return_value.is_jsx_element() {
          let el = return_value.as_mut_jsx_element().unwrap();
          el.opening.attrs.push(create_jsx_bool_attr(COMPILE_FOR));
          el.opening.attrs.push(create_jsx_lit_attr(
            COMPILE_FOR_KEY,
            Lit::Str(quote_str!("sid")),
          ));
          return Some(el);
        } else if return_value.is_jsx_fragment() {
          let el = return_value.as_mut_jsx_fragment().unwrap();
          let children = el.children.take();
          let block_el = Box::new(JSXElement {
            span,
            opening: JSXOpeningElement {
              name: JSXElementName::Ident(quote_ident!("block")),
              span,
              attrs: vec![
                create_jsx_bool_attr(COMPILE_FOR),
                create_jsx_lit_attr(COMPILE_FOR_KEY, Lit::Str(quote_str!("sid"))),
              ],
              self_closing: false,
              type_args: None,
            },
            children,
            closing: Some(JSXClosingElement {
              span,
              name: JSXElementName::Ident(quote_ident!("block")),
            }),
          });
          **return_value = Expr::JSXElement(block_el);
          return Some(return_value.as_mut_jsx_element().unwrap());
        }
        None
      }
      match &mut **expr {
        Expr::Fn(FnExpr { function, .. }) => {
          if let Function {
            body: Some(BlockStmt { stmts, .. }),
            ..
          } = &mut **function
          {
            if let Some(Stmt::Return(Ret
```

### Core Architecture Module: `crates/swc_plugin_compile_mode_pre_process/src/utils/constant.rs`
```
pub const COMPILE_MODE: &str = "compileMode";
pub const DEFAULT_COMPONENT: &str = "Default_Component";

```

### Core Architecture Module: `crates/swc_plugin_compile_mode_pre_process/src/utils/mod.rs`
```
pub mod constant;
pub mod react_component;
pub mod render_fn;

```

### Core Architecture Module: `crates/swc_plugin_compile_mode_pre_process/src/utils/react_component.rs`
```
use swc_core::ecma::{ast::BlockStmt, visit::VisitMutWith};

use crate::visitors::is_compile_mode_component::IsCompileModeVisitor;

pub struct ReactComponent {
  pub name: String,
  pub block_stmt: Option<BlockStmt>,
}

impl Clone for ReactComponent {
  fn clone(&self) -> Self {
    ReactComponent {
      name: self.name.clone(),
      block_stmt: self.block_stmt.clone(),
    }
  }
}

impl ReactComponent {
  pub fn new(name: String, block_stmt: Option<BlockStmt>) -> Self {
    ReactComponent { name, block_stmt }
  }

  pub fn get_name(&self) -> String {
    self.name.clone()
  }

  pub fn is_valid(&mut self) -> bool {
    // 1. 名称是否是大写字母开头
    let is_first_char_uppercase = self.get_name().chars().next().unwrap().is_uppercase();
    // 2. 返回的 JSX 里面有没有 compilerMode
    let mut is_compile_mode_component: IsCompileModeVisitor = IsCompileModeVisitor::new();
    if let Some(block_stmt) = &mut self.block_stmt {
      block_stmt.visit_mut_with(&mut is_compile_mode_component);
    }
    is_first_char_uppercase && is_compile_mode_component.valid
  }
}

```

### Core Architecture Module: `crates/swc_plugin_compile_mode_pre_process/src/utils/render_fn.rs`
```
use swc_core::ecma::ast::*;

pub struct RenderFn {
  pub params: Vec<Pat>,
  pub jsx_element: JSXElement,
}

impl RenderFn {
  pub fn new(params: Vec<Pat>, jsx_element: JSXElement) -> Self {
    RenderFn {
      params,
      jsx_element,
    }
  }
}

impl Clone for RenderFn {
  fn clone(&self) -> Self {
    RenderFn {
      params: self.params.clone(),
      jsx_element: self.jsx_element.clone(),
    }
  }
}

```

### Core Architecture Module: `crates/swc_plugin_compile_mode_pre_process/src/visitors/collect_render_fn.rs`
```
use std::collections::HashMap;
use swc_core::ecma::{
  ast::*,
  visit::{VisitMut, VisitMutWith},
};

use crate::{
  utils::{constant::COMPILE_MODE, render_fn::RenderFn},
  PluginConfig,
};

pub struct CollectRenderFnVisitor<'a> {
  pub raw_render_fn_map: HashMap<String, RenderFn>,
  sub_component_name: Option<String>,
  sub_component_params: Option<Vec<Pat>>,
  in_outmost_block_scope: bool,
  config: &'a PluginConfig,
}

impl<'a> CollectRenderFnVisitor<'a> {
  pub fn new(config: &'a PluginConfig) -> Self {
    CollectRenderFnVisitor {
      raw_render_fn_map: HashMap::new(),
      sub_component_name: None,
      sub_component_params: None,
      in_outmost_block_scope: true,
      config,
    }
  }
}
//只在最外层找就可以了，因为这个函数是一个 react 组件的入口
impl<'a> VisitMut for CollectRenderFnVisitor<'a> {
  fn visit_mut_block_stmt(&mut self, n: &mut BlockStmt) {
    if !self.in_outmost_block_scope {
      return;
    }
    for stmt in &mut n.stmts {
      match stmt {
        Stmt::Decl(Decl::Fn(fn_decl)) => {
          // 适配 function xxx() {}
          let component_name = fn_decl.ident.sym.to_string();
          // todo 需要调整
          let is_valid_sub_component = component_name.starts_with("render");
          match ((*fn_decl).function.body.as_mut(), is_valid_sub_component) {
            (Some(block_stmt), true) => {
              for stmt in &mut block_stmt.stmts {
                match stmt {
                  Stmt::Return(return_stmt) => {
                    self.in_outmost_block_scope = true;
                    self.sub_component_name = Some(component_name.clone());
                    self.sub_component_params = Some(
                      fn_decl
                        .function
                        .params
                        .clone()
                        .into_iter()
                        .map(|fn_param| fn_param.pat)
                        .collect(),
                    );
                    return_stmt.visit_mut_with(self);
                    self.in_outmost_block_scope = false;
                    self.sub_component_name = None;
                    self.sub_component_params = None;
                  }
                  _ => {}
                }
              }
            }
            _ => {}
          }
        }
        Stmt::Decl(Decl::Var(var_dec)) => {
          for decl in &mut var_dec.decls {
            let sub_component_name = &decl.name;
            match (&mut decl.init, sub_component_name) {
              (Some(expr), Pat::Ident(sub_component_name)) => {
                if let Expr::Arrow(arrow) = &mut **expr {
                  if let BlockStmtOrExpr::BlockStmt(block_stmt) = &mut *arrow.body {
                    for stmt in &mut block_stmt.stmts {
                      match stmt {
                        Stmt::Return(return_stmt) => {
                          self.in_outmost_block_scope = true;
                          self.sub_component_name = Some(sub_component_name.sym.to_string());
                          self.sub_component_params = Some(arrow.params.clone());
                          return_stmt.visit_mut_with(self);
                          self.in_outmost_block_scope = false;
                          self.sub_component_name = None;
                          self.sub_component_params = None;
                        }
                        _ => {}
                      }
                    }
                  }
                }
              }
              _ => {}
            }
          }
        }
        _ => {}
      }
    }
    self.in_outmost_block_scope = false
  }

  fn visit_mut_return_stmt(&mut self, n: &mut ReturnStmt) {
    match (self.in_outmost_block_scope, &n.arg) {
      (true, Some(arg)) => match &**arg {
        Expr::Paren(paren_expr) => {
          if let Expr::JSXElement(jsx_element) = &*paren_expr.expr {
            for attr in &jsx_element.opening.attrs {
              if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                match (
                  &jsx_attr.name,
                  &jsx_attr.value,
                  &self.sub_component_name,
                  &self.sub_component_params,
                ) {
                  (
                    JSXAttrName::Ident(jsx_attr_name),
                    Some(JSXAttrValue::Lit(Lit::Str(Str { value, .. }))),
                    Some(sub_component_name),
                    Some(sub_component_params),
                  ) => {
                    if jsx_attr_name.sym == COMPILE_MODE && *value == self.config.sub_render_fn {
                      self.raw_render_fn_map.insert(
                        sub_component_name.clone(),
                        RenderFn::new(sub_component_params.clone(), *jsx_element.clone()),
                      );
                    }
                  }
                  _ => {}
                }
              }
            }
          }
        }
        Expr::JSXElement(jsx_element) => {
          for attr in &jsx_element.opening.attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
              match (
                &jsx_attr.name,
                &jsx_attr.value,
                &self.sub_component_name,
                &self.sub_component_params,
              ) {
                (
                  JSXAttrName::Ident(jsx_attr_name),
                  Some(JSXAttrValue::Lit(Lit::Str(Str { value, .. }))),
                  Some(sub_component_name),
                  Some(sub_component_params),
                ) => {
                  if jsx_attr_name.sym == COMPILE_MODE && *value == self.config.sub_render_fn {
                    self.raw_render_fn_map.insert(
                      sub_component_name.clone(),
                      RenderFn::new(sub_component_params.clone(), *jsx_element.clone()),
                    );
                  }
                }
                _ => {}
              }
            }
          }
        }
        _ => {}
      },
      _ => {}
    }
  }
}

```

### Core Architecture Module: `crates/taro_init/src/utils.rs`
```
use anyhow::{Context, Error, Ok};
use console::style;
use futures::FutureExt;
use spinners::{Spinner, Spinners};
use std::path::PathBuf;
use std::{env, process, result};
use std::{fs, path::Path, process::Stdio};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::async_fs;
use crate::constants::{NpmType, HANDLEBARS, PACKAGES_MANAGEMENT};

pub fn get_all_files_in_folder<P: AsRef<Path>>(
  folder: P,
  filter: &[&str],
  need_folder: Option<bool>,
) -> Result<Vec<PathBuf>, Error> {
  let mut files = Vec::new();
  let entries = fs::read_dir(folder.as_ref())?;
  let need_folder = need_folder.unwrap_or(false);

  for entry in entries {
    let entry = entry?;
    let path = entry.path();
    if path.is_dir() {
      if need_folder {
        files.push(path.clone());
      }
      files.extend(get_all_files_in_folder(&path, filter, Some(need_folder))?);
    } else if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
      if !filter.contains(&file_name) {
        files.push(path);
      }
    }
  }

  Ok(files)
}

pub async fn generate_with_template(
  from_path: &str,
  dest_path: &str,
  data: &impl serde::Serialize,
) -> anyhow::Result<()> {
  let form_template = async_fs::read(from_path)
    .await
    .with_context(|| format!("文件读取失败: {}", from_path))?;
  let from_template = String::from_utf8_lossy(&form_template);
  let template = if from_template == "" {
    "".to_string()
  } else {
    HANDLEBARS
      .render_template(&from_template, data)
      .with_context(|| format!("模板渲染失败: {}", from_path))?
  };
  let dir_name = Path::new(dest_path)
    .parent()
    .unwrap()
    .to_string_lossy()
    .to_string();
  async_fs::create_dir_all(&dir_name)
    .await
    .with_context(|| format!("文件夹创建失败: {}", dir_name))?;
  let metadata = async_fs::metadata(from_path)
    .await
    .with_context(|| format!("文件读取失败: {}", from_path))?;
  async_fs::write(dest_path, template)
    .await
    .with_context(|| format!("文件写入失败: {}", dest_path))?;
  #[cfg(unix)]
  async_fs::set_permissions(dest_path, metadata.permissions())
    .await
    .with_context(|| format!("文件权限设置失败: {}", dest_path))?;
  Ok(())
}

pub fn normalize_path_str(path: &str) -> String {
  let mut path = path.replace("\\", "/");
  if path.ends_with("/") {
    path = path[..path.len() - 1].to_string();
  }
  path
}

pub fn normalize_path_path(p: &dyn AsRef<Path>) -> String {
  let path = p.as_ref().to_string_lossy().to_string();
  normalize_path_str(&path)
}

pub async fn execute_command(cmd: &str, args: &[&str]) -> anyhow::Result<()> {
  let mut command = Command::new(cmd);
  command.args(args);

  let mut child = command
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;
  let stdout_handle = child.stdout.take().unwrap();
  let stderr_handle = child.stderr.take().unwrap();

  let stdout_future = process_lines(stdout_handle).fuse();
  let stderr_future = process_lines(stderr_handle).fuse();
  tokio::select! {
    _ = stdout_future => {},
    _ = stderr_future => {},
  }

  let status = child.wait().await?;
  if status.success() {
    Ok(())
  } else {
    Err(Error::msg(format!(
      "Command failed with exit code: {}",
      status
    )))
  }
}

async fn process_lines<R>(reader: R)
where
  R: tokio::io::AsyncRead + Unpin,
{
  let mut lines = BufReader::new(reader).lines();

  while let Some(line) = lines.next_line().await.unwrap() {
    println!("{}", line);
  }
}

pub async fn install_deps<F>(npm: &NpmType, project_path: &str, cb: F) -> anyhow::Result<()>
where
  F: FnOnce(),
{
  let command = PACKAGES_MANAGEMENT.get(npm);
  if let Some(command) = command {
    let command = command.command;
    println!(
      "执行安装项目依赖 {}, 需要一会儿...",
      style(command.to_owned() + " install").cyan().bold()
    );
    
    // 确保在项目目录中执行
    env::set_current_dir(project_path)?;
    
    let output = execute_command(command, &["install"]).await;
    match output {
      result::Result::Ok(_) => {
        println!(
          "{} {}",
          style("✔").green(),
          format!("{}", style("安装项目依赖成功").green())
        );
        cb();
      }
      Err(e) => {
        println!(
          "{} {}",
          style("✘").red(),
          format!("{}", style("安装项目依赖失败，请自行重新安装！").red())
        );
        if e.to_string().contains("No such file or directory") {
          println!("没有找到命令 {}, 请检查！", command);
        }
      }
    }
  }
  Ok(())
}

pub fn init_git(project_name: &str, project_path: &str) -> anyhow::Result<()> {
  let mut sp = Spinner::new(
    Spinners::Dots9,
    format!(
      "cd {}, 执行 {}",
      style(project_name).cyan().bold(),
      style("git init").cyan().bold()
    ),
  );
  env::set_current_dir(project_path)?;
  // git init
  let output = process::Command::new("git").arg("init").output();

  match output {
    result::Result::Ok(output) => {
      if output.status.success() {
        sp.stop_with_message(format!(
          "{} {}",
          style("✔").green(),
          format!("{}", style("初始化 git 成功").green())
        ));
      } else {
        sp.stop_with_message(format!(
          "{} {}",
          style("✘").red(),
          format!("{}", style("初始化 git 失败").red())
        ));
        if !output.stderr.is_empty() {
          println!("{}", String::from_utf8_lossy(&output.stderr));
        }
        if !output.stdout.is_empty() {
          println!("{}", String::from_utf8_lossy(&output.stdout));
        }
      }
    }
    Err(e) => {
      sp.stop_with_message(format!(
        "{} {}",
        style("✘").red(),
        format!("{}", style("初始化 git 失败").red())
      ));
      if e.kind() == std::io::ErrorKind::NotFound {
        println!("没有找到命令 git, 请检查！");
      } else {
        println!("{}", e);
      }
    }
  }
  Ok(())
}

```

### Core Architecture Module: `examples/blended-basic/miniapp/utils/util.js`
```
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

const logRaw = () => {
  console.log('I m raw')
}

module.exports = {
  formatTime,
  logRaw
}

```

### Core Architecture Module: `examples/mini-program-example/src/components/component_state/component_state.js`
```
import React from 'react'
import { View } from '@tarojs/components'

import './component_state.scss'

export default class ComponentState extends React.Component {
  static options = {
    addGlobalClass: true,
  }

  render() {
    return (
      <View className='page-state'>
        <View className='page-state-platform'>组件类型：{this.props.platform}</View>
        <View className='page-state-rate'>适配进度：{this.props.rate}%</View>
      </View>
    )
  }
}

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

**File**: `tests/__tests__/__snapshots__/css-modules.spec.ts.snap` (modified, +2/-0)
```diff
@@ -130,6 +130,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
@@ -1834,6 +1835,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
```

**File**: `tests/__tests__/__snapshots__/framework.spec.ts.snap` (modified, +2/-0)
```diff
@@ -130,6 +130,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
@@ -2351,6 +2352,7 @@ require("./runtime");
                 "send-message-img": _empty,
                 "app-parameter": _empty,
                 "show-message-card": _false,
+                "phone-number-no-quota-toast": _true,
                 "business-id": _empty,
                 bindGetUserInfo: _empty,
                 bindContact: _empty,
```

**File**: `tests/__tests__/__snapshots__/parse-html.spec.ts.snap` (modified, +1/-0)
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

**File**: `examples/subpackage-indie/miniapp/pages/order/pages/index/app-origin.wxss` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-page{background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif}.container{padding:20rpx}.text-primary{color:#1aad19}.text-secondary{color:#999}
\ No newline at end of file
```

**File**: `examples/subpackage-indie/miniapp/pages/order/pages/index/app.js` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-"use strict";require("./vendors"),require("./taro"),require("./runtime"),(wx["webpackJsonp"]=wx["webpackJsonp"]||[]).push([[524],{8841:function(n,e,i){i(3682);var o=i(3207),t=i(1285),r=i(8363),s=i(9551),a=i(2363),u=i(7653),p=i(3279),c=i(758),d=i.t(c,2),g=function(n){function e(){return(0,s.A)(this,e),(0,u.A)(this,e,arguments)}return(0,p.A)(e,n),(0,a.A)(e,[{key:"componentDidMount",value:function(){console.log("app launch")}},{key:"render",value:function(){return this.props.children}}])}(c.Component),x=g,f=i(7927),b={pages:["pages/index/index"],components:["pages/sub1/index","pages/sub2/index"],subPackageIndie:{mainPackageRoot:"pages/index/index",subPackageRoots:["pages/sub1/index","pages/sub2/index"]}};o.mw.__taroAppConfig=b;var v=(0,t.ND)(x,d,f.Ay,b);v.onLaunch(),exports.taroApp=v,(0,r.initPxTransform)({designWidth:750,deviceRatio:{640:1.17,750:1,828:.905},baseFontSize:20,unitPrecision:void 0,targetUnit:void 0})}},function(n){var e=function(e){return n(n.s=e)};n.O(0,[907,96],function(){return e(8841)});n.O()}]);
\ No newline at end of file
```

**File**: `examples/subpackage-indie/miniapp/pages/order/pages/index/app.wxss` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-@import "./app-origin.wxss";
\ No newline at end of file
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
+  test('#once 回调先重复 trigger 再报错时，只执行一次并解绑', () => {
+    const events = new Events()
+    const spy = vi.fn(() => {
+      if (spy.mock.calls.length < 3) {
+        events.trigger('reenter-throw')
+      }
+      throw new Error('boom')
+    })
+
+    events.once('reenter-throw', spy)
+    expect(() => events.trigger('reenter-throw')).toThrow('boom')
+    events.trigger('reenter-throw')
+
+    expect(spy).toBeCalledTimes(1)
+  })
+
+  test('#once 传入空回调时，首次 trigger 报错后监听器也会被解绑', () => {
+    const events = new Events()
+
+    events.once('falsy', undefined as any)
+    expect(() => events.trigger('falsy')).toThrow(TypeError)
+    expect(() => events.trigger('falsy')).not.toThrow()
+  })
+
+  test('#once 回调抛出的异常对象原样向上抛出 (control)', () => {
+    const events = new Events()
+    const error = new Error('identity')
+    const spy = vi.fn(() => {
+      throw error
+    })
+
+    events.once('identity', spy)
+    let caught: unknown
+    try {
+      events.trigger('identity')
+    } catch (e) {
+      caught
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

---

### Incident Patch 11: `dbfb26b8` (2026-09-20)
**Commit Message**: fix(components-rn): upgrade ant design react native (#19489)

* fix(components-rn): upgrade ant design react native

* fix(components-rn): adapt pickers to ant design 5.1.3

---------

Co-authored-by: Single-Dancer <[REDACTED_EMAIL]>

**File**: `packages/taro-components-rn/package.json` (modified, +5/-1)
```diff
@@ -32,13 +32,14 @@
     "node": ">= 18"
   },
   "dependencies": {
-    "@ant-design/react-native": "5.0.0",
+    "@ant-design/react-native": "5.1.3",
     "@tarojs/components": "workspace:*",
     "@tarojs/router-rn": "workspace:*",
     "prop-types": "^15.8.1",
     "react-native-maps": "1.3.2"
   },
   "devDependencies": {
+    "@ant-design/icons-react-native": "2.3.2",
     "@react-native-community/slider": "4.4.2",
     "@react-native-picker/picker": "2.6.1",
     "@babel/core": "^7.24.4",
@@ -54,18 +55,21 @@
     "expo-module-scripts": "^3.5.1",
     "jest-expo": "~50.0.3",
     "react-native": "^0.73.1",
+    "react-native-gesture-handler": "2.14.1",
     "react-native-pager-view": "6.2.3",
     "react-native-svg": "14.1.0",
     "react-native-webview": "13.6.4"
   },
   "peerDependencies": {
+    "@ant-design/icons-react-native": ">=2.3.1",
     "@react-native-community/slider": "4.4.2",
     "@react-native-picker/picker": "2.6.1",
     "expo": "~50.0.0",
     "expo-av": "~13.10.6",
     "expo-camera": "~14.1.3",
     "react": "^18",
     "react-native": "^0.73.1",
+    "react-native-gesture-handler": ">=2.2.1",
     "react-native-pager-view": "6.2.3",
     "react-native-svg": "14.1.0",
     "react-native-webview": "13.6.4"
```

**File**: `packages/taro-components-rn/src/__tests__/__snapshots__/pickerView.spec.tsx.snap` (modified, +18/-383)
```diff
@@ -2,404 +2,39 @@
 
 exports[`PickerView PickerView render 1`] = `
 <View
-  style={
-    {
-      "flexDirection": "row",
-    }
-  }
+  onLayout={[Function]}
 >
   <View
     style={
-      {
-        "flex": 1,
-      }
+      [
+        {
+          "height": "auto",
+          "justifyContent": "center",
+          "overflow": "hidden",
+        },
+      ]
     }
   >
-    <RNCPicker
-      items={
-        [
-          {
-            "label": "2010年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "0",
-          },
-          {
-            "label": "2011年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "1",
-          },
-          {
-            "label": "2012年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "2",
-          },
-          {
-            "label": "2013年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "3",
-          },
-          {
-            "label": "2014年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "4",
-          },
-          {
-            "label": "2015年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "5",
-          },
-          {
-            "label": "2016年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "6",
-          },
-          {
-            "label": "2017年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "7",
-          },
-          {
-            "label": "2018年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "8",
-          },
-          {
-            "label": "2019年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "9",
-          },
-          {
-            "label": "2020年",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "10",
-          },
-        ]
-      }
+    <Text
       numberOfLines={1}
-      onChange={[Function]}
-      selectedIndex={0}
       style={
         [
           {
-            "height": 216,
+            "color": "#333",
+            "fontSize": 16,
+            "includeFontPadding": false,
+            "padding": 8,
+            "textAlign": "center",
           },
           undefined,
-        ]
-      }
-    />
-  </View>
-  <View
-    style={
-      {
-        "flex": 1,
-      }
-    }
-  >
-    <RNCPicker
-      items={
-        [
           {
-            "label": "1月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "0",
+            "height": "auto",
           },
-          {
-            "label": "2月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "1",
-          },
-          {
-            "label": "3月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "2",
-          },
-          {
-            "label": "4月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "3",
-          },
-          {
-            "label": "5月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "4",
-          },
-          {
-            "label": "6月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "5",
-          },
-          {
-            "label": "7月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "6",
-          },
-          {
-            "label": "8月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "7",
-          },
-          {
-            "label": "9月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "8",
-          },
-          {
-            "label": "10月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "9",
-          },
-          {
-            "label": "11月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "10",
-          },
-          {
-            "label": "12月",
-            "testID": undefined,
-            "textColor": undefined,
-            "value": "11",
-          },
-        ]
-      }
-      numberOfLines={1}
-      onChange={[Function]}
-      selectedIndex={0}
-      style={
-        [
-          {
-            "height": 216,
-          },
-          undefined,
-        ]
-      }
-    />
-  </View>
-  <View
-    style={
-      {
-        "flex": 1,
-      }
-    }
-  >
-    <RNCPicker
-      items={
-        [
-          {
-            "label": "1日",
-            "testID": undefined,
-            "textColor": undef
```

**File**: `packages/taro-components-rn/src/__tests__/picker-date-time.spec.tsx` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import Portal from '@ant-design/react-native/lib/portal'
+import { act, fireEvent, render } from '@testing-library/react-native'
+import * as React from 'react'
+import { Text } from 'react-native'
+
+import DateSelector from '../components/Picker/date'
+import TimeSelector from '../components/Picker/time'
+
+function renderSelector(Component, props = {}) {
+  const ref = React.createRef<any>()
+  const result = render(<Portal.Host><Component ref={ref} {...props}><Text>选择</Text></Component></Portal.Host>)
+  return { ...result, ref }
+}
+
+describe('Picker date and time compatibility', () => {
+  it.each(['year', 'month', 'day'])('preserves date precision %s', fields => {
+    const { ref } = renderSelector(DateSelector, { fields })
+    expect(ref.current.render().props.precision).toBe(fields)
+  })
+
+  it('renders only hours and minutes within the time bounds', () => {
+    const { ref } = renderSelector(TimeSelector, { start: '09:30', end: '11:15', value: '10:05' })
+    const { data, value, cols } = ref.current.render().props
+    expect(cols).toBe(2)
+    expect(value).toEqual(['10', '05'])
+    expect(data.map(hour => hour.value)).toEqual(['09', '10', '11'])
+    expect(data[0].children.map(minute => minute.value)).toEqual(Array.from({ length: 30 }, (_, index) => String(index + 30)))
+    expect(data[1].children).toHaveLength(60)
+    expect(data[2].children).toHaveLength(16)
+  })
+
+  it.each([
+    ['00:00', '23:59', 24, 60],
+    ['09:30', '09:30', 1, 1],
+  ])('supports time bounds %s to %s', (start, end, hours, minutes) => {
+    const { ref } = renderSelector(TimeSelector, { start, end })
+    const { data } = ref.current.render().props
+    expect(data).toHaveLength(hours)
+    expect(data[0].children).toHaveLength(minutes)
+  })
+
+  it.each([DateSelector, TimeSelector])('cancels through the popup for %p', Component => {
+    const onCancel = jest.fn()
+    const onChange = jest.fn()
+    const { getByText } = renderSelector(Component, { onCancel, onChange })
+    fireEvent.press(getByText('选择'))
+    fireEvent.press(getByText('取消'))
+    expect(onCancel).toHaveBeenCalledTimes(1)
+    expect(onChange).not.toHaveBeenCalled()
+  })
+
+  it.each([
+    [DateSelector, '2026-09-20'],
+    [TimeSelector, '09:05'],
+  ])('confirms through the popup for %p', (Component, value) => {
+    const onCancel = jest.fn()
+    const onChange = jest.fn()
+    const { getByText } = renderSelector(Component, { value, onCancel, onChange })
+    fireEvent.press(getByText('选择'))
+    fireEvent.press(getByText('确定'))
+    expect(onChange).toHaveBeenCalledWith({ detail: { value } })
+    expect(onCancel).not.toHaveBeenCalled()
+  })
+
+  it('emits a formatted time only on confirmation', () => {
+    const onChange = jest.fn()
+    const onCancel = jest.fn()
+    const { ref } = renderSelector(TimeSelector, { onChange, onCancel })
+    expect(onChange).not.toHaveBeenCalled()
+    act(() => ref.current.render().props.onChange(['09', '05']))
+    expect(onChange).toHaveBeenCalledWith({ detail: { value: '09:05' } })
+    expect(onCancel).not.toHaveBeenCalled()
+  })
+
+  it.each([DateSelector, TimeSelector])('keeps cancellation and disabled behavior for %p', Component => {
+    const onCancel = jest.fn()
+    const onChange = jest.fn()
+    const { ref, getByText, queryByText } = renderSelector(Component, { disabled: true, onCancel, onChange })
+    fireEvent.press(getByText('选择'))
+    expect(onChange).not.toHaveBeenCalled()
+    expect(queryByText('确定')).toBeNull()
+    expect(ref.current.render().props.disabled).toBe(true)
+    act(() => ref.current.render().props.onDismiss())
+    expect(onCancel).toHaveBeenCalledTimes(1)
+    expect(onChange).not.toHaveBeenCalled()
+  })
+})
```

**File**: `packages/taro-components-rn/src/__tests__/pickerView.spec.tsx` (modified, +18/-1)
```diff
@@ -1,4 +1,5 @@
-import { render } from '@testing-library/react-native'
+import AntPickerView from '@ant-design/react-native/lib/picker-view'
+import { fireEvent, render } from '@testing-library/react-native'
 import * as React from 'react'
 import { View } from 'react-native'
 
@@ -44,7 +45,23 @@ describe('PickerView', () => {
         </PickerViewColumn>
       </PickerView>
     )
+    const picker = component.UNSAFE_getByType(AntPickerView)
+    expect(picker.props.data.map(column => column.length)).toEqual([11, 12, 30])
+    expect(picker.props.data[0][0]).toEqual({ label: '2010年', value: 0 })
+    expect(picker.props.data[2][29]).toEqual({ label: '30日', value: 29 })
+    expect(picker.props.cascade).toBe(false)
     const tree = component.toJSON()
     expect(tree).toMatchSnapshot()
+    // The new wheel waits for native item and container measurements before rendering its columns.
+    const measure = height => fireEvent(
+      component.UNSAFE_getAllByType(View).find(view => view.props.onLayout)!,
+      'layout',
+      { nativeEvent: { layout: { height, width: 300, x: 0, y: 0 } } }
+    )
+    measure(40)
+    measure(280)
+    expect(component.getByText('2010年')).toBeTruthy()
+    expect(component.getByText('1月')).toBeTruthy()
+    expect(component.getByText('1日')).toBeTruthy()
   })
 })
```

**File**: `packages/taro-components-rn/src/components/Picker/date.tsx` (modified, +9/-8)
```diff
@@ -4,6 +4,8 @@ import * as React from 'react'
 import { noop } from '../../utils'
 import { DateProps, DateState } from './PropsType'
 
+import type { PickerProps } from '@ant-design/react-native/lib/picker'
+
 function formatTimeStr(time = ''): Date {
   let [year, month, day]: any = time.split('-')
   year = ~~year || 2000
@@ -94,22 +96,21 @@ export default class DateSelector extends React.Component<DateProps, DateState>
       value,
     } = this.state
 
-    let mode: any = 'date'
-    if (fields === 'year') {
-      mode = 'year'
-    } else if (fields === 'month') {
-      mode = 'month'
+    // 5.1.3 forwards these props to Picker but omits them from DatePickerProps.
+    // Remove this bridge when the upstream declaration includes them.
+    const popupProps: Pick<PickerProps, 'onDismiss' | 'disabled'> = {
+      onDismiss: this.onDismiss,
+      disabled,
     }
 
     return (
       <AntDatePicker
-        mode={mode}
+        precision={fields || 'day'}
+        {...popupProps}
         value={formatTimeStr(value)}
         minDate={formatTimeStr(start)}
         maxDate={formatTimeStr(end)}
         onChange={this.onChange}
-        onDismiss={this.onDismiss}
-        disabled={disabled}
       >
         {children}
       </AntDatePicker>
```

**File**: `packages/taro-components-rn/src/components/Picker/region.tsx` (modified, +5/-6)
```diff
@@ -1,16 +1,15 @@
-import AntPicker from '@ant-design/react-native/lib/picker'
-import { PickerData } from '@ant-design/react-native/lib/picker/PropsType'
+import AntPicker, { PickerColumnItem } from '@ant-design/react-native/lib/picker'
 import * as React from 'react'
 
 import { noop } from '../../utils'
 import { RegionObj, RegionProps, RegionState } from './PropsType'
 import { regionData } from './regionData'
 
-function formateRegionData(clObj: RegionObj[] = [], customItem?: string, depth = 2): PickerData[] {
+function formateRegionData(clObj: RegionObj[] = [], customItem?: string, depth = 2): PickerColumnItem[] {
   const l = depth
-  const obj: PickerData[] = []
+  const obj: PickerColumnItem[] = []
   if (customItem) {
-    const objClone: PickerData = {
+    const objClone: PickerColumnItem = {
       value: customItem,
       label: customItem
     }
@@ -23,7 +22,7 @@ function formateRegionData(clObj: RegionObj[] = [], customItem?: string, depth =
     obj.push(panding)
   }
   for (let i = 0; i < clObj.length; i++) {
-    const region: PickerData = {
+    const region: PickerColumnItem = {
       value: clObj[i].value,
       label: clObj[i].value,
     }
```

**File**: `packages/taro-components-rn/src/components/Picker/time.tsx` (modified, +24/-19)
```diff
@@ -1,16 +1,23 @@
-import AntDatePicker from '@ant-design/react-native/lib/date-picker'
+import AntPicker, { PickerColumnItem, PickerValue } from '@ant-design/react-native/lib/picker'
 import * as React from 'react'
 
 import { noop } from '../../utils'
 import { TimeProps, TimeState } from './PropsType'
 
-function formatTimeStr(time = ''): Date {
-  const now = new Date()
-  let [hour, minute]: any = time.split(':')
-  hour = ~~hour
-  minute = ~~minute
-  now.setHours(hour, minute)
-  return now
+function getTimeData(start: string, end: string): PickerColumnItem[] {
+  const [startHour, startMinute] = start.split(':').map(Number)
+  const [endHour, endMinute] = end.split(':').map(Number)
+  const hours: PickerColumnItem[] = []
+  for (let hour = startHour; hour <= endHour; hour++) {
+    const minutes: PickerColumnItem[] = []
+    const minMinute = hour === startHour ? startMinute : 0
+    const maxMinute = hour === endHour ? endMinute : 59
+    for (let minute = minMinute; minute <= maxMinute; minute++) {
+      minutes.push({ label: `${minute}分`, value: String(minute).padStart(2, '0') })
+    }
+    hours.push({ label: `${hour}时`, value: String(hour).padStart(2, '0'), children: minutes })
+  }
+  return hours
 }
 
 export default class TimeSelector extends React.Component<TimeProps, TimeState> {
@@ -53,11 +60,9 @@ export default class TimeSelector extends React.Component<TimeProps, TimeState>
     return null
   }
 
-  onChange = (date: Date): void => {
+  onChange = (values: PickerValue[]): void => {
     const { onChange = noop } = this.props
-    const hh: string = ('0' + date.getHours()).slice(-2)
-    const mm: string = ('0' + date.getMinutes()).slice(-2)
-    const value = `${hh}:${mm}`
+    const value = values.join(':')
     this.setState({ value })
     onChange({ detail: { value } })
     this.setState({ isInOnChangeUpdate: true })
@@ -69,21 +74,21 @@ export default class TimeSelector extends React.Component<TimeProps, TimeState>
   }
 
   render(): JSX.Element {
-    const { children, start, end, disabled } = this.props
+    const { children, start = '00:00', end = '23:59', disabled } = this.props
     const { value } = this.state
 
     return (
-      <AntDatePicker
-        mode={'time'}
-        value={formatTimeStr(value)}
-        minDate={formatTimeStr(start)}
-        maxDate={formatTimeStr(end)}
+      <AntPicker
+        cols={2}
+        cascade
+        data={getTimeData(start, end)}
+        value={value.split(':')}
         onChange={this.onChange}
         onDismiss={this.onDismiss}
         disabled={disabled}
       >
         {children}
-      </AntDatePicker>
+      </AntPicker>
     )
   }
 }
```

**File**: `packages/taro-components-rn/src/components/PickerView/PropsType.tsx` (modified, +4/-4)
```diff
@@ -1,9 +1,9 @@
-import { PickerData } from '@ant-design/react-native/lib/picker/PropsType'
-import { PickerViewProps as __PickerViewProps } from '@ant-design/react-native/lib/picker-view/PickerView'
+import { PickerColumnItem } from '@ant-design/react-native/lib/picker'
+import { PickerViewProps as __PickerViewProps } from '@ant-design/react-native/lib/picker-view'
 import { PickerViewProps as _PickerViewProps } from '@tarojs/components/types/PickerView'
 
-export interface PickerViewProps extends _PickerViewProps, __PickerViewProps {
-  data: PickerData[] | PickerData[][]
+export interface PickerViewProps extends _PickerViewProps, Omit<__PickerViewProps, 'defaultValue'> {
+  data: PickerColumnItem[] | PickerColumnItem[][]
   style: any
   indicatorStyle?: any
   onChange?: () => void
```

---

### Incident Patch 12: `6c99de7e` (2026-09-20)
**Commit Message**: fix(vite-runner): 小程序页面模板生成时传入页面配置并预生成 base 模板，修复 PageMeta 失效 (#19500)

页面模板先于 base 模板生成，导致：
1. buildPageTemplate 未收到页面配置，平台覆写（如微信小程序）拿不到 enablePageMeta；
2. 覆写读取的 transferComponents 依赖 buildTemplate 填充，此时仍为空。

与 webpack5 编译器（MiniPlugin）行为对齐。fix #16900

**File**: `packages/taro-vite-runner/src/mini/emit.ts` (modified, +6/-3)
```diff
@@ -70,6 +70,9 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
         })
 
         // emit: page
+        // 先生成 base 模板：buildPageTemplate 的平台覆写（如微信小程序的 page-meta）
+        // 依赖 buildTemplate 填充的组件信息，而页面模板先于 base 模板生成
+        const baseTemplate = template.buildTemplate(componentConfig)
         viteCompilerContext.pages.forEach(page => {
           const pageConfig = page.config
 
@@ -88,7 +91,7 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
             const importBaseTemplatePath = promoteRelativePath(path.relative(page.scriptPath, path.join(sourceDir, viteCompilerContext.getTemplatePath(baseTemplateName))))
             generateTemplateFile(this, viteCompilerContext, {
               filePath: page.scriptPath,
-              content: template.buildPageTemplate(importBaseTemplatePath)
+              content: template.buildPageTemplate(importBaseTemplatePath, { content: pageConfig, path: page.name })
             })
           }
 
@@ -107,10 +110,10 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
           })
         }
 
-        // emit: base.xml
+        // emit: base.xml（内容已在生成页面模板前计算，供 buildPageTemplate 覆写读取组件信息）
         generateTemplateFile(this, viteCompilerContext, {
           filePath: baseTemplateName,
-          content: template.buildTemplate(componentConfig)
+          content: baseTemplate
         })
 
         if (template.isUseXS) {
```

---

### Incident Patch 13: `e4bc99bb` (2026-09-20)
**Commit Message**: fix: update plugin filtering logic to match exact command tag (#19464)

Co-authored-by: xuwentao.59 <[REDACTED_EMAIL]>

**File**: `packages/taro-service/src/utils/index.ts` (modified, +2/-2)
```diff
@@ -131,10 +131,10 @@ export function filterGlobalConfig (globalConfig: IProjectConfig, command: strin
     return config
   }
 
-  const RelatedPluginTag = `@jdtaro/plugin-${command}-`
+  const RelatedPluginTag = `@jdtaro/plugin-${command}`
   if (config.plugins?.length) {
     config.plugins = config.plugins.filter(pluginName => {
-      return pluginName.includes(RelatedPluginTag)
+      return pluginName === RelatedPluginTag || pluginName.includes(`${RelatedPluginTag}-`)
     })
   }
 
```

---

### Incident Patch 14: `30ccf422` (2026-08-06)
**Commit Message**: fix(vite-runner): use Component for custom-tab-bar instead of Page in mini program (#19465)

**File**: `packages/taro-vite-runner/src/mini/page.ts` (modified, +7/-2)
```diff
@@ -59,7 +59,10 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
 
         const pageConfig = prettyPrintJson(page.config)
 
-        let instantiatePage = `var inst = Page(createPageConfig(component, '${page.name}', {root:{cn:[]}}, config || {}))`
+        const isCustomTabBar = page.name === 'custom-tab-bar/index'
+        let instantiatePage = isCustomTabBar
+          ? `var inst = Component(createComponentConfig(component, '${page.name}', {root:{cn:[]}}))`
+          : `var inst = Page(createPageConfig(component, '${page.name}', {root:{cn:[]}}, config || {}))`
 
         if (typeof viteCompilerContext.loaderMeta.modifyInstantiate === 'function') {
           instantiatePage = viteCompilerContext.loaderMeta.modifyInstantiate(instantiatePage, 'page')
@@ -88,7 +91,9 @@ export default function (viteCompilerContext: ViteMiniCompilerContext): PluginOp
         })
 
         return [
-          'import { createPageConfig } from "@tarojs/runtime"',
+          isCustomTabBar
+            ? 'import { createComponentConfig } from "@tarojs/runtime"'
+            : 'import { createPageConfig } from "@tarojs/runtime"',
           `import component from "${escapePath(rawId)}"`,
           `var config = ${pageConfig}`,
           page.config.enableShareTimeline ? 'component.enableShareTimeline = true' : '',
```

**File**: `packages/taro-vite-runner/src/utils/compiler/mini.ts` (modified, +11/-0)
```diff
@@ -40,6 +40,7 @@ export class TaroCompilerContext extends CompilerContext<ViteMiniBuildConfig> im
     this.app = this.getApp()
     this.collectNativeComponents(this.app)
     this.pages = this.getPages()
+    this.collectCustomTabBar()
   }
 
   processConfig () {
@@ -89,6 +90,16 @@ export class TaroCompilerContext extends CompilerContext<ViteMiniBuildConfig> im
     return pageMeta
   }
 
+  collectCustomTabBar () {
+    if (!this.app.config.tabBar?.custom) return
+
+    const customTabBarName = 'custom-tab-bar/index'
+    const scriptPath = resolveMainFilePath(path.join(this.sourceDir, customTabBarName), this.frameworkExts)
+    if (!fs.existsSync(scriptPath)) return
+
+    this.pages.push(this.compilePage(customTabBarName))
+  }
+
   resolvePageImportPath (scriptPath: string, importPath: string) {
     const alias = this.taroConfig.alias
     if (isAliasPath(importPath, alias)) {
```

---

### Incident Patch 15: `dd4f0fbd` (2026-07-21)
**Commit Message**: fix(runtime): correct alias after removing event listener (#19459)

Co-authored-by: mengda.6364 <[REDACTED_EMAIL]>

**File**: `packages/taro-runtime/src/dom/element.ts` (modified, +1/-1)
```diff
@@ -386,7 +386,7 @@ export class TaroElement extends TaroNode {
 
     if (sideEffect !== false && !this.isAnyEventBinded() && SPECIAL_NODES.indexOf(name) > -1) {
       const componentsAlias = getComponentsAlias()
-      const value = isHasExtractProp(this) ? `static-${name}` : `pure-${name}`
+      const value = name === VIEW && !isHasExtractProp(this) ? PURE_VIEW : `static-${name}`
       const valueAlias = componentsAlias[value]._num
       this.enqueueUpdate({
         path: `${this._path}.${Shortcuts.NodeName}`,
```

**File**: `packages/taro-runtime/tests/event.spec.ts` (modified, +69/-1)
```diff
@@ -1,8 +1,10 @@
+import { Shortcuts } from '@tarojs/shared'
 import { afterAll, describe, expect, test, vi } from 'vitest'
 
-import { EVENT_CALLBACK_RESULT } from '../src/constants'
+import { EVENT_CALLBACK_RESULT, PURE_VIEW } from '../src/constants'
 import { eventHandler } from '../src/dom/event'
 import * as runtime from '../src/index'
+import { getComponentsAlias } from '../src/utils'
 
 describe('event', () => {
   const document = runtime.document
@@ -121,6 +123,72 @@ describe('event', () => {
     }).not.toThrow()
   })
 
+  test.each([
+    ['text', 'static-text'],
+    ['image', 'static-image']
+  ])('移除 %s 的最后一个事件监听后切换为 %s', (nodeName, aliasName) => {
+    const element = document.createElement(nodeName)
+    const handler = vi.fn()
+    const enqueueUpdate = vi.spyOn(element, 'enqueueUpdate')
+
+    element.addEventListener('tap', handler)
+    enqueueUpdate.mockClear()
+
+    expect(() => element.removeEventListener('tap', handler)).not.toThrow()
+    expect(enqueueUpdate).toHaveBeenCalledOnce()
+    expect(enqueueUpdate).toHaveBeenCalledWith({
+      path: `${element._path}.${Shortcuts.NodeName}`,
+      value: getComponentsAlias()[aliasName]._num
+    })
+  })
+
+  test('移除无提取属性 view 的最后一个事件监听后切换为 pure-view', () => {
+    const view = document.createElement('view')
+    const handler = vi.fn()
+    const enqueueUpdate = vi.spyOn(view, 'enqueueUpdate')
+
+    view.addEventListener('tap', handler)
+    enqueueUpdate.mockClear()
+    view.removeEventListener('tap', handler)
+
+    expect(enqueueUpdate).toHaveBeenCalledOnce()
+    expect(enqueueUpdate).toHaveBeenCalledWith({
+      path: `${view._path}.${Shortcuts.NodeName}`,
+      value: getComponentsAlias()[PURE_VIEW]._num
+    })
+  })
+
+  test('移除有提取属性 view 的最后一个事件监听后切换为 static-view', () => {
+    const view = document.createElement('view')
+    const handler = vi.fn()
+    const enqueueUpdate = vi.spyOn(view, 'enqueueUpdate')
+
+    view.setAttribute('hover-class', 'hover')
+    view.addEventListener('tap', handler)
+    enqueueUpdate.mockClear()
+    view.removeEventListener('tap', handler)
+
+    expect(enqueueUpdate).toHaveBeenCalledOnce()
+    expect(enqueueUpdate).toHaveBeenCalledWith({
+      path: `${view._path}.${Shortcuts.NodeName}`,
+      value: getComponentsAlias()['static-view']._num
+    })
+  })
+
+  test('移除其中一个事件监听时不会切换节点模板', () => {
+    const text = document.createElement('text')
+    const handler = vi.fn()
+    const anotherHandler = vi.fn()
+    const enqueueUpdate = vi.spyOn(text, 'enqueueUpdate')
+
+    text.addEventListener('tap', handler)
+    text.addEventListener('tap', anotherHandler)
+    enqueueUpdate.mockClear()
+    text.removeEventListener('tap', handler)
+
+    expect(enqueueUpdate).not.toHaveBeenCalled()
+  })
+
   test('可以阻止冒泡', () => {
     const container = document.createElement('container')
     const div = document.createElement('div')
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
