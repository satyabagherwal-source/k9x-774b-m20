# Forensic Learning Record (Deep Inspection): chrisryugj/korean-law-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrisryugj-korean-law-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:45:31.337Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisryugj/korean-law-mcp`
- **Description**: 법제처 국가법령정보를 LLM에서 바로 조회하는 MCP 서버. 법령·판례·조례 검색과 인용 검증 | MCP server for Korean law — search statutes, precedents, and ordinances, and verify citations
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2617 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/verify-annex-runtime.mjs`
```
import { parseAnnexFile } from "../build/lib/annex-file-parser.js"

function minimalPdf(text) {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${text}) Tj\nET\n`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  const bytes = new TextEncoder().encode(pdf)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

const result = await parseAnnexFile(minimalPdf("Annex runtime smoke test"))
if (!result.success || result.fileType !== "pdf" || !result.markdown?.includes("Annex runtime smoke test")) {
  throw new Error(`Annex runtime smoke test failed: ${JSON.stringify(result)}`)
}

console.log("annex runtime verified without optional dependencies")

```

### Core Architecture Module: `scripts/verify-package.mjs`
```
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const buildDir = resolve(root, "build")
const sourceDir = resolve(root, "src")
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function walk(directory) {
  const entries = []
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) entries.push(...walk(path))
    else entries.push(path)
  }
  return entries
}

function sourcePathForBuildFile(buildFile) {
  const relativeBuildPath = relative(buildDir, buildFile)
  if (relativeBuildPath.endsWith(".d.ts")) {
    return resolve(sourceDir, relativeBuildPath.slice(0, -".d.ts".length) + ".ts")
  }
  if (relativeBuildPath.endsWith(".js")) {
    return resolve(sourceDir, relativeBuildPath.slice(0, -".js".length) + ".ts")
  }
  return undefined
}

function assertPathInPackage(path, label) {
  const resolved = resolve(root, path)
  assert(resolved === root || resolved.startsWith(`${root}${sep}`), `${label} resolves outside the package.`)
  assert(existsSync(resolved), `${label} is missing from the clean build: ${path}`)
}

function verifyExportTargets(value, label = "exports") {
  if (typeof value === "string") {
    if (value.includes("*")) {
      const prefix = value.slice(0, value.indexOf("*"))
      assertPathInPackage(prefix, label)
    } else {
      assertPathInPackage(value, label)
    }
    return
  }
  if (value && typeof value === "object") {
    for (const [key, target] of Object.entries(value)) verifyExportTargets(target, `${label}.${key}`)
  }
}

function packedFiles() {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${result.stderr || result.stdout}`)
  }
  const output = result.stdout.trim()
  const start = output.indexOf("[")
  assert(start >= 0, "npm pack --dry-run did not return JSON.")
  const pack = JSON.parse(output.slice(start))
  assert(Array.isArray(pack) && pack.length === 1 && Array.isArray(pack[0].files), "npm pack --dry-run returned an unexpected file list.")
  return pack[0].files.map(file => file.path)
}

export function verifyPackageArtifacts() {
  assert(existsSync(buildDir), "build/ is missing. Run npm run build before verification.")

  for (const buildFile of walk(buildDir)) {
    const sourceFile = sourcePathForBuildFile(buildFile)
    if (sourceFile) {
      assert(existsSync(sourceFile), `Stale build output has no source module: ${relative(root, buildFile)}`)
    }
  }

  assertPathInPackage(packageJson.main, "main")
  assertPathInPackage(packageJson.types, "types")
  for (const [name, target] of Object.entries(packageJson.bin ?? {})) {
    assertPathInPackage(target, `bin.${name}`)
  }
  verifyExportTargets(packageJson.exports)

  const allowedTopLevel = new Set(["README.md", "LICENSE", "NOTICE", "package.json"])
  const files = packedFiles()
  for (const file of files) {
    assert(file.startsWith("build/") || allowedTopLevel.has(file), `Unexpected packed artifact: ${file}`)
    assert(!file.includes("sse-server"), `Stale server artifact would be published: ${file}`)
  }

  console.log(`package artifacts verified (${files.length} packed files)`)
}

verifyPackageArtifacts()

```

### Core Architecture Module: `src/cli.ts`
```
#!/usr/bin/env node

/**
 * Korean Law CLI v2.0
 * 자연어 한 줄로 모든 법령을 조회하는 프로덕션급 CLI
 *
 * Usage:
 *   korean-law "민법 제1조"                    # 자연어 → 자동 라우팅
 *   korean-law "음주운전 처벌 기준"             # 종합 리서치 자동 실행
 *   korean-law "관세법 개정 이력"               # 개정추적 체인 자동 실행
 *   korean-law search_law --query "민법"       # 직접 도구 호출 (기존 방식)
 *   korean-law list                            # 도구 목록
 *   korean-law interactive                     # 대화형 모드
 */

import { Command } from "commander"
import { z } from "zod"
import * as readline from "readline"
import { LawApiClient } from "./lib/api-client.js"
import { allTools } from "./tool-registry.js"
import { explainRoute } from "./lib/route-explain.js"
import { VERSION } from "./version.js"
import {
  fmt, printBanner, formatOutput,
  printInteractiveHelp, printToolList, getCategory,
  extractOptionsFromSchema, coerceValue,
  type CliOption,
} from "./lib/cli-format.js"
import {
  getApiClient, executeTool,
  executeNaturalQuery, executeNaturalQueryJson,
} from "./lib/cli-executor.js"

// ────────────────────────────────────────
// Interactive REPL Mode
// ────────────────────────────────────────

async function runInteractive(): Promise<void> {
  const apiClient = getApiClient()

  printBanner()
  console.log(fmt.green("  대화형 모드 시작"))
  console.log(fmt.dim("  자연어로 법령을 검색하세요. 'exit'로 종료합니다."))
  console.log()
  console.log(fmt.dim("  예시:"))
  console.log(fmt.dim('    > 민법 제1조'))
  console.log(fmt.dim('    > 음주운전 처벌 기준'))
  console.log(fmt.dim('    > 관세법 3단비교'))
  console.log(fmt.dim('    > 건축허가 절차 수수료'))
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: fmt.cyan("법령> "),
    historySize: 100,
  })

  const history: string[] = []
  let executing = false // 레이스 컨디션 방지

  rl.prompt()

  rl.on("line", async (line: string) => {
    const input = line.trim()

    if (!input) {
      rl.prompt()
      return
    }

    // 실행 중이면 무시
    if (executing) {
      console.log(fmt.dim("  (이전 쿼리 실행 중...)"))
      return
    }

    // 특수 명령어 (동기 처리)
    if (input === "exit" || input === "quit" || input === "q") {
      console.log(fmt.dim("\n종료합니다."))
      rl.close()
      return
    }

    if (input === "help" || input === "?") {
      printInteractiveHelp()
      rl.prompt()
      return
    }

    if (input === "history") {
      console.log(fmt.bold("\n검색 이력:"))
      history.forEach((h, i) => console.log(fmt.dim(`  ${i + 1}. ${h}`)))
      console.log()
      rl.prompt()
      return
    }

    if (input === "tools" || input === "list") {
      printToolList()
      rl.prompt()
      return
    }

    if (input.startsWith("explain ")) {
      const q = input.slice(8).trim()
      console.log(fmt.dim(explainRoute(q)))
      rl.prompt()
      return
    }

    // 비동기 실행 (입력 일시 중지)
    executing = true
    rl.pause()

    // 직접 도구 호출: @tool_name {...params}
    if (input.startsWith("@")) {
      await handleDirectCall(apiClient, input)
    } else {
      // 자연어 쿼리 실행
      history.push(input)
      console.log()

      try {
        await executeNaturalQuery(apiClient, input, false)
      } catch (error) {
        console.error(fmt.red(`오류: ${error instanceof Error ? error.message : String(error)}`))
      }
    }

    console.log()
    executing = false
    sigintCount = 0
    rl.resume()
    rl.prompt()
  })

  // Ctrl+C: 실행 중이면 중단 알림, 2회 연속 시 강제 종료
  let sigintCount = 0
  rl.on("SIGINT", () => {
    if (executing) {
      sigintCount++
      if (sigintCount >= 2) {
        console.log(fmt.dim("\n강제 종료합니다."))
        process.exit(130)
      }
      console.log(fmt.yellow("\n  (Ctrl+C: 현재 쿼리 완료를 기다립니다. 강제 종료: Ctrl+C x2)"))
    } else {
      console.log(fmt.dim("\n종료합니다."))
      rl.close()
    }
  })

  rl.on("close", () => {
    process.exit(0)
  })
}

async function handleDirectCall(apiClient: LawApiClient, input: string): Promise<void> {
  // @tool_name {"key": "value"} or @tool_name key=value
  const spaceIdx = input.indexOf(" ")
  const toolName = spaceIdx > 0 ? input.slice(1, spaceIdx) : input.slice(1)
  const paramStr = spaceIdx > 0 ? input.slice(spaceIdx + 1).trim() : ""

  let params: Record<string, unknown> = {}
  if (paramStr) {
    try {
      params = JSON.parse(paramStr)
    } catch {
      // key=value 형식 시도
      for (const pair of paramStr.split(/\s+/)) {
        const eqIdx = pair.indexOf("=")
        if (eqIdx > 0) {
          params[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1).replace(/^["']|["']$/g, "")
        }
      }
    }
  }

  const result = await executeTool(apiClient, toolName, params)
  console.log(formatOutput(result.content.map(c => c.text).join("\n")))
}

// ────────────────────────────────────────
// Program Setup
// ────────────────────────────────────────

function createProgram(): Command {
  const program = new Command()
    .name("korean-law")
    .description("한국 법령 검색 CLI - 자연어 한 줄로 모든 법령 조회")
    .version(VERSION)

  // ── 자연어 쿼리 (기본 명령) ──
  program
    .command("query <question...>")
    .alias("q")
    .description("자연어로 법령 조회 (예: korean-law query 민법 제1조)")
    .option("-v, --verbose", "라우팅 상세 정보 출력")
    .option("--json", "JSON 형식으로 출력")
    .action(async (words: string[], opts: { verbose?: boolean; json?: boolean }) => {
      const apiClient = getApiClient()
      const query = words.join(" ")

      if (opts.json) {
        await executeNaturalQueryJson(apiClient, query)
        return
      }

      await executeNaturalQuery(apiClient, query, opts.verbose || false)
    })

  // ── 대화형 모드 ──
  program
    .command("interactive")
    .alias("i")
    .description("대화형 법령 검색 모드 (REPL)")
    .action(async () => {
      await runInteractive()
    })

  // ── explain (라우팅 경로 확인) ──
  program
    .command("explain <question...>")
    .description("자연어 질의의 라우팅 경로 확인 (실행하지 않음)")
    .action((words: string[]) => {
      const query = words.join(" ")
      console.log(explainRoute(query))
    })

  // ── list 명령 ──
  program
    .command("list")
    .alias("ls")
    .description("사용 가능한 도구 목록")
    .option("-c, --category <category>", "카테고리 필터 (예: 판례, 법령, 비교)")
    .option("--json", "JSON 형식으로 출력")
    .action((opts: { category?: string; json?: boolean }) => {
      let tools = allTools

      if (opts.category) {
        tools = tools.filter(t =>
          getCategory(t).includes(opts.category!)
        )
      }

      if (opts.json) {
        const data = tools.map(t => ({
          name: t.name,
          category: getCategory(t),
          description: t.description
        }))
        console.log(JSON.stringify(data, null, 2))
        return
      }

      printBanner()
      printToolList()
      console.log(fmt.dim("  사용법: korean-law <도구명> [옵션]"))
      console.log(fmt.dim("  자연어: korean-law query \"민법 제1조\""))
      console.log(fmt.dim("  대화형: korean-law interactive"))
      console.log()
    })

  // ── help <tool> 명령 ──
  program
    .command("help <tool-name>")
    .description("도구 상세 도움말")
    .action((toolName: string) => {
      const tool = allTools.find(t => t.name === toolName)
      if (!tool) {
        console.error(fmt.red(`알 수 없는 도구: ${toolName}`))
        console.error(fmt.dim(`'korean-law list'로 사용 가능한 도구를 확인하세요.`))
        process.exit(1)
      }

      const options = extractOptionsFromSchema(tool.schema)

      console.log()
      console.log(fmt.bold(tool.name))
      console.log("─".repeat(tool.name.length))
      console.log(tool.description)
      console.log()

      if (options.length > 0) {
        console.log(fmt.bold("파라미터:"))
        for (const opt of options) {
          const reqLabel = opt.required ? fmt.red("(필수)") : fmt.dim("(선택)")
          const defLabel = opt.defaultValue !== undefined ? fmt.dim(` [기본값: ${opt.defaultValue}]`) : ""
          console.log(`  --${fmt.cyan(opt.name.padEnd(20))} ${reqLabel} ${opt.description}${defLabel}`)
        }
        console.log()
      }

      const example = options
        .filter(o => o.required && o.name !== "apiKey")
        .
```

### Core Architecture Module: `src/index.ts`
```
#!/usr/bin/env node

/**
 * Korean Law MCP Server
 * 국가법령정보센터 API 기반 MCP 서버
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js"
import { LawApiClient } from "./lib/api-client.js"
import { registerTools } from "./tool-registry.js"
import { startHTTPServer } from "./server/http-server.js"
import { parseHttpPort } from "./server/http-config.js"
import { readExecutionLimits, type ExecutionLimits } from "./lib/execution-limits.js"
import { VERSION } from "./version.js"

// API 클라이언트 초기화 (LAW_OC 또는 KOREAN_LAW_API_KEY 지원)
const LAW_OC = process.env.LAW_OC || process.env.KOREAN_LAW_API_KEY || ""
const apiClient = new LawApiClient({ apiKey: LAW_OC })

// Server 는 옵션이 없으면 인스턴스마다 Ajv 검증기를 새로 만든다(elicitation 전용, 이 서버는
// 안 쓴다). HTTP 모드는 POST 마다 Server 를 만드므로 하나를 공유한다: createServer 37.7µs →
// 1.3µs, 요청당 garbage 약 18KB 감소(2026-09-23 리뷰 A9 실측).
const jsonSchemaValidator = new AjvJsonSchemaValidator()

// MCP 서버 팩토리 (HTTP 모드: 세션마다 새 인스턴스 필요)
function createServer(executionLimits: ExecutionLimits = readExecutionLimits()): Server {
  const s = new Server(
    { name: "korean-law", version: VERSION },
    { capabilities: { tools: {} }, jsonSchemaValidator }
  )
  registerTools(s, apiClient, executionLimits)
  return s
}

// 서버 시작
async function main() {
  const args = process.argv.slice(2)

  // setup 서브커맨드: npx korean-law-mcp setup
  if (args[0] === "setup") {
    const { runSetup } = await import("./setup.js")
    await runSetup()
    return
  }

  const modeIndex = args.indexOf("--mode")
  const mode = modeIndex !== -1 ? args[modeIndex + 1] : "stdio"
  const portIndex = args.indexOf("--port")
  const port = parseHttpPort(portIndex !== -1 ? args[portIndex + 1] : undefined)

  if (mode === "http" || mode === "sse") {
    await startHTTPServer(createServer, port)
  } else {
    // STDIO 모드
    // stdout 오염 방지: MCP JSON-RPC 프로토콜 보호
    const stderrWrite = (...args: unknown[]) =>
      process.stderr.write(args.map(String).join(" ") + "\n")
    console.log = console.warn = console.info = console.debug = stderrWrite
    const server = createServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
  }
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})

```

### Core Architecture Module: `src/lib/abolished-laws.ts`
```
/**
 * 폐지 법령·행정규칙 감지 — search_law / search_admin_rule 보조.
 *
 * 폐지된 법령은 현행(target=law) 검색에, 폐지된 행정규칙은 admrul 기본(nw=1)
 * 검색에 잡히지 않아 LLM이 "존재하지 않는 규정"으로 오판한다
 * (「월별납부제도 운영에 관한 고시」 사례 — 2024-12-11 폐지,
 * 「징수업무 처리에 관한 고시」로 통·폐합됐는데 "검색 결과 없음"으로 안내).
 * 법령은 eflaw(연혁 포함), 행정규칙은 nw=2 보조검색으로 폐지 이력을 찾아
 * 폐지 사실·폐지사유·후속(통합) 규정으로 안내한다.
 */

import type { LawApiClient } from "./api-client.js"
import { lawCache } from "./cache.js"
import { extractTag } from "./xml-parser.js"
import { normalizeAliasKey } from "./search-normalizer.js"
import { rethrowIfFatal } from "./fatal-errors.js"

const fmtDate = (d: string) => (d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d)

/** 법제처 LIKE 검색이 무관 목록을 반환할 때가 있어 이름-쿼리 포함관계로 걸러낸다 */
function isRelated(name: string, query: string): boolean {
  const nk = normalizeAliasKey(name)
  const qk = normalizeAliasKey(query)
  if (!nk || !qk) return false
  return nk.includes(qk) || qk.includes(nk)
}

// ========== 법령 (target=eflaw) ==========

export interface AbolishedLaw {
  name: string
  lawId: string
  mst: string
  effDate: string // 폐지 시행일자
  revisionType: string // "폐지" | "타법폐지"
  lawType: string
}

/** eflaw 검색 XML에서 법령ID별 최신 이력을 골라 폐지 확정된 것만 추출 */
export function parseAbolishedLawsXml(xmlText: string, query: string): AbolishedLaw[] {
  interface Rec { name: string; lawId: string; mst: string; effDate: string; revisionType: string; lawType: string }
  const latestById = new Map<string, Rec>()
  const lawRegex = /<law[^>]*>([\s\S]*?)<\/law>/g
  let m
  while ((m = lawRegex.exec(xmlText)) !== null) {
    const c = m[1]
    const lawId = extractTag(c, "법령ID")
    if (!lawId) continue
    const rec: Rec = {
      name: extractTag(c, "법령명한글"),
      lawId,
      mst: extractTag(c, "법령일련번호"),
      effDate: extractTag(c, "시행일자"),
      revisionType: extractTag(c, "제개정구분명"),
      lawType: extractTag(c, "법령구분명"),
    }
    const prev = latestById.get(lawId)
    if (!prev || rec.effDate > prev.effDate) latestById.set(lawId, rec)
  }
  // 최신 이력이 폐지·타법폐지인 법령만 — 현행이 살아있는 법령은 여기서 자연 탈락
  return [...latestById.values()]
    .filter((r) => (r.revisionType === "폐지" || r.revisionType === "타법폐지") && isRelated(r.name, query))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
}

/** 폐지 법령 조회 — 보조 정보이므로 실패는 전파하지 않고 빈 배열 */
export async function findAbolishedLaws(
  apiClient: LawApiClient,
  query: string,
  apiKey?: string
): Promise<AbolishedLaw[]> {
  const cacheKey = `abolished-law:${query.toLowerCase().trim()}`
  const cached = lawCache.get<AbolishedLaw[]>(cacheKey)
  if (cached) return cached
  try {
    const xml = await apiClient.searchLaw(query, apiKey, 50, "eflaw")
    const parsed = parseAbolishedLawsXml(xml, query)
    lawCache.set(cacheKey, parsed, 60 * 60 * 1000)
    return parsed
  } catch (error) {
    // 예산 소진·취소까지 "폐지 이력 없음"으로 삼키지 않는다(2026-09-23 리뷰)
    rethrowIfFatal(error)
    return []
  }
}

export function buildAbolishedLawNotes(query: string, abolished: AbolishedLaw[]): string {
  if (abolished.length === 0) return ""
  const lines = [`[폐지] '${query}' — 현행 법령 0건. 폐지된 법령이 확인됩니다:`, ""]
  abolished.slice(0, 5).forEach((a, i) => {
    lines.push(`${i + 1}. ${a.name} [${a.lawType || "법령"}] — ${a.revisionType}, 최종 시행 ${fmtDate(a.effDate)} (MST ${a.mst})`)
  })
  const first = abolished[0]
  lines.push("")
  lines.push(`💡 폐지 경위·대체 법령은 get_law_text(mst="${first.mst}", efYd="${first.effDate}")의 부칙·개정문에서 확인하세요 (타법폐지면 부칙 표제에 폐지시킨 법률명이 나옵니다).`)
  lines.push("⚠️ 폐지된 법령을 현행 기준으로 인용하지 마세요. 답변에는 폐지 사실을 명시하고, 해당 제도의 현행 근거는 대체 법령명으로 재검색해 확인하세요.")
  return lines.join("\n") + "\n"
}

// ========== 행정규칙 (target=admrul, nw=2) ==========

interface AdmRuleHistoryHit {
  name: string
  seq: string // 행정규칙일련번호 (get_admin_rule의 id)
  ruleId: string // 행정규칙ID — 개명을 넘어 유지되는 그룹핑 키
  promDate: string // 발령일자
  revisionType: string // 제개정구분명
  statusCode: string // 현행연혁구분
  ruleType: string
  orgName: string
}

export function parseAdmrulHistoryXml(xmlText: string): AdmRuleHistoryHit[] {
  const out: AdmRuleHistoryHit[] = []
  const regex = /<admrul[^>]*>([\s\S]*?)<\/admrul>/g
  let m
  while ((m = regex.exec(xmlText)) !== null) {
    const c = m[1]
    out.push({
      name: extractTag(c, "행정규칙명"),
      seq: extractTag(c, "행정규칙일련번호"),
      ruleId: extractTag(c, "행정규칙ID"),
      promDate: extractTag(c, "발령일자"),
      revisionType: extractTag(c, "제개정구분명"),
      statusCode: extractTag(c, "현행연혁구분"),
      ruleType: extractTag(c, "행정규칙종류"),
      orgName: extractTag(c, "소관부처명"),
    })
  }
  return out
}

/** 폐지 레코드 본문 XML에서 제개정이유(폐지사유) 추출 */
export function extractAbolitionReason(xmlText: string): string {
  const block = xmlText.match(/<제개정이유>([\s\S]*?)<\/제개정이유>/)?.[1] || ""
  const cdata = [...block.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1].trimEnd())
  const text = cdata.filter((l) => l.trim().length > 0).join("\n").trim()
  return text.length > 700 ? text.slice(0, 700) + "…" : text
}

/**
 * 폐지사유 문장에서 후속(통합) 규정명 추출.
 * "…을 「징수업무 처리에 관한 고시」로 통ㆍ폐합하여…" 패턴 — 통합·이관·흡수·대체 앞의 「」명.
 */
export function extractSuccessorNames(reason: string, excludeNames: string[]): string[] {
  const exclude = new Set(excludeNames.map(normalizeAliasKey))
  const out: string[] = []
  const regex = /「([^」]{2,60})」\s*(?:으로|로|에)\s*(?:통\s*[ㆍ·]?\s*폐합|통합|이관|흡수|대체)/g
  let m
  while ((m = regex.exec(reason)) !== null) {
    const name = m[1].trim()
    if (exclude.has(normalizeAliasKey(name))) continue
    if (!out.includes(name)) out.push(name)
  }
  return out
}

/**
 * 현행 0건인 행정규칙 쿼리에서 폐지·제명변경 이력을 찾아 안내문 생성.
 * 해당 없으면 null (상위에서 기존 noResultHint로 폴백).
 */
export async function detectAbolishedAdminRule(
  apiClient: LawApiClient,
  query: string,
  apiKey?: string
): Promise<string | null> {
  const cacheKey = `abolished-admrul:${query.toLowerCase().trim()}`
  const cached = lawCache.get<string>(cacheKey)
  if (cached !== null) return cached || null // "" = 해당없음 네거티브 캐시
  let result: string | null = null
  try {
    const xml = await apiClient.searchAdminRule({ query, nw: "2", apiKey })
    const hits = parseAdmrulHistoryXml(xml)

    // 행정규칙ID로 그룹핑 (개명을 넘어 동일 규칙 추적), 발령일자 오름차순
    const groups = new Map<string, AdmRuleHistoryHit[]>()
    for (const h of hits) {
      const key = h.ruleId || normalizeAliasKey(h.name)
      if (!key) continue
      const g = groups.get(key) || []
      g.push(h)
      groups.set(key, g)
    }

    for (const g of groups.values()) {
      g.sort((a, b) => (a.promDate < b.promDate ? -1 : 1))
      const latest = g[g.length - 1]
      // 쿼리 연관성: 과거 명칭 포함 어느 버전이든 일치하면 같은 규칙으로 본다
      if (!g.some((h) => isRelated(h.name, query))) continue

      if (latest.revisionType === "폐지") {
        result = await buildAbolishedAdminRuleNote(apiClient, query, g, apiKey)
        break
      }
      // 현행이 살아있는데 현행 검색이 0건이었다면 제명변경(구명칭 검색) 케이스
      if (latest.statusCode === "현행" && !isRelated(latest.name, query)) {
        result =
          `[제명변경] '${query}' — 현행 행정규칙 0건. 같은 규칙이 명칭 변경되어 현행입니다:\n\n` +
          `「${g.find((h) => isRelated(h.name, query))?.name || query}」 → 「${latest.name}」 (${latest.ruleType}, ${latest.orgName}, 발령 ${fmtDate(latest.promDate)})\n\n` +
          `💡 get_admin_rule(id="${latest.seq}") 또는 search_admin_rule("${latest.name}")로 현행본을 조회하세요.\n`
        break
      }
    }
  } catch {
    return null
  }
  lawCache.set(cacheKey, result || "", 60 * 60 * 1000)
  return result
}

async function buildAbolishedAdminRuleNote(
  apiClient: LawApiClient,
  query: string,
  history: AdmRuleHistoryHit[],
  apiKey?: string
): Promise<string> {
  const latest = history[history.length - 1] // 폐지 레코드
  const prev = history.length >= 2 ? history[history.length - 2] : null

  const lines = [
    `[폐지] '${query}' — 현행 행정규칙 0건. 폐지된 행정규칙입니다:`,
    "",
    `「${latest.name}」 (${latest.ruleType}, ${latest.orgName}) — ${fmtDate(latest.promDate)} 폐지`,
  ]
  if (prev) {
    lines.push(`   - 폐지 직전 버전: 행정규칙일련번호 ${prev.seq} (발령 ${fmtDate(prev.promDate)}) — 폐지 전 본문이 필요하면 get_admin_rule(id="${prev.seq}")`)
  }

  // 폐지 레코드 본문에서 폐지사유·후속
```

### Core Architecture Module: `src/lib/admin-rule-articles.ts`
```
/**
 * 행정규칙 전문 텍스트 → 조문 배열 파서 (#admrul 부분 조회)
 *
 * 법제처 admrul 상세는 법령(target=law)과 달리 JO 파라미터가 없고
 * 전문이 <조문내용> 통짜 텍스트(외국환거래규정 기준 18.8만 자)로만 온다 — 실측 확정.
 * 따라서 조문 단위 조회는 서버가 전문을 파싱해서 제공해야 한다.
 *
 * 조문 번호 체계 2종을 모두 다룬다:
 *  - 하이픈형: 제9-5조, 제2-6조의2  (외국환거래규정 등 — 장 번호가 조 번호 앞자리)
 *  - 일반형:   제10조, 제10조의2
 */

export interface AdminRuleArticle {
  /** 정규화 키: "9-5" | "9-5의2" | "10" | "10의2" */
  key: string
  /** 비교용 튜플 (main, branch, ui) — 단조증가 검사에 사용 */
  ord: [number, number, number]
  /** 헤더 라인 원문 (제목 포함) */
  label: string
  /** 헤더 포함 본문 라인들 */
  lines: string[]
  /** 소속 장 번호 (없으면 0) */
  chapter: number
}

export interface AdminRuleChapter {
  num: number
  /** 장 헤더 라인 원문 */
  title: string
}

export interface ParsedAdminRule {
  articles: AdminRuleArticle[]
  chapters: AdminRuleChapter[]
  /** 첫 조문 이전의 서문 라인들 */
  preamble: string[]
}

/**
 * 조문 헤더 판정 (라인 시작 앵커).
 * 허용 꼬리: "(", "<", 전각 괄호, 라인 끝, 공백, 원문자 항 번호.
 * "…제9-5조제3항의 규정에 의한…" 같은 본문 중간 참조는 ^ 앵커 + 단조증가 검사로 걸러진다.
 */
const HEADER_RE = /^제(\d+)(?:-(\d+))?조(?:의(\d+))?(?=$|[\s(（<①-㊿])/u
const CHAPTER_RE = /^제(\d+)장(?=$|[\s(（])/u

function toKey(main: number, branch: number, ui: number): string {
  return `${main}${branch ? `-${branch}` : ""}${ui ? `의${ui}` : ""}`
}

function ordCompare(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * jo 입력 정규화 → 후보 키 목록 (우선순위 순).
 * "제9-5조"·"9-5" → ["9-5", "9의5"] / "제9-5조의2"·"9-5-2" → ["9-5의2"]
 * "제10조"·"10" → ["10"] / "제10조의2"·"10의2"·"10-2" → ["10의2"] 또는 ["10-2","10의2"]
 * 하이픈형인지 일반형인지 입력만으로 확정할 수 없는 경우 두 해석을 모두 후보로 돌려주고,
 * 호출부가 실제 파싱된 조문 키와 대조해 먼저 맞는 것을 쓴다.
 */
export function normalizeAdminJo(input: string): string[] {
  const clean = String(input)
    .replace(/[‐‑‒–—―﹘﹣－]/gu, "-")
    .replace(/\s+/gu, "")
    .replace(/^제/u, "")
    .replace(/제?\d+[항호목].*$/u, "") // "제9-5조제3항" 꼬리 허용
  const m = /^(\d+)(?:-(\d+))?조?(?:의(\d+)|-(\d+))?$/u.exec(clean)
  if (!m) return []
  const main = Number(m[1])
  const branch = m[2] ? Number(m[2]) : 0
  const ui = m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : 0
  if (branch && ui) return [toKey(main, branch, ui)]
  if (branch) {
    // "9-5": 하이픈형 조문이 우선, 없으면 일반형 "9조의5"로 해석
    return [toKey(main, branch, 0), toKey(main, 0, branch)]
  }
  if (ui) return [toKey(main, 0, ui)]
  return [toKey(main, 0, 0)]
}

/** "제9장" | "9장" | "9" → 9 (해석 불가면 0) */
export function normalizeChapter(input: string): number {
  const m = /^제?\s*(\d+)\s*장?$/u.exec(String(input).trim())
  return m ? Number(m[1]) : 0
}

/**
 * 전문 라인 스캔 파서.
 * 새 조문 헤더는 직전 조문보다 번호가 커야 한다(단조증가) — 하이픈형은 장 번호가
 * 조 번호 앞자리에 포함되므로 전체 단조증가가 성립하고, 일반형도 마찬가지다.
 * 위배되는 헤더 모양 라인은 본문(인용문 등)으로 취급한다.
 */
export function parseAdminRuleArticles(body: string): ParsedAdminRule {
  const lines = body.split(/\r?\n/u)
  const articles: AdminRuleArticle[] = []
  const chapters: AdminRuleChapter[] = []
  const preamble: string[] = []
  let cur: AdminRuleArticle | null = null
  let curChapter = 0
  let lastOrd: [number, number, number] | null = null
  // 조문 사이에 끼는 절 헤더 등 — 다음 조문 앞에 붙여 부분 조회에서 유실되지 않게 한다
  let pending: string[] = []

  for (const rawLine of lines) {
    // 2026-09-23 리뷰 C7: `/\s+$/u` 는 라인 안 공백 덩어리에서 제곱이다(10만 자 13초).
    // trimEnd 는 같은 공백 집합을 선형으로 지운다.
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    // 헤더 판정은 원 라인 기준(^ 앵커) — 들여쓰기된 라인은 본문이다.
    // 실측(외국환거래규정 1,943라인)상 조문·장 헤더는 전부 들여쓰기 0이고,
    // trim 후 판정하면 "  제9-9조 제1항…" 같은 본문 참조가 헤더로 오인될 수 있다.
    const ch = CHAPTER_RE.exec(line)
    if (ch) {
      curChapter = Number(ch[1])
      chapters.push({ num: curChapter, title: trimmed })
      cur = null // 장 헤더는 어느 조문에도 속하지 않는다
      // 장마다 조 번호가 1부터 다시 시작하는 체계(제2장 제1조 등)에서 조문이 통째로
      // 유실되지 않도록 단조증가 기준을 장 단위로 리셋한다
      lastOrd = null
      continue
    }

    const h = HEADER_RE.exec(line)
    if (h) {
      const ord: [number, number, number] = [Number(h[1]), h[2] ? Number(h[2]) : 0, h[3] ? Number(h[3]) : 0]
      if (lastOrd === null || ordCompare(ord, lastOrd) > 0) {
        cur = {
          key: toKey(ord[0], ord[1], ord[2]),
          ord,
          label: trimmed,
          lines: pending.length ? [...pending, line] : [line],
          chapter: curChapter,
        }
        pending = []
        // 하이픈형에서 장 헤더가 생략된 경우 조 번호 앞자리를 장으로 삼는다
        if (!curChapter && ord[1] > 0) cur.chapter = ord[0]
        articles.push(cur)
        lastOrd = ord
        continue
      }
      // 번호가 역행 → 본문 중간 인용으로 간주하고 현재 조문에 붙인다
    }

    if (cur) cur.lines.push(line)
    else if (!trimmed) continue
    else if (articles.length) pending.push(line) // 첫 조문 이후의 떠도는 라인 = 절 헤더 등
    else preamble.push(line)
  }

  if (pending.length && articles.length) articles[articles.length - 1].lines.push(...pending)

  return { articles, chapters, preamble }
}

/** 후보 키 목록에서 실제 존재하는 첫 조문을 찾는다 */
export function findArticle(parsed: ParsedAdminRule, joInput: string): AdminRuleArticle | null {
  const candidates = normalizeAdminJo(joInput)
  for (const key of candidates) {
    const hit = parsed.articles.find((a) => a.key === key)
    if (hit) return hit
  }
  return null
}

```

### Core Architecture Module: `src/lib/admin-rule-history.ts`
```
/**
 * 행정규칙 발령 연혁 — 행정규칙ID 로 묶은 버전 목록과 기준일 시행 버전 (v4.15.0)
 *
 * 고시·훈령·예규는 개정마다 행정규칙일련번호가 새로 붙고, 행정규칙ID 가 계보를 잇는다.
 * 실측(2026-09-28): 「스프링클러설비의 화재안전기준(NFSC 103)」 2004년 제정본부터 2022.12.1. 전부개정
 * 「…화재안전성능기준(NFPC 103)」까지 21개 버전이 행정규칙ID 35312 하나다. 그런데 법령의 eflaw LID 와 달리
 * admrul 검색은 ID 필터(LID·ID·admRulId)를 조용히 무시하고 전 목록(약 15만 건)을 준다. 그래서 이름 검색
 * (nw=2 = 연혁+현행)으로 받은 뒤 ID 로 묶는다. 검색은 개명 전 이름까지 함께 맞춰 준다(NFPC 로 찾으면 NFSC 행 포함).
 */
import type { LawApiClient } from "./api-client.js"
import { extractTag } from "./xml-parser.js"
import { INTERPUNCT_CHARS } from "./law-search.js"

export interface AdminRuleVersion {
  /** 행정규칙일련번호 — get_admin_rule 의 id */
  serial: string
  /** 행정규칙ID — 개정·개명을 가로지르는 계보 키 */
  ruleId: string
  name: string
  kind: string
  issuedYd: string
  issuedNo: string
  efYd: string
  rrCls: string
  org: string
  isCurrent: boolean
}

/** 업스트림 display 상한 */
const PAGE_SIZE = 100
/** 연혁 검색 안전 상한 — "화재안전" 처럼 넓은 검색어는 600건에 이른다 */
const MAX_PAGES = 3

export function parseAdminRuleRows(xml: string): AdminRuleVersion[] {
  const out: AdminRuleVersion[] = []
  for (const m of xml.matchAll(/<admrul[^>]*>([\s\S]*?)<\/admrul>/g)) {
    const c = m[1]
    const serial = extractTag(c, "행정규칙일련번호")
    const ruleId = extractTag(c, "행정규칙ID")
    if (!serial || !ruleId) continue
    out.push({
      serial,
      ruleId,
      name: extractTag(c, "행정규칙명"),
      kind: extractTag(c, "행정규칙종류"),
      issuedYd: extractTag(c, "발령일자"),
      issuedNo: extractTag(c, "발령번호"),
      efYd: extractTag(c, "시행일자"),
      rrCls: extractTag(c, "제개정구분명"),
      org: extractTag(c, "소관부처명"),
      isCurrent: extractTag(c, "현행연혁구분") === "현행",
    })
  }
  return out
}

/** 시행일 → 발령일 내림차순 */
const byEffectiveDesc = (a: AdminRuleVersion, b: AdminRuleVersion) =>
  (b.efYd || b.issuedYd).localeCompare(a.efYd || a.issuedYd) || b.issuedYd.localeCompare(a.issuedYd)

/** 이름 검색(nw=2)으로 연혁+현행을 받아 행정규칙ID 별로 묶는다. 각 묶음은 시행일 내림차순 */
export async function fetchAdminRuleHistory(
  apiClient: LawApiClient,
  query: string,
  apiKey?: string,
): Promise<{ groups: Map<string, AdminRuleVersion[]>, totalCount: number, truncated: boolean }> {
  const first = await apiClient.searchAdminRule({ query, nw: "2", display: PAGE_SIZE, apiKey })
  const totalCount = parseInt(extractTag(first, "totalCnt") || "0", 10) || 0
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(totalCount / PAGE_SIZE)))
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => apiClient.searchAdminRule({ query, nw: "2", display: PAGE_SIZE, page: i + 2, apiKey })),
  )
  const groups = new Map<string, AdminRuleVersion[]>()
  const seen = new Set<string>()
  for (const row of [first, ...rest].flatMap(parseAdminRuleRows)) {
    if (seen.has(row.serial)) continue
    seen.add(row.serial)
    const list = groups.get(row.ruleId) ?? []
    list.push(row)
    groups.set(row.ruleId, list)
  }
  for (const list of groups.values()) list.sort(byEffectiveDesc)
  return { groups, totalCount, truncated: pages * PAGE_SIZE < totalCount }
}

const INTERPUNCT_RE = new RegExp(`[${INTERPUNCT_CHARS}]`, "g")
const nameKey = (s: string) => s.replace(/\s+/g, "").replace(INTERPUNCT_RE, "")
/** 이름 끝 괄호 코드("(NFSC 103)")를 뗀 비교 키 */
const baseKey = (s: string) => nameKey(s.replace(/\s*\([^()]*\)\s*$/, ""))
/** 화재안전기준 코드 — NFSC·NFPC 는 같은 계보(성능기준), NFTC 는 2022.12.1. 신설된 별도 계보(기술기준) */
const NF_CODE_RE = /\bNF([SPT])C\s*(\d+[A-Z]?)\b/i

export function nfCode(name: string): { family: "performance" | "technical", code: string } | undefined {
  const m = name.match(NF_CODE_RE)
  if (!m) return undefined
  return { family: m[1].toUpperCase() === "T" ? "technical" : "performance", code: m[2].toUpperCase() }
}

/**
 * 검색어에 해당하는 계보 하나. ① 어느 버전 이름과 완전일치 ② 괄호 코드를 뗀 이름과 일치
 * ③ 화재안전기준 코드(NFSC 103 등) 일치. 여럿이 걸리거나 이름이 안 맞으면 고르지 않는다 — 검색 결과가 한 묶음뿐이어도
 * 이름이 다르면 무관한 규칙일 수 있다(오타 난 법령명에 엉뚱한 고시로 기준일 판단을 내면 안 된다).
 */
export function pickAdminRuleGroup(groups: Map<string, AdminRuleVersion[]>, query: string): AdminRuleVersion[] | undefined {
  const all = [...groups.values()]
  const unique = (hits: AdminRuleVersion[][]) => (hits.length === 1 ? hits[0] : undefined)
  const q = nameKey(query)
  const exact = all.filter(g => g.some(v => nameKey(v.name) === q))
  if (exact.length > 0) return unique(exact)
  const base = all.filter(g => g.some(v => baseKey(v.name) === q))
  if (base.length > 0) return unique(base)
  const wanted = nfCode(query)
  if (wanted) {
    const coded = all.filter(g => g.some(v => {
      const c = nfCode(v.name)
      return c?.code === wanted.code && c.family === wanted.family
    }))
    if (coded.length > 0) return unique(coded)
  }
  return undefined
}

/**
 * 기준일에 시행 중이던 버전. 시행일이 발령 순서와 엇갈리면(2013년 NFSC 103: 2013-18호 발령 6.10.·시행 8.11.,
 * 2013-21호 발령 6.11.·시행 7.12.) 뒤 발령본 본문에 아직 시행 전인 앞 개정이 섞여 있다 — 그 사실을 note 로 알린다.
 */
export function adminVersionAt(
  group: AdminRuleVersion[],
  ymd: string,
): { version?: AdminRuleVersion, note?: string, abolished?: AdminRuleVersion } {
  const version = group.find(v => (v.efYd || v.issuedYd) <= ymd)
  if (!version) return {}
  // 폐지 행은 "시행 중 버전"이 아니다 — 그날 이미 폐지된 규칙이다
  if (/폐지$/.test(version.rrCls)) return { abolished: version }
  const pending = group.find(v => v !== version && v.issuedYd <= version.issuedYd && (v.efYd || v.issuedYd) > ymd)
  const note = pending
    ? `기준일에 아직 시행 전이던 제${pending.issuedNo}호(발령 ${pending.issuedYd}, 시행 ${pending.efYd})가 이 버전보다 먼저 발령돼, 이 버전 본문에 그 개정이 섞여 있을 수 있습니다.`
    : undefined
  return { version, note }
}

```

### Core Architecture Module: `src/lib/admin-rule-views.ts`
```
/**
 * 행정규칙 부분 조회 뷰 (jo · chapter · keyword · page)
 *
 * 우선순위: jo > chapter > keyword > page. 복수 지정 시 상위 하나만 적용하고 응답에 명시.
 * 같은 규칙을 jo → keyword → page 순으로 연속 조회하는 패턴이 일반적이므로
 * 전문 API 응답(XML)을 id 기준 캐시(TTL 6h, LRU 20건)에 보관해 재호출을 막는다.
 */

import { SimpleCache } from "./cache.js"
import { MAX_RESPONSE_SIZE } from "./schemas.js"
import {
  parseAdminRuleArticles, findArticle, normalizeChapter,
  type ParsedAdminRule, type AdminRuleArticle,
} from "./admin-rule-articles.js"

/** 전문 XML 캐시 — 외국환거래규정 기준 응답 ~750KB이므로 상한을 작게 잡는다 */
export const adminRuleXmlCache = new SimpleCache(20)
export const ADMIN_RULE_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export function adminRuleCacheKey(id: string): string {
  return `admrulxml:${id}` // 캐시 키 네임스페이스 분리 (CLAUDE.md Critical Rule 10)
}

export interface PartialParams {
  jo?: string
  context?: number
  chapter?: string
  keyword?: string
  max_results?: number
  page?: number
}

export const PARTIAL_HINT =
  "jo(조문)·chapter(장)·keyword(본문 검색)·page(페이징) 파라미터로 부분 조회할 수 있습니다. 예: jo:\"제9-5조\""

const NO_ARTICLE_MSG =
  "이 행정규칙은 조문 체계가 없습니다(항목식 훈령·지침 등) — keyword 또는 page를 사용하세요."

/** 복수 지정 시 상위 하나만 적용 (jo > chapter > keyword > page) */
export function pickPartialMode(p: PartialParams): { mode: "jo" | "chapter" | "keyword" | "page" | null, ignored: string[] } {
  const given: Array<"jo" | "chapter" | "keyword" | "page"> = []
  if (p.jo) given.push("jo")
  if (p.chapter) given.push("chapter")
  if (p.keyword) given.push("keyword")
  if (p.page !== undefined) given.push("page")
  if (given.length === 0) return { mode: null, ignored: [] }
  return { mode: given[0], ignored: given.slice(1) }
}

function renderArticles(items: AdminRuleArticle[]): string {
  return items.map((a) => a.lines.join("\n")).join("\n\n")
}

/**
 * 조문(제N조) 체계가 없는 본문의 절 — 화재안전기술기준(NFTC)식 "2.7.3" 번호 줄에서 끊는다.
 * 번호 줄이 하나도 없으면(항목식 훈령) 빈 줄 문단으로 끊는다. 종전엔 이런 본문에 jo·keyword 가
 * "조문 체계가 없습니다 — keyword 를 쓰세요"를 돌려줘 keyword 요청에 keyword 를 쓰라는 막다른 안내가 됐다.
 */
export function splitSections(body: string): Array<{ num?: string, text: string }> {
  const lines = body.split("\n")
  const numbered = lines.some(l => /^\s*\d+\.\d+(?:\.\d+)*\s/.test(l))
  if (!numbered) {
    return body.split(/\n\s*\n/).map(t => ({ text: t.trim() })).filter(p => p.text)
  }
  const out: Array<{ num?: string, lines: string[] }> = []
  for (const line of lines) {
    const m = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s/)
    if (m || out.length === 0) out.push({ num: m?.[1], lines: [line] })
    else out[out.length - 1].lines.push(line)
  }
  return out.map(s => ({ num: s.num, text: s.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() })).filter(s => s.text)
}

/** 절 번호 조회 — 그 절과 하위 절(2.7 → 2.7.1, 2.7.1.1 …)을 함께 */
function sectionJoView(body: string, jo: string): string | undefined {
  const want = jo.replace(/^제\s*/, "").replace(/\s*(조|절)$/, "").trim()
  if (!/^\d+(?:\.\d+)+$/.test(want)) return undefined
  const sections = splitSections(body).filter(s => s.num === want || s.num?.startsWith(`${want}.`))
  if (sections.length === 0) return `[NOT_FOUND] '${want}' 절을 찾지 못했습니다. keyword 파라미터로 본문을 검색해 보세요.\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
  return sections.map(s => s.text).join("\n\n")
}

function sectionKeywordView(body: string, kw: string, maxResults: number): string {
  const hits = splitSections(body).filter(s => s.text.includes(kw))
  if (hits.length === 0) return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 절이 없습니다.\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
  const cap = Math.max(1, Math.min(maxResults || 10, 30))
  const labels = hits.map(s => s.num).filter(Boolean)
  let text = `'${kw}' 포함 ${hits.length}곳${labels.length ? `: ${labels.join(", ")}` : ""}\n`
  text += hits.length > cap ? `(아래 본문은 상위 ${cap}곳 — 절 번호는 jo:"2.7.3"처럼 조회)\n\n` : "\n"
  return text + hits.slice(0, cap).map(s => s.text.length > 2500 ? `${s.text.slice(0, 2500)}\n   …` : s.text).join("\n\n---\n\n")
}

function joView(parsed: ParsedAdminRule, jo: string, context: number, body = ""): string {
  const hit = findArticle(parsed, jo)
  if (!hit) {
    if (parsed.articles.length === 0) return sectionJoView(body, jo) ?? NO_ARTICLE_MSG
    const range = `${parsed.articles[0].label.split(/[\s(（]/u)[0]} ~ ${parsed.articles[parsed.articles.length - 1].label.split(/[\s(（]/u)[0]}`
    return `[NOT_FOUND] '${jo}'에 해당하는 조문을 찾지 못했습니다. (수록 범위: ${range}, 총 ${parsed.articles.length}개조)\n` +
      "keyword 파라미터로 본문을 검색해 보세요.\n⚠️ LLM은 조문 내용을 추측/생성하지 마세요."
  }
  const idx = parsed.articles.indexOf(hit)
  const n = Math.max(0, Math.min(context || 0, 10))
  const slice = parsed.articles.slice(Math.max(0, idx - n), idx + n + 1)
  const chapterTitle = parsed.chapters.find((c) => c.num === hit.chapter)?.title
  const head = chapterTitle ? `${chapterTitle}\n\n` : ""
  return head + renderArticles(slice)
}

function chapterView(parsed: ParsedAdminRule, chapter: string): string {
  if (parsed.articles.length === 0) return NO_ARTICLE_MSG
  const num = normalizeChapter(chapter)
  if (!num) return `[NOT_FOUND] chapter 값 '${chapter}'을(를) 해석하지 못했습니다. "제9장" 형식으로 지정하세요.`
  const items = parsed.articles.filter((a) => a.chapter === num)
  if (items.length === 0) {
    const avail = [...new Set(parsed.articles.map((a) => a.chapter))].filter(Boolean).join(", ")
    return `[NOT_FOUND] 제${num}장에 속한 조문이 없습니다. (수록 장: ${avail || "구분 없음"})`
  }
  const title = parsed.chapters.find((c) => c.num === num)?.title || `제${num}장`
  let text = `${title}  (조문 ${items.length}개)\n\n` + renderArticles(items)
  if (text.length > MAX_RESPONSE_SIZE) {
    text = `⚠️ 이 장은 ${text.length.toLocaleString()}자로 응답 한도를 넘습니다 — jo 파라미터로 조문 단위로 좁히세요.\n\n` + text
  }
  return text
}

function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults: number, body = ""): string {
  const kw = keyword.trim()
  if (!kw) return "[NOT_FOUND] keyword 가 비어 있습니다 — 검색어를 지정하세요."
  if (parsed.articles.length === 0) return sectionKeywordView(body, kw, maxResults)
  const hits = parsed.articles.filter((a) => a.lines.some((l) => l.includes(kw)))
  if (hits.length === 0) {
    return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 조문이 없습니다. (총 ${parsed.articles.length}개조 검색)\n⚠️ LLM은 조문 내용을 추측/생성하지 마세요.`
  }
  const cap = Math.max(1, Math.min(maxResults || 10, 30))
  const shown = hits.slice(0, cap)
  const PER = 2500
  // 본문은 상위 cap개만 싣더라도, 매칭 조문 "목록"은 전부 보여준다 —
  // 뒤쪽 장의 조문이 목록에서도 사라지면 jo로 이어 갈 단서가 없다.
  const allLabels = hits.map((a) => a.label.split(/[\s(（<]/u)[0]).join(", ")
  let text = `'${kw}' 포함 조문 ${hits.length}개: ${allLabels}\n`
  text += hits.length > cap ? `(아래 본문은 상위 ${cap}개 — 나머지는 jo 파라미터로 조회, max_results로 조정 가능)\n\n` : "\n"
  for (const a of shown) {
    const joLabel = a.key.includes("의") ? `제${a.key.replace("의", "조의")}` : `제${a.key}조`
    let body = a.lines.join("\n")
    if (body.length > PER) body = body.slice(0, PER) + `\n   … (이 조문 ${body.length.toLocaleString()}자 — jo:"${joLabel}"로 전체 조회)`
    text += `${body}\n\n---\n\n`
  }
  return text.replace(/\n\n---\n\n$/u, "")
}

export interface PageResult { text: string, page: number, totalPages: number }

/** 전문을 라인 경계에서 자른 비중첩 청크로 페이징 */
export function paginateFullText(fullText: string, page: number, chunkSize = 45000): PageResult {
  const boundaries: number[] = [0]
  let pos = 0
  while (pos < fullText.length) {
    let end = Math.min(pos + chunkSize, fullText.length)
    if (end < fullText.length) {
      const nl = fullText.lastIndexOf("\n", end)
      if (nl > pos) end = nl + 1
    }
    boundaries.push(end)
    pos = end
  }
  const totalPages = Math.max(1, boundaries.length - 1)
  const p = Math.max(1, Math.min(Math.trunc(page) || 1, totalPages))
  const text = fullText.slice(boundaries[p - 1] ?? 0, boundaries[p] ?? fullText.length)
  return { text, page: p, totalPages }
}

/** 부분 조회 본문 생성 — 호출부는 규칙명·공포일 헤더를 앞에 붙인다 */
export function buildPartialBody(body: string, fullText: string, params: PartialParams): { label: string, text: string, note?: string } {
  const { mode, ignored } = pickPartialMode(params)
  const note = ignored.length ? `※ 복수 파라미터 중 우선순위에 따라 '${mode}'만 적
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #162** (2026-09-22): **feat(admin-rule): get_admin_rule 부분 조회(jo·chapter·keyword·page) + 신구대조 제·개정이유 폴백**
  *Symptoms*: ## 문제  행정규칙(고시·훈령·예규) 중 전문이 긴 규칙은 `get_admin_rule`로 뒷부분 장을 영원히 읽을 수 없습니다.  재현 (외국환거래규정, 재정경제부고시 제2026-103호, id `2100000285140`): 1. `get_admin_rule {id, jo:"제9-5조"}` → `jo` 무시, 전문을 제1장부터 반환하다 50,000자에서 잘림 (제2장 중반 종료) 2. `compare_admin_rule_old_new {id}` → `[NOT_FOUND] 신구법 대조 데이터가 없습니다.` 단독 응답  원인 (실측 확정): 법제처 admrul 상세는 법령(target=law)과 달리 JO 파라미터가 없고, 전문이 `<조문내용>` **통짜 1개 CDATA**로만 옵니다 — 외국환거래규정 기준 188,804자·1,943라인·조문 208개. 참고로 이 규칙은 `조문형식여부=N`인데도 본문이 조문 체계를 갖고 있어, 이 플래그로 조문 유무를 판단할 수 없습니다.  ## 변경  ### 1. `get_admin_rule` 부분 조회 파라미터 4종 (우선순위 jo > chapter > keyword > page, 복수 지정 시 상위 하나만 적용·응답에 명시)  | 파라미터 | 동작 | |---|---| | `jo` (+`context`) | 지정 조문 1개(±n개 조문) — `"제9-5조"` `"9-5"` `"제2-6조의2"` `"9-5-2"` 모두 수용 | | `chapter` | 장 전체. 한도 초과 시 "jo로 좁히라" 힌트를 본문 앞에 | | `keyword` (+`max_results`) | 매칭 조문 **전체 번호 목록** + 상위 N개 본문 (뒷장 조문이 목록에서 사라지지 않도록) | | `page` | 라인 경계 비중첩 청킹, `페이지 p/total` 표기 |  - 파서: `^` 앵커 + **원 라인 기준**(들여쓰기 라인은 본문 — 실측상 조문·장 헤더는 전부 들여쓰기 0) + **조문번호 단조증가 검사**로 라인 시작 역행 참조("제1-2조 제1항의 규정은…")의 오분리 방지. 커버 패턴: 괄호 제목 / 공백 괄호(`제2-6조의2 (예금 및 신탁)`) / 조의N / `<삭 제>` 조문 / 하이픈 없는 일반 조문 - 조문 체계 없는 항목식 훈령·지침: `jo`/`chapter` 요청 시 graceful 안내 (에러 아님) - 전문 XML을 id 기준 캐시(TTL 6h, LRU 20건, `admrulxml:` 네임스페이스) — jo → keyword → page 연속 조회 시 Open API 재호출 방지 - 파라미터 없는 전문 조회는 종전 동작 유지 + 잘릴 때 부분 조회 힌트를 본문 **앞**에 삽입 (뒤에 붙이면 잘려 사라짐) - 공포일 표기: 상세 응답의 실제 태그(`발령일자`·`발령번호`) 폴백 추가 (`공포일자`는 없는 경우가 많음 — 실측)  ### 2. `compare_admin_rule_old_new` — 제·개정이유 폴백  행정규칙 신구대조는 API 데이터가 없는 경우가 많습니다. 대조 데이터 0건이
  **Post-Mortem & Fix Analysis**:
  > ## 리뷰 결과 — 머지합니다 ✅  실데이터(외국환거래규정 `2100000285140`, 프로덕션 `mcp.gomdori.app/law` 경유 앞 5만 자·564라인)로 파서를 직접 돌려 확인했습니다.  - 조문 57개·장 2개 분리, **헤더 모양인데 본문으로 흡수된 라인 0건** — `^` 앵커 + 단조증가 검사 조합이 실제 형상에서 오분리를 만들지 않습니다 - `jo`·`chapter`·`keyword` 뷰 모두 의도대로 동작, 타 장 혼입 없음 - 타입체크 통과 / 전체 스위트 81파일·801테스트 통과 (기존 테스트 무수정)  설계 판단(전문 캐시로 jo→keyword→page 연속 조회 흡수, 잘림 힌트를 본문 *앞*에, keyword 목록은 전량·본문만 상위 N개)은 전부 타당합니다.  ### 머지하면서 같이 고친 것 4건  파서에 **조용한 라인 유실** 경로가 있어 머지 후속 커밋으로 수정했습니다.  1. **장 헤더 뒤 라인이 어느 조문에도 담기지 않음** (실측 확정) — 외국환거래규정의 `제1절 외국환은행`이 `제2장` 헤더 바로 뒤에 와서 `preamble`로 빠졌는데, `preamble`은 `joView`/`chapterView`/`keywordView` 어디서도 출력되지 않습니다. 즉 부분 조회에서 절 구분이 사라집니다. → 첫 조문 이후의 떠도는 라인은 `pending`으로 모아 다음 조문 앞에 붙입니다. 수정 후 실데이터 **564/564 라인 커버·preamble 0**. 2. **장마다 조 번호가 1로 리셋되는 체계에서 조문 통째 유실** — `제2장 / 제1조`는 단조증가 위배로 헤더 판정에서 탈락하고, 장 헤더가 `cur = null`을 만든 직후라 본문에도 못 붙어 사라집니다(`제1장 총칙·제1조·제2장 벌칙·제1조` → 조문 1개만 파싱). → 장 헤더에서 `lastOrd`를 리셋합니다. 역행 참조 방어는 장 내부에서 그대로 유효합니다. 3. `paginateFullText("")` → `페이지 1/0` 표기 → `to

- **Issue #161** (2026-09-21): **[재발] #78과 동일 증상 — search_law fetch failed (2026-09-20)**
  *Symptoms*: #78에서 수정된 것과 동일한 증상이 재발한 것으로 보입니다.  발생 시각: 2026-09-20 12:50~12:55 KST  환경: claude.ai 커스텀 커넥터, https://mcp.gomdori.app/law?oc=lj****  증상: search_law("법인세법") 호출 시 매번 [EXTERNAL_API_ERROR] fetch failed. 여러 차례(최소 3회, 약 5분 간격) 재시도했으나 동일하게 실패.  확인한 것: open.law.go.kr 마이페이지에서 본인 OC 키 상태 = 승인/연결 정상. 키 문제는 아닌 것으로 보임.  #78의 원인(리전 egress 문제)이 재발했거나, 별도의 새로운 원인일 수 있어 보고합니다. 살려주시라요
  **Post-Mortem & Fix Analysis**:
  > 보고 감사합니다. 시각까지 적어 주신 덕에 서버 쪽 타임라인과 맞춰 볼 수 있었습니다. 지금은 정상이고(09-21 09:00 KST `search_law("법인세법")` 실호출 200, 0.1초), 아래 정리합니다.  ## 타임라인 (KST, 2026-09-20)  | 시각 | 사건 | |---|---| | 12:50~12:55 | 보고하신 `search_law` fetch failed (당시 프로덕션 머신은 **싱가포르 sin**, 09-11 생성) | | 16:50 | 머신이 **도쿄 nrt** 에 재생성되고 sin 머신은 파괴됨 — 이 레포 배포나 제 로컬 작업이 아니라 출처를 확인 중입니다 | | 이후 | 재발 없음 |  ## 원인 — 확정 못 했습니다  #78 때는 "nrt 에서 law.go.kr 로 TCP 가 조용히 드롭"을 다국가 대조로 잡았는데, 이번엔 **그걸 가를 근거가 남지 않았습니다**. 사용자 쪽에 남은 건 `fetch failed` 다섯 글자와 시각뿐이고, 서버 쪽은 장애 당시 머신이 그날 오후 파괴되면서 로그가 같이 사라졌습니다. 09-21 에 임시 머신을 띄워 실측하니 sin(152.236.20.5)·nrt(154.47.20.2) **양쪽 다 law.go.kr 정상**이라, 지금 시점에서 "리전 문제였다"고도 "법제처 점검이었다"고도 말할 수 없습니다. 5분짜리 일시 장애로 보이지만 단정은 안 하겠습니다.  ## 조치 — v4.13.1 배포 (다음엔 원인이 보이게)  `fetch failed` 는 Node(undici)가 DNS 실패·TCP 리셋·연결 타임아웃·TLS 실패를 전부 같은 메시지로 던지고 진짜 원인(`cause.code`)은 감춘 것입니다. 그걸 버리고 있던 게 이 서버의 잘못이라 고쳤습니다.  - 사용자에게 가는 메시지에 원인 코드와 대상 호스트가 붙습니다 — 예: `fetch failed (ECONNRESET: read ECONNRESET) - www.law.go.kr`, `fetch failed (ENOTFOUND
  > 대단히 감사합니다.

- **Issue #160** (2026-09-08): **v4.12.3: get_law_text returns NOT_FOUND for identifiers returned by search_law**
  *Symptoms*: ## Summary  In an OpenClaw integration, `search_law` successfully returns current law identifiers, but `get_law_text` returns `NOT_FOUND` when called with those exact identifiers. This makes the per-article full-text path unusable even though search works.  ## Reproduction  1. Call `search_law` with `법인세법`. 2. It returns the current law as:    - `lawId`: `001563`    - `mst`: `280349`    - effective date: `2026-07-01` 3. Call `get_law_text` with, for example:  ```json {   "mst": "280349",   "lawId": "001563",   "jo": "제79조",   "efYd": "20260907" } ```  ## Actual result  `[NOT_FOUND] 법령 데이터를 찾을 수 없습니다.`  The same occurred for `법인세법 시행령` (`mst: 283635`, `lawId: 003608`) and `상법` (`mst: 272919`, `lawId: 001702`).  ## Expected result  `get_law_text` should return the current text for the exact `mst`/`lawId` pair supplied by `search_law`, including a requested article.  ## Notes  - `search_law`, `search_decisions`, and `legal_research` otherwise returned results. - The NTS full-text limitation appears separate and is explicitly reported by the MCP as unsupported by the upstream Open API. - The documented Beopmang fallback endpoint (`https://api.beopmang.org/api/v4/law?action=search&q=...`) returned HTTP 503 during this check, so it could not be used to validate the identifiers. - The referenced release is v4.12.3.  If helpful, I can provide the surrounding OpenClaw tool-call responses.
  **Post-Mortem & Fix Analysis**:
  > v4.12.5 로 수정해 프로덕션(`https://mcp.gomdori.app/law`)에 배포했습니다. 자세한 재현 절차 덕분에 빨리 좁혔습니다 — 감사합니다.  **원인은 `efYd` 하나였습니다.** `mst`/`lawId` 는 문제가 없었습니다.  변수를 하나씩 빼서 실측한 결과입니다:  | 요청 | 결과 | |---|---| | `mst=280349` | ✅ 200 | | `mst=280349` + `lawId=001563` | ✅ 200 | | `mst=280349` + `efYd=20260701` (실재 시행일) | ✅ 200 | | `mst=280349` + `lawId=001563` + `efYd=20260907` | ❌ NOT_FOUND |  `efYd` 는 '조회 기준일'이 아니라 **그 법령에 실재하는 시행일**이어야 합니다. 법인세법에는 `20260907` 시행 버전이 없어서 법제처가 빈 응답을 줬습니다. 그런데 파라미터 설명이 `시행일자 (YYYYMMDD 형식)` 뿐이라 오늘 날짜를 넣게 유도했고, 무엇보다 **실패 안내가 `search_law 로 유효한 mst 를 먼저 확인하세요` 라고 엉뚱한 곳을 가리켰습니다.** 법인세법·시행령·상법 세 건을 확인하고도 원인을 못 찾으신 건 안내가 잘못됐기 때문입니다. 이쪽이 진짜 버그였습니다.  **수정** — NOT_FOUND 안내를 `efYd` 유무로 분기했습니다: ``` ⚠️ efYd=20260907 에 해당하는 시행일 버전이 없습니다. efYd 는 '조회 기준일'이 아니라    그 법령에 실재하는 시행일이어야 합니다 — 오늘 날짜를 넣으면 대개 실패합니다. → 현행 본문: get_law_text(mst="280349") 로 efYd 없이 재조회 → 시행예정본: search_law 가 안내한 efYd 를 그대로 사용 mst/lawId 자체는 유효할 수 있습니다. ``` `efYd` 파라미터 설명에도 '조회 기준일이 아니다' 를 명시했습니다.  **조회 성공 경로의 동작은 바꾸지 않았습니다.

- **Issue #159** (2026-09-10): **feat: warn when annex content is image-only and provide source URL (get_admin_rule)**
  *Symptoms*: **Summary (EN)**  `get_admin_rule` for basin-office discharge-limit notices returns annex tables as `<img>` tags only (no text), with no warning. Since auditors check exactly these annex figures, please add an explicit "image-only annex — verify at source: URL" notice, and consider OCR or original-file (PDF/HWP) links long-term.  ---  **배경**: ISO 14001 준수의무 등록부에서 산업단지 별도배출허용기준 확인에 사용했습니다.  **현상 (실측, 2026-08-30)**  `execute_tool(tool_name="get_admin_rule", params={"id": "2100000248042"})` (「(낙동강유역환경청) 수질오염물질의 배출허용기준 중 별도배출허용기준」 고시) 응답:  ``` (단위: ㎎/ℓ) <img id="144740515"></img> <img id="144740517"></img> ... (6개) ```  기준 수치와 **대상 산업단지 목록이 전부 이미지 태그**이고 텍스트는 부칙뿐입니다. 경고가 없어 "본문이 사실상 비어 있다"는 것을 LLM이 놓치기 쉽고, 사업장이 해당 고시 적용 대상인지(어느 산단이 목록에 있는지)를 API로는 판단할 수 없었습니다.  **왜 중요한가**  배출기준치·과태료 세부기준 등 심사원이 실제 확인하는 수치는 대부분 이런 별표에 있습니다. 이미지-only 별표는 이 MCP의 "환각 방지" 설계 목표와 정확히 충돌하는 지점입니다 — 모델이 수치를 추정하고 싶어지는 상황이기 때문입니다.  **제안**  1. 본문이 이미지 위주로 판정되면 응답에 자동 경고 부가:    「⚠️ 별표·수치가 이미지로만 제공되어 텍스트 추출 불가 — 원문에서 직접 확인: (URL)」 2. 장기적으로 별표 이미지 OCR 또는 원문 파일(PDF/HWP) 링크 제공  Reported via real-world usage; happy to provide more repro details. 
  **Post-Mortem & Fix Analysis**:
  > **v4.13.0 에 반영했습니다** — 제안 1안(자동 경고)과 2안 중 **원문 파일 링크**까지 넣었습니다.  조사하다 보니 2안의 절반은 이미 응답 안에 있었습니다. 법제처는 이 고시에 **hwpx·pdf 원문 4개**를 `<첨부파일링크>` 로 같이 주고 있는데, `get_admin_rule` 이 첨부파일을 안내하는 분기가 "조문내용이 비어 있을 때"에만 걸려 있었습니다. `<img>` 태그도 문자열로는 비어 있지 않으니 통과해 버려서, 정작 수치가 들어 있는 파일 링크가 묻혀 있었습니다.  `execute_tool(tool_name="get_admin_rule", params={"id": "2100000248042"})` 라이브 응답:  ``` 행정규칙명: (낙동강유역환경청) 수질오염물질의 배출허용기준 중 별도배출허용기준 종류: 고시  ---  ⚠️ 별표·수치가 이미지로만 제공되어 텍스트 추출 불가 (이미지 6개, 추출된 텍스트 8자)    → 기준 수치·적용 대상 목록은 아래 원문에서 직접 확인하세요.    원문: https://www.law.go.kr/admRulInfoP.do?admRulSeq=2100000248042    원문 파일: 별도배출허용기준 지정·고시.hwpx — http://law.go.kr/flDownload.do?flSeq=144740481    원문 파일: 별도배출허용기준 지정·고시.pdf — http://law.go.kr/flDownload.do?flSeq=144740485    원문 파일: ★ 수질오염물질의 배출허용기준 중 별도배출허용기준 […].hwpx — …flSeq=144740489    원문 파일: ★ 수질오염물질의 배출허용기준 중 별도배출허용기준 […].pdf — …flSeq=144740493 ⚠️ LLM은 이미지 안의 수치·대상 목록을 추측/생성하지 마세요.  (단위: ㎎/ℓ) <img id="144740515"> ... ```  판정은 이미지 태그를 걷어낸 **실텍스트 100자 미만**(이 고시는 8자, `(단위

- **Issue #158** (2026-09-10): **feat: make per-article amendment history opt-in in amendment_track (output exceeds 25k chars)**
  *Symptoms*: **Summary (EN)**  `legal_research(task="amendment_track")` returns an excellent old-vs-new comparison table, but also dumps the full per-article amendment history since original enactment (1981 for the OSH Act), hitting the ~25k-char truncation. Please make the history section opt-in (`includeHistory`, default false) or cap it to recent revisions.  ---  **배경**: ISO 법규준수 자동화(108개 법령 등록부)에서 개정 감지 시 신구대조 확인에 사용 중입니다.  **현상 (실측, 2026-08-30)**  `legal_research(task="amendment_track", query="산업안전보건법", lawId="001766")` 응답:  - 「▶ 신구대조표」 섹션 — 매우 유용 (실질 개정 조문의 개정 전/후 대조) - 「▶ 조문별 개정 이력」 섹션 — **제정 시점(1981-12-31)부터 조문×개정 전건**을 나열.   응답에 `⚠️ (이 섹션 49,990자 → 24,938자로 축약)` 표시와 함께 절단됨  실무에서 필요한 것은 거의 항상 최근 개정의 신구대조뿐인데, 이력 섹션이 응답 예산을 소진해 등록부 여러 건을 연속 처리할 때 컨텍스트 부담이 큽니다.  **제안**  - 조문별 개정 이력을 `includeHistory: true`(기본 false)로 opt-in 화 - 또는 최근 N회 개정으로 제한 (예: 기본 3회)  Reported via real-world usage; happy to provide more repro details. 
  **Post-Mortem & Fix Analysis**:
  > **v4.13.0 에 반영했습니다** — 조문별 개정 이력을 `includeHistory`(기본 `false`)로 껐습니다.  제안하신 두 안 중 1안(opt-in)을 택했습니다. "최근 N회로 제한"은 N 을 얼마로 잡아도 법령마다 개정 밀도가 달라 같은 문제가 재발하고, 무엇보다 **잘렸다는 사실이 응답 안에서 여전히 조용합니다.**  실측(`lawId=001766`, 2026-09-11):  | | 응답 길이 | 축약 표시 | |---|---|---| | 기본 (v4.13.0) | **6,542자** | 없음 | | `includeHistory=true` | 31,366자 | — |  신구대조표가 온전히 들어옵니다. 끈 자리에는 이렇게 남깁니다.  ``` [조문별 개정 이력 생략] 제정 시점부터의 조문×개정 전건이라 응답 상한을 소진합니다. 필요하면 includeHistory=true 또는 get_article_history(lawId="001766"). ```  껐다는 사실과 켜는 법을 같이 두지 않으면, 이 서버가 이력을 못 준다고 오해될 자리라고 봤습니다.  ``` legal_research(task="amendment_track", query="산업안전보건법", lawId="001766", includeHistory=true) ```  등록부 여러 건을 연속 처리하실 때 체감되는 변화가 있을지 알려주시면 좋겠습니다. 

- **Issue #157** (2026-09-10): **feat: bulk law lookup (search_law_bulk) with MST diff mode for compliance monitoring**
  *Symptoms*: **Summary (EN)**  Compliance-register monitoring (arguably the flagship use case for this MCP) required 98 individual `search_law` calls per weekly run. Propose `search_law_bulk` returning compact `{law_id, mst, effective_date, upcoming}` per query, plus a diff mode that accepts a `{law_id: previous_mst}` map and returns only changed laws.  ---  **배경**: ISO 법규준수 자동화(품질·환경·안전보건·정보보안·BCM·부패방지·AI·ESG 8개 영역 **108개 법령** 등록부)에 본 MCP를 실전 사용 중입니다.  **현상 (실측, 2026-08-31 / 2026-09-06)**  등록부 전건의 개정 여부 확인(주간 레이더)에 `search_law` **개별 호출 98회**가 필요했고, 같은 작업을 두 번 수행해 총 196회 호출했습니다. 각 응답에서 실제로 사용하는 값은 `법령ID / MST / 시행일 / 시행예정` 4개뿐이고, 부분매칭 목록·안내문은 감시 용도에는 불필요했습니다.  **제안**  1. `search_law_bulk(queries: string[])` — 건당 `{law_id, mst, effective_date, upcoming[]}` 컴팩트 반환 2. (확장) **diff 모드**: `{law_id: 이전MST}` 맵을 입력받아 **MST가 달라진 법령만** 반환.    MST가 개정마다 바뀌는 특성(이 MCP가 이미 문서화한 설계)을 서버가 직접 활용하는 것으로,    법규등록부 감시가 호출 1~2회로 끝나게 됩니다.  Reported via real-world usage; happy to provide more repro details. 
  **Post-Mortem & Fix Analysis**:
  > **v4.13.0 에 `search_law_bulk` 로 반영했습니다** (npm `korean-law-mcp@4.13.0`, `https://mcp.gomdori.app/law` 반영 완료).  제안하신 1·2안을 한 도구에 넣었습니다. 노출 도구는 10개 그대로라 `execute_tool` 경유입니다.  ``` execute_tool(tool_name="search_law_bulk", params={   "queries": ["산업안전보건법", "물환경보전법", "개인정보 보호법"],   "includeUpcoming": true }) ```  ``` 법령 대량 조회 (요청 3건 / 확인 3건)  1. 산업안전보건법 [현행]    ID 001766 | MST 283449 | 시행 2026-08-01    🔜 일부개정 시행예정 2027-01-08 (MST 287805, 2026-07-07 공포)    🔜 타법개정 시행예정 2026-12-08 (MST 285379, 2026-04-07 공포) 2. 물환경보전법 [현행]    ID 000166 | MST 283441 | 시행 2026-02-19 ... 📌 다음 감시용 스냅샷 (previous 에 그대로 전달): {"001766":"283449","000166":"283441","011357":"283839"} ```  **diff 모드** — 응답 말미의 스냅샷을 그대로 `previous` 에 넣으시면 됩니다.  ``` params={"queries": [...], "previous": {"001766":"283449", ...}} → △ 산업안전보건법 | ID 001766 | MST 283449 → 289415 | 시행 2027-03-09    (본문 동일 N건은 생략) ```  설계하면서 붙인 것 세 가지를 짚어둡니다.  1. **MST 가 같아도 시행예정이 있으면 침묵하지 않습니다.** 공포됐으나 미시행인 개정은 현행 MST 를 바꾸지 않아 diff 만 보면 "변경 없음"입니다. 준법 등록부에서 시행일

- **Issue #156** (2026-09-08): **bug: upcoming-enforcement (🔜) list in search_law is truncated, silently dropping amendments**
  *Symptoms*: **Summary (EN)**  `search_law` appends upcoming enforcement dates (🔜) but truncates the list without notice. For 대기환경보전법 (Clean Air Conservation Act) it showed 5 entries while law.go.kr `target=eflaw` returns 6 — the 2026-09-18 amendment (Act No. 21465) was silently dropped. Please show all upcoming entries (or an explicit "+N more"), or expose an eflaw-based tool.  ---  **배경**: ISO 법규준수 자동화(108개 법령 등록부 상시 감시)에 본 MCP를 실전 사용 중입니다.  **현상 (실측, 2026-09-06)**  `search_law("대기환경보전법")`의 🔜 시행예정 병기가 5건이었습니다:  ``` 🔜 시행 2027-01-10 (제21065호 타법) / 2027-01-10 (제19960호) / 2027-01-08 (제21843호)    / 2026-12-10 (제21778호) / 2026-11-12 (제21123호) ```  그러나 law.go.kr `lawSearch.do?target=eflaw` 직접 조회 결과 시행예정은 **6건**으로, **시행 2026-09-18 (2026-03-17 공포 제21465호 일부개정)** 이 누락돼 있었습니다. 잘렸다는 표시가 없어 사용자는 5건이 전부라고 믿게 됩니다.  **왜 중요한가**  준법 실무에서 시행예정 누락은 대응 기회 상실로 직결됩니다. 특히 가장 임박한 건이 잘리는 경우(이번 사례가 그랬음) 피해가 큽니다.  **제안**  - 시행예정은 잘라내지 않고 전수 표시, 불가피하면 「외 N건」을 명시 - 또는 `target=eflaw`(시행일자별 법령) 조회를 별도 도구로 노출  Reported via real-world usage; happy to provide more repro details. 
  **Post-Mortem & Fix Analysis**:
  > v4.12.5 로 수정해 프로덕션(`https://mcp.gomdori.app/law`)에 배포했습니다. 제보 감사합니다 — 지적하신 그대로였습니다.  **원인**: 법제처 `eflaw` 는 시행일이 **먼 것부터** 내려주는데, `buildUpcomingNotes` 가 그 순서 그대로 `slice(0,5)` 를 했습니다. 그래서 가장 급한 개정이 가장 먼저 버려졌습니다. 잘렸다는 표시도 없었으니 "5건이 전부"로 보이는 게 당연했습니다. 단순 상한 문제가 아니라 **정렬이 반대**였던 게 핵심이었습니다.  **수정** - 시행 **임박순 정렬 후** 자릅니다 — 급한 것이 남습니다 - 초과분은 `…외 N건 더 있음 (시행 임박순 5건만 표시) — 전수는 법제처 eflaw(시행일자별 법령) 조회 필요` 로 명시합니다  **배포 후 실측** (알려주신 대기환경보전법 그대로): ``` 🔜 「대기환경보전법」 개정 시행예정 (일부개정, 2026-03-17 공포 제21465호, 시행 2026-09-18) 🔜 「대기환경보전법」 개정 시행예정 (일부개정, 2025-11-11 공포 제21123호, 시행 2026-11-12) 🔜 「대기환경보전법」 개정 시행예정 (일부개정, 2026-06-09 공포 제21778호, 시행 2026-12-10) 🔜 「대기환경보전법」 개정 시행예정 (일부개정, 2026-07-07 공포 제21843호, 시행 2027-01-08) 🔜 「대기환경보전법」 개정 시행예정 (타법개정, 2025-10-01 공포 제21065호, 시행 2027-01-10) 🔜 …외 1건 더 있음 (시행 임박순 5건만 표시) — 전수는 법제처 eflaw 조회 필요 ``` 누락됐던 **2026-09-18 (제21465호)** 이 맨 위로 올라옵니다.  상한 5는 유지했습니다. 숫자를 늘려도 언제든 넘을 수 있어서, 침묵을 없애는 쪽이 본질이라고 봤습니다. 제보하신 사례를 그대로 회귀 테스트로 고정해뒀습니다(733 → 738).  ISO 법규준수 상시 감시에 쓰신다니, 전수가

- **Issue #155** (2026-09-05): **fix(knowledge-base): 존재하지 않는 법제처 target 3건으로 연계 도구 4개가 조용히 0건**
  *Symptoms*: ## 증상  법령정보 지식베이스 연계 도구 **4개가 에러 없이 항상 0건**을 냅니다.  | 도구 | 관측 결과 | |---|---| | `get_related_laws` | 항상 `[NOT_FOUND] 관련법령을 찾을 수 없습니다.` | | `get_term_articles` | 항상 `[NOT_FOUND] '…' 용어가 사용된 조문을 찾을 수 없습니다.` | | `get_daily_to_legal` | 항상 폴백(`fallbackTermSearch`) 결과로 대체됨 | | `get_legal_to_daily` | 항상 폴백(`fallbackTermSearch`) 결과로 대체됨 |  예외가 나지 않아 재시도·폴백 로직에도 걸리지 않고, 사용자에게는 "해당 자료가 없다"로만 보입니다.  ## 원인  `src/tools/knowledge-base.ts` 가 쓰는 법제처 OPEN API `target` 3개가 실재하지 않는 값입니다.  | 함수 | 현재 | 올바른 값 | |---|---|---| | `getDailyToLegal` · `getLegalToDaily` | `lawSearch.do` + `lstrmRel` | `lawService.do` + `lstrmRlt` | | `getTermArticles` | `lawSearch.do` + `lstrmJo` | `lawService.do` + `lstrmRltJo` | | `getRelatedLaws` | `lawSearch.do` + `lawRel` | `lawSearch.do` + `lsRlt` (엔드포인트 유지) |  법제처는 **잘못된 `target` 에 HTTP 200 + 빈 본문**을 줍니다. HTTP 에러도, XML 에러 메시지도 아니라 `fetchApi` 가 정상 반환하고 파서가 0건을 내는 것으로 끝납니다. 이 버그가 오래 남은 이유로 보입니다.  ## 근거 — 존재하지 않는 target 을 대조군으로 둔 실측  `type=XML` 로 같은 조건에서 응답 바이트를 잰 결과입니다.  | 엔드포인트 | target | HTTP | 응답 크기 | |---|---|---:|---:| | `lawSearch.do` | `lstrmRel` (현재) | 200 | **0 bytes** | | `lawSearch.do` | `lstrmJo` (현재) | 200 | **0 bytes** | | `lawSearch.do` | `lawRel` (현재) | 200 | **0 bytes** | | `lawSearch.do` | `bogus123` (**대조군 — 아예 없는 target**) | 200 | **0 bytes** | | `lawService.do` | `lstrmRlt` (수정) | 200 | 4,619 bytes | | `lawService.do` | `lstrmRltJo` (수정) | 200 | 439,240 bytes | | `lawSearch.do` | `lsRlt` (수정) | 200 | 5,158 bytes |  **세 target 이 대조군과 바이트 단위로 동일**합

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

### Incident Patch 1: `bc62ff40` (2026-09-23)
**Commit Message**: fix: 조문 개정 표기 보존, setup 이 커밋되는 설정에 키를 평문으로 쓰지 않게

- cleanHtml: 영문 태그·주석만 지운다. <개정 2012.8.1.>·<신설 …>·부칙 <제N호,…> 같은 한글 꺾쇠 표기가
  함께 지워져 개정 시점이 사라졌다(민법 전문에서만 149개). applicable_law 부칙 머리글은 표준 표기로 조립
- setup: 현재 폴더의 Claude Code .mcp.json 은 ${LAW_OC} 참조, VS Code .vscode/mcp.json 은 inputs 비밀번호
  입력(${input:law-oc}). 홈 디렉터리 설정은 종전대로

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `README-EN.md` (modified, +2/-0)
```diff
@@ -325,6 +325,8 @@ npx --ignore-scripts --omit=optional korean-law-mcp setup
 
 Interactive wizard handles API key input, client selection, and config file registration.
 Supports Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Gemini CLI, Zed, and Antigravity.
+Project-folder configs (Claude Code `.mcp.json`, VS Code `.vscode/mcp.json`) may be committed to git, so the key is not written in plain text:
+Claude Code gets a `${LAW_OC}` reference (add `export LAW_OC=your-key` to your shell profile), and VS Code prompts for the key on first run.
 
 **Manual setup:**
 
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -802,6 +802,8 @@ npx --ignore-scripts --omit=optional korean-law-mcp setup
 
 설치 마법사가 API 키 입력 → AI 클라이언트 선택 → 설정 파일 자동 등록까지 한 번에 처리합니다.
 Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Gemini CLI, Zed, Antigravity를 지원합니다.
+현재 폴더에 쓰는 설정(Claude Code `.mcp.json`, VS Code `.vscode/mcp.json`)은 git에 커밋될 수 있어 키를 평문으로 넣지 않습니다.
+Claude Code는 `${LAW_OC}` 참조를 넣으니 셸 설정에 `export LAW_OC=발급받은키`를 추가하고, VS Code는 처음 실행할 때 키를 묻습니다.
 
 **수동 설치:**
 
```

**File**: `src/lib/article-parser.test.ts` (modified, +13/-1)
```diff
@@ -1,5 +1,5 @@
 import { describe, it, expect } from "vitest"
-import { parseHangNumber, extractHangContent, groupMokByReset } from "./article-parser.js"
+import { parseHangNumber, extractHangContent, groupMokByReset, cleanHtml } from "./article-parser.js"
 
 describe("parseHangNumber — 원숫자 21항 이상", () => {
   // 회귀: ①~⑳까지만 매핑해 ㉑+(다른 유니코드 블록)가 NaN → verify_citations가
@@ -75,3 +75,15 @@ describe("groupMokByReset", () => {
     expect(groupMokByReset([{ 목번호: "나." }, { 목번호: "다." }]).length).toBe(1)
   })
 })
+
+// 2026-09-23: `<[^>]+>` 로 태그를 지우면 조문 본문의 꺾쇠 표기(개정 시점)까지 사라졌다(민법 전문에서 149개)
+describe("cleanHtml: 영문 태그만 지우고 꺾쇠 표기는 남긴다", () => {
+  it("개정·신설 표기와 부칙 일자를 보존한다", () => {
+    expect(cleanHtml("① 선량한 풍속 <개정 2012.8.1.><img src=x>")).toBe("① 선량한 풍속 <개정 2012.8.1.>")
+    expect(cleanHtml("부칙 <제17907호,2021.1.26> <br/>제1조")).toBe("부칙 <제17907호,2021.1.26> 제1조")
+  })
+
+  it("HTML 태그·주석은 여전히 지운다", () => {
+    expect(cleanHtml("<p>본문</p><!-- 주석 --><strong class=\"x\">강조</strong>")).toBe("본문강조")
+  })
+})
```

**File**: `src/lib/article-parser.ts` (modified, +10/-2)
```diff
@@ -184,10 +184,18 @@ export function parseHangNumber(raw: unknown): number {
   return numMatch ? parseInt(numMatch[0], 10) : NaN
 }
 
-/** HTML 정리 - 엔티티 디코딩 순서 중요: &amp; 최후 처리 (이중 인코딩 방지) */
+/**
+ * HTML 정리 - 엔티티 디코딩 순서 중요: &amp; 최후 처리 (이중 인코딩 방지)
+ *
+ * 태그 제거는 영문 태그와 주석으로 한정한다. 조문 본문에는 `<개정 2012.8.1.>`·`<신설 2005.12.29>`·
+ * `부칙 <1999.01.11>` 같은 꺾쇠 표기가 원문 그대로 오는데, `<[^>]+>` 로 지우면 개정 시점이 통째로
+ * 사라졌다(민법 전문에서만 149개, 2026-09-23). 행위시법 판단의 근거라 남긴다. admin-rule 의
+ * markChangedParts 와 같은 규칙이다.
+ */
 export function cleanHtml(text: string): string {
   return text
-    .replace(/<[^>]+>/g, '')
+    .replace(/<!--[\s\S]*?-->/g, '')
+    .replace(/<\/?[A-Za-z][^>]*>/g, '')
     .replace(/&nbsp;/g, ' ')
     .replace(/&lt;/g, '<')
     .replace(/&gt;/g, '>')
```

**File**: `src/lib/project-mcp-config.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { describe, it, expect } from "vitest"
+import { withKeyReference, withVscodeKeyInput, VSCODE_KEY_INPUT } from "./project-mcp-config.js"
+
+// 2026-09-23 리뷰 D13: 현재 디렉터리의 .mcp.json·.vscode/mcp.json 은 커밋되는 파일인데 키가 평문으로 들어갔다
+const entry = { command: "npx", args: ["-y", "korean-law-mcp"], env: { LAW_OC: "realkey123", LAW_API_PROTOCOL: "http" } }
+
+describe("withKeyReference", () => {
+  it("Claude Code 는 ${LAW_OC} 환경변수 참조로 바꾼다 (다른 env 는 유지)", () => {
+    const out = withKeyReference(entry, "claude-code")
+    expect(out.env).toEqual({ LAW_OC: "${LAW_OC}", LAW_API_PROTOCOL: "http" })
+    expect(JSON.stringify(out)).not.toContain("realkey123")
+  })
+
+  it("VS Code 는 ${input:law-oc} 입력 참조로 바꾼다", () => {
+    expect((withKeyReference(entry, "vscode").env as Record<string, string>).LAW_OC).toBe("${input:law-oc}")
+  })
+
+  it("키를 받지 않았으면 그대로 둔다", () => {
+    const noKey = { ...entry, env: {} }
+    expect(withKeyReference(noKey, "claude-code")).toBe(noKey)
+  })
+
+  it("원본 항목을 바꾸지 않는다 (다른 클라이언트에 같은 항목을 쓴다)", () => {
+    withKeyReference(entry, "claude-code")
+    expect(entry.env.LAW_OC).toBe("realkey123")
+  })
+})
+
+describe("withVscodeKeyInput", () => {
+  it("입력 정의를 추가하고 기존 inputs 는 보존한다", () => {
+    const out = withVscodeKeyInput({ inputs: [{ id: "other" }], servers: {} })
+    expect(out.inputs).toEqual([{ id: "other" }, VSCODE_KEY_INPUT])
+  })
+
+  it("이미 있으면 중복으로 넣지 않는다", () => {
+    const once = withVscodeKeyInput({})
+    expect(withVscodeKeyInput(once)).toBe(once)
+  })
+})
```

---

### Incident Patch 2: `bce397d1` (2026-09-23)
**Commit Message**: fix(tools): 응답 구조를 잘못 읽거나 실패를 0건으로 답하던 도메인 도구 정리

실측 응답(법제처 25회 호출)으로 확인하고 그 응답으로 회귀 테스트를 만들었다.
- get_law_statistics: <law>·제개정구분명을 읽는다(종전 업스트림 31회 뒤 늘 "총 0건"). 최신 날짜부터,
  MST 중복 제거, 예산 소진·실패일은 부분 결과로 밝히고 전부 실패면 첫 원인을 싣는다
- 조약: 다자조약(MultTrtyService)·조약기본정보 필드를 읽는다. 검색 결과의 다음 단계 안내 파라미터 교정
- 해석례: 기간을 explYd 로 서버에 넘긴다(2024 "건축" 2건 → 55건). 숫자·구분자 날짜 허용, 라벨 교정,
  본문은 기본 축약에서 제외(이유가 핵심)
- advanced_search: 출처별 실패를 밝히고 전부 실패면 오류, 자치법규 항목 태그·ID(일련번호) 교정
- 생활용어 target(dlytrm·dlytrmRlt), 조문 연혁 jo 6자리 변환, 공정위 사건번호(</사건번호 >),
  영문 법령명 태그, search_historical_law 파서 재사용
- 업스트림 오류를 "찾을 수 없습니다"로 덮어쓰던 래퍼 5종, 판례 부가 검색 실패·0건 구분

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `src/lib/xml-parser.test.ts` (modified, +35/-1)
```diff
@@ -1,5 +1,5 @@
 import { describe, it, expect } from "vitest"
-import { stripHtml, toArray, extractTag } from "./xml-parser.js"
+import { stripHtml, toArray, extractTag, parseSearchXML } from "./xml-parser.js"
 
 describe("stripHtml — 검색결과 하이라이트 태그 제거", () => {
   it('<strong class="...">지방</strong>자치법 → 지방자치법', () => {
@@ -38,3 +38,37 @@ describe("extractTag — XML 태그 텍스트 추출", () => {
     expect(extractTag("<a>x</a>", "b")).toBe("")
   })
 })
+
+// 2026-09-23 리뷰 D9: 실측 공정위 결정문 검색(target=ftc, query=담합) 응답 원문.
+// 닫는 태그가 `</사건번호 >`로 온다. 엄격 매칭이면 사건번호가 목록에서 빠졌다.
+const FTC_SEARCH_XML =
+  `<?xml version="1.0" encoding="UTF-8"?><Ftc><target>ftc</target><키워드>담합</키워드><section>evtNm</section>` +
+  `<totalCnt>1</totalCnt><page>1</page><기관명>공정거래위원회</기관명><ftc id="1"><결정문일련번호>9721</결정문일련번호>` +
+  `<사건명><![CDATA[군납유류 입찰담합 관련 과징금 재산정에 대한 현대오일뱅크(주)의 이의신청에 대한 건]]></사건명>` +
+  `<사건번호>2009협심0509</사건번호 ><문서유형>의결서</문서유형><회의종류>전 원 회 의</회의종류>` +
+  `<결정번호><![CDATA[재 결  제 2009 - 013호]]></결정번호><결정일자>2009.4.15.</결정일자>` +
+  `<결정문상세링크>/DRF/lawService.do?OC=test&amp;target=ftc&amp;ID=9721&amp;type=HTML&amp;mobileYn=</결정문상세링크></ftc></Ftc>`
+
+describe("extractTag: 닫는 태그 공백 내성 (D9)", () => {
+  it("실측 FTC 항목에서 `</사건번호 >`의 사건번호를 읽는다", () => {
+    const { items } = parseSearchXML(FTC_SEARCH_XML, "Ftc", "ftc", c => ({
+      사건번호: extractTag(c, "사건번호"),
+      사건명: extractTag(c, "사건명"),
+      결정일자: extractTag(c, "결정일자"),
+    }), { useIndexOf: true })
+    expect(items).toEqual([{
+      사건번호: "2009협심0509",
+      사건명: "군납유류 입찰담합 관련 과징금 재산정에 대한 현대오일뱅크(주)의 이의신청에 대한 건",
+      결정일자: "2009.4.15.",
+    }])
+  })
+
+  it("CDATA 값도 닫는 태그 공백을 허용한다", () => {
+    expect(extractTag("<사건명><![CDATA[가 사건]]></사건명 >", "사건명")).toBe("가 사건")
+  })
+
+  it("공백 허용이 이름이 긴 이웃 태그를 닫는 태그로 오인하지 않는다", () => {
+    // `</사건번호명>`은 `</사건번호\s*>`가 아니다. 다음 진짜 닫는 태그까지 가야 한다.
+    expect(extractTag("<사건번호>A</사건번호명></사건번호>", "사건번호")).toBe("A</사건번호명>")
+  })
+})
```

**File**: `src/lib/xml-parser.ts` (modified, +4/-2)
```diff
@@ -23,13 +23,15 @@ export function toArray<T>(x: T | T[] | null | undefined): T[] {
  * XML 태그에서 텍스트 추출 (CDATA 지원)
  */
 export function extractTag(content: string, tag: string): string {
+  // 닫는 태그 뒤 공백을 허용한다. 법제처 공정위 결정문 검색은 `<사건번호>2009협심0509</사건번호 >`처럼
+  // 닫는 태그에 공백을 섞어 보내, 엄격 매칭이면 사건번호가 목록에서 통째로 빠졌다 (2026-09-23 리뷰 D9).
   // CDATA 형식 먼저 시도
-  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)
+  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}\\s*>`)
   const cdataMatch = content.match(cdataRegex)
   if (cdataMatch) return cdataMatch[1]
 
   // 일반 형식 (태그 내 중첩 태그 허용: [\s\S]*? 사용)
-  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
+  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}\\s*>`)
   const match = content.match(regex)
   if (match) return match[1].trim()
 
```

**File**: `src/tools/advanced-search.test.ts` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+import { afterEach, describe, it, expect, vi } from "vitest"
+import { advancedSearch, AdvancedSearchSchema } from "./advanced-search.js"
+import { LawApiClient } from "../lib/api-client.js"
+
+// 2026-09-23 리뷰 D3: 대상별 검색 오류를 빈 배열로 삼켜 "고급 검색 결과 (0건)"을 성공으로 내던 결함.
+
+/** 실측 법령 검색(target=law, query=관세법) 첫 항목 원문(OC만 치환) */
+const LAW_XML =
+  `<?xml version="1.0" encoding="UTF-8"?><LawSearch><target>law</target><키워드>관세법</키워드><section>lawNm</section>` +
+  `<totalCnt>1</totalCnt><page>1</page><numOfRows>1</numOfRows><resultCode>00</resultCode><resultMsg>success</resultMsg>` +
+  `<law id="1"><법령일련번호>288689</법령일련번호><현행연혁코드>현행</현행연혁코드><법령명한글><![CDATA[관세법]]></법령명한글>` +
+  `<법령약칭명><![CDATA[]]></법령약칭명><법령ID>001556</법령ID><공포일자>20260811</공포일자><공포번호>21858</공포번호>` +
+  `<제개정구분명>일부개정</제개정구분명><소관부처코드>1053000</소관부처코드><소관부처명>재정경제부</소관부처명>` +
+  `<법령구분명>법률</법령구분명><공동부령정보></공동부령정보><시행일자>20260811</시행일자><자법타법여부></자법타법여부>` +
+  `<법령상세링크>/DRF/lawService.do?OC=test&amp;target=law&amp;MST=288689&amp;type=HTML</법령상세링크></law></LawSearch>`
+
+/** 실측 자치법규 검색(target=ordin) 원문(OC만 치환). 항목 태그가 <ordin>이 아니라 <law>다 */
+const ORDIN_XML =
+  `<?xml version="1.0" encoding="UTF-8"?><OrdinSearch><target>ordin</target><키워드>서울특별시 주차장 설치</키워드><section>ordinNm</section>` +
+  `<totalCnt>74</totalCnt><page>1</page><numOfRows>1</numOfRows><resultCode>00</resultCode><resultMsg>success</resultMsg>` +
+  `<law id="1"><자치법규일련번호>1589887</자치법규일련번호><자치법규명><![CDATA[서울특별시 강남구 민영주차장 설치자금 융자 및 보조금 시행규칙]]></자치법규명>` +
+  `<자치법규ID>2072388</자치법규ID><공포일자>20210416</공포일자><공포번호>936</공포번호><제개정구분명>일부개정</제개정구분명>` +
+  `<지자체기관명>서울특별시 강남구</지자체기관명><자치법규종류>규칙</자치법규종류><시행일자>20210416</시행일자>` +
+  `<자치법규상세링크>/DRF/lawService.do?OC=test&amp;target=ordin&amp;MST=1589887&amp;type=HTML&amp;mobileYn=</자치법규상세링크>` +
+  `<자치법규분야명><![CDATA[제5장 맑은도시]]></자치법규분야명><참조데이터구분>0</참조데이터구분></law></OrdinSearch>`
+
+const EMPTY_LAW_XML = `<?xml version="1.0" encoding="UTF-8"?><LawSearch><target>law</target><totalCnt>0</totalCnt></LawSearch>`
+const EMPTY_ORDIN_XML = `<?xml version="1.0" encoding="UTF-8"?><OrdinSearch><target>ordin</target><totalCnt>0</totalCnt></OrdinSearch>`
+
+const input = (over: Partial<Parameters<typeof advancedSearch>[1]> = {}) =>
+  AdvancedSearchSchema.parse({ query: "관세법", ...over })
+
+afterEach(() => {
+  vi.useRealTimers()
+  vi.unstubAllGlobals()
+})
+
+describe("advancedSearch: 업스트림 실패를 0건으로 둔갑시키지 않는다 (D3)", () => {
+  it("실제 재시도 경로에서 매번 503이면 오류로 답한다 (종전: '0건' 성공)", async () => {
+    vi.useFakeTimers()
+    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })))
+    const pending = advancedSearch(new LawApiClient({ apiKey: "test" }), input({ query: "주차장" }))
+    await vi.advanceTimersByTimeAsync(60_000)
+    const r = await pending
+    expect(r.isError).toBe(true)
+    expect(r.content[0].text).toContain("법제처 서버 오류 (503)")
+    expect(r.content[0].text).not.toContain("(0건)")
+  })
+
+  it("일부 대상만 실패하면 받은 결과를 싣고 실패 대상을 밝힌다", async () => {
+    const client = {
+      searchLaw: async () => LAW_XML,
+      searchAdminRule: async () => { throw new Error("법제처 서버 오류 (503) - searchAdminRule") },
+      searchOrdinance: async () => EMPTY_ORDIN_XML,
+    } as unknown as LawApiClient
+    const r = await advancedSearch(client, input({ searchType: "all" }))
+    const t = r.content[0].text
+    expect(r.isError).toBeFalsy()
+    expect(t).toContain("1. 관세법")
+    expect(t).toContain("행정규칙: 법제처 서버 오류 (503)")
+    expect(t).toContain("해당 자료가 없다는 뜻이 아닙니다")
+  })
+
+  it("전 대상이 실패하면 대상별 원인을 모아 오류로 답한다", async () => {
+    const fail = (name: string) => async () => { throw new Error(`법제처 서버 오류 (503) - ${name}`) }
+    const client = {
+      searchLaw: fail("searchLaw"), searchAdminRule: fail("searchAdminRule"), searchOrdinance: fail("searchOrdinance"),
+    } as unknown as LawApiClient
+    const r = await advancedSearch(client, input({ searchType: "all" }))
+    expect(r.isError).toBe(true)
+    expect(r.content[0].text).toContain("자치법규 검색 실패")
+  })
+})

```

**File**: `src/tools/advanced-search.ts` (modified, +99/-48)
```diff
@@ -5,16 +5,21 @@
 import { z } from "zod"
 import { DOMParser } from "@xmldom/xmldom"
 import type { LawApiClient } from "../lib/api-client.js"
-import { truncateResponse } from "../lib/schemas.js"
-import { formatToolError } from "../lib/errors.js"
+import { truncateResponse, optionalDateSchema } from "../lib/schemas.js"
+import { formatToolError, noResultHint } from "../lib/errors.js"
+import { rethrowIfFatal } from "../lib/fatal-errors.js"
+import { maskSensitiveUrl } from "../lib/fetch-with-retry.js"
+
+const TARGET_LABELS: Record<string, string> = { law: "법령", admin_rule: "행정규칙", ordinance: "자치법규" }
 
 export const AdvancedSearchSchema = z.object({
   query: z.string().describe("검색 키워드"),
   searchType: z.enum(["law", "admin_rule", "ordinance", "all"]).optional().default("law").describe(
     "검색 대상: law (법령), admin_rule (행정규칙), ordinance (자치법규), all (전체)"
   ),
-  fromDate: z.string().optional().describe("제정일 시작 (YYYYMMDD)"),
-  toDate: z.string().optional().describe("제정일 종료 (YYYYMMDD)"),
+  // 검색 응답에는 제정일이 없다. 법령·자치법규는 공포일자(최신 공포본), 행정규칙은 발령일자로 거른다 (2026-09-23 리뷰 D3).
+  fromDate: optionalDateSchema.describe("공포일(행정규칙은 발령일) 시작 (YYYYMMDD). 최신 공포본 기준이며 제정일이 아님"),
+  toDate: optionalDateSchema.describe("공포일(행정규칙은 발령일) 종료 (YYYYMMDD). 최신 공포본 기준이며 제정일이 아님"),
   org: z.string().optional().describe("소관부처코드"),
   operator: z.enum(["AND", "OR"]).optional().default("AND").describe("키워드 결합 연산자"),
   display: z.number().optional().default(20).describe("최대 결과 개수"),
@@ -38,10 +43,33 @@ export async function advancedSearch(
       ? ["law", "admin_rule", "ordinance"]
       : [input.searchType]
 
-    const targetResults = await Promise.all(
+    // 대상별 실패를 모은다. 종전엔 429/401/403 외 오류(5xx·타임아웃·HTML·빈 본문)를 대상별 빈 배열로 삼켜
+    // "고급 검색 결과 (0건)"을 성공으로 냈다. 업스트림 장애가 "해당 법령 없음"으로 읽혔다 (2026-09-23 리뷰 D3).
+    const settled = await Promise.allSettled(
       searchTargets.map(target => searchByType(apiClient, target, keywords, input, input.apiKey))
     )
-    results = targetResults.flat()
+    const failures: Array<{ label: string, error: unknown }> = []
+    settled.forEach((r, i) => {
+      if (r.status === "fulfilled") {
+        results.push(...r.value)
+        return
+      }
+      rethrowIfFatal(r.reason)
+      failures.push({ label: TARGET_LABELS[searchTargets[i]] || searchTargets[i], error: r.reason })
+    })
+    if (failures.length === searchTargets.length) {
+      return formatToolError(
+        failures.length === 1
+          ? failures[0].error
+          : new Error(failures.map(f => `${f.label} 검색 실패: ${errorMessage(f.error)}`).join(" / ")),
+        "advanced_search"
+      )
+    }
+    const failureNote = failures.length > 0
+      ? `⚠️ 아래 대상은 검색에 실패해 결과에 없습니다. 해당 자료가 없다는 뜻이 아닙니다.\n` +
+        failures.map(f => `  - ${f.label}: ${errorMessage(f.error)}`).join("\n") + `\n`
+      : ""
+    const fetchedCount = results.length
 
     // AND/OR 연산 적용
     if (input.operator === "AND" && keywords.length > 1) {
@@ -56,13 +84,30 @@ export async function advancedSearch(
     // 상위 N개만
     results = results.slice(0, input.display)
 
+    // OR은 키워드별 개별 조회를 하지 않는다: 전체 검색어 1회 조회 결과다. 묵시적으로 OR인 척하지 않게 밝힌다.
+    const orNote = input.operator === "OR" && keywords.length > 1
+      ? `⚠️ OR 연산은 키워드별로 따로 조회하지 않습니다. 전체 검색어로 한 번 조회한 결과입니다. 키워드마다 따로 검색하세요.\n`
+      : ""
+
+    if (results.length === 0) {
+      const hint = noResultHint(input.query, "고급 검색")
+      const extra: string[] = []
+      if (fetchedCount > 0) extra.push(`필터 적용 전 ${fetchedCount}건이 AND/기간 필터에서 모두 제외됐습니다.`)
+      if (orNote) extra.push(orNote.trimEnd())
+      if (failureNote) extra.push(failureNote.trimEnd())
+      if (extra.length > 0) hint.content[0].text += `\n\n${extra.join("\n")}`
+      return hint
+    }
+
     // 결과 포맷
     let resultText = `고급 검색 결과 (${results.length}건)\n\n`
     resultText += `검색어: ${input.query}\n`
     resultText += `연산자: ${input.operator}\n`
     if (input.fromDate || input.toDate) {
-      resultText += `기간: ${input.fromDate
```

**File**: `src/tools/article-history.test.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+import { describe, it, expect } from "vitest"
+import { getArticleHistory, ArticleHistorySchema } from "./article-history.js"
+import type { LawApiClient } from "../lib/api-client.js"
+
+// 2026-09-23 리뷰 D5: 실측 lsJoHstInf(관세법 ID=001556, JO=003800) 응답 항목 원문(OC만 치환).
+// JO=제38조로 보내면 같은 법령 버전 목록이 오지만 <조문정보>가 전부 비어 거짓 NOT_FOUND가 났다.
+const JO_CODE_XML =
+  `<?xml version="1.0" encoding="UTF-8"?><LawSearch><target>lsJoHstInf</target><totalCnt>107</totalCnt>` +
+  `<law id="1"><법령정보><법령일련번호>5011</법령일련번호><법령명한글><![CDATA[관세법]]></법령명한글><법령ID>001556</법령ID>` +
+  `<공포일자>19491123</공포일자><공포번호>00067</공포번호><제개정구분명>제정</제개정구분명><소관부처코드><![CDATA[1053000]]></소관부처코드>` +
+  `<소관부처명><![CDATA[재정경제부]]></소관부처명><법령구분명>법률</법령구분명><시행일자>19491123</시행일자></법령정보>` +
+  `<조문정보><jo num="1"><조문번호>003800</조문번호><변경사유>제정</변경사유>` +
+  `<조문링크>/DRF/lawService.do?OC=test&amp;target=eflaw&amp;MST=5011&amp;JO=003800&amp;efYd=19491123&amp;type=HTML</조문링크>` +
+  `<조문변경이력상세링크>/DRF/lawService.do?OC=test&amp;target=lsJoHstInf&amp;ID=001556&amp;JO=003800&amp;type=XML</조문변경이력상세링크>` +
+  `<조문개정일>19491123</조문개정일><조문시행일>19491123</조문시행일></jo></조문정보></law>` +
+  `<law id="2"><법령정보><법령일련번호>5012</법령일련번호><법령명한글><![CDATA[관세법]]></법령명한글><법령ID>001556</법령ID>` +
+  `<공포일자>19511206</공포일자><공포번호>00229</공포번호><제개정구분명>일부개정</제개정구분명><소관부처코드><![CDATA[1053000]]></소관부처코드>` +
+  `<소관부처명><![CDATA[재정경제부]]></소관부처명><법령구분명>법률</법령구분명><시행일자>19511227</시행일자></법령정보><조문정보></조문정보></law>` +
+  `</LawSearch>`
+
+function recordingClient() {
+  const sent: Array<string | undefined> = []
+  const client = {
+    getArticleHistory: async (p: { jo?: string }) => { sent.push(p.jo); return JO_CODE_XML },
+  } as unknown as LawApiClient
+  return { client, sent }
+}
+
+const run = (client: LawApiClient, jo: string) =>
+  getArticleHistory(client, ArticleHistorySchema.parse({ lawId: "001556", jo }))
+
+describe("getArticleHistory: jo는 6자리 JO 코드로 보낸다 (D5)", () => {
+  it("스키마 예시 형식 '제38조'를 003800으로 바꿔 보내고 실제 이력을 싣는다", async () => {
+    const { client, sent } = recordingClient()
+    const r = await run(client, "제38조")
+    expect(sent).toEqual(["003800"])
+    expect(r.isError).toBeFalsy()
+    expect(r.content[0].text).toContain("관세법 제38조")
+    expect(r.content[0].text).toContain("변경사유: 제정")
+  })
+
+  it("가지 조문도 변환한다 (제10조의2 → 001002)", async () => {
+    const { client, sent } = recordingClient()
+    await run(client, "제10조의2")
+    expect(sent).toEqual(["001002"])
+  })
+
+  it("이미 6자리 코드면 그대로 둔다 (buildJO에 넣으면 380000이 된다)", async () => {
+    const { client, sent } = recordingClient()
+    await run(client, "003800")
+    expect(sent).toEqual(["003800"])
+  })
+})
```

---

### Incident Patch 3: `e380cff0` (2026-09-23)
**Commit Message**: fix(security): 사용자 입력이 닿는 정규식 ReDoS 3경로 선형화

인증 없는 요청 1건(100KB 이하)으로 이벤트 루프가 12~24초 멈췄다(업스트림 호출 없음).
- legal_research(document_review)·analyze_document: 금액·기간·충돌 규칙의 [^0-9]*·.* 를
  간격 500자 상한과 숫자 시작으로(100K 병적 입력 13.5초 → 1ms 미만)
- get_annexes: 별표 표기·상위법 추출 정규식을 공백을 뭉친 사본에 적용(19.3초 → 0.5ms)
- 검색어 정규화(LexDiff 원본은 그대로)·조문 앵커·질의 추출기: 공백 연속을 먼저 하나로
- 구·신 약 380만 건 차등 퍼징에서 의도 외 출력 차이 0. 의도한 차이는 쉼표만 든 금액 미생성,
  라벨과 값 사이 500자 초과 간격 미매칭, [10] 이상 참조 표시 보존
- 부수: get_annexes 한 요청에서 같은 법령 전문을 두 번 받던 것 1회로, 판례 축약의 서로게이트
  분할 방지, 판례 검색 결과에 키가 실린 원시 링크 줄을 싣지 않음

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `src/lib/admin-rule-articles.test.ts` (modified, +27/-0)
```diff
@@ -193,3 +193,30 @@ describe("부분 조회 입력 방어", () => {
     expect(v.text).toContain("비어 있습니다")
   })
 })
+
+// 2026-09-23 리뷰 C7: 줄 끝 공백 제거 `/\s+$/u` 는 라인 안 공백 덩어리에서 제곱이었다(10만 자 13초).
+// 실측 외국환거래규정의 최장 라인 내부 공백은 6자라 지금은 발화하지 않지만, 업스트림 한 건이면 멈춘다.
+describe("parseAdminRuleArticles: 라인 안 공백 덩어리 (리뷰 C7)", () => {
+  it("라인 안 공백 10만 자에서도 선형이고 결과는 같다", () => {
+    const body = "제1조(목적) 가" + " ".repeat(100_000) + "나   \n제2조 본문\t"
+    const t0 = performance.now()
+    const p = parseAdminRuleArticles(body)
+    expect(performance.now() - t0).toBeLessThan(200)
+    expect(p.articles.map(a => a.key)).toEqual(["1", "2"])
+    expect(p.articles[0].lines[0]).toBe("제1조(목적) 가" + " ".repeat(100_000) + "나")
+    expect(p.articles[1].lines).toEqual(["제2조 본문"])
+  })
+
+  // 리뷰 전 구현으로 뽑은 기준값 (2026-09-23)
+  it("줄 끝 공백 제거는 종전과 같다", () => {
+    expect(parseAdminRuleArticles("제1장 총칙\n제1조(목적) 가.   \n  본문\t\n제2조 나\n제3조의2 다  \n")).toEqual({
+      articles: [
+        { key: "1", ord: [1, 0, 0], label: "제1조(목적) 가.", lines: ["제1조(목적) 가.", "  본문"], chapter: 1 },
+        { key: "2", ord: [2, 0, 0], label: "제2조 나", lines: ["제2조 나"], chapter: 1 },
+        { key: "3의2", ord: [3, 0, 2], label: "제3조의2 다", lines: ["제3조의2 다", ""], chapter: 1 },
+      ],
+      chapters: [{ num: 1, title: "제1장 총칙" }],
+      preamble: [],
+    })
+  })
+})
```

**File**: `src/lib/admin-rule-articles.ts` (modified, +3/-1)
```diff
@@ -103,7 +103,9 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
   let pending: string[] = []
 
   for (const rawLine of lines) {
-    const line = rawLine.replace(/\s+$/u, "")
+    // 2026-09-23 리뷰 C7: `/\s+$/u` 는 라인 안 공백 덩어리에서 제곱이다(10만 자 13초).
+    // trimEnd 는 같은 공백 집합을 선형으로 지운다.
+    const line = rawLine.trimEnd()
     const trimmed = line.trim()
 
     // 헤더 판정은 원 라인 기준(^ 앵커) — 들여쓰기된 라인은 본문이다.
```

**File**: `src/lib/annex-notation.test.ts` (modified, +29/-0)
```diff
@@ -106,3 +106,32 @@ describe("findMatchingAnnex — 별지 제목도 번호로 잡힌다", () => {
     expect(findMatchingAnnex(list, "4", "1")?.별표명).toContain("[별표4]")
   })
 })
+
+// 2026-09-23 리뷰 C2: ANNEX_HINT_RE 의 `\s*` 들이 공백 덩어리에서 제곱으로 백트래킹했다
+// ("관세법 별표" + 공백 10만 자 → 23.6초). get_annexes 는 이 파싱을 fetch 전에 하므로
+// 요청 한 건이 업스트림 호출 없이 이벤트 루프를 멈췄다.
+describe("parseLawNameAndHint: 공백 덩어리 입력 (리뷰 C2)", () => {
+  it("별표 뒤 공백 10만 자에서도 즉시 번호를 뗀다", () => {
+    const t0 = performance.now()
+    const r = parseLawNameAndHint("관세법 별표" + " ".repeat(100_000) + "4")
+    expect(performance.now() - t0).toBeLessThan(200)
+    expect(r).toEqual({ normalizedLawName: "관세법", annexNo: "4" })
+  })
+
+  it("힌트가 없으면 공백 덩어리도 즉시 끝나고 원문(trim)을 그대로 돌려준다", () => {
+    const input = "관세법" + " ".repeat(100_000) + "가"
+    const t0 = performance.now()
+    const r = parseLawNameAndHint(input)
+    expect(performance.now() - t0).toBeLessThan(200)
+    expect(r).toEqual({ normalizedLawName: input })
+  })
+
+  it("공백이 섞인 정상 표기는 종전과 같다", () => {
+    expect(parseLawNameAndHint("관세법  시행령   별표  제4호")).toEqual({ normalizedLawName: "관세법 시행령", annexNo: "4" })
+    expect(parseLawNameAndHint("도로교통법\n시행규칙\t별표 28")).toEqual({ normalizedLawName: "도로교통법 시행규칙", annexNo: "28" })
+    expect(parseLawNameAndHint("  관세법   시행령  ")).toEqual({ normalizedLawName: "관세법   시행령" })
+    expect(parseLawNameAndHint("별표 4")).toEqual({ normalizedLawName: "별표 4", annexNo: "4" })
+    expect(parseLawNameAndHint("관세법 [별표 1의2]")).toEqual({ normalizedLawName: "관세법", annexNo: "000102" })
+    expect(parseLawNameAndHint("별표28 운전면허")).toEqual({ normalizedLawName: "운전면허", annexNo: "28" })
+  })
+})
```

**File**: `src/lib/annex-notation.ts` (modified, +7/-2)
```diff
@@ -74,14 +74,19 @@ export function fromAnnexCode(code: string): { main: number, sub: number } | und
  */
 export function parseLawNameAndHint(lawName: string): { normalizedLawName: string, annexNo?: string } {
   const trimmedLawName = lawName.trim()
-  const annexHintMatch = trimmedLawName.match(ANNEX_HINT_RE)
+  // 2026-09-23 리뷰 C2: ANNEX_HINT_RE 의 `\s*` 들은 공백 덩어리에서 제곱으로 백트래킹한다
+  // ("관세법 별표" + 공백 10만 자 → 23.6초, get_annexes 가 fetch 전에 멈췄다). 공백을 한 칸으로
+  // 접은 사본에서 찾는다. `\s*` 는 길이 1과 k를 구별하지 않으므로 번호·법령명 결과는 같다.
+  // 힌트가 없으면 종전처럼 원문(trim)을 그대로 돌려준다.
+  const collapsed = trimmedLawName.replace(/\s+/g, " ")
+  const annexHintMatch = collapsed.match(ANNEX_HINT_RE)
 
   if (!annexHintMatch) {
     return { normalizedLawName: trimmedLawName }
   }
 
   const parsed = parseAnnexNumber(annexHintMatch[0])
-  const normalizedLawName = trimmedLawName
+  const normalizedLawName = collapsed
     .replace(annexHintMatch[0], " ")
     .replace(/\s+/g, " ")
     .trim()
```

**File**: `src/lib/article-anchor.test.ts` (modified, +38/-0)
```diff
@@ -203,3 +203,41 @@ describe("classifyArticleRefs — 구 법령 접두 보류 (#150)", () => {
     expect(classifyArticleRefs("구 매장및묘지등에관한법률 제17조 위헌소원", aJangsa)).toBe("mismatch")
   })
 })
+
+// 2026-09-23 리뷰 C7: ARTICLE_REF_RE 의 `\s*[」』】〕]?\s*` 는 공백 덩어리에서 세제곱이었다
+// (인용 앞 공백 800자 228ms, 1,600자 1.35초). 자치법규 본문 전체(원시 JSON)에 적용되므로
+// 업스트림 한 건에 긴 공백이 섞이면 그대로 멈춘다. 판정 입구에서 공백을 접는다.
+describe("classifyArticleRefs: 공백 덩어리 (리뷰 C7)", () => {
+  const anchor = parseArticleAnchor("제12조", "주차장법")!
+
+  it("인용 앞 공백 10만 자에서도 즉시 판정한다", () => {
+    const t0 = performance.now()
+    expect(classifyArticleRefs("이 조례는" + " ".repeat(100_000) + "「주차장법」제12조에 따라", anchor)).toBe("match")
+    expect(classifyArticleRefs("가" + " ".repeat(100_000) + "가", anchor)).toBe("silent")
+    expect(performance.now() - t0).toBeLessThan(200)
+  })
+
+  it("공백 길이는 판정에 영향이 없다 (종전과 같다)", () => {
+    const a103 = parseArticleAnchor("제103조", "민법")!
+    const a103NoLaw = parseArticleAnchor("제103조")!
+    const CASES: Array<[string, string, string]> = [
+      ["민법 제103조 위반", "match", "match"],
+      ["「민법」   제103조", "match", "match"],
+      ["민법 제1032조 위헌소원", "mismatch", "mismatch"],
+      ["형법  제103조", "law-mismatch", "match"],
+      ["구   민법 제103조", "match", "match"],
+      ["제100조부터\n\n제105조까지", "match", "match"],
+      ["손해배상(기)", "silent", "silent"],
+      ["민법  제 103 조", "match", "match"],
+    ]
+    for (const [text, withLaw, withoutLaw] of CASES) {
+      expect([classifyArticleRefs(text, a103), classifyArticleRefs(text, a103NoLaw)]).toEqual([withLaw, withoutLaw])
+    }
+  })
+
+  it("classifyLawName: 대상 법령명의 공백 덩어리도 즉시 끝난다", () => {
+    const t0 = performance.now()
+    expect(classifyLawName("민법", "민" + " ".repeat(100_000) + "법")).toBe("same")
+    expect(performance.now() - t0).toBeLessThan(200)
+  })
+})
```

---

### Incident Patch 4: `ae0b4694` (2026-09-22)
**Commit Message**: fix(admin-rule): 부분 조회 파서의 조용한 라인 유실 2건 (#162 리뷰)

실데이터(외국환거래규정 2100000285140, 564라인)로 확인한 유실 경로다.

- 장 헤더 뒤 절 헤더가 preamble 로 빠져 부분 조회에서 사라졌다 — preamble 은
  jo/chapter/keyword 어느 뷰에서도 출력되지 않는다. 첫 조문 이후의 떠도는 라인은
  pending 으로 모아 다음 조문 앞에 붙인다 (564/564 라인 커버·preamble 0)
- 장마다 조 번호가 1 로 리셋되는 체계(제2장 제1조)는 단조증가 검사에서 탈락하고
  cur=null 직후라 본문에도 못 붙어 조문이 통째로 사라졌다 — 장 헤더에서 lastOrd 리셋
- paginateFullText("") 의 "페이지 1/0" 표기 → totalPages 하한 1
- keyword:"   " 가 includes("") 로 전 조문 매칭 → 공백 키워드는 NOT_FOUND

회귀 테스트 5건 추가. 801 → 806 테스트.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C8WSX45VUd1YysJ2Dsv7mx

**File**: `src/lib/admin-rule-articles.test.ts` (modified, +42/-0)
```diff
@@ -151,3 +151,45 @@ describe("paginateFullText — 비중첩 페이징 (AC#6)", () => {
     expect(paginateFullText(full, 0, 1000).page).toBe(1)
   })
 })
+
+// ─── 리뷰 보강 (#162): 조문·라인 유실 방어 ───
+describe("parseAdminRuleArticles — 라인 유실 방어", () => {
+  it("장마다 조 번호가 1부터 다시 시작해도 조문을 잃지 않는다", () => {
+    const body = ["제1장 총칙", "제1조(목적) 가.", "제2조(정의) 나.", "제2장 벌칙", "제1조(과태료) 다.", "제2조(경과) 라."].join("\n")
+    const p = parseAdminRuleArticles(body)
+    expect(p.articles).toHaveLength(4)
+    expect(p.articles.map((a) => a.chapter)).toEqual([1, 1, 2, 2])
+    expect(p.articles.filter((a) => a.chapter === 2).map((a) => a.lines.join(""))).toEqual([
+      "제1조(과태료) 다.", "제2조(경과) 라.",
+    ])
+  })
+
+  it("장 헤더 뒤 절 헤더는 다음 조문에 붙어 부분 조회에서 살아남는다", () => {
+    // 실측(외국환거래규정): 절 헤더가 장 헤더 바로 뒤에 와 어느 조문에도 속하지 못했다
+    const body = ["제1장 총칙", "제1-1조(목적) 가.", "제2장 외국환업무취급기관", "제1절 외국환은행", "제2-1조(업무) 나."].join("\n")
+    const p = parseAdminRuleArticles(body)
+    expect(p.articles.find((a) => a.key === "2-1")!.lines.join("\n")).toContain("제1절 외국환은행")
+    expect(buildPartialBody(body, body, { chapter: "제2장" }).text).toContain("제1절 외국환은행")
+    expect(p.preamble).toEqual([])
+  })
+
+  it("전체 라인이 조문·장·서문 중 한 곳에는 반드시 담긴다", () => {
+    const body = ["머리말", "제1장 총칙", "제1조(목적) 가.", "제1절 통칙", "제2조(정의) 나.", "맺음말"].join("\n")
+    const p = parseAdminRuleArticles(body)
+    const kept = [...p.preamble, ...p.chapters.map((c) => c.title), ...p.articles.flatMap((a) => a.lines)]
+    expect(kept.sort()).toEqual(body.split("\n").sort())
+  })
+})
+
+describe("부분 조회 입력 방어", () => {
+  it("본문이 비어도 page 표기는 1/1", () => {
+    expect(paginateFullText("", 1)).toMatchObject({ page: 1, totalPages: 1, text: "" })
+    expect(buildPartialBody("", "", { page: 1 }).label).toBe("페이지 1/1")
+  })
+
+  it("공백뿐인 keyword는 전체 매칭이 아니라 NOT_FOUND", () => {
+    const v = buildPartialBody(HYPHEN_BODY, HYPHEN_BODY, { keyword: "   " })
+    expect(v.text).toContain("[NOT_FOUND]")
+    expect(v.text).toContain("비어 있습니다")
+  })
+})
```

**File**: `src/lib/admin-rule-articles.ts` (modified, +12/-2)
```diff
@@ -99,6 +99,8 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
   let cur: AdminRuleArticle | null = null
   let curChapter = 0
   let lastOrd: [number, number, number] | null = null
+  // 조문 사이에 끼는 절 헤더 등 — 다음 조문 앞에 붙여 부분 조회에서 유실되지 않게 한다
+  let pending: string[] = []
 
   for (const rawLine of lines) {
     const line = rawLine.replace(/\s+$/u, "")
@@ -112,6 +114,9 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
       curChapter = Number(ch[1])
       chapters.push({ num: curChapter, title: trimmed })
       cur = null // 장 헤더는 어느 조문에도 속하지 않는다
+      // 장마다 조 번호가 1부터 다시 시작하는 체계(제2장 제1조 등)에서 조문이 통째로
+      // 유실되지 않도록 단조증가 기준을 장 단위로 리셋한다
+      lastOrd = null
       continue
     }
 
@@ -123,9 +128,10 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
           key: toKey(ord[0], ord[1], ord[2]),
           ord,
           label: trimmed,
-          lines: [line],
+          lines: pending.length ? [...pending, line] : [line],
           chapter: curChapter,
         }
+        pending = []
         // 하이픈형에서 장 헤더가 생략된 경우 조 번호 앞자리를 장으로 삼는다
         if (!curChapter && ord[1] > 0) cur.chapter = ord[0]
         articles.push(cur)
@@ -136,9 +142,13 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
     }
 
     if (cur) cur.lines.push(line)
-    else if (trimmed) preamble.push(line)
+    else if (!trimmed) continue
+    else if (articles.length) pending.push(line) // 첫 조문 이후의 떠도는 라인 = 절 헤더 등
+    else preamble.push(line)
   }
 
+  if (pending.length && articles.length) articles[articles.length - 1].lines.push(...pending)
+
   return { articles, chapters, preamble }
 }
 
```

**File**: `src/lib/admin-rule-views.ts` (modified, +3/-2)
```diff
@@ -87,6 +87,7 @@ function chapterView(parsed: ParsedAdminRule, chapter: string): string {
 function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults: number): string {
   if (parsed.articles.length === 0) return NO_ARTICLE_MSG
   const kw = keyword.trim()
+  if (!kw) return "[NOT_FOUND] keyword 가 비어 있습니다 — 검색어를 지정하세요."
   const hits = parsed.articles.filter((a) => a.lines.some((l) => l.includes(kw)))
   if (hits.length === 0) {
     return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 조문이 없습니다. (총 ${parsed.articles.length}개조 검색)\n⚠️ LLM은 조문 내용을 추측/생성하지 마세요.`
@@ -123,9 +124,9 @@ export function paginateFullText(fullText: string, page: number, chunkSize = 450
     boundaries.push(end)
     pos = end
   }
-  const totalPages = boundaries.length - 1
+  const totalPages = Math.max(1, boundaries.length - 1)
   const p = Math.max(1, Math.min(Math.trunc(page) || 1, totalPages))
-  const text = fullText.slice(boundaries[p - 1], boundaries[p])
+  const text = fullText.slice(boundaries[p - 1] ?? 0, boundaries[p] ?? fullText.length)
   return { text, page: p, totalPages }
 }
 
```

---

### Incident Patch 5: `41affef8` (2026-09-20)
**Commit Message**: fix(fetch): `fetch failed` 가 원인을 감추던 문제 — cause 코드·호스트를 표면화하고 서버 로그에 남긴다 (#161)

#78 에 이어 #161 도 사용자 손에 남은 건 "fetch failed" 다섯 글자와 시각뿐이었다.
undici 는 DNS 실패·TCP 리셋·연결 타임아웃·TLS 검증 실패를 전부 같은 메시지로 던지고
cause 에만 code 를 싣는다. 머신이 갈리면 서버 로그도 같이 사라지므로(09-20 sin 머신
파괴), 사후에 리전 egress 드롭인지 법제처 점검인지 가를 근거가 없었다.

- describeFetchError: cause 의 code·메시지·대상 호스트를 붙인다
  ("fetch failed (ECONNRESET: read ECONNRESET) - www.law.go.kr"). 마스킹은 그대로 거친다
- 재시도를 다 태운 최종 실패는 `[upstream]` 로 stderr 에 남긴다 — fly logs 에서 같은 시각의
  원인 코드를 찾을 수 있게

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JNWJbTbPeeW3oR1xtzFvvU

**File**: `src/lib/fetch-with-retry.test.ts` (modified, +47/-1)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, describe, it, expect, vi } from "vitest"
-import { fetchWithRetry, maskSensitiveUrl } from "./fetch-with-retry.js"
+import { describeFetchError, fetchWithRetry, maskSensitiveUrl } from "./fetch-with-retry.js"
 
 // Critical Rule 11: URL/에러 메시지 외부 노출 전 API 키 마스킹 (회귀 시 키 유출)
 describe("maskSensitiveUrl — API 키 마스킹", () => {
@@ -48,3 +48,49 @@ describe("getRetryDelay — Retry-After 상한", () => {
     await expect(pending).resolves.toMatchObject({ status: 200 })
   })
 })
+
+// #161: undici 의 `fetch failed` 는 cause(ECONNRESET·ENOTFOUND·UND_ERR_CONNECT_TIMEOUT…)를 감춘 채
+// 표면화돼, 리전 egress 드롭인지 법제처 점검인지 사후에 가를 수 없었다. code·메시지·호스트를 붙인다.
+describe("describeFetchError — fetch failed 원인 표면화", () => {
+  const url = "https://www.law.go.kr/DRF/lawSearch.do?OC=secret&target=law&query=법인세법"
+
+  it("cause 의 code·메시지와 호스트를 붙인다", () => {
+    const err = new TypeError("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) })
+    expect(describeFetchError(err, url)).toBe("fetch failed (ECONNRESET: read ECONNRESET) - www.law.go.kr")
+  })
+
+  it("cause 메시지가 code 와 같으면 한 번만 쓴다", () => {
+    const err = new TypeError("fetch failed", { cause: Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" }) })
+    expect(describeFetchError(err, url)).toBe("fetch failed (ETIMEDOUT) - www.law.go.kr")
+  })
+
+  it("cause 에 API 키가 실려 와도 마스킹된다", () => {
+    const err = new TypeError("fetch failed", {
+      cause: Object.assign(new Error(`Connect Timeout Error (attempted address: ${url})`), { code: "UND_ERR_CONNECT_TIMEOUT" }),
+    })
+    const msg = describeFetchError(err, url)
+    expect(msg).toContain("UND_ERR_CONNECT_TIMEOUT")
+    expect(msg).not.toContain("secret")
+  })
+
+  it("fetch failed 가 아니거나 cause 가 없으면 기존 마스킹만", () => {
+    expect(describeFetchError(new Error(`boom ${url}`), url)).toBe(`boom ${url.replace("secret", "***")}`)
+    expect(describeFetchError(new TypeError("fetch failed"), url)).toBe("fetch failed")
+  })
+
+  it("fetchWithRetry 가 재시도를 다 태우면 원인이 붙은 에러로 던진다", async () => {
+    vi.useFakeTimers()
+    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
+    vi.stubGlobal("fetch", vi.fn(async () => {
+      throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND www.law.go.kr"), { code: "ENOTFOUND" }) })
+    }))
+    const pending = fetchWithRetry(url, { retries: 1, retryDelay: 1 })
+    const assertion = expect(pending).rejects.toThrow("fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND www.law.go.kr) - www.law.go.kr")
+    await vi.advanceTimersByTimeAsync(100)
+    await assertion
+    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[upstream] 2회 시도 실패: fetch failed (ENOTFOUND"))
+    spy.mockRestore()
+    vi.useRealTimers()
+    vi.unstubAllGlobals()
+  })
+})
```

**File**: `src/lib/fetch-with-retry.ts` (modified, +29/-3)
```diff
@@ -77,6 +77,29 @@ function isLawGoKrHost(targetUrl: string): boolean {
   }
 }
 
+/**
+ * undici 의 `fetch failed` 는 원인(cause)을 감춘 채 온다 — DNS 실패·TCP 리셋·연결 타임아웃·
+ * TLS 검증 실패가 전부 같은 다섯 글자다. #78·#161 처럼 사용자에게 "fetch failed" 만 남으면
+ * 리전 egress 드롭인지 법제처 점검인지 사후에 가를 수 없다(머신이 갈리면 서버 로그도 같이
+ * 사라진다). cause 의 code·메시지와 대상 호스트를 붙여 표면화한다. 원본 메시지도 URL 을
+ * 품을 수 있으므로 마스킹은 그대로 거친다.
+ */
+export function describeFetchError(error: Error, url: string): string {
+  const cause = (error as { cause?: unknown }).cause
+  if (error.message !== "fetch failed" || !(cause instanceof Error)) return maskSensitiveUrl(error.message)
+  const code = (cause as { code?: unknown }).code
+  const detail = [typeof code === "string" ? code : "", cause.message && cause.message !== code ? cause.message : ""]
+    .filter(Boolean)
+    .join(": ")
+  let host = ""
+  try {
+    host = new URL(url).host
+  } catch {
+    // URL 파싱 실패 시 호스트 생략
+  }
+  return `fetch failed (${maskSensitiveUrl(detail || cause.name)})${host ? ` - ${host}` : ""}`
+}
+
 /**
  * Fetch with automatic retry and timeout
  */
@@ -201,9 +224,9 @@ export async function fetchWithRetry(
         if (error.name === "AbortError" && timedOut) {
           lastError = new Error(`Request timeout after ${timeout}ms for ${maskSensitiveUrl(url)}`)
         } else {
-          // fetch 네이티브 에러 메시지에도 URL이 포함될 수 있음
-          const masked = maskSensitiveUrl(error.message)
-          lastError = masked !== error.message ? new Error(masked) : error
+          // fetch 네이티브 에러 메시지에도 URL이 포함될 수 있음. `fetch failed` 는 cause 를 풀어 쓴다
+          const described = describeFetchError(error, url)
+          lastError = described !== error.message ? Object.assign(new Error(described), { cause: error }) : error
         }
       }
 
@@ -216,6 +239,9 @@ export async function fetchWithRetry(
     }
   }
 
+  // 재시도를 다 태우고도 못 붙은 건 서버 로그에 남긴다 — 사용자 보고(#161)만으로는 시각과
+  // "fetch failed" 뿐이라, 같은 시각 서버가 본 원인 코드가 있어야 리전·업스트림을 가른다.
+  if (lastError) console.error(`[upstream] ${retries + 1}회 시도 실패: ${lastError.message}`)
   throw lastError || new Error("Request failed after retries")
 }
 
```

---

### Incident Patch 6: `e2fe3d3c` (2026-09-10)
**Commit Message**: fix(admin-rule): 이미지-only 별표가 경고 없이 나가던 문제 (#159)

법제처는 별표의 기준 수치·적용 대상 목록을 <img id="…"> 태그로만 돌려줄 때가 있다
(실측: 낙동강유역환경청 「수질오염물질의 배출허용기준 중 별도배출허용기준」 고시
2100000248042 — 이미지 6개 + 실텍스트 8자 "(단위: ㎎/ℓ)").

get_admin_rule 은 이것을 "본문 있음"으로 보고 그대로 출력했다. 배출기준치처럼
심사원이 실제로 확인하는 수치 자리에서 모델이 추측하기 좋은 상태다 — 이 서버의
환각 방지 목표와 정확히 부딪히는 지점.

이미지 태그를 걷어낸 실텍스트가 100자 미만이면 본문 앞에 경고를 붙이고 원문 URL과
첨부파일 원문(hwpx/pdf) 링크를 함께 안내한다. 첨부파일은 API 가 이미 주고 있었는데
"본문이 비어 있지 않다"는 이유로 안내 분기에 도달하지 못하고 묻혀 있었다.

경고를 본문 뒤가 아니라 앞에 두는 이유: 뒤에 붙이면 truncateResponse 가 경고부터
잘라내고 무의미한 <img> 태그만 남는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NMcUqjf1R2TzCRZMrv5TfY

**File**: `src/lib/image-only-body.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { describe, it, expect } from "vitest"
+import { analyzeImageOnlyBody, adminRuleSourceUrl, buildImageOnlyWarning } from "./image-only-body.js"
+
+// 실측 (#159): 낙동강유역환경청 「수질오염물질의 배출허용기준 중 별도배출허용기준」
+// 고시 2100000248042 의 <조문내용> — 기준 수치·대상 산단 목록이 전부 이미지다.
+const REAL_IMAGE_ONLY = `(단위: ㎎/ℓ)
+<img id="144740515">
+</img>
+<img id="144740517">
+</img>
+<img id="144740519">
+</img>`
+
+describe("이미지-only 본문 판정 (#159)", () => {
+  it("실측 고시: 이미지 3개 + 실텍스트 8자를 이미지-only로 판정", () => {
+    const r = analyzeImageOnlyBody(REAL_IMAGE_ONLY)
+    expect(r.imageCount).toBe(3)
+    expect(r.textLength).toBe(8) // "(단위:㎎/ℓ)"
+    expect(r.imageOnly).toBe(true)
+  })
+
+  it("이미지가 섞여도 본문이 충분하면 경고하지 않는다", () => {
+    const body = `제1조(목적) ${"이 고시는 배출허용기준을 정함을 목적으로 한다. ".repeat(6)}<img id="1"></img>`
+    const r = analyzeImageOnlyBody(body)
+    expect(r.imageCount).toBe(1)
+    expect(r.imageOnly).toBe(false)
+  })
+
+  it("이미지가 없으면 본문이 짧아도 이미지-only가 아니다", () => {
+    expect(analyzeImageOnlyBody("삭제 <2024. 1. 1.>").imageOnly).toBe(false)
+  })
+
+  it("자기닫음 <img/> 표기도 센다", () => {
+    expect(analyzeImageOnlyBody(`<img id="1"/><img id="2"/>`).imageCount).toBe(2)
+  })
+
+  it("경고문에 원문 URL·첨부파일·추측 금지가 함께 실린다", () => {
+    const info = analyzeImageOnlyBody(REAL_IMAGE_ONLY)
+    const w = buildImageOnlyWarning("2100000248042", info, [
+      { name: "별도배출허용기준 지정·고시.pdf", link: "http://law.go.kr/flDownload.do?flSeq=144740485" },
+    ])
+    expect(w).toContain("이미지로만 제공되어 텍스트 추출 불가")
+    expect(w).toContain(adminRuleSourceUrl("2100000248042"))
+    expect(w).toContain("flSeq=144740485")
+    expect(w).toContain("추측/생성하지 마세요")
+  })
+})
```

**File**: `src/lib/image-only-body.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+/**
+ * 이미지-only 본문 판정 (#159).
+ *
+ * 법제처 API는 별표의 기준 수치·대상 목록을 `<img id="...">` 태그로만 돌려줄 때가 있다
+ * (예: 유역환경청 별도배출허용기준 고시). 텍스트가 사실상 없는데 응답은 정상으로 보여
+ * LLM 이 수치를 지어내기 딱 좋은 자리다 — 이 서버의 환각 방지 목표와 정면으로 부딪힌다.
+ *
+ * 태그를 걷어낸 실텍스트 길이로 "본문이 비어 있음"을 판정한다.
+ */
+
+/** `<img ...>` · `<img ...></img>` 양쪽 표기 (법제처는 둘을 섞어 쓴다) */
+const IMG_TAG = /<img\b[^>]*>(?:\s*<\/img\s*>)?/gi
+
+/**
+ * 실텍스트 하한. 이보다 짧으면 본문이 아니라 이미지 캡션 수준이다
+ * (실측: 낙동강유역환경청 고시 2100000248042 = 이미지 6개 + 실텍스트 8자 "(단위:㎎/ℓ)").
+ * 조문 한 개도 못 되는 길이라 여유를 크게 잡아도 정상 본문을 오판하지 않는다.
+ */
+const MIN_REAL_TEXT = 100
+
+export interface ImageOnlyBody {
+  imageCount: number
+  /** 공백·이미지 태그를 뺀 실텍스트 길이 */
+  textLength: number
+  /** 이미지가 있고 실텍스트가 하한 미만 — 본문이 사실상 비어 있음 */
+  imageOnly: boolean
+}
+
+export function analyzeImageOnlyBody(text: string): ImageOnlyBody {
+  const imageCount = text.match(IMG_TAG)?.length ?? 0
+  const textLength = text.replace(IMG_TAG, "").replace(/\s+/g, "").length
+  return { imageCount, textLength, imageOnly: imageCount > 0 && textLength < MIN_REAL_TEXT }
+}
+
+/** 법제처 행정규칙 본문 뷰어 — 이미지 별표를 사람이 눈으로 확인하는 자리 */
+export function adminRuleSourceUrl(seq: string): string {
+  return `https://www.law.go.kr/admRulInfoP.do?admRulSeq=${encodeURIComponent(seq)}`
+}
+
+/**
+ * 이미지-only 경고문.
+ * 첨부파일(원문 hwpx/pdf)이 있으면 함께 안내한다 — 심사원이 실제로 확인하는 수치가
+ * 그 파일 안에 있는데, 종전에는 조문내용이 "비어 있지 않다"는 이유로 링크까지 묻혔다.
+ */
+export function buildImageOnlyWarning(
+  seq: string,
+  info: ImageOnlyBody,
+  attachments: Array<{ name: string; link: string }> = [],
+): string {
+  let out = `⚠️ 별표·수치가 이미지로만 제공되어 텍스트 추출 불가 (이미지 ${info.imageCount}개, 추출된 텍스트 ${info.textLength}자)\n`
+  out += `   → 기준 수치·적용 대상 목록은 아래 원문에서 직접 확인하세요.\n`
+  out += `   원문: ${adminRuleSourceUrl(seq)}\n`
+  for (const a of attachments) {
+    out += `   원문 파일: ${a.name} — ${a.link}\n`
+  }
+  out += `⚠️ LLM은 이미지 안의 수치·대상 목록을 추측/생성하지 마세요.\n`
+  return out
+}
```

**File**: `src/tools/admin-rule.test.ts` (modified, +30/-0)
```diff
@@ -87,3 +87,33 @@ describe("compare_admin_rule_old_new — 실형상 파싱", () => {
     expect(r.content[0].text).toContain("[개정 전] 【<신  설>】")
   })
 })
+
+// 실측 축약 (#159): 조문내용이 <img> 태그뿐이라 "비어 있음" 분기에 걸리지 않고,
+// 첨부파일(원문 hwpx/pdf)이 있는데도 안내되지 않던 응답
+const IMAGE_ONLY_XML = `<?xml version="1.0" encoding="UTF-8"?><AdmRulService><행정규칙기본정보><행정규칙일련번호>2100000248042</행정규칙일련번호><행정규칙명><![CDATA[(낙동강유역환경청) 수질오염물질의 배출허용기준 중 별도배출허용기준]]></행정규칙명><행정규칙종류>고시</행정규칙종류><조문형식여부>N</조문형식여부></행정규칙기본정보>
+<조문내용><![CDATA[(단위: ㎎/ℓ)
+<img id="144740515">
+</img>
+<img id="144740517">
+</img>]]></조문내용>
+<첨부파일><첨부파일명><![CDATA[별도배출허용기준 지정·고시.pdf]]></첨부파일명><첨부파일링크>http://law.go.kr/flDownload.do?flSeq=144740485
+</첨부파일링크></첨부파일></AdmRulService>`
+
+describe("get_admin_rule — 이미지-only 별표 경고 (#159)", () => {
+  it("본문이 <img>뿐이면 경고·원문 URL·첨부파일을 앞세운다", async () => {
+    const r = await getAdminRule(detailStub(IMAGE_ONLY_XML), { id: "2100000248042" })
+    expect(r.isError).toBeFalsy()
+    const text = r.content[0].text
+    expect(text).toContain("이미지로만 제공되어 텍스트 추출 불가")
+    expect(text).toContain("admRulSeq=2100000248042")
+    // 첨부파일 링크는 API가 이미 주고 있었는데 "본문이 비어 있지 않다"는 이유로 묻혀 있었다
+    expect(text).toContain("flSeq=144740485")
+    // 경고가 본문보다 앞 — truncate에 잘려 사라지면 안 된다
+    expect(text.indexOf("텍스트 추출 불가")).toBeLessThan(text.indexOf("<img"))
+  })
+
+  it("정상 조문에는 경고를 붙이지 않는다", async () => {
+    const r = await getAdminRule(detailStub(DETAIL_XML), { id: "2100000271110" })
+    expect(r.content[0].text).not.toContain("이미지로만 제공되어")
+  })
+})
```

**File**: `src/tools/admin-rule.ts` (modified, +36/-0)
```diff
@@ -8,6 +8,7 @@ import type { LawApiClient } from "../lib/api-client.js"
 import { truncateResponse } from "../lib/schemas.js"
 import { formatToolError, noResultHint } from "../lib/errors.js"
 import { detectAbolishedAdminRule } from "../lib/abolished-laws.js"
+import { analyzeImageOnlyBody, buildImageOnlyWarning } from "../lib/image-only-body.js"
 
 // search_admin_rule 스키마
 export const SearchAdminRuleSchema = z.object({
@@ -87,6 +88,33 @@ export const GetAdminRuleSchema = z.object({
 
 export type GetAdminRuleInput = z.infer<typeof GetAdminRuleSchema>
 
+/** xmldom 파싱 결과 타입 — 이 프로젝트는 DOM lib를 켜지 않는다 */
+type XmlDoc = ReturnType<InstanceType<typeof DOMParser>["parseFromString"]>
+
+/** 태그별 텍스트를 순서대로 모은다 (xmldom NodeList는 iterable이 아니다) */
+function collectText(doc: XmlDoc, tag: string): string {
+  const nodes = doc.getElementsByTagName(tag)
+  const out: string[] = []
+  for (let i = 0; i < nodes.length; i++) {
+    const t = nodes[i].textContent?.trim() || ""
+    if (t) out.push(t)
+  }
+  return out.join("\n")
+}
+
+/** 첨부파일명 ↔ 링크 짝 (#159 경고에서 원문 파일을 함께 안내하기 위한 것) */
+function collectAttachments(doc: XmlDoc): Array<{ name: string; link: string }> {
+  const links = doc.getElementsByTagName("첨부파일링크")
+  const names = doc.getElementsByTagName("첨부파일명")
+  const out: Array<{ name: string; link: string }> = []
+  for (let i = 0; i < links.length; i++) {
+    const link = links[i].textContent?.trim() || ""
+    if (!link) continue
+    out.push({ name: names[i]?.textContent?.trim() || `첨부 ${i + 1}`, link })
+  }
+  return out
+}
+
 /**
  * 전문이 비어 있을 때 원인별 안내 (#72)
  * 식별자 오류를 "법제처 API 제한"으로 뭉뚱그리면 원인 추적이 막힌다.
@@ -194,6 +222,14 @@ export async function getAdminRule(
       }
     }
 
+    // 이미지-only 경고 (#159) — 본문 앞에 둔다. 뒤에 붙이면 truncateResponse가
+    // 경고부터 잘라내고 무의미한 <img> 태그만 남아 LLM이 수치를 지어내기 쉬워진다.
+    const bodyText = `${collectText(doc, "조문내용")}\n${collectText(doc, "별표내용")}`
+    const imgInfo = analyzeImageOnlyBody(bodyText)
+    if (imgInfo.imageOnly) {
+      resultText += buildImageOnlyWarning(input.id, imgInfo, collectAttachments(doc)) + "\n"
+    }
+
     // 조문 내용 출력
     for (let i = 0; i < joContents.length; i++) {
       const joContent = joContents[i].textContent?.trim() || ""
```

---

### Incident Patch 7: `00a54fa4` (2026-09-08)
**Commit Message**: fix(law-text): efYd 오용으로 난 NOT_FOUND 가 엉뚱하게 mst 를 탓하던 문제 (#160)

efYd 는 그 법령에 실재하는 시행일이어야 하는데, 설명이 "시행일자 (YYYYMMDD 형식)"
뿐이라 '조회 기준일'로 읽힌다. 제보자는 search_law 가 준 mst/lawId 를 그대로 쓰고
efYd 에 오늘 날짜(20260907)를 넣었고, 법제처는 그 시행일 버전이 없어 빈 봉투를 줬다.

문제는 그때 나가는 안내였다. efYd 유무와 무관하게 "법제처 API가 해당 mst/lawId에
대해 데이터를 반환하지 않았습니다. search_law로 유효한 mst를 먼저 확인하세요" 만
찍어, 식별자가 멀쩡한데도 식별자를 의심하게 만든다. 제보자는 법인세법·시행령·상법
세 건을 그렇게 확인하고도 원인을 못 찾았다.

실측 대조: mst 만 200 / mst+lawId 200 / mst+efYd=20260701(실재 시행일) 200 /
mst+lawId+efYd=20260907(임의 날짜) NOT_FOUND. 범인은 efYd 하나다.

- NOT_FOUND 안내를 efYd 유무로 분기해, efYd 가 있으면 그것을 1순위로 지목하고
  efYd 없는 재조회 명령을 그대로 제시한다 ("mst/lawId 자체는 유효할 수 있습니다")
- efYd 설명에 '조회 기준일이 아니다' 를 명시

동작(조회 성공 경로)은 바꾸지 않았다. 임의 날짜에 조용히 다른 시행일 버전을 끼워
주면 NOT_FOUND 보다 나쁜 조용한 오답이 된다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NMcUqjf1R2TzCRZMrv5TfY

**File**: `src/tools/law-text.ts` (modified, +9/-2)
```diff
@@ -16,7 +16,7 @@ export const GetLawTextSchema = z.object({
   mst: z.string().optional().describe("법령일련번호 (search_law에서 획득)"),
   lawId: z.string().optional().describe("법령ID (search_law에서 획득)"),
   jo: z.string().optional().describe("조문 번호. 자연어 표기 권장 — '제38조'·'제148조의2'를 그대로 넣으면 서버가 변환한다. 6자리 JO 코드 직접 지정 시 조번호 4자리 zero-pad + 의X 2자리: 제38조→003800, 제10조의2→001002, 제234조의2→023402(234002 아님)"),
-  efYd: z.string().optional().describe("시행일자 (YYYYMMDD 형식)"),
+  efYd: z.string().optional().describe("시행일자 (YYYYMMDD). 그 법령에 **실재하는 시행일**이어야 한다 — 오늘 날짜 같은 임의 '조회 기준일'을 넣으면 NOT_FOUND 가 난다. 현행 본문은 efYd 없이 조회할 것. 시행예정본은 search_law 가 안내한 efYd 를 그대로 쓴다."),
   apiKey: z.string().optional().describe("법제처 Open API 인증키(OC). 사용자가 제공한 경우 전달")
 }).refine(data => data.mst || data.lawId, {
   message: "mst 또는 lawId 중 하나는 필수입니다"
@@ -70,10 +70,17 @@ export async function getLawText(
     // JSON 구조 파싱 (LexDiff 방식 적용)
     const lawData = json?.법령
     if (!lawData) {
+      // efYd 가 붙어 있으면 그게 1순위 용의자다. 종전 메시지는 무조건 mst/lawId 를 탓해,
+      // 식별자가 멀쩡한데도 "search_law 로 유효한 mst 를 확인하라"고 엉뚱한 곳을 가리켰다
+      // (#160: search_law 가 준 mst/lawId 그대로인데 efYd 에 오늘 날짜를 넣어 NOT_FOUND).
+      const retryId = input.mst || input.lawId || ""
+      const hint = input.efYd
+        ? `⚠️ efYd=${input.efYd} 에 해당하는 시행일 버전이 없습니다. efYd 는 '조회 기준일'이 아니라 그 법령에 실재하는 시행일이어야 합니다 — 오늘 날짜를 넣으면 대개 실패합니다.\n→ 현행 본문: get_law_text(mst="${retryId}") 로 efYd 없이 재조회\n→ 시행예정본: search_law 가 안내한 efYd 를 그대로 사용\nmst/lawId 자체는 유효할 수 있습니다.`
+        : `⚠️ 법제처 API가 해당 mst/lawId에 대해 데이터를 반환하지 않았습니다. search_law로 유효한 mst를 먼저 확인하세요.`
       return {
         content: [{
           type: "text",
-          text: "[NOT_FOUND] 법령 데이터를 찾을 수 없습니다.\n\n⚠️ 법제처 API가 해당 mst/lawId에 대해 데이터를 반환하지 않았습니다. LLM이 조문을 추측/생성하지 마세요. search_law로 유효한 mst를 먼저 확인하세요."
+          text: `[NOT_FOUND] 법령 데이터를 찾을 수 없습니다.\n\n${hint}\n\nLLM이 조문을 추측/생성하지 마세요.`
         }],
         isError: true
       }
```

---

### Incident Patch 8: `293f2529` (2026-09-08)
**Commit Message**: fix(search): 시행예정 병기가 임박한 개정부터 조용히 잘라내던 문제 (#156)

법제처 eflaw 는 시행일이 먼 것부터 내려준다. buildUpcomingNotes 는 그 순서를
그대로 slice(0,5) 해서, 가장 급한 개정이 가장 먼저 버려졌다. 잘렸다는 표시도
없어 사용자는 표시된 5건이 전부라고 믿게 된다.

실측(#156 제보, 대기환경보전법 2026-09-06): 시행예정 6건 중 가장 임박한
2026-09-18 시행(제21465호)이 잘리고 2027-01-10 두 건이 남았다. ISO 법규준수
상시 감시에 쓰는 제보자에게 시행예정 누락은 대응 기회 상실로 직결된다.

- 시행 임박순 정렬 후 자른다 — 급한 것이 남는다
- 초과분은 "…외 N건 더 있음" 으로 명시하고 eflaw 직접 조회를 안내한다
- 상한(5)은 유지. 숫자를 늘려도 언제든 넘을 수 있어, 침묵을 없애는 게 핵심이다

테스트 733 → 738 (제보 사례 그대로를 회귀로 고정).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NMcUqjf1R2TzCRZMrv5TfY

**File**: `src/lib/upcoming-laws.test.ts` (modified, +54/-0)
```diff
@@ -55,3 +55,57 @@ describe("buildUpcomingNotes", () => {
     expect(buildUpcomingNotes([], [])).toBe("")
   })
 })
+
+// #156 회귀 — 대기환경보전법 실측(2026-09-06) 형태. eflaw 는 시행일이 먼 것부터 내려주는데
+// 종전 코드가 그 순서로 slice(0,5) 해서, 가장 임박한 2026-09-18 이 조용히 잘렸다.
+const MANY_UPCOMING_XML = `<?xml version="1.0" encoding="UTF-8"?><LawSearch><target>eflaw</target>
+${[
+  ["276715", "20270110", "21065"],
+  ["258105", "20270110", "19960"],
+  ["287811", "20270108", "21843"],
+  ["286741", "20261210", "21778"],
+  ["279785", "20261112", "21123"],
+  ["284321", "20260918", "21465"],   // 가장 임박 — 종전엔 이게 잘렸다
+]
+  .map(
+    ([mst, eff, no], i) =>
+      `<law id="${i + 1}"><법령일련번호>${mst}</법령일련번호><현행연혁코드>시행예정</현행연혁코드>` +
+      `<법령명한글><![CDATA[대기환경보전법]]></법령명한글><법령ID>001773</법령ID>` +
+      `<공포일자>20260317</공포일자><공포번호>${no}</공포번호><제개정구분명>일부개정</제개정구분명>` +
+      `<법령구분명>법률</법령구분명><시행일자>${eff}</시행일자></law>`
+  )
+  .join("\n")}
+</LawSearch>`
+
+describe("buildUpcomingNotes — 잘림 (#156)", () => {
+  const many = parseUpcomingXml(MANY_UPCOMING_XML)
+  const hits = [{ name: "대기환경보전법", lawId: "001773" }]
+
+  it("6건을 파싱한다", () => {
+    expect(many).toHaveLength(6)
+  })
+
+  it("가장 임박한 시행예정을 잘라내지 않는다", () => {
+    const notes = buildUpcomingNotes(hits, many)
+    expect(notes).toContain("2026-09-18")          // 종전에 조용히 사라지던 건
+    expect(notes).toContain('mst="284321"')
+  })
+
+  it("시행 임박순으로 나열한다", () => {
+    const notes = buildUpcomingNotes(hits, many)
+    const order = [...notes.matchAll(/시행 (\d{4}-\d{2}-\d{2})/g)].map(m => m[1])
+    expect(order).toEqual([...order].sort())
+    expect(order[0]).toBe("2026-09-18")
+  })
+
+  it("잘린 건수를 침묵하지 않고 밝힌다", () => {
+    const notes = buildUpcomingNotes(hits, many)
+    expect(notes).toContain("외 1건 더 있음")
+    expect(notes).toContain("eflaw")
+  })
+
+  it("상한 이하면 잘림 안내를 붙이지 않는다", () => {
+    const notes = buildUpcomingNotes(hits, many.slice(0, 3))
+    expect(notes).not.toContain("더 있음")
+  })
+})
```

**File**: `src/lib/upcoming-laws.ts` (modified, +18/-1)
```diff
@@ -73,6 +73,9 @@ export async function fetchUpcomingLaws(
   }
 }
 
+/** 병기 상한 — 초과분은 침묵하지 않고 "외 N건"으로 알린다 (#156) */
+const MAX_UPCOMING_NOTES = 5
+
 const fmtDate = (d: string) => (d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d)
 
 /**
@@ -88,7 +91,15 @@ export function buildUpcomingNotes(
   if (upcoming.length === 0) return ""
   const hitById = new Map(hits.map(h => [h.lawId, h]))
   const lines: string[] = []
-  for (const u of upcoming.slice(0, 5)) {
+
+  // 시행 임박순으로 정렬한 뒤 자른다. 종전엔 API 응답 순서(먼 시행일부터)를 그대로
+  // slice(0,5) 해서 가장 급한 개정이 먼저 버려졌다 — 실측(#156, 대기환경보전법):
+  // 시행예정 6건 중 가장 임박한 2026-09-18 이 잘리고 2027-01-10 이 남았다.
+  // 준법 감시 용도에선 정확히 반대 순서다.
+  const sorted = [...upcoming].sort((a, b) =>
+    (a.effDates[0] || "99999999").localeCompare(b.effDates[0] || "99999999"))
+
+  for (const u of sorted.slice(0, MAX_UPCOMING_NOTES)) {
     const eff = u.effDates.map(fmtDate).join(" · ")
     // 시행예정본은 efYd 없이는 법제처 API가 404 — 반드시 시행일 병기
     const joHint = u.effDates[0]
@@ -104,5 +115,11 @@ export function buildUpcomingNotes(
       lines.push(`🔜 시행예정 ${u.lawType || "법령"}: 「${u.name}」 ${tail} — 아직 미시행이라 현행 검색에는 없음`)
     }
   }
+
+  // 잘렸으면 반드시 말한다. 침묵하면 사용자는 표시된 게 전부라고 믿는다 (#156).
+  const hidden = sorted.length - MAX_UPCOMING_NOTES
+  if (hidden > 0) {
+    lines.push(`🔜 …외 ${hidden}건 더 있음 (시행 임박순 ${MAX_UPCOMING_NOTES}건만 표시) — 전수는 법제처 eflaw(시행일자별 법령) 조회 필요`)
+  }
   return lines.join("\n") + "\n"
 }
```

---

### Incident Patch 9: `bfe2ad64` (2026-09-05)
**Commit Message**: fix(knowledge-base): 존재하지 않는 target 3건으로 연계 도구 4개가 조용히 0건

법제처는 잘못된 target에 HTTP 200 + 빈 본문을 준다. 존재하지 않는
target을 넣었을 때와 바이트 단위로 같은 응답이라 예외가 나지 않고
[NOT_FOUND]로만 끝나, get_related_laws · get_term_articles ·
get_daily_to_legal · get_legal_to_daily 네 도구가 항상 0건이었다.

- lstrmRel → lawService.do / lstrmRlt (relType은 이 target에 없어 제거)
- lstrmJo  → lawService.do / lstrmRltJo
- lawRel   → lsRlt (엔드포인트 lawSearch.do 유지)

target만 고쳐서는 여전히 0건이다. 올바른 응답은 항목을 한글 래퍼
(<연계용어>/<연계법령>/<관련법령>)에 담는데, 공유 parseKBXML은 항목
태그를 ["lstrm","lstrmAI","law","jo","rel","item"]로 고정한다. 또
<검색결과개수>는 기준 용어·기준 법령의 개수(=1)라 총건수로 쓸 수 없다.
parseKBXML은 정상 동작 중인 다른 도구(get_legal_term_kb ·
get_daily_term · fallbackTermSearch)가 함께 쓰므로 손대지 않고,
고친 4개 함수만 쓰는 파서를 knowledge-base.ts 안에 뒀다.

곁가지로 가지번호 조문 표기를 바로잡았다: 제24의2조 → 제24조의2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FhkqwEfFhpmU5aKnBxc5tN

**File**: `src/tools/knowledge-base.test.ts` (added, +155/-0)
```diff
@@ -0,0 +1,155 @@
+import { describe, it, expect } from "vitest"
+import { getRelatedLaws, getTermArticles, getDailyToLegal, getLegalToDaily } from "./knowledge-base.js"
+import type { LawApiClient } from "../lib/api-client.js"
+
+// 실측 응답 축약. 조회링크 필드는 인증키(OC)가 박혀 있고 파싱 대상도 아니라 뺐다.
+//
+// 세 응답 모두 항목이 한글 래퍼(<관련법령>/<연계법령>/<연계용어>)에 들어 있고,
+// <검색결과개수>는 기준 법령·기준 용어의 개수(=1)이지 연계 항목 수가 아니다.
+
+// lawSearch.do?target=lsRlt&query=건축법
+const RELATED_LAWS_XML = `<?xml version="1.0" encoding="UTF-8"?><lsRltSearch><target>lsRlt</target><키워드>건축법</키워드><검색결과개수>1</검색결과개수>
+<법령 id="1"><기준법령ID>001766</기준법령ID><기준법령명><![CDATA[건축법]]></기준법령명>
+<관련법령 id="1"><관련법령ID>010594</관련법령ID><관련법령명><![CDATA[건축기본법]]></관련법령명><법령간관계코드>140503</법령간관계코드><법령간관계>3유형(기본법)</법령간관계></관련법령>
+<관련법령 id="2"><관련법령ID>001767</관련법령ID><관련법령명><![CDATA[건축법 시행령]]></관련법령명><법령간관계코드>140506</법령간관계코드><법령간관계>6유형(하위법)</법령간관계></관련법령>
+<관련법령 id="3"><관련법령ID>001768</관련법령ID><관련법령명><![CDATA[건축법 시행규칙]]></관련법령명><법령간관계코드>140506</법령간관계코드><법령간관계>6유형(하위법)</법령간관계></관련법령>
+</법령></lsRltSearch>`
+
+// lawService.do?target=lstrmRltJo&query=임대차
+// 조문제목 필드가 따로 없어 조문내용 머리에서 뽑는다. 농지법은 제24조와 제24조의2가 나란히 온다.
+const TERM_ARTICLES_XML = `<?xml version="1.0" encoding="UTF-8"?><lstrmRltJoService><target>lstrmRltJo</target><키워드>임대차</키워드><검색결과개수>1</검색결과개수>
+<법령용어 id="1"><법령용어명>임대차</법령용어명>
+<연계법령 id="1"><법령명><![CDATA[농어촌정비법]]></법령명><조번호>0085</조번호><조가지번호>00</조가지번호><조문내용><![CDATA[제85조(농어촌관광휴양지사업자의 신고 등) ① 농어촌 관광휴양단지사업은 …]]></조문내용><용어구분>핵심용어</용어구분></연계법령>
+<연계법령 id="2"><법령명><![CDATA[농지법]]></법령명><조번호>0024</조번호><조가지번호>00</조가지번호><조문내용><![CDATA[제24조(임대차ㆍ사용대차 계약 방법과 확인) ① 임대차계약과 사용대차계약은 …]]></조문내용><용어구분>핵심용어</용어구분></연계법령>
+<연계법령 id="3"><법령명><![CDATA[농지법]]></법령명><조번호>0024</조번호><조가지번호>02</조가지번호><조문내용><![CDATA[제24조의2(임대차 기간) ① 제23조제1항 각 호(제8호는 제외한다)의 임대차 기간은 3년 이상으로 하여야 한다. …]]></조문내용><용어구분>핵심용어</용어구분></연계법령>
+</법령용어></lstrmRltJoService>`
+
+// lawService.do?target=lstrmRlt&query=임대차
+const RELATED_TERMS_XML = `<?xml version="1.0" encoding="UTF-8"?><lstrmRltService><target>lstrmRlt</target><키워드>임대차</키워드><검색결과개수>1</검색결과개수>
+<법령용어 id="1"><법령용어명>임대차</법령용어명>
+<연계용어 id="1"><일상용어명><![CDATA[반전세]]></일상용어명><용어관계코드>140305</용어관계코드><용어관계>연관어</용어관계></연계용어>
+<연계용어 id="2"><일상용어명><![CDATA[월세]]></일상용어명><용어관계코드>140305</용어관계코드><용어관계>연관어</용어관계></연계용어>
+</법령용어></lstrmRltService>`
+
+// 오타 target에 대한 법제처 응답. HTTP 200 + 빈 본문이라 예외가 안 난다.
+const EMPTY_BODY = ""
+
+type FetchArgs = Parameters<LawApiClient["fetchApi"]>[0]
+
+/** fetchApi 호출 인자를 잡아 두는 스텁 — target/endpoint 회귀를 막는 것이 목적 */
+function recordingStub(xml: string) {
+  const calls: FetchArgs[] = []
+  const client = {
+    fetchApi: async (options: FetchArgs) => {
+      calls.push(options)
+      return xml
+    },
+  } as unknown as LawApiClient
+  return { client, calls }
+}
+
+describe("지식베이스 연계 도구의 법제처 target (#428)", () => {
+  it("get_related_laws는 lawSearch.do의 lsRlt를 부른다", async () => {
+    const { client, calls } = recordingStub(RELATED_LAWS_XML)
+    await getRelatedLaws(client, { lawName: "건축법", display: 20 })
+
+    expect(calls[0].endpoint).toBe("lawSearch.do")
+    expect(calls[0].target).toBe("lsRlt")
+  })
+
+  it("get_term_articles는 lawService.do의 lstrmRltJo를 부른다", async () => {
+    const { client, calls } = recordingStub(TERM_ARTICLES_XML)
+    await getTermArticles(client, { term: "임대차", display: 20 })
+
+    expect(calls[0].endpoint).toBe("lawService.do")
+    expect(calls[0].target).toBe("lstrmRltJo")
+  })
+
+  it("용어 연계 두 도구는 lawService.do의 lstrmRlt를 부른다", async () => {
+    const daily = recordingStub(RELATED_TERMS_XML)
+    await getDailyToLegal(daily.client, { dailyTerm: "월세" })
+    const legal = recordingStub(RELATED_TERMS_XML)
+    await getLegalToDaily(legal.client, { legalTerm: "임대차" })
+
+    for (const calls of [daily.calls, legal.calls]) {
+      expect(calls[0].endpoint).toBe("lawService.do")
+      expect(calls[0].target).toBe("lstrmRlt")
+    }
+  })
+
+  it("lstrmRlt에 없는 relType은 보내지 않는다", async () => {
+    const { client, calls } = recordingStub(RELATED_T
```

**File**: `src/tools/knowledge-base.ts` (modified, +100/-35)
```diff
@@ -11,6 +11,68 @@ import { formatToolError, noResultHint } from "../lib/errors.js"
 // - 관련법령 조회
 // ============================================================================
 
+// ----------------------------------------------------------------------------
+// 연계 API(lstrmRlt / lstrmRltJo / lsRlt) 전용 파서
+//
+// 이 세 응답은 항목을 한글 래퍼(<연계용어>/<연계법령>/<관련법령>)에 담고 필드명도
+// 다르다. 공유 parseKBXML은 항목 태그를 ["lstrm","lstrmAI","law","jo","rel","item"]로
+// 고정하므로 여기서는 언제나 0건이 된다. parseKBXML은 정상 동작 중인 다른 도구
+// (get_legal_term_kb·get_daily_term·fallbackTermSearch)가 함께 쓰므로 손대지 않고,
+// 이 파일의 연계 도구 4개만 쓰는 파서를 둔다.
+//
+// <검색결과개수>는 기준 용어·기준 법령의 개수(항상 1)이지 연계 항목 수가 아니라
+// 총건수로 쓸 수 없다. 파싱한 항목 수를 총건수로 쓴다.
+// ----------------------------------------------------------------------------
+interface RelationItem {
+  법령명?: string
+  법령ID?: string
+  관계유형?: string
+  조문번호?: string
+  조문표기?: string
+  조문제목?: string
+  연계용어명?: string
+}
+
+function parseRelationXML(
+  xml: string,
+  itemTag: string,
+  mapItem: (content: string) => RelationItem | null,
+  limit?: number
+): RelationItem[] {
+  const items: RelationItem[] = []
+  const itemRegex = new RegExp(`<${itemTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${itemTag}>`, "g")
+
+  for (const match of xml.matchAll(itemRegex)) {
+    const item = mapItem(match[1])
+    if (!item) continue
+
+    items.push(item)
+    if (limit && items.length >= limit) break
+  }
+
+  return items
+}
+
+/** <연계용어> 항목. 일상↔법령 양방향이 같은 target(lstrmRlt)을 쓰므로 공통이다. */
+function mapRelatedTerm(content: string): RelationItem | null {
+  const name = extractTag(content, "일상용어명") || extractTag(content, "법령용어명")
+  return name ? { 연계용어명: name } : null
+}
+
+/**
+ * 조번호 "0024" + 조가지번호 "02" → "제24조의2"
+ * 가지번호를 조 앞에 붙인 "제24의2조"는 존재하지 않는 조문 표기다.
+ */
+function formatArticleLabel(content: string): { 조문번호: string; 조문표기: string } {
+  const articleNumber = Number.parseInt(extractTag(content, "조번호") || "0", 10)
+  if (!articleNumber) return { 조문번호: "", 조문표기: "" }
+
+  const branchNumber = Number.parseInt(extractTag(content, "조가지번호") || "0", 10)
+  return branchNumber > 0
+    ? { 조문번호: `${articleNumber}의${branchNumber}`, 조문표기: `제${articleNumber}조의${branchNumber}` }
+    : { 조문번호: String(articleNumber), 조문표기: `제${articleNumber}조` }
+}
+
 // 1. 법령용어 지식베이스 조회 (lstrmAI)
 export const getLegalTermKBSchema = z.object({
   query: z.string().describe("검색할 법령용어"),
@@ -185,17 +247,15 @@ export async function getDailyToLegal(
     let xmlText: string;
     try {
       xmlText = await apiClient.fetchApi({
-        endpoint: "lawSearch.do",
-        target: "lstrmRel",
-        extraParams: { query: args.dailyTerm, relType: "DL" },
+        endpoint: "lawService.do",
+        target: "lstrmRlt",
+        extraParams: { query: args.dailyTerm },
         apiKey: args.apiKey,
       });
     } catch {
       return await fallbackTermSearch(apiClient, args.dailyTerm, "일상용어");
     }
-    const result = parseKBXML(xmlText, "LsTrmRelSearch");
-
-    const items = result.data || [];
+    const items = parseRelationXML(xmlText, "연계용어", mapRelatedTerm);
 
     if (items.length === 0) {
       return await fallbackTermSearch(apiClient, args.dailyTerm, "일상용어");
@@ -206,7 +266,7 @@ export async function getDailyToLegal(
     output += `관련 법령용어:\n`;
 
     for (const item of items) {
-      output += `   • ${item.법령용어명 || item.연계용어명}\n`;
+      output += `   • ${item.연계용어명}\n`;
     }
 
     return { content: [{ type: "text", text: truncateResponse(output) }] };
@@ -231,17 +291,15 @@ export async function getLegalToDaily(
     let xmlText: string;
     try {
       xmlText = await apiClient.fetchApi({
-        endpoint: "lawSearch.do",
-        target: "lstrmRel",
-        extraParams: { query: args.legalTerm, relType: "LD" },
+        endpoint: "lawService.do",
+        target: "lstrmRlt",
+        extraParams: { query: args.legalTerm },
         apiKey: args.apiKey,
       });
     } catch {
       return await fallbackTermSearch(apiClient, args.legalTerm, "법령용어");
     
```

---

### Incident Patch 10: `7e3aad7d` (2026-08-29)
**Commit Message**: fix(historical-law): 조문단위 래퍼를 풀지 못해 조문이 통째로 안 잡히던 문제 (#153 곁가지 2)

get_historical_law가 조문 목록을 "제undefined조" 한 줄로만 냈다. law.조문을 조문
객체의 배열로 읽는데 페이로드는 법령.조문.조문단위[]로 한 겹 더 감싸는 구조라,
배열 길이가 1(래퍼 자신)이 되고 조문번호가 undefined로 샜다. verify-citations와
applicable-law는 이미 조문단위를 읽고 있었다 — 이 도구만 어긋나 있었다.

같은 조회 경로에서 함께 드러난 결함 둘을 같이 고친다.

1. 조문단위에는 장·절 헤더가 조문여부="전문"으로 섞여 온다(2026-08-29 실측
   아동복지법 MST 285697: 123개 중 12개). 조문으로 세면 개수와 목록이 함께
   오염되므로 조문만 남긴다.
2. 조문 본문은 조문내용이 아니라 항·호에 있다(조문내용은 "제75조(과태료)" 제목줄
   뿐). 항을 안 펴면 본문이 통째로 빠지므로, 그 결합의 단일 원본인
   formatArticleUnit(law-text·article-detail 공통)을 그대로 쓴다.
3. parseJoNumber는 "75"/"75의2" 꼴을 돌려주는데 페이로드는 조문번호와
   조문가지번호로 나눠 온다 — 합쳐진 문자열끼리 비교해 가지번호 조문이 늘
   NOT_FOUND였다.

실서버 확인(2026-08-29, MST 285697): 조문 111개 정상 출력, 제75조 조회 시 항·호
본문까지 회수. 기존 테스트 픽스처는 조문을 배열로 주는 옛 형상이라 실형상
(조문단위 + 조문여부)으로 교체하고 회귀 5건을 더했다.

Refs #153

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M3YytZu15y71H2jV7XonAQ

**File**: `src/tools/historical-law.test.ts` (modified, +52/-9)
```diff
@@ -2,8 +2,9 @@ import { describe, it, expect } from "vitest"
 import { getHistoricalLaw } from "./historical-law.js"
 import type { LawApiClient } from "../lib/api-client.js"
 
-// 실제 eflaw JSON 축약 — 법령명은 "법령명_한글" 키, 소관부처는 {content} 객체로 온다
-// (라이브 스모크에서 "법령명: N/A" + "소관부처: [object Object]" 노출로 발견된 실형상)
+// 실제 lawService(target=law) JSON 축약 — 법령명은 "법령명_한글" 키, 소관부처는 {content} 객체,
+// 조문은 법령.조문.조문단위[]로 **한 겹 감싸서** 온다(2026-08-29 실측 아동복지법 MST 285697).
+// 장·절 헤더는 같은 배열에 조문여부="전문"으로 섞이고, 조문 본문은 조문내용이 아니라 항·호에 있다.
 const HIST_JSON = JSON.stringify({
   법령: {
     기본정보: {
@@ -14,18 +15,24 @@ const HIST_JSON = JSON.stringify({
       제개정구분명: "일부개정",
       소관부처: { content: "법무부", 소관부처코드: "1270000" },
     },
-    조문: [
-      { 조문번호: "1", 조문제목: "목적", 조문내용: ["제1조(목적)", "이 법은 상사에 관하여…"] },
-    ],
+    조문: {
+      조문단위: [
+        { 조문번호: "1", 조문여부: "전문", 조문내용: "        제1편 총칙" },
+        { 조문번호: "1", 조문여부: "조문", 조문제목: "목적", 조문내용: ["제1조(목적)", "이 법은 상사에 관하여…"] },
+        {
+          조문번호: "2", 조문가지번호: "3", 조문여부: "조문", 조문제목: "적용범위",
+          조문내용: "제2조의3(적용범위)",
+          항: [{ 항번호: "①", 항내용: "① 이 법은 상행위에 적용한다." }],
+        },
+      ],
+    },
   },
 })
 
+const client = { fetchApi: async () => HIST_JSON } as unknown as LawApiClient
+
 describe("getHistoricalLaw — JSON 객체 필드 안전 문자열화", () => {
   it("소관부처 객체·법령명_한글 키·조문내용 배열을 훼손 없이 출력", async () => {
-    const client = {
-      fetchApi: async () => HIST_JSON,
-    } as unknown as LawApiClient
-
     const r = await getHistoricalLaw(client, { mst: "273629" })
     const t = r.content[0].text
     expect(t).toContain("법령명: 상법")          // 종전엔 N/A
@@ -34,3 +41,39 @@ describe("getHistoricalLaw — JSON 객체 필드 안전 문자열화", () => {
     expect(t).not.toContain("[object Object]")
   })
 })
+
+// 회귀 (#153 곁가지 2): law.조문을 조문 객체의 배열로 읽어 조문단위 래퍼 하나만 잡히면서
+// 조문 목록이 "제undefined조" 한 줄로 무너졌다.
+describe("getHistoricalLaw — 조문단위 래퍼를 풀어 읽는다 (#153)", () => {
+  it("조문번호가 undefined로 새지 않고 실제 조문이 잡힌다", async () => {
+    const t = (await getHistoricalLaw(client, { mst: "273629" })).content[0].text
+    expect(t).not.toContain("undefined")
+    expect(t).toContain("제1조 (목적)")
+  })
+
+  it("조문여부=전문(장·절 헤더)은 조문 수에서 제외한다", async () => {
+    const t = (await getHistoricalLaw(client, { mst: "273629" })).content[0].text
+    expect(t).toContain("조문 (총 2개)")           // 전문 1건을 세면 3개가 된다
+    expect(t).not.toContain("제1편 총칙")
+  })
+
+  it("가지번호 조문은 '제2조의3'으로 표시하고 항 본문까지 편다", async () => {
+    const t = (await getHistoricalLaw(client, { mst: "273629" })).content[0].text
+    expect(t).toContain("제2조의3 (적용범위)")
+    expect(t).toContain("이 법은 상행위에 적용한다")  // 조문내용은 제목줄뿐 — 항을 안 펴면 빈다
+  })
+
+  it("jo 지정 조회가 가지번호까지 맞춰 찾는다", async () => {
+    const t = (await getHistoricalLaw(client, { mst: "273629", jo: "제2조의3" })).content[0].text
+    expect(t).toContain("제목: 적용범위")
+    expect(t).toContain("이 법은 상행위에 적용한다")
+    expect(t).not.toContain("[NOT_FOUND]")
+  })
+
+  it("없는 조문은 NOT_FOUND와 함께 실제 조문 목록을 안내한다", async () => {
+    const t = (await getHistoricalLaw(client, { mst: "273629", jo: "제99조" })).content[0].text
+    expect(t).toContain("[NOT_FOUND]")
+    expect(t).toContain("- 제1조 목적")
+    expect(t).toContain("- 제2조의3 적용범위")
+  })
+})
```

**File**: `src/tools/historical-law.ts` (modified, +30/-11)
```diff
@@ -2,7 +2,7 @@ import { z } from "zod";
 import type { LawApiClient } from "../lib/api-client.js";
 import { truncateResponse, formatDateDot } from "../lib/schemas.js";
 import { formatToolError } from "../lib/errors.js";
-import { cleanHtml, flattenContent } from "../lib/article-parser.js";
+import { flattenContent, formatArticleUnit } from "../lib/article-parser.js";
 
 /** JSON 필드 안전 문자열화 — 객체/배열이 와도 "[object Object]"를 만들지 않는다 */
 function safeText(v: unknown): string {
@@ -17,6 +17,13 @@ function safeText(v: unknown): string {
   return String(v);
 }
 
+/** 조문 표시명 — 가지번호가 있으면 "제5조의2" */
+function joLabel(a: any): string {
+  const branch = String(a?.조문가지번호 || "0");
+  const num = safeText(a?.조문번호 || a?.조번호);
+  return branch !== "0" ? `제${num}조의${branch}` : `제${num}조`;
+}
+
 /**
  * 법령 연혁 조회 도구
  * - lsHistory API (HTML만 지원) 사용
@@ -155,37 +162,49 @@ export async function getHistoricalLaw(
     output += `  소관부처: ${safeText(basic.소관부처명 || basic.소관부처) || "N/A"}\n\n`;
 
     // Extract articles
-    const rawArticles = law.조문;
-    const articles = rawArticles == null ? [] : Array.isArray(rawArticles) ? rawArticles : [rawArticles];
+    // 페이로드는 법령.조문.조문단위[]로 한 겹 감싼 구조다 (verify-citations·applicable-law가
+    // 읽는 형태와 동일). law.조문을 조문 객체의 배열로 읽으면 래퍼 하나만 잡혀 길이 1이 되고
+    // 조문번호가 undefined로 나온다 — "제undefined조" 한 줄이 조문 목록 전부였다 (#153 곁가지 2).
+    const rawArticles = law.조문?.조문단위 ?? law.조문;
+    const units = rawArticles == null ? [] : Array.isArray(rawArticles) ? rawArticles : [rawArticles];
+    // 조문단위에는 장·절 헤더가 조문여부="전문"으로 섞여 온다 (실측 아동복지법 MST 285697:
+    // 123개 중 12개). 조문으로 세면 개수와 목록이 함께 오염된다.
+    const articles = units.filter((a: any) => a?.조문여부 === "조문");
     if (articles.length > 0) {
       if (args.jo) {
         // Filter to specific article
-        const joCode = parseJoNumber(args.jo);
+        // parseJoNumber는 "75"/"75의2" 꼴을 돌려주고, 페이로드는 조문번호와 조문가지번호로
+        // 나눠 온다 — 합쳐진 문자열끼리 비교하면 가지번호 조문이 늘 NOT_FOUND가 된다.
+        const [wantNum, wantBranch = "0"] = parseJoNumber(args.jo).split("의");
         const article = articles.find((a: any) => {
-          const articleJo = a.조문번호 || a.조번호 || "";
-          return articleJo === joCode || String(articleJo) === joCode;
+          const num = String(a.조문번호 ?? a.조번호 ?? "");
+          const branch = String(a.조문가지번호 || "0");
+          return num === wantNum && branch === wantBranch;
         });
 
         if (article) {
+          // 조문내용에는 "제75조(과태료)" 제목줄만 들어 있고 본문은 항·호·목에 있다.
+          // formatArticleUnit이 그 결합의 단일 원본이다 (law-text·article-detail 공통).
+          const formatted = formatArticleUnit(article);
           output += `${args.jo}:\n`;
           if (article.조문제목) output += `제목: ${safeText(article.조문제목)}\n`;
-          output += `${cleanHtml(safeText(article.조문내용)) || "내용 없음"}\n`;
+          output += `${formatted?.body || "내용 없음"}\n`;
         } else {
           output += `[NOT_FOUND] ${args.jo}를 찾을 수 없습니다.\n⚠️ LLM은 조문을 추측/생성하지 마세요.\n`;
           output += `\n조문 목록:\n`;
           for (const a of articles.slice(0, 20)) {
-            output += `  - 제${a.조문번호 || a.조번호}조 ${a.조문제목 || ""}\n`;
+            output += `  - ${joLabel(a)} ${safeText(a.조문제목)}\n`;
           }
         }
       } else {
         // Show all articles (limited)
         output += `조문 (총 ${articles.length}개):\n\n`;
         for (const article of articles.slice(0, 30)) {
-          const joNum = safeText(article.조문번호 || article.조번호);
+          const formatted = formatArticleUnit(article);
           const title = safeText(article.조문제목);
-          const content = cleanHtml(safeText(article.조문내용));
+          const content = formatted?.body || "";
 
-          output += `제${joNum}조`;
+          output += joLabel(article);
           if (title) output += ` (${title})`;
           output += `\n`;
           if (content) {
```

#### Recent Merged Pull Requests:
- **PR #162** (2026-09-22): feat(admin-rule): get_admin_rule 부분 조회(jo·chapter·keyword·page) + 신구대조 제·개정이유 폴백 (@cpasongc)
- **PR #155** (2026-09-05): fix(knowledge-base): 존재하지 않는 법제처 target 3건으로 연계 도구 4개가 조용히 0건 (@yoonkhsc)
- **PR #154** (2026-08-29): fix(api-client): eflaw HTML 에러 페이지도 target=law 폴백에 도달하도록 (#153) (@Rillmo)
- **PR #152** (2026-08-19): fix: 분리시행 슬라이스 dedup 소실 + eflaw MST 단독 조회 빈 봉투 폴백 (@herrozim-ship-it)
- **PR #151** (2026-08-20): fix(readme): 더 이상 표시되지 않는 Star History 차트 수정 (@Dessalines39394)
- **PR #150** (2026-08-16): mcp: 미스 지연·라우팅·별표·인용 검증 통합 배치 — 이슈 62건 (#88~#149) (@humdrum00001010)
- **PR #85** (2026-08-16): security: harden request and release boundaries (@humdrum00001010)
- **PR #76** (closed): docs: add a live MCP status badge (@ProjectBay)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
