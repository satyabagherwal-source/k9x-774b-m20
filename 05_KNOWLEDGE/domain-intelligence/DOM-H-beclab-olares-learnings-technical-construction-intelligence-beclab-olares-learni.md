# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: beclab-olares-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "beclab-olares-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T13:36:13.590Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-beclab-olares-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [beclab-olares-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T13:36:13.590Z`  
> **Learning ID**: `LEARN-EVO-beclab-olares-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), L (Deployment & Operations Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), F (Design Intelligence)
- **Confidence Rating**: 58%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from beclab-olares-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/beclab-olares-learnings.md`  
> **Source**: github ([https://github.com/beclab/Olares](https://github.com/beclab/Olares))  
> **Source Version**: `18aa13cc`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T13:36:00.268Z  
> **Learning ID**: `learn-github-beclab-olares`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): beclab/Olares

> **Canonical Artifact**: `07_PROJECT_LEARNING/beclab-olares-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/beclab/Olares](https://github.com/beclab/Olares))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T13:36:00.264Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `beclab/Olares`
- **Description**: Open-Source Personal Cloud OS for Always-On Agents
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5385 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/packages/app/src-pwa/custom-service-worker.ts`
```
/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config.js > pwa > workboxPluginMode is set to "InjectManifest"
 */

declare const self: ServiceWorkerGlobalScope &
	typeof globalThis & { skipWaiting: () => void };

import { precacheAndRoute } from 'workbox-precaching';
// import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

precacheAndRoute(
	self.__WB_MANIFEST.filter((entry) => {
		if (typeof entry == 'string') {
			return true;
		}
		return !entry.url.endsWith('.html');
	})
);

self.addEventListener('install', () => {
	// console.log('Service Worker installing.');
});

self.addEventListener('activate', () => {
	// console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
	// console.log('Fetching:', event);
});

registerRoute(
	({ request }) => {
		return request.mode === 'navigate';
	},
	new NetworkOnly({
		plugins: []
	})
);

```

### Core Architecture Module: `apps/packages/app/src-pwa/register-service-worker.ts`
```
import { register } from 'register-service-worker';

// The ready(), registered(), cached(), updatefound() and updated()
// events passes a ServiceWorkerRegistration instance in their arguments.
// ServiceWorkerRegistration: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isDesktop = !/(iPhone|iPod|iPad)/i.test(navigator.userAgent);
const key = Date.now();

if (isDesktop && isSafari) {
	// safari does not support pwa on the desktop
} else {
	register(`${process.env.SERVICE_WORKER_FILE}?key=${key}`, {
		// The registrationOptions object will be passed as the second argument
		// to ServiceWorkerContainer.register()
		// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

		// registrationOptions: { scope: './' },

		ready(/* registration */) {
			// console.log('Service worker is active.')
		},

		registered(/* registration */) {
			// console.log('Service worker has been registered.')
		},

		cached(/* registration */) {
			// console.log('Content has been cached for offline use.')
		},

		updatefound(/* registration */) {
			// console.log('New content is downloading.')
		},

		updated(/* registration */) {
			// console.log('New content is available; please refresh.')
		},

		offline() {
			// console.log('No internet connection found. App is running in offline mode.')
		},

		error(/* err */) {
			// console.error('Error during service worker registration:', err)
		}
	});
}

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/awss3/utils.ts`
```
import { useDataStore } from 'src/stores/data';
import { DriveType } from 'src/utils/interface/files';
import { appendPath } from '../path';
import { CommonFetch } from '../../fetch';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';

export function formatResourcesUrl(url: string) {
	const newUrl = awss3RemovePrefix(url);
	return awss3CommonUrl('resources', newUrl);
}

export async function createDir(url) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function remove(url: string) {
	return CommonFetch.delete(formatResourcesUrl(url));
}

export async function put(url: string, content = '') {
	return CommonFetch.put(formatResourcesUrl(url), content);
}

export function download(_format, files) {
	const name = files.path.split('/')[3];
	const path = '/' + files.path.split('/').slice(4).join('/');
	return generateDownloadUrl(files.driveType, path, name);
}
export function generateDownloadUrl(
	driveType: DriveType,
	path: string,
	name: string
) {
	const store = useDataStore();
	const baseURL = store.baseURL();
	return `${baseURL}/drive/download_sync_stream?drive=${driveType}&cloud_file_path=${path}&name=${name}`;
}

export function awss3RemovePrefix(url: string) {
	url = awss3RemoveHomePrefix(url);
	return url;
}

export function awss3RemoveHomePrefix(url: string) {
	if (!url.startsWith('/Drive/awss3')) {
		return url;
	}
	return url.slice(12);
}

export const awss3CommonUrl = (type: CommonUrlApiType, path: string) => {
	return (
		commonUrlPrefix(type) + 'awss3' + (path.startsWith('/') ? path : '/' + path)
	);
};

export const formatPathtoUrl = (path: string) => {
	path = awss3RemovePrefix(path);
	return appendPath('/awss3', path);
};

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/cache/utils.ts`
```
import { getAppDataPath } from 'src/utils/file';
import { CommonFetch } from '../../fetch';
import { appendPath } from '../path';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';
import { encodeUrl } from 'src/utils/encode';

export function formatResourcesUrl(url: string) {
	const { path, node } = getAppDataPath(url);
	return cacheCommonUrl('resources', path, node);
}

export async function createDir(url) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function remove(url) {
	return CommonFetch.delete(formatResourcesUrl(url));
}

export async function put(url, content = '') {
	return CommonFetch.put(formatResourcesUrl(url), content, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}

export function cacheRemovePrefix(url: string) {
	url = cacheRemoveCachePrefix(url);
	return url;
}

export function cacheRemoveCachePrefix(url: string) {
	if (!url.startsWith('/Cache') && !url.startsWith('/cache')) {
		return url;
	}
	return url.slice(6);
}

export const cacheCommonUrl = (
	type: CommonUrlApiType,
	path: string,
	node?: string
) => {
	return appendPath(commonUrlPrefix(type), 'cache', node ? node : '', path);
};

export const formatPathtoUrl = (path: string) => {
	path = cacheRemovePrefix(path);
	return appendPath('/cache', path);
};

export const displayPath = (file: {
	isDir: boolean;
	fileExtend?: string;
	path: string;
	fileType?: string;
}) => {
	return appendPath(
		'/Cache',
		file.fileExtend || '',
		encodeUrl(file.path),
		file.isDir ? '/' : ''
	);
};

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/common/utils.ts`
```
import { BtNotify, NotifyDefinedType } from '@bytetrade/ui';
import { CommonFetch } from '../../fetch';
import { CopyStoragesType } from 'src/stores/operation';
import { OPERATE_ACTION } from 'src/utils/contact';
import { uuid } from '@didvault/sdk/src/core';
import { decodeURIComponentSafe, getNotifyMsg } from '../utils';
import { notifyHide, notifyWaitingShow } from 'src/utils/notifyRedefinedUtil';
import { i18n } from 'src/boot/i18n';
import { TransferFront } from 'src/utils/interface/transfer';
import {
	FileItem,
	FileNode,
	useFilesStore,
	ShareUserList
} from 'src/stores/files';
import { DriveType } from 'src/utils/interface/files';
import { appendPath } from '../path';
import { encodeUrl } from 'src/utils/encode';
import { useDataStore } from 'src/stores/data';

export type CommonUrlApiType =
	| 'resources'
	| 'paste'
	| 'raw'
	| 'md5'
	| 'permission'
	| 'preview'
	| 'repos'
	| 'nodes'
	| 'stream'
	| 'tree'
	| 'share'
	| 'users';

export type FileType = 'drive' | 'external' | 'sync' | 'cache';

type TaskActionType = {
	taskId: string;
	type: TransferFront;
};

export const commonUrlPrefix = (apiType: CommonUrlApiType) => {
	return `/api/${apiType}/`;
};

export const commonUrlTypeExtend = (
	apiType: CommonUrlApiType,
	fileType: string,
	fileExtend: string
) => {
	return appendPath('/api', apiType, fileType, fileExtend, '/');
};

export const pasteMutiNodesDriveType: DriveType[] = [
	DriveType.External,
	DriveType.Cache
];

export async function pasteAction(
	item: CopyStoragesType,
	action: 'copy' | 'move'
): Promise<any> {
	const opts: any = {};

	const filesStore = useFilesStore();

	const node =
		item.dst_node ||
		item.src_node ||
		(filesStore.nodes.length > 0 ? filesStore.nodes[0].name : '');

	const destination = decodeURIComponentSafe(item.to);
	const source = decodeURIComponentSafe(item.from);

	const res = await CommonFetch.patch(
		commonUrlPrefix('paste') + node + '/',
		{
			action,
			destination,
			source: source
		},
		opts
	);

	if (res.data.code != undefined) {
		if (res.data.code === -1) {
			BtNotify.show({
				type: NotifyDefinedType.FAILED,
				message: i18n.global.t('files.backslash_upload')
			});
		}
		return undefined;
	}

	return {
		taskId: res.data.task_id,
		type: action == 'copy' ? TransferFront.copy : TransferFront.move,
		node,
		src_drive_type: item.src_drive_type,
		dst_drive_type: item.dst_drive_type
	};
}

export function moveCopy(items: CopyStoragesType[], copy = false) {
	const promises: any[] = [];

	for (const item of items) {
		promises.push(pasteAction(item, copy ? 'copy' : 'move'));
	}

	return Promise.all(promises);
}

export function move(items: CopyStoragesType[]) {
	return moveCopy(items, false);
}

export function copy(items) {
	return moveCopy(items, true);
}

export const action = async (
	// overwrite: boolean | undefined,
	// rename: boolean | undefined,
	items: CopyStoragesType[],
	path: string,
	isMove: boolean | undefined,
	callback: (action: OPERATE_ACTION, data: any) => Promise<void>
): Promise<TaskActionType[]> => {
	const dest = path;
	const notifyId = await uuid();
	const notifyMsg = getNotifyMsg(items);
	let tasks: TaskActionType[] = [];
	notifyWaitingShow(notifyMsg, notifyId);

	if (isMove) {
		await move(items)
			.then((res) => {
				tasks = res.filter((e) => e != undefined);
				callback(OPERATE_ACTION.MOVE, dest);
				notifyHide(notifyId);
			})
			.catch(() => {
				notifyHide(notifyId);
			});
	} else {
		await copy(items)
			.then((res) => {
				tasks = res.filter((e) => e != undefined);
				callback(OPERATE_ACTION.PASTE, dest);
				notifyHide(notifyId);
			})
			.catch(() => {
				notifyHide(notifyId);
			});
	}

	return tasks;
};

export async function rename(from: string, to: string) {
	const url = `${from}?action=rename&destination=${to}&override=${false}&rename=${false}`;
	const res = await CommonFetch.patch(url);
	return res;
}

export async function rename2(path: string, destination: string) {
	const res = await CommonFetch.patch(`${path}?destination=${destination}`);
	return res;
}

export async function renameFileItem(item: FileItem, newName: string) {
	const url = appendPath(
		commonUrlPrefix('resources'),
		item.fileType || '',
		item.fileExtend,
		encodeUrl(item.oPath || ''),
		item.isDir ? '/' : ''
	);

	const params = {
		destination: encodeURIComponent(newName),
		driveId: item.driveType == DriveType.GoogleDrive ? item.id : undefined
	};

	return CommonFetch.patch(url, undefined, {
		params
	});
}

export async function batchDelete(path: string, dirents: string[]) {
	return await CommonFetch.delete(
		appendPath(commonUrlPrefix('resources'), path, '/'),
		{
			data: {
				dirents
			}
		}
	);
}

export async function postCreateFile(path: string, isDir: boolean, body: any) {
	return await CommonFetch.post(
		appendPath(commonUrlPrefix('resources'), path, isDir ? '/' : ''),
		body
	);
}

export async function batchDeleteFileItems(items: FileItem[]) {
	if (items.length == 0) {
		return;
	}

	const groups: FileItem[][] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const index = groups.findIndex(
			(e) => e.length > 0 && e[0].oParentPath == item.oParentPath
		);
		if (index >= 0) {
			groups[index].push(item);
		} else {
			groups.push([item]);
		}
	}

	for (let index = 0; index < groups.length; index++) {
		const items = groups[index];
		const path = appendPath(
			'/',
			items[0].fileType || '',
			items[0].fileExtend,
			encodeUrl(items[0].oParentPath || '/')
		);

		const dirents = items.map((e) => {
			return appendPath('/', e.name, e.isDir ? '/' : '');
		});

		try {
			await batchDelete(path, dirents);
		} catch (error) {
			/* empty */
		}
	}
}

export function formatAppDataNode(
	url: string,
	data: FileNode[],
	driveType: DriveType,
	parentPath: string
) {
	const nodeDir = {
		path: url,
		name: '',
		size: 0,
		extension: '',
		modified: 0,
		mode: 0,
		isDir: true,
		isSymlink: false,
		type: '',
		numDirs: 0,
		numFiles: 0,
		sorting: {
			by: 'modified',
			asc: true
		},
		fileSize: 0,
		numTotalFiles: 0,
		items: <FileItem[]>[],
		driveType,
		fileExtend: '',
		filePath: '',
		fileType: ''
	};

	if (data.length > 0) {
		nodeDir.numDirs = data.length;
		data.forEach((el, index) => {
			const path = appendPath(parentPath, el.name, '/');
			const item: FileItem = {
				path: path,
				name: el.name,
				size: 4096,
				extension: '',
				modified: 0,
				mode: 0,
				isDir: true,
				isSymlink: false,
				type: '',
				sorting: {
					by: 'size',
					asc: false
				},
				driveType,
				param: '',
				url: '',
				index: index,
				fileExtend: el.name,
				isNode: true
			};
			nodeDir.items.push(item);
		});
	}

	return nodeDir;
}

export async function fetchNodeList(): Promise<FileNode[]> {
	try {
		const res: any = await CommonFetch.get(commonUrlPrefix('nodes'), {});
		const filesStore = useFilesStore();
		filesStore.nodes = res.data.nodes;
		return res.data.nodes;
	} catch (error) {
		return [];
	}
}

export async function fetchUserList(): Promise<ShareUserList | undefined> {
	try {
		const res: any = await CommonFetch.get(commonUrlPrefix('users'), {});
		const filesStore = useFilesStore();
		filesStore.users = res.data;
		if (!filesStore.shareFilter.ownerInit) {
			filesStore.shareFilter.ownerInit = true;
			filesStore.shareFilter.owner =
				filesStore.users?.users.map((e) => e.name) || [];
		}
		return res.data;
	} catch (error) {
		return;
	}
}

export function getStreamListUrl(item: FileItem) {
	const store = useDataStore();
	const baseURL = store.baseURL();
	const url = appendPath(
		baseURL,
		commonUrlPrefix('tree'),
		item.fileType || '',
		item.fileExtend,
		encodeUrl(item.oPath || ''),
		item.isDir ? '/' : ''
	);
	return url;
}

export function getDownloadUrl(item: FileItem, params = {}) {
	const store = useDataStore();
	const baseURL = store.baseURL();

	if (item.isDir && process.env.APPLICATION === 'LAREPASS') {
		return getStreamListUrl(item);
	}

	const path = appendPath(
		baseURL,
		commonUrlPrefix('raw'),
		item.fileType || '',
		item.fileExtend,
		encodeUrl(item.oPath || ''),
		item.isDir ? `?algo=zip` : ''
	);

	const url = new URL(path, origin);

	const searchParams = {
		...params
	};

	for (const key in searchParams) {
		url.searchParams.set(key, searchParams[key]);
	}

	return url.toString();
}

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/data/utils.ts`
```
import { CommonFetch } from '../../fetch';
import { useDataStore } from 'src/stores/data';
import { encodeUrl } from 'src/utils/encode';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';
import { appendPath } from '../path';

export function formatResourcesUrl(url: string) {
	const newUrl = dataRemovePrefix(url);
	return dataCommonUrl('resources', newUrl);
}

export async function createDir(url) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function remove(url) {
	await CommonFetch.delete(formatResourcesUrl(url));
}

export async function put(url, content = '') {
	return CommonFetch.put(formatResourcesUrl(url), content, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}

export function dataRemovePrefix(url: string) {
	if (!url.startsWith('/Data') && !url.startsWith('/drive/Data')) {
		return url;
	}
	if (url.startsWith('/Data')) return url.slice(5);
	return url.slice(11);
}

export const dataCommonUrl = (type: CommonUrlApiType, path: string) => {
	return (
		commonUrlPrefix(type) +
		'drive/Data' +
		(path.startsWith('/') ? path : '/' + path)
	);
};

export const formatPathtoUrl = (path: string) => {
	path = dataRemovePrefix(path);
	return appendPath('/drive/Data', path);
};

export const displayPath = (file: {
	isDir: boolean;
	fileExtend?: string;
	path: string;
	fileType?: string;
}) => {
	return appendPath(
		'/',
		file.fileExtend || '',
		encodeUrl(file.path),
		file.isDir ? '/' : ''
	);
};

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/drive/utils.ts`
```
import { CommonFetch } from '../../fetch';
import { encodeUrl } from 'src/utils/encode';
import {
	CommonUrlApiType,
	commonUrlPrefix
	// rename2
} from '../common/utils';
import { appendPath } from '../path';

export function formatResourcesUrl(url: string) {
	const newUrl = driveRemovePrefix(url);
	return driveCommonUrl('resources', newUrl);
}

export async function createDir(url: string) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function remove(url: string) {
	await CommonFetch.delete(formatResourcesUrl(url));
}

export async function saveFile(url: string, content = '') {
	CommonFetch.put(formatResourcesUrl(url), content, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}

export async function getContentUrlByPath(filePath) {
	if (!filePath) {
		return;
	}
	return '';
}

export function driveRemovePrefix(url: string) {
	if (url.startsWith('/Files')) {
		url = url.slice(6);
	}
	url = driveRemoveHomePrefix(url);
	return url;
}

export function driveRemoveHomePrefix(url: string) {
	if (!url || (!url.startsWith('/Home') && !url.startsWith('/drive/Home'))) {
		return url;
	}
	if (url.startsWith('/Home')) return url.slice(5);
	return url.slice(11);
}

export const driveCommonUrl = (type: CommonUrlApiType, path: string) => {
	return (
		commonUrlPrefix(type) +
		'drive/Home' +
		(path.startsWith('/') ? path : '/' + path)
	);
};

export const formatPathtoUrl = (path: string) => {
	path = driveRemovePrefix(path);
	return appendPath('/drive/Home', path);
};

export const displayPath = (file: {
	isDir: boolean;
	fileExtend?: string;
	path: string;
	fileType?: string;
}) => {
	return appendPath(
		'/Files',
		file.fileExtend || '',
		encodeUrl(file.path),
		file.isDir ? '/' : ''
	);
};

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/dropbox/utils.ts`
```
import { useDataStore } from 'src/stores/data';
import { DriveType } from 'src/utils/interface/files';
import { appendPath } from '../path';
import { CommonFetch } from '../../fetch';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';

export function formatResourcesUrl(url: string) {
	const newUrl = dropboxRemovePrefix(url);
	return dropboxCommonUrl('resources', newUrl);
}

export async function createDir(url) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function remove(url: string) {
	return CommonFetch.delete(formatResourcesUrl(url));
}

export function download(_format, files) {
	const name = files.path.split('/')[3];
	const path = '/' + files.path.split('/').slice(4).join('/');
	return generateDownloadUrl(files.driveType, path, name);
}
export function generateDownloadUrl(
	driveType: DriveType,
	path: string,
	name: string
) {
	const store = useDataStore();
	const baseURL = store.baseURL();
	return `${baseURL}/drive/download_sync_stream?drive=${driveType}&cloud_file_path=${path}&name=${name}`;
}

export function dropboxRemovePrefix(url: string) {
	url = dropboxRemoveHomePrefix(url);
	return url;
}

export function dropboxRemoveHomePrefix(url: string) {
	if (!url.startsWith('/Drive/dropbox')) {
		return url;
	}
	return url.slice(14);
}

export const dropboxCommonUrl = (type: CommonUrlApiType, path: string) => {
	return (
		commonUrlPrefix(type) +
		'dropbox' +
		(path.startsWith('/') ? path : '/' + path)
	);
};

export const formatPathtoUrl = (path: string) => {
	path = dropboxRemovePrefix(path);
	return appendPath('/dropbox', path);
};

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/external/utils.ts`
```
import { CommonFetch } from '../../fetch';
import { removePrefix } from '../utils';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';
import { useDataStore } from 'src/stores/data';
import { appendPath } from '../path';
import { encodeUrl } from 'src/utils/encode';

export function formatResourcesUrl(url: string) {
	const newUrl = externalRemovePrefix(url);
	return externalCommonUrl('resources', newUrl);
}

export async function remove(url) {
	await CommonFetch.delete(formatResourcesUrl(url));
}

export async function createDir(url) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function put(url, content = '') {
	CommonFetch.put(formatResourcesUrl(url), content, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}

export function getDownloadUrl(format, ...files) {
	const store = useDataStore();
	const baseURL = store.baseURL();

	if (files.length <= 0) {
		return '';
	} else if (files.length == 1) {
		return appendPath(
			baseURL,
			externalCommonUrl('raw', externalRemovePrefix(files[0]))
		);
	}

	let url = baseURL + externalCommonUrl('raw', '/');

	let arg = '';
	for (const file of files) {
		arg += encodeUrl(externalRemovePrefix(file)) + ',';
	}
	arg = arg.substring(0, arg.length - 1);
	arg = encodeURIComponent(arg);
	url += `/?files=${arg}&`;

	if (format) {
		url += `algo=${format}&`;
	}
	if (store.jwt) {
		url += `auth=${store.jwt}&`;
	}
	return url;
}

export function externalRemovePrefix(url: string) {
	url = removePrefix(url);
	url = externalRemoveHomePrefix(url);
	return url;
}

export function externalRemoveHomePrefix(url: string) {
	if (!url.startsWith('/External')) {
		return url;
	}
	return url.slice(9);
}

export const externalCommonUrl = (type: CommonUrlApiType, path: string) => {
	return (
		commonUrlPrefix(type) +
		'external' +
		(path.startsWith('/') ? path : '/' + path)
	);
};

export const formatPathtoUrl = (path: string) => {
	path = externalRemovePrefix(path);
	return appendPath('/external', path);
};

export const displayPath = (file: {
	isDir: boolean;
	fileExtend?: string;
	path: string;
	fileType?: string;
}) => {
	return appendPath(
		'/Files/External',
		file.fileExtend || '',
		encodeUrl(file.path),
		file.isDir ? '/' : ''
	);
};

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/google/utils.ts`
```
import { useFilesStore } from 'src/stores/files';
import { useIntegrationStore } from 'src/stores/integration';
import { CommonFetch } from '../../fetch';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';
import { appendPath } from '../path';
import { getApplication } from 'src/application/base';
import { compareOlaresVersion } from '@bytetrade/core';
import { useUserStore } from 'src/stores/user';

export function formatResourcesUrl(url: string) {
	const newUrl = googleRemovePrefix(url);
	return googleCommonUrl('resources', newUrl);
}

const supportApiNewVersion = '1.12.1-0';

export async function fetchRepo(): Promise<any[]> {
	const data = await getCloudAccounts();

	const integrationStore = useIntegrationStore();
	const supports = integrationStore.clientFilesCloudSupportList();
	if (!data) {
		return [];
	}
	const repos: any[] = data.filter((el) => {
		return el.available && el.type != 'space' && supports.includes(el.type);
	});
	return repos;
}

const getCloudAccounts = async () => {
	if (getApplication().platform) {
		const userStore = useUserStore();
		if (
			userStore.current_user?.os_version &&
			compareOlaresVersion(
				userStore.current_user?.os_version,
				supportApiNewVersion
			).compare < 0
		) {
			return (await CommonFetch.post('/drive/accounts', {})).data.data || [];
		}
	}
	return (await CommonFetch.get('/api/accounts', {})).data || [];
};

export async function createDir(url) {
	await CommonFetch.post(formatResourcesUrl(url));
}

export async function remove(url) {
	return CommonFetch.delete(formatResourcesUrl(url));
}

export function saveGoogleDirInfo(items, origin_id) {
	const filesStore = useFilesStore();
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.isDir) {
			filesStore.googleDirMap[origin_id][item.id] = item.name;
		}
	}
}

export function extensionByMimeType(type: string) {
	const mimeTypes = {
		'application/msword': 'doc',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
			'docx',
		'application/vnd.oasis.opendocument.text': 'odt',
		'application/vnd.apple.pages': 'pages',
		'application/pdf': 'pdf',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation':
			'pptx',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
		'application/rtf': 'rtf',
		'text/xml': 'xml',
		'text/html': 'html',
		'image/jpeg': 'jpeg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/bmp': 'bmp',
		'image/svg+xml': 'svg',
		'image/webp': 'webp',
		'image/tiff': 'tiff',
		'text/plain': 'txt',
		'text/css': 'css',
		'application/javascript': 'js',
		'application/json': 'json',
		'application/zip': 'zip',
		'application/x-rar-compressed': 'rar',
		'application/x-7z-compressed': '7z',
		'application/x-tar': 'tar',
		'application/gzip': 'gz',
		'application/x-bzip2': 'bz2',
		'audio/mpeg': 'mp3',
		'audio/wav': 'wav',
		'audio/aac': 'aac',
		'video/mp4': 'mp4',
		'video/x-msvideo': 'avi',
		'video/quicktime': 'mov',
		'video/webm': 'webm',
		'application/vnd.google-apps.folder': 'folder'
	};

	return mimeTypes[type] || 'unknown';
}

export function googleRemovePrefix(url: string) {
	url = googleRemoveHomePrefix(url);
	return url;
}

export function googleRemoveHomePrefix(url: string) {
	if (!url.startsWith('/Drive/google')) {
		return url;
	}
	return url.slice(13);
}

export const googleCommonUrl = (type: CommonUrlApiType, path: string) => {
	return (
		commonUrlPrefix(type) +
		'google' +
		(path.startsWith('/') ? path : '/' + path)
	);
};

export const formatPathtoUrl = (path: string) => {
	path = googleRemovePrefix(path);
	return appendPath('/google', path);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2446** (2026-04-02): **[Bug] Files: Sorting order gets lost**
  *Symptoms*: ## Please Provide the basic information of the app Files  ## Describe the bug Sorting order in Files app can be modified. But if you change the directory and go back, the sorting order is lost. The system seem to believe it's still there, because if you hut the arrow to change the order nothing happens at first. Only if you click twice the desired order is back.  **To Reproduce**  - OS Version: 1.12.2 and 1.12.4  - Browser Safari  - Steps to reproduce the behavior: please see this clip  <!-- Uploading "Sorting in Files.mov"... —>  **Expected behavior** I expect that the order of the folder and files stay the same.  **Screenshots** video attached.  **Additional context** Tried a restart of the server, didn't help. This is a minor issue, not critical. 

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

### Incident Patch 1: `78aa03a6` (2026-11-26)
**Commit Message**: fix(app-service): unblock fixed-MAC Overlay Pod recovery (#4523)

fix(app-service): recover failed fixed-MAC pods after restart

Reclaim failed singleton Pods only for applications with Overlay Gateway enabled. Let replacement Pods reuse the fixed MAC after the old Pod is removed, and preserve the original cleanup policy for non-Overlay workloads, including those using Multus.

**File**: `framework/app-service/controllers/terminated_overlay_pod_gc_envtest_test.go` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+package controllers
+
+import (
+	"encoding/json"
+	"strings"
+	"time"
+
+	"github.com/beclab/Olares/framework/app-service/pkg/constants"
+	"github.com/beclab/Olares/framework/app-service/pkg/utils/maclease"
+	"github.com/beclab/Olares/framework/app-service/pkg/webhook"
+	appv1 "github.com/beclab/api/api/app.bytetrade.io/v1alpha1"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	admissionv1 "k8s.io/api/admission/v1"
+	appsv1 "k8s.io/api/apps/v1"
+	corev1 "k8s.io/api/core/v1"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/client-go/kubernetes"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
+)
+
+var _ = Describe("Overlay terminal Pod recovery", func() {
+	It("reclaims the Jellyfin migration failure and hands off its fixed MAC after deletion", func() {
+		now := time.Now()
+		d, _ := terminatedPodGCFixture(now, terminatedPodGCTestCase{replicas: 1})
+		d.Name, d.Namespace, d.UID = "jellyfin", "default", ""
+		labels := map[string]string{constants.ApplicationNameLabel: d.Name, constants.ApplicationOwnerLabel: "alice", constants.ApplicationMacvlanInitLabel: "true"}
+		d.Spec.Selector = &metav1.LabelSelector{MatchLabels: labels}
+		d.Spec.Strategy.Type = appsv1.RecreateDeploymentStrategyType
+		fixtureContainers := func(names ...string) []corev1.Container {
+			containers := make([]corev1.Container, 0, len(names))
+			for _, name := range names {
+				containers = append(containers, corev1.Container{Name: name, Image: "example.invalid/app:test"})
+			}
+			return containers
+		}
+		d.Spec.Template = corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}, Spec: corev1.PodSpec{
+			InitContainers: fixtureContainers("init-chmod-data", "migrate-encoding", "linkerd-init", constants.MacvlanReplyInitContainerName, "olares-mesh-in-agent-iptables", "macvlan-bypass-iptables"),
+			Containers:     fixtureContainers("linkerd-proxy", "jellyfin", "olares-mesh-in-agent"),
+		}}
+		create := func(obj client.Object) {
+			Expect(k8sClient.Create(suiteCtx, obj)).To(Succeed())
+			DeferCleanup(func() {
+				// The API-only environment has no kubelet to finish Pod shutdown.
+				err := k8sClient.Delete(suiteCtx, obj, client.GracePeriodSeconds(0))
+				Expect(err == nil || apierrors.IsNotFound(err)).To(BeTrue())
+				Eventually(func() bool {
+					return apierrors.IsNotFound(k8sClient.Get(suiteCtx, client.ObjectKeyFromObject(obj), obj))
+				}, 5*time.Second, 50*time.Millisecond).Should(BeTrue(), "cleanup of %T %s", obj, client.ObjectKeyFromObject(obj))
+			})
+		}
+		create(d)
+		node := &corev1.Node{ObjectMeta: metav1.ObjectMeta{
+			Name: "overlay-gc-node", Labels: map[string]string{"node-role.kubernetes.io/control-plane": ""},
+		}}
+		create(node)
+		node.Status.Conditions = []corev1.NodeCondition{{Type: corev1.NodeReady, Status: corev1.ConditionTrue}}
+		Expect(k8sClient.Status().Update(suiteCtx, node)).To(Succeed())
+		app := &appv1.Application{ObjectMeta: metav1.ObjectMeta{Name: d.Namespace + "-" + d.Name}, Spec: appv1.ApplicationSpec{
+			Appid: "overlay-gc", Name: d.Name, Owner: "alice", Namespace: d.Namespace, DeploymentName: d.Name,
+			Settings: map[string]string{"enableOverlayGateway": "true"},
+		}}
+		create(app)
+		DeferCleanup(func() {
+			var current appv1.Application
+			Expect(k8sClient.Get(suiteCtx, client.ObjectKeyFromObject(app), &current)).To(Succeed())
+			if controllerutil.RemoveFinalizer(&current, "app.bytetrade.io/overlay-mac-claim") {
+				Expect(k8sClient.Update(suiteCtx, &current)).To(Succeed())
+			}
+		})
+		rs := &appsv1.ReplicaSet{ObjectMeta: metav1.ObjectMeta{
+			Name: d.Name + "-rs", Namespace: d.Namespace,
+			OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(d, appsv1.SchemeGroupVersion.WithKind(deployment))},
+		}, Spec: appsv1.ReplicaSetSpec{Selector: d.Spec.Selector.DeepCopy(), Template: *d.Spec.Template.DeepCopy()}}
+		create(rs)
+		leaseNamespace := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: maclease.Namespace}}
+		if err := k8sClient.Create(suiteCtx, leaseNamespace); err != nil {
+			// An existing namespace can be shared with other specs.
+			Expect(apierrors.IsAlreadyExists(err)).To(BeTrue())
+		}
+		admission, err := webhook.New(cfg)
+		Expect(err).NotTo(HaveOccurred())
+		kube, err := kubernetes.NewForConfig(cfg)
+		Expect(err).NotTo(HaveOccurred())
+		admit := func(pod *corev1.Pod) error {
+			raw, err := json.Marshal(pod)
+			if err != nil {
+				return err
+			}
+			if _, err = admission.CreateMacvlanInitPatchWithContext(suiteCtx, &admissionv1.AdmissionRequest{
+				Object: runtime.RawExtension{Raw: raw},
+			}, pod); err != nil {
+				return err
+			}
+			return admission.ValidateMacvlanAnnotation(suiteCtx, pod, pod.Namespace, false)
+		}
+		pod := &corev1.P
```

**File**: `framework/app-service/controllers/terminated_overlay_pod_gc_race_test.go` (added, +352/-0)
```diff
@@ -0,0 +1,352 @@
+package controllers
+
+import (
+	"context"
+	"errors"
+	"testing"
+	"time"
+
+	"github.com/beclab/Olares/framework/app-service/pkg/constants"
+	"github.com/beclab/Olares/framework/app-service/pkg/testutil"
+	appv1 "github.com/beclab/api/api/app.bytetrade.io/v1alpha1"
+	"github.com/stretchr/testify/require"
+	appsv1 "k8s.io/api/apps/v1"
+	corev1 "k8s.io/api/core/v1"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/utils/ptr"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
+)
+
+type overlayRecoveryFixture struct {
+	deploy  *appsv1.Deployment
+	rs      *appsv1.ReplicaSet
+	pod     *corev1.Pod
+	app     *appv1.Application
+	node    *corev1.Node
+	objects []client.Object
+}
+
+func newOverlayRecoveryFixture(now time.Time) *overlayRecoveryFixture {
+	deploy, objects := terminatedPodGCFixture(now, terminatedPodGCTestCase{
+		phase: corev1.PodFailed, replicas: 1, targetTerminalAge: time.Hour, noReplacement: true,
+	})
+	f := &overlayRecoveryFixture{deploy: deploy}
+	deploy.Spec.Strategy.Type = appsv1.RecreateDeploymentStrategyType
+	deploy.Spec.Template.Labels = map[string]string{constants.ApplicationNameLabel: "test-app", constants.ApplicationOwnerLabel: "alice"}
+	for _, obj := range objects {
+		switch obj := obj.(type) {
+		case *appsv1.ReplicaSet:
+			if obj.Name == "test-app-old" {
+				f.rs = obj
+			}
+		case *corev1.Pod:
+			f.pod = obj
+		}
+	}
+	f.pod.Labels[constants.ApplicationMacvlanInitLabel] = "true"
+	f.pod.Spec.NodeName = "node"
+	f.pod.Spec.Containers = []corev1.Container{{Name: "app"}}
+	f.pod.Status.Reason = "UnexpectedAdmissionError"
+	f.pod.Status.Conditions = append(f.pod.Status.Conditions, corev1.PodCondition{
+		Type: corev1.PodReadyToStartContainers, Status: corev1.ConditionFalse, LastTransitionTime: metav1.NewTime(now.Add(-time.Hour)),
+	})
+	f.app = &appv1.Application{
+		ObjectMeta: metav1.ObjectMeta{Name: deploy.Namespace + "-test-app", UID: "app-uid"},
+		Spec: appv1.ApplicationSpec{Namespace: deploy.Namespace, Name: "test-app", Owner: "alice", DeploymentName: deploy.Name,
+			Settings: map[string]string{"enableOverlayGateway": "true"}},
+	}
+	f.node = &corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node"}, Status: corev1.NodeStatus{
+		Conditions: []corev1.NodeCondition{{Type: corev1.NodeReady, Status: corev1.ConditionTrue}},
+	}}
+	f.objects = append(objects, f.app, f.node)
+	return f
+}
+
+func TestOverlayRecoveryRejectsStaleCache(t *testing.T) {
+	for _, scenario := range []string{"pod updated", "pod recreated", "node NotReady", "deployment recreated", "deployment scaled", "ReplicaSet recreated", "application owner changed"} {
+		t.Run(scenario, func(t *testing.T) {
+			now := time.Now()
+			f := newOverlayRecoveryFixture(now)
+			d, pod, objects := f.deploy, f.pod, f.objects
+			cached, live := testutil.NewFakeClient(objects...), testutil.NewFakeClient(objects...)
+			switch scenario {
+			case "pod updated", "pod recreated":
+				var current corev1.Pod
+				require.NoError(t, live.Get(t.Context(), client.ObjectKeyFromObject(pod), &current))
+				if scenario == "pod recreated" {
+					current.UID = "new-pod-uid"
+				} else {
+					current.Labels["changed"] = "true"
+				}
+				require.NoError(t, live.Update(t.Context(), &current))
+			case "node NotReady":
+				var node corev1.Node
+				require.NoError(t, live.Get(t.Context(), client.ObjectKey{Name: "node"}, &node))
+				node.Status.Conditions[0].Status = corev1.ConditionFalse
+				require.NoError(t, live.Status().Update(t.Context(), &node))
+			case "deployment recreated", "deployment scaled":
+				var current appsv1.Deployment
+				require.NoError(t, live.Get(t.Context(), client.ObjectKeyFromObject(d), &current))
+				if scenario == "deployment recreated" {
+					current.UID = "new-deployment-uid"
+				} else {
+					current.Spec.Replicas = ptr.To(int32(2))
+				}
+				require.NoError(t, live.Update(t.Context(), &current))
+			case "ReplicaSet recreated":
+				var rs appsv1.ReplicaSet
+				require.NoError(t, live.Get(t.Context(), client.ObjectKey{Namespace: d.Namespace, Name: "test-app-old"}, &rs))
+				rs.UID = "new-rs-uid"
+				require.NoError(t, live.Update(t.Context(), &rs))
+			case "application owner changed":
+				var app appv1.Application
+				require.NoError(t, live.Get(t.Context(), client.ObjectKey{Name: d.Namespace + "-test-app"}, &app))
+				app.Spec.Owner = "bob"
+				require.NoError(t, live.Update(t.Context(), &app))
+			}
+			deletes := 0
+			c := interceptor.NewClient(cached.(client.WithWatch), interceptor.Funcs{Delete: func(context.Context, client.WithWatch, client.Object, ...client.DeleteOption) error {
+				deletes++
+				return nil
+			}})
+			r := &TerminatedPodGCController{Client: c, APIReader: live, minPodAge: time.Minute}
+			result, err := r.Reconcile(t.Context(), ctrl.Request{NamespacedName: client.ObjectKeyFromObject(d)})
+	
```

**File**: `framework/app-service/controllers/terminated_overlay_pod_gc_test.go` (added, +216/-0)
```diff
@@ -0,0 +1,216 @@
+package controllers
+
+import (
+	"context"
+	"errors"
+	"testing"
+	"time"
+
+	"github.com/beclab/Olares/framework/app-service/pkg/constants"
+	"github.com/beclab/Olares/framework/app-service/pkg/testutil"
+	appv1 "github.com/beclab/api/api/app.bytetrade.io/v1alpha1"
+	"github.com/stretchr/testify/require"
+	appsv1 "k8s.io/api/apps/v1"
+	corev1 "k8s.io/api/core/v1"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/utils/ptr"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
+)
+
+func TestTerminatedOverlayPodRecovery(t *testing.T) {
+	now := time.Date(2026, time.November, 25, 9, 10, 0, 0, time.UTC)
+	tests := []struct {
+		name        string
+		change      func(*overlayRecoveryFixture)
+		wantDelete  bool
+		wantRequeue bool
+	}{
+		{name: "reclaims GPU admission failure without a replacement", wantDelete: true, wantRequeue: true},
+		{name: "keeps succeeded singleton until replacement is ready", change: func(f *overlayRecoveryFixture) { f.pod.Status.Phase = corev1.PodSucceeded }, wantRequeue: true},
+		{name: "keeps unrelated failure until replacement is ready", change: func(f *overlayRecoveryFixture) { f.pod.Status.Reason = "OtherFailure" }, wantRequeue: true},
+		{name: "keeps first admission rejection without runtime observations", change: func(f *overlayRecoveryFixture) {
+			f.pod.Status = corev1.PodStatus{Phase: corev1.PodFailed, Reason: "UnexpectedAdmissionError"}
+		}, wantRequeue: true},
+		{name: "waits for minimum terminal age", change: func(f *overlayRecoveryFixture) {
+			f.pod.Status.ContainerStatuses[0].State.Terminated.FinishedAt = metav1.NewTime(now.Add(-30 * time.Second))
+		}, wantRequeue: true},
+		{name: "waits for sandbox teardown", change: func(f *overlayRecoveryFixture) { f.pod.Status.Conditions[1].Status = corev1.ConditionTrue }, wantRequeue: true},
+		{name: "waits for missing sandbox evidence", change: func(f *overlayRecoveryFixture) { f.pod.Status.Conditions = nil }, wantRequeue: true},
+		{name: "waits for unknown sandbox", change: func(f *overlayRecoveryFixture) { f.pod.Status.Conditions[1].Status = corev1.ConditionUnknown }, wantRequeue: true},
+		{name: "waits for sandbox timestamp", change: func(f *overlayRecoveryFixture) { f.pod.Status.Conditions[1].LastTransitionTime = metav1.Time{} }, wantRequeue: true},
+		{name: "waits after recent sandbox teardown", change: func(f *overlayRecoveryFixture) {
+			f.pod.Status.Conditions[1].LastTransitionTime = metav1.NewTime(now.Add(-30 * time.Second))
+		}, wantRequeue: true},
+		{name: "keeps Unknown pod", change: func(f *overlayRecoveryFixture) { f.pod.Status.Phase = corev1.PodUnknown }},
+		{name: "keeps Running pod", change: func(f *overlayRecoveryFixture) { f.pod.Status.Phase = corev1.PodRunning }},
+		{name: "keeps Pending pod", change: func(f *overlayRecoveryFixture) { f.pod.Status.Phase = corev1.PodPending }},
+		{name: "waits for container termination", change: func(f *overlayRecoveryFixture) {
+			f.pod.Status.ContainerStatuses[0].State = corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}
+		}, wantRequeue: true},
+		{name: "keeps missing runtime status", change: func(f *overlayRecoveryFixture) { f.pod.Status.ContainerStatuses = nil }, wantRequeue: true},
+		{name: "waits for init termination", change: func(f *overlayRecoveryFixture) {
+			f.pod.Spec.InitContainers = []corev1.Container{{Name: "init"}}
+			f.pod.Status.InitContainerStatuses = []corev1.ContainerStatus{{Name: "init", State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{}}}}
+		}, wantRequeue: true},
+		{name: "keeps pod with missing init status", change: func(f *overlayRecoveryFixture) {
+			f.pod.Spec.InitContainers = []corev1.Container{{Name: "init"}}
+		}, wantRequeue: true},
+		{name: "waits for native sidecar termination", change: func(f *overlayRecoveryFixture) {
+			f.pod.Spec.InitContainers = []corev1.Container{{Name: "sidecar", RestartPolicy: ptr.To(corev1.ContainerRestartPolicyAlways)}}
+			f.pod.Status.InitContainerStatuses = []corev1.ContainerStatus{{Name: "sidecar", State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}}}
+		}, wantRequeue: true},
+		{name: "waits for ephemeral container termination", change: func(f *overlayRecoveryFixture) {
+			f.pod.Spec.EphemeralContainers = []corev1.EphemeralContainer{{EphemeralContainerCommon: corev1.EphemeralContainerCommon{Name: "debug"}}}
+			f.pod.Status.EphemeralContainerStatuses = []corev1.ContainerStatus{{Name: "debug", State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}}}
+		}, wantRequeue: true},
+		{name: "reclaims after init sidecar and ephemeral containers terminate", change: func(f *overlayRecoveryFixture) {
+			f.pod.Spec.InitContainers = []corev1.Container{{Name: "sidecar", RestartPolicy: ptr.To(corev1.ContainerRestartPolicyAlways)}
```

**File**: `framework/app-service/controllers/terminated_pod_gc_controller.go` (modified, +284/-9)
```diff
@@ -2,33 +2,49 @@ package controllers
 
 import (
 	"context"
+	"encoding/json"
+	"slices"
 	"time"
 
+	"github.com/beclab/Olares/framework/app-service/pkg/constants"
+	apputils "github.com/beclab/Olares/framework/app-service/pkg/utils/app"
+	appv1alpha1 "github.com/beclab/api/api/app.bytetrade.io/v1alpha1"
 	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	apierrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/klog/v2"
 	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/builder"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/controller"
 	"sigs.k8s.io/controller-runtime/pkg/handler"
+	"sigs.k8s.io/controller-runtime/pkg/predicate"
 	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 )
 
 const (
 	envTerminatedPodGCMinAge     = "TERMINATED_POD_GC_MIN_AGE"
 	envTerminatedPodGCReadyDelay = "TERMINATED_POD_GC_READY_DELAY"
+	overlayTerminalPodRequeue    = 30 * time.Second
 )
 
 //+kubebuilder:rbac:groups="",resources=pods,verbs=get;list;watch;delete
 //+kubebuilder:rbac:groups=apps,resources=deployments;replicasets,verbs=get;list;watch
+//+kubebuilder:rbac:groups="",resources=nodes,verbs=get;list;watch
+//+kubebuilder:rbac:groups=app.bytetrade.io,resources=applications,verbs=get;list;watch
 
 // TerminatedPodGCController removes terminal Pods of any Deployment in the
 // cluster once that Deployment has as many stably ready replicas as it wants. A
 // Deployment scaled to zero satisfies that trivially, so leftovers of a stopped
 // workload are collected too.
+// Platform-managed overlay singletons are an exception: their fixed MAC blocks
+// replacement admission until the old Pod disappears. On a Ready node, collect
+// Pods rejected during recovery without waiting for a replacement, provided
+// kubelet reports all containers terminated and the sandbox unready. Sandbox
+// unready is not a CNI DEL receipt; teardown ordering remains a hardware test.
+// Admission keeps the MAC reserved until the old Pod disappears.
 //
 // Unknown Pods are deliberately excluded. Their workload might still be running
 // on an unreachable node, and there is nothing left for this controller to do
@@ -43,12 +59,14 @@ const (
 // never touched.
 type TerminatedPodGCController struct {
 	client.Client
+	APIReader  client.Reader
 	minPodAge  time.Duration
 	readyDelay time.Duration
 	now        func() time.Time
 }
 
 func (r *TerminatedPodGCController) SetupWithManager(mgr ctrl.Manager) error {
+	r.APIReader = mgr.GetAPIReader()
 	r.minPodAge = parseTimeWithDefault(envTerminatedPodGCMinAge, time.Minute)
 	r.readyDelay = parseTimeWithDefault(envTerminatedPodGCReadyDelay, time.Minute)
 	if r.now == nil {
@@ -68,6 +86,11 @@ func (r *TerminatedPodGCController) SetupWithManager(mgr ctrl.Manager) error {
 			&corev1.Pod{},
 			handler.EnqueueRequestsFromMapFunc(r.requestsForPod),
 		).
+		Watches(
+			&appv1alpha1.Application{},
+			handler.EnqueueRequestsFromMapFunc(r.requestsForOverlayApplication),
+			builder.WithPredicates(predicate.GenerationChangedPredicate{}),
+		).
 		WithOptions(controller.Options{MaxConcurrentReconciles: 1}).
 		Complete(r)
 }
@@ -105,6 +128,30 @@ func (r *TerminatedPodGCController) requestsForPod(ctx context.Context, obj clie
 	}}}
 }
 
+// An Application can become available or enable Overlay after its Pod enters
+// a terminal state. Reconcile its workloads without polling unverified Pods.
+func (r *TerminatedPodGCController) requestsForOverlayApplication(ctx context.Context, obj client.Object) []reconcile.Request {
+	app, ok := obj.(*appv1alpha1.Application)
+	if !ok || app.Spec.Namespace == "" || app.Spec.Name == "" || app.Spec.Owner == "" ||
+		app.Spec.Settings["enableOverlayGateway"] != "true" {
+		return nil
+	}
+
+	var deployments appsv1.DeploymentList
+	if err := r.List(ctx, &deployments, client.InNamespace(app.Spec.Namespace)); err != nil {
+		klog.Errorf("failed to list Deployments for overlay application %s: %v", app.Name, err)
+		return nil
+	}
+	var requests []reconcile.Request
+	for _, deploy := range deployments.Items {
+		labels := deploy.Spec.Template.Labels
+		if labels[constants.ApplicationNameLabel] == app.Spec.Name && labels[constants.ApplicationOwnerLabel] == app.Spec.Owner {
+			requests = append(requests, reconcile.Request{NamespacedName: client.ObjectKeyFromObject(&deploy)})
+		}
+	}
+	return requests
+}
+
 func (r *TerminatedPodGCController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
 	var deploy appsv1.Deployment
 	if err := r.Get(ctx, req.NamespacedName, &deploy); err != nil {
@@ -172,22 +219,74 @@ func (r *TerminatedPodGCController) Reconcile(ctx context.Context, req ctrl.Requ
 		}
 		nextCheck = shorterPositiveDuration(nextCheck, remaining)
 	}
-	if stablyReady < deploymentReplicas(&deploy) {
-		return ctrl.Result{RequeueAfter: nextCheck}, nil
+	fullyReady := stablyReady >= deploymentReplicas(&dep
```

**File**: `framework/app-service/pkg/constants/constants.go` (modified, +3/-0)
```diff
@@ -14,6 +14,9 @@ const (
 	ApplicationDefaultThirdLevelDomain = "applications.app.bytetrade.io/default-thirdlevel-domains"
 	ApplicationNameLabel               = "applications.app.bytetrade.io/name"
 	ApplicationMacvlanInitLabel        = "applications.app.bytetrade.io/macvlan-init"
+	MacvlanReplyInitContainerName      = "macvlan-reply-via-eth0"
+	OverlayMacvlanNetworkName          = "underlay-macvlan"
+	OverlayMacvlanNetworkNamespace     = "kube-system"
 	ApplicationRawAppNameLabel         = "applications.app.bytetrade.io/raw-app-name"
 	ApplicationAppGroupLabel           = "applications.app.bytetrade.io/group"
 	ApplicationAuthorLabel             = "applications.app.bytetrade.io/author"
```

**File**: `framework/app-service/pkg/webhook/macvlan_allocator.go` (modified, +3/-7)
```diff
@@ -487,11 +487,7 @@ func (wh *Webhook) ensureMasterPlacement(ctx context.Context, pod *corev1.Pod) e
 	return nil
 }
 
-const (
-	underlayMacvlanNetworkName = "underlay-macvlan"
-	underlayMacvlanNamespace   = "kube-system"
-	underlayMacvlanInterface   = "net1"
-)
+const underlayMacvlanInterface = "net1"
 
 // macvlanSelection is the one network selection a macvlan pod may carry. The
 // struct fixes the field order so the validating side can compare the rendered
@@ -508,8 +504,8 @@ type macvlanSelection struct {
 // only author of this annotation, which is what makes the value comparable.
 func platformMacvlanSelection(mac string) string {
 	raw, err := json.Marshal([]macvlanSelection{{
-		Name:      underlayMacvlanNetworkName,
-		Namespace: underlayMacvlanNamespace,
+		Name:      constants.OverlayMacvlanNetworkName,
+		Namespace: constants.OverlayMacvlanNetworkNamespace,
 		Interface: underlayMacvlanInterface,
 		Mac:       mac,
 	}})
```

**File**: `framework/app-service/pkg/webhook/macvlan_instance_test.go` (modified, +45/-0)
```diff
@@ -2,6 +2,8 @@ package webhook
 
 import (
 	"github.com/beclab/Olares/framework/app-service/pkg/constants"
+	"github.com/beclab/Olares/framework/app-service/pkg/utils/maclease"
+	"github.com/stretchr/testify/require"
 	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
@@ -11,6 +13,49 @@ import (
 	"testing"
 )
 
+func TestFixedMACTerminalPodBlocksUntilDeletionThenReusesMAC(t *testing.T) {
+	for _, phase := range []corev1.PodPhase{corev1.PodSucceeded, corev1.PodUnknown} {
+		t.Run(string(phase), func(t *testing.T) {
+			wh := testMacvlanWebhook()
+			old := macvlanPod()
+			old.UID = "old-pod-uid"
+			mac, err := wh.ensureOverlayMAC(t.Context(), old, false)
+			require.NoError(t, err)
+			app, err := wh.dynamicClient.AppV1alpha1().Applications().Get(t.Context(), "app-space-jellyfin", metav1.GetOptions{})
+			require.NoError(t, err)
+			require.NoError(t, maclease.Reserve(t.Context(), wh.kubeClient, old, app.Name, app.UID, mac))
+			old.Status.Phase = phase
+			_, err = wh.kubeClient.CoreV1().Pods(old.Namespace).Create(t.Context(), old, metav1.CreateOptions{})
+			require.NoError(t, err)
+			require.NoError(t, maclease.Reconcile(t.Context(), wh.kubeClient, app.UID))
+
+			replacement := macvlanPod()
+			replacement.Name = "replacement"
+			_, err = wh.ensureOverlayMAC(t.Context(), replacement, false)
+			require.ErrorContains(t, err, "still has pod")
+			require.ErrorContains(t, maclease.Reserve(t.Context(), wh.kubeClient, replacement, app.Name, app.UID, mac), "still occupied")
+
+			// Normal deletion may take time. Both admission guards must keep
+			// protecting the MAC while the old Pod is still terminating.
+			now := metav1.Now()
+			old.DeletionTimestamp = &now
+			_, err = wh.kubeClient.CoreV1().Pods(old.Namespace).Update(t.Context(), old, metav1.UpdateOptions{})
+			require.NoError(t, err)
+			_, err = wh.ensureOverlayMAC(t.Context(), replacement, false)
+			require.ErrorContains(t, err, "still has pod")
+			require.ErrorContains(t, maclease.Reserve(t.Context(), wh.kubeClient, replacement, app.Name, app.UID, mac), "still occupied")
+
+			require.NoError(t, wh.kubeClient.CoreV1().Pods(old.Namespace).Delete(t.Context(), old.Name, metav1.DeleteOptions{}))
+			reused, err := wh.ensureOverlayMAC(t.Context(), replacement, false)
+			require.NoError(t, err)
+			require.Equal(t, mac, reused)
+			require.NoError(t, maclease.Reserve(t.Context(), wh.kubeClient, replacement, app.Name, app.UID, reused))
+			require.NoError(t, maclease.Validate(t.Context(), wh.kubeClient, replacement, app.UID, reused))
+			require.Error(t, maclease.Validate(t.Context(), wh.kubeClient, old, app.UID, mac))
+		})
+	}
+}
+
 func testDeploymentOwner(name string) metav1.OwnerReference {
 	yes := true
 	return metav1.OwnerReference{APIVersion: "apps/v1", Kind: "ReplicaSet", Name: name + "-rs", UID: types.UID("rs-" + name), Controller: &yes}
```

**File**: `framework/app-service/pkg/webhook/webhook.go` (modified, +1/-1)
```diff
@@ -1002,7 +1002,7 @@ func (wh *Webhook) isSelected(podSelectors []metav1.LabelSelector, pod *corev1.P
 
 // MacvlanInitContainerName is the name of the init container injected for pods
 // that need to reply via eth0 in macvlan setups.
-const MacvlanInitContainerName = "macvlan-reply-via-eth0"
+const MacvlanInitContainerName = constants.MacvlanReplyInitContainerName
 
 // macvlanInitScript is the shell script run inside the macvlan-init container.
 // It waits for an IPv4 address on eth0, then creates a dedicated routing table
```

---

### Incident Patch 2: `3285d49c` (2026-11-25)
**Commit Message**: fix(cli): unblock NVIDIA Container Toolkit migration on DGX Spark (#4515)

fix(cli): migrate the NVIDIA container toolkit on Spark

Before the existing toolkit cleanup on GB10, mark nv-persistence-mode, nvidia-logrotate and nvidia-motd as manually installed and remove the nvidia-system-utils metapackage with dpkg.

**File**: `cli/pkg/gpu/tasks.go` (modified, +14/-0)
```diff
@@ -210,6 +210,20 @@ func (t *InstallNvidiaContainerToolkit) Execute(runtime connector.Runtime) error
 			return fmt.Errorf("unexpected NVIDIA Container Toolkit DEB metadata %q, expected %q", strings.TrimSpace(metadata), want)
 		}
 	}
+	if runtime.GetSystemInfo().IsGB10Chip() {
+		status, err := runtime.GetRunner().Cmd("dpkg-query -W -f='${db:Status-Status}' nvidia-system-utils 2>/dev/null || test $? -eq 1", false, false)
+		if err != nil {
+			return errors.Wrap(err, "failed to check nvidia-system-utils")
+		}
+		if status != "" && status != "not-installed" && status != "config-files" {
+			cmd := "apt-mark manual nv-persistence-mode nvidia-logrotate nvidia-motd && " +
+				"dpkg --remove nvidia-system-utils"
+			if _, err := runtime.GetRunner().SudoCmd(cmd, false, true); err != nil {
+				return errors.Wrap(err, "failed to remove nvidia-system-utils and retain its dependencies")
+			}
+		}
+	}
+
 	var remove []string
 	for _, name := range legacyNvidiaContainerToolkitPackages {
 		if state := states[name]; len(state) == 2 && state[1] != "not-installed" {
```

---

### Incident Patch 3: `18aa13cc` (2026-11-26)
**Commit Message**: fix(app-service): ignore stale pending-pod markers on resume (#4522)

Clear the legacy marker when accepting a resume. Use the pending stop request from the pod controller to interrupt scale-up and preserve its operation ID and scheduling reason when the Helm result is already queued.

Discard the superseded scale result on retry so a partially applied stop continues from the persisted operation state.

**File**: `framework/app-service/.olares/config/cluster/deploy/appservice_deploy.yaml` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@ spec:
       priorityClassName: "system-cluster-critical"
       containers:
       - name: app-service
-        image: beclab/app-service:0.7.2
+        image: beclab/app-service:0.7.3
         imagePullPolicy: IfNotPresent
         ports:
         - containerPort: 6755
```

**File**: `framework/app-service/controllers/pod_abnormal_suspend_app_controller.go` (modified, +0/-3)
```diff
@@ -332,9 +332,6 @@ func (r *PodAbnormalSuspendAppController) suspendResolved(ctx context.Context, a
 	if strings.HasSuffix(podNamespace, "-shared") {
 		patched.Annotations[api.AppStopAllKey] = "true"
 	}
-	if reason == constants.AppHamiSchedulable || reason == constants.AppUnschedulable {
-		patched.Annotations[api.AppStopByControllerDuePendingPod] = "true"
-	}
 	patched.Annotations[api.AppStopReasonKey] = reason
 	patched.Annotations[api.AppStopMessageKey] = message
 	patched.Annotations[domain.AnnotationOperationRequestID] = uuid.NewString()
```

**File**: `framework/app-service/controllers/pod_abnormal_suspend_app_controller_test.go` (modified, +2/-2)
```diff
@@ -113,8 +113,8 @@ func TestSuspendResolved_PatchesIntentAndTriggersStop(t *testing.T) {
 	if got.Annotations[api.AppStopAllKey] != "" {
 		t.Fatalf("stop-all = %q, want empty for a user namespace", got.Annotations[api.AppStopAllKey])
 	}
-	if got.Annotations[api.AppStopByControllerDuePendingPod] != "true" {
-		t.Fatalf("pending-pod = %q, want true", got.Annotations[api.AppStopByControllerDuePendingPod])
+	if _, ok := got.Annotations[api.AppStopByControllerDuePendingPod]; ok {
+		t.Fatal("scheduling failure left a legacy pending-pod annotation")
 	}
 	if got.Annotations[api.AppStopReasonKey] != constants.AppUnschedulable {
 		t.Fatalf("stop-reason = %q", got.Annotations[api.AppStopReasonKey])
```

**File**: `framework/app-service/pkg/apiserver/handler_suspend_v2.go` (modified, +2/-0)
```diff
@@ -360,6 +360,8 @@ func (h *Handler) deliverResumeV2(
 	if patched.Annotations == nil {
 		patched.Annotations = make(map[string]string)
 	}
+	// Retire the stop marker left on existing apps by older controllers.
+	delete(patched.Annotations, api.AppStopByControllerDuePendingPod)
 	patched.Annotations[api.AppResumeAllKey] = fmt.Sprintf("%t", includeSharedServer)
 	var opID string
 	patched.Annotations, opID = stampDurableOperationRequest(patched.Annotations)
```

**File**: `framework/app-service/pkg/apiserver/handler_suspend_v2_test.go` (modified, +4/-0)
```diff
@@ -237,6 +237,10 @@ func TestSuspendV2_HTTPShell_SignaturesCompile(t *testing.T) {
 // includeSharedServer=true stamps AppResumeAllKey="true".
 func TestResumeV2_DeliversTriggerOp(t *testing.T) {
 	f := newSuspendResumeV2Fixture(t, appv1alpha1.Stopped)
+	f.am.Annotations[api.AppStopByControllerDuePendingPod] = "true"
+	if err := f.handler.ctrlClient.Update(context.Background(), f.am); err != nil {
+		t.Fatal(err)
+	}
 	seededStatus := f.am.Status.DeepCopy()
 
 	if err := f.handler.deliverResumeV2(context.Background(), f.req, f.resp,
```

**File**: `framework/app-service/pkg/applifecycle/handlers/payload_keys.go` (modified, +0/-7)
```diff
@@ -383,11 +383,4 @@ const (
 	//
 	// Mirrors pkg/apiserver/api/types.go AppStopAllKey.
 	AnnotStopAll = "bytetrade.io/stop-all"
-
-	// AnnotPendingPod is stamped by the pod-abnormal-suspend
-	// controller when it wants a mid-resume abort. Resuming's
-	// success branch reads it and hands off to Stopping instead
-	// of Initializing. Mirrors
-	// pkg/apiserver/api/types.go AppStopByControllerDuePendingPod.
-	AnnotPendingPod = "bytetrade.io/pending-pod"
 )
```

**File**: `framework/app-service/pkg/applifecycle/handlers/resuming.go` (modified, +2/-44)
```diff
@@ -76,9 +76,8 @@ func OnResumingStop(_ context.Context, w domain.World) domain.Result {
 //     only CallWorkload{Resume} after restart.
 //   - unknown phase    → hard fail via Err (safety net).
 //
-// Pending-pod abort (bytetrade.io/pending-pod) is checked after
-// scale succeeds and routes to Stopping. Mid-resume CancelOp is
-// handled by cancel_handoff.go.
+// The pod controller requests StopOp on scheduling failure. Mid-resume
+// CancelOp is handled by cancel_handoff.go.
 func OnResumingTick(_ context.Context, w domain.World) domain.Result {
 	phase := resumingPhase(w)
 
@@ -109,9 +108,6 @@ func OnResumingWorkloadReady(_ context.Context, w domain.World) domain.Result {
 
 	switch phase {
 	case PhaseResumingScale:
-		if pendingPodAbort(w) {
-			return handoffToStoppingFromResume(w)
-		}
 		return handoffToInitializing(w)
 
 	case "":
@@ -209,44 +205,6 @@ func resumeWorkload() domain.CallWorkload {
 	}
 }
 
-// pendingPodAbort reports whether the pod-abnormal-suspend
-// controller asked to abort this resume. Legacy resuming_app.go
-// checks the annotation during IsStartUp; the wait now lives in
-// Initializing, so the closest equivalent is this post-scale check.
-func pendingPodAbort(w domain.World) bool {
-	if w.AM == nil || w.AM.Annotations == nil {
-		return false
-	}
-	return w.AM.Annotations[AnnotPendingPod] == "true"
-}
-
-// handoffToStoppingFromResume aborts a resume whose pending-pod
-// annotation was stamped mid-scale. Stopping owns teardown.
-func handoffToStoppingFromResume(w domain.World) domain.Result {
-	reason := "PendingPodStop"
-	if w.AM != nil {
-		if carried, ok := legacyStoppedReason(w.AM.Status.Reason); ok && carried == w.AM.Status.Reason {
-			reason = carried
-		}
-	}
-	return domain.Result{
-		Next: appv1.Stopping,
-		Effects: []domain.Effect{
-			domain.PatchAM{Status: appv1.ApplicationManagerStatus{
-				State:   appv1.Stopping,
-				Message: "resume aborted: pending-pod stop requested",
-				Reason:  reason,
-				Payload: map[string]string{},
-			}},
-			domain.EmitEvent{
-				Type:    "Normal",
-				Reason:  reason,
-				Message: "resume aborted: pending-pod stop requested",
-			},
-		},
-	}
-}
-
 // handoffToInitializing is the terminal-for-Resuming branch of
 // OnResumingWorkloadReady. No OpRecord — the terminal record
 // lands at Running (via Initializing).
```

**File**: `framework/app-service/pkg/applifecycle/handlers/resuming_test.go` (modified, +85/-4)
```diff
@@ -9,10 +9,12 @@ import (
 	appv1 "github.com/beclab/api/api/app.bytetrade.io/v1alpha1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 
+	"github.com/beclab/Olares/framework/app-service/pkg/apiserver/api"
 	"github.com/beclab/Olares/framework/app-service/pkg/applifecycle/domain"
 	"github.com/beclab/Olares/framework/app-service/pkg/applifecycle/handlers"
 	"github.com/beclab/Olares/framework/app-service/pkg/applifecycle/ports"
 	"github.com/beclab/Olares/framework/app-service/pkg/applifecycle/runner"
+	"github.com/beclab/Olares/framework/app-service/pkg/constants"
 )
 
 // -----------------------------------------------------------------
@@ -128,19 +130,19 @@ func TestOnResumingWorkloadReady_ScalePhase_HandsOffToInitializing(t *testing.T)
 	}
 }
 
-func TestOnResumingWorkloadReady_PendingPod_HandsOffToStopping(t *testing.T) {
+func TestOnResumingWorkloadReady_IgnoresLegacyPendingPod(t *testing.T) {
 	am := newResumingAM("app1", map[string]string{
 		handlers.PayloadResumingPhase: handlers.PhaseResumingScale,
 	})
 	am.Annotations = map[string]string{
-		handlers.AnnotPendingPod: "true",
+		api.AppStopByControllerDuePendingPod: "true",
 	}
 	res := handlers.OnResumingWorkloadReady(context.Background(), resumingWorldFor(am))
 	if res.Err != nil {
 		t.Fatalf("Err = %v", res.Err)
 	}
-	if res.Next != appv1.Stopping {
-		t.Fatalf("Next = %q, want Stopping", res.Next)
+	if res.Next != appv1.Initializing {
+		t.Fatalf("Next = %q, want Initializing with a stale pending-pod annotation", res.Next)
 	}
 }
 
@@ -243,6 +245,85 @@ func TestResuming_EndToEnd_HappyPath(t *testing.T) {
 	}
 }
 
+// The controller can write its stop request after Helm returns but before the
+// runner processes the callback. The stop must keep its own ID and reason.
+func TestResuming_QueuedScaleResultHonorsPendingStop(t *testing.T) {
+	scaleErr := errors.New("Helm scale-up failed")
+	eventErr := errors.New("recording Stopping event failed")
+	for _, tc := range []struct {
+		name     string
+		scaleErr error
+		eventErr error
+		reason   string
+	}{
+		{"scale succeeded", nil, nil, constants.AppUnschedulable},
+		{"scale failed", scaleErr, nil, constants.AppHamiSchedulable},
+		{"retry after scale succeeded", nil, eventErr, constants.AppUnschedulable},
+		{"retry after scale failed", scaleErr, eventErr, constants.AppHamiSchedulable},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctx := context.Background()
+			h := newE2EHarness(t)
+			req := runner.Request{Name: "myapp"}
+			h.seedResuming(req.Name)
+			h.workloadOps.ResumeFunc = func(context.Context, ports.WorkloadRequest) ports.WorkloadResult {
+				return ports.WorkloadResult{Err: tc.scaleErr}
+			}
+			if _, err := h.runner.Reconcile(ctx, req); err != nil {
+				t.Fatal(err)
+			}
+			awaitDispatchers(t, h)
+
+			am, err := h.amStore.Get(ctx, req.Name)
+			if err != nil {
+				t.Fatal(err)
+			}
+			stop := &ports.SpecPatch{OpType: appv1.StopOp}
+			annotations := &ports.AnnotationPatch{Set: map[string]string{
+				domain.AnnotationOperationRequestID: "pod-stop",
+				api.AppStopReasonKey:                tc.reason,
+				api.AppStopMessageKey:               "pod could not be scheduled",
+			}}
+			if err := h.amStore.PatchSpecAndAnnotations(ctx, am.Name, am.ResourceVersion, stop, annotations); err != nil {
+				t.Fatal(err)
+			}
+			// Event delivery follows the status write that consumes the stop.
+			h.recorder.RecordAppEventFunc = func(context.Context, ports.AppLifecycleEvent) error {
+				return tc.eventErr
+			}
+			if _, err := h.runner.Reconcile(ctx, req); !errors.Is(err, tc.eventErr) {
+				t.Fatalf("entering Stopping: got %v, want %v", err, tc.eventErr)
+			}
+			h.recorder.RecordAppEventFunc = nil
+			got, err := h.amStore.Get(ctx, am.Name)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if got.Status.State != appv1.Stopping || got.Status.OpType != appv1.StopOp ||
+				got.Status.OpID != "pod-stop" || got.Status.Reason != tc.reason {
+				t.Fatalf("state=%s op=%s id=%s reason=%s", got.Status.State, got.Status.OpType, got.Status.OpID, got.Status.Reason)
+			}
+			if _, err := h.runner.Reconcile(ctx, req); err != nil {
+				t.Fatal(err)
+			}
+			awaitDispatchers(t, h)
+			if calls := h.workloadOps.Calls(); len(calls) != 2 || calls[0].Method != "Resume" || calls[1].Method != "Stop" {
+				t.Fatalf("workload calls = %+v, want one Resume followed by one Stop", calls)
+			}
+			if _, err := h.runner.Reconcile(ctx, req); err != nil {
+				t.Fatal(err)
+			}
+			got, err = h.amStore.Get(ctx, am.Name)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if got.Status.State != appv1.Stopped || got.Status.Reason != tc.reason {
+				t.Fatalf("state=%s reason=%s, want Stopped with %s", got.Status.State, got.Status.Reason, tc.reason)
+			}
+		})
+	}
+}
+
 // TestResuming_EndToEnd_HelmFailure pins the failure path.
 func TestResuming_EndToEnd_HelmFailure(t *testing.T) {
 	h := newE2EHarness(t)
```

#### Recent Merged Pull Requests:
- **PR #4526** (2026-11-26): fix(appservice): bump oac version v0.0.4 (@hysyeah)
- **PR #4525** (2026-11-26): fix(app-service): unblock fixed-MAC Overlay Pod recovery (@oscdjj)
- **PR #4523** (2026-11-26): fix(app-service): unblock fixed-MAC Overlay Pod recovery (@oscdjj)
- **PR #4522** (2026-11-26): fix(app-service): ignore stale pending-pod markers on resume (@dkeven)
- **PR #4521** (2026-11-26): feat: make force Only VPN a global owner-controlled policy (@0x7fffff92)
- **PR #4520** (2026-11-26): fix(ci): update related Git configuration for skill command paths (@eball)

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

## X. app-service): unblock fixed-MAC Overlay Pod recovery

**RULE**:
When implementing operations in `framework/app-service/controllers/terminated_overlay_pod_gc_envtest_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in beclab/Olares. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `78aa03a6`: app-service): unblock fixed-MAC Overlay Pod recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `framework/app-service/controllers/terminated_overlay_pod_gc_envtest_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
package controllers

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/beclab/Olares/framework/app-service/pkg/constants"
	"github.com/beclab/Olares/framework/app-service/pkg/utils/maclease"
	"github.com/beclab/Olares/framework/app-service/pkg/webhook"
	appv1 "github.com/beclab/api/api/app.bytetrade.io/v1alpha1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	admissionv1 "k8s.io/api/admission/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
)

var _ = Describe("Overlay terminal Pod recovery", func() {
	It("reclaims the Jellyfin migration failure and hands off its fixed MAC after deletion", func() {
		now := time.Now()
		d, _ := terminatedPodGCFixture(now, terminatedPodGCTestCase{replicas: 1})
		d.Name, d.Namespace, d.UID = "jellyfin", "default", ""
		labels := map[string]string{constants.Appli
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `78aa03a6` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
