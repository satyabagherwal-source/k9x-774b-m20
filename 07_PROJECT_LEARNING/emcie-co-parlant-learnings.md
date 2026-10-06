# Forensic Learning Record (Deep Inspection): emcie-co/parlant

> **Canonical Artifact**: `07_PROJECT_LEARNING/emcie-co-parlant-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/emcie-co/parlant](https://github.com/emcie-co/parlant))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:08:22.388Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `emcie-co/parlant`
- **Description**: Build reliable customer-facing AI agents with Parlant: an interaction control harness optimized for controlled, consistent, and predictable LLM interactions.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 18296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/utils.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from dataclasses import dataclass
import os
from pathlib import Path
import subprocess
import sys
from typing import Callable, NoReturn


@dataclass(frozen=True)
class Package:
    name: str
    path: Path
    uses_uv: bool
    cmd_prefix: str
    publish: bool

    def run_cmd(self, cmd: str) -> tuple[int, str]:
        print(f"Running command: {self.cmd_prefix} {cmd}")
        return subprocess.getstatusoutput(f"{self.cmd_prefix} {cmd}")


def get_repo_root() -> Path:
    status, output = subprocess.getstatusoutput("git rev-parse --show-toplevel")

    if status != 0:
        print(output, file=sys.stderr)
        print("error: failed to get repo root", file=sys.stderr)
        sys.exit(1)

    return Path(output.strip())


def get_packages() -> list[Package]:
    root = get_repo_root()

    return [
        Package(
            name="parlant",
            path=root / ".",
            cmd_prefix="uv run",
            uses_uv=True,
            publish=True,
        ),
    ]


def for_each_package(
    f: Callable[[Package], None],
    enter_dir: bool = True,
) -> None:
    for package in get_packages():
        original_cwd = os.getcwd()

        if enter_dir:
            print(f"Entering {package.path}...")
            os.chdir(package.path)

        try:
            f(package)
        finally:
            os.chdir(original_cwd)


def die(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    sys.exit(1)

```

### Core Architecture Module: `src/parlant/api/chat/src/components/message-details/empty-state.tsx`
```
import {ClassNameValue, twMerge} from 'tailwind-merge';

interface Props {
	title: string;
	subTitle?: string;
	className?: ClassNameValue;
	wrapperClassName?: ClassNameValue;
	imgClassName?: ClassNameValue;
	imgUrl?: string;
}

const EmptyState = ({title, subTitle, wrapperClassName, className, imgClassName, imgUrl}: Props) => {
	return (
		<div className={twMerge('flex flex-col m-auto justify-center items-center w-full h-full', wrapperClassName)}>
			<div className={twMerge('flex flex-col justify-center items-center -translate-y-[70px]', className)}>
				<img className={twMerge('size-[330px] pointer-events-none rounded-full', imgClassName)} src={imgUrl || 'empty-state.svg'} alt='' />
				<h2 className='text-[18px] font-normal font-inter text-[#656565] mt-[30px]'>{title}</h2>
				{subTitle && <p className='text-[15px] font-normal max-w-[378px] font-inter text-[#656565] text-center mt-[10px]'>{subTitle}</p>}
			</div>
		</div>
	);
};

export default EmptyState;

```

### Core Architecture Module: `src/parlant/api/chat/src/hooks/useDialog.tsx`
```
import {useState, ReactNode} from 'react';
import {Dialog, DialogContent, DialogHeader, DialogPortal} from '@/components/ui/dialog';
import {DialogDescription, DialogTitle} from '@radix-ui/react-dialog';
import {spaceClick} from '@/utils/methods';
import clsx from 'clsx';

interface UseDialogReturn {
	openDialog: (title: string | null, content: ReactNode, dimensions: Dimensions) => void;
	DialogComponent: () => JSX.Element;
	closeDialog: (e?: React.MouseEvent) => void;
}

export interface Dimensions {
	height: string;
	width: string;
}

export const useDialog = (): UseDialogReturn => {
	const [dialogTitle, setDialogTitle] = useState<ReactNode>(null);
	const [dialogContent, setDialogContent] = useState<ReactNode>(null);
	const [dialogSize, setDialogSize] = useState<Dimensions>({height: '', width: ''});
	const [onDialogClosed, setOnDialogClosed] = useState<(() => void) | null>(null);

	const openDialog = (title: string | null, content: ReactNode, dimensions: Dimensions, dialogClosed = null) => {
		if (title) setDialogTitle(title);
		setDialogContent(content);
		setDialogSize({height: dimensions.height, width: dimensions.width});
		if (dialogClosed) setOnDialogClosed(dialogClosed);
	};

	const closeDialog = (e?: React.MouseEvent) => {
		e?.stopPropagation();
		setDialogContent(null);
		setDialogTitle(null);
		onDialogClosed?.();
		setOnDialogClosed(null);
	};

	const DialogComponent = () => (
		<Dialog open={!!dialogContent}>
			<DialogPortal>
				<DialogContent data-testid='dialog' aria-hidden={false} style={{maxHeight: dialogSize.height, width: dialogSize.width}} className={'[&>button]:hidden z-[99] !pointer-events-auto p-0 h-[80%] font-inter bg-white block max-w-[95%]'}>
					<div className='bg-white h-full rounded-[12px] flex flex-col' aria-hidden={false}>
						<DialogHeader className={clsx(!dialogTitle && 'hidden')}>
							<DialogTitle>
								<div className='mb-[12px] mt-[24px] w-full flex justify-between items-center ps-[30px] pe-[20px]'>
									<DialogDescription className='text-[20px] font-semibold'>{dialogTitle}</DialogDescription>
									<img role='button' tabIndex={0} onKeyDown={spaceClick} onClick={closeDialog} className='cursor-pointer rounded-full' src='icons/close.svg' alt='close' width={24} height={24} />
								</div>
							</DialogTitle>
						</DialogHeader>
						<div className='overflow-auto flex-1'>{dialogContent}</div>
					</div>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);

	return {openDialog, DialogComponent, closeDialog};
};

```

### Core Architecture Module: `src/parlant/api/chat/src/hooks/useFetch.tsx`
```
import {BASE_URL} from '@/utils/api';
import {useState, useEffect, useCallback, useRef, ReactElement} from 'react';
import {toast} from 'sonner';

interface useFetchResponse<T> {
	data: T | null;
	loading: boolean;
	error: null | {message: string};
	refetch: () => void;
	ErrorTemplate: (() => ReactElement) | null;
	abortFetch: () => void;
}

function objToUrlParams(obj: Record<string, unknown>) {
	const params = [];
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			const value = encodeURIComponent(`${obj[key]}`);
			params.push(`${key}=${value}`);
		}
	}
	return `?${params.join('&')}`;
}

const ABORT_REQ_CODE = 20;
const NOT_FOUND_CODE = 404;
const TIMEOUT_ERROR_MESSAGE = 'Error: Gateway Timeout';

export default function useFetch<T>(url: string, body?: Record<string, unknown>, dependencies: unknown[] = [], retry = false, initiate = true, checkErr = true): useFetchResponse<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<null | {message: string}>(null);
	const [refetchData, setRefetchData] = useState(false);
	const params = body ? objToUrlParams(body) : '';

	const controllerRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (error && error.message !== TIMEOUT_ERROR_MESSAGE) throw new Error(`Failed to fetch "${url}"`);
	}, [error, url]);

	const ErrorTemplate = () => {
		return (
			<div>
				<div>Something went wrong</div>
				<div role='button' onClick={() => setRefetchData((r) => !r)} className='underline cursor-pointer'>
					Click to retry
				</div>
			</div>
		);
	};

	const refetch = () => setRefetchData((r) => !r);

	useEffect(() => {
		if (retry && error?.message === TIMEOUT_ERROR_MESSAGE) {
			setRefetchData((r) => !r);
			error.message = '';
		}
	}, [retry, error]);

	const fetchData = useCallback(
		(customParams = '') => {
			const controller = new AbortController();
			controllerRef.current = controller;
			const {signal} = controller;
			setTimeout(() => setLoading(true), 0);
			setError(null);
			const reqParams = customParams || params;

			fetch(`${BASE_URL}/${url}${reqParams}`, {signal})
				.then(async (response) => {
					if (!response.ok) {
						if (response.status === NOT_FOUND_CODE) {
							throw {code: NOT_FOUND_CODE, message: response.statusText};
						}
						throw new Error(`Error: ${response.statusText}`);
					}
					const result = await response.json();
					setData(result);
				})
				.catch((err) => {
					if (checkErr && err.code !== ABORT_REQ_CODE) setError({message: err.message});
					else if (err.code !== ABORT_REQ_CODE && err.code !== NOT_FOUND_CODE && retry) fetchData();

					if (err.code === NOT_FOUND_CODE) toast.error('resource not found. please try to refresh the page');
				})
				.finally(() => checkErr && setLoading(false));
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[url, refetchData, ...dependencies]
	);

	useEffect(() => {
		if (!initiate) return;
		fetchData();

		return () => {
			controllerRef.current?.abort();
		};
	}, [fetchData, initiate]);

	const abortFetch = () => {
		controllerRef.current?.abort();
	};

	return {data, loading, error, refetch, ErrorTemplate: error && ErrorTemplate, abortFetch};
}

```

### Core Architecture Module: `src/parlant/api/chat/src/hooks/useLocalStorage.ts`
```
import {useEffect, useState} from 'react';

const LIMIT = 30;

export function useLocalStorage<T>(key: string, initialValue: T) {
	const [storedValue, setStoredValue] = useState<T>(() => {
		try {
			const item = globalThis.localStorage?.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch (error) {
			console.error('Error reading from localStorage', error);
			return initialValue;
		}
	});

	const addVal = () => {
		try {
			if (Array.isArray(storedValue) && storedValue?.length > LIMIT) storedValue.shift();
			localStorage.setItem(key, JSON.stringify(storedValue));
		} catch (e) {
			console.error('Error writing to localStorage', e);
			if (e instanceof DOMException && e.name === 'QuotaExceededError') {
				const logs = JSON.parse(localStorage.logs || '{}');
				if (Object.keys(logs)[0]) {
					console.log('deleting first log');
					delete logs[Object.keys(logs)[0]];
					localStorage.setItem('logs', JSON.stringify(logs));
					addVal();
				}
			}
		}
	};

	useEffect(() => {
		addVal();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, storedValue]);

	return [storedValue, setStoredValue];
}

```

### Core Architecture Module: `src/parlant/api/chat/src/hooks/useQuestionDialog.tsx`
```
import {Button} from '@/components/ui/button';
import {useAtom} from 'jotai';
import {dialogAtom} from '@/store';
import {useCallback} from 'react';

interface Action {
	text: string;
	onClick: () => void;
	isMainAction?: boolean;
}

export const useQuestionDialog = () => {
	const [dialog] = useAtom(dialogAtom);

	const openQuestionDialog = useCallback(
		(title: string, question: string, actions: Action[]) => {
			const Content = () => (
				<div className='h-full flex flex-col justify-between ms-[30px] me-[20px]'>
					<p className='mt-[10px]'>{question}</p>
					<div className='h-[80px] flex items-center justify-end'>
						<Button data-testid='cancel' onClick={dialog.closeDialog} className='hover:bg-[#EBE9F5] bg-[#F2F0FC] h-[46px] w-[96px] text-black rounded-[6px] py-[12px] px-[24px] me-[10px] text-[16px] font-normal'>
							Cancel
						</Button>
						{actions.map((action) => {
							if (action.isMainAction)
								return (
									<Button key={action.text} onClick={action.onClick} className='h-[46px] w-[161px] bg-green-main hover:bg-[#005C3F] rounded-[6px] py-[10px] px-[29.5px] text-[15px] font-medium'>
										{action.text}
									</Button>
								);
							return (
								<Button key={action.text} onClick={action.onClick} className='hover:bg-[#EBE9F5] bg-[#F2F0FC] h-[46px] w-[96px] text-black rounded-[6px] py-[12px] px-[24px] me-[10px] text-[16px] font-normal'>
									{action.text}
								</Button>
							);
						})}
					</div>
				</div>
			);
			return dialog.openDialog(title, <Content />, {height: '230px', width: '480px'});
		},
		[dialog]
	);

	return {openQuestionDialog, closeQuestionDialog: dialog.closeDialog};
};

```

### Core Architecture Module: `src/parlant/api/chat/src/hooks/useWebSocket.ts`
```
import {useEffect, useRef, useState, useCallback} from 'react';

interface WebSocketOptions {
	onMessage?: (message: string) => void;
	onError?: (error: Event) => void;
	onOpen?: () => void;
	onClose?: (event: CloseEvent) => void;
}

export const useWebSocket = (url: string, defaultRunning?: boolean, options?: WebSocketOptions | null, lastMessageFn?: (message: any) => void) => {
	const [isConnected, setIsConnected] = useState(false);
	const [lastMessage, setLastMessage] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);

	const sendMessage = useCallback((message: string) => {
		if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
			socketRef.current.send(message);
		} else {
			console.warn('WebSocket is not open. Unable to send message:', message);
		}
	}, []);

	const reconnect = () => {
		start();
		setTimeout(() => {
			if (!socketRef?.current?.readyState || !{[socketRef.current.OPEN]: true, [socketRef.current?.CONNECTING]: true}[socketRef.current.readyState]) {
				reconnect();
			}
		}, 5000);
	};

	useEffect(() => {
		if (defaultRunning) start();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const start = useCallback(() => {
		if (isRunning || (socketRef.current?.readyState != null && {[socketRef.current.OPEN]: true, [socketRef.current?.CONNECTING]: false}[socketRef.current.readyState])) {
			console.warn('WebSocket is already running.');
			return;
		}

		if ((socketRef.current && socketRef.current.readyState === socketRef.current.OPEN) || (socketRef.current && socketRef.current.readyState === socketRef.current?.CONNECTING)) socketRef.current.close();
		const socket = new WebSocket(url);
		socketRef.current = socket;

		socket.addEventListener('open', () => {
			setIsConnected(true);
			options?.onOpen?.();
		});

		socket.addEventListener('message', (event) => {
			const data = JSON.parse(event.data || '{}');
			setLastMessage(event.data);
			lastMessageFn?.(data);
			options?.onMessage?.(event.data);
		});

		socket.addEventListener('error', (event) => {
			console.error('WebSocket error:', event);
			options?.onError?.(event);
		});

		socket.addEventListener('close', (event) => {
			console.info('WebSocket closed:', event);
			setIsConnected(false);
			options?.onClose?.(event);
			setTimeout(() => {
				if (socketRef?.current?.readyState === 0 || socketRef?.current?.readyState === 1) return;
				reconnect();
			}, 5000);
		});

		setIsRunning(true);
	}, [url, options, isRunning]);

	const pause = useCallback(() => {
		if (socketRef.current) {
			socketRef.current.close();
			socketRef.current = null;
		}
		setIsConnected(false);
		setIsRunning(false);
	}, []);

	useEffect(() => {
		return () => {
			if (socketRef.current) {
				socketRef.current.close();
			}
		};
	}, []);

	return {isConnected, lastMessage, sendMessage, start, pause, isRunning};
};

```

### Core Architecture Module: `src/parlant/api/chat/src/lib/utils.ts`
```
/* eslint-disable @typescript-eslint/no-explicit-any */
import {clsx, type ClassValue} from 'clsx';
import {toast} from 'sonner';
import {twMerge} from 'tailwind-merge';
import './broadcast-channel';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const isSameDay = (dateA: string | Date, dateB: string | Date): boolean => {
	if (!dateA) return false;
	return new Date(dateA).toLocaleDateString() === new Date(dateB).toLocaleDateString();
};

export const copy = (text: string, element?: HTMLElement) => {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard
			.writeText(text)
			.then(() => toast.info(text?.length < 100 ? `Copied text: ${text}` : 'Text copied'))
			.catch(() => {
				fallbackCopyText(text, element);
			});
	} else {
		fallbackCopyText(text, element);
	}
};

export const fallbackCopyText = (text: string, element?: HTMLElement) => {
	const textarea = document.createElement('textarea');
	textarea.value = text;
	(element || document.body).appendChild(textarea);
	textarea.style.position = 'fixed';
	textarea.select();
	try {
		const successful = document.execCommand('copy');
		if (successful) {
			toast.info(text?.length < 100 ? `Copied text: ${text}` : 'Text copied');
		} else {
			console.error('Fallback: Copy command failed.');
		}
	} catch (error) {
		console.error('Fallback: Unable to copy', error);
	} finally {
		(element || document.body).removeChild(textarea);
	}
};

export const timeAgo = (date: Date): string => {
	date = new Date(date);
	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	// const weeks = Math.floor(days / 7);
	// const months = Math.floor(days / 30);
	const years = Math.floor(days / 365);

	if (seconds < 60) return 'less than a minute ago';
	if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
	if (hours < 24) return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: false});
	else return date.toLocaleString('en-US', {year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false});
	// if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
	// if (days === 1) return 'yesterday';
	// if (days < 7) return `${days} days ago`;
	// if (weeks === 1) return 'last week';
	// if (weeks < 4) return `${weeks} weeks ago`;
	// if (months === 1) return 'a month ago';
	// if (months < 12) return `${months} months ago`;
	// if (years === 1) return 'last year';
	return `${years} years ago`;
};

export const exportToCsv = (data: any[], filename: string, options: any = {}) => {
  try {
    const {
      headers = [],
      delimiter = ',',
      includeHeaders = true,
      dateFormat = 'iso'
    } = options;

    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const csvHeaders = headers.length > 0 ? headers : Object.keys(data[0]);
    
    const escapeField = (field: string) => {
      const stringField = String(field || '');
      if (stringField.includes(delimiter) || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const formatValue = (value: string | Date) => {
      if (value instanceof Date) {
        return dateFormat === 'readable' ? value.toLocaleString() : value.toISOString();
      }
      return value;
    };

    const csvRows = [];
    
    if (includeHeaders) {
      csvRows.push(csvHeaders.map((header: string) => escapeField(header)).join(delimiter));
    }
    
    data.forEach(row => {
      const values = csvHeaders.map((header: string) => {
        const value = row[header];
        return escapeField(formatValue(value));
      });
      csvRows.push(values.join(delimiter));
    });

    const csvContent = csvRows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('CSV export failed:', error);
    throw error;
  }
};

function openIndexeddbDB(dbName: string, storeName: string, indexVals?: {name: string, keyPath: string}) {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
			const db = request.result;

			if (!db.objectStoreNames.contains(storeName)) {
				const store = db.createObjectStore(storeName, {autoIncrement: true});
        if (indexVals) {
          store.createIndex(indexVals.name, indexVals.keyPath, {unique: false});
        }
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export const addItemToIndexedDB = async (
  dbName: string,
  storeName: string,
  key: string,
  value: any,
  mode: 'update' | 'multiple' = 'update',
  indexVals?: {name: string, keyPath: string},
) => {
  const db = await openIndexeddbDB(dbName, storeName, indexVals);
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  if (mode === 'multiple') {
    const getRequest = store.get(key);
    getRequest.onsuccess = () => {
      let current = getRequest.result;
      if (!Array.isArray(current)) {
        current = current !== undefined ? [current] : [];
      }
      current.push(value);
      const putRequest = store.put(current, key);
      putRequest.onsuccess = () => {
        console.log('Item appended in IndexedDB');
      };
      putRequest.onerror = () => {
        console.error('Error appending item in IndexedDB');
      };
    };
    getRequest.onerror = () => {
      console.error('Error getting item for multiple mode in IndexedDB');
    };
  } else {
    const request = store.put(value, key);
    request.onerror = () => {
      console.error('Error updating item in IndexedDB');
    };
  }
};

export const deleteItemFromIndexedDB = async (dbName: string, storeName: string, key: string) => { 
  const db = await openIndexeddbDB(dbName, storeName);
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  const request = store.delete(key);
  request.onerror = () => {
    console.error('Error deleting item in IndexedDB');
  };
};

export const getItemFromIndexedDB = async (dbName: string, storeName: string, key: string, indexVals?: {name: string, keyPath: string}) => {
  try {

    const db = await openIndexeddbDB(dbName, storeName, indexVals);
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const response = await new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return response;
  } catch (error) {
    console.error('Error opening IndexedDB:', error);
    return null;
  }
};

export const getIndexedItemsFromIndexedDB = async (dbName: string, storeName: string, indexName: string, indexKey: string, indexVals?: {name: string, keyPath: string}, asObject?: boolean) => {
  try {
    const db = await openIndexeddbDB(dbName, storeName, indexVals);
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const response: any = await new Promise((resolve, reject) => {
      const request = index.getAll(indexKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return asObject ? response.reduce((acc: Record<string, string>, item: any) => {
      acc[item.traceId] = item.flagValue;
      return acc;
    }, {} as Record<string, string>) : response;
  } catch (error) {
    console.error('Error opening IndexedDB:', error);
    return null;
  }
}
```

### Core Architecture Module: `src/parlant/api/chat/src/utils/api.ts`
```
/**
 * Detect base path from current URL for path-based routing.
 * Extracts the first path segment if it's not a known route.
 * e.g., "/QfnuAKfKSf/chat" -> "/QfnuAKfKSf"
 */
const getBasePath = (): string => {
	const path = window.location.pathname;
	const segments = path.split('/').filter(Boolean);
	
	// If first segment isn't a known route, use it as base path
	if (segments.length > 0 && !['chat', 'docs', 'api', 'healthz'].includes(segments[0])) {
		return '/' + segments[0];
	}
	return '';
};

export const BASE_URL = import.meta.env.VITE_BASE_URL || getBasePath();

const request = async (url: string, options: RequestInit = {}) => {
	try {
		const response = await fetch(url, options);
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}
		if (options.method === 'PATCH' || options.method === 'DELETE') return;
		return await response.json();
	} catch (error) {
		console.error('Fetch error:', error);
		throw error;
	}
};

export const getData = async (endpoint: string) => {
	return request(`${BASE_URL}/${endpoint}`);
};

export const postData = async (endpoint: string, data?: object) => {
	return request(`${BASE_URL}/${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	});
};

export const patchData = async (endpoint: string, data: object) => {
	return request(`${BASE_URL}/${endpoint}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	});
};

export const deleteData = async (endpoint: string) => {
	return request(`${BASE_URL}/${endpoint}`, {
		method: 'DELETE',
	});
};

```

### Core Architecture Module: `src/parlant/api/chat/src/utils/date.tsx`
```
export const getDateStr = (date: Date | string): string => {
    date = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };

    return date.toLocaleDateString('en-US', options);
};

export const getTimeStr = (date: Date |string): string => {
    date = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
  
    return date.toLocaleTimeString('en-US', options);
  };
```

### Core Architecture Module: `src/parlant/api/chat/src/utils/interfaces.tsx`
```
export interface AgentInterface {
	id: string;
	name: string;
}

export interface CustomerInterface {
	id: string;
	name: string;
}

export interface Log {
	level: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' | 'TRACE';
	trace_id: string;
	message: string;
	timestamp: number;
}

export type ServerStatus = 'pending' | 'error' | 'accepted' | 'acknowledged' | 'processing' | 'typing' | 'ready';
type eventSource = 'customer' | 'customer_ui' | 'human_agent' | 'human_agent_on_behalf_of_ai_agent' | 'ai_agent' | 'system';

export interface EventInterface {
	id?: string;
	source: eventSource;
	kind: 'status' | 'message';
	trace_id: string;
	serverStatus: ServerStatus;
	sessionId?: string;
	error?: string;
	offset: number;
	creation_utc: Date;
	data: {
		participant?: { display_name?: string }
		status?: ServerStatus;
		draft?: string;
		canned_responses?: string[];
		message: string;
		data?: { exception?: string, stage?: string };
		tags?: string;
		chunks?: (string | null)[];
	};
	index?: number;
}

export interface SessionInterface {
	id: string;
	title: string;
	customer_id: string;
	agent_id: string;
	creation_utc: string;
}

export interface SessionCsvInterface {
	Source: 'AI Agent' | 'Customer';
	Participant: string;
	Timestamp: Date;
	Message: string;
	Draft: string;
	Tags: string;
	Flag: string;
	'Trace ID': string;
}

```

### Core Architecture Module: `src/parlant/api/chat/src/utils/logs.ts`
```
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-escape */
import { hasOtherOpenedTabs } from '@/lib/broadcast-channel';
import {Log} from './interfaces';

const logLevels = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'TRACE'];
export const DB_NAME = 'Parlant';
const STORE_NAME = 'logs';
const MAX_RECORDS = 2000;
const CHECK_INTERVAL = 10 * 60 * 1000;

export function getIndexedDBSize(databaseName = DB_NAME, tableName = STORE_NAME): Promise<number> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName);

		request.onerror = (event) => {
			const target = event?.target as IDBOpenDBRequest;
			const error = target?.error;
			reject(new Error(`Failed to open database: ${error}`));
		};

		request.onsuccess = (event) => {
			const target = event?.target as IDBOpenDBRequest;
			const db = target?.result;

			if (!db.objectStoreNames.contains(tableName)) {
				db.close();
				reject(new Error(`Table "${tableName}" does not exist in database "${databaseName}"`));
				return;
			}

			const transaction = db.transaction(tableName, 'readonly');
			const store = transaction.objectStore(tableName);

			const getAllRequest = store.getAll();

			getAllRequest.onerror = (event: Event) => {
				db.close();
				const target = event.target as IDBRequest;
				reject(new Error(`Failed to read data: ${target.error}`));
			};

			getAllRequest.onsuccess = (event: Event) => {
				const target = event.target as IDBRequest;
				const records = target.result;
				let totalSize = 0;

				records.forEach((record: Record<string, unknown>) => {
					const serialized = JSON.stringify(record);
					totalSize += serialized.length * 2;
				});

				const sizeInMB = totalSize / (1024 * 1024);

				db.close();
				resolve(sizeInMB);
			};
		};
	});
}

export function clearIndexedDBData(dbName = DB_NAME, objectStoreName = STORE_NAME) {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName);

		request.onerror = (event) => {
			const target = event?.target as IDBOpenDBRequest;
			const error = target?.error;
			reject(error);
		};

		request.onsuccess = (event) => {
			const target = event?.target as IDBOpenDBRequest;
			const db = target?.result;
			const transaction = db.transaction(objectStoreName, 'readwrite');
			const objectStore = transaction.objectStore(objectStoreName);
			const clearRequest = objectStore.clear();

			clearRequest.onsuccess = () => {
				resolve(null);
			};

			clearRequest.onerror = (clearEvent: Event) => {
				const target = clearEvent.target as IDBRequest;
				reject(target.error);
			};

			transaction.oncomplete = () => {
				db.close();
			};
		};
	});
}

function openDB(storeName = STORE_NAME) {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);

		request.onupgradeneeded = () => {
			const db = request.result;

			if (!db.objectStoreNames.contains(storeName)) {
				const store = db.createObjectStore(storeName, {autoIncrement: true});

				store.createIndex('timestampIndex', 'timestamp', {unique: false});
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function getLogs(trace_id: string): Promise<Log[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(trace_id);
		request.onsuccess = () => resolve(request.result?.values || []);
		request.onerror = () => reject(request.error);
	});
}

export const handleChatLogs = async (log: Log) => {
	if (hasOtherOpenedTabs()) return;
	const db = await openDB();
	const transaction = db.transaction(STORE_NAME, 'readwrite');
	const store = transaction.objectStore(STORE_NAME);

	const logEntry = store.get(log.trace_id);

	logEntry.onsuccess = () => {
		const data = logEntry.result;
		const timestamp = Date.now();
		if (!data?.values) {
			if (!log.message?.trim().startsWith('HTTP') || log.message?.includes('/events')) store.put({timestamp, values: [log]}, log.trace_id);
		} else {
			data.values.push(log);
			store.put({timestamp, values: data.values}, log.trace_id);
		}
		window.dispatchEvent(new CustomEvent('new-log', {detail: {trace_id: log.trace_id}}));
	};
	logEntry.onerror = () => console.error(logEntry.error);
};

export const getMessageLogs = async (trace_id: string): Promise<Log[]> => {
	return getLogs(trace_id);
};

export const getMessageLogsWithFilters = async (trace_id: string, filters: {level: string; types?: string[]; content?: string[]}): Promise<Log[]> => {
	const logs = await getMessageLogs(trace_id);
	const escapedWords = filters?.content?.map((word) => word.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'));
	const pattern = escapedWords?.map((word) => `\\[?${word}\\]?`).join('.*?');
	const levelIndex = filters.level ? logLevels.indexOf(filters.level) : null;
	const validLevels = filters.level ? new Set(logLevels.filter((_, i) => i <= (levelIndex as number))) : null;
	const filterTypes = filters.types?.length ? new Set(filters.types) : null;

	return logs.filter((log) => {
		if (validLevels && !validLevels.has(log.level)) return false;
		if (pattern) {
			const allWordsMatch = escapedWords?.every((word) => {
				const regex = new RegExp(`\\[?${word}\\]?`, 'i'); // Allow optional brackets
				return regex.test(`[${log.level}]${log.message}`);
			  });
			if (!allWordsMatch) return false;
		}
		if (filterTypes) {
			const matches = [...log.message.matchAll(/\[([^\]]+)\]/g)].map(m => m?.[1]);
			const match = matches[0]?.startsWith('T+') ? matches[1] : matches[0];
			const type = match || 'General';
			return filterTypes.has(type);
		}
		return true;
	});
};

export async function getAgentMessageLogsCount(): Promise<Log[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		try {
			const transaction = db.transaction(STORE_NAME, 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index('timestampIndex');
			const data = index.openCursor();

			const items: any[] = [];

			data.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					if (cursor.primaryKey?.includes('::')) items.push(cursor.value);
					cursor.continue();
				} else {
					resolve(items);
				}
			};

			data.onerror = () => reject(data.error);
		} catch (error) {
			db.close();
			reject(error);
		}
	});
}

export async function getAllLogKeys(): Promise<IDBValidKey[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const keysRequest = store.getAllKeys();

		keysRequest.onsuccess = () => {
			db.close();
			resolve(keysRequest.result);
		};

		keysRequest.onerror = () => {
			db.close();
			reject(keysRequest.error);
		};
	});
}

export async function deleteOldestLogs(deleteTimestamp = 0): Promise<void> {
	if (!deleteTimestamp || deleteTimestamp <= 0) {
		console.log('No valid deletion timestamp provided, skipping cleanup');
		return;
	}

	try {
		const db = await openDB();
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const keysRequest = store.getAllKeys();
		const valuesRequest = store.getAll();

		return new Promise((resolve, reject) => {
			let keys: IDBValidKey[] = [];
			let values: any[] = [];

			keysRequest.onsuccess = () => {
				keys = keysRequest.result;
				if (values.length > 0) deleteOldest();
			};

			valuesRequest.onsuccess = () => {
				values = valuesRequest.result;
				if (keys.length > 0) deleteOldest();
			};

			const deleteOldest = () => {
				const keysToDelete = [];
				for (const i in keys) {
					const data = values[i];
					if (data.timestamp < deleteTimestamp) keysToDelete.push(keys[i]);
				}

				if (keysToDelete.length === 0) {
					db.close();
					resolve();
					return;
				}

				const deleteTransaction = db.transaction(STORE_NAME, 'readwrite');
				const deleteStore = deleteTransaction.objectStore(STORE_NAME);

				let completed = 0;
				let errors = 0;

				keysToDelete.forEach((key) => {
					const deleteRequest = deleteStore.delete(key);

					deleteRequest.onsuccess = () => {
						completed++;
						if (completed + errors === keysToDelete.length) {
							if (errors > 0) {
								console.warn(`Completed with ${errors} errors`);
							}
						}
					};

					deleteRequest.onerror = (event) => {
						errors++;
						console.error(`Failed to delete key ${key}:`, (event.target as IDBRequest).error);
					};
				});

				deleteTransaction.oncomplete = () => {
					db.close();
					console.log(`Successfully deleted ${completed} records older than ${new Date(deleteTimestamp).toISOString()}`);
					resolve();
				};

				deleteTransaction.onerror = (event) => {
					db.close();
					reject((event.target as IDBTransaction).error);
				};
			};

			transaction.onerror = (event) => {
				db.close();
				reject((event.target as IDBTransaction).error);
			};
		});
	} catch (error) {
		console.error('Error in deleteOldestLogs:', error);
		throw error;
	}
}

export async function checkAndCleanupLogs(): Promise<void> {
	try {
		const agentMessages = await getAgentMessageLogsCount();

		if (agentMessages[MAX_RECORDS]) {
			const recordsToDeleteDate = agentMessages[agentMessages.length - MAX_RECORDS]?.timestamp || 0;
			console.log(`Log count exceeds maximum (${MAX_RECORDS}), deleting logs before ${new Date(recordsToDeleteDate)?.toLocaleString()}`);
			await deleteOldestLogs(recordsToDeleteDate);
			console.log('Cleanup completed');
		}
	} catch (error) {
		console.error('Error during log cleanup:', error);
	}
}

let cleanupInterval: number | null = null;

export function startLogCleanup(): void {
	checkAndCleanupLogs();

	if (!cleanupInterval) {
		cleanupInterval
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #828** (2026-07-26): **[Bug]  Guideline↔tag associations dropped on restart (association loader stuck at v0.5.0)**
  *Symptoms*: # Description Guidelines created with tags (`agent:…` / `journey:…`) lose their tags after a server restart. On load, the association documents get moved into a `failed_migrations` collection instead of loading.  The cause looks like `GuidelineDocumentStore._association_document_loader` only handles versions up to `0.5.0`:  ```python if doc["version"] == "0.5.0":     return cast(GuidelineTagAssociationDocument, doc)  return None ``` …but the store writes associations at its current VERSION (0.10.0), so the loader returns None for them and they never load. The guideline _document_loader just above it does have a 0.9.0 → 0.10.0 migration — the association loader seems to have been missed.  How to Reproduce  Steps to reproduce the behavior: 1. Start parlant-server with local (JSON) storage. 2. Create a guideline via the REST client with tags=["agent:<id>"]. 3. Restart the server (with --migrate). 4. guideline_tag_associations is empty, the docs are in failed_migrations, and the guideline is no longer scoped to the agent.  Expected Behavior  Associations written at the store's current version reload normally, so guidelines keep their agent:/journey: scoping across restarts.  Environment  - OS: Windows 11 - Python version: 3.10 - Parlant version: 3.3.2  Discussion  Fails silently — guidelines just quietly stop being agent/journey-scoped after any restart. Journeys are unaffected (they use a separate loader). Looks like it only needs a passthrough branch for the current version (an
  **Post-Mortem & Fix Analysis**:
  > Seems this has been resolved but not yet released, meanwhile done the same patch. Closing and waiting for new release.

- **Issue #761** (2026-04-28): **[Security] LiteLLM supply chain attack**
  *Symptoms*: LiteLLM has been the victim of a critical security compromise. Versions 1.82.7 to 1.82.8 steal credentials from users as detailed [here](https://docs.litellm.ai/blog/security-update-march-2026).  Suggested remediation: - Block the impacted versions in [pyproject.toml](https://python-poetry.org/docs/dependency-specification/) and bump the Parlant version to 3.3.1 - Publish a security notice by following [these instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/publishing-a-repository-security-advisory) - If anyone from Emcie has been impacted directly, revoke and change all passwords, API keys, and authorizations  *Update 3/26: Cybernews has [published](https://cybernews.com/security/critical-litellm-supply-chain-attack-sends-shockwaves/) a useful article summarizing this attack*  *Update 3/27: FutureSearch [reports](https://futuresearch.ai/blog/litellm-hack-were-you-one-of-the-47000/) that there were only about 47,000 impacted users because PyPI quarantined the malicious packages after 46 minutes*
  **Post-Mortem & Fix Analysis**:
  > Fixed in #784 

- **Issue #741** (2026-05-13): **[Bug] MongoDB session store failure**
  *Symptoms*: # Description When using MongoDB session store for `p.Server`, the server hangs when handling client requests (in particular, /sessions endpoint)  # How to Reproduce Steps to reproduce the behavior: 1. Add `pyproject.toml` with dependencies: ```toml [project] name = "agent" version = "0.1.0" description = "Add your description here" readme = "README.md" requires-python = ">=3.11" dependencies = [     "aiohttp>=3.9.0",     "fastapi>=0.115.0",     "lagom>=2.7.7",     "parlant[mongo]>=3.2.0",     "pydantic>=2.11.9",     "pydash>=8.0.6",     "python-dotenv>=1.0.0",     "pyyaml>=6.0",     "qdrant-client>=1.13.0",     "requests>=2.32.5",     "uvicorn[standard]>=0.30.0", ] ``` 2. Set up dockerfile: ```dockerfile FROM astral/uv:python3.11-trixie  WORKDIR /app  COPY pyproject.toml .python-version ./  RUN uv sync  COPY . .  HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \     CMD .venv/bin/python -m src.healthcheck || exit 1  CMD [".venv/bin/python", "-m", "src.main"] ``` 2. Set up the following docker compose for server and Mongo storage: ```yaml services:   agent:     build: .     container_name: agent     env_file: .env     network_mode: host     ports:       - ${SERVER_PORT}:${SERVER_PORT}     volumes:       - parlant-data:/app/parlant-data     depends_on:       - mongo   mongo:     image: mongo:8.2.5     restart: always     environment:       MONGO_INITDB_ROOT_USERNAME: ${MONGODB_USER}       MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}     ports:       -
  **Post-Mortem & Fix Analysis**:
  > @StaszekM can you please check if the mongo connection string is accessible from your parlant pod? Sometimes you need host.docker.internal instead of localhost in such scenarios.  For reference, we're testing mongo continuously on the managed hosting platform we're building and it's working for us.
  > Hi @kichanyurd, we tried setting the connections once again and the problem does not occur anymore. However it may be the case that in local development scenario we must keep the `?authSource=admin` part in the URL for both collections to work. Without this part, we get `pymongo.errors.OperationFailure: Authentication failed` Anyway closing the issue :)

- **Issue #739** (2026-03-08): **[Bug] Embedding retry policy doesn't cover ValueError: No embedding data received**
  *Symptoms*:  Body:    Description    The @policy retry decorator on OpenRouterEmbedder.do_embed does not retry when the OpenAI   SDK raises ValueError("No embedding data received"). This causes the entire engine   preparation iteration to fail on a transient upstream issue.    Error    ValueError: No embedding data received    Raised by the OpenAI SDK's post-parser in openai/resources/embeddings.py when the API   returns HTTP 200 but with an empty data array.    Root Cause    The retry policy in parlant/adapters/nlp/openrouter_service.py (lines ~418-431) only covers   API transport errors:    @policy(       [           retry(               exceptions=(                   APIConnectionError,                   APITimeoutError,                   ConflictError,                   RateLimitError,                   APIResponseValidationError,               ),           ),           retry(InternalServerError, max_exceptions=2, wait_times=(1.0, 5.0)),       ]   )   async def do_embed(self, texts, hints):    ValueError is a plain Python exception raised after the HTTP call succeeds, so it bypasses   the retry policy entirely.    Impact    A single transient empty embedding response from the upstream provider kills the entire   _run_preparation_iteration — glossary terms fail to load and the agent cannot process the   message.     ---
  **Post-Mortem & Fix Analysis**:
  > @interactivealex thanks for reporting! Would you mind doing a PR to fix this for OpenRouter?

- **Issue #738** (2026-02-28): **[Bug] JSONFileDocumentDatabase.__aexit__ does not handle CancelledError, causing server crash on shutdown**
  *Symptoms*:   ## Summary    An unhandled `asyncio.CancelledError` during `JSONFileDocumentDatabase.__aexit__()` can   crash the entire Parlant server process (exit code 1). The crash occurs because the   `__aexit__` method acquires an `aiorwlock` writer lock — which internally does `await   asyncio.sleep(0.0)` — without any `CancelledError` protection. This is a production crash we    encountered under load.    ## Affected Version    Parlant 3.1.2 (`a512916c`)    ## Bug Description    `JSONFileDocumentDatabase.__aexit__()` ([`src/parlant/adapters/db/json_file.py:74-82`](https   ://github.com/emcie-co/parlant/blob/a512916c/src/parlant/adapters/db/json_file.py#L74-L82))   has no `try/except` around its lock acquisition + flush:    ```python   async def __aexit__(self, exc_type, exc_value, traceback) -> bool:       async with self._lock.writer_lock:           await self._flush_unlocked()       return False    The ReaderWriterLock wraps aiorwlock.RWLock() with default fast=False   (src/parlant/core/async_utils.py:236). With fast=False, aiorwlock calls await   asyncio.sleep(0.0) in _yield_after_acquire on every lock acquisition — even uncontended   ones. This sleep(0) is a cancellation checkpoint: if a CancelledError is pending, it fires   there.    The aiorwlock library handles this correctly on its side (releases lock state, re-raises),   but JSONFileDocumentDatabase.__aexit__ does not catch the re-raised CancelledError. It   propagates through the exit stacks and kills the process.    Why 

- **Issue #736** (2026-02-28): **[Bug] Non-consequential tool rejected due to optional parameters marked "<<missing>>"**
  *Symptoms*: # Description  I’m observing behavior that I’m not sure is intentional; it may conflict with documentation or comments. Details below:  ### Observed behavior - Tool `my_tool_call` defines two optional parameters `foo` and `bar` (not required). - In the non-consequential path, the LLM inference outputs CASE 3, marking both optional parameters as `"<<__missing__>>"` with `should_run: true`. - However, in the subsequent evaluation phase, the tool is rejected with logs indicating “Missing arguments” and CANNOT_RUN.  ### Relevant code references - In `_evaluate_non_consequential_tool_calls`, `missing_required` includes any parameter with value `"<<__missing__>>"`, regardless of whether it’s in `tool.required` . - Whenever `missing_required` is non-empty, the tool call is rejected and missing warnings are logged [2](#3-1) . - The method’s comment says “Check if all required parameters are present,” but the implementation doesn’t distinguish required from optional  . - The non-consequential prompt’s CASE 1 explicitly allows inserting `null` for optional parameters that can’t be inferred and creating the call  .  ### Contrast with the consequential path - In the consequential path, execution is blocked only when parameters in `tool.required` are MISSING; optional MISSING does not block  . - Missing optional parameters are explicitly set to `None`, and the tool still executes  .  ### Potential conflict with documentation - Documentation I’ve seen describes non-consequential as “Instan
  **Post-Mortem & Fix Analysis**:
  > Fixed in 12afdb490.  The issue was in `_evaluate_non_consequential_tool_calls` in `single_tool_batch.py`.  The missing-parameter check was treating all parameters with "`<<__missing__>>"` as blocking, without distinguishing between required and optional.        The consequential path already handled this correctly (only blocking on missing required params, and setting optional ones to None), but the non-consequential path didn't follow the same logic. They're now aligned.  Thanks for bringing this up, @flowjzh !
  > Hi @kichanyurd ,  Thanks for the lightning-fast fix! I really appreciate the quick turnaround and for aligning the non-consequential path logic with the consequential one.  BTW, I’ve been testing the new non-consequential feature with the qwen-next-80b-a3b model, and the results are impressive. It cut our tool call processing time from ~10s down to under 5s. This is a massive performance gain for our workflow!  Thanks to the whole Parlant team for the great work. Wishing the project continued and long-term success! 🚀

- **Issue #735** (2026-03-18): **[Bug] LiteLLMEmbedder fails to resolve via lagom container when LITELLM_EMBEDDING_MODEL_NAME is set**
  *Symptoms*: # Environment    - parlant[litellm]: 3.2.2   - Python: 3.13  # Description  When using `p.Server(nlp_service=p.NLPServices.litellm)` with `LITELLM_EMBEDDING_MODEL_NAME` set, the server raises:  ``` lagom.exceptions.UnresolvableType: Unable to construct dependency of type LiteLLMEmbedder   The constructor probably has some unresolvable dependencies: LiteLLMEmbedder ```  ## Point of crash  I saw that it crashes in `parlant/core/nlp/embedding.py`:  ```py   def create_embedder(self, embedder_type: type[Embedder]) -> Embedder:       if embedder_type == NullEmbedder:           return NullEmbedder()       else:           return self._container[embedder_type]  # ← fails for LiteLLMEmbedder ```  ## Possible explanation (from Claude)  `LiteLLMEmbedder.__init__` requires model_name: str as its first positional argument. Lagom cannot auto-wire this because str is not a specifically registered type in the container. Since `LiteLLMEmbedder` is never registered with a factory that supplies model_name from the environment, the container raises UnresolvableType.  Note that `LiteLLMService.get_embedder()` already contains the correct logic to construct LiteLLMEmbedder from env vars — but this path is apparently bypassed in some code paths that go through EmbedderFactory.  # Workaround (suggested by Codex)  Subclass LiteLLMService and override get_embedder to bypass the container:  ```py     # TODO: Patched classes suggested by Codex     class DynamicLiteLLMEmbedder(LiteLLMEmbedder):         de
  **Post-Mortem & Fix Analysis**:
  > Fixed in fa563be81. The issue was that LiteLLMEmbedder takes a model_name: str constructor parameter that lagom's DI container can't auto-resolve. We now pre-register the embedder instance in the container during LiteLLM service initialization, so EmbedderFactory can resolve it.  **A related caveat to be aware of:**  The LiteLLM NLP service was an external contribution that doesn't fully meet our design standards for first-class NLP services.  Specifically, the vector DB layer identifies collections by embedder class name (e.g. `glossary_LiteLLMEmbedder`). This means if you change `LITELLM_EMBEDDING_MODEL_NAME` between server restarts (say from `text-embedding-3-small` to `text-embedding-ada-002`), the system won't detect that the embedder changed and won't re-index your data, so you'll end up querying stale embeddings from the old model, which corrupts your semantic space.  If you do switch embedding models, you should clear your vector store data to force re-indexing on the next star

- **Issue #734** (2026-02-27): **Chat UI event polling creates a tight infinite loop on idle sessions**
  *Symptoms*:    Affected version: Parlant SDK **3.1.2** (polling-based chat UI, before the SSE migration on main)    Symptom: Thousands of GET /sessions/{id}/events?min_offset=N requests per second on sessions that have    finished processing. The min_offset never advances.    Root cause: In session-view.tsx, formatMessagesFromEvents() calls setLastOffset(offset + 1) and then   refetch() synchronously on line 173. Since React batches state updates, the refetch() triggers   fetchData() inside useFetch which captures params (including min_offset) from the current render   closure — before React commits the new lastOffset. The fetch goes out with the stale min_offset.    On the backend, PollingSessionListener.wait_for_events() returns True immediately when events exist at    the requested offset (sessions.py:1337-1338). So the API returns 200 instantly instead of blocking   for 60s. Combined with the stale offset, this creates a tight loop: fetch → 200 → same events →   refetch with same offset → 200 → repeat, with no backoff.    Additional factor: useFetch is called with checkErr=false, so 504 timeouts also retry immediately   without any delay (line 84).    Impact: Saturates the server with requests, floods OTEL trace exports, and wastes bandwidth.    Note: We see the SSE migration on main (0afdb95c, dee012ec) fixes this by using EventSource + useRef    for offset tracking. Any timeline for releasing this in the SDK?
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, @interactivealex.                                                                                                                                       The tight polling loop you identified in the chat UI has been fixed, like you mentioned.  Regarding the Python SDK (parlant-client-python): the `list_events` endpoint supports both long-polling and SSE modes.  If you're using the SDK directly in a polling loop, I'd recommend switching to `sse=True` to avoid this class of issue entirely.  With long-polling mode, the 504 timeout on idle sessions is expected behavior. Callers should add a backoff delay before retrying.  Thanks again for raising this!

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

### Incident Patch 1: `b5142aea` (2026-06-21)
**Commit Message**: DCO Remediation Commit for Chibuike Mba <[REDACTED_EMAIL]>

I, Chibuike Mba <[REDACTED_EMAIL]>, hereby add my Signed-off-by to this commit: a96888a4820912bcdcb447f7f5eddcc5282a1302

Signed-off-by: Chibuike Mba <[REDACTED_EMAIL]>



---

### Incident Patch 2: `a96888a4` (2026-06-21)
**Commit Message**: fix(core): prevent version drift from silently dropping tag associations on restart

The `_association_document_loader` and several `_document_loader` implementations were using strict equality checks (`==`) against specific version numbers (e.g., `doc["version"] == "0.5.0"`). When a main store's `VERSION` was bumped, new tag associations were written with the newer version string. However, upon restart, these new documents failed the strict equality check and were silently dropped and moved to the `_failed_migrations` collection.

Changes:
- Added `__ge__` and `__le__` methods to the `Version` class in `common.py` to support semantic version range comparisons.
- Replaced the strict `==` version checks with `>=` range checks on the latest supported versions.
- Applied this fix across all affected document stores without an automated `DocumentMigrationHelper` (`guidelines.py`, `agents.py`, `customers.py`, `tags.py`, `capabilities.py`, `nlp/embedding.py`, and `guideline_tool_associations.py`).

**File**: `src/parlant/core/agents.py` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ async def _association_document_loader(
                 tag_id=TagId(doc["tag_id"]),
             )
 
-        if doc["version"] == "0.5.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.5.0"):
             return doc
 
         return None
```

**File**: `src/parlant/core/capabilities.py` (modified, +3/-3)
```diff
@@ -193,19 +193,19 @@ def __init__(
     async def _vector_document_loader(
         self, doc: VectorBaseDocument
     ) -> Optional[CapabilityVectorDocument]:
-        if doc["version"] == self.VERSION.to_string():
+        if Version.from_string(doc["version"]) >= self.VERSION:
             return cast(CapabilityVectorDocument, doc)
         return None
 
     async def _document_loader(self, doc: BaseDocument) -> Optional[CapabilityDocument]:
-        if doc["version"] == self.VERSION.to_string():
+        if Version.from_string(doc["version"]) >= self.VERSION:
             return cast(CapabilityDocument, doc)
         return None
 
     async def _association_document_loader(
         self, doc: BaseDocument
     ) -> Optional[CapabilityTagAssociationDocument]:
-        if doc["version"] == self.VERSION.to_string():
+        if Version.from_string(doc["version"]) >= self.VERSION:
             return cast(CapabilityTagAssociationDocument, doc)
         return None
 
```

**File**: `src/parlant/core/common.py` (modified, +10/-0)
```diff
@@ -138,6 +138,16 @@ def __gt__(self, other: object) -> bool:
             return NotImplemented
         return self._v > other._v
 
+    def __ge__(self, other: object) -> bool:
+        if not isinstance(other, Version):
+            return NotImplemented
+        return self._v >= other._v
+
+    def __le__(self, other: object) -> bool:
+        if not isinstance(other, Version):
+            return NotImplemented
+        return self._v <= other._v
+
 
 class ItemNotFoundError(Exception):
     def __init__(self, item_id: UniqueId, message: Optional[str] = None) -> None:
```

**File**: `src/parlant/core/customers.py` (modified, +2/-2)
```diff
@@ -167,7 +167,7 @@ def __init__(
         self._lock = ReaderWriterLock()
 
     async def _document_loader(self, doc: BaseDocument) -> Optional[_CustomerDocument]:
-        if doc["version"] == "0.1.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.1.0"):
             return cast(_CustomerDocument, doc)
 
         return None
@@ -185,7 +185,7 @@ async def _association_document_loader(
                 tag_id=doc["tag_id"],
             )
 
-        if doc["version"] == "0.2.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.2.0"):
             return cast(_CustomerTagAssociationDocument, doc)
 
         return None
```

**File**: `src/parlant/core/guideline_tool_associations.py` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ async def _document_loader(
         self,
         doc: BaseDocument,
     ) -> Optional[_GuidelineToolAssociationDocument]:
-        if doc["version"] == "0.1.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.1.0"):
             return cast(_GuidelineToolAssociationDocument, doc)
         return None
 
```

**File**: `src/parlant/core/guidelines.py` (modified, +1/-1)
```diff
@@ -538,7 +538,7 @@ async def _association_document_loader(
                 tag_id=d["tag_id"],
             )
 
-        if doc["version"] == "0.5.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.5.0"):
             return cast(GuidelineTagAssociationDocument, doc)
 
         return None
```

**File**: `src/parlant/core/nlp/embedding.py` (modified, +1/-1)
```diff
@@ -398,7 +398,7 @@ async def _document_loader(self, doc: BaseDocument) -> Optional[EmbedderResultDo
                 vectors=d["vectors"],
             )
 
-        if doc["version"] == "0.2.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.2.0"):
             return cast(EmbedderResultDocument, doc)
 
         return None
```

**File**: `src/parlant/core/tags.py` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ def __init__(
         self._lock = ReaderWriterLock()
 
     async def _document_loader(self, doc: BaseDocument) -> Optional[_TagDocument]:
-        if doc["version"] == "0.1.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.1.0"):
             return cast(_TagDocument, doc)
         return None
 
```

---

### Incident Patch 3: `70c7b24c` (2026-06-03)
**Commit Message**: Merge pull request #805 from santangelx/fix/journey-reachable-follow-ups-fan-in

fix: make journey reachable-follow-ups order-independent at fan-in nodes

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ All notable changes to Parlant will be documented here.
 
 - Fix low-criticality matcher logging the entire inference blob once per guideline in a batch (N copies of the same payload at debug level); now logs a single per-item entry
 - Fix WebSocketLogger event loop starvation — when no WebSocket clients are subscribed, the drain loop processed queued messages without yielding, progressively blocking the async event loop and causing increasing latency over time
+- Fix journey reachable-follow-ups evaluation being order-dependent at fan-in nodes — `JourneyReachableNodesEvaluator` captured a child's path list by reference and then prepended to it in place, so a node with multiple parents had its stored routes mutated by whichever parent was visited first; the second parent then lost routes (or double-counted a hop) depending purely on graph/DFS order. The child's routes are now snapshotted per parent, making the result depend only on journey structure. This intentionally changes the computed follow-ups for existing fan-in journeys: a shared child's later parent now retains the routes it previously lost
 
 ### Security
 
```

**File**: `src/parlant/core/services/indexing/journey_reachable_nodes_evaluation.py` (modified, +2/-1)
```diff
@@ -373,7 +373,8 @@ async def evaluate_reachable_follow_ups(
                         ):
                             truncated_follow_ups[str(id)] = _ReachableFollowUps(
                                 condition=r.condition,
-                                path=r.path,
+                                # copy so a parent's prepend can't mutate the child's shared list
+                                path=list(r.path),
                             )
                             id += 1
                 children_info[child_idx] = _ChildInfo(
```

**File**: `tests/core/stable/services/indexing/test_journey_reachable_nodes_evaluator.py` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+# Copyright 2026 Emcie Co Ltd.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+import re
+from datetime import datetime, timezone
+from typing import Any, Mapping, Sequence
+from lagom import Container
+from typing_extensions import override
+
+from parlant.core.common import Criticality
+from parlant.core.engines.alpha.optimization_policy import OptimizationPolicy
+from parlant.core.engines.alpha.prompt_builder import PromptBuilder
+from parlant.core.guidelines import Guideline, GuidelineContent, GuidelineId
+from parlant.core.loggers import Logger
+from parlant.core.nlp.generation import SchematicGenerator, SchematicGenerationResult
+from parlant.core.nlp.generation_info import GenerationInfo, UsageInfo
+from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.services.indexing.journey_reachable_nodes_evaluation import (
+    ChildEvaluation,
+    JourneyReachableNodesEvaluator,
+    PathCondition,
+    ReachableNodesEvaluation,
+    ReachableNodesEvaluationSchema,
+)
+from parlant.core.services.tools.service_registry import ServiceRegistry
+
+
+class _ForwardAllReachableNodesGenerator(SchematicGenerator[ReachableNodesEvaluationSchema]):
+    # A deterministic stand-in for the LLM: it reads which children and onward-path ids
+    # the prompt exposes for the current node and forwards all of them, mimicking an
+    # ideal compliant model. This lets us exercise the graph-walk/path logic without
+    # real generation. Only `generate` is used.
+
+    _CHILD_RE = re.compile(r"Child id:\s*(\S+)")
+    _PATH_RE = re.compile(r"-\s*Condition\s*\((\d+)\)\s*:")
+
+    @override
+    async def generate(
+        self,
+        prompt: str | PromptBuilder,
+        hints: Mapping[str, Any] = {},
+    ) -> SchematicGenerationResult[ReachableNodesEvaluationSchema]:
+        text = prompt.build() if isinstance(prompt, PromptBuilder) else prompt
+        # Drop the few-shot examples, which render the same child/condition lines.
+        real_data = text.split("Example section is over")[-1]
+
+        children: dict[str, list[str]] = {}
+        current_child: str | None = None
+        for line in real_data.splitlines():
+            if child_match := self._CHILD_RE.search(line):
+                current_child = child_match.group(1)
+                children[current_child] = []
+            elif (path_match := self._PATH_RE.search(line)) and current_child is not None:
+                children[current_child].append(path_match.group(1))
+
+        children_conditions = [
+            ChildEvaluation(
+                child_id=child_id,
+                child_action=f"action of {child_id}",
+                condition_to_child=f"condition to {child_id}",
+                condition_to_child_and_stop=f"reached {child_id} and stopped",
+                conditions_to_child_and_forward=[
+                    PathCondition(
+                        id=path_id,
+                        path_condition=f"path {path_id} from {child_id}",
+                        condition_to_child_then_to_path=f"through {child_id} via {path_id}",
+                    )
+                    for path_id in path_ids
+                ]
+                or None,
+            )
+            for child_id, path_ids in children.items()
+        ]
+
+        return SchematicGenerationResult(
+            content=ReachableNodesEvaluationSchema(
+                step_action="step action",
+                step_action_completed="step action completed",
+                children_conditions=children_conditions or None,
+            ),
+            info=GenerationInfo(
+                schema_name=ReachableNodesEvaluationSchema.__name__,
+                model="fake",
+                duration=0.0,
+                usage=UsageInfo(input_tokens=0, output_tokens=0),
+            ),
+        )
+
+    @property
+    @override
+    def id(self) -> str:
+        raise NotImplementedError
+
+    @property
+    @override
+    def max_tokens(self) -> int:
+        raise NotImplementedError
+
+    @property
+    @override
+    def tokenizer(self) -> EstimatingTokenizer:
+        raise NotImplementedError
+
+
+def _node_guideline(
+    index: str,
+    action: str,
+    follow_ups: Sequence[str],
+) -> Guideline:
+    return Guideline(
+        id=GuidelineId(index),
+        creation_utc=datetime.now(timezone.utc),
+        content=GuidelineContent(condition="", action=action),
+        enabled=True,
+        tags=[],
+        me
```

---

### Incident Patch 4: `fa875a25` (2026-06-02)
**Commit Message**: fix: make journey reachable-follow-ups order-independent at fan-in nodes

Signed-off-by: Alex Santangelo <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ All notable changes to Parlant will be documented here.
 
 - Fix low-criticality matcher logging the entire inference blob once per guideline in a batch (N copies of the same payload at debug level); now logs a single per-item entry
 - Fix WebSocketLogger event loop starvation — when no WebSocket clients are subscribed, the drain loop processed queued messages without yielding, progressively blocking the async event loop and causing increasing latency over time
+- Fix journey reachable-follow-ups evaluation being order-dependent at fan-in nodes — `JourneyReachableNodesEvaluator` captured a child's path list by reference and then prepended to it in place, so a node with multiple parents had its stored routes mutated by whichever parent was visited first; the second parent then lost routes (or double-counted a hop) depending purely on graph/DFS order. The child's routes are now snapshotted per parent, making the result depend only on journey structure. This intentionally changes the computed follow-ups for existing fan-in journeys: a shared child's later parent now retains the routes it previously lost
 
 ### Security
 
```

**File**: `src/parlant/core/services/indexing/journey_reachable_nodes_evaluation.py` (modified, +2/-1)
```diff
@@ -373,7 +373,8 @@ async def evaluate_reachable_follow_ups(
                         ):
                             truncated_follow_ups[str(id)] = _ReachableFollowUps(
                                 condition=r.condition,
-                                path=r.path,
+                                # copy so a parent's prepend can't mutate the child's shared list
+                                path=list(r.path),
                             )
                             id += 1
                 children_info[child_idx] = _ChildInfo(
```

**File**: `tests/core/stable/services/indexing/test_journey_reachable_nodes_evaluator.py` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+# Copyright 2026 Emcie Co Ltd.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+import re
+from datetime import datetime, timezone
+from typing import Any, Mapping, Sequence
+from lagom import Container
+from typing_extensions import override
+
+from parlant.core.common import Criticality
+from parlant.core.engines.alpha.optimization_policy import OptimizationPolicy
+from parlant.core.engines.alpha.prompt_builder import PromptBuilder
+from parlant.core.guidelines import Guideline, GuidelineContent, GuidelineId
+from parlant.core.loggers import Logger
+from parlant.core.nlp.generation import SchematicGenerator, SchematicGenerationResult
+from parlant.core.nlp.generation_info import GenerationInfo, UsageInfo
+from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.services.indexing.journey_reachable_nodes_evaluation import (
+    ChildEvaluation,
+    JourneyReachableNodesEvaluator,
+    PathCondition,
+    ReachableNodesEvaluation,
+    ReachableNodesEvaluationSchema,
+)
+from parlant.core.services.tools.service_registry import ServiceRegistry
+
+
+class _ForwardAllReachableNodesGenerator(SchematicGenerator[ReachableNodesEvaluationSchema]):
+    # A deterministic stand-in for the LLM: it reads which children and onward-path ids
+    # the prompt exposes for the current node and forwards all of them, mimicking an
+    # ideal compliant model. This lets us exercise the graph-walk/path logic without
+    # real generation. Only `generate` is used.
+
+    _CHILD_RE = re.compile(r"Child id:\s*(\S+)")
+    _PATH_RE = re.compile(r"-\s*Condition\s*\((\d+)\)\s*:")
+
+    @override
+    async def generate(
+        self,
+        prompt: str | PromptBuilder,
+        hints: Mapping[str, Any] = {},
+    ) -> SchematicGenerationResult[ReachableNodesEvaluationSchema]:
+        text = prompt.build() if isinstance(prompt, PromptBuilder) else prompt
+        # Drop the few-shot examples, which render the same child/condition lines.
+        real_data = text.split("Example section is over")[-1]
+
+        children: dict[str, list[str]] = {}
+        current_child: str | None = None
+        for line in real_data.splitlines():
+            if child_match := self._CHILD_RE.search(line):
+                current_child = child_match.group(1)
+                children[current_child] = []
+            elif (path_match := self._PATH_RE.search(line)) and current_child is not None:
+                children[current_child].append(path_match.group(1))
+
+        children_conditions = [
+            ChildEvaluation(
+                child_id=child_id,
+                child_action=f"action of {child_id}",
+                condition_to_child=f"condition to {child_id}",
+                condition_to_child_and_stop=f"reached {child_id} and stopped",
+                conditions_to_child_and_forward=[
+                    PathCondition(
+                        id=path_id,
+                        path_condition=f"path {path_id} from {child_id}",
+                        condition_to_child_then_to_path=f"through {child_id} via {path_id}",
+                    )
+                    for path_id in path_ids
+                ]
+                or None,
+            )
+            for child_id, path_ids in children.items()
+        ]
+
+        return SchematicGenerationResult(
+            content=ReachableNodesEvaluationSchema(
+                step_action="step action",
+                step_action_completed="step action completed",
+                children_conditions=children_conditions or None,
+            ),
+            info=GenerationInfo(
+                schema_name=ReachableNodesEvaluationSchema.__name__,
+                model="fake",
+                duration=0.0,
+                usage=UsageInfo(input_tokens=0, output_tokens=0),
+            ),
+        )
+
+    @property
+    @override
+    def id(self) -> str:
+        raise NotImplementedError
+
+    @property
+    @override
+    def max_tokens(self) -> int:
+        raise NotImplementedError
+
+    @property
+    @override
+    def tokenizer(self) -> EstimatingTokenizer:
+        raise NotImplementedError
+
+
+def _node_guideline(
+    index: str,
+    action: str,
+    follow_ups: Sequence[str],
+) -> Guideline:
+    return Guideline(
+        id=GuidelineId(index),
+        creation_utc=datetime.now(timezone.utc),
+        content=GuidelineContent(condition="", action=action),
+        enabled=True,
+        tags=[],
+        me
```

---

### Incident Patch 5: `152f0582` (2026-05-19)
**Commit Message**: fix: bump dependency version pins for security vulnerabilities

- litellm >= 1.83.0 → >= 1.83.10 (CVE-2026-42203, CVE-2026-42271, CVE-2026-42208, CVE-2026-40217)
- Mako >= 1.3.11 → >= 1.3.12 (CVE-2026-44307)
- python-multipart >= 0.0.26 → >= 0.0.27 (CVE-2026-42561)
- urllib3 >= 2.6.3 → >= 2.7.0 (CVE-2026-44431, CVE-2026-44432)

Signed-off-by: Dor Zohar <[REDACTED_EMAIL]>

**File**: `pyproject.toml` (modified, +4/-4)
```diff
@@ -96,7 +96,7 @@ vertex = [
 
 ollama = ["ollama>=0.5.0"]
 
-litellm = ["litellm>=1.83.0", "torch>=2.8.0", "transformers>=4.53.0"]
+litellm = ["litellm>=1.83.10", "torch>=2.8.0", "transformers>=4.53.0"]
 
 azure = ["azure-identity>=1.20.0"]
 
@@ -141,15 +141,15 @@ constraint-dependencies = [
     "diskcache>=5.6.4",
     "filelock>=3.20.3",
     "fonttools>=4.60.2",
-    "Mako>=1.3.11",
+    "Mako>=1.3.12",
     "orjson>=3.11.6",
     "pillow>=12.2.0",
     "protobuf>=6.33.5",
     "pyasn1>=0.6.3",
     "Pygments>=2.20.0",
     "pyopenssl>=26.0.0",
-    "python-multipart>=0.0.26",
-    "urllib3>=2.6.3",
+    "python-multipart>=0.0.27",
+    "urllib3>=2.7.0",
     "werkzeug>=3.1.6",
 ]
 
```

**File**: `uv.lock` (modified, +16/-16)
```diff
@@ -25,15 +25,15 @@ constraints = [
     { name = "diskcache", specifier = ">=5.6.4" },
     { name = "filelock", specifier = ">=3.20.3" },
     { name = "fonttools", specifier = ">=4.60.2" },
-    { name = "mako", specifier = ">=1.3.11" },
+    { name = "mako", specifier = ">=1.3.12" },
     { name = "orjson", specifier = ">=3.11.6" },
     { name = "pillow", specifier = ">=12.2.0" },
     { name = "protobuf", specifier = ">=6.33.5" },
     { name = "pyasn1", specifier = ">=0.6.3" },
     { name = "pygments", specifier = ">=2.20.0" },
     { name = "pyopenssl", specifier = ">=26.0.0" },
-    { name = "python-multipart", specifier = ">=0.0.26" },
-    { name = "urllib3", specifier = ">=2.6.3" },
+    { name = "python-multipart", specifier = ">=0.0.27" },
+    { name = "urllib3", specifier = ">=2.7.0" },
     { name = "werkzeug", specifier = ">=3.1.6" },
 ]
 overrides = [
@@ -2908,7 +2908,7 @@ wheels = [
 
 [[package]]
 name = "litellm"
-version = "1.83.0"
+version = "1.85.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiohttp" },
@@ -2924,21 +2924,21 @@ dependencies = [
     { name = "tiktoken" },
     { name = "tokenizers" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/22/92/6ce9737554994ca8e536e5f4f6a87cc7c4774b656c9eb9add071caf7d54b/litellm-1.83.0.tar.gz", hash = "sha256:860bebc76c4bb27b4cf90b4a77acd66dba25aced37e3db98750de8a1766bfb7a", size = 17333062, upload-time = "2026-03-31T05:08:25.331Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/3b/d5/3c9b560db2ffa9e498655d0dfd74f408bc5b32ede858b5731c2a5fa4c752/litellm-1.85.0.tar.gz", hash = "sha256:babdd569809af913d08a08a7eb55df1ed3e6a3960ee365c6cef4ad031c9bc72a", size = 15344387, upload-time = "2026-05-17T01:59:15.97Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/19/2c/a670cc050fcd6f45c6199eb99e259c73aea92edba8d5c2fc1b3686d36217/litellm-1.83.0-py3-none-any.whl", hash = "sha256:88c536d339248f3987571493015784671ba3f193a328e1ea6780dbebaa2094a8", size = 15610306, upload-time = "2026-03-31T05:08:21.987Z" },
+    { url = "https://files.pythonhosted.org/packages/1c/38/e6a4abb062e039d18d59538cc4e6fc370c2c10cd2bff4a2e546acb69dcb9/litellm-1.85.0-py3-none-any.whl", hash = "sha256:2bb449153610691faffd76f5b94a8c29e4b66fc5394156ebf54fd4fe92759b1a", size = 16978229, upload-time = "2026-05-17T01:59:11.902Z" },
 ]
 
 [[package]]
 name = "mako"
-version = "1.3.11"
+version = "1.3.12"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "markupsafe" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/59/8a/805404d0c0b9f3d7a326475ca008db57aea9c5c9f2e1e39ed0faa335571c/mako-1.3.11.tar.gz", hash = "sha256:071eb4ab4c5010443152255d77db7faa6ce5916f35226eb02dc34479b6858069", size = 399811, upload-time = "2026-04-14T20:19:51.493Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/00/62/791b31e69ae182791ec67f04850f2f062716bbd205483d63a215f3e062d3/mako-1.3.12.tar.gz", hash = "sha256:9f778e93289bd410bb35daadeb4fc66d95a746f0b75777b942088b7fd7af550a", size = 400219, upload-time = "2026-04-28T19:01:08.512Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/68/a5/19d7aaa7e433713ffe881df33705925a196afb9532efc8475d26593921a6/mako-1.3.11-py3-none-any.whl", hash = "sha256:e372c6e333cf004aa736a15f425087ec977e1fcbd2966aae7f17c8dc1da27a77", size = 78503, upload-time = "2026-04-14T20:19:53.233Z" },
+    { url = "https://files.pythonhosted.org/packages/bc/b1/a0ec7a5a9db730a08daef1fdfb8090435b82465abbf758a596f0ea88727e/mako-1.3.12-py3-none-any.whl", hash = "sha256:8f61569480282dbf557145ce441e4ba888be453c30989f879f0d652e39f53ea9", size = 78521, upload-time = "2026-04-28T19:01:10.393Z" },
 ]
 
 [[package]]
@@ -4615,7 +4615,7 @@ requires-dist = [
     { name = "jsonschema", specifier = ">=4.23.0" },
     { name = "lagom", specifier = ">=2.6.0" },
     { name = "limits", specifier = ">=5.5.0" },
-    { name = "litellm", marker = "extra == 'litellm'", specifier = ">=1.83.0" },
+    { name = "litellm", marker = "extra == 'litellm'", specifier = ">=1.83.10" },
     { name = "mcp", specifier = ">=1.23.0" },
     { name = "mistralai", marker = "extra == 'mistral'", specifier = ">=1.0.0" },
     { name = "more-itertools", specifier = ">=10.3.0" },
@@ -5727,11 +5727,11 @@ wheels = [
 
 [[package]]
 name = "python-multipart"
-version = "0.0.26"
+version = "0.0.29"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/88/71/b145a380824a960ebd60e1014256dbb7d2253f2316ff2d73dfd8928ec2c3/python_multipart-0.0.26.tar.gz", hash = "sha256:08fadc45918cd615e26846437f50c5d6d23304da32c341f289a617127b081f17", size = 43501, upload-time = "2026-04-10T14:09:59.473Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/4e/fe/70bd71a6738b09a0bdf6480ca6436b167469ca4578b2a0efbe390b4b0e70/python_multipart-0.0.29.tar.gz", hash = "sha256:643e93849196645e2dbdd81a0f8829a23123ad7f797a84a364c6fb3563f18904", size = 45678,
```

---

### Incident Patch 6: `e1bee7fe` (2026-05-04)
**Commit Message**: Add optional title to guidelines and observations

**File**: `src/parlant/api/common.py` (modified, +9/-0)
```diff
@@ -172,6 +172,14 @@ class EvaluationStatusDTO(Enum):
     ),
 ]
 
+GuidelineTitleField: TypeAlias = Annotated[
+    str,
+    Field(
+        description="Optional short title for display purposes only",
+        examples=["Pricing inquiries"],
+    ),
+]
+
 
 class CriticalityDTO(Enum):
     """
@@ -337,6 +345,7 @@ class GuidelineDTO(
     condition: GuidelineConditionField
     action: GuidelineActionField | None = None
     description: GuidelineDescriptionField | None = None
+    title: GuidelineTitleField | None = None
     criticality: GuidelineCriticalityField = CriticalityDTO.MEDIUM
     enabled: GuidelineEnabledField = True
     tags: GuidelineTagsField
```

**File**: `src/parlant/api/guidelines.py` (modified, +10/-0)
```diff
@@ -243,6 +243,7 @@ class GuidelineCreationParamsDTO(
     condition: GuidelineConditionField
     action: GuidelineActionField | None = None
     description: common.GuidelineDescriptionField | None = None
+    title: common.GuidelineTitleField | None = None
     criticality: common.CriticalityDTO | None = None
     metadata: GuidelineMetadataField | None = None
     enabled: GuidelineEnabledField | None = None
@@ -315,6 +316,7 @@ class GuidelineUpdateParamsDTO(
     condition: GuidelineConditionField | None = None
     action: GuidelineActionField | None = None
     description: common.GuidelineDescriptionField | None = None
+    title: common.GuidelineTitleField | None = None
     criticality: common.CriticalityDTO | None = None
     tool_associations: GuidelineToolAssociationUpdateParamsDTO | None = None
     enabled: GuidelineEnabledField | None = None
@@ -435,6 +437,7 @@ def _guideline_relationship_to_dto(
             condition=rel_source_guideline.content.condition,
             action=rel_source_guideline.content.action,
             description=rel_source_guideline.content.description,
+            title=rel_source_guideline.title,
             criticality=_criticality_to_dto(rel_source_guideline.criticality),
             enabled=rel_source_guideline.enabled,
             tags=rel_source_guideline.tags,
@@ -463,6 +466,7 @@ def _guideline_relationship_to_dto(
             condition=rel_target_guideline.content.condition,
             action=rel_target_guideline.content.action,
             description=rel_target_guideline.content.description,
+            title=rel_target_guideline.title,
             criticality=_criticality_to_dto(rel_target_guideline.criticality),
             enabled=rel_target_guideline.enabled,
             tags=rel_target_guideline.tags,
@@ -531,6 +535,7 @@ async def create_guideline(
                 condition=params.condition,
                 action=params.action or None,
                 description=params.description or None,
+                title=params.title or None,
                 criticality=_criticality_from_dto(params.criticality)
                 if params.criticality
                 else None,
@@ -556,6 +561,7 @@ async def create_guideline(
             condition=guideline.content.condition,
             action=guideline.content.action,
             description=guideline.content.description,
+            title=guideline.title,
             criticality=_criticality_to_dto(guideline.criticality),
             metadata=guideline.metadata,
             enabled=guideline.enabled,
@@ -601,6 +607,7 @@ async def list_guidelines(
                 condition=guideline.content.condition,
                 action=guideline.content.action,
                 description=guideline.content.description,
+                title=guideline.title,
                 criticality=_criticality_to_dto(guideline.criticality),
                 metadata=guideline.metadata,
                 enabled=guideline.enabled,
@@ -665,6 +672,7 @@ async def read_guideline(
                 condition=guideline.content.condition,
                 action=guideline.content.action,
                 description=guideline.content.description,
+                title=guideline.title,
                 criticality=_criticality_to_dto(guideline.criticality),
                 metadata=guideline.metadata,
                 enabled=guideline.enabled,
@@ -737,6 +745,7 @@ async def update_guideline(
             condition=params.condition,
             action=params.action,
             description=params.description,
+            title=params.title,
             criticality=_criticality_from_dto(params.criticality) if params.criticality else None,
             tool_associations=GuidelineToolAssociationUpdateParams(
                 add=[
@@ -787,6 +796,7 @@ async def update_guideline(
                 condition=updated_guideline.content.condition,
                 action=updated_guideline.content.action,
                 description=updated_guideline.content.description,
+                title=updated_guideline.title,
                 criticality=_criticality_to_dto(updated_guideline.criticality),
                 metadata=updated_guideline.metadata,
                 enabled=updated_guideline.enabled,
```

**File**: `src/parlant/core/app_modules/guidelines.py` (modified, +6/-0)
```diff
@@ -90,6 +90,7 @@ async def create(
         condition: str,
         action: str | None,
         description: str | None,
+        title: str | None,
         criticality: Criticality | None,
         metadata: Mapping[str, JSONSerializable] | None,
         enabled: bool | None,
@@ -110,6 +111,7 @@ async def create(
             condition=condition,
             action=action,
             description=description,
+            title=title,
             criticality=criticality,
             metadata=metadata or {},
             enabled=enabled or True,
@@ -146,6 +148,7 @@ async def update(
         condition: str | None,
         action: str | None,
         description: str | None,
+        title: str | None,
         criticality: Criticality | None,
         tool_associations: GuidelineToolAssociationUpdateParams | None,
         enabled: bool | None,
@@ -161,6 +164,7 @@ async def update(
             condition
             or action
             or description is not None
+            or title is not None
             or criticality is not None
             or enabled is not None
             or composition_mode is not None
@@ -173,6 +177,8 @@ async def update(
                 update_params["action"] = action
             if description is not None:
                 update_params["description"] = description
+            if title is not None:
+                update_params["title"] = title
             if criticality is not None:
                 update_params["criticality"] = criticality
             if enabled is not None:
```

**File**: `src/parlant/core/guidelines.py` (modified, +47/-2)
```diff
@@ -60,6 +60,7 @@ class Guideline:
     tags: Sequence[TagId]
     metadata: Mapping[str, JSONSerializable]
     criticality: Criticality
+    title: Optional[str] = None
     labels: Set[str] = field(default_factory=set)
     composition_mode: Optional[CompositionMode] = None
     track: bool = True
@@ -86,6 +87,7 @@ class GuidelineUpdateParams(TypedDict, total=False):
     condition: str
     action: Optional[str]
     description: Optional[str]
+    title: Optional[str]
     criticality: Criticality
     enabled: bool
     metadata: Mapping[str, JSONSerializable]
@@ -101,6 +103,7 @@ async def create_guideline(
         condition: str,
         action: Optional[str] = None,
         description: Optional[str] = None,
+        title: Optional[str] = None,
         criticality: Optional[Criticality] = None,
         metadata: Mapping[str, JSONSerializable] = {},
         creation_utc: Optional[datetime] = None,
@@ -294,13 +297,30 @@ class GuidelineDocument_v0_9_0(TypedDict, total=False):
     labels: Sequence[str]
 
 
+class GuidelineDocument_v0_10_0(TypedDict, total=False):
+    id: ObjectId
+    version: Version.String
+    creation_utc: str
+    condition: str
+    action: Optional[str]
+    description: Optional[str]
+    criticality: str
+    enabled: bool
+    metadata: Mapping[str, JSONSerializable]
+    composition_mode: Optional[str]
+    track: bool
+    labels: Sequence[str]
+    priority: int
+
+
 class GuidelineDocument(TypedDict, total=False):
     id: ObjectId
     version: Version.String
     creation_utc: str
     condition: str
     action: Optional[str]
     description: Optional[str]
+    title: Optional[str]
     criticality: str
     enabled: bool
     metadata: Mapping[str, JSONSerializable]
@@ -332,7 +352,7 @@ async def guideline_document_converter_0_1_0_to_0_2_0(doc: BaseDocument) -> Opti
 
 
 class GuidelineDocumentStore(GuidelineStore):
-    VERSION = Version.from_string("0.10.0")
+    VERSION = Version.from_string("0.11.0")
 
     def __init__(
         self,
@@ -350,9 +370,28 @@ def __init__(
         self._lock = ReaderWriterLock()
 
     async def _document_loader(self, doc: BaseDocument) -> Optional[GuidelineDocument]:
+        async def v0_10_0_to_v0_11_0(doc: BaseDocument) -> Optional[BaseDocument]:
+            d = cast(GuidelineDocument_v0_10_0, doc)
+            return GuidelineDocument(
+                id=d["id"],
+                version=Version.String("0.11.0"),
+                creation_utc=d["creation_utc"],
+                condition=d["condition"],
+                action=d["action"],
+                description=d.get("description", None),
+                title=None,  # Default to None for existing guidelines
+                criticality=d["criticality"],
+                enabled=d["enabled"],
+                metadata=d["metadata"],
+                composition_mode=d.get("composition_mode"),
+                track=d.get("track", True),
+                labels=d.get("labels", []),
+                priority=d.get("priority", 0),
+            )
+
         async def v0_9_0_to_v0_10_0(doc: BaseDocument) -> Optional[BaseDocument]:
             d = cast(GuidelineDocument_v0_9_0, doc)
-            return GuidelineDocument(
+            return GuidelineDocument_v0_10_0(
                 id=d["id"],
                 version=Version.String("0.10.0"),
                 creation_utc=d["creation_utc"],
@@ -472,6 +511,7 @@ async def v0_2_0_to_v0_3_0(doc: BaseDocument) -> Optional[BaseDocument]:
                 "0.7.0": v0_7_0_to_v0_8_0,
                 "0.8.0": v0_8_0_to_v0_9_0,
                 "0.9.0": v0_9_0_to_v0_10_0,
+                "0.10.0": v0_10_0_to_v0_11_0,
             },
         ).migrate(doc)
 
@@ -542,6 +582,7 @@ def _serialize(
             condition=guideline.content.condition,
             action=guideline.content.action,
             description=guideline.content.description,
+            title=guideline.title,
             criticality=guideline.criticality.value,
             enabled=guideline.enabled,
             metadata=guideline.metadata,
@@ -575,6 +616,7 @@ async def _deserialize(
                 action=guideline_document["action"],
                 description=guideline_document.get("description", None),
             ),
+            title=guideline_document.get("title", None),
             criticality=Criticality(guideline_document["criticality"]),
             enabled=guideline_document["enabled"],
             tags=[TagId(tag_id) for tag_id in tag_ids],
@@ -591,6 +633,7 @@ async def create_guideline(
         condition: str,
         action: Optional[str] = None,
         description: Optional[str] = None,
+        title: Optional[str] = None,
         criticality: Optional[Criticality] = None,
         metadata: Mapping[str, JSONSerializable] = {},
         creation_utc: Optional[datetime] = None,
@@ -626,6 +669,7 @@ async def create_guideline(
                     action=action,
                     description=description,
               
```

**File**: `src/parlant/sdk.py` (modified, +15/-1)
```diff
@@ -2726,6 +2726,7 @@ async def create_guideline(
         | None = None,
         tags: Sequence[Tag] = [],
         id: GuidelineId | None = None,
+        title: str | None = None,
         track: bool = True,
         labels: Iterable[str] = (),
         dependencies: Sequence[Guideline | Journey] = [],
@@ -2736,6 +2737,7 @@ async def create_guideline(
             condition=condition,
             action=action,
             description=description,
+            title=title,
             tools=tools,
             metadata=metadata,
             canned_responses=canned_responses,
@@ -2771,6 +2773,8 @@ async def create_observation(
         canned_response_field_provider: Callable[[EngineContext], Awaitable[Mapping[str, Any]]]
         | None = None,
         tags: Sequence[Tag] = [],
+        id: GuidelineId | None = None,
+        title: str | None = None,
         labels: Iterable[str] = (),
         dependencies: Sequence[Guideline | Journey] = [],
         priority: int = 0,
@@ -2780,6 +2784,8 @@ async def create_observation(
         return await self.create_guideline(
             condition=condition,
             description=description,
+            id=id,
+            title=title,
             tools=tools,
             canned_responses=canned_responses,
             composition_mode=composition_mode,
@@ -3471,7 +3477,6 @@ async def create_guideline(
         self,
         condition: str | None = None,
         action: str | None = None,
-        id: GuidelineId | None = None,
         description: str | None = None,
         tools: Iterable[ToolRef] = [],
         metadata: dict[str, JSONSerializable] = {},
@@ -3485,6 +3490,8 @@ async def create_guideline(
         canned_response_field_provider: Callable[[EngineContext], Awaitable[Mapping[str, Any]]]
         | None = None,
         tags: Sequence[Tag] = [],
+        id: GuidelineId | None = None,
+        title: str | None = None,
         track: bool = True,
         labels: Iterable[str] = (),
         dependencies: Sequence[Guideline | Journey] = [],
@@ -3495,6 +3502,7 @@ async def create_guideline(
             condition=condition,
             action=action,
             description=description,
+            title=title,
             tools=tools,
             metadata=metadata,
             canned_responses=canned_responses,
@@ -3531,6 +3539,8 @@ async def create_observation(
         canned_response_field_provider: Callable[[EngineContext], Awaitable[Mapping[str, Any]]]
         | None = None,
         tags: Sequence[Tag] = [],
+        id: GuidelineId | None = None,
+        title: str | None = None,
         labels: Iterable[str] = (),
         dependencies: Sequence[Guideline | Journey] = [],
         priority: int = 0,
@@ -3540,6 +3550,8 @@ async def create_observation(
         return await self.create_guideline(
             condition=condition,
             description=description,
+            id=id,
+            title=title,
             tools=tools,
             canned_responses=canned_responses,
             composition_mode=composition_mode,
@@ -4402,6 +4414,7 @@ async def _create_guideline(
         condition: str | None,
         action: str | None,
         description: str | None,
+        title: str | None,
         tools: Iterable[ToolRef],
         metadata: dict[str, JSONSerializable],
         criticality: Criticality,
@@ -4436,6 +4449,7 @@ async def _create_guideline(
             condition=condition or "",
             action=action,
             description=description,
+            title=title,
             criticality=criticality,
             metadata=metadata,
             composition_mode=CompositionMode._to_core_composition_mode(composition_mode),
```

**File**: `tests/api/test_guidelines.py` (modified, +42/-0)
```diff
@@ -87,6 +87,48 @@ async def test_that_a_guideline_can_be_created(
     assert guideline["metadata"] == {"key1": "value1", "key2": "value2"}
 
 
+async def test_that_a_guideline_can_be_created_with_a_title(
+    async_client: httpx.AsyncClient,
+) -> None:
+    response = await async_client.post(
+        "/guidelines",
+        json={
+            "condition": "the customer asks about pricing",
+            "action": "provide current pricing information",
+            "title": "Pricing inquiries",
+        },
+    )
+
+    assert response.status_code == status.HTTP_201_CREATED
+
+    guideline = response.json()
+    assert guideline["title"] == "Pricing inquiries"
+
+
+async def test_that_a_guideline_title_can_be_updated(
+    async_client: httpx.AsyncClient,
+    container: Container,
+) -> None:
+    guideline_store = container[GuidelineStore]
+
+    guideline = await guideline_store.create_guideline(
+        condition="the customer asks about the weather",
+        action="provide the current weather update",
+        title="Old title",
+    )
+
+    response = await async_client.patch(
+        f"/guidelines/{guideline.id}",
+        json={"title": "Weather inquiries"},
+    )
+
+    assert response.status_code == status.HTTP_200_OK
+    updated_guideline = response.json()["guideline"]
+
+    assert updated_guideline["id"] == guideline.id
+    assert updated_guideline["title"] == "Weather inquiries"
+
+
 async def test_that_a_guideline_can_be_created_without_an_action(
     async_client: httpx.AsyncClient,
 ) -> None:
```

**File**: `tests/sdk/test_guidelines.py` (modified, +18/-0)
```diff
@@ -1358,3 +1358,21 @@ async def run(self, ctx: Context) -> None:
         assert "pepsi" in response.lower(), (
             f"Expected 'pepsi' in response (depend_on_any: g2 matched) but got: {response}"
         )
+
+
+class Test_that_observation_can_be_created_with_a_title(SDKTest):
+    async def setup(self, server: p.Server) -> None:
+        self.agent = await server.create_agent(
+            name="Title Agent",
+            description="Agent for testing guideline titles",
+        )
+
+        self.observation = await self.agent.create_observation(
+            condition="the customer asks about the weather",
+            title="Weather inquiries",
+        )
+
+    async def run(self, ctx: Context) -> None:
+        store = ctx.container[GuidelineStore]
+        stored = await store.read_guideline(self.observation.id)
+        assert stored.title == "Weather inquiries"
```

---

### Incident Patch 7: `16c3e6c0` (2026-05-04)
**Commit Message**: Add application instance ID and fix some boot bugs

**File**: `src/parlant/adapters/nlp/emcie_service.py` (modified, +12/-0)
```diff
@@ -31,6 +31,8 @@
 from parlant.core.engines.alpha.prompt_builder import PromptBuilder
 from parlant.core.loggers import Logger
 from parlant.core.meter import Meter
+from parlant.core.services.indexing.common import ProgressReport
+from parlant.core.services.indexing.indexer import IndexRequest, Indexer
 from parlant.core.nlp.policies import policy, retry
 from parlant.core.nlp.tokenization import EstimatingTokenizer
 from parlant.core.nlp.service import (
@@ -661,6 +663,16 @@ def dimensions(self) -> int:
         return 1536
 
 
+class EmcieIndexer(Indexer):
+    @override
+    async def index(
+        self,
+        payload: Mapping[str, Mapping[str, IndexRequest]],
+        progress_report: ProgressReport,
+    ) -> None:
+        return
+
+
 class EmcieService(NLPService):
     @staticmethod
     def verify_environment() -> str | None:
```

**File**: `src/parlant/adapters/nlp/parlant_cloud_service.py` (modified, +11/-36)
```diff
@@ -28,13 +28,7 @@
 import tiktoken
 
 from parlant.adapters.nlp.common import normalize_json_output, record_llm_metrics
-from parlant.core.agents import AgentStore
-from parlant.core.canned_responses import CannedResponseStore
-from parlant.core.context_variables import ContextVariableStore
 from parlant.core.engines.alpha.prompt_builder import PromptBuilder
-from parlant.core.glossary import GlossaryStore
-from parlant.core.guidelines import GuidelineStore
-from parlant.core.journeys import JourneyStore
 from parlant.core.loggers import Logger
 from parlant.core.meter import Meter
 from parlant.core.nlp.policies import policy, retry
@@ -59,10 +53,8 @@
     ModerationService,
     NoModeration,
 )
-from parlant.core.relationships import RelationshipStore
 from parlant.core.services.indexing.common import ProgressReport
 from parlant.core.services.indexing.indexer import IndexRequest, Indexer
-from parlant.core.services.tools.service_registry import ServiceRegistry
 from parlant.core.tracer import Tracer
 from parlant.core.version import VERSION
 from parlant.core.health import HealthReporter
@@ -715,7 +707,17 @@ def dimensions(self) -> int:
         return 1536
 
 
-class ParlantCloudService(NLPService, Indexer):
+class ParlantCloudIndexer(Indexer):
+    @override
+    async def index(
+        self,
+        payload: Mapping[str, Mapping[str, IndexRequest]],
+        progress_report: ProgressReport,
+    ) -> None:
+        return
+
+
+class ParlantCloudService(NLPService):
     @staticmethod
     def verify_environment() -> str | None:
         """Returns an error message if the environment is not set up correctly."""
@@ -737,28 +739,9 @@ def __init__(
         tracer: Tracer,
         meter: Meter,
         health_reporter: HealthReporter,
-        agent_store: AgentStore,
-        guideline_store: GuidelineStore,
-        journey_store: JourneyStore,
-        relationship_store: RelationshipStore,
-        glossary_store: GlossaryStore,
-        context_variable_store: ContextVariableStore,
-        canned_response_store: CannedResponseStore,
-        service_registry: ServiceRegistry,
         model_tier: GenerationModelTier | None = None,
         model_role: ModelRole | None = None,
     ) -> None:
-        super().__init__(
-            agent_store=agent_store,
-            guideline_store=guideline_store,
-            journey_store=journey_store,
-            relationship_store=relationship_store,
-            glossary_store=glossary_store,
-            context_variable_store=context_variable_store,
-            canned_response_store=canned_response_store,
-            service_registry=service_registry,
-        )
-
         self._logger = logger
         self._tracer = tracer
         self._meter = meter
@@ -774,14 +757,6 @@ def __init__(
 
         self._logger.info("Initialized ParlantCloudService")
 
-    @override
-    async def index(
-        self,
-        payload: Mapping[str, Mapping[str, IndexRequest]],
-        progress_report: ProgressReport,
-    ) -> None:
-        return
-
     @property
     @override
     def supports_streaming(self) -> bool:
```

**File**: `src/parlant/bin/server.py` (modified, +7/-5)
```diff
@@ -18,7 +18,6 @@
 from contextlib import asynccontextmanager, AsyncExitStack
 from contextvars import ContextVar
 from dataclasses import dataclass, field
-from datetime import timedelta
 import importlib
 import inspect
 import os
@@ -55,7 +54,8 @@
 )
 
 from parlant.core.capabilities import CapabilityStore, CapabilityVectorStore
-from parlant.core.common import IdGenerator
+from parlant.core.application_context import ApplicationContext
+from parlant.core.common import IdGenerator, generate_id
 from parlant.core.engines.alpha import message_generator
 from parlant.core.engines.alpha.guideline_matching.generic import (
     guideline_actionable_batch,
@@ -678,9 +678,11 @@ async def setup_container() -> AsyncIterator[Container]:
 
     _define_singleton(c, Engine, AlphaEngine)
 
-    c[EventLoopMonitor] = EventLoopMonitor()
-
-    c[HealthReporter] = HealthReporter()
+    _define_singleton_value(
+        c, ApplicationContext, ApplicationContext(instance_id=generate_id())
+    )
+    _define_singleton(c, EventLoopMonitor, EventLoopMonitor)
+    _define_singleton(c, HealthReporter, HealthReporter)
 
     _define_singleton(c, Application, Application)
 
```

**File**: `src/parlant/core/application_context.py` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Copyright 2026 Emcie Co Ltd.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+from dataclasses import dataclass
+
+
+@dataclass(frozen=True)
+class ApplicationContext:
+    instance_id: str
```

**File**: `src/parlant/core/health/__init__.py` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
     SchemaThresholds,
 )
 from parlant.core.health.reporter import (
-    Criticality,
+    StatusCriticality,
     HealthReport,
     HealthReporter,
     HealthView,
@@ -40,7 +40,7 @@
 )
 
 __all__ = [
-    "Criticality",
+    "StatusCriticality",
     "ENGINE_TTFM_KIND",
     "ENGINE_TURN_KIND",
     "ENGINE_TURNS_COUNTER",
```

**File**: `src/parlant/core/health/engine_view.py` (modified, +3/-4)
```diff
@@ -24,7 +24,7 @@
 from typing import Any, Mapping, Sequence
 
 from parlant.core.health.reporter import (
-    Criticality,
+    StatusCriticality,
     HealthReport,
     HealthReporter,
     OverallHealth,
@@ -57,7 +57,7 @@ class EngineHealthView:
     """Renders engine processing health from turn outcomes and TTFM samples."""
 
     name = "engine"
-    criticality = Criticality.CRITICAL
+    criticality = StatusCriticality.CRITICAL
     kinds: tuple[str, ...] = (ENGINE_TURN_KIND, ENGINE_TTFM_KIND)
 
     # Report attribute keys — producers and the renderer share these.
@@ -123,8 +123,7 @@ def render(
         ttfms = [
             float(r.attributes[self.ATTR_TTFM_MS])
             for r in ttfm_reports
-            if self.ATTR_TTFM_MS in r.attributes
-            and r.attributes[self.ATTR_TTFM_MS] is not None
+            if self.ATTR_TTFM_MS in r.attributes and r.attributes[self.ATTR_TTFM_MS] is not None
         ]
         p50_ttfm = _percentile(ttfms, 0.5)
         p95_ttfm = _percentile(ttfms, 0.95)
```

**File**: `src/parlant/core/health/event_loop_view.py` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@
 
 from parlant.core.event_loop_monitor import EventLoopHealth, EventLoopMonitor
 from parlant.core.health.reporter import (
-    Criticality,
+    StatusCriticality,
     HealthReport,
     OverallHealth,
     ViewSnapshot,
@@ -40,7 +40,7 @@ class EventLoopHealthView:
     """
 
     name = "event_loop"
-    criticality = Criticality.CRITICAL
+    criticality = StatusCriticality.CRITICAL
     kinds: tuple[str, ...] = ()
 
     def __init__(self, monitor: EventLoopMonitor) -> None:
```

**File**: `src/parlant/core/health/nlp_view.py` (modified, +7/-3)
```diff
@@ -25,7 +25,7 @@
 from typing import Any, Mapping, Sequence
 
 from parlant.core.health.reporter import (
-    Criticality,
+    StatusCriticality,
     HealthReport,
     HealthReporter,
     OverallHealth,
@@ -81,7 +81,7 @@ class NLPHealthView:
     """
 
     name = "nlp"
-    criticality = Criticality.CRITICAL
+    criticality = StatusCriticality.CRITICAL
     kinds: tuple[str, ...] = (NLP_REQUEST_KIND, NLP_EMBED_KIND)
 
     # Report attribute keys — producers and the renderer share these.
@@ -240,7 +240,11 @@ def _classify(
         p50_ms: float,
         p95_ms: float,
     ) -> OverallHealth:
-        overrides = self._schema_thresholds.get(schema, SchemaThresholds()) if schema else SchemaThresholds()
+        overrides = (
+            self._schema_thresholds.get(schema, SchemaThresholds())
+            if schema
+            else SchemaThresholds()
+        )
 
         deg_sr = (
             overrides.degraded_below_success_rate
```

---

### Incident Patch 8: `595d3209` (2026-04-30)
**Commit Message**: Add test to ensure ordinary guidelines can affect tool calls

**File**: `tests/core/stable/engines/alpha/test_tool_caller.py` (modified, +57/-1)
```diff
@@ -157,6 +157,7 @@ async def _inference_tool_calls_result(
     tool_enabled_guideline_matches: Mapping[GuidelineMatch, Sequence[ToolId]],
     tool_context_obj: ToolContext | None = None,
     staged_events: Sequence[EmittedEvent] | None = None,
+    ordinary_guideline_matches: Sequence[GuidelineMatch] | None = None,
 ) -> ToolCallInferenceResult:
     tool_caller = container[ToolCaller]
 
@@ -169,7 +170,7 @@ async def _inference_tool_calls_result(
         context_variables=[],
         interaction_history=interaction_history,
         terms=[],
-        ordinary_guideline_matches=[],
+        ordinary_guideline_matches=list(ordinary_guideline_matches or []),
         tool_enabled_guideline_matches=tool_enabled_guideline_matches,
         journeys=[],
         staged_events=staged_events or [],
@@ -1554,3 +1555,58 @@ async def test_that_consequential_tool_with_parameters_uses_full_mode(
     assert len(inference_tool_calls_result.batch_generations) == 1
     assert "Simple" not in inference_tool_calls_result.batch_generations[0].schema_name
     assert "SingleToolBatchSchema" in inference_tool_calls_result.batch_generations[0].schema_name
+
+
+async def test_that_a_tool_call_is_deferred_when_an_ordinary_guideline_requires_user_confirmation_first(
+    container: Container,
+    local_tool_service: LocalToolService,
+    agent: Agent,
+) -> None:
+    tool = await create_local_tool(
+        local_tool_service,
+        name="transfer_money",
+        parameters={
+            "amount": {"type": "integer"},
+            "from_account": {"type": "string"},
+            "to_account": {"type": "string"},
+        },
+        required=["amount", "from_account", "to_account"],
+    )
+
+    conversation_context = [
+        (EventSource.CUSTOMER, "Please transfer $500 from my checking to John's account."),
+    ]
+    interaction_history = create_interaction_history(conversation_context)
+
+    tool_enabled_guideline_matches = {
+        create_guideline_match(
+            condition="the user wants to transfer money",
+            action="run transfer_money with the requested amount and accounts",
+            score=9,
+            rationale="customer asked to transfer $500 to John's account",
+            tags=[Tag.for_agent_id(agent.id).id],
+        ): [ToolId(service_name="local", tool_name=tool.name)]
+    }
+
+    ordinary_guideline_matches = [
+        create_guideline_match(
+            condition="you are about to transfer money",
+            action="first get the user's clear and explicit confirmation before continuing",
+            score=10,
+            rationale="confirmation must be obtained before any money transfer",
+            tags=[Tag.for_agent_id(agent.id).id],
+        )
+    ]
+
+    inference_tool_calls_result = await _inference_tool_calls_result(
+        container=container,
+        agent=agent,
+        interaction_history=interaction_history,
+        tool_enabled_guideline_matches=tool_enabled_guideline_matches,
+        ordinary_guideline_matches=ordinary_guideline_matches,
+    )
+
+    tool_calls = list(chain.from_iterable(inference_tool_calls_result.batches))
+    assert len(tool_calls) == 0, (
+        f"Expected transfer_money to be deferred until confirmation, got {tool_calls}"
+    )
```

---

### Incident Patch 9: `88c8ea9c` (2026-04-29)
**Commit Message**: Health report architectural fixes

**File**: `docs/superpowers/plans/2026-04-27-agent-scoped-context-variable-values.md` (removed, +0/-362)
```diff
@@ -1,362 +0,0 @@
-# Agent-scoped Context Variable Values Implementation Plan
-
-> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
-
-**Goal:** Add an "agent (by id)" tier to the context-variable value-resolution chain so the same variable can carry per-agent defaults, with SDK methods on `Variable` to set/get them.
-
-**Architecture:** No store schema change. Agent-tier values are stored in the existing `_value_collection` keyed by `Tag.for_agent_id(agent.id).id` (i.e., the literal string `"agent:{agent_id}"`, distinct from the `"tag:{...}"` keys used for customer-tag values). The engine inserts a single new key into its precedence list between the customer-tag tier and the global tier; `_load_context_variable_value` and the tool-based fallback are unaffected. The SDK exposes two new methods on the `Variable` dataclass that mirror the existing `set_value_for_customer` / `set_value_for_tag` / `set_global_value` pattern.
-
-**Tech Stack:** Python 3, MyPy strict, pytest, ruff, the project's existing `SDKTest` harness.
-
-**Spec:** `docs/superpowers/specs/2026-04-27-agent-scoped-context-variable-values-design.md`
-
----
-
-## File Map
-
-| File | Action | Responsibility |
-|---|---|---|
-| `src/parlant/sdk.py` | Modify (around 2942–2996) | Add `Variable.set_value_for_agent` and `Variable.get_value_for_agent`. |
-| `src/parlant/core/engines/alpha/engine.py` | Modify (1101–1105 + imports) | Insert agent-tier key into precedence list; add `Tag` import. |
-| `tests/sdk/test_variables.py` | Modify (append) | Three new `SDKTest` classes covering SDK round-trip, engine resolution of agent tier, and customer-tag-vs-agent precedence regression guard. |
-
-No new files. No store, schema, migration, or API-layer changes.
-
----
-
-## Task 1: SDK methods on `Variable` for agent-scoped values
-
-**Files:**
-- Modify: `src/parlant/sdk.py:2942-2996` (add two methods to the `Variable` dataclass)
-- Test: `tests/sdk/test_variables.py` (append a new class)
-
-**Why test first:** Per project TDD policy (`CLAUDE.md`), we add a failing test that exercises the new SDK surface before implementing it. This test is a pure round-trip through the store via the new SDK methods — it does not need the engine change yet.
-
-- [ ] **Step 1: Append the failing test to `tests/sdk/test_variables.py`**
-
-Append at the end of the file:
-
-```python
-class Test_that_a_variable_value_can_be_set_for_an_agent(SDKTest):
-    async def setup(self, server: p.Server) -> None:
-        self.agent = await server.create_agent(
-            name="Var Agent",
-            description="Agent for variable per-agent value test",
-        )
-
-        self.variable = await self.agent.create_variable(
-            name="subscription_plan",
-            description="The current subscription plan of the user.",
-        )
-
-        await self.variable.set_value_for_agent(self.agent, "premium")
-
-    async def run(self, ctx: Context) -> None:
-        assert "premium" == await self.variable.get_value_for_agent(self.agent)
-```
-
-- [ ] **Step 2: Run the test and confirm it fails**
-
-Run: `uv run pytest tests/sdk/test_variables.py::Test_that_a_variable_value_can_be_set_for_an_agent -v`
-
-Expected: FAIL — `AttributeError: 'Variable' object has no attribute 'set_value_for_agent'` (raised inside `setup`).
-
-- [ ] **Step 3: Add the two methods to `Variable` in `src/parlant/sdk.py`**
-
-Locate the `Variable` dataclass (around line 2926). It already imports `Tag as _Tag` at line 272 and uses `_Tag.for_agent_id(...)` elsewhere in the file (e.g., line 3265), so no new imports are needed.
-
-Insert these two methods immediately **after** `set_global_value` and **before** `get_value_for_customer` (i.e., between current lines 2967 and 2969 — the natural symmetric position alongside the existing `set_*` / `get_*` siblings):
-
-```python
-    async def set_value_for_agent(self, agent: Agent, value: JSONSerializable) -> None:
-        """Sets the value of the variable for a specific agent."""
-
-        await self._container[ContextVariableStore].update_value(
-            variable_id=self.id,
-            key=_Tag.for_agent_id(agent.id).id,
-            data=value,
-        )
-
-    async def get_value_for_agent(self, agent: Agent) -> JSONSerializable | None:
-        """Retrieves the value of the variable for a specific agent."""
-
-        value = await self._container[ContextVariableStore].read_value(
-            variable_id=self.id,
-            key=_Tag.for_agent_id(agent.id).id,
-        )
-
-        return value.data if value else None
-```
-
-After insertion, the `Variable` class should contain (in order): `set_value_for_customer`, `set_value_for_tag`, `set_global_value`, `set_value_for_agent`, `get_value_for_customer`, `get_value_for_tag`, `get_global_value`, `get_value_for_agent`, `get_value`.

```

**File**: `docs/superpowers/specs/2026-04-27-agent-scoped-context-variable-values-design.md` (removed, +0/-130)
```diff
@@ -1,130 +0,0 @@
-# Agent-scoped context variable values
-
-## Problem
-
-The engine currently resolves a context variable's value for a given turn by trying keys in this order, stopping at the first match:
-
-1. `customer.id` — customer-specific value
-2. `f"tag:{tag_id}"` for each customer tag — customer-tag value
-3. `ContextVariableStore.GLOBAL_KEY` (`"DEFAULT"`) — global value
-4. (Variable's tool, if defined) — tool-based fallback inside `_load_context_variable_value`
-
-Reference: `src/parlant/core/engines/alpha/engine.py:1101-1105`.
-
-There is no tier for "value owned by *this agent*, applied to every customer this agent talks to, regardless of customer tags". Agents that share a single context variable definition currently can't carry different defaults without either tagging every customer or defining separate variables per agent.
-
-## Goal
-
-Insert an **agent tier** between the customer-tag tier and the global tier. New precedence:
-
-1. Customer-specific
-2. Customer-tag
-3. **Agent (by id)** — new
-4. Global
-5. Tool-based
-
-Expose this tier in the SDK via `Variable.set_value_for_agent(agent, value)` and `Variable.get_value_for_agent(agent)`.
-
-## Non-goals
-
-- No agent-tag tier (e.g., "all agents tagged X share this default"). YAGNI; can be added later if needed.
-- No new method on `Agent` (e.g., `agent.set_variable_value(variable, value)`). Surface stays on `Variable`, mirroring the existing `set_value_for_customer` / `set_value_for_tag` / `set_global_value` pattern.
-- No store schema change, no migration. The values store remains key-agnostic.
-
-## Design
-
-### Key encoding
-
-Reuse the existing `Tag.for_agent_id(agent_id)` helper from `src/parlant/core/tags.py` (line 53–59). Its `.id` produces the canonical string `f"agent:{agent_id}"`. Use that string directly as the value-store key for the agent tier.
-
-This is distinct from the customer-tag tier: customer tags are wrapped as `f"tag:{tag_id}"` before being used as keys (`engine.py:1103`), so a customer carrying a tag named `agent:X` would produce key `"tag:agent:X"` — different from the agent-tier key `"agent:X"`. No collision, no aliasing across tiers.
-
-The `agent:{id}` namespace is already used across the codebase as a *resource ownership* tag (e.g., a context variable is tagged `agent:{id}` to scope it to that agent — see `entity_cq.py:124,214,262`). Using the same string as a *value key* in the values store is a parallel use of the same namespace; the values store itself is unaffected because it is key-agnostic.
-
-### Store changes
-
-None. `ContextVariableStore.update_value` / `read_value` / `delete_value` / `list_values` already accept arbitrary string keys. No new helper, no new method, no schema or migration change.
-
-### Engine changes
-
-**File:** `src/parlant/core/engines/alpha/engine.py`
-
-Modify `_load_context_variables` (around line 1089) so the precedence list includes the agent tier:
-
-```python
-keys_to_check_in_order_of_importance = (
-    [context.customer.id]
-    + [f"tag:{tag_id}" for tag_id in context.customer.tags]
-    + [Tag.for_agent_id(context.agent.id).id]   # NEW: agent-specific value
-    + [ContextVariableStore.GLOBAL_KEY]
-)
-```
-
-Add `from parlant.core.tags import Tag` to the imports — `engine.py` does not currently import `Tag`.
-
-`_load_context_variable_value` and `load_fresh_context_variable_value` (around line 2023 and 2200) require no changes — they already accept any key and run the variable's tool (if any) against it for the tool-based fallback.
-
-### SDK changes
-
-**File:** `src/parlant/sdk.py`
-
-Add two methods to the `Variable` dataclass alongside the existing setters/getters (around line 2942–2996):
-
-```python
-async def set_value_for_agent(self, agent: Agent, value: JSONSerializable) -> None:
-    """Sets the value of the variable for a specific agent."""
-    await self._container[ContextVariableStore].update_value(
-        variable_id=self.id,
-        key=_Tag.for_agent_id(agent.id).id,
-        data=value,
-    )
-
-async def get_value_for_agent(self, agent: Agent) -> JSONSerializable | None:
-    """Retrieves the value of the variable for a specific agent."""
-    value = await self._container[ContextVariableStore].read_value(
-        variable_id=self.id,
-        key=_Tag.for_agent_id(agent.id).id,
-    )
-    return value.data if value else None
-```
-
-`Tag` is already imported as `_Tag` for SDK use elsewhere in the file (e.g., `sdk.py:3265`), so no new imports.
-
-No changes to existing `set_value_for_customer` / `set_value_for_tag` / `set_global_value` / `get_value*` siblings. No new method on `Agent`.
-
-## Testing
-
-**File:** `tests/sdk/test_variables.py`
-
-Three new `SDKTest` classes following the existing patterns in the same file.
-
-### Test 1 — SDK round-trip for agent-scoped value
-
-`Test_that_a_variable_value_can_be_set_for_an_agent` — set a value via `set_value_for_agent`, read it back via `get_value_for_agent`, assert equality. Mirrors `Test_
```

**File**: `src/parlant/adapters/nlp/anthropic_service.py` (modified, +16/-14)
```diff
@@ -58,6 +58,7 @@
 )
 from parlant.core.nlp.generation import StreamingTextGenerator
 from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.health import HealthReporter
 
 
 class AnthropicEstimatingTokenizer(EstimatingTokenizer):
@@ -78,14 +79,13 @@ async def estimate_token_count(self, prompt: str) -> int:
 class AnthropicAISchematicGenerator(BaseSchematicGenerator[T]):
     supported_hints = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
         self._estimating_tokenizer = AnthropicEstimatingTokenizer(self._client, model_name)
@@ -203,12 +203,12 @@ async def _do_generate(
 
 
 class Claude_Sonnet_3_5(AnthropicAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="claude-3-5-sonnet-20241022",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @property
@@ -218,12 +218,12 @@ def max_tokens(self) -> int:
 
 
 class Claude_Sonnet_4(AnthropicAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="claude-sonnet-4-20250514",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @property
@@ -233,12 +233,12 @@ def max_tokens(self) -> int:
 
 
 class Claude_Opus_4_1(AnthropicAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="claude-opus-4-1-20250805",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @property
@@ -260,11 +260,13 @@ def verify_environment() -> str | None:
 
         return None
 
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         self.logger = logger
         self._tracer = tracer
         self._meter = meter
 
+        self._health_reporter = health_reporter
+
         self.logger.info("Initialized AnthropicService")
 
     @property
@@ -287,12 +289,12 @@ async def get_schematic_generator(
             or t == DisambiguationGuidelineMatchesSchema
             or t == CannedResponseSelectionSchema
         ):
-            return Claude_Opus_4_1[t](self.logger, self._tracer, self._meter)  # type: ignore
-        return Claude_Sonnet_4[t](self.logger, self._tracer, self._meter)  # type: ignore
+            return Claude_Opus_4_1[t](self.logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
+        return Claude_Sonnet_4[t](self.logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
 
     @override
     async def get_embedder(self, hints: EmbedderHints = {}) -> Embedder:
-        return JinaAIEmbedder(self.logger, self._tracer, self._meter)
+        return JinaAIEmbedder(self.logger, self._tracer, self._meter, self._health_reporter)
 
     @override
     async def get_moderation_service(self) -> ModerationService:
```

**File**: `src/parlant/adapters/nlp/aws_service.py` (modified, +11/-9)
```diff
@@ -51,6 +51,7 @@
     StreamingTextGeneratorHints,
 )
 from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.health import HealthReporter
 
 
 class AnthropicBedrockEstimatingTokenizer(EstimatingTokenizer):
@@ -66,14 +67,13 @@ async def estimate_token_count(self, prompt: str) -> int:
 class AnthropicBedrockAISchematicGenerator(BaseSchematicGenerator[T]):
     supported_hints = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = AsyncAnthropicBedrock(
             aws_access_key=os.environ["AWS_ACCESS_KEY_ID"],
@@ -192,12 +192,12 @@ async def _do_generate(
 
 
 class Claude_Sonnet_3_5(AnthropicBedrockAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="anthropic.claude-3-5-sonnet-20240620-v1:0",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @override
@@ -223,11 +223,13 @@ def verify_environment() -> str | None:
 """
         return None
 
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         self._logger = logger
         self._tracer = tracer
         self._meter = meter
 
+        self._health_reporter = health_reporter
+
     @property
     @override
     def supports_streaming(self) -> bool:
@@ -243,11 +245,11 @@ async def get_streaming_text_generator(
     async def get_schematic_generator(
         self, t: type[T], hints: SchematicGeneratorHints = {}
     ) -> AnthropicBedrockAISchematicGenerator[T]:
-        return Claude_Sonnet_3_5[t](self._logger, self._tracer, self._meter)  # type: ignore
+        return Claude_Sonnet_3_5[t](self._logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
 
     @override
     async def get_embedder(self, hints: EmbedderHints = {}) -> Embedder:
-        return JinaAIEmbedder(self._logger, self._tracer, self._meter)
+        return JinaAIEmbedder(self._logger, self._tracer, self._meter, self._health_reporter)
 
     @override
     async def get_moderation_service(self) -> ModerationService:
```

**File**: `src/parlant/adapters/nlp/azure_service.py` (modified, +35/-37)
```diff
@@ -53,6 +53,7 @@
 )
 from parlant.core.nlp.generation_info import GenerationInfo, UsageInfo
 from parlant.core.nlp.moderation import ModerationService, NoModeration
+from parlant.core.health import HealthReporter
 
 
 class AzureEstimatingTokenizer(EstimatingTokenizer):
@@ -72,15 +73,14 @@ class AzureSchematicGenerator(BaseSchematicGenerator[T]):
         "gpt-5": ["temperature"],
     }
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
         client: AsyncAzureOpenAI,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = client
         self._tokenizer = AzureEstimatingTokenizer(model_name=self.model_name)
@@ -329,14 +329,14 @@ async def token_provider() -> str:
 
 
 class CustomAzureSchematicGenerator(AzureSchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         _client = create_azure_client()
 
         super().__init__(
             model_name=os.environ["AZURE_GENERATIVE_MODEL_NAME"],
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
             client=_client,
         )
 
@@ -346,15 +346,14 @@ def max_tokens(self) -> int:
 
 
 class GPT_4o(AzureSchematicGenerator[T]):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
         super().__init__(
-            model_name="gpt-4o", logger=logger, tracer=tracer, meter=meter, client=_client
+            model_name="gpt-4o", logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, client=_client
         )
 
     @property
@@ -363,15 +362,14 @@ def max_tokens(self) -> int:
 
 
 class GPT_4o_Mini(AzureSchematicGenerator[T]):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
         super().__init__(
-            model_name="gpt-4o-mini", logger=logger, tracer=tracer, meter=meter, client=_client
+            model_name="gpt-4o-mini", logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, client=_client
         )
         self._token_estimator = AzureEstimatingTokenizer(model_name=self.model_name)
 
@@ -383,15 +381,14 @@ def max_tokens(self) -> int:
 class AzureEmbedder(BaseEmbedder):
     supported_arguments = ["dimensions"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
         client: AsyncAzureOpenAI,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = client
         self._tokenizer = AzureEstimatingTokenizer(model_name=self.model_name)
@@ -439,18 +436,17 @@ async def do_embed(
 
 
 class CustomAzureEmbedder(AzureEmbedder):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
         super().__init__(
             model_name=os.environ["AZURE_EMBEDDING_MODEL_NAME"],
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
             client=_client,
         )
 
@@ -465,18 +461,17 @@ def dimensions(self) -> int:
 
 
 class AzureTextEmbedding3Large(AzureEmbedder):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
         super().__init__(
             model_name="text-embedding-3-large",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
             client=_client,
         )
 
@@ -491,18 +486,17 @@ def dimensions(self) -> int:
 
 
 class AzureTextEmbedding3Small(AzureEmbedder):
-    def __init_
```

**File**: `src/parlant/adapters/nlp/cerebras_service.py` (modified, +12/-10)
```diff
@@ -50,6 +50,7 @@
     StreamingTextGeneratorHints,
 )
 from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.health import HealthReporter
 
 
 class LlamaEstimatingTokenizer(EstimatingTokenizer):
@@ -65,14 +66,13 @@ async def estimate_token_count(self, prompt: str) -> int:
 class CerebrasSchematicGenerator(BaseSchematicGenerator[T]):
     supported_hints = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = AsyncCerebras(api_key=os.environ.get("CEREBRAS_API_KEY"))
 
@@ -177,12 +177,12 @@ async def _do_generate(
 
 
 class Llama3_3_8B(CerebrasSchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="llama3.1-8b",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
         self._estimating_tokenizer = LlamaEstimatingTokenizer()
 
@@ -203,12 +203,12 @@ def tokenizer(self) -> LlamaEstimatingTokenizer:
 
 
 class Llama3_3_70B(CerebrasSchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="llama3.3-70b",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
         self._estimating_tokenizer = LlamaEstimatingTokenizer()
@@ -247,10 +247,12 @@ def __init__(
         logger: Logger,
         tracer: Tracer,
         meter: Meter,
+        health_reporter: HealthReporter,
     ) -> None:
         self.logger = logger
         self._tracer = tracer
         self.meter = meter
+        self._health_reporter = health_reporter
         self.logger.info("Initialized CerebrasService")
 
     @property
@@ -268,11 +270,11 @@ async def get_streaming_text_generator(
     async def get_schematic_generator(
         self, t: type[T], hints: SchematicGeneratorHints = {}
     ) -> CerebrasSchematicGenerator[T]:
-        return Llama3_3_70B[t](self.logger, self._tracer, self.meter)  # type: ignore
+        return Llama3_3_70B[t](self.logger, self._tracer, self.meter, self._health_reporter)  # type: ignore
 
     @override
     async def get_embedder(self, hints: EmbedderHints = {}) -> Embedder:
-        return JinaAIEmbedder(self.logger, self._tracer, self.meter)
+        return JinaAIEmbedder(self.logger, self._tracer, self.meter, self._health_reporter)
 
     @override
     async def get_moderation_service(self) -> ModerationService:
```

**File**: `src/parlant/adapters/nlp/deepseek_service.py` (modified, +12/-11)
```diff
@@ -58,6 +58,7 @@
     ModerationService,
     NoModeration,
 )
+from parlant.core.health import HealthReporter
 
 
 class DeepSeekEstimatingTokenizer(EstimatingTokenizer):
@@ -75,14 +76,13 @@ class DeepSeekSchematicGenerator(BaseSchematicGenerator[T]):
     supported_deepseek_params = ["temperature", "logit_bias", "max_tokens"]
     supported_hints = supported_deepseek_params + ["strict"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = AsyncClient(
             base_url="https://api.deepseek.com",
@@ -203,8 +203,8 @@ async def _do_generate(
 
 
 class DeepSeek_Chat(DeepSeekSchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
-        super().__init__(model_name="deepseek-chat", logger=logger, tracer=tracer, meter=meter)
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
+        super().__init__(model_name="deepseek-chat", logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter)
 
     @property
     @override
@@ -225,15 +225,16 @@ def verify_environment() -> str | None:
 
         return None
 
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         self._logger = logger
         self._tracer = tracer
         self._meter = meter
+
+        self._health_reporter = health_reporter
         self._logger.info("Initialized DeepSeekService")
 
     @property
@@ -251,11 +252,11 @@ async def get_streaming_text_generator(
     async def get_schematic_generator(
         self, t: type[T], hints: SchematicGeneratorHints = {}
     ) -> DeepSeekSchematicGenerator[T]:
-        return DeepSeek_Chat[t](self._logger, self._tracer, self._meter)  # type: ignore
+        return DeepSeek_Chat[t](self._logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
 
     @override
     async def get_embedder(self, hints: EmbedderHints = {}) -> Embedder:
-        return JinaAIEmbedder(self._logger, self._tracer, self._meter)
+        return JinaAIEmbedder(self._logger, self._tracer, self._meter, self._health_reporter)
 
     @override
     async def get_moderation_service(self) -> ModerationService:
```

**File**: `src/parlant/adapters/nlp/emcie_service.py` (modified, +36/-37)
```diff
@@ -55,6 +55,7 @@
 )
 from parlant.core.tracer import Tracer
 from parlant.core.version import VERSION
+from parlant.core.health import HealthReporter
 
 
 RATE_LIMIT_ERROR_MESSAGE = (
@@ -128,15 +129,14 @@ def _get_error_detail(response: httpx.Response) -> tuple[str, str]:
 class EmcieSchematicGenerator(BaseSchematicGenerator[T]):
     supported_emcie_params = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         model_role: ModelRole,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._model_role = model_role
         self._tokenizer = EmcieEstimatingTokenizer()
@@ -289,18 +289,17 @@ async def _do_generate(
 
 
 class Jackal(EmcieSchematicGenerator[T]):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
         model_role: ModelRole,
     ) -> None:
         super().__init__(
             model_name="jackal",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
             model_role=model_role,
         )
 
@@ -311,18 +310,17 @@ def max_tokens(self) -> int:
 
 
 class Bison(EmcieSchematicGenerator[T]):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
         model_role: ModelRole,
     ) -> None:
         super().__init__(
             model_name="bison",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
             model_role=model_role,
         )
 
@@ -345,15 +343,14 @@ class EmcieStreamingTextGenerator(BaseStreamingTextGenerator):
 
     supported_emcie_params = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         model_role: ModelRole,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
         self._model_role = model_role
         self._tokenizer = EmcieEstimatingTokenizer()
 
@@ -501,36 +498,34 @@ def get_usage() -> UsageInfo:
 
 
 class JackalStreaming(EmcieStreamingTextGenerator):
-    def __init__(
-        self,
+    def __init__(self,
         model_role: ModelRole,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         super().__init__(
             model_name="jackal",
             model_role=model_role,
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
 
 class BisonStreaming(EmcieStreamingTextGenerator):
-    def __init__(
-        self,
+    def __init__(self,
         model_role: ModelRole,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         super().__init__(
             model_name="bison",
             model_role=model_role,
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
 
@@ -542,14 +537,13 @@ def __init__(
 class EmcieEmbedder(BaseEmbedder):
     supported_arguments = ["dimensions"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger, tracer, meter, model_name)
+        super().__init__(logger, tracer, meter, model_name, health_reporter)
         self._tokenizer = EmcieEstimatingTokenizer()
 
     @property
@@ -630,12 +624,12 @@ async def do_embed(
 
 
 class BisonEmbedding(EmcieEmbedder):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="bison-embedding",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
```

---

### Incident Patch 10: `7f9a4afb` (2026-04-27)
**Commit Message**: Render active journey descriptions in canned response draft prompt

The draft prompt builder in CannedResponseGenerator received the active
journeys but never surfaced them. Active journeys with non-empty
descriptions are now rendered as a dedicated ACTIVE JOURNEYS section so
the drafter can use them as background context. Journeys whose
description is empty or whitespace-only are skipped, and the section is
omitted entirely when no qualifying journeys exist.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `src/parlant/core/engines/alpha/canned_response_generator.py` (modified, +26/-0)
```diff
@@ -1535,6 +1535,32 @@ def _build_draft_prompt(
             },
         )
         builder.add_glossary(terms)
+
+        journeys_with_descriptions = [
+            j for j in journeys if j.description and j.description.strip()
+        ]
+
+        if journeys_with_descriptions:
+            formatted_journeys = "\n".join(
+                f"{i}) {j.title}: {j.description.strip()}"
+                for i, j in enumerate(journeys_with_descriptions, start=1)
+            )
+
+            builder.add_section(
+                name="canned-response-generator-draft-active-journeys",
+                template="""
+ACTIVE JOURNEYS
+---------------
+The following journeys are currently active in this interaction. You may use their descriptions as background to inform your reply: ###
+{formatted_journeys}
+###
+""",
+                props={
+                    "formatted_journeys": formatted_journeys,
+                    "journeys": journeys_with_descriptions,
+                },
+            )
+
         builder.add_context_variables(context_variables)
         builder.add_capabilities_for_message_generation(capabilities)
         builder.add_low_criticality_guidelines(
```

**File**: `tests/sdk/test_journeys.py` (modified, +22/-0)
```diff
@@ -2278,3 +2278,25 @@ async def run(self, ctx: Context) -> None:
         )
 
         assert "john_smith_8831" in third_response.lower()
+
+
+class Test_that_active_journey_description_influences_canned_response_draft(SDKTest):
+    async def setup(self, server: p.Server) -> None:
+        self.agent = await server.create_agent(
+            name="Banana Agent",
+            description="Agent for testing journey description rendering in draft prompt",
+        )
+
+        self.journey = await self.agent.create_journey(
+            title="Banana Mention Journey",
+            description="When you reply to the customer, always include the word 'banana' somewhere in your response.",
+            conditions=["Customer asks anything at all"],
+        )
+
+    async def run(self, ctx: Context) -> None:
+        answer = await ctx.send_and_receive_message(
+            customer_message="Hello, what's the weather like today?",
+            recipient=self.agent,
+        )
+
+        assert await nlp_test(answer, "It mentions a banana")
```

---

### Incident Patch 11: `1dbcb93a` (2026-04-21)
**Commit Message**: Include guideline description while matching

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/disambiguation_batch.py` (modified, +3/-1)
```diff
@@ -78,6 +78,7 @@ class _Guideline:
     conditions: list[str]
     action: str | None
     ids: list[GuidelineId]
+    description: Optional[str] = None
 
 
 class GenericDisambiguationGuidelineMatchingBatch(GuidelineMatchingBatch):
@@ -138,6 +139,7 @@ async def _get_disambiguation_targets(
                 conditions=[internal_representation(g).condition],
                 action=internal_representation(g).action,
                 ids=[g.id],
+                description=internal_representation(g).description,
             )
             i += 1
         return guidelines
@@ -296,7 +298,7 @@ def _build_prompt(
 
         disambiguation_targets_text = "\n".join(
             f"{id}) Condition: {', '.join(g.conditions) if len(g.conditions) > 1 else g.conditions[0]}. "
-            f"Action: {g.action}"
+            f"Action: {g.action}" + (f" Description: {g.description}" if g.description else "")
             for id, g in disambiguation_targets_guidelines.items()
         )
         builder = PromptBuilder(on_build=lambda prompt: self._logger.trace(f"Prompt:\n{prompt}"))
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/guideline_actionable_batch.py` (modified, +5/-0)
```diff
@@ -216,6 +216,11 @@ def _build_prompt(
 
         guidelines_text = "\n".join(
             f"{i}) Condition: {guideline_representations[g.id].condition}. Action: {guideline_representations[g.id].action}"
+            + (
+                f" Description: {guideline_representations[g.id].description}"
+                if guideline_representations[g.id].description
+                else ""
+            )
             for i, g in self._guidelines.items()
         )
 
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/guideline_low_criticality_batch.py` (modified, +5/-0)
```diff
@@ -191,6 +191,11 @@ def _build_prompt(
 
         guidelines_text = "\n".join(
             f"{i}) Condition: {guideline_representations[g.id].condition}. Action: {guideline_representations[g.id].action}"
+            + (
+                f" Description: {guideline_representations[g.id].description}"
+                if guideline_representations[g.id].description
+                else ""
+            )
             for i, g in self._guidelines.items()
         )
 
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/guideline_previously_applied_actionable_batch.py` (modified, +5/-0)
```diff
@@ -222,6 +222,11 @@ def _build_prompt(
 
         guidelines_text = "\n".join(
             f"{i}) Condition: {guideline_representations[g.id].condition}. Action: {guideline_representations[g.id].action}"
+            + (
+                f" Description: {guideline_representations[g.id].description}"
+                if guideline_representations[g.id].description
+                else ""
+            )
             for i, g in self._guidelines.items()
         )
 
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/guideline_previously_applied_actionable_customer_dependent_batch.py` (modified, +5/-0)
```diff
@@ -230,6 +230,11 @@ def _build_prompt(
 
         guidelines_text = "\n".join(
             f"{i}) Condition: {guideline_representations[g.id].condition}. Action: {guideline_representations[g.id].action}"
+            + (
+                f" Description: {guideline_representations[g.id].description}"
+                if guideline_representations[g.id].description
+                else ""
+            )
             for i, g in self._guidelines.items()
         )
 
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/journey/journey_next_step_selection.py` (modified, +6/-1)
```diff
@@ -57,6 +57,7 @@ class _JourneyNode:
     customer_action_description: Optional[str] = None
     agent_dependent_action: Optional[bool] = None
     agent_action_description: Optional[str] = None
+    description: Optional[str] = None
     guideline: Guideline | None = None
 
 
@@ -181,6 +182,7 @@ def _create_node(
                     dict[str, str | None],
                     guideline.metadata.get("customer_dependent_action_data", {}),
                 ).get("agent_action", None),
+                description=guideline.content.description,
                 guideline=guideline,
             )
             return node
@@ -423,9 +425,12 @@ def get_journey_transition_map_text(
         elif current_node.kind == JourneyNodeKind.TOOL:
             flags_str += "- TOOL EXECUTION: This step is considered complete as long as the tool has been executed.\n"
 
+        node_description_line = (
+            f"Description: {current_node.description}\n" if current_node.description else ""
+        )
         current_node_description = f"""
 {current_node.action}
-{flags_str}
+{node_description_line}{flags_str}
 """
 
         follow_ups_nodes_description = ""
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/response_analysis_batch.py` (modified, +5/-0)
```diff
@@ -274,6 +274,11 @@ def _add_guideline_matches_section(
     ) -> str:
         guidelines_text = "\n".join(
             f"{i}) Condition: {guideline_representations[g.id].condition}. Action: {guideline_representations[g.id].action}"
+            + (
+                f" Description: {guideline_representations[g.id].description}"
+                if guideline_representations[g.id].description
+                else ""
+            )
             for i, g in guidelines.items()
         )
 
```

---

### Incident Patch 12: `9f8a91b3` (2026-04-19)
**Commit Message**: Standardize guideline/journey log vocabulary and rename on_match to on_selected

**File**: `CHANGELOG.md` (modified, +20/-5)
```diff
@@ -4,19 +4,34 @@ All notable changes to Parlant will be documented here.
 
 ## [Unreleased]
 
-### Security
+### Added
 
-- Upgrade dependencies to address known CVEs: authlib (>=1.6.11), requests (>=2.33.0), fastmcp (>=3.2.0), litellm (>=1.83.0), pytest (>=9.0.3), pyjwt (>=2.11.1), and constrain transitive deps — aiohttp, cryptography, pillow, pyopenssl, werkzeug, Mako, pyasn1, python-multipart, orjson, Pygments, diskcache
-- Upgrade chat frontend: vite (>=7.3.2) and override transitive deps — picomatch, lodash, flatted, brace-expansion, immutable, yaml
+- Add per-decision debug logs to journey node selection (`Journey '<title>': advanced/stayed/exited/completed/backtracked/auto-advanced/...`) so journey progression is visible at debug level alongside guideline matching
+- Add a warning log for invalid condition ids returned during journey next-step selection
 
-### Fixed
+### Changed
 
-- Fix WebSocketLogger event loop starvation — when no WebSocket clients are subscribed, the drain loop processed queued messages without yielding, progressively blocking the async event loop and causing increasing latency over time
+- Rename SDK callback `on_match` to `on_selected` on guidelines and journey state transitions to reflect that it fires post-resolution, when the entity is selected for message generation; `EngineHooks.on_guideline_match_handlers` and `on_journey_match_handlers` are renamed to `on_guideline_selected_handlers` and `on_journey_selected_handlers` accordingly
+- Standardize guideline matcher log vocabulary: `"Activated"` → `"Matched"`, `"Skipped"` → `"Not matched"`, and `"Not applied"` → `"Unapplied"`
+- Standardize relational resolver log vocabulary: `"Skipped: ... deactivated due to ..."` → `"Dropped (<reason>): ..."` with reasons `lower priority`, `unmet dependency`, `dependency on dropped entity`, `deprioritized by guideline`, and `deprioritized by journey`
+- Disambiguation batch now uses the standard matcher vocabulary (`"Matched (disambiguation)"` / `"Not matched (disambiguation)"`) and emits a log on the negative branch (previously silent)
+- Normalize observational batch rationale to plain `match.rationale` (no longer wrapped with `Condition Application Rationale: "..."`) for consistency with other batches
+- Normalize low-criticality batch warning string to `"No checks generated"` to match other batches
 
 ### Removed
 
 - Remove redundant `glm_service.py` NLP adapter and `NLPServices.glm()` factory method — the GLM/bigmodel.cn API is already covered by the existing Zhipu adapter (`zhipu_service.py`), which uses the official `zhipuai` SDK and supports GLM-4 model variants. Use `NLPServices.zhipu()` instead.
 
+### Fixed
+
+- Fix low-criticality matcher logging the entire inference blob once per guideline in a batch (N copies of the same payload at debug level); now logs a single per-item entry
+- Fix WebSocketLogger event loop starvation — when no WebSocket clients are subscribed, the drain loop processed queued messages without yielding, progressively blocking the async event loop and causing increasing latency over time
+
+### Security
+
+- Upgrade dependencies to address known CVEs: authlib (>=1.6.11), requests (>=2.33.0), fastmcp (>=3.2.0), litellm (>=1.83.0), pytest (>=9.0.3), pyjwt (>=2.11.1), and constrain transitive deps — aiohttp, cryptography, pillow, pyopenssl, werkzeug, Mako, pyasn1, python-multipart, orjson, Pygments, diskcache
+- Upgrade chat frontend: vite (>=7.3.2) and override transitive deps — picomatch, lodash, flatted, brace-expansion, immutable, yaml
+
 ## [3.3.1] - 2026-04-14
 
 ### Added
```

**File**: `src/parlant/api/chat/dist/assets/index-BRVifGSy.css` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-@import"https://fonts.googleapis.com/css2?family=Ubuntu+Sans:ital,wght@0,100..800;1,100..800&display=swap";#root{height:100vh;margin:auto;font-family:Inter}body{pointer-events:all!important}.fixed-scroll{overflow:scroll;scrollbar-width:thin;scrollbar-color:#ebecf0 transparent}.fixed-scroll:hover{scrollbar-color:#cdcdcd transparent}.fixed-scroll::-webkit-scrollbar{width:10px}.fixed-scroll::-webkit-scrollbar-thumb{background-color:#00000080;border-radius:10px}.fixed-scroll::-webkit-scrollbar-track{background:transparent}.markdown *{font-size:revert;font-weight:revert;padding:revert;margin:revert;list-style-type:revert;color:revert;-webkit-text-decoration:revert;text-decoration:revert}img{-webkit-user-select:none;-moz-user-select:none;user-select:none}.bubblesWrapper{height:-moz-fit-content;height:fit-content;width:-moz-fit-content;width:fit-content;background-color:#f5f9f7;padding:10px;margin:10px;margin-inline-start:20px;border-radius:15px}.bubbles{height:15px;width:31px;aspect-ratio:2.5;--_g: no-repeat radial-gradient(farthest-side, #333333 90%, #0000);background:var(--_g),var(--_g),var(--_g);background-size:25% 50%;animation:l43 1s infinite linear}@keyframes l43{0%{background-position:0% 50%,50% 50%,100% 50%}20%{background-position:0% 0,50% 50%,100% 50%}40%{background-position:0% 100%,50% 0,100% 50%}60%{background-position:0% 50%,50% 100%,100% 0}80%{background-position:0% 50%,50% 50%,100% 100%}to{background-position:0% 50%,50% 50%,100% 50%}}@keyframes animate-slide-down{0%{max-height:0}to{max-height:300px;min-height:-moz-fit-content;min-height:fit-content}}@keyframes animate-slide-up{0%{max-height:150px}to{max-height:0}}.animate-slide-down{animation:animate-slide-down .5s ease-out forwards}.animate-slide-up{animation:animate-slide-up .3s linear forwards}._editSession_1nfqv_1{position:relative}._editSession_1nfqv_1:before{content:"";position:absolute;top:50%;left:50%;border:1px solid black;pointer-events:none;box-sizing:border-box;height:calc(100% - 4px);width:calc(100% - 8px);transform:translate(-50%,-50%);border-radius:6px}pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}/*!
-  Theme: GitHub
-  Description: Light theme as seen on github.com
-  Author: github.com
-  Maintainer: @Hirse
-  Updated: 2021-05-15
-
-  Outdated base version: https://github.com/primer/github-syntax-light
-  Current colors taken from GitHub's CSS
-*/.hljs{color:#24292e;background:#fff}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:700}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:700}.hljs-addition{color:#22863a;background-color:#f0fff4}.hljs-deletion{color:#b31d28;background-color:#ffeef0}._pendingVideo_n2mv1_1{clip-path:inset(1px .9px .5px .8px round 50%)}._markdown_n2mv1_5 code{white-space:break-spaces;max-width:100%;word-break:break-word;background:transparent!important;font-size:14px}._markdown_n2mv1_5 p{word-break:break-word}._markdown_n2mv1_5 ul{all:revert;margin:0;padding:0;list-style:inside}._markdown_n2mv1_5 h2{font-weight:700}._markdown_n2mv1_5 table{white-space:nowrap;display:block;overflow:scroll;scrollbar-width:auto;border-radius:2px}._markdown_n2mv1_5 table th,._markdown_n2mv1_5 table td{padding-inline:10px;text-align:start}._markdown_n2mv1_5 table th{padding:10px}._markdown_n2mv1_5 table tr:last-child td{padding-bottom:10px}._markdown_n2mv1_5 table thead{border:1px solid lightgray;border-bottom:none;border-radius:3px 3px 0 0;padding:10px}._markdown_n2mv1_5 table tbody{border:1px solid lightgray;border-top:none;border-radius:0 0 3px 3px;padding:10px}._markdown_n2mv1_5 li>div{display:inline}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:100;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Thin.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:200;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-ExtraLight.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:300;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Light.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:400;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Regular.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:500
```

**File**: `src/parlant/api/chat/dist/assets/index-DIdtHchq.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+@import"https://fonts.googleapis.com/css2?family=Ubuntu+Sans:ital,wght@0,100..800;1,100..800&display=swap";#root{height:100vh;margin:auto;font-family:Inter}body{pointer-events:all!important}.fixed-scroll{overflow:scroll;scrollbar-width:thin;scrollbar-color:#ebecf0 transparent}.fixed-scroll:hover{scrollbar-color:#cdcdcd transparent}.fixed-scroll::-webkit-scrollbar{width:10px}.fixed-scroll::-webkit-scrollbar-thumb{background-color:#00000080;border-radius:10px}.fixed-scroll::-webkit-scrollbar-track{background:transparent}.markdown *{font-size:revert;font-weight:revert;padding:revert;margin:revert;list-style-type:revert;color:revert;-webkit-text-decoration:revert;text-decoration:revert}img{-webkit-user-select:none;-moz-user-select:none;user-select:none}.bubblesWrapper{height:-moz-fit-content;height:fit-content;width:-moz-fit-content;width:fit-content;background-color:#f5f9f7;padding:10px;margin:10px;margin-inline-start:20px;border-radius:15px}.bubbles{height:15px;width:31px;aspect-ratio:2.5;--_g: no-repeat radial-gradient(farthest-side, #333333 90%, #0000);background:var(--_g),var(--_g),var(--_g);background-size:25% 50%;animation:l43 1s infinite linear}@keyframes l43{0%{background-position:0% 50%,50% 50%,100% 50%}20%{background-position:0% 0,50% 50%,100% 50%}40%{background-position:0% 100%,50% 0,100% 50%}60%{background-position:0% 50%,50% 100%,100% 0}80%{background-position:0% 50%,50% 50%,100% 100%}to{background-position:0% 50%,50% 50%,100% 50%}}@keyframes animate-slide-down{0%{max-height:0}to{max-height:300px;min-height:-moz-fit-content;min-height:fit-content}}@keyframes animate-slide-up{0%{max-height:150px}to{max-height:0}}.animate-slide-down{animation:animate-slide-down .5s ease-out forwards}.animate-slide-up{animation:animate-slide-up .3s linear forwards}._editSession_1nfqv_1{position:relative}._editSession_1nfqv_1:before{content:"";position:absolute;top:50%;left:50%;border:1px solid black;pointer-events:none;box-sizing:border-box;height:calc(100% - 4px);width:calc(100% - 8px);transform:translate(-50%,-50%);border-radius:6px}pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}.hljs{color:#24292e;background:#fff}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:700}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:700}.hljs-addition{color:#22863a;background-color:#f0fff4}.hljs-deletion{color:#b31d28;background-color:#ffeef0}._pendingVideo_n2mv1_1{clip-path:inset(1px .9px .5px .8px round 50%)}._markdown_n2mv1_5 code{white-space:break-spaces;max-width:100%;word-break:break-word;background:transparent!important;font-size:14px}._markdown_n2mv1_5 p{word-break:break-word}._markdown_n2mv1_5 ul{all:revert;margin:0;padding:0;list-style:inside}._markdown_n2mv1_5 h2{font-weight:700}._markdown_n2mv1_5 table{white-space:nowrap;display:block;overflow:scroll;scrollbar-width:auto;border-radius:2px}._markdown_n2mv1_5 table th,._markdown_n2mv1_5 table td{padding-inline:10px;text-align:start}._markdown_n2mv1_5 table th{padding:10px}._markdown_n2mv1_5 table tr:last-child td{padding-bottom:10px}._markdown_n2mv1_5 table thead{border:1px solid lightgray;border-bottom:none;border-radius:3px 3px 0 0;padding:10px}._markdown_n2mv1_5 table tbody{border:1px solid lightgray;border-top:none;border-radius:0 0 3px 3px;padding:10px}._markdown_n2mv1_5 li>div{display:inline}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:100;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Thin.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:200;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-ExtraLight.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:300;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Light.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:400;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Regular.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:500;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-Medium.ttf) format("truetype")}@font-face{font-family:Ubuntu Sans;font-style:normal;font-weight:600;src:url(/chat/fonts/ubuntu-sans/static/UbuntuSans-SemiBold.ttf) format("truetype")}@font-face{font-family:Ubu
```

**File**: `src/parlant/api/chat/dist/index.html` (modified, +2/-2)
```diff
@@ -10,8 +10,8 @@
 		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
 		<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
 		<title>Parlant</title>
-		<script type="module" crossorigin src="/chat/assets/index-BBAJ1vle.js"></script>
-		<link rel="stylesheet" crossorigin href="/chat/assets/index-BRVifGSy.css">
+		<script type="module" crossorigin src="/chat/assets/index-CrGGfMHl.js"></script>
+		<link rel="stylesheet" crossorigin href="/chat/assets/index-DIdtHchq.css">
 	</head>
 	<body>
 		<div id="root"></div>
```

**File**: `src/parlant/core/engines/alpha/engine.py` (modified, +4/-4)
```diff
@@ -326,13 +326,13 @@ async def uncancellable_section(
                 # relational resolution.
                 await self._inject_transient_guidelines(context)
 
-                # Call on_match handlers for all matched guidelines (before generating messages)
+                # Call on_selected handlers for all selected guidelines (before generating messages)
                 await self._call_guideline_handlers(
-                    context, self._hooks.on_guideline_match_handlers
+                    context, self._hooks.on_guideline_selected_handlers
                 )
 
-                # Call on_match handlers for all active journeys (before generating messages)
-                await self._call_journey_handlers(context, self._hooks.on_journey_match_handlers)
+                # Call on_selected handlers for all active journeys (before generating messages)
+                await self._call_journey_handlers(context, self._hooks.on_journey_selected_handlers)
 
                 # Update session labels from matched entities
                 await self._update_session_labels(context)
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/custom_guideline_matching_strategy.py` (modified, +2/-2)
```diff
@@ -71,11 +71,11 @@ async def process(self) -> GuidelineMatchingBatchResult:
         is_matched = match is not None and match.score == 10
 
         if is_matched:
-            self._logger.debug(f"Activated:\n{data}")
+            self._logger.debug(f"Matched:\n{data}")
             assert match is not None
             matches = [match]
         else:
-            self._logger.debug(f"Skipped:\n{data}")
+            self._logger.debug(f"Not matched:\n{data}")
             matches = []
 
         return GuidelineMatchingBatchResult(
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/disambiguation_batch.py` (modified, +5/-1)
```diff
@@ -191,7 +191,11 @@ async def process(self) -> GuidelineMatchingBatchResult:
                         metadata["disambiguation"] = disambiguation_data
 
                         self._logger.debug(
-                            f"Disambiguation activated: {inference.content.model_dump_json(indent=2)}"
+                            f"Matched (disambiguation):\n{inference.content.model_dump_json(indent=2)}"
+                        )
+                    else:
+                        self._logger.debug(
+                            f"Not matched (disambiguation):\n{inference.content.model_dump_json(indent=2)}"
                         )
 
                     matches = [
```

**File**: `src/parlant/core/engines/alpha/guideline_matching/generic/guideline_actionable_batch.py` (modified, +2/-2)
```diff
@@ -126,7 +126,7 @@ async def process(self) -> GuidelineMatchingBatchResult:
 
                     for match in inference.content.checks:
                         if match.applies:
-                            self._logger.debug(f"Activated:\n{match.model_dump_json(indent=2)}")
+                            self._logger.debug(f"Matched:\n{match.model_dump_json(indent=2)}")
 
                             matches.append(
                                 GuidelineMatch(
@@ -136,7 +136,7 @@ async def process(self) -> GuidelineMatchingBatchResult:
                                 )
                             )
                         else:
-                            self._logger.debug(f"Skipped:\n{match.model_dump_json(indent=2)}")
+                            self._logger.debug(f"Not matched:\n{match.model_dump_json(indent=2)}")
 
                     return GuidelineMatchingBatchResult(
                         matches=matches,
```

---

### Incident Patch 13: `f664e960` (2026-04-27)
**Commit Message**: Fix redundant batch creation in ToolCaller across guideline matches

Signed-off-by: Dor Zohar <[REDACTED_EMAIL]>

**File**: `src/parlant/core/engines/alpha/tool_calling/tool_caller.py` (modified, +7/-7)
```diff
@@ -215,15 +215,15 @@ async def _do_infer_tool_calls(
 
                 tools[(tool_id, tool)].append(guideline_match)
 
-            batches = await self.batcher.create_batches(
-                tools=tools,
-                context=context,
-            )
+        batches = await self.batcher.create_batches(
+            tools=tools,
+            context=context,
+        )
 
-            batch_tasks = [batch.process() for batch in batches]
-            batch_results = await async_utils.safe_gather(*batch_tasks)
+        batch_tasks = [batch.process() for batch in batches]
+        batch_results = await async_utils.safe_gather(*batch_tasks)
 
-            t_end = time.time()
+        t_end = time.time()
 
         # Aggregate insights from all batch results (e.g., missing data across batches)
         aggregated_evaluations: list[tuple[ToolId, ToolCallEvaluation]] = []
```

---

### Incident Patch 14: `e7313978` (2026-04-23)
**Commit Message**: fix: upgrade dependencies and remove overrides for security improvements

Signed-off-by: Menachem Brichta <[REDACTED_EMAIL]>

**File**: `src/parlant/api/chat/package-lock.json` (modified, +67/-0)
```diff
@@ -3741,6 +3741,18 @@
         "node": ">= 8"
       }
     },
+    "node_modules/anymatch/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/arg": {
       "version": "5.0.2",
       "resolved": "https://registry.npmjs.org/arg/-/arg-5.0.2.tgz",
@@ -4180,6 +4192,13 @@
         "node": ">= 6"
       }
     },
+    "node_modules/concat-map": {
+      "version": "0.0.1",
+      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
+      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/convert-source-map": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
@@ -5821,6 +5840,19 @@
         "node": "^14.15.0 || ^16.10.0 || >=18.0.0"
       }
     },
+    "node_modules/jest-util/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "dev": true,
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/jiti": {
       "version": "1.21.7",
       "resolved": "https://registry.npmjs.org/jiti/-/jiti-1.21.7.tgz",
@@ -7007,6 +7039,18 @@
         "node": ">=8.6"
       }
     },
+    "node_modules/micromatch/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/mime-db": {
       "version": "1.52.0",
       "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
@@ -7053,6 +7097,17 @@
         "node": "*"
       }
     },
+    "node_modules/minimatch/node_modules/brace-expansion": {
+      "version": "1.1.14",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.14.tgz",
+      "integrity": "sha512-MWPGfDxnyzKU7rNOW9SP/c50vi3xrmrua/+6hfPbCS2ABNWfx24vPidzvC7krjU/RTo235sV776ymlsMtGKj8g==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "balanced-match": "^1.0.0",
+        "concat-map": "0.0.1"
+      }
+    },
     "node_modules/minipass": {
       "version": "7.1.2",
       "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.2.tgz",
@@ -7808,6 +7863,18 @@
         "node": ">=8.10.0"
       }
     },
+    "node_modules/readdirp/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/redent": {
       "version": "3.0.0",
       "resolved": "https://registry.npmjs.org/redent/-/redent-3.0.0.tgz",
```

**File**: `src/parlant/api/chat/package.json` (modified, +0/-8)
```diff
@@ -71,13 +71,5 @@
     "typescript": "^5.5.3",
     "typescript-eslint": "^8.7.0",
     "vitest": "^4.0.6"
-  },
-  "overrides": {
-    "brace-expansion": "^2.0.3",
-    "flatted": "^3.4.2",
-    "immutable": "^5.1.5",
-    "lodash": "^4.18.0",
-    "picomatch": "^4.0.4",
-    "yaml": "^2.8.3"
   }
 }
```

---

### Incident Patch 15: `3783c554` (2026-03-14)
**Commit Message**: Fix mypy errors in MCP service, tests, and journey edge type annotations

Signed-off-by: Alex Santangelo <[REDACTED_EMAIL]>

**File**: `src/parlant/core/services/tools/mcp_service.py` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ async def _close_client(
         traceback: Optional[TracebackType] = None,
     ) -> None:
         try:
-            await client.__aexit__(exc_type, exc_value, traceback)  # type: ignore[arg-type]
+            await client.__aexit__(exc_type, exc_value, traceback)  # type: ignore[no-untyped-call]
         except RuntimeError:
             pass
         except Exception as exc:
@@ -247,7 +247,7 @@ async def _connect(self, force: bool = False) -> Client[StreamableHttpTransport]
                 client = self._create_client()
 
                 try:
-                    await asyncio.wait_for(client.__aenter__(), timeout=10.0)  # type: ignore[arg-type]
+                    await asyncio.wait_for(client.__aenter__(), timeout=10.0)  # type: ignore[no-untyped-call]
                     self._client = client
                     return client
                 except asyncio.TimeoutError:
```

**File**: `tests/core/stable/services/tools/test_mcp_client.py` (modified, +6/-3)
```diff
@@ -28,15 +28,18 @@ async def test_that_mcp_client_reconnects_after_its_session_is_closed(
             assert "Ahoy Short Jon Nickel! I doubled your lucky number to 14 !" in result.data
 
             assert client._client is not None
-            await client._client.close()
+            await client._client.close()  # type: ignore[no-untyped-call]
 
             reconnected_result = await client.call_tool(
                 "greet_me_like_pirate",
                 ToolContext("", "", ""),
                 {"name": "Another Pirate", "lucky_number": 9},
             )
 
-            assert "Ahoy Another Pirate! I doubled your lucky number to 18 !" in reconnected_result.data
+            assert (
+                "Ahoy Another Pirate! I doubled your lucky number to 18 !"
+                in reconnected_result.data
+            )
 
 
 async def test_that_mcp_client_retries_initial_connection(
@@ -75,7 +78,7 @@ def fake_create_client() -> FakeClient:
         attempted_clients.append(fake_client)
         return fake_client
 
-    client._create_client = fake_create_client  # type: ignore[method-assign]
+    client._create_client = fake_create_client  # type: ignore[method-assign, assignment]
 
     async with client:
         assert len(attempted_clients) == 2
```

#### Recent Merged Pull Requests:
- **PR #824** (closed): Add Compass telemetry to OSS package (@mc-dorzo)
- **PR #822** (2026-07-10): perf(core): optimize batch deserialization and parallelize entity loading (@chibexme)
- **PR #820** (2026-06-25): perf(db): optimize MongoDB startup document migration (@chibexme)
- **PR #817** (2026-06-22): fix(core): prevent version drift from silently dropping tag associati… (@chibexme)
- **PR #816** (closed): Preserve SDK startup errors (@mc-dorzo)
- **PR #815** (closed): Preserve SDK startup errors (@mc-dorzo)
- **PR #814** (2026-06-17): feat: expose Parlant version over tunnel RPC (@mc-dorzo)
- **PR #812** (2026-06-17): feat: stream session events through cloud tunnel (@mc-dorzo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
