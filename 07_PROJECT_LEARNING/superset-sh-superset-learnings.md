# Forensic Learning Record (Deep Inspection): superset-sh/superset

> **Canonical Artifact**: `07_PROJECT_LEARNING/superset-sh-superset-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/superset-sh/superset](https://github.com/superset-sh/superset))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:35.984Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superset-sh/superset`
- **Description**: Superset is an agentic IDE to orchestrate 100+ coding agents in parallel. Run any agent with your own subscription.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14774 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/mobile-demo-film/scripts/film.py`
```
#!/usr/bin/env python3
"""Compose screen recordings and cards into a configurable silent demo video.

  film.py normalize raw.mov cfr.mp4      constant 30fps copy to find cut points in
  film.py compose film.json              render the film described by the spec
  film.py sheet film.mp4 sheet.jpg       8-frame contact sheet for review

Needs ffmpeg and Pillow. The spec format is documented in ../SKILL.md.
"""

import argparse
import json
import math
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


@dataclass(frozen=True)
class RenderSettings:
    width: int = 1080
    height: int = 1920
    fps: int = 30
    crf: int = 18
    fade: float = 0.35
    phone_width: float = 0.615
    phone_height: float = 0.82
    bezel_width: float = 0.015
    corner_radius: float = 0.137

    @classmethod
    def from_spec(cls, spec):
        values = spec.get("render", {})
        if not isinstance(values, dict):
            raise ValueError("render must be an object")
        unknown = values.keys() - cls.__dataclass_fields__.keys()
        if unknown:
            raise ValueError(f"Unknown render settings: {', '.join(sorted(unknown))}")
        settings = cls(**values)
        for name in ("width", "height", "fps", "crf"):
            value = getattr(settings, name)
            if type(value) is not int:
                raise ValueError(f"render.{name} must be an integer")
        if any(n < 64 or n % 2 for n in (settings.width, settings.height)):
            raise ValueError("render.width and render.height must be even and at least 64")
        if not 1 <= settings.fps <= 120 or not 0 <= settings.crf <= 51:
            raise ValueError("render.fps must be 1..120 and render.crf must be 0..51")
        number(settings.fade, "render.fade", minimum=0)
        for name in ("phone_width", "phone_height"):
            value = number(getattr(settings, name), f"render.{name}", minimum=0, exclusive=True)
            if value > 0.95:
                raise ValueError(f"render.{name} must be at most 0.95")
        for name in ("bezel_width", "corner_radius"):
            value = number(getattr(settings, name), f"render.{name}", minimum=0)
            if value > 0.25:
                raise ValueError(f"render.{name} must be at most 0.25")
        return settings

    @property
    def scale(self):
        return min(self.width / 1080, self.height / 1920)

    def pixels(self, value):
        return max(1, round(value * self.scale))

    def phone_size(self, src_w, src_h):
        bezel = round(min(self.width, self.height) * self.bezel_width)
        width = min(self.width * self.phone_width, self.width - 2 * bezel,
                    (min(self.height * self.phone_height, self.height - 2 * bezel)) * src_w / src_h)
        return max(2, int(width // 2) * 2), max(2, int(width * src_h / src_w // 2) * 2), bezel


def number(value, label, minimum=0, exclusive=False):
    if (type(value) not in (int, float) or not math.isfinite(value)
            or (value <= minimum if exclusive else value < minimum)):
        relation = "greater than" if exclusive else "at least"
        raise ValueError(f"{label} must be a finite number {relation} {minimum}")
    return value


def fades(settings, duration, color):
    duration = max(duration, 1 / settings.fps)
    fade = min(settings.fade, duration / 2)
    if fade == 0:
        return "format=yuv420p"
    return (f"fade=t=in:st=0:d={fade}:color={color},"
            f"fade=t=out:st={duration - fade}:d={fade}:color={color},format=yuv420p")


def output_path(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


SANS = ["/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
SERIF = ["/System/Library/Fonts/NewYork.ttf", "/System/Library/Fonts/Times.ttc",
         "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height:format=duration", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    if not data.get("streams"):
        raise ValueError(f"No video stream in {path}")
    stream = data["streams"][0]
    return stream["width"], stream["height"], float(data["format"]["duration"])


def font(candidates, size, override=None):
    for path in [override, *candidates]:
        if path and Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def centered(draw, canvas_width, y, text, fnt, fill):
    width = draw.textlength(text, font=fnt)
    draw.text(((canvas_width - width) / 2, y), text, font=fnt, fill=fill)


def normalize(src, dst, fps=30):
    if type(fps) is not int or not 1 <= fps <= 120:
        raise ValueError("fps must be an integer in 1..120")
    if Path(src).resolve() == Path(dst).resolve():
        raise ValueError("Source and output must be different files")
    run(["-i", str(src), "-vf", f"fps={fps}", "-an", "-c:v", "libx264",
         "-crf", "14", "-pix_fmt", "yuv420p", str(output_path(dst))])


def phone_layers(spec, label, src_w, src_h, work, index):
    settings = RenderSettings.from_spec(spec)
    width, height = settings.width, settings.height
    screen_w, screen_h, bezel = settings.phone_size(src_w, src_h)
    x, y = (width - screen_w) // 2, (height - screen_h) // 2
    radius = min(round(screen_w * settings.corner_radius), screen_h // 2)
    scale = 4

    frame = Image.new("RGB", (width, height), hex_rgb(spec.get("backdrop", "#F2F0EB")))
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x - bezel, y - bezel + settings.pixels(18), x + screen_w + bezel, y + screen_h + bezel + settings.pixels(18)),
        radius + bezel, fill=(0, 0, 0, 46))
    blurred = shadow.filter(ImageFilter.GaussianBlur(settings.pixels(28)))
    frame.paste(blurred, (0, 0), blurred)

    body = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(
        ((x - bezel) * scale, (y - bezel) * scale,
         (x + screen_w + bezel) * scale, (y + screen_h + bezel) * scale),
        (radius + bezel) * scale, fill=hex_rgb(spec.get("bezel", "#111113")) + (255,))
    body = body.resize((width, height), Image.LANCZOS)
    frame.paste(body, (0, 0), body)

    if label:
        draw = ImageDraw.Draw(frame)
        centered(draw, width, y - bezel - settings.pixels(58), label.upper(),
                 font(SANS, settings.pixels(22), spec.get("sansFont")), hex_rgb(spec.get("muted", "#8A8780")))

    mask = Image.new("L", (screen_w * scale, screen_h * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, screen_w * scale - 1, screen_h * scale - 1), radius * scale, fill=255)
    mask = mask.resize((screen_w, screen_h), Image.LANCZOS)

    island_w, island_h = round(screen_w * 0.313), round(screen_w * 0.092)
    island = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    ix, iy = (width - island_w) // 2, y + round(screen_w * 0.028)
    ImageDraw.Draw(island).rounded_rectangle(
        (ix * scale, iy * scale, (ix + island_w) * scale, (iy + island_h) * scale),
        island_h * scale // 2, fill=(0, 0, 0, 255))
    island = island.resize((width, height), Image.LANCZOS)

    paths = [work / f"{index}-{name}.png" for name in ("frame", "mask", "island")]
    frame.save(paths[0])
    mask.save(paths[1])
    island.save(paths[2])
    return paths, (x, y, screen_w, screen_h)


def render_phone(spec, seg, work, index, bas
```

### Core Architecture Module: `apps/admin/next.config.ts`
```
import { join } from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import { config as dotenvConfig } from "dotenv";
import type { NextConfig } from "next";

// Load .env from monorepo root during development
if (process.env.NODE_ENV !== "production") {
	dotenvConfig({
		path: join(process.cwd(), "../../.env"),
		override: true,
		quiet: true,
	});
}

const config: NextConfig = {
	reactCompiler: true,
	typescript: { ignoreBuildErrors: true },

	// Compiles @lingui/react/macro at build time. Version must stay in
	// lockstep with Next's swc_core ABI — see plans/20260826-i18n-strategy.md.
	experimental: {
		swcPlugins: [["@lingui/swc-plugin", {}]],
	},

	async rewrites() {
		return [
			{
				source: "/ingest/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/ingest/:path*",
				destination: "https://us.i.posthog.com/:path*",
			},
			{
				source: "/ingest/decide",
				destination: "https://us.i.posthog.com/decide",
			},
		];
	},

	skipTrailingSlashRedirect: true,
};

export default withSentryConfig(config, {
	org: "superset-sh",
	project: "admin",
	applicationKey: "superset-admin",
	silent: !process.env.CI,
	authToken: process.env.SENTRY_AUTH_TOKEN,
	widenClientFileUpload: true,
	tunnelRoute: "/monitoring",
	disableLogger: true,
	automaticVercelMonitors: true,
});

```

### Core Architecture Module: `apps/admin/postcss.config.mjs`
```
export default {
	plugins: {
		"@tailwindcss/postcss": {},
	},
};

```

### Core Architecture Module: `apps/admin/sentry.edge.config.ts`
```
import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";

Sentry.init({
	dsn: env.NEXT_PUBLIC_SENTRY_DSN_ADMIN,
	environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
	enabled: !!env.NEXT_PUBLIC_SENTRY_DSN_ADMIN,
	sendDefaultPii: true,
	debug: false,
});

```

### Core Architecture Module: `apps/admin/sentry.server.config.ts`
```
import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";

Sentry.init({
	dsn: env.NEXT_PUBLIC_SENTRY_DSN_ADMIN,
	environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
	enabled: !!env.NEXT_PUBLIC_SENTRY_DSN_ADMIN,
	sendDefaultPii: true,
	debug: false,
});

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/components/AppSidebar/AppSidebar.tsx`
```
"use client";

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@superset/ui/sidebar";
import { usePathname } from "next/navigation";
import { LuChevronRight, LuHouse, LuTrendingUp } from "react-icons/lu";

import { AppSidebarHeader } from "./components/AppSidebarHeader";
import { NavUser, type SidebarUser } from "./components/NavUser";
import { SearchForm } from "./components/SearchForm";

const topLevelNav = [
	{
		title: msg({ message: "Home" }),
		url: "/",
		icon: LuHouse,
	},
	{
		title: msg({ message: "Growth" }),
		url: "/growth",
		icon: LuTrendingUp,
	},
];

const sections: {
	title: MessageDescriptor;
	items: { title: MessageDescriptor; url: string; icon: typeof LuHouse }[];
}[] = [];

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	user: SidebarUser;
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
	const { i18n } = useLingui();
	const pathname = usePathname();

	const isActive = (url: string) => {
		if (url === "/") return pathname === "/";
		return pathname.startsWith(url);
	};

	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<AppSidebarHeader />
				<SearchForm />
			</SidebarHeader>
			<SidebarContent className="gap-0">
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{topLevelNav.map((item) => (
								<SidebarMenuItem key={item.url}>
									<SidebarMenuButton asChild isActive={isActive(item.url)}>
										<a href={item.url}>
											<item.icon className="size-4" />
											{i18n._(item.title)}
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{sections.map((section) => (
					<Collapsible
						key={section.title.id}
						title={i18n._(section.title)}
						defaultOpen
						className="group/collapsible"
					>
						<SidebarGroup>
							<SidebarGroupLabel
								asChild
								className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
							>
								<CollapsibleTrigger>
									{i18n._(section.title)}
									<LuChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
								</CollapsibleTrigger>
							</SidebarGroupLabel>
							<CollapsibleContent>
								<SidebarGroupContent>
									<SidebarMenu>
										{section.items.map((item) => (
											<SidebarMenuItem key={item.url}>
												<SidebarMenuButton
													asChild
													isActive={isActive(item.url)}
												>
													<a href={item.url}>
														{item.icon && <item.icon className="size-4" />}
														{i18n._(item.title)}
													</a>
												</SidebarMenuButton>
											</SidebarMenuItem>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</CollapsibleContent>
						</SidebarGroup>
					</Collapsible>
				))}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/components/AppSidebar/components/AppSidebarHeader/AppSidebarHeader.tsx`
```
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@superset/ui/sidebar";
import Image from "next/image";

export function AppSidebarHeader() {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg" asChild>
					<a href="/">
						<Image
							src="/icon.png"
							alt="Superset"
							width={32}
							height={32}
							className="size-8 rounded-lg"
						/>
						<div className="flex flex-col gap-0.5 leading-none">
							<span className="font-medium">Superset</span>
						</div>
					</a>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/components/AppSidebar/components/AppSidebarHeader/index.ts`
```
export { AppSidebarHeader } from "./AppSidebarHeader";

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7758** (2026-09-23): **Every workspace crashes with workspacePages.map is not a function**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.2  ### What happened?  Superset 1.30.2: opening any workspace crashes in `selectMenuPages.ts:43`, called by `WorkspacePagesMenu.tsx:66`. `workspacePages` contains `{ items: [], nextCursor: null }`, but the selector calls `workspacePages.map(...)`, expecting an array.  The stack trace:  ``` Content route error caught: TypeError: workspacePages.map is not a function     at selectMenuPages (selectMenuPages.ts:43:4)     at WorkspacePagesMenu.tsx:66:4     at Object.useMemo (react-dom-client.production.js:5518:23)     at react_production.useMemo (react.production.js:514:33)     at WorkspacePagesMenu (WorkspacePagesMenu.tsx:64:40) ```  ### Steps to reproduce  1. Open workspace 2. See failure  ### Logs, screenshots, or recordings  <img width="1359" height="322" alt="Image" src="https://github.com/user-attachments/assets/ba96c739-3a9e-422e-9701-c523b4df4ebc" />
  **Post-Mortem & Fix Analysis**:
  > This looks like the server-side regression that the latest commit on `main` already fixes: 4c56a68, "fix(pages): restore page.list's bare-array contract for released clients (#7756)". Nothing needs to change in the desktop app. Once the API with that commit is deployed, 1.30.2 should stop crashing.  ## Summary  Opening any workspace in desktop 1.30.2 crashes with `TypeError: workspacePages.map is not a function` in `selectMenuPages`. The value passed in is `{ items: [], nextCursor: null }`, which is a paginated response, but the 1.30.2 code expects a plain array. The cloud API's `page.list` procedure was changed to return `{ items, nextCursor }`, and released clients still call `page.list` expecting the plain array it used to return. A client that has already shipped can't be updated from the server side, so every workspace view that renders `WorkspacePagesMenu` hits the error and the route's error screen replaces the content.  ## Affected code  **Server (cloud tRPC API):** - `packages
  > This now should be resolved if you `cmd+R`, apologies for the issue! 

- **Issue #7757** (2026-09-23): **Bug: View crashes with "workspacePages.map is not a function" when opening workspace**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.2 (1.30.2)  ### What happened?  Navigating to or selecting a workspace triggers a crash caught by the error boundary, rendering the main view unusable. The error message displayed is ``` This view hit an error workspacePages.map is not a function ```   ### Steps to reproduce  ### Steps to reproduce* 1. Open Superset desktop client v1.30.2 on macOS[cite: 1]. 2. Click on any existing workspace from the sidebar list (e.g., selecting a workspace item)[cite: 1]. 3. Observe the center view crashing into the error boundary displaying `workspacePages.map is not a function`.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > The cause looks like a server API change that broke released desktop builds, not a bug in the current client code. It should already be fixed on `main` by #7756, the latest commit (`4c56a68`). I'm writing up the findings now.  ## Summary  In desktop v1.30.2 on macOS, opening or selecting any workspace crashes the center view into the error boundary with `workspacePages.map is not a function`. The code points to a mismatch between the tRPC API and older released clients. The `page.list` procedure used to return a bare array of pages. A pagination change made it return `{ items, nextCursor }` instead. v1.30.2 still calls `page.list` and runs `.map(...)` on the result, and `.map` doesn't exist on that object. The call happens in the workspace header's Pages menu, which mounts on every workspace view, so every workspace crashes.  This is inferred from reading the code. I couldn't run anything, and I don't have the v1.30.2 source to confirm its exact call site.  ## Affected code  - **Server
  > Just got the error too :( 
  > Same crash issue in v1.30.1

- **Issue #7755** (2026-09-23): **workspaces stopped working**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.2  ### What happened?  workspaces stopped working - hitting "workspacePages.map is not a function" when opening any workspace   any idea why? :)  ### Steps to reproduce  1. Open any workspace  ### Logs, screenshots, or recordings  <img width="698" height="439" alt="Image" src="https://github.com/user-attachments/assets/94d48c00-7f68-4d58-857b-8ee92032d2da" />
  **Post-Mortem & Fix Analysis**:
  > **Summary**  On desktop v1.30.2 (macOS), opening any workspace crashes with `workspacePages.map is not a function`. The most likely cause is a mismatch between the installed desktop app and the cloud API. The latest commit on `main`, 03af397 ("perf(pages): paginate page.list…", #7726), changed what the `page.list` tRPC procedure returns: it used to return an array of pages and now returns an object, `{ items, nextCursor }`. Older desktop builds still treat the response as an array. The crash happens in the workspace header's Pages menu, which renders whenever a workspace opens, so every workspace is affected.  **Affected code**  - Server: `packages/trpc/src/router/page/page.ts:296-455`. `page.list` now ends with `return { items, nextCursor };` (`page.ts:454`). - Desktop code on `main`, already updated for the new shape:   - `apps/desktop/src/renderer/routes/_authenticated/_dashboard/hooks/usePagesList/usePagesList.ts:17-60` uses `useInfiniteQuery`, reads `lastPage.nextCursor`, and buil
  > +1 cannot use the app right now
  > It's back

- **Issue #7706** (2026-09-25): **Long session names overflow outside the session hover card**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.0  ### What happened?  When hovering over a session with a very long name, the session name overflows the hover card instead of staying within its bounds. The text extends into the surrounding UI and can overlap other elements.  ### Steps to reproduce  1. Create or open a session with a very long name. 2. Hover over the session. 3. Observe the session name in the hover card. 4. The text extends beyond the card boundaries.  ### Logs, screenshots, or recordings  <img width="732" height="179" alt="Long session name overflowing outside the hover card" src="https://github.com/user-attachments/assets/ef9f470a-b8dd-40d5-9dfa-731669a1e887" />  ### Expected behavior  The session name should remain within the hover card boundaries. For long names, the UI could either:  - Wrap the text onto multiple lines, or - Truncate it with an ellipsis (`...`).  ### Actual behavior  The session name is rendered on a single line and overflows outside the hover card, causing it to overlap with the surrounding UI.  ### Additional context  This appears to happen specifically with unusually long session names. Shorter names are displayed as expected.
  **Post-Mortem & Fix Analysis**:
  > ## Summary  Hovering a session opens the sidebar hover card, and a long session name rendered at the top of that card is not constrained in any way — no wrapping, no clamping, no overflow hiding — so a name that can't fit the card's fixed 288px width spills out past the card's border and paints over whatever is behind it. Everything else in the card (branch, PR title, linked task) *is* constrained, which is why only the name misbehaves. The report is plausible and I believe I've found the exact line.  ## Affected code  The session rows in the Sessions section render `DashboardSidebarWorkspaceItem` (`DashboardSidebarSessionsSection.tsx:67`, and via `DashboardSidebarExpandedProjectContent` for the expanded list), which feeds the hover payload into the shared overlay:  - `apps/desktop/src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarHoverCardOverlay/DashboardSidebarHoverCardOverlay.tsx:79-96` — one `PopoverContent className="w-72"` rende

- **Issue #7417** (2026-09-19): **Sidebar workspace loading indicator does not appear when Codex is processing**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When Claude Code is actively processing a prompt, a loading/spinner icon appears next to the workspace name in the workspace list (sidebar) to indicate that it is in progress (WIP state).  However, when Codex is processing a task in a workspace, no loading indicator is shown next to the workspace name. It looks as if nothing is running until the generation finishes.  **Expected behavior**  The loading/WIP icon next to the workspace name should appear when Codex is running, consistent with Claude Code.  ### Steps to reproduce  1. Open a workspace configured with Codex. 2. Submit a prompt or task for Codex to process. 3. Observe the workspace item/name in the sidebar/workspace list while it is processing. 4. Notice that no loading indicator appears next to the workspace name (unlike with Claude Code, which displays a WIP spinner).  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Summary  The sidebar "WIP" spinner is not agent-aware anywhere in the UI — it renders iff the workspace's aggregated status is `"working"`, which is a pure function of the host-side terminal-agent binding's `lastEventType === "Start"`. So a missing Codex spinner is not a rendering bug; it means no `Start` event is live on the binding for that terminal while Codex works. Comparing Claude's and Codex's registered hook sets shows a real asymmetry that explains this: Claude re-asserts `Start` on **every tool call**, while Codex emits `Start` essentially **once per turn** (at prompt submit) — so for Codex, a single lost or overwritten `Start` blanks the indicator for the whole turn with nothing to self-heal it.  ## Affected code  The UI path (agent-agnostic, ruled out as the cause):  - `apps/desktop/src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarWorkspaceIcon/DashboardSidebarWorkspaceIcon.tsx:1

- **Issue #7416** (2026-09-19): **Commits list remains stale after switching agents and creating new commits**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When working across multiple agents, new commits made by an agent are not reflected in the commits list after switching to or continuing the session with another agent. The commits view continues to display a stale commit history instead of automatically refreshing or syncing with the latest repository state.  Expected behavior: The commit history should refresh automatically or reflect the latest HEAD/commits whenever an agent creates new commits, even when continuing across different agents.  ### Steps to reproduce  1. Open a workspace and start a session with an agent. 2. Have the agent create one or more commits (or let another agent make new commits on the branch). 3. Continue the workflow with another agent via the "Continue with another agent" option 4. Make additional commits using the new agent. 5. Inspect the commits list in the UI. 6. Observe that the list remains stale and does not show the newly created commits.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Summary  The report is plausible and I can point at a concrete gap in the desktop renderer. New commits made *outside* the app's own commit button — i.e. by an agent in a terminal, which is exactly what the "have the agent commit / continue with another agent / commit again" flow does — do refresh the changed-files list and status badge, but not the commits list. The server side is fine (`git.listCommits` shells out to `git log` on every call with no caching), and the host-side `git:changed` event does fire on an agent commit. The renderer just never invalidates the `git.listCommits` query when that event arrives, so the cached commit list sits there until something unrelated happens to refetch it. Switching agents is incidental to the cause — it's a reliable way to generate commits from outside the UI while the app window never loses focus.  ## Affected code  - `apps/desktop/src/renderer/hooks/host-service/useGitStatus/useGitStatus.ts:65-87` — the single owner of the `git:changed` 

- **Issue #7415** (2026-09-11): **Language setting reverts to OS default after reload (CMD+R)**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When the application language is manually set to English, reloading the app via the CMD+R shortcut causes it to forget this preference. The UI reverts to the operating system's default language instead of remaining in English. The language setting should persist across app reloads.  ### Steps to reproduce  1. Open the app and change the language setting to English. 2. Press CMD+R to reload the application. 3. Observe that the application language has reverted to the OS default language.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Summary  The report is that an explicit **Language = English** choice survives in the running app but is gone after `CMD+R`, with the UI falling back to the macOS system language. I could not find a code path that *deletes* the stored setting, and the local persistence itself looks sound (`settings.language` column, written by `setLanguage`, read by `getLanguage`). What I did find is that the renderer has exactly **one** way to end up in the OS language, and it is reached whenever the `getLanguage` IPC query yields no data *without* being pending — most plausibly an errored query right after `webContents.reload()`. A cold start can't hit it (the main process resolves the locale itself), which matches the report being specific to `CMD+R`.  ## Affected code  - `apps/desktop/src/renderer/components/LanguageAwareI18nProvider/LanguageAwareI18nProvider.tsx:12-20` — the only locale source for the renderer. - `packages/i18n/src/react.tsx:57-71` — `initI18nAsync(locale ?? inferLocale())`. - 

- **Issue #7414** (2026-09-11): **Language setting reverts to OS default after reload (CMD+R)**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When the application language is manually set to English, reloading the app via the CMD+R shortcut causes it to forget this preference. The UI reverts to the operating system's default language instead of remaining in English. The language setting should persist across app reloads.  ### Steps to reproduce  1. Open the app and change the language setting to English. 2. Press CMD+R to reload the application. 3. Observe that the application language has reverted to the OS default language.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report — here's what I found reading the code.  ## Summary  The app's display language lives in one place: the `settings.language` column of the desktop's local SQLite DB (`packages/local-db/src/schema/schema.ts:206`). Choosing a language and *reading it back* are two different code paths: the choice is pushed to the live renderer in memory, while a page load has to re-read it from the DB. A CMD+R reload is the first moment that read-back path runs, which is exactly why the setting looks like it applied and then "forgets" itself. So the reported behaviour is plausible, and the loss is in the read-back, not in the picker.  ## Affected code  - `apps/desktop/src/renderer/components/LanguageAwareI18nProvider/LanguageAwareI18nProvider.tsx:12-20` — the renderer gate that turns the stored setting into an active locale on every page load. - `apps/desktop/src/lib/trpc/routers/settings/index.ts:623-666` — `getLanguage` / `onLanguageChange` / `setLanguage`, plus `getSettings()` at 

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

### Incident Patch 1: `eeffa0ba` (2026-09-30)
**Commit Message**: fix(marketing): unbreak the vale job on the privacy policy scopes list (#7987)

The Google user data section added in #7966 separated each scope from its
purpose with an em dash. Superset.EmDash is an error-level rule over
apps/marketing/content, so the Vale prose lint job has failed on every
main commit since. Use the colon the rule message suggests.

Verified with vale 3.17.1, the version CI pins: `bun run lint:prose` in
apps/marketing reported 6 Superset.EmDash errors at privacy.mdx:72-77
before, and 0 errors after.

**File**: `apps/marketing/content/legal/privacy.mdx` (modified, +6/-6)
```diff
@@ -69,12 +69,12 @@ Connecting a Google Account is optional and separate from signing in. You connec
 
 We request these Google API scopes, and we use each one only for the purpose listed:
 
-- `openid`, `email` — identify which Google Account you connected, and show its address in Superset.
-- `gmail.readonly` — read message headers and labels, so an automation can start when new mail arrives, and read the messages and attachments you ask an agent to open.
-- `gmail.compose`, `gmail.modify` — create and send drafts, and change labels or read state, when you ask an agent to.
-- `gmail.labels` — create, rename, and delete Gmail labels at your request.
-- `gmail.settings.basic` — read and manage the Gmail filters you ask an agent to set up.
-- `https://mail.google.com/` — Google grants some mailbox operations only under full mail access, including permanently deleting a message or a thread.
+- `openid`, `email`: identify which Google Account you connected, and show its address in Superset.
+- `gmail.readonly`: read message headers and labels, so an automation can start when new mail arrives, and read the messages and attachments you ask an agent to open.
+- `gmail.compose`, `gmail.modify`: create and send drafts, and change labels or read state, when you ask an agent to.
+- `gmail.labels`: create, rename, and delete Gmail labels at your request.
+- `gmail.settings.basic`: read and manage the Gmail filters you ask an agent to set up.
+- `https://mail.google.com/`: Google grants some mailbox operations only under full mail access, including permanently deleting a message or a thread.
 
 Our Google consent screen also requests read-only Calendar access (`calendar.readonly`). Superset does not read your calendar, and we will update this policy before any feature does.
 
```

---

### Incident Patch 2: `b051a9a0` (2026-09-30)
**Commit Message**: fix(desktop): color the cloud row's unread dot from the theme's success token (#7988)

The finished-agent dot was foreground/85, which reads as black in light
themes. It now uses bg-success, so each theme picks its own green, and
it is 6px to match the local rows' status dot. The pulsing needs-input
dot shrinks to 6px too so both stay the same size.

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/components/CloudWorkspaceStatus/CloudWorkspaceStatus.tsx` (modified, +3/-3)
```diff
@@ -56,10 +56,10 @@ export function CloudWorkspaceStatus({
 				<span
 					role="img"
 					aria-label={t({ message: "Waiting for your input" })}
-					className="relative flex size-2"
+					className="relative flex size-1.5"
 				>
 					<span className="absolute inset-0 animate-ping rounded-full bg-yellow-400 opacity-75" />
-					<span className="relative size-2 rounded-full bg-yellow-500" />
+					<span className="relative size-1.5 rounded-full bg-yellow-500" />
 				</span>
 			);
 		case "failed":
@@ -86,7 +86,7 @@ export function CloudWorkspaceStatus({
 					<span
 						role="img"
 						aria-label={t({ message: "Agent finished" })}
-						className="size-2 rounded-full bg-foreground/85"
+						className="size-1.5 rounded-full bg-success"
 					/>
 				);
 			}
```

---

### Incident Patch 3: `5c35f6c5` (2026-09-30)
**Commit Message**: feat(desktop,host-service): keep a local resource journal for debugging slow or leaking hosts (#7990)

A user's host-service slowed over ~2.5 hours until the relay timed out, and a
restart fixed it. Nothing on the machine recorded memory or event-loop state,
so the cause could not be found afterwards.

- Desktop writes one JSON line a minute to ~/.superset/resources.jsonl:
  system memory and macOS pressure/swap; desktop main (with JS heap),
  renderers tagged window/browser-pane, helpers; each host-service and each
  pty-daemon (with its terminals' process count, memory and heaviest
  processes); the 10 heaviest other processes. 20 MB cap plus one rotated copy.
- Host-service logs a [host-service:vitals] line a minute to host-service.log:
  memory (rss/heap/external/arrayBuffers), event-loop delay and busy share,
  and active handles by type.
- Rotating logs move to .1 instead of being truncated, so a restart no longer
  wipes the history before it.

Both samplers are local-only, catch their own errors, and use unref'd timers.

**File**: `apps/desktop/src/main/host-service/index.ts` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@ import {
 	PskHostAuthProvider,
 	resolveBrowserBridgeFromEnv,
 	startTerminalReaper,
+	startVitalsLog,
 } from "@superset/host-service";
 import {
 	initTerminalBaseEnv,
@@ -131,6 +132,7 @@ async function main(): Promise<void> {
 
 			// Orphan reaping + port detection for terminals no renderer has attached.
 			startTerminalReaper(db);
+			startVitalsLog();
 
 			if (env.ORGANIZATION_ID) {
 				const manifest: HostServiceManifest = {
```

**File**: `apps/desktop/src/main/index.ts` (modified, +2/-0)
```diff
@@ -51,6 +51,7 @@ import { syncInstalledPluginMcpServers } from "./lib/plugin-installs";
 import { portForwardManager } from "./lib/port-forward";
 import { ensureProjectIconsDir, getProjectIconPath } from "./lib/project-icons";
 import { runQuitCleanup } from "./lib/quit-sequence";
+import { startResourceJournal } from "./lib/resource-metrics/resource-journal";
 import { initSentry } from "./lib/sentry";
 import {
 	prewarmTerminalRuntime,
@@ -617,6 +618,7 @@ if (!gotTheLock) {
 		);
 		setupAutoUpdater();
 		initTray();
+		startResourceJournal();
 
 		const coldStartUrl = findDeepLinkInArgv(process.argv);
 		if (coldStartUrl) {
```

**File**: `apps/desktop/src/main/lib/resource-metrics/process-tree.ts` (modified, +9/-3)
```diff
@@ -1,5 +1,6 @@
 import { exec } from "node:child_process";
 import os from "node:os";
+import path from "node:path";
 import { promisify } from "node:util";
 
 let nativeMetrics: typeof import("@superset/macos-process-metrics") | null =
@@ -22,6 +23,8 @@ export interface ProcessInfo {
 	cpu: number;
 	/** Resident memory in bytes. */
 	memory: number;
+	/** Executable name, without its directory. */
+	name?: string;
 }
 
 export interface ProcessSnapshot {
@@ -152,8 +155,8 @@ export function enrichWithPhysFootprint(
 
 async function listProcessesUnix(): Promise<ProcessInfo[]> {
 	try {
-		// Single call: PID, parent PID, %CPU, RSS (KB).
-		const { stdout } = await execAsync("ps -eo pid=,ppid=,pcpu=,rss=", {
+		// Single call: PID, parent PID, %CPU, RSS (KB), executable path.
+		const { stdout } = await execAsync("ps -eo pid=,ppid=,pcpu=,rss=,comm=", {
 			maxBuffer: MAX_BUFFER,
 			timeout: EXEC_TIMEOUT_MS,
 		});
@@ -172,12 +175,14 @@ async function listProcessesUnix(): Promise<ProcessInfo[]> {
 
 			const cpu = Number.parseFloat(parts[2]);
 			const rssKb = Number.parseInt(parts[3], 10);
+			const executable = parts.slice(4).join(" ");
 
 			result.push({
 				pid,
 				ppid,
 				cpu: Number.isFinite(cpu) ? Math.max(0, cpu) : 0,
 				memory: Number.isFinite(rssKb) ? Math.max(0, rssKb) * 1024 : 0,
+				name: executable ? path.basename(executable) : undefined,
 			});
 		}
 
@@ -190,7 +195,7 @@ async function listProcessesUnix(): Promise<ProcessInfo[]> {
 async function listProcessesWindows(): Promise<ProcessInfo[]> {
 	try {
 		const { stdout } = await execAsync(
-			'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Csv -NoTypeInformation"',
+			'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize,Name | ConvertTo-Csv -NoTypeInformation"',
 			{ maxBuffer: MAX_BUFFER, timeout: EXEC_TIMEOUT_MS },
 		);
 
@@ -213,6 +218,7 @@ async function listProcessesWindows(): Promise<ProcessInfo[]> {
 				ppid,
 				cpu: 0, // Windows CPU% needs delta sampling; enriched separately.
 				memory: Number.isFinite(ws) ? Math.max(0, ws) : 0,
+				name: parts.slice(3).join(",") || undefined,
 			});
 		}
 
```

**File**: `apps/desktop/src/main/lib/resource-metrics/resource-journal.ts` (added, +296/-0)
```diff
@@ -0,0 +1,296 @@
+import { exec } from "node:child_process";
+import { appendFile, readdir, readFile } from "node:fs/promises";
+import os from "node:os";
+import path from "node:path";
+import { promisify } from "node:util";
+import { listPtyDaemonManifests } from "@superset/host-service/daemon-manifest";
+import { rotateLogIfOversized } from "@superset/shared/rotating-log";
+import { app, webContents } from "electron";
+import { SUPERSET_HOME_DIR } from "../app-environment";
+import { readManifest } from "../host-service-manifest";
+import {
+	captureProcessSnapshot,
+	enrichWithPhysFootprint,
+	getSubtreePids,
+	type ProcessSnapshot,
+} from "./process-tree";
+
+const JOURNAL_PATH = path.join(SUPERSET_HOME_DIR, "resources.jsonl");
+const MAX_JOURNAL_BYTES = 20 * 1024 * 1024;
+const SAMPLE_INTERVAL_MS = 60_000;
+const OTHER_PROCESS_COUNT = 10;
+// phys_footprint can reorder processes whose RSS is close, so measure a
+// wider set than the one recorded.
+const FOOTPRINT_CANDIDATE_COUNT = 40;
+const BYTES_PER_MB = 1024 * 1024;
+
+const execAsync = promisify(exec);
+
+interface MemoryPressure {
+	level?: "normal" | "warn" | "critical";
+	availableMb?: number;
+	swapUsedMb?: number;
+	swapTotalMb?: number;
+}
+
+function toMb(bytes: number): number {
+	return Math.round(bytes / BYTES_PER_MB);
+}
+
+const MACOS_PRESSURE_LEVELS: Record<string, MemoryPressure["level"]> = {
+	"1": "normal",
+	"2": "warn",
+	"4": "critical",
+};
+
+async function readMacosPressure(): Promise<MemoryPressure> {
+	const { stdout } = await execAsync(
+		"sysctl -n kern.memorystatus_vm_pressure_level vm.swapusage",
+		{ timeout: 5_000 },
+	);
+	const [levelLine = "", swapLine = ""] = stdout.trim().split("\n");
+	const swapTotal = swapLine.match(/total = ([\d.]+)M/)?.[1];
+	const swapUsed = swapLine.match(/used = ([\d.]+)M/)?.[1];
+	return {
+		level: MACOS_PRESSURE_LEVELS[levelLine.trim()],
+		swapTotalMb: swapTotal ? Math.round(Number(swapTotal)) : undefined,
+		swapUsedMb: swapUsed ? Math.round(Number(swapUsed)) : undefined,
+	};
+}
+
+async function readLinuxPressure(): Promise<MemoryPressure> {
+	const meminfo = await readFile("/proc/meminfo", "utf-8");
+	const kb = (field: string): number | undefined => {
+		const value = meminfo.match(
+			new RegExp(`^${field}:\\s+(\\d+) kB`, "m"),
+		)?.[1];
+		return value ? Number(value) : undefined;
+	};
+	const available = kb("MemAvailable");
+	const swapTotal = kb("SwapTotal");
+	const swapFree = kb("SwapFree");
+	return {
+		availableMb:
+			available === undefined ? undefined : Math.round(available / 1024),
+		swapTotalMb:
+			swapTotal === undefined ? undefined : Math.round(swapTotal / 1024),
+		swapUsedMb:
+			swapTotal === undefined || swapFree === undefined
+				? undefined
+				: Math.round((swapTotal - swapFree) / 1024),
+	};
+}
+
+async function readMemoryPressure(): Promise<MemoryPressure> {
+	try {
+		if (process.platform === "darwin") return await readMacosPressure();
+		if (process.platform === "linux") return await readLinuxPressure();
+		return {};
+	} catch {
+		return {};
+	}
+}
+
+interface ProcessEntry {
+	pid: number;
+	name?: string;
+	memoryMb: number;
+	cpu: number;
+}
+
+function describe(snapshot: ProcessSnapshot, pid: number): ProcessEntry {
+	const info = snapshot.byPid.get(pid);
+	return {
+		pid,
+		name: info?.name,
+		memoryMb: toMb(info?.memory ?? 0),
+		cpu: Math.round(info?.cpu ?? 0),
+	};
+}
+
+function heaviest(
+	snapshot: ProcessSnapshot,
+	pids: number[],
+	count: number,
+): ProcessEntry[] {
+	return pids
+		.map((pid) => describe(snapshot, pid))
+		.sort((a, b) => b.memoryMb - a.memoryMb)
+		.slice(0, count);
+}
+
+function sumMb(snapshot: ProcessSnapshot, pids: number[]): number {
+	return toMb(
+		pids.reduce(
+			(total, pid) => total + (snapshot.byPid.get(pid)?.memory ?? 0),
+			0,
+		),
+	);
+}
+
+const RENDERER_KIND_BY_WEB_CONTENTS_TYPE: Record<string, string> = {
+	window: "window",
+	webview: "browser-pane",
+	browserView: "browser-pane",
+};
+
+function webCo
```

**File**: `packages/host-service/src/index.ts` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ export type { HostAuthProvider } from "./providers/host-auth";
 export { PskHostAuthProvider } from "./providers/host-auth";
 export { resolveBrowserBridgeFromEnv } from "./runtime/browser-bridge/env";
 export type { GitCredentialProvider, GitFactory } from "./runtime/git";
+export { startVitalsLog } from "./runtime/vitals";
 export { detachFromLaunchDirectory } from "./runtime/working-directory";
 export { installProcessSafetyNet, installUpgradeSocketGuard } from "./safety";
 export { captureFatalStartupError, initSentry } from "./sentry";
```

---

### Incident Patch 4: `61300428` (2026-09-30)
**Commit Message**: fix(workspace-fs): allow saving files outside the workspace root (#7982)

The editor can open any file on the host since #7897, but saving one outside
the workspace root (or through an in-root symlink that resolves outside) threw
"Path is outside workspace root". writeFile now follows the read policy: the
same caller can already read any file and run any command in a terminal, so
confining edits was not a real boundary. Create, delete, move and copy stay
confined to the root.

**File**: `packages/host-service/test/integration/bug-hunt-2.integration.test.ts` (modified, +10/-11)
```diff
@@ -8,6 +8,7 @@ import { randomUUID } from "node:crypto";
 import {
 	existsSync,
 	mkdirSync,
+	readFileSync,
 	rmSync,
 	symlinkSync,
 	writeFileSync,
@@ -69,19 +70,17 @@ describe("bug-hunt-2: symlink and additional sandbox probes", () => {
 		).resolves.toMatchObject({ kind: "text", content: "PII" });
 	});
 
-	test("writeFile through a symlinked dir into outside the workspace is rejected", async () => {
-		const link = join(repo.repoPath, "evil-link");
+	test("writeFile writes through a symlinked dir that points outside the workspace", async () => {
+		const link = join(repo.repoPath, "external-link");
 		symlinkSync(outsideDir, link);
 
-		await expect(
-			host.trpc.filesystem.writeFile.mutate({
-				workspaceId,
-				absolutePath: join(link, "planted.txt"),
-				content: "should-not-write",
-				options: { create: true, overwrite: true },
-			}),
-		).rejects.toThrow();
-		expect(existsSync(join(outsideDir, "planted.txt"))).toBe(false);
+		await host.trpc.filesystem.writeFile.mutate({
+			workspaceId,
+			absolutePath: join(link, "edited.txt"),
+			content: "edited",
+			options: { create: true, overwrite: true },
+		});
+		expect(readFileSync(join(outsideDir, "edited.txt"), "utf8")).toBe("edited");
 	});
 
 	test("createDirectory rejects '..' traversal", async () => {
```

**File**: `packages/host-service/test/integration/bug-hunt.integration.test.ts` (modified, +19/-16)
```diff
@@ -4,10 +4,10 @@
  * bug worth fixing.
  *
  * The filesystem section also pins the intended sandbox policy in both
- * directions: reads are host-wide (viewing files a terminal/agent referenced
- * outside the workspace), mutations are confined to the workspace root. An
- * "allows" test failing means the read policy regressed, not that a defense
- * appeared.
+ * directions: reads and file edits are host-wide (files a terminal/agent
+ * referenced outside the workspace), structural mutations are confined to the
+ * workspace root. An "allows"/"edits" test failing means that policy
+ * regressed, not that a defense appeared.
  *
  * Categories:
  *   - sandbox / path traversal in workspace-fs operations
@@ -22,6 +22,7 @@ import { randomUUID } from "node:crypto";
 import {
 	existsSync,
 	mkdirSync,
+	readFileSync,
 	rmSync,
 	symlinkSync,
 	writeFileSync,
@@ -33,7 +34,7 @@ import { projects, workspaces } from "../../src/db/schema";
 import { createTestHost, type TestHost } from "../helpers/createTestHost";
 import { createGitFixture, type GitFixture } from "../helpers/git-fixture";
 
-describe("bug-hunt: filesystem sandbox (mutations confined, reads host-wide)", () => {
+describe("bug-hunt: filesystem sandbox (structural mutations confined, reads and edits host-wide)", () => {
 	let host: TestHost;
 	let repo: GitFixture;
 	const projectId = randomUUID();
@@ -62,18 +63,20 @@ describe("bug-hunt: filesystem sandbox (mutations confined, reads host-wide)", (
 		repo.dispose();
 	});
 
-	test("writeFile rejects '..' traversal escaping the workspace root", async () => {
-		const escapeWritePath = `${repo.repoPath}/../escape.txt`;
-		await expect(
-			host.trpc.filesystem.writeFile.mutate({
+	test("writeFile edits paths outside the workspace root", async () => {
+		const sibling = join(repo.repoPath, "..", `outside-write-${randomUUID()}`);
+		writeFileSync(sibling, "before");
+		try {
+			await host.trpc.filesystem.writeFile.mutate({
 				workspaceId,
-				absolutePath: escapeWritePath,
-				content: "should not exist",
-				options: { create: true, overwrite: true },
-			}),
-		).rejects.toThrow();
-		// Sibling of repoPath must not have been written.
-		expect(existsSync(escapeWritePath)).toBe(false);
+				absolutePath: sibling,
+				content: "after",
+				options: { create: false, overwrite: true },
+			});
+			expect(readFileSync(sibling, "utf8")).toBe("after");
+		} finally {
+			rmSync(sibling, { force: true });
+		}
 	});
 
 	test("readFile allows viewing paths outside the workspace root", async () => {
```

**File**: `packages/workspace-fs/src/fs.test.ts` (modified, +15/-26)
```diff
@@ -188,18 +188,15 @@ describe("readFile", () => {
 });
 
 describe("writeFile", () => {
-	it("rejects paths outside the workspace root", async () => {
-		const rootPath = await createTempRoot();
+	it("writes files outside the workspace root", async () => {
 		const outsideRoot = await createTempRoot();
-		const absolutePath = path.join(outsideRoot, "escape.txt");
+		const absolutePath = path.join(outsideRoot, "outside.txt");
+		await fs.writeFile(absolutePath, "before");
 
-		await expect(
-			writeFile({
-				rootPath,
-				absolutePath,
-				content: "should not exist",
-			}),
-		).rejects.toThrow("outside workspace root");
+		const result = await writeFile({ absolutePath, content: "after" });
+
+		expect(result.ok).toEqual(true);
+		expect(await fs.readFile(absolutePath, "utf-8")).toEqual("after");
 	});
 
 	it("returns a conflict when revision does not match", async () => {
@@ -208,7 +205,6 @@ describe("writeFile", () => {
 		await fs.writeFile(absolutePath, "current");
 
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: "next",
 			precondition: { ifMatch: "stale-revision" },
@@ -233,7 +229,6 @@ describe("writeFile", () => {
 		});
 
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: "updated",
 			precondition: { ifMatch: readResult.revision },
@@ -249,7 +244,6 @@ describe("writeFile", () => {
 		await fs.writeFile(absolutePath, "content");
 
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: "new content",
 			options: { create: true, overwrite: false },
@@ -266,7 +260,6 @@ describe("writeFile", () => {
 		const absolutePath = path.join(rootPath, "missing.txt");
 
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: "content",
 			options: { create: false, overwrite: true },
@@ -292,13 +285,11 @@ describe("writeFile", () => {
 
 		const [firstResult, secondResult] = await Promise.all([
 			writeFile({
-				rootPath,
 				absolutePath,
 				content: "first",
 				precondition: { ifMatch: revision },
 			}),
 			writeFile({
-				rootPath,
 				absolutePath,
 				content: "second",
 				precondition: { ifMatch: revision },
@@ -321,7 +312,6 @@ describe("writeFile", () => {
 		await fs.symlink(realPath, absolutePath);
 
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: "after",
 		});
@@ -345,7 +335,6 @@ describe("writeFile", () => {
 			encoding: "utf-8",
 		});
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: "after",
 			precondition: { ifMatch: readResult.revision },
@@ -356,26 +345,26 @@ describe("writeFile", () => {
 		expect(await fs.readFile(realPath, "utf-8")).toEqual("after");
 	});
 
-	it("still refuses a symlink that escapes the workspace root", async () => {
+	it("writes through an in-root symlink that resolves outside the root", async () => {
 		const rootPath = await createTempRoot();
 		const outsideRoot = await createTempRoot();
-		const outsidePath = path.join(outsideRoot, "secret.txt");
-		await fs.writeFile(outsidePath, "secret");
+		const outsidePath = path.join(outsideRoot, "target.txt");
+		await fs.writeFile(outsidePath, "before");
 		const absolutePath = path.join(rootPath, "link.txt");
 		await fs.symlink(outsidePath, absolutePath);
 
-		await expect(
-			writeFile({ rootPath, absolutePath, content: "leaked" }),
-		).rejects.toThrow("outside workspace root");
-		expect(await fs.readFile(outsidePath, "utf-8")).toEqual("secret");
+		const result = await writeFile({ absolutePath, content: "after" });
+
+		expect(result.ok).toEqual(true);
+		expect((await fs.lstat(absolutePath)).isSymbolicLink()).toEqual(true);
+		expect(await fs.readFile(outsidePath, "utf-8")).toEqual("after");
 	});
 
 	it("writes Uint8Array content", async () => {
 		const rootPath = await createTempRoot();
 		const absolutePath = path.join(rootPath, "binary.bin");
 
 		const result = await writeFile({
-			rootPath,
 			absolutePath,
 			content: new Ui
```

**File**: `packages/workspace-fs/src/fs.ts` (modified, +6/-13)
```diff
@@ -346,19 +346,16 @@ async function resolveWriteTarget(absolutePath: string): Promise<string> {
 }
 
 async function writeAtomically({
-	rootPath,
 	absolutePath,
 	content,
 	encoding,
 }: {
-	rootPath: string;
 	absolutePath: string;
 	content: string | Uint8Array;
 	encoding?: string;
 }): Promise<void> {
 	const targetPath = await resolveWriteTarget(absolutePath);
 	const tempPath = `${targetPath}.superset-tmp-${randomUUID()}`;
-	await assertParentWithinRoot(rootPath, tempPath);
 
 	let sourceMode: number | undefined;
 	try {
@@ -388,11 +385,11 @@ async function writeAtomically({
 // per-entry stat calls bounds how much zombie work continues after an abort.
 const LIST_DIRECTORY_STAT_BATCH_SIZE = 16;
 
-// Read-only operations (listDirectory, readFile, getMetadata) are not
-// confined to the workspace root: terminals and agents routinely reference
-// files anywhere on the host, and viewing them is within the caller's trust
-// model (statPath/browseHost already expose arbitrary host paths). Mutations
-// remain strictly confined to the root.
+// listDirectory, readFile, getMetadata and writeFile are not confined to the
+// workspace root: terminals and agents routinely reference files anywhere on
+// the host, and viewing or editing them is within the caller's trust model
+// (the same caller can run any command in a terminal). Structural mutations
+// (create, delete, move, copy) remain confined to the root.
 export async function listDirectory({
 	absolutePath,
 	signal,
@@ -536,22 +533,19 @@ export async function getMetadata({
 }
 
 export async function writeFile({
-	rootPath,
 	absolutePath,
 	content,
 	encoding,
 	options,
 	precondition,
 }: {
-	rootPath: string;
 	absolutePath: string;
 	content: string | Uint8Array;
 	encoding?: string;
 	options?: { create: boolean; overwrite: boolean };
 	precondition?: { ifMatch: string };
 }): Promise<FsWriteResult> {
-	const targetPath = ensureWithinRoot({ rootPath, absolutePath });
-	await assertRealpathWithinRoot(rootPath, targetPath);
+	const targetPath = normalizeAbsolutePath(absolutePath);
 
 	const create = options?.create ?? true;
 	const overwrite = options?.overwrite ?? true;
@@ -604,7 +598,6 @@ export async function writeFile({
 		}
 
 		await writeAtomically({
-			rootPath,
 			absolutePath: targetPath,
 			content,
 			encoding,
```

**File**: `packages/workspace-fs/src/host/service.ts` (modified, +0/-1)
```diff
@@ -200,7 +200,6 @@ export function createFsHostService(
 
 		async writeFile(input) {
 			return await writeFile({
-				rootPath,
 				absolutePath: input.absolutePath,
 				content: input.content,
 				encoding: input.encoding,
```

---

### Incident Patch 5: `ec1c0d5f` (2026-09-30)
**Commit Message**: fix(host-service): list an intent-to-add rename once in git status (#7980)

Rename detection copies the index, marks untracked files intent-to-add,
and diffs the whole worktree. It returned every rename in that diff,
including one git status had already reported for a file that is
intent-to-add in the real index. The Changes list then held the same
unstaged path twice, and the diff pane's CodeView threw on the duplicate
id. The pane is restored on launch and the git state is on disk, so the
workspace failed again on every launch.

Keep only renames onto the files the detection marked itself.

**File**: `packages/host-service/src/trpc/router/git/utils/git-helpers.ts` (modified, +5/-2)
```diff
@@ -377,7 +377,9 @@ export interface DetectedRename {
  * index to a temp file, marking untracked files intent-to-add against that
  * copy, and diffing. Real index is never mutated. Falls back to an empty
  * result on any error — caller still has the unrelated deleted+untracked
- * entries to display.
+ * entries to display. Only renames onto `untrackedPaths` are returned: the
+ * diff also repeats renames git status already reported for files that are
+ * intent-to-add in the real index.
  */
 export async function detectUnstagedRenames(
 	git: SimpleGit,
@@ -428,9 +430,10 @@ export async function detectUnstagedRenames(
 		const nameStatus = parseNameStatus(nameStatusRaw);
 		const numstat = parseNumstat(numstatRaw);
 
+		const markedPaths = new Set(untrackedPaths);
 		const result: DetectedRename[] = [];
 		for (const entry of nameStatus) {
-			if (!entry.oldPath) continue;
+			if (!entry.oldPath || !markedPaths.has(entry.path)) continue;
 			const code = entry.status[0];
 			if (code !== "R") continue;
 			const stats = numstat.get(entry.path) ?? {
```

**File**: `packages/host-service/src/trpc/router/git/utils/git-status.integration.test.ts` (modified, +25/-0)
```diff
@@ -210,6 +210,31 @@ describe("getGitStatusSnapshot (integration)", () => {
 		expect(untracked.every((file) => file.deletions === null)).toBe(true);
 	});
 
+	test("lists an intent-to-add rename once when rename detection also runs", async () => {
+		const body = Array.from({ length: 40 }, (_, i) => `line ${i}\n`).join("");
+		await writeFile(join(repo, "old.txt"), body);
+		await writeFile(join(repo, "other.txt"), "other\n");
+		await git.raw(["add", "--", "old.txt", "other.txt"]);
+		await git.raw(["commit", "-m", "add files"]);
+
+		rmSync(join(repo, "old.txt"));
+		await writeFile(join(repo, "new.txt"), `${body}edited\n`);
+		await git.raw(["add", "--intent-to-add", "--", "new.txt"]);
+		rmSync(join(repo, "other.txt"));
+		await writeFile(join(repo, "scratch.txt"), "notes\n");
+
+		const { snapshot } = await getGitStatusSnapshot({
+			git,
+			worktreePath: repo,
+		});
+
+		const paths = snapshot.unstaged.map((file) => file.path).sort();
+		expect(paths).toEqual(["new.txt", "other.txt", "scratch.txt"]);
+		expect(
+			snapshot.unstaged.find((file) => file.path === "new.txt"),
+		).toMatchObject({ status: "renamed", oldPath: "old.txt" });
+	});
+
 	test("keeps tracked-file statuses alongside untracked expansion", async () => {
 		await writeFile(join(repo, "README.md"), "hello\nworld\n");
 		await mkdir(join(repo, "newdir"), { recursive: true });
```

---

### Incident Patch 6: `64b26a90` (2026-09-30)
**Commit Message**: fix(desktop): line up the cloud row's PR button and status (#7981)

The right cluster used fixed 20px slots, ml-5, pr-4 and a -6.25px nudge on the
hover archive button. It now uses the local row's spacing (gap-1.5, pr-2, bare
14px icon) and a 24px right-aligned status column, so PR icons line up across
rows. The owner avatar drops from 20px to 18px.

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarCloudSection/components/DashboardSidebarCloudRow/DashboardSidebarCloudRow.tsx` (modified, +14/-18)
```diff
@@ -72,7 +72,7 @@ export const DashboardSidebarCloudRow = forwardRef<
 			<div
 				ref={ref}
 				className={cn(
-					"group relative mx-2 flex h-8 items-center rounded-md pr-4 pl-2 text-left text-sm transition-colors",
+					"group relative mx-2 flex h-8 items-center rounded-md pr-2 pl-2 text-left text-sm transition-colors",
 					highlighted
 						? "bg-fill-selected"
 						: "hover:bg-fill-hover has-[:focus-visible]:bg-fill-hover",
@@ -107,31 +107,27 @@ export const DashboardSidebarCloudRow = forwardRef<
 							people={[
 								{ id: owner.userId, name: owner.name, image: owner.image },
 							]}
-							size={20}
+							size={18}
 							surface="sidebar"
 							className="ml-1.5"
 						/>
 					)}
 				</span>
-				<span className="pointer-events-none relative ml-5 flex shrink-0 items-center [&_button]:pointer-events-auto">
+				<span className="pointer-events-none relative ml-1.5 flex shrink-0 items-center gap-1.5 [&_button]:pointer-events-auto">
 					{ports && (
-						<span className="flex w-5 justify-center">
-							<DashboardSidebarCloudPortsButton
-								count={ports.count}
-								card={ports.card}
-								onOpenChange={ports.onOpenChange}
-							/>
-						</span>
+						<DashboardSidebarCloudPortsButton
+							count={ports.count}
+							card={ports.card}
+							onOpenChange={ports.onOpenChange}
+						/>
 					)}
 					{pullRequest && (
-						<span className="flex w-5 justify-center">
-							<DashboardSidebarCloudPullRequestButton
-								pullRequest={pullRequest}
-								onClick={onOpenPullRequest}
-							/>
-						</span>
+						<DashboardSidebarCloudPullRequestButton
+							pullRequest={pullRequest}
+							onClick={onOpenPullRequest}
+						/>
 					)}
-					<span className="flex h-4 min-w-5 items-center justify-end">
+					<span className="flex h-4 w-6 items-center justify-end">
 						<span className="flex items-center group-hover:hidden group-has-[:focus-visible]:hidden">
 							<CloudWorkspaceStatus
 								workspace={workspace}
@@ -146,7 +142,7 @@ export const DashboardSidebarCloudRow = forwardRef<
 								onArchive();
 							}}
 							aria-label={t({ message: "Archive workspace" })}
-							className="-mr-[6.25px] hidden size-5 items-center justify-center rounded text-muted-foreground group-hover:flex group-has-[:focus-visible]:flex hover:bg-foreground/10 hover:text-foreground"
+							className="hidden items-center justify-center text-muted-foreground group-hover:flex group-has-[:focus-visible]:flex hover:text-foreground"
 						>
 							<LuArchive className="size-3.5" />
 						</button>
```

---

### Incident Patch 7: `b79185c1` (2026-09-30)
**Commit Message**: fix(cloud): attachments reach cloud workspaces, scoped to the box they belong to (#7961)

* fix(cloud): attachments reach cloud workspaces, scoped to the box they belong to

Attaching files to a cloud workspace never worked on the deployed API.

- The QStash provision job re-validated `launch` with a schema that had no
  `attachmentFileIds`, and zod stripped it, so the box never learned the files
  existed. A local API calls the provisioner directly, which is where #7622 was
  verified. `cloudAgentLaunchSchema` is now the one definition: the job uses
  it and `CloudAgentLaunch` is inferred from it.
- host-service in a box authenticated with `AUTH_TOKEN=sandbox` through the JWT
  provider, and `/api/auth/token` answered 401, so every box→API call failed —
  including `attachment.resolve`, which both the create-time import and
  mobile's running-session path depend on. In sandbox mode it now sends no
  credential and the firewall's workspace credential identifies it.
- `attachment.resolve` is on the box allowlist, limited to files attached to
  the caller's own workspace: access to the box is access to its files.
- Mobile's terminal composer attaches uploads to a cloud workspace
  (`

**File**: `apps/api/src/app/api/cloud-workspaces/provision/route.ts` (modified, +2/-10)
```diff
@@ -1,6 +1,6 @@
 import {
 	CLOUD_AGENT_PROMPT_MAX_LENGTH,
-	isCloudAgentId,
+	cloudAgentLaunchSchema,
 } from "@superset/shared/cloud-agent-launch";
 import { provisionCloudWorkspace } from "@superset/trpc/cloud-workspace-provision";
 import { z } from "zod";
@@ -16,15 +16,7 @@ const payloadSchema = z
 		cloudWorkspaceId: z.string().uuid(),
 		/** Absent when the user typed a name, which the row already holds. */
 		namingPrompt: z.string().max(CLOUD_AGENT_PROMPT_MAX_LENGTH).optional(),
-		launch: z
-			.object({
-				agent: z.string().refine(isCloudAgentId, "unknown cloud agent"),
-				prompt: z.string().max(CLOUD_AGENT_PROMPT_MAX_LENGTH),
-				model: z.string().min(1).optional(),
-				effort: z.string().min(1).optional(),
-				mode: z.string().min(1).optional(),
-			})
-			.optional(),
+		launch: cloudAgentLaunchSchema.optional(),
 	})
 	.strict();
 
```

**File**: `apps/mobile/screens/(authenticated)/workspace/[id]/WorkspaceScreen/WorkspaceScreen.tsx` (modified, +7/-2)
```diff
@@ -756,9 +756,14 @@ export function WorkspaceScreen() {
 	const attachmentTarget = useMemo(
 		() =>
 			id && hostUrl && workspace?.worktreePath
-				? { workspaceId: id, hostUrl, draftKey: workspaceDraftKey(id) }
+				? {
+						workspaceId: id,
+						hostUrl,
+						isCloud: cloud !== null,
+						draftKey: workspaceDraftKey(id),
+					}
 				: null,
-		[id, hostUrl, workspace],
+		[id, hostUrl, workspace, cloud],
 	);
 
 	// The chip beside the quick keys, or nothing. Mark and colour both come off
```

**File**: `apps/mobile/screens/(authenticated)/workspace/[id]/components/TerminalComposer/hooks/useWriteTerminalAttachments/useWriteTerminalAttachments.ts` (modified, +9/-0)
```diff
@@ -7,10 +7,13 @@ import { asAttachmentError } from "@/lib/attachments/errors";
 import { awaitAttachmentUploads } from "@/lib/attachments/upload";
 import { errorCopy } from "@/lib/errors";
 import { getHostServiceClientByUrl } from "@/lib/host-service/client";
+import { apiClient } from "@/lib/trpc/client";
 
 export interface TerminalAttachmentTarget {
 	workspaceId: string;
 	hostUrl: string;
+	/** A cloud box fetches only files attached to it, so they are attached first. */
+	isCloud: boolean;
 	/** Which draft the attachments (and their uploads) belong to. */
 	draftKey: string;
 }
@@ -43,6 +46,12 @@ export function useWriteTerminalAttachments() {
 			);
 			const client = getHostServiceClientByUrl(target.hostUrl);
 			try {
+				if (target.isCloud) {
+					await apiClient.cloudWorkspace.attachFiles.mutate({
+						id: target.workspaceId,
+						fileIds,
+					});
+				}
 				const { paths } =
 					await client.attachments.materializeIntoWorkspace.mutate({
 						workspaceId: target.workspaceId,
```

**File**: `packages/db/drizzle/0132_rename_cloud_workspace_attachment_kind.sql` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+-- Hand-written in place of drizzle-kit's text cast + DROP/CREATE TYPE, which rewrites
+-- `attachments` and fails on rows still holding the old value. Same end state.
+ALTER TYPE "public"."attachment_parent_kind" RENAME VALUE 'cloud_workspace_prompt' TO 'cloud_workspace';
```

**File**: `packages/db/drizzle/meta/_journal.json` (modified, +7/-0)
```diff
@@ -925,6 +925,13 @@
       "when": 1790653034319,
       "tag": "0131_cloud_presence_and_task_records",
       "breakpoints": true
+    },
+    {
+      "idx": 132,
+      "version": "7",
+      "when": 1790733596109,
+      "tag": "0132_rename_cloud_workspace_attachment_kind",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

---

### Incident Patch 8: `555b711a` (2026-09-30)
**Commit Message**: fix(cli): report each command once per day instead of on every run (#7948)

* fix(cli): report each command once per day instead of on every run

cli_command_invoked was about 13.3M events a week, roughly 60% of all
PostHog events. 24 users sent 80% of them: agents and dashboards that
call `terminals list`, `terminals read` and `workspaces list` every few
seconds. Each event was also its own analytics.captureEvent call to the
API.

The CLI now keeps the commands it reported today (UTC) in
$SUPERSET_HOME_DIR/reported-commands.json and skips both the event and
the API call for repeats. DAU/WAU and users-per-command stay correct;
raw call counts go away.

* fix(cli): ignore a malformed reported-commands file instead of throwing

Valid JSON of the wrong shape (null, a non-array commands) threw in the
middleware before the command ran, so one bad file broke every command.

**File**: `packages/cli/src/lib/analytics.test.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import {
+	afterAll,
+	beforeEach,
+	describe,
+	expect,
+	setSystemTime,
+	test,
+} from "bun:test";
+import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { isFirstReportToday } from "./analytics";
+
+const tempDir = mkdtempSync(join(tmpdir(), "superset-cli-analytics-"));
+const reportedPath = join(tempDir, "reported-commands.json");
+
+function report(command: string) {
+	return isFirstReportToday(command, reportedPath);
+}
+
+beforeEach(() => {
+	rmSync(reportedPath, { force: true });
+	setSystemTime(new Date("2026-09-29T12:00:00Z"));
+});
+
+afterAll(() => {
+	setSystemTime();
+	rmSync(tempDir, { recursive: true, force: true });
+});
+
+describe("isFirstReportToday", () => {
+	test("allows a command once per day", () => {
+		expect(report("terminals list")).toBe(true);
+		expect(report("terminals list")).toBe(false);
+		expect(report("terminals list")).toBe(false);
+	});
+
+	test("tracks each command separately", () => {
+		expect(report("terminals list")).toBe(true);
+		expect(report("terminals read")).toBe(true);
+		expect(report("terminals list")).toBe(false);
+	});
+
+	test("allows the command again on the next UTC day", () => {
+		expect(report("status")).toBe(true);
+		setSystemTime(new Date("2026-09-30T00:00:01Z"));
+		expect(report("status")).toBe(true);
+		expect(report("status")).toBe(false);
+	});
+
+	test("starts over when the file holds something unexpected", () => {
+		for (const contents of [
+			"null",
+			"not json",
+			'{"day":"2026-09-29","commands":"status"}',
+		]) {
+			writeFileSync(reportedPath, contents);
+			expect(report("status")).toBe(true);
+			expect(report("status")).toBe(false);
+		}
+	});
+
+	test("allows every call when the file cannot be written", () => {
+		const unwritable = join(tempDir, "missing-dir", "reported-commands.json");
+		expect(isFirstReportToday("status", unwritable)).toBe(true);
+		expect(isFirstReportToday("status", unwritable)).toBe(true);
+	});
+});
```

**File**: `packages/cli/src/lib/analytics.ts` (modified, +33/-1)
```diff
@@ -1,17 +1,49 @@
+import { readFileSync, writeFileSync } from "node:fs";
+import { join } from "node:path";
 import type { ApiClient } from "./api-client";
+import { SUPERSET_HOME_DIR } from "./config";
 import { env } from "./env";
 
+const REPORTED_COMMANDS_PATH = join(
+	SUPERSET_HOME_DIR,
+	"reported-commands.json",
+);
+
+export function isFirstReportToday(
+	command: string,
+	path = REPORTED_COMMANDS_PATH,
+): boolean {
+	const day = new Date().toISOString().slice(0, 10);
+	let commands: string[] = [];
+	try {
+		const reported = JSON.parse(readFileSync(path, "utf-8"));
+		if (reported?.day === day && Array.isArray(reported.commands)) {
+			commands = reported.commands;
+		}
+	} catch {}
+	if (commands.includes(command)) return false;
+	try {
+		writeFileSync(
+			path,
+			JSON.stringify({ day, commands: [...commands, command] }),
+		);
+	} catch {}
+	return true;
+}
+
 export function trackCommandInvoked(input: {
 	api: ApiClient;
 	commandPath: string[];
 	flags: string[];
 }): void {
+	const command = input.commandPath.join(" ");
+	if (!isFirstReportToday(command)) return;
 	void input.api.analytics.captureEvent
 		.mutate({
 			source: "cli",
 			event: "cli_command_invoked",
 			properties: {
-				command: input.commandPath.join(" "),
+				command,
 				flags: input.flags,
 				cli_version: env.VERSION,
 			},
```

---

### Incident Patch 9: `9d19c852` (2026-09-30)
**Commit Message**: fix(slack): unfurl org pages for the connected workspace, and finish unfurls (#7957)

Harshith's org page link never unfurled and he never saw the connect
prompt. Two causes:

- The events route started link_shared, entity_details_requested and
  app_home_opened work without awaiting it or using after(). Vercel froze
  the function after the 200, so the work ran minutes later, when the
  instance served an unrelated request, or never. Prod logs show every
  chat.unfurl error attached to other routes 12-47 minutes after the
  event. These now run inside after().
- Org pages needed the poster to have linked their Slack account, while
  tasks unfurl for anyone in the connected workspace. Most teammates have
  never linked. Org and public pages now unfurl for the connected
  workspace like tasks; only just_me pages still need the creator linked.
  Visibilities are listed by name so a future one falls through to the
  reader check instead of unfurling.

**File**: `apps/api/src/app/api/integrations/slack/events/process-link-shared/process-link-shared.ts` (modified, +3/-3)
```diff
@@ -66,9 +66,9 @@ export interface UnfurlLinksParams {
 }
 
 /**
- * Tasks unfurl for the whole connected workspace. Pages unfurl as the poster:
- * a public page for anyone, anything narrower only once the poster has linked
- * a Superset account that can read it — and until then Slack asks them to.
+ * Tasks and org pages unfurl for the whole connected workspace. A `just_me`
+ * page unfurls only once its creator has linked their Slack account, and
+ * until then Slack asks them to.
  */
 export async function unfurlLinks({
 	connection,
```

**File**: `apps/api/src/app/api/integrations/slack/events/route.ts` (modified, +30/-26)
```diff
@@ -1,5 +1,6 @@
 import type { LinkSharedEvent, SlackEvent } from "@slack/types";
 import { Client } from "@upstash/qstash";
+import { after } from "next/server";
 
 import { env } from "@/env";
 import { verifySlackSignature } from "../verify-signature";
@@ -221,42 +222,45 @@ export async function POST(request: Request) {
 		}
 
 		if (event.type === "link_shared") {
-			processLinkShared({
-				event: event as LinkSharedEvent,
-				teamId: team_id,
-				eventId: event_id,
-			}).catch((err: unknown) => {
-				console.error("[slack/events] Process link shared error:", err);
-			});
+			after(() =>
+				processLinkShared({
+					event: event as LinkSharedEvent,
+					teamId: team_id,
+					eventId: event_id,
+				}).catch((err: unknown) => {
+					console.error("[slack/events] Process link shared error:", err);
+				}),
+			);
 		}
 
 		if (event.type === "entity_details_requested") {
-			processEntityDetails({
-				event: event as EntityDetailsRequestedEvent,
-				teamId: team_id,
-				eventId: event_id,
-			}).catch((err: unknown) => {
-				console.error("[slack/events] Process entity details error:", err);
-			});
+			after(() =>
+				processEntityDetails({
+					event: event as EntityDetailsRequestedEvent,
+					teamId: team_id,
+					eventId: event_id,
+				}).catch((err: unknown) => {
+					console.error("[slack/events] Process entity details error:", err);
+				}),
+			);
 		}
 
 		if (event.type === "app_home_opened") {
-			const appHomeEvent = event as { user?: string; tab?: string };
-			if (
-				typeof appHomeEvent.user !== "string" ||
-				typeof appHomeEvent.tab !== "string"
-			) {
+			const { user, tab } = event as { user?: string; tab?: string };
+			if (typeof user !== "string" || typeof tab !== "string") {
 				console.error("[slack/events] Invalid app home opened payload shape");
 				return new Response("ok", { status: 200 });
 			}
 
-			processAppHomeOpened({
-				event: { user: appHomeEvent.user, tab: appHomeEvent.tab },
-				teamId: team_id,
-				eventId: event_id,
-			}).catch((err: unknown) => {
-				console.error("[slack/events] Process app home opened error:", err);
-			});
+			after(() =>
+				processAppHomeOpened({
+					event: { user, tab },
+					teamId: team_id,
+					eventId: event_id,
+				}).catch((err: unknown) => {
+					console.error("[slack/events] Process app home opened error:", err);
+				}),
+			);
 		}
 	}
 
```

**File**: `packages/trpc/src/router/page/preview.test.ts` (modified, +8/-17)
```diff
@@ -17,31 +17,22 @@ describe("previewAccess", () => {
 		).toBe("readable");
 	});
 
-	test("org pages need a reader before they show anything", async () => {
+	test("org pages preview for the connected workspace without a reader", async () => {
 		expect(
 			await previewAccess(
 				{ visibility: "org", createdByUserId: OWNER, takenDownAt: null },
 				undefined,
 			),
-		).toBe("needs_user");
-	});
-
-	test("org pages preview for a member", async () => {
-		expect(
-			await previewAccess(
-				{ visibility: "org", createdByUserId: OWNER, takenDownAt: null },
-				member(OTHER),
-			),
 		).toBe("readable");
 	});
 
-	test("a reader outside the organization sees nothing", async () => {
-		expect(
-			await previewAccess(
-				{ visibility: "org", createdByUserId: OWNER, takenDownAt: null },
-				outsider(OTHER),
-			),
-		).toBe("missing");
+	test("just_me pages need their creator to be the reader", async () => {
+		const page = {
+			visibility: "just_me" as const,
+			createdByUserId: OWNER,
+			takenDownAt: null,
+		};
+		expect(await previewAccess(page, outsider(OWNER))).toBe("missing");
 	});
 
 	test("just_me pages preview only for their creator", async () => {
```

**File**: `packages/trpc/src/router/page/preview.ts` (modified, +8/-7)
```diff
@@ -43,19 +43,20 @@ export async function previewAccess(
 	reader: PreviewReader | undefined,
 ): Promise<PagePreviewResult["status"]> {
 	if (page.takenDownAt) return "missing";
-	if (page.visibility === "everyone") return "readable";
+	if (page.visibility === "everyone" || page.visibility === "org") {
+		return "readable";
+	}
 	if (!reader) return "needs_user";
+	if (page.createdByUserId !== reader.userId) return "missing";
 	if (!(await reader.isMember())) return "missing";
-	if (page.visibility === "just_me" && page.createdByUserId !== reader.userId) {
-		return "missing";
-	}
 	return "readable";
 }
 
 /**
- * What a link to a page may show outside the app, for a reader who is not
- * signed in to it (a Slack unfurl). `userId` is the reader when the caller
- * has resolved one; without it only public pages preview.
+ * What a link to a page may show outside the app, to an audience the caller
+ * has already tied to `organizationId` (a Slack workspace connected to it).
+ * `userId` is the reader when the caller has resolved one; only a `just_me`
+ * page needs it.
  */
 export async function pagePreview({
 	slug,
```

---

### Incident Patch 10: `f70b1bc0` (2026-09-30)
**Commit Message**: fix(connectors): reuse the GitHub App OAuth client for the github connector (#7955)

PLUGIN_GITHUB_CLIENT_ID and PLUGIN_GITHUB_CLIENT_SECRET were never set as
GitHub secrets, so both deploy workflows passed empty strings and
connectorEnv() threw MissingConnectorEnvError on every attempt to connect
the GitHub plugin. GH_APP_CLIENT_ID and GH_APP_CLIENT_SECRET already exist
as repo secrets and already reach the API through both workflows, so point
requires_env at them and drop the unused pair from the templates and the
deploy plumbing.

**File**: `.env.example` (modified, +0/-9)
```diff
@@ -163,15 +163,6 @@ GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:superset.sh
 # -----------------------------------------------------------------------------
 PLUGIN_CLIENT_METADATA_BASE_URL=
 
-# -----------------------------------------------------------------------------
-# Connector OAuth clients
-# Only for connectors whose requires_env names a pair that no other feature
-# already sets — the rest reuse the integration clients above. Without them the
-# connector still lists, but Connect answers "not configured".
-# -----------------------------------------------------------------------------
-PLUGIN_GITHUB_CLIENT_ID=
-PLUGIN_GITHUB_CLIENT_SECRET=
-
 # -----------------------------------------------------------------------------
 # Sentry Error Tracking
 # -----------------------------------------------------------------------------
```

**File**: `.env.local.example` (modified, +0/-9)
```diff
@@ -147,15 +147,6 @@ GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:superset.sh
 # -----------------------------------------------------------------------------
 PLUGIN_CLIENT_METADATA_BASE_URL=
 
-# -----------------------------------------------------------------------------
-# Connector OAuth clients
-# Only for connectors whose requires_env names a pair that no other feature
-# already sets — the rest reuse the integration clients above. Without them the
-# connector still lists, but Connect answers "not configured".
-# -----------------------------------------------------------------------------
-PLUGIN_GITHUB_CLIENT_ID=
-PLUGIN_GITHUB_CLIENT_SECRET=
-
 # -----------------------------------------------------------------------------
 # Sentry Error Tracking (optional — leave blank to disable)
 # -----------------------------------------------------------------------------
```

**File**: `.github/workflows/deploy-preview.yml` (modified, +0/-4)
```diff
@@ -154,8 +154,6 @@ jobs:
           POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
           GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT: ${{ secrets.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT }}
           PLUGIN_CLIENT_METADATA_BASE_URL: ${{ secrets.PLUGIN_CLIENT_METADATA_BASE_URL }}
-          PLUGIN_GITHUB_CLIENT_ID: ${{ secrets.PLUGIN_GITHUB_CLIENT_ID }}
-          PLUGIN_GITHUB_CLIENT_SECRET: ${{ secrets.PLUGIN_GITHUB_CLIENT_SECRET }}
           POSTHOG_PROJECT_ID: ${{ secrets.POSTHOG_PROJECT_ID }}
           KV_REST_API_URL: ${{ secrets.KV_REST_API_URL }}
           KV_REST_API_TOKEN: ${{ secrets.KV_REST_API_TOKEN }}
@@ -229,8 +227,6 @@ jobs:
             --env POSTHOG_API_KEY=$POSTHOG_API_KEY \
             --env GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT="$GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT" \
             --env PLUGIN_CLIENT_METADATA_BASE_URL="$PLUGIN_CLIENT_METADATA_BASE_URL" \
-            --env PLUGIN_GITHUB_CLIENT_ID="$PLUGIN_GITHUB_CLIENT_ID" \
-            --env PLUGIN_GITHUB_CLIENT_SECRET="$PLUGIN_GITHUB_CLIENT_SECRET" \
             --env POSTHOG_PROJECT_ID=$POSTHOG_PROJECT_ID \
             --env KV_REST_API_URL=$KV_REST_API_URL \
             --env KV_REST_API_TOKEN=$KV_REST_API_TOKEN \
```

**File**: `.github/workflows/deploy-production.yml` (modified, +0/-4)
```diff
@@ -162,8 +162,6 @@ jobs:
           MERCURY_API_TOKEN: ${{ secrets.MERCURY_API_TOKEN }}
           GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT: ${{ secrets.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT }}
           PLUGIN_CLIENT_METADATA_BASE_URL: ${{ secrets.PLUGIN_CLIENT_METADATA_BASE_URL }}
-          PLUGIN_GITHUB_CLIENT_ID: ${{ secrets.PLUGIN_GITHUB_CLIENT_ID }}
-          PLUGIN_GITHUB_CLIENT_SECRET: ${{ secrets.PLUGIN_GITHUB_CLIENT_SECRET }}
           STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
           STRIPE_PRO_MONTHLY_PRICE_ID: ${{ secrets.STRIPE_PRO_MONTHLY_PRICE_ID }}
           STRIPE_PRO_YEARLY_PRICE_ID: ${{ secrets.STRIPE_PRO_YEARLY_PRICE_ID }}
@@ -249,8 +247,6 @@ jobs:
             --env MERCURY_API_TOKEN=$MERCURY_API_TOKEN \
             --env GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT="$GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT" \
             --env PLUGIN_CLIENT_METADATA_BASE_URL="$PLUGIN_CLIENT_METADATA_BASE_URL" \
-            --env PLUGIN_GITHUB_CLIENT_ID="$PLUGIN_GITHUB_CLIENT_ID" \
-            --env PLUGIN_GITHUB_CLIENT_SECRET="$PLUGIN_GITHUB_CLIENT_SECRET" \
             --env STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET \
             --env STRIPE_PRO_MONTHLY_PRICE_ID=$STRIPE_PRO_MONTHLY_PRICE_ID \
             --env STRIPE_PRO_YEARLY_PRICE_ID=$STRIPE_PRO_YEARLY_PRICE_ID \
```

**File**: `packages/shared/src/connectors/connectors.json` (modified, +1/-4)
```diff
@@ -366,10 +366,7 @@
 					"scopes": ["repo", "read:org", "workflow"],
 					"scope_separator": " ",
 					"token_request_auth_method": "client_secret_post",
-					"requires_env": [
-						"PLUGIN_GITHUB_CLIENT_ID",
-						"PLUGIN_GITHUB_CLIENT_SECRET"
-					],
+					"requires_env": ["GH_APP_CLIENT_ID", "GH_APP_CLIENT_SECRET"],
 					"identity": {
 						"url": "https://api.github.com/user",
 						"method": "GET",
```

#### Recent Merged Pull Requests:
- **PR #7996** (2026-09-30): feat(terminal): say why a shared terminal shrank (@saddlepaddle)
- **PR #7995** (2026-09-30): feat(mobile): run natively on iPad (@saddlepaddle)
- **PR #7990** (2026-09-30): feat(desktop,host-service): keep a local resource journal for debugging slow or leaking hosts (@saddlepaddle)
- **PR #7988** (2026-09-30): fix(desktop): color the cloud row's unread dot from the theme (@saddlepaddle)
- **PR #7987** (2026-09-30): fix(marketing): unbreak the vale job on the privacy policy scopes list (@harshithmullapudi)
- **PR #7983** (2026-09-30): feat(panes): a pane that throws shows its own error, not the whole workspace's (@saddlepaddle)
- **PR #7982** (2026-09-30): fix(workspace-fs): allow saving files outside the workspace root (@saddlepaddle)
- **PR #7981** (2026-09-30): fix(desktop): line up the cloud row's PR button and status (@saddlepaddle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
