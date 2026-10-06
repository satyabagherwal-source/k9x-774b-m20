# Forensic Learning Record (Deep Inspection): DouyinFE/semi-design

> **Canonical Artifact**: `07_PROJECT_LEARNING/douyinfe-semi-design-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DouyinFE/semi-design](https://github.com/DouyinFE/semi-design))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:30.853Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DouyinFE/semi-design`
- **Description**: 🚀A modern, comprehensive, flexible design system and React UI library, AI-friendly built-in.🎨Provide 3000+ Design Tokens, easy to build your design system. Make Semi Design to Any Design.🧑🏻‍💻 Design to Code in one click
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10400 stars

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

### Core Architecture Module: `packages/semi-animation-react/src/utils/invokeFns.ts`
```
export default function invokeFns(fns: any[], args: any[] = []) {
    if (Array.isArray(fns) && fns.length) {
        fns.forEach(fn => {
            if (typeof fn === 'function') {
                fn(...args);
            }
        });
    }
}

```

### Core Architecture Module: `packages/semi-animation-react/src/utils/noop.ts`
```
export default function noop() { }
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3296** (2026-05-21): **[BUG][Cascader] 搜索忽略大小写，但高亮要求精确匹配，命中结果可能没有高亮**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Cascader  ### Semi Version  @douyinfe/semi-ui@2.98.0（官网最新版本可复现）  ### Current Behavior  Cascader 默认的 `filterTreeNode`（传入 `true` 走内置过滤器）实现是 **忽略大小写** 的：  ```ts // packages/semi-foundation/cascader/util.ts filterFn = (targetVal: string, val: string) => {     const input = targetVal.toLowerCase();     return val.toLowerCase().includes(input); }; ```  而下拉项的高亮渲染却是 **大小写敏感** 的：  ```tsx // packages/semi-ui/cascader/item.tsx highlight = (searchText) => {     ...     if (typeof item === 'string' && includes(item, keyword)) {         item.split(keyword).forEach(...);     }     ... }; ```  因此在选项 label 与搜索关键词大小写不一致的场景下，会出现「搜索能匹配上、但下拉中命中项里的关键词完全没有高亮」的现象。  ### Expected Behavior  搜索的匹配规则与高亮的匹配规则应保持一致：  - 当 `filterTreeNode={true}` 走内置过滤器（不区分大小写）时，高亮也应不区分大小写，按命中位置加粗显示原文。 - 当用户传入自定义 `filterTreeNode` 函数时，至少应让高亮策略对大小写不敏感的命中也能够正确加亮（或暴露相应配置/约定）。  ### Steps To Reproduce  1. 打开 [官网 Cascader「可搜索的」示例](https://semi.design/zh-CN/input/cascader#可搜索的)。 2. 在 demo 中将 treeData 修改为带有英文大写字母的数据（或直接用下方的 ReproducibleCode 在「在线编辑」里运行）。 3. 在搜索框中输入小写 `bei`。 4. 观察下拉结果：可以看到 `Beijing / Haidian` 等项被正确过滤出来，但其中的 `Bei` 没有任何高亮样式。  ### ReproducibleCode  ```jsx import React from 'react'; import { Cascader } from '@douyinfe/semi-ui';  () => {     const treeData = [         {             label: 'Beijing',             value: 'beijing',             children: [                 { label: 'Haidian', value: 'haidian' },             

- **Issue #3295** (2026-05-21): **[BUG][Cascader] 搜索选中后，选项的高亮丢失，且 separator 中的空格被吞掉**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Cascader  ### Semi Version  @douyinfe/semi-ui@2.98.0（官网最新版本可复现）  ### Current Behavior  在可搜索的 Cascader（`filterTreeNode` 开启）中：  1. 输入关键词进行搜索后，下拉中命中的选项会以「父节点 / 子节点 / 叶子节点」这种带空格的路径形式展示，且关键词文字会被加粗高亮。 2. 当点击其中一项进行选中后，再次点开下拉，会发现：    - **高亮丢失**：刚刚选中的那一项里，关键词不再被高亮（虽然搜索框里的关键词仍然存在）。    - **路径中的空格丢失**：路径分隔符 `separator` 默认为 ` / `（前后各有一个空格）。在某些渲染分支下（比如关键词刚好与 `separator` 相邻、或者 `searchText` 中混入了 `separator` 字符串），高亮拆分后路径里 ` / ` 两边的空格会被吃掉，视觉上变成了 `浙江省/杭州市/西湖区`，与未搜索时的展示不一致。  可在 [官网 Cascader「可搜索的」示例](https://semi.design/zh-CN/input/cascader#可搜索的) 直接复现。  ### Expected Behavior  1. 选中某个搜索结果后，下次打开下拉，搜索框关键词存在时，对应已选中项中的关键词应继续保持高亮态，与刚搜索时一致。 2. 高亮渲染过程不应该改变 `separator` 中的空格，路径分隔符在视觉上应该保持原样，例如默认情况下始终展示为 `A / B / C`，前后空格不丢失。  ### Steps To Reproduce  1. 打开 https://semi.design/zh-CN/input/cascader#可搜索的 2. 在第一个「默认对 label 值进行搜索」的 Cascader 输入框中输入 `杭`。 3. 在下拉列表中点击 `浙江省 / 杭州市 / 西湖区`。 4. 观察 trigger 中回填的文本，以及再次点开下拉时该选中项的渲染。 5. 可以看到：    - 选中项里 `杭` 不再以高亮色加粗显示；    - 路径中 `/` 两边的空格出现丢失，与初次搜索时显示的样式不一致。  ### ReproducibleCode  ```jsx import React from 'react'; import { Cascader } from '@douyinfe/semi-ui';  () => {     const treeData = [         {             label: '浙江省',             value: 'zhejiang',             children: [                 {                     label: '杭州市',                     value: 'hangzhou',                     children: [                         { label: '西湖区', value: 'xihu' },                  

- **Issue #2908** (2026-05-09): **[JsonViewer] 多行替换时光标位置不符合预期**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  JsonViewer  ### Semi Version  latest   ### Current Behavior 多行替换时光标位置不符合预期 ![Image](https://github.com/user-attachments/assets/d41425aa-0486-477b-9218-116af7c7828e)  ### Expected Behavior    ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown  ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2870** (2025-06-20): **[DatePicker] type monthRange 且英文 locale 下点击月份后，不会自动滚动到非禁用项目**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  DatePicker  ### Semi Version  latest  ### Current Behavior  type monthRange 且在英文 locale 下点击月份后，不会自动滚动到非禁用项目 ![Image](https://github.com/user-attachments/assets/27eb540f-8040-4cc4-aeb0-50a0c9ce7aec)  ### Expected Behavior  对其中文 locale 下的表现，在type monthRange 且英文 locale 下点击月份后，会自动滚动到非禁用项目  ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown import React from 'react'; import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB'; import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN'; import { LocaleProvider } from '@douyinfe/semi-ui';  class I18nDemo extends React.Component {     constructor(props) {         super(props);     }     render() {            return (             <>                   <LocaleProvider locale={en_GB}>                     <DatePicker type="monthRange" onChange={(date, dateString) => console.log(dateString)} />                 </LocaleProvider>                 <LocaleProvider locale={zh_CN}>                     <DatePicker type="monthRange" onChange={(date, dateString) => console.log(dateString)} />                 </LocaleProvider>             </>         );     } } ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2863** (2026-03-20): **[TEST] 时间范围类型的 DatePicker 组件中的 Input 在 active/hover 时，背景色样式优先级不够高导致样式被覆盖**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  DatePicker  ### Semi Version  _No response_  ### Current Behavior  时间范围类型的 DatePicker 组件中的 Input 在 active/hover 时，背景色样式优先级不够高导致样式被覆盖  ### Expected Behavior  时间范围类型的 DatePicker 组件中的 Input 在 active/hover 时，背景色正确  ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown  ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2853** (2025-06-09): **[Select] Select 在分组 label 为 reactnode 情况下filter 搜索展示错误**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Select  ### Semi Version  latest  ### Current Behavior  先搜索 a，再搜索 b，列表中出现两个 b  ### Expected Behavior  先搜索 a，再搜索 b，列表中仍然只有一个 b  ### Steps To Reproduce  ![Image](https://github.com/user-attachments/assets/6a7a0ad7-d1f4-4235-85ec-499bc371f735)  ### ReproducibleCode  ```markdown import React from 'react'; import { Select } from '@douyinfe/semi-ui';  () => (     <Select placeholder="" style={{ width: 180 }} filter>         <Select.OptGroup label={<div>a</div>} key="a">             <Select.Option value="a-1">a-1</Select.Option>             <Select.Option value="a-2">a-2</Select.Option>         </Select.OptGroup>         <Select.OptGroup label={<div>b</div>} key="b">             <Select.Option value="b-1">b-1</Select.Option>             <Select.Option value="b-2">b-2</Select.Option>         </Select.OptGroup>         <Select.OptGroup label={<div>c</div>} key="c">             <Select.Option value="c-1">c-1</Select.Option>         </Select.OptGroup>     </Select> ); ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2801** (2026-04-08): **[BUG] Resizable 中的 handler 的 z-index 过高，会浮在 modal 之上**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Resizable  ### Semi Version  2.78.0  ### Current Behavior  ![Image](https://github.com/user-attachments/assets/723f8b94-e912-444f-898a-166960df1735)  ### Expected Behavior  handler 不应该在弹出层的上方  ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown import React, { useState } from 'react'; import { ResizeItem, ResizeHandler, ResizeGroup, Toast } from '@douyinfe/semi-ui';  function Demo() {     const [text, setText] = useState('Drag to resize');     const [visible, setVisible] = useState(false);     const showDialog = () => {         setVisible(true);     };     const handleOk = () => {         setVisible(false);         console.log('Ok button clicked');     };     const handleCancel = () => {         setVisible(false);         console.log('Cancel button clicked');     };     const handleAfterClose = () => {         console.log('After Close callback executed');     };     return (         <div style={{ width: '1000px', height: '100px' }}>             <ResizeGroup direction="horizontal">                 <ResizeItem                     style={{                         backgroundColor: 'rgba(var(--semi-grey-1), 1)',                         border: 'var(--semi-color-border) 1px solid',                     }}                     defaultSize={'400px'}                     min={'10%'}                     onChange={() => {                         setText('resizing')
  **Post-Mortem & Fix Analysis**:
  > modal 有个zIndex属性来控制遮罩的层级 @YyumeiZhang 

- **Issue #2781** (2025-04-08): **[BUG] collapsible Tabs 设置 activeKey 不会自动滚动到当前 active tab 的位置**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Tabs  ### Semi Version  latest  ### Current Behavior  collapsible Tabs 设置 activeKey 不会自动滚动到当前 active tab 的位置  ### Expected Behavior  collapsible Tabs 设置 activeKey 初始化时希望能自动滚动到当前 active tab 的位置   ### ReproducibleCode  ```markdown import React from 'react'; import { Tabs, TabPane } from '@douyinfe/semi-ui';  class App extends React.Component {     render() {         return (             <Tabs style={{ width: '60%', margin: '20px' }} defaultActiveKey="Tab-7" type="card" collapsible>                 {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (                     <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>                         Content of card tab {i}                     </TabPane>                 ))}             </Tabs>         );     } } ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else? **问题归因** 现在 tabs 仅在 componentDidUpdate 的时候根据 activeKey 和 collapsible 判断需不需要执行 scrollActiveTabItemIntoView 操作，需要手动改变一下 activeKey 的值才能成功执行 scrollActiveTabItemIntoView，感觉这个行为像 bug，可以按照下述方式临时规避下。 ```markdown import React from 'react'; import { Tabs, TabPane } from '@douyinfe/semi-ui'; class App extends React.Component {      constructor(props) {         super(props);         this.state = {             activeKey: 'Tab-8'          };     }     componentDidMount() {         this.setState({ activeKey: 'Tab-9' });     }     render() {         return (             

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

### Incident Patch 1: `2a4ec362` (2026-09-15)
**Commit Message**: Merge pull request #3348 from chuhuangvio-itch/fix/unhandled-regexp-syntaxerror-on-user-inp

fix(timePicker): escape regExp special characters in format separator to avoid SyntaxError

**File**: `packages/semi-foundation/timePicker/utils/index.ts` (modified, +2/-1)
```diff
@@ -131,7 +131,8 @@ export const isTimeFormatLike = (time: string, formatToken: string) => {
     const hmsReg = /[H|m|s]{1,2}/;
     const formatSplitted = formatToken.split(formatNotSupportChReg); // => ['HH', 'mm'];
     const timeSeparator = formatToken.replace(formatSupportChReg, ''); // => :
-    const timeReg = new RegExp(`[${timeSeparator}]`, 'g'); // => /[:]/g
+    const escapedTimeSeparator = timeSeparator.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'); // escape regExp special characters to avoid invalid regExp, e.g. format="HH\\mm"
+    const timeReg = new RegExp(`[${escapedTimeSeparator}]`, 'g'); // => /[:]/g
     const timeSplitted = time.split(timeReg); // => ['12', '0]
 
     if (formatSplitted.length !== timeSplitted.length) {
```

**File**: `packages/semi-ui/timePicker/__test__/timePicker.test.js` (modified, +5/-0)
```diff
@@ -300,6 +300,11 @@ describe(`TimePicker`, () => {
             ['上午 12:00:02', 'a h:mm:ss', true],
             ['上午 12:00:0', 'a h:mm:ss', false],
             ['上午 12:0:00', 'a h:mm:ss', false],
+            // format separator containing a regExp-special character should not throw (regression test,
+            // previously threw "SyntaxError: Invalid regular expression" because the separator was
+            // interpolated into a RegExp character class without escaping)
+            ['12\\00', 'HH\\mm', true],
+            ['12.00', 'HH.mm', true],
         ];
 
         testCases.forEach(test => {
```

---

### Incident Patch 2: `2e0964d0` (2026-09-15)
**Commit Message**: Merge pull request #3355 from toyeshhm/fix-doc-typos

docs: fix typos across component docs and contributing guide

**File**: `CONTRIBUTING-en-US.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ cd semi-design
 ```bash
 git checkout -b <TOPIC_BRANCH_NAME>
 ```
->Before installing the enviroment,make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
+>Before installing the environment, make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
 ```base
 corepack enable
 ```
```

**File**: `content/advanced/design-to-code/index-en-US.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ For more detailed usage instructions, you can visit <a href="/code" target="_bla
 
 Here is a link to the Figma example mockup and its corresponding Codesandbox transpiled using the Semi Figma plugin.
 
-| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Desciption                                                                                          | Codesandbox                                                                                  |
+| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Description                                                                                          | Codesandbox                                                                                  |
 |------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
 | <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=5%3A2092' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/simple-demo-1.jpg' style={{ width:  400 }} /></a>                                               | A module with simple content without components                                                   | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/w1z9yx' target="_blank" rel="noreferrer noopener">Link</a> |
 | <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A275' target="_blank" rel="noreferrer noopener"><img src='https://lf3-files.qingfuwucdn.net/obj/inspirecloud-file/baas/tt38q7/2468f1c4f1756bc0_1676603194364.png' style={{ width:  400 }} /></a>                                                  | Modules that do not contain components, have more content, or have a slightly more complex layout | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/905ncn' target="_blank" rel="noreferrer noopener">Link</a> |
```

**File**: `content/basic/button/index-en-US.md` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ function ButtonDemo() {
         <div>
             <Button disabled>Disabled</Button>
             <Button disabled theme="borderless">No background and disabled</Button>
-            <Button disabled theme="light">Light and disbaled</Button>
+            <Button disabled theme="light">Light and disabled</Button>
             <Button disabled theme="borderless" type="primary">No background, primary and disabled</Button>
             <Button disabled theme="solid" type="warning">Solid, warning and disabled</Button>
         </div>
```

**File**: `content/basic/typography/index-en-US.md` (modified, +4/-4)
```diff
@@ -46,7 +46,7 @@ function Demo() {
 
 ### Text
 
-Text component has different built-in styles. You could also pass `icon` to use the build-in styles for icon. Different from passing icon to children, using `icon` for link will have no underline in compliance with Semi Design principles.
+Text component has different built-in styles. You could also pass `icon` to use the built-in styles for icon. Different from passing icon to children, using `icon` for link will have no underline in compliance with Semi Design principles.
 
 ```jsx live=true
 import React from 'react';
@@ -427,7 +427,7 @@ function Demo() {
             <Text 
                 ellipsis={{ 
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation' }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation' }
                     }
                 }}
                 style={{ width: 150 }}
@@ -438,7 +438,7 @@ function Demo() {
             <Text 
                 ellipsis={{ 
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation', className: 'components-typography-demo' }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation', className: 'components-typography-demo' }
                     }
                 }}
                 style={{ width: 150 }}
@@ -449,7 +449,7 @@ function Demo() {
             <Text 
                 ellipsis={{
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation', style: { wordBreak: 'break-all' } }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation', style: { wordBreak: 'break-all' } }
                     }
                 }}
                 style={{ width: 150 }}
```

**File**: `content/ecosystem/faq/index-en-US.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ No plans for this. Specific reasons: [Issue 311](https://github.com/DouyinFE/sem
 
 
 #### What is the relationship between Semi 2.x (open source version) and Semi 1.x?
- - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, bettter a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
+ - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, better a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
  - v1.x has stopped iterative maintenance, no more feature additions or complex changes, only necessary bug fix changes are provided.
  - For new projects, we recommend that you directly use 2.x [@douyin/semi-ui](https://semi.design) for development. For existing projects, we also recommend that you upgrade as soon as possible. In order to reduce the cost of upgrading, we provide a cli tool one-click migration (@ies/semi-codemod-v2) that can help you automatically complete up to 90% of the migration and modification (limited by the AST implementation principle, there are still a small number of cases that require manual labor review modification, but not much 😉)
  - Upgrade from Semi 1.x to Semi 2.x for detailed operation steps [From v1 to v2](https://semi.design/en-US/start/update-to-v2)
```

**File**: `content/ecosystem/update-to-v2/index-en-US.md` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ All warning logs will be output in the semi-codemod-log.log file under ProjectPa
 
 ##### 4. Update the usage of Css Variable
 
-If you use Semi's css variable in your code, in addition to using semi-codemod-v2, you also need to use the style-lint tool we provide to automatically update all css varable usage
+If you use Semi's css variable in your code, in addition to using semi-codemod-v2, you also need to use the style-lint tool we provide to automatically update all css variable usage
 
 - Install Semi style-lint package
 
```

**File**: `content/input/form/index-en-US.md` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ Properties are hijacked by Form, so
 
 <Notice type="primary" title="Notice">
 
-1. No longer need to manually bind the onChange event and update the value as controled component. But you can continue to listen onChange events for the latest values if you want
+1. No longer need to manually bind the onChange event and update the value as controlled component. But you can continue to listen onChange events for the latest values if you want
 2. You cannot set the state of component with attributes such as `value`, `defaultValue`, `checked`, `defaultChecked`, etc. The default value can be set by Field's `initValue` or Form's `unitValues`
 3. You should not modify the value of Form State directly, all changes to the data in the Form should be done by providing `formApi`, `fieldApi`
 
@@ -1145,7 +1145,7 @@ class FormLevelValidateSync extends React.Component {
             errors.sex = 'must be woman';
         }
         errors.familyName = [
-            { before: 'before errror balabala ', after: 'after error balabala' },
+            { before: 'before error balabala ', after: 'after error balabala' },
             'familyName[1] error balabala'
         ];
         return errors;
```

**File**: `content/input/form/index.md` (modified, +2/-2)
```diff
@@ -1222,7 +1222,7 @@ class FormLevelValidateSync extends React.Component {
             errors.sex = 'must be woman';
         }
         errors.familyName = [
-            { before: 'before errror balabala ', after: 'after error balabala' },
+            { before: 'before error balabala ', after: 'after error balabala' },
             'familyName[1] error balabala'
         ];
         return errors;
@@ -2525,7 +2525,7 @@ const { ErrorMessage } = Form;
 | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
 | valueKey          | 组件表示值的属性，如 Switch、Radio 的是'checked'，Input 的是'value'                                                                                                                                                                           | 'value'    |
 | onKeyChangeFnName | 组件值变化时的回调函数，一般为'onChange'                                                                                                                                                                                                      | 'onChange' |
-| valuePath         | 值属性在回调函数中第一个参数的路径,如 Radio 的 onChange(e.target.checked)，那么该值需要设为 target.checkd；RadioGroup 的 onChange(e.target.value)，该值为'target.value'；若第一个参数就是值本身，无需再往下取值，该项不需要设                 |            |
+| valuePath         | 值属性在回调函数中第一个参数的路径,如 Radio 的 onChange(e.target.checked)，那么该值需要设为 target.checked；RadioGroup 的 onChange(e.target.value)，该值为'target.value'；若第一个参数就是值本身，无需再往下取值，该项不需要设                 |            |
 
 ## Accessibility
 
```

---

### Incident Patch 3: `381e57be` (2026-09-15)
**Commit Message**: Merge pull request #3357 from DouyinFE/codex/fix-3350-radio-icon-center

【Auto】Fix: Radio 选中白点在 Safari 下偏移（显式 SVG 尺寸替代 em）

**File**: `packages/semi-foundation/radio/radio.scss` (modified, +9/-0)
```diff
@@ -236,6 +236,15 @@ $inner-width: $width-icon-medium;
                 width: 100%;
                 height: 100%;
                 font-size: 14px;
+
+                // #3350: 显式设置 svg 尺寸并 block 化，替代 svg 自带的 width/height="1em"。
+                // Safari 对以 em 指定尺寸的内联 SVG 存在渲染偏差，会导致 checked 状态
+                // 的白点视觉偏移；100% 让 svg 与图标容器严格同尺寸，无偏移空间。
+                svg {
+                    display: block;
+                    width: 100%;
+                    height: 100%;
+                }
             }
         }
     }
```

---

### Incident Patch 4: `f4b63a35` (2026-09-15)
**Commit Message**: fix(radio): explicit svg sizing for checked icon to avoid Safari offset (#3350)

**File**: `packages/semi-foundation/radio/radio.scss` (modified, +9/-0)
```diff
@@ -236,6 +236,15 @@ $inner-width: $width-icon-medium;
                 width: 100%;
                 height: 100%;
                 font-size: 14px;
+
+                // #3350: 显式设置 svg 尺寸并 block 化，替代 svg 自带的 width/height="1em"。
+                // Safari 对以 em 指定尺寸的内联 SVG 存在渲染偏差，会导致 checked 状态
+                // 的白点视觉偏移；100% 让 svg 与图标容器严格同尺寸，无偏移空间。
+                svg {
+                    display: block;
+                    width: 100%;
+                    height: 100%;
+                }
             }
         }
     }
```

---

### Incident Patch 5: `d418618e` (2026-09-15)
**Commit Message**: Merge pull request #3339 from kakiuwang-ui/fix/resize-group-display-none-recalc

fix(Resizable): recalculate ResizeGroup item sizes after it becomes visible (#3336)

**File**: `packages/semi-foundation/resizable/group/index.ts` (modified, +19/-0)
```diff
@@ -73,6 +73,9 @@ export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, a
     totalMinus: number;
     itemPercentMap: Map<number, number>; // 内部维护一个百分比数组，消除浮点计算误差
     type?: ResizeEventType;
+    // 首次 initSpace 时 group 是否可测量（非 display:none）。
+    // Whether the group was measurable (not inside display:none) on the first initSpace run. #3336
+    sizeInitialized: boolean = false;
 
 
     init(): void {
@@ -81,6 +84,19 @@ export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, a
         this.itemPercentMap = new Map();
         this.initSpace();
     }
+
+    /**
+     * When the group is initially mounted inside a display:none container, its own size
+     * and the handler sizes are all 0, so item sizes are computed with a `- 0px` handler
+     * offset and never corrected once the container becomes visible. Recalculate the layout
+     * the first time the group becomes measurable. Once it has a valid size, later resizes
+     * must NOT re-run initSpace, otherwise the user's manual drag results would be reset. #3336
+     */
+    handleGroupResize = () => {
+        if (!this.sizeInitialized && this.groupSize > 0) {
+            this.initSpace();
+        }
+    }
     get window(): Window | null {
         return this.groupRef.ownerDocument.defaultView as Window ?? null;
     }
@@ -231,6 +247,9 @@ export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, a
         // calculate accurate space for group item
         let handlerSizes = new Array(this._adapter.getHandlerCount()).fill(0);
         let parentSize = this.groupSize;
+        // Mark whether the group is measurable now; if not (e.g. inside display:none),
+        // handleGroupResize will re-run initSpace once it becomes visible. #3336
+        this.sizeInitialized = parentSize > 0;
         this.totalMinus = 0;
         for (let i = 0; i < this._adapter.getHandlerCount(); i++) {
             let handlerSize = direction === 'horizontal' ? this._adapter.getHandler(i).offsetWidth : this._adapter.getHandler(i).offsetHeight;
```

**File**: `packages/semi-ui/resizable/__test__/resizeGroupFoundation.test.js` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { ResizeGroupFoundation } from '../../../semi-foundation/resizable/group';
+
+/**
+ * Reproduces #3336 at the foundation level: when a ResizeGroup is mounted inside a
+ * display:none container, the group and its handlers report offset size 0, so item
+ * sizes are computed with a `- 0px` handler offset. After the container becomes
+ * visible the sizes must be recalculated (handleGroupResize), otherwise the two items
+ * plus the handler overflow the group by the handler size.
+ *
+ * The jsdom ResizeObserver mock never fires a callback, so we drive handleGroupResize
+ * directly to emulate the group becoming measurable.
+ */
+function createMockAdapter({ groupEl, handlerEls, itemEls, direction }) {
+    return {
+        getProp: key => ({ direction }[key]),
+        getProps: () => ({ direction }),
+        getState: () => undefined,
+        getStates: () => ({}),
+        getContext: () => undefined,
+        getContexts: () => ({}),
+        getGroupRef: () => groupEl,
+        getHandler: i => handlerEls[i],
+        getHandlerCount: () => handlerEls.length,
+        getItem: i => itemEls[i],
+        getItemCount: () => itemEls.length,
+        getItemMin: () => undefined,
+        getItemMax: () => undefined,
+        getItemDefaultSize: () => undefined,
+        getItemStart: () => undefined,
+        getItemChange: () => undefined,
+        getItemEnd: () => undefined,
+        registerEvents: () => {},
+        unregisterEvents: () => {},
+    };
+}
+
+const makeEl = size => ({ offsetWidth: size, offsetHeight: size, style: {} });
+
+describe('ResizeGroupFoundation - recalc after becoming visible (#3336)', () => {
+    it('recalculates item sizes with the handler offset once the group is measurable', () => {
+        // vertical group, 2 items + 1 handler, mounted inside display:none => all sizes 0
+        const groupEl = makeEl(0);
+        const handlerEls = [makeEl(0)];
+        const itemEls = [makeEl(0), makeEl(0)];
+        const adapter = createMockAdapter({ groupEl, handlerEls, itemEls, direction: 'vertical' });
+        const foundation = new ResizeGroupFoundation(adapter);
+
+        foundation.init();
+
+        // initial (hidden) layout: 50% each, handler offset 0 => `- 0px`
+        expect(foundation.sizeInitialized).toBe(false);
+        expect(itemEls[0].style.height).toContain('- 0px');
+        expect(itemEls[1].style.height).toContain('- 0px');
+
+        // become visible: group 100px tall, handler 10px
+        groupEl.offsetHeight = 100;
+        groupEl.offsetWidth = 100;
+        handlerEls[0].offsetHeight = 10;
+        handlerEls[0].offsetWidth = 10;
+
+        foundation.handleGroupResize();
+
+        // recalculated: each item reserves half of the handler (10 / 2 = 5px)
+        expect(foundation.sizeInitialized).toBe(true);
+        expect(itemEls[0].style.height).toBe('calc(50% - 5px)');
+        expect(itemEls[1].style.height).toBe('calc(50% - 5px)');
+    });
+
+    it('does not re-run initSpace on later resizes (keeps user drag results)', () => {
+        const groupEl = makeEl(100);
+        const handlerEls = [makeEl(10)];
+        const itemEls = [makeEl(50), makeEl(50)];
+        const adapter = createMockAdapter({ groupEl, handlerEls, itemEls, direction: 'vertical' });
+        const foundation = new ResizeGroupFoundation(adapter);
+
+        foundation.init();
+        expect(foundation.sizeInitialized).toBe(true);
+
+        // simulate the user having dragged item 0
+        itemEls[0].style.height = 'calc(70% - 5px)';
+        itemEls[1].style.height = 'calc(30% - 5px)';
+
+        // a later group resize must not reset the layout back to the default 50/50
+        groupEl.offsetHeight = 200;
+        foundation.handleGroupResize();
+
+        expect(itemEls[0].style.height).toBe('calc(70% - 5px)');
+        expect(itemEls[1].style.height).toBe('calc(30% - 5px)');
+    });
+});
```

**File**: `packages/semi-ui/resizable/group/resizeGroup.tsx` (modified, +13/-0)
```diff
@@ -72,6 +72,7 @@ class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {
     groupRef: React.RefObject<HTMLDivElement>;
     groupSize: number;
     availableSize: number;
+    resizeObserver: ResizeObserver | null = null;
     static contextType = ResizeContext;
     context: ResizeGroupProps;
     // 在context中使用的属性需要考虑在strictMode下会执行两次，所以用Map来维护
@@ -89,6 +90,14 @@ class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {
         this.foundation.init();
         // 监听窗口大小变化，保证一些限制仍生效
         window.addEventListener('resize', this.foundation.ensureConstraint);
+        // 当 group 初次挂载在 display:none 容器内时 offset 尺寸为 0，item 尺寸会以 0px handler 计算且不再更新；
+        // 监听 group 自身尺寸变化，待其可见（可测量）后重新计算一次布局。#3336
+        if (typeof ResizeObserver !== 'undefined' && this.groupRef.current) {
+            this.resizeObserver = new ResizeObserver(() => {
+                this.foundation.handleGroupResize();
+            });
+            this.resizeObserver.observe(this.groupRef.current);
+        }
     }
 
     componentDidUpdate(prevProps: ResizeGroupProps) {
@@ -108,6 +117,10 @@ class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {
     componentWillUnmount() {
         this.foundation.destroy();
         window.removeEventListener('resize', this.foundation.ensureConstraint);
+        if (this.resizeObserver) {
+            this.resizeObserver.disconnect();
+            this.resizeObserver = null;
+        }
     }
 
     get adapter(): ResizeGroupAdapter<ResizeGroupProps, ResizeGroupState> {
```

---

### Incident Patch 6: `f777b9a8` (2026-09-15)
**Commit Message**: Merge pull request #3352 from dvd233/fix/modal-esc-top-only

fix(modal): ESC closes only the top-most modal

**File**: `packages/semi-foundation/modal/modalContentFoundation.ts` (modified, +22/-0)
```diff
@@ -30,6 +30,15 @@ export interface ModalContentAdapter extends DefaultAdapter<ModalContentProps, M
     prevFocusElementReFocus: () => void
 }
 
+/**
+ * Stack of `handleKeyDown` handlers for modals that currently listen on
+ * `document`. Every ModalContent registers its own document-level keydown
+ * listener, so `stopPropagation()` cannot stop sibling listeners on the same
+ * node — one ESC used to close every open dialog. Only the most recently
+ * mounted (top-most) listener should respond.
+ */
+const escListenerStack: Array<(e: any) => void> = [];
+
 export default class ModalContentFoundation extends BaseFoundation<ModalContentAdapter> {
 
     constructor(adapter: ModalContentAdapter) {
@@ -53,6 +62,12 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
     handleKeyDown = (e: any) => {
         const { closeOnEsc } = this.getProps();
         if (closeOnEsc && e.keyCode === KeyCode.ESC) {
+            // Multiple open modals each registered a document-level keydown
+            // listener; only the top-most (most recently mounted) one may
+            // close, so a single ESC closes dialogs one at a time.
+            if (escListenerStack[escListenerStack.length - 1] !== this.handleKeyDown) {
+                return;
+            }
             e.stopPropagation();
             this.close(e);
             return;
@@ -61,10 +76,17 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
 
     handleKeyDownEventListenerMount() {
         this._adapter.addKeyDownEventListener();
+        if (this.getProps().closeOnEsc) {
+            escListenerStack.push(this.handleKeyDown);
+        }
     }
 
     handleKeyDownEventListenerUnmount() {
         this._adapter.removeKeyDownEventListener();
+        const index = escListenerStack.indexOf(this.handleKeyDown);
+        if (index !== -1) {
+            escListenerStack.splice(index, 1);
+        }
     }
 
     getMouseState() {
```

**File**: `packages/semi-ui/modal/__test__/modal.test.js` (modified, +45/-0)
```diff
@@ -336,4 +336,49 @@ describe('modal', () => {
         expect(modal.exists(`div.${testClass}`)).toEqual(true);
         modal.unmount();
     });
+
+    it('esc closes only the top-most modal when multiple are open', () => {
+        const onCancelOuter = jest.fn();
+        const onCancelInner = jest.fn();
+        class StackedModals extends React.Component {
+            state = {
+                outerVisible: true,
+                innerVisible: true,
+            };
+
+            handleOuterCancel = (e) => {
+                onCancelOuter(e);
+                this.setState({ outerVisible: false });
+            };
+
+            handleInnerCancel = (e) => {
+                onCancelInner(e);
+                this.setState({ innerVisible: false });
+            };
+
+            render() {
+                return (
+                    <>
+                        {getModal({ visible: this.state.outerVisible, onCancel: this.handleOuterCancel })}
+                        {getModal({ visible: this.state.innerVisible, onCancel: this.handleInnerCancel })}
+                    </>
+                );
+            }
+        }
+
+        const stacked = mount(<StackedModals />, { attachTo: document.getElementById('container') });
+
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+
+        // Only the most recently mounted (top-most) modal should close.
+        expect(onCancelInner).toHaveBeenCalledTimes(1);
+        expect(onCancelOuter).toHaveBeenCalledTimes(0);
+
+        // After the top modal unmounts, the next ESC reaches the outer one.
+        stacked.update();
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+        expect(onCancelOuter).toHaveBeenCalledTimes(1);
+
+        stacked.unmount();
+    });
 })
```

---

### Incident Patch 7: `17055c72` (2026-09-15)
**Commit Message**: Merge pull request #3356 from DouyinFE/codex/fix-3354-datepicker-popup-flash

【Auto】Fix: DatePicker 弹层打开时位置闪烁（等待尺寸稳定后定位）

**File**: `packages/semi-ui/tooltip/__test__/tooltip.test.js` (modified, +55/-2)
```diff
@@ -376,7 +376,8 @@ describe(`Tooltip`, () => {
       // Browser lays out portal-inner, then ResizeObserver fires
       laidOut = true;
       observers.forEach(o => o.cb && o.cb());
-      await sleep(10);
+      // #3354: 首次定位会等待尺寸稳定（32ms 稳定窗口）后再执行
+      await sleep(60);
 
       // The layout-driven ResizeObserver callback should have triggered positioning
       expect(calcSpy.called).toBe(true);
@@ -411,7 +412,8 @@ describe(`Tooltip`, () => {
           <Button>trigger</Button>
         </Tooltip>
       );
-      await sleep(10);
+      // #3354: 等待首次定位完成（尺寸稳定窗口 32ms）后再制造内容增长
+      await sleep(60);
 
       const instance = demo.find(Tooltip).instance();
       const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
@@ -420,9 +422,60 @@ describe(`Tooltip`, () => {
       // against a valid, but incomplete, initial size.
       popupHeight = 342;
       observers.forEach(o => o.cb && o.cb());
+      await sleep(30);
+
+      expect(calcSpy.calledOnce).toBe(true);
+      calcSpy.restore();
+      demo.unmount();
+    } finally {
+      global.ResizeObserver = realResizeObserver;
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', offsetWidthDesc);
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', offsetHeightDesc);
+    }
+  });
+
+  it(`positions once after popup size stabilizes to avoid flicker (#3354)`, async () => {
+    const realResizeObserver = global.ResizeObserver;
+    const offsetWidthDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetWidth');
+    const offsetHeightDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetHeight');
+
+    const observers = [];
+    // DatePicker-like popup: a small non-zero size first, then it grows.
+    // Positioning against that intermediate size causes a flip/jump once the
+    // final size arrives, which is visible as flickering.
+    let popupHeight = 32;
+    global.ResizeObserver = class {
+      constructor(cb) { this.cb = cb; observers.push(this); }
+      observe() {}
+      unobserve() {}
+      disconnect() {}
+    };
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 120; } });
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return popupHeight; } });
+
+    try {
+      const demo = mount(
+        <Tooltip motion={false} content={'Content'} visible={true} trigger={'custom'} position="bottom">
+          <Button>trigger</Button>
+        </Tooltip>
+      );
+      await sleep(10);
+
+      const instance = demo.find(Tooltip).instance();
+      const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
+
+      // The popup grows before the size-stabilize window elapses
+      popupHeight = 342;
+      observers.forEach(o => o.cb && o.cb());
       await sleep(10);
 
+      // Must not position against the unstable intermediate size
+      expect(calcSpy.called).toBe(false);
+
+      // After the size stabilizes, positioning runs exactly once
+      await sleep(60);
       expect(calcSpy.calledOnce).toBe(true);
+
       calcSpy.restore();
       demo.unmount();
     } finally {
```

**File**: `packages/semi-ui/tooltip/index.tsx` (modified, +26/-4)
```diff
@@ -204,6 +204,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
     scrollHandler: any;
     popupResizeObserver: ResizeObserver;
     popupResizeTimer: ReturnType<typeof setTimeout>;
+    popupSizeStabilizeTimer: ReturnType<typeof setTimeout>;
     getPopupContainer: () => HTMLElement;
     containerPosition: string;
     foundation: TooltipFoundation;
@@ -291,6 +292,18 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                     emit();
                                 }
                             };
+                            // #3354: 等待 popup 尺寸稳定后再做首次定位。
+                            // DatePicker 等内容会先以较小的非零尺寸完成初次布局，
+                            // 若此时立即定位（快路径或首次 RO 回调），尺寸扩展后会因
+                            // 溢出判定变化而翻转，视觉上表现为位置跳变（闪烁）。
+                            const scheduleStableEmit = () => {
+                                clearTimeout(this.popupSizeStabilizeTimer);
+                                this.popupSizeStabilizeTimer = setTimeout(() => {
+                                    if (!emitted && this.cachedLatestTransitionState === 'enter') {
+                                        emitOnce();
+                                    }
+                                }, 32);
+                            };
                             const ro = new ResizeObserver(() => {
                                 const width = el.offsetWidth;
                                 const height = el.offsetHeight;
@@ -301,7 +314,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                 lastWidth = width;
                                 lastHeight = height;
                                 if (!emitted) {
-                                    emitOnce();
+                                    scheduleStableEmit();
                                 } else if (sizeChanged && this.cachedLatestTransitionState === 'enter') {
                                     clearTimeout(this.popupResizeTimer);
                                     this.popupResizeTimer = setTimeout(() => {
@@ -314,14 +327,14 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                             this.popupResizeObserver = ro;
                             ro.observe(el);
                             if (lastWidth > 0 && lastHeight > 0) {
-                                emitOnce();
+                                scheduleStableEmit();
                             }
-                            // Safety net: bail out after 50ms even if RO never fires
+                            // Safety net: bail out after 100ms even if RO never fires
                             setTimeout(() => {
                                 if (!emitted) {
                                     emitOnce();
                                 }
-                            }, 50);
+                            }, 100);
                             return;
                         }
                         // Fallback for browsers without ResizeObserver.
@@ -374,6 +387,14 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                         scrollLeft: container.scrollLeft,
                         scrollTop: container.scrollTop,
                     };
+                    // #3354: body 的高度通常只是内容高度，而弹层实际可显示区域是视口；
+                    // 用 body 边界做溢出判断会把正常能放下的弹层误判为溢出并 pin 到错误位置。
+                    // 这里使用 clientWidth/clientHeight（视口内容区，不含滚动条），
+                    // 避免在 Windows/Linux 经典滚动条下弹层贴边时被滚动条遮挡。
+                    if (container === document.body) {
+                        rect.right = Math.max(boundingRect.right, document.documentElement.clientWidth);
+                        rect.bottom = Math.max(boundingRect.bottom, document.documentElement.clientHeight);
+                    }
                 }
 
                 return rect;
@@ -586,6 +607,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
 
     disconnectPopupResizeObserver = () => {
         clearTimeout(this.popupResizeTimer);
+        clearTimeout(this.popupSizeStabilizeTimer);
         this.popupResizeObserver?.disconnect();
         this.popupResizeObserver = null;
     };
```

---

### Incident Patch 8: `dacca934` (2026-09-15)
**Commit Message**: fix(tooltip): use viewport client size for popup container overflow bounds (#3354)

**File**: `packages/semi-ui/tooltip/index.tsx` (modified, +4/-2)
```diff
@@ -389,9 +389,11 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                     };
                     // #3354: body 的高度通常只是内容高度，而弹层实际可显示区域是视口；
                     // 用 body 边界做溢出判断会把正常能放下的弹层误判为溢出并 pin 到错误位置。
+                    // 这里使用 clientWidth/clientHeight（视口内容区，不含滚动条），
+                    // 避免在 Windows/Linux 经典滚动条下弹层贴边时被滚动条遮挡。
                     if (container === document.body) {
-                        rect.right = Math.max(boundingRect.right, window.innerWidth);
-                        rect.bottom = Math.max(boundingRect.bottom, window.innerHeight);
+                        rect.right = Math.max(boundingRect.right, document.documentElement.clientWidth);
+                        rect.bottom = Math.max(boundingRect.bottom, document.documentElement.clientHeight);
                     }
                 }
 
```

---

### Incident Patch 9: `b4b781e0` (2026-09-15)
**Commit Message**: fix(tooltip): wait for stable popup size before initial positioning (#3354)

**File**: `packages/semi-ui/tooltip/__test__/tooltip.test.js` (modified, +55/-2)
```diff
@@ -376,7 +376,8 @@ describe(`Tooltip`, () => {
       // Browser lays out portal-inner, then ResizeObserver fires
       laidOut = true;
       observers.forEach(o => o.cb && o.cb());
-      await sleep(10);
+      // #3354: 首次定位会等待尺寸稳定（32ms 稳定窗口）后再执行
+      await sleep(60);
 
       // The layout-driven ResizeObserver callback should have triggered positioning
       expect(calcSpy.called).toBe(true);
@@ -411,7 +412,8 @@ describe(`Tooltip`, () => {
           <Button>trigger</Button>
         </Tooltip>
       );
-      await sleep(10);
+      // #3354: 等待首次定位完成（尺寸稳定窗口 32ms）后再制造内容增长
+      await sleep(60);
 
       const instance = demo.find(Tooltip).instance();
       const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
@@ -420,9 +422,60 @@ describe(`Tooltip`, () => {
       // against a valid, but incomplete, initial size.
       popupHeight = 342;
       observers.forEach(o => o.cb && o.cb());
+      await sleep(30);
+
+      expect(calcSpy.calledOnce).toBe(true);
+      calcSpy.restore();
+      demo.unmount();
+    } finally {
+      global.ResizeObserver = realResizeObserver;
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', offsetWidthDesc);
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', offsetHeightDesc);
+    }
+  });
+
+  it(`positions once after popup size stabilizes to avoid flicker (#3354)`, async () => {
+    const realResizeObserver = global.ResizeObserver;
+    const offsetWidthDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetWidth');
+    const offsetHeightDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetHeight');
+
+    const observers = [];
+    // DatePicker-like popup: a small non-zero size first, then it grows.
+    // Positioning against that intermediate size causes a flip/jump once the
+    // final size arrives, which is visible as flickering.
+    let popupHeight = 32;
+    global.ResizeObserver = class {
+      constructor(cb) { this.cb = cb; observers.push(this); }
+      observe() {}
+      unobserve() {}
+      disconnect() {}
+    };
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 120; } });
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return popupHeight; } });
+
+    try {
+      const demo = mount(
+        <Tooltip motion={false} content={'Content'} visible={true} trigger={'custom'} position="bottom">
+          <Button>trigger</Button>
+        </Tooltip>
+      );
+      await sleep(10);
+
+      const instance = demo.find(Tooltip).instance();
+      const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
+
+      // The popup grows before the size-stabilize window elapses
+      popupHeight = 342;
+      observers.forEach(o => o.cb && o.cb());
       await sleep(10);
 
+      // Must not position against the unstable intermediate size
+      expect(calcSpy.called).toBe(false);
+
+      // After the size stabilizes, positioning runs exactly once
+      await sleep(60);
       expect(calcSpy.calledOnce).toBe(true);
+
       calcSpy.restore();
       demo.unmount();
     } finally {
```

**File**: `packages/semi-ui/tooltip/index.tsx` (modified, +24/-4)
```diff
@@ -204,6 +204,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
     scrollHandler: any;
     popupResizeObserver: ResizeObserver;
     popupResizeTimer: ReturnType<typeof setTimeout>;
+    popupSizeStabilizeTimer: ReturnType<typeof setTimeout>;
     getPopupContainer: () => HTMLElement;
     containerPosition: string;
     foundation: TooltipFoundation;
@@ -291,6 +292,18 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                     emit();
                                 }
                             };
+                            // #3354: 等待 popup 尺寸稳定后再做首次定位。
+                            // DatePicker 等内容会先以较小的非零尺寸完成初次布局，
+                            // 若此时立即定位（快路径或首次 RO 回调），尺寸扩展后会因
+                            // 溢出判定变化而翻转，视觉上表现为位置跳变（闪烁）。
+                            const scheduleStableEmit = () => {
+                                clearTimeout(this.popupSizeStabilizeTimer);
+                                this.popupSizeStabilizeTimer = setTimeout(() => {
+                                    if (!emitted && this.cachedLatestTransitionState === 'enter') {
+                                        emitOnce();
+                                    }
+                                }, 32);
+                            };
                             const ro = new ResizeObserver(() => {
                                 const width = el.offsetWidth;
                                 const height = el.offsetHeight;
@@ -301,7 +314,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                 lastWidth = width;
                                 lastHeight = height;
                                 if (!emitted) {
-                                    emitOnce();
+                                    scheduleStableEmit();
                                 } else if (sizeChanged && this.cachedLatestTransitionState === 'enter') {
                                     clearTimeout(this.popupResizeTimer);
                                     this.popupResizeTimer = setTimeout(() => {
@@ -314,14 +327,14 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                             this.popupResizeObserver = ro;
                             ro.observe(el);
                             if (lastWidth > 0 && lastHeight > 0) {
-                                emitOnce();
+                                scheduleStableEmit();
                             }
-                            // Safety net: bail out after 50ms even if RO never fires
+                            // Safety net: bail out after 100ms even if RO never fires
                             setTimeout(() => {
                                 if (!emitted) {
                                     emitOnce();
                                 }
-                            }, 50);
+                            }, 100);
                             return;
                         }
                         // Fallback for browsers without ResizeObserver.
@@ -374,6 +387,12 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                         scrollLeft: container.scrollLeft,
                         scrollTop: container.scrollTop,
                     };
+                    // #3354: body 的高度通常只是内容高度，而弹层实际可显示区域是视口；
+                    // 用 body 边界做溢出判断会把正常能放下的弹层误判为溢出并 pin 到错误位置。
+                    if (container === document.body) {
+                        rect.right = Math.max(boundingRect.right, window.innerWidth);
+                        rect.bottom = Math.max(boundingRect.bottom, window.innerHeight);
+                    }
                 }
 
                 return rect;
@@ -586,6 +605,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
 
     disconnectPopupResizeObserver = () => {
         clearTimeout(this.popupResizeTimer);
+        clearTimeout(this.popupSizeStabilizeTimer);
         this.popupResizeObserver?.disconnect();
         this.popupResizeObserver = null;
     };
```

---

### Incident Patch 10: `8db432d4` (2026-09-10)
**Commit Message**: fix(modal): ESC closes only the top-most modal

Keep only the most recently mounted ModalContent keydown handler active so one ESC closes one dialog at a time. Add a controlled nested-modal regression test.

Fixes #3351

**File**: `packages/semi-foundation/modal/modalContentFoundation.ts` (modified, +22/-0)
```diff
@@ -30,6 +30,15 @@ export interface ModalContentAdapter extends DefaultAdapter<ModalContentProps, M
     prevFocusElementReFocus: () => void
 }
 
+/**
+ * Stack of `handleKeyDown` handlers for modals that currently listen on
+ * `document`. Every ModalContent registers its own document-level keydown
+ * listener, so `stopPropagation()` cannot stop sibling listeners on the same
+ * node — one ESC used to close every open dialog. Only the most recently
+ * mounted (top-most) listener should respond.
+ */
+const escListenerStack: Array<(e: any) => void> = [];
+
 export default class ModalContentFoundation extends BaseFoundation<ModalContentAdapter> {
 
     constructor(adapter: ModalContentAdapter) {
@@ -53,6 +62,12 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
     handleKeyDown = (e: any) => {
         const { closeOnEsc } = this.getProps();
         if (closeOnEsc && e.keyCode === KeyCode.ESC) {
+            // Multiple open modals each registered a document-level keydown
+            // listener; only the top-most (most recently mounted) one may
+            // close, so a single ESC closes dialogs one at a time.
+            if (escListenerStack[escListenerStack.length - 1] !== this.handleKeyDown) {
+                return;
+            }
             e.stopPropagation();
             this.close(e);
             return;
@@ -61,10 +76,17 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
 
     handleKeyDownEventListenerMount() {
         this._adapter.addKeyDownEventListener();
+        if (this.getProps().closeOnEsc) {
+            escListenerStack.push(this.handleKeyDown);
+        }
     }
 
     handleKeyDownEventListenerUnmount() {
         this._adapter.removeKeyDownEventListener();
+        const index = escListenerStack.indexOf(this.handleKeyDown);
+        if (index !== -1) {
+            escListenerStack.splice(index, 1);
+        }
     }
 
     getMouseState() {
```

**File**: `packages/semi-ui/modal/__test__/modal.test.js` (modified, +45/-0)
```diff
@@ -336,4 +336,49 @@ describe('modal', () => {
         expect(modal.exists(`div.${testClass}`)).toEqual(true);
         modal.unmount();
     });
+
+    it('esc closes only the top-most modal when multiple are open', () => {
+        const onCancelOuter = jest.fn();
+        const onCancelInner = jest.fn();
+        class StackedModals extends React.Component {
+            state = {
+                outerVisible: true,
+                innerVisible: true,
+            };
+
+            handleOuterCancel = (e) => {
+                onCancelOuter(e);
+                this.setState({ outerVisible: false });
+            };
+
+            handleInnerCancel = (e) => {
+                onCancelInner(e);
+                this.setState({ innerVisible: false });
+            };
+
+            render() {
+                return (
+                    <>
+                        {getModal({ visible: this.state.outerVisible, onCancel: this.handleOuterCancel })}
+                        {getModal({ visible: this.state.innerVisible, onCancel: this.handleInnerCancel })}
+                    </>
+                );
+            }
+        }
+
+        const stacked = mount(<StackedModals />, { attachTo: document.getElementById('container') });
+
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+
+        // Only the most recently mounted (top-most) modal should close.
+        expect(onCancelInner).toHaveBeenCalledTimes(1);
+        expect(onCancelOuter).toHaveBeenCalledTimes(0);
+
+        // After the top modal unmounts, the next ESC reaches the outer one.
+        stacked.update();
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+        expect(onCancelOuter).toHaveBeenCalledTimes(1);
+
+        stacked.unmount();
+    });
 })
```

---

### Incident Patch 11: `2b5acd79` (2026-09-09)
**Commit Message**: docs: fix typos across component docs and contributing guide

- Transfer: `searchRender:flase` in the default TreeProps example is not
  valid TypeScript; corrected to `false` (en-US and zh-CN)
- Descriptions: frontmatter key `breif` corrected to `brief` so the page
  summary is picked up like every other component page
- Form (zh-CN): valuePath example `target.checkd` corrected to
  `target.checked` to match the Radio onChange event
- Tooltip (zh-CN): trigger value `hove` corrected to `hover`
- Select: `mutilple` corrected to `multiple` in the autoClearSearchValue
  description (en-US and zh-CN)
- Tree: doubled word "for for" in searchStyle description
- Spelling fixes in prose, headings and demo text: environment, Description,
  disabled, built-in, Infrastructure, better, variable, controlled, error,
  Triggered, support, Explanation, Different, image, Optional, Content,
  Retention, demonstrate, deletable, wrapper

**File**: `CONTRIBUTING-en-US.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ cd semi-design
 ```bash
 git checkout -b <TOPIC_BRANCH_NAME>
 ```
->Before installing the enviroment,make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
+>Before installing the environment,make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
 ```base
 corepack enable
 ```
```

**File**: `content/advanced/design-to-code/index-en-US.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ For more detailed usage instructions, you can visit <a href="/code" target="_bla
 
 Here is a link to the Figma example mockup and its corresponding Codesandbox transpiled using the Semi Figma plugin.
 
-| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Desciption                                                                                          | Codesandbox                                                                                  |
+| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Description                                                                                          | Codesandbox                                                                                  |
 |------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
 | <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=5%3A2092' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/simple-demo-1.jpg' style={{ width:  400 }} /></a>                                               | A module with simple content without components                                                   | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/w1z9yx' target="_blank" rel="noreferrer noopener">Link</a> |
 | <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A275' target="_blank" rel="noreferrer noopener"><img src='https://lf3-files.qingfuwucdn.net/obj/inspirecloud-file/baas/tt38q7/2468f1c4f1756bc0_1676603194364.png' style={{ width:  400 }} /></a>                                                  | Modules that do not contain components, have more content, or have a slightly more complex layout | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/905ncn' target="_blank" rel="noreferrer noopener">Link</a> |
```

**File**: `content/basic/button/index-en-US.md` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ function ButtonDemo() {
         <div>
             <Button disabled>Disabled</Button>
             <Button disabled theme="borderless">No background and disabled</Button>
-            <Button disabled theme="light">Light and disbaled</Button>
+            <Button disabled theme="light">Light and disabled</Button>
             <Button disabled theme="borderless" type="primary">No background, primary and disabled</Button>
             <Button disabled theme="solid" type="warning">Solid, warning and disabled</Button>
         </div>
```

**File**: `content/basic/typography/index-en-US.md` (modified, +4/-4)
```diff
@@ -46,7 +46,7 @@ function Demo() {
 
 ### Text
 
-Text component has different built-in styles. You could also pass `icon` to use the build-in styles for icon. Different from passing icon to children, using `icon` for link will have no underline in compliance with Semi Design principles.
+Text component has different built-in styles. You could also pass `icon` to use the built-in styles for icon. Different from passing icon to children, using `icon` for link will have no underline in compliance with Semi Design principles.
 
 ```jsx live=true
 import React from 'react';
@@ -427,7 +427,7 @@ function Demo() {
             <Text 
                 ellipsis={{ 
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation' }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation' }
                     }
                 }}
                 style={{ width: 150 }}
@@ -438,7 +438,7 @@ function Demo() {
             <Text 
                 ellipsis={{ 
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation', className: 'components-typography-demo' }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation', className: 'components-typography-demo' }
                     }
                 }}
                 style={{ width: 150 }}
@@ -449,7 +449,7 @@ function Demo() {
             <Text 
                 ellipsis={{
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation', style: { wordBreak: 'break-all' } }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation', style: { wordBreak: 'break-all' } }
                     }
                 }}
                 style={{ width: 150 }}
```

**File**: `content/ecosystem/faq/index-en-US.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ No plans for this. Specific reasons: [Issue 311](https://github.com/DouyinFE/sem
 
 
 #### What is the relationship between Semi 2.x (open source version) and Semi 1.x?
- - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, bettter a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
+ - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, better a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
  - v1.x has stopped iterative maintenance, no more feature additions or complex changes, only necessary bug fix changes are provided.
  - For new projects, we recommend that you directly use 2.x [@douyin/semi-ui](https://semi.design) for development. For existing projects, we also recommend that you upgrade as soon as possible. In order to reduce the cost of upgrading, we provide a cli tool one-click migration (@ies/semi-codemod-v2) that can help you automatically complete up to 90% of the migration and modification (limited by the AST implementation principle, there are still a small number of cases that require manual labor review modification, but not much 😉)
  - Upgrade from Semi 1.x to Semi 2.x for detailed operation steps [From v1 to v2](https://semi.design/en-US/start/update-to-v2)
```

**File**: `content/ecosystem/update-to-v2/index-en-US.md` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ All warning logs will be output in the semi-codemod-log.log file under ProjectPa
 
 ##### 4. Update the usage of Css Variable
 
-If you use Semi's css variable in your code, in addition to using semi-codemod-v2, you also need to use the style-lint tool we provide to automatically update all css varable usage
+If you use Semi's css variable in your code, in addition to using semi-codemod-v2, you also need to use the style-lint tool we provide to automatically update all css variable usage
 
 - Install Semi style-lint package
 
```

**File**: `content/input/form/index-en-US.md` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ Properties are hijacked by Form, so
 
 <Notice type="primary" title="Notice">
 
-1. No longer need to manually bind the onChange event and update the value as controled component. But you can continue to listen onChange events for the latest values if you want
+1. No longer need to manually bind the onChange event and update the value as controlled component. But you can continue to listen onChange events for the latest values if you want
 2. You cannot set the state of component with attributes such as `value`, `defaultValue`, `checked`, `defaultChecked`, etc. The default value can be set by Field's `initValue` or Form's `unitValues`
 3. You should not modify the value of Form State directly, all changes to the data in the Form should be done by providing `formApi`, `fieldApi`
 
@@ -1145,7 +1145,7 @@ class FormLevelValidateSync extends React.Component {
             errors.sex = 'must be woman';
         }
         errors.familyName = [
-            { before: 'before errror balabala ', after: 'after error balabala' },
+            { before: 'before error balabala ', after: 'after error balabala' },
             'familyName[1] error balabala'
         ];
         return errors;
```

**File**: `content/input/form/index.md` (modified, +2/-2)
```diff
@@ -1222,7 +1222,7 @@ class FormLevelValidateSync extends React.Component {
             errors.sex = 'must be woman';
         }
         errors.familyName = [
-            { before: 'before errror balabala ', after: 'after error balabala' },
+            { before: 'before error balabala ', after: 'after error balabala' },
             'familyName[1] error balabala'
         ];
         return errors;
@@ -2525,7 +2525,7 @@ const { ErrorMessage } = Form;
 | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
 | valueKey          | 组件表示值的属性，如 Switch、Radio 的是'checked'，Input 的是'value'                                                                                                                                                                           | 'value'    |
 | onKeyChangeFnName | 组件值变化时的回调函数，一般为'onChange'                                                                                                                                                                                                      | 'onChange' |
-| valuePath         | 值属性在回调函数中第一个参数的路径,如 Radio 的 onChange(e.target.checked)，那么该值需要设为 target.checkd；RadioGroup 的 onChange(e.target.value)，该值为'target.value'；若第一个参数就是值本身，无需再往下取值，该项不需要设                 |            |
+| valuePath         | 值属性在回调函数中第一个参数的路径,如 Radio 的 onChange(e.target.checked)，那么该值需要设为 target.checked；RadioGroup 的 onChange(e.target.value)，该值为'target.value'；若第一个参数就是值本身，无需再往下取值，该项不需要设                 |            |
 
 ## Accessibility
 
```

---

### Incident Patch 12: `1a7497cf` (2026-09-05)
**Commit Message**: Merge branch 'release' into fix/resize-group-display-none-recalc

**File**: `content/ai/aiComponent/index-en-US.md` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ For `AI Icon`, single-color, dual-color, and multi-color icons are supported, to
 
 For AI-style `Button`, `Tag`, and `FloatButton`, the `Colorful` property of the component can be enabled.
 
-Below are some examples of basic AI components. For more examples and use cases, please see [AI Token](/en-US/basic/tokens), [AI Icon](en-US/basic/icon), [AI Button](/en-US/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE), [AI Tag](/en-US/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE), [AI FloatButton](/en-US/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE).
+Below are some examples of basic AI components. For more examples and use cases, please see [AI Token](/en-US/basic/tokens), [AI Icon](/en-US/basic/icon), [AI Button](/en-US/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE), [AI Tag](/en-US/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE), [AI FloatButton](/en-US/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE).
 
 ```jsx live=true dir="column"
 import React from 'react';
@@ -552,4 +552,4 @@ render(AIChatInputWithDialogue);
          - [AIChatDialogue](/en-US/ai/aiChatDialogue) message display is more flexible。
             1. The component supports OpenAI's [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) Object format standard by default. Calling the [internal message conversion function](/en-US/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2) can easily convert the results returned by OpenAI into the data structure required by the component.
             2. It provides an API for [customized display based on message type](/en-US/ai/aiChatDialogue#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E6%B6%88%E6%81%AF%E5%86%85%E5%AE%B9) to facilitate quick and easy message display.
-            3. By default, message [reference](/en-US/ai/aiChatDialogue#%E5%BC%95%E7%94%A8) and [select](/en-US/ai/aiChatDialogue#%E9%80%89%E6%8B%A9) operations are supported.
\ No newline at end of file
+            3. By default, message [reference](/en-US/ai/aiChatDialogue#%E5%BC%95%E7%94%A8) and [select](/en-US/ai/aiChatDialogue#%E9%80%89%E6%8B%A9) operations are supported.
```

**File**: `content/ai/aiComponent/index.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ AI 基础组件包括 `AI Icon`、AI 风格的 `Button` / `Tag` / `FloatButton`
 
 对于 AI 风格的 `Button / Tag / FloatButton`，可通过组件的 `Colorful` 属性开启。
 
-以下是 AI 基础组件的一些示例，更多示例及使用场景详见 [AI Token](/zh-CN/basic/tokens)、[AI Icon](zh-CN/basic/icon)、[AI Button](/zh-CN/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE)、[AI Tag](/zh-CN/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE)、[AI FloatButton](/zh-CN/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE)。
+以下是 AI 基础组件的一些示例，更多示例及使用场景详见 [AI Token](/zh-CN/basic/tokens)、[AI Icon](/zh-CN/basic/icon)、[AI Button](/zh-CN/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE)、[AI Tag](/zh-CN/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE)、[AI FloatButton](/zh-CN/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE)。
  
 
 ```jsx live=true dir="column"
```

---

### Incident Patch 13: `fba4b2de` (2026-09-01)
**Commit Message**: fix(timePicker): escape regExp special characters in format separator to avoid SyntaxError

**File**: `packages/semi-foundation/timePicker/utils/index.ts` (modified, +2/-1)
```diff
@@ -131,7 +131,8 @@ export const isTimeFormatLike = (time: string, formatToken: string) => {
     const hmsReg = /[H|m|s]{1,2}/;
     const formatSplitted = formatToken.split(formatNotSupportChReg); // => ['HH', 'mm'];
     const timeSeparator = formatToken.replace(formatSupportChReg, ''); // => :
-    const timeReg = new RegExp(`[${timeSeparator}]`, 'g'); // => /[:]/g
+    const escapedTimeSeparator = timeSeparator.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'); // escape regExp special characters to avoid invalid regExp, e.g. format="HH\\mm"
+    const timeReg = new RegExp(`[${escapedTimeSeparator}]`, 'g'); // => /[:]/g
     const timeSplitted = time.split(timeReg); // => ['12', '0]
 
     if (formatSplitted.length !== timeSplitted.length) {
```

**File**: `packages/semi-ui/timePicker/__test__/timePicker.test.js` (modified, +5/-0)
```diff
@@ -300,6 +300,11 @@ describe(`TimePicker`, () => {
             ['上午 12:00:02', 'a h:mm:ss', true],
             ['上午 12:00:0', 'a h:mm:ss', false],
             ['上午 12:0:00', 'a h:mm:ss', false],
+            // format separator containing a regExp-special character should not throw (regression test,
+            // previously threw "SyntaxError: Invalid regular expression" because the separator was
+            // interpolated into a RegExp character class without escaping)
+            ['12\\00', 'HH\\mm', true],
+            ['12.00', 'HH.mm', true],
         ];
 
         testCases.forEach(test => {
```

---

### Incident Patch 14: `477f0ba1` (2026-08-24)
**Commit Message**: docs: fix AI Icon links

**File**: `content/ai/aiComponent/index-en-US.md` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ For `AI Icon`, single-color, dual-color, and multi-color icons are supported, to
 
 For AI-style `Button`, `Tag`, and `FloatButton`, the `Colorful` property of the component can be enabled.
 
-Below are some examples of basic AI components. For more examples and use cases, please see [AI Token](/en-US/basic/tokens), [AI Icon](en-US/basic/icon), [AI Button](/en-US/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE), [AI Tag](/en-US/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE), [AI FloatButton](/en-US/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE).
+Below are some examples of basic AI components. For more examples and use cases, please see [AI Token](/en-US/basic/tokens), [AI Icon](/en-US/basic/icon), [AI Button](/en-US/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE), [AI Tag](/en-US/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE), [AI FloatButton](/en-US/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE).
 
 ```jsx live=true dir="column"
 import React from 'react';
@@ -552,4 +552,4 @@ render(AIChatInputWithDialogue);
          - [AIChatDialogue](/en-US/ai/aiChatDialogue) message display is more flexible。
             1. The component supports OpenAI's [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) Object format standard by default. Calling the [internal message conversion function](/en-US/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2) can easily convert the results returned by OpenAI into the data structure required by the component.
             2. It provides an API for [customized display based on message type](/en-US/ai/aiChatDialogue#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E6%B6%88%E6%81%AF%E5%86%85%E5%AE%B9) to facilitate quick and easy message display.
-            3. By default, message [reference](/en-US/ai/aiChatDialogue#%E5%BC%95%E7%94%A8) and [select](/en-US/ai/aiChatDialogue#%E9%80%89%E6%8B%A9) operations are supported.
\ No newline at end of file
+            3. By default, message [reference](/en-US/ai/aiChatDialogue#%E5%BC%95%E7%94%A8) and [select](/en-US/ai/aiChatDialogue#%E9%80%89%E6%8B%A9) operations are supported.
```

**File**: `content/ai/aiComponent/index.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ AI 基础组件包括 `AI Icon`、AI 风格的 `Button` / `Tag` / `FloatButton`
 
 对于 AI 风格的 `Button / Tag / FloatButton`，可通过组件的 `Colorful` 属性开启。
 
-以下是 AI 基础组件的一些示例，更多示例及使用场景详见 [AI Token](/zh-CN/basic/tokens)、[AI Icon](zh-CN/basic/icon)、[AI Button](/zh-CN/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE)、[AI Tag](/zh-CN/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE)、[AI FloatButton](/zh-CN/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE)。
+以下是 AI 基础组件的一些示例，更多示例及使用场景详见 [AI Token](/zh-CN/basic/tokens)、[AI Icon](/zh-CN/basic/icon)、[AI Button](/zh-CN/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE)、[AI Tag](/zh-CN/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE)、[AI FloatButton](/zh-CN/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE)。
  
 
 ```jsx live=true dir="column"
```

---

### Incident Patch 15: `24f47819` (2026-09-01)
**Commit Message**: Merge pull request #3346 from DouyinFE/fix/auto-upload-batch-autoremove

【Auto】Fix: Upload 批量 beforeUpload autoRemove 文件残留（React 18 批处理）

**File**: `packages/semi-foundation/upload/foundation.ts` (modified, +81/-27)
```diff
@@ -110,13 +110,53 @@ class UploadFoundation<P = Record<string, any>, S = Record<string, any>> extends
      * When paste event is successfully handled, we ignore the subsequent keydown event.
      */
     _pasteHandled: boolean = false;
+    /**
+     * Working copy of fileList used during a synchronous startUpload batch.
+     * Do NOT rely on React state fileList here: setState is async (batched in React 18),
+     * so reading getState('fileList') between iterations of a sync loop returns a stale
+     * snapshot and earlier removals get overwritten by later ones (see #3335).
+     * Seeded at the start of startUpload and cleared when the sync loop finishes (see
+     * try/finally in startUpload); async (promise) results fall back to _latestFileList
+     * then React state.
+     */
+    _batchFileList: Array<BaseFileItem> | null = null;
+    /**
+     * The most recent fileList produced by handleBeforeUploadResultInObject.
+     * Unlike React state (which is flushed asynchronously under React 18 automatic
+     * batching), this is updated synchronously, so a later async beforeUpload result
+     * composes with earlier sync removals of the same batch instead of reading a stale
+     * snapshot (mixed sync + async beforeUpload results, see #3335).
+     */
+    _latestFileList: Array<BaseFileItem> | null = null;
+    /**
+     * Unify all fileList commits: keep _latestFileList in sync synchronously so async
+     * beforeUpload results compose with recent mutations even before React flushes
+     * setState (React 18 automatic batching). (#3335)
+     */
+    updateFileListInternal(newFileList: Array<BaseFileItem>, callback?: () => void): void {
+        if (this._batchFileList) {
+            this._batchFileList = newFileList;
+        }
+        this._latestFileList = newFileList;
+        this._adapter.updateFileList(newFileList, callback);
+    }
+
+    /** Keep the synchronous snapshot aligned with an externally controlled fileList. */
+    syncLatestFileList(fileList: Array<BaseFileItem>): void {
+        this._latestFileList = fileList.slice();
+    }
+
+    getLatestFileList(): Array<BaseFileItem> {
+        return this._batchFileList || this._latestFileList || this.getState('fileList');
+    }
     constructor(adapter: UploadAdapter<P, S>) {
         super({ ...adapter });
     }
 
     init(): void {
         // make sure state reset, otherwise may cause upload abort in React StrictMode, like https://github.com/DouyinFE/semi-design/pull/843
         this.destroyState = false;
+        this.syncLatestFileList(this.getState('fileList'));
         // In controlled mode, parent may keep and pass back fileList with blob url.
         // Sync them into internal map so later remove/clear can revoke correctly.
         this._syncLocalUrlsFromFileList();
@@ -160,6 +200,8 @@ class UploadFoundation<P = Record<string, any>, S = Record<string, any>> extends
         if (!disabled) {
             this.unbindPastingHandler();
         }
+        this._batchFileList = null;
+        this._latestFileList = null;
         this.destroyState = true;
     }
 
@@ -363,7 +405,7 @@ class UploadFoundation<P = Record<string, any>, S = Record<string, any>> extends
         }
         newFileList.splice(replaceIdx, 1, newFileItem);
         this._adapter.notifyChange({ currentFile: newFileItem, fileList: newFileList });
-        this._adapter.updateFileList(newFileList, () => {
+        this.updateFileListInternal(newFileList, () => {
             this._adapter.resetReplaceInput();
             if (!newFileItem._sizeInvalid) {
                 this.upload(newFileItem);
@@ -405,7 +447,7 @@ class UploadFoundation<P = Record<string, any>, S = Record<string, any>> extends
         const { uploadTrigger } = this.getProps();
         const currentFiles = files.map(item => this.buildFileItem(item, uploadTrigger));
         this._adapter.notifyChange({ fileList: currentFiles, currentFile: currentFiles[0] });
-        this._adapter.updateFileList(currentFiles, () => {
+        this.updateFileListInternal(currentFiles, () => {
             if (uploadTrigger === TRIGGER_AUTO) {
                 this.startUpload(currentFiles);
             }
@@ -425,7 +467,7 @@ class UploadFoundation<P = Record<string, any>, S = Record<string, any>> extends
                 this._adapter.notifyChange({ fileList, currentFile: file });
             }
         });
-        this._adapter.updateFileList(fileList, () => {
+        this.updateFileListInternal(fileList, () => {
             if (uploadTrigger === TRIGGER_AUTO) {
                 this.startUpload(currentFiles);
             }
@@ -506,7 +548,7 @@ class UploadFoundation<P = Record<string, any>, S = Record<string, any>> extends
 
         this._adapter.notifyFileSelect(currentFileList);
         this._adapter.notifyChange({ fileList: newFileList, currentFile: null });
-        this._adapter.updateFileList(newFileList, () => {
+        this.updateFileListInternal(newFileList, () => {
       
```

**File**: `packages/semi-ui/upload/__test__/uploadBatchAutoRemove.test.js` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+import UploadFoundation from '../../../semi-foundation/upload/foundation';
+
+/**
+ * Regression tests for #3335:
+ * When multiple files are uploaded at once and `beforeUpload` returns
+ * `{ shouldUpload: false, autoRemove: true }` for several of them, every file
+ * should be removed from fileList.
+ *
+ * The bug only reproduces when setState is batched (React 18 automatic batching):
+ * `startUpload` iterates synchronously and each `autoRemove` used to read the
+ * React state snapshot, which is not flushed between iterations, so later
+ * removals overwrite earlier ones and some files "revive".
+ *
+ * Semi's own test harness runs on React 16 (synchronous flush), so we drive the
+ * foundation directly with a mock adapter that simulates batching: updateFileList
+ * does NOT reflect into getState synchronously; only the last update is committed
+ * when the synchronous batch finishes.
+ */
+describe('Upload foundation - batched autoRemove (#3335)', () => {
+    function createFoundation({ initialFileList, beforeUpload, ...uploadProps }) {
+        // committed React state; getState/getStates read this
+        let committedFileList = initialFileList.slice();
+        // pending (batched) update; not visible via getState until flushed
+        let pendingFileList = null;
+        const changes = [];
+
+        const adapter = {
+            getContext: () => undefined,
+            getContexts: () => ({}),
+            getProp: key => ({ beforeUpload, ...uploadProps })[key],
+            getProps: () => ({ beforeUpload, ...uploadProps }),
+            getState: key => ({ fileList: committedFileList })[key],
+            getStates: () => ({ fileList: committedFileList }),
+            updateFileList: (fileList) => {
+                // simulate React 18 batching: keep the latest scheduled value but
+                // do NOT flush it into committed state during the synchronous loop
+                pendingFileList = fileList;
+            },
+            notifyChange: ({ fileList }) => changes.push(fileList),
+            notifyProgress: () => {},
+            updateLocalUrls: () => {},
+            notifyBeforeUpload: ({ file, fileList }) => beforeUpload({ file, fileList }),
+        };
+
+        const foundation = new UploadFoundation(adapter);
+        // flush the last batched update, mimicking React committing setState
+        const flush = () => {
+            if (pendingFileList !== null) {
+                committedFileList = pendingFileList;
+                pendingFileList = null;
+            }
+            return committedFileList;
+        };
+        const setCommittedFileList = fileList => {
+            committedFileList = fileList.slice();
+            pendingFileList = null;
+        };
+        return { foundation, flush, setCommittedFileList, getChanges: () => changes };
+    }
+
+    const makeFile = uid => ({ uid, name: `${uid}.png`, size: '10KB', status: 'wait', fileInstance: { uid } });
+
+    it('removes every file when multiple files return autoRemove synchronously', () => {
+        const fileA = makeFile('a');
+        const fileB = makeFile('b');
+
+        const beforeUpload = () => ({ shouldUpload: false, autoRemove: true });
+        const { foundation, flush } = createFoundation({ initialFileList: [fileA, fileB], beforeUpload });
+
+        foundation.startUpload([fileA, fileB]);
+
+        // after the synchronous batch is committed, no file should remain
+        expect(flush()).toEqual([]);
+    });
+
+    it('keeps only the non-autoRemove file when removals are interleaved', () => {
+        const fileA = makeFile('a');
+        const fileB = makeFile('b');
+        const fileC = makeFile('c');
+
+        // remove a and c, keep b
+        const beforeUpload = ({ file }) =>
+            file.uid === 'b'
+                ? { shouldUpload: false, autoRemove: false }
+                : { shouldUpload: false, autoRemove: true };
+        const { foundation, flush } = createFoundation({ initialFileList: [fileA, fileB, fileC], beforeUpload });
+
+        foundation.startUpload([fileA, fileB, fileC]);
+
+        const result = flush();
+        expect(result.map(f => f.uid)).toEqual(['b']);
+    });
+
+    it('falls back to React state outside a startUpload batch and clears the working copy', () => {
+        const fileA = makeFile('a');
+        const fileB = makeFile('b');
+
+        const beforeUpload = () => ({ shouldUpload: false, autoRemove: true });
+        const { foundation, flush } = createFoundation({ initialFileList: [fileA, fileB], beforeUpload });
+
+        // a single upload (e.g. the replace flow) is not part of a startUpload batch
+        foundation.upload(fileA);
+        expect(flush().map(f => f.uid)).toEqual(['b']);
+        // the batch working copy must not leak outside startUpload
+        expect(foundation._batchFileList).toBeNull();
+    });
+
+    it('composes mixed sync + async beforeUpload results (sync remove then async r
```

**File**: `packages/semi-ui/upload/index.tsx` (modified, +6/-0)
```diff
@@ -491,6 +491,12 @@ class Upload extends BaseComponent<UploadProps, UploadState> {
         this.foundation.init();
     }
 
+    componentDidUpdate(): void {
+        if ('fileList' in this.props) {
+            this.foundation.syncLatestFileList(this.props.fileList || []);
+        }
+    }
+
     componentWillUnmount(): void {
         this.foundation.destroy();
     }
```

#### Recent Merged Pull Requests:
- **PR #3361** (closed): fix: 修复 Modal、Toast 和 Notification 在 React 提交阶段同步卸载 root 的错误 (@smile-alive)
- **PR #3359** (closed): ci: remove CodeSandbox --ignore-engines workaround by upgrading to Node 22 (@SudoUserReal)
- **PR #3358** (closed): chore: 临时对照 - chromatic baseline 检查（请勿合并） (@SudoUserReal)
- **PR #3357** (2026-09-15): 【Auto】Fix: Radio 选中白点在 Safari 下偏移（显式 SVG 尺寸替代 em） (@SudoUserReal)
- **PR #3356** (2026-09-15): 【Auto】Fix: DatePicker 弹层打开时位置闪烁（等待尺寸稳定后定位） (@SudoUserReal)
- **PR #3355** (2026-09-15): docs: fix typos across component docs and contributing guide (@toyeshhm)
- **PR #3353** (closed): fix(Tooltip): skip showing hover-triggered tooltip when mouse is not on the trigger element (@holdxen)
- **PR #3352** (2026-09-15): fix(modal): ESC closes only the top-most modal (@dvd233)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
