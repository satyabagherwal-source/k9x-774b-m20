# Forensic Learning Record (Deep Inspection): antvis/mcp-server-chart

> **Canonical Artifact**: `07_PROJECT_LEARNING/antvis-mcp-server-chart-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/antvis/mcp-server-chart](https://github.com/antvis/mcp-server-chart))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:29:04.333Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `antvis/mcp-server-chart`
- **Description**: 🤖 A visualization mcp & skills contains 25+ visual charts using @antvis. Using for chart generation and data analysis.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4389 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils/callTool.ts`
```
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as Charts from "../charts";
import { generateChartUrl, generateMap } from "./generate";
import { logger } from "./logger";
import { ValidateError } from "./validator";

// Chart type mapping
const CHART_TYPE_MAP = {
  generate_area_chart: "area",
  generate_bar_chart: "bar",
  generate_boxplot_chart: "boxplot",
  generate_column_chart: "column",
  generate_district_map: "district-map",
  generate_dual_axes_chart: "dual-axes",
  generate_fishbone_diagram: "fishbone-diagram",
  generate_flow_diagram: "flow-diagram",
  generate_funnel_chart: "funnel",
  generate_histogram_chart: "histogram",
  generate_line_chart: "line",
  generate_liquid_chart: "liquid",
  generate_mind_map: "mind-map",
  generate_network_graph: "network-graph",
  generate_organization_chart: "organization-chart",
  generate_path_map: "path-map",
  generate_pie_chart: "pie",
  generate_pin_map: "pin-map",
  generate_radar_chart: "radar",
  generate_sankey_chart: "sankey",
  generate_scatter_chart: "scatter",
  generate_treemap_chart: "treemap",
  generate_venn_chart: "venn",
  generate_violin_chart: "violin",
  generate_waterfall_chart: "waterfall",
  generate_word_cloud_chart: "word-cloud",
  generate_spreadsheet: "spreadsheet",
} as const;

// Pre-compile Zod schemas at module load time to avoid recompiling on every request.
// biome-ignore lint/suspicious/noExplicitAny: schema types vary per chart
const COMPILED_SCHEMA_CACHE = new Map<string, z.ZodObject<any>>();
for (const chartType of Object.values(CHART_TYPE_MAP)) {
  const schema = Charts[chartType as keyof typeof Charts]?.schema;
  if (schema) {
    COMPILED_SCHEMA_CACHE.set(chartType, z.object(schema));
  }
}

/**
 * Call a tool to generate a chart based on the provided name and arguments.
 * @param tool The name of the tool to call, e.g., "generate_area_chart".
 * @param args The arguments for the tool, which should match the expected schema for the chart type.
 * @returns
 */
export async function callTool(tool: string, args: object = {}) {
  logger.info(`Calling tool: ${tool}`);
  const chartType = CHART_TYPE_MAP[tool as keyof typeof CHART_TYPE_MAP];

  if (!chartType) {
    logger.error(`Unknown tool: ${tool}`);
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${tool}.`);
  }

  try {
    // Validate input using Zod before sending to API.
    // Use pre-compiled schema from cache to avoid recompiling on every call.
    const compiledSchema = COMPILED_SCHEMA_CACHE.get(chartType);

    if (compiledSchema) {
      // Use safeParse instead of parse and try-catch.
      const result = compiledSchema.safeParse(args);
      if (!result.success) {
        logger.error(`Invalid parameters: ${result.error.message}`);
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameters: ${result.error.message}`,
        );
      }
    }

    const isMapChartTool = [
      "generate_district_map",
      "generate_path_map",
      "generate_pin_map",
    ].includes(tool);

    if (isMapChartTool) {
      // For map charts, we use the generateMap function, and return the mcp result.
      const { metadata, ...result } = await generateMap(tool, args);
      return result;
    }

    const url = await generateChartUrl(chartType, args);
    logger.info(`Generated chart URL: ${url}`);

    return {
      content: [
        {
          type: "text",
          text: url,
        },
      ],
      _meta: {
        description:
          "The content returned by MCP is the remote image URL of the visualization chart, which can be rendered using Markdown or HTML image tags. The _meta.spec content corresponds to the chart's configuration and spec, which can be rendered using AntV GPT-Vis chart components.",
        spec: { type: chartType, ...args },
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    logger.error(`Failed to generate chart: ${message}.`);
    if (error instanceof McpError) throw error;
    if (error instanceof ValidateError)
      throw new McpError(ErrorCode.InvalidParams, error.message);
    // Return isError content instead of throwing InternalError (-32603).
    // InternalError is treated as a server crash by MCP clients; agents
    // cannot recover from it. Returning isError: true with a descriptive
    // message lets agents self-correct (e.g., fix their input and retry).
    return {
      content: [
        {
          type: "text",
          text: `Failed to generate chart: ${message}. Please check that the data matches the expected format for this chart type.`,
        },
      ],
      isError: true,
    };
  }
}

```

### Core Architecture Module: `src/utils/env.ts`
```
import process from "node:process";

/**
 * Get the VIS_REQUEST_SERVER from environment variables.
 */
export function getVisRequestServer() {
  return (
    process.env.VIS_REQUEST_SERVER ||
    "https://antv-studio.alipay.com/api/gpt-vis"
  );
}

/**
 * Get the `SERVICE_ID` from environment variables.
 */
export function getServiceIdentifier() {
  return process.env.SERVICE_ID;
}

/**
 * Get the list of disabled tools from environment variables.
 */
export function getDisabledTools(): string[] {
  const disabledTools = process.env.DISABLED_TOOLS;
  if (!disabledTools || disabledTools === "undefined") {
    return [];
  }
  return disabledTools.split(",");
}

```

### Core Architecture Module: `src/utils/generate.ts`
```
import http from "node:http";
import https from "node:https";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { getServiceIdentifier, getVisRequestServer } from "./env";

/**
 * Persistent axios instance with HTTP keep-alive to reuse TCP connections
 * across requests, reducing overhead under high concurrency.
 */
const httpClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Generate a chart URL using the provided configuration.
 * @param type The type of chart to generate
 * @param options Chart options
 * @returns {Promise<string>} The generated chart URL.
 * @throws {Error} If the chart generation fails.
 */
export async function generateChartUrl(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  options: Record<string, any>,
): Promise<string> {
  const url = getVisRequestServer();

  const response = await httpClient.post(url, {
    type,
    ...options,
    source: "mcp-server-chart",
  });
  const { success, errorMessage, resultObj } = response.data;

  if (!success) {
    throw new Error(errorMessage);
  }

  return resultObj;
}

type ResponseResult = {
  metadata: unknown;
  /**
   * @docs https://modelcontextprotocol.io/specification/2025-03-26/server/tools#tool-result
   */
  content: CallToolResult["content"];
  isError?: CallToolResult["isError"];
};

/**
 * Generate a map
 * @param tool - The tool name
 * @param input - The input
 * @returns
 */
export async function generateMap(
  tool: string,
  input: unknown,
): Promise<ResponseResult> {
  const url = getVisRequestServer();

  const response = await httpClient.post(url, {
    serviceId: getServiceIdentifier(),
    tool,
    input,
    source: "mcp-server-chart",
  });
  const { success, errorMessage, resultObj } = response.data;

  if (!success) {
    throw new Error(errorMessage);
  }
  return resultObj;
}

```

### Core Architecture Module: `src/utils/index.ts`
```
export { callTool } from "./callTool";
export { generateChartUrl } from "./generate";
export { zodToJsonSchema } from "./schema";

```

### Core Architecture Module: `src/utils/logger.ts`
```
/**
 * Unified logger for consistent logging across the application
 */
const prefix = "[MCP-Server-Chart]";

/**
 * Indicates if the logger is in stdio mode.
 * When true, logs are directed to stderr for info, warn, and success messages, using console.error.
 * When false, logs are directed to stdout.
 */
let IS_STDIO = true;

function setIsStdio(isStdio: boolean): void {
  IS_STDIO = isStdio;
}

function getPrefix(): string {
  const timestamp = new Date().toISOString();
  return `${prefix} ${timestamp}`;
}

/**
 * Log info message
 */
function info(message: string, ...args: unknown[]): void {
  const fn = IS_STDIO ? console.error : console.log;
  fn(`${getPrefix()} ℹ️  ${message}`, ...args);
}

/**
 * Log warning message
 */
function warn(message: string, ...args: unknown[]): void {
  const fn = IS_STDIO ? console.warn : console.log;
  fn(`${getPrefix()} ⚠️  ${message}`, ...args);
}

/**
 * Log error message
 */
function error(message: string, error?: unknown): void {
  console.error(`${getPrefix()} ❌ ${message}`, error || "");
}

/**
 * Log success message
 */
function success(message: string, ...args: unknown[]): void {
  const fn = IS_STDIO ? console.error : console.log;
  fn(`${getPrefix()} ✅ ${message}`, ...args);
}

/**
 * Logger object for backward compatibility
 */
export const logger = {
  info,
  warn,
  error,
  success,
  setIsStdio,
};

```

### Core Architecture Module: `src/utils/schema.ts`
```
import { z } from "zod";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const zodToJsonSchema = (schema: Record<string, z.ZodType<any>>) => {
  return z.object(schema).toJSONSchema({
    io: "input",
    target: "draft-07",
  });
};

```

### Core Architecture Module: `src/utils/validator.ts`
```
/**
 * The Error class for validation errors in zod.
 */
export class ValidateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidateError";
  }
}

// Node and Edge Graph Data Types, recursively defined for validation.
export type NodeEdgeDataType = {
  nodes: Array<{ name: string }>;
  edges: Array<{ name: string; source: string; target: string }>;
};

// Treemap Graph Data Type, recursively defined for validation.
export type TreeDataType = {
  name: string;
  children?: TreeDataType[];
};

/**
 * Valid node name is unique.
 * Valid edge source and target are existing in nodes.
 * Valid edge source edge target pair are unique.
 * @param data
 * @returns boolean
 */
export const validatedNodeEdgeDataSchema = (data: NodeEdgeDataType) => {
  const nodeNames = new Set(data.nodes.map((node) => node.name));
  const uniqueNodeNames = new Set();

  // 1. valid node name is unique
  for (const node of data.nodes) {
    if (uniqueNodeNames.has(node.name)) {
      throw new ValidateError(
        `Invalid parameters: node's name '${node.name}' should be unique.`,
      );
    }
    uniqueNodeNames.add(node.name);
  }

  // 2. valid edge source and target are existing in nodes
  for (const edge of data.edges) {
    if (!nodeNames.has(edge.source)) {
      throw new ValidateError(
        `Invalid parameters: edge's source '${edge.source}' should exist in nodes.`,
      );
    }
    if (!nodeNames.has(edge.target)) {
      throw new ValidateError(
        `Invalid parameters: edge's target '${edge.target}' should exist in nodes.`,
      );
    }
  }

  // 3. valid edge source edge target pair are unique
  const edgePairs = new Set();
  for (const edge of data.edges) {
    const pair = `${edge.source}-${edge.target}`;
    if (edgePairs.has(pair)) {
      throw new ValidateError(
        `Invalid parameters: edge pair '${pair}' should be unique.`,
      );
    }
    edgePairs.add(pair);
  }

  return true;
};

/**
 * Valid TreeData name is unique.
 * @param data
 * @returns boolean
 */
export const validatedTreeDataSchema = (data: TreeDataType) => {
  const node = data;
  const names = new Set<string>();

  // valid node name is unique
  const checkUniqueness = (currentNode: TreeDataType) => {
    if (names.has(currentNode.name)) {
      throw new ValidateError(
        `Invalid parameters: node's name '${currentNode.name}' should be unique.`,
      );
    }
    names.add(currentNode.name);
    if (currentNode.children) {
      for (let i = 0; i < currentNode.children.length; i++) {
        const child = currentNode.children[i];
        checkUniqueness(child as TreeDataType);
      }
    }
  };

  checkUniqueness(node);
  return true;
};

```

### Core Architecture Module: `src/charts/area.ts`
```
import { z } from "zod";
import { zodToJsonSchema } from "../utils";
import {
  AxisXTitleSchema,
  AxisYTitleSchema,
  BackgroundColorSchema,
  HeightSchema,
  PaletteSchema,
  TextureSchema,
  ThemeSchema,
  TitleSchema,
  WidthSchema,
} from "./base";
import { line } from "./line";

// Area chart data schema
const data = z.object({
  time: z.string(),
  value: z.number(),
  group: z.string().optional(),
});

// Area chart input schema
const schema = {
  data: z
    .array(data)
    .describe(
      "Data for area chart, it should be an array of objects, each object contains a `time` field and a `value` field, such as, [{ time: '2015', value: 23 }, { time: '2016', value: 32 }], when stacking is needed for area, the data should contain a `group` field, such as, [{ time: '2015', value: 23, group: 'A' }, { time: '2015', value: 32, group: 'B' }].",
    )
    .nonempty({ message: "Area chart data cannot be empty." }),
  stack: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Whether stacking is enabled. When enabled, area charts require a 'group' field in the data.",
    ),
  style: z
    .object({
      backgroundColor: BackgroundColorSchema,
      palette: PaletteSchema,
      texture: TextureSchema,
      lineWidth: z
        .number()
        .optional()
        .describe("Line width for the lines of chart, such as 4."),
    })
    .optional()
    .describe(
      "Style configuration for the chart with a JSON object, optional.",
    ),
  theme: ThemeSchema,
  width: WidthSchema,
  height: HeightSchema,
  title: TitleSchema,
  axisXTitle: AxisXTitleSchema,
  axisYTitle: AxisYTitleSchema,
};

// Area chart tool descriptor
const tool = {
  name: "generate_area_chart",
  description:
    "Generate a area chart to show data trends under continuous independent variables and observe the overall data trend, such as, displacement = velocity (average or instantaneous) × time: s = v × t. If the x-axis is time (t) and the y-axis is velocity (v) at each moment, an area chart allows you to observe the trend of velocity over time and infer the distance traveled by the area's size.",
  inputSchema: zodToJsonSchema(schema),
  annotations: {
    title: "Generate Area Chart",
    readOnlyHint: true,
  },
};

export const area = {
  schema,
  tool,
};

```

### Core Architecture Module: `src/charts/bar.ts`
```
import { z } from "zod";
import { zodToJsonSchema } from "../utils";
import {
  AxisXTitleSchema,
  AxisYTitleSchema,
  BackgroundColorSchema,
  HeightSchema,
  PaletteSchema,
  TextureSchema,
  ThemeSchema,
  TitleSchema,
  WidthSchema,
} from "./base";

// Bar chart data schema
const data = z.object({
  category: z.string(),
  value: z.number(),
  group: z.string().optional(),
});

// Bar chart input schema
const schema = {
  data: z
    .array(data)
    .describe(
      "Data for bar chart, such as, [{ category: '分类一', value: 10 }, { category: '分类二', value: 20 }], when grouping or stacking is needed for bar, the data should contain a `group` field, such as, when [{ category: '北京', value: 825, group: '油车' }, { category: '北京', value: 1000, group: '电车' }].",
    )
    .nonempty({ message: "Bar chart data cannot be empty." }),
  group: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Whether grouping is enabled. When enabled, bar charts require a 'group' field in the data. When `group` is true, `stack` should be false.",
    ),
  stack: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether stacking is enabled. When enabled, bar charts require a 'group' field in the data. When `stack` is true, `group` should be false.",
    ),
  style: z
    .object({
      backgroundColor: BackgroundColorSchema,
      palette: PaletteSchema,
      texture: TextureSchema,
    })
    .optional()
    .describe(
      "Style configuration for the chart with a JSON object, optional.",
    ),
  theme: ThemeSchema,
  width: WidthSchema,
  height: HeightSchema,
  title: TitleSchema,
  axisXTitle: AxisXTitleSchema,
  axisYTitle: AxisYTitleSchema,
};

// Bar chart tool descriptor
const tool = {
  name: "generate_bar_chart",
  description:
    "Generate a horizontal bar chart to show data for numerical comparisons among different categories, such as, comparing categorical data and for horizontal comparisons.",
  inputSchema: zodToJsonSchema(schema),
  annotations: {
    title: "Generate Bar Chart",
    readOnlyHint: true,
  },
};

export const bar = {
  schema,
  tool,
};

```

### Core Architecture Module: `src/charts/base.ts`
```
import { z } from "zod";

// Define Zod schemas for base configuration properties
export const ThemeSchema = z
  .enum(["default", "academy", "dark"])
  .optional()
  .default("default")
  .describe("Set the theme for the chart, optional, default is 'default'.");

export const BackgroundColorSchema = z
  .string()
  .optional()
  .describe("Background color of the chart, such as, '#fff'.");

export const PaletteSchema = z
  .array(z.string())
  .optional()
  .describe("Color palette for the chart, it is a collection of colors.");

export const TextureSchema = z
  .enum(["default", "rough"])
  .optional()
  .default("default")
  .describe(
    "Set the texture for the chart, optional, default is 'default'. 'rough' refers to hand-drawn style.",
  );
export const StartAtZeroSchema = z
  .boolean()
  .optional()
  .default(false)
  .describe("Whether to start the axis at zero, optional, default is false.");

export const WidthSchema = z
  .number()
  .optional()
  .default(600)
  .describe("Set the width of chart, default is 600.");

export const HeightSchema = z
  .number()
  .optional()
  .default(400)
  .describe("Set the height of chart, default is 400.");

export const TitleSchema = z
  .string()
  .optional()
  .default("")
  .describe("Set the title of chart.");

export const AxisXTitleSchema = z
  .string()
  .optional()
  .default("")
  .describe("Set the x-axis title of chart.");

export const AxisYTitleSchema = z
  .string()
  .optional()
  .default("")
  .describe("Set the y-axis title of chart.");

export const NodeSchema = z.object({
  name: z.string(),
});

export const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  name: z.string().optional().default(""),
});

// --- The following are only available for Map charts ---

export const MapTitleSchema = z
  .string()
  .describe(
    "The map title should not exceed 16 characters. The content should be consistent with the information the map wants to convey and should be accurate, rich, creative, and attractive.",
  );

export const MapWidthSchema = z
  .number()
  .optional()
  .default(1600)
  .describe("Set the width of map, default is 1600.");

export const MapHeightSchema = z
  .number()
  .optional()
  .default(1000)
  .describe("Set the height of map, default is 1000.");

export const POIsSchema = z
  .array(z.string())
  .nonempty("At least one POI name is required.")
  .describe(
    'A list of keywords for the names of points of interest (POIs) in Chinese. These POIs usually contain a group of places with similar locations, so the names should be more descriptive, must adding attributives to indicate that they are different places in the same area, such as "北京市" is better than "北京", "杭州西湖" is better than "西湖"; in addition, if you can determine that a location may appear in multiple areas, you can be more specific, such as "杭州西湖的苏堤春晓" is better than "苏堤春晓". The tool will use these keywords to search for specific POIs and query their detailed data, such as latitude and longitude, location photos, etc. For example, ["西安钟楼", "西安大唐不夜城", "西安大雁塔"].',
  );

```

### Core Architecture Module: `src/charts/boxplot.ts`
```
import { z } from "zod";
import { zodToJsonSchema } from "../utils";
import {
  AxisXTitleSchema,
  AxisYTitleSchema,
  BackgroundColorSchema,
  HeightSchema,
  PaletteSchema,
  StartAtZeroSchema,
  TextureSchema,
  ThemeSchema,
  TitleSchema,
  WidthSchema,
} from "./base";

const data = z.object({
  category: z
    .string()
    .describe("Category of the data point, such as '分类一'."),
  value: z.number().describe("Value of the data point, such as 10."),
  group: z
    .string()
    .optional()
    .describe(
      "Optional group for the data point, used for grouping in the boxplot.",
    ),
});

const schema = {
  data: z
    .array(data)
    .describe(
      "Data for boxplot chart, such as, [{ category: '分类一', value: 10 }] or [{ category: '分类二', value: 20, group: '组别一' }].",
    )
    .nonempty({ message: "Boxplot chart data cannot be empty." }),
  style: z
    .object({
      backgroundColor: BackgroundColorSchema,
      palette: PaletteSchema,
      startAtZero: StartAtZeroSchema,
      texture: TextureSchema,
    })
    .optional()
    .describe(
      "Style configuration for the chart with a JSON object, optional.",
    ),
  theme: ThemeSchema,
  width: WidthSchema,
  height: HeightSchema,
  title: TitleSchema,
  axisXTitle: AxisXTitleSchema,
  axisYTitle: AxisYTitleSchema,
};

const tool = {
  name: "generate_boxplot_chart",
  description:
    "Generate a boxplot chart to show data for statistical summaries among different categories, such as, comparing the distribution of data points across categories.",
  inputSchema: zodToJsonSchema(schema),
  annotations: {
    title: "Generate Boxplot Chart",
    readOnlyHint: true,
  },
};

export const boxplot = {
  schema,
  tool,
};

```

### Core Architecture Module: `src/charts/column.ts`
```
import { z } from "zod";
import { zodToJsonSchema } from "../utils";
import {
  AxisXTitleSchema,
  AxisYTitleSchema,
  BackgroundColorSchema,
  HeightSchema,
  PaletteSchema,
  TextureSchema,
  ThemeSchema,
  TitleSchema,
  WidthSchema,
} from "./base";

// Column chart data schema
const data = z.object({
  category: z.string(),
  value: z.number(),
  group: z.string().optional(),
});

// Column chart input schema
const schema = {
  data: z
    .array(data)
    .describe(
      "Data for column chart, such as, [{ category: 'Category A', value: 10 }, { category: 'Category B', value: 20 }], when grouping or stacking is needed for column, the data should contain a 'group' field, such as, [{ category: 'Beijing', value: 825, group: 'Gas Car' }, { category: 'Beijing', value: 1000, group: 'Electric Car' }].",
    )
    .nonempty({ message: "Column chart data cannot be empty." }),
  group: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether grouping is enabled. When enabled, column charts require a 'group' field in the data. When `group` is true, `stack` should be false.",
    ),
  stack: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Whether stacking is enabled. When enabled, column charts require a 'group' field in the data. When `stack` is true, `group` should be false.",
    ),
  style: z
    .object({
      backgroundColor: BackgroundColorSchema,
      palette: PaletteSchema,
      texture: TextureSchema,
    })
    .optional()
    .describe(
      "Style configuration for the chart with a JSON object, optional.",
    ),
  theme: ThemeSchema,
  width: WidthSchema,
  height: HeightSchema,
  title: TitleSchema,
  axisXTitle: AxisXTitleSchema,
  axisYTitle: AxisYTitleSchema,
};

// Column chart tool descriptor
const tool = {
  name: "generate_column_chart",
  description:
    "Generate a column chart, which are best for comparing categorical data, such as, when values are close, column charts are preferable because our eyes are better at judging height than other visual elements like area or angles.",
  inputSchema: zodToJsonSchema(schema),
  annotations: {
    title: "Generate Column Chart",
    readOnlyHint: true,
  },
};

export const column = {
  schema,
  tool,
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #327** (2026-09-20): **What can an agent actually do with mcp-server-chart, and who decides?**
  *Symptoms*: I maintain an open-source project called mnki that puts a verification step in front of an MCP tools/call, so a client can see what an agent was authorised to do before the server runs it. I'm not selling anything today; I'm trying to find out whether "which server can do what, for whom" is a real problem for people who publish servers, or whether I've invented it.  Your DISABLED_TOOLS and VIS_REQUEST_SERVER options are the closest thing I've seen to an answer inside a server: the operator decides which of the 26 chart tools exist at all, and where the rendering goes. What I'd like to understand is what happens in the gap between those two, for example when a team wants some users to generate charts against a private deployment and others not.  If you have 20 minutes I'd like to hear how you think about it and what users ask you. If it's easier to try than to talk: npx mnki-cli scan lists every MCP server configured on a machine and mnki protect --mode observe records what would have been denied without changing anything (https://mnki.com/docs/integrations).  Either way, thank you for mcp-server-chart; the private-deployment path with VIS_REQUEST_SERVER is exactly how enterprise users end up running it.

- **Issue #326** (2026-09-20): **Feature Suggestion: Optional token metering & paid API key support via `neuforge-pay`**
  *Symptoms*: Hi @antvis,  Love the work on `antvis/mcp-server-chart`! As usage grows across AI agent frameworks, server compute costs can start adding up quickly. We've also seen developers report that their autonomous agents accidentally burn through thousands of dollars in a single session because traditional payment rails lack built-in agent guardrails.  Would you be open to adding an optional usage metering & billing decorator using `neuforge-pay`? It acts as a proactive **Spend Firewall** and Merchant of Record for MCP servers. In 3 lines of code, it meters tokens, calculates live LLM COGS, and proactively blocks agent transactions that exceed a strict session budget limit (to prevent surprise bills).  Example Integration: ```python from neuforge_pay import meter_endpoint  @app.get("/v1/query") @meter_endpoint(price_charged_usd=0.05, model_name="claude-3-5-sonnet", session_budget_usd=10.00) async def query_endpoint():     ... ```  Happy to submit a clean PR if this aligns with your roadmap!

- **Issue #324** (2026-09-20): **mcp-drill scan results: 27 tools, 0 output schemas, 0% enforceable contracts**
  *Symptoms*: ## mcp-drill scan — mcp-server-chart 0.8.x  | Metric | Result | |--------|--------| | Protocol | 2025-06-18 | | Tools | 27 | | Output-schema coverage | 0% (0/27) | | Enforceable contracts | 0% (0/27) | | Error handling | 100% (3/3 probes clean) |  ### What this means  mcp-server-chart has the best error handling we've seen — every bad-input probe returns a clean JSON-RPC error. 27 tools, no crashes, no hangs.  The gap is output schemas: none of the 27 tools declare an `outputSchema`, so downstream agents have no way to validate whether a chart response is structurally correct before rendering or acting on it. For a visualization server this matters — an agent passing a malformed chart spec to a renderer could produce silent failures.  ### Why this matters for chart generation  Chart tools return structured data (SVG, config objects, data specs). Adding `outputSchema` with specific property constraints would let agents validate that a chart response contains the expected format, dimensions, and data bindings — before rendering.  ### How we tested  [mcp-drill](https://github.com/TimurRakhmatullin86/mcp-drill) is an open-source MCP testing harness (no LLM needed). It probes fault handling and schema hygiene across the MCP protocol.  ``` pip install mcp-drill mcp-drill scan -- npx -y @antv/mcp-server-chart@latest ```  Full methodology: Apache-2.0, 14 tests, deterministic and reproducible.  Happy to help draft schemas for the most commonly used tools if useful.

- **Issue #323** (2026-09-20): **All 27 tools crash (not a structured error) on missing-required or wrong-type input**
  *Symptoms*: ## Summary  All 27 generation tools (`generate_bar_chart`, `generate_line_chart`, `generate_pie_chart`, etc. — full list below) return a raw internal error instead of a clean, structured MCP tool error when called with realistic bad input: a missing required field, or a field of the wrong type. These are exactly the kinds of mistakes a real LLM agent can make (a hallucinated missing or wrong-typed argument), not edge-case or adversarial input.  Found with [mcp-fuzz](https://github.com/vishalhabib99/mcp-fuzz), a tool that calls each of a server's tools with inputs derived from its own declared JSON schema and checks whether the server handles missing-required/wrong-type cases with a structured error rather than crashing. Across all 27 tools: 133 of 214 such calls came back as a raw internal exception (JSON-RPC `-32603`) rather than a graceful tool-level error.  ## Reproduction (generate_bar_chart)  - Omit the required `data` array entirely →   ```   Failed to generate chart: Cannot read properties of null (reading 'map')   ``` - Pass `data` as the wrong type (e.g. a number instead of an array) →   ```   Failed to generate chart: e.map is not a function   ``` - Pass `width`/`height` as the wrong type →   ```   Failed to generate chart: Cannot read properties of null (reading '0')   Failed to generate chart: the surface type is not appropriate for the operation   ``` - Pass `title` as the wrong type →   ```   Failed to generate chart: Request failed with status code 500   ```   
  **Post-Mortem & Fix Analysis**:
  > Traced this — looks like it's already fixed on `main` (9fd0bb4 / #292, "return isError instead of throwing InternalError"), just not published yet: npm's latest (`0.9.10`) predates that commit. I built `main` locally and replayed all 4 repro cases above directly over stdio — each now comes back as a structured `isError: true` response instead of a raw -32603. Might just need a fresh npm publish to resolve this for anyone installing via `npx`.
  > What is the input?
  > Sure — here's the exact minimal repro for `generate_bar_chart`. Over stdio, a `tools/call` request:  Missing required `data`: ```json {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_bar_chart","arguments":{"width":600,"height":400}}} ``` → `Failed to generate chart: Cannot read properties of null (reading 'map')`  Wrong-type `data`: ```json {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_bar_chart","arguments":{"data":42,"width":600,"height":400}}} ``` → `Failed to generate chart: e.map is not a function`  Both reproduce with `npx -y @antv/mcp-server-chart@0.9.10` over stdio. Happy to attach the full raw report (all 214 calls across all 27 tools) if that's more useful than picking through these two.

- **Issue #321** (2026-08-27): **Fix broken Smithery badge (returns HTTP 500)**
  *Symptoms*: The Smithery badge in the README is serving **HTTP 500**, so it renders as a broken image:  ``` https://smithery.ai/badge/antvis/mcp-server-chart   ->  500 ```  This isn't specific to this repo — Smithery's badge endpoint is failing across the ecosystem.  **What this PR does:** removes that one dead badge line, and offers ours in its place.  ```markdown [![Listed on Skillselion](https://skillselion.com/badge/mcp/tool/io.github.antvis/mcp-server-chart.svg)](https://skillselion.com/mcp/tool/io.github.antvis/mcp-server-chart) ```  We'd be happy to have ours sit there instead — Skillselion is an independent directory of agent skills and MCP servers, and this project is already listed at https://skillselion.com/mcp/tool/io.github.antvis/mcp-server-chart whether or not you take the badge.  **Entirely your call, and no hard feelings either way:** - Happy for the badge to stay → merge as is. - Prefer the dead badge just gone → say so and I'll amend this to a removal-only change. - Prefer nothing touched → close it, no reply needed.  Only the dead Smithery image was changed. Any other badges in your README were left untouched. 
  **Post-Mortem & Fix Analysis**:
  > <img width="1870" height="548" alt="image" src="https://github.com/user-attachments/assets/7578a1ca-b948-4302-8d42-f459a4e20537" />  the style is not good.
  > fixing it now.. :) and pushing again. thanks !  
  > @hustcc Hi can you please check again? :)  <img width="523" height="72" alt="image" src="https://github.com/user-attachments/assets/c1d4c8cd-7482-409a-8176-6eb3f0d9cfe1" /> 

- **Issue #319** (2026-08-21): **Feature Suggestion: Optional token metering & paid API key support via `neuforge-pay`**
  *Symptoms*: Hi @antvis,  Love the work on `antvis/mcp-server-chart`! As usage grows across AI agent frameworks, server compute costs can start adding up quickly. We've also seen developers report that their autonomous agents accidentally burn through thousands of dollars in a single session because traditional payment rails lack built-in agent guardrails.  Would you be open to adding an optional usage metering & billing decorator using `neuforge-pay`? It acts as a proactive **Spend Firewall** and Merchant of Record for MCP servers. In 3 lines of code, it meters tokens, calculates live LLM COGS, and proactively blocks agent transactions that exceed a strict session budget limit (to prevent surprise bills).  Example Integration: ```python from neuforge_pay import meter_endpoint  @app.get("/v1/query") @meter_endpoint(price_charged_usd=0.05, model_name="claude-3-5-sonnet", session_budget_usd=10.00) async def query_endpoint():     ... ```  Happy to submit a clean PR if this aligns with your roadmap!
  **Post-Mortem & Fix Analysis**:
  > Thanks, but no need, it is free.

- **Issue #317** (2026-08-19): **docs: add mcpindex screened badge**
  *Symptoms*: Hey, ran mcp-server-chart through mcpindex's screening (description-level injection/manipulation check). Came back clean, so added the badge to your README. Advisory signal, not a security cert. Close this if it's not useful, no worries.
  **Post-Mortem & Fix Analysis**:
  > > [!CAUTION] > The consumer version of Gemini Code Assist on GitHub has been sunset. All code review activity has officially ceased. 
  > The position is wrong.

- **Issue #316** (2026-08-21): **Monetize MCP Server Chart with a labeled sponsored line (zero-friction SDK)**
  *Symptoms*: Live, working proof — no screenshot needed, try it yourself: https://getlulu.dev (real API behind the demo, not a mockup).  Hey @antvis — I built a monetization layer for MCP servers: one disclosed `sponsored` data field on a tool response, e.g. "Upgrade to Pro chart themes — 30% off this week." The host model decides whether to render it, on its own judgment — no display instructions anywhere in the contract.  70% CPA to you, fail-open SDK (`npm install lulu-ads`, 150ms timeout, never breaks a call). Integration is one middleware line for FastMCP, or about five lines for anything else. Point your coding agent at https://ads.getlulu.dev/install.md and it can do the whole thing unaided.  Early beta — onboarding the first 10 publishers personally. Want in? 
  **Post-Mortem & Fix Analysis**:
  > Thanks, but it is free.

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

### Incident Patch 1: `9fd0bb46` (2026-04-28)
**Commit Message**: fix: return isError instead of throwing InternalError on chart failures (#292)

**File**: `src/utils/callTool.ts` (modified, +15/-7)
```diff
@@ -108,15 +108,23 @@ export async function callTool(tool: string, args: object = {}) {
     };
     // biome-ignore lint/suspicious/noExplicitAny: <explanation>
   } catch (error: any) {
-    logger.error(
-      `Failed to generate chart: ${error.message || "Unknown error"}.`,
-    );
+    const message = error?.message || "Unknown error";
+    logger.error(`Failed to generate chart: ${message}.`);
     if (error instanceof McpError) throw error;
     if (error instanceof ValidateError)
       throw new McpError(ErrorCode.InvalidParams, error.message);
-    throw new McpError(
-      ErrorCode.InternalError,
-      `Failed to generate chart: ${error?.message || "Unknown error."}`,
-    );
+    // Return isError content instead of throwing InternalError (-32603).
+    // InternalError is treated as a server crash by MCP clients; agents
+    // cannot recover from it. Returning isError: true with a descriptive
+    // message lets agents self-correct (e.g., fix their input and retry).
+    return {
+      content: [
+        {
+          type: "text",
+          text: `Failed to generate chart: ${message}. Please check that the data matches the expected format for this chart type.`,
+        },
+      ],
+      isError: true,
+    };
   }
 }
```

---

### Incident Patch 2: `2c7b5d4a` (2026-02-25)
**Commit Message**: Fix TLS handshake issue in MCP (#271)

* Initial plan

* Fix TLS handshake issue by configuring custom https.Agent with keepAlive for axios

Co-authored-by: hustcc <[REDACTED_EMAIL]>

* Sync generate.ts with main: add httpAgent, consolidate Content-Type header in shared client

Co-authored-by: hustcc <[REDACTED_EMAIL]>

---------

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: hustcc <[REDACTED_EMAIL]>
Co-authored-by: hustcc <[REDACTED_EMAIL]>



---

### Incident Patch 3: `d5da035a` (2026-02-25)
**Commit Message**: Fix TypeError in Docker local deployment (#272)

* Initial plan

* Fix TypeError: upgrade Node.js from 16 to LTS in Docker examples, add engines requirement

Co-authored-by: hustcc <[REDACTED_EMAIL]>

---------

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: hustcc <[REDACTED_EMAIL]>

**File**: `docker/sse/Dockerfile` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-# Use Node.js 16 as the base image
-FROM node:16
+# Use Node.js LTS as the base image (Node.js 18+ required)
+FROM node:lts
 
 # Set workdir
 WORKDIR /app
```

**File**: `docker/streamable/Dockerfile` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-# Use Node.js 16 as the base image
-FROM node:16
+# Use Node.js LTS as the base image (Node.js 18+ required)
+FROM node:lts
 
 # Set workdir
 WORKDIR /app
```

**File**: `package.json` (modified, +3/-0)
```diff
@@ -42,6 +42,9 @@
     "url": "https://antv.antgroup.com/"
   },
   "license": "MIT",
+  "engines": {
+    "node": ">=18"
+  },
   "dependencies": {
     "@modelcontextprotocol/sdk": "^1.25.2",
     "axios": "^1.11.0",
```

---

### Incident Patch 4: `3ba8b96d` (2026-02-25)
**Commit Message**: Fix high CPU usage during concurrent deployments (#273)

* Initial plan

* Reduce CPU usage under high concurrency: keep-alive HTTP connections, cached Zod schemas, cached enabled tools list

Co-authored-by: hustcc <[REDACTED_EMAIL]>

---------

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: hustcc <[REDACTED_EMAIL]>

**File**: `src/server.ts` (modified, +10/-4)
```diff
@@ -46,16 +46,22 @@ export function createServer(): Server {
 
 /**
  * Gets enabled tools based on environment variables.
+ * The result is cached since the tool list does not change at runtime.
  */
+let enabledToolsCache: ReturnType<typeof Object.values> | null = null;
+
 function getEnabledTools() {
+  if (enabledToolsCache) return enabledToolsCache;
+
   const disabledTools = getDisabledTools();
   const allCharts = Object.values(Charts);
 
-  if (disabledTools.length === 0) {
-    return allCharts;
-  }
+  enabledToolsCache =
+    disabledTools.length === 0
+      ? allCharts
+      : allCharts.filter((chart) => !disabledTools.includes(chart.tool.name));
 
-  return allCharts.filter((chart) => !disabledTools.includes(chart.tool.name));
+  return enabledToolsCache;
 }
 
 /**
```

**File**: `src/utils/callTool.ts` (modified, +14/-4)
```diff
@@ -36,6 +36,16 @@ const CHART_TYPE_MAP = {
   generate_spreadsheet: "spreadsheet",
 } as const;
 
+// Pre-compile Zod schemas at module load time to avoid recompiling on every request.
+// biome-ignore lint/suspicious/noExplicitAny: schema types vary per chart
+const COMPILED_SCHEMA_CACHE = new Map<string, z.ZodObject<any>>();
+for (const chartType of Object.values(CHART_TYPE_MAP)) {
+  const schema = Charts[chartType as keyof typeof Charts]?.schema;
+  if (schema) {
+    COMPILED_SCHEMA_CACHE.set(chartType, z.object(schema));
+  }
+}
+
 /**
  * Call a tool to generate a chart based on the provided name and arguments.
  * @param tool The name of the tool to call, e.g., "generate_area_chart".
@@ -53,12 +63,12 @@ export async function callTool(tool: string, args: object = {}) {
 
   try {
     // Validate input using Zod before sending to API.
-    // Select the appropriate schema based on the chart type.
-    const schema = Charts[chartType].schema;
+    // Use pre-compiled schema from cache to avoid recompiling on every call.
+    const compiledSchema = COMPILED_SCHEMA_CACHE.get(chartType);
 
-    if (schema) {
+    if (compiledSchema) {
       // Use safeParse instead of parse and try-catch.
-      const result = z.object(schema).safeParse(args);
+      const result = compiledSchema.safeParse(args);
       if (!result.success) {
         logger.error(`Invalid parameters: ${result.error.message}`);
         throw new McpError(
```

**File**: `src/utils/generate.ts` (modified, +25/-27)
```diff
@@ -1,7 +1,21 @@
+import http from "node:http";
+import https from "node:https";
 import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
 import axios from "axios";
 import { getServiceIdentifier, getVisRequestServer } from "./env";
 
+/**
+ * Persistent axios instance with HTTP keep-alive to reuse TCP connections
+ * across requests, reducing overhead under high concurrency.
+ */
+const httpClient = axios.create({
+  httpAgent: new http.Agent({ keepAlive: true }),
+  httpsAgent: new https.Agent({ keepAlive: true }),
+  headers: {
+    "Content-Type": "application/json",
+  },
+});
+
 /**
  * Generate a chart URL using the provided configuration.
  * @param type The type of chart to generate
@@ -16,19 +30,11 @@ export async function generateChartUrl(
 ): Promise<string> {
   const url = getVisRequestServer();
 
-  const response = await axios.post(
-    url,
-    {
-      type,
-      ...options,
-      source: "mcp-server-chart",
-    },
-    {
-      headers: {
-        "Content-Type": "application/json",
-      },
-    },
-  );
+  const response = await httpClient.post(url, {
+    type,
+    ...options,
+    source: "mcp-server-chart",
+  });
   const { success, errorMessage, resultObj } = response.data;
 
   if (!success) {
@@ -59,20 +65,12 @@ export async function generateMap(
 ): Promise<ResponseResult> {
   const url = getVisRequestServer();
 
-  const response = await axios.post(
-    url,
-    {
-      serviceId: getServiceIdentifier(),
-      tool,
-      input,
-      source: "mcp-server-chart",
-    },
-    {
-      headers: {
-        "Content-Type": "application/json",
-      },
-    },
-  );
+  const response = await httpClient.post(url, {
+    serviceId: getServiceIdentifier(),
+    tool,
+    input,
+    source: "mcp-server-chart",
+  });
   const { success, errorMessage, resultObj } = response.data;
 
   if (!success) {
```

---

### Incident Patch 5: `cb53c470` (2026-01-22)
**Commit Message**: Fix JSON Schema generation error by removing z.undefined() from spreadsheet schema (#260)

* Initial plan

* Fix: Remove z.undefined() from spreadsheet schema to prevent JSON Schema error

Co-authored-by: hustcc <[REDACTED_EMAIL]>

* Add verification test for JSON Schema fix

Co-authored-by: hustcc <[REDACTED_EMAIL]>

---------

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: hustcc <[REDACTED_EMAIL]>

**File**: `__tests__/charts/spreadsheet.json` (modified, +4/-4)
```diff
@@ -19,15 +19,15 @@
               },
               {
                 "type": "null"
-              },
-              {
-                "not": {}
               }
             ]
+          },
+          "propertyNames": {
+            "type": "string"
           }
         },
         "minItems": 1,
-        "description": "Data for spreadsheet, an array of objects where each object represents a row. Keys are column names and values can be string, number, null, or undefined. Such as, [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }]."
+        "description": "Data for spreadsheet, an array of objects where each object represents a row. Keys are column names and values can be string, number, or null. Such as, [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }]."
       },
       "rows": {
         "type": "array",
```

**File**: `docker-compose.test.yaml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+services:
+  mcp-server-chart:
+    build:
+      context: .          
+      dockerfile: Dockerfile
+    image: mcp-server-chart:stable
+    container_name: mcp-server-chart-1
+    environment:
+       - VIS_REQUEST_SERVER=http://localhost:3000/render
+    command: ["node", "build/index.js", "--transport", "streamable", "--port", "1122", "--host", "0.0.0.0"]
+    ports:
+      - "1122:1122"
```

**File**: `src/charts/spreadsheet.ts` (modified, +2/-5)
```diff
@@ -3,10 +3,7 @@ import { zodToJsonSchema } from "../utils";
 import { HeightSchema, WidthSchema } from "./base";
 
 // Spreadsheet data schema - flexible record type
-const data = z.record(
-  z.string(),
-  z.union([z.string(), z.number(), z.null(), z.undefined()]),
-);
+const data = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
 
 // Spreadsheet theme schema
 const SpreadsheetThemeSchema = z
@@ -22,7 +19,7 @@ const schema = {
   data: z
     .array(data)
     .describe(
-      "Data for spreadsheet, an array of objects where each object represents a row. Keys are column names and values can be string, number, null, or undefined. Such as, [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }].",
+      "Data for spreadsheet, an array of objects where each object represents a row. Keys are column names and values can be string, number, or null. Such as, [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }].",
     )
     .nonempty({ message: "Spreadsheet data cannot be empty." }),
   rows: z
```

---

### Incident Patch 6: `69ce5d66` (2025-12-04)
**Commit Message**: Dev/fixed mcp publish (#238)

* fix: use pnpm in release workflow instead of npm

* feat: fixed ci bug

---------

Co-authored-by: duxinyue.dxy <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-2)
```diff
@@ -16,11 +16,10 @@ jobs:
       - name: Checkout
         uses: actions/checkout@v4
 
-      - name: Setup Node
+      - name: Setup Node.js environment
         uses: actions/setup-node@v4
         with:
           node-version: '20'
-          cache: npm
 
       - name: Update server.json version
         run: sed -i "s/{{VERSION}}/$GITHUB_REF_NAME/g" server.json
```

---

### Incident Patch 7: `10330bcc` (2025-11-26)
**Commit Message**: fix: connect error when sse with multiple clients (#233)

* fix: connect error when sse with multiple clients

* chore: lock zod-to-json-schema version

* fix: typo of connect

**File**: `__tests__/server.spec.ts` (modified, +63/-1)
```diff
@@ -75,7 +75,7 @@ describe("MCP Server", () => {
     const transport = new SSEClientTransport(new URL(url), {});
 
     const client = new Client(
-      { name: "stress-client", version: "1.0.0" },
+      { name: "sse-client", version: "1.0.0" },
       { capabilities: {} },
     );
 
@@ -159,4 +159,66 @@ describe("MCP Server", () => {
 
     await killAsync(child);
   });
+
+  it("sse with multiple clients", async () => {
+    const child = await spawnAsync("ts-node", ["./src/index.ts", "-t", "sse"]);
+
+    const url = "http://localhost:1122/sse";
+
+    const transport1 = new SSEClientTransport(new URL(url), {});
+    const client1 = new Client(
+      { name: "sse-client-1", version: "1.0.0" },
+      { capabilities: {} },
+    );
+
+    const transport2 = new SSEClientTransport(new URL(url), {});
+    const client2 = new Client(
+      { name: "sse-client-2", version: "1.0.0" },
+      { capabilities: {} },
+    );
+
+    await Promise.all([
+      client1.connect(transport1),
+      client2.connect(transport2),
+    ]);
+
+    expect((await client1.listTools()).tools.length).toBe(
+      (await client2.listTools()).tools.length,
+    );
+
+    await killAsync(child);
+  });
+
+  it("streamable with multiple clients", async () => {
+    const child = await spawnAsync("ts-node", [
+      "./src/index.ts",
+      "-t",
+      "streamable",
+    ]);
+
+    const url = "http://localhost:1122/mcp";
+
+    const transport1 = new StreamableHTTPClientTransport(new URL(url), {});
+    const client1 = new Client(
+      { name: "streamable-client-1", version: "1.0.0" },
+      { capabilities: {} },
+    );
+
+    const transport2 = new StreamableHTTPClientTransport(new URL(url), {});
+    const client2 = new Client(
+      { name: "streamable-client-2", version: "1.0.0" },
+      { capabilities: {} },
+    );
+
+    await Promise.all([
+      client1.connect(transport1),
+      client2.connect(transport2),
+    ]);
+
+    expect((await client1.listTools()).tools.length).toBe(
+      (await client2.listTools()).tools.length,
+    );
+
+    await killAsync(child);
+  });
 });
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@
     "cors": "^2.8.5",
     "express": "^5.1.0",
     "zod": "^3.25.16",
-    "zod-to-json-schema": "^3.24.5"
+    "zod-to-json-schema": "3.24.6"
   },
   "devDependencies": {
     "@biomejs/biome": "1.9.4",
```

**File**: `src/server.ts` (modified, +1/-2)
```diff
@@ -92,8 +92,7 @@ export async function runSSEServer(
   port = 1122,
   endpoint = "/sse",
 ): Promise<void> {
-  const server = createServer();
-  await startSSEMcpServer(server, endpoint, port, host);
+  await startSSEMcpServer(createServer, endpoint, port, host);
 }
 
 /**
```

**File**: `src/services/sse.ts` (modified, +7/-5)
```diff
@@ -4,22 +4,24 @@ import express, { type Request, type Response } from "express";
 import { logger } from "../utils/logger";
 
 export const startSSEMcpServer = async (
-  server: Server,
+  createServer: () => Server,
   endpoint = "/sse",
   port = 1122,
   host = "localhost",
 ): Promise<void> => {
   const app = express();
   app.use(express.json());
 
-  const transports: Record<string, SSEServerTransport> = {};
+  const connections: Record<string, SSEServerTransport> = {};
 
   app.get(endpoint, async (req: Request, res: Response) => {
+    const server = createServer();
+
     const transport = new SSEServerTransport("/messages", res);
-    transports[transport.sessionId] = transport;
+    connections[transport.sessionId] = transport;
 
     transport.onclose = () => {
-      delete transports[transport.sessionId];
+      delete connections[transport.sessionId];
       logger.info(`SSE Server disconnected: sessionId=${transport.sessionId}`);
     };
 
@@ -34,7 +36,7 @@ export const startSSEMcpServer = async (
       return res.status(400).send("Missing sessionId parameter");
     }
 
-    const transport = transports[sessionId];
+    const transport = connections[sessionId];
     if (!transport) {
       logger.warn(`SSE Server session not found: sessionId=${sessionId}`);
       return res.status(404).send("Session not found");
```

**File**: `vitest.config.ts` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@ const enableCoverage = process.argv.includes("--coverage");
 export default defineConfig({
   resolve: {},
   test: {
-    testTimeout: 20_000,
-    hookTimeout: 20_000,
+    testTimeout: 60_000,
+    hookTimeout: 60_000,
     include: ["__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
     ...(enableCoverage
       ? {
```

---

### Incident Patch 8: `ff0a397c` (2025-10-29)
**Commit Message**: fix: mcp logs error with stdio transport (#223)

* fix: mcp logs error with stdio transport

* test: add coverage and badge

**File**: `.codecov.yml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Setting coverage targets per flag
+coverage:
+  round: down
+  range: 60..90
+  precision: 2
+  status:
+    patch: off
+    project:
+      default: off
+      mcp-server-chart:
+        threshold: 1%
+        flags:
+          - mcp-server-chart
+
+flags:
+  mcp-server-chart:
+    paths:
+      # filter the folder(s) you wish to measure by that flag
+      - src
+
+comment:
+  layout: "reach, diff, flags, files"
+  behavior: default
+  require_changes: true # only post the comment if coverage changes
+
+github_checks:
+  annotations: false
+
+flag_management:
+  default_rules:
+    carryforward: false
\ No newline at end of file
```

**File**: `.github/workflows/build.yml` (modified, +7/-1)
```diff
@@ -23,4 +23,10 @@ jobs:
         run: |
           npm install
           npm run build
-          npx vitest --watch=false --testTimeout=20000
+          npx vitest --coverage --watch=false
+
+      - name: Upload coverage reports to Codecov
+        uses: codecov/codecov-action@v5
+        with:
+          token: ${{ secrets.CODECOV_TOKEN }}
+          slug: antvis/mcp-server-chart
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# MCP Server Chart ![](https://badge.mcpx.dev?type=server "MCP Server") [![build](https://github.com/antvis/mcp-server-chart/actions/workflows/build.yml/badge.svg)](https://github.com/antvis/mcp-server-chart/actions/workflows/build.yml) [![npm Version](https://img.shields.io/npm/v/@antv/mcp-server-chart.svg)](https://www.npmjs.com/package/@antv/mcp-server-chart) [![smithery badge](https://smithery.ai/badge/@antvis/mcp-server-chart)](https://smithery.ai/server/@antvis/mcp-server-chart) [![npm License](https://img.shields.io/npm/l/@antv/mcp-server-chart.svg)](https://www.npmjs.com/package/@antv/mcp-server-chart) [![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/antvis/mcp-server-chart)](https://archestra.ai/mcp-catalog/antvis__mcp-server-chart)
+# MCP Server Chart ![](https://badge.mcpx.dev?type=server "MCP Server") [![build](https://github.com/antvis/mcp-server-chart/actions/workflows/build.yml/badge.svg)](https://github.com/antvis/mcp-server-chart/actions/workflows/build.yml) [![npm Version](https://img.shields.io/npm/v/@antv/mcp-server-chart.svg)](https://www.npmjs.com/package/@antv/mcp-server-chart) [![smithery badge](https://smithery.ai/badge/@antvis/mcp-server-chart)](https://smithery.ai/server/@antvis/mcp-server-chart) [![npm License](https://img.shields.io/npm/l/@antv/mcp-server-chart.svg)](https://www.npmjs.com/package/@antv/mcp-server-chart) [![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/antvis/mcp-server-chart)](https://archestra.ai/mcp-catalog/antvis__mcp-server-chart) [![codecov](https://codecov.io/gh/antvis/mcp-server-chart/graph/badge.svg?token=7R98VGO5GL)](https://codecov.io/gh/antvis/mcp-server-chart)
 
 A Model Context Protocol server for generating charts using [AntV](https://github.com/antvis/). We can use this mcp server for _chart generation_ and _data analysis_.
 
```

**File**: `package.json` (modified, +3/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@antv/mcp-server-chart",
   "description": "A Model Context Protocol server for generating charts using AntV. This is a TypeScript-based MCP server that provides chart generation capabilities. It allows you to create various types of charts through MCP tools.",
-  "version": "0.9.2",
+  "version": "0.9.3",
   "main": "build/index.js",
   "types": "build/index.d.ts",
   "exports": {
@@ -14,7 +14,7 @@
     "start": "npx @modelcontextprotocol/inspector node build/index.js",
     "prepare": "husky && npm run build",
     "prepublishOnly": "npm run build",
-    "test": "vitest --testTimeout=20000"
+    "test": "vitest"
   },
   "lint-staged": {
     "*.{ts,js,json}": [
@@ -55,6 +55,7 @@
     "@types/cors": "^2.8.19",
     "@types/express": "^5.0.3",
     "@types/node": "^22.15.21",
+    "@vitest/coverage-v8": "3.2.4",
     "husky": "^9.1.7",
     "lint-staged": "^15.5.2",
     "tsc-alias": "^1.8.16",
```

**File**: `src/index.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,7 @@ import {
   runSSEServer,
   runStdioServer,
 } from "./server";
+import { logger } from "./utils/logger";
 
 // Parse command line arguments
 const { values } = parseArgs({
@@ -57,17 +58,20 @@ Options:
 const transport = values.transport.toLowerCase();
 
 if (transport === "sse") {
+  logger.setIsStdio(false);
   const port = Number.parseInt(values.port as string, 10);
   // Use provided endpoint or default to "/sse" for SSE
   const endpoint = values.endpoint || "/sse";
   const host = values.host || "localhost";
   runSSEServer(host, port, endpoint).catch(console.error);
 } else if (transport === "streamable") {
+  logger.setIsStdio(false);
   const port = Number.parseInt(values.port as string, 10);
   // Use provided endpoint or default to "/mcp" for streamable
   const endpoint = values.endpoint || "/mcp";
   const host = values.host || "localhost";
   runHTTPStreamableServer(host, port, endpoint).catch(console.error);
 } else {
+  logger.setIsStdio(true);
   runStdioServer().catch(console.error);
 }
```

**File**: `src/utils/logger.ts` (modified, +24/-4)
```diff
@@ -3,32 +3,51 @@
  */
 const prefix = "[MCP-Server-Chart]";
 
+/**
+ * Indicates if the logger is in stdio mode.
+ * When true, logs are directed to stderr for info, warn, and success messages, using console.error.
+ * When false, logs are directed to stdout.
+ */
+let IS_STDIO = true;
+
+function setIsStdio(isStdio: boolean): void {
+  IS_STDIO = isStdio;
+}
+
+function getPrefix(): string {
+  const timestamp = new Date().toISOString();
+  return `${prefix} ${timestamp}`;
+}
+
 /**
  * Log info message
  */
 function info(message: string, ...args: unknown[]): void {
-  console.log(`${prefix} ℹ️  ${message}`, ...args);
+  const fn = IS_STDIO ? console.error : console.log;
+  fn(`${getPrefix()} ℹ️  ${message}`, ...args);
 }
 
 /**
  * Log warning message
  */
 function warn(message: string, ...args: unknown[]): void {
-  console.warn(`${prefix} ⚠️  ${message}`, ...args);
+  const fn = IS_STDIO ? console.warn : console.log;
+  fn(`${getPrefix()} ⚠️  ${message}`, ...args);
 }
 
 /**
  * Log error message
  */
 function error(message: string, error?: unknown): void {
-  console.error(`${prefix} ❌ ${message}`, error || "");
+  console.error(`${getPrefix()} ❌ ${message}`, error || "");
 }
 
 /**
  * Log success message
  */
 function success(message: string, ...args: unknown[]): void {
-  console.log(`${prefix} ✅ ${message}`, ...args);
+  const fn = IS_STDIO ? console.error : console.log;
+  fn(`${getPrefix()} ✅ ${message}`, ...args);
 }
 
 /**
@@ -39,4 +58,5 @@ export const logger = {
   warn,
   error,
   success,
+  setIsStdio,
 };
```

**File**: `vitest.config.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { coverageConfigDefaults, defineConfig } from "vitest/config";
+
+const enableCoverage = process.argv.includes("--coverage");
+
+export default defineConfig({
+  resolve: {},
+  test: {
+    testTimeout: 20_000,
+    hookTimeout: 20_000,
+    include: ["__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
+    ...(enableCoverage
+      ? {
+          coverage: {
+            exclude: ["**/build/**", ...coverageConfigDefaults.exclude],
+          },
+        }
+      : {}),
+  },
+});
```

---

### Incident Patch 9: `bd46b3c8` (2025-10-11)
**Commit Message**: Update:Start Docker services with Docker Compose, speed up the docker build process (#209)

* Update:Start Docker services with Docker Compose, removing some unnecessary files during the Docker image build process to speed up the build.

* Update index.ts

Comment out the duplicated host field

* Update:delete duplicate fields

* Refactor host configuration in index.ts

Removed duplicate host configuration and updated structure.

* Clarify comments in docker-compose.yaml

Updated comments in docker-compose.yaml for clarity.

---------

Co-authored-by: hustcc <[REDACTED_EMAIL]>

**File**: `.dockerignore` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+.github/
+.git/
+node_modules/
+dist/
+docker/
+build/
+.vscode/
+.idea/
+.DS_Store
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+lerna-debug.log*
+.pnpm-debug.log*
+coverage/
+*.tgz
+__tests__/
+*.swp
+README.md
+Dockerfile
+docker-compose.yaml
+.dockerignore
+.gitignore
+# LICENSE
\ No newline at end of file
```

**File**: `Dockerfile` (modified, +25/-8)
```diff
@@ -1,18 +1,35 @@
-FROM node:lts-alpine
-
+FROM node:lts-alpine AS base
 WORKDIR /app
 
-# Copy package files
+# Create non-root user
+RUN addgroup -g 1001 -S nodejs && \
+    adduser -S appuser -u 1001 && \
+    chown -R appuser:nodejs /app
+USER appuser
+
+# === Download production environment dependencies ===
+FROM base AS deps
 COPY package*.json ./
+RUN npm install --only=prod --no-audit --no-fund --no-optional --ignore-scripts && \
+    npm cache clean --force
 
-# Install dependencies
-RUN npm install --ignore-scripts
+FROM base AS builder
+COPY package*.json ./
+RUN npm install --no-audit --no-fund --no-optional --ignore-scripts
 
-# Copy application code
-COPY . .
+RUN mkdir -p public
 
-# Build the application
+COPY . .
 RUN npm run build
 
+# === Build final image ===
+FROM base AS final
+COPY --from=deps /app/node_modules ./node_modules
+COPY --from=builder /app/build ./build
+
+COPY --from=builder /app/public ./public
+
+# If use docker-compose to execute this Dockerfile, this EXPOSE is a good choice.
+EXPOSE 1122
 # Command will be provided by smithery.yaml
 CMD ["node", "build/index.js", "-t", "streamable"]
```

**File**: `docker-compose.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+services:
+  mcp-server-chart:
+    build:
+      context: .          # Dockerfile dir
+      dockerfile: Dockerfile
+    image: mcp-server-chart:stable
+    container_name: mcp-server-chart-1
+    # environment:
+    #   - VIS_REQUEST_SERVER=http://127.0.0.1:3000/render  # Notice: You can use AntV's project GPT-Vis-SSR to deploy an HTTP service in a private environment, and then pass the URL address through env VIS_REQUEST_SERVER.
+    command: ["node", "build/index.js", "--transport", "sse", "--port", "1122", "--host", "0.0.0.0"]
+    ports:
+      - "1122:1122"
+# networks:
+#     - internal
```

**File**: `src/index.ts` (modified, +3/-2)
```diff
@@ -15,15 +15,16 @@ const parsed = parseArgs({
       default: "stdio",
     },
     host: {
-      type: "boolean",
+      type: "string",
       short: "h",
-      default: false,
+      default: "localhost",
     },
     port: {
       type: "string",
       short: "p",
       default: "1122",
     },
+    
     endpoint: {
       type: "string",
       short: "e",
```

**File**: `src/server.ts` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ export function createServer(): Server {
 
   setupToolHandlers(server);
 
-  server.onerror = (error) => console.error("[MCP Error]", error);
+  server.onerror = (error: Error) => console.error("[MCP Error]", error);
   process.on("SIGINT", async () => {
     await server.close();
     process.exit(0);
@@ -61,7 +61,7 @@ function setupToolHandlers(server: Server): void {
     tools: getEnabledTools().map((chart) => chart.tool),
   }));
 
-  server.setRequestHandler(CallToolRequestSchema, async (request) => {
+  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
     return await callTool(request.params.name, request.params.arguments);
   });
 }
```

**File**: `src/services/sse.ts` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
 import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
-import express from "express";
+import express, { Request, Response } from "express";
 
 export const startSSEMcpServer = async (
   server: Server,
@@ -13,7 +13,7 @@ export const startSSEMcpServer = async (
 
   const transports: Record<string, SSEServerTransport> = {};
 
-  app.get(endpoint, async (req, res) => {
+  app.get(endpoint, async (req: Request, res: Response) => {
     try {
       const transport = new SSEServerTransport("/messages", res);
       transports[transport.sessionId] = transport;
@@ -25,7 +25,7 @@ export const startSSEMcpServer = async (
     }
   });
 
-  app.post("/messages", async (req, res) => {
+  app.post('/messages', async (req: Request, res: Response) => {
     const sessionId = req.query.sessionId as string;
     if (!sessionId) return res.status(400).send("Missing sessionId parameter");
 
```

**File**: `src/services/streamable.ts` (modified, +4/-4)
```diff
@@ -1,7 +1,7 @@
 import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
 import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
+import express, { Request, Response } from "express";
 import cors from "cors";
-import express from "express";
 
 export const startHTTPStreamableServer = async (
   createServer: () => Server,
@@ -13,7 +13,7 @@ export const startHTTPStreamableServer = async (
   app.use(express.json());
   app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));
 
-  app.post(endpoint, async (req, res) => {
+  app.post(endpoint, async (req: Request, res: Response) => {
     try {
       const server = createServer();
       const transport = new StreamableHTTPServerTransport({
@@ -36,15 +36,15 @@ export const startHTTPStreamableServer = async (
     }
   });
 
-  app.get(endpoint, (req, res) => {
+  app.get(endpoint, (req: Request, res: Response) => {
     res.status(405).json({
       jsonrpc: "2.0",
       error: { code: -32000, message: "Method not allowed" },
       id: null,
     });
   });
 
-  app.delete(endpoint, (req, res) => {
+  app.delete(endpoint, (req: Request, res: Response) => {
     res.status(405).json({
       jsonrpc: "2.0",
       error: { code: -32000, message: "Method not allowed" },
```

---

### Incident Patch 10: `63a036e9` (2025-10-09)
**Commit Message**: fix: order of server connection and request handling (#208)

**File**: `src/services/streamable.ts` (modified, +4/-4)
```diff
@@ -16,12 +16,12 @@ export const startHTTPStreamableServer = async (
     try {
       const server = createServer();
       const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
-      await server.connect(transport);
-      await transport.handleRequest(req, res, req.body);
       res.on('close', () => {
         transport.close();
         server.close();
       });
+      await server.connect(transport);
+      await transport.handleRequest(req, res, req.body);
     } catch (error) {
       if (!res.headersSent) {
         res.status(500).json({
@@ -37,15 +37,15 @@ export const startHTTPStreamableServer = async (
     res.status(405).json({
       jsonrpc: "2.0",
       error: { code: -32000, message: "Method not allowed" },
-      id: null
+      id: null,
     });
   });
 
   app.delete(endpoint, (req, res) => {
     res.status(405).json({
       jsonrpc: "2.0",
       error: { code: -32000, message: "Method not allowed" },
-      id: null
+      id: null,
     });
   });
 
```

---

### Incident Patch 11: `5eb99994` (2025-08-14)
**Commit Message**: fix: histogram schema (#175)

* fix: histogram schema

* chore: 0.8.3

**File**: `__tests__/charts/histogram.json` (modified, +2/-13)
```diff
@@ -14,19 +14,8 @@
         "description": "Data for histogram chart, it should be an array of numbers, such as, [78, 88, 60, 100, 95]."
       },
       "binNumber": {
-        "anyOf": [
-          {
-            "type": "number"
-          },
-          {
-            "not": {}
-          },
-          {
-            "type": "null"
-          }
-        ],
-        "default": null,
-        "description": "Number of intervals to define the number of intervals in a histogram, when not specified, a default value will be used."
+        "type": "number",
+        "description": "Number of intervals to define the number of intervals in a histogram, when not specified, a built-in value will be used."
       },
       "theme": {
         "default": "default",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@antv/mcp-server-chart",
   "description": "A Model Context Protocol server for generating charts using AntV. This is a TypeScript-based MCP server that provides chart generation capabilities. It allows you to create various types of charts through MCP tools.",
-  "version": "0.8.2",
+  "version": "0.8.3",
   "main": "build/index.js",
   "types": "build/index.d.ts",
   "exports": {
```

**File**: `src/charts/histogram.ts` (modified, +2/-3)
```diff
@@ -21,11 +21,10 @@ const schema = {
     )
     .nonempty({ message: "Histogram chart data cannot be empty." }),
   binNumber: z
-    .union([z.number(), z.undefined(), z.null()])
+    .number()
     .optional()
-    .default(null)
     .describe(
-      "Number of intervals to define the number of intervals in a histogram, when not specified, a default value will be used.",
+      "Number of intervals to define the number of intervals in a histogram, when not specified, a built-in value will be used.",
     ),
   style: z
     .object({
```

---

### Incident Patch 12: `b660e8fc` (2025-08-11)
**Commit Message**: fix: remove  in json schema of generate_district_map (#173)

**File**: `__tests__/charts/district-map.json` (modified, +10/-2)
```diff
@@ -72,14 +72,22 @@
               "type": "object",
               "properties": {
                 "name": {
-                  "$ref": "#/properties/data/properties/name"
+                  "description": "Keywords for the Chinese name of an administrative region (must be within China), and must be one of China, province, city, district, or county. The name should be more specific and add attributive descriptions, for example, \"西安市\" is better than \"西安\", \"杭州西湖区\" is better than \"西湖区\". It cannot be a specific place name or a vague name, such as \"其它\".",
+                  "type": "string"
                 },
                 "dataValue": {
                   "type": "string",
                   "description": "Data value, numeric string or enumeration string."
                 },
                 "style": {
-                  "$ref": "#/properties/data/properties/style"
+                  "description": "Style settings.",
+                  "properties": {
+                    "fillColor": {
+                      "description": "Fill color, rgb or rgba format.",
+                      "type": "string"
+                    }
+                  },
+                  "type": "object"
                 }
               },
               "required": ["name"]
```

**File**: `src/utils/schema.ts` (modified, +1/-0)
```diff
@@ -6,5 +6,6 @@ import { zodToJsonSchema as zodToJsonSchemaOriginal } from "zod-to-json-schema";
 export const zodToJsonSchema = (schema: Record<string, z.ZodType<any>>) => {
   return zodToJsonSchemaOriginal(z.object(schema), {
     rejectedAdditionalProperties: undefined,
+    $refStrategy: "none",
   });
 };
```

---

### Incident Patch 13: `5da2a60c` (2025-08-11)
**Commit Message**: fix: fetch is not enable when node < 18 (#171)

**File**: `package.json` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@
   "license": "MIT",
   "dependencies": {
     "@modelcontextprotocol/sdk": "^1.11.4",
+    "axios": "^1.11.0",
     "zod": "^3.25.16",
     "zod-to-json-schema": "^3.24.5"
   },
```

**File**: `src/utils/generate.ts` (modified, +24/-21)
```diff
@@ -1,4 +1,5 @@
 import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
+import axios from "axios";
 import { getServiceIdentifier, getVisRequestServer } from "./env";
 
 /**
@@ -15,19 +16,20 @@ export async function generateChartUrl(
 ): Promise<string> {
   const url = getVisRequestServer();
 
-  const response = await fetch(url, {
-    method: "POST",
-    headers: {
-      "Content-Type": "application/json",
-    },
-    body: JSON.stringify({
+  const response = await axios.post(
+    url,
+    {
       type,
       ...options,
       source: "mcp-server-chart",
-    }),
-  });
-
-  const { success, errorMessage, resultObj } = await response.json();
+    },
+    {
+      headers: {
+        "Content-Type": "application/json",
+      },
+    },
+  );
+  const { success, errorMessage, resultObj } = response.data;
 
   if (!success) {
     throw new Error(errorMessage);
@@ -57,20 +59,21 @@ export async function generateMap(
 ): Promise<ResponseResult> {
   const url = getVisRequestServer();
 
-  const response = await fetch(url, {
-    method: "POST",
-    headers: {
-      "Content-Type": "application/json",
-    },
-    body: JSON.stringify({
-      source: "mcp-server-chart",
+  const response = await axios.post(
+    url,
+    {
       serviceId: getServiceIdentifier(),
       tool,
       input,
-    }),
-  });
-
-  const { success, errorMessage, resultObj } = await response.json();
+      source: "mcp-server-chart",
+    },
+    {
+      headers: {
+        "Content-Type": "application/json",
+      },
+    },
+  );
+  const { success, errorMessage, resultObj } = response.data;
 
   if (!success) {
     throw new Error(errorMessage);
```

---

### Incident Patch 14: `c0a29e55` (2025-07-25)
**Commit Message**: fix palette value (#153)

* fix: default palette

* chore: 0.7.3

**File**: `__tests__/charts/bar.json` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
             "type": "string"
           },
           "palette": {
-            "description": "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
+            "description": "Color palette for the chart, it is a collection of colors.",
             "items": {
               "type": "string"
             },
```

**File**: `__tests__/charts/column.json` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
             "type": "string"
           },
           "palette": {
-            "description": "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
+            "description": "Color palette for the chart, it is a collection of colors.",
             "items": {
               "type": "string"
             },
```

**File**: `__tests__/charts/dual-axes.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
             "type": "string"
           },
           "palette": {
-            "description": "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
+            "description": "Color palette for the chart, it is a collection of colors.",
             "items": {
               "type": "string"
             },
```

**File**: `__tests__/charts/line.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
             "type": "string"
           },
           "palette": {
-            "description": "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
+            "description": "Color palette for the chart, it is a collection of colors.",
             "items": {
               "type": "string"
             },
```

**File**: `__tests__/charts/pie.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
             "type": "string"
           },
           "palette": {
-            "description": "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
+            "description": "Color palette for the chart, it is a collection of colors.",
             "items": {
               "type": "string"
             },
```

**File**: `__tests__/charts/radar.json` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
             "type": "string"
           },
           "palette": {
-            "description": "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
+            "description": "Color palette for the chart, it is a collection of colors.",
             "items": {
               "type": "string"
             },
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@antv/mcp-server-chart",
   "description": "A Model Context Protocol server for generating charts using AntV. This is a TypeScript-based MCP server that provides chart generation capabilities. It allows you to create various types of charts through MCP tools.",
-  "version": "0.7.2",
+  "version": "0.7.3",
   "main": "build/index.js",
   "types": "build/index.d.ts",
   "exports": {
```

**File**: `src/charts/bar.ts` (modified, +1/-3)
```diff
@@ -48,9 +48,7 @@ const schema = {
       palette: z
         .array(z.string())
         .optional()
-        .describe(
-          "Color palette for the chart, such as, ['#1890FF', '#2FC25B'].",
-        ),
+        .describe("Color palette for the chart, it is a collection of colors."),
     })
     .optional()
     .describe("Custom style configuration for the chart."),
```

---

### Incident Patch 15: `a7862912` (2025-07-04)
**Commit Message**: chore: fix typo (#137)

* chore: fix typo

* docs: update

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ This is a TypeScript-based MCP server that provides chart generation capabilitie
 
 ## ✨ Features
 
-Now 20+ charts supported.
+Now 25+ charts supported.
 
 <img width="768" alt="mcp-server-chart preview" src="https://mdn.alipayobjects.com/huamei_qa8qxu/afts/img/A*IyIRQIQHyKYAAAAAgCAAAAgAemJ7AQ/fmt.avif" />
 
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@antv/mcp-server-chart",
-  "description": "A Model Context Protocol server for generating charts using AntV, This is a TypeScript-based MCP server that provides chart generation capabilities. It allows you to create various types of charts through MCP tools.",
+  "description": "A Model Context Protocol server for generating charts using AntV. This is a TypeScript-based MCP server that provides chart generation capabilities. It allows you to create various types of charts through MCP tools.",
   "version": "0.7.1",
   "main": "build/index.js",
   "types": "build/index.d.ts",
```

#### Recent Merged Pull Requests:
- **PR #321** (2026-08-27): Fix broken Smithery badge (returns HTTP 500) (@skillselion)
- **PR #317** (closed): docs: add mcpindex screened badge (@gautamgb)
- **PR #315** (closed): docs: add Autohand Code MCP setup (@igorcosta)
- **PR #314** (closed): test: cover null chart style validation (@ahfoysal)
- **PR #312** (closed): Add MCP Observatory CI (@KryptosAI)
- **PR #311** (closed): Add badge for mcp-customs to README.md (@mcpcustoms)
- **PR #302** (closed): Sec/strip remote rendering (@ccyrene)
- **PR #301** (2026-05-06): feat: add align option to radar chart (@q32757468)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
