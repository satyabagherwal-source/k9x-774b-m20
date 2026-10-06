# Forensic Learning Record (Deep Inspection): bernaferrari/FigmaToCode

> **Canonical Artifact**: `07_PROJECT_LEARNING/bernaferrari-figmatocode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bernaferrari/FigmaToCode](https://github.com/bernaferrari/FigmaToCode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:56:48.905Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bernaferrari/FigmaToCode`
- **Description**: Generate responsive pages and apps on HTML, Tailwind, Flutter and SwiftUI.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5215 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `packages/backend/src/altNodes/altNodeUtils.ts`
```
import { AltNode } from "types";
import { curry } from "../common/curry";
import { exportAsyncProxy } from "../common/exportAsyncProxy";
import { addWarning } from "../common/commonConversionWarnings";

export const overrideReadonlyProperty = curry(
  <T, K extends keyof T>(prop: K, value: any, obj: T): T =>
    Object.defineProperty(obj, prop, {
      value: value,
      writable: true,
      configurable: true,
    }),
);

export const assignParent = overrideReadonlyProperty("parent");
export const assignChildren = overrideReadonlyProperty("children");
export const assignType = overrideReadonlyProperty("type");
export const assignRectangleType = assignType("RECTANGLE");

export function isNotEmpty<TValue>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}

export const isTypeOrGroupOfTypes = curry(
  (matchTypes: NodeType[], node: SceneNode): boolean => {
    // Check if the current node's type is in the matchTypes array
    if (matchTypes.includes(node.type)) return true;

    // Only check children if this is a container type node that can have children
    if ("children" in node) {
      for (let i = 0; i < node.children.length; i++) {
        const childNode = node.children[i];
        const result = isTypeOrGroupOfTypes(matchTypes, childNode);
        if (!result) {
          // If any child is not of the specified types, return false
          return false;
        }
      }
      // All children are valid types
      return node.children.length > 0; // Only return true if there are children
    }

    // Not a container node and not a matching type
    return false;
  },
);

export const isSVGNode = (node: SceneNode) => {
  const altNode = node as AltNode<typeof node>;
  return altNode.canBeFlattened;
};

export const renderAndAttachSVG = async (node: any) => {
  if (node.canBeFlattened) {
    if (node.svg) {
      return node;
    }

    try {
      const svg = (await exportAsyncProxy<string>(node, {
        format: "SVG_STRING",
      })) as string;

      // Process the SVG to replace colors with variable references
      if (node.colorVariableMappings && node.colorVariableMappings.size > 0) {
        let processedSvg = svg;

        // Replace fill="COLOR" or stroke="COLOR" patterns
        const colorAttributeRegex = /(fill|stroke)="([^"]*)"/g;

        processedSvg = processedSvg.replace(
          colorAttributeRegex,
          (match, attribute, colorValue) => {
            // Clean up the color value and normalize it
            const normalizedColor = colorValue.toLowerCase().trim();

            // Look up the color directly in our mappings
            const mapping = node.colorVariableMappings.get(normalizedColor);
            if (mapping) {
              // If we have a variable reference, use it with fallback to original
              return `${attribute}="var(--${mapping.variableName}, ${colorValue})"`;
            }

            // Otherwise keep the original color
            return match;
          },
        );

        // Also handle style attributes with fill: or stroke: properties
        const styleRegex =
          /style="([^"]*)(?:(fill|stroke):\s*([^;"]*))(;|\s|")([^"]*)"/g;

        processedSvg = processedSvg.replace(
          styleRegex,
          (match, prefix, property, colorValue, separator, suffix) => {
            // Clean up any extra spaces from the color value
            const normalizedColor = colorValue.toLowerCase().trim();

            // Look up the color directly in our mappings
            const mapping = node.colorVariableMappings.get(normalizedColor);
            if (mapping) {
              // Replace just the color value with the variable and fallback
              return `style="${prefix}${property}: var(--${mapping.variableName}, ${colorValue})${separator}${suffix}"`;
            }

            return match;
          },
        );

        node.svg = processedSvg;
      } else {
        node.svg = svg;
      }
    } catch (error) {
      addWarning(`Failed rendering SVG for ${node.name}`);
      console.error(`Error rendering SVG for ${node.type}:${node.id}`);
      console.error(error);
    }
  }
  return node;
};

```

### Core Architecture Module: `packages/plugin-ui/src/components/EmptyState.tsx`
```
import React from "react";

const EmptyState = () => {
  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-12 text-center">
      {/* Illustration: a Figma-style selection box turning into code */}
      <div className="mb-4 text-neutral-700 dark:text-neutral-200">
        <svg
          width="184"
          height="120"
          viewBox="0 0 148 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
          aria-hidden="true"
        >
          {/* Layer rectangle with selection handles */}
          <rect
            x="8"
            y="16"
            width="52"
            height="64"
            rx="4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="text-green-400"
          />
          {/* Selection handles */}
          <rect
            x="5"
            y="13"
            width="6"
            height="6"
            rx="1"
            className="fill-green-400"
          />
          <rect
            x="5"
            y="77"
            width="6"
            height="6"
            rx="1"
            className="fill-green-400"
          />
          <rect
            x="57"
            y="13"
            width="6"
            height="6"
            rx="1"
            className="fill-green-400"
          />
          <rect
            x="57"
            y="77"
            width="6"
            height="6"
            rx="1"
            className="fill-green-400"
          />

          {/* Inner content lines (representing layer content) */}
          <rect
            x="18"
            y="30"
            width="32"
            height="3"
            rx="1.5"
            className="fill-neutral-500 dark:fill-neutral-400"
          />
          <rect
            x="18"
            y="39"
            width="24"
            height="3"
            rx="1.5"
            className="fill-neutral-400 dark:fill-neutral-500"
          />
          <rect
            x="18"
            y="54"
            width="28"
            height="3"
            rx="1.5"
            className="fill-neutral-500 dark:fill-neutral-400"
          />
          <rect
            x="18"
            y="63"
            width="18"
            height="3"
            rx="1.5"
            className="fill-neutral-400 dark:fill-neutral-500"
          />

          {/* Arrow */}
          <path
            d="M72 48 L84 48"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-neutral-500 dark:text-neutral-400"
          />
          <path
            d="M81 44 L85 48 L81 52"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-500 dark:text-neutral-400"
          />

          {/* Code block */}
          <rect
            x="92"
            y="20"
            width="52"
            height="56"
            rx="4"
            className="fill-neutral-900 stroke-neutral-700 dark:fill-neutral-800 dark:stroke-neutral-600"
            strokeWidth="1"
          />
          {/* Code lines */}
          <rect
            x="100"
            y="32"
            width="20"
            height="2.5"
            rx="1.25"
            className="fill-green-400/80"
          />
          <rect
            x="104"
            y="40"
            width="28"
            height="2.5"
            rx="1.25"
            className="fill-neutral-500 dark:fill-neutral-400"
          />
          <rect
            x="104"
            y="48"
            width="22"
            height="2.5"
            rx="1.25"
            className="fill-neutral-500 dark:fill-neutral-400"
          />
          <rect
            x="104"
            y="56"
            width="16"
            height="2.5"
            rx="1.25"
            className="fill-neutral-600 dark:fill-neutral-500"
          />
          <rect
            x="100"
            y="64"
            width="12"
            height="2.5"
            rx="1.25"
            className="fill-green-400/80"
          />
        </svg>
      </div>

      {/* Copy */}
      <h3 className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200">
        Nothing selected
      </h3>
      <p className="mt-2 max-w-[280px] text-sm leading-5 text-neutral-600 dark:text-neutral-400">
        Select a layer to get started
      </p>
    </div>
  );
};

export default EmptyState;

```

### Core Architecture Module: `packages/plugin-ui/src/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const createCanvasImageUrl = (width: number, height: number): string => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return `https://placehold.co/${width}x${height}`;
  }

  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, width, height);

  const fontSize = Math.max(12, Math.floor(width * 0.15));
  ctx.font = `bold ${fontSize}px Inter, Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#888888";

  const text = `${width} x ${height}`;
  const textWidth = ctx.measureText(text).width;
  const x = (width - textWidth) / 2;
  const y = (height + fontSize) / 2;

  ctx.fillText(text, x, y);

  return canvas.toDataURL();
};

export function replaceExternalImagesWithCanvas(html: string): string {
  return html.replace(
    /https:\/\/placehold\.co\/(\d+)x(\d+)/g,
    (_match, width, height) => {
      return createCanvasImageUrl(parseInt(width), parseInt(height));
    },
  );
}

```

### Core Architecture Module: `.eslintrc.js`
```
const config = {
  extends: ["kentcdodds"],
  rules: {
    "valid-jsdoc": "off",
    "max-len": "off",
    "no-negated-condition": "off",
    complexity: "off",
    "default-case": "off",
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "space-before-function-paren": [
      "error",
      {
        anonymous: "never",
        named: "never",
        asyncArrow: "always",
      },
    ],
    "import/no-import-module-exports": "off",
  },
};

module.exports = config;

```

### Core Architecture Module: `apps/plugin/plugin-src/code.ts`
```
import { tailwindCodeGenTextStyles } from "./../../../packages/backend/src/tailwind/tailwindMain";
import {
  run,
  flutterMain,
  tailwindMain,
  swiftuiMain,
  htmlMain,
  extractProjectImageNodeIds,
  generateProjectZip,
  postSettingsChanged,
  replaceProjectImagePlaceholders,
} from "backend";
import { nodesToJSON } from "backend/src/altNodes/jsonNodeConversion";
import { oldConvertNodesToAltNodes } from "backend/src/altNodes/oldAltConversion";
import { exportNodeAsPNG } from "backend/src/common/images";
import { retrieveGenericSolidUIColors } from "backend/src/common/retrieveUI/retrieveColors";
import { flutterCodeGenTextStyles } from "backend/src/flutter/flutterMain";
import { htmlCodeGenTextStyles } from "backend/src/html/htmlMain";
import { swiftUICodeGenTextStyles } from "backend/src/swiftui/swiftuiMain";
import {
  DownloadProjectFormat,
  PluginSettings,
  SettingWillChangeMessage,
} from "types";

let userPluginSettings: PluginSettings;

export const defaultPluginSettings: PluginSettings = {
  framework: "HTML",
  showLayerNames: false,
  useOldPluginVersion2025: false,
  responsiveRoot: false,
  flutterGenerationMode: "snippet",
  swiftUIGenerationMode: "snippet",
  composeGenerationMode: "snippet",
  roundTailwindValues: true,
  roundTailwindColors: true,
  useColorVariables: true,
  customTailwindPrefix: "",
  embedImages: false,
  embedVectors: false,
  htmlGenerationMode: "html",
  tailwindGenerationMode: "jsx",
  baseFontSize: 16,
  useTailwind4: true,
  thresholdPercent: 15,
  baseFontFamily: "",
  fontFamilyCustomConfig: {},
};

// A helper type guard to ensure the key belongs to the PluginSettings type
function isKeyOfPluginSettings(key: string): key is keyof PluginSettings {
  return key in defaultPluginSettings;
}

const getUserSettings = async () => {
  console.log("[DEBUG] getUserSettings - Starting to fetch user settings");
  const possiblePluginSrcSettings =
    (await figma.clientStorage.getAsync("userPluginSettings")) ?? {};
  console.log(
    "[DEBUG] getUserSettings - Raw settings from storage:",
    possiblePluginSrcSettings,
  );

  const updatedPluginSrcSettings = {
    ...defaultPluginSettings,
    ...Object.keys(defaultPluginSettings).reduce((validSettings, key) => {
      if (
        isKeyOfPluginSettings(key) &&
        key in possiblePluginSrcSettings &&
        typeof possiblePluginSrcSettings[key] ===
          typeof defaultPluginSettings[key]
      ) {
        validSettings[key] = possiblePluginSrcSettings[key] as any;
      }
      return validSettings;
    }, {} as Partial<PluginSettings>),
  };

  userPluginSettings = updatedPluginSrcSettings as PluginSettings;
  console.log("[DEBUG] getUserSettings - Final settings:", userPluginSettings);
  return userPluginSettings;
};

const initSettings = async () => {
  console.log("[DEBUG] initSettings - Initializing plugin settings");
  await getUserSettings();
  postSettingsChanged(userPluginSettings);
  console.log("[DEBUG] initSettings - Calling safeRun with settings");
  safeRun(userPluginSettings);
};

// Used to prevent running from happening again.
let isLoading = false;
let isDownloadingProject = false;
let rerunAfterDownload = false;
const safeRun = async (settings: PluginSettings) => {
  console.log(
    "[DEBUG] safeRun - Called with isLoading =",
    isLoading,
    "selectionCount =",
    figma.currentPage.selection.length,
  );
  if (isDownloadingProject) {
    rerunAfterDownload = true;
    return;
  }

  if (isLoading === false) {
    try {
      isLoading = true;
      console.log("[DEBUG] safeRun - Starting run execution");
      await run(settings);
      console.log("[DEBUG] safeRun - Run execution completed");
      // hack to make it not immediately set to false when complete. (executes on next frame)
      setTimeout(() => {
        console.log("[DEBUG] safeRun - Resetting isLoading to false");
        isLoading = false;
      }, 1);
    } catch (e) {
      console.log("[DEBUG] safeRun - Error caught in execution");
      isLoading = false; // Make sure to reset the flag on error
      if (e && typeof e === "object" && "message" in e) {
        const error = e as Error;
        console.log("error: ", error.stack);
        figma.ui.postMessage({ type: "error", error: error.message });
      } else {
        // Handle non-standard errors or unknown error types
        const errorMessage = String(e);
        console.log("Unknown error: ", errorMessage);
        figma.ui.postMessage({
          type: "error",
          error: errorMessage || "Unknown error occurred",
        });
      }

      // Send a message to reset the UI state
      figma.ui.postMessage({ type: "conversion-complete", success: false });
    }
  } else {
    console.log(
      "[DEBUG] safeRun - Skipping execution because isLoading =",
      isLoading,
    );
  }
};

type ExportedProjectImage = {
  name: string;
  bytes: Uint8Array;
  nodeId: string;
};

const allowedFormatsByFramework: Record<
  "Flutter" | "HTML" | "SwiftUI" | "Tailwind",
  DownloadProjectFormat[]
> = {
  Flutter: ["flutter"],
  HTML: ["html", "nextjs", "vite"],
  SwiftUI: ["swiftui"],
  Tailwind: ["html", "nextjs", "vite"],
};

const toKebab = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getRootSelectionName = (selection: readonly SceneNode[]) => {
  if (selection.length === 0) {
    return "figma-export";
  }

  if (selection.length === 1) {
    return toKebab(selection[0].name) || "figma-export";
  }

  return (
    toKebab(selection[0].parent?.name ?? "figma-selection") || "figma-selection"
  );
};

const createImageName = (nodeId: string, nodeName: string) => {
  const cleanName = toKebab(nodeName);
  const suffix = nodeId.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "");
  return `${cleanName || "image"}-${suffix}.png`;
};

const isImageNode = (node: SceneNode): boolean => {
  if ("fills" in node) {
    const fills = node.fills;
    if (fills && fills !== figma.mixed && Array.isArray(fills)) {
      return fills.some((fill) => fill.type === "IMAGE");
    }
  }

  return false;
};

const exportProjectImages = async (
  selection: readonly SceneNode[],
  requiredNodeIds: ReadonlySet<string>,
): Promise<ExportedProjectImage[]> => {
  const images: ExportedProjectImage[] = [];
  const missingNodeIds = new Set(requiredNodeIds);

  const visit = async (node: SceneNode) => {
    if (node.visible === false) {
      return;
    }

    if (missingNodeIds.has(node.id)) {
      if (!isImageNode(node) || !("exportAsync" in node)) {
        throw new Error(
          `Node ${node.name || node.id} cannot be exported as an image.`,
        );
      }

      const hasChildren = "children" in node && node.children.length > 0;
      const bytes = await exportNodeAsPNG(node, hasChildren);
      images.push({
        bytes,
        name: createImageName(node.id, node.name),
        nodeId: node.id,
      });
      missingNodeIds.delete(node.id);
    }

    if ("children" in node) {
      for (const child of node.children) {
        await visit(child);
      }
    }
  };

  for (const node of selection) {
    await visit(node);
  }

  if (missingNodeIds.size > 0) {
    throw new Error(
      `Could not find ${missingNodeIds.size} image layer${
        missingNodeIds.size === 1 ? "" : "s"
      } in the selected content.`,
    );
  }

  return images;
};

const getConvertedSelectionForDownload = async (
  nodes: readonly SceneNode[],
  pluginSettings: PluginSettings,
): Promise<SceneNode[]> => {
  if (nodes.length === 0) {
    return [];
  }

  const convertedSelection = pluginSettings.useOldPluginVersion2025
    ? oldConvertNodesToAltNodes(nodes, null)
    : await nodesToJSON(nodes, pluginSettings);
  return convertedSelection as unknown as SceneNode[];
};

const generateDownloadCode = async (
  nodes: readonly SceneNode[],
  format: DownloadProjectFormat,
  pluginSettings: PluginSettings,
) => {
  const convertedSelection = await getConvertedSelectionForDownload(
    nodes,
    pluginSettings,
  );

  if (convertedSelection.length === 0) {
    return "<div>No content to export</div>";
  }

  const settings = {
    ...pluginSettings,
    embedImages: false,
    imagePlaceholderMode: "asset" as const,
  };
  const isReactProject = format === "nextjs" || format === "vite";

  if (pluginSettings.framework === "Flutter") {
    return flutterMain(convertedSelection, {
      ...settings,
      flutterGenerationMode: "fullApp",
    });
  }

  if (pluginSettings.framework === "SwiftUI") {
    return swiftuiMain(convertedSelection, {
      ...settings,
      swiftUIGenerationMode: "preview",
    });
  }

  if (pluginSettings.framework === "Tailwind") {
    const result = await tailwindMain(convertedSelection, {
      ...settings,
      tailwindGenerationMode: isReactProject ? "jsx" : "html",
    });
    return result || "<div>Failed to generate Tailwind</div>";
  }

  const result = await htmlMain(
    convertedSelection,
    {
      ...settings,
      htmlGenerationMode: isReactProject ? "jsx" : "html",
    },
    true,
  );
  return result?.html || "<div>Failed to generate HTML</div>";
};

const downloadProject = async (format: DownloadProjectFormat) => {
  if (!["flutter", "html", "nextjs", "swiftui", "vite"].includes(format)) {
    throw new Error(`Invalid download format: ${format}.`);
  }

  const pluginSettings = { ...userPluginSettings };
  if (
    pluginSettings.framework === "Compose" ||
    !allowedFormatsByFramework[pluginSettings.framework].includes(format)
  ) {
    throw new Error(
      `${format} export is not available for ${pluginSettings.framework}.`,
    );
  }

  const selection = [...figma.currentPage.selection];
  if (selection.length === 0) {
    throw new Error("Please select at least one layer to export.");
  }

  const rawCode = await generateDownloadCode(selection, format, pluginSettings);
  const requiredImageNodeIds = extractProjectImageNodeIds(rawCode);
  const images = await export
```

### Core Architecture Module: `apps/plugin/postcss.config.mjs`
```
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

```

### Core Architecture Module: `apps/plugin/ui-src/App.tsx`
```
import { useEffect, useState } from "react";
import { PluginUI } from "plugin-ui";
import {
  Framework,
  PluginSettings,
  ConversionMessage,
  Message,
  HTMLPreview,
  LinearGradientConversion,
  SolidColorConversion,
  ErrorMessage,
  SettingsChangedMessage,
  Warning,
  DownloadProjectFormat,
  ProjectDownloadErrorMessage,
  ProjectZipMessage,
} from "types";
import { postUISettingsChangingMessage } from "./messaging";
import copy from "copy-to-clipboard";

interface AppState {
  code: string;
  selectedFramework: Framework;
  isLoading: boolean;
  htmlPreview: HTMLPreview;
  settings: PluginSettings | null;
  colors: SolidColorConversion[];
  gradients: LinearGradientConversion[];
  warnings: Warning[];
  isDownloadingProject: boolean;
  projectDownloadError: string | null;
}

const emptyPreview = { size: { width: 0, height: 0 }, content: "" };
const isDarkFigmaBackground = (background: string) => {
  const value = background.trim().toLowerCase();

  return Boolean(
    value &&
    value !== "#fff" &&
    value !== "#ffffff" &&
    value !== "rgb(255, 255, 255)" &&
    value !== "rgba(255, 255, 255, 1)",
  );
};

export default function App() {
  const [state, setState] = useState<AppState>({
    code: "",
    selectedFramework: "HTML",
    isLoading: true,
    htmlPreview: emptyPreview,
    settings: null,
    colors: [],
    gradients: [],
    warnings: [],
    isDownloadingProject: false,
    projectDownloadError: null,
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const figmaColorBgValue = rootStyles
    .getPropertyValue("--figma-color-bg")
    .trim();

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const untypedMessage = event.data.pluginMessage as Message;
      console.log("[ui] message received:", untypedMessage);

      switch (untypedMessage.type) {
        case "conversionStart":
          setState((prevState) => ({
            ...prevState,
            code: "",
            isLoading: true,
          }));
          break;

        case "code":
          const conversionMessage = untypedMessage as ConversionMessage;
          setState((prevState) => ({
            ...prevState,
            ...conversionMessage,
            selectedFramework: conversionMessage.settings.framework,
            isLoading: false,
          }));
          break;

        case "pluginSettingsChanged":
          const settingsMessage = untypedMessage as SettingsChangedMessage;
          setState((prevState) => ({
            ...prevState,
            settings: settingsMessage.settings,
            selectedFramework: settingsMessage.settings.framework,
          }));
          break;

        case "empty":
          // const emptyMessage = untypedMessage as EmptyMessage;
          setState((prevState) => ({
            ...prevState,
            code: "",
            htmlPreview: emptyPreview,
            warnings: [],
            colors: [],
            gradients: [],
            isLoading: false,
          }));
          break;

        case "error":
          const errorMessage = untypedMessage as ErrorMessage;

          setState((prevState) => ({
            ...prevState,
            colors: [],
            gradients: [],
            code: `Error :(\n// ${errorMessage.error}`,
            isLoading: false,
          }));
          break;

        case "selection-json":
          const json = event.data.pluginMessage.data;
          copy(JSON.stringify(json, null, 2));
          break;

        case "project-zip": {
          const zipMessage = untypedMessage as ProjectZipMessage;
          const blob = new Blob([zipMessage.zip], {
            type: "application/zip",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = zipMessage.fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setState((prevState) => ({
            ...prevState,
            isDownloadingProject: false,
            projectDownloadError: null,
          }));
          break;
        }

        case "project-download-error": {
          const downloadError = untypedMessage as ProjectDownloadErrorMessage;
          setState((prevState) => ({
            ...prevState,
            isDownloadingProject: false,
            projectDownloadError: downloadError.error,
          }));
          break;
        }

        default:
          break;
      }
    };

    return () => {
      window.onmessage = null;
    };
  }, []);

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
  }, []);

  const handleFrameworkChange = (updatedFramework: Framework) => {
    if (updatedFramework !== state.selectedFramework) {
      setState((prevState) => ({
        ...prevState,
        // code: "// Loading...",
        selectedFramework: updatedFramework,
      }));
      postUISettingsChangingMessage("framework", updatedFramework, {
        targetOrigin: "*",
      });
    }
  };
  const handlePreferencesChange = (
    key: keyof PluginSettings,
    value: PluginSettings[keyof PluginSettings],
  ) => {
    if (state.settings && state.settings[key] === value) {
      // do nothing
    } else {
      postUISettingsChangingMessage(key, value, { targetOrigin: "*" });
    }
  };
  const handleDownloadProject = (format: DownloadProjectFormat) => {
    if (state.isDownloadingProject) {
      return;
    }

    setState((prevState) => ({
      ...prevState,
      isDownloadingProject: true,
      projectDownloadError: null,
    }));
    parent.postMessage(
      { pluginMessage: { type: "download-project", format } },
      "*",
    );
  };

  const darkMode = isDarkFigmaBackground(figmaColorBgValue);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);

    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [darkMode]);

  return (
    <div
      className={`${darkMode ? "dark" : ""} h-full bg-background text-foreground`}
    >
      <PluginUI
        isLoading={state.isLoading}
        code={state.code}
        warnings={state.warnings}
        selectedFramework={state.selectedFramework}
        setSelectedFramework={handleFrameworkChange}
        onPreferenceChanged={handlePreferencesChange}
        htmlPreview={state.htmlPreview}
        settings={state.settings}
        colors={state.colors}
        gradients={state.gradients}
        onDownloadProject={handleDownloadProject}
        isDownloadingProject={state.isDownloadingProject}
        projectDownloadError={state.projectDownloadError}
      />
    </div>
  );
}

```

### Core Architecture Module: `apps/plugin/ui-src/main.tsx`
```
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

```

### Core Architecture Module: `apps/plugin/ui-src/messaging.ts`
```
import { Message, SettingWillChangeMessage, UIMessage } from "types";

if (!parent || !parent.postMessage) {
  throw new Error("parent.postMessage() is not defined");
}
const postMessage = (message: UIMessage, options?: WindowPostMessageOptions) =>
  parent.postMessage(message, options);

export const postUIMessage = (
  message: Message,
  options?: WindowPostMessageOptions,
) => postMessage({ pluginMessage: message }, options);

export const postUISettingsChangingMessage = <T>(
  key: string,
  value: T,
  options?: WindowPostMessageOptions,
) => {
  const message: SettingWillChangeMessage<T> = {
    type: "pluginSettingWillChange",
    key,
    value,
  };
  postUIMessage(message, options);
};

```

### Core Architecture Module: `apps/plugin/vite-env.d.ts`
```
/// <reference types="vite/client" />

```

### Core Architecture Module: `apps/plugin/vite.config.ts`
```
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  root: "./ui-src",
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2017",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    outDir: "../dist",
    rollupOptions: {
      output: {},
    },
  },
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #253** (2026-05-13): **[bug]: `Slot` node not supported**
  *Symptoms*: ### Steps to Reproduce  Hi, I'm a big fan of this plugin and I use it almost every day! However, with the release of the Slot node, which our designer has started using heavily, it's been hard to use it as seamlessly as before. Are there plans (or even methods) to support the Slot node in the future?  <img width="453" height="746" alt="Image" src="https://github.com/user-attachments/assets/aa2b680a-f672-4ba0-8ace-ff297880e855" />  ### Expected Behavior  _No response_  ### Actual Behavior  _No response_  ### Design Reference  _No response_  ### Screenshots or Videos  _No response_
  **Post-Mortem & Fix Analysis**:
  > Oh sure, absolutely. Thanks for raising it. I didn't know what slot mode is, I'll search and support it!
  > Sorry for the long time (I forgot). It should be ready now. Tell me if it works as you want!
  > Thank you so much, it seems to work great!

- **Issue #240** (2025-12-29): **[bug]: 28px and 32px have both been converted to "text-3xl" . The color is incorrect.**
  *Symptoms*: ### Steps to Reproduce  <img width="466" height="246" alt="Image" src="https://github.com/user-attachments/assets/05d6ba5b-c787-4219-9d8c-b55972143b41" />  <img width="476" height="453" alt="Image" src="https://github.com/user-attachments/assets/acbab3f9-713b-4cde-9211-7c09a1846885" />    ### Expected Behavior  text-[28px]  color-[#1447e6]  ### Actual Behavior  font-size 28px converted to "text-3xl" .   color is #3173BB but get text-blue-700(#1447e6)  ### Design Reference  _No response_  ### Screenshots or Videos  _No response_
  **Post-Mortem & Fix Analysis**:
  > Not a bug. By default the plugin rounds to the nearest pixel value to generate out-of-the-box Tailwind utility classes. In the styling options, if you turn off "Round Values" or change your rounding threshold to 0%, the text size will convert to what you expect. Same is true for colors—turn off color rounding to get what you expect  <img width="424" height="181" alt="Image" src="https://github.com/user-attachments/assets/a21b71c0-4dce-4ed7-929e-5110eee97474" />  <img width="424" height="181" alt="Image" src="https://github.com/user-attachments/assets/e0fb67d9-c4b7-4024-9ef5-8a7b5996699a" />
  > Thanks. If it still happens, feel free to say, I'll re-open.

- **Issue #232** (2026-02-04): **[bug]: Tailwind output is adding /${opacity} even if color variable already contains alpha**
  *Symptoms*: ### Steps to Reproduce  1. Have a color variable that already contains some alpha value 2. Generate output using Tailwind 3. The output will be like `bg-myVar/50`, although `/50` should be omitted as the var already contains this opacity val.  ### Expected Behavior  _No response_  ### Actual Behavior  _No response_  ### Design Reference  _No response_  ### Screenshots or Videos  _No response_

- **Issue #228** (2025-09-02): **[bug]: Wrong line height in Tailwind (JSX)**
  *Symptoms*: ### Steps to Reproduce  For a fontSize of 24px and 32px of lineHeight, this plugin outputs `leading-loose` (=`2`). This is wrong.  The right value should be `2rem` or `leading-8`.  This leads to so many wrong outputs in my usage.  See Claude's explanation:  ``` ⏺ No, leading-8 and leading-loose are not    equivalent:    - leading-8 sets line-height: 2rem   (32px)   - leading-loose sets line-height: 2   (200% of font size)    For a text-2xl (24px font),   leading-loose would be 48px line   height, while leading-8 is 32px. Since   both are applied, the last one in the   CSS cascade will win (likely   leading-loose). ```  ### Expected Behavior  _No response_  ### Actual Behavior  _No response_  ### Design Reference  _No response_  ### Screenshots or Videos  _No response_

- **Issue #214** (2025-03-31): **Error: JSON and Figma nodes have different child counts**
  *Symptoms*: FigmaToCode is an awesome plugin. It has not any problem until some days ago.  ### Steps to Reproduce  1. Open the plugin 2. Select the figma layer 3. Observe the error  ### Expected Behavior  The code should be generated successfully  ### Actual Behavior  An error message appears: "Error: JSON and Figma nodes have different child counts. Please report this issue."  ### Design Reference  _No response_  ### Screenshots or Videos  - Figma layer: <img width="590" alt="Image" src="https://github.com/user-attachments/assets/84bdd261-926e-46b9-b58d-a0aa0b6c5b69" />  - Preview: <img width="317" alt="Image" src="https://github.com/user-attachments/assets/011ab04e-e67e-4f5e-b03f-b546079e03cb" />  - Generated code: <img width="303" alt="Image" src="https://github.com/user-attachments/assets/179631fc-ea41-4aff-9981-51bc97e350c1" />  ``` <div data-state="Default" data-value-Type="Placeholder" className="self-stretch inline-flex flex-col justify-start items-start gap-2">   <div></div>   <div className="self-stretch min-w-60 px-4 py-3 bg-white rounded-lg outline outline-1 outline-offset-[-0.50px] outline-[#d9d9d9] inline-flex justify-start items-center overflow-hidden">     <div></div>   </div> </div> ```  <details> <summary>Figma json</summary> <br> ``` {   "json": [     {       "id": "1868:6263",       "name": "Input Field",       "type": "INSTANCE",       "scrollBehavior": "SCROLLS",       "boundVariables": {         "itemSpacing": {           "type": "VARIABLE_ALIAS",           "id": "
  **Post-Mortem & Fix Analysis**:
  > Could you perhaps share the figma link or figma file? It will be easier for me to solve since for the mismatch I need the two apis.  If this is bad for you, there is a setting in the plugin that allows to return to the old version. 
  > > Could you perhaps share the figma link or figma file? It will be easier for me to solve since for the mismatch I need the two apis.  Sorry I can not share the figma link or file, but I pasted the figma output json in the description.  > If this is bad for you, there is a setting in the plugin that allows to return to the old version.  returning to the old version works, thank you.  
  > It is very very very hard to help because the issue is like: - Figma API gives something - JSON API gives something else  You provided one of them, but without the other I can't compare and see what is happening.  Perhaps you could reproduce this in a small component (say a simple icon or a card) and then could copy to a different file?  I know this issue exists, and you are the third person to report, but I can't debug without checking it for real. I know it is frustrating for you, it is frustrating for me too, because I don't know what is happening.

- **Issue #209** (2025-03-18): **[HTML]: Style confusion in local plugin import test**
  *Symptoms*: ### Settings / Steps to Reproduce  HTML REACT  Style confusion in local plugin import test  <img width="459" alt="Image" src="https://github.com/user-attachments/assets/b1c0cb7a-ae04-47cb-b2b9-50b597c8293f" />  ### Expected Behavior  What did you expect to happen?    <img width="633" alt="Image" src="https://github.com/user-attachments/assets/f79e0e2c-68bf-4e2e-bb87-3e0aea362781" />   ### Actual Behavior  <img width="436" alt="Image" src="https://github.com/user-attachments/assets/0b50b2d7-efd1-44ad-801d-028ac94b0cf4" />  ### Design Reference  _No response_  ### Screenshots or Videos  _No response_  ### Environment  OS: Mac 15.3.1 Node: 18.19.1 Browser: Chrome 134
  **Post-Mortem & Fix Analysis**:
  > Somehow you are using a version of the plugin that shouldn't exist anymore --- you should try the refactor branch, I'll merge soon! Could you share the layout so I can debug for you?
  > > Somehow you are using a version of the plugin that shouldn't exist anymore --- you should try the refactor branch, I'll merge soon! Could you share the layout so I can debug for you?  After switching to the refactor branch and debugging, the styling performance seems to be normal now. Thank you. 
  > That's amazing. Thanks! If you have any issues, feel free to reach, there is a lot in development!

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

### Incident Patch 1: `6d59f405` (2026-08-04)
**Commit Message**: fix(vercel): drop engines.pnpm; declare pnpm only via devEngines

Vercel auto-selects pnpm 9 for older projects and fails when
engines.pnpm requires >=11. Keep devEngines pnpm ^11.0.0 only,
set engines.node to 24.x, omit packageManager and installCommand.

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ jobs:
       - uses: pnpm/action-setup@v6
       - uses: actions/setup-node@v6
         with:
-          node-version: ">=24"
+          node-version: 24
           cache: pnpm
       - run: pnpm install --frozen-lockfile
       - run: pnpm build
```

**File**: `.node-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v22.12.0
+24
```

**File**: `package.json` (modified, +1/-2)
```diff
@@ -18,8 +18,7 @@
     "typescript": "^7.0.2"
   },
   "engines": {
-    "node": ">=24",
-    "pnpm": ">=11"
+    "node": "24.x"
   },
   "devEngines": {
     "packageManager": {
```

---

### Incident Patch 2: `329bd544` (2026-08-04)
**Commit Message**: fix: include web app in Vercel builds

**File**: `.vercelignore` (modified, +1/-1)
```diff
@@ -8,6 +8,6 @@
 **/.turbo
 **/node_modules
 coverage
-web
+/web/
 apps/plugin/dist
 dist
```

**File**: `package.json` (modified, +0/-7)
```diff
@@ -18,13 +18,6 @@
     "turbo": "^2.10.8",
     "typescript": "npm:@typescript/typescript6@^6.0.2"
   },
-  "devEngines": {
-    "packageManager": {
-      "name": "pnpm",
-      "version": "^11",
-      "onFail": "ignore"
-    }
-  },
   "engines": {
     "node": ">=24",
     "pnpm": "^11"
```

---

### Incident Patch 3: `76388e45` (2026-08-04)
**Commit Message**: fix: pin pnpm for Vercel builds

**File**: `package.json` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 {
   "name": "figma-to-code",
   "private": true,
+  "packageManager": "pnpm@11.20.0",
   "scripts": {
     "build": "turbo run build",
     "build:watch": "turbo run build:watch",
```

---

### Incident Patch 4: `3b3b6940` (2026-05-13)
**Commit Message**: Fix plugin theme contrast

**File**: `apps/debug/next-env.d.ts` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /// <reference types="next" />
 /// <reference types="next/image-types/global" />
-import "./.next/types/routes.d.ts";
+import "./.next/dev/types/routes.d.ts";
 
 // NOTE: This file should not be edited
 // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

**File**: `apps/plugin/ui-src/App.tsx` (modified, +15/-2)
```diff
@@ -27,6 +27,17 @@ interface AppState {
 }
 
 const emptyPreview = { size: { width: 0, height: 0 }, content: "" };
+const isDarkFigmaBackground = (background: string) => {
+  const value = background.trim().toLowerCase();
+
+  return Boolean(
+    value &&
+    value !== "#fff" &&
+    value !== "#ffffff" &&
+    value !== "rgb(255, 255, 255)" &&
+    value !== "rgba(255, 255, 255, 1)",
+  );
+};
 
 export default function App() {
   const [state, setState] = useState<AppState>({
@@ -144,10 +155,12 @@ export default function App() {
     }
   };
 
-  const darkMode = figmaColorBgValue !== "#ffffff";
+  const darkMode = isDarkFigmaBackground(figmaColorBgValue);
 
   return (
-    <div className={`${darkMode ? "dark" : ""}`}>
+    <div
+      className={`${darkMode ? "dark" : ""} h-full bg-background text-foreground`}
+    >
       <PluginUI
         isLoading={state.isLoading}
         code={state.code}
```

**File**: `apps/plugin/ui-src/index.css` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ body {
   --primary-foreground: oklch(1 0 0);
   --secondary: oklch(0.93 0.01 266.23);
   --secondary-foreground: oklch(0.14 0.01 266.4);
-  --muted: oklch(0.97 0.0 266.23);
+  --muted: oklch(0.97 0 266.23);
   --muted-foreground: oklch(0.5 0.01 266.33);
   --accent: oklch(0.93 0.01 266.23);
   --accent-foreground: oklch(0.14 0.01 266.4);
@@ -45,7 +45,7 @@ body {
 }
 
 .dark {
-  --background: oklch(0.12 0.04 266.7);
+  --background: #2c2c2c;
   --foreground: oklch(0.97 0 0);
   --card: oklch(0.237 0 0);
   --card-foreground: oklch(0.97 0 0);
```

**File**: `packages/plugin-ui/src/PluginUI.tsx` (modified, +20/-16)
```diff
@@ -125,9 +125,9 @@ export const PluginUI = (props: PluginUIProps) => {
 
   return (
     <TooltipProvider>
-      <div className="flex flex-col h-full overflow-hidden dark:text-white">
-        <div className="p-2 dark:bg-card">
-          <div className="flex gap-1 bg-muted dark:bg-card rounded-lg p-1">
+      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
+        <div className="px-2 py-1.5 dark:bg-card">
+          <div className="flex gap-1 bg-muted dark:bg-card rounded-lg p-0.5">
             <FrameworkTabs
               frameworks={frameworks}
               selectedFramework={props.selectedFramework}
@@ -170,7 +170,7 @@ export const PluginUI = (props: PluginUIProps) => {
               <EmptyState />
             </div>
           ) : (
-            <div className="flex flex-col items-center px-4 py-2 gap-2 dark:bg-transparent">
+            <div className="flex flex-col items-center px-4 pt-3 pb-2 gap-2 dark:bg-transparent">
               {props.htmlPreview && (
                 <Preview
                   htmlPreview={props.htmlPreview}
@@ -195,21 +195,25 @@ export const PluginUI = (props: PluginUIProps) => {
               />
 
               {props.colors.length > 0 && (
-                <ColorsPanel
-                  colors={props.colors}
-                  onColorClick={(value) => {
-                    copy(value);
-                  }}
-                />
+                <div className="mt-3 w-full">
+                  <ColorsPanel
+                    colors={props.colors}
+                    onColorClick={(value) => {
+                      copy(value);
+                    }}
+                  />
+                </div>
               )}
 
               {props.gradients.length > 0 && (
-                <GradientsPanel
-                  gradients={props.gradients}
-                  onColorClick={(value) => {
-                    copy(value);
-                  }}
-                />
+                <div className="mt-3 w-full">
+                  <GradientsPanel
+                    gradients={props.gradients}
+                    onColorClick={(value) => {
+                      copy(value);
+                    }}
+                  />
+                </div>
               )}
             </div>
           )}
```

**File**: `packages/plugin-ui/src/components/CodePanel.tsx` (modified, +21/-16)
```diff
@@ -133,10 +133,13 @@ const CodePanel = (props: CodePanelProps) => {
     };
   }, [preferenceOptions, selectPreferenceOptions, selectedFramework]);
 
+  const hasSettingsBeforeStyling =
+    essentialPreferences.length > 0 || selectableSettingsFiltered.length > 0;
+
   return (
     <div className="w-full flex flex-col gap-2 mt-2">
       <div className="flex items-center justify-between w-full">
-        <p className="text-lg font-medium text-center dark:text-white rounded-lg">
+        <p className="text-lg font-medium text-center text-foreground rounded-lg">
           Code
         </p>
         {!isCodeEmpty && (
@@ -161,7 +164,7 @@ const CodePanel = (props: CodePanelProps) => {
 
           {/* Framework-specific options */}
           {selectableSettingsFiltered.length > 0 && (
-            <div className="mt-1 mb-2 last:mb-0">
+            <div className="mb-2 flex flex-col gap-2 last:mb-0">
               <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                 {selectedFramework} Options
               </p>
@@ -188,19 +191,21 @@ const CodePanel = (props: CodePanelProps) => {
           {/* Styling preferences with custom prefix for Tailwind */}
           {(stylingPreferences.length > 0 ||
             selectedFramework === "Tailwind") && (
-            <SettingsGroup
-              title="Styling Options"
-              settings={stylingPreferences}
-              selectedSettings={settings}
-              onPreferenceChanged={onPreferenceChanged}
-            >
-              {selectedFramework === "Tailwind" && (
-                <TailwindSettings
-                  settings={settings}
-                  onPreferenceChanged={onPreferenceChanged}
-                />
-              )}
-            </SettingsGroup>
+            <div className={hasSettingsBeforeStyling ? "mt-2" : undefined}>
+              <SettingsGroup
+                title="Styling Options"
+                settings={stylingPreferences}
+                selectedSettings={settings}
+                onPreferenceChanged={onPreferenceChanged}
+              >
+                {selectedFramework === "Tailwind" && (
+                  <TailwindSettings
+                    settings={settings}
+                    onPreferenceChanged={onPreferenceChanged}
+                  />
+                )}
+              </SettingsGroup>
+            </div>
           )}
         </div>
       )}
@@ -221,7 +226,7 @@ const CodePanel = (props: CodePanelProps) => {
                   showLabel={false}
                   onMouseEnter={handleButtonHover}
                   onMouseLeave={handleButtonLeave}
-                  className="pointer-events-auto absolute right-2 top-2 h-7 w-7 rounded-md bg-neutral-800/90 p-0 text-neutral-200 shadow-sm backdrop-blur-sm hover:bg-neutral-700 hover:text-white dark:bg-neutral-800/90 dark:hover:bg-neutral-700"
+                  className="pointer-events-auto absolute right-2 top-2 h-7 w-7 rounded-md bg-neutral-800/90 p-0 text-neutral-200 shadow-sm ring-1 ring-white/10 backdrop-blur-sm hover:bg-neutral-600 hover:text-white hover:ring-white/20 dark:bg-neutral-800/90 dark:hover:bg-neutral-600"
                 />
               </div>
             )}
```

**File**: `packages/plugin-ui/src/components/ColorsPanel.tsx` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ const ColorsPanel = (props: {
   };
 
   return (
-    <div className="bg-card border w-full rounded-lg p-4 flex flex-col gap-2">
+    <div className="bg-card border w-full rounded-lg p-3 flex flex-col gap-2">
       <div className="p-0 pb-2">
         <div className="flex items-center justify-between">
           <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
```

**File**: `packages/plugin-ui/src/components/CopyButton.tsx` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ export function CopyButton({
       onMouseLeave={onMouseLeave}
       className={cn(
         "transition-colors duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]",
-        "bg-neutral-100 dark:bg-neutral-700",
+        "bg-neutral-100 text-neutral-800 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-200 hover:text-neutral-950 dark:bg-neutral-800/90 dark:text-neutral-200 dark:ring-white/10 dark:hover:bg-neutral-600 dark:hover:text-white dark:hover:ring-white/20",
         className,
       )}
       aria-label={isCopied ? "Copied!" : "Copy to clipboard"}
```

**File**: `packages/plugin-ui/src/components/FrameworkTabs.tsx` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ const FrameworkTabs: React.FC<FrameworkTabsProps> = ({
   onChange,
 }) => {
   return (
-    <div className="flex flex-wrap gap-1 my-2">
+    <div className="flex flex-wrap gap-1">
       <div className="flex flex-wrap bg-muted p-1 rounded-lg gap-1 w-fit">
         {options.map((option) => {
           const isSelected = option.value === selectedValue;
```

---

### Incident Patch 5: `7b294603` (2026-05-13)
**Commit Message**: Fix plugin settings callback types

**File**: `apps/plugin/ui-src/App.tsx` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ export default function App() {
   };
   const handlePreferencesChange = (
     key: keyof PluginSettings,
-    value: boolean | string | number,
+    value: PluginSettings[keyof PluginSettings],
   ) => {
     if (state.settings && state.settings[key] === value) {
       // do nothing
```

**File**: `packages/plugin-ui/src/PluginUI.tsx` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ type PluginUIProps = {
   settings: PluginSettings | null;
   onPreferenceChanged: (
     key: keyof PluginSettings,
-    value: boolean | string | number,
+    value: PluginSettings[keyof PluginSettings],
   ) => void;
   colors: SolidColorConversion[];
   gradients: LinearGradientConversion[];
```

**File**: `packages/plugin-ui/src/components/About.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ type AboutProps = {
   useOldPluginVersion?: boolean;
   onPreferenceChanged: (
     key: keyof PluginSettings,
-    value: boolean | string | number,
+    value: PluginSettings[keyof PluginSettings],
   ) => void;
 };
 
```

**File**: `packages/plugin-ui/src/components/CodePanel.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ interface CodePanelProps {
   selectPreferenceOptions: SelectPreferenceOptions[];
   onPreferenceChanged: (
     key: keyof PluginSettings,
-    value: boolean | string | number,
+    value: PluginSettings[keyof PluginSettings],
   ) => void;
 }
 
```

**File**: `packages/plugin-ui/src/components/SettingsGroup.tsx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ interface SettingsGroupProps {
   selectedSettings?: PluginSettings | null;
   onPreferenceChanged?: (
     key: keyof PluginSettings,
-    value: boolean | string,
+    value: PluginSettings[keyof PluginSettings],
   ) => void;
   children?: ReactNode;
 }
```

**File**: `packages/plugin-ui/src/components/TailwindSettings.tsx` (modified, +21/-17)
```diff
@@ -5,7 +5,7 @@ interface TailwindSettingsProps {
   settings: PluginSettings | null;
   onPreferenceChanged: (
     key: keyof PluginSettings,
-    value: boolean | string | number | Record<string, string[]>,
+    value: PluginSettings[keyof PluginSettings],
   ) => void;
 }
 
@@ -28,22 +28,22 @@ export const TailwindSettings: React.FC<TailwindSettingsProps> = ({
     onPreferenceChanged("baseFontFamily", newValue);
   };
   const handleFontFamilyCustomConfigChange = (newValue: string) => {
-  try {
-    // Check if the string is empty, use default empty object
-    if (!newValue.trim()) {
-      onPreferenceChanged("fontFamilyCustomConfig", {});
-      return;
-    }
+    try {
+      // Check if the string is empty, use default empty object
+      if (!newValue.trim()) {
+        onPreferenceChanged("fontFamilyCustomConfig", {});
+        return;
+      }
 
-    // parse the JSON
-    const config = JSON.parse(newValue);
+      // parse the JSON
+      const config = JSON.parse(newValue);
 
-    onPreferenceChanged("fontFamilyCustomConfig", config);
-  } catch (error) {
-    // Handle parsing errors
-    console.error("Invalid JSON configuration:", error);
-  }
-};
+      onPreferenceChanged("fontFamilyCustomConfig", config);
+    } catch (error) {
+      // Handle parsing errors
+      console.error("Invalid JSON configuration:", error);
+    }
+  };
 
   return (
     <div className="mt-2">
@@ -113,7 +113,7 @@ export const TailwindSettings: React.FC<TailwindSettingsProps> = ({
         <div className="mb-3">
           <FormField
             label="Base Font Family"
-            initialValue={settings.baseFontFamily || ''}
+            initialValue={settings.baseFontFamily || ""}
             onValueChange={(d) => {
               handleBaseFontFamilyChange(String(d));
             }}
@@ -129,7 +129,11 @@ export const TailwindSettings: React.FC<TailwindSettingsProps> = ({
           <FormField
             type="json"
             label="Font Family Custom Config"
-            initialValue={settings.fontFamilyCustomConfig ? JSON.stringify(settings.fontFamilyCustomConfig) : ''}
+            initialValue={
+              settings.fontFamilyCustomConfig
+                ? JSON.stringify(settings.fontFamilyCustomConfig)
+                : ""
+            }
             onValueChange={(d) => {
               handleFontFamilyCustomConfigChange(String(d));
             }}
```

---

### Incident Patch 6: `1dd0ea96` (2026-05-13)
**Commit Message**: add floating copy to clipboard to make UX better for users

**File**: `packages/plugin-ui/src/components/CodePanel.tsx` (modified, +10/-8)
```diff
@@ -206,7 +206,7 @@ const CodePanel = (props: CodePanelProps) => {
       )}
 
       <div
-        className={`relative rounded-lg ring-green-600 transition-all duration-200 overflow-clip ${
+        className={`relative rounded-lg ring-green-600 transition-all duration-200 ${
           syntaxHovered ? "ring-2" : "ring-0"
         }`}
       >
@@ -215,13 +215,15 @@ const CodePanel = (props: CodePanelProps) => {
         ) : (
           <>
             {showCodeCopyButton && (
-              <CopyButton
-                value={prefixedCode}
-                showLabel={false}
-                onMouseEnter={handleButtonHover}
-                onMouseLeave={handleButtonLeave}
-                className="absolute right-2 top-2 z-10 h-7 w-7 rounded-md bg-neutral-800/90 p-0 text-neutral-200 shadow-sm backdrop-blur-sm hover:bg-neutral-700 hover:text-white dark:bg-neutral-800/90 dark:hover:bg-neutral-700"
-              />
+              <div className="pointer-events-none sticky top-3 z-10 h-0">
+                <CopyButton
+                  value={prefixedCode}
+                  showLabel={false}
+                  onMouseEnter={handleButtonHover}
+                  onMouseLeave={handleButtonLeave}
+                  className="pointer-events-auto absolute right-2 top-2 h-7 w-7 rounded-md bg-neutral-800/90 p-0 text-neutral-200 shadow-sm backdrop-blur-sm hover:bg-neutral-700 hover:text-white dark:bg-neutral-800/90 dark:hover:bg-neutral-700"
+                />
+              </div>
             )}
             <SyntaxHighlighter
               language={
```

---

### Incident Patch 7: `9306dd42` (2026-05-13)
**Commit Message**: Polish plugin UI primitives

**File**: `apps/plugin/plugin-src/code.ts` (modified, +11/-2)
```diff
@@ -134,7 +134,14 @@ const safeRun = async (settings: PluginSettings) => {
 const standardMode = async () => {
   console.log("[DEBUG] standardMode - Starting standard mode initialization");
   figma.showUI(__html__, { width: 450, height: 700, themeColors: true });
-  await initSettings();
+  let initialized = false;
+  const initializeOnce = async () => {
+    if (initialized) {
+      return;
+    }
+    initialized = true;
+    await initSettings();
+  };
 
   // Listen for selection changes
   figma.on("selectionchange", () => {
@@ -162,7 +169,9 @@ const standardMode = async () => {
       msg?.type ? `type=${msg.type}` : "unknown type",
     );
 
-    if (msg.type === "pluginSettingWillChange") {
+    if (msg.type === "ui-ready") {
+      await initializeOnce();
+    } else if (msg.type === "pluginSettingWillChange") {
       const { key, value } = msg as SettingWillChangeMessage<unknown>;
       console.log(`[DEBUG] Setting changed: ${key} = ${value}`);
       (userPluginSettings as any)[key] = value;
```

**File**: `apps/plugin/ui-src/App.tsx` (modified, +6/-2)
```diff
@@ -32,7 +32,7 @@ export default function App() {
   const [state, setState] = useState<AppState>({
     code: "",
     selectedFramework: "HTML",
-    isLoading: false,
+    isLoading: true,
     htmlPreview: emptyPreview,
     settings: null,
     colors: [],
@@ -69,7 +69,7 @@ export default function App() {
           }));
           break;
 
-        case "pluginSettingChanged":
+        case "pluginSettingsChanged":
           const settingsMessage = untypedMessage as SettingsChangedMessage;
           setState((prevState) => ({
             ...prevState,
@@ -117,6 +117,10 @@ export default function App() {
     };
   }, []);
 
+  useEffect(() => {
+    parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
+  }, []);
+
   const handleFrameworkChange = (updatedFramework: Framework) => {
     if (updatedFramework !== state.selectedFramework) {
       setState((prevState) => ({
```

**File**: `packages/plugin-ui/src/PluginUI.tsx` (modified, +41/-12)
```diff
@@ -18,9 +18,10 @@ import {
   selectPreferenceOptions,
 } from "./codegenPreferenceOptions";
 import Loading from "./components/Loading";
-import { useState } from "react";
+import { useEffect, useState } from "react";
 import { InfoIcon } from "lucide-react";
 import React from "react";
+import { Button } from "./components/ui/button";
 import { ScrollArea } from "./components/ui/scroll-area";
 import { TooltipProvider } from "./components/ui/tooltip";
 
@@ -41,6 +42,7 @@ type PluginUIProps = {
 };
 
 const frameworks: Framework[] = ["HTML", "Tailwind", "Flutter", "SwiftUI"];
+const LOADING_INDICATOR_DELAY_MS = 250;
 
 type FrameworkTabsProps = {
   frameworks: Framework[];
@@ -60,27 +62,31 @@ const FrameworkTabs = ({
   return (
     <div className="grid grid-cols-4 sm:grid-cols-2 md:grid-cols-4 gap-1 grow">
       {frameworks.map((tab) => (
-        <button
+        <Button
+          variant="ghost"
+          size="sm"
           key={`tab ${tab}`}
-          className={`w-full h-8 flex items-center justify-center text-sm rounded-md transition-colors font-medium ${
+          className={`w-full h-8 rounded-md text-sm ${
             selectedFramework === tab && !showAbout
-              ? "bg-primary text-primary-foreground shadow-xs"
-              : "bg-muted hover:bg-primary/90 hover:text-primary-foreground"
+              ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary"
+              : "bg-muted text-foreground hover:bg-primary/90 hover:text-primary-foreground dark:hover:bg-primary/90"
           }`}
           onClick={() => {
             setSelectedFramework(tab as Framework);
             setShowAbout(false);
           }}
         >
           {tab}
-        </button>
+        </Button>
       ))}
     </div>
   );
 };
 
 export const PluginUI = (props: PluginUIProps) => {
   const [showAbout, setShowAbout] = useState(false);
+  const [showLoading, setShowLoading] = useState(false);
+  const [hasHandledInitialLoad, setHasHandledInitialLoad] = useState(false);
 
   const [previewExpanded, setPreviewExpanded] = useState(false);
   const [previewViewMode, setPreviewViewMode] = useState<
@@ -90,7 +96,28 @@ export const PluginUI = (props: PluginUIProps) => {
     "white",
   );
 
-  if (props.isLoading) return <Loading />;
+  useEffect(() => {
+    if (!props.isLoading) {
+      setShowLoading(false);
+      setHasHandledInitialLoad(true);
+      return;
+    }
+
+    if (hasHandledInitialLoad) {
+      setShowLoading(true);
+      return;
+    }
+
+    // On plugin startup, the UI waits for a ready handshake before the first conversion.
+    // Delay the loader only for that initial pass to avoid a one-frame loading flash.
+    const timer = window.setTimeout(() => {
+      setShowLoading(true);
+    }, LOADING_INDICATOR_DELAY_MS);
+
+    return () => window.clearTimeout(timer);
+  }, [props.isLoading]);
+
+  if (props.isLoading) return showLoading ? <Loading /> : null;
 
   const isEmpty = props.code === "";
   const warnings = props.warnings ?? [];
@@ -107,19 +134,21 @@ export const PluginUI = (props: PluginUIProps) => {
               showAbout={showAbout}
               setShowAbout={setShowAbout}
             />
-            <button
-              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium ${
+            <Button
+              variant="ghost"
+              size="icon"
+              className={`h-8 w-8 rounded-md ${
                 showAbout
-                  ? "bg-primary text-primary-foreground shadow-xs"
-                  : "bg-muted hover:bg-primary/90 hover:text-primary-foreground"
+                  ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary"
+                  : "bg-muted text-foreground hover:bg-primary/90 hover:text-primary-foreground dark:hover:bg-primary/90"
               }`}
               onClick={() => {
                 setShowAbout(!showAbout);
               }}
               aria-label="About"
             >
               <InfoIcon size={16} />
-            </button>
+            </Button>
           </div>
         </div>
         <div
```

**File**: `packages/plugin-ui/src/components/About.tsx` (modified, +145/-129)
```diff
@@ -13,6 +13,9 @@ import {
   ToggleRight,
 } from "lucide-react";
 import { PluginSettings } from "types";
+import { Button, buttonVariants } from "./ui/button";
+import { Card, CardContent } from "./ui/card";
+import { cn } from "../lib/utils";
 
 type AboutProps = {
   useOldPluginVersion?: boolean;
@@ -85,151 +88,164 @@ const About = ({
       {/* Cards Section */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* Privacy Policy Card */}
-        <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 shadow-2xs border border-neutral-200 dark:border-neutral-700 hover:border-green-300 dark:hover:border-green-700 transition-colors">
-          <div className="flex items-center gap-3 mb-3">
-            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
-              <Lock size={20} className="text-blue-600 dark:text-blue-400" />
+        <Card className="border-neutral-200 py-0 transition-colors hover:border-green-300 dark:border-neutral-700 dark:hover:border-green-700">
+          <CardContent className="p-5">
+            <div className="flex items-center gap-3 mb-3">
+              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
+                <Lock size={20} className="text-blue-600 dark:text-blue-400" />
+              </div>
+              <h3 className="font-semibold text-base">Privacy Policy</h3>
             </div>
-            <h3 className="font-semibold text-base">Privacy Policy</h3>
-          </div>
-          <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
-            This plugin is completely private. All of your design data is
-            processed locally in your browser and never leaves your computer. No
-            analytics, no data collection, no tracking.
-          </p>
-        </div>
+            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
+              This plugin is completely private. All of your design data is
+              processed locally in your browser and never leaves your computer.
+              No analytics, no data collection, no tracking.
+            </p>
+          </CardContent>
+        </Card>
 
         {/* Open Source Card */}
-        <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 shadow-2xs border border-neutral-200 dark:border-neutral-700 hover:border-green-300 dark:hover:border-green-700 transition-colors">
-          <div className="flex items-center gap-3 mb-3">
-            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
-              <GithubLogo className="text-purple-600 dark:text-purple-400" />
-            </div>
-            <h3 className="font-semibold text-base">Open Source</h3>
-          </div>
-          <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
-            Figma to Code is completely open-source. Contributions, bug reports,
-            and feature requests are welcome!
-          </p>
-          <a
-            href="https://github.com/bernaferrari/figmatocode"
-            target="_blank"
-            rel="noopener noreferrer"
-            className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-md text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
-          >
-            <Star size={14} className="text-yellow-500 fill-yellow-500" />
-            <span>View on GitHub</span>
-          </a>
-        </div>
-
-        {/* Features Card */}
-        <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 shadow-2xs border border-neutral-200 dark:border-neutral-700 hover:border-green-300 dark:hover:border-green-700 transition-colors">
-          <div className="flex items-center gap-3 mb-3">
-            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
-              <Zap size={20} className="text-amber-600 dark:text-amber-400" />
-            </div>
-            <h3 className="font-semibold text-base">Features</h3>
-          </div>
-          <ul className="text-neutral-600 dark:text-neutral-300 space-y-2 leading-relaxed">
-            <li className="flex items-start gap-2">
-              <div className="mt-1.5">
-                <ArrowRightIcon size={12} />
-              </div>
-              <span>
-                Convert Figma designs to HTML, Tailwind, Flutter, and SwiftUI
-              </span>
-            </li>
-            <li className="flex items-start gap-2">
-              <div className="mt-1.5">
-                <ArrowRightIcon size={12} />
-              </div>
-              <span>Extract colors and gradients from your designs</span>
-            </li>
-            <li className="flex items-start gap-2">
-              <div className="mt-1.5">
-                <ArrowRightIcon size={12} />
+        <Card className="border-neutral-200 py-0 transition-colors hover:border-green-300 dark:border-neutral-700 dark:hover:border-green-
```

**File**: `packages/plugin-ui/src/components/CopyButton.tsx` (modified, +19/-38)
```diff
@@ -1,6 +1,6 @@
 "use client";
 
-import { useState, useEffect } from "react";
+import { useState, useEffect, useCallback } from "react";
 import { Copy, Check } from "lucide-react";
 import copy from "copy-to-clipboard";
 import { cn } from "../lib/utils";
@@ -19,84 +19,65 @@ export function CopyButton({
   value,
   className,
   showLabel = true,
-  successDuration = 750,
+  successDuration = 1500,
   onMouseEnter,
   onMouseLeave,
 }: CopyButtonProps) {
   const [isCopied, setIsCopied] = useState(false);
 
   useEffect(() => {
-    if (isCopied) {
-      const timer = setTimeout(() => {
-        setIsCopied(false);
-      }, successDuration);
-
-      return () => clearTimeout(timer);
-    }
+    if (!isCopied) return;
+    const timer = setTimeout(() => setIsCopied(false), successDuration);
+    return () => clearTimeout(timer);
   }, [isCopied, successDuration]);
 
-  const handleCopy = async () => {
+  const handleCopy = useCallback(() => {
     try {
       copy(value);
       setIsCopied(true);
     } catch (error) {
       console.error("Failed to copy text: ", error);
     }
-  };
+  }, [value]);
 
   return (
     <Button
       variant="ghost"
-      size={showLabel ? "sm" : "icon-sm"}
+      size={showLabel ? "default" : "icon"}
       onClick={handleCopy}
       onMouseEnter={onMouseEnter}
       onMouseLeave={onMouseLeave}
       className={cn(
-        "relative overflow-hidden rounded-md text-sm font-medium text-foreground transition-[background-color,transform,color] duration-150 ease-out hover:bg-neutral-200 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 dark:hover:bg-neutral-600",
-        showLabel ? "h-8 px-3" : "h-7 w-7 gap-0 p-0",
+        "transition-colors duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]",
         "bg-neutral-100 dark:bg-neutral-700",
         className,
       )}
       aria-label={isCopied ? "Copied!" : "Copy to clipboard"}
     >
-      <span
-        className={cn("relative h-4 w-4", showLabel && "mr-1.5")}
-        aria-hidden="true"
-      >
+      <span className={cn("relative h-5 w-5 shrink-0")} aria-hidden="true">
         <span
           className={cn(
-            "absolute inset-0 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
-            isCopied
-              ? "-translate-y-1 scale-95 opacity-0"
-              : "translate-y-0 scale-100 opacity-100",
+            "absolute inset-0 flex items-center justify-center",
+            "transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]",
+            "motion-reduce:transition-none",
+            isCopied ? "scale-50 opacity-0" : "scale-100 opacity-100",
           )}
         >
           <Copy className="h-4 w-4" />
         </span>
         <span
           className={cn(
-            "absolute inset-0 text-primary transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
-            isCopied
-              ? "translate-y-0 scale-100 opacity-100"
-              : "translate-y-1 scale-95 opacity-0",
+            "absolute inset-0 flex items-center justify-center",
+            "transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]",
+            "motion-reduce:transition-none",
+            isCopied ? "scale-100 opacity-100" : "scale-50 opacity-0",
           )}
         >
           <Check className="h-4 w-4" />
         </span>
       </span>
 
-      {showLabel && (
-        <span className="grid min-w-[3.9rem] text-left">
-          <span
-            className={cn(
-              "col-start-1 row-start-1 transition-colors duration-150 ease-out motion-reduce:transition-none",
-              isCopied && "text-primary",
-            )}
-          >
-            Copy
-          </span>
-        </span>
-      )}
+      {showLabel && <span className="inline-flex text-left">{"Copy"}</span>}
     </Button>
   );
 }
```

**File**: `packages/plugin-ui/src/components/CustomPrefixInput.tsx` (modified, +1/-3)
```diff
@@ -251,9 +251,7 @@ const FormField = React.memo(
               >
                 <HelpCircle className="w-3 h-3 text-gray-400" />
               </TooltipTrigger>
-              <TooltipContent className="w-56 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow-lg">
-                {helpText}
-              </TooltipContent>
+              <TooltipContent>{helpText}</TooltipContent>
             </Tooltip>
           )}
 
```

**File**: `packages/plugin-ui/src/components/FrameworkTabs.tsx` (modified, +8/-5)
```diff
@@ -1,4 +1,5 @@
 import React from "react";
+import { Button } from "./ui/button";
 
 type Option = {
   value: string;
@@ -22,17 +23,19 @@ const FrameworkTabs: React.FC<FrameworkTabsProps> = ({
         {options.map((option) => {
           const isSelected = option.value === selectedValue;
           return (
-            <button
+            <Button
+              variant="ghost"
+              size="sm"
               key={option.value}
               onClick={() => onChange(option.value)}
-              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-200 ${
+              className={`h-7 rounded-md px-3 text-xs ${
                 isSelected
-                  ? "bg-blue-500 dark:bg-blue-500 text-primary-foreground shadow-2xs"
-                  : "hover:bg-muted-foreground/10 text-muted-foreground"
+                  ? "bg-blue-500 text-primary-foreground shadow-2xs hover:bg-blue-500 hover:text-primary-foreground dark:bg-blue-500 dark:hover:bg-blue-500"
+                  : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-muted-foreground dark:hover:bg-muted-foreground/10"
               }`}
             >
               {option.label}
-            </button>
+            </Button>
           );
         })}
       </div>
```

**File**: `packages/plugin-ui/src/components/Preview.tsx` (modified, +14/-7)
```diff
@@ -10,6 +10,7 @@ import {
   Monitor,
 } from "lucide-react";
 import { cn, replaceExternalImagesWithCanvas } from "../lib/utils";
+import { Button } from "./ui/button";
 
 // Update the component props to receive state from parent
 const Preview: React.FC<{
@@ -62,14 +63,16 @@ const Preview: React.FC<{
         <div className="flex items-center gap-1">
           {/* Background Color Toggle - Only show in desktop and mobile modes */}
 
-          <button
+          <Button
+            variant="ghost"
+            size="icon-sm"
             onClick={() => setBgColor(bgColor === "white" ? "black" : "white")}
-            className="p-1.5 mr-1 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 transition-colors"
+            className="mr-1 rounded-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
             aria-label={`Switch the preview to ${bgColor === "white" ? "black" : "white"} background.\nUseful to avoid black text on black background.`}
             title={`Switch the preview to ${bgColor === "white" ? "black" : "white"} background.\nUseful to avoid black text on black background.`}
           >
             <Circle size={14} fill={bgColor} className="stroke-current" />
-          </button>
+          </Button>
 
           {/* View Mode Toggle */}
           {/* <div className="mr-1 flex bg-neutral-100 dark:bg-neutral-700 rounded-md p-0.5">
@@ -112,14 +115,16 @@ const Preview: React.FC<{
           </div> */}
 
           {/* Expand/Collapse Button */}
-          <button
+          <Button
+            variant="ghost"
+            size="icon-sm"
             onClick={() => setExpanded(!expanded)}
-            className="p-1 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 transition-colors"
+            className="rounded-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
             aria-label={expanded ? "Minimize preview" : "Maximize preview"}
             title={expanded ? "Minimize preview" : "Maximize preview"}
           >
             {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
-          </button>
+          </Button>
         </div>
       </div>
 
@@ -184,7 +189,9 @@ const Preview: React.FC<{
                     transition: "all 0.3s ease",
                   }}
                   dangerouslySetInnerHTML={{
-                    __html: replaceExternalImagesWithCanvas(htmlPreview.content),
+                    __html: replaceExternalImagesWithCanvas(
+                      htmlPreview.content,
+                    ),
                   }}
                 />
               </div>
```

---

### Incident Patch 8: `fda832f2` (2026-05-13)
**Commit Message**: Adopt shadcn UI primitives in plugin

**File**: `apps/plugin/plugin-src/code.ts` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ export const defaultPluginSettings: PluginSettings = {
   htmlGenerationMode: "html",
   tailwindGenerationMode: "jsx",
   baseFontSize: 16,
-  useTailwind4: false,
+  useTailwind4: true,
   thresholdPercent: 15,
   baseFontFamily: "",
   fontFamilyCustomConfig: {},
```

**File**: `apps/plugin/ui-src/index.css` (modified, +13/-1)
```diff
@@ -4,6 +4,18 @@
 
 @custom-variant dark (&:is(.dark *));
 
+html,
+body,
+#root {
+  width: 100%;
+  height: 100%;
+  overflow: hidden;
+}
+
+body {
+  margin: 0;
+}
+
 :root {
   --radius: 0.5rem;
   --background: oklch(1 0 0);
@@ -128,4 +140,4 @@
   [role="button"]:not([disabled]) {
     cursor: pointer;
   }
-}
\ No newline at end of file
+}
```

**File**: `packages/plugin-ui/package.json` (modified, +2/-0)
```diff
@@ -10,9 +10,11 @@
     "lint": "eslint \"src/**/*.ts*\""
   },
   "dependencies": {
+    "@base-ui/react": "^1.4.1",
     "@types/react": "^19.2.14",
     "@types/react-dom": "^19.2.3",
     "@types/react-syntax-highlighter": "15.5.13",
+    "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "copy-to-clipboard": "^4.0.2",
     "lucide-react": "^1.14.0",
```

**File**: `packages/plugin-ui/src/PluginUI.tsx` (modified, +81/-77)
```diff
@@ -21,6 +21,8 @@ import Loading from "./components/Loading";
 import { useState } from "react";
 import { InfoIcon } from "lucide-react";
 import React from "react";
+import { ScrollArea } from "./components/ui/scroll-area";
+import { TooltipProvider } from "./components/ui/tooltip";
 
 type PluginUIProps = {
   code: string;
@@ -94,89 +96,91 @@ export const PluginUI = (props: PluginUIProps) => {
   const warnings = props.warnings ?? [];
 
   return (
-    <div className="flex flex-col h-full dark:text-white">
-      <div className="p-2 dark:bg-card">
-        <div className="flex gap-1 bg-muted dark:bg-card rounded-lg p-1">
-          <FrameworkTabs
-            frameworks={frameworks}
-            selectedFramework={props.selectedFramework}
-            setSelectedFramework={props.setSelectedFramework}
-            showAbout={showAbout}
-            setShowAbout={setShowAbout}
-          />
-          <button
-            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium ${
-              showAbout
-                ? "bg-primary text-primary-foreground shadow-xs"
-                : "bg-muted hover:bg-primary/90 hover:text-primary-foreground"
-            }`}
-            onClick={() => {
-              setShowAbout(!showAbout);
-            }}
-            aria-label="About"
-          >
-            <InfoIcon size={16} />
-          </button>
-        </div>
-      </div>
-      <div
-        style={{
-          height: 1,
-          width: "100%",
-          backgroundColor: "rgba(255,255,255,0.12)",
-        }}
-      ></div>
-      <div className="flex flex-col h-full overflow-y-auto">
-        {showAbout ? (
-          <About
-            useOldPluginVersion={props.settings?.useOldPluginVersion2025}
-            onPreferenceChanged={props.onPreferenceChanged}
-          />
-        ) : (
-          <div className="flex flex-col items-center px-4 py-2 gap-2 dark:bg-transparent">
-            {isEmpty === false && props.htmlPreview && (
-              <Preview
-                htmlPreview={props.htmlPreview}
-                expanded={previewExpanded}
-                setExpanded={setPreviewExpanded}
-                viewMode={previewViewMode}
-                setViewMode={setPreviewViewMode}
-                bgColor={previewBgColor}
-                setBgColor={setPreviewBgColor}
-              />
-            )}
-
-            {warnings.length > 0 && <WarningsPanel warnings={warnings} />}
-
-            <CodePanel
-              code={props.code}
+    <TooltipProvider>
+      <div className="flex flex-col h-full overflow-hidden dark:text-white">
+        <div className="p-2 dark:bg-card">
+          <div className="flex gap-1 bg-muted dark:bg-card rounded-lg p-1">
+            <FrameworkTabs
+              frameworks={frameworks}
               selectedFramework={props.selectedFramework}
-              preferenceOptions={preferenceOptions}
-              selectPreferenceOptions={selectPreferenceOptions}
-              settings={props.settings}
+              setSelectedFramework={props.setSelectedFramework}
+              showAbout={showAbout}
+              setShowAbout={setShowAbout}
+            />
+            <button
+              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium ${
+                showAbout
+                  ? "bg-primary text-primary-foreground shadow-xs"
+                  : "bg-muted hover:bg-primary/90 hover:text-primary-foreground"
+              }`}
+              onClick={() => {
+                setShowAbout(!showAbout);
+              }}
+              aria-label="About"
+            >
+              <InfoIcon size={16} />
+            </button>
+          </div>
+        </div>
+        <div
+          style={{
+            height: 1,
+            width: "100%",
+            backgroundColor: "rgba(255,255,255,0.12)",
+          }}
+        ></div>
+        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
+          {showAbout ? (
+            <About
+              useOldPluginVersion={props.settings?.useOldPluginVersion2025}
               onPreferenceChanged={props.onPreferenceChanged}
             />
+          ) : (
+            <div className="flex flex-col items-center px-4 py-2 gap-2 dark:bg-transparent">
+              {isEmpty === false && props.htmlPreview && (
+                <Preview
+                  htmlPreview={props.htmlPreview}
+                  expanded={previewExpanded}
+                  setExpanded={setPreviewExpanded}
+                  viewMode={previewViewMode}
+                  setViewMode={setPreviewViewMode}
+                  bgColor={previewBgColor}
+                  setBgColor={setPreviewBgColor}
+                />
+              )}
 
-            {props.colors.length > 0 && (
-              <ColorsPanel
-                colors={props.colors}
-                onColorClick={(value) => {
-                  copy(value);
-                }}
-              />
-
```

**File**: `packages/plugin-ui/src/codegenPreferenceOptions.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ export const preferenceOptions: LocalCodegenPreferenceOptions[] = [
     propertyName: "useTailwind4",
     label: "Tailwind 4",
     description: "Enable Tailwind CSS version 4 features and syntax.",
-    isDefault: false,
+    isDefault: true,
     includedLanguages: ["Tailwind"],
   },
   {
```

**File**: `packages/plugin-ui/src/components/CodePanel.tsx` (modified, +8/-1)
```diff
@@ -205,14 +205,21 @@ const CodePanel = (props: CodePanelProps) => {
       )}
 
       <div
-        className={`rounded-lg ring-green-600 transition-all duration-200 overflow-clip ${
+        className={`relative rounded-lg ring-green-600 transition-all duration-200 overflow-clip ${
           syntaxHovered ? "ring-2" : "ring-0"
         }`}
       >
         {isCodeEmpty ? (
           <EmptyState />
         ) : (
           <>
+            <CopyButton
+              value={prefixedCode}
+              showLabel={false}
+              onMouseEnter={handleButtonHover}
+              onMouseLeave={handleButtonLeave}
+              className="absolute right-2 top-2 z-10 h-7 w-7 bg-neutral-800/90 p-0 text-neutral-200 shadow-sm backdrop-blur-sm hover:bg-neutral-700 hover:text-white dark:bg-neutral-800/90 dark:hover:bg-neutral-700"
+            />
             <SyntaxHighlighter
               language={
                 selectedFramework === "HTML" &&
```

**File**: `packages/plugin-ui/src/components/CopyButton.tsx` (modified, +37/-29)
```diff
@@ -4,6 +4,7 @@ import { useState, useEffect } from "react";
 import { Copy, Check } from "lucide-react";
 import copy from "copy-to-clipboard";
 import { cn } from "../lib/utils";
+import { Button } from "./ui/button";
 
 interface CopyButtonProps {
   value: string;
@@ -44,51 +45,58 @@ export function CopyButton({
   };
 
   return (
-    <button
+    <Button
+      variant="ghost"
+      size="sm"
       onClick={handleCopy}
       onMouseEnter={onMouseEnter}
       onMouseLeave={onMouseLeave}
       className={cn(
-        `inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300`,
-        isCopied
-          ? "bg-primary text-primary-foreground"
-          : "bg-neutral-100 dark:bg-neutral-700 dark:hover:bg-muted-foreground/30 text-foreground",
+        "relative h-8 overflow-hidden rounded-md px-3 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:bg-neutral-200 motion-reduce:transition-none dark:hover:bg-neutral-600",
+        "bg-neutral-100 dark:bg-neutral-700",
         className,
-        `relative`,
       )}
       aria-label={isCopied ? "Copied!" : "Copy to clipboard"}
     >
-      <div className="relative h-4 w-4 mr-1.5">
+      <span className="relative mr-1.5 h-4 w-4" aria-hidden="true">
         <span
-          className={`absolute inset-0 transition-all duration-200 ${
-            isCopied
-              ? "opacity-0 scale-75 rotate-[-10deg]"
-              : "opacity-100 scale-100 rotate-0"
-          }`}
+          className={cn(
+            "absolute inset-0 transition-opacity duration-150 ease-out motion-reduce:transition-none",
+            isCopied ? "opacity-0" : "opacity-100",
+          )}
         >
-          <Copy className="h-4 w-4 text-foreground" />
+          <Copy className="h-4 w-4" />
         </span>
         <span
-          className={`absolute inset-0 transition-all duration-200 ${
-            isCopied
-              ? "opacity-100 scale-100 rotate-0"
-              : "opacity-0 scale-75 rotate-[10deg]"
-          }`}
+          className={cn(
+            "absolute inset-0 transition-opacity duration-150 ease-out motion-reduce:transition-none",
+            isCopied ? "text-primary opacity-100" : "opacity-0",
+          )}
         >
-          <Check className="h-4 w-4 text-primary-foreground" />
+          <Check className="h-4 w-4" />
         </span>
-      </div>
+      </span>
 
       {showLabel && (
-        <span className="font-medium">{isCopied ? "Copied" : "Copy"}</span>
-      )}
-
-      {isCopied && (
-        <span
-          className="absolute inset-0 rounded-md animate-pulse bg-primary/10"
-          aria-hidden="true"
-        />
+        <span className="grid min-w-[3.9rem] text-left">
+          <span
+            className={cn(
+              "col-start-1 row-start-1 transition-opacity duration-150 ease-out motion-reduce:transition-none",
+              isCopied ? "opacity-0" : "opacity-100",
+            )}
+          >
+            Copy
+          </span>
+          <span
+            className={cn(
+              "col-start-1 row-start-1 transition-opacity duration-150 ease-out motion-reduce:transition-none",
+              isCopied ? "text-primary opacity-100" : "opacity-0",
+            )}
+          >
+            Copied
+          </span>
+        </span>
       )}
-    </button>
+    </Button>
   );
 }
```

**File**: `packages/plugin-ui/src/components/CustomPrefixInput.tsx` (modified, +54/-40)
```diff
@@ -1,5 +1,6 @@
 import React, { useState, useRef, useEffect } from "react";
 import { HelpCircle, Check } from "lucide-react";
+import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
 
 interface FormFieldProps {
   // Common props
@@ -10,7 +11,7 @@ interface FormFieldProps {
   helpText?: string;
 
   // Validation props
-  type?: "text" | "number"| "json";
+  type?: "text" | "number" | "json";
   min?: number;
   max?: number;
   suffix?: string;
@@ -116,41 +117,47 @@ const FormField = React.memo(
         }
 
         try {
-            // Try to parse the JSON
-            const config = JSON.parse(value);
+          // Try to parse the JSON
+          const config = JSON.parse(value);
+
+          // Validate that the config is an object
+          if (
+            typeof config !== "object" ||
+            Array.isArray(config) ||
+            config === null
+          ) {
+            throw new Error("Configuration must be a valid JSON object");
+          }
 
-            // Validate that the config is an object
-            if (typeof config !== 'object' || Array.isArray(config) || config === null) {
-              throw new Error("Configuration must be a valid JSON object");
+          for (const item in config) {
+            if (!Array.isArray(config[item])) {
+              throw new Error(
+                `Key ${item} is not valid and should be an array`,
+              );
             }
-
-            for (const item in config) {
-              if (!Array.isArray(config[item])) {
-                throw new Error(`Key ${item} is not valid and should be an array`);
+            config[item].forEach((val) => {
+              if (typeof val !== "string") {
+                throw new Error(`Values from Key ${item} should be string`);
               }
-              config[item].forEach((val) => {
-                if (typeof val !== 'string') {
-                  throw new Error(`Values from Key ${item} should be string`);
-                }
-              });
-            }
-
-            // Additional validation could be added here based on expected structure
-            // For example, checking specific properties or types
-
-            // If valid, update the preference
-            setHasError(false);
-            setErrorMessage("");
-            return true
-          } catch (error) {
-            // Handle parsing errors
-            console.error("Invalid JSON configuration:", error);
-            setHasError(true);
-            setErrorMessage(`Invalid JSON configuration: ${error}`)
-            // You could show an error message to the user here
-            // Or reset to default/previous value
-            return false
+            });
           }
+
+          // Additional validation could be added here based on expected structure
+          // For example, checking specific properties or types
+
+          // If valid, update the preference
+          setHasError(false);
+          setErrorMessage("");
+          return true;
+        } catch (error) {
+          // Handle parsing errors
+          console.error("Invalid JSON configuration:", error);
+          setHasError(true);
+          setErrorMessage(`Invalid JSON configuration: ${error}`);
+          // You could show an error message to the user here
+          // Or reset to default/previous value
+          return false;
+        }
       }
 
       return true;
@@ -163,7 +170,9 @@ const FormField = React.memo(
       setHasChanges(newValue !== String(initialValue));
     };
 
-    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
+    const handleTextareaChange = (
+      e: React.ChangeEvent<HTMLTextAreaElement>,
+    ) => {
       const newValue = e.target.value;
       setInputValue(newValue);
       validateInput(newValue);
@@ -201,7 +210,9 @@ const FormField = React.memo(
       }
     };
 
-    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
+    const handleTextareaKeyDown = (
+      e: React.KeyboardEvent<HTMLTextAreaElement>,
+    ) => {
       // Only apply changes on Ctrl+Enter or Command+Enter for textarea
       if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
         e.preventDefault();
@@ -234,13 +245,16 @@ const FormField = React.memo(
           </label>
 
           {helpText && (
-            <div className="relative group">
-              <HelpCircle className="w-3 h-3 text-gray-400" />
-              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 w-56 p-2 bg-white dark:bg-gray-800 shadow-lg rounded-sm border border-gray-200 dark:border-gray-700 text-xs hidden group-hover:block z-10">
+            <Tooltip>
+              <TooltipTrigger
+                render={<span className="inline-flex cursor-help" />}
+              >
+                <HelpCircle className="w-3 h-3 text-gray-400" />
+              </TooltipTrigger>
+              <TooltipContent className="w-56 bg-white dark:
```

---

### Incident Patch 9: `3b77692e` (2026-02-04)
**Commit Message**: fix: don't add opacity modifier for variable colors (#250)

When a color is from a Figma variable that already contains alpha,
the output was incorrectly adding an opacity modifier like /50.
For example, a variable 'myVar' defined as rgba(255,0,0,0.5) was
generating 'bg-myVar/50' instead of just 'bg-myVar'.

The fix skips the opacity modifier when colorType is 'variable'
since the alpha is already baked into the variable definition.
Adding the modifier would incorrectly compound the opacity.

Fixes #232

Co-authored-by: Michael Golden <[REDACTED_EMAIL]>

**File**: `packages/backend/src/tailwind/builderImpl/tailwindColor.ts` (modified, +17/-2)
```diff
@@ -81,7 +81,15 @@ export const tailwindSolidColor = (
   }
 
   // Original implementation for non-variable colors or when not using var syntax
-  const { colorName } = getColorInfo(fill);
+  const { colorName, colorType } = getColorInfo(fill);
+
+  // Don't add opacity modifier for variable colors - the alpha is already baked
+  // into the variable definition. Adding /50 to a variable that's already
+  // defined with alpha would incorrectly compound the opacity.
+  if (colorType === "variable") {
+    return `${kind}-${colorName}`;
+  }
+
   const effectiveOpacity = calculateEffectiveOpacity(fill);
   const opacity =
     effectiveOpacity !== 1.0 ? `/${nearestOpacity(effectiveOpacity)}` : "";
@@ -101,7 +109,14 @@ export const tailwindGradientStop = (
   stop: ColorStop,
   parentOpacity: number = 1.0,
 ): string => {
-  const { colorName } = getColorInfo(stop);
+  const { colorName, colorType } = getColorInfo(stop);
+
+  // Don't add opacity modifier for variable colors - the alpha is already baked
+  // into the variable definition
+  if (colorType === "variable") {
+    return colorName;
+  }
+
   const effectiveOpacity = calculateEffectiveOpacity(stop, parentOpacity);
   const opacity =
     effectiveOpacity !== 1.0 ? `/${nearestOpacity(effectiveOpacity)}` : "";
```

---

### Incident Patch 10: `6fcdcc30` (2026-01-03)
**Commit Message**: Fix styled component inconsistent naming and missing component definition (#246)

* fix: inconsistent styled component variable name

* fix: Add text wrapper definition by calling build

* refactor: declare componentName in CSSCollection

* refactor: remove unreachable conditionals

* refactor: change first parameter of getComponentName to string

* fix: change to assertion(!)

* rollback: Rollback getComponentName

* rollback: Rollback getComponentName to original

* fix: add better fallback

* fix: add fallback condition

**File**: `packages/backend/src/html/htmlDefaultBuilder.ts` (modified, +6/-4)
```diff
@@ -32,6 +32,7 @@ import {
   cssCollection,
   generateUniqueClassName,
   stylesToCSS,
+  getComponentName,
 } from "./htmlMain";
 
 export class HtmlDefaultBuilder {
@@ -523,14 +524,15 @@ export class HtmlDefaultBuilder {
       element = "img";
     }
 
+    const nodeName = (this.node as any).uniqueName || this.node.name;
+
+    const componentName = getComponentName(nodeName, this.cssClassName, element);
+
     cssCollection[this.cssClassName] = {
       styles: cssStyles,
-      nodeName:
-        (this.node as any).uniqueName ||
-        this.node.name?.replace(/[^a-zA-Z0-9]/g, "") ||
-        undefined,
       nodeType: this.node.type,
       element: element,
+      componentName: componentName,
     };
   }
 }
```

**File**: `packages/backend/src/html/htmlMain.ts` (modified, +35/-42)
```diff
@@ -42,9 +42,9 @@ export type HtmlGenerationMode =
 interface CSSCollection {
   [className: string]: {
     styles: string[];
-    nodeName?: string;
     nodeType?: string;
     element?: string; // Base HTML element to use
+    componentName: string; // Required for type safety, only used in styled-components mode
   };
 }
 
@@ -101,16 +101,13 @@ export function stylesToCSS(styles: string[], isJSX: boolean): string[] {
 
 // Get proper component name from node info
 export function getComponentName(
-  node: any,
-  className?: string,
-  nodeType = "div",
+  nodeName: string | undefined,
+  className: string,
+  nodeType: string,
 ): string {
   // Start with Styled prefix
   let name = "Styled";
 
-  // Use uniqueName if available, otherwise use name
-  const nodeName: string = node.uniqueName || node.name;
-
   // Try to use node name first
   if (nodeName && nodeName.length > 0) {
     // Clean up the node name and capitalize first letter
@@ -157,17 +154,12 @@ export function generateStyledComponents(): string {
   const components: string[] = [];
 
   Object.entries(cssCollection).forEach(
-    ([className, { styles, nodeName, nodeType, element }]) => {
+    ([className, { styles, componentName, element, nodeType }]) => {
       // Skip if no styles
       if (!styles.length) return;
 
       // Determine base HTML element - defaults to div
       const baseElement = element || (nodeType === "TEXT" ? "p" : "div");
-      const componentName = getComponentName(
-        { name: nodeName },
-        className,
-        baseElement,
-      );
 
       const styledComponent = `const ${componentName} = styled.${baseElement}\`
   ${styles.join(";\n  ")}${styles.length ? ";" : ""}
@@ -489,31 +481,29 @@ const htmlText = (node: TextNode, settings: HTMLSettings): string => {
 
   // For styled-components mode
   if (mode === "styled-components") {
-    const componentName = layoutBuilder.cssClassName
-      ? getComponentName(node, layoutBuilder.cssClassName, "p")
-      : getComponentName(node, undefined, "p");
+    // Build wrapper to store in cssCollection
+    layoutBuilder.build();
 
-    if (styledHtml.length === 1) {
-      return `\n<${componentName}>${styledHtml[0].text}</${componentName}>`;
-    } else {
-      const content = styledHtml
-        .map((style) => {
-          const tag =
-            style.openTypeFeatures.SUBS === true
-              ? "sub"
-              : style.openTypeFeatures.SUPS === true
-                ? "sup"
-                : "span";
-
-          if (style.componentName) {
-            return `<${style.componentName}>${style.text}</${style.componentName}>`;
-          }
-          return `<${tag}>${style.text}</${tag}>`;
-        })
-        .join("");
-
-      return `\n<${componentName}>${content}</${componentName}>`;
-    }
+    const wrapperComponentName =
+      cssCollection[layoutBuilder.cssClassName!]?.componentName || "div";
+
+    const content = styledHtml
+      .map((style) => {
+        const tag =
+          style.openTypeFeatures.SUBS === true
+            ? "sub"
+            : style.openTypeFeatures.SUPS === true
+              ? "sup"
+              : "span";
+
+        if (style.componentName) {
+          return `<${style.componentName}>${style.text}</${style.componentName}>`;
+        }
+        return `<${tag}>${style.text}</${tag}>`;
+      })
+      .join("");
+
+    return `\n<${wrapperComponentName}>${content}</${wrapperComponentName}>`;
   }
 
   // Standard HTML/CSS approach for HTML, React or Svelte
@@ -640,13 +630,16 @@ const htmlContainer = async (
 
     // For styled-components mode
     if (mode === "styled-components" && builder.cssClassName) {
-      const componentName = getComponentName(node, builder.cssClassName);
+      const componentName = cssCollection[builder.cssClassName].componentName;
 
-      if (children) {
-        return `\n<${componentName}>${indentString(children)}\n</${componentName}>`;
-      } else {
-        return `\n<${componentName} ${src}/>`;
+      if (componentName) {
+        if (children) {
+          return `\n<${componentName}>${indentString(children)}\n</${componentName}>`;
+        } else {
+          return `\n<${componentName} ${src}/>`;
+        }
       }
+      // fallback to standard HTML if no component was created
     }
 
     // Standard HTML approach for HTML, React, or Svelte
```

**File**: `packages/backend/src/html/htmlTextBuilder.ts` (modified, +4/-6)
```diff
@@ -108,20 +108,18 @@ export class HtmlTextBuilder extends HtmlDefaultBuilder {
         // In both modes, use span for text segments to avoid selector conflicts
         const elementTag = "span";
 
+        const componentName = getComponentName(segmentName, className, elementTag);
+
         // Store in cssCollection with consistent metadata
         cssCollection[className] = {
           styles: cssStyles,
-          nodeName: segmentName,
           nodeType: "TEXT",
           element: elementTag,
+          componentName: componentName,
         };
 
         if (mode === "styled-components") {
-          result.componentName = getComponentName(
-            { name: segmentName },
-            className,
-            elementTag,
-          );
+          result.componentName = componentName;
         }
       }
 
```

---

### Incident Patch 11: `88913c2c` (2026-01-03)
**Commit Message**: fix: refactor htmlShadow function to handle multiple shadow effects (#245)

**File**: `packages/backend/src/html/builderImpl/htmlShadow.ts` (modified, +25/-20)
```diff
@@ -16,29 +16,34 @@ export const htmlShadow = (node: BlendMixin): string => {
     );
     // simple shadow from tailwind
     if (shadowEffects.length > 0) {
-      const shadow = shadowEffects[0];
-      let x = 0;
-      let y = 0;
-      let blur = 0;
-      let spread = "";
-      let inner = "";
-      let color = "";
+      const shadows: string[] = [];
 
-      if (shadow.type === "DROP_SHADOW" || shadow.type === "INNER_SHADOW") {
-        x = shadow.offset.x;
-        y = shadow.offset.y;
-        blur = shadow.radius;
-        spread = shadow.spread ? `${shadow.spread}px ` : "";
-        inner = shadow.type === "INNER_SHADOW" ? " inset" : "";
-        color = htmlColor(shadow.color, shadow.color.a);
-      } else if (shadow.type === "LAYER_BLUR") {
-        x = shadow.radius;
-        y = shadow.radius;
-        blur = shadow.radius;
-      }
+      shadowEffects.forEach((shadow) => {
+        let x = 0;
+        let y = 0;
+        let blur = 0;
+        let spread = "";
+        let inner = "";
+        let color = "";
+
+        if (shadow.type === "DROP_SHADOW" || shadow.type === "INNER_SHADOW") {
+          x = shadow.offset.x;
+          y = shadow.offset.y;
+          blur = shadow.radius;
+          spread = shadow.spread ? `${shadow.spread}px ` : "";
+          inner = shadow.type === "INNER_SHADOW" ? " inset" : "";
+          color = htmlColor(shadow.color, shadow.color.a);
+        } else if (shadow.type === "LAYER_BLUR") {
+          x = shadow.radius;
+          y = shadow.radius;
+          blur = shadow.radius;
+        }
+
+        shadows.push(`${x}px ${y}px ${blur}px ${spread}${color}${inner}`);
+      });
 
       // Return box-shadow in the desired format
-      return `${x}px ${y}px ${blur}px ${spread}${color}${inner}`;
+      return shadows.join(", ");
     }
   }
   return "";
```

---

### Incident Patch 12: `c2581aaf` (2025-12-23)
**Commit Message**: fix(backend): jsx compatible with html-entities & curly braces (#243)

**File**: `packages/backend/package.json` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
   },
   "dependencies": {
     "@figma/plugin-typings": "^1.121.0",
+    "html-entities": "^2.6.0",
     "js-base64": "^3.7.8",
     "nanoid": "^5.1.6",
     "react": "19.0.0",
```

**File**: `packages/backend/src/common/parseJSX.ts` (modified, +8/-0)
```diff
@@ -1,3 +1,4 @@
+import { encode } from "html-entities";
 import { numberToFixedString } from "./numToAutoFixed";
 
 export const formatWithJSX = (
@@ -40,3 +41,10 @@ export const formatMultipleJSX = (
     .filter(([key, value]) => value)
     .map(([key, value]) => formatWithJSX(key, isJsx, value!))
     .join(isJsx ? ", " : "; ");
+
+export const escapeJSXText = (text: string): string => {
+  return encode(text, { level: "html5" })
+    // process JSX curly braces
+    .replace(/\{/g, "&#123;")
+    .replace(/\}/g, "&#125;");
+};
```

**File**: `packages/backend/src/html/htmlDefaultBuilder.ts` (modified, +5/-0)
```diff
@@ -62,6 +62,11 @@ export class HtmlDefaultBuilder {
     return this.settings.htmlGenerationMode === "svelte";
   }
 
+  get needsJSXTextEscaping() {
+    const mode = this.settings.htmlGenerationMode;
+    return mode === "jsx" || mode === "styled-components" || mode === "svelte";
+  }
+
   get useStyledComponents() {
     return this.settings.htmlGenerationMode === "styled-components";
   }
```

**File**: `packages/backend/src/html/htmlTextBuilder.ts` (modified, +6/-2)
```diff
@@ -1,4 +1,4 @@
-import { formatMultipleJSX, formatWithJSX } from "../common/parseJSX";
+import { formatMultipleJSX, formatWithJSX, escapeJSXText } from "../common/parseJSX";
 import { HtmlDefaultBuilder } from "./htmlDefaultBuilder";
 import { htmlColorFromFills } from "./builderImpl/htmlColor";
 import {
@@ -70,7 +70,11 @@ export class HtmlTextBuilder extends HtmlDefaultBuilder {
         this.isJSX,
       );
 
-      const charsWithLineBreak = segment.characters.split("\n").join("<br/>");
+      let chars = segment.characters;
+      if (this.needsJSXTextEscaping) {
+        chars = escapeJSXText(chars);
+      }
+      const charsWithLineBreak = chars.split("\n").join("<br/>");
       const result: any = {
         style: styleAttributes,
         text: charsWithLineBreak,
```

**File**: `packages/backend/src/tailwind/tailwindDefaultBuilder.ts` (modified, +4/-0)
```diff
@@ -54,6 +54,10 @@ export class TailwindDefaultBuilder {
     return this.settings.tailwindGenerationMode === "jsx";
   }
 
+  get needsJSXTextEscaping() {
+    return this.isJSX;
+  }
+
   get isTwigComponent() {
     return this.settings.tailwindGenerationMode === "twig" && this.node.type === "INSTANCE"
   }
```

**File**: `packages/backend/src/tailwind/tailwindTextBuilder.ts` (modified, +6/-1)
```diff
@@ -2,6 +2,7 @@ import {
   commonLetterSpacing,
   commonLineHeight,
 } from "../common/commonTextHeightSpacing";
+import { escapeJSXText } from "../common/parseJSX";
 import { tailwindColorFromFills } from "./builderImpl/tailwindColor";
 import {
   pxToFontSize,
@@ -60,7 +61,11 @@ export class TailwindTextBuilder extends TailwindDefaultBuilder {
         .filter(Boolean)
         .join(" ");
 
-      const charsWithLineBreak = segment.characters.split("\n").join("<br/>");
+      let chars = segment.characters;
+      if (this.needsJSXTextEscaping) {
+        chars = escapeJSXText(chars);
+      }
+      const charsWithLineBreak = chars.split("\n").join("<br/>");
       return {
         style: styleClasses,
         text: charsWithLineBreak,
```

**File**: `pnpm-lock.yaml` (modified, +9/-0)
```diff
@@ -175,6 +175,9 @@ importers:
       '@figma/plugin-typings':
         specifier: ^1.121.0
         version: 1.121.0
+      html-entities:
+        specifier: ^2.6.0
+        version: 2.6.0
       js-base64:
         specifier: ^3.7.8
         version: 3.7.8
@@ -2278,6 +2281,9 @@ packages:
   highlightjs-vue@1.0.0:
     resolution: {integrity: sha512-PDEfEF102G23vHmPhLyPboFCD+BkMGu+GuJe2d9/eH4FsCwvgBpnc9n0pGE+ffKdph38s6foEZiEjdgHdzp+IA==}
 
+  html-entities@2.6.0:
+    resolution: {integrity: sha512-kig+rMn/QOVRvr7c86gQ8lWXq+Hkv6CbAH1hLu+RG338StTpE8Z0b44SDVaqVu7HGKf27frdmUYEs9hTUX/cLQ==}
+
   ignore@5.3.2:
     resolution: {integrity: sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==}
     engines: {node: '>= 4'}
@@ -2664,6 +2670,7 @@ packages:
   next@15.5.7:
     resolution: {integrity: sha512-+t2/0jIJ48kUpGKkdlhgkv+zPTEOoXyr60qXe68eB/pl3CMJaLeIGjzp5D6Oqt25hCBiBTt8wEeeAzfJvUKnPQ==}
     engines: {node: ^18.18.0 || ^19.8.0 || >= 20.0.0}
+    deprecated: This version has a security vulnerability. Please upgrade to a patched version. See https://nextjs.org/blog/security-update-2025-12-11 for more details.
     hasBin: true
     peerDependencies:
       '@opentelemetry/api': ^1.1.0
@@ -5193,6 +5200,8 @@ snapshots:
 
   highlightjs-vue@1.0.0: {}
 
+  html-entities@2.6.0: {}
+
   ignore@5.3.2: {}
 
   ignore@7.0.5: {}
```

---

### Incident Patch 13: `427381b1` (2025-10-21)
**Commit Message**: Hotfix(textBuilder): remove custom font (#237)

**File**: `packages/backend/src/tailwind/tailwindTextBuilder.ts` (modified, +0/-3)
```diff
@@ -126,9 +126,6 @@ export class TailwindTextBuilder extends TailwindDefaultBuilder {
     if (config.fontFamily.mono.includes(fontName.family)) {
       return "font-mono";
     }
-    if (config.fontFamily.display.includes(fontName.family)) {
-      return "font-display";
-    }
     const underscoreFontName = fontName.family.replace(/\s/g, "_");
 
     return "font-['" + underscoreFontName + "']";
```

---

### Incident Patch 14: `452478c9` (2025-10-20)
**Commit Message**: Add(textBuilder): support truncate (#235)

**File**: `packages/backend/src/tailwind/tailwindTextBuilder.ts` (modified, +17/-0)
```diff
@@ -55,6 +55,7 @@ export class TailwindTextBuilder extends TailwindDefaultBuilder {
         // textIndentStyle,
         blurStyle,
         shadowStyle,
+        this.truncateText(node),
       ]
         .filter(Boolean)
         .join(" ");
@@ -68,6 +69,19 @@ export class TailwindTextBuilder extends TailwindDefaultBuilder {
     });
   }
 
+  truncateText = (
+    node: TextNode, 
+  ) => {
+    if (node.textTruncation !== "DISABLED" && node.maxLines) {
+      if (node.maxLines > 0 && node.maxLines < 7) {
+        return `line-clamp-${node.maxLines}`
+      } else {
+        return `line-clamp-[${node.maxLines}]`
+      }
+    }
+    return "";
+  };
+
   getTailwindColorFromFills = (
     fills: ReadonlyArray<Paint> | PluginAPI["mixed"],
   ) => {
@@ -112,6 +126,9 @@ export class TailwindTextBuilder extends TailwindDefaultBuilder {
     if (config.fontFamily.mono.includes(fontName.family)) {
       return "font-mono";
     }
+    if (config.fontFamily.display.includes(fontName.family)) {
+      return "font-display";
+    }
     const underscoreFontName = fontName.family.replace(/\s/g, "_");
 
     return "font-['" + underscoreFontName + "']";
```

---

### Incident Patch 15: `4f2e7007` (2025-09-02)
**Commit Message**: fix wrong lineHeight convertion (#229)

**File**: `packages/backend/src/tailwind/tailwindConfig.ts` (modified, +8/-10)
```diff
@@ -78,16 +78,14 @@ const fontSize = {
 };
 
 const lineHeight = {
-  0.75: "3",
-  1: "none",
-  1.25: "tight",
-  1.375: "snug",
-  1.5: "normal",
-  1.625: "relaxed",
-  2: "loose",
-  1.75: "7",
-  2.25: "9",
-  2.5: "10",
+  0.75: "3",    // 0.75rem
+  1: "4",       // 1rem  
+  1.25: "5",    // 1.25rem
+  1.5: "6",     // 1.5rem
+  1.75: "7",    // 1.75rem
+  2: "8",       // 2rem
+  2.25: "9",    // 2.25rem
+  2.5: "10",    // 2.5rem
 };
 
 const letterSpacing = {
```

#### Recent Merged Pull Requests:
- **PR #263** (closed): feat: Export selection as a Design Bundle (JSON + assets) (@AvetosDesign)
- **PR #257** (closed): Angular Version of the Twig variant. (@ricardoPardoBicnet)
- **PR #251** (closed): Bump next from 15.5.7 to 15.5.14 (@dependabot[bot])
- **PR #250** (2026-02-04): fix: don't add opacity modifier for variable colors (@michaelgold3n)
- **PR #248** (closed): Bump next from 15.5.7 to 16.1.5 (@dependabot[bot])
- **PR #247** (closed): Implement basic snapshot testing framework (@a3626a)
- **PR #246** (2026-01-03): Fix styled component inconsistent naming and missing component definition (@a3626a)
- **PR #245** (2026-01-03): Fix htmlShadow function to handle multiple shadow effects (@a3626a)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
