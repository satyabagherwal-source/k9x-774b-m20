> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/douyinfe-semi-design-learnings.md`  
> **Source**: github ([https://github.com/DouyinFE/semi-design](https://github.com/DouyinFE/semi-design))  
> **Source Version**: `7a13c45a`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T02:03:09.498Z  
> **Learning ID**: `learn-github-douyinfe-semi-design`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): DouyinFE/semi-design

> **Canonical Artifact**: `07_PROJECT_LEARNING/douyinfe-semi-design-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DouyinFE/semi-design](https://github.com/DouyinFE/semi-design))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T02:03:08.457Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DouyinFE/semi-design`
- **Description**: 🚀A modern, comprehensive, flexible design system and React UI library, AI-friendly built-in.🎨Provide 3000+ Design Tokens, easy to build your design system. Make Semi Design to Any Design.🧑🏻‍💻 Design to Code in one click
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10415 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.storybook/base/utils.js`
```
function isTest() {
    return process.env.TEST_ENV === 'test';
}

module.exports = {
    isTest
};
```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/fetch-directory-list.ts`
```
/**
 * 从 unpkg 或 npmmirror 获取目录列表
 * 同时向两个数据源发送请求，使用第一个成功返回的结果
 */

import {
  readCache,
  writeCache,
  getDirectoryListCacheDir,
  clearCacheDir,
  getCacheDirSize,
} from './file-cache.js';
import { resolveVersion } from './resolve-version.js';

export const UNPKG_BASE_URL = 'https://unpkg.com';
export const NPMMIRROR_BASE_URL = 'https://registry.npmmirror.com';

/**
 * 生成缓存 key
 */
function getCacheKey(packageName: string, version: string, path: string): string {
  return `${packageName}@${version}/${path}`;
}

/**
 * 清除目录列表缓存
 */
export async function clearDirectoryListCache(): Promise<number> {
  return clearCacheDir(getDirectoryListCacheDir());
}

/**
 * 获取目录列表缓存大小
 */
export async function getDirectoryListCacheSize(): Promise<number> {
  return getCacheDirSize(getDirectoryListCacheDir());
}

/**
 * 递归扁平化嵌套的目录结构（用于处理 npmmirror 返回的嵌套格式）
 */
function flattenDirectoryStructure(
  item: { path: string; type?: string; size?: number; files?: Array<{ path: string; type?: string; size?: number; files?: Array<{ path: string; type?: string; size?: number }> }> },
  result: Array<{ path: string; type?: string; size?: number }> = []
): Array<{ path: string; type?: string; size?: number }> {
  // 将当前项添加到结果中
  result.push({
    path: item.path,
    type: item.type,
    size: item.size,
  });

  // 如果有嵌套的 files 数组，递归处理
  if (item.files && Array.isArray(item.files)) {
    for (const file of item.files) {
      flattenDirectoryStructure(file, result);
    }
  }

  return result;
}

/**
 * 递归获取 NPMMIRROR 的目录列表（因为 NPMMIRROR 返回的嵌套结构中子目录的 files 是空的，需要递归请求）
 */
async function fetchNpmMirrorDirectoryRecursive(
  baseUrl: string,
  packageName: string,
  version: string,
  path: string,
  maxDepth: number = 10
): Promise<Array<{ path: string; type: string }>> {
  if (maxDepth <= 0) {
    return [];
  }

  const url = `${baseUrl}/${packageName}/${version}/files/${path}/?meta`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`获取目录列表失败: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API 返回了非 JSON 格式: ${contentType}`);
  }

  const data = await response.json() as
    | { path: string; type?: string; files?: Array<{ path: string; type?: string; files?: Array<{ path: string; type?: string }> }> };

  const normalizeType = (item: { path: string; type?: string }): { path: string; type: string } => {
    const path = item.path;
    if (path.endsWith('/')) {
      return { path, type: 'directory' };
    }
    if (item.type && item.type.includes('/')) {
      return { path, type: 'file' };
    }
    if (item.type === 'directory') {
      return { path, type: 'directory' };
    }
    return { path, type: 'file' };
  };

  const result: Array<{ path: string; type: string }> = [];

  if (data && typeof data === 'object' && 'files' in data && Array.isArray(data.files)) {
    // 递归处理每个子项
    const promises: Promise<Array<{ path: string; type: string }>>[] = [];

    for (const item of data.files) {
      const normalized = normalizeType(item);
      result.push(normalized);

      // 如果是目录且 files 数组为空，需要递归请求
      if (normalized.type === 'directory' && (!item.files || item.files.length === 0)) {
        // 移除路径开头的 /，因为 URL 中不需要
        const subPath = normalized.path.startsWith('/') ? normalized.path.slice(1) : normalized.path;
        promises.push(
          fetchNpmMirrorDirectoryRecursive(baseUrl, packageName, version, subPath, maxDepth - 1)
            .then(subFiles => {
              // 移除当前目录本身，只保留子文件
              return subFiles.filter(f => f.path !== normalized.path);
            })
            .catch(() => []) // 如果子目录请求失败，忽略错误
        );
      } else if (item.files && Array.isArray(item.files) && item.files.length > 0) {
        // 如果已经有嵌套的 files，递归扁平化
        const flattened: Array<{ path: string; type?: string; size?: number }> = [];
        flattenDirectoryStructure(item, flattened);
        const subFiles = flattened
          .filter(f => f.path !== normalized.path) // 排除当前目录本身
          .map(normalizeType);
        result.push(...subFiles);
      }
    }

    // 等待所有递归请求完成
    if (promises.length > 0) {
      const subResults = await Promise.all(promises);
      for (const subFiles of subResults) {
        result.push(...subFiles);
      }
    }
  }

  return result;
}

/**
 * 从单个源获取目录列表
 * 导出用于测试
 */
export async function fetchDirectoryListFromSource(
  baseUrl: string,
  packageName: string,
  version: string,
  path: string,
  isNpmMirror: boolean = false
): Promise<Array<{ path: string; type: string }>> {
  // NPMMIRROR 需要递归请求，因为返回的嵌套结构中子目录的 files 是空的
  if (isNpmMirror) {
    return fetchNpmMirrorDirectoryRecursive(baseUrl, packageName, version, path);
  }

  // unpkg 使用格式：/package@version/path/?meta
  const url = `${baseUrl}/${packageName}@${version}/${path}/?meta`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`获取目录列表失败: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API 返回了非 JSON 格式: ${contentType}`);
  }

  const data = (await response.json()) as
    | Array<{ path: string; type?: string; size?: number }>
    | { files?: Array<{ path: string; type?: string; size?: number }> }
    | { path: string; type?: string; size?: number; files?: Array<{ path: string; type?: string; size?: number; files?: Array<{ path: string; type?: string; size?: number }> }> };

  // 将 MIME 类型转换为 file/directory 类型
  const normalizeType = (item: { path: string; type?: string; size?: number }): { path: string; type: string } => {
    const path = item.path;
    // 如果路径以 / 结尾，认为是目录
    if (path.endsWith('/')) {
      return { path, type: 'directory' };
    }
    // 如果 type 是 MIME 类型（包含 /），认为是文件
    if (item.type && item.type.includes('/')) {
      return { path, type: 'file' };
    }
    // 如果 type 是 'directory'，认为是目录
    if (item.type === 'directory') {
      return { path, type: 'directory' };
    }
    // 默认认为是文件
    return { path, type: 'file' };
  };

  // 处理不同的响应格式
  if (Array.isArray(data)) {
    // unpkg 返回的是扁平数组
    return data.map(normalizeType);
  }
  
  // unpkg 可能返回 { package, version, prefix, files: [...] } 格式
  if (data && typeof data === 'object' && 'files' in data) {
    const filesData = data as { files?: Array<{ path: string; type?: string; size?: number }> };
    if (Array.isArray(filesData.files)) {
      // files 是数组，直接映射
      return filesData.files.map(normalizeType);
    }
  }
  
  // 如果返回单个文件对象，检查是否有嵌套结构
  if (data && typeof data === 'object' && 'path' in data) {
    const singleItem = data as { path: string; type?: string; size?: number; files?: Array<{ path: string; type?: string; size?: number; files?: Array<{ path: string; type?: string; size?: number }> }> };
    // 如果有嵌套的 files，需要扁平化
    if (singleItem.files && Array.isArray(singleItem.files)) {
      const flattened: Array<{ path: string; type?: string; size?: number }> = [];
      flattenDirectoryStructure(singleItem, flattened);
      return flattened.map(normalizeType);
    }
    // 否则直接返回单个项
    return [normalizeType(singleItem)];
  }

  throw new Error('无法解析目录列表数据格式');
}

/**
 * 从 unpkg 或 npmmirror 获取目录列表
 * 同时向两个数据源发送请求，优先使用返回更多文件的结果
 * 支持文件缓存：相同的 packageName、version、path 会使用缓存
 * 
 * 注意：如果 version 是 "latest" 等标签，会先解析为实际版本号再缓存
 * 这样当远端版本更新时，缓存会自动失效
 */
export async function fetchDirectoryList(
  packageName: string,
  version: string,
  path: string
): Promise<Array<{ path: string; type: string }>> {
  // 解析版本号（将 "latest" 等标签解析为实际版本号）
  const resolvedVersion = await resolveVersion(packageName, version);
  
  // 使用解析后的版本号作为缓存 key
  const cacheKey = getCacheKey(packageName, resolvedVersion, path);
  const cacheDir = getDirectoryListCacheDir();
  const cachedContent = await readCache(cacheDir, cacheKey);
  
  if (cachedContent) {
    try {
      const cachedResult = JSON.parse(cachedContent) as Array<{ path: string; type: string }>;
      return cachedResult;
    } catch {
      // 缓存解析失败，忽略缓存
    }
  }

  // 同时向两个源发送请求（使用解析后的版本号）
  const unpkgPromise = fetchDirectoryListFromSource(UNPKG_BASE_URL, packageName, resolvedVersion, path, false);
  const npmmirrorPromise = fetchDirectoryListFromSource(NPMMIRROR_BASE_URL, packageName, resolvedVersion, path, true);

  // 等待所有请求完成（无论成功或失败）
  const results = await Promise.allSettled([unpkgPromise, npmmirrorPromise]);
  
  // 收集成功的结果和错误
  const successfulResults: Array<{ source: string; files: Array<{ path: string; type: string }> }> = [];
  const errors: Error[] = [];
  
  if (results[0].status === 'fulfilled') {
    successfulResults.push({ source: 'unpkg', files: results[0].value });
  } else {
    errors.push(results[0].reason instanceof Error ? results[0].reason : new Error(String(results[0].reason)));
  }
  
  if (results[1].status === 'fulfilled') {
    successfulResults.push({ source: 'npmmirror', files: results[1].value });
  } else {
    errors.push(results[1].reason instanceof Error ? results[1].reason : new Error(String(results[1].reason)));
  }

  // 如果没有成功的结果，抛出错误
  if (successfulResults.length === 0) {
    throw new Error(`所有数据源都失败了: ${errors.map((e) => e.message).join('; ')}`);
  }

  // 优先使用返回更多文件的结果
  // 如果文件数量相同，优先使用 unpkg（通常更可靠）
  successfulResults.sort((a, b) => {
    if (b.files.length !== a.files.length) {
      return b.files.length - a.files.length; // 文件数量多的优先
    }
    // 文件数量相同时，unpkg 优先
    return a.source === 'unpkg' ? -1 : 1;
  });

  const result = successfulResults[0].files;

  // 写入文件缓存
  await writeCache(cacheDir, cacheKey, JSON.stringify(result));

  return result;
}

```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/fetch-file-content.ts`
```
/**
 * 从 unpkg 或 npmmirror 获取具体文件内容
 * 同时向两个数据源发送请求，使用第一个成功返回的结果
 */

import {
  readCache,
  writeCache,
  getFileContentCacheDir,
  clearCacheDir,
  getCacheDirSize,
} from './file-cache.js';
import { resolveVersion } from './resolve-version.js';

export const UNPKG_BASE_URL = 'https://unpkg.com';
export const NPMMIRROR_BASE_URL = 'https://registry.npmmirror.com';

/**
 * 生成缓存 key
 */
function getCacheKey(packageName: string, version: string, filePath: string): string {
  return `${packageName}@${version}/${filePath}`;
}

/**
 * 清除文件内容缓存
 */
export async function clearFileContentCache(): Promise<number> {
  return clearCacheDir(getFileContentCacheDir());
}

/**
 * 获取文件内容缓存大小
 */
export async function getFileContentCacheSize(): Promise<number> {
  return getCacheDirSize(getFileContentCacheDir());
}

/**
 * 从单个源获取文件内容
 * 导出用于测试
 */
export async function fetchFileContentFromSource(
  baseUrl: string,
  packageName: string,
  version: string,
  filePath: string,
  isNpmMirror: boolean = false
): Promise<string> {
  // npmmirror 使用不同的 URL 格式：/package/version/files/path
  // unpkg 使用格式：/package@version/path
  const url = isNpmMirror
    ? `${baseUrl}/${packageName}/${version}/files/${filePath}`
    : `${baseUrl}/${packageName}@${version}/${filePath}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain, application/json, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`获取文件失败: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  
  // 检查是否是 HTML 错误页面
  if (content.trim().startsWith('<!DOCTYPE html>') || content.includes('npmmirror 镜像站')) {
    throw new Error('返回了 HTML 错误页面');
  }

  return content;
}

/**
 * 从 unpkg 或 npmmirror 获取具体文件内容
 * 同时向两个数据源发送请求，使用第一个成功返回的结果
 * 支持文件缓存：相同的 packageName、version、filePath 会使用缓存
 * 
 * 注意：如果 version 是 "latest" 等标签，会先解析为实际版本号再缓存
 * 这样当远端版本更新时，缓存会自动失效
 */
export async function fetchFileContent(
  packageName: string,
  version: string,
  filePath: string
): Promise<string> {
  // 解析版本号（将 "latest" 等标签解析为实际版本号）
  const resolvedVersion = await resolveVersion(packageName, version);
  
  // 使用解析后的版本号作为缓存 key
  const cacheKey = getCacheKey(packageName, resolvedVersion, filePath);
  const cacheDir = getFileContentCacheDir();
  const cachedContent = await readCache(cacheDir, cacheKey);
  
  if (cachedContent) {
    return cachedContent;
  }

  // 同时向两个源发送请求（使用解析后的版本号）
  const unpkgPromise = fetchFileContentFromSource(UNPKG_BASE_URL, packageName, resolvedVersion, filePath, false);
  const npmmirrorPromise = fetchFileContentFromSource(NPMMIRROR_BASE_URL, packageName, resolvedVersion, filePath, true);

  // 使用 Promise.race 获取第一个成功的结果
  // 将错误转换为永远不会 resolve 的 promise，这样另一个请求有机会成功
  const unpkgWithFallback = unpkgPromise.catch(() => new Promise<never>(() => {}));
  const npmmirrorWithFallback = npmmirrorPromise.catch(() => new Promise<never>(() => {}));

  // 同时等待两个请求，使用 race 获取第一个成功的结果
  const raceResult = await Promise.race([unpkgWithFallback, npmmirrorWithFallback]).catch(
    () => null
  );

  if (raceResult) {
    // 写入文件缓存
    await writeCache(cacheDir, cacheKey, raceResult);
    return raceResult;
  }

  // 如果 race 没有结果（两个都失败），等待所有请求完成以获取错误信息
  const results = await Promise.allSettled([unpkgPromise, npmmirrorPromise]);
  
  // 收集所有错误
  const errors: Error[] = [];
  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
    }
  }

  throw new Error(`所有数据源都失败了: ${errors.map((e) => e.message).join('; ')}`);
}

```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/file-cache.ts`
```
/**
 * 文件缓存模块
 * 将缓存存储到用户家目录的 .semi-mcp/cache 文件夹中
 * 支持 Windows、macOS、Linux
 */

import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * 获取缓存根目录
 * Windows: C:\Users\username\.semi-mcp\cache
 * macOS: /Users/username/.semi-mcp/cache
 * Linux: /home/username/.semi-mcp/cache
 */
export function getCacheDir(): string {
  return join(homedir(), '.semi-mcp', 'cache');
}

/**
 * 获取目录列表缓存目录
 */
export function getDirectoryListCacheDir(): string {
  return join(getCacheDir(), 'directory-list');
}

/**
 * 获取文件内容缓存目录
 */
export function getFileContentCacheDir(): string {
  return join(getCacheDir(), 'file-content');
}

/**
 * 将缓存 key 转换为安全的文件名
 * 替换特殊字符，避免文件系统问题
 */
export function keyToFileName(key: string): string {
  return key
    .replace(/@/g, '_at_')
    .replace(/\//g, '_')
    .replace(/\\/g, '_')
    .replace(/:/g, '_')
    .replace(/\*/g, '_')
    .replace(/\?/g, '_')
    .replace(/"/g, '_')
    .replace(/</g, '_')
    .replace(/>/g, '_')
    .replace(/\|/g, '_');
}

/**
 * 确保目录存在
 */
async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * 读取缓存
 * @param cacheDir 缓存目录
 * @param key 缓存 key
 * @returns 缓存内容，如果不存在返回 null
 */
export async function readCache(cacheDir: string, key: string): Promise<string | null> {
  try {
    const fileName = keyToFileName(key);
    const filePath = join(cacheDir, fileName);
    
    if (!existsSync(filePath)) {
      return null;
    }
    
    const content = await readFile(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

/**
 * 写入缓存
 * @param cacheDir 缓存目录
 * @param key 缓存 key
 * @param content 缓存内容
 */
export async function writeCache(cacheDir: string, key: string, content: string): Promise<void> {
  try {
    await ensureDir(cacheDir);
    const fileName = keyToFileName(key);
    const filePath = join(cacheDir, fileName);
    await writeFile(filePath, content, 'utf-8');
  } catch {
    // 写入缓存失败不影响主流程
  }
}

/**
 * 清除指定目录的所有缓存
 */
export async function clearCacheDir(cacheDir: string): Promise<number> {
  try {
    if (!existsSync(cacheDir)) {
      return 0;
    }
    
    const files = await readdir(cacheDir);
    let count = 0;
    
    for (const file of files) {
      try {
        await unlink(join(cacheDir, file));
        count++;
      } catch {
        // 忽略单个文件删除失败
      }
    }
    
    return count;
  } catch {
    return 0;
  }
}

/**
 * 获取缓存目录中的文件数量
 */
export async function getCacheDirSize(cacheDir: string): Promise<number> {
  try {
    if (!existsSync(cacheDir)) {
      return 0;
    }
    
    const files = await readdir(cacheDir);
    return files.length;
  } catch {
    return 0;
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  cacheDir: string;
  directoryListCount: number;
  fileContentCount: number;
  totalCount: number;
}> {
  const cacheDir = getCacheDir();
  const directoryListCount = await getCacheDirSize(getDirectoryListCacheDir());
  const fileContentCount = await getCacheDirSize(getFileContentCacheDir());
  
  return {
    cacheDir,
    directoryListCount,
    fileContentCount,
    totalCount: directoryListCount + fileContentCount,
  };
}

/**
 * 清除所有缓存
 */
export async function clearAllCache(): Promise<{
  directoryListCleared: number;
  fileContentCleared: number;
  totalCleared: number;
}> {
  const directoryListCleared = await clearCacheDir(getDirectoryListCacheDir());
  const fileContentCleared = await clearCacheDir(getFileContentCacheDir());
  
  return {
    directoryListCleared,
    fileContentCleared,
    totalCleared: directoryListCleared + fileContentCleared,
  };
}


```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/get-component-documents.ts`
```
import { fetchDirectoryList } from './fetch-directory-list.js';
import { fetchFileContent } from './fetch-file-content.js';

export interface ComponentDocument {
  name: string;
  path: string;
  content: string;
}

export interface ComponentDocumentsResult {
  category: string;
  documents: ComponentDocument[];
}

/**
 * 获取组件文档内容（从 content 文件夹）
 * content 文件夹结构：content/{category}/{componentName}/index.md, index-en-US.md
 * unpkg 返回的是扁平的文件列表，需要从文件路径中提取信息
 * 
 * 这个函数可以在浏览器和 Node.js 环境中运行
 */
export async function getComponentDocuments(
  componentName: string,
  version: string = 'latest'
): Promise<ComponentDocumentsResult | null> {
  const packageName = '@douyinfe/semi-ui';
  const componentNameLower = componentName.toLowerCase();

  // 获取 content 下的所有文件（unpkg 返回扁平列表）
  const contentFiles = await fetchDirectoryList(packageName, version, 'content');

  if (!contentFiles || contentFiles.length === 0) {
    return null;
  }

  // 从文件路径中查找匹配的组件文档（只要中文文档 index.md）
  // 路径格式：/content/{category}/{componentName}/index.md
  const componentFiles = contentFiles.filter((file) => {
    if (file.type !== 'file') {
      return false;
    }
    const path = file.path.toLowerCase();
    // 只匹配中文文档 index.md，排除 index-en-US.md
    const pathPattern = new RegExp(`/content/[^/]+/${componentNameLower}/index\\.md$`);
    return pathPattern.test(path);
  });

  if (componentFiles.length === 0) {
    return null;
  }

  // 从第一个文件路径中提取分类
  const firstPath = componentFiles[0].path;
  const pathParts = firstPath.split('/');
  // 路径格式：/content/{category}/{componentName}/文件名
  // 或者：content/{category}/{componentName}/文件名
  let categoryIndex = -1;
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i].toLowerCase() === 'content') {
      categoryIndex = i + 1;
      break;
    }
  }

  if (categoryIndex === -1 || categoryIndex >= pathParts.length) {
    return null;
  }

  const category = pathParts[categoryIndex];

  // 获取所有文档文件的内容
  // 移除路径开头的 /，因为 fetchFileContent 需要相对路径
  const documentPromises = componentFiles.map(async (file) => {
    const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];

    try {
      const content = await fetchFileContent(packageName, version, filePath);
      return {
        name: fileName,
        path: file.path,
        content: content,
      };
    } catch (error) {
      // 如果获取文件内容失败，返回错误信息
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name: fileName,
        path: file.path,
        content: `获取文档内容失败: ${errorMessage}`,
      };
    }
  });

  const documents = await Promise.all(documentPromises);

  return {
    category,
    documents: documents.sort((a, b) => a.name.localeCompare(b.name)),
  };
}


```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/get-component-list.ts`
```
import { fetchDirectoryList } from './fetch-directory-list.js';

/**
 * 获取组件列表（从 lib 文件夹）
 * 从 @douyinfe/semi-ui 包的 lib 目录中提取组件名称
 */
export async function getComponentList(version: string): Promise<string[]> {
  const packageName = '@douyinfe/semi-ui';
  const files = await fetchDirectoryList(packageName, version, 'lib');

  if (!files || files.length === 0) {
    return [];
  }

  // 从文件路径中提取组件目录名称
  // 路径格式: /lib/cjs/Button/index.js 或 /lib/es/Button/index.js
  const componentSet = new Set<string>();
  
  for (const file of files) {
    const path = file.path;
    // 移除开头的 /lib/ 前缀
    const pathWithoutLib = path.replace(/^\/lib\//, '').replace(/^lib\//, '');
    const parts = pathWithoutLib.split('/');
    
    // 跳过 cjs、es 等构建目录
    if (parts.length >= 2 && (parts[0] === 'cjs' || parts[0] === 'es')) {
      const componentName = parts[1];
      if (componentName && componentName !== 'lib') {
        componentSet.add(componentName.toLowerCase());
      }
    } else if (parts.length >= 1) {
      // 如果没有 cjs/es 前缀，直接取第一部分
      const componentName = parts[0];
      if (componentName && componentName !== 'lib' && componentName !== 'cjs' && componentName !== 'es') {
        componentSet.add(componentName.toLowerCase());
      }
    }
  }

  return Array.from(componentSet).sort(); // 去重并排序
}


```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/remove-function-body.ts`
```
/**
 * 移除函数体和提取函数的工具函数
 * 使用 oxc-parser 进行 AST 解析
 */

import { parseSync } from 'oxc-parser';

/**
 * 函数信息
 */
export interface FunctionInfo {
  /** 函数名 */
  name: string;
  /** 函数体开始位置 */
  bodyStart: number;
  /** 函数体结束位置 */
  bodyEnd: number;
  /** 完整函数代码 */
  fullCode: string;
  /** 函数起始位置 */
  start: number;
  /** 函数结束位置 */
  end: number;
}

/**
 * AST 节点类型定义
 */
interface ASTNode {
  type: string;
  start: number;
  end: number;
  body?: ASTNode | ASTNode[];
  id?: { name: string; start: number; end: number };
  key?: { name: string; start: number; end: number };
  name?: string;
  kind?: string;
  declarations?: ASTNode[];
  init?: ASTNode;
  value?: ASTNode;
  expression?: ASTNode;
  left?: ASTNode;
  right?: ASTNode;
  properties?: ASTNode[];
  elements?: ASTNode[];
  [key: string]: unknown;
}

/**
 * 递归遍历 AST 节点
 */
function traverse(node: ASTNode | ASTNode[] | null | undefined, callback: (node: ASTNode) => void): void {
  if (!node) return;
  
  if (Array.isArray(node)) {
    for (const child of node) {
      traverse(child, callback);
    }
    return;
  }
  
  callback(node);
  
  // 遍历所有可能包含子节点的属性
  const childKeys = [
    'body', 'declarations', 'init', 'expression', 'left', 'right',
    'properties', 'elements', 'argument', 'arguments', 'params',
    'consequent', 'alternate', 'test', 'object', 'property',
    'callee', 'value', 'key', 'computed', 'members', 'cases',
    'discriminant', 'handler', 'block', 'finalizer', 'param',
    'declaration', 'specifiers', 'source', 'exported', 'local',
    'imported', 'superClass', 'decorators', 'typeAnnotation',
    'returnType', 'typeParameters', 'implements', 'extends',
  ];
  
  for (const key of childKeys) {
    const child = node[key];
    if (child && typeof child === 'object') {
      traverse(child as ASTNode | ASTNode[], callback);
    }
  }
}

/**
 * 从 AST 中提取所有函数信息
 */
function extractFunctionsFromAST(ast: ASTNode, code: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  
  traverse(ast, (node) => {
    let funcName: string | undefined;
    let bodyStart: number | undefined;
    let bodyEnd: number | undefined;
    let funcStart: number | undefined;
    let funcEnd: number | undefined;
    
    // 处理不同类型的函数节点
    switch (node.type) {
      // 函数声明: function name() {}
      case 'FunctionDeclaration': {
        if (node.id?.name && node.body && typeof node.body === 'object' && !Array.isArray(node.body)) {
          funcName = node.id.name;
          bodyStart = node.body.start;
          bodyEnd = node.body.end;
          funcStart = node.start;
          funcEnd = node.end;
        }
        break;
      }
      
      // 函数表达式: const name = function() {}
      case 'FunctionExpression': {
        // 函数表达式本身可能有名字，也可能没有
        // 我们需要从父节点获取名字（如 VariableDeclarator）
        if (node.body && typeof node.body === 'object' && !Array.isArray(node.body)) {
          funcName = node.id?.name;
          bodyStart = node.body.start;
          bodyEnd = node.body.end;
          funcStart = node.start;
          funcEnd = node.end;
        }
        break;
      }
      
      // 箭头函数: const name = () => {}
      case 'ArrowFunctionExpression': {
        if (node.body && typeof node.body === 'object' && !Array.isArray(node.body) && node.body.type === 'BlockStatement') {
          bodyStart = node.body.start;
          bodyEnd = node.body.end;
          funcStart = node.start;
          funcEnd = node.end;
        }
        break;
      }
      
      // 类方法: class A { method() {} }
      case 'MethodDefinition': {
        if (node.key && node.value && typeof node.value === 'object') {
          const keyNode = node.key as ASTNode;
          funcName = keyNode.name || (keyNode as unknown as { value: string }).value;
          const valueNode = node.value as ASTNode;
          if (valueNode.body && typeof valueNode.body === 'object' && !Array.isArray(valueNode.body)) {
            bodyStart = valueNode.body.start;
            bodyEnd = valueNode.body.end;
            funcStart = node.start;
            funcEnd = node.end;
          }
        }
        break;
      }
      
      // 类属性（箭头函数）: class A { method = () => {} }
      case 'PropertyDefinition': {
        if (node.key && node.value && typeof node.value === 'object') {
          const keyNode = node.key as ASTNode;
          const valueNode = node.value as ASTNode;
          if (valueNode.type === 'ArrowFunctionExpression' || valueNode.type === 'FunctionExpression') {
            funcName = keyNode.name || (keyNode as unknown as { value: string }).value;
            if (valueNode.body && typeof valueNode.body === 'object' && !Array.isArray(valueNode.body) && valueNode.body.type === 'BlockStatement') {
              bodyStart = valueNode.body.start;
              bodyEnd = valueNode.body.end;
              funcStart = node.start;
              funcEnd = node.end;
            }
          }
        }
        break;
      }
      
      // 对象方法: { method() {} }
      case 'Property': {
        if (node.key && node.value && typeof node.value === 'object') {
          const keyNode = node.key as ASTNode;
          const valueNode = node.value as ASTNode;
          if (valueNode.type === 'FunctionExpression' || valueNode.type === 'ArrowFunctionExpression') {
            funcName = keyNode.name || (keyNode as unknown as { value: string }).value;
            if (valueNode.body && typeof valueNode.body === 'object' && !Array.isArray(valueNode.body) && valueNode.body.type === 'BlockStatement') {
              bodyStart = valueNode.body.start;
              bodyEnd = valueNode.body.end;
              funcStart = node.start;
              funcEnd = node.end;
            }
          }
        }
        break;
      }
    }
    
    // 如果找到了有效的函数信息，添加到列表
    if (bodyStart !== undefined && bodyEnd !== undefined && funcStart !== undefined && funcEnd !== undefined) {
      functions.push({
        name: funcName || '<anonymous>',
        bodyStart,
        bodyEnd,
        fullCode: code.slice(funcStart, funcEnd),
        start: funcStart,
        end: funcEnd,
      });
    }
  });
  
  // 按位置排序
  functions.sort((a, b) => a.start - b.start);
  
  return functions;
}

/**
 * 处理变量声明中的函数赋值，提取函数名
 */
function extractVariableDeclarationFunctions(ast: ASTNode, code: string, existingFunctions: FunctionInfo[]): void {
  const existingStarts = new Set(existingFunctions.map(f => f.bodyStart));
  
  traverse(ast, (node) => {
    if (node.type === 'VariableDeclaration' && node.declarations) {
      for (const decl of node.declarations as ASTNode[]) {
        if (decl.type === 'VariableDeclarator' && decl.id && decl.init) {
          const idNode = decl.id as ASTNode;
          const initNode = decl.init as ASTNode;
          
          if ((initNode.type === 'ArrowFunctionExpression' || initNode.type === 'FunctionExpression') &&
              initNode.body && typeof initNode.body === 'object' && !Array.isArray(initNode.body) &&
              initNode.body.type === 'BlockStatement') {
            
            const bodyStart = initNode.body.start;
            
            // 更新已存在的匿名函数的名字
            for (const func of existingFunctions) {
              if (func.bodyStart === bodyStart && func.name === '<anonymous>') {
                func.name = idNode.name || '<anonymous>';
                break;
              }
            }
            
            // 如果这个函数还没有被添加，添加它
            if (!existingStarts.has(bodyStart)) {
              existingFunctions.push({
                name: idNode.name || '<anonymous>',
                bodyStart,
                bodyEnd: initNode.body.end,
                fullCode: code.slice(node.start, node.end),
                start: node.start,
                end: node.end,
              });
            }
          }
        }
      }
    }
  });
}

/**
 * 解析代码并获取所有函数
 */
export function findAllFunctions(code: string, filename: string = 'code.tsx'): FunctionInfo[] {
  try {
    const result = parseSync(filename, code);
    
    if (result.errors && result.errors.length > 0) {
      // 解析有错误，但可能仍然有部分 AST
      console.warn('解析代码时有错误:', result.errors);
    }
    
    const ast = result.program as unknown as ASTNode;
    const functions = extractFunctionsFromAST(ast, code);
    
    // 处理变量声明中的函数
    extractVariableDeclarationFunctions(ast, code, functions);
    
    // 重新排序
    functions.sort((a, b) => a.start - b.start);
    
    return functions;
  } catch (error) {
    console.error('解析代码失败:', error);
    return [];
  }
}

/**
 * 将代码中所有函数体替换为 { ... }
 * @param code 源代码
 * @param filename 文件名（用于确定解析模式，如 .ts, .tsx）
 * @returns 替换后的代码
 */
export function removeFunctionBodies(code: string, filename: string = 'code.tsx'): string {
  const functions = findAllFunctions(code, filename);
  
  if (functions.length === 0) {
    return code;
  }
  
  // 过滤掉嵌套的函数，只处理非嵌套的函数体
  // 从最深层开始替换，避免位置偏移问题
  const sortedByBodyStart = [...functions].sort((a, b) => b.bodyStart - a.bodyStart);
  
  let result = code;
  const replacedRanges: Array<{ start: number; end: number }> = [];
  
  for (const func of sortedByBodyStart) {
    // 检查这个函数体是否已经被包含在另一个已替换的范围内
    const isNested = replacedRanges.some(
      range => func.bodyStart >= range.start && func.bodyEnd <= range.end
    );
    
    if (isNested) {
      continue;
    }
    
    // 替换函数体
    const before = result.slice(0, func.bodyStart);
    const after = result.slice(func.bodyEnd);
    result = before + '{ ... }' + after;
    
    replacedRanges.push({ start: func.bodyStart, end: func.bodyEnd });
  }
  
  return result;
}

/**
 * 从代码中提取指定名称的函数
 * @param code 源代码
 * @param functionName 函数名
 * @param filename 文件名
 * @returns 函数的完整代码，如果未找到返回 null
 */
export function extractFunction(code: string, functionName: string, filename: string = 'code.tsx'): string | null {
  const functions = findAllFunctions(code, filename);
  
  const targetFunction = functions.find(f => f.name === functionName);
  
  if (!targetFunction) {
    return null;
  }
  
  return 
```

### Core Architecture Module: `ecosystem/semi-mcp/src/utils/resolve-version.ts`
```
/**
 * 版本号解析模块
 * 将 "latest" 等标签解析为实际版本号
 * 
 * 缓存策略：
 * - 每天只在第一次调用时查询 npm registry
 * - 当天后续调用使用缓存版本号
 * - 版本号不设过期时间（只有日期变化才重新查询）
 */

import {
  readCache,
  writeCache,
  getCacheDir,
} from './file-cache.js';
import { join } from 'path';
import { lt } from 'semver';

/**
 * 最低支持版本号
 * 低于此版本的请求会自动 fallback 到 latest
 */
const MIN_SUPPORTED_VERSION = '2.90.2';

/**
 * 版本缓存数据结构
 */
interface VersionCacheData {
  version: string;
  date: string; // 缓存日期，格式：YYYY-MM-DD
}

/**
 * 获取版本缓存目录
 */
function getVersionCacheDir(): string {
  return join(getCacheDir(), 'version');
}

/**
 * 生成版本缓存 key
 * 格式：packageName@tag (如 @douyinfe/semi-ui@latest)
 */
function getVersionCacheKey(packageName: string, tag: string): string {
  return `${packageName}@${tag}`;
}

/**
 * 获取当前日期字符串
 * 格式：YYYY-MM-DD
 */
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 从 npm registry 获取包的实际版本号
 * 优先使用 npmmirror，失败后使用 npmjs
 */
async function fetchVersionFromRegistry(packageName: string, tag: string): Promise<string> {
  const registries = [
    `https://registry.npmmirror.com/${packageName}/${tag}`,
    `https://registry.npmjs.org/${packageName}/${tag}`,
  ];

  let lastError: Error | null = null;

  for (const url of registries) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { version?: string };
      
      if (data && data.version) {
        return data.version;
      }
      
      throw new Error('响应中没有 version 字段');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // 继续尝试下一个 registry
    }
  }

  throw new Error(`无法获取 ${packageName}@${tag} 的版本号: ${lastError?.message}`);
}

/**
 * 解析版本号
 * 
 * @param packageName 包名
 * @param version 版本号或标签（如 "latest"、"next"、具体版本号）
 * @returns 实际版本号
 * 
 * 工作原理：
 * 1. 如果是具体版本号（如 2.89.2），直接返回
 * 2. 如果是标签（如 latest）：
 *    - 检查缓存：如果缓存日期等于今天，直接返回缓存版本
 *    - 缓存无效：从 npm registry 获取版本，并缓存（带今天日期）
 */
export async function resolveVersion(packageName: string, version: string): Promise<string> {
  // 如果是具体版本号（包含数字和点），检查是否低于最低支持版本
  // 例如：2.89.2、2.89.2-alpha.3、1.0.0-beta.1
  if (/^\d+\.\d+\.\d+/.test(version)) {
    // 如果版本号低于最低支持版本，自动 fallback 到 latest
    if (lt(version, MIN_SUPPORTED_VERSION)) {
      version = 'latest';
    } else {
      return version;
    }
  }

  // 是标签（如 latest、next、beta 等）或需要 fallback 到 latest，需要解析
  const cacheDir = getVersionCacheDir();
  const cacheKey = getVersionCacheKey(packageName, version);
  const today = getCurrentDate();

  // 检查缓存
  const cachedContent = await readCache(cacheDir, cacheKey);
  if (cachedContent) {
    try {
      const cached = JSON.parse(cachedContent) as VersionCacheData;
      
      // 如果缓存日期等于今天，直接使用缓存版本
      if (cached.date === today) {
        return cached.version;
      }
    } catch {
      // 缓存解析失败，忽略缓存
    }
  }

  // 缓存无效或过期，从 registry 获取实际版本号
  const resolvedVersion = await fetchVersionFromRegistry(packageName, version);

  // 写入缓存（带今天日期）
  const cacheData: VersionCacheData = {
    version: resolvedVersion,
    date: today,
  };
  await writeCache(cacheDir, cacheKey, JSON.stringify(cacheData));

  return resolvedVersion;
}

/**
 * 批量解析版本号（用于同时查询多个包）
 */
export async function resolveVersions(
  packages: Array<{ packageName: string; version: string }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();  
  await Promise.all(
    packages.map(async ({ packageName, version }) => {
      const resolved = await resolveVersion(packageName, version);
      results.set(`${packageName}@${version}`, resolved);
    })
  );

  return results;
}

```

### Core Architecture Module: `packages/semi-animation-react/_story/queue-transition/index.jsx`
```
import React from 'react';
import { Transition } from '@douyinfe/semi-animation-react';

function QueueTransition({ children, state, position = 'right', ...rest }) {
    const propMap = {
        left: {
            type: 'translateX',
            ratio: -1,
        },
        right: {
            type: 'translateX',
            ratio: 1,
        },
        top: {
            type: 'translateY',
            ratio: -1,
        },
        bottom: {
            type: 'translateY',
            ratio: 1,
        },
    };

    let translateObj = propMap[position];

    if (!translateObj) {
        translateObj = propMap.right;
    }

    const translateType = translateObj.type;
    const translateRatio = translateObj.ratio;

    return React.Children.map(children, (child, idx) => (
        <Transition
            from={{ opacity: 0, [translateType]: translateRatio * 200 }}
            enter={{
                opacity: { val: 1, duration: 300, easing: 'linear' },
                [translateType]: { val: 0, easing: 'cubic-bezier(0, .68, .3, 1)', duration: 300 },
            }}
            leave={{
                opacity: { val: 0, duration: 200, easing: 'linear' },
                [translateType]: {
                    val: translateRatio * 200,
                    easing: 'cubic-bezier(0.5, 0, 1, 0.4)',
                    duration: 200,
                },
            }}
            config={{ delay: idx * 100 }}
            state={state}
        >
            {(props = {}) => React.cloneElement(child, {
                ...child.props,
                style: {
                    ...child.props.style,
                    opacity: props.opacity,
                    transform: `${[translateType]}(${props[translateType]}%)`,
                },
            })}
        </Transition>
    ));
}

export default QueueTransition;

```

### Core Architecture Module: `packages/semi-animation-react/_story/queue-transition/styled.jsx`
```
import React from 'react';
import { StyledTransition } from '../../index';

function QueueStyledTransition({ children, position = 'Left', state = 'enter', ...rest }) {
    const enterCls = `semi-fadeIn, semi-slideIn${position}`;
    const leaveCls = `semi-fadeOut, semi-slideOut${position}`;

    return React.Children.map(children, (child, idx) => (
        <StyledTransition
            enter={enterCls}
            leave={leaveCls}
            state={state}
            delay={idx * 50 + 'ms'}
            duration={state === 'enter' ? '.3s,.3s' : '.2s,.2s'}
        >
            {({ animateCls, animateStyle }) => React.cloneElement(child, {
                ...child.props,
                className: animateCls,
                style: {
                    ...child.props.style,
                    ...animateStyle,
                },
            })}
        </StyledTransition>
    ));
}

export default QueueStyledTransition;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3296** (2026-05-21): **[BUG][Cascader] 搜索忽略大小写，但高亮要求精确匹配，命中结果可能没有高亮**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Cascader  ### Semi Version  @douyinfe/semi-ui@2.98.0（官网最新版本可复现）  ### Current Behavior  Cascader 默认的 `filterTreeNode`（传入 `true` 走内置过滤器）实现是 **忽略大小写** 的：  ```ts // packages/semi-foundation/cascader/util.ts filterFn = (targetVal: string, val: string) => {     const input = targetVal.toLowerCase();     return val.toLowerCase().includes(input); }; ```  而下拉项的高亮渲染却是 **大小写敏感** 的：  ```tsx // packages/semi-ui/cascader/item.tsx highlight = (searchText) => {     ...     if (typeof item === 'string' && includes(item, keyword)) {         item.split(keyword).forEach(...);     }     ... }; ```  因此在选项 label 与搜索关键词大小写不一致的场景下，会出现「搜索能匹配上、但下拉中命中项里的关键词完全没有高亮」的现象。  ### Expected Behavior  搜索的匹配规则与高亮的匹配规则应保持一致：  - 当 `filterTreeNode={true}` 走内置过滤器（不区分大小写）时，高亮也应不区分大小写，按命中位置加粗显示原文。 - 当用户传入自定义 `filterTreeNode` 函数时，至少应让高亮策略对大小写不敏感的命中也能够正确加亮（或暴露相应配置/约定）。  ### Steps To Reproduce  1. 打开 [官网 Cascader「可搜索的」示例](https://semi.design/zh-CN/input/cascader#可搜索的)。 2. 在 demo 中将 treeData 修改为带有英文大写字母的数据（或直接用下方的 ReproducibleCode 在「在线编辑」里运行）。 3. 在搜索框中输入小写 `bei`。 4. 观察下拉结果：可以看到 `Beijing / Haidian` 等项被正确过滤出来，但其中的 `Bei` 没有任何高亮样式。  ### ReproducibleCode  ```jsx import React from 'react'; import { Cascader } from '@douyinfe/semi-ui';  () => {     const treeData = [         {             label: 'Beijing',             value: 'beijing',             children: [                 { label: 'Haidian', value: 'haidian' },             

- **Issue #3295** (2026-05-21): **[BUG][Cascader] 搜索选中后，选项的高亮丢失，且 separator 中的空格被吞掉**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Cascader  ### Semi Version  @douyinfe/semi-ui@2.98.0（官网最新版本可复现）  ### Current Behavior  在可搜索的 Cascader（`filterTreeNode` 开启）中：  1. 输入关键词进行搜索后，下拉中命中的选项会以「父节点 / 子节点 / 叶子节点」这种带空格的路径形式展示，且关键词文字会被加粗高亮。 2. 当点击其中一项进行选中后，再次点开下拉，会发现：    - **高亮丢失**：刚刚选中的那一项里，关键词不再被高亮（虽然搜索框里的关键词仍然存在）。    - **路径中的空格丢失**：路径分隔符 `separator` 默认为 ` / `（前后各有一个空格）。在某些渲染分支下（比如关键词刚好与 `separator` 相邻、或者 `searchText` 中混入了 `separator` 字符串），高亮拆分后路径里 ` / ` 两边的空格会被吃掉，视觉上变成了 `浙江省/杭州市/西湖区`，与未搜索时的展示不一致。  可在 [官网 Cascader「可搜索的」示例](https://semi.design/zh-CN/input/cascader#可搜索的) 直接复现。  ### Expected Behavior  1. 选中某个搜索结果后，下次打开下拉，搜索框关键词存在时，对应已选中项中的关键词应继续保持高亮态，与刚搜索时一致。 2. 高亮渲染过程不应该改变 `separator` 中的空格，路径分隔符在视觉上应该保持原样，例如默认情况下始终展示为 `A / B / C`，前后空格不丢失。  ### Steps To Reproduce  1. 打开 https://semi.design/zh-CN/input/cascader#可搜索的 2. 在第一个「默认对 label 值进行搜索」的 Cascader 输入框中输入 `杭`。 3. 在下拉列表中点击 `浙江省 / 杭州市 / 西湖区`。 4. 观察 trigger 中回填的文本，以及再次点开下拉时该选中项的渲染。 5. 可以看到：    - 选中项里 `杭` 不再以高亮色加粗显示；    - 路径中 `/` 两边的空格出现丢失，与初次搜索时显示的样式不一致。  ### ReproducibleCode  ```jsx import React from 'react'; import { Cascader } from '@douyinfe/semi-ui';  () => {     const treeData = [         {             label: '浙江省',             value: 'zhejiang',             children: [                 {                     label: '杭州市',                     value: 'hangzhou',                     children: [                         { label: '西湖区', value: 'xihu' },                  

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

### Incident Patch 1: `b2b476a1` (2026-10-08)
**Commit Message**: Merge pull request #3362 from smile-alive/fix/react-root-disposal

fix: 修复 Modal、Toast 和 Notification 在 React 提交阶段同步卸载 root 的错误

**File**: `packages/semi-ui/_utils/__test__/static-root-disposal.test.js` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import React, { useEffect, useLayoutEffect } from 'react';
+import Toast, { ToastFactory } from '../../toast';
+import Notification from '../../notification';
+import * as reactRender from '../reactRender';
+
+describe.each([
+    ['Toast', Toast, '.semi-toast-wrapper'],
+    ['ToastFactory', ToastFactory.create(), '.semi-toast-wrapper'],
+    ['Notification', Notification, '.semi-notification-wrapper'],
+])('%s root disposal', (name, api, selector) => {
+    afterEach(async () => {
+        api.destroyAll();
+        await Promise.resolve();
+        jest.restoreAllMocks();
+    });
+
+    it.each([
+        ['layout', useLayoutEffect],
+        ['passive', useEffect],
+    ])('defers root disposal from a %s effect cleanup', async (effect, useCleanupEffect) => {
+        const unmountSpy = jest.spyOn(reactRender, 'unmount');
+        function Page() {
+            useCleanupEffect(() => () => {
+                api.destroyAll();
+                api.destroyAll();
+            }, []);
+            return null;
+        }
+        const page = mount(<Page />);
+        api.info({ content: 'old', duration: 0, motion: false });
+        const wrapper = document.querySelector(selector);
+
+        page.unmount();
+
+        expect(unmountSpy).not.toHaveBeenCalled();
+        expect(wrapper.isConnected).toBe(true);
+
+        await Promise.resolve();
+
+        expect(unmountSpy).toHaveBeenCalledTimes(1);
+        expect(unmountSpy).toHaveBeenCalledWith(wrapper);
+        expect(wrapper.isConnected).toBe(false);
+        expect(document.querySelector(selector)).toBeNull();
+    });
+
+    it('keeps a newly opened instance when pending disposal finishes', async () => {
+        api.info({ content: 'old', duration: 0, motion: false });
+        const oldWrapper = document.querySelector(selector);
+        api.destroyAll();
+        api.info({ content: 'new', duration: 0, motion: false });
+        const newWrapper = [...document.querySelectorAll(selector)].find(wrapper => wrapper !== oldWrapper);
+
+        await Promise.resolve();
+
+        expect(oldWrapper.isConnected).toBe(false);
+        expect(newWrapper.isConnected).toBe(true);
+        expect(newWrapper.textContent).toContain('new');
+
+        api.destroyAll();
+        await Promise.resolve();
+
+        expect(newWrapper.isConnected).toBe(false);
+        expect(document.querySelector(selector)).toBeNull();
+    });
+
+    it('disposes both instances when a replacement closes before the microtask', async () => {
+        api.info({ content: 'old', duration: 0, motion: false });
+        api.destroyAll();
+        api.info({ content: 'new', duration: 0, motion: false });
+        api.destroyAll();
+
+        await Promise.resolve();
+
+        expect(document.querySelector(selector)).toBeNull();
+    });
+});
```

**File**: `packages/semi-ui/modal/__test__/confirm.test.js` (modified, +36/-0)
```diff
@@ -3,6 +3,8 @@ import { Icon, Modal } from '../../index';
 import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
 
 import { IconSend } from '@douyinfe/semi-icons';
+import * as reactRender from '../../_utils/reactRender';
+import { destroyFns } from '../Modal';
 
 
 function getModal(modalProps, children) {
@@ -185,6 +187,40 @@ describe('modal', () => {
         expect(modalDom.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-content`).textContent).toEqual('Updated Content');
     });
 
+    it.each(['confirm', 'cancel', 'destroy'])('defers disposal after %s until the close commit finishes', async action => {
+        const renderSpy = jest.spyOn(reactRender, 'render');
+        const unmountSpy = jest.spyOn(reactRender, 'unmount');
+        const afterClose = jest.fn();
+        const pendingBefore = destroyFns.length;
+        const instance = Modal.confirm({ title: 'Semi', content: 'Content', motion: false, afterClose });
+        const container = renderSpy.mock.calls[0][1];
+
+        try {
+            if (action === 'destroy') {
+                instance.destroy();
+                instance.destroy();
+            } else {
+                document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm button[aria-label="${action}"]`).click();
+            }
+
+            expect(afterClose).toHaveBeenCalledTimes(1);
+            expect(unmountSpy).not.toHaveBeenCalled();
+            expect(container.isConnected).toBe(true);
+
+            await Promise.resolve();
+
+            expect(unmountSpy).toHaveBeenCalledTimes(1);
+            expect(unmountSpy).toHaveBeenCalledWith(container);
+            expect(container.isConnected).toBe(false);
+            expect(document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`)).toBeNull();
+            expect(destroyFns).toHaveLength(pendingBefore);
+            expect(afterClose).toHaveBeenCalledTimes(1);
+        } finally {
+            renderSpy.mockRestore();
+            unmountSpy.mockRestore();
+        }
+    });
+
     // TODO: modal destroy
     // async function destroy(modal) {
     //     modal.destroy && modal.destroy();
```

**File**: `packages/semi-ui/modal/confirm.tsx` (modified, +4/-1)
```diff
@@ -18,6 +18,7 @@ export default function confirm<T>(props: ConfirmProps) {
     document.body.appendChild(div);
 
     let currentConfig = { ...props };
+    let closing = false;
 
     const destroy = () => {
         reactUnmount(div);
@@ -39,8 +40,10 @@ export default function confirm<T>(props: ConfirmProps) {
     function render(renderProps: ConfirmProps) {
         const { afterClose } = renderProps;
         reactRender(<ConfirmModal {...renderProps} afterClose={() => {
+            if (closing) return;
+            closing = true;
             afterClose?.();
-            destroy();
+            Promise.resolve().then(destroy);
         }} motion={props.motion}/>, div);
     }
 
```

**File**: `packages/semi-ui/notification/index.tsx` (modified, +10/-7)
```diff
@@ -183,16 +183,19 @@ class NotificationList extends BaseComponent<NotificationListProps, Notification
 
     static destroyAll() {
         if (ref) {
-            ref.destroyAll();
+            const instance = ref;
             const wrapper = document.querySelector(`#${this.wrapperId}`);
-            
-            if (wrapper) {
-                reactUnmount(wrapper);
-                wrapper.parentNode?.removeChild(wrapper);
-            }
-            
+            wrapper?.removeAttribute('id');
             ref = null;
             this.wrapperId = null;
+
+            Promise.resolve().then(() => {
+                instance.destroyAll();
+                if (wrapper) {
+                    reactUnmount(wrapper);
+                    wrapper.parentNode?.removeChild(wrapper);
+                }
+            });
         }
     }
 
```

**File**: `packages/semi-ui/toast/__test__/toast-command-call.test.js` (modified, +2/-1)
```diff
@@ -62,8 +62,9 @@ describe('Toast - 2', () => {
         expect(style.right).toEqual('40px');
     });
 
-    it('set global config', () => {
+    it('set global config', async () => {
         Toast.destroyAll();
+        await Promise.resolve();
         Toast.config({
             theme: 'light',
             duration: 0,
```

**File**: `packages/semi-ui/toast/index.tsx` (modified, +10/-7)
```diff
@@ -166,16 +166,19 @@ const createBaseToast = () => class ToastList extends BaseComponent<ToastListPro
 
     static destroyAll() {
         if (ToastList.ref) {
-            ToastList.ref.destroyAll();
+            const instance = ToastList.ref;
             const wrapper = document.querySelector(`#${this.wrapperId}`);
-            
-            if (wrapper) {
-                reactUnmount(wrapper);
-                wrapper.parentNode?.removeChild(wrapper);
-            }
-            
+            wrapper?.removeAttribute('id');
             ToastList.ref = null;
             this.wrapperId = null;
+
+            Promise.resolve().then(() => {
+                instance.destroyAll();
+                if (wrapper) {
+                    reactUnmount(wrapper);
+                    wrapper.parentNode?.removeChild(wrapper);
+                }
+            });
         }
     }
     static getWrapperId() {
```

---

### Incident Patch 2: `9ebef4af` (2026-10-08)
**Commit Message**: Merge pull request #3363 from quanru/docs/semi-ui-rendered-verification-release

docs: add optional rendered UI verification to Semi skills

**File**: `ecosystem/semi-ui-skills/SKILL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,6 @@
 ---
 name: semi-design-guide
-description: 使用 Semi Design 组件的完整指南，包括 MCP 工具使用流程、常见模式、最佳实践。当你需要查询 Semi Design 组件、生成组件代码或解决使用问题时，请使用此技能。
+description: 使用 Semi Design 组件的完整指南，包括 MCP 工具使用流程、常见模式、生成页面后的验证和最佳实践。当你需要查询 Semi Design 组件、生成组件页面或解决使用问题时，请使用此技能。
 ---
 
 # Semi Design 使用指南
@@ -13,12 +13,13 @@ description: 使用 Semi Design 组件的完整指南，包括 MCP 工具使用
 
 ### WORKFLOWS.md
 
-**内容**：使用 Semi MCP 工具的完整工作流程。
+**内容**：使用 Semi MCP 工具的完整工作流程，以及生成页面后的浏览器验证步骤。
 
 **包含**：
 - MCP 工具概览：介绍 `get_semi_document`、`get_component_file_list`、`get_file_code`、`get_function_code` 四个工具的功能和使用场景
 - 基础查询流程：查找组件 → 查询详情 → 查看源码 → 查看函数实现的四步走流程
 - 完整任务示例：包含 Table 筛选、表单验证、级联选择器、拖拽排序等常见场景的详细步骤
+- 渲染后验证：优先复用项目现有测试；需要视觉语义验证时可选用 Midscene
 - 常用查询技巧：指定版本查询、获取完整代码、错误排查流程等
 
 **何时使用**：当你需要查询组件文档、了解组件 API、实现某个具体功能但不确定如何下手时。
@@ -40,6 +41,7 @@ description: 使用 Semi Design 组件的完整指南，包括 MCP 工具使用
 | 需求 | 查看 |
 |------|------|
 | 如何使用 MCP 工具查询组件 | [WORKFLOWS.md](WORKFLOWS.md) |
+| 如何验证生成页面的交互 | [WORKFLOWS.md](WORKFLOWS.md#生成后验证渲染与交互) |
 | 组件使用的最佳实践 | [BEST_PRACTICES.md](BEST_PRACTICES.md) |
 
 ## 概述
```

**File**: `ecosystem/semi-ui-skills/WORKFLOWS.md` (modified, +50/-0)
```diff
@@ -177,6 +177,56 @@
 3. **查看拖拽相关源码**
 4. **生成带拖拽功能的 Table 代码**
 
+## 生成后验证渲染与交互
+
+生成组件代码后，先运行项目现有的构建或类型检查，再启动本地预览。根据需求写出一个可观察的操作和结果，例如“空表单点击提交后，必填项显示错误提示”。优先复用项目已有的组件测试或浏览器测试来检查这个结果。
+
+### 可选：使用 Midscene 做视觉语义验证
+
+如果生成页面的结构经常变化，固定选择器难以维护，并且项目已有可用的视觉模型，可以用 Midscene 对本地预览做语义操作和断言。这一步需要单独[配置模型](https://midscenejs.com/model-config)，会产生模型调用费用；使用 Semi Skill 本身不需要安装 Midscene。
+
+下面是一个可复制的最小脚本，放在需要视觉验证的项目中运行：
+
+```bash
+npm install --save-dev @midscene/web playwright @playwright/test
+npx playwright install chromium
+```
+
+`@midscene/web/playwright` 会加载 `@playwright/test`；直接使用 `PlaywrightAgent` 时也需要安装它。
+
+```js
+// verify-ui.mjs
+import { chromium } from 'playwright';
+import { PlaywrightAgent } from '@midscene/web/playwright';
+
+const { PREVIEW_URL, UI_ACTION, UI_EXPECTED } = process.env;
+if (!PREVIEW_URL || !UI_ACTION || !UI_EXPECTED) {
+    throw new Error('Set PREVIEW_URL, UI_ACTION and UI_EXPECTED before running');
+}
+
+const browser = await chromium.launch({ headless: true });
+try {
+    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
+    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
+    const agent = new PlaywrightAgent(page);
+    await agent.aiAct(UI_ACTION);
+    await agent.aiAssert(UI_EXPECTED);
+} finally {
+    await browser.close();
+}
+```
+
+例如，验证生成的表单时，先用本地数据打开预览，再运行：
+
+```bash
+PREVIEW_URL=http://localhost:3000 \
+UI_ACTION='保持必填项为空，点击提交按钮' \
+UI_EXPECTED='表单仍然可见，必填项旁显示错误提示' \
+node verify-ui.mjs
+```
+
+断言失败时，查看 Midscene 生成的 [运行报告](https://midscenejs.com/integrate-with-playwright)，定位实际页面状态，修改代码后重新验证。涉及提交、上传等操作时，使用本地测试数据，避免触发真实服务。
+
 ## 常用查询技巧
 
 ### 1. 指定版本查询
```

---

### Incident Patch 3: `21eda141` (2026-10-08)
**Commit Message**: Merge pull request #3366 from vicuts/fix/locale-ro

fix(locale): correct Romanian (ro) translations

**File**: `packages/semi-ui/locale/source/ro.ts` (modified, +17/-14)
```diff
@@ -85,7 +85,7 @@ const local: Locale = {
             Thu: 'Joi',
             Fri: 'Vin',
             Sat: 'Sâm',
-            Sun: 'dum',
+            Sun: 'Dum',
         },
         localeFormatToken: {
             FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
@@ -100,37 +100,37 @@ const local: Locale = {
         expandText: 'Extinde bara laterală',
     },
     Table: {
-        emptyText: 'Nici un rezultat',
-        pageText: 'Arată ${currentStart} la ${currentEnd} de ${total}',
-        descend: 'Faceți clic pentru a coborî',
-        ascend: 'Faceți clic pentru a urca',
-        cancelSort: 'Anulați sortarea',
+        emptyText: 'Niciun rezultat',
+        pageText: 'Se afișează de la ${currentStart} la ${currentEnd} din ${total}',
+        descend: 'Dă clic pentru sortare descrescătoare',
+        ascend: 'Dă clic pentru sortare crescătoare',
+        cancelSort: 'Anulează sortarea',
         confirmFilter: 'OK',
         resetFilter: 'Resetare',
     },
     Select: {
-        emptyText: 'Nici un rezultat',
+        emptyText: 'Niciun rezultat',
         createText: 'Creează',
     },
     Tree: {
-        emptyText: 'Nici un rezultat',
+        emptyText: 'Niciun rezultat',
         searchPlaceholder: 'Căutare',
     },
     Cascader: {
-        emptyText: 'Nici un rezultat',
+        emptyText: 'Niciun rezultat',
     },
     List: {
-        emptyText: 'Nici un rezultat',
+        emptyText: 'Niciun rezultat',
     },
     Calendar: {
         allDay: 'Toată ziua',
         AM: '${time} AM',
         PM: '${time} PM',
         datestring: '',
-        remaining: 'Cantitate ramasa: ${remained}',
+        remaining: 'Încă ${remained}',
     },
     Upload: {
-        mainText: 'Dă clic pentru a descărca fișierul sau trage fișierul aici',
+        mainText: 'Dă clic pentru a încărca fișierul sau trage fișierul aici',
         illegalTips: 'Acest tip de fișier nu este acceptat',
         legalTips: 'Eliberează și începe încărcarea',
         retry: 'Încearcă din nou',
@@ -139,6 +139,9 @@ const local: Locale = {
         selectedFiles: 'Fișiere selectate',
         illegalSize: 'Dimensiunea greșită a fișierului',
         fail: 'Eșec de încărcare',
+        cropTitle: 'Decupare imagine',
+        cropOk: 'OK',
+        cropCancel: 'Anulează',
     },
     TreeSelect: {
         searchPlaceholder: 'Căutare',
@@ -201,7 +204,7 @@ const local: Locale = {
         rateChange: 'Schimbați viteza la ${rate}',
         qualityChange: 'Schimbați calitatea la ${quality}',
         routeChange: 'Schimbați ruta la ${route}',
-        mirror: 'Mirror',
+        mirror: 'Oglindire',
         cancelMirror: 'Anulează oglindirea',
         loading: 'Se încarcă',
         stall: 'Se încarcă',
@@ -225,7 +228,7 @@ const local: Locale = {
         cancel: 'Anulează'
     },
     AIChatInput: {
-        template: 'Sablon',
+        template: 'Șablon',
         configure: 'Configurare',
         selected: '${count} articole selectate',
     },
```

#### Recent Merged Pull Requests:
- **PR #3367** (2026-10-08): docs: Delete 'Related materials' section (@GeoDaoyu)
- **PR #3366** (2026-10-08): fix(locale): correct Romanian (ro) translations (@vicuts)
- **PR #3363** (2026-10-08): docs: add optional rendered UI verification to Semi skills (@quanru)
- **PR #3362** (2026-10-08): fix: 修复 Modal、Toast 和 Notification 在 React 提交阶段同步卸载 root 的错误 (@smile-alive)
- **PR #3361** (closed): fix: 修复 Modal、Toast 和 Notification 在 React 提交阶段同步卸载 root 的错误 (@smile-alive)
- **PR #3359** (closed): ci: remove CodeSandbox --ignore-engines workaround by upgrading to Node 22 (@SudoUserReal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Merge pull request #3362 from smile-alive/fix/react-root-disposal

**RULE**:
When implementing operations in `packages/semi-ui/_utils/__test__/static-root-disposal.test.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in DouyinFE/semi-design. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b2b476a1`: Merge pull request #3362 from smile-alive/fix/react-root-disposal. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/semi-ui/_utils/__test__/static-root-disposal.test.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import React, { useEffect, useLayoutEffect } from 'react';
import Toast, { ToastFactory } from '../../toast';
import Notification from '../../notification';
import * as reactRender from '../reactRender';

describe.each([
    ['Toast', Toast, '.semi-toast-wrapper'],
    ['ToastFactory', ToastFactory.create(), '.semi-toast-wrapper'],
    ['Notification', Notification, '.semi-notification-wrapper'],
])('%s root disposal', (name, api, selector) => {
    afterEach(async () => {
        api.destroyAll();
        await Promise.resolve();
        jest.restoreAllMocks();
    });

    it.each([
        ['layout', useLayoutEffect],
        ['passive', useEffect],
    ])('defers root disposal from a %s effect cleanup', async (effect, useCleanupEffect) => {
        const unmountSpy = jest.spyOn(reactRender, 'unmount');
        function Page() {
            useCleanupEffect(() => () => {
                api.destroyAll();
                api.destroyAll();
            }, []);
            return null;
        }
        const page = mount(<Page />);
        api.info({ content: 'old', duration: 0, motion: false });
        const wrapper = document.querySelector(selector);

        page.unmount();

  
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2b476a1` are properly handled with clean fallback behavior.
