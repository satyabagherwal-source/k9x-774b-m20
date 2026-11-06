> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/beclab-olares-learnings.md`  
> **Source**: github ([https://github.com/beclab/Olares](https://github.com/beclab/Olares))  
> **Source Version**: `511dc96e`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T13:52:02.769Z  
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
> **Harvest Timestamp**: 2026-11-06T13:52:02.562Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `beclab/Olares`
- **Description**: Open-Source Personal Cloud OS for Always-On Agents
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5348 stars

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

### Incident Patch 1: `79252b5a` (2026-11-06)
**Commit Message**: Revert "docs: remove terminal entry from ctrl hub " (#4417)

Revert "docs: remove terminal entry from ctrl hub  (#4415)"

This reverts commit c32ad31357ad16a21631f6b22052021eb71994fe.

**File**: `docs/.vitepress/_redirects.nginx` (modified, +0/-4)
```diff
@@ -1,8 +1,4 @@
 # generated by .vitepress/scripts/sync-redirects.mjs — do not edit by hand
-location = /manual/olares/controlhub/terminal { return 301 /manual/access-olares-terminal; }
-location = /zh/manual/olares/controlhub/terminal { return 301 /zh/manual/access-olares-terminal; }
-location = /one/access-terminal-control-hub { return 301 /one/access-terminal-ssh; }
-location = /zh/one/access-terminal-control-hub { return 301 /zh/one/access-terminal-ssh; }
 location = /manual/tutorial/hindsight { return 301 /use-cases/hindsight; }
 location = /zh/manual/tutorial/hindsight { return 301 /zh/use-cases/hindsight; }
 location = / { return 301 /manual/overview; }
```

**File**: `docs/.vitepress/en.ts` (modified, +4/-0)
```diff
@@ -469,6 +469,10 @@ const side = {
               text: "Manage middleware",
               link: "/manual/olares/controlhub/manage-middleware",
             },
+            {
+              text: "Run commands in the Control Hub terminal",
+              link: "/manual/olares/controlhub/terminal",
+            },
             {
               text: "Configure host name resolution in Olares",
               link: "/manual/olares/settings/set-up-hosts",
```

**File**: `docs/.vitepress/one.en.ts` (modified, +4/-0)
```diff
@@ -59,6 +59,10 @@ export const oneSidebar: DefaultTheme.Sidebar = {
           link: "/one/access-overview",
           items:
             [
+              {
+                text: "Access via Control Hub",
+                link: "/one/access-terminal-control-hub",
+              },
               {
                 text: "Access via SSH",
                 link: "/one/access-terminal-ssh",
```

**File**: `docs/.vitepress/one.zh.ts` (modified, +4/-0)
```diff
@@ -59,6 +59,10 @@ export const oneSidebar: DefaultTheme.Sidebar = {
           link: "/zh/one/access-overview",
           items:
             [
+              {
+                text: "通过 Control Hub 访问",
+                link: "/zh/one/access-terminal-control-hub",
+              },
               {
                 text: "通过 SSH 访问",
                 link: "/zh/one/access-terminal-ssh",
```

**File**: `docs/.vitepress/theme/redirects.ts` (modified, +0/-6)
```diff
@@ -1,10 +1,4 @@
 export const redirects = {
-    // Retired Control Hub host terminal pages.
-    '/manual/olares/controlhub/terminal': '/manual/access-olares-terminal',
-    '/zh/manual/olares/controlhub/terminal': '/zh/manual/access-olares-terminal',
-    '/one/access-terminal-control-hub': '/one/access-terminal-ssh',
-    '/zh/one/access-terminal-control-hub': '/zh/one/access-terminal-ssh',
-
     // Move the Hindsight app tutorial to Use cases.
     '/manual/tutorial/hindsight': '/use-cases/hindsight',
     '/zh/manual/tutorial/hindsight': '/zh/use-cases/hindsight',
```

**File**: `docs/.vitepress/zh.ts` (modified, +4/-0)
```diff
@@ -469,6 +469,10 @@ const side = {
               text: "管理中间件",
               link: "/zh/manual/olares/controlhub/manage-middleware",
             },
+            {
+              text: "在控制面板终端中执行命令",
+              link: "/zh/manual/olares/controlhub/terminal",
+            },
             {
               text: "配置 Olares 内主机名解析",
               link: "/zh/manual/olares/settings/set-up-hosts",
```

**File**: `docs/developer/develop/mw-view-mariadb-data.md` (modified, +3/-3)
```diff
@@ -36,16 +36,16 @@ Before connecting, obtain MariaDB connection details from Control Hub.
 
 You can use the Olares terminal to access the MariaDB container for debugging or data operations.
 
-1. [Connect to the Olares host via SSH](../../manual/access-olares-terminal.md) with an account that has `sudo` permission.
+1. In Control Hub, open the Olares terminal at the bottom of the left navigation pane.
 2. Retrieve the Pod name for the middleware:
 
     ```bash
-    sudo kubectl get pods -n mariadb-middleware
+    kubectl get pods -n mariadb-middleware
     ```
 3. Record the Pod name, then enter the container:
 
     ```bash
-    sudo kubectl exec -it -n mariadb-middleware <mariadb-pod> -- sh
+    kubectl exec -it -n mariadb-middleware <mariadb-pod> -- sh
     ```
 4. Connect to MariaDB:
 
```

**File**: `docs/developer/develop/mw-view-mongodb-data.md` (modified, +3/-3)
```diff
@@ -35,16 +35,16 @@ Before connecting, obtain MongoDB connection details from the Control Hub.
 
 You can use the Olares terminal to access the MongoDB container.
 
-1. [Connect to the Olares host via SSH](../../manual/access-olares-terminal.md) with an account that has `sudo` permission.
+1. In Control Hub, open the Olares terminal at the bottom of the left navigation pane.
 2. Retrieve the Pod name for the middleware:
 
     ```bash
-    sudo kubectl get pods -n os-platform | grep tapr-middleware
+    kubectl get pods -n os-platform | grep tapr-middleware
     ```
 3. Record the Pod name that starts with `tapr-middleware`, then enter the container:
 
     ```bash
-    sudo kubectl exec -it -n os-platform <tapr-middleware-pod> -- sh
+    kubectl exec -it -n os-platform <tapr-middleware-pod> -- sh
     ```
 4. Connect to MongoDB using `mongosh`:
 
```

---

### Incident Patch 2: `ec32e358` (2026-11-06)
**Commit Message**: Revert "docs: update Files access and sharing guides for 1.12.8" (#4416)

Revert "docs: update Files access and sharing guides for 1.12.8 (#4386)"

This reverts commit badbc27fab6ab668b9cf8cf4894ccd3bd91a445a.

**File**: `docs/.vitepress/en.ts` (modified, +0/-4)
```diff
@@ -354,10 +354,6 @@ const side = {
               text: "Share files",
               link: "/manual/olares/files/share-files",
             },
-            {
-              text: "Manage access to Common and External",
-              link: "/manual/olares/files/manage-common-external-access",
-            },
             {
               text: "Sync files with a computer",
               link: "/manual/olares/files/sync-files",
```

**File**: `docs/.vitepress/zh.ts` (modified, +0/-4)
```diff
@@ -354,10 +354,6 @@ const side = {
               text: "分享文件",
               link: "/zh/manual/olares/files/share-files",
             },
-            {
-              text: "管理公共目录和外部存储的访问权限",
-              link: "/zh/manual/olares/files/manage-common-external-access",
-            },
             {
               text: "与电脑同步文件",
               link: "/zh/manual/olares/files/sync-files",
```

**File**: `docs/manual/mount-local-disk.md` (modified, +3/-8)
```diff
@@ -1,5 +1,4 @@
 ---
-outline: [2, 3]
 description: Manually mount an HDD or SSD under /olares/share on the Olares host to use it as independent external storage for large files and AI models.
 head:
   - - meta
@@ -14,11 +13,11 @@ This approach is recommended for **large data storage** (e.g., AI models) or **l
 
 ## Prerequisites
 
-Before you begin:
+Please ensure the following:
 
+- You have **administrator (sudo) privileges** on your Linux system.
 - **Olares** is properly installed and running.
 - The target drive is **already formatted** (recommended file systems: `ext4` or `XFS`).
-- You have administrator (`sudo`) privileges on the Linux host. To let Olares members access the disk after mounting, grant them access in Files.
 
 :::tip Mount path restriction
 
@@ -75,7 +74,7 @@ The mount configuration will be lost after a Linux or Olares reboot.
 
 3. Verify the mount result:
 
-    Log in to Olares as the Super Admin or an admin with access to the mounted directory. Open **Files** > **External** and check that you can browse the partition.
+    After successful mounting, you can access the partition from **Files** > **External**.
 
     ![Check mount result](/images/manual/tutorials/expand-storage-mount-result-en.png#bordered)
 
@@ -138,10 +137,6 @@ If you want the mount configuration to remain after reboot, configure **automati
     It is strongly recommended to run `mount -a` first to validate the configuration before rebooting.
     :::
 
-## Give members access
-
-In Olares 1.12.8, members have no access to mounted directories by default. The Super Admin or an admin with management access to the mounted directory can grant **Can view** or **Can edit** through **Access settings**. See [Manage access to Common and External](olares/files/manage-common-external-access.md).
-
 ## Unmount a partition
 
 You can unmount partitions mounted using either temporary or permanent methods.
```

**File**: `docs/manual/olares/files/add-edit-download.md` (modified, +15/-26)
```diff
@@ -10,20 +10,15 @@ head:
 # Basic file operations
 Operations in Files are essentially the same as in other file managers. This page will introduce some common tasks in Files to get you started.
 
-For Common folders and External mounts, members need **Can view** to browse and download files, or **Can edit** to upload, edit, and delete content inside the folder. Ask the Super Admin or an admin with management access to grant the required permission. See [Manage access to Common and External](manage-common-external-access.md).
-
 ## Upload files
 
 ### Upload via the Files app
 1. Open the Files app from the Dock or Launchpad on Olares.
 2. In the left sidebar, select the directory where you want to upload files. For example, **Documents**.
 3. Upload multiple files or folders using one of these methods:
-
-   a. Drag and drop files from your local file manager into the Files window.
-
-   b. Click <i class="material-symbols-outlined">drive_folder_upload</i> in the top right corner.
-
-   c. Right-click in an empty space and select from the context menu.
+   - Drag and drop files from your local file manager into the Files window.
+   - Click <i class="material-symbols-outlined">drive_folder_upload</i> in the top right corner.
+   - Right-click in an empty space and select from the context menu.
 
 :::info
 Files supports resumable uploads. If an upload is interrupted, it will automatically resume from the last checkpoint.
@@ -36,24 +31,19 @@ To start using LarePass desktop, you must import your Olares ID by pasting your
 LarePass desktop offers the same upload experience as the Files app, with automatic syncing to your Olares ID.
 
 ### Upload via LarePass mobile
-You can upload files from your phone through the LarePass app.
+You can also upload files or folders on your phone via the LarePass app.
 <Tabs>
 <template #Direct-upload>
 
-1. Open LarePass and go to **Files**.
-2. To upload to a new folder:
-
-   a. Tap <i class="material-symbols-outlined">add</i> in the bottom-right corner and select **Add folder**.
-
-   b. On the **Select the folder to upload** screen, choose a location, such as **Drive**.
-
-   c. Tap **New folder** and follow the prompts to create the folder. LarePass opens the new folder automatically.
-3. Tap <i class="material-symbols-outlined">add</i>, then select **Upload files**.
-4. Select the files and follow the prompts to upload them.
-
-   If you start from the Files home page, you will be asked to choose where to save the files. If you start inside a folder, the files upload to that folder.
-
-5. To check upload progress, go to the Files home page and tap <i class="material-symbols-outlined">mobiledata_arrows</i> in the top-right corner to open **Transfer**.
+1. Open the LarePass app and navigate to the **Files** tab.
+2. Select the directory where you want to upload files.
+3. Tap <i class="material-symbols-outlined">add_circle</i> in the bottom-right corner, and select one of the following upload options:
+   - **File**: Select from your phone's storage.
+   - **Image/Video**: Select from your phone's gallery.
+   :::tip
+   If you want to organize your uploads, you can create a **Create folder** first.
+   :::
+4. Follow the on-screen instructions to complete the upload.
 </template>
 
 <template #Share-to-upload>
@@ -69,10 +59,11 @@ This method allows you to quickly upload files or media via your phone's sharing
    - **drive**: Upload files to your Drive storage for personal use.
    - **sync**: Upload files to your Sync storage for sharing or synchronization.
 4. Follow the on-screen instructions to complete the process based on your selected target location.
-5. To check upload progress, go to the Files home page and tap <i class="material-symbols-outlined">mobiledata_arrows</i> in the top-right corner to open **Transfer**.
 </template>
 </Tabs>
 
+Files uploaded via the LarePass mobile app will also sync automatically with your Olares ID.
+
 ## Download files
 When downloading multiple files, the behavior differs between the Files app in Olares and LarePass desktop application.
 * **Files in Olares (web interface)**: Download tasks are managed directly in your browser. Manage the download queue, pause, resume, or cancel a download in the download manager of the browser. 
@@ -169,8 +160,6 @@ Deleted files cannot be recovered.
    - Click <i class="material-symbols-outlined">more_horiz</i> in the top right corner and select **Delete**.
 3. Confirm the deletion in the popup window.
 
-   If the folder is shared or contains shared folders, Files also asks you to confirm that the affected shares will be canceled. Continue only if you want to cancel those shares and delete the folder. See [What happens to shares when I rename, move, or delete a folder?](share-files.md#what-happens-to-shares-when-i-rename-move-or-delete-a-folder).
-
 ## Shortcuts
 
 To select multiple files:
```

**File**: `docs/manual/olares/files/files-common.md` (modified, +19/-13)
```diff
@@ -10,15 +10,27 @@ head:
 
 # Manage shared AI models with the Common directory
 
-The Common directory stores AI models that applications can reuse, saving storage space and avoiding duplicate downloads. Access to these files through Files is controlled separately for each Olares member.
+The Common directory provides a system-level shared space to store AI models. Multiple applications and users access the exact same model files simultaneously to save storage space and prevent duplicate downloads.
 
 ## Understand the Common directory
 
 ### How the Common directory works
 
-Multiple AI applications may need the same model files. For example, vLLM and llama.cpp can use the same Hugging Face cache. Common provides a shared location so applications can reuse models instead of keeping separate copies.
+Understand Olares's file storage mechanisms to see the benefits of the Common directory.
 
-Application access to shared models is separate from member access through Files. Granting a member access to a Common folder lets them browse or manage its contents in Files. It does not configure how applications load models.
+The following table shows the storage strategies for different locations in the Files app:
+
+| Node | File management strategy | Cross-user sharing | Cross-app sharing |
+| :------| :------------| :---------| :------- |
+| **Storage** | Isolated by user | ❌ | ✅ |
+| **Data** | Isolated by application | ✅ | ❌ |
+| **Common** | Shared across users and applications | ✅ | ✅ |
+
+**Storage** and **Data** isolate files, which creates challenges in AI scenarios:
+- **Difficulty sharing models between applications**: Multiple AI applications might require the same underlying models. For example, ComfyUI and Stable Diffusion share the same image model files, and vLLM and llama.cpp can read from the same Hugging Face cache directory. Isolated storage prevents direct reuse of these files across applications.
+- **Wasted space from repeated downloads**: Storing massive model files in isolated user or application directories forces different applications or users to download the same model repeatedly. This wastes disk space and network bandwidth.
+
+The Common directory resolves these issues. It provides a centralized space where different apps and users read the same model files, preventing storage redundancy.
 
 ![Common directory interface](/images/manual/olares/files-common.png#bordered)
 
@@ -78,24 +90,18 @@ Olares v1.12.6 includes the Common directory by default. If you are using an old
 
 ## Find and manage shared models
 
-In Olares 1.12.8, members have no access to Common folders by default. Ask the Super Admin or an admin with management access to grant **Can view** or **Can edit** on the folder you need. See [Manage access to Common and External](manage-common-external-access.md).
+Access the Common directory in the Files app and manage shared model files centrally.
 
 ### Access the Common directory
 
 1. Open the Files app from the Launchpad.
 2. Select **Application** > **Common** in the left sidebar.
-3. Open the `huggingface`, `ollama`, or `comfyui` folder you have access to.
+3. Open the `huggingface`, `ollama`, or `comfyui` subdirectory.
 4. Find your target model files.
 
 ### Manage model files
 
-Adding or deleting model files requires **Can edit** or management access to the Common folder. With **Can view**, you can browse and download files but cannot change them.
-
-Do not change the required folder structure. Applications might fail to load models if you change it.
+You can add or delete model files in the Common directory, but you must maintain the official recommended structure for each subdirectory. Applications might fail to load models if you change the required hierarchy.
 
 - **Add models**: Drag and drop model files directly into the corresponding subdirectory.
-:::warning Before deleting models
-Deleting shared model files affects every application that uses them. Keep a backup or confirm that you can download the model again before deleting it.
-:::
-
-- **Delete models**: Open the Common folder you can edit, right-click the model file or folder inside it, and select **Delete**. Edit access lets members delete files and subfolders inside an authorized folder, but not the folder itself.
+- **Delete models**: Right-click the model folder and select **Delete** to free up space. After deletion, related applications immediately lose access to the model and require a re-download to use it again.
```

**File**: `docs/manual/olares/files/index.md` (modified, +0/-4)
```diff
@@ -27,10 +27,6 @@ It mainly consists of the following components:
 * **Cloud drive**: Connected through [Integrations](mount-cloud-storage.md), including Google Drive, AWS S3, and Tencent Cloud Object Storage (COS). These allow you to link, access, and manage remote files directly from Olares.
 * **Share**: The centralized hub for managing all shared folders, including Internal shares, SMB shares, and Public shares, allowing you to monitor sharing status, adjust permissions, or cancel shares in one place.
 
-:::info Folder access in Olares 1.12.8
-In Olares 1.12.8, members need permission to access Common folders and External mounts through Files. See [Manage access to Common and External](manage-common-external-access.md).
-:::
-
 ---
 <div>
 <h4><a href="./add-edit-download">Basic file operations</a></h4>
```

**File**: `docs/manual/olares/files/manage-common-external-access.md` (removed, +0/-91)
```diff
@@ -1,91 +0,0 @@
----
-outline: [2, 3]
-description: Control which Olares members can view or edit Common folders and external storage through the Files app.
----
-
-# Manage access to Common and External
-
-In Olares 1.12.7 and earlier, External and Common folders were accessible to all members. Starting with Olares 1.12.8, only the Super admin and Admins have access by default. Members need permission to view or edit these folders.
-
-Use Access settings to grant members access to specific External mounts or Common folders.
-
-## Before you start
-
-- Log in to Olares as the Super admin or an admin who can manage the target folder.
-- For External storage, mount the storage before assigning permissions.
-
-## Supported folders
-
-Permissions apply to the selected folder and all files and subfolders inside it. You cannot set separate permissions for individual subfolders. These settings control access through Files and do not change permissions on your NAS.
-
-| Location | Folder you can configure | Example |
-| --- | --- | --- |
-| <nobr>**Application** > **Common**</nobr> | A top-level folder in Common. | `Common/huggingface` |
-| <nobr>**Drive** > **External**</nobr> | A top-level mount in External: an SMB share, NFS share, USB drive, or local disk.<br><br>**Note:** The `ai` system folder is read-only for members and does not support access settings. | `External/ProjectNAS` |
-
-## Role defaults and management scope
-
-The following defaults apply to Common folders and External mounts.
-
-| <nobr>Olares role</nobr> | <nobr>Default access</nobr> | <nobr>Whose access they can change</nobr> |
-| --- | --- | --- |
-| Super admin (Owner) | Full management access | Admins and members |
-| Admin | Full management access, unless restricted by the Super admin | Members |
-| Member | No access | Cannot change folder access settings |
-
-For more about Olares roles, see [Roles and permissions](../settings/roles-permissions.md).
-
-## Set folder permissions
-
-1. Log in to Olares as the Super admin or an admin who can manage the folder, then open **Files**.
-2. Go to **Application** > **Common** or **Drive** > **External**.
-3. Right-click the top-level folder or mounted directory, and select **Access settings**.
-
-   ![Access settings in an External SMB folder context menu](/images/manual/olares/files-access-settings.png#bordered)
-
-4. Find the person whose access you want to change and choose a permission. Only the Super admin can change an admin's folder permissions.
-
-   | <nobr>Permission</nobr> | <nobr>What this permission allows</nobr> | <nobr>Member role</nobr> | <nobr>Admin role</nobr> |
-   | --- | --- | --- | --- |
-   | **No access** | Cannot see the folder or access its contents through Files. | Available | Available |
-   | **Can view** | Browse, preview, and download files. | Available | Available |
-   | **Can edit** | View files and create, upload, modify, rename, or delete content inside the folder. | Available | Available |
-   | **Admin** | Edit content and manage the folder, including access settings. For External mounts, this also allows SMB sharing and unmounting. | Not available | Available<br><br>Only the Super admin can assign it. |
-
-5. Click **Confirm**.
-6. Ask the person to refresh Files and check that the selected permission applies.
-
-## Change or revoke access
-
-1. Right-click the same folder and select **Access settings**.
-2. Change the user's permission. To revoke access for this user, select **No access**.
-3. Click **Confirm**.
-4. Ask the user to refresh Files and check that the new permission applies.
-
-Revoking access does not delete the folder or its contents. It does not remove copies the user has already downloaded.
-
-## FAQs
-
-### How do folder access settings, Internal share, and SMB share differ, and when should I use each?
-
-Choose based on where the folder is and how people will access it:
-
-- **Access settings**: Give users access to an External mount or a Common top-level folder. Users open the original folder directly under **External** or **Common** in Files.
-- **Internal share**: Share a Home or Sync folder with other Olares users. Recipients access the folder through a separate entry under **Share** in Files. External and Common do not support Internal share.
-- **SMB share**: Let computers access a Home or External folder over the local network, using Windows File Explorer or macOS Finder. When authentication is required, use dedicated SMB accounts, which are separate from Olares accounts.
-
-### Why can’t a member access or edit a folder?
-
-Members cannot change these settings themselves. If a member reports a problem, sign in as the Super admin or an admin and check the following:
-
-| Problem | What to check |
-| --- | --- |
-| A folder is missing, or the member sees “No folders you can access.” | Check the member's permission on the top-level folder or mount. |
-| The member can read but cannot upload or edit. | Check whether the permission is
```

**File**: `docs/manual/olares/files/mount-SMB.md` (modified, +3/-32)
```diff
@@ -13,10 +13,6 @@ SMB (Server Message Block) is a protocol used to share files, printers, and othe
 
 ## Before you begin
 
-:::warning Account requirements
-Log in to Olares as the Super Admin or an admin to connect an SMB share. Members cannot connect servers.
-:::
-
 - Ensure Olares and the SMB server are on the same local network.
 - You have obtained the following details:
   - The SMB share path, which is typically in the format of `//<IP-address>/<Shared-folder-name>`.
@@ -35,36 +31,11 @@ To keep SMB credentials in one place, save them in **Settings** > **Integration*
 - Saved accounts are for reference only. Files does not list them in the mount dialog, so you still need to enter the username and password manually when mounting a share.
 :::
 
-## Mount an SMB share
-
-1. Log in to Olares as the Super Admin or an admin, open **Files**, and go to **Drive** > **External**.
-2. Click **Connect to server** in the upper-right corner.
-3. In the popup window, click the **Protocol** list, and then select **SMB**.
-
-    ![Configure SMB connection](/images/manual/olares/add-SMB-share-path.png#bordered)
-
-4. In the **Server address** field, enter the SMB share path. For example, `//192.168.1.100/Documents`.
-5. (Optional) Save frequently used server addresses for quick access next time:
-
-    - To add an address to **Favorite servers**, click <i class="material-symbols-outlined">add</i> after entering the share path.
-    - To remove a saved address, click it in **Favorite servers**, and then click <i class="material-symbols-outlined">remove</i>.
-
-6. Click **Confirm**.
-7. Enter the username and password, and then click **Confirm**.
-
-    Once connected, the SMB share appears under **External**. Open it to check that you can browse the shared files.
-
-## Give members access
-
-In Olares 1.12.8, members have no access to mounted directories by default. To let a member view or edit the files, use **Access settings** on the mounted directory. See [Manage access to Common and External](manage-common-external-access.md) for the steps.
-
-## Unmount an SMB share
-
-Log in to Olares as the Super Admin or an admin with management access to the mounted directory. Members cannot unmount storage, even if they have edit access.
+## Mount an SMB share## Unmount an SMB share
 
-Unmounting disconnects the share from Olares for everyone using that mount. It does not delete files on the NAS.
+When you no longer need access to the network files, you can safely disconnect the share.
 
 1. Open the Files app, and then go to **Drive** > **External**.
-2. Right-click the mounted folder, and then select **Unmount**.
+2. Right-click the mounted folder, and then select **Unmount**. 
 
     The SMB share is disconnected from Olares immediately, and is removed from the **External** directory.
```

---

### Incident Patch 3: `badbc27f` (2026-11-06)
**Commit Message**: docs: update Files access and sharing guides for 1.12.8 (#4386)

* fix missing content

* Access settings added for Common and External

* add menu image

* update images

* edits for content accuracy

* update share files, permission and scope

* clarify SMB mount permissions and member access

* clarity nfs mount permissions and member access

* clarify Common folder permissions

* clarify USB access and safe removal

* clarity local disk mount permission and access

* clarify file operation permissions

* add note on folder access

* update LarePass mobile upload steps

* update images

* edits for accuracy

* clarify Files access and share permissions

* address comments

**File**: `docs/.vitepress/en.ts` (modified, +4/-0)
```diff
@@ -354,6 +354,10 @@ const side = {
               text: "Share files",
               link: "/manual/olares/files/share-files",
             },
+            {
+              text: "Manage access to Common and External",
+              link: "/manual/olares/files/manage-common-external-access",
+            },
             {
               text: "Sync files with a computer",
               link: "/manual/olares/files/sync-files",
```

**File**: `docs/.vitepress/zh.ts` (modified, +4/-0)
```diff
@@ -354,6 +354,10 @@ const side = {
               text: "分享文件",
               link: "/zh/manual/olares/files/share-files",
             },
+            {
+              text: "管理公共目录和外部存储的访问权限",
+              link: "/zh/manual/olares/files/manage-common-external-access",
+            },
             {
               text: "与电脑同步文件",
               link: "/zh/manual/olares/files/sync-files",
```

**File**: `docs/manual/mount-local-disk.md` (modified, +8/-3)
```diff
@@ -1,4 +1,5 @@
 ---
+outline: [2, 3]
 description: Manually mount an HDD or SSD under /olares/share on the Olares host to use it as independent external storage for large files and AI models.
 head:
   - - meta
@@ -13,11 +14,11 @@ This approach is recommended for **large data storage** (e.g., AI models) or **l
 
 ## Prerequisites
 
-Please ensure the following:
+Before you begin:
 
-- You have **administrator (sudo) privileges** on your Linux system.
 - **Olares** is properly installed and running.
 - The target drive is **already formatted** (recommended file systems: `ext4` or `XFS`).
+- You have administrator (`sudo`) privileges on the Linux host. To let Olares members access the disk after mounting, grant them access in Files.
 
 :::tip Mount path restriction
 
@@ -74,7 +75,7 @@ The mount configuration will be lost after a Linux or Olares reboot.
 
 3. Verify the mount result:
 
-    After successful mounting, you can access the partition from **Files** > **External**.
+    Log in to Olares as the Super Admin or an admin with access to the mounted directory. Open **Files** > **External** and check that you can browse the partition.
 
     ![Check mount result](/images/manual/tutorials/expand-storage-mount-result-en.png#bordered)
 
@@ -137,6 +138,10 @@ If you want the mount configuration to remain after reboot, configure **automati
     It is strongly recommended to run `mount -a` first to validate the configuration before rebooting.
     :::
 
+## Give members access
+
+In Olares 1.12.8, members have no access to mounted directories by default. The Super Admin or an admin with management access to the mounted directory can grant **Can view** or **Can edit** through **Access settings**. See [Manage access to Common and External](olares/files/manage-common-external-access.md).
+
 ## Unmount a partition
 
 You can unmount partitions mounted using either temporary or permanent methods.
```

**File**: `docs/manual/olares/files/add-edit-download.md` (modified, +26/-15)
```diff
@@ -10,15 +10,20 @@ head:
 # Basic file operations
 Operations in Files are essentially the same as in other file managers. This page will introduce some common tasks in Files to get you started.
 
+For Common folders and External mounts, members need **Can view** to browse and download files, or **Can edit** to upload, edit, and delete content inside the folder. Ask the Super Admin or an admin with management access to grant the required permission. See [Manage access to Common and External](manage-common-external-access.md).
+
 ## Upload files
 
 ### Upload via the Files app
 1. Open the Files app from the Dock or Launchpad on Olares.
 2. In the left sidebar, select the directory where you want to upload files. For example, **Documents**.
 3. Upload multiple files or folders using one of these methods:
-   - Drag and drop files from your local file manager into the Files window.
-   - Click <i class="material-symbols-outlined">drive_folder_upload</i> in the top right corner.
-   - Right-click in an empty space and select from the context menu.
+
+   a. Drag and drop files from your local file manager into the Files window.
+
+   b. Click <i class="material-symbols-outlined">drive_folder_upload</i> in the top right corner.
+
+   c. Right-click in an empty space and select from the context menu.
 
 :::info
 Files supports resumable uploads. If an upload is interrupted, it will automatically resume from the last checkpoint.
@@ -31,19 +36,24 @@ To start using LarePass desktop, you must import your Olares ID by pasting your
 LarePass desktop offers the same upload experience as the Files app, with automatic syncing to your Olares ID.
 
 ### Upload via LarePass mobile
-You can also upload files or folders on your phone via the LarePass app.
+You can upload files from your phone through the LarePass app.
 <Tabs>
 <template #Direct-upload>
 
-1. Open the LarePass app and navigate to the **Files** tab.
-2. Select the directory where you want to upload files.
-3. Tap <i class="material-symbols-outlined">add_circle</i> in the bottom-right corner, and select one of the following upload options:
-   - **File**: Select from your phone's storage.
-   - **Image/Video**: Select from your phone's gallery.
-   :::tip
-   If you want to organize your uploads, you can create a **Create folder** first.
-   :::
-4. Follow the on-screen instructions to complete the upload.
+1. Open LarePass and go to **Files**.
+2. To upload to a new folder:
+
+   a. Tap <i class="material-symbols-outlined">add</i> in the bottom-right corner and select **Add folder**.
+
+   b. On the **Select the folder to upload** screen, choose a location, such as **Drive**.
+
+   c. Tap **New folder** and follow the prompts to create the folder. LarePass opens the new folder automatically.
+3. Tap <i class="material-symbols-outlined">add</i>, then select **Upload files**.
+4. Select the files and follow the prompts to upload them.
+
+   If you start from the Files home page, you will be asked to choose where to save the files. If you start inside a folder, the files upload to that folder.
+
+5. To check upload progress, go to the Files home page and tap <i class="material-symbols-outlined">mobiledata_arrows</i> in the top-right corner to open **Transfer**.
 </template>
 
 <template #Share-to-upload>
@@ -59,11 +69,10 @@ This method allows you to quickly upload files or media via your phone's sharing
    - **drive**: Upload files to your Drive storage for personal use.
    - **sync**: Upload files to your Sync storage for sharing or synchronization.
 4. Follow the on-screen instructions to complete the process based on your selected target location.
+5. To check upload progress, go to the Files home page and tap <i class="material-symbols-outlined">mobiledata_arrows</i> in the top-right corner to open **Transfer**.
 </template>
 </Tabs>
 
-Files uploaded via the LarePass mobile app will also sync automatically with your Olares ID.
-
 ## Download files
 When downloading multiple files, the behavior differs between the Files app in Olares and LarePass desktop application.
 * **Files in Olares (web interface)**: Download tasks are managed directly in your browser. Manage the download queue, pause, resume, or cancel a download in the download manager of the browser. 
@@ -160,6 +169,8 @@ Deleted files cannot be recovered.
    - Click <i class="material-symbols-outlined">more_horiz</i> in the top right corner and select **Delete**.
 3. Confirm the deletion in the popup window.
 
+   If the folder is shared or contains shared folders, Files also asks you to confirm that the affected shares will be canceled. Continue only if you want to cancel those shares and delete the folder. See [What happens to shares when I rename, move, or delete a folder?](share-files.md#what-happens-to-shares-when-i-rename-move-or-delete-a-folder).
+
 ## Shortcuts
 
 To select multiple files:
```

**File**: `docs/manual/olares/files/files-common.md` (modified, +13/-19)
```diff
@@ -10,27 +10,15 @@ head:
 
 # Manage shared AI models with the Common directory
 
-The Common directory provides a system-level shared space to store AI models. Multiple applications and users access the exact same model files simultaneously to save storage space and prevent duplicate downloads.
+The Common directory stores AI models that applications can reuse, saving storage space and avoiding duplicate downloads. Access to these files through Files is controlled separately for each Olares member.
 
 ## Understand the Common directory
 
 ### How the Common directory works
 
-Understand Olares's file storage mechanisms to see the benefits of the Common directory.
+Multiple AI applications may need the same model files. For example, vLLM and llama.cpp can use the same Hugging Face cache. Common provides a shared location so applications can reuse models instead of keeping separate copies.
 
-The following table shows the storage strategies for different locations in the Files app:
-
-| Node | File management strategy | Cross-user sharing | Cross-app sharing |
-| :------| :------------| :---------| :------- |
-| **Storage** | Isolated by user | ❌ | ✅ |
-| **Data** | Isolated by application | ✅ | ❌ |
-| **Common** | Shared across users and applications | ✅ | ✅ |
-
-**Storage** and **Data** isolate files, which creates challenges in AI scenarios:
-- **Difficulty sharing models between applications**: Multiple AI applications might require the same underlying models. For example, ComfyUI and Stable Diffusion share the same image model files, and vLLM and llama.cpp can read from the same Hugging Face cache directory. Isolated storage prevents direct reuse of these files across applications.
-- **Wasted space from repeated downloads**: Storing massive model files in isolated user or application directories forces different applications or users to download the same model repeatedly. This wastes disk space and network bandwidth.
-
-The Common directory resolves these issues. It provides a centralized space where different apps and users read the same model files, preventing storage redundancy.
+Application access to shared models is separate from member access through Files. Granting a member access to a Common folder lets them browse or manage its contents in Files. It does not configure how applications load models.
 
 ![Common directory interface](/images/manual/olares/files-common.png#bordered)
 
@@ -90,18 +78,24 @@ Olares v1.12.6 includes the Common directory by default. If you are using an old
 
 ## Find and manage shared models
 
-Access the Common directory in the Files app and manage shared model files centrally.
+In Olares 1.12.8, members have no access to Common folders by default. Ask the Super Admin or an admin with management access to grant **Can view** or **Can edit** on the folder you need. See [Manage access to Common and External](manage-common-external-access.md).
 
 ### Access the Common directory
 
 1. Open the Files app from the Launchpad.
 2. Select **Application** > **Common** in the left sidebar.
-3. Open the `huggingface`, `ollama`, or `comfyui` subdirectory.
+3. Open the `huggingface`, `ollama`, or `comfyui` folder you have access to.
 4. Find your target model files.
 
 ### Manage model files
 
-You can add or delete model files in the Common directory, but you must maintain the official recommended structure for each subdirectory. Applications might fail to load models if you change the required hierarchy.
+Adding or deleting model files requires **Can edit** or management access to the Common folder. With **Can view**, you can browse and download files but cannot change them.
+
+Do not change the required folder structure. Applications might fail to load models if you change it.
 
 - **Add models**: Drag and drop model files directly into the corresponding subdirectory.
-- **Delete models**: Right-click the model folder and select **Delete** to free up space. After deletion, related applications immediately lose access to the model and require a re-download to use it again.
+:::warning Before deleting models
+Deleting shared model files affects every application that uses them. Keep a backup or confirm that you can download the model again before deleting it.
+:::
+
+- **Delete models**: Open the Common folder you can edit, right-click the model file or folder inside it, and select **Delete**. Edit access lets members delete files and subfolders inside an authorized folder, but not the folder itself.
```

**File**: `docs/manual/olares/files/index.md` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ It mainly consists of the following components:
 * **Cloud drive**: Connected through [Integrations](mount-cloud-storage.md), including Google Drive, AWS S3, and Tencent Cloud Object Storage (COS). These allow you to link, access, and manage remote files directly from Olares.
 * **Share**: The centralized hub for managing all shared folders, including Internal shares, SMB shares, and Public shares, allowing you to monitor sharing status, adjust permissions, or cancel shares in one place.
 
+:::info Folder access in Olares 1.12.8
+In Olares 1.12.8, members need permission to access Common folders and External mounts through Files. See [Manage access to Common and External](manage-common-external-access.md).
+:::
+
 ---
 <div>
 <h4><a href="./add-edit-download">Basic file operations</a></h4>
```

**File**: `docs/manual/olares/files/manage-common-external-access.md` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+---
+outline: [2, 3]
+description: Control which Olares members can view or edit Common folders and external storage through the Files app.
+---
+
+# Manage access to Common and External
+
+In Olares 1.12.7 and earlier, External and Common folders were accessible to all members. Starting with Olares 1.12.8, only the Super admin and Admins have access by default. Members need permission to view or edit these folders.
+
+Use Access settings to grant members access to specific External mounts or Common folders.
+
+## Before you start
+
+- Log in to Olares as the Super admin or an admin who can manage the target folder.
+- For External storage, mount the storage before assigning permissions.
+
+## Supported folders
+
+Permissions apply to the selected folder and all files and subfolders inside it. You cannot set separate permissions for individual subfolders. These settings control access through Files and do not change permissions on your NAS.
+
+| Location | Folder you can configure | Example |
+| --- | --- | --- |
+| <nobr>**Application** > **Common**</nobr> | A top-level folder in Common. | `Common/huggingface` |
+| <nobr>**Drive** > **External**</nobr> | A top-level mount in External: an SMB share, NFS share, USB drive, or local disk.<br><br>**Note:** The `ai` system folder is read-only for members and does not support access settings. | `External/ProjectNAS` |
+
+## Role defaults and management scope
+
+The following defaults apply to Common folders and External mounts.
+
+| <nobr>Olares role</nobr> | <nobr>Default access</nobr> | <nobr>Whose access they can change</nobr> |
+| --- | --- | --- |
+| Super admin (Owner) | Full management access | Admins and members |
+| Admin | Full management access, unless restricted by the Super admin | Members |
+| Member | No access | Cannot change folder access settings |
+
+For more about Olares roles, see [Roles and permissions](../settings/roles-permissions.md).
+
+## Set folder permissions
+
+1. Log in to Olares as the Super admin or an admin who can manage the folder, then open **Files**.
+2. Go to **Application** > **Common** or **Drive** > **External**.
+3. Right-click the top-level folder or mounted directory, and select **Access settings**.
+
+   ![Access settings in an External SMB folder context menu](/images/manual/olares/files-access-settings.png#bordered)
+
+4. Find the person whose access you want to change and choose a permission. Only the Super admin can change an admin's folder permissions.
+
+   | <nobr>Permission</nobr> | <nobr>What this permission allows</nobr> | <nobr>Member role</nobr> | <nobr>Admin role</nobr> |
+   | --- | --- | --- | --- |
+   | **No access** | Cannot see the folder or access its contents through Files. | Available | Available |
+   | **Can view** | Browse, preview, and download files. | Available | Available |
+   | **Can edit** | View files and create, upload, modify, rename, or delete content inside the folder. | Available | Available |
+   | **Admin** | Edit content and manage the folder, including access settings. For External mounts, this also allows SMB sharing and unmounting. | Not available | Available<br><br>Only the Super admin can assign it. |
+
+5. Click **Confirm**.
+6. Ask the person to refresh Files and check that the selected permission applies.
+
+## Change or revoke access
+
+1. Right-click the same folder and select **Access settings**.
+2. Change the user's permission. To revoke access for this user, select **No access**.
+3. Click **Confirm**.
+4. Ask the user to refresh Files and check that the new permission applies.
+
+Revoking access does not delete the folder or its contents. It does not remove copies the user has already downloaded.
+
+## FAQs
+
+### How do folder access settings, Internal share, and SMB share differ, and when should I use each?
+
+Choose based on where the folder is and how people will access it:
+
+- **Access settings**: Give users access to an External mount or a Common top-level folder. Users open the original folder directly under **External** or **Common** in Files.
+- **Internal share**: Share a Home or Sync folder with other Olares users. Recipients access the folder through a separate entry under **Share** in Files. External and Common do not support Internal share.
+- **SMB share**: Let computers access a Home or External folder over the local network, using Windows File Explorer or macOS Finder. When authentication is required, use dedicated SMB accounts, which are separate from Olares accounts.
+
+### Why can’t a member access or edit a folder?
+
+Members cannot change these settings themselves. If a member reports a problem, sign in as the Super admin or an admin and check the following:
+
+| Problem | What to check |
+| --- | --- |
+| A folder is missing, or the member sees “No folders you can access.” | Check the member's permission on the top-level folder or mount. |
+| The member can read but cannot upload or edit. | Check whether the permission is
```

**File**: `docs/manual/olares/files/mount-SMB.md` (modified, +32/-3)
```diff
@@ -13,6 +13,10 @@ SMB (Server Message Block) is a protocol used to share files, printers, and othe
 
 ## Before you begin
 
+:::warning Account requirements
+Log in to Olares as the Super Admin or an admin to connect an SMB share. Members cannot connect servers.
+:::
+
 - Ensure Olares and the SMB server are on the same local network.
 - You have obtained the following details:
   - The SMB share path, which is typically in the format of `//<IP-address>/<Shared-folder-name>`.
@@ -31,11 +35,36 @@ To keep SMB credentials in one place, save them in **Settings** > **Integration*
 - Saved accounts are for reference only. Files does not list them in the mount dialog, so you still need to enter the username and password manually when mounting a share.
 :::
 
-## Mount an SMB share## Unmount an SMB share
+## Mount an SMB share
+
+1. Log in to Olares as the Super Admin or an admin, open **Files**, and go to **Drive** > **External**.
+2. Click **Connect to server** in the upper-right corner.
+3. In the popup window, click the **Protocol** list, and then select **SMB**.
+
+    ![Configure SMB connection](/images/manual/olares/add-SMB-share-path.png#bordered)
+
+4. In the **Server address** field, enter the SMB share path. For example, `//192.168.1.100/Documents`.
+5. (Optional) Save frequently used server addresses for quick access next time:
+
+    - To add an address to **Favorite servers**, click <i class="material-symbols-outlined">add</i> after entering the share path.
+    - To remove a saved address, click it in **Favorite servers**, and then click <i class="material-symbols-outlined">remove</i>.
+
+6. Click **Confirm**.
+7. Enter the username and password, and then click **Confirm**.
+
+    Once connected, the SMB share appears under **External**. Open it to check that you can browse the shared files.
+
+## Give members access
+
+In Olares 1.12.8, members have no access to mounted directories by default. To let a member view or edit the files, use **Access settings** on the mounted directory. See [Manage access to Common and External](manage-common-external-access.md) for the steps.
+
+## Unmount an SMB share
+
+Log in to Olares as the Super Admin or an admin with management access to the mounted directory. Members cannot unmount storage, even if they have edit access.
 
-When you no longer need access to the network files, you can safely disconnect the share.
+Unmounting disconnects the share from Olares for everyone using that mount. It does not delete files on the NAS.
 
 1. Open the Files app, and then go to **Drive** > **External**.
-2. Right-click the mounted folder, and then select **Unmount**. 
+2. Right-click the mounted folder, and then select **Unmount**.
 
     The SMB share is disconnected from Olares immediately, and is removed from the **External** directory.
```

#### Recent Merged Pull Requests:
- **PR #4417** (2026-11-06): Revert "docs: remove terminal entry from ctrl hub " (@Power-One-2025)
- **PR #4416** (2026-11-06): Revert "docs: update Files access and sharing guides for 1.12.8" (@Power-One-2025)
- **PR #4415** (2026-11-06): docs: remove terminal entry from ctrl hub  (@Power-One-2025)
- **PR #4411** (2026-11-05): files: sync upload leaves out symlinks (@aby913)
- **PR #4410** (2026-11-05): backup: update image to v0.3.75 (@aby913)
- **PR #4409** (2026-11-05): files: sync upload leaves out symlinks (@aby913)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
