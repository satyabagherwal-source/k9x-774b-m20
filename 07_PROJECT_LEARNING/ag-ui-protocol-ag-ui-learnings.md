# Forensic Learning Record (Deep Inspection): ag-ui-protocol/ag-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/ag-ui-protocol-ag-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:14:38.095Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ag-ui-protocol/ag-ui`
- **Description**: AG-UI: the Agent-User Interaction Protocol. Bring Agents into Frontend Applications.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16138 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/client-cli-example/src/agent.ts`
```
import { Agent } from "@mastra/core/agent";
import { MastraAgent } from "@ag-ui/mastra";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { weatherTool } from "./tools/weather.tool";
import { browserTool } from "./tools/browser.tool";

export const agent = new MastraAgent({
  resourceId: "cliExample",
  agent: new Agent({
    id: "ag-ui-agent",
    name: "AG-UI Agent",
    instructions: `
        You are a helpful assistant that runs a CLI application.

        When helping users get weather details for specific locations, respond:
        - Always ask for a location if none is provided.
        - If the location name isn’t in English, please translate it
        - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
        - Include relevant details like humidity, wind conditions, and precipitation
        - Keep responses concise but informative

        Use the weatherTool to fetch current weather data.

        When helping users browse the web, always use a full URL, for example: "https://www.google.com"
        Use the browserTool to browse the web.

  `,
    model: "openai/gpt-4.1-mini",
    tools: { weatherTool, browserTool },
    memory: new Memory({
      storage: new LibSQLStore({
        id: "mastra-cli-example-db",
        url: "file:./mastra.db",
      }),
    }),
  }),
});

```

### Core Architecture Module: `apps/client-cli-example/src/index.ts`
```
import * as readline from "readline";
import { randomUUID } from "@ag-ui/client";
import { agent } from "./agent";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function chatLoop() {
  console.log("🤖 AG-UI chat started! Type your messages and press Enter. Press Ctrl+D to quit.\n");

  return new Promise<void>((resolve) => {
    const promptUser = () => {
      rl.question("> ", async (input) => {
        if (input.trim() === "") {
          promptUser();
          return;
        }
        console.log("");

        rl.pause();

        agent.messages.push({
          id: randomUUID(),
          role: "user",
          content: input.trim(),
        });

        try {
          await agent.runAgent(
            {},
            {
              onTextMessageStartEvent() {
                process.stdout.write("🤖 AG-UI assistant: ");
              },
              onTextMessageContentEvent({ event }) {
                process.stdout.write(event.delta);
              },
              onTextMessageEndEvent() {
                console.log("\n");
              },
              onToolCallStartEvent({ event }) {
                console.log("🔧 Tool call:", event.toolCallName);
              },
              onToolCallArgsEvent({ event }) {
                process.stdout.write(event.delta);
              },
              onToolCallEndEvent() {
                console.log("");
              },
              onToolCallResultEvent({ event }) {
                if (event.content) {
                  console.log("🔍 Tool call result:", event.content);
                }
              },
            },
          );
        } catch (error) {
          console.error("❌ Error running agent:", error);
        }

        rl.resume();
        promptUser();
      });
    };

    rl.on("close", () => {
      console.log("\n👋 Goodbye!");
      resolve();
    });

    promptUser();
  });
}

async function main() {
  await chatLoop();
}

main().catch(console.error);

```

### Core Architecture Module: `apps/client-cli-example/src/tools/browser.tool.ts`
```
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import open from "open";

export const browserTool = createTool({
  id: "browser",
  description: "Browse the web",
  inputSchema: z.object({
    url: z.string().describe("URL to browse"),
  }),
  outputSchema: z.string(),
  execute: async (inputData) => {
    open(inputData.url);
    return `Browsed ${inputData.url}`;
  },
});

```

### Core Architecture Module: `apps/client-cli-example/src/tools/weather.tool.ts`
```
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
  }[];
}
interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async (inputData) => {
    return await getWeather(inputData.location);
  },
});

const getWeather = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Unknown";
}

```

### Core Architecture Module: `apps/dojo/e2e/a2ui-adk-fixtures.ts`
```
/**
 * aimock fixtures for the Google ADK A2UI demos (OSS-158).
 *
 * These emulate what the ADK adapter sees from a REAL Gemini sub-agent under the
 * free-form tool schema: `render_a2ui` returns `components`/`data` as JSON
 * *strings* (not structured arrays/objects), because Gemini's function-calling
 * fills typed `array<object>` args strictly (empty `{}`), so the ADK adapter
 * declares them as STRING and parses them back via `_coerce_freeform_args`.
 * Encoding them as strings here drives that real code path — in contrast to the
 * LangGraph/gpt-4o fixtures (a2ui-recovery-fixtures.ts), which use structured
 * arrays the way OpenAI fills loose schemas.
 *
 * Scoped to Gemini requests (`req.model` ~ "gemini-*") so they never intercept
 * the OpenAI LangGraph demos. Register BEFORE registerA2UIRecoveryFixtures so a
 * Gemini request matches here first; gpt-4o requests fall through.
 *
 * Covers: a2ui_fixed_schema (backend search_flights / search_hotels tools that
 * return a fixed-layout surface), a2ui_dynamic_schema (valid hotel surface) and
 * a2ui_recovery (recover: invalid→valid; exhaust: always invalid).
 */
import type {
  LLMock,
  ChatMessage,
  ChatCompletionRequest,
  ToolDefinition,
} from "@copilotkit/aimock";

const textOf = (content: ChatMessage["content"] | undefined): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text!).join("");
  }
  return "";
};
const allText = (messages: ChatMessage[] = []): string => messages.map((m) => textOf(m.content)).join("\n");
const userText = (messages: ChatMessage[] = []): string =>
  textOf(messages.filter((m) => m.role === "user").pop()?.content);

// Toolkit appends this on a retry (augment_prompt_with_validation_errors).
const RETRY_MARKER = "Previous attempt was invalid";

const isGemini = (req: ChatCompletionRequest) => /gemini/i.test(String(req?.model ?? ""));
const isRecover = (text: string) => /luxury/i.test(text) && !/different cities/i.test(text);
const isExhaust = (text: string) => /broken/i.test(text);
// dynamic_schema hotel prompt ("...comparison of 3 hotels...") — not luxury/broken.
const isHotelCreate = (text: string) => /comparison of 3 hotels/i.test(text);

const ROOT = { id: "root", component: "Row", children: { componentId: "card", path: "/items" }, gap: 16 };
const CARD = {
  id: "card",
  component: "HotelCard",
  name: { path: "name" },
  location: { path: "location" },
  rating: { path: "rating" },
  pricePerNight: { path: "price" },
  action: { event: { name: "book_hotel", context: { hotelName: { path: "name" } } } },
};
const HOTELS = [
  { name: "The Ritz", location: "Paris", rating: 4.8, price: "$450/night" },
  { name: "Holiday Inn", location: "Austin", rating: 4.1, price: "$180/night" },
  { name: "Boutique Loft", location: "Lisbon", rating: 4.6, price: "$320/night" },
];

// Gemini free-form shape: components/data are JSON STRINGS within the args.
// valid → [root, card]; invalid → [root] only (root's child ref `card` is missing).
const renderArgsGemini = (valid: boolean) =>
  JSON.stringify({
    surfaceId: "hotel-comparison",
    components: JSON.stringify(valid ? [ROOT, CARD] : [ROOT]),
    data: JSON.stringify({ items: HOTELS }),
  });

// --- fixed_schema (backend tools) ---------------------------------------
// The main agent calls search_flights / search_hotels directly (no sub-agent).
// These are plain backend tools: the LLM supplies the row data, the ADK tool
// loads the fixed component layout and returns the a2ui_operations envelope.
// Args are structured here (flat arrays of flat objects) — Gemini fills these
// fine, unlike the nested array<object> of the dynamic render_a2ui schema.
const FLIGHTS = [
  {
    id: "1",
    airline: "United Airlines",
    airlineLogo: "https://www.google.com/s2/favicons?domain=united.com&sz=128",
    flightNumber: "UA 123",
    origin: "SFO",
    destination: "JFK",
    date: "Tue, Apr 8",
    departureTime: "8:00 AM",
    arrivalTime: "4:30 PM",
    duration: "5h 30m",
    status: "On Time",
    statusIcon: "https://placehold.co/12/22c55e/22c55e.png",
    price: "$289",
  },
  {
    id: "2",
    airline: "Delta",
    airlineLogo: "https://www.google.com/s2/favicons?domain=delta.com&sz=128",
    flightNumber: "DL 456",
    origin: "SFO",
    destination: "JFK",
    date: "Tue, Apr 8",
    departureTime: "10:00 AM",
    arrivalTime: "6:45 PM",
    duration: "5h 45m",
    status: "On Time",
    statusIcon: "https://placehold.co/12/22c55e/22c55e.png",
    price: "$315",
  },
];
const HOTELS_FIXED = [
  { id: "1", name: "The Manhattan Grand", location: "Downtown Manhattan", rating: 4.5, price: "$350" },
  { id: "2", name: "Downtown Boutique Hotel", location: "SoHo", rating: 4.0, price: "$280" },
];

/**
 * Gemini tool-call ids must be supplied explicitly. aimock's Gemini serializer
 * used to fall back to a generated id (`id: tc.id || generateToolCallId()`); that
 * fallback was dropped before 1.23.1, which emitted no id at all, and 1.24.1
 * restored emission but only for an id the fixture supplies. With no
 * id, ADK's `populate_client_function_call_id()` mints a fresh UUID per SSE
 * event, so partial and final events disagree — the failure that
 * `_extract_lro_id_remap` works around, and only for LRO calls.
 */
const toolCallCounts = new Map<string, number>();
const geminiToolCall = (name: string, args: string) => () => {
  const n = (toolCallCounts.get(name) ?? 0) + 1;
  toolCallCounts.set(name, n);
  return { toolCalls: [{ name, arguments: args, id: `call_${name}_${n}` }] };
};

export function registerA2UIADKFixtures(mockServer: LLMock): void {
  // Reset per registration: the counter is module-level, so without this the
  // suffix would depend on test order, sharding and retries rather than on the
  // conversation.
  toolCallCounts.clear();
  const hasTool = (req: ChatCompletionRequest, name: string) => req.tools?.some((t: ToolDefinition) => t.function.name === name);
  const wantsA2UI = (req: ChatCompletionRequest) =>
    isHotelCreate(userText(req.messages)) || isRecover(userText(req.messages)) || isExhaust(userText(req.messages));

  // 0) fixed_schema — backend search_flights tool (user asks about flights).
  mockServer.addFixture({
    match: {
      predicate: (req: ChatCompletionRequest) =>
        isGemini(req) && hasTool(req, "search_flights") && /flights/i.test(userText(req.messages)),
    },
    response: geminiToolCall("search_flights", JSON.stringify({ flights: FLIGHTS })),
  });

  // 0b) fixed_schema — backend search_hotels tool (user asks about hotels).
  mockServer.addFixture({
    match: {
      predicate: (req: ChatCompletionRequest) =>
        isGemini(req) && hasTool(req, "search_hotels") && /hotels/i.test(userText(req.messages)),
    },
    response: geminiToolCall("search_hotels", JSON.stringify({ hotels: HOTELS_FIXED })),
  });

  // 1) Main ADK agent: A2UI prompt → call the generate_a2ui sub-agent tool.
  mockServer.addFixture({
    match: { predicate: (req: ChatCompletionRequest) => isGemini(req) && hasTool(req, "generate_a2ui") && wantsA2UI(req) },
    response: geminiToolCall("generate_a2ui", JSON.stringify({ intent: "create" })),
  });

  // 2) Sub-agent — dynamic_schema create → valid surface (Gemini-shaped args).
  mockServer.addFixture({
    match: { predicate: (req: ChatCompletionRequest) => isGemini(req) && hasTool(req, "render_a2ui") && isHotelCreate(allText(req.messages)) },
    response: geminiToolCall("render_a2ui", renderArgsGemini(true)),
  });

  // 3) Sub-agent — EXHAUST ("broken"): always the dangling-ref surface (invalid).
  mockServer.addFixture({
    match: { predicate: (req: ChatCompletionRequest) => isGemini(req) && hasTool(req, "render_a2ui") && isExhaust(allText(req.messages)) },
    response: geminiToolCall("render_a2ui", renderArgsGemini(false)),
  });

  // 4) Sub-agent — RECOVER ("luxury"), RETRY (errors fed back) → val
```

### Core Architecture Module: `apps/dojo/e2e/a2ui-crewai-fixtures.ts`
```
/**
 * aimock fixtures for the CrewAI A2UI demos.
 *
 * The CrewAI flows run openai/gpt-5.4 via litellm, so these are structured-arg
 * fixtures (like the LangGraph ones), not the Gemini JSON-string shape. Every
 * predicate is scoped
 * to a phrase unique to the CrewAI e2e prompts ("boutique hotels" for dynamic,
 * "search for flights" / "search for hotels" for fixed) so they never intercept
 * the LangGraph / ADK / Strands / Mastra demos (which use "comparison of 3
 * hotels" and "Find flights" / "Find hotels"). The recovery demo reuses the
 * shared a2ui-recovery-fixtures.ts ("luxury" / "broken").
 *
 * Register via `registerA2UICrewAIFixtures(mockServer)` from aimock-setup.ts.
 */
import type {
  LLMock,
  ChatMessage,
  ChatCompletionRequest,
  ToolDefinition,
} from "@copilotkit/aimock";

const textOf = (content: ChatMessage["content"] | undefined): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("");
  }
  return "";
};
const allText = (messages: ChatMessage[] = []): string =>
  messages.map((m) => textOf(m.content)).join("\n");
const userText = (messages: ChatMessage[] = []): string =>
  textOf(messages.filter((m) => m.role === "user").pop()?.content);
const lastMessage = (messages: ChatMessage[] = []): ChatMessage | undefined =>
  messages[messages.length - 1];

// ---------------------------------------------------------------------------
// Framework scope
//
// The three prompts the CrewAI A2UI e2e specs type. Every predicate below is
// gated on one of them, so nothing in this file can answer another
// integration's A2UI demo (they prompt with "Find flights" / "Find hotels" /
// "a comparison of 3 hotels") even though they register the same tool names.
// The last user message survives a surface-action run unchanged (the action is
// forwarded as tool messages, not as a new user turn), so the same gate scopes
// the action turns too.
// ---------------------------------------------------------------------------
const isFixedFlightPrompt = (text: string) => /search for flights/i.test(text);
const isFixedHotelPrompt = (text: string) => /search for hotels/i.test(text);
const isDynamicPrompt = (text: string) => /boutique hotels/i.test(text);
const isFixedRun = (req: { messages?: ChatMessage[] }) => {
  const text = userText(req.messages);
  return isFixedFlightPrompt(text) || isFixedHotelPrompt(text);
};
const isDynamicRun = (req: { messages?: ChatMessage[] }) =>
  isDynamicPrompt(userText(req.messages));
const isCrewAIA2UIRun = (req: { messages?: ChatMessage[] }) =>
  isFixedRun(req) || isDynamicRun(req);

// ---------------------------------------------------------------------------
// Surface actions
// ---------------------------------------------------------------------------

/** The tool-result line the A2UI middleware synthesizes for a surface action. */
const ACTION_REPORT =
  /^User performed action "([^"]*)" on surface "([^"]*)"(?: \(component: ([^)]*)\))?\. Context: ([\s\S]*)$/;

interface SurfaceAction {
  name: string;
  surfaceId: string;
  context: Record<string, unknown>;
}

const parseActionReport = (text: string): SurfaceAction | null => {
  const parts = ACTION_REPORT.exec(text.trim());
  if (!parts) return null;
  let context: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(parts[4]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      context = parsed as Record<string, unknown>;
    } else {
      console.warn(
        `[a2ui-crewai-fixtures] action "${parts[1]}" forwarded a non-object context; ` +
          `answering generically: ${parts[4]}`,
      );
    }
  } catch {
    // Still an action, so answer it without the detail rather than falling
    // through to another fixture. Logged because a context that stops parsing
    // is a real forwarding regression, and the only other symptom is a vaguer
    // reply that the spec's assertion would blame on the wrong thing.
    console.warn(
      `[a2ui-crewai-fixtures] action "${parts[1]}" forwarded an unparseable context; ` +
        `answering generically: ${parts[4]}`,
    );
  }
  return { name: parts[1], surfaceId: parts[2], context };
};

/**
 * The action a request is being asked to answer, read off the LAST message.
 *
 * Anchoring on the last message rather than the first report in the history is
 * what keeps a second click answering the SECOND choice: the history of a
 * repeat-click run carries every earlier report too.
 */
const pendingAction = (req: {
  messages?: ChatMessage[];
}): SurfaceAction | null => {
  const last = lastMessage(req.messages);
  if (!last || last.role !== "tool") return null;
  return parseActionReport(textOf(last.content));
};

const asText = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;

/**
 * The reply to a surface action, derived from the forwarded action context.
 *
 * Derived, never canned: a hard-coded item name would let the spec pass even if
 * the click of a different card were forwarded, or the wrong tool answered.
 */
const actionReply = (action: SurfaceAction | null): string => {
  const context = action?.context ?? {};
  const price = asText(context.price) ?? asText(context.pricePerNight);
  if (action?.name === "book_flight") {
    const flight = asText(context.flightNumber) ?? "your flight";
    const origin = asText(context.origin);
    const destination = asText(context.destination);
    const route =
      origin && destination ? ` from ${origin} to ${destination}` : "";
    return `You are booked on ${flight}${route}${
      price ? ` for ${price}` : ""
    }. Your itinerary is on its way.`;
  }
  const hotel = asText(context.hotelName) ?? asText(context.name);
  if (!hotel) return "You are booked. Your confirmation is on its way.";
  return `You are booked at ${hotel}${
    price ? ` for ${price} a night` : ""
  }. Your confirmation is on its way.`;
};

/** A CrewAI A2UI surface-action turn: the click report is the pending message. */
const isActionTurn = (req: { messages?: ChatMessage[] }) =>
  isCrewAIA2UIRun(req) && pendingAction(req) !== null;

/**
 * A CrewAI A2UI render follow-up turn: the flow looped the model over the
 * `a2ui_operations` envelope its own search / generation returned.
 */
const isRenderFollowUpTurn = (req: { messages?: ChatMessage[] }) => {
  const last = lastMessage(req.messages);
  return (
    isCrewAIA2UIRun(req) &&
    last?.role === "tool" &&
    /a2ui_operations/.test(textOf(last.content))
  );
};

/**
 * Whether a fixture in THIS file answers the request, for the generic
 * tool-result catch-all in aimock-setup.ts to step aside.
 *
 * Scoped to the CrewAI A2UI prompts on purpose: the replacements live here and
 * nowhere else, so an A2UI turn in any other integration must keep the generic
 * acknowledgment instead of dropping to the universal catch-all.
 */
export const crewAIA2UIAnswersToolResultTurn = (req: {
  messages?: ChatMessage[];
}): boolean => isActionTurn(req) || isRenderFollowUpTurn(req);

const ROOT = {
  id: "root",
  component: "Row",
  children: { componentId: "card", path: "/items" },
  gap: 16,
};
const CARD = {
  id: "card",
  component: "HotelCard",
  name: { path: "name" },
  location: { path: "location" },
  rating: { path: "rating" },
  pricePerNight: { path: "price" },
  action: {
    event: { name: "book_hotel", context: { hotelName: { path: "name" } } },
  },
};
const HOTELS = [
  { name: "The Ritz", location: "Paris", rating: 4.8, price: "$450/night" },
  { name: "Holiday Inn", location: "Austin", rating: 4.1, price: "$180/night" },
  {
    name: "Boutique Loft",
    location: "Lisbon",
    rating: 4.6,
    price: "$320/night",
  },
];
const renderArgs = JSON.stringify({
  surfaceId: "hotel-comparison",
  components: [ROOT, CARD],
  data: { items
```

### Core Architecture Module: `apps/dojo/e2e/a2ui-recovery-fixtures.ts`
```
/**
 * aimock fixtures for the A2UI recovery showcase (OSS-162).
 *
 * Forces a STRUCTURAL error (no catalog needed — caught by structural validation
 * in both the adapter loop and the middleware gate), so it rides the existing
 * runtime A2UI wiring with no schema:
 *   - "luxury hotels" demo → FIRST render_a2ui is a Row whose repeated child
 *     references a `card` component the model forgot to include ("unresolved
 *     child"); once the error is fed back, it emits a valid surface (recovery
 *     succeeds → no wipe, brief "Retrying…", final surface).
 *   - "broken hotels" demo → ALWAYS the dangling-reference surface → recovery
 *     exhausts → tasteful hard-failure (conversation stays usable).
 *
 * IMPORTANT: every predicate is scoped to the recovery demo's own prompts
 * ("luxury" / "broken"). The other A2UI demos (dynamic/fixed/advanced, incl.
 * fixed_schema's "Find hotels") must fall through to their generic fixtures —
 * an over-broad render_a2ui matcher here would hijack them and return THIS
 * surface, breaking every other A2UI test.
 *
 * Wire by calling `registerA2UIRecoveryFixtures(mockServer)` from aimock-setup.ts
 * BEFORE the generic fixture loader (predicate fixtures must come first).
 */
import type {
  LLMock,
  ChatMessage,
  ChatCompletionRequest,
  ToolDefinition,
} from "@copilotkit/aimock";

const textOf = (content: ChatMessage["content"] | undefined): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text!).join("");
  }
  return "";
};
const allText = (messages: ChatMessage[] = []): string => messages.map((m) => textOf(m.content)).join("\n");
const userText = (messages: ChatMessage[] = []): string =>
  textOf(messages.filter((m) => m.role === "user").pop()?.content);

// Marker the toolkit appends to the sub-agent prompt on retry
// (augmentPromptWithValidationErrors). Presence ⇒ this is a retry.
const RETRY_MARKER = "Previous attempt was invalid";

// Only THIS demo's prompts. Keep these distinct from the other A2UI demos so the
// fixtures below never intercept them.
//
// The dynamic_schema "Hotel comparison" prompt — "Compare 3 luxury hotels IN
// DIFFERENT CITIES with ratings and prices." — must SUCCEED with no retries, so
// `isRecover` requires "luxury" but EXCLUDES that "different cities" variant. The
// recovery demo's own prompt ("Compare 3 luxury hotels with ratings and prices.")
// has no "different cities", so only it triggers the recover-then-succeed flow;
// the dynamic_schema prompt falls through to its generic (valid) hotel fixture.
const isRecover = (text: string) => /luxury/i.test(text) && !/different cities/i.test(text);
const isExhaust = (text: string) => /broken/i.test(text); // "Compare 3 broken hotels…" → always invalid → exhaust

// A Row that repeats a "card" template over /items.
const ROOT = { id: "root", component: "Row", children: { componentId: "card", path: "/items" }, gap: 16 };
// The card template the root references. Omitting it from the components array is
// the structural error (dangling child reference → "unresolved child").
const CARD = {
  id: "card",
  component: "HotelCard",
  name: { path: "name" },
  location: { path: "location" },
  rating: { path: "rating" },
  pricePerNight: { path: "price" },
  action: { event: { name: "book_hotel", context: { hotelName: { path: "name" } } } },
};
const HOTELS = [
  { name: "The Ritz", location: "Paris", rating: 4.8, price: "$450/night" },
  { name: "Holiday Inn", location: "Austin", rating: 4.1, price: "$180/night" },
  { name: "Boutique Loft", location: "Lisbon", rating: 4.6, price: "$320/night" },
];
// valid → [root, card]; invalid → [root] only (root's child ref `card` is missing).
const renderArgs = (valid: boolean) =>
  JSON.stringify({ surfaceId: "hotel-comparison", components: valid ? [ROOT, CARD] : [ROOT], data: { items: HOTELS } });

export function registerA2UIRecoveryFixtures(mockServer: LLMock): void {
  const hasTool = (req: ChatCompletionRequest, name: string) => req.tools?.some((t: ToolDefinition) => t.function.name === name);

  // 1) Main agent: recovery prompt → call the generate_a2ui sub-agent tool.
  mockServer.addFixture({
    match: {
      predicate: (req: ChatCompletionRequest) =>
        hasTool(req, "generate_a2ui") && (isRecover(userText(req.messages)) || isExhaust(userText(req.messages))),
    },
    response: { toolCalls: [{ name: "generate_a2ui", arguments: JSON.stringify({ intent: "create" }) }] },
  });

  // 2) Sub-agent — EXHAUSTION demo ("broken hotels"): always the dangling-ref surface.
  //    Checked before the recover fixtures so a "broken" retry stays invalid.
  mockServer.addFixture({
    match: { predicate: (req: ChatCompletionRequest) => hasTool(req, "render_a2ui") && isExhaust(allText(req.messages)) },
    response: { toolCalls: [{ name: "render_a2ui", arguments: renderArgs(false) }] },
  });

  // 3) Sub-agent — RECOVER demo ("luxury hotels"), RETRY (errors fed back) → valid.
  mockServer.addFixture({
    match: {
      predicate: (req: ChatCompletionRequest) =>
        hasTool(req, "render_a2ui") && isRecover(allText(req.messages)) && allText(req.messages).includes(RETRY_MARKER),
    },
    response: { toolCalls: [{ name: "render_a2ui", arguments: renderArgs(true) }] },
  });

  // 4) Sub-agent — RECOVER demo ("luxury hotels"), FIRST attempt (no marker) → invalid.
  mockServer.addFixture({
    match: {
      predicate: (req: ChatCompletionRequest) =>
        hasTool(req, "render_a2ui") && isRecover(allText(req.messages)) && !allText(req.messages).includes(RETRY_MARKER),
    },
    response: { toolCalls: [{ name: "render_a2ui", arguments: renderArgs(false) }] },
  });
}

```

### Core Architecture Module: `apps/dojo/e2e/aimock-setup.ts`
```
import {
  LLMock,
  type ChatCompletionRequest,
  type ChatMessage,
} from "@copilotkit/aimock";
import * as path from "node:path";
import { registerA2UIRecoveryFixtures } from "./a2ui-recovery-fixtures";
import { registerA2UIADKFixtures } from "./a2ui-adk-fixtures";
import {
  crewAIA2UIAnswersToolResultTurn,
  registerA2UICrewAIFixtures,
} from "./a2ui-crewai-fixtures";
import { registerInterruptCrewAIFixtures } from "./interrupt-crewai-fixtures";
import {
  adkInterruptAnswersToolResultTurn,
  registerInterruptADKFixtures,
} from "./interrupt-adk-fixtures";
import {
  registerStrandsWeatherFixtures,
  strandsWeatherResponse,
} from "./strands-weather-fixtures";
import { registerMultiAgentStrandsFixtures } from "./multi-agent-strands-fixtures";
import {
  registerStrandsFixtures,
  strandsAnswersToolResultTurn,
} from "./strands-fixtures";
import {
  deepagentsSubagentsAnswersToolResultTurn,
  registerDeepagentsSubagentsFixtures,
} from "./deepagents-subagents-fixtures";

// Configurable so parallel worktrees / runs don't collide on one aimock port.
const configuredPort = process.env.AIMOCK_PORT;
const MOCK_PORT = configuredPort === undefined ? 5555 : Number(configuredPort);
if (!Number.isInteger(MOCK_PORT) || MOCK_PORT < 1 || MOCK_PORT > 65535) {
  throw new Error("AIMOCK_PORT must be an integer from 1 to 65535");
}
const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures", "openai");

let mockServer: LLMock | null = null;

export async function setupLLMock(): Promise<void> {
  console.log("🔧 Starting aimock server...");

  // Small per-chunk latency prevents crew-ai's asyncio event loop from
  // getting congested by zero-latency streaming (real OpenAI has natural
  // network delays between chunks; LLMock needs to simulate this).
  // Default 5ms keeps crew-ai's asyncio loop healthy. Bump via AIMOCK_LATENCY (e.g. 1500)
  // when running the standalone mock (aimock-standalone.ts) for an interactive recording,
  // so the retrying→hard-failure sequence is watchable.
  mockServer = new LLMock({
    port: MOCK_PORT,
    latency: Number(process.env.AIMOCK_LATENCY) || 5,
  });

  registerLLMockFixtures(mockServer);

  const url = await mockServer.start();
  console.log(`✅ aimock server running at ${url}`);
  console.log(`   Fixtures loaded from: ${FIXTURES_DIR}`);

  // Export the URL for child processes to use
  process.env.LLMOCK_URL = `${url}/v1`;
}

// Shared by the server and registration-precedence regression tests.
export function registerLLMockFixtures(mockServer: LLMock): void {
  // OSS-158 ADK A2UI fixtures (Gemini-shaped, scoped to gemini models). MUST
  // precede the OpenAI LangGraph recovery fixtures so a Gemini request matches
  // here first; gpt-4o requests fall through to the LangGraph fixtures.
  registerA2UIADKFixtures(mockServer);

  // OSS-162 A2UI recovery showcase fixtures (predicate fixtures, must precede
  // the generic loadFixtureFile below).
  registerA2UIRecoveryFixtures(mockServer);

  // CrewAI A2UI fixtures (openai/gpt-5.4, scoped to CrewAI-unique prompts so
  // they never intercept the LangGraph/ADK demos). Predicate fixtures, before
  // the generic loader.
  registerA2UICrewAIFixtures(mockServer);

  // CrewAI interrupt (suspend/resume) fixtures: the extract call before the
  // pause and the confirm call after the resume. Scoped to this flow's own
  // system prompts, before the generic loader.
  registerInterruptCrewAIFixtures(mockServer);

  // Google ADK interrupt (tool confirmation) fixtures: the call that proposes
  // the meeting and the reply to the re-run tool's result. Scoped to Gemini and
  // this demo's own instruction, before the generic loader.
  registerInterruptADKFixtures(mockServer);

  // AWS Strands multi-agent graph: one fixture per node, each scoped to that
  // node's own system prompt. Predicate fixtures, before the generic loader.
  registerMultiAgentStrandsFixtures(mockServer);
  registerDeepagentsSubagentsFixtures(mockServer);

  // AWS Strands interrupt + predictive-state fixtures. Scoped to those demos'
  // own system prompts, before the generic loader.
  registerStrandsFixtures(mockServer);
  registerStrandsWeatherFixtures(mockServer);

  // Extract text from message content — handles both string and array-of-parts
  // (Strands SDK sends content as [{type: "text", text: "..."}])
  const textOf = (content: ChatMessage["content"] | undefined): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text!)
        .join("");
    }
    return "";
  };

  // Google ADK predictive state: the confirm_changes decision reaches the model
  // as user text, one extra turn after approve/reject. Scoped to Gemini plus the
  // demo's own tool, so the text alone never claims another integration's turn.
  const adkConfirmChangesDecision = (req: ChatCompletionRequest) => {
    if (!/gemini/i.test(String(req.model ?? ""))) return null;
    if (!req.tools?.some((t) => t.function.name === "confirm_changes")) {
      return null;
    }
    const last = req.messages[req.messages.length - 1];
    if (last?.role !== "user") return null;
    const text = textOf(last.content);
    if (text === "The user accepted the proposed changes.") return "accepted";
    if (text.startsWith("The user rejected the proposed changes")) {
      return "rejected";
    }
    return null;
  };
  mockServer.addFixture({
    match: {
      endpoint: "chat",
      predicate: (req) => adkConfirmChangesDecision(req) !== null,
    },
    response: (req) => ({
      content:
        adkConfirmChangesDecision(req) === "accepted"
          ? "The changes are applied to the document."
          : "Understood, I left the document as it was.",
    }),
  });

  // LangGraph HITL: the LangGraph agent registers tool `plan_execution_steps`,
  // not `generate_task_steps`. The JSON fixture returns `generate_task_steps`
  // which CopilotKit's useHumanInTheLoop() handles (wrong UI: Confirm/Reject).
  // LangGraph needs the correct tool name so chatNode routes to processStepsNode,
  // which calls interrupt() and triggers useLangGraphInterrupt() (correct UI:
  // Perform Steps). These predicate fixtures MUST come before loadFixtureFile.
  mockServer.addFixture({
    match: {
      predicate: (req) => {
        const lastUser = req.messages.filter((m) => m.role === "user").pop();
        const hasLangGraphTool = req.tools?.some(
          (t) => t.function.name === "plan_execution_steps",
        );
        return (
          !!hasLangGraphTool &&
          textOf(lastUser?.content).includes("one step with eggs")
        );
      },
    },
    response: {
      toolCalls: [
        {
          name: "plan_execution_steps",
          arguments: JSON.stringify({
            steps: [
              { description: "Crack eggs into bowl", status: "enabled" },
              { description: "Preheat oven to 350F", status: "enabled" },
              { description: "Mix and bake for 25 min", status: "enabled" },
            ],
          }),
        },
      ],
    },
  });
  mockServer.addFixture({
    match: {
      predicate: (req) => {
        const lastUser = req.messages.filter((m) => m.role === "user").pop();
        const hasLangGraphTool = req.tools?.some(
          (t) => t.function.name === "plan_execution_steps",
        );
        return (
          !!hasLangGraphTool &&
          textOf(lastUser?.content).includes("Start The Planning")
        );
      },
    },
    response: {
      toolCalls: [
        {
          name: "plan_execution_steps",
          arguments: JSON.stringify({
            steps: [
              { description: "Start The Planning", status: "enabled" },
              { description: "Design spacecraft", status: "enabled" },
              { description: "Launch mission", status: "enabled" },
            ],
          }),
        },
      ],
    },
  });

  // Cla
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2763** (2026-09-15): **[Bug]: @ag-ui/mastra: Make `@copilotkit/runtime` an optional peer dependency**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  ### Problem  `@ag-ui/mastra` currently declares `@copilotkit/runtime` as a required peer dependency:  ```json "peerDependencies": {   "@copilotkit/runtime": "^1.60.1" } ``` However, the base Mastra integration does not use CopilotKit:  ```ts import { MastraAgent } from "@ag-ui/mastra"; ```  The CopilotKit runtime is only imported by the optional `@ag-ui/mastra/copilotkit` entry point, which exposes `registerCopilotKit`.  Because peer dependencies are declared at package level, package managers such as pnpm install or require `@copilotkit/runtime` even when consumers only use the base Mastra integration. Disabling automatic peer installation isn't a good workaround because it also disables installation of the peers required by Mastra and AG-UI.  ### Expected behavior  Consumers using only `@ag-ui/mastra` or `@ag-ui/mastra/a2ui` should not need to install `@copilotkit/runtime`.  Consumers using `@ag-ui/mastra/copilotkit` should install `@copilotkit/runtime` explicitly.  ### Proposed solution  Mark `@copilotkit/runtime` as an optional peer dependency:  ```json "peerDependencies": {   "@ag-ui/core": ">=0.0.58",   "@ag-ui/client": ">=0.0.58",   "@copilotkit/runtime": "^1.60.1",   "@mastra/client-js": ">=1.0.0-0 <2.0.0-0",   "@mastra/core": ">=1.29.0 <2.0.0-0" }, "pe

- **Issue #2744** (2026-09-15): **[Bug]: ag-ui-watsonx __init__ eagerly imports fastapi, breaking FastAPI-free (non-web) installs**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  `fastapi` is declared as an **optional** dependency in the `ag-ui-watsonx` `pyproject.toml`:  ```toml [project.optional-dependencies] fastapi = ["fastapi>=0.115.12"] ```  …but the package's top-level `__init__.py` unconditionally imports the FastAPI endpoint module:  ```python # ag_ui_watsonx/__init__.py from .endpoint import add_watsonx_fastapi_endpoint ```  and `endpoint.py` imports FastAPI at module top:  ```python # ag_ui_watsonx/endpoint.py from fastapi import APIRouter, FastAPI, Request from fastapi.responses import StreamingResponse ```  Because Python evaluates a package's `__init__.py` before any submodule, **any** import from the package fails on a default install (`pip install ag-ui-watsonx`, i.e. without the `[fastapi]` extra). The "optional" dependency is effectively mandatory for every consumer.  Notably, the rest of the package already treats FastAPI as optional:  - `agent.py` only depends on `httpx` + `ag-ui-core` — the adapter itself (`WatsonxAgent.run`) is a FastAPI-free in-process async generator. - `utils.py` already uses `TYPE_CHECKING` + function-level imports for FastAPI.  So the eager import in `__init__.py` looks unintended, and in-process consumers that never touch the HTTP endpoint cannot import the adapter at all.  This is the same r

- **Issue #2656** (2026-09-09): **[Bug]: Java core lacks the reasoning role and message type needed for conversation history**
  *Symptoms*: ### Describe the bug  `com.ag-ui.community:java-core:0.1.0` defines reasoning events but cannot represent a reasoning message in conversation history. A standard AG-UI client stores streamed reasoning as a message with `role: "reasoning"` and includes it in subsequent `RunAgentInput.messages`. The Java core model has no corresponding role or message type, preventing a normal reasoning conversation from completing a client/server round trip.  The omissions are present in the published Maven Central JAR and on current `main` at `ce1bdef573dbab4ad15be62a788e6c8891aa9d48`:  - [`Role`](https://github.com/ag-ui-protocol/ag-ui/blob/ce1bdef573dbab4ad15be62a788e6c8891aa9d48/sdks/community/java/ag-ui/core/src/main/java/com/agui/community/core/message/Role.java#L9-L24) has no `REASONING("reasoning")` value. - The [sealed `Message` interface](https://github.com/ag-ui-protocol/ag-ui/blob/ce1bdef573dbab4ad15be62a788e6c8891aa9d48/sdks/community/java/ag-ui/core/src/main/java/com/agui/community/core/message/Message.java#L13-L14) permits only developer, system, assistant, user, and tool messages. There is no `ReasoningMessage`, and downstream integrations cannot add their own subtype to this sealed hierarchy. - The related [`ReasoningMessageStartEvent`](https://github.com/ag-ui-protocol/ag-ui/blob/ce1bdef573dbab4ad15be62a788e6c8891aa9d48/sdks/community/java/ag-ui/core/src/main/java/com/agui/community/core/event/ReasoningMessageStartEvent.java#L15) has only `messageId`, `timestamp`, and `rawEve

- **Issue #2577** (2026-09-26): **[Bug]: .NET AGUI.Client buffers tool-call updates until all TOOL_CALL_RESULT events arrive**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  ## Summary  `AGUI.Client`'s `IChatClient` adapter does not surface a `FunctionCallContent` update when the corresponding `TOOL_CALL_END` event is received. Instead, it buffers the call until a `TOOL_CALL_RESULT` arrives. With parallel tool calls, it waits until **all** pending results arrive before releasing any of the buffered call/result updates.  This makes long-running backend tools invisible to consumers while they are executing. A UI cannot show an in-progress state: the tool call and result appear together only after execution has completed.  The AG-UI wire stream contains the lifecycle events at the expected times; the observable delay is introduced while converting `BaseEvent` objects into `ChatResponseUpdate` objects.  ### Steps to Reproduce  1. Install `AGUI.Client` 0.0.6 and consume an AG-UI endpoint through `AGUIChatClient.GetStreamingResponseAsync(...)`. 2. Have the endpoint emit a backend tool lifecycle with a noticeable delay before the result:     ```text    RUN_STARTED    TOOL_CALL_START(call_1, slow_tool)    TOOL_CALL_ARGS(call_1, {...})    TOOL_CALL_END(call_1)    # wait several seconds while the tool executes    TOOL_CALL_RESULT(call_1, ...)    RUN_FINISHED    ```  3. Enumerate the returned `ChatResponseUpdate` stream and log the arrival ti
  **Post-Mortem & Fix Analysis**:
  > I opened a focused client fix in https://github.com/ag-ui-protocol/ag-ui/pull/2578.  `TOOL_CALL_END` now yields `FunctionCallContent` immediately, each `TOOL_CALL_RESULT` flushes that call only, and a tool-call interrupt still emits `ToolApprovalRequestContent` after the in-progress call update.

- **Issue #2561** (2026-08-31): **[Bug]: Strands metadata events aren't emitted in**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  In the ag_ui_strands Python package there was a really helpful addition added in https://github.com/ag-ui-protocol/ag-ui/pull/2355 to emit raw events for things that aren't handled.   However due to a conditional for [managing "contentBlockStop" events](https://github.com/ag-ui-protocol/ag-ui/blob/312533723fb550fa26dad4cf120829cf92228550/integrations/aws-strands/python/src/ag_ui_strands/agent.py#L4891-L4894), any events for that have a key of "event" are not included in this raw event output and can't be output.  While many of the things that have an "event" key  are things that are dealt with in other parts of the (e.g. "contentBlockDelta", ""contentBlockStart" and "messageStop") there are at least some that have data that is not output in any other place. For our team this one is metadata which, as we are users of AWS Bedrock Guardrails, seems to be the only place the outputs of these are emitted (as well as token information that could have UI usage).  Most significantly for us is that we're using AWS Bedrock Guardrails as part of our product and we want to change the user interface based on what guardrail triggers. The only event that Strands outputs that contains this data is a metadata event, and this is not information that the AG-UI Strands agent output

- **Issue #2537** (2026-08-26): **[Bug]: : [AWS-Strands] frontend-tool result delivered on a later turn (no immediate continuation) is never reconciled into the SessionManager store**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug   ## Title  `[Bug]: [AWS-Strands] frontend-tool result delivered on a later turn (no immediate continuation) is never reconciled into the SessionManager store`  ---  ## Body  ### Describe the Bug  With a session manager, a frontend (client-executed) tool's real result is only reconciled into the persisted store when it arrives as an **immediate / trailing** continuation. If the result instead arrives on a **later** turn — bundled in history, followed by a new user message — the reconcile skips it and the persisted `toolResult` stays the `"Forwarded to client"` placeholder forever.  Why the later-turn path happens in practice: the adapter finishes a frontend-tool turn with `RUN_FINISHED outcome=success` while the client tool is still unresolved. This causes frameworks like `@assistant-ui/react-ag-ui` to then marks the turn `complete` (not `requires-action`), so it never auto-fires the trailing continuation. The client-executed result therefore only reaches the server on the *next* user turn — the non-trailing case the reconcile ignores.  Net effect is the same store corruption as #2222, on a path #2222's fix doesn't cover. Distinct from #2376/#2511, which fix the *model prompt* on a trailing delta-only continuation: this is about the persisted **store**, and abou
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this. Verified against main at 374f7cd2 — the mechanism is as reported.  The chain: pending_tool_result_ids is built trailing-only at agent.py:2614-2622 (reversed(...) plus else: break). The frontend-result collection is gated on that set at agent.py:2950, so a tool result that is not last in the payload never enters frontend_results. has_nonvoid_frontend_result at agent.py:2985-2987 is therefore False, the reconcile_session_results gate at agent.py:3046-3057 evaluates False, and reconcile_frontend_tool_results at agent.py:3111 never runs for that call. The persisted toolResult keeps PROXY_RESULT_PLACEHOLDER. This is reachable on the default configuration: replay_history_into_strands is True at config.py:167.  On why the trailing scope can be widened safely. The comment at agent.py:2939-2943 gives its reason: historical results "can never be re-corrected and would force the legacy fallback every turn". That concern is already answered one layer down, in two independent
  > @TheSeydiCharyyev / @ranst91  Thanks for taking this up, do you know when this would be available on pypy?
  > @Avinm It's merged into main but not in a released version yet. The aws-strands Python package ships on its own cycle, through a separate PR titled "release: integration-aws-strands-py" — the most recent one was #2404 on Aug 14. I hope the next one will include this fix. 

- **Issue #2516** (2026-09-03): **[BUG]: aws-strands Python URL fetching lacks request-level resource budgets and blocks the event loop**
  *Symptoms*: ## Context  Follow-up to review point 3 on #2491.  #2491 adds a per-attachment response-size cap and socket timeout to the AWS Strands Python URL-content path. Those controls bound one response body, but they do not bound all work performed while converting one request.  ## Problem  The Python adapter currently has no request-level limit on:  - the number of URL-backed attachments; - cumulative downloaded or retained bytes across attachments; or - total wall-clock time spent resolving, connecting, following redirects, and reading responses.  The socket timeout is an inactivity timeout. A server that continues sending data before each timeout can keep the synchronous fetch alive indefinitely. URL fetching also runs synchronously during request preprocessing, so a slow remote source can block the async request loop.  This is an availability and resource-exhaustion risk (CWE-400), even with the per-attachment cap from #2491.  ## Expected behavior  One content-conversion/request operation should have a shared resource budget that is enforced across every URL-backed attachment and every fetch phase. Blocking network work must not run on the async request loop.  ## Acceptance criteria  - A safe default limits the number of URL-backed attachments processed per request. - A cumulative byte budget is shared across all URL-backed attachments; once exhausted, no additional URL fetch begins. - A monotonic total deadline covers DNS resolution, connection, redirects, and body reads across 

- **Issue #2425** (2026-08-26): **[Bug]: ag_ui_strands: every document block is named "document", so a second document permanently breaks a Bedrock conversation**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  `convert_agui_content_to_strands` hardcodes the Bedrock document name:  https://github.com/ag-ui-protocol/ag-ui/blob/main/integrations/aws-strands/python/src/ag_ui_strands/utils.py#L166  ```python blocks.append({     "document": {         "format": fmt,         "name": "document",      # <-- same literal for every document         "source": {"bytes": raw},     } }) ```  Bedrock's Converse API requires document names to be **unique within a request**. With two or more `DocumentInputContent` items, the adapter emits a payload that violates that contract, and Bedrock rejects the whole request:  ``` ValidationException: Messages can't contain duplicate document names. Rename the document and retry your request. ```  Two properties make this worse than a single failed turn:  1. **Converse is stateless** — the full conversation is replayed on every turn. So the second document does not have to be in the same message. A PDF attached in turn 1 and another in turn 8 collide, because both are in turn 8's `messages` array. 2. **The failure is permanent.** Once both documents are in persisted session history, every subsequent turn replays them and fails identically — including plain-text turns with no attachments. The conversation cannot recover; only starting a new thread
  **Post-Mortem & Fix Analysis**:
  > Hi @ag-ui-protocol/copilotkit — could you assign this issue to me?  I've confirmed there is no open PR for this bug and reviewed the current AWS Strands conversion path.  Proposed scope:  - Generate neutral, Bedrock-valid document names from stable AG-UI message/document identity plus a digest, rather than placing raw filenames or metadata in the model-visible name. - Thread the message ID and document ordinal through history conversion so names remain deterministic on replay and distinct across turns, including when two attachments have identical bytes. - Keep a deterministic fallback for direct converter callers that do not provide a message identity. - Add no-AWS regression coverage for multiple documents in one message, documents across different turns, identical content, unsafe/invalid metadata, and the no-metadata fallback.  This keeps the patch focused on #2425 while respecting Bedrock's character/length constraints and neutral-name guidance. If that direction aligns with the ma
  > Hey @green3sf,  Sorry for the slow reply. Taking you up on this one, it's yours.  The part of your scope that matters most is stable names per file across replayed turns rather than positional ones, since that's what actually breaks the thread. One heads up while you're testing: the silent-failure symptom you may run into is #1976, which is separate from this.  Ping me when the PR is up. 
  > Thanks for the fix.  Is there an ETA when a new version for ag-ui-strands will be released?

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

### Incident Patch 1: `60015d51` (2026-09-30)
**Commit Message**: fix(mastra): fail the run on a malformed tool approval answer instead of declining

A tool approval resume now approves only on true or { approved: true } and
declines only on a cancelled entry, a legacy resume of false, or
{ approved: false }. Any other answer fails the run with a RUN_ERROR coded
MASTRA_INVALID_TOOL_APPROVAL before Mastra is called, so the approval stays
pending and can still be answered. Ordinary suspends are unchanged.

**File**: `integrations/mastra/typescript/README.md` (modified, +9/-5)
```diff
@@ -155,12 +155,16 @@ dismisses the card and sends no resume, so the call stays pending in Mastra.
 
 - `{ status: "resolved", payload: { approved: true } }` approves (so does
   `payload: true`).
-- `{ status: "resolved", payload: { approved: false } }` declines, as does any
-  other payload.
+- `{ status: "resolved", payload: { approved: false } }` declines.
 - `{ status: "cancelled" }` declines, whatever payload it carries.
-
-The legacy `forwardedProps.command.resume` approves on `true` or
-`{ approved: true }` and declines otherwise. The bridge then completes the
+- Any other resolved payload (none, `null`, `{}`, `{ approve: true }`,
+  `{ approved: "yes" }`, a string) fails the run with a `RUN_ERROR` coded
+  `MASTRA_INVALID_TOOL_APPROVAL`. Mastra is not called, so the approval stays
+  pending and can still be answered.
+
+The legacy `forwardedProps.command.resume` follows the same rules: `true` or
+`{ approved: true }` approves, `false` or `{ approved: false }` declines, and
+anything else fails the run. The bridge then completes the
 original call, keyed by the snapshot `runId` and `toolCallId`: local agents
 call Mastra's `approveToolCall` or `declineToolCall`, and remote agents call
 `resumeStream({ approved })`, which is what those calls do on the server. The
```

**File**: `integrations/mastra/typescript/src/__tests__/tool-approval.test.ts` (modified, +173/-0)
```diff
@@ -432,6 +432,121 @@ describe("tool approval: resume completes the original call natively", () => {
   });
 });
 
+// Only `true`, `{ approved: boolean }` or a cancelled entry answers an
+// approval. Anything else fails the run before any Mastra call, so a client bug
+// cannot silently decline a call nobody declined.
+function spyOnMastraCalls(fake: FakeLocalAgent) {
+  return [
+    vi.spyOn(fake, "approveToolCall"),
+    vi.spyOn(fake, "declineToolCall"),
+    vi.spyOn(fake, "resumeStream"),
+    vi.spyOn(fake, "stream"),
+  ];
+}
+
+function expectInvalidApproval(error: Error, events: BaseEvent[]) {
+  expect(events.map((e) => e.type)).toEqual([
+    EventType.RUN_STARTED,
+    EventType.RUN_ERROR,
+  ]);
+  expect(error.name).toBe("ResumeRequestError");
+  expect((error as any).code).toBe("MASTRA_INVALID_TOOL_APPROVAL");
+  expect(error.message).toContain("tc-1");
+  expect(events[1]).toEqual({
+    type: EventType.RUN_ERROR,
+    message: error.message,
+    code: "MASTRA_INVALID_TOOL_APPROVAL",
+  });
+}
+
+const MALFORMED_ANSWERS = [
+  ["null", null],
+  ["{}", {}],
+  ["{ approve: true }", { approve: true }],
+  ['{ approved: "yes" }', { approved: "yes" }],
+  ["a string", "ok"],
+] as const;
+
+describe("tool approval: a malformed answer fails the run without calling Mastra", () => {
+  it.each([["no payload", undefined], ...MALFORMED_ANSWERS] as const)(
+    "a canonical resolved entry with %s",
+    async (_label, payload) => {
+      const { agent, fake } = makeLocal({ streamChunks: approvalChunks() });
+      const [interrupt] = outcomeInterrupts(
+        await collectEvents(agent, makeInput()),
+      );
+      const spies = spyOnMastraCalls(fake);
+
+      const { error, events } = await collectRunError(
+        agent,
+        makeInput({
+          runId: "run-2",
+          resume: [
+            {
+              interruptId: interrupt.id,
+              status: "resolved",
+              ...(payload === undefined ? {} : { payload }),
+            },
+          ],
+        } as any),
+      );
+
+      expectInvalidApproval(error, events);
+      expect(error.message).toContain(interrupt.id);
+      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
+      expect(fake.toolApprovalCalls).toHaveLength(0);
+    },
+  );
+
+  it.each([
+    ["{}", {}],
+    ["a string", "ok"],
+    ["null", null],
+  ] as const)("a legacy command.resume of %s", async (_label, resume) => {
+    const { agent, fake } = makeLocal({ streamChunks: approvalChunks() });
+    const value = legacyValue(await collectEvents(agent, makeInput()));
+    const spies = spyOnMastraCalls(fake);
+
+    const { error, events } = await collectRunError(
+      agent,
+      legacyResume(value, resume),
+    );
+
+    expectInvalidApproval(error, events);
+    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
+    expect(fake.toolApprovalCalls).toHaveLength(0);
+  });
+
+  it("a remote agent is not resumed either", async () => {
+    const { agent, fake } = makeRemote({
+      streamChunks: approvalChunks(),
+      resumeChunks: approvedResumeChunks(),
+    });
+    const [interrupt] = outcomeInterrupts(
+      await collectEvents(agent, makeInput()),
+    );
+    const streamSpy = vi.spyOn(fake, "stream");
+
+    const { error, events } = await collectRunError(
+      agent,
+      makeInput({
+        runId: "run-2",
+        resume: [
+          {
+            interruptId: interrupt.id,
+            status: "resolved",
+            payload: { approve: true },
+          },
+        ],
+      } as any),
+    );
+
+    expectInvalidApproval(error, events);
+    expect(fake.resumeCalls).toHaveLength(0);
+    expect(streamSpy).not.toHaveBeenCalled();
+  });
+});
+
 describe("tool approval: ordinary suspend is unchanged", () => {
   it("resume: false on a suspend still closes the run without calling Mastra", async () => {
     const { agent, fake } = makeLocal({ streamChunks: [] });
@@ -515,6 +630,24 @@ describe("tool approval:
```

**File**: `integrations/mastra/typescript/src/mastra.ts` (modified, +48/-13)
```diff
@@ -245,24 +245,41 @@ function isToolApprovalEvent(interruptEvent: unknown): boolean {
   return (value as { type?: unknown } | null)?.type === TOOL_APPROVAL_TYPE;
 }
 
-// Only an explicit approval runs the tool; anything else declines.
-function isApprovedResume(resume: unknown): boolean {
-  return (
-    resume === true ||
-    (!!resume &&
-      typeof resume === "object" &&
-      (resume as { approved?: unknown }).approved === true)
-  );
+/**
+ * Reads a tool approval answer: `true` or `{ approved: true }` approves,
+ * `{ approved: false }` declines. Anything else returns `undefined`, which is
+ * not an answer, so the run fails and the approval stays pending.
+ */
+function parseApprovalAnswer(resume: unknown): boolean | undefined {
+  if (resume === true) return true;
+  if (resume && typeof resume === "object") {
+    const approved = (resume as { approved?: unknown }).approved;
+    if (typeof approved === "boolean") return approved;
+  }
+  return undefined;
+}
+
+function describeResumeValue(value: unknown): string {
+  if (value === undefined) return "no payload";
+  try {
+    const json = JSON.stringify(value);
+    return json.length > 80 ? `${json.slice(0, 80)}...` : json;
+  } catch {
+    return typeof value;
+  }
 }
 
 /**
  * What a run was asked to do about a suspended tool call, resolved from either
  * resume channel. `declined` comes from the entry's status (or, legacy,
  * `resume === false`), never from the payload value, so a resolved entry with
- * no payload still resumes.
+ * no payload still resumes an ordinary suspend. An approval also accepts
+ * `{ approved: false }` as a decline and rejects any other payload.
  */
 interface ResumeDirective {
   interruptEvent: unknown;
+  /** The canonical entry's interruptId; absent on the legacy channel. */
+  interruptId?: string;
   declined: boolean;
   resumeData: unknown;
 }
@@ -942,6 +959,27 @@ export class MastraAgent extends AbstractAgent {
             return;
           }
 
+          // Checked before any Mastra call so a malformed answer leaves the
+          // approval pending in Mastra, still answerable.
+          const approved = toolApproval
+            ? directive.declined
+              ? false
+              : parseApprovalAnswer(directive.resumeData)
+            : undefined;
+          if (toolApproval && approved === undefined) {
+            const target = directive.interruptId
+              ? `interrupt ${directive.interruptId} (toolCallId ${interruptEvent.toolCallId})`
+              : `toolCallId ${interruptEvent.toolCallId}`;
+            const error = new ResumeRequestError(
+              `Invalid tool approval answer for ${target}: received ${describeResumeValue(directive.resumeData)}. ` +
+                "Approve with true or { approved: true }; decline with { approved: false }, a cancelled entry, or a legacy resume of false. " +
+                "The approval is still pending.",
+              "MASTRA_INVALID_TOOL_APPROVAL",
+            );
+            failRun(error, error.code);
+            return;
+          }
+
           // Re-set this run's context so resume forwards it, not the prior turn's.
           const resumeRequestContext = this.applyInputContext(input.context);
 
@@ -1053,10 +1091,6 @@ export class MastraAgent extends AbstractAgent {
             subscriber.complete();
           };
 
-          const approved = toolApproval
-            ? !directive.declined && isApprovedResume(directive.resumeData)
-            : undefined;
-
           try {
             if (this.isLocalMastraAgent(this.agent)) {
               type ApprovalOptions = Parameters<
@@ -1376,6 +1410,7 @@ export class MastraAgent extends AbstractAgent {
           runId: sep >= 0 ? encodedId.slice(0, sep) : input.runId,
           ...(approval ? { type: TOOL_APPROVAL_TYPE } : {}),
         },
+        interruptId: entry.interruptId,
         declined: entry.status === "cancelled",
         resumeData: entry.payload,
       };
```

---

### Incident Patch 2: `c203a6f4` (2026-09-30)
**Commit Message**: fix(mastra): keep resumed text in a new message and never drop a held call

Three follow-ups to the resumed tool call handling:

- Resumed text now gets the next unused continuation id for the owning
  message. Before, a turn that already had text after an earlier tool call
  appended the resumed answer onto that old continuation message.
- Observational Memory chunks that emit nothing no longer release the held
  call early under the fallback id.
- If the stream throws while the call is held, the call and its result are
  emitted before the run error, as they were before the call was held.

**File**: `integrations/mastra/typescript/src/__tests__/message-id-alignment.test.ts` (modified, +180/-0)
```diff
@@ -6,9 +6,11 @@ import {
   makeRemoteMastraAgent,
   makeInput,
   collectEvents,
+  collectRunError,
   runThroughClient,
   FakeMemory,
   FakeLocalAgent,
+  FakeRemoteAgent,
 } from "./helpers";
 
 /**
@@ -827,5 +829,183 @@ describe("resumed suspended tool call identity", () => {
         events.indexOf(firstText),
       );
     });
+
+    it("keeps holding the call across observational-memory chunks that emit nothing", async () => {
+      const agent = makeRemoteMastraAgent({
+        observationalMemory: true,
+        resumeChunks: resumeChunks({
+          beforeFirstId: [
+            { type: "data-om-status", data: { tokens: 120 } },
+            { type: "data-om-thread-update", data: { title: "Sync" } },
+          ],
+        }),
+      });
+
+      const events = await collectEvents(
+        agent,
+        makeInput({ messages: [userTurn], forwardedProps: resumeProps }),
+      );
+
+      const [start] = ofType(events, EventType.TOOL_CALL_START);
+      expect(start.parentMessageId).toBe(TURN_ID);
+    });
+
+    it("emits the call and its result when the stream ends right after the result", async () => {
+      const [result] = resumeChunks();
+      const agent = makeRemoteMastraAgent({ resumeChunks: [result] });
+
+      const events = await collectEvents(
+        agent,
+        makeInput({ messages: [userTurn], forwardedProps: resumeProps }),
+      );
+
+      expect(events.map((e) => e.type)).toEqual([
+        EventType.RUN_STARTED,
+        EventType.TOOL_CALL_START,
+        EventType.TOOL_CALL_ARGS,
+        EventType.TOOL_CALL_END,
+        EventType.TOOL_CALL_RESULT,
+        EventType.RUN_FINISHED,
+      ]);
+    });
+
+    const expectCallAndResultBeforeError = (events: BaseEvent[]) => {
+      expect(events.map((e) => e.type)).toEqual([
+        EventType.RUN_STARTED,
+        EventType.TOOL_CALL_START,
+        EventType.TOOL_CALL_ARGS,
+        EventType.TOOL_CALL_END,
+        EventType.TOOL_CALL_RESULT,
+        EventType.RUN_ERROR,
+      ]);
+      expect(ofType(events, EventType.TOOL_CALL_RESULT)[0].toolCallId).toBe(
+        CALL_ID,
+      );
+    };
+
+    it("emits the call and its result before an error chunk", async () => {
+      const [result] = resumeChunks();
+      const agent = makeRemoteMastraAgent({
+        resumeChunks: [
+          result,
+          { type: "error", runId: MASTRA_RUN_ID, payload: { error: "boom" } },
+        ],
+      });
+
+      const { events } = await collectRunError(
+        agent,
+        makeInput({ messages: [userTurn], forwardedProps: resumeProps }),
+      );
+
+      expectCallAndResultBeforeError(events);
+    });
+
+    it("emits the call and its result before a remote stream failure", async () => {
+      const [result] = resumeChunks();
+      const remote = new FakeRemoteAgent();
+      remote.resumeStream = async () => ({
+        processDataStream: async ({ onChunk }) => {
+          await onChunk(result);
+          throw new Error("connection reset");
+        },
+      });
+      const agent = new MastraAgent({
+        agentId: "test-agent",
+        agent: remote as any,
+        resourceId: "resource-1",
+      });
+
+      const { error, events } = await collectRunError(
+        agent,
+        makeInput({ messages: [userTurn], forwardedProps: resumeProps }),
+      );
+
+      expect(error.message).toBe("connection reset");
+      expectCallAndResultBeforeError(events);
+    });
+
+    it("emits the call and its result before a local stream failure", async () => {
+      const [result] = resumeChunks();
+      const local = new FakeLocalAgent();
+      local.resumeStream = async () => ({
+        fullStream: (async function* () {
+          yield result;
+          throw new Error("model crashed");
+        })(),
+      });
+      const agent = new MastraAgent({
+        agentId: "test-agent",
+        agent: local as any,
+        resourceId: "resource-1",
+      });
+
+      const { error, events } = await collectRunE
```

**File**: `integrations/mastra/typescript/src/mastra.ts` (modified, +79/-30)
```diff
@@ -110,6 +110,18 @@ const SILENT_CHUNK_TYPES = new Set([
   "abort",
 ]);
 
+// Observational Memory chunk types surfaced as activity (see handleOmChunk);
+// every other data-om-* chunk is swallowed.
+const SURFACED_OM_CHUNK_TYPES = new Set([
+  "data-om-observation-start",
+  "data-om-buffering-start",
+  "data-om-observation-end",
+  "data-om-buffering-end",
+  "data-om-observation-failed",
+  "data-om-buffering-failed",
+  "data-om-activation",
+]);
+
 // Chunk types that can carry the turn's native message id.
 const MESSAGE_ID_CHUNK_TYPES = new Set([
   "start",
@@ -1026,6 +1038,7 @@ export class MastraAgent extends AbstractAgent {
             },
             input.runId,
             pendingInterrupts,
+            input.messages,
           );
 
           // Shared completion: emit a best-effort working-memory snapshot
@@ -1131,7 +1144,7 @@ export class MastraAgent extends AbstractAgent {
               }
 
               let stopped = false;
-              const { handleChunk, flush, getUsage } =
+              const { handleChunk, flush, getUsage, releaseDeferredReplay } =
                 this.createChunkProcessor(
                   {
                     ...callbacks,
@@ -1144,17 +1157,24 @@ export class MastraAgent extends AbstractAgent {
                   resumeReplay,
                 );
 
-              await response.processDataStream({
-                onChunk: async (chunk: any) => {
-                  if (stopped) return;
-                  // Cancelled mid-resume: stop consuming (#2288).
-                  if (abortController.signal.aborted) {
-                    stopped = true;
-                    return;
-                  }
-                  if (handleChunk(chunk)) stopped = true;
-                },
-              });
+              try {
+                await response.processDataStream({
+                  onChunk: async (chunk: any) => {
+                    if (stopped) return;
+                    // Cancelled mid-resume: stop consuming (#2288).
+                    if (abortController.signal.aborted) {
+                      stopped = true;
+                      return;
+                    }
+                    if (handleChunk(chunk)) stopped = true;
+                  },
+                });
+              } catch (error) {
+                // A resumed call already streamed must reach the client
+                // before the failure.
+                if (!abortController.signal.aborted) releaseDeferredReplay();
+                throw error;
+              }
 
               if (!stopped) {
                 flush();
@@ -1575,6 +1595,7 @@ export class MastraAgent extends AbstractAgent {
     setMessageId: (id: string) => void,
     runId: string,
     pendingInterrupts: Interrupt[],
+    historyMessages: Message[] = [],
   ): Omit<MastraAgentStreamOptions, "onError" | "onRunFinished"> {
     let reasoningMessageId: string | null = null;
     let isReasoning = false;
@@ -1601,6 +1622,22 @@ export class MastraAgent extends AbstractAgent {
     // id. Each further boundary bumps the index, giving that run of text its own
     // continuation message (#2380) — a turn can alternate more than once.
     const continuationIndexByParentId = new Map<string, number>();
+    // Per base id: the highest continuation index already in history. A resumed
+    // turn's first boundary starts past it so its text never appends onto a
+    // continuation message an earlier run emitted.
+    const historyContinuationIndex = new Map<string, number>();
+    for (const { id } of historyMessages) {
+      const base = MastraAgent.continuationBaseId(id);
+      if (!base) continue;
+      const suffix = id.slice(
+        base.length + MastraAgent.ASSISTANT_TEXT_CONTINUATION_SUFFIX.length,
+      );
+      const index = suffix ? Number(suffix.slice(1)) : 1;
+      historyContinuationIndex.set(
+        base,
+        Math.max(historyContinuationIndex.get(base) ?? 0, index),
+      );
+    }
     // Whether t
```

---

### Incident Patch 3: `4084e86d` (2026-09-30)
**Commit Message**: fix(mastra): keep a resumed tool call under the message that owns it

On a native resume, Mastra streams the suspended call's tool-result before it
announces the turn's message id. The adapter re-emitted the call under its
random fallback id, then adopted the native id for the final text. The same
call id ended up under two assistant messages, and the final text landed on
the original message, above the tool result. On remote agents the next turn
resent both messages, so Mastra stored the call twice.

The resumed call now keeps the id of the message that owns it:

- If the client history already holds the call, its message id is used and
  the call is not re-emitted, since re-sent args would be appended to the
  existing arguments. The result still goes out.
- Otherwise the synthesized call and its result wait for the first chunk that
  carries the native message id, and go out under that id. Output that
  arrives earlier releases them first. A stream that never announces an id
  keeps the previous fallback.

Either way the final text goes to the continuation message after the result.
A resumed `updateWorkingMemory` result is now matched by tool name as well, so
it is no longer emi

**File**: `integrations/mastra/typescript/src/__tests__/helpers.ts` (modified, +21/-1)
```diff
@@ -1,4 +1,9 @@
-import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
+import type {
+  BaseEvent,
+  Message,
+  RunAgentInput,
+  RunAgentParameters,
+} from "@ag-ui/client";
 import { EventType } from "@ag-ui/client";
 import { firstValueFrom, toArray } from "rxjs";
 import { MastraAgent } from "../mastra";
@@ -222,6 +227,21 @@ export function collectEvents(
   return firstValueFrom(agent.run(input).pipe(toArray()));
 }
 
+/**
+ * Runs `agent` from `history` through the real AG-UI client pipeline (chunk
+ * expansion, verification, reducer) and returns the message list it ends with.
+ */
+export async function runThroughClient(
+  agent: MastraAgent,
+  history: Message[],
+  params: RunAgentParameters,
+): Promise<Message[]> {
+  agent.threadId = "thread-1";
+  agent.setMessages(history);
+  await agent.runAgent(params);
+  return agent.messages;
+}
+
 /**
  * Runs `input` to a failure: exactly one RUN_ERROR as the last event, then an
  * Observable error. Rejects if the run completes or errors without that event.
```

**File**: `integrations/mastra/typescript/src/__tests__/integration.test.ts` (modified, +95/-1)
```diff
@@ -565,7 +565,44 @@ describe("integration with real Mastra Agent", () => {
         agent: mastra.getAgent("expense"),
         resourceId: "resource-1",
       });
-      return { bridge, executions, modelCalls };
+      // The id Mastra stores the suspended turn's assistant message under.
+      const storedAssistantId = async () => {
+        const memory = await mastra.getAgent("expense").getMemory();
+        const { messages } = await memory!.recall({
+          threadId: "thread-1",
+          resourceId: "resource-1",
+        });
+        return messages.find((m: any) => m.role === "assistant")?.id;
+      };
+      return { bridge, executions, modelCalls, storedAssistantId };
+    }
+
+    async function suspendThenResume(history: (assistantId: string) => any[]) {
+      const { bridge, storedAssistantId } = suspendingAgent();
+      const user = { id: "u1", role: "user", content: "File my dinner" };
+      const first = await collectEvents(
+        bridge,
+        makeInput({ runId: "run-1", messages: [user] as any }),
+      );
+      const finished = first.find(
+        (e) => e.type === EventType.RUN_FINISHED,
+      ) as any;
+      const assistantId = await storedAssistantId();
+      expect(assistantId).toEqual(expect.any(String));
+      const second = await collectEvents(
+        bridge,
+        makeInput({
+          runId: "run-2",
+          messages: [user, ...history(assistantId!)] as any,
+          resume: [
+            {
+              interruptId: finished.outcome.interrupts[0].id,
+              status: "resolved",
+            },
+          ],
+        }),
+      );
+      return { events: second, assistantId: assistantId! };
     }
 
     it("resumes the suspended tool from a resolved entry with no payload", async () => {
@@ -608,5 +645,62 @@ describe("integration with real Mastra Agent", () => {
       expect(second.some((e) => e.type === EventType.RUN_ERROR)).toBe(false);
       expect(second[second.length - 1].type).toBe(EventType.RUN_FINISHED);
     });
+
+    it("opens the resumed call under the id Mastra stores it under", async () => {
+      const { events, assistantId } = await suspendThenResume(() => []);
+
+      const starts = events.filter(
+        (e) => e.type === EventType.TOOL_CALL_START,
+      ) as any[];
+      const result = events.find(
+        (e) => e.type === EventType.TOOL_CALL_RESULT,
+      ) as any;
+      const text = events.filter(
+        (e) => e.type === EventType.TEXT_MESSAGE_CHUNK,
+      ) as any[];
+      expect(starts).toHaveLength(1);
+      expect(starts[0].toolCallId).toBe("tc-1");
+      expect(starts[0].parentMessageId).toBe(assistantId);
+      expect(events.indexOf(result)).toBeGreaterThan(events.indexOf(starts[0]));
+      expect(text.map((t) => t.messageId)).toEqual([
+        `${assistantId}-agui-text`,
+      ]);
+      expect(events.indexOf(text[0])).toBeGreaterThan(events.indexOf(result));
+    });
+
+    it("does not re-open a resumed call the client already holds", async () => {
+      const { events, assistantId } = await suspendThenResume((id) => [
+        {
+          id,
+          role: "assistant",
+          content: "",
+          toolCalls: [
+            {
+              id: "tc-1",
+              type: "function",
+              function: {
+                name: "approve_expense",
+                arguments: JSON.stringify({ amount: 250 }),
+              },
+            },
+          ],
+        },
+      ]);
+
+      const types = events.map((e) => e.type);
+      expect(types).not.toContain(EventType.TOOL_CALL_START);
+      expect(types).not.toContain(EventType.TOOL_CALL_ARGS);
+      const result = events.find(
+        (e) => e.type === EventType.TOOL_CALL_RESULT,
+      ) as any;
+      expect(result.toolCallId).toBe("tc-1");
+      const text = events.filter(
+        (e) => e.type === EventType.TEXT_MESSAGE_CHUNK,
+      ) as any[];
+      expect(text.map((t) => t.messageId)).toEqual([
+        `${assistantId}-ag
```

**File**: `integrations/mastra/typescript/src/__tests__/message-id-alignment.test.ts` (modified, +325/-0)
```diff
@@ -1,10 +1,12 @@
 import { EventType } from "@ag-ui/client";
+import type { AssistantMessage, BaseEvent, Message } from "@ag-ui/client";
 import { MastraAgent } from "../mastra";
 import {
   makeLocalMastraAgent,
   makeRemoteMastraAgent,
   makeInput,
   collectEvents,
+  runThroughClient,
   FakeMemory,
   FakeLocalAgent,
 } from "./helpers";
@@ -504,3 +506,326 @@ describe("assistant text segmentation with useProcessedFinalText", () => {
     expect(ids[0]).toBe("base");
   });
 });
+
+/**
+ * Resuming a suspended tool call. The previous run suppressed the call's
+ * TOOL_CALL_START / ARGS / END, and Mastra's resume stream opens with the
+ * call's tool-result before anything announces the turn's message id: the
+ * first id arrives on the following step-finish. The call must render under
+ * the id Mastra stores it under, exactly once, and the trailing text must land
+ * after its result.
+ */
+describe("resumed suspended tool call identity", () => {
+  const TURN_ID = "mastra-turn-resume";
+  // Keep in sync with MastraAgent.continuationMessageId (private).
+  const CONTINUATION_ID = `${TURN_ID}-agui-text`;
+  const CALL_ID = "call-schedule";
+  const MEMORY_CALL_ID = "call-memory";
+  const MASTRA_RUN_ID = "mastra-run-1";
+  const ARGS = { title: "Sync", time: "15:00" };
+
+  // The resume order @mastra/client-js delivers, including the working-memory
+  // result the first run's parallel `updateWorkingMemory` call leaves behind.
+  function resumeChunks({
+    announceId = true,
+    beforeFirstId = [],
+  }: { announceId?: boolean; beforeFirstId?: any[] } = {}) {
+    const id = announceId ? { messageId: TURN_ID } : {};
+    const chunk = (type: string, payload: Record<string, unknown>) => ({
+      type,
+      runId: MASTRA_RUN_ID,
+      from: "AGENT",
+      payload,
+    });
+    return [
+      chunk("tool-result", {
+        toolCallId: CALL_ID,
+        toolName: "schedule_meeting",
+        args: ARGS,
+        result: { booked: true },
+      }),
+      chunk("tool-result", {
+        toolCallId: MEMORY_CALL_ID,
+        toolName: "updateWorkingMemory",
+        args: { memory: "# Notes" },
+        result: { success: true },
+      }),
+      ...beforeFirstId,
+      chunk("step-finish", {
+        ...id,
+        stepResult: { reason: "tool-calls", isContinued: true },
+      }),
+      chunk("step-start", { ...id, request: { body: {} }, warnings: [] }),
+      chunk("text-start", { id: "text-1" }),
+      chunk("text-delta", { id: "text-1", text: "Booked for " }),
+      chunk("text-delta", { id: "text-1", text: "3pm." }),
+      chunk("text-end", { id: "text-1" }),
+      chunk("step-finish", {
+        ...id,
+        stepResult: { reason: "stop", isContinued: false },
+      }),
+      chunk("finish", {
+        ...id,
+        stepResult: { reason: "stop", isContinued: false },
+      }),
+    ];
+  }
+
+  const resumeProps = {
+    command: {
+      resume: { approved: true },
+      interruptEvent: {
+        type: "mastra_suspend",
+        toolCallId: CALL_ID,
+        toolName: "schedule_meeting",
+        args: ARGS,
+        runId: MASTRA_RUN_ID,
+      },
+    },
+  };
+
+  const userTurn: Message = {
+    id: "user-1",
+    role: "user",
+    content: "Book a sync at 3pm",
+  };
+  // The pending call as a client holding the full history has it.
+  const historyWithCall: Message[] = [
+    userTurn,
+    {
+      id: TURN_ID,
+      role: "assistant",
+      content: "",
+      toolCalls: [
+        {
+          id: CALL_ID,
+          type: "function",
+          function: {
+            name: "schedule_meeting",
+            arguments: JSON.stringify(ARGS),
+          },
+        },
+      ],
+    },
+  ];
+
+  const ofType = (events: BaseEvent[], type: EventType) =>
+    events.filter((e) => e.type === type) as any[];
+
+  // What the client ends up holding: the call once under TURN_ID with its
+  // original arguments, then its result, then the trailing text.
+  function expectCallResultT
```

**File**: `integrations/mastra/typescript/src/mastra.ts` (modified, +160/-26)
```diff
@@ -100,6 +100,24 @@ const WORKING_MEMORY_TOOL_NAMES = new Set([
   "update-working-memory",
 ]);
 
+// Chunk types the chunk processor handles without emitting anything.
+const SILENT_CHUNK_TYPES = new Set([
+  "text-start",
+  "text-end",
+  "reasoning-signature",
+  "redacted-reasoning",
+  "tool-output",
+  "abort",
+]);
+
+// Chunk types that can carry the turn's native message id.
+const MESSAGE_ID_CHUNK_TYPES = new Set([
+  "start",
+  "step-start",
+  "step-finish",
+  "finish",
+]);
+
 /**
  * Deep-merges a working-memory update onto the existing state, mirroring
  * @mastra/core's `deepMergeWorkingMemory` (the semantics schema/json working
@@ -558,6 +576,15 @@ interface MastraAgentStreamOptions {
   }) => void;
   /** Emit TOOL_CALL_END. Fired once per tool call, after all args. */
   onToolCallEnd?: (streamPart: { toolCallId: string }) => void;
+  /**
+   * A resumed tool call the client already holds under `parentMessageId`.
+   * Nothing is emitted for the call itself; later text on that id is placed
+   * after its result, as it is after a streamed call.
+   */
+  onToolCallInHistory?: (streamPart: {
+    toolCallId: string;
+    parentMessageId: string;
+  }) => void;
   onToolResultPart?: (streamPart: { toolCallId: string; result: any }) => void;
   onError: (error: Error) => void;
   /**
@@ -970,15 +997,24 @@ export class MastraAgent extends AbstractAgent {
             };
           }
 
-          const resumeReplay =
+          const resumedToolCallId =
             interruptEvent.toolCallId != null
+              ? String(interruptEvent.toolCallId)
+              : undefined;
+          const resumeReplay =
+            resumedToolCallId !== undefined
               ? {
-                  toolCallId: String(interruptEvent.toolCallId),
+                  toolCallId: resumedToolCallId,
                   toolName:
                     typeof interruptEvent.toolName === "string"
                       ? interruptEvent.toolName
                       : undefined,
                   args: interruptEvent.args,
+                  historyMessageId: (input.messages ?? []).find(
+                    (m) =>
+                      m.role === "assistant" &&
+                      m.toolCalls?.some((tc) => tc.id === resumedToolCallId),
+                  )?.id,
                 }
               : null;
 
@@ -1581,6 +1617,20 @@ export class MastraAgent extends AbstractAgent {
         : MastraAgent.continuationMessageId(currentId, segmentIndex);
     };
 
+    // Open a text-continuation boundary on the id a tool call renders under;
+    // trailing text on the same id is then split to a continuation message
+    // (see onTextPart). Only advance past the first boundary once text has
+    // actually streamed into the current segment, so consecutive tool calls
+    // share one boundary instead of skipping segment ids.
+    const openToolCallBoundary = (parentMessageId: string) => {
+      const openBoundaries =
+        continuationIndexByParentId.get(parentMessageId) ?? 0;
+      if (openBoundaries === 0 || textSinceLastToolCall) {
+        continuationIndexByParentId.set(parentMessageId, openBoundaries + 1);
+      }
+      textSinceLastToolCall = false;
+    };
+
     const closeReasoning = () => {
       if (isReasoning && reasoningMessageId) {
         subscriber.next({
@@ -1665,17 +1715,7 @@ export class MastraAgent extends AbstractAgent {
       onToolCallStart: (streamPart) => {
         closeReasoning();
         const parentMessageId = getMessageId();
-        // Open a text-continuation boundary on the id this tool call renders
-        // under; trailing text on the same id is then split to a continuation
-        // message (see onTextPart). Only advance past the first boundary once
-        // text has actually streamed into the current segment, so consecutive
-        // tool calls share one boundary instead of skipping segment ids.
-        const openBoundaries =
-          continuationIndexByParentId.get
```

---

### Incident Patch 4: `3ef6a30d` (2026-09-30)
**Commit Message**: fix(adk-middleware): keep an answer retryable until its continuation starts

Consume the pending tool call or confirm_changes id, and mark the
answering message processed, only once the continuation passes the
concurrency check and is about to start. A refused start (for example the
max concurrent executions limit) used to drop the answer, so a retry was
skipped as stale. Applies to tool results, tool confirmations and
confirm_changes decisions, via tool messages and resume entries.

**File**: `integrations/adk-middleware/python/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -56,6 +56,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- An answer to a paused run is no longer lost when its continuation is refused
+  before it starts (for example "Maximum concurrent executions reached"). The
+  pending tool call or `confirm_changes` id and the answering message are now
+  consumed only once the continuation is accepted, so retrying the same answer
+  delivers it exactly once. This covers tool results, tool confirmations and
+  `confirm_changes` decisions, sent as tool messages or as `resume` entries.
+  Before, the tool call was already removed from the pending set, so the retry
+  was skipped as a stale result.
 - Attachment filenames now survive the ADK session. An image, audio, video or
   document part that carries `metadata.filename` is stored with that name as
   the native `display_name` on its `Blob` (inline data) or `FileData` (URL).
```

**File**: `integrations/adk-middleware/python/src/ag_ui_adk/adk_agent.py` (modified, +48/-23)
```diff
@@ -4,7 +4,7 @@
 from ag_ui_adk.agui_toolset import AGUIToolset
 
 import copy
-from typing import Optional, Dict, Callable, Any, AsyncGenerator, List, Iterable, Set, TYPE_CHECKING, Tuple, Union
+from typing import Optional, Dict, Callable, Any, AsyncGenerator, Awaitable, List, Iterable, Set, TYPE_CHECKING, Tuple, Union
 
 if TYPE_CHECKING:
     from google.adk.apps import App
@@ -2018,37 +2018,49 @@ async def _handle_tool_result_submission(
         # confirm_changes results are not ADK tool results, but the user's
         # decision is handed to the model as user text so it can react.
         confirm_decisions = self._extract_confirm_changes_decisions(input, candidate_messages)
-        if confirm_decisions:
-            await self._consume_pending_confirm_changes(
-                thread_id,
-                self._get_user_id(input),
-                [message.tool_call_id for message, _ in confirm_decisions],
-            )
+
+        async def consume_confirm_decisions() -> None:
+            if confirm_decisions:
+                await self._consume_pending_confirm_changes(
+                    thread_id,
+                    self._get_user_id(input),
+                    [message.tool_call_id for message, _ in confirm_decisions],
+                )
 
         # If all tool results were filtered out (e.g., only confirm_changes messages),
         # we still need to mark those messages as processed and continue with trailing messages
         if not tool_results and actual_tool_messages:
-            # Mark the tool messages as processed (they were confirm_changes results)
             tool_message_ids = self._collect_message_ids(actual_tool_messages)
-            if tool_message_ids:
-                self._session_manager.mark_messages_processed(app_name, thread_id, tool_message_ids)
-                logger.debug(
-                    "Marked %d synthetic tool result messages as processed for thread %s",
-                    len(tool_message_ids),
-                    thread_id,
-                )
+
+            def mark_synthetic_processed() -> None:
+                if tool_message_ids:
+                    self._session_manager.mark_messages_processed(app_name, thread_id, tool_message_ids)
+                    logger.debug(
+                        "Marked %d synthetic tool result messages as processed for thread %s",
+                        len(tool_message_ids),
+                        thread_id,
+                    )
 
             if confirm_decisions:
+                # Consume the decision only once the continuation is accepted, so
+                # a refused start (e.g. the concurrency limit) stays retryable.
+                async def accept_decisions() -> None:
+                    await consume_confirm_decisions()
+                    mark_synthetic_processed()
+
                 async for event in self._start_new_execution(
                     input,
                     tool_results=None,
                     message_batch=self._with_confirm_changes_decisions(
                         confirm_decisions, trailing_messages
                     ),
+                    on_accepted=accept_decisions,
                 ):
                     yield event
                 return
 
+            mark_synthetic_processed()
+
             # If we have trailing messages (e.g., a follow-up user request after confirming changes),
             # process them as a new execution
             if trailing_messages:
@@ -2291,14 +2303,17 @@ async def _handle_tool_result_submission(
                 )
                 return
 
-            # All of this turn's long-running calls are answered: remove them
-            # from the pending set, then resume the model with the results. Use
-            # trailing_messages if provided, otherwise fall back to
-            # candidate_messages.
-            for tool_result in tool_results:
-                tool_call_id = tool_result["message"].tool_call_id
-                if await 
```

**File**: `integrations/adk-middleware/python/tests/test_continuation_retry.py` (added, +280/-0)
```diff
@@ -0,0 +1,280 @@
+"""An answer to a paused run survives a continuation that fails to start.
+
+When the backend refuses the continuation (here: the concurrent-execution limit
+is reached), nothing about the answer may be consumed: the pending call or
+confirm_changes id and the answering message stay retryable. Once a retry is
+accepted the answer is delivered exactly once, and a duplicate retry is a
+no-op.
+"""
+
+import asyncio
+import json
+
+import pytest
+
+from ag_ui.core import (
+    AssistantMessage,
+    EventType,
+    FunctionCall,
+    ResumeEntry,
+    Tool as AGUITool,
+    ToolCall,
+    ToolMessage,
+    UserMessage,
+)
+from ag_ui_adk import ADKAgent, AGUIToolset, PredictStateMapping
+from ag_ui_adk.execution_state import ExecutionState
+from ag_ui_adk.session_manager import SessionManager
+from google.adk.agents.llm_agent import LlmAgent
+from google.adk.apps import App, ResumabilityConfig
+from google.adk.sessions import InMemorySessionService
+
+from tests.hitl_helpers import (
+    RC_TOOL_NAME,
+    ConfirmationTool,
+    ScriptedLlm,
+    collect,
+    content_text,
+    run_finished,
+    run_input,
+    tool_call,
+)
+
+REJECTION = "user rejected the proposed changes"
+
+
+@pytest.fixture(autouse=True)
+def reset_session_manager():
+    SessionManager.reset_instance()
+    yield
+    SessionManager.reset_instance()
+
+
+class _BusySlot:
+    """Occupies the agent's only execution slot with another thread's run."""
+
+    def __init__(self, agent: ADKAgent):
+        self._agent = agent
+        self._task = None
+
+    async def __aenter__(self):
+        self._task = asyncio.ensure_future(asyncio.sleep(3600))
+        self._agent._active_executions[("other-thread", "test_user")] = ExecutionState(
+            task=self._task, thread_id="other-thread", event_queue=asyncio.Queue()
+        )
+        return self
+
+    async def __aexit__(self, *exc):
+        self._agent._active_executions.pop(("other-thread", "test_user"), None)
+        self._task.cancel()
+
+
+def _assert_capacity_error(events):
+    errors = [e for e in events if e.type == EventType.RUN_ERROR]
+    assert len(errors) == 1, [e.type for e in events]
+    assert "Maximum concurrent executions" in errors[0].message
+    assert not [e for e in events if e.type == EventType.RUN_FINISHED]
+
+
+def _assert_ok(events):
+    assert not [e for e in events if e.type == EventType.RUN_ERROR], [e.type for e in events]
+    run_finished(events)
+
+
+def _doc_agent():
+    def write_document_local(document: str) -> dict:
+        """Write the document."""
+        return {"status": "written"}
+
+    llm = ScriptedLlm(
+        model="scripted",
+        first_call={"name": "write_document_local", "args": {"document": "Hi"}},
+    )
+    agent = ADKAgent(
+        adk_agent=LlmAgent(name="doc_agent", model=llm, tools=[write_document_local]),
+        app_name="doc_app",
+        user_id="test_user",
+        session_service=InMemorySessionService(),
+        max_concurrent_executions=1,
+        predict_state=[
+            PredictStateMapping(
+                state_key="document", tool="write_document_local", tool_argument="document"
+            )
+        ],
+    )
+    return agent, llm
+
+
+async def _propose(agent, thread_id):
+    user = UserMessage(id="u-1", role="user", content="Write it")
+    events = await collect(agent, run_input(thread_id, "run-1", [user]))
+    write_id, write_args = tool_call(events, "write_document_local")
+    confirm_id, _ = tool_call(events, "confirm_changes")
+    assert write_id and confirm_id
+    history = [
+        user,
+        AssistantMessage(
+            id="a-1",
+            role="assistant",
+            content=None,
+            tool_calls=[
+                ToolCall(id=write_id, function=FunctionCall(name="write_document_local", arguments=write_args)),
+                ToolCall(id=confirm_id, function=FunctionCall(name="confirm_changes", arguments="{}")),
+            ],
+        ),
+    ]
+
```

**File**: `integrations/adk-middleware/python/tests/test_tool_result_flow.py` (modified, +33/-7)
```diff
@@ -441,7 +441,9 @@ async def test_tool_result_flow_integration(self, ag_ui_adk):
 
         # In the all-long-running architecture, tool result inputs are processed as new executions
         # Mock the background execution to avoid ADK library errors
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+            if on_accepted is not None:
+                await on_accepted()
             yield RunStartedEvent(
                 type=EventType.RUN_STARTED,
                 thread_id=input_data.thread_id,
@@ -482,7 +484,11 @@ async def test_run_processes_mixed_unseen_messages(self, ag_ui_adk):
 
         start_calls = []
 
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+
+            if on_accepted is not None:
+
+                await on_accepted()
             start_calls.append((tool_results, message_batch))
             yield RunStartedEvent(
                 type=EventType.RUN_STARTED,
@@ -584,7 +590,11 @@ async def test_run_skips_assistant_history_before_tool_result(self, ag_ui_adk):
 
         start_calls = []
 
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+
+            if on_accepted is not None:
+
+                await on_accepted()
             start_calls.append((tool_results, message_batch))
 
             call_id = None
@@ -670,7 +680,11 @@ async def test_run_preserves_order_for_user_then_tool(self, ag_ui_adk):
 
         call_sequence = []
 
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+
+            if on_accepted is not None:
+
+                await on_accepted()
             call_sequence.append(("start", tool_results, message_batch))
             yield RunStartedEvent(
                 type=EventType.RUN_STARTED,
@@ -745,7 +759,11 @@ async def test_new_execution_routing(self, ag_ui_adk, sample_tool):
             RunFinishedEvent(type=EventType.RUN_FINISHED, thread_id="thread_1", run_id="run_1")
         ]
 
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+
+            if on_accepted is not None:
+
+                await on_accepted()
             for event in mock_events:
                 yield event
 
@@ -937,7 +955,11 @@ async def test_handle_tool_result_submission_only_confirm_changes(self, ag_ui_ad
 
         start_calls = []
 
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+
+            if on_accepted is not None:
+
+                await on_accepted()
             start_calls.append({"tool_results": tool_results, "message_batch": message_batch})
             yield RunStartedEvent(
                 type=EventType.RUN_STARTED,
@@ -1012,7 +1034,11 @@ async def test_handle_tool_result_submission_confirm_changes_with_trailing_messa
         # Mock _start_new_execution to track calls
         start_calls = []
 
-        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None):
+        async def mock_start_new_execution(input_data, *, tool_results=None, message_batch=None, on_accepted=None):
+
+            if on_accepted is not None:
+
+                await on_accepted()
     
```

---

### Incident Patch 5: `ca575924` (2026-09-30)
**Commit Message**: Merge pull request #2868 from ag-ui-protocol/fix/client-apply-events-before-source-error

fix(client): apply every received event before a run's source error propagates

**File**: `sdks/typescript/packages/client/src/agent/__tests__/agent-detach.test.ts` (modified, +47/-0)
```diff
@@ -7,6 +7,7 @@ import {
   RunAgentInput,
   RunFinishedEvent,
   RunStartedEvent,
+  TextMessageStartEvent,
 } from "@ag-ui/core";
 
 /** Emits RUN_STARTED and stays open until detached. */
@@ -90,6 +91,52 @@ describe("single-run detachment", () => {
     },
   );
 
+  it("ignores events and a stream error sent after detaching, even with slow subscribers", async () => {
+    const agent = new HangingAgent({ debug: false });
+    const seen: string[] = [];
+    const onRunFailed = vi.fn();
+    const onRunFinalized = vi.fn();
+    let releaseFirst: (() => void) | undefined;
+    const run = agent.runAgent(
+      { runId: "detach-slow" },
+      {
+        onEvent: async ({ event }) => {
+          if (seen.length === 0) {
+            await new Promise<void>((resolve) => (releaseFirst = resolve));
+          }
+          seen.push(event.type);
+        },
+        onRunFailed,
+        onRunFinalized,
+      },
+    );
+    await waitForRuns(agent, 1);
+    await vi.waitFor(() => expect(releaseFirst).toBeDefined());
+
+    // Queued before the detach: already received, so it is still applied.
+    const queued: TextMessageStartEvent = {
+      type: EventType.TEXT_MESSAGE_START,
+      messageId: "queued",
+      role: "assistant",
+    };
+    agent.open[0].next(queued);
+    const detached = agent.detachActiveRun();
+    agent.open[0].next({ ...queued, messageId: "after-detach" });
+    agent.open[0].error(new Error("stream failed after detach"));
+    releaseFirst?.();
+
+    await detached;
+    await expect(run).resolves.toEqual({
+      result: undefined,
+      newMessages: [{ id: "queued", role: "assistant", content: "" }],
+    });
+    expect(seen).toEqual([EventType.RUN_STARTED, EventType.TEXT_MESSAGE_START]);
+    expect(agent.teardowns).toBe(1);
+    expect(onRunFailed).not.toHaveBeenCalled();
+    expect(onRunFinalized).toHaveBeenCalledTimes(1);
+    expect(agent.isRunning).toBe(false);
+  });
+
   it("is a no-op when idle and does not affect a later run", async () => {
     const agent = new HangingAgent({ debug: false });
     await agent.detachActiveRun();
```

**File**: `sdks/typescript/packages/client/src/agent/__tests__/agent-run-error.test.ts` (modified, +134/-1)
```diff
@@ -9,8 +9,13 @@
  *
  * The agent INSTANCE is likewise untouched: a new run on the same object starts
  * clean.
+ *
+ * A producer that also errors its stream after the RUN_ERROR (the shape the
+ * Mastra and LangGraph adapters use) does fail the run, but only after every
+ * event it sent first has been delivered to subscribers and applied.
  */
 import { Observable, Subject, of } from "rxjs";
+import { concatMap } from "rxjs/operators";
 import { transformHttpEventStream } from "@/transform/http";
 import { HttpEventType, type HttpEvent } from "@/run/http-request";
 import { AbstractAgent } from "../agent";
@@ -21,7 +26,7 @@ import {
   RunFinishedEvent,
   RunStartedEvent,
 } from "@ag-ui/core";
-import type { AgentSubscriber } from "../subscriber";
+import type { AgentStateMutation, AgentSubscriber } from "../subscriber";
 import type { RunAgentResult } from "../agent";
 
 /** Replays a different scripted stream on each successive run. */
@@ -264,3 +269,131 @@ describe("the abort contract", () => {
     expect(seen instanceof Error).toBe(true);
   });
 });
+
+const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
+
+/** Sends `events`, then errors the stream with `error`, all synchronously. */
+function failingStream(events: BaseEvent[], error: Error): Observable<BaseEvent> {
+  return new Observable<BaseEvent>((subscriber) => {
+    events.forEach((event) => subscriber.next(event));
+    subscriber.error(error);
+  });
+}
+
+class FailingStreamAgent extends AbstractAgent {
+  constructor(
+    private events: BaseEvent[],
+    private error: Error,
+  ) {
+    super();
+    this.debug = false;
+  }
+  run(_input: RunAgentInput): Observable<BaseEvent> {
+    return failingStream(this.events, this.error);
+  }
+  protected connect(_input: RunAgentInput): Observable<BaseEvent> {
+    return failingStream(this.events, this.error);
+  }
+}
+
+/** Slow subscribers: each callback yields to a timer before returning. */
+function slowRecorder() {
+  const seen: string[] = [];
+  const runErrors: BaseEvent[] = [];
+  const subscriber = {
+    onEvent: async ({ event }) => {
+      await delay(10);
+      seen.push(event.type);
+    },
+    onRunErrorEvent: async ({ event }) => {
+      await delay(10);
+      runErrors.push(event);
+    },
+    onRunFailed: vi.fn(),
+    onRunFinalized: vi.fn(),
+  } satisfies AgentSubscriber;
+  return { seen, runErrors, subscriber };
+}
+
+describe("a stream that errors after sending events", () => {
+  const runError = { type: EventType.RUN_ERROR, message: "model failed" } as BaseEvent;
+  const failedRun = [started("r1"), ...message("m1", "partial answer"), runError];
+
+  it.each(["runAgent", "connectAgent"] as const)(
+    "%s delivers the RUN_ERROR and everything before it, then rejects with the stream's error",
+    async (method) => {
+      const error = new Error("stream failed after RUN_ERROR");
+      const agent = new FailingStreamAgent(failedRun, error);
+      const { seen, runErrors, subscriber } = slowRecorder();
+
+      const logged = await loggedErrorsDuring(async () => {
+        await expect(agent[method]({ runId: "r1" }, subscriber)).rejects.toBe(error);
+      });
+
+      expect(seen).toEqual([
+        EventType.RUN_STARTED,
+        EventType.TEXT_MESSAGE_START,
+        EventType.TEXT_MESSAGE_CONTENT,
+        EventType.TEXT_MESSAGE_END,
+        EventType.RUN_ERROR,
+      ]);
+      expect(runErrors).toEqual([runError]);
+      expect(agent.messages).toEqual([{ id: "m1", role: "assistant", content: "partial answer" }]);
+      expect(subscriber.onRunFailed).toHaveBeenCalledTimes(1);
+      expect(subscriber.onRunFailed.mock.calls[0][0].error).toBe(error);
+      await vi.waitFor(() => expect(subscriber.onRunFinalized).toHaveBeenCalledTimes(1));
+      expect(agent.isRunning).toBe(false);
+      expect(logged).toContain("Agent execution failed");
+    },
+  );
+
+  it("applies every event before a plain stream error, with no RUN_ERROR"
```

**File**: `sdks/typescript/packages/client/src/agent/agent.ts` (modified, +37/-5)
```diff
@@ -25,7 +25,7 @@ import { compareVersions, validate as validateVersion } from "compare-versions";
 import { catchError, map, tap } from "rxjs/operators";
 import { finalize } from "rxjs/operators";
 import { takeUntil } from "rxjs/operators";
-import { pipe, Observable, from, of, EMPTY, Subject, defer } from "rxjs";
+import { pipe, Observable, from, of, EMPTY, Subject, defer, concatWith, throwError } from "rxjs";
 import { verifyEvents } from "@/verify";
 import { convertToLegacyEvents } from "@/legacy/convert";
 import { LegacyRuntimeProtocolEvent } from "@/legacy/types";
@@ -370,8 +370,7 @@ export abstract class AbstractAgent {
         verifyEvents(this.debugLogger),
         // Stop processing immediately when this run is detached
         (source$) => source$.pipe(takeUntil(this.activeRunDetach$!)),
-        (source$) => this.apply(input, source$, subscribers),
-        (source$) => this.processApplyEvents(input, source$, subscribers),
+        (source$) => this.applyBeforeSourceError(input, source$, subscribers),
         catchError((error) => {
           this.debugLogger?.lifecycle("LIFECYCLE", "Run errored:", {
             agentId: this.agentId,
@@ -454,8 +453,7 @@ export abstract class AbstractAgent {
         verifyEvents(this.debugLogger),
         // Stop processing immediately when this run is detached
         (source$) => source$.pipe(takeUntil(this.activeRunDetach$!)),
-        (source$) => this.apply(input, source$, subscribers),
-        (source$) => this.processApplyEvents(input, source$, subscribers),
+        (source$) => this.applyBeforeSourceError(input, source$, subscribers),
         catchError((error) => {
           this.isRunning = false;
           if (!(error instanceof AGUIConnectNotImplementedError)) {
@@ -497,6 +495,40 @@ export abstract class AbstractAgent {
     await completion;
   }
 
+  /**
+   * Runs apply and processApplyEvents so that every event received before the
+   * source errors is fully applied first. The error is held back as a
+   * completion, then rethrown unchanged once both stages have drained.
+   */
+  private applyBeforeSourceError(
+    input: RunAgentInput,
+    source$: Observable<BaseEvent>,
+    subscribers: AgentSubscriber[],
+  ): Observable<AgentStateMutation> {
+    return defer(() => {
+      let sourceError: { error: unknown } | undefined;
+      const events$ = source$.pipe(
+        catchError((error: unknown) => {
+          sourceError = { error };
+          return EMPTY;
+        }),
+      );
+      const applied$ = this.processApplyEvents(
+        input,
+        this.apply(input, events$, subscribers),
+        subscribers,
+      );
+      return applied$.pipe(
+        concatWith(
+          defer(() => {
+            const pending = sourceError;
+            return pending ? throwError(() => pending.error) : EMPTY;
+          }),
+        ),
+      );
+    });
+  }
+
   protected apply(
     input: RunAgentInput,
     events$: Observable<BaseEvent>,
```

---

### Incident Patch 6: `67198924` (2026-09-30)
**Commit Message**: Merge pull request #2834 from ag-ui-protocol/fix/parallel-a2ui-tool-association

fix(a2ui): preserve sibling tool identity during parallel replay

**File**: `middlewares/a2ui-middleware/__tests__/a2ui-middleware.test.ts` (modified, +1/-51)
```diff
@@ -1,14 +1,12 @@
 import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
 import {
-  AbstractAgent,
   BaseEvent,
   EventType,
   RunAgentInput,
   Tool,
   AssistantMessage,
   ToolMessage,
 } from "@ag-ui/client";
-import { Observable, firstValueFrom, toArray } from "rxjs";
 
 import {
   A2UIMiddleware,
@@ -20,55 +18,7 @@ import {
   tryParseA2UIOperations,
 } from "../src/index";
 
-/**
- * Mock Agent for testing middleware
- */
-class MockAgent extends AbstractAgent {
-  private events: BaseEvent[];
-  public runCalls: RunAgentInput[] = [];
-
-  constructor(events: BaseEvent[] = []) {
-    super();
-    this.events = events;
-  }
-
-  run(input: RunAgentInput): Observable<BaseEvent> {
-    this.runCalls.push(input);
-    return new Observable((subscriber) => {
-      for (const event of this.events) {
-        subscriber.next(event);
-      }
-      subscriber.complete();
-    });
-  }
-
-  setEvents(events: BaseEvent[]): void {
-    this.events = events;
-  }
-}
-
-/**
- * Create a basic RunAgentInput for testing
- */
-function createRunAgentInput(overrides: Partial<RunAgentInput> = {}): RunAgentInput {
-  return {
-    threadId: "test-thread",
-    runId: "test-run",
-    tools: [],
-    context: [],
-    forwardedProps: {},
-    state: {},
-    messages: [],
-    ...overrides,
-  };
-}
-
-/**
- * Collect all events from an Observable
- */
-async function collectEvents(observable: Observable<BaseEvent>): Promise<BaseEvent[]> {
-  return firstValueFrom(observable.pipe(toArray()));
-}
+import { MockAgent, createRunAgentInput, collectEvents } from "./test-utils";
 
 // OSS-162: the a2ui-surface activity now also carries pre-paint lifecycle
 // snapshots (`content.status` = "building" | "retrying" | "failed", no
```

**File**: `middlewares/a2ui-middleware/__tests__/fixtures/README.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+# Parallel flight/dashboard regression traces (PNI-490)
+
+These are recorded protocol traces, not hand-authored tool sequences. Both tools
+belong to the same native assistant message and retain its `parentMessageId`.
+Only the run boundaries and `search_flights` / `render_a2ui` events are retained;
+transport debug metadata, import provenance, timestamps and unrelated tools are
+removed. Call IDs, parent message IDs, argument chunks, result payloads and event
+order are preserved.
+
+- `langgraph-live.json`: a fresh provider-backed synthetic demo, generated through
+  an aimock recorder on 2026-09-24 with LangGraph 1.1.6, LangChain 1.2.15,
+  langchain-openai 1.1.9, copilotkit Python 0.1.94 and ag-ui-langgraph 0.0.41.
+  The native SQLite checkpoint contains one assistant message with both parallel
+  calls. The graph exposes the existing Beautiful Chat `search_flights` and a
+  direct `render_a2ui` tool, with `parallel_tool_calls=True`. Two model requests
+  were recorded (parallel tool turn, then completion).
+- `langgraph-import.json`: that same saved native history, passed through the
+  Intelligence LangGraph normalizer and shared conversation-event builder.
+- `strands-ts-import.json`: the retained original Strands SDK 1.19.0 native
+  SessionManager snapshot, passed through Intelligence PR1366's normalizer and
+  the same event builder. This original source used a deterministic model and
+  real Agent/FunctionTool/SessionManager execution; it is not a provider-generated
+  Strands conversation.
+
+The LangGraph model emitted exactly the original Strands fixture's flight and
+render argument values. Both transformations use the custom
+`copilotkit://app-dashboard-catalog`. The original Strands capture used generic
+FunctionTool callbacks, so its tool-schema validation is not claimed equivalent
+to the typed LangGraph tools. The regression concerns preserved sibling call
+identity and result ownership, downstream of those schema differences.
+
+Published CopilotKit 1.73.3 with A2UI middleware 0.0.10 maps the dashboard to the
+flight call in all three traces, then suppresses the flight result. Each trace
+must instead produce the dashboard on its render call and flight cards on their
+own flight call. Existing recovery tests cover the legacy nested-render path
+where adapters omit parent message IDs. Separate synthetic unit events exercise
+out-of-order ordinary results and failure envelopes.
+
+## Parallel-call limitation
+
+Sibling detection requires matching, nonempty `parentMessageId` values on both
+`TOOL_CALL_START` events. If an adapter omits either parent ID, the middleware
+retains the legacy nesting fallback, so independent parallel calls may still
+share an activity or have their output suppressed. Adapters should preserve the
+originating assistant message ID on each sibling call.
```

**File**: `middlewares/a2ui-middleware/__tests__/fixtures/langgraph-import.json` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+[
+  {
+    "type": "RUN_STARTED",
+    "runId": "lg-native",
+    "input": {
+      "messages": []
+    },
+    "threadId": "probe"
+  },
+  {
+    "type": "TOOL_CALL_START",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "toolCallName": "search_flights",
+    "parentMessageId": "lc_run--01a0d3c4-d9a8-7cd0-bfc3-dce1bbb24bc1"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "{\"flights\":[{\"airline\":\"Delta Airlines\",\"airlineLogo\":\"https://example.com/delta-logo.png\",\"flightNumber\":\"DL123\",\"origin\":\"SFO\",\"destination\":\"JFK\",\"date\":\"Next Tuesday\",\"departureTime\":\"08:00 AM\",\"arrivalTime\":\"04:00 PM\",\"duration\":\"8h\",\"status\":\"On Time\",\"price\":\"$350\"},{\"airline\":\"American Airlines\",\"airlineLogo\":\"https://example.com/aa-logo.png\",\"flightNumber\":\"AA456\",\"origin\":\"SFO\",\"destination\":\"JFK\",\"date\":\"Next Tuesday\",\"departureTime\":\"09:00 AM\",\"arrivalTime\":\"05:00 PM\",\"duration\":\"8h\",\"status\":\"On Time\",\"price\":\"$340\"}]}"
+  },
+  {
+    "type": "TOOL_CALL_END",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy"
+  },
+  {
+    "type": "TOOL_CALL_START",
+    "toolCallId": "call_AWaaAr8EExwYkRIcQU1uQk95",
+    "toolCallName": "render_a2ui",
+    "parentMessageId": "lc_run--01a0d3c4-d9a8-7cd0-bfc3-dce1bbb24bc1"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_AWaaAr8EExwYkRIcQU1uQk95",
+    "delta": "{\"surfaceId\":\"canary-dashboard\",\"components\":[{\"id\":\"root\",\"component\":\"Column\",\"children\":[\"title\",\"revenue\",\"growth\"]},{\"id\":\"title\",\"component\":\"Title\",\"text\":\"Canary dashboard\"},{\"id\":\"revenue\",\"component\":\"Metric\",\"label\":\"Revenue\",\"value\":\"$125000\"},{\"id\":\"growth\",\"component\":\"Metric\",\"label\":\"Growth\",\"value\":\"12%\"}]}"
+  },
+  {
+    "type": "TOOL_CALL_END",
+    "toolCallId": "call_AWaaAr8EExwYkRIcQU1uQk95"
+  },
+  {
+    "type": "TOOL_CALL_RESULT",
+    "messageId": "68c0ba1e-19b3-44f9-9247-32a7906a6b7a",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "content": "{\"a2ui_operations\": [{\"version\": \"v0.9\", \"createSurface\": {\"surfaceId\": \"flight-search-results\", \"catalogId\": \"copilotkit://app-dashboard-catalog\"}}, {\"version\": \"v0.9\", \"updateComponents\": {\"surfaceId\": \"flight-search-results\", \"components\": [{\"id\": \"root\", \"component\": \"Row\", \"children\": [\"flight-card-0\", \"flight-card-1\"], \"gap\": 16}, {\"id\": \"flight-card-0\", \"component\": \"FlightCard\", \"airline\": \"Delta Airlines\", \"airlineLogo\": \"https://example.com/delta-logo.png\", \"flightNumber\": \"DL123\", \"origin\": \"SFO\", \"destination\": \"JFK\", \"date\": \"Next Tuesday\", \"departureTime\": \"08:00 AM\", \"arrivalTime\": \"04:00 PM\", \"duration\": \"8h\", \"status\": \"On Time\", \"price\": \"$350\"}, {\"id\": \"flight-card-1\", \"component\": \"FlightCard\", \"airline\": \"American Airlines\", \"airlineLogo\": \"https://example.com/aa-logo.png\", \"flightNumber\": \"AA456\", \"origin\": \"SFO\", \"destination\": \"JFK\", \"date\": \"Next Tuesday\", \"departureTime\": \"09:00 AM\", \"arrivalTime\": \"05:00 PM\", \"duration\": \"8h\", \"status\": \"On Time\", \"price\": \"$340\"}]}}]}"
+  },
+  {
+    "type": "TOOL_CALL_RESULT",
+    "messageId": "902dfd6e-e399-41dc-8d34-f6ac4cfc59a1",
+    "toolCallId": "call_AWaaAr8EExwYkRIcQU1uQk95",
+    "content": "rendered"
+  },
+  {
+    "type": "RUN_FINISHED",
+    "runId": "lg-native",
+    "status": "finished",
+    "endedAt": "2026-09-24T14:15:00Z"
+  }
+]
```

**File**: `middlewares/a2ui-middleware/__tests__/fixtures/langgraph-live.json` (added, +991/-0)
```diff
@@ -0,0 +1,991 @@
+[
+  {
+    "type": "RUN_STARTED",
+    "threadId": "pni490-lg-parallel-provider-1",
+    "runId": "pni490-lg-parallel-provider-1-run"
+  },
+  {
+    "type": "TOOL_CALL_START",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "toolCallName": "search_flights",
+    "parentMessageId": "lc_run--01a0d3c4-d9a8-7cd0-bfc3-dce1bbb24bc1"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "{\"fl"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "ights"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "\": [{\""
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "airl"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "ine\":"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": " \"Delt"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "a Ai"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "rline"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "s\", \"a"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "irli"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "neLog"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "o\": \"h"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "ttps"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "://ex"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "ample."
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "com/"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "delta"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "-logo."
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "png\""
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": ", \"fl"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "ightNu"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "mber"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "\": \"D"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "L123\","
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": " \"or"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "igin\""
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": ": \"SFO"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "\", \""
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "desti"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "nation"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "call_Nl5NGACaDrRAOO9qJVQ5iJMy",
+    "delta": "\": \""
+  },
+  {
+    "type": "
```

**File**: `middlewares/a2ui-middleware/__tests__/fixtures/strands-ts-import.json` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+[
+  {
+    "type": "RUN_STARTED",
+    "runId": "[\"original-parallel\",\"pni486-rich\",\"agent\",\"pni486-rich-agent\"]:snapshot-view",
+    "input": {
+      "messages": []
+    },
+    "threadId": "probe"
+  },
+  {
+    "type": "TOOL_CALL_START",
+    "toolCallId": "pni486-tool-2",
+    "toolCallName": "search_flights",
+    "parentMessageId": "native:\"aa2e0038-3228-4d37-a172-bd857172f426\":segment:0"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "pni486-tool-2",
+    "delta": "{\"flights\":[{\"airline\":\"Delta Airlines\",\"airlineLogo\":\"https://example.com/delta-logo.png\",\"flightNumber\":\"DL123\",\"origin\":\"SFO\",\"destination\":\"JFK\",\"date\":\"Next Tuesday\",\"departureTime\":\"08:00 AM\",\"arrivalTime\":\"04:00 PM\",\"duration\":\"8h\",\"status\":\"On Time\",\"price\":\"$350\"},{\"airline\":\"American Airlines\",\"airlineLogo\":\"https://example.com/aa-logo.png\",\"flightNumber\":\"AA456\",\"origin\":\"SFO\",\"destination\":\"JFK\",\"date\":\"Next Tuesday\",\"departureTime\":\"09:00 AM\",\"arrivalTime\":\"05:00 PM\",\"duration\":\"8h\",\"status\":\"On Time\",\"price\":\"$340\"}]}"
+  },
+  {
+    "type": "TOOL_CALL_END",
+    "toolCallId": "pni486-tool-2"
+  },
+  {
+    "type": "TOOL_CALL_START",
+    "toolCallId": "pni486-tool-3",
+    "toolCallName": "render_a2ui",
+    "parentMessageId": "native:\"aa2e0038-3228-4d37-a172-bd857172f426\":segment:0"
+  },
+  {
+    "type": "TOOL_CALL_ARGS",
+    "toolCallId": "pni486-tool-3",
+    "delta": "{\"surfaceId\":\"canary-dashboard\",\"components\":[{\"id\":\"root\",\"component\":\"Column\",\"children\":[\"title\",\"revenue\",\"growth\"]},{\"id\":\"title\",\"component\":\"Title\",\"text\":\"Canary dashboard\"},{\"id\":\"revenue\",\"component\":\"Metric\",\"label\":\"Revenue\",\"value\":\"$125000\"},{\"id\":\"growth\",\"component\":\"Metric\",\"label\":\"Growth\",\"value\":\"12%\"}]}"
+  },
+  {
+    "type": "TOOL_CALL_END",
+    "toolCallId": "pni486-tool-3"
+  },
+  {
+    "type": "TOOL_CALL_RESULT",
+    "messageId": "native:\"bea84cce-ac09-47fe-a947-3fdd9ab37510\":segment:2",
+    "toolCallId": "pni486-tool-2",
+    "content": "{\"a2ui_operations\":[{\"version\":\"v0.9\",\"createSurface\":{\"surfaceId\":\"flight-search-results\",\"catalogId\":\"copilotkit://app-dashboard-catalog\"}},{\"version\":\"v0.9\",\"updateComponents\":{\"surfaceId\":\"flight-search-results\",\"components\":[{\"id\":\"root\",\"component\":\"Row\",\"children\":{\"componentId\":\"flight-card\",\"path\":\"/flights\"},\"gap\":16},{\"id\":\"flight-card\",\"component\":\"FlightCard\",\"airline\":{\"path\":\"airline\"},\"airlineLogo\":{\"path\":\"airlineLogo\"},\"flightNumber\":{\"path\":\"flightNumber\"},\"origin\":{\"path\":\"origin\"},\"destination\":{\"path\":\"destination\"},\"date\":{\"path\":\"date\"},\"departureTime\":{\"path\":\"departureTime\"},\"arrivalTime\":{\"path\":\"arrivalTime\"},\"duration\":{\"path\":\"duration\"},\"status\":{\"path\":\"status\"},\"price\":{\"path\":\"price\"},\"action\":{\"event\":{\"name\":\"book_flight\",\"context\":{\"flightNumber\":{\"path\":\"flightNumber\"},\"origin\":{\"path\":\"origin\"},\"destination\":{\"path\":\"destination\"},\"price\":{\"path\":\"price\"}}}}}]}},{\"version\":\"v0.9\",\"updateDataModel\":{\"surfaceId\":\"flight-search-results\",\"path\":\"/\",\"value\":{\"flights\":[{\"airline\":\"Delta Airlines\",\"airlineLogo\":\"https://example.com/delta-logo.png\",\"flightNumber\":\"DL123\",\"origin\":\"SFO\",\"destination\":\"JFK\",\"date\":\"Next Tuesday\",\"departureTime\":\"08:00 AM\",\"arrivalTime\":\"04:00 PM\",\"duration\":\"8h\",\"status\":\"On Time\",\"price\":\"$350\"},{\"airline\":\"American Airlines\",\"airlineLogo\":\"https://example.com/aa-logo.png\",\"flightNumber\":\"AA456\",\"origin\":\"SFO\",\"destination\":\"JFK\",\"date\":\"Next Tuesday\",\"departureTime\":\"09:00 AM\",\"arrivalTime\":\"05:00 PM\",\"duration\":\"8h\",\"status\":\"On Time\",\"price\":\"$340\"}]}}}]}"
+  },
+  {
+    "type": "
```

---

### Incident Patch 7: `a17d7cce` (2026-09-30)
**Commit Message**: Merge pull request #2811 from ag-ui-protocol/fix/langgraph-preserve-media-types

fix(langgraph): preserve media types and surface provider errors

**File**: `integrations/langgraph/cross-runtime-parity-cases.json` (modified, +470/-69)
```diff
@@ -1,5 +1,8 @@
 {
   "readme": [
+    "EXCEPTION: outbound video retains TypeScript's existing image_url path for Gemini compatibility.",
+    "Only these cases have typescriptVideoExpect; Python asserts expect unchanged.",
+    "The exception preserves no video filename or remote MIME/modality guarantee.",
     "ONE TABLE, TWO RUNTIMES. Every case below is fed to BOTH langgraph adapters —",
     "`integrations/langgraph/typescript/src/utils.ts` and",
     "`integrations/langgraph/python/ag_ui_langgraph/utils.py` — and both must produce",
@@ -72,10 +75,13 @@
     "  outbound (AG-UI ContentPart -> LangChain content)",
     "    {\"kind\": \"text\", \"text\": <str>}",
     "    {\"kind\": \"image_url\", \"url\": <str>}",
-    "    {\"kind\": \"standard\", \"blockType\": \"audio\"|\"file\",",
-    "     \"sourceType\": \"base64\", \"data\": <str>,",
+    "    {\"kind\": \"standard\", \"blockType\": \"audio\"|\"video\"|\"file\",",
+    "     \"sourceType\": \"base64\"|\"url\", \"data\": <str|null>,",
     "     \"mimeType\": <str|null>, \"filename\": <str|null>}",
     "",
+    "  URL blocks also carry \"url\": <str>; their data is null. The URL is never fetched.",
+    "  Only inline file blocks derive a filename. Remote filenames are supplied, not invented.",
+    "",
     "  `sourceType` is the RECOGNITION MARKER, and it is projected because deleting",
     "  it from an emitted block used to fail ZERO of these cases. It is the key that",
     "  makes a translator see the block as inline base64 media at all: TypeScript",
@@ -5105,7 +5111,7 @@
       "id": "outbound/wellformed/audio/audio-ogg/data",
       "direction": "outbound",
       "axis": "wellformed",
-      "why": "typed AG-UI media item with an inline-data source",
+      "why": "Non-image media keeps its modality and original payload; downstream providers decide whether this format is supported.",
       "content": [
         {
           "type": "audio",
@@ -5116,12 +5122,18 @@
           }
         }
       ],
-      "pythonBuilds": ["AudioPart"],
+      "pythonBuilds": [
+        "AudioPart"
+      ],
       "expect": {
         "kept": [
           {
-            "kind": "image_url",
-            "url": "data:audio/ogg;base64,QUJD"
+            "kind": "standard",
+            "blockType": "audio",
+            "sourceType": "base64",
+            "data": "QUJD",
+            "mimeType": "audio/ogg",
+            "filename": null
           }
         ],
         "dropped": 0,
@@ -5163,7 +5175,7 @@
       "id": "outbound/wellformed/audio/no-mime/data",
       "direction": "outbound",
       "axis": "wellformed",
-      "why": "typed AG-UI media item with an inline-data source",
+      "why": "Non-image media keeps its modality and original payload; downstream providers decide whether this format is supported.",
       "content": [
         {
           "type": "audio",
@@ -5174,12 +5186,18 @@
           }
         }
       ],
-      "pythonBuilds": ["AudioPart"],
+      "pythonBuilds": [
+        "AudioPart"
+      ],
       "expect": {
         "kept": [
           {
-            "kind": "image_url",
-            "url": "data:;base64,QUJD"
+            "kind": "standard",
+            "blockType": "audio",
+            "sourceType": "base64",
+            "data": "QUJD",
+            "mimeType": "application/octet-stream",
+            "filename": null
           }
         ],
         "dropped": 0,
@@ -5190,7 +5208,7 @@
       "id": "outbound/wellformed/audio/url",
       "direction": "outbound",
       "axis": "wellformed",
-      "why": "typed AG-UI media item with a url source: every modality keeps image_url",
+      "why": "Non-image media keeps its modality and original payload; downstream providers decide whether this format is supported.",
       "content": [
         {
           "type": "audio",
@@ -5200,11 +5218,18 @@
           }
         }
       ],
-      "pythonBuilds": ["AudioPart"],
+      "pythonBuilds": [
+        "AudioPart"
+      ],
      
```

**File**: `integrations/langgraph/python/README.md` (modified, +28/-0)
```diff
@@ -4,6 +4,34 @@ Implementation of the AG-UI protocol for LangGraph.
 
 Provides a complete Python integration for LangGraph agents with the AG-UI protocol, including FastAPI endpoint creation and comprehensive event streaming.
 
+## Media inputs
+
+Non-image attachments keep their LangChain content type: audio becomes `audio`,
+video becomes `video`, and documents become `file`. Inline bytes, base64 data URLs,
+and remote URLs retain their payload and supplied filename; the adapter does not
+fetch URLs. Images continue to use `image_url`.
+
+Conversion does not imply model support. The graph's provider, model, and API
+must support the supplied media type and source. Unsupported input is reported
+as a `RUN_ERROR`; it is not relabeled as an image. Existing inline WAV/MP3 MIME aliases
+are normalized for compatibility, while other audio MIME types remain unchanged.
+Provider file handles remain unsupported and are skipped with a warning.
+
+## Run errors
+
+Graph/provider and stream failures are delivered by the public `run()` async
+iterator as a terminal `RUN_ERROR` event, followed by stream completion without
+`RUN_FINISHED`. This also applies to text-only runs. Inspect the yielded error
+event instead of relying on these producer exceptions escaping the iterator.
+Cancellation still propagates, and private stream helpers retain their exception
+behavior.
+
+For TypeScript AG-UI clients consuming this stream, handle producer failures in
+`onRunErrorEvent` when using `runAgent()`, or inspect the emitted `RUN_ERROR` when
+subscribing to `run()`. These producer failures no longer reject the `runAgent()`
+promise or invoke the Observable's `error` callback. Consumer and client-side
+validation failures retain their existing error behavior.
+
 ## Installation
 
 ```bash
```

**File**: `integrations/langgraph/python/ag_ui_langgraph/agent.py` (modified, +19/-5)
```diff
@@ -1583,11 +1583,25 @@ async def run(self, input: RunAgentInput) -> AsyncGenerator[ProcessedEvents, Non
         if input.messages:
             update["messages"] = graph_messages
 
-        async for event_str in self._handle_stream_events(input.model_copy(update=update)):
-            # _dispatch_event returns None for events `subagent_visibility="hidden"`
-            # withholds; this is the one place every emission funnels through.
-            if event_str is not None:
-                yield event_str
+        started = False
+        terminal = False
+        try:
+            async for event_str in self._handle_stream_events(input.model_copy(update=update)):
+                # Hidden subagent events are withheld by _dispatch_event.
+                if event_str is not None:
+                    started = started or event_str.type == EventType.RUN_STARTED
+                    terminal = terminal or event_str.type in (EventType.RUN_ERROR, EventType.RUN_FINISHED)
+                    yield event_str
+        except Exception as exc:
+            # The public SSE boundary must deliver the provider's error rather
+            # than aborting the HTTP stream. Private helpers still raise, and
+            # CancelledError/GeneratorExit are deliberately not caught here.
+            if terminal:
+                raise
+            logger.exception("LangGraph run failed")
+            if not started:
+                yield RunStartedEvent(type=EventType.RUN_STARTED, thread_id=input.thread_id, run_id=input.run_id)
+            yield RunErrorEvent(type=EventType.RUN_ERROR, message=str(exc) or type(exc).__name__)
 
     async def _handle_stream_events(self, input: RunAgentInput) -> AsyncGenerator[ProcessedEvents, None]:
         thread_id = input.thread_id or str(uuid.uuid4())
```

**File**: `integrations/langgraph/python/ag_ui_langgraph/utils.py` (modified, +68/-436)
```diff
@@ -160,43 +160,7 @@ def stringify_if_needed(item: Any) -> str:
 
 
 def _agui_media_type_for_mime_type(mime_type: str) -> str:
-    """Recover an ``image_url`` block's AG-UI media type from its data URL's MIME type.
-
-    WHY THIS EXISTS. ``image_url`` is not the image path — it is the fallback path
-    for every modality `_standard_block_for` refuses, which is video (no standard
-    block converts, in either runtime), audio outside `_OPENAI_AUDIO_MIME_TYPES`,
-    and every URL-sourced item. Reading the block kind literally therefore turned
-    an attached video into an ``ImageInputContent`` in MESSAGES_SNAPSHOT,
-    permanently: the thread was rewritten, and every later read of it saw an
-    image. The outbound leg is deliberately unchanged — see
-    :func:`convert_agui_multimodal_to_langchain` — so the fix belongs here.
-
-    The MIME type inside ``data:<mime>;base64,…`` is the original one this adapter
-    put there, so on the DATA path the modality is fully recoverable. The mapping
-    mirrors how the legacy ``binary`` OUTBOUND leg classifies the same string:
-    image/video/audio by major type, everything else a document. Symmetric by
-    construction, which is the property that keeps a round trip stable.
-
-    Two cases are NOT recoverable and stay images, which is what they already were:
-
-      1. URL-sourced media. ``image_url`` carries ``{"url": …}`` and nothing else,
-         so a video at an https URL arrives with no MIME type and no other signal.
-         AG-UI lets a url source declare ``mime_type``, but this adapter cannot put
-         it on the wire: extra keys inside a content block are what issue #2100 was
-         about (strict OpenAI-compatible providers 400 on "Unexpected keys in a
-         message content image dict"), and the outbound shape here is load-bearing.
-         Guessing from a file extension is not a signal — signed and extensionless
-         CDN URLs are the norm. So a URL-sourced non-image loses its modality, and
-         this is the documented limit of this fix rather than something it covers.
-      2. A data URL with no MIME type at all (``data:;base64,…``), where there is
-         nothing to read. The pre-existing ``image/png`` default applies — see the
-         ``or "image/png"`` in `convert_langchain_multimodal_to_agui`, which is
-         what the mirrored TypeScript adapter records for the same input. The
-         block stays an ``image``, which is what it already was.
-
-    ``metadata.filename`` is lost on this path in both directions regardless — the
-    ``image_url`` block has nowhere to carry it.
-    """
+    """Recover media types from legacy ``image_url`` data URLs in saved threads."""
     major, _, subtype = mime_type.partition("/")
     # A string that is not `major/subtype` carries no modality; keep the historical
     # answer rather than inventing a new wrong one.
@@ -419,7 +383,11 @@ def _agui_media_from_standard_block(item: Dict[str, Any]):
     if incoming is None:
         return None
 
-    filename = _supplied_filename(item["type"], incoming.filename, incoming.mime_type)
+    # URL blocks never receive derived filenames, so every supplied name is real.
+    filename = (
+        incoming.filename if incoming.is_url
+        else _supplied_filename(item["type"], incoming.filename, incoming.mime_type)
+    )
     metadata = {"filename": filename} if filename else None
 
     if incoming.is_url:
@@ -487,9 +455,9 @@ def convert_langchain_multimodal_to_agui(content: Union[str, List[Union[str, Dic
     converts bare-string message content itself.
 
     ``image_url`` blocks are converted with the appropriate source type (data or
-    URL) and to the media class their MIME type names — ``image_url`` is the
-    fallback block for every modality the outbound leg cannot send as a standard
-    block, so it is NOT evidence of an image. See
+    URL) and to the media class their MIME type names. Older adapter versions
+    emitted non-image media t
```

**File**: `integrations/langgraph/python/tests/test_media_preservation.py` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+"""Provider-neutral attachment conversion without model calls or URL fetches."""
+import unittest
+
+from ag_ui_langgraph.utils import (
+    BinaryInputContent,
+    convert_agui_multimodal_to_langchain,
+    convert_langchain_multimodal_to_agui,
+)
+from tests._helpers import AudioPart, VideoPart, DocumentPart, DataSource, UrlSource
+
+
+class TestMediaPreservation(unittest.TestCase):
+    def test_remote_document_keeps_a_supplied_name_matching_an_inline_default(self):
+        original = DocumentPart(
+            source=UrlSource(
+                type="url", value="https://example.com/object", mime_type="application/pdf"
+            ),
+            metadata={"filename": "attachment.pdf"},
+        )
+        [returned] = convert_langchain_multimodal_to_agui(
+            convert_agui_multimodal_to_langchain([original])
+        )
+        self.assertEqual(returned.metadata, {"filename": "attachment.pdf"})
+
+    def test_non_image_media_preserve_kind_payload_mime_and_filename(self):
+        for cls, kind, block_type, mime in (
+            (AudioPart, "audio", "audio", "audio/ogg"),
+            (VideoPart, "video", "video", "video/mp4"),
+            (DocumentPart, "document", "file", "text/plain"),
+        ):
+            for source_kind in (
+                "data", "data_url", "url",
+                "legacy_data", "legacy_data_url", "legacy_url",
+            ):
+                with self.subTest(kind=kind, source=source_kind):
+                    remote = source_kind in ("url", "legacy_url")
+                    value = "https://example.com/signed?token=abc" if remote else "AAECA/8="
+                    wire_value = (
+                        f"data:{mime};base64,{value}"
+                        if source_kind.endswith("data_url") else value
+                    )
+                    if source_kind.startswith("legacy"):
+                        field = "data" if source_kind == "legacy_data" else "url"
+                        original = BinaryInputContent(
+                            mime_type=mime, filename="original.bin", **{field: wire_value}
+                        )
+                    else:
+                        source = (
+                            DataSource(type="data", value=value, mime_type=mime)
+                            if source_kind == "data"
+                            else UrlSource(type="url", value=wire_value, mime_type=mime)
+                        )
+                        original = cls(
+                            type=kind, source=source, metadata={"filename": "original.bin"}
+                        )
+                    [block] = convert_agui_multimodal_to_langchain([original])
+                    expected = {
+                        "type": block_type, "mime_type": mime, "filename": "original.bin",
+                    }
+                    expected.update(
+                        {"source_type": "url", "url": value} if remote else {"base64": value}
+                    )
+                    self.assertEqual(block, expected)
+                    [returned] = convert_langchain_multimodal_to_agui([block])
+                    self.assertIsInstance(returned, cls)
+                    self.assertEqual(returned.source.value, value)
+                    self.assertEqual(returned.source.mime_type, mime)
+                    self.assertEqual(returned.metadata["filename"], "original.bin")
+
+    def test_remote_media_without_mime_do_not_invent_one(self):
+        for cls, kind, block_type in (
+            (AudioPart, "audio", "audio"),
+            (VideoPart, "video", "video"),
+            (DocumentPart, "document", "file"),
+        ):
+            with self.subTest(kind=kind):
+                [block] = convert_agui_multimodal_to_langchain([
+                    cls(type=kind, source=UrlSource(type="url", value="https://example.com/object"))
+                ])
+                self.assertEqual(block, {
+                    "type": block_type, "sou
```

---

### Incident Patch 8: `331197a2` (2026-09-29)
**Commit Message**: fix(dojo): type the tool approval interrupt render without any

**File**: `apps/dojo/src/app/[integrationId]/feature/(v2)/tool_approval/page.tsx` (modified, +7/-2)
```diff
@@ -21,6 +21,11 @@ interface ApprovalRequest {
   args?: { amount?: number; description?: string };
 }
 
+// Approval details as the bridge sends them, before the type check.
+interface ApprovalPayload extends ApprovalRequest {
+  type?: unknown;
+}
+
 // The @ag-ui/mastra bridge publishes a pending approval on both channels: the
 // standard interrupt (`event.value` is the Interrupt, details under
 // `metadata.mastra`) and the legacy on_interrupt event (`event.value` is a JSON
@@ -35,9 +40,9 @@ function readApprovalRequest(value: unknown): ApprovalRequest | null {
     }
   }
   if (!parsed || typeof parsed !== "object") return null;
-  const standard = (parsed as { metadata?: { mastra?: Record<string, any> } })
+  const standard = (parsed as { metadata?: { mastra?: ApprovalPayload } })
     .metadata?.mastra;
-  const request = standard ?? (parsed as Record<string, any>);
+  const request = standard ?? (parsed as ApprovalPayload);
   if (request.type !== "mastra_tool_approval") return null;
   return { toolName: request.toolName, args: request.args };
 }
```

**File**: `apps/dojo/src/files.json` (modified, +2/-2)
```diff
@@ -1640,7 +1640,7 @@
   "mastra::tool_approval": [
     {
       "name": "page.tsx",
-      "content": "\"use client\";\nimport React, { useState } from \"react\";\nimport \"@copilotkit/react-core/v2/styles.css\";\nimport {\n  CopilotChat,\n  CopilotChatConfigurationProvider,\n  useConfigureSuggestions,\n  useInterrupt,\n  useRenderTool,\n} from \"@copilotkit/react-core/v2\";\nimport { CopilotKit } from \"@copilotkit/react-core\";\nimport { useTheme } from \"next-themes\";\nimport { z } from \"zod\";\n\ninterface ToolApprovalProps {\n  params: Promise<{ integrationId: string }>;\n}\n\ninterface ApprovalRequest {\n  toolName?: string;\n  args?: { amount?: number; description?: string };\n}\n\n// The @ag-ui/mastra bridge publishes a pending approval on both channels: the\n// standard interrupt (`event.value` is the Interrupt, details under\n// `metadata.mastra`) and the legacy on_interrupt event (`event.value` is a JSON\n// string). Returns null for any other interrupt so this hook ignores it.\nfunction readApprovalRequest(value: unknown): ApprovalRequest | null {\n  let parsed: unknown = value;\n  if (typeof parsed === \"string\") {\n    try {\n      parsed = JSON.parse(parsed);\n    } catch {\n      return null;\n    }\n  }\n  if (!parsed || typeof parsed !== \"object\") return null;\n  const standard = (parsed as { metadata?: { mastra?: Record<string, any> } })\n    .metadata?.mastra;\n  const request = standard ?? (parsed as Record<string, any>);\n  if (request.type !== \"mastra_tool_approval\") return null;\n  return { toolName: request.toolName, args: request.args };\n}\n\n// Shape of the `record_expense` tool result once the approved call has run.\ninterface ExpenseRecord {\n  expenseId?: string;\n  amount?: number;\n  description?: string;\n  status?: string;\n}\n\nconst ToolApproval: React.FC<ToolApprovalProps> = ({ params }) => {\n  const { integrationId } = React.use(params);\n\n  return (\n    <CopilotKit\n      runtimeUrl={`/api/copilotkit/${integrationId}`}\n      showDevConsole={false}\n      agent=\"tool_approval\"\n    >\n      <CopilotChatConfigurationProvider agentId=\"tool_approval\">\n        <ChatContent />\n      </CopilotChatConfigurationProvider>\n    </CopilotKit>\n  );\n};\n\nconst ChatContent = () => {\n  useConfigureSuggestions({\n    suggestions: [\n      {\n        title: \"Record a team dinner\",\n        message: \"Record a $250 expense for the team dinner.\",\n      },\n      {\n        title: \"Log a taxi ride\",\n        message: \"Log a $42 taxi ride to the airport as an expense.\",\n      },\n    ],\n    available: \"always\",\n  });\n\n  // The paused call waits in Mastra's storage. Approve and Reject both resolve\n  // the interrupt, so the bridge hands the decision to Mastra's own\n  // approveToolCall / declineToolCall for the original call.\n  useInterrupt({\n    agentId: \"tool_approval\",\n    renderInChat: true,\n    enabled: (event) => readApprovalRequest(event.value) !== null,\n    render: ({ event, resolve }) => {\n      const request = readApprovalRequest(event.value) ?? {};\n      return (\n        <ApprovalCard\n          toolName={request.toolName ?? \"tool\"}\n          amount={request.args?.amount}\n          description={request.args?.description}\n          onApprove={() => resolve({ approved: true })}\n          onReject={() => resolve({ approved: false })}\n        />\n      );\n    },\n  });\n\n  // Renders the original call once the resumed run delivers its result.\n  useRenderTool({\n    name: \"record_expense\",\n    parameters: z.object({\n      amount: z.number().optional(),\n      description: z.string().optional(),\n    }),\n    render: ({ parameters, result, status }) => {\n      if (status !== \"complete\") {\n        return (\n          <div className=\"rounded-lg border border-gray-200 p-3 text-sm\">\n            Recording {parameters?.description ?? \"expense\"}...\n          </div>\n        );\n      }\n      let parsed: unknown = result;\n      if (typeof
```

---

### Incident Patch 9: `294a5bde` (2026-09-29)
**Commit Message**: fix(client): apply every received event before a run's source error propagates

When an agent emitted RUN_ERROR and then errored its Observable, which is
how the Mastra and LangGraph adapters report a failed run, the error reached
the apply stage immediately. The concatMap in defaultApplyEvents tore down
the in-flight async subscriber call and dropped every queued event, so
onEvent and onRunErrorEvent never saw the RUN_ERROR, and earlier text
message events could be lost as well. onRunFailed still fired and runAgent()
still rejected, so the failure looked handled while its details vanished.

runAgent() and connectAgent() now run apply and processApplyEvents through
one private stage that turns a source error into a completion for apply,
lets both stages drain every event already received, and only then rethrows
the original error object. Because the guarantee lives around the protected
apply and processApplyEvents hooks rather than inside defaultApplyEvents,
subclasses that override them get the same ordering. Detach is unaffected:
it completes the source through takeUntil, so it never reaches this path.

Events before a protocol violation found by verification or enforcement are
n

**File**: `sdks/typescript/packages/client/src/agent/__tests__/agent-detach.test.ts` (modified, +47/-0)
```diff
@@ -7,6 +7,7 @@ import {
   RunAgentInput,
   RunFinishedEvent,
   RunStartedEvent,
+  TextMessageStartEvent,
 } from "@ag-ui/core";
 
 /** Emits RUN_STARTED and stays open until detached. */
@@ -90,6 +91,52 @@ describe("single-run detachment", () => {
     },
   );
 
+  it("ignores events and a stream error sent after detaching, even with slow subscribers", async () => {
+    const agent = new HangingAgent({ debug: false });
+    const seen: string[] = [];
+    const onRunFailed = vi.fn();
+    const onRunFinalized = vi.fn();
+    let releaseFirst: (() => void) | undefined;
+    const run = agent.runAgent(
+      { runId: "detach-slow" },
+      {
+        onEvent: async ({ event }) => {
+          if (seen.length === 0) {
+            await new Promise<void>((resolve) => (releaseFirst = resolve));
+          }
+          seen.push(event.type);
+        },
+        onRunFailed,
+        onRunFinalized,
+      },
+    );
+    await waitForRuns(agent, 1);
+    await vi.waitFor(() => expect(releaseFirst).toBeDefined());
+
+    // Queued before the detach: already received, so it is still applied.
+    const queued: TextMessageStartEvent = {
+      type: EventType.TEXT_MESSAGE_START,
+      messageId: "queued",
+      role: "assistant",
+    };
+    agent.open[0].next(queued);
+    const detached = agent.detachActiveRun();
+    agent.open[0].next({ ...queued, messageId: "after-detach" });
+    agent.open[0].error(new Error("stream failed after detach"));
+    releaseFirst?.();
+
+    await detached;
+    await expect(run).resolves.toEqual({
+      result: undefined,
+      newMessages: [{ id: "queued", role: "assistant", content: "" }],
+    });
+    expect(seen).toEqual([EventType.RUN_STARTED, EventType.TEXT_MESSAGE_START]);
+    expect(agent.teardowns).toBe(1);
+    expect(onRunFailed).not.toHaveBeenCalled();
+    expect(onRunFinalized).toHaveBeenCalledTimes(1);
+    expect(agent.isRunning).toBe(false);
+  });
+
   it("is a no-op when idle and does not affect a later run", async () => {
     const agent = new HangingAgent({ debug: false });
     await agent.detachActiveRun();
```

**File**: `sdks/typescript/packages/client/src/agent/__tests__/agent-run-error.test.ts` (modified, +134/-1)
```diff
@@ -9,8 +9,13 @@
  *
  * The agent INSTANCE is likewise untouched: a new run on the same object starts
  * clean.
+ *
+ * A producer that also errors its stream after the RUN_ERROR (the shape the
+ * Mastra and LangGraph adapters use) does fail the run, but only after every
+ * event it sent first has been delivered to subscribers and applied.
  */
 import { Observable, Subject, of } from "rxjs";
+import { concatMap } from "rxjs/operators";
 import { transformHttpEventStream } from "@/transform/http";
 import { HttpEventType, type HttpEvent } from "@/run/http-request";
 import { AbstractAgent } from "../agent";
@@ -21,7 +26,7 @@ import {
   RunFinishedEvent,
   RunStartedEvent,
 } from "@ag-ui/core";
-import type { AgentSubscriber } from "../subscriber";
+import type { AgentStateMutation, AgentSubscriber } from "../subscriber";
 import type { RunAgentResult } from "../agent";
 
 /** Replays a different scripted stream on each successive run. */
@@ -264,3 +269,131 @@ describe("the abort contract", () => {
     expect(seen instanceof Error).toBe(true);
   });
 });
+
+const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
+
+/** Sends `events`, then errors the stream with `error`, all synchronously. */
+function failingStream(events: BaseEvent[], error: Error): Observable<BaseEvent> {
+  return new Observable<BaseEvent>((subscriber) => {
+    events.forEach((event) => subscriber.next(event));
+    subscriber.error(error);
+  });
+}
+
+class FailingStreamAgent extends AbstractAgent {
+  constructor(
+    private events: BaseEvent[],
+    private error: Error,
+  ) {
+    super();
+    this.debug = false;
+  }
+  run(_input: RunAgentInput): Observable<BaseEvent> {
+    return failingStream(this.events, this.error);
+  }
+  protected connect(_input: RunAgentInput): Observable<BaseEvent> {
+    return failingStream(this.events, this.error);
+  }
+}
+
+/** Slow subscribers: each callback yields to a timer before returning. */
+function slowRecorder() {
+  const seen: string[] = [];
+  const runErrors: BaseEvent[] = [];
+  const subscriber = {
+    onEvent: async ({ event }) => {
+      await delay(10);
+      seen.push(event.type);
+    },
+    onRunErrorEvent: async ({ event }) => {
+      await delay(10);
+      runErrors.push(event);
+    },
+    onRunFailed: vi.fn(),
+    onRunFinalized: vi.fn(),
+  } satisfies AgentSubscriber;
+  return { seen, runErrors, subscriber };
+}
+
+describe("a stream that errors after sending events", () => {
+  const runError = { type: EventType.RUN_ERROR, message: "model failed" } as BaseEvent;
+  const failedRun = [started("r1"), ...message("m1", "partial answer"), runError];
+
+  it.each(["runAgent", "connectAgent"] as const)(
+    "%s delivers the RUN_ERROR and everything before it, then rejects with the stream's error",
+    async (method) => {
+      const error = new Error("stream failed after RUN_ERROR");
+      const agent = new FailingStreamAgent(failedRun, error);
+      const { seen, runErrors, subscriber } = slowRecorder();
+
+      const logged = await loggedErrorsDuring(async () => {
+        await expect(agent[method]({ runId: "r1" }, subscriber)).rejects.toBe(error);
+      });
+
+      expect(seen).toEqual([
+        EventType.RUN_STARTED,
+        EventType.TEXT_MESSAGE_START,
+        EventType.TEXT_MESSAGE_CONTENT,
+        EventType.TEXT_MESSAGE_END,
+        EventType.RUN_ERROR,
+      ]);
+      expect(runErrors).toEqual([runError]);
+      expect(agent.messages).toEqual([{ id: "m1", role: "assistant", content: "partial answer" }]);
+      expect(subscriber.onRunFailed).toHaveBeenCalledTimes(1);
+      expect(subscriber.onRunFailed.mock.calls[0][0].error).toBe(error);
+      await vi.waitFor(() => expect(subscriber.onRunFinalized).toHaveBeenCalledTimes(1));
+      expect(agent.isRunning).toBe(false);
+      expect(logged).toContain("Agent execution failed");
+    },
+  );
+
+  it("applies every event before a plain stream error, with no RUN_ERROR"
```

**File**: `sdks/typescript/packages/client/src/agent/agent.ts` (modified, +37/-5)
```diff
@@ -25,7 +25,7 @@ import { compareVersions, validate as validateVersion } from "compare-versions";
 import { catchError, map, tap } from "rxjs/operators";
 import { finalize } from "rxjs/operators";
 import { takeUntil } from "rxjs/operators";
-import { pipe, Observable, from, of, EMPTY, Subject, defer } from "rxjs";
+import { pipe, Observable, from, of, EMPTY, Subject, defer, concatWith, throwError } from "rxjs";
 import { verifyEvents } from "@/verify";
 import { convertToLegacyEvents } from "@/legacy/convert";
 import { LegacyRuntimeProtocolEvent } from "@/legacy/types";
@@ -370,8 +370,7 @@ export abstract class AbstractAgent {
         verifyEvents(this.debugLogger),
         // Stop processing immediately when this run is detached
         (source$) => source$.pipe(takeUntil(this.activeRunDetach$!)),
-        (source$) => this.apply(input, source$, subscribers),
-        (source$) => this.processApplyEvents(input, source$, subscribers),
+        (source$) => this.applyBeforeSourceError(input, source$, subscribers),
         catchError((error) => {
           this.debugLogger?.lifecycle("LIFECYCLE", "Run errored:", {
             agentId: this.agentId,
@@ -454,8 +453,7 @@ export abstract class AbstractAgent {
         verifyEvents(this.debugLogger),
         // Stop processing immediately when this run is detached
         (source$) => source$.pipe(takeUntil(this.activeRunDetach$!)),
-        (source$) => this.apply(input, source$, subscribers),
-        (source$) => this.processApplyEvents(input, source$, subscribers),
+        (source$) => this.applyBeforeSourceError(input, source$, subscribers),
         catchError((error) => {
           this.isRunning = false;
           if (!(error instanceof AGUIConnectNotImplementedError)) {
@@ -497,6 +495,40 @@ export abstract class AbstractAgent {
     await completion;
   }
 
+  /**
+   * Runs apply and processApplyEvents so that every event received before the
+   * source errors is fully applied first. The error is held back as a
+   * completion, then rethrown unchanged once both stages have drained.
+   */
+  private applyBeforeSourceError(
+    input: RunAgentInput,
+    source$: Observable<BaseEvent>,
+    subscribers: AgentSubscriber[],
+  ): Observable<AgentStateMutation> {
+    return defer(() => {
+      let sourceError: { error: unknown } | undefined;
+      const events$ = source$.pipe(
+        catchError((error: unknown) => {
+          sourceError = { error };
+          return EMPTY;
+        }),
+      );
+      const applied$ = this.processApplyEvents(
+        input,
+        this.apply(input, events$, subscribers),
+        subscribers,
+      );
+      return applied$.pipe(
+        concatWith(
+          defer(() => {
+            const pending = sourceError;
+            return pending ? throwError(() => pending.error) : EMPTY;
+          }),
+        ),
+      );
+    });
+  }
+
   protected apply(
     input: RunAgentInput,
     events$: Observable<BaseEvent>,
```

---

### Incident Patch 10: `3170c1a5` (2026-09-29)
**Commit Message**: fix(mastra): keep the Observable error after RUN_ERROR so the failure contract is unchanged

**File**: `integrations/mastra/typescript/src/__tests__/cancellation.test.ts` (modified, +10/-3)
```diff
@@ -545,7 +545,7 @@ describe("run() cancellation propagation (#2288)", () => {
       ).resolves.toBeDefined();
     });
 
-    it("does not report a stream that rejects after abortRun() as a RUN_ERROR", async () => {
+    it("does not report a stream that rejects after abortRun() as a failure", async () => {
       const gate = deferred();
       const stream = (async function* () {
         yield { type: "text-delta", payload: { text: "first" } };
@@ -563,13 +563,20 @@ describe("run() cancellation propagation (#2288)", () => {
       const events: BaseEvent[] = [];
       const firstChunk = deferred();
       const settled = deferred();
+      let outcome: "complete" | "error" | null = null;
       agent.run(STREAM_INPUT).subscribe({
         next: (event) => {
           events.push(event);
           if (event.type === EventType.TEXT_MESSAGE_CHUNK) firstChunk.release();
         },
-        error: () => settled.release(),
-        complete: () => settled.release(),
+        error: () => {
+          outcome = "error";
+          settled.release();
+        },
+        complete: () => {
+          outcome = "complete";
+          settled.release();
+        },
       });
 
       await firstChunk.promise;
```

**File**: `integrations/mastra/typescript/src/__tests__/edge-cases.test.ts` (modified, +26/-26)
```diff
@@ -342,8 +342,12 @@ describe("error handling", () => {
     ])(
       "ends a %s run that hits an error chunk with exactly one RUN_ERROR",
       async (_kind, makeAgent) => {
-        const { events } = await collectRunError(makeAgent(), makeInput());
+        const { error, events } = await collectRunError(
+          makeAgent(),
+          makeInput(),
+        );
 
+        expect(error.message).toBe("Model overloaded");
         expect(events.map((e) => e.type)).toEqual([
           EventType.RUN_STARTED,
           EventType.TEXT_MESSAGE_CHUNK,
@@ -356,18 +360,22 @@ describe("error handling", () => {
       },
     );
 
-    it("emits RUN_ERROR when the local agent's stream() throws", async () => {
+    it("emits RUN_ERROR, then the original error, when the local agent's stream() throws", async () => {
+      const thrown = new Error("Agent connection failed");
       const fakeAgent = new FakeLocalAgent({ streamChunks: [] });
       fakeAgent.stream = async () => {
-        throw new Error("Agent connection failed");
+        throw thrown;
       };
       const agent = new MastraAgent({
         agentId: "test-agent",
         agent: fakeAgent as any,
         resourceId: "resource-1",
       });
 
-      const { events } = await collectRunError(agent, makeInput());
+      const { error, events } = await collectRunError(agent, makeInput());
+
+      // The Observable still errors with the very error that was thrown.
+      expect(error).toBe(thrown);
 
       expect(events.map((e) => e.type)).toEqual([
         EventType.RUN_STARTED,
@@ -376,9 +384,8 @@ describe("error handling", () => {
       expect((events[1] as any).message).toBe("Agent connection failed");
     });
 
-    // runAgent() applies events asynchronously. Erroring the Observable right
-    // after RUN_ERROR tears that pipeline down before the event is applied, so
-    // these drive runAgent() rather than the raw Observable.
+    // Emitting RUN_ERROR must not change what runAgent() callers already rely
+    // on: the run still rejects with the original error and onRunFailed fires.
     it.each([
       [
         "fresh run",
@@ -412,37 +419,30 @@ describe("error handling", () => {
         },
       ],
     ])(
-      "delivers the RUN_ERROR to runAgent() subscribers on a %s",
+      "keeps runAgent() rejecting with the original error on a %s",
       async (_kind, makeAgent, params) => {
+        const errorSpy = vi
+          .spyOn(console, "error")
+          .mockImplementation(() => {});
         const agent = makeAgent();
-        const runErrors: string[] = [];
         const failures: unknown[] = [];
-        const seen: string[] = [];
 
-        const settled = await agent
+        const rejection = await agent
           .runAgent(params, {
-            onEvent: ({ event }) => {
-              seen.push(event.type);
-            },
-            onRunErrorEvent: ({ event }) => {
-              runErrors.push(event.message);
-            },
             onRunFailed: ({ error }) => {
               failures.push(error);
             },
           })
           .then(
-            () => "resolved",
-            () => "rejected",
+            () => undefined,
+            (error: unknown) => error,
           );
+        errorSpy.mockRestore();
 
-        expect(runErrors).toEqual(["Model overloaded"]);
-        expect(seen[seen.length - 1]).toBe(EventType.RUN_ERROR);
-        expect(seen).not.toContain(EventType.RUN_FINISHED);
-        // The failure is reported as an event, like an HttpAgent whose server
-        // sent RUN_ERROR and closed the stream, not as a rejected run.
-        expect(settled).toBe("resolved");
-        expect(failures).toEqual([]);
+        expect(rejection).toBeInstanceOf(Error);
+        expect((rejection as Error).message).toBe("Model overloaded");
+        expect(failures).toHaveLength(1);
+        expect(failures[0]).toBe(rejection);
       },
     );
   });
```

**File**: `integrations/mastra/typescript/src/__tests__/helpers.ts` (modified, +8/-12)
```diff
@@ -1,4 +1,4 @@
-import type { BaseEvent, RunAgentInput, RunErrorEvent } from "@ag-ui/client";
+import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
 import { EventType } from "@ag-ui/client";
 import { firstValueFrom, toArray } from "rxjs";
 import { MastraAgent } from "../mastra";
@@ -223,35 +223,31 @@ export function collectEvents(
 }
 
 /**
- * Runs `input` to a failure. A failed run ends with exactly one RUN_ERROR and
- * then completes, the same shape a remote agent has over HttpAgent. Rejects if
- * the run finishes cleanly, errors the Observable, or reports more than once.
+ * Runs `input` to a failure: exactly one RUN_ERROR as the last event, then an
+ * Observable error. Rejects if the run completes or errors without that event.
  */
 export function collectRunError(
   agent: MastraAgent,
   input: RunAgentInput,
-): Promise<{ error: RunErrorEvent; events: BaseEvent[] }> {
+): Promise<{ error: Error; events: BaseEvent[] }> {
   const events: BaseEvent[] = [];
   return new Promise((resolve, reject) => {
     agent.run(input).subscribe({
       next: (event) => events.push(event),
-      error: (err) =>
-        reject(
-          new Error(`Expected RUN_ERROR then completion, got an error: ${err}`),
-        ),
-      complete: () => {
+      error: (err) => {
         const last = events[events.length - 1];
         const runErrors = events.filter((e) => e.type === EventType.RUN_ERROR);
         if (runErrors.length === 1 && last?.type === EventType.RUN_ERROR) {
-          resolve({ error: last as RunErrorEvent, events });
+          resolve({ error: err, events });
         } else {
           reject(
             new Error(
-              `Expected one terminal RUN_ERROR, got: ${events.map((e) => e.type).join(", ")}`,
+              `Expected one RUN_ERROR before the error, got: ${events.map((e) => e.type).join(", ")}`,
             ),
           );
         }
       },
+      complete: () => reject(new Error("Expected error but completed")),
     });
   });
 }
```

**File**: `integrations/mastra/typescript/src/__tests__/interrupt-bridge.test.ts` (modified, +12/-2)
```diff
@@ -832,12 +832,16 @@ describe("interrupt bridge: standard RUN_FINISHED.outcome (opt-in)", () => {
         } as any),
       );
 
+      expect(error.name).toBe("ResumeRequestError");
       expect(error.message).toContain("Invalid resume entry");
-      expect(error.code).toBeUndefined();
       expect(events.map((e) => e.type)).toEqual([
         EventType.RUN_STARTED,
         EventType.RUN_ERROR,
       ]);
+      expect(events[1]).toEqual({
+        type: EventType.RUN_ERROR,
+        message: error.message,
+      });
       expect(calls).toHaveLength(0);
       expect(streamSpy).not.toHaveBeenCalled();
     });
@@ -892,8 +896,14 @@ describe("interrupt bridge: standard RUN_FINISHED.outcome (opt-in)", () => {
         EventType.RUN_STARTED,
         EventType.RUN_ERROR,
       ]);
-      expect(error.code).toBe("MASTRA_MULTIPLE_RESUME_ENTRIES");
+      expect(error.name).toBe("ResumeRequestError");
+      expect((error as any).code).toBe("MASTRA_MULTIPLE_RESUME_ENTRIES");
       for (const id of ids) expect(error.message).toContain(id);
+      expect(events[1]).toEqual({
+        type: EventType.RUN_ERROR,
+        message: error.message,
+        code: "MASTRA_MULTIPLE_RESUME_ENTRIES",
+      });
     });
   });
 });
```

**File**: `integrations/mastra/typescript/src/mastra.ts` (modified, +6/-6)
```diff
@@ -827,11 +827,11 @@ export class MastraAgent extends AbstractAgent {
       }
 
       // The single failure exit for this run: exactly one RUN_ERROR, then the
-      // Observable completes, the same shape a remote agent has over HttpAgent.
-      // Completing rather than erroring is deliberate: runAgent() applies events
-      // asynchronously, and an Observable error tears that pipeline down before
-      // the RUN_ERROR reaches onRunErrorEvent. A cancelled run is settled by the
-      // abort listener above instead and reports nothing.
+      // Observable errors with the original error, so the existing failure
+      // contract (rejections, onRunFailed, the Error itself) is unchanged.
+      // runAgent() subscribers may not see the RUN_ERROR until the client
+      // applies queued events before propagating a source error. A cancelled
+      // run is settled by the abort listener above instead and reports nothing.
       let runErrored = false;
       const failRun = (error: unknown, code?: string) => {
         if (runErrored || subscriber.closed || abortController.signal.aborted) {
@@ -843,7 +843,7 @@ export class MastraAgent extends AbstractAgent {
           message: error instanceof Error ? error.message : String(error),
           ...(code ? { code } : {}),
         } as RunErrorEvent);
-        subscriber.complete();
+        subscriber.error(error);
       };
 
       const run = async () => {
```

#### Recent Merged Pull Requests:
- **PR #2875** (2026-09-30): fix(mastra): keep a resumed tool call under the message that owns it (@ranst91)
- **PR #2873** (2026-09-30): release: integration-mastra + middleware-a2ui (@ag-ui-devops-bot[bot])
- **PR #2868** (2026-09-30): fix(client): apply every received event before a run's source error propagates (@ranst91)
- **PR #2867** (2026-09-30): fix(mastra): surface native tool approvals as interrupts and complete them through Mastra (@ranst91)
- **PR #2864** (2026-09-29): ci(release): raise npm visibility budget to 15min per package (@mme)
- **PR #2861** (2026-09-29): release: sdk-ts (@ag-ui-devops-bot[bot])
- **PR #2860** (closed): Allow sequential resumes of parallel tool approvals (@portswigger-gal)
- **PR #2859** (2026-09-29): fix(kotlin): preserve v1 payloads and recover state patch failures (@contextablemark)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
