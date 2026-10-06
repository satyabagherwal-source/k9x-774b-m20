# Forensic Learning Record (Deep Inspection): tiajinsha/JKVideo

> **Canonical Artifact**: `07_PROJECT_LEARNING/tiajinsha-jkvideo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tiajinsha/JKVideo](https://github.com/tiajinsha/JKVideo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:11:47.602Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tiajinsha/JKVideo`
- **Description**: 高颜值第三方 B 站 React Native 客户端
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4994 stars

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

### Core Architecture Module: `hooks/useSearch.ts`
```
import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchVideos, getSearchSuggest, getHotSearch } from '../services/bilibili';
import type { VideoItem, SearchSuggestItem, HotSearchItem } from '../services/types';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 20;

export type SearchSort = 'default' | 'pubdate' | 'view';

async function loadHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveHistory(history: string[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function useSearch() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<SearchSort>('default');
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestItem[]>([]);
  const [hotSearches, setHotSearches] = useState<HotSearchItem[]>([]);
  const loadingRef = useRef(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSort = useRef<SearchSort>('default');

  // Load history & hot searches on mount
  useEffect(() => {
    loadHistory().then(setHistory);
    getHotSearch().then(setHotSearches);
  }, []);

  // Debounced suggestions
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!keyword.trim() || keyword.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      const items = await getSearchSuggest(keyword.trim());
      setSuggestions(items);
    }, 300);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [keyword]);

  const addToHistory = useCallback(async (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    setHistory(prev => {
      const filtered = prev.filter(h => h !== trimmed);
      const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback(async (kw: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h !== kw);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  }, []);

  const search = useCallback(async (kw: string, reset = false, sortOverride?: SearchSort) => {
    if (!kw.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setSuggestions([]);
    const activeSort = sortOverride ?? currentSort.current;
    const currentPage = reset ? 1 : page;
    const orderParam = activeSort === 'pubdate' ? 'pubdate' : activeSort === 'view' ? 'click' : '';
    try {
      const items = await searchVideos(kw, currentPage, orderParam);
      if (reset) {
        setResults(items);
        setPage(2);
        addToHistory(kw);
      } else {
        setResults(prev => [...prev, ...items]);
        setPage(p => p + 1);
      }
      setHasMore(items.length >= 20);
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page, addToHistory]);

  const changeSort = useCallback((newSort: SearchSort) => {
    setSort(newSort);
    currentSort.current = newSort;
    if (keyword.trim()) {
      search(keyword, true, newSort);
    }
  }, [keyword, search]);

  const loadMore = useCallback(() => {
    if (!keyword.trim() || loadingRef.current || !hasMore) return;
    search(keyword, false);
  }, [keyword, hasMore, search]);

  return {
    keyword, setKeyword,
    results, loading, hasMore,
    search, loadMore,
    sort, changeSort,
    history, removeFromHistory, clearHistory,
    suggestions,
    hotSearches,
  };
}

```

### Core Architecture Module: `hooks/useVideoDetail.ts`
```
import { useState, useEffect, useRef } from 'react';
import { getVideoDetail, getPlayUrl } from '../services/bilibili';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { usePlayProgressStore } from '../store/playProgressStore';
import type { VideoItem, PlayUrlResponse } from '../services/types';

export function useVideoDetail(bvid: string) {
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [playData, setPlayData] = useState<PlayUrlResponse | null>(null);
  const [qualities, setQualities] = useState<{ qn: number; desc: string }[]>([]);
  const [currentQn, setCurrentQn] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState(0);
  const cidRef = useRef<number>(0);
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const trafficSaving = useSettingsStore(s => s.trafficSaving);
  const defaultQn = trafficSaving ? 16 : 126;

  async function fetchPlayData(cid: number, qn: number, updateList = false) {
    const data = await getPlayUrl(bvid, cid, qn);
    setPlayData(data);
    setCurrentQn(data.quality);
    if (updateList && data.accept_quality?.length) {
      setQualities(
        data.accept_quality.map((q, i) => ({
          qn: q,
          desc: data.accept_description?.[i] ?? String(q),
        }))
      );
    }
  }

  async function changeQuality(qn: number) {
    await fetchPlayData(cidRef.current, qn);
  }

  useEffect(() => {
    // bvid 切换时立刻清空旧数据，防止上一支视频的播放器/简介/清晰度短暂"残影"造成抖动
    setVideo(null);
    setPlayData(null);
    setQualities([]);
    setCurrentQn(0);
    cidRef.current = 0;
    async function fetchData() {
      try {
        setLoading(true);
        // 读取续播位置
        setInitialTime(usePlayProgressStore.getState().get(bvid));
        const detail = await getVideoDetail(bvid);
        setVideo(detail);
        const cid = detail.pages?.[0]?.cid ?? detail.cid as number;
        cidRef.current = cid;
        await fetchPlayData(cid, defaultQn, true);
      } catch (e: any) {
        setError(e.message ?? 'Load failed');
      } finally {
        setLoading(false);
      }
    }
    if (bvid) fetchData();
  }, [bvid]);

  // 登录状态变化时重新拉取清晰度列表（登录后可能获得更高画质）
  // cancelled flag 防止旧响应（切换登录态后）覆盖新响应
  useEffect(() => {
    if (!cidRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlayUrl(bvid, cidRef.current, defaultQn);
        if (cancelled) return;
        setPlayData(data);
        setCurrentQn(data.quality);
        if (data.accept_quality?.length) {
          setQualities(
            data.accept_quality.map((q, i) => ({
              qn: q,
              desc: data.accept_description?.[i] ?? String(q),
            })),
          );
        }
      } catch (e) {
        if (!cancelled) console.warn('Failed to refresh quality list after login change:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  return { video, playData, loading, error, qualities, currentQn, changeQuality, initialTime };
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

### Incident Patch 1: `53c67079` (2026-05-12)
**Commit Message**: bug修改

**File**: `app/_layout.tsx` (modified, +4/-0)
```diff
@@ -6,6 +6,8 @@ import { useEffect } from 'react';
 import { useAuthStore } from '../store/authStore';
 import { useDownloadStore } from '../store/downloadStore';
 import { useSettingsStore } from '../store/settingsStore';
+import { usePlayProgressStore } from '../store/playProgressStore';
+import { initMiniExclusion } from '../store/miniExclusion';
 import { useTheme } from '../utils/theme';
 import { MiniPlayer } from '../components/MiniPlayer';
 import { LiveMiniPlayer } from '../components/LiveMiniPlayer';
@@ -35,6 +37,8 @@ function RootLayout() {
     restore();
     loadDownloads();
     restoreSettings();
+    usePlayProgressStore.getState().hydrate();
+    initMiniExclusion();
   }, []);
 
   if (!fontsLoaded) return null;
```

**File**: `app/index.tsx` (modified, +88/-64)
```diff
@@ -36,11 +36,11 @@ import {
   toListRows,
   type ListRow,
   type BigRow,
-  type LiveRow,
 } from "../utils/videoRows";
 import { BigVideoCard } from "../components/BigVideoCard";
 import { FollowedLiveStrip } from "../components/FollowedLiveStrip";
 import { useTheme } from "../utils/theme";
+import { useVisibleBigKeyStore } from "../store/visibleBigKeyStore";
 import type { LiveRoom } from "../services/types";
 
 const HEADER_H = 44;
@@ -69,8 +69,7 @@ const LIVE_AREAS = [
 
 export default function HomeScreen() {
   const router = useRouter();
-  const { pages, liveRooms, loading, refreshing, load, refresh } =
-    useVideoList();
+  const { pages, loading, refreshing, load, refresh } = useVideoList();
   const {
     rooms,
     loading: liveLoading,
@@ -85,8 +84,7 @@ export default function HomeScreen() {
   const [liveAreaId, setLiveAreaId] = useState(0);
 
   const theme = useTheme();
-  const [visibleBigKey, setVisibleBigKey] = useState<string | null>(null);
-  const rows = useMemo(() => toListRows(pages, liveRooms), [pages, liveRooms]);
+  const rows = useMemo(() => toListRows(pages), [pages]);
   const pagerRef = useRef<PagerView>(null);
 
   const hotListRef = useRef<FlatList>(null);
@@ -97,57 +95,113 @@ export default function HomeScreen() {
       const bigRow = viewableItems.find(
         (v) => v.item && (v.item as ListRow).type === "big",
       );
-      setVisibleBigKey(bigRow ? (bigRow.item as BigRow).item.bvid : null);
+      useVisibleBigKeyStore.getState().setKey(bigRow ? (bigRow.item as BigRow).item.bvid : null);
     },
   ).current;
 
-  const scrollY = useRef(new Animated.Value(0)).current;
+  // 滚动累计阈值：方向反转后需累计滚动该距离才触发显隐切换
+  const SCROLL_THRESHOLD = 40;
+  // 显隐过渡时长
+  const HEADER_ANIM_MS = 100;
 
-  const headerTranslate = scrollY.interpolate({
+  const headerOffset = useRef(new Animated.Value(0)).current; // 0 = 显示，HEADER_H = 隐藏
+  const liveHeaderOffset = useRef(new Animated.Value(0)).current;
+
+  const headerTranslate = headerOffset.interpolate({
     inputRange: [0, HEADER_H],
     outputRange: [0, -HEADER_H],
     extrapolate: "clamp",
   });
-
-  const headerOpacity = scrollY.interpolate({
-    inputRange: [0, HEADER_H * 0.2],
-    outputRange: [1, 0],
+  const headerOpacity = headerOffset.interpolate({
+    inputRange: [0, HEADER_H * 0.6, HEADER_H],
+    outputRange: [1, 1, 0],
     extrapolate: "clamp",
   });
 
-  // 直播列表也共用同一个 scrollY
-  const liveScrollY = useRef(new Animated.Value(0)).current;
-
-  const liveHeaderTranslate = liveScrollY.interpolate({
+  const liveHeaderTranslate = liveHeaderOffset.interpolate({
     inputRange: [0, HEADER_H],
     outputRange: [0, -HEADER_H],
     extrapolate: "clamp",
   });
-
-  const liveHeaderOpacity = liveScrollY.interpolate({
-    inputRange: [0, HEADER_H * 0.2],
-    outputRange: [1, 0],
+  const liveHeaderOpacity = liveHeaderOffset.interpolate({
+    inputRange: [0, HEADER_H * 0.6, HEADER_H],
+    outputRange: [1, 1, 0],
     extrapolate: "clamp",
   });
 
+  const hotScrollState = useRef({ lastY: 0, acc: 0, dir: 0, hidden: false }).current;
+  const liveScrollState = useRef({ lastY: 0, acc: 0, dir: 0, hidden: false }).current;
+
+  const animateHeader = useCallback(
+    (offset: Animated.Value, hide: boolean) => {
+      Animated.timing(offset, {
+        toValue: hide ? HEADER_H : 0,
+        duration: HEADER_ANIM_MS,
+        useNativeDriver: true,
+      }).start();
+    },
+    [],
+  );
+
+  const updateHeaderForScroll = useCallback(
+    (
+      y: number,
+      state: { lastY: number; acc: number; dir: number; hidden: boolean },
+      offset: Animated.Value,
+    ) => {
+      // 顶部强制显示
+      if (y <= 0) {
+        if (state.hidden) {
+          state.hidden = false;
+          animateHeader(offset, false);
+        }
+        state.lastY = 0;
+        state.acc = 0;
+        state.dir = 0;
+        return;
+      }
+      const dy = y - state.lastY;
+      state.lastY = y;
+      if (Math.abs(dy) < 1) return;
+      const dir = dy > 0 ? 1 : -1; // 1=向下滚（隐藏），-1=向上滚（显示）
+      if (dir !== state.dir) {
+        state.dir = dir;
+        state.acc = 0;
+      }
+      state.acc += Math.abs(dy);
+      if (state.acc < SCROLL_THRESHOLD) return;
+      const shouldHide = dir === 1;
+      if (shouldHide !== state.hidden) {
+        state.hidden = shouldHide;
+        animateHeader(offset, shouldHide);
+      }
+      state.acc = 0;
+    },
+    [animateHeader],
+  );
+
   useEffect(() => {
     load();
   }, []);
 
-  const onScroll = useMemo(
-    () =>
-      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
-        useNativeDriver: true,
-      }),
-    [],
+  const onScroll = useCallback(
+    (e: any) =>
+      updateHeaderForScroll(
+        e.nativeEvent.contentOffset.y,
+        hotScrollState,
+        headerOffset,
+      ),
+    [updateHeaderForScroll],
   );
 
-  const onLiveScroll = useMemo(
-    () =>
-      Animated.event([{ nativeEvent: { contentOffset: { y: liveScrollY } } 
```

**File**: `app/video/[bvid].tsx` (modified, +64/-16)
```diff
@@ -1,11 +1,13 @@
-import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
 import {
   View,
   Text,
   FlatList,
   StyleSheet,
   TouchableOpacity,
   ActivityIndicator,
+  useWindowDimensions,
+  InteractionManager,
 } from "react-native";
 import { Image } from "expo-image";
 import { SafeAreaView } from "react-native-safe-area-context";
@@ -22,6 +24,7 @@ import { useRelatedVideos } from "../../hooks/useRelatedVideos";
 import { formatCount, formatDuration } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { DownloadSheet } from "../../components/DownloadSheet";
+import { VideoDetailSkeleton } from "../../components/VideoDetailSkeleton";
 import { useTheme } from "../../utils/theme";
 import { useLiveStore } from "../../store/liveStore";
 
@@ -36,13 +39,22 @@ export default function VideoDetailScreen() {
     useLiveStore.getState().clearLive();
   }, []);
 
+  // 骨架屏最短展示时长：即便数据秒回，也至少撑够这么久，避免一闪而过
+  const SKELETON_MIN_MS = 600;
+  const [minSkeletonElapsed, setMinSkeletonElapsed] = useState(false);
+  useEffect(() => {
+    const t = setTimeout(() => setMinSkeletonElapsed(true), SKELETON_MIN_MS);
+    return () => clearTimeout(t);
+  }, []);
+
   const {
     video,
     playData,
     loading: videoLoading,
     qualities,
     currentQn,
     changeQuality,
+    initialTime,
   } = useVideoDetail(bvid as string);
   const [commentSort, setCommentSort] = useState<0 | 2>(2);
   const {
@@ -67,20 +79,36 @@ export default function VideoDetailScreen() {
     load: loadRelated,
   } = useRelatedVideos(bvid as string);
 
-  useEffect(() => { loadRelated(); }, []);
+  // 推荐视频不参与首屏，等导航动画结束再拉，避免与详情/播放流抢 JS 线程
+  useEffect(() => {
+    const handle = InteractionManager.runAfterInteractions(() => {
+      loadRelated();
+    });
+    return () => handle.cancel();
+  }, []);
 
   useEffect(() => {
-    if (video?.aid) loadComments();
+    if (!video?.aid) return;
+    const handle = InteractionManager.runAfterInteractions(() => {
+      loadComments();
+    });
+    return () => handle.cancel();
   }, [video?.aid, commentSort]);
 
   useEffect(() => {
     if (!video?.cid) return;
-    getDanmaku(video.cid).then(setDanmakus).catch(() => {});
+    const handle = InteractionManager.runAfterInteractions(() => {
+      getDanmaku(video.cid!).then(setDanmakus).catch(() => {});
+    });
+    return () => handle.cancel();
   }, [video?.cid]);
 
   useEffect(() => {
     if (!video?.owner?.mid) return;
-    getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
+    const handle = InteractionManager.runAfterInteractions(() => {
+      getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
+    });
+    return () => handle.cancel();
   }, [video?.owner?.mid]);
 
   return (
@@ -107,6 +135,7 @@ export default function VideoDetailScreen() {
         cid={video?.cid}
         danmakus={danmakus}
         onTimeUpdate={setCurrentTime}
+        initialTime={initialTime}
       />
       <DownloadSheet
         visible={showDownload}
@@ -139,9 +168,9 @@ export default function VideoDetailScreen() {
       )}
 
       {/* Tab content */}
-      {videoLoading ? (
-        <ActivityIndicator style={styles.loader} color="#00AEEC" />
-      ) : video ? (
+      {videoLoading || !video || !minSkeletonElapsed ? (
+        <VideoDetailSkeleton />
+      ) : (
         <>
           {tab === "intro" && (
             <FlatList<import("../../services/types").VideoItem>
@@ -306,7 +335,7 @@ export default function VideoDetailScreen() {
             style={[styles.danmakuTab, tab !== "danmaku" && { display: "none" }]}
           />
         </>
-      ) : null}
+      )}
     </SafeAreaView>
   );
 }
@@ -322,17 +351,33 @@ function SeasonSection({
   onEpisodePress: (bvid: string) => void;
 }) {
   const theme = useTheme();
+  const { width: screenW } = useWindowDimensions();
   const episodes = season.sections?.[0]?.episodes ?? [];
   const currentIndex = episodes.findIndex((ep) => ep.bvid === currentBvid);
   const listRef = useRef<FlatList>(null);
+  // 初次渲染先隐身，scrollToOffset 完成后再显示，彻底消除"先 0 再跳"的可见闪烁
+  const [ready, setReady] = useState(currentIndex <= 0);
 
-  useEffect(() => {
-    if (currentIndex <= 0 || episodes.length === 0) return;
-    const t = setTimeout(() => {
-      listRef.current?.scrollToIndex({ index: currentIndex, viewPosition: 0.5, animated: false });
-    }, 200);
-    return () => clearTimeout(t);
-  }, [currentIndex, episodes.length]);
+  // 计算让当前集水平居中的初始 contentOffset
+  const initialOffset = useMemo(() => {
+    if (currentIndex <= 0) return 0;
+    const ITEM_WIDTH = 120;
+    const STEP = 130; // 120 + 10 gap
+    const PADDING = 12;
+    const itemCenter = PADDING + currentIndex * STEP + ITEM_WIDTH / 2;
+    return Math.max(0, itemCenter - screenW / 2);
+  }, [currentIndex, screenW]);
+
+  // 内容布局完成时（getItemLayout 同步即
```

**File**: `components/BigVideoCard.tsx` (modified, +37/-8)
```diff
@@ -24,7 +24,9 @@ import { coverImageUrl } from "../utils/imageUrl";
 import { useSettingsStore } from "../store/settingsStore";
 import { useTheme } from "../utils/theme";
 import { useLiveStore } from "../store/liveStore";
+import { usePlayUrlCache } from "../store/playUrlCache";
 import { formatCount, formatDuration } from "../utils/format";
+import { useVisibleBigKeyStore } from "../store/visibleBigKeyStore";
 import type { VideoItem } from "../services/types";
 
 const HEADERS = {
@@ -45,17 +47,16 @@ function clamp(v: number, lo: number, hi: number) {
 
 interface Props {
   item: VideoItem;
-  isVisible: boolean;
   isScrolling?: boolean;
   onPress: () => void;
 }
 
 export const BigVideoCard = React.memo(function BigVideoCard({
   item,
-  isVisible,
   isScrolling,
   onPress,
 }: Props) {
+  const isVisible = useVisibleBigKeyStore((s) => s.key) === item.bvid;
   const { width: SCREEN_W } = useWindowDimensions();
   const trafficSaving = useSettingsStore(s => s.trafficSaving);
   const liveActive = useLiveStore(s => s.isActive);
@@ -79,6 +80,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
   const durationRef = useRef(0);
   const seekingRef = useRef(false);
   const [seekLabel, setSeekLabel] = useState<string | null>(null);
+  const lastProgressUpdate = useRef(0);
 
   // Reset video state when the item changes
   useEffect(() => {
@@ -98,6 +100,18 @@ export const BigVideoCard = React.memo(function BigVideoCard({
     let cancelled = false;
     (async () => {
       try {
+        // 命中缓存（5min TTL）直接复用
+        const cached = usePlayUrlCache.getState().get(item.bvid, 16);
+        if (cached) {
+          if (cancelled) return;
+          if (cached.playData.dash) {
+            setIsDash(true);
+            setVideoUrl(cached.mpdUri ?? cached.playData.dash.video[0]?.baseUrl);
+          } else {
+            setVideoUrl(cached.playData.durl?.[0]?.url);
+          }
+          return;
+        }
         let cid = item.cid;
         if (!cid) {
           const detail = await getVideoDetail(item.bvid);
@@ -113,13 +127,22 @@ export const BigVideoCard = React.memo(function BigVideoCard({
         if (playData.dash) {
           if (!cancelled) setIsDash(true);
           try {
-            const mpdUri = await buildDashMpdUri(playData, 16);
-            if (!cancelled) setVideoUrl(mpdUri);
+            const mpdUri = await buildDashMpdUri(playData, 16, item.bvid);
+            if (!cancelled) {
+              setVideoUrl(mpdUri);
+              usePlayUrlCache.getState().set(item.bvid, 16, { playData, mpdUri });
+            }
           } catch {
-            if (!cancelled) setVideoUrl(playData.dash.video[0]?.baseUrl);
+            if (!cancelled) {
+              setVideoUrl(playData.dash.video[0]?.baseUrl);
+              usePlayUrlCache.getState().set(item.bvid, 16, { playData });
+            }
           }
         } else {
-          if (!cancelled) setVideoUrl(playData.durl?.[0]?.url);
+          if (!cancelled) {
+            setVideoUrl(playData.durl?.[0]?.url);
+            usePlayUrlCache.getState().set(item.bvid, 16, { playData });
+          }
         }
       } catch (e) {
         console.warn("BigVideoCard: failed to load play URL", e);
@@ -252,8 +275,14 @@ export const BigVideoCard = React.memo(function BigVideoCard({
               seekableDuration: dur,
               playableDuration: buf,
             }) => {
-              if (!seekingRef.current) setCurrentTime(ct);
-              if (dur > 0) setDuration(dur);
+              currentTimeRef.current = ct;
+              if (dur > 0) durationRef.current = dur;
+              if (seekingRef.current) return;
+              const now = Date.now();
+              if (now - lastProgressUpdate.current < 450) return;
+              lastProgressUpdate.current = now;
+              setCurrentTime(ct);
+              if (dur > 0 && Math.abs(dur - duration) > 1) setDuration(dur);
               setBuffered(buf);
             }}
           />
```

**File**: `components/DanmakuOverlay.tsx` (modified, +9/-3)
```diff
@@ -13,6 +13,10 @@ interface Props {
 
 const LANE_COUNT = 5;
 const LANE_H = 28;
+// 同屏弹幕上限（原 30，提至 60）
+const MAX_ACTIVE = 60;
+// activated 集合阈值，触达后整体清零防止内存膨胀
+const ACTIVATED_LIMIT = 1000;
 
 interface ActiveDanmaku {
   id: string;
@@ -73,7 +77,10 @@ export default function DanmakuOverlay({ danmakus, currentTime, screenWidth, scr
 
     const newItems: ActiveDanmaku[] = [];
 
-    if (activated.current.size > 200) activated.current.clear(); // prevent memory leak
+    if (activated.current.size > ACTIVATED_LIMIT) {
+      activated.current.clear(); // prevent memory leak
+      idCounter.current = 0;
+    }
     for (const item of candidates) {
       const key = `${item.time}_${item.text}`;
       activated.current.add(key);
@@ -124,8 +131,7 @@ export default function DanmakuOverlay({ danmakus, currentTime, screenWidth, scr
     if (newItems.length > 0) {
       setActiveDanmakus(prev => {
         const combined = [...prev, ...newItems];
-        // Cap at 30 simultaneous danmakus
-        return combined.slice(Math.max(0, combined.length - 30));
+        return combined.slice(Math.max(0, combined.length - MAX_ACTIVE));
       });
     }
   }, [currentTime, visible, danmakus, pickLane, screenWidth]);
```

**File**: `components/LiveMiniPlayer.tsx` (modified, +22/-64)
```diff
@@ -1,12 +1,10 @@
-import React, { useRef } from 'react';
+import React, { useState, useEffect } from 'react';
 import {
   View,
   Text,
   Image,
   StyleSheet,
   Animated,
-  PanResponder,
-  Dimensions,
   Platform,
 } from 'react-native';
 import { useRouter } from 'expo-router';
@@ -15,6 +13,7 @@ import { Ionicons } from '@expo/vector-icons';
 import { useLiveStore } from '../store/liveStore';
 import { useVideoStore } from '../store/videoStore';
 import { proxyImageUrl } from '../utils/imageUrl';
+import { useMiniDrag } from '../hooks/useMiniDrag';
 
 const MINI_W = 160;
 const MINI_H = 90;
@@ -25,70 +24,29 @@ const LIVE_HEADERS = {
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 };
 
-function snapRelease(
-  pan: Animated.ValueXY,
-  curX: number,
-  curY: number,
-  sw: number,
-  sh: number,
-) {
-  const snapRight = 0;
-  const snapLeft = -(sw - MINI_W - 24);
-  const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
-  const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
-  Animated.spring(pan, {
-    toValue: { x: snapX, y: clampedY },
-    useNativeDriver: false,
-    tension: 120,
-    friction: 10,
-  }).start();
-}
-
 export function LiveMiniPlayer() {
   const { isActive, roomId, title, cover, hlsUrl, clearLive } = useLiveStore();
   const videoMiniActive = useVideoStore(s => s.isActive);
   const router = useRouter();
   const insets = useSafeAreaInsets();
-  const pan = useRef(new Animated.ValueXY()).current;
-  const isDragging = useRef(false);
+  // 关闭时先把 Video 暂停一帧，让 native 释放连接，再 unmount
+  const [paused, setPaused] = useState(false);
 
-  // 用 ref 保持最新值，避免 PanResponder 闭包捕获过期的初始值
-  const storeRef = useRef({ roomId, clearLive, router });
-  storeRef.current = { roomId, clearLive, router };
+  // 切换到不同直播间时重置 paused
+  useEffect(() => {
+    if (isActive) setPaused(false);
+  }, [hlsUrl, isActive]);
 
-  const panResponder = useRef(
-    PanResponder.create({
-      onStartShouldSetPanResponder: () => true,
-      onPanResponderGrant: () => {
-        isDragging.current = false;
-        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
-        pan.setValue({ x: 0, y: 0 });
-      },
-      onPanResponderMove: (_, gs) => {
-        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
-          isDragging.current = true;
-        }
-        pan.x.setValue(gs.dx);
-        pan.y.setValue(gs.dy);
-      },
-      onPanResponderRelease: (evt) => {
-        pan.flattenOffset();
-        if (!isDragging.current) {
-          const { locationX, locationY } = evt.nativeEvent;
-          const { roomId: rid, clearLive: clear, router: r } = storeRef.current;
-          if (locationX > MINI_W - 28 && locationY < 28) {
-            clear();
-          } else {
-            r.push(`/live/${rid}` as any);
-          }
-          return;
-        }
-        const { width: sw, height: sh } = Dimensions.get('window');
-        snapRelease(pan, (pan.x as any)._value, (pan.y as any)._value, sw, sh);
-      },
-      onPanResponderTerminate: () => { pan.flattenOffset(); },
-    }),
-  ).current;
+  const { pan, panHandlers } = useMiniDrag({
+    width: MINI_W,
+    height: MINI_H,
+    hitClose: (x, y) => x > MINI_W - 28 && y < 28,
+    onTap: () => router.push(`/live/${roomId}` as any),
+    onClose: () => {
+      setPaused(true);
+      requestAnimationFrame(() => clearLive());
+    },
+  });
 
   if (!isActive) return null;
 
@@ -99,7 +57,7 @@ export function LiveMiniPlayer() {
     return (
       <Animated.View
         style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
-        {...panResponder.panHandlers}
+        {...panHandlers}
       >
         <Image source={{ uri: proxyImageUrl(cover) }} style={styles.videoArea} />
         <View style={styles.liveBadge} pointerEvents="none">
@@ -120,7 +78,7 @@ export function LiveMiniPlayer() {
   return (
     <Animated.View
       style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
-      {...panResponder.panHandlers}
+      {...panHandlers}
     >
       {/* pointerEvents="none" 防止 Video 原生层吞噬触摸事件 */}
       <View style={styles.videoArea} pointerEvents="none">
@@ -131,7 +89,7 @@ export function LiveMiniPlayer() {
           resizeMode="cover"
           controls={false}
           muted={false}
-          paused={false}
+          paused={paused}
           repeat={false}
           onError={clearLive}
         />
@@ -141,7 +99,7 @@ export function LiveMiniPlayer() {
         <Text style={styles.liveText}>LIVE</Text>
       </View>
       <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
-      {/* 关闭按钮视觉层，点击逻辑由 onPanResponderRelease 坐标判断 */}
+      {/* 关闭按钮视觉层，点击逻辑由 hitClose 坐标判断 */}
       <View style={styles.closeBtn}>
         <Ionicons name="close" size={14} color="#fff" />
       </View>
```

**File**: `components/MiniPlayer.tsx` (modified, +12/-57)
```diff
@@ -1,13 +1,11 @@
-import React, { useRef } from 'react';
-import {
-  View, Text, Image, StyleSheet,
-  Animated, PanResponder, Dimensions,
-} from 'react-native';
+import React from 'react';
+import { View, Text, Image, StyleSheet, Animated } from 'react-native';
 import { useRouter } from 'expo-router';
 import { useSafeAreaInsets } from 'react-native-safe-area-context';
 import { Ionicons } from '@expo/vector-icons';
 import { useVideoStore } from '../store/videoStore';
 import { proxyImageUrl } from '../utils/imageUrl';
+import { useMiniDrag } from '../hooks/useMiniDrag';
 
 const MINI_W = 160;
 const MINI_H = 90;
@@ -16,57 +14,14 @@ export function MiniPlayer() {
   const { isActive, bvid, title, cover, clearVideo } = useVideoStore();
   const router = useRouter();
   const insets = useSafeAreaInsets();
-  const pan = useRef(new Animated.ValueXY()).current;
-  const isDragging = useRef(false);
 
-  // 用 ref 保持最新值，避免 PanResponder 闭包捕获过期的初始值
-  const storeRef = useRef({ bvid, clearVideo, router });
-  storeRef.current = { bvid, clearVideo, router };
-
-  const panResponder = useRef(
-    PanResponder.create({
-      onStartShouldSetPanResponder: () => true,
-      onPanResponderGrant: () => {
-        isDragging.current = false;
-        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
-        pan.setValue({ x: 0, y: 0 });
-      },
-      onPanResponderMove: (_, gs) => {
-        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
-          isDragging.current = true;
-        }
-        pan.x.setValue(gs.dx);
-        pan.y.setValue(gs.dy);
-      },
-      onPanResponderRelease: (evt) => {
-        pan.flattenOffset();
-        if (!isDragging.current) {
-          const { locationX, locationY } = evt.nativeEvent;
-          const { bvid: vid, clearVideo: clear, router: r } = storeRef.current;
-          if (locationX > MINI_W - 28 && locationY < 28) {
-            clear();
-          } else {
-            r.push(`/video/${vid}` as any);
-          }
-          return;
-        }
-        const { width: sw, height: sh } = Dimensions.get('window');
-        const curX = (pan.x as any)._value;
-        const curY = (pan.y as any)._value;
-        const snapRight = 0;
-        const snapLeft = -(sw - MINI_W - 24);
-        const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
-        const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
-        Animated.spring(pan, {
-          toValue: { x: snapX, y: clampedY },
-          useNativeDriver: false,
-          tension: 120,
-          friction: 10,
-        }).start();
-      },
-      onPanResponderTerminate: () => { pan.flattenOffset(); },
-    })
-  ).current;
+  const { pan, panHandlers } = useMiniDrag({
+    width: MINI_W,
+    height: MINI_H,
+    hitClose: (x, y) => x > MINI_W - 28 && y < 28,
+    onTap: () => router.push(`/video/${bvid}` as any),
+    onClose: clearVideo,
+  });
 
   if (!isActive) return null;
 
@@ -75,11 +30,11 @@ export function MiniPlayer() {
   return (
     <Animated.View
       style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
-      {...panResponder.panHandlers}
+      {...panHandlers}
     >
       <Image source={{ uri: proxyImageUrl(cover) }} style={styles.cover} />
       <Text style={styles.title} numberOfLines={1}>{title}</Text>
-      {/* 关闭按钮仅作视觉展示，点击逻辑由 onPanResponderRelease 坐标判断处理 */}
+      {/* 关闭按钮仅作视觉展示，点击逻辑由 hitClose 坐标判断处理 */}
       <View style={styles.closeBtn}>
         <Ionicons name="close" size={14} color="#fff" />
       </View>
```

**File**: `components/NativeVideoPlayer.tsx` (modified, +257/-97)
```diff
@@ -16,6 +16,8 @@ import {
   Modal,
   Image,
   PanResponder,
+  ActivityIndicator,
+  Animated,
   useWindowDimensions,
 } from "react-native";
 import Video, { VideoRef } from "react-native-video";
@@ -25,11 +27,13 @@ import type {
   PlayUrlResponse,
   VideoShotData,
   DanmakuItem,
+  IVideoPlayer,
 } from "../services/types";
 import { buildDashMpdUri } from "../utils/dash";
 import { getVideoShot } from "../services/bilibili";
 import DanmakuOverlay from "./DanmakuOverlay";
 import { useTheme } from "../utils/theme";
+import { usePlayProgressStore } from "../store/playProgressStore";
 
 const BAR_H = 3;
 // 进度球尺寸
@@ -59,8 +63,8 @@ function findFrameByTime(index: number[], seekTime: number): number {
   return lo;
 }
 
-export interface NativeVideoPlayerRef {
-  seek: (t: number) => void;
+export interface NativeVideoPlayerRef extends IVideoPlayer {
+  /** @deprecated 用 pause()/resume() 代替 */
   setPaused: (v: boolean) => void;
 }
 
@@ -110,6 +114,9 @@ export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, Props>(
     const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 
     const [paused, setPaused] = useState(false);
+    // seek 后强制触发 react-native-video 重新评估 paused prop 的 hack 用的瞬时叠加态
+    // 单独存储以避免污染 paused（用于图标显示）：seek 完成的一瞬间不让"播放/暂停"图标闪
+    const [seekHackPaused, setSeekHackPaused] = useState(false);
     const [currentTime, setCurrentTime] = useState(0);
     const currentTimeRef = useRef(0);
     const [duration, setDuration] = useState(0);
@@ -118,15 +125,61 @@ export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, Props>(
 
     const [showQuality, setShowQuality] = useState(false);
 
+    // 倍速
+    const RATE_OPTIONS = [0.75, 1, 1.25, 1.5, 2];
+    const [rate, setRate] = useState(1);
+    const [showRate, setShowRate] = useState(false);
+
+    // 清晰度切换：保留进度 + loading 遮罩
+    const [switching, setSwitching] = useState(false);
+    const pendingSeekRef = useRef<number | null>(null);
+    const prevQnRef = useRef(currentQn);
+    const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
+
+    // 续播：每 5s 持久化一次
+    const lastSaveRef = useRef(0);
+
+    useEffect(() => {
+      // 排除初始挂载（prevQn 或 currentQn === 0）
+      if (
+        prevQnRef.current !== 0 &&
+        currentQn !== 0 &&
+        prevQnRef.current !== currentQn
+      ) {
+        pendingSeekRef.current = currentTimeRef.current;
+        setSwitching(true);
+        // 兜底：8s 内 onLoad 没触发就强制收起遮罩
+        if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
+        switchTimeoutRef.current = setTimeout(() => setSwitching(false), 8000);
+      }
+      prevQnRef.current = currentQn;
+    }, [currentQn]);
+
+    useEffect(() => {
+      return () => {
+        if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
+      };
+    }, []);
+
     const [buffered, setBuffered] = useState(0);
     const [isSeeking, setIsSeeking] = useState(false);
     const isSeekingRef = useRef(false);
-    const [touchX, setTouchX] = useState<number | null>(null);
-    const touchXRef = useRef<number | null>(null);
-    const rafRef = useRef<number | null>(null);
+    // 拖动球位置用 Animated.Value 驱动：setValue 不触发 React 重渲染，
+    // 原生层直接更新坐标，跟手 60fps。消除老方案 setState+60ms 节流导致的"段落感"。
+    const touchAnimX = useRef(new Animated.Value(0)).current;
+    // 缩略图换帧仍走 state（精灵图位移涉及 RN 视图属性变化），50ms 节流足够
+    const [thumbFrame, setThumbFrame] = useState<{
+      sheetIdx: number;
+      col: number;
+      row: number;
+      seekTime: number;
+    } | null>(null);
+    const thumbThrottleRef = useRef(0);
     const barOffsetX = useRef(0);
     const barWidthRef = useRef(300);
     const trackRef = useRef<View>(null);
+    // 让稳定的 PanResponder 闭包能读到最新 shots
+    const shotsRef = useRef<VideoShotData | null>(null);
 
     const [shots, setShots] = useState<VideoShotData | null>(null);
     const [showDanmaku, setShowDanmaku] = useState(true);
@@ -137,6 +190,9 @@ export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, Props>(
       seek: (t: number) => {
         videoRef.current?.seek(t);
       },
+      pause: () => setPaused(true),
+      resume: () => setPaused(false),
+      getCurrentTime: () => currentTimeRef.current,
       setPaused: (v: boolean) => {
         setPaused(v);
       },
@@ -153,7 +209,7 @@ export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, Props>(
         return;
       }
       if (isDash) {
-        buildDashMpdUri(playData, currentQn)
+        buildDashMpdUri(playData, currentQn, bvid)
           .then(setResolvedUrl)
           .catch(() => setResolvedUrl(playData.dash!.video[0]?.baseUrl));
       } else {
@@ -179,6 +235,25 @@ export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, Props>(
       durationRef.current = duration;
     }, [duration]);
 
+    useEffect(() => {
+      shotsRef.current = shots;
+    }, [shots]);
+
+    // 非拖动时，球/进度填充随 currentTime 同步（onProgress 驱动）
+    useEffect(() => {
+      i
```

---

### Incident Patch 2: `b0929a80` (2026-05-05)
**Commit Message**: feat: UP主页/视频详情页 UI 优化 + 多处交互修复

- creator: 头部模糊背景 + 滚动渐变 topBar，移除 removeClippedSubviews 修复列表抖动
- video: 简介 2 行折叠（onTextLayout 探测真实行数），tname 分区标签，统计数据前移到 UP 主行
- VideoCard/LiveCard: title 设 minHeight 解决两列卡片底部对齐
- LoginModal: 二维码过期支持原地重试，无需关闭重开
- search: 初始 loading 显示 indicator，搜索/选建议时自动收起键盘
- 统一图片组件为 expo-image：LiveCard / FollowedLiveStrip / downloads
- types: VideoItem 补 tname / pubdate 字段

**File**: `app/creator/[mid].tsx` (modified, +185/-62)
```diff
@@ -1,30 +1,38 @@
-import React, { useEffect, useState, useCallback } from 'react';
+import React, { useEffect, useState, useCallback, useRef } from 'react';
 import {
   View,
   Text,
   FlatList,
   StyleSheet,
   TouchableOpacity,
   ActivityIndicator,
+  RefreshControl,
+  Animated,
 } from 'react-native';
-import { SafeAreaView } from 'react-native-safe-area-context';
+import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
 import { useLocalSearchParams, useRouter } from 'expo-router';
 import { Image } from 'expo-image';
 import { Ionicons } from '@expo/vector-icons';
 import { getUploaderInfo, getUploaderVideos } from '../../services/bilibili';
 import type { VideoItem } from '../../services/types';
 import { useTheme } from '../../utils/theme';
-import { formatCount, formatDuration } from '../../utils/format';
+import { formatCount, formatDuration, formatTime } from '../../utils/format';
 import { proxyImageUrl, coverImageUrl } from '../../utils/imageUrl';
 import { useSettingsStore } from '../../store/settingsStore';
 
 const PAGE_SIZE = 20;
+const TOPBAR_HEIGHT = 44;
+const FADE_START = 80;
+const FADE_END = 160;
+
+const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<VideoItem>);
 
 export default function CreatorScreen() {
   const { mid: midStr } = useLocalSearchParams<{ mid: string }>();
   const mid = Number(midStr);
   const router = useRouter();
   const theme = useTheme();
+  const insets = useSafeAreaInsets();
   const trafficSaving = useSettingsStore(s => s.trafficSaving);
 
   const [info, setInfo] = useState<{
@@ -35,7 +43,15 @@ export default function CreatorScreen() {
   const [total, setTotal] = useState(0);
   const [loading, setLoading] = useState(false);
   const [infoLoading, setInfoLoading] = useState(true);
-  const loadingRef = React.useRef(false);
+  const [refreshing, setRefreshing] = useState(false);
+  const loadingRef = useRef(false);
+  const scrollY = useRef(new Animated.Value(0)).current;
+
+  const topBarOpacity = scrollY.interpolate({
+    inputRange: [FADE_START, FADE_END],
+    outputRange: [0, 1],
+    extrapolate: 'clamp',
+  });
 
   useEffect(() => {
     getUploaderInfo(mid)
@@ -61,62 +77,103 @@ export default function CreatorScreen() {
     }
   }, [mid]);
 
+  const handleRefresh = useCallback(async () => {
+    setRefreshing(true);
+    try {
+      const [infoData, { videos: newVideos, total: t }] = await Promise.all([
+        getUploaderInfo(mid),
+        getUploaderVideos(mid, 1, PAGE_SIZE),
+      ]);
+      setInfo(infoData);
+      setTotal(t);
+      setVideos(newVideos);
+      setPage(1);
+    } catch {}
+    finally {
+      setRefreshing(false);
+    }
+  }, [mid]);
+
   const hasMore = videos.length < total;
 
-  return (
-    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
-      {/* Top bar */}
-      <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
-        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
-          <Ionicons name="chevron-back" size={24} color={theme.text} />
-        </TouchableOpacity>
-        <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
-          {info?.name ?? 'UP主主页'}
-        </Text>
-        <View style={styles.backBtn} />
-      </View>
+  const HeroHeader = (
+    <View style={[styles.hero, { borderBottomColor: theme.border }]}>
+      {info ? (
+        <>
+          <Image
+            source={{ uri: proxyImageUrl(info.face) }}
+            style={styles.heroBg}
+            contentFit="cover"
+            blurRadius={20}
+          />
+          <View style={[styles.heroOverlay, { backgroundColor: theme.card }]} />
+        </>
+      ) : (
+        <View style={[styles.heroBg, { backgroundColor: theme.card }]} />
+      )}
+      {infoLoading ? (
+        <View style={[styles.profileContent, { paddingTop: TOPBAR_HEIGHT + 24 }]}>
+          <ActivityIndicator color="#00AEEC" />
+        </View>
+      ) : info ? (
+        <View style={[styles.profileContent, { paddingTop: TOPBAR_HEIGHT + 12 }]}>
+          <Image
+            source={{ uri: proxyImageUrl(info.face) }}
+            style={styles.avatar}
+            contentFit="cover"
+            recyclingKey={String(mid)}
+          />
+          <Text style={[styles.name, { color: theme.text }]}>{info.name}</Text>
+          {info.sign ? (
+            <Text style={[styles.sign, { color: theme.textSub }]} numberOfLines={2}>{info.sign}</Text>
+          ) : null}
+          <View style={styles.statsRow}>
+            <View style={styles.statItem}>
+              <Text style={[styles.statNum, { color: theme.text }]}>{formatCount(info.follower)}</Text>
+              <Text style={[styles.statLabel, { color: theme.textSub }]}>粉丝</Text>
+            </View>
+            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
+            <View style={s
```

**File**: `app/downloads.tsx` (modified, +2/-2)
```diff
@@ -5,11 +5,11 @@ import {
   SectionList,
   StyleSheet,
   TouchableOpacity,
-  Image,
   Modal,
   StatusBar,
   Alert,
 } from 'react-native';
+import { Image } from 'expo-image';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
 import { Ionicons } from '@expo/vector-icons';
@@ -171,7 +171,7 @@ function DownloadRow({
 
   const rowContent = (
     <View style={[styles.row, { backgroundColor: theme.card }]}>
-      <Image source={{ uri: proxyImageUrl(task.cover) }} style={styles.cover} />
+      <Image source={{ uri: proxyImageUrl(task.cover) }} style={styles.cover} contentFit="cover" recyclingKey={task.bvid} />
       <View style={styles.info}>
         <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{task.title}</Text>
         <Text style={[styles.qdesc, { color: theme.textSub }]}>
```

**File**: `app/search.tsx` (modified, +8/-1)
```diff
@@ -8,6 +8,7 @@ import {
   FlatList,
   ActivityIndicator,
   ScrollView,
+  Keyboard,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
@@ -43,12 +44,14 @@ export default function SearchScreen() {
     const term = (kw ?? keyword).trim();
     if (term) {
       if (kw) setKeyword(kw);
+      Keyboard.dismiss();
       search(kw ?? keyword, true);
     }
   }, [keyword, search, setKeyword]);
 
   const handleSuggestionPress = useCallback((value: string) => {
     setKeyword(value);
+    Keyboard.dismiss();
     search(value, true);
   }, [search, setKeyword]);
 
@@ -110,7 +113,11 @@ export default function SearchScreen() {
   }, [hasResults, sort, changeSort, theme.card]);
 
   const ListEmptyComponent = () => {
-    if (loading) return null;
+    if (loading) return (
+      <View style={styles.emptyBox}>
+        <ActivityIndicator color="#00AEEC" size="large" />
+      </View>
+    );
     if (!keyword.trim()) return null;
     return (
       <View style={styles.emptyBox}>
```

**File**: `app/video/[bvid].tsx` (modified, +133/-313)
```diff
@@ -5,9 +5,9 @@ import {
   FlatList,
   StyleSheet,
   TouchableOpacity,
-  Image,
   ActivityIndicator,
 } from "react-native";
+import { Image } from "expo-image";
 import { SafeAreaView } from "react-native-safe-area-context";
 import { useLocalSearchParams, useRouter } from "expo-router";
 import { Ionicons } from "@expo/vector-icons";
@@ -32,10 +32,10 @@ export default function VideoDetailScreen() {
   const router = useRouter();
   const theme = useTheme();
 
-  // 进入视频详情页时立即清除直播小窗
   useLayoutEffect(() => {
     useLiveStore.getState().clearLive();
   }, []);
+
   const {
     video,
     playData,
@@ -55,6 +55,8 @@ export default function VideoDetailScreen() {
   const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
   const [currentTime, setCurrentTime] = useState(0);
   const [showDownload, setShowDownload] = useState(false);
+  const [descExpanded, setDescExpanded] = useState(false);
+  const [descOverflows, setDescOverflows] = useState(false);
   const [uploaderStat, setUploaderStat] = useState<{
     follower: number;
     archiveCount: number;
@@ -65,9 +67,7 @@ export default function VideoDetailScreen() {
     load: loadRelated,
   } = useRelatedVideos(bvid as string);
 
-  useEffect(() => {
-    loadRelated();
-  }, []);
+  useEffect(() => { loadRelated(); }, []);
 
   useEffect(() => {
     if (video?.aid) loadComments();
@@ -80,9 +80,7 @@ export default function VideoDetailScreen() {
 
   useEffect(() => {
     if (!video?.owner?.mid) return;
-    getUploaderStat(video.owner.mid)
-      .then(setUploaderStat)
-      .catch(() => {});
+    getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
   }, [video?.owner?.mid]);
 
   return (
@@ -92,25 +90,14 @@ export default function VideoDetailScreen() {
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
           <Ionicons name="chevron-back" size={24} color={theme.text} />
         </TouchableOpacity>
-        <Text
-          style={[styles.topTitle, { color: theme.text }]}
-          numberOfLines={1}
-        >
+        <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
           {video?.title ?? "视频详情"}
         </Text>
-        <TouchableOpacity
-          style={styles.miniBtn}
-          onPress={() => setShowDownload(true)}
-        >
-          <Ionicons
-            name="cloud-download-outline"
-            size={22}
-            color={theme.text}
-          />
+        <TouchableOpacity style={styles.miniBtn} onPress={() => setShowDownload(true)}>
+          <Ionicons name="cloud-download-outline" size={22} color={theme.text} />
         </TouchableOpacity>
       </View>
 
-      {/* Video player — fixed 16:9 */}
       <VideoPlayer
         playData={playData}
         qualities={qualities}
@@ -134,53 +121,20 @@ export default function VideoDetailScreen() {
       {/* TabBar */}
       {video && (
         <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
-          <TouchableOpacity
-            style={styles.tabItem}
-            onPress={() => setTab("intro")}
-          >
-            <Text
-              style={[
-                styles.tabLabel,
-                { color: theme.textSub },
-                tab === "intro" && styles.tabActive,
-              ]}
-            >
-              简介
-            </Text>
-            {tab === "intro" && <View style={styles.tabUnderline} />}
-          </TouchableOpacity>
-          <TouchableOpacity
-            style={styles.tabItem}
-            onPress={() => setTab("comments")}
-          >
-            <Text
-              style={[
-                styles.tabLabel,
-                { color: theme.textSub },
-                tab === "comments" && styles.tabActive,
-              ]}
-            >
-              评论
-              {video.stat?.reply > 0 ? ` ${formatCount(video.stat.reply)}` : ""}
-            </Text>
-            {tab === "comments" && <View style={styles.tabUnderline} />}
-          </TouchableOpacity>
-          <TouchableOpacity
-            style={styles.tabItem}
-            onPress={() => setTab("danmaku")}
-          >
-            <Text
-              style={[
-                styles.tabLabel,
-                { color: theme.textSub },
-                tab === "danmaku" && styles.tabActive,
-              ]}
-            >
-              弹幕
-              {danmakus.length > 0 ? ` ${formatCount(danmakus.length)}` : ""}
-            </Text>
-            {tab === "danmaku" && <View style={styles.tabUnderline} />}
-          </TouchableOpacity>
+          {(["intro", "comments", "danmaku"] as Tab[]).map((t) => {
+            const label =
+              t === "intro" ? "简介"
+              : t === "comments" ? `评论${video.stat?.reply ? ` ${formatCount(video.stat.reply)}` : ""}`
+              : `弹幕${danmakus.length ? ` ${formatCount(danmakus.length)}` : ""}`;
+            return (
+              <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(
```

**File**: `components/FollowedLiveStrip.tsx` (modified, +3/-1)
```diff
@@ -4,9 +4,9 @@ import {
   Text,
   ScrollView,
   TouchableOpacity,
-  Image,
   StyleSheet,
 } from "react-native";
+import { Image } from "expo-image";
 import { useRouter } from "expo-router";
 import { useAuthStore } from "../store/authStore";
 import { getFollowedLiveRooms } from "../services/bilibili";
@@ -53,6 +53,8 @@ export function FollowedLiveStrip() {
             <Image
               source={{ uri: proxyImageUrl(room.face) }}
               style={[styles.avatar, { backgroundColor: theme.card }]}
+              contentFit="cover"
+              recyclingKey={String(room.roomid)}
             />
             <Text
               style={[styles.name, { color: theme.text }]}
```

**File**: `components/LiveCard.tsx` (modified, +20/-13)
```diff
@@ -2,11 +2,11 @@ import React from "react";
 import {
   View,
   Text,
-  Image,
   TouchableOpacity,
   StyleSheet,
   Dimensions,
 } from "react-native";
+import { Image } from "expo-image";
 import { Ionicons } from "@expo/vector-icons";
 import { LivePulse } from "./LivePulse";
 import type { LiveRoom } from "../services/types";
@@ -41,15 +41,14 @@ export const LiveCard = React.memo(function LiveCard({
       <View style={styles.thumbContainer}>
         <Image
           source={{ uri: proxyImageUrl(item.cover) }}
-          style={[
-            styles.thumb,
-            { width: cardWidth, height: cardWidth * 0.5625, backgroundColor: theme.card },
-          ]}
-          resizeMode="cover"
+          style={[styles.thumb, { width: cardWidth, height: cardWidth * 0.5625, backgroundColor: theme.card }]}
+          contentFit="cover"
+          recyclingKey={String(item.roomid)}
+          transition={200}
         />
         <View style={styles.liveBadge}>
           {isLivePulse && <LivePulse />}
-          <Text style={styles.liveBadgeText}>直播中</Text>
+          <Text style={styles.liveBadgeText}>直播</Text>
         </View>
         <View style={styles.meta}>
           <Ionicons name="people" size={11} color="#fff" />
@@ -67,8 +66,13 @@ export const LiveCard = React.memo(function LiveCard({
           <Image
             source={{ uri: proxyImageUrl(item.face) }}
             style={styles.avatar}
+            contentFit="cover"
+            recyclingKey={`face-${item.roomid}`}
           />
-          <Text style={[styles.owner, { color: theme.textSub }]} numberOfLines={1}>
+          <Text
+            style={[styles.owner, { color: theme.textSub }]}
+            numberOfLines={1}
+          >
             {item.uname}
           </Text>
         </View>
@@ -103,32 +107,35 @@ const styles = StyleSheet.create({
     alignItems: "center",
     gap: 2,
   },
-  liveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "400" },
+  liveBadgeText: { color: "#fff", fontSize: 9, fontWeight: "400" },
   meta: {
     position: "absolute",
     bottom: 4,
     left: 4,
-    paddingHorizontal: 4,
     borderRadius: 5,
+    paddingHorizontal: 5,
+    paddingVertical: 1,
     backgroundColor: "rgba(0,0,0,0.6)",
     flexDirection: "row",
     alignItems: "center",
     gap: 2,
   },
-  metaText: { fontSize: 10, color: "#fff" },
+  metaText: { fontSize: 9, color: "#fff" },
   areaBadge: {
     position: "absolute",
     bottom: 4,
     right: 4,
     borderRadius: 5,
-    paddingHorizontal: 4,
+    paddingHorizontal: 5,
+    paddingVertical: 1,
     backgroundColor: "rgba(0,0,0,0.6)",
   },
-  areaText: { color: "#fff", fontSize: 10 },
+  areaText: { color: "#fff", fontSize: 9 },
   info: { padding: 6 },
   title: {
     fontSize: 12,
     lineHeight: 17,
+    minHeight: 40,
     color: "#212121",
     marginBottom: 4,
   },
```

**File**: `components/LoginModal.tsx` (modified, +25/-4)
```diff
@@ -50,8 +50,7 @@ export function LoginModal({ visible, onClose }: Props) {
     }
   }, [visible]);
 
-  useEffect(() => {
-    if (!visible) return;
+  function initQRCode() {
     setStatus("loading");
     setQrData(null);
     setQrKey(null);
@@ -62,7 +61,11 @@ export function LoginModal({ visible, onClose }: Props) {
         setStatus("waiting");
       })
       .catch(() => setStatus("error"));
+  }
 
+  useEffect(() => {
+    if (!visible) return;
+    initQRCode();
     return () => {
       if (pollRef.current) clearInterval(pollRef.current);
     };
@@ -187,7 +190,13 @@ export function LoginModal({ visible, onClose }: Props) {
             </>
           )}
           {status === "error" && (
-            <Text style={[styles.hint, { color: theme.modalTextSub }]}>二维码已过期，请关闭重试</Text>
+            <View style={styles.errorBox}>
+              <Text style={[styles.hint, { color: theme.modalTextSub }]}>二维码已过期</Text>
+              <TouchableOpacity style={styles.retryBtn} onPress={initQRCode}>
+                <Ionicons name="refresh" size={14} color="#fff" />
+                <Text style={styles.retryTxt}>重新获取</Text>
+              </TouchableOpacity>
+            </View>
           )}
           <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
             <Text style={styles.closeTxt}>关闭</Text>
@@ -230,7 +239,19 @@ const styles = StyleSheet.create({
     alignItems: "center",
     justifyContent: "center",
   },
-  hint: { fontSize: 13, color: "#666", marginBottom: 20 },
+  hint: { fontSize: 13, color: "#666", marginBottom: 12 },
+  errorBox: { alignItems: "center", marginBottom: 8 },
+  retryBtn: {
+    flexDirection: "row",
+    alignItems: "center",
+    gap: 4,
+    backgroundColor: "#00AEEC",
+    paddingHorizontal: 16,
+    paddingVertical: 8,
+    borderRadius: 20,
+    marginBottom: 12,
+  },
+  retryTxt: { fontSize: 13, color: "#fff", fontWeight: "600" },
   closeBtn: { padding: 12 },
   closeTxt: { fontSize: 14, color: "#00AEEC" },
 });
```

**File**: `components/VideoCard.tsx` (modified, +19/-10)
```diff
@@ -22,8 +22,11 @@ interface Props {
   onPress: () => void;
 }
 
-export const VideoCard = React.memo(function VideoCard({ item, onPress }: Props) {
-  const trafficSaving = useSettingsStore(s => s.trafficSaving);
+export const VideoCard = React.memo(function VideoCard({
+  item,
+  onPress,
+}: Props) {
+  const trafficSaving = useSettingsStore((s) => s.trafficSaving);
   const theme = useTheme();
   return (
     <TouchableOpacity
@@ -33,7 +36,9 @@ export const VideoCard = React.memo(function VideoCard({ item, onPress }: Props)
     >
       <View style={styles.thumbContainer}>
         <Image
-          source={{ uri: coverImageUrl(item.pic, trafficSaving ? 'normal' : 'hd') }}
+          source={{
+            uri: coverImageUrl(item.pic, trafficSaving ? "normal" : "hd"),
+          }}
           style={[styles.thumb, { backgroundColor: theme.card }]}
           contentFit="cover"
           transition={200}
@@ -55,7 +60,10 @@ export const VideoCard = React.memo(function VideoCard({ item, onPress }: Props)
         <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
           {item.title}
         </Text>
-        <Text style={[styles.owner, { color: theme.textSub }]} numberOfLines={1}>
+        <Text
+          style={[styles.owner, { color: theme.textSub }]}
+          numberOfLines={1}
+        >
           {item.owner?.name ?? ""}
         </Text>
       </View>
@@ -82,15 +90,16 @@ const styles = StyleSheet.create({
     bottom: 4,
     right: 4,
     borderRadius: 5,
-    paddingHorizontal: 4,
+    paddingHorizontal: 5,
+    paddingVertical: 1,
     backgroundColor: "rgba(0,0,0,0.6)",
-    paddingVertical: 0,
   },
-  durationText: { color: "#fff", fontSize: 10 },
+  durationText: { color: "#fff", fontSize: 9 },
   info: { padding: 6 },
   title: {
     fontSize: 12,
     lineHeight: 17,
+    minHeight: 40,
     color: "#212121",
     marginBottom: 4,
   },
@@ -99,13 +108,13 @@ const styles = StyleSheet.create({
     position: "absolute",
     bottom: 4,
     left: 4,
-    paddingHorizontal: 4,
     borderRadius: 5,
+    paddingHorizontal: 5,
+    paddingVertical: 1,
     backgroundColor: "rgba(0,0,0,0.6)",
     flexDirection: "row",
     alignItems: "center",
-    paddingVertical: 0,
     gap: 2,
   },
-  metaText: { fontSize: 10, color: "#fff" },
+  metaText: { fontSize: 9, color: "#fff" },
 });
```

---

### Incident Patch 3: `e61177e9` (2026-03-25)
**Commit Message**: chore: trigger release build v1.0.15



---

### Incident Patch 4: `014b5d52` (2026-03-25)
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

### Incident Patch 5: `5bbc445b` (2026-03-25)
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

### Incident Patch 6: `1e0931b5` (2026-03-25)
**Commit Message**: fix: 登录后头像不更新 — 将 getUserInfo 合并进 login()

登录流程之前分两步：login() 只设 isLoggedIn，getUserInfo/setProfile
由 LoginModal 调用。网络抖动或 B站 session 传播延迟时 getUserInfo
抛错被静默吞掉，face 不更新，直到下次启动 restore() 才修复。

修复：login() 内部完成 getUserInfo + 持久化，LoginModal 只需
await login() 后关闭弹窗，不再重复获取头像。

**File**: `components/LoginModal.tsx` (modified, +3/-7)
```diff
@@ -14,7 +14,7 @@ import * as FileSystem from "expo-file-system/legacy";
 import * as MediaLibrary from "expo-media-library";
 import QRCode from "react-native-qrcode-svg";
 import { Ionicons } from "@expo/vector-icons";
-import { generateQRCode, pollQRCode, getUserInfo } from "../services/bilibili";
+import { generateQRCode, pollQRCode } from "../services/bilibili";
 import { useAuthStore } from "../store/authStore";
 import { useTheme } from "../utils/theme";
 
@@ -33,7 +33,6 @@ export function LoginModal({ visible, onClose }: Props) {
   >("loading");
   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
   const login = useAuthStore((s) => s.login);
-  const setProfile = useAuthStore((s) => s.setProfile);
   const theme = useTheme();
 
   // sheet 滑入动画
@@ -86,14 +85,11 @@ export function LoginModal({ visible, onClose }: Props) {
           clearInterval(pollRef.current!);
           try {
             await login(result.cookie, "", "");
-            if (cancelled) return;
-            setStatus("done");
-            const info = await getUserInfo();
-            if (!cancelled) setProfile(info.face, info.uname, String(info.mid));
           } catch {
             if (!cancelled) setStatus("error");
+            return;
           }
-          onClose();
+          if (!cancelled) onClose();
         }
       } catch {
         // Network error during poll — ignore, will retry next interval
```

**File**: `store/authStore.ts` (modified, +11/-5)
```diff
@@ -24,13 +24,19 @@ export const useAuthStore = create<AuthState>((set) => ({
 
   login: async (sessdata, uid, username) => {
     await setSecure('SESSDATA', sessdata);
-    await AsyncStorage.multiSet([
-      ['UID', uid],
-      ['USERNAME', username ?? ''],
-    ]);
     // Migrate: remove SESSDATA from AsyncStorage if it was there before
     await AsyncStorage.removeItem('SESSDATA').catch(() => {});
-    set({ sessdata, uid, username: username ?? null, isLoggedIn: true });
+    set({ sessdata, uid: uid || null, username: username || null, isLoggedIn: true });
+    // 登录后立即拉取用户信息，确保当前 session 头像可用（不依赖调用方 setProfile）
+    try {
+      const info = await getUserInfo();
+      await AsyncStorage.multiSet([
+        ['UID', String(info.mid)],
+        ['USERNAME', info.uname],
+        ['FACE', info.face],
+      ]);
+      set({ face: info.face, username: info.uname, uid: String(info.mid) });
+    } catch {}
   },
 
   logout: async () => {
```

---

### Incident Patch 7: `463c0db0` (2026-03-25)
**Commit Message**: feat: 性能优化 + Bug修复 + 搜索增强

- expo-image 替换 RN Image（VideoCard/LiveCard/BigVideoCard/CommentItem，recyclingKey）
- DanmakuList Animated.Value 对象池，减少 GC 压力
- FlatList 性能参数：windowSize=7 / maxToRenderPerBatch=6 / removeClippedSubviews
- bilibili.ts 请求去重（getVideoDetail/getPlayUrl）
- SESSDATA 迁移至 expo-secure-store（utils/secureStorage.ts，启动自动迁移）
- 主题系统扩展：新增 sheetBg/modalBg/modalText/placeholder/iconDefault/danger 等 token
- 多组件深色模式适配：DownloadSheet/LivePlayer/NativeVideoPlayer/DownloadProgressBtn/CommentItem/LoginModal
- 搜索页增强：搜索建议 + 热搜榜（hooks/useSearch.ts + app/search.tsx）
- LoginModal 修复轮询竞态（cancelled flag + try-catch）
- 修复 downloads.tsx 冗余三元表达式

**File**: `app.json` (modified, +3/-1)
```diff
@@ -41,7 +41,9 @@
       "expo-router",
       "react-native-video",
       "expo-screen-orientation",
-      "@sentry/react-native/expo"
+      "@sentry/react-native/expo",
+      "expo-secure-store",
+      "expo-image"
     ],
     "experiments": {
       "typedRoutes": true
```

**File**: `app/downloads.tsx` (modified, +2/-2)
```diff
@@ -202,12 +202,12 @@ function DownloadRow({
         )}
         <TouchableOpacity
           style={styles.actionBtn}
-          onPress={isDownloading ? onDelete : onDelete}
+          onPress={onDelete}
         >
           <Ionicons
             name={isDownloading ? 'close-circle-outline' : 'trash-outline'}
             size={20}
-            color={isDownloading ? '#bbb' : '#bbb'}
+            color="#bbb"
           />
         </TouchableOpacity>
       </View>
```

**File**: `app/index.tsx` (modified, +6/-0)
```diff
@@ -334,6 +334,9 @@ export default function HomeScreen() {
             }
             onScroll={onScroll}
             scrollEventThrottle={16}
+            windowSize={7}
+            maxToRenderPerBatch={6}
+            removeClippedSubviews={true}
           />
         </View>
 
@@ -402,6 +405,9 @@ export default function HomeScreen() {
             }
             onScroll={onLiveScroll}
             scrollEventThrottle={16}
+            windowSize={7}
+            maxToRenderPerBatch={6}
+            removeClippedSubviews={true}
           />
         </View>
       </PagerView>
```

**File**: `app/live/[roomId].tsx` (modified, +0/-1)
```diff
@@ -24,7 +24,6 @@ type Tab = "intro" | "danmaku";
 
 export default function LiveDetailScreen() {
   const { roomId } = useLocalSearchParams<{ roomId: string }>();
-  console.log("LiveDetailScreen params:", { roomId });
   const router = useRouter();
   const theme = useTheme();
   const id = parseInt(roomId ?? "0", 10);
```

**File**: `app/search.tsx` (modified, +237/-31)
```diff
@@ -7,26 +7,50 @@ import {
   TouchableOpacity,
   FlatList,
   ActivityIndicator,
+  ScrollView,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
 import { Ionicons } from '@expo/vector-icons';
 import { VideoCard } from '../components/VideoCard';
-import { useSearch } from '../hooks/useSearch';
+import { useSearch, SearchSort } from '../hooks/useSearch';
 import { useTheme } from '../utils/theme';
 import type { VideoItem } from '../services/types';
 
+const SORT_OPTIONS: { key: SearchSort; label: string }[] = [
+  { key: 'default', label: '综合排序' },
+  { key: 'pubdate', label: '最新发布' },
+  { key: 'view', label: '最多播放' },
+];
+
 export default function SearchScreen() {
   const router = useRouter();
-  const { keyword, setKeyword, results, loading, hasMore, search, loadMore } = useSearch();
+  const {
+    keyword, setKeyword,
+    results, loading, hasMore,
+    search, loadMore,
+    sort, changeSort,
+    history, removeFromHistory, clearHistory,
+    suggestions,
+    hotSearches,
+  } = useSearch();
   const theme = useTheme();
   const inputRef = useRef<TextInput>(null);
+  const hasResults = results.length > 0;
+  const hasSearched = hasResults || (loading && results.length === 0);
 
-  const handleSearch = useCallback(() => {
-    if (keyword.trim()) {
-      search(keyword, true);
+  const handleSearch = useCallback((kw?: string) => {
+    const term = (kw ?? keyword).trim();
+    if (term) {
+      if (kw) setKeyword(kw);
+      search(kw ?? keyword, true);
     }
-  }, [keyword, search]);
+  }, [keyword, search, setKeyword]);
+
+  const handleSuggestionPress = useCallback((value: string) => {
+    setKeyword(value);
+    search(value, true);
+  }, [search, setKeyword]);
 
   const renderItem = useCallback(
     ({ item, index }: { item: VideoItem; index: number }) => {
@@ -61,16 +85,37 @@ export default function SearchScreen() {
     [],
   );
 
+  // Show pre-search panel (history + hot searches + suggestions)
+  const showPreSearch = !hasSearched && !loading;
+  const showSuggestions = suggestions.length > 0 && keyword.trim().length > 0 && !hasResults;
+
+  const ListHeaderComponent = useCallback(() => {
+    if (!hasResults) return null;
+    return (
+      <View style={[styles.sortBar, { backgroundColor: theme.card }]}>
+        {SORT_OPTIONS.map(opt => (
+          <TouchableOpacity
+            key={opt.key}
+            style={[styles.sortBtn, sort === opt.key && styles.sortBtnActive]}
+            onPress={() => changeSort(opt.key)}
+            activeOpacity={0.85}
+          >
+            <Text style={[styles.sortBtnText, sort === opt.key && styles.sortBtnTextActive]}>
+              {opt.label}
+            </Text>
+          </TouchableOpacity>
+        ))}
+      </View>
+    );
+  }, [hasResults, sort, changeSort, theme.card]);
+
   const ListEmptyComponent = () => {
     if (loading) return null;
+    if (!keyword.trim()) return null;
     return (
       <View style={styles.emptyBox}>
         <Ionicons name="search-outline" size={48} color="#ddd" />
-        <Text style={[styles.emptyText, { color: theme.textSub }]}>
-          {results.length === 0 && keyword.trim()
-            ? '没有找到相关视频'
-            : '输入关键词搜索'}
-        </Text>
+        <Text style={[styles.emptyText, { color: theme.textSub }]}>没有找到相关视频</Text>
       </View>
     );
   };
@@ -90,7 +135,7 @@ export default function SearchScreen() {
             placeholderTextColor="#999"
             value={keyword}
             onChangeText={setKeyword}
-            onSubmitEditing={handleSearch}
+            onSubmitEditing={() => handleSearch()}
             returnKeyType="search"
             autoFocus
             autoCapitalize="none"
@@ -102,29 +147,109 @@ export default function SearchScreen() {
             </TouchableOpacity>
           )}
         </View>
-        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
+        <TouchableOpacity style={styles.searchBtn} onPress={() => handleSearch()} activeOpacity={0.85}>
           <Text style={styles.searchBtnText}>搜索</Text>
         </TouchableOpacity>
       </View>
 
-      {/* Results */}
-      <FlatList
-        data={results}
-        keyExtractor={keyExtractor}
-        renderItem={renderItem}
-        contentContainerStyle={styles.listContent}
-        onEndReached={loadMore}
-        onEndReachedThreshold={0.5}
-        ListEmptyComponent={<ListEmptyComponent />}
-        ListFooterComponent={
-          loading && results.length > 0 ? (
-            <View style={styles.footer}>
-              <ActivityIndicator color="#00AEEC" />
+      {/* Suggestions dropdown */}
+      {showSuggestions && (
+        <View style={[styles.suggestPanel, { backgroundColor: theme.card }]}>
+          {suggestions.map((s, i) => (
+            <TouchableOpacity
+              key={`${s.value}-${i}`}
+              style={[styles.suggestItem, { borderBottomColor: theme.border }
```

**File**: `app/video/[bvid].tsx` (modified, +11/-6)
```diff
@@ -75,7 +75,7 @@ export default function VideoDetailScreen() {
 
   useEffect(() => {
     if (!video?.cid) return;
-    getDanmaku(video.cid).then(setDanmakus);
+    getDanmaku(video.cid).then(setDanmakus).catch(() => {});
   }, [video?.cid]);
 
   useEffect(() => {
@@ -197,7 +197,11 @@ export default function VideoDetailScreen() {
               showsVerticalScrollIndicator={false}
               ListHeaderComponent={
                 <>
-                  <View style={styles.upRow}>
+                  <TouchableOpacity
+                    style={styles.upRow}
+                    activeOpacity={0.85}
+                    onPress={() => router.push(`/creator/${video.owner.mid}` as any)}
+                  >
                     <Image
                       source={{ uri: proxyImageUrl(video.owner.face) }}
                       style={styles.avatar}
@@ -213,10 +217,10 @@ export default function VideoDetailScreen() {
                         </Text>
                       )}
                     </View>
-                    <TouchableOpacity style={styles.followBtn}>
-                      <Text style={styles.followTxt}>+ 关注</Text>
-                    </TouchableOpacity>
-                  </View>
+                    <View style={styles.followBtn}>
+                      <Text style={styles.followTxt}>查看主页</Text>
+                    </View>
+                  </TouchableOpacity>
                   <View
                     style={[
                       styles.titleSection,
@@ -661,6 +665,7 @@ const styles = StyleSheet.create({
   sortRow: {
     flexDirection: "row",
     alignItems: "center",
+    justifyContent: "flex-end",
     paddingHorizontal: 14,
     paddingVertical: 10,
     gap: 8,
```

**File**: `components/BigVideoCard.tsx` (modified, +8/-3)
```diff
@@ -9,13 +9,13 @@ import React, {
 import {
   View,
   Text,
-  Image,
   TouchableOpacity,
   StyleSheet,
   useWindowDimensions,
   Animated,
   PanResponder,
 } from "react-native";
+import { Image } from "expo-image";
 import Video, { VideoRef } from "react-native-video";
 import { Ionicons } from "@expo/vector-icons";
 import { buildDashMpdUri } from "../utils/dash";
@@ -103,7 +103,11 @@ export const BigVideoCard = React.memo(function BigVideoCard({
           const detail = await getVideoDetail(item.bvid);
           cid = detail.cid ?? detail.pages?.[0]?.cid;
         }
-        if (!cid || cancelled) return;
+        if (!cid) {
+          console.warn('BigVideoCard: no cid available for', item.bvid);
+          return;
+        }
+        if (cancelled) return;
         const playData = await getPlayUrl(item.bvid, cid, 16);
         if (cancelled) return;
         if (playData.dash) {
@@ -263,7 +267,8 @@ export const BigVideoCard = React.memo(function BigVideoCard({
           <Image
             source={{ uri: coverImageUrl(item.pic, trafficSaving ? 'normal' : 'hd') }}
             style={mediaDimensions}
-            resizeMode="cover"
+            contentFit="cover"
+            recyclingKey={item.bvid}
           />
         </Animated.View>
 
```

**File**: `components/CommentItem.tsx` (modified, +5/-4)
```diff
@@ -1,5 +1,6 @@
 import React from 'react';
-import { View, Text, Image, StyleSheet } from 'react-native';
+import { View, Text, StyleSheet } from 'react-native';
+import { Image } from 'expo-image';
 import { Ionicons } from '@expo/vector-icons';
 import type { Comment } from '../services/types';
 import { formatTime } from '../utils/format';
@@ -17,10 +18,10 @@ export function CommentItem({ item }: Props) {
         <Text style={styles.username}>{item.member.uname}</Text>
         <Text style={[styles.message, { color: theme.text }]}>{item.content.message}</Text>
         <View style={styles.footer}>
-          <Text style={styles.time}>{formatTime(item.ctime)}</Text>
+          <Text style={[styles.time, { color: theme.textSub }]}>{formatTime(item.ctime)}</Text>
           <View style={styles.likeRow}>
-            <Ionicons name="thumbs-up-outline" size={12} color="#999" />
-            <Text style={styles.likeCount}>{item.like > 0 ? item.like : ''}</Text>
+            <Ionicons name="thumbs-up-outline" size={12} color={theme.textSub} />
+            <Text style={[styles.likeCount, { color: theme.textSub }]}>{item.like > 0 ? item.like : ''}</Text>
           </View>
         </View>
       </View>
```

---

### Incident Patch 8: `27587859` (2026-03-25)
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

---

### Incident Patch 9: `749dbb81` (2026-03-25)
**Commit Message**: fix: getUploaderVideos 加 WBI 签名，移除调试 log

**File**: `services/bilibili.ts` (modified, +3/-3)
```diff
@@ -193,9 +193,9 @@ export async function getUploaderInfo(mid: number): Promise<{ name: string; face
 }
 
 export async function getUploaderVideos(mid: number, pn = 1, ps = 20): Promise<{ videos: VideoItem[]; total: number }> {
-  const res = await api.get('/x/space/wbi/arc/search', {
-    params: { mid, pn, ps, order: 'pubdate', platform: 'web' },
-  });
+  const { imgKey, subKey } = await getWbiKeys();
+  const signed = signWbi({ mid, pn, ps, order: 'pubdate', platform: 'web' }, imgKey, subKey);
+  const res = await api.get('/x/space/wbi/arc/search', { params: signed });
   const vlist: any[] = res.data?.data?.list?.vlist ?? [];
   const total: number = res.data?.data?.page?.count ?? 0;
   const videos: VideoItem[] = vlist.map((v: any) => ({
```

---

### Incident Patch 10: `b4d5d2a0` (2026-03-25)
**Commit Message**: Merge branch 'master-bug'

# Conflicts:
#	CHANGELOG.md
#	app/video/[bvid].tsx
#	components/DanmakuList.tsx

**File**: `CHANGELOG.md` (modified, +18/-0)
```diff
@@ -5,6 +5,24 @@
 
 ---
 
+## [1.0.13] - 2026-03-25
+
+### 修复
+- **小窗 PanResponder 闭包过期**：`useRef(PanResponder.create(...))` 捕获初始 `roomId=0` / `bvid=""`，导致点击小窗跳转到错误页面；改用 `storeRef` 模式保持最新值
+- **直播小窗进入详情无限 loading**：`useLiveDetail` 使用 `cancelled` 闭包标志，effect cleanup 后 fetch 被静默丢弃；改用 `latestRoomId` ref 比对替代 cancelled 模式
+- **进入播放器页面小窗不关闭**：视频/直播详情页进入时通过 `useLayoutEffect` + `getState().clearLive()` 同步清除小窗，避免双播和资源竞争
+- **BigVideoCard 与直播小窗冲突**：首页 BigVideoCard 自动播放与直播小窗竞争解码器资源；小窗活跃时跳过 Video 渲染，仅显示封面图
+- **退出全屏视频暂停**：互斥渲染后竖屏播放器重新挂载，react-native-video seek 后不自动恢复播放；`onLoad` 中强制 `paused` 状态切换触发播放
+
+### 优化
+- **视频播放器单实例**：竖屏/全屏互斥渲染（`{!fullscreen && ...}` / `{fullscreen && ...}`），不再同时挂载两个 Video 解码器，减半 GPU/内存占用
+- **onProgress 节流**：`progressUpdateInterval` 从 250ms 调为 500ms，回调内增加 450ms 节流和 seeking 跳过，减少重渲染
+- **移除调试日志**：清理 NativeVideoPlayer 中遗留的 `console.log`
+- **下载页 UI 优化**：下载管理页交互和暗黑主题适配
+
+---
+
+
 ## [1.0.12] - 2026-03-25
 
 ### 新增
```

**File**: `app/_layout.tsx` (modified, +2/-0)
```diff
@@ -8,6 +8,7 @@ import { useDownloadStore } from '../store/downloadStore';
 import { useSettingsStore } from '../store/settingsStore';
 import { useTheme } from '../utils/theme';
 import { MiniPlayer } from '../components/MiniPlayer';
+import { LiveMiniPlayer } from '../components/LiveMiniPlayer';
 import * as Sentry from '@sentry/react-native';
 import { ErrorBoundary } from '@sentry/react-native';
 import { useFonts } from 'expo-font';
@@ -87,6 +88,7 @@ function RootLayout() {
           </Stack>
         </ErrorBoundary>
         <MiniPlayer />
+        <LiveMiniPlayer />
       </View>
     </SafeAreaProvider>
   );
```

**File**: `app/downloads.tsx` (modified, +98/-66)
```diff
@@ -6,10 +6,9 @@ import {
   StyleSheet,
   TouchableOpacity,
   Image,
-  ActivityIndicator,
   Modal,
   StatusBar,
-  useWindowDimensions,
+  Alert,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
@@ -19,15 +18,15 @@ let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
 try { ScreenOrientation = require('expo-screen-orientation'); } catch {}
 import { useDownloadStore, DownloadTask } from '../store/downloadStore';
 import { LanShareModal } from '../components/LanShareModal';
+import { proxyImageUrl } from '../utils/imageUrl';
+import { useTheme } from '../utils/theme';
 
 function formatFileSize(bytes?: number): string {
   if (!bytes || bytes <= 0) return '';
   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
   if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
   return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
 }
-import { proxyImageUrl } from '../utils/imageUrl';
-import { useTheme } from '../utils/theme';
 
 export default function DownloadsScreen() {
   const router = useRouter();
@@ -36,8 +35,6 @@ export default function DownloadsScreen() {
   const [playingUri, setPlayingUri] = useState<string | null>(null);
   const [playingTitle, setPlayingTitle] = useState('');
   const [shareTask, setShareTask] = useState<(DownloadTask & { key: string }) | null>(null);
-  const { width, height } = useWindowDimensions();
-  const isLandscape = width > height;
 
   async function openPlayer(uri: string, title: string) {
     setPlayingTitle(title);
@@ -50,6 +47,18 @@ export default function DownloadsScreen() {
     await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
   }
 
+  function confirmDelete(key: string, status: DownloadTask['status']) {
+    const isDownloading = status === 'downloading';
+    Alert.alert(
+      isDownloading ? '取消下载' : '删除下载',
+      isDownloading ? '确定取消该下载任务？' : '确定删除该文件？删除后不可恢复。',
+      [
+        { text: '取消', style: 'cancel' },
+        { text: isDownloading ? '取消下载' : '删除', style: 'destructive', onPress: () => removeTask(key) },
+      ],
+    );
+  }
+
   useEffect(() => {
     loadFromStorage();
   }, []);
@@ -74,29 +83,33 @@ export default function DownloadsScreen() {
 
       {sections.length === 0 ? (
         <View style={styles.empty}>
-          <Ionicons name="cloud-download-outline" size={56} color="#ccc" />
-          <Text style={styles.emptyTxt}>暂无下载记录</Text>
+          <Ionicons name="cloud-download-outline" size={56} color={theme.textSub} />
+          <Text style={[styles.emptyTxt, { color: theme.textSub }]}>暂无下载记录</Text>
         </View>
       ) : (
         <SectionList
           sections={sections}
           keyExtractor={(item) => item.key}
           renderSectionHeader={({ section }) => (
-            <View style={styles.sectionHeader}>
-              <Text style={styles.sectionTitle}>{section.title}</Text>
+            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
+              <Text style={[styles.sectionTitle, { color: theme.textSub }]}>{section.title}</Text>
             </View>
           )}
           renderItem={({ item }) => (
             <DownloadRow
               task={item}
+              theme={theme}
               onPlay={() => {
                 if (item.localUri) openPlayer(item.localUri, item.title);
               }}
-              onDelete={() => removeTask(item.key)}
+              onDelete={() => confirmDelete(item.key, item.status)}
               onShare={() => setShareTask(item)}
+              onRetry={() => router.push(`/video/${item.bvid}` as any)}
             />
           )}
-          ItemSeparatorComponent={() => <View style={styles.separator} />}
+          ItemSeparatorComponent={() => (
+            <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 108 }]} />
+          )}
           contentContainerStyle={{ paddingBottom: 32 }}
         />
       )}
@@ -119,22 +132,18 @@ export default function DownloadsScreen() {
           {playingUri && (
             <Video
               source={{ uri: playingUri }}
-              style={isLandscape
-                ? { width, height }
-                : { width, height: width * 0.5625 }}
+              style={StyleSheet.absoluteFillObject}
               resizeMode="contain"
               controls
               paused={false}
             />
           )}
-          {!isLandscape && (
-            <View style={styles.playerBar}>
-              <TouchableOpacity onPress={closePlayer} style={styles.closeBtn}>
-                <Ionicons name="chevron-back" size={24} color="#fff" />
-              </TouchableOpacity>
-              <Text style={styles.playerTitle} numberOfLines={1}>{playingTitle}</Text>
-            </View>
-          )}
+          <View style={styles.playerBar}>
+            <TouchableOpacity onPress={closePlayer} 
```

**File**: `app/index.tsx` (modified, +0/-3)
```diff
@@ -422,7 +422,6 @@ export default function HomeScreen() {
             styles.header,
             {
               opacity: currentHeaderOpacity,
-              borderBottomColor: theme.border,
             },
           ]}
         >
@@ -507,8 +506,6 @@ const styles = StyleSheet.create({
     alignItems: "center",
     paddingHorizontal: 16,
     gap: 10,
-    borderBottomWidth: StyleSheet.hairlineWidth,
-    borderBottomColor: "#eee",
   },
   logo: {
     fontSize: 20,
```

**File**: `app/live/[roomId].tsx` (modified, +25/-1)
```diff
@@ -1,4 +1,4 @@
-import React, { useState } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -18,14 +18,22 @@ import DanmakuList from "../../components/DanmakuList";
 import { formatCount } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { useTheme } from "../../utils/theme";
+import { useLiveStore } from "../../store/liveStore";
 
 type Tab = "intro" | "danmaku";
 
 export default function LiveDetailScreen() {
   const { roomId } = useLocalSearchParams<{ roomId: string }>();
+  console.log("LiveDetailScreen params:", { roomId });
   const router = useRouter();
   const theme = useTheme();
   const id = parseInt(roomId ?? "0", 10);
+
+  // 进入详情页时立即清除小窗（useLayoutEffect 在绘制前同步执行）
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
+
   const { room, anchor, stream, loading, error, changeQuality } =
     useLiveDetail(id);
   const [tab, setTab] = useState<Tab>("intro");
@@ -36,6 +44,8 @@ export default function LiveDetailScreen() {
   const qualities = stream?.qualities ?? [];
   const currentQn = stream?.qn ?? 0;
 
+  const setLive = useLiveStore(s => s.setLive);
+
   const actualRoomId = room?.roomid ?? id;
   const { danmakus, giftCounts } = useLiveDanmaku(isLive ? actualRoomId : 0);
 
@@ -49,6 +59,19 @@ export default function LiveDetailScreen() {
         <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
           {room?.title ?? "直播间"}
         </Text>
+        {isLive && hlsUrl ? (
+          <TouchableOpacity
+            style={styles.pipBtn}
+            onPress={() => {
+              setLive(id, room?.title ?? '', room?.keyframe ?? '', hlsUrl);
+              router.back();
+            }}
+          >
+            <Ionicons name="browsers-outline" size={22} color={theme.text} />
+          </TouchableOpacity>
+        ) : (
+          <View style={styles.pipBtn} />
+        )}
       </View>
 
       {/* Player */}
@@ -177,6 +200,7 @@ const styles = StyleSheet.create({
     borderBottomWidth: StyleSheet.hairlineWidth,
   },
   backBtn: { padding: 4 },
+  pipBtn: { padding: 4, width: 32, alignItems: 'center' },
   topTitle: {
     flex: 1,
     fontSize: 15,
```

**File**: `app/video/[bvid].tsx` (modified, +19/-7)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useRef } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -23,13 +23,19 @@ import { formatCount, formatDuration } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { DownloadSheet } from "../../components/DownloadSheet";
 import { useTheme } from "../../utils/theme";
+import { useLiveStore } from "../../store/liveStore";
 
 type Tab = "intro" | "comments" | "danmaku";
 
 export default function VideoDetailScreen() {
   const { bvid } = useLocalSearchParams<{ bvid: string }>();
   const router = useRouter();
   const theme = useTheme();
+
+  // 进入视频详情页时立即清除直播小窗
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
   const {
     video,
     playData,
@@ -49,7 +55,10 @@ export default function VideoDetailScreen() {
   const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
   const [currentTime, setCurrentTime] = useState(0);
   const [showDownload, setShowDownload] = useState(false);
-  const [uploaderStat, setUploaderStat] = useState<{ follower: number; archiveCount: number } | null>(null);
+  const [uploaderStat, setUploaderStat] = useState<{
+    follower: number;
+    archiveCount: number;
+  } | null>(null);
   const {
     videos: relatedVideos,
     loading: relatedLoading,
@@ -71,7 +80,9 @@ export default function VideoDetailScreen() {
 
   useEffect(() => {
     if (!video?.owner?.mid) return;
-    getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
+    getUploaderStat(video.owner.mid)
+      .then(setUploaderStat)
+      .catch(() => {});
   }, [video?.owner?.mid]);
 
   return (
@@ -197,7 +208,8 @@ export default function VideoDetailScreen() {
                       </Text>
                       {uploaderStat && (
                         <Text style={styles.upStat}>
-                          {formatCount(uploaderStat.follower)}粉丝 · {formatCount(uploaderStat.archiveCount)}视频
+                          {formatCount(uploaderStat.follower)}粉丝 ·{" "}
+                          {formatCount(uploaderStat.archiveCount)}视频
                         </Text>
                       )}
                     </View>
@@ -465,7 +477,7 @@ function SeasonSection({
             <TouchableOpacity
               style={[
                 styles.epCard,
-                { backgroundColor: theme.card },
+                { backgroundColor: theme.card, borderColor: theme.border },
                 isCurrent && styles.epCardActive,
               ]}
               onPress={() => !isCurrent && onEpisodePress(ep.bvid)}
@@ -564,10 +576,10 @@ const styles = StyleSheet.create({
     width: 120,
     borderRadius: 6,
     overflow: "hidden",
-    borderWidth: 1.5,
+    borderWidth: 1,
     borderColor: "transparent",
   },
-  epCardActive: { borderColor: "#00AEEC" },
+  epCardActive: { borderColor: "#00AEEC", borderWidth: 1.5 },
   epThumb: { width: 120, height: 68 },
   epNum: { fontSize: 11, color: "#999", paddingHorizontal: 6, paddingTop: 4 },
   epNumActive: { color: "#00AEEC", fontWeight: "600" },
```

**File**: `components/BigVideoCard.tsx` (modified, +7/-8)
```diff
@@ -23,6 +23,7 @@ import { getPlayUrl, getVideoDetail } from "../services/bilibili";
 import { coverImageUrl } from "../utils/imageUrl";
 import { useSettingsStore } from "../store/settingsStore";
 import { useTheme } from "../utils/theme";
+import { useLiveStore } from "../store/liveStore";
 import { formatCount, formatDuration } from "../utils/format";
 import type { VideoItem } from "../services/types";
 
@@ -57,6 +58,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
 }: Props) {
   const { width: SCREEN_W } = useWindowDimensions();
   const trafficSaving = useSettingsStore(s => s.trafficSaving);
+  const liveActive = useLiveStore(s => s.isActive);
   const theme = useTheme();
   const THUMB_H = SCREEN_W * 0.5625;
   const mediaDimensions = { width: SCREEN_W - 8, height: THUMB_H };
@@ -92,7 +94,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
 
   // Preload: fetch play URL on mount (before card is visible)
   useEffect(() => {
-    if (videoUrl || trafficSaving) return;
+    if (videoUrl || trafficSaving || liveActive) return;
     let cancelled = false;
     (async () => {
       try {
@@ -127,8 +129,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
   // Pause/resume based on visibility and scroll state
   useEffect(() => {
     if (!videoUrl) return;
-    if (!isVisible || trafficSaving) {
-      // Off-screen or traffic saving: pause, mute, show thumbnail
+    if (!isVisible || trafficSaving || liveActive) {
       setPaused(true);
       setMuted(true);
       Animated.timing(thumbOpacity, {
@@ -137,21 +138,19 @@ export const BigVideoCard = React.memo(function BigVideoCard({
         useNativeDriver: true,
       }).start();
     } else if (isScrolling) {
-      // Visible but scrolling: just pause (keep thumbnail hidden, keep mute state)
       setPaused(true);
     } else {
-      // Visible and not scrolling: play, fade out thumbnail
       setPaused(false);
       Animated.timing(thumbOpacity, {
         toValue: 0,
         duration: 300,
         useNativeDriver: true,
       }).start();
     }
-  }, [isVisible, isScrolling, videoUrl, trafficSaving]);
+  }, [isVisible, isScrolling, videoUrl, trafficSaving, liveActive]);
 
   const handleVideoReady = () => {
-    if (!isVisible || isScrolling || trafficSaving) return;
+    if (!isVisible || isScrolling || trafficSaving || liveActive) return;
     setPaused(false);
     Animated.timing(thumbOpacity, {
       toValue: 0,
@@ -229,7 +228,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
       {/* Media area */}
       <View style={[mediaDimensions, { position: "relative" }]}>
         {/* Video player — rendered first so it sits behind the thumbnail */}
-        {videoUrl && (
+        {videoUrl && !liveActive && (
           <Video
             ref={videoRef}
             source={
```

**File**: `components/DanmakuList.tsx` (modified, +5/-3)
```diff
@@ -242,7 +242,9 @@ export default function DanmakuList({
               <View style={liveStyles.medalTag}>
                 <Text style={liveStyles.medalName}>{item.medalName}</Text>
                 <View style={liveStyles.medalLvBox}>
-                  <Text style={liveStyles.medalLv}>{item.medalLevel}</Text>
+                  <Text style={[liveStyles.medalLv, { color: theme.text }]}>
+                    {item.medalLevel}
+                  </Text>
                 </View>
               </View>
             )}
@@ -275,7 +277,7 @@ export default function DanmakuList({
           ]}
         >
           <Text
-            style={[styles.bubbleText, { color: dotColor }]}
+            style={[styles.bubbleText, { color: theme.text }]}
             numberOfLines={3}
           >
             {item.text}
@@ -450,6 +452,7 @@ const liveStyles = StyleSheet.create({
   row: {
     flexDirection: "row",
     alignItems: "flex-start",
+    justifyContent: "space-between",
     paddingVertical: 5,
   },
   time: {
@@ -492,7 +495,6 @@ const liveStyles = StyleSheet.create({
     paddingHorizontal: 3,
   },
   medalLvBox: {
-    backgroundColor: "#e891ab",
     paddingHorizontal: 3,
     height: "100%",
     justifyContent: "center",
```

---

### Incident Patch 11: `e3def7d0` (2026-03-25)
**Commit Message**: fix: 修复小窗闭包过期、详情页 loading 卡死、视频播放器性能问题

- 小窗 PanResponder 用 storeRef 替代闭包捕获，修复 roomId/bvid 始终为初始值
- useLiveDetail 用 ref 比对替代 cancelled 标志，防止 fetch 被意外取消
- 详情页 useLayoutEffect 同步清除小窗，BigVideoCard 小窗活跃时跳过播放
- 视频播放器竖屏/全屏互斥渲染，减半解码器占用
- onProgress 节流 + 退出全屏强制恢复播放

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -5,6 +5,23 @@
 
 ---
 
+## [1.0.13] - 2026-03-25
+
+### 修复
+- **小窗 PanResponder 闭包过期**：`useRef(PanResponder.create(...))` 捕获初始 `roomId=0` / `bvid=""`，导致点击小窗跳转到错误页面；改用 `storeRef` 模式保持最新值
+- **直播小窗进入详情无限 loading**：`useLiveDetail` 使用 `cancelled` 闭包标志，effect cleanup 后 fetch 被静默丢弃；改用 `latestRoomId` ref 比对替代 cancelled 模式
+- **进入播放器页面小窗不关闭**：视频/直播详情页进入时通过 `useLayoutEffect` + `getState().clearLive()` 同步清除小窗，避免双播和资源竞争
+- **BigVideoCard 与直播小窗冲突**：首页 BigVideoCard 自动播放与直播小窗竞争解码器资源；小窗活跃时跳过 Video 渲染，仅显示封面图
+- **退出全屏视频暂停**：互斥渲染后竖屏播放器重新挂载，react-native-video seek 后不自动恢复播放；`onLoad` 中强制 `paused` 状态切换触发播放
+
+### 优化
+- **视频播放器单实例**：竖屏/全屏互斥渲染（`{!fullscreen && ...}` / `{fullscreen && ...}`），不再同时挂载两个 Video 解码器，减半 GPU/内存占用
+- **onProgress 节流**：`progressUpdateInterval` 从 250ms 调为 500ms，回调内增加 450ms 节流和 seeking 跳过，减少重渲染
+- **移除调试日志**：清理 NativeVideoPlayer 中遗留的 `console.log`
+- **下载页 UI 优化**：下载管理页交互和暗黑主题适配
+
+---
+
 ## [1.0.12] - 2026-03-25
 
 ### 新增
```

**File**: `app/downloads.tsx` (modified, +10/-21)
```diff
@@ -8,7 +8,6 @@ import {
   Image,
   Modal,
   StatusBar,
-  useWindowDimensions,
   Alert,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
@@ -36,14 +35,10 @@ export default function DownloadsScreen() {
   const [playingUri, setPlayingUri] = useState<string | null>(null);
   const [playingTitle, setPlayingTitle] = useState('');
   const [shareTask, setShareTask] = useState<(DownloadTask & { key: string }) | null>(null);
-  const [showControls, setShowControls] = useState(true);
-  const { width, height } = useWindowDimensions();
-  const isLandscape = width > height;
 
   async function openPlayer(uri: string, title: string) {
     setPlayingTitle(title);
     setPlayingUri(uri);
-    setShowControls(true);
     await ScreenOrientation?.unlockAsync();
   }
 
@@ -133,29 +128,23 @@ export default function DownloadsScreen() {
         onRequestClose={closePlayer}
       >
         <StatusBar hidden />
-        <TouchableOpacity
-          activeOpacity={1}
-          style={styles.playerBg}
-          onPress={() => setShowControls(v => !v)}
-        >
+        <View style={styles.playerBg}>
           {playingUri && (
             <Video
               source={{ uri: playingUri }}
-              style={isLandscape ? { width, height } : { width, height: width * 0.5625 }}
+              style={StyleSheet.absoluteFillObject}
               resizeMode="contain"
-              controls={false}
+              controls
               paused={false}
             />
           )}
-          {showControls && (
-            <View style={[styles.playerBar, isLandscape && { top: 16 }]}>
-              <TouchableOpacity onPress={closePlayer} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
-                <Ionicons name="chevron-back" size={24} color="#fff" />
-              </TouchableOpacity>
-              <Text style={styles.playerTitle} numberOfLines={1}>{playingTitle}</Text>
-            </View>
-          )}
-        </TouchableOpacity>
+          <View style={styles.playerBar}>
+            <TouchableOpacity onPress={closePlayer} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
+              <Ionicons name="chevron-back" size={24} color="#fff" />
+            </TouchableOpacity>
+            <Text style={styles.playerTitle} numberOfLines={1}>{playingTitle}</Text>
+          </View>
+        </View>
       </Modal>
     </SafeAreaView>
   );
```

**File**: `app/live/[roomId].tsx` (modified, +9/-10)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useEffect } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -24,9 +24,16 @@ type Tab = "intro" | "danmaku";
 
 export default function LiveDetailScreen() {
   const { roomId } = useLocalSearchParams<{ roomId: string }>();
+  console.log("LiveDetailScreen params:", { roomId });
   const router = useRouter();
   const theme = useTheme();
   const id = parseInt(roomId ?? "0", 10);
+
+  // 进入详情页时立即清除小窗（useLayoutEffect 在绘制前同步执行）
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
+
   const { room, anchor, stream, loading, error, changeQuality } =
     useLiveDetail(id);
   const [tab, setTab] = useState<Tab>("intro");
@@ -37,15 +44,7 @@ export default function LiveDetailScreen() {
   const qualities = stream?.qualities ?? [];
   const currentQn = stream?.qn ?? 0;
 
-  const { setLive, clearLive } = useLiveStore();
-
-  // 进入该直播间时，若小窗正在播放同一房间，清除小窗避免双播
-  // 仅在挂载时运行一次（用 getState 读值，不创建响应式依赖）
-  useEffect(() => {
-    if (useLiveStore.getState().roomId === id) {
-      clearLive();
-    }
-  }, []);
+  const setLive = useLiveStore(s => s.setLive);
 
   const actualRoomId = room?.roomid ?? id;
   const { danmakus, giftCounts } = useLiveDanmaku(isLive ? actualRoomId : 0);
```

**File**: `app/video/[bvid].tsx` (modified, +7/-1)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useRef } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -23,13 +23,19 @@ import { formatCount, formatDuration } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { DownloadSheet } from "../../components/DownloadSheet";
 import { useTheme } from "../../utils/theme";
+import { useLiveStore } from "../../store/liveStore";
 
 type Tab = "intro" | "comments" | "danmaku";
 
 export default function VideoDetailScreen() {
   const { bvid } = useLocalSearchParams<{ bvid: string }>();
   const router = useRouter();
   const theme = useTheme();
+
+  // 进入视频详情页时立即清除直播小窗
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
   const {
     video,
     playData,
```

**File**: `components/BigVideoCard.tsx` (modified, +7/-8)
```diff
@@ -23,6 +23,7 @@ import { getPlayUrl, getVideoDetail } from "../services/bilibili";
 import { coverImageUrl } from "../utils/imageUrl";
 import { useSettingsStore } from "../store/settingsStore";
 import { useTheme } from "../utils/theme";
+import { useLiveStore } from "../store/liveStore";
 import { formatCount, formatDuration } from "../utils/format";
 import type { VideoItem } from "../services/types";
 
@@ -57,6 +58,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
 }: Props) {
   const { width: SCREEN_W } = useWindowDimensions();
   const trafficSaving = useSettingsStore(s => s.trafficSaving);
+  const liveActive = useLiveStore(s => s.isActive);
   const theme = useTheme();
   const THUMB_H = SCREEN_W * 0.5625;
   const mediaDimensions = { width: SCREEN_W - 8, height: THUMB_H };
@@ -92,7 +94,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
 
   // Preload: fetch play URL on mount (before card is visible)
   useEffect(() => {
-    if (videoUrl || trafficSaving) return;
+    if (videoUrl || trafficSaving || liveActive) return;
     let cancelled = false;
     (async () => {
       try {
@@ -127,8 +129,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
   // Pause/resume based on visibility and scroll state
   useEffect(() => {
     if (!videoUrl) return;
-    if (!isVisible || trafficSaving) {
-      // Off-screen or traffic saving: pause, mute, show thumbnail
+    if (!isVisible || trafficSaving || liveActive) {
       setPaused(true);
       setMuted(true);
       Animated.timing(thumbOpacity, {
@@ -137,21 +138,19 @@ export const BigVideoCard = React.memo(function BigVideoCard({
         useNativeDriver: true,
       }).start();
     } else if (isScrolling) {
-      // Visible but scrolling: just pause (keep thumbnail hidden, keep mute state)
       setPaused(true);
     } else {
-      // Visible and not scrolling: play, fade out thumbnail
       setPaused(false);
       Animated.timing(thumbOpacity, {
         toValue: 0,
         duration: 300,
         useNativeDriver: true,
       }).start();
     }
-  }, [isVisible, isScrolling, videoUrl, trafficSaving]);
+  }, [isVisible, isScrolling, videoUrl, trafficSaving, liveActive]);
 
   const handleVideoReady = () => {
-    if (!isVisible || isScrolling || trafficSaving) return;
+    if (!isVisible || isScrolling || trafficSaving || liveActive) return;
     setPaused(false);
     Animated.timing(thumbOpacity, {
       toValue: 0,
@@ -229,7 +228,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
       {/* Media area */}
       <View style={[mediaDimensions, { position: "relative" }]}>
         {/* Video player — rendered first so it sits behind the thumbnail */}
-        {videoUrl && (
+        {videoUrl && !liveActive && (
           <Video
             ref={videoRef}
             source={
```

**File**: `components/DanmakuList.tsx` (modified, +5/-4)
```diff
@@ -222,7 +222,7 @@ export default function DanmakuList({
             { opacity: item._fadeAnim, borderBottomColor: theme.border },
           ]}
         >
-           {timeStr ? <Text style={liveStyles.time}>{timeStr}</Text> : null}
+          {timeStr ? <Text style={liveStyles.time}>{timeStr}</Text> : null}
           <View style={liveStyles.msgBody}>
             {guard && (
               <View
@@ -242,7 +242,9 @@ export default function DanmakuList({
               <View style={liveStyles.medalTag}>
                 <Text style={liveStyles.medalName}>{item.medalName}</Text>
                 <View style={liveStyles.medalLvBox}>
-                  <Text style={liveStyles.medalLv}>{item.medalLevel}</Text>
+                  <Text style={[liveStyles.medalLv, { color: theme.text }]}>
+                    {item.medalLevel}
+                  </Text>
                 </View>
               </View>
             )}
@@ -257,7 +259,6 @@ export default function DanmakuList({
               {item.text}
             </Text>
           </View>
-         
         </Animated.View>
       );
     },
@@ -451,7 +452,7 @@ const liveStyles = StyleSheet.create({
   row: {
     flexDirection: "row",
     alignItems: "flex-start",
-    justifyContent:"space-between",
+    justifyContent: "space-between",
     paddingVertical: 5,
   },
   time: {
```

**File**: `components/LiveMiniPlayer.tsx` (modified, +7/-2)
```diff
@@ -52,6 +52,10 @@ export function LiveMiniPlayer() {
   const pan = useRef(new Animated.ValueXY()).current;
   const isDragging = useRef(false);
 
+  // 用 ref 保持最新值，避免 PanResponder 闭包捕获过期的初始值
+  const storeRef = useRef({ roomId, clearLive, router });
+  storeRef.current = { roomId, clearLive, router };
+
   const panResponder = useRef(
     PanResponder.create({
       onStartShouldSetPanResponder: () => true,
@@ -71,10 +75,11 @@ export function LiveMiniPlayer() {
         pan.flattenOffset();
         if (!isDragging.current) {
           const { locationX, locationY } = evt.nativeEvent;
+          const { roomId: rid, clearLive: clear, router: r } = storeRef.current;
           if (locationX > MINI_W - 28 && locationY < 28) {
-            clearLive();
+            clear();
           } else {
-            router.push(`/live/${roomId}` as any);
+            r.push(`/live/${rid}` as any);
           }
           return;
         }
```

**File**: `components/MiniPlayer.tsx` (modified, +7/-5)
```diff
@@ -19,9 +19,12 @@ export function MiniPlayer() {
   const pan = useRef(new Animated.ValueXY()).current;
   const isDragging = useRef(false);
 
+  // 用 ref 保持最新值，避免 PanResponder 闭包捕获过期的初始值
+  const storeRef = useRef({ bvid, clearVideo, router });
+  storeRef.current = { bvid, clearVideo, router };
+
   const panResponder = useRef(
     PanResponder.create({
-      // 从 start 阶段即抢占响应权，确保拖动可靠触发
       onStartShouldSetPanResponder: () => true,
       onPanResponderGrant: () => {
         isDragging.current = false;
@@ -38,16 +41,15 @@ export function MiniPlayer() {
       onPanResponderRelease: (evt) => {
         pan.flattenOffset();
         if (!isDragging.current) {
-          // 点击：通过坐标判断是关闭还是跳转
           const { locationX, locationY } = evt.nativeEvent;
+          const { bvid: vid, clearVideo: clear, router: r } = storeRef.current;
           if (locationX > MINI_W - 28 && locationY < 28) {
-            clearVideo();
+            clear();
           } else {
-            router.push(`/video/${bvid}` as any);
+            r.push(`/video/${vid}` as any);
           }
           return;
         }
-        // 拖动：吸附到最近边缘
         const { width: sw, height: sh } = Dimensions.get('window');
         const curX = (pan.x as any)._value;
         const curY = (pan.y as any)._value;
```

---

### Incident Patch 12: `68b8b7d6` (2026-03-25)
**Commit Message**: fix: 彻底修复小窗无法拖动问题

根本原因：TouchableOpacity 内嵌在 PanResponder Animated.View 内，
  JS层 TouchableOpacity 与 Video 原生层共同阻断了 PanResponder 响应权。

修复方案：
- onStartShouldSetPanResponder: true，从 start 阶段独占响应权
- 移除主内容区的 TouchableOpacity，改用纯 View
- isDragging ref 区分点击与拖动：位移 >5px 为拖动
- onPanResponderRelease 通过 locationX/Y 坐标判断点击目标（关闭 or 跳转）
- Video 外层 View 加 pointerEvents='none' 防止原生层吞噬触摸

**File**: `components/LiveMiniPlayer.tsx` (modified, +72/-72)
```diff
@@ -4,7 +4,6 @@ import {
   Text,
   Image,
   StyleSheet,
-  TouchableOpacity,
   Animated,
   PanResponder,
   Dimensions,
@@ -26,84 +25,86 @@ const LIVE_HEADERS = {
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 };
 
+function snapRelease(
+  pan: Animated.ValueXY,
+  curX: number,
+  curY: number,
+  sw: number,
+  sh: number,
+) {
+  const snapRight = 0;
+  const snapLeft = -(sw - MINI_W - 24);
+  const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
+  const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
+  Animated.spring(pan, {
+    toValue: { x: snapX, y: clampedY },
+    useNativeDriver: false,
+    tension: 120,
+    friction: 10,
+  }).start();
+}
+
 export function LiveMiniPlayer() {
   const { isActive, roomId, title, cover, hlsUrl, clearLive } = useLiveStore();
   const videoMiniActive = useVideoStore(s => s.isActive);
   const router = useRouter();
   const insets = useSafeAreaInsets();
   const pan = useRef(new Animated.ValueXY()).current;
+  const isDragging = useRef(false);
 
   const panResponder = useRef(
     PanResponder.create({
-      // 不在 start 阶段抢夺，让 TouchableOpacity 的点击正常触发
-      onStartShouldSetPanResponder: () => false,
-      onStartShouldSetPanResponderCapture: () => false,
-      // 有实际位移时，从子组件夺回响应权（capture 阶段，优先于子组件）
-      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
-      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
+      onStartShouldSetPanResponder: () => true,
       onPanResponderGrant: () => {
+        isDragging.current = false;
         pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
         pan.setValue({ x: 0, y: 0 });
       },
-      onPanResponderMove: Animated.event(
-        [null, { dx: pan.x, dy: pan.y }],
-        { useNativeDriver: false },
-      ),
-      onPanResponderRelease: () => {
-        pan.flattenOffset();
-        const { width: sw, height: sh } = Dimensions.get('window');
-        const curX = (pan.x as any)._value;
-        const curY = (pan.y as any)._value;
-
-        // 吸附到左边缘或右边缘（取最近的一侧）
-        const snapRight = 0;
-        const snapLeft = -(sw - MINI_W - 24);
-        const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
-
-        const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
-
-        Animated.spring(pan, {
-          toValue: { x: snapX, y: clampedY },
-          useNativeDriver: false,
-          tension: 120,
-          friction: 10,
-        }).start();
+      onPanResponderMove: (_, gs) => {
+        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
+          isDragging.current = true;
+        }
+        pan.x.setValue(gs.dx);
+        pan.y.setValue(gs.dy);
       },
-      onPanResponderTerminate: () => {
+      onPanResponderRelease: (evt) => {
         pan.flattenOffset();
+        if (!isDragging.current) {
+          const { locationX, locationY } = evt.nativeEvent;
+          if (locationX > MINI_W - 28 && locationY < 28) {
+            clearLive();
+          } else {
+            router.push(`/live/${roomId}` as any);
+          }
+          return;
+        }
+        const { width: sw, height: sh } = Dimensions.get('window');
+        snapRelease(pan, (pan.x as any)._value, (pan.y as any)._value, sw, sh);
       },
+      onPanResponderTerminate: () => { pan.flattenOffset(); },
     }),
   ).current;
 
   if (!isActive) return null;
 
-  // 视频 MiniPlayer 激活时，直播小窗叠放其上方（避免重叠）
   const bottomOffset = insets.bottom + 16 + (videoMiniActive ? 106 : 0);
 
-  const handlePress = () => {
-    router.push(`/live/${roomId}` as any);
-  };
-
-  // Web 端降级：展示封面图 + LIVE 徽标
+  // Web 端降级：封面图 + LIVE 徽标
   if (Platform.OS === 'web') {
     return (
       <Animated.View
         style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
         {...panResponder.panHandlers}
       >
-        <TouchableOpacity style={styles.main} onPress={handlePress} activeOpacity={0.85}>
-          <Image source={{ uri: proxyImageUrl(cover) }} style={styles.videoArea} />
-          <View style={styles.liveBadge}>
-            <View style={styles.liveDot} />
-            <Text style={styles.liveText}>LIVE</Text>
-          </View>
-          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
-        </TouchableOpacity>
-        <TouchableOpacity style={styles.closeBtn} onPress={clearLive}>
+        <Image source={{ uri: proxyImageUrl(cover) }} style={styles.videoArea} />
+        <View style={styles.liveBadge} pointerEvents="none">
+          <View style={styles.liveDot} />
+          <Text style={styles.liveText}>LIVE</Text>
+        </View>
+        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
+        <View style={styles.closeBtn}>
           <Ionicons name="close" size={14} color="#fff" />
-        </TouchableOpacity>
+        </
```

**File**: `components/MiniPlayer.tsx` (modified, +32/-28)
```diff
@@ -1,6 +1,6 @@
 import React, { useRef } from 'react';
 import {
-  View, Text, Image, StyleSheet, TouchableOpacity,
+  View, Text, Image, StyleSheet,
   Animated, PanResponder, Dimensions,
 } from 'react-native';
 import { useRouter } from 'expo-router';
@@ -17,42 +17,52 @@ export function MiniPlayer() {
   const router = useRouter();
   const insets = useSafeAreaInsets();
   const pan = useRef(new Animated.ValueXY()).current;
+  const isDragging = useRef(false);
 
   const panResponder = useRef(
     PanResponder.create({
-      onStartShouldSetPanResponder: () => false,
-      onStartShouldSetPanResponderCapture: () => false,
-      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
-      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
+      // 从 start 阶段即抢占响应权，确保拖动可靠触发
+      onStartShouldSetPanResponder: () => true,
       onPanResponderGrant: () => {
+        isDragging.current = false;
         pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
         pan.setValue({ x: 0, y: 0 });
       },
-      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
-      onPanResponderRelease: () => {
+      onPanResponderMove: (_, gs) => {
+        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
+          isDragging.current = true;
+        }
+        pan.x.setValue(gs.dx);
+        pan.y.setValue(gs.dy);
+      },
+      onPanResponderRelease: (evt) => {
         pan.flattenOffset();
+        if (!isDragging.current) {
+          // 点击：通过坐标判断是关闭还是跳转
+          const { locationX, locationY } = evt.nativeEvent;
+          if (locationX > MINI_W - 28 && locationY < 28) {
+            clearVideo();
+          } else {
+            router.push(`/video/${bvid}` as any);
+          }
+          return;
+        }
+        // 拖动：吸附到最近边缘
         const { width: sw, height: sh } = Dimensions.get('window');
         const curX = (pan.x as any)._value;
         const curY = (pan.y as any)._value;
-
         const snapRight = 0;
         const snapLeft = -(sw - MINI_W - 24);
         const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
-
         const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
-
         Animated.spring(pan, {
           toValue: { x: snapX, y: clampedY },
           useNativeDriver: false,
           tension: 120,
           friction: 10,
         }).start();
       },
-      onPanResponderTerminate: () => {
-        pan.flattenOffset();
-      },
+      onPanResponderTerminate: () => { pan.flattenOffset(); },
     })
   ).current;
 
@@ -65,17 +75,12 @@ export function MiniPlayer() {
       style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
       {...panResponder.panHandlers}
     >
-      <TouchableOpacity
-        style={styles.main}
-        onPress={() => router.push(`/video/${bvid}` as any)}
-        activeOpacity={0.85}
-      >
-        <Image source={{ uri: proxyImageUrl(cover) }} style={styles.cover} />
-        <Text style={styles.title} numberOfLines={1}>{title}</Text>
-      </TouchableOpacity>
-      <TouchableOpacity style={styles.closeBtn} onPress={clearVideo}>
+      <Image source={{ uri: proxyImageUrl(cover) }} style={styles.cover} />
+      <Text style={styles.title} numberOfLines={1}>{title}</Text>
+      {/* 关闭按钮仅作视觉展示，点击逻辑由 onPanResponderRelease 坐标判断处理 */}
+      <View style={styles.closeBtn}>
         <Ionicons name="close" size={14} color="#fff" />
-      </TouchableOpacity>
+      </View>
     </Animated.View>
   );
 }
@@ -84,8 +89,8 @@ const styles = StyleSheet.create({
   container: {
     position: 'absolute',
     right: 12,
-    width: 160,
-    height: 90,
+    width: MINI_W,
+    height: MINI_H,
     borderRadius: 8,
     backgroundColor: '#1a1a1a',
     overflow: 'hidden',
@@ -95,7 +100,6 @@ const styles = StyleSheet.create({
     shadowOpacity: 0.3,
     shadowRadius: 4,
   },
-  main: { flex: 1 },
   cover: { width: '100%', height: 64, backgroundColor: '#333' },
   title: {
     color: '#fff',
```

---

### Incident Patch 13: `2bfc9f81` (2026-03-25)
**Commit Message**: fix: 修复小窗无法拖动的问题

onStartShouldSetPanResponder 被内部 TouchableOpacity 抢占响应权。
改用 onMoveShouldSetPanResponderCapture：位移 >3px 时从子组件夺回响应权，
点击仍正常透传到 TouchableOpacity。

**File**: `components/LiveMiniPlayer.tsx` (modified, +11/-3)
```diff
@@ -35,7 +35,14 @@ export function LiveMiniPlayer() {
 
   const panResponder = useRef(
     PanResponder.create({
-      onStartShouldSetPanResponder: () => true,
+      // 不在 start 阶段抢夺，让 TouchableOpacity 的点击正常触发
+      onStartShouldSetPanResponder: () => false,
+      onStartShouldSetPanResponderCapture: () => false,
+      // 有实际位移时，从子组件夺回响应权（capture 阶段，优先于子组件）
+      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
+        Math.abs(dx) > 3 || Math.abs(dy) > 3,
+      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
+        Math.abs(dx) > 3 || Math.abs(dy) > 3,
       onPanResponderGrant: () => {
         pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
         pan.setValue({ x: 0, y: 0 });
@@ -51,12 +58,10 @@ export function LiveMiniPlayer() {
         const curY = (pan.y as any)._value;
 
         // 吸附到左边缘或右边缘（取最近的一侧）
-        // container 默认 right:12，pan.x=0 为右侧，-(sw-MINI_W-24) 为左侧贴边
         const snapRight = 0;
         const snapLeft = -(sw - MINI_W - 24);
         const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
 
-        // Y 轴仅做越界回弹，不吸附
         const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
 
         Animated.spring(pan, {
@@ -66,6 +71,9 @@ export function LiveMiniPlayer() {
           friction: 10,
         }).start();
       },
+      onPanResponderTerminate: () => {
+        pan.flattenOffset();
+      },
     }),
   ).current;
 
```

**File**: `components/MiniPlayer.tsx` (modified, +9/-2)
```diff
@@ -20,7 +20,12 @@ export function MiniPlayer() {
 
   const panResponder = useRef(
     PanResponder.create({
-      onStartShouldSetPanResponder: () => true,
+      onStartShouldSetPanResponder: () => false,
+      onStartShouldSetPanResponderCapture: () => false,
+      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
+        Math.abs(dx) > 3 || Math.abs(dy) > 3,
+      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
+        Math.abs(dx) > 3 || Math.abs(dy) > 3,
       onPanResponderGrant: () => {
         pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
         pan.setValue({ x: 0, y: 0 });
@@ -32,7 +37,6 @@ export function MiniPlayer() {
         const curX = (pan.x as any)._value;
         const curY = (pan.y as any)._value;
 
-        // 吸附到左边缘或右边缘（取最近的一侧）
         const snapRight = 0;
         const snapLeft = -(sw - MINI_W - 24);
         const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
@@ -46,6 +50,9 @@ export function MiniPlayer() {
           friction: 10,
         }).start();
       },
+      onPanResponderTerminate: () => {
+        pan.flattenOffset();
+      },
     })
   ).current;
 
```

---

### Incident Patch 14: `2afe5839` (2026-03-25)
**Commit Message**: fix: 修复直播小窗按钮点击后小窗不显示的问题

useEffect 依赖 miniRoomId 导致 setLive 触发 clearLive 立即清除状态。
改为仅挂载时运行，用 getState() 读取当前值而非订阅响应式变化。

**File**: `app/live/[roomId].tsx` (modified, +4/-3)
```diff
@@ -37,14 +37,15 @@ export default function LiveDetailScreen() {
   const qualities = stream?.qualities ?? [];
   const currentQn = stream?.qn ?? 0;
 
-  const { roomId: miniRoomId, setLive, clearLive } = useLiveStore();
+  const { setLive, clearLive } = useLiveStore();
 
   // 进入该直播间时，若小窗正在播放同一房间，清除小窗避免双播
+  // 仅在挂载时运行一次（用 getState 读值，不创建响应式依赖）
   useEffect(() => {
-    if (miniRoomId === id) {
+    if (useLiveStore.getState().roomId === id) {
       clearLive();
     }
-  }, [id, miniRoomId]);
+  }, []);
 
   const actualRoomId = room?.roomid ?? id;
   const { danmakus, giftCounts } = useLiveDanmaku(isLive ? actualRoomId : 0);
```

---

### Incident Patch 15: `c7fbc1f4` (2026-03-25)
**Commit Message**: feat: 优化下载页UI交互、支持暗黑主题，移除首页 header 底边框

- downloads.tsx: 删除前弹 Alert 确认框（区分"取消下载"和"删除文件"）
- downloads.tsx: 下载出错时显示"重新下载"按钮，跳转视频详情页
- downloads.tsx: 下载中取消按钮改为 close-circle-outline 图标
- downloads.tsx: 已完成条目整行可点击播放，移除单独"播放"按钮
- downloads.tsx: 播放器横竖屏均显示顶部控制栏，点击切换显隐
- downloads.tsx: 移除进度条旁 ActivityIndicator，保留百分比文字
- downloads.tsx: 全部颜色跟随暗黑主题（bg/card/text/textSub/border）
- index.tsx: 移除悬浮 header 底部分割线

**File**: `app/downloads.tsx` (modified, +104/-61)
```diff
@@ -6,10 +6,10 @@ import {
   StyleSheet,
   TouchableOpacity,
   Image,
-  ActivityIndicator,
   Modal,
   StatusBar,
   useWindowDimensions,
+  Alert,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
@@ -19,15 +19,15 @@ let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
 try { ScreenOrientation = require('expo-screen-orientation'); } catch {}
 import { useDownloadStore, DownloadTask } from '../store/downloadStore';
 import { LanShareModal } from '../components/LanShareModal';
+import { proxyImageUrl } from '../utils/imageUrl';
+import { useTheme } from '../utils/theme';
 
 function formatFileSize(bytes?: number): string {
   if (!bytes || bytes <= 0) return '';
   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
   if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
   return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
 }
-import { proxyImageUrl } from '../utils/imageUrl';
-import { useTheme } from '../utils/theme';
 
 export default function DownloadsScreen() {
   const router = useRouter();
@@ -36,12 +36,14 @@ export default function DownloadsScreen() {
   const [playingUri, setPlayingUri] = useState<string | null>(null);
   const [playingTitle, setPlayingTitle] = useState('');
   const [shareTask, setShareTask] = useState<(DownloadTask & { key: string }) | null>(null);
+  const [showControls, setShowControls] = useState(true);
   const { width, height } = useWindowDimensions();
   const isLandscape = width > height;
 
   async function openPlayer(uri: string, title: string) {
     setPlayingTitle(title);
     setPlayingUri(uri);
+    setShowControls(true);
     await ScreenOrientation?.unlockAsync();
   }
 
@@ -50,6 +52,18 @@ export default function DownloadsScreen() {
     await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
   }
 
+  function confirmDelete(key: string, status: DownloadTask['status']) {
+    const isDownloading = status === 'downloading';
+    Alert.alert(
+      isDownloading ? '取消下载' : '删除下载',
+      isDownloading ? '确定取消该下载任务？' : '确定删除该文件？删除后不可恢复。',
+      [
+        { text: '取消', style: 'cancel' },
+        { text: isDownloading ? '取消下载' : '删除', style: 'destructive', onPress: () => removeTask(key) },
+      ],
+    );
+  }
+
   useEffect(() => {
     loadFromStorage();
   }, []);
@@ -74,29 +88,33 @@ export default function DownloadsScreen() {
 
       {sections.length === 0 ? (
         <View style={styles.empty}>
-          <Ionicons name="cloud-download-outline" size={56} color="#ccc" />
-          <Text style={styles.emptyTxt}>暂无下载记录</Text>
+          <Ionicons name="cloud-download-outline" size={56} color={theme.textSub} />
+          <Text style={[styles.emptyTxt, { color: theme.textSub }]}>暂无下载记录</Text>
         </View>
       ) : (
         <SectionList
           sections={sections}
           keyExtractor={(item) => item.key}
           renderSectionHeader={({ section }) => (
-            <View style={styles.sectionHeader}>
-              <Text style={styles.sectionTitle}>{section.title}</Text>
+            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
+              <Text style={[styles.sectionTitle, { color: theme.textSub }]}>{section.title}</Text>
             </View>
           )}
           renderItem={({ item }) => (
             <DownloadRow
               task={item}
+              theme={theme}
               onPlay={() => {
                 if (item.localUri) openPlayer(item.localUri, item.title);
               }}
-              onDelete={() => removeTask(item.key)}
+              onDelete={() => confirmDelete(item.key, item.status)}
               onShare={() => setShareTask(item)}
+              onRetry={() => router.push(`/video/${item.bvid}` as any)}
             />
           )}
-          ItemSeparatorComponent={() => <View style={styles.separator} />}
+          ItemSeparatorComponent={() => (
+            <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 108 }]} />
+          )}
           contentContainerStyle={{ paddingBottom: 32 }}
         />
       )}
@@ -115,126 +133,144 @@ export default function DownloadsScreen() {
         onRequestClose={closePlayer}
       >
         <StatusBar hidden />
-        <View style={styles.playerBg}>
+        <TouchableOpacity
+          activeOpacity={1}
+          style={styles.playerBg}
+          onPress={() => setShowControls(v => !v)}
+        >
           {playingUri && (
             <Video
               source={{ uri: playingUri }}
-              style={isLandscape
-                ? { width, height }
-                : { width, height: width * 0.5625 }}
+              style={isLandscape ? { width, height } : { width, height: width * 0.5625 }}
               resizeMode="contain"
-              controls
+              controls={false}
               paused={false}
  
```

**File**: `app/index.tsx` (modified, +0/-3)
```diff
@@ -422,7 +422,6 @@ export default function HomeScreen() {
             styles.header,
             {
               opacity: currentHeaderOpacity,
-              borderBottomColor: theme.border,
             },
           ]}
         >
@@ -507,8 +506,6 @@ const styles = StyleSheet.create({
     alignItems: "center",
     paddingHorizontal: 16,
     gap: 10,
-    borderBottomWidth: StyleSheet.hairlineWidth,
-    borderBottomColor: "#eee",
   },
   logo: {
     fontSize: 20,
```

**File**: `app/video/[bvid].tsx` (modified, +12/-6)
```diff
@@ -49,7 +49,10 @@ export default function VideoDetailScreen() {
   const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
   const [currentTime, setCurrentTime] = useState(0);
   const [showDownload, setShowDownload] = useState(false);
-  const [uploaderStat, setUploaderStat] = useState<{ follower: number; archiveCount: number } | null>(null);
+  const [uploaderStat, setUploaderStat] = useState<{
+    follower: number;
+    archiveCount: number;
+  } | null>(null);
   const {
     videos: relatedVideos,
     loading: relatedLoading,
@@ -71,7 +74,9 @@ export default function VideoDetailScreen() {
 
   useEffect(() => {
     if (!video?.owner?.mid) return;
-    getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
+    getUploaderStat(video.owner.mid)
+      .then(setUploaderStat)
+      .catch(() => {});
   }, [video?.owner?.mid]);
 
   return (
@@ -197,7 +202,8 @@ export default function VideoDetailScreen() {
                       </Text>
                       {uploaderStat && (
                         <Text style={styles.upStat}>
-                          {formatCount(uploaderStat.follower)}粉丝 · {formatCount(uploaderStat.archiveCount)}视频
+                          {formatCount(uploaderStat.follower)}粉丝 ·{" "}
+                          {formatCount(uploaderStat.archiveCount)}视频
                         </Text>
                       )}
                     </View>
@@ -465,7 +471,7 @@ function SeasonSection({
             <TouchableOpacity
               style={[
                 styles.epCard,
-                { backgroundColor: theme.card },
+                { backgroundColor: theme.card, borderColor: theme.border },
                 isCurrent && styles.epCardActive,
               ]}
               onPress={() => !isCurrent && onEpisodePress(ep.bvid)}
@@ -564,10 +570,10 @@ const styles = StyleSheet.create({
     width: 120,
     borderRadius: 6,
     overflow: "hidden",
-    borderWidth: 1.5,
+    borderWidth: 1,
     borderColor: "transparent",
   },
-  epCardActive: { borderColor: "#00AEEC" },
+  epCardActive: { borderColor: "#00AEEC", borderWidth: 1.5 },
   epThumb: { width: 120, height: 68 },
   epNum: { fontSize: 11, color: "#999", paddingHorizontal: 6, paddingTop: 4 },
   epNumActive: { color: "#00AEEC", fontWeight: "600" },
```

**File**: `components/DanmakuList.tsx` (modified, +3/-2)
```diff
@@ -222,7 +222,6 @@ export default function DanmakuList({
             { opacity: item._fadeAnim, borderBottomColor: theme.border },
           ]}
         >
-          {timeStr ? <Text style={liveStyles.time}>{timeStr}</Text> : null}
           <View style={liveStyles.msgBody}>
             {guard && (
               <View
@@ -257,6 +256,7 @@ export default function DanmakuList({
               {item.text}
             </Text>
           </View>
+          {timeStr ? <Text style={liveStyles.time}>{timeStr}</Text> : null}
         </Animated.View>
       );
     },
@@ -275,7 +275,7 @@ export default function DanmakuList({
           ]}
         >
           <Text
-            style={[styles.bubbleText, { color: dotColor }]}
+            style={[styles.bubbleText, { color: theme.text }]}
             numberOfLines={3}
           >
             {item.text}
@@ -450,6 +450,7 @@ const liveStyles = StyleSheet.create({
   row: {
     flexDirection: "row",
     alignItems: "flex-start",
+    justifyContent:"space-between",
     paddingVertical: 5,
   },
   time: {
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
