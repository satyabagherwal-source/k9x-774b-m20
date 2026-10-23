> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cosscom-ui-learnings.md`  
> **Source**: github ([https://github.com/cosscom/ui](https://github.com/cosscom/ui))  
> **Source Version**: `3d8ca28e`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T08:59:45.265Z  
> **Learning ID**: `learn-github-cosscom-ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cosscom/ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/cosscom-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cosscom/ui](https://github.com/cosscom/ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T08:54:42.219Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cosscom/ui`
- **Description**: coss.com/ui is the official design system of Cal.com
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10743 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #909** (2026-10-22): **fix(composer): show the default cursor when the composer is disabled**
  *Symptoms*: ## Summary  Adds `data-disabled:cursor-default` to the `Composer` frame. When the editor is disabled, the frame (which carries `data-disabled`) and the `ComposerInput` inside it now show the default cursor instead of `cursor-text`. The input has no cursor class of its own, so it inherits from the frame and doesn't need its own `in-data-disabled:` class.  This brings the primitive in line with the Cal.com copy (calcom/cal#11657).  The change is in `apps/ui/registry/default/ui/composer.tsx`. `packages/ui/src/components/composer.tsx` and `apps/ui/public/r/composer.json` were regenerated with `registry:build` and `ui:sync`.  Link to Devin session: https://app.devin.ai/sessions/87b5bf9269a0401ca28d4c648910b2a4 Open in Devin Desktop: https://app.devin.ai/desktop/session/87b5bf9269a0401ca28d4c648910b2a4?variant=devin Requested by: @pasqualevitiello
  **Post-Mortem & Fix Analysis**:
  > <!-- devin-pr-monitoring-controls --> I'll fix CI failures and address comments from users with write access. I'll skip comments containing "(aside)".  - [ ] Disable automatic comment, CI, and merge conflict monitoring 
  > [vc]: #qLFRhJOCO9VdI66Bz8S2tJxNo36D6X4WZ0XHa5VlMD4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS1vcmlnaW4iLCJwcm9qZWN0SWQiOiJwcmpfejBkeFJ2WWM5cWtmU25SUEpoaHhPcGR4ZXJtVSIsInJvb3REaXJlY3RvcnkiOiJhcHBzL29yaWdpbiIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS1vcmlnaW4vRGpaVVBnYWh4MVM2aFRxeEJpRUpjSGpMWUdRRCIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiU0tJUFBFRCJ9LHsibmFtZSI6ImNvc3MtY29tLXVpIiwicHJvamVjdElkIjoicHJqX1lWQ1Q2aUZYaGJLTGpQdG5INWtVU1hQOTQ5N3giLCJyb290RGlyZWN0b3J5IjoiYXBwcy91aSIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tdWkvQVVwQUN0bXRpV05mRm5lZ2Mya05KdVhiMUZvMSIsInByZXZpZXdVcmwiOiJjb3NzLWNvbS11aS1naXQtZGV2aW4tMTc5MjY1NTQ1MC1jb21wb3Nlci1kaXNhYmxlZC1jdXJzb3ItY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20t

- **Issue #908** (2026-10-20): **chore(ui): remove aria-label attributes from autocomplete and combobox**
  *Symptoms*: Removes the hard-coded `aria-label` attributes from the built-in trigger, clear, and chip-remove buttons in `Autocomplete` and `Combobox`.  - `AutocompleteInput`: trigger ("Show options") and clear ("Clear selection") - `ComboboxInput`: trigger ("Show options") and clear ("Clear selection") - `ComboboxChipRemove`: "Remove"  Updated in the registry source, the synced `packages/ui` copies, and the `autocomplete.json` / `combobox.json` registry outputs.  Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > [vc]: #x4XHdivsBTYIkr1DZw9wuH3WQ6EinRqpv260EVyXUds=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpL0dzSzh0SDVhRzE5ZWdMWHFTcUZZWmQ1bTdubW0iLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LWNob3JlLXJlbW92ZS1hdXRvY29tcGxldGUtY29tYm9ib3gtYS0yNThmODQtY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWNob3JlLXJlbW92ZS1hdXRvY29tcGxldGUtY29tYm9ib3gtYS0yNThmODQtY2FsLnZlcmNlbC5hcHAifX0seyJuYW1lIjoiY29zcy1leGFtcGxlcy1jYWxjb20iLCJwcm9qZWN0SWQiOiJwcmpfdk5ZTjkwZjVsQ2JLanAzZXdSeklzYllVbWx3TSIsInJvb3REaXJlY3RvcnkiOiJhcHBzL2V4YW1wbGVzL2NhbGNvbSIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1leGFtcGxlcy1jYWxjb20vNWdzZzFKeW55MTk1c3hGeHdwR05kWFFIZXdDayIsInByZXZpZXdVcmwiOiJjb3NzLWV4
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-6542">ENG-6542</a></p>

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

### Incident Patch 1: `d40c6603` (2026-10-15)
**Commit Message**: fix(ui): mirror switch-style menu item thumbs in right-to-left layouts (#870)

The switch variant of the Menu, ContextMenu and DrawerMenu checkbox items
draws its own thumb, which overflowed the track in RTL like Switch did.
Mirror its travel and press-scale origin with rtl: variants. LTR output is
unchanged.

**File**: `apps/ui/public/r/context-menu.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/context-menu.tsx",
-      "content": "\"use client\";\n\nimport { ContextMenu as ContextMenuPrimitive } from \"@base-ui/react/context-menu\";\nimport { ChevronRightIcon } from \"lucide-react\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport const ContextMenu: typeof ContextMenuPrimitive.Root =\n  ContextMenuPrimitive.Root;\n\nexport const ContextMenuPortal: typeof ContextMenuPrimitive.Portal =\n  ContextMenuPrimitive.Portal;\n\nexport function ContextMenuTrigger({\n  className,\n  children,\n  ...props\n}: ContextMenuPrimitive.Trigger.Props): React.ReactElement {\n  return (\n    <ContextMenuPrimitive.Trigger\n      className={className}\n      data-slot=\"context-menu-trigger\"\n      {...props}\n    >\n      {children}\n    </ContextMenuPrimitive.Trigger>\n  );\n}\n\nexport function ContextMenuPopup({\n  children,\n  className,\n  sideOffset = 4,\n  align = \"center\",\n  alignOffset,\n  side = \"bottom\",\n  anchor,\n  portalProps,\n  ...props\n}: ContextMenuPrimitive.Popup.Props & {\n  align?: ContextMenuPrimitive.Positioner.Props[\"align\"];\n  sideOffset?: ContextMenuPrimitive.Positioner.Props[\"sideOffset\"];\n  alignOffset?: ContextMenuPrimitive.Positioner.Props[\"alignOffset\"];\n  side?: ContextMenuPrimitive.Positioner.Props[\"side\"];\n  anchor?: ContextMenuPrimitive.Positioner.Props[\"anchor\"];\n  portalProps?: ContextMenuPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <ContextMenuPortal {...portalProps}>\n      <ContextMenuPrimitive.Positioner\n        align={align}\n        alignOffset={alignOffset}\n        anchor={anchor}\n        className=\"z-50\"\n        data-slot=\"context-menu-positioner\"\n        side={side}\n        sideOffset={sideOffset}\n      >\n        <ContextMenuPrimitive.Popup\n          className={cn(\n            \"relative flex not-[class*='w-']:min-w-32 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            className,\n          )}\n          data-slot=\"context-menu-popup\"\n          {...props}\n        >\n          <div className=\"max-h-(--available-height) w-full overflow-y-auto p-1\">\n            {children}\n          </div>\n        </ContextMenuPrimitive.Popup>\n      </ContextMenuPrimitive.Positioner>\n    </ContextMenuPortal>\n  );\n}\n\nexport function ContextMenuGroup(\n  props: ContextMenuPrimitive.Group.Props,\n): React.ReactElement {\n  return (\n    <ContextMenuPrimitive.Group data-slot=\"context-menu-group\" {...props} />\n  );\n}\n\nexport function ContextMenuItem({\n  className,\n  inset,\n  variant = \"default\",\n  ...props\n}: ContextMenuPrimitive.Item.Props & {\n  inset?: boolean;\n  variant?: \"default\" | \"destructive\";\n}): React.ReactElement {\n  return (\n    <ContextMenuPrimitive.Item\n      className={cn(\n        \"flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0\",\n        className,\n      )}\n      data-inset={inset}\n      data-slot=\"context-menu-item\"\n      data-variant={variant}\n      {...props}\n    />\n  );\n}\n\nexport function ContextMenuLinkItem({\n  className,\n  inset,\n  variant = \"default\",\n  closeOnClick = true,\n  ...props\n}: ContextMenuPrimitive.LinkItem.Props & {\n  inset?: boolean;\n  variant?: \"default\" | \"destructive\";\n}): React.ReactElement {\n  return (\n    <ContextMenuPrimitive.LinkItem\n      className={cn(\n        \"flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0\",\n        className,\n      )}\n      closeOnClick={closeOnClick}\n      data-inset={inset}\n      data-slot=\"context-menu-link-item\"\n      data-variant={variant}\n      {...props}\n    />\n  );\n}\n\nexport function ContextMenuCheckboxItem({\n  className,\n  children,\n
```

**File**: `apps/ui/public/r/drawer.json` (modified, +2/-2)
```diff
@@ -11,9 +11,9 @@
   "files": [
     {
       "path": "registry/default/ui/drawer.tsx",
-      "content": "\"use client\";\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\";\nimport { Drawer as DrawerPrimitive } from \"@base-ui/react/drawer\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Radio as RadioPrimitive } from \"@base-ui/react/radio\";\nimport { RadioGroup as RadioGroupPrimitive } from \"@base-ui/react/radio-group\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { ChevronRightIcon, XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { createContext, useContext } from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype DrawerPosition = \"right\" | \"left\" | \"top\" | \"bottom\";\n\nconst DrawerContext: React.Context<{ position: DrawerPosition }> =\n  createContext<{ position: DrawerPosition }>({\n    position: \"bottom\",\n  });\n\nconst directionMap: Record<\n  DrawerPosition,\n  DrawerPrimitive.Root.Props[\"swipeDirection\"]\n> = {\n  bottom: \"down\",\n  left: \"left\",\n  right: \"right\",\n  top: \"up\",\n};\n\nexport const DrawerCreateHandle: typeof DrawerPrimitive.createHandle =\n  DrawerPrimitive.createHandle;\n\nexport function Drawer({\n  swipeDirection,\n  position = \"bottom\",\n  ...props\n}: DrawerPrimitive.Root.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  return (\n    <DrawerContext.Provider value={{ position }}>\n      <DrawerPrimitive.Root\n        swipeDirection={swipeDirection ?? directionMap[position]}\n        {...props}\n      />\n    </DrawerContext.Provider>\n  );\n}\n\nexport const DrawerPortal: typeof DrawerPrimitive.Portal =\n  DrawerPrimitive.Portal;\n\nexport function DrawerTrigger(\n  props: DrawerPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Trigger data-slot=\"drawer-trigger\" {...props} />;\n}\n\nexport function DrawerClose(\n  props: DrawerPrimitive.Close.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Close data-slot=\"drawer-close\" {...props} />;\n}\n\nexport function DrawerSwipeArea({\n  className,\n  position: positionProp,\n  ...props\n}: DrawerPrimitive.SwipeArea.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  const { position: contextPosition } = useContext(DrawerContext);\n  const position = positionProp ?? contextPosition;\n\n  return (\n    <DrawerPrimitive.SwipeArea\n      className={cn(\n        \"fixed z-50 touch-none\",\n        position === \"bottom\" && \"inset-x-0 bottom-0 h-8\",\n        position === \"top\" && \"inset-x-0 top-0 h-8\",\n        position === \"left\" && \"inset-y-0 left-0 w-8\",\n        position === \"right\" && \"inset-y-0 right-0 w-8\",\n        className,\n      )}\n      data-slot=\"drawer-swipe-area\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerBackdrop({\n  className,\n  ...props\n}: DrawerPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DrawerPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-sm transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"drawer-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerViewport({\n  className,\n  position,\n  variant = \"default\",\n  ...props\n}: DrawerPrimitive.Viewport.Props & {\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <DrawerPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]\",\n        \"touch-none\",\n        position === \"bottom\" &&\n          \"grid grid-rows-[1fr_auto] pt-[max(--spacing(2),env(safe-area-inset-top,0px))]\",\n        position === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        position === \"left\" && \"flex justify-start\",\n        position === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"px-(--inset) sm:[--inset:--spacing(4)]\",\n        variant === \"inset\" && position !== \"bottom\" && \"pt-(--inset)\",\n        variant === \"inset\" && position !== \"top\" && \"pb-(--inset)\",\n        className,\n      )}\n      data-slot=\"drawer-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerPopup({\n  className,\n  children,\n  showCloseButton = false,\n  position: positionProp,\n  variant = \"default\",\n  showBar = false,\n  portalProps,\n  ...props\n}: DrawerPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  position?: DrawerPosition;\
```

**File**: `apps/ui/public/r/menu.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/menu.tsx",
-      "content": "\"use client\";\n\nimport { Menu as MenuPrimitive } from \"@base-ui/react/menu\";\nimport { ChevronRightIcon } from \"lucide-react\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport const MenuCreateHandle: typeof MenuPrimitive.createHandle =\n  MenuPrimitive.createHandle;\n\nexport const Menu: typeof MenuPrimitive.Root = MenuPrimitive.Root;\n\nexport const MenuPortal: typeof MenuPrimitive.Portal = MenuPrimitive.Portal;\n\nexport function MenuTrigger({\n  className,\n  children,\n  ...props\n}: MenuPrimitive.Trigger.Props): React.ReactElement {\n  return (\n    <MenuPrimitive.Trigger\n      className={className}\n      data-slot=\"menu-trigger\"\n      {...props}\n    >\n      {children}\n    </MenuPrimitive.Trigger>\n  );\n}\n\nexport function MenuPopup({\n  children,\n  className,\n  sideOffset = 4,\n  align = \"center\",\n  alignOffset,\n  side = \"bottom\",\n  anchor,\n  portalProps,\n  ...props\n}: MenuPrimitive.Popup.Props & {\n  align?: MenuPrimitive.Positioner.Props[\"align\"];\n  sideOffset?: MenuPrimitive.Positioner.Props[\"sideOffset\"];\n  alignOffset?: MenuPrimitive.Positioner.Props[\"alignOffset\"];\n  side?: MenuPrimitive.Positioner.Props[\"side\"];\n  anchor?: MenuPrimitive.Positioner.Props[\"anchor\"];\n  portalProps?: MenuPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <MenuPortal {...portalProps}>\n      <MenuPrimitive.Positioner\n        align={align}\n        alignOffset={alignOffset}\n        anchor={anchor}\n        className=\"z-50\"\n        data-slot=\"menu-positioner\"\n        side={side}\n        sideOffset={sideOffset}\n      >\n        <MenuPrimitive.Popup\n          className={cn(\n            \"relative flex not-[class*='w-']:min-w-32 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            className,\n          )}\n          data-slot=\"menu-popup\"\n          {...props}\n        >\n          <div className=\"max-h-(--available-height) w-full overflow-y-auto p-1\">\n            {children}\n          </div>\n        </MenuPrimitive.Popup>\n      </MenuPrimitive.Positioner>\n    </MenuPortal>\n  );\n}\n\nexport function MenuGroup(\n  props: MenuPrimitive.Group.Props,\n): React.ReactElement {\n  return <MenuPrimitive.Group data-slot=\"menu-group\" {...props} />;\n}\n\nexport function MenuItem({\n  className,\n  inset,\n  variant = \"default\",\n  ...props\n}: MenuPrimitive.Item.Props & {\n  inset?: boolean;\n  variant?: \"default\" | \"destructive\";\n}): React.ReactElement {\n  return (\n    <MenuPrimitive.Item\n      className={cn(\n        \"flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0\",\n        className,\n      )}\n      data-inset={inset}\n      data-slot=\"menu-item\"\n      data-variant={variant}\n      {...props}\n    />\n  );\n}\n\nexport function MenuLinkItem({\n  className,\n  inset,\n  variant = \"default\",\n  closeOnClick = true,\n  ...props\n}: MenuPrimitive.LinkItem.Props & {\n  inset?: boolean;\n  variant?: \"default\" | \"destructive\";\n}): React.ReactElement {\n  return (\n    <MenuPrimitive.LinkItem\n      className={cn(\n        \"flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0\",\n        className,\n      )}\n      closeOnClick={closeOnClick}\n      data-inset={inset}\n      data-slot=\"menu-link-item\"\n      data-variant={variant}\n      {...props}\n    />\n  );\n}\n\nexport function MenuCheckboxItem({\n  className,\n  children,\n  checked,\n  variant = \"default\",\n  ...props\n}: MenuPrimitive.CheckboxItem.Props & {\n  variant?: \"default\" | \"switch\";\n}): React.ReactElement {\n  return (\n    <MenuPrimitive.CheckboxItem\n      checked={checked}\n      c
```

**File**: `apps/ui/registry/default/ui/context-menu.tsx` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ export function ContextMenuCheckboxItem({
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
           >
-            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=context-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=context-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=context-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=context-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
+            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=context-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=context-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=context-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=context-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] rtl:in-[[data-slot=context-menu-checkbox-item][data-checked]]:origin-left rtl:origin-right rtl:in-[[data-slot=context-menu-checkbox-item][data-checked]]:-translate-x-[calc(var(--thumb-size)-4px)]" />
           </ContextMenuPrimitive.CheckboxItemIndicator>
         </>
       ) : (
```

**File**: `apps/ui/registry/default/ui/drawer.tsx` (modified, +1/-1)
```diff
@@ -552,7 +552,7 @@ export function DrawerMenuCheckboxItem({
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] col-start-2 inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
           >
-            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=drawer-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=drawer-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
+            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=drawer-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=drawer-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] rtl:in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:origin-left rtl:origin-right rtl:in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:-translate-x-[calc(var(--thumb-size)-4px)]" />
           </CheckboxPrimitive.Indicator>
         </>
       ) : (
```

**File**: `apps/ui/registry/default/ui/menu.tsx` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ export function MenuCheckboxItem({
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
           >
-            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
+            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] rtl:in-[[data-slot=menu-checkbox-item][data-checked]]:origin-left rtl:origin-right rtl:in-[[data-slot=menu-checkbox-item][data-checked]]:-translate-x-[calc(var(--thumb-size)-4px)]" />
           </MenuPrimitive.CheckboxItemIndicator>
         </>
       ) : (
```

**File**: `packages/ui/src/components/context-menu.tsx` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ export function ContextMenuCheckboxItem({
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
           >
-            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=context-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=context-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=context-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=context-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
+            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=context-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=context-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=context-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=context-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] rtl:in-[[data-slot=context-menu-checkbox-item][data-checked]]:origin-left rtl:origin-right rtl:in-[[data-slot=context-menu-checkbox-item][data-checked]]:-translate-x-[calc(var(--thumb-size)-4px)]" />
           </ContextMenuPrimitive.CheckboxItemIndicator>
         </>
       ) : (
```

**File**: `packages/ui/src/components/drawer.tsx` (modified, +1/-1)
```diff
@@ -552,7 +552,7 @@ export function DrawerMenuCheckboxItem({
             className="inset-shadow-[0_1px_--theme(--color-black/4%)] col-start-2 inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
             keepMounted
           >
-            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=drawer-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=drawer-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
+            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=drawer-menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=drawer-menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] rtl:in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:origin-left rtl:origin-right rtl:in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:-translate-x-[calc(var(--thumb-size)-4px)]" />
           </CheckboxPrimitive.Indicator>
         </>
       ) : (
```

---

### Incident Patch 2: `a5234452` (2026-10-15)
**Commit Message**: fix(ui): mirror switch thumb in right-to-left layouts (#869)

In RTL, the checked switch thumb translated in the physical direction and
overflowed the track. Mirror its travel and press-scale origin with rtl:
variants. LTR output is unchanged.

**File**: `apps/ui/public/r/switch.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/switch.tsx",
-      "content": "\"use client\";\n\nimport { Switch as SwitchPrimitive } from \"@base-ui/react/switch\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport function Switch({\n  className,\n  ...props\n}: SwitchPrimitive.Root.Props): React.ReactElement {\n  return (\n    <SwitchPrimitive.Root\n      className={cn(\n        \"inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(5)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(4)]\",\n        className,\n      )}\n      data-slot=\"switch\"\n      {...props}\n    >\n      <SwitchPrimitive.Thumb\n        className={cn(\n          \"pointer-events-none block aspect-square h-full origin-left in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[calc(var(--thumb-size)-4px)]\",\n        )}\n        data-slot=\"switch-thumb\"\n      />\n    </SwitchPrimitive.Root>\n  );\n}\n\nexport { SwitchPrimitive };\n",
+      "content": "\"use client\";\n\nimport { Switch as SwitchPrimitive } from \"@base-ui/react/switch\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport function Switch({\n  className,\n  ...props\n}: SwitchPrimitive.Root.Props): React.ReactElement {\n  return (\n    <SwitchPrimitive.Root\n      className={cn(\n        \"inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(5)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(4)]\",\n        className,\n      )}\n      data-slot=\"switch\"\n      {...props}\n    >\n      <SwitchPrimitive.Thumb\n        className={cn(\n          \"pointer-events-none block aspect-square h-full origin-left in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[calc(var(--thumb-size)-4px)] rtl:origin-right rtl:data-checked:origin-left rtl:data-checked:-translate-x-[calc(var(--thumb-size)-4px)]\",\n        )}\n        data-slot=\"switch-thumb\"\n      />\n    </SwitchPrimitive.Root>\n  );\n}\n\nexport { SwitchPrimitive };\n",
       "type": "registry:ui"
     }
   ],
```

**File**: `apps/ui/registry/default/ui/switch.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ export function Switch({
     >
       <SwitchPrimitive.Thumb
         className={cn(
-          "pointer-events-none block aspect-square h-full origin-left in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[calc(var(--thumb-size)-4px)]",
+          "pointer-events-none block aspect-square h-full origin-left in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[calc(var(--thumb-size)-4px)] rtl:origin-right rtl:data-checked:origin-left rtl:data-checked:-translate-x-[calc(var(--thumb-size)-4px)]",
         )}
         data-slot="switch-thumb"
       />
```

**File**: `packages/ui/src/components/switch.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ export function Switch({
     >
       <SwitchPrimitive.Thumb
         className={cn(
-          "pointer-events-none block aspect-square h-full origin-left in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[calc(var(--thumb-size)-4px)]",
+          "pointer-events-none block aspect-square h-full origin-left in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[calc(var(--thumb-size)-4px)] rtl:origin-right rtl:data-checked:origin-left rtl:data-checked:-translate-x-[calc(var(--thumb-size)-4px)]",
         )}
         data-slot="switch-thumb"
       />
```

---

### Incident Patch 3: `a597c630` (2026-10-16)
**Commit Message**: docs(skill): fix footer order, async confirms, and field validation guidance (#894)

- drawer: put Cancel before the primary action in the footer example and
  explain the flex-col-reverse / sm:flex-row ordering.
- alert-dialog: add the async confirmation pattern (controlled open, confirm
  as a loading Button, close on success, Cancel stays AlertDialogClose).
- card: document CardAction and the CardFrame family (header, title,
  description, action, footer) with particle references.
- field: show the React Hook Form variant (noValidate, no constraint
  attributes, invalid + FieldError children) and explain why native or
  Base UI constraint validation blocks the library's submit handler.
- tooltip/button: document the span-wrapper trigger for explaining a
  disabled button, since disabled buttons get no hover or focus.
- menu: destructive items go last after a separator; confirms open a
  sibling AlertDialog controlled by state, never one nested in MenuPopup.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/ui/skills/coss/references/primitives/alert-dialog.md` (modified, +50/-1)
```diff
@@ -62,19 +62,68 @@ import {
 </AlertDialog>
 ```
 
+`AlertDialogClose` closes the dialog as soon as it is clicked, so use it as the confirm only when the action is synchronous. For async work, see **Async confirmation** below.
+
 ## Patterns from coss particles
 
 - **Portal forwarding**: optional `portalProps` on `AlertDialogPopup` → Base UI `AlertDialog.Portal` (`keepMounted`, `container`, …). See [portal-props.md](../portal-props.md).
 - **Section structure**: keep `AlertDialogHeader` and `AlertDialogFooter` as direct sections of `AlertDialogPopup` (there is no `AlertDialogPanel`; add a `div` or fragment between them only if you need extra body content).
-- **Action composition**: use `AlertDialogClose render={<Button ... />}` for cancel/confirm actions to preserve button semantics and styling.
+- **Action composition**: use `AlertDialogClose render={<Button ... />}` for Cancel and for synchronous confirms to preserve button semantics and styling.
 - **Destructive affordance**: pair destructive trigger/confirm variants (`destructive-outline`, `destructive`) for clear risk signaling.
 - **Footer variants**: use `AlertDialogFooter variant="bare"` when border/background framing should be removed.
 - **Close confirmation chain**: for unsaved changes in broader workflows, pair with dialog flows like `p-dialog-4`.
 
+### Key patterns
+
+Async confirmation (the dialog stays open until the mutation settles):
+
+```tsx
+const [open, setOpen] = useState(false)
+const [isPending, setIsPending] = useState(false)
+
+async function handleDelete() {
+  setIsPending(true)
+  try {
+    await deleteAccount()
+    setOpen(false)
+  } catch {
+    // Keep the dialog open so the user can retry; surface the error (e.g. a toast).
+  } finally {
+    setIsPending(false)
+  }
+}
+
+<AlertDialog onOpenChange={setOpen} open={open}>
+  <AlertDialogTrigger render={<Button variant="destructive-outline" />}>
+    Delete Account
+  </AlertDialogTrigger>
+  <AlertDialogPopup>
+    <AlertDialogHeader>
+      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
+      <AlertDialogDescription>
+        This action cannot be undone.
+      </AlertDialogDescription>
+    </AlertDialogHeader>
+    <AlertDialogFooter>
+      <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
+      <Button loading={isPending} onClick={handleDelete} variant="destructive">
+        Delete Account
+      </Button>
+    </AlertDialogFooter>
+  </AlertDialogPopup>
+</AlertDialog>
+```
+
+- The confirm is a plain `Button` (not `AlertDialogClose`) with `loading`, which disables it and shows the spinner while the request runs.
+- Close the dialog from the success path (`setOpen(false)`); on failure keep it open so the user can retry.
+- Cancel stays an `AlertDialogClose` ghost button. Keep Cancel first in source: the footer is `flex-col-reverse` / `sm:flex-row sm:justify-end`, so the confirm renders on the right (or on top when stacked).
+- With a query library, use its pending state (for example `mutation.isPending`) instead of local state.
+
 ## Common pitfalls
 
 - Using AlertDialog as a generic content modal instead of high-risk confirmation UI.
 - Omitting explicit destructive/cancel action distinction.
+- Confirming an async action with `AlertDialogClose`: the dialog closes before the mutation settles, so there is no loading state and nowhere to show a failure.
 - Wrapping dialog sections in extra containers that break built-in layout (use `className="contents"` only when needed).
 - Mixing Dialog/Popover composition APIs without validating this primitive's parts.
 - Skipping focus-return and escape-key verification on real trigger flows.
```

**File**: `apps/ui/skills/coss/references/primitives/button.md` (modified, +1/-0)
```diff
@@ -99,6 +99,7 @@ Prefer the `loading` prop for typical async actions. Use the composite approach
 
 - Omitting explicit `type` inside forms/dialogs and triggering unintended submit behavior.
 - Using icon-only buttons without `aria-label` on the button.
+- Expecting a disabled button to show a tooltip: `disabled` sets the native attribute plus `pointer-events-none`, so the button gets no hover or focus. Wrap it in a focusable `span` rendered as the `TooltipTrigger` (see [tooltip.md](./tooltip.md)).
 - Rebuilding button state styling with ad-hoc classes instead of variants/sizes.
 - Using `SelectButton` as if it were a general-purpose `Button`; `SelectButton` is a select-flavored trigger helper and should be treated as a `select`/`combobox` pattern.
 
```

**File**: `apps/ui/skills/coss/references/primitives/card.md` (modified, +43/-1)
```diff
@@ -22,14 +22,23 @@ Manual deps from docs:
 ```tsx
 import {
   Card,
+  CardAction,
   CardDescription,
   CardFooter,
+  CardFrame,
+  CardFrameAction,
+  CardFrameDescription,
+  CardFrameFooter,
+  CardFrameHeader,
+  CardFrameTitle,
   CardHeader,
   CardPanel,
   CardTitle,
 } from "@/components/ui/card"
 ```
 
+`CardPanel` is also exported as `CardContent`.
+
 ## Minimal pattern
 
 ```tsx
@@ -70,16 +79,49 @@ Card with form content:
 
 Keep `CardHeader`, `CardPanel`, and `CardFooter` as direct children of `Card` to preserve built-in spacing and layout.
 
+Put header actions in `CardAction`, a sibling of `CardTitle` and `CardDescription` inside `CardHeader`; it is placed top-right via the header grid.
+
+### CardFrame
+
+`CardFrame` is a muted outer shell with its own header and footer around one or more inner `Card`s (or a `Table variant="card"`). Use it when a section needs a title row, an optional action, and a footnote outside the main surface.
+
+```tsx
+<CardFrame>
+  <CardFrameHeader>
+    <CardFrameTitle>Projects</CardFrameTitle>
+    <CardFrameDescription>Manage your projects</CardFrameDescription>
+    <CardFrameAction>
+      <Button variant="outline">
+        <PlusIcon aria-hidden="true" />
+        Add
+      </Button>
+    </CardFrameAction>
+  </CardFrameHeader>
+  <Card>
+    <CardPanel>Content</CardPanel>
+  </Card>
+  <CardFrameFooter>Footnote or secondary info</CardFrameFooter>
+</CardFrame>
+```
+
+- Keep `CardFrameHeader`, the inner `Card`(s), and `CardFrameFooter` as direct children of `CardFrame`; the frame clips, rounds, and removes shadows on direct `Card` children only.
+- `CardFrameAction` goes inside `CardFrameHeader` as a sibling of the title and description; it sits in the second grid column, vertically centered.
+- Do not use `CardHeader`/`CardFooter` on the frame itself; those belong to the inner `Card`.
+- For tables, render `Table variant="card"` as a direct child of `CardFrame` (see table guide, `p-table-6` through `p-table-8`).
+
 ### More examples
 
-See `p-card-1` through `p-card-8` for various card compositions.
+See `p-card-1` through `p-card-11` for various card compositions.
 
 ## Common pitfalls
 
 - Skipping `CardHeader`/`CardPanel`/`CardFooter` structure in composed cards.
 - Mixing unrelated layout wrappers that break spacing between card sections.
 - Using cards as generic wrappers when `Frame` or plain layout would be clearer.
+- Nesting a `Card` inside another wrapper within `CardFrame`, which skips the frame's clipping and radius rules for direct `Card` children.
 
 ## Useful particle references
 
 - core patterns: `p-card-1`, `p-card-2`, `p-card-3`, `p-card-4`, `p-card-5`, `p-card-6`, `p-card-7`, `p-card-8`
+- `CardFrame` with footer: `p-card-4`; with header: `p-card-5`; header + footer: `p-card-6`, `p-card-7`
+- `CardFrame` with header action: `p-card-11`
```

**File**: `apps/ui/skills/coss/references/primitives/drawer.md` (modified, +4/-1)
```diff
@@ -87,13 +87,15 @@ Drawer with a visible drag handle:
       {/* Form content */}
     </DrawerPanel>
     <DrawerFooter>
-      <Button>Save</Button>
       <DrawerClose render={<Button variant="ghost" />}>Cancel</DrawerClose>
+      <Button>Save</Button>
     </DrawerFooter>
   </DrawerPopup>
 </Drawer>
 ```
 
+**Footer action order**: write Cancel first and the primary action last. `DrawerFooter` is `flex-col-reverse` on mobile and `sm:flex-row sm:justify-end` from `sm` up, so source order puts the primary action on the right on desktop and on top when stacked. The same applies to `DialogFooter` and `AlertDialogFooter`.
+
 Responsive drawer + dialog (drawer on mobile, dialog on desktop): see `p-drawer-12`.
 
 ### More examples
@@ -104,6 +106,7 @@ See `p-drawer-1` through `p-drawer-13` for inset, straight, scrollable, nested,
 
 - Choosing Sheet for desktop side panels; use Drawer. Use Dialog for centered modal flows.
 - Forgetting responsive switch logic when drawer is mobile-only variant.
+- Putting the primary action before Cancel in `DrawerFooter`; the reversed mobile stack then puts Cancel on top and the primary on the left on desktop.
 - Breaking section layout by putting the whole dialog in a block-level `<form>`; prefer **header outside**, **`Form className="contents"`** around **panel + footer** (see dialog/form skills).
 
 ## Useful particle references
```

**File**: `apps/ui/skills/coss/references/primitives/field.md` (modified, +30/-2)
```diff
@@ -50,17 +50,44 @@ import { Input } from "@/components/ui/input"
 
 ### Key patterns
 
-Required field with error:
+Required field with error (Base UI constraint validation):
 
 ```tsx
 <Field name="email">
-  <FieldLabel>Email *</FieldLabel>
+  <FieldLabel>
+    Email <span className="text-destructive-foreground">*</span>
+  </FieldLabel>
   <Input type="email" required placeholder="name@company.com" />
   <FieldDescription>We'll never share your email.</FieldDescription>
   <FieldError>Please enter a valid email.</FieldError>
 </Field>
 ```
 
+Native constraint attributes (`required`, `type="email"`, `min`, `pattern`, …) are the validation source here: `Field` reads the control's `ValidityState` and `FieldError` renders when it fails. Use this only when the browser constraints are the single source of truth.
+
+Required field with React Hook Form (or another schema/form library):
+
+```tsx
+const { formState: { errors }, handleSubmit, register } = useForm<Values>({
+  resolver: zodResolver(schema),
+})
+
+<form noValidate onSubmit={handleSubmit(onSubmit)}>
+  <Field invalid={!!errors.email} name="email">
+    <FieldLabel>
+      Email <span className="text-destructive-foreground">*</span>
+    </FieldLabel>
+    <Input type="email" {...register("email")} placeholder="name@company.com" />
+    <FieldError>{errors.email?.message}</FieldError>
+  </Field>
+</form>
+```
+
+- Let the library own validation: drop `required` (and other constraint attributes like `min`/`max`/`pattern`) from the control and express them in the schema.
+- Use a plain `<form noValidate>`. Without `noValidate`, the browser's native validation blocks submit and shows its own bubble before `handleSubmit` runs; with it, `type="email"` can stay for the mobile keyboard and autofill.
+- If you wrap the fields in coss `Form` instead: it already sets `noValidate`, but each `Field` inside it still runs native constraint checks on submit (including `type="email"` mismatches) and cancels the submit, focusing the first invalid control, before your `onSubmit` handler fires. Remove every constraint attribute in that case (use `inputMode="email"` for the keyboard).
+- Drive the error state from the library: `invalid` on `Field` and the message as `FieldError` children. The asterisk is visual only; the schema enforces it.
+
 Field wrapping an autocomplete:
 
 ```tsx
@@ -86,6 +113,7 @@ See `p-field-1` through `p-field-9` for required, disabled, error, validity, inp
 
 - Rendering errors detached from the related control, breaking context.
 - Missing `name` in form flows, causing silent submit omissions.
+- Mixing native constraint attributes (`required`, `min`, `pattern`) with React Hook Form or another schema validator; native/Base UI validation runs first and the library's errors never show.
 - Using field wrapper without corresponding label/description/error semantics.
 
 ## Useful particle references
```

**File**: `apps/ui/skills/coss/references/primitives/menu.md` (modified, +29/-1)
```diff
@@ -62,6 +62,31 @@ import {
 
 Use popup positioning props like `align` / `sideOffset` only when a layout needs explicit tuning.
 
+Destructive item with confirmation:
+
+```tsx
+const [confirmOpen, setConfirmOpen] = useState(false)
+
+<>
+  <Menu>
+    <MenuTrigger render={<Button aria-label="Project actions" size="icon" variant="ghost" />}>
+      <EllipsisIcon aria-hidden="true" />
+    </MenuTrigger>
+    <MenuPopup align="end">
+      <MenuItem>Rename</MenuItem>
+      <MenuItem>Duplicate</MenuItem>
+      <MenuSeparator />
+      <MenuItem onClick={() => setConfirmOpen(true)} variant="destructive">
+        Delete
+      </MenuItem>
+    </MenuPopup>
+  </Menu>
+  <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
+    <AlertDialogPopup>{/* header + footer, see alert-dialog.md */}</AlertDialogPopup>
+  </AlertDialog>
+</>
+```
+
 ## Patterns from coss particles
 
 - **Portal forwarding**: optional `portalProps` on `MenuPopup` → Base UI `Menu.Portal` (`keepMounted`, `container`, …). See [portal-props.md](../portal-props.md).
@@ -72,7 +97,8 @@ Use popup positioning props like `align` / `sideOffset` only when a layout needs
 - Use `MenuCheckboxItem variant="switch"` for toggle-style preferences.
 - Use `MenuRadioGroup` + `MenuRadioItem` with a `defaultValue` when enforcing single-choice selection.
 - Use `MenuShortcut` to display keyboard hints in dense command menus.
-- Use `variant="destructive"` on dangerous actions.
+- Use `variant="destructive"` on dangerous actions, and put them last, after a `MenuSeparator`, so they are visually apart from routine actions and harder to hit by accident.
+- When an item needs confirmation (e.g. Delete), the item only sets state; render the `AlertDialog` (or `Dialog`) as a sibling of `Menu`, controlled by `open` / `onOpenChange`. Never nest the dialog inside `MenuPopup`: the popup unmounts when the menu closes, taking the dialog with it. See `p-dialog-2`.
 - For responsive action menus, keep desktop on `Menu` and switch mobile to `DrawerMenu` / `DrawerMenuTrigger` / `DrawerMenuItem` patterns.
 - In `DrawerMenu` flows, wrap actionable rows with `DrawerClose render={<DrawerMenuItem />}` when selection should dismiss the drawer.
 
@@ -81,6 +107,8 @@ Use popup positioning props like `align` / `sideOffset` only when a layout needs
 - Forgetting `MenuGroup` around grouped structures.
 - Missing submenu pair (`MenuSubTrigger` + `MenuSubPopup`) for nested actions.
 - Mixing navigation and action items without clear close behavior (`closeOnClick`) and semantics.
+- Placing destructive items in the middle of the list or without a separator.
+- Nesting an `AlertDialog`/`Dialog` (or its trigger) inside `MenuPopup` for a confirm step; keep it a sibling of `Menu` driven by state.
 
 ## Useful particle references
 
```

**File**: `apps/ui/skills/coss/references/primitives/tooltip.md` (modified, +17/-0)
```diff
@@ -63,6 +63,22 @@ Tooltip on an icon-only button:
 </Tooltip>
 ```
 
+Tooltip explaining why a button is disabled:
+
+```tsx
+<Tooltip>
+  <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>
+    <Button disabled>Publish</Button>
+  </TooltipTrigger>
+  <TooltipPopup>Add a title before publishing</TooltipPopup>
+</Tooltip>
+```
+
+- A disabled `Button` sets the native `disabled` attribute and `pointer-events-none`, so it never receives hover or focus. Putting `TooltipTrigger render={<Button disabled />}` directly on it means the tooltip never opens.
+- Render the trigger as a wrapper `span` instead (`TooltipTrigger` renders a `<button>` by default, which cannot contain another button). Hover passes through the disabled button to the span.
+- `tabIndex={0}` keeps the reason reachable by keyboard, since the disabled button is skipped in tab order. Use `inline-flex` (or `block`/`w-full` for full-width buttons) so the wrapper matches the button's box.
+- When the button becomes enabled, drop the wrapper or render the tooltip only while disabled, so the span does not add an extra tab stop.
+
 Grouped tooltips (shared delay/provider):
 
 ```tsx
@@ -87,6 +103,7 @@ See `p-tooltip-1` through `p-tooltip-3` for basic, grouped, and animated tooltip
 - Placing interactive controls inside tooltip content (tooltip should stay informational).
 - Relying on tooltip as sole label for icon-only controls (still provide accessible name).
 - Using tooltip for long-form content that should be popover/dialog.
+- Attaching a tooltip trigger directly to a disabled button; wrap it in a focusable `span` trigger instead (see above).
 
 ## Useful particle references
 
```

#### Recent Merged Pull Requests:
- **PR #909** (2026-10-22): fix(composer): show the default cursor when the composer is disabled (@pasqualevitiello)
- **PR #908** (2026-10-20): chore(ui): remove aria-label attributes from autocomplete and combobox (@pasqualevitiello)
- **PR #907** (2026-10-21): refactor(segmented-control): ship as a render-prop component (@pasqualevitiello)
- **PR #906** (2026-10-20): feat(segmented-control): animated selection indicator like Tabs (@uixmat)
- **PR #904** (2026-10-19): feat(avatar): AvatarGroup with clipped separation and inherited sizing (@pasqualevitiello)
- **PR #903** (closed): feat(agent): approval cards, response feedback, and error recovery (@pasqualevitiello)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
