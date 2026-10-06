# Forensic Learning Record (Deep Inspection): punitarani/fli

> **Canonical Artifact**: `07_PROJECT_LEARNING/punitarani-fli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/punitarani/fli](https://github.com/punitarani/fli))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:16.945Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `punitarani/fli`
- **Description**: Google Flights MCP, CLI and Python Library
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3208 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fli-js/src/core/airports.ts`
```
/**
 * Airport search by IATA code, city name, or airport name.
 * 1:1 port of fli/core/airports.py — same 5-priority cascade.
 */

import { AIRPORT_NAMES, type Airport } from "../models/airport.ts";

export type MatchType = "iata_exact" | "iata_prefix" | "city" | "name";

export interface AirportMatch {
  code: Airport;
  name: string;
  match_type: MatchType;
  score: number;
}

/**
 * Curated multi-airport city aliases (e.g., "new york" → JFK / LGA / EWR).
 * Mirrors the Python CITY_AIRPORTS dict.
 */
export const CITY_AIRPORTS: Record<string, string[]> = {
  "new york": ["JFK", "LGA", "EWR"],
  nyc: ["JFK", "LGA", "EWR"],
  chicago: ["ORD", "MDW"],
  washington: ["IAD", "DCA", "BWI"],
  "washington dc": ["IAD", "DCA", "BWI"],
  london: ["LHR", "LGW", "STN", "LTN", "LCY"],
  paris: ["CDG", "ORY"],
  tokyo: ["NRT", "HND"],
  osaka: ["KIX", "ITM"],
  seoul: ["ICN", "GMP"],
  beijing: ["PEK", "PKX"],
  shanghai: ["PVG", "SHA"],
  bangkok: ["BKK", "DMK"],
  istanbul: ["IST", "SAW"],
  moscow: ["SVO", "DME", "VKO"],
  milan: ["MXP", "LIN"],
  rome: ["FCO", "CIA"],
  berlin: ["BER"],
  mumbai: ["BOM"],
  delhi: ["DEL"],
  "sao paulo": ["GRU", "CGH"],
  rio: ["GIG", "SDU"],
  "rio de janeiro": ["GIG", "SDU"],
  toronto: ["YYZ", "YTZ"],
  montreal: ["YUL"],
  "mexico city": ["MEX"],
  "buenos aires": ["EZE", "AEP"],
  dubai: ["DXB", "DWC"],
  singapore: ["SIN"],
  "hong kong": ["HKG"],
  taipei: ["TPE", "TSA"],
  sydney: ["SYD"],
  melbourne: ["MEL"],
  "san francisco": ["SFO", "OAK", "SJC"],
  sf: ["SFO", "OAK", "SJC"],
  "bay area": ["SFO", "OAK", "SJC"],
  "los angeles": ["LAX", "BUR", "SNA", "ONT", "LGB"],
  la: ["LAX", "BUR", "SNA", "ONT", "LGB"],
  dallas: ["DFW", "DAL"],
  houston: ["IAH", "HOU"],
  atlanta: ["ATL"],
  denver: ["DEN"],
  seattle: ["SEA"],
  boston: ["BOS"],
  miami: ["MIA", "FLL"],
  detroit: ["DTW"],
  minneapolis: ["MSP"],
  phoenix: ["PHX"],
  orlando: ["MCO"],
  "las vegas": ["LAS"],
  honolulu: ["HNL"],
};

// Validate at module load — surfaces typos in CITY_AIRPORTS immediately
// instead of returning silently-empty results at search time.
for (const [city, codes] of Object.entries(CITY_AIRPORTS)) {
  for (const code of codes) {
    if (!(code in AIRPORT_NAMES)) {
      throw new Error(`CITY_AIRPORTS[${city}] references unknown IATA code '${code}'`);
    }
  }
}

/**
 * Strip the internal " (CODE)" suffix that keeps duplicate names unique in
 * AIRPORT_NAMES. The code is always returned separately, so users should see
 * the plain name (mirrors Python's `fli.models.display_name`).
 */
export function airportDisplayName(code: string): string {
  const name = AIRPORT_NAMES[code as Airport] ?? code;
  const suffix = ` (${code})`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

/**
 * Search airports by city name, airport name, or IATA code.
 *
 * Results are ranked 0-100 (higher = better) via the same 5-priority
 * cascade used in the Python implementation:
 *
 *   1. iata_exact (100)   — exact IATA code
 *   2. city (90)          — exact city/alias
 *   3. city (80)          — prefix of a city/alias
 *   4. name (≤70)         — substring of an airport's name (position-weighted)
 *   5. iata_prefix (60)   — prefix of an IATA code (only for ≤3-char queries)
 */
export function searchAirports(query: string, limit = 10): AirportMatch[] {
  const queryLower = query.trim().toLowerCase();
  if (!queryLower || limit < 1) return [];

  const results: AirportMatch[] = [];
  const seen = new Set<string>();

  // 1. Exact IATA code match
  const queryUpper = query.trim().toUpperCase();
  if (queryUpper in AIRPORT_NAMES) {
    results.push({
      code: queryUpper as Airport,
      name: queryUpper,
      match_type: "iata_exact",
      score: 100.0,
    });
    seen.add(queryUpper);
  }

  // 2. Exact city alias match
  if (queryLower in CITY_AIRPORTS) {
    for (const code of CITY_AIRPORTS[queryLower] ?? []) {
      if (!seen.has(code)) {
        results.push({
          code: code as Airport,
          name: code,
          match_type: "city",
          score: 90.0,
        });
        seen.add(code);
      }
    }
  }

  // 3. City alias prefix match
  if (!(queryLower in CITY_AIRPORTS)) {
    for (const [city, codes] of Object.entries(CITY_AIRPORTS)) {
      if (city.startsWith(queryLower)) {
        for (const code of codes) {
          if (!seen.has(code)) {
            results.push({
              code: code as Airport,
              name: code,
              match_type: "city",
              score: 80.0,
            });
            seen.add(code);
          }
        }
      }
    }
  }

  // 4. Airport name substring match (position-weighted score)
  for (const code of Object.keys(AIRPORT_NAMES)) {
    if (seen.has(code)) continue;
    // Match on the name users see, not the internal " (CODE)" suffix.
    const displayName = airportDisplayName(code);
    const pos = displayName.toLowerCase().indexOf(queryLower);
    if (pos !== -1) {
      const score = 70.0 - pos * 0.1;
      results.push({ code: code as Airport, name: displayName, match_type: "name", score });
      seen.add(code);
    }
  }

  // 5. IATA prefix match (≤3-char query)
  if (queryUpper.length <= 3) {
    for (const code of Object.keys(AIRPORT_NAMES)) {
      if (seen.has(code)) continue;
      if (code.startsWith(queryUpper)) {
        results.push({
          code: code as Airport,
          name: airportDisplayName(code),
          match_type: "iata_prefix",
          score: 60.0,
        });
        seen.add(code);
      }
    }
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
  return results.slice(0, limit);
}

```

### Core Architecture Module: `fli-js/src/core/currency.ts`
```
/**
 * Currency extraction from Google Flights price tokens.
 *
 * 1:1 port of fli/core/currency.py — varint walk over a base64-urlsafe
 * protobuf payload to extract the nested ISO currency code, cached to
 * avoid repeated decoding for the common one-currency-per-response case.
 */

const _decodeCache = new Map<string, string | null>();
const MAX_CACHE = 256;

function readVarint(data: Uint8Array, offset: number): [number, number] {
  // `+= chunk * 2**shift` instead of `|= chunk << shift` — JavaScript's
  // bitwise operators coerce to signed 32-bit and would corrupt the
  // result for shifts ≥ 31 (i.e. varint values ≥ 2^31).
  let value = 0;
  let shift = 0;
  let off = offset;
  while (off < data.length) {
    const byte = data[off];
    if (byte === undefined) break;
    off += 1;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      if (!Number.isSafeInteger(value)) {
        throw new Error("Varint exceeds Number.MAX_SAFE_INTEGER");
      }
      return [value, off];
    }
    shift += 7;
    if (shift >= 64) throw new Error("Varint is too large to decode");
  }
  throw new Error("Unexpected end of data while decoding varint");
}

function readLengthDelimited(data: Uint8Array, offset: number): [Uint8Array, number] {
  const [length, after] = readVarint(data, offset);
  const end = after + length;
  if (end > data.length) throw new Error("Length-delimited field exceeds payload size");
  return [data.subarray(after, end), end];
}

function skipField(data: Uint8Array, offset: number, wireType: number): number {
  if (wireType === 0) return readVarint(data, offset)[1];
  if (wireType === 1) {
    const end = offset + 8;
    if (end > data.length) throw new Error("Fixed64 field exceeds payload size");
    return end;
  }
  if (wireType === 2) return readLengthDelimited(data, offset)[1];
  if (wireType === 5) {
    const end = offset + 4;
    if (end > data.length) throw new Error("Fixed32 field exceeds payload size");
    return end;
  }
  throw new Error(`Unsupported wire type: ${wireType}`);
}

function extractCurrencyFromMessage(data: Uint8Array): string | null {
  let offset = 0;
  while (offset < data.length) {
    const [tag, afterTag] = readVarint(data, offset);
    offset = afterTag;
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 3 && wireType === 2) {
      const [nested, after] = readLengthDelimited(data, offset);
      offset = after;
      let nestedOffset = 0;
      while (nestedOffset < nested.length) {
        const [ntag, na] = readVarint(nested, nestedOffset);
        nestedOffset = na;
        const nfield = ntag >> 3;
        const nwire = ntag & 0x07;
        if (nfield === 3 && nwire === 2) {
          const [bytes, _end] = readLengthDelimited(nested, nestedOffset);
          return new TextDecoder("utf-8").decode(bytes).toUpperCase();
        }
        nestedOffset = skipField(nested, nestedOffset, nwire);
      }
      continue;
    }

    offset = skipField(data, offset, wireType);
  }
  return null;
}

function base64UrlsafeDecode(token: string): Uint8Array {
  const padLen = (4 - (token.length % 4)) % 4;
  const padded = token + "=".repeat(padLen);
  const standard = padded.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob !== "undefined") {
    const binary = atob(standard);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(standard, "base64"));
}

/**
 * Extract the ISO currency code from a Google Flights price token.
 *
 * Cached so the same token returned for every row in a response decodes
 * the protobuf payload exactly once.
 */
export function extractCurrencyFromPriceToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (_decodeCache.has(token)) return _decodeCache.get(token) ?? null;
  let result: string | null = null;
  try {
    const decoded = base64UrlsafeDecode(token);
    result = extractCurrencyFromMessage(decoded);
  } catch {
    result = null;
  }
  // LRU-ish bound: drop oldest if we hit the cap.
  if (_decodeCache.size >= MAX_CACHE) {
    const firstKey = _decodeCache.keys().next().value;
    if (firstKey !== undefined) _decodeCache.delete(firstKey);
  }
  _decodeCache.set(token, result);
  return result;
}

/** Currency-code-aware formatter built on `Intl.NumberFormat`. */
export function formatPrice(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  if (amount == null) {
    return currencyCode ? `${currencyCode.toUpperCase()} —` : "—";
  }
  if (!currencyCode) {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const normalized = currencyCode.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalized,
    }).format(amount);
  } catch {
    return `${normalized} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/** Build a chart-axis label for one or more result currencies. */
export function formatPriceAxisLabel(currencies: Iterable<string | null | undefined>): string {
  const set = new Set<string>();
  for (const c of currencies) {
    if (c) set.add(c.toUpperCase());
  }
  if (set.size === 1) {
    const [only] = set;
    return `Price (${only})`;
  }
  return "Price";
}

/** Clear the in-memory token-decode cache (test helper). */
export function _clearCurrencyCache(): void {
  _decodeCache.clear();
}

```

### Core Architecture Module: `fli-js/src/core/dates.ts`
```
/**
 * Shared YYYY-MM-DD parsing and formatting helpers.
 *
 * Lives in `core/` so the same canonical implementation backs every part
 * of the package — `models/google-flights/base.ts`, the date-search
 * filters, and `search/dates.ts` — rather than each maintaining its own
 * subtly-different copy.
 */

/** Strict YYYY-MM-DD shape (4 digit year, 2 digit month, 2 digit day). */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a YYYY-MM-DD string into a UTC `Date`.
 *
 * Rejects strings that don't match {@link ISO_DATE_RE} and rejects
 * out-of-range calendar dates (e.g. `2026-02-30` would round-trip to
 * March, so the round-trip check catches it). Throws {@link TypeError}
 * on any malformed input — consistent with the rest of the package.
 */
export function parseIsoDate(s: string): Date {
  if (!ISO_DATE_RE.test(s)) {
    throw new TypeError(`Expected YYYY-MM-DD date, got: ${s}`);
  }
  const parts = s.split("-").map((p) => Number.parseInt(p, 10));
  const [year, month, day] = parts;
  if (year == null || month == null || day == null) {
    throw new TypeError(`Expected YYYY-MM-DD date, got: ${s}`);
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new TypeError(`Invalid date: ${s}`);
  }
  return d;
}

/** Format a `Date` as YYYY-MM-DD in UTC. */
export function formatIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

```

### Core Architecture Module: `fli-js/src/core/index.ts`
```
export {
  type AirportMatch,
  CITY_AIRPORTS,
  type MatchType,
  searchAirports,
} from "./airports.ts";
export {
  buildDateSearchSegments,
  buildFlightSegments,
  buildMultiCitySegments,
  buildTimeRestrictions,
  normalizeDate,
} from "./builders.ts";
export {
  _clearCurrencyCache,
  extractCurrencyFromPriceToken,
  formatPrice,
  formatPriceAxisLabel,
} from "./currency.ts";
export { formatIsoDate, ISO_DATE_RE, parseIsoDate } from "./dates.ts";
export {
  type GoogleFlightsUrlOptions,
  googleFlightsUrl,
  withLocaleParams,
} from "./links.ts";
export {
  ParseError,
  parseAirlines,
  parseAlliances,
  parseCabinClass,
  parseCurrency,
  parseEmissions,
  parseMaxStops,
  parseSortBy,
  parseTimeRange,
  resolveAirport,
  resolveEnum,
} from "./parsers.ts";

```

### Core Architecture Module: `fli-js/src/core/links.ts`
```
/**
 * Shared URL helpers for Google Flights deep links.
 *
 * Consumers can surface a clickable Google Flights link alongside search
 * results so a user can open the route (and complete a booking) in a
 * browser. The natural-language `q` form used here is the same one Google's
 * own frontend accepts.
 *
 * `withLocaleParams` lives here (rather than in `search/`) so the core layer
 * stays free of any dependency on the search package; `search/urls.ts`
 * re-exports it for backwards compatibility.
 *
 * 1:1 port of fli/core/links.py.
 */

const GOOGLE_FLIGHTS_URL = "https://www.google.com/travel/flights";

/**
 * Append optional `curr`/`hl`/`gl` parameters to a URL.
 *
 * - `currency` is uppercased ("usd" → "USD") because Google rejects lowercase
 *   codes silently.
 * - `language` is passed through verbatim (BCP-47).
 * - `country` is uppercased (ISO 3166-1 alpha-2).
 *
 * All values are percent-encoded; returns `url` unchanged when all three are null.
 */
export function withLocaleParams(
  url: string,
  currency: string | null | undefined,
  language: string | null | undefined,
  country: string | null | undefined,
): string {
  const params: string[] = [];
  if (currency) params.push(`curr=${encodeURIComponent(currency.toUpperCase())}`);
  if (language) params.push(`hl=${encodeURIComponent(language)}`);
  if (country) params.push(`gl=${encodeURIComponent(country.toUpperCase())}`);
  if (params.length === 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.join("&")}`;
}

export interface GoogleFlightsUrlOptions {
  currency?: string | null;
  language?: string | null;
  country?: string | null;
}

/**
 * Build a shareable Google Flights deep link for a route and dates.
 *
 * `origin` and `destination` are bare IATA codes (e.g. `"JFK"`). The returned
 * URL pre-fills the route and outbound date (plus the return date for round
 * trips); locale knobs (`curr`/`hl`/`gl`) are appended when supplied.
 */
export function googleFlightsUrl(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string | null,
  options: GoogleFlightsUrlOptions = {},
): string {
  let query = `Flights from ${origin} to ${destination} on ${departureDate}`;
  if (returnDate) query += ` through ${returnDate}`;
  const url = `${GOOGLE_FLIGHTS_URL}?q=${encodeURIComponent(query)}`;
  return withLocaleParams(
    url,
    options.currency ?? null,
    options.language ?? null,
    options.country ?? null,
  );
}

```

### Core Architecture Module: `fli-js/src/core/parsers.ts`
```
/**
 * Shared parsing utilities — string inputs from CLI/API callers into
 * domain enum values. 1:1 port of fli/core/parsers.py.
 */

import { Airline } from "../models/airline.ts";
import { Airport } from "../models/airport.ts";
import {
  Alliance,
  Currency,
  EmissionsFilter,
  MaxStops,
  SeatType,
  SortBy,
} from "../models/google-flights/base.ts";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const AIRLINE_SEPARATORS = /[,\s]+/;

/** Resolve an enum member by case-insensitive name. */
export function resolveEnum<T extends Record<string, unknown>>(
  enumObj: T,
  name: string,
): T[keyof T] {
  const upper = name.toUpperCase();
  if (Object.hasOwn(enumObj, upper)) {
    return enumObj[upper] as T[keyof T];
  }
  const valid = Object.keys(enumObj).join(", ");
  throw new ParseError(`Invalid value: '${name}'. Valid values: ${valid}`);
}

/** Resolve a string airport IATA code to the `Airport` constant. */
export function resolveAirport(code: string): Airport {
  const upper = code.toUpperCase();
  if (Object.hasOwn(Airport, upper)) {
    return (Airport as Record<string, Airport>)[upper] as Airport;
  }
  throw new ParseError(`Invalid airport code: '${code}'`);
}

/**
 * Parse a list of airline tokens into Airline constants.
 * Each item may itself contain multiple codes separated by commas or whitespace.
 */
export function parseAirlines(codes: string[] | null | undefined): Airline[] | null {
  if (!codes || codes.length === 0) return null;

  const expanded: string[] = [];
  for (const item of codes) {
    for (const token of item.split(AIRLINE_SEPARATORS)) {
      const t = token.trim().toUpperCase();
      if (t) expanded.push(t);
    }
  }
  if (expanded.length === 0) {
    throw new ParseError(`No valid airline codes found in: ${JSON.stringify(codes)}`);
  }

  const result: Airline[] = [];
  for (const code of expanded) {
    const key = /^[0-9]/.test(code) ? `_${code}` : code;
    if (!Object.hasOwn(Airline, key)) {
      throw new ParseError(`Invalid airline code: '${code}'`);
    }
    result.push((Airline as Record<string, Airline>)[key] as Airline);
  }
  return result;
}

/** Parse a list of alliance identifiers into Alliance constants. */
export function parseAlliances(codes: string[] | null | undefined): Alliance[] | null {
  if (!codes || codes.length === 0) return null;

  const expanded: string[] = [];
  for (const item of codes) {
    for (const token of item.split(AIRLINE_SEPARATORS)) {
      const t = token.trim().toUpperCase().replace(/ /g, "_").replace(/-/g, "_");
      if (t) expanded.push(t);
    }
  }
  if (expanded.length === 0) {
    throw new ParseError(`No valid alliance names found in: ${JSON.stringify(codes)}`);
  }
  const result: Alliance[] = [];
  for (const name of expanded) {
    if (!Object.hasOwn(Alliance, name)) {
      const valid = Object.keys(Alliance).join(", ");
      throw new ParseError(`Invalid alliance: '${name}'. Valid values: ${valid}`);
    }
    result.push((Alliance as Record<string, Alliance>)[name] as Alliance);
  }
  return result;
}

/** Parse a "stops" parameter into the matching `MaxStops` value. */
export function parseMaxStops(stops: string): MaxStops {
  const asInt = Number.parseInt(stops, 10);
  if (Number.isFinite(asInt) && String(asInt) === stops.trim()) {
    if (asInt <= 0) return MaxStops.NON_STOP;
    if (asInt === 1) return MaxStops.ONE_STOP_OR_FEWER;
    if (asInt >= 2) return MaxStops.TWO_OR_FEWER_STOPS;
  }
  const upper = stops.toUpperCase();
  const map: Record<string, MaxStops> = {
    ANY: MaxStops.ANY,
    NON_STOP: MaxStops.NON_STOP,
    NONSTOP: MaxStops.NON_STOP,
    ONE_STOP: MaxStops.ONE_STOP_OR_FEWER,
    ONE_STOP_OR_FEWER: MaxStops.ONE_STOP_OR_FEWER,
    TWO_PLUS_STOPS: MaxStops.TWO_OR_FEWER_STOPS,
    TWO_OR_FEWER_STOPS: MaxStops.TWO_OR_FEWER_STOPS,
  };
  if (Object.hasOwn(map, upper)) return map[upper] as MaxStops;
  throw new ParseError(
    `Invalid max_stops value: '${stops}'. Valid values: ANY, NON_STOP, ONE_STOP, TWO_PLUS_STOPS, or 0/1/2`,
  );
}

/** Parse a cabin-class string into a `SeatType` value. */
export function parseCabinClass(cabinClass: string): SeatType {
  const upper = cabinClass.toUpperCase();
  if (Object.hasOwn(SeatType, upper)) {
    return (SeatType as Record<string, SeatType>)[upper] as SeatType;
  }
  const valid = Object.keys(SeatType).join(", ");
  throw new ParseError(`Invalid cabin_class value: '${cabinClass}'. Valid values: ${valid}`);
}

/** Parse a sort-by string into a `SortBy` value. */
export function parseSortBy(sortBy: string): SortBy {
  const upper = sortBy.toUpperCase();
  if (Object.hasOwn(SortBy, upper)) {
    return (SortBy as Record<string, SortBy>)[upper] as SortBy;
  }
  const valid = Object.keys(SortBy).join(", ");
  throw new ParseError(`Invalid sort_by value: '${sortBy}'. Valid values: ${valid}`);
}

/** Normalise an ISO 4217 currency code; pass through unknown 3-letter codes. */
export function parseCurrency(currency: string | null | undefined): string | null {
  if (currency == null || currency === "") return null;
  const normalized = currency.trim().toUpperCase();
  if (normalized.length !== 3 || !/^[A-Z]{3}$/.test(normalized)) {
    throw new ParseError(
      `Invalid currency code: '${currency}'. Expected a 3-letter ISO 4217 code.`,
    );
  }
  if (Object.hasOwn(Currency, normalized)) {
    return (Currency as Record<string, string>)[normalized] as string;
  }
  return normalized;
}

/** Parse an emissions filter string into an `EmissionsFilter` value. */
export function parseEmissions(emissions: string): EmissionsFilter {
  return resolveEnum(EmissionsFilter as unknown as Record<string, EmissionsFilter>, emissions);
}

/** Parse a time range string ("HH-HH") into a `[start, end]` tuple of hours. */
export function parseTimeRange(timeRange: string): [number, number] {
  const parts = timeRange.split("-");
  if (parts.length !== 2) {
    throw new ParseError(
      `Invalid time range format: '${timeRange}'. Expected 'HH-HH' (e.g., '6-20')`,
    );
  }
  const start = Number.parseInt((parts[0] ?? "").trim(), 10);
  const end = Number.parseInt((parts[1] ?? "").trim(), 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ParseError(
      `Invalid time range format: '${timeRange}'. Expected 'HH-HH' (e.g., '6-20')`,
    );
  }
  if (start < 0 || start > 23 || end < 0 || end > 23) {
    throw new ParseError(
      `Invalid time range format: '${timeRange}'. Expected 'HH-HH' (e.g., '6-20')`,
    );
  }
  return [start, end];
}

```

### Core Architecture Module: `fli-js/src/search/concurrency.ts`
```
/**
 * Async concurrency primitives. 1:1 port of fli/search/_concurrency.py,
 * adapted to JavaScript's single-threaded event loop (no need for a
 * threading.Condition — `setTimeout`/`Promise` are the equivalent).
 */

/**
 * Throw the caller's abort reason if `signal` has already fired.
 *
 * Used at every point where a cancelled call would otherwise spend
 * something on the caller's behalf — a rate-limiter token (which delays
 * the next real request), a `fetchImpl` call, a page fetch, a date.
 * Real `fetch` rejects a pre-aborted signal without touching the network,
 * but a custom `fetchImpl` is under no such obligation.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
}

/**
 * Sleep for `ms`, giving up promptly if `signal` aborts.
 *
 * Both backoffs in this package — the client's retry backoff and the
 * page-retry backoff — sit between HTTP requests on a path a caller may
 * cancel. A plain `setTimeout` promise would make the caller wait out a
 * delay that no longer has any reason to elapse, and would leave the
 * timer armed after the call had already settled.
 *
 * Rejects with the signal's own `reason`, so the caller gets back the
 * error it aborted with rather than a synthesised one.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal == null) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  return new Promise<void>((resolve, reject) => {
    const abortReason = (): unknown => signal.reason ?? new DOMException("Aborted", "AbortError");
    if (signal.aborted) {
      reject(abortReason());
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      reject(abortReason());
    };
    timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Async token-bucket rate limiter.
 *
 * The bucket starts full (`capacity` tokens) and refills continuously at
 * `capacity / period` tokens per second. `acquire()` resolves once a
 * token has been taken; concurrent waiters are released in arrival order
 * via a FIFO promise chain.
 */
export class TokenBucketRateLimiter {
  private readonly capacityValue: number;
  private readonly refillPerSecond: number;
  private tokens: number;
  private lastRefill: number;
  /** Serialises waiters so they wake in arrival order. */
  private queue: Promise<void> = Promise.resolve();

  constructor(calls: number, period: number) {
    if (calls <= 0) throw new Error("calls must be positive");
    if (period <= 0) throw new Error("period must be positive");
    this.capacityValue = calls;
    this.refillPerSecond = calls / period;
    this.tokens = calls;
    this.lastRefill = performance.now() / 1000;
  }

  get capacity(): number {
    return Math.floor(this.capacityValue);
  }

  private refill(): void {
    const now = performance.now() / 1000;
    const elapsed = now - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacityValue, this.tokens + elapsed * this.refillPerSecond);
      this.lastRefill = now;
    }
  }

  /**
   * Block until `tokens` are available; returns `false` on timeout.
   *
   * @param tokens count to acquire (must be ≤ capacity)
   * @param timeoutMs optional timeout in milliseconds
   */
  async acquire(tokens = 1, timeoutMs: number | null = null): Promise<boolean> {
    if (tokens <= 0) return true;
    if (tokens > this.capacityValue) {
      throw new Error(`tokens=${tokens} exceeds bucket capacity=${this.capacity}`);
    }

    const deadline = timeoutMs == null ? null : performance.now() + timeoutMs;
    // Serialise waiters so they take tokens FIFO.
    let release: () => void = () => {};
    const slot = new Promise<void>((res) => {
      release = res;
    });
    const prev = this.queue;
    this.queue = prev.then(() => slot);
    await prev;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        this.refill();
        if (this.tokens >= tokens) {
          this.tokens -= tokens;
          return true;
        }
        const deficit = tokens - this.tokens;
        const waitS = deficit / this.refillPerSecond;
        let waitMs = waitS * 1000;
        if (deadline != null) {
          const remaining = deadline - performance.now();
          if (remaining <= 0) return false;
          waitMs = Math.min(waitMs, remaining);
        }
        await new Promise<void>((res) => setTimeout(res, waitMs));
      }
    } finally {
      // Wake the next waiter so they can re-check the bucket.
      release();
    }
  }
}

// ---------------------------------------------------------------------------
// parallelMap — bounded Promise.all
// ---------------------------------------------------------------------------

let DEFAULT_MAX_WORKERS = 10;

export function configureConcurrency(maxWorkers: number): void {
  if (maxWorkers <= 0) throw new Error("maxWorkers must be positive");
  DEFAULT_MAX_WORKERS = maxWorkers;
}

export function getDefaultMaxWorkers(): number {
  return DEFAULT_MAX_WORKERS;
}

/**
 * Apply `fn` to each item with bounded concurrency; results returned in
 * input order. Fast-path for ≤1 items / maxWorkers=1 (no scheduling
 * overhead).
 *
 * The first rejection rethrows after all in-flight calls have settled,
 * matching the Python implementation's "let siblings finish" contract.
 */
export async function parallelMap<T, R>(
  fn: (item: T) => Promise<R>,
  items: Iterable<T>,
  options: { maxWorkers?: number } = {},
): Promise<R[]> {
  const materialised = Array.isArray(items) ? items : [...items];
  const n = materialised.length;
  if (n === 0) return [];

  const workers = options.maxWorkers ?? DEFAULT_MAX_WORKERS;
  if (n === 1 || workers === 1) {
    const out: R[] = Array.from({ length: n });
    for (let i = 0; i < n; i++) {
      out[i] = await fn(materialised[i] as T);
    }
    return out;
  }

  const results: R[] = Array.from({ length: n });
  let firstError: unknown = null;
  let nextIndex = 0;

  const runner = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= n) return;
      try {
        results[idx] = await fn(materialised[idx] as T);
      } catch (err) {
        if (firstError == null) firstError = err;
      }
    }
  };

  const workerPromises: Promise<void>[] = [];
  const cap = Math.min(workers, n);
  for (let i = 0; i < cap; i++) workerPromises.push(runner());
  await Promise.all(workerPromises);

  if (firstError != null) throw firstError;
  return results;
}

```

### Core Architecture Module: `fli/cli/utils.py`
```
"""CLI utility functions for display and validation."""

import json
import re
from typing import Any

import plotext as plt
import typer
from rich import box
from rich.console import Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from fli.cli.console import console
from fli.cli.enums import DayOfWeek
from fli.core import format_price, format_price_axis_label, google_flights_url
from fli.core.builders import normalize_date
from fli.core.parsers import ParseError
from fli.core.parsers import parse_airlines as core_parse_airlines
from fli.core.parsers import parse_max_stops as core_parse_max_stops
from fli.models import Airline, Airport, MaxStops, TripType, display_name


def validate_currency(
    ctx: typer.Context, param: typer.CallbackParam, value: str | None
) -> str | None:
    """Validate currency code format for typer callbacks."""
    if value is None:
        return None
    normalized = value.upper()
    if not re.fullmatch(r"[A-Z]{3}", normalized):
        raise typer.BadParameter(f"'{value}' is not a valid 3-letter currency code")
    return normalized


def validate_date(ctx: typer.Context, param: typer.CallbackParam, value: str) -> str | None:
    """Validate date format for typer callbacks."""
    if value is None:
        return None

    try:
        return normalize_date(value)
    except ValueError as e:
        raise typer.BadParameter("Date must be in YYYY-MM-DD format") from e


def validate_time_range(
    ctx: typer.Context, param: typer.CallbackParam, value: str | None
) -> tuple[int, int] | None:
    """Validate and parse time range in format 'start-end' (24h format) for typer callbacks."""
    if not value:
        return None

    try:
        start, end = map(int, value.split("-"))
        if not (0 <= start <= 23 and 0 <= end <= 23):
            raise ValueError
        return start, end
    except ValueError as e:
        raise typer.BadParameter("Time range must be in format 'start-end' (e.g., 6-20)") from e


def normalize_cli_date(value: str | None) -> str | None:
    """Normalize a CLI date value or raise a parse error."""
    if value is None:
        return None

    try:
        return normalize_date(value)
    except ValueError as e:
        raise ParseError("Date must be in YYYY-MM-DD format") from e


def normalize_cli_time_range(value: str | tuple[int, int] | None) -> tuple[int, int] | None:
    """Normalize a CLI time range or raise a parse error."""
    if value is None:
        return None

    if isinstance(value, tuple):
        start, end = value
    else:
        try:
            start, end = map(int, value.split("-"))
        except ValueError as e:
            raise ParseError("Time range must be in format 'start-end' (e.g., 6-20)") from e

    if not (0 <= start <= 23 and 0 <= end <= 23):
        raise ParseError("Time range must be in format 'start-end' (e.g., 6-20)")

    return start, end


def parse_airlines(airlines: list[str] | None) -> list[Airline] | None:
    """Parse airlines from list of airline codes.

    Delegates to core parser but wraps errors for CLI.
    """
    if not airlines:
        return None

    try:
        return core_parse_airlines(airlines)
    except ParseError as e:
        raise typer.BadParameter(str(e)) from e


def parse_stops(stops: str) -> MaxStops:
    """Convert stops parameter to MaxStops enum.

    Delegates to core parser but wraps errors for CLI.
    """
    try:
        return core_parse_max_stops(stops)
    except ParseError as e:
        raise typer.BadParameter(str(e)) from e


def parse_trip_type(trip_type: str) -> TripType:
    """Convert trip type parameter to TripType enum."""
    match trip_type.upper():
        case "ONEWAY" | "ONE_WAY":
            return TripType.ONE_WAY
        case "ROUND" | "ROUND_TRIP":
            return TripType.ROUND_TRIP
        case _:
            raise typer.BadParameter(f"Invalid trip type: {trip_type}")


def filter_flights_by_time(flights: list, start_hour: int, end_hour: int) -> list:
    """Filter flights by departure time range."""
    return [
        flight
        for flight in flights
        if any(start_hour <= leg.departure_datetime.hour <= end_hour for leg in flight.legs)
    ]


def filter_flights_by_airlines(flights: list, airlines: list[Airline]) -> list:
    """Filter flights by specified airlines."""
    return [flight for flight in flights if any(leg.airline in airlines for leg in flight.legs)]


def filter_dates_by_days(dates: list, days: list[DayOfWeek], trip_type: TripType) -> list:
    """Filter dates by days of the week."""
    if not days:
        return dates

    day_numbers = {
        DayOfWeek.MONDAY: 0,
        DayOfWeek.TUESDAY: 1,
        DayOfWeek.WEDNESDAY: 2,
        DayOfWeek.THURSDAY: 3,
        DayOfWeek.FRIDAY: 4,
        DayOfWeek.SATURDAY: 5,
        DayOfWeek.SUNDAY: 6,
    }

    allowed_days = {day_numbers[day] for day in days}
    return [date_price for date_price in dates if date_price.date[0].weekday() in allowed_days]


def format_airport(airport: Airport) -> str:
    """Format airport code and name (first three words)."""
    name_parts = display_name(airport).split()[:3]  # Get first three words
    name = " ".join(name_parts)
    return f"{airport.name} ({name})"


def format_duration(minutes: int) -> str:
    """Format duration in minutes to hours and minutes."""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins}m"


def serialize_airport(airport: Airport) -> dict[str, str]:
    """Serialize an airport for machine-readable output."""
    return {"code": airport.name, "name": display_name(airport)}


def serialize_airline(airline: Airline) -> dict[str, str]:
    """Serialize an airline for machine-readable output."""
    return {"code": airline.name.removeprefix("_"), "name": display_name(airline)}


def serialize_flight_leg(leg: Any) -> dict[str, Any]:
    """Serialize a flight leg using Google Flights-style field names."""
    payload: dict[str, Any] = {
        "departure_airport": serialize_airport(leg.departure_airport),
        "arrival_airport": serialize_airport(leg.arrival_airport),
        "departure_time": leg.departure_datetime.isoformat(),
        "arrival_time": leg.arrival_datetime.isoformat(),
        "duration": leg.duration,
        "airline": serialize_airline(leg.airline),
        "flight_number": leg.flight_number,
    }
    if getattr(leg, "aircraft", None):
        payload["aircraft"] = leg.aircraft
    if getattr(leg, "legroom", None):
        payload["legroom"] = leg.legroom
    cabin_name = getattr(getattr(leg, "cabin", None), "name", None)
    if isinstance(cabin_name, str):
        payload["cabin"] = cabin_name
    if getattr(leg, "overnight", False):
        payload["overnight"] = True
    if getattr(leg, "operating_airline", None) is not None:
        payload["operating_airline"] = serialize_airline(leg.operating_airline)
    amenities = getattr(leg, "amenities", None)
    if amenities is not None:
        a = amenities.model_dump(exclude_none=True)
        if a:
            payload["amenities"] = a
    return payload


def _serialize_flight_segment_result(
    flight: Any,
    *,
    include_price: bool = False,
    default_currency: str = "USD",
) -> dict[str, Any]:
    """Serialize a one-direction flight result."""
    payload: dict[str, Any] = {
        "duration": flight.duration,
        "stops": flight.stops,
        "legs": [serialize_flight_leg(leg) for leg in flight.legs],
    }
    if include_price:
        payload["price"] = flight.price
        payload["currency"] = flight.currency or default_currency
    # Optional rich fields surfaced when populated. Emissions are
    # intentionally omitted — the ``--emissions LESS`` filter is still
    # honoured server-side, but CO₂ figures are not rendered in CLI
    # output.
    for src in (
        "self_transfer",
        "mixed_cabin",
    ):
        v = getattr(flight, src, None)
        if v is not None and v != "":
            payload[src] = v
    if getattr(flight, "layovers", None):
        payload["layovers"] = [
            {
                "airport": serialize_airport(lo.airport),
                "duration": lo.duration,
                **({"overnight": True} if lo.overnight else {}),
                **({"change_of_airport": True} if lo.change_of_airport else {}),
            }
            for lo in flight.layovers
        ]
    return payload


def serialize_flight_result(
    flight_data: Any,
    default_currency: str = "USD",
    *,
    booking_url: str | None = None,
) -> dict[str, Any]:
    """Serialize a flight result or round-trip/multi-city tuple for JSON output."""
    if not isinstance(flight_data, tuple):
        out = _serialize_flight_segment_result(
            flight_data, include_price=True, default_currency=default_currency
        )
        if booking_url:
            out["booking_url"] = booking_url
        return out

    segments = list(flight_data)

    if len(segments) == 2:
        # Round-trip: Google Flights returns the full RT price on the outbound leg.
        outbound, return_flight = segments
        out = {
            "price": outbound.price,
            "currency": outbound.currency or default_currency,
            "duration": outbound.duration + return_flight.duration,
            "stops": outbound.stops + return_flight.stops,
            "outbound": _serialize_flight_segment_result(outbound),
            "return": _serialize_flight_segment_result(return_flight),
        }
        if booking_url:
            out["booking_url"] = booking_url
        return out

    # Multi-city (3+ legs): combined price is on the final leg.
    price_segment = segments[-1]
    out = {
        "price": price_segment.price,
        "currency": price_segment.currency or default_currency,
        "duration": sum(s.duration for s in segments),
        "stops": sum(s.stops for s in segments),
        "segments": [_serialize_flight_segment_result(s)
```

### Core Architecture Module: `fli/core/__init__.py`
```
"""Core utilities for flight search operations.

This module provides shared parsing and building utilities used by both
the CLI and MCP interfaces.
"""

from .airports import search_airports
from .builders import (
    build_date_search_segments,
    build_flight_segments,
    build_multi_city_segments,
    build_time_restrictions,
    normalize_date,
)
from .currency import extract_currency_from_price_token, format_price, format_price_axis_label
from .errors import ErrorClassification, classify_error, format_validation_error
from .links import google_flights_url, with_locale_params
from .parsers import (
    parse_airlines,
    parse_alliances,
    parse_cabin_class,
    parse_currency,
    parse_emissions,
    parse_max_stops,
    parse_sort_by,
    parse_time_range,
    resolve_airport,
    resolve_airports,
    resolve_enum,
)

__all__ = [
    # Parsers
    "parse_airlines",
    "parse_alliances",
    "parse_cabin_class",
    "parse_currency",
    "parse_emissions",
    "parse_max_stops",
    "parse_sort_by",
    "parse_time_range",
    "resolve_airport",
    "resolve_airports",
    "resolve_enum",
    # Builders
    "build_date_search_segments",
    "build_flight_segments",
    "build_multi_city_segments",
    "build_time_restrictions",
    "normalize_date",
    "search_airports",
    # Currency
    "extract_currency_from_price_token",
    "format_price",
    "format_price_axis_label",
    # Errors
    "ErrorClassification",
    "classify_error",
    "format_validation_error",
    # Links
    "google_flights_url",
    "with_locale_params",
]

```

### Core Architecture Module: `fli/core/airports.py`
```
"""Airport search utilities for looking up airports by city or name."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from fli.core.parsers import icao_to_iata
from fli.models import Airport, display_name
from fli.models.airport import AIRPORT_NAMES

# Curated mapping of city names and common abbreviations to IATA codes.
# Provides multi-airport groupings (e.g., "new york" -> JFK, LGA, EWR) and
# short aliases (e.g., "sf", "la", "nyc") that pure airport-name substring
# search would miss. Validated against the Airport enum at import time.
CITY_AIRPORTS: dict[str, list[str]] = {
    "new york": ["JFK", "LGA", "EWR"],
    "nyc": ["JFK", "LGA", "EWR"],
    "chicago": ["ORD", "MDW"],
    "washington": ["IAD", "DCA", "BWI"],
    "washington dc": ["IAD", "DCA", "BWI"],
    "london": ["LHR", "LGW", "STN", "LTN", "LCY"],
    "paris": ["CDG", "ORY"],
    "tokyo": ["NRT", "HND"],
    "osaka": ["KIX", "ITM"],
    "seoul": ["ICN", "GMP"],
    "beijing": ["PEK", "PKX"],
    "shanghai": ["PVG", "SHA"],
    "bangkok": ["BKK", "DMK"],
    "istanbul": ["IST", "SAW"],
    "moscow": ["SVO", "DME", "VKO"],
    "milan": ["MXP", "LIN"],
    "rome": ["FCO", "CIA"],
    "berlin": ["BER"],
    "mumbai": ["BOM"],
    "delhi": ["DEL"],
    "sao paulo": ["GRU", "CGH"],
    "rio": ["GIG", "SDU"],
    "rio de janeiro": ["GIG", "SDU"],
    "toronto": ["YYZ", "YTZ"],
    "montreal": ["YUL"],
    "mexico city": ["MEX"],
    "buenos aires": ["EZE", "AEP"],
    "dubai": ["DXB", "DWC"],
    "singapore": ["SIN"],
    "hong kong": ["HKG"],
    "taipei": ["TPE", "TSA"],
    "sydney": ["SYD"],
    "melbourne": ["MEL"],
    "san francisco": ["SFO", "OAK", "SJC"],
    "sf": ["SFO", "OAK", "SJC"],
    "bay area": ["SFO", "OAK", "SJC"],
    "los angeles": ["LAX", "BUR", "SNA", "ONT", "LGB"],
    "la": ["LAX", "BUR", "SNA", "ONT", "LGB"],
    "dallas": ["DFW", "DAL"],
    "houston": ["IAH", "HOU"],
    "atlanta": ["ATL"],
    "denver": ["DEN"],
    "seattle": ["SEA"],
    "boston": ["BOS"],
    "miami": ["MIA", "FLL"],
    "detroit": ["DTW"],
    "minneapolis": ["MSP"],
    "phoenix": ["PHX"],
    "orlando": ["MCO"],
    "las vegas": ["LAS"],
    "honolulu": ["HNL"],
}

for _city, _codes in CITY_AIRPORTS.items():
    for _code in _codes:
        if _code not in AIRPORT_NAMES:
            raise RuntimeError(f"CITY_AIRPORTS[{_city!r}] references unknown IATA code {_code!r}")

MatchType = Literal["iata_exact", "icao_exact", "iata_prefix", "city", "name"]


class AirportMatch(BaseModel):
    """A matched airport from a search query."""

    model_config = ConfigDict(frozen=True)

    code: Airport
    name: str
    match_type: MatchType
    score: float = Field(ge=0.0, le=100.0)


def search_airports(query: str, limit: int = 10) -> list[AirportMatch]:
    """Search airports by city name, airport name, or IATA code.

    Results are ranked by a 5-priority cascade, scored 0-100 (higher = better):

      1. iata_exact  (score 100) - query is an exact IATA code (e.g. "JFK")
      2. city        (score 90)  - query is an exact city/alias in CITY_AIRPORTS
      3. city        (score 80)  - query is a prefix of a city in CITY_AIRPORTS
      4. name        (score <=70) - query is a substring of an airport's name;
                                   earlier match position scores higher
      5. icao_exact  (score 65)  - query is a known 4-letter ICAO code (e.g. "KJFK")
      6. iata_prefix (score 60)  - query (<=3 chars) is a prefix of an IATA code

    An ICAO hit deliberately ranks below city and name matches: many ICAO codes
    are also ordinary word fragments ("sant" is Tucuman's SANT, "kind" is
    Indianapolis' KIND), and a partial "Santa..." search must not be hijacked.
    For genuine ICAO input nothing else matches, so it is still the top result.

    Within a single result list, each IATA code appears at most once: the
    highest-priority match wins.

    Args:
        query: Search string (e.g., "new york", "san fran", "JFK", "heathrow").
        limit: Maximum results to return. Values < 1 yield an empty list.

    Returns:
        List of matching airports sorted by relevance (best match first).

    """
    query_lower = query.strip().lower()
    if not query_lower or limit < 1:
        return []

    results: list[AirportMatch] = []
    seen_codes: set[str] = set()

    # Priority 1: Exact IATA code match
    query_upper = query.strip().upper()
    if query_upper in Airport.__members__:
        airport = Airport[query_upper]
        results.append(
            AirportMatch(
                code=airport, name=display_name(airport), match_type="iata_exact", score=100.0
            )
        )
        seen_codes.add(query_upper)

    # Priority 2: Exact city name lookup (handles "new york" -> JFK, LGA, EWR)
    if query_lower in CITY_AIRPORTS:
        for code in CITY_AIRPORTS[query_lower]:
            if code not in seen_codes:
                airport = Airport[code]
                results.append(
                    AirportMatch(
                        code=airport, name=display_name(airport), match_type="city", score=90.0
                    )
                )
                seen_codes.add(code)

    # Priority 3: Partial city name match (handles "new yo" matching "new york")
    if query_lower not in CITY_AIRPORTS:
        for city, codes in CITY_AIRPORTS.items():
            if city.startswith(query_lower):
                for code in codes:
                    if code not in seen_codes:
                        airport = Airport[code]
                        results.append(
                            AirportMatch(
                                code=airport,
                                name=display_name(airport),
                                match_type="city",
                                score=80.0,
                            )
                        )
                        seen_codes.add(code)

    # Priority 4: Airport name substring match.
    # Iterate the raw dict instead of the Enum — skips Enum-member
    # attribute access (``.value``, ``.name``) on each of ~7,900 entries,
    # which is the dominant cost when no other priority matched first.
    for code, airport_name in AIRPORT_NAMES.items():
        if code in seen_codes:
            continue
        # Match on the name users see, not the internal " (CODE)" uniqueness suffix.
        airport_name_lower = airport_name.removesuffix(f" ({code})").lower()
        if query_lower in airport_name_lower:
            # 0.1-per-position weight keeps name matches (max ~70) below
            # city matches (80) regardless of where the substring lands.
            pos = airport_name_lower.find(query_lower)
            score = 70.0 - (pos * 0.1)
            results.append(
                AirportMatch(
                    code=Airport[code],
                    name=display_name(Airport[code]),
                    match_type="name",
                    score=score,
                )
            )
            seen_codes.add(code)

    # Priority 5: Exact ICAO code match (e.g. "KJFK" -> JFK), mirroring resolve_airport().
    # Scored below city/name matches on purpose - see the docstring.
    iata_from_icao = icao_to_iata(query_upper)
    if iata_from_icao in Airport.__members__ and iata_from_icao not in seen_codes:
        airport = Airport[iata_from_icao]
        results.append(
            AirportMatch(
                code=airport, name=display_name(airport), match_type="icao_exact", score=65.0
            )
        )
        seen_codes.add(iata_from_icao)

    # Priority 6: IATA code prefix match (handles "SF" matching "SFO").
    if len(query_upper) <= 3:
        for code in AIRPORT_NAMES:
            if code in seen_codes:
                continue
            if code.startswith(query_upper):
                results.append(
                    AirportMatch(
                        code=Airport[code],
                        name=display_name(Airport[code]),
                        match_type="iata_prefix",
                        score=60.0,
                    )
                )
                seen_codes.add(code)

    # Sort by score descending, then by IATA code alphabetically.
    results.sort(key=lambda m: (-m.score, m.code.name))
    return results[:limit]

```

### Core Architecture Module: `fli/core/currency.py`
```
"""Utilities for extracting and formatting price currencies."""

from __future__ import annotations

import base64
from collections.abc import Iterable
from functools import lru_cache

from babel.numbers import format_currency as babel_format_currency


def _read_varint(data: bytes, offset: int) -> tuple[int, int]:
    """Read a protobuf-style varint value."""
    value = 0
    shift = 0

    while offset < len(data):
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, offset

        shift += 7
        if shift >= 64:
            raise ValueError("Varint is too large to decode")

    raise ValueError("Unexpected end of data while decoding varint")


def _read_length_delimited(data: bytes, offset: int) -> tuple[bytes, int]:
    """Read a protobuf-style length-delimited field."""
    length, offset = _read_varint(data, offset)
    end = offset + length
    if end > len(data):
        raise ValueError("Length-delimited field exceeds payload size")
    return data[offset:end], end


def _skip_field(data: bytes, offset: int, wire_type: int) -> int:
    """Skip over a protobuf field we do not need."""
    if wire_type == 0:
        _, offset = _read_varint(data, offset)
        return offset
    if wire_type == 1:
        end = offset + 8
        if end > len(data):
            raise ValueError("Fixed64 field exceeds payload size")
        return end
    if wire_type == 2:
        _, offset = _read_length_delimited(data, offset)
        return offset
    if wire_type == 5:
        end = offset + 4
        if end > len(data):
            raise ValueError("Fixed32 field exceeds payload size")
        return end
    raise ValueError(f"Unsupported wire type: {wire_type}")


def _extract_currency_from_message(data: bytes) -> str | None:
    """Extract the nested ISO currency code from a decoded token."""
    offset = 0

    while offset < len(data):
        tag, offset = _read_varint(data, offset)
        field_number = tag >> 3
        wire_type = tag & 0x07

        if field_number == 3 and wire_type == 2:
            nested_message, offset = _read_length_delimited(data, offset)
            nested_offset = 0
            while nested_offset < len(nested_message):
                nested_tag, nested_offset = _read_varint(nested_message, nested_offset)
                nested_field = nested_tag >> 3
                nested_wire_type = nested_tag & 0x07

                if nested_field == 3 and nested_wire_type == 2:
                    currency_bytes, nested_offset = _read_length_delimited(
                        nested_message, nested_offset
                    )
                    return currency_bytes.decode("utf-8").upper()

                nested_offset = _skip_field(nested_message, nested_offset, nested_wire_type)
            continue

        offset = _skip_field(data, offset, wire_type)

    return None


def extract_currency_from_price_token(token: str | None) -> str | None:
    """Extract the ISO currency code from a Google Flights price token.

    Cached so the same token returned for every row in a response (which
    is the common case — one currency per response) decodes the protobuf
    payload exactly once. The varint walk is ~2.5us per call cold; cache
    hits are ~100ns, a ~25x speedup on the parsing hot path.
    """
    return _decode_token(token) if token else None


@lru_cache(maxsize=256)
def _decode_token(token: str) -> str | None:
    """Pure-function inner — guarded for None so the cache only sees ``str``."""
    try:
        padded_token = token + ("=" * (-len(token) % 4))
        decoded = base64.urlsafe_b64decode(padded_token)
        return _extract_currency_from_message(decoded)
    except (UnicodeDecodeError, ValueError, base64.binascii.Error):
        return None


def format_price(amount: float | None, currency_code: str | None) -> str:
    """Format a price using its ISO currency code.

    ``amount`` may be ``None`` when Google did not surface a per-row price
    (premium-cabin round-trips often hit this — see
    :class:`fli.models.FlightResult`). The placeholder ``"—"`` (em dash)
    is returned in that case, matching the convention used elsewhere in
    the CLI display for unknown structured fields.
    """
    if amount is None:
        return f"{currency_code.upper()} —" if currency_code else "—"
    if not currency_code:
        return f"{amount:,.2f}"

    normalized_currency = currency_code.upper()
    try:
        return babel_format_currency(amount, normalized_currency, locale="en_US")
    except (TypeError, ValueError):
        return f"{normalized_currency} {amount:,.2f}"


def format_price_axis_label(currencies: Iterable[str | None]) -> str:
    """Build a chart axis label for one or more result currencies."""
    normalized = {currency.upper() for currency in currencies if currency}
    if len(normalized) == 1:
        return f"Price ({normalized.pop()})"
    return "Price"

```

### Core Architecture Module: `fli/core/errors.py`
```
"""Shared error-formatting and error-classification utilities.

Two related jobs live here, both shared verbatim between the CLI and the
MCP interfaces so the two surfaces can never drift apart:

1. ``format_validation_error`` flattens pydantic's multi-line
   ``ValidationError`` dump into one actionable line.
2. ``classify_error`` maps any exception a search can raise into a stable,
   machine-readable ``(error_type, retryable[, http_status])`` triple.

Design note on (2) — why this lives in ``fli.core`` and not ``fli.mcp`` or
``fli.cli``: a review of the first cut of this classifier found that
``fli.cli.errors.json_error_payload`` already emitted a field literally
named ``error_type`` for the same exceptions, with a *different* string
for some of them (``"timeout"`` shipped in the CLI since v0.9.0 vs.
``"timeout_error"`` in the first MCP-only cut). Two vocabularies under one
field name is a trap for anyone building against both surfaces. The fix is
one classifier, used by both ``fli.mcp.server`` and
``fli.cli.errors.json_error_payload`` — which means it cannot live in
either interface package. This is a deliberate, narrow exception to the
general rule (see ``fli/core/links.py``) that ``fli.core`` stays free of a
dependency on ``fli.search``: unlike ``with_locale_params``,
``classify_error`` has no way to exist without knowing the
``fli.search.exceptions`` type hierarchy, and duplicating it per interface
is exactly what caused the drift this module now prevents.

**Vocabulary.** Released values (shipped in the CLI's ``--format json``
error output before this module existed) are a contract and were kept
as-is: ``"timeout"``, ``"connection_error"``, ``"http_error"``,
``"search_error"``, ``"unexpected_error"``. Everything else was free to
pick: ``"parse_error"`` (not ``"blocked_error"``) matches what the CLI and
PR #164 already independently converged on, and names *what happened*
(a page arrived but couldn't be read) rather than asserting *why*
(usually, but not always, a consent/blocked interstitial — see
``FLI_SOCS_COOKIE`` below). ``"rejected_error"``, ``"unsupported_error"``
and ``"validation_error"`` are new additions both surfaces now share.
``"certificate_error"`` is a later addition, carried forward from PR #164 —
its ``error_type`` naming was never released, so it was free to pick, and
follows the same "name what happened" convention as ``parse_error``.

- ``validation_error`` (not retryable): bad parameters — pydantic
  ``ValidationError``, ``fli.core.parsers.ParseError``, or a bare
  ``ValueError`` (e.g. the 93-date search-range cap).
- ``unsupported_error`` (not retryable): ``SearchUnsupportedError``, e.g.
  multi-city.
- ``parse_error`` (not retryable as-is): ``SearchParseError`` — a page
  arrived but couldn't be read, usually a regional consent/blocked
  interstitial. Set ``FLI_SOCS_COOKIE`` (EU/EEA) and retry; don't just
  retry the same request unchanged.
- ``rejected_error`` (not retryable): ``SearchRejectedError`` — Google
  refused the RPC outright (e.g. booking options); deterministic,
  retrying will not help.
- ``timeout`` (retryable): ``SearchTimeoutError``.
- ``certificate_error`` (not retryable): ``SearchCertificateError`` — a
  ``SearchConnectionError`` subclass, checked first: TLS certificate
  verification failed, most often behind a TLS-intercepting corporate
  proxy. Deterministic for a fixed CA bundle configuration, so retrying
  unchanged will not help; set ``FLI_CA_BUNDLE`` (or ``CURL_CA_BUNDLE`` /
  ``REQUESTS_CA_BUNDLE``) to point at the right CA bundle and try again.
- ``connection_error`` (retryable): ``SearchConnectionError``.
- ``http_error`` (retryable iff ``http_status`` is 429 or 5xx):
  ``SearchHTTPError``, with the status in ``http_status`` when known.
- ``search_error`` (not retryable): any other ``SearchClientError``.
- ``unexpected_error`` (not retryable): anything else — a bug, not a
  known failure mode.

**Retry guidance for ``retryable: true``.** Both the CLI's HTTP client and
the search layer it wraps have *already* retried internally with backoff
before ever raising — see ``fli/search/client.py``'s ``tenacity`` retry
decorator. A caller (human or agent) that sees ``retryable: true`` should
retry **at most once or twice more**, with its own exponential backoff
measured in seconds (not milliseconds) between attempts — not hammer the
endpoint immediately. For ``http_error`` with ``http_status: 429``
specifically, that status *is* Google explicitly saying "slow down":
back off more, not less.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from fli.search.exceptions import (
    SearchCertificateError,
    SearchClientError,
    SearchConnectionError,
    SearchHTTPError,
    SearchParseError,
    SearchRejectedError,
    SearchTimeoutError,
    SearchUnsupportedError,
)

_RETRYABLE_HTTP_STATUSES = {429}


def format_validation_error(exc: ValidationError) -> str:
    """Flatten a pydantic ``ValidationError`` into one actionable message.

    The underlying validators already say exactly what is wrong (e.g. "Total
    passengers must be between 1 and 9"); without this, callers only ever saw
    a multi-line pydantic dump, which gives nothing to act on.
    """
    problems = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"]) or "input"
        problems.append(f"{location}: {error['msg']}")
    return f"Invalid parameter value - {'; '.join(problems)}"


@dataclass(frozen=True)
class ErrorClassification:
    """Stable, machine-readable shape describing why a search call failed."""

    error_type: str
    retryable: bool
    http_status: int | None = None

    def as_fields(self) -> dict[str, Any]:
        """Return the dict fields to splice into an MCP error response.

        `http_status` is only included when known (i.e. for `http_error`
        responses where the upstream status code was captured), so every
        other response shape stays exactly as additive as `error_type` /
        `retryable` themselves — no caller sees a new key it can't explain.
        """
        fields: dict[str, Any] = {"error_type": self.error_type, "retryable": self.retryable}
        if self.http_status is not None:
            fields["http_status"] = self.http_status
        return fields


def classify_error(exc: BaseException) -> ErrorClassification:
    """Classify ``exc`` into a stable ``error_type`` + ``retryable`` pair.

    Checks run most-specific-subclass first, purely by exception **type**
    (never by message text — wording is free to change without breaking
    callers that key off `error_type`). See the module docstring for the
    full vocabulary table, the CLI/MCP-parity rationale, and retry guidance.
    """
    if isinstance(exc, SearchTimeoutError):
        return ErrorClassification("timeout", retryable=True)
    if isinstance(exc, SearchCertificateError):
        # Checked before its parent SearchConnectionError: a bad or missing
        # CA bundle / an untrusted certificate is deterministic for a fixed
        # environment, unlike a transient DNS blip or dropped connection —
        # so, unlike connection_error, this is not retryable.
        return ErrorClassification("certificate_error", retryable=False)
    if isinstance(exc, SearchConnectionError):
        return ErrorClassification("connection_error", retryable=True)
    if isinstance(exc, SearchHTTPError):
        status = exc.status_code
        retryable = status is not None and (status in _RETRYABLE_HTTP_STATUSES or status >= 500)
        return ErrorClassification("http_error", retryable=retryable, http_status=status)
    if isinstance(exc, SearchRejectedError):
        # Google answered but declined the RPC outright (e.g. booking
        # options without a browser-signed header). Deterministic for a
        # plain HTTP client — retrying the same request will not help.
        return ErrorClassification("rejected_error", retryable=False)
    if isinstance(exc, SearchUnsupportedError):
        # The query is well formed but this transport has no path to
        # answer it (e.g. multi-city). Retrying will not help; the
        # request itself needs to change.
        return ErrorClassification("unsupported_error", retryable=False)
    if isinstance(exc, SearchParseError):
        # A page arrived but couldn't be read — most often a regional
        # consent/blocked interstitial. Not retryable *as-is*: the caller
        # needs to set FLI_SOCS_COOKIE (EU/EEA consent) or otherwise
        # change the request, not just retry the same one.
        return ErrorClassification("parse_error", retryable=False)
    if isinstance(exc, SearchClientError):
        # Catch-all for any other/future SearchClientError subclass that
        # doesn't have a more specific bucket above yet. Deterministic
        # until proven otherwise.
        return ErrorClassification("search_error", retryable=False)
    if isinstance(exc, ValidationError | ValueError):
        # Covers pydantic ValidationError, fli.core.parsers.ParseError
        # (a ValueError subclass used for bad airport/airline/etc. input),
        # and bare ValueError — notably the 93-date-per-search cap raised
        # by SearchDates.search(). All three mean "the request itself is
        # invalid", which the caller must fix before retrying, so they
        # share validation_error/not-retryable.
        return ErrorClassification("validation_error", retryable=False)
    return ErrorClassification("unexpected_error", retryable=False)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #258** (2026-09-22): **Live canary failing: Google Flights search**
  *Symptoms*: The scheduled live-canary workflow failed: the live tests failed twice in a row (initial run + one same-run retry of the failed cases). Run: https://github.com/punitarani/fli/actions/runs/35602399130
  **Post-Mortem & Fix Analysis**:
  > Live canary passed again. Run: https://github.com/punitarani/fli/actions/runs/35723219031

- **Issue #256** (2026-09-20): **fix(cli): do not print the sparse-results explanation twice in text mode**
  *Symptoms*: ## Summary  Follow-up to #255, found in a final end-to-end run of the built wheel: in text mode, an empty search for a party with children/infants showed the same explanation **twice**.  ``` $ fli flights SFO NRT <date> --class BUSINESS --children 1 No itineraries were inlined for this passenger mix. Google's search page prices …   ← stderr (library warning) No flights found. No itineraries were inlined for this passenger mix. Google's search page prices …   ← stdout (CLI echo) ```  `SearchFlights.search` already logs the explanation as a warning, which reaches the terminal on stderr like every other library warning. The flights command then printed the same paragraph again. The unit tests could not see this: under pytest the logging plugin replaces Python's last-resort stderr handler, and the mocked `SearchFlights` logs nothing.  ## What changes  - `fli flights` text mode no longer prints its own copy; the library's warning is the single explanation. The `--format json` empty payload keeps its `note` (JSON callers rarely read stderr). MCP is unchanged. - The now-unused `console` import goes with it; one `CLAUDE.md` sentence is corrected.  ## Verification  - Tests written first and watched fail (3 red): for a genuinely empty page there is exactly **one** WARNING record with the explanation and **nothing** on stdout; for rows removed by the caller's own airline filter there is no explanation at all. - Live, real CLI with the streams separated: stdout = `No flights found.`; std
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 100   1m 39s ⏱️ -4s 1 533 tests  - 589  1 404 ✅  - 589  129 💤 ±0  0 ❌ ±0  6 132 runs   - 591  5 616 ✅  - 591  516 💤 ±0  0 ❌ ±0   Results for commit 4e45f8e2. ± Comparison against base commit d925b0e8.  <details>   <summary>This pull request <b>removes</b> 593 and <b>adds</b> 4 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_flights ‑ test

- **Issue #255** (2026-09-20): **fix: say so when children or infants are why a search came back empty**
  *Symptoms*: ## Summary  When a search for a party with **children or infants** came back empty, the library said "no flights" — indistinguishable from a route with no service. Often the route has plenty: Google's search page simply inlines few or no itineraries for those parties (it prices them client-side, through the gated RPC), most of all in premium cabins. Extra adults cost nothing.  Measured live, one-way, 45 days out, rows returned (stable across repeats):  | | 1 adult | 2 adults | 1 adult + 1 child | 1 adult + lap infant | |---|---|---|---|---| | JFK→LHR economy | 23 | 23 | 23 | 16 | | JFK→LHR first | 11 | — | 11 | **0** | | SFO→NRT economy | 8 | — | 2 | 2 | | SFO→NRT business | 9 | 9 | **0** | **0** |  This does **not** fake results — no adults-only fallback, no estimated fares. It makes the empty answer honest.  ## What changes (Python and `fli-js`, mirrored)  - **Library:** when the result is empty, the party includes a child or infant, **and at least one fetched page carried zero rows before client-side filtering**, `SearchFlights.search` / `SearchDates.search` log exactly one warning explaining it, and set a read-only `sparse_passenger_mix` / `sparsePassengerMix` attribute (reset at the start of every search, including ones that raise). - The "before client-side filtering" condition matters: if Google *did* inline rows and the caller's own airline / price / duration / time-window filter removed them all, nothing is logged — the emptiness is the filter's, not Google's. Round 
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     5 files  ±  0    104 suites  +5   1m 35s ⏱️ +3s 2 122 tests + 67  1 993 ✅ + 67  129 💤 ±0  0 ❌ ±0  6 723 runs  +199  6 207 ✅ +199  516 💤 ±0  0 ❌ ±0   Results for commit 4dd96743. ± Comparison against base commit 122ef645.  [test-results]:data:application/gzip;base64,H4sIAPtRsGoC/02NSQ6DMBAEv4J8zsEeb3I+E+EFyQrgyMspyt8zJkA4VrWm5k2mOIdC7oO8DaS0WDdgVCD6lsca04rC9Bm32ldgAAc+SnOuXxjD/+4ZX92BOdU0xhkVPUXIOeXd5Lb2rtLAdzqyCqg+1a8qmTrMJbrxtenSssSKQIT3RmnBnbDBBZBWamsYRRcEgKOWaTsGfPf5AkaVSoQOAQAA 

- **Issue #254** (2026-09-20): **chore: describe code in terms a repo reader can follow (drop review-process references from comments)**
  *Symptoms*: ## Summary  Comment, docstring and one test-label cleanup — **no behaviour change**.  Several recently merged changes left comments that cite the private review process that produced them: internal task identifiers, "fix round 2", "maintainer ruling U1", "reviewer I1", finding labels. None of that exists anywhere a repo reader can look it up, so the comments read as noise, and some bury a genuinely useful *why* under the label.  Each one is rewritten to keep the reasoning and drop the provenance. Public references a reader can follow (PR and issue numbers, function names, measured figures) stay. Example:  ```diff -        # T10 fix round 2, maintainer ruling U1: previously hardcoded -        # "search_error" for both — see the report's "Behaviour changes". +        # Previously hardcoded "search_error" for both; now routed through +        # classify_error (#248) so the JSON error_type matches what MCP +        # reports for the same input. ```  16 files, about 30 locations; the only TypeScript change is one `describe()` label.  ## Verification  - **No code changed:** for each of the 15 Python files, the AST of `main`'s version equals the AST of this branch's version with docstring text blanked (comments are not AST nodes) — checked by the author and again independently. - The test count is identical to `main` on Python 3.10–3.13 (1,360 passed each); `ruff check` + `ruff format --check`; `bun run ci` (568 pass). - A grep for the reference patterns across `fli/`, `tests/`, `fl
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     5 files  ±0     99 suites  ±0   1m 32s ⏱️ ±0s 2 055 tests ±0  1 926 ✅ ±0  129 💤 ±0  0 ❌ ±0  6 524 runs  ±0  6 008 ✅ ±0  516 💤 ±0  0 ❌ ±0   Results for commit 6b42d3ca. ± Comparison against base commit 122ef645.  <details>   <summary>This pull request <b>removes</b> 9 and <b>adds</b> 9 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` SearchDates mostly-failed sweeps (T20) ‑ a minority of failures with no results returns null and warns exactly once SearchDates mostly-failed sweeps (T20) ‑ a tie between loaded and failed dates raises SearchDates mostly-failed sweeps (T20) ‑ all loaded empty returns null with no warnings SearchDates mostly-failed sweeps (T20) ‑ all priced returns the list with no warnings SearchDates mostly-failed sweeps (T20) ‑ attempted:false outcomes are ignored by the new arithmetic SearchDates mostly-failed sweeps (T20) ‑ mostly no-payload failures raise SearchParseError without the SOCS hint SearchDates mostly-failed swee

- **Issue #253** (2026-09-20): **fix(cli): an empty result no longer reports "Unexpected error: Exit: 1" or writes a traceback log**
  *Symptoms*: ## Summary  On an ordinary empty result the CLI printed a bogus crash report, and wrote a traceback file, after the real message:  ``` $ fli flights JFK LHR <date> No flights found. Error: Unexpected error: Exit: 1 Full traceback written to ~/.fli/logs/fli-error-….log ```  `raise typer.Exit(1)` on the empty-result path sits inside the `try:` whose last clause is a broad `except Exception`. `typer.Exit` is `click.exceptions.Exit`, a `RuntimeError` subclass, so the handler caught the control-flow exception and reported it as an unexpected error. Exit code was still 1, which is why nothing noticed. Present since #159 (shipped in v0.9.0); affects `fli flights`, `fli dates` and `fli multi` (both of its `Exit(1)` paths). A `typer.Abort` raised inside the block was swallowed the same way.  ## What changes  - `except (typer.Exit, typer.Abort): raise` immediately before the broad handler in the three commands. No message, exit code or JSON output changes; `--format json` already returned a well-formed empty payload before reaching the `raise`. - `tests/conftest.py`: an autouse fixture redirects `fli.cli.errors._LOG_DIR` to a per-test temp directory. The suite was writing real traceback files into the developer's `~/.fli/logs/` on every run (28 per full run, measured by filename).  ## Verification  - New `tests/cli/test_empty_result_exit.py` (10 tests): per command — exit code 1, the "No flights found…" text, **no** `Unexpected error` / `Exit: 1` / `Full traceback`, and the log directo
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 95   1m 27s ⏱️ +6s 1 489 tests  - 556  1 360 ✅  - 556  129 💤 ±0  0 ❌ ±0  5 956 runs   - 528  5 440 ✅  - 528  516 💤 ±0  0 ❌ ±0   Results for commit f9eefc9e. ± Comparison against base commit 25dec290.  <details>   <summary>This pull request <b>removes</b> 566 and <b>adds</b> 10 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_empty_result_e

- **Issue #252** (2026-09-20): **fix: carry the search's passenger mix into per-flight booking links**
  *Symptoms*: ## Summary  Per-flight booking deep links always encoded **one adult**, even when the search was for a family — the results showed the family price, and the link opened a booking page for a single traveller.  `encode_tfs_payload` already accepted `passengers` (repeated protobuf field 8, one entry per traveller), but `build_tfs_token` never passed it. This threads the search's passenger mix through the same path #231 used for the cabin class, in Python and `fli-js`.  ## What changes  | Area | Change | |---|---| | `fli/search/_proto.py`, `fli-js/src/search/proto.ts` | One shared `passenger_codes` / `passengerCodes` helper (1 adult, 2 child, 3 infant on lap, 4 infant in seat). `build_tfs_token` / `buildTfsToken` accept `passengers`. | | `fli/search/_tfs.py`, `fli-js/src/search/tfs.ts` | The search token now uses the same helper, so the search and booking tokens cannot drift. | | `SearchFlights.build_flight_booking_url` / `buildFlightBookingUrl` | New optional `passenger_info` / `passengerInfo`. Omitted → today's output, byte for byte. Still never raises. | | Call sites | MCP `search_flights`, MCP `get_booking_options` and the CLI flights command pass the search's passengers, as they already pass the cabin. | | Helper validation | Counts must be non-negative integers totalling at most 9 (the same ceiling `PassengerInfo` enforces), checked before anything is allocated; otherwise `ValueError` / `RangeError`. Found in review: a duck-typed `adults=10**6` produced a 2.7 MB URL after ~
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     5 files  ±  0     99 suites  +3   1m 23s ⏱️ +4s 2 045 tests + 62  1 916 ✅ + 62  129 💤 ±0  0 ❌ ±0  6 484 runs  +161  5 968 ✅ +161  516 💤 ±0  0 ❌ ±0   Results for commit cd86be45. ± Comparison against base commit 9982aff5.  [test-results]:data:application/gzip;base64,H4sIAK9EsGoC/03NSQ7DIAyF4atErLsAwtjLVMQBCTVDxbCqevc6NEmz/D9Lz28S4uQzuXfy1pFcY2lhLdZYkytxXbBNj42nsh05FfLIR64AaMwy9bdnfG3G7UnBxQmJnuBTWtMuqS7brhJG7HXMSqvMSb9V2R41uYy2vm7COs+xYBAYjRq8kG7QPgAIz4OWwHQIxmpGHVWK9ZoO5PMFrP3CjA0BAAA= 

- **Issue #251** (2026-09-20): **feat: clear TLS certificate errors and CA-bundle support (carries forward #164)**
  *Symptoms*: ## Summary  Carries forward the TLS half of #164 by @piersonrazzi onto current `main` (every commit is co-authored; the other half of #164 — a stable MCP `error_type` — already landed in #248).  Users behind a TLS-intercepting corporate proxy got a vague "check your connection" error, after three attempts with backoff, and had no way to point the client at their CA.  ## What changes  | Area | Change | |---|---| | `fli/search/exceptions.py` | `SearchCertificateError(SearchConnectionError)`, exported alongside its siblings | | `fli/search/client.py` | CA bundle from `FLI_CA_BUNDLE` → `CURL_CA_BUNDLE` → `REQUESTS_CA_BUNDLE` (first non-empty wins; an unreadable path fails immediately, naming the variable and path). curl_cffi's `CertificateVerifyError` → `SearchCertificateError` with an actionable message. **Certificate errors are no longer retried** — they are deterministic; everything else retries exactly as before. `_session()` still sets the `SOCS` consent cookie. | | `fli/core/errors.py` | `certificate_error`, `retryable: false`, checked before its parent `SearchConnectionError` (`retryable: true`) — same value from CLI `--format json` and the MCP tools | | `fli/cli/errors.py` | the actionable message on the human-readable path | | `tests/conftest.py` | autouse fixture clearing the three CA variables, so the suite is hermetic on a developer machine or CI runner behind a proxy | | Docs | `docs/guides/mcp.md`, `README.md`, `CLAUDE.md`: the variables, precedence, that they are r
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 92   1m 18s ⏱️ -1s 1 446 tests  - 502  1 317 ✅  - 502  129 💤 ±0  0 ❌ ±0  5 784 runs   - 399  5 268 ✅  - 399  516 💤 ±0  0 ❌ ±0   Results for commit 42774f63. ± Comparison against base commit 901d23d9.  <details>   <summary>This pull request <b>removes</b> 549 and <b>adds</b> 47 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_dates ‑ test_d

- **Issue #250** (2026-09-20): **feat: expose top_n for round-trip searches on the CLI and MCP tools**
  *Symptoms*: ## Summary  Fixes #142 — round-trip results "all come from a single airline".  `SearchFlights.search(filters, top_n=5)` fetches the outbound options and expands only the first `top_n` of them into return flights. With the default sort those five are usually the same cheap carrier. The library parameter existed, but neither the CLI nor the MCP tools let a caller change it, and nothing documented the trade-off.  ## What changes  | Layer | Change | |---|---| | CLI | `fli flights … --top-n N` (default 5, 1–10). Round trips only: left at its default it is ignored on a one-way search; set explicitly on a one-way search it is rejected with a one-line error. Echoed in the JSON `query` for round trips. | | MCP | `top_n` on `search_flights` **and** `get_booking_options` (the latter re-runs the search, so a flight found with `top_n=10` can still be priced). The description tells an agent what it does, what it costs, and that raising it is how to see more airlines. | | Library | `SearchFlights.search` validates `top_n` before any network call: an integer 1–10, otherwise a clear `ValueError` (non-ints and `bool` included). Default unchanged. | | Errors | A bad `top_n` reports `error_type: "validation_error"` from both CLI `--format json` and the MCP tools (parity case added). | | Docs | README, `docs/guides/mcp.md`, `CLAUDE.md`: the parameter, the cost model, and the one-line answer to #142. |  **Cost model:** a round trip costs `1 + top_n` page fetches (~2 MB each), so the upper bound of
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 92   1m 17s ⏱️ ±0s 1 411 tests  - 486  1 282 ✅  - 486  129 💤 ±0  0 ❌ ±0  5 644 runs   - 335  5 128 ✅  - 335  516 💤 ±0  0 ❌ ±0   Results for commit 69106af4. ± Comparison against base commit 74fa5506.  <details>   <summary>This pull request <b>removes</b> 537 and <b>adds</b> 51 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_top_n.TestTopN

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

### Incident Patch 1: `881aee5f` (2026-09-20)
**Commit Message**: fix(cli): do not print the sparse-passenger-mix explanation twice in text mode (#256)

SearchFlights.search already logs the explanation as a warning, which
reaches the terminal on stderr like every other library warning. The
flights command then printed the same paragraph again under "No flights
found.", so a terminal user read it twice. Text mode now leaves it to the
library; the JSON empty payload keeps its `note`, since JSON callers
rarely read stderr.

Tests assert the explanation appears exactly once (one WARNING record,
nothing on stdout) for a genuinely empty page, and not at all when the
caller's own filter emptied the result.

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +5/-3)
```diff
@@ -152,9 +152,11 @@ Consequences to keep in mind when changing search code:
   came back with zero rows, not when the caller's own airline/price/
   duration/window filter removed rows Google did return (see
   `SearchFlights.sparse_passenger_mix`). The MCP `search_flights` empty
-  response carries the same text as `note`, and the CLI prints it under
-  "No flights found.", both reading that attribute rather than recomputing
-  the condition — an adults-only search shows the schedule.
+  response and the CLI's `--format json` empty payload carry the same text
+  as `note`, both reading that attribute rather than recomputing the
+  condition. The CLI's text mode prints no copy of its own: the library's
+  warning already reaches the terminal on stderr, and echoing it showed the
+  same paragraph twice — an adults-only search shows the schedule.
 - Date searches have no calendar grid: one page fetch per date, capped at
   `fli.search.dates.MAX_DATES_PER_SEARCH` (93) per `SearchDates.search`. At the
   cap that is several hundred MB of pages and parsed JSON at peak.
```

**File**: `fli/cli/commands/flights.py` (modified, +6/-3)
```diff
@@ -5,7 +5,6 @@
 import typer
 from pydantic import ValidationError
 
-from fli.cli.console import console
 from fli.cli.enums import OutputFormat
 from fli.cli.errors import json_error_payload, report_cli_error
 from fli.cli.utils import (
@@ -250,9 +249,13 @@ def _search_flights_core(
                 )
                 return
 
+            # Text mode prints no copy of the note: SearchFlights.search has
+            # already logged the same explanation as a warning, which — like
+            # every other library warning — reaches the terminal on stderr.
+            # Echoing it here showed the user the same paragraph twice. JSON
+            # callers rarely read stderr, which is why the note rides in the
+            # payload above instead.
             typer.echo("No flights found.")
-            if sparse_note:
-                console.print(sparse_note, style="dim", soft_wrap=True)
             raise typer.Exit(1)
 
         # Build per-flight booking deep-links (tfs; never raises).
```

**File**: `tests/cli/test_flights.py` (modified, +49/-24)
```diff
@@ -1,6 +1,7 @@
 """Tests for the flights CLI command."""
 
 import json
+import logging
 from datetime import datetime, timedelta
 
 import pytest
@@ -520,13 +521,17 @@ def test_flights_no_results(runner, mock_search_flights, mock_console):
     assert "client-side" not in result.stdout
 
 
-def test_flights_no_results_with_child_explains_the_sparsity(runner, mock_search_flights):
-    """An empty result for a party with children/infants gets the extra hint.
-
-    Google's search page inlines fewer (sometimes zero) rows for those
-    parties — see SPARSE_PASSENGER_MIX_WARNING in fli.search.flights. The
-    CLI reads search_client.sparse_passenger_mix rather than recomputing
-    it, so the mock sets it the way the real library would for this party.
+def test_flights_no_results_with_child_does_not_repeat_the_library_warning(
+    runner, mock_search_flights
+):
+    """Text mode leaves the explanation to the library's own warning.
+
+    Google's search page inlines fewer (sometimes zero) rows for parties with
+    children/infants — see SPARSE_PASSENGER_MIX_WARNING in fli.search.flights.
+    ``SearchFlights.search`` logs that warning itself, and like every other
+    library warning it reaches the terminal on stderr, so printing it again
+    on stdout would show the user the same paragraph twice. (The mock here
+    logs nothing, which is what isolates the CLI's own output.)
     """
     mock_search_flights.search.return_value = []
     mock_search_flights.sparse_passenger_mix = True
@@ -546,10 +551,12 @@ def test_flights_no_results_with_child_explains_the_sparsity(runner, mock_search
     )
     assert result.exit_code == 1
     assert "No flights found" in result.stdout
-    assert "client-side" in result.stdout
+    assert "client-side" not in result.stdout
 
 
-def test_flights_no_results_with_infant_explains_the_sparsity(runner, mock_search_flights):
+def test_flights_no_results_with_infant_does_not_repeat_the_library_warning(
+    runner, mock_search_flights
+):
     mock_search_flights.search.return_value = []
     mock_search_flights.sparse_passenger_mix = True
 
@@ -565,17 +572,26 @@ def test_flights_no_results_with_infant_explains_the_sparsity(runner, mock_searc
         ],
     )
     assert result.exit_code == 1
-    assert "client-side" in result.stdout
+    assert "client-side" not in result.stdout
 
 
 class TestFlightsNoteTracksGoogleNotTheCallersFilter:
     """End-to-end (stubbed page, real ``SearchFlights.search``) — mirrors the MCP-level check.
 
-    A page that genuinely carries no rows still gets the hint; a page that
-    carries a row the caller's own airline filter then removes does not —
-    that emptiness is the filter's doing, not Google's.
+    A page that genuinely carries no rows is explained exactly once — by the
+    library's warning, not repeated on stdout; a page that carries a row the
+    caller's own airline filter then removes is not explained at all — that
+    emptiness is the filter's doing, not Google's.
     """
 
+    @staticmethod
+    def _sparse_warnings(caplog) -> list[str]:
+        return [
+            record.getMessage()
+            for record in caplog.records
+            if record.levelno == logging.WARNING and "client-side" in record.getMessage()
+        ]
+
     def _page(self, rows: list) -> str:
         payload = [[None, None, None, None, "FAKE_SESSION"], None, [rows], None]
         return as_search_page(payload)
@@ -586,20 +602,32 @@ def _fake_get(self, url, **kwargs):  # noqa: ANN001
 
         monkeypatch.setattr("fli.search.client.Client.get", _fake_get)
 
-    def test_genuinely_empty_page_prints_the_hint(self, runner, monkeypatch):
+    def test_genuinely_empty_page_is_explained_exactly_once(self, runner, monkeypatch, caplog):
         self._stub_get(monkeypatch, self._page([]))
-        result = runner.invoke(
-            app,
-            ["flights", "JFK", "LHR", datetime.now().strftime("%Y-%m-%d"), "--children", "1"],
-        )
+        with caplog.at_level(logging.WARNING, logger="fli"):
+            result = runner.invoke(
+                app,
+                ["flights", "JFK", "LHR", datetime.now().strftime("%Y-%m-%d"), "--children", "1"],
+            )
         assert result.exit_code == 1
         assert "No flights found" in result.stdout
-        assert "client-side" in result.stdout
+        # Once, from the library (stderr in a real terminal) — never echoed on stdout too.
+        assert len(self._sparse_warnings(caplog)) == 1
+        assert "client-side" not in result.stdout
 
-    def test_rows_filtered_out_by_airline_prints_no_hint(self, runner, monkeypatch):
+    def test_rows_filtered_out_by_airline_is_not_explained(self, runner, monkeypatch, caplog):
         row = _row(legs=[_leg(dep_iata="JFK", arr_iata="LHR", airline_code="DL")])
         self._stub_get(monkeypatch, self._page([row]))
-        result = runner.invoke(
+        with caplog.at_level(logging.WARNING, logger="fli"):
+            result = s
```

---

### Incident Patch 2: `d925b0e8` (2026-09-20)
**Commit Message**: fix: say so when children or infants are why a search came back empty (#255)

* fix(search): warn when an empty result may be Google's sparse-mix pricing gap

Google's search page prices parties with children or infants client-side, so
an empty SearchFlights.search / SearchDates.search result for those parties
used to read the same as a route with no flights at all. Log one warning
(SPARSE_PASSENGER_MIX_WARNING) when the final result is empty and the party
includes a child or infant; extra adults never trigger it. Fires at most once
per search() call, even for round trips, and never stacks on top of #249's
minority-date-failure warning in the date sweep.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* fix(mcp): add a note explaining sparse results for children/infants

search_flights' empty response now carries a "note" key with the same
sparse-passenger-mix explanation the library logs, so an agent relaying the
result says why the list is empty instead of implying the route has no
flights. Adults-only and non-empty results never get the key.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* fix(cli): explain sparse results for children/infants on empty search

The flig

**File**: `CLAUDE.md` (modified, +14/-0)
```diff
@@ -141,6 +141,20 @@ Consequences to keep in mind when changing search code:
   offline and unaffected.
 - A search returns fewer rows than the old RPC (~20-45), and client-side
   filtering is not back-filled.
+- **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries for
+  them, and in premium cabins often none (measured 2026-09: JFK→LHR economy
+  23 rows for one adult, 16 with an infant; SFO→NRT business 9 rows for one
+  or two adults, 0 with a child). Extra adults cost nothing. An empty result
+  for such a search does not mean the route has no flights — and neither
+  does it mean this is why: `SearchFlights.search` / `SearchDates.search`
+  only warn (`SPARSE_PASSENGER_MIX_WARNING`) when the fetched page itself
+  came back with zero rows, not when the caller's own airline/price/
+  duration/window filter removed rows Google did return (see
+  `SearchFlights.sparse_passenger_mix`). The MCP `search_flights` empty
+  response carries the same text as `note`, and the CLI prints it under
+  "No flights found.", both reading that attribute rather than recomputing
+  the condition — an adults-only search shows the schedule.
 - Date searches have no calendar grid: one page fetch per date, capped at
   `fli.search.dates.MAX_DATES_PER_SEARCH` (93) per `SearchDates.search`. At the
   cap that is several hundred MB of pages and parsed JSON at peak.
```

**File**: `README.md` (modified, +10/-0)
```diff
@@ -190,6 +190,16 @@ What that means in practice:
 * **Fewer rows per search.** Expect roughly 20-45 itineraries, fewer than the
   old RPC returned — and a client-side filter cannot back-fill the list the way
   Google's server-side one did.
+* **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries for
+  them, and in premium cabins often none (measured 2026-09: JFK→LHR economy
+  23 rows for one adult, 16 with an infant; SFO→NRT business 9 rows for one
+  or two adults, 0 with a child). Extra adults cost nothing. An empty result
+  for such a search does not mean the route has no flights — and neither
+  does it mean this is why: `search()` only warns when the fetched page
+  itself came back with zero rows, not when the caller's own airline/price/
+  duration/window filter removed rows Google did return. An adults-only
+  search shows the schedule.
 * **Date searches cost one page fetch per date.** The page has no calendar
   grid, so a range is priced date by date; one `SearchDates.search` covers at
   most 93 dates and a wider range raises `ValueError`. Budget for it: 93 dates
```

**File**: `docs/typescript/quickstart.md` (modified, +10/-0)
```diff
@@ -233,6 +233,16 @@ What that means in practice:
 * **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than
   the old RPC returned — and a client-side filter cannot back-fill the
   list the way Google's server-side one did.
+* **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries
+  for them, and in premium cabins often none (measured 2026-09: JFK→LHR
+  economy 23 rows for one adult, 16 with an infant; SFO→NRT business 9
+  rows for one or two adults, 0 with a child). Extra adults cost nothing.
+  An empty result for such a search does not mean the route has no
+  flights — and neither does it mean this is why: `search()` only warns
+  when the fetched page itself came back with zero rows, not when the
+  caller's own airline/price/duration/window filter removed rows Google
+  did return. An adults-only search shows the schedule.
 * **Date searches cost one page fetch per date**, capped at 93 dates. A
   sweep that never loads a single page stops once five dates have come
   back payload-less and throws, rather than paying the retry budget on
```

**File**: `fli-js/README.md` (modified, +10/-0)
```diff
@@ -124,6 +124,16 @@ What that means in practice:
 - **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than the
   old RPC returned — and a client-side filter cannot back-fill the list the way
   Google's server-side one did.
+- **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries for
+  them, and in premium cabins often none (measured 2026-09: JFK→LHR economy
+  23 rows for one adult, 16 with an infant; SFO→NRT business 9 rows for one
+  or two adults, 0 with a child). Extra adults cost nothing. An empty result
+  for such a search does not mean the route has no flights — and neither
+  does it mean this is why: `search()` only warns when the fetched page
+  itself came back with zero rows, not when the caller's own airline/price/
+  duration/window filter removed rows Google did return. An adults-only
+  search shows the schedule.
 - **Date searches cost one page fetch per date.** The page has no calendar
   grid, so a range is priced date by date; one `SearchDates.search` covers at
   most 93 dates (`MAX_DATES_PER_SEARCH`) and a wider range throws `RangeError`.
```

**File**: `fli-js/src/search/dates.ts` (modified, +127/-5)
```diff
@@ -12,7 +12,7 @@
  */
 
 import { formatIsoDate, parseIsoDate } from "../core/dates.ts";
-import type { FlightResult } from "../models/google-flights/base.ts";
+import type { FlightResult, PassengerInfo } from "../models/google-flights/base.ts";
 import { TripType } from "../models/google-flights/base.ts";
 import type { DateSearchFilters } from "../models/google-flights/dates.ts";
 import { type Client, getClient } from "./client.ts";
@@ -44,6 +44,29 @@ export const NO_PAYLOAD =
   "the search page carried no ds:1 payload — Google may have changed the " +
   "page shape, or served a consent/blocked page instead";
 
+/**
+ * Same wording `flights.ts` uses for the same condition — see
+ * {@link SPARSE_PASSENGER_MIX_WARNING} there for the live JFK-LHR / SFO-NRT
+ * row counts behind it. Duplicated rather than imported so this module's
+ * empty-result path stays self-contained.
+ */
+export const SPARSE_PASSENGER_MIX_WARNING =
+  "No itineraries were inlined for this passenger mix. Google's search page " +
+  "prices parties with children or infants client-side, so it often carries " +
+  "few or no rows for them — most of all in premium cabins. This does not " +
+  "mean the route has no flights: an adults-only search shows the schedule.";
+
+/**
+ * Whether the party includes anyone Google prices client-side.
+ *
+ * Extra adults ride the request for free; children and infants (lap or
+ * seat) are the passenger types that make the search-page transport inline
+ * fewer — sometimes zero — rows. See {@link SPARSE_PASSENGER_MIX_WARNING}.
+ */
+function hasChildrenOrInfants(passengerInfo: PassengerInfo): boolean {
+  return passengerInfo.children + passengerInfo.infants_on_lap + passengerInfo.infants_in_seat > 0;
+}
+
 /**
  * Most dates a single {@link SearchDates.search} call will price.
  *
@@ -164,10 +187,29 @@ export interface DateOutcome {
   error: unknown;
   /** False for dates skipped before any request, so they don't count as failures. */
   attempted: boolean;
+  /**
+   * How many rows the page decoded to *before* `applyClientSideFilters` ran,
+   * or `null`/absent when the page never loaded (`failure` is set) or the
+   * outcome was built by hand. Zero here means Google itself inlined
+   * nothing for the date; a positive count that still left `price` unset
+   * means the caller's own airline/price/duration/window filter removed
+   * every row — a different cause, so the two must not be conflated when
+   * deciding whether to blame a sparse passenger mix. Optional so existing
+   * hand-built ``DateOutcome`` literals (test fixtures predating this field)
+   * still type-check; an absent value reads the same as `null`.
+   */
+  rowsBeforeFilters?: number | null;
 }
 
 function outcome(over: Partial<DateOutcome> = {}): DateOutcome {
-  return { price: null, failure: null, error: null, attempted: true, ...over };
+  return {
+    price: null,
+    failure: null,
+    error: null,
+    attempted: true,
+    rowsBeforeFilters: null,
+    ...over,
+  };
 }
 
 /** Midnight UTC today. */
@@ -253,11 +295,32 @@ export class SearchDates {
   static readonly MAX_DATES_PER_SEARCH = MAX_DATES_PER_SEARCH;
 
   private readonly client: Client;
+  private _sparsePassengerMix = false;
 
   constructor(client?: Client) {
     this.client = client ?? getClient();
   }
 
+  /**
+   * Whether the sparse-passenger-mix warning fired on the most recent `search()`.
+   *
+   * `true` exactly when the empty sweep this instance last returned (or
+   * threw out of) was consistent with Google's client-side pricing gap for
+   * children/infants rather than the caller's own filters — see
+   * {@link SearchDates._warnIfSparsePassengerMix}. Reset to `false` at the
+   * start of every `search()` call, including ones that throw, so a stale
+   * `true` from an earlier call never leaks into a later one.
+   *
+   * Reflects only the *last completed* `search()` call on this instance and
+   * is not meant for instances shared across concurrent searches. Not
+   * currently read by any caller in this package (unlike
+   * {@link SearchFlights.sparsePassengerMix}); exposed here for symmetry
+   * with the warning this class already logs.
+   */
+  get sparsePassengerMix(): boolean {
+    return this._sparsePassengerMix;
+  }
+
   /**
    * Price every date in the filters' range.
    *
@@ -281,6 +344,10 @@ export class SearchDates {
     filters: DateSearchFilters,
     options: DateSearchOptions = {},
   ): Promise<DatePrice[] | null> {
+    // Reset before anything below can throw, so a search that throws never
+    // leaves a stale true from an earlier call on this instance.
+    this._sparsePassengerMix = false;
+
     throwIfAborted(options.signal);
 
     const dropped = unsupportedFilters(filters);
@@ -328,7 +395,53 @@ export class SearchDates {
     // not what happened.
     throwIfAborted(options.signal);
 
-    return SearchDates._collect(outcomes, tasks.length, health.skipped);
+    const result = SearchDates._
```

**File**: `fli-js/src/search/flights.ts` (modified, +124/-2)
```diff
@@ -31,6 +31,61 @@ import {
 import { withLocaleParams } from "./urls.ts";
 import { iterWrbChunks } from "./wire.ts";
 
+/**
+ * Google inlines fewer rows — in premium cabins often none — for parties
+ * with children or infants, because those fares are priced client-side
+ * through the gated RPC this transport cannot reach; extra adults cost
+ * nothing. Measured live 2026-09-20: JFK-LHR economy held 23 rows for one
+ * adult and 16 with a lap infant; SFO-NRT business held 9 for one or two
+ * adults and 0 with a child.
+ */
+export const SPARSE_PASSENGER_MIX_WARNING =
+  "No itineraries were inlined for this passenger mix. Google's search page " +
+  "prices parties with children or infants client-side, so it often carries " +
+  "few or no rows for them — most of all in premium cabins. This does not " +
+  "mean the route has no flights: an adults-only search shows the schedule.";
+
+/**
+ * Whether the party includes anyone Google prices client-side.
+ *
+ * Extra adults ride the request for free; children and infants (lap or
+ * seat) are the passenger types that make the search-page transport inline
+ * fewer — sometimes zero — rows. See {@link SPARSE_PASSENGER_MIX_WARNING}.
+ */
+function hasChildrenOrInfants(passengerInfo: PassengerInfo): boolean {
+  return passengerInfo.children + passengerInfo.infants_on_lap + passengerInfo.infants_in_seat > 0;
+}
+
+/**
+ * Notes whether any fetched page decoded to zero rows before filtering.
+ *
+ * A round trip fetches the outbound page and then one page per expanded
+ * candidate (up to `topN`) as concurrent promises, so this is a fresh,
+ * per-{@link SearchFlights.search} object — never instance state. JavaScript
+ * runs those workers on one thread, so unlike the Python original this needs
+ * no lock, but it is still shared mutable state read after every worker's
+ * promise has settled, the same role `SweepHealth` plays in `dates.ts`.
+ *
+ * Distinguishes "Google itself inlined nothing" (rows === 0) from "Google
+ * inlined rows and the caller's own airline/price/duration/window filter
+ * removed every one of them" (rows > 0 but `applyClientSideFilters` emptied
+ * the list) — only the former is evidence of the sparse-passenger-mix
+ * pricing gap.
+ */
+class RowCountTracker {
+  private anyZero = false;
+
+  /** Note one page's decoded row count, before client-side filtering. */
+  record(rawRowCount: number): void {
+    if (rawRowCount === 0) this.anyZero = true;
+  }
+
+  /** Whether any recorded page decoded to zero rows. */
+  get anyZeroRows(): boolean {
+    return this.anyZero;
+  }
+}
+
 /**
  * Result ordering for `sortBy`.
  *
@@ -118,11 +173,37 @@ export class SearchFlights {
 
   private readonly client: Client;
   private _lastSessionId: string | null = null;
+  private _sparsePassengerMix = false;
 
   constructor(client?: Client) {
     this.client = client ?? getClient();
   }
 
+  /**
+   * Whether the sparse-passenger-mix warning fired on the most recent `search()`.
+   *
+   * `true` exactly when the empty result this instance last returned (or
+   * threw out of) was consistent with Google's client-side pricing gap for
+   * children/infants — at least one fetched page decoded to zero rows
+   * before client-side filtering, and the party had a child or infant —
+   * rather than the caller's own airline/price/duration/window filter
+   * removing rows Google did inline. See {@link SPARSE_PASSENGER_MIX_WARNING}.
+   * Reset to `false` at the start of every `search()` call, including ones
+   * that throw, so a stale `true` from an earlier call never leaks into a
+   * later one.
+   *
+   * Reflects only the *last completed* `search()` call on this instance and
+   * is not meant for instances shared across concurrent searches — two
+   * overlapping `search()` calls on one `SearchFlights` would race on this
+   * the same way they already race on the cached session id used by
+   * {@link SearchFlights.getBookingOptions}. Any MCP-equivalent or CLI-style
+   * caller should read this after `search()` instead of recomputing the
+   * condition itself.
+   */
+  get sparsePassengerMix(): boolean {
+    return this._sparsePassengerMix;
+  }
+
   /**
    * Search for flights using the given filters.
    *
@@ -140,23 +221,60 @@ export class SearchFlights {
     filters: FlightSearchFilters,
     options: SearchOptions = {},
   ): Promise<Array<FlightResult | FlightResult[]> | null> {
+    // Reset before anything below can throw, so a search that throws never
+    // leaves a stale true from an earlier call on this instance.
+    this._sparsePassengerMix = false;
+
     const topN = options.topN ?? 5;
+    // Per-search — never instance state, which the round trip's concurrent
+    // expansion workers (below) would trample mid-flight.
+    const tracker = new RowCountTracker();
     const flights = await this._fetchFlights(filters, {
       currency: options.currency ?? null,
       language: options.language ?? null,
       countr
```

**File**: `fli-js/tests/integration/sparse_passenger_warning.test.ts` (added, +642/-0)
```diff
@@ -0,0 +1,642 @@
+/**
+ * Tests for the sparse-passenger-mix warning on empty results.
+ *
+ * Google's search-page transport inlines fewer (sometimes zero) rows for
+ * parties with children or infants — the fares are priced client-side
+ * through the gated RPC this transport cannot reach. An empty
+ * `SearchFlights.search` / `SearchDates.search` result for such a party used
+ * to be indistinguishable from a route with no service at all; these tests
+ * pin the one warning each call logs to explain the difference, and confirm
+ * it stays silent whenever it would not apply.
+ *
+ * A result can also come back empty because the *caller's own* client-side
+ * filter (airline, price cap, max duration, departure window) removed every
+ * row Google did inline — that is not evidence of the passenger-mix pricing
+ * gap, so a second family of tests below pins that the warning (and the
+ * `sparsePassengerMix` getter both classes expose) only fires when at least
+ * one fetched page decoded to zero rows *before* filtering.
+ *
+ * Mirrors tests/search/test_sparse_passenger_warning.py.
+ */
+
+import { describe, expect, test } from "bun:test";
+import { Airline } from "../../src/models/airline.ts";
+import { Airport } from "../../src/models/airport.ts";
+import {
+  FlightSegment,
+  type PassengerInfo,
+  TripType,
+} from "../../src/models/google-flights/base.ts";
+import { DateSearchFilters } from "../../src/models/google-flights/dates.ts";
+import { FlightSearchFilters } from "../../src/models/google-flights/flights.ts";
+import { Client } from "../../src/search/client.ts";
+import {
+  SPARSE_PASSENGER_MIX_WARNING as DATES_SPARSE_WARNING,
+  type DateOutcome,
+  type DatePrice,
+  SearchDates,
+} from "../../src/search/dates.ts";
+import {
+  SPARSE_PASSENGER_MIX_WARNING as FLIGHTS_SPARSE_WARNING,
+  SearchFlights,
+} from "../../src/search/flights.ts";
+import { setSearchLogger } from "../../src/search/logging.ts";
+
+const ADULT_ONLY: PassengerInfo = {
+  adults: 2,
+  children: 0,
+  infants_in_seat: 0,
+  infants_on_lap: 0,
+};
+const WITH_CHILD: PassengerInfo = { adults: 1, children: 1, infants_in_seat: 0, infants_on_lap: 0 };
+
+function futureDate(daysAhead = 45): string {
+  const d = new Date();
+  d.setUTCDate(d.getUTCDate() + daysAhead);
+  return d.toISOString().slice(0, 10);
+}
+
+/** A minimal flight row `parseFlightRow` accepts. */
+function flightRow(price = 199.99, airlineCode = "DL"): unknown {
+  const leg: unknown[] = [
+    airlineCode,
+    null,
+    null,
+    "JFK",
+    null,
+    null,
+    "LAX",
+    null,
+    [12, 30],
+    null,
+    [16, 45],
+    375,
+    null,
+    null,
+    null,
+    null,
+    null,
+    "Boeing 737",
+    null,
+    false,
+    [2026, 12, 25],
+    [2026, 12, 25],
+    [airlineCode, "100"],
+  ];
+  while (leg.length < 32) leg.push(null);
+  const detail: unknown[] = Array.from({ length: 25 }, () => null);
+  detail[0] = airlineCode;
+  detail[1] = ["Carrier"];
+  detail[2] = [leg];
+  detail[9] = 375;
+  const row: unknown[] = Array.from({ length: 11 }, () => null);
+  row[0] = detail;
+  row[1] = [[null, price], null];
+  return row;
+}
+
+function asSearchPage(payload: unknown): string {
+  return `<script>AF_initDataCallback({key: 'ds:1', hash: '1', data:${JSON.stringify(payload)}, sideChannel: {}});</script>`;
+}
+
+/** Wrap flight rows as a rendered search page (shared shape flights & dates both read). */
+function searchPage(rows: unknown[]): string {
+  const payload: unknown[] = Array.from({ length: 4 }, () => null);
+  payload[0] = [null, null, null, null, "test-session-id"];
+  payload[2] = [rows];
+  return asSearchPage(payload);
+}
+
+function oneWayFlightFilters(
+  passengerInfo: PassengerInfo,
+  overrides: Partial<ConstructorParameters<typeof FlightSearchFilters>[0]> = {},
+): FlightSearchFilters {
+  return new FlightSearchFilters({
+    passenger_info: passengerInfo,
+    flight_segments: [
+      new FlightSegment({
+        departure_airport: [[[Airport.JFK, 0]]],
+        arrival_airport: [[[Airport.LAX, 0]]],
+        travel_date: futureDate(),
+      }),
+    ],
+    ...overrides,
+  });
+}
+
+function roundTripFlightFilters(
+  passengerInfo: PassengerInfo,
+  overrides: Partial<ConstructorParameters<typeof FlightSearchFilters>[0]> = {},
+): FlightSearchFilters {
+  return new FlightSearchFilters({
+    trip_type: TripType.ROUND_TRIP,
+    passenger_info: passengerInfo,
+    flight_segments: [
+      new FlightSegment({
+        departure_airport: [[[Airport.JFK, 0]]],
+        arrival_airport: [[[Airport.LAX, 0]]],
+        travel_date: futureDate(45),
+      }),
+      new FlightSegment({
+        departure_airport: [[[Airport.LAX, 0]]],
+        arrival_airport: [[[Airport.JFK, 0]]],
+        travel_date: futureDate(52),
+      }),
+    ],
+    ...overrides,
+  });
+}
+
+function oneWayDateFilters(
+  days: number,
+  passengerInfo: PassengerInfo,
+  overrides: Partial<ConstructorParameters<typeof DateSearchFilters>[0]> 
```

**File**: `fli/cli/commands/flights.py` (modified, +15/-0)
```diff
@@ -5,6 +5,7 @@
 import typer
 from pydantic import ValidationError
 
+from fli.cli.console import console
 from fli.cli.enums import OutputFormat
 from fli.cli.errors import json_error_payload, report_cli_error
 from fli.cli.utils import (
@@ -40,6 +41,7 @@
     TripType,
 )
 from fli.search import SearchClientError, SearchFlights
+from fli.search.flights import SPARSE_PASSENGER_MIX_WARNING
 
 
 def _search_flights_core(
@@ -224,6 +226,16 @@ def _search_flights_core(
         )
 
         if not results:
+            # Read the library's own verdict rather than recomputing "empty +
+            # children/infants" here: SearchFlights.search already knows
+            # whether the empty result traces back to a page Google itself
+            # served with zero rows, versus the caller's own airline/price/
+            # duration/window filter removing rows Google did inline — that
+            # distinction lives in the fetch path, not in these arguments,
+            # so it can only be answered correctly once, there.
+            sparse_note = (
+                SPARSE_PASSENGER_MIX_WARNING if search_client.sparse_passenger_mix else None
+            )
             if output_format == OutputFormat.JSON:
                 emit_json(
                     build_json_success_response(
@@ -233,11 +245,14 @@ def _search_flights_core(
                         results_key="flights",
                         results=[],
                         booking_url=booking_url,
+                        note=sparse_note,
                     )
                 )
                 return
 
             typer.echo("No flights found.")
+            if sparse_note:
+                console.print(sparse_note, style="dim", soft_wrap=True)
             raise typer.Exit(1)
 
         # Build per-flight booking deep-links (tfs; never raises).
```

---

### Incident Patch 3: `122ef645` (2026-09-20)
**Commit Message**: fix(cli): an empty result no longer reports "Unexpected error: Exit: 1" or writes a traceback log (#253)

* fix(cli): stop reporting empty search results as an unexpected error

flights, dates, and multi each raise typer.Exit(1) inside their try block
once a search legitimately returns nothing. typer.Exit is
click.exceptions.Exit, a RuntimeError subclass, so it fell through into
the trailing `except Exception` handler and got reported as a crash: a
bogus "Unexpected error: Exit: 1" line plus a full traceback log file
under ~/.fli/logs/ for a perfectly normal "no flights matched" outcome.

Add an `except (typer.Exit, typer.Abort): raise` clause before the broad
handler in all three commands so deliberate control-flow exits (empty
results in flights/dates/multi, and multi's "at least 2 legs" guard) pass
through untouched. Genuinely unexpected exceptions are unaffected — none
of the narrower clauses (ParseError, ValidationError, AttributeError/
ValueError, SearchClientError) catch RuntimeError subclasses either, so
this was the only gap. JSON mode was already unaffected: it returns a
well-formed empty payload before reaching the raise.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL

**File**: `fli/cli/commands/dates.py` (modified, +7/-0)
```diff
@@ -598,6 +598,13 @@ def dates(
             raise typer.Exit(1) from e
         typer.echo(f"Error: {str(e)}")
         raise typer.Exit(1) from e
+    except (typer.Exit, typer.Abort):
+        # click.exceptions.Exit/Abort are RuntimeError subclasses, so without
+        # this clause the broad except below would catch the deliberate
+        # `raise typer.Exit(1)` above (empty results) and report it as a
+        # crash: bogus "Unexpected error" text plus a traceback log file for
+        # a perfectly normal "no flights matched" outcome.
+        raise
     except Exception as e:  # noqa: BLE001 — fall back to clean reporting
         if output_format == OutputFormat.JSON:
             payload_info = json_error_payload(e, command="dates")
```

**File**: `fli/cli/commands/flights.py` (modified, +7/-0)
```diff
@@ -346,6 +346,13 @@ def _search_flights_core(
             emit_json(payload)
             raise typer.Exit(1) from e
         raise report_cli_error(e, command="flights") from e
+    except (typer.Exit, typer.Abort):
+        # click.exceptions.Exit/Abort are RuntimeError subclasses, so without
+        # this clause the broad except below would catch the deliberate
+        # `raise typer.Exit(1)` above (empty results) and report it as a
+        # crash: bogus "Unexpected error" text plus a traceback log file for
+        # a perfectly normal "no flights matched" outcome.
+        raise
     except Exception as e:  # noqa: BLE001 — fall back to clean reporting
         if output_format == OutputFormat.JSON:
             payload_info = json_error_payload(e, command="flights")
```

**File**: `fli/cli/commands/multi.py` (modified, +7/-0)
```diff
@@ -213,5 +213,12 @@ def multi(
         raise typer.Exit(1) from e
     except SearchClientError as e:
         raise report_cli_error(e, command="multi") from e
+    except (typer.Exit, typer.Abort):
+        # click.exceptions.Exit/Abort are RuntimeError subclasses, so without
+        # this clause the broad except below would catch either of the
+        # deliberate `raise typer.Exit(1)` calls above (too few legs, empty
+        # results) and report it as a crash: bogus "Unexpected error" text
+        # plus a traceback log file for a perfectly normal outcome.
+        raise
     except Exception as e:  # noqa: BLE001 — fall back to clean reporting
         raise report_cli_error(e, command="multi") from e
```

**File**: `tests/cli/test_empty_result_exit.py` (added, +220/-0)
```diff
@@ -0,0 +1,220 @@
+"""An ordinary empty search result must exit clean, not report a crash.
+
+`typer.Exit(1)` — raised in the empty-result branch of `flights`, `dates`, and
+`multi` once the search legitimately returns nothing — is `click.exceptions.Exit`,
+a `RuntimeError` subclass. Each command's broad `except Exception` handler used to
+catch that control-flow exception too, so a perfectly normal "no flights matched"
+outcome also printed a bogus "Unexpected error: Exit: 1" line and wrote a
+traceback log file under `~/.fli/logs/`.
+
+These tests pin down two things per command: the empty-result path exits clean
+with exactly its own message (no extra "Unexpected error" text, no log file),
+and a genuine unexpected exception is still caught and reported exactly as
+before (message + log file) — the fix must not blind the broad handler.
+
+Kept in a new file rather than appended to test_flights.py /test_dates.py /
+test_multi.py: another branch in flight also touches those files, and this
+avoids conflicting with it.
+"""
+
+import json
+from datetime import datetime, timedelta
+from pathlib import Path
+
+import pytest
+from typer.testing import CliRunner
+
+from fli.cli.main import app
+
+
+@pytest.fixture
+def runner() -> CliRunner:
+    """Return a CliRunner instance."""
+    return CliRunner()
+
+
+@pytest.fixture(autouse=True)
+def _isolated_tmp_log_dir(monkeypatch, tmp_path):
+    """Redirect _LOG_DIR so log files land under tmp_path instead of ~/.fli/logs/.
+
+    The target subdirectory does not exist until `_write_log` creates it, so
+    "no log file was written" can be asserted as "the directory was never
+    created" — a bug that silently creates-and-writes would fail that check,
+    while a test that merely looked for zero *known* filenames would not.
+    """
+    monkeypatch.setattr("fli.cli.errors._LOG_DIR", tmp_path / "fli-logs")
+
+
+def _log_dir(tmp_path: Path) -> Path:
+    return tmp_path / "fli-logs"
+
+
+def _future_date(days_ahead: int) -> str:
+    """Return a future date string in YYYY-MM-DD format, relative to today."""
+    return (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
+
+
+# ---------------------------------------------------------------------------
+# flights
+# ---------------------------------------------------------------------------
+
+
+def test_flights_empty_result_exits_clean(runner, mock_search_flights, mock_console, tmp_path):
+    """An ordinary empty flight search exits 1 with only the empty-result message."""
+    mock_search_flights.search.return_value = []
+
+    result = runner.invoke(app, ["flights", "JFK", "LHR", _future_date(40)])
+
+    assert result.exit_code == 1
+    assert result.output.count("No flights found.") == 1
+    assert "Unexpected error" not in result.output
+    assert "Exit: 1" not in result.output
+    assert "Full traceback" not in result.output
+    assert not _log_dir(tmp_path).exists()
+
+
+def test_flights_json_empty_result_unchanged(runner, mock_search_flights, mock_console):
+    """`--format json` still exits 0 with an empty flights[] payload, untouched by the fix."""
+    mock_search_flights.search.return_value = []
+
+    result = runner.invoke(app, ["flights", "JFK", "LHR", _future_date(40), "--format", "json"])
+
+    assert result.exit_code == 0
+    payload = json.loads(result.stdout)
+    assert payload["success"] is True
+    assert payload["count"] == 0
+    assert payload["flights"] == []
+
+
+def test_flights_unexpected_exception_still_reported(
+    runner, mock_search_flights, mock_console, tmp_path
+):
+    """A genuine crash still goes through the broad handler: message + log file."""
+    mock_search_flights.search.side_effect = RuntimeError("boom")
+
+    result = runner.invoke(app, ["flights", "JFK", "LHR", _future_date(40)])
+
+    assert result.exit_code == 1
+    assert "Unexpected error: RuntimeError: boom" in result.output
+    assert "Full traceback written to" in result.output
+    log_dir = _log_dir(tmp_path)
+    assert log_dir.exists()
+    assert list(log_dir.iterdir())
+
+
+# ---------------------------------------------------------------------------
+# dates
+# ---------------------------------------------------------------------------
+
+
+def test_dates_empty_result_exits_clean(runner, mock_search_dates, mock_console, tmp_path):
+    """An ordinary empty dates search exits 1 with only the empty-result message."""
+    mock_search_dates.search.return_value = []
+
+    result = runner.invoke(app, ["dates", "JFK", "LHR"])
+
+    assert result.exit_code == 1
+    assert result.output.count("No flights found for these dates.") == 1
+    assert "Unexpected error" not in result.output
+    assert "Exit: 1" not in result.output
+    assert "Full traceback" not in result.output
+    assert not _log_dir(tmp_path).exists()
+
+
+def test_dates_empty_result_for_selected_days_exits_clean(
+    runner, mock_search_dates, mock_console, tmp_path
+):
+    """The "selected days" empty-re
```

**File**: `tests/conftest.py` (modified, +21/-0)
```diff
@@ -61,6 +61,27 @@ def _scrub_ca_bundle_env(monkeypatch):
     monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)
 
 
+@pytest.fixture(autouse=True)
+def _isolate_cli_error_log_dir(monkeypatch, tmp_path):
+    """Redirect ``fli.cli.errors._LOG_DIR`` under ``tmp_path`` for every test.
+
+    ``_LOG_DIR`` is ``Path.home() / ".fli" / "logs"`` — a module-level
+    constant, read once at import time. Any test that exercises
+    ``report_cli_error`` / ``json_error_payload``, directly or indirectly
+    (a CLI command hitting an error path, a search helper whose error
+    surfaces through the CLI reporter), calls ``_write_log()``, which
+    creates that directory and drops a full traceback file into it. Left
+    unpatched, running the suite writes real files into the developer's
+    actual ``~/.fli/logs/`` on every run — tests must never touch that
+    directory. Autouse, suite-wide, so no test file has to remember to opt
+    in; a test whose assertions depend on the exact redirected path (e.g.
+    to check the directory is never created for a control-flow exit) can
+    still set its own ``monkeypatch.setattr("fli.cli.errors._LOG_DIR", ...)``
+    — defined closer to the test, it runs after this one and wins.
+    """
+    monkeypatch.setattr("fli.cli.errors._LOG_DIR", tmp_path / "fli-logs")
+
+
 def pytest_addoption(parser) -> None:
     """Add options to pytest."""
     parser.addoption("--fuzz", action="store_true", help="Run fuzz tests")
```

---

### Incident Patch 4: `25dec290` (2026-09-20)
**Commit Message**: fix: carry the search's passenger mix into per-flight booking links (#252)

* fix(search): thread the search's passenger mix into tfs booking deep-links

build_tfs_token hardcoded protobuf field 8 to a single adult, so a
booking URL from a family/group search (2 adults + 1 child, etc.)
always opened Google's booking page priced for one adult, even though
the search results themselves were priced for the full party.
encode_tfs_payload already accepted a `passengers` list; it just never
reached the booking-URL builder.

Extract the PassengerInfo -> field-8 codes conversion (previously
inlined in _tfs.build_tfs / tfs.ts::buildTfs) into a shared
passenger_codes()/passengerCodes() helper next to encode_tfs_payload,
so the search token and the booking token cannot drift on how they
encode the mix again. Thread it through build_tfs_token and
SearchFlights.build_flight_booking_url (mirroring how PR #231 threaded
seat_type through the same path), and wire it at all three call sites
that build per-flight booking links: the MCP server's search_flights
and get_booking_options, and the CLI's flights command.

Verified live against Google's booking page (2026-09-20): the decoded
field-8 array on

**File**: `CLAUDE.md` (modified, +7/-4)
```diff
@@ -216,10 +216,13 @@ Search for flights on a specific date.
 **Response:** Each flight in `flights[]` carries its own `booking_url` — a
 `tfs` protobuf deep link that opens the specific itinerary's booking page
 (vendor fares + "Continue" CTA) on Google Flights. The token is deterministic
-(no session id), so the same itinerary always yields the same URL. The
-top-level `booking_url` is a broader search-page link (route + dates
-pre-filled) kept as a reliable fallback. Each flight's `flight_number` can be
-passed to `get_booking_options` for per-vendor pricing.
+(no session id), so the same itinerary always yields the same URL, and it
+carries the search's cabin class and passenger mix (adults, children,
+infants) so the booking page opens priced for the same travelers as the
+search results. The top-level `booking_url` is a broader search-page link
+(route + dates pre-filled) kept as a reliable fallback. Each flight's
+`flight_number` can be passed to `get_booking_options` for per-vendor
+pricing.
 
 ### `search_dates`
 Find cheapest travel dates within a range.
```

**File**: `docs/guides/mcp.md` (modified, +6/-4)
```diff
@@ -138,10 +138,12 @@ Search for flights between two airports on a specific date.
 
 Each flight in `flights[]` carries a `booking_url` that deep-links directly to
 that specific flight's booking page on Google Flights (pre-loaded itinerary, no
-search step required). The top-level `booking_url` is a broader search-page
-link (route + date pre-filled) and is a reliable fallback. To retrieve
-per-vendor prices and airline-direct booking links, pass the flight's
-`flight_number` (e.g. `BA178`) to [`get_booking_options`](#get_booking_options).
+search step required). It carries the search's cabin class and passenger mix
+too, so it opens priced for the same travelers as the search results. The
+top-level `booking_url` is a broader search-page link (route + date
+pre-filled) and is a reliable fallback. To retrieve per-vendor prices and
+airline-direct booking links, pass the flight's `flight_number` (e.g.
+`BA178`) to [`get_booking_options`](#get_booking_options).
 
 ### `search_dates`
 
```

**File**: `fli-js/src/search/flights.ts` (modified, +13/-3)
```diff
@@ -11,7 +11,7 @@
  */
 
 import type { GoogleFlightsUrlOptions } from "../core/links.ts";
-import type { BookingOption, FlightResult } from "../models/google-flights/base.ts";
+import type { BookingOption, FlightResult, PassengerInfo } from "../models/google-flights/base.ts";
 import { SeatType, SortBy, TripType } from "../models/google-flights/base.ts";
 import type { FlightSearchFilters } from "../models/google-flights/flights.ts";
 import { type Client, getClient } from "./client.ts";
@@ -20,7 +20,7 @@ import { parallelMap, throwIfAborted } from "./concurrency.ts";
 import { parseBookingChunk, parseFlightRow } from "./decoders.ts";
 import { SearchParseError } from "./exceptions.ts";
 import { getSearchLogger } from "./logging.ts";
-import { buildBookingToken, buildTfsToken, type LegSpec } from "./proto.ts";
+import { buildBookingToken, buildTfsToken, type LegSpec, passengerCodes } from "./proto.ts";
 import {
   applyClientSideFilters,
   buildTfs,
@@ -91,6 +91,12 @@ export interface BookingOptions {
 export interface BookingUrlOptions extends GoogleFlightsUrlOptions {
   /** Cabin class encoded into the `tfs` token (field 9). Defaults to economy. */
   seatType?: SeatType;
+  /**
+   * Passenger mix encoded into the `tfs` token (field 8, one entry per
+   * traveller). Defaults to a single adult, matching this method's output
+   * before this option existed.
+   */
+  passengerInfo?: Partial<PassengerInfo>;
 }
 
 export class SearchFlights {
@@ -409,7 +415,11 @@ export class SearchFlights {
           flightNumber: leg.flight_number,
         })),
       );
-      const tfs = buildTfsToken(segments, { isOneWay, seat: options.seatType ?? SeatType.ECONOMY });
+      const tfs = buildTfsToken(segments, {
+        isOneWay,
+        passengers: passengerCodes(options.passengerInfo),
+        seat: options.seatType ?? SeatType.ECONOMY,
+      });
       url = `https://www.google.com/travel/flights/booking?tfs=${tfs}`;
     } catch {
       url = "https://www.google.com/travel/flights";
```

**File**: `fli-js/src/search/proto.ts` (modified, +87/-1)
```diff
@@ -6,6 +6,7 @@
  */
 
 import { Buffer } from "node:buffer";
+import type { PassengerInfo } from "../models/google-flights/base.ts";
 
 function concatBytes(...parts: Uint8Array[]): Uint8Array {
   let total = 0;
@@ -347,6 +348,13 @@ export interface LegSpec {
 export interface BuildTfsTokenOptions {
   /** `true` for one-way (incl. multi-city); `false` for round-trip. */
   isOneWay?: boolean;
+  /**
+   * Passenger kind codes, one entry per traveller (field 8). Build these
+   * from a search's `PassengerInfo` with {@link passengerCodes}. Defaults
+   * to a single adult so existing callers keep producing the captured
+   * tokens.
+   */
+  passengers?: readonly number[];
   /**
    * Cabin class encoded in field 9.
    * `1` = economy, `2` = premium economy, `3` = business, `4` = first.
@@ -376,6 +384,83 @@ export interface BuildTfsTokenOptions {
 
 const MAX_U64 = (1n << 64n) - 1n;
 
+/**
+ * Passenger kinds, in the order Google's repeated field 8 numbers them:
+ * 1 = adult, 2 = child, 3 = infant on lap, 4 = infant in own seat.
+ *
+ * The two infant codes are easy to transpose and the mistake is expensive
+ * rather than loud: on an international route a lap infant prices at ~10%
+ * of the adult fare and an infant in its own seat at ~100%, so a swap
+ * quotes a plausible but wrong fare instead of erroring. The legacy RPC
+ * struct orders the same four counts
+ * `[adults, children, infants_on_lap, infants_in_seat]`.
+ */
+const PASSENGER_FIELDS: ReadonlyArray<readonly [keyof PassengerInfo, number]> = [
+  ["adults", 1],
+  ["children", 2],
+  ["infants_on_lap", 3],
+  ["infants_in_seat", 4],
+];
+
+/**
+ * Google's own per-booking limit. The Python port's `PassengerInfo` enforces
+ * this in `validate_passenger_counts`
+ * (`fli/models/google_flights/base.py`) — `PassengerInfoSchema` here has no
+ * equivalent cross-field check, so this is the one place on the TypeScript
+ * side that rejects an over-the-limit mix. Keep this in sync with the
+ * Python validator if Google's limit ever changes.
+ */
+const MAX_TOTAL_PASSENGERS = 9;
+
+/**
+ * Convert a `PassengerInfo` into `tfs` field-8 codes, one per traveller.
+ *
+ * Shared by {@link buildTfs} in `tfs.ts` (the search token) and
+ * {@link buildTfsToken} (the per-flight booking token) so the two cannot
+ * drift on how they encode the passenger mix.
+ *
+ * @param passengerInfo A `PassengerInfo`, or any duck-typed object exposing
+ *   some subset of `adults`/`children`/`infants_on_lap`/`infants_in_seat`
+ *   (missing ones count as zero). `null`/`undefined` is treated as an
+ *   all-zero mix.
+ * @returns One code per traveller, in field order. Falls back to `[1]` (a
+ *   single adult) when the mix would otherwise be empty.
+ * @throws {RangeError} Any count is not a non-negative integer, or the
+ *   total exceeds {@link MAX_TOTAL_PASSENGERS}. Checked before building the
+ *   result array, so a wildly out-of-range count (a duck-typed
+ *   `adults: 1_000_000`, say) fails immediately instead of allocating an
+ *   array that size — callers that pass a validated `PassengerInfo` never
+ *   hit this; it exists for the duck-typed callers this function otherwise
+ *   tolerates.
+ */
+export function passengerCodes(passengerInfo: Partial<PassengerInfo> | null | undefined): number[] {
+  let total = 0;
+  const counts: Array<readonly [number, number]> = []; // [code, count]
+  for (const [field, code] of PASSENGER_FIELDS) {
+    const count = (passengerInfo as Partial<PassengerInfo> | null)?.[field] ?? 0;
+    if (!Number.isInteger(count) || count < 0) {
+      throw new RangeError(
+        `passengerInfo.${field} must be a non-negative integer, got ${JSON.stringify(count)}`,
+      );
+    }
+    total += count;
+    counts.push([code, count]);
+  }
+
+  if (total > MAX_TOTAL_PASSENGERS) {
+    throw new RangeError(
+      `passengerInfo totals ${total} travellers, over the ` +
+        `${MAX_TOTAL_PASSENGERS}-traveller limit Google's booking page enforces`,
+    );
+  }
+
+  const codes: number[] = [];
+  for (const [code, count] of counts) {
+    for (let i = 0; i < count; i++) codes.push(code);
+  }
+  return codes.length > 0 ? codes : [1];
+}
+
 /** Optional per-segment restrictions Google reads out of the `tfs` segment. */
 export interface EncodeTfsSegmentOptions {
   /**
@@ -522,6 +607,7 @@ export function encodeTfsPayload(segments: Uint8Array, options: EncodeTfsPayload
  */
 export function buildTfsToken(segments: LegSpec[][], options: BuildTfsTokenOptions = {}): string {
   const isOneWay = options.isOneWay ?? true;
+  const passengers = options.passengers ?? [1];
   const seat = options.seat ?? 1;
   if (segments.length === 0) throw new Error("segments must be non-empty");
   for (let i = 0; i < segments.length; i++) {
@@ -539,5 +625,5 @@ export function buildTfsToken(segments: LegSpec[][], options: BuildTfsTokenOptio
     );
   }
 
-  return encodeTfsPayload(segmentProtos, { isOneWay, seat, pinMaxU64: true });
+  return encodeTfsPay
```

**File**: `fli-js/src/search/tfs.ts` (modified, +3/-27)
```diff
@@ -43,7 +43,7 @@ import type { Client } from "./client.ts";
 import { sleep, throwIfAborted } from "./concurrency.ts";
 import { SearchUnsupportedError } from "./exceptions.ts";
 import { getSearchLogger } from "./logging.ts";
-import { encodeTfsPayload, encodeTfsSegment, type LegSpec } from "./proto.ts";
+import { encodeTfsPayload, encodeTfsSegment, type LegSpec, passengerCodes } from "./proto.ts";
 
 /** Filter objects this transport can encode — both carry the same core fields. */
 export type TfsFilters = FlightSearchFilters | DateSearchFilters;
@@ -89,26 +89,6 @@ const DS_BLOB = /AF_initDataCallback\((\{[\s\S]*?\})\);/g;
 const DS_KEY = /key:\s*'([^']+)'/;
 const DS_DATA = /data:([\s\S]*?), sideChannel/;
 
-/**
- * Passenger kinds, in the order Google's repeated field 8 numbers them:
- * 1 = adult, 2 = child, 3 = infant on lap, 4 = infant in own seat.
- *
- * The two infant codes are easy to transpose and the mistake is expensive
- * rather than loud: on an international route a lap infant prices at ~10%
- * of the adult fare and an infant in its own seat at ~100%, so a swap
- * quotes a plausible but wrong fare instead of erroring. Pricing one fixed
- * itinerary (BA178 JFK->LHR, economy) confirms the mapping — $295 for
- * `[1]`, $324 for `[1, 3]` (+10%, lap), $589 for `[1, 4]` (+100%, own
- * seat, same as the `[1, 2]` child fare). The legacy RPC struct orders the
- * same four counts `[adults, children, infants_on_lap, infants_in_seat]`.
- */
-const PASSENGER_FIELDS = [
-  ["adults", 1],
-  ["children", 2],
-  ["infants_on_lap", 3],
-  ["infants_in_seat", 4],
-] as const;
-
 /**
  * Filters with no `tfs` encoding and no reliable post-hoc equivalent —
  * the decoded rows don't carry the data needed to apply them locally.
@@ -182,11 +162,7 @@ export function buildTfs(filters: TfsFilters, options: BuildTfsOptions = {}): st
 
   const travelDates = options.travelDates ?? null;
   const stops = filters.stops;
-  const passengers: number[] = [];
-  for (const [field, code] of PASSENGER_FIELDS) {
-    const count = filters.passenger_info[field] ?? 0;
-    for (let i = 0; i < count; i++) passengers.push(code);
-  }
+  const passengers = passengerCodes(filters.passenger_info);
 
   // Google reads alliances out of the same carrier lists as airline codes.
   const carriers = (filters.alliances ?? []).map((a) => String(a));
@@ -231,7 +207,7 @@ export function buildTfs(filters: TfsFilters, options: BuildTfsOptions = {}): st
 
   return encodeTfsPayload(segments, {
     isOneWay: filters.trip_type === TripType.ONE_WAY,
-    passengers: passengers.length > 0 ? passengers : [1],
+    passengers,
     seat: filters.seat_type,
   });
 }
```

**File**: `fli-js/tests/search/flights_booking_url.test.ts` (modified, +65/-0)
```diff
@@ -12,9 +12,11 @@ import { Airport } from "../../src/models/airport.ts";
 import {
   type FlightLeg,
   type FlightResult,
+  type PassengerInfo,
   SeatType,
 } from "../../src/models/google-flights/base.ts";
 import { SearchFlights } from "../../src/search/flights.ts";
+import { _readVarint } from "../../src/search/proto.ts";
 
 /** Build a leg with a LOCAL departure datetime (matches the decoder). */
 function makeLeg(
@@ -213,4 +215,67 @@ describe("buildFlightBookingUrl", () => {
     const raw = tfsBytes(business);
     expect(Buffer.from(raw).includes(Buffer.from([0x48, 0x03]))).toBe(true);
   });
+
+  /** Walk the top-level message and collect every field-8 (passenger) code. */
+  function field8Codes(raw: Uint8Array): number[] {
+    const codes: number[] = [];
+    let offset = 0;
+    while (offset < raw.length) {
+      const [tagVal, afterTag] = _readVarint(raw, offset);
+      offset = afterTag;
+      const field = tagVal >> 3;
+      const wire = tagVal & 0x7;
+      if (wire === 0) {
+        const [value, afterVal] = _readVarint(raw, offset);
+        offset = afterVal;
+        if (field === 8) codes.push(value);
+      } else if (wire === 2) {
+        const [length, afterLen] = _readVarint(raw, offset);
+        offset = afterLen + length;
+      } else {
+        throw new Error(`unexpected wire type ${wire} at offset ${offset}`);
+      }
+    }
+    return codes;
+  }
+
+  test("passengerInfo defaults to a single adult (field 8 = [1])", () => {
+    const raw = tfsBytes(search.buildFlightBookingUrl(oneWay()));
+    expect(field8Codes(raw)).toEqual([1]);
+  });
+
+  test("passengerInfo family mix encodes one field-8 entry per traveller", () => {
+    const passengerInfo: PassengerInfo = {
+      adults: 2,
+      children: 1,
+      infants_in_seat: 0,
+      infants_on_lap: 0,
+    };
+    const raw = tfsBytes(search.buildFlightBookingUrl(oneWay(), { passengerInfo }));
+    expect(field8Codes(raw)).toEqual([1, 1, 2]);
+  });
+
+  test("garbage passengerInfo still returns a URL (never throws)", () => {
+    const url = search.buildFlightBookingUrl(oneWay(), {
+      passengerInfo: "not-a-passenger-info" as unknown as PassengerInfo,
+    });
+    expect(typeof url).toBe("string");
+    expect(url.startsWith("https://www.google.com/travel/flights/booking?tfs=")).toBe(true);
+  });
+
+  test("a duck-typed count in the millions falls back quickly, not after building a giant token", () => {
+    // passengerCodes rejects a count this large before building any array,
+    // so the existing catch-all below still returns the generic fallback
+    // URL — quickly, not after tens of seconds spent building a
+    // multi-megabyte token.
+    const start = performance.now();
+    const url = search.buildFlightBookingUrl(oneWay(), {
+      passengerInfo: { adults: 1_000_000 } as PassengerInfo,
+    });
+    const elapsed = performance.now() - start;
+
+    expect(elapsed).toBeLessThan(1000);
+    expect(url.length).toBeLessThan(200);
+    expect(url.startsWith("https://www.google.com/travel/flights")).toBe(true);
+  });
 });
```

**File**: `fli-js/tests/search/proto.test.ts` (modified, +137/-0)
```diff
@@ -7,6 +7,7 @@
 
 import { describe, expect, test } from "bun:test";
 import { Buffer } from "node:buffer";
+import type { PassengerInfo } from "../../src/models/google-flights/base.ts";
 import {
   _readVarint,
   buildBookingToken,
@@ -15,6 +16,7 @@ import {
   extractBookingTokenFromTfu,
   extractSessionIdFromTfu,
   type LegSpec,
+  passengerCodes,
 } from "../../src/search/proto.ts";
 
 // Captured live 2026-05-14 (JFK → LAX outbound AA171, return AA28, RT $346.80).
@@ -375,4 +377,139 @@ describe("buildTfsToken", () => {
     expect(Buffer.from(business).includes(Buffer.from([0x48, 0x03]))).toBe(true);
     expect(Buffer.from(economy).equals(Buffer.from(business))).toBe(false);
   });
+
+  /** Walk the top-level message and collect every field-8 (passenger) code. */
+  function field8Codes(raw: Uint8Array): number[] {
+    const codes: number[] = [];
+    let offset = 0;
+    while (offset < raw.length) {
+      const [tagVal, afterTag] = _readVarint(raw, offset);
+      offset = afterTag;
+      const field = tagVal >> 3;
+      const wire = tagVal & 0x7;
+      if (wire === 0) {
+        const [value, afterVal] = _readVarint(raw, offset);
+        offset = afterVal;
+        if (field === 8) codes.push(value);
+      } else if (wire === 2) {
+        const [length, afterLen] = _readVarint(raw, offset);
+        offset = afterLen + length;
+      } else {
+        throw new Error(`unexpected wire type ${wire} at offset ${offset}`);
+      }
+    }
+    return codes;
+  }
+
+  test("passengers defaults to a single adult", () => {
+    const built = buildTfsToken([
+      [{ origin: "SFO", depDate: "2026-09-01", dest: "PHX", airline: "AA", flightNumber: "100" }],
+    ]);
+    expect(field8Codes(tfsBytes(built))).toEqual([1]);
+  });
+
+  test("passengers=[1,1,2] (2 adults, 1 child) encodes one entry per traveller", () => {
+    const built = buildTfsToken(
+      [[{ origin: "SFO", depDate: "2026-09-01", dest: "PHX", airline: "AA", flightNumber: "100" }]],
+      { passengers: [1, 1, 2] },
+    );
+    expect(field8Codes(tfsBytes(built))).toEqual([1, 1, 2]);
+  });
+
+  test("passengers do not disturb the seat or trip-type fields", () => {
+    const segs: LegSpec[][] = [
+      [{ origin: "SFO", depDate: "2026-09-01", dest: "PHX", airline: "AA", flightNumber: "100" }],
+    ];
+    const built = buildTfsToken(segs, { passengers: [1, 1, 2], seat: 3 });
+    const raw = tfsBytes(built);
+    const text = Buffer.from(raw);
+    // Three f8 entries, then f9=3 (business), then f14=1 — same layout as
+    // the single-passenger case, just with more f8 entries ahead of f9.
+    expect(
+      text.includes(Buffer.from([0x40, 0x01, 0x40, 0x01, 0x40, 0x02, 0x48, 0x03, 0x70, 0x01])),
+    ).toBe(true);
+    // f19 (trip type) is unaffected by the passenger count.
+    expect(Array.from(raw.slice(-3))).toEqual([0x98, 0x01, 0x02]);
+  });
+});
+
+describe("passengerCodes", () => {
+  // Maps a PassengerInfo to `tfs` field-8 codes — extracted out of
+  // `tfs.ts::buildTfs` so the search token and the booking token
+  // (buildTfsToken) cannot drift on how they encode the passenger mix.
+
+  test("family mix", () => {
+    expect(passengerCodes({ adults: 2, children: 1, infants_on_lap: 1 })).toEqual([1, 1, 2, 3]);
+  });
+
+  test("infant in seat is code 4", () => {
+    expect(passengerCodes({ adults: 1, infants_in_seat: 1 })).toEqual([1, 4]);
+  });
+
+  test("null/undefined defaults to a single adult", () => {
+    expect(passengerCodes(null)).toEqual([1]);
+    expect(passengerCodes(undefined)).toEqual([1]);
+  });
+
+  test("object with no passenger fields defaults to a single adult", () => {
+    expect(passengerCodes({})).toEqual([1]);
+  });
+
+  test("exactly nine travellers is accepted", () => {
+    const info = { adults: 4, children: 2, infants_in_seat: 2, infants_on_lap: 1 };
+    expect(passengerCodes(info)).toHaveLength(9);
+  });
+
+  test("ten travellers, one over the ceiling, throws", () => {
+    expect(() => passengerCodes({ adults: 10, children: 0 })).toThrow(RangeError);
+  });
+
+  test("ten travellers spread across two fields throws", () => {
+    expect(() => passengerCodes({ adults: 5, children: 5 })).toThrow(RangeError);
+  });
+
+  test("a negative count throws, naming the field", () => {
+    expect(() => passengerCodes({ adults: -1 })).toThrow(/adults/);
+  });
+
+  test.each([2.5, "3", true])("a non-integer count (%p) throws", (bad) => {
+    expect(() => passengerCodes({ adults: bad as unknown as number })).toThrow(RangeError);
+  });
+
+  test("a duck-typed count in the millions throws immediately, not after building a list", () => {
+    // Before this guard, an `adults: 1_000_000`-shaped object made this
+    // function (and everything downstream, including the booking token)
+    // spend tens of seconds building a multi-megabyte array instead of
+    // rejecting the obviously-impossible count up front.
+    const start = performance.now();
+    expect(() => passengerCodes
```

**File**: `fli-js/tests/search/tfs.test.ts` (modified, +22/-0)
```diff
@@ -30,6 +30,7 @@ import { FlightSearchFilters } from "../../src/models/google-flights/flights.ts"
 import { Client } from "../../src/search/client.ts";
 import { SearchUnsupportedError } from "../../src/search/exceptions.ts";
 import { setSearchLogger } from "../../src/search/logging.ts";
+import { buildTfsToken, passengerCodes as passengerCodesFromInfo } from "../../src/search/proto.ts";
 import {
   _setPageRetrySleep,
   applyClientSideFilters,
@@ -642,6 +643,27 @@ describe("passenger wire codes", () => {
   });
 });
 
+describe("passenger codes parity with buildTfsToken", () => {
+  // Drift guard: buildTfs (search token) and buildTfsToken (booking-URL
+  // token) must encode the identical field-8 sequence for the same
+  // PassengerInfo — both are built from proto.ts's passengerCodes helper.
+  test("family mix matches between the search token and the booking token", () => {
+    const info = pax({ adults: 2, children: 1, infants_on_lap: 1 });
+    const spec = filters([[["JFK"], ["LAX"], OUT]], { passenger_info: info });
+    const searchCodes = passengerCodes(buildTfs(spec));
+
+    const bookingToken = buildTfsToken(
+      [[{ origin: "JFK", depDate: OUT, dest: "LAX", airline: "AA", flightNumber: "171" }]],
+      { passengers: passengerCodesFromInfo(info) },
+    );
+    const bookingCodes = passengerCodes(bookingToken);
+
+    expect(searchCodes).toEqual([1, 1, 2, 3]);
+    expect(bookingCodes).toEqual([1, 1, 2, 3]);
+    expect(searchCodes).toEqual(bookingCodes);
+  });
+});
+
 describe("pageUrl", () => {
   test("includes locale and currency", () => {
     const url = pageUrl("TFS", "EUR", "de", "DE");
```

---

### Incident Patch 5: `74fa5506` (2026-09-20)
**Commit Message**: fix(search): a date sweep that mostly failed to load raises instead of reporting no dates (#249)

* fix(search): raise on a date sweep that mostly failed to load

_collect only raised when every attempted date failed or the circuit
breaker tripped. Neither condition catches a sweep like "1 loaded empty,
29 timeouts": the breaker disarms for good the instant any page loads,
even an empty one, so it never trips — and the sweep returns None, which
the CLI/MCP report as "no flights found" on the strength of one date out
of thirty.

Raise instead when nothing priced and at least half the attempted dates
never loaded (failed >= loaded). The error class follows the existing
rule (SearchParseError only when every failure is the no-payload one),
but the branch never adds the FLI_SOCS_COOKIE hint: a page did load,
which rules out a consent wall.

Also: a sweep with a minority of load failures no longer ends quietly
either way — it logs exactly one summary warning, whether it returns
partial results or an empty range, so a caller can tell a complete sweep
from a merely lucky one.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

* fix(js): mirror the mostly-failed date sweep raise in Type

**File**: `CLAUDE.md` (modified, +7/-0)
```diff
@@ -157,6 +157,13 @@ Consequences to keep in mind when changing search code:
   the bound scales with `configure_concurrency`.
   When it trips but prices still come back, `_collect` emits exactly one
   warning naming the skipped count: a truncated answer must never be silent.
+- The breaker alone can't catch "1 loaded, 29 timeouts" — one loaded page,
+  even empty, disarms it for good. So `_collect` also raises when 0 priced
+  and at least half the attempted dates never loaded (`failed >= loaded`),
+  without the `FLI_SOCS_COOKIE` hint (a page did load, so it isn't a consent
+  wall). A minority of load failures with 0 results still returns `None`;
+  a minority alongside partial results still returns those results; both
+  log exactly one summary warning naming the counts.
 - ~1 page in 60 arrives HTTP 200 with no `ds:1` blob. `fetch_payload` in
   `fli/search/_tfs.py` is the single fetch path for both flights and dates and
   retries exactly that case (`PAGE_FETCH_ATTEMPTS`, `PAGE_RETRY_BACKOFF`);
```

**File**: `README.md` (modified, +7/-1)
```diff
@@ -197,7 +197,13 @@ What that means in practice:
   own retries multiply in) and about 4 seconds, the same whether the range is 30
   days or 93. Unbroken, a 93-date range would have cost 279 fetches and up to
   837 requests. The bound is `(5 + worker count) x 3`, so raising
-  `configure_concurrency` raises it proportionally.
+  `configure_concurrency` raises it proportionally. That breaker disarms for
+  good the moment any page loads, even an empty one, so it cannot catch a
+  sweep that is mostly timeouts around one lucky date — `SearchDates.search`
+  raises that case too, whenever nothing priced and at least half the
+  attempted dates never loaded. A minority of failures alongside real
+  results, or alongside a confirmed-empty range (`None`), still returns
+  normally but logs one warning naming the counts.
 * **A page occasionally arrives without results.** Roughly one request in sixty
   returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
   (0.5s then 1.5s) before raising `SearchParseError`. A healthy search never
```

**File**: `docs/typescript/quickstart.md` (modified, +6/-1)
```diff
@@ -239,7 +239,12 @@ What that means in practice:
   all of them. Ten dates are in flight at once, so around fourteen are
   attempted first — about 42 page fetches, whether the range is 30, 61 or
   93 days. One that was cut short but found prices returns them with a
-  warning.
+  warning. That breaker disarms for good the moment any page loads, even
+  an empty one, so it cannot catch a sweep that is mostly timeouts around
+  one lucky date — `search` throws that case too, whenever nothing priced
+  and at least half the attempted dates never loaded. A minority of
+  failures alongside real results, or alongside a confirmed-empty range,
+  still returns normally but logs one warning naming the counts.
 * **A page occasionally arrives without results.** Roughly one request in
   sixty returns HTTP 200 with no `ds:1` blob; the client retries that case
   up to twice (0.5s then 1.5s) before throwing `SearchParseError`.
```

**File**: `fli-js/README.md` (modified, +8/-1)
```diff
@@ -135,7 +135,14 @@ What that means in practice:
   is 30, 61 or 93 days). Only pages served without results count towards that:
   a timeout or a dropped connection says nothing about the dates not yet tried,
   so those never abandon a sweep. A sweep cut short that still found prices
-  returns them with one warning saying so.
+  returns them with one warning saying so. The breaker itself disarms for
+  good the moment any page loads, even an empty one — so it cannot catch a
+  sweep that is mostly timeouts around one lucky date. `SearchDates.search`
+  throws that case too: if nothing priced and at least half the attempted
+  dates never loaded, that is not enough evidence to call the range
+  flight-free. A minority of failures alongside real results, or alongside
+  a confirmed-empty range, still returns normally but logs one warning
+  naming the counts.
 - **A page occasionally arrives without results.** Roughly one request in sixty
   returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
   (0.5s then 1.5s) before throwing `SearchParseError`. A healthy search never
```

**File**: `fli-js/src/search/dates.ts` (modified, +85/-8)
```diff
@@ -35,8 +35,12 @@ const DAY_MS = 24 * 60 * 60 * 1000;
 /**
  * Same wording the flight path uses for the same condition, so a caller
  * who sees it on either path gets the same hint about what to check.
+ *
+ * Exported (mirroring the Python module's `_NO_PAYLOAD`, importable despite
+ * the underscore) so tests can build `DateOutcome`s that exercise the
+ * no-payload branch of {@link SearchDates._collect} exactly.
  */
-const NO_PAYLOAD =
+export const NO_PAYLOAD =
   "the search page carried no ds:1 payload — Google may have changed the " +
   "page shape, or served a consent/blocked page instead";
 
@@ -214,6 +218,23 @@ function flightsIn(payload: unknown): FlightResult[] {
   return flights;
 }
 
+/**
+ * Up to 3 distinct failure messages, in the order they were first seen.
+ *
+ * Shared by every `_collect` branch that raises or warns about failed
+ * dates, so the same range always gets the same short list however it is
+ * reported.
+ */
+function reasonsFor(failed: DateOutcome[]): string[] {
+  const reasons: string[] = [];
+  for (const o of failed) {
+    if (o.failure != null && !reasons.includes(o.failure) && reasons.length < 3) {
+      reasons.push(o.failure);
+    }
+  }
+  return reasons;
+}
+
 export class SearchDates {
   /**
    * @deprecated Kept only so the exported surface does not move. The
@@ -252,7 +273,9 @@ export class SearchDates {
    *   {@link MAX_DATES_PER_SEARCH} dates.
    * @throws {SearchParseError} Every date came back without a payload —
    *   a consent or block page, not an empty route.
-   * @throws {SearchClientError} Every date failed for some other reason.
+   * @throws {SearchClientError} Every date failed for some other reason,
+   *   or nothing priced because at least half the attempted dates never
+   *   loaded — see {@link SearchDates._collect}.
    */
   async search(
     filters: DateSearchFilters,
@@ -329,6 +352,20 @@ export class SearchDates {
    * either. With prices to show, the answer is real but incomplete, so it
    * comes with one warning naming the count.
    *
+   * The breaker is not the only way a sweep can go quietly wrong, though:
+   * it disarms for good the instant any page loads, empty or not, so "1
+   * loaded, 29 timeouts" sails straight past it — one date out of thirty
+   * is not enough evidence that a route has no flights. When nothing
+   * priced and at least half the attempted dates never loaded (`failed
+   * >= loaded`), that is raised too. A page did load in that case, which
+   * rules out an EU/EEA consent wall — those block every request alike —
+   * so this path never adds the `FLI_SOCS_COOKIE` hint the branch above
+   * does.
+   *
+   * Short of either throw, a sweep that lost some dates but not enough to
+   * doubt the rest still owes the caller exactly one line saying so,
+   * whether or not it ends up with anything to return.
+   *
    * Internal — underscore-prefixed rather than `private` so tests can
    * drive it with a fixed set of outcomes instead of racing the sweep's
    * concurrent fetches into the state they want to assert.
@@ -342,19 +379,19 @@ export class SearchDates {
     const results = outcomes.flatMap((o) => (o.price != null ? [o.price] : []));
     const attempted = outcomes.filter((o) => o.attempted);
     const failed = attempted.filter((o) => o.failure != null);
+    // "loaded" counts every attempted date whose page actually arrived,
+    // priced or not — it does not distinguish the two, because when
+    // `results` is empty (the only time this number matters below) every
+    // loaded date is by definition one with no flights.
+    const loaded = attempted.length - failed.length;
     // The breaker only ever trips on payload-less pages, so a non-zero
     // skip count *is* the blocked-page diagnosis, whatever else failed
     // alongside.
     const tripped = skipped > 0;
     const everythingFailed = attempted.length > 0 && failed.length === attempted.length;
 
     if (results.length === 0 && (everythingFailed || tripped)) {
-      const reasons: string[] = [];
-      for (const o of failed) {
-        if (o.failure != null && !reasons.includes(o.failure) && reasons.length < 3) {
-          reasons.push(o.failure);
-        }
-      }
+      const reasons = reasonsFor(failed);
       const cause = failed.find((o) => o.error != null)?.error;
       const blocked =
         tripped || (failed.length > 0 && failed.every((o) => o.failure === NO_PAYLOAD));
@@ -388,6 +425,27 @@ export class SearchDates {
       throw new ErrorType(message, cause != null ? { cause } : undefined);
     }
 
+    if (results.length === 0 && failed.length > 0 && failed.length >= loaded) {
+      // The breaker never saw this coming: one loaded page (even an empty
+      // one) disarms it for good, so a sweep that is mostly timeouts
+      // around a single lucky date never trips it. Half the attempted
+      // dates never loading is its own signal that "no flights" cannot be
+      // concluded 
```

**File**: `fli-js/tests/integration/search_dates_stubbed.test.ts` (modified, +157/-0)
```diff
@@ -18,6 +18,7 @@ import { Client } from "../../src/search/client.ts";
 import {
   type DateOutcome,
   MAX_DATES_PER_SEARCH,
+  NO_PAYLOAD,
   SearchDates,
   SWEEP_FAILURE_THRESHOLD,
 } from "../../src/search/dates.ts";
@@ -88,6 +89,16 @@ function priced(price: number): DateOutcome {
   };
 }
 
+/** A `DateOutcome` whose page loaded with no flights, for driving `_collect` directly. */
+function loadedEmpty(): DateOutcome {
+  return { price: null, failure: null, error: null, attempted: true };
+}
+
+/** A `DateOutcome` for a date whose page never arrived, for driving `_collect` directly. */
+function failed(failure = "SearchConnectionError: connection refused"): DateOutcome {
+  return { price: null, failure, error: new Error(failure), attempted: true };
+}
+
 function oneWayFilters(fromAhead: number, toAhead: number): DateSearchFilters {
   const fromD = futureDate(fromAhead);
   return new DateSearchFilters({
@@ -451,3 +462,149 @@ describe("SearchDates failure reporting", () => {
     expect(warnings.filter((w) => w.includes("bags"))).toHaveLength(1);
   });
 });
+
+describe("SearchDates mostly-failed sweeps (T20)", () => {
+  // The breaker cannot catch "1 loaded, 29 timeouts": it disarms for good
+  // the moment any page loads, empty or not. If nothing priced and at least
+  // half the attempted dates never made it to a page, that is raised too —
+  // mirrors fli/search/dates.py's TestMostlyFailedSweepIsLoud.
+
+  test("mostly timeouts around one loaded empty date raises SearchClientError", () => {
+    const outcomes = [loadedEmpty(), ...Array.from({ length: 29 }, () => failed())];
+    let thrown: unknown;
+    try {
+      SearchDates._collect(outcomes, 30, 0);
+    } catch (err) {
+      thrown = err;
+    }
+    expect(thrown).toBeInstanceOf(SearchClientError);
+    expect(thrown).not.toBeInstanceOf(SearchParseError);
+    const message = (thrown as Error).message;
+    expect(message).toContain("Priced 0 of 30");
+    expect(message).toContain("29 of the 30");
+    expect(message).not.toContain("FLI_SOCS_COOKIE");
+    expect((thrown as Error).cause).toBeInstanceOf(Error);
+  });
+
+  test("mostly no-payload failures raise SearchParseError without the SOCS hint", () => {
+    const outcomes = [loadedEmpty(), ...Array.from({ length: 3 }, () => failed(NO_PAYLOAD))];
+    let thrown: unknown;
+    try {
+      SearchDates._collect(outcomes, 4, 0);
+    } catch (err) {
+      thrown = err;
+    }
+    expect(thrown).toBeInstanceOf(SearchParseError);
+    expect((thrown as Error).message).not.toContain("FLI_SOCS_COOKIE");
+  });
+
+  test("a tie between loaded and failed dates raises", () => {
+    const outcomes = [loadedEmpty(), failed()];
+    expect(() => SearchDates._collect(outcomes, 2, 0)).toThrow(SearchClientError);
+  });
+
+  test("a minority of failures with no results returns null and warns exactly once", () => {
+    const warnings: string[] = [];
+    setSearchLogger({ warn: (m) => warnings.push(m), debug: () => {} });
+    let results: ReturnType<typeof SearchDates._collect>;
+    try {
+      results = SearchDates._collect([loadedEmpty(), loadedEmpty(), loadedEmpty(), failed()], 4, 0);
+    } finally {
+      setSearchLogger(null);
+    }
+    expect(results).toBeNull();
+    expect(warnings).toHaveLength(1);
+    expect(warnings[0]).toContain("3");
+    expect(warnings[0]).toContain("loaded");
+    expect(warnings[0]).toContain("1 of 4");
+  });
+
+  test("partial results with a minority failure warn exactly once", () => {
+    const warnings: string[] = [];
+    setSearchLogger({ warn: (m) => warnings.push(m), debug: () => {} });
+    let results: ReturnType<typeof SearchDates._collect>;
+    try {
+      results = SearchDates._collect([priced(100), priced(200), failed()], 3, 0);
+    } finally {
+      setSearchLogger(null);
+    }
+    expect(results).toHaveLength(2);
+    expect(warnings).toHaveLength(1);
+    expect(warnings[0]).toContain("2 of 3");
+  });
+
+  test("partial results with a tripped breaker still warn exactly once", () => {
+    const warnings: string[] = [];
+    setSearchLogger({ warn: (m) => warnings.push(m), debug: () => {} });
+    let results: ReturnType<typeof SearchDates._collect>;
+    try {
+      results = SearchDates._collect(
+        [
+          priced(100),
+          ...Array.from({ length: 5 }, () => failed(NO_PAYLOAD)),
+          ...Array.from({ length: 24 }, () => ({
+            price: null,
+            failure: null,
+            error: null,
+            attempted: false,
+          })),
+        ],
+        30,
+        24,
+      );
+    } finally {
+      setSearchLogger(null);
+    }
+    expect(results).toHaveLength(1);
+    expect(warnings).toHaveLength(1);
+  });
+
+  test("all loaded empty returns null with no warnings", () => {
+    const warnings: string[] = [];
+    setSearchLogger({ warn: (m) => warnings.push(m), debug: () => {} });
+    let results: ReturnType<typeof SearchDates._collect>;
+    try {
+      results = Searc
```

**File**: `fli/search/dates.py` (modified, +83/-5)
```diff
@@ -145,6 +145,20 @@ class _DateOutcome(NamedTuple):
     attempted: bool = True
 
 
+def _reasons(failed: list[_DateOutcome]) -> list[str]:
+    """Up to 3 distinct failure messages, in the order they were first seen.
+
+    Shared by every ``_collect`` branch that raises or warns about failed
+    dates, so the same range always gets the same short list however it is
+    reported.
+    """
+    reasons: list[str] = []
+    for outcome in failed:
+        if outcome.failure not in reasons and len(reasons) < 3:
+            reasons.append(outcome.failure)
+    return reasons
+
+
 def _flights_in(payload: Any) -> list[FlightResult]:
     """Decode every flight row in a ``ds:1`` payload.
 
@@ -211,7 +225,9 @@ def search(
         Raises:
             ValueError: The range covers more than :data:`MAX_DATES_PER_SEARCH`
                 dates, which would cost one page fetch each.
-            SearchClientError: Every date in the range failed to load.
+            SearchClientError: Every date in the range failed to load, or
+                nothing priced because at least half the attempted dates
+                never loaded — see :meth:`_collect`.
 
         Notes:
             Every date in the range costs its own search-page fetch — the page
@@ -307,6 +323,20 @@ class (and hint) a single unreadable page raises there. Anything else
         blocked — and the tripped breaker is the evidence for that, not the
         exact mix of what each attempted date happened to do.
 
+        The breaker is not the only way a sweep can go quietly wrong, though:
+        it disarms for good the instant any page loads, empty or not, so "1
+        loaded, 29 timeouts" sails straight past it — one date out of thirty
+        is not enough evidence that a route has no flights. When nothing
+        priced and at least half the attempted dates never loaded (``failed
+        >= loaded``), that is raised too. A page did load in that case, which
+        rules out an EU/EEA consent wall — those block every request alike —
+        so this path never adds the ``FLI_SOCS_COOKIE`` hint the branch above
+        does.
+
+        Short of either raise, a sweep that lost some dates but not enough to
+        doubt the rest still owes the caller exactly one line saying so,
+        whether or not it ends up with anything to return.
+
         Args:
             outcomes: One entry per date in the range, in date order.
             total: Dates the sweep set out to price, so the error can say how
@@ -318,16 +348,18 @@ class (and hint) a single unreadable page raises there. Anything else
         results = [o.price for o in outcomes if o.price is not None]
         attempted = [o for o in outcomes if o.attempted]
         failed = [o for o in attempted if o.failure]
+        # "loaded" counts every attempted date whose page actually arrived,
+        # priced or not — it does not distinguish the two, because when
+        # ``results`` is empty (the only time this number matters below)
+        # every loaded date is by definition one with no flights.
+        loaded = len(attempted) - len(failed)
         # The breaker only ever trips on payload-less pages, so a non-zero skip
         # count *is* the blocked-page diagnosis, whatever else failed alongside.
         tripped = skipped > 0
         everything_failed = bool(attempted) and len(failed) == len(attempted)
 
         if not results and (everything_failed or tripped):
-            reasons: list[str] = []
-            for outcome in failed:
-                if outcome.failure not in reasons and len(reasons) < 3:
-                    reasons.append(outcome.failure)
+            reasons = _reasons(failed)
             cause = next((o.error for o in failed if o.error is not None), None)
             blocked = tripped or (bool(failed) and all(o.failure == _NO_PAYLOAD for o in failed))
             error_type = SearchParseError if blocked else SearchClientError
@@ -359,6 +391,27 @@ class (and hint) a single unreadable page raises there. Anything else
                 )
             raise error_type(message) from cause
 
+        if not results and failed and len(failed) >= loaded:
+            # The breaker never saw this coming: one loaded page (even an
+            # empty one) disarms it for good, so a sweep that is mostly
+            # timeouts around a single lucky date never trips it. Half the
+            # attempted dates never loading is its own signal that "no
+            # flights" cannot be concluded from the handful that did.
+            reasons = _reasons(failed)
+            cause = next((o.error for o in failed if o.error is not None), None)
+            blocked = bool(failed) and all(o.failure == _NO_PAYLOAD for o in failed)
+            error_type = SearchParseError if blocked else SearchClientError
+            message = (
+                f"Priced 0 of {total} dates — {len(failed)} of the {len(attempted)} dates "
+                f'tried failed to load, so "no 
```

**File**: `tests/search/test_date_sweep.py` (modified, +117/-0)
```diff
@@ -721,3 +721,120 @@ def test_error_says_it_gave_up_early(self, no_backoff):
         with pytest.raises(SearchParseError) as excinfo:
             _search_with(client).search(_filters(days=40))
         assert "of 40 dates" in str(excinfo.value)
+
+
+# ---------------------------------------------------------------------------
+# A sweep that mostly failed to load must not read as "no flights" (T20)
+# ---------------------------------------------------------------------------
+
+
+class TestMostlyFailedSweepIsLoud:
+    """The breaker cannot catch "1 loaded, 29 timeouts" — it disarms for good
+    the moment any page loads, empty or not. If nothing priced and at least
+    half the attempted dates never made it to a page, that is raised too.
+    """  # noqa: D205
+
+    def _timeout(self) -> dates_module._DateOutcome:
+        return dates_module._DateOutcome(
+            failure="SearchConnectionError: connection refused",
+            error=SearchConnectionError("connection refused"),
+        )
+
+    def test_mostly_timeouts_around_one_loaded_empty_date_raises(self):
+        outcomes = [dates_module._DateOutcome(), *[self._timeout() for _ in range(29)]]
+        with pytest.raises(SearchClientError) as excinfo:
+            dates_module.SearchDates._collect(outcomes, 30, skipped=0)
+        assert not isinstance(excinfo.value, SearchParseError)
+        message = str(excinfo.value)
+        assert "Priced 0 of 30" in message, message
+        assert "29 of the 30" in message, message
+        assert "FLI_SOCS_COOKIE" not in message, message
+        assert isinstance(excinfo.value.__cause__, SearchConnectionError)
+
+    def test_mostly_no_payload_failures_raise_search_parse_error(self):
+        outcomes = [
+            dates_module._DateOutcome(),
+            *[dates_module._DateOutcome(failure=dates_module._NO_PAYLOAD) for _ in range(3)],
+        ]
+        with pytest.raises(SearchParseError) as excinfo:
+            dates_module.SearchDates._collect(outcomes, 4, skipped=0)
+        assert "FLI_SOCS_COOKIE" not in str(excinfo.value)
+
+    def test_tie_between_loaded_and_failed_raises(self):
+        outcomes = [dates_module._DateOutcome(), self._timeout()]
+        with pytest.raises(SearchClientError):
+            dates_module.SearchDates._collect(outcomes, 2, skipped=0)
+
+    def test_minority_failures_with_no_results_return_none_and_warn_once(self, caplog):
+        outcomes = [
+            dates_module._DateOutcome(),
+            dates_module._DateOutcome(),
+            dates_module._DateOutcome(),
+            self._timeout(),
+        ]
+        with caplog.at_level(logging.WARNING, logger="fli.search.dates"):
+            results = dates_module.SearchDates._collect(outcomes, 4, skipped=0)
+        assert results is None
+        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
+        assert len(warnings) == 1, f"expected exactly one warning, got {len(warnings)}"
+        message = warnings[0].getMessage()
+        assert "3" in message and "loaded" in message, message
+        assert "1 of 4" in message, message
+
+    def test_partial_results_with_a_minority_failure_warns_once(self, caplog):
+        priced_a = dates_module.DatePrice(date=(FIRST_DAY,), price=100.0, currency="USD")
+        priced_b = dates_module.DatePrice(
+            date=(FIRST_DAY + timedelta(days=1),), price=200.0, currency="USD"
+        )
+        outcomes = [
+            dates_module._DateOutcome(price=priced_a),
+            dates_module._DateOutcome(price=priced_b),
+            self._timeout(),
+        ]
+        with caplog.at_level(logging.WARNING, logger="fli.search.dates"):
+            results = dates_module.SearchDates._collect(outcomes, 3, skipped=0)
+        assert results == [priced_a, priced_b]
+        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
+        assert len(warnings) == 1, f"expected exactly one warning, got {len(warnings)}"
+        assert "2 of 3" in warnings[0].getMessage(), warnings[0].getMessage()
+
+    def test_partial_results_with_a_tripped_breaker_still_warns_once(self, caplog):
+        priced = dates_module.DatePrice(date=(FIRST_DAY,), price=100.0, currency="USD")
+        outcomes = [
+            dates_module._DateOutcome(price=priced),
+            *[dates_module._DateOutcome(failure=dates_module._NO_PAYLOAD) for _ in range(5)],
+            *[dates_module._DateOutcome(attempted=False) for _ in range(24)],
+        ]
+        with caplog.at_level(logging.WARNING, logger="fli.search.dates"):
+            results = dates_module.SearchDates._collect(outcomes, 30, skipped=24)
+        assert results == [priced]
+        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
+        assert len(warnings) == 1, f"expected exactly one warning, got {len(warnings)}"
+
+    def test_all_loaded_empty_returns_none_with_no_warnings(self, caplog):
+        outcomes = [dates_module._DateOutcome() for _ in range(5
```

---

### Incident Patch 6: `b37dc1d8` (2026-09-20)
**Commit Message**: fix(search): decode wrb.fr chunks by JSON grammar, and surface Google's error envelopes (#224)

* fix(search): decode wrb.fr chunks by JSON grammar and surface error envelopes

Two independent defects in the batchexecute reader, both of which end as
"No flights found" for the user.

1. Chunk framing broke on non-ASCII responses.

   iter_wrb_chunks trusted the decimal length header preceding each chunk
   and sliced the body by that many UTF-8 bytes. Google counts the chunk
   plus its two surrounding newlines in *characters*, so the two agree
   only while the response is pure ASCII — which every checked-in fixture
   happens to be. Add one accented airport name and the reader slices
   short: the chunk fails to parse and is discarded, the cursor lands
   mid-JSON, and the stream is truncated with "Malformed length header at
   offset N". A Paris-New York search returns nothing at all.

   Rather than swap one guess about Google's convention for another, stop
   using the header as a frame delimiter: json.JSONDecoder.raw_decode
   locates the end of each chunk exactly, under either convention. The
   headers are still used to re-synchronise after an unparseable chunk, so
   the pr

**File**: `fli/search/_wire.py` (modified, +268/-69)
```diff
@@ -3,20 +3,29 @@
 The Service returns JSONP-flavoured responses of the form::
 
     )]}'\n\n
-    <chunk1_byte_len>\n
+    <chunk1_len>\n
     [["wrb.fr", null, "<inner JSON string>"]]
-    <chunk2_byte_len>\n
+    <chunk2_len>\n
     [["wrb.fr", null, "<inner JSON string>"]]
     ...
 
 `GetShoppingResults` and `GetCalendarGraph` happen to emit a single chunk so
 the legacy parsers in this package could get away with `lstrip(")]}'")`.
 `GetBookingResults` emits two chunks, so we need a proper multi-chunk reader.
+Since the flight/date searches moved to the public page transport
+(:mod:`fli.search._tfs`), `SearchFlights.get_booking_options` is the only
+live consumer of this module.
 
-Important quirk: the length headers count UTF-8 **bytes**, not Python string
-characters. When the response contains any non-ASCII characters (which it
-sometimes does — airport names, airline names) the offsets diverge, so the
-reader must operate over the byte representation of the body.
+Important quirk: the length headers are **not** a dependable frame
+delimiter. They count the chunk plus its two surrounding newlines, but in
+characters rather than UTF-8 bytes, so any response carrying non-ASCII text
+(accented airport or airline names) desynchronises a byte-oriented reader —
+and an ASCII response hides the difference entirely. Rather than encode a
+guess about Google's convention, this reader ignores the announced length
+and lets the JSON grammar delimit each chunk, which is correct either way.
+The headers' *positions* are still used — to re-synchronise after a
+malformed chunk, and to bound each decode to one chunk's worth of text —
+but their values never are.
 
 This module centralises that reader and exposes :func:`iter_wrb_chunks` which
 yields the decoded inner JSON of each ``wrb.fr`` chunk.
@@ -26,78 +35,261 @@
 
 import json
 import logging
+import re
 from collections.abc import Iterator
-from typing import Any
+from typing import Any, NamedTuple
+
+from fli.search.exceptions import _GRPC_STATUS_NAMES, SearchRejectedError
 
 logger = logging.getLogger(__name__)
 
-_PREFIX = b")]}'"
+_PREFIX = ")]}'"
+
+# Framing noise between two chunks: the length header and the newlines
+# around it. Skipped wholesale — the header's value is never trusted.
+_FRAMING_CHARS = "0123456789 \t\r\n"
+
+# A chunk boundary in the raw stream: line break, decimal length header,
+# line break, then the "[" that opens the next chunk. CRLF is accepted so
+# a CRLF-framed body gets the same bounded decode as an LF-framed one —
+# but only as the trailing ``\r?``. A CRLF ends in "\n", so anchoring the
+# pattern on a literal "\n" still matches "\r\n<digits>\r\n[" (one
+# character later, which only leaves the "\r" in the window as trailing
+# whitespace the decoder ignores) while keeping the engine's literal-prefix
+# scan. Spelling the first break "\r?\n" instead costs it: a 20 MB body
+# went from 61 ms to 172 ms purely on that.
+#
+# This pattern cannot occur inside a well-formed JSON document, so the
+# next match is always at or after the current chunk's end. CR and LF are
+# both illegal unescaped inside a JSON string, so the digits would have to
+# be a number token surrounded by whitespace — and a number followed by
+# "[" with only whitespace between them is not valid JSON in any container
+# (an array needs a comma, an object a comma or colon, and a top-level
+# document ends after its one value). That makes the match position a safe
+# upper bound for where the current chunk ends, which is what lets the
+# decode below work on a bounded window. Only the header's *position* is
+# used; its value is still never trusted.
+# ``TestChunkBoundaryCannotSplitAValue`` enumerates the claim.
+_CHUNK_BOUNDARY = re.compile(r"\n\d+\r?\n(?=\[)")
+
+# Error details are echoed into the exception message, so cap them.
+_MAX_DETAIL_CHARS = 200
+
+# A body of nothing but bad chunks would otherwise emit one warning per
+# chunk. Warn on the first few, then say how many there were in total.
+_MAX_MALFORMED_WARNINGS = 5
+
+# Row kinds emitted by :func:`_rows_from_outer`.
+_ROW_CHUNK = "chunk"
+_ROW_ERROR = "error"
+
+
+class _RejectionStatus(NamedTuple):
+    """A rejection reported by an error-envelope ``wrb.fr`` row."""
+
+    code: int
+    detail: str | None
 
 
 def iter_wrb_chunks(body: str | bytes) -> Iterator[Any]:
     """Yield the inner JSON object of every ``wrb.fr`` chunk in ``body``.
 
     Robust to single-chunk responses with no length headers (the older
-    ``GetShoppingResults`` / ``GetCalendarGraph`` shape) — those are parsed
-    by falling back to a single JSON load over the trimmed body.
-    """
-    if isinstance(body, str):
-        raw = body.encode("utf-8")
-    else:
-        raw = body
+    ``GetShoppingResults`` / ``GetCalendarGraph`` shape) — those parse the
+    same way, since chunk boundaries are derived from the JSON itself.
 
-    raw = raw.lstrip()
-    if raw.startswith(_PREFIX):
-        raw = raw[len(_PREFIX
```

**File**: `fli/search/exceptions.py` (modified, +42/-4)
```diff
@@ -30,6 +30,29 @@ def __init__(self, message: str, *, status_code: int | None = None):
         self.status_code = status_code
 
 
+# Google reports a rejected request with gRPC's canonical status codes, so
+# the bare number can be named instead of left for the reader to look up.
+_GRPC_STATUS_NAMES = {
+    0: "OK",
+    1: "CANCELLED",
+    2: "UNKNOWN",
+    3: "INVALID_ARGUMENT",
+    4: "DEADLINE_EXCEEDED",
+    5: "NOT_FOUND",
+    6: "ALREADY_EXISTS",
+    7: "PERMISSION_DENIED",
+    8: "RESOURCE_EXHAUSTED",
+    9: "FAILED_PRECONDITION",
+    10: "ABORTED",
+    11: "OUT_OF_RANGE",
+    12: "UNIMPLEMENTED",
+    13: "INTERNAL",
+    14: "UNAVAILABLE",
+    15: "DATA_LOSS",
+    16: "UNAUTHENTICATED",
+}
+
+
 class SearchRejectedError(SearchClientError):
     """Google answered HTTP 200 but declined to serve results.
 
@@ -39,17 +62,32 @@ class SearchRejectedError(SearchClientError):
     over the exact request bytes, so a plain HTTP client always lands here.
     Without this error the caller saw an empty list and reported "no
     flights found", which is indistinguishable from a route with no service.
+
+    A richer rejection carries a status message and/or a ``google.rpc``-style
+    detail block after the code, kept verbatim (truncated) in ``detail`` —
+    the code alone is often too coarse to debug with. An ``INTERNAL`` (13),
+    for instance, can mean either "Google declined to serve this" or "a
+    required request header was missing", and only the detail tells the two
+    apart.
     """
 
-    def __init__(self, code: int | None = None):
-        """Record the numeric error code alongside the user-facing message."""
+    def __init__(self, code: int | None = None, *, detail: str | None = None):
+        """Record the status code, its gRPC name and any detail block."""
         self.code = code
-        suffix = f" (error {code})" if code is not None else ""
-        super().__init__(
+        self.detail = detail
+        self.status_name = _GRPC_STATUS_NAMES.get(code) if code is not None else None
+        named = f"{code} ({self.status_name})" if self.status_name else code
+        # ``0`` is gRPC's OK, so there is no error number to name — it reads
+        # the same as no code at all rather than claiming "error 0".
+        suffix = f" with error {named}" if code else ""
+        message = (
             f"Google Flights declined the request{suffix} and returned no data. "
             "Its API now requires a browser-signed x-goog-batchexecute-bgr header, "
             "which this client cannot produce. See github.com/punitarani/fli#223."
         )
+        if detail:
+            message = f"{message} Details: {detail}"
+        super().__init__(message)
 
 
 class SearchUnsupportedError(SearchClientError):
```

**File**: `tests/search/test_booking_options.py` (modified, +93/-0)
```diff
@@ -253,6 +253,99 @@ def _fake_post(url, data, **kwargs):  # noqa: ANN001
         assert opts == []
 
 
+class TestGetBookingOptionsRejectionEnvelope:
+    """A declined booking call must not read as "no bookable fares".
+
+    Google answers a request it refuses with ``HTTP 200`` and a payload-less
+    ``wrb.fr`` row carrying a gRPC status. That used to yield zero chunks,
+    which is indistinguishable from an itinerary nobody sells — so the wire
+    reader raises :class:`SearchRejectedError` instead, and it has to reach
+    the caller through ``get_booking_options`` unchanged.
+    """
+
+    @staticmethod
+    def _canned(body: str):
+        """Return a client plus a patch making its booking POST answer ``body``.
+
+        ``sf.client`` is a process-wide singleton, so the patch is handed
+        back as a context manager rather than started here — a leaked patch
+        feeds this canned body to every later test.
+        """
+        from unittest.mock import patch
+
+        def _fake_post(url, data, **kwargs):  # noqa: ANN001
+            return type(
+                "R",
+                (),
+                {
+                    "content": body.encode("utf-8"),
+                    "text": body,
+                    "raise_for_status": lambda self: None,
+                },
+            )()
+
+        sf = SearchFlights()
+        sf._last_session_id = "S"
+        return sf, patch.object(sf.client, "post", side_effect=_fake_post)
+
+    def test_error_envelope_raises_instead_of_returning_no_options(self):
+        """HTTP 200 + error envelope surfaces the status code, not an empty list."""
+        from fli.search import SearchRejectedError
+
+        body = ")]}'\n\n" + json.dumps(
+            [
+                ["wrb.fr", None, None, None, None, [13]],
+                ["di", 39],
+                ["af.httprm", 38, "-1963517503", 5],
+            ]
+        )
+        filters = _round_trip_filters()
+        flight = filters.flight_segments[1].selected_flight
+        sf, patcher = self._canned(body)
+        with patcher, pytest.raises(SearchRejectedError, match=r"13 \(INTERNAL\)") as excinfo:
+            sf.get_booking_options(flight, filters, currency="USD")
+        assert excinfo.value.code == 13
+
+    def test_rejection_reaches_the_cli_and_mcp_friendly_messages(self, monkeypatch, tmp_path):
+        """The typed error stays classified, not an "unexpected error"."""
+        from fli.cli.errors import _friendly_message, json_error_payload
+        from fli.core.errors import classify_error
+        from fli.mcp.server import _search_error_message
+        from fli.search import SearchRejectedError
+
+        # ``json_error_payload`` writes a real traceback file. Send it to
+        # tmp_path instead of the user's ~/.fli/logs, the way the autouse
+        # fixture in tests/cli/test_errors.py does for the same helper.
+        log_dir = tmp_path / "fli-logs"
+        monkeypatch.setattr("fli.cli.errors._LOG_DIR", log_dir)
+
+        exc = SearchRejectedError(13, detail="req-abc123")
+        assert "declined the request" in _friendly_message(exc)
+        assert "Unexpected error" not in _friendly_message(exc)
+        assert "declined the request" in _search_error_message(exc)
+
+        # Both surfaces classify it through the shared classifier, so they
+        # have to agree — a rejection is deterministic and never retryable.
+        payload = json_error_payload(exc, command="flights")
+        assert payload.error_type == "rejected_error"
+        assert payload.retryable is False
+        mcp_fields = classify_error(exc).as_fields()
+        assert mcp_fields["error_type"] == "rejected_error"
+        assert mcp_fields["retryable"] is False
+
+        assert list(log_dir.iterdir()), "the log file should have landed under tmp_path"
+
+    def test_genuinely_empty_response_still_returns_no_options(self):
+        """A well-formed response with no vendor rows keeps returning []."""
+        inner = json.dumps([[], None], separators=(",", ":"))
+        body = ")]}'\n\n" + json.dumps([["wrb.fr", None, inner]])
+        filters = _round_trip_filters()
+        flight = filters.flight_segments[1].selected_flight
+        sf, patcher = self._canned(body)
+        with patcher:
+            assert sf.get_booking_options(flight, filters, currency="USD") == []
+
+
 class TestEncodeBookingPayloadValidation:
     """``_encode_booking_payload`` rejects filters that can't produce a main struct."""
 
```

**File**: `tests/search/test_wire.py` (modified, +695/-12)
```diff
@@ -1,10 +1,12 @@
 """Tests for the wire-format parser shared by all FlightsFrontendService responses."""
 
 import json
+import logging
+import time
 
 import pytest
 
-from fli.search._wire import iter_wrb_chunks, parse_first_wrb_payload
+from fli.search._wire import _CHUNK_BOUNDARY, iter_wrb_chunks, parse_first_wrb_payload
 from fli.search.exceptions import SearchRejectedError
 
 
@@ -16,20 +18,22 @@ def _single_chunk(payload):
 
 
 def _multi_chunk(*payloads):
-    """Build a multi-chunk response with explicit length prefixes.
+    """Build a multi-chunk response with byte-counted length prefixes.
 
-    Mirrors Google's actual format: each length header counts both the
-    leading newline that follows the header AND the trailing newline that
-    separates this chunk from the next (i.e. ``len(outer_json) + 1``).
+    Each length header counts the chunk plus its two surrounding newlines,
+    measured in UTF-8 bytes. Google measures in characters instead (see
+    :func:`_google_framed`); both helpers exist so the reader is pinned as
+    working under either convention.
+
+    ``json.dumps`` escapes non-ASCII by default, so the bodies this builds
+    are pure ASCII and the two counts coincide in them. The byte count is
+    exercised against a genuinely multi-byte body in
+    ``TestNonAsciiFraming.test_byte_counted_framing_of_the_same_body_also_parses``.
     """
     parts = [")]}'\n\n"]
     for p in payloads:
         inner_json = json.dumps(p, separators=(",", ":"))
         outer_json = json.dumps([["wrb.fr", None, inner_json]], separators=(",", ":"))
-        # The length header counts UTF-8 BYTES (not Python str chars) plus
-        # the two surrounding newlines. Encoding the JSON before measuring
-        # keeps the test correct when payloads contain non-ASCII characters
-        # like accented airport names or Japanese carrier strings.
         byte_len = len(outer_json.encode("utf-8")) + 2
         parts.append(f"{byte_len}\n{outer_json}\n")
     return "".join(parts)
@@ -60,9 +64,7 @@ def test_handles_malformed_inner_json_gracefully(self):
         assert list(iter_wrb_chunks(body)) == []
 
     def test_non_ascii_chunk_payload(self):
-        # The length header counts UTF-8 bytes, not characters — confirm a
-        # payload with multi-byte chars round-trips correctly (regression
-        # guard for the byte-vs-char-length bug in the test helper).
+        # Multi-byte payloads round-trip under the byte-counted framing.
         body = _multi_chunk([1, "東京", "café", "résumé"])
         chunks = list(iter_wrb_chunks(body))
         assert chunks == [[1, "東京", "café", "résumé"]]
@@ -146,6 +148,687 @@ def test_skips_invalid_inner_to_find_second_valid_chunk(self):
         assert parse_first_wrb_payload(body) == [42]
 
 
+def _google_framed(*payloads: object) -> str:
+    """Build a multi-chunk response framed the way Google actually frames it.
+
+    Measured on a live August 2026 ``GetShoppingResults`` response whose
+    airport names carry accents: the length header counts the chunk *plus
+    its two surrounding newlines*, in **characters**. On an ASCII-only
+    response that is indistinguishable from a byte count, which is why the
+    checked-in fixtures never exercised the difference.
+    """
+    parts = [")]}'\n\n"]
+    for p in payloads:
+        inner_json = json.dumps(p, separators=(",", ":"), ensure_ascii=False)
+        outer_json = json.dumps(
+            [["wrb.fr", None, inner_json]], separators=(",", ":"), ensure_ascii=False
+        )
+        parts.append(f"{len(outer_json) + 2}\n{outer_json}\n")
+    return "".join(parts)
+
+
+def _error_envelope(code: int) -> str:
+    """Build the HTTP 200 error envelope Google returns for a rejected request."""
+    outer = [
+        ["wrb.fr", None, None, None, None, [code]],
+        ["di", 39],
+        ["af.httprm", 38, "-1963517503", 5],
+    ]
+    return ")]}'\n\n" + json.dumps(outer, separators=(",", ":"))
+
+
+def _error_status_row(status: object) -> list[object]:
+    """Build a payload-less ``wrb.fr`` row carrying an arbitrary status field."""
+    return ["wrb.fr", None, None, None, None, status]
+
+
+def _rows_body(*rows: object) -> str:
+    """Wrap already-built outer rows into a single-chunk response body."""
+    return ")]}'\n\n" + json.dumps(list(rows), separators=(",", ":"))
+
+
+def _payload_row(payload: object) -> list[object]:
+    """Build a normal ``wrb.fr`` row carrying an inner JSON payload."""
+    return ["wrb.fr", None, json.dumps(payload, separators=(",", ":"))]
+
+
+def _malformed_chunks(count: int) -> str:
+    """Build a header-framed body whose every chunk fails to decode.
+
+    Each chunk fails at a fixed, tiny offset into itself, so the number of
+    decode failures equals ``count`` and the only thing that grows is how
+    far into the body each failure happens.
+    """
+    chunk = "[not json]"
+    parts = [")]}'\n\n"]
+    parts.extend(f"{len(chunk) + 2}\n{chunk}\n" for _ in rang
```

---

### Incident Patch 7: `787db0e7` (2026-09-20)
**Commit Message**: fix(js): restore search in fli-js via the public search page (port of #230) (#247)

* refactor(js): share one tfs encoder between deep links and searches

`buildTfsToken` wrote the `tfs` message inline, so the search-page
transport landing next would have had to fork a second encoder for the
same bytes. Split the segment and envelope writers out as
`encodeTfsSegment` / `encodeTfsPayload` — mirroring the Python
`fli/search/_proto.py` split — and rebuild `buildTfsToken` on top of
them.

The new segment writer carries the fields a search needs and a deep link
does not: the zero-based stop ceiling (field 5), carrier include/exclude
lists (6/7, which also carry alliance names), layover airports (15) and
layover bounds (17/18). The envelope writer takes one field-8 entry per
traveller instead of a hardcoded single adult.

Pinned against the `tfs` values Google itself issued for the same
queries — the same captures `tests/search/test_tfs.py` uses — and against
the existing deep-link captures, which are unchanged byte-for-byte.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

* feat(js): complete the typed-error family and report RPC rejections

Three gaps the page transport needs clo

**File**: `README.md` (modified, +7/-0)
```diff
@@ -531,6 +531,13 @@ const filters = new FlightSearchFilters({
 const results = await new SearchFlights().search(filters, { currency: "USD" });
 ```
 
+`fli-js` uses the same search-page transport as the Python package (see
+[Search transport](#search-transport) above), with the same consequences:
+`emissions` / `bags` / `exclude_basic_economy` are dropped with a warning,
+multi-city throws `SearchUnsupportedError`, `getBookingOptions` throws
+`SearchRejectedError`, date searches cost one page fetch per date and are
+capped at 93, and `FLI_SOCS_COOKIE` controls the consent cookie.
+
 The TypeScript source lives in [`fli-js/`](fli-js); see the
 [TypeScript Quick Start](https://punitarani.github.io/fli/typescript/quickstart/)
 for the full guide.
```

**File**: `docs/typescript/examples.md` (modified, +21/-0)
```diff
@@ -35,6 +35,14 @@ On Node, run through a TypeScript loader: `npx tsx basic_one_way_search.ts`.
 
 ## Multi-city
 
+!!! warning "Not available through the current transport"
+    Google loads multi-city results client-side through the RPC it gated
+    in 2026-08, so the search page carries no rows to read.
+    `search(...)` throws `SearchUnsupportedError` for
+    `TripType.MULTI_CITY` rather than returning the first leg's one-way
+    board, which would decode cleanly into wrong results. Search each leg
+    separately for now. The example below is kept for when that changes.
+
 ```ts
 import {
   Airport,
@@ -78,9 +86,12 @@ for (const legs of itineraries ?? []) {
 
 ```ts
 import {
+  SearchClientError,
   SearchConnectionError,
   SearchHTTPError,
+  SearchParseError,
   SearchTimeoutError,
+  SearchUnsupportedError,
 } from "fli-js";
 
 try {
@@ -92,10 +103,20 @@ try {
     // network/proxy problem
   } else if (err instanceof SearchHTTPError) {
     // non-2xx from Google
+  } else if (err instanceof SearchParseError) {
+    // the page loaded but carried no readable results — a consent or
+    // block page, or a change in Google's page shape
+  } else if (err instanceof SearchUnsupportedError) {
+    // the current transport cannot serve this query (multi-city)
   } else {
     throw err;
   }
 }
 ```
 
+All of the above extend `SearchClientError`, so `catch (err) { if (err
+instanceof SearchClientError) … }` covers "the search failed" in one
+branch. A search that simply found nothing returns `null` instead of
+throwing.
+
 See the [Python examples](../python/examples.md) for the equivalent scripts.
```

**File**: `docs/typescript/quickstart.md` (modified, +66/-4)
```diff
@@ -131,8 +131,14 @@ for (const { date, price } of dates ?? []) {
 ```
 
 `DatePrice.date` is a tuple of `Date` objects: `[outbound]` for one-way,
-`[outbound, return]` for round trips. Ranges larger than 61 days are split
-into multiple calls automatically.
+`[outbound, return]` for round trips.
+
+!!! warning "One page fetch per date"
+    Google's search page carries no calendar grid, so every date in the
+    range costs its own full page fetch (~2 MB). A single
+    `SearchDates.search` prices at most **93 dates**
+    (`MAX_DATES_PER_SEARCH`); a wider range throws `RangeError`. See
+    [Search transport](#search-transport).
 
 ## Filters, alliances, and locale
 
@@ -193,8 +199,64 @@ const search = new SearchFlights(client);
 ```
 
 Typed errors — `SearchTimeoutError`, `SearchConnectionError`,
-`SearchHTTPError`, all extending `SearchClientError` — let you branch on
-failure mode.
+`SearchHTTPError`, `SearchParseError`, `SearchRejectedError` and
+`SearchUnsupportedError`, all extending `SearchClientError` — let you
+branch on failure mode.
+
+## Search transport
+
+Searches are served by Google's public search page rather than the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only
+the page's own JavaScript can produce, so a plain HTTP client gets HTTP
+200 with no payload. `fli-js` issues
+`GET https://www.google.com/travel/flights?tfs=<protobuf>` instead and
+reads the results out of the page's inline `AF_initDataCallback` blob
+keyed `ds:1`. This matches the Python library, which moved the same way.
+
+What that means in practice:
+
+* **Three filters are not supported.** `emissions`, `bags` and
+  `exclude_basic_economy` have no `tfs` field and cannot be reconstructed
+  from the decoded rows, so they are dropped with a warning. Stops,
+  cabin, passengers, alliances and layover bounds ride in the request;
+  airline include/exclude, price cap, max duration and departure windows
+  are applied to the results after fetching, and `sort_by` orders them
+  afterwards (`TOP_FLIGHTS` / `BEST` keep Google's own ranking).
+* **Multi-city throws `SearchUnsupportedError`.** Google loads those
+  results client-side through the gated RPC, so the page carries no rows
+  to read. Search each leg separately.
+* **`getBookingOptions` is unavailable.** It calls `GetBookingResults`,
+  which is gated the same way, and currently throws
+  `SearchRejectedError`. `buildFlightBookingUrl` is built offline from
+  the itinerary and still works.
+* **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than
+  the old RPC returned — and a client-side filter cannot back-fill the
+  list the way Google's server-side one did.
+* **Date searches cost one page fetch per date**, capped at 93 dates. A
+  sweep that never loads a single page stops once five dates have come
+  back payload-less and throws, rather than paying the retry budget on
+  all of them. Ten dates are in flight at once, so around fourteen are
+  attempted first — about 42 page fetches, whether the range is 30, 61 or
+  93 days. One that was cut short but found prices returns them with a
+  warning.
+* **A page occasionally arrives without results.** Roughly one request in
+  sixty returns HTTP 200 with no `ds:1` blob; the client retries that case
+  up to twice (0.5s then 1.5s) before throwing `SearchParseError`.
+* **`FLI_SOCS_COOKIE`.** EU/EEA IPs are redirected to Google's consent
+  interstitial, which serves no `ds:1` blob. The client sends a
+  pre-accepted `SOCS` consent cookie by default; set `FLI_SOCS_COOKIE` to
+  change the value, or to an empty string to send none.
+
+Warnings (dropped filters, a sweep cut short) go to `console.warn`.
+Redirect or silence them with `setSearchLogger`:
+
+```ts
+import { setSearchLogger } from "fli-js";
+
+setSearchLogger({ warn: (m) => myLogger.warn(m), debug: () => {} });
+setSearchLogger(null); // back to console.warn
+```
 
 ## Next steps
 
```

**File**: `examples/python/multi_city_search.py` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
 #!/usr/bin/env python3
 """Multi-city flight search example.
 
+CURRENTLY UNAVAILABLE. Since 2026-08 searches are served by Google's
+public ``/travel/flights`` page rather than the ``GetShoppingResults``
+RPC, which now requires a browser-signed header. Google loads multi-city
+results client-side through that same gated RPC, so the page carries no
+flight rows to read — :meth:`SearchFlights.search` raises
+``SearchUnsupportedError`` rather than returning the first leg's one-way
+board, which would decode cleanly into wrong results. Search each leg
+separately for now. This example is kept for when that changes; see
+github.com/punitarani/fli#223.
+
 This example demonstrates how to search a multi-city itinerary (three or
 more one-way legs on different dates) in a single request. Multi-city
 results come back as tuples of ``FlightResult`` — one entry per leg, in
```

**File**: `examples/typescript/multi_city_search.ts` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
 /**
  * Multi-city itinerary search (three legs on different dates).
  *
+ * CURRENTLY UNAVAILABLE. Since 2026-08 searches are served by Google's
+ * public `/travel/flights` page rather than the `GetShoppingResults` RPC,
+ * which now requires a browser-signed header. Google loads multi-city
+ * results client-side through that same gated RPC, so the page carries no
+ * flight rows to read — `search()` raises `SearchUnsupportedError` rather
+ * than returning the first leg's one-way board, which would decode
+ * cleanly into wrong results. Search each leg separately for now. This
+ * example is kept for when that changes; see
+ * https://github.com/punitarani/fli#223.
+ *
  * Mirrors examples/python/multi_city_search.py. Results come back as an
  * array of itineraries, each itinerary an array of FlightResult — one per
  * leg, in order. Run with:
```

**File**: `fli-js/README.md` (modified, +78/-5)
```diff
@@ -4,7 +4,8 @@ A 1:1 TypeScript / JavaScript port of the [Python `fli` library](https://github.
 
 Programmatic access to Google Flights data via direct API interaction (no
 scraping). The API surface mirrors the Python package — same models, same
-filter encoding, same wire-format decoders.
+filter encoding, same wire-format decoders — and, since Google gated its
+RPC endpoints, the same [search-page transport](#search-transport).
 
 ## Install
 
@@ -94,12 +95,74 @@ console.log(googleFlightsUrl("JFK", "LHR", "2026-12-25", null, { currency: "USD"
 of them (round-trip / multi-city). It never throws — on malformed input it
 falls back to the generic Google Flights URL.
 
+## Search transport
+
+Searches are served by Google's public search page rather than the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only the
+page's own JavaScript can produce, so a plain HTTP client gets HTTP 200 with no
+payload. `fli-js` issues `GET https://www.google.com/travel/flights?tfs=<protobuf>`
+instead and reads the results out of the page's inline `AF_initDataCallback`
+blob keyed `ds:1`.
+
+What that means in practice:
+
+- **Three filters are not supported.** `emissions`, `bags` and
+  `exclude_basic_economy` have no `tfs` field and cannot be reconstructed from
+  the decoded rows, so they are dropped with a warning. Stops, cabin,
+  passengers, alliances and layover bounds ride in the request; airline
+  include/exclude, price cap, max duration and departure windows are applied to
+  the results after fetching, and `sort_by` orders them afterwards
+  (`TOP_FLIGHTS` / `BEST` keep Google's own ranking).
+- **Multi-city throws `SearchUnsupportedError`.** Google loads those results
+  client-side through the gated RPC, so the page carries no rows to read.
+  Search each leg separately.
+- **`getBookingOptions` is unavailable.** It calls `GetBookingResults`, which
+  is gated the same way, and currently throws `SearchRejectedError`. The
+  per-flight `tfs` booking deep links (`buildFlightBookingUrl`) are built
+  offline and still work.
+- **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than the
+  old RPC returned — and a client-side filter cannot back-fill the list the way
+  Google's server-side one did.
+- **Date searches cost one page fetch per date.** The page has no calendar
+  grid, so a range is priced date by date; one `SearchDates.search` covers at
+  most 93 dates (`MAX_DATES_PER_SEARCH`) and a wider range throws `RangeError`.
+  A sweep that never manages to load a single page — the shape a blocked or
+  consent-gated client produces — stops once five dates have come back
+  payload-less rather than paying the retry budget on all of them, and throws.
+  Up to ten dates are in flight at once, so around fourteen are attempted
+  before the rest are abandoned (measured: 42 page fetches, whether the range
+  is 30, 61 or 93 days). Only pages served without results count towards that:
+  a timeout or a dropped connection says nothing about the dates not yet tried,
+  so those never abandon a sweep. A sweep cut short that still found prices
+  returns them with one warning saying so.
+- **A page occasionally arrives without results.** Roughly one request in sixty
+  returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
+  (0.5s then 1.5s) before throwing `SearchParseError`. A healthy search never
+  pays for it.
+- **`FLI_SOCS_COOKIE`.** EU/EEA IPs are redirected to Google's consent
+  interstitial, which serves no `ds:1` blob. The client sends a pre-accepted
+  `SOCS` consent cookie by default; set `FLI_SOCS_COOKIE` to change the value,
+  or to an empty string to send none.
+
+The client reports dropped filters and partial sweeps through `console.warn`.
+Redirect or silence that with `setSearchLogger`:
+
+```ts
+import { setSearchLogger } from "fli-js";
+
+setSearchLogger({ warn: (m) => myLogger.warn(m), debug: () => {} });
+setSearchLogger(null); // back to console.warn
+```
+
 ## HTTP / proxy configuration
 
-The TypeScript port uses native `fetch` (Bun's built-in) and replaces
-`curl_cffi`'s TLS impersonation with:
+The TypeScript port uses native `fetch` (Bun's and Node's built-in) and
+replaces `curl_cffi`'s TLS impersonation with:
 
-- realistic Chrome `User-Agent` + `Sec-CH-*` headers,
+- realistic Chrome `User-Agent` + `Sec-CH-*` headers — the `User-Agent` is
+  load-bearing, not cosmetic: without one the search page serves a shell with
+  no flight rows in it,
 - automatic rate-limiting at 10 req/s,
 - 3-attempt exponential backoff on transient errors,
 - proxy support via the `HTTPS_PROXY` / `HTTP_PROXY` env vars (or via the
@@ -124,7 +187,9 @@ Set the per-request timeout with `FLI_TIMEOUT=30` (seconds) or via the
   currency token decoders, deep-link builder (`googleFlightsUrl`).
 - `fli-js/search` — `SearchFlights` (incl. `buildFlightBookingUrl`),
   `SearchDates`, `Clie
```

**File**: `fli-js/scripts/dump_tfs_goldens.py` (added, +252/-0)
```diff
@@ -0,0 +1,252 @@
+"""Dump the golden ``tfs`` values pinned by ``tests/search/tfs.test.ts``.
+
+The TypeScript encoder must produce byte-identical ``tfs`` tokens to the
+Python one — that is the strongest correctness lever the port has, since
+Google accepts a malformed token by quietly answering a different query.
+This script is the single source of those goldens.
+
+Run it from the **repository root** (it imports the Python package, not
+the JS one)::
+
+    uv run --python 3.13 python fli-js/scripts/dump_tfs_goldens.py
+
+and paste the JSON it prints into ``TFS_GOLDENS`` in
+``fli-js/tests/search/tfs.test.ts``.
+
+Travel dates are deliberately far out: ``FlightSegment`` rejects a past
+date, and the JS suite has no clock-pinning fixture, so a golden built on
+a near date would start failing the day it passed. The ``tfs`` bytes
+depend only on the dates in the filters, never on "today".
+"""
+
+from __future__ import annotations
+
+import json
+from datetime import datetime
+
+from fli.models import (
+    Airline,
+    Airport,
+    Alliance,
+    FlightLeg,
+    FlightResult,
+    FlightSearchFilters,
+    FlightSegment,
+    LayoverRestrictions,
+    MaxStops,
+    PassengerInfo,
+    SeatType,
+    TripType,
+)
+from fli.search._tfs import build_tfs
+
+OUT = "2030-09-15"
+RET = "2030-09-19"
+MULTI = "2030-10-15"
+
+
+def seg(origins, dests, date):
+    return FlightSegment(
+        departure_airport=[[Airport[o], 0] for o in origins],
+        arrival_airport=[[Airport[d], 0] for d in dests],
+        travel_date=date,
+    )
+
+
+def filters(segments, **kw):
+    return FlightSearchFilters(
+        trip_type=kw.pop("trip_type", TripType.ONE_WAY),
+        passenger_info=kw.pop("passenger_info", PassengerInfo(adults=1)),
+        flight_segments=segments,
+        stops=kw.pop("stops", MaxStops.ANY),
+        seat_type=kw.pop("seat_type", SeatType.ECONOMY),
+        **kw,
+    )
+
+
+def selected_flight():
+    return FlightResult(
+        legs=[
+            FlightLeg(
+                airline=Airline.BA,
+                flight_number="178",
+                departure_airport=Airport.JFK,
+                arrival_airport=Airport.LHR,
+                departure_datetime=datetime(2030, 9, 15, 20, 30),
+                arrival_datetime=datetime(2030, 9, 16, 8, 30),
+                duration=420,
+            )
+        ],
+        price=295.0,
+        currency="USD",
+        duration=420,
+        stops=0,
+    )
+
+
+def two_leg_selected_flight():
+    """Connecting outbound, to pin the repeated leg encoding."""
+    return FlightResult(
+        legs=[
+            FlightLeg(
+                airline=Airline.AA,
+                flight_number="100",
+                departure_airport=Airport.JFK,
+                arrival_airport=Airport.ORD,
+                departure_datetime=datetime(2030, 9, 15, 7, 0),
+                arrival_datetime=datetime(2030, 9, 15, 9, 0),
+                duration=150,
+            ),
+            FlightLeg(
+                airline=Airline.AA,
+                flight_number="200",
+                departure_airport=Airport.ORD,
+                arrival_airport=Airport.LHR,
+                departure_datetime=datetime(2030, 9, 15, 17, 0),
+                arrival_datetime=datetime(2030, 9, 16, 7, 0),
+                duration=480,
+            ),
+        ],
+        price=420.0,
+        currency="USD",
+        duration=900,
+        stops=1,
+    )
+
+
+cases: dict[str, str] = {}
+
+
+def add(name, spec, **kw):
+    cases[name] = build_tfs(spec, **kw)
+
+
+# --- trip shapes ---------------------------------------------------------
+add("one_way_jfk_lax", filters([seg(["JFK"], ["LAX"], OUT)]))
+add(
+    "round_trip_jfk_lax",
+    filters(
+        [seg(["JFK"], ["LAX"], OUT), seg(["LAX"], ["JFK"], RET)],
+        trip_type=TripType.ROUND_TRIP,
+    ),
+)
+
+rt_selected = filters(
+    [seg(["JFK"], ["LHR"], OUT), seg(["LHR"], ["JFK"], RET)],
+    trip_type=TripType.ROUND_TRIP,
+)
+rt_selected.flight_segments[0].selected_flight = selected_flight()
+add("round_trip_selected_outbound", rt_selected)
+
+rt_conn = filters(
+    [seg(["JFK"], ["LHR"], OUT), seg(["LHR"], ["JFK"], RET)],
+    trip_type=TripType.ROUND_TRIP,
+)
+rt_conn.flight_segments[0].selected_flight = two_leg_selected_flight()
+add("round_trip_selected_connecting_outbound", rt_conn)
+
+add(
+    "multi_airport",
+    filters([seg(["BOM", "DEL", "AMD"], ["ORD", "DTW"], MULTI)]),
+)
+
+# --- cabins --------------------------------------------------------------
+for name, cabin in [
+    ("economy", SeatType.ECONOMY),
+    ("premium_economy", SeatType.PREMIUM_ECONOMY),
+    ("business", SeatType.BUSINESS),
+    ("first", SeatType.FIRST),
+]:
+    add(f"cabin_{name}", filters([seg(["JFK"], ["LAX"], OUT)], seat_type=cabin))
+
+# --- stops ---------------------------------------------------------------
+for name, stops in [
+    ("any", MaxStops.ANY),
+    ("non_stop", MaxStops.NON_STOP),
+    ("one_stop_or_
```

**File**: `fli-js/src/search/client.ts` (modified, +121/-12)
```diff
@@ -12,7 +12,7 @@
  *   - wraps low-level errors into the typed {@link SearchClientError} family
  */
 
-import { TokenBucketRateLimiter } from "./concurrency.ts";
+import { sleep, TokenBucketRateLimiter, throwIfAborted } from "./concurrency.ts";
 import {
   SearchClientError,
   SearchConnectionError,
@@ -44,24 +44,90 @@ function resolveProxy(): string | undefined {
   return env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy ?? undefined;
 }
 
-const DEFAULT_HEADERS: Record<string, string> = {
+/**
+ * Headers every request carries.
+ *
+ * The `user-agent` is the load-bearing one, and not cosmetically: the
+ * `/travel/flights` page inlines its `ds:1` flight payload only for a
+ * request that looks like a browser. Probed 2026-09-20 under Bun 1.3 and
+ * Node 24 — with a Chrome UA the page is ~2.5 MB and carries the rows;
+ * with no UA at all it is ~1.2 MB and carries none, on HTTP 200 either
+ * way. The rest of the headers are not required by that probe, and are
+ * sent because a browser sends them.
+ */
+const BASE_HEADERS: Record<string, string> = {
   // A realistic recent-Chrome UA. Google's frontend is tolerant of mismatch
   // between the UA and the actual TLS fingerprint (which we can't fake from
   // a Node/Bun fetch) but a credible UA makes a difference vs the default
   // "node-fetch" / "undici" strings.
   "user-agent":
     "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
-  accept: "*/*",
   "accept-language": "en-US,en;q=0.9",
   "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
   "sec-ch-ua-mobile": "?0",
   "sec-ch-ua-platform": '"macOS"',
+};
+
+/**
+ * Headers for the `f.req` RPC POSTs (`GetBookingResults`).
+ *
+ * Unchanged from before the search-page transport landed, so the one
+ * remaining RPC call goes out exactly as it always did.
+ */
+const DEFAULT_HEADERS: Record<string, string> = {
+  ...BASE_HEADERS,
+  accept: "*/*",
   "sec-fetch-dest": "empty",
   "sec-fetch-mode": "cors",
   "sec-fetch-site": "same-origin",
   "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
 };
 
+/**
+ * Headers for the search-page GET.
+ *
+ * A top-level document navigation, which is what this request actually
+ * is — the POST set describes a same-origin XHR, and carries a
+ * form-encoded `content-type` on a request with no body.
+ */
+const DEFAULT_GET_HEADERS: Record<string, string> = {
+  ...BASE_HEADERS,
+  accept:
+    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
+  "sec-fetch-dest": "document",
+  "sec-fetch-mode": "navigate",
+  "sec-fetch-site": "none",
+  "sec-fetch-user": "?1",
+  "upgrade-insecure-requests": "1",
+};
+
+/**
+ * Pre-accepted consent cookie, sent so EU/EEA IPs are not redirected to
+ * Google's consent interstitial — which serves a page with no `ds:1`
+ * payload, so every search there fails to parse. The legacy `CONSENT`
+ * cookie no longer works, and a truncated `SOCS` value is ignored.
+ *
+ * Override with `FLI_SOCS_COOKIE` if Google rotates the value; set it to
+ * the empty string to send no cookie at all.
+ */
+export const DEFAULT_SOCS_COOKIE =
+  "CAISNQgQEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwMzE3LjA5X3AwGgJlbiADGgYIgLC_rwY";
+
+/**
+ * The `SOCS` cookie value in effect: `FLI_SOCS_COOKIE` if set (including
+ * to the empty string, which disables the cookie), else
+ * {@link DEFAULT_SOCS_COOKIE}.
+ *
+ * Read at `Client` construction rather than at module load — Python
+ * reads its process environment once at import, but a JS consumer that
+ * sets `process.env` before building a client would find that surprising,
+ * and it makes the behaviour testable without module cache games.
+ */
+export function resolveSocsCookie(): string {
+  const raw = typeof process !== "undefined" ? process.env?.FLI_SOCS_COOKIE : undefined;
+  return raw ?? DEFAULT_SOCS_COOKIE;
+}
+
 export interface ClientOptions {
   /** Calls per second budget. Defaults to 10. */
   callsPerSecond?: number;
@@ -75,6 +141,11 @@ export interface ClientOptions {
   proxy?: string | null;
   /** Custom fetch implementation (test seam). */
   fetchImpl?: typeof fetch;
+  /**
+   * `SOCS` consent cookie value. Defaults to `FLI_SOCS_COOKIE` if set,
+   * else {@link DEFAULT_SOCS_COOKIE}. An empty string sends no cookie.
+   */
+  socsCookie?: string;
 }
 
 export interface RequestOptions {
@@ -91,8 +162,24 @@ export interface ClientResponse {
   ok: boolean;
 }
 
-function sleep(ms: number): Promise<void> {
-  return new Promise((res) => setTimeout(res, ms));
+/**
+ * Is this URL served by Google?
+ *
+ * The `SOCS` consent cookie must not ride along to whatever other host a
+ * caller points the client at — Python keeps it in a cookie jar scoped to
+ * `.google.com`, and a header has no such scope of its own. `.google.com`
+ * covers `www.google.com` and `consent.google.com`, which are the 
```

---

### Incident Patch 8: `9bab6a86` (2026-09-20)
**Commit Message**: fix(mcp): keep the " (CODE)" enum-uniqueness suffix out of flight results (#245)

#160 made every Airport/Airline Enum value unique by suffixing shared names
with " (CODE)", and hid that suffix from the CLI and from `find_airports`.
The MCP flight serializer was missed: it put the raw Enum members into each
leg, so tool responses read "Naha Airport (OKA)" / "Wizz Air (W4)" for the 104
affected names, next to a separate code field.

Serialize leg airports and airline through `display_name`. The serializer is
duck-typed, so anything that is not an Airport/Airline member passes through
unchanged (covered by a test, after the first attempt broke 24 existing tests
that use string-valued test doubles).

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `fli/mcp/server.py` (modified, +14/-3)
```diff
@@ -35,12 +35,14 @@
 )
 from fli.core.parsers import ParseError
 from fli.models import (
+    Airline,
     Airport,
     BagsFilter,
     DateSearchFilters,
     FlightSearchFilters,
     PassengerInfo,
     TripType,
+    display_name,
 )
 from fli.search import SearchDates, SearchFlights
 from fli.search.dates import MAX_DATES_PER_SEARCH
@@ -409,15 +411,24 @@ def _flight_idents(flight: Any) -> list[str]:
     return [f"{_airline_code(leg.airline)}{leg.flight_number}" for leg in _flight_legs(flight)]
 
 
+def _plain_name(value: Any) -> Any:
+    """Return an airport/airline's display name without the internal `` (CODE)`` suffix.
+
+    Legs are duck-typed here (tests and callers may pass plain strings), so
+    anything that is not an ``Airport``/``Airline`` member passes through as is.
+    """
+    return display_name(value) if isinstance(value, Airport | Airline) else value
+
+
 def _serialize_flight_leg(leg: Any) -> dict[str, Any]:
     """Serialize a single flight leg to a dictionary."""
     out: dict[str, Any] = {
-        "departure_airport": leg.departure_airport,
-        "arrival_airport": leg.arrival_airport,
+        "departure_airport": _plain_name(leg.departure_airport),
+        "arrival_airport": _plain_name(leg.arrival_airport),
         "departure_time": leg.departure_datetime,
         "arrival_time": leg.arrival_datetime,
         "duration": leg.duration,
-        "airline": leg.airline,
+        "airline": _plain_name(leg.airline),
         "airline_code": _airline_code(leg.airline),
         "flight_number": leg.flight_number,
     }
```

**File**: `tests/mcp/test_leg_display_names.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+"""MCP flight results must show plain airport/airline names.
+
+Names shared by several airports or airlines are stored with an internal
+`` (CODE)`` suffix so every Enum value stays unique. That suffix must not leak
+into tool responses: the code is already returned in its own field.
+"""
+
+import json
+from datetime import datetime
+from enum import Enum
+
+from fli.mcp.server import _serialize_flight_leg as _serialize_leg
+from fli.models import Airline, Airport, FlightLeg
+
+
+def _leg(airline: Airline, origin: Airport, destination: Airport) -> FlightLeg:
+    return FlightLeg(
+        airline=airline,
+        flight_number="6012",
+        departure_airport=origin,
+        arrival_airport=destination,
+        departure_datetime=datetime(2026, 12, 15, 9, 25),
+        arrival_datetime=datetime(2026, 12, 15, 11, 55),
+        duration=150,
+    )
+
+
+def _as_json(payload: dict) -> dict:
+    """Round-trip the way an MCP client receives it (Enums collapse to their value)."""
+
+    def encode(value: object) -> object:
+        return value.value if isinstance(value, Enum) else value.isoformat()
+
+    return json.loads(json.dumps(payload, default=encode))
+
+
+def test_disambiguated_names_are_shown_without_their_code_suffix():
+    """OKA/NTL/W4 all carry an internal suffix; none of it reaches the response."""
+    assert Airport.OKA.value.endswith("(OKA)")  # guards the premise of this test
+    leg = _as_json(_serialize_leg(_leg(Airline.W4, Airport.OKA, Airport.NTL)))
+
+    assert leg["departure_airport"] == "Naha Airport"
+    assert leg["arrival_airport"] == "Newcastle Airport"
+    assert leg["airline"] == "Wizz Air"
+    assert leg["airline_code"] == "W4"
+
+
+def test_ordinary_names_are_unchanged():
+    """Names that were never ambiguous are returned exactly as before."""
+    leg = _as_json(_serialize_leg(_leg(Airline.BA, Airport.JFK, Airport.LHR)))
+
+    assert leg["departure_airport"] == Airport.JFK.value
+    assert leg["arrival_airport"] == Airport.LHR.value
+    assert leg["airline"] == Airline.BA.value
+
+
+def test_duck_typed_legs_with_plain_strings_pass_through():
+    """The serializer accepts leg-like objects whose names are already strings."""
+    from types import SimpleNamespace
+
+    leg = SimpleNamespace(
+        airline="Example Air",
+        flight_number="1",
+        departure_airport="Somewhere (XYZ)",
+        arrival_airport="Elsewhere",
+        departure_datetime=datetime(2026, 12, 15, 9, 25),
+        arrival_datetime=datetime(2026, 12, 15, 11, 55),
+        duration=150,
+    )
+    out = _as_json(_serialize_leg(leg))
+
+    assert out["departure_airport"] == "Somewhere (XYZ)"  # untouched: not an Enum member
+    assert out["airline"] == "Example Air"
```

---

### Incident Patch 9: `5c092f12` (2026-09-20)
**Commit Message**: fix(search): restore search via the public page's tfs parameter (#223) (#230)

* fix(search): restore search via the public page's tfs parameter (#223)

Google's FlightsFrontendService RPC endpoints have required an
x-goog-batchexecute-bgr header since early August. The page's own
JavaScript signs it over the exact request bytes, so a captured token
cannot be replayed against a different body. Both GetShoppingResults and
GetCalendarGraph now answer HTTP 200 with a payload-less wrb.fr row
carrying error 13, which parse_first_wrb_payload reads as None and the
CLI reports as "No flights found" — indistinguishable from a route with
no service. Every route returns count: 0.

The public /travel/flights page is not gated that way. It embeds the same
result payload in an AF_initDataCallback blob keyed ds:1, whose elements
[2] and [3] hold exactly the flight rows the RPC returned, so the
decoders, models, CLI and MCP surface all keep working unchanged. Only
the transport moves.

The page takes the tfs protobuf parameter rather than the f.req JSON
struct. build_tfs_token already encoded tfs for booking deep links, so
its field layout is now shared: encode_tfs_segment and encode_tfs_payload
s

**File**: `CLAUDE.md` (modified, +60/-4)
```diff
@@ -93,6 +93,53 @@ uv run mkdocs build         # Build static docs
 - **Shared Utilities**: Core parsing/building logic shared between CLI and MCP
 - **Validation**: Pydantic models ensure data integrity throughout
 
+## Search transport
+
+Searches go through Google's public search page, not the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only the
+page's JavaScript can produce, so the client issues
+`GET https://www.google.com/travel/flights?tfs=<protobuf>` and reads the
+`AF_initDataCallback` blob keyed `ds:1`. Request encoding lives in
+`fli/search/_tfs.py` and `fli/search/_proto.py`.
+
+Consequences to keep in mind when changing search code:
+
+- `emissions`, `bags` and `exclude_basic_economy` have no `tfs` field and no
+  post-hoc equivalent; `unsupported_filters()` names them and the caller warns.
+- Airline include/exclude, price cap, max duration and departure windows are
+  applied after fetching by `apply_client_side_filters()`; stops, cabin,
+  passengers, alliances and layover bounds are encoded into the request.
+- Multi-city raises `SearchUnsupportedError` — the page inlines no rows for it.
+- `get_booking_options` hits `GetBookingResults`, which is still gated, so it
+  currently raises `SearchRejectedError`. Booking deep links (`tfs`) are built
+  offline and unaffected.
+- A search returns fewer rows than the old RPC (~20-45), and client-side
+  filtering is not back-filled.
+- Date searches have no calendar grid: one page fetch per date, capped at
+  `fli.search.dates.MAX_DATES_PER_SEARCH` (93) per `SearchDates.search`. At the
+  cap that is several hundred MB of pages and parsed JSON at peak.
+- `_SweepHealth` (`SWEEP_FAILURE_THRESHOLD`, 5) is the sweep's circuit breaker.
+  It counts **only** payload-less pages — that failure is deterministic, so the
+  untried dates will fail the same way; a timeout or connection error says
+  nothing about them and deliberately does not count. It is armed only while no
+  date has loaded a page and disarmed permanently by the first success, so a
+  working sweep keeps the full retry budget for transient misses.
+  Measured with the real backoff, it turns a fully blocked 93-date sweep from
+  279 page fetches (up to 837 HTTP requests once the client's own retries
+  multiply) into 42 in ~4s, bounded at
+  (threshold + pool workers) x `PAGE_FETCH_ATTEMPTS` = 45 regardless of range —
+  the bound scales with `configure_concurrency`.
+  When it trips but prices still come back, `_collect` emits exactly one
+  warning naming the skipped count: a truncated answer must never be silent.
+- ~1 page in 60 arrives HTTP 200 with no `ds:1` blob. `fetch_payload` in
+  `fli/search/_tfs.py` is the single fetch path for both flights and dates and
+  retries exactly that case (`PAGE_FETCH_ATTEMPTS`, `PAGE_RETRY_BACKOFF`);
+  HTTP errors and error-13 rejections are not retried there.
+- `FLI_SOCS_COOKIE` overrides the pre-accepted `SOCS` consent cookie the client
+  sends so EU/EEA IPs skip Google's consent interstitial; set it empty to send
+  no cookie.
+
 ## Key Files and Entry Points
 
 - `fli/cli/main.py` - CLI entry point and command registration
@@ -150,6 +197,11 @@ Find cheapest travel dates within a range.
 Flights for that specific date (and return date for round trips).
 
 ### `get_booking_options`
+**Currently unavailable:** it calls `GetBookingResults`, which is gated behind
+the browser-signed header (see "Search transport"), so it raises
+`SearchRejectedError`. Use a flight's `booking_url` deep link instead. The rest
+of this section describes the tool for when that RPC becomes reachable again.
+
 Get bookable fares (vendor names, prices, and direct booking URLs) for a
 single itinerary. Runs a fresh search, selects the flight identified by
 `flight_numbers` (or the top result when omitted), then calls
@@ -185,10 +237,14 @@ one-line `Error: ...` and a non-zero exit code; the MCP tools surface
 other validators).
 
 ### Note on emissions
-Both tools accept the `emissions` filter (forwarded to Google's
-"less emissions" toggle as `LESS`), but raw CO₂ figures are intentionally
-**not** returned in CLI output or MCP tool responses. The filter operates
-server-side; the data is not displayed in the current release.
+The API surface still accepts the `emissions` filter, but the search-page
+transport has no `tfs` field for it, so it is **currently ignored** — the
+search logs a warning naming it and returns unfiltered results. The same is
+true of `checked_bags` / `carry_on` and `exclude_basic_economy`. See
+"Search transport" above.
+
+Independently of that: raw CO₂ figures are intentionally **not** returned in
+CLI output or MCP tool responses, and that is unchanged.
 
 ## Releasing
 
```

**File**: `README.md` (modified, +50/-0)
```diff
@@ -157,6 +157,56 @@ fli --help
     * Comprehensive error handling
     * Input validation
 
+## Search transport
+
+Searches are served by Google's public search page rather than the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only the
+page's own JavaScript can produce, so a plain HTTP client gets HTTP 200 with no
+payload. Fli issues `GET https://www.google.com/travel/flights?tfs=<protobuf>`
+instead and reads the results out of the page's inline `AF_initDataCallback`
+blob keyed `ds:1`.
+
+What that means in practice:
+
+* **Three filters are not supported.** `emissions`, `bags` and
+  `exclude_basic_economy` have no `tfs` field and cannot be reconstructed from
+  the decoded rows, so they are dropped with a warning. Stops, cabin,
+  passengers, alliances and layover bounds ride in the request; airline
+  include/exclude, price cap, max duration and departure windows are applied to
+  the results after fetching.
+* **Multi-city raises `SearchUnsupportedError`.** Google loads those results
+  client-side through the gated RPC, so the page carries no rows to read.
+  Search each leg separately.
+* **`get_booking_options` is unavailable.** It calls `GetBookingResults`, which
+  is gated the same way, and currently raises `SearchRejectedError`. The
+  per-flight `tfs` booking deep links are built offline and still work.
+* **Fewer rows per search.** Expect roughly 20-45 itineraries, fewer than the
+  old RPC returned — and a client-side filter cannot back-fill the list the way
+  Google's server-side one did.
+* **Date searches cost one page fetch per date.** The page has no calendar
+  grid, so a range is priced date by date; one `SearchDates.search` covers at
+  most 93 dates and a wider range raises `ValueError`. Budget for it: 93 dates
+  across 10 workers is several hundred MB of pages and parsed JSON at peak.
+  A sweep that never manages to load a single page — the shape a blocked or
+  consent-gated client produces — gives up after a handful of dates rather than
+  paying the retry budget on all of them. Only pages served without results
+  count towards that: a timeout or a dropped connection says nothing about the
+  dates not yet tried, so those never abandon a sweep. Measured with the real backoff: **42
+  page fetches** (bounded at 45, so up to ~135 HTTP requests once the client's
+  own retries multiply in) and about 4 seconds, the same whether the range is 30
+  days or 93. Unbroken, a 93-date range would have cost 279 fetches and up to
+  837 requests. The bound is `(5 + worker count) x 3`, so raising
+  `configure_concurrency` raises it proportionally.
+* **A page occasionally arrives without results.** Roughly one request in sixty
+  returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
+  (0.5s then 1.5s) before raising `SearchParseError`. A healthy search never
+  pays for it.
+* **`FLI_SOCS_COOKIE`.** EU/EEA IPs are redirected to Google's consent
+  interstitial, which serves no `ds:1` blob. The client sends a pre-accepted
+  `SOCS` consent cookie by default; set `FLI_SOCS_COOKIE` to change the value,
+  or to an empty string to send none.
+
 ## CLI Usage
 
 ### Search for Flights
```

**File**: `docs/guides/mcp.md` (modified, +4/-4)
```diff
@@ -227,15 +227,15 @@ find out where (and at what price) a specific flight can be booked.
 | `infants_in_seat` | int | No | 0 | Number of infants (under 2) occupying their own seat |
 | `infants_on_lap` | int | No | 0 | Number of lap infants (under 2, no seat) — cannot exceed `passengers` |
 | `airlines` | list | No | null | Filter by airline codes (e.g., ['BA', 'AA']) |
-| `exclude_basic_economy` | bool | No | false | Exclude basic economy fares |
+| `exclude_basic_economy` | bool | No | false | Exclude basic economy fares. **Currently ignored by the search transport** (logged as a warning). |
 | `departure_window` | string | No | null | Time window in 'HH-HH' format (e.g., '6-20') |
 | `sort_by` | string | No | CHEAPEST | Sort order — matters when `flight_numbers` is omitted |
 | `exclude_airlines` | list | No | null | Airline IATA codes to **exclude** |
 | `alliance` / `exclude_alliance` | list | No | null | Restrict / exclude ONEWORLD, SKYTEAM, STAR_ALLIANCE |
 | `min_layover` / `max_layover` | int | No | null | Layover duration bounds (minutes) |
-| `emissions` | string | No | ALL | ALL or LESS |
-| `checked_bags` | int | No | 0 | Checked bags included in price (0–2) |
-| `carry_on` | bool | No | false | Include carry-on bag fee in price |
+| `emissions` | string | No | ALL | ALL or LESS. **Currently ignored by the search transport** (logged as a warning). |
+| `checked_bags` | int | No | 0 | Checked bags included in price (0–2). **Currently ignored by the search transport** (logged as a warning). |
+| `carry_on` | bool | No | false | Include carry-on bag fee in price. **Currently ignored by the search transport** (logged as a warning). |
 | `currency` | string | No | null | ISO 4217 currency code (`curr=`) |
 | `language` | string | No | null | BCP-47 language code (`hl=`) |
 | `country` | string | No | null | ISO 3166-1 alpha-2 country (`gl=`) |
```

**File**: `fli/cli/commands/dates.py` (modified, +8/-3)
```diff
@@ -36,6 +36,7 @@
     TripType,
 )
 from fli.search import SearchClientError, SearchDates
+from fli.search.dates import MAX_DATES_PER_SEARCH
 
 
 def _build_selected_days(
@@ -74,9 +75,13 @@ def dates(
         str,
         typer.Option("--from", help="Start date (YYYY-MM-DD)"),
     ] = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
-    end_date: Annotated[str, typer.Option("--to", help="End date (YYYY-MM-DD)")] = (
-        datetime.now() + timedelta(days=60)
-    ).strftime("%Y-%m-%d"),
+    end_date: Annotated[
+        str,
+        typer.Option(
+            "--to",
+            help=(f"End date (YYYY-MM-DD); at most {MAX_DATES_PER_SEARCH} dates per search"),
+        ),
+    ] = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
     trip_duration: Annotated[
         int,
         typer.Option(
```

**File**: `fli/cli/commands/flights.py` (modified, +9/-4)
```diff
@@ -385,7 +385,7 @@ def flights(
         typer.Option(
             "--exclude-basic",
             "-e",
-            help="Exclude basic economy fares",
+            help="Exclude basic economy fares. [currently ignored by the search transport]",
         ),
     ] = False,
     layover: Annotated[
@@ -400,15 +400,20 @@ def flights(
         str,
         typer.Option(
             "--emissions",
-            help="Filter by emissions level (ALL, LESS)",
+            help=(
+                "Filter by emissions level (ALL, LESS). [currently ignored by the search transport]"
+            ),
         ),
     ] = "ALL",
     checked_bags: Annotated[
         int,
         typer.Option(
             "--bags",
             "-b",
-            help="Number of checked bags to include in price (0, 1, or 2)",
+            help=(
+                "Checked bags included in price (0, 1, or 2). "
+                "[currently ignored by the search transport]"
+            ),
             min=0,
             max=2,
         ),
@@ -417,7 +422,7 @@ def flights(
         bool,
         typer.Option(
             "--carry-on",
-            help="Include carry-on bag fee in price",
+            help="Include carry-on bag fee in price. [currently ignored by the search transport]",
         ),
     ] = False,
     all_results: Annotated[
```

**File**: `fli/cli/errors.py` (modified, +14/-0)
```diff
@@ -20,6 +20,8 @@
     SearchClientError,
     SearchConnectionError,
     SearchHTTPError,
+    SearchParseError,
+    SearchRejectedError,
     SearchTimeoutError,
 )
 
@@ -35,6 +37,14 @@ def _friendly_message(exc: BaseException) -> str:
         return f"Network error. {exc}"
     if isinstance(exc, SearchHTTPError):
         return f"Google Flights error. {exc}"
+    if isinstance(exc, SearchRejectedError):
+        return f"Google Flights declined the request. {exc}"
+    if isinstance(exc, SearchParseError):
+        return (
+            f"Could not read Google Flights' response. {exc} "
+            "This is usually a transient page variant or a regional consent "
+            "interstitial — retry, or set FLI_SOCS_COOKIE if you are in the EU/EEA."
+        )
     if isinstance(exc, SearchClientError):
         return f"Search failed. {exc}"
     return f"Unexpected error: {exc.__class__.__name__}: {exc}"
@@ -96,6 +106,10 @@ def json_error_payload(exc: BaseException, *, command: str | None = None) -> tup
         return str(exc), "connection_error", log_path
     if isinstance(exc, SearchHTTPError):
         return str(exc), "http_error", log_path
+    if isinstance(exc, SearchRejectedError):
+        return str(exc), "rejected", log_path
+    if isinstance(exc, SearchParseError):
+        return str(exc), "parse_error", log_path
     if isinstance(exc, SearchClientError):
         return str(exc), "search_error", log_path
     return f"{exc.__class__.__name__}: {exc}", "unexpected_error", log_path
```

**File**: `fli/mcp/server.py` (modified, +86/-20)
```diff
@@ -43,6 +43,7 @@
     TripType,
 )
 from fli.search import SearchDates, SearchFlights
+from fli.search.dates import MAX_DATES_PER_SEARCH
 
 
 class FlightSearchConfig(BaseSettings):
@@ -109,6 +110,12 @@ async def health_check(_request: Request) -> JSONResponse:
 # Request/Response Models
 # =============================================================================
 
+# Filters the API surface still accepts but the current transport cannot
+# honour (see "Search transport" in README.md). Spelled out in every
+# parameter description because an LLM caller reads the tool schema, not the
+# README.
+_IGNORED_BY_TRANSPORT = "Currently ignored by the search-page transport (logged as a warning)."
+
 
 class FlightSearchParams(BaseModel):
     """Parameters for searching flights on a specific date."""
@@ -151,13 +158,23 @@ class FlightSearchParams(BaseModel):
     )
     infants_on_lap: int = Field(0, ge=0, description="Number of lap infants (under 2, no seat)")
     exclude_basic_economy: bool = Field(
-        False, description="Exclude basic economy fares from results"
+        False,
+        description=f"Exclude basic economy fares from results. {_IGNORED_BY_TRANSPORT}",
+    )
+    emissions: str = Field(
+        "ALL",
+        description=f"Filter by emissions level: ALL or LESS. {_IGNORED_BY_TRANSPORT}",
     )
-    emissions: str = Field("ALL", description="Filter by emissions level: ALL or LESS")
     checked_bags: int = Field(
-        0, ge=0, le=2, description="Number of checked bags to include in price (0, 1, or 2)"
+        0,
+        ge=0,
+        le=2,
+        description=f"Number of checked bags in price (0-2). {_IGNORED_BY_TRANSPORT}",
+    )
+    carry_on: bool = Field(
+        False,
+        description=f"Include carry-on bag fee in displayed price. {_IGNORED_BY_TRANSPORT}",
     )
-    carry_on: bool = Field(False, description="Include carry-on bag fee in displayed price")
     show_all_results: bool = Field(
         True, description="Return all available results instead of curated ~30"
     )
@@ -212,7 +229,12 @@ class DateSearchParams(BaseModel):
         description="Arrival airport IATA code(s), comma-separated for multiple (e.g., 'LHR,CDG')"
     )
     start_date: str = Field(description="Start of date range in YYYY-MM-DD format")
-    end_date: str = Field(description="End of date range in YYYY-MM-DD format")
+    end_date: str = Field(
+        description=(
+            "End of date range in YYYY-MM-DD format. A range may span at most "
+            f"{MAX_DATES_PER_SEARCH} dates; each date costs its own page fetch."
+        )
+    )
     trip_duration: int = Field(
         3, ge=1, description="Trip duration in days (for round-trip searches)"
     )
@@ -440,9 +462,11 @@ def _serialize_layover(layover: Any) -> dict[str, Any]:
 def _flight_extras(flight: Any) -> dict[str, Any]:
     """Surface optional rich fields when populated by the parser.
 
-    Emissions fields (``co2_emissions_g`` etc.) are deliberately omitted —
-    the ``--emissions LESS`` filter still flows through to Google, but
-    raw CO₂ numbers are not part of the tool's response shape.
+    Emissions fields (``co2_emissions_g`` etc.) are deliberately omitted:
+    raw CO₂ numbers are not part of the tool's response shape. Note the
+    ``emissions`` filter itself is currently ignored by the search-page
+    transport too — it has no ``tfs`` field — and the search logs a warning
+    naming it. See "Search transport" in README.md.
     """
     out: dict[str, Any] = {}
     for src, key in (
@@ -629,6 +653,28 @@ def _build_flight_filters(
     return filters, trip_type, origins, destinations
 
 
+def _search_error_message(exc: Exception, prefix: str = "Search failed") -> str:
+    """Render a search exception for an MCP response, with actionable hints.
+
+    `SearchParseError` means a page arrived that we could not read, which is
+    most often Google's regional consent interstitial. The CLI already points
+    at `FLI_SOCS_COOKIE` for that; an MCP caller has no log file to consult, so
+    it needs the hint in the response itself.
+    """
+    from fli.search.exceptions import SearchParseError
+
+    if isinstance(exc, SearchParseError):
+        return (
+            f"{prefix}: {exc} This is usually a transient page variant or a regional "
+            "consent interstitial — retry, or check FLI_SOCS_COOKIE if you are in the "
+            "EU/EEA."
+        )
+    # Everything else already carries its own actionable text —
+    # `SearchRejectedError` names the gated header and the issue, and the
+    # client's typed errors name the host and what to check.
+    return f"{prefix}: {exc}"
+
+
 def _execute_flight_search(params: FlightSearchParams) -> dict[str, Any]:
     """Execute a flight search and return formatted results."""
     try:
@@ -696,7 +742,7 @@ def _execute_flight_search(params: FlightSearchParams) -> dict[str, Any]:
     except ValidationError as e:
         return {"success": Fal
```

**File**: `fli/models/google_flights/base.py` (modified, +12/-1)
```diff
@@ -22,6 +22,17 @@
 from fli.models.airport import Airport
 
 
+def utc_today() -> date:
+    """Return today's date in UTC.
+
+    Every date check in this package reads the clock through this one
+    function, which gives tests a single seam: pinning ``utc_today`` freezes
+    validation's notion of "today" so fixtures captured from Google on a
+    fixed date keep working after that date has passed.
+    """
+    return datetime.now(timezone.utc).date()
+
+
 def earliest_searchable_date() -> date:
     """Return the earliest date that is still "today" somewhere on Earth.
 
@@ -38,7 +49,7 @@ def earliest_searchable_date() -> date:
     The cost is that a genuinely past date may reach Google, which simply
     returns no flights — a better failure than refusing a valid search.
     """
-    return datetime.now(timezone.utc).date() - timedelta(days=1)
+    return utc_today() - timedelta(days=1)
 
 
 class SeatType(Enum):
```

---

### Incident Patch 10: `0caa8b2f` (2026-09-20)
**Commit Message**: fix: decode per-leg amenity slots correctly (Wi-Fi, power, video, seat quality, cabin) (#244)

* fix: decode per-leg amenity slots correctly (#217)

`leg[12]` slot 1 is an in-seat-power flag, not Wi-Fi, and `leg[12][11]`
is a Wi-Fi *tier* code rather than a boolean, so the old decoder
reported Wi-Fi for every leg with a power outlet and never reported it
for legs that only publish the tier (e.g. every BA long-haul row).
`power` read slot 5, which only European/ULCC USB-only cabins ever set,
so mainline US carriers came back as `power=None`.

Verified by tabulating leg[12][0..11], leg[13], leg[14] and leg[16]
across ~280 distinct legs in the captured fixtures plus three live
public-page captures (business, premium economy, first):

  slots 1..6  power group, mutually exclusive across the whole corpus.
              1 = plug+USB (US majors), 3 = plug only (AA A319, UA 737),
              5 = USB only (BA/AF/LH/OS/LX short-haul, Sun Country).
  slots 8..10 video group, mutually exclusive. 8 = live TV (JetBlue,
              Delta domestic narrowbodies), 9 = on demand (widebodies,
              AA transcon A321neo), 10 = stream to device (Alaska, AA
              737/A321 Sharklets, re

**File**: `fli-js/src/models/google-flights/base.ts` (modified, +56/-0)
```diff
@@ -173,13 +173,64 @@ export const LayoverRestrictionsSchema = z.object({
 });
 export type LayoverRestrictions = z.infer<typeof LayoverRestrictionsSchema>;
 
+/** In-seat power flavour decoded from the leg[12] power slot group. */
+export const POWER_TYPES = ["plug_and_usb", "plug", "usb"] as const;
+export type PowerType = (typeof POWER_TYPES)[number];
+
+/** In-flight entertainment flavour decoded from the leg[12] video group. */
+export const VIDEO_TYPES = ["live_tv", "on_demand", "stream_to_device"] as const;
+export type VideoType = (typeof VIDEO_TYPES)[number];
+
+/** Whether Google flags the leg's Wi-Fi as complimentary or chargeable. */
+export const WIFI_TIERS = ["free", "paid"] as const;
+export type WifiTier = (typeof WIFI_TIERS)[number];
+
+/**
+ * Human-readable label for Google's leg[13] seat-quality code.
+ *
+ * These are labels, not an ordered score: "average"/"below_average"/
+ * "above_average" describe an economy-style pitch, while the remaining four
+ * name a seat *product*. The code tracks the fare's cabin rather than the
+ * airframe — in the captured fixtures AA 1209 (ORD-LAX, 737 MAX 8) appears
+ * twice, as "average" in economy and "recliner" in first.
+ */
+export const SEAT_QUALITIES = [
+  "average",
+  "below_average",
+  "above_average",
+  "extra_reclining",
+  "lie_flat",
+  "lie_flat_suite_with_door",
+  "recliner",
+] as const;
+export type SeatQuality = (typeof SEAT_QUALITIES)[number];
+
+/**
+ * Per-leg amenities reported by Google Flights. Booleans are tri-state
+ * (true / false / null when Google did not publish that signal).
+ *
+ * Google never publishes an explicit "no" for any of these amenities — the
+ * wire format only ever sets a flag or omits it — so `false` is always an
+ * inference and is used exactly once: `in_seat_video` is false when
+ * `video_type === "stream_to_device"`, which is Google's way of saying the
+ * aircraft has no seatback screen. Every other unknown stays null,
+ * including `usb_power` for a plug-only cabin and `on_demand_video` for a
+ * live-TV or stream-to-device leg.
+ */
 export const AmenitiesSchema = z.object({
   wifi: z.boolean().nullable().optional(),
   power: z.boolean().nullable().optional(),
   usb_power: z.boolean().nullable().optional(),
   in_seat_video: z.boolean().nullable().optional(),
   on_demand_video: z.boolean().nullable().optional(),
   legroom_rating: z.number().int().nonnegative().nullable().optional(),
+  // Optional detail — populated only for slot values confirmed against
+  // captured responses, so callers never see a confidently wrong label.
+  wifi_tier: z.enum(WIFI_TIERS).nullable().optional(),
+  power_type: z.enum(POWER_TYPES).nullable().optional(),
+  video_type: z.enum(VIDEO_TYPES).nullable().optional(),
+  seat_quality: z.enum(SEAT_QUALITIES).nullable().optional(),
+  legroom_inches: z.number().int().positive().nullable().optional(),
 });
 export type Amenities = z.infer<typeof AmenitiesSchema>;
 
@@ -210,6 +261,11 @@ export interface FlightLeg {
   amenities?: Amenities | null;
   overnight?: boolean;
   co2_emissions_g?: number | null;
+  /**
+   * Cabin actually flown on this leg, from leg[16]. Per-leg, so a business
+   * itinerary can still show an economy connecting leg.
+   */
+  cabin?: SeatType | null;
 }
 
 export interface BookingOption {
```

**File**: `fli-js/src/search/decoders.ts` (modified, +164/-11)
```diff
@@ -12,7 +12,12 @@ import type {
   FlightLeg,
   FlightResult,
   Layover,
+  PowerType,
+  SeatQuality,
+  VideoType,
+  WifiTier,
 } from "../models/google-flights/base.ts";
+import { SeatType } from "../models/google-flights/base.ts";
 import { asBool, asInt, asNonNegativeInt, asStr, safeGet } from "./helpers.ts";
 
 // Pseudo-codes Google emits in place of a real IATA carrier identifier.
@@ -71,25 +76,171 @@ function safeAirline(code: unknown): Airline | null {
   return null;
 }
 
-function parseAmenities(slots: unknown, seatQuality: unknown = null): Amenities | null {
-  const wifi = asBool(safeGet(slots, 1));
-  const power = asBool(safeGet(slots, 5));
-  const onDemandVideo = asBool(safeGet(slots, 9));
+// --- leg[12] amenity slot map (issue #217) --------------------------------
+//
+// leg[12] is a sparse array of amenity flags with trailing nulls trimmed.
+// Two mutually-exclusive groups plus a Wi-Fi tier code were confirmed by
+// tabulating all 481 leg instances across the captured fixtures (plus
+// three live public-page captures) against published fleet facts:
+//
+//   slots 1..6  power group — exactly one is ever set on a leg.
+//   slots 8..10 video group — exactly one is ever set on a leg.
+//   slot 11     Wi-Fi tier code (a number, never a bool).
+//
+// Slots 2, 4 and 6 are reported to be "some seats only" variants of 1, 3
+// and 5, and slot 11 === 1 is reported to mean "Wi-Fi, tier unknown", but
+// none of those values occurs anywhere in the corpus. Nothing is inferred
+// from them: an unobserved slot yields null, never a guessed value.
+//
+// No slot in the corpus ever holds JSON `false`, so every `false` this
+// decoder emits is an inference. Only one is made — see `inSeatVideo` in
+// parseAmenities.
+
+/** Power slots whose flavour is confirmed. */
+const POWER_SLOTS: ReadonlyMap<number, PowerType> = new Map<number, PowerType>([
+  [1, "plug_and_usb"],
+  [3, "plug"],
+  [5, "usb"],
+]);
+/**
+ * Every index in the power group, scanned in wire order. Includes the
+ * unobserved 2/4/6 "some seats" variants deliberately: the first *set* slot
+ * wins even when it is one we cannot label, so a payload that ever does set
+ * one yields "unknown" rather than skipping ahead to a slot we can name and
+ * reporting something Google did not say.
+ */
+const POWER_GROUP: readonly number[] = [1, 2, 3, 4, 5, 6];
+/** Video slots, in wire order. */
+const VIDEO_SLOTS: ReadonlyMap<number, VideoType> = new Map<number, VideoType>([
+  [8, "live_tv"],
+  [9, "on_demand"],
+  [10, "stream_to_device"],
+]);
+const VIDEO_GROUP: readonly number[] = [8, 9, 10];
+/** Video products delivered on a seatback screen rather than to a phone. */
+const SEATBACK_VIDEO: ReadonlySet<VideoType> = new Set<VideoType>(["live_tv", "on_demand"]);
+/** Position of the Wi-Fi tier code within leg[12]. */
+const WIFI_TIER_SLOT = 11;
+/** Confirmed Wi-Fi tier codes. */
+const WIFI_TIERS_BY_CODE: ReadonlyMap<number, WifiTier> = new Map<number, WifiTier>([
+  [2, "free"],
+  [3, "paid"],
+]);
+/**
+ * Confirmed leg[13] seat-quality codes. Code 9 ("angled flat") is reported
+ * but unobserved, so it deliberately has no label here.
+ */
+const SEAT_QUALITY_BY_CODE: ReadonlyMap<number, SeatQuality> = new Map<number, SeatQuality>([
+  [1, "average"],
+  [2, "below_average"],
+  [3, "above_average"],
+  [4, "extra_reclining"],
+  [5, "lie_flat"],
+  [6, "lie_flat_suite_with_door"],
+  [8, "recliner"],
+]);
+
+/**
+ * True when slots[index] is a set flag. Google's RPC payload encodes these
+ * as JSON booleans while the public travel page encodes them as 1; accept
+ * both and treat every other value (including 0, non-integers and strings)
+ * as unset. The integer check keeps this identical to Python's
+ * `isinstance(value, int)`, which rejects floats such as 1.5.
+ */
+function slotOn(slots: unknown, index: number): boolean {
+  const value = safeGet(slots, index);
+  if (typeof value === "boolean") return value;
+  return typeof value === "number" && Number.isInteger(value) && value > 0;
+}
+
+/** Index of the first set slot in `group` (wire order), else null. */
+function firstSetSlot(slots: unknown, group: readonly number[]): number | null {
+  for (const index of group) {
+    if (slotOn(slots, index)) return index;
+  }
+  return null;
+}
+
+/** Pull the integer seat pitch out of "31 in" / "31 inches". */
+function parseLegroomInches(text: unknown): number | null {
+  if (typeof text !== "string") return null;
+  const head = text.split(" ", 1)[0];
+  if (head == null || !/^\d+$/.test(head)) return null;
+  const inches = Number.parseInt(head, 10);
+  return inches > 0 ? inches : null;
+}
+
+function parseAmenities(
+  slots: unknown,
+  seatQuality: unknown = null,
+  legroom: unknown = null,
+): Amenities | null {
+  // Only a slot whose meaning the corpus confirms may set `power`; an
+  // unlabelled slot (2/4/6, never observed) leaves every power field
+  // unknown rather than asserting "there is power, flavour 
```

**File**: `fli-js/tests/search/amenities_decoding.test.ts` (added, +435/-0)
```diff
@@ -0,0 +1,435 @@
+import { describe, expect, test } from "bun:test";
+import { readFileSync } from "node:fs";
+import type { FlightLeg, FlightResult } from "../../src/models/google-flights/base.ts";
+import { SeatType } from "../../src/models/google-flights/base.ts";
+import { parseFlightRow } from "../../src/search/decoders.ts";
+
+/**
+ * Mirror of tests/search/test_amenities_decoding.py (issue #217).
+ *
+ * Every expectation is pinned to a named flight in a captured Google
+ * Flights response. The slot mapping was verified by tabulating
+ * leg[12][0..11], leg[13], leg[14] and leg[16] across ~280 distinct legs:
+ * slots 1..6 are a mutually-exclusive power group, slots 8..10 a
+ * mutually-exclusive video group, and slot 11 a Wi-Fi tier code.
+ */
+
+function load(name: string): FlightResult[] {
+  const fixture = readFileSync(
+    new URL(`../../../tests/search/fixtures/${name}`, import.meta.url),
+    "utf8",
+  );
+  const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+  const inner = JSON.parse(outer[0][2]);
+  const rows: unknown[][] = [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+  const flights: FlightResult[] = [];
+  for (const row of rows) {
+    try {
+      flights.push(parseFlightRow(row));
+    } catch {
+      // Malformed / sponsor rows are skipped, same as the Python replay.
+    }
+  }
+  return flights;
+}
+
+function rawLegs(name: string): unknown[][] {
+  const fixture = readFileSync(
+    new URL(`../../../tests/search/fixtures/${name}`, import.meta.url),
+    "utf8",
+  );
+  const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+  const inner = JSON.parse(outer[0][2]);
+  const rows: unknown[][] = [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+  return rows.flatMap((row) => ((row[0] as unknown[])[2] as unknown[][]) ?? []);
+}
+
+function leg(flights: FlightResult[], carrier: string, number: string): FlightLeg {
+  for (const flight of flights) {
+    for (const l of flight.legs) {
+      if (l.airline === carrier && l.flight_number === number) return l;
+    }
+  }
+  throw new Error(`${carrier}${number} not found in fixture`);
+}
+
+function rawRows(name: string): unknown[][] {
+  const fixture = readFileSync(
+    new URL(`../../../tests/search/fixtures/${name}`, import.meta.url),
+    "utf8",
+  );
+  const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+  const inner = JSON.parse(outer[0][2]);
+  return [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+}
+
+/**
+ * Parse a real fixture row with leg[12]/[13]/[14] overridden. Cloning a
+ * genuine row keeps every other position realistic. Mirrors
+ * `_synthetic_leg` in tests/search/test_amenities_decoding.py.
+ */
+function syntheticLeg(
+  slots: unknown = null,
+  seatQuality: unknown = 1,
+  legroom: unknown = "31 in",
+): FlightLeg {
+  const row = structuredClone(rawRows("flight_search_jfk_lax_oneway_usd.bin")[0]) as unknown[];
+  const l = ((row[0] as unknown[])[2] as unknown[][])[0] as unknown[];
+  l[12] = slots;
+  l[13] = seatQuality;
+  l[14] = legroom;
+  l[30] = null; // isolate leg[14] from the long-form fallback
+  return parseFlightRow(row).legs[0] as FlightLeg;
+}
+
+function emptySlots(): unknown[] {
+  return Array.from({ length: 12 }, () => null);
+}
+
+const FIXTURES = [
+  "flight_search_jfk_lax_oneway_usd.bin",
+  "flight_search_jfk_lax_eur.bin",
+  "flight_search_jfk_lax_exclude_dl.bin",
+  "flight_search_jfk_fra_oneworld.bin",
+  "flight_search_buf_ath_min_layover_120.bin",
+  "flight_search_lax_lhr_rt_biz_2a1c.bin",
+];
+
+const jfkLax = load("flight_search_jfk_lax_oneway_usd.bin");
+const jfkFra = load("flight_search_jfk_fra_oneworld.bin");
+const bufAth = load("flight_search_buf_ath_min_layover_120.bin");
+const jfkLaxNoDl = load("flight_search_jfk_lax_exclude_dl.bin");
+const laxLhrBiz = load("flight_search_lax_lhr_rt_biz_2a1c.bin");
+
+describe("wifi tier (leg[12][11])", () => {
+  test("JetBlue reports free Wi-Fi", () => {
+    const l = leg(jfkLax, "B6", "123");
+    expect(l.amenities?.wifi).toBe(true);
+    expect(l.amenities?.wifi_tier).toBe("free");
+  });
+
+  test("Delta transcon reports free Wi-Fi", () => {
+    const l = leg(jfkLax, "DL", "707");
+    expect(l.amenities?.wifi).toBe(true);
+    expect(l.amenities?.wifi_tier).toBe("free");
+  });
+
+  test("American widebody reports paid Wi-Fi", () => {
+    const l = leg(jfkLax, "AA", "255");
+    expect(l.amenities?.wifi_tier).toBe("paid");
+  });
+
+  test("British Airways reports paid Wi-Fi", () => {
+    expect(leg(jfkFra, "BA", "178").amenities?.wifi_tier).toBe("paid");
+  });
+
+  test("Wi-Fi unknown when the tier slot is absent", () => {
+    const l = leg(jfkFra, "BA", "904");
+    expect(l.amenities?.wifi).toBeNull();
+    expect(l.amenities?.wifi_tier).toBeNull();
+  });
+
+  test("Wi-Fi is not read from the power slot", () => {
+    const l = leg(jfkFra, "BA", "902");
+    expect(l.amenities?.power_type).toBe("usb");
+    expect(
```

**File**: `fli/cli/utils.py` (modified, +3/-0)
```diff
@@ -199,6 +199,9 @@ def serialize_flight_leg(leg: Any) -> dict[str, Any]:
         payload["aircraft"] = leg.aircraft
     if getattr(leg, "legroom", None):
         payload["legroom"] = leg.legroom
+    cabin_name = getattr(getattr(leg, "cabin", None), "name", None)
+    if isinstance(cabin_name, str):
+        payload["cabin"] = cabin_name
     if getattr(leg, "overnight", False):
         payload["overnight"] = True
     if getattr(leg, "operating_airline", None) is not None:
```

**File**: `fli/mcp/server.py` (modified, +6/-0)
```diff
@@ -409,6 +409,12 @@ def _serialize_flight_leg(leg: Any) -> dict[str, Any]:
         out["aircraft"] = leg.aircraft
     if getattr(leg, "legroom", None):
         out["legroom"] = leg.legroom
+    cabin_name = getattr(getattr(leg, "cabin", None), "name", None)
+    if isinstance(cabin_name, str):
+        # Report the SeatType member name (ECONOMY / BUSINESS / ...) so it
+        # matches the `cabin_class` tool parameter rather than Google's
+        # numeric code.
+        out["cabin"] = cabin_name
     if getattr(leg, "overnight", False):
         out["overnight"] = True
     amenities = getattr(leg, "amenities", None)
```

**File**: `fli/models/__init__.py` (modified, +8/-0)
```diff
@@ -16,11 +16,15 @@
     LayoverRestrictions,
     MaxStops,
     PassengerInfo,
+    PowerType,
     PriceLimit,
+    SeatQuality,
     SeatType,
     SortBy,
     TimeRestrictions,
     TripType,
+    VideoType,
+    WifiTier,
 )
 from .names import display_name
 
@@ -43,9 +47,13 @@
     "LayoverRestrictions",
     "MaxStops",
     "PassengerInfo",
+    "PowerType",
     "PriceLimit",
+    "SeatQuality",
     "SeatType",
     "SortBy",
     "TimeRestrictions",
     "TripType",
+    "VideoType",
+    "WifiTier",
 ]
```

**File**: `fli/models/google_flights/__init__.py` (modified, +8/-0)
```diff
@@ -12,11 +12,15 @@
     LayoverRestrictions,
     MaxStops,
     PassengerInfo,
+    PowerType,
     PriceLimit,
+    SeatQuality,
     SeatType,
     SortBy,
     TimeRestrictions,
     TripType,
+    VideoType,
+    WifiTier,
 )
 from .dates import DateSearchFilters
 from .flights import FlightSearchFilters
@@ -39,9 +43,13 @@
     "LayoverRestrictions",
     "MaxStops",
     "PassengerInfo",
+    "PowerType",
     "PriceLimit",
+    "SeatQuality",
     "SeatType",
     "SortBy",
     "TimeRestrictions",
     "TripType",
+    "VideoType",
+    "WifiTier",
 ]
```

**File**: `fli/models/google_flights/base.py` (modified, +56/-1)
```diff
@@ -6,6 +6,7 @@
 
 from datetime import date, datetime, timedelta, timezone
 from enum import Enum
+from typing import Literal
 
 from pydantic import (
     BaseModel,
@@ -258,13 +259,55 @@ class LayoverRestrictions(BaseModel):
     max_duration: PositiveInt | None = None
 
 
+#: In-seat power flavour decoded from the ``leg[12]`` power slot group.
+PowerType = Literal["plug_and_usb", "plug", "usb"]
+
+#: In-flight entertainment flavour decoded from the ``leg[12]`` video group.
+VideoType = Literal["live_tv", "on_demand", "stream_to_device"]
+
+#: Whether Google flags the leg's Wi-Fi as complimentary or chargeable.
+WifiTier = Literal["free", "paid"]
+
+#: Human-readable label for Google's ``leg[13]`` seat-quality code.
+#:
+#: These are labels, not an ordered score: "average"/"below_average"/
+#: "above_average" describe an economy-style pitch, while the remaining
+#: four name a seat *product*. The code tracks the fare's cabin rather
+#: than the airframe — in the captured fixtures AA 1209 (ORD-LAX, 737
+#: MAX 8) appears twice, as "average" in economy and "recliner" in first.
+SeatQuality = Literal[
+    "average",
+    "below_average",
+    "above_average",
+    "extra_reclining",
+    "lie_flat",
+    "lie_flat_suite_with_door",
+    "recliner",
+]
+
+
 class Amenities(BaseModel):
     """Per-leg amenities reported by Google Flights.
 
     Boolean fields are tri-state (`True`, `False`, or `None` when Google did
     not publish that signal). ``legroom_rating`` is Google's seat-quality
     code from ``leg[13]``, or ``None`` when unavailable; it is not an ordered
-    numeric score or the Wi-Fi tier.
+    numeric score or the Wi-Fi tier. ``seat_quality`` is the decoded label
+    for that same code and is ``None`` for codes we have not confirmed.
+
+    The optional detail fields (``wifi_tier``, ``power_type``,
+    ``video_type``, ``seat_quality``, ``legroom_inches``) refine the
+    booleans above rather than replacing them: e.g. ``power=True`` plus
+    ``power_type="usb"`` means "charging available, USB only".
+
+    Google never publishes an explicit "no" for any of these amenities —
+    the wire format only ever sets a flag or omits it — so ``False`` is
+    always an inference and is used exactly once: ``in_seat_video`` is
+    ``False`` when ``video_type == "stream_to_device"``, which is
+    Google's way of saying the aircraft has no seatback screen. Every
+    other unknown stays ``None``, including ``usb_power`` for a
+    plug-only cabin and ``on_demand_video`` for a live-TV or
+    stream-to-device leg.
     """
 
     wifi: bool | None = None
@@ -274,6 +317,15 @@ class Amenities(BaseModel):
     on_demand_video: bool | None = None
     legroom_rating: NonNegativeInt | None = None
 
+    # Optional detail — populated only for slot values confirmed against
+    # captured responses; left None when Google publishes a code we have
+    # not verified, so callers never see a confidently wrong label.
+    wifi_tier: WifiTier | None = None
+    power_type: PowerType | None = None
+    video_type: VideoType | None = None
+    seat_quality: SeatQuality | None = None
+    legroom_inches: PositiveInt | None = None
+
 
 class Layover(BaseModel):
     """Layover info between two flight legs.
@@ -320,6 +372,9 @@ class FlightLeg(BaseModel):
     amenities: Amenities | None = None
     overnight: bool = False
     co2_emissions_g: NonNegativeInt | None = None
+    #: Cabin actually flown on this leg, from ``leg[16]``. Per-leg, so a
+    #: business itinerary can still show an economy connecting leg.
+    cabin: SeatType | None = None
 
 
 class BookingOption(BaseModel):
```

---

### Incident Patch 11: `8df436a1` (2026-09-20)
**Commit Message**: fix(data): W4 is Wizz Air, not the defunct LC Péru (#241)

IATA reassigned W4 after LC Péru ceased operations in 2019, so Wizz Air
flights were labelled "LC Péru". Fix data/airlines.csv and regenerate the
Python and TypeScript enums (one data line each). The CSV already names W6 and
W9 "Wizz Air"; the generator's uniqueness suffix keeps the three members
distinct while `display_name` shows users the plain name.

Part of #127 (the price=0 half of that issue is separate).

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `data/airlines.csv` (modified, +1/-1)
```diff
@@ -746,7 +746,7 @@ VZ,Thai Vietjet Air
 W1,WorldTicket
 W2,Flexflight
 W3,Arik Air
-W4,LC Péru
+W4,Wizz Air
 W5,Mahan Airlines
 W6,Wizz Air
 W7,Sayakhat Airlines
```

**File**: `fli-js/src/models/airline.ts` (modified, +1/-1)
```diff
@@ -752,7 +752,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   W1: "WorldTicket",
   W2: "Flexflight",
   W3: "Arik Air",
-  W4: "LC Péru",
+  W4: "Wizz Air (W4)",
   W5: "Mahan Airlines",
   W6: "Wizz Air (W6)",
   W7: "Sayakhat Airlines",
```

**File**: `fli/models/airline.py` (modified, +1/-1)
```diff
@@ -763,7 +763,7 @@
     "W1": "WorldTicket",
     "W2": "Flexflight",
     "W3": "Arik Air",
-    "W4": "LC Péru",
+    "W4": "Wizz Air (W4)",
     "W5": "Mahan Airlines",
     "W6": "Wizz Air (W6)",
     "W7": "Sayakhat Airlines",
```

**File**: `tests/models/test_enum_uniqueness.py` (modified, +7/-0)
```diff
@@ -45,3 +45,10 @@ class TestAirlineNoAliases:
 
     def test_no_aliases(self):
         assert len(Airline.__members__) == len(list(Airline))
+
+
+def test_w4_is_wizz_air():
+    """IATA reassigned W4 from the defunct LC Péru to Wizz Air (issue #127)."""
+    from fli.models import Airline, display_name
+
+    assert display_name(Airline.W4) == "Wizz Air"
```

---

### Incident Patch 12: `6957822a` (2026-09-20)
**Commit Message**: fix: make every Airport/Airline enum member distinct (OKA, NTL, TRI no longer alias other airports) (#160)

* fix: disambiguate duplicate Airport/Airline enum names

Python's Enum treats members with the same value as aliases — the second
silently becomes an alias for the first. 44 groups of airports share
identical names (e.g., both PSC and TRI had value "Tri-Cities Airport"),
causing Airport.TRI to resolve to Airport.PSC.

Add _disambiguate_names() to the generation script that detects duplicate
names and appends (IATA_CODE) to disambiguate. Unique names are untouched.

Fixes #131
Fixes #146

* fix: apply ruff format to generate_enums.py

* fix(scripts): assert Airport/Airline codes and names stay unique

PR #160 added _disambiguate_names() to generate_enums.py but nothing
enforced that the result was actually collision-free, so a future CSV
change (duplicate code after sanitization, or a duplicate row) could
silently reintroduce Python Enum aliasing. Add _assert_unique(), run
for both Airport and Airline right after disambiguation, raising a
ValueError naming the offending codes/names instead of writing a
broken enum module.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>



**File**: `fli-js/scripts/generate-enums.ts` (modified, +63/-2)
```diff
@@ -79,6 +79,61 @@ function toKey(code: string): string {
   return /^[0-9]/.test(code) ? `_${code}` : code;
 }
 
+/**
+ * Append IATA codes to duplicate names so every emitted name is unique.
+ *
+ * Mirrors Python's `_disambiguate_names` in `scripts/generate_enums.py`.
+ * The TS `Airport`/`Airline` "enums" are keyed by code (`Airport.JFK ===
+ * "JFK"`) so they can't collide the way Python's value-keyed `Enum` can —
+ * but `AIRPORT_NAMES`/`AIRLINE_NAMES` are still display names shown to
+ * users, and those must match the Python package's output exactly.
+ * Entries with unique names are left untouched.
+ */
+function disambiguateNames(rows: Array<[string, string]>): Array<[string, string]> {
+  const counts = new Map<string, number>();
+  for (const [, name] of rows) counts.set(name, (counts.get(name) ?? 0) + 1);
+  const duplicates = new Set([...counts.entries()].filter(([, c]) => c > 1).map(([name]) => name));
+  if (duplicates.size === 0) return rows;
+  return rows.map(([code, name]) => [code, duplicates.has(name) ? `${name} (${code})` : name]);
+}
+
+/**
+ * Throw if any sanitized key or final name repeats.
+ *
+ * Mirrors Python's `_assert_unique`. Must run after {@link disambiguateNames}
+ * so it validates exactly what {@link renderEnum} is about to emit as object
+ * literal keys (duplicate sanitized codes) and `AIRPORT_NAMES`/`AIRLINE_NAMES`
+ * values (duplicate names).
+ */
+function assertUnique(rows: Array<[string, string]>, typeName: string): void {
+  const keyCounts = new Map<string, number>();
+  for (const [code] of rows) {
+    const key = toKey(code);
+    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
+  }
+  const dupKeys = [...keyCounts.entries()]
+    .filter(([, c]) => c > 1)
+    .map(([key]) => key)
+    .sort();
+  if (dupKeys.length > 0) {
+    throw new Error(
+      `Duplicate sanitized ${typeName} codes after sanitization: ${dupKeys.join(", ")}`,
+    );
+  }
+
+  const nameCounts = new Map<string, number>();
+  for (const [, name] of rows) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
+  const dupNames = [...nameCounts.entries()]
+    .filter(([, c]) => c > 1)
+    .map(([name]) => name)
+    .sort();
+  if (dupNames.length > 0) {
+    throw new Error(
+      `Duplicate ${typeName} names remain after disambiguation: ${dupNames.join(", ")}`,
+    );
+  }
+}
+
 function escapeStringLiteral(s: string): string {
   return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
 }
@@ -134,6 +189,12 @@ const allianceRows: Array<[string, string]> = [
 
 const allAirlines = [...airlines, ...allianceRows];
 
+const disambiguatedAirports = disambiguateNames(airports);
+assertUnique(disambiguatedAirports, "Airport");
+
+const disambiguatedAirlines = disambiguateNames(allAirlines);
+assertUnique(disambiguatedAirlines, "Airline");
+
 const airportFile = renderEnum(
   "Airport",
   "AIRPORT_NAMES",
@@ -142,7 +203,7 @@ const airportFile = renderEnum(
  *
  * Auto-generated from data/airports.csv — run \`bun run generate:enums\` to refresh.
  */`,
-  airports,
+  disambiguatedAirports,
 );
 
 const airlineFile = renderEnum(
@@ -153,7 +214,7 @@ const airlineFile = renderEnum(
  *
  * Auto-generated from data/airlines.csv — run \`bun run generate:enums\` to refresh.
  */`,
-  allAirlines,
+  disambiguatedAirlines,
 );
 
 writeFileSync(join(outDir, "airport.ts"), airportFile);
```

**File**: `fli-js/src/core/airports.ts` (modified, +18/-6)
```diff
@@ -82,6 +82,17 @@ for (const [city, codes] of Object.entries(CITY_AIRPORTS)) {
   }
 }
 
+/**
+ * Strip the internal " (CODE)" suffix that keeps duplicate names unique in
+ * AIRPORT_NAMES. The code is always returned separately, so users should see
+ * the plain name (mirrors Python's `fli.models.display_name`).
+ */
+export function airportDisplayName(code: string): string {
+  const name = AIRPORT_NAMES[code as Airport] ?? code;
+  const suffix = ` (${code})`;
+  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
+}
+
 /**
  * Search airports by city name, airport name, or IATA code.
  *
@@ -148,25 +159,26 @@ export function searchAirports(query: string, limit = 10): AirportMatch[] {
   }
 
   // 4. Airport name substring match (position-weighted score)
-  for (const [code, name] of Object.entries(AIRPORT_NAMES)) {
+  for (const code of Object.keys(AIRPORT_NAMES)) {
     if (seen.has(code)) continue;
-    const nameLower = name.toLowerCase();
-    const pos = nameLower.indexOf(queryLower);
+    // Match on the name users see, not the internal " (CODE)" suffix.
+    const displayName = airportDisplayName(code);
+    const pos = displayName.toLowerCase().indexOf(queryLower);
     if (pos !== -1) {
       const score = 70.0 - pos * 0.1;
-      results.push({ code: code as Airport, name, match_type: "name", score });
+      results.push({ code: code as Airport, name: displayName, match_type: "name", score });
       seen.add(code);
     }
   }
 
   // 5. IATA prefix match (≤3-char query)
   if (queryUpper.length <= 3) {
-    for (const [code, name] of Object.entries(AIRPORT_NAMES)) {
+    for (const code of Object.keys(AIRPORT_NAMES)) {
       if (seen.has(code)) continue;
       if (code.startsWith(queryUpper)) {
         results.push({
           code: code as Airport,
-          name,
+          name: airportDisplayName(code),
           match_type: "iata_prefix",
           score: 60.0,
         });
```

**File**: `fli-js/src/models/airline.ts` (modified, +12/-12)
```diff
@@ -129,7 +129,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   DH: "Douniah Airlines",
   DI: "Norwegian Air UK",
   DJ: "AirAsia Japan",
-  DK: "Thomas Cook Airlines",
+  DK: "Thomas Cook Airlines (DK)",
   DL: "Delta Air Lines",
   DM: "Arajet",
   DN: "Norwegian Air Argentina",
@@ -435,14 +435,14 @@ export const AIRLINE_NAMES: Record<string, string> = {
   MQ: "Envoy Air",
   MR: "Hunnu Air",
   MS: "EgyptAir",
-  MT: "Thomas Cook Airlines",
+  MT: "Thomas Cook Airlines (MT)",
   MU: "China Eastern Airlines",
   MV: "Air Mediterranean",
   MW: "Mokulele Airlines",
   MX: "Breeze Airways",
   MY: "MASwings",
   MZ: "Amakusa Airlines",
-  N0: "Norse Atlantic Airways",
+  N0: "Norse Atlantic Airways (N0)",
   N2: "Dagestan Airlines",
   N3: "Aerolineas Mas",
   N4: "Nord Wind",
@@ -511,7 +511,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   P1: "Publiccharters Com",
   P2: "Airkenya Express",
   P3: "CargoLogicAir",
-  P4: "Aerolineas Sosa",
+  P4: "Aerolineas Sosa (P4)",
   P5: "Copa Airlines Colombia",
   P6: "Pascan Aviation",
   P8: "SprintAir",
@@ -610,7 +610,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   RX: "Regent Airways",
   RY: "Jiangxi Air",
   RZ: "SANSA Airlines",
-  S0: "Aerolineas Sosa",
+  S0: "Aerolineas Sosa (S0)",
   S1: "Lufthansa Systems",
   S2: "Jet Lite",
   S3: "SBA Airlines",
@@ -754,10 +754,10 @@ export const AIRLINE_NAMES: Record<string, string> = {
   W3: "Arik Air",
   W4: "LC Péru",
   W5: "Mahan Airlines",
-  W6: "Wizz Air",
+  W6: "Wizz Air (W6)",
   W7: "Sayakhat Airlines",
   W8: "Caribbean Winds Airlines",
-  W9: "Wizz Air",
+  W9: "Wizz Air (W9)",
   WA: "KLM Cityhopper",
   WB: "Rwandair",
   WC: "Islena Airlines",
@@ -788,7 +788,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   X3: "TUIfly",
   X4: "Air Excursions",
   X6: "Airlines Reporting Corp",
-  X7: "Challenge Aero",
+  X7: "Challenge Aero (X7)",
   X9: "Avion Express",
   XB: "IATA",
   XC: "Corendon Airlines",
@@ -846,7 +846,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   YW: "Air Nostrum",
   YX: "Republic Airline",
   YZ: "Alas Uruguay",
-  Z0: "Norse Atlantic Airways",
+  Z0: "Norse Atlantic Airways (Z0)",
   Z2: "AirAsia Zest",
   Z3: "PM Air",
   Z4: "Zagrosjet",
@@ -905,11 +905,11 @@ export const AIRLINE_NAMES: Record<string, string> = {
   _1P: "Travelport Worldspan",
   _1Q: "Joint Stock Company Ital",
   _1R: "Bird Information Systems",
-  _1S: "Sabre",
+  _1S: "Sabre (1S)",
   _1T: "East Line",
   _1U: "ITA Software",
   _1V: "Galileo International",
-  _1W: "Sabre",
+  _1W: "Sabre (1W)",
   _1X: "Branson Air Express",
   _1Y: "Electronic Data Systems (EDS)",
   _1Z: "Fantasia Info Network",
@@ -989,7 +989,7 @@ export const AIRLINE_NAMES: Record<string, string> = {
   _4Y: "Discover Airlines",
   _4Z: "Airlink",
   _5B: "Bassaka Air",
-  _5C: "Challenge Aero",
+  _5C: "Challenge Aero (5C)",
   _5D: "Aeroméxico Connect",
   _5E: "Aero",
   _5F: "Fly One",
```

**File**: `fli-js/src/models/airport.ts` (modified, +92/-92)
```diff
@@ -161,7 +161,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   AHU: "Cherif Al Idrissi Airport",
   AHZ: "L'alpe D'huez Airport",
   AIA: "Alliance Municipal Airport",
-  AID: "Anderson Regional Airport",
+  AID: "Anderson Regional Airport (AID)",
   AIE: "Aiome Airport",
   AIF: "Marcelo Pires Halzhausen Airport",
   AIG: "Yalinga Airport",
@@ -184,7 +184,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   AJL: "Lengpui Airport",
   AJN: "Ouani Airport",
   AJR: "Arvidsjaur Airport",
-  AJU: "Santa Maria Airport",
+  AJU: "Santa Maria Airport (AJU)",
   AJY: "Mano Dayak International Airport",
   AKA: "Ankang Airport",
   AKB: "Atka Airport",
@@ -251,7 +251,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   AMZ: "Ardmore Airport",
   ANB: "Anniston Regional Airport",
   ANC: "Ted Stevens Anchorage International Airport",
-  AND: "Anderson Regional Airport",
+  AND: "Anderson Regional Airport (AND)",
   ANE: "Angers-Loire Airport",
   ANF: "Cerro Moreno Airport",
   ANG: "Angouleme-Brie-Champniers Airport",
@@ -636,7 +636,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   BHP: "Bhojpur Airport",
   BHQ: "Broken Hill Airport",
   BHR: "Bharatpur Airport",
-  BHS: "Bathurst Airport",
+  BHS: "Bathurst Airport (BHS)",
   BHU: "Bhavnagar Airport",
   BHV: "Bahawalpur Airport",
   BHW: "Bhagatanwala Airport",
@@ -818,7 +818,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   BQL: "Boulia Airport",
   BQN: "Rafael Hernandez Airport",
   BQO: "Bouna Airport",
-  BQQ: "Barra Airport",
+  BQQ: "Barra Airport (BQQ)",
   BQS: "Ignatyevo Airport",
   BQT: "Brest Airport",
   BQU: "J F Mitchell Airport",
@@ -835,7 +835,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   BRN: "Bern Belp Airport",
   BRO: "Brownsville/South Padre Island International Airport",
   BRQ: "Brno-Turany Airport",
-  BRR: "Barra Airport",
+  BRR: "Barra Airport (BRR)",
   BRS: "Bristol International Airport",
   BRT: "Bathurst Island Airport",
   BRU: "Brussels Airport",
@@ -844,14 +844,14 @@ export const AIRPORT_NAMES: Record<string, string> = {
   BRY: "Samuels Field",
   BSA: "Bosaso Airport",
   BSB: "Presidente Juscelino Kubistschek International Airport",
-  BSC: "Jose Celestino Mutis Airport",
+  BSC: "Jose Celestino Mutis Airport (BSC)",
   BSD: "Baoshan Yunduan Airport",
   BSE: "Sematan Airport",
   BSF: "Bradshaw Army Airfield",
   BSG: "Bata Airport",
   BSJ: "Bairnsdale Airport",
   BSK: "Biskra Airport",
-  BSL: "EuroAirport Basel-Mulhouse-Freiburg Airport",
+  BSL: "EuroAirport Basel-Mulhouse-Freiburg Airport (BSL)",
   BSM: "Bishe Kola Air Base",
   BSN: "Bossangoa Airport",
   BSO: "Basco Airport",
@@ -946,7 +946,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   BWQ: "Brewarrina Airport",
   BWT: "Wynyard Airport",
   BWU: "Sydney Bankstown Airport",
-  BWW: "Las Brujas Airport",
+  BWW: "Las Brujas Airport (BWW)",
   BXA: "George R Carr Memorial Air Field",
   BXB: "Babo Airport",
   BXD: "Bade Airport",
@@ -983,7 +983,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   BYT: "Bantry Aerodrome",
   BYU: "Bayreuth Airport",
   BYW: "Blakely Island Airport",
-  BZA: "San Pedro Airport",
+  BZA: "San Pedro Airport (BZA)",
   BZC: "Umberto Modiano Airport",
   BZD: "Balranald Airport",
   BZE: "Philip S. W. Goldson International Airport",
@@ -1248,7 +1248,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   CLR: "Cliff Hatfield Memorial Airport",
   CLS: "Chehalis-Centralia Airport",
   CLT: "Charlotte/Douglas International Airport",
-  CLU: "Columbus Municipal Airport",
+  CLU: "Columbus Municipal Airport (CLU)",
   CLV: "Caldas Novas Airport",
   CLW: "Clearwater Executive Airport",
   CLX: "Clorinda Airport",
@@ -1352,7 +1352,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   CQW: "Wulong Chongqing Xiannvshan Airport",
   CRA: "Craiova Airport",
   CRB: "Collarenebri Airport",
-  CRC: "Santa Ana Airport",
+  CRC: "Santa Ana Airport (CRC)",
   CRD: "General E. Mosconi Airport",
   CRE: "Grand Strand Airport",
   CRF: "Carnot Airport",
@@ -1429,7 +1429,7 @@ export const AIRPORT_NAMES: Record<string, string> = {
   CUP: "General Francisco Bermudez Airport",
   CUQ: "Coen Airport",
   CUR: "Hato International Airport",
-  CUS: "Columbus Municipal Airport",
+  CUS: "Columbus Municipal Airport (CUS)",
   CUT: "Cutral-Co Airport",
   CUU: "General Roberto Fierro Villalobos International Airport",
   CUV: "Casigua El Cubo Airport",
@@ -1501,15 +1501,15 @@ export const AIRPORT_NAMES: Record<string, string> = {
   CZO: "Chistochina Airport",
   CZS: "Cruzeiro do Sul Airport",
   CZT: "Dimmit County Airport",
-  CZU: "Las Brujas Airport",
+  CZU: "Las Brujas Airport (CZU)",
   CZX: "Changzhou Airport",
   CZY: "Cluny Airport",
   DAA: "Davison Army Air Field",
   DAB: "Daytona Beach International Airport",
   DAC: "Dhaka / Hazrat Shahjalal International Airport",
   DAD: "Da Nang International Airport",
   DAG: "Barstow-Dagg
```

**File**: `fli-js/tests/core/airports.test.ts` (modified, +20/-1)
```diff
@@ -4,7 +4,7 @@
  */
 
 import { describe, expect, test } from "bun:test";
-import { searchAirports } from "../../src/core/airports.ts";
+import { airportDisplayName, searchAirports } from "../../src/core/airports.ts";
 
 describe("searchAirports", () => {
   test("exact IATA wins with score 100", () => {
@@ -75,3 +75,22 @@ describe("searchAirports", () => {
     expect(jfkCount).toBe(1);
   });
 });
+
+describe("disambiguated airport names stay internal", () => {
+  test("airportDisplayName strips only the airport's own code suffix", () => {
+    expect(airportDisplayName("OKA")).toBe("Naha Airport");
+    expect(airportDisplayName("NAH")).toBe("Naha Airport");
+    expect(airportDisplayName("JFK")).toBe("John F Kennedy International Airport");
+  });
+
+  test("name search returns the plain name under each code", () => {
+    const byCode = new Map(searchAirports("Naha Airport", 10).map((m) => [m.code, m.name]));
+    expect(byCode.get("OKA")).toBe("Naha Airport");
+    expect(byCode.get("NAH")).toBe("Naha Airport");
+  });
+
+  test("the hidden suffix never produces a name match", () => {
+    const nameMatches = searchAirports("(NC", 10).filter((m) => m.match_type === "name");
+    expect(nameMatches).toEqual([]);
+  });
+});
```

**File**: `fli-js/tests/models/enums.test.ts` (modified, +18/-0)
```diff
@@ -29,6 +29,24 @@ describe("Airport enum", () => {
   test("enum covers >7000 codes", () => {
     expect(Object.keys(AIRPORT_NAMES).length).toBeGreaterThan(7000);
   });
+  test("display names are disambiguated to match the Python package", () => {
+    // data/airports.csv gives OKA (Okinawa, Japan) and NAH (Naha,
+    // Indonesia) the same raw name ("Naha Airport"). The Python Airport
+    // enum disambiguates duplicate names by appending " (CODE)" so every
+    // Enum member stays distinct; AIRPORT_NAMES must carry the same
+    // suffixed names so the two packages' display output matches.
+    expect(AIRPORT_NAMES.OKA).toBe("Naha Airport (OKA)");
+    expect(AIRPORT_NAMES.NAH).toBe("Naha Airport (NAH)");
+    expect(AIRPORT_NAMES.OKA).not.toBe(AIRPORT_NAMES.NAH);
+
+    expect(AIRPORT_NAMES.TRI).toBe("Tri-Cities Airport (TRI)");
+    expect(AIRPORT_NAMES.PSC).toBe("Tri-Cities Airport (PSC)");
+    expect(AIRPORT_NAMES.TRI).not.toBe(AIRPORT_NAMES.PSC);
+
+    expect(AIRPORT_NAMES.NTL).toBe("Newcastle Airport (NTL)");
+    expect(AIRPORT_NAMES.NCL).toBe("Newcastle Airport (NCL)");
+    expect(AIRPORT_NAMES.NTL).not.toBe(AIRPORT_NAMES.NCL);
+  });
 });
 
 describe("Airline enum", () => {
```

**File**: `fli/cli/utils.py` (modified, +5/-5)
```diff
@@ -19,7 +19,7 @@
 from fli.core.parsers import ParseError
 from fli.core.parsers import parse_airlines as core_parse_airlines
 from fli.core.parsers import parse_max_stops as core_parse_max_stops
-from fli.models import Airline, Airport, MaxStops, TripType
+from fli.models import Airline, Airport, MaxStops, TripType, display_name
 
 
 def validate_currency(
@@ -161,8 +161,8 @@ def filter_dates_by_days(dates: list, days: list[DayOfWeek], trip_type: TripType
 
 
 def format_airport(airport: Airport) -> str:
-    """Format airport code and name (first two words)."""
-    name_parts = airport.value.split()[:3]  # Get first three words
+    """Format airport code and name (first three words)."""
+    name_parts = display_name(airport).split()[:3]  # Get first three words
     name = " ".join(name_parts)
     return f"{airport.name} ({name})"
 
@@ -176,12 +176,12 @@ def format_duration(minutes: int) -> str:
 
 def serialize_airport(airport: Airport) -> dict[str, str]:
     """Serialize an airport for machine-readable output."""
-    return {"code": airport.name, "name": airport.value}
+    return {"code": airport.name, "name": display_name(airport)}
 
 
 def serialize_airline(airline: Airline) -> dict[str, str]:
     """Serialize an airline for machine-readable output."""
-    return {"code": airline.name.removeprefix("_"), "name": airline.value}
+    return {"code": airline.name.removeprefix("_"), "name": display_name(airline)}
 
 
 def serialize_flight_leg(leg: Any) -> dict[str, Any]:
```

**File**: `fli/core/airports.py` (modified, +21/-8)
```diff
@@ -4,7 +4,7 @@
 
 from pydantic import BaseModel, ConfigDict, Field
 
-from fli.models import Airport
+from fli.models import Airport, display_name
 from fli.models.airport import AIRPORT_NAMES
 
 # Curated mapping of city names and common abbreviations to IATA codes.
@@ -119,7 +119,9 @@ def search_airports(query: str, limit: int = 10) -> list[AirportMatch]:
     if query_upper in Airport.__members__:
         airport = Airport[query_upper]
         results.append(
-            AirportMatch(code=airport, name=airport.value, match_type="iata_exact", score=100.0)
+            AirportMatch(
+                code=airport, name=display_name(airport), match_type="iata_exact", score=100.0
+            )
         )
         seen_codes.add(query_upper)
 
@@ -129,7 +131,9 @@ def search_airports(query: str, limit: int = 10) -> list[AirportMatch]:
             if code not in seen_codes:
                 airport = Airport[code]
                 results.append(
-                    AirportMatch(code=airport, name=airport.value, match_type="city", score=90.0)
+                    AirportMatch(
+                        code=airport, name=display_name(airport), match_type="city", score=90.0
+                    )
                 )
                 seen_codes.add(code)
 
@@ -142,7 +146,10 @@ def search_airports(query: str, limit: int = 10) -> list[AirportMatch]:
                         airport = Airport[code]
                         results.append(
                             AirportMatch(
-                                code=airport, name=airport.value, match_type="city", score=80.0
+                                code=airport,
+                                name=display_name(airport),
+                                match_type="city",
+                                score=80.0,
                             )
                         )
                         seen_codes.add(code)
@@ -154,27 +161,33 @@ def search_airports(query: str, limit: int = 10) -> list[AirportMatch]:
     for code, airport_name in AIRPORT_NAMES.items():
         if code in seen_codes:
             continue
-        airport_name_lower = airport_name.lower()
+        # Match on the name users see, not the internal " (CODE)" uniqueness suffix.
+        airport_name_lower = airport_name.removesuffix(f" ({code})").lower()
         if query_lower in airport_name_lower:
             # 0.1-per-position weight keeps name matches (max ~70) below
             # city matches (80) regardless of where the substring lands.
             pos = airport_name_lower.find(query_lower)
             score = 70.0 - (pos * 0.1)
             results.append(
-                AirportMatch(code=Airport[code], name=airport_name, match_type="name", score=score)
+                AirportMatch(
+                    code=Airport[code],
+                    name=display_name(Airport[code]),
+                    match_type="name",
+                    score=score,
+                )
             )
             seen_codes.add(code)
 
     # Priority 5: IATA code prefix match (handles "SF" matching "SFO").
     if len(query_upper) <= 3:
-        for code, airport_name in AIRPORT_NAMES.items():
+        for code in AIRPORT_NAMES:
             if code in seen_codes:
                 continue
             if code.startswith(query_upper):
                 results.append(
                     AirportMatch(
                         code=Airport[code],
-                        name=airport_name,
+                        name=display_name(Airport[code]),
                         match_type="iata_prefix",
                         score=60.0,
                     )
```

---

### Incident Patch 13: `466b2535` (2026-09-20)
**Commit Message**: fix(mcp): add /health route for the docker-compose healthcheck (#240)

docker-compose.yml probes GET /health, but the HTTP server never served it, so
the container was permanently reported unhealthy (404).

Add a FastMCP custom route returning {"status": "ok"}. It is a liveness probe
only: it does not call Google Flights, so an upstream outage cannot make an
orchestrator restart a healthy server.

starlette is now imported directly, so declare it in the `mcp` extra rather
than relying on it arriving transitively (it came in via the `mcp` package).

Fixes #238

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `docs/guides/mcp.md` (modified, +4/-0)
```diff
@@ -40,6 +40,10 @@ run_http(host="0.0.0.0", port=8000)
 
 Once running, the MCP endpoint is served at `/mcp/`, for example: `http://127.0.0.1:8000/mcp/`.
 
+A liveness probe is available at `/health` (returns `{"status": "ok"}`). It is what the
+`docker-compose.yml` healthcheck calls, and it does not contact Google Flights, so an upstream
+outage will not cause a healthy container to be restarted.
+
 ## Claude Desktop Configuration
 
 Add this configuration to your `claude_desktop_config.json`:
```

**File**: `fli/mcp/server.py` (modified, +12/-0)
```diff
@@ -14,6 +14,8 @@
 from mcp.types import Icon
 from pydantic import BaseModel, Field, ValidationError
 from pydantic_settings import BaseSettings, SettingsConfigDict
+from starlette.requests import Request
+from starlette.responses import JSONResponse
 
 from fli.core import (
     build_date_search_segments,
@@ -92,6 +94,16 @@ class FlightSearchConfig(BaseSettings):
 )
 
 
+@mcp.custom_route("/health", methods=["GET"])
+async def health_check(_request: Request) -> JSONResponse:
+    """Liveness probe for container healthchecks (see ``docker-compose.yml``).
+
+    Deliberately does not call Google Flights: an upstream outage should not
+    make the orchestrator restart an otherwise healthy server.
+    """
+    return JSONResponse({"status": "ok"})
+
+
 # =============================================================================
 # Request/Response Models
 # =============================================================================
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ mcp = [
     "fastmcp>=3.2",
     "mcp>=1.2.0",
     "pydantic-settings>=2.0.0",
+    "starlette>=0.27",
     "uvicorn>=0.34.0",
 ]
 all = [
```

**File**: `tests/mcp/test_mcp_http.py` (modified, +29/-0)
```diff
@@ -106,3 +106,32 @@ async def test_http_tools_have_description_and_schema(self, http_mcp_url):
         for tool in tools:
             assert tool.description, f"{tool.name} is missing a description"
             assert tool.inputSchema, f"{tool.name} is missing inputSchema"
+
+
+# ---------------------------------------------------------------------------
+# Test C: /health liveness endpoint (used by the docker-compose healthcheck)
+# ---------------------------------------------------------------------------
+
+
+class TestHealthEndpoint:
+    """The HTTP server must answer ``GET /health`` for container healthchecks."""
+
+    def test_health_matches_the_compose_probe(self, http_mcp_url):
+        """``urllib.request.urlopen(.../health)`` succeeds, exactly as docker-compose runs it."""
+        import json
+        import urllib.request
+
+        base_url = http_mcp_url.removesuffix("/mcp/")
+        with urllib.request.urlopen(f"{base_url}/health", timeout=5) as response:
+            assert response.status == 200
+            assert json.loads(response.read()) == {"status": "ok"}
+
+    def test_health_does_not_shadow_the_mcp_endpoint(self, http_mcp_url):
+        """Adding the route must leave the MCP transport itself working."""
+        import asyncio
+
+        async def list_tool_names() -> set[str]:
+            async with Client(http_mcp_url) as client:
+                return {tool.name for tool in await client.list_tools()}
+
+        assert EXPECTED_TOOLS <= asyncio.run(list_tool_names())
```

**File**: `uv.lock` (modified, +3/-0)
```diff
@@ -695,6 +695,7 @@ all = [
     { name = "fastmcp" },
     { name = "mcp" },
     { name = "pydantic-settings" },
+    { name = "starlette" },
     { name = "uvicorn" },
 ]
 dev = [
@@ -712,6 +713,7 @@ mcp = [
     { name = "fastmcp" },
     { name = "mcp" },
     { name = "pydantic-settings" },
+    { name = "starlette" },
     { name = "uvicorn" },
 ]
 
@@ -737,6 +739,7 @@ requires-dist = [
     { name = "ratelimit", specifier = ">=2.2.1" },
     { name = "rich", specifier = ">=13.8.0" },
     { name = "ruff", marker = "extra == 'dev'", specifier = ">=0.8.4" },
+    { name = "starlette", marker = "extra == 'mcp'", specifier = ">=0.27" },
     { name = "tenacity", specifier = ">=9.0.0" },
     { name = "twine", marker = "extra == 'dev'", specifier = ">=6.0.0" },
     { name = "typer", specifier = ">=0.15.1" },
```

---

### Incident Patch 14: `98671cf0` (2026-09-20)
**Commit Message**: fix(search): encode cabin class in tfs booking deep-links (#231)

* fix(search): encode cabin class in tfs booking deep-links

build_tfs_token hardcoded protobuf field 9 to economy (1), so
booking URLs from a business/first search opened the economy
page. Pass SeatType through the encoder, CLI, MCP, and JS port.
Default remains economy so captured golden tokens stay byte-equal.

Closes #213

* style(fli-js): wrap long import so biome format:check passes

The SeatType import in flights_booking_url.test.ts exceeded the line width,
which fails the `fli-js / Format & lint` CI job. Pure formatter output
(`bun run format`); no semantic change.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

---------

Co-authored-by: Punit Arani <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `fli-js/src/search/flights.ts` (modified, +7/-4)
```diff
@@ -6,7 +6,7 @@
 
 import type { GoogleFlightsUrlOptions } from "../core/links.ts";
 import type { BookingOption, FlightResult } from "../models/google-flights/base.ts";
-import { TripType } from "../models/google-flights/base.ts";
+import { SeatType, TripType } from "../models/google-flights/base.ts";
 import { FlightSearchFilters } from "../models/google-flights/flights.ts";
 import { type Client, getClient } from "./client.ts";
 import { parallelMap } from "./concurrency.ts";
@@ -31,8 +31,11 @@ export interface BookingOptions {
   sessionId?: string | null;
 }
 
-/** Locale knobs for {@link SearchFlights.buildFlightBookingUrl} (alias of the core options). */
-export type BookingUrlOptions = GoogleFlightsUrlOptions;
+/** Locale knobs plus cabin class for {@link SearchFlights.buildFlightBookingUrl}. */
+export interface BookingUrlOptions extends GoogleFlightsUrlOptions {
+  /** Cabin class encoded into the `tfs` token (field 9). Defaults to economy. */
+  seatType?: SeatType;
+}
 
 export class SearchFlights {
   static readonly BASE_URL =
@@ -251,7 +254,7 @@ export class SearchFlights {
           flightNumber: leg.flight_number,
         })),
       );
-      const tfs = buildTfsToken(segments, { isOneWay });
+      const tfs = buildTfsToken(segments, { isOneWay, seat: options.seatType ?? SeatType.ECONOMY });
       url = `https://www.google.com/travel/flights/booking?tfs=${tfs}`;
     } catch {
       url = "https://www.google.com/travel/flights";
```

**File**: `fli-js/src/search/proto.ts` (modified, +8/-1)
```diff
@@ -347,6 +347,12 @@ export interface LegSpec {
 export interface BuildTfsTokenOptions {
   /** `true` for one-way (incl. multi-city); `false` for round-trip. */
   isOneWay?: boolean;
+  /**
+   * Cabin class encoded in field 9.
+   * `1` = economy, `2` = premium economy, `3` = business, `4` = first.
+   * Defaults to economy so existing callers keep producing the captured tokens.
+   */
+  seat?: number;
 }
 
 /**
@@ -363,6 +369,7 @@ export interface BuildTfsTokenOptions {
  */
 export function buildTfsToken(segments: LegSpec[][], options: BuildTfsTokenOptions = {}): string {
   const isOneWay = options.isOneWay ?? true;
+  const seat = options.seat ?? 1;
   if (segments.length === 0) throw new Error("segments must be non-empty");
   for (let i = 0; i < segments.length; i++) {
     const seg = segments[i];
@@ -402,7 +409,7 @@ export function buildTfsToken(segments: LegSpec[][], options: BuildTfsTokenOptio
     varintField(2, 2),
     segmentProtos,
     varintField(8, 1),
-    varintField(9, 1),
+    varintField(9, seat), // 1=economy 2=premium 3=business 4=first
     varintField(14, 1),
     lengthDelim(16, concatBytes(tag(1, 0), varintBig(MAX_U64))),
     varintField(19, f19),
```

**File**: `fli-js/tests/search/flights_booking_url.test.ts` (modified, +19/-1)
```diff
@@ -9,7 +9,11 @@ import { describe, expect, test } from "bun:test";
 import { Buffer } from "node:buffer";
 import { Airline } from "../../src/models/airline.ts";
 import { Airport } from "../../src/models/airport.ts";
-import type { FlightLeg, FlightResult } from "../../src/models/google-flights/base.ts";
+import {
+  type FlightLeg,
+  type FlightResult,
+  SeatType,
+} from "../../src/models/google-flights/base.ts";
 import { SearchFlights } from "../../src/search/flights.ts";
 
 /** Build a leg with a LOCAL departure datetime (matches the decoder). */
@@ -195,4 +199,18 @@ describe("buildFlightBookingUrl", () => {
   test("returns a string", () => {
     expect(typeof search.buildFlightBookingUrl(oneWay())).toBe("string");
   });
+
+  test("seatType defaults to economy (field 9 = 1)", () => {
+    const raw = tfsBytes(search.buildFlightBookingUrl(oneWay()));
+    expect(Buffer.from(raw).includes(Buffer.from([0x48, 0x01]))).toBe(true);
+    expect(Buffer.from(raw).includes(Buffer.from([0x48, 0x03]))).toBe(false);
+  });
+
+  test("seatType BUSINESS encodes field 9 as 3", () => {
+    const economy = search.buildFlightBookingUrl(oneWay());
+    const business = search.buildFlightBookingUrl(oneWay(), { seatType: SeatType.BUSINESS });
+    expect(economy).not.toBe(business);
+    const raw = tfsBytes(business);
+    expect(Buffer.from(raw).includes(Buffer.from([0x48, 0x03]))).toBe(true);
+  });
 });
```

**File**: `fli-js/tests/search/proto.test.ts` (modified, +20/-0)
```diff
@@ -355,4 +355,24 @@ describe("buildTfsToken", () => {
   test("empty leg list throws", () => {
     expect(() => buildTfsToken([[]])).toThrow("no legs");
   });
+
+  test("seat defaults to economy (field 9 = 1)", () => {
+    const built = buildTfsToken([
+      [{ origin: "SFO", depDate: "2026-09-01", dest: "PHX", airline: "AA", flightNumber: "100" }],
+    ]);
+    const raw = tfsBytes(built);
+    const text = Buffer.from(raw);
+    expect(text.includes(Buffer.from([0x40, 0x01, 0x48, 0x01, 0x70, 0x01]))).toBe(true);
+  });
+
+  test("seat=3 encodes field 9 as business", () => {
+    const segs: LegSpec[][] = [
+      [{ origin: "SFO", depDate: "2026-09-01", dest: "PHX", airline: "AA", flightNumber: "100" }],
+    ];
+    const economy = tfsBytes(buildTfsToken(segs));
+    const business = tfsBytes(buildTfsToken(segs, { seat: 3 }));
+    expect(Buffer.from(economy).includes(Buffer.from([0x48, 0x01]))).toBe(true);
+    expect(Buffer.from(business).includes(Buffer.from([0x48, 0x03]))).toBe(true);
+    expect(Buffer.from(economy).equals(Buffer.from(business))).toBe(false);
+  });
 });
```

**File**: `fli/cli/commands/flights.py` (modified, +5/-1)
```diff
@@ -204,7 +204,11 @@ def _search_flights_core(
         # Build per-flight booking deep-links (tfs; never raises).
         booking_urls = [
             search_client.build_flight_booking_url(
-                result, currency=currency, language=language, country=country
+                result,
+                currency=currency,
+                language=language,
+                country=country,
+                seat_type=seat_type,
             )
             for result in results
         ]
```

**File**: `fli/mcp/server.py` (modified, +2/-0)
```diff
@@ -673,6 +673,7 @@ def _execute_flight_search(params: FlightSearchParams) -> dict[str, Any]:
                     currency=params.currency,
                     language=params.language,
                     country=params.country,
+                    seat_type=filters.seat_type,
                 ),
             )
             for f in flights
@@ -760,6 +761,7 @@ def _execute_booking_options(
             currency=params.currency,
             language=params.language,
             country=params.country,
+            seat_type=filters.seat_type,
         )
         serialized = [_serialize_booking_option(o) for o in options]
         result = {
```

**File**: `fli/search/_proto.py` (modified, +5/-1)
```diff
@@ -246,6 +246,7 @@ def build_tfs_token(
     segments: list[list[LegSpec]],
     *,
     is_one_way: bool = True,
+    seat: int = 1,
 ) -> str:
     """Build the ``tfs`` query parameter for a Google Flights deep-link URL.
 
@@ -264,6 +265,9 @@ def build_tfs_token(
             direction (one leg for nonstop, two or more for connections).
         is_one_way: ``True`` for one-way (including multi-city); ``False``
             for round-trip.  Controls the ``f19`` constant.
+        seat: Cabin class encoded in field 9.  ``1`` = economy, ``2`` =
+            premium economy, ``3`` = business, ``4`` = first.  Defaults to
+            economy so existing callers keep producing the captured tokens.
 
     Returns:
         URL-safe base64 string (no ``=`` padding) suitable for use as the
@@ -316,7 +320,7 @@ def build_tfs_token(
         + _varint_field(2, 2)
         + segment_protos
         + _varint_field(8, 1)
-        + _varint_field(9, 1)
+        + _varint_field(9, seat)  # 1=economy 2=premium 3=business 4=first
         + _varint_field(14, 1)
         + _length_delim(16, _varint_field(1, _MAX_U64))
         + _varint_field(19, f19)
```

**File**: `fli/search/flights.py` (modified, +5/-1)
```diff
@@ -17,6 +17,7 @@
     BookingOption,
     FlightResult,
     FlightSearchFilters,
+    SeatType,
 )
 from fli.models.google_flights.base import TripType
 from fli.search._concurrency import parallel_map
@@ -357,6 +358,7 @@ def build_flight_booking_url(
         currency: str | None = None,
         language: str | None = None,
         country: str | None = None,
+        seat_type: SeatType = SeatType.ECONOMY,
     ) -> str:
         """Build a Google Flights deep-link URL for a specific itinerary.
 
@@ -377,6 +379,8 @@ def build_flight_booking_url(
             currency: ISO 4217 currency code appended as ``curr=``.
             language: BCP-47 language code appended as ``hl=``.
             country: ISO 3166-1 alpha-2 country code appended as ``gl=``.
+            seat_type: Cabin class encoded into the ``tfs`` token (field 9).
+                Defaults to economy for backward compatibility.
 
         Returns:
             A ``https://www.google.com/travel/flights/booking?tfs=…`` URL.
@@ -405,7 +409,7 @@ def _iata(airport: object) -> str:
                     for leg in result.legs
                 ]
                 segments.append(seg_legs)
-            tfs = build_tfs_token(segments, is_one_way=is_one_way)
+            tfs = build_tfs_token(segments, is_one_way=is_one_way, seat=seat_type.value)
             url = f"https://www.google.com/travel/flights/booking?tfs={tfs}"
         except Exception:
             logger.debug("build_flight_booking_url: tfs construction failed", exc_info=True)
```

---

### Incident Patch 15: `c005d705` (2026-09-20)
**Commit Message**: fix: decode legroom ratings from seat quality instead of Wi-Fi (#232)

Co-authored-by: davefmurray <[REDACTED_EMAIL]>

**File**: `fli-js/src/search/decoders.ts` (modified, +4/-4)
```diff
@@ -71,12 +71,12 @@ function safeAirline(code: unknown): Airline | null {
   return null;
 }
 
-function parseAmenities(slots: unknown): Amenities | null {
-  if (!Array.isArray(slots) || slots.length === 0) return null;
+function parseAmenities(slots: unknown, seatQuality: unknown = null): Amenities | null {
   const wifi = asBool(safeGet(slots, 1));
   const power = asBool(safeGet(slots, 5));
   const onDemandVideo = asBool(safeGet(slots, 9));
-  const legroomRating = asNonNegativeInt(safeGet(slots, 11));
+  // leg[12][11] is the Wi-Fi tier; seat quality lives separately at leg[13].
+  const legroomRating = asNonNegativeInt(seatQuality);
   if (wifi == null && power == null && onDemandVideo == null && legroomRating == null) {
     return null;
   }
@@ -121,7 +121,7 @@ function parseLeg(fl: unknown[]): FlightLeg {
   const opCode = safeGet(airlineInfo, 2);
   const operatingAirline = opCode ? safeAirline(opCode) : null;
 
-  const amenities = parseAmenities(safeGet(fl, 12));
+  const amenities = parseAmenities(safeGet(fl, 12), safeGet(fl, 13));
   const aircraft = asStr(safeGet(fl, 17));
   const legroomShort = asStr(safeGet(fl, 14));
   const legroomLong = asStr(safeGet(fl, 30));
```

**File**: `fli-js/tests/search/legroom_rating.test.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import { describe, expect, test } from "bun:test";
+import { readFileSync } from "node:fs";
+import { parseFlightRow } from "../../src/search/decoders.ts";
+
+const fixture = readFileSync(
+  new URL("../../../tests/search/fixtures/flight_search_jfk_lax_oneway_usd.bin", import.meta.url),
+  "utf8",
+);
+const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+const inner = JSON.parse(outer[0][2]);
+const rows: unknown[][] = [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+
+function rowWithRating(rating: unknown, slots: unknown): unknown[] {
+  const row = structuredClone(rows[0]) as unknown[];
+  const detail = row[0] as unknown[];
+  const leg = (detail[2] as unknown[][])[0] as unknown[];
+  leg[12] = slots;
+  leg[13] = rating;
+  return row;
+}
+
+describe("legroom rating", () => {
+  test("captured flights with the same Wi-Fi tier have different seat ratings", () => {
+    const legs = rows.flatMap((row) => parseFlightRow(row).legs);
+    const jetblue = legs.find((leg) => leg.airline === "B6" && leg.flight_number === "123");
+    const american = legs.find((leg) => leg.airline === "AA" && leg.flight_number === "300");
+    expect(jetblue?.amenities?.legroom_rating).toBe(3);
+    expect(american?.amenities?.legroom_rating).toBe(1);
+  });
+
+  for (const tier of [2, 3]) {
+    test.each([
+      1, 2, 3, 4, 5, 6, 7, 8, 9,
+    ])(`reads seat rating %d with Wi-Fi tier ${tier}`, (rating) => {
+      const slots: unknown[] = Array.from({ length: 12 }, () => null);
+      slots[11] = tier;
+      const flight = parseFlightRow(rowWithRating(rating, slots));
+      expect(flight.legs[0]?.amenities?.legroom_rating).toBe(rating);
+    });
+  }
+
+  test.each<[unknown]>([
+    [null],
+    [[]],
+    ["invalid"],
+  ])("preserves rating without amenities array: %j", (slots) => {
+    const flight = parseFlightRow(rowWithRating(3, slots));
+    expect(flight.legs[0]?.amenities?.legroom_rating).toBe(3);
+    expect(flight.legs[0]?.amenities?.wifi).toBeNull();
+  });
+
+  test.each([
+    null,
+    -1,
+    true,
+    "3",
+  ])("does not fall back to Wi-Fi for invalid rating: %j", (rating) => {
+    const slots: unknown[] = Array.from({ length: 12 }, () => null);
+    slots[1] = true;
+    slots[11] = 2;
+    const flight = parseFlightRow(rowWithRating(rating, slots));
+    expect(flight.legs[0]?.amenities?.legroom_rating).toBeNull();
+  });
+
+  test("returns no amenities when neither source has data", () => {
+    expect(parseFlightRow(rowWithRating(null, null)).legs[0]?.amenities).toBeNull();
+  });
+});
```

**File**: `fli/models/google_flights/base.py` (modified, +4/-2)
```diff
@@ -235,8 +235,10 @@ class LayoverRestrictions(BaseModel):
 class Amenities(BaseModel):
     """Per-leg amenities reported by Google Flights.
 
-    All fields are tri-state (`True`, `False`, or `None` when Google did not
-    publish that signal for the leg).
+    Boolean fields are tri-state (`True`, `False`, or `None` when Google did
+    not publish that signal). ``legroom_rating`` is Google's seat-quality
+    code from ``leg[13]``, or ``None`` when unavailable; it is not an ordered
+    numeric score or the Wi-Fi tier.
     """
 
     wifi: bool | None = None
```

**File**: `fli/search/_decoders.py` (modified, +7/-15)
```diff
@@ -85,7 +85,7 @@ def _parse_leg(fl: list) -> FlightLeg:
     op_code = safe_get(airline_info, 2)
     operating_airline = _safe_airline(op_code) if op_code else None
 
-    amenities = _parse_amenities(safe_get(fl, 12))
+    amenities = _parse_amenities(safe_get(fl, 12), safe_get(fl, 13))
     aircraft = as_str(safe_get(fl, 17))
     legroom_short = as_str(safe_get(fl, 14))
     legroom_long = as_str(safe_get(fl, 30))
@@ -113,26 +113,18 @@ def _parse_leg(fl: list) -> FlightLeg:
     )
 
 
-def _parse_amenities(slots: Any) -> Amenities | None:
-    """Decode the 12-slot amenities array at ``leg[12]``.
+def _parse_amenities(slots: Any, seat_quality: Any = None) -> Amenities | None:
+    """Decode amenities at ``leg[12]`` and the seat-quality code at ``leg[13]``.
 
-    Confirmed slot mapping (live captures, May 2026):
+    ``leg[12][11]`` is the Wi-Fi tier, not a legroom rating. Seat quality
+    may be present even when the amenities array is missing.
 
-    - slot 1 → wifi (bool|None)
-    - slot 5 → power outlet (bool|None)
-    - slot 9 → on-demand video (bool|None)
-    - slot 11 → integer legroom rating (2 or 3 observed)
-
-    Returns None when none of the known slots carry a usable value (avoids
-    creating empty ``Amenities`` instances that would imply we know nothing
-    about the leg).
+    Return None when neither source carries a usable value.
     """
-    if not isinstance(slots, list) or not slots:
-        return None
     wifi = as_bool(safe_get(slots, 1))
     power = as_bool(safe_get(slots, 5))
     on_demand_video = as_bool(safe_get(slots, 9))
-    legroom_rating = as_non_negative_int(safe_get(slots, 11))
+    legroom_rating = as_non_negative_int(seat_quality)
     if wifi is None and power is None and on_demand_video is None and legroom_rating is None:
         return None
     return Amenities(
```

**File**: `tests/search/test_parse_flights_data.py` (modified, +52/-1)
```diff
@@ -6,6 +6,8 @@
 locking down the parser positions we depend on.
 """
 
+import pytest
+
 from fli.models import Airline, Airport
 from fli.search.flights import SearchFlights
 
@@ -32,6 +34,7 @@ def _leg(
     cabin=2,
     overnight=False,
     amenities=None,
+    legroom_rating=None,
 ):
     amenities = amenities or [None] * 12
     leg = [None] * 33
@@ -43,6 +46,7 @@ def _leg(
     leg[10] = list(arr_time)
     leg[11] = duration
     leg[12] = amenities
+    leg[13] = legroom_rating
     leg[14] = legroom_short
     leg[17] = aircraft
     leg[19] = overnight
@@ -112,6 +116,7 @@ def setup_method(self):
                     dep_iata="JFK",
                     arr_iata="LAX",
                     amenities=[None, True, None, None, None, True, None, None, None, True, None, 2],
+                    legroom_rating=3,
                 )
             ],
         )
@@ -147,7 +152,7 @@ def test_leg_amenities_populated(self):
         assert am.wifi is True
         assert am.power is True
         assert am.on_demand_video is True
-        assert am.legroom_rating == 2
+        assert am.legroom_rating == 3
         # USB/in-seat-video slots not yet disambiguated — left as None to
         # avoid lying about what we know.
         assert am.usb_power is None
@@ -170,6 +175,52 @@ def test_booking_token(self):
         assert self.flight.booking_token == "CAISA1VTRBoDCNR/sample"
 
 
+class TestLegroomRating:
+    @pytest.mark.parametrize("rating", range(1, 10))
+    @pytest.mark.parametrize("wifi_tier", [2, 3])
+    def test_reads_seat_quality_independently_of_wifi(self, rating, wifi_tier):
+        amenities = [None] * 12
+        amenities[11] = wifi_tier
+        row = _row(
+            legs=[
+                _leg(
+                    dep_iata="JFK",
+                    arr_iata="LAX",
+                    amenities=amenities,
+                    legroom_rating=rating,
+                )
+            ]
+        )
+        flight = SearchFlights._parse_flights_data(row)
+        assert flight.legs[0].amenities.legroom_rating == rating
+
+    @pytest.mark.parametrize("slots", [None, [], "invalid"])
+    def test_preserves_rating_without_amenities_array(self, slots):
+        leg = _leg(dep_iata="JFK", arr_iata="LAX", legroom_rating=3)
+        leg[12] = slots
+        flight = SearchFlights._parse_flights_data(_row(legs=[leg]))
+        assert flight.legs[0].amenities.legroom_rating == 3
+        assert flight.legs[0].amenities.wifi is None
+
+    @pytest.mark.parametrize("rating", [None, -1, True, "3"])
+    def test_missing_or_invalid_rating_does_not_fall_back_to_wifi(self, rating):
+        amenities = [None] * 12
+        amenities[1] = True
+        amenities[11] = 2
+        row = _row(
+            legs=[
+                _leg(
+                    dep_iata="JFK",
+                    arr_iata="LAX",
+                    amenities=amenities,
+                    legroom_rating=rating,
+                )
+            ]
+        )
+        flight = SearchFlights._parse_flights_data(row)
+        assert flight.legs[0].amenities.legroom_rating is None
+
+
 class TestParseFlightsDataLayover:
     """A multi-leg trip derives layover info from leg timestamps."""
 
```

**File**: `tests/search/test_snapshot_fixtures.py` (modified, +13/-0)
```diff
@@ -184,6 +184,19 @@ def test_aircraft_populated_on_some_legs(self, jfk_lax_oneway):
         with_ac = [leg for f in jfk_lax_oneway for leg in f.legs if leg.aircraft]
         assert with_ac, "Expected aircraft set on at least one leg"
 
+    def test_seat_ratings_differ_on_flights_with_the_same_wifi_tier(self, jfk_lax_oneway):
+        # Captured B6 123 and AA 300 both have Wi-Fi tier 2 at leg[12][11],
+        # but their seat-quality codes at leg[13] are 3 and 1 respectively.
+        legs = [leg for flight in jfk_lax_oneway for leg in flight.legs]
+        jetblue = next(
+            leg for leg in legs if leg.airline.name == "B6" and leg.flight_number == "123"
+        )
+        american = next(
+            leg for leg in legs if leg.airline.name == "AA" and leg.flight_number == "300"
+        )
+        assert jetblue.amenities.legroom_rating == 3
+        assert american.amenities.legroom_rating == 1
+
 
 class TestSnapshotFilterEnforcement:
     """The captured filter responses should reflect the filter applied."""
```

#### Recent Merged Pull Requests:
- **PR #256** (2026-09-20): fix(cli): do not print the sparse-results explanation twice in text mode (@punitarani)
- **PR #255** (2026-09-20): fix: say so when children or infants are why a search came back empty (@punitarani)
- **PR #254** (2026-09-20): chore: describe code in terms a repo reader can follow (drop review-process references from comments) (@punitarani)
- **PR #253** (2026-09-20): fix(cli): an empty result no longer reports "Unexpected error: Exit: 1" or writes a traceback log (@punitarani)
- **PR #252** (2026-09-20): fix: carry the search's passenger mix into per-flight booking links (@punitarani)
- **PR #251** (2026-09-20): feat: clear TLS certificate errors and CA-bundle support (carries forward #164) (@punitarani)
- **PR #250** (2026-09-20): feat: expose top_n for round-trip searches on the CLI and MCP tools (@punitarani)
- **PR #249** (2026-09-20): fix(search): a date sweep that mostly failed to load raises instead of reporting no dates (@punitarani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
