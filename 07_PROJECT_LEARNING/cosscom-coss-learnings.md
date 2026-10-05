# Forensic Learning Record (Deep Inspection): cosscom/coss

> **Canonical Artifact**: `07_PROJECT_LEARNING/cosscom-coss-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cosscom/coss](https://github.com/cosscom/coss))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:29.819Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cosscom/coss`
- **Description**: coss.com/ui is the official design system of Cal.com
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10647 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/demo/page.tsx`
```
import type { WebhookItem } from "../webhooks-list-content";
import { WebhooksPageContent } from "../webhooks-page-content";

const demoWebhooks: WebhookItem[] = [
  {
    date: "2021-10-20",
    enabled: true,
    events: [
      "Booking canceled",
      "Booking created",
      "Booking rejected",
      "Booking requested",
      "Booking payment initiated",
      "Booking rescheduled",
      "Booking paid",
      "Booking no-show updated",
      "Meeting ended",
      "Meeting started",
      "Recording download link ready",
      "Transcript generated",
      "Form submitted",
    ],
    id: "wh_1",
    url: "https://testurl.com/894357943857",
    userAvatar:
      "https://pbs.twimg.com/profile_images/1994776674391457792/7utKOMi6_400x400.jpg",
    userId: "user_1",
    userInitials: "JD",
    userName: "John Doe",
  },
  {
    date: "2024-01-15",
    enabled: true,
    events: ["Booking created", "Booking canceled"],
    id: "wh_2",
    url: "https://api.example.com/webhooks/booking-created",
    userAvatar:
      "https://pbs.twimg.com/profile_images/1994776674391457792/7utKOMi6_400x400.jpg",
    userId: "user_1",
    userInitials: "JD",
    userName: "John Doe",
  },
  {
    date: "2024-02-01",
    enabled: false,
    events: ["Meeting started", "Meeting ended"],
    id: "wh_3",
    url: "https://hooks.myapp.com/calcom",
    userId: "user_2",
    userInitials: "JS",
    userName: "Jane Smith",
  },
];

export default function WebhooksDemoPage() {
  return <WebhooksPageContent webhooks={demoWebhooks} />;
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/new-webhook-button.tsx`
```
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@coss/ui/components/avatar";
import { Button } from "@coss/ui/components/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { PlusIcon } from "lucide-react";

export type CreateForOption = {
  id: string;
  name: string;
  type: "user" | "organization";
  initials: string;
  avatar?: string;
};

const createForOptions: CreateForOption[] = [
  {
    avatar:
      "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=72&h=72&dpr=2&q=80",
    id: "user-1",
    initials: "AE",
    name: "Admin Example",
    type: "user",
  },
  { id: "org-1", initials: "AI", name: "Acme Inc.", type: "organization" },
  { id: "org-2", initials: "OR", name: "org", type: "organization" },
  { id: "org-3", initials: "FS", name: "fssf", type: "organization" },
];

export interface NewWebhookButtonProps {
  text: string;
  onSelect?: (option: CreateForOption) => void;
}

export function NewWebhookButton({ text, onSelect }: NewWebhookButtonProps) {
  return (
    <Menu>
      <MenuTrigger render={<Button />}>
        <PlusIcon aria-hidden="true" />
        {text}
      </MenuTrigger>
      <MenuPopup>
        <MenuGroup>
          <MenuGroupLabel>Create for</MenuGroupLabel>
          {createForOptions.map((item) => (
            <MenuItem key={item.id} onClick={() => onSelect?.(item)}>
              <span className="flex items-center gap-2">
                <Avatar className="size-5">
                  {item.avatar ? (
                    <AvatarImage alt={item.name} src={item.avatar} />
                  ) : null}
                  <AvatarFallback className="text-[.625rem]">
                    {item.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{item.name}</span>
              </span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/new/new-webhook-form-fields.tsx`
```
"use client";

import { Button } from "@coss/ui/components/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@coss/ui/components/collapsible";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@coss/ui/components/combobox";
import { Field, FieldDescription, FieldLabel } from "@coss/ui/components/field";
import { Group, GroupSeparator } from "@coss/ui/components/group";
import { Input } from "@coss/ui/components/input";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
} from "@coss/ui/components/number-field";
import { ScrollArea } from "@coss/ui/components/scroll-area";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@coss/ui/components/select";
import { Switch } from "@coss/ui/components/switch";
import { Textarea } from "@coss/ui/components/textarea";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const eventTriggerItems = [
  { label: "Booking canceled", value: "booking-canceled" },
  { label: "Booking created", value: "booking-created" },
  { label: "Booking rejected", value: "booking-rejected" },
  { label: "Booking requested", value: "booking-requested" },
  { label: "Booking payment initiated", value: "booking-payment-initiated" },
  { label: "Booking rescheduled", value: "booking-rescheduled" },
  { label: "Booking paid", value: "booking-paid" },
  { label: "Meeting ended", value: "meeting-ended" },
  { label: "Meeting started", value: "meeting-started" },
];

const timeUnitItems = [
  { label: "mins", value: "mins" },
  { label: "hours", value: "hours" },
  { label: "days", value: "days" },
];

const webhookVersionItems = [{ label: "2021-10-20", value: "2021-10-20" }];

const payloadVariables = [
  {
    description:
      "The name of the trigger event (e.g., BOOKING_CREATED, BOOKING_CANCELLED)",
    name: "triggerEvent",
  },
  { description: "The time of the webhook", name: "createdAt" },
  { description: "The event type slug", name: "type" },
  { description: "The event type name", name: "title" },
  { description: "The start time of the booking", name: "startTime" },
  { description: "The end time of the booking", name: "endTime" },
  { description: "List of attendee emails", name: "attendees" },
];

export function NewWebhookFormFields() {
  const [customPayloadOpen, setCustomPayloadOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Subscriber URL</FieldLabel>
        <Input placeholder="https://example.com/webhook" type="url" />
      </Field>

      <Field>
        <FieldLabel>
          <Switch defaultChecked />
          Enable webhook
        </FieldLabel>
      </Field>

      <Field>
        <FieldLabel>Event triggers</FieldLabel>
        <Combobox
          defaultValue={[eventTriggerItems[0], eventTriggerItems[1]]}
          items={eventTriggerItems}
          multiple
        >
          <ComboboxChips>
            <ComboboxValue>
              {(value: { value: string; label: string }[]) => (
                <>
                  {value?.map((item) => (
                    <ComboboxChip aria-label={item.label} key={item.value}>
                      {item.label}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    aria-label="Select event triggers"
                    placeholder={
                      value.length > 0 ? undefined : "Select event triggers…"
                    }
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxPopup>
            <ComboboxEmpty>No event triggers found.</ComboboxEmpty>
            <ComboboxList>
              {(item: { value: string; label: string }) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      </Field>

      <Field>
        <FieldLabel>
          How long after the users don&apos;t show up on cal video meeting?
        </FieldLabel>
        <Group
          aria-label="How long after the users don't show up on cal video meeting?"
          className="w-full"
        >
          <NumberField
            aria-label="Duration"
            className="gap-0"
            defaultValue={5}
            min={0}
            render={<NumberFieldGroup />}
          >
            <NumberFieldInput className="text-left" />
          </NumberField>
          <GroupSeparator />
          <Select defaultValue="mins" items={timeUnitItems}>
            <SelectTrigger className="w-fit min-w-none">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {timeUnitItems.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Group>
      </Field>

      <Field>
        <FieldLabel>Secret</FieldLabel>
        <Input type="text" />
      </Field>

      <Field>
        <FieldLabel>Webhook version</FieldLabel>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Webhook version"
            defaultValue="2021-10-20"
            items={webhookVersionItems}
          >
            <SelectTrigger className="w-fit min-w-none">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {webhookVersionItems.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        <FieldDescription className="flex items-center gap-1">
          <Link href="#">View payload docs for this version</Link>
          <ExternalLinkIcon aria-hidden="true" className="size-3" />
        </FieldDescription>
      </Field>

      <Collapsible onOpenChange={setCustomPayloadOpen} open={customPayloadOpen}>
        <Field>
          <FieldLabel>
            <CollapsibleTrigger
              nativeButton={false}
              render={
                <Switch
                  checked={customPayloadOpen}
                  onCheckedChange={setCustomPayloadOpen}
                />
              }
            />
            Custom Payload Template
          </FieldLabel>
        </Field>
        <CollapsiblePanel>
          <div className="mt-4 flex flex-col items-start gap-2">
            <Textarea placeholder={"{\n  \n}"} rows={4} />
            <Collapsible className="w-full">
              <CollapsibleTrigger
                render={<Button size="sm" variant="outline" />}
              >
                Show available variables
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <ScrollArea
                  className="mt-4 h-64 rounded-lg border border-input"
                  overscrollContain
                  scrollbarGutter
                  scrollFade
                >
                  <div className="p-2">
                    <p className="my-1 px-[calc(--spacing(2)+1px)] font-medium text-sm">
                      Event and booking
                    </p>
                    <ul>
                      {payloadVariables.map((variable) => (
                        <li key={variable.name}>
                          <Button
                            className="h-auto! w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left"
                            variant="ghost"
                          >
                            <span className="font-mono text-xs">
                              {`{{${variable.name}}}`}
                            </span>
                            <span className="font-normal text-muted-foreground text-xs">
                              {variable.description}
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollArea>
              </CollapsiblePanel>
            </Collapsible>
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/new/page.tsx`
```
import { Button } from "@coss/ui/components/button";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameFooter,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";
import { ActivityIcon } from "lucide-react";
import Link from "next/link";
import { NewWebhookFormFields } from "./new-webhook-form-fields";
import { WebhookTestSection } from "./webhook-test-section";
import {
  AppHeader,
  AppHeaderContent,
  AppHeaderDescription,
} from "@/components/app/app-header";

export default function NewWebhookPage() {
  return (
    <>
      <AppHeader>
        <AppHeaderContent title="New webhook">
          <AppHeaderDescription>
            Receive meeting data in real-time when something happens in Cal.com.
          </AppHeaderDescription>
        </AppHeaderContent>
      </AppHeader>
      <div className="flex flex-col gap-4">
        <CardFrame>
          <Card className="rounded-b-none!">
            <CardPanel>
              <NewWebhookFormFields />
            </CardPanel>
          </Card>
          <CardFrameFooter className="flex justify-end gap-2">
            <Button
              render={<Link href="/settings/developer/webhooks" />}
              variant="outline"
            >
              Cancel
            </Button>
            <Button>Save</Button>
          </CardFrameFooter>
        </CardFrame>

        <CardFrame>
          <CardFrameHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardFrameTitle>Webhook test</CardFrameTitle>
                <CardFrameDescription>
                  Please ping test before creating.
                </CardFrameDescription>
              </div>
              <Button size="sm" variant="outline">
                <ActivityIcon />
                Ping test
              </Button>
            </div>
          </CardFrameHeader>
          <Card>
            <CardPanel>
              <WebhookTestSection />
            </CardPanel>
          </Card>
        </CardFrame>
      </div>
    </>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/page.tsx`
```
import { WebhooksEmpty } from "./webhooks-empty";
import {
  AppHeader,
  AppHeaderContent,
  AppHeaderDescription,
} from "@/components/app/app-header";

export default function WebhooksSettingsPage() {
  const webhooks: { id: string; url: string; events: string }[] = [];

  return (
    <>
      <AppHeader>
        <AppHeaderContent title="Webhooks">
          <AppHeaderDescription>
            Receive meeting data in real-time when something happens in Cal.com.
          </AppHeaderDescription>
        </AppHeaderContent>
      </AppHeader>
      <WebhooksEmpty webhooks={webhooks} />
    </>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/webhooks-empty.tsx`
```
"use client";

import { Button } from "@coss/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@coss/ui/components/empty";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { EllipsisIcon, WebhookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CreateForOption } from "./new-webhook-button";
import { NewWebhookButton } from "./new-webhook-button";

export function WebhooksEmpty({
  webhooks,
}: {
  webhooks: { id: string; url: string; events: string }[];
}) {
  const router = useRouter();

  function handleCreateFor(option: CreateForOption) {
    router.push(
      `/settings/developer/webhooks/new?for=${encodeURIComponent(option.id)}`,
    );
  }

  if (webhooks.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed py-8 md:py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WebhookIcon />
          </EmptyMedia>
          <EmptyTitle>Create your first webhook</EmptyTitle>
          <EmptyDescription>
            With webhooks you can receive meeting data in real-time when
            something happens in Cal.com.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <NewWebhookButton onSelect={handleCreateFor} text="Add webhook" />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ul className="divide-y">
      {webhooks.map((webhook) => (
        <li
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          key={webhook.id}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{webhook.url}</p>
            <p className="truncate text-muted-foreground text-xs">
              {webhook.events}
            </p>
          </div>
          <Menu>
            <MenuTrigger
              render={
                <Button
                  aria-label="Webhook options"
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              <EllipsisIcon />
            </MenuTrigger>
            <MenuPopup align="end" alignOffset={-4} sideOffset={8}>
              <MenuItem>Edit</MenuItem>
              <MenuItem variant="destructive">Delete</MenuItem>
            </MenuPopup>
          </Menu>
        </li>
      ))}
    </ul>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/webhooks-list-content.tsx`
```
"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@coss/ui/components/avatar";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { Switch } from "@coss/ui/components/switch";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@coss/ui/components/tooltip";
import { EllipsisIcon, PencilIcon, TrashIcon, WebhookIcon } from "lucide-react";
import { useState } from "react";
import {
  ListItem,
  ListItemActions,
  ListItemBadges,
  ListItemContent,
  ListItemHeader,
  ListItemTitle,
} from "@/components/list-item";

const EVENT_TAGS_VISIBLE = 8;

export type WebhookItem = {
  id: string;
  url: string;
  date?: string;
  events: string[];
  enabled?: boolean;
  userId: string;
  userName: string;
  userAvatar?: string;
  userInitials?: string;
};

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type UserFilterOption = {
  id: string;
  label: string;
  avatar?: string;
};

export function getUniqueUsers(webhooks: WebhookItem[]): UserFilterOption[] {
  const userMap = new Map<string, UserFilterOption>();

  for (const webhook of webhooks) {
    if (!userMap.has(webhook.userId)) {
      userMap.set(webhook.userId, {
        avatar: webhook.userAvatar,
        id: webhook.userId,
        label: webhook.userName,
      });
    }
  }

  return Array.from(userMap.values());
}

type WebhookInput =
  | WebhookItem
  | {
      id: string;
      url: string;
      events: string;
      userName?: string;
      userAvatar?: string;
      userId?: string;
      userInitials?: string;
    };

function normalizeWebhook(webhook: WebhookInput): WebhookItem {
  if (Array.isArray(webhook.events)) {
    return webhook as WebhookItem;
  }
  const userName = webhook.userName || "Default User";
  return {
    ...webhook,
    events: webhook.events.split(",").map((e) => e.trim()),
    userAvatar: webhook.userAvatar,
    userId: webhook.userId || "default",
    userInitials: webhook.userInitials || getInitials(userName),
    userName,
  };
}

function groupWebhooksByUser(webhooks: WebhookItem[]) {
  const groups = new Map<string, WebhookItem[]>();
  for (const webhook of webhooks) {
    const existing = groups.get(webhook.userId) ?? [];
    existing.push(webhook);
    groups.set(webhook.userId, existing);
  }
  return Array.from(groups.entries()).map(([userId, items]) => {
    const first = items[0];
    return {
      userAvatar: first?.userAvatar,
      userId,
      userInitials: first?.userInitials ?? getInitials(first?.userName ?? ""),
      userName: first?.userName ?? "Unknown",
      webhooks: items,
    };
  });
}

export function WebhooksListContent({
  webhooks,
  selectedUserIds,
}: {
  webhooks: WebhookInput[];
  selectedUserIds?: string[];
}) {
  const normalized = webhooks.map(normalizeWebhook);
  const filtered =
    selectedUserIds && selectedUserIds.length > 0
      ? normalized.filter((webhook) => selectedUserIds.includes(webhook.userId))
      : normalized;
  const grouped = groupWebhooksByUser(filtered);

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(
        ({ userId, userName, userAvatar, userInitials, webhooks }) => (
          <CardFrame key={userId}>
            <CardFrameHeader>
              <CardFrameTitle className="flex items-center gap-2">
                <Avatar className="size-5">
                  {userAvatar ? (
                    <AvatarImage alt={userName} src={userAvatar} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {userName}
              </CardFrameTitle>
            </CardFrameHeader>
            <Card>
              <CardPanel className="p-0">
                {webhooks.map((webhook) => (
                  <WebhookRow key={webhook.id} webhook={webhook} />
                ))}
              </CardPanel>
            </Card>
          </CardFrame>
        ),
      )}
    </div>
  );
}

function WebhookRow({ webhook }: { webhook: WebhookItem }) {
  const [enabled, setEnabled] = useState(webhook.enabled ?? true);
  const visibleEvents = webhook.events.slice(0, EVENT_TAGS_VISIBLE);
  const remainingCount = webhook.events.length - EVENT_TAGS_VISIBLE;

  return (
    <ListItem>
      <ListItemContent>
        <ListItemHeader>
          <div className="flex items-center gap-2">
            <ListItemTitle className="truncate font-normal">
              {webhook.url}
            </ListItemTitle>
            {webhook.date != null && (
              <Badge variant="info">{webhook.date}</Badge>
            )}
          </div>
        </ListItemHeader>
        <ListItemBadges>
          {visibleEvents.map((event) => (
            <Badge key={event} variant="outline">
              <WebhookIcon />
              {event}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Badge variant="outline">+{remainingCount} More</Badge>
          )}
        </ListItemBadges>
      </ListItemContent>
      <ListItemActions>
        <div className="flex items-center gap-4 max-md:hidden">
          <Tooltip>
            <TooltipTrigger
              render={
                <Switch
                  checked={enabled}
                  className="relative"
                  onCheckedChange={setEnabled}
                />
              }
            />
            <TooltipPopup sideOffset={11}>
              {enabled ? "Disable webhook" : "Enable webhook"}
            </TooltipPopup>
          </Tooltip>

          <Menu>
            <Tooltip>
              <MenuTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label="Options"
                        size="icon"
                        variant="outline"
                      >
                        <EllipsisIcon />
                      </Button>
                    }
                  />
                }
              />
              <TooltipPopup>Options</TooltipPopup>
            </Tooltip>
            <MenuPopup align="end">
              <MenuItem>
                <PencilIcon />
                Edit
              </MenuItem>
              <MenuItem variant="destructive">
                <TrashIcon />
                Delete
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>

        <Menu>
          <MenuTrigger
            className="md:hidden"
            render={
              <Button aria-label="Options" size="icon" variant="outline">
                <EllipsisIcon />
              </Button>
            }
          />
          <MenuPopup align="end">
            <MenuItem>
              <PencilIcon />
              Edit
            </MenuItem>
            <MenuSeparator />
            <MenuGroup>
              <MenuCheckboxItem
                checked={enabled}
                onCheckedChange={setEnabled}
                variant="switch"
              >
                Enable webhook
              </MenuCheckboxItem>
            </MenuGroup>
            <MenuSeparator />
            <MenuItem variant="destructive">
              <TrashIcon />
              Delete
            </MenuItem>
          </MenuPopup>
        </Menu>
      </ListItemActions>
    </ListItem>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/app/(settings)/settings/developer/webhooks/webhooks-page-content.tsx`
```
"use client";

import { Button } from "@coss/ui/components/button";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { WebhookItem } from "./webhooks-list-content";
import { WebhooksListContent } from "./webhooks-list-content";
import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
  AppHeaderDescription,
} from "@/components/app/app-header";

interface WebhooksPageContentProps {
  webhooks: WebhookItem[];
}

export function WebhooksPageContent({ webhooks }: WebhooksPageContentProps) {
  const [selectedUserIds, _setSelectedUserIds] = useState<string[]>([]);

  return (
    <>
      <AppHeader>
        <AppHeaderContent title="Webhooks">
          <AppHeaderDescription>
            Receive meeting data in real-time when something happens in Cal.com.
          </AppHeaderDescription>
        </AppHeaderContent>
        <AppHeaderActions>
          <Button variant="outline">
            New
            <ChevronDownIcon />
          </Button>
        </AppHeaderActions>
      </AppHeader>
      <WebhooksListContent
        selectedUserIds={selectedUserIds}
        webhooks={webhooks}
      />
    </>
  );
}

```

### Core Architecture Module: `apps/examples/calcom/hooks/use-loading-state.ts`
```
import { useEffect, useState } from "react";
import { useDebug } from "@/components/debug-context";

/**
 * Custom hook to manage loading state with artificial delay support
 * @param delayMs - The artificial delay in milliseconds
 * @returns Whether to show the loading state
 */
export function useLoadingState(delayMs: number) {
  const { enableArtificialDelay, isLoadingOverride } = useDebug();
  const [isLoading, setIsLoading] = useState(enableArtificialDelay);

  useEffect(() => {
    if (!enableArtificialDelay) {
      setIsLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [enableArtificialDelay, delayMs]);

  return isLoadingOverride ?? isLoading;
}

```

### Core Architecture Module: `apps/examples/calcom/hooks/use-scroll-hide.ts`
```
import * as React from "react";

const DEFAULT_SCROLL_THRESHOLD = 48;

export function useScrollHide(threshold = DEFAULT_SCROLL_THRESHOLD) {
  const [isHidden, setIsHidden] = React.useState(false);
  const lastScrollY = React.useRef(0);

  React.useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (currentY <= 0) {
        setIsHidden(false);
        lastScrollY.current = currentY;
        return;
      }

      if (Math.abs(delta) < threshold) {
        return;
      }

      if (delta > 0) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isHidden;
}

```

### Core Architecture Module: `apps/origin/hooks/use-config.ts`
```
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

type Config = {
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
};

const configAtom = atomWithStorage<Config>("config", {
  packageManager: "pnpm",
});

export function useConfig() {
  return useAtom(configAtom);
}

```

### Core Architecture Module: `apps/origin/hooks/use-copy.ts`
```
import { useState } from "react";

export function useCopy(duration = 1500) {
  const [copied, setCopied] = useState<boolean>(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), duration);
      return true;
    } catch (err) {
      console.error("Failed to copy text: ", err);
      return false;
    }
  };

  return {
    copied,
    copy,
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #856** (2026-09-30): **fix(ui): resize textarea wrapper for WebKit placeholder sizing**
  *Symptoms*: ## Summary - Fix WebKit rendering where long placeholders grow a `field-sizing: content` textarea but leave the bordered `textarea-control` wrapper too short - Change the wrapper from `inline-flex` to `inline-grid` so it tracks the textarea height when the field is empty with a long placeholder - Sync the updated primitive to `@coss/ui` and rebuild the registry JSON  ## Test plan - [ ] Open the textarea docs demo in Playwright WebKit (iPhone 15 emulation) with a ~150-char placeholder and confirm the border wraps the full placeholder - [ ] Verify the same fix on cal.com booker textarea surfaces in WebKit - [ ] Confirm Chromium behavior is unchanged for empty, typed, and long-placeholder states - [ ] Smoke test `flex-1 *:field-sizing-fixed *:min-h-0` textarea layouts still fill their container correctly   Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > [vc]: #PmmG2Ixma3J09IIKtxcpU0418vyzO6CDnE3jxRtXQlw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWV4YW1wbGVzLWNhbGNvbSIsInByb2plY3RJZCI6InByal92TllOOTBmNWxDYktqcDNld1J6SXNiWVVtbHdNIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvZXhhbXBsZXMvY2FsY29tIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWV4YW1wbGVzLWNhbGNvbS82Z2FqRU42eGhUMWJqeGpNa3llNmFQMXczVGpqIiwicHJldmlld1VybCI6ImNvc3MtZXhhbXBsZXMtY2FsY29tLWdpdC1maXgtdGV4dGFyZWEtd2Via2l0LXBsYWNlaG8tOGFlYmU4LWNhbC52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImNvc3MtZXhhbXBsZXMtY2FsY29tLWdpdC1maXgtdGV4dGFyZWEtd2Via2l0LXBsYWNlaG8tOGFlYmU4LWNhbC52ZXJjZWwuYXBwIn19LHsibmFtZSI6ImNvc3MtY29tLXVpIiwicHJvamVjdElkIjoicHJqX1lWQ1Q2aUZYaGJLTGpQdG5INWtVU1hQOTQ5N3giLCJyb290RGlyZWN0b3J5IjoiYXBwcy91aSIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tdWkvM1hHSlZIUHlQOGVQSnF0eVR1aDZUaWRjODJ1biIsInByZXZpZXdVcmwiOiJjb3NzLWNv
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5378">ENG-5378</a></p>

- **Issue #855** (2026-09-27): **feat(ui): add palette Select and radio card particles**
  *Symptoms*: Add two self-contained particles for choosing a three-color palette:  - `p-select-24`: coss Select with three overlapping color circles in the trigger and options, with the selected option aligned to the trigger. - `p-radio-group-10`: button-like radio cards in four columns and three rows, using the same 16px overlapping circles, palette-name tooltips, accessible labels, and selected-card styling. Each full card is clickable; radio semantics provide single selection and arrow-key navigation. <img width="462" height="221" alt="Screenshot 2026-09-27 at 11 40 27" src="https://github.com/user-attachments/assets/a7317ec5-cc85-4b6c-a342-c9e56c9043f8" /> <img width="372" height="144" alt="Screenshot 2026-09-27 at 11 40 20" src="https://github.com/user-attachments/assets/ae311c6a-dc7f-470f-b5b0-ef6379a69449" />    Both include the twelve named light-color palettes from https://github.com/calcom/cal/pull/8354, with Dusk selected initially. Swatches retain their colors in either UI theme; surrounding controls use semantic theme tokens. Includes generated registry installation files.  Validation: formatting, UI TypeScript check, registry dependency validation, registry build, and whitespace check passed. Verified Select keyboard selection and radio-card click/arrow-key selection in the local browser, and inspected the four-column/three-row layout. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BaSv3xm3K86arXJsGX/iwspUcOorIhQUPbOC0XmI9xU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbSIsInByb2plY3RJZCI6InByal8wbFhveVltQ3lHcHBKM1M2OUV6NkFKVzltU0lxIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93d3ciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tL0Zqb2kzWnIxNDhiSkQxa21IbUw4RTlDb1UzWUciLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tZ2l0LWNvZGV4LWNvbG9yLXBhbGV0dGUtc2VsZWN0b3JzLWNhbC52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImNvc3MtY29tLWdpdC1jb2RleC1jb2xvci1wYWxldHRlLXNlbGVjdG9ycy1jYWwudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpL0ZwYjdoZXBIOHQxeGZ4QmdKd3RkbXBqTnhtY0EiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LWNvZGV4LWNvbG9yLXBhbGV0dGUtc2VsZWN0b3JzLWNhbC52ZXJjZWwuYXBwIiwibmV4
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5319">ENG-5319</a></p>

- **Issue #853** (2026-09-22): **feat(ui): update Cal Sans to 2.003**
  *Symptoms*: ## Summary  Bumps the shared `@coss/ui/fonts` Cal Sans from `1.998` (2026-06-15 build) to `2.003` (2026-09-19 build, `65f14744`) using the `calsans-cossui` cut from [calcom/font](https://github.com/calcom/font) — the lean product build (alternates subset out, `opsz` peaks at 32pt).  The cossui cut ships italics as a separate style-linked file instead of an `ital` axis, so `fontSans` now takes a two-entry `src`:  ```ts src: [   { path: "./CalSansVF.woff2", style: "normal" },   { path: "./CalSansVF-Italic.woff2", style: "italic" }, ], weight: "400 700", ```  `weight` was `"300 700"` but the `wght` axis has always been 400–700, so the declared range is corrected to match the font. `fontHeading` still aliases `fontSans`.  Upright woff2 shrinks 185 KB → 147 KB; the italic file (165 KB) is only fetched when italic text is rendered.  Link to Devin session: https://app.devin.ai/sessions/edf2175c9c6e47959f50c83a9a3c4eaf Open in Devin Desktop: https://app.devin.ai/desktop/session/edf2175c9c6e47959f50c83a9a3c4eaf?variant=devin Requested by: @pasqualevitiello
  **Post-Mortem & Fix Analysis**:
  > <!-- devin-pr-monitoring-controls --> I'll fix CI failures and address comments from users with write access. I'll skip comments containing "(aside)".  - [ ] Disable automatic comment, CI, and merge conflict monitoring 
  > [vc]: #lacQ9kr6DurbWEU77bGjbqxjjoPKI6kaSckSBqOpLJk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWRldmluLTE3OTAwNzI5ODItY2FsLXNhbnMtMjAwMy1jYWwudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpL0NFQ1RleFBYQ3RNS1J2anF4YjZLNG9TUDhHRVQiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LWRldmluLTE3OTAwNzI5ODItY2FsLXNhbnMtMjAwMy1jYWwudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6ImNvc3MtY29tLW9yaWdpbiIsInByb2plY3RJZCI6InByal96MGR4UnZZYzlxa2ZTblJQSmhoeE9wZHhlcm1VIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvb3JpZ2luIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLW9yaWdpbi9Fd3dFWjJXTGVSdmR6U0t5Z21VZ2l6UktjdW9tIiwi
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5163">ENG-5163</a></p>

- **Issue #852** (2026-09-21): **docs(ui): remove the Early Access callout from the Introduction**
  *Symptoms*: ## Summary Removes the "Early Access" `<Alert>` from the coss ui Introduction page (`apps/ui/content/docs/(root)/index.mdx`). The callout said coss ui is in early development, Base UI is in beta, and recommended it only for projects comfortable with breaking changes — coss ui already powers Cal.com's product UI, so the warning no longer reflects reality and reads as a reason not to adopt.  Content-only change; the Atoms paragraph/link is intentionally left untouched (out of scope per the ticket).  Closes [PRO-1095](https://linear.app/calcom/issue/PRO-1095/remove-the-early-access-callout-from-the-cosscomui-introduction).  Link to Devin session: https://app.devin.ai/sessions/25000718a71c4ae6990f93bb97e250c9 Open in Devin Desktop: https://app.devin.ai/desktop/session/25000718a71c4ae6990f93bb97e250c9?variant=devin Requested by: @supalarry
  **Post-Mortem & Fix Analysis**:
  > <!-- devin-pr-monitoring-controls --> I'll fix CI failures and address comments from users with write access. I'll skip comments containing "(aside)".  - [ ] Disable automatic comment, CI, and merge conflict monitoring 
  > [vc]: #x8idmiydhQJS8ccULC7wHK5tBAU3nW0DtjqpsV6Ujz0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpL0dQcFRHMlh3VFRydFd2WGJhYlBuNmd2cE5GdEwiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LWRldmluLXByby0xMDk1LXJlbW92ZS10aGUtZWFybHktYWNjZS0zYmZkMDgtY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWRldmluLXByby0xMDk1LXJlbW92ZS10aGUtZWFybHktYWNjZS0zYmZkMDgtY2FsLnZlcmNlbC5hcHAifX0seyJuYW1lIjoiY29zcy1jb20tb3JpZ2luIiwicHJvamVjdElkIjoicHJqX3owZHhSdlljOXFrZlNuUlBKaGh4T3BkeGVybVUiLCJyb290RGlyZWN0b3J5IjoiYXBwcy9vcmlnaW4iLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tb3JpZ2luLzl2cENX
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/PRO-1095">PRO-1095</a></p>

- **Issue #851** (2026-09-16): **fix(ui): keep drawer close button above drag bar**
  *Symptoms*: ## Summary - When `showBar` and `showCloseButton` are both enabled, the absolute drag bar paints over the close button and blocks clicks (bottom and left placements). - Stack the close button with `z-1` so it stays above the bar, without reordering DOM or disabling pointer events on the handle. - Follow-up to #850 with a smaller fix that keeps `DrawerBar` as a swipe target.  ## Test plan - [ ] Open a bottom drawer with `showBar` and `showCloseButton` and confirm the close button is clickable - [ ] Repeat for a left drawer (bar and close share the end edge) - [ ] Confirm right and top drawers still look and swipe as before - [ ] Confirm swipe-to-dismiss still works from the drag bar   Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > [vc]: #bXCpLzbU413m45L9mHRtkzYEQQEMtBrKuCIWs40ukPs=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbSIsInByb2plY3RJZCI6InByal8wbFhveVltQ3lHcHBKM1M2OUV6NkFKVzltU0lxIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93d3ciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tL0ZiQ0RicHQxWUxWcGJNNXpERVB6dVBocEY5em4iLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tZ2l0LWZpeC1kcmF3ZXItY2xvc2Utei1pbmRleC1jYWwudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJjb3NzLWNvbS1naXQtZml4LWRyYXdlci1jbG9zZS16LWluZGV4LWNhbC52ZXJjZWwuYXBwIn19LHsibmFtZSI6ImNvc3MtZXhhbXBsZXMtY2FsY29tIiwicHJvamVjdElkIjoicHJqX3ZOWU45MGY1bENiS2pwM2V3UnpJc2JZVW1sd00iLCJyb290RGlyZWN0b3J5IjoiYXBwcy9leGFtcGxlcy9jYWxjb20iLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtZXhhbXBsZXMtY2FsY29tL0NDc3hOR1Q4ZkZycHpheHh3azVETHJaRHpIOHIiLCJwcmV2aWV3VXJsIjoiY29zcy1leGFtcGxlcy1jYWxjb20tZ2l0LWZpeC1kcmF3ZXItY2xvc2Utei1p
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-4429">ENG-4429</a></p>

- **Issue #850** (2026-09-16): **fix(ui): drawer bar overlapping close button**
  *Symptoms*: Hi, when `showBar` and `showCloseButton` are both enabled, the bar renders on top of the close button and blocks clicks.  https://github.com/user-attachments/assets/787d3e3d-8b19-4369-b2b3-f304eb8a1d48   I swaped the order so the close button renders last, and added `pointer-events-none` to `DrawerBar` since it's decorative (`aria-hidden`).  https://github.com/user-attachments/assets/a51320aa-b1cd-48ab-add3-238ff4df2d80  I hope this HUGE PR will not be an issue! Love your work!
  **Post-Mortem & Fix Analysis**:
  > @NathanBrodin is attempting to deploy a commit to the **cal** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=cal&slug=cal&teamId=team_YGsKWfo1YxoTcbzsoekZkyup&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%225a1f3832fb07a475e9c2e7503cc50c25d9dab51c%22%7D%2C%22id%22%3A%22QmeAF1vLTvz3NDpqaV7SscnXAvxSzJ9KP5HcHgaA7VGonv%22%2C%22org%22%3A%22cosscom%22%2C%22prId%22%3A850%2C%22repo%22%3A%22coss%22%7D).  
  > [vc]: #mKAK/tKpSne0w0nUDZWtHvWUQInZZJqmi0qrOYaY5RY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS1vcmlnaW4iLCJwcm9qZWN0SWQiOiJwcmpfejBkeFJ2WWM5cWtmU25SUEpoaHhPcGR4ZXJtVSIsInJvb3REaXJlY3RvcnkiOiJhcHBzL29yaWdpbiIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS1vcmlnaW4vNnVHaDdSQTJQR1FmdzZYZkRWajM1Rm9xVnlmYyIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiU0tJUFBFRCJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9Y29zc2NvbSZyZXBvPWNvc3MmcHI9ODUwIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/cal/coss-com-origin"><sup><img src="https://vercel.com/api/www/avatar?pr
  > Thanks for catching this, and for the before/after videos — the overlap is real when `showBar` and `showCloseButton` are both enabled.  We're going with a smaller fix: `z-1` on the close button so it stacks above the bar. Reordering the DOM and adding `pointer-events-none` on `DrawerBar` would unblock clicks, but the bar is the drag affordance (`touch-none`), so it should keep receiving pointer events. `aria-hidden` only hides it from assistive tech, not from hit-testing.  Closing this in favor of #851.

- **Issue #849** (2026-09-16): **feat(ui): add separator particle**
  *Symptoms*: ## What does this PR do?  * Adds a new `Separator` particle to the UI registry. * Adds a `Separator` example to the component docs form to demonstrate how the particle can be used.  ## Why?  Provides a reusable separator particle and documents its usage directly in the Separator component documentation.  ## Checklist  * [x] Added the separator particle * [x] Added the Separator example to the docs form * [x] Updated generated registry files * [x] Ran formatting and registry sync commands  ## Docs <img width="1460" height="968" alt="Screenshot 2026-09-09 at 16 57 51" src="https://github.com/user-attachments/assets/be600724-97e3-42bd-84d7-a44382cb3a6e" />  ## Particle <img width="703" height="553" alt="Screenshot 2026-09-09 at 16 57 36" src="https://github.com/user-attachments/assets/64d58c54-4c16-423e-bbbc-70d0a4518b3e" /> 
  **Post-Mortem & Fix Analysis**:
  > @rtkac is attempting to deploy a commit to the **cal** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=cal&slug=cal&teamId=team_YGsKWfo1YxoTcbzsoekZkyup&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22ee142344d06e8060618a57c9b78aab19b752851a%22%7D%2C%22id%22%3A%22QmZ8Ac88jT1U4kae22MNqUUzS96E5AcXdFw8WfGGHx31Za%22%2C%22org%22%3A%22cosscom%22%2C%22prId%22%3A849%2C%22repo%22%3A%22coss%22%7D).  
  > Thanks for the PR! We're going to pass on this one — we already cover this, and it isn't a pattern we want to add right now.

- **Issue #848** (2026-09-08): **feat: migrate TanStack Table to v9**
  *Symptoms*: ## Summary  - upgrade @tanstack/react-table to v9.2.4 in UI, Origin, and the Cal.com example - migrate all 15 table implementations to the v9 useTable/tableFeatures API and explicit row-model functions - register only the features and sort/filter functions each table uses - keep table-only pagination, sorting, filtering, ordering, visibility, sizing, and selection in TanStack's atom-backed state - use focused selectors and local Subscribe boundaries to avoid unrelated page re-renders - rebuild the affected UI and Origin registry artifacts  ## Validation  - bunx biome check --linter-enabled=false . - bun run lint - bun run typecheck - bun test --pass-with-no-tests (12 passing) - bun run build - cd apps/ui && bun run registry:validate-deps - cd apps/ui && bun run registry:build - cd apps/origin && bun run registry:build  ## Notes  Opened as a draft so table-specific interaction tests can be added before merge.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #NLqE5WqcYdfPZniEfkvFcnWSlfYb1SRN8nT0Eq8Ir/c=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbSIsInByb2plY3RJZCI6InByal8wbFhveVltQ3lHcHBKM1M2OUV6NkFKVzltU0lxIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93d3ciLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tZ2l0LWNvZGV4LW1pZ3JhdGUtdGFuc3RhY2stdGFibGUtdjktY2FsLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS83WGFYcUpyRDJaRW0zakFwYkRHdkVDVkpFalZRIiwicHJldmlld1VybCI6ImNvc3MtY29tLWdpdC1jb2RleC1taWdyYXRlLXRhbnN0YWNrLXRhYmxlLXY5LWNhbC52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoiY29zcy1jb20tdWkiLCJwcm9qZWN0SWQiOiJwcmpfWVZDVDZpRlhoYktMalB0bkg1a1VTWFA5NDk3eCIsInJvb3REaXJlY3RvcnkiOiJhcHBzL3VpIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS11aS9KMXlic2FXWUExWHVtTTRrd2N0MUhTN3J0NlNDIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJTS0lQUEVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-4204">ENG-4204</a></p>

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

### Incident Patch 1: `dd49ec9c` (2026-09-30)
**Commit Message**: fix(ui): resize textarea wrapper for WebKit placeholder sizing (#856)

WebKit grows field-sizing textareas for long placeholders but does not
expand inline-flex wrappers, so the border stayed shorter than the text.
Use inline-grid on the textarea control wrapper so it tracks the child.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/textarea.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/textarea.tsx",
-      "content": "\"use client\";\n\nimport { Field as FieldPrimitive } from \"@base-ui/react/field\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport type TextareaProps = React.ComponentPropsWithoutRef<\"textarea\"> &\n  React.RefAttributes<HTMLTextAreaElement> & {\n    size?: \"sm\" | \"default\" | \"lg\" | number;\n    unstyled?: boolean;\n  };\n\nexport function Textarea({\n  className,\n  size = \"default\",\n  unstyled = false,\n  ref,\n  ...props\n}: TextareaProps): React.ReactElement {\n  return (\n    <span\n      className={\n        cn(\n          !unstyled &&\n            \"relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n          className,\n        ) || undefined\n      }\n      data-size={size}\n      data-slot=\"textarea-control\"\n    >\n      <FieldPrimitive.Control\n        ref={ref}\n        value={props.value}\n        defaultValue={props.defaultValue}\n        disabled={props.disabled}\n        id={props.id}\n        name={props.name}\n        render={(defaultProps: React.ComponentProps<\"textarea\">) => (\n          <textarea\n            className={cn(\n              \"field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-foreground outline-none placeholder:text-muted-foreground/72 max-sm:min-h-20.5\",\n              size === \"sm\" &&\n                \"min-h-16.5 px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)] max-sm:min-h-19.5\",\n              size === \"lg\" &&\n                \"min-h-18.5 py-[calc(--spacing(2)-1px)] max-sm:min-h-21.5\",\n            )}\n            data-slot=\"textarea\"\n            {...mergeProps(defaultProps, props)}\n          />\n        )}\n      />\n    </span>\n  );\n}\n\nexport { FieldPrimitive };\n",
+      "content": "\"use client\";\n\nimport { Field as FieldPrimitive } from \"@base-ui/react/field\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport type TextareaProps = React.ComponentPropsWithoutRef<\"textarea\"> &\n  React.RefAttributes<HTMLTextAreaElement> & {\n    size?: \"sm\" | \"default\" | \"lg\" | number;\n    unstyled?: boolean;\n  };\n\nexport function Textarea({\n  className,\n  size = \"default\",\n  unstyled = false,\n  ref,\n  ...props\n}: TextareaProps): React.ReactElement {\n  return (\n    <span\n      className={\n        cn(\n          !unstyled &&\n            \"relative inline-grid w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n          className,\n        ) || undefined\n      }\n      data-size={size}\n      data-slot=\"textarea-control\"\n    >\n      <FieldPrimitive.Control\n        ref={ref}\n        value={props.value}\n        defaultValue={props.defaultValue}\n        disabled={props.disabled}\n        id={props.id}\n        name={props.name}\n        render={(defaultProps: React.ComponentProps<\"textarea\">) => (\n          <textarea\n            className={cn(\n              \"field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-foreground outline-none placeholder:text-muted-foreground/72 max-sm:min-h-20.5\",\n              siz
```

**File**: `apps/ui/registry/default/ui/textarea.tsx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export function Textarea({
       className={
         cn(
           !unstyled &&
-            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
+            "relative inline-grid w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
           className,
         ) || undefined
       }
```

**File**: `packages/ui/src/components/textarea.tsx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export function Textarea({
       className={
         cn(
           !unstyled &&
-            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
+            "relative inline-grid w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
           className,
         ) || undefined
       }
```

---

### Incident Patch 2: `8423f18a` (2026-09-27)
**Commit Message**: feat(ui): add palette Select and radio card particles (#855)

* feat(ui): add color palette selector particles

* refactor(ui): focus palette particle on coss Select

* fix(ui): align palette select popup with trigger

* feat(ui): add three-column palette radio cards

* fix(ui): hide palette card radio indicators

* style(ui): make palette cards compact and inline

* feat(ui): show palette names in swatch card tooltips

* fix(ui): disable hoverable palette tooltips

* style(ui): arrange palette cards in four columns

**File**: `apps/ui/public/r/p-radio-group-10.json` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+{
+  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
+  "name": "p-radio-group-10",
+  "description": "Color palette radio cards in a four-column grid",
+  "registryDependencies": [
+    "@coss/radio-group",
+    "@coss/tooltip"
+  ],
+  "files": [
+    {
+      "path": "registry/default/particles/p-radio-group-10.tsx",
+      "content": "\"use client\";\n\nimport { RadioGroup, RadioPrimitive } from \"@/registry/default/ui/radio-group\";\nimport {\n  Tooltip,\n  TooltipPopup,\n  TooltipProvider,\n  TooltipTrigger,\n} from \"@/registry/default/ui/tooltip\";\n\nconst palettes = [\n  { label: \"Mono\", value: \"mono\", colors: [\"#18181B\", \"#A1A1AA\", \"#FAFAFA\"] },\n  {\n    label: \"Porcelain\",\n    value: \"porcelain\",\n    colors: [\"#AA8F73\", \"#C8B79A\", \"#889FA3\"],\n  },\n  { label: \"Ember\", value: \"ember\", colors: [\"#B94724\", \"#DB8649\", \"#EDD0A0\"] },\n  { label: \"Terra\", value: \"terra\", colors: [\"#A64F3C\", \"#C78F70\", \"#896577\"] },\n  { label: \"Rosé\", value: \"rose\", colors: [\"#9B3F60\", \"#C98693\", \"#E9B9A5\"] },\n  { label: \"Dusk\", value: \"dusk\", colors: [\"#BE835B\", \"#8E7C9F\", \"#6E97AE\"] },\n  {\n    label: \"Orchard\",\n    value: \"orchard\",\n    colors: [\"#63794B\", \"#ADA66B\", \"#83A18A\"],\n  },\n  {\n    label: \"Petrol\",\n    value: \"petrol\",\n    colors: [\"#326A76\", \"#C97868\", \"#C9AD81\"],\n  },\n  {\n    label: \"Lagoon\",\n    value: \"lagoon\",\n    colors: [\"#247E92\", \"#4CAFA3\", \"#B6D8C7\"],\n  },\n  {\n    label: \"Borealis\",\n    value: \"borealis\",\n    colors: [\"#267F69\", \"#527FB8\", \"#9A83BF\"],\n  },\n  {\n    label: \"Cobalt\",\n    value: \"cobalt\",\n    colors: [\"#244E9A\", \"#607DA9\", \"#B5C9DD\"],\n  },\n  { label: \"Iris\", value: \"iris\", colors: [\"#7361A3\", \"#AC87A5\", \"#DBC3CA\"] },\n];\n\nexport default function Particle() {\n  return (\n    <fieldset className=\"w-full space-y-3\">\n      <legend className=\"font-medium text-sm\">Color palette</legend>\n      <TooltipProvider>\n        <RadioGroup\n          aria-label=\"Color palette\"\n          className=\"grid grid-cols-4 gap-2\"\n          defaultValue=\"dusk\"\n        >\n          {palettes.map((palette) => (\n            <Tooltip key={palette.value} disableHoverablePopup>\n              <TooltipTrigger\n                render={\n                  <RadioPrimitive.Root\n                    aria-label={palette.label}\n                    value={palette.value}\n                    className=\"flex items-center justify-center rounded-lg border p-2.5 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:border-primary/48 data-checked:bg-accent/50\"\n                  />\n                }\n              >\n                <span aria-hidden=\"true\" className=\"flex shrink-0 -space-x-1\">\n                  {palette.colors.map((color) => (\n                    <span\n                      key={color}\n                      className=\"size-4 rounded-full ring-1 ring-background\"\n                      style={{ backgroundColor: color }}\n                    />\n                  ))}\n                </span>\n              </TooltipTrigger>\n              <TooltipPopup>{palette.label}</TooltipPopup>\n            </Tooltip>\n          ))}\n        </RadioGroup>\n      </TooltipProvider>\n    </fieldset>\n  );\n}\n",
+      "type": "registry:block"
+    }
+  ],
+  "meta": {
+    "className": "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-96"
+  },
+  "categories": [
+    "radio group",
+    "tooltip"
+  ],
+  "type": "registry:block"
+}
\ No newline at end of file
```

**File**: `apps/ui/public/r/p-select-24.json` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+{
+  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
+  "name": "p-select-24",
+  "description": "Color palette select with three-color swatches",
+  "registryDependencies": [
+    "@coss/select"
+  ],
+  "files": [
+    {
+      "path": "registry/default/particles/p-select-24.tsx",
+      "content": "\"use client\";\n\nimport {\n  Select,\n  SelectItem,\n  SelectLabel,\n  SelectPopup,\n  SelectTrigger,\n  SelectValue,\n} from \"@/registry/default/ui/select\";\n\nconst palettes = [\n  { label: \"Mono\", value: \"mono\", colors: [\"#18181B\", \"#A1A1AA\", \"#FAFAFA\"] },\n  {\n    label: \"Porcelain\",\n    value: \"porcelain\",\n    colors: [\"#AA8F73\", \"#C8B79A\", \"#889FA3\"],\n  },\n  { label: \"Ember\", value: \"ember\", colors: [\"#B94724\", \"#DB8649\", \"#EDD0A0\"] },\n  { label: \"Terra\", value: \"terra\", colors: [\"#A64F3C\", \"#C78F70\", \"#896577\"] },\n  { label: \"Rosé\", value: \"rose\", colors: [\"#9B3F60\", \"#C98693\", \"#E9B9A5\"] },\n  { label: \"Dusk\", value: \"dusk\", colors: [\"#BE835B\", \"#8E7C9F\", \"#6E97AE\"] },\n  {\n    label: \"Orchard\",\n    value: \"orchard\",\n    colors: [\"#63794B\", \"#ADA66B\", \"#83A18A\"],\n  },\n  {\n    label: \"Petrol\",\n    value: \"petrol\",\n    colors: [\"#326A76\", \"#C97868\", \"#C9AD81\"],\n  },\n  {\n    label: \"Lagoon\",\n    value: \"lagoon\",\n    colors: [\"#247E92\", \"#4CAFA3\", \"#B6D8C7\"],\n  },\n  {\n    label: \"Borealis\",\n    value: \"borealis\",\n    colors: [\"#267F69\", \"#527FB8\", \"#9A83BF\"],\n  },\n  {\n    label: \"Cobalt\",\n    value: \"cobalt\",\n    colors: [\"#244E9A\", \"#607DA9\", \"#B5C9DD\"],\n  },\n  { label: \"Iris\", value: \"iris\", colors: [\"#7361A3\", \"#AC87A5\", \"#DBC3CA\"] },\n];\n\nexport default function Particle() {\n  return (\n    <Select\n      defaultValue={palettes[5]}\n      items={palettes}\n      itemToStringValue={(palette) => palette.value}\n    >\n      <SelectLabel>Color palette</SelectLabel>\n      <SelectTrigger>\n        <SelectValue>\n          {(palette: (typeof palettes)[number]) => (\n            <span className=\"flex items-center gap-2\">\n              <span aria-hidden=\"true\" className=\"flex shrink-0 -space-x-1\">\n                {palette.colors.map((color) => (\n                  <span\n                    key={color}\n                    className=\"size-4 rounded-full ring-1 ring-background\"\n                    style={{ backgroundColor: color }}\n                  />\n                ))}\n              </span>\n              <span className=\"truncate\">{palette.label}</span>\n            </span>\n          )}\n        </SelectValue>\n      </SelectTrigger>\n      <SelectPopup>\n        {palettes.map((palette) => (\n          <SelectItem key={palette.value} value={palette}>\n            <span className=\"flex items-center gap-2\">\n              <span aria-hidden=\"true\" className=\"flex shrink-0 -space-x-1\">\n                {palette.colors.map((color) => (\n                  <span\n                    key={color}\n                    className=\"size-4 rounded-full ring-1 ring-background\"\n                    style={{ backgroundColor: color }}\n                  />\n                ))}\n              </span>\n              {palette.label}\n            </span>\n          </SelectItem>\n        ))}\n      </SelectPopup>\n    </Select>\n  );\n}\n",
+      "type": "registry:block"
+    }
+  ],
+  "meta": {
+    "className": "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-64"
+  },
+  "categories": [
+    "select"
+  ],
+  "type": "registry:block"
+}
\ No newline at end of file
```

**File**: `apps/ui/public/r/registry.json` (modified, +42/-0)
```diff
@@ -8824,6 +8824,28 @@
       ],
       "type": "registry:block"
     },
+    {
+      "categories": [
+        "radio group",
+        "tooltip"
+      ],
+      "description": "Color palette radio cards in a four-column grid",
+      "files": [
+        {
+          "path": "registry/default/particles/p-radio-group-10.tsx",
+          "type": "registry:block"
+        }
+      ],
+      "meta": {
+        "className": "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-96"
+      },
+      "name": "p-radio-group-10",
+      "registryDependencies": [
+        "@coss/radio-group",
+        "@coss/tooltip"
+      ],
+      "type": "registry:block"
+    },
     {
       "categories": [
         "scroll area"
@@ -9365,6 +9387,26 @@
       ],
       "type": "registry:block"
     },
+    {
+      "categories": [
+        "select"
+      ],
+      "description": "Color palette select with three-color swatches",
+      "files": [
+        {
+          "path": "registry/default/particles/p-select-24.tsx",
+          "type": "registry:block"
+        }
+      ],
+      "meta": {
+        "className": "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-64"
+      },
+      "name": "p-select-24",
+      "registryDependencies": [
+        "@coss/select"
+      ],
+      "type": "registry:block"
+    },
     {
       "categories": [
         "select"
```

**File**: `apps/ui/registry.json` (modified, +42/-0)
```diff
@@ -8824,6 +8824,28 @@
       ],
       "type": "registry:block"
     },
+    {
+      "categories": [
+        "radio group",
+        "tooltip"
+      ],
+      "description": "Color palette radio cards in a four-column grid",
+      "files": [
+        {
+          "path": "registry/default/particles/p-radio-group-10.tsx",
+          "type": "registry:block"
+        }
+      ],
+      "meta": {
+        "className": "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-96"
+      },
+      "name": "p-radio-group-10",
+      "registryDependencies": [
+        "@coss/radio-group",
+        "@coss/tooltip"
+      ],
+      "type": "registry:block"
+    },
     {
       "categories": [
         "scroll area"
@@ -9365,6 +9387,26 @@
       ],
       "type": "registry:block"
     },
+    {
+      "categories": [
+        "select"
+      ],
+      "description": "Color palette select with three-color swatches",
+      "files": [
+        {
+          "path": "registry/default/particles/p-select-24.tsx",
+          "type": "registry:block"
+        }
+      ],
+      "meta": {
+        "className": "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-64"
+      },
+      "name": "p-select-24",
+      "registryDependencies": [
+        "@coss/select"
+      ],
+      "type": "registry:block"
+    },
     {
       "categories": [
         "select"
```

**File**: `apps/ui/registry/__index__.tsx` (modified, +36/-0)
```diff
@@ -7603,6 +7603,24 @@ export const Index: Record<string, any> = {
     categories: ["radio group","segmented control"],
     meta: undefined,
   },
+  "p-radio-group-10": {
+    name: "p-radio-group-10",
+    description: "Color palette radio cards in a four-column grid",
+    type: "registry:block",
+    registryDependencies: ["@coss/radio-group","@coss/tooltip"],
+    files: [{
+      path: "registry/default/particles/p-radio-group-10.tsx",
+      type: "registry:block",
+      target: ""
+    }],
+    component: React.lazy(async () => {
+      const mod = await import("@/registry/default/particles/p-radio-group-10.tsx")
+      const exportName = Object.keys(mod).find(key => typeof mod[key] === 'function' || typeof mod[key] === 'object') || item.name
+      return { default: mod.default || mod[exportName] }
+    }),
+    categories: ["radio group","tooltip"],
+    meta: {"className":"**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-96"},
+  },
   "p-scroll-area-1": {
     name: "p-scroll-area-1",
     description: "Basic scroll area",
@@ -8089,6 +8107,24 @@ export const Index: Record<string, any> = {
     categories: ["select"],
     meta: {"className":"**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-64"},
   },
+  "p-select-24": {
+    name: "p-select-24",
+    description: "Color palette select with three-color swatches",
+    type: "registry:block",
+    registryDependencies: ["@coss/select"],
+    files: [{
+      path: "registry/default/particles/p-select-24.tsx",
+      type: "registry:block",
+      target: ""
+    }],
+    component: React.lazy(async () => {
+      const mod = await import("@/registry/default/particles/p-select-24.tsx")
+      const exportName = Object.keys(mod).find(key => typeof mod[key] === 'function' || typeof mod[key] === 'object') || item.name
+      return { default: mod.default || mod[exportName] }
+    }),
+    categories: ["select"],
+    meta: {"className":"**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-64"},
+  },
   "p-select-11": {
     name: "p-select-11",
     description: "Select in form",
```

**File**: `apps/ui/registry/default/particles/p-radio-group-10.tsx` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"use client";
+
+import { RadioGroup, RadioPrimitive } from "@/registry/default/ui/radio-group";
+import {
+  Tooltip,
+  TooltipPopup,
+  TooltipProvider,
+  TooltipTrigger,
+} from "@/registry/default/ui/tooltip";
+
+const palettes = [
+  { label: "Mono", value: "mono", colors: ["#18181B", "#A1A1AA", "#FAFAFA"] },
+  {
+    label: "Porcelain",
+    value: "porcelain",
+    colors: ["#AA8F73", "#C8B79A", "#889FA3"],
+  },
+  { label: "Ember", value: "ember", colors: ["#B94724", "#DB8649", "#EDD0A0"] },
+  { label: "Terra", value: "terra", colors: ["#A64F3C", "#C78F70", "#896577"] },
+  { label: "Rosé", value: "rose", colors: ["#9B3F60", "#C98693", "#E9B9A5"] },
+  { label: "Dusk", value: "dusk", colors: ["#BE835B", "#8E7C9F", "#6E97AE"] },
+  {
+    label: "Orchard",
+    value: "orchard",
+    colors: ["#63794B", "#ADA66B", "#83A18A"],
+  },
+  {
+    label: "Petrol",
+    value: "petrol",
+    colors: ["#326A76", "#C97868", "#C9AD81"],
+  },
+  {
+    label: "Lagoon",
+    value: "lagoon",
+    colors: ["#247E92", "#4CAFA3", "#B6D8C7"],
+  },
+  {
+    label: "Borealis",
+    value: "borealis",
+    colors: ["#267F69", "#527FB8", "#9A83BF"],
+  },
+  {
+    label: "Cobalt",
+    value: "cobalt",
+    colors: ["#244E9A", "#607DA9", "#B5C9DD"],
+  },
+  { label: "Iris", value: "iris", colors: ["#7361A3", "#AC87A5", "#DBC3CA"] },
+];
+
+export default function Particle() {
+  return (
+    <fieldset className="w-full space-y-3">
+      <legend className="font-medium text-sm">Color palette</legend>
+      <TooltipProvider>
+        <RadioGroup
+          aria-label="Color palette"
+          className="grid grid-cols-4 gap-2"
+          defaultValue="dusk"
+        >
+          {palettes.map((palette) => (
+            <Tooltip key={palette.value} disableHoverablePopup>
+              <TooltipTrigger
+                render={
+                  <RadioPrimitive.Root
+                    aria-label={palette.label}
+                    value={palette.value}
+                    className="flex items-center justify-center rounded-lg border p-2.5 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:border-primary/48 data-checked:bg-accent/50"
+                  />
+                }
+              >
+                <span aria-hidden="true" className="flex shrink-0 -space-x-1">
+                  {palette.colors.map((color) => (
+                    <span
+                      key={color}
+                      className="size-4 rounded-full ring-1 ring-background"
+                      style={{ backgroundColor: color }}
+                    />
+                  ))}
+                </span>
+              </TooltipTrigger>
+              <TooltipPopup>{palette.label}</TooltipPopup>
+            </Tooltip>
+          ))}
+        </RadioGroup>
+      </TooltipProvider>
+    </fieldset>
+  );
+}
```

**File**: `apps/ui/registry/default/particles/p-select-24.tsx` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+"use client";
+
+import {
+  Select,
+  SelectItem,
+  SelectLabel,
+  SelectPopup,
+  SelectTrigger,
+  SelectValue,
+} from "@/registry/default/ui/select";
+
+const palettes = [
+  { label: "Mono", value: "mono", colors: ["#18181B", "#A1A1AA", "#FAFAFA"] },
+  {
+    label: "Porcelain",
+    value: "porcelain",
+    colors: ["#AA8F73", "#C8B79A", "#889FA3"],
+  },
+  { label: "Ember", value: "ember", colors: ["#B94724", "#DB8649", "#EDD0A0"] },
+  { label: "Terra", value: "terra", colors: ["#A64F3C", "#C78F70", "#896577"] },
+  { label: "Rosé", value: "rose", colors: ["#9B3F60", "#C98693", "#E9B9A5"] },
+  { label: "Dusk", value: "dusk", colors: ["#BE835B", "#8E7C9F", "#6E97AE"] },
+  {
+    label: "Orchard",
+    value: "orchard",
+    colors: ["#63794B", "#ADA66B", "#83A18A"],
+  },
+  {
+    label: "Petrol",
+    value: "petrol",
+    colors: ["#326A76", "#C97868", "#C9AD81"],
+  },
+  {
+    label: "Lagoon",
+    value: "lagoon",
+    colors: ["#247E92", "#4CAFA3", "#B6D8C7"],
+  },
+  {
+    label: "Borealis",
+    value: "borealis",
+    colors: ["#267F69", "#527FB8", "#9A83BF"],
+  },
+  {
+    label: "Cobalt",
+    value: "cobalt",
+    colors: ["#244E9A", "#607DA9", "#B5C9DD"],
+  },
+  { label: "Iris", value: "iris", colors: ["#7361A3", "#AC87A5", "#DBC3CA"] },
+];
+
+export default function Particle() {
+  return (
+    <Select
+      defaultValue={palettes[5]}
+      items={palettes}
+      itemToStringValue={(palette) => palette.value}
+    >
+      <SelectLabel>Color palette</SelectLabel>
+      <SelectTrigger>
+        <SelectValue>
+          {(palette: (typeof palettes)[number]) => (
+            <span className="flex items-center gap-2">
+              <span aria-hidden="true" className="flex shrink-0 -space-x-1">
+                {palette.colors.map((color) => (
+                  <span
+                    key={color}
+                    className="size-4 rounded-full ring-1 ring-background"
+                    style={{ backgroundColor: color }}
+                  />
+                ))}
+              </span>
+              <span className="truncate">{palette.label}</span>
+            </span>
+          )}
+        </SelectValue>
+      </SelectTrigger>
+      <SelectPopup>
+        {palettes.map((palette) => (
+          <SelectItem key={palette.value} value={palette}>
+            <span className="flex items-center gap-2">
+              <span aria-hidden="true" className="flex shrink-0 -space-x-1">
+                {palette.colors.map((color) => (
+                  <span
+                    key={color}
+                    className="size-4 rounded-full ring-1 ring-background"
+                    style={{ backgroundColor: color }}
+                  />
+                ))}
+              </span>
+              {palette.label}
+            </span>
+          </SelectItem>
+        ))}
+      </SelectPopup>
+    </Select>
+  );
+}
```

**File**: `apps/ui/registry/registry-particles.ts` (modified, +24/-0)
```diff
@@ -4195,6 +4195,18 @@ export const particles: ParticleItem[] = [
     registryDependencies: ["@coss/radio-group", "@coss/segmented-control"],
     type: "registry:block",
   },
+  {
+    categories: categories("radio group", "tooltip"),
+    description: "Color palette radio cards in a four-column grid",
+    files: [{ path: "particles/p-radio-group-10.tsx", type: "registry:block" }],
+    meta: {
+      className:
+        "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-96",
+    },
+    name: "p-radio-group-10",
+    registryDependencies: ["@coss/radio-group", "@coss/tooltip"],
+    type: "registry:block",
+  },
   {
     categories: categories("scroll area"),
     description: "Basic scroll area",
@@ -4505,6 +4517,18 @@ export const particles: ParticleItem[] = [
     registryDependencies: ["@coss/select"],
     type: "registry:block",
   },
+  {
+    categories: categories("select"),
+    description: "Color palette select with three-color swatches",
+    files: [{ path: "particles/p-select-24.tsx", type: "registry:block" }],
+    meta: {
+      className:
+        "**:data-[slot=preview]:w-full **:data-[slot=preview]:max-w-64",
+    },
+    name: "p-select-24",
+    registryDependencies: ["@coss/select"],
+    type: "registry:block",
+  },
   {
     categories: categories("select"),
     description: "Select in form",
```

---

### Incident Patch 3: `59e8c88c` (2026-09-22)
**Commit Message**: feat(ui): update Cal Sans to 2.003 (#853)

Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `packages/ui/src/fonts/README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ export default function RootLayout({ children }) {
 
 ## Available Fonts
 
-- `fontSans` — Cal Sans 2.0 variable font (`CalSansVF.woff2`)
+- `fontSans` — Cal Sans 2.0 variable font (`CalSansVF.woff2` upright, `CalSansVF-Italic.woff2` italic)
 - `fontHeading` — Alias of `fontSans`; use when wiring a separate `--font-heading` variable
 - `fontMono` — Paper Mono for code and monospace UI
 
```

**File**: `packages/ui/src/fonts/index.ts` (modified, +5/-2)
```diff
@@ -8,9 +8,12 @@ export const fontMono = localFont({
 
 export const fontSans = localFont({
   display: "swap",
-  src: "./CalSansVF.woff2",
+  src: [
+    { path: "./CalSansVF.woff2", style: "normal" },
+    { path: "./CalSansVF-Italic.woff2", style: "italic" },
+  ],
   variable: "--font-sans",
-  weight: "300 700",
+  weight: "400 700",
 });
 
 /** Same variable font as `fontSans`; optional when wiring a separate `--font-heading`. */
```

---

### Incident Patch 4: `60b6b444` (2026-09-21)
**Commit Message**: docs(ui): remove the Early Access callout from the Introduction (#852)

Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `apps/ui/content/docs/(root)/index.mdx` (modified, +0/-12)
```diff
@@ -9,18 +9,6 @@ We think Base UI is the best foundation for modern web applications. We've taken
 
 This is the component library we'll be progressively adopting for [Cal.com](https://cal.com). We're building it in the open for anyone who wants to create beautiful, reliable user interfaces.
 
-<Alert className="bg-muted/24">
-  <InfoIcon />
-  <AlertTitle>Early Access</AlertTitle>
-  <AlertDescription>
-    coss ui is currently in early development. We're building this library in
-    the open and actively working on new components and features. Base UI itself
-    is also in beta, so you may encounter breaking changes as both projects
-    evolve. We recommend using this in projects where you're comfortable
-    adapting to changes.
-  </AlertDescription>
-</Alert>
-
 ## How It Works
 
 Our approach is simple: you should own your code. We're inspired by the copy-paste ethos of **shadcn/ui**.
```

---

### Incident Patch 5: `81634815` (2026-09-16)
**Commit Message**: fix(ui): keep drawer close button above drag bar (#851)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/drawer.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/drawer.tsx",
-      "content": "\"use client\";\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\";\nimport { Drawer as DrawerPrimitive } from \"@base-ui/react/drawer\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Radio as RadioPrimitive } from \"@base-ui/react/radio\";\nimport { RadioGroup as RadioGroupPrimitive } from \"@base-ui/react/radio-group\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { ChevronRightIcon, XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { createContext, useContext } from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype DrawerPosition = \"right\" | \"left\" | \"top\" | \"bottom\";\n\nconst DrawerContext: React.Context<{ position: DrawerPosition }> =\n  createContext<{ position: DrawerPosition }>({\n    position: \"bottom\",\n  });\n\nconst directionMap: Record<\n  DrawerPosition,\n  DrawerPrimitive.Root.Props[\"swipeDirection\"]\n> = {\n  bottom: \"down\",\n  left: \"left\",\n  right: \"right\",\n  top: \"up\",\n};\n\nexport const DrawerCreateHandle: typeof DrawerPrimitive.createHandle =\n  DrawerPrimitive.createHandle;\n\nexport function Drawer({\n  swipeDirection,\n  position = \"bottom\",\n  ...props\n}: DrawerPrimitive.Root.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  return (\n    <DrawerContext.Provider value={{ position }}>\n      <DrawerPrimitive.Root\n        swipeDirection={swipeDirection ?? directionMap[position]}\n        {...props}\n      />\n    </DrawerContext.Provider>\n  );\n}\n\nexport const DrawerPortal: typeof DrawerPrimitive.Portal =\n  DrawerPrimitive.Portal;\n\nexport function DrawerTrigger(\n  props: DrawerPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Trigger data-slot=\"drawer-trigger\" {...props} />;\n}\n\nexport function DrawerClose(\n  props: DrawerPrimitive.Close.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Close data-slot=\"drawer-close\" {...props} />;\n}\n\nexport function DrawerSwipeArea({\n  className,\n  position: positionProp,\n  ...props\n}: DrawerPrimitive.SwipeArea.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  const { position: contextPosition } = useContext(DrawerContext);\n  const position = positionProp ?? contextPosition;\n\n  return (\n    <DrawerPrimitive.SwipeArea\n      className={cn(\n        \"fixed z-50 touch-none\",\n        position === \"bottom\" && \"inset-x-0 bottom-0 h-8\",\n        position === \"top\" && \"inset-x-0 top-0 h-8\",\n        position === \"left\" && \"inset-y-0 left-0 w-8\",\n        position === \"right\" && \"inset-y-0 right-0 w-8\",\n        className,\n      )}\n      data-slot=\"drawer-swipe-area\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerBackdrop({\n  className,\n  ...props\n}: DrawerPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DrawerPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-sm transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"drawer-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerViewport({\n  className,\n  position,\n  variant = \"default\",\n  ...props\n}: DrawerPrimitive.Viewport.Props & {\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <DrawerPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]\",\n        \"touch-none\",\n        position === \"bottom\" && \"grid grid-rows-[1fr_auto] pt-12\",\n        position === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        position === \"left\" && \"flex justify-start\",\n        position === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"px-(--inset) sm:[--inset:--spacing(4)]\",\n        variant === \"inset\" && position !== \"bottom\" && \"pt-(--inset)\",\n        variant === \"inset\" && position !== \"top\" && \"pb-(--inset)\",\n        className,\n      )}\n      data-slot=\"drawer-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerPopup({\n  className,\n  children,\n  showCloseButton = false,\n  position: positionProp,\n  variant = \"default\",\n  showBar = false,\n  portalProps,\n  ...props\n}: DrawerPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n  s
```

**File**: `apps/ui/registry/default/ui/drawer.tsx` (modified, +1/-1)
```diff
@@ -214,7 +214,7 @@ export function DrawerPopup({
           {showCloseButton && (
             <DrawerPrimitive.Close
               aria-label="Close"
-              className="absolute end-2 top-2"
+              className="absolute end-2 top-2 z-1"
               render={<Button size="icon" variant="ghost" />}
             >
               <XIcon />
```

**File**: `packages/ui/src/components/drawer.tsx` (modified, +1/-1)
```diff
@@ -214,7 +214,7 @@ export function DrawerPopup({
           {showCloseButton && (
             <DrawerPrimitive.Close
               aria-label="Close"
-              className="absolute end-2 top-2"
+              className="absolute end-2 top-2 z-1"
               render={<Button size="icon" variant="ghost" />}
             >
               <XIcon />
```

---

### Incident Patch 6: `3bab6543` (2026-09-07)
**Commit Message**: chore(ui): define Tailwind CSS compatibility (#847)

**File**: `bun.lock` (modified, +1/-0)
```diff
@@ -200,6 +200,7 @@
       "peerDependencies": {
         "next": "^16.2.5",
         "react": "^19.2.6",
+        "tailwindcss": ">=4.1.17 <5",
       },
     },
   },
```

**File**: `packages/ui/package.json` (modified, +2/-1)
```diff
@@ -39,7 +39,8 @@
   "name": "@coss/ui",
   "peerDependencies": {
     "next": "^16.2.5",
-    "react": "^19.2.6"
+    "react": "^19.2.6",
+    "tailwindcss": ">=4.1.17 <5"
   },
   "scripts": {
     "clean": "rm -rf node_modules",
```

---

### Incident Patch 7: `4b1240be` (2026-09-07)
**Commit Message**: chore(ui): update Base UI to 1.8.0 (#846)

**File**: `apps/ui/content/docs/components/avatar.mdx` (modified, +15/-1)
```diff
@@ -60,6 +60,20 @@ import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
 </Avatar>
 ```
 
+Use `keepMounted` when the image relies on native lazy loading or an optimized image component. The fallback remains visible while the image loads or if it fails:
+
+```tsx
+<Avatar>
+  <AvatarImage
+    src="/avatars/01.png"
+    alt="User avatar"
+    loading="lazy"
+    keepMounted
+  />
+  <AvatarFallback>JD</AvatarFallback>
+</Avatar>
+```
+
 ## API Reference
 
 ### Avatar
@@ -68,7 +82,7 @@ Root component. Styled wrapper for `Avatar.Root` from Base UI with default size
 
 ### AvatarImage
 
-Image element for the avatar. Styled wrapper for `Avatar.Image` from Base UI.
+Image element for the avatar. Styled wrapper for `Avatar.Image` from Base UI with support for `keepMounted` images.
 
 ### AvatarFallback
 
```

**File**: `apps/ui/content/docs/components/combobox.mdx` (modified, +32/-1)
```diff
@@ -59,6 +59,7 @@ import {
   ComboboxItem,
   ComboboxList,
   ComboboxPopup,
+  createComboboxItems,
 } from "@/components/ui/combobox"
 ```
 
@@ -81,6 +82,33 @@ const items = [
 </Combobox>
 ```
 
+When your source items are objects but selection should use a stable primitive value, create a typed collection with `createComboboxItems`:
+
+```tsx
+const users = [
+  { id: "ada", name: "Ada Lovelace" },
+  { id: "grace", name: "Grace Hopper" },
+]
+
+const userItems = createComboboxItems(users, {
+  getLabel: (user) => user.name,
+  getValue: (user) => user.id,
+})
+
+<Combobox defaultValue="ada" items={userItems}>
+  <ComboboxInput placeholder="Select a user..." />
+  <ComboboxPopup>
+    <ComboboxList>
+      {(user) => (
+        <ComboboxItem key={user.id} value={user.id}>
+          {user.name}
+        </ComboboxItem>
+      )}
+    </ComboboxList>
+  </ComboboxPopup>
+</Combobox>
+```
+
 ### Multiple Selection
 
 ```tsx
@@ -145,6 +173,10 @@ The root combobox component. Manages the combobox state and provides context to
 | `open`     | `boolean`                               | Controls whether the popup is open                |
 | `...props` | `React.ComponentProps<typeof Combobox>` | All Base UI Combobox props are supported          |
 
+### createComboboxItems
+
+Creates a typed item collection that derives primitive selection values and labels from object items. Define static collections outside components and memoize dynamic collections.
+
 ### ComboboxInput
 
 The input field component for single selection mode with extended features for size variants and addon support.
@@ -328,4 +360,3 @@ Use `SelectButton` as a `render` prop on `ComboboxTrigger` to make the combobox
 ### Form Integration - Multiple
 
 <ComponentPreview name="p-combobox-12" />
-
```

**File**: `apps/ui/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "dependencies": {
-    "@base-ui/react": "1.6.0",
+    "@base-ui/react": "1.8.0",
     "@coss/ui": "workspace:*",
     "@daypicker/react": "10.0.1",
     "@hugeicons/core-free-icons": "^2.0.0",
```

**File**: `apps/ui/public/r/avatar.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/avatar.tsx",
-      "content": "\"use client\";\n\nimport { Avatar as AvatarPrimitive } from \"@base-ui/react/avatar\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport function Avatar({\n  className,\n  ...props\n}: AvatarPrimitive.Root.Props): React.ReactElement {\n  return (\n    <AvatarPrimitive.Root\n      className={cn(\n        \"inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium text-xs\",\n        className,\n      )}\n      data-slot=\"avatar\"\n      {...props}\n    />\n  );\n}\n\nexport function AvatarImage({\n  className,\n  ...props\n}: AvatarPrimitive.Image.Props): React.ReactElement {\n  return (\n    <AvatarPrimitive.Image\n      className={cn(\"size-full object-cover\", className)}\n      data-slot=\"avatar-image\"\n      {...props}\n    />\n  );\n}\n\nexport function AvatarFallback({\n  className,\n  ...props\n}: AvatarPrimitive.Fallback.Props): React.ReactElement {\n  return (\n    <AvatarPrimitive.Fallback\n      className={cn(\n        \"flex size-full items-center justify-center rounded-full bg-muted\",\n        className,\n      )}\n      data-slot=\"avatar-fallback\"\n      {...props}\n    />\n  );\n}\n\nexport { AvatarPrimitive };\n",
+      "content": "\"use client\";\n\nimport { Avatar as AvatarPrimitive } from \"@base-ui/react/avatar\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport function Avatar({\n  className,\n  ...props\n}: AvatarPrimitive.Root.Props): React.ReactElement {\n  return (\n    <AvatarPrimitive.Root\n      className={cn(\n        \"relative isolate inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium text-xs\",\n        className,\n      )}\n      data-slot=\"avatar\"\n      {...props}\n    />\n  );\n}\n\nexport function AvatarImage({\n  className,\n  ...props\n}: AvatarPrimitive.Image.Props): React.ReactElement {\n  return (\n    <AvatarPrimitive.Image\n      className={cn(\n        \"absolute inset-0 z-10 size-full object-cover data-error:invisible data-loading:invisible\",\n        className,\n      )}\n      data-slot=\"avatar-image\"\n      {...props}\n    />\n  );\n}\n\nexport function AvatarFallback({\n  className,\n  ...props\n}: AvatarPrimitive.Fallback.Props): React.ReactElement {\n  return (\n    <AvatarPrimitive.Fallback\n      className={cn(\n        \"absolute inset-0 flex size-full items-center justify-center rounded-full bg-muted\",\n        className,\n      )}\n      data-slot=\"avatar-fallback\"\n      {...props}\n    />\n  );\n}\n\nexport { AvatarPrimitive };\n",
       "type": "registry:ui"
     }
   ],
```

**File**: `apps/ui/public/r/combobox.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/combobox.tsx",
-      "content": "\"use client\";\n\nimport { Combobox as ComboboxPrimitive } from \"@base-ui/react/combobox\";\nimport { ChevronsUpDownIcon, XIcon } from \"lucide-react\";\nimport * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Input } from \"@/registry/default/ui/input\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const ComboboxContext: React.Context<{\n  chipsRef: React.RefObject<Element | null> | null;\n  multiple: boolean;\n}> = React.createContext<{\n  chipsRef: React.RefObject<Element | null> | null;\n  multiple: boolean;\n}>({\n  chipsRef: null,\n  multiple: false,\n});\n\nexport function Combobox<Value, Multiple extends boolean | undefined = false>(\n  props: ComboboxPrimitive.Root.Props<Value, Multiple>,\n): React.ReactElement {\n  const chipsRef = React.useRef<Element | null>(null);\n  return (\n    <ComboboxContext.Provider value={{ chipsRef, multiple: !!props.multiple }}>\n      <ComboboxPrimitive.Root {...props} />\n    </ComboboxContext.Provider>\n  );\n}\n\nexport function ComboboxChipsInput({\n  className,\n  size,\n  ...props\n}: Omit<ComboboxPrimitive.Input.Props, \"size\"> & {\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  ref?: React.Ref<HTMLInputElement>;\n}): React.ReactElement {\n  const sizeValue = (size ?? \"default\") as \"sm\" | \"default\" | \"lg\" | number;\n\n  return (\n    <ComboboxPrimitive.Input\n      className={cn(\n        \"min-w-12 flex-1 text-base text-foreground outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5\",\n        sizeValue === \"sm\" ? \"ps-1.5\" : \"ps-2\",\n        className,\n      )}\n      data-size={typeof sizeValue === \"string\" ? sizeValue : undefined}\n      data-slot=\"combobox-chips-input\"\n      size={typeof sizeValue === \"number\" ? sizeValue : undefined}\n      {...props}\n    />\n  );\n}\n\nexport function ComboboxInput({\n  className,\n  showTrigger = true,\n  showClear = false,\n  startAddon,\n  size,\n  triggerProps,\n  clearProps,\n  ...props\n}: Omit<ComboboxPrimitive.Input.Props, \"size\"> & {\n  showTrigger?: boolean;\n  showClear?: boolean;\n  startAddon?: React.ReactNode;\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  ref?: React.Ref<HTMLInputElement>;\n  triggerProps?: ComboboxPrimitive.Trigger.Props;\n  clearProps?: ComboboxPrimitive.Clear.Props;\n}): React.ReactElement {\n  const sizeValue = (size ?? \"default\") as \"sm\" | \"default\" | \"lg\" | number;\n\n  return (\n    <ComboboxPrimitive.InputGroup\n      className=\"relative not-has-[>*.w-full]:w-fit w-full text-foreground has-disabled:opacity-64\"\n      data-slot=\"combobox-input-group\"\n    >\n      {startAddon && (\n        <div\n          aria-hidden=\"true\"\n          className=\"pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5\"\n          data-slot=\"combobox-start-addon\"\n        >\n          {startAddon}\n        </div>\n      )}\n      <ComboboxPrimitive.Input\n        className={cn(\n          startAddon &&\n            \"data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7.5)-1px)] *:data-[slot=combobox-input]:ps-[calc(--spacing(8.5)-1px)] sm:data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7)-1px)] sm:*:data-[slot=combobox-input]:ps-[calc(--spacing(8)-1px)]\",\n          sizeValue === \"sm\"\n            ? \"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-6.5\"\n            : \"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-7\",\n          className,\n        )}\n        data-slot=\"combobox-input\"\n        render={\n          <Input\n            className=\"has-disabled:opacity-100\"\n            nativeInput\n            size={sizeValue}\n          />\n        }\n        {...props}\n      />\n      {showTrigger && (\n        <ComboboxTrigger\n          className={cn(\n            \"absolute top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-opacity pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=combobox-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n            sizeValue === \"sm\" ? \"end-0\" : \"end-0.5\",\n          )}\n          {...triggerProps}\n        >\n          <ComboboxPrimitive.Icon data-slot=\"combobox-icon\">\n            <ChevronsUpDownIcon />\n          </ComboboxPrimitive.Icon>\n        </ComboboxTrigger>\n      )}\n      {show
```

**File**: `apps/ui/registry/default/ui/avatar.tsx` (modified, +6/-3)
```diff
@@ -11,7 +11,7 @@ export function Avatar({
   return (
     <AvatarPrimitive.Root
       className={cn(
-        "inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium text-xs",
+        "relative isolate inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium text-xs",
         className,
       )}
       data-slot="avatar"
@@ -26,7 +26,10 @@ export function AvatarImage({
 }: AvatarPrimitive.Image.Props): React.ReactElement {
   return (
     <AvatarPrimitive.Image
-      className={cn("size-full object-cover", className)}
+      className={cn(
+        "absolute inset-0 z-10 size-full object-cover data-error:invisible data-loading:invisible",
+        className,
+      )}
       data-slot="avatar-image"
       {...props}
     />
@@ -40,7 +43,7 @@ export function AvatarFallback({
   return (
     <AvatarPrimitive.Fallback
       className={cn(
-        "flex size-full items-center justify-center rounded-full bg-muted",
+        "absolute inset-0 flex size-full items-center justify-center rounded-full bg-muted",
         className,
       )}
       data-slot="avatar-fallback"
```

**File**: `apps/ui/registry/default/ui/combobox.tsx` (modified, +9/-2)
```diff
@@ -18,8 +18,12 @@ export const ComboboxContext: React.Context<{
   multiple: false,
 });
 
-export function Combobox<Value, Multiple extends boolean | undefined = false>(
-  props: ComboboxPrimitive.Root.Props<Value, Multiple>,
+export function Combobox<
+  Value,
+  Multiple extends boolean | undefined = false,
+  Item = Value,
+>(
+  props: ComboboxPrimitive.Root.Props<Value, Multiple, Item>,
 ): React.ReactElement {
   const chipsRef = React.useRef<Element | null>(null);
   return (
@@ -429,6 +433,9 @@ export function ComboboxChipRemove(
   );
 }
 
+export const createComboboxItems: typeof ComboboxPrimitive.createItems =
+  ComboboxPrimitive.createItems;
+
 export const useComboboxFilter: typeof ComboboxPrimitive.useFilter =
   ComboboxPrimitive.useFilter;
 
```

**File**: `apps/ui/skills/coss/references/primitives/avatar.md` (modified, +2/-0)
```diff
@@ -32,6 +32,8 @@ import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
 </Avatar>
 ```
 
+Use `keepMounted` on `AvatarImage` when the image relies on native lazy loading or an optimized image component. The image and fallback are layered so the fallback remains visible while the image loads or if it fails.
+
 ## Patterns from coss particles
 
 ### Key patterns
```

---

### Incident Patch 8: `705cb737` (2026-09-05)
**Commit Message**: fix(toast): keep anchored toasts above later-opened popovers (#845)

* fix(toast): keep anchored toasts above later-opened popovers

The anchored toast portal stays mounted at z-50, so a popover opened afterward stacks on top of it.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* change z-index

* build reg

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/toast.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
   "files": [
     {
       "path": "registry/default/ui/toast.tsx",
-      "content": "\"use client\";\n\nimport { Toast } from \"@base-ui/react/toast\";\nimport {\n  CircleAlertIcon,\n  CircleCheckIcon,\n  InfoIcon,\n  LoaderCircleIcon,\n  TriangleAlertIcon,\n} from \"lucide-react\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { buttonVariants } from \"@/registry/default/ui/button\";\n\nconst TOAST_ICONS = {\n  error: CircleAlertIcon,\n  info: InfoIcon,\n  loading: LoaderCircleIcon,\n  success: CircleCheckIcon,\n  warning: TriangleAlertIcon,\n} as const;\n\ntype SwipeDirection = \"up\" | \"down\" | \"left\" | \"right\";\n\ntype ToastData = {\n  rootProps?: Omit<\n    React.ComponentProps<typeof Toast.Root>,\n    \"children\" | \"className\" | \"swipeDirection\" | \"toast\"\n  >;\n  tooltipStyle?: boolean;\n};\n\nfunction getSwipeDirection(position: ToastPosition): SwipeDirection[] {\n  const verticalDirection: SwipeDirection = position.startsWith(\"top\")\n    ? \"up\"\n    : \"down\";\n\n  if (position.includes(\"center\")) {\n    return [verticalDirection];\n  }\n\n  if (position.includes(\"left\")) {\n    return [\"left\", verticalDirection];\n  }\n\n  return [\"right\", verticalDirection];\n}\n\nfunction upsertReplayClassName(toast: {\n  type?: string;\n  updateKey?: number;\n}): string | undefined {\n  const k = toast.updateKey ?? 0;\n  if (k <= 0) return undefined;\n  const isEven = k % 2 === 0;\n  if (toast.type === \"error\") {\n    return isEven ? \"animate-toast-error-even\" : \"animate-toast-error-odd\";\n  }\n  return isEven ? \"animate-toast-success-even\" : \"animate-toast-success-odd\";\n}\n\nfunction Toasts({\n  position,\n  portalProps,\n}: {\n  position: ToastPosition;\n  portalProps?: React.ComponentProps<typeof Toast.Portal>;\n}): React.ReactElement {\n  const { toasts } = Toast.useToastManager();\n  const swipeDirection = getSwipeDirection(position);\n\n  return (\n    <Toast.Portal data-slot=\"toast-portal\" {...portalProps}>\n      <Toast.Viewport\n        className={cn(\n          \"fixed z-60 mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]\",\n          // Vertical positioning\n          \"data-[position*=top]:top-(--toast-inset)\",\n          \"data-[position*=bottom]:bottom-(--toast-inset)\",\n          // Horizontal positioning\n          \"data-[position*=left]:left-(--toast-inset)\",\n          \"data-[position*=right]:right-(--toast-inset)\",\n          \"data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2\",\n        )}\n        data-position={position}\n        data-slot=\"toast-viewport\"\n      >\n        {toasts.map((toast) => {\n          const Icon = toast.type\n            ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS]\n            : null;\n          const toastData = toast.data as ToastData | undefined;\n\n          return (\n            <Toast.Root\n              key={toast.id}\n              className={cn(\n                \"absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full select-none rounded-lg border bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(1%*max(0,var(--toast-index,0))))] not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 [transition:transform_.5s_cubic-bezier(.22,1,.36,1),opacity_.5s,height_.15s,background-color_.5s] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-expanded:bg-popover dark:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(6%*max(0,var(--toast-index,0))))] dark:data-expanded:bg-popover dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n                // Base positioning using data-position\n                \"data-[position*=right]:right-0 data-[position*=right]:left-auto\",\n                \"data-[position*=left]:right-auto data-[position*=left]:left-0\",\n                \"data-[position*=center]:right-0 data-[position*=center]:left-0\",\n                \"data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-[50%_calc(50%-50%*min(var(--toast-index,0),1))]\",\n                \"data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-[50%_calc(50%+50%*min(var(--toast-index,0),1))]\",\n                // Gap fill for hover\n                \"after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full\",\n                \"data-[position*=top]:after:top-full\",\n                \"data-[position*=bottom]:after:bottom-full\",\n                // Define some variables\n                \"[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]\",\
```

**File**: `apps/ui/registry/default/ui/toast.tsx` (modified, +1/-1)
```diff
@@ -209,7 +209,7 @@ function AnchoredToasts({
           return (
             <Toast.Positioner
               key={toast.id}
-              className="z-50 max-w-[min(--spacing(64),var(--available-width))]"
+              className="z-60 max-w-[min(--spacing(64),var(--available-width))]"
               data-slot="toast-positioner"
               sideOffset={positionerProps.sideOffset ?? 4}
               toast={toast}
```

**File**: `packages/ui/src/components/toast.tsx` (modified, +1/-1)
```diff
@@ -209,7 +209,7 @@ function AnchoredToasts({
           return (
             <Toast.Positioner
               key={toast.id}
-              className="z-50 max-w-[min(--spacing(64),var(--available-width))]"
+              className="z-60 max-w-[min(--spacing(64),var(--available-width))]"
               data-slot="toast-positioner"
               sideOffset={positionerProps.sideOffset ?? 4}
               toast={toast}
```

---

### Incident Patch 9: `758e6535` (2026-08-31)
**Commit Message**: fix(ui): contain long item labels (#842)

**File**: `apps/ui/public/r/combobox.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/combobox.tsx",
-      "content": "\"use client\";\n\nimport { Combobox as ComboboxPrimitive } from \"@base-ui/react/combobox\";\nimport { ChevronsUpDownIcon, XIcon } from \"lucide-react\";\nimport * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Input } from \"@/registry/default/ui/input\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const ComboboxContext: React.Context<{\n  chipsRef: React.RefObject<Element | null> | null;\n  multiple: boolean;\n}> = React.createContext<{\n  chipsRef: React.RefObject<Element | null> | null;\n  multiple: boolean;\n}>({\n  chipsRef: null,\n  multiple: false,\n});\n\nexport function Combobox<Value, Multiple extends boolean | undefined = false>(\n  props: ComboboxPrimitive.Root.Props<Value, Multiple>,\n): React.ReactElement {\n  const chipsRef = React.useRef<Element | null>(null);\n  return (\n    <ComboboxContext.Provider value={{ chipsRef, multiple: !!props.multiple }}>\n      <ComboboxPrimitive.Root {...props} />\n    </ComboboxContext.Provider>\n  );\n}\n\nexport function ComboboxChipsInput({\n  className,\n  size,\n  ...props\n}: Omit<ComboboxPrimitive.Input.Props, \"size\"> & {\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  ref?: React.Ref<HTMLInputElement>;\n}): React.ReactElement {\n  const sizeValue = (size ?? \"default\") as \"sm\" | \"default\" | \"lg\" | number;\n\n  return (\n    <ComboboxPrimitive.Input\n      className={cn(\n        \"min-w-12 flex-1 text-base text-foreground outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5\",\n        sizeValue === \"sm\" ? \"ps-1.5\" : \"ps-2\",\n        className,\n      )}\n      data-size={typeof sizeValue === \"string\" ? sizeValue : undefined}\n      data-slot=\"combobox-chips-input\"\n      size={typeof sizeValue === \"number\" ? sizeValue : undefined}\n      {...props}\n    />\n  );\n}\n\nexport function ComboboxInput({\n  className,\n  showTrigger = true,\n  showClear = false,\n  startAddon,\n  size,\n  triggerProps,\n  clearProps,\n  ...props\n}: Omit<ComboboxPrimitive.Input.Props, \"size\"> & {\n  showTrigger?: boolean;\n  showClear?: boolean;\n  startAddon?: React.ReactNode;\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  ref?: React.Ref<HTMLInputElement>;\n  triggerProps?: ComboboxPrimitive.Trigger.Props;\n  clearProps?: ComboboxPrimitive.Clear.Props;\n}): React.ReactElement {\n  const sizeValue = (size ?? \"default\") as \"sm\" | \"default\" | \"lg\" | number;\n\n  return (\n    <ComboboxPrimitive.InputGroup\n      className=\"relative not-has-[>*.w-full]:w-fit w-full text-foreground has-disabled:opacity-64\"\n      data-slot=\"combobox-input-group\"\n    >\n      {startAddon && (\n        <div\n          aria-hidden=\"true\"\n          className=\"pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5\"\n          data-slot=\"combobox-start-addon\"\n        >\n          {startAddon}\n        </div>\n      )}\n      <ComboboxPrimitive.Input\n        className={cn(\n          startAddon &&\n            \"data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7.5)-1px)] *:data-[slot=combobox-input]:ps-[calc(--spacing(8.5)-1px)] sm:data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7)-1px)] sm:*:data-[slot=combobox-input]:ps-[calc(--spacing(8)-1px)]\",\n          sizeValue === \"sm\"\n            ? \"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-6.5\"\n            : \"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-7\",\n          className,\n        )}\n        data-slot=\"combobox-input\"\n        render={\n          <Input\n            className=\"has-disabled:opacity-100\"\n            nativeInput\n            size={sizeValue}\n          />\n        }\n        {...props}\n      />\n      {showTrigger && (\n        <ComboboxTrigger\n          className={cn(\n            \"absolute top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-opacity pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=combobox-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n            sizeValue === \"sm\" ? \"end-0\" : \"end-0.5\",\n          )}\n          {...triggerProps}\n        >\n          <ComboboxPrimitive.Icon data-slot=\"combobox-icon\">\n            <ChevronsUpDownIcon />\n          </ComboboxPrimitive.Icon>\n        </ComboboxTrigger>\n      )}\n      {show
```

**File**: `apps/ui/public/r/drawer.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/drawer.tsx",
-      "content": "\"use client\";\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\";\nimport { Drawer as DrawerPrimitive } from \"@base-ui/react/drawer\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Radio as RadioPrimitive } from \"@base-ui/react/radio\";\nimport { RadioGroup as RadioGroupPrimitive } from \"@base-ui/react/radio-group\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { ChevronRightIcon, XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { createContext, useContext } from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype DrawerPosition = \"right\" | \"left\" | \"top\" | \"bottom\";\n\nconst DrawerContext: React.Context<{ position: DrawerPosition }> =\n  createContext<{ position: DrawerPosition }>({\n    position: \"bottom\",\n  });\n\nconst directionMap: Record<\n  DrawerPosition,\n  DrawerPrimitive.Root.Props[\"swipeDirection\"]\n> = {\n  bottom: \"down\",\n  left: \"left\",\n  right: \"right\",\n  top: \"up\",\n};\n\nexport const DrawerCreateHandle: typeof DrawerPrimitive.createHandle =\n  DrawerPrimitive.createHandle;\n\nexport function Drawer({\n  swipeDirection,\n  position = \"bottom\",\n  ...props\n}: DrawerPrimitive.Root.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  return (\n    <DrawerContext.Provider value={{ position }}>\n      <DrawerPrimitive.Root\n        swipeDirection={swipeDirection ?? directionMap[position]}\n        {...props}\n      />\n    </DrawerContext.Provider>\n  );\n}\n\nexport const DrawerPortal: typeof DrawerPrimitive.Portal =\n  DrawerPrimitive.Portal;\n\nexport function DrawerTrigger(\n  props: DrawerPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Trigger data-slot=\"drawer-trigger\" {...props} />;\n}\n\nexport function DrawerClose(\n  props: DrawerPrimitive.Close.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Close data-slot=\"drawer-close\" {...props} />;\n}\n\nexport function DrawerSwipeArea({\n  className,\n  position: positionProp,\n  ...props\n}: DrawerPrimitive.SwipeArea.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  const { position: contextPosition } = useContext(DrawerContext);\n  const position = positionProp ?? contextPosition;\n\n  return (\n    <DrawerPrimitive.SwipeArea\n      className={cn(\n        \"fixed z-50 touch-none\",\n        position === \"bottom\" && \"inset-x-0 bottom-0 h-8\",\n        position === \"top\" && \"inset-x-0 top-0 h-8\",\n        position === \"left\" && \"inset-y-0 left-0 w-8\",\n        position === \"right\" && \"inset-y-0 right-0 w-8\",\n        className,\n      )}\n      data-slot=\"drawer-swipe-area\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerBackdrop({\n  className,\n  ...props\n}: DrawerPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DrawerPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-sm transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"drawer-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerViewport({\n  className,\n  position,\n  variant = \"default\",\n  ...props\n}: DrawerPrimitive.Viewport.Props & {\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <DrawerPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]\",\n        \"touch-none\",\n        position === \"bottom\" && \"grid grid-rows-[1fr_auto] pt-12\",\n        position === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        position === \"left\" && \"flex justify-start\",\n        position === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"px-(--inset) sm:[--inset:--spacing(4)]\",\n        variant === \"inset\" && position !== \"bottom\" && \"pt-(--inset)\",\n        variant === \"inset\" && position !== \"top\" && \"pb-(--inset)\",\n        className,\n      )}\n      data-slot=\"drawer-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerPopup({\n  className,\n  children,\n  showCloseButton = false,\n  position: positionProp,\n  variant = \"default\",\n  showBar = false,\n  portalProps,\n  ...props\n}: DrawerPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n  s
```

**File**: `apps/ui/public/r/select.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/select.tsx",
-      "content": "\"use client\";\n\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Select as SelectPrimitive } from \"@base-ui/react/select\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { cva, type VariantProps } from \"class-variance-authority\";\nimport {\n  ChevronDownIcon,\n  ChevronsUpDownIcon,\n  ChevronUpIcon,\n} from \"lucide-react\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport const Select: typeof SelectPrimitive.Root = SelectPrimitive.Root;\n\nexport const selectTriggerVariants = cva(\n  \"relative inline-flex min-h-9 w-full min-w-36 select-none items-center justify-between gap-2 rounded-lg border border-input bg-background not-dark:bg-clip-padding px-[calc(--spacing(3)-1px)] text-left text-base text-foreground shadow-xs/5 outline-none ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-visible:not-aria-invalid:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-visible:not-aria-invalid:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-visible,[aria-invalid],[data-pressed]]:shadow-none\",\n  {\n    defaultVariants: {\n      size: \"default\",\n    },\n    variants: {\n      size: {\n        default: \"\",\n        lg: \"min-h-10 sm:min-h-9\",\n        sm: \"min-h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:min-h-7\",\n      },\n    },\n  },\n);\n\nexport const selectTriggerIconClassName = \"-me-1 size-4.5 opacity-80 sm:size-4\";\n\nexport interface SelectButtonProps extends useRender.ComponentProps<\"button\"> {\n  size?: VariantProps<typeof selectTriggerVariants>[\"size\"];\n}\n\nexport function SelectButton({\n  className,\n  size,\n  render,\n  children,\n  ...props\n}: SelectButtonProps): React.ReactElement {\n  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>[\"type\"] =\n    render ? undefined : \"button\";\n\n  const defaultProps = {\n    children: (\n      <>\n        <span className=\"flex-1 truncate in-data-placeholder:text-muted-foreground/72\">\n          {children}\n        </span>\n        <ChevronsUpDownIcon className={selectTriggerIconClassName} />\n      </>\n    ),\n    className: cn(selectTriggerVariants({ size }), \"min-w-0\", className),\n    \"data-slot\": \"select-button\",\n    type: typeValue,\n  };\n\n  return useRender({\n    defaultTagName: \"button\",\n    props: mergeProps<\"button\">(defaultProps, props),\n    render,\n  });\n}\n\nexport function SelectTrigger({\n  className,\n  size = \"default\",\n  children,\n  ...props\n}: SelectPrimitive.Trigger.Props &\n  VariantProps<typeof selectTriggerVariants>): React.ReactElement {\n  return (\n    <SelectPrimitive.Trigger\n      className={cn(selectTriggerVariants({ size }), className)}\n      data-slot=\"select-trigger\"\n      {...props}\n    >\n      {children}\n      <SelectPrimitive.Icon data-slot=\"select-icon\">\n        <ChevronsUpDownIcon className={selectTriggerIconClassName} />\n      </SelectPrimitive.Icon>\n    </SelectPrimitive.Trigger>\n  );\n}\n\nexport function SelectValue({\n  className,\n  ...props\n}: SelectPrimitive.Value.Props): React.ReactElement {\n  return (\n    <SelectPrimitive.Value\n      className={cn(\n        \"flex-1 truncate data-placeholder:text-muted-foreground\",\n        className,\n      )}\n      data-slot=\"select-value\"\n      {...props}\n    />\n  );\n}\n\nexport function SelectPopup({\n  className,\n  children,\n  side = \"bottom\",\n  sideOffset = 4,\n  align = \"start\",\n  alignOffset = 0,\n  alignItemWithTrigger = true,\n  anchor,\n  portalProps,\n  ...props\n}: SelectPrimitive.Popup.Props & {\n  portalProps?: SelectPrimitive.Portal.Props;\n  side?: SelectPrimitive.Positioner.Props[\"side\"];\n  sideOffset?: SelectPrimitive.Positioner.Props[\"sideOffset\"];\n  align?: SelectPrimitive.Positioner.Props[\"align\"];\n  alignOffset?: SelectPrimitive.Positioner.Props[\"alignOffset\"];\n  alignItemWithTrigger?: SelectPrimitive.Positioner.Props[\"alignItemWithTrigger\"];\n  anchor?: SelectPrimitive.Positioner.Props[\"anchor\"];\n}): React.ReactElement {\n  return (\n    <SelectPrimitive.Portal {...portalProps}>\n      <Sel
```

**File**: `apps/ui/registry/default/ui/combobox.tsx` (modified, +2/-2)
```diff
@@ -210,7 +210,7 @@ export function ComboboxItem({
   return (
     <ComboboxPrimitive.Item
       className={cn(
-        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
+        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
         className,
       )}
       data-slot="combobox-item"
@@ -232,7 +232,7 @@ export function ComboboxItem({
           <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
         </svg>
       </ComboboxPrimitive.ItemIndicator>
-      <div className="col-start-2">{children}</div>
+      <div className="wrap-anywhere col-start-2 min-w-0">{children}</div>
     </ComboboxPrimitive.Item>
   );
 }
```

**File**: `apps/ui/registry/default/ui/drawer.tsx` (modified, +6/-6)
```diff
@@ -527,8 +527,8 @@ export function DrawerMenuCheckboxItem({
       className={cn(
         "grid min-h-9 w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
         variant === "switch"
-          ? "grid-cols-[1fr_auto] gap-4 pe-1.5"
-          : "grid-cols-[1rem_1fr] pe-4",
+          ? "grid-cols-[minmax(0,1fr)_auto] gap-4 pe-1.5"
+          : "grid-cols-[1rem_minmax(0,1fr)] pe-4",
         className,
       )}
       data-slot="drawer-menu-checkbox-item"
@@ -540,7 +540,7 @@ export function DrawerMenuCheckboxItem({
     >
       {variant === "switch" ? (
         <>
-          <span className="col-start-1">{children}</span>
+          <span className="wrap-anywhere col-start-1 min-w-0">{children}</span>
           <CheckboxPrimitive.Indicator
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] col-start-2 inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
@@ -565,7 +565,7 @@ export function DrawerMenuCheckboxItem({
               <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
             </svg>
           </CheckboxPrimitive.Indicator>
-          <span className="col-start-2">{children}</span>
+          <span className="wrap-anywhere col-start-2 min-w-0">{children}</span>
         </>
       )}
     </CheckboxPrimitive.Root>
@@ -600,7 +600,7 @@ export function DrawerMenuRadioItem({
     <RadioPrimitive.Root
       className={cn(
         "grid min-h-9 w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
-        "grid-cols-[1rem_1fr] items-center pe-4",
+        "grid-cols-[1rem_minmax(0,1fr)] items-center pe-4",
         className,
       )}
       data-slot="drawer-menu-radio-item"
@@ -624,7 +624,7 @@ export function DrawerMenuRadioItem({
           <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
         </svg>
       </RadioPrimitive.Indicator>
-      <span className="col-start-2">{children}</span>
+      <span className="wrap-anywhere col-start-2 min-w-0">{children}</span>
     </RadioPrimitive.Root>
   );
 }
```

**File**: `apps/ui/registry/default/ui/select.tsx` (modified, +2/-2)
```diff
@@ -178,7 +178,7 @@ export function SelectItem({
   return (
     <SelectPrimitive.Item
       className={cn(
-        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
+        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
         className,
       )}
       data-slot="select-item"
@@ -200,7 +200,7 @@ export function SelectItem({
           <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
         </svg>
       </SelectPrimitive.ItemIndicator>
-      <SelectPrimitive.ItemText className="col-start-2 min-w-0">
+      <SelectPrimitive.ItemText className="wrap-anywhere col-start-2 min-w-0">
         {children}
       </SelectPrimitive.ItemText>
     </SelectPrimitive.Item>
```

**File**: `packages/ui/src/components/combobox.tsx` (modified, +2/-2)
```diff
@@ -210,7 +210,7 @@ export function ComboboxItem({
   return (
     <ComboboxPrimitive.Item
       className={cn(
-        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
+        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
         className,
       )}
       data-slot="combobox-item"
@@ -232,7 +232,7 @@ export function ComboboxItem({
           <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
         </svg>
       </ComboboxPrimitive.ItemIndicator>
-      <div className="col-start-2">{children}</div>
+      <div className="wrap-anywhere col-start-2 min-w-0">{children}</div>
     </ComboboxPrimitive.Item>
   );
 }
```

**File**: `packages/ui/src/components/drawer.tsx` (modified, +6/-6)
```diff
@@ -527,8 +527,8 @@ export function DrawerMenuCheckboxItem({
       className={cn(
         "grid min-h-9 w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
         variant === "switch"
-          ? "grid-cols-[1fr_auto] gap-4 pe-1.5"
-          : "grid-cols-[1rem_1fr] pe-4",
+          ? "grid-cols-[minmax(0,1fr)_auto] gap-4 pe-1.5"
+          : "grid-cols-[1rem_minmax(0,1fr)] pe-4",
         className,
       )}
       data-slot="drawer-menu-checkbox-item"
@@ -540,7 +540,7 @@ export function DrawerMenuCheckboxItem({
     >
       {variant === "switch" ? (
         <>
-          <span className="col-start-1">{children}</span>
+          <span className="wrap-anywhere col-start-1 min-w-0">{children}</span>
           <CheckboxPrimitive.Indicator
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] col-start-2 inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
@@ -565,7 +565,7 @@ export function DrawerMenuCheckboxItem({
               <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
             </svg>
           </CheckboxPrimitive.Indicator>
-          <span className="col-start-2">{children}</span>
+          <span className="wrap-anywhere col-start-2 min-w-0">{children}</span>
         </>
       )}
     </CheckboxPrimitive.Root>
@@ -600,7 +600,7 @@ export function DrawerMenuRadioItem({
     <RadioPrimitive.Root
       className={cn(
         "grid min-h-9 w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
-        "grid-cols-[1rem_1fr] items-center pe-4",
+        "grid-cols-[1rem_minmax(0,1fr)] items-center pe-4",
         className,
       )}
       data-slot="drawer-menu-radio-item"
@@ -624,7 +624,7 @@ export function DrawerMenuRadioItem({
           <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
         </svg>
       </RadioPrimitive.Indicator>
-      <span className="col-start-2">{children}</span>
+      <span className="wrap-anywhere col-start-2 min-w-0">{children}</span>
     </RadioPrimitive.Root>
   );
 }
```

---

### Incident Patch 10: `4ebe375c` (2026-08-29)
**Commit Message**: fix(input-group): ignore portaled descendant events (#833)

**File**: `apps/ui/public/r/input-group.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "registry/default/ui/input-group.tsx",
-      "content": "\"use client\";\n\nimport { cva, type VariantProps } from \"class-variance-authority\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Input, type InputProps } from \"@/registry/default/ui/input\";\nimport { Textarea, type TextareaProps } from \"@/registry/default/ui/textarea\";\n\nconst inputGroupAddonVariants = cva(\n  \"flex h-auto cursor-text select-none items-center justify-center gap-2 [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80\",\n  {\n    defaultVariants: {\n      align: \"inline-start\",\n    },\n    variants: {\n      align: {\n        \"block-end\":\n          \"order-last w-full justify-start px-[calc(--spacing(3)-1px)] pb-[calc(--spacing(3)-1px)] [.border-t]:pt-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]\",\n        \"block-start\":\n          \"order-first w-full justify-start px-[calc(--spacing(3)-1px)] pt-[calc(--spacing(3)-1px)] [.border-b]:pb-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]\",\n        \"inline-end\":\n          \"order-last pe-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-me-1.5 has-[>button]:-me-2 has-[>kbd:last-child]:me-[-0.35rem] [[data-size=sm]+&]:pe-[calc(--spacing(2.5)-1px)]\",\n        \"inline-start\":\n          \"order-first ps-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-ms-1.5 has-[>button]:-ms-2 has-[>kbd:last-child]:ms-[-0.35rem] [[data-size=sm]+&]:ps-[calc(--spacing(2.5)-1px)]\",\n      },\n    },\n  },\n);\n\nexport function InputGroup({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"relative inline-flex w-full min-w-0 items-center rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_1px_--theme(--color-black/4%)] has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/64 has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/16 has-[textarea]:h-auto has-data-[align=block-end]:h-auto has-data-[align=block-start]:h-auto has-data-[align=block-end]:flex-col has-data-[align=block-start]:flex-col has-[input:focus-visible,textarea:focus-visible]:border-ring has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/36 has-autofill:bg-foreground/4 has-[input:disabled,textarea:disabled]:opacity-64 has-[input:disabled,textarea:disabled,input:focus-visible,textarea:focus-visible,input[aria-invalid],textarea[aria-invalid]]:shadow-none has-[input:focus-visible,textarea:focus-visible]:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/24 dark:not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_-1px_--theme(--color-white/6%)] has-data-[align=inline-start]:**:[[data-size=sm]_input]:ps-1.5 has-data-[align=inline-end]:**:[[data-size=sm]_input]:pe-1.5 *:[[data-slot=input-control],[data-slot=textarea-control]]:contents *:[[data-slot=input-control],[data-slot=textarea-control]]:before:hidden has-[[data-align=block-start],[data-align=block-end]]:**:[input]:h-auto has-data-[align=inline-start]:**:[input]:ps-2 has-data-[align=inline-end]:**:[input]:pe-2 has-data-[align=block-end]:**:[input]:pt-1.5 has-data-[align=block-start]:**:[input]:pb-1.5 **:[textarea]:min-h-20.5 **:[textarea]:resize-none **:[textarea]:py-[calc(--spacing(3)-1px)] **:[textarea]:max-sm:min-h-23.5 **:[textarea_button]:rounded-[calc(var(--radius-md)-1px)]\",\n        className,\n      )}\n      data-slot=\"input-group\"\n      role=\"group\"\n      {...props}\n    />\n  );\n}\n\nexport function InputGroupAddon({\n  className,\n  align = \"inline-start\",\n  ...props\n}: React.ComponentProps<\"div\"> &\n  VariantProps<typeof inputGroupAddonVariants>): React.ReactElement {\n  return (\n    <div\n      className={cn(inputGroupAddonVariants({ align }), className)}\n      data-align={align}\n      data-slot=\"input-group-addon\"\n      onMouseDown={(e: React.MouseEvent<H
```

**File**: `apps/ui/registry/default/ui/input-group.tsx` (modified, +3/-1)
```diff
@@ -56,7 +56,9 @@ export function InputGroupAddon({
       data-align={align}
       data-slot="input-group-addon"
       onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
-        const target = e.target as HTMLElement;
+        const target = e.target as Element;
+        if (!e.currentTarget.contains(target)) return;
+
         const isInteractive = target.closest(
           "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']",
         );
```

**File**: `packages/ui/src/components/input-group.tsx` (modified, +3/-1)
```diff
@@ -56,7 +56,9 @@ export function InputGroupAddon({
       data-align={align}
       data-slot="input-group-addon"
       onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
-        const target = e.target as HTMLElement;
+        const target = e.target as Element;
+        if (!e.currentTarget.contains(target)) return;
+
         const isInteractive = target.closest(
           "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']",
         );
```

**File**: `packages/ui/test/components/input-group.test.tsx` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+import { describe, expect, mock, test } from "bun:test";
+import type * as React from "react";
+
+function componentMock() {
+  return null;
+}
+
+mock.module("@coss/ui/components/input", () => ({
+  Input: componentMock,
+}));
+
+mock.module("@coss/ui/components/textarea", () => ({
+  Textarea: componentMock,
+}));
+
+mock.module("@coss/ui/lib/utils", () => ({
+  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
+}));
+
+const { InputGroupAddon } = await import("../../src/components/input-group");
+
+type MouseDownHandler = NonNullable<React.ComponentProps<"div">["onMouseDown"]>;
+
+function getMouseDownHandler(): MouseDownHandler {
+  const element = InputGroupAddon({});
+  const props = element.props as React.ComponentProps<"div">;
+
+  if (!props.onMouseDown) {
+    throw new Error("InputGroupAddon does not have an onMouseDown handler");
+  }
+
+  return props.onMouseDown;
+}
+
+function createMouseDownEvent({
+  contains,
+  interactive = false,
+}: {
+  contains: boolean;
+  interactive?: boolean;
+}) {
+  let focused = false;
+  let prevented = false;
+
+  const target = {
+    closest: () => (interactive ? {} : null),
+  } as unknown as Element;
+  const input = {
+    focus: () => {
+      focused = true;
+    },
+  };
+  const parentElement = {
+    querySelector: (selector: string) => {
+      if (selector === "input, textarea") return input;
+      if (selector === "input:focus, textarea:focus") return null;
+      return null;
+    },
+  };
+  const currentTarget = {
+    contains: () => contains,
+    parentElement,
+  } as unknown as HTMLDivElement;
+  const event = {
+    currentTarget,
+    preventDefault: () => {
+      prevented = true;
+    },
+    target,
+  } as unknown as React.MouseEvent<HTMLDivElement>;
+
+  return {
+    event,
+    wasFocused: () => focused,
+    wasPrevented: () => prevented,
+  };
+}
+
+describe("InputGroupAddon", () => {
+  test("focuses the input for non-interactive content inside the addon", () => {
+    const handler = getMouseDownHandler();
+    const { event, wasFocused, wasPrevented } = createMouseDownEvent({
+      contains: true,
+    });
+
+    handler(event);
+
+    expect(wasPrevented()).toBe(true);
+    expect(wasFocused()).toBe(true);
+  });
+
+  test("does not focus the input for interactive content inside the addon", () => {
+    const handler = getMouseDownHandler();
+    const { event, wasFocused, wasPrevented } = createMouseDownEvent({
+      contains: true,
+      interactive: true,
+    });
+
+    handler(event);
+
+    expect(wasPrevented()).toBe(false);
+    expect(wasFocused()).toBe(false);
+  });
+
+  test("ignores events from portaled descendants outside the addon", () => {
+    const handler = getMouseDownHandler();
+    const { event, wasFocused, wasPrevented } = createMouseDownEvent({
+      contains: false,
+    });
+
+    handler(event);
+
+    expect(wasPrevented()).toBe(false);
+    expect(wasFocused()).toBe(false);
+  });
+});
```

---

### Incident Patch 11: `0630457e` (2026-08-29)
**Commit Message**: fix(scroll-area): correct transition-shadows typo so the focus ring animates (#834)

Tailwind's utility is singular, so `transition-shadows` compiles to nothing: the viewport gets no transition-property or duration and its focus-visible ring snaps in and out. `transition-shadow` sets `transition-property: box-shadow`, which is what `ring-2` and `ring-offset-1` render.

The registry JSON and the packages/ui copy carry the same change.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/scroll-area.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/scroll-area.tsx",
-      "content": "\"use client\";\n\nimport { ScrollArea as ScrollAreaPrimitive } from \"@base-ui/react/scroll-area\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport function ScrollArea({\n  className,\n  children,\n  scrollFade = false,\n  scrollbarGutter = false,\n  fill = false,\n  clampContentMinWidth = true,\n  overscrollContain = false,\n  ...props\n}: ScrollAreaPrimitive.Root.Props & {\n  scrollFade?: boolean;\n  scrollbarGutter?: boolean;\n  fill?: boolean;\n  clampContentMinWidth?: boolean;\n  overscrollContain?: boolean;\n}): React.ReactElement {\n  return (\n    <ScrollAreaPrimitive.Root\n      className={cn(\"size-full min-h-0\", className)}\n      {...props}\n    >\n      <ScrollAreaPrimitive.Viewport\n        className={cn(\n          \"h-full rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background\",\n          overscrollContain &&\n            \"data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain\",\n          scrollFade &&\n            \"mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]\",\n          scrollbarGutter &&\n            \"data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5\",\n        )}\n        data-slot=\"scroll-area-viewport\"\n      >\n        <ScrollAreaPrimitive.Content\n          className={cn(fill && \"size-full\")}\n          data-slot=\"scroll-area-content\"\n          style={clampContentMinWidth ? { minWidth: 0 } : undefined}\n        >\n          {children}\n        </ScrollAreaPrimitive.Content>\n      </ScrollAreaPrimitive.Viewport>\n      <ScrollBar orientation=\"vertical\" />\n      <ScrollBar orientation=\"horizontal\" />\n      <ScrollAreaPrimitive.Corner data-slot=\"scroll-area-corner\" />\n    </ScrollAreaPrimitive.Root>\n  );\n}\n\nexport function ScrollBar({\n  className,\n  orientation = \"vertical\",\n  ...props\n}: ScrollAreaPrimitive.Scrollbar.Props): React.ReactElement {\n  return (\n    <ScrollAreaPrimitive.Scrollbar\n      className={cn(\n        \"m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100\",\n        className,\n      )}\n      data-slot=\"scroll-area-scrollbar\"\n      orientation={orientation}\n      {...props}\n    >\n      <ScrollAreaPrimitive.Thumb\n        className=\"relative flex-1 rounded-full bg-foreground/20\"\n        data-slot=\"scroll-area-thumb\"\n      />\n    </ScrollAreaPrimitive.Scrollbar>\n  );\n}\n\nexport { ScrollAreaPrimitive };\n",
+      "content": "\"use client\";\n\nimport { ScrollArea as ScrollAreaPrimitive } from \"@base-ui/react/scroll-area\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport function ScrollArea({\n  className,\n  children,\n  scrollFade = false,\n  scrollbarGutter = false,\n  fill = false,\n  clampContentMinWidth = true,\n  overscrollContain = false,\n  ...props\n}: ScrollAreaPrimitive.Root.Props & {\n  scrollFade?: boolean;\n  scrollbarGutter?: boolean;\n  fill?: boolean;\n  clampContentMinWidth?: boolean;\n  overscrollContain?: boolean;\n}): React.ReactElement {\n  return (\n    <ScrollAreaPrimitive.Root\n      className={cn(\"size-full min-h-0\", className)}\n      {...props}\n    >\n      <ScrollAreaPrimitive.Viewport\n        className={cn(\n          \"h-full rounded-[inherit] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background\",\n          overscrollContain &&\n            \"data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain\",\n          scrollFade &&\n            \"mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]\",\n          scrollbarGutter &&\n            \"data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5\",\n        )}\n        data-slot=\"scroll-area-viewport\"\n      >\n        <ScrollAreaPrimitive.Content\n          className={cn(fill && \"size-full\")}\n          data-slot=\"scroll-area-c
```

**File**: `apps/ui/registry/default/ui/scroll-area.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export function ScrollArea({
     >
       <ScrollAreaPrimitive.Viewport
         className={cn(
-          "h-full rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
+          "h-full rounded-[inherit] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
           overscrollContain &&
             "data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
           scrollFade &&
```

**File**: `packages/ui/src/components/scroll-area.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export function ScrollArea({
     >
       <ScrollAreaPrimitive.Viewport
         className={cn(
-          "h-full rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
+          "h-full rounded-[inherit] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
           overscrollContain &&
             "data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
           scrollFade &&
```

---

### Incident Patch 12: `f27d6684` (2026-08-19)
**Commit Message**: feat(ui): share segmented item layout styles with Tabs (#837)

Extract icon gap, size, and opacity into segmentedControlItemLayoutClassName so radio, navigation, and Tabs stay optically aligned.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/content/docs/(root)/changelog.mdx` (modified, +8/-0)
```diff
@@ -3,6 +3,14 @@ title: Changelog
 description: Breaking changes, migration guides, and notable updates.
 ---
 
+## August 19, 2026
+
+### Shared segmented control item layout styles
+
+**`segmented-control`** now exports **`segmentedControlItemLayoutClassName`** for the shared icon gap, size, and opacity treatment. **`segmentedControlItemVariants`** includes this class, and **`TabsTab`** uses it instead of inlining the same utilities.
+
+Existing Tabs and segmented-control usage does not need JSX changes. If you maintain a local copy of the library or Tabs, merge the new export so icons stay optically aligned with Button.
+
 ## August 17, 2026
 
 ### Tabs sizing and segmented control styles
```

**File**: `apps/ui/content/docs/components/segmented-control.mdx` (modified, +3/-2)
```diff
@@ -45,10 +45,11 @@ For a custom composition, install the styling library directly:
 npx shadcn@latest add @coss/segmented-control
 ```
 
-The library exports a root class and an item recipe:
+The library exports a root class, an item recipe, and a shared item layout class for icons:
 
 ```tsx
 import {
+  segmentedControlItemLayoutClassName,
   segmentedControlItemVariants,
   segmentedControlRootClassName,
 } from "@/lib/segmented-control"
@@ -66,7 +67,7 @@ const itemClassName = segmentedControlItemVariants({
 | `size` | `"sm" \| "default" \| "lg"` | Controls item height and horizontal padding. |
 | `state` | `"checked" \| "current" \| "pressed"` | Selects the state attribute used by the underlying element. |
 
-Use `checked` with Radio Group, `current` with navigation links, and `pressed` with Toggle Group. Tabs retain their own animated indicator and do not use the shared state recipe.
+Use `checked` with Radio Group, `current` with navigation links, and `pressed` with Toggle Group. Tabs retain their own animated indicator and do not use the shared state recipe. They reuse `segmentedControlItemLayoutClassName` so icons match the other segmented implementations.
 
 At the outside edges, the item padding and the surface's `p-0.5` inset combine to match the horizontal padding of the corresponding Button size. The outer segmented surface is slightly taller than that Button to optically balance its inset selected item when the controls appear next to each other.
 
```

**File**: `apps/ui/public/r/segmented-control.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/lib/segmented-control.ts",
-      "content": "import { cva } from \"class-variance-authority\";\n\nexport type SegmentedControlSize = \"default\" | \"lg\" | \"sm\";\n\nexport const segmentedControlItemSizeClassNames: Record<\n  SegmentedControlSize,\n  string\n> = {\n  default: \"h-8.5 px-[calc(--spacing(2.5)-1px)] sm:h-7.5\",\n  lg: \"h-9.5 px-[calc(--spacing(3)-1px)] sm:h-8.5\",\n  sm: \"h-7.5 px-[calc(--spacing(2)-1px)] sm:h-6.5\",\n};\n\nexport const segmentedControlRootClassName =\n  \"relative z-0 flex w-fit items-center justify-center gap-0.5 rounded-lg bg-muted p-0.5\";\n\nexport const segmentedControlItemVariants = cva(\n  \"relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base text-muted-foreground/72 outline-2 outline-transparent transition-[outline-color] hover:bg-transparent hover:text-muted-foreground focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-64 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm\",\n  {\n    defaultVariants: {\n      size: \"default\",\n    },\n    variants: {\n      size: segmentedControlItemSizeClassNames,\n      state: {\n        checked:\n          \"data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm/5 dark:data-checked:bg-input\",\n        current:\n          \"aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm/5 dark:aria-[current=page]:bg-input\",\n        pressed:\n          \"data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm/5 dark:data-pressed:bg-input\",\n      },\n    },\n  },\n);\n",
+      "content": "import { cva } from \"class-variance-authority\";\n\nexport type SegmentedControlSize = \"default\" | \"lg\" | \"sm\";\n\nexport const segmentedControlItemSizeClassNames: Record<\n  SegmentedControlSize,\n  string\n> = {\n  default: \"h-8.5 px-[calc(--spacing(2.5)-1px)] sm:h-7.5\",\n  lg: \"h-9.5 px-[calc(--spacing(3)-1px)] sm:h-8.5\",\n  sm: \"h-7.5 px-[calc(--spacing(2)-1px)] sm:h-6.5\",\n};\n\nexport const segmentedControlRootClassName =\n  \"relative z-0 flex w-fit items-center justify-center gap-0.5 rounded-lg bg-muted p-0.5\";\n\nexport const segmentedControlItemLayoutClassName =\n  \"gap-1.5 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0\";\n\nexport const segmentedControlItemVariants = cva(\n  [\n    \"relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base text-muted-foreground/72 outline-2 outline-transparent transition-[outline-color] hover:bg-transparent hover:text-muted-foreground focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-64 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm\",\n    segmentedControlItemLayoutClassName,\n  ],\n  {\n    defaultVariants: {\n      size: \"default\",\n    },\n    variants: {\n      size: segmentedControlItemSizeClassNames,\n      state: {\n        checked:\n          \"data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm/5 dark:data-checked:bg-input\",\n        current:\n          \"aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm/5 dark:aria-[current=page]:bg-input\",\n        pressed:\n          \"data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm/5 dark:data-pressed:bg-input\",\n      },\n    },\n  },\n);\n",
       "type": "registry:lib"
     }
   ],
```

**File**: `apps/ui/public/r/tabs.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
   "files": [
     {
       "path": "registry/default/ui/tabs.tsx",
-      "content": "\"use client\";\n\nimport { Tabs as TabsPrimitive } from \"@base-ui/react/tabs\";\nimport * as React from \"react\";\nimport {\n  type SegmentedControlSize,\n  segmentedControlItemSizeClassNames,\n} from \"@/registry/default/lib/segmented-control\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\ntype TabsVariant = \"default\" | \"underline\";\ntype TabsSize = SegmentedControlSize;\n\nconst TabsListContext: React.Context<TabsSize> =\n  React.createContext<TabsSize>(\"default\");\n\nexport function Tabs({\n  className,\n  ...props\n}: TabsPrimitive.Root.Props): React.ReactElement {\n  return (\n    <TabsPrimitive.Root\n      className={cn(\n        \"flex flex-col gap-2 data-[orientation=vertical]:flex-row\",\n        className,\n      )}\n      data-slot=\"tabs\"\n      {...props}\n    />\n  );\n}\n\nexport function TabsList({\n  variant = \"default\",\n  size = \"default\",\n  className,\n  children,\n  ...props\n}: TabsPrimitive.List.Props & {\n  size?: TabsSize;\n  variant?: TabsVariant;\n}): React.ReactElement {\n  return (\n    <TabsPrimitive.List\n      className={cn(\n        \"relative z-0 flex w-fit items-center justify-center gap-x-0.5 text-muted-foreground\",\n        \"data-[orientation=vertical]:flex-col\",\n        variant === \"default\"\n          ? \"rounded-lg bg-muted p-0.5 text-muted-foreground/72\"\n          : \"data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-tab]:hover:bg-accent\",\n        className,\n      )}\n      data-size={size}\n      data-slot=\"tabs-list\"\n      {...props}\n    >\n      <TabsListContext.Provider value={size}>\n        {children}\n      </TabsListContext.Provider>\n      <TabsPrimitive.Indicator\n        className={cn(\n          \"absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out\",\n          variant === \"underline\"\n            ? \"z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px data-[orientation=horizontal]:translate-y-px\"\n            : \"-z-1 rounded-md bg-background shadow-sm/5 dark:bg-input\",\n        )}\n        data-slot=\"tab-indicator\"\n      />\n    </TabsPrimitive.List>\n  );\n}\n\nexport function TabsTab({\n  className,\n  size,\n  ...props\n}: TabsPrimitive.Tab.Props & {\n  size?: TabsSize;\n}): React.ReactElement {\n  const contextSize: TabsSize = React.useContext(TabsListContext);\n  const resolvedSize: TabsSize = size ?? contextSize;\n\n  return (\n    <TabsPrimitive.Tab\n      className={cn(\n        \"relative flex shrink-0 grow cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0\",\n        segmentedControlItemSizeClassNames[resolvedSize],\n        className,\n      )}\n      data-size={resolvedSize}\n      data-slot=\"tabs-tab\"\n      {...props}\n    />\n  );\n}\n\nexport function TabsPanel({\n  className,\n  ...props\n}: TabsPrimitive.Panel.Props): React.ReactElement {\n  return (\n    <TabsPrimitive.Panel\n      className={cn(\"flex-1 outline-none\", className)}\n      data-slot=\"tabs-content\"\n      {...props}\n    />\n  );\n}\n\nexport {\n  TabsPrimitive,\n  TabsTab as TabsTrigger,\n  TabsPanel as TabsContent,\n  type TabsSize,\n  type TabsVariant,\n};\n",
+      "content": "\"use client\";\n\nimport { Tabs as TabsPrimitive } from \"@base-ui/react/tabs\";\nimport * as React from \"react\";\nimport {\n  type SegmentedControlSize,\n  segmentedControlItemLayoutClassName,\n  segmentedControlItemSizeClassNames,\n} from \"@/registry/default/lib/segmented-control\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\ntype TabsVariant = \"default\" | \"underline\";\ntype TabsSize = SegmentedControlSize;\n\nconst TabsListContext: React.Context<TabsSize> =\n  React.createContext<TabsSize>(\"default\");\n\nexport function Tabs({\n  className,\n  ...props\n}: TabsPrimitive.Root.Props): React.ReactElement {\n  return (\n    <TabsPrimitive.Root\n      className={cn(\n        \"flex flex-col gap-2 data-[orientation=vertical]:flex-row\",\n        className,\n      )}\n      data-slot=\"tabs\"\n      {...props}\n    />\n  );\n}\n\nexport function TabsList({\n  variant = \"default\",\n  size = \"default\",\n  className,\n  children,\n  ...props\n}: TabsP
```

**File**: `apps/ui/registry/default/lib/segmented-control.ts` (modified, +7/-1)
```diff
@@ -14,8 +14,14 @@ export const segmentedControlItemSizeClassNames: Record<
 export const segmentedControlRootClassName =
   "relative z-0 flex w-fit items-center justify-center gap-0.5 rounded-lg bg-muted p-0.5";
 
+export const segmentedControlItemLayoutClassName =
+  "gap-1.5 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0";
+
 export const segmentedControlItemVariants = cva(
-  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base text-muted-foreground/72 outline-2 outline-transparent transition-[outline-color] hover:bg-transparent hover:text-muted-foreground focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-64 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm",
+  [
+    "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base text-muted-foreground/72 outline-2 outline-transparent transition-[outline-color] hover:bg-transparent hover:text-muted-foreground focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-64 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm",
+    segmentedControlItemLayoutClassName,
+  ],
   {
     defaultVariants: {
       size: "default",
```

**File**: `apps/ui/registry/default/ui/tabs.tsx` (modified, +3/-1)
```diff
@@ -4,6 +4,7 @@ import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
 import * as React from "react";
 import {
   type SegmentedControlSize,
+  segmentedControlItemLayoutClassName,
   segmentedControlItemSizeClassNames,
 } from "@/registry/default/lib/segmented-control";
 import { cn } from "@/registry/default/lib/utils";
@@ -83,7 +84,8 @@ export function TabsTab({
   return (
     <TabsPrimitive.Tab
       className={cn(
-        "relative flex shrink-0 grow cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
+        "relative flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm",
+        segmentedControlItemLayoutClassName,
         segmentedControlItemSizeClassNames[resolvedSize],
         className,
       )}
```

**File**: `apps/ui/skills/coss/references/segmented-control.md` (modified, +2/-2)
```diff
@@ -55,6 +55,6 @@ const itemClassName = segmentedControlItemVariants({
 
 Use the exported Radio Group primitives for a custom segmented radio presentation so the native radio indicator is not rendered. Keep a default or controlled value when the interface requires one option to remain selected.
 
-Tabs do not use the shared state recipe because they retain their animated indicator. They import the shared size map: set `size="sm" | "default" | "lg"` on `TabsList`, and use a `TabsTab` size only as an item-level override.
+Tabs do not use the shared state recipe because they retain their animated indicator. They import the shared size map and `segmentedControlItemLayoutClassName`: set `size="sm" | "default" | "lg"` on `TabsList`, and use a `TabsTab` size only as an item-level override.
 
-Reuse the shared root and item recipes instead of copying their classes into a new segmented particle. This keeps Tabs and the radio, navigation, and toggle implementations optically aligned.
+Reuse the shared root, item, and layout recipes instead of copying their classes into a new segmented particle. This keeps Tabs and the radio, navigation, and toggle implementations optically aligned.
```

**File**: `packages/ui/src/components/tabs.tsx` (modified, +3/-1)
```diff
@@ -3,6 +3,7 @@
 import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
 import {
   type SegmentedControlSize,
+  segmentedControlItemLayoutClassName,
   segmentedControlItemSizeClassNames,
 } from "@coss/ui/lib/segmented-control";
 import { cn } from "@coss/ui/lib/utils";
@@ -83,7 +84,8 @@ export function TabsTab({
   return (
     <TabsPrimitive.Tab
       className={cn(
-        "relative flex shrink-0 grow cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
+        "relative flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm",
+        segmentedControlItemLayoutClassName,
         segmentedControlItemSizeClassNames[resolvedSize],
         className,
       )}
```

---

### Incident Patch 13: `6bae419d` (2026-08-18)
**Commit Message**: feat(ui): add segmented control patterns (#835)

* feat(ui): add segmented control patterns

* docs(ui): add tabs migration guidance

* docs(ui): mark segmented control as new

* fix(ui): add segmented control particle tag

* fix(ui): clarify segmented particle semantics

* fix(ui): exclude tabs from segmented search

* style(ui): remove segmented state transition

* fix(ui): require segmented radio selection

* fix(ui): remove redundant radio requirement

* fix(ui): keep segmented toggle selected

* style(ui): preserve segmented text transition

* revert(ui): allow empty segmented toggles

* style(ui): remove segmented transitions

* style(ui): isolate segmented focus transition

* fix(ui): refine segmented control spacing

* docs(skills): add segmented control guidance

* refactor(ui): remove segmented toggle particles

**File**: `apps/ui/content/docs/(root)/changelog.mdx` (modified, +32/-0)
```diff
@@ -3,6 +3,38 @@ title: Changelog
 description: Breaking changes, migration guides, and notable updates.
 ---
 
+## August 17, 2026
+
+### Tabs sizing and segmented control styles
+
+**`TabsList`** now supports a **`size`** prop with **`"sm"`**, **`"default"`**, and **`"lg"`** values. The size propagates to its **`TabsTab`** children, and an individual tab can override the inherited size when necessary.
+
+The default Tabs appearance now uses the same optical item sizing as the [Segmented Control](/ui/docs/components/segmented-control) pattern. The default rendered height is slightly smaller than before so the inset active indicator remains visually balanced beside a Button of the corresponding size.
+
+Tabs now imports its size map from the **`@coss/segmented-control`** registry library. **`@coss/tabs`** declares this as a registry dependency, so the shadcn CLI installs it automatically with a fresh installation or CLI-managed update.
+
+**Migration:**
+
+Existing Tabs JSX requires no changes because **`"default"`** remains the default size. If you replace your local Tabs component through the CLI, review any local customizations before accepting the overwrite:
+
+```bash
+npx shadcn@latest add @coss/tabs
+```
+
+If you update **`tabs.tsx`** manually, install the shared library first and then merge the latest Tabs implementation. Copying only the new Tabs file without this dependency results in an unresolved import.
+
+```bash
+npx shadcn@latest add @coss/segmented-control
+```
+
+After updating, remove local height or horizontal-padding utilities from **`TabsList`** and **`TabsTab`** only where they unintentionally override the new **`size`** API. Keep intentional product-specific overrides.
+
+**Agent migration prompt:**
+
+```text
+Update the local coss Tabs component to the latest segmented-control sizing while preserving project-specific customizations. Install the shared registry dependency with `npx shadcn@latest add @coss/segmented-control`, then merge the latest @coss/tabs implementation. TabsList now accepts size="sm" | "default" | "lg" (default: "default") and propagates it to TabsTab; a TabsTab size prop overrides the inherited value. Replace the old hard-coded TabsTab height and horizontal-padding classes with segmentedControlItemSizeClassNames from the shared library. Existing Tabs JSX does not need a size prop. Audit local h-* and px-* overrides on TabsList/TabsTab and remove only those that unintentionally conflict with the new size API. Run formatting and typechecking, then visually verify default and underline Tabs in every size used by the app.
+```
+
 ## July 31, 2026
 
 ### Scroll Area — overscroll contain
```

**File**: `apps/ui/content/docs/components/meta.json` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@
     "radio-group",
     "scroll-area",
     "select",
+    "segmented-control",
     "separator",
     "sheet",
     "skeleton",
```

**File**: `apps/ui/content/docs/components/radio-group.mdx` (modified, +2/-0)
```diff
@@ -81,6 +81,8 @@ Individual radio button. Styled wrapper for `Radio.Root` from Base UI with built
 
 For accessible labelling and validation, prefer using the `Field` component to wrap radio buttons. See the related example: [Radio Group field](/ui/docs/components/field#radio-group-field).
 
+For tabs-style mutually exclusive choices, see the [Segmented Control](/ui/docs/components/segmented-control) pattern.
+
 ### Disabled
 
 <ComponentPreview name="p-radio-group-2" />
```

**File**: `apps/ui/content/docs/components/segmented-control.mdx` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+---
+title: Segmented Control
+description: A visual pattern for presenting related choices, navigation destinations, filters, or content views.
+---
+
+<ComponentPreview name="p-radio-group-8" />
+
+## About
+
+A segmented control is a visual pattern, not a standalone behavior. COSS uses the same presentation across several components while preserving the semantics, keyboard interactions, and state model of each underlying primitive.
+
+## Choose the right primitive
+
+| Intent | Use | Why |
+| ------ | --- | --- |
+| Choose one value in a form | [Radio Group](/ui/docs/components/radio-group) | Represents a mutually exclusive value and participates in form state. |
+| Navigate to another URL or route | Navigation links | Preserves link behavior, browser history, and `aria-current`. |
+| Apply an exclusive filter or mode | [Toggle Group](/ui/docs/components/toggle-group) | Represents the pressed state of an action that may be cleared. |
+| Switch between related panels | [Tabs](/ui/docs/components/tabs) | Connects each tab to an associated content panel. |
+
+Choose the primitive from the interaction first, then apply the segmented-control styling. Visual similarity alone is not a reason to use Tabs or Toggle Group.
+
+## Installation
+
+Segmented controls are provided as particles. Install the implementation and size that match your interaction:
+
+| Implementation | Small | Default | Large |
+| -------------- | ----- | ------- | ----- |
+| Radio Group | `@coss/p-radio-group-7` | `@coss/p-radio-group-8` | `@coss/p-radio-group-9` |
+| Navigation | `@coss/p-navigation-2` | `@coss/p-navigation-1` | `@coss/p-navigation-3` |
+
+For example, install the default Radio Group version with:
+
+```bash
+npx shadcn@latest add @coss/p-radio-group-8
+```
+
+The CLI installs the shared `segmented-control` styling library and the required primitive automatically.
+
+## Shared styling
+
+For a custom composition, install the styling library directly:
+
+```bash
+npx shadcn@latest add @coss/segmented-control
+```
+
+The library exports a root class and an item recipe:
+
+```tsx
+import {
+  segmentedControlItemVariants,
+  segmentedControlRootClassName,
+} from "@/lib/segmented-control"
+```
+
+```tsx
+const itemClassName = segmentedControlItemVariants({
+  size: "default",
+  state: "checked",
+})
+```
+
+| Option | Values | Description |
+| ------ | ------ | ----------- |
+| `size` | `"sm" \| "default" \| "lg"` | Controls item height and horizontal padding. |
+| `state` | `"checked" \| "current" \| "pressed"` | Selects the state attribute used by the underlying element. |
+
+Use `checked` with Radio Group, `current` with navigation links, and `pressed` with Toggle Group. Tabs retain their own animated indicator and do not use the shared state recipe.
+
+At the outside edges, the item padding and the surface's `p-0.5` inset combine to match the horizontal padding of the corresponding Button size. The outer segmented surface is slightly taller than that Button to optically balance its inset selected item when the controls appear next to each other.
+
+<ComponentSource
+  name="segmented-control"
+  title="lib/segmented-control.ts"
+/>
+
+## Radio options
+
+Use Radio Group when the selected segment represents a mutually exclusive value, especially in forms.
+
+### Small Radio Group
+
+<ComponentPreview name="p-radio-group-7" />
+
+### Default Radio Group
+
+<ComponentPreview name="p-radio-group-8" />
+
+### Large Radio Group
+
+<ComponentPreview name="p-radio-group-9" />
+
+## Navigation
+
+Use links when each segment points to a different destination. Apply `aria-current="page"` to the active link.
+
+### Small Navigation
+
+<ComponentPreview name="p-navigation-2" />
+
+### Default Navigation
+
+<ComponentPreview name="p-navigation-1" />
+
+### Large Navigation
+
+<ComponentPreview name="p-navigation-3" />
+
+## Related content
+
+Use Tabs when each segment controls an associated content panel. Tabs share the visual language of segmented controls but keep their animated indicator, orientation support, and panel semantics.
+
+<ComponentPreview name="p-tabs-1" />
```

**File**: `apps/ui/content/docs/components/tabs.mdx` (modified, +30/-5)
```diff
@@ -22,13 +22,25 @@ links:
 npx shadcn@latest add @coss/tabs
 ```
 
+The CLI installs the shared `@coss/segmented-control` registry dependency automatically.
+
 </TabsPanel>
 
 <TabsPanel value="manual">
 
 <Steps>
 
-<Step>Copy and paste the following code into your project.</Step>
+<Step>Install the following dependencies:</Step>
+
+```bash
+npm install @base-ui/react class-variance-authority
+```
+
+<Step>Copy the shared segmented control styling into your project.</Step>
+
+<ComponentSource name="segmented-control" title="lib/segmented-control.ts" />
+
+<Step>Copy and paste the Tabs component into your project.</Step>
 
 <ComponentSource name="tabs" title="components/ui/tabs.tsx" />
 
@@ -65,14 +77,15 @@ import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
 
 Root component. Styled wrapper for `Tabs.Root` from Base UI.
 
-| Prop      | Type                         | Default     | Description                                      |
-| --------- | ---------------------------- | ----------- | ------------------------------------------------ |
-| `variant` | `"default" \| "underline"`   | `"default"` | Controls the tabs styling                        |
-
 ### TabsList
 
 Container for tab triggers. Styled wrapper for `Tabs.List` from Base UI.
 
+| Prop      | Type                       | Default     | Description                         |
+| --------- | -------------------------- | ----------- | ----------------------------------- |
+| `size`    | `"sm" \| "default" \| "lg"` | `"default"` | Controls the size of all tab items. |
+| `variant` | `"default" \| "underline"` | `"default"` | Controls the tabs styling.          |
+
 ### TabsTab
 
 Individual tab trigger. Styled wrapper for `Tabs.Tab` from Base UI.
@@ -87,6 +100,18 @@ Visual indicator for the active tab. Styled wrapper for `Tabs.Indicator` from Ba
 
 ## Examples
 
+For guidance on choosing between Tabs, Radio Group, Toggle Group, and navigation links, see the [Segmented Control](/ui/docs/components/segmented-control) pattern.
+
+Tabs use the same optical sizing as segmented controls. The default surface is slightly taller than a Button of the same size so its inset active indicator remains visually balanced alongside adjacent controls.
+
+### Small
+
+<ComponentPreview name="p-tabs-14" />
+
+### Large
+
+<ComponentPreview name="p-tabs-15" />
+
 ### Underline Variant
 
 <ComponentPreview name="p-tabs-2" />
```

**File**: `apps/ui/lib/docs.ts` (modified, +1/-2)
```diff
@@ -1,5 +1,4 @@
 export const PAGES_NEW = [
   // "/docs/components/{component-name}",
-  "/docs/components/context-menu",
-  "/docs/components/otp-field",
+  "/docs/components/segmented-control",
 ];
```

**File**: `apps/ui/public/r/p-navigation-1.json` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+{
+  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
+  "name": "p-navigation-1",
+  "description": "Segmented navigation built with links",
+  "registryDependencies": [
+    "@coss/segmented-control"
+  ],
+  "files": [
+    {
+      "path": "registry/default/particles/p-navigation-1.tsx",
+      "content": "import {\n  segmentedControlItemVariants,\n  segmentedControlRootClassName,\n} from \"@/registry/default/lib/segmented-control\";\n\nconst itemClassName = segmentedControlItemVariants({ state: \"current\" });\n\nexport default function Particle() {\n  return (\n    <nav aria-label=\"Project sections\">\n      <div className={segmentedControlRootClassName}>\n        <a aria-current=\"page\" className={itemClassName} href=\"#overview\">\n          Overview\n        </a>\n        <a className={itemClassName} href=\"#activity\">\n          Activity\n        </a>\n        <a className={itemClassName} href=\"#settings\">\n          Settings\n        </a>\n      </div>\n    </nav>\n  );\n}\n",
+      "type": "registry:block"
+    }
+  ],
+  "categories": [
+    "navigation",
+    "segmented control"
+  ],
+  "type": "registry:block"
+}
\ No newline at end of file
```

**File**: `apps/ui/public/r/p-navigation-2.json` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+{
+  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
+  "name": "p-navigation-2",
+  "description": "Small segmented navigation built with links",
+  "registryDependencies": [
+    "@coss/segmented-control"
+  ],
+  "files": [
+    {
+      "path": "registry/default/particles/p-navigation-2.tsx",
+      "content": "import {\n  segmentedControlItemVariants,\n  segmentedControlRootClassName,\n} from \"@/registry/default/lib/segmented-control\";\n\nconst itemClassName = segmentedControlItemVariants({\n  size: \"sm\",\n  state: \"current\",\n});\n\nexport default function Particle() {\n  return (\n    <nav aria-label=\"Project sections\">\n      <div className={segmentedControlRootClassName}>\n        <a aria-current=\"page\" className={itemClassName} href=\"#overview\">\n          Overview\n        </a>\n        <a className={itemClassName} href=\"#activity\">\n          Activity\n        </a>\n        <a className={itemClassName} href=\"#settings\">\n          Settings\n        </a>\n      </div>\n    </nav>\n  );\n}\n",
+      "type": "registry:block"
+    }
+  ],
+  "categories": [
+    "navigation",
+    "segmented control"
+  ],
+  "type": "registry:block"
+}
\ No newline at end of file
```

---

### Incident Patch 14: `e43fa4a8` (2026-08-01)
**Commit Message**: fix(ui): improve form control autofill text colors in iframes (#830)

* fix(input): set autofill text color on the input element

Ensure autofilled text uses foreground color in embedded iframes where
browser autofill styles otherwise override the wrapper-level color.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* chore(registry): sync input.json after autofill fix

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(input): move text-foreground onto the input element

Keep autofill text color and foreground text on the input itself for
consistent styling in embedded iframes.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(ui): move text color onto form control elements

Apply text-foreground (and related styles) on textarea, number-field,
and combobox inputs for consistent autofill behavior in iframes.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* chore(registry): sync combobox and number-field JSON

Co-authored-by: Cursor <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/combobox.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/combobox.tsx",
-      "content": "\"use client\";\n\nimport { Combobox as ComboboxPrimitive } from \"@base-ui/react/combobox\";\nimport { ChevronsUpDownIcon, XIcon } from \"lucide-react\";\nimport * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Input } from \"@/registry/default/ui/input\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const ComboboxContext: React.Context<{\n  chipsRef: React.RefObject<Element | null> | null;\n  multiple: boolean;\n}> = React.createContext<{\n  chipsRef: React.RefObject<Element | null> | null;\n  multiple: boolean;\n}>({\n  chipsRef: null,\n  multiple: false,\n});\n\nexport function Combobox<Value, Multiple extends boolean | undefined = false>(\n  props: ComboboxPrimitive.Root.Props<Value, Multiple>,\n): React.ReactElement {\n  const chipsRef = React.useRef<Element | null>(null);\n  return (\n    <ComboboxContext.Provider value={{ chipsRef, multiple: !!props.multiple }}>\n      <ComboboxPrimitive.Root {...props} />\n    </ComboboxContext.Provider>\n  );\n}\n\nexport function ComboboxChipsInput({\n  className,\n  size,\n  ...props\n}: Omit<ComboboxPrimitive.Input.Props, \"size\"> & {\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  ref?: React.Ref<HTMLInputElement>;\n}): React.ReactElement {\n  const sizeValue = (size ?? \"default\") as \"sm\" | \"default\" | \"lg\" | number;\n\n  return (\n    <ComboboxPrimitive.Input\n      className={cn(\n        \"min-w-12 flex-1 text-base outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5\",\n        sizeValue === \"sm\" ? \"ps-1.5\" : \"ps-2\",\n        className,\n      )}\n      data-size={typeof sizeValue === \"string\" ? sizeValue : undefined}\n      data-slot=\"combobox-chips-input\"\n      size={typeof sizeValue === \"number\" ? sizeValue : undefined}\n      {...props}\n    />\n  );\n}\n\nexport function ComboboxInput({\n  className,\n  showTrigger = true,\n  showClear = false,\n  startAddon,\n  size,\n  triggerProps,\n  clearProps,\n  ...props\n}: Omit<ComboboxPrimitive.Input.Props, \"size\"> & {\n  showTrigger?: boolean;\n  showClear?: boolean;\n  startAddon?: React.ReactNode;\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  ref?: React.Ref<HTMLInputElement>;\n  triggerProps?: ComboboxPrimitive.Trigger.Props;\n  clearProps?: ComboboxPrimitive.Clear.Props;\n}): React.ReactElement {\n  const sizeValue = (size ?? \"default\") as \"sm\" | \"default\" | \"lg\" | number;\n\n  return (\n    <ComboboxPrimitive.InputGroup\n      className=\"relative not-has-[>*.w-full]:w-fit w-full text-foreground has-disabled:opacity-64\"\n      data-slot=\"combobox-input-group\"\n    >\n      {startAddon && (\n        <div\n          aria-hidden=\"true\"\n          className=\"pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5\"\n          data-slot=\"combobox-start-addon\"\n        >\n          {startAddon}\n        </div>\n      )}\n      <ComboboxPrimitive.Input\n        className={cn(\n          startAddon &&\n            \"data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7.5)-1px)] *:data-[slot=combobox-input]:ps-[calc(--spacing(8.5)-1px)] sm:data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7)-1px)] sm:*:data-[slot=combobox-input]:ps-[calc(--spacing(8)-1px)]\",\n          sizeValue === \"sm\"\n            ? \"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-6.5\"\n            : \"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-7\",\n          className,\n        )}\n        data-slot=\"combobox-input\"\n        render={\n          <Input\n            className=\"has-disabled:opacity-100\"\n            nativeInput\n            size={sizeValue}\n          />\n        }\n        {...props}\n      />\n      {showTrigger && (\n        <ComboboxTrigger\n          className={cn(\n            \"absolute top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-opacity pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=combobox-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n            sizeValue === \"sm\" ? \"end-0\" : \"end-0.5\",\n          )}\n          {...triggerProps}\n        >\n          <ComboboxPrimitive.Icon data-slot=\"combobox-icon\">\n            <ChevronsUpDownIcon />\n          </ComboboxPrimitive.Icon>\n        </ComboboxTrigger>\n      )}\n      {showClear && (\n    
```

**File**: `apps/ui/public/r/input.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/input.tsx",
-      "content": "\"use client\";\n\nimport { Input as InputPrimitive } from \"@base-ui/react/input\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport type InputProps = Omit<\n  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,\n  \"size\"\n> & {\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  unstyled?: boolean;\n  nativeInput?: boolean;\n};\n\nexport function Input({\n  className,\n  size = \"default\",\n  unstyled = false,\n  nativeInput = false,\n  style,\n  ...props\n}: InputProps): React.ReactElement {\n  const inputClassName = cn(\n    \"h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5\",\n    size === \"sm\" &&\n      \"h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5\",\n    size === \"lg\" && \"h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5\",\n    props.type === \"search\" &&\n      \"[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none\",\n    props.type === \"file\" &&\n      \"text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm\",\n  );\n\n  return (\n    <span\n      className={\n        cn(\n          !unstyled &&\n            \"relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n          className,\n        ) || undefined\n      }\n      data-size={size}\n      data-slot=\"input-control\"\n    >\n      {nativeInput ? (\n        <input\n          className={inputClassName}\n          data-slot=\"input\"\n          size={typeof size === \"number\" ? size : undefined}\n          style={typeof style === \"function\" ? undefined : style}\n          {...props}\n        />\n      ) : (\n        <InputPrimitive\n          className={inputClassName}\n          data-slot=\"input\"\n          size={typeof size === \"number\" ? size : undefined}\n          style={style}\n          {...props}\n        />\n      )}\n    </span>\n  );\n}\n\nexport { InputPrimitive };\n",
+      "content": "\"use client\";\n\nimport { Input as InputPrimitive } from \"@base-ui/react/input\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport type InputProps = Omit<\n  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,\n  \"size\"\n> & {\n  size?: \"sm\" | \"default\" | \"lg\" | number;\n  unstyled?: boolean;\n  nativeInput?: boolean;\n};\n\nexport function Input({\n  className,\n  size = \"default\",\n  unstyled = false,\n  nativeInput = false,\n  style,\n  ...props\n}: InputProps): React.ReactElement {\n  const inputClassName = cn(\n    \"h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] text-foreground leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5 autofill:[-webkit-text-fill-color:var(--foreground)]\",\n    size === \"sm\" &&\n      \"h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5\",\n    size === \"lg\" && \"h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5\",\n    props.type === \"search\" &&\n      \"[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none\",\n    props.type === \"file\" &&\n      \"text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm\",\n  );\n\n  return (\n    <span\n      className={\n        cn(\n          !unstyled &&\n            \"relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 b
```

**File**: `apps/ui/public/r/number-field.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
   "files": [
     {
       "path": "registry/default/ui/number-field.tsx",
-      "content": "\"use client\";\n\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\";\nimport { MinusIcon, PlusIcon } from \"lucide-react\";\nimport * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Label } from \"@/registry/default/ui/label\";\n\nexport const NumberFieldContext: React.Context<{\n  fieldId: string;\n} | null> = React.createContext<{\n  fieldId: string;\n} | null>(null);\n\nexport function NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props & {\n  size?: \"sm\" | \"default\" | \"lg\";\n}): React.ReactElement {\n  const generatedId = React.useId();\n  const fieldId = id ?? generatedId;\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={size}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  );\n}\n\nexport function NumberFieldGroup({\n  className,\n  ...props\n}: NumberFieldPrimitive.Group.Props): React.ReactElement {\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(\n        \"relative flex w-full justify-between rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 has-autofill:bg-foreground/4 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-within,[aria-invalid]]:shadow-none\",\n        className,\n      )}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  );\n}\n\nexport function NumberFieldDecrement({\n  className,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props): React.ReactElement {\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        \"relative flex shrink-0 cursor-pointer items-center justify-center rounded-s-[calc(var(--radius-lg)-1px)] in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n        className,\n      )}\n      data-slot=\"number-field-decrement\"\n      {...props}\n    >\n      <MinusIcon />\n    </NumberFieldPrimitive.Decrement>\n  );\n}\n\nexport function NumberFieldIncrement({\n  className,\n  ...props\n}: NumberFieldPrimitive.Increment.Props): React.ReactElement {\n  return (\n    <NumberFieldPrimitive.Increment\n      className={cn(\n        \"relative flex shrink-0 cursor-pointer items-center justify-center rounded-e-[calc(var(--radius-lg)-1px)] in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n        className,\n      )}\n      data-slot=\"number-field-increment\"\n      {...props}\n    >\n      <PlusIcon />\n    </NumberFieldPrimitive.Increment>\n  );\n}\n\nexport function NumberFieldInput({\n  className,\n  ...props\n}: NumberFieldPrimitive.Input.Props): React.ReactElement {\n  return (\n    <NumberFieldPrimitive.Input\n      className={cn(\n        \"h-8.5 in-data-[size=lg]:h-9.5 in-data-[size=sm]:h-7.5 w-full min-w-0 grow bg-transparent in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] text-center tabular-nums in-data-[size=lg]:leading-9.5 in-data-[size=sm]:leading-7.5 leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] sm:h-7.5 sm:in-data-[size=lg]:h-8.5 sm:in-data-[size=sm]:h-6.5 sm:in-data-[size=lg]:leading-8.5 sm:in-data-[size=sm]:leading-8.5 sm:leading-7.5\",\n        className,\n      )}\n      data-slot=\"number-field-input\"\n      {...props}\n    />\n  );\n}\n\nexport function NumberFieldScrubArea({\n  className,\n  label,\n  ...props\n}: NumberFieldPrimitive.ScrubArea.Props & {\n  label: string;\n}): React.ReactElement {\n  const context = React.useContext(NumberFieldContext);\n\n  if (!context)
```

**File**: `apps/ui/public/r/textarea.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/textarea.tsx",
-      "content": "\"use client\";\n\nimport { Field as FieldPrimitive } from \"@base-ui/react/field\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport type TextareaProps = React.ComponentPropsWithoutRef<\"textarea\"> &\n  React.RefAttributes<HTMLTextAreaElement> & {\n    size?: \"sm\" | \"default\" | \"lg\" | number;\n    unstyled?: boolean;\n  };\n\nexport function Textarea({\n  className,\n  size = \"default\",\n  unstyled = false,\n  ref,\n  ...props\n}: TextareaProps): React.ReactElement {\n  return (\n    <span\n      className={\n        cn(\n          !unstyled &&\n            \"relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n          className,\n        ) || undefined\n      }\n      data-size={size}\n      data-slot=\"textarea-control\"\n    >\n      <FieldPrimitive.Control\n        ref={ref}\n        value={props.value}\n        defaultValue={props.defaultValue}\n        disabled={props.disabled}\n        id={props.id}\n        name={props.name}\n        render={(defaultProps: React.ComponentProps<\"textarea\">) => (\n          <textarea\n            className={cn(\n              \"field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] outline-none max-sm:min-h-20.5\",\n              size === \"sm\" &&\n                \"min-h-16.5 px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)] max-sm:min-h-19.5\",\n              size === \"lg\" &&\n                \"min-h-18.5 py-[calc(--spacing(2)-1px)] max-sm:min-h-21.5\",\n            )}\n            data-slot=\"textarea\"\n            {...mergeProps(defaultProps, props)}\n          />\n        )}\n      />\n    </span>\n  );\n}\n\nexport { FieldPrimitive };\n",
+      "content": "\"use client\";\n\nimport { Field as FieldPrimitive } from \"@base-ui/react/field\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport type TextareaProps = React.ComponentPropsWithoutRef<\"textarea\"> &\n  React.RefAttributes<HTMLTextAreaElement> & {\n    size?: \"sm\" | \"default\" | \"lg\" | number;\n    unstyled?: boolean;\n  };\n\nexport function Textarea({\n  className,\n  size = \"default\",\n  unstyled = false,\n  ref,\n  ...props\n}: TextareaProps): React.ReactElement {\n  return (\n    <span\n      className={\n        cn(\n          !unstyled &&\n            \"relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n          className,\n        ) || undefined\n      }\n      data-size={size}\n      data-slot=\"textarea-control\"\n    >\n      <FieldPrimitive.Control\n        ref={ref}\n        value={props.value}\n        defaultValue={props.defaultValue}\n        disabled={props.disabled}\n        id={props.id}\n        name={props.name}\n        render={(defaultProps: React.ComponentProps<\"textarea\">) => (\n          <textarea\n            className={cn(\n              \"field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-foreground outline-none placeholder:text-muted-foreground/72 max-sm:min-h-20.5\",\n              size === \"sm\" &&\n                \"mi
```

**File**: `apps/ui/registry/default/ui/combobox.tsx` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ export function ComboboxChipsInput({
   return (
     <ComboboxPrimitive.Input
       className={cn(
-        "min-w-12 flex-1 text-base outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5",
+        "min-w-12 flex-1 text-base text-foreground outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5",
         sizeValue === "sm" ? "ps-1.5" : "ps-2",
         className,
       )}
@@ -374,7 +374,7 @@ export function ComboboxChips({
   return (
     <ComboboxPrimitive.Chips
       className={cn(
-        "relative inline-flex min-h-9 w-full flex-wrap gap-1 rounded-lg border border-input bg-background not-dark:bg-clip-padding p-[calc(--spacing(1)-1px)] text-base shadow-xs/5 outline-none ring-ring/24 transition-shadow *:min-h-7 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-disabled:pointer-events-none has-data-[size=lg]:min-h-10 has-data-[size=sm]:min-h-8 has-aria-invalid:border-destructive/36 has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-within,[aria-invalid]]:shadow-none focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 has-data-[size=lg]:*:min-h-8 has-data-[size=sm]:*:min-h-6 sm:min-h-8 sm:text-sm sm:has-data-[size=lg]:min-h-9 sm:has-data-[size=sm]:min-h-7 sm:*:min-h-6 sm:has-data-[size=lg]:*:min-h-7 sm:has-data-[size=sm]:*:min-h-5 dark:not-has-disabled:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
+        "relative inline-flex min-h-9 w-full flex-wrap gap-1 rounded-lg border border-input bg-background not-dark:bg-clip-padding p-[calc(--spacing(1)-1px)] text-base shadow-xs/5 outline-none ring-ring/24 transition-shadow *:min-h-7 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-disabled:pointer-events-none has-data-[size=lg]:min-h-10 has-data-[size=sm]:min-h-8 has-aria-invalid:border-destructive/36 has-disabled:opacity-64 has-[:disabled,:focus-within,[aria-invalid]]:shadow-none focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 has-data-[size=lg]:*:min-h-8 has-data-[size=sm]:*:min-h-6 sm:min-h-8 sm:text-sm sm:has-data-[size=lg]:min-h-9 sm:has-data-[size=sm]:min-h-7 sm:*:min-h-6 sm:has-data-[size=lg]:*:min-h-7 sm:has-data-[size=sm]:*:min-h-5 dark:not-has-disabled:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
         className,
       )}
       data-slot="combobox-chips"
```

**File**: `apps/ui/registry/default/ui/input.tsx` (modified, +2/-2)
```diff
@@ -22,7 +22,7 @@ export function Input({
   ...props
 }: InputProps): React.ReactElement {
   const inputClassName = cn(
-    "h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5",
+    "h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] text-foreground leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5 autofill:[-webkit-text-fill-color:var(--foreground)]",
     size === "sm" &&
       "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5",
     size === "lg" && "h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5",
@@ -37,7 +37,7 @@ export function Input({
       className={
         cn(
           !unstyled &&
-            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
+            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
           className,
         ) || undefined
       }
```

**File**: `apps/ui/registry/default/ui/number-field.tsx` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ export function NumberFieldGroup({
   return (
     <NumberFieldPrimitive.Group
       className={cn(
-        "relative flex w-full justify-between rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 has-autofill:bg-foreground/4 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-within,[aria-invalid]]:shadow-none",
+        "relative flex w-full justify-between rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-within,[aria-invalid]]:shadow-none",
         className,
       )}
       data-slot="number-field-group"
@@ -95,7 +95,7 @@ export function NumberFieldInput({
   return (
     <NumberFieldPrimitive.Input
       className={cn(
-        "h-8.5 in-data-[size=lg]:h-9.5 in-data-[size=sm]:h-7.5 w-full min-w-0 grow bg-transparent in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] text-center tabular-nums in-data-[size=lg]:leading-9.5 in-data-[size=sm]:leading-7.5 leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] sm:h-7.5 sm:in-data-[size=lg]:h-8.5 sm:in-data-[size=sm]:h-6.5 sm:in-data-[size=lg]:leading-8.5 sm:in-data-[size=sm]:leading-8.5 sm:leading-7.5",
+        "h-8.5 in-data-[size=lg]:h-9.5 in-data-[size=sm]:h-7.5 w-full min-w-0 grow bg-transparent in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] text-center text-foreground tabular-nums in-data-[size=lg]:leading-9.5 in-data-[size=sm]:leading-7.5 leading-8.5 outline-none sm:h-7.5 sm:in-data-[size=lg]:h-8.5 sm:in-data-[size=sm]:h-6.5 sm:in-data-[size=lg]:leading-8.5 sm:in-data-[size=sm]:leading-8.5 sm:leading-7.5",
         className,
       )}
       data-slot="number-field-input"
```

**File**: `apps/ui/registry/default/ui/textarea.tsx` (modified, +2/-2)
```diff
@@ -23,7 +23,7 @@ export function Textarea({
       className={
         cn(
           !unstyled &&
-            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
+            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
           className,
         ) || undefined
       }
@@ -40,7 +40,7 @@ export function Textarea({
         render={(defaultProps: React.ComponentProps<"textarea">) => (
           <textarea
             className={cn(
-              "field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] outline-none max-sm:min-h-20.5",
+              "field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-foreground outline-none placeholder:text-muted-foreground/72 max-sm:min-h-20.5",
               size === "sm" &&
                 "min-h-16.5 px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)] max-sm:min-h-19.5",
               size === "lg" &&
```

---

### Incident Patch 15: `caaf517f` (2026-07-29)
**Commit Message**: fix(input-group): prevent addon text from being cut off (#827)

* fix(input-group): prevent addon text from being cut off

Remove leading-none so line-clamp/truncate no longer clips InputGroupText.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(input-group): use truncate instead of line-clamp on addon text

Co-authored-by: Cursor <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/input-group.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "registry/default/ui/input-group.tsx",
-      "content": "\"use client\";\n\nimport { cva, type VariantProps } from \"class-variance-authority\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Input, type InputProps } from \"@/registry/default/ui/input\";\nimport { Textarea, type TextareaProps } from \"@/registry/default/ui/textarea\";\n\nconst inputGroupAddonVariants = cva(\n  \"flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80\",\n  {\n    defaultVariants: {\n      align: \"inline-start\",\n    },\n    variants: {\n      align: {\n        \"block-end\":\n          \"order-last w-full justify-start px-[calc(--spacing(3)-1px)] pb-[calc(--spacing(3)-1px)] [.border-t]:pt-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]\",\n        \"block-start\":\n          \"order-first w-full justify-start px-[calc(--spacing(3)-1px)] pt-[calc(--spacing(3)-1px)] [.border-b]:pb-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]\",\n        \"inline-end\":\n          \"order-last pe-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-me-1.5 has-[>button]:-me-2 has-[>kbd:last-child]:me-[-0.35rem] [[data-size=sm]+&]:pe-[calc(--spacing(2.5)-1px)]\",\n        \"inline-start\":\n          \"order-first ps-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-ms-1.5 has-[>button]:-ms-2 has-[>kbd:last-child]:ms-[-0.35rem] [[data-size=sm]+&]:ps-[calc(--spacing(2.5)-1px)]\",\n      },\n    },\n  },\n);\n\nexport function InputGroup({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"relative inline-flex w-full min-w-0 items-center rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_1px_--theme(--color-black/4%)] has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/64 has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/16 has-[textarea]:h-auto has-data-[align=block-end]:h-auto has-data-[align=block-start]:h-auto has-data-[align=block-end]:flex-col has-data-[align=block-start]:flex-col has-[input:focus-visible,textarea:focus-visible]:border-ring has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/36 has-autofill:bg-foreground/4 has-[input:disabled,textarea:disabled]:opacity-64 has-[input:disabled,textarea:disabled,input:focus-visible,textarea:focus-visible,input[aria-invalid],textarea[aria-invalid]]:shadow-none has-[input:focus-visible,textarea:focus-visible]:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/24 dark:not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_-1px_--theme(--color-white/6%)] has-data-[align=inline-start]:**:[[data-size=sm]_input]:ps-1.5 has-data-[align=inline-end]:**:[[data-size=sm]_input]:pe-1.5 *:[[data-slot=input-control],[data-slot=textarea-control]]:contents *:[[data-slot=input-control],[data-slot=textarea-control]]:before:hidden has-[[data-align=block-start],[data-align=block-end]]:**:[input]:h-auto has-data-[align=inline-start]:**:[input]:ps-2 has-data-[align=inline-end]:**:[input]:pe-2 has-data-[align=block-end]:**:[input]:pt-1.5 has-data-[align=block-start]:**:[input]:pb-1.5 **:[textarea]:min-h-20.5 **:[textarea]:resize-none **:[textarea]:py-[calc(--spacing(3)-1px)] **:[textarea]:max-sm:min-h-23.5 **:[textarea_button]:rounded-[calc(var(--radius-md)-1px)]\",\n        className,\n      )}\n      data-slot=\"input-group\"\n      role=\"group\"\n      {...props}\n    />\n  );\n}\n\nexport function InputGroupAddon({\n  className,\n  align = \"inline-start\",\n  ...props\n}: React.ComponentProps<\"div\"> &\n  VariantProps<typeof inputGroupAddonVariants>): React.ReactElement {\n  return (\n    <div\n      className={cn(inputGroupAddonVariants({ align }), className)}\n      data-align={align}\n      data-slot=\"input-group-addon\"\n      onMouseDown={(e: React
```

**File**: `apps/ui/registry/default/ui/input-group.tsx` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import { Input, type InputProps } from "@/registry/default/ui/input";
 import { Textarea, type TextareaProps } from "@/registry/default/ui/textarea";
 
 const inputGroupAddonVariants = cva(
-  "flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80",
+  "flex h-auto cursor-text select-none items-center justify-center gap-2 [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80",
   {
     defaultVariants: {
       align: "inline-start",
@@ -82,7 +82,7 @@ export function InputGroupText({
   return (
     <span
       className={cn(
-        "line-clamp-1 flex items-center gap-2 whitespace-nowrap text-muted-foreground leading-none in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5",
+        "flex items-center gap-2 truncate text-muted-foreground in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5",
         className,
       )}
       {...props}
```

**File**: `packages/ui/src/components/input-group.tsx` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import { cva, type VariantProps } from "class-variance-authority";
 import type * as React from "react";
 
 const inputGroupAddonVariants = cva(
-  "flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80",
+  "flex h-auto cursor-text select-none items-center justify-center gap-2 [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80",
   {
     defaultVariants: {
       align: "inline-start",
@@ -82,7 +82,7 @@ export function InputGroupText({
   return (
     <span
       className={cn(
-        "line-clamp-1 flex items-center gap-2 whitespace-nowrap text-muted-foreground leading-none in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5",
+        "flex items-center gap-2 truncate text-muted-foreground in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5",
         className,
       )}
       {...props}
```

#### Recent Merged Pull Requests:
- **PR #856** (2026-09-30): fix(ui): resize textarea wrapper for WebKit placeholder sizing (@pasqualevitiello)
- **PR #855** (2026-09-27): feat(ui): add palette Select and radio card particles (@pasqualevitiello)
- **PR #853** (2026-09-22): feat(ui): update Cal Sans to 2.003 (@pasqualevitiello)
- **PR #852** (2026-09-21): docs(ui): remove the Early Access callout from the Introduction (@supalarry)
- **PR #851** (2026-09-16): fix(ui): keep drawer close button above drag bar (@pasqualevitiello)
- **PR #850** (closed): fix(ui): drawer bar overlapping close button (@NathanBrodin)
- **PR #849** (closed): feat(ui): add separator particle (@rtkac)
- **PR #848** (2026-09-08): feat: migrate TanStack Table to v9 (@pasqualevitiello)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
