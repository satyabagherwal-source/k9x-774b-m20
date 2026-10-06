# Forensic Learning Record (Deep Inspection): lobehub/lobe-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/lobehub-lobe-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lobehub/lobe-ui](https://github.com/lobehub/lobe-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:42:52.115Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lobehub/lobe-ui`
- **Description**: 🍭  Lobe UI - an open-source UI component library for building AIGC web apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2216 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/ActionIcon/components/utils.ts`
```
import { isNumber } from 'es-toolkit/compat';

import type { ActionIconSize } from '@/ActionIcon';

export const calcSize = (iconSize?: ActionIconSize) => {
  let blockSize: number | string;
  let borderRadius: number | string;

  if (isNumber(iconSize)) {
    const blockSize = iconSize * 1.8;
    return {
      blockSize,
      borderRadius: Math.floor(blockSize / 6),
    };
  }

  switch (iconSize) {
    case 'large': {
      blockSize = 44;
      borderRadius = 8;
      break;
    }
    case 'middle': {
      blockSize = 36;
      borderRadius = 6;
      break;
    }
    case 'small': {
      blockSize = 24;
      borderRadius = 4;
      break;
    }
    default: {
      if (iconSize) {
        blockSize = iconSize?.blockSize || 36;
        borderRadius = iconSize?.borderRadius || 6;
      } else {
        blockSize = '1.8em';
        borderRadius = '0.3em';
      }

      break;
    }
  }

  return {
    blockSize,
    borderRadius,
  };
};

```

### Core Architecture Module: `src/Avatar/utils.ts`
```
import { isValidElement, type ReactNode } from 'react';

/**
 * 判断 avatar 是否是默认的 Ant Design Avatar 类型
 * (URL 路径或 React 元素)
 */
export const isDefaultAntAvatar = (avatar: ReactNode): boolean => {
  if (!avatar) return false;

  const isStringAvatar = typeof avatar === 'string';
  const isUrlOrDataUri =
    isStringAvatar && ['/', 'http', 'data:'].some((prefix) => avatar.startsWith(prefix));

  return Boolean(isUrlOrDataUri || isValidElement(avatar));
};

/**
 * 判断是否有有效的背景色
 */
export const hasValidBackground = (background?: string | null): boolean => {
  return Boolean(
    background &&
    background !== 'transparent' &&
    background !== 'rgba(0,0,0,0)' &&
    background !== null,
  );
};

/**
 * 格式化头像文本（转大写并可选切片）
 */
export const formatAvatarText = (text: string | undefined, sliceText: boolean): string => {
  if (!text) return '';

  const upperText = text.toUpperCase();
  return sliceText ? upperText.slice(0, 2) : upperText;
};

/**
 * 计算 emoji 大小
 */
export const calculateEmojiSize = (
  size: number,
  hasBackground: boolean,
  emojiScaleWithBackground: boolean,
): number => {
  if (emojiScaleWithBackground) {
    return hasBackground ? size * 0.85 : size;
  }
  return size * 0.85;
};

```

### Core Architecture Module: `src/CodeDiff/demos/ActionsRender.tsx`
```
import { RotateCcwIcon } from 'lucide-react';

import ActionIcon from '@/base-ui/ActionIcon';

import { CodeDiff } from '../CodeDiff';

const oldCode = `export const BASE_URL = 'https://api.example.com/v1';

export const getProfileUrl = (id: string) => \`\${BASE_URL}/users/\${id}\`;`;

const newCode = `export const BASE_URL = 'https://api.example.com/v2';

export const getProfileUrl = (id: string) => \`\${BASE_URL}/profiles/\${id}\`;`;

export default () => {
  return (
    <CodeDiff
      fullFeatured
      fileName="api.ts"
      language="typescript"
      newContent={newCode}
      oldContent={oldCode}
      actionsRender={({ newContent, oldContent, originalNode }) => (
        <>
          {originalNode}
          <ActionIcon
            icon={RotateCcwIcon}
            size="small"
            onClick={() => alert(`old: ${oldContent.length}, new: ${newContent.length}`)}
          />
        </>
      )}
    />
  );
};

```

### Core Architecture Module: `src/DraggablePanel/utils.ts`
```
import type { Size } from 're-resizable';

import type { DraggablePanelProps } from './type';

interface IsBelowCollapseThresholdOptions {
  axis: 'height' | 'width';
  collapseThreshold?: number;
  size: Size;
}

export const isBelowCollapseThreshold = ({
  axis,
  collapseThreshold,
  size,
}: IsBelowCollapseThresholdOptions): boolean => {
  if (collapseThreshold === undefined) return false;

  const currentSize = size[axis];
  if (currentSize === undefined) return false;

  const numericSize =
    typeof currentSize === 'number' ? currentSize : Number.parseFloat(currentSize);

  return Number.isFinite(numericSize) && numericSize <= Math.max(collapseThreshold, 0);
};

export const reversePlacement = (placement: DraggablePanelProps['placement']) => {
  switch (placement) {
    case 'bottom': {
      return 'top';
    }
    case 'top': {
      return 'bottom';
    }
    case 'right': {
      return 'left';
    }
    case 'left': {
      return 'right';
    }
  }
};

```

### Core Architecture Module: `src/EditorSlashMenu/MenuItemRenderer.tsx`
```
import type { AutocompleteRootChangeEventDetails } from '@base-ui/react/autocomplete';
import { memo } from 'react';

import {
  EditorSlashMenuItem,
  EditorSlashMenuItemContent,
  EditorSlashMenuItemExtra,
  EditorSlashMenuItemIcon,
  EditorSlashMenuItemLabel,
} from './atoms';
import type { EditorSlashMenuOption } from './type';

interface MenuItemRendererProps {
  hasAnyIcon: boolean;
  item: EditorSlashMenuOption;
  onSelect: (item: EditorSlashMenuOption, details: AutocompleteRootChangeEventDetails) => void;
  renderItem?: (item: EditorSlashMenuOption) => React.ReactNode;
  reserveIconSpace: boolean;
}

const DefaultItemContent = memo<{
  hasAnyIcon: boolean;
  item: EditorSlashMenuOption;
  reserveIconSpace: boolean;
}>(({ item, hasAnyIcon, reserveIconSpace }) => (
  <EditorSlashMenuItemContent>
    <EditorSlashMenuItemIcon aria-hidden={!hasAnyIcon && !reserveIconSpace}>
      {item.icon ?? (reserveIconSpace && hasAnyIcon ? <span /> : null)}
    </EditorSlashMenuItemIcon>
    <EditorSlashMenuItemLabel>{item.label}</EditorSlashMenuItemLabel>
    {item.extra ? <EditorSlashMenuItemExtra>{item.extra}</EditorSlashMenuItemExtra> : null}
  </EditorSlashMenuItemContent>
));

DefaultItemContent.displayName = 'DefaultItemContent';

export const MenuItemRenderer = memo<MenuItemRendererProps>(
  ({ hasAnyIcon, item, onSelect, renderItem, reserveIconSpace }) => {
    const content = renderItem?.(item) ?? (
      <DefaultItemContent hasAnyIcon={hasAnyIcon} item={item} reserveIconSpace={reserveIconSpace} />
    );

    return (
      <EditorSlashMenuItem
        danger={item.danger}
        disabled={item.disabled}
        key={item.value}
        value={item as any}
        onClick={(e) => {
          if (item.disabled) {
            e.preventDefault();
            return;
          }
          onSelect(item, { event: e as any, reason: 'item-press' } as any);
        }}
      >
        {content}
      </EditorSlashMenuItem>
    );
  },
);

MenuItemRenderer.displayName = 'MenuItemRenderer';

```

### Core Architecture Module: `src/EditorSlashMenu/utils.ts`
```
import type { EditorSlashMenuGroup, EditorSlashMenuOption } from './type';

export const isGroup = (
  entry: EditorSlashMenuOption | EditorSlashMenuGroup,
): entry is EditorSlashMenuGroup =>
  Boolean(
    (entry as EditorSlashMenuGroup).items && Array.isArray((entry as EditorSlashMenuGroup).items),
  );

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    return (
      !(target as HTMLInputElement | HTMLTextAreaElement).readOnly &&
      !(target as HTMLInputElement | HTMLTextAreaElement).disabled
    );
  }
  return target.getAttribute('role') === 'textbox';
};

```

### Core Architecture Module: `src/Flex/utils.ts`
```
import type { FlexDirection } from './type';

export const getPrefix = (prefixCls?: string) => {
  if (prefixCls) return prefixCls;
  return 'lobe';
};

export const getFlexDirection = (direction?: FlexDirection, isHorizontal?: boolean) => {
  if (isHorizontal) return 'row';

  switch (direction) {
    case 'horizontal': {
      return 'row';
    }
    case 'horizontal-reverse': {
      return 'row-reverse';
    }
    case 'vertical':
    default: {
      return 'column';
    }
    case 'vertical-reverse': {
      return 'column-reverse';
    }
  }
};

export const isSpaceDistribution = (distribution?: string) => {
  if (!distribution) return;
  return ['space-between', 'space-around', 'space-evenly'].includes(distribution);
};

export const isHorizontal = (direction?: FlexDirection, isHorizontal?: boolean) =>
  getFlexDirection(direction, isHorizontal) === 'row';

export const isVertical = (direction?: FlexDirection, isHorizontal?: boolean) =>
  getFlexDirection(direction, isHorizontal) === 'column';

export const getCssValue = (value: string | number | undefined) =>
  typeof value === 'number' ? `${value}px` : value;

```

### Core Architecture Module: `src/FluentEmoji/utils.ts`
```
export type EmojiType = 'anim' | 'flat' | 'modern' | 'mono' | 'raw' | '3d';

export function isFlagEmoji(emoji: string) {
  const flagRegex = /(?:\uD83C[\uDDE6-\uDDFF]){2}/;
  return flagRegex.test(emoji);
}

export function emojiToUnicode(emoji: string) {
  return [...emoji].map((char) => char?.codePointAt(0)?.toString(16)).join('-');
}

export function emojiAnimPkg(emoji: string) {
  const mainPart = emojiToUnicode(emoji).split('-')[0];
  if (mainPart < '1f469') {
    return '@lobehub/fluent-emoji-anim-1';
  } else if (mainPart >= '1f469' && mainPart < '1f620') {
    return '@lobehub/fluent-emoji-anim-2';
  } else if (mainPart >= '1f620' && mainPart < '1f9a0') {
    return '@lobehub/fluent-emoji-anim-3';
  } else {
    return '@lobehub/fluent-emoji-anim-4';
  }
}

export const genEmojiUrl = (emoji: string, type: EmojiType) => {
  const ext = ['anim', '3d'].includes(type) ? 'webp' : 'svg';

  switch (type) {
    case 'raw': {
      return null;
    }
    case 'anim': {
      return {
        path: `assets/${emojiToUnicode(emoji)}.${ext}`,
        pkg: emojiAnimPkg(emoji),
        version: 'latest',
      };
    }
    case '3d': {
      return {
        path: `assets/${emojiToUnicode(emoji)}.${ext}`,
        pkg: '@lobehub/fluent-emoji-3d',
        version: 'latest',
      };
    }
    case 'flat': {
      return {
        path: `assets/${emojiToUnicode(emoji)}.${ext}`,
        pkg: '@lobehub/fluent-emoji-flat',
        version: 'latest',
      };
    }
    case 'modern': {
      return {
        path: `assets/${emojiToUnicode(emoji)}.${ext}`,
        pkg: '@lobehub/fluent-emoji-modern',
        version: 'latest',
      };
    }
    case 'mono': {
      return {
        path: `assets/${emojiToUnicode(emoji)}.${ext}`,
        pkg: '@lobehub/fluent-emoji-mono',
        version: 'latest',
      };
    }
  }
};

```

### Core Architecture Module: `src/Form/demos/StateControl.tsx`
```
import { Form, type FormProps } from '@lobehub/ui';
import { StoryBook, useControls, useCreateStore } from '@lobehub/ui/storybook';
import { InputNumber, Segmented, Select, Switch } from 'antd';
import { Palette, PanelLeftClose } from 'lucide-react';
import { useState } from 'react';

const setting = {
  i18n: 'en',
  liteAnimation: false,
  sidebarExpand: true,
  sidebarFixedMode: 'float',
  sidebarWidth: 300,
};

enum ActiveKey {
  Sidebar = 'sidebar',
  Theme = 'theme',
}

export default () => {
  const [active, setActive] = useState<ActiveKey[]>([ActiveKey.Theme, ActiveKey.Sidebar]);

  const store = useCreateStore();

  const { variant }: any = useControls(
    {
      variant: {
        options: ['borderless', 'filled', 'outlined'],
        value: 'borderless',
      },
    },
    { store },
  );

  const items: FormProps['items'] = [
    {
      children: [
        {
          children: (
            <Select
              options={[
                {
                  label: 'English',
                  value: 'en',
                },
                {
                  label: '简体中文',
                  value: 'zh_CN',
                },
              ]}
            />
          ),
          desc: 'Editor language',
          label: 'Language',
          name: 'i18n',
        },
        {
          children: <Switch />,
          desc: 'Reduce the blur effect and background flow color, which can improve smoothness and save CPU usage',
          label: 'Reduce Animation',
          minWidth: undefined,
          name: 'liteAnimation',
          valuePropName: 'checked',
        },
      ],
      extra: (
        <Switch
          value={active.includes(ActiveKey.Theme)}
          onChange={(v) => {
            setActive((prev) =>
              v ? [...prev, ActiveKey.Theme] : prev.filter((key) => key !== ActiveKey.Theme),
            );
          }}
        />
      ),
      icon: Palette,
      key: ActiveKey.Theme,
      title: 'Theme Settings',
    },
    {
      children: [
        {
          children: <Switch />,
          desc: 'Whether to expand the sidebar by default when starting',
          label: 'Default Expand',
          minWidth: undefined,
          name: 'sidebarExpand',
          valuePropName: 'checked',
        },
        {
          children: (
            <Segmented
              options={[
                {
                  label: 'Fixed',
                  value: 'fixed',
                },
                {
                  label: 'Float',
                  value: 'float',
                },
              ]}
            />
          ),
          desc: 'Fixed as grid mode for constant display, auto-expand when the mouse moves to the side in floating mode',
          label: 'Display Mode',
          minWidth: undefined,
          name: 'sidebarFixedMode',
        },
        {
          children: <InputNumber />,
          desc: 'Default width of the sidebar when starting',
          label: 'Default Width',
          minWidth: undefined,
          name: 'sidebarWidth',
        },
      ],
      extra: (
        <Switch
          value={active.includes(ActiveKey.Sidebar)}
          onChange={(v) => {
            setActive((prev) =>
              v ? [...prev, ActiveKey.Sidebar] : prev.filter((key) => key !== ActiveKey.Sidebar),
            );
          }}
        />
      ),
      icon: PanelLeftClose,
      key: ActiveKey.Sidebar,
      title: 'Quick Setting Sidebar',
    },
  ];

  return (
    <StoryBook levaStore={store}>
      <Form
        activeKey={active}
        initialValues={setting}
        itemMinWidth={'max(30%,240px)'}
        items={items}
        variant={variant}
        onCollapse={console.info}
        onFinish={console.table}
      />
    </StoryBook>
  );
};

```

### Core Architecture Module: `src/Highlighter/SyntaxHighlighter/StaticRenderer.tsx`
```
'use client';

import { type CSSProperties, memo } from 'react';
import type { BuiltinTheme } from 'shiki';

import { useHighlight } from '@/hooks/useHighlight';

interface StaticRendererProps {
  children: string;
  className?: string;
  enableTransformer?: boolean;
  fallbackClassName?: string;
  language: string;
  style?: CSSProperties;
  theme?: BuiltinTheme;
}

// Escape HTML for fallback to prevent XSS
const escapeHtml = (str: string) =>
  str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

/**
 * Static renderer for syntax highlighting without animation
 * Uses useHighlight hook to generate HTML and renders it directly
 */
const StaticRenderer = memo<StaticRendererProps>(
  ({ children, className, enableTransformer, fallbackClassName, language, style, theme }) => {
    // Safely handle empty or invalid children
    const safeChildren = children ?? '';

    const data = useHighlight(safeChildren, {
      enableTransformer,
      language,
      theme,
    });

    const hasData = typeof data === 'string' && data.length > 0;
    const containerClassName = hasData ? className : fallbackClassName;

    return (
      <div
        className={containerClassName}
        dir="ltr"
        style={style}
        dangerouslySetInnerHTML={{
          __html: data || `<pre><code>${escapeHtml(safeChildren)}</code></pre>`,
        }}
      />
    );
  },
);

StaticRenderer.displayName = 'StaticRenderer';

export default StaticRenderer;

```

### Core Architecture Module: `src/Highlighter/SyntaxHighlighter/StreamRenderer.tsx`
```
'use client';

import { getTokenStyleObject } from '@shikijs/core';
import { cx } from 'antd-style';
import type { CSSProperties } from 'react';
import { memo, useRef } from 'react';
import type { BuiltinTheme, ThemedToken } from 'shiki';

import { useStreamHighlight } from '@/hooks/useStreamHighlight';

import {
  createTokenFadeStore,
  markTokenBirths,
  resolveTokenFadeStyle,
  type TokenFadeStore,
} from './tokenFade';

interface StreamRendererProps {
  children: string;
  className?: string;
  enableTransformer?: boolean;
  fallbackClassName?: string;
  language: string;
  style?: CSSProperties;
  theme?: BuiltinTheme;
}

const normalizeStyleKeys = (style: Record<string, string | number>): CSSProperties => {
  const normalized: CSSProperties = {};
  Object.entries(style).forEach(([key, value]) => {
    const normalizedKey = key.replaceAll(/-([a-z])/g, (_, char) => char.toUpperCase());
    (normalized as Record<string, string | number>)[normalizedKey] = value;
  });
  return normalized;
};

const getTokenInlineStyle = (token: ThemedToken): CSSProperties => {
  const rawStyle = token.htmlStyle || getTokenStyleObject(token);
  const baseStyle = normalizeStyleKeys(rawStyle);
  return { ...baseStyle, whiteSpace: 'pre' };
};

const TokenSpan = memo(
  ({ fadeStyle, token }: { fadeStyle?: CSSProperties | null; token: ThemedToken }) => {
    const style = fadeStyle
      ? { ...getTokenInlineStyle(token), ...fadeStyle }
      : getTokenInlineStyle(token);
    return (
      <span className={fadeStyle ? 'stream-char' : undefined} style={style}>
        {token.content}
      </span>
    );
  },
  (prev, next) => prev.token === next.token && prev.fadeStyle === next.fadeStyle,
);

const TokenLine = memo(
  ({
    fade,
    line,
    now,
    start,
  }: {
    fade: TokenFadeStore;
    line: ThemedToken[];
    now: number;
    start: number;
  }) => {
    if (!line.length) {
      return (
        <span className="line">
          <span style={{ whiteSpace: 'pre' }}>{'\u00A0'}</span>
        </span>
      );
    }

    let offset = start;
    return (
      <span className="line">
        {line.map((token) => {
          const tokenOffset = offset;
          offset += token.content.length;
          return (
            <TokenSpan
              fadeStyle={resolveTokenFadeStyle(fade, tokenOffset, now)}
              key={tokenOffset}
              token={token}
            />
          );
        })}
      </span>
    );
  },
  (prev, next) => prev.line === next.line && prev.start === next.start,
);

const StreamRenderer = memo<StreamRendererProps>(
  ({ children, className, enableTransformer, fallbackClassName, language, style, theme }) => {
    // Safely handle empty or invalid children
    const safeChildren = children ?? '';

    const streaming = useStreamHighlight(safeChildren, {
      enableTransformer,
      language,
      streaming: true,
      theme,
    });

    const lines = streaming?.lines;
    const preStyle = streaming?.preStyle;

    const fadeRef = useRef<TokenFadeStore>(createTokenFadeStore());
    const previousTextRef = useRef('');
    if (!safeChildren.startsWith(previousTextRef.current)) {
      fadeRef.current = createTokenFadeStore();
    }
    previousTextRef.current = safeChildren;
    const now = performance.now();
    const lineStarts = lines ? markTokenBirths(fadeRef.current, lines, now) : [];

    if (!lines || lines.length === 0) {
      return (
        <div className={fallbackClassName} dir="ltr" style={style}>
          <pre>
            <code>{safeChildren}</code>
          </pre>
        </div>
      );
    }

    return (
      <div className={className} dir="ltr" style={style}>
        <pre className={cx('shiki', theme)} style={preStyle} tabIndex={0}>
          <code style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'pre' }}>
            {lines.map((line, index) => (
              <TokenLine
                fade={fadeRef.current}
                key={`line-${index}`}
                line={line}
                now={now}
                start={lineStarts[index]}
              />
            ))}
          </code>
        </pre>
      </div>
    );
  },
);

StreamRenderer.displayName = 'StreamRenderer';

export default StreamRenderer;

```

### Core Architecture Module: `src/Highlighter/demos/ActionsRender.tsx`
```
import { ActionIcon, Highlighter } from '@lobehub/ui';
import { AlertCircleIcon } from 'lucide-react';

import { code } from './data';

export default () => {
  return (
    <Highlighter
      fullFeatured
      language={'tsx'}
      actionsRender={({ content, actionIconSize, language, originalNode }) => {
        return (
          <>
            {originalNode}
            <ActionIcon
              icon={AlertCircleIcon}
              size={actionIconSize}
              onClick={() => alert(language + content)}
            />
          </>
        );
      }}
    >
      {code}
    </Highlighter>
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #694** (2026-10-05): **✨ feat(form): built-in table layout for Form.List; polish InputNumber steppers**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [x] ✨ feat - [ ] 🐛 fix - [ ] ♻️ refactor - [x] 💄 style - [ ] 🔨 chore - [ ] 📝 docs  #### 🔀 变更说明 | Description of Change  Stacked on #688. The design was picked on a canvas beforehand: NumberInput option A, Form.List option B.  **InputNumber** - The 22px chevron column and its divider are gone. The up/down buttons sit inside the field (20×13 at middle size) and get a rounded fill on hover. - Button and icon sizes follow `size`: small 16×10, large 22×15. - At the min or max, only the matching button dims.  **Form.List `columns`** ```tsx <Form.List   name="env"   columns={[     { name: 'key', title: 'Key', children: <Input />, required: true },     { name: 'value', title: 'Value', children: <Input />, flex: 1.4 },   ]}   newItem={{ key: '', value: '' }}   addText="Add variable"   emptyText="No variables yet" /> ``` - Renders uppercase column headers. Each cell is a bare `Form.Field` bound to `<item>.<column.name>`. - A cell shows no border until it is hovered, focused or invalid. - Each row has an ✕ remove button, followed by an add row and an empty state. - Cell inputs are labelled `<title> <n>`; the remove button is labelled from i18n. - `newItem` objects are cloned on every add, and functions are called. - A render-prop `children` keeps working and takes priority over `columns`. - New i18n strings (`form.list.add`, `form.list.empty`, `form.list.remove`) in en and zhCn. - The docs demo now uses `columns`, and the API table documents the new pr
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Ihf282OAtnQMJtpUZQFY7pGQOUD/f3HYiady43wSNaY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvQ1FhUExyRVQ2aFNVTk02eEp4aXkyV21qeHl1aCIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiQ0FOQ0VMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOm51bGx9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9Njk0In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/lobe-hub-oss/lobe-ui"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_CMzeRV0DHIBsp4QxT20IygxL5VfA&teamId=team_G3v8QKfofcdVz
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-05T10:39:48.261896Z">2026-10-05T10:39:48.261896Z</relative-time> | `28fa9fe` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/021e5c5f-fdd4-413e-8812-83fbc3bc2482)     ```   npm i https://pkg.pr.new/@lobehub/ui@694   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/111724970500"><code>db983b0</code></a>_ 

- **Issue #692** (2026-10-05): **💄 style(docs): polish base-ui demos**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [ ] ✨ feat - [x] 🐛 fix - [ ] ♻️ refactor - [x] 💄 style - [ ] 🔨 chore - [ ] 📝 docs  #### 🔀 变更说明 | Description of Change  Stacked on #688. All 171 demos on the 50 base-ui doc pages were screenshotted and measured (content inset from the playground frame), then fixed:  **Flush demos.** 29 demos used `layout="bare"` (frame padding 0) without wrapping themselves in a StoryBook or adding their own padding, so content touched the frame edge. They now use the padded default layout: Form ×4, Switch ×4, Select ×6, Drawer ×3, Tabs ×2, Table ×2, Popover group/placement, Collapsible, Segmented atoms, Avatar group, Accordion inline, Tooltip group-children-preserve, FloatingPanel ×2.  **Dead CSS variables.** `var(--lobe-color-*)` is not defined anywhere, so ~30 demos (Popover, Select, ScrollArea, DropdownMenu) silently lost their colors and backgrounds. Replaced with `antd-style` `cssVar` tokens. The same dead var colored the `Switch` loading icon in production, fixed in its own commit.  **Crashing demos.** - Modal index/business: in docs dev, `code-inspector-plugin` mistakes the inline `React.FC` footer helpers for components and injects an undefined `__codeInspectorProps`. Inlining them in the object literal avoids it (own commit). - ContextMenu overflow mounted a second `ContextMenuHost` on the page and hit the dev singleton guard. It now reuses the page's host, like the other 9 demos.  **Other polish.** - Tooltip group/shared/remove-trigger and Toast d
  **Post-Mortem & Fix Analysis**:
  > [vc]: #7CCq1f+AIanMStZ6Vi9JTFKZ/BaCdTXDKJRKsg3XmVk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9DRFZRQnZNSEN6dmY4TnZweW9jaUw1d0VjNzhvIiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWRvY3MtYmFzZS11aS1kZW1vLXBvbGlzaC1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1kb2NzLWJhc2UtdWktZGVtby1wb2xpc2gtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6bnVsbH1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1sb2JlaHViJnJlcG89bG9iZS11aSZwcj02OTIifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :--
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-05T09:53:23.047219Z">2026-10-05T09:53:23.047219Z</relative-time> | `bec6f23` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/bde66ec4-44ca-4888-ae92-5e1f92a24a0d)     ```   npm i https://pkg.pr.new/@lobehub/ui@692   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/111718162739"><code>5c9b229</code></a>_ 

- **Issue #688** (2026-10-05): **✨ feat(form): controlled base-ui Form with an engine-agnostic API**
  *Symptoms*: ## Summary  A new controlled Form at `@lobehub/ui/base-ui/form`, designed so lobe-chat's antd Form usages can migrate off antd.  - **Layered engine**: public API (own types) → internal `FormEngine` contract → TanStack `form-core` adapter. Only `engine/tanstack.ts` imports TanStack; swapping the engine = a new adapter passing `engine/contract.test.ts`. - **API**: `useForm({ schema, initialValues, values, onSubmit, onValuesChange, valuesChangeDebounce, validateOn })`, `useWatch`, `useFormInstance`, `<Form items | children>`, `Form.Field`, `Form.List`, `Form.SubmitFooter`. Dot paths, `FieldPath<T>` typing, `T` inferred from a Standard Schema (zod 4). - **Binding**: single child auto-injected (`value`/`onChange`/`onBlur`/id/aria); `valueProp` / `getValue` / `trigger` / static `formBinding` (Checkbox); `render` fallback; `bare`. - **Validation**: schema-first + field `validate` (schema or fn, async, debounced, stale results dropped), `required`, `deps`; blur first, then on change while in error, all on submit. Inline validators are held in a ref, never re-registered. - **Render granularity**: editing one field re-renders only that field and its explicit subscribers (render-count tests lock this). - **Watching**: `onValuesChange` fires for user edits only; `values` syncs untouched fields only; dirty compares against a reset baseline. - **Separate entry**: `@lobehub/ui/base-ui` does not pull TanStack (entry test). - **Lint**: `formSchemaRules` export with `@lobehub/ui/no-inline-form
  **Post-Mortem & Fix Analysis**:
  > [vc]: #GQ+5sY8GwOK3XutGkh6Nr3/jp48UCTyapeQc5KJT8BA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvRzhyekhwSmUzNk1ZVHJXUWt0Q0RoRXZyWk5DQyIsInByZXZpZXdVcmwiOiJsb2JlLXVpLWdpdC1mZWF0LWJhc2UtdWktZm9ybS1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1mZWF0LWJhc2UtdWktZm9ybS1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5IjpudWxsLCJ2MCI6ZmFsc2V9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9Njg4In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="ht
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-03T12:33:11.623241Z">2026-10-03T12:33:11.623241Z</relative-time> | `f04f26e` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/c9ae4522-eb17-47ac-ab2e-ab2a832178e3)     ```   npm i https://pkg.pr.new/@lobehub/ui@688   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/111734125415"><code>527b4a0</code></a>_ 

- **Issue #687** (2026-10-03): **✨ feat(image): add useImagePreview for custom preview triggers**
  *Symptoms*: ## Summary  Adds `useImagePreview(elementRef, options)`. It opens the image viewer from a consumer's own trigger, for an `<img>` that `Image` doesn't render. The viewer animates from and back to that element, the same as clicking an `Image`.  ```tsx const { open, outlet } = useImagePreview(imgRef, { src: fullSizeUrl }); ```  ## Why  `@lobehub/editor` still uses antd `Image.PreviewGroup` (with a controlled `open`) so its zoom button can preview the editor's own image node. The new viewer could only be opened by clicking an `Image`, and `openPreview` / `PreviewOutlet` are internal. This hook is the supported entry point, so the editor can drop antd `Image`.  ## Changes  - `src/Image/useImagePreview.tsx`: resolves the same defaults as `Image` (`defaultZoom: 'auto'`, `autoZoomThreshold`, `maxScale`), opens a single-entry session anchored to `elementRef.current`, keeps the opener focus, and returns the `PreviewOutlet` to render. - Exported from `@lobehub/ui` and `src/Image`. API docs are added to `Image/index.mdx`.  ## Verification  - `useImagePreview.test.tsx`: opens anchored to the referenced `<img>` with the resolved defaults and `previewSrc`; no-op when the ref is empty. - `vitest run src/Image`: 267 passed. `tsc --noEmit`: pass. eslint: no new warnings. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #aafU+wL3BGJo3SR4rGZKo5oTo6FeujZEq7WC3wz4be4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9CcXdXRXJka2YzaEUxY1NEVHhUQnFQcEJ3Y2VKIiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZlYXQtaW1hZ2UtcHJldmlldy1ob29rLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImxvYmUtdWktZ2l0LWZlYXQtaW1hZ2UtcHJldmlldy1ob29rLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOm51bGx9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9Njg3In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-03T07:34:50.198436Z">2026-10-03T07:34:50.198436Z</relative-time> | `0e14a00` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/4b81d5b5-b324-47a1-bfe2-65fd23913d73)     ```   npm i https://pkg.pr.new/@lobehub/ui@687   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/111157815574"><code>0e14a00</code></a>_ 

- **Issue #686** (2026-10-01): **✨ feat(chat): move chat, mobile, awesome, color and storybook subpaths off antd**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [x] ✨ feat  #### 🔀 变更说明 | Description of Change  Moves the `chat`, `mobile`, `awesome`, `color` and `storybook` subpaths off antd. After this, none of their exports reach `antd` / `rc-*` at runtime. The only remaining link is `@lobehub/icons` from `icons` / `brand` / `AgentSkillCard`; it tree-shakes away because the package has `sideEffects: false` and `IconAvatar` / `LobeHub` are antd-free.  - **chat**: Button, TextArea, Modal, Select, Tag, Alert, Avatar and DraggablePanel come from base-ui. ChatList copy feedback uses `toast` instead of `App.useApp().message`. TokenTag uses base-ui `Progress`. - **ChatInputArea**: base-ui `DraggablePanel` has no `fullscreen`, so the expanded state renders its own layer below `heights.headerHeight`. - **mobile / awesome / storybook**: base-ui Button and DraggablePanel. Hero drops the antd `ConfigProvider` (`fontSize: 16`) and pins its action buttons to the previous 45px / 18px / 12px radius. - **color**: `Flexbox` + `toast` replace antd `Space` + static `message`.  Public type changes:  - `GradientButtonProps`, `BottomGradientButtonProps` and mobile `ChatSendButtonProps` extend base-ui `ButtonProps`: no `variant` / `glass` / `shadow`, and `iconPlacement` → `iconPosition`. - `ChatItem` / `ChatList` use base-ui `AlertProps` / `AvatarProps`. - `MessageModal` drops `panelRef`. - `ChatInputArea` `ref` is `HTMLTextAreaElement`; antd's `TextAreaRef` is gone.  Downstream impact checked on lobehub canary: `ChatList`, `T
  **Post-Mortem & Fix Analysis**:
  > [vc]: #egeW0MK/6cOrlwDzORYSGQPNhwCHDED7yawSlCYRi3U=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9Ec3NTem5HcmdpUm9vOGpmTFJQVW5ScllITWFGIiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZlYXQtc3VicGF0aC1vZmYtYW50ZC1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1mZWF0LXN1YnBhdGgtb2ZmLWFudGQtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6bnVsbH1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1sb2JlaHViJnJlcG89bG9iZS11aSZwcj02ODYifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | |
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-01T17:04:13.478094Z">2026-10-01T17:04:13.478094Z</relative-time> | `59aa4cf` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/ccb13d85-c1fe-4b32-a48d-0ca88b123188)     ```   npm i https://pkg.pr.new/@lobehub/ui@686   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/110497619213"><code>a091909</code></a>_ 

- **Issue #685** (2026-10-01): **✨ feat(eslint): ban antd and root wrappers replaced by base-ui batches 8–10**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [x] ✨ feat  #### 🔀 变更说明 | Description of Change  Extends `@lobehub/ui/eslint` `restrictedImports` to the components replaced in #675 (batches 8–10 + remaining antd surface).  **`@lobehub/ui` root wrappers** (antd-based; use `@lobehub/ui/base-ui`): `AvatarGroup`, `Burger`, `DatePicker`, `Input`, `InputNumber`, `InputPassword`, `ModalHost`, `TextArea`.  **Direct `antd`** (named imports + `antd/es|lib/<component>` paths): `Anchor`, `Breadcrumb`, `Card`, `Carousel`, `ColorPicker`, `DatePicker`, `Descriptions`, `Divider`, `FloatButton`, `Input`, `InputNumber`, `List`, `Menu`, `QRCode`, `Rate`, `Statistic`, `Steps`, `Table`, `Typography`.  **`@ant-design/pro-components`**: whole package.  Deliberately not banned:  - antd `Form`, `App`, `ConfigProvider`, locale: Form state layer + theme shell, tracked in #684. - `antd/es/menu/*` paths: downstream still imports the `ItemType` type from `antd/es/menu/interface` (type-only). - root `List`: not antd-based, different API from base-ui `List`.  #### 📝 补充信息 | Additional Information  Verified with only this rule enabled:  - lobehub canary (`c1fdbbe150`, 14,659 files): 0 violations - lobehub-cloud main (`fd112af23`, 2,086 files): 0 violations - a sample importing each banned shape reports all of them; `Form` and `antd/es/menu/interface` stay allowed 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #3H0cYeR6On+BT2AITut+cZQl6PwyRxb8lmzxVLeu22I=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9IRG02cWRYWmV4ZkZqdXVmQmNoNHZaaDloVlBKIiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWNob3JlLWVzbGludC1iYW4tYmF0Y2hlcy04LTEwLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IlBFTkRJTkciLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoibG9iZS11aS1naXQtY2hvcmUtZXNsaW50LWJhbi1iYXRjaGVzLTgtMTAtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAifX1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1sb2JlaHViJnJlcG89bG9iZS11aSZwcj02ODUifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-01T15:38:47.376125Z">2026-10-01T15:38:47.376125Z</relative-time> | `8de2607` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #681** (2026-09-27): **🐛 fix(base-ui): render a custom Result icon without the status circle**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [ ] ✨ feat - [x] 🐛 fix - [ ] ♻️ refactor - [ ] 💄 style - [ ] 🔨 chore - [ ] 📝 docs  #### 🔀 变更说明 | Description of Change  `base-ui` `Result` wrapped any custom `icon` in the 72px tinted status circle and forced every nested `svg` to 36×36. antd `Result` rendered a custom icon as-is, so callers migrating from antd broke:  - A full-page brand loader passed as `icon` (LobeHub OAuth consent pending page) was squashed into a green circle, with its content collapsed into a vertical column. - 96px `FluentEmoji` icons overflowed the 72px circle.  Now the status circle and the SVG sizing apply only to the built-in status icons. A custom `icon` renders in a plain centered slot, matching antd.  #### 📝 补充信息 | Additional Information  - Regression test: `renders a custom icon without the status circle` fails before this change and passes after it (Result suite 12/12). - Downstream: lobehub/lobehub has about 11 `Result` usages with custom `FluentEmoji` icons that recover once this is released and bumped. - Acceptance for the downstream page (the lobe-chat side is verified; the `Result` pages that need this release are marked blocked until it ships): https://app.lobehub.com/acceptance/6e2bb489-b7a2-456a-bbf5-7873ff43dd41 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BdhThxmJucWxETi/qjrzxrrFXuZBcYYkma6zwOb9PDQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9sb2JlLWh1Yi1vc3MvbG9iZS11aS9IY1A1eEtVSDFycGQ5Tjc2NWY1RGI3RG5RaW93IiwicHJldmlld1VybCI6ImxvYmUtdWktZ2l0LWZpeC1yZXN1bHQtY3VzdG9tLWljb24tbG9iZS1odWItb3NzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJsb2JlLXVpLWdpdC1maXgtcmVzdWx0LWN1c3RvbS1pY29uLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIn19XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9bG9iZWh1YiZyZXBvPWxvYmUtdWkmcHI9NjgxIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-27T15:30:53.805908Z">2026-09-27T15:30:53.805908Z</relative-time> | `05d5779` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #675** (2026-10-01): **✨ feat(base-ui): Table, DatePicker, ColorPicker, QRCode, Burger and more**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [x] ✨ feat - [x] 🐛 fix - [ ] ♻️ refactor - [x] 💄 style - [ ] 🔨 chore - [x] 📝 docs  #### 🔀 变更说明 | Description of Change  antd-free components in `@lobehub/ui/base-ui`, so downstream can drop antd `Divider`, `Statistic`, `Breadcrumb`, `Descriptions`, `Steps`, `Menu` / `List`, `Table`, `DatePicker`, `ColorPicker`, `QRCode`, `@ant-design/pro-components` `ProTable`, and the root `Burger`.  **Batches 8–10**  | Component | Built on | Notes | | --- | --- | --- | | `Divider` | `@base-ui/react` `Separator` | default margin `0`; `dashed`, `orientation`, centered label | | `Statistic` | markup | `Intl.NumberFormat('en-US')`, `precision`, `prefix` / `suffix`, `formatter`, `loading` | | `Breadcrumb` | markup | `items`, chevron separator by default, `href` items go through lobe-ui `A` (router-aware) | | `Descriptions` | `<dl>` + CSS grid | `column`, `span`, `colon`, `bordered`, `title` / `extra`; one compact density | | `Steps` | markup | stepper with `current`, or a neutral guide list without it; `variant="dot"` | | `List` | markup | selectable navigation / member list: icon or avatar, description, extra, hover actions, dividers, `href` rows | | `Table` | `@tanstack/react-table` v9 | antd-shaped `columns`; local + server sorting, header filters, local + server pagination, sticky header, fixed columns |  **Remaining antd surface** (APIs designed for DX, not antd parity; visual language: solid 16px popups, 22px titles, round cells, black selection)  | Compo
  **Post-Mortem & Fix Analysis**:
  > [vc]: #dx0zLEcd5vnM6ixv5SYt785Xgp9Wfj429Gv3fiN6al0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvNDRxZ3BwcGhUZjZFNnZQYk5jY1Z0dFB3ckIyOCIsInByZXZpZXdVcmwiOiJsb2JlLXVpLWdpdC1mZWF0LWJhc2UtdWktYmF0Y2hlcy04LTEwLWxvYmUtaHViLW9zcy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImxvYmUtdWktZ2l0LWZlYXQtYmFzZS11aS1iYXRjaGVzLTgtMTAtbG9iZS1odWItb3NzLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6bnVsbCwidjAiOmZhbHNlfV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWxvYmVodWImcmVwbz1sb2JlLXVpJnByPTY3NSJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :--
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-26T16:36:01.258870Z">2026-09-26T16:36:01.258870Z</relative-time> | `8385bf0` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  >  [Open in StackBlitz](https://pkg.pr.new/template/7c32b1b9-fc2f-41ae-8f1a-0cb533951d48)     ```   npm i https://pkg.pr.new/@lobehub/ui@675   ```     _commit: <a href="https://github.com/lobehub/lobe-ui/runs/110316536475"><code>3434ed0</code></a>_ 

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

### Incident Patch 1: `d545d60a` (2026-10-05)
**Commit Message**: ✨ feat(form): controlled base-ui Form with an engine-agnostic API (#688)

* ✨ feat(form): FormEngine contract and TanStack form-core adapter

* ✨ feat(form): useForm, useWatch and schema-first validation

* ✨ feat(form): Form.Field with control binding, render prop and validation

* ✨ feat(form): Form root with items groups, submit flow and SubmitFooter

* ✨ feat(form): Form.List with stable row keys

* ✅ test(form): lock render granularity with render-count tests

* ✨ feat(form): infer form values from the schema and type Field names

* ✨ feat(form): publish @lobehub/ui/base-ui/form and deprecate the uncontrolled Form

* 📝 docs(form): base-ui/form docs, demos and antd migration guide

* ✨ feat(eslint): warn on form schemas built inline in render

* 🐛 fix(form): free engines, keep list edits on values sync, track dirty against a reset baseline

- drop form.mount() so undestroyed engines hold no window listeners
- touched covers parent and child paths; values sync no longer overwrites row edits
- dirty compares values with a baseline moved by code changes, values sync, reset and submit
- engine resetField clears errors, touched and pending validation
- submit drops server errors a

**File**: `docs.config.ts` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ export default defineDocsConfig({
     '@': 'src',
     // docs-kit consumes published `es/*` subpaths. Resolve those imports back
     // to source while developing @lobehub/ui itself.
+    '@lobehub/ui/base-ui/form': 'src/base-ui/FormKit',
     '@lobehub/ui/es': 'src',
     '@lobehub/ui': 'src',
   },
```

**File**: `package.json` (modified, +5/-0)
```diff
@@ -81,6 +81,10 @@
       "types": "./es/base-ui/index.d.mts",
       "import": "./es/base-ui/index.mjs"
     },
+    "./base-ui/form": {
+      "types": "./es/base-ui/FormKit/index.d.mts",
+      "import": "./es/base-ui/FormKit/index.mjs"
+    },
     "./eslint": {
       "types": "./es/eslint/index.d.mts",
       "import": "./es/eslint/index.mjs"
@@ -179,6 +183,7 @@
     "@shikijs/stream": "^4.3.1",
     "@shikijs/transformers": "^4.3.1",
     "@splinetool/runtime": "1.12.98",
+    "@tanstack/form-core": "^1.33.5",
     "@tanstack/react-table": "^9.2.4",
     "ahooks": "^3.9.7",
     "antd-style": "^4.1.0",
```

**File**: `src/ContextMenu/demos/overflow.tsx` (modified, +14/-24)
```diff
@@ -1,11 +1,4 @@
-import {
-  Block,
-  ContextMenuHost,
-  type ContextMenuItem,
-  ContextMenuTrigger,
-  type MenuInfo,
-  Text,
-} from '@lobehub/ui';
+import { Block, type ContextMenuItem, ContextMenuTrigger, type MenuInfo, Text } from '@lobehub/ui';
 import { createStaticStyles } from 'antd-style';
 import { useMemo, useState } from 'react';
 
@@ -47,21 +40,18 @@ export default () => {
   );
 
   return (
-    <>
-      <ContextMenuTrigger className={styles.trigger} items={items}>
-        <Block align="center" direction="vertical" gap={8} justify="center" padding={16}>
-          <Text strong as={'p'}>
-            Right click this panel
-          </Text>
-          <Text as={'p'} type="secondary">
-            The 24-item menu remains within the viewport and scrolls internally.
-          </Text>
-          <Text as={'p'} type="secondary">
-            Selected item: {selectedItem}
-          </Text>
-        </Block>
-      </ContextMenuTrigger>
-      <ContextMenuHost />
-    </>
+    <ContextMenuTrigger className={styles.trigger} items={items}>
+      <Block align="center" direction="vertical" gap={8} justify="center" padding={16}>
+        <Text strong as={'p'}>
+          Right click this panel
+        </Text>
+        <Text as={'p'} type="secondary">
+          The 24-item menu remains within the viewport and scrolls internally.
+        </Text>
+        <Text as={'p'} type="secondary">
+          Selected item: {selectedItem}
+        </Text>
+      </Block>
+    </ContextMenuTrigger>
   );
 };
```

**File**: `src/DropdownMenu/demos/header-footer-scroll.tsx` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import { Button, DropdownMenu, type DropdownMenuProps } from '@lobehub/ui';
+import { cssVar } from 'antd-style';
 
 const zones: [string, string][] = [
   ['Honolulu', 'GMT-10'],
@@ -35,7 +36,7 @@ export default () => {
       placement="bottomLeft"
       popupProps={{ style: { maxHeight: 300 } }}
       footer={
-        <div style={{ color: 'var(--lobe-color-text-3)', fontSize: 12 }}>
+        <div style={{ color: cssVar.colorTextTertiary, fontSize: 12 }}>
           18 time zones · scroll to explore
         </div>
       }
```

**File**: `src/DropdownMenu/demos/header-footer.tsx` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import { Avatar, Button, DropdownMenu, type DropdownMenuProps, Flexbox, Icon } from '@lobehub/ui';
+import { cssVar } from 'antd-style';
 import {
   CreditCardIcon,
   LifeBuoyIcon,
@@ -32,7 +33,7 @@ export default () => {
           <Avatar avatar="🧑‍🚀" size={36} />
           <Flexbox>
             <div style={{ fontSize: 14, fontWeight: 600 }}>Astro Naut</div>
-            <div style={{ color: 'var(--lobe-color-text-3)', fontSize: 12 }}>astro@lobehub.com</div>
+            <div style={{ color: cssVar.colorTextTertiary, fontSize: 12 }}>astro@lobehub.com</div>
           </Flexbox>
         </Flexbox>
       }
```

**File**: `src/DropdownMenu/demos/tooltip-hover-stay.tsx` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import { Button, DropdownMenu, Flexbox, Icon, Tooltip, TooltipGroup } from '@lobehub/ui';
+import { cssVar } from 'antd-style';
 import { Info } from 'lucide-react';
 import { useState } from 'react';
 
@@ -27,7 +28,7 @@ export default () => {
             {
               key: 'description',
               label: (
-                <div style={{ color: 'var(--lobe-color-text-3)', fontSize: 12, lineHeight: 1.6 }}>
+                <div style={{ color: cssVar.colorTextTertiary, fontSize: 12, lineHeight: 1.6 }}>
                   Move mouse onto tooltip content and keep it open.
                 </div>
               ),
```

**File**: `src/ScrollArea/demos/background.tsx` (modified, +2/-3)
```diff
@@ -1,4 +1,5 @@
 import { ScrollArea } from '@lobehub/ui';
+import { cssVar } from 'antd-style';
 
 const blocks = [
   {
@@ -69,9 +70,7 @@ export default () => {
           >
             <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
           </div>
-          <p style={{ color: 'var(--lobe-color-text-secondary)', margin: 0, padding: 12 }}>
-            {item.desc}
-          </p>
+          <p style={{ color: cssVar.colorTextSecondary, margin: 0, padding: 12 }}>{item.desc}</p>
         </section>
       ))}
     </ScrollArea>
```

**File**: `src/ScrollArea/demos/both.tsx` (modified, +3/-2)
```diff
@@ -6,6 +6,7 @@ import {
   ScrollAreaThumb,
   ScrollAreaViewport,
 } from '@lobehub/ui';
+import { cssVar } from 'antd-style';
 
 const items = Array.from({ length: 100 }, (_, index) => index + 1);
 
@@ -36,9 +37,9 @@ export default () => {
                 key={item}
                 style={{
                   alignItems: 'center',
-                  background: 'var(--lobe-color-fill-tertiary)',
+                  background: cssVar.colorFillTertiary,
                   borderRadius: 8,
-                  color: 'var(--lobe-color-text-secondary)',
+                  color: cssVar.colorTextSecondary,
                   display: 'flex',
                   fontSize: 14,
                   fontWeight: 500,
```

---

### Incident Patch 2: `b0599bde` (2026-10-01)
**Commit Message**: ✨ feat(eslint): ban antd and root wrappers replaced by base-ui batches 8–10 (#685)

**File**: `src/eslint/index.ts` (modified, +100/-0)
```diff
@@ -5,10 +5,13 @@ const DEPRECATED_UI_COMPONENTS = [
   'Alert',
   'AutoComplete',
   'Avatar',
+  'AvatarGroup',
+  'Burger',
   'Button',
   'Checkbox',
   'CheckboxGroup',
   'Collapse',
+  'DatePicker',
   'DraggablePanel',
   'DraggablePanelBody',
   'DraggablePanelContainer',
@@ -18,8 +21,12 @@ const DEPRECATED_UI_COMPONENTS = [
   'Dropdown',
   'FormSubmitFooter',
   'FormTitle',
+  'Input',
+  'InputNumber',
   'InputOPT',
+  'InputPassword',
   'Modal',
+  'ModalHost',
   'Radio',
   'RadioGroup',
   'Segmented',
@@ -37,36 +44,77 @@ const DEPRECATED_UI_COMPONENTS = [
   'Tabs',
   'Tag',
   'Text',
+  'TextArea',
   'Tree',
 ];
 
 const DEPRECATED_ANTD_ONLY = [
+  'Anchor',
   'Badge',
+  'Breadcrumb',
+  'Card',
+  'Carousel',
+  'ColorPicker',
+  'Descriptions',
+  'Divider',
   'Empty',
+  'FloatButton',
+  'List',
+  'Menu',
   'Pagination',
   'Popover',
   'Progress',
+  'QRCode',
+  'Rate',
   'Result',
   'Spin',
+  'Statistic',
+  'Steps',
+  'Table',
   'Tooltip',
+  'Typography',
   'Upload',
 ];
 
 const DEPRECATED_ANTD_COMPONENT_PATHS = [
   'antd/es/alert',
   'antd/es/alert/*',
+  'antd/es/anchor',
+  'antd/es/anchor/*',
   'antd/es/auto-complete',
   'antd/es/auto-complete/*',
   'antd/es/badge',
   'antd/es/badge/*',
+  'antd/es/breadcrumb',
+  'antd/es/breadcrumb/*',
+  'antd/es/card',
+  'antd/es/card/*',
+  'antd/es/carousel',
+  'antd/es/carousel/*',
   'antd/es/checkbox',
   'antd/es/checkbox/*',
   'antd/es/collapse',
   'antd/es/collapse/*',
+  'antd/es/color-picker',
+  'antd/es/color-picker/*',
+  'antd/es/date-picker',
+  'antd/es/date-picker/*',
+  'antd/es/descriptions',
+  'antd/es/descriptions/*',
+  'antd/es/divider',
+  'antd/es/divider/*',
   'antd/es/dropdown',
   'antd/es/dropdown/*',
   'antd/es/empty',
   'antd/es/empty/*',
+  'antd/es/float-button',
+  'antd/es/float-button/*',
+  'antd/es/input',
+  'antd/es/input-number',
+  'antd/es/input-number/*',
+  'antd/es/input/*',
+  'antd/es/list',
+  'antd/es/list/*',
   'antd/es/message',
   'antd/es/message/*',
   'antd/es/notification',
@@ -77,8 +125,12 @@ const DEPRECATED_ANTD_COMPONENT_PATHS = [
   'antd/es/popover/*',
   'antd/es/progress',
   'antd/es/progress/*',
+  'antd/es/qr-code',
+  'antd/es/qr-code/*',
   'antd/es/radio',
   'antd/es/radio/*',
+  'antd/es/rate',
+  'antd/es/rate/*',
   'antd/es/result',
   'antd/es/result/*',
   'antd/es/skeleton',
@@ -87,28 +139,60 @@ const DEPRECATED_ANTD_COMPONENT_PATHS = [
   'antd/es/slider/*',
   'antd/es/spin',
   'antd/es/spin/*',
+  'antd/es/statistic',
+  'antd/es/statistic/*',
+  'antd/es/steps',
+  'antd/es/steps/*',
   'antd/es/switch',
   'antd/es/switch/*',
+  'antd/es/table',
+  'antd/es/table/*',
   'antd/es/tooltip',
   'antd/es/tooltip/*',
   'antd/es/tree',
   'antd/es/tree/*',
+  'antd/es/typography',
+  'antd/es/typography/*',
   'antd/es/upload',
   'antd/es/upload/*',
   'antd/lib/alert',
   'antd/lib/alert/*',
+  'antd/lib/anchor',
+  'antd/lib/anchor/*',
   'antd/lib/auto-complete',
   'antd/lib/auto-complete/*',
   'antd/lib/badge',
   'antd/lib/badge/*',
+  'antd/lib/breadcrumb',
+  'antd/lib/breadcrumb/*',
+  'antd/lib/card',
+  'antd/lib/card/*',
+  'antd/lib/carousel',
+  'antd/lib/carousel/*',
   'antd/lib/checkbox',
   'antd/lib/checkbox/*',
   'antd/lib/collapse',
   'antd/lib/collapse/*',
+  'antd/lib/color-picker',
+  'antd/lib/color-picker/*',
+  'antd/lib/date-picker',
+  'antd/lib/date-picker/*',
+  'antd/lib/descriptions',
+  'antd/lib/descriptions/*',
+  'antd/lib/divider',
+  'antd/lib/divider/*',
   'antd/lib/dropdown',
   'antd/lib/dropdown/*',
   'antd/lib/empty',
   'antd/lib/empty/*',
+  'antd/lib/float-button',
+  'antd/lib/float-button/*',
+  'antd/lib/input',
+  'antd/lib/input-number',
+  'antd/lib/input-number/*',
+  'antd/lib/input/*',
+  'antd/lib/list',
+  'antd/lib/list/*',
   'antd/lib/message',
   'antd/lib/message/*',
   'antd/lib/notification',
@@ -119,8 +203,12 @@ const DEPRECATED_ANTD_COMPONENT_PATHS = [
   'antd/lib/popover/*',
   'antd/lib/progress',
   'antd/lib/progress/*',
+  'antd/lib/qr-code',
+  'antd/lib/qr-code/*',
   'antd/lib/radio',
   'antd/lib/radio/*',
+  'antd/lib/rate',
+  'antd/lib/rate/*',
   'antd/lib/result',
   'antd/lib/result/*',
   'antd/lib/skeleton',
@@ -129,12 +217,20 @@ const DEPRECATED_ANTD_COMPONENT_PATHS = [
   'antd/lib/slider/*',
   'antd/lib/spin',
   'antd/lib/spin/*',
+  'antd/lib/statistic',
+  'antd/lib/statistic/*',
+  'antd/lib/steps',
+  'antd/lib/steps/*',
   'antd/lib/switch',
   'antd/lib/switch/*',
+  'antd/lib/table',
+  'antd/lib/table/*',
   'antd/lib/tooltip',
   'antd/lib/tooltip/*',
   'antd/lib/tree',
   'antd/lib/tree/*',
+  'antd/lib/typography',
+  'antd/lib/typography/*',
   'antd/lib/upload',
   'antd/lib/upload/*',
 ];
@@ -176,6 +272,10 @@ export const restrictedImports = {
             message: 'Use `Spin variant="network"` from "@lobehub/ui/base-ui" instead.',
             name: 'thinking-orbs',
           },
+          {
+            message: 
```

---

### Incident Patch 3: `8ee1c477` (2026-10-01)
**Commit Message**: ✨ feat(base-ui): Table, DatePicker, ColorPicker, QRCode, Burger and more (#675)

* 📝 docs: add base-ui batch 8–10 specs and implementation plan

* ✨ feat(base-ui): add Divider and move Accordion and HistoryDivider off antd

* ✨ feat(base-ui): add Statistic

* ✨ feat(base-ui): add Breadcrumb

* ✨ feat(base-ui): add Descriptions

* ✨ feat(base-ui): add Steps

* ✨ feat(base-ui): add List

* ✨ feat(base-ui): add Table column model on TanStack Table v9

* ✨ feat(base-ui): add Table with sorting, pagination and sticky layout

* ✨ feat(base-ui): add Table header filters, docs and demos

* 🐛 fix(base-ui): align Steps dot connector under the dot

* 🐛 fix(base-ui): Table pagination clamp, single-sort and callbacks; Descriptions span placement

* 💄 style(base-ui): redesign Progress inset as a split meter

- inset renders a filled pill and a remaining pill split by a 3px gap; drops the end cap and groove
- small inset no longer collapses to a 0px bar; fill never shrinks below its own height
- active shimmer now shows on line and inset (inline background shorthand was overriding it)

* 📝 docs: add base-ui remaining components design spec

* 📝 docs: add base-ui remaining components impleme

**File**: `docs/superpowers/specs/2026-09-26-base-ui-display-batch-design.md` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+# base-ui display batch (batch eight)
+
+Five new display components in `@lobehub/ui/base-ui` — Divider, Statistic, Breadcrumb, Descriptions, Steps. antd `Card` is replaced by the existing `Block` with no new component. Goal: remove every downstream import of antd `Divider`, `Card`, `Statistic`, `Breadcrumb`, `Descriptions`, `Steps`.
+
+Downstream numbers come from the 2026-09-26 sweep (lobehub canary `3112b80e`, lobehub-cloud PR #1844 branch, runtime imports only).
+
+## Principles
+
+- v1 covers the props downstream actually uses; everything else is listed under "Out".
+- API closeness to antd is decided per component. Renames are listed explicitly so the migration is mechanical.
+- Pure-display components are plain markup; only Divider sits on a `@base-ui/react` primitive (`Separator`).
+- Every component ships the standard folder: `Component.tsx`, `type.ts`, `style.ts` (`createStaticStyles`), `index.ts`, `index.mdx`, `demos/`, `__tests__/`, and is re-exported from `src/base-ui/index.ts`.
+
+## Divider
+
+Downstream: 73 files, 98 calls. ~55 calls set `margin: 0` / `marginBlock: 0`; `dashed` ×36; `orientation="vertical"` ×7; legacy `type="vertical"` ×1; centered text ×3.
+
+Built on `Separator` from `@base-ui/react/separator` (gives `role="separator"` and `aria-orientation`).
+
+```ts
+export interface DividerProps extends Omit<ComponentProps<'div'>, 'children'> {
+  children?: ReactNode;
+  dashed?: boolean;
+  orientation?: 'horizontal' | 'vertical';
+  ref?: Ref<HTMLDivElement>;
+}
+```
+
+- Default margin is `0` in both orientations (antd uses 24px block / 8px inline). Deliberate: the migration deletes the ~55 `margin: 0` overrides; call sites that want spacing keep their `marginBlock`.
+- Horizontal: `width: 100%`, 1px line. Vertical: `height: 1em`, inline, 1px line.
+- Line color `colorBorderSecondary`; `dashed` switches the border style.
+- `children` renders a centered label with lines on both sides; label is 12px `colorTextDescription`. When `children` is present the root is a flex row and the `Separator` role stays on the root.
+
+Out: `type` (the one call migrates to `orientation`), `titlePlacement`, `orientationMargin`, `plain`, `variant`, `size`.
+
+## Card → Block (no new component)
+
+Downstream: 15 calls in 11 files.
+
+- 11 calls are a styled container (`className`, `size="small"`, `styles.body.padding`) → `Block variant="outlined"` with the same className / padding.
+- 1 call uses `title` + `extra` (`eval/features/Experiments/BenchmarksSection.tsx`) → `Block` with a hand-written `Flexbox` header row.
+- 3 calls live in lobehub-cloud `src/business/client/WorkspaceSubscription/index.tsx` and `UsageDashboard.tsx`, which nothing imports → delete both files.
+
+No change to `Block`.
+
+## Statistic
+
+Downstream (live): oss `src/components/StatisticCard` (the only oss consumer; 9 product call sites go through it) and cloud `devtools/agent-evals` (10 calls, 2 files). The 2 cloud `WorkspaceSubscription` files are deleted (see Card).
+
+```ts
+export interface StatisticProps extends Omit<ComponentProps<'div'>, 'title' | 'prefix'> {
+  classNames?: { title?: string; value?: string };
+  formatter?: (value: number | string | undefined) => ReactNode;
+  loading?: boolean;
+  precision?: number;
+  prefix?: ReactNode;
+  ref?: Ref<HTMLDivElement>;
+  styles?: { title?: CSSProperties; value?: CSSProperties };
+  suffix?: ReactNode;
+  title?: ReactNode;
+  value?: number | string;
+}
+```
+
+- Numbers format through `Intl.NumberFormat('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })`. The locale is fixed so SSR and client output match. Strings render as-is (agent-evals passes `"12 / 3"`, `"98.1%"`).
+- `formatter` wins over the built-in formatting.
+- Value: 24px, semibold, `tabular-nums`. Title: 14px `colorTextDescription`.
+- `loading` swaps the value for a base-ui `Skeleton`.
+
+Renames: `valueStyle` → `styles.value`.
+
+Out: int/decimal split spans, `groupSeparator` / `decimalSeparator`, `Statistic.Countdown` / `Timer`.
+
+Downstream follow-up: `StatisticCard` renders base-ui `Statistic` and drops its `.ant-statistic-content-value-*` overrides.
+
+## Breadcrumb
+
+Downstream: 6 files (oss only), all `items`-based. `title` ×18, `href` ×1, `onClick` ×1. Every call passes a `ChevronRight` icon as `separator`; at least 2 files override `.ant-breadcrumb-link` to center items vertically.
+
+```ts
+export interface BreadcrumbItem {
+  href?: string;
+  key?: Key;
+  onClick?: MouseEventHandler<HTMLElement>;
+  title: ReactNode;
+}
+
+export interface BreadcrumbProps extends Omit<ComponentProps<'nav'>, 'children'> {
+  classNames?: { item?: string; separator?: string };
+  items: BreadcrumbItem[];
+  ref?: Ref<HTMLElement>;
+  separator?: ReactNode;
+  styles?: { item?: CSSProperties; separator?: CSSProperties };
+}
+```
+
+- Markup: `nav[aria-label="breadcrumb"] > ol > li`; the last item gets `aria-current="page"`. Separators are `aria-hidden`.
+- Defau
```

**File**: `docs/superpowers/specs/2026-09-26-base-ui-list-confirm-design.md` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+# base-ui List, and Popconfirm → confirmModal (batch nine)
+
+One new component, `List` in `@lobehub/ui/base-ui`, and one migration with no new component: antd `Popconfirm` → `confirmModal`. Goal: remove every downstream import of antd `Menu`, `List`, `Popconfirm`, and retire the root `@lobehub/ui` `Menu` and `List`.
+
+Downstream numbers come from the 2026-09-26 sweep (lobehub canary `3112b80e`, lobehub-cloud PR #1844 branch, runtime imports only).
+
+## Popconfirm → confirmModal
+
+Downstream: 14 calls in 12 files (oss 6, cloud 6).
+
+- ~10 destructive confirms (remove collaborator, delete API key / dev plugin / skill, remove budget rule / pool, change team URL, reset settings, rerun onboarding)
+- 3 payment confirms in cloud (`PlanGrid`, `PaymentButton` ×2): emoji + text title, `icon={false}`
+- 1 controlled `open` in `ChatInput/ActionBar/Clear`
+
+`confirmModal` (`@lobehub/ui/base-ui`) already covers every prop in use: `title` / `content` take ReactNode, `okButtonProps` carries `danger` / `disabled`, async `onOk` drives the OK button's loading state and closes on resolve. It is used in 157 downstream files today.
+
+No new component. The interaction changes from a bubble anchored to the trigger to a centered modal. Accepted.
+
+Mapping per call site:
+
+| Popconfirm                                             | confirmModal                                                       |
+| ------------------------------------------------------ | ------------------------------------------------------------------ |
+| wrapper around the trigger                             | trigger's `onClick` calls `confirmModal({...})`                    |
+| `title`                                                | `title`                                                            |
+| `description`                                          | `content`                                                          |
+| `okText` / `cancelText`                                | `okText` / `cancelText`                                            |
+| `okButtonProps`                                        | `okButtonProps` (`type: 'primary'` dropped, OK is primary already) |
+| `onConfirm`                                            | `onOk` (return the promise so loading shows)                       |
+| `disabled`                                             | don't call `confirmModal`                                          |
+| `open` / `onOpenChange` (ChatInput)                    | deleted; the guard moves into `onClick`                            |
+| `placement`, `arrow`, `icon`, `cancelButtonProps.size` | dropped                                                            |
+
+Call sites that also set `loading` on the trigger button (`MemberBudgetControl`, `BudgetPoolControl`) keep it; `onOk` returning the promise covers the modal button.
+
+## List
+
+### Scope
+
+Downstream call sites the component replaces:
+
+| Source                                  | Sites                                                                                                    | Fields used                                                                                                           |
+| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
+| antd `Menu` via oss `@/components/Menu` | 3 (`AgentSetting/AgentCategory`, `User/UserPanel/PanelContent`, `(mobile)/community/(list)/_layout/Nav`) | `key`, `icon`, `label`, `extra` ×1, `type: 'divider'` ×3; `selectable`, `selectedKeys`, `onClick({ key })`, `compact` |
+| root `@lobehub/ui` `Menu`               | 2 (`DevPanel/RenderGallery/Sidebar`, `community/components/CategoryMenu`)                                | `items`, `mode="inline"`, `selectedKeys`, `onClick({ key })`                                                          |
+| root `@lobehub/ui` `List`               | 3 (`ChatGroupWizard` ×2, `MemberSelectionModal`)                                                         | `key`, `title`, `avatar`, `description`, `actions`, `showAction`                                                      |
+| antd `List`                             | 2 (`MemberSelectionModal`, `MarketAuth/ClaimResourcesModal`)                                             | `dataSource` + `renderItem`, `bordered`, `size="small"`, `List.Item onClick`                                          |
+
+lobe-ui internal: `src/Burger` renders antd `Menu` inside a `Drawer`; it switches to base-ui `List`.
+
+In: flat items, dividers, icon or avatar, label + description, trailing `extra`, hover `actions`, selection (controlled / uncontrolled), `href` items, danger / disabled items, `compact`, three variants.
+
+Out (not in v1): submenus, groups, `mode="horizontal"`, `inlineCollapsed`, virtual scrolling, dra
```

**File**: `docs/superpowers/specs/2026-09-26-base-ui-table-design.md` (added, +242/-0)
```diff
@@ -0,0 +1,242 @@
+# base-ui Table (batch ten)
+
+Data table for `@lobehub/ui/base-ui`, built on TanStack Table v9 with an antd-shaped `columns` / `dataSource` API. Goal: remove every downstream import of antd `Table` and `@ant-design/pro-components` `ProTable`.
+
+Downstream numbers come from the 2026-09-26 sweep (lobehub canary `3112b80e`, lobehub-cloud PR #1844 branch).
+
+## Scope
+
+Downstream reach:
+
+- 18 files import antd `Table` directly (oss 10, cloud 8)
+- 11 oss files go through `src/components/InlineTable`, a wrapper around antd `Table`
+- 3 cloud files use `ProTable` from `@ant-design/pro-components` (`subscription/usage/.../SpendTable`, `WorkspaceBilling/Usage/SpendDetail/WorkspaceSpendTable`, `subscription/referral/.../ReferralTable`)
+- 8 files override `.ant-table-*` styles
+
+Usage across the 18 direct files:
+
+| Feature                                                                                           | Usage                                                                                                                    |
+| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
+| column `title` / `render` / `key` / `dataIndex` / `width`                                         | 74 / 67 / 60 / 52 / 52 column objects                                                                                    |
+| column `sorter`                                                                                   | 28 local comparators; `sorter: true` + `onChange` for server sort (oss `Settings/stats/.../UsageTable`, the 3 ProTables) |
+| column `filters` + `onFilter`                                                                     | 3 columns, all in cloud `WorkspaceBilling/Usage/ActivityLog`                                                             |
+| column `align` / `onCell` / `ellipsis` / `fixed` / `sortDirections` / `defaultSortOrder`          | 6 / 5 / 2 / 1 (`right`) / 4 / 1                                                                                          |
+| `pagination`                                                                                      | `false` ×13; object ×5 (`pageSize`, `defaultPageSize`, `showSizeChanger`, `onShowSizeChange`)                            |
+| `scroll`                                                                                          | `x` ×7 (`'max-content'` or a number), `y` ×3 (sticky header)                                                             |
+| `size`                                                                                            | `small` ×14, `middle` ×2                                                                                                 |
+| `rowKey` / `rowClassName` / `onRow` / `loading` / `bordered` / `locale.emptyText` / `tableLayout` | 14 / 5 / 3 / 3 / 4 / 2 / 1                                                                                               |
+
+Unused downstream, and out of v1: row selection, expandable rows, virtual scrolling, summary rows, tree data, column resizing, multi-column sort, controlled `sortOrder`, custom `filterDropdown`, filter search, array `dataIndex` paths, `sticky` offsets.
+
+## Dependency
+
+`@tanstack/react-table@^9.2.4` in `dependencies` (pulls `@tanstack/table-core` and `@tanstack/react-store`). tsdown externalizes it like every other runtime dependency.
+
+v9 specifics that shape the implementation:
+
+- `useTable({ features, columns, data })`, not v8's `useReactTable`.
+- Features and row models are registered once at module scope:
+
+```ts
+const features = tableFeatures({
+  columnFilteringFeature,
+  columnPinningFeature,
+  filteredRowModel: createFilteredRowModel(),
+  paginatedRowModel: createPaginatedRowModel(),
+  rowPaginationFeature,
+  rowSortingFeature,
+  sortedRowModel: createSortedRowModel(),
+});
+```
+
+- `data` falls back to a module-scope `EMPTY_DATA` constant, never an inline `[]`.
+- `manualSorting` / `manualPagination` switch those models off for server-driven tables.
+
+## Files
+
+```
+src/base-ui/Table/
+  Table.tsx            root: builds TanStack columns + options, renders wrapper, table, pagination
+  TableHeader.tsx      thead: sort button, filter trigger, aria-sort
+  TableBody.tsx        tbody: rows, cells, empty state
+  FilterMenu.tsx       header filter: base-ui DropdownMenu with checkbox items
+  toColumnDefs.ts      antd-shaped columns → TanStack ColumnDef
+  type.ts
+  style.ts
+  index.ts
+  index.mdx
+  demos/               basic, sorting, filters, pagination, server (manual sort + pagination), scroll (x + sticky y + fixed right), bordered, loading
+  __tests__/
+    toColumnDefs.test.ts
+    Table.test.tsx
+```
+
+`src/base-ui/index.ts` gets `export { default as Table } from './Table'; export * from './Table';`.
+
+## Types
+
+```ts
+exp
```

**File**: `docs/superpowers/specs/2026-10-01-base-ui-remaining-components-design.md` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+# base-ui remaining components: DatePicker, ColorPicker, QRCode, Burger, Input gaps
+
+Date: 2026-10-01
+Design canvas: https://claude.ai/artifact/MWpkxhiCyC8FQD9r13L59K (page "New components")
+
+## Goal
+
+Every antd-backed root component in `@lobehub/ui` gets a base-ui counterpart, so lobe-ui and its downstream apps can drop `antd`, `@ant-design/*`, `@rc-component/*` and `rc-*` entirely.
+
+Rules agreed with the owner:
+
+- Build every counterpart, including components with zero downstream uses today (ColorPicker, Burger).
+- Design each API for developer experience. Do not copy antd props that nothing uses; do not keep antd value types (dayjs, `Color`) in public signatures.
+- No new dependency on `antd`, `@ant-design/*`, `@rc-component/*` or `rc-*`. `antd-style` is the one exception and stays.
+
+Out of scope here (separate specs):
+
+- Form state layer (`useForm`, `useWatch`, `rules`, `Form.List`).
+- Rewiring root components that use antd internally (Collapse, Dropdown, Menu, EditableText, EmojiPicker, GuideCard, Highlighter, HotkeyInput, ImageSelect, Img, SliderWithInput, ThemeSwitch, Toc, mobile/ChatInputArea, Markdown, ThemeProvider).
+- Downstream migration and eslint bans.
+
+## Downstream usage (oss canary + cloud main, 2026-10-01)
+
+| Component    | Uses       | Shape                                                                                                                                                                                   |
+| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| DatePicker   | 5          | 3× RangePicker (`allowClear`, `disabledDate`, `format`, placeholder pair); 1× `picker="month"`; 1× single date with `minDate`, `showNow={false}`, `renderExtraFooter` ("Never expires") |
+| QRCode       | 4          | `value`, `size`, `bordered={false}`, all pass `color="#000" bgColor="#fff"`                                                                                                             |
+| ColorPicker  | 0          | only inside lobe-ui `ColorSwatches` (custom colour slot)                                                                                                                                |
+| Burger       | 0          | root lobe-ui component, antd `Drawer` + `Menu`                                                                                                                                          |
+| Input family | ~204 files | missing `onPressEnter` (43), `allowClear`, InputNumber `precision` / `formatter`                                                                                                        |
+
+## Visual language (owner decision, 2026-10-01)
+
+Style B on a solid surface:
+
+- Popovers: solid `colorBgElevated`, 16px radius, `boxShadow` (the large layered one) plus `--lobe-ring`. No backdrop blur.
+- Type: 22px / 600 titles with the secondary part (year, unit) in `colorTextTertiary` at weight 400; small uppercase letter-spaced labels (10px / 600 / 0.08em).
+- Shape: round day cells, pill buttons, round slider thumbs with a 3px white border.
+- Selection: solid `colorText` fill with `colorBgContainer` text. Today / current: 1px inset ring in `colorText`.
+- Triggers reuse the base-ui Input shell (variants, sizes, 8px radius) so they align inside forms.
+
+## Components
+
+### DatePicker and DateRangePicker
+
+```tsx
+<DatePicker
+  value={date}              // Date | null
+  onChange={setDate}        // (date: Date | null) => void
+  mode="date"               // 'date' | 'month' | 'year'
+  min={new Date()}
+  max={...}
+  disabledDate={(d) => ...} // (date: Date) => boolean
+  allowClear
+  format="MMM D, YYYY"      // dayjs format string or (date) => string; default per mode: 'MMM D, YYYY' / 'MMMM YYYY' / 'YYYY'
+  placeholder="Select date"
+  footer={<Button>Never expires</Button>}
+  variant size disabled
+/>
+
+<DateRangePicker
+  value={[start, end]}      // [Date | null, Date | null]
+  onChange={setRange}       // ([start, end]) => void
+  placeholder={['Start', 'End']}
+  min max disabledDate allowClear format variant size disabled
+/>
+```
+
+- Values are native `Date`. dayjs is an internal dependency (already in `dependencies`) and never appears in public types.
+- `DateRangePicker` is a separate component so each has one value type; no `picker` prop that changes the `onChange` signature.
+- Clicking the popover title drills date → month → year; `mode` fixes the lowest level.
+- The grid always renders 6 rows so the popover height never changes between months.
+- Week start and month / weekday names follow the active dayjs locale.
+- `footer` is a ReactNode slot rendered under the grid, separated by a 1px divider.
+- Range: two months side by side; the band between start and end is a `colorFillSecondary` strip joining the two filled ci
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -179,6 +179,7 @@
     "@shikijs/stream": "^4.3.1",
     "@shikijs/transformers": "^4.3.1",
     "@splinetool/runtime": "1.12.98",
+    "@tanstack/react-table": "^9.2.4",
     "ahooks": "^3.9.7",
     "antd-style": "^4.1.0",
     "beautiful-mermaid": "^1.1.3",
@@ -231,6 +232,7 @@
     "ts-md5": "^2.0.1",
     "unified": "^11.0.5",
     "unist-util-visit-parents": "^6.0.2",
+    "uqr": "^0.1.3",
     "url-join": "^5.0.0",
     "use-merge-value": "^1.2.0",
     "uuid": "^14.0.1",
```

**File**: `src/Accordion/Accordion.tsx` (modified, +2/-1)
```diff
@@ -1,12 +1,13 @@
 'use client';
 
-import { Divider } from 'antd';
 import { cx } from 'antd-style';
 import { LayoutGroup } from 'motion/react';
 import { type Key } from 'react';
 import { Children, Fragment, isValidElement, memo, useCallback, useMemo, useRef } from 'react';
 import useMergeState from 'use-merge-value';
 
+import Divider from '@/base-ui/Divider';
+
 import { AccordionConfigContext, AccordionItemStateProvider } from './context';
 import { styles } from './style';
 import { type AccordionProps } from './type';
```

**File**: `src/CodeDiff/DiffPanel.tsx` (modified, +1/-1)
```diff
@@ -6,10 +6,10 @@ import type { CSSProperties, ReactNode } from 'react';
 import { memo, useCallback, useState } from 'react';
 
 import ActionIcon from '@/base-ui/ActionIcon';
+import Tag from '@/base-ui/Tag';
 import type { FlexboxProps } from '@/Flex';
 import { Flexbox } from '@/Flex';
 import MaterialFileTypeIcon from '@/MaterialFileTypeIcon';
-import Tag from '@/Tag';
 import Text from '@/Text';
 import { stopPropagation } from '@/utils/dom';
 
```

**File**: `src/ColorSwatches/ColorSwatches.tsx` (modified, +22/-33)
```diff
@@ -1,12 +1,12 @@
 'use client';
 
-import { ColorPicker } from 'antd';
 import { cssVar, cx } from 'antd-style';
 import chroma from 'chroma-js';
 import { CheckIcon } from 'lucide-react';
 import { type FC, useMemo } from 'react';
 import useMergeState from 'use-merge-value';
 
+import { ColorPicker } from '@/base-ui/ColorPicker';
 import { Center, Flexbox } from '@/Flex';
 import Icon from '@/Icon';
 import Tooltip from '@/Tooltip';
@@ -106,38 +106,27 @@ const ColorSwatches: FC<ColorSwatchesProps> = ({
         })}
       {enableColorPicker && (
         <Tooltip title={texts?.custom || 'Custom'}>
-          <ColorPicker
-            disabledAlpha
-            arrow={false}
-            defaultValue={cssVar.colorPrimary}
-            format={'hex'}
-            value={enableColorSwatches ? undefined : active}
-            className={cx(
-              styles.picker,
-              enableColorSwatches && styles.conic,
-              isCustomActive && styles.active,
-            )}
-            presets={
-              enableColorSwatches
-                ? undefined
-                : [
-                    {
-                      colors: colors.map((c) => c.color),
-                      label: texts?.presets || 'Presets',
-                    },
-                  ]
-            }
-            style={{
-              borderRadius: shape === 'circle' ? '50%' : cssVar.borderRadius,
-            }}
-            onChangeComplete={(c) => {
-              if (c.toHexString() === cssVar.colorPrimary) {
-                setActive('');
-              } else {
-                setActive(c.toHexString());
-              }
-            }}
-          />
+          <span style={{ display: 'inline-flex' }}>
+            <ColorPicker
+              presets={enableColorSwatches ? undefined : colors.map((c) => c.color)}
+              value={isCustomActive ? active : undefined}
+              onChangeComplete={setActive}
+            >
+              <button
+                aria-label={texts?.custom || 'Custom'}
+                type="button"
+                className={cx(
+                  styles.picker,
+                  enableColorSwatches && styles.conic,
+                  isCustomActive && styles.active,
+                )}
+                style={{
+                  background: enableColorSwatches ? undefined : active,
+                  borderRadius: shape === 'circle' ? '50%' : cssVar.borderRadius,
+                }}
+              />
+            </ColorPicker>
+          </span>
         </Tooltip>
       )}
     </Flexbox>
```

---

### Incident Patch 4: `0d408437` (2026-09-28)
**Commit Message**: 💄 style(base-ui): bend DraggablePanel's seam into the toggle arrow

**File**: `src/base-ui/DraggablePanel/atoms.tsx` (modified, +47/-48)
```diff
@@ -10,6 +10,7 @@ import {
   type ReactNode,
   useCallback,
   useEffect,
+  useId,
   useMemo,
   useRef,
   useState,
@@ -28,40 +29,30 @@ import { createPanelController } from './core/controller';
 import { coarsePointer, handleSize as getHandleSize } from './core/env';
 import { useIsomorphicLayoutEffect, useStore } from './core/internal';
 import { timing } from './core/transition';
-import { BOW, handleVariants, rootVariants, styles, toggleVariants } from './style';
+import { handleVariants, rootVariants, SEAM_ARROW, styles, toggleVariants } from './style';
 
 const PAN_THRESHOLD = 3;
 
-const BOW_CX = 15;
-const BOW_CY = BOW.half + 8;
-const BOW_W = BOW_CX * 2;
-const BOW_H = BOW_CY * 2;
-
-const bowPath = (direction: 1 | -1, verticalSeam: boolean) => {
-  const k = BOW.half * BOW.curve;
-  const b = BOW_CX + BOW.bulge * direction;
-  const a0 = BOW_CY - BOW.half;
-  const a1 = BOW_CY + BOW.half;
-  // `a` runs along the seam, `b` across it; a horizontal seam swaps the two.
-  const pt = (along: number, across: number) =>
-    verticalSeam ? `${along} ${across}` : `${across} ${along}`;
+const ARROW_BOX = (SEAM_ARROW.half + SEAM_ARROW.lead) * 2;
+const ARROW_C = ARROW_BOX / 2;
+
+const ARROW_PATH = (() => {
+  const { depth: d, half: h, lead } = SEAM_ARROW;
+  const c = ARROW_C;
+  const r = 0.12;
   return [
-    `M${pt(BOW_CX, a0)}`,
-    `C${pt(BOW_CX, a0 + k)} ${pt(b, BOW_CY - k)} ${pt(b, BOW_CY)}`,
-    `C${pt(b, BOW_CY + k)} ${pt(BOW_CX, a1 - k)} ${pt(BOW_CX, a1)}`,
+    `M${c} ${c - h - lead}`,
+    `Q${c} ${c - h} ${c - d * r} ${c - h + h * r}`,
+    `L${c - d * (1 - r)} ${c - h * r}`,
+    `Q${c - d} ${c} ${c - d * (1 - r)} ${c + h * r}`,
+    `L${c - d * r} ${c + h - h * r}`,
+    `Q${c} ${c + h} ${c} ${c + h + lead}`,
   ].join(' ');
-};
-
-const BOW_PATHS = {
-  horizontalSeam: [bowPath(-1, false), bowPath(1, false)],
-  verticalSeam: [bowPath(-1, true), bowPath(1, true)],
-};
-
-/** The chevron points the way a click moves the panel. */
-const CHEVRON_TURN = { bottom: 270, left: 0, right: 180, top: 90 } as const;
+})();
 
-const chevronPath = (cx: number, cy: number) =>
-  `M${cx + 2.4} ${cy - 4.8} L${cx - 2.4} ${cy} L${cx + 2.4} ${cy + 4.8}`;
+// The path bends toward -x; the sign flips it so the seam points the way a click moves the panel.
+const bendSign = (placement: Placement, expand: boolean) =>
+  (placement === 'left' || placement === 'top' ? 1 : -1) * (expand ? 1 : -1);
 
 const ORIGIN_MAP = {
   bottom: 'center bottom',
@@ -356,13 +347,14 @@ export interface DraggablePanelToggleProps extends Omit<DivProps, 'onDrag'> {
 
 export const DraggablePanelToggle = memo<DraggablePanelToggleProps>(
   ({ className, showHandleWhenCollapsed, style, ...rest }) => {
-    const { axis, expand, expandable, placement, toggleExpand } = useDraggablePanelContext();
+    const { axis, expand, expandable, placement, showBorder, toggleExpand } =
+      useDraggablePanelContext();
+    const gradientId = `seam-arrow-${useId().replaceAll(/[^\w-]/g, '')}`;
 
     if (!expandable) return null;
 
-    const turn = CHEVRON_TURN[placement] + (expand ? 0 : 180);
-    const chevX = axis.vertical ? BOW_CY : BOW_CX;
-    const chevY = axis.vertical ? BOW_CX : BOW_CY;
+    const bend = bendSign(placement, expand);
+    const edgeOpacity = expand && showBorder ? 1 : 0;
 
     return (
       <div
@@ -377,26 +369,33 @@ export const DraggablePanelToggle = memo<DraggablePanelToggleProps>(
         >
           <svg
             fill="none"
-            height={axis.vertical ? BOW_W : BOW_H}
-            viewBox={`0 0 ${axis.vertical ? BOW_H : BOW_W} ${axis.vertical ? BOW_W : BOW_H}`}
-            width={axis.vertical ? BOW_H : BOW_W}
+            height={ARROW_BOX}
+            style={{ '--seam-bend': bend } as CSSProperties}
+            viewBox={`0 0 ${ARROW_BOX} ${ARROW_BOX}`}
+            width={ARROW_BOX}
           >
-            {BOW_PATHS[axis.vertical ? 'horizontalSeam' : 'verticalSeam'].map((d) => (
-              <path d={d} data-bow="" key={d} strokeLinecap="round" strokeWidth={BOW.stroke} />
-            ))}
-            <g
-              style={{
-                rotate: `${turn}deg`,
-                transformOrigin: `${chevX}px ${chevY}px`,
-                transition: 'rotate 0.25s var(--ant-motion-ease-out, ease)',
-              }}
-            >
+            <defs>
+              <linearGradient
+                gradientUnits="userSpaceOnUse"
+                id={gradientId}
+                x1={ARROW_C}
+                x2={ARROW_C}
+                y1={0}
+                y2={ARROW_BOX}
+              >
+                <stop data-end="" offset={0} stopOpacity={edgeOpacity} />
+                <stop data-tip="" offset={0.3} />
+                <stop data-tip="" offset={0.7} />
+                <stop data-end="" offset={1} stopOpacity={edgeOpacity} />
+              </linearGradient>
+            </defs>
+            <g transform={axis.vertical ? `rotate(90 ${ARROW_C} ${ARROW_C})` : undefined}>

```

**File**: `src/base-ui/DraggablePanel/style.ts` (modified, +29/-24)
```diff
@@ -2,13 +2,12 @@ import { createStaticStyles, cx } from 'antd-style';
 import { cva } from 'class-variance-authority';
 
 const TOGGLE_HIT_SHORT = 26;
-const TOGGLE_HIT_LONG = 34;
+const TOGGLE_HIT_LONG = 40;
 
-export const BOW = {
-  bulge: 10,
-  curve: 0.44,
-  gap: 45,
-  half: 46,
+export const SEAM_ARROW = {
+  depth: 6.5,
+  half: 11,
+  lead: 6,
   stroke: 1.25,
 };
 
@@ -43,14 +42,8 @@ export const styles = createStaticStyles(({ css, cssVar }) => {
         padding: 0;
         border: none;
 
-        color: ${cssVar.colorTextTertiary};
-
         background: none;
 
-        &:hover {
-          color: ${cssVar.colorText};
-        }
-
         &:focus-visible {
           outline: 2px solid ${cssVar.colorPrimary};
           outline-offset: 3px;
@@ -63,28 +56,35 @@ export const styles = createStaticStyles(({ css, cssVar }) => {
         position: absolute;
         inset-block-start: 50%;
         inset-inline-start: 50%;
-        transform: translate(-50%, -50%) scaleX(0.45);
+        transform: translate(-50%, -50%);
 
         overflow: visible;
 
         opacity: 0;
 
-        transition:
-          opacity 0.18s ${cssVar.motionEaseOut},
-          transform 0.24s ${cssVar.motionEaseOut};
+        transition: opacity 0.18s ${cssVar.motionEaseOut};
       }
 
       path {
-        transition: stroke 0.16s ${cssVar.motionEaseOut};
+        transform-origin: center;
+        transform: scaleX(0);
+        vector-effect: non-scaling-stroke;
+        transition: transform 0.24s ${cssVar.motionEaseOut};
       }
 
-      /* The bow is the seam bending, so it carries the seam's color, not the chevron's. */
-      path[data-bow] {
-        stroke: ${cssVar.colorBorderSecondary};
+      /* The ends fade into the seam so the bend reads as the seam itself, not a drawn icon. */
+      stop[data-end] {
+        stop-color: ${cssVar.colorBorderSecondary};
+        transition: stop-opacity 0.18s ${cssVar.motionEaseOut};
       }
 
-      button:hover path[data-bow] {
-        stroke: ${cssVar.colorBorder};
+      stop[data-tip] {
+        stop-color: ${cssVar.colorTextTertiary};
+        transition: stop-color 0.16s ${cssVar.motionEaseOut};
+      }
+
+      button:hover stop[data-tip] {
+        stop-color: ${cssVar.colorTextSecondary};
       }
     `,
   );
@@ -259,7 +259,7 @@ export const styles = createStaticStyles(({ css, cssVar }) => {
         &[data-expandable='true']:hover,
         &[data-expandable='true']:focus-within,
         &[data-expandable='true'][data-expand='false'] {
-          --draggable-panel-gap: ${BOW.gap}px;
+          --draggable-panel-gap: ${SEAM_ARROW.half + SEAM_ARROW.lead}px;
         }
 
         /* The wrapper carries an inline opacity when collapsed, so beat it. */
@@ -273,10 +273,15 @@ export const styles = createStaticStyles(({ css, cssVar }) => {
         &[data-expandable='true']:hover .${prefix}-toggle svg,
         &[data-expandable='true']:focus-within .${prefix}-toggle svg,
         &[data-expandable='true'][data-expand='false'] .${prefix}-toggle svg {
-          transform: translate(-50%, -50%) scaleX(1);
           opacity: 1;
         }
 
+        &[data-expandable='true']:hover .${prefix}-toggle path,
+        &[data-expandable='true']:focus-within .${prefix}-toggle path,
+        &[data-expandable='true'][data-expand='false'] .${prefix}-toggle path {
+          transform: scaleX(var(--seam-bend));
+        }
+
         &[data-expandable='true'][data-resizing='true'] {
           --draggable-panel-gap: 0px;
         }
```

---

### Incident Patch 5: `99e6a55d` (2026-09-27)
**Commit Message**: 🐛 fix(base-ui): render a custom Result icon without the status circle (#681)

**File**: `src/base-ui/Result/Result.tsx` (modified, +7/-3)
```diff
@@ -26,9 +26,13 @@ const Result = memo<ResultProps>(
 
     return (
       <section className={cx(styles.root, className)} ref={ref} style={style} {...rest}>
-        <div className={styles.icon} style={iconStyle}>
-          {icon ?? statusIcon[status]}
-        </div>
+        {icon ? (
+          <div className={styles.customIcon}>{icon}</div>
+        ) : (
+          <div className={styles.icon} style={iconStyle}>
+            {statusIcon[status]}
+          </div>
+        )}
         {title && <h3 className={styles.title}>{title}</h3>}
         {subTitle && <p className={styles.subTitle}>{subTitle}</p>}
         {extra && <div className={styles.extra}>{extra}</div>}
```

**File**: `src/base-ui/Result/__tests__/Result.test.tsx` (modified, +9/-0)
```diff
@@ -27,6 +27,15 @@ describe('Result', () => {
     expect(screen.getByTestId('custom-icon')).toBeTruthy();
   });
 
+  test('renders a custom icon without the status circle', () => {
+    render(<Result icon={<span data-testid="custom-icon" />} status="success" />);
+
+    const slot = screen.getByTestId('custom-icon').parentElement!;
+    expect(slot.getAttribute('style')).toBeNull();
+    expect(getComputedStyle(slot).width).not.toBe('72px');
+    expect(getComputedStyle(slot).borderRadius).not.toBe('50%');
+  });
+
   test('renders title, subTitle, extra, and children', () => {
     render(
       <Result
```

**File**: `src/base-ui/Result/style.ts` (modified, +6/-0)
```diff
@@ -1,6 +1,12 @@
 import { createStaticStyles, cssVar } from 'antd-style';
 
 export const styles = createStaticStyles(({ css, cssVar }) => ({
+  customIcon: css`
+    display: flex;
+    flex-shrink: 0;
+    justify-content: center;
+    margin-block-end: 12px;
+  `,
   extra: css`
     display: flex;
     flex-wrap: wrap;
```

---

### Incident Patch 6: `5111bfc3` (2026-09-27)
**Commit Message**: 🐛 fix(dashboard): keep sidebar icons in place while the rail collapses

**File**: `packages/docs-kit/site/components/DocsShell/DocsShell.tsx` (modified, +4/-18)
```diff
@@ -1,12 +1,6 @@
 import { Hotkey } from '@lobehub/ui';
 import { LobeHub } from '@lobehub/ui/brand';
-import {
-  Breadcrumb,
-  ConsoleBrand,
-  ConsoleNav,
-  ConsoleShell,
-  useConsoleShell,
-} from '@lobehub/ui/dashboard';
+import { Breadcrumb, ConsoleBrand, ConsoleNav, ConsoleShell } from '@lobehub/ui/dashboard';
 import { GithubIcon } from '@lobehub/ui/icons';
 import { Search } from 'lucide-react';
 import type { ReactNode } from 'react';
@@ -29,16 +23,6 @@ interface DocsShellProps {
 
 const LOGO_SIZE = 24;
 
-function DocsBrandLogo({ productName }: { productName: string }) {
-  const { collapsed } = useConsoleShell();
-
-  return collapsed ? (
-    <LobeHub size={LOGO_SIZE} />
-  ) : (
-    <LobeHub extra={productName} size={LOGO_SIZE} type="combine" />
-  );
-}
-
 const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
 
 /**
@@ -92,7 +76,9 @@ export function DocsShell({ children, documents, navigation, onSearchOpen }: Doc
   const brand = (
     <ConsoleBrand
       label={`${siteConfig.title} documentation home`}
-      logo={<DocsBrandLogo productName={productName} />}
+      logo={
+        <LobeHub className={styles.brandLogo} extra={productName} size={LOGO_SIZE} type="combine" />
+      }
       renderLink={({ children: content, href, ...linkProps }) => (
         <Link {...linkProps} to={href}>
           {content}
```

**File**: `packages/docs-kit/site/components/DocsShell/style.ts` (modified, +15/-0)
```diff
@@ -61,6 +61,21 @@ export const styles = createStaticStyles(({ css }) => {
       }
     `,
 
+    brandLogo: css`
+      > :not(:first-child) {
+        transition: opacity 120ms ease 80ms;
+
+        [data-collapsed='true'] & {
+          opacity: 0;
+          transition-delay: 0s;
+        }
+
+        @media (prefers-reduced-motion: reduce) {
+          transition: none;
+        }
+      }
+    `,
+
     iconButton,
 
     search: css`
```

**File**: `src/dashboard/ConsoleNav/ConsoleNav.test.tsx` (modified, +11/-0)
```diff
@@ -108,6 +108,17 @@ describe('ConsoleNav', () => {
     expect(links[0].getAttribute('data-active')).toBe('true');
   });
 
+  it('keeps the same link elements when toggling the rail', () => {
+    const railItems = [{ end: true, href: '/', icon: BookOpen, label: 'Home' }];
+    const { rerender } = render(<ConsoleNav groups={groups} items={railItems} pathname="/" />);
+    const home = screen.getByRole('link', { name: 'Home' });
+
+    rerender(<ConsoleNav collapsed groups={groups} items={railItems} pathname="/" />);
+
+    expect(screen.getByRole('link', { name: 'Home' })).toBe(home);
+    expect(home.textContent).toBe('Home');
+  });
+
   it('routes clicks through onNavigate and leaves external links alone', () => {
     const onNavigate = vi.fn();
     render(
```

**File**: `src/dashboard/ConsoleNav/ConsoleNav.tsx` (modified, +171/-154)
```diff
@@ -1,7 +1,7 @@
 'use client';
 
 import { ChevronDown, Play } from 'lucide-react';
-import { useCallback, useEffect, useId, useRef, useState } from 'react';
+import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
 
 import Tooltip from '@/base-ui/Tooltip';
 import Icon from '@/Icon';
@@ -14,6 +14,7 @@ import { styles } from './style';
 import type { ConsoleNavGroup, ConsoleNavItem, ConsoleNavLinkProps, ConsoleNavProps } from './type';
 
 const PANEL_TRANSITION_MS = 160;
+const RAIL_TRANSITION_MS = 200;
 
 type ExpandedOverrides = Record<string, boolean>;
 
@@ -25,23 +26,49 @@ function readOverrides(value: unknown): ExpandedOverrides {
   return value && typeof value === 'object' ? (value as ExpandedOverrides) : {};
 }
 
-function scrollActiveIntoView(container: HTMLElement) {
+function scrollActiveIntoView(container: HTMLElement, behavior: ScrollBehavior = 'auto') {
   const link =
     container.querySelector<HTMLElement>('[aria-current="page"]') ??
     [...container.querySelectorAll<HTMLElement>('button[data-active="true"]')].at(-1);
   if (!link) return;
   const containerRect = container.getBoundingClientRect();
   const linkRect = link.getBoundingClientRect();
   if (linkRect.top >= containerRect.top && linkRect.bottom <= containerRect.bottom) return;
-  container.scrollTop +=
-    linkRect.top - containerRect.top - (containerRect.height - linkRect.height) / 2;
+  container.scrollBy({
+    behavior,
+    top: linkRect.top - containerRect.top - (containerRect.height - linkRect.height) / 2,
+  });
 }
 
 interface LinkContext {
   onNavigate?: (href: string) => void;
   renderLink?: ConsoleNavProps['renderLink'];
 }
 
+function renderAnchor(context: LinkContext, linkProps: ConsoleNavLinkProps, onFollow: () => void) {
+  if (context.renderLink) return context.renderLink(linkProps);
+  return (
+    <a
+      aria-current={linkProps['aria-current']}
+      aria-label={linkProps['aria-label']}
+      className={linkProps.className}
+      data-active={linkProps['data-active']}
+      data-collapsed={linkProps['data-collapsed']}
+      data-indent={linkProps['data-indent']}
+      href={linkProps.href}
+      rel={linkProps.external ? 'noreferrer' : undefined}
+      target={linkProps.external ? '_blank' : undefined}
+      title={linkProps.title}
+      onClick={(event) => {
+        if (context.onNavigate && !linkProps.external) event.preventDefault();
+        onFollow();
+      }}
+    >
+      {linkProps.children}
+    </a>
+  );
+}
+
 function NavLink({
   active,
   collapsed,
@@ -51,6 +78,7 @@ function NavLink({
   indent = 0,
   item,
   name,
+  overlay = false,
 }: {
   active: boolean;
   collapsed: boolean;
@@ -60,6 +88,7 @@ function NavLink({
   indent?: number;
   item?: ConsoleNavItem;
   name: string;
+  overlay?: boolean;
 }) {
   const shell = useConsoleShellState();
   const label = item?.label ?? name;
@@ -70,15 +99,15 @@ function NavLink({
   const linkProps: ConsoleNavLinkProps = {
     'aria-current': active ? 'page' : undefined,
     'aria-label': collapsed ? name : undefined,
-    'children': (
+    'children': overlay ? null : (
       <>
         {icon ? <Icon icon={icon} size={18} /> : null}
-        {collapsed ? null : <span className={styles.itemLabel}>{label}</span>}
-        {!collapsed && item?.badge ? <span className={styles.badge}>{item.badge}</span> : null}
-        {collapsed && item?.badge ? <span aria-hidden className={styles.dot} /> : null}
+        <span className={styles.itemLabel}>{label}</span>
+        {item?.badge ? <span className={styles.badge}>{item.badge}</span> : null}
+        {item?.badge ? <span aria-hidden className={styles.dot} /> : null}
       </>
     ),
-    'className': styles.item,
+    'className': overlay ? styles.railLink : styles.item,
     'data-active': active,
     'data-collapsed': collapsed,
     'data-indent': indent,
@@ -88,37 +117,30 @@ function NavLink({
     'title': collapsed ? undefined : label,
   };
 
-  const link = context.renderLink ? (
-    context.renderLink(linkProps)
-  ) : (
-    <a
-      aria-current={linkProps['aria-current']}
-      aria-label={linkProps['aria-label']}
-      className={linkProps.className}
-      data-active={active}
-      data-collapsed={collapsed}
-      data-indent={indent}
-      href={href}
-      rel={item?.external ? 'noreferrer' : undefined}
-      target={item?.external ? '_blank' : undefined}
-      title={linkProps.title}
-      onClick={(event) => {
-        if (context.onNavigate && !item?.external) event.preventDefault();
-        follow();
-      }}
-    >
-      {linkProps.children}
-    </a>
-  );
+  const link = renderAnchor(context, linkProps, follow);
 
-  if (!collapsed) return link;
+  if (!icon && !overlay) return link;
+  // Always mounted so toggling the rail keeps the same link element and its label can fade.
   return (
-    <Tooltip placement="right" title={name}>
+    <Tooltip disabled={!collapsed} placement="right" title={name}>
     
```

**File**: `src/dashboard/ConsoleNav/demos/index.tsx` (modified, +8/-1)
```diff
@@ -28,7 +28,14 @@ export default () => {
 
   return (
     <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
-      <Surface style={{ inlineSize: collapsed ? 72 : 240, paddingBlock: 8 }}>
+      <Surface
+        style={{
+          inlineSize: collapsed ? 56 : 240,
+          overflow: 'hidden',
+          paddingBlock: 8,
+          transition: 'inline-size 200ms ease',
+        }}
+      >
         <ConsoleNav
           collapsed={collapsed}
           groups={groups}
```

**File**: `src/dashboard/ConsoleNav/demos/tree.tsx` (modified, +3/-1)
```diff
@@ -57,8 +57,10 @@ export default () => {
         style={{
           blockSize: 360,
           display: 'flex',
-          inlineSize: collapsed ? 72 : 260,
+          inlineSize: collapsed ? 56 : 260,
+          overflow: 'hidden',
           paddingBlock: 8,
+          transition: 'inline-size 200ms ease',
         }}
       >
         <ConsoleNav
```

**File**: `src/dashboard/ConsoleNav/style.ts` (modified, +362/-237)
```diff
@@ -1,279 +1,404 @@
 import { createStaticStyles } from 'antd-style';
 
-export const styles = createStaticStyles(({ css, cssVar, responsive }) => ({
-  badge: css`
-    flex: none;
-
-    min-inline-size: 20px;
-    padding-inline: 6px;
-    border-radius: 999px;
-
-    font-size: ${cssVar.fontSizeSM};
-    font-variant-numeric: tabular-nums;
-    color: ${cssVar.colorError};
-    text-align: center;
-
-    background: color-mix(in srgb, ${cssVar.colorError} 12%, transparent);
-  `,
-  chevron: css`
-    flex: none;
-    transition: transform 160ms ease;
-
-    &[data-expanded='false'] {
-      transform: rotate(-90deg);
+export const styles = createStaticStyles(({ css, cssVar, responsive }) => {
+  // Fades out at once on collapse, but waits on expand until the width has room for the text.
+  const railFade = `
+    transition: opacity 120ms ease 80ms;
+
+    [data-collapsed='true'] & {
+      opacity: 0;
+      transition-delay: 0s;
     }
-  `,
-  indicator: css`
-    display: flex;
-    flex: none;
-    align-items: center;
-    justify-content: center;
 
-    width: 18px;
-    height: 18px;
-    margin-inline-start: -6px;
+    @media (prefers-reduced-motion: reduce) {
+      transition: none;
+    }
+  `;
 
-    color: ${cssVar.colorTextDescription};
+  return {
+    badge: css`
+      flex: none;
 
-    transition: transform 160ms ease;
+      min-inline-size: 20px;
+      padding-inline: 6px;
+      border-radius: 999px;
 
-    &[data-expanded='true'] {
-      transform: rotate(90deg);
-    }
-  `,
-  dot: css`
-    position: absolute;
-    inset-block-start: 7px;
-    inset-inline-end: 9px;
-
-    inline-size: 7px;
-    block-size: 7px;
-    border-radius: 999px;
-
-    background: ${cssVar.colorError};
-  `,
-  group: css`
-    display: flex;
-    flex-direction: column;
-    margin-block-start: 12px;
-
-    &[data-level='0'][data-icon='true'] {
-      margin-block-start: 2px;
-    }
+      font-size: ${cssVar.fontSizeSM};
+      font-variant-numeric: tabular-nums;
+      color: ${cssVar.colorError};
+      text-align: center;
 
-    &:not([data-level='0']) {
-      margin-block-start: 6px;
-    }
-  `,
-  groupHeader: css`
-    cursor: pointer;
-
-    display: flex;
-    gap: 8px;
-    align-items: center;
-    justify-content: space-between;
-
-    min-block-size: 32px;
-    padding-inline: 10px;
-    border: none;
-    border-radius: ${cssVar.borderRadius};
-
-    font-size: ${cssVar.fontSizeSM};
-    font-weight: 500;
-    color: ${cssVar.colorTextSecondary};
-    text-align: start;
-
-    background: none;
-
-    &:hover,
-    &[data-active='true'] {
-      color: ${cssVar.colorText};
-    }
+      background: color-mix(in srgb, ${cssVar.colorError} 12%, transparent);
 
-    &[data-icon='true'] {
-      gap: 12px;
-      justify-content: flex-start;
-      min-block-size: 36px;
-      font-size: ${cssVar.fontSize};
-    }
+      ${railFade}
+    `,
+    chevron: css`
+      flex: none;
+      transition:
+        transform 160ms ease,
+        opacity 120ms ease 80ms;
 
-    &[data-level='0'][data-icon='true']:hover {
-      background: ${cssVar.colorFillTertiary};
-    }
+      &[data-expanded='false'] {
+        transform: rotate(-90deg);
+      }
 
-    /* Nested groups read as quiet subheadings with the indicator right after the label. */
-    &:not([data-level='0']) {
-      gap: 8px;
-      justify-content: flex-start;
+      [data-collapsed='true'] & {
+        opacity: 0;
+        transition-delay: 0s;
+      }
+
+      @media (prefers-reduced-motion: reduce) {
+        transition: none;
+      }
+    `,
+    indicator: css`
+      display: flex;
+      flex: none;
+      align-items: center;
+      justify-content: center;
 
-      min-block-size: 26px;
+      width: 18px;
+      height: 18px;
+      margin-inline-start: -6px;
 
-      font-size: ${cssVar.fontSizeSM};
-      font-weight: 400;
       color: ${cssVar.colorTextDescription};
 
-      > [data-label] {
-        flex: 0 1 auto;
+      transition: transform 160ms ease;
+
+      &[data-expanded='true'] {
+        transform: rotate(90deg);
       }
+    `,
+    dot: css`
+      position: absolute;
+      inset-block-start: 7px;
+      inset-inline-end: 9px;
 
-      &:hover,
-      &[data-active='true'] {
-        color: ${cssVar.colorTextSecondary};
+      inline-size: 7px;
+      block-size: 7px;
+      border-radius: 999px;
+
+      opacity: 0;
+      background: ${cssVar.colorError};
+
+      transition: opacity 120ms ease;
+
+      [data-collapsed='true'] & {
+        opacity: 1;
       }
-    }
 
-    &[data-indent='1'] {
-      padding-inline-start: 38px;
-    }
+      @media (prefers-reduced-motion: reduce) {
+        transition: none;
+      }
+    `,
+    fold: css`
+      display: grid;
+      grid-template-rows: 1fr;
+      transition:
+        grid-template-rows 200ms ease,
+        margin 200ms ease,
+        opacity 120ms ease;
+
+      > div {
+        overflow: hidden;
+        min-block-size: 0;
+      }
 
- 
```

**File**: `src/dashboard/ConsoleShell/ConsoleBrand.tsx` (modified, +1/-3)
```diff
@@ -6,8 +6,7 @@ import type { ConsoleBrandProps } from './type';
 
 function ConsoleBrand({ href = '/', label, logo, renderLink, title }: ConsoleBrandProps) {
   const shell = useConsoleShellState();
-  const collapsed = shell?.collapsed ?? false;
-  const lockup =
+  const content =
     title == null || title === false || title === '' ? (
       logo
     ) : (
@@ -16,7 +15,6 @@ function ConsoleBrand({ href = '/', label, logo, renderLink, title }: ConsoleBra
         <span className={styles.brandName}>{title}</span>
       </span>
     );
-  const content = collapsed ? logo : lockup;
   const linkProps = {
     'aria-label': label ?? (typeof title === 'string' ? title : 'Home'),
     'children': content,
```

---

### Incident Patch 7: `8d88a976` (2026-09-27)
**Commit Message**: 🐛 fix(base-ui): give the outlined Segmented indicator a visible fill

**File**: `src/base-ui/Segmented/style.ts` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ export const styles = createStaticStyles(({ css, cssVar }) => {
     transition-duration: 240ms;
     transition-property: inset-inline-start, inset-block-start, width, height;
 
+    [data-variant='outlined'] > & {
+      background: ${cssVar.colorFillSecondary};
+    }
+
     [data-orientation='horizontal'] &:dir(rtl) {
       inset-inline-start: var(--active-item-right);
     }
```

---

### Incident Patch 8: `0a684c8f` (2026-09-26)
**Commit Message**: 🐛 fix(base-ui): let Spin inherit color and center its glyph (#674)

**File**: `src/base-ui/Spin/Spin.tsx` (modified, +6/-2)
```diff
@@ -85,7 +85,9 @@ const Spin = memo<SpinProps>(
           style={style}
           {...rest}
         >
-          <span aria-hidden>{glyph}</span>
+          <span aria-hidden className={styles.glyphBox}>
+            {glyph}
+          </span>
         </div>
       );
     }
@@ -94,7 +96,9 @@ const Spin = memo<SpinProps>(
       <div className={cx(styles.wrapper, className)} ref={ref} style={style} {...rest}>
         {children}
         <div aria-busy aria-live="polite" className={styles.overlay} role="status">
-          <span aria-hidden>{glyph}</span>
+          <span aria-hidden className={styles.glyphBox}>
+            {glyph}
+          </span>
           {tip && <span className={styles.tip}>{tip}</span>}
         </div>
       </div>
```

**File**: `src/base-ui/Spin/style.ts` (modified, +4/-2)
```diff
@@ -49,12 +49,13 @@ const reducedMotion = `
 export const styles = createStaticStyles(({ css, cssVar }) => ({
   glyph: css`
     display: inline-flex;
-    color: ${cssVar.colorTextSecondary};
+  `,
+  glyphBox: css`
+    display: inline-flex;
   `,
   network: css`
     position: relative;
     display: inline-block;
-    color: ${cssVar.colorTextSecondary};
   `,
   networkBox: css`
     position: absolute;
@@ -156,6 +157,7 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
   root: css`
     display: inline-flex;
     align-items: center;
+    color: ${cssVar.colorTextSecondary};
   `,
   tip: css`
     font-size: ${cssVar.fontSizeSM};
```

---

### Incident Patch 9: `2dacc817` (2026-09-26)
**Commit Message**: 🐛 fix(base-ui): fit circle Progress label inside the ring and restore Result visual weight (#673)

- Progress (circle): size the centered label from the diameter (antd formula: d * 0.15 + 6) in the body font instead of a fixed 16px monospace, so '62.5%' no longer overflows a 56px ring.
- Result: size any svg in the icon slot like the built-in status icons, so custom icons are no longer tiny; let block children in extra (Alert, Flexbox) span the full width as in antd.
- Result: raise visual weight (72px badge, 36px icon, 20px title).

**File**: `src/base-ui/Progress/Progress.tsx` (modified, +4/-1)
```diff
@@ -114,7 +114,10 @@ const Progress = memo<ProgressProps>(
             />
           </svg>
           {showInfo && diameter >= 40 && (
-            <span className={styles.circleInfo} style={{ fontSize: diameter <= 40 ? 12 : 16 }}>
+            <span
+              className={styles.circleInfo}
+              style={{ fontSize: Math.round(diameter * 0.15 + 6) }}
+            >
               {info}
             </span>
           )}
```

**File**: `src/base-ui/Progress/__tests__/Progress.test.tsx` (modified, +12/-0)
```diff
@@ -123,6 +123,18 @@ describe('Progress', () => {
     expect(screen.getByText('62%')).toBeTruthy();
   });
 
+  test.each([
+    [40, '12px'],
+    [56, '14px'],
+    [120, '24px'],
+  ])('scales the centered info with a %ipx circle so it stays inside the ring', (size, font) => {
+    render(
+      <Progress format={(v) => `${v.toFixed(1)}%`} percent={62.5} size={size} type="circle" />,
+    );
+
+    expect(screen.getByText('62.5%').style.fontSize).toBe(font);
+  });
+
   test('exposes progressbar aria attributes on the circle type', () => {
     render(<Progress percent={33} type="circle" />);
 
```

**File**: `src/base-ui/Progress/style.ts` (modified, +3/-1)
```diff
@@ -41,9 +41,11 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
   `,
   circleInfo: css`
     position: absolute;
-    font-family: ${cssVar.fontFamilyCode};
+
     font-variant-numeric: tabular-nums;
+    line-height: 1;
     color: ${cssVar.colorText};
+    white-space: nowrap;
   `,
   circleRoot: css`
     position: relative;
```

**File**: `src/base-ui/Result/Result.tsx` (modified, +4/-4)
```diff
@@ -8,10 +8,10 @@ import { statusColor, styles } from './style';
 import type { ResultProps } from './type';
 
 const statusIcon = {
-  error: <X size={28} strokeWidth={2.5} />,
-  info: <Info size={28} strokeWidth={2} />,
-  success: <Check size={28} strokeWidth={2.5} />,
-  warning: <TriangleAlert size={28} strokeWidth={2} />,
+  error: <X size={36} strokeWidth={2.5} />,
+  info: <Info size={36} strokeWidth={2} />,
+  success: <Check size={36} strokeWidth={2.5} />,
+  warning: <TriangleAlert size={36} strokeWidth={2} />,
 };
 
 const Result = memo<ResultProps>(
```

**File**: `src/base-ui/Result/style.ts` (modified, +15/-4)
```diff
@@ -3,22 +3,33 @@ import { createStaticStyles, cssVar } from 'antd-style';
 export const styles = createStaticStyles(({ css, cssVar }) => ({
   extra: css`
     display: flex;
+    flex-wrap: wrap;
     gap: 8px;
     align-items: center;
+    align-self: stretch;
     justify-content: center;
 
     margin-block-start: 10px;
+
+    > :is(div, section, form) {
+      flex: 1 1 100%;
+    }
   `,
   icon: css`
     display: flex;
     flex-shrink: 0;
     align-items: center;
     justify-content: center;
 
-    width: 56px;
-    height: 56px;
-    margin-block-end: 8px;
+    width: 72px;
+    height: 72px;
+    margin-block-end: 12px;
     border-radius: 50%;
+
+    svg {
+      width: 36px;
+      height: 36px;
+    }
   `,
   root: css`
     display: flex;
@@ -39,7 +50,7 @@ export const styles = createStaticStyles(({ css, cssVar }) => ({
   `,
   title: css`
     margin: 0;
-    font-size: 16px;
+    font-size: 20px;
     font-weight: 600;
     text-wrap: balance;
   `,
```

---

### Incident Patch 10: `f2861d09` (2026-09-26)
**Commit Message**: ✨ feat(base-ui): Spin, Progress, Badge, Result, Pagination, Upload and antd-free Empty (#660)

* ✨ feat(base-ui): add Spin

* ✨ feat(base-ui): add Progress

* 🐛 fix(base-ui): add progressbar aria to Progress

* ✨ feat(base-ui): add Badge

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* 🐛 fix(base-ui): scope Badge style prop to root

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* ✨ feat(base-ui): add Result

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* 🐛 fix(base-ui): restore Result stack spacing

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* ♻️ refactor(ui): rewrite Empty without antd, add variants

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* 📝 docs(ui): fix Empty docs, keyboard support for dashed variant

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* ✨ feat(base-ui): add Pagination

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* 🐛 fix(base-ui): notify onChange when Pagination clamps current

Claude-Session: https://claude.ai/code/session_01SnPUiLfRXgaeBU3jSRZXHc

* 🐛 fix(base-

**File**: `compatibility.json` (modified, +0/-21)
```diff
@@ -2640,18 +2640,6 @@
       "pathname": "/components/motion-provider",
       "source": "src/MotionProvider/demos/lazy-motion.tsx"
     },
-    {
-      "document": "src/NeuralNetworkLoading/index.mdx",
-      "legacyId": "src-neural-network-loading-demo-demos",
-      "legacyRouteId": "components/NeuralNetworkLoading/index",
-      "options": {
-        "inline": false,
-        "isolated": false,
-        "layout": "default"
-      },
-      "pathname": "/components/neural-network-loading",
-      "source": "src/NeuralNetworkLoading/demos/index.tsx"
-    },
     {
       "document": "src/ScrollArea/index.mdx",
       "legacyId": "src-scroll-area-demo-background",
@@ -7000,15 +6988,6 @@
       "source": "src/MotionProvider/index.mdx",
       "title": "MotionProvider"
     },
-    {
-      "category": "Feedback",
-      "description": "An animated SVG loading indicator depicting a neural network — pulsing nodes connected across layers, particles flowing through the connections, and a slowly rotating outer ring. Suitable for \"AI is thinking / preparing\" empty states.",
-      "legacyRouteId": "components/NeuralNetworkLoading/index",
-      "pathname": "/components/neural-network-loading",
-      "section": "Components",
-      "source": "src/NeuralNetworkLoading/index.mdx",
-      "title": "NeuralNetworkLoading"
-    },
     {
       "category": "Layout",
       "description": "A native scroll container with custom scrollbars and gradient scroll fade.",
```

**File**: `src/Empty/Empty.test.tsx` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import { cleanup, fireEvent, render, screen } from '@testing-library/react';
+import { Package } from 'lucide-react';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+
+import Empty from './Empty';
+
+describe('Empty', () => {
+  afterEach(cleanup);
+
+  it('renders nothing above the title when no icon/emoji/image is given', () => {
+    const { container } = render(<Empty title="No data" />);
+
+    expect(container.querySelector('svg')).toBeNull();
+    expect(container.querySelector('img')).toBeNull();
+    expect(screen.getByText('No data')).toBeTruthy();
+  });
+
+  it('renders the given icon for the default variant', () => {
+    const { container } = render(<Empty icon={Package} title="No data" />);
+
+    expect(container.querySelector('svg')).toBeTruthy();
+  });
+
+  it('image takes precedence over emoji and icon', () => {
+    render(
+      <Empty
+        emoji="📭"
+        icon={Package}
+        image={<span data-testid="custom-image" />}
+        title="No data"
+      />,
+    );
+
+    expect(screen.getByTestId('custom-image')).toBeTruthy();
+  });
+
+  it('emoji takes precedence over icon', () => {
+    const { container } = render(<Empty emoji="📭" icon={Package} title="No data" />);
+
+    expect(screen.getByAltText('📭')).toBeTruthy();
+    expect(container.querySelector('svg')).toBeNull();
+  });
+
+  it('renders a default Plus icon only for the clickable dashed variant', () => {
+    const { container: withoutClick } = render(<Empty title="No skills yet" variant="dashed" />);
+    const { container: withClick } = render(
+      <Empty title="No skills yet" variant="dashed" onClick={() => {}} />,
+    );
+
+    expect(withoutClick.querySelector('svg')).toBeNull();
+    expect(withClick.querySelector('svg')).toBeTruthy();
+  });
+
+  it('only applies the pointer cursor on the dashed variant when onClick is passed', () => {
+    const { container: withoutClick } = render(<Empty title="No skills yet" variant="dashed" />);
+    const { container: withClick } = render(
+      <Empty title="No skills yet" variant="dashed" onClick={() => {}} />,
+    );
+
+    expect(getComputedStyle(withoutClick.firstChild as Element).cursor).not.toBe('pointer');
+    expect(getComputedStyle(withClick.firstChild as Element).cursor).toBe('pointer');
+  });
+
+  it('fires onClick on the dashed variant', () => {
+    const onClick = vi.fn();
+    const { container } = render(
+      <Empty title="No skills yet" variant="dashed" onClick={onClick} />,
+    );
+
+    fireEvent.click(container.firstChild as Element);
+
+    expect(onClick).toHaveBeenCalledTimes(1);
+  });
+
+  it('exposes button semantics and fires onClick on Enter/Space for the clickable dashed variant', () => {
+    const onClick = vi.fn();
+    const { container } = render(
+      <Empty title="No skills yet" variant="dashed" onClick={onClick} />,
+    );
+
+    const root = container.firstChild as HTMLElement;
+
+    expect(root.getAttribute('role')).toBe('button');
+    expect(root.getAttribute('tabindex')).toBe('0');
+
+    fireEvent.keyDown(root, { key: 'Enter' });
+    fireEvent.keyDown(root, { key: ' ' });
+    fireEvent.keyDown(root, { key: 'a' });
+
+    expect(onClick).toHaveBeenCalledTimes(2);
+  });
+
+  it('renders a row layout with a left icon for type="page"', () => {
+    render(
+      <Empty
+        description="Upload documents to get started."
+        icon={Package}
+        title="No files in this project"
+        type="page"
+      />,
+    );
+
+    expect(screen.getByText('No files in this project')).toBeTruthy();
+    expect(screen.getByText('Upload documents to get started.')).toBeTruthy();
+  });
+
+  it('applies align to the row container for type="page"', () => {
+    const { container } = render(
+      <Empty align="center" title="No files in this project" type="page" />,
+    );
+
+    expect(getComputedStyle(container.firstElementChild as Element).alignItems).toBe('center');
+  });
+
+  it('renders the action inside the text block for type="page"', () => {
+    render(
+      <Empty
+        action={<button type="button">Upload files</button>}
+        title="No files in this project"
+        type="page"
+      />,
+    );
+
+    expect(screen.getByText('Upload files')).toBeTruthy();
+  });
+
+  it('renders the action for the default type', () => {
+    render(<Empty action={<button type="button">Retry</button>} title="No data" />);
+
+    expect(screen.getByText('Retry')).toBeTruthy();
+  });
+
+  it('renders children and forwards className', () => {
+    const { container } = render(
+      <Empty className="custom" title="No data">
+        <div>Details</div>
+      </Empty>,
+    );
+
+    expect(screen.getByText('Details')).toBeTruthy();
+    expect(container.firstChild).toHaveProperty('className', expect.stringContaining('custom'));
+  });
+
+  it('sets the displayName', () => {
+    expect(Empty.displayName).toBe('Empty');
+  });
+});
```

**File**: `src/Empty/Empty.tsx` (modified, +144/-93)
```diff
@@ -1,109 +1,160 @@
 'use client';
 
-import { Empty as AntEmpty } from 'antd';
-import { cssVar, useThemeMode } from 'antd-style';
-import { type FC } from 'react';
+import { cssVar, cx } from 'antd-style';
+import { Plus } from 'lucide-react';
+import { type KeyboardEvent, memo, useMemo } from 'react';
 
-import Block from '@/Block';
-import { Flexbox } from '@/Flex';
 import FluentEmoji from '@/FluentEmoji';
 import Icon from '@/Icon';
 import Text from '@/Text';
 
+import { styles } from './style';
 import type { EmptyProps } from './type';
 
-const Empty: FC<EmptyProps> = ({
-  title,
-  description,
-  icon,
-  image,
-  emoji,
-  imageSize = 48,
-  iconColor,
-  action,
-  children,
-  imageProps,
-  align,
-  actionProps,
-  type = 'default',
-  titleProps,
-  descriptionProps,
-  ...rest
-}) => {
-  const { isDarkMode } = useThemeMode();
-  const isPage = type === 'page';
-  const alignValue = align || (isPage ? 'flex-start' : 'center');
-  const isCenter = alignValue === 'center';
-
-  const fallbackImage = AntEmpty.PRESENTED_IMAGE_SIMPLE;
-  const hasImage = image || emoji || icon;
-  const cover = hasImage ? (
-    image ? (
-      image
-    ) : (
-      <Block
-        align={'center'}
-        flex={'none'}
-        height={imageSize}
-        justify="center"
-        variant={'outlined'}
-        width={imageSize}
-        {...imageProps}
+const Empty = memo<EmptyProps>(
+  ({
+    title,
+    description,
+    icon,
+    iconColor,
+    emoji,
+    image,
+    imageSize = 48,
+    action,
+    actionProps,
+    titleProps,
+    descriptionProps,
+    align,
+    imageProps,
+    children,
+    type = 'default',
+    variant = 'default',
+    className,
+    onClick,
+    ref,
+    style,
+    ...rest
+  }) => {
+    const isPage = type === 'page';
+    const alignValue = align || (isPage ? 'flex-start' : 'center');
+    const isCenter = alignValue === 'center';
+
+    const isClickable = !isPage && variant === 'dashed' && !!onClick;
+    const resolvedIcon = icon ?? (isClickable ? Plus : undefined);
+
+    const iconSize = isPage ? 36 : variant === 'dashed' ? 20 : 32;
+
+    const cover = useMemo(() => {
+      if (image) return image;
+      if (emoji) return <FluentEmoji emoji={emoji} size={imageSize} type={'anim'} />;
+      if (!resolvedIcon) return null;
+
+      return (
+        <Icon
+          color={iconColor}
+          icon={resolvedIcon}
+          size={{ size: iconSize, strokeWidth: isPage ? 1.25 : 2 }}
+        />
+      );
+    }, [image, emoji, imageSize, resolvedIcon, isPage, iconColor, iconSize]);
+
+    const rootClassName = cx(
+      isPage ? styles.rootPage : styles.root,
+      !isPage && variant === 'dashed' && styles.dashed,
+      isClickable && styles.dashedClickable,
+      className,
+    );
+
+    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
+      if (!isClickable) return;
+      if (event.key !== 'Enter' && event.key !== ' ') return;
+
+      event.preventDefault();
+      (onClick as (event: unknown) => void)?.(event);
+    };
+
+    const rootStyle: EmptyProps['style'] = {
+      color:
+        !isPage && variant === 'dashed' ? cssVar.colorTextTertiary : cssVar.colorTextQuaternary,
+      ...style,
+    };
+
+    const titleNode = title && (
+      <Text
+        align={isCenter ? 'center' : undefined}
+        color={cssVar.colorText}
+        fontSize={isPage ? 18 : 14}
+        weight={isPage ? 600 : 500}
         style={{
-          marginBottom: 4,
-          ...imageProps?.style,
+          marginBottom: isPage ? 4 : 0,
+          marginTop: isPage ? 0 : variant === 'dashed' ? 6 : 8,
         }}
+        {...titleProps}
       >
-        {icon && (
-          <Icon
-            icon={icon}
-            size={imageSize * 0.66}
-            color={
-              iconColor || (isDarkMode ? cssVar.colorTextQuaternary : cssVar.colorTextSecondary)
-            }
-          />
-        )}
-        {emoji && <FluentEmoji emoji={emoji} size={imageSize * 0.75} type={'anim'} />}
-      </Block>
-    )
-  ) : (
-    fallbackImage
-  );
-
-  return (
-    <Flexbox align={alignValue} gap={8} padding={16} {...rest}>
-      {cover}
-      <Flexbox align={alignValue} gap={isPage ? 4 : 1}>
-        {title && (
-          <Text
-            align={isCenter ? 'center' : undefined}
-            fontSize={isPage ? 24 : 16}
-            weight={'bold'}
-            {...titleProps}
-          >
-            {title}
-          </Text>
-        )}
-        {description && (
-          <Text
-            align={isCenter ? 'center' : undefined}
-            color={isPage ? cssVar.colorTextSecondary : cssVar.colorTextDescription}
-            fontSize={isPage ? 16 : 14}
-            {...descriptionProps}
-          >
-            {description}
-          </Text>
+        {title}
+      </Text>
+    );
+
+    const descriptionNode = description && (
+      <Text
+        align={isCenter ? 'center' : undefined}
+        color={cssVar.colorTextTertiary}
+  
```

**File**: `src/Empty/demos/Dashed.tsx` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import { Empty } from '@lobehub/ui';
+
+export default () => (
+  <Empty
+    description="Drop a .skill file or create one from a template."
+    title="No skills yet"
+    variant="dashed"
+    onClick={() => {}}
+  />
+);
```

**File**: `src/Empty/demos/Page.tsx` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import { Button, Empty } from '@lobehub/ui';
+import { FolderOpen } from 'lucide-react';
+
+export default () => (
+  <Empty
+    description="Upload documents, images or code and they'll be indexed for the agent automatically."
+    icon={FolderOpen}
+    title="No files in this project"
+    type="page"
+    action={
+      <>
+        <Button type="primary">Upload files</Button>
+        <Button>Connect a folder</Button>
+      </>
+    }
+  />
+);
```

**File**: `src/Empty/demos/index.tsx` (modified, +6/-1)
```diff
@@ -9,7 +9,7 @@ export default () => {
       description: 'There is no data to display',
       emoji: '📭',
       icon: {
-        options: [Inbox, Package],
+        options: { Inbox, Package },
         value: Inbox,
       },
       iconType: {
@@ -28,6 +28,10 @@ export default () => {
         options: ['default', 'page'],
         value: 'default',
       },
+      variant: {
+        options: ['default', 'dashed'],
+        value: 'default',
+      },
     },
     { store },
   );
@@ -37,6 +41,7 @@ export default () => {
     imageSize: control.imageSize,
     title: control.title,
     type: control.type,
+    variant: control.variant,
   } as EmptyProps;
 
   if (control.iconType === 'icon') {
```

**File**: `src/Empty/index.mdx` (modified, +12/-2)
```diff
@@ -1,13 +1,15 @@
 ---
 title: Empty
-description: Empty component displays an empty state with customizable icon, emoji, image, title, description, and action buttons. It's commonly used to indicate that there's no data or content to display.
+description: Empty component displays an empty state with customizable icon, emoji, image, title, description, and action buttons, in default and dashed variants. It's commonly used to indicate that there's no data or content to display.
 category: Data Display
 ---
 
 import DemoIndex from './demos/index.tsx?demo';
 import DemoWithIcon from './demos/WithIcon.tsx?demo';
 import DemoWithEmoji from './demos/WithEmoji.tsx?demo';
 import DemoWithAction from './demos/WithAction.tsx?demo';
+import DemoDashed from './demos/Dashed.tsx?demo';
+import DemoPage from './demos/Page.tsx?demo';
 
 ## Default
 
@@ -25,10 +27,18 @@ import DemoWithAction from './demos/WithAction.tsx?demo';
 
 <Demo of={DemoWithAction} layout="bare" />
 
+## Dashed
+
+<Demo of={DemoDashed} layout="bare" />
+
+## Page
+
+<Demo of={DemoPage} layout="bare" />
+
 ## APIs
 
 ### Empty
 
 <Api name="Empty" migrationKey="heading:%5B%22Empty%22%5D:0" />
 
-> Empty component inherits all properties from [Flexbox](https://github.com/ant-design/react-layout-kit)
+`Empty` renders a native `<div>`. All standard div HTML attributes including `onClick`, `aria-*`, `data-*`, `style`, and `ref` are forwarded to the root element.
```

**File**: `src/Empty/style.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { createStaticStyles } from 'antd-style';
+
+export const styles = createStaticStyles(({ css, cssVar }) => ({
+  action: css`
+    margin-block-start: 8px;
+  `,
+  dashed: css`
+    padding-block: 24px;
+    padding-inline: 16px;
+    border: 1px dashed ${cssVar.colorBorder};
+    border-radius: ${cssVar.borderRadiusLG};
+  `,
+  dashedClickable: css`
+    cursor: pointer;
+    transition:
+      border-color 0.15s,
+      background 0.15s;
+
+    &:hover {
+      border-color: ${cssVar.colorTextTertiary};
+      background: ${cssVar.colorFillQuaternary};
+    }
+  `,
+  extraPage: css`
+    display: flex;
+    gap: 8px;
+    margin-block-start: 14px;
+  `,
+  root: css`
+    display: flex;
+    flex-direction: column;
+    gap: 4px;
+    align-items: center;
+
+    padding-block: 16px;
+    padding-inline: 8px;
+  `,
+  rootPage: css`
+    display: flex;
+    gap: 20px;
+    align-items: flex-start;
+    padding: 8px;
+  `,
+}));
```

---

### Incident Patch 11: `4f736cb1` (2026-09-24)
**Commit Message**: 🐛 fix(markdown): sanitize allowed raw HTML (#672)

**File**: `package.json` (modified, +1/-0)
```diff
@@ -217,6 +217,7 @@
     "react-zoom-pan-pinch": "^4.0.3",
     "rehype-github-alerts": "^4.2.0",
     "rehype-raw": "^7.0.0",
+    "rehype-sanitize": "^6.0.0",
     "remark-breaks": "^4.0.0",
     "remark-cjk-friendly": "^2.3.1",
     "remark-gfm": "^4.0.1",
```

**File**: `src/Markdown/SyntaxMarkdown/MarkdownRender.test.tsx` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import { render, screen } from '@testing-library/react';
+import { describe, expect, it } from 'vitest';
+
+import { MarkdownProvider } from '../components/MarkdownProvider';
+import MarkdownRender from './MarkdownRender';
+import StreamdownRender from './StreamdownRender';
+
+const content = `**Markdown text** and <em>safe HTML</em>
+
+<iframe srcdoc="<p>embedded document</p>"></iframe>
+<object data="https://example.com/file"></object>
+<embed src="https://example.com/file">
+<base href="https://example.com/">`;
+
+describe.each([
+  ['standard', MarkdownRender],
+  ['streaming', StreamdownRender],
+] as const)('%s Markdown rendering', (_, Renderer) => {
+  it('keeps formatting while removing unsafe raw HTML', async () => {
+    const { container } = render(
+      <MarkdownProvider allowHtml enableLatex={false}>
+        <Renderer>{content}</Renderer>
+      </MarkdownProvider>,
+    );
+
+    expect(await screen.findByText('safe HTML')).toHaveProperty('tagName', 'EM');
+    expect(container.querySelector('strong')?.textContent).toBe('Markdown text');
+    expect(document.querySelector('iframe, object, embed, base')).toBeNull();
+  });
+
+  it('preserves mathematical expressions when raw HTML is enabled', async () => {
+    const { container } = render(
+      <MarkdownProvider allowHtml enableLatex>
+        <Renderer>{'$a^2$'}</Renderer>
+      </MarkdownProvider>,
+    );
+
+    expect(container.querySelector('.katex')).not.toBeNull();
+  });
+});
```

**File**: `src/Markdown/type.ts` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ export interface TypographyProps extends DivProps {
 export type { StreamAnimationGranularity, StreamSmoothingPreset };
 
 export interface SyntaxMarkdownProps {
+  /** Parse and render sanitized inline HTML in Markdown content. */
   allowHtml?: boolean;
   allowHtmlList?: ElementType[];
   animated?: boolean;
```

**File**: `src/hooks/useMarkdown/useMarkdownRehypePlugins.ts` (modified, +3/-0)
```diff
@@ -3,6 +3,7 @@
 import { useMemo } from 'react';
 import { rehypeGithubAlerts } from 'rehype-github-alerts';
 import rehypeRaw from 'rehype-raw';
+import rehypeSanitize from 'rehype-sanitize';
 import type { Pluggable } from 'unified';
 
 import { useMarkdownContext } from '@/Markdown/components/MarkdownProvider';
@@ -24,6 +25,8 @@ export const useMarkdownRehypePlugins = (): Pluggable[] => {
     () =>
       [
         allowHtml && rehypeRaw,
+        // Parse untrusted HTML into nodes, then remove unsafe elements and attributes.
+        allowHtml && rehypeSanitize,
         enableGithubAlert && rehypeGithubAlerts,
         enableLatex && rehypeKatex,
         enableLatex && rehypeKatexDir,
```

---

### Incident Patch 12: `abe2263b` (2026-09-23)
**Commit Message**: 🐛 fix(docs-kit): drop leftover Geist font resources

The docs site no longer loads Geist, so remove the registry preconnect, the stale head assertion, and the leftover font names.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `packages/docs-kit/site/root.test.ts` (modified, +0/-17)
```diff
@@ -2,23 +2,6 @@ import { expect, it } from 'vitest';
 
 import { links } from './root';
 
-const GEIST_FONT_STYLESHEET =
-  'https://registry.npmmirror.com/@lobehub/webfont-geist/1.0.0/files/css/index.css';
-const GEIST_MONO_FONT_STYLESHEET =
-  'https://registry.npmmirror.com/@lobehub/webfont-geist-mono/1.0.0/files/css/index.css';
-
-it('publishes the exact Geist font resources in the document head', async () => {
-  const descriptors = await links();
-
-  expect(descriptors).toEqual(
-    expect.arrayContaining([
-      { crossOrigin: 'anonymous', href: 'https://registry.npmmirror.com', rel: 'preconnect' },
-      { href: GEIST_FONT_STYLESHEET, rel: 'stylesheet' },
-      { href: GEIST_MONO_FONT_STYLESHEET, rel: 'stylesheet' },
-    ]),
-  );
-});
-
 it('publishes favicon link tags for browsers and Apple devices', async () => {
   const descriptors = await links();
 
```

**File**: `packages/docs-kit/site/root.tsx` (modified, +0/-3)
```diff
@@ -7,8 +7,6 @@ import { SiteProviders } from './app/providers/SiteProviders';
 import { ThemeBootstrap } from './app/providers/ThemeBootstrap';
 import { styles } from './styles/globalStyles';
 
-const FONT_REGISTRY_ORIGIN = 'https://registry.npmmirror.com';
-
 const DEFAULT_FAVICONS: Record<string, string> = {
   appleTouchIcon: '/apple-touch-icon.png',
   icon: '/favicon.ico',
@@ -20,7 +18,6 @@ export const links: LinksFunction = () => {
   const favicons = { ...DEFAULT_FAVICONS, ...siteConfig.favicons };
 
   return [
-    { crossOrigin: 'anonymous', href: FONT_REGISTRY_ORIGIN, rel: 'preconnect' },
     { href: favicons.icon, rel: 'icon', sizes: 'any' },
     { href: favicons.icon16, rel: 'icon', sizes: '16x16', type: 'image/png' },
     { href: favicons.icon32, rel: 'icon', sizes: '32x32', type: 'image/png' },
```

**File**: `packages/docs-kit/site/styles/globalStyles.ts` (modified, +3/-4)
```diff
@@ -10,9 +10,8 @@ injectGlobal`
     --docs-radius-lg: 0.75rem;
     --docs-radius-md: 0.5rem;
     --docs-radius-sm: 0.375rem;
-    --docs-font-sans:
-      'Geist', 'SF Pro Text', 'SF Pro Display', Inter, ui-sans-serif, system-ui, sans-serif;
-    --docs-font-mono: 'Geist Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
+    --docs-font-sans: 'SF Pro Text', 'SF Pro Display', Inter, ui-sans-serif, system-ui, sans-serif;
+    --docs-font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
     --docs-background: #ffffff;
     --docs-surface-raised: #ffffff;
     --docs-surface-muted: #f7f7f8;
@@ -95,7 +94,7 @@ injectGlobal`
     color: var(--docs-text-primary);
     background-color: var(--docs-background);
     font-family: var(--docs-font-sans);
-    font-feature-settings: 'kern', 'cv01';
+    font-feature-settings: 'kern';
     font-kerning: normal;
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
```

---

### Incident Patch 13: `4d09fea0` (2026-09-23)
**Commit Message**: ✨ feat(ui): add landing and dashboard kits and rebuild docs chrome

* ✨ feat(ui): add landing and dashboard kits and rebuild docs chrome

Ship reusable landing sections and a console dashboard namespace, and move the docs site onto DocsShell with generated agent documents.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 💄 style(docs): collapse the brand to the logo and restyle nested nav

Show the LobeHub combine lockup while the docs sidebar is open, and only the mark on the icon rail. Nested ConsoleNav groups use a play indicator beside the label.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 🐛 fix(docs): keep scrolling inside the shell and console nav

Lock the viewport so the docs shell, demos, and console nav scroll in their own containers, and track headings against that scroll root.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 💄 style(awesome): lighten landing cards and drop the hero gradient

Use a thinner elevated wash on landing surfaces, let the page own the hero background, and set section titles to bold.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 💄 style(awesome): set the hero title weight to bolder

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 💄 style(awesome):

**File**: `.agents/skills/building-landing-home/SKILL.md` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+---
+name: building-landing-home
+description: >
+  Compose a product or documentation home page from the @lobehub/ui/awesome landing components:
+  LandingHero, AgentSkillCard, LogoMarquee, LandingSection, BentoGrid/BentoCard, CodeShowcase,
+  FeatureGrid, InstallBanner and FluidGradient. Covers page structure, the lobedocs homePage
+  hook, router links, theming the accent gradient, and a review checklist. Trigger on build a
+  home page, landing page, docs home, marketing page, hero section, redesign home, lobedocs
+  homePage, 首页, 落地页, 官网首页.
+---
+
+# Building a landing home with @lobehub/ui/awesome
+
+Every band of a landing page has a component. Your job is to choose the bands, write honest copy
+and render real product UI inside them, not to restyle containers.
+
+## Components
+
+All components import from `@lobehub/ui/awesome`. Read each one's page before using a prop you
+have not seen here: `https://ui.lobehub.com/skills/components/awesome/<kebab-name>.md`.
+
+| Band                    | Component                 | Use it for                                                                                                         |
+| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
+| Opening                 | `LandingHero`             | Badge, title with gradient `accent`, description, up to two `actions`, optional `aside` column.                    |
+| Beside the hero text    | `AgentSkillCard`          | "I'm an Agent / I'm a Human" card: a prompt for coding agents and an install command for people.                   |
+| Under the hero          | `LogoMarquee`             | Integrations or supported providers. Icons from `@lobehub/icons`.                                                  |
+| Any middle band         | `LandingSection`          | Tag, title and description on the left, small `actions` on the right, content below. Wrap every middle band in it. |
+| Live component gallery  | `BentoGrid` + `BentoCard` | Tiles that render real components; `colSpan`/`rowSpan` for emphasis; `href` to the docs page.                      |
+| Code next to its result | `CodeShowcase`            | Two to four short snippets, each with a live `preview`.                                                            |
+| Reasons to choose       | `FeatureGrid`             | Three or six cards of icon, title and one-sentence description.                                                    |
+| Closing call to action  | `InstallBanner`           | Title, copyable install command, footnote with license and a docs link.                                            |
+| Background texture      | `FluidGradient`           | Place it behind a positioned band when you want a texture. Needs a positioned parent.                              |
+
+## Page structure
+
+Default order. Drop a band rather than filling it with filler.
+
+1. `LandingHero` with `aside={<AgentSkillCard />}` and `children={<LogoMarquee />}`.
+2. `LandingSection` + `BentoGrid`: the widest, most visual proof.
+3. `LandingSection` + `CodeShowcase`: how little code it takes.
+4. `LandingSection` + `FeatureGrid`: foundations such as theming, i18n, performance.
+5. `InstallBanner`.
+
+```tsx
+import {
+  AgentSkillCard,
+  InstallBanner,
+  LandingHero,
+  LandingSection,
+  LogoMarquee,
+} from '@lobehub/ui/awesome';
+import { ArrowRight } from 'lucide-react';
+
+export default function Home() {
+  return (
+    <>
+      <LandingHero
+        accent="UI Kit"
+        actions={[
+          {
+            href: '/docs',
+            icon: ArrowRight,
+            iconPlacement: 'end',
+            label: 'Get Started',
+            primary: true,
+          },
+          { href: 'https://github.com/acme/kit', label: 'GitHub' },
+        ]}
+        aside={
+          <AgentSkillCard
+            agent={{
+              code: 'Read https://kit.acme.dev/skills.md and follow it to build UI with @acme/kit.',
+              description: 'Send this prompt to your agent to pick the right components',
+            }}
+            human={{
+              code: 'npx skills add acme/kit',
+              description: 'Install the skills into your project',
+            }}
+          />
+        }
+        description="One sentence on what it is and who it is for."
+        title="Acme"
+      >
+        <LogoMarquee items={[/* { icon: OpenAI, label: 'OpenAI' } */]} />
+      </LandingHero>
+
+      <LandingSection
+        actions={[{ href: '/components', label: 'Browse components' }]}
+        eyebrow="Components"
+        id="home-gallery"
+        title="Built for AI interfaces"
+      >
+        {/* BentoGrid of live tiles */}
+      </LandingSection>
+
+      <InstallBanner
+        command="pnpm add @acme/kit"
+        footnote="Open source · MIT license"
+        title="Start building"
+      />
+    </>
+  );
+}
+```
+
+#
```

**File**: `.agents/skills/building-with-lobe-ui/SKILL.md` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+---
+name: building-with-lobe-ui
+description: >
+  Build UI with the LobeHub design ecosystem — @lobehub/ui (plus its base-ui, chat, mobile,
+  awesome, brand, mdx, i18n namespaces), @lobehub/icons, @lobehub/charts, @lobehub/fluent-emoji
+  and @lobehub/streamdown. Covers provider setup, component selection and semantics, design
+  tokens via cssVar, craft rules against AI-generated blandness, and a six-dimension acceptance
+  check. Trigger on lobe-ui, lobehub, LobeChat UI, AIGC app UI, build a page / component /
+  chat interface / dashboard with lobe-ui, pick a lobe-ui component, lobe-ui theme or tokens,
+  组件选择, 设计准则.
+---
+
+# 用 lobe-ui 构建界面
+
+这份 skill 让「用 lobe-ui 写界面」从碰运气变成可控：把组件语义、视觉取值、工艺标准和验收机制显式化，在生成的每一步介入，而不是在最后靠一条 prompt 补救。
+
+模型见过的界面远多于任何设计师，问题不是能力不够，而是需求含糊时它会收敛到训练数据里最高频、最稳妥的那一类结果——统一无衬线字体、紫蓝渐变、四平八稳的等大卡片。通用、安全，而这正是平庸的根源。下面每一步都在对抗这个倾向。
+
+## 与其他 skill 的分工
+
+| 关注                                 | 归属                                  |
+| ------------------------------------ | ------------------------------------- |
+| 这个界面该是什么、为什么             | 上游的产品设计判断，不在本 skill 范围 |
+| 用哪个组件、取哪个 token、算不算合格 | **本 skill**                          |
+| 浏览器里真实跑起来的证据             | 本仓库的 `local-testing` skill        |
+
+## 选最小运行模式
+
+不要每次都把六份文件全读一遍。先定这次要交付什么：
+
+| 模式       | 终点                             | 需要读                                                 |
+| ---------- | -------------------------------- | ------------------------------------------------------ |
+| **选组件** | 回答「这个信息该用哪个组件」     | 硬性前提 + [components.md](references/components.md)   |
+| **取值**   | 写出一段符合系统的 `style.ts`    | 硬性前提 + [design.md](references/design.md)           |
+| **建界面** | 一个完整页面或组件，含非理想状态 | 全流程五步 + 全部 references                           |
+| **审查**   | 判断已有界面能不能放行           | [evaluator.md](references/evaluator.md) + 被命中的规则 |
+
+窄问题只读相关那一份，并说明检查范围。
+
+## 硬性前提：搞对这三件事，否则全是白工
+
+**一、`@lobehub/ui/base-ui` 是当前的规范命名空间。** 顶层的 `Button`、`Modal`、`Select`、`Tabs`、`Text`、`Tag`、`Avatar`、`ActionIcon`、`Segmented`、`Skeleton`、`Dropdown` 等 27 个经典组件已标记 `@deprecated`，它们是 antd 包装层。新代码一律从 `@lobehub/ui/base-ui` 导入，`@lobehub/ui/eslint` 会强制这条规则。完整清单见 [components.md](references/components.md) 的 C-01。
+
+**二、样式只写 `createStaticStyles` + `cssVar`。** `createStyles` 已被 eslint 禁用。仓库里约 170 个 `style.ts` 全部是这个写法，零例外：
+
+```ts
+import { createStaticStyles } from 'antd-style';
+
+export const styles = createStaticStyles(({ css, cssVar, responsive }) => ({
+  root: css`
+    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
+    border-radius: ${cssVar.borderRadiusLG};
+
+    ${responsive.sm} {
+      padding-inline: 12px;
+    }
+  `,
+}));
+```
+
+用 `cssVar` 写的样式天然支持暗色模式，不需要任何分支。
+
+**三、Provider 顺序不能颠倒，motion 必须显式传入。**
+
+```tsx
+import { ConfigProvider, ThemeProvider } from '@lobehub/ui';
+import { zhCn } from '@lobehub/ui/i18n';
+import { motion } from 'motion/react';
+
+<ConfigProvider locale="zh-CN" motion={motion} resources={zhCn}>
+  <ThemeProvider>
+    <App />
+  </ThemeProvider>
+</ConfigProvider>;
+```
+
+`ConfigProvider` 必须在外层：`ThemeProvider` 渲染 antd 的 `App`（承载静态 `notification` / `modal` 持有者）并读取 CDN 配置加载 webfont，两者都依赖上方的 context。
+
+三个容易踩的点：
+
+- `motion` 是必填的。不传会让任何用到动画的组件在 `useMotionComponent()` 处直接抛错。用 `LazyMotion` 的应用传 `m` 而不是 `motion`。
+- 组件内部文案（聊天操作、表单、EmojiPicker 等）由 `resources` 提供，可选 `en` 或 `zhCn`。**不要再套一层 `I18nProvider`**——它本身就是 `ConfigProvider` 的转发（同样要求 `motion`），嵌套等于装了两个 provider。
+- `ConfigProvider` 会为整个文档安装全局键盘焦点环，包括原生控件和 provider 子树之外的控件。所以正常情况下不需要自己写焦点样式，也绝不能用 `outline: none` 抹掉它。
+
+## 五步链路
+
+不要一上手就画界面。每一步以上一步的产出为前提，上游偏差会沿链路放大，所以约束要尽早进入、每步都检查。
+
+### 1. 规划 —— 先把模糊需求变成可执行的功能定义
+
+在写任何 JSX 之前，把需求展开成六层。写不出来的部分就是需要向用户确认的部分。
+
+```
+L1 定位与意图   一句话定义 · 目标用户 · 场景清单 · 非目标 · 行为边界
+L2 信息架构     空间区域 · 区域边界规则 · 内容生长规则
+L3 核心链路     状态清单 · 主链路 · 分支链路
+L4 组件功能     组件定位 · 功能清单 · 默认/悬停/加载/禁用/错误各态
+L5 边界条件     空态 · 加载态 · 错误态 · 权限降级
+L6 验收标准     Given/When/Then · 完成的定义
+```
+
+最容易被跳过的是 L5 和 L6。模型倾向于优先完成主流程和成功态，因为那最像一张完整截图；但真实产品里用户更常遇到加载中、无数据、无权限、失败后重试。**L5 没写，页面就会在关键时刻失去可操作性。**
+
+同时定视觉方向。如果不定，模型会先用默认视觉补位，再把这些默认选择带进后面的结构和组件里。
+
+### 2. 搭骨架 —— 决定信息以什么空间结构铺开
+
+先判断这是哪类页面，再选骨架，不要从空白页拼组件：
+
+| 场景                  | 起点                                                                                      |
+| --------------------- | ----------------------------------------------------------------------------------------- |
+| 文档 / 应用页面外壳   | `Layout` + `LayoutHeader` / `LayoutSidebar` / `LayoutMain` / `LayoutToc` / `LayoutFooter` |
+| 对话界面              | `ChatHeader` → `ChatList` → `ChatInputArea`（组合顺序见 C-04）                            |
+| 移动端外壳            | `@lobehub/ui/mobile` 的 `ChatHeader` / `ChatInputArea` / `TabBar` / `SafeArea`            |
+| 固定窄导航栏          | `SideNav`；需要可拖拽伸缩用 `DraggableSideNav`                                            |
+| 可伸缩侧栏 / 浮动面板 | `base-ui` 的 `DraggablePanel`                                                             |
+| 营销落地页            | `@lobehub/ui/awesome` 的 `Hero` / `Features` / `GridShowc
```

**File**: `.agents/skills/building-with-lobe-ui/references/components.md` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+# components.md — 组件选择
+
+物料清单只说「有什么」。这份文件说「什么时候该用，什么时候不该用」。
+
+同一个组件外观看起来相似，语义可能完全不同。选之前先判断这段信息表达的是**状态、分类、动作、容器还是导航关系**。
+
+规则可被 [evaluator.md](evaluator.md) 按编号引用。
+
+## C-01 base-ui 优先（硬性规则）
+
+`@lobehub/ui/base-ui` 是当前的规范命名空间，基于 `@base-ui/react` 1.8.0。顶层的同名组件大多是早期的 antd 包装层，已在源码里标记 `@deprecated`。
+
+**这些顶层组件不要用，改从 `@lobehub/ui/base-ui` 导入：**
+
+```
+Accordion · AccordionItem · ActionIcon · Alert · AutoComplete · Avatar · Button
+Checkbox · CheckboxGroup · Collapse · DraggablePanel · Drawer · Dropdown
+FormSubmitFooter · FormTitle · InputOPT · Modal · Radio · RadioGroup · Segmented
+Select · Skeleton · Slider · SliderWithInput · Switch · Tabs · Tag · Text · Tree
+```
+
+配套约束：
+
+- 不要从 `antd` 直接导入上面这些组件。
+- antd 的 `message` / `notification` → 用 base-ui 的 `toast`。
+- `Collapse` 在 base-ui 里对应 `Accordion`（多节可展开）或 `Collapsible`（单个可折叠区域）。
+- `Dropdown` 在 base-ui 里对应 `DropdownMenu`。
+
+在消费方项目里接上配套 eslint 配置就能自动拦住这些误用：
+
+```js
+import restrictedImports from '@lobehub/ui/eslint';
+```
+
+**等价导入：** `Popover`、`Toast`、`Tooltip`、`ScrollArea`、`DropdownMenu`、`ContextMenu` 在顶层和 `base-ui` 都能导入，指向同一份实现。统一从 `base-ui` 导入更一致。
+
+## C-02 按需求查
+
+### 表单与输入
+
+| 需要                               | 用                                                                  | 来源      |
+| ---------------------------------- | ------------------------------------------------------------------- | --------- |
+| 文本 / 多行 / 数字 / 密码 / 验证码 | `Input` · `TextArea` · `InputNumber` · `InputPassword` · `InputOTP` | `base-ui` |
+| 从固定选项里选                     | `Select`                                                            | `base-ui` |
+| 自由输入 + 建议                    | `AutoComplete`                                                      | `base-ui` |
+| 开关（立即生效的设置）             | `Switch`                                                            | `base-ui` |
+| 勾选 / 单选                        | `Checkbox` · `CheckboxGroup` · `Radio` · `RadioGroup`               | `base-ui` |
+| 区间取值                           | `Slider`，要配数字输入用 `SliderWithInput`                          | `base-ui` |
+| 结构化表单骨架                     | `Form` + `Form.Field` / `.Group` / `.Title` / `.SubmitFooter`       | `base-ui` |
+| 表单放进弹层                       | `FormModal`                                                         | 顶层      |
+| 日期 / 时间                        | `DatePicker`                                                        | 顶层      |
+| 点击就地改文字                     | `EditableText`                                                      | 顶层      |
+| 录制键盘快捷键                     | `HotkeyInput`                                                       | 顶层      |
+| 搜索框（带 spotlight 和 `mod+k`）  | `SearchBar`                                                         | 顶层      |
+| 选颜色                             | `ColorSwatches`                                                     | 顶层      |
+| 选头像 / emoji                     | `EmojiPicker`                                                       | 顶层      |
+
+### 反馈与状态
+
+| 需要                  | 用                                                                         | 注意                                   |
+| --------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
+| 一闪而过的操作结果    | `toast()`（`base-ui`，命令式）                                             | 需在应用里渲染一次 `ToastHost`         |
+| 常驻的行内提示 / 横幅 | `Alert`（`base-ui`，`variant`: `soft`/`outlined`/`plain`）                 | 不要用 Alert 做瞬时反馈                |
+| 内容加载中的占位      | `Skeleton` + `SkeletonAvatar` / `SkeletonText`（`base-ui`）                | 形状要贴近真实内容                     |
+| AI 思考中的品牌化等待 | `NeuralNetworkLoading`（顶层）                                             | 不是布局占位，别替代 Skeleton          |
+| 聊天里的输入中指示    | `LoadingDots`（`chat`，`variant`: `dots`/`pulse`/`wave`/`orbit`/`typing`） | —                                      |
+| 没有数据              | `Empty`（顶层，`type`: `default`/`page`）                                  | 必须给下一步动作，不能只写「暂无数据」 |
+| 悬停提示              | `Tooltip`（`base-ui`）                                                     | 不能放可交互内容                       |
+| 可交互的浮层内容      | `Popover`（`base-ui`，`trigger`: `hover`/`click`/`both`）                  | 要放链接或按钮就用它                   |
+
+### 覆盖层与菜单
+
+| 需要                    | 用                                                          | 真实差别                                  |
+| ----------------------- | ----------------------------------------------------------- | ----------------------------------------- |
+| 打断流程、要求关注      | `Modal`（`base-ui`；命令式 `createModal` / `confirmModal`） | 焦点锁在内部，背景对屏幕阅读器惰性        |
+| 从边缘滑入的面板        | `Drawer`（`base-ui`）                                       | 打断程度低于 Modal，可承载更多信息        |
+| 底部 / 侧边 sheet       | `FloatingSheet`（`base-ui`）                                | 移动端常替代 Modal                        |
+| 锚定在触发元素上的菜单  | `DropdownMenu`（`base-ui`）                          
```

**File**: `.agents/skills/building-with-lobe-ui/references/craft.md` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+# craft.md — 通用工艺与反 AI 味
+
+不绑定具体业务的工艺规则：排版如何形成节奏，层级如何分配注意力，反馈如何成立，动效如何承担信息，可访问性如何守住底线。
+
+规则不能停在形容词。「克制」「高级」「自然」都不可执行——下面每条都给了可检查的判据，并可被 [evaluator.md](evaluator.md) 按编号引用。
+
+## K-01 AI Slop 反模式
+
+模型在缺少约束时反复产出的模板痕迹。逐条对照，命中就改。
+
+| 层面 | 常见表现                                   | 问题本质                         | 正确做法                                     |
+| ---- | ------------------------------------------ | -------------------------------- | -------------------------------------------- |
+| 色彩 | 紫蓝渐变作为起手式，满屏强调色             | 强调色没有语义，只在套默认高级感 | 强调色只服务关键名词和主 CTA，其余走中性灰阶 |
+| 材质 | 到处 `backdrop-filter`，普通卡片也做成玻璃 | 材质没有层级职责，只是堆效果     | 玻璃态只留给浮在内容之上的语义浮层           |
+| 字体 | Inter / Roboto 起手，中文行高与标点发飘    | 默认西文体系没有照顾中文阅读     | 走主题的字体栈，中文界面不自己指定西文字体   |
+| 版式 | 一屏等大白卡、全圆角、轻阴影、emoji 当图标 | 所有模块同权重，信息没有主次     | 用层级、留白和密度区分权重；图标走图标库     |
+| 动效 | bounce / elastic 弹跳、回弹、过冲          | 动效没有信息作用，只为显得活泼   | 默认不加；每个动效都要能说出它解释了什么状态 |
+| 内容 | 「Lorem ipsum」「示例数据」「功能名称」    | 占位文案掩盖了真实信息密度       | 用贴近真实业务的示例数据，长度也要接近真实   |
+
+把模糊说法写成可检查的规则：
+
+| 模糊说法           | 写成规则后                                                                  |
+| ------------------ | --------------------------------------------------------------------------- |
+| 色彩要克制         | 一屏内品牌实色 + 品牌渐变总和 ≤ 3 处，其余全部中性灰阶                      |
+| 层级要清楚         | 任意一屏能指出唯一的主 CTA；一屏不超过一个 primary 按钮                     |
+| 加载时给个 loading | `<300ms` 不展示、`300ms–2s` 骨架屏、`>2s` 加载器 + 说明、`>10s` 超时 + 重试 |
+| 动效要自然         | UI 动画 ≤ 300ms，只动画 `transform` 和 `opacity`，且必须说明目的            |
+| 间距要舒服         | 间距取自主题的间距档位，不出现裸 px                                         |
+| 不要 AI 味         | 上面那张反模式表逐行过一遍                                                  |
+
+## K-02 排版与中文
+
+- 界面默认继承 `ThemeProvider` 注入的全局字体栈，**不要在组件里另外指定 `font-family`**。需要自定义字体时走 `ThemeProvider` 的 `customFonts` / `enableCustomFonts`，而不是在 `style.ts` 里写死。
+- 中文界面不做字母间距加宽，不用全大写标签——中文没有大小写，`text-transform: uppercase` 只会伤害西文混排部分。
+- 数字用于对比时需要等宽数字（`font-variant-numeric: tabular-nums`），否则列表里数字会跳动。价格、统计、实时刷新的指标都属于这一类。
+- 单栏正文行宽控制在 65 字符左右，宽屏必须有 `max-width`，否则眼睛找不到下一行。
+- 文本溢出用省略号截断，词边界截断优于切字符；标题、标签、描述各自需要自己的截断策略。
+
+## K-03 密度与空间
+
+- 圆角是嵌套关系：内层圆角 = 外层圆角 − padding。内外用同一个值会出现可见缝隙。
+- 组件内距和布局间距是两套档位，不要混用。卡片内部的紧凑间距不应该等于区块之间的分隔间距。
+- 层级靠信息结构和留白区分，**不靠给每块涂不同颜色**。
+- 阴影是档位而不是开关：浮层比卡片高，卡片比平面高。同一层的两个元素不应该有不同阴影。
+- 分隔线常常是「更好的间距没做到」的补偿。先试间距，再考虑分隔线。
+
+## K-04 材质与玻璃态
+
+主题提供两档模糊工艺（见 [design.md](design.md) 的 D-06），语义不同，不要当装饰用：
+
+- 弱模糊（`blur`，10px）——粘性头部、工具条这类贴着内容滚动的表面
+- 强模糊（`blurStrong`，36px）——真正浮在内容之上的面板、抽屉、命令面板
+
+普通卡片、列表项、区块一律不加模糊。模糊有渲染成本，也会削弱它在浮层上的层级含义。
+
+品牌渐变动画（`gradientAnimation`，gold → magenta → geekblue → cyan 循环）是给**品牌时刻**用的——首屏标题、升级入口、AI 生成中的强调边框。一个页面里出现两处以上就失去了意义。
+
+## K-05 状态与反馈
+
+主流程能跑只说明能展示成功结果。真实使用里更常见的是等待、失败、无权限、超时。
+
+每个数据驱动的区域都要回答四个问题：
+
+1. **没有数据**时显示什么，并且给出第一个动作——「暂无数据」终结了旅程
+2. **加载中**显示什么，按 K-01 的时长分档决定是骨架屏还是加载器
+3. **失败**时说清出了什么错、给具体恢复方式——「操作失败」什么都没说
+4. **无权限**时降级成什么，而不是直接消失
+
+破坏性和不可逆的操作需要二次确认，确认文案要写清后果。「关闭后该资产将不再受保护」比「确定吗？」承担了更多责任。用词也要准确：删除就说删除，用「清除」「重置」软化会误导。
+
+## K-06 动效
+
+- UI 过渡 ≤ 300ms。hover 反馈约 150ms 最接近原生；超过 400ms 没有反馈用户会以为坏了。
+- 只动画 `transform` 和 `opacity`，它们走 GPU 合成、不触发重排。动画 `width` / `top` / `height` 会强制重排。
+- 入场用 ease-out（到达该减速），离场用 ease-in（离开该加速）。把入场曲线反过来当出场用，看起来像倒放。
+- 列表项错峰约 40ms 有陆续到达的感觉；全部一起出现只是闪一下。
+- 动效是反馈而不是装饰：按下压缩、错误抖动、成功画勾都在解释状态。**说不出目的就删掉。**
+- 尊重 `prefers-reduced-motion`。任何明显位移都要检查这个偏好，忽略它会引发前庭不适。骨架屏的微光也算。
+
+动画必须通过 `ConfigProvider` 注入的 motion 运行时，**不要在组件里直接从 `motion` 包取组件**。库按 context 消费 motion，这样应用侧才能统一换成 `LazyMotion` 的 `m`。
+
+## K-07 可访问性底线
+
+- **焦点态不可省略。** `ConfigProvider` 默认为整个文档安装一个全局键盘焦点环，包括原生控件和 provider 子树之外的控件——所以正常情况下不需要自己写焦点样式，但也**绝不能**写 `outline: none` 把它抹掉。确实要让某个控件或区域退出全局焦点环时，用 `data-lobe-focus-ring="off"`，并自己补一个等价的键盘指示。
+- 文本输入、多行输入和可编辑区域保留自己的焦点样式，不要再叠加。
+- 对比度按 WCAG AA：正文 4.5:1，大字和 UI 组件 3:1。暗色模式下满饱和品牌色会刺眼，退 20–30% 饱和更稳。
+- **不能只用颜色表达状态。** 只靠红色边框表示错误对色盲用户不可见，必须配图标或文字。
+- 触控目标最小 44×44px，视觉元素可以比触控目标小。
+- 用对元素：`button` 自带键盘、焦点和角色，`div` 扮按钮要手动补全这些。给无可见文字的控件写 `aria-label`，描述动作而不是元素类型（用「搜索」而不是「图标」）。
+- Tab 顺序跟随 DOM 顺序，屏幕阅读器也跟 DOM 走。用 CSS 重排视觉顺序会让两者脱节。
+- 浮层打开时把焦点锁在浮层内，否则焦点会跑到背后的页面。
+
+## K-08 图表工艺
+
+图表颜色必须来自主题而不是图表库的默认序列，否则「红色」可能只是第一个系列、不代表任何业务含义。取值方式见 [ecosystem.md](ecosystem.md) 的 E-02。
+
+- 语义色要稳定映射：成功 / 增长、警告、危险 / 下降各自固定，不随系列顺序变化
+- 多系列图表用调色板的顺序色，不要手挑
+- 数字在表格和图表里右对齐并用等宽数字
+- 图表要有容器、标题和单位。一个没有说明时间窗和口径的指标不可信
+
+## K-09 信息密度按页面类型走
+
+同一种密度不适合所有页面。密度错了，页面会「像另一个品类的产品」。
+
+| 页面类型   | 密度倾向                     | 典型错误                         |
+| ---------- | ---------------------------- | -------------------------------- |
+| 品牌落地页 | 低密度、大留白、少而重的焦点 | 塞进控制台级别的信息量           |
+| 产品控制台 | 中高密度，主任务区权重最高   | 做成等大卡片墙，主任务被平摊     |
+| 对话界面   | 中密度，轮次边界清楚         | 消息块之间没有节奏，难以区分轮次 |
+| 数据看板   | 高密度但有指标层级           | 装饰大于含义，所有指标同权重     |
+| 文档页     | 中低密度，扫描优先           | 段落过长、缺锚点、代码块无语言标 |
+
+## K-10 编码陷阱
+
+- `//` 在 `antd-style` 的 css 模板里**不是注释**。它会被当成内容解析，文本里的撇号会变成未闭合字符串，提交时 stylelint 失败。用 `/* */`。
+- 写在 `:root` 上的 CSS 自定义属性会影响页面上该组件的所有实例。描述单个实例的变量要挂在这个实例自己的元
```

**File**: `.agents/skills/building-with-lobe-ui/references/design.md` (added, +234/-0)
```diff
@@ -0,0 +1,234 @@
+# design.md — 视觉事实源
+
+定义视觉系统怎么表达、怎么取值、怎么派生、怎么暴露缺口。
+
+不判断某个业务状态意味着什么（那是领域语义），也不评判一个页面用得是否克制（那是 [craft.md](craft.md)）。同一个红色，在这里只回答一件事：**它引用哪个 token**。
+
+规则可被 [evaluator.md](evaluator.md) 按编号引用。
+
+## D-01 唯一事实源是 cssVar
+
+```ts
+import { createStaticStyles } from 'antd-style';
+
+export const styles = createStaticStyles(({ css, cssVar, cx, responsive }) => ({
+  root: css`
+    padding-inline: 16px;
+    border: 1px solid ${cssVar.colorBorderSecondary};
+    border-radius: ${cssVar.borderRadiusLG};
+    background: ${cssVar.colorBgContainer};
+    color: ${cssVar.colorText};
+  `,
+}));
+```
+
+`cssVar.xxx` 输出的是 CSS 变量引用，随明暗外观自动切换。这是它比 `token.xxx` 更重要的原因：**用 cssVar 写的样式天然支持暗色模式，不需要任何分支**。
+
+`createStyles` 已被 `@lobehub/ui/eslint` 禁用，只用 `createStaticStyles`。仓库里约 170 个 `style.ts` 全是这个写法，零例外。
+
+## D-02 先判断视觉角色，再取 token
+
+把 token 当色板用（「看到蓝色就随手取一个接近的蓝」）是系统失去一致性的起点。
+
+| 角色                   | token                                                                            |
+| ---------------------- | -------------------------------------------------------------------------------- |
+| 页面底色               | `colorBgLayout`                                                                  |
+| 卡片 / 内容表面        | `colorBgContainer`                                                               |
+| 介于两者之间的表面     | `colorBgContainerSecondary`（lobe-ui 自有，二者 50% 混合）                       |
+| 浮层表面（弹窗、菜单） | `colorBgElevated`                                                                |
+| 遮罩                   | `colorBgMask`                                                                    |
+| 主文字                 | `colorText`                                                                      |
+| 次要文字               | `colorTextSecondary`                                                             |
+| 更弱的文字             | `colorTextTertiary` → 最弱 `colorTextQuaternary`                                 |
+| 描述文字               | `colorTextDescription`                                                           |
+| 边框                   | `colorBorder`，更弱 `colorBorderSecondary`                                       |
+| 填充（悬停底、轨道）   | `colorFill` > `colorFillSecondary` > `colorFillTertiary` > `colorFillQuaternary` |
+| 主 CTA / 品牌实色      | `colorPrimary`，悬停 `colorPrimaryHover`，按下 `colorPrimaryActive`              |
+| 低强度品牌强调         | `colorPrimaryBg` / `colorPrimaryFillTertiary`                                    |
+| 正文链接               | `colorLink`，悬停 `colorLinkHover`                                               |
+| 阴影                   | `boxShadow` / `boxShadowSecondary` / `boxShadowTertiary`                         |
+
+四档 `colorFill` 和四档 `colorText` 是**层级**而不是同义词。同一视觉层的两个元素不应该取不同档位。
+
+## D-03 状态色一律从基础 token 派生
+
+五组语义色，每组都有完整的角色派生。**不要为某个状态新造颜色**——没有派生机制，每个状态都会被重新发明一个值：今天按钮 hover 深一点，明天卡片 selected 浅一点，后天暗色模式又换一套。
+
+```
+color{Primary|Success|Warning|Error|Info} 各自提供：
+  {}                       实色（主色）
+  {}Hover / {}Active       交互态
+  {}Bg / {}BgHover         浅色底
+  {}Border / {}BorderHover 边框
+  {}Text / {}TextHover / {}TextActive           文字
+  {}Fill / {}FillSecondary / {}FillTertiary / {}FillQuaternary  填充档位
+```
+
+底层色阶映射（浅色模式）：`success` → green，`warning` → gold，`error` → volcano，`info` → geekblue。暗色模式下部分换阶（success → lime，error → red，info → blue），由主题自动处理，不需要介入。
+
+**已知缺口：** `colorErrorFillTertiary` 和 `colorErrorFillSecondary` 不在 `cssVar` 里。需要错误色浅底时用 `cssVar.colorErrorBg` / `cssVar.colorErrorBgHover`。
+
+## D-04 几何与排版取值
+
+| 用途     | token                                                                            |
+| -------- | -------------------------------------------------------------------------------- |
+| 圆角     | `borderRadiusXS` 4 · `borderRadiusSM` 6 · `borderRadius` 8 · `borderRadiusLG` 12 |
+| 控件高度 | `controlHeight` 36（base-ui 另有常量：small 24 / middle 32 / large 40）          |
+| 字体     | `fontFamily`（西文 → 中文 → 回退 → emoji 的完整栈）                              |
+| 等宽字体 | `fontFamilyCode`                                                                 |
+
+**没有** `borderRadiusLarge`，用 `borderRadiusLG`。
+
+圆角是嵌套关系：内层 = 外层 − padding。外层 `borderRadiusLG`（12）配 4px padding，内层取 `borderRadius`（8）。两层同值会出现可见缝隙。
+
+字体栈已由 `ThemeProvider` 的全局样式注入，包含中文字体。**不要在组件里另写 `font-family`**——这是中文行高、标点和字重失真的主要来源。
+
+## D-05 预设色阶用于「需要互相区分」的场合
+
+13 个预设色：`red` `volcano` `orange` `gold` `yellow` `lime` `green` `cyan` `blue` `geekblue` `purple` `magenta` `gray`。
+
+每个色提供：
+
+```
+{color}1 … {color}11      实色色阶
+{color}1A … {color}11A    带透明度的色阶
+{color}Fill / FillSecondary / FillTertiary / FillQuaternary
+{color}Bg / {color}BgHover
+{color}Border / {color}BorderSecondary / {color}BorderHover
+{color}                   主色
+{color}Hover / {color}Active
+{color}Text / {color}TextHover / {color}TextActive
+```
+
+例如 `cssVar.geekblueText`、`cssVar.redFillTertiary`、`cssVar.gray7`。
+
+这些用于**需要多个互相区分的颜色**：图表系列、分类标签、多维度对比。单个元素的主次强调走 `colorPrimary` 和中性灰阶，不要从预设色里随手挑一个。
+
+原始色阶数据也可直接取：
+
+```ts
+import { colorScales,
```

**File**: `.agents/skills/building-with-lobe-ui/references/ecosystem.md` (added, +224/-0)
```diff
@@ -0,0 +1,224 @@
+# ecosystem.md — 生态包
+
+界面里的模型徽标、图表、emoji 和流式 markdown 不要自己造，也不要随手引第三方。这些都有生态包覆盖，并且已经接入同一套主题。
+
+## 安装清单
+
+`lobe-bench` 是一个实际在跑的消费方应用，它的依赖组合是这套生态的可信参考：
+
+```jsonc
+{
+  "@lobehub/ui": "^5.47.1",
+  "@lobehub/icons": "^5.18.0",
+  "@lobehub/charts": "^5.5.1",
+  "@lobehub/fluent-emoji": "^4.1.1",
+  "antd": "^6.6.4",
+  "antd-style": "^4.1.0",
+  "motion": "^13.4.0",
+  "react": "^19.3.0",
+  "react-dom": "^19.3.0",
+}
+```
+
+`@lobehub/icons` 和 `@lobehub/fluent-emoji` 是 `@lobehub/ui` 的 **peerDependency**——不装它们，`Avatar`、`FluentEmoji`、`EmojiPicker` 会在运行时失败。
+
+两处已知的宽松/过时 peer 声明，按上面的实际组合装即可，不要被声明误导：
+
+- `@lobehub/ui` 的 peer 写 `motion ^12.0.0`，实际应用跑在 `^13.4.0`。
+- `@lobehub/charts` 的 peer 写 `@lobehub/ui ^4.3.3`，实际配的是 v5。
+
+`@lobehub/icons` 和 `@lobehub/ui` 互为 peer（都要求对方 `^5.0.0`），必须同时安装。
+
+## E-01 `@lobehub/charts` —— 图表
+
+基于 **recharts**。单一入口，没有 exports map：
+
+```ts
+import { LineChart, useThemeColorRange } from '@lobehub/charts';
+```
+
+Next.js 里需要 `transpilePackages: ['@lobehub/charts']`。
+
+**必须渲染在 `ThemeProvider` 内部。** 包本身不提供主题，轴标签、网格线、填充都靠 `antd-style` 的 context 取 `cssVar`。
+
+### 选哪个图表
+
+| 需要                   | 用                                                              |
+| ---------------------- | --------------------------------------------------------------- |
+| 时间趋势、多系列       | `LineChart` / `AreaChart`（`AreaChart` 可 `stack`）             |
+| 类别对比               | `BarChart`（`layout`: `vertical`/`horizontal`，可 `stack`）     |
+| 柱 + 线、双 Y 轴       | `ComposedChart`                                                 |
+| 占比 / 构成            | `DonutChart`（`variant`: `donut`/`pie`）                        |
+| 阶段转化 / 流失        | `FunnelChart`（`calculateFrom`: `first`/`previous`）            |
+| X 与 Y 的相关性        | `ScatterChart`（可用 `size` 做气泡）                            |
+| 多维度画像             | `RadarChart`                                                    |
+| 模型榜单               | `BenchmarkRankingChart`（横向）/ `BenchmarkColumnChart`（纵向） |
+| 准确率 ± 误差          | `AccuracyBarChart`                                              |
+| 日活跃度方格图         | `Heatmaps`                                                      |
+| 行内微型趋势           | `SparkLineChart` / `SparkAreaChart` / `SparkBarChart`           |
+| 简单排名条             | `BarList`（支持每项 `href`）                                    |
+| 单值 KPI / 进度 / 增减 | `ProgressBar` / `DeltaBar` / `MarkerBar` / `CategoryBar`        |
+| 状态 / 可用性条带      | `Tracker`                                                       |
+
+### 共享 props
+
+笛卡尔类图表共用 `BaseChartProps`，核心是这几个：
+
+```tsx
+<LineChart
+  categories={['SolarPanels', 'Inverters']} // 要画哪些系列
+  data={data} // 数据数组
+  index="date" // 横轴取哪个字段
+  valueFormatter={(n) => `$${n.toLocaleString()}`}
+  onValueChange={(v) => console.log(v)}
+/>
+```
+
+其余常用开关：`colors`、`showLegend`、`showTooltip`、`showGridLines`、`showXAxis` / `showYAxis`、`loading`、`noDataText`、`customTooltip`、`height` / `width`、`yAxisWidth`、`autoMinValue`、`minValue` / `maxValue`、`stack`。
+
+`loading` 和 `noDataText` 是内建的——**不要自己在外面包一层加载和空态**，图表已经处理了（对应 [craft.md](craft.md) 的 K-05）。
+
+**三个图表不走这套 `categories` + `index` 约定**，照抄会直接报错或画不出来：
+
+| 图表            | 取数据的字段                                                    |
+| --------------- | --------------------------------------------------------------- |
+| `ScatterChart`  | `x` · `y` · `category`（单数），气泡大小用 `size` + `sizeRange` |
+| `DonutChart`    | `index`（默认 `'name'`）+ `category`（单数，默认 `'value'`）    |
+| `ComposedChart` | `series: { key, type: 'bar'\|'line', axis: 'left'\|'right' }[]` |
+
+`BenchmarkRankingChart` / `BenchmarkColumnChart` 又是另一套：字段名通过 `valueKey` / `errorKey` / `iconKey` / `providerKey` 等「key 映射 props」指定，默认读 `name` / `score` / `error`。
+
+### E-02 图表颜色必须走主题
+
+不传 `colors` 时，多数图表默认取 `useThemeColorRange()`，顺序是：
+
+```
+geekblue · gold · green · cyan · purple · red · volcano · gray
+再接各色的 7 号阶
+```
+
+要自定义时从主题取值，**不要手写 hex**：
+
+```tsx
+import { useTheme } from 'antd-style';
+
+const theme = useTheme();
+
+<LineChart colors={[theme.purple, theme.cyan]} categories={[...]} data={data} index="date" />;
+```
+
+三条约束：
+
+- `colors` 收的是**解析后的颜色值**，不接受 `"geekblue"` 这类 token 名字符串。
+- `Heatmaps` 的 `colors` 必须是真实颜色值而不是 `cssVar` 字符串——它内部用 `chroma.valid()` 校验。
+- 业务语义色要**稳定映射**：成功/增长、警告、危险/下降各自固定，不能随系列顺序漂移。否则「红色」可能只是第一个系列，不代表任何含义，用户无法信任这个颜色。
+
+暗色模式没有专门的 prop，跟随 `ThemeProvider`。`Heatmaps` 和 `DonutChart` 内部会按 `isDarkMode` 换阶。
+
+### 已知坑
+
+- `BenchmarkRankingChart` / `BenchmarkColumnChart` **不自带图标和品牌色**，要由调用方传入（配合 E-03）。`highlighted: true` 只强调文字，不改柱子填充。
+- `AccuracyBarChart` 的 `colorScheme`、`thresholds`、`showLeftValue` 在类型里有但**未实现**，不要依赖。
+- `ComposedChart` 在数据区间很窄时（例如 80–95% 的成功率）recharts 默认的 `[0, auto]` 会把差异压平，需要显式给 `yAxisLeft.domain` / `yAxisRight.domain`。
+- `FunnelChart` 用 `calculateFrom: 'previous'` 时要把 `showArrow` 设为 `false`。
+- `Heatmaps` 的 `maxLevel` 从 0 开始计（0 = 无活动），默认 4 表示 5 个档位。
+
+## E-03 `@lobehub/icons` —— AI 模型与厂商徽标
+
+约 340 个品牌（72 个模型、136 个厂商、132 个应用），**只有 AI 相关品牌徽标，不是通
```

**File**: `.agents/skills/building-with-lobe-ui/references/evaluator.md` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+# evaluator.md — 验收契约
+
+判断「这一版能不能交付」。不打印象分：先定页面类型，再逐维度找证据，最后决定放行还是回流。
+
+## 硬性规则：只评已交付的界面
+
+评估器只看**已经渲染出来的产物**。不要读自己刚才的规划、注释、TODO，或者「后面会接真实数据」的说明——那些不替当前产物补交付。
+
+同样，仓库自己的自动化闸门（`lint` / `type-check` / 单测 / 构建通过）**不是验收项**。它们是上线的前置条件，通过就一行话带过；把它们列成检查项只会埋掉真正需要人眼判断的那两三条。
+
+## 第一步：定页面类型
+
+权重取决于页面承担什么任务。同样是 UI，失败方式不同。
+
+| 页面类型      | 主任务                   | 典型失败方式                       |
+| ------------- | ------------------------ | ---------------------------------- |
+| 品牌落地页    | 把注意力转成兴趣与信任   | 通用模板、品牌记忆弱、承诺含混     |
+| 产品控制台    | 帮用户安全完成操作任务   | 主任务不清、状态断裂、信息密而无用 |
+| 对话界面      | 帮用户提问、判断、恢复   | 轮次状态不清、回答无依据、缺少恢复 |
+| 数据看板      | 帮用户判断状态并诊断变化 | 装饰大于含义、指标层级弱           |
+| 文档 / 内容页 | 帮用户找到并应用知识     | 难扫描、结构弱、声明无证据         |
+
+## 第二步：按权重评六个维度
+
+| 维度     | 评审关注                                               | 落地页 | 控制台 | 对话 | 看板 | 文档 |
+| -------- | ------------------------------------------------------ | ------ | ------ | ---- | ---- | ---- |
+| 产品意图 | 价值主张、目标用户、主任务、CTA 是否匹配真实目标       | 20%    | 22%    | 18%  | 18%  | 18%  |
+| 业务可信 | 术语、数据声明、权限、AI 置信与证据是否可信            | 12%    | 18%    | 22%  | 22%  | 22%  |
+| 信息架构 | 层级、分组、顺序、密度、节奏是否服务扫描和决策         | 18%    | 22%    | 16%  | 24%  | 28%  |
+| 交互就绪 | 控件是否可理解，动作是否有反馈，关键路径是否可完成恢复 | 10%    | 16%    | 24%  | 12%  | 10%  |
+| 系统工艺 | 字体、间距、圆角、组件、状态是否像一套系统             | 15%    | 14%    | 12%  | 16%  | 14%  |
+| 视觉品牌 | 色彩、字重、图像、动效是否形成适合品类的表达           | 25%    | 8%     | 8%   | 8%   | 8%   |
+
+每个维度拆成检查项，逐项给 2 / 1 / 0：
+
+| 分值 | 判定            | 含义                          |
+| ---- | --------------- | ----------------------------- |
+| 2    | pass            | 基本满足，只需轻微修整        |
+| 1    | partial         | 部分满足，弱点已经影响质量    |
+| 0    | fail / critical | 不满足；critical 进入阻断判断 |
+
+**先写检查项的证据和扣分原因，再聚合维度分。** 不能先定分数再补解释。
+
+## 第三步：按规则归因
+
+看到问题不要停在「不好看」。必须说明它违反了哪条规则，这决定了下一轮改哪里。
+
+| 检查发现                             | 表层判断     | 归因                                 |
+| ------------------------------------ | ------------ | ------------------------------------ |
+| 主流程能跑，空态 / 加载 / 错误态缺失 | 交互不完整   | [craft.md](craft.md) K-05            |
+| 页面像通用 SaaS，不像这个产品        | 没有个性     | 规划阶段的业务语义与领域约束         |
+| 蓝紫渐变、等大卡片网格、无意义动效   | 有 AI 味     | [craft.md](craft.md) K-01            |
+| 落地页效果被搬进控制台内页           | 品类错位     | [components.md](components.md) C-06  |
+| 写了裸 hex、裸 rgba                  | 代码不规范   | [design.md](design.md) D-01 / D-10.1 |
+| 状态色是新造的，不在派生体系里       | 颜色失控     | [design.md](design.md) D-03          |
+| 自己写边框背景而不用 variant         | 重复造工艺   | [design.md](design.md) D-06          |
+| 组件里写了 `font-family`             | 中文排版失真 | [craft.md](craft.md) K-02            |
+| Badge / Tag、Modal / Drawer 语义混用 | 组件选错     | [components.md](components.md) C-03  |
+| 用了已废弃的顶层组件                 | 命名空间错   | [components.md](components.md) C-01  |
+| `outline: none` 抹掉焦点环           | 可访问性破坏 | [craft.md](craft.md) K-07            |
+| 动效是弹跳 / 过冲 / 超过 300ms       | 动效失控     | [craft.md](craft.md) K-06            |
+| 图表颜色与主题脱节、随手指定 hex     | 图表不像系统 | [ecosystem.md](ecosystem.md) E-02    |
+| 所有指标同权重、密度不对             | 版式不对     | [craft.md](craft.md) K-09            |
+| 页面结构像卡片墙，不像看板           | 骨架错       | 骨架阶段的结构选择                   |
+
+## 阻断问题
+
+以下问题不能被平均分抹平。命中任意一条，这一版不放行，无论总分多少。
+
+| 阻断项           | 含义                                      |
+| ---------------- | ----------------------------------------- |
+| 主任务不明       | 用户看不出这一页要做什么                  |
+| 渲染阻塞         | 横向溢出、文字裁切、内容不可读            |
+| 主路径断裂       | 关键任务走不通，或中途出现死胡同          |
+| 控件与状态脱节   | 选中对象、详情面板、反馈状态互不响应      |
+| 对话流断裂       | 轮次状态、依据或恢复机制缺失              |
+| AI 回答不可信    | 缺少证据、引用、置信度或不确定性表达      |
+| 通用模板产出     | 这个页面可以属于任何产品                  |
+| 设计系统不一致   | 字体、间距、圆角、组件语法不稳定          |
+| 硬编码绕过 token | 代码里出现裸 hex 或裸 rgba                |
+| 焦点态被删       | 出现 `outline: none` 且没有等价的键盘指示 |
+| 证据缺失         | 维度分没有可审计的检查项，或没有真实截图  |
+
+## 证据要求
+
+**只读代码不算评估。** 确定性问题必须由浏览器给出事实。本仓库的 `local-testing` skill 定义了完整流程；最小证据集是：
+
+| 证据层   | 要拿到什么                                        |
+| -------- | ------------------------------------------------- |
+| 截图     | 桌面视口的真实渲染，明暗两种外观各一张            |
+| 结构     | 关键区域是否存在、层级是否与视觉一致              |
+| 行为     | 点击主操作后有无 console error、有无可见反馈      |
+| 运行健康 | 无 hydration 警告、无未捕获异常、无失败的模块加载 |
+
+**DOM 里存在不等于用户看得到。** 标题可能被背景吃掉，楼层可能在截图里出现空洞。两类证据互相校正——DOM 说页面里有什么，截图说用户实际看到什么，点击说动作是否真的发生。
+
+不要编造证据。没拿到就写没拿到，不要用「应该是正常的」代替一次截图。
+
+## 放行策略按阶段区分
+
+同一个问题在不同阶段严重度不同。质量分始终来自六个维度，变的只是哪些问题构成阻断。
+
+| 阶段     | 阈值 | 策略                                                         |
+| -------- | ---- | ------------------------------------------------------------ |
+| 方向探索 | 7.5  | 先看意图、信息架构、品牌表达；缺真实数据只作提示             |
+| 原型演示 | 8.0  | 不要求真实后端，但主路径要有可见的模拟状态；交互问题影响通过 |
+| 交付验收 | 8.0  | 要求真实数据路径、导航与关键状态；占位路径构成阻断           |
+
+## 输出格式
+
+不通过时不要产出一长串愿望清单。压缩到最影响放行的少数问题：
+
+```
+放行结论：未通过（8.0 阈值 / 原型评审）
+六维度：产品意图 1.6 · 业务可信 1.4 · 信息架构 1.8 · 交互就绪 0.9 · 系统工艺 1.7 · 视觉品牌 1.5
+
+阻断项：控件与状态脱
```

**File**: `.agents/skills/using-docs-kit/SKILL.md` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+---
+name: using-docs-kit
+description: >
+  Set up and author a documentation site with @lobehub/docs-kit (the `lobedocs` CLI, React Router
+  + Vite static docs used by ui.lobehub.com). Covers consumer repo layout, docs.config.ts,
+  package scripts, component doc pages (index.mdx frontmatter, `?demo` imports, <Demo>, <Api>),
+  guide pages, home page, changelog, and the build-time validations that reject bad docs.
+  Trigger on docs-kit, lobedocs, defineDocsConfig, docs.config.ts, migrate from dumi, write
+  component docs, add a demo, <Demo>, <Api>, index.mdx, 文档站, 写文档, 组件文档, 迁移 dumi.
+---
+
+# Using @lobehub/docs-kit
+
+The consumer repo holds **only content + `docs.config.ts`**. The kit owns Vite and React Router
+config; do not add `vite.config.ts` or `react-router.config.ts` unless overriding (see
+[reference/config.md](reference/config.md)).
+
+lobe-ui itself is the reference consumer: `docs.config.ts`, `docs/`, `src/*/index.mdx`,
+`src/*/demos/`.
+
+## 1. Repo layout
+
+```
+<repo>/
+├── docs.config.ts          # defineDocsConfig({...}) — required
+├── package.json            # lobedocs scripts
+├── docs/
+│   ├── index.mdx           # "/" — required (frontmatter feeds SEO even with a custom homePage)
+│   ├── changelog.mdx       # "/changelog" — optional; else root CHANGELOG.md is used
+│   └── home/home.tsx       # optional custom landing page (config.homePage)
+├── src/
+│   └── Button/
+│       ├── index.ts        # barrel export — <Api> resolves props through it
+│       ├── Button.tsx
+│       ├── type.ts         # props with JSDoc
+│       ├── index.mdx       # -> /components/button
+│       └── demos/
+│           ├── index.tsx   # default-export component
+│           └── Variant.tsx
+├── public/                 # static assets served at "/" (favicons, og images)
+└── CHANGELOG.md
+```
+
+Hard rules the compiler enforces:
+
+- Only files named **`index.mdx`** under an `atomDirs` root become component pages
+  (`index.md` and `README.md` are ignored).
+- Demo files must live under **`src/**/demos/**`** — standalone `/~demos/:id` routes and
+  `isolated` demos are globbed from that path only.
+- Other `docs/**/*.mdx` files are **not** discovered unless listed in `publicDocs`.
+
+## 2. Install and scripts
+
+```bash
+pnpm add -D @lobehub/docs-kit @react-router/dev@8.2.0 react-router@8.2.0 vite@8.1.4 tsx
+pnpm add react react-dom # ^19
+```
+
+```json
+{
+  "scripts": {
+    "docs:dev": "lobedocs dev",
+    "docs:build": "lobedocs build",
+    "postinstall": "lobedocs typegen"
+  }
+}
+```
+
+`lobedocs build` writes the static site to `dist/` (Pagefind search, sitemap, `/llms.txt`,
+`/skills.md` are generated automatically). Node >= 22.22.
+
+## 3. Minimal `docs.config.ts`
+
+```ts
+export default {
+  atomDirs: [{ dir: 'src' }],
+  title: 'Lobe Editor',
+  description: 'One sentence describing the library.',
+  siteUrl: 'https://editor.lobehub.com',
+  alias: { '@': 'src', '@lobehub/editor': 'src' }, // let demos import the package from source
+  themeConfig: {
+    apiHeader: {
+      packageName: '@lobehub/editor', // defaults to @lobehub/ui — always set it
+      github: 'https://github.com/lobehub/lobe-editor',
+    },
+    socialLinks: [
+      { href: 'https://github.com/lobehub/lobe-editor', icon: 'github', label: 'GitHub' },
+    ],
+  },
+};
+```
+
+> The package's only stable JS entry is `@lobehub/docs-kit/react-router-config`; there is no
+> root export for `defineDocsConfig`. It is an identity function, so export a plain object.
+> (lobe-ui imports it from `./packages/docs-kit/src/config` only because it is the workspace.)
+
+**Restart `lobedocs dev` after editing `docs.config.ts`** — config is cached per process.
+
+All fields (multiple `atomDirs`, `subType`, `homePage`, `publicDocs`, `navItems`, giscus,
+analytics, `legacyRedirects`) are in [reference/config.md](reference/config.md).
+
+## 4. Writing a component page (`src/<Name>/index.mdx`)
+
+Template:
+
+```mdx
+---
+title: Button
+description: Button triggers an action. Supports variants, sizes, loading and icon slots.
+category: General
+order: -1
+---
+
+import Basic from './demos/index.tsx?demo';
+import Variants from './demos/Variant.tsx?demo';
+
+## Introduction
+
+One or two paragraphs: what it is, when to use it, when to use something else.
+
+## Basic Usage
+
+<Demo of={Basic} title="Basic usage" layout="bare" />
+
+## Variants
+
+Explain the dimension first, then show it.
+
+<Demo of={Variants} title="Variants" />
+
+## API
+
+<Api name="Button" />
+
+Additionally, Button supports all props of antd's Button except `icon`.
+```
+
+### Frontmatter
+
+| Field         | Required        | Effect                                                                                                                        |
+| ------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
+| `title`       | yes   
```

---

### Incident Patch 14: `36d65894` (2026-09-20)
**Commit Message**: 🐛 fix(base-ui): render empty Avatar text instead of "UN" when avatar and title are missing

**File**: `src/base-ui/Avatar/Avatar.tsx` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ const Avatar = memo<AvatarProps>(
       [avatar, isStringAvatar, isUrlOrElement],
     );
 
-    const text = String(isUrlOrElement ? title : avatar);
+    const text = isUrlOrElement ? title : typeof avatar === 'string' ? avatar : undefined;
 
     const imgAlt = alt || title || 'avatar';
 
```

**File**: `src/base-ui/Avatar/__tests__/Avatar.test.tsx` (modified, +6/-0)
```diff
@@ -21,6 +21,12 @@ describe('Avatar', () => {
     expect((container.firstChild as HTMLElement).style.fontSize).toBe('24px');
   });
 
+  test('renders empty text when avatar and title are missing', () => {
+    const { container } = renderWithProvider(<Avatar />);
+
+    expect(container.textContent).toBe('');
+  });
+
   test('keeps the full text when sliceText is false', () => {
     renderWithProvider(<Avatar avatar="chat" sliceText={false} />);
 
```

---

### Incident Patch 15: `42b9235a` (2026-09-20)
**Commit Message**: 🐛 fix(base-ui): commit DraggablePanel size when pointer capture is lost mid-drag

**File**: `src/base-ui/DraggablePanel/__tests__/DraggablePanel.test.tsx` (modified, +26/-0)
```diff
@@ -89,6 +89,32 @@ describe('DraggablePanel', () => {
     );
   });
 
+  test('losing pointer capture mid-drag commits the current size instead of reverting', () => {
+    const onSizeChange = vi.fn();
+    render(
+      <DraggablePanel
+        defaultSize={{ width: 280 }}
+        maxWidth={500}
+        minWidth={200}
+        placement="left"
+        onSizeChange={onSizeChange}
+      >
+        content
+      </DraggablePanel>,
+    );
+
+    const handle = screen.getByRole('separator');
+    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
+    fireEvent.pointerMove(handle, { clientX: 60, clientY: 0, pointerId: 1 });
+    fireEvent.lostPointerCapture(handle, { pointerId: 1 });
+
+    expect(onSizeChange).toHaveBeenCalledWith(
+      { height: 0, width: 60 },
+      { height: '100%', width: 340 },
+    );
+    expect(handle.getAttribute('aria-valuenow')).toBe('340');
+  });
+
   test('arrow keys resize the panel', () => {
     const onSizeChange = vi.fn();
     render(
```

**File**: `src/base-ui/DraggablePanel/atoms.tsx` (modified, +4/-1)
```diff
@@ -300,8 +300,11 @@ export const DraggablePanelHandle = memo<DraggablePanelHandleProps>(
         onDoubleClick={() => {
           if (!draggedRef.current) controller.reset();
         }}
+        // Capture can be stolen mid-drag (another setPointerCapture, an OOPIF under the
+        // cursor) and the pointerup then never reaches us; the pointer is wherever the
+        // user last dragged it, so commit rather than snap back.
         onLostPointerCapture={() => {
-          if (draggingRef.current) controller.drag.cancel();
+          if (draggingRef.current) controller.drag.end();
           pressedRef.current = null;
           draggingRef.current = false;
         }}
```

#### Recent Merged Pull Requests:
- **PR #694** (2026-10-05): ✨ feat(form): built-in table layout for Form.List; polish InputNumber steppers (@Innei)
- **PR #692** (2026-10-05): 💄 style(docs): polish base-ui demos (@Innei)
- **PR #688** (2026-10-05): ✨ feat(form): controlled base-ui Form with an engine-agnostic API (@Innei)
- **PR #687** (2026-10-03): ✨ feat(image): add useImagePreview for custom preview triggers (@Innei)
- **PR #686** (2026-10-01): ✨ feat(chat): move chat, mobile, awesome, color and storybook subpaths off antd (@Innei)
- **PR #685** (2026-10-01): ✨ feat(eslint): ban antd and root wrappers replaced by base-ui batches 8–10 (@Innei)
- **PR #681** (2026-09-27): 🐛 fix(base-ui): render a custom Result icon without the status circle (@Innei)
- **PR #675** (2026-10-01): ✨ feat(base-ui): Table, DatePicker, ColorPicker, QRCode, Burger and more (@Innei)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
