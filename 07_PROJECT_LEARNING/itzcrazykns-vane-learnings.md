# Forensic Learning Record (Deep Inspection): ItzCrazyKns/Vane

> **Canonical Artifact**: `07_PROJECT_LEARNING/itzcrazykns-vane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:09.530Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ItzCrazyKns/Vane`
- **Description**: Vane is an AI-powered answering engine.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 37014 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/MessageRenderer/Citation.tsx`
```
const Citation = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  return (
    <a
      href={href}
      target="_blank"
      className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative"
    >
      {children}
    </a>
  );
};

export default Citation;

```

### Core Architecture Module: `src/components/MessageRenderer/CodeBlock/CodeBlockDarkTheme.ts`
```
import type { CSSProperties } from 'react';

const darkTheme = {
  'hljs-comment': {
    color: '#8b949e',
  },
  'hljs-quote': {
    color: '#8b949e',
  },
  'hljs-variable': {
    color: '#ff7b72',
  },
  'hljs-template-variable': {
    color: '#ff7b72',
  },
  'hljs-tag': {
    color: '#ff7b72',
  },
  'hljs-name': {
    color: '#ff7b72',
  },
  'hljs-selector-id': {
    color: '#ff7b72',
  },
  'hljs-selector-class': {
    color: '#ff7b72',
  },
  'hljs-regexp': {
    color: '#ff7b72',
  },
  'hljs-deletion': {
    color: '#ff7b72',
  },
  'hljs-number': {
    color: '#f2cc60',
  },
  'hljs-built_in': {
    color: '#f2cc60',
  },
  'hljs-builtin-name': {
    color: '#f2cc60',
  },
  'hljs-literal': {
    color: '#f2cc60',
  },
  'hljs-type': {
    color: '#f2cc60',
  },
  'hljs-params': {
    color: '#f2cc60',
  },
  'hljs-meta': {
    color: '#f2cc60',
  },
  'hljs-link': {
    color: '#f2cc60',
  },
  'hljs-attribute': {
    color: '#58a6ff',
  },
  'hljs-string': {
    color: '#7ee787',
  },
  'hljs-symbol': {
    color: '#7ee787',
  },
  'hljs-bullet': {
    color: '#7ee787',
  },
  'hljs-addition': {
    color: '#7ee787',
  },
  'hljs-title': {
    color: '#79c0ff',
  },
  'hljs-section': {
    color: '#79c0ff',
  },
  'hljs-keyword': {
    color: '#c297ff',
  },
  'hljs-selector-tag': {
    color: '#c297ff',
  },
  hljs: {
    display: 'block',
    overflowX: 'auto',
    background: '#0d1117',
    color: '#c9d1d9',
    padding: '0.75em',
    border: '1px solid #21262d',
    borderRadius: '10px',
  },
  'hljs-emphasis': {
    fontStyle: 'italic',
  },
  'hljs-strong': {
    fontWeight: 'bold',
  },
} satisfies Record<string, CSSProperties>;

export default darkTheme;

```

### Core Architecture Module: `src/components/MessageRenderer/CodeBlock/CodeBlockLightTheme.ts`
```
import type { CSSProperties } from 'react';

const lightTheme = {
  'hljs-comment': {
    color: '#6e7781',
  },
  'hljs-quote': {
    color: '#6e7781',
  },
  'hljs-variable': {
    color: '#d73a49',
  },
  'hljs-template-variable': {
    color: '#d73a49',
  },
  'hljs-tag': {
    color: '#d73a49',
  },
  'hljs-name': {
    color: '#d73a49',
  },
  'hljs-selector-id': {
    color: '#d73a49',
  },
  'hljs-selector-class': {
    color: '#d73a49',
  },
  'hljs-regexp': {
    color: '#d73a49',
  },
  'hljs-deletion': {
    color: '#d73a49',
  },
  'hljs-number': {
    color: '#b08800',
  },
  'hljs-built_in': {
    color: '#b08800',
  },
  'hljs-builtin-name': {
    color: '#b08800',
  },
  'hljs-literal': {
    color: '#b08800',
  },
  'hljs-type': {
    color: '#b08800',
  },
  'hljs-params': {
    color: '#b08800',
  },
  'hljs-meta': {
    color: '#b08800',
  },
  'hljs-link': {
    color: '#b08800',
  },
  'hljs-attribute': {
    color: '#0a64ae',
  },
  'hljs-string': {
    color: '#22863a',
  },
  'hljs-symbol': {
    color: '#22863a',
  },
  'hljs-bullet': {
    color: '#22863a',
  },
  'hljs-addition': {
    color: '#22863a',
  },
  'hljs-title': {
    color: '#005cc5',
  },
  'hljs-section': {
    color: '#005cc5',
  },
  'hljs-keyword': {
    color: '#6f42c1',
  },
  'hljs-selector-tag': {
    color: '#6f42c1',
  },
  hljs: {
    display: 'block',
    overflowX: 'auto',
    background: '#ffffff',
    color: '#24292f',
    padding: '0.75em',
    border: '1px solid #e8edf1',
    borderRadius: '10px',
  },
  'hljs-emphasis': {
    fontStyle: 'italic',
  },
  'hljs-strong': {
    fontWeight: 'bold',
  },
} satisfies Record<string, CSSProperties>;

export default lightTheme;

```

### Core Architecture Module: `src/components/MessageRenderer/CodeBlock/index.tsx`
```
'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';

const SyntaxHighlighterComponent =
  SyntaxHighlighter as unknown as React.ComponentType<any>;

const CodeBlock = ({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syntaxTheme = useMemo(() => {
    if (!mounted) return lightTheme;
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [mounted, resolvedTheme]);

  return (
    <div className="relative">
      <button
        className="absolute top-2 right-2 p-1"
        onClick={() => {
          navigator.clipboard.writeText(children as string);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon
            size={16}
            className="absolute top-2 right-2 text-black/70 dark:text-white/70"
          />
        ) : (
          <CopyIcon
            size={16}
            className="absolute top-2 right-2 transition duration-200 text-black/70 dark:text-white/70 hover:text-gray-800/70 hover:dark:text-gray-300/70"
          />
        )}
      </button>
      <SyntaxHighlighterComponent
        language={language}
        style={syntaxTheme}
        showInlineLineNumbers
      >
        {children as string}
      </SyntaxHighlighterComponent>
    </div>
  );
};

export default CodeBlock;

```

### Core Architecture Module: `src/components/Widgets/Renderer.tsx`
```
import React from 'react';
import { Widget } from '../ChatWindow';
import Weather from './Weather';
import Calculation from './Calculation';
import Stock from './Stock';

const Renderer = ({ widgets }: { widgets: Widget[] }) => {
  return widgets.map((widget, index) => {
    switch (widget.widgetType) {
      case 'weather':
        return (
          <Weather
            key={index}
            location={widget.params.location}
            current={widget.params.current}
            daily={widget.params.daily}
            timezone={widget.params.timezone}
          />
        );
      case 'calculation_result':
        return (
          <Calculation
            expression={widget.params.expression}
            result={widget.params.result}
            key={index}
          />
        );
      case 'stock':
        return (
          <Stock
            key={index}
            symbol={widget.params.symbol}
            shortName={widget.params.shortName}
            longName={widget.params.longName}
            exchange={widget.params.exchange}
            currency={widget.params.currency}
            marketState={widget.params.marketState}
            regularMarketPrice={widget.params.regularMarketPrice}
            regularMarketChange={widget.params.regularMarketChange}
            regularMarketChangePercent={
              widget.params.regularMarketChangePercent
            }
            regularMarketPreviousClose={
              widget.params.regularMarketPreviousClose
            }
            regularMarketOpen={widget.params.regularMarketOpen}
            regularMarketDayHigh={widget.params.regularMarketDayHigh}
            regularMarketDayLow={widget.params.regularMarketDayLow}
            regularMarketVolume={widget.params.regularMarketVolume}
            averageDailyVolume3Month={widget.params.averageDailyVolume3Month}
            marketCap={widget.params.marketCap}
            fiftyTwoWeekLow={widget.params.fiftyTwoWeekLow}
            fiftyTwoWeekHigh={widget.params.fiftyTwoWeekHigh}
            trailingPE={widget.params.trailingPE}
            forwardPE={widget.params.forwardPE}
            dividendYield={widget.params.dividendYield}
            earningsPerShare={widget.params.earningsPerShare}
            website={widget.params.website}
            postMarketPrice={widget.params.postMarketPrice}
            postMarketChange={widget.params.postMarketChange}
            postMarketChangePercent={widget.params.postMarketChangePercent}
            preMarketPrice={widget.params.preMarketPrice}
            preMarketChange={widget.params.preMarketChange}
            preMarketChangePercent={widget.params.preMarketChangePercent}
            chartData={widget.params.chartData}
            comparisonData={widget.params.comparisonData}
            error={widget.params.error}
          />
        );
      default:
        return <div key={index}>Unknown widget type: {widget.widgetType}</div>;
    }
  });
};

export default Renderer;

```

### Core Architecture Module: `src/lib/hooks/useChat.tsx`
```
'use client';

import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import crypto from 'crypto';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { MinimalProvider } from '../models/types';
import { getAutoMediaSearch } from '../config/clientRegistry';
import { applyPatch } from 'rfc6902';
import { Widget } from '@/components/ChatWindow';

export type Section = {
  message: Message;
  widgets: Widget[];
  parsedTextBlocks: string[];
  speechMessage: string;
  thinkingEnded: boolean;
  suggestions?: string[];
};

type ChatContext = {
  messages: Message[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  sources: string[];
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
  researchEnded: boolean;
  setResearchEnded: (ended: boolean) => void;
  setOptimizationMode: (mode: string) => void;
  setSources: (sources: string[]) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  key: string;
  providerId: string;
}

interface EmbeddingModelProvider {
  key: string;
  providerId: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
) => {
  try {
    let chatModelKey = localStorage.getItem('chatModelKey');
    let chatModelProviderId = localStorage.getItem('chatModelProviderId');
    let embeddingModelKey = localStorage.getItem('embeddingModelKey');
    let embeddingModelProviderId = localStorage.getItem(
      'embeddingModelProviderId',
    );

    const res = await fetch(`/api/providers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Provider fetching failed with status code ${res.status}`,
      );
    }

    const data = await res.json();
    const providers: MinimalProvider[] = data.providers;

    if (providers.length === 0) {
      throw new Error(
        'No chat model providers found, please configure them in the settings page.',
      );
    }

    const chatModelProvider =
      providers.find((p) => p.id === chatModelProviderId) ??
      providers.find((p) => p.chatModels.length > 0);

    if (!chatModelProvider) {
      throw new Error(
        'No chat models found, pleae configure them in the settings page.',
      );
    }

    chatModelProviderId = chatModelProvider.id;

    const chatModel =
      chatModelProvider.chatModels.find((m) => m.key === chatModelKey) ??
      chatModelProvider.chatModels[0];
    chatModelKey = chatModel.key;

    const embeddingModelProvider =
      providers.find((p) => p.id === embeddingModelProviderId) ??
      providers.find((p) => p.embeddingModels.length > 0);

    if (!embeddingModelProvider) {
      throw new Error(
        'No embedding models found, pleae configure them in the settings page.',
      );
    }

    embeddingModelProviderId = embeddingModelProvider.id;

    const embeddingModel =
      embeddingModelProvider.embeddingModels.find(
        (m) => m.key === embeddingModelKey,
      ) ?? embeddingModelProvider.embeddingModels[0];
    embeddingModelKey = embeddingModel.key;

    localStorage.setItem('chatModelKey', chatModelKey);
    localStorage.setItem('chatModelProviderId', chatModelProviderId);
    localStorage.setItem('embeddingModelKey', embeddingModelKey);
    localStorage.setItem('embeddingModelProviderId', embeddingModelProviderId);

    setChatModelProvider({
      key: chatModelKey,
      providerId: chatModelProviderId,
    });

    setEmbeddingModelProvider({
      key: embeddingModelKey,
      providerId: embeddingModelProviderId,
    });

    setIsConfigReady(true);
  } catch (err: any) {
    console.error('An error occurred while checking the configuration:', err);
    toast.error(err.message);
    setIsConfigReady(false);
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  chatHistory: React.MutableRefObject<[string, string][]>,
  setSources: (sources: string[]) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  const data = await res.json();

  const messages = data.messages as Message[];

  setMessages(messages);

  const history: [string, string][] = [];
  messages.forEach((msg) => {
    history.push(['human', msg.query]);

    const textBlocks = msg.responseBlocks
      .filter(
        (block): block is Block & { type: 'text' } => block.type === 'text',
      )
      .map((block) => block.data)
      .join('\n');

    if (textBlocks) {
      history.push(['assistant', textBlocks]);
    }
  });

  console.debug(new Date(), 'app:messages_loaded');

  if (messages.length > 0) {
    document.title = messages[0].query;
  }

  const files = data.chat.files.map((file: any) => {
    return {
      fileName: file.name,
      fileExtension: file.name.split('.').pop(),
      fileId: file.fileId,
    };
  });

  setFiles(files);
  setFileIds(files.map((file: File) => file.fileId));

  chatHistory.current = history;
  setSources(data.chat.sources);
  setIsMessagesLoaded(true);
};

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  sources: [],
  hasError: false,
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  embeddingModelProvider: { key: '', providerId: '' },
  researchEnded: false,
  rewrite: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setEmbeddingModelProvider: () => {},
  setResearchEnded: () => {},
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const params: { chatId: string } = useParams();

  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(params.chatId);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [researchEnded, setResearchEnded] = useState(false);

  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationMode] = useState('speed');

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      key: '',
      providerId: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      key: '',
      providerId: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const messagesRef = useRef<Message[]>([]);

  const sections = useMemo<Section[]>(() => {
    return messages.map((msg) => {
      const textBlocks: string[] = [];
      let speechMessage = '';
      let thinkingEnded = false;
      let suggestions: string[] = [];

      const sourceBlocks = msg.responseBlocks.filter(
        (block): block is Block & { type: 'source' } => block.type === 'source',
      );
      const sources = sourceBlocks.flatMap((block) => block.data);

      const widgetBlocks = msg.responseBlocks
        .filter((b) => b.type === 'widget')
        .map((b) => b.data) as Widget[];

      msg.responseBlocks.forEach((block) => {
        if (block.type === 'text') {
          let processedText = block.data;
          const citationRegex = /\[([^\]]+)\]/g;
          const regex = /\[(\d+)\]/g;

          if (processedText.includes('<think>')) {
            const openThinkTag = processedText.match(/<think>/g)?.length || 0;
            const closeThinkTag =
              processedText.match(/<\/think>/g)?.length || 0;

            if (openThinkTag && !closeThinkTag) {
              processedText += '</think> <a> </a>';
            }
          }

          if (block.data.includes('</think>')) {
            thinkingEnded = true;
          }

          if (sources.length > 0) {
            processedText = processedText.replace(
              cita
```

### Core Architecture Module: `src/lib/utils.ts`
```
import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...classes: ClassValue[]) => twMerge(clsx(...classes));

export const formatTimeDifference = (
  date1: Date | string,
  date2: Date | string,
): string => {
  date1 = new Date(date1);
  date2 = new Date(date2);

  const diffInSeconds = Math.floor(
    Math.abs(date2.getTime() - date1.getTime()) / 1000,
  );

  if (diffInSeconds < 60)
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''}`;
  else if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) !== 1 ? 's' : ''}`;
  else if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) !== 1 ? 's' : ''}`;
  else if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''}`;
  else
    return `${Math.floor(diffInSeconds / 31536000)} year${Math.floor(diffInSeconds / 31536000) !== 1 ? 's' : ''}`;
};

```

### Core Architecture Module: `src/lib/utils/computeSimilarity.ts`
```
const computeSimilarity = (x: number[], y: number[]): number => {
  if (x.length !== y.length)
    throw new Error('Vectors must be of the same length');

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < x.length; i++) {
    dotProduct += x[i] * y[i];
    normA += x[i] * x[i];
    normB += y[i] * y[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export default computeSimilarity;

```

### Core Architecture Module: `src/lib/utils/files.ts`
```
import path from 'path';
import fs from 'fs';

export const getFileDetails = (fileId: string) => {
  const fileLoc = path.join(
    process.cwd(),
    './uploads',
    fileId + '-extracted.json',
  );

  const parsedFile = JSON.parse(fs.readFileSync(fileLoc, 'utf8'));

  return {
    name: parsedFile.title,
    fileId: fileId,
  };
};

```

### Core Architecture Module: `src/lib/utils/formatHistory.ts`
```
import { ChatTurnMessage } from '../types';

const formatChatHistoryAsString = (history: ChatTurnMessage[]) => {
  return history
    .map(
      (message) =>
        `${message.role === 'assistant' ? 'AI' : 'User'}: ${message.content}`,
    )
    .join('\n');
};

export default formatChatHistoryAsString;

```

### Core Architecture Module: `src/lib/utils/hash.ts`
```
import crypto from 'crypto';

export const hashObj = (obj: { [key: string]: any }) => {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return hash;
};

```

### Core Architecture Module: `src/lib/utils/jaccardSim.ts`
```
const computeJaccardSimilarity = (a: string, b: string): number => {
  const wordsA = a.toLowerCase().split(/\W+/);
  const wordsB = b.toLowerCase().split(/\W+/);

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  if (setA.size === 0 || setB.size === 0) return 0;

  const union = setA.union(setB);
  const intersections = setA.intersection(setB);

  return intersections.size / union.size;
};

export default computeJaccardSimilarity;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1190** (2026-09-01): **[BUG] 0 search results - No results were found**
  *Symptoms*: search engines give 0 results... I tried different in the searXNG inside the full docker container. "No results were found. "  itzcrazykns1337/vane:latest vane  1.12.2 searXNG inside this docker container 2026.4.10+67af4894d  just installed the docker container today and tried to search, also verified not working over the searXNG gui inside the docker container.  My own searXNG docker container on my machine works, but this has version  2026.8.29+d226b78bc   I really wonder why is searXNG inside the vane container this old? could this be the reason?  Thanks for your support and work <3   Edit: I see it sadly just might be general searxng problems...

- **Issue #1127** (2026-08-27): **Trying to access nonexistant config.json**
  *Symptoms*: **Describe the bug** Starting up a new instance of Vane. getting the following error. ``` com.docker.swarm.node.id=... Error: An error occurred while loading instrumentation hook: ENOENT: no such file or directory, open '/app/backend/data/data/config.json' com.docker.swarm.node.id=...     at rH.initializeConfig (.next/server/chunks/68.js:48:58539) com.docker.swarm.node.id=...     at rH.initialize (.next/server/chunks/68.js:48:57886) com.docker.swarm.node.id=...     at new rH (.next/server/chunks/68.js:48:57855) com.docker.swarm.node.id=...     at 54687 (.next/server/chunks/68.js:48:61165) com.docker.swarm.node.id=...     at k (.next/server/webpack-runtime.js:1:159) com.docker.swarm.node.id=...     at async Module.d (.next/server/instrumentation.js:1:572) { com.docker.swarm.node.id=...   errno: -2, com.docker.swarm.node.id=...   code: 'ENOENT', com.docker.swarm.node.id=...   syscall: 'open', com.docker.swarm.node.id=...   path: '/app/backend/data/data/config.json' com.docker.swarm.node.id=... } ``` When trying to access the webpage from browser I get back 500 Internal Server error  **To Reproduce** Steps to reproduce the behavior:  1. Create new compose/stack (see example below 2. docker compose up  3. follow container logs  **Expected behavior** Container should first start normally, should be able to reach webpage  **Screenshots** If applicable, add screenshots to help explain your problem.  **Additional context** example compose ``` ---   services:     vane:       image: it
  **Post-Mortem & Fix Analysis**:
  > Think I found the issue. had DATA_DIR set for openwebui in same stack. Think it was picking that up.

- **Issue #1112** (2026-04-15): **Search is broken**
  *Symptoms*: **Describe the bug** All searches now produce 0 results using SearXNG (full fat Vane, not slim Vane). All providers return errors.  **To Reproduce** Test query: do a test search on the latest Starlink info  **Additional context** Log attached.  [Vane_log.txt](https://github.com/user-attachments/files/26748227/Vane_log.txt)
  **Post-Mortem & Fix Analysis**:
  > Issue resolved by closing/reopening browser & restarting container. 

- **Issue #1101** (2026-04-11): **Playwright is missing from Dockerfile.slim**
  *Symptoms*: **Describe the bug**  The Dockerfile.slim file requires Playwright to be installed, just like the standard Dockerfile :   ``` Error scraping data from https://docs.olares.com/use-cases/perplexica.html Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell ╔════════════════════════════════════════════════════════════╗ ║ Looks like Playwright was just installed or updated.       ║ ║ Please run the following command to download new browsers: ║ ║                                                            ║ ║     npx playwright install                                 ║ ║                                                            ║ ║ <3 Playwright Team                                         ║ ╚════════════════════════════════════════════════════════════╝     at <unknown> (.next/server/chunks/641.js:645:683) ```  **Additional context** v1.12.2  Thanks
  **Post-Mortem & Fix Analysis**:
  > Closed by https://github.com/ItzCrazyKns/Vane/commit/adc68fc0502068e85b8b9796db8015c92a9da469

- **Issue #1075** (2026-03-26): **Client-side error: "t.searching.map is not a function" on self-hosted Vane (Windows + Docker)**
  *Symptoms*: ## Description  When I self-host Vane with Docker on Windows and run a web search, I frequently get this error in the browser:  > Application error: a client-side exception has occurred while loading localhost (see the browser console for more information).  The browser console always shows:  ```text 2415-19b4fa5968a788ca.js:25 Uncaught TypeError: t.searching.map is not a function     at 2415-19b4fa5968a788ca.js:25:17315     at Array.map (<anonymous>)     at es (2415-19b4fa5968a788ca.js:25:14918)     at ak (4bd1b696-6b5c0c72b0eadc5f.js:1:53104)     at o0 (4bd1b696-6b5c0c72b0eadc5f.js:1:73556)     at is (4bd1b696-6b5c0c72b0eadc5f.js:1:84988)     at sp (4bd1b696-6b5c0c72b0eadc5f.js:1:128009)     at 4bd1b696-6b5c0c72b0eadc5f.js:1:127854     at sd (4bd1b696-6b5c0c72b0eadc5f.js:1:127862)     at sn (4bd1b696-6b5c0c72b0eadc5f.js:1:123787)  It looks like searching / queries is sometimes not an array, but the code assumes it is and calls .map() on it.  Environment Vane version: itzcrazykns1337/vane:latest (pulled on 2026‑03‑21)  Deployment: Docker on Windows 11 (Docker Desktop, default settings)  Container name: vane  Ports:  3000:3000 (Vane)  Browser: Chrome / Edge (same behaviour)  SearXNG: bundled with the vane:latest image, working fine on its own  SearXNG + Brave Search API are working correctly:  I configured braveapi in /etc/searxng/settings.yml with my Brave Web Search API key.  Testing directly in SearXNG UI with KF-21 returns results.  Brave dashboard shows the API usage inc

- **Issue #1066** (2026-03-26): **Cannot get gpt-oss-20b to work with Vane**
  *Symptoms*: **Describe the bug** I have tried to use gpt-oss-20b served by llama.cpp as a model for Vane and have not been able to make it work, it is always stuck in the first "Brainstorming" phase and does not get to the point of making searches or writing an answer. Inspecting llama-server logs shows a few "error 500" messages that do not appear when using other models, after the third or so 500 error any process on the prompt stops.   Here is one of the errors: `[47735] srv operator(): got exception: {"error":{"code":500,"message":"Failed to parse input at pos 1246: <|start|>assistant<|channel|>final <|constrain|>json<|message|>{\"classification\":{\"skipSearch\":false,\"personalSearch\":false,\"academicSearch\":false,\"discussionSearch\":false,\"showWeatherWidget\":false,\"showStockWidget\":false,\"showCalculationWidget\":false},\"standaloneFollowUp\":\"What is the capital of France?\"}","type":"server_error"}}`  **To Reproduce** Set up llama.cpp's llama-server to serve gpt-oss-20b (unsloth, bartowski or ggml-org quants doesn't matter), then set up Vane to use this model. Submit a prompt in Vane, it should not get beyond the Brainstorming phase. For reference, here is my llama-server command: `llama-server -hf unsloth/gpt-oss-20b-GGUF:F16 --jinja --ctx-size 32768 --temp 1.0 --top-p 1.0 --top-k 0`  **Expected behavior** The model is making web searches and successfully answers the prompt, like other models (Qwen 3.5 series, Ministral 3 series) do.  **Additional context**   - The issu
  **Post-Mortem & Fix Analysis**:
  > Looks like its an issue on Llama CPP's side, it is failing to parse the JSON response. GPT OSS had a lot of issues following the template and hence the inference engines fail to parse the output, please try using another model or file an issue with Llama CPP.

- **Issue #1064** (2026-03-27): **unable to upload pdf file**
  *Symptoms*: unable to upload pdf file, it just spins.   expected should be to ingest  the file and be able to search the content.  <img width="1065" height="655" alt="Image" src="https://github.com/user-attachments/assets/2879336a-fca4-4f2b-b967-dbd2d01201a0" />  Environment - vane running on docker - using wsl container on windows 11  Ollama using qwen3.5:4b model on RTX 4060

- **Issue #1012** (2026-03-10): **can't save settings with new models... claude found a bug**
  *Symptoms*: <img width="1105" height="486" alt="Image" src="https://github.com/user-attachments/assets/d192cf2a-5ab9-4af4-ac9d-cc57f94ac1c5" />
  **Post-Mortem & Fix Analysis**:
  > Hello, the cross button is there to delete any additional models that the user has added. We don't allow using it to delete default models (that are returned by the provider's model list) so this is intended.

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

### Incident Patch 1: `97c0ad59` (2026-04-10)
**Commit Message**: Merge pull request #1097 from lawrence3699/fix/weather-switch-fallthrough

fix: add missing break statements in weather code switch

**File**: `src/app/api/weather/route.ts` (modified, +32/-0)
```diff
@@ -62,57 +62,79 @@ export const POST = async (req: Request) => {
         break;
 
       case 1:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Mainly Clear';
+        break;
       case 2:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Partly Cloudy';
+        break;
       case 3:
         weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Cloudy';
         break;
 
       case 45:
+        weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
+        break;
       case 48:
         weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
         break;
 
       case 51:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Light Drizzle';
+        break;
       case 53:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Moderate Drizzle';
+        break;
       case 55:
         weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Dense Drizzle';
         break;
 
       case 56:
+        weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Light Freezing Drizzle';
+        break;
       case 57:
         weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Dense Freezing Drizzle';
         break;
 
       case 61:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Slight Rain';
+        break;
       case 63:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Moderate Rain';
+        break;
       case 65:
         weather.condition = 'Heavy Rain';
         weather.icon = `rainy-2-${dayOrNight}`;
         break;
 
       case 66:
+        weather.icon = 'rain-and-sleet-mix';
         weather.condition = 'Light Freezing Rain';
+        break;
       case 67:
         weather.condition = 'Heavy Freezing Rain';
         weather.icon = 'rain-and-sleet-mix';
         break;
 
       case 71:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Slight Snow Fall';
+        break;
       case 73:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Moderate Snow Fall';
+        break;
       case 75:
         weather.condition = 'Heavy Snow Fall';
         weather.icon = `snowy-2-${dayOrNight}`;
@@ -124,18 +146,26 @@ export const POST = async (req: Request) => {
         break;
 
       case 80:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Slight Rain Showers';
+        break;
       case 81:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Moderate Rain Showers';
+        break;
       case 82:
         weather.condition = 'Heavy Rain Showers';
         weather.icon = `rainy-3-${dayOrNight}`;
         break;
 
       case 85:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Slight Snow Showers';
+        break;
       case 86:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Moderate Snow Showers';
+        break;
       case 87:
         weather.condition = 'Heavy Snow Showers';
         weather.icon = `snowy-3-${dayOrNight}`;
@@ -147,7 +177,9 @@ export const POST = async (req: Request) => {
         break;
 
       case 96:
+        weather.icon = 'severe-thunderstorm';
         weather.condition = 'Thunderstorm with Slight Hail';
+        break;
       case 99:
         weather.condition = 'Thunderstorm with Heavy Hail';
         weather.icon = 'severe-thunderstorm';
```

---

### Incident Patch 2: `e0aac65e` (2026-04-09)
**Commit Message**: fix: add missing break statements in weather code switch

WMO weather codes 1, 2, 45, 51, 53, 56, 61, 63, 66, 71, 73, 80, 81,
85, 86, and 96 were missing break statements, causing fall-through
that overwrote each condition with the last label in its group. For
example, code 1 (Mainly Clear) fell through to code 3, so the widget
always displayed 'Cloudy'. Also adds the shared group icon to each
early case so the widget renders an icon for every code.

**File**: `src/app/api/weather/route.ts` (modified, +32/-0)
```diff
@@ -62,57 +62,79 @@ export const POST = async (req: Request) => {
         break;
 
       case 1:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Mainly Clear';
+        break;
       case 2:
+        weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Partly Cloudy';
+        break;
       case 3:
         weather.icon = `cloudy-1-${dayOrNight}`;
         weather.condition = 'Cloudy';
         break;
 
       case 45:
+        weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
+        break;
       case 48:
         weather.icon = `fog-${dayOrNight}`;
         weather.condition = 'Fog';
         break;
 
       case 51:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Light Drizzle';
+        break;
       case 53:
+        weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Moderate Drizzle';
+        break;
       case 55:
         weather.icon = `rainy-1-${dayOrNight}`;
         weather.condition = 'Dense Drizzle';
         break;
 
       case 56:
+        weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Light Freezing Drizzle';
+        break;
       case 57:
         weather.icon = `frost-${dayOrNight}`;
         weather.condition = 'Dense Freezing Drizzle';
         break;
 
       case 61:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Slight Rain';
+        break;
       case 63:
+        weather.icon = `rainy-2-${dayOrNight}`;
         weather.condition = 'Moderate Rain';
+        break;
       case 65:
         weather.condition = 'Heavy Rain';
         weather.icon = `rainy-2-${dayOrNight}`;
         break;
 
       case 66:
+        weather.icon = 'rain-and-sleet-mix';
         weather.condition = 'Light Freezing Rain';
+        break;
       case 67:
         weather.condition = 'Heavy Freezing Rain';
         weather.icon = 'rain-and-sleet-mix';
         break;
 
       case 71:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Slight Snow Fall';
+        break;
       case 73:
+        weather.icon = `snowy-2-${dayOrNight}`;
         weather.condition = 'Moderate Snow Fall';
+        break;
       case 75:
         weather.condition = 'Heavy Snow Fall';
         weather.icon = `snowy-2-${dayOrNight}`;
@@ -124,18 +146,26 @@ export const POST = async (req: Request) => {
         break;
 
       case 80:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Slight Rain Showers';
+        break;
       case 81:
+        weather.icon = `rainy-3-${dayOrNight}`;
         weather.condition = 'Moderate Rain Showers';
+        break;
       case 82:
         weather.condition = 'Heavy Rain Showers';
         weather.icon = `rainy-3-${dayOrNight}`;
         break;
 
       case 85:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Slight Snow Showers';
+        break;
       case 86:
+        weather.icon = `snowy-3-${dayOrNight}`;
         weather.condition = 'Moderate Snow Showers';
+        break;
       case 87:
         weather.condition = 'Heavy Snow Showers';
         weather.icon = `snowy-3-${dayOrNight}`;
@@ -147,7 +177,9 @@ export const POST = async (req: Request) => {
         break;
 
       case 96:
+        weather.icon = 'severe-thunderstorm';
         weather.condition = 'Thunderstorm with Slight Hail';
+        break;
       case 99:
         weather.condition = 'Thunderstorm with Heavy Hail';
         weather.icon = 'severe-thunderstorm';
```

---

### Incident Patch 3: `40a7cdeb` (2026-04-09)
**Commit Message**: feat(scrape-url): prevent context overflow

**File**: `src/lib/agents/search/researcher/actions/scrapeURL.ts` (modified, +82/-1)
```diff
@@ -2,6 +2,49 @@ import z from 'zod';
 import { ResearchAction } from '../../types';
 import { Chunk, ReadingResearchBlock } from '@/lib/types';
 import Scraper from '@/lib/scraper';
+import { splitText } from '@/lib/utils/splitText';
+
+const extractorPrompt = `
+                  Assistant is an AI information extractor. Assistant will be shared with scraped information from a website along with the queries used to retrieve that information. Assistant's task is to extract relevant facts from the scraped data to answer the queries.
+            
+                  ## Things to taken into consideration when extracting information:
+                  1. Relevance to the query: The extracted information must dynamically adjust based on the query's intent. If the query asks "What is [X]", you must extract the definition/identity. If the query asks for "[X] specs" or "features", you must provide deep, granular technical details.
+                     - Example: For "What is [Product]", extract the core definition. For "[Product] capabilities", extract every technical function mentioned.
+                  2. Concentrate on extracting factual information that can help in answering the question rather than opinions or commentary. Ignore marketing fluff like "best-in-class" or "seamless."
+                  3. Noise to signal ratio: If the scraped data is noisy (headers, footers, UI text), ignore it and extract only the high-value information. 
+                     - Example: Discard "Click for more" or "Subscribe now" messages.
+                  4. Avoid using filler sentences or words; extract concise, telegram-style information.
+                     - Example: Change "The device features a weight of only 1.2kg" to "Weight: 1.2kg."
+                  5. Duplicate information: If a fact appears multiple times (e.g., in a paragraph and a technical table), merge the details into a single, high-density bullet point to avoid redundancy.
+                  6. Numerical Data Integrity: NEVER summarize or generalize numbers, benchmarks, or table data. Extract raw values exactly as they appear.
+                     - Example: Do not say "Improved coding scores." Say "LiveCodeBench v6: 80.0%."
+            
+                  ## Example
+                  For example, if the query is "What are the health benefits of green tea?" and the scraped data contains various pieces of information about green tea, Assistant should focus on extracting factual information related to the health benefits of green tea such as "Green tea contains antioxidants which can help in reducing inflammation" and ignore irrelevant information such as "Green tea is a popular beverage worldwide".
+                  
+                  It can also remove filler words to reduce the sentence to "Contains antioxidants; reduces inflammation." 
+                  
+                  For tables/numerical data extraction, Assistant should extract the raw numerical data or the content of the table without trying to summarize it to avoid losing important details. For example, if a table lists specific battery life hours for different modes, Assistant should list every mode and its corresponding hour count rather than giving a general average.
+                  
+                  Make sure the extracted facts are in bullet points format to make it easier to read and understand.
+            
+                  ## Output format
+                  Assistant should reply with a JSON object containing a key "extracted_facts" which is a string of the bulleted facts. Return only raw JSON without markdown formatting (no \`\`\`json blocks).
+            
+                  <example_output>
+                  {
+                    "extracted_facts": "- Fact 1\n- Fact 2\n- Fact 3"
+                  }
+                  </example_output>
+                  `;
+
+const extractorSchema = z.object({
+  extracted_facts: z
+    .string()
+    .describe(
+      'The extracted facts that are relevant to the query and can help in answering the question should be listed here in a concise manner.',
+    ),
+});
 
 const schema = z.object({
   urls: z.array(z.string()).describe('A list of URLs to scrape content from.'),
@@ -101,8 +144,46 @@ const scrapeURLAction: ResearchAction<typeof schema> = {
             );
           }
 
+          const chunks = splitText(scraped.content, 4000, 500);
+
+          let accumulatedContent = '';
+
+          if (chunks.length > 1) {
+            try {
+              await Promise.all(
+                chunks.map(async (chunk) => {
+                  const extracted = await additionalConfig.llm.generateObject<
+                    typeof extractorSchema
+                  >({
+                    messages: [
+                      {
+                        role: 'system',
+                        content: extractorPrompt,
+                      },
+                      {
+                        role: 'user',
+                        con
```

---

### Incident Patch 4: `a889fdc3` (2026-04-08)
**Commit Message**: feat(app): fix build issues

**File**: `src/components/MessageRenderer/CodeBlock/index.tsx` (modified, +5/-2)
```diff
@@ -7,6 +7,9 @@ import SyntaxHighlighter from 'react-syntax-highlighter';
 import darkTheme from './CodeBlockDarkTheme';
 import lightTheme from './CodeBlockLightTheme';
 
+const SyntaxHighlighterComponent =
+  SyntaxHighlighter as unknown as React.ComponentType<any>;
+
 const CodeBlock = ({
   language,
   children,
@@ -50,13 +53,13 @@ const CodeBlock = ({
           />
         )}
       </button>
-      <SyntaxHighlighter
+      <SyntaxHighlighterComponent
         language={language}
         style={syntaxTheme}
         showInlineLineNumbers
       >
         {children as string}
-      </SyntaxHighlighter>
+      </SyntaxHighlighterComponent>
     </div>
   );
 };
```

---

### Incident Patch 5: `0e336419` (2026-03-26)
**Commit Message**: fix: handle upload errors and reset spinner state

**File**: `src/components/MessageInputActions/Attach.tsx` (modified, +47/-18)
```diff
@@ -18,6 +18,7 @@ import { Fragment, useRef, useState } from 'react';
 import { useChat } from '@/lib/hooks/useChat';
 import { AnimatePresence } from 'motion/react';
 import { motion } from 'framer-motion';
+import { toast } from 'sonner';
 
 const Attach = () => {
   const { files, setFiles, setFileIds, fileIds } = useChat();
@@ -26,31 +27,59 @@ const Attach = () => {
   const fileInputRef = useRef<any>();
 
   const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
-    setLoading(true);
-    const data = new FormData();
+    const selectedFiles = e.target.files;
 
-    for (let i = 0; i < e.target.files!.length; i++) {
-      data.append('files', e.target.files![i]);
+    if (!selectedFiles?.length) {
+      return;
     }
 
-    const embeddingModelProvider = localStorage.getItem(
-      'embeddingModelProviderId',
-    );
-    const embeddingModel = localStorage.getItem('embeddingModelKey');
+    setLoading(true);
+
+    try {
+      const data = new FormData();
+
+      for (let i = 0; i < selectedFiles.length; i++) {
+        data.append('files', selectedFiles[i]);
+      }
+
+      const embeddingModelProvider = localStorage.getItem(
+        'embeddingModelProviderId',
+      );
+      const embeddingModel = localStorage.getItem('embeddingModelKey');
 
-    data.append('embedding_model_provider_id', embeddingModelProvider!);
-    data.append('embedding_model_key', embeddingModel!);
+      if (!embeddingModelProvider || !embeddingModel) {
+        throw new Error('Please select an embedding model before uploading.');
+      }
 
-    const res = await fetch(`/api/uploads`, {
-      method: 'POST',
-      body: data,
-    });
+      data.append('embedding_model_provider_id', embeddingModelProvider);
+      data.append('embedding_model_key', embeddingModel);
 
-    const resData = await res.json();
+      const res = await fetch(`/api/uploads`, {
+        method: 'POST',
+        body: data,
+      });
 
-    setFiles([...files, ...resData.files]);
-    setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
-    setLoading(false);
+      const resData = await res.json().catch(() => ({}));
+
+      if (!res.ok) {
+        throw new Error(resData.message || 'Failed to upload file(s).');
+      }
+
+      if (!Array.isArray(resData.files)) {
+        throw new Error('Invalid upload response from server.');
+      }
+
+      setFiles([...files, ...resData.files]);
+      setFileIds([
+        ...fileIds,
+        ...resData.files.map((file: any) => file.fileId),
+      ]);
+    } catch (err: any) {
+      toast(err?.message || 'Failed to upload file(s).');
+    } finally {
+      setLoading(false);
+      e.target.value = '';
+    }
   };
 
   return loading ? (
```

**File**: `src/components/MessageInputActions/AttachSmall.tsx` (modified, +47/-18)
```diff
@@ -9,6 +9,7 @@ import { Fragment, useRef, useState } from 'react';
 import { useChat } from '@/lib/hooks/useChat';
 import { AnimatePresence } from 'motion/react';
 import { motion } from 'framer-motion';
+import { toast } from 'sonner';
 
 const AttachSmall = () => {
   const { files, setFiles, setFileIds, fileIds } = useChat();
@@ -17,31 +18,59 @@ const AttachSmall = () => {
   const fileInputRef = useRef<any>();
 
   const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
-    setLoading(true);
-    const data = new FormData();
+    const selectedFiles = e.target.files;
 
-    for (let i = 0; i < e.target.files!.length; i++) {
-      data.append('files', e.target.files![i]);
+    if (!selectedFiles?.length) {
+      return;
     }
 
-    const embeddingModelProvider = localStorage.getItem(
-      'embeddingModelProviderId',
-    );
-    const embeddingModel = localStorage.getItem('embeddingModelKey');
+    setLoading(true);
+
+    try {
+      const data = new FormData();
+
+      for (let i = 0; i < selectedFiles.length; i++) {
+        data.append('files', selectedFiles[i]);
+      }
+
+      const embeddingModelProvider = localStorage.getItem(
+        'embeddingModelProviderId',
+      );
+      const embeddingModel = localStorage.getItem('embeddingModelKey');
 
-    data.append('embedding_model_provider_id', embeddingModelProvider!);
-    data.append('embedding_model_key', embeddingModel!);
+      if (!embeddingModelProvider || !embeddingModel) {
+        throw new Error('Please select an embedding model before uploading.');
+      }
 
-    const res = await fetch(`/api/uploads`, {
-      method: 'POST',
-      body: data,
-    });
+      data.append('embedding_model_provider_id', embeddingModelProvider);
+      data.append('embedding_model_key', embeddingModel);
 
-    const resData = await res.json();
+      const res = await fetch(`/api/uploads`, {
+        method: 'POST',
+        body: data,
+      });
 
-    setFiles([...files, ...resData.files]);
-    setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
-    setLoading(false);
+      const resData = await res.json().catch(() => ({}));
+
+      if (!res.ok) {
+        throw new Error(resData.message || 'Failed to upload file(s).');
+      }
+
+      if (!Array.isArray(resData.files)) {
+        throw new Error('Invalid upload response from server.');
+      }
+
+      setFiles([...files, ...resData.files]);
+      setFileIds([
+        ...fileIds,
+        ...resData.files.map((file: any) => file.fileId),
+      ]);
+    } catch (err: any) {
+      toast(err?.message || 'Failed to upload file(s).');
+    } finally {
+      setLoading(false);
+      e.target.value = '';
+    }
   };
 
   return loading ? (
```

---

### Incident Patch 6: `3fede054` (2026-03-26)
**Commit Message**: Merge pull request #1076 from saschabuehrle/fix/issue-1075

fix: guard against non-array searching queries in research steps

**File**: `src/components/AssistantSteps.tsx` (modified, +3/-1)
```diff
@@ -37,7 +37,8 @@ const getStepTitle = (
   if (step.type === 'reasoning') {
     return isStreaming && !step.reasoning ? 'Thinking...' : 'Thinking';
   } else if (step.type === 'searching') {
-    return `Searching ${step.searching.length} ${step.searching.length === 1 ? 'query' : 'queries'}`;
+    const queries = Array.isArray(step.searching) ? step.searching : [];
+    return `Searching ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`;
   } else if (step.type === 'search_results') {
     return `Found ${step.reading.length} ${step.reading.length === 1 ? 'result' : 'results'}`;
   } else if (step.type === 'reading') {
@@ -160,6 +161,7 @@ const AssistantSteps = ({
                       )}
 
                       {step.type === 'searching' &&
+                        Array.isArray(step.searching) &&
                         step.searching.length > 0 && (
                           <div className="flex flex-wrap gap-1.5 mt-1.5">
                             {step.searching.map((query, idx) => (
```

**File**: `src/lib/agents/search/researcher/actions/academicSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const academicSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.academicSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/socialSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const socialSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.discussionSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/webSearch.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ const webSearchAction: ResearchAction<typeof actionSchema> = {
     config.sources.includes('web') &&
     config.classification.classification.skipSearch === false,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

---

### Incident Patch 7: `21bd8878` (2026-03-22)
**Commit Message**: fix: guard against non-array searching queries in research steps (fixes #1075)

**File**: `src/components/AssistantSteps.tsx` (modified, +3/-1)
```diff
@@ -37,7 +37,8 @@ const getStepTitle = (
   if (step.type === 'reasoning') {
     return isStreaming && !step.reasoning ? 'Thinking...' : 'Thinking';
   } else if (step.type === 'searching') {
-    return `Searching ${step.searching.length} ${step.searching.length === 1 ? 'query' : 'queries'}`;
+    const queries = Array.isArray(step.searching) ? step.searching : [];
+    return `Searching ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`;
   } else if (step.type === 'search_results') {
     return `Found ${step.reading.length} ${step.reading.length === 1 ? 'result' : 'results'}`;
   } else if (step.type === 'reading') {
@@ -160,6 +161,7 @@ const AssistantSteps = ({
                       )}
 
                       {step.type === 'searching' &&
+                        Array.isArray(step.searching) &&
                         step.searching.length > 0 && (
                           <div className="flex flex-wrap gap-1.5 mt-1.5">
                             {step.searching.map((query, idx) => (
```

**File**: `src/lib/agents/search/researcher/actions/academicSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const academicSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.academicSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/socialSearch.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const socialSearchAction: ResearchAction<typeof schema> = {
     config.classification.classification.skipSearch === false &&
     config.classification.classification.discussionSearch === true,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

**File**: `src/lib/agents/search/researcher/actions/webSearch.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ const webSearchAction: ResearchAction<typeof actionSchema> = {
     config.sources.includes('web') &&
     config.classification.classification.skipSearch === false,
   execute: async (input, additionalConfig) => {
-    input.queries = input.queries.slice(0, 3);
+    input.queries = (Array.isArray(input.queries) ? input.queries : [input.queries]).slice(0, 3);
 
     const researchBlock = additionalConfig.session.getBlock(
       additionalConfig.researchBlockId,
```

---

### Incident Patch 8: `b02f5aa3` (2026-03-10)
**Commit Message**: Merge pull request #1015 from joaquinescalante23/fix/search-resilience-and-timeouts

feat: improve search resilience with timeouts and widget error handling

**File**: `src/lib/agents/search/api.ts` (modified, +3/-0)
```diff
@@ -19,6 +19,9 @@ class APISearchAgent {
       chatHistory: input.chatHistory,
       followUp: input.followUp,
       llm: input.config.llm,
+    }).catch((err) => {
+      console.error(`Error executing widgets: ${err}`);
+      return [];
     });
 
     let searchPromise: Promise<ResearcherOutput> | null = null;
```

**File**: `src/lib/searxng.ts` (modified, +24/-5)
```diff
@@ -38,11 +38,30 @@ export const searchSearxng = async (
     });
   }
 
-  const res = await fetch(url);
-  const data = await res.json();
+  const controller = new AbortController();
+  const timeoutId = setTimeout(() => controller.abort(), 10000);
 
-  const results: SearxngSearchResult[] = data.results;
-  const suggestions: string[] = data.suggestions;
+  try {
+    const res = await fetch(url, {
+      signal: controller.signal,
+    });
+
+    if (!res.ok) {
+      throw new Error(`SearXNG error: ${res.statusText}`);
+    }
+
+    const data = await res.json();
 
-  return { results, suggestions };
+    const results: SearxngSearchResult[] = data.results;
+    const suggestions: string[] = data.suggestions;
+
+    return { results, suggestions };
+  } catch (err: any) {
+    if (err.name === 'AbortError') {
+      throw new Error('SearXNG search timed out');
+    }
+    throw err;
+  } finally {
+    clearTimeout(timeoutId);
+  }
 };
```

---

### Incident Patch 9: `7ab23d63` (2026-03-09)
**Commit Message**: feat(setup-screen): fix spacing

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ RUN git clone "https://github.com/searxng/searxng" \
                    "/usr/local/searxng/searxng-src"
 
 RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
-RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec
+RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec typing_extensions
 RUN cd "/usr/local/searxng/searxng-src" && \
     "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .
 
```

**File**: `src/components/Setup/SetupWizard.tsx` (modified, +2/-2)
```diff
@@ -46,7 +46,7 @@ const SetupWizard = ({
                 animate={{ opacity: 1, translateY: '0px' }}
                 className="text-4xl md:text-6xl xl:text-8xl font-normal font-['Instrument_Serif'] tracking-tight"
               >
-                Welcome to{' '}
+                Welcome to
                 <span className="text-[#24A0ED] italic font-['PP_Editorial']">
                   Vane
                 </span>
@@ -91,7 +91,7 @@ const SetupWizard = ({
                   }}
                   className="text-2xl md:text-4xl xl:text-6xl font-normal font-['Instrument_Serif'] tracking-tight"
                 >
-                  Let us get{' '}
+                  Let us get
                   <span className="text-[#24A0ED] italic font-['PP_Editorial']">
                     Vane
                   </span>{' '}
```

---

### Incident Patch 10: `80d4f237` (2026-03-08)
**Commit Message**: fix: add typing_extensions to Dockerfile to resolve build error

Add typing_extensions to the list of installed packages.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ RUN git clone "https://github.com/searxng/searxng" \
                    "/usr/local/searxng/searxng-src"
 
 RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
-RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec
+RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec typing_extensions
 RUN cd "/usr/local/searxng/searxng-src" && \
     "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .
 
```

---

### Incident Patch 11: `1763ee9d` (2026-03-04)
**Commit Message**: Add timeout and validation to SearXNG search

**File**: `src/lib/searxng.ts` (modified, +24/-5)
```diff
@@ -38,11 +38,30 @@ export const searchSearxng = async (
     });
   }
 
-  const res = await fetch(url);
-  const data = await res.json();
+  const controller = new AbortController();
+  const timeoutId = setTimeout(() => controller.abort(), 10000);
 
-  const results: SearxngSearchResult[] = data.results;
-  const suggestions: string[] = data.suggestions;
+  try {
+    const res = await fetch(url, {
+      signal: controller.signal,
+    });
+
+    if (!res.ok) {
+      throw new Error(`SearXNG error: ${res.statusText}`);
+    }
+
+    const data = await res.json();
 
-  return { results, suggestions };
+    const results: SearxngSearchResult[] = data.results;
+    const suggestions: string[] = data.suggestions;
+
+    return { results, suggestions };
+  } catch (err: any) {
+    if (err.name === 'AbortError') {
+      throw new Error('SearXNG search timed out');
+    }
+    throw err;
+  } finally {
+    clearTimeout(timeoutId);
+  }
 };
```

---

### Incident Patch 12: `164d5287` (2025-12-28)
**Commit Message**: feat(compose): add build context, remove uploads

**File**: `docker-compose.yaml` (modified, +3/-4)
```diff
@@ -1,15 +1,14 @@
 services:
   perplexica:
     image: itzcrazykns1337/perplexica:latest
+    build:
+      context: .
     ports:
       - '3000:3000'
     volumes:
       - data:/home/perplexica/data
-      - uploads:/home/perplexica/uploads
     restart: unless-stopped
 
 volumes:
   data:
-    name: 'perplexica-data'
-  uploads:
-    name: 'perplexica-uploads'
+    name: 'perplexica-data'
\ No newline at end of file
```

---

### Incident Patch 13: `a691f3ba` (2025-12-27)
**Commit Message**: feat(chat-hook): fix history saving delay (async state), add delay before media search to allow component refresh

**File**: `src/lib/hooks/useChat.tsx` (modified, +53/-33)
```diff
@@ -175,7 +175,7 @@ const loadMessages = async (
   chatId: string,
   setMessages: (messages: Message[]) => void,
   setIsMessagesLoaded: (loaded: boolean) => void,
-  setChatHistory: (history: [string, string][]) => void,
+  chatHistory: React.MutableRefObject<[string, string][]>,
   setSources: (sources: string[]) => void,
   setNotFound: (notFound: boolean) => void,
   setFiles: (files: File[]) => void,
@@ -233,7 +233,7 @@ const loadMessages = async (
   setFiles(files);
   setFileIds(files.map((file: File) => file.fileId));
 
-  setChatHistory(history);
+  chatHistory.current = history;
   setSources(data.chat.sources);
   setIsMessagesLoaded(true);
 };
@@ -281,7 +281,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
 
   const [researchEnded, setResearchEnded] = useState(false);
 
-  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
+  const chatHistory = useRef<[string, string][]>([]);
   const [messages, setMessages] = useState<Message[]>([]);
 
   const [files, setFiles] = useState<File[]>([]);
@@ -402,7 +402,12 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
     });
   }, [messages]);
 
+  const isReconnectingRef = useRef(false);
+  const handledMessageEndRef = useRef<Set<string>>(new Set());
+
   const checkReconnect = async () => {
+    if (isReconnectingRef.current) return;
+
     setIsReady(true);
     console.debug(new Date(), 'app:ready');
 
@@ -414,6 +419,8 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
         setResearchEnded(false);
         setMessageAppeared(false);
 
+        isReconnectingRef.current = true;
+
         const res = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
           method: 'POST',
         });
@@ -427,23 +434,27 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
 
         const messageHandler = getMessageHandler(lastMsg);
 
-        while (true) {
-          const { value, done } = await reader.read();
-          if (done) break;
+        try {
+          while (true) {
+            const { value, done } = await reader.read();
+            if (done) break;
 
-          partialChunk += decoder.decode(value, { stream: true });
+            partialChunk += decoder.decode(value, { stream: true });
 
-          try {
-            const messages = partialChunk.split('\n');
-            for (const msg of messages) {
-              if (!msg.trim()) continue;
-              const json = JSON.parse(msg);
-              messageHandler(json);
+            try {
+              const messages = partialChunk.split('\n');
+              for (const msg of messages) {
+                if (!msg.trim()) continue;
+                const json = JSON.parse(msg);
+                messageHandler(json);
+              }
+              partialChunk = '';
+            } catch (error) {
+              console.warn('Incomplete JSON, waiting for next chunk...');
             }
-            partialChunk = '';
-          } catch (error) {
-            console.warn('Incomplete JSON, waiting for next chunk...');
           }
+        } finally {
+          isReconnectingRef.current = false;
         }
       }
     }
@@ -463,7 +474,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
     if (params.chatId && params.chatId !== chatId) {
       setChatId(params.chatId);
       setMessages([]);
-      setChatHistory([]);
+      chatHistory.current = [];
       setFiles([]);
       setFileIds([]);
       setIsMessagesLoaded(false);
@@ -483,7 +494,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
         chatId,
         setMessages,
         setIsMessagesLoaded,
-        setChatHistory,
+        chatHistory,
         setSources,
         setNotFound,
         setFiles,
@@ -519,9 +530,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
 
     setMessages((prev) => prev.slice(0, index));
 
-    setChatHistory((prev) => {
-      return prev.slice(0, index * 2);
-    });
+    chatHistory.current = chatHistory.current.slice(0, index * 2);
 
     const messageToRewrite = messages[index];
     sendMessage(messageToRewrite.query, messageToRewrite.messageId, true);
@@ -621,12 +630,18 @@ export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
       }
 
       if (data.type === 'messageEnd') {
+        if (handledMessageEndRef.current.has(messageId)) {
+          return;
+        }
+
+        handledMessageEndRef.current.add(messageId);
+
         const currentMsg = messagesRef.current.find(
           (msg) => msg.messageId === messageId,
         );
 
         const newHistory: [string, string][] = [
-          ...chatHistory,
+          ...chatHistory.current,
           ['human', message.query],
           [
             'assistant',
@@ -635,7 +650,7 @@ export const ChatProvider = ({ children }: { children: React.ReactNode 
```

---

### Incident Patch 14: `19dde42f` (2025-12-27)
**Commit Message**: feat(app): fix build errors, use webpack

**File**: `package.json` (modified, +5/-4)
```diff
@@ -4,8 +4,8 @@
   "license": "MIT",
   "author": "ItzCrazyKns",
   "scripts": {
-    "dev": "next dev",
-    "build": "next build",
+    "dev": "next dev --webpack",
+    "build": "next build --webpack",
     "start": "next start",
     "lint": "next lint",
     "format:write": "prettier . --write"
@@ -19,7 +19,6 @@
     "@phosphor-icons/react": "^2.1.10",
     "@radix-ui/react-tooltip": "^1.2.8",
     "@tailwindcss/typography": "^0.5.12",
-    "@types/jspdf": "^2.0.0",
     "axios": "^1.8.3",
     "better-sqlite3": "^11.9.1",
     "clsx": "^2.1.0",
@@ -54,6 +53,7 @@
   },
   "devDependencies": {
     "@types/better-sqlite3": "^7.6.12",
+    "@types/jspdf": "^2.0.0",
     "@types/node": "^24.8.1",
     "@types/pdf-parse": "^1.1.4",
     "@types/react": "^18",
@@ -67,6 +67,7 @@
     "postcss": "^8",
     "prettier": "^3.2.5",
     "tailwindcss": "^3.3.0",
-    "typescript": "^5.9.3"
+    "typescript": "^5.9.3",
+    "@napi-rs/canvas": "^0.1.87"
   }
 }
```

**File**: `yarn.lock` (modified, +72/-0)
```diff
@@ -797,6 +797,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-android-arm64/-/canvas-android-arm64-0.1.84.tgz#7b476e3003be0aca08ab27962fd0d6e803939bec"
   integrity sha512-pdvuqvj3qtwVryqgpAGornJLV6Ezpk39V6wT4JCnRVGy8I3Tk1au8qOalFGrx/r0Ig87hWslysPpHBxVpBMIww==
 
+"@napi-rs/canvas-android-arm64@0.1.87":
+  version "0.1.87"
+  resolved "https://registry.yarnpkg.com/@napi-rs/canvas-android-arm64/-/canvas-android-arm64-0.1.87.tgz#6adce7741baa56e75dcf72076e4bf249f9bc4b8e"
+  integrity sha512-uW7NxJXPvZft9fers4oBhdCsBRVe77DLQS3eXEOxndFzGKiwmjIbZpQqj4QPvrg3I0FM3UfHatz1+17P5SeCOQ==
+
 "@napi-rs/canvas-darwin-arm64@0.1.80":
   version "0.1.80"
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-darwin-arm64/-/canvas-darwin-arm64-0.1.80.tgz#638eaa2d0a2a373c7d15748743182718dcd95c4b"
@@ -807,6 +812,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-darwin-arm64/-/canvas-darwin-arm64-0.1.84.tgz#0f131722f9f66316cea5f5ed7cfb9ad1290683cd"
   integrity sha512-A8IND3Hnv0R6abc6qCcCaOCujTLMmGxtucMTZ5vbQUrEN/scxi378MyTLtyWg+MRr6bwQJ6v/orqMS9datIcww==
 
+"@napi-rs/canvas-darwin-arm64@0.1.87":
+  version "0.1.87"
+  resolved "https://registry.yarnpkg.com/@napi-rs/canvas-darwin-arm64/-/canvas-darwin-arm64-0.1.87.tgz#54f82dc0cd032f85e770abcddbeafc855005931a"
+  integrity sha512-S6YbpXwajDKLTsYftEqR+Ne1lHpeC78okI3IqctVdFexN31Taprn6mdV4CkPY/4S8eGNuReBHvXNyWbGqBZ1eQ==
+
 "@napi-rs/canvas-darwin-x64@0.1.80":
   version "0.1.80"
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-darwin-x64/-/canvas-darwin-x64-0.1.80.tgz#bd6bc048dbd4b02b9620d9d07117ed93e6970978"
@@ -817,6 +827,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-darwin-x64/-/canvas-darwin-x64-0.1.84.tgz#e6ab8c534172d8a8d434fa090da8a205359d8769"
   integrity sha512-AUW45lJhYWwnA74LaNeqhvqYKK/2hNnBBBl03KRdqeCD4tKneUSrxUqIv8d22CBweOvrAASyKN3W87WO2zEr/A==
 
+"@napi-rs/canvas-darwin-x64@0.1.87":
+  version "0.1.87"
+  resolved "https://registry.yarnpkg.com/@napi-rs/canvas-darwin-x64/-/canvas-darwin-x64-0.1.87.tgz#54c2be73ce69a65e70f3d94fb879907479cc12c5"
+  integrity sha512-OJLwP2WIUmRSqWTyV/NZ2TnvBzUsbNqQu6IL7oshwfxYg4BELPV279wrfQ/xZFqzr7wybfIzKaPF4du5ZdA2Cg==
+
 "@napi-rs/canvas-linux-arm-gnueabihf@0.1.80":
   version "0.1.80"
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm-gnueabihf/-/canvas-linux-arm-gnueabihf-0.1.80.tgz#ce6bfbeb19d9234c42df5c384e5989aa7d734789"
@@ -827,6 +842,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm-gnueabihf/-/canvas-linux-arm-gnueabihf-0.1.84.tgz#5898daa3050a8ba4619c1d6cea3a3217d46c5ffd"
   integrity sha512-8zs5ZqOrdgs4FioTxSBrkl/wHZB56bJNBqaIsfPL4ZkEQCinOkrFF7xIcXiHiKp93J3wUtbIzeVrhTIaWwqk+A==
 
+"@napi-rs/canvas-linux-arm-gnueabihf@0.1.87":
+  version "0.1.87"
+  resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm-gnueabihf/-/canvas-linux-arm-gnueabihf-0.1.87.tgz#1bc3c9280db381cc3893c3d13d7320666ce47ebe"
+  integrity sha512-Io3tY6ogc+oyvIGK9rQlnfH4gKiS35P7W6s22x3WCrLFR0dXzZP2IBBoEFEHd6FY6FR1ky5u9cRmADaiLRdX3g==
+
 "@napi-rs/canvas-linux-arm64-gnu@0.1.80":
   version "0.1.80"
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm64-gnu/-/canvas-linux-arm64-gnu-0.1.80.tgz#3b7a7832fef763826fa5fb740d5757204e52607d"
@@ -837,6 +857,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm64-gnu/-/canvas-linux-arm64-gnu-0.1.84.tgz#fbbde94c04278259f1f40b4c199dfd9f95c82e66"
   integrity sha512-i204vtowOglJUpbAFWU5mqsJgH0lVpNk/Ml4mQtB4Lndd86oF+Otr6Mr5KQnZHqYGhlSIKiU2SYnUbhO28zGQA==
 
+"@napi-rs/canvas-linux-arm64-gnu@0.1.87":
+  version "0.1.87"
+  resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm64-gnu/-/canvas-linux-arm64-gnu-0.1.87.tgz#70af2d77d58d65559a43c55f6c37906c220af39e"
+  integrity sha512-Zq7h/PQzs37gaSR/gNRZOAaCC1kGt6NmDjA1PcqpONITh/rAfAwAeP98emrbBJ4FDoPkYRkxmxHlmXNLlsQIBw==
+
 "@napi-rs/canvas-linux-arm64-musl@0.1.80":
   version "0.1.80"
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm64-musl/-/canvas-linux-arm64-musl-0.1.80.tgz#d8ccd91f31d70760628623cd575134ada17690a3"
@@ -847,6 +872,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm64-musl/-/canvas-linux-arm64-musl-0.1.84.tgz#8b02c46c5dbb0a58de87885c61ca1681b1199697"
   integrity sha512-VyZq0EEw+OILnWk7G3ZgLLPaz1ERaPP++jLjeyLMbFOF+Tr4zHzWKiKDsEV/cT7btLPZbVoR3VX+T9/QubnURQ==
 
+"@napi-rs/canvas-linux-arm64-musl@0.1.87":
+  version "0.1.87"
+  resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-arm64-musl/-/canvas-linux-arm64-musl-0.1.87.tgz#31355f0debf35848851be97aa1136905db9cef2a"
+  integrity sha512-CUa5YJjpsFcUxJbtfoQ4bqO/Rq+JU/2RfTNFxx07q1AjuDjCM8+MOOLCvVOV1z3qhl6nKAtjJT0pA0J8EbnK8Q==
+
 "@napi-rs/canvas-linux-riscv64-gnu@0.1.80":
   version "0.1.80"
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas-linux-riscv64-gnu/-/canvas-linux-riscv64-gnu-0.1.80.tgz#927a3b859a0e3c691beaf52a19bc4736c4ffc9b8"
@@ -857,6 +887,11 @@
   resolved "https://registry.yarnpkg.com/@napi-rs/canvas
```

---

### Incident Patch 15: `c9f6893d` (2025-12-27)
**Commit Message**: feat(pdf-parse): fix DOMMatrix issues

**File**: `src/lib/uploads/manager.ts` (modified, +3/-2)
```diff
@@ -4,8 +4,8 @@ import crypto from "crypto"
 import fs from 'fs';
 import { splitText } from "../utils/splitText";
 import { PDFParse } from 'pdf-parse';
+import { CanvasFactory } from 'pdf-parse/worker';
 import officeParser from 'officeparser'
-import { Chunk } from "../types";
 
 const supportedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'] as const
 
@@ -116,7 +116,8 @@ class UploadManager {
                 const pdfBuffer = fs.readFileSync(filePath);
 
                 const parser = new PDFParse({
-                    data: pdfBuffer
+                    data: pdfBuffer,
+                    CanvasFactory
                 })
 
                 const pdfText = await parser.getText().then(res => res.text)
```

#### Recent Merged Pull Requests:
- **PR #1205** (closed): fix: guard empty accumulated tool-call arguments before parse (@eemitev)
- **PR #1194** (closed): feat(providers): add llmman as a local model provider (@ericcurtin)
- **PR #1191** (closed): fix(researcher): drop the narration pseudo-tool, lean no-search writer prompt (@epheo)
- **PR #1165** (closed): Add MiniMax provider support (@octo-patch)
- **PR #1159** (closed): Add SCRAPER_BROWSER_TYPE / SCRAPER_EXECUTABLE_PATH env vars (@feder-cr)
- **PR #1157** (closed): feat(helm): add Helm chart for Kubernetes deployment (@wwagops)
- **PR #1156** (closed): feat: improve UI — copy buttons, follow-up styling, stop generation, OpenRouter fix (@DigitalBeer)
- **PR #1141** (closed): feat(priorart): clearance pipeline with Deep Research reframe + paten… (@OliveAcres)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
