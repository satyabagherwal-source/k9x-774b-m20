# Forensic Learning Record (Deep Inspection): sqlpage/SQLPage

> **Canonical Artifact**: `07_PROJECT_LEARNING/sqlpage-sqlpage-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sqlpage/SQLPage](https://github.com/sqlpage/SQLPage))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:20:10.953Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sqlpage/SQLPage`
- **Description**: Fast SQL-only data application builder. Automatically build a UI on top of SQL queries. 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2568 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/SQLPage developer user interface/website/js/code-editor.js`
```
const cdn = "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/";

function on_monaco_load() {
  // Create an editor div, display it after the '#code-editor' textarea, hide the textarea, and create a Monaco editor in the div with the contents of the textarea
  // When the form is submitted, set the value of the textarea to the value of the Monaco editor
  const textarea = document.getElementById("code-editor");
  const editorDiv = document.createElement("div");
  editorDiv.style.width = "100%";
  editorDiv.style.height = "700px";
  textarea.parentNode.insertBefore(editorDiv, textarea.nextSibling);
  const monacoConfig = {
    value: textarea.value,
    language: "sql",
  };

  self.MonacoEnvironment = {
    baseUrl: `${cdn}min/`,
  };
  const editor = monaco.editor.create(editorDiv, monacoConfig);
  textarea.style.display = "none";
  const form = textarea.form;
  form.addEventListener("submit", () => {
    textarea.value = editor.getValue();
  });
}

function set_require_config() {
  require.config({ paths: { vs: `${cdn}min/vs` } });
  require(["vs/editor/editor.main"], on_monaco_load);
}
const loader_script = document.createElement("script");
loader_script.src = `${cdn}min/vs/loader.js`;
loader_script.onload = set_require_config;
document.head.appendChild(loader_script);

```

### Core Architecture Module: `examples/official-site/assets/highlightjs-launch.js`
```
hljs.highlightAll();

```

### Core Architecture Module: `examples/official-site/pgconf/script.js`
```


	var SLConfig = {"current_user":{"id":2571881,"username":"jegac15681","name":null,"description":null,"thumbnail_url":"https://www.gravatar.com/avatar/2bfb8d6543c8b1813f8df1821e3d02fe?s=140\u0026d=https%3A%2F%2Fstatic.slid.es%2Fimages%2Fdefault-profile-picture.png","account_type":"default","team_id":null,"settings":{"id":57170066,"present_controls":true,"present_upsizing":true,"present_pointer":true,"present_notes":true,"default_deck_tag_id":null,"editor_grid":true,"editor_grid_on_top":false,"editor_snap":true,"editor_fixed_notes":false,"developer_mode":true,"speaker_layout":null,"speaker_theme":null,"phone_number":null,"phone_country_code":null,"media_sources":null,"export_controls":null,"export_slide_number":null,"export_slide_notes":null,"export_separate_fragments":null,"auto_animate_tutorial_completed":true,"profile_sorting":null,"profile_layout":null},"email":"jegac15681@rdluxe.com","notify_on_receipt":true,"billing_address":null,"billing_vat_id":null,"editor_tutorial_completed":true,"manually_upgraded":false,"deck_user_editor_limit":null,"storage_used":7309625,"storage_limit":262144000,"image_upload_limit":10485760,"video_upload_limit":104857600},"deck":{"id":3057920,"slug":"sqlpage-pgconf","title":"SQLPage","description":"","width":960,"height":700,"margin":0.05,"visibility":"all","published_at":"2023-11-12T00:00:11.375Z","sanitize_messages":null,"thumbnail_url":"https://s3.amazonaws.com/media-p.slid.es/thumbnails/c9640053c48e6426e3a741cce978120f/thumb.jpg?1702287516","view_count":0,"user":{"id":2571881,"username":"jegac15681","name":null,"description":null,"thumbnail_url":"https://www.gravatar.com/avatar/2bfb8d6543c8b1813f8df1821e3d02fe?s=140\u0026d=https%3A%2F%2Fstatic.slid.es%2Fimages%2Fdefault-profile-picture.png","account_type":"default","team_id":null,"settings":{"id":57170066,"present_controls":true,"present_upsizing":true,"present_pointer":true,"present_notes":true,"default_deck_tag_id":null}},"background_transition":"slide","transition":"slide","theme_id":null,"theme_font":"montserrat","theme_color":"black-blue","auto_slide_interval":0,"comments_enabled":false,"forking_enabled":true,"rolling_links":false,"center":false,"shuffle":false,"should_loop":false,"share_notes":false,"slide_number":false,"slide_count":73,"rtl":false,"version":2,"collaborative":false,"deck_user_editor_limit":null,"data_updated_at":1702502378510,"font_typekit":null,"font_google":null,"time_limit":null,"navigation_mode":"default","upsizing_enabled":true,"language":"en","notes":{}},"user":{"id":2571881,"username":"jegac15681","name":null,"description":null,"thumbnail_url":"https://www.gravatar.com/avatar/2bfb8d6543c8b1813f8df1821e3d02fe?s=140\u0026d=https%3A%2F%2Fstatic.slid.es%2Fimages%2Fdefault-profile-picture.png","account_type":"default","team_id":null,"settings":{"id":57170066,"present_controls":true,"present_upsizing":true,"present_pointer":true,"present_notes":true,"default_deck_tag_id":null}}};


		
			!function(e){function t(e,t,r,n,i){this._listener=t,this._isOnce=r,this.context=n,this._signal=e,this._priority=i||0}function r(e,t){if("function"!=typeof e)throw new Error("listener is a required param of {fn}() and should be a Function.".replace("{fn}",t))}function n(){this._bindings=[],this._prevParams=null;var e=this;this.dispatch=function(){n.prototype.dispatch.apply(e,arguments)}}t.prototype={active:!0,params:null,execute:function(e){var t,r;return this.active&&this._listener&&(r=this.params?this.params.concat(e):e,t=this._listener.apply(this.context,r),this._isOnce&&this.detach()),t},detach:function(){return this.isBound()?this._signal.remove(this._listener,this.context):null},isBound:function(){return!!this._signal&&!!this._listener},isOnce:function(){return this._isOnce},getListener:function(){return this._listener},getSignal:function(){return this._signal},_destroy:function(){delete this._signal,delete this._listener,delete this.context},toString:function(){return"[SignalBinding isOnce:"+this._isOnce+", isBound:"+this.isBound()+", active:"+this.active+"]"}},n.prototype={VERSION:"1.0.0",memorize:!1,_shouldPropagate:!0,active:!0,_registerListener:function(e,r,n,i){var a,o=this._indexOfListener(e,n);if(-1!==o){if((a=this._bindings[o]).isOnce()!==r)throw new Error("You cannot add"+(r?"":"Once")+"() then add"+(r?"Once":"")+"() the same listener without removing the relationship first.")}else a=new t(this,e,r,n,i),this._addBinding(a);return this.memorize&&this._prevParams&&a.execute(this._prevParams),a},_addBinding:function(e){var t=this._bindings.length;do{--t}while(this._bindings[t]&&e._priority<=this._bindings[t]._priority);this._bindings.splice(t+1,0,e)},_indexOfListener:function(e,t){for(var r,n=this._bindings.length;n--;)if((r=this._bindings[n])._listener===e&&r.context===t)return n;return-1},has:function(e,t){return-1!==this._indexOfListener(e,t)},add:function(e,t,n){return r(e,"add"),this._registerListener(e,!1,t,n)},addOnce:function(e,t,n){return r(e,"addOnce"),this._registerListener(e,!0,t,n)},remove:function(e,t){if(!this._bindings)return null;r(e,"remove");var n=this._indexOfListener(e,t);return-1!==n&&(this._bindings[n]._destroy(),this._bindings.splice(n,1)),e},removeAll:function(){for(var e=this._bindings.length;e--;)this._bindings[e]._destroy();this._bindings.length=0},getNumListeners:function(){return this._bindings.length},halt:function(){this._shouldPropagate=!1},dispatch:function(){if(this.active){var e,t=Array.prototype.slice.call(arguments),r=this._bindings.length;if(this.memorize&&(this._prevParams=t),r){e=this._bindings.slice(),this._shouldPropagate=!0;do{r--}while(e[r]&&this._shouldPropagate&&!1!==e[r].execute(t))}}},forget:function(){this._prevParams=null},dispose:function(){this.removeAll(),delete this._bindings,delete this._prevParams},toString:function(){return"[Signal active:"+this.active+" numListeners:"+this.getNumListeners()+"]"}};var i=n;i.Signal=n,"function"==typeof define&&define.amd?define(function(){return i}):"undefined"!=typeof module&&module.exports?module.exports=i:e.signals=i}(this),function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.katex=t():e.katex=t()}("undefined"!=typeof self?self:this,function(){return function(){"use strict";function e(e){if(e["default"])return e["default"];var t=e.type,r=Array.isArray(t)?t[0]:t;if("string"!=typeof r)return r["enum"][0];switch(r){case"boolean":return!1;case"string":return"";case"number":return 0;case"object":return{}}}function t(e){for(var t=0;t<Y.length;t+=2)if(e>=Y[t]&&e<=Y[t+1])return!0;return!1}function r(e,r,n){if(!Z[r])throw new Error("Font metrics not found for font: "+r+".");var i=e.charCodeAt(0),a=Z[r][i];if(!a&&e[0]in Q&&(i=Q[e[0]].charCodeAt(0),a=Z[r][i]),a||"text"!==n||t(i)&&(a=Z[r][77]),a)return{depth:a[0],height:a[1],italic:a[2],skew:a[3],width:a[4]}}function n(e){if(e instanceof be)return e;throw new Error("Expected symbolNode but got "+String(e)+".")}function i(e,t,r,n,i,a){Me[e][i]={font:t,group:r,replace:n},a&&n&&(Me[e][n]=Me[e][i])}function a(e){for(var t=e.type,r=e.names,n=e.props,i=e.handler,a=e.htmlBuilder,o=e.mathmlBuilder,s={type:t,numArgs:n.numArgs,argTypes:n.argTypes,allowedInArgument:!!n.allowedInArgument,allowedInText:!!n.allowedInText,allowedInMath:void 0===n.allowedInMath||n.allowedInMath,numOptionalArgs:n.numOptionalArgs||0,infix:!!n.infix,primitive:!!n.primitive,handler:i},l=0;l<r.length;++l)At[r[l]]=s;t&&(a&&(Mt[t]=a),o&&(zt[t]=o))}function o(e){a({type:e.type,names:[],props:{numArgs:0},handler:function(){throw new Error("Should never be called.")},htmlBuilder:e.htmlBuilder,mathmlBuilder:e.mathmlBuilder})}function s(e,t){var r=Bt(["base"],e,t),n=Bt(["strut"]);return n.style.height=ce(r.height+r.depth),r.depth&&(n.style.verticalAlign=ce(-r.depth)),r.children.unshift(n),r}function l(e,t){var r=null;1===e.length&&"tag"===e[0].type&&(r=e[0].tag,e=e[0].body);var n,i=It(e,t,"root");2===i.length&&i[1].hasClass("tag")&&(n=i.pop());fo
```

### Core Architecture Module: `examples/rich-text-editor/rich_text_editor.js`
```
import { fromMarkdown } from "https://esm.sh/mdast-util-from-markdown@2.0.0";
import { toMarkdown as mdastUtilToMarkdown } from "https://esm.sh/mdast-util-to-markdown@2.1.2";
import Quill from "https://esm.sh/quill@2.0.3";

/**
 * @typedef {Object} QuillAttributes
 * @property {boolean} [bold] - Whether the text is bold.
 * @property {boolean} [italic] - Whether the text is italic.
 * @property {string} [link] - URL if the text is a link.
 * @property {number} [header] - Header level (1-3).
 * @property {string} [list] - List type ('ordered' or 'bullet').
 * @property {boolean} [blockquote] - Whether the text is in a blockquote.
 * @property {string} [code-block] - Code language if in a code block.
 * @property {string} [alt] - Alt text for images.
 */

/**
 * @typedef {Object} QuillOperation
 * @property {string|Object} [insert] - Content to insert (string or object with image URL).
 * @property {number} [delete] - Number of characters to delete.
 * @property {number} [retain] - Number of characters to retain.
 * @property {QuillAttributes} [attributes] - Formatting attributes.
 */

/**
 * @typedef {Object} QuillDelta
 * @property {Array<QuillOperation>} ops - Array of operations in the delta.
 */

/**
 * Converts Quill Delta object to a Markdown string using mdast.
 * @param {QuillDelta} delta - Quill Delta object (https://quilljs.com/docs/delta/).
 * @returns {string} - Markdown representation.
 */
function deltaToMarkdown(delta) {
  const mdastTree = deltaToMdast(delta);
  const options = {
    bullet: "*",
    listItemIndent: "one",
    handlers: {},
    unknownHandler: (node) => {
      console.warn(`Unknown node type encountered: ${node.type}`, node);
      return false;
    },
  };
  return mdastUtilToMarkdown(mdastTree, options);
}

/**
 * Creates a div to replace the textarea and prepares it for Quill.
 * @param {HTMLTextAreaElement} textarea - The original textarea.
 * @returns {HTMLDivElement} - The div element created for the Quill editor.
 */
function createAndReplaceTextarea(textarea) {
  const editorDiv = document.createElement("div");
  editorDiv.className = "mb-3";
  editorDiv.style.height = "250px";

  const label = textarea.closest("label");
  if (!label) {
    textarea.parentNode.insertBefore(editorDiv, textarea);
  } else {
    label.parentNode.insertBefore(editorDiv, label.nextSibling);
  }
  // Hide the original textarea, but keep it focusable for validation
  textarea.style = "transform: scale(0); position: absolute; opacity: 0;";
  return editorDiv;
}

/**
 * Returns the toolbar options array configured for Markdown compatibility.
 * @returns {Array<Array<any>>} - Quill toolbar options.
 */
function getMarkdownToolbarOptions() {
  return [
    [{ header: 1 }, { header: 2 }, { header: 3 }],
    ["bold", "italic", "code"],
    ["link", "image", "blockquote", "code-block"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ];
}

/**
 * Initializes a Quill editor instance on a given div.
 * @param {HTMLDivElement} editorDiv - The div element for the editor.
 * @param {Array<Array<any>>} toolbarOptions - The toolbar configuration.
 * @param {string} initialValue - The initial content for the editor.
 * @returns {Quill} - The initialized Quill instance.
 */
function initializeQuillEditor(
  editorDiv,
  toolbarOptions,
  initialValue,
  readOnly,
) {
  const quill = new Quill(editorDiv, {
    theme: "snow",
    modules: {
      toolbar: toolbarOptions,
    },
    readOnly: readOnly,
    formats: [
      "bold",
      "italic",
      "link",
      "header",
      "list",
      "blockquote",
      "code",
      "code-block",
      "image",
    ],
  });
  if (initialValue) {
    const delta = markdownToDelta(initialValue);
    quill.setContents(delta);
  }
  return quill;
}

/**
 * Converts Markdown string to a Quill Delta object.
 * @param {string} markdown - The markdown string to convert.
 * @returns {QuillDelta} - Quill Delta representation.
 */
function markdownToDelta(markdown) {
  try {
    const mdastTree = fromMarkdown(markdown);
    return mdastToDelta(mdastTree);
  } catch (error) {
    console.error("Error parsing markdown:", error);
    return { ops: [{ insert: markdown }] };
  }
}

/**
 * Converts MDAST to Quill Delta.
 * @param {MdastNode} tree - The MDAST tree to convert.
 * @returns {QuillDelta} - Quill Delta representation.
 */
function mdastToDelta(tree) {
  const delta = { ops: [] };
  if (!tree?.children) return delta;

  for (const node of tree.children) {
    traverseMdastNode(node, delta);
  }

  return delta;
}

/**
 * Recursively traverse MDAST nodes and convert to Delta operations.
 * @param {MdastNode} node - The MDAST node to process.
 * @param {QuillDelta} delta - The Delta object to append operations to.
 * @param {QuillAttributes} [attributes={}] - The current attributes to apply.
 */
function traverseMdastNode(node, delta, attributes = {}) {
  if (!node) return;

  switch (node.type) {
    case "root":
      for (const child of node.children || []) {
        traverseMdastNode(child, delta);
      }
      break;

    case "paragraph": {
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, attributes);
      }
      const pLineAttributes = {};
      if (attributes.blockquote) {
        pLineAttributes.blockquote = true;
      }
      delta.ops.push({ insert: "\n", attributes: pLineAttributes });
      break;
    }

    case "heading": {
      const headingContentAttributes = { ...attributes, header: node.depth };
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, headingContentAttributes);
      }
      const headingLineAttributes = { header: node.depth };
      if (attributes.blockquote) {
        headingLineAttributes.blockquote = true;
      }
      delta.ops.push({ insert: "\n", attributes: headingLineAttributes });
      break;
    }

    case "text":
      delta.ops.push({ insert: node.value || "", attributes });
      break;

    case "strong":
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, { ...attributes, bold: true });
      }
      break;

    case "emphasis":
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, { ...attributes, italic: true });
      }
      break;

    case "link":
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, { ...attributes, link: node.url });
      }
      break;

    case "image":
      delta.ops.push({
        insert: { image: node.url },
        attributes: { alt: node.alt || "" },
      });
      break;

    case "list":
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, {
          ...attributes,
          list: node.ordered ? "ordered" : "bullet",
        });
      }
      break;

    case "listItem": {
      const { list, ...listItemChildrenAttributes } = attributes;

      for (const child of node.children || []) {
        traverseMdastNode(child, delta, listItemChildrenAttributes);
      }

      // Attributes for the listItem's newline (e.g., { list: 'bullet', blockquote: true })
      // are in `attributes` passed to this `listItem` case.
      {
        const lastOp = delta.ops[delta.ops.length - 1];
        if (lastOp && lastOp.insert === "\n") {
          lastOp.attributes = { ...lastOp.attributes, ...attributes };
        } else {
          delta.ops.push({ insert: "\n", attributes });
        }
      }
      break;
    }

    case "blockquote":
      for (const child of node.children || []) {
        traverseMdastNode(child, delta, { ...attributes, blockquote: true });
      }
      break;

    case "code": {
      // mdast 'code' is a block
      const codeBlockLineFormat = { "code-block": node.lang || true };
      if (attributes.blockquote) {
        codeBlockLineFormat.blockquote = true;
      }

      const textInCodeAttributes = {};
      if (attributes.blockquote) {
        // Text lines also get blockqu
```

### Core Architecture Module: `examples/using react and other custom scripts and styles/my_react_component.js`
```
// Here we are using React and ReactDOM directly, but this file could be a compiled
// version of a React component written in JSX.

function _MyComponent({ greeting_name }) {
  const [count, setCount] = React.useState(0);
  return React.createElement(
    "button",
    {
      type: "button",
      onClick: async () => {
        const r = await fetch("/api.sql");
        const { total_clicks } = await r.json();
        setCount(total_clicks);
      },
      className: "btn btn-primary",
    },
    count === 0
      ? `Hello, ${greeting_name}. Click me !`
      : `You clicked me ${count} times!`,
  );
}

for (const container of document.getElementsByClassName("react_component")) {
  const root = ReactDOM.createRoot(container);
  const props = JSON.parse(container.dataset.props);
  root.render(
    React.createElement(window[props.react_component_name], props, null),
  );
}

```

### Core Architecture Module: `frontend/src/apexcharts.ts`
```
import type { ApexOptions } from "apexcharts";
import ApexCharts from "apexcharts";
import {
  align_series_for,
  type ChartPoint,
  type ChartSeries,
  type Series,
  xaxis_type_for,
} from "./chart_series.ts";
import { add_init_fn } from "./init.ts";

type DataPoint = {
  name: string;
  x: string | number | null;
  y: string | number | number[] | null;
  color?: string | null;
  z?: string | number | null;
  link?: string;
};

type TooltipArgs = {
  seriesIndex: number;
  dataPointIndex: number;
  // biome-ignore lint/suspicious/noExplicitAny: ApexCharts leaves its tooltip context untyped
  w: any;
};

function formatTooltipX(
  value: string | number | null,
  link: string | undefined,
) {
  if (!link || !value) return value;
  const anchor = document.createElement("a");
  anchor.setAttribute("href", link);
  anchor.textContent = String(value);
  return anchor.outerHTML;
}

const sqlpage_chart = (() => {
  function sqlpage_chart() {
    const charts = document.querySelectorAll<HTMLElement>(
      "[data-pre-init=chart]",
    );
    for (const c of charts) {
      try {
        build_sqlpage_chart(c);
      } catch (e) {
        console.error(e);
      }
    }
  }

  const tblrColors = [
    ["blue", "#1c7ed6", "#339af0"],
    ["red", "#f03e3e", "#ff6b6b"],
    ["green", "#37b24d", "#51cf66"],
    ["pink", "#d6336c", "#f06595"],
    ["purple", "#ae3ec9", "#cc5de8"],
    ["orange", "#f76707", "#ff922b"],
    ["cyan", "#1098ad", "#22b8cf"],
    ["teal", "#0ca678", "#20c997"],
    ["yellow", "#f59f00", "#fcc419"],
    ["indigo", "#4263eb", "#5c7cfa"],
    ["lime", "#74b816", "#94d82d"],
    ["azure", "#339af0", "#339af0"],
    ["gray", "#495057", "#adb5bd"],
    ["black", "#000000", "#000000"],
    ["white", "#ffffff", "#f8f9fa"],
  ];
  const colorNames = new Map(
    tblrColors.flatMap(([name, dark, light]): [string, string][] => [
      [name, dark],
      [`${name}-lt`, light],
    ]),
  );
  const isDarkTheme = document.body?.dataset?.bsTheme === "dark";

  const STACKABLE_CHART_TYPES = ["line", "area", "bar"];
  const STROKE_WIDTHS = new Map([
    ["area", 3],
    ["line", 2],
  ]);
  const APEXCHARTS_TYPE_ALIASES = new Map([["column", "bar"]]);

  const referenceColor = colorNames.get(isDarkTheme ? "gray-lt" : "gray");

  type ReferenceLine = Record<
    "xline" | "xline_end" | "yline" | "yline_end" | "label" | "color",
    string | number | null
  >;

  const named_color = (name: unknown): string | undefined =>
    typeof name === "string" ? colorNames.get(name) : undefined;

  const reference_color = (name: string | number | null) =>
    named_color(name) || referenceColor;

  function reference_lines(
    rows: ReferenceLine[],
    column: "x" | "y",
    axis: "x" | "y",
    to_axis_value: (value: string | number) => unknown,
  ): object[] {
    const on_axis = (value: string | number | null) => {
      if (value == null) return null;
      const placed = to_axis_value(value);
      return Number.isNaN(placed) ? null : placed;
    };
    return rows.flatMap((row) => {
      const from = on_axis(row[`${column}line`]);
      if (from == null) return [];
      const color = reference_color(row.color);
      return [
        {
          [axis]: from,
          [`${axis}2`]: on_axis(row[`${column}line_end`]),
          borderColor: color,
          fillColor: color,
          strokeDashArray: 4,
          label: {
            text: row.label,
            orientation: column === "y" ? "horizontal" : "vertical",
            borderColor: color,
            style: { background: color, color: isDarkTheme ? "#000" : "#fff" },
          },
        },
      ];
    });
  }

  function build_sqlpage_chart(c: HTMLElement) {
    const [data_element] = c.getElementsByTagName("data");
    const data = JSON.parse(data_element.textContent);
    const chartContainer = c.querySelector(".chart") as HTMLElement;
    chartContainer.innerHTML = "";
    const is_timeseries = !!data.time;
    const chart_type =
      APEXCHARTS_TYPE_ALIASES.get(data.type) || data.type || "line";
    const is_stacked =
      !!data.stacked && STACKABLE_CHART_TYPES.includes(chart_type);
    const points: DataPoint[] = data.points
      .filter(Array.isArray)
      .map(([name, x, y, color, z, link]) => ({
        name,
        x,
        y,
        color,
        z,
        link: link ?? undefined,
      }));
    const reference_rows: ReferenceLine[] = data.points.filter(
      (row: unknown) => !Array.isArray(row),
    );
    const series_map: Series = new Map();
    for (const { name, x: old_x, y: old_y, color, z, link } of points) {
      const point_series: ChartSeries = series_map.get(name) ?? {
        name,
        data: [],
      };
      series_map.set(name, point_series);
      let x: string | number | Date | null = old_x;
      let y = old_y;
      if (is_timeseries) {
        if (typeof x === "number") x = new Date(x * 1000);
        else if (chart_type === "rangeBar" && Array.isArray(y))
          y = y.map((y) => new Date(y).getTime());
        else x = new Date((x ?? 0) as string | number);
      }
      point_series.data.push({
        x,
        y,
        z,
        link,
        fillColor: named_color(color),
      } as ChartPoint);
    }
    if (data.xmin == null) data.xmin = undefined;
    if (data.xmax == null) data.xmax = undefined;
    if (data.ymin == null) data.ymin = undefined;
    if (data.ymax == null) data.ymax = undefined;

    const palette = [
      ...data.colors.map(named_color).filter((c) => c !== undefined),
      ...tblrColors.map(([_, dark, light]) => (isDarkTheme ? dark : light)),
      ...tblrColors.map(([_, dark, light]) => (isDarkTheme ? light : dark)),
    ];
    let colors = palette;

    const chart_series = [...series_map.values()];
    const xaxis_type = xaxis_type_for(
      chart_series,
      chart_type,
      is_timeseries,
      !!data.horizontal,
    );

    const labels =
      chart_type === "pie" ? points.map(({ name, x }) => x || name) : undefined;
    const series =
      chart_type === "pie"
        ? points.map(({ y }) => Number.parseFloat(String(y)))
        : chart_series.length > 1
          ? align_series_for(chart_series, chart_type, is_stacked)
          : chart_series;
    if (chart_type === "pie")
      colors = points.map(
        ({ color }, i) => named_color(color) || palette[i % palette.length],
      );

    const to_timestamp = (v) =>
      (typeof v === "number" ? new Date(v * 1000) : new Date(v)).getTime();
    const dates_are_values = is_timeseries && chart_type === "rangeBar";
    const to_value = dates_are_values ? to_timestamp : Number;
    const to_category =
      is_timeseries && !dates_are_values ? to_timestamp : (v) => v;
    const inverted =
      chart_type === "rangeBar" || (chart_type === "bar" && !!data.horizontal);
    const value_axis = inverted ? "x" : "y";
    const category_axis = inverted ? "y" : "x";
    const has_point_links = points.some((point) => point.link);
    const text_x_values = chart_series.every(({ data }) =>
      data.every(({ x }) => x == null || typeof x === "string"),
    );
    const options = {
      annotations: {
        [`${value_axis}axis`]: reference_lines(
          reference_rows,
          "y",
          value_axis,
          to_value,
        ),
        [`${category_axis}axis`]: reference_lines(
          reference_rows,
          "x",
          category_axis,
          to_category,
        ),
      },
      chart: {
        type: chart_type,
        fontFamily: "inherit",
        background: "transparent",
        parentHeightOffset: 0,
        height: chartContainer.style.height,
        stacked: is_stacked,
        toolbar: {
          show: !!data.toolbar,
        },
        animations: {
          enabled: false,
        },
        zoom: {
          enabled: false,
        },
        events: {
          dataPointSelection: (_event, _chart, args) => {
            const link = pointLink(args, points);
            if (link) window.location.assign(link);
     
```

### Core Architecture Module: `frontend/src/chart_series.ts`
```
export type XValue = number | string | Date;
export type ChartPoint = {
  x: XValue;
  y: number | string | number[] | null;
  z?: number;
  fillColor?: string;
  link?: string;
};
export type ChartSeries = { name: string; data: ChartPoint[] };
export type Series = Map<string, ChartSeries>;

const NUMERIC_X_CHART_TYPES = ["line", "area", "bar", "scatter", "bubble"];

const Y_WHEN_A_SERIES_SKIPS_A_LABEL = new Map<string, number | null>([
  ["bar", 0],
  ["line", null],
  ["area", null],
  ["scatter", null],
  ["bubble", null],
  ["heatmap", null],
]);

/** equal x values share a key */
const x_key = (x: XValue): number | string =>
  x instanceof Date ? x.getTime() : x;

const x_is_text = (series: ChartSeries[]) =>
  typeof series[0]?.data?.[0]?.x === "string";

export function xaxis_type_for(
  series: ChartSeries[],
  chart_type: string,
  is_timeseries: boolean,
  is_horizontal: boolean,
) {
  if (is_timeseries) return "datetime";
  if (x_is_text(series)) return "category";
  if (
    typeof series[0]?.data?.[0]?.x === "number" &&
    !is_horizontal &&
    NUMERIC_X_CHART_TYPES.includes(chart_type)
  )
    return "numeric";
  return undefined;
}

/**
 * @returns every x the series hold, in their own order where they agree and in
 * ascending order where they diverge
 */
export function merged_x_values(series: ChartSeries[]): XValue[] {
  const unread = series.map(({ data }) => data.map(({ x }) => x));
  const merged = new Map();
  while (unread.some((xs) => xs.length > 0)) {
    const with_lowest_x = unread
      .filter((xs) => xs.length > 0)
      .reduce((a, b) => (b[0] < a[0] ? b : a));
    const x = with_lowest_x.shift() as XValue;
    merged.set(x_key(x), x);
  }
  return [...merged.values()];
}

/**
 * ApexCharts pairs points across series by index rather than by x, so a
 * series that skips an x lands on the wrong one. Give every series the same
 * amount of x values.
 *
 * @param y_when_missing what a series with no value at an x is worth there:
 *   zero to add nothing to a stack, null to leave a gap.
 */
export function align_series(
  series: ChartSeries[],
  y_when_missing: number | null,
): ChartSeries[] {
  const all_x = merged_x_values(series);
  return series.map(({ name, data }) => {
    const by_x = new Map(data.map((point) => [x_key(point.x), point]));
    return {
      name,
      data: all_x.map((x) => {
        const point = by_x.get(x_key(x));
        return { ...point, x, y: point?.y ?? y_when_missing };
      }),
    };
  });
}

export function align_series_for(
  series: ChartSeries[],
  chart_type: string,
  is_stacked: boolean,
): ChartSeries[] {
  if (is_stacked) return align_series(series, 0);
  const y_when_missing = Y_WHEN_A_SERIES_SKIPS_A_LABEL.get(chart_type);
  if (x_is_text(series) && y_when_missing !== undefined)
    return align_series(series, y_when_missing);
  return series;
}

```

### Core Architecture Module: `frontend/src/globals.d.ts`
```
// Names the browser bundle relies on at runtime rather than through an import:
// libraries loaded on demand, and what a page may provide for our scripts.

/**
 * A library this project ships no type definitions for. Saying `unknown`
 * instead would only move the guesswork to a cast at every call site.
 */
// biome-ignore lint/suspicious/noExplicitAny: that is what an untyped library is
type Untyped = any;

/** Leaflet, loaded from a CDN by sqlpage_map when a page holds a map. */
declare const L: Untyped;

interface Window {
  /** Every chart rendered on the page, in the order they were built. */
  charts?: unknown[];
  /** A Bootstrap a page loaded for itself, preferred over the bundled copy. */
  bootstrap?: typeof import("@tabler/core").bootstrap;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1494** (2026-09-24): **Stacked BAR chart inside html component doesn't show bars**
  *Symptoms*: ### Introduction  In 0.46.2 (and 0.46.3), stacked bar chart works just fine when it is simply referred to. However, when this component is inside an HTML component (simple `div class="row"`), the time parsing on x label is wrong, it adds chart title as an additional entry into the legend and most importantly, doesn't draw any graphs. Changing the chart type to LINE or AREA seems to draw the values, but also adds a accumulated entry of all values to the end of the chart under the series named as chart title.  It works properly till 0.46.1 (well, except for the chart title series). This chart title series wasn't happening before, but I don't recall in which old version it had worked. I tested backwards up to v0.45.0  and gave up.  It is not a priority issue, but found it very interesting! My usecase is to run [dynamic sql charts side by side](https://github.com/vsbabu/xp/blob/main/r_net_chart_by_category.sql). For now, I can simply remove covering HTML element and let charts display one below another.  ### To Reproduce  Use 0.46.2 or 0.46.3 binary. Use the given sql  (moved all the way down for brevity here) in a file and navigate to that. Edit the sql to comment out first line and last line (for HTML component) and compare.  ### Actual behavior There is no error anywhere. Screenshots are below.  ### Screenshots #### v0.46.3 With HTML <img width="976" height="556" alt="Image" src="https://github.com/user-attachments/assets/966f4ec4-215f-4fba-9e41-c5d7540da1c1" /> Without HTML <
  **Post-Mortem & Fix Analysis**:
  > Hi !  You are missing the component selection when trying to set html.  ```sql SELECT 'html' AS component, '</div>' AS html; ```  Without that, SQLPage interprets the closing statement as another **chart data row**:  ```json ["Progression", null, null] ```  And by the way, I'd recommend using the card component, rather than standalone div opening and closing tags: that's brittle.
  > Hi @lovasoa ,  Thanks a lot! Especially for the explanation.  That was a silly mistake on my part. Card component doesn't work for me since I setup a temporary table in the beginning of my dashboard session and have to recreate these for embedded chart sqls because of separate http sessions being used for those ( #1339 )

- **Issue #1481** (2026-09-24): **SQL Server: NULL variables are bound with length 1 since v0.46, so ISNULL($var, 'default') returns 'd'**
  *Symptoms*: ### Introduction  Since v0.46 (#1397), variables are sent to SQL Server without the former `CAST(@p AS VARCHAR(MAX))`. When a variable is NULL, the parameter appears to be typed as a 1-character string. T-SQL `ISNULL(a, b)` returns the type of `a`, so the default value is silently truncated to its first character. `ISNULL($param, default)` is the idiomatic T-SQL way to default an optional parameter (~1,250 occurrences in our app). Besides runtime errors, it silently changes logic: `ISNULL($user_id, 'GUEST') != 'GUEST'` becomes `'G' != 'GUEST'`, which is true for anonymous users.  ### To Reproduce  ```sql SELECT 'text' AS component,   'isnull=[' + ISNULL($missing, 'hello') + '] coalesce=[' + COALESCE($missing, 'hello')   + '] len=' + CAST(LEN(ISNULL($missing, 'hello')) AS varchar(10)) AS contents; ``` ```sql SELECT 'text' AS component, CONVERT(varchar(30), ISNULL($missing, GETDATE()), 121) AS contents; ```  ### Actual behavior  - first query: `isnull=[h] coalesce=[hello] len=1` - second query: `s` - in a real page, `WHERE t.ts BETWEEN ISNULL(:date_from, DATEADD(HOUR, -12, GETDATE())) AND ...`   fails with `Conversion failed when converting date and/or time from character string.`  ### Expected behavior  Same as v0.44.1: `isnull=[hello] coalesce=[hello] len=5`, and the current date for the second query.  ### Version information   - OS: Windows 11 (official release binary)  - Database: Microsoft SQL Server <version>  - SQLPage Version: v0.46.3 (introduced in v0.46 by #1397, stil
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report ! I'll fix it for the next release.
  > Thanks so much! Maximum efficiency!

- **Issue #1480** (2026-09-23): **SQL Server: JSON_OBJECT('key':value) fails with "Named and wildcard function arguments are not supported" since v0.45**
  *Symptoms*: ### Introduction  Since v0.45, SQL Server's `JSON_OBJECT` written with the native T-SQL `'key':value` syntax is rejected at parse time when it is a top-level selected expression (including `SET x = ...`) or an argument of a `sqlpage.*` function. On SQL Server `'key':value` is the [only accepted syntax](https://learn.microsoft.com/sql/t-sql/functions/json-object-transact-sql), so the documented `sqlpage.run_sql('file.sql', json_object(...))` pattern can no longer be written on MSSQL. In our application ~56 files are affected. It worked on v0.44.1.  ### To Reproduce  Each of these files fails on its own:  ```sql -- a.sql SELECT 'text' AS component, json_object('a':'b') AS contents; ``` ```sql -- b.sql SET x = json_object('a':'b'); SELECT 'text' AS component, $x AS contents; ``` ```sql -- c.sql  (frag.sql: SELECT 'text' AS component, $a AS contents;) SELECT 'dynamic' AS component, sqlpage.run_sql('frag.sql', json_object('a':'b')) AS properties; ```  ### Actual behavior  ``` Named and wildcard function arguments are not supported a.sql contains a syntax error preventing SQLPage from parsing and preparing its SQL statements. ```  ### Expected behavior  Same as v0.44.1: the object is built (by SQL Server or by SQLPage's emulation) and `c.sql` renders `b`.  ### Version information   - OS: Windows 11 (official release binary)  - Database: Microsoft SQL Server <version>  - SQLPage Version: v0.46.3 (also present in v0.45.0 and on `main`); last working: v0.44.1  ### Additional context  
  **Post-Mortem & Fix Analysis**:
  > Working on this in priority
  > @Mayo-bitdrop thank you very much for the report ! The fix is merged, you can get it on docker as lovasoa/sqlpage:main now, or wait for the 0.47 release
  > Thanks to you for your valuable work!

- **Issue #1466** (2026-09-17): **OIDC ON ZOHO**
  *Symptoms*: ### Introduction  Hello, i have a problem with the oidc provider Zoho I created correctly the application and configured Sqlpage. when i try to open the site, the url for call the oidc provider contains a nonce with argon2.  I think that the issue is caused by the nonce parameter generated by sqlpage. this:nonce=$argon2id$v=19$m=8,t=1,p=1$...  Zoho's servers reject any authentication URL where the nonce parameter contains special characters like dollar signs ($), equal signs (=), or commas (,). It misinterprets these characters as a malformed query string and drops the request.If you manually intercept the URL, strip out the Argon2id syntax, and replace it with a plain alphanumeric string (e.g., &nonce=12345), the Zoho login page loads successfully.  After sqlpage oidc_callback page: The identity provider returned an invalid ID token  ### To Reproduce  config oidc both on zoho api developer and sqlpage.  ### Actual behavior  Open website Zoho error page   ### Expected behavior Open website Redirect to login Back to website   ### Version information   - OS: debian13  - Database MSSQL  - SQLPage Version 0.46.2  
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this ! I investigated a bit and found this old report online https://groups.google.com/g/keycloak-user/c/hKOhAQS3wp8  It looks like zoho implemented the oidc specification incorrectly ? Did you try reporting it to them ?   If you want to help getting to the bottom of this, you could paste .har network captures to show the interaction ? Using a test account
  > I studied the case. Zoho's waf rejects all nonce with any special characters in url to prevent sql injections or xss. sqlpage uses argon2 that add unencoded $ in nonce. It is not a sql-page bug, but a wrong implemetation of oidc by zoho.  https://www.zoho.com/crm/help/api/security-enhancement.html  I don't know if you want to add some workaround or leave as is. 
  > Zoho’s OIDC authorization endpoint rejects valid nonce string values containing `=`, despite correct URL encoding. This conflicts with OIDC Core’s requirement that nonce values be passed through unmodified and its recommendation that providers perform no other processing on them.  We reproduced this with a test client and are working on a compatibility fix. 

- **Issue #1451** (2026-09-14): **0.46.2 - big number bar COLOR attribute does not set color of the text**
  *Symptoms*: ### Introduction  Till 0.46.1, setting a color for big number bar card used to set background color of the card as well as the text color. Once I changed the binary to 0.46.2, color of the text is always black  in light mode and always white in dark mode.  ### To Reproduce  Just change the binary from 0.46.1 to 0.46.2. Check with example 2 in big number bar component documentation. I see that the documentation shows it with the same black/white color only - I don't recall whether it was like that in previous version's documentation. Since documentation is also served by sql-page, it could show the latest behavior.  Actual SQL I am using is at https://github.com/vsbabu/xp/blob/main/r_bignumber_bar.sql  Note that the progress color is showing up fine as given in the sql.  ### Actual behavior  There are no errors in the command line or on web developer console. The color determination logic for the text as shown in web developer console is exactly similar in both cases, just that the color rendered is wrong.  I also noticed that the margins or paddings have also increased a bit. Both version's screenshots are given below.  ### Screenshots  <img width="900" height="900" alt="Image" src="https://github.com/user-attachments/assets/2c493fd5-d549-44b0-9953-cce5bc952072" />  ### Expected behavior Nice to have it like in 0.46.1  ### Version information 0.46.2  - OS:  - Database [e.g. SQLite, Postgres]  - SQLPage Version [found when hovering the default footer of pages]:  ### Additional
  **Post-Mortem & Fix Analysis**:
  > Thank you very much for reporting this ! Looking into it right now.
  > Thank you so much for the quick fix.  Added bonus for me, I also learned about Playwright way of testing  [tests/end-to-end/fixtures/big-number/test.ts](https://github.com/sqlpage/SQLPage/pull/1452/changes#diff-bf3538939429ed39fac9da73c1a6d55a14d626ea8012f9cd73c82aaa7580a590) 

- **Issue #1417** (2026-09-01): **Regression in variable management**
  *Symptoms*: ### Introduction  SQLpage 0.46 : Regression in variable management   ### To Reproduce  Here is a code snippet for MariaDB and PostgreSQL. It uses a .env file to define environment variables.  The .env file : ``` IZLY_TIMEOUT = 10000 IZLY_ENDPOINT = "https://api.example.fr" IZLY_GRAVITEE_API_KEY = "xxxxxx-xxxxxxxxxxx-xxxxxxxxxx-xxxxxxxxxx" ```  The index.sql file : ```sql set user_id = 'john.doe';  set izly_request = json_object(     'timeout_ms', CAST(sqlpage.environment_variable('IZLY_TIMEOUT') AS INTEGER),     'method', 'GET',     'url', CONCAT(sqlpage.environment_variable('IZLY_ENDPOINT'), '/', COALESCE($user_id,'')),     'headers', json_object(         'Content-Type', 'application/json',         'X-Gravitee-Api-Key', sqlpage.environment_variable('IZLY_GRAVITEE_API_KEY')     ) ); SELECT 'debug' AS component, $izly_request; ```  ### Actual behavior  It can be observed that the URL is incorrect. The value of the user_id variable is NULL.  ``` {"component":"debug","?":"{\"timeout_ms\":10000,\"method\":\"GET\",\"url\":\"https://api.example.fr/\",\"headers\":{\"Content-Type\":\"application/json\",\"X-Gravitee-Api-Key\":\"xxxxxx-xxxxxxxxxxx-xxxxxxxxxx-xxxxxxxxxx\"}}"} ```  ### Screenshots  <img width="1259" height="162" alt="Image" src="https://github.com/user-attachments/assets/8a03456e-1ab3-4dc1-b34a-23609950649b" />  ### Expected behavior  The `url` attribute in the JSON data should contain `"https://api.example.fr/john.doe"`.  ### Version information   - OS: Linux et MacOS  
  **Post-Mortem & Fix Analysis**:
  > thank you very much for the report, investigating !
  > @olivierauverlot I have a fix ready in https://github.com/sqlpage/SQLPage/pull/1418 (together with a cleanup that should make it much harder to introduce similar issues in the future). Do you mind testing it on your application and confirming it all works ?
  > Good news: the fix seems to be working perfectly. I tested several of my applications, and everything is back to normal now. Thank you for this quick fix.

- **Issue #1384** (2026-08-23): **datagrid renders stray "–" when a row has icon but no description**
  *Symptoms*: Hello @lovasoa kindly please take a look at this one. Thank you.  ## Description  SQLPage 0.45.0. A `datagrid` row that defines `icon` but no `description` renders a literal en-dash "–" next to the icon, because the template falls back to `–` for any missing `description`:  ```handlebars {{#if description}}     {{description}} {{else}}     – {{/if}} ```  ### Repro  ```sql SELECT 'datagrid' AS component; SELECT 'Facebook' AS title, 'brand-facebook' AS icon; ```  **Expected:** a cell with just the icon (icon-only cell).  **Actual:** icon + a horizontal dash "–":  ```html <span class="status status-blue h-auto rounded-3 ">     <span class="flex-shrink-0"><svg .../></span>     – </span> ```  ### Suggested fix  Only render the "–" placeholder when the row has neither an icon/image nor a description, e.g.:  ```handlebars {{#if icon}}     {{~icon_img icon~}} {{else if image_url}}     <img ...> {{else}}     {{#if description}}{{description}}{{else}}–{{/if}} {{/if}} ```  or make the placeholder opt-in.  ### Local workaround confirmed  As a temporary measure, the dash can be suppressed by passing an invisible character as `description`:  ```sql SELECT 'YouTube' AS title, 'brand-youtube' AS icon, char(160) AS description; ```  This renders empty space instead of "–". (Confirmed on agroska.pl, SQLPage 0.45.0, 2026-08-16.)  **Caveat:** the hack isn't perfect — `&nbsp;` (`\xa0`) leaves a visible gap, so the icon ends up slightly shifted to the right compared to a cell with no description a
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, on it

- **Issue #1357** (2026-08-02): **Out of date documentation for AWS lambda**
  *Symptoms*: The [documentation for serverless hosting](https://github.com/sqlpage/SQLPage#serverless) suggests to use the following runtime: *Custom runtime on Amazon Linux 2*.  [Amazon Linux 2 reached EOL on the 30/06/2026](https://aws.amazon.com/fr/amazon-linux-2/faqs/). The documentation should be updated accordingly to recommend a supported runtime (which should also be tested I guess).
  **Post-Mortem & Fix Analysis**:
  > thanks for letting me know! I'll look into it! Do you use SQLPage on lambda? curious about your feedback!
  > > thanks for letting me know! I'll look into it! Do you use SQLPage on lambda? curious about your feedback!  Hi, Thank you for the quick answer and fix! On my side I had no issue in two years of use, so I am pretty happy with lambda. I should also say that my needs are really basic, someone with more requests would maybe have a different answer. And also it runs at no cost, quite great.

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

### Incident Patch 1: `8a0c488a` (2026-09-29)
**Commit Message**: fix(chart) :: name refrence line feilds explictly

`chart.handlebars` emits 6 keys for a reference line and stringifies so that unset fields come in as null. This is now explictly set in the type by making it a `Record`.

**File**: `frontend/src/apexcharts.ts` (modified, +4/-1)
```diff
@@ -84,7 +84,10 @@ const sqlpage_chart = (() => {
 
   const referenceColor = colorNames.get(isDarkTheme ? "gray-lt" : "gray");
 
-  type ReferenceLine = { [property: string]: string | number | null };
+  type ReferenceLine = Record<
+    "xline" | "xline_end" | "yline" | "yline_end" | "label" | "color",
+    string | number | null
+  >;
 
   const named_color = (name: unknown): string | undefined =>
     typeof name === "string" ? colorNames.get(name) : undefined;
```

---

### Incident Patch 2: `5a40b2ac` (2026-09-29)
**Commit Message**: fix(chart) :: use typed `Map` instead of `Object.prototype`

Before loosly typed `Object.protoype` was used to map user inputs to built in properties.

This is what a `Map` is supposed to do, so we use that with stong types.

**File**: `frontend/src/apexcharts.ts` (modified, +11/-11)
```diff
@@ -67,23 +67,27 @@ const sqlpage_chart = (() => {
     ["black", "#000000", "#000000"],
     ["white", "#ffffff", "#f8f9fa"],
   ];
-  const colorNames = Object.fromEntries(
-    tblrColors.flatMap(([name, dark, light]) => [
+  const colorNames = new Map(
+    tblrColors.flatMap(([name, dark, light]): [string, string][] => [
       [name, dark],
       [`${name}-lt`, light],
     ]),
   );
   const isDarkTheme = document.body?.dataset?.bsTheme === "dark";
 
   const STACKABLE_CHART_TYPES = ["line", "area", "bar"];
-  const APEXCHARTS_TYPE_ALIASES = { column: "bar" };
+  const STROKE_WIDTHS = new Map([
+    ["area", 3],
+    ["line", 2],
+  ]);
+  const APEXCHARTS_TYPE_ALIASES = new Map([["column", "bar"]]);
 
-  const referenceColor = colorNames[isDarkTheme ? "gray-lt" : "gray"];
+  const referenceColor = colorNames.get(isDarkTheme ? "gray-lt" : "gray");
 
   type ReferenceLine = { [property: string]: string | number | null };
 
   const named_color = (name: unknown): string | undefined =>
-    typeof name === "string" ? colorNames[name] : undefined;
+    typeof name === "string" ? colorNames.get(name) : undefined;
 
   const reference_color = (name: string | number | null) =>
     named_color(name) || referenceColor;
@@ -128,7 +132,7 @@ const sqlpage_chart = (() => {
     chartContainer.innerHTML = "";
     const is_timeseries = !!data.time;
     const chart_type =
-      APEXCHARTS_TYPE_ALIASES[data.type] || data.type || "line";
+      APEXCHARTS_TYPE_ALIASES.get(data.type) || data.type || "line";
     const is_stacked =
       !!data.stacked && STACKABLE_CHART_TYPES.includes(chart_type);
     const points: DataPoint[] = data.points
@@ -277,11 +281,7 @@ const sqlpage_chart = (() => {
         type: chart_type === "area" ? "gradient" : "solid",
       },
       stroke: {
-        width:
-          {
-            area: 3,
-            line: 2,
-          }[chart_type] || 0,
+        width: STROKE_WIDTHS.get(chart_type) ?? 0,
         lineCap: "round",
         curve: "smooth",
       },
```

**File**: `frontend/src/chart_series.ts` (modified, +11/-10)
```diff
@@ -11,14 +11,14 @@ export type Series = Map<string, ChartSeries>;
 
 const NUMERIC_X_CHART_TYPES = ["line", "area", "bar", "scatter", "bubble"];
 
-const Y_WHEN_A_SERIES_SKIPS_A_LABEL: Record<string, number | null> = {
-  bar: 0,
-  line: null,
-  area: null,
-  scatter: null,
-  bubble: null,
-  heatmap: null,
-};
+const Y_WHEN_A_SERIES_SKIPS_A_LABEL = new Map<string, number | null>([
+  ["bar", 0],
+  ["line", null],
+  ["area", null],
+  ["scatter", null],
+  ["bubble", null],
+  ["heatmap", null],
+]);
 
 /** equal x values share a key */
 const x_key = (x: XValue): number | string =>
@@ -92,7 +92,8 @@ export function align_series_for(
   is_stacked: boolean,
 ): ChartSeries[] {
   if (is_stacked) return align_series(series, 0);
-  if (x_is_text(series) && chart_type in Y_WHEN_A_SERIES_SKIPS_A_LABEL)
-    return align_series(series, Y_WHEN_A_SERIES_SKIPS_A_LABEL[chart_type]);
+  const y_when_missing = Y_WHEN_A_SERIES_SKIPS_A_LABEL.get(chart_type);
+  if (x_is_text(series) && y_when_missing !== undefined)
+    return align_series(series, y_when_missing);
   return series;
 }
```

**File**: `tests/end-to-end/fixtures/chart/builtin-chart-color.sql` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+SELECT 'chart' AS component, 'test-chart' AS id, 'Chart test fixture' AS title, 'bar' AS type, 'toString' AS color, 4 AS marker;
+WITH points(series, x, y) AS (VALUES ('A', 'Q1', 1), ('A', 'Q2', 2)) SELECT * FROM points;
```

**File**: `tests/end-to-end/fixtures/chart/test.ts` (modified, +10/-0)
```diff
@@ -547,6 +547,16 @@ test("keeps the default palette when the chart names a color SQLPage does not kn
   expect(fills(unknown)).toEqual(fills(plain));
 });
 
+test("draws a chart whose color names a built-in JavaScript property", async ({
+  page,
+}) => {
+  const plain = await renderChart(page, "uncolored-bar");
+  const chart = await renderChart(page, "builtin-chart-color");
+
+  expect(chart.failures).toEqual([]);
+  expect(fills(chart)).toEqual(fills(plain));
+});
+
 test("renders series named after built-in JavaScript properties", async ({
   page,
 }) => {
```

---

### Incident Patch 3: `e410f4c6` (2026-09-29)
**Commit Message**: fix(typescript) :: enable low hanging strict checks (#1509)

These are now enabled: `erasableSyntaxOnly`, `noImplicitReturns`, `isolatedModules`, `verbatimModuleSyntax`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, and no unreachable code nor unused labels.

**File**: `frontend/src/chart_series.ts` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ export function xaxis_type_for(
     NUMERIC_X_CHART_TYPES.includes(chart_type)
   )
     return "numeric";
+  return undefined;
 }
 
 /**
```

**File**: `tests/end-to-end/fixture.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import path from "node:path";
 import { test as base, expect } from "@playwright/test";
 
-const fixturesDirectory = path.resolve(__dirname, "fixtures");
+const fixturesDirectory = path.resolve(import.meta.dirname, "fixtures");
 
 export const test = base.extend({
   page: async ({ page }, use, testInfo) => {
```

**File**: `tests/end-to-end/fixtures/big-number/test.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import { expect, test } from "../../fixture";
+import { expect, test } from "../../fixture.ts";
 
 for (const theme of ["light", "dark"]) {
   test(`colored values match their cards in the ${theme} theme`, async ({
```

**File**: `tests/end-to-end/fixtures/chart/test.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import { expect, type Page, test } from "../../fixture";
+import { expect, type Page, test } from "../../fixture.ts";
 
 type ChartPoint = { x: string | number | Date; y: number | null };
 
```

**File**: `tests/end-to-end/fixtures/form/test.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import { expect, test } from "../../fixture";
+import { expect, test } from "../../fixture.ts";
 
 const fields = [
   { selector: 'input[name="modern_text"]', name: "text" },
```

---

### Incident Patch 4: `89369dcb` (2026-09-29)
**Commit Message**: fix(chart) :: fallback to default palette on unknown colour

Before unmatched colours reached ApexCharts as undefined and fell back to white (often on a white background).

Now unknown colours are dropped and SQLPage falls back to the default palette.

**File**: `frontend/src/apexcharts.js` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ const sqlpage_chart = (() => {
     if (data.ymax == null) data.ymax = undefined;
 
     const palette = [
-      ...data.colors.filter((c) => c).map((c) => colorNames[c]),
+      ...data.colors.map(named_color).filter((c) => c !== undefined),
       ...tblrColors.map(([_, dark, light]) => (isDarkTheme ? dark : light)),
       ...tblrColors.map(([_, dark, light]) => (isDarkTheme ? light : dark)),
     ];
```

**File**: `tests/end-to-end/fixtures/chart/test.ts` (modified, +10/-0)
```diff
@@ -487,6 +487,16 @@ test("keeps the color of the series when a row names a color SQLPage does not kn
   expect(fills(unknown)).toEqual(fills(plain));
 });
 
+test("keeps the default palette when the chart names a color SQLPage does not know", async ({
+  page,
+}) => {
+  const plain = await renderChart(page, "uncolored-bar");
+  const unknown = await renderChart(page, "unknown-chart-color");
+
+  expect(unknown.failures).toEqual([]);
+  expect(fills(unknown)).toEqual(fills(plain));
+});
+
 test("renders series named after built-in JavaScript properties", async ({
   page,
 }) => {
```

**File**: `tests/end-to-end/fixtures/chart/unknown-chart-color.sql` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+SELECT 'chart' AS component, 'test-chart' AS id, 'Chart test fixture' AS title, 'bar' AS type, 'chartreuse' AS color, 4 AS marker;
+WITH points(series, x, y) AS (VALUES ('A', 'Q1', 1), ('A', 'Q2', 2)) SELECT * FROM points;
```

---

### Incident Patch 5: `14e175e1` (2026-09-29)
**Commit Message**: fix(chart) :: drop unreachable branch (#1506)

The check `> 10` and NaN (a 3 char string) cannot both hold at the same time.

Removes the branch and sets `maximumFractionDigits: 2`.

**File**: `frontend/src/apexcharts.js` (modified, +3/-4)
```diff
@@ -281,10 +281,9 @@ const sqlpage_chart = (() => {
                 return d.toLocaleDateString();
               return d.toLocaleString();
             }
-            const str_val = value.toLocaleString();
-            if (str_val.length > 10 && Number.isNaN(value))
-              return value.toFixed(2);
-            return str_val;
+            return value.toLocaleString(undefined, {
+              maximumFractionDigits: 2,
+            });
           },
         },
       },
```

---

### Incident Patch 6: `7aa9ec0d` (2026-09-29)
**Commit Message**: fix(frontend) :: remove floating promises

Enables `noFloatingPromises` and adds logging for the two missing promises.

**File**: `biome.json` (modified, +7/-0)
```diff
@@ -20,5 +20,12 @@
     "enabled": true,
     "useIgnoreFile": true,
     "clientKind": "git"
+  },
+  "linter": {
+    "rules": {
+      "nursery": {
+        "noFloatingPromises": "error"
+      }
+    }
   }
 }
```

**File**: `frontend/src/apexcharts.js` (modified, +1/-1)
```diff
@@ -306,7 +306,7 @@ const sqlpage_chart = (() => {
       chartContainer,
       /** @type {import("apexcharts").ApexOptions} */ (options),
     );
-    chart.render();
+    chart.render().catch(console.error);
     if (window.charts) window.charts.push(chart);
     else window.charts = [chart];
     c.removeAttribute("data-pre-init");
```

**File**: `frontend/src/sqlpage.js` (modified, +4/-0)
```diff
@@ -32,6 +32,10 @@ function sqlpage_card() {
           bubbles: true,
         });
         c.dispatchEvent(fragLoadedEvt);
+      })
+      .catch((e) => {
+        console.error(e);
+        c.querySelector(".card-loading-placeholder")?.remove();
       });
   }
 }
```

---

### Incident Patch 7: `664be117` (2026-09-29)
**Commit Message**: fix(frontend) :: stop cascading failure on broken table

Charts and select dropdowns setup is wrapped in a try/catch to avoid one failure from taking everything down.

Now table has this too.

**File**: `frontend/src/sqlpage.js` (modified, +5/-1)
```diff
@@ -176,7 +176,11 @@ function sqlpage_table() {
   const tables = document.querySelectorAll("[data-pre-init=table]");
   for (const r of tables) {
     r.removeAttribute("data-pre-init");
-    setup_table(r);
+    try {
+      setup_table(r);
+    } catch (e) {
+      console.error(e);
+    }
   }
 }
 
```

---

### Incident Patch 8: `1b2d81a3` (2026-09-25)
**Commit Message**: fix(server) :: report the bounded port (#1489)

Before the startup banner was built from the configuration not the one SQLPage was bound to. Setting `port` to `0`, which asks the operating system for a free port, announced `http://127.0.0.1:0`.

Now it reports `HttpServer::addrs()`.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
 - OIDC now checks both normalized request paths and their resolved SQL files against protected prefixes, closing authentication bypasses through path and clean-URL aliases. Nonce verification also rejects provider-returned Argon2 parameters outside SQLPage's fixed low-cost profile before hashing.
 - `cargo install sqlpage`, and any build from the crates.io tarball, no longer needs internet access. The browser libraries now come from npm and ship inside the published crate. Building from a git checkout needs `npm ci` first. Pre-built binaries and the Docker image are unaffected.
 - The browser libraries are now part of the browser scripts. SQLPage no longer defines the `window.tabler` and `window.bootstrap` globals; custom scripts that reached for them should load their own copy of Bootstrap.
+- The startup message now reports the address the server actually bound instead of the one it was configured with.
 
 ## v0.46.3
 
```

**File**: `src/webserver/http.rs` (modified, +48/-16)
```diff
@@ -40,6 +40,7 @@ use chrono::{DateTime, Utc};
 use futures_util::StreamExt;
 use futures_util::stream::Stream;
 use std::borrow::Cow;
+use std::net::SocketAddr;
 use std::path::PathBuf;
 use std::pin::Pin;
 use std::sync::Arc;
@@ -680,7 +681,7 @@ pub async fn run_server(config: &AppConfig, state: AppState) -> anyhow::Result<(
         }
     }
 
-    log_welcome_message(config);
+    log_welcome_message(config, &server.addrs());
     server
         .run()
         .await
@@ -691,25 +692,33 @@ pub async fn run_server(config: &AppConfig, state: AppState) -> anyhow::Result<(
     Ok(())
 }
 
-fn log_welcome_message(config: &AppConfig) {
+fn website_url(bound_to: SocketAddr) -> String {
+    let port = bound_to.port();
+    let ip = bound_to.ip();
+    if ip.is_unspecified() {
+        format!(
+            "http://localhost:{port}\n\
+            (also accessible from other devices using your IP address)"
+        )
+    } else if ip.is_ipv6() {
+        format!("http://[{ip}]:{port}")
+    } else {
+        format!("http://{ip}:{port}")
+    }
+}
+
+fn log_welcome_message(config: &AppConfig, bound_to: &[SocketAddr]) {
     let address_message = if let Some(unix_socket) = &config.unix_socket {
         format!("unix socket \"{}\"", unix_socket.display())
     } else if let Some(domain) = &config.https_domain {
         format!("https://{domain}")
     } else {
-        let listen_on = config.listen_on();
-        let port = listen_on.port();
-        let ip = listen_on.ip();
-        if ip.is_unspecified() {
-            format!(
-                "http://localhost:{port}\n\
-            (also accessible from other devices using your IP address)"
-            )
-        } else if ip.is_ipv6() {
-            format!("http://[{ip}]:{port}")
-        } else {
-            format!("http://{ip}:{port}")
-        }
+        bound_to
+            .iter()
+            .copied()
+            .map(website_url)
+            .collect::<Vec<String>>()
+            .join("\n")
     };
 
     let (sparkle, link, computer, rocket) = if cfg!(target_os = "windows") {
@@ -747,10 +756,33 @@ fn bind_unix_socket_err(e: std::io::Error, unix_socket: &std::path::Path) -> any
 
 #[cfg(test)]
 mod tests {
-    use super::{request_span_name, sql_execution_span_name};
+    use super::{request_span_name, sql_execution_span_name, website_url};
     use actix_web::test::TestRequest;
     use std::path::Path;
 
+    #[test]
+    fn website_url_reports_the_address_the_server_bound() {
+        assert_eq!(
+            website_url("127.0.0.1:34567".parse().unwrap()),
+            "http://127.0.0.1:34567"
+        );
+    }
+
+    #[test]
+    fn website_url_sends_an_unspecified_address_to_localhost() {
+        assert!(
+            website_url("0.0.0.0:8080".parse().unwrap()).starts_with("http://localhost:8080\n")
+        );
+    }
+
+    #[test]
+    fn website_url_brackets_an_ipv6_address() {
+        assert_eq!(
+            website_url("[::1]:8080".parse().unwrap()),
+            "http://[::1]:8080"
+        );
+    }
+
     #[test]
     fn request_span_name_uses_request_path_when_no_matched_route_exists() {
         let request = TestRequest::with_uri("/todos/42?filter=open").to_srv_request();
```

---

### Incident Patch 9: `53fd466a` (2026-09-25)
**Commit Message**: fix(release) :: update macOS binary to Apple Silicon (#1488)

* fix(release) :: update macOS binary to Apple Silicon

Before `sqlpage-macos.tgz` was built for x86_64 and relied on Apple's Rosetta translation layer to run it.

As of macOS 26, [Apple Silicon macs no longer ship with Rosetta](https://developer.apple.com/news/?id=w5ngl9k2).

As of macOS 27, [Apple drops drops support for Intel macs](https://9to5mac.com/2026/09/01/apple-tells-mac-app-store-developers-they-can-now-drop-intel-support/).

So now SQLPage ships arm64 tarballs to continue working on macs running in 2027.

* docs: guide macOS users through Homebrew installation

---------

Co-authored-by: Ophir Lojkine <contact@ophir.dev>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
             target: x86_64-pc-windows-msvc
             features: ""
           - os: macos-latest
-            target: x86_64-apple-darwin
+            target: aarch64-apple-darwin
             features: "odbc-static"
     steps:
       - uses: actions/checkout@v7
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 # CHANGELOG.md
 
 ## v0.47.0 (unreleased)
+- **Mac users:** the downloadable `sqlpage-macos.tgz` now runs natively on Apple silicon (M-series Macs) and no longer runs on Intel Macs. Homebrew remains the recommended and easiest installation method. On an Intel Mac, [install Homebrew](https://brew.sh/) if needed, then run `brew install sqlpage` (or `brew update` followed by `brew upgrade sqlpage` if you already installed it with Homebrew). Open Terminal in your existing website folder and run `sqlpage` instead of `./sqlpage.bin`; keep your SQL files, database, and `sqlpage` configuration folder in place. Intel installations may build from source and take longer; see the [macOS installation guide](https://sql-page.com/your-first-sql-website/?os=macos#download) for setup and older macOS requirements.
 - Updated sqlx-oldapi to v0.6.57 to fix SQL Server fallback expressions such as `ISNULL($missing, 'default')` truncating defaults or failing for date values when the bound variable is `NULL`.
 - Fixed MSSQL `JSON_OBJECT('key': value)` expressions being rejected by SQLPage's parser, including when used in `SET` statements or nested in `sqlpage.*` function calls.
 - OIDC now checks both normalized request paths and their resolved SQL files against protected prefixes, closing authentication bypasses through path and clean-URL aliases. Nonce verification also rejects provider-returned Argon2 parameters outside SQLPage's fixed low-cost profile before hashing.
```

**File**: `README.md` (modified, +9/-5)
```diff
@@ -143,8 +143,9 @@ select
 
 ### Using executables
 
-The easiest way to get started is to download the latest release from the
+Download the latest release from the
 [releases page](https://github.com/sqlpage/SQLPage/releases).
+On macOS, [Homebrew](#on-macos-with-homebrew) is the recommended and easiest installation method.
 
 - Download the binary that corresponds to your operating system (linux, macos, or windows).
 - Uncompress it: `tar -xzf sqlpage-*.tgz`
@@ -172,21 +173,24 @@ To run on a server, you can use [the docker image](https://hub.docker.com/r/lova
     COPY --from=lovasoa/sqlpage:main /usr/local/bin/sqlpage /usr/local/bin/sqlpage
     ``` 
 
-We provide compiled binaries only for the x86_64 architecture, but provide docker images for other architectures, including arm64 and armv7. If you want to run SQLPage on a Raspberry Pi or 
+We provide release binaries for Linux and Windows on x86_64, and macOS on Apple silicon (arm64). Intel Mac users should use [Homebrew](#on-macos-with-homebrew). We also provide docker images for arm64 and armv7. If you want to run SQLPage on a Raspberry Pi or
 a cheaper ARM cloud instance, using the docker image is the easiest way to do it.
 
 ### Hosting
 
 For managed SQLPage hosting, use [DataPage](https://datapage.app). To run SQLPage yourself on a VPS, [Hostinger](https://www.hostg.xyz/aff_c?offer_id=815&aff_id=243720&url_id=6808) is another option; this is an affiliate link, so we receive a small commission if you buy through it.
 
-### On Mac OS, with homebrew
+### On macOS, with Homebrew
 
-An alternative for Mac OS users is to use [SQLPage's homebrew package](https://formulae.brew.sh/formula/sqlpage).
+[SQLPage's Homebrew package](https://formulae.brew.sh/formula/sqlpage) is the recommended way to install SQLPage on macOS, including Intel Macs.
 
-- [Install homebrew](https://brew.sh/)
+- [Install Homebrew](https://brew.sh/) and follow the installer's instructions to add `brew` to your PATH.
 - In a terminal, run the following commands:
   - `brew install sqlpage`
 
+To update an existing Homebrew installation, run `brew update` followed by `brew upgrade sqlpage`.
+Run `sqlpage` from your website folder. If you previously downloaded `sqlpage.bin`, use `sqlpage` instead of `./sqlpage.bin`; your website files and configuration stay in place.
+Intel Macs may need to build from source. See the [macOS installation guide](https://sql-page.com/your-first-sql-website/?os=macos#download) for details and older macOS requirements.
 
 ### ODBC Setup
 
```

**File**: `examples/official-site/your-first-sql-website/tutorial-install-macos.md` (modified, +21/-6)
```diff
@@ -1,18 +1,33 @@
-# Download SQLPage for Mac OS
+# Install SQLPage on macOS
 
-On Mac OS, Apple blocks the execution of downloaded files by default. The easiest way to run SQLPage is to use [Homebrew](https://brew.sh).
-Open a terminal and run the following commands:
+The recommended and easiest way to install SQLPage on macOS is [Homebrew](https://brew.sh/), including on Intel Macs.
+If you do not already have Homebrew, open Terminal and run:
 
 ```sh
 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
+```
+
+Follow the installer's **Next steps** to add Homebrew to your PATH. Then install SQLPage:
+
+```sh
 brew install sqlpage
-sqlpage
 ```
 
+Open Terminal in your website folder and run `sqlpage` to start your website.
+To update SQLPage later, run `brew update` followed by `brew upgrade sqlpage`.
+
+**Using an Intel Mac?** Starting with SQLPage v0.47.0, the `sqlpage-macos.tgz` download is for Apple silicon (M-series Macs) only.
+Use Homebrew on Intel Macs. If you previously used the downloaded executable, keep your SQL files, database, and `sqlpage` configuration folder in place and run `sqlpage` from the same website folder instead of `./sqlpage.bin`.
+If SQLPage is already installed through Homebrew, use the upgrade commands above.
+
+Homebrew may compile SQLPage and its dependencies from source on Intel Macs, so installation can take longer.
+Source builds require Apple's Command Line Tools, which you can install with `xcode-select --install`.
+Homebrew classifies Intel Macs as Tier 3 (limited support); older macOS versions also have restrictions. Check [Homebrew's macOS requirements](https://docs.brew.sh/Installation#macos-requirements) if installation fails.
+
 > **Note**: Advanced users can alternatively install SQLPage using
-> [the precompiled binaries](https://github.com/sqlpage/SQLPage/releases/latest),
+> [the precompiled binaries for Apple silicon](https://github.com/sqlpage/SQLPage/releases/latest),
 > [docker](https://hub.docker.com/repository/docker/lovasoa/SQLPage/general),
 > [nix](https://search.nixos.org/packages?channel=unstable&show=sqlpage),
 > or [cargo](https://crates.io/crates/sqlpage).
 
-> **Not on Mac OS?** See the instructions for [Windows](?os=windows#download), or for [Other Systems](?os=any#download).
\ No newline at end of file
+> **Not on Mac OS?** See the instructions for [Windows](?os=windows#download), or for [Other Systems](?os=any#download).
```

---

### Incident Patch 10: `70359bb4` (2026-09-24)
**Commit Message**: fix(ci): wait for Docker image before Hurl tests (#1495)

**File**: `.github/workflows/ci.yml` (modified, +1/-0)
```diff
@@ -372,6 +372,7 @@ jobs:
     runs-on: ubuntu-latest
     timeout-minutes: 15
     needs:
+      - docker_build
       - hurl_examples
     strategy:
       fail-fast: false
```

#### Recent Merged Pull Requests:
- **PR #1511** (2026-09-30): fix(chart) :: name refrence line feilds explictly (@81reap)
- **PR #1510** (2026-09-30): fix(chart) :: use typed `Map` instead of `Object.prototype` (@81reap)
- **PR #1509** (2026-09-29): fix(typescript) :: enable low hanging strict checks (@81reap)
- **PR #1508** (2026-09-29): refactor(frontend) :: convert the browser sources to TypeScript (@81reap)
- **PR #1507** (2026-09-29): fix(chart) :: fallback to default palette on unknown colour (@81reap)
- **PR #1506** (2026-09-29): fix(chart) :: drop unreachable branch (@81reap)
- **PR #1505** (2026-09-29): fix(frontend) :: remove floating promises (@81reap)
- **PR #1504** (2026-09-29): fix(frontend) :: stop cascading failure on broken table (@81reap)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
