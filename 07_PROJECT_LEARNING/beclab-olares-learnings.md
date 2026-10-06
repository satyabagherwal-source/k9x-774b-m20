# Forensic Learning Record (Deep Inspection): beclab/Olares

> **Canonical Artifact**: `07_PROJECT_LEARNING/beclab-olares-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/beclab/Olares](https://github.com/beclab/Olares))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:21.439Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `beclab/Olares`
- **Description**: Open-Source Personal Cloud OS for Always-On Agents
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5299 stars

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

### Core Architecture Module: `apps/packages/app/src/api/files/v2/share/base/utils.ts`
```
import { CommonFetch } from '../../../fetch';
import { encodeUrl } from 'src/utils/encode';
import { CommonUrlApiType, commonUrlPrefix } from '../../common/utils';
import { appendPath } from '../../path';

export function formatResourcesUrl(url: string) {
	const { path, path_id } = getShareDataPath(url);
	return shareCommonUrl('resources', path_id, path);
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

export function shareRemovePrefix(url: string) {
	if (!url.startsWith('/Share')) return url;
	return url.slice(6);
}

export const shareCommonUrl = (
	type: CommonUrlApiType,
	path_id: string,
	path: string
) => {
	return appendPath(commonUrlPrefix(type), 'share', path_id, path);
};

export const formatPathtoUrl = (path: string) => {
	path = shareRemovePrefix(path);
	return appendPath('/share', path);
};

export const displayPath = (file: {
	isDir: boolean;
	fileExtend?: string;
	path: string;
	fileType?: string;
}) => {
	return appendPath(
		'/Share',
		file.fileExtend || '',
		encodeUrl(file.path),
		file.isDir ? '/' : ''
	);
};

export const displaySharePath = (file: { id: string }) => {
	return appendPath('/Share', file.id, '/');
};

export function getShareDataPath(url: string) {
	const res = url.split('/');
	if (res[1] != 'Share' && res[1] != 'share') {
		throw Error('Invalid AppData path');
	}
	const path_id = res[2];
	let path = '';
	for (let i = 3; i < res.length; i++) {
		path = path + '/';
		path = path + res[i];
	}

	return { path_id, path };
}

```

### Core Architecture Module: `apps/packages/app/src/api/files/v2/sync/utils.ts`
```
import { useDataStore } from 'src/stores/data';
import { MenuItem } from 'src/utils/contact';
import { SyncRepoItemType, SyncRepoSharedItemType } from './type';
import { CommonFetch } from '../../fetch';
import { encodeUrl } from 'src/utils/encode';
import { CommonUrlApiType, commonUrlPrefix } from '../common/utils';
import { appendPath } from '../path';

export function formatUrl(url: string, repoId: string) {
	const newUrl = syncRemovePrefix(url);
	return syncCommonUrl('resources', newUrl, repoId);
}

export async function createLibrary(name: string) {
	return await CommonFetch.post(commonUrlPrefix('repos'), undefined, {
		params: {
			repoName: name
		}
	});
}

export async function renameRepo(params: {
	destination: string;
	repoId: string;
}) {
	return await CommonFetch.patch(commonUrlPrefix('repos'), undefined, {
		params
	});
}

export async function updateFile(
	path: string,
	repoId: string,
	content: string
) {
	CommonFetch.put(syncCommonUrl('resources', path, repoId), content, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}

export async function remove(url: string, repoId: string) {
	return CommonFetch.delete(formatUrl(url, repoId));
}

export async function createDir(url: string, repoId: string) {
	return CommonFetch.post(formatUrl(url, repoId));
}

export function downloaFile(item: any, repo_id: string) {
	const store = useDataStore();

	const baseURL = store.baseURL();

	const downloadUrl =
		baseURL +
		syncCommonUrl(
			'raw',
			appendPath(
				encodeUrl(item.parentPath),
				encodeUrl(item.name),
				item.isDir ? '/' : ''
			),
			repo_id
		);

	return downloadUrl;
}

export async function deleteRepo(params: { repoId: string }) {
	return await CommonFetch.delete(commonUrlPrefix('repos'), {
		params
	});
}

export async function fetchRepo(
	menu: MenuItem
): Promise<SyncRepoItemType[] | SyncRepoSharedItemType[][] | undefined> {
	if (menu != MenuItem.SHAREDWITH && menu != MenuItem.MYLIBRARIES) {
		return undefined;
	}

	if (menu == MenuItem.MYLIBRARIES) {
		return fetchMineRepo();
	} else {
		const repos2 = await fetchtosharedRepo();
		const repos3 = await fetchsharedRepo();
		return [repos2, repos3];
	}
}

export async function fetchMineRepo(): Promise<SyncRepoItemType[]> {
	try {
		const res: any = await CommonFetch.get(commonUrlPrefix('repos'));
		const repos: SyncRepoItemType[] = res.repos;
		return repos;
	} catch (error) {
		return [];
	}
}

export async function fetchtosharedRepo(): Promise<SyncRepoSharedItemType[]> {
	try {
		const res2: any = await CommonFetch.get(commonUrlPrefix('repos'), {
			params: {
				type: 'share_to_me'
			}
		});
		if (res2 && res2.repos) {
			const repos: SyncRepoSharedItemType[] = res2.repos;
			return repos;
		}
		return [];
	} catch (error) {
		return [];
	}
}

export async function fetchsharedRepo(): Promise<SyncRepoSharedItemType[]> {
	try {
		const res3: any = await CommonFetch.get(commonUrlPrefix('repos'), {
			params: {
				type: 'shared'
			}
		});
		if (res3 && res3.repos) {
			const repos: SyncRepoSharedItemType[] = res3.repos;
			return repos;
		}
		return [];
	} catch (error) {
		return [];
	}
}

export function syncRemovePrefix(url: string) {
	url = syncRemoveHomePrefix(url);
	return url;
}

export function syncRemoveHomePrefix(url: string) {
	if (!url.startsWith('/sync/')) {
		return url;
	}
	return url.slice(5);
}

export const syncCommonUrl = (
	type: CommonUrlApiType,
	path: string,
	repoId: string
) => {
	return commonUrlPrefix(type) + appendPath('sync', repoId, path);
};

export const formatPathtoUrl = (path: string, repoId: string) => {
	path = syncRemovePrefix(path);
	return appendPath('/sync', repoId, path);
};

export const displayPath = (
	file: {
		isDir: boolean;
		fileType?: string;
		parent_dir: string;
		name: string;
	},
	repoName: string
) => {
	return appendPath(
		'/Seahub/',
		repoName,
		encodeUrl(file.parent_dir),
		file.isDir ? encodeUrl(file.name) : '',
		'/'
	);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2446** (2026-04-02): **[Bug] Files: Sorting order gets lost**
  *Symptoms*: ## Please Provide the basic information of the app Files  ## Describe the bug Sorting order in Files app can be modified. But if you change the directory and go back, the sorting order is lost. The system seem to believe it's still there, because if you hut the arrow to change the order nothing happens at first. Only if you click twice the desired order is back.  **To Reproduce**  - OS Version: 1.12.2 and 1.12.4  - Browser Safari  - Steps to reproduce the behavior: please see this clip  <!-- Uploading "Sorting in Files.mov"... —>  **Expected behavior** I expect that the order of the folder and files stay the same.  **Screenshots** video attached.  **Additional context** Tried a restart of the server, didn't help. This is a minor issue, not critical. 
  **Post-Mortem & Fix Analysis**:
  > @bayerhazard Thank you. Since Files is a built‑in system application, it is located in this repository.  We’ll follow up on this.

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

### Incident Patch 1: `e823102d` (2026-09-30)
**Commit Message**: docs: generalize two-node cluster upgrade guide (#4208)

**File**: `docs/one/upgrade-multi-node-cluster.md` (modified, +19/-11)
```diff
@@ -1,15 +1,15 @@
 ---
 outline: [2, 3]
-description: Upgrade a two-node Olares cluster from version 1.12.5 to 1.12.6.
+description: Manually upgrade the master and worker nodes in a two-node Olares cluster.
 head:
   - - meta
     - name: keywords
-      content: Olares One, multi-node, two-node, upgrade, 1.12.5, 1.12.6
+      content: Olares One, multi-node, two-node, upgrade
 ---
 
-# Upgrade a two-node Olares cluster from 1.12.5 to 1.12.6
+# Upgrade a two-node Olares cluster
 
-This guide walks you through manually upgrading a two-node Olares cluster from version 1.12.5 to 1.12.6.
+This guide walks you through manually upgrading a two-node Olares cluster to a newer version.
 
 The procedure involves downloading upgrade packages on both nodes, upgrading the Olares CLI and daemon, and upgrading the master and worker nodes separately.
 
@@ -23,6 +23,14 @@ The procedure involves downloading upgrade packages on both nodes, upgrading the
 **Access**
 - You can access both nodes via SSH as a user with `sudo` privileges.
 
+**Versions**
+- Both nodes are running the same Olares version before the upgrade.
+- The target version supports upgrading from your current version.
+
+In the commands below, replace `<source-version>` with your pre-upgrade version and `<target-version>` with the version to install, without a leading `v`.
+
+For example, when upgrading from 1.12.6 to 1.12.7, use `1.12.6` for `<source-version>` and `1.12.7` for `<target-version>`.
+
 ## Step 1: Connect to both nodes
 
 Open two separate terminal windows or tabs on your computer. Use SSH to connect to each node in its own window.
@@ -60,7 +68,7 @@ Download the upgrade files without installing them. Run the following commands i
 3. Create the upgrade target file to trigger the download:
 
    ```bash
-   echo '{"version":"1.12.6", "downloadOnly": true}' > $OLARES_BASE_DIR/upgrade.target
+   echo '{"version":"<target-version>", "downloadOnly": true}' > "$OLARES_BASE_DIR/upgrade.target"
    ```
 
 4. Check the download progress:
@@ -94,7 +102,7 @@ After the downloads finish, import the new images and update the core management
 3. Update the Olares CLI to the new version:
 
    ```bash
-   cp -f $OLARES_BASE_DIR/pkg/components/olares-cli-v1.12.6 /usr/local/bin/olares-cli
+   cp -f "$OLARES_BASE_DIR/pkg/components/olares-cli-v<target-version>" /usr/local/bin/olares-cli
    ```
 
 4. Import the new container images:
@@ -133,10 +141,10 @@ With both nodes prepared, upgrade the master node first.
    kubectl get pod -o wide -A
    ```
 
-4. Temporarily set the cluster version back to `1.12.5` so the worker node can be upgraded:
+4. Temporarily set the cluster version back to `<source-version>`, the pre-upgrade version, so the worker node can be upgraded:
 
    ```bash
-   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"1.12.5"}}'
+   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"<source-version>"}}'
    ```
 
 ## Step 5: Upgrade the worker node
@@ -153,17 +161,17 @@ Now that the master node is upgraded and patched, you can upgrade the worker nod
 
 ## Step 6: Restore the cluster version on the master node
 
-After the worker node finishes upgrading, restore the version on the master node to `1.12.6` to complete the process.
+After the worker node finishes upgrading, restore the cluster version to `<target-version>` on the master node to complete the process.
 
 If your SSH session to the master node times out, reconnect before proceeding.
 
 1. In the master node SSH window, run the following command:
 
    ```bash
-   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"1.12.6"}}'
+   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"<target-version>"}}'
    ```
 
-   The two-node cluster is now running Olares 1.12.6.
+   The two-node cluster is now running the target Olares version.
 
 2. To verify the final status of both nodes in the cluster, run the following command:
 
```

**File**: `docs/zh/one/upgrade-multi-node-cluster.md` (modified, +19/-11)
```diff
@@ -1,19 +1,19 @@
 ---
 outline: [2, 3]
-description: 将双节点 Olares 集群从 1.12.5 升级到 1.12.6。
+description: 手动升级双节点 Olares 集群中的 master 节点和 worker 节点。
 head:
   - - meta
     - name: keywords
-      content: Olares One, 多节点, 双节点, 升级, 1.12.5, 1.12.6
+      content: Olares One, 多节点, 双节点, 升级
 ---
 
 :::warning
 本文档由 AI 自动翻译，仅供参考。涉及关键操作或信息时，请以[英文原文](../../one/upgrade-multi-node-cluster.md)为准。
 :::
 
-# 将双节点 Olares 集群从 1.12.5 升级到 1.12.6
+# 升级双节点 Olares 集群
 
-本教程介绍如何手动将双节点 Olares 集群从 1.12.5 升级到 1.12.6。升级过程包括在两个节点上下载升级包、升级 Olares CLI 和守护进程，以及分别升级 master 节点和 worker 节点。
+本指南介绍如何手动将双节点 Olares 集群升级到新版本。升级过程包括在两个节点上下载升级包、升级 Olares CLI 和守护进程，以及分别升级 master 节点和 worker 节点。
 
 ## 准备工作
 
@@ -25,6 +25,14 @@ head:
 **访问**
 - 你可以通过 SSH 以具有 `sudo` 权限的用户访问两个节点。
 
+**版本**
+- 升级前，两个节点运行相同的 Olares 版本。
+- 目标版本支持从当前版本升级。
+
+在以下命令中，将 `<source-version>` 替换为升级前的版本号，将 `<target-version>` 替换为目标版本号，均不带 `v` 前缀。
+
+例如，从 1.12.6 升级到 1.12.7 时，将 `<source-version>` 替换为 `1.12.6`，将 `<target-version>` 替换为 `1.12.7`。
+
 ## 步骤 1：连接到两个节点
 
 在你的电脑上打开两个独立的终端窗口或标签页，分别通过 SSH 连接到两个节点。
@@ -62,7 +70,7 @@ head:
 3. 创建升级目标文件以触发下载：
 
    ```bash
-   echo '{"version":"1.12.6", "downloadOnly": true}' > $OLARES_BASE_DIR/upgrade.target
+   echo '{"version":"<target-version>", "downloadOnly": true}' > "$OLARES_BASE_DIR/upgrade.target"
    ```
 
 4. 检查下载进度：
@@ -96,7 +104,7 @@ head:
 3. 将 Olares CLI 更新到新版本：
 
    ```bash
-   cp -f $OLARES_BASE_DIR/pkg/components/olares-cli-v1.12.6 /usr/local/bin/olares-cli
+   cp -f "$OLARES_BASE_DIR/pkg/components/olares-cli-v<target-version>" /usr/local/bin/olares-cli
    ```
 
 4. 导入新容器镜像：
@@ -135,10 +143,10 @@ head:
    kubectl get pod -o wide -A
    ```
 
-4. 临时将集群版本号改回 `1.12.5`，以便升级 worker 节点：
+4. 临时将集群版本号改回升级前的版本 `<source-version>`，以便升级 worker 节点：
 
    ```bash
-   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"1.12.5"}}'
+   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"<source-version>"}}'
    ```
 
 ## 步骤 5：升级 worker 节点
@@ -155,17 +163,17 @@ master 节点升级完成并临时修改版本号后，即可升级 worker 节
 
 ## 步骤 6：在 master 节点上恢复集群版本
 
-worker 节点升级完成后，将 master 节点上的版本号恢复为 `1.12.6`，以完成整个升级过程。
+worker 节点升级完成后，在 master 节点上将集群版本号恢复为 `<target-version>`，以完成整个升级过程。
 
 如果到 master 节点的 SSH 连接已超时，请先重新连接再继续。
 
 1. 在 master 节点的 SSH 窗口中，执行以下命令：
 
    ```bash
-   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"1.12.6"}}'
+   kubectl patch terminus terminus --type=merge -p '{"spec":{"version":"<target-version>"}}'
    ```
 
-   此时，双节点集群已运行在 Olares 1.12.6 上。
+   此时，双节点集群已运行目标 Olares 版本。
 
 2. 要验证集群中两个节点的最终状态，请执行以下命令：
 
```

---

### Incident Patch 2: `9983298f` (2026-09-30)
**Commit Message**: docs: add Wukong frame generation workaround (#4170)

* docs: add Wukong frame generation workaround

* docs: refine Wukong frame generation steps

**File**: `docs/use-cases/steam-common-issues.md` (modified, +48/-6)
```diff
@@ -1,20 +1,20 @@
 ---
 outline: [2, 3]
-description: Troubleshoot common Steam Headless issues on Olares, including package persistence after app restarts and upgrades.
+description: "Troubleshoot common Steam Headless issues on Olares, including package persistence and Black Myth: Wukong Frame Generation."
 head:
   - - meta
     - name: keywords
-      content: Olares, Steam Headless, common issues, Flatpak, apt, app persistence, troubleshooting
-app_version: "1.0.43"
-doc_version: "1.0"
-doc_updated: "2026-09-03"
+      content: Olares, Steam Headless, common issues, Flatpak, apt, Black Myth Wukong, DLSS Frame Generation, troubleshooting
+app_version: "1.0.49"
+doc_version: "1.1"
+doc_updated: "2026-09-20"
 ---
 
 # Steam Headless common issues
 
 Find solutions to common Steam Headless problems on Olares.
 
-## Why do packages installed with `apt` disappear after Steam Headless restarts?
+## Packages installed with `apt` disappear after Steam Headless restarts
 
 Packages installed with `apt` are written to the container's root filesystem. Steam Headless recreates this filesystem when the app restarts, is redeployed, or is upgraded. As a result, packages installed manually with `apt` are not retained.
 
@@ -28,3 +28,45 @@ To install a package with Flatpak:
 4. Run the Flatpak installation command in the container shell.
 
 For more information about Pods and containers, see [Manage containers](../manual/olares/controlhub/manage-container.md).
+
+## Frame Generation is unavailable in Black Myth: Wukong
+
+When you run Black Myth: Wukong through Proton, **Frame Generation** might be unavailable in the graphics settings. The latest Steam Headless release includes a script that configures DirectX 12, DLSS, and hardware-accelerated GPU scheduling for the game's Proton environment.
+
+1. Open Market and update Steam Headless to the latest available version.
+2. In the Steam Library, select Black Myth: Wukong. Wait for any download or file validation to finish, and make sure **Play** is available.
+3. Click **Play** and wait until the game reaches the main menu. Then quit the game completely.
+4. Open Control Hub and go to **Browse** > **steamheadless**.
+5. Expand **Deployments** > **steamheadless**, then open the running Pod.
+6. Under **Containers**, click the Terminal icon next to **steam-headless**.
+7. Confirm that the fix script is available:
+
+   ```bash
+   command -v fix-wukong-frame-gen.sh
+   ```
+
+   The command should return:
+
+   ```plain
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+   If the command returns no output, return to Market and confirm that Steam Headless is up to date before continuing.
+
+8. Run the fix script:
+
+   ```bash
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+9. Check that the output includes the following messages:
+
+   ```plain
+   [OK] GameUserSettings.ini: Dx12=1, Dlss=1
+   [OK] Wrote registry HwSchMode=2 into system.reg
+   [OK] Done. Launch Black Myth: Wukong and enable Frame Generation in the graphics menu.
+   ```
+
+10. Launch the game, open its graphics settings, and enable **Frame Generation**.
+
+Run the script again after reinstalling or updating the game. If the script reports that the game is running, quit the game completely before retrying. Do not rely on the `-dx12` Steam launch option because the Steam client might remove it.
```

**File**: `docs/zh/use-cases/steam-common-issues.md` (modified, +48/-6)
```diff
@@ -1,13 +1,13 @@
 ---
 outline: [2, 3]
-description: 排查 Olares 上 Steam Headless 的常见问题，包括应用重启和升级后的软件包持久化问题。
+description: 排查 Olares 上 Steam Headless 的常见问题，包括软件包持久化和《黑神话：悟空》帧生成问题。
 head:
   - - meta
     - name: keywords
-      content: Olares, Steam Headless, 常见问题, Flatpak, apt, 应用持久化, 故障排查
-app_version: "1.0.43"
-doc_version: "1.0"
-doc_updated: "2026-09-03"
+      content: Olares, Steam Headless, 常见问题, Flatpak, apt, 黑神话悟空, DLSS 帧生成, 故障排查
+app_version: "1.0.49"
+doc_version: "1.1"
+doc_updated: "2026-09-20"
 ---
 
 :::warning
@@ -18,7 +18,7 @@ doc_updated: "2026-09-03"
 
 查找 Olares 上 Steam Headless 常见问题的解决方法。
 
-## 为什么通过 `apt` 安装的软件包会在 Steam Headless 重启后消失？
+## 通过 `apt` 安装的软件包在 Steam Headless 重启后消失
 
 通过 `apt` 安装的软件包会写入容器的根文件系统。当 Steam Headless 重启、重新部署或升级时，这个文件系统会重新创建。因此，通过 `apt` 手动安装的软件包不会保留。
 
@@ -32,3 +32,45 @@ doc_updated: "2026-09-03"
 4. 在容器 Shell 中执行 Flatpak 安装命令。
 
 有关 Pod 和容器的更多信息，请参阅[管理容器](../manual/olares/controlhub/manage-container.md)。
+
+## 《黑神话：悟空》无法开启帧生成
+
+通过 Proton 运行《黑神话：悟空》时，游戏的图形设置中可能无法开启**帧生成**。最新版 Steam Headless 内置了修复脚本，用于在游戏的 Proton 环境中配置 DirectX 12、DLSS 和硬件加速 GPU 调度。
+
+1. 打开应用市场，将 Steam Headless 更新到商店提供的最新版本。
+2. 在 Steam 游戏库中选择《黑神话：悟空》。等待下载和文件验证完成，确认页面显示 **Play**。
+3. 点击 **Play**，等待游戏进入主菜单，然后完全退出游戏。
+4. 打开 Control Hub，前往 **Browse** > **steamheadless**。
+5. 展开 **Deployments** > **steamheadless**，然后打开正在运行的 Pod。
+6. 在 **Containers** 下，点击 **steam-headless** 旁边的 Terminal 图标。
+7. 确认修复脚本已安装：
+
+   ```bash
+   command -v fix-wukong-frame-gen.sh
+   ```
+
+   命令应返回：
+
+   ```plain
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+   如果命令没有返回任何内容，请返回应用市场，确认 Steam Headless 已更新到最新版本，再继续操作。
+
+8. 执行修复脚本：
+
+   ```bash
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+9. 确认输出包含以下信息：
+
+   ```plain
+   [OK] GameUserSettings.ini: Dx12=1, Dlss=1
+   [OK] Wrote registry HwSchMode=2 into system.reg
+   [OK] Done. Launch Black Myth: Wukong and enable Frame Generation in the graphics menu.
+   ```
+
+10. 启动游戏，在图形设置中开启**帧生成**。
+
+重新安装或更新游戏后，需要再次执行该脚本。如果脚本提示游戏正在运行，请完全退出游戏后重试。不要依赖 Steam 启动参数 `-dx12`，Steam 客户端可能会将其清除。
```

---

### Incident Patch 3: `09135a31` (2026-09-30)
**Commit Message**: docs: add OpenClaw Android and iOS pairing guides (#4199)

* docs: add Android and iOS OpenClaw pairing guides

* docs: explain OpenClaw onboarding TUI proxy attribution workaround

* docs: separate OpenClaw mobile setup into iOS and Android tabs

* docs: refine mobile pairing steps and prerequisites

**File**: `docs/.vitepress/usecase.en.ts` (modified, +4/-0)
```diff
@@ -33,6 +33,10 @@ export const useCaseSidebar: DefaultTheme.Sidebar = {
                   link: "/use-cases/openclaw",
                   collapsed: true,
                   items: [
+                    {
+                      text: "Connect using OpenClaw mobile clients",
+                      link: "/use-cases/openclaw-mobile",
+                    },
                     {
                       text: "Integrate with channels",
                       items: [
```

**File**: `docs/.vitepress/usecase.zh.ts` (modified, +4/-0)
```diff
@@ -33,6 +33,10 @@ export const useCaseSidebar: DefaultTheme.Sidebar = {
                   link: "/zh/use-cases/openclaw",
                   collapsed: true,
                   items: [
+                    {
+                      text: "使用 Openclaw 移动客户端连接",
+                      link: "/zh/use-cases/openclaw-mobile",
+                    },
                     {
                       text: "集成聊天应用",
                       items: [
```

**File**: `docs/use-cases/openclaw-mobile.md` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+---
+connectionVersion: "1.12.7"
+connectionLatestPath: /use-cases/openclaw-mobile
+outline: [2, 3]
+title: Connect using OpenClaw mobile clients
+description: Pair the OpenClaw Android or iOS app with your Olares Gateway using a QR code or manual connection settings over LarePass VPN.
+app_version: "1.0.47"
+doc_version: "1.0"
+doc_updated: "2026-09-30"
+---
+
+# Connect using OpenClaw mobile clients
+
+Use the OpenClaw mobile app to chat with the agent running on Olares. Pair the phone once, then use the same Gateway address at home and away with LarePass VPN enabled.
+
+## Prerequisites
+
+- Complete [OpenClaw setup](openclaw.md) on Olares, including configuring a model for chat.
+- Install LarePass on the phone and sign in with the Olares account that owns this OpenClaw instance.
+- Upgrade OpenClaw to Chart version **1.0.47 or later**.
+
+::: warning Important
+Keep LarePass VPN enabled on the phone whether you use local Wi-Fi or mobile data. On the local network, LarePass automatically uses an Intranet connection. OpenClaw tokens and setup codes do not replace Olares entrance authentication.
+:::
+
+## Confirm the Gateway address and Auth Level
+
+1. In Olares, open **Settings** > **Applications** > **OpenClaw**.
+2. Under **Entrances**, open **OpenClaw Gateway** and copy its domain. Keep its authentication level set to **Internal**.
+
+The Gateway entrance is hidden from the Launchpad. Its address differs from **OpenClaw CLI**, **Control UI**, and the Olares Desktop address. If you use a cloned app, select that instance's Gateway entrance.
+
+In the examples below, replace `efa2f8ec2.yourolaresid.olares.com` with that domain. The connection URL is `wss://efa2f8ec2.yourolaresid.olares.com`, using port **443** and **TLS**. The internal service port `18789` is not the port to enter when using the Olares entrance.
+
+Install and connect the client
+
+<Tabs>
+<template #iOS>
+
+### Install the iOS client
+
+1. Install the official OpenClaw client from the [App Store](https://apps.apple.com/app/openclaw-ai-that-does-things/id6780396132).
+2. Open LarePass and confirm that its VPN is connected, then open OpenClaw. Choose either pairing path below.
+
+### Path 1: Automatic pairing with a QR code
+
+1. Open **OpenClaw CLI** from the Olares Launchpad.
+2. Generate a mobile setup code:
+
+   ```bash
+   openclaw qr
+   ```
+
+   New installations of Olares app version **1.0.47 or later** configure the Gateway entrance as the pairing URL. Check that the output's **Gateway** line contains the domain you copied, with `wss://`.
+
+3. If you upgraded an existing installation, changed the entrance domain, or the displayed address is incorrect, specify the address explicitly:
+
+   ```bash
+   openclaw qr --url 'wss://efa2f8ec2.yourolaresid.olares.com'
+   ```
+
+   This command does not change your saved configuration. Upgrades preserve existing `openclaw.json` settings, so a new default does not overwrite an existing installation.
+
+4. Open **Connections** in the mobile client and select **Scan QR to pair**.
+5. Allow camera access when prompted, then scan the terminal QR code.
+6. On the first connection, the client asks whether to trust the Gateway. Verify that the address matches your Olares Gateway entrance, then select **Trust and connect**. The client pairs automatically; if approval remains pending, follow [Approve a pending device](#approve-a-pending-device).
+7. Open chat, send a message, and confirm a reply.
+
+The QR code contains a short-lived pairing credential. Keep it private and generate a new one if it expires. By default, a `wss://` setup code grants node access and full Gateway operator access. Add `--limited` to request a reduced operator profile. See the [upstream QR reference](https://docs.openclaw.ai/cli/qr).
+
+### Path 2: Manual pairing
+
+1. In **OpenClaw CLI**, display the Gateway token:
+
+   ```bash
+   openclaw gateway auth-token --show
+   ```
+
+   Copy the token privately to the phone. It is an OpenClaw credential, not your Olares account password.
+
+2. On your iPhone, open **Settings** > **Gateway** and enable **Use Manual Gateway** (or **Manual Host**, depending on the app version).
+3. Fill in the connection details:
+
+   | Field | Value |
+   | --- | --- |
+   | Host | Your Gateway entrance domain, such as `efa2f8ec2.yourolaresid.olares.com`. Do not include a scheme or path when host and port are separate fields. |
+   | Port | `443` |
+   | Token | The Gateway token from step 1 |
+   | Password | Leave empty for the default token-based Olares deployment |
+   | Connection security / TLS | **Secure (TLS)** / enabled |
+
+   If the client provides one complete URL field, enter `wss://efa2f8ec2.yourolaresid.olares.com`. If you changed OpenClaw to password authentication, enter the configured Gateway password instead.
+
+4. Tap **Test connection**, **Connect**, or **Save & Connect**. A **pairing required** message means the connection reached the Gateway and ne
```

**File**: `docs/use-cases/openclaw.md` (modified, +7/-0)
```diff
@@ -128,6 +128,12 @@ Set up OpenClaw using the step-by-step interactive wizard.
 
     Once you complete the onboarding wizard, OpenClaw opens the Terminal User Interface (TUI) automatically.
 
+    :::tip If the TUI opened by onboarding reports HTTP 403
+    In OpenClaw 2026.9.6, the wizard can open the TUI using the container's LAN address. With the Olares proxy configuration, this connection can fail with `proxy_attribution_required` even though the model is configured correctly.
+
+    Enter `/quit` to leave that TUI, then run `openclaw tui` in the same OpenClaw CLI terminal. Check that the heading shows `ws://127.0.0.1:18789`. This local connection uses the existing configuration and credentials. For this specific error on the onboarding path, you do not need to add `gateway.remote.edgeAuth` or change the mobile Gateway URL.
+    :::
+
     ![OpenClaw TUI after setup](/images/manual/use-cases/router-client-connect-openclaw.png#bordered)
 
 4. Type `/quit` and press **Enter** to exit.
@@ -290,6 +296,7 @@ This process establishes the agent's identity, behavioral boundaries, and long-t
 1. [Integrate with Discord](openclaw-integration.md) to chat with your agent remotely.
 2. [Enable web search](openclaw-web-access.md) to give your agent access to the live internet information.
 3. [Install skills and plugins](openclaw-skills.md) to enhance your agent's capabilities.
+4. [Connect using OpenClaw mobile clients](openclaw-mobile.md) using QR or manual pairing over LarePass VPN.
 
 ## Troubleshooting and FAQs
 
```

**File**: `docs/zh/use-cases/openclaw-mobile.md` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+---
+connectionVersion: "1.12.7"
+connectionLatestPath: /zh/use-cases/openclaw-mobile
+outline: [2, 3]
+title: 使用 Openclaw 移动客户端连接
+description: 通过 LarePass VPN，使用二维码或手动连接设置，将 OpenClaw Android 或 iOS 应用与 Olares Gateway 配对。
+app_version: "1.0.47"
+doc_version: "1.0"
+doc_updated: "2026-09-30"
+---
+
+# 使用 Openclaw 移动客户端连接
+
+使用 OpenClaw 手机应用与 Olares 上运行的智能体聊天。完成一次配对后，在家中或外出时都可保持 LarePass VPN 开启，使用同一个 Gateway 地址连接。
+
+## 前提条件
+
+- 在 Olares 上完成 [OpenClaw 初始化](openclaw.md)，并配置聊天所需的模型。
+- 在手机上安装 LarePass，登录拥有此 OpenClaw 实例的 Olares 账户。
+- 将 OpenClaw 升级到 Chart 版本 **1.0.47 或更高版本**。
+
+::: warning 重要
+无论使用本地 Wi-Fi 还是移动数据，都应保持移动端 LarePass VPN 开启。在局域网内，LarePass 会自动使用 Intranet 连接。OpenClaw 的令牌或配对码不能替代 Olares 入口认证。
+:::
+
+## 确认 Gateway 地址和 Auth Level
+
+1. 在 Olares 中打开**设置** > **应用** > **OpenClaw**。
+2. 在**入口**中打开 **OpenClaw Gateway**，复制它的域名，并保持认证级别为 **Internal（内部）**。
+
+Gateway 入口不会显示在启动台中。它的地址与 **OpenClaw CLI**、**Control UI** 和 Olares 桌面地址不同。如果使用克隆应用，请选择对应实例的 Gateway 入口。
+
+下文用 `efa2f8ec2.yourolaresid.olares.com` 表示此域名，请替换为实际值。完整连接地址为 `wss://efa2f8ec2.yourolaresid.olares.com`，使用 **443** 端口和 **TLS**。通过 Olares 入口连接时，不要填写内部服务端口 `18789`。
+
+## 安装并连接客户端
+
+<Tabs>
+<template #iOS>
+
+### 安装 iOS 客户端
+
+1. 从 [App Store](https://apps.apple.com/app/openclaw-ai-that-does-things/id6780396132) 安装官方 OpenClaw 客户端。
+2. 打开 LarePass 并确认 VPN 已连接，再打开 OpenClaw。选择以下任意一种配对方式。
+
+### 路径一：扫码自动配对
+
+1. 从 Olares 启动台打开 **OpenClaw CLI**。
+2. 生成手机配对码：
+
+   ```bash
+   openclaw qr
+   ```
+
+   全新安装的 Olares 应用版本 **1.0.47 及以上** 会将 Gateway 入口设为配对地址。检查输出中的 **Gateway** 一行，确认它使用刚才复制的域名，并以 `wss://` 开头。
+
+3. 如果从旧版升级、修改过入口域名，或显示的地址不正确，请显式指定地址：
+
+   ```bash
+   openclaw qr --url 'wss://efa2f8ec2.yourolaresid.olares.com'
+   ```
+
+   此命令不会修改已保存的配置。升级会保留原有 `openclaw.json`，不会用新的默认值覆盖已有安装。
+
+4. 在 iPhone 上打开 OpenClaw，进入 **Connections**，选择 **Scan QR to pair**。
+5. 按提示允许相机访问，然后扫描终端中的二维码。
+6. 首次连接时，客户端会询问是否信任当前 Gateway。核对地址与 Olares 的 Gateway 入口一致后，选择 **Trust and connect**。客户端会自动完成配对；如果仍提示等待审批，按[审批待配对设备](#审批待配对设备)操作。
+7. 进入聊天界面，发送一条消息并确认收到回复。
+
+二维码包含短期有效的配对凭据，请妥善保管，过期后重新生成。默认的 `wss://` 配对码授予手机节点访问权限和完整 Gateway 操作员权限；需要较低权限时，可在生成命令中添加 `--limited`。参见[上游 QR 命令说明](https://docs.openclaw.ai/cli/qr)。
+
+### 路径二：手动配对
+
+1. 在 **OpenClaw CLI** 中显示 Gateway 令牌：
+
+   ```bash
+   openclaw gateway auth-token --show
+   ```
+
+   将令牌私下复制到手机。它是 OpenClaw 的访问凭据，不是 Olares 账户密码。
+
+2. 在 iPhone 上打开 **Settings** > **Gateway**，启用 **Use Manual Gateway**，部分版本称为 **Manual Host**。
+3. 填写连接参数：
+
+   | 参数 | 填写内容 |
+   | --- | --- |
+   | 主机 | Gateway 入口域名，例如 `efa2f8ec2.yourolaresid.olares.com`。主机和端口分开填写时，不要添加协议前缀或路径。 |
+   | 端口 | `443` |
+   | 令牌 | 第 1 步获取的 Gateway 令牌 |
+   | 密码 | Olares 默认使用令牌认证，此处留空 |
+   | 连接安全性 / TLS | 选择 **安全（TLS）** 或启用 TLS |
+
+   如果客户端只有一个完整 URL 输入框，填写 `wss://efa2f8ec2.yourolaresid.olares.com`。如果已将 OpenClaw 改为密码认证，则填写配置的 Gateway 密码。
+
+4. 点击**测试连接**、**连接**或**保存并连接**。出现 **pairing required** 表示已到达 Gateway，需要审批设备。
+5. 按[审批待配对设备](#审批待配对设备)操作，使用 `openclaw devices approve <requestId>` 批准设备连接，然后返回客户端重新连接。保持手机应用在前台。
+6. 在 **OpenClaw CLI** 中查询手机重连后发起的节点能力请求：
+
+   ```bash
+   openclaw nodes pending
+   ```
+
+7. 核对自己的手机及其申请的命令和能力。如果存在待审批请求，使用此列表中的 Request ID 批准：
+
+   ```bash
+   openclaw nodes approve <nodeRequestId>
+   ```
+
+   节点能力请求的 ID 与 `devices list` 中的设备配对请求 ID 不同，不能混用。如果没有待审批的节点请求，继续检查节点状态即可。
+
+8. 检查节点连接状态和能力：
+
+   ```bash
+   openclaw nodes status
+   openclaw nodes describe --node <nodeId>
+   ```
+
+   将 `<nodeId>` 替换为状态列表中手机的节点 ID。确认节点已连接；相机、麦克风和位置等功能还需按手机系统提示授权。参见[节点配对说明](https://docs.openclaw.ai/cli/nodes#pairing)。
+
+9. 进入聊天界面，发送一条消息并确认收到回复。
+
+</template>
+
+<template #Android>
+
+### 安装 Android 客户端
+
+1. 从 [Google Play](https://play.google.com/store/apps/details?id=ai.openclaw.app) 安装官方 OpenClaw 客户端。也可按照[官方安装指南](https://docs.openclaw.ai/platforms/android#install-outside-google-play)，下载并校验发布页面提供的签名 APK；并非每个 Gateway 版本都提供 APK。
+2. 打开 LarePass 并确认 VPN 已连接，再打开 OpenClaw。选择以下任意一种配对方式。
+
+### 路径一：扫码自动配对
+
+1. 从 Olares 启动台打开 **OpenClaw CLI**。
+2. 生成手机配对码：
+
+   ```bash
+   openclaw qr
+   ```
+
+   全新安装的 Olares 应用版本 **1.0.47 及以上** 会将 Gateway 入口设为配对地址。检查输出中的 **Gateway** 一行，确认它使用刚才复制的域名，并以 `wss://` 开头。
+
+3. 如果从旧版升级、修改过入口域名，或显示的地址不正确，请显式指定地址：
+
+   ```bash
+   openclaw qr --url 'wss://efa2f8ec2.yourolaresid.olares.com'
+   ```
+
+   此命令不会修改已保存的配置。升级会保留原有 `openclaw.json`，不会用新的默认值覆盖已有安装。
+
+4. 在手机上打开 OpenClaw，进入 **Connections**，选择 **Scan QR to pair**。
+5. 按提示允许相机访问，然后扫描终端中的二维码。
+6. 首次连接时，客户端会询问是否信任当前 Gateway。核对地址与 Olares 的 Gateway 入口一致后，选择 **Trust and connect**。客户端会自动完成配对；如果仍提示等待审批，按[审批待配对设备](#审批待配对设备)操作。
+7. 进入聊天界面，发送一条消息并确认收到回复。
+
+二维码包含短期有效的配对凭据，请妥善保管，过期后重新生成。默认的 `wss://` 配对码授予手机节点访问权限和完整 Gateway 操作员权限；需要较低权限时，可在生成命令中添加 `--limited`。参见[上游 QR 命令说明](https://docs.openclaw.ai/cli/qr)。
+
+### 路径二：手动配对
+
+1. 在 **OpenClaw CLI** 中显示 Gateway 令牌：
+
+   ```bash
+   openclaw gateway auth-token --show
+   ```
+
+   将令牌私下复制到手机。它是 OpenClaw 的访问凭据，不是 Olares 账户密码。
+
+2. 在 Android 客户端选择**手动设置**，或进入**设置** > **Gateway** > **手动 Gateway**。
+3. 填写连接参数：
+
+   | 参数 | 填写内容
```

**File**: `docs/zh/use-cases/openclaw.md` (modified, +7/-0)
```diff
@@ -132,6 +132,12 @@ OpenClaw 需要较大的"上下文窗口"（即 AI 的短期记忆）来处理
 
     完成安装向导后，OpenClaw 会自动打开终端用户界面（TUI）。
 
+    :::tip 向导自动打开的 TUI 提示 HTTP 403
+    OpenClaw 2026.9.6 的向导可能使用容器的 LAN 地址打开 TUI。在 Olares 的代理配置下，这条连接会触发 `proxy_attribution_required`，即使模型配置正确也会出现此错误。
+
+    输入 `/quit` 退出该 TUI，然后在同一个 OpenClaw CLI 终端运行 `openclaw tui`。确认顶部显示 `ws://127.0.0.1:18789`。本地连接会使用现有配置和凭据。对于向导路径上的这一特定错误，无需添加 `gateway.remote.edgeAuth`，也无需修改手机使用的 Gateway URL。
+    :::
+
     ![OpenClaw TUI after setup](/images/manual/use-cases/router-client-connect-openclaw.png#bordered)
 
 4. 输入 `/quit` 并按 **Enter** 退出。
@@ -294,6 +300,7 @@ OpenClaw 需要较大的"上下文窗口"（即 AI 的短期记忆）来处理
 1. [与 Discord 集成](openclaw-integration.md)，实现与助手的远程对话。
 2. [启用网页搜索](openclaw-web-access.md)，使助手能够访问实时互联网信息。
 3. [安装技能和插件](openclaw-skills.md)，进一步扩展助手的能力。
+4. [使用 Openclaw 移动客户端连接](openclaw-mobile.md)，通过 LarePass VPN 扫码或手动配对。
 
 ## 故障排除和常见问题
 
```

---

### Incident Patch 4: `77653bee` (2026-09-29)
**Commit Message**: docs: add Wake-on-LAN guide for Olares One (#4198)

* docs: add Wake-on-LAN guide for Olares One

* docs: clarify Wake-on-LAN sender steps

* docs: expand Wake-on-LAN setup and Windows guidance

* docs: finalize Wake-on-LAN navigation and download link

**File**: `docs/.vitepress/one.en.ts` (modified, +4/-0)
```diff
@@ -177,6 +177,10 @@ export const oneSidebar: DefaultTheme.Sidebar = {
               }
             ]
         },                
+        {
+          text: "Set up Wake-on-LAN",
+          link: "/one/wake-on-lan",
+        },
       ]
     },
     {
```

**File**: `docs/.vitepress/one.zh.ts` (modified, +4/-0)
```diff
@@ -177,6 +177,10 @@ export const oneSidebar: DefaultTheme.Sidebar = {
               }
             ]
         },                 
+        {
+          text: "设置网络唤醒",
+          link: "/zh/one/wake-on-lan",
+        },
       ]
     },
     {
```

**File**: `docs/one/faq.md` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ Support for common out-of-band management capabilities on Olares One is as follo
 - **Automatic startup**: Supported. Olares One can start automatically when AC power is connected or restored after a power outage.
   - On Olares OS, this feature requires Olares OS 1.12.6 or later and EC firmware 1.03 or later. See [Manage hardware settings](hardware-settings.md#set-automatic-startup).
   - On Ubuntu, configure the setting from the command line. See **Configure automatic startup** in the [Ubuntu Server](install-ubuntu-server.md#configure-automatic-startup) or [Ubuntu Desktop](install-ubuntu-desktop.md#configure-automatic-startup) installation guide.
-- **Wake-on-LAN (WOL)**: Supported on Olares One running Ubuntu or Windows.
+- **Wake-on-LAN (WOL)**: Supported on Olares One running Olares OS, Ubuntu, or Windows, with EC firmware 1.01 or later and a wired network connection. For setup and wake-up instructions on the same local network, see [Set up Wake-on-LAN for Olares One](wake-on-lan.md). The Windows steps cover waking from sleep.
 - **Remote KVM**: Not supported.
 - **IPMI**: Not supported.
 
```

**File**: `docs/one/wake-on-lan.md` (added, +251/-0)
```diff
@@ -0,0 +1,251 @@
+---
+outline: [2, 3]
+description: Configure Wake-on-LAN on Olares One running Olares OS, Ubuntu, or Windows, then wake it from a phone, Linux, macOS, or Windows device on the same local network.
+head:
+  - - meta
+    - name: keywords
+      content: Olares One, Olares OS, Ubuntu, Windows, Wake-on-LAN, WOL, Magic Packet
+---
+
+# Set up Wake-on-LAN for Olares One
+
+Wake-on-LAN (WOL) lets you wake Olares One by sending a Magic Packet from another device on the same local network. This guide applies to Olares One running Olares OS, Ubuntu, or Windows. It explains how to configure the device and send the packet from a phone, Linux, macOS, or Windows computer.
+
+:::info Local network only
+This guide covers waking Olares One from the same local network. Waking it over the internet requires additional router and security configuration and is not covered here.
+:::
+
+## Before you begin
+
+- Olares One is running Olares OS, Ubuntu, or Windows.
+- Olares One is connected to your router through its Ethernet port. Wake-on-LAN does not work over its Wi-Fi connection.
+- You have an administrator account on Olares One.
+- A phone or computer is connected to the same local network as Olares One.
+- EC firmware is version 1.01 or later. To check or update the version, see [Manage BIOS and EC](update-firmware.md).
+
+## Configure Wake-on-LAN on Olares One
+
+Choose the setup instructions for the operating system running on Olares One.
+
+### Olares OS or Ubuntu
+
+Use the same steps whether Olares One runs the preinstalled Olares OS or an Ubuntu installation. Run the following commands in the host terminal as `root` or with an account that has `sudo` permission.
+
+#### Find the network interface and addresses
+
+1. Make sure the Ethernet cable is connected to Olares One and your router.
+2. Open the host terminal on Olares One. On Olares OS, you can use the [Olares terminal in Control Hub](access-terminal-control-hub.md). On Ubuntu, open a terminal on the device or connect through SSH.
+3. Run the following command:
+
+   ```bash
+   ip address
+   ```
+
+4. Find the wired interface. Its name usually starts with `en`, such as `enp129s0`.
+5. Record these values for the wired interface:
+
+   - **Interface name**: The name shown at the beginning of the interface entry.
+   - **MAC address**: The value after `link/ether`.
+   - **IPv4 address**: The value after `inet`, without the subnet suffix. For example, record `192.168.0.92` from `192.168.0.92/23`.
+   - **Subnet broadcast address**: The value after `brd` on the `inet` line.
+
+   For example, the following line shows the IPv4 address `192.168.0.92` and subnet broadcast address `192.168.1.255`:
+
+   ```text
+   inet 192.168.0.92/23 brd 192.168.1.255 scope global dynamic enp129s0
+   ```
+
+   These addresses are examples. Use the values shown on your own device.
+
+#### Check the Wake-on-LAN status
+
+1. Install `ethtool`:
+
+   ```bash
+   sudo apt update
+   sudo apt install ethtool -y
+   ```
+
+2. Check the current Wake-on-LAN status. Replace `<network-interface>` with the wired interface name you recorded earlier.
+
+   ```bash
+   sudo ethtool <network-interface> | grep Wake-on
+   ```
+
+3. Check that the output contains `g` in **Supports Wake-on** and shows `Wake-on: g`:
+
+   ```text
+   Supports Wake-on: pumbg
+   Wake-on: g
+   ```
+
+   The `g` value means the interface can wake the device when it receives a Magic Packet.
+
+4. If **Supports Wake-on** contains `g` but **Wake-on** is set to another value, enable Magic Packet wake-up:
+
+   ```bash
+   sudo ethtool --change <network-interface> wol g
+   ```
+
+5. Run the status command again and check that it now shows `Wake-on: g`.
+
+:::tip Setting resets after a restart
+Some network configurations reset the Wake-on-LAN setting during startup. If Olares One stops responding to Magic Packets after a restart, check the status again and re-enable it before suspending or shutting down the device.
+:::
+
+#### Suspend or shut down Olares One
+
+Keep Olares One connected to AC power and Ethernet. Then use one of the following commands.
+
+- Suspend Olares One:
+
+  ```bash
+  sudo systemctl suspend
+  ```
+
+- Shut down Olares One:
+
+  ```bash
+  sudo shutdown -h now
+  ```
+
+Start with suspend if this is your first time using Wake-on-LAN. Some network environments or power settings might not support waking from a full shutdown.
+
+### Windows
+
+Follow these steps to wake Olares One running Windows from sleep.
+
+1. On Olares One, open **Device Manager**, expand **Network adapters**, right-click the wired Ethernet adapter, and select **Properties**.
+2. On the **Power Management** tab, select **Allow this device to wake the computer**, and click **OK**.
+3. Press `Win + R`, enter `ncpa.cpl`, and press Enter. Double-click the active **Ethernet** connection, click **Details**, and record:
+   - **Physical Address**: The wired interface MAC address.
+   - **IPv4 Address** and **IPv4 Su
```

**File**: `docs/zh/one/faq.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ Olares One 对常见带外管理功能的支持情况如下：
 - **自动开机**：支持。接通电源或停电后恢复供电时，Olares One 可以自动开机。
   - 使用 Olares OS 时，需要 Olares OS 1.12.6 或更高版本以及 EC 固件 1.03 或更高版本。操作方法请参阅[管理硬件设置](hardware-settings.md#设置自动开机)。
   - 使用 Ubuntu 时，需要通过命令行完成配置。操作方法请参阅 [Ubuntu Server](install-ubuntu-server.md#配置自动开机) 或 [Ubuntu Desktop](install-ubuntu-desktop.md#配置自动开机) 安装指南中的**配置自动开机**章节。
-- **局域网唤醒（WOL）**：安装 Ubuntu 或 Windows 的 Olares One 支持此功能。
+- **网络唤醒（WOL）**：运行 Olares OS、Ubuntu 或 Windows 的 Olares One 支持此功能，需要 EC 固件不低于 1.01，并使用有线网络连接。同一局域网内的配置和唤醒方法，请参阅[为 Olares One 设置网络唤醒](wake-on-lan.md)。其中 Windows 步骤适用于从睡眠状态唤醒。
 - **远程 KVM**：不支持。
 - **IPMI**：不支持。
 
```

**File**: `docs/zh/one/wake-on-lan.md` (added, +251/-0)
```diff
@@ -0,0 +1,251 @@
+---
+outline: [2, 3]
+description: 在运行 Olares OS、Ubuntu 或 Windows 的 Olares One 上配置网络唤醒，并通过同一局域网中的手机、Linux、macOS 或 Windows 设备唤醒主机。
+head:
+  - - meta
+    - name: keywords
+      content: Olares One, Olares OS, Ubuntu, Windows, 网络唤醒, Wake-on-LAN, WOL, Magic Packet
+---
+
+# 为 Olares One 设置网络唤醒
+
+网络唤醒（Wake-on-LAN，WOL）可以通过同一局域网中的其他设备向 Olares One 发送魔术包，唤醒设备。本文适用于运行 Olares OS、Ubuntu 或 Windows 的 Olares One，介绍如何配置主机，以及如何通过手机、Linux、macOS 或 Windows 电脑发送唤醒包。
+
+:::info 仅限局域网
+本文仅介绍如何从同一局域网唤醒 Olares One。通过互联网唤醒设备需要额外配置路由器和安全策略，不在本文范围内。
+:::
+
+## 开始前准备
+
+- Olares One 正在运行 Olares OS、Ubuntu 或 Windows。
+- Olares One 已通过网线连接到路由器。网络唤醒不支持通过设备的 Wi-Fi 连接使用。
+- 可以使用管理员账号配置 Olares One。
+- 已准备一台与 Olares One 位于同一局域网的手机或电脑。
+- EC 固件版本不低于 1.01。检查或更新版本的方法，请参阅[管理 BIOS 和 EC](update-firmware.md)。
+
+## 在 Olares One 上配置网络唤醒
+
+根据 Olares One 上运行的系统，选择以下一种配置方法。
+
+### Olares OS 或 Ubuntu
+
+预装 Olares OS 和自行安装 Ubuntu 的设备使用相同的配置方法。以下命令需要在主机终端中以 `root` 或具有 `sudo` 权限的账号执行。
+
+#### 查找网卡名称和地址
+
+1. 确保 Olares One 已通过网线连接到路由器。
+2. 打开 Olares One 主机终端。Olares OS 用户可以使用 [Control Hub 中的 Olares 终端](access-terminal-control-hub.md)；Ubuntu 用户可以在设备上打开终端，或通过 SSH 连接。
+3. 运行以下命令：
+
+   ```bash
+   ip address
+   ```
+
+4. 找到有线网卡。网卡名称通常以 `en` 开头，例如 `enp129s0`。
+5. 记录有线网卡的以下信息：
+
+   - **网卡名称**：显示在网卡信息开头的名称。
+   - **MAC 地址**：`link/ether` 后面的值。
+   - **IPv4 地址**：`inet` 后面的值，不包含子网后缀。例如，`192.168.0.92/23` 应记录为 `192.168.0.92`。
+   - **子网广播地址**：`inet` 所在行中 `brd` 后面的值。
+
+   例如，以下输出中的 IPv4 地址为 `192.168.0.92`，子网广播地址为 `192.168.1.255`：
+
+   ```text
+   inet 192.168.0.92/23 brd 192.168.1.255 scope global dynamic enp129s0
+   ```
+
+   以上地址仅为示例，请使用自己设备上显示的值。
+
+#### 检查网络唤醒状态
+
+1. 安装 `ethtool`：
+
+   ```bash
+   sudo apt update
+   sudo apt install ethtool -y
+   ```
+
+2. 检查当前的网络唤醒状态。将 `<网卡名称>` 替换为之前记录的有线网卡名称。
+
+   ```bash
+   sudo ethtool <网卡名称> | grep Wake-on
+   ```
+
+3. 确认 **Supports Wake-on** 中包含 `g`，并且显示 `Wake-on: g`：
+
+   ```text
+   Supports Wake-on: pumbg
+   Wake-on: g
+   ```
+
+   `g` 表示网卡收到魔术包后可以唤醒设备。
+
+4. 如果 **Supports Wake-on** 包含 `g`，但 **Wake-on** 显示为其他值，请启用魔术包唤醒：
+
+   ```bash
+   sudo ethtool --change <网卡名称> wol g
+   ```
+
+5. 再次运行状态检查命令，确认显示 `Wake-on: g`。
+
+:::tip 重启后设置被重置
+部分网络配置会在启动时重置网络唤醒设置。如果 Olares One 重启后无法响应魔术包，请重新检查状态，并在睡眠或关机前再次启用网络唤醒。
+:::
+
+#### 让 Olares One 睡眠或关机
+
+保持 Olares One 与电源和网线连接，然后选择以下一种方式。
+
+- 让 Olares One 进入睡眠：
+
+  ```bash
+  sudo systemctl suspend
+  ```
+
+- 关闭 Olares One：
+
+  ```bash
+  sudo shutdown -h now
+  ```
+
+首次使用网络唤醒时，建议先使用睡眠模式。部分网络环境或电源设置可能不支持从完全关机状态唤醒。
+
+### Windows
+
+以下步骤用于将运行 Windows 的 Olares One 从睡眠状态唤醒。
+
+1. 在 Olares One 上打开**设备管理器**，展开**网络适配器**，右键点击有线网卡，选择**属性**。
+2. 在**电源管理**选项卡中，勾选**允许此设备唤醒计算机**，点击**确定**。
+3. 按 `Win + R`，输入 `ncpa.cpl` 并按回车。双击正在使用的**以太网**连接，然后点击**详细信息**，记录以下信息：
+   - **物理地址**：有线网卡的 MAC 地址。
+   - **IPv4 地址**和 **IPv4 子网掩码**：用于确定子网广播地址。例如，IP 地址为 `192.168.1.92`、子网掩码为 `255.255.255.0` 时，广播地址为 `192.168.1.255`。
+
+   :::details 计算子网广播地址
+   在 PowerShell 中运行以下命令，将前两行的示例值替换为刚才记录的 IPv4 地址和子网掩码：
+
+   ```powershell
+   $ipBytes = ([System.Net.IPAddress]::Parse("192.168.1.92")).GetAddressBytes()
+   $maskBytes = ([System.Net.IPAddress]::Parse("255.255.255.0")).GetAddressBytes()
+   (0..3 | ForEach-Object {
+     $ipBytes[$_] -bor ($maskBytes[$_] -bxor 255)
+   }) -join '.'
+   ```
+
+   记录输出的广播地址，发送唤醒包时使用。
+   :::
+
+4. 保持 Olares One 连接电源和网线，选择**开始** > **电源** > **睡眠**。
+
+:::info Windows 唤醒范围
+请使用睡眠模式完成此流程。能否从关机状态唤醒取决于 Windows 电源设置和硬件支持，详情请参阅 [Microsoft 的网络唤醒说明](https://learn.microsoft.com/en-us/troubleshoot/windows-client/setup-upgrade-and-drivers/wake-on-lan-feature)。
+:::
+
+## 发送魔术包唤醒 Olares One
+
+在同一局域网中的另一台设备上，选择以下一种方式发送唤醒包。使用之前记录的 Olares One 有线网卡地址。
+
+### 通过手机唤醒
+
+以下步骤以 Easy WOL 为例。也可以使用其他支持发送网络唤醒魔术包的应用。
+
+1. 将手机连接到 Olares One 所在的局域网。
+2. 安装并打开网络唤醒应用。
+3. 添加 Olares One，并输入以下信息：
+
+   - **Device Name**：输入便于识别 Olares One 的名称。
+   - **Address**：输入之前记录的 IPv4 地址。
+   - **MAC**：输入有线网卡的 MAC 地址。
+   - **Port**：输入 `9`。
+
+   ![在手机上配置网络唤醒设备](/images/one/wol-add-device.png#bordered){width=50%}
+
+4. 保存设备。需要唤醒 Olares One 时，点击已保存的设备。应用会立即发送魔术包。
+
+   ![网络唤醒包发送成功提示](/images/one/wol-packet-sent.png#bordered){width=35%}
+
+5. 等待 Olares One 启动。
+
+### 通过 Linux 唤醒
+
+1. 安装 `wakeonlan`：
+
+   ```bash
+   sudo apt update
+   sudo apt install wakeonlan -y
+   ```
+
+2. 发送魔术包。将 `<MAC 地址>` 替换为 Olares One 有线网卡的 MAC 地址。
+
+   ```bash
+   wakeonlan <MAC 地址>
+   ```
+
+   运行命令后会立即发送魔术包。等待 Olares One 启动。
+
+### 通过 macOS 唤醒
+
+1. 如果尚未安装 Homebrew，请根据 [Homebrew 官网](https://brew.sh/)的说明完成安装。
+2. 安装 `wakeonlan`：
+
+   ```bash
+   brew install wakeonlan
+   ```
+
+3. 发送魔术包。将 `<MAC 地址>` 替换为 Olares One 有线网卡的 MAC 地址。
+
+   ```bash
+   wakeonlan <MAC 地址>
+   ```
+
+   运行命令后会立即发送魔术包。等待 Olares One 启动。
+
+### 通过 Windows 唤醒
+
+以下以 Magic Packet Utility 为例，也可以使用其他支持 Wake-on-LAN 的工具。
+
+1. 在发送端 Windows 电脑上下载 [Magic Packet Utility](https://cdn.olares.com/common/magic_packet_utility.zip)，解压 `magic_packet_utility.zip`，打开 `MAGPAC.EXE`。
+2. 选择 **Magic Packets** > **Power On One Host**。
+3. 填写以下两个字段：
+   - **IP B
```

---

### Incident Patch 5: `182ec70b` (2026-09-28)
**Commit Message**: docs: update 1.12.7 documentation highlights and retire Ollama guide (#4191)

* docs: add documentation highlights for Olares 1.12.7

* docs: remove editing details from documentation highlights

* docs: add pending 1.12.7 release notes link to release list

* docs: retire standalone Ollama guide and redirect to Engine Base

* docs: publish 1.12.7 release links and upgrade guidance

* docs: update available ISO downloads to 1.12.7

* docs: update Olares One ISO links to 1.12.7

**File**: `docs/.vitepress/_redirects.nginx` (modified, +2/-0)
```diff
@@ -57,6 +57,8 @@ location = /zh/space/host-domain { return 301 /zh/manual/space/host-domain; }
 location = /zh/manual/space/ { return 301 /zh/manual/space/manage-accounts; }
 location = /use-cases/deerflow { return 301 /use-cases/deerflow2; }
 location = /zh/use-cases/deerflow { return 301 /zh/use-cases/deerflow2; }
+location = /use-cases/ollama { return 301 /use-cases/llm-base-apps; }
+location = /zh/use-cases/ollama { return 301 /zh/use-cases/llm-base-apps; }
 location = /use-cases/ace-step { return 301 /use-cases/ace-step-1.5; }
 location = /zh/use-cases/ace-step { return 301 /zh/use-cases/ace-step-1.5; }
 location = /use-cases/openwebui-ollama { return 301 /use-cases/openwebui; }
```

**File**: `docs/.vitepress/data/useCases.ts` (modified, +0/-1)
```diff
@@ -68,7 +68,6 @@ export const useCases: UseCase[] = [
   { title: "Whisper-WebUI", link: "/use-cases/whisper-webui", category: "Creative media", description: "Speech-to-text, subtitles, and translation", descriptionZh: "语音转文字、字幕生成与翻译" },
   { title: "Speaches", link: "/use-cases/speaches", category: "Creative media", description: "Speech-to-text, text-to-speech, and voice chat", descriptionZh: "语音转文字、文字转语音与语音对话" },
   { title: "IndexTTS2", link: "/use-cases/indextts2", category: "Creative media", description: "Text-to-speech with zero-shot voice cloning", descriptionZh: "支持零样本声音克隆的文字转语音" },
-  { title: "Ollama", link: "/use-cases/ollama", category: "Model services", description: "Download and run local AI models", descriptionZh: "下载并运行本地 AI 模型" },
   { title: "Bifrost", link: "/use-cases/bifrost", category: "Model services", description: "AI gateway that aggregates models behind one endpoint", descriptionZh: "将多个模型聚合到单一端点的 AI 网关" },
   { title: "LiteLLM", link: "/use-cases/litellm", category: "Model services", description: "Unify model providers behind one OpenAI-compatible API", descriptionZh: "用统一的 OpenAI 兼容 API 整合多家模型提供商" },
   { title: "TensorZero", link: "/use-cases/tensorzero", category: "Model services", description: "AI model gateway and observability platform", descriptionZh: "AI 模型网关与可观测性平台" },
```

**File**: `docs/.vitepress/theme/redirects.ts` (modified, +4/-0)
```diff
@@ -70,6 +70,10 @@ export const redirects = {
     '/use-cases/deerflow': '/use-cases/deerflow2',
     '/zh/use-cases/deerflow': '/zh/use-cases/deerflow2',
 
+    // Retired: standalone Ollama guide → Engine Base apps
+    '/use-cases/ollama': '/use-cases/llm-base-apps',
+    '/zh/use-cases/ollama': '/zh/use-cases/llm-base-apps',
+
     // Rename: ace-step → ace-step-1.5 (permanent: old name is retired)
     '/use-cases/ace-step': '/use-cases/ace-step-1.5',
     '/zh/use-cases/ace-step': '/zh/use-cases/ace-step-1.5',
```

**File**: `docs/.vitepress/usecase.en.ts` (modified, +0/-4)
```diff
@@ -278,10 +278,6 @@ export const useCaseSidebar: DefaultTheme.Sidebar = {
               text: "Model services",
               collapsed: true,
               items: [
-                {
-                  text: "Ollama",
-                  link: "/use-cases/ollama",
-                },
                 {
                   text: "Bifrost",
                   link: "/use-cases/bifrost",
```

**File**: `docs/.vitepress/usecase.zh.ts` (modified, +0/-4)
```diff
@@ -278,10 +278,6 @@ export const useCaseSidebar: DefaultTheme.Sidebar = {
               text: "模型服务",
               collapsed: true,
               items: [
-                {
-                  text: "Ollama",
-                  link: "/zh/use-cases/ollama",
-                },
                 {
                   text: "Bifrost",
                   link: "/zh/use-cases/bifrost",
```

**File**: `docs/manual/best-practices/install-olares-gpu-passthrough.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ Make sure you have:
 - **RAM**: Recommended 16 GB or more
 - **Storage**: Minimum 200 GB SSD (installation may fail on HDD)
 - **PVE version**: 8.3.2
-- **Olares ISO image**: Download the [official Olares ISO image](https://cdn.olares.com/olares-v1.12.6-amd64.iso)
+- **Olares ISO image**: Download the [official Olares ISO image](https://cdn.olares.com/olares-v1.12.7-amd64.iso)
 
 ## Configure GPU passthrough in PVE
 
```

**File**: `docs/manual/get-started/install-linux-iso.md` (modified, +2/-2)
```diff
@@ -21,12 +21,12 @@ This ISO is for self-hosted x86-64 hardware. For Olares One, follow the [Olares
 - **Processor**: Intel or AMD x86-64. ARM is not supported.
 <!--@include: ./reusables.md#larepass-prerequisite-->
 - **Network**: A wired LAN connection.
-- **USB flash drive**: At least 8 GB of capacity.
+- **USB flash drive**: At least 16 GB of capacity.
 - **Setup computer**: A Windows, macOS, or Linux computer for creating the bootable USB drive.
 
 ## Create a bootable USB drive
 
-1. Download the [latest Olares ISO image for self-hosted hardware](https://cdn.olares.com/olares-v1.12.6-amd64.iso).
+1. Download the [latest Olares ISO image for self-hosted hardware](https://cdn.olares.com/olares-v1.12.7-amd64.iso).
 2. Download and install [**Balena Etcher**](https://etcher.balena.io/).
 3. Insert the USB flash drive into your computer.
 4. Launch Etcher and follow these steps:
```

**File**: `docs/manual/get-started/install-pve-iso.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ To use the GPU within Olares on PVE, you must configure GPU passthrough first. R
 <!--@include: ./reusables.md#larepass-prerequisite-->
 
 ## Download Olares ISO image
-Download [the latest official Olares ISO image](https://cdn.olares.com/olares-v1.12.6-amd64.iso).
+Download [the latest official Olares ISO image](https://cdn.olares.com/olares-v1.12.7-amd64.iso).
 
 ## Configure VM in PVE
 
```

---

### Incident Patch 6: `a112d280` (2026-09-28)
**Commit Message**: docs: fix prose and hide blurry Router screenshots (#4193)

docs: clean up prose and hide blurry Router screenshots

**File**: `docs/reusables/README.md` (modified, +1/-1)
```diff
@@ -17,4 +17,4 @@ Use stable, descriptive region names so source line changes do not break referen
 - **sync-files.md**: Sync files to local (intro, Create a library, Enable synchronization, Manage synchronization). Used by `manual/larepass/manage-files.md` and `manual/olares/files/sync-files.md`.
 - **export-system-logs.md**: Steps to export system logs via Settings > Advanced > Logs. Used by `manual/help/request-technical-support.md`.
 - **custom-domain.md**: Custom domain setup procedures (Create DID, Add domain with TXT/NS verification, Create organization, Add user, Join organization). Used by `manual/best-practices/set-custom-domain.md`, `manual/larepass/create-org-account.md`, `manual/space/host-domain.md`, and `manual/space/manage-domain.md`.
-- **ai-service-connections.md**: Reusable explanations and steps for connecting AI clients to models or apps. Use `model-connection-overview` and `get-model-connection-details` when connecting a standalone model on Olares; use `app-endpoint-overview` when connecting another Olares app through its endpoint.
+- **ai-service-connections.md**: Reusable explanations and steps for connecting AI clients to models or apps. Use `model-connection-overview` and `get-model-connection-details` when connecting a standalone model on Olares. Use `app-endpoint-overview` when connecting another Olares app through its endpoint.
```

**File**: `docs/reusables/ai-service-connections.md` (modified, +10/-10)
```diff
@@ -17,13 +17,13 @@ This guide uses Qwen3.8-27B (llama.cpp) as the default chat model. For connectio
 1. Open Router from Launchpad. On **Default models**, set Qwen3.8-27B (llama.cpp) as the default chat model.
 2. Go to **LLM**, find Qwen3.8-27B (llama.cpp), and click **View connection example** on its row.
 
-   ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered)
+   <!-- ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered) -->
 
 3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, including `/v1`.
 
-   ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered)
+   <!-- ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered) -->
 
-4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key; leave the key empty where possible, or use `olares` if the client requires a value.
+4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key. Leave the key empty where possible, or use `olares` if the client requires a value.
 
    `default-chat` is a routing name and is not returned by the model-list API. Add it manually if the client fetches a model list. If the client only supports selecting a listed model, use the full model name from Router instead.
 <!-- #endregion get-model-connection-details -->
@@ -46,13 +46,13 @@ When a client connects to another Olares app, it uses that app's endpoint as the
 1. Open Router from Launchpad. On **Default models**, set Qwen3.8-27B (llama.cpp) as the default chat model.
 2. Go to **LLM**, find Qwen3.8-27B (llama.cpp), and click **View connection example** on its row.
 
-   ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered)
+   <!-- ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered) -->
 
-3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, then remove the trailing `/v1` for the Anthropic-compatible client. For example, use `https://router.<your-olares-domain>`; the client appends `/v1/messages`.
+3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, then remove the trailing `/v1` for the Anthropic-compatible client. For example, use `https://router.<your-olares-domain>`. The client appends `/v1/messages`.
 
-   ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered)
+   <!-- ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered) -->
 
-4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key; leave the key empty where possible, or use `olares` if the client requires a value.
+4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key. Leave the key empty where possible, or use `olares` if the client requires a value.
 
    `default-chat` is a routing name and is not returned by the model-list API. Add it manually if the client fetches a model list. If the client only supports selecting a listed model, use the full model name from Router instead.
 <!-- #endregion get-model-connection-details-anthropic -->
@@ -61,9 +61,9 @@ When a client connects to another Olares app, it uses that app's endpoint as the
 1. Open Router from Launchpad and go to **Tools**. Find the installed embedding model and wait until it shows **Callable**.
 2. On its model row, click **View connection example**.
 3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, including `/v1`.
-4. Copy the full **Model name** from this window, including the `Olares/` prefix, and use it in the client's embedding settings. Apps in Olares do not need a Router API key; use `olares` only if the client requires a value.
+4. Copy the full **Model name** from this window, including the `Olares/` prefix, and use it in the client's embedding settings. Apps in Olares do not need a Router API key. Use `olares` only if the client requires a value.
 
-Use the embedding model's name, not `default-chat`. Keep the same embedding model when querying an existing knowledge base; changing it can require reindexing your documents.
+Use the embedding model's name, not `default-chat`. Keep the same embedding model when querying an existing knowledge base. Changing it can require reindexing your documents.
 <!-- #endregion get-embedding-model-connection-details-openai -->
 
 <!-- #region model-context-window -->
@@ -75,7 +75,7 @@ Use the embedding model's name, not `default-chat`. Keep the same embedding mode
 
    ![Read the exact llama.cpp context size in Router 
```

**File**: `docs/reusables/local-domain.md` (modified, +3/-3)
```diff
@@ -36,7 +36,7 @@ On Windows and macOS, LarePass Desktop can configure direct LAN access for the c
 3. Start the update from either location:
    - Click **Map hosts** in the lower-left corner.
    - Click your avatar, go to **Settings** > **Host mappings**, and click **Enable**.
-4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`; LarePass uses these markers to manage the entries. When you finish, click **Update**.
+4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`. LarePass uses these markers to manage the entries. When you finish, click **Update**.
 5. Enter the administrator password for your computer and confirm the change.
 6. Wait for the **Success** message.
 
@@ -60,7 +60,7 @@ On Windows, use LarePass Desktop to add the required entries to the hosts file s
 3. Start the update from either location:
    - Click **Map hosts** in the lower-left corner.
    - Click your avatar, go to **Settings** > **Host mappings**, and click **Enable**.
-4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`; LarePass uses these markers to manage the entries. When you finish, click **Update**.
+4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`. LarePass uses these markers to manage the entries. When you finish, click **Update**.
 5. Enter the administrator password for your computer and confirm the change.
 <!-- #endregion windows-local-domain -->
 
@@ -78,7 +78,7 @@ LarePass VPN and host mappings are mutually exclusive. Turn off **VPN connection
 3. Start the update from either location:
    - Click **Map hosts** in the lower-left corner.
    - Click your avatar, go to **Settings** > **Host mappings**, and click **Enable**.
-4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`; LarePass uses these markers to manage the entries. When you finish, click **Update**.
+4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`. LarePass uses these markers to manage the entries. When you finish, click **Update**.
 5. When the password prompt appears, enter the administrator password for your computer and confirm the change.
 6. Wait for the **Success** message.
 
```

**File**: `docs/use-cases/claude-code.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ Use this method to run Claude Code locally. This example uses the model app **Qw
 5. Open Olares Settings, and then go to **Applications** > **Claude Code** > **Manage environment variables**.
 6. Specify the following environment variables:
 
-   - **ANTHROPIC_AUTH_TOKEN**: Enter any text, such as `local`. Router identifies this Olares app through the platform; Claude Code still requires a non-empty token field.
+   - **ANTHROPIC_AUTH_TOKEN**: Enter any text, such as `local`. Router identifies this Olares app through the platform. Claude Code still requires a non-empty token field.
    - **ANTHROPIC_BASE_URL**: Enter the **Base URL** you copied from Router. For example, `https://router.<your-olares-domain>`.
    - **ANTHROPIC_MODEL**: Enter `default-chat`.
 
```

**File**: `docs/use-cases/hermes.md` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ Run a quick setup to connect Hermes Agent to your local model.
     | Use this model? [Y/n] — only when one model is detected | Enter `n`. At the following **Model name** prompt, enter `default-chat`. This confirmation accepts yes/no, not a model name. |
     | Select model [1-N] or type name — only when multiple models are detected | Type `default-chat` instead of selecting a numbered model. |
     | Model name — when no model is detected | Enter `default-chat`. |
-    | Context length in tokens | Enter the exact context size from Router's **Model card > Engine args**, such as `104448` for `-c 104448`. Hermes requires at least `65536` tokens; the value must not exceed the engine configuration. |
+    | Context length in tokens | Enter the exact context size from Router's **Model card > Engine args**, such as `104448` for `-c 104448`. Hermes requires at least `65536` tokens. The value must not exceed the engine configuration. |
     | Display name |  Enter a name to identify this model, such as `router-chat`.|
     | Select terminal backend | Select **Local - run directly on this machine**. |
     | Select platforms to configure | Press **ESC** to skip for now. |
```

**File**: `docs/use-cases/karakeep.md` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ This guide uses the pre-built Qwen3.8-27B (llama.cpp) model app from Market.
 
 1. Open **Settings** > **Applications** > **Karakeep** > **Manage environment variables** and configure:
 
-   - **OPENAI_API_KEY**: Enter `olares`. Karakeep requires a non-empty value to enable this provider; Router identifies the Olares app through the platform.
+   - **OPENAI_API_KEY**: Enter `olares`. Karakeep requires a non-empty value to enable this provider. Router identifies the Olares app through the platform.
    - **OLLAMA_BASE_URL**: Clear this field to stop using the old Ollama connection.
    - **INFERENCE_TEXT_MODEL**: Enter `default-chat`.
    - **INFERENCE_IMAGE_MODEL**: Leave empty for text-only tagging. For image tagging, enter the full Router name of a vision-capable model.
```

**File**: `docs/use-cases/llm-base-apps.md` (modified, +3/-3)
```diff
@@ -161,11 +161,11 @@ To change engine arguments, use **Edit** in the model card. Saving changed argum
 
 On Olares 1.12.7 and later, clients connect to your model instance through Router. Router provides the client-facing URL, model name, and access controls.
 
-1. Open Router from Launchpad. Find your chat model on **LLM**. Before sending a request, confirm that it shows **Callable**; if it is unavailable, check the reason shown below its status.
-2. On **Default models**, select the instance as the default chat model. The app tutorials use Qwen3.8-27B (llama.cpp); you can select the chat instance you created here instead.
+1. Open Router from Launchpad. Find your chat model on **LLM**. Before sending a request, confirm that it shows **Callable**. If it is unavailable, check the reason shown below its status.
+2. On **Default models**, select the instance as the default chat model. The app tutorials use Qwen3.8-27B (llama.cpp). You can select the chat instance you created here instead.
 3. Return to the model row and click **View connection example**. Select **Apps in Olares** for an installed client, then copy the **Base URL**, including `/v1`.
 
-   ![Copy the Router connection details](/images/manual/use-cases/router-how-to-call-model.png#bordered)
+   <!-- ![Copy the Router connection details](/images/manual/use-cases/router-how-to-call-model.png#bordered) -->
 
 4. Follow [Connect OpenCode to a custom provider](opencode.md#connect-to-a-custom-provider). Use the Router Base URL and add `default-chat` as the model ID. To keep the client on this instance regardless of the default model setting, use its full **Model name** from Router instead.
 5. Send a short message in OpenCode. In Router, check **Usage** to confirm that the request reached the intended model.
```

**File**: `docs/use-cases/nofx.md` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ Before connecting a local model, you need:
 
    - **API Key**: Enter any text string such as `local`.
    - **Base URL**: Enter the **Base URL** copied from Router. Ensure the URL ends with `/v1`.
-   - **Model Name (Optional)**: 填写 `default-chat`。
+   - **Model Name (Optional)**: Enter `default-chat`.
 
 8. Click **Save Configuration**.
 
```

---

### Incident Patch 7: `e4a353df` (2026-09-22)
**Commit Message**: market(fix): preinstall replay skipped catalog updates (#4182)

**File**: `framework/market/.olares/config/cluster/deploy/market_deploy.yaml` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ spec:
           name: check-appservice
       containers:
       - name: appstore-backend
-        image: beclab/market-backend:v0.6.123
+        image: beclab/market-backend:v0.6.125
         imagePullPolicy: IfNotPresent
         ports:
           - containerPort: 81
```

---

### Incident Patch 8: `5814018e` (2026-09-22)
**Commit Message**: docs: update Jellyfin hardware acceleration guide for Olares 1.12.7 (#4180)

update jellyfin guide

**File**: `docs/use-cases/jellyfin.md` (modified, +57/-32)
```diff
@@ -5,9 +5,9 @@ head:
   - - meta
     - name: keywords
       content: Olares, Jellyfin, jellyfin vs plex, plex alternative, self-hosted media server, jellyfin remote access, DLNA, jellyfin on olares
-app_version: "1.0.19"
-doc_version: "1.2"
-doc_updated: "2026-07-28"
+app_version: "1.0.35"
+doc_version: "1.3"
+doc_updated: "2026-09-22"
 ---
 
 # Build your private media server with Jellyfin
@@ -57,10 +57,24 @@ With your media ready, install Jellyfin and complete its setup wizard.
 ### Install Jellyfin
 
 1. Open Market and search for "Jellyfin".
+2. Click **Get**, click **Install**.
+3. In the **Choose a hardware accelerator** dialog, select the option that matches your hardware and Olares version:
+   - **Olares 1.12.7 or later**:
+      - Select **Intel** for an Intel integrated GPU.
+      - Select **AMD** for an AMD integrated GPU.
+      - Select **CPU** if you do not need hardware-accelerated transcoding.
+   - **Olares 1.12.6**: Select **CPU**. The Intel and AMD modes require the hardware acceleration support introduced in Olares 1.12.7, even if they appear in the dialog. To use the legacy hardware acceleration setup, see [Legacy hardware acceleration on Olares 1.12.6](#legacy-hardware-acceleration-on-olares-1126).
+4. Click **Confirm**, then wait for the installation to complete.
+
+:::info Already have Jellyfin installed?
+Upgrading Jellyfin does not change the accelerator selected for the existing installation.
+
+If you do not need hardware acceleration, upgrade Jellyfin normally. To enable hardware acceleration on Olares 1.12.7 or later, uninstall and reinstall Jellyfin, then select **Intel** or **AMD** in the accelerator dialog.
+:::
 
-   ![Install Jellyfin](/images/manual/use-cases/jellyfin-install.png#bordered)
-
-2. Click **Get**, then click **Install**, and wait for the installation to complete.
+:::warning Keep your Jellyfin data
+In the **Uninstall Jellyfin?** dialog, clear the **Also remove all local data** checkbox before clicking **Uninstall**. This checkbox is selected by default. Keeping the local data preserves your media libraries, users, settings, plugins, and other configuration for reinstallation.
+:::
 
 ### Complete the initial setup
 
@@ -93,44 +107,55 @@ With Jellyfin installed and running, the next step is to tell it where your medi
 
 Once saved, Jellyfin will automatically scan your folders and begin building your library. This process may take several minutes, depending on the size of your collection.
 
-## Enable hardware acceleration for transcoding 
+## Enable hardware acceleration for transcoding
 
 Hardware acceleration reduces CPU usage when Jellyfin needs to transcode video. Transcoding may be required when the client does not support the original format, the resolution or bitrate must be reduced, HDR content must be converted to SDR, or subtitles need to be burned into the video.
 
 Jellyfin still prioritizes Direct Play and Remux. Hardware acceleration is used only when transcoding is required.
 
+If you selected the **Intel** or **AMD** accelerator when installing Jellyfin:
 
-To enable Intel Quick Sync Video (QSV) on Olares One:
-
-1. In Olares Market, update Jellyfin to version 1.0.21 or later.
-2. Navigate to **Settings** > **Applications** > **Jellyfin** > **Manage Environment Variables**.
-   - Set `ENABLE_HW_ACCEL` to `true`.
-   - Set `VIDEO_GID` to `44`, and `RENDER_GID` to `994`. These GID values are the defaults for Olares One. 
-   On other devices, open Olares terminal from **Control Hub** and run:
-      ```bash
-      getent group video
-      getent group render
-      ls -ln /dev/dri
-      ```
-    ![Get GID](/images/manual/use-cases/jellyfin-gid.png#bordered){width=90%}
-3. Save the changes. Olares automatically restarts Jellyfin.
+1. In the Jellyfin **Dashboard**, go to **Playback** > **Transcoding**.
+2. Under **Hardware acceleration**, select the option that matches your integrated GPU:
+   - For **Intel**, select **Intel Quicksync (QSV)**.
+   - For **AMD**, select **Video Acceleration API (VAAPI)**.
+3. Select the codecs supported by your GPU. For example, enable hardware encoding for `H264`, `HEVC`, and `HEVC 10bit` if your hardware supports them.
+4. Keep the other options at their default values, then save the changes.
 
-4. In the Jellyfin **Dashboard**, go to **Playback** > **Transcoding**.
-5. Under **Hardware acceleration**, select the appropriate options based on your Olares device's hardware. For example, on Olares One:
-   - Select **Intel QuickSync (QSV)**.
-   - Enable hardware coding for `H264`, `HEVC`, and `HEVC 10bit`. 
-   - Keep the other options at their default values. 
+Hardware capabilities vary by device. For supported acceleration methods and configuration details, refer to the official [Jellyfin hardware acceleration documentation](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/).
 
-Hardware capabilities vary by device. For configuration details, refer to the official [Jellyfi
```

**File**: `docs/zh/use-cases/jellyfin.md` (modified, +55/-27)
```diff
@@ -5,6 +5,9 @@ head:
   - - meta
     - name: keywords
       content: Olares, Jellyfin, jellyfin vs plex, plex alternative, self-hosted media server, jellyfin remote access, DLNA, jellyfin on olares
+app_version: "1.0.35"
+doc_version: "1.3"
+doc_updated: "2026-09-22"
 ---
 # 使用 Jellyfin 构建你的私人媒体服务器
 
@@ -53,10 +56,25 @@ Jellyfin 是一款强大的开源媒体服务器软件，让你完全掌控自
 ### 安装 Jellyfin
 
 1. 打开 Market，搜索 "Jellyfin"。
+2. 点击 **Get**，然后点击 **Install**。
 
-   ![安装 Jellyfin](/images/manual/use-cases/jellyfin-install.png#bordered)
+3. 在 **Choose a hardware accelerator** 弹窗中，根据硬件和 Olares 版本选择加速器：
+   - **Olares 1.12.7 及更高版本**:
+      - 如果使用 Intel 核显，选择 **Intel**。
+      - 如果使用 AMD 核显，选择 **AMD**。
+      - 如果不需要硬件加速转码，选择 **CPU** 。
+   - **Olares 1.12.6**: 选择 **CPU**。 即使对话框中显示 Intel 和 AMD 模式，也无法使用，因为这些模式依赖 Olares 1.12.7 引入的硬件加速支持。 如需使用旧版硬件加速方案，可参阅[旧版设置方法](#legacy-hardware-acceleration-on-olares-1126)。
+4. 点击 **Confirm**，等待安装完成。
 
-2. 点击**获取**，然后点击**安装**，等待安装完成。
+:::info 已安装 Jellyfin？
+升级 Jellyfin 不会改变现有安装所选的加速器。
+
+如果不需要硬件转码，可以正常升级。若要在 Olares 1.12.7 或更高版本启用硬件转码，请卸载并重新安装 Jellyfin，然后在加速器弹窗中选择 **Intel** 或 **AMD**。
+:::
+
+:::warning 保留 Jellyfin 数据
+在 **Uninstall Jellyfin?** 弹窗中，先取消勾选 **Also remove all local data**，再点击 **Uninstall**。该选项默认已勾选。保留本地数据后，重新安装时仍可使用原有的媒体库、用户、设置、插件和其他配置。
+:::
 
 ### 完成初始设置
 
@@ -95,38 +113,48 @@ Jellyfin 安装并运行后，下一步是告诉它你的媒体存储在哪里
 
 Jellyfin 仍会优先使用 Direct Play 或 Remux，仅在需要转码时使用硬件加速。
 
-下面以在 Olares One 设备上启用 Intel QSV 硬件加速为例，介绍具体操作步骤：
-
-1. 在 Olares Market 中将 Jellyfin 更新至 1.0.21 或更高版本。
-2. 进入 **设置** > **应用** > **Jellyfin** > **管理环境变量**。
-   - 将 `ENABLE_HW_ACCEL` 变量设置为 `true`；
-   - 将 `VIDEO_GID` 设置为 `44`，将 `RENDER_GID` 设置为 `994`。这些是 Olares One 的默认 GID 值。
-   在其他设备上，从**控制面板**打开 Olares 终端并运行：
-      ``` bash
-      getent group video
-      getent group render
-      ls -ln /dev/dri
-      ```
-
-    ![获取 GID](/images/manual/use-cases/jellyfin-gid.png#bordered){width=90%}
-
-3. 保存更改。Olares 会自动重启 Jellyfin。
+如果安装 Jellyfin 时选择了 **Intel** 或 **AMD** 加速器，请按以下步骤配置：
 
-4. 在 Jellyfin **Dashboard** 中，进入 **Playback** > **Transcoding**。
-5. 在 **Hardware acceleration** 选项下，根据Olares 设备的硬件配置选择相应选项。例如，在 Olares One 上：
-   - 选择 **Intel QuickSync (QSV)**。
-   - 为 `H264`、`HEVC`、`HEVC 10bit` 启用硬件解码。
-   - 其余选项保持默认设置。
+1. 在 Jellyfin **Dashboard** 中，进入 **Playback** > **Transcoding**。
+2. 在 **Hardware acceleration** 下选择与核显对应的选项：
+   - **Intel**：选择 **Intel Quicksync (QSV)**。
+   - **AMD**：选择 **Video Acceleration API (VAAPI)**。
+3. 根据 GPU 的支持情况选择编解码格式。例如，如果硬件支持，可为 `H264`、`HEVC` 和 `HEVC 10bit` 启用硬件编码。
+4. 其他选项保持默认设置，然后保存更改。
 
-不同设备支持的硬件功能可能有所不同。更多详细配置请参考 Jellyfin 官方[转码文档](https://jellyfin.org/docs/general/post-install/transcoding/)。
+不同设备支持的硬件功能可能有所不同。有关支持的加速方式和配置详情，请参阅 Jellyfin 官方[硬件加速文档](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/)。
 
-   ![启用转码](/images/manual/use-cases/jellyfin-transcoding.png#bordered){width=90%}
+![启用转码](/images/manual/use-cases/jellyfin-transcoding.png#bordered){width=90%}
 
 :::tip 最佳实践
 对于家庭影院，建议使用支持 HEVC Main 10、HDR10、SRT 字幕及常见音频格式的电视或播放器，让 Jellyfin 尽可能使用 Direct Play。硬件加速转码主要用于解决格式兼容问题，或改善远程及带宽受限网络下的播放体验，不应替代 Direct Play。
 :::
-:::warning 设备访问权限
-启用 `ENABLE_HW_ACCEL` 后，Jellyfin 将获得访问主机 `/dev/dri` 图形设备的额外权限。仅在需要硬件加速时启用此选项。
+:::info 同时装有核显和 NVIDIA 独显的主机
+如果主机同时装有核显和 NVIDIA 独显，Jellyfin 进行硬件转码时只能访问绑定到所选核显的设备节点。这样可以避免 Intel Quick Sync Video（QSV）因枚举到 NVIDIA 设备而初始化失败，无需额外配置。
+:::
+
+<span id="legacy-hardware-acceleration-on-olares-1126"></span>
+
+:::details Olares 1.12.6 的旧版硬件加速设置
+以下以 Olares One 上的 Intel Quick Sync Video（QSV）为例，说明 Olares 1.12.6 的设置方法：
+
+1. 安装 Jellyfin 时选择 **CPU** 加速器。
+2. 进入 **Settings** > **Applications** > **Jellyfin** > **Manage Environment Variables**。
+3. 将 `ENABLE_HW_ACCEL` 设置为 `true`。
+4. 将 `VIDEO_GID` 和 `RENDER_GID` 设置为主机上相应用户组的 ID。Olares One 的默认值分别为 `44` 和 `994`。
+
+   在其他设备上，从控制面板打开 Olares 终端并运行：
+
+   ```bash
+   getent group video
+   getent group render
+   ls -ln /dev/dri
+   ```
+
+5. 保存更改。Olares 会自动重启 Jellyfin。
+6. 在 Jellyfin **Dashboard** 中，进入 **Playback** > **Transcoding**。
+7. 在 **Hardware acceleration** 下选择 **Intel Quicksync (QSV)**。
+8. 选择硬件支持的编解码格式，然后保存更改。
 :::
 
 ## 安装社区插件提升体验
```

---

### Incident Patch 9: `1efbffca` (2026-09-22)
**Commit Message**: docs: add LarePass extension guides and private webpage translation tutorial (#4150)

* dd LarePass extension guides and private webpage translation tutorial

* update info for cloud provider

* refine wording

**File**: `docs/.vitepress/en.ts` (modified, +14/-0)
```diff
@@ -142,12 +142,26 @@ const side = {
           text: "Get familiar with Desktop",
           link: "/manual/olares/desktop",
         },
+        {
+          text: "Install the LarePass browser extension",
+          link: "/manual/install-larepass-browser-extension",
+        },
         {
           text: "What's next",
           link: "/manual/get-started/next-steps",
         },
       ],
     },
+    {
+      text: "Tutorials",
+      collapsed: false,
+      items: [
+        {
+          text: "Translate webpages privately with LarePass",
+          link: "/manual/tutorial/translate-webpages-with-larepass",
+        },
+      ],
+    },
     {
       text: "Accounts and access",
       collapsed: false,
```

**File**: `docs/.vitepress/zh.ts` (modified, +14/-0)
```diff
@@ -142,12 +142,26 @@ const side = {
           text: "了解桌面",
           link: "/zh/manual/olares/desktop",
         },
+        {
+          text: "安装 LarePass 浏览器扩展",
+          link: "/zh/manual/install-larepass-browser-extension",
+        },
         {
           text: "探索",
           link: "/zh/manual/get-started/next-steps",
         },
       ],
     },
+    {
+      text: "教程",
+      collapsed: false,
+      items: [
+        {
+          text: "使用 LarePass 私密翻译网页",
+          link: "/zh/manual/tutorial/translate-webpages-with-larepass",
+        },
+      ],
+    },
     {
       text: "账户与访问",
       collapsed: false,
```

**File**: `docs/manual/install-larepass-browser-extension.md` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+---
+outline: [2, 3]
+description: Download and install the LarePass browser extension manually in Google Chrome.
+head:
+  - - meta
+    - name: keywords
+      content: Olares, LarePass, Chrome extension, developer mode, install extension, load unpacked
+---
+
+# Install the LarePass browser extension
+
+Install the LarePass browser extension to use Olares features while browsing, including webpage translation, password autofill, and saving online content.
+
+## Prerequisites
+
+- Install Google Chrome on your computer.
+- Make sure you have an existing Olares ID. If you do not have one, [create an Olares ID](./get-started/create-olares-id.md) first.
+
+## Download the extension
+
+1. Open the [LarePass website](https://www.olares.com/larepass).
+2. Find **LarePass for Chrome Extension**, then click **Download**.
+3. Move the downloaded ZIP package to a folder where you plan to keep it, then continue with the installation.
+
+:::warning Keep the installation files in place
+Chrome continues to use the files from their location during installation. After installing LarePass, do not move, rename, or delete the ZIP package. If you use **Load unpacked**, do not move, rename, or delete the unzipped folder either.
+:::
+
+## Install and enable the extension
+
+You can drag the ZIP package into Chrome for the quickest installation. If drag-and-drop does not work, unzip the package and load the folder instead.
+
+### Drag and drop the ZIP package
+
+1. In the Chrome address bar, enter `chrome://extensions/`.
+2. Turn on **Developer mode** in the upper-right corner.
+3. Drag the downloaded ZIP package onto the extensions page.
+4. Confirm that LarePass appears on the extensions page and is enabled. Keep the ZIP package in its current location.
+
+### Load the unpacked extension
+
+Use this method if you cannot install the ZIP package by dragging it into Chrome.
+
+1. Unzip the downloaded package without moving the ZIP package. Keep the unzipped folder in a permanent location as well.
+2. On the `chrome://extensions/` page, turn on **Developer mode**.
+3. Click **Load unpacked**.
+4. Select the unzipped folder that contains the extension files.
+5. Confirm that LarePass appears on the extensions page and is enabled.
+
+## Pin the extension
+
+1. Click the extensions icon in the Chrome toolbar.
+2. Find LarePass, then click the pin icon.
+3. Click the LarePass icon in the toolbar and confirm that the extension opens.
+
+## Next steps
+
+- [Import an existing Olares account](./larepass/manage-accounts.md#chrome-extension).
+- After signing in, you can use LarePass features such as webpage translation, password autofill, and saving online content.
```

**File**: `docs/manual/larepass/index.md` (modified, +7/-2)
```diff
@@ -1,10 +1,10 @@
 ---
-description: Download LarePass for iOS, Android, macOS, Windows, or Linux and find the account setup guide you need.
+description: Download LarePass for mobile, desktop, or Chrome, and find the setup guide you need.
 outline: [2, 3]
 head:
   - - meta
     - name: keywords
-      content: Olares, LarePass, client, iOS, Android, macOS, Windows, Linux, download
+      content: Olares, LarePass, client, browser extension, Chrome, iOS, Android, macOS, Windows, Linux, download
 ---
 
 # Download LarePass
@@ -36,9 +36,14 @@ Download the latest desktop client from the [LarePass website](https://www.olare
 
 Download the latest Linux desktop client from the [LarePass website](https://www.olares.com/larepass).
 
+### Chrome browser extension
+
+Download the ZIP package from the [LarePass website](https://www.olares.com/larepass). The extension must be installed manually in Chrome. See [Install the LarePass browser extension](../install-larepass-browser-extension.md) for instructions.
+
 ## Set up your account
 
 - On mobile devices, you can [create an Olares ID](../get-started/create-olares-id.md) directly in LarePass. To use a custom domain, see [Create an Olares ID with a custom domain](create-org-account.md).
 - On the desktop client, [import an existing account](manage-accounts.md#import-an-account).
+- In the Chrome browser extension, [import an existing account](manage-accounts.md#chrome-extension).
 
 On the desktop client, you can also [save remote resources directly to Olares](save-resources-to-olares.md).
```

**File**: `docs/manual/larepass/manage-accounts.md` (modified, +22/-2)
```diff
@@ -1,10 +1,10 @@
 ---
 outline: [2, 3]
-description: Import, switch, and delete Olares accounts in the LarePass mobile app or desktop client.
+description: Import an Olares account into LarePass on mobile, desktop, or Chrome, and manage accounts on your devices.
 head:
   - - meta
     - name: keywords
-      content: Olares, LarePass, import account, switch account, delete account, Olares ID, mnemonic phrase
+      content: Olares, LarePass, browser extension, import account, switch account, delete account, Olares ID, mnemonic phrase
 ---
 
 # Manage accounts in LarePass
@@ -39,6 +39,15 @@ To import an Olares ID, you need its 12-word mnemonic phrase. If you do not have
 
    ![Import account on desktop](/images/manual/larepass/import-account-desktop.png#bordered)
 
+### Chrome extension
+
+1. Select the LarePass icon in the Chrome toolbar.
+2. If the introduction appears, click **Skip**, or use the arrow to view all the introductory screens.
+3. Click **Import an account**.
+4. Enter the 12-word mnemonic phrase for your Olares ID.
+
+   ![Enter the mnemonic phrase in the LarePass Chrome extension](/images/manual/larepass/import-account-browser-extension.png#bordered)
+
 ## Switch accounts
 
 If you have added multiple Olares IDs in LarePass, you can switch between them at any time.
@@ -66,6 +75,11 @@ If you have added multiple Olares IDs in LarePass, you can switch between them a
 
    ![Switch accounts on desktop](/images/manual/larepass/switch-account-desktop1.png#bordered)
 
+### Chrome extension
+
+1. Click or hover over your profile avatar in the lower-right corner.
+2. Select the account you want to use from the account list.
+
 ## Delete accounts
 
 Remove an account from LarePass when you no longer want to keep it on the current device.
@@ -92,3 +106,9 @@ You can delete an account only after you have [backed up its mnemonic phrase](ba
 3. Click **Delete account** to delete the current account, then confirm the deletion.
 
    ![Delete accounts on desktop](/images/manual/larepass/delete-account-desktop.png#bordered)
+
+### Chrome extension
+
+1. Click <i class="material-symbols-outlined">settings</i> above your profile avatar in the lower-right corner.
+2. Click **Account**.
+3. Click **Delete**, then confirm the deletion.
```

**File**: `docs/manual/tutorial/translate-webpages-with-larepass.md` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+---
+outline: [2, 3]
+description: Translate webpages privately with the LarePass Chrome extension and the Hy-MT2-1.8B model running on your Olares.
+head:
+  - - meta
+    - name: keywords
+      content: Olares, LarePass, webpage translation, immersive translation, Hy-MT2, local translation, private translation
+---
+
+# Translate webpages privately with LarePass <Badge type="tip" text="^ 1.12.7" />
+
+Cloud-based translation extensions process webpage text on the provider's servers. LarePass takes a self-hosted approach: it sends the text through Router to **Hy-MT2-1.8B** running on your Olares, rather than to a third-party translation provider. You retain more control over how your content is processed.
+
+You also get the convenience of an integrated browser translator:
+
+- **Private by design:** Router routes webpage text from LarePass to the model running on your Olares, so it is not processed by a third-party translation provider.
+- **Lightweight and multilingual:** Hy-MT2 supports translation across 33 languages. Its compact 1.8B size balances translation quality with the resources required to run it locally.
+- **Automatic integration:** Router uses your Olares identity to authenticate requests and automatically detects and configures the installed Hy-MT2 model. You do not need to configure model endpoints or API keys.
+
+:::info
+LarePass also supports Google and Microsoft, which process webpage text on their servers. This guide focuses on Hy-MT2, which processes it on your Olares.
+:::
+
+## Prerequisites
+
+- [Install the LarePass browser extension](../install-larepass-browser-extension.md).
+- [Import your Olares account](../larepass/manage-accounts.md#chrome-extension).
+- Ensure **Router** is installed on your Olares.
+
+## Get started with local translation
+
+1. In [Olares Market](../olares/market/market.md#install-models), search for and install **Hy-MT2-1.8B**. Wait for the installation to finish so Router can automatically detect and configure the model.
+2. Open a webpage and click the LarePass icon in the Chrome toolbar. Select <i class="material-symbols-outlined">translate</i>, choose the source and target languages, and select `Olares/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M` as the **Translation provider**. Then click **Translate this page**.
+
+To restore the original text, click **Show original**. If the webpage was already open when you installed the extension or model, refresh it before translating.
+
+## Customize your experience
+
+On the Translate page, you can adjust:
+
+- **Automatic translation**: Follow the global setting, always translate the current website, or never translate it.
+- **Show translation only**: Hide the original text after translation.
+- **Show original on hover**: Available after you turn on **Show translation only**. Point to a translated paragraph to temporarily view the original text.
+
+To change global defaults and translation styles, click <i class="material-symbols-outlined">settings</i>.
+
+## Troubleshooting
+
+- **Provider unavailable:** Router might still be detecting and configuring Hy-MT2. Wait for it to finish, then refresh the webpage.
+- **Page cannot be translated:** Chrome extensions cannot translate internal pages such as `chrome://extensions/`, or pages that do not expose regular webpage text. Try a standard article or blog.
```

**File**: `docs/zh/manual/install-larepass-browser-extension.md` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+---
+outline: [2, 3]
+description: 下载 LarePass 浏览器扩展，并通过开发者模式将其手动安装到 Google Chrome。
+head:
+  - - meta
+    - name: keywords
+      content: Olares, LarePass, Chrome 扩展, 开发者模式, 安装扩展, 加载已解压的扩展程序
+---
+
+# 安装 LarePass 浏览器扩展
+
+安装 LarePass 浏览器扩展后，可以在浏览网页时使用网页翻译、密码自动填充、在线内容收藏等 Olares 功能。
+
+## 前提条件
+
+- 在电脑上安装 Google Chrome。
+- 准备一个已有的 Olares ID。如果还没有，请先[创建 Olares ID](./get-started/create-olares-id.md)。
+
+## 下载扩展
+
+1. 打开 [LarePass 官网](https://www.olares.cn/larepass)。
+2. 找到 **LarePass Chrome 浏览器扩展**，点击**下载**。
+3. 将下载的 ZIP 安装包移到准备长期保留的位置，再继续安装。
+
+:::warning 请勿改变安装文件的位置
+Chrome 安装和运行扩展时会继续使用原位置中的文件。安装 LarePass 后，请勿移动、重命名或删除 ZIP 安装包。如果使用**加载已解压的扩展程序**，也不要移动、重命名或删除解压目录。
+:::
+
+## 安装并启用扩展
+
+直接将 ZIP 安装包拖入 Chrome 即可快速安装。如果无法通过拖拽安装，可以解压安装包后手动加载。
+
+### 拖拽安装 ZIP 包
+
+1. 在 Chrome 地址栏中输入 `chrome://extensions/`。
+2. 打开右上角的**开发者模式**。
+3. 将下载的 ZIP 安装包拖到扩展程序页面中。
+4. 确认扩展程序页面中已显示 LarePass，且扩展处于启用状态。请将 ZIP 安装包保留在当前位置。
+
+### 加载已解压的扩展程序
+
+如果无法通过拖拽方式安装 ZIP 包，请使用此方法。
+
+1. 在不移动 ZIP 安装包的情况下完成解压，同时将解压目录放在准备长期保留的位置。
+2. 在 `chrome://extensions/` 页面中打开**开发者模式**。
+3. 点击**加载已解压的扩展程序**。
+4. 选择包含扩展文件的解压目录。
+5. 确认扩展程序页面中已显示 LarePass，且扩展处于启用状态。
+
+## 固定扩展
+
+1. 点击 Chrome 工具栏中的扩展程序图标。
+2. 找到 LarePass，点击旁边的固定图标。
+3. 点击工具栏中的 LarePass 图标，确认扩展可以正常打开。
+
+## 下一步
+
+- [导入已有 Olares 账户](./larepass/manage-accounts.md#chrome-扩展)。
+- 登录后，可以使用网页翻译、密码自动填充和在线内容收藏等 LarePass 功能。
```

**File**: `docs/zh/manual/larepass/index.md` (modified, +7/-2)
```diff
@@ -1,10 +1,10 @@
 ---
 outline: [2, 3]
-description: 下载适用于 iOS、Android、macOS、Windows 或 Linux 的 LarePass，并查找所需的账户设置指南。
+description: 下载适用于移动端、桌面端或 Chrome 的 LarePass，并查找所需的设置指南。
 head:
   - - meta
     - name: keywords
-      content: Olares, LarePass, 官方客户端, iOS, Android, macOS, Windows, Linux, 下载
+      content: Olares, LarePass, 官方客户端, 浏览器扩展, Chrome, iOS, Android, macOS, Windows, Linux, 下载
 ---
 
 # 下载 LarePass
@@ -36,9 +36,14 @@ LarePass 是用于创建和管理 Olares ID、激活 Olares，以及在手机和
 
 请从 [LarePass 官网](https://www.olares.cn/larepass)下载最新 Linux 桌面客户端。
 
+### Chrome 浏览器扩展
+
+从 [LarePass 官网](https://www.olares.cn/larepass)下载 ZIP 安装包。该扩展需要在 Chrome 中手动安装，具体操作请参阅[安装 LarePass 浏览器扩展](../install-larepass-browser-extension.md)。
+
 ## 设置账户
 
 - 在移动设备上，你可以使用 LarePass 直接[创建 Olares ID](/zh/manual/get-started/create-olares-id.md)。如需使用自定义域名，请参阅[使用自定义域名创建 Olares ID](create-org-account.md)。
 - 在桌面客户端上，请[导入已有账户](manage-accounts.md#导入账户)。
+- 在 Chrome 浏览器扩展中，请[导入已有账户](manage-accounts.md#chrome-扩展)。
 
 在桌面客户端上，你还可以[将网络资源直接转存到 Olares](save-resources-to-olares.md)。
```

---

### Incident Patch 10: `2f7c50c5` (2026-09-21)
**Commit Message**: fix(cli): make etcd backup script fail fast (#4176)

**File**: `cli/pkg/etcd/templates/backup_script.go` (modified, +3/-1)
```diff
@@ -26,6 +26,8 @@ import (
 var EtcdBackupScript = template.Must(template.New("etcd-backup.sh").Parse(
 	dedent.Dedent(`#!/bin/bash
 
+set -euo pipefail
+
 ETCDCTL_PATH='/usr/local/bin/etcdctl'
 ENDPOINTS='{{ .Etcdendpoint }}'
 ETCD_DATA_DIR="/var/lib/etcd"
@@ -52,6 +54,6 @@ export ETCDCTL_API=3;$ETCDCTL_PATH --endpoints="$ENDPOINTS" snapshot save $BACKU
 
 sleep 3
 
-cd $BACKUP_DIR/../;ls -lt |awk '{if(NR > '$KEEPBACKUPNUMBER'){print "rm -rf "$9}}'|sh
+cd "$BACKUP_DIR/.." && ls -lt |awk '{if(NR > '$KEEPBACKUPNUMBER'){print "rm -rf "$9}}'|sh
 
 `)))
```

**File**: `cli/pkg/upgrade/1_12_7.go` (modified, +12/-1)
```diff
@@ -5,6 +5,7 @@ import (
 	"github.com/beclab/Olares/cli/pkg/certs"
 	"github.com/beclab/Olares/cli/pkg/common"
 	"github.com/beclab/Olares/cli/pkg/core/task"
+	"github.com/beclab/Olares/cli/pkg/etcd"
 	"github.com/beclab/Olares/cli/pkg/kubesphere/plugins"
 	"github.com/beclab/Olares/cli/version"
 )
@@ -34,7 +35,8 @@ func (u upgrader_1_12_7) AddedBreakingChange() bool {
 }
 
 func (u upgrader_1_12_7) PrepareForUpgrade() []task.Interface {
-	tasks := migrateContainerdConfigV3()
+	tasks := refreshBackupETCDScript()
+	tasks = append(tasks, migrateContainerdConfigV3()...)
 	tasks = append(tasks, &task.LocalTask{
 		Name:   "RestartNvidiaApplicationPods",
 		Action: new(restartNvidiaApplicationPods),
@@ -59,6 +61,15 @@ func (u upgrader_1_12_7) PrepareForUpgrade() []task.Interface {
 	return tasks
 }
 
+func refreshBackupETCDScript() []task.Interface {
+	return []task.Interface{
+		&task.LocalTask{
+			Name:   "RefreshBackupETCDScript",
+			Action: new(etcd.BackupETCD),
+		},
+	}
+}
+
 func (u upgrader_1_12_7) PostUpgrade() []task.Interface {
 	return append(regenerateKubeFiles(), u.upgraderBase.PostUpgrade()...)
 }
```

**File**: `cli/pkg/upgrade/1_12_7_20260921.go` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+package upgrade
+
+import (
+	"github.com/Masterminds/semver/v3"
+	"github.com/beclab/Olares/cli/pkg/core/task"
+)
+
+type upgrader_1_12_7_20260921 struct {
+	breakingUpgraderBase
+}
+
+func (u upgrader_1_12_7_20260921) Version() *semver.Version {
+	return semver.MustParse("1.12.7-20260921")
+}
+
+func (u upgrader_1_12_7_20260921) PrepareForUpgrade() []task.Interface {
+	tasks := refreshBackupETCDScript()
+	return append(tasks, u.upgraderBase.PrepareForUpgrade()...)
+}
+
+func init() {
+	registerDailyUpgrader(upgrader_1_12_7_20260921{})
+}
```

---

### Incident Patch 11: `a85a55e8` (2026-09-20)
**Commit Message**: fix(cli): run the platform-credential import whatever hook cobra picks (#4175)

**File**: `cli/cmd/ctl/chart/root.go` (modified, +0/-4)
```diff
@@ -20,10 +20,6 @@ and do not require a profile login.`,
 	// full help block on every validation failure.
 	cmd.SilenceErrors = true
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceErrors = true
-		c.SilenceUsage = true
-	}
 	cmd.AddCommand(NewCmdChartLint())
 	cmd.AddCommand(NewCmdChartFromCompose())
 	cmd.AddCommand(NewCmdChartPackage())
```

**File**: `cli/cmd/ctl/cluster/application/root.go` (modified, +0/-3)
```diff
@@ -47,9 +47,6 @@ resulting K8s namespaces.
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/container/root.go` (modified, +0/-3)
```diff
@@ -44,9 +44,6 @@ endpoint (/api/v1/namespaces/<ns>/pods/<name>).
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewEnvCommand(f))
```

**File**: `cli/cmd/ctl/cluster/cronjob/root.go` (modified, +0/-3)
```diff
@@ -58,9 +58,6 @@ For one-shot Jobs see "cluster job".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/job/root.go` (modified, +0/-3)
```diff
@@ -61,9 +61,6 @@ For scheduled jobs see "cluster cronjob".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/middleware/root.go` (modified, +0/-3)
```diff
@@ -34,9 +34,6 @@ shows passwords).
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 
```

**File**: `cli/cmd/ctl/cluster/namespace/root.go` (modified, +0/-3)
```diff
@@ -35,9 +35,6 @@ see ` + "`cluster application list`" + `.
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/node/root.go` (modified, +0/-3)
```diff
@@ -36,9 +36,6 @@ For host-side node operations (install / join / drain) see
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

---

### Incident Patch 12: `0a754c82` (2026-09-20)
**Commit Message**: fix(cli): run the platform-credential import whatever hook cobra picks

The import hung on the root's PersistentPreRun, and cobra runs only the
nearest one: any subtree declaring a hook of its own removed the identity
from every verb beneath it. Eighteen subtrees had one that did nothing but
set SilenceUsage, so in a fresh container `market list`, `settings`,
`router`, `knowledge` and all of `cluster` reported that no profile was
configured while the credential sat unread on its mount. `profile list`,
one of the few trees without a hook, repaired the container for whatever
ran after it.

Wrap the import around every declared hook instead of placing it in one,
and set SilenceUsage on the root, which covers the whole tree and replaces
the eighteen hooks that caused this. The nfs backend-version gate keeps its
hook and now runs with an identity available.

The existing importer tests all call the importer directly, so none of them
could see this. The new end-to-end cases drive the real tree the way a
container does and assert on config.json.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `cli/cmd/ctl/chart/root.go` (modified, +0/-4)
```diff
@@ -20,10 +20,6 @@ and do not require a profile login.`,
 	// full help block on every validation failure.
 	cmd.SilenceErrors = true
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceErrors = true
-		c.SilenceUsage = true
-	}
 	cmd.AddCommand(NewCmdChartLint())
 	cmd.AddCommand(NewCmdChartFromCompose())
 	cmd.AddCommand(NewCmdChartPackage())
```

**File**: `cli/cmd/ctl/cluster/application/root.go` (modified, +0/-3)
```diff
@@ -47,9 +47,6 @@ resulting K8s namespaces.
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/container/root.go` (modified, +0/-3)
```diff
@@ -44,9 +44,6 @@ endpoint (/api/v1/namespaces/<ns>/pods/<name>).
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewEnvCommand(f))
```

**File**: `cli/cmd/ctl/cluster/cronjob/root.go` (modified, +0/-3)
```diff
@@ -58,9 +58,6 @@ For one-shot Jobs see "cluster job".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/job/root.go` (modified, +0/-3)
```diff
@@ -61,9 +61,6 @@ For scheduled jobs see "cluster cronjob".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/middleware/root.go` (modified, +0/-3)
```diff
@@ -34,9 +34,6 @@ shows passwords).
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 
```

**File**: `cli/cmd/ctl/cluster/namespace/root.go` (modified, +0/-3)
```diff
@@ -35,9 +35,6 @@ see ` + "`cluster application list`" + `.
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/node/root.go` (modified, +0/-3)
```diff
@@ -36,9 +36,6 @@ For host-side node operations (install / join / drain) see
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

---

### Incident Patch 13: `cf1f2a5c` (2026-09-20)
**Commit Message**: fix(cli): keep a platform-issued profile usable when the cache directory is not writable (#4174)

**File**: `cli/internal/cachedir/cachedir.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+// Package cachedir resolves the base directory olares-cli keeps its derived
+// state under — the profile index, the encrypted keychain, and the locks that
+// serialize both — inside a container the platform injected a credential into.
+//
+// app-service mounts an emptyDir and exports $OLARES_CLI_CACHE_DIR at it, and
+// both cliconfig.Home and keychain.StorageDir used to take that variable at
+// its word. An agent sandbox breaks the promise: dsh confines the shell to the
+// session workspace, so the mount is present, world-writable by its mode bits,
+// and still refuses every write. What the platform issued then reaches the
+// process and evaporates with it, and the next command reports that no profile
+// is configured — the one diagnosis that sends a user to `profile login`, which
+// is exactly what a platform-issued identity refuses.
+//
+// So the rung is verified rather than trusted, and a rung that cannot be
+// written to is skipped instead of failed on.
+package cachedir
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"sync"
+)
+
+// EnvCacheDir is app-service's contract with the container. The literal is
+// duplicated from credential.EnvCacheDir because that package imports
+// cliconfig, which imports this one.
+const EnvCacheDir = "OLARES_CLI_CACHE_DIR"
+
+// Resolution is memoized per distinct input rather than once per process:
+// probing costs a create and an unlink, Home() is called several times per
+// command, and keying on the inputs keeps a test that changes them honest
+// without a reset hook in the production API.
+var (
+	mu       sync.Mutex
+	cacheKey string
+	cached   string
+)
+
+// Base returns the writable base directory for platform-injected state, and
+// whether there is one at all.
+//
+// A false second return means this is not a managed container: $OLARES_CLI_CACHE_DIR
+// is unset, or nothing derived from it could be written to. Callers keep their
+// own lookup chain for that case, so a host install resolves exactly as it did
+// before this package existed — including creating no directories, since the
+// only way to tell a writable directory from an unwritable one is to write.
+//
+// When true, the layout under the returned base is the same whether it is the
+// platform's directory or the fallback, so a caller joins its own subdirectory
+// without asking which one it got.
+func Base() (string, bool) {
+	configured := os.Getenv(EnvCacheDir)
+	key := configured + "\x00" + os.TempDir()
+
+	mu.Lock()
+	defer mu.Unlock()
+	if key != cacheKey {
+		cached = resolve(configured)
+		cacheKey = key
+	}
+	return cached, cached != ""
+}
+
+func resolve(configured string) string {
+	if configured == "" {
+		return ""
+	}
+	cleaned := filepath.Clean(configured)
+	if !filepath.IsAbs(cleaned) {
+		// Matches keychain's narrow reading of its own directory variables:
+		// a relative path floats with cwd, which is nobody's intent.
+		debugf("ignoring relative %s=%q", EnvCacheDir, configured)
+		return ""
+	}
+	if usable(cleaned) {
+		return cleaned
+	}
+	fallback := tempBase()
+	if usable(fallback) {
+		debugf("%s=%q is not writable; using %q instead", EnvCacheDir, cleaned, fallback)
+		return fallback
+	}
+	debugf("neither %q nor %q is writable", cleaned, fallback)
+	return ""
+}
+
+// tempBase is stable across invocations on purpose: a random directory would
+// make every command re-import the mounted credential and exchange the refresh
+// token again. The uid is in the name because /tmp is shared, and a directory
+// left by another account would be one this process cannot use.
+func tempBase() string {
+	name := "olares-cli"
+	if uid := os.Getuid(); uid >= 0 {
+		name = fmt.Sprintf("olares-cli-%d", uid)
+	}
+	return filepath.Join(os.TempDir(), name)
+}
+
+// usable answers the only question that matters by performing the operation in
+// question. A permission probe would not do: Landlock and seccomp-style
+// confinement deny the syscall while leaving the mode bits that access(2)
+// reports untouched, which is precisely how /olares/cache reads as 0777 and
+// rejects mkdir.
+func usable(dir string) bool {
+	if fi, err := os.Lstat(dir); err == nil && fi.Mode()&os.ModeSymlink != 0 {
+		return false
+	}
+	if err := os.MkdirAll(dir, 0o700); err != nil {
+		return false
+	}
+	probe, err := os.CreateTemp(dir, ".writable-*")
+	if err != nil {
+		return false
+	}
+	name := probe.Name()
+	_ = probe.Close()
+	_ = os.Remove(name)
+	return true
+}
+
+// debugf shares OLARES_CLI_DEBUG with credential.debugManaged and the keychain
+// hints: resolution runs before every command, so a rung being skipped is only
+// worth saying when somebody is asking.
+func debugf(format string, args ...any) {
+	if os.Getenv("OLARES_CLI_DEBUG") == "" {
+		return
+	}
+	fmt.Fprintf(os.Stderr, "[olares-cli cachedir] "+format+"\n", args...)
+}
```

**File**: `cli/internal/cachedir/cachedir_test.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package cachedir
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+// A host install sets nothing, so every caller keeps its own lookup chain and
+// no directory is created behind its back.
+func TestBase_UnsetIsNotAManagedContainer(t *testing.T) {
+	t.Setenv(EnvCacheDir, "")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want no base", got)
+	}
+}
+
+// The ordinary managed container: the platform's directory is writable and is
+// used as it is.
+func TestBase_UsesWritableCacheDir(t *testing.T) {
+	dir := writableDir(t)
+	t.Setenv(EnvCacheDir, dir)
+
+	got, ok := Base()
+	if !ok || got != dir {
+		t.Fatalf("Base() = %q, %v; want %q, true", got, ok, dir)
+	}
+}
+
+// The agent-sandbox case this package exists for: the mount is there, its mode
+// bits say world-writable, and the write is refused anyway.
+func TestBase_UnwritableCacheDirFallsBackToTemp(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	tmp := writableDir(t)
+	t.Setenv("TMPDIR", tmp)
+	t.Setenv(EnvCacheDir, denied)
+
+	got, ok := Base()
+	if !ok {
+		t.Fatal("Base() found nowhere to write, want the temp fallback")
+	}
+	if !strings.HasPrefix(got, tmp) {
+		t.Fatalf("Base() = %q, want a directory under %q", got, tmp)
+	}
+	if fi, err := os.Stat(got); err != nil || !fi.IsDir() {
+		t.Fatalf("fallback %q is not a usable directory: %v", got, err)
+	}
+}
+
+// The fallback has to be the same directory next time, or every command would
+// re-import the mounted credential and exchange the refresh token again.
+func TestBase_FallbackIsStableAcrossResolutions(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	t.Setenv("TMPDIR", writableDir(t))
+	t.Setenv(EnvCacheDir, denied)
+
+	first, _ := Base()
+	if second := resolve(denied); second != first {
+		t.Fatalf("re-resolved to %q, want the same %q", second, first)
+	}
+}
+
+// A relative path floats with cwd, which is nobody's intent; it is declined
+// rather than joined onto wherever the command happened to run.
+func TestBase_RelativeCacheDirIsDeclined(t *testing.T) {
+	t.Setenv(EnvCacheDir, "relative-cache")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want the relative path declined", got)
+	}
+}
+
+// writableDir returns a real directory, resolved through symlinks so a
+// comparison against what Base() returns is not defeated by /var -> /private/var.
+func writableDir(t *testing.T) string {
+	t.Helper()
+	dir, err := filepath.EvalSymlinks(t.TempDir())
+	if err != nil {
+		t.Fatalf("resolve temp dir: %v", err)
+	}
+	return dir
+}
```

**File**: `cli/internal/keychain/keychain_other.go` (modified, +8/-14)
```diff
@@ -10,6 +10,8 @@ import (
 	"path/filepath"
 
 	"github.com/google/uuid"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // AES constants and crypto helpers (encryptData / decryptData) plus
@@ -21,20 +23,14 @@ import (
 // avoids accidental clashes with lark-cli on machines that have both.
 const dataDirEnv = "OLARES_CLI_DATA_DIR"
 
-// cacheDirEnv is set by app-service's cli-credential webhook and points at a
-// writable emptyDir. An application container's HOME is frequently read-only
-// or belongs to a different uid than the process, so without this the very
-// first Set would fail to create the master key. The literal is duplicated
-// from credential.EnvCacheDir rather than imported, matching how this package
-// already keeps dataDirEnv to itself.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
-
 // StorageDir returns the absolute directory for service-scoped encrypted
 // blobs on Linux. The lookup chain is:
 //
 //  1. $OLARES_CLI_DATA_DIR if it's an absolute, cleanly-resolved path,
-//  2. $OLARES_CLI_CACHE_DIR/keychain, same absolute-path rule, which only
-//     exists inside a container the platform injected a credential into,
+//  2. `keychain/<service>` under the platform cache base, which only exists
+//     inside a container the platform injected a credential into. cachedir
+//     owns that rung, including the substitution it makes when the exported
+//     directory turns out not to be writable.
 //  3. XDG-style ~/.local/share/<service>,
 //  4. an absolute fallback under os.TempDir() when HOME is unresolvable.
 //     Earlier versions returned ".local/share/<service>" relative to CWD,
@@ -47,10 +43,8 @@ func StorageDir(service string) string {
 			return filepath.Join(safeDir, service)
 		}
 	}
-	if dir := os.Getenv(cacheDirEnv); dir != "" {
-		if safeDir, ok := safeAbsoluteDir(dir); ok {
-			return filepath.Join(safeDir, "keychain", service)
-		}
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "keychain", service)
 	}
 	home, err := os.UserHomeDir()
 	if err != nil || home == "" {
```

**File**: `cli/internal/keychain/keychain_other_test.go` (modified, +44/-0)
```diff
@@ -5,6 +5,7 @@ package keychain
 import (
 	"os"
 	"path/filepath"
+	"strings"
 	"testing"
 )
 
@@ -82,6 +83,49 @@ func TestStorageDir_NoCacheDirKeepsXDGDefault(t *testing.T) {
 	}
 }
 
+// An agent sandbox leaves the platform's cache directory mounted and refuses
+// every write to it. The keychain is the rung that fails first and loudest:
+// the master key has to be created before anything can be stored at all, so a
+// store that cannot move off that directory cannot hold the access token the
+// mounted grant was just exchanged for.
+func TestPlatformRoundTrip_UnwritableCacheDir(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := t.TempDir()
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	tmp := t.TempDir()
+	tmp, _ = filepath.EvalSymlinks(tmp)
+	t.Setenv("OLARES_CLI_DATA_DIR", "")
+	t.Setenv("TMPDIR", tmp)
+	t.Setenv("OLARES_CLI_CACHE_DIR", denied)
+
+	const (
+		service = "olares-cli-test"
+		account = "alice@olares.com"
+		secret  = `{"olaresId":"alice@olares.com","accessToken":"abc"}`
+	)
+
+	dir := StorageDir(service)
+	if !strings.HasPrefix(dir, tmp) {
+		t.Fatalf("StorageDir() = %q, want it moved under %q", dir, tmp)
+	}
+
+	if err := platformSet(service, account, secret); err != nil {
+		t.Fatalf("platformSet() error = %v", err)
+	}
+	got, err := platformGet(service, account)
+	if err != nil || got != secret {
+		t.Fatalf("platformGet() = (%q, %v), want the secret back", got, err)
+	}
+	if _, err := os.Stat(filepath.Join(dir, "master.key")); err != nil {
+		t.Fatalf("master key was not created in the fallback: %v", err)
+	}
+}
+
 // TestPlatformRoundTrip exercises the full Get/Set/Remove cycle on the file
 // backend (which is what's actually shipped on Linux). This is the closest
 // we can get to a smoke test without mocking keychain bits.
```

**File**: `cli/pkg/cliconfig/paths.go` (modified, +15/-7)
```diff
@@ -11,6 +11,8 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // homeEnv is the environment variable used to override the config dir, mirroring
@@ -21,8 +23,9 @@ const homeEnv = "OLARES_CLI_HOME"
 // writable emptyDir mounted into an application container. It sits between
 // the explicit override and $HOME so a managed container gets a config dir it
 // can actually write to, without changing anything on a host install where
-// the variable is unset.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
+// the variable is unset. Whether it is writable is cachedir's question to
+// answer, not ours; the name is kept here for the tests that set it.
+const cacheDirEnv = cachedir.EnvCacheDir
 
 // defaultDir is the directory name used under $HOME when $OLARES_CLI_HOME is
 // unset.
@@ -52,15 +55,20 @@ const (
 )
 
 // Home returns the resolved olares-cli config directory: $OLARES_CLI_HOME,
-// then $OLARES_CLI_CACHE_DIR/config, then $HOME/.olares-cli. The directory is
-// NOT created here — callers that intend to write should call EnsureHome
-// instead.
+// then the platform cache base's `config`, then $HOME/.olares-cli. The
+// directory is NOT created here — callers that intend to write should call
+// EnsureHome instead.
+//
+// The middle rung goes through cachedir, which substitutes a writable
+// directory when the one the platform exported cannot be written to. Reads
+// resolve through the same call, so config.json is looked for where the last
+// write actually landed.
 func Home() (string, error) {
 	if v := os.Getenv(homeEnv); v != "" {
 		return v, nil
 	}
-	if v := os.Getenv(cacheDirEnv); v != "" {
-		return filepath.Join(v, "config"), nil
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "config"), nil
 	}
 	home, err := os.UserHomeDir()
 	if err != nil {
```

**File**: `cli/pkg/credential/envelope_test.go` (modified, +30/-0)
```diff
@@ -5,6 +5,9 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
 	"testing"
 	"time"
 
@@ -87,6 +90,33 @@ func TestAManagedCredentialIsNotSentToProfileLogin(t *testing.T) {
 	}
 }
 
+// "Nothing is configured" inside a container the platform issued a credential
+// to means the mount failed to become a profile, not that the user forgot to
+// log in. Sending them to `profile login` there costs them a round of trying
+// a command that is refused.
+func TestNoProfileInAManagedContainerDoesNotSayLogin(t *testing.T) {
+	dir := t.TempDir()
+	if err := os.WriteFile(filepath.Join(dir, credentialFilename), []byte("{}"), 0o600); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Setenv(EnvCredentialsDir, dir)
+
+	body := envelopeFor(t, ErrNoProfile)
+	action, _ := body["action"].(string)
+	message, _ := body["message"].(string)
+	for field, text := range map[string]string{"action": action, "message": message} {
+		if text == "" {
+			t.Fatalf("%s is empty", field)
+		}
+		if strings.Contains(text, "profile login") || strings.Contains(text, "profile import") {
+			t.Errorf("%s points at a command that is refused for managed credentials: %q", field, text)
+		}
+	}
+	if body["code"] != clierr.CodeAuthNoProfile {
+		t.Errorf("code = %v, want it unchanged at %q", body["code"], clierr.CodeAuthNoProfile)
+	}
+}
+
 // ErrNoProfile stopped being errors.New so it could carry a code. Both
 // comparisons callers already use have to survive that.
 func TestErrNoProfileStillCompares(t *testing.T) {
```

**File**: `cli/pkg/credential/managed_credential.go` (modified, +16/-0)
```diff
@@ -59,6 +59,22 @@ func LoadManagedCredential() (*ManagedCredential, bool) {
 	return cred, true
 }
 
+// managedCredentialMounted reports whether this process is running inside a
+// container the platform issued a credential to.
+//
+// It asks a weaker question than LoadManagedCredential on purpose: a mount
+// that is present but malformed is still a mount, and what to do about it is
+// still "repair the application" rather than "log in". Only the presence of
+// the file is read, never its contents.
+func managedCredentialMounted() bool {
+	dir := strings.TrimSpace(os.Getenv(EnvCredentialsDir))
+	if dir == "" {
+		return false
+	}
+	_, err := os.Stat(filepath.Join(dir, credentialFilename))
+	return err == nil
+}
+
 // loadManagedCredentialFrom is the testable core: it reports why a directory
 // yielded no credential instead of collapsing everything into a bool.
 func loadManagedCredentialFrom(dir string) (*ManagedCredential, error) {
```

**File**: `cli/pkg/credential/managed_import.go` (modified, +11/-5)
```diff
@@ -180,12 +180,18 @@ func (m *managedImporter) adoptTokenEntry(olaresID string, deadAt time.Time) {
 	}
 }
 
-// save degrades a write failure to a warning. config.json lands under a
-// directory the container may not be able to create — HOME is sometimes / and
-// sometimes read-only — and refusing to run every other verb over that would
-// be a far bigger failure than the managed profile being absent.
+// save degrades a write failure to a warning, because refusing to run every
+// other verb over it would be a far bigger failure than the managed profile
+// being absent.
+//
+// Reaching this now takes an explicit $OLARES_CLI_HOME pointing somewhere
+// unwritable: cachedir already moves off a platform cache directory it cannot
+// write to, so the container case that used to land here no longer does. The
+// warning names the consequence rather than just the errno, since what the
+// reader is about to see is a command claiming no profile is configured.
 func (m *managedImporter) save(cfg *cliconfig.MultiProfileConfig) {
 	if err := cliconfig.SaveMultiProfileConfig(cfg); err != nil {
-		fmt.Fprintf(m.stderr, "warning: cannot persist the platform-issued profile: %v\n", err)
+		fmt.Fprintf(m.stderr,
+			"warning: cannot persist the platform-issued profile, so later commands will not see it: %v\n", err)
 	}
 }
```

---

### Incident Patch 14: `e151877a` (2026-09-20)
**Commit Message**: fix(cli): stop sending a managed container to profile login

ErrNoProfile named the one recovery a platform-issued identity refuses.
Inside a container whose credential app-service mounted, nothing local can
mint that grant and RequireNotManaged rejects the attempt, so the message
and the envelope's action now point at repairing the application instead.

The singleton stays an empty struct and reads the machine when it renders:
what is missing is the same either way, and which recovery applies is a
property of where the command ran.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `cli/pkg/credential/envelope_test.go` (modified, +30/-0)
```diff
@@ -5,6 +5,9 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
 	"testing"
 	"time"
 
@@ -87,6 +90,33 @@ func TestAManagedCredentialIsNotSentToProfileLogin(t *testing.T) {
 	}
 }
 
+// "Nothing is configured" inside a container the platform issued a credential
+// to means the mount failed to become a profile, not that the user forgot to
+// log in. Sending them to `profile login` there costs them a round of trying
+// a command that is refused.
+func TestNoProfileInAManagedContainerDoesNotSayLogin(t *testing.T) {
+	dir := t.TempDir()
+	if err := os.WriteFile(filepath.Join(dir, credentialFilename), []byte("{}"), 0o600); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Setenv(EnvCredentialsDir, dir)
+
+	body := envelopeFor(t, ErrNoProfile)
+	action, _ := body["action"].(string)
+	message, _ := body["message"].(string)
+	for field, text := range map[string]string{"action": action, "message": message} {
+		if text == "" {
+			t.Fatalf("%s is empty", field)
+		}
+		if strings.Contains(text, "profile login") || strings.Contains(text, "profile import") {
+			t.Errorf("%s points at a command that is refused for managed credentials: %q", field, text)
+		}
+	}
+	if body["code"] != clierr.CodeAuthNoProfile {
+		t.Errorf("code = %v, want it unchanged at %q", body["code"], clierr.CodeAuthNoProfile)
+	}
+}
+
 // ErrNoProfile stopped being errors.New so it could carry a code. Both
 // comparisons callers already use have to survive that.
 func TestErrNoProfileStillCompares(t *testing.T) {
```

**File**: `cli/pkg/credential/managed_credential.go` (modified, +16/-0)
```diff
@@ -59,6 +59,22 @@ func LoadManagedCredential() (*ManagedCredential, bool) {
 	return cred, true
 }
 
+// managedCredentialMounted reports whether this process is running inside a
+// container the platform issued a credential to.
+//
+// It asks a weaker question than LoadManagedCredential on purpose: a mount
+// that is present but malformed is still a mount, and what to do about it is
+// still "repair the application" rather than "log in". Only the presence of
+// the file is read, never its contents.
+func managedCredentialMounted() bool {
+	dir := strings.TrimSpace(os.Getenv(EnvCredentialsDir))
+	if dir == "" {
+		return false
+	}
+	_, err := os.Stat(filepath.Join(dir, credentialFilename))
+	return err == nil
+}
+
 // loadManagedCredentialFrom is the testable core: it reports why a directory
 // yielded no credential instead of collapsing everything into a bool.
 func loadManagedCredentialFrom(dir string) (*ManagedCredential, error) {
```

**File**: `cli/pkg/credential/managed_import.go` (modified, +11/-5)
```diff
@@ -180,12 +180,18 @@ func (m *managedImporter) adoptTokenEntry(olaresID string, deadAt time.Time) {
 	}
 }
 
-// save degrades a write failure to a warning. config.json lands under a
-// directory the container may not be able to create — HOME is sometimes / and
-// sometimes read-only — and refusing to run every other verb over that would
-// be a far bigger failure than the managed profile being absent.
+// save degrades a write failure to a warning, because refusing to run every
+// other verb over it would be a far bigger failure than the managed profile
+// being absent.
+//
+// Reaching this now takes an explicit $OLARES_CLI_HOME pointing somewhere
+// unwritable: cachedir already moves off a platform cache directory it cannot
+// write to, so the container case that used to land here no longer does. The
+// warning names the consequence rather than just the errno, since what the
+// reader is about to see is a command claiming no profile is configured.
 func (m *managedImporter) save(cfg *cliconfig.MultiProfileConfig) {
 	if err := cliconfig.SaveMultiProfileConfig(cfg); err != nil {
-		fmt.Fprintf(m.stderr, "warning: cannot persist the platform-issued profile: %v\n", err)
+		fmt.Fprintf(m.stderr,
+			"warning: cannot persist the platform-issued profile, so later commands will not see it: %v\n", err)
 	}
 }
```

**File**: `cli/pkg/credential/provider.go` (modified, +12/-0)
```diff
@@ -46,15 +46,27 @@ func NewCredentialProvider(managed, local Provider) *CredentialProvider {
 // different things done.
 var ErrNoProfile error = noProfileError{}
 
+// noProfileError stays an empty struct so the singleton keeps comparing equal
+// (TestErrNoProfileStillCompares), and reads the machine when it is rendered
+// rather than when it is built. What is missing is the same either way; which
+// recovery applies is a property of where the command ran, and inside a
+// container the platform issued a credential to, `profile login` is not it —
+// RequireNotManaged refuses it, and nothing local could mint that grant.
 type noProfileError struct{}
 
 func (noProfileError) Error() string {
+	if managedCredentialMounted() {
+		return "no Olares profile is configured: the platform-issued credential for this application is mounted but could not be loaded; reinstall or repair the application that requested it"
+	}
 	return "no Olares profile is configured: run `olares-cli profile login --olares-id <id>` or `olares-cli profile import --olares-id <id> --refresh-token <tok>`"
 }
 
 func (noProfileError) ErrorCode() string { return clierr.CodeAuthNoProfile }
 func (noProfileError) Retryable() *bool  { return &no }
 func (noProfileError) RecoveryAction() string {
+	if managedCredentialMounted() {
+		return managedRecovery("")
+	}
 	return "olares-cli profile login --olares-id <id>"
 }
 
```

---

### Incident Patch 15: `c85617c2` (2026-09-20)
**Commit Message**: fix(cli): skip a cache directory the process cannot write to

app-service exports $OLARES_CLI_CACHE_DIR at an emptyDir it mounts for
permission.loginOlaresCLI, and cliconfig.Home and keychain.StorageDir both
took that variable at its word. An agent sandbox breaks the promise: the
mount is present and world-writable by its mode bits, and every write is
refused anyway, so the platform-issued profile reached the process and
evaporated with it. The next command reported that no profile was
configured, which sends a user to `profile login` — the one recovery a
platform-issued identity refuses.

Resolve the rung through internal/cachedir instead, which verifies it by
writing and substitutes a stable per-uid directory under TempDir when it
cannot. Config, keychain and the refresh locks all hang off that one base,
so they move together. A host install sets no cache directory, resolves
exactly as before, and has no directory created behind its back.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `cli/internal/cachedir/cachedir.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+// Package cachedir resolves the base directory olares-cli keeps its derived
+// state under — the profile index, the encrypted keychain, and the locks that
+// serialize both — inside a container the platform injected a credential into.
+//
+// app-service mounts an emptyDir and exports $OLARES_CLI_CACHE_DIR at it, and
+// both cliconfig.Home and keychain.StorageDir used to take that variable at
+// its word. An agent sandbox breaks the promise: dsh confines the shell to the
+// session workspace, so the mount is present, world-writable by its mode bits,
+// and still refuses every write. What the platform issued then reaches the
+// process and evaporates with it, and the next command reports that no profile
+// is configured — the one diagnosis that sends a user to `profile login`, which
+// is exactly what a platform-issued identity refuses.
+//
+// So the rung is verified rather than trusted, and a rung that cannot be
+// written to is skipped instead of failed on.
+package cachedir
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"sync"
+)
+
+// EnvCacheDir is app-service's contract with the container. The literal is
+// duplicated from credential.EnvCacheDir because that package imports
+// cliconfig, which imports this one.
+const EnvCacheDir = "OLARES_CLI_CACHE_DIR"
+
+// Resolution is memoized per distinct input rather than once per process:
+// probing costs a create and an unlink, Home() is called several times per
+// command, and keying on the inputs keeps a test that changes them honest
+// without a reset hook in the production API.
+var (
+	mu       sync.Mutex
+	cacheKey string
+	cached   string
+)
+
+// Base returns the writable base directory for platform-injected state, and
+// whether there is one at all.
+//
+// A false second return means this is not a managed container: $OLARES_CLI_CACHE_DIR
+// is unset, or nothing derived from it could be written to. Callers keep their
+// own lookup chain for that case, so a host install resolves exactly as it did
+// before this package existed — including creating no directories, since the
+// only way to tell a writable directory from an unwritable one is to write.
+//
+// When true, the layout under the returned base is the same whether it is the
+// platform's directory or the fallback, so a caller joins its own subdirectory
+// without asking which one it got.
+func Base() (string, bool) {
+	configured := os.Getenv(EnvCacheDir)
+	key := configured + "\x00" + os.TempDir()
+
+	mu.Lock()
+	defer mu.Unlock()
+	if key != cacheKey {
+		cached = resolve(configured)
+		cacheKey = key
+	}
+	return cached, cached != ""
+}
+
+func resolve(configured string) string {
+	if configured == "" {
+		return ""
+	}
+	cleaned := filepath.Clean(configured)
+	if !filepath.IsAbs(cleaned) {
+		// Matches keychain's narrow reading of its own directory variables:
+		// a relative path floats with cwd, which is nobody's intent.
+		debugf("ignoring relative %s=%q", EnvCacheDir, configured)
+		return ""
+	}
+	if usable(cleaned) {
+		return cleaned
+	}
+	fallback := tempBase()
+	if usable(fallback) {
+		debugf("%s=%q is not writable; using %q instead", EnvCacheDir, cleaned, fallback)
+		return fallback
+	}
+	debugf("neither %q nor %q is writable", cleaned, fallback)
+	return ""
+}
+
+// tempBase is stable across invocations on purpose: a random directory would
+// make every command re-import the mounted credential and exchange the refresh
+// token again. The uid is in the name because /tmp is shared, and a directory
+// left by another account would be one this process cannot use.
+func tempBase() string {
+	name := "olares-cli"
+	if uid := os.Getuid(); uid >= 0 {
+		name = fmt.Sprintf("olares-cli-%d", uid)
+	}
+	return filepath.Join(os.TempDir(), name)
+}
+
+// usable answers the only question that matters by performing the operation in
+// question. A permission probe would not do: Landlock and seccomp-style
+// confinement deny the syscall while leaving the mode bits that access(2)
+// reports untouched, which is precisely how /olares/cache reads as 0777 and
+// rejects mkdir.
+func usable(dir string) bool {
+	if fi, err := os.Lstat(dir); err == nil && fi.Mode()&os.ModeSymlink != 0 {
+		return false
+	}
+	if err := os.MkdirAll(dir, 0o700); err != nil {
+		return false
+	}
+	probe, err := os.CreateTemp(dir, ".writable-*")
+	if err != nil {
+		return false
+	}
+	name := probe.Name()
+	_ = probe.Close()
+	_ = os.Remove(name)
+	return true
+}
+
+// debugf shares OLARES_CLI_DEBUG with credential.debugManaged and the keychain
+// hints: resolution runs before every command, so a rung being skipped is only
+// worth saying when somebody is asking.
+func debugf(format string, args ...any) {
+	if os.Getenv("OLARES_CLI_DEBUG") == "" {
+		return
+	}
+	fmt.Fprintf(os.Stderr, "[olares-cli cachedir] "+format+"\n", args...)
+}
```

**File**: `cli/internal/cachedir/cachedir_test.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package cachedir
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+// A host install sets nothing, so every caller keeps its own lookup chain and
+// no directory is created behind its back.
+func TestBase_UnsetIsNotAManagedContainer(t *testing.T) {
+	t.Setenv(EnvCacheDir, "")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want no base", got)
+	}
+}
+
+// The ordinary managed container: the platform's directory is writable and is
+// used as it is.
+func TestBase_UsesWritableCacheDir(t *testing.T) {
+	dir := writableDir(t)
+	t.Setenv(EnvCacheDir, dir)
+
+	got, ok := Base()
+	if !ok || got != dir {
+		t.Fatalf("Base() = %q, %v; want %q, true", got, ok, dir)
+	}
+}
+
+// The agent-sandbox case this package exists for: the mount is there, its mode
+// bits say world-writable, and the write is refused anyway.
+func TestBase_UnwritableCacheDirFallsBackToTemp(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	tmp := writableDir(t)
+	t.Setenv("TMPDIR", tmp)
+	t.Setenv(EnvCacheDir, denied)
+
+	got, ok := Base()
+	if !ok {
+		t.Fatal("Base() found nowhere to write, want the temp fallback")
+	}
+	if !strings.HasPrefix(got, tmp) {
+		t.Fatalf("Base() = %q, want a directory under %q", got, tmp)
+	}
+	if fi, err := os.Stat(got); err != nil || !fi.IsDir() {
+		t.Fatalf("fallback %q is not a usable directory: %v", got, err)
+	}
+}
+
+// The fallback has to be the same directory next time, or every command would
+// re-import the mounted credential and exchange the refresh token again.
+func TestBase_FallbackIsStableAcrossResolutions(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	t.Setenv("TMPDIR", writableDir(t))
+	t.Setenv(EnvCacheDir, denied)
+
+	first, _ := Base()
+	if second := resolve(denied); second != first {
+		t.Fatalf("re-resolved to %q, want the same %q", second, first)
+	}
+}
+
+// A relative path floats with cwd, which is nobody's intent; it is declined
+// rather than joined onto wherever the command happened to run.
+func TestBase_RelativeCacheDirIsDeclined(t *testing.T) {
+	t.Setenv(EnvCacheDir, "relative-cache")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want the relative path declined", got)
+	}
+}
+
+// writableDir returns a real directory, resolved through symlinks so a
+// comparison against what Base() returns is not defeated by /var -> /private/var.
+func writableDir(t *testing.T) string {
+	t.Helper()
+	dir, err := filepath.EvalSymlinks(t.TempDir())
+	if err != nil {
+		t.Fatalf("resolve temp dir: %v", err)
+	}
+	return dir
+}
```

**File**: `cli/internal/keychain/keychain_other.go` (modified, +8/-14)
```diff
@@ -10,6 +10,8 @@ import (
 	"path/filepath"
 
 	"github.com/google/uuid"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // AES constants and crypto helpers (encryptData / decryptData) plus
@@ -21,20 +23,14 @@ import (
 // avoids accidental clashes with lark-cli on machines that have both.
 const dataDirEnv = "OLARES_CLI_DATA_DIR"
 
-// cacheDirEnv is set by app-service's cli-credential webhook and points at a
-// writable emptyDir. An application container's HOME is frequently read-only
-// or belongs to a different uid than the process, so without this the very
-// first Set would fail to create the master key. The literal is duplicated
-// from credential.EnvCacheDir rather than imported, matching how this package
-// already keeps dataDirEnv to itself.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
-
 // StorageDir returns the absolute directory for service-scoped encrypted
 // blobs on Linux. The lookup chain is:
 //
 //  1. $OLARES_CLI_DATA_DIR if it's an absolute, cleanly-resolved path,
-//  2. $OLARES_CLI_CACHE_DIR/keychain, same absolute-path rule, which only
-//     exists inside a container the platform injected a credential into,
+//  2. `keychain/<service>` under the platform cache base, which only exists
+//     inside a container the platform injected a credential into. cachedir
+//     owns that rung, including the substitution it makes when the exported
+//     directory turns out not to be writable.
 //  3. XDG-style ~/.local/share/<service>,
 //  4. an absolute fallback under os.TempDir() when HOME is unresolvable.
 //     Earlier versions returned ".local/share/<service>" relative to CWD,
@@ -47,10 +43,8 @@ func StorageDir(service string) string {
 			return filepath.Join(safeDir, service)
 		}
 	}
-	if dir := os.Getenv(cacheDirEnv); dir != "" {
-		if safeDir, ok := safeAbsoluteDir(dir); ok {
-			return filepath.Join(safeDir, "keychain", service)
-		}
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "keychain", service)
 	}
 	home, err := os.UserHomeDir()
 	if err != nil || home == "" {
```

**File**: `cli/pkg/cliconfig/paths.go` (modified, +15/-7)
```diff
@@ -11,6 +11,8 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // homeEnv is the environment variable used to override the config dir, mirroring
@@ -21,8 +23,9 @@ const homeEnv = "OLARES_CLI_HOME"
 // writable emptyDir mounted into an application container. It sits between
 // the explicit override and $HOME so a managed container gets a config dir it
 // can actually write to, without changing anything on a host install where
-// the variable is unset.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
+// the variable is unset. Whether it is writable is cachedir's question to
+// answer, not ours; the name is kept here for the tests that set it.
+const cacheDirEnv = cachedir.EnvCacheDir
 
 // defaultDir is the directory name used under $HOME when $OLARES_CLI_HOME is
 // unset.
@@ -52,15 +55,20 @@ const (
 )
 
 // Home returns the resolved olares-cli config directory: $OLARES_CLI_HOME,
-// then $OLARES_CLI_CACHE_DIR/config, then $HOME/.olares-cli. The directory is
-// NOT created here — callers that intend to write should call EnsureHome
-// instead.
+// then the platform cache base's `config`, then $HOME/.olares-cli. The
+// directory is NOT created here — callers that intend to write should call
+// EnsureHome instead.
+//
+// The middle rung goes through cachedir, which substitutes a writable
+// directory when the one the platform exported cannot be written to. Reads
+// resolve through the same call, so config.json is looked for where the last
+// write actually landed.
 func Home() (string, error) {
 	if v := os.Getenv(homeEnv); v != "" {
 		return v, nil
 	}
-	if v := os.Getenv(cacheDirEnv); v != "" {
-		return filepath.Join(v, "config"), nil
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "config"), nil
 	}
 	home, err := os.UserHomeDir()
 	if err != nil {
```

**File**: `cli/pkg/credential/managed_import_test.go` (modified, +29/-0)
```diff
@@ -343,6 +343,35 @@ func TestImport_UnwritableConfigWarnsAndContinues(t *testing.T) {
 	}
 }
 
+// An agent sandbox refuses writes to the directory the platform exported,
+// which used to mean the mounted identity lived only as long as the process
+// and every later command reported that no profile was configured. The entry
+// has to survive to disk somewhere the process can actually write.
+func TestImport_UnwritableCacheDirStillLandsTheProfile(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	h := newImportHarness(t, testCredential())
+	denied := t.TempDir()
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	t.Setenv("OLARES_CLI_HOME", "")
+	t.Setenv("TMPDIR", t.TempDir())
+	t.Setenv("OLARES_CLI_CACHE_DIR", denied)
+
+	h.run(context.Background())
+
+	p := loadProfile(t, managedID)
+	if p == nil || !p.Managed {
+		t.Fatalf("profile = %+v, want a managed entry readable by the next command", p)
+	}
+	if h.stderr.Len() != 0 {
+		t.Errorf("stderr = %q, want silence once the write found a home", h.stderr.String())
+	}
+}
+
 // A mount naming something that is not a parseable Olares ID is skipped
 // rather than turned into a profile no URL can be derived from.
 func TestImport_UnparseableOlaresIDIsSkipped(t *testing.T) {
```

#### Recent Merged Pull Requests:
- **PR #4208** (2026-09-30): docs: generalize two-node cluster upgrade guide (@fnalways)
- **PR #4206** (2026-09-30): docs: add BIOS version 107 to changelog (@Power-One-2025)
- **PR #4205** (2026-09-30): docs: refresh multilingual READMEs for Olares 1.12.7 (@fnalways)
- **PR #4204** (2026-10-01): docs: add tutorial for FlowStudio (@Power-One-2025)
- **PR #4202** (2026-09-29): chore: bump version to 1.12.8 (@eball)
- **PR #4200** (2026-09-28): docs: clarify system error support and log collection options (@fnalways)
- **PR #4199** (2026-09-30): docs: add OpenClaw Android and iOS pairing guides (@TShentu)
- **PR #4198** (2026-09-29): docs: add Wake-on-LAN guide for Olares One (@fnalways)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
