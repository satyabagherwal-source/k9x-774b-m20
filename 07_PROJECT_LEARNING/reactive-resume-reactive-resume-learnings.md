# Forensic Learning Record (Deep Inspection): reactive-resume/reactive-resume

> **Canonical Artifact**: `07_PROJECT_LEARNING/reactive-resume-reactive-resume-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/reactive-resume/reactive-resume](https://github.com/reactive-resume/reactive-resume))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:52:07.502Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `reactive-resume/reactive-resume`
- **Description**: A one-of-a-kind resume builder that keeps your privacy in mind. Completely secure, customizable, portable, open-source and free forever. Try it out today!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 43840 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/src/dialogs/renderers.tsx`
```
import type { DialogSchema } from "./schemas";
import { authDialogRenderers } from "./auth/registry";
import { documentDialogRenderers } from "./document/registry";
import { resumeDialogRenderers } from "./resume/registry";

const dialogRendererByType = new Map(
	[...authDialogRenderers, ...documentDialogRenderers, ...resumeDialogRenderers].map(
		(renderer) => [renderer.type, renderer] as const,
	),
);

export const renderDialog = (dialog: DialogSchema | null) => {
	if (!dialog) return null;
	const renderer = dialogRendererByType.get(dialog.type);
	if (renderer) return renderer.render(dialog as never);
	return null;
};

```

### Core Architecture Module: `apps/web/src/features/ats-checker/report/score-header.tsx`
```
import type { PdfAtsReport } from "@reactive-resume/resume/ats-pdf";
import type { CSSProperties } from "react";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reactive-resume/ui/components/tooltip";
import { cn } from "@reactive-resume/utils/style";
import { getPdfFindingMessage } from "../messages";

function scoreTone(score: number) {
	if (score >= 80) return { text: "text-accent-text", bar: "bg-accent" };
	if (score >= 60) return { text: "text-warn-text", bar: "bg-warn" };
	return { text: "text-danger-text", bar: "bg-danger" };
}

type ScoreHeaderProps = {
	report: PdfAtsReport;
};

export function ScoreHeader({ report }: ScoreHeaderProps) {
	const tone = scoreTone(report.score);
	const [cap] = report.cappedBy;

	return (
		<div className="space-y-3 rounded-md border bg-surface p-3">
			<div className="flex items-baseline gap-2">
				<span className={cn("text-4xl leading-none font-bold tabular-nums", tone.text)}>{report.score}</span>
				<span className="text-sm text-ink-3">
					<Trans>out of 100</Trans>
				</span>
			</div>

			{/* Fills from empty when the report first shows. The starting --fill needs !important to beat the inline one; it's derived through --fill so RTL still fills from the right. */}
			<div className="h-1.5 overflow-hidden rounded-full bg-sunken">
				<div
					className={cn(
						"h-full translate-x-(--fill) rounded-full transition-[translate,background-color] duration-emphasized ease-enter rtl:-translate-x-(--fill) starting:[--fill:-100%]!",
						tone.bar,
					)}
					style={{ "--fill": `${report.score - 100}%` } as CSSProperties}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
				<span>
					<Trans>
						{report.passedChecks} of {report.applicableChecks} applicable checks passed
					</Trans>
				</span>

				{report.skippedChecks > 0 && (
					<Tooltip>
						<TooltipTrigger
							render={
								<span className="inline-flex cursor-help items-center gap-1 underline decoration-dotted underline-offset-2">
									<Trans>{report.skippedChecks} skipped</Trans>
									<Icon name="info" size={12} />
								</span>
							}
						/>
						<TooltipContent side="bottom" className="max-w-64">
							<Trans>
								Some checks need information this file does not carry: page contents that could not be inspected, or
								text in a language these checks do not cover. They count as neither a pass nor a fail.
							</Trans>
						</TooltipContent>
					</Tooltip>
				)}
			</div>

			{cap && (
				<p className="rounded-md bg-sunken/60 p-2 text-xs leading-normal text-ink-3">
					<Trans>The score is capped because of a blocking problem: {getPdfFindingMessage(cap).title}</Trans>
				</p>
			)}
		</div>
	);
}

```

### Core Architecture Module: `apps/web/src/features/homepage/prerender.tsx`
```
/**
 * Renders the public marketing pages, the landing page and the ATS checker, to HTML, one file per locale, at build time
 * (see `prerenderPages` in vite.config.ts). The server sends the file for the visitor's locale, so every heading and
 * paragraph is in the first response and the page paints before any JavaScript runs; React renders the live page in
 * its place once the route has loaded.
 */
import type { IconProps } from "@phosphor-icons/react";
import type { Locale } from "@reactive-resume/utils/locale";
import type { ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { IconContext } from "@phosphor-icons/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { isRTL, localeSchema } from "@reactive-resume/utils/locale";
import { Homepage } from "./page";
import { AtsCheckerPage } from "@/features/ats-checker/page";
import { ThemeProvider } from "@/features/theme/provider";
import { getLocaleMessages } from "@/libs/locale";
import { getAtsCheckerMeta, getHomepageMeta } from "@/libs/seo";
import { Header } from "@/routes/_home/-sections/header";

export const locales = localeSchema.options;

// Matches the root route's icon defaults (routes/__root.tsx), which the marketing header's icons inherit.
const iconContextValue: IconProps = { size: 16, weight: "regular" };

const pages = {
	home: { path: "/", meta: getHomepageMeta, render: () => <Homepage /> },
	// What the /_home layout renders around the checker for a signed-out visitor (routes/_home/route.tsx).
	"ats-checker": {
		path: "/ats-checker",
		meta: getAtsCheckerMeta,
		render: () => (
			<>
				<Header />
				<AtsCheckerPage signedIn={false} importPending={false} />
			</>
		),
	},
} satisfies Record<
	string,
	{ path: string; meta: () => { title: string; description: string }; render: () => ReactNode }
>;

type PrerenderedPage = keyof typeof pages;
export const prerenderedPages = Object.keys(pages) as PrerenderedPage[];

export async function renderPage(name: PrerenderedPage, locale: Locale) {
	const page = pages[name];
	const { messages } = await getLocaleMessages(locale);
	i18n.loadAndActivate({ locale, messages });

	// Links only need a router to build their hrefs; nothing is loaded or navigated.
	const router = createRouter({
		routeTree: createRootRoute(),
		history: createMemoryHistory({ initialEntries: [page.path] }),
	});
	const dir = isRTL(locale) ? "rtl" : "ltr";

	const html = renderToString(
		<RouterContextProvider router={router}>
			<QueryClientProvider client={new QueryClient()}>
				<I18nProvider i18n={i18n}>
					<IconContext.Provider value={iconContextValue}>
						<ThemeProvider theme="system">
							<DirectionProvider direction={dir}>{page.render()}</DirectionProvider>
						</ThemeProvider>
					</IconContext.Provider>
				</I18nProvider>
			</QueryClientProvider>
		</RouterContextProvider>,
	);

	return { html, dir, ...page.meta() };
}

```

### Core Architecture Module: `apps/web/src/features/resume/export/pdf.worker.ts`
```
/// <reference lib="webworker" />

import type { PdfWorkerRequest, PdfWorkerResponse } from "./pdf-document";
import type { PageMap } from "@reactive-resume/pdf/page-map";
import { createResumePdfBlob } from "@reactive-resume/pdf/browser";
import { createSectionTitleResolverForLocale } from "@/libs/resume/section-title-locale";

// Renders off the main thread, so typing, scrolling and the gallery stay smooth while a page is laid out.
self.addEventListener("message", async ({ data: request }: MessageEvent<PdfWorkerRequest>) => {
	const { id, data, template, renderOptions } = request;
	try {
		let pageMap: PageMap | undefined;
		const blob = await createResumePdfBlob({
			data,
			template,
			renderOptions,
			resolveSectionTitle: await createSectionTitleResolverForLocale(data.metadata.page.locale),
			onPageMap: (map) => {
				pageMap = map;
			},
		});
		self.postMessage({ id, blob, pageMap } satisfies PdfWorkerResponse);
	} catch (error) {
		self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies PdfWorkerResponse);
	}
});

```

### Core Architecture Module: `apps/web/src/features/resume/preview/preview.shared.utils.ts`
```
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { CSSProperties } from "react";

export type PreviewPageSize = {
	height: number;
	width: number;
};

const PDF_PAGE_RENDER_SCALE = 4;
const MAX_PREVIEW_CANVAS_PIXELS = 16_777_216; // 4096 * 4096

export const DEFAULT_PDF_PAGE_SIZE: PreviewPageSize = {
	height: 841.89,
	width: 595.28,
};

export const getPreviewCanvasScale = (width: number, height: number) => {
	const devicePixelRatio = window.devicePixelRatio || 1;
	const desiredScale = Math.max(PDF_PAGE_RENDER_SCALE, devicePixelRatio);
	const desiredPixels = width * height * desiredScale * desiredScale;

	if (desiredPixels <= MAX_PREVIEW_CANVAS_PIXELS) return desiredScale;

	return Math.sqrt(MAX_PREVIEW_CANVAS_PIXELS / (width * height));
};

export const getScaledPreviewPageSize = (pageSize: PreviewPageSize, pageScale: number): PreviewPageSize => ({
	height: pageSize.height * pageScale,
	width: pageSize.width * pageScale,
});

export const getResumePreviewGapValue = (pageGap: CSSProperties["gap"]) =>
	typeof pageGap === "number" && pageGap !== 0 ? `${pageGap}px` : pageGap;

export const getResumePreviewPageCount = (data?: ResumeData) => Math.max(1, data?.metadata.layout.pages.length ?? 1);

```

### Core Architecture Module: `apps/web/src/features/resume/stylesheet/stylesheet.worker.ts`
```
/// <reference lib="webworker" />

import type { CompileWorkerRequest, CompileWorkerResponse } from "./protocol";
import { compileStylesheet, resolveStylesheet } from "@reactive-resume/resume/stylesheet";
import { collectCompiledColorTokens } from "./color-tokens";

self.addEventListener("message", ({ data }: MessageEvent<CompileWorkerRequest>) => {
	if (data.type !== "compile") return;
	const compiled = compileStylesheet(data.source);
	const diagnostics = compiled.program
		? [
				...compiled.diagnostics,
				...resolveStylesheet(compiled.program, data.semanticTree, {
					baseStyles: {},
					baseSettings: data.baseSettings,
					pages: data.pages,
				}).diagnostics,
			]
		: compiled.diagnostics;
	const response: CompileWorkerResponse = {
		type: "compile_result",
		requestId: data.requestId,
		editGeneration: data.editGeneration,
		program: compiled.program,
		diagnostics,
		colorTokens: collectCompiledColorTokens(data.source.text, compiled.program),
	};
	self.postMessage(response);
});

```

### Core Architecture Module: `apps/web/src/features/resume/stylesheet/worker-client.ts`
```
import type { CompileWorkerInput, CompileWorkerRequest, CompileWorkerResponse } from "./protocol";

type WorkerListener = (event: MessageEvent<unknown>) => void;
type WorkerErrorListener = (event: ErrorEvent) => void;

export type StylesheetWorker = {
	postMessage(message: unknown, transfer?: Transferable[]): void;
	terminate(): void;
	addEventListener(type: "message", listener: WorkerListener): void;
	addEventListener(type: "error", listener: WorkerErrorListener): void;
	removeEventListener(type: "message", listener: WorkerListener): void;
	removeEventListener(type: "error", listener: WorkerErrorListener): void;
};

type Pending<T> = {
	resolve(value: T): void;
	reject(error: Error): void;
};

export function createCompileWorkerClient(createWorker: () => StylesheetWorker) {
	const worker = createWorker();
	const pending = new Map<number, Pending<CompileWorkerResponse>>();
	let latestRequestId = 0;

	const onMessage: WorkerListener = ({ data }) => {
		const response = data as CompileWorkerResponse;
		if (response?.type !== "compile_result") return;
		const request = pending.get(response.requestId);
		if (!request) return;
		pending.delete(response.requestId);
		// Resolve every in-flight compile. Callers already generation-check; rejecting "stale"
		// results aborts the edit pipeline and can leave the editor stuck on Checking.
		request.resolve(response);
	};
	const onError: WorkerErrorListener = (event) => {
		const error = new Error(event.message || "Stylesheet compiler worker failed to load.");
		for (const request of pending.values()) request.reject(error);
		pending.clear();
	};
	worker.addEventListener("message", onMessage);
	worker.addEventListener("error", onError);

	return {
		compile(input: CompileWorkerInput): Promise<CompileWorkerResponse> {
			const requestId = ++latestRequestId;
			const request: CompileWorkerRequest = { ...input, type: "compile", requestId };
			return new Promise((resolve, reject) => {
				pending.set(requestId, { resolve, reject });
				worker.postMessage(request);
			});
		},
		destroy() {
			worker.removeEventListener("message", onMessage);
			worker.removeEventListener("error", onError);
			worker.terminate();
			for (const request of pending.values()) request.reject(new Error("Stylesheet compiler worker was terminated."));
			pending.clear();
		},
	};
}

```

### Core Architecture Module: `apps/web/src/features/settings/account/auth-hooks.ts`
```
import type { AuthProvider } from "@reactive-resume/auth/types";
import { t } from "@lingui/core/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { match } from "ts-pattern";
import { toast } from "@reactive-resume/ui/components/toast";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/**
 * Get the display name for a social provider
 */
export function getProviderName(providerId: AuthProvider): string {
	return match(providerId)
		.with("credential", () =>
			t({
				comment: "Authentication provider display name in account settings",
				message: "Password",
			}),
		)
		.with("passkey", () =>
			t({
				comment: "Authentication provider display name in account settings",
				message: "Passkey",
			}),
		)
		.with("google", () =>
			t({
				comment: "Authentication provider display name in account settings",
				message: "Google",
			}),
		)
		.with("github", () =>
			t({
				comment: "Authentication provider display name in account settings",
				message: "GitHub",
			}),
		)
		.with("linkedin", () =>
			t({
				comment: "Authentication provider display name in account settings",
				message: "LinkedIn",
			}),
		)
		.with("custom", () =>
			t({
				comment: "Authentication provider display name in account settings",
				message: "Custom OAuth",
			}),
		)
		.exhaustive();
}

/**
 * Hook to fetch and manage authentication accounts
 */
export function useAuthAccounts() {
	const { data: accounts } = useQuery({
		queryKey: ["auth", "accounts"],
		queryFn: () => authClient.listAccounts(),
		select: ({ data }) => data ?? [],
	});

	const getAccountByProviderId = useCallback(
		(providerId: string) => accounts?.find((account) => account.providerId === providerId),
		[accounts],
	);

	const hasAccount = useCallback(
		(providerId: string) => !!getAccountByProviderId(providerId),
		[getAccountByProviderId],
	);

	return {
		accounts,
		hasAccount,
		getAccountByProviderId,
	};
}

/**
 * Hook to manage authentication provider linking/unlinking
 */
export function useAuthProviderActions() {
	const queryClient = useQueryClient();
	const link = useCallback(async (provider: AuthProvider) => {
		const providerName = getProviderName(provider);
		const toastId = toast.add({ type: "loading", description: t`Linking your ${providerName} account...` });

		const { error } = await authClient.linkSocial({ provider, callbackURL: "/dashboard/settings/account" });

		if (error) {
			toast.add({
				type: "error",
				description: getReadableErrorMessage(
					error,
					t({
						comment: "Fallback toast when linking a social authentication provider fails",
						message: "Failed to link provider. Please try again.",
					}),
				),
				id: toastId,
			});
			return;
		}

		toast.close(toastId);
	}, []);

	const unlink = useCallback(
		async (provider: AuthProvider, accountId: string) => {
			const providerName = getProviderName(provider);
			const toastId = toast.add({
				type: "loading",
				description: t`Unlinking your ${providerName} account...`,
			});

			const { error } = await authClient.unlinkAccount({ accountId });

			if (error) {
				toast.add({
					type: "error",
					description: getReadableErrorMessage(
						error,
						t({
							comment: "Fallback toast when unlinking a social authentication provider fails",
							message: "Failed to unlink provider. Please try again.",
						}),
					),
					id: toastId,
				});
				return;
			}

			toast.close(toastId);
			await queryClient.invalidateQueries({ queryKey: ["auth", "accounts"] });
		},
		[queryClient],
	);

	return { link, unlink };
}

/**
 * Hook to get enabled social providers for the current user
 * Possible values: "credential", "google", "github", "linkedin", "custom"
 */
export function useEnabledProviders() {
	const { data: enabledProviders = {} } = useQuery(orpc.auth.providers.list.queryOptions());

	return { enabledProviders };
}

```

### Core Architecture Module: `apps/web/src/features/settings/integrations/hooks/use-has-usable-ai-provider.ts`
```
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/libs/orpc/client";

/**
 * Single source of truth for "is an AI provider ready to use" (enabled AND its connection test succeeded).
 * Replaces the predicate that was duplicated across the import dialog, agent setup, and AI settings.
 */
export function useHasUsableAiProvider() {
	const { data: providers, isLoading, error } = useQuery(orpc.aiProviders.list.queryOptions());
	const usableProviders = (providers ?? []).filter((provider) => provider.enabled && provider.testStatus === "success");

	return {
		error,
		hasUsableProvider: usableProviders.length > 0,
		isLoading,
		usableProviders,
	};
}

```

### Core Architecture Module: `apps/web/src/hooks/use-closing-value.ts`
```
import { useState } from "react";

/**
 * Keeps an overlay's content on screen while it animates closed. Pass what the overlay shows (null when closed),
 * render from the returned value, and hand the returned callback to the overlay Root's `onOpenChangeComplete`.
 * The last non-null value is held through the exit animation and dropped once it has finished, so the next open
 * mounts fresh.
 */
export function useClosingValue<T>(value: T | null): readonly [T | null, (open: boolean) => void] {
	const [held, setHeld] = useState(value);
	if (value !== null && value !== held) setHeld(value);

	const onOpenChangeComplete = (open: boolean) => {
		if (!open) setHeld(null);
	};

	return [value ?? held, onOpenChangeComplete] as const;
}

```

### Core Architecture Module: `apps/web/src/hooks/use-confirm.tsx`
```
import { t } from "@lingui/core/macro";
import * as React from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@reactive-resume/ui/components/alert-dialog";
import { Input } from "@reactive-resume/ui/components/input";
import { cn } from "@reactive-resume/utils/style";
import { isImeComposing } from "@/libs/keyboard";

type AskOptions = {
	description?: string;
	confirmText?: string;
	cancelText?: string;
	/** Prompts only: the text the field starts with. */
	defaultValue?: string;
};

type AskState = AskOptions & {
	open: boolean;
	title: string;
	/** A prompt asks for text; a confirmation only for yes or no. */
	withInput: boolean;
	resolve: ((value: string | null) => void) | null;
};

type Ask = (title: string, options: AskOptions | undefined, withInput: boolean) => Promise<string | null>;

const AskContext = React.createContext<Ask | null>(null);

/** One dialog answers both `useConfirm` and `usePrompt`: a question, and a text field when it's a prompt. */
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = React.useState<AskState>({ open: false, title: "", withInput: false, resolve: null });
	const [value, setValue] = React.useState("");

	const ask: Ask = (title, options, withInput) =>
		new Promise((resolve) => {
			setValue(options?.defaultValue ?? "");
			setState({ ...options, open: true, title, withInput, resolve });
		});

	// Cancelling answers null; confirming answers the text (empty for a confirmation). The state stays while closing.
	const answer = (result: string | null) => {
		state.resolve?.(result);
		setState((previous) => ({ ...previous, open: false, resolve: null }));
	};

	return (
		<AskContext.Provider value={ask}>
			{children}

			<AlertDialog open={state.open} onOpenChange={(open) => !open && answer(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{state.title}</AlertDialogTitle>
						<AlertDialogDescription className={cn(!state.description && "sr-only")}>
							{state.description}
						</AlertDialogDescription>
					</AlertDialogHeader>

					{state.withInput && (
						<Input
							value={value}
							aria-label={state.title}
							onChange={(event) => setValue(event.target.value)}
							onKeyDown={(event) => {
								if (isImeComposing(event)) return;
								if (event.key === "Enter") answer(value);
							}}
						/>
					)}

					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => answer(null)}>{state.cancelText ?? t`Cancel`}</AlertDialogCancel>
						<AlertDialogAction onClick={() => answer(state.withInput ? value : "")}>
							{state.confirmText ?? t`Confirm`}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AskContext.Provider>
	);
}

function useAsk() {
	const ask = React.use(AskContext);
	if (!ask) throw new Error("useConfirm and usePrompt must be used within a <ConfirmDialogProvider />.");
	return ask;
}

/** Resolves true when the user confirms. */
export function useConfirm() {
	const ask = useAsk();
	return async (title: string, options?: Omit<AskOptions, "defaultValue">) =>
		(await ask(title, options, false)) !== null;
}

/** Resolves with the text entered, or null when the user cancels. */
export function usePrompt() {
	const ask = useAsk();
	return (title: string, options?: AskOptions) => ask(title, options, true);
}

```

### Core Architecture Module: `apps/web/src/hooks/use-controlled-state.tsx`
```
import { useState } from "react";

interface CommonControlledStateProps<T> {
	value?: T | undefined;
	defaultValue?: T | undefined;
}

type UseControlledStateProps<T, Rest extends unknown[] = []> = CommonControlledStateProps<T> & {
	onChange?: ((value: T, ...args: Rest) => void) | undefined;
};

export function useControlledState<T, Rest extends unknown[] = []>(
	props: UseControlledStateProps<T, Rest>,
): readonly [T, (next: T, ...args: Rest) => void] {
	const { value, defaultValue, onChange } = props;
	const isControlled = value !== undefined;

	const [internalState, setInternalState] = useState<T>(value !== undefined ? value : (defaultValue as T));
	const state = isControlled ? (value as T) : internalState;

	const setState = (next: T, ...args: Rest) => {
		if (!isControlled) setInternalState(next);
		onChange?.(next, ...args);
	};

	return [state, setState] as const;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3578** (2026-10-05): **Cannot delete section in v6**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Self-hosted  ### Reactive Resume version  6  ### Area  Resume builder & data  ### Environment  Docker compose  ### Summary  In the new version it is not possible to delete a section once it has been created. You can clear it and hide it, but not remove it.  <img width="407" height="600" alt="Image" src="https://github.com/user-attachments/assets/724cb58d-d45f-4a24-a7cc-c576dce46bc6" />  ### Steps to reproduce  1. Create a new section 2. Try to remove it/delete it  ### Expected behavior  To have a further button belo "Clear Section," which will be "Delete Section"  ### Actual behavior  No way to delete exists  ### Template  None  ### Logs and screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > These are default sections, which are expected to be in most resumes. You can hide default sections, or you can keep them empty and they won't show up on resumes, but you can only delete custom sections, not the base ones.

- **Issue #3576** (2026-10-05): **I can't access the dashboard**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Cloud  ### Reactive Resume version  6.0.0  ### Area  Resume builder & data  ### Environment  Windows 11 (64) and Brave 1.96.61   ### Summary  I'm having trouble logging in to the current version of rxresume (version 6). I can't access the dashboard and get stuck on the login screen. Previously, I was able to access the dashboard, but after I tried to export a PDF, I was redirected to the login screen. Then, when I tried to enter my email and password, I got stuck on that login page, and when I tried to click the “Sign In” button, a message appeared saying “Too many requests.”  https://github.com/user-attachments/assets/b0ca21ac-eda5-472a-b13d-b182bb795278  ### Steps to reproduce  I'm having trouble logging in to the current version of rxresume (version 6). I can't access the dashboard and get stuck on the login screen. Previously, I was able to access the dashboard, but after I tried to export a PDF, I was redirected to the login screen. Then, when I tried to enter my email and password, I got stuck on that login page, and when I tried to click the “Sign In” button, a message appeared saying “Too many requests.”   ### Expected behavior  https://github.com/user-attachments/assets/81721699-c05f-4643-8818-88098cbd27e8  ### Actual behavior  https://github.com/user-attachments/assets/be15fc49-f22c-47bd-8107-4f9734f78438  ### Template  None  ### Logs and screenshots 
  **Post-Mortem & Fix Analysis**:
  > Should be resolved now.

- **Issue #3574** (2026-10-05): **Resume.me is continuously logging out after Yesterdays upgrade**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Cloud  ### Reactive Resume version  5.x  ### Area  Resume builder & data  ### Environment  Chrome  ### Summary  Hi, I noticed that rxresu.me has been continuously logging me out since yesterday's upgrade.  Whenever I try to modify my resume, I get automatically logged out with a "Too Many Requests" error, even though I'm not making multiple or frequent requests.  Could you please check if there is an issue with the recent upgrade or the rate-limiting configuration?  ### Steps to reproduce  1. Login to rxresu.me  2. try to modify anything 3. if you work for 4 5 min it will logout 4. also opening resume in multiple tabs logs out from session.  ### Expected behavior  Auto logout issue  ### Actual behavior  Auto logout  ### Template  None  ### Logs and screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > I have the same issue.  <img width="2345" height="1520" alt="Image" src="https://github.com/user-attachments/assets/2450d79a-28e5-4033-9897-c7d9485bfe2c" />  Login doesn't work anymore, constantly redirect to login page. When login still stay the same login page (no redirect to another page)

- **Issue #3566** (2026-10-05): **[Bug] Cover letter PDFs omit the resume sender details even when the option is enabled**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Self-hosted  ### Reactive Resume version  5.3.1  ### Area  Applications & cover letters  ### Environment  Firefox 157 and Chromium 147 on Windows 11; self-hosted: v5.3.1 installed from source in a Debian 13 LXC container on Proxmox VE 9.2.11, run as a systemd service; PostgreSQL 16.15 and headless Chromium in the same LXC, no Docker  ### Summary  A cover letter created from the shared cover letter library stores sender details copied from a resume (name, email, phone, location, picture). The JSON export contains them, but the PDF preview and PDF download never render the resume sender details. The sender block is missing entirely, so the exported letter loses data that exists in the document.  ### Steps to reproduce  1. Have a resume with complete Basics data (name, email, phone, location, picture) and the default semantic stylesheet. 2. Go to Dashboard > Cover Letters, create or open a letter. Under **Sender details**, select that resume and click **Copy from resume**. 3. Click **Preview PDF** (or **Download PDF**). Use a template that renders the resume header, e.g. Gengar (header in the left sidebar). 4. Observe the PDF: the recipient and letter content render, but there is no header/sender block at all.  ### Expected behavior  The PDF should render the resume header (picture, name, contact details). The cover letter editor explicitly requests it (`includeCo

- **Issue #3562** (2026-10-05): **Unable to add AI provider in self-hosted deployment**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Self-hosted  ### Reactive Resume version  5.3.2  ### Area  API & integrations  ### Environment  Docker Compose  ### Summary  I am unable to input any AI integration information, it loops an error message.  ### Steps to reproduce  Self host and go to integrations in settings  ### Expected behavior  I can enter an AI API key  ### Actual behavior  I'm not able to  ### Template  _No response_  ### Logs and screenshots  ``` rxresume  | 2026-09-30T17:55:31.080937916Z [oRPC Server] Error: AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE rxresume  | 2026-09-30T17:55:31.080957082Z     at assertCredentialEncryptionConfigured (file:///app/apps/server/dist/app-Cb6NCeCT.mjs:336:49) rxresume  | 2026-09-30T17:55:31.080958955Z     at Object.list (file:///app/apps/server/dist/app-Cb6NCeCT.mjs:1200:3) rxresume  | 2026-09-30T17:55:31.080960185Z     at Object.handler (file:///app/apps/server/dist/app-Cb6NCeCT.mjs:3422:51) rxresume  | 2026-09-30T17:55:31.080961355Z     at file:///app/node_modules/.pnpm/@orpc+server@1.15.4_ws@8.21.3/node_modules/@orpc/server/dist/shared/server.DEBcqOjg.mjs:231:32 rxresume  | 2026-09-30T17:55:31.080962574Z     at runWithSpan (file:///app/node_modules/.pnpm/@orpc+shared@1.15.4/node_modules/@orpc/shared/dist/index.mjs:127:12) rxresume  | 2026-09-30T17:55:31.080963740Z     at next (file:///app/node_modules/.pnpm/@orpc+server@1.15.4_ws@8.21.3/node_modules/@orpc/serv
  **Post-Mortem & Fix Analysis**:
  > @tehniemer Try this:  Add an **ENCRYPTION_SECRET** env with another **openssl rand -hex 32**  Same thing that was done with ``` # --- Authentication --- # Generated using `openssl rand -hex 32` AUTH_SECRET="" ```  https://docs.rxresu.me/self-hosting/docker#ai-features-optional
  > Well, that was silly on my part. 

- **Issue #3551** (2026-10-05): **Redis DB String parsing broken**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Self-hosted  ### Reactive Resume version  v5.3.2  ### Area  Self-hosting  ### Environment  Portainer on TrueNAS Scale  ### Summary  Software failes to parse Redis String when presented just the password. The log is spammed with this message  ``` [redis] Connection error SimpleError [ReplyError]: WRONGPASS invalid username-password pair or user is disabled.      at Decoder._Decoder_decodeSimpleError (/app/node_modules/.pnpm/ioredis@6.0.0_supports-color@7.2.0/node_modules/ioredis/built/resp/decoder.js:450:11)      at Decoder._Decoder_decodeTypeValue (/app/node_modules/.pnpm/ioredis@6.0.0_supports-color@7.2.0/node_modules/ioredis/built/resp/decoder.js:126:215) {     command: {      name: 'hello',      args: [ '3', 'AUTH', 'blah', '<NoYouDontGetMyRedisPassword>' ]    }  } ```  The environment variable is set as such  ```       REDIS_URL: "redis://blah:${REDIS_PASSWORD}@${REDIS_HOSTNAME}:6379/${REDIS_DB}" ```  Redis is started with the following command ```       command: redis-server --save 20 1 --loglevel warning --requirepass  ${REDIS_PASSWORD} ```   Confirmed that its stops complaining when the password requirment is removed.   ### Steps to reproduce  1  Deploy application and Redis with the --requirepass option 2 Attempt to have the application use Redis  ### Expected behavior  Software to pares a Redis URL with just a password  redis://${REDIS_PASSWORD}@${RED
  **Post-Mortem & Fix Analysis**:
  > Found the log entry from when it was just the password:  ``` [redis] Connection error SimpleError [ReplyError]: WRONGPASS invalid username-password pair or user is disabled.      at Decoder._Decoder_decodeSimpleError (/app/node_modules/.pnpm/ioredis@6.0.0_supports-color@7.2.0/node_modules/ioredis/built/resp/decoder.js:450:11)      at Decoder._Decoder_decodeTypeValue (/app/node_modules/.pnpm/ioredis@6.0.0_supports-color@7.2.0/node_modules/ioredis/built/resp/decoder.js:126:215) {     command: {      name: 'hello',      args: [ '3', 'AUTH', '<NoYoStillDoNotGetMyRedisPassword>', '' ]    }  } ```  ```   REDIS_URL: "redis://${REDIS_PASSWORD}@${REDIS_HOSTNAME}:6379/${REDIS_DB}" ```

- **Issue #3519** (2026-09-21): **bronzor template does not pass deep check**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Cloud  ### Reactive Resume version  5.3.0  ### Area  Templates, preview & export  ### Environment  Windows 11, Vivaldi  ### Summary  when having the bronzor template selected, running ats checks returns 100% but the deep check returns 60%. however, any other template returns 100% on deep check for the exact same content. i have also tried to remove all icons or export the cv in json and reimport it but its the same.  ### Steps to reproduce  1. have the bronzor template selected 2. write the resume (making sure all required sections are filled with title, date, description, etc.) 3. run deep check  ### Expected behavior  what is expected is to have deep check return 100%, just like it does on any other template.  ``` Sections 100 Whether the resume is segmented the way software expects. 9 of 9 applicable checks passed.  Nothing to fix here. ```  ### Actual behavior  the actual behaviour is having deep check return 60% on bronzor template because it cannot read the existing work experience, skills and education sections.  ``` Sections 5 4 to fix Whether the resume is segmented the way software expects. 4 of 8 applicable checks passed.  No work-experience section was found. Add a section headed "Experience" or "Work Experience". It is the field most systems rank on.  No education section was found. Add a section headed "Education". Many systems have a required edu

- **Issue #3495** (2026-09-08): **List item continuation loses indentation after page break in ordered and unordered lists**
  *Symptoms*: ### Existing issue  - [x] I searched the existing issues and could not find a matching report.  ### Product variant  Cloud  ### Reactive Resume version  5.3.0  ### Area  Resume builder & data  ### Environment  Ubuntu Linux, Firefox 155.0  ### Summary  When a list item spans a page break, the continuation of the item's text on the next page loses the list-content indentation and shifts to the left.  The problem occurs with both ordered and unordered lists.  As long as the complete list item fits on one page, indentation is rendered correctly. As soon as the same item becomes long enough to continue onto the next page, the continuation text starts further left than the original item's text.  This produces visibly inconsistent list formatting across page boundaries.  ### Steps to reproduce  1. Create or open a resume containing a rich-text field. 2. Add a long ordered list with enough content to span multiple pages. 3. Make one list item near the bottom of a page long enough that its text continues onto the next page. 4. Observe the continuation of that list item at the top of the next page. 5. Repeat the same test using an unordered/bullet list.  The issue is reproducible with both list types.  For comparison, shorten the affected item until it fits completely on the previous page. The following list item then starts normally on the next page and the indentation is correct.  ### Expected behavior  When a list item spans a page break, all continuation lines on the following page
  **Post-Mortem & Fix Analysis**:
  >  <!-- PULLFROG_DIVIDER_DO_NOT_REMOVE_PLZ --> <sup><a href="https://pullfrog.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pullfrog.com/logos/frog-white-full-18px.png"><img src="https://pullfrog.com/logos/frog-green-full-18px.png" width="9px" height="9px" style="vertical-align: middle; " alt="Pullfrog"></picture></a>&nbsp;&nbsp;｜ [Build this ➔](https://pullfrog.com/trigger/amruthpillai/reactive-resume/3495?action=build) ｜ [Make a plan ➔](https://pullfrog.com/trigger/amruthpillai/reactive-resume/3495?action=plan)</sup>
  > Just checked on https://rxresu.me and it looks like this has also been solved. Closing the issue for now. 

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

### Incident Patch 1: `dee10ad5` (2026-10-05)
**Commit Message**: fix(docs): publish portable cURL samples in the API reference (#3580)

**File**: `apps/server/src/openapi/generator.test.ts` (modified, +16/-0)
```diff
@@ -163,3 +163,19 @@ it("keeps JSON application writes and documents optional multipart attachments",
 		);
 	}
 });
+
+it("overrides every generated cURL sample with one that has no shell line continuations", async () => {
+	const spec = await generateSpec();
+	const samples = Object.values(spec.paths ?? {}).flatMap((item) =>
+		(["get", "post", "put", "patch", "delete"] as const).flatMap((method) => {
+			const operation = item?.[method] as { "x-codeSamples"?: { label: string; source: string }[] } | undefined;
+			return operation ? [operation["x-codeSamples"]?.find((sample) => sample.label === "cURL")?.source] : [];
+		}),
+	);
+	expect(samples.length).toBeGreaterThan(0);
+	for (const source of samples) expect(source).toMatch(/^curl [^\\]*$/);
+	expect(spec.paths?.["/api/health"]?.get).toHaveProperty(
+		"x-codeSamples.0.source",
+		'curl "https://rxresu.me/api/health"',
+	);
+});
```

**File**: `apps/server/src/openapi/generator.ts` (modified, +75/-0)
```diff
@@ -208,5 +208,80 @@ export async function generateOpenApiSpec({ appUrl, version }: GenerateOpenApiSp
 			}
 		}
 	}
+	addCurlSamples(spec);
 	return spec;
 }
+
+type JsonSchema = OpenAPI.SchemaObject | OpenAPI.ReferenceObject;
+
+// Mintlify's generated cURL samples use Bash `\` line continuations, which break when
+// pasted into PowerShell or cmd. A custom sample labelled "cURL" replaces that tab only;
+// the other generated languages stay as they are.
+function addCurlSamples(spec: OpenAPI.Document) {
+	const resolve = (schema: JsonSchema | undefined): OpenAPI.SchemaObject => {
+		let current = schema;
+		while (current && "$ref" in current) {
+			const name = current.$ref.replace("#/components/schemas/", "");
+			current = spec.components?.schemas?.[name];
+		}
+		return current ?? {};
+	};
+	// Placeholder body with required fields only, in the same `<string>` style Mintlify uses.
+	const example = (schema: JsonSchema | undefined, parents: ReadonlySet<string> = new Set()): unknown => {
+		const isRef = schema !== undefined && "$ref" in schema;
+		if (isRef && parents.has(schema.$ref)) return {};
+		const seen = isRef ? new Set(parents).add(schema.$ref) : parents;
+		const value = resolve(schema);
+		if ("const" in value) return value.const;
+		if (value.enum) return value.enum[0];
+		const options = value.anyOf ?? value.oneOf;
+		if (options) return example(options.find((option) => resolve(option).type !== "null") ?? options[0], seen);
+		if (value.allOf) return Object.assign({}, ...value.allOf.map((part) => example(part, seen)));
+		const type = Array.isArray(value.type) ? value.type.find((item) => item !== "null") : value.type;
+		if (type === "object" || value.properties) {
+			return Object.fromEntries((value.required ?? []).map((key) => [key, example(value.properties?.[key], seen)]));
+		}
+		if (type === "array") return [example("items" in value ? value.items : undefined, seen)];
+		if (type === "integer" || type === "number") return 123;
+		if (type === "boolean") return true;
+		return "<string>";
+	};
+
+	for (const [path, item] of Object.entries(spec.paths ?? {})) {
+		if (!item) continue;
+		for (const method of ["get", "post", "put", "patch", "delete"] as const) {
+			const operation = item[method];
+			if (!operation) continue;
+			const query = (operation.parameters ?? [])
+				.filter((parameter): parameter is OpenAPI.ParameterObject => !("$ref" in parameter))
+				.filter((parameter) => parameter.in === "query" && parameter.required)
+				.map((parameter) => `${parameter.name}=<${parameter.name}>`)
+				.join("&");
+			// `<id>` rather than `{id}`: cURL treats braces in URLs as glob patterns.
+			const url = `${(operation.servers ?? spec.servers)?.[0]?.url ?? ""}${path.replace(/\{(\w+)\}/g, "<$1>")}${query ? `?${query}` : ""}`;
+			// Double quotes work in POSIX shells, PowerShell and cmd alike.
+			const args = method === "get" ? [`"${url}"`] : [`--request ${method.toUpperCase()}`, `"${url}"`];
+			if ((operation.security ?? spec.security)?.length) args.push(`--header "x-api-key: <api-key>"`);
+
+			const body = operation.requestBody && !("$ref" in operation.requestBody) ? operation.requestBody.content : {};
+			const json = body["application/json"];
+			const form = body["multipart/form-data"];
+			if (json) {
+				// Newlines inside a quoted argument are not line continuations, so the body stays readable.
+				args.push(`--header "Content-Type: application/json"`);
+				args.push(`--data '${JSON.stringify(example(json.schema), null, 2)}'`);
+			} else if (form) {
+				const fields = resolve(form.schema);
+				for (const key of fields.required ?? []) {
+					const field = resolve(fields.properties?.[key]);
+					const value = "contentMediaType" in field ? "@<file>" : example(field);
+					args.push(`--form "${key}=${typeof value === "string" ? value : JSON.stringify(value)}"`);
+				}
+			}
+
+			Object.assign(operation, {
+				"x-codeSamples": [{ lang: "bash", label: "cURL", source: `curl ${args.join(" ")}` }],
+			});
+		}
+	}
+}
```

**File**: `docs/spec.json` (modified, +1132/-12)
```diff
@@ -220,7 +220,14 @@
 							}
 						}
 					}
-				}
+				},
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl \"https://rxresu.me/api/health\""
+					}
+				]
 			}
 		},
 		"/ai/parse-pdf": {
@@ -4661,6 +4668,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/ai/parse-pdf\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{\n  \"file\": {\n    \"name\": \"<string>\",\n    \"data\": \"<string>\"\n  }\n}'"
+					}
 				]
 			}
 		},
@@ -9110,6 +9124,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/ai/parse-docx\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{\n  \"file\": {\n    \"name\": \"<string>\",\n    \"data\": \"<string>\"\n  },\n  \"mediaType\": \"application/msword\"\n}'"
+					}
 				]
 			}
 		},
@@ -9410,6 +9431,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/ai/ats-review\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{\n  \"extractedText\": \"<string>\"\n}'"
+					}
 				]
 			}
 		},
@@ -9658,6 +9686,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/ai/improve\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{\n  \"line\": \"<string>\",\n  \"action\": \"verb\"\n}'"
+					}
 				]
 			}
 		},
@@ -9949,6 +9984,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl \"https://rxresu.me/api/openapi/ai-providers\" --header \"x-api-key: <api-key>\""
+					}
 				]
 			},
 			"post": {
@@ -10362,6 +10404,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/ai-providers\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{\n  \"label\": \"<string>\",\n  \"provider\": \"openai\",\n  \"model\": \"<string>\",\n  \"apiKey\": \"<string>\"\n}'"
+					}
 				]
 			}
 		},
@@ -10844,6 +10893,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request PATCH \"https://rxresu.me/api/openapi/ai-providers/<id>\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{}'"
+					}
 				]
 			},
 			"delete": {
@@ -11029,6 +11085,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request DELETE \"https://rxresu.me/api/openapi/ai-providers/<id>\" --header \"x-api-key: <api-key>\""
+					}
 				]
 			}
 		},
@@ -11521,6 +11584,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/ai-providers/<id>/test\" --header \"x-api-key: <api-key>\""
+					}
 				]
 			}
 		},
@@ -11789,6 +11859,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl \"https://rxresu.me/api/openapi/agent/threads\" --header \"x-api-key: <api-key>\""
+					}
 				]
 			},
 			"post": {
@@ -12030,6 +12107,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request POST \"https://rxresu.me/api/openapi/agent/threads\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{}'"
+					}
 				]
 			}
 		},
@@ -12398,6 +12482,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl \"https://rxresu.me/api/openapi/agent/threads/<id>\" --header \"x-api-key: <api-key>\""
+					}
 				]
 			},
 			"patch": {
@@ -12644,6 +12735,13 @@
 					{
 						"cookieAuth": []
 					}
+				],
+				"x-codeSamples": [
+					{
+						"lang": "bash",
+						"label": "cURL",
+						"source": "curl --request PATCH \"https://rxresu.me/api/openapi/agent/threads/<id>\" --header \"x-api-key: <api-key>\" --header \"Content-Type: application/json\" --data '{\n  \"aiProviderId\":
```

---

### Incident Patch 2: `faf59fad` (2026-10-05)
**Commit Message**: fix(env): reject REDIS_URL with a username but no password (#3571)

Co-authored-by: Amruth Pillai <[REDACTED_EMAIL]>

**File**: `.env.example` (modified, +4/-0)
```diff
@@ -109,6 +109,10 @@ S3_FORCE_PATH_STYLE="true"
 # Redis is optional on a single server. Providers and conversations persist in PostgreSQL.
 # Redis shares rate limits, resume events, cancellation and view deduplication, and resumes reply streams.
 # Vercel Upstash KV_URL is accepted as an alias for REDIS_URL.
+# Password-only auth (redis-server --requirepass) needs an empty username:
+#   redis://:<password>@<host>:<port>  or  redis://default:<password>@<host>:<port>
+# A named username is only for servers with a configured ACL user; passwordless (`nopass`) ACL users keep an
+# explicitly empty password: redis://<user>:@<host>:<port>
 REDIS_URL="redis://redis:6379"
 ENCRYPTION_SECRET="change-me-to-a-secure-agent-secret-in-production"
 
```

**File**: `docs/self-hosting/environment-variables.mdx` (modified, +5/-0)
```diff
@@ -168,6 +168,11 @@ Redis is optional on a single server. Without it, everything works, with these l
 Set `REDIS_URL` when you run more than one server process, or when you want replies to survive a reload. When Redis is
 configured, the [health endpoint](/self-hosting/docker#check-the-health-endpoint) also checks it.
 
+For password-only authentication (`redis-server --requirepass`), leave the username empty —
+`redis://:<password>@<host>` — or use the built-in ACL user, `redis://default:<password>@<host>`. A named username
+only works when the server has a matching ACL user; otherwise Redis replies `WRONGPASS invalid username-password
+pair`. Passwordless (`nopass`) ACL users keep an explicitly empty password: `redis://<user>:@<host>`.
+
 Saved AI providers and Assistant conversations are kept in PostgreSQL, so they remain available without Redis.
 
 ## Web access
```

**File**: `packages/env/src/server.test.ts` (modified, +50/-1)
```diff
@@ -12,10 +12,14 @@ beforeEach(() => {
 		"AI_MODEL",
 		"AI_API_KEY",
 		"AI_BASE_URL",
+		"REDIS_URL",
 	])
 		vi.stubEnv(name, undefined);
 });
-afterEach(() => vi.unstubAllEnvs());
+afterEach(() => {
+	vi.unstubAllEnvs();
+	vi.restoreAllMocks();
+});
 
 describe("server web access configuration", () => {
 	it.each([
@@ -40,3 +44,48 @@ describe("server web access configuration", () => {
 		expect((await import("./server")).env.WEB_ACCESS_API_KEY).toBeUndefined();
 	});
 });
+
+describe("redis url userinfo", () => {
+	it.each([
+		"redis://localhost:6379",
+		"rediss://localhost:6379/0",
+		"redis://:password@localhost:6379",
+		"redis://default:password@localhost:6379/0",
+		"redis://acl-user:password@localhost:6379",
+	])("accepts %s", async (url) => {
+		vi.stubEnv("REDIS_URL", url);
+		expect((await import("./server")).env.REDIS_URL).toBe(url);
+	});
+
+	it.each([
+		"redis://acl-user:@localhost:6379", // named ACL user with an empty password (nopass) — AUTH <user> "" is valid
+		"redis://@localhost:6379", // empty userinfo — ioredis treats it like no userinfo and sends no AUTH
+	])("accepts %s", async (url) => {
+		vi.stubEnv("REDIS_URL", url);
+		expect((await import("./server")).env.REDIS_URL).toBe(url);
+	});
+
+	it.each([
+		"redis://password@localhost:6379", // password in the username slot (userinfo with no colon)
+	])("rejects %s", async (url) => {
+		vi.stubEnv("REDIS_URL", url);
+		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
+		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
+		expect(consoleError).toHaveBeenCalledWith(
+			expect.any(String),
+			expect.arrayContaining([
+				expect.objectContaining({ message: expect.stringContaining("userinfo has no password field") }),
+			]),
+		);
+	});
+
+	it("rejects a malformed URL as a normal validation failure, not a parse crash", async () => {
+		vi.stubEnv("REDIS_URL", "not a url");
+		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
+		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
+		expect(consoleError).toHaveBeenCalledWith(
+			expect.any(String),
+			expect.arrayContaining([expect.objectContaining({ code: "invalid_format", format: "url" })]),
+		);
+	});
+});
```

**File**: `packages/env/src/server.ts` (modified, +37/-1)
```diff
@@ -18,6 +18,39 @@ if (workspaceRoot) {
 	}
 }
 
+// ioredis authenticates as `AUTH <username> <password>`; a bare "redis://value@host" (userinfo with no colon) puts
+// that value in the username slot and Redis rejects the resulting auth. Password-only servers (redis-server
+// --requirepass) need an empty username — "redis://:<pass>@<host>" — or the built-in ACL user,
+// "redis://default:<pass>@<host>". A named user with an explicitly empty password ("redis://user:@host") stays
+// valid: Redis accepts `AUTH <user> ""` for passwordless (`nopass`) ACL users.
+const REDIS_URL_USERINFO_MESSAGE =
+	"REDIS_URL userinfo has no password field. For password-only auth (redis --requirepass) use " +
+	"redis://:<password>@<host>; for ACL users use redis://<user>:<password>@<host> (default is the built-in user; " +
+	"nopass users may keep the password empty, e.g. redis://<user>:@<host>).";
+
+function hasCompleteUserinfo(raw: string): boolean {
+	// Checks run even when the earlier URL-format check has already failed, so this must never throw:
+	// a malformed URL reaching `new URL()` surfaces as an unhandled parse crash instead of a validation
+	// error. Format errors are the URL check's job — only classify complete, parseable URLs here.
+	if (!URL.canParse(raw)) return true;
+
+	// The URL parser normalizes an empty password away ("redis://user:@host" parses like
+	// "redis://user@host"), so the colon that separates the password field must be read from the raw
+	// authority. Userinfo ends at the last "@" before the authority terminator; a userinfo without a
+	// colon is exactly the password-in-username-slot shape ioredis mis-authenticates.
+	const schemeEnd = raw.indexOf("://");
+	if (schemeEnd === -1) return true; // no authority, so no userinfo
+	const authorityStart = schemeEnd + 3;
+	const terminator = raw.slice(authorityStart).search(/[/?#]/);
+	const authority =
+		terminator === -1 ? raw.slice(authorityStart) : raw.slice(authorityStart, authorityStart + terminator);
+	const userinfoEnd = authority.lastIndexOf("@");
+	// `userinfoEnd === 0` is an empty userinfo ("redis://@host") — ioredis reads it exactly like no
+	// userinfo and sends no AUTH, so it passes the same way a missing "@" does.
+	if (userinfoEnd <= 0) return true;
+	return authority.slice(0, userinfoEnd).includes(":");
+}
+
 export const env = createEnv({
 	server: {
 		// Application
@@ -110,7 +143,10 @@ export const env = createEnv({
 		S3_FORCE_PATH_STYLE: z.stringbool().default(false),
 
 		// AI Agent Workspace (optional until the agent feature is used)
-		REDIS_URL: z.url({ protocol: /redis(s)?/ }).optional(),
+		REDIS_URL: z
+			.url({ protocol: /redis(s)?/ })
+			.refine(hasCompleteUserinfo, REDIS_URL_USERINFO_MESSAGE)
+			.optional(),
 		ENCRYPTION_SECRET: z.string().min(32, "ENCRYPTION_SECRET must be at least 32 characters").optional(),
 
 		// Optional search and enhanced reading; custom URLs are operator-controlled Firecrawl services.
```

---

### Incident Patch 3: `660603c3` (2026-10-05)
**Commit Message**: test(server): drop wall-clock MCP health benchmark, fix cold-import timeout

**File**: `apps/server/src/http/app.test.ts` (modified, +15/-11)
```diff
@@ -111,6 +111,7 @@ beforeEach(() => {
 });
 
 describe("createApp", () => {
+	// The first case pays for the cold import of the whole app, which takes seconds under a parallel run.
 	it.each([
 		["127.0.0.1", "127.0.0.1", "198.51.100.1", "198.51.100.1"],
 		["127.0.0.1", "::ffff:127.0.0.1", "198.51.100.1", "198.51.100.1"],
@@ -119,15 +120,19 @@ describe("createApp", () => {
 		["127.0.0.1", "127.0.0.1", "192.0.2.99, 198.51.100.1", "198.51.100.1"],
 		["127.0.0.1", "203.0.113.9", "198.51.100.1", "203.0.113.9"],
 		["127.0.0.1", "127.0.0.1", "invalid, 198.51.100.1", "127.0.0.1"],
-	])("resolves auth client through trusted %s from socket %s", async (proxy, peer, forwarded, expected) => {
-		mocks.trustedProxies.push(proxy);
-		const { createApp } = await import("./app");
-		const request = new Request("http://localhost/api/auth/sign-in/email", {
-			headers: { "x-forwarded-for": forwarded },
-		});
-		await createApp().fetch(request, transportEnv(peer));
-		expect(mocks.handleAuth).toHaveBeenCalledWith(request, expected);
-	});
+	])(
+		"resolves auth client through trusted %s from socket %s",
+		async (proxy, peer, forwarded, expected) => {
+			mocks.trustedProxies.push(proxy);
+			const { createApp } = await import("./app");
+			const request = new Request("http://localhost/api/auth/sign-in/email", {
+				headers: { "x-forwarded-for": forwarded },
+			});
+			await createApp().fetch(request, transportEnv(peer));
+			expect(mocks.handleAuth).toHaveBeenCalledWith(request, expected);
+		},
+		15_000,
+	);
 
 	it("routes /api/auth/oauth to the OAuth bridge before the Better Auth wildcard", async () => {
 		const { createApp } = await import("./app");
@@ -139,8 +144,7 @@ describe("createApp", () => {
 		await expect(response.text()).resolves.toBe("oauth");
 		expect(mocks.handleOAuth).toHaveBeenCalledWith(request);
 		expect(mocks.handleAuth).not.toHaveBeenCalled();
-		// The first test pays for the cold import of the whole app, which takes seconds under a parallel run.
-	}, 15_000);
+	});
 
 	it("uses the transport address for public PDF fallback despite rotated forwarding headers", async () => {
 		const { createApp } = await import("./app");
```

**File**: `apps/server/src/mcp/discovery.test.ts` (modified, +0/-41)
```diff
@@ -1,9 +1,7 @@
 import type { RequestAuthentication } from "@reactive-resume/api/context";
-import { once } from "node:events";
 import { Socket } from "node:net";
 import { setImmediate } from "node:timers/promises";
 import { afterEach, beforeEach, expect, it, vi } from "vitest";
-import { serve } from "@hono/node-server";
 import { Pool } from "pg";
 import z from "zod";
 
@@ -160,45 +158,6 @@ it("reuses static schema conversions across separate authenticated discovery req
 	expect(conversions.mock.calls.length).toBe(0);
 }, 30_000);
 
-it("keeps concurrent HTTP health checks responsive during repeated MCP discovery", async () => {
-	const { createApp } = await import("../http/app");
-	const app = createApp({ serveStatic: false, trustedClient: () => "127.0.0.1" });
-	const server = serve({ fetch: app.fetch, port: 0 });
-	try {
-		if (!server.listening) await once(server, "listening");
-		const address = server.address();
-		if (!address || typeof address === "string") throw new Error("Missing HTTP address");
-		const url = `http://127.0.0.1:${address.port}`;
-		const input = request();
-		const body = await input.text();
-		const started = performance.now();
-		const discovery = Promise.all(
-			Array.from({ length: 20 }, async () => {
-				const response = await fetch(`${url}/mcp`, { method: "POST", headers: input.headers, body });
-				expect(response.status).toBe(200);
-				expect((await response.json()).result.tools.length).toBeGreaterThan(70);
-			}),
-		);
-		const health = Promise.all(
-			Array.from({ length: 3 }, async () => {
-				await setImmediate();
-				const response = await fetch(`${url}/api/health`);
-				expect(response.status).toBe(200);
-				expect((await response.json()).status).toBe("healthy");
-				return performance.now() - started;
-			}),
-		);
-		const [, healthDurations] = await Promise.all([discovery, health]);
-		console.info("20 concurrent MCP discoveries milliseconds", Math.round(performance.now() - started));
-		console.info("Concurrent HTTP health milliseconds", healthDurations.map(Math.round));
-		expect(Math.max(...healthDurations)).toBeLessThan(1_000);
-		expect(mocks.execute).toHaveBeenCalledTimes(3);
-		expect(mocks.healthcheck).toHaveBeenCalledTimes(3);
-	} finally {
-		await new Promise<void>((resolve) => server.close(() => resolve()));
-	}
-}, 30_000);
-
 it("keeps credentials, permissions, headers and callbacks isolated between requests", async () => {
 	const { handleMcp } = await import("./handler");
 	for (const token of ["reader", "writer", "reader"]) {
```

---

### Incident Patch 4: `0847874d` (2026-10-05)
**Commit Message**: fix(auth): prevent transient session logout on rate limits and network errors (#3575)

**File**: `apps/web/src/libs/auth/session.test.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { describe, expect, it, vi } from "vitest";
+import { getSession } from "./session";
+
+const getSessionMock = vi.hoisted(() => vi.fn());
+
+vi.mock("./client", () => ({
+	authClient: {
+		getSession: getSessionMock,
+	},
+}));
+
+describe("getSession", () => {
+	it("returns session data on successful fetch", async () => {
+		const mockSession = { user: { id: "user-1", name: "Alice" }, session: { id: "sess-1" } };
+		getSessionMock.mockResolvedValueOnce({ data: mockSession, error: null });
+
+		const result = await getSession();
+		expect(result).toEqual(mockSession);
+	});
+
+	it("returns null when no session is present (data is null)", async () => {
+		getSessionMock.mockResolvedValueOnce({ data: null, error: null });
+
+		const result = await getSession();
+		expect(result).toBeNull();
+	});
+
+	it("returns null when session is explicitly unauthorized (HTTP 401)", async () => {
+		getSessionMock.mockResolvedValueOnce({ data: null, error: { status: 401, message: "Unauthorized" } });
+
+		const result = await getSession();
+		expect(result).toBeNull();
+	});
+
+	it("throws on rate-limited responses (HTTP 429)", async () => {
+		getSessionMock.mockResolvedValueOnce({
+			data: null,
+			error: { status: 429, message: "Too many requests. Please try again later." },
+		});
+
+		await expect(getSession()).rejects.toThrow("Too many requests. Please try again later.");
+	});
+
+	it("throws on server errors (HTTP 500)", async () => {
+		getSessionMock.mockResolvedValueOnce({
+			data: null,
+			error: { status: 500, message: "Internal server error" },
+		});
+
+		await expect(getSession()).rejects.toThrow("Internal server error");
+	});
+
+	it("throws on transient network errors", async () => {
+		getSessionMock.mockResolvedValueOnce({
+			data: null,
+			error: { message: "Failed to fetch" },
+		});
+
+		await expect(getSession()).rejects.toThrow("Failed to fetch");
+	});
+});
```

**File**: `apps/web/src/libs/auth/session.ts` (modified, +8/-2)
```diff
@@ -5,6 +5,12 @@ import { authClient } from "./client";
 
 export const getSession = async (): Promise<AuthSession | null> => {
 	const { data, error } = await authClient.getSession();
-	if (error) return null;
-	return data as AuthSession;
+	if (error) {
+		// HTTP 401 explicitly denotes an unauthenticated state or expired session.
+		if (error.status === 401) return null;
+		// For transient errors (e.g. 429 Too Many Requests, 5xx server/DB errors, network drops),
+		// throw so callers can differentiate between unauthenticated and transient failures.
+		throw new Error(error.message || `Session check failed with status ${error.status}`);
+	}
+	return (data as AuthSession) ?? null;
 };
```

**File**: `apps/web/src/libs/query/client.test.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import { describe, expect, it } from "vitest";
+import { getQueryClient } from "./client";
+
+describe("getQueryClient mutationCache", () => {
+	it("invalidates data queries but excludes auth session and flags on mutation settled", async () => {
+		const queryClient = getQueryClient();
+
+		queryClient.setQueryData(["auth", "session"], { user: { id: "u-1" } });
+		queryClient.setQueryData(["flags"], { disableSignups: false });
+		queryClient.setQueryData(["resume", "list"], [{ id: "res-1" }]);
+
+		const authQuery = queryClient.getQueryCache().find({ queryKey: ["auth", "session"] });
+		const flagsQuery = queryClient.getQueryCache().find({ queryKey: ["flags"] });
+		const resumeQuery = queryClient.getQueryCache().find({ queryKey: ["resume", "list"] });
+
+		expect(authQuery?.isStale()).toBe(false);
+		expect(flagsQuery?.isStale()).toBe(false);
+		expect(resumeQuery?.isStale()).toBe(false);
+
+		// Trigger a mutation that settles
+		const mutation = queryClient.getMutationCache().build(queryClient, {
+			mutationFn: async () => "success",
+		});
+		await mutation.execute(undefined);
+
+		// Resume query is invalidated (stale)
+		expect(resumeQuery?.isStale()).toBe(true);
+
+		// Auth and flags are preserved (not stale)
+		expect(authQuery?.isStale()).toBe(false);
+		expect(flagsQuery?.isStale()).toBe(false);
+	});
+});
```

**File**: `apps/web/src/libs/query/client.ts` (modified, +6/-1)
```diff
@@ -18,7 +18,12 @@ export const getQueryClient = () => {
 		mutationCache: new MutationCache({
 			onSettled: (_1, _2, _3, _4, _5, context) => {
 				if (context?.meta?.noInvalidate) return;
-				void queryClient.invalidateQueries();
+				void queryClient.invalidateQueries({
+					predicate: (query) => {
+						const key = query.queryKey[0];
+						return key !== "auth" && key !== "flags";
+					},
+				});
 			},
 		}),
 	});
```

**File**: `apps/web/src/libs/root-context.test.ts` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+import { describe, expect, it, vi } from "vitest";
+import { QueryClient } from "@tanstack/react-query";
+import { loadRootContext, sessionQueryKey } from "./root-context";
+
+const getSessionMock = vi.hoisted(() => vi.fn());
+const flagsGetMock = vi.hoisted(() => vi.fn().mockResolvedValue({ disableSignups: false, disableEmailAuth: false }));
+
+vi.mock("./auth/session", () => ({
+	getSession: getSessionMock,
+}));
+
+vi.mock("./locale", () => ({
+	getLocale: () => "en-US",
+	loadLocale: vi.fn().mockResolvedValue(undefined),
+}));
+
+vi.mock("./orpc/client", () => ({
+	client: {
+		flags: {
+			get: flagsGetMock,
+		},
+	},
+}));
+
+vi.mock("./theme", () => ({
+	getTheme: () => "system",
+}));
+
+describe("loadRootContext", () => {
+	it("loads root context with freshly fetched session", async () => {
+		const queryClient = new QueryClient({
+			defaultOptions: { queries: { retry: false } },
+		});
+		const mockSession = {
+			user: { id: "user-1", name: "Alice" },
+			session: { id: "sess-1" },
+		};
+		getSessionMock.mockResolvedValueOnce(mockSession);
+
+		const context = await loadRootContext(queryClient);
+		expect(context.session).toEqual(mockSession);
+	});
+
+	it("retains cached session when getSession encounters a transient error on refresh", async () => {
+		const queryClient = new QueryClient({
+			defaultOptions: { queries: { retry: false } },
+		});
+		const cachedSession = {
+			user: { id: "user-1", name: "Alice" },
+			session: { id: "sess-1" },
+		};
+		queryClient.setQueryData(sessionQueryKey, cachedSession);
+		// Mark stale/invalid so getSession is invoked
+		void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
+
+		getSessionMock.mockRejectedValueOnce(new Error("Too many requests. Please try again later."));
+
+		const context = await loadRootContext(queryClient);
+		expect(context.session).toEqual(cachedSession);
+	});
+
+	it("re-throws error when getSession fails and there is no cached session", async () => {
+		const queryClient = new QueryClient({
+			defaultOptions: { queries: { retry: false } },
+		});
+		getSessionMock.mockRejectedValueOnce(new Error("Session check failed with status 500"));
+
+		await expect(loadRootContext(queryClient)).rejects.toThrow("Session check failed with status 500");
+	});
+});
```

**File**: `apps/web/src/libs/root-context.ts` (modified, +15/-3)
```diff
@@ -1,3 +1,4 @@
+import type { AuthSession } from "@reactive-resume/auth/types";
 import type { QueryClient } from "@tanstack/react-query";
 import { getSession } from "./auth/session";
 import { getLocale, loadLocale } from "./locale";
@@ -15,12 +16,23 @@ export async function loadRootContext(queryClient: QueryClient) {
 	const theme = getTheme();
 	const locale = getLocale();
 
-	const [session, flags] = await Promise.all([
-		queryClient.query({
+	const sessionPromise = queryClient
+		.query({
 			queryKey: sessionQueryKey,
 			queryFn: getSession,
 			staleTime: (query) => (query.state.data ? 60_000 : 0),
-		}),
+		})
+		.catch((error: unknown) => {
+			const cached = queryClient.getQueryData<AuthSession | null>(sessionQueryKey);
+			if (cached) {
+				console.warn("[session] Failed to refresh session, retaining cached session:", error);
+				return cached;
+			}
+			throw error;
+		});
+
+	const [session, flags] = await Promise.all([
+		sessionPromise,
 		queryClient.query({ queryKey: flagsQueryKey, queryFn: () => client.flags.get(), staleTime: 5 * 60_000 }),
 		loadLocale(locale),
 	]);
```

---

### Incident Patch 5: `0be96b40` (2026-10-05)
**Commit Message**: fix: prevent resume crashes over HTTP (#3573)

**File**: `apps/web/src/features/resume/builder/draft.test.ts` (modified, +5/-1)
```diff
@@ -239,6 +239,7 @@ describe("builder resume autosave", () => {
 	afterEach(() => {
 		vi.clearAllTimers();
 		vi.useRealTimers();
+		vi.unstubAllGlobals();
 		useResumeStore.getState().reset();
 	});
 
@@ -262,11 +263,13 @@ describe("builder resume autosave", () => {
 		hook.unmount();
 	});
 
-	it("coalesces rapid local edits into one full-data update", async () => {
+	it("initializes and autosaves rapid edits without crypto.randomUUID (HTTP LAN origins)", async () => {
+		vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
 		const initial = makeResume("resume-rapid");
 		const updated = withBasicsName(initial, "Latest Name");
 		orpcMocks.updateResume.mockResolvedValue(updated);
 		useResumeStore.getState().initialize(initial);
+		expect(useResumeStore.getState().isReady).toBe(true);
 
 		useResumeStore.getState().updateResumeData((draft) => {
 			draft.basics.name = "First Name";
@@ -284,6 +287,7 @@ describe("builder resume autosave", () => {
 			expect.objectContaining({ signal: expect.any(AbortSignal) }),
 		);
 		expect(orpcMocks.patchResume).not.toHaveBeenCalled();
+		expect(useResumeStore.getState().saveStatus).toBe("saved");
 	});
 
 	it("saves the latest pending snapshot after an in-flight save resolves", async () => {
```

**File**: `apps/web/src/features/resume/builder/draft.ts` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ import { immer } from "zustand/middleware/immer";
 import { create } from "zustand/react";
 import { syncResumeDates } from "@reactive-resume/schema/resume/dates";
 import { toast } from "@reactive-resume/ui/components/toast";
+import { generateId } from "@reactive-resume/utils/string";
 import { orpc, streamClient } from "@/libs/orpc/client";
 
 export type Resume = {
@@ -334,7 +335,7 @@ function createRuntime(): Runtime {
 		isSaving: false,
 		saveFailed: false,
 		syncResume,
-		sessionId: crypto.randomUUID(),
+		sessionId: generateId(),
 	};
 
 	runtime.beforeUnloadHandler = () => runtime.syncResume.flush();
```

---

### Incident Patch 6: `8aee5b7a` (2026-10-04)
**Commit Message**: fix(web): correct Product Hunt launch date

- Position resume selection labels for their overlay content

**File**: `apps/web/src/components/ui/product-hunt-banner.tsx` (modified, +3/-3)
```diff
@@ -8,9 +8,9 @@ import { IconButton } from "@reactive-resume/ui/components/icon-button";
 import { cn } from "@reactive-resume/utils/style";
 import { D3, EASE, EXIT } from "@/libs/motion";
 
-// Product Hunt launch day: 6 October 2026 from 12:01am PT (07:01 UTC, 09:01 CEST), for 24 hours.
-// ponytail: dead code once the window closes; delete this file and its two call sites after 7 October 2026.
-const LAUNCH_START = Date.parse("2026-10-06T07:01:00Z");
+// Product Hunt launch day: 5 October 2026 from 12:01am PT (07:01 UTC, 09:01 CEST), for 24 hours.
+// ponytail: dead code once the window closes; delete this file and its two call sites after 6 October 2026.
+const LAUNCH_START = Date.parse("2026-10-05T07:01:00Z");
 const LAUNCH_END = LAUNCH_START + 24 * 60 * 60 * 1000;
 const PRODUCT_HUNT_URL = "https://www.producthunt.com/posts/reactive-resume-v6";
 const DISMISSED_KEY = "product-hunt-launch-dismissed";
```

**File**: `apps/web/src/features/documents/new-document-dialog.tsx` (modified, +1/-1)
```diff
@@ -611,7 +611,7 @@ function CopyForJob({ initialSourceId, initialJobId, onBack, onCreated }: CopyFo
 						<label
 							key={resume.id}
 							className={cn(
-								"flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors duration-quick",
+								"relative flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors duration-quick",
 								resume.id === source?.id ? "border-accent bg-accent-soft" : "border-line hover:bg-hover",
 							)}
 						>
```

---

### Incident Patch 7: `bc71f636` (2026-10-04)
**Commit Message**: docs: update YouTube URLs in changelog and video guides

- Use the privacy-enhanced embed URL in the changelog
- Link video guides to YouTube Shorts

**File**: `docs/changelog/index.mdx` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ rss: true
 
 <iframe
   className="w-full aspect-video rounded-xl"
-  src="https://www.youtube-nocookie.com/watch?v=LuMIbhzzbjQ"
+  src="https://www.youtube-nocookie.com/embed/LuMIbhzzbjQ"
   title="YouTube video player"
   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
   allowFullScreen
```

**File**: `docs/guides/video-guides.mdx` (modified, +12/-12)
```diff
@@ -25,7 +25,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/creating-an-account) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/O3n6_a5N2IA)
+    [Read the guide](/guides/creating-an-account) · [Watch on YouTube](https://www.youtube.com/shorts/O3n6_a5N2IA)
 
   </Card>
 
@@ -42,7 +42,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/getting-started/quickstart) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/ufQ_ofhlU8k)
+    [Read the guide](/getting-started/quickstart) · [Watch on YouTube](https://www.youtube.com/shorts/ufQ_ofhlU8k)
 
   </Card>
 
@@ -59,7 +59,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/importing-resumes) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/4LoWWE3_Ujc)
+    [Read the guide](/guides/importing-resumes) · [Watch on YouTube](https://www.youtube.com/shorts/4LoWWE3_Ujc)
 
   </Card>
 
@@ -76,7 +76,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/editing-entries) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/bYh32r69x3k)
+    [Read the guide](/guides/editing-entries) · [Watch on YouTube](https://www.youtube.com/shorts/bYh32r69x3k)
 
   </Card>
 
@@ -99,7 +99,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/fitting-content-on-a-page) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/yxzyhE5xOhU)
+    [Read the guide](/guides/fitting-content-on-a-page) · [Watch on YouTube](https://www.youtube.com/shorts/yxzyhE5xOhU)
 
   </Card>
 
@@ -116,7 +116,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/checking-your-resume) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/XUVKGe0UUFY)
+    [Read the guide](/guides/checking-your-resume) · [Watch on YouTube](https://www.youtube.com/shorts/XUVKGe0UUFY)
 
   </Card>
 
@@ -133,7 +133,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/using-the-ats-checker) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/AFiIi9w3hO4)
+    [Read the guide](/guides/using-the-ats-checker) · [Watch on YouTube](https://www.youtube.com/shorts/AFiIi9w3hO4)
 
   </Card>
 
@@ -150,7 +150,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/using-the-assistant) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/TN1x7Gb_kxw)
+    [Read the guide](/guides/using-the-assistant) · [Watch on YouTube](https://www.youtube.com/shorts/TN1x7Gb_kxw)
 
   </Card>
 
@@ -173,7 +173,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/tailoring-a-resume-for-a-job) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/wsVo4ZMxEcE)
+    [Read the guide](/guides/tailoring-a-resume-for-a-job) · [Watch on YouTube](https://www.youtube.com/shorts/wsVo4ZMxEcE)
 
   </Card>
 
@@ -190,7 +190,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/writing-a-cover-letter) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/r_rXHZcoTGA)
+    [Read the guide](/guides/writing-a-cover-letter) · [Watch on YouTube](https://www.youtube.com/shorts/r_rXHZcoTGA)
 
   </Card>
 
@@ -207,7 +207,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/sharing-your-resume-publicly) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/zM0gvZJHd34)
+    [Read the guide](/guides/sharing-your-resume-publicly) · [Watch on YouTube](https://www.youtube.com/shorts/zM0gvZJHd34)
 
   </Card>
 
@@ -224,7 +224,7 @@ New here? Start with **Create an account** and **Create your first resume**, the
       allowFullScreen
     ></iframe>
 
-    [Read the guide](/guides/tracking-job-applications) · [Watch on YouTube](https://www.youtube-nocookie.com/shorts/TdbN-oSQ5Ks)
+    [Read the guide](/guides/tracking-job-applications) · [Watch on YouTube](https://www.youtube.com/shorts/TdbN-oSQ5Ks)
 
   </Card>
 
```

---

### Incident Patch 8: `0ed50674` (2026-10-04)
**Commit Message**: fix(docker): use the pnpm 12 base image

pnpm 11 cannot self-manage to the pnpm 12 packageManager version because pnpm 12 ships as a native binary, which pnpm 11 loads as a JavaScript module and fails on.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # syntax=docker/dockerfile:1.7
 
 # Base image only; pnpm self-manages to the `packageManager` version in package.json.
-ARG PNPM_VERSION=11.21.0
+ARG PNPM_VERSION=12.9.1
 ARG NODE_VERSION=24
 ARG TURBO_VERSION=2.11.5
 
```

---

### Incident Patch 9: `b53c43c3` (2026-09-30)
**Commit Message**: [autofix.ci] apply automated fixes

**File**: `docs/docs.json` (modified, +9/-9)
```diff
@@ -197,8 +197,8 @@
 	},
 	"logo": {
 		"light": "/logo/light.svg",
-    "dark": "/logo/dark.svg",
-    "href": "https://rxresu.me"
+		"dark": "/logo/dark.svg",
+		"href": "https://rxresu.me"
 	},
 	"navbar": {
 		"links": [
@@ -221,11 +221,11 @@
 			"website": "https://rxresu.me",
 			"github": "https://github.com/reactive-resume/reactive-resume"
 		}
-  },
-  "icons": {
-    "library": "lucide"
-  },
-  "background": {
-    "decoration": "grid"
-  }
+	},
+	"icons": {
+		"library": "lucide"
+	},
+	"background": {
+		"decoration": "grid"
+	}
 }
```

---

### Incident Patch 10: `73e7a3cb` (2026-09-28)
**Commit Message**: fix(dev): make dotenvx available through pnpm (#3537)

* fix(dev): make dotenvx available through pnpm

* fix(dev): load local env from root scripts

* [autofix.ci] apply automated fixes

---------

Co-authored-by: Amruth Pillai <[REDACTED_EMAIL]>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `AGENTS.md` (modified, +5/-5)
```diff
@@ -87,7 +87,7 @@ Multi-place changes:
 
 - **Resume data shape**: `packages/schema/src/resume/*` first, then API DTOs, importers, PDF rendering, and web forms consuming it.
 - **New template**: `packages/schema/src/templates.ts`, `packages/pdf/src/templates/index.ts`, source under `packages/pdf/src/templates/<name>/`, and previews under `apps/web/public/templates/{jpg,pdf}`.
-- **New DB column/table**: `packages/db/src/schema/*`, then `dotenvx run -f .env.local -- pnpm db:generate`.
+- **New DB column/table**: `packages/db/src/schema/*`, then `pnpm db:generate`.
 - **New env var**: `packages/env/src/server.ts` **and** the `globalEnv` array in `turbo.json`. Turborepo 2.x strict env mode filters out unlisted vars, so the variable will be `undefined` in child processes at runtime even when correctly set in the OS/container environment.
 
 ## Environment and database
@@ -96,18 +96,18 @@ Copy `.env.example` to `.env.local`. Three required vars: `APP_URL` (default `ht
 
 - **S3/SeaweedFS optional.** If `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are all set, the app uses S3-compatible storage. `.env.example` ships SeaweedFS defaults, so either start the `seaweedfs` compose service or comment those vars out to use local filesystem storage under `<workspace>/data`. `LOCAL_STORAGE_PATH` must be absolute when set.
 - **`REDIS_URL` and `ENCRYPTION_SECRET`** are optional for core resume flows but both required for saved AI providers and the authenticated `/agent` workspace. Host-run dev uses `REDIS_URL=redis://localhost:6379`; the container-run app uses `redis://redis:6379`.
-- **`drizzle-kit` (used by `pnpm db:migrate`) reads `DATABASE_URL` from `process.env` directly** — it does not auto-load `.env`. Run migration commands through `dotenvx`.
+- **`drizzle-kit` (used by `pnpm db:migrate`) reads `DATABASE_URL` from `process.env` directly** — it does not auto-load `.env`. The root migration scripts load `.env.local` through `dotenvx` before invoking Drizzle Kit.
 - The production server auto-runs migrations at startup before serving traffic, so manual `pnpm db:migrate` is mainly for first setup, migration debugging, or applying migrations without starting the app.
 
 ## Commands
 
-Prefix dev servers and migration commands with `dotenvx run -f .env.local --`. Tests, typechecks, linters, boundary checks, and `pnpm build` do not need it; if one fails on a missing env var, rerun it with the prefix.
+Dev server and migration scripts load `.env.local` through the project-local `dotenvx`. Tests, typechecks, linters, boundary checks, and `pnpm build` do not load it automatically.
 
 ```
 sudo docker compose -f compose.dev.yml up -d postgres                                    # DB only
 sudo docker compose -f compose.dev.yml up -d postgres redis seaweedfs seaweedfs_create_bucket   # full infra
-dotenvx run -f .env.local -- pnpm dev            # port 3000 (dev:web for web only)
-dotenvx run -f .env.local -- pnpm db:generate    # db:migrate to apply
+pnpm dev                                          # port 3000 (dev:web for web only)
+pnpm db:generate                                  # db:migrate to apply
 pnpm check                                       # Biome — WRITE-CAPABLE (--write --unsafe)
 pnpm test | pnpm typecheck | pnpm build | pnpm exec turbo boundaries
 ```
```

**File**: `docs/contributing/development.mdx` (modified, +12/-12)
```diff
@@ -102,16 +102,16 @@ These steps set up Reactive Resume for local development, whether you're contrib
   
   <Step title="Run Database Migrations If Needed">
     The server startup path runs migrations before serving traffic. To apply migrations manually without starting the app,
-    load `.env.local` with `dotenvx` because Drizzle Kit reads directly from `process.env`:
+    run the root migration script, which loads `.env.local` before invoking Drizzle Kit:
     
     ```bash
-    dotenvx run -f .env.local -- pnpm run db:migrate
+    pnpm run db:migrate
     ```
   </Step>
   
   <Step title="Start the Development Server">
     ```bash
-    dotenvx run -f .env.local -- pnpm run dev
+    pnpm run dev
     ```
     
     Your local Reactive Resume instance will be available at [http://localhost:3000](http://localhost:3000).
@@ -128,7 +128,7 @@ The scripts you will use most during development:
 
 | Command                        | Description                                                 |
 | ------------------------------ | ----------------------------------------------------------- |
-| `dotenvx run -f .env.local -- pnpm dev` | Start the web and server development processes   |
+| `pnpm dev`                     | Start the web and server development processes             |
 | `pnpm build`                   | Build the production web bundle and server bundle           |
 | `pnpm start`                   | Start the built production server                           |
 | `pnpm typecheck`               | Run TypeScript type checking                                |
@@ -141,9 +141,9 @@ The scripts you will use most during development:
 
 | Command                | Description                                  |
 | ---------------------- | -------------------------------------------- |
-| `dotenvx run -f .env.local -- pnpm run db:generate` | Generate migration files from schema changes |
-| `dotenvx run -f .env.local -- pnpm run db:migrate`  | Apply pending migrations                     |
-| `dotenvx run -f .env.local -- pnpm run db:studio`   | Open Drizzle Studio (database GUI)           |
+| `pnpm db:generate`      | Generate migration files from schema changes |
+| `pnpm db:migrate`       | Apply pending migrations                     |
+| `pnpm db:studio`        | Open Drizzle Studio (database GUI)           |
 
 ### Internationalization
 
@@ -184,7 +184,7 @@ reactive-resume/
 Use Drizzle Studio to explore and manage your database:
 
 ```bash
-dotenvx run -f .env.local -- pnpm run db:studio
+pnpm run db:studio
 ```
 
 This opens a web-based GUI at [https://local.drizzle.studio](https://local.drizzle.studio).
@@ -194,11 +194,11 @@ This opens a web-based GUI at [https://local.drizzle.studio](https://local.drizz
 1. Edit the schema in `packages/db/src/schema/*`
 2. Generate a migration:
    ```bash
-   dotenvx run -f .env.local -- pnpm run db:generate
+   pnpm run db:generate
    ```
 3. Apply the migration:
    ```bash
-   dotenvx run -f .env.local -- pnpm run db:migrate
+   pnpm run db:migrate
    ```
 
 <Warning>Always review generated migrations before applying them, especially when working with existing data.</Warning>
@@ -272,7 +272,7 @@ pnpm run typecheck
 		The Vite web server uses `PORT` (default `3000`), and the Hono server uses `SERVER_PORT` (default `3001`).
 		Either stop the conflicting process or choose alternate ports:
 		```bash
-		PORT=3002 SERVER_PORT=3003 dotenvx run -f .env.local -- pnpm dev
+		PORT=3002 SERVER_PORT=3003 pnpm dev
 		```
 	</Accordion>
 
@@ -300,7 +300,7 @@ pnpm run typecheck
 	<Accordion title="Type errors after pulling changes">
 		The route tree may need regeneration. Run the dev server which auto-generates routes:
 		```bash
-		dotenvx run -f .env.local -- pnpm run dev
+		pnpm run dev
 		```
 		Or run type checking to see specific errors:
 		```bash
```

**File**: `package.json` (modified, +6/-5)
```diff
@@ -26,12 +26,12 @@
 		"build": "pnpm pdf:translations && turbo run build",
 		"check": "pnpm pdf:translations && biome check --write --unsafe . && markdownlint-cli2 --fix && github-actionlint -shellcheck= -pyflakes=",
 		"docs:gen": "pnpm --filter server docs:gen && pnpm --filter @reactive-resume/tooling docs:gen",
-		"db:generate": "turbo run db:generate --filter=@reactive-resume/db",
-		"db:migrate": "turbo run db:migrate --filter=@reactive-resume/db",
-		"db:studio": "turbo run db:studio --filter=@reactive-resume/db",
+		"db:generate": "dotenvx run --ignore=MISSING_ENV_FILE -f .env.local -- turbo run db:generate --filter=@reactive-resume/db",
+		"db:migrate": "dotenvx run --ignore=MISSING_ENV_FILE -f .env.local -- turbo run db:migrate --filter=@reactive-resume/db",
+		"db:studio": "dotenvx run --ignore=MISSING_ENV_FILE -f .env.local -- turbo run db:studio --filter=@reactive-resume/db",
 		"lingui:extract": "turbo run lingui:extract --filter=web && pnpm pdf:translations",
-		"dev": "turbo run dev",
-		"dev:web": "turbo run dev --filter=web",
+		"dev": "dotenvx run --ignore=MISSING_ENV_FILE -f .env.local -- turbo run dev",
+		"dev:web": "dotenvx run --ignore=MISSING_ENV_FILE -f .env.local -- turbo run dev --filter=web",
 		"knip": "knip",
 		"start": "node apps/server/dist/index.mjs",
 		"typecheck": "turbo run typecheck",
@@ -47,6 +47,7 @@
 		"@biomejs/biome": "^2.5.14",
 		"@commitlint/cli": "^21.2.3",
 		"@commitlint/config-conventional": "^21.2.3",
+		"@dotenvx/dotenvx": "^1.75.1",
 		"@playwright/test": "^1.63.0",
 		"@reactive-resume/config": "workspace:*",
 		"@testing-library/jest-dom": "^7.0.1",
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -188,6 +188,9 @@ importers:
       '@commitlint/config-conventional':
         specifier: ^21.2.3
         version: 21.2.3
+      '@dotenvx/dotenvx':
+        specifier: ^1.75.1
+        version: 1.75.1
       '@playwright/test':
         specifier: ^1.63.0
         version: 1.63.0
```

---

### Incident Patch 11: `685fcab6` (2026-09-28)
**Commit Message**: fix(e2e): launch server directly so Playwright can stop it

pnpm 12.6 moves script children into their own process group. Playwright
stops its webServer with a process-group kill, so the server spawned via
`pnpm start` survived teardown and every E2E job hung until the 30 minute
timeout after all tests had passed.

**File**: `playwright.config.ts` (modified, +3/-1)
```diff
@@ -30,7 +30,9 @@ export default defineConfig({
 		},
 	],
 	webServer: {
-		command: "pnpm start",
+		// Run node directly: pnpm >=12.6 moves script children into their own process group,
+		// so Playwright's group kill misses the server and the job hangs after the tests finish.
+		command: "node apps/server/dist/index.mjs",
 		url: `${baseURL}/api/health`,
 		reuseExistingServer: !isCI,
 		timeout: 120_000,
```

---

### Incident Patch 12: `b48a9c21` (2026-09-27)
**Commit Message**: feat(web): refine motion system and simplify animated UI (#3546)

Audit every animation in the app and shared UI primitives against a
frequency-first motion bar: keyboard and high-frequency actions no longer
animate, remaining motion uses interruptible CSS transitions with shared
easing tokens, and redundant animation code is removed.

UI primitives (@reactive-resume/ui)
- Dialog, alert dialog, popover and tooltip move from tw-animate keyframes
  to Base UI data-starting/ending-style transitions; menus, popovers and
  tooltips skip motion when opened from the keyboard (data-instant).
- Dialog gains an `instant` prop; the command palette uses it.
- Accordion animates its real panel height; caret rotates instead of
  swapping icons.
- Menu backdrop blur moves onto the popup so it no longer snaps in after
  the fade; context menus and comboboxes fade only.
- Sidebar collapse uses the strong ease-out curve and snaps on Cmd+B.
- Toast, sheet, checkbox, tabs, toggle, inputs and message scroller get
  tokenised easing, correct transition properties and press feedback.
- Tabs no longer squeeze a trigger narrower than its label.
- Spinners keep spinning under prefers-reduced-motion.

Web ap

**File**: `DESIGN.md` (modified, +13/-10)
```diff
@@ -226,21 +226,24 @@ A custom Tailwind token `--aspect-page: 210 / 297` enforces A4 paper proportions
 
 ## Animation
 
-Animations use the Motion library (formerly Framer Motion) and follow a consistent choreography pattern:
+Motion exists to explain a change, confirm an action, or soften a jump. This is a tool people use for hours, so it stays crisp: short, precise, rarely decorative.
 
-**Entrance animations** use a fade-up reveal: elements start at `opacity: 0, y: 20-100` and animate to `opacity: 1, y: 0`. The hero section uses a larger y-offset (100px) for dramatic effect; subsequent sections use 20px for subtlety.
+**Frequency decides first.** Keyboard-initiated actions (the command palette, ⌘B sidebar toggle, zoom shortcuts, keyboard-opened menus via Base UI's `data-instant`) do not animate. Things hit tens of times a day (list rows, tooltips after the first, context menus) get opacity-only or no motion. Dialogs, sheets and toasts get a standard transition. Only rare moments (marketing pages, first load) get more.
 
-**Timing principles:**
-- **Base duration:** 0.35s–0.6s for standard section reveals, 0.45s for hero elements, up to 1.1s for the hero video entrance.
-- **Stagger pattern:** Sequential delays within a group, typically 0.1s–0.15s apart (hero: 0.55s, 0.7s, 0.82s, 0.95s). For grids, use `index * 0.03`–`0.1` for per-item stagger.
-- **Easing:** `easeOut` for entrances (elements decelerate into position). `easeInOut` for looping/ambient animations.
-- **Performance:** Apply `will-change-[transform,opacity]` on animated elements and `will-change-transform` on continuously animated elements.
+**Tokens.** Never hand-type a curve.
+- CSS: `ease-out-strong` / `var(--ease-out-strong)` (`cubic-bezier(0.23, 1, 0.32, 1)`) for anything entering, exiting or responding; `ease-in-out-strong` for on-screen movement nobody is waiting on (ambient loops, carousels); `ease-drawer` for sheets. Never `ease-in`.
+- Motion (JS): `EASE_OUT_STRONG` from `apps/web/src/libs/motion.ts`.
 
-**Hover/interaction animations** are quick (0.2s) and subtle — small scale bumps (`scale: 1.01`), slight y-offsets (`y: -2`), and `active:translate-y-px` for button press.
+**Durations.** Press feedback 100–160ms, tooltips/popovers/menus 150ms in and 100ms out, dialogs 200ms in and 150ms out, sheets 300ms. App UI stays under 300ms; marketing reveals may run 0.5–0.9s. Exits are faster than entrances.
 
-**Ambient animations** loop infinitely with `easeInOut` — the scroll indicator bounces gently (`y: [0, 5, 0]` over 1.5s).
+**Mechanics.**
+- Popups use interruptible CSS transitions on Base UI's `data-starting-style` / `data-ending-style`, scale from `0.95` (never `0`) and grow from `origin-(--transform-origin)`. Modals stay centred.
+- Animate `transform`/`translate`/`scale` and `opacity` only. No `transition-all`, no permanent `will-change` (Motion promotes layers while it animates).
+- Presses use `active:scale-[0.97]`. `Button` already has it; don't wrap it in Motion hover/tap wrappers.
+- Lists use `AnimatePresence initial={false}` so items animate when added or removed, not every time the list mounts.
+- Continuous loops (marquees, drifting spotlights) are CSS keyframes, so they run off the main thread.
 
-**Reduced motion:** All CSS transitions and animations collapse to `0.01ms` duration and single iteration when `prefers-reduced-motion: reduce` is active. Motion library animations should also respect this preference.
+**Reduced motion:** `MotionConfig reducedMotion="user"` disables Motion transforms, and CSS transitions and animations collapse to `0.01ms` — except `animate-spin`, which keeps spinning so loading never looks frozen. Values driven by `useSpring`/`useMotionValue` bypass `MotionConfig`, so check `useReducedMotion()` there.
 
 ## Elevation & Depth
 
```

**File**: `apps/web/src/components/animation/comet-card.test.tsx` (modified, +5/-5)
```diff
@@ -37,20 +37,20 @@ describe("CometCard", () => {
 		expect(glare?.className).toContain("pointer-events-none");
 	});
 
-	it("does not throw when mouse enters / moves over / leaves the card", () => {
+	it("does not throw when pointer moves over / leaves the card", () => {
 		const { container } = render(
 			<CometCard>
 				<span>x</span>
 			</CometCard>,
 		);
 
-		const tiltable = container.querySelector("[class*='will-change-transform']") as HTMLElement;
+		const tiltable = container.querySelector("[class*='rounded-md']") as HTMLElement;
 		expect(tiltable).toBeTruthy();
 
 		expect(() => {
-			fireEvent.mouseMove(tiltable, { clientX: 100, clientY: 50 });
-			fireEvent.mouseMove(tiltable, { clientX: 0, clientY: 0 });
-			fireEvent.mouseLeave(tiltable);
+			fireEvent.pointerMove(tiltable, { clientX: 100, clientY: 50, pointerType: "mouse" });
+			fireEvent.pointerMove(tiltable, { clientX: 0, clientY: 0, pointerType: "mouse" });
+			fireEvent.pointerLeave(tiltable);
 		}).not.toThrow();
 	});
 });
```

**File**: `apps/web/src/components/animation/comet-card.tsx` (modified, +32/-55)
```diff
@@ -1,85 +1,62 @@
 import type React from "react";
-import { m, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
-import { useRef } from "react";
+import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
 import { cn } from "@reactive-resume/utils/style";
+import { EASE_OUT_STRONG } from "@/libs/motion";
 
 type Props = {
-	rotateDepth?: number;
-	translateDepth?: number;
 	glareOpacity?: number;
-	scaleFactor?: number;
 	className?: string;
 	children: React.ReactNode;
 };
 
-export const CometCard = ({
-	rotateDepth = 17.5,
-	translateDepth = 20,
-	glareOpacity = 0.4,
-	scaleFactor = 1.05,
-	className,
-	children,
-}: Props) => {
-	const ref = useRef<HTMLDivElement>(null);
+// Critically damped: the tilt follows the pointer without wobbling past it.
+const tiltSpring = { stiffness: 300, damping: 30 };
 
-	const x = useMotionValue(0);
-	const y = useMotionValue(0);
+export const CometCard = ({ glareOpacity = 0.4, className, children }: Props) => {
+	const reduceMotion = useReducedMotion();
 
-	const mouseXSpring = useSpring(x);
-	const mouseYSpring = useSpring(y);
+	const x = useSpring(useMotionValue(0), tiltSpring);
+	const y = useSpring(useMotionValue(0), tiltSpring);
 
-	const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [`-${rotateDepth}deg`, `${rotateDepth}deg`]);
-	const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [`${rotateDepth}deg`, `-${rotateDepth}deg`]);
-
-	const translateX = useTransform(mouseXSpring, [-0.5, 0.5], [`-${translateDepth}px`, `${translateDepth}px`]);
-	const translateY = useTransform(mouseYSpring, [-0.5, 0.5], [`${translateDepth}px`, `-${translateDepth}px`]);
-
-	const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
-	const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);
+	const rotateX = useTransform(y, [-0.5, 0.5], ["-6deg", "6deg"]);
+	const rotateY = useTransform(x, [-0.5, 0.5], ["6deg", "-6deg"]);
+	const translateX = useTransform(x, [-0.5, 0.5], ["-3px", "3px"]);
+	const translateY = useTransform(y, [-0.5, 0.5], ["3px", "-3px"]);
 
+	const glareX = useTransform(x, [-0.5, 0.5], [0, 100]);
+	const glareY = useTransform(y, [-0.5, 0.5], [0, 100]);
 	const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.9) 10%, rgba(255, 255, 255, 0.75) 20%, rgba(255, 255, 255, 0) 80%)`;
 
-	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
-		if (!ref.current) return;
-
-		const rect = ref.current.getBoundingClientRect();
-
-		const width = rect.width;
-		const height = rect.height;
-
-		const mouseX = e.clientX - rect.left;
-		const mouseY = e.clientY - rect.top;
-
-		const xPct = mouseX / width - 0.5;
-		const yPct = mouseY / height - 0.5;
-
-		x.set(xPct);
-		y.set(yPct);
+	// Touch taps emit synthetic pointer moves that would leave the card stuck mid-tilt, so only follow a real mouse.
+	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
+		if (e.pointerType !== "mouse" || reduceMotion) return;
+		const rect = e.currentTarget.getBoundingClientRect();
+		x.set((e.clientX - rect.left) / rect.width - 0.5);
+		y.set((e.clientY - rect.top) / rect.height - 0.5);
 	};
 
-	const handleMouseLeave = () => {
+	const handlePointerLeave = () => {
 		x.set(0);
 		y.set(0);
 	};
 
 	return (
 		<div className={cn("perspective-distant transform-3d", className)}>
 			<m.div
-				ref={ref}
-				initial={{ scale: 1, z: 0 }}
-				onMouseMove={handleMouseMove}
-				onMouseLeave={handleMouseLeave}
-				className="relative rounded-md will-change-transform"
-				whileHover={{ z: 50, scale: scaleFactor, transition: { duration: 0.2 } }}
-				style={{ rotateX: rotateX, rotateY: rotateY, translateX: translateX, translateY: translateY }}
+				onPointerMove={handlePointerMove}
+				onPointerLeave={handlePointerLeave}
+				className="relative rounded-md"
+				whileHover={{ z: 20, scale: 1.02, transition: { duration: 0.2, ease: EASE_OUT_STRONG } }}
+				style={{ rotateX, rotateY, translateX, translateY }}
 			>
 				{children}
 
-				<m.div
-					transition={{ duration: 0.2 }}
-					style={{ background: glareBackground, opacity: glareOpacity }}
-					className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-md mix-blend-overlay will-change-[opacity]"
-				/>
+				{glareOpacity > 0 && (
+					<m.div
+						style={{ background: glareBackground, opacity: glareOpacity }}
+						className="pointer-events-none absolute inset-0 z-50 size-full rounded-md mix-blend-overlay"
+					/>
+				)}
 			</m.div>
 		</div>
 	);
```

**File**: `apps/web/src/components/animation/count-up.test.tsx` (modified, +26/-32)
```diff
@@ -1,46 +1,40 @@
 // @vitest-environment happy-dom
 
-import { render } from "@testing-library/react";
-import { describe, expect, it } from "vitest";
-import { CountUp } from "./count-up";
+import { render, waitFor } from "@testing-library/react";
+import { describe, expect, it, vi } from "vitest";
+import { domAnimation, LazyMotion } from "motion/react";
 
-describe("CountUp", () => {
-	it("renders an aria-live=polite span by default (announced to screen readers)", () => {
-		const { container } = render(<CountUp to={1000} />);
-		const span = container.querySelector("span") as HTMLSpanElement;
-		expect(span.getAttribute("aria-live")).toBe("polite");
-		expect(span.getAttribute("aria-atomic")).toBe("true");
-	});
+const reducedMotion = vi.hoisted(() => ({ value: false }));
 
-	it("seeds textContent to 0 on initial render", () => {
-		const { container } = render(<CountUp to={100} />);
-		const span = container.querySelector("span") as HTMLSpanElement;
-		expect(span.textContent).toBe("0");
-	});
+vi.mock("motion/react", async (importOriginal) => ({
+	...(await importOriginal<typeof import("motion/react")>()),
+	useReducedMotion: () => reducedMotion.value,
+}));
 
-	it("formats with the separator when one is supplied", () => {
-		const { container } = render(<CountUp to={1234} separator="," />);
-		const span = container.querySelector("span") as HTMLSpanElement;
-		expect(span.textContent).toBe("0");
-	});
+const { CountUp } = await import("./count-up");
 
-	it("preserves decimal places when to is fractional", () => {
-		const { container } = render(<CountUp to={3.75} />);
-		const span = container.querySelector("span") as HTMLSpanElement;
-		expect(span.textContent).toBe("0.00");
+describe("CountUp", () => {
+	it("starts at 0 before animating", () => {
+		reducedMotion.value = false;
+		const { container } = render(<CountUp to={1234} />);
+		expect(container.querySelector("span")?.textContent).toBe("0");
 	});
 
-	it("strips aria-live and aria-atomic when aria-hidden is set", () => {
-		const { container } = render(<CountUp to={100} aria-hidden="true" />);
-		const span = container.querySelector("span") as HTMLSpanElement;
-		expect(span.getAttribute("aria-hidden")).toBe("true");
-		expect(span.getAttribute("aria-live")).toBeNull();
-		expect(span.getAttribute("aria-atomic")).toBeNull();
+	it("jumps to the final grouped value under reduced motion", async () => {
+		reducedMotion.value = true;
+		const { container } = render(
+			<LazyMotion features={domAnimation}>
+				<CountUp to={1234} />
+			</LazyMotion>,
+		);
+		await waitFor(() => expect(container.querySelector("span")?.textContent).toBe("1,234"));
 	});
 
-	it("accepts a custom className", () => {
-		const { container } = render(<CountUp to={100} className="custom-class" />);
+	it("forwards className and aria-hidden", () => {
+		reducedMotion.value = false;
+		const { container } = render(<CountUp to={100} className="custom-class" aria-hidden="true" />);
 		const span = container.querySelector("span") as HTMLSpanElement;
 		expect(span.className).toContain("custom-class");
+		expect(span.getAttribute("aria-hidden")).toBe("true");
 	});
 });
```

**File**: `apps/web/src/components/animation/count-up.tsx` (modified, +14/-70)
```diff
@@ -1,84 +1,28 @@
-import { useInView, useMotionValue, useSpring } from "motion/react";
-import { useCallback, useEffect, useEffectEvent, useRef } from "react";
+import { m, useInView, useReducedMotion, useSpring, useTransform } from "motion/react";
+import { useEffect, useRef } from "react";
 
 type CountUpProps = {
 	to: number;
-	duration?: number;
 	className?: string;
-	separator?: string;
 	"aria-hidden"?: boolean | "true" | "false";
-	"aria-live"?: "off" | "polite" | "assertive";
-	"aria-atomic"?: boolean | "true" | "false";
 };
 
-const getDecimalPlaces = (num: number): number => {
-	const str = num.toString();
-	if (str.includes(".")) {
-		const decimals = str.split(".")[1];
-		if (Number.parseInt(decimals, 10) !== 0) return decimals.length;
-	}
-	return 0;
-};
-
-// ponytail: from/direction/delay/startWhen/onStart/onEnd removed — no production caller passes them
-export function CountUp({
-	to,
-	duration = 2,
-	className = "",
-	separator = "",
-	"aria-hidden": ariaHidden,
-	"aria-live": ariaLive = "polite",
-	"aria-atomic": ariaAtomic = "true",
-}: CountUpProps) {
+// Integer count-up with en-US grouping. Starts once when scrolled into view; reduced motion shows the final value.
+export function CountUp({ to, className, "aria-hidden": ariaHidden }: CountUpProps) {
 	const ref = useRef<HTMLSpanElement>(null);
-	const motionValue = useMotionValue(0);
-
-	const damping = 20 + 40 * (1 / duration);
-	const stiffness = 100 * (1 / duration);
-
-	const springValue = useSpring(motionValue, { damping, stiffness });
-
-	const isInView = useInView(ref, { once: true, margin: "0px" });
-
-	const maxDecimals = getDecimalPlaces(to);
-
-	const formatValue = useCallback(
-		(latest: number) => {
-			const options: Intl.NumberFormatOptions = {
-				useGrouping: !!separator,
-				minimumFractionDigits: maxDecimals,
-				maximumFractionDigits: maxDecimals,
-			};
-			const formattedNumber = Intl.NumberFormat("en-US", options).format(latest);
-			return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
-		},
-		[maxDecimals, separator],
-	);
-
-	const formatCurrentValue = useEffectEvent((latest: number) => formatValue(latest));
-
-	useEffect(() => {
-		if (ref.current) ref.current.textContent = formatCurrentValue(0);
-	}, []);
-
-	useEffect(() => {
-		if (isInView) motionValue.set(to);
-	}, [isInView, motionValue, to]);
+	const isInView = useInView(ref, { once: true });
+	const reducedMotion = useReducedMotion();
+	const spring = useSpring(0, { visualDuration: 0.8, bounce: 0 });
+	const text = useTransform(spring, (value) => Math.round(value).toLocaleString("en-US"));
 
 	useEffect(() => {
-		const unsubscribe = springValue.on("change", (latest: number) => {
-			if (ref.current) ref.current.textContent = formatCurrentValue(latest);
-		});
-		return () => unsubscribe();
-	}, [springValue]);
+		if (reducedMotion) spring.jump(to);
+		else if (isInView) spring.set(to);
+	}, [isInView, reducedMotion, spring, to]);
 
 	return (
-		<span
-			ref={ref}
-			className={className}
-			aria-hidden={ariaHidden}
-			aria-live={ariaHidden ? undefined : ariaLive}
-			aria-atomic={ariaHidden ? undefined : ariaAtomic}
-		/>
+		<m.span ref={ref} className={className} aria-hidden={ariaHidden}>
+			{text}
+		</m.span>
 	);
 }
```

**File**: `apps/web/src/components/animation/spotlight.test.tsx` (modified, +0/-24)
```diff
@@ -18,28 +18,4 @@ describe("Spotlight", () => {
 		const beamGroups = container.firstChild?.childNodes;
 		expect(beamGroups?.length).toBe(2);
 	});
-
-	it("applies the provided width / height / smallWidth to inline styles", () => {
-		const { container } = render(<Spotlight width={500} height={800} smallWidth={120} translateY={-100} />);
-
-		const inlineStyles = Array.from(container.querySelectorAll<HTMLDivElement>("[style]")).map(
-			(el) => el.getAttribute("style") ?? "",
-		);
-		const allStyles = inlineStyles.join("|");
-
-		expect(allStyles).toContain("width: 500px");
-		expect(allStyles).toContain("height: 800px");
-		expect(allStyles).toContain("width: 120px");
-		expect(allStyles).toContain("translateY(-100px)");
-	});
-
-	it("uses the supplied gradient strings as background values", () => {
-		const customFirst = "radial-gradient(red, blue)";
-		const { container } = render(<Spotlight gradientFirst={customFirst} />);
-
-		const matched = Array.from(container.querySelectorAll<HTMLDivElement>("[style]")).filter(
-			(el) => el.style.background.includes("red") && el.style.background.includes("blue"),
-		);
-		expect(matched.length).toBeGreaterThan(0);
-	});
 });
```

**File**: `apps/web/src/components/animation/spotlight.tsx` (modified, +41/-103)
```diff
@@ -1,106 +1,44 @@
-import { m } from "motion/react";
+const FIRST =
+	"radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(210, 100%, 85%, .08) 0, hsla(210, 100%, 55%, .02) 50%, hsla(210, 100%, 45%, 0) 80%)";
+const SECOND =
+	"radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .06) 0, hsla(210, 100%, 55%, .02) 80%, transparent 100%)";
+const THIRD =
+	"radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .04) 0, hsla(210, 100%, 45%, .02) 80%, transparent 100%)";
 
-type SpotlightProps = {
-	duration?: number;
-	gradientFirst?: string;
-	gradientSecond?: string;
-	gradientThird?: string;
-	width?: number;
-	height?: number;
-	smallWidth?: number;
-	translateY?: number;
-	xOffset?: number;
-};
+// CSS keyframes run on the compositor, so the infinite drift never competes with the page's main thread.
+const drift =
+	"pointer-events-none absolute top-0 z-40 h-svh w-svw animate-[spotlight-drift_7s_ease-in-out_infinite_alternate]";
 
-export const Spotlight = ({
-	duration = 7,
-	gradientFirst = "radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(210, 100%, 85%, .08) 0, hsla(210, 100%, 55%, .02) 50%, hsla(210, 100%, 45%, 0) 80%)",
-	gradientSecond = "radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .06) 0, hsla(210, 100%, 55%, .02) 80%, transparent 100%)",
-	gradientThird = "radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .04) 0, hsla(210, 100%, 45%, .02) 80%, transparent 100%)",
-	width = 560,
-	height = 1380,
-	smallWidth = 240,
-	translateY = -350,
-	xOffset = 100,
-}: SpotlightProps) => {
-	return (
-		<m.div
-			initial={{ opacity: 0 }}
-			animate={{ opacity: 1 }}
-			transition={{ duration: 1.5 }}
-			className="pointer-events-none absolute inset-0 h-full w-full"
-		>
-			<m.div
-				animate={{ x: [0, xOffset, 0] }}
-				transition={{ duration, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", ease: "easeInOut" }}
-				className="pointer-events-none absolute inset-s-0 top-0 z-40 h-svh w-svw will-change-transform"
-			>
-				<div
-					className="absolute inset-s-0 top-0"
-					style={{
-						width: `${width}px`,
-						height: `${height}px`,
-						background: gradientFirst,
-						transform: `translateY(${translateY}px) rotate(-45deg)`,
-					}}
-				/>
+export const Spotlight = () => (
+	<div className="fade-in pointer-events-none absolute inset-0 size-full animate-in duration-1500 ease-out">
+		<div className={`${drift} inset-s-0 [--spotlight-drift:100px]`}>
+			<div
+				className="absolute inset-s-0 top-0 h-[1380px] w-[560px]"
+				style={{ background: FIRST, transform: "translateY(-350px) rotate(-45deg)" }}
+			/>
+			<div
+				className="absolute inset-s-0 top-0 h-[1380px] w-[240px] origin-top-left"
+				style={{ background: SECOND, transform: "rotate(-45deg) translate(5%, -50%)" }}
+			/>
+			<div
+				className="absolute inset-s-0 top-0 h-[1380px] w-[240px] origin-top-left"
+				style={{ background: THIRD, transform: "rotate(-45deg) translate(-180%, -70%)" }}
+			/>
+		</div>
 
-				<div
-					className="absolute inset-s-0 top-0 origin-top-left"
-					style={{
-						height: `${height}px`,
-						width: `${smallWidth}px`,
-						background: gradientSecond,
-						transform: "rotate(-45deg) translate(5%, -50%)",
-					}}
-				/>
-
-				<div
-					className="absolute inset-s-0 top-0 origin-top-left"
-					style={{
-						height: `${height}px`,
-						width: `${smallWidth}px`,
-						background: gradientThird,
-						transform: "rotate(-45deg) translate(-180%, -70%)",
-					}}
-				/>
-			</m.div>
-
-			<m.div
-				animate={{ x: [0, -xOffset, 0] }}
-				transition={{ duration, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", repeatType: "reverse" }}
-				className="pointer-events-none absolute inset-e-0 top-0 z-40 h-svh w-svw will-change-transform"
-			>
-				<div
-					className="absolute inset-e-0 top-0"
-					style={{
-						width: `${width}px`,
-						height: `${height}px`,
-						background: gradientFirst,
-						transform: `translateY(${translateY}px) rotate(45deg)`,
-					}}
-				/>
-
-				<div
-					className="absolute inset-e-0 top-0 origin-top-right"
-					style={{
-						height: `${height}px`,
-						width: `${smallWidth}px`,
-						background: gradientSecond,
-						transform: "rotate(45deg) translate(-5%, -50%)",
-					}}
-				/>
-
-				<div
-					className="absolute inset-e-0 top-0 origin-top-right"
-					style={{
-						height: `${height}px`,
-						width: `${smallWidth}px`,
-						background: gradientThird,
-						transform: "rotate(45deg) translate(180%, -70%)",
-					}}
-				/>
-			</m.div>
-		</m.div>
-	);
-};
+		<div className={`${drift} inset-e-0 [--spotlight-drift:-100px]`}>
+			<div
+				className="absolute inset-e-0 top-0 h-[1380px] w-[560px]"
+				style={{ background: FIRST, transform: "translateY(-350px) rotate(45deg)" }}
+			/>
+			<div
+				className="absolute inset-e-0 top-0 h-[1380px] w-[240px] origin-top-right"
+				style={{ background: SECOND, transform: "rotate(45deg) translate(-5%, -50%)" }}
+			/>
+			<div
+				className="
```

**File**: `apps/web/src/components/input/chip-input.tsx` (modified, +34/-52)
```diff
@@ -13,7 +13,6 @@ import { CSS } from "@dnd-kit/utilities";
 import { t } from "@lingui/core/macro";
 import { Trans } from "@lingui/react/macro";
 import { PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
-import { AnimatePresence, m } from "motion/react";
 import * as React from "react";
 import { createPortal } from "react-dom";
 import { Badge } from "@reactive-resume/ui/components/badge";
@@ -75,15 +74,10 @@ function ChipItem({ id, chip, index, isEditing, onEdit, onRemove }: ChipItemProp
 	};
 
 	return (
-		<m.div
-			layout
-			initial={{ opacity: 0, scale: 0.92, y: -4 }}
-			animate={{ opacity: isDragging ? 0.62 : 1, scale: 1, y: 0 }}
-			exit={{ opacity: 0, scale: 0.92, y: -4 }}
-			transition={{ duration: 0.1, ease: "easeOut" }}
+		<div
 			style={style}
 			ref={setNodeRef}
-			className="group/chip relative touch-none"
+			className={cn("group/chip relative touch-none", isDragging && "opacity-60")}
 			{...attributes}
 			{...listeners}
 		>
@@ -96,11 +90,11 @@ function ChipItem({ id, chip, index, isEditing, onEdit, onRemove }: ChipItemProp
 				)}
 			>
 				<span className="max-w-32 truncate sm:max-w-44">{chip}</span>
-				<m.div
-					initial={false}
-					animate={isEditing ? { opacity: 1 } : { opacity: 0.66 }}
-					transition={{ duration: 0.12, ease: "easeOut" }}
-					className="ms-1.5 flex shrink-0 items-center gap-x-0.5 will-change-[opacity] group-focus-within/chip:opacity-100 group-hover/chip:opacity-100"
+				<div
+					className={cn(
+						"ms-1.5 flex shrink-0 items-center gap-x-0.5 transition-opacity duration-150 group-focus-within/chip:opacity-100 group-hover/chip:opacity-100",
+						isEditing ? "opacity-100" : "opacity-65",
+					)}
 				>
 					<button
 						type="button"
@@ -134,9 +128,9 @@ function ChipItem({ id, chip, index, isEditing, onEdit, onRemove }: ChipItemProp
 					>
 						<XIcon className="size-3.5" />
 					</button>
-				</m.div>
+				</div>
 			</Badge>
-		</m.div>
+		</div>
 	);
 }
 
@@ -357,21 +351,19 @@ export function ChipInput({
 							className={cn("max-h-24 overflow-y-auto px-2 py-1.5", hasChips ? "border-border/70 border-b" : "hidden")}
 						>
 							<SortableContext items={chips} strategy={rectSortingStrategy}>
-								<m.div layout className="flex flex-wrap gap-1">
-									<AnimatePresence initial={false} mode="popLayout">
-										{chips.map((chip, idx) => (
-											<ChipItem
-												key={chip}
-												id={chip}
-												chip={chip}
-												index={idx}
-												isEditing={editingIndex === idx}
-												onEdit={handleEdit}
-												onRemove={removeChip}
-											/>
-										))}
-									</AnimatePresence>
-								</m.div>
+								<div className="flex flex-wrap gap-1">
+									{chips.map((chip, idx) => (
+										<ChipItem
+											key={chip}
+											id={chip}
+											chip={chip}
+											index={idx}
+											isEditing={editingIndex === idx}
+											onEdit={handleEdit}
+											onRemove={removeChip}
+										/>
+									))}
+								</div>
 							</SortableContext>
 						</div>
 						<div className={cn("flex items-center gap-1.5 px-2", hasChips ? "py-1.5" : "py-0")}>
@@ -393,28 +385,18 @@ export function ChipInput({
 								onChange={handleInputChange}
 								className="h-9 flex-1 border-none p-0 focus-visible:border-none focus-visible:ring-0 dark:bg-transparent"
 							/>
-							<AnimatePresence>
-								{chips.length > 0 && (
-									<m.span
-										layout
-										initial={{ opacity: 0, scale: 0.95 }}
-										animate={{
-											opacity: isEditingKeyword ? 1 : 0.8,
-											scale: 1,
-										}}
-										exit={{ opacity: 0, scale: 0.95 }}
-										transition={{ duration: 0.12, ease: "easeOut" }}
-										className={cn(
-											"flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border px-1.5 font-medium text-[0.7rem] tabular-nums",
-											isEditingKeyword
-												? "border-primary/30 bg-primary/10 text-primary"
-												: "border-border bg-muted/50 text-foreground/80",
-										)}
-									>
-										{isEditingKeyword ? <Trans>Edit</Trans> : chips.length}
-									</m.span>
-								)}
-							</AnimatePresence>
+							{chips.length > 0 && (
+								<span
+									className={cn(
+										"flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border px-1.5 font-medium text-[0.7rem] tabular-nums",
+										isEditingKeyword
+											? "border-primary/30 bg-primary/10 text-primary"
+											: "border-border bg-muted/50 text-foreground/80 opacity-80",
+									)}
+								>
+									{isEditingKeyword ? <Trans>Edit</Trans> : chips.length}
+								</span>
+							)}
 						</div>
 					</div>
 				</div>
```

---

### Incident Patch 13: `0cb83602` (2026-09-26)
**Commit Message**: fix(docker): create SeaweedFS bucket with aws-cli instead of minio/mc (#3544)

quay.io/minio/mc:latest is no longer publicly pullable (401 UNAUTHORIZED),
which broke the Docker publish workflow. Use the official amazon/aws-cli
image to create the bucket idempotently via head-bucket || s3 mb.

**File**: `compose.dev.yml` (modified, +7/-6)
```diff
@@ -97,15 +97,16 @@ services:
       retries: 3
 
   seaweedfs_create_bucket:
-    image: quay.io/minio/mc:latest
+    image: amazon/aws-cli:latest
     restart: on-failure
+    environment:
+      AWS_ACCESS_KEY_ID: seaweedfs
+      AWS_SECRET_ACCESS_KEY: seaweedfs
+      AWS_DEFAULT_REGION: us-east-1
     entrypoint: >
       /bin/sh -c "
-        until mc alias set seaweedfs http://seaweedfs:8333 seaweedfs seaweedfs; do
-          echo 'Waiting for SeaweedFS...';
-          sleep 2;
-        done;
-        mc mb seaweedfs/reactive-resume --ignore-existing;
+        aws --endpoint-url http://seaweedfs:8333 s3api head-bucket --bucket reactive-resume 2>/dev/null ||
+        aws --endpoint-url http://seaweedfs:8333 s3 mb s3://reactive-resume
       "
     depends_on:
       seaweedfs:
```

**File**: `compose.yml` (modified, +7/-5)
```diff
@@ -62,14 +62,16 @@ services:
       retries: 3
 
   seaweedfs_create_bucket:
-    image: quay.io/minio/mc:latest
+    image: amazon/aws-cli:latest
     restart: on-failure
+    environment:
+      - AWS_ACCESS_KEY_ID=seaweedfs
+      - AWS_SECRET_ACCESS_KEY=seaweedfs
+      - AWS_DEFAULT_REGION=us-east-1
     entrypoint: >
       /bin/sh -c "
-        sleep 5;
-        mc alias set seaweedfs http://seaweedfs:8333 seaweedfs seaweedfs;
-        mc mb seaweedfs/reactive-resume;
-        exit 0;
+        aws --endpoint-url http://seaweedfs:8333 s3api head-bucket --bucket reactive-resume 2>/dev/null ||
+        aws --endpoint-url http://seaweedfs:8333 s3 mb s3://reactive-resume
       "
     networks:
       - storage_network
```

**File**: `docs/self-hosting/examples.mdx` (modified, +7/-3)
```diff
@@ -336,14 +336,18 @@ services:
       replicas: 1
 
   seaweedfs_create_bucket:
-    image: quay.io/minio/mc:latest
+    image: amazon/aws-cli:latest
+    environment:
+      - AWS_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID
+      - AWS_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY
+      - AWS_DEFAULT_REGION=us-east-1
     entrypoint: >
       /bin/sh -c "
-        until mc alias set seaweedfs http://seaweedfs:8333 $S3_ACCESS_KEY_ID $S3_SECRET_ACCESS_KEY; do
+        until aws --endpoint-url http://seaweedfs:8333 s3api head-bucket --bucket $S3_BUCKET 2>/dev/null ||
+          aws --endpoint-url http://seaweedfs:8333 s3 mb s3://$S3_BUCKET; do
           echo 'Waiting for SeaweedFS...';
           sleep 2;
         done;
-        mc mb seaweedfs/$S3_BUCKET --ignore-existing;
       "
     networks:
       - reactive_resume_network
```

---

### Incident Patch 14: `f0bc26cb` (2026-09-22)
**Commit Message**: fix(ci): restore Docker publishing with portable runner fallbacks (#3533)

Co-authored-by: Amruth Pillai <[REDACTED_EMAIL]>

**File**: `.github/workflows/autofix.yml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ env:
 
 jobs:
   autofix:
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
 
     steps:
       - name: Checkout Repository
```

**File**: `.github/workflows/crowdin-sync.yml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ concurrency:
 
 jobs:
   crowdin-sync:
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
 
     permissions:
       contents: write
```

**File**: `.github/workflows/docker-build.yml` (modified, +68/-28)
```diff
@@ -24,7 +24,7 @@ env:
 
 jobs:
   mode:
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
 
     outputs:
       nightly: ${{ steps.mode.outputs.nightly }}
@@ -61,10 +61,10 @@ jobs:
       matrix:
         include:
           - platform: linux/amd64
-            runner: blacksmith-32vcpu-ubuntu-2404
+            runner: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
             arch: amd64
           - platform: linux/arm64
-            runner: blacksmith-32vcpu-ubuntu-2404-arm
+            runner: ${{ vars.CI_RUNNER_ARM64 || 'ubuntu-24.04-arm' }}
             arch: arm64
 
     runs-on: ${{ matrix.runner }}
@@ -80,12 +80,38 @@ jobs:
       - name: Checkout Repository
         uses: actions/checkout@v6
 
-      - name: Setup Blacksmith Docker Builder
-        uses: useblacksmith/setup-docker-builder@v2
-        with:
-          cache-key: Dockerfile-${{ matrix.arch }}
+      - name: Setup Docker Buildx
+        uses: docker/setup-buildx-action@v4
+
+      - &registries
+        name: Determine registries
+        id: registries
+        env:
+          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
+          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
+        run: |
+          set -euo pipefail
+
+          dockerhub=false
+          ghcr_image="${GHCR_IMAGE,,}"
+          docker_image="${DOCKER_IMAGE,,}"
+          images="$ghcr_image"
+          if [[ -n "$DOCKER_USERNAME" && -n "$DOCKER_PASSWORD" ]]; then
+            dockerhub=true
+            images="${images}"$'\n'"$docker_image"
+          fi
+
+          {
+            echo "ghcr_image=$ghcr_image"
+            echo "docker_image=$docker_image"
+            echo "images<<EOF"
+            echo "$images"
+            echo "EOF"
+            echo "dockerhub=$dockerhub"
+          } >> "$GITHUB_OUTPUT"
 
       - name: Login to Docker Hub
+        if: ${{ steps.registries.outputs.dockerhub == 'true' }}
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
@@ -102,23 +128,21 @@ jobs:
         id: meta
         uses: docker/metadata-action@v6
         with:
-          images: |
-            ${{ env.GHCR_IMAGE }}
-            ${{ env.DOCKER_IMAGE }}
+          images: ${{ steps.registries.outputs.images }}
           tags: |
             type=sha,prefix=sha-,suffix=-${{ matrix.arch }}
 
       - name: Cache-only smoke build
         if: ${{ needs.mode.outputs.canary == 'true' }}
-        uses: useblacksmith/build-push-action@v2
+        uses: docker/build-push-action@v7
         with:
           context: .
           platforms: ${{ matrix.platform }}
           outputs: type=cacheonly
 
       - name: Build and Push by Digest
         id: build
-        uses: useblacksmith/build-push-action@v2
+        uses: docker/build-push-action@v7
         with:
           context: .
           sbom: true
@@ -148,7 +172,11 @@ jobs:
       - mode
       - build
     timeout-minutes: 30
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
+
+    env:
+      DEPLOY: ${{ secrets.SSH_KEY != '' && secrets.SSH_HOST != '' && secrets.SSH_USER != '' }}
+      PURGE_CLOUDFLARE: ${{ secrets.CLOUDFLARE_ZONE_ID != '' && secrets.CLOUDFLARE_API_TOKEN != '' }}
 
     permissions:
       contents: read
@@ -177,7 +205,10 @@ jobs:
       - name: Setup Docker Buildx
         uses: docker/setup-buildx-action@v4
 
+      - *registries
+
       - name: Login to Docker Hub
+        if: ${{ steps.registries.outputs.dockerhub == 'true' }}
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
@@ -204,9 +235,7 @@ jobs:
         id: meta
         uses: docker/metadata-action@v6
         with:
-          images: |
-            ${{ env.GHCR_IMAGE }}
-            ${{ env.DOCKER_IMAGE }}
+          images: ${{ steps.registries.outputs.images }}
           tags: |
             type=sha,prefix=sha-
             type=raw,value=canary-${{ github.run_id }}-${{ github.run_attempt }},enable=${{ needs.mode.outputs.canary == 'true' }}
@@ -241,30 +270,37 @@ jobs:
             --annotation "index:org.opencontainers.image.documentation=https://docs.rxresu.me" \
             --annotation "index:org.opencontainers.image.source=https://github.com/${{ github.repository }}" \
             --annotation "index:org.opencontainers.image.version=${{ steps.version.outputs.version }}" \
-            $(printf '${{ env.GHCR_IMAGE }}@sha256:%s ' *)
+            $(printf '${{ steps.registries.outputs.ghcr_image }}@sha256:%s ' *)
 
           # Get the digest of the multi-arch manifest
-          GHCR_DIGEST=$(docker buildx imagetools inspect ${{ env.GHCR_IMAGE }}:${FINAL_TAG} --format '{{json .Manifest.Digest}}' | tr -d '"')
-          DOCKER_DIGEST=$(docker buildx imagetools inspect ${{ env.DOCKER_IMAGE }}:${FINAL_TAG} --format '{{json .Manifest.Digest}}' | tr -d '"')
+          GHCR_DIGEST=$(docker buildx imagetools 
```

**File**: `.github/workflows/e2e.yml` (modified, +2/-7)
```diff
@@ -20,7 +20,7 @@ env:
 
 jobs:
   e2e:
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
     timeout-minutes: 30
 
     services:
@@ -58,12 +58,7 @@ jobs:
 
       - name: Install Playwright Browser
         timeout-minutes: 10
-        run: |
-          # The runner's Ubuntu archive/security mirrors time out during dependency installation.
-          printf '%s\n' 'https://mirrors.edge.kernel.org/ubuntu/' | sudo tee /etc/apt/blacksmith-ubuntu-mirrors.txt > /dev/null
-          sudo find /etc/apt -type f \( -name '*.list' -o -name '*.sources' \) \
-            -exec sed -i -E 's#https?://(archive|us\.archive|security)\.ubuntu\.com/ubuntu#https://mirrors.edge.kernel.org/ubuntu#g' {} +
-          pnpm exec playwright install --with-deps chromium
+        run: pnpm exec playwright install --with-deps chromium
 
       - name: Generate Test Secrets
         run: |
```

**File**: `.github/workflows/label-issues.yml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ permissions:
 
 jobs:
   label:
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
 
     steps:
       - name: Checkout Repository
```

**File**: `.github/workflows/stale-issues.yml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ permissions:
 
 jobs:
   stale:
-    runs-on: blacksmith-32vcpu-ubuntu-2404
+    runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}
 
     steps:
       - name: Close Inactive Issues Awaiting Information
```

**File**: `docs/agents/container-publishing.md` (modified, +21/-15)
```diff
@@ -6,31 +6,38 @@ The repository is `reactive-resume/reactive-resume`. Docker Hub remains
 
 ## Builds and release safety
 
-`.github/workflows/docker-build.yml` builds AMD64 and ARM64 on matching native Blacksmith
-32-vCPU runners. Blacksmith's persistent Docker builder caches layers and cache mounts;
-the architecture-specific cache keys keep the two builders separate.
+`.github/workflows/docker-build.yml` builds AMD64 and ARM64 on matching native runners.
+Repository variables `CI_RUNNER_X64` and `CI_RUNNER_ARM64` select the runner labels;
+they default to `ubuntu-latest` and `ubuntu-24.04-arm`, respectively. Other CI workflows
+also use `CI_RUNNER_X64`. Docker Buildx shares its local cache between steps within a job;
+no cache is persisted between workflow runs.
 
 | Trigger | Published aliases | Production deployment |
 | --- | --- | --- |
 | Push to `main` | `sha-*`, `nightly`, timestamped nightly | No |
 | Manual dispatch, default `release=false` | `sha-*`, `canary-<run-id>-<attempt>` | No |
-| Push of a `v*` tag or explicit `release=true` | `sha-*`, `latest`, version/major/minor | Yes: SSH redeploy and Cloudflare purge |
+| Push of a `v*` tag or explicit `release=true` | `sha-*`, `latest`, version/major/minor | When configured: SSH redeploy and Cloudflare purge |
 
-Manual `release=true` republishes the version already in `package.json` and redeploys
-production. It does not create a Git tag, GitHub release, or version bump. Use this for
-an approved current-version rebuild; it replaces the existing stable image aliases.
+Manual `release=true` republishes the version already in `package.json` and runs configured
+production integrations. SSH redeployment requires `SSH_KEY`, `SSH_HOST`, and `SSH_USER`;
+Cloudflare purging requires `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`. Each integration
+is skipped if any of its required secrets is missing. Dispatch does not create a Git tag,
+GitHub release, or version bump. Use this for an approved current-version rebuild;
+it replaces the existing stable image aliases.
 
 Manual canaries first run a cache-only build on each architecture, then publish, merge,
-and sign both registry images. Run one with:
+and sign images in the enabled registries. Run one with:
 
 ```bash
 gh workflow run docker-build.yml --repo reactive-resume/reactive-resume --ref main -f release=false
 ```
 
-Both registries retain SBOMs, maximum provenance, and Cosign signatures. Publishing uses
-`DOCKER_USERNAME` / `DOCKER_PASSWORD` for Docker Hub and the destination repository's
-`GITHUB_TOKEN` with `packages: write` for GHCR. New GHCR packages need public visibility,
-repository linkage, and Actions access before consumers can pull anonymously.
+Published images retain SBOMs, maximum provenance, and Cosign signatures. GHCR always uses
+the destination repository's `GITHUB_TOKEN` with `packages: write`. Docker Hub publishing
+is enabled only when both `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are present;
+otherwise login, publishing, signing, and verification target GHCR only. Image references
+are normalized to lowercase. New GHCR packages need public visibility, repository linkage,
+and Actions access before consumers can pull anonymously.
 
 ## Verification and historical images
 
@@ -62,7 +69,7 @@ rm -r "$registry_config"
 
 On September 11, 2026, `latest`, `v5`, `v5.3`, and `v5.3.0` were copied to the then-current
 public GHCR package, `ghcr.io/reactive-resume/app`. Both architectures were pulled anonymously; the original Cosign signature,
-SBOMs, provenance, and image digest were verified. The signed Blacksmith canary
+SBOMs, provenance, and image digest were verified. The signed canary
 [`canary-34582818410-1`](https://github.com/reactive-resume/reactive-resume/actions/runs/34582818410)
 also passed on both registries without deploying production.
 
@@ -108,6 +115,5 @@ OIDC trust policies; the repository URL alone does not describe the subject.
 Track availability and supported copied tags in [migration issue #3503](https://github.com/reactive-resume/reactive-resume/issues/3503).
 No database reset, volume deletion, or resume-data migration is required.
 
-References: [Blacksmith Docker caching](https://docs.blacksmith.sh/blacksmith-caching/docker-builds),
-[GitHub package permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages),
+References: [GitHub package permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages),
 [Cosign verification](https://docs.sigstore.dev/cosign/verifying/verify/).
```

**File**: `tooling/playwright-mirrors.test.ts` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-import { execFileSync } from "node:child_process";
-import { readFileSync } from "node:fs";
-import { expect, it } from "vitest";
-
-it("rewrites Ubuntu APT sources while preserving unrelated repositories and signature settings", () => {
-	const workflow = readFileSync(new URL("../.github/workflows/e2e.yml", import.meta.url), "utf8");
-	const expression = workflow.match(/-exec sed -i -E '([^']+)'/)?.[1];
-	if (!expression) throw new Error("Ubuntu mirror rewrite is missing");
-	const input = [
-		"deb http://archive.ubuntu.com/ubuntu noble main",
-		"URIs: http://us.archive.ubuntu.com/ubuntu/",
-		"URIs: https://security.ubuntu.com/ubuntu/",
-		"Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg",
-		"URIs: mirror+file:/etc/apt/blacksmith-ubuntu-mirrors.txt",
-		"deb https://packages.microsoft.com/ubuntu/24.04/prod noble main",
-	].join("\n");
-	const output = execFileSync("sed", ["-E", expression], { input, encoding: "utf8" });
-	expect(output.trimEnd()).toBe(
-		input
-			.replace("http://archive.ubuntu.com/ubuntu", "https://mirrors.edge.kernel.org/ubuntu")
-			.replace("http://us.archive.ubuntu.com/ubuntu", "https://mirrors.edge.kernel.org/ubuntu")
-			.replace("https://security.ubuntu.com/ubuntu", "https://mirrors.edge.kernel.org/ubuntu"),
-	);
-});
```

---

### Incident Patch 15: `0ac320b0` (2026-09-22)
**Commit Message**: fix(web): enabled drag and drop by moving file input on top of the button (#3529)

**File**: `apps/web/src/dialogs/resume/import.tsx` (modified, +9/-3)
```diff
@@ -334,12 +334,18 @@ export function ImportResumeDialog(_: DialogProps<"resume.import">) {
 							<FormLabel>
 								<Trans>File</Trans>
 							</FormLabel>
-							<FormControl>
-								<Input type="file" className="hidden" ref={inputRef} onChange={onUploadFile} />
+							<FormControl className="group/upload relative">
+								<Input
+									type="file"
+									className="absolute inset-0 z-1 h-full w-full cursor-pointer opacity-0"
+									tabIndex={-1}
+									ref={inputRef}
+									onChange={onUploadFile}
+								/>
 
 								<Button
 									variant="outline"
-									className="h-auto w-full flex-col border-dashed py-8 font-normal"
+									className="h-auto w-full flex-col border-dashed py-8 font-normal group-hover/upload:bg-muted group-hover/upload:text-foreground"
 									onClick={onSelectFile}
 								>
 									{field.state.value ? (
```

#### Recent Merged Pull Requests:
- **PR #3580** (2026-10-05): fix(docs): publish portable cURL samples in the API reference (@amruthpillai)
- **PR #3577** (closed): test(server): deflake timing-sensitive unit tests on loaded CI runners (@santhiprakash)
- **PR #3575** (2026-10-05): fix(auth): prevent transient session logout on rate limits and networ... (@iwmywn)
- **PR #3573** (2026-10-05): Fix resume crashes over HTTP (@amruthpillai)
- **PR #3572** (2026-10-05): test(pdf): cover the cover-letter sender block end to end (@santhiprakash)
- **PR #3571** (2026-10-05): fix(env): reject REDIS_URL with a username but no password (@santhiprakash)
- **PR #3570** (closed): feat(ai): add OrcaRouter as a first-class provider with API key and OAuth 2.0 + PKCE sign-in (@tonzituyet48-lang)
- **PR #3568** (2026-10-04): Reactive Resume v6 (@amruthpillai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
