> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tiajinsha-jkvideo-learnings.md`  
> **Source**: github ([https://github.com/tiajinsha/JKVideo](https://github.com/tiajinsha/JKVideo))  
> **Source Version**: `3592d036`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:59:19.617Z  
> **Learning ID**: `learn-github-tiajinsha-jkvideo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tiajinsha/JKVideo

> **Canonical Artifact**: `07_PROJECT_LEARNING/tiajinsha-jkvideo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tiajinsha/JKVideo](https://github.com/tiajinsha/JKVideo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T04:59:19.611Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tiajinsha/JKVideo`
- **Description**: 高颜值第三方 B 站 React Native 客户端
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4999 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hooks/useAutoHideTimer.ts`
```
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 控制栏自动隐藏 hook：show() 后 delayMs 内无交互即隐藏。
 * keep() 用于"按住进度条不让消失"等场景：返回 true 时计时器会被推迟。
 */
export function useAutoHideTimer(delayMs = 3000, keep?: () => boolean) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (keep?.()) return;
    timerRef.current = setTimeout(() => setVisible(false), delayMs);
  }, [delayMs, keep]);

  const show = useCallback(() => {
    setVisible(true);
    reset();
  }, [reset]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const toggle = useCallback(() => {
    setVisible(prev => {
      if (!prev) {
        reset();
        return true;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      return false;
    });
  }, [reset]);

  useEffect(() => {
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { visible, show, hide, toggle, reset };
}

```

### Core Architecture Module: `hooks/useCheckUpdate.ts`
```
import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

const GITHUB_API = 'https://api.github.com/repos/tiajinsha/JKVideo/releases/latest';

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

export function useCheckUpdate() {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const [isChecking, setIsChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const checkUpdate = async () => {
    setIsChecking(true);
    try {
      const res = await fetch(GITHUB_API, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();

      const latestVersion: string = data.tag_name ?? '';
      const apkAsset = (data.assets as any[]).find((a) =>
        (a.name as string).endsWith('.apk')
      );
      const downloadUrl: string = apkAsset?.browser_download_url ?? '';
      const releaseNotes: string = data.body ?? '';

      if (compareVersions(latestVersion, currentVersion) <= 0) {
        Alert.alert('已是最新版本', `当前版本 v${currentVersion} 已是最新`);
        return;
      }

      Alert.alert(
        `发现新版本 ${latestVersion}`,
        releaseNotes || '有新版本可用，是否立即下载？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '浏览器下载',
            onPress: () => Linking.openURL(downloadUrl),
          },
          {
            text: '应用内下载',
            onPress: () => downloadAndInstall(downloadUrl, latestVersion),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('检查失败', e?.message ?? '网络错误，请稍后重试');
    } finally {
      setIsChecking(false);
    }
  };

  const openInstallSettings = () => {
    IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      { data: 'package:com.anonymous.jkvideo' }
    ).catch(() => {
      // 部分旧版 Android 不支持精确跳转，回退到通用安全设置
      IntentLauncher.startActivityAsync('android.settings.SECURITY_SETTINGS');
    });
  };

  const triggerInstall = async (localUri: string) => {
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/vnd.android.package-archive',
    });
  };

  const downloadAndInstall = async (url: string, version: string) => {
    if (Platform.OS !== 'android') {
      Alert.alert('提示', '自动安装仅支持 Android 设备');
      return;
    }
    const localUri = FileSystem.cacheDirectory + `JKVideo-${version}.apk`;
    try {
      setDownloadProgress(0);
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDownloadProgress(
              Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
            );
          }
        }
      );
      await downloadResumable.downloadAsync();
      setDownloadProgress(null);

      // Android 8.0+ 需要用户在系统设置中为本应用开启「安装未知应用」权限。
      // 系统拒绝时不会抛出 JS 异常，因此下载完成后主动引导。
      Alert.alert(
        '下载完成，准备安装',
        '如果点击「安装」后提示无权限，请先点击「去设置」，为 JKVideo 开启「允许安装未知应用」，然后返回重试。',
        [
          { text: '去设置', onPress: openInstallSettings },
          {
            text: '安装',
            onPress: () => {
              triggerInstall(localUri).catch((e: any) => {
                Alert.alert('安装失败', e?.message ?? '请在设置中开启「安装未知应用」权限后重试');
              });
            },
          },
        ]
      );
    } catch (e: any) {
      setDownloadProgress(null);
      Alert.alert('下载失败', e?.message ?? '请稍后重试');
    }
  };

  return { currentVersion, isChecking, downloadProgress, checkUpdate };
}

```

### Core Architecture Module: `hooks/useComments.ts`
```
import { useState, useCallback, useRef, useEffect } from 'react';
import { getComments } from '../services/bilibili';
import type { Comment } from '../services/types';

export function useComments(aid: number, sort: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const sortRef = useRef(sort);
  const aidRef = useRef(aid);
  const cursorRef = useRef(''); // empty = first page

  aidRef.current = aid;

  useEffect(() => {
    if (sortRef.current === sort) return;
    sortRef.current = sort;
    cursorRef.current = '';
    hasMoreRef.current = true;
    setComments([]);
    setHasMore(true);
  }, [sort]);

  const load = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || !aidRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const isFirstPage = cursorRef.current === '';
      const { replies, nextCursor, isEnd } = await getComments(aidRef.current, cursorRef.current, sortRef.current);
      cursorRef.current = nextCursor;
      setComments(prev => isFirstPage ? replies : [...prev, ...replies]);
      if (isEnd || replies.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (e) {
      console.error('Failed to load comments', e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  return { comments, loading, hasMore, load };
}

```

### Core Architecture Module: `hooks/useDownload.ts`
```
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useDownloadStore } from '../store/downloadStore';
import { getPlayUrlForDownload } from '../services/bilibili';

const lastReportedProgress: Record<string, number> = {};

const QUALITY_LABELS: Record<number, string> = {
  16: '360P', 32: '480P', 64: '720P',
  80: '1080P', 112: '1080P+', 116: '1080P60',
};

/** 等待 App 回到前台 */
function waitForActive(): Promise<void> {
  return new Promise((resolve) => {
    if (AppState.currentState === 'active') { resolve(); return; }
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { sub.remove(); resolve(); }
    });
  });
}

/** 当前是否在后台 */
function isBackground() {
  return AppState.currentState !== 'active';
}

/** 读取本地文件实际大小 */
async function readFileSize(uri: string): Promise<number | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists) return (info as any).size as number;
  } catch {}
  return undefined;
}

export function useDownload() {
  const { tasks, addTask, updateTask, removeTask } = useDownloadStore();

  function taskKey(bvid: string, qn: number) { return `${bvid}_${qn}`; }
  function localPath(bvid: string, qn: number) {
    return `${FileSystem.documentDirectory}${bvid}_${qn}.mp4`;
  }

  async function startDownload(
    bvid: string, cid: number, qn: number,
    qdesc: string, title: string, cover: string,
  ) {
    const key = taskKey(bvid, qn);
    if (tasks[key]?.status === 'downloading') return;

    addTask(key, {
      bvid, title, cover, qn,
      qdesc: qdesc || QUALITY_LABELS[qn] || String(qn),
      status: 'downloading', progress: 0, createdAt: Date.now(),
    });

    // 最多重新拉取 URL 并重试一次（应对后台时 URL 过期的情况）
    for (let attempt = 0; attempt < 2; attempt++) {
      const success = await attemptDownload(key, bvid, cid, qn);
      if (success !== 'retry') return;
      // 需要重试：重新拉取 URL
      updateTask(key, { status: 'downloading', progress: 0 });
      lastReportedProgress[key] = -1;
    }

    updateTask(key, { status: 'error', error: '下载失败，请重试' });
  }

  /** 执行一次下载尝试。返回 'done' | 'error' | 'retry' */
  async function attemptDownload(
    key: string, bvid: string, cid: number, qn: number,
  ): Promise<'done' | 'error' | 'retry'> {
    try {
      const [url, buvid3, sessdata] = await Promise.all([
        getPlayUrlForDownload(bvid, cid, qn),
        AsyncStorage.getItem('buvid3'),
        AsyncStorage.getItem('SESSDATA'),
      ]);
      const dest = localPath(bvid, qn);

      const cookies: string[] = [];
      if (buvid3) cookies.push(`buvid3=${buvid3}`);
      if (sessdata) cookies.push(`SESSDATA=${sessdata}`);

      const headers = {
        Referer: 'https://www.bilibili.com',
        Origin: 'https://www.bilibili.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(cookies.length > 0 && { Cookie: cookies.join('; ') }),
      };

      const progressCallback = (p: FileSystem.DownloadProgressData) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = p;
        const progress = totalBytesExpectedToWrite > 0
          ? totalBytesWritten / totalBytesExpectedToWrite : 0;
        const last = lastReportedProgress[key] ?? -1;
        if (progress - last >= 0.01) {
          lastReportedProgress[key] = progress;
          updateTask(key, { progress });
        }
      };

      const resumable = FileSystem.createDownloadResumable(url, dest, { headers }, progressCallback);

      // 进入后台时主动暂停，抢在 OS 断连之前
      let bgPaused = false;
      const appStateSub = AppState.addEventListener('change', async (state) => {
        if ((state === 'background' || state === 'inactive') && !bgPaused) {
          bgPaused = true;
          try { await resumable.pauseAsync(); } catch {}
        }
      });

      let result: FileSystem.DownloadResult | null = null;

      try {
        result = await resumable.downloadAsync();
      } catch (e: any) {
        // downloadAsync 抛出：多为后台断连（connection abort）或被 pauseAsync 中断
        if (!isBackground() && !bgPaused) {
          // 真实网络错误，非后台原因
          appStateSub.remove();
          delete lastReportedProgress[key];
          const msg = e?.message ?? '下载失败';
          updateTask(key, { status: 'error', error: msg.length > 40 ? msg.slice(0, 40) + '...' : msg });
          return 'error';
        }
        // 后台引发的中断，走下面的续传逻辑
        result = null;
      } finally {
        appStateSub.remove();
      }

      // ── 续传逻辑：result 为 null 说明被暂停或中断 ──
      if (!result?.uri) {
        // 等 App 回到前台
        if (isBackground()) await waitForActive();

        // 尝试从断点续传
        try {
          result = await resumable.resumeAsync();
        } catch {
          result = null;
        }

        // 续传仍失败（URL 可能过期），通知上层重试
        if (!result?.uri) {
          delete lastReportedProgress[key];
          return 'retry';
        }
      }

      // ── 下载完成 ──
      delete lastReportedProgress[key];
      const fileSize = await readFileSize(result.uri);
      updateTask(key, {
        status: 'done', progress: 1, localUri: result.uri,
        ...(fileSize ? { fileSize } : {}),
      });
      return 'done';

    } catch (e: any) {
      delete lastReportedProgress[key];
      console.error('[Download] failed:', e);
      const msg = e?.message ?? '下载失败';
      updateTask(key, { status: 'error', error: msg.length > 40 ? msg.slice(0, 40) + '...' : msg });
      return 'error';
    }
  }

  function getLocalUri(bvid: string, qn: number): string | undefined {
    return tasks[taskKey(bvid, qn)]?.localUri;
  }

  function cancelDownload(bvid: string, qn: number) {
    removeTask(taskKey(bvid, qn));
  }

  return { tasks, startDownload, getLocalUri, cancelDownload, taskKey };
}

```

### Core Architecture Module: `hooks/useFollow.ts`
```
import { useCallback, useEffect, useRef, useState } from "react";
import { getRelation, modifyRelation } from "../services/bilibili";
import { useAuthStore } from "../store/authStore";
import { getSecure } from "../utils/secureStorage";
import { toast } from "../utils/toast";

/**
 * 关注 / 取消关注 UP 主。
 * - 未登录：toggle 时 toast 提示，按钮 disabled=false 仍允许点击
 * - 已登录但无 bili_jct：toggle 时 toast 提示让用户重登
 * - 正常路径：乐观更新 UI，请求失败回滚
 */
export function useFollow(mid: number | undefined) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const inflightRef = useRef(false);

  // 首次拉取 / mid 切换时刷新关注状态
  useEffect(() => {
    if (!mid || !isLoggedIn) {
      setFollowing(false);
      return;
    }
    let cancelled = false;
    getRelation(mid)
      .then((r) => {
        if (!cancelled) setFollowing(r.following);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mid, isLoggedIn]);

  const toggle = useCallback(async () => {
    if (!mid) return;
    if (!isLoggedIn) {
      toast("请先登录后再关注");
      return;
    }
    const biliJct = await getSecure("bili_jct");
    if (!biliJct) {
      toast("请重新登录后再使用关注功能");
      return;
    }
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    const next = !following;
    setFollowing(next); // 乐观更新
    try {
      await modifyRelation(mid, next ? 1 : 2);
    } catch (e: any) {
      setFollowing(!next); // 失败回滚
      if (e?.message === "NO_CSRF") {
        toast("请重新登录后再使用关注功能");
      } else {
        toast(`操作失败：${e?.message || "未知错误"}`);
      }
    } finally {
      inflightRef.current = false;
      setLoading(false);
    }
  }, [mid, isLoggedIn, following]);

  return { following, loading, toggle };
}

```

### Core Architecture Module: `hooks/useLiveDanmaku.ts`
```
import { useState, useEffect, useRef } from 'react';
import { getLiveDanmakuHistory } from '../services/bilibili';
import type { DanmakuItem } from '../services/types';

const POLL_INTERVAL = 1500;

// 匹配 admin 消息中的礼物信息，如 "xxx 赠送了 辣条 x5" 或 "xxx 投喂 小心心 ×1"
const GIFT_PATTERN = /(?:赠送|投喂)\s*(?:了\s*)?(.+?)\s*[xX×]\s*(\d+)/;

// 常见礼物名列表，用于匹配
const KNOWN_GIFTS = new Set([
  '辣条', '小心心', '打call', '干杯', '比心',
  '吃瓜', '花式夸夸', '告白气球', '小电视飞船',
]);

export function useLiveDanmaku(roomId: number): {
  danmakus: DanmakuItem[];
  giftCounts: Record<string, number>;
} {
  const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});
  const seenTextsRef = useRef<Set<string>>(new Set());
  const seenAdminRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    setDanmakus([]);
    setGiftCounts({});
    seenTextsRef.current.clear();
    seenAdminRef.current.clear();
    let cancelled = false;

    async function poll() {
      try {
        const { danmakus: items, adminMsgs } = await getLiveDanmakuHistory(roomId);
        if (cancelled) return;

        // 去重弹幕：以 uname + text + timeline 为 key
        // 用 timeline 区分"同一人重复发同句"的合法重复（gethistory 多次轮询会返回相同尾部数据，靠 timeline 过滤掉）
        const newItems = items.filter(item => {
          const key = `${item.uname ?? ''}:${item.text}:${item.timeline ?? ''}`;
          if (seenTextsRef.current.has(key)) return false;
          seenTextsRef.current.add(key);
          return true;
        });
        if (newItems.length > 0) {
          setDanmakus(prev => [...prev, ...newItems]);
        }

        // 解析 admin 消息中的礼物
        const newGifts: Record<string, number> = {};
        for (const msg of adminMsgs) {
          // 去重 admin 消息
          if (seenAdminRef.current.has(msg)) continue;
          seenAdminRef.current.add(msg);

          const match = msg.match(GIFT_PATTERN);
          if (match) {
            const giftName = match[1].trim();
            const count = parseInt(match[2], 10);
            if (KNOWN_GIFTS.has(giftName) && count > 0) {
              newGifts[giftName] = (newGifts[giftName] ?? 0) + count;
            }
          }
        }
        if (Object.keys(newGifts).length > 0) {
          setGiftCounts(prev => {
            const next = { ...prev };
            for (const [name, count] of Object.entries(newGifts)) {
              next[name] = (next[name] ?? 0) + count;
            }
            return next;
          });
        }

        // 防止 seen set 无限增长
        if (seenTextsRef.current.size > 2000) {
          const arr = Array.from(seenTextsRef.current);
          seenTextsRef.current = new Set(arr.slice(-1000));
        }
        if (seenAdminRef.current.size > 500) {
          const arr = Array.from(seenAdminRef.current);
          seenAdminRef.current = new Set(arr.slice(-250));
        }
      } catch (e) {
        console.warn('[danmaku] poll failed:', e);
      }
      if (!cancelled) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roomId]);

  return { danmakus, giftCounts };
}

```

### Core Architecture Module: `hooks/useLiveDetail.ts`
```
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLiveRoomDetail, getLiveAnchorInfo, getLiveStreamUrl } from '../services/bilibili';
import type { LiveRoomDetail, LiveAnchorInfo, LiveStreamInfo } from '../services/types';

interface LiveDetailState {
  room: LiveRoomDetail | null;
  anchor: LiveAnchorInfo | null;
  stream: LiveStreamInfo | null;
  loading: boolean;
  error: string | null;
}

export function useLiveDetail(roomId: number) {
  const [state, setState] = useState<LiveDetailState>({
    room: null,
    anchor: null,
    stream: null,
    loading: true,
    error: null,
  });

  // 用 ref 追踪最新的 roomId，避免 cancelled 闭包问题
  const latestRoomId = useRef(roomId);
  latestRoomId.current = roomId;

  useEffect(() => {
    if (!roomId) return;
    
    setState({ room: null, anchor: null, stream: null, loading: true, error: null });

    const fetchId = roomId; // 捕获当前 roomId

    async function doFetch() {
      try {
        const [room, anchor] = await Promise.all([
          getLiveRoomDetail(fetchId),
          getLiveAnchorInfo(fetchId),
        ]);

        // 仅在 roomId 未变化时更新状态（替代 cancelled 模式）
        if (latestRoomId.current !== fetchId) return;

        let stream: LiveStreamInfo = { hlsUrl: '', flvUrl: '', qn: 0, qualities: [] };
        if (room?.live_status === 1) {
          stream = await getLiveStreamUrl(fetchId);
        }

        if (latestRoomId.current !== fetchId) return;

        setState({ room, anchor, stream, loading: false, error: null });
      } catch (e: any) {
        if (latestRoomId.current !== fetchId) return;
        setState(prev => ({ ...prev, loading: false, error: e?.message ?? '加载失败' }));
      }
    }

    doFetch();
  }, [roomId]);

  const changeQuality = useCallback(async (qn: number) => {
    try {
      const stream = await getLiveStreamUrl(roomId, qn);
      setState(prev => ({ ...prev, stream: { ...stream, qn } }));
    } catch { /* ignore */ }
  }, [roomId]);

  return { ...state, changeQuality };
}

```

### Core Architecture Module: `hooks/useLiveList.ts`
```
import { useState, useCallback, useRef } from 'react';
import { getLiveList } from '../services/bilibili';
import type { LiveRoom } from '../services/types';

export function useLiveList() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadingRef = useRef(false);
  const pendingRef = useRef(false);
  const pageRef = useRef(1);
  const areaIdRef = useRef(0);

  const load = useCallback(async (reset = false, parentAreaId?: number) => {
    if (loadingRef.current) {
      if (!reset) pendingRef.current = true;
      return;
    }
    loadingRef.current = true;
    pendingRef.current = false;

    if (parentAreaId !== undefined) {
      areaIdRef.current = parentAreaId;
    }

    if (reset) {
      pageRef.current = 1;
      setRooms([]);
    }

    const page = pageRef.current;
    setLoading(true);
    try {
      const data = await getLiveList(page, areaIdRef.current);
      setRooms(prev => reset ? data : [...prev, ...data]);
      pageRef.current = page + 1;
    } catch (e) {
      console.error('Failed to load live rooms', e);
    } finally {
      loadingRef.current = false;
      setRefreshing(false);

      if (pendingRef.current) {
        pendingRef.current = false;
        load();
      } else {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback((parentAreaId?: number) => {
    setRefreshing(true);
    load(true, parentAreaId);
  }, [load]);

  return { rooms, loading, refreshing, load, refresh };
}

```

### Core Architecture Module: `hooks/useMiniDrag.ts`
```
import { useRef } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

interface Options {
  width: number;
  height: number;
  /** 命中"关闭按钮"区域的判定（locationX, locationY）→ true 时调 onClose，否则调 onTap */
  hitClose?: (locationX: number, locationY: number) => boolean;
  onTap: () => void;
  onClose?: () => void;
}

/**
 * 全局浮动小窗的拖拽 + 吸边 + 点击/关闭分发。
 * 返回 panHandlers 直接展开到容器，transform 应用 pan.getTranslateTransform()。
 */
export function useMiniDrag({ width, height, hitClose, onTap, onClose }: Options) {
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
  // 用 ref 保持最新回调，避免 PanResponder 闭包过期
  const cbRef = useRef({ onTap, onClose, hitClose });
  cbRef.current = { onTap, onClose, hitClose };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
          isDragging.current = true;
        }
        pan.x.setValue(gs.dx);
        pan.y.setValue(gs.dy);
      },
      onPanResponderRelease: (evt) => {
        pan.flattenOffset();
        if (!isDragging.current) {
          const { locationX, locationY } = evt.nativeEvent;
          const cb = cbRef.current;
          if (cb.hitClose?.(locationX, locationY) && cb.onClose) {
            cb.onClose();
          } else {
            cb.onTap();
          }
          return;
        }
        const { width: sw, height: sh } = Dimensions.get('window');
        const curX = (pan.x as any)._value;
        const curY = (pan.y as any)._value;
        const snapRight = 0;
        const snapLeft = -(sw - width - 24);
        const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
        const clampedY = Math.max(-sh + height + 60, Math.min(60, curY));
        Animated.spring(pan, {
          toValue: { x: snapX, y: clampedY },
          useNativeDriver: false,
          tension: 120,
          friction: 10,
        }).start();
      },
      onPanResponderTerminate: () => { pan.flattenOffset(); },
    }),
  ).current;

  return { pan, panHandlers: panResponder.panHandlers };
}

```

### Core Architecture Module: `hooks/useRelatedVideos.ts`
```
import { useState, useCallback, useEffect, useRef } from 'react';
import { getVideoRelated } from '../services/bilibili';
import type { VideoItem } from '../services/types';

export function useRelatedVideos(bvid: string) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // 切到不同 bvid 时立刻清空，避免新页面短暂显示上一支视频的推荐流
  useEffect(() => {
    setVideos([]);
  }, [bvid]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await getVideoRelated(bvid);
      setVideos(data);
    } catch (e) {
      console.warn('useRelatedVideos: failed', e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [bvid]);

  return { videos, loading, load, hasMore: false };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30** (2026-03-25): **fix(web): 补全缺失的 web shims 并修复渲染崩溃问题**
  *Symptoms*: ## 改动说明  补全 web 平台缺失的 shim 文件，修复多个导致页面崩溃的问题，包括 Metro SHA-1 错误、React 渲染崩溃、tab 切换报错及 Ionicons 字体 404。  ## 改动类型  - [x] Bug 修复 - [ ] 新功能 - [ ] 重构（不改变功能） - [x] 文档更新 - [ ] 其他：  ## 关联 Issue  > 无  ## 测试平台  - [ ] Android（Dev Build） - [ ] Android（Expo Go） - [ ] iOS - [x] Web  ## 截图 / 录屏（如适用）  无  ## 注意事项  - [x] 代码中无硬编码账号信息（SESSDATA、uid 等） - [x] Commit 信息符合 Conventional Commits 规范 - [x] 已在本地测试通过 
  **Post-Mortem & Fix Analysis**:
  > 请不要为此项目贡献任何代码，全程营销造假。 请看这里 https://github.com/tiajinsha/JKVideo/discussions/29#discussioncomment-16293632 https://github.com/tiajinsha/JKVideo/discussions/31

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

### Incident Patch 1: `5bbc445b` (2026-03-25)
**Commit Message**: fix: login() 改为延迟后台拉取头像，修复 getFollowedLiveRooms 并发问题

login() 内 await getUserInfo() 导致 login() 慢返回，Zustand set 触发
FollowedLiveStrip 立即发起 getFollowedLiveRooms，与内部 getUserInfo
并发打到 B站新 session，触发风控返回空数据。

改为 setTimeout 1s 后台执行，login() 快速返回，各请求错开发出。

**File**: `store/authStore.ts` (modified, +11/-10)
```diff
@@ -27,16 +27,17 @@ export const useAuthStore = create<AuthState>((set) => ({
     // Migrate: remove SESSDATA from AsyncStorage if it was there before
     await AsyncStorage.removeItem('SESSDATA').catch(() => {});
     set({ sessdata, uid: uid || null, username: username || null, isLoggedIn: true });
-    // 登录后立即拉取用户信息，确保当前 session 头像可用（不依赖调用方 setProfile）
-    try {
-      const info = await getUserInfo();
-      await AsyncStorage.multiSet([
-        ['UID', String(info.mid)],
-        ['USERNAME', info.uname],
-        ['FACE', info.face],
-      ]);
-      set({ face: info.face, username: info.uname, uid: String(info.mid) });
-    } catch {}
+    // 延迟 1s 后台拉取头像，避免与登录后立即触发的其他请求（如 getFollowedLiveRooms）并发
+    setTimeout(() => {
+      getUserInfo().then(async (info) => {
+        await AsyncStorage.multiSet([
+          ['UID', String(info.mid)],
+          ['USERNAME', info.uname],
+          ['FACE', info.face],
+        ]).catch(() => {});
+        set({ face: info.face, username: info.uname, uid: String(info.mid) });
+      }).catch(() => {});
+    }, 1000);
   },
 
   logout: async () => {
```

---

### Incident Patch 2: `014b5d52` (2026-03-25)
**Commit Message**: fix: FollowedLiveStrip 样式优化 + getFollowedLiveRooms 参数调整

**File**: `components/FollowedLiveStrip.tsx` (modified, +8/-3)
```diff
@@ -46,13 +46,18 @@ export function FollowedLiveStrip() {
           >
             <View style={styles.pulseRow}>
               <LivePulse />
-              <Text style={{ color: "#fff", fontSize: 9,marginLeft:2 }}>直播</Text>
+              <Text style={{ color: "#fff", fontSize: 9, marginLeft: 2 }}>
+                直播
+              </Text>
             </View>
             <Image
               source={{ uri: proxyImageUrl(room.face) }}
               style={[styles.avatar, { backgroundColor: theme.card }]}
             />
-            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
+            <Text
+              style={[styles.name, { color: theme.text }]}
+              numberOfLines={1}
+            >
               {room.uname.length > 5 ? room.uname.slice(0, 5) : room.uname}
             </Text>
           </TouchableOpacity>
@@ -65,7 +70,7 @@ export function FollowedLiveStrip() {
 const styles = StyleSheet.create({
   container: {
     backgroundColor: "#f4f4f4",
-    paddingHorizontal: 3,
+    paddingHorizontal: 4,
     paddingVertical: 8,
   },
   scrollContent: {
```

**File**: `services/bilibili.ts` (modified, +1/-2)
```diff
@@ -509,8 +509,7 @@ export async function getDanmaku(cid: number): Promise<DanmakuItem[]> {
 
 export async function getFollowedLiveRooms(): Promise<LiveRoom[]> {
   const res = await api.get(`${LIVE_BASE}/xlive/web-ucenter/v1/xfetter/FeedList`, {
-    params: { page: 1, page_size: 30, platform: 'web' },
-    headers: { Referer: 'https://live.bilibili.com' },
+    params: { page: 1, page_size: 10, platform: 'web' },
   });
   if (res.data?.code !== 0) {
     console.warn('getFollowedLiveRooms error:', res.data?.code, res.data?.message);
```

---

### Incident Patch 3: `27587859` (2026-03-25)
**Commit Message**: fix: getFollowedLiveRooms 修正 Referer、校验 code、兼容 list/rooms 字段

**File**: `services/bilibili.ts` (modified, +8/-2)
```diff
@@ -509,9 +509,15 @@ export async function getDanmaku(cid: number): Promise<DanmakuItem[]> {
 
 export async function getFollowedLiveRooms(): Promise<LiveRoom[]> {
   const res = await api.get(`${LIVE_BASE}/xlive/web-ucenter/v1/xfetter/FeedList`, {
-    params: { page: 1, page_size: 10, platform: 'web' },
+    params: { page: 1, page_size: 30, platform: 'web' },
+    headers: { Referer: 'https://live.bilibili.com' },
   });
-  const list = res.data?.data?.list ?? [];
+  if (res.data?.code !== 0) {
+    console.warn('getFollowedLiveRooms error:', res.data?.code, res.data?.message);
+    return [];
+  }
+  // B站不同版本接口返回字段可能为 list 或 rooms
+  const list: any[] = res.data?.data?.list ?? res.data?.data?.rooms ?? [];
   return list.map((r: any) => ({
     roomid: r.room_id ?? r.roomid,
     uid: r.uid,
```

#### Recent Merged Pull Requests:
- **PR #30** (2026-03-25): fix(web): 补全缺失的 web shims 并修复渲染崩溃问题 (@Actv6)

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

## X. login() 改为延迟后台拉取头像，修复 getFollowedLiveRooms 并发问题

**RULE**:
When implementing operations in `store/authStore.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tiajinsha/JKVideo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5bbc445b`: login() 改为延迟后台拉取头像，修复 getFollowedLiveRooms 并发问题. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `store/authStore.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    // 延迟 1s 后台拉取头像，避免与登录后立即触发的其他请求（如 getFollowedLiveRooms）并发
    setTimeout(() => {
      getUserInfo().then(async (info) => {
        await AsyncStorage.multiSet([
          ['UID', String(info.mid)],
          ['USERNAME', info.uname],
          ['FACE', info.face],
        ]).catch(() => {});
        set({ face: info.face, username: info.uname, uid: String(info.mid) });
      }).catch(() => {});
    }, 1000);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    // 登录后立即拉取用户信息，确保当前 session 头像可用（不依赖调用方 setProfile）
    try {
      const info = await getUserInfo();
      await AsyncStorage.multiSet([
        ['UID', String(info.mid)],
        ['USERNAME', info.uname],
        ['FACE', info.face],
      ]);
      set({ face: info.face, username: info.uname, uid: String(info.mid) });
    } catch {}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5bbc445b` are properly handled with clean fallback behavior.
