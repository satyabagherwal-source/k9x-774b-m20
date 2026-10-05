# Forensic Learning Record (Deep Inspection): saadeghi/daisyui

> **Canonical Artifact**: `07_PROJECT_LEARNING/saadeghi-daisyui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/saadeghi/daisyui](https://github.com/saadeghi/daisyui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:31:57.764Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `saadeghi/daisyui`
- **Description**: 🌼 🌼 🌼 🌼 🌼  The most popular, free and open-source Tailwind CSS component library
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 42542 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/bundle/daisyui-theme.js`
```
/** 🌼
 *  @license MIT
 *  daisyUI bundle
 *  https://daisyui.com/
 */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// packages/daisyui/theme/index.js
var exports_theme = {};
__export(exports_theme, {
  default: () => theme_default
});
module.exports = __toCommonJS(exports_theme);

// packages/daisyui/functions/plugin.js
var plugin = {
  withOptions: (pluginFunction, configFunction = () => ({})) => {
    const optionsFunction = (options) => {
      const handler = pluginFunction(options);
      const config = configFunction(options);
      return { handler, config };
    };
    optionsFunction.__isOptionsFunction = true;
    return optionsFunction;
  }
};

// packages/daisyui/theme/object.js
var object_default = { synthwave: { "color-scheme": "dark", "--color-base-100": "oklch(15% 0.09 281.288)", "--color-base-200": "oklch(20% 0.09 281.288)", "--color-base-300": "oklch(25% 0.09 281.288)", "--color-base-content": "oklch(78% 0.115 274.713)", "--color-primary": "oklch(71% 0.202 349.761)", "--color-primary-content": "oklch(28% 0.109 3.907)", "--color-secondary": "oklch(82% 0.111 230.318)", "--color-secondary-content": "oklch(29% 0.066 243.157)", "--color-accent": "oklch(75% 0.183 55.934)", "--color-accent-content": "oklch(26% 0.079 36.259)", "--color-neutral": "oklch(45% 0.24 277.023)", "--color-neutral-content": "oklch(87% 0.065 274.039)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(77% 0.152 181.912)", "--color-success-content": "oklch(27% 0.046 192.524)", "--color-warning": "oklch(90% 0.182 98.111)", "--color-warning-content": "oklch(42% 0.095 57.708)", "--color-error": "oklch(73.7% 0.121 32.639)", "--color-error-content": "oklch(23.501% 0.096 290.329)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, sunset: { "color-scheme": "dark", "--color-base-100": "oklch(22% 0.019 237.69)", "--color-base-200": "oklch(20% 0.019 237.69)", "--color-base-300": "oklch(18% 0.019 237.69)", "--color-base-content": "oklch(77.383% 0.043 245.096)", "--color-primary": "oklch(74.703% 0.158 39.947)", "--color-primary-content": "oklch(14.94% 0.031 39.947)", "--color-secondary": "oklch(72.537% 0.177 2.72)", "--color-secondary-content": "oklch(14.507% 0.035 2.72)", "--color-accent": "oklch(71.294% 0.166 299.844)", "--color-accent-content": "oklch(14.258% 0.033 299.844)", "--color-neutral": "oklch(26% 0.019 237.69)", "--color-neutral-content": "oklch(70% 0.019 237.69)", "--color-info": "oklch(85.559% 0.085 206.015)", "--color-info-content": "oklch(17.111% 0.017 206.015)", "--color-success": "oklch(85.56% 0.085 144.778)", "--color-success-content": "oklch(17.112% 0.017 144.778)", "--color-warning": "oklch(85.569% 0.084 74.427)", "--color-warning-content": "oklch(17.113% 0.016 74.427)", "--color-error": "oklch(85.511% 0.078 16.886)", "--color-error-content": "oklch(17.102% 0.015 16.886)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, dracula: { "color-scheme": "dark", "--color-base-100": "oklch(28.822% 0.022 277.508)", "--color-base-200": "oklch(26.805% 0.02 277.508)", "--color-base-300": "oklch(24.787% 0.019 277.508)", "--color-base-content": "oklch(97.747% 0.007 106.545)", "--color-primary": "oklch(75.461% 0.183 346.812)", "--color-primary-content": "oklch(15.092% 0.036 346.812)", "--color-secondary": "oklch(74.202% 0.148 301.883)", "--color-secondary-content": "oklch(14.84% 0.029 301.883)", "--color-accent": "oklch(83.392% 0.124 66.558)", "--color-accent-content": "oklch(16.678% 0.024 66.558)", "--color-neutral": "oklch(39.445% 0.032 275.524)", "--color-neutral-content": "oklch(87.889% 0.006 275.524)", "--color-info": "oklch(88.263% 0.093 212.846)", "--color-info-content": "oklch(17.652% 0.018 212.846)", "--color-success": "oklch(87.099% 0.219 148.024)", "--color-success-content": "oklch(17.419% 0.043 148.024)", "--color-warning": "oklch(95.533% 0.134 112.757)", "--color-warning-content": "oklch(19.106% 0.026 112.757)", "--color-error": "oklch(68.22% 0.206 24.43)", "--color-error-content": "oklch(13.644% 0.041 24.43)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, caramellatte: { "color-scheme": "light", "--color-base-100": "oklch(98% 0.016 73.684)", "--color-base-200": "oklch(95% 0.038 75.164)", "--color-base-300": "oklch(90% 0.076 70.697)", "--color-base-content": "oklch(40% 0.123 38.172)", "--color-primary": "oklch(0% 0 0)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(22.45% 0.075 37.85)", "--color-secondary-content": "oklch(90% 0.076 70.697)", "--color-accent": "oklch(46.44% 0.111 37.85)", "--color-accent-content": "oklch(90% 0.076 70.697)", "--color-neutral": "oklch(55% 0.195 38.402)", "--color-neutral-content": "oklch(98% 0.016 73.684)", "--color-info": "oklch(42% 0.199 265.638)", "--color-info-content": "oklch(90% 0.076 70.697)", "--color-success": "oklch(43% 0.095 166.913)", "--color-success-content": "oklch(90% 0.076 70.697)", "--color-warning": "oklch(82% 0.189 84.429)", "--color-warning-content": "oklch(41% 0.112 45.904)", "--color-error": "oklch(70% 0.191 22.216)", "--color-error-content": "oklch(39% 0.141 25.723)", "--radius-selector": "2rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "2px", "--depth": "1", "--noise": "1" }, fantasy: { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(93% 0 0)", "--color-base-300": "oklch(86% 0 0)", "--color-base-content": "oklch(27.807% 0.029 256.847)", "--color-primary": "oklch(37.45% 0.189 325.02)", "--color-primary-content": "oklch(87.49% 0.037 325.02)", "--color-secondary": "oklch(53.92% 0.162 241.36)", "--color-secondary-content": "oklch(90.784% 0.032 241.36)", "--color-accent": "oklch(75.98% 0.204 56.72)", "--color-accent-content": "oklch(15.196% 0.04 56.72)", "--color-neutral": "oklch(27.807% 0.029 256.847)", "--color-neutral-content": "oklch(85.561% 0.005 256.847)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, lemonade: { "color-scheme": "light", "--color-base-100": "oklch(98.71% 0.02 123.72)", "--color-base-200": "oklch(91.8% 0.018 123.72)", "--color-base-300": "oklch(84.89% 0.017 123.72)", "--color-base-content": "oklch(19.742% 0.004 123.72)", "--color-primary": "oklch(58.92% 0.199 134.6)", "--color-primary-content": "oklch(11.784% 0.039 134.6)", "--color-secondary": "oklch(77.75% 0.196 111.09)", "--color-secondary-content": "oklch(15.55% 0.039 111.09)", "--color-accent": "oklch(85.39% 0.201 100.73)", "--color-accent-content": "oklch(17.078% 0.04 100.73)", "--color-neutral": "oklch(30.98% 0.075 108.6)", "--color-neutral-content": "oklch(86.196% 0.015 108.6)", "--color-info": "oklch(86.19% 0.047 224.14)", "--color-info-content": "oklch(17.238% 0.009 224.14)", "--color-success": "oklch(86.19% 0.047 157.85)", "--color-success-content": "oklch(17.238% 0.009 157.85)", "--color-warning": "oklch(86.19% 0.047 102.15)", "--color-warning-content": "oklch(17.238% 0.009 102.15)", "--color-error": "oklch(86.19% 0.047 25.85)", "--color-error-content": "oklch(17.238% 0.009 25.85)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, business: { "color-scheme": "dark", "--color-base-100": "oklch(24.353% 0 0)", "--color-base-200": "oklch(22.648% 0 0)", "--color-base-300": "oklch(20.944% 0 0)", "--color-base-content": "oklch(84.87% 0 0)", "--color-primary": "oklch(41.703% 0.099 251.473)", "--color-primary-content": "oklch(88.34% 0.019 251.473)", "--color-secondary": "oklch(64.092% 0.027 229.389)", "--color-secondary-content": "oklch(12.818% 0.005 229.389)", "--color-accent": "oklch(67.271% 0.167 35.791)", "--color-accent-content": "oklch(13.454% 0.033 35.791)", "--color-neutral": "oklch(27.441% 0.013 253.041)", "--color-neutral-content": "oklch(85.488% 0.002 253.041)", "--color-info": "oklch(62.616% 0.143 240.033)", 
```

### Core Architecture Module: `packages/bundle/daisyui-theme.mjs`
```
/** 🌼
 *  @license MIT
 *  daisyUI bundle
 *  https://daisyui.com/
 */

// packages/daisyui/functions/plugin.js
var plugin = {
  withOptions: (pluginFunction, configFunction = () => ({})) => {
    const optionsFunction = (options) => {
      const handler = pluginFunction(options);
      const config = configFunction(options);
      return { handler, config };
    };
    optionsFunction.__isOptionsFunction = true;
    return optionsFunction;
  }
};

// packages/daisyui/theme/object.js
var object_default = { synthwave: { "color-scheme": "dark", "--color-base-100": "oklch(15% 0.09 281.288)", "--color-base-200": "oklch(20% 0.09 281.288)", "--color-base-300": "oklch(25% 0.09 281.288)", "--color-base-content": "oklch(78% 0.115 274.713)", "--color-primary": "oklch(71% 0.202 349.761)", "--color-primary-content": "oklch(28% 0.109 3.907)", "--color-secondary": "oklch(82% 0.111 230.318)", "--color-secondary-content": "oklch(29% 0.066 243.157)", "--color-accent": "oklch(75% 0.183 55.934)", "--color-accent-content": "oklch(26% 0.079 36.259)", "--color-neutral": "oklch(45% 0.24 277.023)", "--color-neutral-content": "oklch(87% 0.065 274.039)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(77% 0.152 181.912)", "--color-success-content": "oklch(27% 0.046 192.524)", "--color-warning": "oklch(90% 0.182 98.111)", "--color-warning-content": "oklch(42% 0.095 57.708)", "--color-error": "oklch(73.7% 0.121 32.639)", "--color-error-content": "oklch(23.501% 0.096 290.329)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, sunset: { "color-scheme": "dark", "--color-base-100": "oklch(22% 0.019 237.69)", "--color-base-200": "oklch(20% 0.019 237.69)", "--color-base-300": "oklch(18% 0.019 237.69)", "--color-base-content": "oklch(77.383% 0.043 245.096)", "--color-primary": "oklch(74.703% 0.158 39.947)", "--color-primary-content": "oklch(14.94% 0.031 39.947)", "--color-secondary": "oklch(72.537% 0.177 2.72)", "--color-secondary-content": "oklch(14.507% 0.035 2.72)", "--color-accent": "oklch(71.294% 0.166 299.844)", "--color-accent-content": "oklch(14.258% 0.033 299.844)", "--color-neutral": "oklch(26% 0.019 237.69)", "--color-neutral-content": "oklch(70% 0.019 237.69)", "--color-info": "oklch(85.559% 0.085 206.015)", "--color-info-content": "oklch(17.111% 0.017 206.015)", "--color-success": "oklch(85.56% 0.085 144.778)", "--color-success-content": "oklch(17.112% 0.017 144.778)", "--color-warning": "oklch(85.569% 0.084 74.427)", "--color-warning-content": "oklch(17.113% 0.016 74.427)", "--color-error": "oklch(85.511% 0.078 16.886)", "--color-error-content": "oklch(17.102% 0.015 16.886)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, dracula: { "color-scheme": "dark", "--color-base-100": "oklch(28.822% 0.022 277.508)", "--color-base-200": "oklch(26.805% 0.02 277.508)", "--color-base-300": "oklch(24.787% 0.019 277.508)", "--color-base-content": "oklch(97.747% 0.007 106.545)", "--color-primary": "oklch(75.461% 0.183 346.812)", "--color-primary-content": "oklch(15.092% 0.036 346.812)", "--color-secondary": "oklch(74.202% 0.148 301.883)", "--color-secondary-content": "oklch(14.84% 0.029 301.883)", "--color-accent": "oklch(83.392% 0.124 66.558)", "--color-accent-content": "oklch(16.678% 0.024 66.558)", "--color-neutral": "oklch(39.445% 0.032 275.524)", "--color-neutral-content": "oklch(87.889% 0.006 275.524)", "--color-info": "oklch(88.263% 0.093 212.846)", "--color-info-content": "oklch(17.652% 0.018 212.846)", "--color-success": "oklch(87.099% 0.219 148.024)", "--color-success-content": "oklch(17.419% 0.043 148.024)", "--color-warning": "oklch(95.533% 0.134 112.757)", "--color-warning-content": "oklch(19.106% 0.026 112.757)", "--color-error": "oklch(68.22% 0.206 24.43)", "--color-error-content": "oklch(13.644% 0.041 24.43)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, caramellatte: { "color-scheme": "light", "--color-base-100": "oklch(98% 0.016 73.684)", "--color-base-200": "oklch(95% 0.038 75.164)", "--color-base-300": "oklch(90% 0.076 70.697)", "--color-base-content": "oklch(40% 0.123 38.172)", "--color-primary": "oklch(0% 0 0)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(22.45% 0.075 37.85)", "--color-secondary-content": "oklch(90% 0.076 70.697)", "--color-accent": "oklch(46.44% 0.111 37.85)", "--color-accent-content": "oklch(90% 0.076 70.697)", "--color-neutral": "oklch(55% 0.195 38.402)", "--color-neutral-content": "oklch(98% 0.016 73.684)", "--color-info": "oklch(42% 0.199 265.638)", "--color-info-content": "oklch(90% 0.076 70.697)", "--color-success": "oklch(43% 0.095 166.913)", "--color-success-content": "oklch(90% 0.076 70.697)", "--color-warning": "oklch(82% 0.189 84.429)", "--color-warning-content": "oklch(41% 0.112 45.904)", "--color-error": "oklch(70% 0.191 22.216)", "--color-error-content": "oklch(39% 0.141 25.723)", "--radius-selector": "2rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "2px", "--depth": "1", "--noise": "1" }, fantasy: { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(93% 0 0)", "--color-base-300": "oklch(86% 0 0)", "--color-base-content": "oklch(27.807% 0.029 256.847)", "--color-primary": "oklch(37.45% 0.189 325.02)", "--color-primary-content": "oklch(87.49% 0.037 325.02)", "--color-secondary": "oklch(53.92% 0.162 241.36)", "--color-secondary-content": "oklch(90.784% 0.032 241.36)", "--color-accent": "oklch(75.98% 0.204 56.72)", "--color-accent-content": "oklch(15.196% 0.04 56.72)", "--color-neutral": "oklch(27.807% 0.029 256.847)", "--color-neutral-content": "oklch(85.561% 0.005 256.847)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, lemonade: { "color-scheme": "light", "--color-base-100": "oklch(98.71% 0.02 123.72)", "--color-base-200": "oklch(91.8% 0.018 123.72)", "--color-base-300": "oklch(84.89% 0.017 123.72)", "--color-base-content": "oklch(19.742% 0.004 123.72)", "--color-primary": "oklch(58.92% 0.199 134.6)", "--color-primary-content": "oklch(11.784% 0.039 134.6)", "--color-secondary": "oklch(77.75% 0.196 111.09)", "--color-secondary-content": "oklch(15.55% 0.039 111.09)", "--color-accent": "oklch(85.39% 0.201 100.73)", "--color-accent-content": "oklch(17.078% 0.04 100.73)", "--color-neutral": "oklch(30.98% 0.075 108.6)", "--color-neutral-content": "oklch(86.196% 0.015 108.6)", "--color-info": "oklch(86.19% 0.047 224.14)", "--color-info-content": "oklch(17.238% 0.009 224.14)", "--color-success": "oklch(86.19% 0.047 157.85)", "--color-success-content": "oklch(17.238% 0.009 157.85)", "--color-warning": "oklch(86.19% 0.047 102.15)", "--color-warning-content": "oklch(17.238% 0.009 102.15)", "--color-error": "oklch(86.19% 0.047 25.85)", "--color-error-content": "oklch(17.238% 0.009 25.85)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, business: { "color-scheme": "dark", "--color-base-100": "oklch(24.353% 0 0)", "--color-base-200": "oklch(22.648% 0 0)", "--color-base-300": "oklch(20.944% 0 0)", "--color-base-content": "oklch(84.87% 0 0)", "--color-primary": "oklch(41.703% 0.099 251.473)", "--color-primary-content": "oklch(88.34% 0.019 251.473)", "--color-secondary": "oklch(64.092% 0.027 229.389)", "--color-secondary-content": "oklch(12.818% 0.005 229.389)", "--color-accent": "oklch(67.271% 0.167 35.791)", "--color-accent-content": "oklch(13.454% 0.033 35.791)", "--color-neutral": "oklch(27.441% 0.013 253.041)", "--color-neutral-content": "oklch(85.488% 0.002 253.041)", "--color-info": "oklch(62.616% 0.143 240.033)", "--color-info-content": "oklch(12.523% 0.028 240.033)", "--color-success": "oklch(70.226% 0.094 156.596)", "--color-success-content": "oklch(14.045% 0.018 156.596)", "--color-warning": "oklch(77.482% 0.115 81.519)", "--color-warning-content": "oklch(15.496% 0.023 81.519)", "--color-error": "oklch(51.61% 0.146 29.674)", "--color-error-content": "oklch(90.322% 0.029 29.674)", "--radius-selector": "0rem", "--radius-field": "0.25rem", "--radius-box": "0.25rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, black: { "color-scheme": "dark", "--color-base-100": "oklch(0% 0 0)", "--color-base-200": "oklch(19% 0 0)", "--color-base-300": "oklch(22% 0 0)", "--color-base-content": "oklch(87.609% 0 0)", "--color-primary": "oklch(35% 0 0)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(35% 0 0)", "--color-secondary-content": "oklch(100% 0 0)", "--color-accent": "oklch(35% 0 0)", "--color-accent-content": "oklch(100% 0 0)", "--color-neutral": "oklch(35% 0 0)", "--color-neutral-content": "oklch(100% 0 0)", "--color-info": "oklch(45.201% 0.313 264.052)", "--color-info-content": "oklch(89.04% 0.062 264.052)", "--color-success": "oklch(51.975% 0.176 142.495)", "--color-success-content": "oklch(90.395% 0.035 142.495)", "--color-warning": "oklch(96
```

### Core Architecture Module: `packages/bundle/daisyui.js`
```
/** 🌼
 *  @license MIT
 *  daisyUI bundle
 *  https://daisyui.com/
 */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// packages/daisyui/index.js
var exports_daisyui = {};
__export(exports_daisyui, {
  default: () => daisyui_default
});
module.exports = __toCommonJS(exports_daisyui);

// packages/daisyui/functions/themeOrder.js
var themeOrder_default = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk"
];

// packages/daisyui/functions/pluginOptionsHandler.js
var pluginOptionsHandler = (() => {
  let firstRun = true;
  return (options, addBase, themesObject, packageVersion) => {
    const {
      logs = true,
      root = ":root",
      themes = ["light --default", "dark --prefersdark"],
      include,
      exclude,
      prefix = ""
    } = options || {};
    if (logs !== false && firstRun) {
      console.log(`${atob("Lyoh")} ${decodeURIComponent("%F0%9F%8C%BC")} ${atob("ZGFpc3lVSQ==")} ${packageVersion} ${atob("Ki8=")}`);
      firstRun = false;
    }
    const applyTheme = (themeName, flags) => {
      const theme = themesObject[themeName];
      if (theme) {
        const themeControllerClass = `${prefix}theme-controller`;
        let selector = `${root}:has(input.${themeControllerClass}[value=${themeName}]:checked),[data-theme=${themeName}]`;
        if (flags.includes("--default")) {
          selector = `:where(${root}),${selector}`;
        }
        addBase({ [selector]: theme });
        if (flags.includes("--prefersdark")) {
          const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
          addBase({ "@media (prefers-color-scheme: dark)": { [darkSelector]: theme } });
        }
      }
    };
    if (themes === "all") {
      if (themesObject["light"]) {
        applyTheme("light", ["--default"]);
      }
      if (themesObject["dark"]) {
        const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
        addBase({ "@media (prefers-color-scheme: dark)": { [darkSelector]: themesObject["dark"] } });
      }
      themeOrder_default.forEach((themeName) => {
        if (themesObject[themeName]) {
          applyTheme(themeName, []);
        }
      });
    } else if (themes) {
      const themeArray = Array.isArray(themes) ? themes : [themes];
      if (themeArray.length === 1 && themeArray[0].includes("--default")) {
        const [themeName, ...flags] = themeArray[0].split(" ");
        applyTheme(themeName, flags);
        return { include, exclude, prefix };
      }
      themeArray.forEach((themeOption) => {
        const [themeName, ...flags] = themeOption.split(" ");
        if (flags.includes("--default")) {
          applyTheme(themeName, ["--default"]);
        }
      });
      themeArray.forEach((themeOption) => {
        const [themeName, ...flags] = themeOption.split(" ");
        if (flags.includes("--prefersdark")) {
          const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
          addBase({
            "@media (prefers-color-scheme: dark)": { [darkSelector]: themesObject[themeName] }
          });
        }
      });
      themeArray.forEach((themeOption) => {
        const [themeName] = themeOption.split(" ");
        applyTheme(themeName, []);
      });
    }
    return { include, exclude, prefix };
  };
})();

// packages/daisyui/functions/plugin.js
var plugin = {
  withOptions: (pluginFunction, configFunction = () => ({})) => {
    const optionsFunction = (options) => {
      const handler = pluginFunction(options);
      const config = configFunction(options);
      return { handler, config };
    };
    optionsFunction.__isOptionsFunction = true;
    return optionsFunction;
  }
};

// packages/daisyui/functions/nestCssLayers.js
var appendRule = (styles, selector, rule) => {
  const currentRule = styles[selector];
  if (currentRule === undefined) {
    styles[selector] = rule;
    return;
  }
  styles[selector] = Array.isArray(currentRule) ? [...currentRule, rule] : [currentRule, rule];
};
var wrapWithAtRules = (rule, atRules) => atRules.reduceRight((wrappedRule, atRule) => ({ [atRule]: wrappedRule }), rule);
var moveLayerRules = (styles, layerValue, atRules) => {
  const layerBlocks = Array.isArray(layerValue) ? layerValue : [layerValue];
  for (const layerBlock of layerBlocks) {
    for (const [key, value] of Object.entries(layerBlock)) {
      if (key.startsWith("@")) {
        moveLayerRules(styles, value, [...atRules, key]);
        continue;
      }
      appendRule(styles, key, wrapWithAtRules(value, atRules));
    }
  }
};
var nestCssLayers = (styles) => {
  const nestedStyles = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key.startsWith("@layer ")) {
      moveLayerRules(nestedStyles, value, [key]);
      continue;
    }
    appendRule(nestedStyles, key, value);
  }
  return nestedStyles;
};

// packages/daisyui/functions/variables.js
var variables_default = {
  colors: {
    "base-100": "var(--color-base-100)",
    "base-200": "var(--color-base-200)",
    "base-300": "var(--color-base-300)",
    "base-content": "var(--color-base-content)",
    primary: "var(--color-primary)",
    "primary-content": "var(--color-primary-content)",
    secondary: "var(--color-secondary)",
    "secondary-content": "var(--color-secondary-content)",
    accent: "var(--color-accent)",
    "accent-content": "var(--color-accent-content)",
    neutral: "var(--color-neutral)",
    "neutral-content": "var(--color-neutral-content)",
    info: "var(--color-info)",
    "info-content": "var(--color-info-content)",
    success: "var(--color-success)",
    "success-content": "var(--color-success-content)",
    warning: "var(--color-warning)",
    "warning-content": "var(--color-warning-content)",
    error: "var(--color-error)",
    "error-content": "var(--color-error-content)"
  },
  borderRadius: {
    selector: "var(--radius-selector)",
    field: "var(--radius-field)",
    box: "var(--radius-box)"
  }
};

// packages/daisyui/theme/object.js
var object_default = { synthwave: { "color-scheme": "dark", "--color-base-100": "oklch(15% 0.09 281.288)", "--color-base-200": "oklch(20% 0.09 281.288)", "--color-base-300": "oklch(25% 0.09 281.288)", "--color-base-content": "oklch(78% 0.115 274.713)", "--color-primary": "oklch(71% 0.202 349.761)", "--color-primary-content": "oklch(28% 0.109 3.907)", "--color-secondary": "oklch(82% 0.111 230.318)", "--color-secondary-content": "oklch(29% 0.066 243.157)", "--color-accent": "oklch(75% 0.183 55.934)", "--color-accent-content": "oklch(26% 0.079 36.259)", "--color-neutral": "oklch(45% 0.24 277.023)", "--color-neutral-content": "oklch(87% 0.065 274.039)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(77% 0.152 181.912)", "--color-success-content": "oklch(27% 0.046 192.524)", "--color-warning": "oklch(90% 0.182 98.111)", "--color-warning-content": "oklch(42% 0.095 57.708)", "--color-error": "oklch(73.7% 0.121 32.639)", "--color-error-content": "oklch(23.501% 0.096 290.329)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, sunset: { "color-scheme": "dark", "--color-base-100": "oklch(22% 0.019 237.69)", "--color-base-200": "oklch(20% 0.019 237.69)", "--color-base-300": "oklch(18% 0.019 237.69)", "--color-base-content": "oklch(77.383% 0.043 245.096)", "--color-primary": "oklch(74.703% 0.158 39.947)", "--color-primary-content": "oklch(14.94% 0.031 39.947)", "--color-secondary": "oklch(72.537% 0.177 2.72)", "--color-secondary-content": "oklch(14.507% 0.035 2.72)", "--color-accent": "oklch(71.294% 0.166 299.844)", "--color-accent-content": "oklch(14.258% 0.033 299.844)", "--color-neutral": "oklch(26% 0.019 237.69)", "--color-neutral-content": "oklch(70% 0.019 237.69)", "--color-info": "oklch(85.559% 0.085 206.015)", "--color-info-content": "oklch(17.111% 0.017 206.015)", "--color-success": "oklch(85.56% 0.085 144.778)", "--color-success-content": "oklch(17.112% 0.017 144.778)", "--color-warning": "oklch(85.569% 0.084 74.427)", "--color-warning-content": "oklch(17.113% 0.016 74.427)", "--color-error": "oklch(85.511% 0.078 16.886)", "--color-error-content": "oklch(17.102% 0.015 16.886)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.2
```

### Core Architecture Module: `packages/bundle/daisyui.mjs`
```
/** 🌼
 *  @license MIT
 *  daisyUI bundle
 *  https://daisyui.com/
 */

// packages/daisyui/functions/themeOrder.js
var themeOrder_default = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk"
];

// packages/daisyui/functions/pluginOptionsHandler.js
var pluginOptionsHandler = (() => {
  let firstRun = true;
  return (options, addBase, themesObject, packageVersion) => {
    const {
      logs = true,
      root = ":root",
      themes = ["light --default", "dark --prefersdark"],
      include,
      exclude,
      prefix = ""
    } = options || {};
    if (logs !== false && firstRun) {
      console.log(`${atob("Lyoh")} ${decodeURIComponent("%F0%9F%8C%BC")} ${atob("ZGFpc3lVSQ==")} ${packageVersion} ${atob("Ki8=")}`);
      firstRun = false;
    }
    const applyTheme = (themeName, flags) => {
      const theme = themesObject[themeName];
      if (theme) {
        const themeControllerClass = `${prefix}theme-controller`;
        let selector = `${root}:has(input.${themeControllerClass}[value=${themeName}]:checked),[data-theme=${themeName}]`;
        if (flags.includes("--default")) {
          selector = `:where(${root}),${selector}`;
        }
        addBase({ [selector]: theme });
        if (flags.includes("--prefersdark")) {
          const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
          addBase({ "@media (prefers-color-scheme: dark)": { [darkSelector]: theme } });
        }
      }
    };
    if (themes === "all") {
      if (themesObject["light"]) {
        applyTheme("light", ["--default"]);
      }
      if (themesObject["dark"]) {
        const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
        addBase({ "@media (prefers-color-scheme: dark)": { [darkSelector]: themesObject["dark"] } });
      }
      themeOrder_default.forEach((themeName) => {
        if (themesObject[themeName]) {
          applyTheme(themeName, []);
        }
      });
    } else if (themes) {
      const themeArray = Array.isArray(themes) ? themes : [themes];
      if (themeArray.length === 1 && themeArray[0].includes("--default")) {
        const [themeName, ...flags] = themeArray[0].split(" ");
        applyTheme(themeName, flags);
        return { include, exclude, prefix };
      }
      themeArray.forEach((themeOption) => {
        const [themeName, ...flags] = themeOption.split(" ");
        if (flags.includes("--default")) {
          applyTheme(themeName, ["--default"]);
        }
      });
      themeArray.forEach((themeOption) => {
        const [themeName, ...flags] = themeOption.split(" ");
        if (flags.includes("--prefersdark")) {
          const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
          addBase({
            "@media (prefers-color-scheme: dark)": { [darkSelector]: themesObject[themeName] }
          });
        }
      });
      themeArray.forEach((themeOption) => {
        const [themeName] = themeOption.split(" ");
        applyTheme(themeName, []);
      });
    }
    return { include, exclude, prefix };
  };
})();

// packages/daisyui/functions/plugin.js
var plugin = {
  withOptions: (pluginFunction, configFunction = () => ({})) => {
    const optionsFunction = (options) => {
      const handler = pluginFunction(options);
      const config = configFunction(options);
      return { handler, config };
    };
    optionsFunction.__isOptionsFunction = true;
    return optionsFunction;
  }
};

// packages/daisyui/functions/nestCssLayers.js
var appendRule = (styles, selector, rule) => {
  const currentRule = styles[selector];
  if (currentRule === undefined) {
    styles[selector] = rule;
    return;
  }
  styles[selector] = Array.isArray(currentRule) ? [...currentRule, rule] : [currentRule, rule];
};
var wrapWithAtRules = (rule, atRules) => atRules.reduceRight((wrappedRule, atRule) => ({ [atRule]: wrappedRule }), rule);
var moveLayerRules = (styles, layerValue, atRules) => {
  const layerBlocks = Array.isArray(layerValue) ? layerValue : [layerValue];
  for (const layerBlock of layerBlocks) {
    for (const [key, value] of Object.entries(layerBlock)) {
      if (key.startsWith("@")) {
        moveLayerRules(styles, value, [...atRules, key]);
        continue;
      }
      appendRule(styles, key, wrapWithAtRules(value, atRules));
    }
  }
};
var nestCssLayers = (styles) => {
  const nestedStyles = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key.startsWith("@layer ")) {
      moveLayerRules(nestedStyles, value, [key]);
      continue;
    }
    appendRule(nestedStyles, key, value);
  }
  return nestedStyles;
};

// packages/daisyui/functions/variables.js
var variables_default = {
  colors: {
    "base-100": "var(--color-base-100)",
    "base-200": "var(--color-base-200)",
    "base-300": "var(--color-base-300)",
    "base-content": "var(--color-base-content)",
    primary: "var(--color-primary)",
    "primary-content": "var(--color-primary-content)",
    secondary: "var(--color-secondary)",
    "secondary-content": "var(--color-secondary-content)",
    accent: "var(--color-accent)",
    "accent-content": "var(--color-accent-content)",
    neutral: "var(--color-neutral)",
    "neutral-content": "var(--color-neutral-content)",
    info: "var(--color-info)",
    "info-content": "var(--color-info-content)",
    success: "var(--color-success)",
    "success-content": "var(--color-success-content)",
    warning: "var(--color-warning)",
    "warning-content": "var(--color-warning-content)",
    error: "var(--color-error)",
    "error-content": "var(--color-error-content)"
  },
  borderRadius: {
    selector: "var(--radius-selector)",
    field: "var(--radius-field)",
    box: "var(--radius-box)"
  }
};

// packages/daisyui/theme/object.js
var object_default = { synthwave: { "color-scheme": "dark", "--color-base-100": "oklch(15% 0.09 281.288)", "--color-base-200": "oklch(20% 0.09 281.288)", "--color-base-300": "oklch(25% 0.09 281.288)", "--color-base-content": "oklch(78% 0.115 274.713)", "--color-primary": "oklch(71% 0.202 349.761)", "--color-primary-content": "oklch(28% 0.109 3.907)", "--color-secondary": "oklch(82% 0.111 230.318)", "--color-secondary-content": "oklch(29% 0.066 243.157)", "--color-accent": "oklch(75% 0.183 55.934)", "--color-accent-content": "oklch(26% 0.079 36.259)", "--color-neutral": "oklch(45% 0.24 277.023)", "--color-neutral-content": "oklch(87% 0.065 274.039)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(77% 0.152 181.912)", "--color-success-content": "oklch(27% 0.046 192.524)", "--color-warning": "oklch(90% 0.182 98.111)", "--color-warning-content": "oklch(42% 0.095 57.708)", "--color-error": "oklch(73.7% 0.121 32.639)", "--color-error-content": "oklch(23.501% 0.096 290.329)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, sunset: { "color-scheme": "dark", "--color-base-100": "oklch(22% 0.019 237.69)", "--color-base-200": "oklch(20% 0.019 237.69)", "--color-base-300": "oklch(18% 0.019 237.69)", "--color-base-content": "oklch(77.383% 0.043 245.096)", "--color-primary": "oklch(74.703% 0.158 39.947)", "--color-primary-content": "oklch(14.94% 0.031 39.947)", "--color-secondary": "oklch(72.537% 0.177 2.72)", "--color-secondary-content": "oklch(14.507% 0.035 2.72)", "--color-accent": "oklch(71.294% 0.166 299.844)", "--color-accent-content": "oklch(14.258% 0.033 299.844)", "--color-neutral": "oklch(26% 0.019 237.69)", "--color-neutral-content": "oklch(70% 0.019 237.69)", "--color-info": "oklch(85.559% 0.085 206.015)", "--color-info-content": "oklch(17.111% 0.017 206.015)", "--color-success": "oklch(85.56% 0.085 144.778)", "--color-success-content": "oklch(17.112% 0.017 144.778)", "--color-warning": "oklch(85.569% 0.084 74.427)", "--color-warning-content": "oklch(17.113% 0.016 74.427)", "--color-error": "oklch(85.511% 0.078 16.886)", "--color-error-content": "oklch(17.102% 0.015 16.886)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, dracula: { "color-scheme": "dark", "--color-base-100": "oklch(28.822% 0.022 277.508)", "--color-base-200": "oklch(26.805% 0.02 277.508)", "--color-base-300": "oklch(24.787% 0.019 277.508)", "--color-base-content": "oklch(97.747% 0.007 106.545)", "--color-primary": "oklch(75.461% 0.183 346.812)", "--color-primary-content": "oklch(15.092% 0.036 346.812)", "--color-secondary": "oklch(74.202% 0.148 301.883)", "--color-secondary-content": "oklch(14.84% 0.029 301.883)", "--color-accent": "oklch(83.392% 0.124 66.558)", "--color-accent-content": "oklch(16.678% 0.024 66.558)", "--color-neutral": "oklch(39.445% 0.032 275.524)", "--color-neutral-content": "oklch(87.889% 0.006 275.524)", "--color-info": "oklch(88.263% 0.093 212.846)", "--color-info-content": "oklch(17.652% 0.018 212.846)", "--color-success": "oklch(87.099% 0.219 148.024)", "--color-success-content": "oklch(17.419% 0.043 148.024)", "--color-warning": "oklch(95.533% 0.134 112.757)", "--color-warning-content": "oklch(19.106% 0.026 112.757)", "--color-error": "oklch(68.22% 0.206 24.43)", "--color-error-content": "oklch(13.644% 0.041 24.43)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0"
```

### Core Architecture Module: `packages/daisyui/functions/addPrefix.js`
```
const defaultExcludedPrefixes = ["color-", "size-", "radius-", "border", "depth", "noise"]
const excludedSelectors = [
  "prose",
  "is-hidden",
  "is-bound",
  "is-disabled",
  "is-today",
  "is-selected",
  "has-event",
  "is-inrange",
  "is-startrange",
  "is-endrange",
  "is-outside-current-month",
  "is-selection-disabled",
  "pick-whole-week",
]
const shouldExcludeSelector = (selector) => {
  const selectorName = selector.match(/^[\w-]+/)?.[0] || selector
  return excludedSelectors.includes(selectorName) || /^(rdp|pika|vc)-/.test(selectorName)
}

const shouldExcludeVariable = (variableName, excludedPrefixes) => {
  if (variableName.startsWith("tw")) {
    return true
  }
  return excludedPrefixes.some((excludedPrefix) => variableName.startsWith(excludedPrefix))
}

const prefixVariable = (variableName, prefix, excludedPrefixes) => {
  if (shouldExcludeVariable(variableName, excludedPrefixes)) {
    return variableName
  }
  return `${prefix}${variableName}`
}

const isHexDigit = (character) => character !== undefined && /^[0-9a-fA-F]$/.test(character)
const isIdentifierCharacter = (character) => {
  if (character === undefined) return false
  const characterCode = character.charCodeAt(0)
  return (
    character === "-" ||
    character === "_" ||
    character === "\\" ||
    (characterCode >= 48 && characterCode <= 57) ||
    (characterCode >= 65 && characterCode <= 90) ||
    (characterCode >= 97 && characterCode <= 122) ||
    characterCode >= 128
  )
}

const getEscapeEnd = (selector, start) => {
  if (!isHexDigit(selector[start + 1])) return Math.min(start + 2, selector.length)

  let end = start + 1
  while (end < selector.length && end < start + 7 && isHexDigit(selector[end])) {
    end++
  }
  if (/\s/.test(selector[end])) end++
  return end
}

const getIdentifierEnd = (selector, start) => {
  let end = start
  while (end < selector.length && isIdentifierCharacter(selector[end])) {
    if (selector[end] === "\\") {
      end = getEscapeEnd(selector, end)
    } else {
      end++
    }
  }
  return end
}

const prefixSelectorClasses = (selector, prefix) => {
  let result = ""
  let attributeDepth = 0
  let quote = ""

  for (let index = 0; index < selector.length;) {
    const character = selector[index]

    if (quote) {
      if (character === "\\") {
        const escapeEnd = getEscapeEnd(selector, index)
        result += selector.slice(index, escapeEnd)
        index = escapeEnd
        continue
      }
      result += character
      index++
      if (character === quote) quote = ""
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      result += character
      index++
      continue
    }

    if (character === "/" && selector[index + 1] === "*") {
      const commentEnd = selector.indexOf("*/", index + 2)
      const end = commentEnd === -1 ? selector.length : commentEnd + 2
      result += selector.slice(index, end)
      index = end
      continue
    }

    if (character === "\\") {
      const escapeEnd = getEscapeEnd(selector, index)
      result += selector.slice(index, escapeEnd)
      index = escapeEnd
      continue
    }

    if (character === "[") {
      attributeDepth++
    } else if (character === "]" && attributeDepth > 0) {
      attributeDepth--
    }

    if (character === "." && attributeDepth === 0 && isIdentifierCharacter(selector[index + 1])) {
      const identifierEnd = getIdentifierEnd(selector, index + 1)
      const identifier = selector.slice(index + 1, identifierEnd)
      result += shouldExcludeSelector(identifier) ? `.${identifier}` : `.${prefix}${identifier}`
      index = identifierEnd
      continue
    }

    result += character
    index++
  }

  return result
}

const getPrefixedKey = (key, prefix, excludedPrefixes) => {
  if (!prefix) return key

  if (key.startsWith("--")) {
    const variableName = key.slice(2)
    return `--${prefixVariable(variableName, prefix, excludedPrefixes)}`
  }

  if (key.startsWith("@property --")) {
    return processStringValue(key, prefix, excludedPrefixes)
  }

  if (key.startsWith("@")) {
    return key
  }

  const prefixedKey = prefixSelectorClasses(key, prefix)
  return /^[>+~]/.test(prefixedKey) && !prefixedKey.includes(",") ? ` ${prefixedKey}` : prefixedKey
}

const processArrayValue = (value, prefix, excludedPrefixes) => {
  return value.map((item) => {
    if (typeof item === "string") {
      if (item.startsWith(".")) {
        return getPrefixedKey(item, prefix, excludedPrefixes)
      }
      return processStringValue(item, prefix, excludedPrefixes)
    }
    if (typeof item === "object" && item !== null) {
      return Array.isArray(item)
        ? processArrayValue(item, prefix, excludedPrefixes)
        : addPrefix(item, prefix, excludedPrefixes)
    }
    return item
  })
}

const reVariableName = /--([a-zA-Z0-9_-]+)/g
const processStringValue = (value, prefix, excludedPrefixes) => {
  if (prefix === 0) return value
  return value.replace(reVariableName, (match, variableName) => {
    if (shouldExcludeVariable(variableName, excludedPrefixes)) {
      return match
    }
    return `--${prefix}${variableName}`
  })
}

const processValue = (value, prefix, excludedPrefixes) => {
  if (Array.isArray(value)) {
    return processArrayValue(value, prefix, excludedPrefixes)
  } else if (typeof value === "object" && value !== null) {
    return addPrefix(value, prefix, excludedPrefixes)
  } else if (typeof value === "string") {
    return processStringValue(value, prefix, excludedPrefixes)
  } else {
    return value
  }
}

export const addPrefix = (obj, prefix, excludedPrefixes = defaultExcludedPrefixes) => {
  return Object.entries(obj).reduce((result, [key, value]) => {
    const newKey = getPrefixedKey(key, prefix, excludedPrefixes)
    result[newKey] = processValue(value, prefix, excludedPrefixes)
    return result
  }, {})
}

```

### Core Architecture Module: `packages/daisyui/functions/breakpoints.js`
```
export default {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
}

```

### Core Architecture Module: `packages/daisyui/functions/bundle.js`
```
import { updateVersion } from "./updateVersion.js"

const BANNER = "/** 🌼\n *  @license MIT\n *  daisyUI bundle\n *  https://daisyui.com/\n */\n"
const FOOTER =
  '\n/*\n    \n  MIT License\n    \n  Copyright (c) 2020 Pouya Saadeghi – https://daisyui.com\n    \n  Permission is hereby granted, free of charge, to any person obtaining a copy\n  of this software and associated documentation files (the "Software"), to deal\n  in the Software without restriction, including without limitation the rights\n  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n  copies of the Software, and to permit persons to whom the Software is\n  furnished to do so, subject to the following conditions:\n    \n  The above copyright notice and this permission notice shall be included in all\n  copies or substantial portions of the Software.\n    \n  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n  SOFTWARE.\n\n*/'

await Promise.all([
  updateVersion(),
  Bun.build({
    entrypoints: ["packages/daisyui/index.js"],
    outdir: "packages/bundle",
    naming: "daisyui.mjs",
    format: "esm",
    banner: BANNER,
    footer: FOOTER,
  }),
  Bun.build({
    entrypoints: ["packages/daisyui/theme/index.js"],
    outdir: "packages/bundle",
    naming: "daisyui-theme.mjs",
    format: "esm",
    banner: BANNER,
    footer: FOOTER,
  }),
  Bun.build({
    entrypoints: ["packages/daisyui/index.js"],
    outdir: "packages/bundle",
    naming: "daisyui.js",
    format: "cjs",
    banner: BANNER,
    footer: FOOTER,
  }),
  Bun.build({
    entrypoints: ["packages/daisyui/theme/index.js"],
    outdir: "packages/bundle",
    naming: "daisyui-theme.js",
    format: "cjs",
    banner: BANNER,
    footer: FOOTER,
  }),
])

```

### Core Architecture Module: `packages/daisyui/functions/cleanCss.js`
```
export const cleanCss = (cssContent) => {
  // Precompile regular expressions for better performance
  const emptyFallbackRegex = /var\((--[^,)]+),\s*\)/g
  const spacingWidthFallbackRegex =
    /var\((--(spacing|width)[\w-]*),\s*((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g
  const spacingVarRegex = /var\(--spacing\)/g

  // Remove empty fallbacks
  cssContent = cssContent.replace(emptyFallbackRegex, "var($1)")

  // Remove spacing, width css variable if there's a fallback value
  cssContent = cssContent.replace(
    spacingWidthFallbackRegex,
    (match, variable, prefix, fallback) => {
      // If there's no actual fallback value, return the original match
      return fallback.trim() ? fallback.trim() : match
    },
  )

  // Replace all `var(--spacing)` with `0.25rem`
  cssContent = cssContent.replace(spacingVarRegex, "0.25rem")

  return cssContent
}

```

### Core Architecture Module: `packages/daisyui/functions/compileAndExtractStyles.js`
```
import path from "node:path"
import { promises as fs } from "node:fs"
import { compile } from "tailwindcss"

export async function loadThemes() {
  const [defaultTheme, theme] = await Promise.all([
    fs.readFile(
      path.join(import.meta.dirname, "../../../node_modules/tailwindcss/theme.css"),
      "utf-8",
    ),
    fs.readFile(path.join(import.meta.dirname, "./variables.css"), "utf-8"),
  ])
  return { defaultTheme, theme }
}

export async function compileAndExtractStyles(styleContent, defaultTheme, theme) {
  const compiledContent = (
    await compile(
      `
    @layer theme{${defaultTheme}${theme}}
    @layer wrapperStart{${styleContent}}
    @layer wrapperEnd
  `,
      {
        // Polyfills:
        // None = 0,
        // AtProperty = 1,
        // ColorMix = 2,
        // All = 3
        polyfills: 1, // AtProperty only, excludes ColorMix
      },
    )
  ).build([])

  const startIndex = compiledContent.indexOf("@layer wrapperStart")
  const endIndex = compiledContent.indexOf("@layer wrapperEnd")

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Failed to find wrapper layers in compiled content")
  }

  const openingBraceIndex = compiledContent.indexOf("{", startIndex)
  const closingBraceIndex = compiledContent.lastIndexOf("}", endIndex)

  if (
    openingBraceIndex === -1 ||
    closingBraceIndex === -1 ||
    openingBraceIndex >= closingBraceIndex
  ) {
    throw new Error("Invalid wrapper structure in compiled content")
  }

  return compiledContent.substring(openingBraceIndex + 1, closingBraceIndex).trim()
}

```

### Core Architecture Module: `packages/daisyui/functions/copyFile.js`
```
import fs from "fs/promises"
import path from "path"

export const copyFile = async (from, to, newName = null) => {
  try {
    const destDir = path.dirname(to)
    await fs.mkdir(destDir, { recursive: true })

    let destPath = to
    if (newName) {
      destPath = path.join(destDir, newName)
    }

    await fs.copyFile(from, destPath)
  } catch (error) {
    throw new Error(`Error copying file from ${from} to ${to}: ${error.message}`)
  }
}

```

### Core Architecture Module: `packages/daisyui/functions/createDirectoryBasedOnFileNames.js`
```
import { promises as fs } from "node:fs"
import path from "node:path"

export const createDirectoryBasedOnFileNames = async (fileName, fileExtension, distDir) => {
  const componentName = path.basename(fileName, fileExtension)
  const componentDir = path.join(distDir, componentName)
  await fs.mkdir(componentDir, { recursive: true })
  return componentDir
}

```

### Core Architecture Module: `packages/daisyui/functions/createPluginFiles.js`
```
import { promises as fs } from "fs"
import path from "path"

export const createPluginFiles = async (type, componentDir, jsContent, fileName) => {
  const types = {
    base: "addBase",
    component: "addComponents",
    utility: "addUtilities",
  }

  // create object.js
  const objectJsPath = path.join(componentDir, "object.js")
  await fs.writeFile(objectJsPath, `export default ${jsContent};`)

  // create index.js
  const indexJsPath = path.join(componentDir, "index.js")
  const indexJsContent = `import ${fileName} from './object.js';
import { addPrefix } from '../../functions/addPrefix.js';

export default ({ ${types[type]}, prefix = '' }) => {
  const prefixed${fileName} = addPrefix(${fileName}, prefix);
  ${types[type]}({ ...prefixed${fileName} });
};
`
  await fs.writeFile(indexJsPath, indexJsContent)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #651** (2022-03-25): **Coundown broken**
  *Symptoms*: Countdown broken on build 2.13.0  ![image](https://user-images.githubusercontent.com/7901659/160092044-db4426a7-8596-40ff-a175-b6528ea9cc3f.png) 

- **Issue #645** (2022-03-24): **Setting "menu" and "top-X", menu items are rounded**
  *Symptoms*: Example: https://play.tailwindcss.com/tt8XBZbzaY?size=774x279  Maybe the below line is affecting. https://github.com/saadeghi/daisyui/blob/master/src/components/styled/menu.css#L13  Is this a bug, or an intentional implementation?   Thanks for the great library!

- **Issue #626** (2022-03-17): **general hover states not working **
  *Symptoms*: I would have expected that the ``hover:daisy-classname`` should work as normal but it doesn't seem to work at all.  e.g.  ``` <div class="w-16 border-4 hover:bg-accent hover:border-accent-focus hover:text-accent-focus">TESTING</div> ``` there is absolutely no change in the hover state. Is this intentional?
  **Post-Mortem & Fix Analysis**:
  > It does work.   Example: https://play.tailwindcss.com/LqQkp3XP7c    Are you sure your Tailwind setup is correct?
  > ??? that link doesn't work either it just shows:  ``` Config Error Line 3 Cannot find module 'daisyui' ``` anyhow I'm importing it from cdn as shown on the your main webpage ``` <link href="https://cdn.jsdelivr.net/npm/daisyui@2.8.0/dist/full.css" rel="stylesheet" type="text/css" />   <script src="https://cdn.tailwindcss.com"></script> ```  see https://jsfiddle.net/pL2aqkn5/
  > I see this is a problem on CDN file. I will look at it today. For now, you can use the installable node.js package or use one of sample projects on StackBlitz here: https://daisyui.com/docs/install/

- **Issue #500** (2022-02-22): **Website Documentation component Select**
  *Symptoms*: The following examples (preview) are not showing the correct color on the page: Info color, Success color, Warning color and Error color.   Assuming that the border(outline) for the select box should be displaying the correct color. The HTML code appears to correct.
  **Post-Mortem & Fix Analysis**:
  > Progress component also seems affected

- **Issue #455** (2022-02-15): **Outlined state buttons close to invisible with light themes**
  *Symptoms*: With the lighter state colors of 2.0, outlined state buttons have become close to invisible on light backgrounds. <img width="1011" alt="Screenshot 2022-02-15 at 00 30 56" src="https://user-images.githubusercontent.com/7240688/153964621-c5e6af70-e568-432c-8115-e7f6202bc076.png">  
  **Post-Mortem & Fix Analysis**:
  > Fixed.   Thanks

- **Issue #449** (2022-02-14): **steps component not following tailwind prefix**
  *Symptoms*: My tailwind config contains a prefix property like this: `prefix: 'tw-'` The following highlighted css breaks because when it's used by tailwind it fails to convert the class with prefix. https://github.com/saadeghi/daisyui/blob/master/src/components/styled/steps.css#L4  ``` <ul class="tw-steps tw-w-full">   <li class="step tw-step-primary">Test 1</li>  <-- We should be able to use tw-step here.   <li class="step tw-step-primary">Test 2</li>   <li class="step tw-step-primary">Test 3</li> </ul> ``` 
  **Post-Mortem & Fix Analysis**:
  > Fixed in v2.0   https://play.tailwindcss.com/IFdiVRSNqD

- **Issue #329** (2021-12-13): **Failed to Compile Syntax Error - 1.16.2 and Tailwind 3**
  *Symptoms*: Hey All,   I get this error when I run `npm run build`  ``` Creating an optimized production build...  🌼 daisyUI components 1.16.2  https://github.com/saadeghi/daisyui   ✔︎ Including:  base, components, themes[22], utilities    Failed to compile.  Syntax error: postcss-custom-properties: <css input> Unknown word (1:1) > 1 | var(--b1)/var(--tw-bg-opacity,1)     | ^ ```  I followed this tailwind guide to create a fresh react project,  ``` https://tailwindcss.com/docs/guides/create-react-app ``` if I remove `require("daisyui")` from `tailwind.config.js` then running npm run build, the project builds just fine but breaks when I add daisyui in the plugins section  My package.json ``` {   "name": "github-finder",   "version": "0.1.0",   "private": true,   "dependencies": {     "@testing-library/jest-dom": "^5.16.1",     "@testing-library/react": "^12.1.2",     "@testing-library/user-event": "^13.5.0",     "daisyui": "^1.16.2",     "react": "^17.0.2",     "react-dom": "^17.0.2",     "react-scripts": "5.0.0-next.58",     "web-vitals": "^2.1.2"   },   "scripts": {     "start": "react-scripts start",     "build": "react-scripts build",     "test": "react-scripts test",     "eject": "react-scripts eject"   },   "eslintConfig": {     "extends": [       "react-app",       "react-app/jest"     ]   },   "browserslist": {     "production": [       ">0.2%",       "not dead",       "not op_mini all"     ],     "development": [       "l
  **Post-Mortem & Fix Analysis**:
  > I think this is related to a question I just asked ( #328 ) lol. Tailwind 3 was just realeased and is the default when you start a new project. I think DaisyUI may need some changes to be compatible
  > @zenhorace @MxD-js  Can you please provide an example github repo so I can reproduce this issue?   Because I just created [a new project](https://github.com/saadeghi/cra-tailwind3-daisyui-example) based on the [Tailwind guide](https://tailwindcss.com/docs/guides/create-react-app ) you mentioned and it works as expected.
  > > @zenhorace @MxD-js Can you please provide an example github repo so I can reproduce this issue? Because I just created [a new project](https://github.com/saadeghi/cra-tailwind3-daisyui-example) based on the [Tailwind guide](https://tailwindcss.com/docs/guides/create-react-app) you mentioned and it works as expected.  Sure, here's the repo.   https://github.com/MxD-js/my-project-tailwind-daisyui  I cloned your sample project and get the same result, `npm run start` works fine, but `npm run build` throws error  worth noting that I am node v16.13.1 and npm 8.1.2  ![image](https://user-images.githubusercontent.com/60336163/145631856-6c3a0b10-9e4e-4a95-85fd-ec91c5826fc6.png)

- **Issue #216** (2021-09-29): **.menu > li breaks .hidden**
  *Symptoms*: As the title says, when you're using a `.menu`, any subsequent `li` tags don't support the tailwind `.hidden` class due to specificity rules ![image](https://user-images.githubusercontent.com/6368283/134807432-2e236c0b-46a0-4ae6-abba-76f81694281f.png)  

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

### Incident Patch 1: `27194501` (2026-09-30)
**Commit Message**: fix: btn-link with btn-disabled color (#4749)

**File**: `packages/daisyui/src/components/button.css` (modified, +1/-2)
```diff
@@ -335,8 +335,7 @@
   }
 }
 
-.btn-disabled,
-.btn:is(:disabled, [disabled], [aria-disabled="true"]) {
+.btn:is(.btn-disabled, :disabled, [disabled], [aria-disabled="true"]) {
   @layer daisyui {
     @apply pointer-events-none;
     color: color-mix(in oklch, var(--color-base-content) 20%, #0000);
```

---

### Incident Patch 2: `ae8e5216` (2026-09-29)
**Commit Message**: docs: add "Use daisyUI with Stimulus" guide (#4650)

* docs: add Use daisyUI with Stimulus guide

* docs: reduce Stimulus guide to install steps only

---------

Co-authored-by: Neo Tan <[REDACTED_EMAIL]>

**File**: `packages/docs/src/routes/(routes)/docs/install/stimulus/+page.md` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+---
+title: Use daisyUI with Stimulus
+desc: How to install and use daisyUI with Stimulus
+---
+
+<script>
+  import Translate from "$components/Translate.svelte"
+</script>
+
+> :INFO:
+>
+> Stimulus does not handle CSS, so daisyUI is installed the same way as in any other project.  
+> If you use Rails, follow the [Rails install guide](/docs/install/rails/) instead, because Stimulus already comes with Rails.
+
+### 1. Install
+
+Initialize a new Node project in the current directory using `npm init -y` if it's not a Node project already.
+
+Install Tailwind CSS CLI and daisyUI
+
+```sh:Terminal
+npm install tailwindcss@latest @tailwindcss/cli@latest daisyui@latest
+```
+
+### 2. Add Tailwind CSS and daisyUI
+
+Add Tailwind CSS and daisyUI to your CSS file.
+
+```postcss:app.css
+@import "tailwindcss";
+@plugin "daisyui";
+```
+
+### 3. Build CSS
+
+Add a script to your package.json to build the CSS.
+
+```json:package.json
+{
+  "scripts": {
+    "build:css": "npx @tailwindcss/cli -i app.css -o public/output.css"
+  },
+}
+```
+
+Run the script to build the CSS file
+
+```sh:Terminal
+npm run build:css
+```
+
+This command creates a `public/output.css` file with the compiled CSS. You can link this file to your HTML file.
+
+```html:public/index.html
+<link href="./output.css" rel="stylesheet">
+```
+
+### 4. Add Stimulus
+
+Load Stimulus from a CDN and start the application.
+
+```html:public/index.html
+<script type="module">
+  import { Application } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"
+  window.Stimulus = Application.start()
+</script>
+```
+
+If you use a bundler, install `@hotwired/stimulus` with npm and import it from the package name instead.
+
+Now you can use daisyUI class names!
+
+```html:public/index.html
+<button class="btn btn-primary">Hello daisyUI!</button>
+```
```

---

### Incident Patch 3: `cc43e587` (2026-09-24)
**Commit Message**: fix: adjust tooltip tail position for themes with more radius (#4759)

* fix: hide the tooltip tail shoulders on tooltip-left and tooltip-right when the bubble is a pill

* fix: scale the tooltip tail overlap and the start and end tail offset with the field radius

* fix: keep the side tooltip tails on the straight part of the bubble edge on 0.5rem themes

**File**: `packages/daisyui/src/components/tooltip.css` (modified, +6/-2)
```diff
@@ -3,8 +3,10 @@
     @apply relative inline-block;
     --tt-bg: var(--color-neutral);
     --tt-off: calc(100% + 0.5rem);
-    --tt-tail: calc(100% + 1px + 0.25rem);
-    --tt-tail-off: 0.5rem;
+    --tt-radius: min(var(--radius-field), 0.8rem);
+    --tt-overlap: clamp(1px, calc(var(--radius-field) / 8), 2px);
+    --tt-tail: calc(100% + var(--tt-overlap) + 0.25rem);
+    --tt-tail-off: max(0.5rem, var(--tt-radius));
 
     & > .tooltip-content,
     &[data-tip]:before {
@@ -166,6 +168,7 @@
 
 .tooltip-left {
   @layer daisyui.l1.l2 {
+    --tt-tail-off: clamp(0.5rem, var(--tt-radius) + 3px, 0.8rem - 2px);
     > .tooltip-content,
     &[data-tip]:before {
       transform: translateX(calc(var(--tt-pos, 0.25rem) - 0.25rem))
@@ -186,6 +189,7 @@
 
 .tooltip-right {
   @layer daisyui.l1.l2 {
+    --tt-tail-off: clamp(0.5rem, var(--tt-radius) + 3px, 0.8rem - 2px);
     > .tooltip-content,
     &[data-tip]:before {
       transform: translateX(calc(var(--tt-pos, -0.25rem) + 0.25rem))
```

---

### Incident Patch 4: `cea1c7d5` (2026-09-24)
**Commit Message**: fix: range shadow size and performance (#4771)

--range-fill-x and --range-fill-spread are sized in cqw, but .range declares no
container-type, so those units resolve against the viewport rather than the
track. The thumb's fill shadow is therefore painted at viewport width: 1200px
on a 1200px-wide window, and wider still on a large monitor.

container-type: inline-size scopes them to the input, so the spread is the
track's own width. Rendering is unchanged.

**File**: `packages/daisyui/src/components/range.css` (modified, +4/-0)
```diff
@@ -16,6 +16,10 @@
     );
     --range-fill-y: 0;
     --range-fill-spread: calc(100cqw * var(--range-fill));
+    /* The fill spread below is sized in cqw. Without a query container on the
+       input itself those units resolve against the viewport, so the thumb's
+       fill shadow is painted at viewport width instead of track width. */
+    container-type: inline-size;
     @apply cursor-pointer overflow-hidden bg-transparent align-middle;
     width: clamp(3rem, 20rem, 100%);
     /* --radius-selector-max is a separate variable because ~ calc(min(calc(--var))) ~ gives build error in PostCSS+Nuxt */
```

---

### Incident Patch 5: `b00cb0cd` (2026-09-23)
**Commit Message**: fix: avatar indicator dot RTL position (#4773)

**File**: `packages/daisyui/src/components/avatar.css` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@
       width: 15%;
       height: 15%;
       top: 7%;
-      right: 7%;
+      inset-inline-end: 7%;
     }
   }
 }
@@ -54,7 +54,7 @@
       width: 15%;
       height: 15%;
       top: 7%;
-      right: 7%;
+      inset-inline-end: 7%;
     }
   }
 }
```

---

### Incident Patch 6: `2e34dfe6` (2026-09-21)
**Commit Message**: fix: status size respects theme size variables (#4774)

**File**: `packages/daisyui/src/components/status.css` (modified, +9/-6)
```diff
@@ -1,6 +1,9 @@
 .status {
   @layer daisyui.l1.l2.l3 {
-    @apply bg-base-content/20 rounded-selector inline-block aspect-square size-2 bg-center bg-no-repeat align-middle text-black/30;
+    @apply bg-base-content/20 rounded-selector inline-block aspect-square bg-center bg-no-repeat align-middle text-black/30;
+    --size: calc(var(--size-selector, 0.25rem) * 2);
+    width: var(--size);
+    height: var(--size);
     background-image: radial-gradient(
       circle at 35% 30%,
       oklch(1 0 0 / calc(var(--depth) * 0.5)),
@@ -63,30 +66,30 @@
 
 .status-xs {
   @layer daisyui.l1.l2 {
-    @apply size-0.5;
+    --size: calc(var(--size-selector, 0.25rem) * 0.5);
   }
 }
 
 .status-sm {
   @layer daisyui.l1.l2 {
-    @apply size-1;
+    --size: calc(var(--size-selector, 0.25rem) * 1);
   }
 }
 
 .status-md {
   @layer daisyui.l1.l2 {
-    @apply size-2;
+    --size: calc(var(--size-selector, 0.25rem) * 2);
   }
 }
 
 .status-lg {
   @layer daisyui.l1.l2 {
-    @apply size-3;
+    --size: calc(var(--size-selector, 0.25rem) * 3);
   }
 }
 
 .status-xl {
   @layer daisyui.l1.l2 {
-    @apply size-4;
+    --size: calc(var(--size-selector, 0.25rem) * 4);
   }
 }
```

---

### Incident Patch 7: `a0ca2b87` (2026-09-18)
**Commit Message**: fix: disabled style for input, select, textarea and file-input (#4769)

**File**: `packages/daisyui/src/components/fileinput.css` (modified, +3/-0)
```diff
@@ -60,6 +60,9 @@
       outline-offset: 2px;
       isolation: isolate;
     }
+  }
+
+  @layer daisyui.l1.l2 {
     &:has(> input[disabled]),
     &:is(:disabled, [disabled]) {
       @apply border-base-200 bg-base-200 placeholder-base-content placeholder-base-content/20 cursor-not-allowed;
```

**File**: `packages/daisyui/src/components/input.css` (modified, +2/-0)
```diff
@@ -96,7 +96,9 @@
         }
       }
     }
+  }
 
+  @layer daisyui.l1.l2 {
     &:has(> input[disabled]),
     &:is(:disabled, [disabled]),
     fieldset:disabled & {
```

**File**: `packages/daisyui/src/components/select.css` (modified, +5/-0)
```diff
@@ -79,7 +79,9 @@
         linear-gradient(135deg, #0000 50%, currentColor 50%),
         linear-gradient(45deg, currentColor 50%, #0000 50%);
     }
+  }
 
+  @layer daisyui.l1.l2 {
     &:has(> select[disabled]),
     &:is(:disabled, [disabled]),
     fieldset:disabled & {
@@ -100,6 +102,9 @@
     &:has(> select[disabled]) > select[disabled] {
       @apply cursor-not-allowed;
     }
+  }
+
+  @layer daisyui.l1.l2.l3 {
     &,
     & select {
       @supports (appearance: base-select) {
```

**File**: `packages/daisyui/src/components/textarea.css` (modified, +2/-0)
```diff
@@ -45,7 +45,9 @@
         }
       }
     }
+  }
 
+  @layer daisyui.l1.l2 {
     &:has(> textarea[disabled]),
     &:is(:disabled, [disabled]) {
       @apply border-base-200 bg-base-200 text-base-content/40 cursor-not-allowed;
```

---

### Incident Patch 8: `6fcaa55c` (2026-09-18)
**Commit Message**: fix: #4766 validator colors specificity (#4767)

**File**: `packages/daisyui/src/components/validator.css` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 .validator {
-  @layer daisyui.l1.l2.l3 {
+  @layer daisyui.l1.l2 {
     &:user-valid,
     &:has(:user-valid) {
       &,
```

---

### Incident Patch 9: `276fce3e` (2026-09-17)
**Commit Message**: fix: style aria-checked as btn-active in button (#4761)

**File**: `packages/daisyui/src/components/button.css` (modified, +6/-1)
```diff
@@ -87,6 +87,7 @@
     &:active:not(
         .btn-active,
         [aria-pressed="true"],
+        [aria-checked="true"],
         [aria-current]:not([aria-current="false"], [aria-current=""])
       ) {
       translate: 0 0.5px;
@@ -123,7 +124,11 @@
 }
 
 .btn-active,
-.btn:is([aria-pressed="true"], [aria-current]:not([aria-current="false"], [aria-current=""])) {
+.btn:is(
+  [aria-pressed="true"],
+  [aria-checked="true"],
+  [aria-current]:not([aria-current="false"], [aria-current=""])
+) {
   @layer daisyui.l1.l2 {
     --btn-bg: color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 5%);
     color: var(--btn-fg, var(--color-base-content));
```

---

### Incident Patch 10: `ac979991` (2026-09-17)
**Commit Message**: fix: allow Firefox Android to use diff by tap because Firefox Android ignores CSS resize and cannot drag(#4763)

**File**: `packages/daisyui/src/components/diff.css` (modified, +24/-0)
```diff
@@ -45,6 +45,22 @@
         }
       }
     }
+    @supports (-moz-appearance: none) {
+      @media (hover: none) and (pointer: coarse) {
+        &:focus {
+          .diff-resizer {
+            min-width: 5cqi;
+            max-width: 5cqi;
+          }
+        }
+        &:has(.diff-item-1:focus) {
+          .diff-resizer {
+            min-width: 95cqi;
+            max-width: 95cqi;
+          }
+        }
+      }
+    }
   }
 }
 .diff-resizer {
@@ -84,6 +100,14 @@
         content: var(--tw-content);
       }
     }
+    @supports (-moz-appearance: none) {
+      @media (hover: none) and (pointer: coarse) {
+        &:after {
+          --tw-content: none;
+          content: var(--tw-content);
+        }
+      }
+    }
   }
 }
 .diff-item-1 {
```

---

### Incident Patch 11: `10dc2fb0` (2026-09-14)
**Commit Message**: fix: style aria-current as menu-active in menu (#4752)

* fix: style menu items marked with aria-current like menu-active

* fix: treat every aria-current value except false and empty as active

**File**: `packages/daisyui/src/components/menu.css` (modified, +22/-3)
```diff
@@ -81,18 +81,33 @@
     :where(
       li:not(.menu-title, .disabled) > *:not(ul, menu, details, .menu-title),
       li:not(.menu-title, .disabled) > details > summary:not(.menu-title)
-    ):not(.menu-active, :active, .btn) {
+    ):not(
+      .menu-active,
+      :active,
+      .btn,
+      [aria-current]:not([aria-current="false"], [aria-current=""])
+    ) {
       &.menu-focus,
       &:focus-visible {
         @apply bg-base-content/10 text-base-content cursor-pointer outline-hidden;
       }
     }
     :where(
       li:not(.menu-title, .disabled)
-        > *:not(ul, menu, details, .menu-title):not(.menu-active, :active, .btn):hover,
+        > *:not(ul, menu, details, .menu-title):not(
+          .menu-active,
+          :active,
+          .btn,
+          [aria-current]:not([aria-current="false"], [aria-current=""])
+        ):hover,
       li:not(.menu-title, .disabled)
         > details
-        > summary:not(.menu-title):not(.menu-active, :active, .btn):hover
+        > summary:not(.menu-title):not(
+          .menu-active,
+          :active,
+          .btn,
+          [aria-current]:not([aria-current="false"], [aria-current=""])
+        ):hover
     ) {
       @apply bg-base-content/10 cursor-pointer outline-hidden;
       box-shadow:
@@ -115,6 +130,10 @@
 
       & > *:not(ul, menu, .menu-title, details, .btn):active,
       & > *:not(ul, menu, .menu-title, details, .btn).menu-active,
+      &
+        > *:not(ul, menu, .menu-title, details, .btn):is(
+          [aria-current]:not([aria-current="false"], [aria-current=""])
+        ),
       & > details > summary:active {
         @apply outline-hidden;
         color: var(--menu-active-fg);
```

---

### Incident Patch 12: `8e495a0f` (2026-09-14)
**Commit Message**: fix: style aria-pressed and aria-current as btn-active in button (#4754)

**File**: `packages/daisyui/src/components/button.css` (modified, +7/-2)
```diff
@@ -84,7 +84,11 @@
       }
     }
 
-    &:active:not(.btn-active) {
+    &:active:not(
+        .btn-active,
+        [aria-pressed="true"],
+        [aria-current]:not([aria-current="false"], [aria-current=""])
+      ) {
       translate: 0 0.5px;
       --btn-bg: color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 5%);
       color: var(--btn-fg, var(--color-base-content));
@@ -118,7 +122,8 @@
   }
 }
 
-.btn-active {
+.btn-active,
+.btn:is([aria-pressed="true"], [aria-current]:not([aria-current="false"], [aria-current=""])) {
   @layer daisyui.l1.l2 {
     --btn-bg: color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 5%);
     color: var(--btn-fg, var(--color-base-content));
```

---

### Incident Patch 13: `fe22841a` (2026-09-14)
**Commit Message**: fix: style aria-current as active in `dock` (#4753)

* fix: show the dock active indicator on items marked with aria-current

* fix: treat every aria-current value except false and empty as active

**File**: `packages/daisyui/src/components/dock.css` (modified, +9/-4)
```diff
@@ -35,6 +35,11 @@
       }
     }
   }
+  @layer daisyui.l1.l2 {
+    > [aria-current]:not([aria-current="false"], [aria-current=""]):after {
+      @apply w-10 bg-current text-current;
+    }
+  }
 }
 .dock-active {
   @layer daisyui.l1.l2 {
@@ -48,7 +53,7 @@
     height: 3rem;
     height: calc(3rem + env(safe-area-inset-bottom));
 
-    .dock-active {
+    :is(.dock-active, [aria-current]:not([aria-current="false"], [aria-current=""])) {
       &:after {
         bottom: -0.1rem;
       }
@@ -66,7 +71,7 @@
     height: 3.5rem;
     height: calc(3.5rem + env(safe-area-inset-bottom));
 
-    .dock-active {
+    :is(.dock-active, [aria-current]:not([aria-current="false"], [aria-current=""])) {
       &:after {
         bottom: -0.1rem;
       }
@@ -93,7 +98,7 @@
     height: 4.5rem;
     height: calc(4.5rem + env(safe-area-inset-bottom));
 
-    .dock-active {
+    :is(.dock-active, [aria-current]:not([aria-current="false"], [aria-current=""])) {
       &:after {
         bottom: 0.4rem;
       }
@@ -110,7 +115,7 @@
     height: 5rem;
     height: calc(5rem + env(safe-area-inset-bottom));
 
-    .dock-active {
+    :is(.dock-active, [aria-current]:not([aria-current="false"], [aria-current=""])) {
       &:after {
         bottom: 0.4rem;
       }
```

---

### Incident Patch 14: `02623f06` (2026-09-11)
**Commit Message**: fix: OTP disabled style (#4750)

**File**: `packages/daisyui/src/components/otp.css` (modified, +11/-0)
```diff
@@ -151,6 +151,17 @@
         outline-color: var(--input-color);
       }
     }
+
+    &:has(> input:disabled) {
+      @apply cursor-not-allowed;
+      > input {
+        @apply text-base-content/40;
+      }
+      > span {
+        @apply border-base-200 bg-base-200;
+        box-shadow: none;
+      }
+    }
   }
 }
 
```

---

### Incident Patch 15: `0ca4325d` (2026-09-10)
**Commit Message**: fix: checkbox tick and dash alignment (#4743)

**File**: `packages/daisyui/src/components/checkbox.css` (modified, +2/-1)
```diff
@@ -46,6 +46,7 @@
 
       &:before {
         clip-path: polygon(20% 100%, 20% 80%, 50% 80%, 50% 0%, 70% 0%, 70% 100%);
+        translate: 3.5% -7%;
         @apply opacity-100;
       }
       @media (forced-colors: active) {
@@ -70,7 +71,7 @@
       );
       &:before {
         @apply rotate-0 opacity-100;
-        translate: 0 -35%;
+        translate: 0 -40%;
         clip-path: polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 80% 80%, 80% 100%);
       }
     }
```

#### Recent Merged Pull Requests:
- **PR #4774** (2026-09-21): fix(status): scale with the --size-selector theme variable (@sulimanbenhalim)
- **PR #4773** (2026-09-23): fix(avatar): mirror the online and offline dot in rtl (@sulimanbenhalim)
- **PR #4771** (2026-09-24): fix(range): give the fill a query container so cqw is track-relative (@SurefireStudios)
- **PR #4769** (2026-09-18): fix(input): show the disabled box on ghost input, select, textarea and file-input (@sulimanbenhalim)
- **PR #4767** (2026-09-18): fix(validator): color modifiers like input-primary override the validator colors (@sulimanbenhalim)
- **PR #4764** (2026-09-17): docs: keep english-only blocks left to right on rtl languages (@sulimanbenhalim)
- **PR #4763** (2026-09-17): fix(diff): tap to expand each side on Firefox for Android (@sulimanbenhalim)
- **PR #4761** (2026-09-17): fix(btn): style aria-checked="true" as btn-active (@sulimanbenhalim)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
