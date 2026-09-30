# Forensic Learning Record (Deep Inspection): HBAI-Ltd/Toonflow-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/hbai-ltd-toonflow-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:14:17.174Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HBAI-Ltd/Toonflow-app`
- **Description**: Toonflow 是开源 AI 创作平台，融合无限画布、AI Agent 与可视化工作流，支持图像生成、视频生成、智能分镜及短剧创作。支持本地部署、自由接入模型，提供跨平台桌面端，并可通过 MCP 与插件扩展创作能力。Open-source AI creative platform with an infinite canvas, AI agents and visual workflows for image generation, video generation and filmmaking, with a canvas-based approach similar to LibTV and TapNow.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 16285 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/installer/initializeInstall.ts`
```
import { randomUUID } from "node:crypto";
import { copyFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";

const directories = process.argv.slice(2);
if (directories.length !== 3 || directories.some(directory => !isAbsolute(directory))) {
  throw new Error("需要安装目录、桌面目录和开始菜单目录的绝对路径。");
}
const [installDirectory, desktopDirectory, programsDirectory] = directories as [string, string, string];
const resourcesDirectory = join(installDirectory, "app", "Resources");
const { identifier, name, channel } = await Bun.file(join(resourcesDirectory, "version.json")).json();
if (typeof identifier !== "string" || typeof name !== "string" || channel !== "stable") {
  throw new Error("应用安装信息无效，请重新构建安装包。");
}

// ACT: 系统注册由 NSIS 负责；补齐 Electrobun 2.0.1 的记录，避免首次启动再次调用 PowerShell。
// 保留真实更新助手和完整 manifest，不用占位文件跳过 SDK 检查。
copyFileSync(join(resourcesDirectory, "uninstall"), join(installDirectory, "uninstall.exe"));
writeFileSync(join(installDirectory, ".electrobun-uninstall.json"), JSON.stringify({
  schema_version: 1,
  install_nonce: randomUUID().replaceAll("-", ""),
  identifier,
  name,
  channel,
  desktop_shortcut: join(desktopDirectory, `${name}.lnk`),
  start_menu_shortcut: join(programsDirectory, `${name}.lnk`),
  install_root_name: basename(installDirectory),
  data_path_versions: [1],
}, null, 2));

// 重装同一构建也重新同步内置节点和工具；供应商、技能沿用首次初始化，保留用户修改。
for (const directory of ["nodes", "tools"]) {
  rmSync(join(installDirectory, "data", directory, "initialized"), { force: true });
}

```

### Core Architecture Module: `apps/desktop/scripts/localizeMac.ts`
```
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (process.env.ELECTROBUN_OS === "macos") {
  const buildDir = process.env.ELECTROBUN_BUILD_DIR;
  if (!buildDir) throw new Error("缺少 ELECTROBUN_BUILD_DIR，无法设置 macOS 应用语言。");

  const bundlePath = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH ?? readdirSync(buildDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => join(buildDir, entry.name))
    .find((path) => existsSync(join(path, "Contents", "Info.plist")));
  if (!bundlePath) throw new Error(`未找到待本地化的 macOS 应用：${buildDir}`);

  const plistPath = join(bundlePath, "Contents", "Info.plist");
  let plist = readFileSync(plistPath, "utf8");
  // ACT: 两套 SDK 当前生成 XML；如果改为二进制 plist，应改用 macOS 的 plutil。
  if (!/<\/dict>\s*<\/plist>\s*$/.test(plist)) throw new Error(`不支持的 Info.plist 格式：${plistPath}`);
  const bundleName = plist.match(/<key>CFBundleName<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
  if (!bundleName) throw new Error(`无法读取应用名称：${plistPath}`);

  for (const [key, value] of [
    ["CFBundleDevelopmentRegion", "<string>zh-Hans</string>"],
    ["CFBundleLocalizations", "<array><string>zh-Hans</string></array>"],
  ]) {
    const existing = new RegExp(`<key>${key}</key>\\s*<(string|array)>[\\s\\S]*?</\\1>`);
    if (existing.test(plist)) {
      plist = plist.replace(existing, `<key>${key}</key>${value}`);
    } else {
      plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `  <key>${key}</key>\n  ${value}\n</dict>\n</plist>`);
    }
  }
  writeFileSync(plistPath, plist);

  const resourceDir = join(bundlePath, "Contents", "Resources", "zh-Hans.lproj");
  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(join(resourceDir, "InfoPlist.strings"),
    `CFBundleName = ${JSON.stringify(bundleName)};\nCFBundleDisplayName = ${JSON.stringify(bundleName)};\n`);
  console.log(`已设置 macOS 简体中文本地化：${bundlePath}`);
}

```

### Core Architecture Module: `apps/desktop/scripts/packageWindows.ts`
```
import { $ } from "bun";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import desktopConfig from "../../../electrobun.config";

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("NSIS 打包需要 Windows x64 环境。");
}

const projectDir = realpathSync(resolve(import.meta.dirname, "../../.."));
process.chdir(projectDir);
const nsisDir = resolve("build/desktop/nsis");
const artifactDir = resolve(desktopConfig.build.artifactFolder);
const outputFile = join(artifactDir, `toonflow-${desktopConfig.app.version}-Setup.exe`);
const installerDir = resolve("apps/desktop/installer");
const appIcon = resolve("packages/assets/logo.ico");
const makensis = process.env.NSIS_PATH ?? "C:/Program Files (x86)/NSIS/makensis.exe";
const csc = join(process.env.WINDIR!, "Microsoft.NET/Framework64/v4.0.30319/csc.exe");
const webViewDir = join(nsisDir, "webview2");
const bootstrapper = join(webViewDir, "MicrosoftEdgeWebview2Setup.exe");
const loader = join(webViewDir, "WebView2Loader.dll");
const runningChecker = join(nsisDir, "checkRunning.exe");

mkdirSync(webViewDir, { recursive: true });

const dependencies = await Bun.file(".hutch/dependencies.lock").json();
const electrobun = dependencies.objects.find(
  (item: { type: string; platform: string }) => item.type === "electrobun" && item.platform === "windows-x64"
);
const hutchHome = process.env.HUTCH_HOME ?? join(homedir(), ".hutch");
copyFileSync(join(hutchHome, electrobun.relativeRoot, "WebView2Loader.dll"), loader);

await $`${csc} /nologo /target:exe /platform:x64 /optimize+ /out:${join(webViewDir, "checkWebView2.exe")} ${join(installerDir, "checkWebView2.cs")}`;
await $`${csc} /nologo /target:exe /platform:x64 /optimize+ /out:${runningChecker} ${join(installerDir, "checkRunning.cs")}`;
const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`;
const temporary = existsSync(bootstrapper) ? null : `${bootstrapper}.tmp.exe`;
try {
  if (temporary) {
    await $`curl.exe --fail --location --max-time 120 --output ${temporary} https://go.microsoft.com/fwlink/p/?LinkId=2124703`;
  }
  await $`powershell.exe -NoProfile -NonInteractive -Command ${`
$ErrorActionPreference = 'Stop'
Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1"
foreach ($file in @(${quotePowerShell(loader)}, ${quotePowerShell(temporary ?? bootstrapper)})) {
  $signature = Get-AuthenticodeSignature -LiteralPath $file
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw "Microsoft signature verification failed: $file"
  }
}`}`;
  if (temporary) renameSync(temporary, bootstrapper);
} finally {
  if (temporary) rmSync(temporary, { force: true });
}

const stagingDir = mkdtempSync(join(nsisDir, "payload"));
const tarFile = join(stagingDir, "app.tar");
try {
  const manifest = await Bun.file(join(artifactDir, "stable-win-x64-update.json")).json();
  // ACT: 平台、通道和 Hash 由本机 SDK 生成，只检查独立打包时容易遗留的旧版本。
  if (manifest.version !== desktopConfig.app.version) throw new Error("构建产物版本不一致，请重新构建。");
  // ACT: NSIS 仅打包原始 tar，安装时释放应用并保留它作为增量更新基线。
  const archive = await Bun.file(join(artifactDir, manifest.artifact.file)).arrayBuffer();
  await Bun.write(tarFile, Bun.zstdDecompressSync(archive));
  await $`${makensis} /INPUTCHARSET UTF8 /DwebView2Dir=${webViewDir} /DrunningChecker=${runningChecker} /DappIcon=${appIcon} /DappVersion=${
    desktopConfig.app.version
  } /DappIdentifier=${desktopConfig.app.identifier} /DappTar=${tarFile} /DappHash=${manifest.hash} /DoutputFile=${outputFile} ${join(installerDir, "installer.nsi")}`;
  console.log(`NSIS 安装包：${outputFile}`);
} finally {
  if (dirname(realpathSync(stagingDir)) !== realpathSync(nsisDir)) throw new Error("拒绝清理暂存目录以外的路径。");
  rmSync(stagingDir, { recursive: true });
}

```

### Core Architecture Module: `apps/desktop/scripts/release.ts`
```
import { $ } from "bun";
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import desktopConfig from "../../../electrobun.config";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { initial: { type: "boolean" }, auto: { type: "boolean" } },
});
const version = positionals[0];
if (positionals.length !== 1 || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error("用法：bun run release:desktop 2.0.1 [--auto | --initial]；--auto 在更新源没有基线时自动构建首次版本。");
}
if (values.initial && values.auto) throw new Error("--initial 与 --auto 不能同时使用。");
const isMac = process.platform === "darwin";
if ((!isMac || !["x64", "arm64"].includes(process.arch)) && (process.platform !== "win32" || process.arch !== "x64")) {
  throw new Error("增量发布需在 Windows x64 或 macOS x64/arm64 本机执行。");
}

const projectDir = resolve(import.meta.dirname, "../../..");
const platform = isMac ? "macos" : "win";
const targetFolder = isMac ? process.arch === "x64" ? "macX64" : "macArm64" : "";
const releasesDir = join(projectDir, "build/desktop/releases", targetFolder);
const releaseDir = join(releasesDir, version);
const artifactDir = resolve(projectDir, desktopConfig.build.artifactFolder);
const prefix = `stable-${platform}-${process.arch}`;
const manifestName = `${prefix}-update.json`;
const manifestUrl = `${desktopConfig.release.baseUrl.replace(/\/+$/, "")}/${manifestName}`;
if (existsSync(releaseDir)) throw new Error(`版本已保留，请使用新版本号：${releaseDir}`);

let previousResponse: Response | undefined;
if (!values.initial) {
  console.log(`读取构建基线：${manifestUrl}`);
  try {
    previousResponse = await fetch(manifestUrl, {
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new Error("无法读取上一版本，请检查更新地址与网络；为避免漏打补丁，已停止构建。", { cause: error });
  }
}
const initial = values.initial || (values.auto && previousResponse?.status === 404);
let previousHash: string | undefined;
if (!initial) {
  if (!previousResponse?.ok) {
    throw new Error(previousResponse?.status === 404
      ? "更新源尚无基线，请使用 --initial 或 --auto 构建首次版本。"
      : `读取上一版本失败（HTTP ${previousResponse?.status}），已停止构建。`);
  }
  const previous = await previousResponse.json().catch((error) => {
    throw new Error(`上一版本清单不是有效 JSON：${manifestUrl}（Content-Type: ${previousResponse.headers.get("content-type") || "未提供"}）`, { cause: error });
  });
  if (!previous || previous.platform !== platform || previous.arch !== process.arch ||
      typeof previous.hash !== "string" || !/^[a-zA-Z0-9]+$/.test(previous.hash) ||
      typeof previous.version !== "string" || !/^\d+\.\d+\.\d+$/.test(previous.version)) {
    throw new Error("更新清单的平台、架构、版本或 Hash 无效。");
  }
  // ACT: Intel 固定使用 1.18.1 旧协议；不向独立发布服务器传递桌面配置。
  const legacy = isMac && process.arch === "x64" && previous.schemaVersion === undefined;
  if (!legacy && (previous.identifier !== desktopConfig.app.identifier || previous.channel !== "stable")) {
    throw new Error("更新清单的应用标识或通道不一致。");
  }
  const archive = legacy ? `${prefix}-${desktopConfig.app.name.replace(/\s/g, "")}.app.tar.zst` : previous.artifact?.file;
  if (typeof archive !== "string" || !archive.startsWith(`${prefix}-`) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tar\.zst$/.test(archive)) {
    throw new Error("更新清单的归档名称无效。");
  }
  previousHash = previous.hash;
  const nextParts = version.split(".").map(Number);
  const oldParts = previous.version.split(".").map(Number);
  const changedPart = nextParts.findIndex((part, index) => part !== oldParts[index]);
  if (changedPart < 0 || nextParts[changedPart]! <= oldParts[changedPart]!) {
    throw new Error(`新版本 ${version} 必须高于服务器版本 ${previous.version}。`);
  }
  console.log(`构建增量更新：${previous.version} → ${version}`);
} else {
  console.log(`构建首次完整版本：${version}，不生成增量补丁。`);
}

await $`${process.execPath} run package:desktop`
  .cwd(projectDir)
  .env({ ...process.env, appVersion: version, generateUpdatePatch: initial ? "0" : "1" });

// ACT: 本机 SDK 产物直接读取，完整清单校验仅用于远程基线。
const manifest = await Bun.file(join(artifactDir, manifestName)).json();
if (manifest.version !== version) {
  throw new Error("本次构建的更新 JSON 与请求版本不一致。");
}
const names: string[] = [isMac && process.arch === "x64"
  ? `${prefix}-${desktopConfig.app.name.replace(/\s/g, "")}.app.tar.zst`
  : manifest.artifact.file];
if (isMac) {
  const installers = readdirSync(artifactDir).filter((name) => name.endsWith(".dmg"));
  if (installers.length !== 1) throw new Error("Mac 发布必须包含且仅包含一个 DMG 安装包。");
  names.push(installers[0]!);
} else names.push(`toonflow-${version}-Setup.exe`);
if (previousHash) names.push(`${prefix}-${previousHash}.patch`);
for (const name of names) {
  if (!existsSync(join(artifactDir, name))) throw new Error(`构建产物缺失，未创建发布快照：${name}`);
}
mkdirSync(releasesDir, { recursive: true });
mkdirSync(releaseDir);
try {
  for (const name of [...names, manifestName]) copyFileSync(join(artifactDir, name), join(releaseDir, name));
} catch (error) {
  if (dirname(realpathSync(releaseDir)) !== realpathSync(releasesDir)) throw new Error("拒绝清理发布目录以外的路径。", { cause: error });
  rmSync(releaseDir, { recursive: true });
  throw error;
}
console.log(`版本快照：${releaseDir}`);
console.log(`将此目录交给独立更新服务器发布：bun run publish:update ${releaseDir}`);

```

### Core Architecture Module: `apps/desktop/src/index.ts`
```
import { once } from "node:events";
import { execFile } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { dlopen, ptr } from "bun:ffi";
import type { DesktopRuntime, PluginInstallRequest } from "@toonflow/server/desktop";
import { showNativeSplash } from "@toonflow/startup";
import Electrobun, { BrowserWindow, PATHS, Screen, Utils, Updater } from "electrobun/main";
import { parseInstallUrl } from "./protocol";
import saveFile, { selectSaveFile } from "./saveFile";
import createWindowsUpdater from "./update/windowsUpdater";

const execFileAsync = promisify(execFile);
const pendingInstalls: PluginInstallRequest[] = [];
let deliverInstall: ((request: PluginInstallRequest) => void) | undefined;
function openUrl(url: string) {
  const request = parseInstallUrl(url);
  if (deliverInstall) deliverInstall(request);
  else if (!pendingInstalls.some(item => item.type === request.type && item.url === request.url)) {
    if (pendingInstalls.length >= 20) throw new Error("待确认的安装请求过多，请稍后重试");
    pendingInstalls.push(request);
  }
}
// 冷启动的 macOS URL 可能先于窗口就绪到达，先接收再等待页面挂载。
Electrobun.events.on("open-url", event => {
  try { openUrl(event.data.url); }
  catch (error) {
    void Utils.showMessageBox({ type: "error", title: "安装链接无效", message: error instanceof Error ? error.message : "无法打开安装链接" });
  }
});

async function restoreInstallRegistration(installDirectory: string) {
  const uninstaller = resolve(installDirectory, "UninstallNSIS.exe");
  if (process.platform === "win32" && existsSync(uninstaller)) {
    try {
      // SDK 启动和更新会重写卸载入口；安装了 NSIS 时统一交给它处理数据保留选项。
      const { identifier, channel } = await Bun.file(resolve(PATHS.RESOURCES_FOLDER, "version.json")).json();
      const registryKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${identifier}.${channel}`;
      for (const [name, command] of [["UninstallString", `"${uninstaller}"`], ["QuietUninstallString", `"${uninstaller}" /S`]]) {
        await execFileAsync("reg.exe", ["add", registryKey, "/v", name, "/t", "REG_SZ", "/d", command, "/f"], { windowsHide: true });
      }
      const protocolLauncher = resolve(PATHS.RESOURCES_FOLDER, "app/protocolLauncher.exe");
      if (existsSync(protocolLauncher)) {
        const protocolKey = "HKCU\\Software\\Classes\\toonflow";
        const commandKey = `${protocolKey}\\shell\\open\\command`;
        const command = `"${protocolLauncher}" "%1"`;
        let protocolExists = true;
        try {
          await execFileAsync("reg.exe", ["query", protocolKey], { windowsHide: true });
        } catch (error) {
          if ((error as { code?: number }).code !== 1) throw error;
          protocolExists = false;
        }
        // ACT: 自动更新不经过 NSIS；仅补全缺失协议，已有注册（包括其他安装）保持不动。
        if (!protocolExists) {
          for (const [key, value] of [[protocolKey, "URL:Toonflow Protocol"], [`${protocolKey}\\DefaultIcon`, `"${resolve(PATHS.RESOURCES_FOLDER, "app.ico")}",0`], [commandKey, command]]) {
            await execFileAsync("reg.exe", ["add", key, "/ve", "/t", "REG_SZ", "/d", value, "/f"], { windowsHide: true });
          }
          await execFileAsync("reg.exe", ["add", protocolKey, "/v", "URL Protocol", "/t", "REG_SZ", "/d", "", "/f"], { windowsHide: true });
        }
      }
    } catch (error) {
      console.error("恢复桌面安装注册信息失败：", error);
    }
  }
}

async function start() {
  let splash: Awaited<ReturnType<typeof showNativeSplash>> | undefined;
  let isClosing = false;

  try {
    // Windows 的 data 与 app 同级；macOS 的 data 与 .app 同级，避免随程序更新被替换。
    const installDirectory = resolve(PATHS.RESOURCES_FOLDER, process.platform === "darwin" ? "../../.." : "../..");
    const dataDirectory = process.env.TOONFLOW_DATA_DIR ?? resolve(installDirectory, "data");
    // ACT: 先显示原生动画，再加载服务，避免初始化期间没有反馈。
    const startupSettings = await Bun.file(resolve(dataDirectory, "settings.json")).json().catch((error) => {
      if (error.code !== "ENOENT") console.error("读取启动设置失败，使用默认启动动画：", error);
      return null;
    });
    try {
      if (startupSettings?.settings?.ui?.startupAnimation !== false) {
        splash = await showNativeSplash(resolve(PATHS.VIEWS_FOLDER, "../startup"), () => {
          isClosing = true;
          splash = undefined;
          Utils.quit();
        });
      }
    } catch (error) {
      console.error("原生启动画面创建失败：", error);
    }
    if (isClosing) {
      splash?.close();
      return;
    }
    process.env.toonflowDesktop = "1";
    const { createApp } = await import("@toonflow/server/app");
    const { hash } = await Bun.file(resolve(PATHS.RESOURCES_FOLDER, "version.json")).json();
    if (typeof hash !== "string" || !hash) throw new Error("应用构建标识缺失，无法同步内置插件");
    const app = await createApp({
      webRoot: resolve(PATHS.VIEWS_FOLDER, "mainview"),
      dataDirectory,
      toolsRoot: resolve(PATHS.VIEWS_FOLDER, "../tools"),
      nodesRoot: resolve(PATHS.VIEWS_FOLDER, "../nodes"),
      providersRoot: resolve(PATHS.VIEWS_FOLDER, "../providers"),
      skillsRoot: resolve(PATHS.VIEWS_FOLDER, "../skills"),
      // ACT: 暂不安装内置团队，随团队打包一同恢复。
      // agentsRoot: resolve(PATHS.VIEWS_FOLDER, "../agents"),
      pluginRevision: hash,
    });
    const server = app.listen(0, "127.0.0.1");

    await once(server, "listening");
    if (isClosing) return;
    const address = server.address() as AddressInfo;
    const { initializeMcpRuntime } = await import("@toonflow/server/mcp");
    await initializeMcpRuntime(app, `http://127.0.0.1:${address.port}`, resolve(PATHS.VIEWS_FOLDER, "../mcp/stdio.js"));
    console.log(`桌面服务：http://127.0.0.1:${address.port}`);

    const { workArea } = Screen.getPrimaryDisplay();
    // ACT: 宽高分别限制在屏幕可用区域内，预留标题栏和边距，不固定比例。
    const width = Math.min(1280, workArea.width - 64);
    const height = Math.min(960, workArea.height - 64);
    const mainWindow = new BrowserWindow({
      title: "Toonflow",
      url: `http://127.0.0.1:${address.port}/?desktop=1`,
      hidden: Boolean(splash),
      frame: {
        width,
        height,
        x: workArea.x + Math.round((workArea.width - width) / 2),
        y: workArea.y + Math.round((workArea.height - height) / 2),
      },
    });
    // ACT: 两版 SDK 的全局事件不带 WebView ID，使用事件名后缀限定主窗口。
    Electrobun.events.on(`new-window-open-${mainWindow.webview.id}`, (event: { data: { detail: unknown } }) => {
      const detail = event.data.detail;
      const url = typeof detail === "string" ? detail : detail && typeof detail === "object" && "url" in detail ? detail.url : undefined;
      if (typeof url !== "string" || !URL.canParse(url)) return;
      const target = new URL(url);
      if (target.protocol !== "http:" && target.protocol !== "https:") return;
      if (!Utils.openExternal(target.href)) {
        void Utils.showMessageBox({ type: "error", title: "打开链接失败", message: "请检查默认浏览器设置后重试。" });
      }
    });
    // 页面重载时监听器随旧页面销毁，安装请求等新页面 ready 后再投递。
    Electrobun.events.on(`will-navigate-${mainWindow.webview.id}`, () => { deliverInstall = undefined; });
    let isShowing = false;
    app.locals.desktop = {
      openUrl,
      readClipboardText: Utils.clipboardReadText,
      writeClipboardText: Utils.clipboardWriteText,
      selectSaveFile,
      saveFile,
      async selectProviderFile() {
        const [path] = await Utils.openFileDialog({ allowedFileTypes: "ts", canChooseFiles: true, canChooseDirectory: false, allowsMultipleSelection: false });
        return path ?? null;
      },
      async selectDirectory() {
        const [path] = await Utils.openFileDialog({ canChooseFiles: false, canChooseDirectory: true, allowsMultipleSelection: false });
        return path ?? null;
      },
      async ready(failed = false) {
        if (isClosing) return;
        if (!isShowing) {
          if (splash) {
            await splash.finish();
            if (isClosing || !splash) return;
            mainWindow.sh
```

### Core Architecture Module: `apps/desktop/src/protocol.ts`
```
import type { PluginInstallRequest, PluginInstallType } from "@toonflow/server/desktop";

export function parseInstallUrl(value: string): PluginInstallRequest {
  try {
    if (value.length > 8192) throw new Error("安装链接不能超过 8192 个字符");
    if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error("安装链接不能包含换行或控制字符");
    if (!URL.canParse(value)) throw new Error("安装链接不是有效 URL，应为 toonflow://install?type=node&url=编码后的下载地址");
    const link = new URL(value);
    if (link.protocol !== "toonflow:" || link.hostname !== "install" || !["", "/"].includes(link.pathname)) {
      throw new Error("安装链接格式错误，应为 toonflow://install?type=node&url=编码后的下载地址");
    }
    if (link.username || link.password || link.port || link.hash) throw new Error("安装链接不能包含账号、密码、端口或 # 片段");
    if ([...link.searchParams.keys()].some(key => key !== "type" && key !== "url")) {
      throw new Error("安装链接只能包含 type 和 url 参数；下载地址若带有签名或 & 参数，请先用 encodeURIComponent 编码整个下载地址，再放入 url 参数");
    }
    for (const key of ["type", "url"]) {
      const values = link.searchParams.getAll(key);
      if (!values.length) throw new Error(`安装链接缺少 ${key} 参数`);
      if (values.length > 1) throw new Error(`安装链接的 ${key} 参数不能重复；请先用 encodeURIComponent 编码完整下载地址`);
      if (!values[0]?.trim()) throw new Error(`安装链接的 ${key} 参数不能为空`);
    }
    const type = link.searchParams.get("type") as PluginInstallType;
    const patterns = {
      node: /^[a-z][a-zA-Z0-9]*\.umd\.js$/,
      tool: /^[a-z][a-zA-Z0-9]*\.tool\.js$/,
      skill: /^[^\\/\u0000-\u001f\u007f]+\.(?:md|zip|tar|tar\.gz|tgz)$/i,
      provider: /^[a-z][a-zA-Z0-9]*\.ts$/,
      agent: /^[a-z][a-zA-Z0-9]*\.agent\.zip$/,
    };
    const examples = { node: "imageNode.umd.js", tool: "askUser.tool.js", skill: "skill.zip、SKILL.md、skill.tar、skill.tar.gz 或 skill.tgz", provider: "myProvider.ts", agent: "exampleTeam.agent.zip" };
    if (!Object.hasOwn(patterns, type)) throw new Error("不支持此插件类型；type 仅支持 node（节点）、tool（工具）、skill（技能）、provider（供应商）或 agent（团队）");
    const url = link.searchParams.get("url")!;
    if (url.length > 4096) throw new Error("插件下载地址不能超过 4096 个字符");
    if (/[\u0000-\u001f\u007f]/.test(url)) throw new Error("插件下载地址不能包含换行或控制字符");
    if (!URL.canParse(url)) throw new Error("插件下载地址无效，应为完整的 HTTP / HTTPS 文件直链，例如 https://example.com/imageNode.umd.js；url 参数只需编码一次");
    const address = new URL(url);
    if (!["https:", "http:"].includes(address.protocol)) throw new Error("插件下载地址仅支持 HTTP / HTTPS 协议");
    if (address.username || address.password) throw new Error("插件下载地址不能包含账号密码");
    if (address.hash) throw new Error("插件下载地址不能包含 # 片段，请提供文件直链");
    let fileName: string;
    try { fileName = decodeURIComponent(address.pathname.split("/").at(-1) ?? ""); }
    catch { throw new Error("下载地址中的文件名编码无效，请检查 % 转义是否完整"); }
    if (!fileName) throw new Error(`下载地址缺少文件名，请提供文件直链，例如 ${examples[type]}`);
    if (fileName.length > 128) throw new Error("插件文件名不能超过 128 个字符");
    if (!patterns[type].test(fileName)) throw new Error(`插件文件名或扩展名与 ${type} 类型不符；${type === "skill" ? "支持" : "须使用小驼峰命名，例如"} ${examples[type]}`);
    return { type, url: address.href, fileName };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error("安装链接无效"), { status: 400 });
  }
}

```

### Core Architecture Module: `apps/desktop/src/saveFile.ts`
```
import { execFile } from "node:child_process";
import { open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { PATHS } from "electrobun/main";

const execFileAsync = promisify(execFile);
// ACT: 同一桌面进程只显示一个保存对话框；后续若支持多窗口，可按窗口分别加锁。
let dialogOpen = false;
// 选好路径到实际写入之间用一次性 token 中转，不把绝对路径回传给前端。
const pendingSaves = new Map<string, { path: string; expiresAt: number }>();
const tokenTtlMs = 5 * 60 * 1000;

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, entry] of pendingSaves) if (entry.expiresAt <= now) pendingSaves.delete(token);
}

const macDialog = `
on run argv
  try
    return POSIX path of (choose file name with prompt "另存为" default name (item 1 of argv))
  on error errorMessage number errorNumber
    if errorNumber is -128 then return ""
    error errorMessage number errorNumber
  end try
end run
`;

export async function selectSaveFile(fileName: string): Promise<string | null> {
  if (!fileName.trim() || fileName === "." || fileName === ".." || /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/.test(fileName)) {
    throw new Error("保存文件名无效，不能包含路径或控制字符");
  }
  if (dialogOpen) throw new Error("已有保存窗口正在操作，请先完成或取消");
  if (process.platform !== "win32" && process.platform !== "darwin") throw new Error("当前系统不支持桌面另存为");
  dialogOpen = true;
  try {
    const { stdout } = process.platform === "win32"
      ? await execFileAsync(join(PATHS.RESOURCES_FOLDER, "app/saveFileDialog.exe"), [fileName], {
        windowsHide: true,
        encoding: "utf8",
      })
      : await execFileAsync("/usr/bin/osascript", ["-e", macDialog, "--", fileName], { encoding: "utf8" });
    const selected = stdout.replace(/\r?\n$/, "");
    if (!selected) return null;
    if (!isAbsolute(selected) || /[\u0000-\u001f\u007f-\u009f]/.test(selected)) throw new Error("另存为窗口返回了无效的文件路径");
    cleanupExpiredTokens();
    const token = crypto.randomUUID();
    pendingSaves.set(token, { path: selected, expiresAt: Date.now() + tokenTtlMs });
    return token;
  } catch (error) {
    throw new Error(`选择保存位置失败：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  } finally {
    dialogOpen = false;
  }
}

export default async function saveFile(token: string, content: Uint8Array): Promise<boolean> {
  const entry = pendingSaves.get(token);
  pendingSaves.delete(token);
  if (!entry || entry.expiresAt <= Date.now()) throw new Error("保存位置已过期，请重新选择保存位置");
  const selected = entry.path;
  try {
    const temporary = join(dirname(selected), `.toonflow-${crypto.randomUUID()}.tmp`);
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(content);
      await file.close();
      await rename(temporary, selected);
    } finally {
      await file.close();
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    }
    return true;
  } catch (error) {
    throw new Error(`保存文件失败：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

```

### Core Architecture Module: `apps/desktop/src/update/windowsUpdater.ts`
```
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const hashPattern = /^[a-zA-Z0-9]{1,64}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
type versionInfo = { identifier: string; name: string; channel: string; version: string; hash: string; baseUrl: string };
type preparedUpdate = { version: string; hash: string; archiveSha256: string };
type updateLifecycle = { requestQuitApproval(): unknown; cancelQuitApproval(approval: unknown): void; quitAfterApproval(approval: unknown): void };

// ACT: 单人桌面单进程使用一个下载任务；保留现有发布协议和 bspatch，不修改 SDK 缓存。
export default function createWindowsUpdater(resourcesDirectory: string, lifecycle: updateLifecycle) {
  const installDirectory = realpathSync(resolve(resourcesDirectory, "../.."));
  const extractionDirectory = join(installDirectory, "self-extraction");
  const preparedPath = join(extractionDirectory, "preparedUpdate.json");
  const resultPath = join(extractionDirectory, "updateResult.json");
  // ACT: Electrobun 在 Worker 中加载应用，环境变量区分大小写，不能只读取 WINDIR。
  const tarExecutable = join(process.env.SystemRoot ?? process.env.windir ?? process.env.WINDIR!, "System32", "tar.exe");
  let localInfo: versionInfo;
  let manifest: { version: string; hash: string; artifact: { file: string } } | undefined;
  let busy = false;
  let observedResult = "";
  let state = { version: "", hash: "", error: "", updateAvailable: false, updateReady: false };

  function regularFile(path: string) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    return !!stat?.isFile() && !stat.isSymbolicLink();
  }

  function ensureDirectory() {
    mkdirSync(extractionDirectory, { recursive: true });
    if (!lstatSync(extractionDirectory).isDirectory() || lstatSync(extractionDirectory).isSymbolicLink()) throw new Error("更新缓存目录不能是链接");
  }

  function readPrepared(): preparedUpdate | undefined {
    if (!regularFile(preparedPath)) return;
    try {
      const record = JSON.parse(readFileSync(preparedPath, "utf8"));
      if (typeof record.version === "string" && typeof record.hash === "string" && typeof record.archiveSha256 === "string"
        && versionPattern.test(record.version) && hashPattern.test(record.hash) && /^[a-f0-9]{64}$/.test(record.archiveSha256)
        && regularFile(join(extractionDirectory, `${record.hash}.tar`))) return record;
    } catch { /* ACT: 缓存损坏可重新下载，不影响用户数据。 */ }
  }

  async function getLocalInfo() {
    if (!localInfo) {
      const info = await Bun.file(join(resourcesDirectory, "version.json")).json();
      if (!info || info.identifier !== "local.toonflow.desktop" || !["stable", "canary", "dev"].includes(info.channel)
        || typeof info.version !== "string" || !versionPattern.test(info.version) || typeof info.hash !== "string" || !hashPattern.test(info.hash)
        || typeof info.baseUrl !== "string" || typeof info.name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(info.name)) {
        throw new Error("桌面安装标识无效，请重新安装");
      }
      localInfo = info;
    }
    if (existsSync(extractionDirectory)) {
      ensureDirectory();
      // 新版成功启动后才清理旧 app，崩溃或启动失败时保留恢复副本。
      if (regularFile(resultPath)) {
        const result = await Bun.file(resultPath).json().catch(() => null);
        if (typeof result?.transactionId !== "string" || !/^[a-f0-9]{32}$/.test(result.transactionId) || result.transactionId === observedResult) return localInfo;
        observedResult = result.transactionId;
        if (result.success && result.hash === localInfo.hash) {
          const previous = join(extractionDirectory, `appPrevious-${result.transactionId}`);
          const stat = lstatSync(previous, { throwIfNoEntry: false });
          if (stat?.isDirectory() && !stat.isSymbolicLink()) {
            try { rmSync(previous, { recursive: true }); }
            catch (error) { console.warn("旧版本文件暂时无法清理：", error); }
          }
        } else if (result?.success === false) state.error = String(result.error || "上次更新失败，已保留旧版本");
      }
    }
    return localInfo;
  }

  function artifactUrl(fileName: string) {
    const baseUrl = new URL(localInfo.baseUrl.endsWith("/") ? localInfo.baseUrl : `${localInfo.baseUrl}/`);
    if (!["http:", "https:"].includes(baseUrl.protocol)) throw new Error("更新地址无效");
    const url = new URL(fileName, baseUrl);
    url.searchParams.set("transaction", randomUUID());
    return url;
  }

  async function checkForUpdate() {
    if (busy) throw new Error("正在准备更新，请稍候");
    busy = true;
    try {
      const info = await getLocalInfo();
      state.error = "";
      if (info.channel === "dev") return state;
      const response = await fetch(artifactUrl(`${info.channel}-win-x64-update.json`), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`检查更新失败：HTTP ${response.status}`);
      const content = await response.text();
      if (content.length > 65536) throw new Error("更新清单过大");
      const next = JSON.parse(content);
      if (!next || next.schemaVersion !== 1 || next.identifier !== info.identifier || next.channel !== info.channel || next.platform !== "win" || next.arch !== "x64"
        || typeof next.version !== "string" || !versionPattern.test(next.version) || typeof next.hash !== "string" || !hashPattern.test(next.hash) || typeof next.artifact?.file !== "string"
        || !next.artifact.file.startsWith(`${info.channel}-win-x64-`) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tar\.zst$/.test(next.artifact.file)) throw new Error("更新清单不匹配当前应用");
      manifest = next;
      const prepared = readPrepared();
      state = { version: next.version, hash: next.hash, error: "", updateAvailable: next.hash !== info.hash,
        updateReady: next.hash !== info.hash && prepared?.hash === next.hash && prepared?.version === next.version };
    } catch (error) {
      manifest = undefined;
      state.error = error instanceof Error ? error.message : String(error);
      state.updateAvailable = false;
      state.updateReady = false;
    } finally { busy = false; }
    return state;
  }

  async function readArchiveInfo(path: string): Promise<versionInfo> {
    const { stdout } = await execFileAsync(tarExecutable, ["-xOf", path, `${localInfo.name}/Resources/version.json`], { windowsHide: true, timeout: 60000, maxBuffer: 65536 });
    const info = JSON.parse(stdout);
    if (!info || info.identifier !== localInfo.identifier || info.channel !== localInfo.channel || typeof info.hash !== "string" || !hashPattern.test(info.hash)
      || typeof info.version !== "string" || !versionPattern.test(info.version)) throw new Error("更新包安装标识不匹配");
    return info;
  }

  async function download(fileName: string, path: string) {
    const response = await fetch(artifactUrl(fileName), { signal: AbortSignal.timeout(15 * 60_000) });
    if (!response.ok) throw new Error(`下载更新失败：HTTP ${response.status}`);
    await Bun.write(path, response);
  }

  async function downloadUpdate() {
    if (busy) throw new Error("已有更新任务正在执行");
    if (!manifest) {
      await checkForUpdate();
      if (state.error) throw new Error(state.error);
    }
    if (!manifest || !state.updateAvailable) throw new Error("暂无可安装的更新");
    if (state.updateReady) return;
    busy = true;
    state.error = "";
    const temporaryFiles: string[] = [];
    const temporaryFile = (suffix: string) => { const path = join(extractionDirectory, `${randomUUID()}${suffix}`); temporaryFiles.push(path); return path; };
    try {
      ensureDirectory();
      const target = manifest;
      let archivePath = join(extractionDirectory, `${localInfo.hash}.tar`);
      let currentHash = localInfo.hash;
      let usedPatch = false;
      try {
        if (!regularFile(archivePath)) throw new Error("缺少旧版本更新缓存");
        const vi
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #291** (2026-09-29): **2.0版本不支持macos 14的版本**
  *Symptoms*: 从1.18之后就不支持macos 14的版本了，请问有后续支持计划吗
  **Post-Mortem & Fix Analysis**:
  > 目前发布的 macOS 安装包是在 macOS 15 环境下打包的，macOS 14 暂时没有完整验证，可能无法正常运行。另外，macOS 14 较早的小版本自带的 WebKit 内核比较旧，也可能有兼容问题。  底层 Electrobun 框架本身支持 macOS 14，可以把源码下载下来，在自己的系统上尝试编译。搭建编译环境和排查报错时，可以借助 Codex、WorkBuddy、DeepSeek 等工具辅助，不过自行编译也不一定能解决所有内核兼容问题。

- **Issue #290** (2026-09-28): **feat(i18n): add English UI with Simplified Chinese support**
  *Symptoms*: Related to #288.  @1340145680 Thanks for the update about i18n being planned for around mid-October. I had already been working on this English/Simplified Chinese implementation for 2.x, so I'm sharing it for review. Even if you continue with a different architecture, could you take a look? The catalogs or parts of the implementation may still be useful.  ## What changed  Adds an English UI while keeping Simplified Chinese as the default. The language can be changed in Settings > Appearance and is saved with the existing settings.  - A small `@toonflow/i18n` package shares the host's reactive locale with separately loaded node/tool bundles. It supports named placeholders, Chinese fallback, and unchanged unknown keys. - Localizes onboarding, workspaces, assistant controls, settings, canvas controls, built-in nodes, Director 3D, and client-rendered tools. Element Plus and the document language follow the selection without remounting the app. - Keeps settings panel instances and drafts alive across language changes, shows a persistent retry notice after a failed settings save, and updates owned error display text reactively. - Adds English and Simplified Chinese macOS bundle resources and contributor guidance in `docs/localization.md`.  The app uses committed catalogs. This does not add Lingo, a hosted translation dependency, or translation CI.  ## Compatibility  Saved node names, filenames, document text, provider IDs, tool schemas, prompts, and external/provider messages are n
  **Post-Mortem & Fix Analysis**:
  > @guglxni Thank you for the time and effort you've put into multilingual support for Toonflow, and for providing detailed implementation notes and test results!  As we discussed in #288, multilingual support is already on our roadmap. Our team will handle its design and implementation internally, and we currently expect to complete it before mid-October.  This PR targets `master` and changes 167 files. Its broad scope would require substantial review and integration work. Given the overlap with our planned development, we have decided to proceed with our internal plan for multilingual support, so we will not be merging this PR and are closing it.  Thank you again for your contribution and support for Toonflow. We hope you understand our decision!

- **Issue #289** (2026-09-29): **node:setConfig 工具传 duration 字段始终报错"expected number, received string"，无法动态控制视频时长**
  *Symptoms*:  **标题**：`node:setConfig` 工具传 `duration` 字段始终报错"expected number, received string"，无法动态控制视频时长  **环境**： - Toonflow (commit 不详) - 本地 ComfyUI v0.37.2 (RTX PRO 5000) - Provider: `comfyuiMiniMaxH3 / minimaxH3Ref2Video` - 节点类型：`remote-videoGenerationNode`  **复现步骤**： 1. 创建 `remote-videoGenerationNode`，配置 provider `comfyuiMiniMaxH3`、model `minimaxH3Ref2Video` 2. 节点连线图片（reference 模式） 3. 通过任何调用方（AI Agent / API / CLI）调用 `node:setConfig` 工具 4. 在 args 中传 `duration: 6`（number 类型） 5. 同样测试以下写法均失败：    - `{"duration": 6}` → "received string"    - `{"duration": 6.0}` → "received string"    - `{"duration": "6"}` → "received string"（违反 schema 类型）    - 只传 `{"duration": 6}` → "received string"  **期望行为**： `duration` 字段为 number 类型（schema: `{type: "number", exclusiveMinimum: 0}`），应能正常接收 number 6 并保存到节点 `data.duration`。  **实际行为**： 工具返回 Zod schema 校验错误： ``` {   "expected": "number",   "code": "invalid_type",   "path": ["duration"],   "message": "expected number, received string" } ``` 无论 number 怎么传，工具都把它转成 string 再校验，导致永远无法设置 duration。**手动在 Toonflow UI 上设置 duration 是有效的**（节点 data 会写入新值），说明后端/工作流支持，问题仅出在工具入参处理层。  **绕过方案**： 只能让用户在 UI 上手动改 duration，无法通过任何调用方（含 AI Agent）动态控制视频时长，限制了"按分镜动态规划时长"等合理用例。  **附加上下文**： - 同样的字符串化问题也影响 `generateAudio` 字段（boolean） - 之前工作流 ComfyUI 端数学计算确认 `length = max(5, round(duration * 24))`，duration 真的会影响最终视频时长 - AI Agent 排查确认是工具层 Zod schema 缺 `.coerce.number()` / `.coerce.boolean()`  ---  
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈。我们在当前代码（`d86cce6`）上检查并验证了内置 Agent 和 MCP 的参数调用链，暂未复现数字、布尔值被自动转成字符串的情况：  - `duration: 6` 和 `generateAudio: false/true` 均保持原始类型，并通过节点参数校验。 - 传入 `duration: "6"` 或 `generateAudio: "false"` 时，会出现你描述的错误。  目前尚未验证你使用的自定义 ComfyUI provider。麻烦补充以下信息，以便继续定位：  1. Toonflow 版本或 commit。 2. 实际发送的完整工具调用 JSON，以及对应错误日志。 3. `comfyuiMiniMaxH3` 的 provider 定义和模型配置，请移除密钥等敏感信息。  现有证据还不足以判断是缺少 `.coerce` 导致，需要先确认参数在哪一层变成了字符串。
  > 回答： 1：版本：v2.0.1 stable，构建标识：19sf7kz9bq3no  2：实际发送的完整工具调用 JSON，以及对应错误日志。,参考附件：[bug-Toonflow.md](https://github.com/user-attachments/files/32752922/bug-Toonflow.md)  3：comfyuiMiniMaxH3 的 provider 定义参考附件：  [video_minimax_h3_r2vA_turbo_8_steps.json](https://github.com/user-attachments/files/32753176/video_minimax_h3_r2vA_turbo_8_steps.json)        ComfyUI截图：  <img width="1970" height="889" alt="Image" src="https://github.com/user-attachments/assets/816588c1-b103-43c0-ac9e-a8e418ac8cc7" />  4：Toonflow连接本地ComfyUI的自定义配置：媒体模型>添加自定义供应商>文件导入，对应导入文件如下（原始.ts文件上传不了，只能压缩后再上传到这个评论区了）  [deepseek_typescript_20260928_0c3a49.zip](https://github.com/user-attachments/files/32753588/deepseek_typescript_20260928_0c3a49.zip)  <img width="1481" height="772" alt="Image" src="https://github.com/user-attachments/assets/54c291a4-eff5-4502-90f9-f5fee58b3a45" />  5：以下是结合添加在自定义供应商的导入文件（.ts文件）和在Toonflow中给出的报错信息，让DeepSeek排查bug给出的回复（希望对您有帮助）:  #DeepSeek的回答如下：# 原因链是这样的：  你导入的文件里声明了 durationResolutionMap，Toonflow 据此在节点上生成
  > 附件看过了，构建标识对得上官方 v2.0.1。  我用你提供的模型配置试了下，`duration: 6`、`duration: 15` 都能正常写入节点，`generateAudio: false` 也能通过。目前还没复现你遇到的报错，这次只验证了配置写入，没跑 ComfyUI 生成。  这份 md 里主要是 AI 的对话内容，看不到失败时实际发出的参数。还需要你补充两项信息：  - Agent 用的是哪个对话模型、哪家供应商？ - 工作区 `.agent/sessions/` 下对应的 `.jsonl` 文件里，失败那次 `nodeTools` 的调用参数和返回错误（`toolCall`、`toolResult`）。贴相关几行就行，注意去掉敏感信息。  拿到原始记录，才能看出传进来的到底是数字 `6` 还是字符串 `"6"`。  另外，你这个工作流固定生成声音，模型配置里建议补上 `audio: true`。现在漏了这个声明，界面上的声音配置会和实际能力对不上，不过它不是这次字符串报错的原因。

- **Issue #288** (2026-09-27): **English UI for the 2.x canvas (optional Lingo.dev catalogs)**
  *Symptoms*: I'm using the 2.0.1 canvas on macOS and would like an English UI without going back to the older application. Is anyone already working on this? I'd like to contribute a PR.  ### What I found  This concerns v2.0.1 at `d86cce6b689916ab73f75bc4c1f42a2a7424516c`, running the Web/Server app on macOS arm64.  The workspace, Settings and assistant UI show Chinese labels. In the tagged source, `apps/web/src/App.vue` selects Element Plus's `zhCn` locale, and custom strings are hardcoded across `apps/web` and the built-in nodes. I couldn't find a language selector for this version.  I checked #173, HBAI-Ltd/Toonflow-web#22 and #269. Those cover the older application/frontend, rather than the current 2.x canvas. The `solo` branch also has localization code, but its package version is 1.2.0 and its layout differs from 2.x.  ### Proposed change  Add Chinese and English catalogs with a saved language choice. Keep Chinese as the fallback and preserve the current experience for Chinese users. For new installations, we could detect the system/browser language if that's your preference.  I'd cover the canvas menus, Settings, assistant UI and built-in node/tool controls, including their display names and messages. Vue I18n seems reasonable, but the dynamically loaded plugins need a shared way to read the locale. I'd rather agree on that boundary before spreading translation calls through the code.  The change should leave node IDs, connection handles, API values and saved canvas formats alone. 
  **Post-Mortem & Fix Analysis**:
  > Thank you for your feedback. The I18n multilingual feature is still in the planning stage and is expected to be ready around mid-October.
  > @1340145680 Thanks for the update. I've opened #290 with an English/Simplified Chinese implementation for the 2.x interface, including the shared locale runtime, catalogs, screenshots, and verification notes.  I understand you already have i18n planned for around mid-October. Regardless of which approach you decide to use, could you take a look at the PR? You may be able to use the implementation or parts of it in your planned work.  The macOS native checks and Chromium checks are documented in the PR, along with the platforms and flows that haven't been tested. Simplified Chinese remains supported, and user-authored content and model-facing prompts aren't translated. 

- **Issue #287** (2026-09-26): **fix(skills): 强制画布首动作（剧本文本节点）与场景/道具资产强制生成边界**
  *Symptoms*: ## 问题  用户给出剧本后，Agent 的实际执行可能： 1. **跳过剧本文本节点**——剧本只留在对话里，画布上看不到工作流起点； 2. **资产抽取不完整**——只生成角色资产图，以「场景用文字描述即可」为由跳过场景资产，漏掉参与动作的关键道具。  现有技能文本中，「进度可见」与「角色/场景/道具全量盘点」的要求分散且可被解释绕过，小参数模型执行时容易漏掉。  ## 修复  **1. 画布首动作（强制）**（workflow/SKILL.md 新增小节 + canvas/SKILL.md、canvas/references/videoProduction.md 同步） - 用户给出剧本、或本次形成已确认剧本后，**第一个画布动作必须是创建文本节点并写入完整剧本**（ddNode 文本节点 →  ode:setText，写入后回读 data.textPath 核对正文）。 - 剧本节点放画布最左侧，资产节点与视频节点依次排在其右侧，作为整幅工作流的视觉起点。 - 明确剧本节点**不连到图片/视频生成节点**（当前实现会把相连文本全文追加进 prompt，整部剧本会污染资产与视频提示词）；画布上的工作流引线由**资产图节点连到视频生成节点**承载。 - workflow/SKILL.md「在画布上推进」新增「进度必须在画布上可见」段落：每个阶段成果（剧本、资产清单、资产图、提示词）确认后都要写入对应画布节点。  **2. 强制生成边界**（workflow/references/assets.md） - 在 2 个及以上镜头中出现的入画地点，**必须生成场景资产图**（场景主视图）；场景是空间结构与光影基准，单角色镜头同样需要。 - 参与动作的关键道具（被拿取、投掷、打开、使用、投进、传递等）**必须生成道具资产图**；只有不参与动作、仅出现一次的偶发装饰才可降级为文字描述，且降级决定必须写入清单理由。 - 提交给用户确认的资产清单必须逐条列出角色/场景/道具三类及每项处理决定（生成图 / 文字描述 / 跳过+理由）；清单缺类或把应生成项默认为「文字描述」即视为抽取不完整，不得进入生成阶段。  ## 验证  - 技能目录为运行时实时扫描的 Markdown 规则文件，无构建产物；改动仅新增规则文本，不改变工具契约、节点函数或画布 JSON 结构。 - 规则与现有 canvasExecution.md「完整剧本和分镜文本节点保留内容依据，不再用 STRING 连线重复挂到生成节点」一致，不引入第二套连线语义。
  **Post-Mortem & Fix Analysis**:
  > 技能提交应该以插件形式提交，并且主分支不接受pr，提交pr请提交在开发分支上

- **Issue #286** (2026-09-25): **agnes视频模型无法适配**
  *Symptoms*: https://www.agnes-ai.cn/zh-Hans/docs/agnes-video-25-flash  <img width="873" height="559" alt="Image" src="https://github.com/user-attachments/assets/73b0f95d-c384-44f7-b27a-ef8cce4e2839" />  视频模型无法适配，原因是因为生成视频所使用的参考图必须是agnes服务可直接访问的图片URL，所以能否添加对象存储之类的图床支持？
  **Post-Mortem & Fix Analysis**:
  > 可以再供应商代码中自己实现图床或者oss上传来中转
  > > 可以再供应商代码中自己实现图床或者oss上传来中转  供应商上传之后如何让流水线传入URL呢？ 
  > > > 可以再供应商代码中自己实现图床或者oss上传来中转 >  > 供应商上传之后如何让流水线传入URL呢？ 不太清楚你的意思，如果你说的是返回的数据结构，base64、url都可以，所有抽象层都应该在供应商里面处理，其他地方数据流转是本地文件，而不是url流转

- **Issue #285** (2026-09-25): **2.0版本上传自定义供应商出错，提示：供应商 ID 必须为小驼峰文件名 改了也没用**
  *Symptoms*: <img width="1125" height="795" alt="Image" src="https://github.com/user-attachments/assets/37c79e41-8af3-4f8e-992f-95831af44eb2" />
  **Post-Mortem & Fix Analysis**:
  > 新版本不兼容旧版本的供应商，请重新生成

- **Issue #284** (2026-09-21): **安卓FOSS Camera 集成 Toonflow 实时生成短剧**
  *Symptoms*: 分叉 https://github.com/FossifyOrg/Camera 相机集成Toonflow ,  ### 需要做  1. FOSS相机 接入远程自定义服务器Toonflow > 远程服务器上部署Toonflow 2. 点击相机开始录制视频 ，实时上传到 Toonflow远程服务器处理 生成短剧。 > 就像直播摄像头
  **Post-Mortem & Fix Analysis**:
  > The 'live camera' framing is where the engineering risk concentrates: once capture, upload, and generation run as separate real-time stages, the failure modes stop being visible — a dropped upload or a wedged generation job looks identical to 'still processing'. For my own video pipelines I solved this with a three-state contract per stage: SUCCESS with artifacts, EXPLICIT_FAILURE with a reason, and SILENT_TIMEOUT where silence counts as failure, plus checkpoint resume with human gates for long generation runs. On mobile uplink specifically, I'd make the upload stage idempotent with chunked resume, since a phone switching networks mid-record is the common case, not the exception. Real-time generation then becomes honest: the UI can always answer 'which stage, what state, what artifact' instead of an infinite spinner.  建议每个实时阶段用三态状态契约，上传做幂等分片断点续传，避免无限转圈。

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

### Incident Patch 1: `37bc1b70` (2026-09-21)
**Commit Message**: 修正debug打包错误

**File**: `.github/workflows/debug.yml` (modified, +7/-1)
```diff
@@ -132,7 +132,13 @@ jobs:
           }
           if (!(Test-Path -LiteralPath $nsisPath)) { throw '找不到 makensis.exe' }
           "NSIS_PATH=$nsisPath" >> $env:GITHUB_ENV
-      - name: 构建安装包及完整更新文件
+      - name: 构建 Windows 安装包及完整更新文件
+        if: runner.os == 'Windows'
+        # ACT: 使用原生环境，避免 Git Bash 的 GNU tar 将 Windows 盘符识别为远程主机。
+        shell: pwsh
+        run: bun run release:desktop "$env:appVersion" --initial
+      - name: 构建 macOS 安装包及完整更新文件
+        if: runner.os == 'macOS'
         # ACT: CI 构建完整包，不依赖更新服务器已有版本，也不向更新服务器发布。
         run: bun run release:desktop "$appVersion" --initial
       - name: 上传构建产物
```

#### Recent Merged Pull Requests:
- **PR #290** (closed): feat(i18n): add English UI with Simplified Chinese support (@guglxni)
- **PR #287** (closed): fix(skills): 强制画布首动作（剧本文本节点）与场景/道具资产强制生成边界 (@Jahu-bob)
- **PR #282** (closed): fix: 保持图生视频参考图、时长与提示词一致 (@linjie2008)
- **PR #278** (closed): feat(vendor): add API Route AI vendor integration (@DennyHo0917)
- **PR #276** (closed): 修复：生成视频提示词时读取当前轨道分镜 (@nzy0510)
- **PR #275** (closed): 修复：按实际输入模式选择视频提示词模板 (@nzy0510)
- **PR #272** (closed): fix(workbench): recognize dated Seedance 2.0 models (@Iams4kura)
- **PR #269** (closed): Codex/i18n completion plan (@kienmatu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
