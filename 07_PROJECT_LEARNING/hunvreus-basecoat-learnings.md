# Forensic Learning Record (Deep Inspection): hunvreus/basecoat

> **Canonical Artifact**: `07_PROJECT_LEARNING/hunvreus-basecoat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hunvreus/basecoat](https://github.com/hunvreus/basecoat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:57.330Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hunvreus/basecoat`
- **Description**: A components library built with Tailwind CSS that works with any web stack.
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4347 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/generate-css-entrypoints.js`
```
import fs from 'fs/promises';
import path from 'path';

const styles = ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];
const excludedComponents = new Set(['form']);

// Keep cascade stable for components whose selectors intentionally compose.
const componentOrder = [
  'accordion',
  'alert',
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'button-group',
  'card',
  'chart',
  'collapsible',
  'command',
  'combobox',
  'dialog',
  'drawer',
  'dropdown-menu',
  'empty',
  'field',
  'checkbox',
  'input',
  'item',
  'kbd',
  'label',
  'native-select',
  'popover',
  'progress',
  'radio',
  'range',
  'select',
  'sidebar',
  'scrollbar',
  'skeleton',
  'switch',
  'table',
  'tabs',
  'textarea',
  'input-group',
  'toast',
  'tooltip',
];

async function existingComponentNames(cssDir) {
  const componentDir = path.join(cssDir, 'components');
  const files = await fs.readdir(componentDir);
  const names = files
    .filter((file) => file.endsWith('.css'))
    .map((file) => path.basename(file, '.css'))
    .filter((name) => !excludedComponents.has(name));
  const known = componentOrder.filter((name) => names.includes(name));
  const extra = names.filter((name) => !componentOrder.includes(name)).sort();
  return [...known, ...extra];
}

function componentImports(names) {
  return [
    '/* Components */',
    ...names.map((name) => `@import "./components/${name}.css";`),
  ].join('\n');
}

async function writeIfChanged(filePath, content) {
  let current = null;
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current !== content) await fs.writeFile(filePath, content);
}

export async function generateCssEntrypoints({ cssDir = path.resolve('src/css') } = {}) {
  const components = await existingComponentNames(cssDir);
  const componentsCss = `${componentImports(components)}\n`;
  const baseCss = `@import "./base/base.css";\n@import "./basecoat-components.css";\n`;

  await writeIfChanged(path.join(cssDir, 'basecoat-components.css'), componentsCss);
  await writeIfChanged(path.join(cssDir, 'basecoat-base.css'), baseCss);
  await writeIfChanged(path.join(cssDir, 'basecoat-base.cdn.css'), '@import "tailwindcss" source(none);\n@import "./basecoat-base.css";\n');

  for (const style of styles) {
    await writeIfChanged(
      path.join(cssDir, `basecoat-${style}.css`),
      `@import "./basecoat-base.css";\n@import "./styles/${style}.css";\n`,
    );
    await writeIfChanged(
      path.join(cssDir, `basecoat-${style}.cdn.css`),
      `@import "tailwindcss" source(none);\n@import "./basecoat-${style}.css";\n`,
    );
  }

  await writeIfChanged(path.join(cssDir, 'basecoat.css'), '@import "./basecoat-vega.css";\n');
  await writeIfChanged(path.join(cssDir, 'basecoat.all.css'), '@import "./basecoat.css";\n');
  await writeIfChanged(path.join(cssDir, 'basecoat.cdn.css'), '@import "tailwindcss" source(none);\n@import "./basecoat.css";\n');
  await writeIfChanged(path.join(cssDir, 'basecoat-compat.css'), '@import "./compat/legacy.css";\n');
  await writeIfChanged(path.join(cssDir, 'basecoat-compat.cdn.css'), '@import "tailwindcss" source(none);\n@reference "./basecoat.css";\n@import "./basecoat-compat.css";\n');

  return { components, styles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateCssEntrypoints();
}

```

### Core Architecture Module: `site/astro.config.mjs`
```
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import sitemap from '@astrojs/sitemap';
import reallySimpleDocs from 'reallysimpledocs/astro';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const includeInSitemap = (page) => {
  const { pathname } = new URL(page);

  return pathname === '/' || (
    pathname.endsWith('/') &&
    !pathname.startsWith('/fragments/')
  );
};

export default defineConfig({
  site: process.env.SITE_URL || 'https://basecoatui.com',
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    resolve: {
      dedupe: ['basecoat-css'],
    },
  },
  integrations: [
    reallySimpleDocs({
      docsDir: './src/docs',
      routeBase: '/',
      style: 'vega',
      css: false,
      bodyAttrs: {
        class: 'antialiased',
        'hx-boost': 'true',
        'hx-target': '#content',
        'hx-select': '#content',
        'hx-swap': 'outerHTML',
        'hx-push-url': 'true',
      },
      components: {
        Head: './src/components/StyleHead.astro',
        SidebarHeader: './src/components/SidebarHeader.astro',
        ContentHeader: './src/components/ContentHeader.astro',
      },
      site: {
        title: 'Basecoat',
        subtitle: `v${packageJson.version}`,
        description: 'A components library built with Tailwind CSS that works with any web stack.',
        url: process.env.SITE_URL || 'https://basecoatui.com',
        keywords: ['components', 'component library', 'component system', 'UI', 'UI kit', 'shadcn', 'shadcn/ui', 'Tailwind CSS', 'Tailwind', 'CSS', 'HTML', 'Jinja', 'Nunjucks', 'JS', 'JavaScript', 'vanilla JS', 'vanilla JavaScript'],
        author: {
          name: 'Ronan Berder',
          x: '@hunvreus',
        },
        favicon: 'favicon.svg',
        appleTouchIcon: 'apple-touch-icon.png',
        socialImage: 'social.png',
        logo: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="h-4 w-4"><rect width="256" height="256" fill="none"></rect><line x1="208" y1="128" x2="128" y2="208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></line><line x1="192" y1="40" x2="40" y2="192" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></line></svg>',
        },
      },
    }),
    sitemap({
      filter: includeInSitemap,
    }),
  ],
});

```

### Core Architecture Module: `site/src/pages/fragments/toast/[type].ts`
```
import fs from 'node:fs';
import path from 'node:path';
import Nunjucks from 'nunjucks';

const types = ['success', 'error', 'info', 'warning'];
const env = new Nunjucks.Environment(
  new Nunjucks.FileSystemLoader([
    path.resolve('../src/templates/nunjucks'),
    path.resolve('src/fragments/toast'),
  ]),
  { autoescape: true },
);

export function getStaticPaths() {
  return types.map((type) => ({ params: { type } }));
}

export function GET({ params }) {
  const type = String(params.type || '');
  if (!types.includes(type)) return new Response('Not found', { status: 404 });
  const source = fs.readFileSync(path.resolve('src/fragments/toast', `${type}.njk`), 'utf8');
  const html = env.renderString(source).trim();
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

```

### Core Architecture Module: `site/src/pages/robots.txt.ts`
```
export function GET({ site }) {
  const origin = site?.toString().replace(/\/$/, '') || 'https://basecoatui.com';
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap-index.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

```

### Core Architecture Module: `site/src/scripts/chart-examples.js`
```
const visitorsByDay = [
  { date: "Apr 1", desktop: 222, mobile: 150 },
  { date: "Apr 5", desktop: 373, mobile: 290 },
  { date: "Apr 9", desktop: 59, mobile: 110 },
  { date: "Apr 13", desktop: 342, mobile: 380 },
  { date: "Apr 17", desktop: 446, mobile: 360 },
  { date: "Apr 21", desktop: 137, mobile: 200 },
  { date: "Apr 25", desktop: 215, mobile: 250 },
  { date: "Apr 29", desktop: 315, mobile: 240 },
  { date: "May 3", desktop: 247, mobile: 190 },
  { date: "May 7", desktop: 388, mobile: 300 },
  { date: "May 11", desktop: 335, mobile: 270 },
  { date: "May 15", desktop: 473, mobile: 380 },
  { date: "May 19", desktop: 235, mobile: 180 },
  { date: "May 23", desktop: 252, mobile: 290 },
  { date: "May 27", desktop: 420, mobile: 460 },
  { date: "May 31", desktop: 178, mobile: 230 },
  { date: "Jun 4", desktop: 439, mobile: 380 },
  { date: "Jun 8", desktop: 385, mobile: 320 },
  { date: "Jun 12", desktop: 492, mobile: 420 },
  { date: "Jun 16", desktop: 371, mobile: 310 },
  { date: "Jun 20", desktop: 408, mobile: 450 },
  { date: "Jun 24", desktop: 132, mobile: 180 },
  { date: "Jun 28", desktop: 149, mobile: 200 },
];

const monthlyVisitors = [
  { month: "Jan", desktop: 186, mobile: 80 },
  { month: "Feb", desktop: 305, mobile: 200 },
  { month: "Mar", desktop: 237, mobile: 120 },
  { month: "Apr", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "Jun", desktop: 214, mobile: 140 },
];

const defaultScales = {
  y: { beginAtZero: true },
  x: { grid: { display: false } },
};

const initChart = (id, config) => {
  const canvas = document.getElementById(id);
  if (!canvas || canvas.dataset.chartInitialized) return;
  window.basecoat.chart(canvas, config);
};

const initChartExamples = () => {
  if (!window.Chart || !window.basecoat?.chart) return;

  initChart("chart-example-overview", {
    type: "line",
    labelKey: "date",
    legend: true,
    data: visitorsByDay,
    series: {
      desktop: {
        label: "Desktop",
        color: "var(--chart-2)",
        surface: "gradient",
        dataset: {
          borderWidth: 1.5,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
      },
      mobile: {
        label: "Mobile",
        color: "var(--chart-1)",
        surface: "gradient",
        dataset: {
          borderWidth: 1.5,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
      },
    },
    options: {
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
        y: { beginAtZero: true, stacked: true, ticks: { display: false } },
      },
    },
  });

  initChart("chart-example-visitors", {
    type: "bar",
    labelKey: "month",
    legend: true,
    data: monthlyVisitors,
    series: {
      desktop: { label: "Desktop", color: "var(--chart-1)" },
      mobile: { label: "Mobile", color: "var(--chart-2)" },
    },
    options: { scales: defaultScales },
  });

  initChart("chart-example-line", {
    type: "line",
    labelKey: "month",
    data: [
      { month: "Jan", revenue: 42 },
      { month: "Feb", revenue: 68 },
      { month: "Mar", revenue: 61 },
      { month: "Apr", revenue: 90 },
      { month: "May", revenue: 112 },
      { month: "Jun", revenue: 128 },
    ],
    series: {
      revenue: {
        label: "Revenue",
        color: "var(--chart-1)",
        dataset: { borderWidth: 1.5, tension: 0, pointRadius: 0, pointHoverRadius: 4 },
      },
    },
    options: { scales: defaultScales },
  });

  initChart("chart-example-step", {
    type: "line",
    labelKey: "day",
    data: [
      { day: "Mon", queued: 12 },
      { day: "Tue", queued: 18 },
      { day: "Wed", queued: 9 },
      { day: "Thu", queued: 24 },
      { day: "Fri", queued: 16 },
      { day: "Sat", queued: 14 },
    ],
    series: {
      queued: {
        label: "Queued",
        color: "var(--chart-1)",
        dataset: { borderWidth: 1.5, stepped: true, pointRadius: 0, pointHoverRadius: 4 },
      },
    },
    options: { scales: defaultScales },
  });

  initChart("chart-example-stacked", {
    type: "bar",
    labelKey: "quarter",
    legend: true,
    data: [
      { quarter: "Q1", won: 32, open: 44, lost: 12 },
      { quarter: "Q2", won: 48, open: 38, lost: 18 },
      { quarter: "Q3", won: 52, open: 46, lost: 16 },
      { quarter: "Q4", won: 61, open: 40, lost: 14 },
    ],
    series: {
      won: { label: "Won", color: "var(--chart-1)" },
      open: { label: "Open", color: "var(--chart-2)" },
      lost: { label: "Lost", color: "var(--chart-3)" },
    },
    options: {
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { display: false } },
      },
    },
  });

  initChart("chart-example-donut", {
    type: "doughnut",
    labelKey: "source",
    legend: true,
    data: [
      { source: "Search", visitors: 275, color: "var(--chart-1)" },
      { source: "Direct", visitors: 200, color: "var(--chart-2)" },
      { source: "Social", visitors: 187, color: "var(--chart-3)" },
      { source: "Referral", visitors: 173, color: "var(--chart-4)" },
      { source: "Email", visitors: 90, color: "var(--chart-5)" },
    ],
    series: {
      visitors: { label: "Visitors" },
    },
    options: {
      cutout: "62%",
    },
  });

  initChart("chart-example-radar", {
    type: "radar",
    labelKey: "channel",
    legend: true,
    data: [
      { channel: "Acquisition", current: 82, previous: 64 },
      { channel: "Activation", current: 72, previous: 70 },
      { channel: "Retention", current: 66, previous: 58 },
      { channel: "Revenue", current: 88, previous: 75 },
      { channel: "Referral", current: 61, previous: 52 },
    ],
    series: {
      current: {
        label: "Current",
        color: "var(--chart-1)",
        surface: { from: 0.22 },
        dataset: { borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4 },
      },
      previous: {
        label: "Previous",
        color: "var(--chart-2)",
        surface: { from: 0.18 },
        dataset: { borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4 },
      },
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          grid: { color: "color-mix(in oklab, var(--border) 60%, transparent)" },
          angleLines: { color: "color-mix(in oklab, var(--border) 60%, transparent)" },
          pointLabels: { color: "var(--muted-foreground)" },
          ticks: { display: false },
        },
      },
    },
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChartExamples, { once: true });
} else {
  initChartExamples();
}

if (!window.__basecoatChartExamplesObserver) {
  let pending = false;
  const queueInitChartExamples = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      initChartExamples();
    });
  };

  window.__basecoatChartExamplesObserver = new MutationObserver(queueInitChartExamples);
  window.__basecoatChartExamplesObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

```

### Core Architecture Module: `site/src/scripts/demo-interactions.js`
```
const initPriceRange = () => {
  const input = document.getElementById("price-range");
  const output = document.getElementById("price-range-output");
  if (!input || !output || input.dataset.demoRangeInitialized) return;
  input.dataset.demoRangeInitialized = "true";

  const updateRange = () => {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || 0);
    const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--slider-value", `${percent}%`);
    output.textContent = `(up to $${value})`;
  };

  input.addEventListener("input", updateRange);
  updateRange();
};

const initCheckboxTables = () => {
  document.querySelectorAll("[data-checkbox-table]").forEach((table) => {
    if (table.dataset.demoCheckboxTableInitialized) return;
    table.dataset.demoCheckboxTableInitialized = "true";

    const selectAll = table.querySelector("thead input[type='checkbox']");
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const rowCheckboxes = rows
      .map((row) => row.querySelector("input[type='checkbox']"))
      .filter(Boolean);

    const syncRows = () => {
      rows.forEach((row) => {
        const checkbox = row.querySelector("input[type='checkbox']");
        if (checkbox?.checked) {
          row.dataset.state = "selected";
        } else {
          row.removeAttribute("data-state");
        }
      });
    };

    const syncSelectAll = () => {
      if (!selectAll || rowCheckboxes.length === 0) return;
      const checkedCount = rowCheckboxes.filter((checkbox) => checkbox.checked).length;
      selectAll.checked = checkedCount === rowCheckboxes.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
    };

    const sync = () => {
      syncRows();
      syncSelectAll();
    };

    selectAll?.addEventListener("change", () => {
      rowCheckboxes.forEach((checkbox) => {
        checkbox.checked = selectAll.checked;
      });
      sync();
    });

    rowCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", sync);
    });

    sync();
  });
};

const initDemos = () => {
  initPriceRange();
  initCheckboxTables();
};

document.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key !== "j") return;
  const dialog = document.getElementById("command-basic");
  if (!dialog) return;
  event.preventDefault();
  dialog.open ? dialog.close() : dialog.showModal();
  dialog.querySelector("header input")?.focus();
});

document.addEventListener("click", (event) => {
  const checkbox = event.target.closest("#dropdown-checkboxes [role='menuitemcheckbox']");
  if (checkbox) {
    if (checkbox.getAttribute("aria-disabled") === "true") return;
    checkbox.setAttribute("aria-checked", checkbox.getAttribute("aria-checked") !== "true");
    return;
  }

  const radio = event.target.closest("#dropdown-radio-group [role='menuitemradio']");
  if (radio) {
    const group = radio.closest("#dropdown-radio-group");
    group?.querySelectorAll("[role='menuitemradio']").forEach((item) => item.setAttribute("aria-checked", "false"));
    radio.setAttribute("aria-checked", "true");
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDemos, { once: true });
} else {
  initDemos();
}

document.addEventListener("htmx:afterSettle", initDemos);

```

### Core Architecture Module: `src/js/accordion.js`
```
(() => {
  const states = new WeakMap();

  const isDisabled = (details) => {
    const summary = details.querySelector(':scope > summary');
    return details.getAttribute('aria-disabled') === 'true'
      || details.dataset.disabled === 'true'
      || summary?.getAttribute('aria-disabled') === 'true';
  };

  const isMultiple = (root) => root.hasAttribute('data-multiple');

  const closeSiblings = (root, activeDetails) => {
    if (isMultiple(root) || !activeDetails.open) return;
    root.querySelectorAll(':scope > details[open]').forEach((details) => {
      if (details !== activeDetails) details.open = false;
    });
  };

  const initAccordion = (root) => {
    if (root.dataset.accordionInitialized) return;

    const handleClick = (event) => {
      const summary = event.target.closest('summary');
      const details = summary?.closest('details');
      if (!details || details.parentElement !== root || !isDisabled(details)) return;
      event.preventDefault();
    };

    const handleKeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const summary = event.target.closest('summary');
      const details = summary?.closest('details');
      if (!details || details.parentElement !== root || !isDisabled(details)) return;
      event.preventDefault();
    };

    const handleToggle = (event) => {
      const details = event.target;
      if (details.parentElement !== root) return;
      if (isDisabled(details)) {
        details.open = false;
        return;
      }
      closeSiblings(root, details);
    };

    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeydown);
    root.addEventListener('toggle', handleToggle, true);
    root.querySelectorAll(':scope > details[open]').forEach((details) => closeSiblings(root, details));

    states.set(root, { handleClick, handleToggle });
    root._destroy = () => {
      root.removeEventListener('click', handleClick);
      root.removeEventListener('keydown', handleKeydown);
      root.removeEventListener('toggle', handleToggle, true);
      states.delete(root);
    };

    root.dataset.accordionInitialized = 'true';
    root.dispatchEvent(new CustomEvent('basecoat:initialized'));
  };

  if (window.basecoat) {
    window.basecoat.register('accordion', '.accordion:not([data-accordion-initialized])', initAccordion);
  }
})();

```

### Core Architecture Module: `src/js/basecoat.js`
```
(() => {
  const componentRegistry = {};
  let observer = null;

  const registerComponent = (name, selectorOrOptions, initFunction) => {
    const options = typeof selectorOrOptions === 'object'
      ? selectorOrOptions
      : { selector: selectorOrOptions, init: initFunction };

    componentRegistry[name] = {
      selector: options.selector,
      init: options.init,
      refresh: options.refresh,
    };
  };

  const initComponent = (element, componentName) => {
    const component = componentRegistry[componentName];
    if (!component) return;

    try {
      component.init(element);
      if (element.hasAttribute(`data-${componentName}-initialized`)) {
        element.dataset.basecoatComponent = componentName;
      }
    } catch (error) {
      console.error(`Failed to initialize ${componentName}:`, error);
      if (typeof element._destroy === 'function') {
        try {
          element._destroy();
        } catch (destroyError) {
          console.error(`Failed to clean up ${componentName} after initialization error:`, destroyError);
        }
      }
      delete element._destroy;
      element.removeAttribute(`data-${componentName}-initialized`);
      delete element.dataset.basecoatComponent;
    }
  };

  const destroyComponent = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    const componentName = element.dataset?.basecoatComponent;

    if (typeof element._destroy === 'function') {
      try {
        element._destroy();
      } catch (error) {
        console.error('Failed to destroy Basecoat component:', error);
      }
    }

    delete element._destroy;
    if (componentName) element.removeAttribute(`data-${componentName}-initialized`);
    delete element.dataset.basecoatComponent;
  };

  const destroyRemovedComponents = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.isConnected) return;

    if (node.dataset?.basecoatComponent) destroyComponent(node);
    node.querySelectorAll('[data-basecoat-component]').forEach(destroyComponent);
  };

  const uniqueElements = (elements) => Array.from(new Set(elements));

  const getComponentElements = (componentName, selector, force = false) => {
    const elements = Array.from(document.querySelectorAll(selector));
    if (force) {
      elements.push(...document.querySelectorAll(`[data-basecoat-component="${componentName}"]`));
    }
    return uniqueElements(elements);
  };

  const initAllComponents = (options = {}) => {
    const force = options.force === true;
    Object.entries(componentRegistry).forEach(([name, { selector }]) => {
      getComponentElements(name, selector, force).forEach((element) => {
        const wasComponent = element.dataset?.basecoatComponent === name;
        if (force) destroyComponent(element);
        if (wasComponent || element.matches(selector)) initComponent(element, name);
      });
    });
  };

  const initNewComponents = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    Object.entries(componentRegistry).forEach(([name, { selector }]) => {
      if (node.matches(selector)) initComponent(node, name);
      node.querySelectorAll(selector).forEach(element => initComponent(element, name));
    });
  };

  const refreshComponent = (element) => {
    if (!element) return;
    if (typeof element.refresh === 'function') {
      element.refresh();
      return;
    }

    const componentName = element.dataset?.basecoatComponent;
    const component = componentName ? componentRegistry[componentName] : null;
    if (component?.refresh) {
      component.refresh(element);
    }
  };

  const startObserver = () => {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(initNewComponents);
        mutation.removedNodes.forEach(destroyRemovedComponents);
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  const initRegisteredComponent = (componentName, options = {}) => {
    const component = componentRegistry[componentName];
    if (!component) {
      console.warn(`Component '${componentName}' not found in registry`);
      return;
    }

    const force = options.force === true;
    getComponentElements(componentName, component.selector, force).forEach((element) => {
      const wasComponent = element.dataset?.basecoatComponent === componentName;
      if (force) destroyComponent(element);
      if (wasComponent || element.matches(component.selector)) initComponent(element, componentName);
    });
  };

  const initAllRegisteredComponents = (options = {}) => {
    initAllComponents(options);
  };

  const setTheme = (mode) => {
    const dark = mode === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('themeMode', dark ? 'dark' : 'light'); } catch (_) {}
    document.dispatchEvent(new CustomEvent('basecoat:themechange', { detail: { mode: dark ? 'dark' : 'light' } }));
  };

  const getTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  window.basecoat = {
    register: registerComponent,
    init: initRegisteredComponent,
    initAll: initAllRegisteredComponents,
    refresh: refreshComponent,
    start: startObserver,
    stop: stopObserver,
    theme: {
      get: getTheme,
      set: setTheme,
      toggle: () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'),
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    initAllComponents();
    startObserver();
  });
})();

```

### Core Architecture Module: `src/js/chart.js`
```
(() => {
  const instances = new WeakMap();
  const activeCanvases = new Set();
  const defaultColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
  let refreshFrame = null;

  const isChartJsData = (data) => {
    return data && typeof data === 'object' && Array.isArray(data.datasets);
  };

  const resolveTarget = (target) => {
    if (typeof target === 'string') {
      const elements = Array.from(document.querySelectorAll(target));
      if (elements.length === 0) {
        throw new Error(`Chart target not found: ${target}`);
      }
      return elements;
    }

    if (target instanceof HTMLCanvasElement) return [target];
    if (target instanceof Element) {
      const canvas = target.matches('canvas') ? target : target.querySelector('canvas');
      if (canvas) return [canvas];
    }

    if (target instanceof NodeList || Array.isArray(target)) {
      return Array.from(target).flatMap(resolveTarget);
    }

    throw new Error('Chart target must be a selector, canvas, element, NodeList, or array.');
  };

  const readOption = (canvas, config, key, dataName) => {
    if (config[key] !== undefined) return config[key];
    return canvas.dataset[dataName];
  };

  const readBoolean = (canvas, config, key, dataName, defaultValue) => {
    const value = readOption(canvas, config, key, dataName);
    if (value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value;
    return value !== 'false';
  };

  const readJsonAttribute = (canvas, name) => {
    const value = canvas.getAttribute(name);
    if (!value) return undefined;

    try {
      return JSON.parse(value);
    } catch (error) {
      console.error(`Invalid JSON in ${name}:`, error);
      return undefined;
    }
  };

  const colorForIndex = (index) => defaultColors[index % defaultColors.length];

  const cloneChartData = (chartData) => {
    if (!isChartJsData(chartData)) return chartData;

    return {
      ...chartData,
      labels: Array.isArray(chartData.labels) ? [...chartData.labels] : chartData.labels,
      datasets: chartData.datasets.map((dataset) => ({
        ...dataset,
        data: Array.isArray(dataset.data) ? [...dataset.data] : dataset.data,
        backgroundColor: Array.isArray(dataset.backgroundColor) ? [...dataset.backgroundColor] : dataset.backgroundColor,
        borderColor: Array.isArray(dataset.borderColor) ? [...dataset.borderColor] : dataset.borderColor,
        hoverBackgroundColor: Array.isArray(dataset.hoverBackgroundColor) ? [...dataset.hoverBackgroundColor] : dataset.hoverBackgroundColor,
        hoverBorderColor: Array.isArray(dataset.hoverBorderColor) ? [...dataset.hoverBorderColor] : dataset.hoverBorderColor,
      })),
    };
  };

  const clonePlainObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      item && typeof item === 'object' && !Array.isArray(item) ? clonePlainObject(item) : item,
    ]));
  };

  const resolveColor = (color, element) => {
    if (Array.isArray(color)) return color.map(item => resolveColor(item, element));
    if (typeof color !== 'string') return color;

    const probe = document.createElement('span');
    probe.style.color = color;
    probe.style.display = 'none';
    (element.parentElement || document.body).appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();

    return resolved || color;
  };

  const colorWithAlpha = (color, alpha, element) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return color;

    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000';
    context.fillStyle = resolveColor(color, element);
    context.fillRect(0, 0, 1, 1);

    const [red, green, blue, sourceAlpha] = context.getImageData(0, 0, 1, 1).data;
    return `rgba(${red}, ${green}, ${blue}, ${(sourceAlpha / 255) * alpha})`;
  };

  const surfaceColor = (color, element, { from = 0.4, to } = {}) => {
    if (to === undefined) return colorWithAlpha(color, from, element);

    return ({ chart }) => {
      if (!chart.chartArea) return colorWithAlpha(color, from, element);

      const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
      gradient.addColorStop(0, colorWithAlpha(color, from, element));
      gradient.addColorStop(1, colorWithAlpha(color, to, element));
      return gradient;
    };
  };

  const resolveDatasetColors = (chartData, element) => {
    chartData.datasets?.forEach((dataset) => {
      dataset.borderColor = resolveColor(dataset.borderColor, element);
      dataset.backgroundColor = resolveColor(dataset.backgroundColor, element);
      dataset.hoverBorderColor = resolveColor(dataset.hoverBorderColor, element);
      dataset.hoverBackgroundColor = resolveColor(dataset.hoverBackgroundColor, element);
    });
    return chartData;
  };

  const resolveScaleColors = (scales, element) => {
    Object.values(scales || {}).forEach((scale) => {
      ['border', 'grid', 'ticks', 'angleLines', 'pointLabels'].forEach((key) => {
        if (scale[key]?.color !== undefined) {
          scale[key].color = resolveColor(scale[key].color, element);
        }
      });
    });

    return scales;
  };

  const chartColor = (element, token) => resolveColor(`var(${token})`, element);

  const colorMix = (color, opacity) => `color-mix(in oklab, ${color} ${opacity * 100}%, transparent)`;

  const readCssPixels = (element, property, fallback = 0) => {
    const value = getComputedStyle(element).getPropertyValue(property).trim();
    if (!value) return fallback;

    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const applyDatasetDefaults = (chartData, type, { barRadius, element }) => {
    chartData.datasets?.forEach((dataset) => {
      if (type === 'bar' || dataset.type === 'bar') {
        if (dataset.borderRadius === undefined) dataset.borderRadius = barRadius;
      }

      if (dataset._basecoatSurface) {
        dataset.backgroundColor = surfaceColor(dataset.borderColor || dataset.backgroundColor, element, dataset._basecoatSurface);
        delete dataset._basecoatSurface;
      }
    });

    return chartData;
  };

  const usesCartesianScales = (type) => !['pie', 'doughnut', 'polarArea', 'radar'].includes(type);

  const moveCanvasClassesToContainer = (canvas, container) => {
    const classes = Array.from(canvas.classList).filter((className) => className !== 'chart');
    if (classes.length === 0) return;

    container.classList.add(...classes);
    canvas.classList.remove(...classes);
  };

  const ensureContainer = (canvas) => {
    if (canvas.parentElement?.classList.contains('chart')) {
      canvas.parentElement.dataset.basecoatChartContainer = 'true';
      moveCanvasClassesToContainer(canvas, canvas.parentElement);
      return canvas.parentElement;
    }

    const container = document.createElement('div');
    container.className = 'chart';
    container.dataset.basecoatChartContainer = 'true';
    moveCanvasClassesToContainer(canvas, container);
    canvas.insertAdjacentElement('beforebegin', container);
    container.append(canvas);
    return container;
  };

  const seriesEntries = (series) => Object.entries(series || {});

  const valueFor = (row, key) => {
    if (row && typeof row === 'object') return row[key];
    return undefined;
  };

  const toChartData = ({ type, labelKey, data, series }) => {
    if (isChartJsData(data)) return cloneChartData(data);

    const rows = Array.isArray(data) ? data : [];
    const entries = seriesEntries(series);
    const labels = rows.map((row) => valueFor(row, labelKey));

    if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
      const [firstKey, firstSeries = {}] = entries[0] || [];
      return {
        labels,
        datasets: [{
          label: firstSeries.label || firstKey || 'Value',
          data: rows.map((row) => valueFor(row, firstKey)),
          backgroundColor: rows.map((row, index) => row?.color || row?.fill || colorForIndex(index)),
          borderColor: rows.map((row, index) => row?.color || row?.fill || colorForIndex(index)),
          ...(firstSeries.dataset || {}),
        }],
      };
    }

    return {
      labels,
      datasets: entries.map(([key, item], index) => {
        const color = item.color || colorForIndex(index);
        const dataset = item.dataset || {};
        const surface = item.surface === true
          ? { from: 0.4 }
          : item.surface === 'gradient'
            ? { from: 0.8, to: 0.1 }
            : item.surface;

        return {
          label: item.label || key,
          data: rows.map((row) => valueFor(row, key)),
          borderColor: color,
          backgroundColor: item.backgroundColor || color,
          fill: type === 'line' ? false : undefined,
          type: item.type,
          yAxisID: item.axis,
          hidden: item.hidden,
          ...dataset,
          ...(surface && item.backgroundColor === undefined && dataset.backgroundColor === undefined
            ? { _basecoatSurface: surface }
            : {}),
        };
      }),
    };
  };

  const formatValue = (value) => {
    return typeof value === 'number' ? value.toLocaleString() : String(value);
  };

  const colorForTooltipItem = (item) => {
    const elementColor = item.element?.options?.backgroundColor || item.element?.options?.borderColor;
    if (typeof elementColor === 'string') return elementColor;

    const backgroundColor = Array.isArray(item.dataset.backgroundColor)
      ? item.dataset.backgroundColor[item.dataIndex]
      : item.dataset.backgroundColor;
    if (typeof backgroundColor === 'string') return backgroundColor;

    const borderColor = Arr
```

### Core Architecture Module: `src/js/combobox.js`
```
(() => {
  const states = new WeakMap();

  const getElements = (root) => {
    const popover = root.querySelector(':scope > [data-popover]');
    const input = root.querySelector(':scope > input[role="combobox"], :scope > .input-group input[role="combobox"], :scope > .combobox-chips input[role="combobox"]')
      || popover?.querySelector('input[role="combobox"]');
    const chips = root.querySelector(':scope > .combobox-chips');
    const popupTrigger = root.querySelector(':scope > button[aria-haspopup="listbox"]');
    const trigger = popupTrigger || root.querySelector(':scope > .input-group button[aria-haspopup="listbox"]');
    const clearButton = root.querySelector('[data-clear]');
    const valueTarget = popupTrigger?.querySelector('[data-value]') || (popupTrigger?.matches('[data-value]') ? popupTrigger : null);
    const listbox = popover ? popover.querySelector('[role="listbox"]') : null;
    const hiddenInput = root.querySelector(':scope > input[type="hidden"]');
    return { input, chips, trigger, clearButton, valueTarget, popover, listbox, hiddenInput };
  };

  const ensureMultipleInputSurface = (root, elements) => {
    if (elements.listbox?.getAttribute('aria-multiselectable') !== 'true' || elements.chips || !elements.input) return elements;
    if (elements.input.parentElement !== root) return elements;

    const chips = document.createElement('div');
    chips.className = 'combobox-chips';
    root.insertBefore(chips, elements.input);
    chips.appendChild(elements.input);

    return getElements(root);
  };

  const getValue = option => option.dataset.value ?? option.textContent.trim();
  const getLabel = option => option.dataset.label || option.textContent.trim();
  const getFormat = root => root.dataset.format === 'object' ? 'object' : 'value';
  const isDisabled = option => option.getAttribute('aria-disabled') === 'true';
  const toSelected = option => ({ value: getValue(option), label: getLabel(option) });
  const normalizeEntry = entry => {
    if (entry && typeof entry === 'object') {
      const value = entry.value == null ? '' : String(entry.value);
      return value ? { value, label: String(entry.label ?? entry.value) } : null;
    }
    const value = entry == null ? '' : String(entry);
    return value ? { value, label: value } : null;
  };

  const getOptions = (listbox) => {
    const allOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
    return {
      allOptions,
      options: allOptions.filter(option => !isDisabled(option)),
    };
  };

  const getSelection = (state) => Array.from(state.selected.values());
  const getCanonicalValue = (state) => state.isMultiple ? getSelection(state).map(item => item.value) : (getSelection(state)[0]?.value || '');
  const getSelectedDetail = (state) => state.isMultiple ? getSelection(state) : (getSelection(state)[0] || null);

  const serializeSelection = (state) => {
    const selected = getSelection(state);
    if (state.format === 'object') {
      return JSON.stringify(state.isMultiple ? selected : (selected[0] || null));
    }
    const value = selected.map(item => item.value);
    return state.isMultiple ? JSON.stringify(value) : (value[0] || '');
  };

  const parseStoredSelection = (storedValue, inputValue, state) => {
    if (state.isMultiple) {
      let parsed = [];
      try {
        parsed = JSON.parse(storedValue || '[]');
      } catch (_) {
        parsed = [];
      }
      if (!Array.isArray(parsed)) return [];
      return parsed.map(item => {
        const entry = normalizeEntry(state.format === 'object' ? item : { value: item, label: state.selected.get(String(item))?.label ?? item });
        if (!entry) return null;
        const option = state.options.find(opt => getValue(opt) === entry.value);
        return option ? toSelected(option) : entry;
      }).filter(Boolean);
    }

    if (state.format === 'object') {
      try {
        const entry = normalizeEntry(JSON.parse(storedValue || 'null'));
        if (!entry) return [];
        const option = state.options.find(opt => getValue(opt) === entry.value);
        return [option ? toSelected(option) : entry];
      } catch (_) {
        return [];
      }
    }

    const value = storedValue || '';
    if (!value) return [];
    const option = state.options.find(opt => getValue(opt) === value);
    return [option ? toSelected(option) : { value, label: state.selected.get(value)?.label || inputValue || value }];
  };

  const scrollOptionIntoListbox = (state, option) => {
    const optionRect = option.getBoundingClientRect();
    const listboxRect = state.listbox.getBoundingClientRect();

    if (optionRect.top < listboxRect.top) {
      state.listbox.scrollTop -= listboxRect.top - optionRect.top;
    } else if (optionRect.bottom > listboxRect.bottom) {
      state.listbox.scrollTop += optionRect.bottom - listboxRect.bottom;
    }
  };

  const setActiveOption = (state, index) => {
    if (state.activeIndex > -1 && state.options[state.activeIndex]) {
      state.options[state.activeIndex].classList.remove('active');
    }

    state.activeIndex = index;

    if (state.activeIndex > -1) {
      const activeOption = state.options[state.activeIndex];
      activeOption.classList.add('active');
      if (!activeOption.id) activeOption.id = `${state.listbox.id || state.root.id || 'combobox'}-option-${state.activeIndex}`;
      state.input.setAttribute('aria-activedescendant', activeOption.id);
    } else {
      state.input.removeAttribute('aria-activedescendant');
    }
  };

  const syncEmptyState = (state) => {
    state.popover.dataset.empty = String(state.visibleOptions.length === 0);
  };

  const filterOptions = (state, { preserveActive = false, search: forcedSearch } = {}) => {
    const previousActive = state.activeIndex > -1 ? state.options[state.activeIndex] : null;
    state.visibleOptions = [];

    if (state.manualFilter) {
      state.visibleOptions = state.options.filter(option => option.getAttribute('aria-hidden') !== 'true');

      if (preserveActive && previousActive && state.visibleOptions.includes(previousActive)) {
        setActiveOption(state, state.options.indexOf(previousActive));
      } else {
        setActiveOption(state, state.autoHighlight && state.visibleOptions.length > 0 ? state.options.indexOf(state.visibleOptions[0]) : -1);
      }
      syncEmptyState(state);
      return;
    }

    const search = (forcedSearch ?? state.input.value).trim().toLowerCase();

    state.allOptions.forEach(option => {
      if (option.hasAttribute('data-force')) {
        option.setAttribute('aria-hidden', 'false');
        if (state.options.includes(option)) state.visibleOptions.push(option);
        return;
      }

      const optionText = (option.dataset.filter || option.dataset.label || option.textContent).trim().toLowerCase();
      const keywords = (option.dataset.keywords || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
      const matches = !search || optionText.includes(search) || keywords.some(keyword => keyword.includes(search));
      option.setAttribute('aria-hidden', String(!matches));
      if (matches && state.options.includes(option)) state.visibleOptions.push(option);
    });

    if (preserveActive && previousActive && state.visibleOptions.includes(previousActive)) {
      setActiveOption(state, state.options.indexOf(previousActive));
    } else {
      setActiveOption(state, state.autoHighlight && state.visibleOptions.length > 0 ? state.options.indexOf(state.visibleOptions[0]) : -1);
    }
    syncEmptyState(state);
  };

  const renderChips = (root) => {
    const state = states.get(root);
    if (!state.chips) return;

    state.chips.querySelectorAll('.combobox-chip').forEach(chip => chip.remove());

    getSelection(state).forEach(entry => {
      const chip = document.createElement('span');
      chip.className = 'combobox-chip';
      chip.dataset.value = entry.value;

      const label = document.createElement('span');
      label.textContent = entry.label;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'combobox-chip-remove btn';
      remove.dataset.variant = 'ghost';
      remove.dataset.size = 'icon-xs';
      remove.setAttribute('aria-label', `Remove ${entry.label}`);
      remove.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        root.deselect(entry.value);
        state.input.focus();
      });

      chip.appendChild(label);
      chip.appendChild(remove);
      state.chips.insertBefore(chip, state.input);
    });
  };

  const syncTriggerValue = (state) => {
    if (!state.valueTarget) return;
    const selected = getSelection(state);
    state.valueTarget.textContent = state.isMultiple
      ? selected.map(entry => entry.label).join(', ')
      : (selected[0]?.label || state.valueTarget.dataset.placeholder || '');
  };

  const syncClearButton = (state) => {
    if (!state.clearButton) return;
    state.clearButton.hidden = getSelection(state).length === 0 && state.input.value === '';
  };

  const syncSelectedOptions = (state) => {
    state.options.forEach(option => {
      if (state.selected.has(getValue(option))) {
        option.setAttribute('aria-selected', 'true');
      } else {
        option.removeAttribute('aria-selected');
      }
    });
  };

  const setSelected = (root, entries, triggerEvent = true) => {
    const state = states.get(root);
    const normalized = (Array.isArray(entries) ? entries : [entries]).map(normalizeEntry).filter(Boolean);

    state.selected.clear();
    if (state.isMultiple) {
      normalized.forEach(entry => state.selected.set(entry.value, entry));
      state.input.value = '';
    } else if (normalized[0]) {
```

### Core Architecture Module: `src/js/command.js`
```
(() => {
  const states = new WeakMap();

  const isDisabled = (item) =>
    item.hasAttribute('disabled') ||
    item.getAttribute('aria-disabled') === 'true' ||
    item.getAttribute('data-disabled') === 'true';

  const getElements = (container) => ({
    input: container.querySelector('header input'),
    menu: container.querySelector('[role="menu"]'),
  });

  const getItems = (menu) => {
    const allItems = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    return {
      allItems,
      items: allItems.filter(item => !isDisabled(item)),
    };
  };

  const scrollItemIntoMenu = (state, item) => {
    const itemRect = item.getBoundingClientRect();
    const menuRect = state.menu.getBoundingClientRect();

    if (itemRect.top < menuRect.top) {
      state.menu.scrollTop -= menuRect.top - itemRect.top;
    } else if (itemRect.bottom > menuRect.bottom) {
      state.menu.scrollTop += itemRect.bottom - menuRect.bottom;
    }
  };

  const setActiveItem = (state, index) => {
    if (state.activeIndex > -1 && state.items[state.activeIndex]) {
      state.items[state.activeIndex].classList.remove('active');
    }

    state.activeIndex = index;

    if (state.activeIndex > -1) {
      const activeItem = state.items[state.activeIndex];
      activeItem.classList.add('active');
      if (activeItem.id) {
        state.input.setAttribute('aria-activedescendant', activeItem.id);
      } else {
        state.input.removeAttribute('aria-activedescendant');
      }
    } else {
      state.input.removeAttribute('aria-activedescendant');
    }
  };

  const filterItems = (state) => {
    if (state.manualFilter) {
      setActiveItem(state, -1);
      state.visibleItems = state.items.filter(item => item.getAttribute('aria-hidden') !== 'true');
      if (state.visibleItems.length > 0) {
        setActiveItem(state, state.items.indexOf(state.visibleItems[0]));
      }
      return;
    }

    const searchTerm = state.input.value.trim().toLowerCase();

    setActiveItem(state, -1);
    state.visibleItems = [];

    state.allItems.forEach(item => {
      if (item.hasAttribute('data-force')) {
        item.setAttribute('aria-hidden', 'false');
        if (state.items.includes(item)) state.visibleItems.push(item);
        return;
      }

      const itemText = (item.dataset.filter || item.textContent).trim().toLowerCase();
      const keywordList = (item.dataset.keywords || '')
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);
      const matchesKeyword = keywordList.some(keyword => keyword.includes(searchTerm));
      const matches = itemText.includes(searchTerm) || matchesKeyword;
      item.setAttribute('aria-hidden', String(!matches));
      if (matches && state.items.includes(item)) state.visibleItems.push(item);
    });

    if (state.visibleItems.length > 0) {
      setActiveItem(state, state.items.indexOf(state.visibleItems[0]));
      scrollItemIntoMenu(state, state.visibleItems[0]);
    }
  };

  const refreshCommand = (container) => {
    const state = states.get(container);
    if (!state) return;

    const elements = getElements(container);
    if (!elements.input || !elements.menu) {
      const missing = [];
      if (!elements.input) missing.push('input');
      if (!elements.menu) missing.push('menu');
      console.error(`Command component refresh failed. Missing element(s): ${missing.join(', ')}`, container);
      return;
    }

    Object.assign(state, elements, getItems(elements.menu));
    state.manualFilter = container.dataset.filter === 'manual';
    filterItems(state);
  };

  const handleKeyNavigation = (event, state) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Home', 'End'].includes(event.key)) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      if (state.activeIndex > -1) state.items[state.activeIndex]?.click();
      return;
    }

    if (state.visibleItems.length === 0) return;

    event.preventDefault();

    const currentVisibleIndex = state.activeIndex > -1 ? state.visibleItems.indexOf(state.items[state.activeIndex]) : -1;
    let nextVisibleIndex = currentVisibleIndex;

    if (event.key === 'ArrowDown' && currentVisibleIndex < state.visibleItems.length - 1) nextVisibleIndex = currentVisibleIndex + 1;
    if (event.key === 'ArrowUp') nextVisibleIndex = currentVisibleIndex > 0 ? currentVisibleIndex - 1 : 0;
    if (event.key === 'Home') nextVisibleIndex = 0;
    if (event.key === 'End') nextVisibleIndex = state.visibleItems.length - 1;

    if (nextVisibleIndex !== currentVisibleIndex) {
      const newActiveItem = state.visibleItems[nextVisibleIndex];
      setActiveItem(state, state.items.indexOf(newActiveItem));
      scrollItemIntoMenu(state, newActiveItem);
    }
  };

  const initCommand = (container) => {
    if (container.dataset.commandInitialized) return;

    const state = { activeIndex: -1, allItems: [], items: [], visibleItems: [], manualFilter: false };
    states.set(container, state);

    container.refresh = () => refreshCommand(container);

    const elements = getElements(container);
    if (!elements.input || !elements.menu) {
      const missing = [];
      if (!elements.input) missing.push('input');
      if (!elements.menu) missing.push('menu');
      console.error(`Command component initialization failed. Missing element(s): ${missing.join(', ')}`, container);
      states.delete(container);
      delete container.refresh;
      return;
    }
    Object.assign(state, elements);

    const handleInput = () => filterItems(state);
    const handleInputKeydown = (event) => handleKeyNavigation(event, state);
    const handleMenuMousemove = (event) => {
      const menuItem = event.target.closest('[role="menuitem"]');
      if (menuItem && state.visibleItems.includes(menuItem)) {
        const index = state.items.indexOf(menuItem);
        if (index !== state.activeIndex) setActiveItem(state, index);
      }
    };
    const handleMenuClick = (event) => {
      const clickedItem = event.target.closest('[role="menuitem"]');
      if (clickedItem && state.visibleItems.includes(clickedItem)) {
        const dialog = container.closest('dialog.command-dialog');
        if (dialog && !clickedItem.hasAttribute('data-keep-command-open')) dialog.close();
      }
    };

    state.input.addEventListener('input', handleInput);
    state.input.addEventListener('keydown', handleInputKeydown);
    state.menu.addEventListener('mousemove', handleMenuMousemove);
    state.menu.addEventListener('click', handleMenuClick);

    container._destroy = () => {
      state.input.removeEventListener('input', handleInput);
      state.input.removeEventListener('keydown', handleInputKeydown);
      state.menu.removeEventListener('mousemove', handleMenuMousemove);
      state.menu.removeEventListener('click', handleMenuClick);
      states.delete(container);
      delete container.refresh;
    };

    refreshCommand(container);
    container.dataset.commandInitialized = 'true';
    container.dispatchEvent(new CustomEvent('basecoat:initialized'));
  };

  if (window.basecoat) {
    window.basecoat.register('command', {
      selector: '.command:not([data-command-initialized])',
      init: initCommand,
      refresh: refreshCommand,
    });
  }
})();

```

### Core Architecture Module: `src/js/drawer.js`
```
(() => {
  const toMs = (value) => {
    if (!value) return 0;
    const trimmed = value.trim();
    if (trimmed.endsWith('ms')) return parseFloat(trimmed) || 0;
    if (trimmed.endsWith('s')) return (parseFloat(trimmed) || 0) * 1000;
    return parseFloat(trimmed) || 0;
  };

  const maxTransitionMs = (element) => {
    if (!element) return 0;
    const styles = getComputedStyle(element);
    const durations = styles.transitionDuration.split(',').map(toMs);
    const delays = styles.transitionDelay.split(',').map(toMs);
    return Math.max(0, ...durations.map((duration, index) => duration + (delays[index] || delays[0] || 0)));
  };

  const initDrawer = (drawer) => {
    if (drawer.dataset.drawerInitialized) return;

    const nativeClose = drawer.close.bind(drawer);
    let pointerStartedOnBackdrop = false;
    let closeTimer = null;

    const finishClose = (returnValue) => {
      window.clearTimeout(closeTimer);
      closeTimer = null;
      drawer.removeAttribute('data-closing');
      nativeClose(returnValue);
    };

    drawer.close = (returnValue = '') => {
      if (!drawer.open) return;
      if (drawer.dataset.closing) return;

      const content = drawer.firstElementChild;
      const duration = maxTransitionMs(content);

      if (duration === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishClose(returnValue);
        return;
      }

      drawer.dataset.closing = 'true';
      closeTimer = window.setTimeout(() => finishClose(returnValue), duration + 50);
    };

    const handleCancel = (event) => {
      event.preventDefault();
      drawer.close();
    };

    const handlePointerDown = (event) => {
      pointerStartedOnBackdrop = event.target === drawer;
    };

    const handlePointerUp = (event) => {
      if (pointerStartedOnBackdrop && event.target === drawer) {
        drawer.close();
      }
      pointerStartedOnBackdrop = false;
    };

    drawer.addEventListener('cancel', handleCancel);
    drawer.addEventListener('pointerdown', handlePointerDown);
    drawer.addEventListener('pointerup', handlePointerUp);

    drawer._destroy = () => {
      window.clearTimeout(closeTimer);
      drawer.removeEventListener('cancel', handleCancel);
      drawer.removeEventListener('pointerdown', handlePointerDown);
      drawer.removeEventListener('pointerup', handlePointerUp);
      drawer.close = nativeClose;
      delete drawer._destroy;
    };

    drawer.dataset.drawerInitialized = 'true';
    drawer.dispatchEvent(new CustomEvent('basecoat:initialized'));
  };

  if (window.basecoat) {
    window.basecoat.register('drawer', '.drawer:not([data-drawer-initialized])', initDrawer);
  }
})();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #192** (2026-07-30): **shadcn/ui theming no longer supported?**
  *Symptoms*: Firstly congrats on the recent upgrade to v1.   However, it seems to have moved from the using the same theming conventions and so  it means that shadcn/ui themes are no longer compatible? I've tried using a few of them, including ones from 'tweakcn' and none of them appear to work.   Are we now left with a choice of the built in ones (great work by the way) or building our own my overwriting the CSS variables?
  **Post-Mortem & Fix Analysis**:
  > Apologies, this was my mistake. Confirming that shadcn/ui themes do work

- **Issue #189** (2026-07-21): **Fix HTMX toast docs URL push**
  *Symptoms*: Closes #186\n\nAdds hx-push-url="false" to the Toast docs HTMX example so the docs site does not replace the current page URL when the demo button is clicked.
  **Post-Mortem & Fix Analysis**:
  > ## Deploying with &nbsp;<a href="https://workers.dev"><img alt="Cloudflare Workers" src="https://workers.cloudflare.com/logo.svg" width="16"></a> &nbsp;Cloudflare Workers The latest updates on your project. Learn more about [integrating Git with Workers](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).  | Status | Name | Latest Commit | Preview URL | Updated (UTC) | | -|-|-|-|-| | ✅ Deployment successful! <br>[View logs](https://dash.cloudflare.com/?to=/f0358488ea228524694022b948be5869/workers/services/view/basecoat/production/builds/b602df2d-26ae-4db3-8878-1b2e4e1d6096) | basecoat | 565ea3c3 | <a href='https://b796fff7-basecoat.hunvreus.workers.dev'>Commit Preview URL</a><br><br><a href='https://fix-toast-htmx-push-url-basecoat.hunvreus.workers.dev'>Branch Preview URL</a> | Jul 16 2026, 04:02 PM |

- **Issue #188** (2026-07-15): **Fix form migration notes for Tailwind v4**
  *Symptoms*: ## Summary - Replace the invalid `.form` migration snippet that used `@apply label/input/textarea/select` - Point users at the current `.field` / `.label` / `.input` / `.textarea` / `.select` structure instead - Add a note explaining that Basecoat component classes should not be `@apply`ed in Tailwind v4  Fixes #184
  **Post-Mortem & Fix Analysis**:
  > ## Deploying with &nbsp;<a href="https://workers.dev"><img alt="Cloudflare Workers" src="https://workers.cloudflare.com/logo.svg" width="16"></a> &nbsp;Cloudflare Workers The latest updates on your project. Learn more about [integrating Git with Workers](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).  | Status | Name | Latest Commit | Preview URL | Updated (UTC) | | -|-|-|-|-| | ✅ Deployment successful! <br>[View logs](https://dash.cloudflare.com/?to=/f0358488ea228524694022b948be5869/workers/services/view/basecoat/production/builds/25564c6c-5e41-415a-bdc7-d95457729e63) | basecoat | 84ee3ff2 | <a href='https://e04022e8-basecoat.hunvreus.workers.dev'>Commit Preview URL</a><br><br><a href='https://fix-issue-184-release-notes-basecoat.hunvreus.workers.dev'>Branch Preview URL</a> | Jul 15 2026, 04:53 AM |

- **Issue #181** (2026-06-30): **feat: add resizable panel group with handles**
  *Symptoms*: Closes #31.\n\nAdds a native resizable panel group with focusable separator handles, pointer and keyboard resizing, CSS, JS, templates, and docs.\n\nValidation:\n- npm run build\n- npm run docs:build
  **Post-Mortem & Fix Analysis**:
  > ## Deploying with &nbsp;<a href="https://workers.dev"><img alt="Cloudflare Workers" src="https://workers.cloudflare.com/logo.svg" width="16"></a> &nbsp;Cloudflare Workers The latest updates on your project. Learn more about [integrating Git with Workers](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).  | Status | Name | Latest Commit | Updated (UTC) | | -|-|-|-| | ❌ Deployment failed <br>[View logs](https://dash.cloudflare.com/?to=/f0358488ea228524694022b948be5869/workers/services/view/basecoat/production/builds/930a3982-e15b-4ef9-9a22-6651314a057f) | basecoat | 0b393056 | Jun 30 2026, 08:40 AM |

- **Issue #180** (2026-06-29): **feat: add Navigation Menu component**
  *Symptoms*: Adds the new Navigation Menu component for issue #39.  Includes: - component CSS - Jinja/Nunjucks macros - docs page and docs navigation entry - CSS entrypoint generation updates - changelog note  Validation: - npm ci - npm run build
  **Post-Mortem & Fix Analysis**:
  > ## Deploying with &nbsp;<a href="https://workers.dev"><img alt="Cloudflare Workers" src="https://workers.cloudflare.com/logo.svg" width="16"></a> &nbsp;Cloudflare Workers The latest updates on your project. Learn more about [integrating Git with Workers](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).  | Status | Name | Latest Commit | Updated (UTC) | | -|-|-|-| | ❌ Deployment failed <br>[View logs](https://dash.cloudflare.com/?to=/f0358488ea228524694022b948be5869/workers/services/view/basecoat/production/builds/8684d110-27e4-40b6-95e1-5605c2897795) | basecoat | 2b6d0d91 | Jun 29 2026, 01:57 PM |

- **Issue #178** (2026-06-26): **Scroll-area doesn't match "Sera" theme**
  *Symptoms*: Not sure if this is the issue, but the component scroll-area doesn't look good on the "Sera" theme; it has rounded corners, but should not have them. Should it be corners?   https://basecoat.hunvreus.workers.dev/components/scroll-area/  <img width="1460" height="972" alt="Image" src="https://github.com/user-attachments/assets/7688ab87-c5c1-42fc-878e-07ef3f5de11d" />
  **Post-Mortem & Fix Analysis**:
  > Fixed https://basecoat.hunvreus.workers.dev/components/scroll-area/

- **Issue #177** (2026-06-26): **Dropdown  z-index issue**
  *Symptoms*: https://basecoat.hunvreus.workers.dev/components/input-group/  <img width="1384" height="720" alt="Image" src="https://github.com/user-attachments/assets/465dd4f5-036e-49e0-a692-9acbd7d1ec90" />
  **Post-Mortem & Fix Analysis**:
  > Fixed, it was an isolate issue.

- **Issue #176** (2026-06-25): **Command preview**
  *Symptoms*: Command preview carrying styles from other themes in the "Sera" theme.  <img width="1402" height="1024" alt="Image" src="https://github.com/user-attachments/assets/ae0a6ffb-2dc3-49f6-9575-7f287d6f19f4" />  It should be like this:  <img width="814" height="750" alt="Image" src="https://github.com/user-attachments/assets/1790918f-317d-4527-838b-61df521235d6" />
  **Post-Mortem & Fix Analysis**:
  > Fixed.  Thanks.

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

### Incident Patch 1: `d431873b` (2026-06-27)
**Commit Message**: Fix docs sidebar after history restore

**File**: `site/src/scripts/demo-interactions.js` (modified, +2/-3)
```diff
@@ -1,6 +1,3 @@
-import "../../../src/js/basecoat.js";
-import "../../../src/js/accordion.js";
-
 const initPriceRange = () => {
   const input = document.getElementById("price-range");
   const output = document.getElementById("price-range-output");
@@ -104,3 +101,5 @@ if (document.readyState === "loading") {
 } else {
   initDemos();
 }
+
+document.addEventListener("htmx:afterSettle", initDemos);
```

**File**: `src/js/sidebar.js` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 (() => {
   const initSidebar = (sidebarComponent) => {
-    if (sidebarComponent.dataset.sidebarInitialized) return;
+    if (sidebarComponent.dataset.sidebarInitialized && typeof sidebarComponent.toggle === 'function') return;
 
     const initialOpen = sidebarComponent.dataset.initialOpen !== 'false';
     const initialMobileOpen = sidebarComponent.dataset.initialMobileOpen === 'true';
@@ -60,6 +60,6 @@
   };
 
   if (window.basecoat) {
-    window.basecoat.register('sidebar', '.sidebar:not([data-sidebar-initialized])', initSidebar);
+    window.basecoat.register('sidebar', '.sidebar', initSidebar);
   }
 })();
```

---

### Incident Patch 2: `537f7750` (2026-06-27)
**Commit Message**: Install site dependencies during docs build

**File**: `package.json` (modified, +4/-4)
```diff
@@ -123,12 +123,12 @@
   "scripts": {
     "build": "node ./scripts/build.js",
     "prepack": "node ./scripts/build.js",
-    "docs:build": "npm run build && npm --prefix site run build",
+    "docs:build": "npm run build && npm --prefix site clean-install --progress=false && npm --prefix site run build",
     "docs:dev": "npm --prefix site run dev",
     "docs:preview": "npm run docs:build && npm --prefix site run preview",
-    "workers:dev": "npm run build && npm --prefix site run workers:dev",
-    "workers:deploy": "npm run build && npm --prefix site run workers:deploy",
-    "workers:preview": "npm run build && npm --prefix site run workers:preview"
+    "workers:dev": "npm run build && npm --prefix site clean-install --progress=false && npm --prefix site run workers:dev",
+    "workers:deploy": "npm run build && npm --prefix site clean-install --progress=false && npm --prefix site run workers:deploy",
+    "workers:preview": "npm run build && npm --prefix site clean-install --progress=false && npm --prefix site run workers:preview"
   },
   "devDependencies": {
     "@tailwindcss/cli": "^4.1.17",
```

**File**: `site/package-lock.json` (modified, +185/-11)
```diff
@@ -2439,6 +2439,20 @@
       "resolved": "..",
       "link": true
     },
+    "node_modules/binary-extensions": {
+      "version": "2.3.0",
+      "resolved": "https://registry.npmjs.org/binary-extensions/-/binary-extensions-2.3.0.tgz",
+      "integrity": "sha512-Ceh+7ox5qe7LJuLHoY0feh3pHuUDHAcRUeyL2VYghZwfpkNIy/+8Ocg0a3UuSoYzavmylwuLWQOf3hl0jjMMIw==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "engines": {
+        "node": ">=8"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/sindresorhus"
+      }
+    },
     "node_modules/blake3-wasm": {
       "version": "2.1.5",
       "resolved": "https://registry.npmjs.org/blake3-wasm/-/blake3-wasm-2.1.5.tgz",
@@ -2452,6 +2466,20 @@
       "integrity": "sha512-JZOSA7Mo9sNGB8+UjSgzdLtokWAky1zbztM3WRLCbZ70/3cTANmQmOdR7y2g+J0e2WXywy1yS468tY+IruqEww==",
       "license": "ISC"
     },
+    "node_modules/braces": {
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "fill-range": "^7.1.1"
+      },
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/ccount": {
       "version": "2.0.1",
       "resolved": "https://registry.npmjs.org/ccount/-/ccount-2.0.1.tgz",
@@ -2503,18 +2531,29 @@
       }
     },
     "node_modules/chokidar": {
-      "version": "5.0.0",
-      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-5.0.0.tgz",
-      "integrity": "sha512-TQMmc3w+5AxjpL8iIiwebF73dRDF4fBIieAqGn9RGCWaEVwQ6Fb2cGe31Yns0RRIzii5goJ1Y7xbMwo1TxMplw==",
+      "version": "3.6.0",
+      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz",
+      "integrity": "sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==",
       "license": "MIT",
+      "optional": true,
+      "peer": true,
       "dependencies": {
-        "readdirp": "^5.0.0"
+        "anymatch": "~3.1.2",
+        "braces": "~3.0.2",
+        "glob-parent": "~5.1.2",
+        "is-binary-path": "~2.1.0",
+        "is-glob": "~4.0.1",
+        "normalize-path": "~3.0.0",
+        "readdirp": "~3.6.0"
       },
       "engines": {
-        "node": ">= 20.19.0"
+        "node": ">= 8.10.0"
       },
       "funding": {
         "url": "https://paulmillr.com/funding/"
+      },
+      "optionalDependencies": {
+        "fsevents": "~2.3.2"
       }
     },
     "node_modules/ci-info": {
@@ -3121,6 +3160,20 @@
         }
       }
     },
+    "node_modules/fill-range": {
+      "version": "7.1.1",
+      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "to-regex-range": "^5.0.1"
+      },
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/flattie": {
       "version": "1.1.1",
       "resolved": "https://registry.npmjs.org/flattie/-/flattie-1.1.1.tgz",
@@ -3186,6 +3239,20 @@
       "integrity": "sha512-IaOQ9puYtjrkq7Y0Ygl9KDZnrf/aiUJYUpVf89y8kyaxbRG7Y1SrX/jaumrv81vc61+kiMempujsM3Yw7w5qcw==",
       "license": "ISC"
     },
+    "node_modules/glob-parent": {
+      "version": "5.1.2",
+      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
+      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
+      "license": "ISC",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "is-glob": "^4.0.1"
+      },
+      "engines": {
+        "node": ">= 6"
+      }
+    },
     "node_modules/graceful-fs": {
       "version": "4.2.11",
       "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
@@ -3508,6 +3575,20 @@
         "url": "https://github.com/sponsors/wooorm"
       }
     },
+    "node_modules/is-binary-path": {
+      "version": "2.1.0",
+      "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
+      "integrity": "sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "binary-extensions": "^2.0.0"
+      },
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/is-decimal": {
       "version": "2.0.1",
       "resolved": "https://registry.npmjs.org/is-decimal/-/is-decimal-2.0.1.tgz",
@@ -3533,6 +3614,31 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/is-extglob": {
+      "version": "2.1.1",
+      "resolved": "https://registry.np
```

---

### Incident Patch 3: `be386450` (2026-06-26)
**Commit Message**: Fix input group dropdown stacking

**File**: `src/css/components/input-group.css` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@
   .input-group {
     @apply relative isolate flex w-full min-w-0 items-center outline-none;
 
+    &:has(> :is(.dropdown-menu, .popover, .select, .combobox) > [data-popover][aria-hidden='false']) {
+      @apply z-50;
+    }
+
     &[data-orientation='vertical'],
     &:has(> [data-align='block-start']),
     &:has(> [data-align='block-end']) {
```

---

### Incident Patch 4: `3b49a0ef` (2026-06-25)
**Commit Message**: Fix rounded drawer side positioning

**File**: `src/css/styles/luma.css` (modified, +1/-1)
```diff
@@ -595,7 +595,7 @@
   }
 
   .drawer > * {
-    @apply before:bg-popover before:border-border relative bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-4xl before:border before:shadow-xl;
+    @apply before:bg-popover before:border-border bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-4xl before:border before:shadow-xl;
   }
 
   .drawer > * > header {
```

**File**: `src/css/styles/maia.css` (modified, +1/-1)
```diff
@@ -583,7 +583,7 @@
   }
 
   .drawer > * {
-    @apply before:bg-popover text-popover-foreground before:border-border relative bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-4xl before:border;
+    @apply before:bg-popover text-popover-foreground before:border-border bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-4xl before:border;
   }
 
   .drawer > * > header {
```

**File**: `src/css/styles/mira.css` (modified, +1/-1)
```diff
@@ -587,7 +587,7 @@
   }
 
   .drawer > * {
-    @apply before:bg-popover text-popover-foreground before:border-border relative bg-transparent p-2 text-xs/relaxed before:absolute before:inset-2 before:-z-10 before:rounded-xl before:border;
+    @apply before:bg-popover text-popover-foreground before:border-border bg-transparent p-2 text-xs/relaxed before:absolute before:inset-2 before:-z-10 before:rounded-xl before:border;
   }
 
   .drawer > * > header {
```

**File**: `src/css/styles/rhea.css` (modified, +1/-1)
```diff
@@ -595,7 +595,7 @@
   }
 
   .drawer > * {
-    @apply before:bg-popover before:border-border relative bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-[min(var(--radius-4xl),24px)] before:border before:shadow-xl;
+    @apply before:bg-popover before:border-border bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-[min(var(--radius-4xl),24px)] before:border before:shadow-xl;
   }
 
   .drawer > * > header {
```

---

### Incident Patch 5: `6c87a5cd` (2026-06-25)
**Commit Message**: Fix Sera command preview styling

**File**: `docs/src/components/command.mdx` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # Command
 
 <Preview class="w-full max-w-sm">
-<div id="demo-command-standalone" class="command rounded-lg border" aria-label="Command menu">
+<div id="demo-command-standalone" class="command" aria-label="Command menu">
   <header><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
     <input type="text" id="demo-command-standalone-input" placeholder="Type a command or search..." autocomplete="off" autocorrect="off" spellcheck="false" aria-autocomplete="list" role="combobox" aria-expanded="true" aria-controls="demo-command-standalone-menu" />
   </header>
```

**File**: `src/css/styles/sera.css` (modified, +2/-2)
```diff
@@ -361,11 +361,11 @@
 
   /* Command */
   .command {
-    @apply bg-popover text-popover-foreground rounded-none;
+    @apply bg-popover text-popover-foreground rounded-none!;
   }
 
   .command-dialog > .command {
-    @apply bg-popover text-popover-foreground ring-foreground/10 rounded-none shadow-md ring-1 duration-100;
+    @apply bg-popover text-popover-foreground ring-foreground/10 rounded-none! shadow-md ring-1 duration-100;
   }
 
   .command > header {
```

---

### Incident Patch 6: `77c5281f` (2026-06-25)
**Commit Message**: Fixing assets

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -11,6 +11,6 @@ packages/css/dist/
 npm-debug.log*
 dist/
 docs/generated/
-public/assets/
+public/assets/js/
 
 public/fragments/
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 Basecoat is a Tailwind CSS, vanilla HTML/CSS/JavaScript implementation of the shadcn/ui design system. It provides shadcn-style components for any web stack without React, Radix, or framework runtime dependencies.
 
-![screenshot](docs/src/assets/images/screenshot.png)
+![screenshot](public/assets/images/screenshot.png)
 
 ## Features
 
```

**File**: `docs/src/assets/discord.svg` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Discord</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
\ No newline at end of file
```

**File**: `docs/src/customization.mdx` (modified, +4/-4)
```diff
@@ -45,7 +45,7 @@ Learn more in the [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming).
 
 ## Fonts
 
-Basecoat does not ship web fonts by default. The docs site uses the same font choices as the current shadcn/ui site: [Geist Sans](https://fonts.google.com/specimen/Geist) for sans and heading text, and [Geist Mono](https://fonts.google.com/specimen/Geist+Mono) for monospace text.
+Basecoat does not ship web font files by default. Its font tokens prefer [Geist Sans](https://fonts.google.com/specimen/Geist) and [Geist Mono](https://fonts.google.com/specimen/Geist+Mono) when those fonts are available, then fall back to the full Tailwind default sans and mono stacks.
 
 Install the fonts with Fontsource:
 
@@ -67,9 +67,9 @@ Then import the font files and override the font tokens after Basecoat:
 @import "@fontsource/geist-mono/600.css";
 @import "@fontsource/geist-mono/700.css";
 :root {
-  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
-  --font-heading: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
-  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
+  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
+  --font-heading: "Geist Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
+  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
 }
 ```
 
```

**File**: `docs/src/site/StyleHead.astro` (modified, +59/-0)
```diff
@@ -22,6 +22,65 @@ const styleUrls = {
 };
 ---
 
+<style is:inline>
+  @font-face {
+    font-family: "Geist Sans";
+    src: url("/assets/fonts/geist/geist-sans-latin-400-normal.woff2") format("woff2");
+    font-weight: 400;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Sans";
+    src: url("/assets/fonts/geist/geist-sans-latin-500-normal.woff2") format("woff2");
+    font-weight: 500;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Sans";
+    src: url("/assets/fonts/geist/geist-sans-latin-600-normal.woff2") format("woff2");
+    font-weight: 600;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Sans";
+    src: url("/assets/fonts/geist/geist-sans-latin-700-normal.woff2") format("woff2");
+    font-weight: 700;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Mono";
+    src: url("/assets/fonts/geist/geist-mono-latin-400-normal.woff2") format("woff2");
+    font-weight: 400;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Mono";
+    src: url("/assets/fonts/geist/geist-mono-latin-500-normal.woff2") format("woff2");
+    font-weight: 500;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Mono";
+    src: url("/assets/fonts/geist/geist-mono-latin-600-normal.woff2") format("woff2");
+    font-weight: 600;
+    font-style: normal;
+    font-display: swap;
+  }
+  @font-face {
+    font-family: "Geist Mono";
+    src: url("/assets/fonts/geist/geist-mono-latin-700-normal.woff2") format("woff2");
+    font-weight: 700;
+    font-style: normal;
+    font-display: swap;
+  }
+</style>
+
 <style id="docs-style-gate" is:inline>
   html[data-style-pending] body {
     visibility: hidden;
```

**File**: `src/css/base/base.css` (modified, +2/-0)
```diff
@@ -84,6 +84,8 @@
 }
 
 @theme {
+  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
+  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
   --radius-sm: calc(var(--radius) - 4px);
   --radius-md: calc(var(--radius) - 2px);
   --radius-lg: var(--radius);
```

**File**: `src/pages/index.astro` (modified, +5/-5)
```diff
@@ -10,8 +10,6 @@ import miraUrl from "../../docs/src/assets/styles/style-mira.css?url";
 import lumaUrl from "../../docs/src/assets/styles/style-luma.css?url";
 import seraUrl from "../../docs/src/assets/styles/style-sera.css?url";
 import rheaUrl from "../../docs/src/assets/styles/style-rhea.css?url";
-import socialImage from "../../docs/src/assets/social.png";
-import favicon from "../../docs/src/assets/favicon.svg";
 import ArrowRight from "lucide-static/icons/arrow-right.svg?raw";
 import Activity from "lucide-static/icons/activity.svg?raw";
 import BanknoteArrowUp from "lucide-static/icons/banknote-arrow-up.svg?raw";
@@ -47,6 +45,8 @@ import Sun from "lucide-static/icons/sun.svg?raw";
 
 const title = "All of the shadcn/ui magic, none of the React";
 const description = "A component library built with Tailwind CSS that works with any web stack.";
+const favicon = "/assets/favicon.svg";
+const socialImage = "/assets/social.png";
 const styleUrls = {
   vega: vegaUrl,
   nova: novaUrl,
@@ -184,15 +184,15 @@ const sidebarSections = [
     <meta name="viewport" content="width=device-width, initial-scale=1" />
     <title>{title} | Basecoat</title>
     <meta name="description" content={description} />
-    <link rel="icon" type="image/svg+xml" href={favicon.src} />
+    <link rel="icon" type="image/svg+xml" href={favicon} />
     <meta property="og:type" content="website" />
     <meta property="og:title" content={`${title} | Basecoat`} />
     <meta property="og:description" content={description} />
-    <meta property="og:image" content={socialImage.src} />
+    <meta property="og:image" content={socialImage} />
     <meta name="twitter:card" content="summary_large_image" />
     <meta name="twitter:title" content={`${title} | Basecoat`} />
     <meta name="twitter:description" content={description} />
-    <meta name="twitter:image" content={socialImage.src} />
+    <meta name="twitter:image" content={socialImage} />
     <script src={basecoatJsUrl} defer></script>
   </head>
   <body class="min-h-dvh overflow-x-clip bg-background text-foreground antialiased">
```

---

### Incident Patch 7: `b971bce1` (2026-06-13)
**Commit Message**: Build Basecoat before docs

**File**: `package.json` (modified, +2/-2)
```diff
@@ -34,8 +34,8 @@
   "homepage": "https://github.com/hunvreus/basecoat#readme",
   "scripts": {
     "build": "node ./scripts/build.js",
-    "docs:build": "npm run docs:generate && astro build",
-    "docs:dev": "npm run docs:generate && astro dev",
+    "docs:build": "npm run build && npm run docs:generate && astro build",
+    "docs:dev": "npm run build && npm run docs:generate && astro dev",
     "workers:dev": "npm run docs:build && wrangler dev",
     "workers:deploy": "npm run docs:build && wrangler deploy",
     "workers:preview": "npm run docs:build && wrangler versions upload",
```

---

### Incident Patch 8: `2e8daaef` (2026-06-06)
**Commit Message**: Fix sidebar nested item styling

**File**: `CHANGELOG.md` (modified, +23/-0)
```diff
@@ -8,6 +8,7 @@
 - Changed Combobox markup and behavior to an input-first structure. The visible input now filters options, the hidden input stores the submitted value, single select stores the selected value, and multiple select stores a JSON array.
 - Changed Command markup to the migrated Basecoat structure: `.command-dialog` wraps `.command`, the search input lives in the command header, and items use role-based menu markup with `role="menuitem"`.
 - Removed Combobox-specific search-header behavior from Select. Use the dedicated Combobox component for editable/filterable selection.
+- Removed built-in document command events for Toast, Sidebar, and Theme. Use element methods instead: `toaster.toast(config)`, `sidebar.open()`, `sidebar.close()`, `sidebar.toggle()`, and `window.basecoat.theme.*`.
 - Reworked style loading for style packs. Non-default styles are standalone bundles and should not be loaded on top of the default/Vega bundle.
 
 ### Added
@@ -18,6 +19,9 @@
 - Added dedicated Input Group component styles and docs.
 - Added dedicated Spinner docs and examples using `animate-spin` and `size-4` patterns.
 - Added style-specific package entrypoints such as `basecoat-css/nova` and styleless base entrypoints for custom themes.
+- Added `window.basecoat.refresh(element)` as a generic dispatcher for components that expose `refresh()`.
+- Added `refresh()` methods to Command, Select, Combobox, Dropdown Menu, and Tabs for dynamic child lists.
+- Added method APIs for Sidebar, Toast, and Theme.
 
 ### Changed
 
@@ -41,3 +45,22 @@ To keep the previous `.form` wrapper behavior, define it in your own Tailwind CS
 .form textarea { @apply textarea; }
 .form select { @apply select; }
 ```
+
+To keep the previous document-event command APIs, add bridge listeners in your app:
+
+```js
+document.addEventListener('basecoat:toast', (event) => {
+  document.getElementById('toaster')?.toast(event.detail?.config || {});
+});
+
+document.addEventListener('basecoat:sidebar', (event) => {
+  const sidebar = document.getElementById(event.detail?.id || 'sidebar');
+  const action = event.detail?.action || 'toggle';
+  if (['open', 'close', 'toggle'].includes(action)) sidebar?.[action]();
+});
+
+document.addEventListener('basecoat:theme', (event) => {
+  const mode = event.detail?.mode;
+  mode ? window.basecoat.theme.set(mode) : window.basecoat.theme.toggle();
+});
+```
```

**File**: `docs/src/_data/docs.json` (modified, +21/-0)
```diff
@@ -36,6 +36,27 @@
       "type": "group",
       "label": "Components",
       "items": [
+        {
+          "type": "submenu",
+          "label": "Parent item",
+          "icon": "folder",
+          "items": [
+            {
+              "type": "item",
+              "label": "Item 1",
+              "icon": "file",
+              "url": "#",
+              "external": true
+            },
+            {
+              "type": "item",
+              "label": "Item 2",
+              "icon": "file",
+              "url": "#",
+              "external": true
+            }
+          ]
+        },
         "components/accordion",
         "components/alert",
         "components/alert-dialog",
```

**File**: `docs/src/_includes/layouts/base.njk` (modified, +21/-34)
```diff
@@ -1,5 +1,5 @@
 <!DOCTYPE html>
-<html>
+<html lang="en">
 <head>
   {# Dark mode #}
   <script>
@@ -12,17 +12,6 @@
         }
       } catch (_) {}
 
-      const apply = dark => {
-        document.documentElement.classList.toggle('dark', dark);
-        try { localStorage.setItem('themeMode', dark ? 'dark' : 'light'); } catch (_) {}
-      };
-
-      document.addEventListener('basecoat:theme', (event) => {
-        const mode = event.detail?.mode;
-        apply(mode === 'dark' ? true
-             : mode === 'light' ? false
-             : !document.documentElement.classList.contains('dark'));
-      });
     })();
   </script>
   {# Theme variant #}
@@ -36,17 +25,6 @@
       }
     })();
   </script>
-  {# Style variant #}
-  <script>
-    (function() {
-      try {
-        const storedStyle = localStorage.getItem('styleVariant') || 'nova';
-        document.documentElement.dataset.styleVariant = storedStyle;
-      } catch (event) {
-        console.error('Could not apply style variant from localStorage', event);
-      }
-    })();
-  </script>
   {# Meta #}
   <meta charset="utf-8">
   <meta http-equiv="Content-Language" content="en">
@@ -58,34 +36,43 @@
   <meta name="description" content="{{ meta_description }}"/>
   <meta name="title" content="{{ meta_title }}">
   {% if site.keywords %}<meta name="keywords" content="{{ site.keywords | join(',') }}" />{% endif %}
+  {% if siteUrl %}<link rel="canonical" href="{{ siteUrl }}{{ page.url }}">{% endif %}
   {# Favicon #}
-  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
-  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
+  <link rel="icon" type="image/svg+xml" href="{{ siteUrl }}/assets/favicon.svg">
+  <link rel="apple-touch-icon" sizes="180x180" href="{{ siteUrl }}/assets/apple-touch-icon.png">
   {# Open Graph / Facebook #}
   <meta property="og:type" content="website">
-  <meta property="og:url" content="{{ site.url }}{{ page.url }}">
+  <meta property="og:url" content="{{ siteUrl }}{{ page.url }}">
   <meta property="og:title" content="{{ meta_title }}">
   <meta property="og:description" content="{{ meta_description }}">
-  <meta property="og:image" content="{{ site.url }}/assets/social-screenshot.png">
+  <meta property="og:image" content="{{ siteUrl }}/assets/social.png">
   <meta property="og:site_name" content="{{ site.title }}">
   <meta property="og:locale" content="en_US">
   <meta property="og:author" content="{{ site.author.name }}">
   {# X/Twitter #}
   <meta name="twitter:card" content="summary_large_image">
-  <meta name="twitter:url" content="{{ site.url }}{{ page.url }}">
-  <meta name="twitter:title" content="{{ title if title else site.title }}">
+  <meta name="twitter:url" content="{{ siteUrl }}{{ page.url }}">
+  <meta name="twitter:title" content="{{ meta_title }}">
   <meta name="twitter:description" content="{{ meta_description }}">
-  <meta name="twitter:image" content="{{ site.url }}/assets/social-screenshot.png">
+  <meta name="twitter:image" content="{{ siteUrl }}/assets/social.png">
   <meta name="twitter:creator" content="{{ site.author.x }}">
   {# CSS #}
-  <link rel="stylesheet" id="style-variant-stylesheet" href="/assets/styles-nova.css">
   <script>
     (() => {
-      const styleLink = document.getElementById('style-variant-stylesheet');
-      const styleVariant = document.documentElement.dataset.styleVariant || 'nova';
-      styleLink.href = `/assets/styles-${styleVariant}.css`;
+      const styles = new Set(['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea']);
+      let styleVariant = 'nova';
+      try {
+        const storedStyle = localStorage.getItem('styleVariant');
+        if (styles.has(storedStyle)) styleVariant = storedStyle;
+      } catch (event) {
+        console.error('Could not apply style variant from localStorage', event);
+      }
+
+      document.documentElement.dataset.styleVariant = styleVariant;
+      document.write(`<link rel="stylesheet" id="style-variant-stylesheet" href="/assets/styles-${styleVariant}.css">`);
     })();
   </script>
+  <noscript><link rel="stylesheet" id="style-variant-stylesheet" href="/assets/styles-nova.css"></noscript>
   {# JS #}
   <script src="/assets/js/basecoat.js?v={{ pkg.version }}" defer></script>
   <script src="/assets/js/command.js?v={{ pkg.version }}" defer></script>
```

**File**: `docs/src/_includes/layouts/page.njk` (modified, +64/-59)
```diff
@@ -4,69 +4,74 @@ layout: layouts/layout.njk
 {% set docsMenu = docs.menu if docs and docs.menu else menu %}
 {% set navigation = docsMenu | getNavigation(collections) %}
 
-<main class="mx-auto relative flex w-full max-w-screen-lg gap-10">
-  <div class="mx-auto w-full flex-1 max-w-screen-md">
-    <header class="space-y-2">
-      <div class="flex items-start gap-x-2">
-        <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl xl:text-4xl mr-auto">{{ title }}</h1>
-        <div class="flex items-center gap-x-2 pt-1">
-          <button
-            type="button"
-            class="btn-sm-secondary h-7 px-2.5 text-[13px] max-sm:size-7"
-            data-md-url="{{ page.url | markdownUrl }}"
-            onclick="copyPageMarkdown(this)"
-          >
-            {% lucide "copy" %}
-            <span class="hidden sm:block">Copy page</span>
-          </button>
-          <div role="group" class="button-group">
-            {% if navigation.prev %}
-              <a href="{{ navigation.prev.url }}" class="btn-sm-icon-secondary hidden sm:flex size-7">
-                <span class="sr-only">{{ navigation.prev.label }}</span>
-                {% lucide "arrow-left" %}
-              </a>
-            {% endif %}
-            {% if navigation.prev and navigation.next %}
-              <hr role="separator">
-            {% endif %}
-            {% if navigation.next %}
-              <a href="{{ navigation.next.url }}" class="btn-sm-icon-secondary hidden sm:flex size-7">
-                <span class="sr-only">{{ navigation.next.label }}</span>
-                {% lucide "arrow-right" %}
-              </a>
-            {% endif %}
+<div class="mx-auto flex w-full max-w-screen-lg gap-10">
+  <article class="min-w-0 flex-1 wrap-break-word">
+    <div class="mx-auto w-full max-w-screen-md">
+      <header class="space-y-2">
+        <div class="flex items-start gap-x-2">
+          <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl xl:text-4xl mr-auto">{{ title }}</h1>
+          <div class="flex items-center gap-x-2 pt-1">
+            <button
+              type="button"
+              class="btn-sm-secondary h-7 px-2.5 text-[13px] max-sm:size-7"
+              data-md-url="{{ page.url | markdownUrl }}"
+              onclick="copyPageMarkdown(this)"
+            >
+              {% lucide "copy" %}
+              <span class="hidden sm:block">Copy page</span>
+            </button>
+            <div role="group" class="button-group">
+              {% if navigation.prev %}
+                <a href="{{ navigation.prev.url }}" class="btn-sm-icon-secondary hidden sm:flex size-7">
+                  <span class="sr-only">{{ navigation.prev.label }}</span>
+                  {% lucide "arrow-left" %}
+                </a>
+              {% endif %}
+              {% if navigation.prev and navigation.next %}
+                <hr role="separator">
+              {% endif %}
+              {% if navigation.next %}
+                <a href="{{ navigation.next.url }}" class="btn-sm-icon-secondary hidden sm:flex size-7">
+                  <span class="sr-only">{{ navigation.next.label }}</span>
+                  {% lucide "arrow-right" %}
+                </a>
+              {% endif %}
+            </div>
           </div>
         </div>
+        <p class="text-muted-foreground text-[1.05rem] sm:text-base">{{ description }}</p>
+      </header>
+      <div class="pb-12 mt-8 content">
+        {{ content | safe }}
       </div>
-      <p class="text-muted-foreground text-[1.05rem] sm:text-base">{{ description }}</p>
-    </header>
-    <article class="pb-12 mt-8 content">
-      {{ content | safe }}
-    </article>
-    {% if navigation.prev or navigation.next %}
-      <footer class="flex items-center gap-2 border-t pt-6 mt-12">
-        {% if navigation.prev %}
-          <a href="{{ navigation.prev.url }}" class="btn-sm-secondary mr-auto">
-            {% lucide "arrow-left" %}
-            {{ navigation.prev.label }}
-          </a>
-        {% endif %}
-        {% if navigation.next %}
-          <a href="{{ navigation.next.url }}" class="btn-sm-secondary ml-auto">
-            {{ navigation.next.label }}
-            {% lucide "arrow-right" %}
-          </a>
-        {% endif %}
-      </footer>
-    {% endif %}
-  </div>
-  {% if toc %}
-    <div class="hidden text-sm xl:block w-full max-w-[300px]">
-      {% from "macros/toc.njk" import toc_nav %}
-      {{ toc_nav(toc) }}
+      {% if navigation.prev or navigation.next %}
+        <footer class="flex items-center gap-2 border-t pt-6 mt-12">
+          {% if navigation.prev %}
+            <a href="{{ navigation.prev.url }}" class="btn-sm-secondary mr-auto">
+              {% lucide "arrow-left" %}
+              {{ navigation.prev.label }}
+            </a>
+          {% endif %}
+          {% if navigation.next %}
+            <a href="{{ navigation.next.url }}" class="btn-sm-secondary ml-auto">
+              {{ navigation.next.label }}
```

**File**: `docs/src/_includes/partials/header.njk` (modified, +6/-3)
```diff
@@ -21,7 +21,7 @@
 <div class="flex h-14 w-full items-center gap-2 px-4">
   <button
     type="button"
-    onclick="document.dispatchEvent(new CustomEvent('basecoat:sidebar'))"
+    onclick="document.getElementById('sidebar')?.toggle()"
     aria-label="Toggle sidebar"
     data-tooltip="Toggle sidebar"
     data-side="bottom"
@@ -83,8 +83,11 @@
       const styleLink = document.getElementById('style-variant-stylesheet');
       const applyStyle = (styleName) => {
         const nextStyle = styleName || 'nova';
+        const nextHref = `/assets/styles-${nextStyle}.css`;
         document.documentElement.dataset.styleVariant = nextStyle;
-        if (styleLink) styleLink.href = `/assets/styles-${nextStyle}.css`;
+        if (styleLink && styleLink.getAttribute('href') !== nextHref) {
+          styleLink.href = nextHref;
+        }
       };
 
       const storedStyle = localStorage.getItem('styleVariant') || 'nova';
@@ -104,7 +107,7 @@
     aria-label="Toggle dark mode"
     data-tooltip="Toggle dark mode"
     data-side="bottom"
-    onclick="document.dispatchEvent(new CustomEvent('basecoat:theme'))"
+    onclick="window.basecoat?.theme.toggle()"
     class="btn-icon-outline size-8"
   >
     <span class="hidden dark:block">{% lucide "sun" %}</span>
```

**File**: `docs/src/_includes/partials/sidebar.njk` (modified, +2/-2)
```diff
@@ -44,8 +44,8 @@
     {% endif %}
   </div>
   <div class="grid flex-1 text-left text-sm leading-tight">
-    <span class="truncate font-medium">{{ site.title }}</span>
-    <span class="truncate text-xs">v{{ pkg.version }}</span>
+    <span class="truncate font-semibold">{{ site.title }}</span>
+    <span class="truncate text-xs text-muted-foreground">v{{ pkg.version }}</span>
   </div>
 </a>
 {% endset %}
```

**File**: `docs/src/components/combobox.md` (modified, +4/-0)
```diff
@@ -147,6 +147,10 @@ toc:
     <dd>Removes a selected value.</dd>
     <dt><code>toggle(value)</code> <span class="badge-secondary">Multiple only</span></dt>
     <dd>Toggles a selected value.</dd>
+    <dt><code>refresh()</code></dt>
+    <dd>Rescans options after changing children inside the existing <code>role="listbox"</code> element.</dd>
+    <dt><code>window.basecoat.refresh(combobox)</code></dt>
+    <dd>Calls the component refresh method through the global dispatcher.</dd>
   </dl>
 </section>
 
```

**File**: `docs/src/components/command.md` (modified, +6/-2)
```diff
@@ -18,7 +18,7 @@ toc:
             id: usage-html-js-2
           - label: HTML structure
             id: usage-html-js-3
-          - label: JavaScript events
+          - label: JavaScript API
             id: usage-html-js-4
       - label: Jinja and Nunjucks
         id: usage-macro
@@ -183,12 +183,16 @@ toc:
   </dl>
 </section>
 
-<h4 id="usage-html-js-4"><a href="#usage-html-js-4">JavaScript events</a></h4>
+<h4 id="usage-html-js-4"><a href="#usage-html-js-4">JavaScript API</a></h4>
 
 <section class="prose">
   <dl>
     <dt><code>basecoat:initialized</code></dt>
     <dd>Once the component is initialized, it dispatches a custom non-bubbling <code>basecoat:initialized</code> event on itself.</dd>
+    <dt><code>command.refresh()</code></dt>
+    <dd>Rescans command items after changing children inside the existing <code>role="menu"</code> list.</dd>
+    <dt><code>window.basecoat.refresh(command)</code></dt>
+    <dd>Calls the component refresh method through the global dispatcher.</dd>
   </dl>
 </section>
 
```

---

### Incident Patch 9: `1e501134` (2026-06-04)
**Commit Message**: docs: tighten repo and agent guidance

**File**: `AGENTS.md` (modified, +91/-339)
```diff
@@ -1,339 +1,91 @@
-# Basecoat – Agent Guide
-
-## What is Basecoat?
-
-Basecoat is a vanilla JavaScript/HTML/CSS port of shadcn/ui components. It reuses shadcn/ui's design patterns and Tailwind CSS classes while maintaining semantic HTML, native browser elements, and full accessibility (ARIA attributes, proper hierarchies, keyboard navigation). The goal is to provide shadcn-quality components without React dependencies.
-
-Basecoat is not a literal DOM port of shadcn/ui. It is an alternative implementation with the same visual language and comparable component coverage, but with simpler markup, less JavaScript, less CSS, and no React/runtime primitive dependency.
-
-## Quickstart
-
-- Install deps: `npm i`
-- Dev docs server: `npm run docs:dev`
-- Build CSS/JS: `npm run build`
-- Build static docs: `npm run docs:build`
-
-## What to edit (and what not)
-
-- Edit sources only:
-  - `src/css/base/base.css` – Shared base layer, tokens, and semantic utility classes
-  - `src/css/components/*.css` – Component CSS classes (Tailwind + custom)
-  - `src/css/styles/*.css` – Style-pack visual rules (`vega`, `nova`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`)
-  - `src/css/basecoat.css` – Aggregate CSS entrypoint
-  - `src/js/*.js` – Individual component JS files (kebab-case, ESM) + `basecoat.js` (component registry)
-  - `src/nunjucks/*.njk` and `src/jinja/*.html.jinja` – Component template macros
-  - `docs/src/components/*.md` – Component documentation pages with examples; Markdown can embed Nunjucks macros
-  - `docs/src/_includes/` – Layout templates, partials, and navigation
-- Do not edit build outputs:
-  - `packages/*/dist` – built CSS/JS bundles
-  - `_site/` – generated docs site
-
-## Project layout
-
-- Workspaces: root npm workspace with publishable packages in `packages/*`.
-- Packages:
-  - `packages/css` – built CSS and JS bundles under `dist/`.
-  - `packages/cli` – CLI; distributed assets live under `dist/`.
-- Docs site: `docs/src` (Eleventy); output goes to `_site/`.
-
-## Style system
-
-- Basecoat keeps its own component class API (`btn`, `dialog`, `popover`, etc.). Do not introduce shadcn `cn-*` classes into Basecoat source.
-- Shadcn/ui style packs are used as reference material, but must be mapped onto Basecoat markup and selectors.
-- Style-pack architecture is one file per style:
-  - `src/css/styles/vega.css`
-  - `src/css/styles/nova.css`
-  - `src/css/styles/maia.css`
-  - `src/css/styles/lyra.css`
-  - `src/css/styles/mira.css`
-  - `src/css/styles/luma.css`
-  - `src/css/styles/sera.css`
-  - `src/css/styles/rhea.css`
-- `basecoat.css` and the default CDN bundle remain Vega-compatible for Basecoat backward compatibility. This is a Basecoat compatibility decision; upstream shadcn/ui's current default generated config is Nova.
-- Non-default styles must be selected through standalone style bundles (`basecoat-<style>.css`, `basecoat-<style>.cdn.css`, or docs `styles-<style>.css`). Do not load Vega/default first and then layer another style file on top.
-- Split style files under `src/css/styles/*.css` are for source organization and advanced composition only. They must map upstream style intent directly and should not contain defensive resets whose only purpose is undoing another style pack.
-- During migration, each component must be reviewed in two layers:
-  - shared/base component CSS
-  - style-pack CSS visual rules
-- Do not assume existing Basecoat component CSS is still the right baseline. Reassess shared rules vs style-owned rules component by component.
-- When Basecoat differs from upstream shadcn/ui, classify the difference as either intentional or drift, and prefer explicit decisions over silent divergence.
-
-## Implementation philosophy
-
-- Prefer the browser platform:
-  - native elements before custom widgets
-  - semantic HTML before generic `<div>` structures
-  - CSS state selectors before JavaScript state when reliable
-  - small vanilla JS behavior only when native HTML/CSS cannot provide the interaction
-- Keep public markup small and obvious. A user should be able to read a component example and understand the DOM without learning shadcn/ui internals.
-- Use the least JavaScript that preserves expected behavior, accessibility, and keyboard support.
-- Use the least CSS that preserves the visual contract and style-pack differences.
-- Use the least markup that remains semantic and accessible.
-- Prefer a single public class on the component root. Avoid requiring child classes when semantic elements, native controls, ARIA roles, or documented attributes can identify the child.
-- Child selectors should usually target meaningful HTML (`input`, `textarea`, `select`, `button`, `kbd`, `svg`, `header`, `footer`, `label`) or accessibility semantics (`role`, `aria-*`) rather than invented slot classes.
-- Do not create classes or DOM structures just because shadcn/ui has internal slots. Map upstream intent onto Basecoat's existing selectors first.
-- If a new public c
```

**File**: `README.md` (modified, +110/-14)
```diff
@@ -1,29 +1,125 @@
 # Basecoat
 
-A collection of modern UI components built with Tailwind CSS that works with any web stack. Basecoat brings the magic of [shadcn/ui](https://ui.shadcn.com) to traditional web applications, no React required.
+Basecoat is a Tailwind CSS, vanilla HTML/CSS/JavaScript implementation of the shadcn/ui design system. It provides shadcn-style components for any web stack without React, Radix, or framework runtime dependencies.
 
 ![screenshot](docs/src/assets/images/screenshot.png)
 
 ## Features
 
-- **Lightweight**: no runtime JS, just CSS and a tiny bit of vanilla JavaScript for the more interactive components.
-- **Easy to use**: add classes like `btn` or `input` and you're done.
-- **Framework-agnostic**: works with any backend or frontend stack.
-- **Accessible**: components follow accessibility best practices.
-- **Dark mode ready**: respects your Tailwind config.
-- **Extendable**: tweak styles with Tailwind or CSS variables.
-- **Themable**: fully compatible with shadcn/ui themes.
-- **Readable**: no class soup, just clean markup.
-- **Free and open source**: MIT licensed.
+- Semantic HTML-first components.
+- Tailwind CSS v4 source files and generated CSS bundles.
+- Small vanilla JavaScript for components that need behavior.
+- Nunjucks and Jinja template macros.
+- Standalone style packs: Vega, Nova, Maia, Lyra, Mira, Luma, Sera, and Rhea.
+- Dark mode and CSS variable theming.
+- CDN, npm, and CLI usage paths.
 
 ## Documentation
 
-Visit [basecoatui.com](https://basecoatui.com).
+- Website: [basecoatui.com](https://basecoatui.com)
+- Installation: [basecoatui.com/installation](https://basecoatui.com/installation)
+- Customization: [basecoatui.com/customization](https://basecoatui.com/customization)
 
-## Installation
+## Packages
 
-Visit [basecoatui.com/installation](https://basecoatui.com/installation)
+This repository publishes two workspace packages:
+
+- `basecoat-css`: CSS, JavaScript, Nunjucks macros, and Jinja macros.
+- `basecoat-cli`: CLI for adding Basecoat assets to a project.
+
+Package details live in:
+
+- `packages/css/README.md`
+- `packages/cli/README.md`
+
+## Install
+
+```bash
+npm install basecoat-css
+```
+
+Use the default bundle:
+
+```css
+@import "tailwindcss";
+@import "basecoat-css";
+```
+
+Use a specific style bundle:
+
+```css
+@import "tailwindcss";
+@import "basecoat-css/nova";
+```
+
+Use the styleless base plus a custom style file:
+
+```css
+@import "tailwindcss";
+@import "basecoat-css/base";
+@import "./style-acme.css";
+```
+
+## Repository Layout
+
+```text
+.
+├── docs/
+│   └── src/              Eleventy documentation site
+├── packages/
+│   ├── cli/              Published CLI package
+│   └── css/              Published CSS package
+├── scripts/              Build and generation scripts
+└── src/
+    ├── css/
+    │   ├── base/         Shared tokens, base layer, and semantic utilities
+    │   ├── components/   Component structure and behavior hooks
+    │   └── styles/       Style-pack visual rules
+    ├── jinja/            Jinja component macros
+    ├── js/               Vanilla JS components and registry
+    └── nunjucks/         Nunjucks component macros
+```
+
+## CSS Architecture
+
+Basecoat separates structure from style:
+
+- `src/css/base/base.css`: shared tokens and semantic utilities.
+- `src/css/components/*.css`: component layout, structure, accessibility selectors, and behavior hooks.
+- `src/css/styles/*.css`: style-pack visuals such as color, radius, shadow, typography, spacing, variants, and state styles.
+
+Generated source entrypoints are committed for transparency and package imports:
+
+- `src/css/basecoat.css`: default backward-compatible Vega bundle.
+- `src/css/basecoat-base.css`: base plus components, no style pack.
+- `src/css/basecoat-components.css`: component imports only.
+- `src/css/basecoat-<style>.css`: base plus one style pack.
+- `src/css/basecoat-<style>.cdn.css`: CDN-compatible wrapper.
+
+These entrypoints are generated by `scripts/generate-css-entrypoints.js` and by the build scripts.
+
+## Development
+
+```bash
+# Install dependencies
+npm i
+
+# Run the docs site
+npm run docs:dev
+
+# Build package assets
+npm run build
+
+# Build the static docs site
+npm run docs:build
+
+# Run the Workers docs site locally
+npm run workers:dev
+
+# Deploy the Workers docs site
+npm run workers:deploy
+```
 
 ## License
 
-[MIT](/LICENSE.md)
\ No newline at end of file
+[MIT](LICENSE.md)
```

---

### Incident Patch 10: `a7f686e7` (2026-01-13)
**Commit Message**: Fixing Jinja macro and removing button-group isolate

**File**: `docs/src/_includes/partials/kitchen-sink/select.njk` (modified, +23/-0)
```diff
@@ -10,6 +10,29 @@
   <div class="p-4 gap">
     <div class="flex flex-col gap-4">
       <div class="flex flex-wrap items-center gap-2 md:flex-row">
+        {{ select(
+          id="select-default",
+          trigger_attrs={"class": "w-[180px]"},
+          selected="blueberry",
+          items=[
+            {
+              type: "group",
+              label: "Fruits",
+              items: [
+                { type: "item", label: "Apple", value: "apple" },
+                { type: "item", label: "Banana", value: "banana" },
+                { type: "item", label: "Blueberry", value: "blueberry" }
+              ]
+            },
+            {
+              type: "group",
+              label: "Grapes",
+              items: [
+                { type: "item", label: "Pineapple", value: "pineapple" }
+              ]
+            }
+          ]
+        ) }}
         <select class="select w-[180px]">
           <optgroup label="Fruits">
             <option>Apple</option>
```

**File**: `docs/src/assets/styles.css` (modified, +0/-1)
```diff
@@ -2794,7 +2794,6 @@
 }
 @layer components {
   .button-group {
-    isolation: isolate;
     display: inline-flex;
     width: fit-content;
     align-items: stretch;
```

**File**: `src/css/basecoat.css` (modified, +2/-1)
```diff
@@ -388,7 +388,8 @@
 /* Button Group */
 @layer components {
   .button-group {
-    @apply inline-flex w-fit items-stretch isolate;
+    @apply inline-flex w-fit items-stretch;
+    /* isolate */
     
     > *:focus-visible,
     > :is(.dropdown-menu, .popover, .select) > button:focus-visible {
```

**File**: `src/jinja/dialog.html.jinja` (modified, +3/-5)
```diff
@@ -83,12 +83,10 @@
       </footer>
     {% endif %}
     {% if close_button %}
-      <form method="dialog">
-        <button aria-label="Close dialog">
-          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
+      <button type="button" aria-label="Close dialog" onclick="this.closest('dialog').close()">
+        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
       </button>
-      </form>
     {% endif %}
   </div>
 </dialog>
-{% endmacro %}
\ No newline at end of file
+{% endmacro %}
```

---

### Incident Patch 11: `128f79c2` (2026-01-05)
**Commit Message**: Fixing docs

**File**: `docs/src/components/select.njk` (modified, +4/-5)
```diff
@@ -55,16 +55,15 @@ toc:
 {{ select(
   trigger_attrs={"class": "w-[180px]"},
   is_combobox=true,
-  multiple=true,
   items=[
     {
       type: "group",
       label: "Fruits",
       items: [
-        { type: "item", label: "Apple", attrs: {"data-force": "true"} },
-        { type: "item", label: "Banana", attrs: {"data-keywords": "bread"} },
-        { type: "item", label: "Blueberry" },
-        { type: "item", value: "pineapple", label: "Grapes" },
+        { type: "item", value: "apple", label: "Apple" },
+        { type: "item", value: "banana", label: "Banana" },
+        { type: "item", value: "blueberry", label: "Blueberry" },
+        { type: "item", value: "grapes", label: "Grapes" },
         { type: "item", value: "pineapple", label: "Pineapple" }
       ]
     }
```

---

### Incident Patch 12: `b9274702` (2026-01-03)
**Commit Message**: Fixing text color in tooltip (see #97)

**File**: `docs/src/assets/styles.css` (modified, +2/-2)
```diff
@@ -5252,12 +5252,12 @@
       text-overflow: ellipsis;
       white-space: nowrap;
       border-radius: var(--radius-md);
-      background-color: var(--color-primary);
+      background-color: var(--color-foreground);
       padding-inline: calc(var(--spacing) * 3);
       padding-block: calc(var(--spacing) * 1.5);
       font-size: var(--text-xs);
       line-height: var(--tw-leading, var(--text-xs--line-height));
-      color: var(--color-primary-foreground);
+      color: var(--color-background);
       opacity: 0%;
       transition-property: all;
       transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
```

**File**: `src/css/basecoat.css` (modified, +1/-1)
```diff
@@ -1250,7 +1250,7 @@
     @apply relative;
 
     &:before {
-      @apply absolute content-[attr(data-tooltip)] bg-foreground text-primary-foreground z-[60] truncate max-w-xs w-fit rounded-md px-3 py-1.5 text-xs invisible opacity-0 scale-95 transition-all pointer-events-none;
+      @apply absolute content-[attr(data-tooltip)] bg-foreground text-background z-[60] truncate max-w-xs w-fit rounded-md px-3 py-1.5 text-xs invisible opacity-0 scale-95 transition-all pointer-events-none;
     }
     &:hover:before {
       @apply visible opacity-100 scale-100;
```

---

### Incident Patch 13: `36bca0c6` (2026-01-03)
**Commit Message**: Merge pull request #97 from PhilipdeRijk/fix/bg-tooltip

fix: change tooltip bg color to bg-foreground

**File**: `src/css/basecoat.css` (modified, +1/-1)
```diff
@@ -1250,7 +1250,7 @@
     @apply relative;
 
     &:before {
-      @apply absolute content-[attr(data-tooltip)] bg-primary text-primary-foreground z-[60] truncate max-w-xs w-fit rounded-md px-3 py-1.5 text-xs invisible opacity-0 scale-95 transition-all pointer-events-none;
+      @apply absolute content-[attr(data-tooltip)] bg-foreground text-primary-foreground z-[60] truncate max-w-xs w-fit rounded-md px-3 py-1.5 text-xs invisible opacity-0 scale-95 transition-all pointer-events-none;
     }
     &:hover:before {
       @apply visible opacity-100 scale-100;
```

---

### Incident Patch 14: `dea0602b` (2025-12-30)
**Commit Message**: Merge pull request #128 from hrbonz/wip/btn_groups_fix_typo

docs: fix small word mistake in button group

**File**: `docs/src/components/button-group.njk` (modified, +2/-2)
```diff
@@ -131,7 +131,7 @@ toc:
     <button type="button" class="btn-icon-outline">{% lucide "plus" %}</button>
   </div>
   <div role="group" class="button-group">
-    <button type="button" class="btn-lg-outline">Small</button>
+    <button type="button" class="btn-lg-outline">Large</button>
     <button type="button" class="btn-lg-outline">Button</button>
     <button type="button" class="btn-lg-outline">Group</button>
     <button type="button" class="btn-lg-icon-outline">{% lucide "plus" %}</button>
@@ -287,4 +287,4 @@ toc:
 </div>
 {% endset %}
 
-{{ code_preview("button-group-popover", code_popover | prettyHtml) }}
\ No newline at end of file
+{{ code_preview("button-group-popover", code_popover | prettyHtml) }}
```

---

### Incident Patch 15: `19941561` (2025-12-30)
**Commit Message**: docs: fix small word mistake in button group

The large button example was using "Small" "button" "group" list of
words. It makes more sense to use "Large" as the first word to stay
consistent with the other example.

**File**: `docs/src/components/button-group.njk` (modified, +2/-2)
```diff
@@ -131,7 +131,7 @@ toc:
     <button type="button" class="btn-icon-outline">{% lucide "plus" %}</button>
   </div>
   <div role="group" class="button-group">
-    <button type="button" class="btn-lg-outline">Small</button>
+    <button type="button" class="btn-lg-outline">Large</button>
     <button type="button" class="btn-lg-outline">Button</button>
     <button type="button" class="btn-lg-outline">Group</button>
     <button type="button" class="btn-lg-icon-outline">{% lucide "plus" %}</button>
@@ -287,4 +287,4 @@ toc:
 </div>
 {% endset %}
 
-{{ code_preview("button-group-popover", code_popover | prettyHtml) }}
\ No newline at end of file
+{{ code_preview("button-group-popover", code_popover | prettyHtml) }}
```

#### Recent Merged Pull Requests:
- **PR #189** (closed): Fix HTMX toast docs URL push (@heypi-dev)
- **PR #188** (closed): Fix form migration notes for Tailwind v4 (@heypi-dev)
- **PR #181** (closed): feat: add resizable panel group with handles (@heypi-dev)
- **PR #180** (closed): feat: add Navigation Menu component (@heypi-dev)
- **PR #174** (closed): fix(tabs): add overflow:visible and z-index to prevent sidebar overflow clipping (@social5h3ll)
- **PR #173** (closed): feat(drawer): add drawer component with swipe-to-dismiss and snap points (@social5h3ll)
- **PR #172** (closed): feat(select): add multiselect support with multi-select threshold and badge display (@social5h3ll)
- **PR #171** (closed): feat(command): add async search support with commandAsync API (@social5h3ll)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
