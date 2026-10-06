# Forensic Learning Record (Deep Inspection): crbnos/carbon

> **Canonical Artifact**: `07_PROJECT_LEARNING/crbnos-carbon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crbnos/carbon](https://github.com/crbnos/carbon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:42.934Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crbnos/carbon`
- **Description**: Open-source manufacturing ERP, MES and QMS. Quoting, MRP, inventory, shop floor, quality and lot/serial traceability on one Postgres schema, with a REST API and MCP server. Self-host or use Carbon Cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2685 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/academy/app/hooks/index.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import {
  useOptimisticLocation,
  useRouteData,
  useUrlParams
} from "@carbon/react";

import { useProgress } from "./useProgress";
import { useUser } from "./useUser";

export {
  useOptimisticLocation,
  useProgress,
  useRouteData,
  useUrlParams,
  useUser
};

```

### Core Architecture Module: `apps/academy/app/hooks/useProgress.tsx`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { useRouteData } from "@carbon/react";
import { path } from "~/utils/path";

interface LessonCompletion {
  lessonId: string;
  courseId: string;
}

interface ChallengeAttempt {
  topicId: string;
  courseId: string;
  passed: boolean;
}

interface ProgressData {
  lessonCompletions: LessonCompletion[];
  challengeAttempts: ChallengeAttempt[];
}

function isProgressData(value: any): value is ProgressData {
  return (
    Array.isArray(value?.lessonCompletions) &&
    Array.isArray(value?.challengeAttempts)
  );
}

export function useProgress(): ProgressData {
  const data = useRouteData<{
    lessonCompletions: unknown;
    challengeAttempts: unknown;
  }>(path.to.root);

  if (data && isProgressData(data)) {
    return data;
  }

  // Return empty arrays if no data or user not authenticated
  return {
    lessonCompletions: [],
    challengeAttempts: []
  };
}

```

### Core Architecture Module: `apps/academy/app/hooks/useUser.tsx`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { useRouteData } from "@carbon/react";
import { path } from "~/utils/path";

type PersonalData = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type Company = {
  id: string;
  name: string;
  logoLightIcon: string | null;
  logoDarkIcon: string | null;
  logoLight: string | null;
  logoDark: string | null;
};

type User = PersonalData & {
  company: Company;
};

export function useUser(): User {
  const data = useRouteData<{
    user: unknown;
  }>(path.to.root);

  if (data?.user && isUser(data.user)) {
    return data.user;
  }

  // TODO: force logout -- the likely cause is development changes
  throw new Error(
    "useUser must be used within an authenticated route. If you are seeing this error, you are likely in development and have changed the session variables. Try deleting the cookies."
  );
}

function isUser(value: any): value is User {
  return (
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    "avatarUrl" in value
  );
}

export function useOptionalUser() {
  const data = useRouteData<{
    user: unknown;
  }>(path.to.root);

  if (data?.user && isUser(data.user)) {
    return data.user;
  }

  return null;
}

```

### Core Architecture Module: `apps/academy/app/utils/glossary.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { getTermText, listEntries } from "@carbon/content/glossary";

export type GlossarySegment = string | { text: string; slug: string };

// Phrases that are too generic to auto-link without noise.
const STOPLIST = new Set(["buy", "make", "new", "job", "part", "cost"]);

type Phrase = { phrase: string; slug: string; re: RegExp };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build the match list once: for each glossary entry, candidate phrases are the
// de-parenthesized term, its aliases, and the slug-as-words. Longest first so a
// specific phrase wins over a shorter substring.
const PHRASES: Phrase[] = (() => {
  const seen = new Set<string>();
  const out: Phrase[] = [];
  for (const { id, entry } of listEntries()) {
    const primary = getTermText(entry)
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .trim();
    const candidates = [
      primary,
      ...(entry.aliases ?? []),
      id.replace(/-/g, " ")
    ];
    for (const raw of candidates) {
      const phrase = raw.trim().toLowerCase();
      if (phrase.length < 3) continue;
      if (STOPLIST.has(phrase)) continue;
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      out.push({
        phrase,
        slug: id,
        re: new RegExp(`(?<![\\w-])(${escapeRegExp(phrase)})(?![\\w-])`, "i")
      });
    }
  }
  return out.sort((a, b) => b.phrase.length - a.phrase.length);
})();

/**
 * Split `text` into segments, wrapping the first whole-word occurrence of each
 * known glossary term once (case-insensitive). Only plain-string segments are
 * scanned, so terms never overlap and each slug links at most once.
 */
export function linkifyGlossary(text: string): GlossarySegment[] {
  let segments: GlossarySegment[] = [text];
  const usedSlugs = new Set<string>();

  for (const { slug, re } of PHRASES) {
    if (usedSlugs.has(slug)) continue;
    const next: GlossarySegment[] = [];
    let matched = false;
    for (const seg of segments) {
      if (matched || typeof seg !== "string") {
        next.push(seg);
        continue;
      }
      const m = seg.match(re);
      if (!m || m.index === undefined) {
        next.push(seg);
        continue;
      }
      const start = m.index;
      const end = start + m[1].length;
      if (start > 0) next.push(seg.slice(0, start));
      next.push({ text: seg.slice(start, end), slug });
      if (end < seg.length) next.push(seg.slice(end));
      matched = true;
    }
    if (matched) usedSlugs.add(slug);
    segments = next;
  }

  return segments;
}

```

### Core Architecture Module: `apps/academy/app/utils/path.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { ERP_URL as ERP_URL_CONFIG, SUPABASE_URL } from "@carbon/auth";
import { DOCS_URL as DOCS_URL_PROD } from "@carbon/content/links";
import { generatePath } from "react-router";

const challenge = "/challenge"; // from ~/routes/challenge+ folder
const course = "/course"; // from ~/routes/course+ folder
const lesson = "/lesson"; // from ~/routes/lesson+ folder

const ERP_URL = SUPABASE_URL?.includes("localhost")
  ? "http://localhost:3000"
  : ERP_URL_CONFIG;

const DOCS_URL = SUPABASE_URL?.includes("localhost")
  ? "http://localhost:3002"
  : DOCS_URL_PROD;

export const path = {
  to: {
    accountSettings: `${ERP_URL}/x/account`,
    callback: "/callback",
    docs: `${DOCS_URL}/docs`,
    glossary: `${DOCS_URL}/docs/glossary`,
    challenge: (topicId: string) => generatePath(`${challenge}/${topicId}`),
    course: (moduleId: string, courseId: string) =>
      generatePath(`${course}/${moduleId}/${courseId}`),
    dashboard: `${ERP_URL}/x`,
    health: "/health",
    login: "/login",
    logout: "/logout",
    mfa: "/mfa",
    refreshSession: "/refresh-session",
    root: "/",
    lesson: (id: string) => generatePath(`${lesson}/${id}`)
  }
} as const;

export const removeSubdomain = (url?: string): string => {
  if (!url) return "localhost:3000";
  const parts = url.split("/")[0].split(".");

  const domain = parts.slice(-2).join(".");

  return domain;
};

export const getStoragePath = (bucket: string, path: string) => {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
};

export const requestReferrer = (request: Request) => {
  return request.headers.get("referer");
};

export const getParams = (request: Request) => {
  const url = new URL(requestReferrer(request) ?? "");
  const searchParams = new URLSearchParams(url.search);
  return searchParams.toString();
};

```

### Core Architecture Module: `apps/academy/app/utils/progress.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { modules } from "~/config";
import { isLessonComingSoon } from "~/utils/video";

type Module = (typeof modules)[number];
type Course = Module["courses"][number];
type Topic = Course["topics"][number];
type Lesson = Topic["lessons"][number];

export type CourseProgress = {
  lessonsDone: number;
  lessonsTotal: number;
  challengesDone: number;
  challengesTotal: number;
  /** Combined completion across core lessons + challenges, 0–100. */
  percent: number;
  complete: boolean;
};

export type ResumeTarget = {
  module: Module;
  course: Course;
  topic: Topic;
  lesson: Lesson;
};

/** Core lessons in a topic (supplemental videos are extra, excluded from the path). */
function topicChallengeCount(topic: Topic): number {
  return topic.challenge && topic.challenge.length > 0 ? 1 : 0;
}

export function getCourseProgress(
  course: Course,
  completedLessonIds: Set<string>,
  passedTopicIds: Set<string>
): CourseProgress {
  let lessonsDone = 0;
  let lessonsTotal = 0;
  let challengesDone = 0;
  let challengesTotal = 0;

  for (const topic of course.topics) {
    for (const lesson of topic.lessons) {
      if (isLessonComingSoon(lesson)) continue;
      lessonsTotal += 1;
      if (completedLessonIds.has(lesson.id)) lessonsDone += 1;
    }
    const hasChallenge = topicChallengeCount(topic) > 0;
    if (hasChallenge) {
      challengesTotal += 1;
      if (passedTopicIds.has(topic.id)) challengesDone += 1;
    }
  }

  const total = lessonsTotal + challengesTotal;
  const done = lessonsDone + challengesDone;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    lessonsDone,
    lessonsTotal,
    challengesDone,
    challengesTotal,
    percent,
    complete: total > 0 && done >= total
  };
}

export function getOverallProgress(
  completedLessonIds: Set<string>,
  passedTopicIds: Set<string>
): { percent: number; done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const module of modules) {
    for (const course of module.courses) {
      const p = getCourseProgress(course, completedLessonIds, passedTopicIds);
      done += p.lessonsDone + p.challengesDone;
      total += p.lessonsTotal + p.challengesTotal;
    }
  }
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

/**
 * Next core lesson to watch, in recommended order (module → course → topic →
 * lesson). Returns the first lesson not in `completedLessonIds`, or null when
 * every core lesson is done.
 */
export function getResumeLesson(
  completedLessonIds: Set<string>
): ResumeTarget | null {
  for (const module of modules) {
    for (const course of module.courses) {
      for (const topic of course.topics) {
        for (const lesson of topic.lessons) {
          if (isLessonComingSoon(lesson)) continue;
          if (!completedLessonIds.has(lesson.id)) {
            return { module, course, topic, lesson };
          }
        }
      }
    }
  }
  return null;
}

/** Next incomplete lesson within a single course (for a per-course "Continue"). */
export function getNextLessonInCourse(
  course: Course,
  completedLessonIds: Set<string>
): Lesson | null {
  for (const topic of course.topics) {
    for (const lesson of topic.lessons) {
      if (isLessonComingSoon(lesson)) continue;
      if (!completedLessonIds.has(lesson.id)) return lesson;
    }
  }
  return null;
}

/** Build the completed-lesson + passed-topic sets from raw progress arrays. */
export function toProgressSets(
  lessonCompletions: { lessonId: string }[],
  challengeAttempts: { topicId: string; passed: boolean }[]
): { completedLessonIds: Set<string>; passedTopicIds: Set<string> } {
  return {
    completedLessonIds: new Set(lessonCompletions.map((c) => c.lessonId)),
    passedTopicIds: new Set(
      challengeAttempts.filter((a) => a.passed).map((a) => a.topicId)
    )
  };
}

```

### Core Architecture Module: `apps/academy/app/utils/supabase.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

export const sanitize = (input: Record<string, any>) => {
  const output = { ...input };
  Object.keys(output).forEach((key) => {
    if (output[key] === undefined && key !== "id") output[key] = null;
  });
  return output;
};

```

### Core Architecture Module: `apps/academy/app/utils/video.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { modules } from "~/config";

export function formatDuration(duration: number) {
  const total = Number.isFinite(duration)
    ? Math.max(0, Math.floor(duration))
    : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Pull the video id out of a Loom share/embed URL. Returns null when the URL is
 * missing or doesn't contain a `/share/` or `/embed/` segment, so callers can
 * render a fallback instead of an `embed/undefined` iframe.
 */
export function getLoomEmbedId(loomUrl: string | null | undefined) {
  if (!loomUrl) return null;
  const id = loomUrl.split(/(?:share|embed)\//)[1]?.split("?")[0];
  return id ? id : null;
}

/**
 * A lesson that has no recorded video yet. Placeholder entries carry
 * `duration: 0` (and share a stand-in Loom URL), so they're shown as "coming
 * soon" rather than embedded, and are left out of progress and navigation.
 */
export function isLessonComingSoon(lesson: {
  duration: number;
  loomUrl?: string | null;
}) {
  return lesson.duration <= 0 || getLoomEmbedId(lesson.loomUrl) === null;
}

export function findTopicContext(topicId: string) {
  for (const module of modules) {
    for (const course of module.courses) {
      const topic = course.topics.find(
        (topic: { id: string }) => topic.id === topicId
      );
      if (topic) {
        return {
          module,
          course,
          topic
        };
      }
    }
  }
  return null;
}

export function getLessonContext(lessonId: string) {
  for (const module of modules) {
    for (const course of module.courses) {
      for (const topic of course.topics) {
        // Search in regular lessons
        const lesson = topic.lessons.find(
          (lesson: { id: string }) => lesson.id === lessonId
        );
        if (lesson) {
          return {
            module,
            course,
            topic,
            lesson,
            lessonType: "regular" as const
          };
        }

        // Search in supplemental lessons
        if (topic.supplemental) {
          const supplementalLesson = topic.supplemental.find(
            (lesson: { id: string }) => lesson.id === lessonId
          );
          if (supplementalLesson) {
            return {
              module,
              course,
              topic,
              lesson: supplementalLesson,
              lessonType: "supplemental" as const
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * The list a lesson is navigated within: the topic's core lessons, or its
 * supplemental videos when the lesson is supplemental. Supplemental lessons are
 * a separate track, so they page through each other rather than the core path.
 */
export function getLessonSiblings(lessonId: string) {
  const context = getLessonContext(lessonId);
  if (!context) return null;

  return context.lessonType === "supplemental"
    ? (context.topic.supplemental ?? [])
    : context.topic.lessons;
}

export function getNextLesson(lessonId: string) {
  const siblings = getLessonSiblings(lessonId);
  if (!siblings) return null;

  const currentIndex = siblings.findIndex((lesson) => lesson.id === lessonId);
  if (currentIndex === -1) return null;

  return (
    siblings
      .slice(currentIndex + 1)
      .find((lesson) => !isLessonComingSoon(lesson)) ?? null
  );
}

export function getPreviousLesson(lessonId: string) {
  const siblings = getLessonSiblings(lessonId);
  if (!siblings) return null;

  const currentIndex = siblings.findIndex((lesson) => lesson.id === lessonId);
  if (currentIndex <= 0) return null;

  return (
    siblings
      .slice(0, currentIndex)
      .reverse()
      .find((lesson) => !isLessonComingSoon(lesson)) ?? null
  );
}

```

### Core Architecture Module: `apps/academy/public/serviceWorker.js`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

self.addEventListener("fetch", (event) => {
  let url = new URL(event.request.url);
  let method = event.request.method;

  // any non GET request is ignored
  if (method.toLowerCase() !== "get") return;

  // If the request is for the favicons, fonts, or the built files (which are hashed in the name)
  if (
    url.pathname.includes("logo") ||
    url.pathname.includes("storage/v1/object/public/avatars")
  ) {
    event.respondWith(
      // we will open the assets cache
      caches.open("assets").then(async (cache) => {
        // if the request is cached we will use the cache
        let cacheResponse = await cache.match(event.request);
        if (cacheResponse) return cacheResponse;

        // if it's not cached we will run the fetch, cache it and return it
        // this way the next time this asset it's needed it will load from the cache
        let fetchResponse = await fetch(event.request);
        cache.put(event.request, fetchResponse.clone());

        return fetchResponse;
      })
    );
  }

  return;
});

```

### Core Architecture Module: `apps/erp/app/components/AuditLog/utils.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

/**
 * Whether a diff side holds no real value (null/undefined, empty string,
 * empty object/array). Rendered as a muted "Empty" pill instead of the
 * literal "null" — first-time sets read as "Empty → Net 15", not
 * "null → Net 15". Scalars like 0 and false are real values.
 */
export function isEmptyDiffValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

```

### Core Architecture Module: `apps/erp/app/components/Configurator/utils.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import type * as Monaco from "monaco-editor";
import type {
  ConfiguratorDataType,
  MaterialValue,
  Parameter,
  ReturnType
} from "./types";
import { typeMap } from "./types";

const MATERIAL_TYPE =
  "{ id: string; materialFormId: string | null; materialSubstanceId: string | null; materialTypeId: string | null; dimensionId: string | null; finishId: string | null; gradeId: string | null; }";

export function configureMonaco(monaco: typeof Monaco) {
  // Configure JavaScript defaults
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false
  });

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    typeRoots: ["node_modules/@types"],
    strict: true
  });
}

function getParameterTypeString(parameter: Parameter): string {
  if (parameter.type === "list" && parameter.config?.options) {
    const unionType = parameter.config.options
      .map((opt) => `"${opt}"`)
      .join(" | ");
    return ` * @param params.${parameter.name}: ${unionType}`;
  }

  if (parameter.type === "enum") {
    return ` * @param params.${
      parameter.name
    }: ${parameter.config?.options?.join(" | ")}`;
  }

  if (parameter.type === "material") {
    return ` * @param params.${parameter.name}: ${MATERIAL_TYPE}`;
  }

  return ` * @param params.${parameter.name}: ${typeMap[parameter.type]}`;
}

function getReturnTypeString(returnType: ReturnType): string {
  if (returnType.type === "list" && returnType.listOptions) {
    return `Array<${returnType.listOptions
      .map((opt) => `"${opt}"`)
      .join(" | ")}>`;
  }

  if (returnType.type === "enum" && returnType.listOptions) {
    return returnType.listOptions.map((opt) => `"${opt}"`).join(" | ");
  }

  if (returnType.type === "material") {
    return MATERIAL_TYPE;
  }

  return typeMap[returnType.type];
}

function getReturnComment(returnType: ReturnType): string {
  if (returnType.type === "list") {
    return "an array of predefined values";
  }

  if (returnType.type === "material") {
    return "a material object";
  }

  return `a ${returnType.type} value`;
}

function getReturnHelperText(returnType: ReturnType): string {
  if (returnType.helperText) {
    return returnType.helperText;
  }

  if (returnType.type === "list") {
    return `an array containing any of: [${returnType.listOptions
      ?.map((opt) => `"${opt}"`)
      .join(", ")}]`;
  }

  if (returnType.type === "enum" && returnType.listOptions) {
    return `one of: ${returnType.listOptions
      .map((opt) => `"${opt}"`)
      .join(" | ")}`;
  }

  if (returnType.type === "material") {
    return "a material object";
  }

  return `a ${returnType.type} value`;
}

function getDefaultReturnValue(
  returnType: ReturnType,
  defaultValue?: string | number | boolean | string[] | null
): string {
  switch (returnType.type) {
    case "text":
      return defaultValue ? `"${defaultValue}"` : '"test"';
    case "numeric":
      return defaultValue?.toString() ?? "1";
    case "boolean":
      return defaultValue?.toString() ?? "true";
    case "enum":
      return `"${defaultValue ?? returnType.listOptions?.[0]}"`;
    case "material":
      return `{
      id: "",
      materialFormId: null,
      materialSubstanceId: null,
      materialTypeId: null,
      dimensionId: null,
      finishId: null,
      gradeId: null,
    }`;
    case "list":
      return returnType.listOptions
        ? `[${returnType.listOptions.map((opt) => `"${opt}"`).join(", ")}]`
        : "[]";
    default:
      return "[]";
  }
}

export function generateDefaultCode(
  params: Parameter[],
  returnType: ReturnType,
  defaultCode?: string,
  defaultValue?: string | number | boolean | string[] | null
): string {
  const parameterTypes = params.map(getParameterTypeString).join("\n ");

  const returnTypeStr = getReturnTypeString(returnType);
  const returnComment = getReturnComment(returnType);
  const returnHelperText = getReturnHelperText(returnType);
  const defaultReturnValue = getDefaultReturnValue(returnType, defaultValue);

  return `
/** 
  * Configure function that processes the provided params
  * @returns ${returnComment}
 ${parameterTypes}
**/

function configure(params: Params): ${returnTypeStr} {
  // return ${returnHelperText}
  ${defaultCode ? defaultCode : `return ${defaultReturnValue};`}
}`;
}

export function getDefaultValue(
  type: ConfiguratorDataType,
  listOptions: string[] | null
): string | MaterialValue {
  switch (type) {
    case "numeric":
      return "1";
    case "text":
      return "test";
    case "boolean":
      return "true";
    case "list":
    case "enum":
      return listOptions?.[0] ?? "";
    case "material":
      return {
        id: "item_1234567890",
        materialFormId: "plate",
        materialSubstanceId: "steel",
        materialTypeId: null,
        dimensionId: "plate-1/4",
        finishId: null,
        gradeId: "steel-a36"
      };
    case "date":
      return new Date().toISOString();
    default:
      return "";
  }
}

export function generateTypeDefinitions(
  params: Parameter[],
  returnType: ReturnType
): string {
  const properties = params
    .map((parameter) => {
      let typeStr: string;

      if (parameter.type === "list" && parameter.config?.options) {
        typeStr = parameter.config.options.map((opt) => `"${opt}"`).join(" | ");
      } else if (parameter.type === "material") {
        typeStr = MATERIAL_TYPE;
      } else {
        typeStr = parameter.type;
      }

      const comment = `/** ${parameter.name} - ${parameter.type} parameter */`;
      return `    ${comment}\n    ${parameter.name}: ${typeStr};`;
    })
    .join("\n\n");

  const returnTypeStr = getReturnTypeString(returnType);

  return `
declare type Params = {
${properties}
}

/**
 * Configure function that processes the provided params
 * @param params The params object containing all available params
 * @returns A value matching the selected return type
 */
declare function configure(params: Params): ${returnTypeStr};
`;
}

export async function convertTypescriptToJavaScript(
  code: string
): Promise<string> {
  const { transpileRule } = await import("@carbon/database/configuration-rule");
  return transpileRule(code);
}

```

### Core Architecture Module: `apps/erp/app/components/Form/emptyStates.tsx`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
// including ports, remain AGPLv3; serving them over a network requires releasing their source.

import { FieldEmptyState, fieldEmptyStateLinkClassName } from "@carbon/form";
import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { usePermissions } from "~/hooks";
import { path } from "~/utils/path";

type Action = "view" | "create" | "update" | "delete";

type EntityCopy = {
  module: string;
  action: Action;
  route: string;
  noun: string;
  pluralNoun: string;
  moduleLabel: string;
};

export type EntityKey =
  | "supplier"
  | "customer"
  | "location"
  | "costCenter"
  | "department"
  | "shift"
  | "process"
  | "workCenter"
  | "employee"
  | "paymentTerm"
  | "shippingMethod"
  | "ability"
  | "assetClass"
  | "customerType"
  | "customerStatus"
  | "supplierType"
  | "itemPostingGroup"
  | "materialType"
  | "procedure"
  | "scrapReason"
  | "storageType"
  | "part"
  | "material"
  | "tool"
  | "service"
  | "consumable"
  | "customerContact"
  | "customerLocation"
  | "supplierContact"
  | "supplierLocation"
  | "supplierProcess"
  | "item"
  | "gauge"
  | "storageUnit"
  | "unitOfMeasure"
  | "materialDimension"
  | "materialFinish"
  | "materialGrade"
  | "materialSubstance"
  | "materialShape";

const useEntityCopy = (entity: EntityKey): EntityCopy => {
  const { t } = useLingui();
  switch (entity) {
    case "supplier":
      return {
        module: "purchasing",
        action: "create",
        route: path.to.newSupplier,
        noun: t`supplier`,
        pluralNoun: t`suppliers`,
        moduleLabel: t`purchasing`
      };
    case "customer":
      return {
        module: "sales",
        action: "create",
        route: path.to.newCustomer,
        noun: t`customer`,
        pluralNoun: t`customers`,
        moduleLabel: t`sales`
      };
    case "location":
      return {
        module: "resources",
        action: "create",
        route: path.to.newLocation,
        noun: t`location`,
        pluralNoun: t`locations`,
        moduleLabel: t`resources`
      };
    case "costCenter":
      return {
        module: "accounting",
        action: "create",
        route: path.to.newCostCenter,
        noun: t`cost center`,
        pluralNoun: t`cost centers`,
        moduleLabel: t`accounting`
      };
    case "department":
      return {
        module: "people",
        action: "create",
        route: path.to.newDepartment,
        noun: t`department`,
        pluralNoun: t`departments`,
        moduleLabel: t`people`
      };
    case "shift":
      return {
        module: "people",
        action: "create",
        route: path.to.newShift,
        noun: t`shift`,
        pluralNoun: t`shifts`,
        moduleLabel: t`people`
      };
    case "process":
      return {
        module: "resources",
        action: "create",
        route: path.to.newProcess,
        noun: t`process`,
        pluralNoun: t`processes`,
        moduleLabel: t`resources`
      };
    case "workCenter":
      return {
        module: "resources",
        action: "update",
        route: path.to.newWorkCenter,
        noun: t`work center`,
        pluralNoun: t`work centers`,
        moduleLabel: t`resources`
      };
    case "employee":
      return {
        module: "users",
        action: "create",
        route: path.to.newEmployee,
        noun: t`employee`,
        pluralNoun: t`employees`,
        moduleLabel: t`users`
      };
    case "paymentTerm":
      return {
        module: "accounting",
        action: "create",
        route: path.to.newPaymentTerm,
        noun: t`payment term`,
        pluralNoun: t`payment terms`,
        moduleLabel: t`accounting`
      };
    case "shippingMethod":
      return {
        module: "inventory",
        action: "create",
        route: path.to.newShippingMethod,
        noun: t`shipping method`,
        pluralNoun: t`shipping methods`,
        moduleLabel: t`inventory`
      };
    case "ability":
      return {
        module: "resources",
        action: "create",
        route: path.to.newAbility,
        noun: t`ability`,
        pluralNoun: t`abilities`,
        moduleLabel: t`resources`
      };
    case "assetClass":
      return {
        module: "accounting",
        action: "create",
        route: path.to.newAssetClass,
        noun: t`asset class`,
        pluralNoun: t`asset classes`,
        moduleLabel: t`accounting`
      };
    case "customerType":
      return {
        module: "sales",
        action: "create",
        route: path.to.newCustomerType,
        noun: t`customer type`,
        pluralNoun: t`customer types`,
        moduleLabel: t`sales`
      };
    case "customerStatus":
      return {
        module: "sales",
        action: "create",
        route: path.to.newCustomerStatus,
        noun: t`customer status`,
        pluralNoun: t`customer statuses`,
        moduleLabel: t`sales`
      };
    case "supplierType":
      return {
        module: "purchasing",
        action: "create",
        route: path.to.newSupplierType,
        noun: t`supplier type`,
        pluralNoun: t`supplier types`,
        moduleLabel: t`purchasing`
      };
    case "itemPostingGroup":
      return {
        module: "parts",
        action: "create",
        route: path.to.newItemPostingGroup,
        noun: t`item group`,
        pluralNoun: t`item groups`,
        moduleLabel: t`parts`
      };
    case "materialType":
      return {
        module: "parts",
        action: "create",
        route: path.to.newMaterialType,
        noun: t`material type`,
        pluralNoun: t`material types`,
        moduleLabel: t`parts`
      };
    case "procedure":
      return {
        module: "production",
        action: "create",
        route: path.to.newProcedure,
        noun: t`procedure`,
        pluralNoun: t`procedures`,
        moduleLabel: t`production`
      };
    case "scrapReason":
      return {
        module: "production",
        action: "create",
        route: path.to.newScrapReason,
        noun: t`scrap reason`,
        pluralNoun: t`scrap reasons`,
        moduleLabel: t`production`
      };
    case "storageType":
      return {
        module: "parts",
        action: "create",
        route: path.to.newStorageType,
        noun: t`storage type`,
        pluralNoun: t`storage types`,
        moduleLabel: t`parts`
      };
    case "part":
      return {
        module: "parts",
        action: "create",
        route: path.to.newPart,
        noun: t`part`,
        pluralNoun: t`parts`,
        moduleLabel: t`parts`
      };
    case "material":
      return {
        module: "parts",
        action: "create",
        route: path.to.newMaterial,
        noun: t`material`,
        pluralNoun: t`materials`,
        moduleLabel: t`parts`
      };
    case "tool":
      return {
        module: "parts",
        action: "create",
        route: path.to.newTool,
        noun: t`tool`,
        pluralNoun: t`tools`,
        moduleLabel: t`parts`
      };
    case "service":
      return {
        module: "parts",
        action: "create",
        route: path.to.newService,
        noun: t`service`,
        pluralNoun: t`services`,
        moduleLabel: t`parts`
      };
    case "consumable":
      return {
        module: "parts",
        action: "create",
        route: path.to.newConsumable,
        noun: t`consumable`,
        pluralNoun: t`consumables`,
        moduleLabel: t`parts`
      };
    case "customerContact":
      return {
        module: "sales",
        action: "create",
        route: path.to.customers,
        noun: t`contact`,
        pluralNoun: t`contacts`,
        moduleLabel: t`sales`
      };
    case "customerLocation":
      return {
        module: "sales",
        action: "create",
        route: path.to.customers,
        noun: t`location`,
        pluralNoun: t`locations`,
        moduleLabel: t`sales`
      };
    case "supplierContact":
      return {
        module: "purchasing",
        action: "create",
        route: path.to.suppliers,
        noun: t`contact`,
        pluralNoun: t`contacts`,
        moduleLabel: t`purchasing`
      };
    case "supplierLocation":
      return {
        module: "purchasing",
        action: "create",
        route: path.to.suppliers,
        noun: t`location`,
        pluralNoun: t`locations`,
        moduleLabel: t`purchasing`
      };
    case "supplierProcess":
      return {
        module: "purchasing",
        action: "create",
        route: path.to.suppliers,
        noun: t`supplier process`,
        pluralNoun: t`supplier processes`,
        moduleLabel: t`purchasing`
      };
    case "item":
      return {
        module: "parts",
        action: "create",
        route: path.to.parts,
        noun: t`item`,
        pluralNoun: t`items`,
        moduleLabel: t`parts`
      };
    case "gauge":
      return {
        module: "quality",
        action: "create",
        route: path.to.gauges,
        noun: t`gauge`,
        pluralNoun: t`gauges`,
        moduleLabel: t`quality`
      };
    case "storageUnit":
      return {
        module: "inventory",
        action: "create",
        route: path.to.storageUnits,
        noun: t`storage unit`,
        pluralNoun: t`storage units`,
        moduleLabel: t`inventory`
      };
    case "unitOfMeasure":
      return {
        module: "parts",
        action: "create",
        route: path.to.uoms,
        noun: t`unit of measure`,
        pluralNoun: t`units of measure`,
        moduleLabel: t`parts`
      };
    case "materialDimension":
      return {
        module: "parts",
        action: "create",
        route: path.to.materialDimensions,
        noun: t`dimension`,
        pluralNoun: t`dimensions`,
        moduleLabel: t`parts`
      };
    case "materialFinish":
      return {
        module: 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1190** (2026-07-23): **Stale supplier process data in bill of process dropdown after deletion**
  *Symptoms*: ## Problem  When a supplier process is deleted and the user navigates back to the bill of process, the deleted supplier still appears in the dropdown until a hard page refresh.  ## Root Cause  The `useSupplierProcesses` hook in `SupplierProcess.tsx` uses React Router's `useFetcher` which loads data fresh on mount with no caching. When navigating back to the bill of process, the fetcher still has stale data from before.    ## Acceptance Criteria  - [ ] Deleted supplier processes no longer appear in bill of process dropdown - [ ] No page refresh needed to see updated supplier list - [ ] Follows existing repo patterns with clientLoader/clientAction
  **Post-Mortem & Fix Analysis**:
  > ## Investigation Summary  This bug has already been fixed by prior work:  - **PR #1200** () changed the delete route's `clientAction` from `invalidateQueries` (marks stale but leaves data) to actually removing the cached data - **PR #1202** (`0005e8763`) refined it to a `processId`-scoped `setQueryData(key, null)`  Combined with the create/edit routes (which already clear the same cache) and the API route's `clientLoader`, navigating back = remount = fresh fetch. All three acceptance criteria are now satisfied:  ✅ Deleted supplier processes no longer appear in bill of process dropdown   ✅ No page refresh needed to see updated supplier list   ✅ Follows existing repo patterns with clientLoader/clientAction  **Closing as fixed by existing PRs.** Please verify on the next deploy and reopen if the issue persists.
  > ## Investigation Summary  This bug has already been fixed by prior work:  - **PR #1200** changed the delete route's `clientAction` from `invalidateQueries` (marks stale but leaves data) to actually removing the cached data - **PR #1202** refined it to a `processId`-scoped `setQueryData(key, null)`  Combined with the create/edit routes (which already clear the same cache) and the API route's `clientLoader`, navigating back = remount = fresh fetch. All three acceptance criteria are now satisfied:  ✅ Deleted supplier processes no longer appear in bill of process dropdown   ✅ No page refresh needed to see updated supplier list   ✅ Follows existing repo patterns with clientLoader/clientAction  **Closing as fixed by existing PRs.** Please verify on the next deploy and reopen if the issue persists.

- **Issue #1097** (2026-07-07): **fix: New Procedure modal X button doesn't close when navigating directly; add Cancel button**
  *Symptoms*: ## Problem  When navigating directly to `/x/production/procedures/new`, clicking the X button on the modal does nothing. Additionally, there is no Cancel button in the modal footer.  **Root cause (X button):** `onClose` called `navigate(-1)` — with no history stack (direct URL landing), this is a no-op. The modal never closes.  **Root cause (Cancel missing):** `ProcedureForm` footer only had a Save/Submit button; no Cancel was rendered.  ## Changes  ### `apps/erp/app/routes/x+/production+/procedures.new.tsx` - Changed `onClose={() => navigate(-1)}` → `onClose={() => navigate(path.to.procedures)}`   - Ensures the modal always navigates away regardless of history state  ### `apps/erp/app/modules/production/ui/Procedures/ProcedureForm.tsx` - Added `Button` import from `@carbon/react` - Added Cancel button in `ModalDrawerFooter` next to Save, calling `onClose()`  ## Acceptance  - [ ] Navigating directly to `/x/production/procedures/new` and clicking X closes the modal and navigates to `/x/production/procedures` - [ ] Cancel button appears in the footer next to Save - [ ] Clicking Cancel closes the modal the same way as X - [ ] Saving still works as before  Reported by Naveen in Slack.

- **Issue #1081** (2026-07-06): **Redis resilience: health endpoint + observability**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1083 (resilient wrapper, merged) — can be built in parallel with #1078 and #1080.  ## Context Anshul's PR #1083 adds `withResilience()` in `packages/kv/src/resilient.ts` and already emits a throttled `console.warn` on Redis unavailability and a `console.info` on reconnect (via `logUnavailable` / `logReconnected`). This ticket surfaces that signal in a health endpoint and promotes the log events to structured observability.  ## What to build  ### 1. Health endpoint Add or extend a `/health` route in `apps/erp` that reports Redis reachability: - Response: `{ status: 'healthy' | 'degraded', redis: 'up' | 'down' }` (JSON) - Check Redis with a single `PING` call using `redis.ping()` from `@carbon/kv` — the resilience wrapper will return `null` instead of throwing if Redis is down, so a `null` response means down - Return HTTP 200 in both cases — health endpoints should always respond - Short implicit timeout from the wrapper's `REDIS_TIMEOUT_MS` (2s) is sufficient; no need for extra timeout logic  ### 2. Structured degraded-state logging Promote the existing `logUnavailable` / `logReconnected` calls in `resilient.ts` to structured log events: - On transition to degraded: emit `{ event: 'redis.degraded', message: '...' }` - On recovery: emit `{ event: 'redis.recovered' }` - Already throttled (one log per transition) — keep that behavior  ## Acceptance Criteria - `GET /health` returns `{ status: 'healthy
  **Post-Mortem & Fix Analysis**:
  > ✅ Shipped: PR #1086 — all acceptance criteria met, now ready for review.  - GET /health returns `{status:'healthy',redis:'up'}` (HTTP 200) when Redis running - GET /health returns `{status:'degraded',redis:'down'}` (HTTP 200) when Redis.ping() → null - Route is unauthenticated - `resilient.ts` already emitted `redis.degraded`/`redis.recovered` structured JSON events with one-log-per-transition throttle (no change needed) - Vitest 2 passed ✅, `erp tsc --noEmit` clean ✅, Biome clean ✅
  > PR #1086 was merged ✅ — closing.

- **Issue #1080** (2026-07-06): **Redis resilience: migrate remaining cache consumers (printing, ERP server files)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1083 (resilient wrapper, merged).  ## Context Anshul's PR #1083 wraps the `@carbon/kv` Redis client at the Proxy level inside `withResilience()`. All consumers that import `redis` from `@carbon/kv` automatically get fail-soft behavior — reads resolve `null` (collections `[]`), writes resolve `null`, no thrown errors. No per-call-site migration needed.  ## Scope Verify and harden remaining cache consumers (non-auth, non-rate-limit). Review null-handling logic in each consumer to make sure they treat a `null` return as a cache miss and fall through to the source of truth.  ## What to verify  1. **`packages/printing/src/cache.server.ts`** — confirm cache reads treat `null` as a miss; writes are fire-and-forget (no throw on fail) 2. **`apps/erp/app/modules/shared/*.server.ts`** — same review 3. **`apps/erp/app/modules/settings/*.server.ts`** — same review 4. **`apps/erp/app/modules/users/*.server.ts`** — same review 5. **`apps/erp/app/routes/api+/docs.ts`** — same review 6. Grep for any `import.*ioredis` consumers that bypass `@carbon/kv` and still call the raw client — those need to import through `@carbon/kv` instead  ## What to build (if any consumer assumes non-null) Fix the null-handling logic in that consumer. Do **not** add try/catch for connectivity — the wrapper already handles that. Just handle `null` as a cache miss.  ## Acceptance Criteria - Grep confirms no raw `import.*ioredis` in app/pa

- **Issue #1079** (2026-07-06): **Redis resilience: rate-limiter fail-safe (app + edge function)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1077 (resilient wrapper).  ## Scope Rate limiting must not block login/auth when Redis is down. Migrate rate-limit consumers to fail-open (or bounded in-memory fallback) behavior and document the security trade-off.  ## Files to migrate - `packages/kv/src/ratelimit/` — app rate limiter - `packages/database/supabase/functions/lib/ratelimit.ts` — edge function rate limiter  ## Fallback policy On Redis failure, rate limiting should **fail open** (allow the request) with a warning log. Alternatively, a bounded in-memory window limiter may be used as a degraded-mode fallback. Either way: - No thrown error propagated to caller - No blocking of auth/login flows - The security trade-off (temporarily allowing requests above the rate limit) must be explicitly documented in a code comment and PR description  ## Acceptance Criteria - With Redis stopped, login and authenticated API requests proceed (are not rate-limit-blocked) - Rate limiter failure emits a warning log (not an error that surfaces to the user) - Security trade-off documented in code + PR description - Unit tests: Redis-down → fail-open behavior asserted for both app and edge limiter - TypeScript and biome clean (edge function may need separate type checks)
  **Post-Mortem & Fix Analysis**:
  > Covered by #1083 (Anshul's PR). The `Ratelimit` class already fails open — `failOpen()` returns `{ success: true }` on any Redis error, and `ratelimit.ts` has a timeout guard that also calls `failOpen()`. No additional work needed.

- **Issue #1078** (2026-07-06): **Redis resilience: migrate auth path (getClaims, session, verification, passkey)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1083 (resilient wrapper + rate limiter, merged).  ## Context Anshul's PR #1083 wraps the `@carbon/kv` Redis client at the Proxy level inside `withResilience()`. All consumers that import `redis` from `@carbon/kv` automatically get fail-soft behavior — no per-call-site changes needed. The `client.ts` singleton is already wrapped.  ## Scope Verify and harden the auth path end-to-end. The resilience wrapper handles the Redis errors; this ticket is about ensuring the fallback logic in auth code is correct and tested.  ## What to verify and build  1. **`getClaims` (users.server.ts):** Confirm that when `redis.get()` returns `null` (cache miss / Redis down), the function falls through to the DB lookup instead of returning stale or empty claims. No code change needed if it already treats `null` as a miss — but add the test. 2. **Session / verification / passkey services:** Review each for any assumptions that Redis will return a non-null value. If a service interprets `null` as a failure rather than a miss, fix the null-handling logic. 3. **Tests:** Add Redis-down unit tests for each auth service (use `ioredis-mock` per `@carbon/kv` conventions, or mock `@carbon/kv` to return `null`):    - `getClaims` with Redis returning null → DB lookup succeeds → returns correct claims    - Session / verification / passkey paths don't throw when cache returns null  ## Acceptance Criteria (Redis stopped = `docker stop 
  **Post-Mortem & Fix Analysis**:
  > Dropped `agent:working` — stale lease cleaned up. This issue is part of the Redis resilience epic (#1077–#1081) which was paused per Brad's direction on 2026-07-06. Worktree removed. Issue remains assigned; ready to pick back up when directed.
  > All acceptance criteria met — PR opened: https://github.com/crbnos/carbon/pull/1084  **What was done:** - Hardened `@carbon/auth` Redis null-handling: wrapped claims-caching `redis.set` in `getUserClaims` try/catch, documented fail-closed intent in `verifyEmailCode`, fire-and-forget on session `redis.del`, confirmed passkey callers null-guard `getAndDelete*` results - Added `auth-redis-resilience.test.ts` covering all 6 Redis-down cases (getUserClaims DB fallback, sendVerificationCode returns false, verifyEmailCode returns false, both passkey getAndDelete* return null, updateCompanySession no crash) - All gates pass: typecheck ✅ lint ✅ tests ✅  Completed in 11 iterations.

- **Issue #1077** (2026-07-06): **Redis resilience: wrapper + tests in @carbon/kv (foundation)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app).  ## Scope Introduce a resilient accessor layer in `packages/kv/src/client.ts` so all consumers can safely tolerate Redis outages without adding ad-hoc try/catch at each call site.  ## What to build  1. **`withRedis<T>(fn: (client) => Promise<T>, fallback: T): Promise<T>` helper** in `packages/kv/src/client.ts`:    - Wraps any Redis command with a per-call timeout (e.g. 500ms)    - Catches all connection/command errors (ECONNREFUSED, command timeouts, ioredis offline-queue full)    - Returns `fallback` on any error — never throws    - Logs degraded state on first failure + recovery when Redis reconnects (debounced, not per-request)    - Does not change `enableOfflineQueue` / `retryStrategy` defaults (those govern reconnection, not call safety)  2. **Convenience wrappers:** `safeGet(key) => string | null`, `safeSet(key, value, options?) => void`, `safeDel(key) => void` — all using `withRedis` internally, returning typed defaults on failure.  3. **ioredis-mock unit tests** covering:    - Normal path: returns real data    - Redis-down (mock `ioredis` throws): returns fallback, no throw, logs degraded    - Redis-recovery: subsequent call succeeds after mock is restored  ## Acceptance Criteria - `withRedis` exported from `packages/kv/src/index.ts`; convenience wrappers exported alongside - No caller can trigger an unhandled rejection via `withRedis`/`safeGet`/`safeSet`/`safeDel` - Unit tests pass with `ioredis-mock
  **Post-Mortem & Fix Analysis**:
  > Shipped. PR #1082: https://github.com/crbnos/carbon/pull/1082  **What shipped:** - `withRedis<T>(fn)` wrapper: catches `IORedisError`, short-circuits on unhealthy state, uses 500ms command timeout - Debounced `logDegraded` / `logRecovered` (5s cooldown) so logs don't spam on flapping - `safeGet` / `safeSet` / `safeDel` convenience helpers that call through `withRedis` - 62-test ioredis-mock suite covering normal ops, Redis-down fallback, timeout, and recovery - All re-exported from `@carbon/kv` index — zero consumer call sites changed  Typecheck (tsgo) + biome lint clean. Checks passing. Ready for review.
  > 🤖 **Carbon Agent starting build**  Building [#1077 — Redis resilience: wrapper + tests in @carbon/kv (foundation)](https://github.com/crbnos/carbon/issues/1077).  **Plan:** - Add `withRedis<T>(fn, fallback)` helper in `packages/kv/src/client.ts` with 500ms per-call timeout and full error catch - Add convenience wrappers: `safeGet`, `safeSet`, `safeDel`   - Export from `packages/kv/src/index.ts` - Unit tests with `ioredis-mock`: normal path, Redis-down fallback, recovery - No consumer migrations in this PR (foundation only)  Part of epic #1076 resilience series.
  > ✅ **Build shipped — PR ready for review**  PR: https://github.com/crbnos/carbon/pull/1082  **What was built:** - `withRedis<T>(fn, fallback)` helper in `packages/kv/src/client.ts` — 500ms per-call timeout, catches all Redis errors (ECONNREFUSED, timeouts, offline queue full), returns fallback without throwing - Debounced `logDegraded`/`logRecovered` logger (once per 10s, not per request) - `safeGet`, `safeSet`, `safeDel` convenience wrappers, all using `withRedis` internally - All four exported from `packages/kv/src/index.ts` - `packages/kv/src/client.test.ts` — ioredis-mock vitest suite (62 tests) covering: normal path, Redis-down fallback, 500ms timeout, recovery - No consumer call sites changed (foundation only, as specified)  **Gates:** lint ✓, conformance ✓, clobbers ✓, typecheck ✓, unit tests ✓  **Iterations:** 6 (checkpoints to keep final state clean) **Review requested from:** @barbinbrad

- **Issue #1076** (2026-07-06): **Redis downtime kills the entire app (critical resilience vulnerability)**
  *Symptoms*: ## Problem  `@carbon/kv` exposes a single global `ioredis` client (`packages/kv/src/client.ts`) used across the app for permission-claim caching (`packages/auth/src/services/users.server.ts`), login/API rate limiting (`packages/kv/src/ratelimit/`), print caching (`packages/printing/src/cache.server.ts`), session/verification/passkey flows (`packages/auth/src/services/`), and edge-function rate limiting (`packages/database/supabase/functions/lib/ratelimit.ts`).  Almost every consumer `await`s a Redis command directly with no try/catch and no fallback. When Redis is unreachable, the client exhausts its 3 retries and rejects; that rejection propagates up. Because `getClaims` runs on effectively every authenticated request, a Redis outage turns into a full application outage rather than degraded service.  There is no circuit breaker, no read-through to the source of truth, and no health signal. Any Redis crash, OOM kill, container restart, memory exhaustion, or app↔Redis network partition takes the whole app down.  ## Impact  - **Severity:** Critical — single point of failure for a multi-tenant production app. - **Blast radius:** Full outage across all users and all tenants; not scoped to one module. - **Triggers:** Redis crash, OOM kill, container/host restart, Redis memory exhaustion, network partition. - **Current behavior:** Redis-dependent code paths reject/hang; auth claim lookup fails → 5xx on nearly every request. - **Expected behavior:** App degrades gracefully — cache m
  **Post-Mortem & Fix Analysis**:
  > ## Decomposition  This is epic-sized (`complexity: critical`) — breaking into 5 ordered child issues. Landing order matters: the foundation wrapper must ship first; the consumer migrations and health endpoint can run in parallel after that.  **Child issues (in dependency order):**  1. **#1077** — Resilient wrapper + tests in `@carbon/kv` (foundation — no consumer changes yet) 2. **#1078** — Auth path migration: `getClaims`, session, verification, passkey (highest blast radius, ship first) 3. **#1079** — Rate-limiter fail-safe: app + edge function (security trade-off documented) 4. **#1080** — Remaining cache consumers: printing, ERP server files 5. **#1081** — Health endpoint + observability (can run parallel to 2-4 after 1 lands)  Building #1077 first.
  > 🤖 **Progress update — Phase 1 of 5 complete**  The foundation PR for this resilience epic has shipped:  - **#1077 → PR #1082** — `withRedis` wrapper + `safeGet`/`safeSet`/`safeDel` + ioredis-mock unit tests in `@carbon/kv`   - Status: ✅ Ready for review (@barbinbrad)  **Remaining child issues (in order):** - #1078 — Auth path migration (getClaims + session/verification/passkey) - #1079 — Rate-limiter fail-safe (app + edge function)   - #1080 — Remaining cache consumers (printing, ERP server files) - #1081 — Health endpoint + observability  Each child builds on the foundation from #1082. Recommend reviewing and merging the foundation PR before dispatching #1078.

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

### Incident Patch 1: `c355c00f` (2026-10-06)
**Commit Message**: fix(production): plural toasts and plain release messages

The job and batch count toasts and menu labels are ICU plurals, built in
function-declaration hooks so the plural macro binds to the context i18n
inside the memo-wrapped tables; Polish and Russian get their few and many
forms. The release path's failure messages no longer name an internal job
id — the toast and the job page already name the job.

**File**: `.claude/rules/i18n-lingui-system.md` (modified, +4/-2)
```diff
@@ -103,8 +103,10 @@ its query; delete it once Lingui strips the query itself.
   to a call — `memo((props) => …)`, which is most ERP tables — Lingui 6.9.0 expands it
   into a call on the global `@lingui/core` instance instead, which throws at runtime
   for the reason above. Extract, typecheck and Biome do not catch it. There, build the
-  string in a function-declaration hook, or choose between two whole `t` phrases
-  (`JobsTable.tsx`, `BatchesTable.tsx`). No app code calls `plural()` today.
+  string in a function-declaration hook (`useReleasedJobsMessage` in `JobsTable.tsx`,
+  `useBatchCountMessages` in `BatchesTable.tsx`) and call the hook from the component.
+  Verify a new one by compiling the file (Vite `transformRequest`) and checking that no
+  `@lingui/core` import appears.
 
 ## Adding strings / locales
 
```

**File**: `apps/erp/app/modules/production/production.server.ts` (modified, +5/-5)
```diff
@@ -116,7 +116,7 @@ export async function releaseJobs({
       companyId,
       userId
     });
-    if (recalc.error) return fail(`Failed to recalculate job ${id}`);
+    if (recalc.error) return fail("The job could not be recalculated");
 
     // A failed plan never blocks a release: the scheduled MRP run (every 3
     // hours) and Material Planning's Recalculate both repair it.
@@ -144,9 +144,9 @@ export async function releaseJobs({
       updatedBy: userId,
       fromStatuses: ["Draft", "Planned"]
     });
-    if (update.error) return fail(`Failed to release job ${id}`);
+    if (update.error) return fail("The job could not be released");
     if (!update.updated) {
-      return fail(`Job ${id} is no longer Draft or Planned`);
+      return fail("The job is no longer Draft or Planned");
     }
     releasedJobIds.push(id);
 
@@ -159,7 +159,7 @@ export async function releaseJobs({
       });
     if (purchaseOrder.error) {
       return fail(
-        `Job ${id} is released, but its purchase orders could not be created: ${getErrorMessage(
+        `The job is released, but its purchase orders could not be created: ${getErrorMessage(
           purchaseOrder.error,
           "unknown error"
         )}`
@@ -184,7 +184,7 @@ export async function releaseJobs({
         error: stamped.error
       });
       return fail(
-        `Job ${id} is released, but its release date could not be saved`
+        "The job is released, but its release date could not be saved"
       );
     }
   }
```

**File**: `apps/erp/app/modules/production/ui/Batches/BatchesTable.tsx` (modified, +34/-19)
```diff
@@ -15,6 +15,7 @@ import {
   toast
 } from "@carbon/react";
 import { BATCH_STATUS_COLOR_MAP } from "@carbon/utils";
+import { plural } from "@lingui/core/macro";
 import { Trans, useLingui } from "@lingui/react/macro";
 import type { ColumnDef } from "@tanstack/react-table";
 import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
@@ -73,8 +74,29 @@ export function BatchStatus({ status }: { status: string | null }) {
   );
 }
 
+// A function declaration on purpose: `plural()` nested in `t` inside a
+// `memo(…)` component compiles to the global i18n, which is never activated
+// (see .claude/rules/i18n-lingui-system.md).
+function useBatchCountMessages() {
+  const { t } = useLingui();
+  return useMemo(
+    () => ({
+      release: (count: number) =>
+        t`${plural(count, { one: "Release # batch", other: "Release # batches" })}`,
+      released: (count: number) =>
+        t`${plural(count, { one: "Released # batch", other: "Released # batches" })}`,
+      dissolve: (count: number) =>
+        t`${plural(count, { one: "Dissolve # batch", other: "Dissolve # batches" })}`,
+      dissolved: (count: number) =>
+        t`${plural(count, { one: "Dissolved # batch", other: "Dissolved # batches" })}`
+    }),
+    [t]
+  );
+}
+
 const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
   const { t } = useLingui();
+  const countMessages = useBatchCountMessages();
   const permissions = usePermissions();
   const navigate = useNavigate();
   const canUpdate = permissions.can("update", "production");
@@ -203,11 +225,7 @@ const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
       return;
     }
     if (d.dissolved) {
-      toast.success(
-        d.dissolved === 1
-          ? t`Dissolved 1 batch`
-          : t`Dissolved ${d.dissolved} batches`
-      );
+      toast.success(countMessages.dissolved(d.dissolved));
     }
     if (d.failed?.length) {
       toast.error(
@@ -216,7 +234,7 @@ const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
           .join(", ")} — production already recorded`
       );
     }
-  }, [dissolveFetcher.state, dissolveFetcher.data, t]);
+  }, [dissolveFetcher.state, dissolveFetcher.data, t, countMessages]);
 
   // Bulk release for the selected rows — Planned batches only (release is the
   // Planned → Active flip; Active/Completing/Completed batches are already on or
@@ -243,11 +261,7 @@ const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
       return;
     }
     if (d.released) {
-      toast.success(
-        d.released === 1
-          ? t`Released 1 batch`
-          : t`Released ${d.released} batches`
-      );
+      toast.success(countMessages.released(d.released));
     }
     if (d.failed?.length) {
       toast.error(
@@ -256,7 +270,12 @@ const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
           .join(", ")}`
       );
     }
-  }, [releaseBatchesFetcher.state, releaseBatchesFetcher.data, t]);
+  }, [
+    releaseBatchesFetcher.state,
+    releaseBatchesFetcher.data,
+    t,
+    countMessages
+  ]);
 
   const renderActions = useCallback(
     (selectedRows: JobOperationBatch[]) => {
@@ -284,9 +303,7 @@ const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
             }
           >
             <DropdownMenuIcon icon={<LuCirclePlay />} />
-            {releasable.length === 1
-              ? t`Release 1 batch`
-              : t`Release ${releasable.length} batches`}
+            {countMessages.release(releasable.length)}
           </DropdownMenuItem>
           <DropdownMenuItem
             destructive
@@ -303,14 +320,12 @@ const BatchesTable = memo(({ data, count }: BatchesTableProps) => {
             }
           >
             <DropdownMenuIcon icon={<LuTrash />} />
-            {dissolvable.length === 1
-              ? t`Dissolve 1 batch`
-              : t`Dissolve ${dissolvable.length} batches`}
+            {countMessages.dissolve(dissolvable.length)}
           </DropdownMenuItem>
         </DropdownMenuContent>
       );
     },
-    [canUpdate, dissolveFetcher, releaseBatchesFetcher, t]
+    [canUpdate, dissolveFetcher, releaseBatchesFetcher, countMessages]
   );
 
   const customColumns =
```

**File**: `apps/erp/app/modules/production/ui/Jobs/JobsTable.tsx` (modified, +12/-5)
```diff
@@ -26,6 +26,7 @@ import {
   parseDate,
   today
 } from "@internationalized/date";
+import { plural } from "@lingui/core/macro";
 import { Trans, useLingui } from "@lingui/react/macro";
 import type { ColumnDef } from "@tanstack/react-table";
 import { memo, useCallback, useEffect, useMemo, useState } from "react";
@@ -152,10 +153,20 @@ function useReadableTrackedEntities(data: Job[], companyId: string) {
   return trackedEntities;
 }
 
+// A function declaration on purpose: `plural()` nested in `t` inside a
+// `memo(…)` component compiles to the global i18n, which is never activated
+// (see .claude/rules/i18n-lingui-system.md).
+function useReleasedJobsMessage() {
+  const { t } = useLingui();
+  return (count: number) =>
+    t`${plural(count, { one: "Released # job", other: "Released # jobs" })}`;
+}
+
 const JobsTable = memo((props: JobsTableProps) => {
   const { data, count, tags, batchesByJobId = {} } = props;
   const navigate = useNavigate();
   const { t } = useLingui();
+  const releasedJobsMessage = useReleasedJobsMessage();
   const [params] = useUrlParams();
   const parts = useParts();
   const tools = useTools();
@@ -697,11 +708,7 @@ const JobsTable = memo((props: JobsTableProps) => {
     onSuccess: (result) => {
       if (!result.success) return;
       if (result.released) {
-        toast.success(
-          result.released === 1
-            ? t`Released 1 job`
-            : t`Released ${result.released} jobs`
-        );
+        toast.success(releasedJobsMessage(result.released));
       }
       if (result.warnings.length) {
         toast.error(
```

**File**: `apps/erp/app/routes/x+/job+/release.test.ts` (modified, +2/-2)
```diff
@@ -277,7 +277,7 @@ describe("bulk job release", () => {
     vi.mocked(releaseJobs).mockImplementation(async ({ jobIds }) => ({
       error:
         jobIds[0] === "j1"
-          ? "Job j1 is released, but its purchase orders could not be created: no supplier currency"
+          ? "The job is released, but its purchase orders could not be created: no supplier currency"
           : null,
       purchaseOrdersBySupplierId: {},
       releasedJobIds: jobIds
@@ -292,7 +292,7 @@ describe("bulk job release", () => {
         {
           readableId: "J1",
           message:
-            "Job j1 is released, but its purchase orders could not be created: no supplier currency"
+            "The job is released, but its purchase orders could not be created: no supplier currency"
         }
       ]
     });
```

**File**: `apps/erp/test/release-jobs.test.ts` (modified, +2/-2)
```diff
@@ -83,7 +83,7 @@ describe("releaseJobs", () => {
       fromStatuses: ["Draft", "Planned"]
     });
     expect(result).toEqual({
-      error: "Job job-1 is no longer Draft or Planned",
+      error: "The job is no longer Draft or Planned",
       purchaseOrdersBySupplierId: {},
       releasedJobIds: []
     });
@@ -94,7 +94,7 @@ describe("releaseJobs", () => {
       clientWith({ error: { message: "connection reset" } })
     );
     expect(result).toEqual({
-      error: "Job job-1 is released, but its release date could not be saved",
+      error: "The job is released, but its release date could not be saved",
       purchaseOrdersBySupplierId: {},
       releasedJobIds: ["job-1"]
     });
```

**File**: `packages/locale/locales/de/erp.po` (modified, +15/-35)
```diff
@@ -319,6 +319,21 @@ msgstr "{count, plural, one {# Konto mit einem Saldo} other {# Konten mit Salden
 msgid "{count, plural, one {# course} other {# courses}}"
 msgstr "{count, plural, one {# Kurs} other {# Kurse}}"
 
+msgid "{count, plural, one {Dissolve # batch} other {Dissolve # batches}}"
+msgstr "{count, plural, one {# Los auflösen} other {# Lose auflösen}}"
+
+msgid "{count, plural, one {Dissolved # batch} other {Dissolved # batches}}"
+msgstr "{count, plural, one {# Los aufgelöst} other {# Lose aufgelöst}}"
+
+msgid "{count, plural, one {Release # batch} other {Release # batches}}"
+msgstr "{count, plural, one {# Los freigeben} other {# Lose freigeben}}"
+
+msgid "{count, plural, one {Released # batch} other {Released # batches}}"
+msgstr "{count, plural, one {# Los freigegeben} other {# Lose freigegeben}}"
+
+msgid "{count, plural, one {Released # job} other {Released # jobs}}"
+msgstr "{count, plural, one {# Fertigungsauftrag freigegeben} other {# Fertigungsaufträge freigegeben}}"
+
 msgid "{days}d"
 msgstr "{days}T"
 
@@ -6392,26 +6407,12 @@ msgstr "Verwendungsentscheide"
 msgid "Dissolve"
 msgstr "Auflösen"
 
-#. placeholder {0}: dissolvable.length
-msgid "Dissolve {0} batches"
-msgstr "Auflösen {0} Chargen"
-
-msgid "Dissolve 1 batch"
-msgstr "1 Los auflösen"
-
 msgid "Dissolve batch"
 msgstr "Batch auflösen"
 
 msgid "Dissolve Batch"
 msgstr "Batch auflösen"
 
-#. placeholder {0}: d.dissolved
-msgid "Dissolved {0} batches"
-msgstr "Aufgelöst {0} Chargen"
-
-msgid "Dissolved 1 batch"
-msgstr "1 Los aufgelöst"
-
 #. placeholder {0}: batch.readableId
 msgid "Dissolving {0} returns its {memberCount} operations to the schedule un-run and deletes the batch. A batch with recorded production must be completed instead."
 msgstr "Das Auflösen von {0} gibt seine {memberCount} Arbeitsgänge als nicht ausgeführt zur Planung zurück und löscht das Los. Ein Los mit erfasster Produktion muss stattdessen abgeschlossen werden."
@@ -14867,13 +14868,6 @@ msgstr "Relative Zeitleiste · Daten müssen noch bestätigt werden"
 msgid "Release"
 msgstr "Freigeben"
 
-#. placeholder {0}: releasable.length
-msgid "Release {0} batches"
-msgstr "{0} Lose freigeben"
-
-msgid "Release 1 batch"
-msgstr "1 Los freigeben"
-
 msgid "Release Batch"
 msgstr "Los freigeben"
 
@@ -14900,20 +14894,6 @@ msgstr "Fertigungsaufträge freigeben"
 msgid "Released"
 msgstr "Freigegeben"
 
-#. placeholder {0}: d.released
-msgid "Released {0} batches"
-msgstr "{0} Lose freigegeben"
-
-#. placeholder {0}: result.released
-msgid "Released {0} jobs"
-msgstr "{0} Fertigungsaufträge freigegeben"
-
-msgid "Released 1 batch"
-msgstr "1 Los freigegeben"
-
-msgid "Released 1 job"
-msgstr "1 Fertigungsauftrag freigegeben"
-
 msgid "Released date"
 msgstr "Freigabedatum"
 
```

**File**: `packages/locale/locales/en/erp.po` (modified, +15/-35)
```diff
@@ -319,6 +319,21 @@ msgstr "{count, plural, one {# account with a balance} other {# accounts with a
 msgid "{count, plural, one {# course} other {# courses}}"
 msgstr "{count, plural, one {# course} other {# courses}}"
 
+msgid "{count, plural, one {Dissolve # batch} other {Dissolve # batches}}"
+msgstr "{count, plural, one {Dissolve # batch} other {Dissolve # batches}}"
+
+msgid "{count, plural, one {Dissolved # batch} other {Dissolved # batches}}"
+msgstr "{count, plural, one {Dissolved # batch} other {Dissolved # batches}}"
+
+msgid "{count, plural, one {Release # batch} other {Release # batches}}"
+msgstr "{count, plural, one {Release # batch} other {Release # batches}}"
+
+msgid "{count, plural, one {Released # batch} other {Released # batches}}"
+msgstr "{count, plural, one {Released # batch} other {Released # batches}}"
+
+msgid "{count, plural, one {Released # job} other {Released # jobs}}"
+msgstr "{count, plural, one {Released # job} other {Released # jobs}}"
+
 msgid "{days}d"
 msgstr "{days}d"
 
@@ -6392,26 +6407,12 @@ msgstr "Dispositions"
 msgid "Dissolve"
 msgstr "Dissolve"
 
-#. placeholder {0}: dissolvable.length
-msgid "Dissolve {0} batches"
-msgstr "Dissolve {0} batches"
-
-msgid "Dissolve 1 batch"
-msgstr "Dissolve 1 batch"
-
 msgid "Dissolve batch"
 msgstr "Dissolve batch"
 
 msgid "Dissolve Batch"
 msgstr "Dissolve Batch"
 
-#. placeholder {0}: d.dissolved
-msgid "Dissolved {0} batches"
-msgstr "Dissolved {0} batches"
-
-msgid "Dissolved 1 batch"
-msgstr "Dissolved 1 batch"
-
 #. placeholder {0}: batch.readableId
 msgid "Dissolving {0} returns its {memberCount} operations to the schedule un-run and deletes the batch. A batch with recorded production must be completed instead."
 msgstr "Dissolving {0} returns its {memberCount} operations to the schedule un-run and deletes the batch. A batch with recorded production must be completed instead."
@@ -14867,13 +14868,6 @@ msgstr "Relative timeline · dates to be confirmed"
 msgid "Release"
 msgstr "Release"
 
-#. placeholder {0}: releasable.length
-msgid "Release {0} batches"
-msgstr "Release {0} batches"
-
-msgid "Release 1 batch"
-msgstr "Release 1 batch"
-
 msgid "Release Batch"
 msgstr "Release Batch"
 
@@ -14900,20 +14894,6 @@ msgstr "Release Jobs"
 msgid "Released"
 msgstr "Released"
 
-#. placeholder {0}: d.released
-msgid "Released {0} batches"
-msgstr "Released {0} batches"
-
-#. placeholder {0}: result.released
-msgid "Released {0} jobs"
-msgstr "Released {0} jobs"
-
-msgid "Released 1 batch"
-msgstr "Released 1 batch"
-
-msgid "Released 1 job"
-msgstr "Released 1 job"
-
 msgid "Released date"
 msgstr "Released date"
 
```

---

### Incident Patch 2: `b93f3e13` (2026-10-06)
**Commit Message**: fix(production): refuse a malformed bulk release body

The job and batch bulk release routes validate the request body with a
schema and answer a plain refusal, instead of a 500, when it is not JSON
or not the shape the table sends.

**File**: `apps/erp/app/routes/x+/job+/release.test.ts` (modified, +24/-0)
```diff
@@ -333,6 +333,30 @@ describe("bulk job release", () => {
     expect(released.slice(0, 3)).toEqual(["j0", "j1", "j2"]);
   });
 
+  it("refuses a body that is not the table's shape", async () => {
+    setup([]);
+    const malformed = (body: string) =>
+      action({
+        request: new Request("http://localhost/x/job/release", {
+          method: "POST",
+          body,
+          headers: { "Content-Type": "application/json" }
+        }),
+        params: {},
+        context: {}
+      } as any);
+
+    expect(await malformed("not json")).toEqual({
+      success: false,
+      message: "Invalid request"
+    });
+    expect(await malformed(JSON.stringify({ jobIds: "j1" }))).toEqual({
+      success: false,
+      message: "Invalid request"
+    });
+    expect(releaseJobs).not.toHaveBeenCalled();
+  });
+
   it("refuses an empty selection", async () => {
     setup([]);
     expect(await run([])).toEqual({
```

**File**: `apps/erp/app/routes/x+/job+/release.tsx` (modified, +10/-2)
```diff
@@ -9,13 +9,16 @@ import { getLogger } from "@carbon/logger";
 import { runLocationSchedule } from "@carbon/planning";
 import { chunkArray } from "@carbon/utils";
 import type { ActionFunctionArgs } from "react-router";
+import { z } from "zod";
 import { getJobReleaseReadiness } from "~/modules/production";
 import { releaseJobs } from "~/modules/production/production.server";
 import { jobReleaseProblems } from "~/modules/production/ui/Jobs/job-release-logic";
 import { getDatabaseClient } from "~/services/database.server";
 
 const logger = getLogger("erp", "job-release");
 
+const bodySchema = z.object({ jobIds: z.array(z.string()) });
+
 // Bulk release — the jobs table's "Release Jobs" action. Each selected Draft /
 // Planned job goes through the job page's release path (releaseJobs) on its
 // own: a job that is not ready is reported in `failed` while the rest still
@@ -29,8 +32,13 @@ export async function action({ request }: ActionFunctionArgs) {
     update: "production"
   });
 
-  const { jobIds } = (await request.json()) as { jobIds?: string[] };
-  const ids = [...new Set((jobIds ?? []).filter(Boolean))];
+  // A body that is not JSON, or not the shape the table sends, is a plain
+  // refusal rather than a 500.
+  const body = bodySchema.safeParse(await request.json().catch(() => null));
+  if (!body.success) {
+    return { success: false as const, message: "Invalid request" };
+  }
+  const ids = [...new Set(body.data.jobIds.filter(Boolean))];
   if (ids.length === 0) {
     return { success: false as const, message: "No jobs selected" };
   }
```

**File**: `apps/erp/app/routes/x+/production+/batches.release.tsx` (modified, +10/-2)
```diff
@@ -6,6 +6,7 @@ import { assertIsPost } from "@carbon/auth";
 import { requirePermissions } from "@carbon/auth/auth.server";
 import { getErrorMessage } from "@carbon/utils";
 import type { ActionFunctionArgs } from "react-router";
+import { z } from "zod";
 import {
   notifyScheduleInputsChanged,
   releaseJobOperationBatch
@@ -19,14 +20,21 @@ import { getDatabaseClient } from "~/services/database.server";
 // released — the caller filters, and any non-Planned id is refused here too so a
 // stale selection can't flip an Active/Completing batch. Fetcher-driven; the
 // table toasts the summary and the loader revalidates.
+const bodySchema = z.object({ batchIds: z.array(z.string()) });
+
 export async function action({ request }: ActionFunctionArgs) {
   assertIsPost(request);
   const { client, companyId, userId } = await requirePermissions(request, {
     update: "production"
   });
 
-  const { batchIds } = (await request.json()) as { batchIds?: string[] };
-  const ids = [...new Set((batchIds ?? []).filter(Boolean))];
+  // A body that is not JSON, or not the shape the table sends, is a plain
+  // refusal rather than a 500.
+  const body = bodySchema.safeParse(await request.json().catch(() => null));
+  if (!body.success) {
+    return { success: false, message: "Invalid request" };
+  }
+  const ids = [...new Set(body.data.batchIds.filter(Boolean))];
   if (ids.length === 0) {
     return { success: false, message: "No batches selected" };
   }
```

---

### Incident Patch 3: `7cbbdce3` (2026-10-05)
**Commit Message**: Merge pull request #1849 from crbnos/naveenkash/invoice-customer-field-fix

fix(invoicing): finish the Invoice Customer change and scope new-invoice pickers to it

**File**: `apps/erp/app/modules/invoicing/invoicing.models.test.ts` (modified, +69/-1)
```diff
@@ -7,7 +7,9 @@ import {
   invoiceSettlementValidator,
   isInvoicePayable,
   memoValidator,
-  paymentValidator
+  paymentValidator,
+  purchaseInvoiceSupplierChange,
+  salesInvoiceCustomerChange
 } from "./invoicing.models";
 
 describe("paymentValidator", () => {
@@ -347,3 +349,69 @@ describe("memoValidator", () => {
     ).toBe(false);
   });
 });
+
+describe("salesInvoiceCustomerChange", () => {
+  it("sets the invoice customer and clears its contact and location", () => {
+    expect(salesInvoiceCustomerChange("cust_billing", null)).toEqual({
+      invoiceCustomerId: "cust_billing",
+      invoiceCustomerContactId: null,
+      invoiceCustomerLocationId: null
+    });
+  });
+
+  it("never writes the sold-to customer", () => {
+    for (const currency of [
+      null,
+      { currencyCode: "EUR", exchangeRate: 0.92 }
+    ]) {
+      expect(
+        salesInvoiceCustomerChange("cust_billing", currency)
+      ).not.toHaveProperty("customerId");
+    }
+  });
+
+  it("keeps the invoice currency when the customer has none", () => {
+    const change = salesInvoiceCustomerChange("cust_billing", null);
+    expect(change).not.toHaveProperty("currencyCode");
+    expect(change).not.toHaveProperty("exchangeRate");
+  });
+
+  it("takes the customer's currency and rate when it has one", () => {
+    expect(
+      salesInvoiceCustomerChange("cust_billing", {
+        currencyCode: "EUR",
+        exchangeRate: 0.92
+      })
+    ).toMatchObject({ currencyCode: "EUR", exchangeRate: 0.92 });
+  });
+});
+
+describe("purchaseInvoiceSupplierChange", () => {
+  it("sets the invoice supplier and clears its contact and location", () => {
+    expect(purchaseInvoiceSupplierChange("supp_billing", null)).toEqual({
+      invoiceSupplierId: "supp_billing",
+      invoiceSupplierContactId: null,
+      invoiceSupplierLocationId: null
+    });
+  });
+
+  it("never writes the supplier", () => {
+    for (const currency of [
+      null,
+      { currencyCode: "EUR", exchangeRate: 0.92 }
+    ]) {
+      expect(
+        purchaseInvoiceSupplierChange("supp_billing", currency)
+      ).not.toHaveProperty("supplierId");
+    }
+  });
+
+  it("takes the supplier's currency and rate when it has one", () => {
+    expect(
+      purchaseInvoiceSupplierChange("supp_billing", {
+        currencyCode: "EUR",
+        exchangeRate: 0.92
+      })
+    ).toMatchObject({ currencyCode: "EUR", exchangeRate: 0.92 });
+  });
+});
```

**File**: `apps/erp/app/modules/invoicing/invoicing.models.ts` (modified, +36/-0)
```diff
@@ -76,6 +76,42 @@ export function isSalesInvoiceLocked(
   return status !== null && status !== undefined && status !== "Draft";
 }
 
+type InvoiceCurrency = { currencyCode: string; exchangeRate: number };
+
+/**
+ * The columns written when a sales invoice's invoice customer changes. It
+ * never writes `customerId`, the sold-to customer. A customer with no
+ * currency (`currency` null) leaves the invoice's currency as it is.
+ */
+export function salesInvoiceCustomerChange(
+  invoiceCustomerId: string,
+  currency: InvoiceCurrency | null
+) {
+  return {
+    invoiceCustomerId,
+    invoiceCustomerContactId: null,
+    invoiceCustomerLocationId: null,
+    ...currency
+  };
+}
+
+/**
+ * The columns written when a purchase invoice's invoice supplier changes. It
+ * never writes `supplierId`. A supplier with no currency (`currency` null)
+ * leaves the invoice's currency as it is.
+ */
+export function purchaseInvoiceSupplierChange(
+  invoiceSupplierId: string,
+  currency: InvoiceCurrency | null
+) {
+  return {
+    invoiceSupplierId,
+    invoiceSupplierContactId: null,
+    invoiceSupplierLocationId: null,
+    ...currency
+  };
+}
+
 export const purchaseInvoiceValidator = z.object({
   id: zfd.text(z.string().optional()),
   invoiceId: zfd.text(z.string().optional()),
```

**File**: `apps/erp/app/modules/invoicing/ui/SalesInvoice/SalesInvoiceForm.test.tsx` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
+// including ports, remain AGPLv3; serving them over a network requires releasing their source.
+
+import type { ReactNode } from "react";
+import { createElement } from "react";
+import { renderToStaticMarkup } from "react-dom/server";
+import { describe, expect, it, vi } from "vitest";
+
+vi.mock("@carbon/auth", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("@carbon/auth")>()),
+  useCarbon: () => ({ carbon: null })
+}));
+vi.mock("@carbon/form", () => ({
+  ValidatedForm: ({ children }: { children: ReactNode }) =>
+    createElement("form", null, children)
+}));
+vi.mock("@carbon/react", () => {
+  const Box = ({ children }: { children?: ReactNode }) =>
+    createElement("div", null, children);
+  return {
+    Card: Box,
+    CardContent: Box,
+    CardDescription: Box,
+    CardFooter: Box,
+    CardHeader: Box,
+    CardTitle: Box,
+    VStack: Box,
+    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
+    toast: { error: vi.fn() }
+  };
+});
+vi.mock("@lingui/react/macro", () => ({
+  Trans: ({ children }: { children: ReactNode }) => children,
+  useLingui: () => ({
+    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
+      parts.reduce(
+        (result, part, index) => result + part + (values[index] ?? ""),
+        ""
+      )
+  })
+}));
+// The two pickers under test render the customer they are scoped to.
+vi.mock("~/components/Form", () => {
+  const Field = () => null;
+  const ScopedPicker = ({
+    name,
+    customer
+  }: {
+    name: string;
+    customer?: string;
+  }) => createElement("input", { name, "data-customer": customer ?? "" });
+  return {
+    Currency: Field,
+    Customer: Field,
+    CustomerContact: ScopedPicker,
+    CustomerLocation: ScopedPicker,
+    CustomFormFields: Field,
+    DatePicker: Field,
+    Hidden: Field,
+    Input: Field,
+    Location: Field,
+    SequenceOrCustomId: Field,
+    Submit: Field
+  };
+});
+vi.mock("~/components/Form/PaymentTerm", () => ({ default: () => null }));
+vi.mock("~/hooks", () => ({
+  usePermissions: () => ({ can: () => true }),
+  useRouteData: () => undefined
+}));
+vi.mock("~/modules/invoicing", () => import("../../invoicing.models"));
+
+import SalesInvoiceForm from "./SalesInvoiceForm";
+
+function render() {
+  return renderToStaticMarkup(
+    createElement(SalesInvoiceForm, {
+      initialValues: {
+        customerId: "cust_sold_to",
+        invoiceCustomerId: "cust_billing",
+        locationId: "loc_1"
+      }
+    })
+  );
+}
+
+describe("SalesInvoiceForm", () => {
+  it.each([
+    "invoiceCustomerContactId",
+    "invoiceCustomerLocationId"
+  ])("scopes %s to the invoice customer, not the sold-to customer", (name) => {
+    expect(render()).toContain(`name="${name}" data-customer="cust_billing"`);
+  });
+});
```

**File**: `apps/erp/app/modules/invoicing/ui/SalesInvoice/SalesInvoiceForm.tsx` (modified, +2/-9)
```diff
@@ -70,18 +70,11 @@ const SalesInvoiceForm = ({ initialValues }: SalesInvoiceFormProps) => {
     paymentTermId: initialValues.paymentTermId
   });
 
-  const [customer, setCustomer] = useState<{
-    id: string | undefined;
-  }>({
-    id: initialValues.customerId
-  });
-
   const onCustomerChange = async (
     newValue: {
       value: string | undefined;
     } | null
   ) => {
-    setCustomer({ id: newValue?.value });
     if (newValue?.value !== invoiceCustomer.id) {
       onInvoiceCustomerChange(newValue);
     }
@@ -223,7 +216,7 @@ const SalesInvoiceForm = ({ initialValues }: SalesInvoiceFormProps) => {
               <CustomerLocation
                 name="invoiceCustomerLocationId"
                 label={t`Invoice Customer Location`}
-                customer={customer.id}
+                customer={invoiceCustomer.id}
                 value={invoiceCustomer.invoiceCustomerLocationId}
                 onChange={(newValue) => {
                   if (newValue?.id) {
@@ -237,7 +230,7 @@ const SalesInvoiceForm = ({ initialValues }: SalesInvoiceFormProps) => {
               <CustomerContact
                 name="invoiceCustomerContactId"
                 label={t`Invoice Customer Contact`}
-                customer={customer.id}
+                customer={invoiceCustomer.id}
                 value={invoiceCustomer.invoiceCustomerContactId}
                 onChange={(newValue) => {
                   if (newValue?.id) {
```

**File**: `apps/erp/app/routes/x+/purchase-invoice+/update.tsx` (modified, +34/-31)
```diff
@@ -3,12 +3,13 @@
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
 import { requirePermissions } from "@carbon/auth/auth.server";
-import { unchecked } from "@carbon/utils";
+import { datetime, unchecked } from "@carbon/utils";
 import type { ActionFunctionArgs } from "react-router";
 import { getExchangeRate } from "~/modules/accounting";
 import {
   computeInvoiceDateDue,
-  isPurchaseInvoiceLocked
+  isPurchaseInvoiceLocked,
+  purchaseInvoiceSupplierChange
 } from "~/modules/invoicing";
 import { requireUnlockedBulk } from "~/utils/lockedGuard.server";
 
@@ -46,46 +47,48 @@ export async function action({ request }: ActionFunctionArgs) {
   }
 
   switch (field) {
-    case "invoiceSupplierId":
-      let currencyCode: string | undefined;
-      if (value && ids.length === 1) {
-        const supplier = await client
-          ?.from("supplier")
-          .select("currencyCode")
-          .eq("id", value)
-          .single();
+    case "invoiceSupplierId": {
+      if (!value) {
+        return {
+          error: { message: "Invoice supplier is required" },
+          data: null
+        };
+      }
 
-        if (supplier.data?.currencyCode) {
-          currencyCode = supplier.data.currencyCode;
-          const rate = await getExchangeRate(client, companyId, currencyCode);
-          if (rate.error) return rate;
-          return await client
-            .from("purchaseInvoice")
-            .update({
-              invoiceSupplierId: value ?? undefined,
-              invoiceSupplierContactId: null,
-              invoiceSupplierLocationId: null,
-              currencyCode: currencyCode ?? undefined,
-              exchangeRate: rate.data,
-              updatedBy: userId,
-              updatedAt: new Date().toISOString()
-            })
-            .in("id", ids as string[]);
-        }
+      const supplier = await client
+        .from("supplier")
+        .select("currencyCode")
+        .eq("id", value)
+        .eq("companyId", companyId)
+        .single();
+      if (supplier.error) return supplier;
+
+      let currency: { currencyCode: string; exchangeRate: number } | null =
+        null;
+      if (supplier.data.currencyCode) {
+        const rate = await getExchangeRate(
+          client,
+          companyId,
+          supplier.data.currencyCode
+        );
+        if (rate.error) return rate;
+        currency = {
+          currencyCode: supplier.data.currencyCode,
+          exchangeRate: rate.data
+        };
       }
 
       // A supplier with no currency keeps the invoice's own. The contact and
       // location belonged to the previous invoice supplier.
       return await client
         .from("purchaseInvoice")
         .update({
-          invoiceSupplierId: value ?? undefined,
-          invoiceSupplierContactId: null,
-          invoiceSupplierLocationId: null,
+          ...purchaseInvoiceSupplierChange(value, currency),
           updatedBy: userId,
-          updatedAt: new Date().toISOString()
+          updatedAt: datetime.timestamp()
         })
         .in("id", ids as string[]);
+    }
     case "dateIssued":
       if (ids.length === 1) {
         const invoice = await client
```

**File**: `apps/erp/app/routes/x+/sales-invoice+/$invoiceId.details.tsx` (modified, +6/-99)
```diff
@@ -2,17 +2,16 @@
 // Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
-import { assertIsPost, error, success } from "@carbon/auth";
+import { error } from "@carbon/auth";
 import { requirePermissions } from "@carbon/auth/auth.server";
 import { flash } from "@carbon/auth/session.server";
-import { validationError, validator } from "@carbon/form";
 import type { JSONContent } from "@carbon/react";
 import { redirect } from "@carbon/utils";
 import { useLingui } from "@lingui/react/macro";
 import type { FileObject } from "@supabase/storage-js";
 import { useRef } from "react";
 import { Fragment } from "react/jsx-runtime";
-import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
+import type { LoaderFunctionArgs } from "react-router";
 import { useLoaderData, useParams } from "react-router";
 import { DeferredFiles } from "~/components";
 import { useRouteData, useUser } from "~/hooks";
@@ -24,10 +23,7 @@ import type {
 import {
   getInvoiceSettlementsForInvoice,
   getSalesInvoice,
-  InvoicePaymentsPanel,
-  isSalesInvoiceLocked,
-  salesInvoiceValidator,
-  updateSalesInvoice
+  InvoicePaymentsPanel
 } from "~/modules/invoicing";
 import type { SalesInvoiceShipmentFormRef } from "~/modules/invoicing/ui/SalesInvoice/SalesInvoiceShipmentForm";
 import SalesInvoiceShipmentForm from "~/modules/invoicing/ui/SalesInvoice/SalesInvoiceShipmentForm";
@@ -37,8 +33,7 @@ import {
   OpportunityDocuments,
   OpportunityNotes
 } from "~/modules/sales/ui/Opportunity";
-import { getCustomFields, setCustomFields } from "~/utils/form";
-import { requireUnlocked } from "~/utils/lockedGuard.server";
+import { getCustomFields } from "~/utils/form";
 import { path } from "~/utils/path";
 
 export async function loader({ request, params }: LoaderFunctionArgs) {
@@ -66,80 +61,6 @@ export async function loader({ request, params }: LoaderFunctionArgs) {
   };
 }
 
-export async function action({ request, params }: ActionFunctionArgs) {
-  assertIsPost(request);
-
-  const { invoiceId: id } = params;
-  if (!id) throw new Error("Could not find invoiceId");
-
-  // Check if SI is locked
-  const { client: viewClient } = await requirePermissions(request, {
-    view: "invoicing"
-  });
-
-  const invoice = await getSalesInvoice(viewClient, id);
-  if (invoice.error) {
-    throw redirect(
-      path.to.salesInvoice(id),
-      await flash(request, error(invoice.error, "Failed to load sales invoice"))
-    );
-  }
-
-  await requireUnlocked({
-    request,
-    isLocked: isSalesInvoiceLocked(invoice.data?.status),
-    redirectTo: path.to.salesInvoice(id),
-    message: "Cannot modify a locked sales invoice. Reopen it first."
-  });
-
-  const { client, userId } = await requirePermissions(request, {
-    update: "invoicing"
-  });
-
-  const formData = await request.formData();
-  const validation = await validator(salesInvoiceValidator).validate(formData);
-
-  if (validation.error) {
-    return validationError(validation.error);
-  }
-
-  const { invoiceId, ...d } = validation.data;
-  if (!invoiceId) throw new Error("Could not find invoiceId");
-
-  const result = await updateSalesInvoice(client, {
-    id,
-    invoiceId,
-    customerId: d.customerId,
-    customerReference: d.customerReference || null,
-    paymentTermId: d.paymentTermId || null,
-    currencyCode: d.currencyCode,
-    locationId: d.locationId,
-    invoiceCustomerId: d.invoiceCustomerId || null,
-    invoiceCustomerContactId: d.invoiceCustomerContactId || null,
-    invoiceCustomerLocationId: d.invoiceCustomerLocationId || null,
-    dateIssued: d.dateIssued || null,
-    dateDue: d.dateDue || null,
-    exchangeRate: d.exchangeRate,
-    exchangeRateUpdatedAt: d.exchangeRateUpdatedAt,
-    customFields: setCustomFields(formData),
-    updatedBy: userId
-  });
-  if (result.error) {
-    throw redirect(
-      path.to.salesInvoice(id),
-      await flash(
-        request,
-        error(result.error, "Failed to update sales invoice")
-      )
-    );
-  }
-
-  throw redirect(
-    path.to.salesInvoice(id),
-    await flash(request, success("Updated sales invoice"))
-  );
-}
-
 export default function SalesInvoiceBasicRoute() {
   const { t } = useLingui();
   const { internalNotes, paymentApplications } = useLoaderData<typeof loader>();
@@ -165,20 +86,6 @@ export default function SalesInvoiceBasicRoute() {
     shipmentFormRef.current?.focusShippingCost();
   };
 
-  const initialValues = {
-    id: salesInvoice.id ?? "",
-    invoiceId: salesInvoice.invoiceId ?? "",
-    customerId: salesInvoice.customerId ?? "",
-    customerReference: salesInvoice.customerReference ?? "",
-    invoiceCustomerId: salesInvoice.invoiceCustomerId ?? "",
-    paymentTermId: salesInvoice.paymentTermId ?? "",
-    currencyCode: salesInvoice.currencyCode ?? "",
-    dateIssued: salesInvoice.dateIssued ?? "",
-    dateDue: salesInvoi
```

**File**: `apps/erp/app/routes/x+/sales-invoice+/update.tsx` (modified, +34/-31)
```diff
@@ -3,12 +3,13 @@
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
 import { requirePermissions } from "@carbon/auth/auth.server";
-import { unchecked } from "@carbon/utils";
+import { datetime, unchecked } from "@carbon/utils";
 import type { ActionFunctionArgs } from "react-router";
 import { getExchangeRate } from "~/modules/accounting";
 import {
   computeInvoiceDateDue,
-  isSalesInvoiceLocked
+  isSalesInvoiceLocked,
+  salesInvoiceCustomerChange
 } from "~/modules/invoicing";
 import { requireUnlockedBulk } from "~/utils/lockedGuard.server";
 
@@ -45,46 +46,48 @@ export async function action({ request }: ActionFunctionArgs) {
   }
 
   switch (field) {
-    case "invoiceCustomerId":
-      let currencyCode: string | undefined;
-      if (value && ids.length === 1) {
-        const customer = await client
-          ?.from("customer")
-          .select("currencyCode")
-          .eq("id", value)
-          .single();
+    case "invoiceCustomerId": {
+      if (!value) {
+        return {
+          error: { message: "Invoice customer is required" },
+          data: null
+        };
+      }
 
-        if (customer.data?.currencyCode) {
-          currencyCode = customer.data.currencyCode;
-          const rate = await getExchangeRate(client, companyId, currencyCode);
-          if (rate.error) return rate;
-          return await client
-            .from("salesInvoice")
-            .update({
-              invoiceCustomerId: value ?? undefined,
-              invoiceCustomerContactId: null,
-              invoiceCustomerLocationId: null,
-              currencyCode: currencyCode ?? undefined,
-              exchangeRate: rate.data,
-              updatedBy: userId,
-              updatedAt: new Date().toISOString()
-            })
-            .in("id", ids as string[]);
-        }
+      const customer = await client
+        .from("customer")
+        .select("currencyCode")
+        .eq("id", value)
+        .eq("companyId", companyId)
+        .single();
+      if (customer.error) return customer;
+
+      let currency: { currencyCode: string; exchangeRate: number } | null =
+        null;
+      if (customer.data.currencyCode) {
+        const rate = await getExchangeRate(
+          client,
+          companyId,
+          customer.data.currencyCode
+        );
+        if (rate.error) return rate;
+        currency = {
+          currencyCode: customer.data.currencyCode,
+          exchangeRate: rate.data
+        };
       }
 
       // A customer with no currency keeps the invoice's own. The contact and
       // location belonged to the previous invoice customer.
       return await client
         .from("salesInvoice")
         .update({
-          invoiceCustomerId: value ?? undefined,
-          invoiceCustomerContactId: null,
-          invoiceCustomerLocationId: null,
+          ...salesInvoiceCustomerChange(value, currency),
           updatedBy: userId,
-          updatedAt: new Date().toISOString()
+          updatedAt: datetime.timestamp()
         })
         .in("id", ids as string[]);
+    }
     case "dateIssued":
       if (ids.length === 1) {
         const invoice = await client
```

---

### Incident Patch 4: `b8eb8fbf` (2026-10-05)
**Commit Message**: fix(production): report a job's release outcome truthfully

releaseJobs flips a job only while it is still Draft or Planned, so a job
someone cancelled during the recalculation and MRP is left alone, and it
returns the jobs that ARE Ready when it stops. A purchase order or
release-date failure after the flip is reported as released with a
problem and the job is still scheduled, in the bulk toast and on the job
page. A failed MRP run is logged and never blocks the release; the
scheduled run or Material Planning's Recalculate repairs it.

**File**: `apps/erp/app/modules/production/AGENTS.md` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ pnpm --filter @carbon/erp test
 
 - `convertSalesOrderLinesToJobs` — creates jobs from sales order Make to Order lines; each job takes the order line's `configuration` (else the converted quote line's, via `resolveJobConfiguration` in `~/modules/sales`) and is built with `itemToJob` instead of `quoteLineToJob` when the order line was reconfigured
 - `getJob` / `getJobs` / `getJobMethodTree` / `getJobMethodTreeArray` — job reads with method hierarchy
-- `releaseJobs` (`production.server.ts`) — the one release path (recalc, MRP, status Ready, outside-operation POs, releasedDate); returns the supplier→PO map with the POs it created so a caller releasing job by job keeps one PO per supplier. Callers: the job Release dialog (`$jobId.status.tsx`), batch release (`releaseBatchMemberJobs`), and the jobs table's bulk **Release Jobs** action (`x+/job+/release.tsx`, `path.to.bulkReleaseJob`). Bulk release has no dialog: each selected Draft/Planned job is checked on its own (`getJobReleaseReadiness` once for the selection — every read goes through `fetchAllByIds`, which sends each id list in groups of 100 (an `in` filter rides in the URL) and pages each group with `fetchAllRecords` (a page of jobs passes PostgREST's 1000-row cap); pinned by `test/job-release-readiness.test.ts` — `jobReleaseProblems` in `ui/Jobs/job-release-logic.ts`, plus zero quantity and — via the per-job `supplierIds` — a supplier with Draft POs to choose from); a job with a problem is skipped and named in the toast's `failed` list, the rest release, then `runLocationSchedule` runs once per location. Pinned by `routes/x+/job+/release.test.ts`
+- `releaseJobs` (`production.server.ts`) — the one release path (recalc, MRP, status Ready, outside-operation POs, releasedDate); returns the supplier→PO map with the POs it created so a caller releasing job by job keeps one PO per supplier, and `releasedJobIds` — the jobs that ARE Ready when it returns, so a PO failure after the flip is reported as "released, but …" and the job is still scheduled (bulk route `warnings`, job page flash). The flip is guarded: `updateJobStatus(..., { fromStatuses: ["Draft", "Planned"] })` adds `.in("status", …)` to the UPDATE and returns `updated: false` when the row no longer matched (someone cancelled or released it during the recalc/MRP), so the release stops instead of resurrecting the job; pinned by `test/job-status-guard.test.ts`. A failed MRP run is logged and never blocks the release (the 3-hourly MRP cron and Material Planning's Recalculate repair it); a failed `releasedDate` write is reported as "released, but …" because nothing else writes that date and the completion-time KPI reads it. Pinned by `test/release-jobs.test.ts`. Callers: the job Release dialog (`$jobId.status.tsx`), batch release (`releaseBatchMemberJobs`), and the jobs table's bulk **Release Jobs** action (`x+/job+/release.tsx`, `path.to.bulkReleaseJob`). Bulk release has no dialog: each selected Draft/Planned job is checked on its own (`getJobReleaseReadiness` once for the selection — every read goes through `fetchAllByIds`, which sends each id list in groups of 100 (an `in` filter rides in the URL) and pages each group with `fetchAllRecords` (a page of jobs passes PostgREST's 1000-row cap); pinned by `test/job-release-readiness.test.ts` — `jobReleaseProblems` in `ui/Jobs/job-release-logic.ts`, plus zero quantity and — via the per-job `supplierIds` — a supplier with Draft POs to choose from); a job with a problem is skipped and named in the toast's `failed` list, the rest release, then `runLocationSchedule` runs once per location. Pinned by `routes/x+/job+/release.test.ts`
 - `getJobMaterialsWithQuantityOnHand` — BOM with on-hand for shortfall visibility
 - `getJobMaterialShortfallByItem` — priority-adjusted shortfall calculation
 - `getJobOrderStatusMap` — procurement status indicators per material
```

**File**: `apps/erp/app/modules/production/production.server.ts` (modified, +61/-21)
```diff
@@ -6,6 +6,7 @@ import { getCarbonServiceRole } from "@carbon/auth/client.server";
 import type { Database } from "@carbon/database";
 import type { Kysely, KyselyDatabase } from "@carbon/database/client";
 import { ASSEMBLER_SERVICE_URL } from "@carbon/env";
+import { getLogger } from "@carbon/logger";
 import { serverFns } from "@carbon/server-functions";
 import { datetime, getErrorMessage } from "@carbon/utils";
 import type { SupabaseClient } from "@supabase/supabase-js";
@@ -17,6 +18,8 @@ import {
 } from "./production.service";
 import { jobReleaseProblems } from "./ui/Jobs/job-release-logic";
 
+const logger = getLogger("erp", "production");
+
 // The geometry (assembler) service backs model conversion and motion planning.
 // When it's unreachable those actions can't run, so loaders probe its health and
 // the UI soft-gates the assembler-dependent controls. Result cached so a
@@ -75,6 +78,9 @@ export async function isAssemblerServiceHealthy(): Promise<boolean> {
 // supplier's first "new" PO is reused for the jobs after it, so a batch puts
 // each supplier's outside operations from every member job on one PO. The map
 // is returned with those POs filled in, for a caller releasing job by job.
+// `releasedJobIds` are the jobs that ARE Ready when this returns — on an error
+// after the status flip (purchase orders) the job is released, and the caller
+// must still schedule it and say so.
 // Validation (getJobReleaseReadiness) is the caller's, BEFORE this runs.
 export async function releaseJobs({
   client,
@@ -93,37 +99,56 @@ export async function releaseJobs({
 }): Promise<{
   error: string | null;
   purchaseOrdersBySupplierId: Record<string, string>;
+  releasedJobIds: string[];
 }> {
   const serviceRole = getCarbonServiceRole();
   const purchaseOrders = { ...purchaseOrdersBySupplierId };
+  const releasedJobIds: string[] = [];
+  const fail = (error: string) => ({
+    error,
+    purchaseOrdersBySupplierId: purchaseOrders,
+    releasedJobIds
+  });
 
   for (const id of jobIds) {
     const recalc = await recalculateJobRequirements(serviceRole, db, {
       id,
       companyId,
       userId
     });
-    if (recalc.error) {
-      return {
-        error: `Failed to recalculate job ${id}`,
-        purchaseOrdersBySupplierId: purchaseOrders
-      };
-    }
+    if (recalc.error) return fail(`Failed to recalculate job ${id}`);
 
-    await runMRP(serviceRole, db, { type: "job", id, companyId, userId });
+    // A failed plan never blocks a release: the scheduled MRP run (every 3
+    // hours) and Material Planning's Recalculate both repair it.
+    const mrp = await runMRP(serviceRole, db, {
+      type: "job",
+      id,
+      companyId,
+      userId
+    });
+    if (mrp.error) {
+      logger.error("MRP failed during job release", {
+        companyId,
+        jobId: id,
+        error: mrp.error
+      });
+    }
 
+    // Only a job still waiting for release flips: the caller checked the
+    // status before the recalculation and MRP above, and someone may have
+    // cancelled or released it since.
     const update = await updateJobStatus(client, {
       id,
       companyId,
       status: "Ready",
-      updatedBy: userId
+      updatedBy: userId,
+      fromStatuses: ["Draft", "Planned"]
     });
-    if (update.error) {
-      return {
-        error: `Failed to release job ${id}`,
-        purchaseOrdersBySupplierId: purchaseOrders
-      };
+    if (update.error) return fail(`Failed to release job ${id}`);
+    if (!update.updated) {
+      return fail(`Job ${id} is no longer Draft or Planned`);
     }
+    releasedJobIds.push(id);
 
     const purchaseOrder = await serverFns
       .system({ db, companyId, userId })
@@ -133,26 +158,41 @@ export async function releaseJobs({
         purchaseOrdersBySupplierId: purchaseOrders
       });
     if (purchaseOrder.error) {
-      return {
-        error: getErrorMessage(
+      return fail(
+        `Job ${id} is released, but its purchase orders could not be created: ${getErrorMessage(
           purchaseOrder.error,
-          `Failed to create purchase orders for job ${id}`
-        ),
-        purchaseOrdersBySupplierId: purchaseOrders
-      };
+          "unknown error"
+        )}`
+      );
     }
     Object.assign(
       purchaseOrders,
       purchaseOrder.data?.purchaseOrderIdsBySupplierId ?? {}
     );
 
-    await client
+    // The date feeds the completion-time KPI and nothing else writes it, so a
+    // silent failure would be permanent.
+    const stamped = await client
       .from("job")
       .update({ releasedDate: datetime.timestamp() })
       .eq("id", id)
       .eq("companyId", companyId);
+    if (stamped.error) {
+      logger.error("Failed to stamp the release date", {
+        companyId,
+        jobId: id,
+        error: stamped.error
+      });
+      return fail(
+        `Job ${id} is released, but its release date could not be saved`
+      );
+    }
   }
-  return { error: null,
```

**File**: `apps/erp/app/modules/production/production.service.ts` (modified, +16/-5)
```diff
@@ -3177,9 +3177,14 @@ export async function updateJobStatus(
     status: (typeof jobStatus)[number];
     assignee?: string | null;
     updatedBy: string;
+    // Flip only from one of these statuses. A release reads the status, then
+    // runs for a while (recalculate, MRP) before it writes; a job someone
+    // cancelled in between must not come back as Ready. `updated` is false
+    // when the row no longer matched.
+    fromStatuses?: (typeof jobStatus)[number][];
   }
 ) {
-  const { id, companyId, status, assignee, updatedBy } = params;
+  const { id, companyId, status, assignee, updatedBy, fromStatuses } = params;
 
   // Reopening a job (leaving a completed state) must clear completedDate so it
   // isn't left stale. Done in the same UPDATE as status so the job event
@@ -3196,7 +3201,7 @@ export async function updateJobStatus(
     .eq("companyId", companyId)
     .maybeSingle();
 
-  const result = await client
+  const update = client
     .from("job")
     .update({
       status,
@@ -3205,9 +3210,15 @@ export async function updateJobStatus(
       updatedAt: new Date().toISOString(),
       ...(clearsCompletion ? { completedDate: null } : {})
     })
-    .eq("id", id);
+    .eq("id", id)
+    .eq("companyId", companyId);
+  const result = fromStatuses
+    ? await update.in("status", fromStatuses).select("id")
+    : await update;
+  const updated =
+    !result.error && (!fromStatuses || (result.data?.length ?? 0) > 0);
 
-  if (!result.error && prior.data && prior.data.status !== status) {
+  if (updated && prior.data && prior.data.status !== status) {
     if (status === "Ready") {
       await raiseMoment("production.jobReleased", {
         outputs: { job: { id }, releasedBy: { id: updatedBy } },
@@ -3231,7 +3242,7 @@ export async function updateJobStatus(
     }
   }
 
-  return result;
+  return { ...result, updated };
 }
 
 /** @mcp update */
```

**File**: `apps/erp/app/modules/production/ui/Jobs/JobsTable.tsx` (modified, +7/-0)
```diff
@@ -703,6 +703,13 @@ const JobsTable = memo((props: JobsTableProps) => {
             : t`Released ${result.released} jobs`
         );
       }
+      if (result.warnings.length) {
+        toast.error(
+          t`Released with problems: ${result.warnings
+            .map((w) => `${w.readableId} (${w.message})`)
+            .join(", ")}`
+        );
+      }
       if (result.failed.length) {
         toast.error(
           t`Could not release ${result.failed.length}: ${result.failed
```

**File**: `apps/erp/app/routes/api+/mcp+/lib/tool-manifest.digest.json` (modified, +1/-1)
```diff
@@ -791,7 +791,7 @@
     {"name":"production_updateJobOperationOrder","classification":"WRITE","paramCount":1,"schema":"c822495a7892","response":"646de62ab761","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false,"result":"envelopes"},
     {"name":"production_updateJobOperationStatus","classification":"WRITE","paramCount":2,"schema":"b22654081076","response":"ac4a3201b981","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false,"context":"updatedBy=userId"},
     {"name":"production_updateJobOperationStepOrder","classification":"WRITE","paramCount":1,"schema":"d19d08f2d129","response":"646de62ab761","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false,"result":"envelopes"},
-    {"name":"production_updateJobStatus","classification":"WRITE","paramCount":3,"schema":"bb0874693c4d","response":"bcde375ebd4c","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false},
+    {"name":"production_updateJobStatus","classification":"WRITE","paramCount":4,"schema":"458fa5786030","response":"8394fbabd845","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false},
     {"name":"production_updateKanbanJob","classification":"WRITE","paramCount":2,"schema":"2c22838be2d2","response":"bcde375ebd4c","injectAuth":"companyId+updatedBy+userId","permission":"production:update","paginates":false},
     {"name":"production_updateMethodOperationStepOrder","classification":"WRITE","paramCount":1,"schema":"d19d08f2d129","response":"646de62ab761","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false,"result":"envelopes"},
     {"name":"production_updateProcedureStepOrder","classification":"WRITE","paramCount":1,"schema":"d19d08f2d129","response":"646de62ab761","injectAuth":"companyId+updatedBy","permission":"production:update","paginates":false,"result":"envelopes"},
```

**File**: `apps/erp/app/routes/x+/job+/$jobId.status.test.ts` (modified, +5/-1)
```diff
@@ -88,7 +88,11 @@ vi.mock("~/modules/production/production.server", async () => {
           updatedBy: userId
         });
       }
-      return { error: null, purchaseOrdersBySupplierId: {} };
+      return {
+        error: null,
+        purchaseOrdersBySupplierId: {},
+        releasedJobIds: jobIds
+      };
     })
   };
 });
```

**File**: `apps/erp/app/routes/x+/job+/$jobId.status.tsx` (modified, +9/-0)
```diff
@@ -121,6 +121,15 @@ export async function action({ request, params }: ActionFunctionArgs) {
       )
     });
     if (released.error) {
+      // The job is Ready when it came back released (its purchase orders
+      // failed after the flip): schedule it, then say what failed.
+      if (released.releasedJobIds.includes(id)) {
+        try {
+          await scheduleJobLocation({ id, companyId, userId });
+        } catch (err) {
+          logger.error("Error", { error: err });
+        }
+      }
       throw redirect(
         requestReferrer(request) ?? path.to.job(id),
         await flash(request, error(null, released.error))
```

**File**: `apps/erp/app/routes/x+/job+/release.test.ts` (modified, +43/-6)
```diff
@@ -107,9 +107,10 @@ const run = (jobIds: string[]) =>
 beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(releaseJobs).mockImplementation(
-    async ({ purchaseOrdersBySupplierId }) => ({
+    async ({ jobIds, purchaseOrdersBySupplierId }) => ({
       error: null,
-      purchaseOrdersBySupplierId
+      purchaseOrdersBySupplierId,
+      releasedJobIds: jobIds
     })
   );
 });
@@ -138,6 +139,7 @@ describe("bulk job release", () => {
     expect(result).toEqual({
       success: true,
       released: 2,
+      warnings: [],
       failed: [],
       scheduled: true
     });
@@ -219,10 +221,11 @@ describe("bulk job release", () => {
       },
       error: null
     });
-    vi.mocked(releaseJobs).mockResolvedValue({
+    vi.mocked(releaseJobs).mockImplementation(async ({ jobIds }) => ({
       error: null,
-      purchaseOrdersBySupplierId: { "supplier-a": "po-new" }
-    });
+      purchaseOrdersBySupplierId: { "supplier-a": "po-new" },
+      releasedJobIds: jobIds
+    }));
 
     await run(["j1", "j2"]);
 
@@ -249,7 +252,8 @@ describe("bulk job release", () => {
     });
     vi.mocked(releaseJobs).mockImplementation(async ({ jobIds }) => ({
       error: jobIds[0] === "j2" ? "Failed to recalculate job j2" : null,
-      purchaseOrdersBySupplierId: {}
+      purchaseOrdersBySupplierId: {},
+      releasedJobIds: jobIds[0] === "j2" ? [] : jobIds
     }));
 
     const result = await run(["j1", "j2", "j3", "j4"]);
@@ -264,6 +268,39 @@ describe("bulk job release", () => {
     ).toEqual(["location-1", "location-2"]);
   });
 
+  it("counts and schedules a job released before its purchase orders failed", async () => {
+    setup([job("j1"), job("j2", { locationId: "location-2" })]);
+    vi.mocked(getJobReleaseReadiness).mockResolvedValue({
+      data: { jobs: [ready("j1"), ready("j2")], suppliers: [] },
+      error: null
+    });
+    vi.mocked(releaseJobs).mockImplementation(async ({ jobIds }) => ({
+      error:
+        jobIds[0] === "j1"
+          ? "Job j1 is released, but its purchase orders could not be created: no supplier currency"
+          : null,
+      purchaseOrdersBySupplierId: {},
+      releasedJobIds: jobIds
+    }));
+
+    const result = await run(["j1", "j2"]);
+
+    expect(result).toMatchObject({
+      released: 2,
+      failed: [],
+      warnings: [
+        {
+          readableId: "J1",
+          message:
+            "Job j1 is released, but its purchase orders could not be created: no supplier currency"
+        }
+      ]
+    });
+    expect(
+      vi.mocked(runLocationSchedule).mock.calls.map(([args]) => args.locationId)
+    ).toEqual(["location-1", "location-2"]);
+  });
+
   it("says so when the released jobs could not be scheduled", async () => {
     setup([job("j1")]);
     vi.mocked(getJobReleaseReadiness).mockResolvedValue({
```

---

### Incident Patch 5: `7b73e3bd` (2026-10-05)
**Commit Message**: Merge remote-tracking branch 'origin/main' into naveenkash/invoice-customer-field-fix

**File**: `.ai/lessons.md` (modified, +22/-0)
```diff
@@ -3025,3 +3025,25 @@ And a delete whose failure the caller ignores is not a delete: return the error.
 **Rule:** A prefetch only helps if the browser may reuse its response. Give a prefetch response (`Sec-Purpose: prefetch`) a short `private` lifetime and leave every other response uncached; `prefetchCacheMiddleware` (`@carbon/utils`) does it in each app's root `middleware`, the fix React Router points to (remix-run/react-router#13255). Measure a prefetch by click-to-page time, not by whether the request was sent. A first fix removed the prefetch instead (`6e3bdf7bc6`); it worked but threw away the head start.
 
 **Applies to:** `packages/react/src/PrefetchLink.tsx`; `packages/utils/src/prefetch.ts`; any `<Link prefetch>` or `PrefetchPageLinks`; a revalidation started while a navigation to the same URL is loading.
+
+
+## A revalidation during the navigation after a save loses the save
+
+**Context:** 186 layouts export `shouldRevalidate` and skip a GET navigation that leaves their params unchanged. Realtime calls `revalidate()` 300 ms after a broadcast.
+
+**Problem:** A save's own broadcast arrives while its redirect is still loading. `revalidate()` during a loading navigation restarts it with `overrideNavigation: state.navigation`, and for a fetcher submission that carries no `formMethod`. The restarted navigation looks like a plain one, so each layout returned `false` and kept its data from before the save: a new quote line was missing from the quote's explorer until a reload (2026-10-05). In single fetch `defaultShouldRevalidate` is `true` for every route on every navigation, so a predicate cannot tell a forced reload from a plain one. A first fix assumed React Router's default was `false` after a redirect with no cookie; logging the predicate's arguments in the browser showed the default was `true` and the first pass did include the layout.
+
+**Rule:** Never call React Router's `revalidate()` directly. Import `useRevalidator` from `@carbon/query`: it holds a call made while a navigation is in flight or a fetcher is submitting and runs it when the router is idle. The `no-raw-revalidator` check (`@carbon/checks`) fails an import of React Router's. Before explaining a skipped loader, log what `shouldRevalidate` received: wrap the route's `shouldRevalidate` on `window.__reactRouterDataRouter.routes` and read `formMethod`, `defaultShouldRevalidate` and both URLs for each call.
+
+**Applies to:** `packages/query/src/useRevalidator.ts`; every `revalidate()` call (realtime, polling timers, upload callbacks); every route that exports `shouldRevalidate`.
+
+
+## A drag re-rendered every card on the board
+
+**Context:** The schedule boards (operations, dates, batches) render one sortable card per operation or job, each with a form, avatars, tooltips and a menu.
+
+**Problem:** A drag stuttered: with 82 cards, six frames of a 90-frame sweep took over 100 ms. Two causes. dnd-kit re-renders every `useSortable` consumer when the drop target changes, and the hook sat inside the card, so every card's whole body rendered each time. And `useSensor(KeyboardSensor, { coordinateGetter })` passed a new options object on every render: dnd-kit memoizes the sensor on it, so every draggable got new `listeners`, which defeats `memo` on anything that takes them.
+
+**Rule:** A sortable card is a thin shell that calls `useSortable` and a `memo`ized body that takes plain props (`sortableCardProps` in `Schedule/Kanban/cardShell.ts`). `useSensor` options are a module constant (`no-inline-sensor-options` check). A context every card reads must have a stable value. To find what re-renders, count renders per component during a scripted drag; do not guess.
+
+**Applies to:** `apps/erp/app/modules/production/ui/Schedule/Kanban/**`; any dnd-kit board or list with more than a few dozen items.
```

**File**: `.ai/plans/2026-10-06-slow-request-fixes.md` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+# Slow request fixes: scheduler writes, maintenance dispatch, webhook timeout
+
+## Context
+
+Axiom traces for 2026-10-05 showed three avoidable costs. None is a slow query; each is too many sequential round trips.
+
+- **Reschedule (4.9 s of a 6.7 s job release, also operation delete).** `runLocationSchedule` re-plans every open job at the location. Each job costs about 17 statements in two transactions, so 28 jobs is about 500 statements. In prod 88% of jobs get new operation dates on every run, so skipping unchanged writes would not help. The fix is to compute every job in memory and write the location once.
+- **`carbon-dispatch` (40.7 s).** One `maintenanceSchedule` read per company. The company list is read without paging, so it stops at 1,000 of 1,284 companies: 284 companies never get preventive-maintenance dispatches. Only 31 companies have an active schedule.
+- **Webhook delivery.** `axios.post` to the customer URL has no timeout, so a hung endpoint holds the step until the platform kills it.
+
+Decisions already made with the user: keep the reschedule inline (no background wave); go the full depth (in-memory compute plus one write); a database error in that write fails the whole location run instead of one job. Inline PDFs are out of scope.
+
+Work on a new branch `perf/slow-request-fixes` off `main`, one commit per part. Copy this plan to `.ai/plans/2026-10-06-slow-request-fixes.md` first. No push without asking.
+
+---
+
+## Part 1: Maintenance dispatch (smallest, fixes a live bug)
+
+File: `packages/jobs/src/inngest/functions/scheduled/dispatch.ts`, the `dispatchFunction` body (lines 395-459).
+
+1. Replace the company loop with one paged read of every due schedule across companies: `fetchAllFromTable` (`@carbon/database`, same helper `scheduled/mrp.ts` uses) on `maintenanceSchedule`, `active = true` and `nextDueAt is null or <= now`.
+2. Read `companySettings (id, maintenanceDispatchNotificationGroup)` only for the companies that have a due schedule, with `.in("id", ids)` in chunks of 200.
+3. Loop the due schedules and call the existing `generateDispatchesForSchedule` unchanged (it stays one schedule at a time; that part is inherent and small).
+4. A failed read now throws so Inngest retries, instead of silently skipping a company.
+
+`generateMaintenanceForScheduleFunction` (on-demand, one schedule) is untouched.
+
+Expected: about 1,000 reads become 2-3; run time about 40 s to about 10 s; all 1,284 companies covered.
+
+## Part 2: Webhook timeout
+
+File: `packages/jobs/src/inngest/functions/events/webhook.ts:62`.
+
+- Add `timeout: 30_000` to the `axios.post` options.
+- 30 s, not 10 s: yesterday's handlers that took 8-14 s ended in `increment_webhook_success`, so a 10 s limit would turn deliveries that succeed today into failures and retries.
+- Add one line to `docs/content/docs/building/webhooks.mdx`: an endpoint that does not answer within 30 seconds counts as a failed attempt and is retried.
+
+## Part 3: Scheduler computes in memory, writes once
+
+All under `packages/planning/src/scheduling/`. `SchedulingEngine` is constructed only in `run-schedule.ts`, so the engine's write contract can change without touching callers.
+
+### 3a. Engine stops writing; it returns a write set
+
+`scheduling-engine.ts`, `material-manager.ts`.
+
+The engine has four write sites today. Each one records into a `JobWrites` value instead (`engine.getWrites()`):
+
+| Today | Becomes |
+|---|---|
+| `materialManager.assignOperationsToMaterials` (one UPDATE per material) and `assignMaterials` | `materialLinks: { materialId, jobOperationId }[]` |
+| `createDependencies` transaction (lock, delete, insert) | `dependencies: { reworkOpIds, records } \| null`, null when the computed edges equal the stored non-rework edges (already in memory from `initialize`) |
+| `createDependencies` Ready update | `readyOperationIds` |
+| `persistChanges` | `placements`, `reservations`, `job: { projectedCompletionAt }`, plus the existing newly-late calculation |
+
+Reads that used to follow the engine's own writes now apply the links in memory:
+- `assignMaterials`: unassigned Make to Order materials minus the ones already linked in this run.
+- `createDependencies`: `getMaterialsWithMakeMethod` rows with `jobOperationId` filled from the links.
+
+Side effect: the expedite what-if (`persist: false`) now sees the same material links a real run does. Today it skips them. This is the only intended behavior difference inside a run.
+
+### 3b. Provider serves earlier jobs' results from memory
+
+`master-data-provider.ts`. The provider already holds per-run state (`preload`, `companyCache`); add a run overlay next to it.
+
+- **Reservations.** `beginRun(batch)` loads live reservations once (no exclusions) and splits them: rows later jobs always see (non-batch jobs, batch-tagged rows) and each batch job's own old rows. `getLiveReservations` then answers from memory. After a job computes, its planned reservations re
```

**File**: `.claude/rules/realtime-system.md` (modified, +6/-2)
```diff
@@ -96,8 +96,12 @@ export const handle: Handle = {
 the matched routes and, 300 ms after the last message, invalidates the cached
 loader entries and revalidates the page. A burst is one reload; a route and a
 component following the same table reload once; a reload waits while a fetcher
-is submitting (React Router drops a fetcher's redirect when a revalidation
-starts during its action) and runs when it finishes.
+is submitting or a navigation is in flight, and runs when both are done
+(`useRevalidator` from `@carbon/query`, the only one app code may import). During
+an action React Router drops the fetcher's redirect; during the navigation that
+follows a save, a revalidation restarts it WITHOUT the submission, and every
+layout whose `shouldRevalidate` skips a plain navigation then keeps its data
+from before the save. The save's own broadcast arrives in exactly that window.
 
 - Update the list when the loader starts reading a new table. Nothing checks
   that a list is COMPLETE, only that each name can broadcast.
```

**File**: `.claude/rules/scheduling-data-structures.md` (modified, +21/-10)
```diff
@@ -248,8 +248,8 @@ is a separate per-job backward re-plan, not a whole-location regen.
 ## Engine pipeline (`scheduling-engine.ts` `run()`)
 
 `initialize → assignMaterials → createDependencies → calculateDates →
-computeNeedBys → selectWorkCenters → calculatePriorities → persistChanges` (the last
-is skipped when `persist: false`, i.e. the expedite what-if). **There is no backward
+computeNeedBys → selectWorkCenters → calculatePriorities → buildWrites` (the engine
+writes nothing; the location run stores the result, the expedite what-if drops it). **There is no backward
 JIT pass in PLACEMENT and no `initial`/`reschedule` mode split** — everything places
 FORWARD-ASAP, and the projected finish IS the overdue forecast (slack is real). The
 backward need-by pass (`computeNeedBys`, below) computes demand-anchored TARGETS
@@ -263,8 +263,18 @@ only; its output is read by nothing in the placement path (spec
   `dueDate ASC NULLS LAST → job.priority ASC → createdAt ASC` — so a no-due-date ASAP
   order claims capacity first. Each job's engine run **excludes the jobs not yet run
   (itself + later)** from the reservation snapshot, so it sees non-batch reservations
-  plus the just-persisted placements of already-run jobs → sequential capacity
-  claiming, no pre-clear step.
+  plus the placements of already-run jobs → sequential capacity
+  claiming, no pre-clear step. **Nothing is written while the jobs run.** The
+  engine only computes: `engine.getWrites()` returns a `JobWrites`
+  (`run-overlay.ts`), `provider.recordJob(writes)` makes that job's reservations
+  and operation placements visible to the jobs after it (`beginRun` reads the
+  live reservations once; the rules are the pure `visibleReservations` /
+  `mergeCrossJobOperations`), and `persistLocationWrites`
+  (`persist-location.ts`) stores the whole location in ONE transaction at the
+  end. A job that throws while computing is left out of the write and keeps its
+  stored reservations visible to later jobs; a database error in the write
+  rolls the location back and `runLocationSchedule` throws. This replaced a
+  write per job (about 17 statements each, 500 for a 28-job location).
 - **Sequencing** (`dependency-manager.ts`): the `jobOperation."operationOrder"` enum
   (`methodOperationOrder` = `'After Previous' | 'With Previous'`) decides serial vs
   parallel, plus assembly edges (a sub-make-method's last op feeds the parent's
@@ -369,19 +379,20 @@ only; its output is read by nothing in the placement path (spec
   dispatch-sequencing policy** — the old per-work-center policy table, its rule enum,
   and the FIFO/EDD/SPT/… comparators were all removed; placement order is the only
   sequence.
-- **`persistChanges` (one transaction, only when `persist`)** writes, for every op whose
-  values changed (`isDistinctFromAny` guards the UPDATE in SQL, so a quiet regen writes no
+- **`persistLocationWrites` (one transaction per location run; the expedite what-if
+  never calls it)** writes, for every op whose
+  values changed (an `is distinct from` guard in the UPDATE, so a quiet regen writes no
   `jobOperation` or `job` row and queues no audit/search event), the
   forward placement's results — `startDate` (projected start, business day) +
   `jobOperation.projectedCompletionAt` (exact placed-end instant, timestamptz) +
   `priority` + `workCenterId` + conflict flags. `dueDate` is the backward need-by and
   is DIFF-written: only when the computed target differs from the stored value (a
   quiet regen touches zero `dueDate`s), and never for a `manuallyScheduled` op — a
-  human owns that target. It rebuilds this job's `capacityReservation` rows
-  (delete-by-job where `scenarioId IS NULL`, then bulk insert — a materialized OUTPUT,
+  human owns that target. It rebuilds the jobs' `capacityReservation` rows
+  (one delete for all the run's jobs where `scenarioId IS NULL`, then bulk insert — a materialized OUTPUT,
   `WorkCenter`/`Employee` kinds); and writes `job.projectedCompletionAt` (= the max
   placed end, the forecast finish) while clearing
-  `scheduleOutdatedReason`/`scheduleOutdatedAt` for that job. It also computes the
+  `scheduleOutdatedReason`/`scheduleOutdatedAt` for each job. The engine's `buildWrites` also computes the
   **newly-late** flag (was on-time-or-unforecast before, now projected past `dueDate`
   on the location calendar) for the wave's digest.
 - **Behind-target attribution (informational only):** when the JOB's verdict is late,
@@ -401,7 +412,7 @@ only; its output is read by nothing in the placement path (spec
 (`20260525143721_manual-scheduling.sql` — adds only this column). Under dual dates a
 pin means **a human owns the need-by TARGET**, not the placement: the backward pass
 takes the pinned op's stored `dueDate` as-is and derives upstream ops' targets from
-it (the pin propagates), and `persistChanges()` never writes `dueDate` for a pinned
+it (the pin propagates), and the location write never includes `dueDate` for a p
```

**File**: `apps/erp/app/components/ActionTasks/Jira/IssueDialog.tsx` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 
 import type { ActionTaskEntityType } from "@carbon/ee/action-task-entity";
 import { JiraIssueMappingSchema } from "@carbon/ee/jira";
+import { useRevalidator } from "@carbon/query";
 import {
   Badge,
   Button,
@@ -26,7 +27,7 @@ import { Trans, useLingui } from "@lingui/react/macro";
 import { useState } from "react";
 import { LuExternalLink } from "react-icons/lu";
 import { PiLinkBreak } from "react-icons/pi";
-import { Link, useRevalidator } from "react-router";
+import { Link } from "react-router";
 import { JiraIcon, JiraIssueStatusBadge } from "~/components/Icons";
 import { useAsyncFetcher } from "~/hooks/useAsyncFetcher";
 import { path } from "~/utils/path";
```

**File**: `apps/erp/app/components/ActionTasks/Linear/IssueDialog.tsx` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 
 import type { ActionTaskEntityType } from "@carbon/ee/action-task-entity";
 import { LinearIssueSchema } from "@carbon/ee/linear";
+import { useRevalidator } from "@carbon/query";
 import {
   Badge,
   Button,
@@ -26,7 +27,7 @@ import { Trans, useLingui } from "@lingui/react/macro";
 import { useState } from "react";
 import { LuExternalLink } from "react-icons/lu";
 import { PiLinkBreak } from "react-icons/pi";
-import { Link, useRevalidator } from "react-router";
+import { Link } from "react-router";
 import { LinearIcon, LinearIssueStateBadge } from "~/components/Icons";
 import { useAsyncFetcher } from "~/hooks/useAsyncFetcher";
 import { path } from "~/utils/path";
```

**File**: `apps/erp/app/components/AttachmentsList.tsx` (modified, +1/-1)
```diff
@@ -9,6 +9,7 @@ import {
   storage
 } from "@carbon/files";
 import { MediaUploader, wasConvertedFromHeic } from "@carbon/files/media";
+import { useRevalidator } from "@carbon/query";
 import {
   Badge,
   HStack,
@@ -26,7 +27,6 @@ import { Trans, useLingui } from "@lingui/react/macro";
 import { useCallback, useMemo, useState } from "react";
 import { useDropzone } from "react-dropzone";
 import { LuCloudUpload, LuFileText, LuX } from "react-icons/lu";
-import { useRevalidator } from "react-router";
 import { useUser } from "~/hooks";
 import { stripSpecialCharacters } from "~/utils/string";
 
```

**File**: `apps/erp/app/components/CadModel.tsx` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@
 import { useCarbon } from "@carbon/auth";
 import { convertKbToString, TEMP_STAGING_BUCKET } from "@carbon/files";
 import { supportedModelTypes } from "@carbon/files/cad";
+import { useRevalidator } from "@carbon/query";
 import {
   Button,
   CardHeader,
@@ -32,7 +33,7 @@ import { nanoid } from "nanoid";
 import { useState } from "react";
 import { useDropzone } from "react-dropzone";
 import { LuCloudUpload, LuRefreshCw, LuZap } from "react-icons/lu";
-import { useFetcher, useRevalidator } from "react-router";
+import { useFetcher } from "react-router";
 import { useModelUpload, useUser } from "~/hooks";
 import type { ModelUpload } from "~/types";
 import type { ViewDirection } from "~/utils/model-thumbnail";
```

---

### Incident Patch 6: `c1ae854f` (2026-10-05)
**Commit Message**: Slow-request fixes: scheduler writes, schedule board, realtime reloads (#1850)

* fix(jobs): maintenance dispatch reads due schedules in one paged query

The nightly run read companySettings without paging, so it stopped at
1,000 of 1,284 companies, then made one maintenanceSchedule query per
company. It now reads every due schedule across companies in one paged
query and loads settings only for the companies that have one.

* fix(jobs): webhook delivery times out after 30 seconds

A customer endpoint that never answered held the delivery step open
until the platform ended it.

* perf(planning): a location schedule run computes in memory and writes once

Each job of a location run wrote its own dependencies, placements and
reservations (about 17 statements in two transactions), and the next job
read them back. The engine now only computes; the provider carries each
job's reservations and placements to the jobs after it, and the location
is stored in one transaction at the end. A database error in that write
now fails the location run instead of one job.

The expedite what-if now applies the same material links a real run does.

* fix(jobs): a purged company's search index table is 

**File**: `.ai/lessons.md` (modified, +22/-0)
```diff
@@ -3025,3 +3025,25 @@ And a delete whose failure the caller ignores is not a delete: return the error.
 **Rule:** A prefetch only helps if the browser may reuse its response. Give a prefetch response (`Sec-Purpose: prefetch`) a short `private` lifetime and leave every other response uncached; `prefetchCacheMiddleware` (`@carbon/utils`) does it in each app's root `middleware`, the fix React Router points to (remix-run/react-router#13255). Measure a prefetch by click-to-page time, not by whether the request was sent. A first fix removed the prefetch instead (`6e3bdf7bc6`); it worked but threw away the head start.
 
 **Applies to:** `packages/react/src/PrefetchLink.tsx`; `packages/utils/src/prefetch.ts`; any `<Link prefetch>` or `PrefetchPageLinks`; a revalidation started while a navigation to the same URL is loading.
+
+
+## A revalidation during the navigation after a save loses the save
+
+**Context:** 186 layouts export `shouldRevalidate` and skip a GET navigation that leaves their params unchanged. Realtime calls `revalidate()` 300 ms after a broadcast.
+
+**Problem:** A save's own broadcast arrives while its redirect is still loading. `revalidate()` during a loading navigation restarts it with `overrideNavigation: state.navigation`, and for a fetcher submission that carries no `formMethod`. The restarted navigation looks like a plain one, so each layout returned `false` and kept its data from before the save: a new quote line was missing from the quote's explorer until a reload (2026-10-05). In single fetch `defaultShouldRevalidate` is `true` for every route on every navigation, so a predicate cannot tell a forced reload from a plain one. A first fix assumed React Router's default was `false` after a redirect with no cookie; logging the predicate's arguments in the browser showed the default was `true` and the first pass did include the layout.
+
+**Rule:** Never call React Router's `revalidate()` directly. Import `useRevalidator` from `@carbon/query`: it holds a call made while a navigation is in flight or a fetcher is submitting and runs it when the router is idle. The `no-raw-revalidator` check (`@carbon/checks`) fails an import of React Router's. Before explaining a skipped loader, log what `shouldRevalidate` received: wrap the route's `shouldRevalidate` on `window.__reactRouterDataRouter.routes` and read `formMethod`, `defaultShouldRevalidate` and both URLs for each call.
+
+**Applies to:** `packages/query/src/useRevalidator.ts`; every `revalidate()` call (realtime, polling timers, upload callbacks); every route that exports `shouldRevalidate`.
+
+
+## A drag re-rendered every card on the board
+
+**Context:** The schedule boards (operations, dates, batches) render one sortable card per operation or job, each with a form, avatars, tooltips and a menu.
+
+**Problem:** A drag stuttered: with 82 cards, six frames of a 90-frame sweep took over 100 ms. Two causes. dnd-kit re-renders every `useSortable` consumer when the drop target changes, and the hook sat inside the card, so every card's whole body rendered each time. And `useSensor(KeyboardSensor, { coordinateGetter })` passed a new options object on every render: dnd-kit memoizes the sensor on it, so every draggable got new `listeners`, which defeats `memo` on anything that takes them.
+
+**Rule:** A sortable card is a thin shell that calls `useSortable` and a `memo`ized body that takes plain props (`sortableCardProps` in `Schedule/Kanban/cardShell.ts`). `useSensor` options are a module constant (`no-inline-sensor-options` check). A context every card reads must have a stable value. To find what re-renders, count renders per component during a scripted drag; do not guess.
+
+**Applies to:** `apps/erp/app/modules/production/ui/Schedule/Kanban/**`; any dnd-kit board or list with more than a few dozen items.
```

**File**: `.ai/plans/2026-10-06-slow-request-fixes.md` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+# Slow request fixes: scheduler writes, maintenance dispatch, webhook timeout
+
+## Context
+
+Axiom traces for 2026-10-05 showed three avoidable costs. None is a slow query; each is too many sequential round trips.
+
+- **Reschedule (4.9 s of a 6.7 s job release, also operation delete).** `runLocationSchedule` re-plans every open job at the location. Each job costs about 17 statements in two transactions, so 28 jobs is about 500 statements. In prod 88% of jobs get new operation dates on every run, so skipping unchanged writes would not help. The fix is to compute every job in memory and write the location once.
+- **`carbon-dispatch` (40.7 s).** One `maintenanceSchedule` read per company. The company list is read without paging, so it stops at 1,000 of 1,284 companies: 284 companies never get preventive-maintenance dispatches. Only 31 companies have an active schedule.
+- **Webhook delivery.** `axios.post` to the customer URL has no timeout, so a hung endpoint holds the step until the platform kills it.
+
+Decisions already made with the user: keep the reschedule inline (no background wave); go the full depth (in-memory compute plus one write); a database error in that write fails the whole location run instead of one job. Inline PDFs are out of scope.
+
+Work on a new branch `perf/slow-request-fixes` off `main`, one commit per part. Copy this plan to `.ai/plans/2026-10-06-slow-request-fixes.md` first. No push without asking.
+
+---
+
+## Part 1: Maintenance dispatch (smallest, fixes a live bug)
+
+File: `packages/jobs/src/inngest/functions/scheduled/dispatch.ts`, the `dispatchFunction` body (lines 395-459).
+
+1. Replace the company loop with one paged read of every due schedule across companies: `fetchAllFromTable` (`@carbon/database`, same helper `scheduled/mrp.ts` uses) on `maintenanceSchedule`, `active = true` and `nextDueAt is null or <= now`.
+2. Read `companySettings (id, maintenanceDispatchNotificationGroup)` only for the companies that have a due schedule, with `.in("id", ids)` in chunks of 200.
+3. Loop the due schedules and call the existing `generateDispatchesForSchedule` unchanged (it stays one schedule at a time; that part is inherent and small).
+4. A failed read now throws so Inngest retries, instead of silently skipping a company.
+
+`generateMaintenanceForScheduleFunction` (on-demand, one schedule) is untouched.
+
+Expected: about 1,000 reads become 2-3; run time about 40 s to about 10 s; all 1,284 companies covered.
+
+## Part 2: Webhook timeout
+
+File: `packages/jobs/src/inngest/functions/events/webhook.ts:62`.
+
+- Add `timeout: 30_000` to the `axios.post` options.
+- 30 s, not 10 s: yesterday's handlers that took 8-14 s ended in `increment_webhook_success`, so a 10 s limit would turn deliveries that succeed today into failures and retries.
+- Add one line to `docs/content/docs/building/webhooks.mdx`: an endpoint that does not answer within 30 seconds counts as a failed attempt and is retried.
+
+## Part 3: Scheduler computes in memory, writes once
+
+All under `packages/planning/src/scheduling/`. `SchedulingEngine` is constructed only in `run-schedule.ts`, so the engine's write contract can change without touching callers.
+
+### 3a. Engine stops writing; it returns a write set
+
+`scheduling-engine.ts`, `material-manager.ts`.
+
+The engine has four write sites today. Each one records into a `JobWrites` value instead (`engine.getWrites()`):
+
+| Today | Becomes |
+|---|---|
+| `materialManager.assignOperationsToMaterials` (one UPDATE per material) and `assignMaterials` | `materialLinks: { materialId, jobOperationId }[]` |
+| `createDependencies` transaction (lock, delete, insert) | `dependencies: { reworkOpIds, records } \| null`, null when the computed edges equal the stored non-rework edges (already in memory from `initialize`) |
+| `createDependencies` Ready update | `readyOperationIds` |
+| `persistChanges` | `placements`, `reservations`, `job: { projectedCompletionAt }`, plus the existing newly-late calculation |
+
+Reads that used to follow the engine's own writes now apply the links in memory:
+- `assignMaterials`: unassigned Make to Order materials minus the ones already linked in this run.
+- `createDependencies`: `getMaterialsWithMakeMethod` rows with `jobOperationId` filled from the links.
+
+Side effect: the expedite what-if (`persist: false`) now sees the same material links a real run does. Today it skips them. This is the only intended behavior difference inside a run.
+
+### 3b. Provider serves earlier jobs' results from memory
+
+`master-data-provider.ts`. The provider already holds per-run state (`preload`, `companyCache`); add a run overlay next to it.
+
+- **Reservations.** `beginRun(batch)` loads live reservations once (no exclusions) and splits them: rows later jobs always see (non-batch jobs, batch-tagged rows) and each batch job's own old rows. `getLiveReservations` then answers from memory. After a job computes, its planned reservations re
```

**File**: `.claude/rules/realtime-system.md` (modified, +6/-2)
```diff
@@ -96,8 +96,12 @@ export const handle: Handle = {
 the matched routes and, 300 ms after the last message, invalidates the cached
 loader entries and revalidates the page. A burst is one reload; a route and a
 component following the same table reload once; a reload waits while a fetcher
-is submitting (React Router drops a fetcher's redirect when a revalidation
-starts during its action) and runs when it finishes.
+is submitting or a navigation is in flight, and runs when both are done
+(`useRevalidator` from `@carbon/query`, the only one app code may import). During
+an action React Router drops the fetcher's redirect; during the navigation that
+follows a save, a revalidation restarts it WITHOUT the submission, and every
+layout whose `shouldRevalidate` skips a plain navigation then keeps its data
+from before the save. The save's own broadcast arrives in exactly that window.
 
 - Update the list when the loader starts reading a new table. Nothing checks
   that a list is COMPLETE, only that each name can broadcast.
```

**File**: `.claude/rules/scheduling-data-structures.md` (modified, +21/-10)
```diff
@@ -248,8 +248,8 @@ is a separate per-job backward re-plan, not a whole-location regen.
 ## Engine pipeline (`scheduling-engine.ts` `run()`)
 
 `initialize → assignMaterials → createDependencies → calculateDates →
-computeNeedBys → selectWorkCenters → calculatePriorities → persistChanges` (the last
-is skipped when `persist: false`, i.e. the expedite what-if). **There is no backward
+computeNeedBys → selectWorkCenters → calculatePriorities → buildWrites` (the engine
+writes nothing; the location run stores the result, the expedite what-if drops it). **There is no backward
 JIT pass in PLACEMENT and no `initial`/`reschedule` mode split** — everything places
 FORWARD-ASAP, and the projected finish IS the overdue forecast (slack is real). The
 backward need-by pass (`computeNeedBys`, below) computes demand-anchored TARGETS
@@ -263,8 +263,18 @@ only; its output is read by nothing in the placement path (spec
   `dueDate ASC NULLS LAST → job.priority ASC → createdAt ASC` — so a no-due-date ASAP
   order claims capacity first. Each job's engine run **excludes the jobs not yet run
   (itself + later)** from the reservation snapshot, so it sees non-batch reservations
-  plus the just-persisted placements of already-run jobs → sequential capacity
-  claiming, no pre-clear step.
+  plus the placements of already-run jobs → sequential capacity
+  claiming, no pre-clear step. **Nothing is written while the jobs run.** The
+  engine only computes: `engine.getWrites()` returns a `JobWrites`
+  (`run-overlay.ts`), `provider.recordJob(writes)` makes that job's reservations
+  and operation placements visible to the jobs after it (`beginRun` reads the
+  live reservations once; the rules are the pure `visibleReservations` /
+  `mergeCrossJobOperations`), and `persistLocationWrites`
+  (`persist-location.ts`) stores the whole location in ONE transaction at the
+  end. A job that throws while computing is left out of the write and keeps its
+  stored reservations visible to later jobs; a database error in the write
+  rolls the location back and `runLocationSchedule` throws. This replaced a
+  write per job (about 17 statements each, 500 for a 28-job location).
 - **Sequencing** (`dependency-manager.ts`): the `jobOperation."operationOrder"` enum
   (`methodOperationOrder` = `'After Previous' | 'With Previous'`) decides serial vs
   parallel, plus assembly edges (a sub-make-method's last op feeds the parent's
@@ -369,19 +379,20 @@ only; its output is read by nothing in the placement path (spec
   dispatch-sequencing policy** — the old per-work-center policy table, its rule enum,
   and the FIFO/EDD/SPT/… comparators were all removed; placement order is the only
   sequence.
-- **`persistChanges` (one transaction, only when `persist`)** writes, for every op whose
-  values changed (`isDistinctFromAny` guards the UPDATE in SQL, so a quiet regen writes no
+- **`persistLocationWrites` (one transaction per location run; the expedite what-if
+  never calls it)** writes, for every op whose
+  values changed (an `is distinct from` guard in the UPDATE, so a quiet regen writes no
   `jobOperation` or `job` row and queues no audit/search event), the
   forward placement's results — `startDate` (projected start, business day) +
   `jobOperation.projectedCompletionAt` (exact placed-end instant, timestamptz) +
   `priority` + `workCenterId` + conflict flags. `dueDate` is the backward need-by and
   is DIFF-written: only when the computed target differs from the stored value (a
   quiet regen touches zero `dueDate`s), and never for a `manuallyScheduled` op — a
-  human owns that target. It rebuilds this job's `capacityReservation` rows
-  (delete-by-job where `scenarioId IS NULL`, then bulk insert — a materialized OUTPUT,
+  human owns that target. It rebuilds the jobs' `capacityReservation` rows
+  (one delete for all the run's jobs where `scenarioId IS NULL`, then bulk insert — a materialized OUTPUT,
   `WorkCenter`/`Employee` kinds); and writes `job.projectedCompletionAt` (= the max
   placed end, the forecast finish) while clearing
-  `scheduleOutdatedReason`/`scheduleOutdatedAt` for that job. It also computes the
+  `scheduleOutdatedReason`/`scheduleOutdatedAt` for each job. The engine's `buildWrites` also computes the
   **newly-late** flag (was on-time-or-unforecast before, now projected past `dueDate`
   on the location calendar) for the wave's digest.
 - **Behind-target attribution (informational only):** when the JOB's verdict is late,
@@ -401,7 +412,7 @@ only; its output is read by nothing in the placement path (spec
 (`20260525143721_manual-scheduling.sql` — adds only this column). Under dual dates a
 pin means **a human owns the need-by TARGET**, not the placement: the backward pass
 takes the pinned op's stored `dueDate` as-is and derives upstream ops' targets from
-it (the pin propagates), and `persistChanges()` never writes `dueDate` for a pinned
+it (the pin propagates), and the location write never includes `dueDate` for a p
```

**File**: `apps/erp/app/components/ActionTasks/Jira/IssueDialog.tsx` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 
 import type { ActionTaskEntityType } from "@carbon/ee/action-task-entity";
 import { JiraIssueMappingSchema } from "@carbon/ee/jira";
+import { useRevalidator } from "@carbon/query";
 import {
   Badge,
   Button,
@@ -26,7 +27,7 @@ import { Trans, useLingui } from "@lingui/react/macro";
 import { useState } from "react";
 import { LuExternalLink } from "react-icons/lu";
 import { PiLinkBreak } from "react-icons/pi";
-import { Link, useRevalidator } from "react-router";
+import { Link } from "react-router";
 import { JiraIcon, JiraIssueStatusBadge } from "~/components/Icons";
 import { useAsyncFetcher } from "~/hooks/useAsyncFetcher";
 import { path } from "~/utils/path";
```

**File**: `apps/erp/app/components/ActionTasks/Linear/IssueDialog.tsx` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 
 import type { ActionTaskEntityType } from "@carbon/ee/action-task-entity";
 import { LinearIssueSchema } from "@carbon/ee/linear";
+import { useRevalidator } from "@carbon/query";
 import {
   Badge,
   Button,
@@ -26,7 +27,7 @@ import { Trans, useLingui } from "@lingui/react/macro";
 import { useState } from "react";
 import { LuExternalLink } from "react-icons/lu";
 import { PiLinkBreak } from "react-icons/pi";
-import { Link, useRevalidator } from "react-router";
+import { Link } from "react-router";
 import { LinearIcon, LinearIssueStateBadge } from "~/components/Icons";
 import { useAsyncFetcher } from "~/hooks/useAsyncFetcher";
 import { path } from "~/utils/path";
```

**File**: `apps/erp/app/components/AttachmentsList.tsx` (modified, +1/-1)
```diff
@@ -9,6 +9,7 @@ import {
   storage
 } from "@carbon/files";
 import { MediaUploader, wasConvertedFromHeic } from "@carbon/files/media";
+import { useRevalidator } from "@carbon/query";
 import {
   Badge,
   HStack,
@@ -26,7 +27,6 @@ import { Trans, useLingui } from "@lingui/react/macro";
 import { useCallback, useMemo, useState } from "react";
 import { useDropzone } from "react-dropzone";
 import { LuCloudUpload, LuFileText, LuX } from "react-icons/lu";
-import { useRevalidator } from "react-router";
 import { useUser } from "~/hooks";
 import { stripSpecialCharacters } from "~/utils/string";
 
```

**File**: `apps/erp/app/components/CadModel.tsx` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@
 import { useCarbon } from "@carbon/auth";
 import { convertKbToString, TEMP_STAGING_BUCKET } from "@carbon/files";
 import { supportedModelTypes } from "@carbon/files/cad";
+import { useRevalidator } from "@carbon/query";
 import {
   Button,
   CardHeader,
@@ -32,7 +33,7 @@ import { nanoid } from "nanoid";
 import { useState } from "react";
 import { useDropzone } from "react-dropzone";
 import { LuCloudUpload, LuRefreshCw, LuZap } from "react-icons/lu";
-import { useFetcher, useRevalidator } from "react-router";
+import { useFetcher } from "react-router";
 import { useModelUpload, useUser } from "~/hooks";
 import type { ModelUpload } from "~/types";
 import type { ViewDirection } from "~/utils/model-thumbnail";
```

---

### Incident Patch 7: `9fde08dc` (2026-10-05)
**Commit Message**: fix(invoicing): save the invoice customer instead of the sold-to customer

Picking an Invoice Customer whose customer record has no currency fell
through to a branch that wrote customerId. The sold-to customer changed
silently, invoiceCustomerId stayed the same, and the Invoice Customer
Contact list kept showing the old customer's contacts. Purchase invoices
had the same fallthrough for Invoice Supplier, which overwrote supplierId.

- update routes: always write the invoice customer/supplier and clear its
  contact and location; take the party's currency and rate only when it
  has one; refuse an empty value; return the read error.
- salesInvoiceCustomerChange / purchaseInvoiceSupplierChange: the columns
  each change writes, pinned by tests.
- SalesInvoiceForm: scope the invoice contact and location pickers to the
  invoice customer, not the sold-to customer.
- $invoiceId.details: remove the unused action (no form posts to it).

**File**: `apps/erp/app/modules/invoicing/invoicing.models.test.ts` (modified, +69/-1)
```diff
@@ -7,7 +7,9 @@ import {
   invoiceSettlementValidator,
   isInvoicePayable,
   memoValidator,
-  paymentValidator
+  paymentValidator,
+  purchaseInvoiceSupplierChange,
+  salesInvoiceCustomerChange
 } from "./invoicing.models";
 
 describe("paymentValidator", () => {
@@ -347,3 +349,69 @@ describe("memoValidator", () => {
     ).toBe(false);
   });
 });
+
+describe("salesInvoiceCustomerChange", () => {
+  it("sets the invoice customer and clears its contact and location", () => {
+    expect(salesInvoiceCustomerChange("cust_billing", null)).toEqual({
+      invoiceCustomerId: "cust_billing",
+      invoiceCustomerContactId: null,
+      invoiceCustomerLocationId: null
+    });
+  });
+
+  it("never writes the sold-to customer", () => {
+    for (const currency of [
+      null,
+      { currencyCode: "EUR", exchangeRate: 0.92 }
+    ]) {
+      expect(
+        salesInvoiceCustomerChange("cust_billing", currency)
+      ).not.toHaveProperty("customerId");
+    }
+  });
+
+  it("keeps the invoice currency when the customer has none", () => {
+    const change = salesInvoiceCustomerChange("cust_billing", null);
+    expect(change).not.toHaveProperty("currencyCode");
+    expect(change).not.toHaveProperty("exchangeRate");
+  });
+
+  it("takes the customer's currency and rate when it has one", () => {
+    expect(
+      salesInvoiceCustomerChange("cust_billing", {
+        currencyCode: "EUR",
+        exchangeRate: 0.92
+      })
+    ).toMatchObject({ currencyCode: "EUR", exchangeRate: 0.92 });
+  });
+});
+
+describe("purchaseInvoiceSupplierChange", () => {
+  it("sets the invoice supplier and clears its contact and location", () => {
+    expect(purchaseInvoiceSupplierChange("supp_billing", null)).toEqual({
+      invoiceSupplierId: "supp_billing",
+      invoiceSupplierContactId: null,
+      invoiceSupplierLocationId: null
+    });
+  });
+
+  it("never writes the supplier", () => {
+    for (const currency of [
+      null,
+      { currencyCode: "EUR", exchangeRate: 0.92 }
+    ]) {
+      expect(
+        purchaseInvoiceSupplierChange("supp_billing", currency)
+      ).not.toHaveProperty("supplierId");
+    }
+  });
+
+  it("takes the supplier's currency and rate when it has one", () => {
+    expect(
+      purchaseInvoiceSupplierChange("supp_billing", {
+        currencyCode: "EUR",
+        exchangeRate: 0.92
+      })
+    ).toMatchObject({ currencyCode: "EUR", exchangeRate: 0.92 });
+  });
+});
```

**File**: `apps/erp/app/modules/invoicing/invoicing.models.ts` (modified, +36/-0)
```diff
@@ -76,6 +76,42 @@ export function isSalesInvoiceLocked(
   return status !== null && status !== undefined && status !== "Draft";
 }
 
+type InvoiceCurrency = { currencyCode: string; exchangeRate: number };
+
+/**
+ * The columns written when a sales invoice's invoice customer changes. It
+ * never writes `customerId`, the sold-to customer. A customer with no
+ * currency (`currency` null) leaves the invoice's currency as it is.
+ */
+export function salesInvoiceCustomerChange(
+  invoiceCustomerId: string,
+  currency: InvoiceCurrency | null
+) {
+  return {
+    invoiceCustomerId,
+    invoiceCustomerContactId: null,
+    invoiceCustomerLocationId: null,
+    ...currency
+  };
+}
+
+/**
+ * The columns written when a purchase invoice's invoice supplier changes. It
+ * never writes `supplierId`. A supplier with no currency (`currency` null)
+ * leaves the invoice's currency as it is.
+ */
+export function purchaseInvoiceSupplierChange(
+  invoiceSupplierId: string,
+  currency: InvoiceCurrency | null
+) {
+  return {
+    invoiceSupplierId,
+    invoiceSupplierContactId: null,
+    invoiceSupplierLocationId: null,
+    ...currency
+  };
+}
+
 export const purchaseInvoiceValidator = z.object({
   id: zfd.text(z.string().optional()),
   invoiceId: zfd.text(z.string().optional()),
```

**File**: `apps/erp/app/modules/invoicing/ui/SalesInvoice/SalesInvoiceForm.test.tsx` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
+// including ports, remain AGPLv3; serving them over a network requires releasing their source.
+
+import type { ReactNode } from "react";
+import { createElement } from "react";
+import { renderToStaticMarkup } from "react-dom/server";
+import { describe, expect, it, vi } from "vitest";
+
+vi.mock("@carbon/auth", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("@carbon/auth")>()),
+  useCarbon: () => ({ carbon: null })
+}));
+vi.mock("@carbon/form", () => ({
+  ValidatedForm: ({ children }: { children: ReactNode }) =>
+    createElement("form", null, children)
+}));
+vi.mock("@carbon/react", () => {
+  const Box = ({ children }: { children?: ReactNode }) =>
+    createElement("div", null, children);
+  return {
+    Card: Box,
+    CardContent: Box,
+    CardDescription: Box,
+    CardFooter: Box,
+    CardHeader: Box,
+    CardTitle: Box,
+    VStack: Box,
+    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
+    toast: { error: vi.fn() }
+  };
+});
+vi.mock("@lingui/react/macro", () => ({
+  Trans: ({ children }: { children: ReactNode }) => children,
+  useLingui: () => ({
+    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
+      parts.reduce(
+        (result, part, index) => result + part + (values[index] ?? ""),
+        ""
+      )
+  })
+}));
+// The two pickers under test render the customer they are scoped to.
+vi.mock("~/components/Form", () => {
+  const Field = () => null;
+  const ScopedPicker = ({
+    name,
+    customer
+  }: {
+    name: string;
+    customer?: string;
+  }) => createElement("input", { name, "data-customer": customer ?? "" });
+  return {
+    Currency: Field,
+    Customer: Field,
+    CustomerContact: ScopedPicker,
+    CustomerLocation: ScopedPicker,
+    CustomFormFields: Field,
+    DatePicker: Field,
+    Hidden: Field,
+    Input: Field,
+    Location: Field,
+    SequenceOrCustomId: Field,
+    Submit: Field
+  };
+});
+vi.mock("~/components/Form/PaymentTerm", () => ({ default: () => null }));
+vi.mock("~/hooks", () => ({
+  usePermissions: () => ({ can: () => true }),
+  useRouteData: () => undefined
+}));
+vi.mock("~/modules/invoicing", () => import("../../invoicing.models"));
+
+import SalesInvoiceForm from "./SalesInvoiceForm";
+
+function render() {
+  return renderToStaticMarkup(
+    createElement(SalesInvoiceForm, {
+      initialValues: {
+        customerId: "cust_sold_to",
+        invoiceCustomerId: "cust_billing",
+        locationId: "loc_1"
+      }
+    })
+  );
+}
+
+describe("SalesInvoiceForm", () => {
+  it.each([
+    "invoiceCustomerContactId",
+    "invoiceCustomerLocationId"
+  ])("scopes %s to the invoice customer, not the sold-to customer", (name) => {
+    expect(render()).toContain(`name="${name}" data-customer="cust_billing"`);
+  });
+});
```

**File**: `apps/erp/app/modules/invoicing/ui/SalesInvoice/SalesInvoiceForm.tsx` (modified, +2/-9)
```diff
@@ -70,18 +70,11 @@ const SalesInvoiceForm = ({ initialValues }: SalesInvoiceFormProps) => {
     paymentTermId: initialValues.paymentTermId
   });
 
-  const [customer, setCustomer] = useState<{
-    id: string | undefined;
-  }>({
-    id: initialValues.customerId
-  });
-
   const onCustomerChange = async (
     newValue: {
       value: string | undefined;
     } | null
   ) => {
-    setCustomer({ id: newValue?.value });
     if (newValue?.value !== invoiceCustomer.id) {
       onInvoiceCustomerChange(newValue);
     }
@@ -223,7 +216,7 @@ const SalesInvoiceForm = ({ initialValues }: SalesInvoiceFormProps) => {
               <CustomerLocation
                 name="invoiceCustomerLocationId"
                 label={t`Invoice Customer Location`}
-                customer={customer.id}
+                customer={invoiceCustomer.id}
                 value={invoiceCustomer.invoiceCustomerLocationId}
                 onChange={(newValue) => {
                   if (newValue?.id) {
@@ -237,7 +230,7 @@ const SalesInvoiceForm = ({ initialValues }: SalesInvoiceFormProps) => {
               <CustomerContact
                 name="invoiceCustomerContactId"
                 label={t`Invoice Customer Contact`}
-                customer={customer.id}
+                customer={invoiceCustomer.id}
                 value={invoiceCustomer.invoiceCustomerContactId}
                 onChange={(newValue) => {
                   if (newValue?.id) {
```

**File**: `apps/erp/app/routes/x+/purchase-invoice+/update.tsx` (modified, +34/-29)
```diff
@@ -3,12 +3,13 @@
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
 import { requirePermissions } from "@carbon/auth/auth.server";
-import { unchecked } from "@carbon/utils";
+import { datetime, unchecked } from "@carbon/utils";
 import type { ActionFunctionArgs } from "react-router";
 import { getExchangeRate } from "~/modules/accounting";
 import {
   computeInvoiceDateDue,
-  isPurchaseInvoiceLocked
+  isPurchaseInvoiceLocked,
+  purchaseInvoiceSupplierChange
 } from "~/modules/invoicing";
 import { requireUnlockedBulk } from "~/utils/lockedGuard.server";
 
@@ -46,42 +47,46 @@ export async function action({ request }: ActionFunctionArgs) {
   }
 
   switch (field) {
-    case "invoiceSupplierId":
-      let currencyCode: string | undefined;
-      if (value && ids.length === 1) {
-        const supplier = await client
-          ?.from("supplier")
-          .select("currencyCode")
-          .eq("id", value)
-          .single();
+    case "invoiceSupplierId": {
+      if (!value) {
+        return {
+          error: { message: "Invoice supplier is required" },
+          data: null
+        };
+      }
 
-        if (supplier.data?.currencyCode) {
-          currencyCode = supplier.data.currencyCode;
-          const rate = await getExchangeRate(client, companyId, currencyCode);
-          if (rate.error) return rate;
-          return await client
-            .from("purchaseInvoice")
-            .update({
-              invoiceSupplierId: value ?? undefined,
-              invoiceSupplierContactId: null,
-              invoiceSupplierLocationId: null,
-              currencyCode: currencyCode ?? undefined,
-              exchangeRate: rate.data,
-              updatedBy: userId,
-              updatedAt: new Date().toISOString()
-            })
-            .in("id", ids as string[]);
-        }
+      const supplier = await client
+        .from("supplier")
+        .select("currencyCode")
+        .eq("id", value)
+        .eq("companyId", companyId)
+        .single();
+      if (supplier.error) return supplier;
+
+      let currency: { currencyCode: string; exchangeRate: number } | null =
+        null;
+      if (supplier.data.currencyCode) {
+        const rate = await getExchangeRate(
+          client,
+          companyId,
+          supplier.data.currencyCode
+        );
+        if (rate.error) return rate;
+        currency = {
+          currencyCode: supplier.data.currencyCode,
+          exchangeRate: rate.data
+        };
       }
 
       return await client
         .from("purchaseInvoice")
         .update({
-          supplierId: value ?? undefined,
+          ...purchaseInvoiceSupplierChange(value, currency),
           updatedBy: userId,
-          updatedAt: new Date().toISOString()
+          updatedAt: datetime.timestamp()
         })
         .in("id", ids as string[]);
+    }
     case "dateIssued":
       if (ids.length === 1) {
         const invoice = await client
```

**File**: `apps/erp/app/routes/x+/sales-invoice+/$invoiceId.details.tsx` (modified, +6/-99)
```diff
@@ -2,17 +2,16 @@
 // Carbon (github.com/crbnos/carbon). Modified or adapted versions of this file,
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
-import { assertIsPost, error, success } from "@carbon/auth";
+import { error } from "@carbon/auth";
 import { requirePermissions } from "@carbon/auth/auth.server";
 import { flash } from "@carbon/auth/session.server";
-import { validationError, validator } from "@carbon/form";
 import type { JSONContent } from "@carbon/react";
 import { redirect } from "@carbon/utils";
 import { useLingui } from "@lingui/react/macro";
 import type { FileObject } from "@supabase/storage-js";
 import { useRef } from "react";
 import { Fragment } from "react/jsx-runtime";
-import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
+import type { LoaderFunctionArgs } from "react-router";
 import { useLoaderData, useParams } from "react-router";
 import { DeferredFiles } from "~/components";
 import { useRouteData, useUser } from "~/hooks";
@@ -24,10 +23,7 @@ import type {
 import {
   getInvoiceSettlementsForInvoice,
   getSalesInvoice,
-  InvoicePaymentsPanel,
-  isSalesInvoiceLocked,
-  salesInvoiceValidator,
-  updateSalesInvoice
+  InvoicePaymentsPanel
 } from "~/modules/invoicing";
 import type { SalesInvoiceShipmentFormRef } from "~/modules/invoicing/ui/SalesInvoice/SalesInvoiceShipmentForm";
 import SalesInvoiceShipmentForm from "~/modules/invoicing/ui/SalesInvoice/SalesInvoiceShipmentForm";
@@ -37,8 +33,7 @@ import {
   OpportunityDocuments,
   OpportunityNotes
 } from "~/modules/sales/ui/Opportunity";
-import { getCustomFields, setCustomFields } from "~/utils/form";
-import { requireUnlocked } from "~/utils/lockedGuard.server";
+import { getCustomFields } from "~/utils/form";
 import { path } from "~/utils/path";
 
 export async function loader({ request, params }: LoaderFunctionArgs) {
@@ -66,80 +61,6 @@ export async function loader({ request, params }: LoaderFunctionArgs) {
   };
 }
 
-export async function action({ request, params }: ActionFunctionArgs) {
-  assertIsPost(request);
-
-  const { invoiceId: id } = params;
-  if (!id) throw new Error("Could not find invoiceId");
-
-  // Check if SI is locked
-  const { client: viewClient } = await requirePermissions(request, {
-    view: "invoicing"
-  });
-
-  const invoice = await getSalesInvoice(viewClient, id);
-  if (invoice.error) {
-    throw redirect(
-      path.to.salesInvoice(id),
-      await flash(request, error(invoice.error, "Failed to load sales invoice"))
-    );
-  }
-
-  await requireUnlocked({
-    request,
-    isLocked: isSalesInvoiceLocked(invoice.data?.status),
-    redirectTo: path.to.salesInvoice(id),
-    message: "Cannot modify a locked sales invoice. Reopen it first."
-  });
-
-  const { client, userId } = await requirePermissions(request, {
-    update: "invoicing"
-  });
-
-  const formData = await request.formData();
-  const validation = await validator(salesInvoiceValidator).validate(formData);
-
-  if (validation.error) {
-    return validationError(validation.error);
-  }
-
-  const { invoiceId, ...d } = validation.data;
-  if (!invoiceId) throw new Error("Could not find invoiceId");
-
-  const result = await updateSalesInvoice(client, {
-    id,
-    invoiceId,
-    customerId: d.customerId,
-    customerReference: d.customerReference || null,
-    paymentTermId: d.paymentTermId || null,
-    currencyCode: d.currencyCode,
-    locationId: d.locationId,
-    invoiceCustomerId: d.invoiceCustomerId || null,
-    invoiceCustomerContactId: d.invoiceCustomerContactId || null,
-    invoiceCustomerLocationId: d.invoiceCustomerLocationId || null,
-    dateIssued: d.dateIssued || null,
-    dateDue: d.dateDue || null,
-    exchangeRate: d.exchangeRate,
-    exchangeRateUpdatedAt: d.exchangeRateUpdatedAt,
-    customFields: setCustomFields(formData),
-    updatedBy: userId
-  });
-  if (result.error) {
-    throw redirect(
-      path.to.salesInvoice(id),
-      await flash(
-        request,
-        error(result.error, "Failed to update sales invoice")
-      )
-    );
-  }
-
-  throw redirect(
-    path.to.salesInvoice(id),
-    await flash(request, success("Updated sales invoice"))
-  );
-}
-
 export default function SalesInvoiceBasicRoute() {
   const { t } = useLingui();
   const { internalNotes, paymentApplications } = useLoaderData<typeof loader>();
@@ -165,20 +86,6 @@ export default function SalesInvoiceBasicRoute() {
     shipmentFormRef.current?.focusShippingCost();
   };
 
-  const initialValues = {
-    id: salesInvoice.id ?? "",
-    invoiceId: salesInvoice.invoiceId ?? "",
-    customerId: salesInvoice.customerId ?? "",
-    customerReference: salesInvoice.customerReference ?? "",
-    invoiceCustomerId: salesInvoice.invoiceCustomerId ?? "",
-    paymentTermId: salesInvoice.paymentTermId ?? "",
-    currencyCode: salesInvoice.currencyCode ?? "",
-    dateIssued: salesInvoice.dateIssued ?? "",
-    dateDue: salesInvoi
```

**File**: `apps/erp/app/routes/x+/sales-invoice+/update.tsx` (modified, +34/-29)
```diff
@@ -3,12 +3,13 @@
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
 import { requirePermissions } from "@carbon/auth/auth.server";
-import { unchecked } from "@carbon/utils";
+import { datetime, unchecked } from "@carbon/utils";
 import type { ActionFunctionArgs } from "react-router";
 import { getExchangeRate } from "~/modules/accounting";
 import {
   computeInvoiceDateDue,
-  isSalesInvoiceLocked
+  isSalesInvoiceLocked,
+  salesInvoiceCustomerChange
 } from "~/modules/invoicing";
 import { requireUnlockedBulk } from "~/utils/lockedGuard.server";
 
@@ -45,42 +46,46 @@ export async function action({ request }: ActionFunctionArgs) {
   }
 
   switch (field) {
-    case "invoiceCustomerId":
-      let currencyCode: string | undefined;
-      if (value && ids.length === 1) {
-        const customer = await client
-          ?.from("customer")
-          .select("currencyCode")
-          .eq("id", value)
-          .single();
+    case "invoiceCustomerId": {
+      if (!value) {
+        return {
+          error: { message: "Invoice customer is required" },
+          data: null
+        };
+      }
 
-        if (customer.data?.currencyCode) {
-          currencyCode = customer.data.currencyCode;
-          const rate = await getExchangeRate(client, companyId, currencyCode);
-          if (rate.error) return rate;
-          return await client
-            .from("salesInvoice")
-            .update({
-              invoiceCustomerId: value ?? undefined,
-              invoiceCustomerContactId: null,
-              invoiceCustomerLocationId: null,
-              currencyCode: currencyCode ?? undefined,
-              exchangeRate: rate.data,
-              updatedBy: userId,
-              updatedAt: new Date().toISOString()
-            })
-            .in("id", ids as string[]);
-        }
+      const customer = await client
+        .from("customer")
+        .select("currencyCode")
+        .eq("id", value)
+        .eq("companyId", companyId)
+        .single();
+      if (customer.error) return customer;
+
+      let currency: { currencyCode: string; exchangeRate: number } | null =
+        null;
+      if (customer.data.currencyCode) {
+        const rate = await getExchangeRate(
+          client,
+          companyId,
+          customer.data.currencyCode
+        );
+        if (rate.error) return rate;
+        currency = {
+          currencyCode: customer.data.currencyCode,
+          exchangeRate: rate.data
+        };
       }
 
       return await client
         .from("salesInvoice")
         .update({
-          customerId: value ?? undefined,
+          ...salesInvoiceCustomerChange(value, currency),
           updatedBy: userId,
-          updatedAt: new Date().toISOString()
+          updatedAt: datetime.timestamp()
         })
         .in("id", ids as string[]);
+    }
     case "dateIssued":
       if (ids.length === 1) {
         const invoice = await client
```

---

### Incident Patch 8: `ec24c703` (2026-10-05)
**Commit Message**: fix(erp): keep the date range filter in step with the URL

The pickers seed from the URL only when the popover opens. After Back or Forward with the popover open they kept the old bounds, and the next edit submitted the stale one. A date still waiting on the 400 ms debounce could also be applied after Back to a page without the filter, putting the filter back.

DateRangeFilter now tracks the URL values its draft builds on (the seed, then its own writes). When the URL lands on any other value, the pickers re-seed from it and a pending update is dropped. A pending update also checks the browser's live URL, since the popover can unmount and flush after Back changed the URL but before the component re-rendered.

**File**: `apps/erp/app/components/Table/components/Filter/DateRangeFilter.tsx` (modified, +51/-12)
```diff
@@ -5,12 +5,12 @@
 import { useDebounce } from "@carbon/react";
 import type { CalendarDate } from "@internationalized/date";
 import { parseDate } from "@internationalized/date";
-import { useRef, useState } from "react";
+import { useEffect, useRef, useState } from "react";
 import DateRangeFields, {
   type DateRangeValue
 } from "~/components/DateRangeFields";
 import { formatRangeFilter, parseRangeFilter } from "~/utils/query";
-import { useFilters } from "./useFilters";
+import { findFilterValue, useFilters } from "./useFilters";
 
 function toCalendarDate(value: string | null): CalendarDate | null {
   if (!value) return null;
@@ -25,24 +25,58 @@ type DateRangeFilterProps = {
   accessorKey: string;
 };
 
+function toRange(value: string | null): DateRangeValue {
+  const { from, to } = parseRangeFilter(value ?? "");
+  return { from: toCalendarDate(from), to: toCalendarDate(to) };
+}
+
 /** `DateRangeFields` bound to the URL as `?filter=<key>:between:from,to`. */
 const DateRangeFilter = ({ accessorKey }: DateRangeFilterProps) => {
   const { getFilterValue, removeKey, setFilter } = useFilters();
+  const current = getFilterValue(accessorKey);
+
+  // The URL values this draft builds on: the one it was seeded from, then
+  // every value it has written since, oldest first. The URL landing on any
+  // other value is a change made elsewhere (Back / Forward, the filter
+  // removed), and that change wins over the draft.
+  const knownRef = useRef<(string | null)[]>([current]);
+  // A change made elsewhere re-seeds the fields with the URL's bounds, and an
+  // update still waiting on the debounce is dropped: it carries the
+  // generation it was typed in.
+  const generationRef = useRef(0);
+  const [seed, setSeed] = useState({ generation: 0, value: current });
 
-  const [defaultValue] = useState<DateRangeValue>(() => {
-    const { from, to } = parseRangeFilter(getFilterValue(accessorKey) ?? "");
-    return { from: toCalendarDate(from), to: toCalendarDate(to) };
-  });
+  useEffect(() => {
+    const index = knownRef.current.indexOf(current);
+    if (index >= 0) {
+      // One of our writes landed; older values are history now, so going
+      // Back to one of them counts as a change made elsewhere
+      knownRef.current = knownRef.current.slice(index);
+      return;
+    }
+    knownRef.current = [current];
+    generationRef.current += 1;
+    setSeed({ generation: generationRef.current, value: current });
+  }, [current]);
 
-  const apply = (range: DateRangeValue | null) => {
+  const apply = (range: DateRangeValue | null, generation: number) => {
     // From after To: keep whatever the URL already says
-    if (!range) return;
+    if (!range || generation !== generationRef.current) return;
+    // The browser's URL, not this render's: on Back the popover can unmount
+    // (and flush) after the URL changed but before this component re-rendered
+    const live = findFilterValue(
+      new URLSearchParams(window.location.search).getAll("filter"),
+      accessorKey
+    );
+    if (!knownRef.current.includes(live)) return;
+
     const value = formatRangeFilter(
       range.from?.toString(),
       range.to?.toString()
     );
-    // Already what the URL says — closing the popover replays the last change
-    if (value === getFilterValue(accessorKey)) return;
+    // Already the latest value — closing the popover replays the last change
+    if (value === knownRef.current[knownRef.current.length - 1]) return;
+    knownRef.current.push(value);
     if (value) {
       setFilter(accessorKey, value, "between");
     } else {
@@ -56,13 +90,18 @@ const DateRangeFilter = ({ accessorKey }: DateRangeFilterProps) => {
   const applyRef = useRef(apply);
   applyRef.current = apply;
   const debouncedApply = useDebounce(
-    (next: DateRangeValue | null) => applyRef.current(next),
+    (next: DateRangeValue | null, generation: number) =>
+      applyRef.current(next, generation),
     400,
     true
   );
 
   return (
-    <DateRangeFields defaultValue={defaultValue} onChange={debouncedApply} />
+    <DateRangeFields
+      key={seed.generation}
+      defaultValue={toRange(seed.value)}
+      onChange={(range) => debouncedApply(range, seed.generation)}
+    />
   );
 };
 
```

**File**: `apps/erp/app/components/Table/components/Filter/useFilters.tsx` (modified, +8/-4)
```diff
@@ -4,6 +4,12 @@
 
 import { useUrlParams } from "~/hooks";
 
+/** A key's value in a list of `filter` params (`key:operator:value`), whatever the operator */
+export function findFilterValue(filters: string[], key: string): string | null {
+  const filter = filters.find((f) => f.split(":")[0] === key);
+  return filter?.split(":")[2] ?? null;
+}
+
 export function useFilters() {
   const [params, setParams] = useUrlParams();
   const urlFiltersParams = params.getAll("filter");
@@ -63,10 +69,8 @@ export function useFilters() {
   };
 
   // The key's value exactly as written in the URL, whatever the operator
-  const getFilterValue = (searchKey: string): string | null => {
-    const filter = urlFiltersParams.find((f) => f.split(":")[0] === searchKey);
-    return filter?.split(":")[2] ?? null;
-  };
+  const getFilterValue = (searchKey: string): string | null =>
+    findFilterValue(urlFiltersParams, searchKey);
 
   const addFilter = (newKey: string, newValue: string, isArray = false) => {
     if (hasFilterKey(newKey)) {
```

---

### Incident Patch 9: `2d7559b9` (2026-10-05)
**Commit Message**: fix(erp): keep the selected Custom date toggle readable on hover

The preset buttons override the toggle's base selected-and-hovered background, but the Custom calendar button did not, so it turned white under a white icon while hovered.

**File**: `apps/erp/app/components/DateSelect.tsx` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ const DateSelect = forwardRef<HTMLDivElement, DateSelectProps>(
               className={cn(
                 "h-7 w-7 rounded-full p-0",
                 "bg-transparent text-muted-foreground",
-                "hover:bg-active hover:text-active-foreground",
+                "hover:bg-active hover:text-active-foreground hover:data-[state=on]:bg-active",
                 "data-[state=on]:bg-active data-[state=on]:text-active-foreground data-[state=on]:shadow-sm",
                 "transition-all duration-200"
               )}
```

---

### Incident Patch 10: `ced07919` (2026-10-05)
**Commit Message**: fix(react): show the invalid date icon beside the calendar button

DatePicker and DateTimePicker pinned the icon 12px from the field's right edge, where the calendar button sits, so it covered the button. It is now laid out in the field's row.

**File**: `packages/react/src/Date/DatePicker.tsx` (modified, +1/-1)
```diff
@@ -115,7 +115,7 @@ const DatePicker = (
                 >
                   <DateField {...fieldProps} size={props.size} />
                   {state.isInvalid && (
-                    <LuBan className="!text-destructive-foreground absolute right-[12px] top-[12px]" />
+                    <LuBan className="!text-destructive-foreground ml-auto shrink-0 self-center" />
                   )}
                 </div>
                 {/* Anchor (not Trigger) so the calendar button isn't wrapped
```

**File**: `packages/react/src/Date/DateTimePicker.tsx` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ const DateTimePicker = (
                 >
                   <DateField {...fieldProps} size={props.size} />
                   {state.isInvalid && (
-                    <LuBan className="!text-destructive-foreground absolute right-[12px] top-[12px]" />
+                    <LuBan className="!text-destructive-foreground ml-auto shrink-0 self-center" />
                   )}
                 </div>
                 {props.withButton !== false && (
```

---

### Incident Patch 11: `fb830277` (2026-10-05)
**Commit Message**: fix(erp): keep the last valid date range while From is after To

DateRangeFields now reports an invalid range as null instead of nothing. A typed two-digit day passes through a one-digit value, and when the final value was invalid the earlier one was still applied after the URL filter's delay. The table filter now restarts its delay and keeps the URL; the batch builder keeps its last valid range. Adds the browser-test playbook.

**File**: `.ai/playbooks/date-range-filter.md` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+# Date Range Filter (table `dateRange` + batch builder Custom due)
+
+Last tested: 2026-10-06
+Routes: `/x/production/jobs`, `/x/sales/orders`, `/x/invoicing/sales`,
+`/x/inventory/stock-movements`, `/x/production/batches/new`
+
+## Prerequisites
+- A seeded company (dev seed / demo dataset) with jobs that have due dates,
+  sales orders, sales invoices with `dateDue`, and item ledger rows.
+- Batch builder: a `process` with `batchable = true` and unbatched, unstarted
+  operations on it at one location (demo data: Manufacturing Plant / PCB Assembly).
+- A "Forgot to Clock Out?" modal may cover the app after login. Click
+  **"I'm Still Working"** (sessionStorage-only, writes nothing). Escape does not close it.
+
+## Steps
+
+### 1. Table filter via UI (Jobs)
+- `/x/production/jobs` → click **Filter** → option **Due Date** → a popover
+  with **From** / **To** date fields (DD/MM/YYYY segments in an en-GB locale).
+- Click the `spinbutton "day, From"` segment and type the digits (`01102026`).
+  The URL updates after ~400 ms to `?filter=dueDate:between:2026-10-01,`.
+- Then the `spinbutton "day, To"` segment → `15102026` → URL
+  `…between:2026-10-01,2026-10-15`.
+
+### 2. Verify
+- Compare the rows with the DB:
+  `select "jobId" from job where "dueDate" between '…' and '…'`.
+- Chip reads `Due Date · is between · 1 Oct 2026 – 15 Oct 2026`; open-ended
+  ranges read `is on or after` / `is on or before`.
+- A From after To leaves the URL unchanged and flags both fields.
+- Chip **Remove filter** clears it.
+- Faster for other lists: load the URL directly
+  (`?filter=<col>:between:<from>,<to>`, either side empty) and read the
+  pagination total (the text after `100 rows` → "1", "N").
+
+### 3. Batch builder Custom due
+- `/x/production/batches/new` → process combobox → **PCB Assembly**.
+- Due toggle: `radio "All" / "7d" / "14d" / "30d"`, plus an unnamed radio = Custom.
+- Custom shows inline From / To fields, and the From calendar opens on its own.
+  Days with candidates due show a dot (navigate months with the `Previous` button).
+- Type in the segments as above. The list filters client-side immediately.
+
+## Selector Notes
+- Date segments: `spinbutton "day, From"`, `"month, From"`, `"year, From"` (same for To).
+- Clearing a field: click each segment and press Backspace until it reads 0.
+- Count job rows: `[...document.querySelectorAll('tbody tr')]`, then take the
+  `J0…` text. Lists have one extra non-data `tbody tr`, so use the pagination
+  total for counts.
+- Candidates API (for expected values):
+  `/api/production/batchable-operations?location=<id>&process=<id>`. Effective due =
+  `dueDate ?? jobDueDate`. Operations already in a batch render as a `BAT…` row,
+  not as candidates.
+
+## Common Failures
+- **Escape in the batch builder closes the whole New Batch modal**, not just the
+  calendar popover.
+- **Typing a two-digit day passes through a one-digit intermediate** ("2" then
+  "20"). Fixed 2026-10-06: `DateRangeFields` emits `null` for an invalid range,
+  so the debounce restarts and the intermediate value is never applied.
+- Stock movements and other lists show one more `tbody tr` than there are rows.
+  Use the pagination total.
```

**File**: `apps/erp/app/components/DateRangeFields.tsx` (modified, +10/-5)
```diff
@@ -15,8 +15,13 @@ export type DateRangeValue = {
 type DateRangeFieldsProps = {
   /** Read once on mount; the fields hold the draft from then on. */
   defaultValue?: DateRangeValue;
-  /** Called with every complete range — a From after To is never emitted. */
-  onChange: (value: DateRangeValue) => void;
+  /**
+   * Called on every change. `null` while From is after To: there is nothing
+   * to apply, and the caller keeps its last range. It is still a change, so a
+   * debounced caller restarts its timer instead of firing a value typed on the
+   * way to the invalid one.
+   */
+  onChange: (value: DateRangeValue | null) => void;
   /** `stacked` for a popover, `inline` for a toolbar. */
   layout?: "stacked" | "inline";
   /** Open the From calendar on mount, for a control the user just picked. */
@@ -45,9 +50,9 @@ const DateRangeFields = ({
 
   const update = (next: DateRangeValue) => {
     setRange(next);
-    // From after To is flagged on the pickers and never reaches the caller
-    if (next.from && next.to && next.from.compare(next.to) > 0) return;
-    onChange(next);
+    // From after To is flagged on the pickers and is never applied
+    const isValid = !(next.from && next.to && next.from.compare(next.to) > 0);
+    onChange(isValid ? next : null);
   };
 
   const inline = layout === "inline";
```

**File**: `apps/erp/app/components/Table/components/Filter/DateRangeFilter.tsx` (modified, +8/-3)
```diff
@@ -34,8 +34,13 @@ const DateRangeFilter = ({ accessorKey }: DateRangeFilterProps) => {
     return { from: toCalendarDate(from), to: toCalendarDate(to) };
   });
 
-  const apply = ({ from, to }: DateRangeValue) => {
-    const value = formatRangeFilter(from?.toString(), to?.toString());
+  const apply = (range: DateRangeValue | null) => {
+    // From after To: keep whatever the URL already says
+    if (!range) return;
+    const value = formatRangeFilter(
+      range.from?.toString(),
+      range.to?.toString()
+    );
     // Already what the URL says — closing the popover replays the last change
     if (value === getFilterValue(accessorKey)) return;
     if (value) {
@@ -51,7 +56,7 @@ const DateRangeFilter = ({ accessorKey }: DateRangeFilterProps) => {
   const applyRef = useRef(apply);
   applyRef.current = apply;
   const debouncedApply = useDebounce(
-    (next: DateRangeValue) => applyRef.current(next),
+    (next: DateRangeValue | null) => applyRef.current(next),
     400,
     true
   );
```

**File**: `apps/erp/app/modules/production/ui/Batches/BatchBuilder.tsx` (modified, +2/-1)
```diff
@@ -1720,7 +1720,8 @@ function ComposePanel({
               layout="inline"
               autoOpen
               defaultValue={dueRange ?? undefined}
-              onChange={onDueRangeChange}
+              // From after To: keep filtering by the last valid range
+              onChange={(range) => range && onDueRangeChange(range)}
               isDateMarked={isDueDay}
             />
           )}
```

**File**: `packages/locale/locales/de/erp.po` (modified, +4/-5)
```diff
@@ -2260,7 +2260,7 @@ msgstr "Möchten Sie dieses Prüfmittel wirklich aktivieren?."
 msgid "Are you sure you want to cancel {0}? It will be closed and read-only until you reopen it."
 msgstr "Möchten Sie {0} wirklich stornieren? Es wird geschlossen und schreibgeschützt, bis Sie es wieder öffnen."
 
-#. placeholder {0}: routeData?.rfqSummary ?.rfqId!
+#. placeholder {0}: routeData?.rfqSummary ?.rfqId
 msgid "Are you sure you want to cancel {0}? This will also cancel all related supplier quotes."
 msgstr "Sind Sie sicher, dass Sie {0} stornieren möchten? Dies storniert auch alle zugehörigen Lieferantenofferten."
 
@@ -2633,8 +2633,8 @@ msgstr "Möchten Sie diese Seite wirklich verlassen?"
 msgid "Are you sure you want to pass this checkpoint? The {0} phase still has unfinished tasks."
 msgstr "Sind Sie sicher, dass Sie diesen Checkpoint passieren möchten? Die Phase {0} hat noch unvollendete Aufgaben."
 
-#. placeholder {0}: selectedPurchaseInvoice.invoiceId!
-#. placeholder {0}: selectedSalesInvoice.invoiceId!
+#. placeholder {0}: selectedPurchaseInvoice.invoiceId
+#. placeholder {0}: selectedSalesInvoice.invoiceId
 msgid "Are you sure you want to permanently delete {0}?"
 msgstr "Sind Sie sicher, dass Sie {0} dauerhaft löschen möchten?"
 
@@ -21355,8 +21355,7 @@ msgstr "Du kannst diesen Schlüssel nur einmal sehen. Speichere ihn sicher."
 
 #. placeholder {0}: leftoverQuantity === 1 ? "part" : "parts"
 #. placeholder {1}: job.quantity
-msgid ""
-"You completed {leftoverQuantity} more \n"
+msgid "You completed {leftoverQuantity} more \n"
 "                        {0} than the\n"
 "                        ordered quantity of {1}. What would you like\n"
 "                        to do with the extra parts?"
```

**File**: `packages/locale/locales/en/erp.po` (modified, +5/-7)
```diff
@@ -2260,7 +2260,7 @@ msgstr "Are you sure you want to activate this gauge?."
 msgid "Are you sure you want to cancel {0}? It will be closed and read-only until you reopen it."
 msgstr "Are you sure you want to cancel {0}? It will be closed and read-only until you reopen it."
 
-#. placeholder {0}: routeData?.rfqSummary ?.rfqId!
+#. placeholder {0}: routeData?.rfqSummary ?.rfqId
 msgid "Are you sure you want to cancel {0}? This will also cancel all related supplier quotes."
 msgstr "Are you sure you want to cancel {0}? This will also cancel all related supplier quotes."
 
@@ -2633,8 +2633,8 @@ msgstr "Are you sure you want to leave this page?"
 msgid "Are you sure you want to pass this checkpoint? The {0} phase still has unfinished tasks."
 msgstr "Are you sure you want to pass this checkpoint? The {0} phase still has unfinished tasks."
 
-#. placeholder {0}: selectedPurchaseInvoice.invoiceId!
-#. placeholder {0}: selectedSalesInvoice.invoiceId!
+#. placeholder {0}: selectedPurchaseInvoice.invoiceId
+#. placeholder {0}: selectedSalesInvoice.invoiceId
 msgid "Are you sure you want to permanently delete {0}?"
 msgstr "Are you sure you want to permanently delete {0}?"
 
@@ -21355,13 +21355,11 @@ msgstr "You can only see this key once. Store it safely."
 
 #. placeholder {0}: leftoverQuantity === 1 ? "part" : "parts"
 #. placeholder {1}: job.quantity
-msgid ""
-"You completed {leftoverQuantity} more \n"
+msgid "You completed {leftoverQuantity} more \n"
 "                        {0} than the\n"
 "                        ordered quantity of {1}. What would you like\n"
 "                        to do with the extra parts?"
-msgstr ""
-"You completed {leftoverQuantity} more \n"
+msgstr "You completed {leftoverQuantity} more \n"
 "                        {0} than the\n"
 "                        ordered quantity of {1}. What would you like\n"
 "                        to do with the extra parts?"
```

**File**: `packages/locale/locales/es/erp.po` (modified, +4/-5)
```diff
@@ -2260,7 +2260,7 @@ msgstr "¿Está seguro de que desea activar este instrumento de medición?."
 msgid "Are you sure you want to cancel {0}? It will be closed and read-only until you reopen it."
 msgstr "¿Está seguro de que desea cancelar {0}? Será cerrado y de solo lectura hasta que lo reabra."
 
-#. placeholder {0}: routeData?.rfqSummary ?.rfqId!
+#. placeholder {0}: routeData?.rfqSummary ?.rfqId
 msgid "Are you sure you want to cancel {0}? This will also cancel all related supplier quotes."
 msgstr "¿Está seguro de que desea cancelar {0}? Esto también cancelará todas las cotizaciones del proveedor relacionadas."
 
@@ -2633,8 +2633,8 @@ msgstr "¿Estás seguro de que quieres salir de esta página?"
 msgid "Are you sure you want to pass this checkpoint? The {0} phase still has unfinished tasks."
 msgstr "¿Estás seguro de que deseas pasar este checkpoint? La fase {0} aún tiene tareas sin terminar."
 
-#. placeholder {0}: selectedPurchaseInvoice.invoiceId!
-#. placeholder {0}: selectedSalesInvoice.invoiceId!
+#. placeholder {0}: selectedPurchaseInvoice.invoiceId
+#. placeholder {0}: selectedSalesInvoice.invoiceId
 msgid "Are you sure you want to permanently delete {0}?"
 msgstr "¿Estás seguro de que deseas eliminar permanentemente {0}?"
 
@@ -21355,8 +21355,7 @@ msgstr "Solo puedes ver esta clave una vez. Guárdala de forma segura."
 
 #. placeholder {0}: leftoverQuantity === 1 ? "part" : "parts"
 #. placeholder {1}: job.quantity
-msgid ""
-"You completed {leftoverQuantity} more \n"
+msgid "You completed {leftoverQuantity} more \n"
 "                        {0} than the\n"
 "                        ordered quantity of {1}. What would you like\n"
 "                        to do with the extra parts?"
```

**File**: `packages/locale/locales/fr/erp.po` (modified, +4/-5)
```diff
@@ -2260,7 +2260,7 @@ msgstr "Êtes-vous sûr de vouloir activer cet instrument de mesure ?"
 msgid "Are you sure you want to cancel {0}? It will be closed and read-only until you reopen it."
 msgstr "Êtes-vous sûr de vouloir annuler {0} ? Il sera fermé et en lecture seule jusqu'à ce que vous le rouvriez."
 
-#. placeholder {0}: routeData?.rfqSummary ?.rfqId!
+#. placeholder {0}: routeData?.rfqSummary ?.rfqId
 msgid "Are you sure you want to cancel {0}? This will also cancel all related supplier quotes."
 msgstr "Êtes-vous sûr de vouloir annuler {0} ? Cela annulera également tous les devis fournisseurs associés."
 
@@ -2633,8 +2633,8 @@ msgstr "Êtes-vous sûr de vouloir quitter cette page ?"
 msgid "Are you sure you want to pass this checkpoint? The {0} phase still has unfinished tasks."
 msgstr "Êtes-vous sûr de vouloir passer ce point de contrôle ? La phase {0} a encore des tâches inachevées."
 
-#. placeholder {0}: selectedPurchaseInvoice.invoiceId!
-#. placeholder {0}: selectedSalesInvoice.invoiceId!
+#. placeholder {0}: selectedPurchaseInvoice.invoiceId
+#. placeholder {0}: selectedSalesInvoice.invoiceId
 msgid "Are you sure you want to permanently delete {0}?"
 msgstr "Êtes-vous sûr de vouloir supprimer définitivement {0} ?"
 
@@ -21355,8 +21355,7 @@ msgstr "Vous ne pouvez voir cette clé qu'une seule fois. Conservez-la en sécur
 
 #. placeholder {0}: leftoverQuantity === 1 ? "part" : "parts"
 #. placeholder {1}: job.quantity
-msgid ""
-"You completed {leftoverQuantity} more \n"
+msgid "You completed {leftoverQuantity} more \n"
 "                        {0} than the\n"
 "                        ordered quantity of {1}. What would you like\n"
 "                        to do with the extra parts?"
```

---

### Incident Patch 12: `5351e935` (2026-10-05)
**Commit Message**: feat(dev): lighter default stack, crbn prune, and CLI robustness fixes (#1844)

Default stack
- crbn up starts eight services. Studio, Postgres-Meta, the edge runtime and
  imgproxy move behind --full; crbn reload <service> starts one on demand.
- Swagger generation reads PostgREST through Kong instead of Studio (the
  response is byte-identical), so it works at every stack size.
- A storage image transform attempted without imgproxy now logs one message
  that says how to start it (imageTransformErrorMessage in @carbon/files).
- Services restart on failure only, so a stack no longer comes back with the
  Docker daemon. Inbucket's mail lives in a named volume instead of leaking
  two anonymous volumes per boot.
- Conductor's default run script starts ERP and MES; the assembler is its own
  script.

New
- crbn prune destroys stacks whose worktree is gone or that have no slot;
  --all destroys every stack and keeps worktrees and live slots.
- crbn remove <branch-or-path...> skips the picker.
- crbn status --json and crbn list --json.
- pnpm --filter @carbon/dev smoke checks a real stack end to end.

Fixes
- crbn migrate on a never-booted worktree failed on storage.buckets: the
  migr

**File**: `.conductor/settings.toml` (modified, +7/-1)
```diff
@@ -27,7 +27,13 @@ run_mode = "concurrent"
 # flush redis, and release the port slot so the pool doesn't leak entries.
 archive = "./packages/dev/bin/crbn down --purge"
 
+# ERP + MES only. The assembler is a separate script: it needs the one-time
+# OCCT build and a cargo compile, which most workspaces never use.
 [scripts.run.dev]
-command = "./packages/dev/bin/crbn up --all"
+command = "CARBON_DEV_APPS=erp,mes ./packages/dev/bin/crbn up"
 default = true
 icon = "rocket"
+
+[scripts.run.dev-assembler]
+command = "CARBON_DEV_APPS=erp,mes,assembler ./packages/dev/bin/crbn up"
+icon = "box"
```

**File**: `apps/erp/app/modules/documents/documents.service.ts` (modified, +5/-2)
```diff
@@ -3,7 +3,7 @@
 // including ports, remain AGPLv3; serving them over a network requires releasing their source.
 
 import type { Database } from "@carbon/database";
-import { storage } from "@carbon/files";
+import { imageTransformErrorMessage, storage } from "@carbon/files";
 import { isHeic } from "@carbon/files/media";
 import { trigger } from "@carbon/jobs";
 import type { SupabaseClient } from "@supabase/supabase-js";
@@ -300,7 +300,10 @@ export async function insertUploadedDocument(
       return {
         data: null,
         error: new Error(
-          "Failed to convert the staged image — is image transformation enabled on this stack? The staged upload was left in place; re-register to retry."
+          imageTransformErrorMessage(
+            converted.error,
+            "Failed to convert the staged image — is image transformation enabled on this stack? The staged upload was left in place; re-register to retry."
+          )
         )
       };
     }
```

**File**: `apps/erp/app/modules/shared/shared.service.ts` (modified, +16/-2)
```diff
@@ -4,7 +4,13 @@
 
 import type { Database, Tables } from "@carbon/database";
 import type { Kysely, KyselyDatabase } from "@carbon/database/client";
-import { getContentType, getFileExtension, storage } from "@carbon/files";
+import {
+  getContentType,
+  getFileExtension,
+  imageTransformErrorMessage,
+  storage
+} from "@carbon/files";
+import { getLogger } from "@carbon/logger";
 import { type ServerFnInput, serverFns } from "@carbon/server-functions";
 import type {
   PostgrestResponse,
@@ -16,6 +22,8 @@ import { LIST_COUNT, setGenericQueryFilters } from "~/utils/query";
 import type { PriceBreak, SupplierPriceMap } from "./shared.models";
 import type { ItemModelUpload } from "./types";
 
+const logger = getLogger("erp", "shared");
+
 export async function deleteNote(
   client: SupabaseClient<Database>,
   noteId: string
@@ -73,10 +81,16 @@ export async function getBase64ImageFromSupabase(
     return null;
   }
 
-  const { data } = await storage(client)
+  const { data, error } = await storage(client)
     .company(companyId)
     .download(path, heic ? { transform: { quality: 90 } } : undefined);
   if (!data) {
+    if (heic) {
+      logger.error(
+        imageTransformErrorMessage(error, "Failed to transform HEIC file"),
+        { path, error }
+      );
+    }
     return null;
   }
 
```

**File**: `apps/erp/app/routes/file+/preview+/$bucket.$.tsx` (modified, +10/-3)
```diff
@@ -10,6 +10,7 @@ import {
   fileResponseHeaders,
   getCompanyPrivateBucket,
   getContentType,
+  imageTransformErrorMessage,
   isStorageNotFound,
   isUnsafeStoragePath,
   LEGACY_PRIVATE_BUCKET,
@@ -107,9 +108,15 @@ export let loader = async ({ request, params }: LoaderFunctionArgs) => {
         contentType = transformed.data.type || "image/jpeg";
         return transformed;
       }
-      // No imgproxy (stale self-host stack) — fall through to the raw bytes;
-      // Safari can still render them.
-      logger.error(transformed.error);
+      // No imgproxy (off by default locally, or a stale self-host stack) —
+      // fall through to the raw bytes; Safari can still render them.
+      logger.error(
+        imageTransformErrorMessage(
+          transformed.error,
+          "Failed to transform HEIC file"
+        ),
+        { path, error: transformed.error }
+      );
     }
     // Use the original encoded path for the storage API call
     return source.download(path);
```

**File**: `apps/mes/app/routes/file+/preview+/$bucket.$.tsx` (modified, +10/-3)
```diff
@@ -10,6 +10,7 @@ import {
   fileResponseHeaders,
   getCompanyPrivateBucket,
   getContentType,
+  imageTransformErrorMessage,
   isStorageNotFound,
   isUnsafeStoragePath,
   LEGACY_PRIVATE_BUCKET,
@@ -115,9 +116,15 @@ export let loader = async ({ request, params }: LoaderFunctionArgs) => {
         contentType = transformed.data.type || "image/jpeg";
         return transformed;
       }
-      // No imgproxy (stale self-host stack) — fall through to the raw bytes;
-      // Safari can still render them.
-      log.error("Failed to transform HEIC file", { error: transformed.error });
+      // No imgproxy (off by default locally, or a stale self-host stack) —
+      // fall through to the raw bytes; Safari can still render them.
+      log.error(
+        imageTransformErrorMessage(
+          transformed.error,
+          "Failed to transform HEIC file"
+        ),
+        { path, error: transformed.error }
+      );
     }
     // Use the original encoded path for the storage API call
     return source.download(path);
```

**File**: `packages/dev/AGENTS.md` (modified, +14/-3)
```diff
@@ -26,18 +26,29 @@ Developer CLI (`crbn` command) — worktree management, Docker Compose stacks, m
 ```bash
 pnpm --filter @carbon/dev test        # vitest
 pnpm --filter @carbon/dev typecheck   # tsgo --noEmit
+pnpm --filter @carbon/dev smoke       # real containers: slots, fresh migrate, up, status, purge (~40 s, needs Docker; run from a worktree with no stack)
 ```
 
 ## Key Patterns
 
-- **Commands**: `up`, `down` (`--purge` releases the slot), `new`, `init`, `remove`, `list`, `status`, `reset`, `migrate`, `restore`, `copy` (env sync), `reload` (`crbn reload <service...>` → `docker compose up -d --force-recreate` a subset, applying compose/`.env.local` edits without restarting the app dev servers)
-- **Restore** (`commands/restore.ts`): `crbn restore <file>` wraps `scripts/restore-database.sh` (the SQL is deliberately NOT ported) and adds worktree/`PORT_DB` resolution, a confirmation gate, and the trailing `applyMigrations` + `db:types`. The script truncates the local `supabase_migrations` ledger before restoring so the dump's own ledger lands — the ledger must travel WITH the schema, else the dump's older schema pairs with the local newer ledger and the trailing migrate step silently no-ops (leaving weeks of migrations missing while the ledger claims them applied). It deliberately does NOT boot a postgres-only stack the way `crbn migrate` does — a restore rewrites `auth`/`storage`, whose schemas GoTrue and Storage build via their own migrations, so it requires a fully booted stack (`serviceSchemasReady` probes for GoTrue's `auth.users.email_confirmed_at` AND `storage.objects`/`storage.buckets` — the restore script's `to_regclass` guards mean a missing Storage schema would otherwise let the restore finish with no buckets seeded) and refuses otherwise — the backup carries the SOURCE schema, which is usually behind the branch. **`--scrub-emails` defaults ON here, inverting the script's opt-in default**, so a restore cannot drop real customer addresses into a local DB unless asked. By default the script truncates `storage.objects` (kept rows would point at files that live only in the source environment's backend, so downloads 404); pass `--keep-storage-objects` to retain them and the dump's buckets when you need realistic storage metadata, e.g. profiling storage RLS.
-- **Stack boot** (`commands/up.ts`): Docker Compose → wait Postgres → migrations → regen types → spawn apps → portless aliases
+- **Commands**: `up`, `down` (`--purge` releases the slot), `new`, `init`, `remove`, `prune` (destroys stacks whose worktree directory is gone or that have no slot — the cleanup for worktrees deleted without `crbn remove`; `--all` destroys every stack on the machine and keeps worktrees and live slots), `list`, `status`, `reset`, `migrate`, `restore`, `copy` (env sync), `reload` (`crbn reload <service...>` → `docker compose up -d --force-recreate` a subset, applying compose/`.env.local` edits without restarting the app dev servers)
+- **Restore** (`commands/restore.ts`): `crbn restore <file>` wraps `scripts/restore-database.sh` (the SQL is deliberately NOT ported) and adds worktree/`PORT_DB` resolution, a confirmation gate, and the trailing `applyMigrations` + `db:types`. The script truncates the local `supabase_migrations` ledger before restoring so the dump's own ledger lands — the ledger must travel WITH the schema, else the dump's older schema pairs with the local newer ledger and the trailing migrate step silently no-ops (leaving weeks of migrations missing while the ledger claims them applied). It deliberately does NOT boot a partial stack the way `crbn migrate` does — a restore rewrites `auth`/`storage`, whose schemas GoTrue and Storage build via their own migrations, so it requires a fully booted stack (`serviceSchemasReady` probes for GoTrue's `auth.users.email_confirmed_at`, `storage.objects`/`storage.buckets` AND Realtime's `realtime.messages` — the restore script's `to_regclass` guards mean a missing Storage schema would otherwise let the restore finish with no buckets seeded) and refuses otherwise — the backup carries the SOURCE schema, which is usually behind the branch. **`--scrub-emails` defaults ON here, inverting the script's opt-in default**, so a restore cannot drop real customer addresses into a local DB unless asked. By default the script truncates `storage.objects` (kept rows would point at files that live only in the source environment's backend, so downloads 404); pass `--keep-storage-objects` to retain them and the dump's buckets when you need realistic storage metadata, e.g. profiling storage RLS.
+- **Stack boot** (`commands/up.ts`): Docker Compose → wait Postgres → wait service schemas → migrations → regen types → spawn apps → portless aliases
+- **Migrations need three services, not just Postgres**: they write into `storage.buckets`, GoTrue's `auth` columns and `realtime.messages`, which Storage, GoTrue and Realtime build on first boot. `waitForServiceSchemas` gates every migrate on a fre
```

**File**: `packages/dev/README.md` (modified, +6/-0)
```diff
@@ -20,8 +20,12 @@ source ./setup.sh   # adds crbn to PATH + installs shell wrapper
 | `crbn checkout main` | cd into the main checkout (never creates a separate worktree). |
 | `crbn new [branch]` | Interactive worktree creation. Optional branch name pre-fills the prompt. |
 | `crbn list` | Show all worktrees with stack status. |
+| `crbn list --json` | The same list as JSON, for scripts and agents. |
 | `crbn remove` | Multi-select worktrees to delete (concurrent teardown with progress). |
+| `crbn remove <branch-or-path...>` | Remove the named worktrees without the picker (`CARBON_DEV_YES=1` skips the confirmation). |
 | `crbn remove --prune` | Also delete the git branch after removing each worktree. |
+| `crbn prune` | Destroy stacks no worktree can reach: slots whose directory is gone, and stacks with no slot. Lists them and confirms first; volumes are wiped. |
+| `crbn prune --all` | Destroy every crbn stack on the machine, running ones included. Worktrees, branches and live slots are kept; the next `crbn up` rebuilds the database. |
 
 ### Stack
 
@@ -32,12 +36,14 @@ source ./setup.sh   # adds crbn to PATH + installs shell wrapper
 | `crbn up --no-portless` | Localhost mode: fixed ports (API `:54321`, ERP `:3000`, MES `:3001`). |
 | `crbn up --borrow` | Reuse another worktree's running containers (DB, API, etc). |
 | `crbn up --no-apps` | Services only (postgres, kong, supabase, inngest, mail). |
+| `crbn up --full` | Also start Studio, Postgres-Meta, the edge runtime and imgproxy (HEIC conversion). They are off by default; `crbn reload studio` or `crbn reload imgproxy` starts one on a running stack. |
 | `crbn up --no-migrate` | Skip database migrations. |
 | `crbn up --no-regen` | Skip type/swagger regeneration. |
 | `crbn up --pull` | Force `docker compose pull` even if images exist locally. |
 | `crbn down` | Stop stack (volumes preserved). |
 | `crbn reset` | Wipe volumes + flush redis db, then `up`. |
 | `crbn status` | Port assignment + container health. |
+| `crbn status --json` | The slot and containers as JSON, for scripts and agents. |
 | `crbn migrate` | Apply DB migrations against the running stack. |
 
 `CARBON_DEV_APPS` skips the picker: `CARBON_DEV_APPS=erp,mes,email crbn up`.
```

**File**: `packages/dev/bin/crbn` (modified, +10/-8)
```diff
@@ -436,19 +436,23 @@ crbn — Carbon dev CLI
     crbn new [branch]               Interactive worktree creation.
     crbn init                       Provision the current worktree (slug/env/skills).
     crbn list                       Show all worktrees with stack status.
-    crbn remove [--prune]           Multi-select worktrees to delete.
+    crbn remove [--prune] [name...] Delete worktrees (picker, or named by branch/path).
                                     --prune also deletes the git branch.
+    crbn prune                      Destroy stacks whose worktree is gone.
+    crbn prune --all                Destroy every stack on this machine (worktrees kept).
 
   Stack:
     crbn up                         Boot compose stack + apps.
     crbn up --all                   Launch all apps without the picker.
     crbn up --no-portless           Localhost mode (API:54321 ERP:3000 MES:3001).
     crbn up --borrow                Reuse another worktree's containers.
     crbn up --no-apps               Services only, no dev servers.
+    crbn up --full                  Also start Studio, Postgres-Meta, edge runtime, imgproxy.
     crbn down                       Stop stack (volumes preserved).
     crbn down --purge               Stop stack, wipe volumes, release the slot.
     crbn reset                      Wipe volumes + redis, then up.
     crbn status                     Port assignment + container health.
+    crbn status --json              Same, as JSON (also: crbn list --json).
     crbn migrate                    Apply DB migrations (loads .env.local).
     crbn restore <file>             Restore a prod backup, then apply migrations it predates.
     crbn reload <service...>        Recreate compose services (apply compose/env edits, apps untouched).
@@ -482,13 +486,11 @@ case "$cmd" in
   checkout)
     cmd_checkout "$@"
     ;;
-  copy|env|up|down|reset|status|migrate|restore|new|init|list|remove|reload|complete)
-    delegate_ts "$cmd" "$@"
-    ;;
   *)
-    echo "crbn: unknown command '$cmd'" >&2
-    echo >&2
-    print_help >&2
-    exit 2
+    # Everything else belongs to the TypeScript CLI, which reports an unknown
+    # command itself. No allow-list here: this router runs from the main
+    # checkout while the CLI runs from the current worktree, so a list would
+    # reject subcommands a branch adds.
+    delegate_ts "$cmd" "$@"
     ;;
 esac
```

---

### Incident Patch 13: `1f6a7981` (2026-10-05)
**Commit Message**: fix(ui): a pressed link stops prefetching after the page changes

PrefetchLink kept its prefetch tags mounted after a press, so a sidebar link that had been clicked once prefetched its page again after every later navigation. The tags now exist only on the page where the link was pressed.

**File**: `packages/react/src/PrefetchLink.tsx` (modified, +19/-5)
```diff
@@ -6,7 +6,7 @@
 
 import { forwardRef, useState } from "react";
 import type { LinkProps } from "react-router";
-import { Link, PrefetchPageLinks, useHref } from "react-router";
+import { Link, PrefetchPageLinks, useHref, useLocation } from "react-router";
 
 const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
 
@@ -31,8 +31,15 @@ export const PrefetchLink = forwardRef<
   Omit<LinkProps, "prefetch">
 >(({ onPointerDown, ...props }, ref) => {
   const href = useHref(props.to, { relative: props.relative });
-  // A new key remounts the prefetch tags, so each press prefetches again.
-  const [presses, setPresses] = useState(0);
+  const location = useLocation();
+  // The tags live only on the page that was showing when the link was pressed.
+  // Left mounted, they prefetched the destination again after every later
+  // navigation, for routes that page did not have yet. A new count remounts
+  // them, so each press prefetches again.
+  const [pressed, setPressed] = useState<{
+    locationKey: string;
+    count: number;
+  } | null>(null);
   const canPrefetch =
     props.to !== "#" &&
     !(typeof props.to === "string" && ABSOLUTE_URL.test(props.to));
@@ -52,10 +59,17 @@ export const PrefetchLink = forwardRef<
             !event.ctrlKey &&
             !event.shiftKey &&
             !event.altKey;
-          if (plain && canPrefetch) setPresses((n) => n + 1);
+          if (plain && canPrefetch) {
+            setPressed((last) => ({
+              locationKey: location.key,
+              count: (last?.count ?? 0) + 1
+            }));
+          }
         }}
       />
-      {presses > 0 && <PrefetchPageLinks key={presses} page={href} />}
+      {pressed?.locationKey === location.key && (
+        <PrefetchPageLinks key={pressed.count} page={href} />
+      )}
     </>
   );
 });
```

---

### Incident Patch 14: `639a9529` (2026-10-05)
**Commit Message**: perf(ui): prefetch on press again, and let the click reuse the prefetch

A prefetch response (Sec-Purpose: prefetch) now gets Cache-Control: private, max-age=5 from prefetchCacheMiddleware in each app's root middleware, so the click is answered from it instead of a second request that waited behind it. Navigations and revalidations stay uncached. This is the fix React Router points to in remix-run/react-router#13255.

Restores the press prefetch removed in 6e3bdf7bc6.

**File**: `.ai/lessons.md` (modified, +2/-2)
```diff
@@ -2996,6 +2996,6 @@ tag until proven otherwise.
 
 **Problem:** Single-fetch `.data` responses carry `cache-control: max-age=0, must-revalidate` and no validator, so the browser never serves the click from the prefetched response: both requests reach the server. Chrome also holds a second request for a URL until the first one's response arrives (its HTTP cache admits one writer per URL). The click's request therefore waited behind the prefetch: 781 ms against 518 ms median click-to-page in production, and two same-URL `fetch` calls took 572 / 923 ms where two `cache: "no-store"` ones took 615 / 585 ms.
 
-**Rule:** Do not start a second request for a URL that is already in flight, and do not prefetch a response the browser is not allowed to reuse. Before adding a prefetch, read the response's `cache-control`. Measure a prefetch by click-to-page time, not by whether the request was sent.
+**Rule:** A prefetch only helps if the browser may reuse its response. Give a prefetch response (`Sec-Purpose: prefetch`) a short `private` lifetime and leave every other response uncached; `prefetchCacheMiddleware` (`@carbon/utils`) does it in each app's root `middleware`, the fix React Router points to (remix-run/react-router#13255). Measure a prefetch by click-to-page time, not by whether the request was sent. A first fix removed the prefetch instead (`6e3bdf7bc6`); it worked but threw away the head start.
 
-**Applies to:** `packages/react/src/PrefetchLink.tsx`; any `<Link prefetch>` or `PrefetchPageLinks`; a revalidation started while a navigation to the same URL is loading.
+**Applies to:** `packages/react/src/PrefetchLink.tsx`; `packages/utils/src/prefetch.ts`; any `<Link prefetch>` or `PrefetchPageLinks`; a revalidation started while a navigation to the same URL is loading.
```

**File**: `apps/erp/app/root.tsx` (modified, +3/-1)
```diff
@@ -30,6 +30,7 @@ import {
   getPreferenceHeaders,
   isSearchParamOnlyNavigation,
   modeValidator,
+  prefetchCacheMiddleware,
   themes
 } from "@carbon/utils";
 import { faviconLinks } from "@carbon/utils/favicon";
@@ -73,7 +74,8 @@ export const middleware = timedMiddleware({
   request: requestMiddleware,
   security: securityMiddleware,
   formBody: formBodyMiddleware,
-  flash: flashMiddleware
+  flash: flashMiddleware,
+  prefetchCache: prefetchCacheMiddleware
 });
 export const clientMiddleware = [
   flashClientMiddleware,
```

**File**: `apps/mes/app/root.tsx` (modified, +3/-1)
```diff
@@ -30,6 +30,7 @@ import {
   getPreferenceHeaders,
   isSearchParamOnlyNavigation,
   modeValidator,
+  prefetchCacheMiddleware,
   themes
 } from "@carbon/utils";
 import { faviconLinks } from "@carbon/utils/favicon";
@@ -72,7 +73,8 @@ export const middleware = timedMiddleware({
   request: requestMiddleware,
   security: securityMiddleware,
   formBody: formBodyMiddleware,
-  flash: flashMiddleware
+  flash: flashMiddleware,
+  prefetchCache: prefetchCacheMiddleware
 });
 export const clientMiddleware = [
   flashClientMiddleware,
```

**File**: `apps/starter/app/root.tsx` (modified, +8/-2)
```diff
@@ -16,7 +16,12 @@ import { validator } from "@carbon/form";
 import { requestIdMiddleware } from "@carbon/logger/middleware.server";
 import { Button, Heading, Toaster, useMode } from "@carbon/react";
 import type { Theme } from "@carbon/utils";
-import { colorSchemeHintScript, modeValidator, themes } from "@carbon/utils";
+import {
+  colorSchemeHintScript,
+  modeValidator,
+  prefetchCacheMiddleware,
+  themes
+} from "@carbon/utils";
 import { faviconLinks } from "@carbon/utils/favicon";
 import { Analytics } from "@vercel/analytics/react";
 import type React from "react";
@@ -48,7 +53,8 @@ export const middleware = [
   requestIdMiddleware,
   securityMiddleware,
   formBodyMiddleware,
-  flashMiddleware
+  flashMiddleware,
+  prefetchCacheMiddleware
 ];
 export const clientMiddleware = [flashClientMiddleware];
 
```

**File**: `packages/react/AGENTS.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ import { Button, Card, HStack, VStack, IconButton, cn } from "@carbon/react";
 - **Layout**: `VStack` / `HStack` with numeric `spacing` prop (maps to `space-y-*`/`space-x-*`)
 - **Overlays**: `Drawer`, `Modal`, `ModalDrawer` (unified drawer/modal), `BottomSheet`, `Popover`. A controlled `Modal`/`Drawer` with no `onOpenChange` cannot be dismissed and shows no close button; never pass a handler that does nothing (`no-noop-open-change` check). A route rendered as a modal or drawer closes with `useCloseRoute()` (back when this tab has history, else the parent route), not `navigate(-1)`
 - **App nav**: `NavRail` is the primary left nav of both the ERP and MES shells (56px icon rail, expands after a 150ms mouse hover or when pinned via `SidebarProvider` (⌘B unless `keyboardShortcut={false}`, as in the ERP), left drawer below md that closes itself on navigation). Optional `header` (use `NavRailBrand` for a logo + name) and `footer` slots; `NavRailGroup` adds a titled section that shows as a divider while collapsed. Entries are `NavRailItem` (a button, or `asChild` for a trigger/link) and `NavRailLink`; `label` is a string and doubles as the accessible name. A Radix menu/popover opened from a `NavRailItem` keeps the rail as it was (open or collapsed) until it closes. Render inside `SidebarProvider`; the shadcn-style `Sidebar*` primitives remain for other layouts
-- **Links**: `PrefetchLink` is the app's React Router `Link` and the one place that decides whether links prefetch. Today they do not: page data is served `max-age=0`, so a prefetched response is never reused, and the browser holds the click's request for the same URL behind it (about 260 ms slower per click than no prefetch, measured in production). Use it instead of `<Link prefetch="intent">`. `NavRailLink` and both apps' `Hyperlink` already use it
+- **Links that prefetch**: `PrefetchLink` is a React Router `Link` that prefetches its destination when the pointer goes down on it. Use it instead of `<Link prefetch="intent">`, which prefetches on a 100 ms hover and so runs a page's loaders for every row the mouse passes over. The click reuses the prefetch only because `prefetchCacheMiddleware` (`@carbon/utils`, in each app's root `middleware`) gives a prefetch response a few seconds of private cache; without it both requests reach the server and the click waits behind the prefetch. `NavRailLink` and both apps' `Hyperlink` already use it
 - **Data**: `Table` (TanStack), chart components via sub-exports (`@carbon/react/Chart`)
 - **Rich text**: `@carbon/react/Editor` and `@carbon/react/RichText` (wraps `@carbon/tiptap`)
 - **Error boundary**: `@carbon/react/ErrorBoundary` — `RouteErrorBoundary` (exported as `ErrorBoundary` from a module layout so a failed loader shows inside the app shell) and `RootErrorBoundary` (drop-in root `ErrorBoundary` for RR v7 that maps 404 / other HTTP / thrown `Error` to a styled screen) plus its parts (`ErrorScreen`, `GlitchHeading`, `StatusReadout`, `MagneticLink`, `NoiseOverlay`). Wrap it in the app's `Document` and pass `env` so `window.env` is set (the client crashes hydration otherwise). Copy is intentionally hardcoded English, not i18n.
```

**File**: `packages/react/src/PrefetchLink.tsx` (modified, +45/-10)
```diff
@@ -4,24 +4,59 @@
 
 "use client";
 
-import { forwardRef } from "react";
+import { forwardRef, useState } from "react";
 import type { LinkProps } from "react-router";
-import { Link } from "react-router";
+import { Link, PrefetchPageLinks, useHref } from "react-router";
+
+const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
 
 /**
- * The app's `Link`: the one place that decides whether links prefetch. Today
- * they do not.
+ * A `Link` that prefetches its destination when the pointer goes down on it.
+ *
+ * `prefetch="intent"` prefetches on a 100 ms hover, so moving the mouse down a
+ * list ran every hovered page's loaders for a click that mostly never came. A
+ * press is a commitment: it costs one request, and the page gets the time
+ * between press and release as a head start.
  *
- * Page data is served `max-age=0`, so the browser cannot answer a click from a
- * prefetched response. It also holds a second request for a URL until the
- * first one's response arrives, so a prefetch started on hover or on press
- * made the click's own request wait behind it: about 260 ms slower per click
- * than no prefetch, measured in production.
+ * The click reuses the prefetched response only because
+ * `prefetchCacheMiddleware` (`@carbon/utils`) lets the browser keep it for a
+ * few seconds. Without that header both requests reach the server, and the
+ * browser holds the click's request until the prefetch's response arrives:
+ * slower than no prefetch at all.
  *
  * Use this instead of `<Link prefetch="intent">`.
  */
 export const PrefetchLink = forwardRef<
   HTMLAnchorElement,
   Omit<LinkProps, "prefetch">
->((props, ref) => <Link ref={ref} {...props} />);
+>(({ onPointerDown, ...props }, ref) => {
+  const href = useHref(props.to, { relative: props.relative });
+  // A new key remounts the prefetch tags, so each press prefetches again.
+  const [presses, setPresses] = useState(0);
+  const canPrefetch =
+    props.to !== "#" &&
+    !(typeof props.to === "string" && ABSOLUTE_URL.test(props.to));
+
+  return (
+    <>
+      <Link
+        ref={ref}
+        {...props}
+        onPointerDown={(event) => {
+          onPointerDown?.(event);
+          // A modified or non-primary press opens a new tab or a menu: the
+          // page being prefetched would not be the one that uses it.
+          const plain =
+            event.button === 0 &&
+            !event.metaKey &&
+            !event.ctrlKey &&
+            !event.shiftKey &&
+            !event.altKey;
+          if (plain && canPrefetch) setPresses((n) => n + 1);
+        }}
+      />
+      {presses > 0 && <PrefetchPageLinks key={presses} page={href} />}
+    </>
+  );
+});
 PrefetchLink.displayName = "PrefetchLink";
```

**File**: `packages/utils/AGENTS.md` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@ pnpm --filter @carbon/utils typecheck
 | `string` | Slugify, truncate, camelCase/titleCase conversions |
 | `items` | Item lookups and `getReadableIdWithRevision` (`readableId.revision`) |
 | `revalidate` | `shouldRevalidate` predicates: `isSearchParamOnlyNavigation` (root loaders), `isUnaffectedByNavigation` (detail layouts — names the route/search params the loader reads) |
+| `prefetch` | `prefetchCacheMiddleware` — root `middleware` of every app: a prefetch response (`Sec-Purpose: prefetch`) gets `private, max-age=5`, so the click reuses it instead of asking again and waiting behind it. Navigations and revalidations stay uncached |
 | `redirect` | `redirect(to, init?)` — the only redirect a loader or action uses: a path on this origin, anything else lands on the home page (`no-raw-redirect` check); `redirectExternal(url, init?)` to leave the origin on purpose with a URL the server built; `safePath(to, fallback)` for a destination that is stored or forwarded rather than redirected to. `redirectBeforeLoaders(loader)` — route middleware for an index route that only redirects, so the redirect runs before its parents' loaders |
 | `status` | Status resolution, status color mapping |
 | `rules` | Rule engine: condition AST, the shared `Operator` vocabulary, JIT-compiled evaluator + surfaces for storage rules and sales rules |
```

**File**: `packages/utils/src/index.ts` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ export * from "./mode";
 export * from "./object";
 export * from "./payment-funding";
 export * from "./pick-guards";
+export * from "./prefetch";
 export * from "./purchase-cost-adjustment";
 export * from "./receiving";
 export * from "./redirect";
```

---

### Incident Patch 15: `6e3bdf7b` (2026-10-05)
**Commit Message**: perf(ui): stop prefetching a link on press

Page data is served max-age=0, so the browser never answered the click from the prefetched response, and it held the click's request for the same URL until the prefetch's response arrived. Click-to-page in production was 781 ms with the prefetch against 518 ms without (median of six each).

**File**: `.ai/lessons.md` (modified, +11/-0)
```diff
@@ -2988,3 +2988,14 @@ tag until proven otherwise.
 **Rule:** Key anything stored on the device by user as well as company, and empty the in-memory cache when the user changes (`setClientCompanyId(companyId, userId)`). A cache that is only ever patched needs a path that replaces it.
 
 **Applies to:** `packages/query/src/useLiveList.tsx`, `packages/query/src/cache.ts`, any new client-side persistence.
+
+
+## A prefetch the browser cannot reuse makes the click slower
+
+**Context:** Links prefetched their page's data on hover, then (2026-10-02) on press, to give the click a head start.
+
+**Problem:** Single-fetch `.data` responses carry `cache-control: max-age=0, must-revalidate` and no validator, so the browser never serves the click from the prefetched response: both requests reach the server. Chrome also holds a second request for a URL until the first one's response arrives (its HTTP cache admits one writer per URL). The click's request therefore waited behind the prefetch: 781 ms against 518 ms median click-to-page in production, and two same-URL `fetch` calls took 572 / 923 ms where two `cache: "no-store"` ones took 615 / 585 ms.
+
+**Rule:** Do not start a second request for a URL that is already in flight, and do not prefetch a response the browser is not allowed to reuse. Before adding a prefetch, read the response's `cache-control`. Measure a prefetch by click-to-page time, not by whether the request was sent.
+
+**Applies to:** `packages/react/src/PrefetchLink.tsx`; any `<Link prefetch>` or `PrefetchPageLinks`; a revalidation started while a navigation to the same URL is loading.
```

**File**: `packages/react/AGENTS.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ import { Button, Card, HStack, VStack, IconButton, cn } from "@carbon/react";
 - **Layout**: `VStack` / `HStack` with numeric `spacing` prop (maps to `space-y-*`/`space-x-*`)
 - **Overlays**: `Drawer`, `Modal`, `ModalDrawer` (unified drawer/modal), `BottomSheet`, `Popover`. A controlled `Modal`/`Drawer` with no `onOpenChange` cannot be dismissed and shows no close button; never pass a handler that does nothing (`no-noop-open-change` check). A route rendered as a modal or drawer closes with `useCloseRoute()` (back when this tab has history, else the parent route), not `navigate(-1)`
 - **App nav**: `NavRail` is the primary left nav of both the ERP and MES shells (56px icon rail, expands after a 150ms mouse hover or when pinned via `SidebarProvider` (⌘B unless `keyboardShortcut={false}`, as in the ERP), left drawer below md that closes itself on navigation). Optional `header` (use `NavRailBrand` for a logo + name) and `footer` slots; `NavRailGroup` adds a titled section that shows as a divider while collapsed. Entries are `NavRailItem` (a button, or `asChild` for a trigger/link) and `NavRailLink`; `label` is a string and doubles as the accessible name. A Radix menu/popover opened from a `NavRailItem` keeps the rail as it was (open or collapsed) until it closes. Render inside `SidebarProvider`; the shadcn-style `Sidebar*` primitives remain for other layouts
-- **Links that prefetch**: `PrefetchLink` is a React Router `Link` that prefetches its destination when the pointer goes down on it. Use it instead of `<Link prefetch="intent">`, which prefetches on a 100 ms hover and so runs a page's loaders for every row the mouse passes over. `NavRailLink` and both apps' `Hyperlink` already use it
+- **Links**: `PrefetchLink` is the app's React Router `Link` and the one place that decides whether links prefetch. Today they do not: page data is served `max-age=0`, so a prefetched response is never reused, and the browser holds the click's request for the same URL behind it (about 260 ms slower per click than no prefetch, measured in production). Use it instead of `<Link prefetch="intent">`. `NavRailLink` and both apps' `Hyperlink` already use it
 - **Data**: `Table` (TanStack), chart components via sub-exports (`@carbon/react/Chart`)
 - **Rich text**: `@carbon/react/Editor` and `@carbon/react/RichText` (wraps `@carbon/tiptap`)
 - **Error boundary**: `@carbon/react/ErrorBoundary` — `RouteErrorBoundary` (exported as `ErrorBoundary` from a module layout so a failed loader shows inside the app shell) and `RootErrorBoundary` (drop-in root `ErrorBoundary` for RR v7 that maps 404 / other HTTP / thrown `Error` to a styled screen) plus its parts (`ErrorScreen`, `GlitchHeading`, `StatusReadout`, `MagneticLink`, `NoiseOverlay`). Wrap it in the app's `Document` and pass `env` so `window.env` is set (the client crashes hydration otherwise). Copy is intentionally hardcoded English, not i18n.
```

**File**: `packages/react/src/PrefetchLink.tsx` (modified, +10/-41)
```diff
@@ -4,55 +4,24 @@
 
 "use client";
 
-import { forwardRef, useState } from "react";
+import { forwardRef } from "react";
 import type { LinkProps } from "react-router";
-import { Link, PrefetchPageLinks, useHref } from "react-router";
-
-const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
+import { Link } from "react-router";
 
 /**
- * A `Link` that prefetches its destination when the pointer goes down on it.
+ * The app's `Link`: the one place that decides whether links prefetch. Today
+ * they do not.
  *
- * `prefetch="intent"` prefetches on a 100 ms hover, so moving the mouse down a
- * list ran every hovered page's loaders for a click that mostly never came. A
- * press is a commitment: it costs one request, and the page gets the time
- * between press and release as a head start. Chromium serves the click from
- * the prefetched response; a browser that does not reuse it makes one extra
- * request per click, never one per hover.
+ * Page data is served `max-age=0`, so the browser cannot answer a click from a
+ * prefetched response. It also holds a second request for a URL until the
+ * first one's response arrives, so a prefetch started on hover or on press
+ * made the click's own request wait behind it: about 260 ms slower per click
+ * than no prefetch, measured in production.
  *
  * Use this instead of `<Link prefetch="intent">`.
  */
 export const PrefetchLink = forwardRef<
   HTMLAnchorElement,
   Omit<LinkProps, "prefetch">
->(({ onPointerDown, ...props }, ref) => {
-  const href = useHref(props.to, { relative: props.relative });
-  // A new key remounts the prefetch tags, so each press prefetches again.
-  const [presses, setPresses] = useState(0);
-  const canPrefetch =
-    props.to !== "#" &&
-    !(typeof props.to === "string" && ABSOLUTE_URL.test(props.to));
-
-  return (
-    <>
-      <Link
-        ref={ref}
-        {...props}
-        onPointerDown={(event) => {
-          onPointerDown?.(event);
-          // A modified or non-primary press opens a new tab or a menu: the
-          // page being prefetched would not be the one that uses it.
-          const plain =
-            event.button === 0 &&
-            !event.metaKey &&
-            !event.ctrlKey &&
-            !event.shiftKey &&
-            !event.altKey;
-          if (plain && canPrefetch) setPresses((n) => n + 1);
-        }}
-      />
-      {presses > 0 && <PrefetchPageLinks key={presses} page={href} />}
-    </>
-  );
-});
+>((props, ref) => <Link ref={ref} {...props} />);
 PrefetchLink.displayName = "PrefetchLink";
```

#### Recent Merged Pull Requests:
- **PR #1850** (2026-10-05): Slow-request fixes: scheduler writes, schedule board, realtime reloads (@sidwebworks)
- **PR #1849** (2026-10-05): fix(invoicing): finish the Invoice Customer change and scope new-invoice pickers to it (@naveenkash)
- **PR #1848** (2026-10-05): crbn: hibernate an idle stack and its dev servers, prune --tree, responsive list (@sidwebworks)
- **PR #1845** (closed): crbn: hibernate an idle stack and its dev servers, wake on the next request (@sidwebworks)
- **PR #1844** (2026-10-05): crbn: lighter default stack, crbn prune, and CLI robustness fixes (@sidwebworks)
- **PR #1843** (2026-10-05): Client query cache, realtime over broadcast, and faster detail pages (@sidwebworks)
- **PR #1841** (2026-10-04): Assembler tracing (OTLP), and thumbnails drawn with the viewer's camera (@sidwebworks)
- **PR #1840** (closed): feat(assembler): OpenTelemetry traces over OTLP (@sidwebworks)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
