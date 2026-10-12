> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cosscom-ui-learnings.md`  
> **Source**: github ([https://github.com/cosscom/ui](https://github.com/cosscom/ui))  
> **Source Version**: `28645cd8`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-12T19:59:38.556Z  
> **Learning ID**: `learn-github-cosscom-ui-mv5oegcc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cosscom/ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/cosscom-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cosscom/ui](https://github.com/cosscom/ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-12T19:59:37.373Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cosscom/ui`
- **Description**: coss.com/ui is the official design system of Cal.com
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10686 stars

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
- **Issue #867** (2026-10-12): **fix(ui): preserve composer focus and align border radii**
  *Symptoms*: ## What & why  Port the shared Composer fixes from [calcom/cal#10182](https://github.com/calcom/cal/pull/10182). Clicking Send while the editor is focused now preserves that focus, avoiding iOS keyboard dismissal. The frame and its `::before` layer share `--composer-radius`, retaining the inner layer's 1px inset when consumers customize roundness.  Updates the registry source, generated installable Composer JSON, and package copy. This PR targets `main`; chat-specific reply, reaction, menu, and drawer-demo changes are excluded because those components are not on main yet. #858 is unchanged. No tests are added under the UI source folders.  ## Validation  - Docs app and UI package TypeScript checks pass. - Registry dependency validation, registry generation, and package synchronization pass. - Focused Biome check and `git diff --check` pass. - Chrome: sending from both the native textarea and adaptive contenteditable examples clears the draft and leaves the input focused. Computed radii are 14px outer / 13px inner. - iOS device behavior needs confirmation on this Coss branch; browser checks do not emulate the software keyboard. Full build and screenshots skipped as requested.  ## Risk & rollback  Pointer submission changes only when the primary pointer is pressed while this Composer's input is already focused. Keyboard activation retains its existing behavior. Revert this PR to restore the previous focus and radius handling; no dependencies or migrations change. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #LG61N2C6RvWlhozqmRCnfDiS3YVWpn9qG4S8iiW6vhI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWNvZGV4LWNvbXBvc2VyLWZvY3VzLXJhZGl1cy1jYWwudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpL0VmZWIzbllxNkJibmJpUlZHc2Q3b2dWeGJvdTEiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LWNvZGV4LWNvbXBvc2VyLWZvY3VzLXJhZGl1cy1jYWwudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6ImNvc3MtZXhhbXBsZXMtY2FsY29tIiwicHJvamVjdElkIjoicHJqX3ZOWU45MGY1bENiS2pwM2V3UnpJc2JZVW1sd00iLCJyb290RGlyZWN0b3J5IjoiYXBwcy9leGFtcGxlcy9jYWxjb20iLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1leGFtcGxlcy1jYWxjb20tZ2l0LWNvZGV4LWNvbXBvc2VyLWZvY3VzLXJhZGl1cy1jYWwudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JV
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/PRO-2553">PRO-2553</a></p>

- **Issue #866** (2026-10-12): **chore: add @pasqualevitiello as CODEOWNER for apps/ui**
  *Symptoms*: Adds a `.github/CODEOWNERS` file assigning @pasqualevitiello as owner of all files under `apps/ui/`.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5941">ENG-5941</a></p>
  > [vc]: #ZMcuDFcGSKW7HHXDSCLsTNpBwk59eDHe+MCosZomIHc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWNsYXVkZS1jb2Rlb3duZXItYXBwcy11aS0zMmU2OTAtY2FsLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS11aS9FU3ZkNHRCR1Y2bmJSemRjRjZRY3RzeDhrSnA0IiwicHJldmlld1VybCI6ImNvc3MtY29tLXVpLWdpdC1jbGF1ZGUtY29kZW93bmVyLWFwcHMtdWktMzJlNjkwLWNhbC52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoiY29zcy1jb20tb3JpZ2luIiwicHJvamVjdElkIjoicHJqX3owZHhSdlljOXFrZlNuUlBKaGh4T3BkeGVybVUiLCJyb290RGlyZWN0b3J5IjoiYXBwcy9vcmlnaW4iLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tb3JpZ2luLWdpdC1jbGF1ZGUtY29kZW93bmVyLWFwcHMtdWktMzJlNjkwLWNhbC52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0

- **Issue #865** (2026-10-12): **style(ui): match composer chrome to textarea**
  *Symptoms*: ## Summary - Give Composer the same field chrome as textarea and input: the inner `::before` border highlight, `bg-clip-padding`, dark `bg-input/32` fill, and focus/disabled/invalid ring and shadow treatments. - Apply the usual 1px padding compensation against the border, and keep pill-shaped particles (`p-composer-9`, `p-composer-11`) in sync with a matching `before` radius.  ## Test plan - [ ] Compare Composer and Textarea on `/ui/docs/components/composer` and `/ui/docs/components/textarea` in light and dark: top/bottom highlight, fill, and drop shadow should match. - [ ] Focus the stacked and adaptive composers and confirm the 3px ring appears and the inner highlight/drop shadow go away. - [ ] Check `p-composer-9` and `p-composer-11` so the highlight follows the pill radius in both single-line and wrapped layouts. - [ ] Confirm disabled and `aria-invalid` states dim and use the destructive border/ring.   Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5940">ENG-5940</a></p>
  > [vc]: #buBeXWDtq2dhUM8cG3mcjjJwKR3V4ZClQ4CkRQn9LUk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LXN0eWxlLWNvbXBvc2VyLWZpZWxkLWNocm9tZS1jYWwudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpL0NCUUZqUEJrVWU4TEtES2pVQzI0NDFNaVBNVFQiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LXN0eWxlLWNvbXBvc2VyLWZpZWxkLWNocm9tZS1jYWwudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6ImNvc3MtY29tLW9yaWdpbiIsInByb2plY3RJZCI6InByal96MGR4UnZZYzlxa2ZTblJQSmhoeE9wZHhlcm1VIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvb3JpZ2luIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLW9yaWdpbi9OMzVvYWpSU1ZOeXJkRmVjWU1ERG9ReEtlYUVSIiwicHJldmll

- **Issue #863** (2026-10-12): **feat(shipyard): shipyard's website and docs at coss.com/shipyard**
  *Symptoms*: ## What  A new app, **`apps/shipyard`**, served at **coss.com/shipyard** the way coss ui is served at `/ui` (`basePath: "/shipyard"`).  **Landing page** (`/shipyard`): the page from berthd.app, under coss.com's header, rails and theme. - The dithered harbour that comes alive at night, the six chapters with the app's line scenes and loops, the install line. Its own type (Inter, JetBrains Mono) and tokens stay; night follows the site's theme switch instead of its own. - Header: `coss.com shipyard`, Docs, Download, the docs' search (⌘K), GitHub with cosscom/shipyard's stars, theme switch. - The film's lightbox is left out until the film is hosted.  **Docs** (`/shipyard/docs`): moved here from `cosscom/shipyard`'s `docs/` folder (47 pages), on the same Fumadocs setup as coss ui's docs: `source.config.ts`, docs layout, sidebar, search, table of contents, Copy Markdown, `.md` routes. Shipyard's own pieces are ported into `components/docs/`: callouts, the stage, the numbered path of cards, screenshots (light/dark), diagrams, the line scenes, and the rehype plugin that makes the reference tables linkable. Internal links are rewritten to `/docs/...`.  **Shared:** `SiteHeader` / `GitHubLink` take an optional `github={{ repo, href }}` so a product can point at its own repository (default unchanged). `siteConfig.products` has `shipyard`.  ## Stays on berthd.app (built from cosscom/shipyard)  The app downloads, the live demo (`berthd.app/demo/`), the box install line (`berthd.app/install`
  **Post-Mortem & Fix Analysis**:
  > [vc]: #UKTTFfk1y1WddNReTHC0P5mzHIqcWSmrg8EKWpjG2Mg=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS1vcmlnaW4iLCJwcm9qZWN0SWQiOiJwcmpfejBkeFJ2WWM5cWtmU25SUEpoaHhPcGR4ZXJtVSIsInJvb3REaXJlY3RvcnkiOiJhcHBzL29yaWdpbiIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tb3JpZ2luL0haOHh3d1ZlZkNvWVdnUnFFSENLcUxKUXZUM00iLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tb3JpZ2luLWdpdC1mZWF0LXNoaXB5YXJkLWFwcC1jYWwudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJjb3NzLWNvbS1vcmlnaW4tZ2l0LWZlYXQtc2hpcHlhcmQtYXBwLWNhbC52ZXJjZWwuYXBwIn19LHsibmFtZSI6ImNvc3MtY29tLXVpIiwicHJvamVjdElkIjoicHJqX1lWQ1Q2aUZYaGJLTGpQdG5INWtVU1hQOTQ5N3giLCJyb290RGlyZWN0b3J5IjoiYXBwcy91aSIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tdWkvNzh5YlVteTR4dFNXbkhIVkM5OU5nTHFURFpxZCIsInByZXZpZXdVcmwiOiJjb3NzLWNvbS11aS1naXQtZmVhdC1zaGlweWFyZC1hcHAtY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoi
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5928">ENG-5928</a></p>

- **Issue #862** (2026-10-12): **style(ui): use bold titles for overlays and empty states**
  *Symptoms*: ## Summary - Use `font-bold` for alert dialog, dialog, drawer, empty, and sheet titles. - Sync package components and rebuild registry JSON.  ## Checks - `bunx biome check` on affected registry components - `bun run ui:sync` - `bun run registry:build` - `git diff --check`
  **Post-Mortem & Fix Analysis**:
  > [vc]: #C6sxBeCTq5goaF3GfmXEcRgNobMU/++QLUQnMwqp0qo=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpLzZ6UzRWMXJBVkJkclhqSlJ2MTh2dDlOZ2JlMnYiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20tdWktZ2l0LWNvZGV4LWJvbGQtb3ZlcmxheS10aXRsZXMtY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWNvZGV4LWJvbGQtb3ZlcmxheS10aXRsZXMtY2FsLnZlcmNlbC5hcHAifX0seyJuYW1lIjoiY29zcy1jb20tb3JpZ2luIiwicHJvamVjdElkIjoicHJqX3owZHhSdlljOXFrZlNuUlBKaGh4T3BkeGVybVUiLCJyb290RGlyZWN0b3J5IjoiYXBwcy9vcmlnaW4iLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tb3JpZ2luLzVNSFZZSjJaZWtnTHNLeVFoUXQ2bTg3TVByQjIiLCJwcmV2aWV3VXJs
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/DES-228">DES-228</a></p>

- **Issue #861** (2026-10-12): **fix(ui): handle bottom drawer keyboards automatically**
  *Symptoms*: Bottom drawers now keep focused fields above the iOS software keyboard using Base UI's virtual keyboard provider. Partial snap points adjust while the keyboard is open and return to their selected position afterward. The scroll viewport avoids duplicate keyboard padding, and bottom drawers use more of the available height while respecting the top safe area.  The responsive form example now scrolls its fields and actions together. This keeps the form usable when space is limited by the keyboard.  Validation: - Device Hub, iPhone 18 Pro / iOS 27.0: ordinary and long forms, textarea focus, nested drawers, partial snap points, Composer, and the responsive form example. - Temporarily applied the proposed primitives to Cal's design-system app and checked its chat, dialog, alert dialog, sheet, and right-side drawer. Cal's chat text-visibility issue also occurs with its original Drawer primitive; the right-side drawer footer remains outside this bottom-drawer change. - TypeScript, registry dependency validation, registry build, package sync, and formatting checks passed. No automated tests added.  This PR is based on main, including the merged #860 fix. Its diff contains only Drawer changes; no Composer dependency is required. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #/gnwno1y8NOhCjhtNhYVRNyEFkiBcOPdelLNlXafICQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWV4YW1wbGVzLWNhbGNvbSIsInByb2plY3RJZCI6InByal92TllOOTBmNWxDYktqcDNld1J6SXNiWVVtbHdNIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvZXhhbXBsZXMvY2FsY29tIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWV4YW1wbGVzLWNhbGNvbS85UkFDcUtTdGlNZXdla2c1UDNMU0plTXhjZDVBIiwicHJldmlld1VybCI6ImNvc3MtZXhhbXBsZXMtY2FsY29tLWdpdC1jb2RleC1kcmF3ZXIta2V5Ym9hcmQtZGVmYXVsdC1jYWwudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJjb3NzLWV4YW1wbGVzLWNhbGNvbS1naXQtY29kZXgtZHJhd2VyLWtleWJvYXJkLWRlZmF1bHQtY2FsLnZlcmNlbC5hcHAifX0seyJuYW1lIjoiY29zcy1jb20tdWkiLCJwcm9qZWN0SWQiOiJwcmpfWVZDVDZpRlhoYktMalB0bkg1a1VTWFA5NDk3eCIsInJvb3REaXJlY3RvcnkiOiJhcHBzL3VpIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS11aS81OWpjU0VuOXRTODloellSdHNGYUV1RFpxY2VoIiwicHJldmlld1VybCI6ImNvc3MtY29tLXVpLWdpdC1j
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5903">ENG-5903</a></p>

- **Issue #860** (2026-10-11): **fix(ui): prevent iOS Safari clipping after modal dismissal**
  *Symptoms*: Closing a modal on iOS Safari could leave coss.com cropped above the browser toolbar. Limit the fixed header-corner decoration to the header height so the page continues rendering behind Safari's toolbar after scroll unlock.  The shared trigger was reproduced with a plain body scroll-lock/unlock cycle: the full-viewport fixed decoration caused clipping, while hiding or bounding it prevented clipping. This explains why Drawer was affected even though its backdrop already used absolute positioning on iOS.  Also align Dialog, Alert Dialog, Sheet, and CommandDialog backdrops with [Base UI's iOS Safari guidance](https://base-ui.com/react/overview/quick-start#ios-26-safari), using the same iOS absolute-positioning rule as Drawer. The body already has relative positioning. No viewport resizing or JavaScript workarounds are added. Registry JSON and package components are synced.  before <img width="635" height="1295" alt="ios-safari-before" src="https://github.com/user-attachments/assets/f42c18e6-9e16-4a38-ade7-396fc602a03b" />  after <img width="2788" height="2576" alt="ChatGPT Image Oct 11, 2026, 03_37_34 PM" src="https://github.com/user-attachments/assets/af660f45-55fb-4cfa-af52-8bbfc1f810e5" />   Validation: - Device Hub, iPhone 18 Pro simulator, iOS 27.0: verified opening and closing Dialog, Drawer, Alert Dialog, Sheet, and CommandDialog retains content behind Safari's toolbar. - Isolated stripe reproduction plus the normal particle examples for Dialog and Drawer.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #aKFBJFebatkbWs+BriwK6VkahpiTVM5JEy6VsWWdSaE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWV4YW1wbGVzLWNhbGNvbSIsInByb2plY3RJZCI6InByal92TllOOTBmNWxDYktqcDNld1J6SXNiWVVtbHdNIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvZXhhbXBsZXMvY2FsY29tIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWV4YW1wbGVzLWNhbGNvbS81THBubUh3SmMxWmFOYktRZW9IZWNHTXE4ZzJ1IiwicHJldmlld1VybCI6ImNvc3MtZXhhbXBsZXMtY2FsY29tLWdpdC1jb2RleC1pb3Mtc2FmYXJpLW92ZXJsYXktY2xpcHBpbmctY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1leGFtcGxlcy1jYWxjb20tZ2l0LWNvZGV4LWlvcy1zYWZhcmktb3ZlcmxheS1jbGlwcGluZy1jYWwudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2FsL2Nvc3MtY29tLXVpLzdNM0s5UW5zektYUDFuaUtQZ01TOTlqN3Zjb1IiLCJwcmV2aWV3VXJsIjoiY29zcy1jb20t
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/ENG-5885">ENG-5885</a></p>

- **Issue #859** (2026-10-12): **feat: add composable chat composer**
  *Symptoms*: ## Summary  Add a reusable Composer for chat and AI assistant interfaces, with a contenteditable input or a native textarea through the same compositional API. It supports configurable mention and slash triggers, custom token rendering, async suggestions, submission controls, responsive row limits, and an adaptive layout that moves actions below multiline drafts.  - Keep editing, selection, history, and suggestion behavior in supporting hooks and libraries, with styled Composer parts for the UI. - Use the automatic bottom-drawer keyboard handling from #861 for the mobile drawer example; no `keyboardAware` prop is required. Merge the standalone Drawer fix first. - Include eleven composer particles, a drawer example, API documentation, gallery illustrations, registry entries, and package copies.  ## Validation  UI TypeScript checks, focused Biome checks, registry dependency validation and generation, desktop browser interaction checks, a responsive layout matrix, and portrait iPhone simulator checks were completed during implementation. No automated test suites were run in the recent implementation passes.  ## Remaining validation  Keep this PR in draft pending the mobile overlay audit. An iOS simulator check reproduced a landscape issue when rotating a drawer with the keyboard open: the remaining viewport can collapse the composer and clip its input. Physical-device coverage, Android, VoiceOver, IME/dictation/autocorrect, and comprehensive clipboard/history checks remain outst
  **Post-Mortem & Fix Analysis**:
  > [vc]: #u46jSEiOYAQcfyNPIGbF8iJC5MGjMK8etnXb92wF954=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjb3NzLWNvbS11aSIsInByb2plY3RJZCI6InByal9ZVkNUNmlGWGhiS0xqUHRuSDVrVVNYUDk0OTd4Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvdWkiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiY29zcy1jb20tdWktZ2l0LWNvZGV4LWNvbXBvc2VyLWNhbC52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jYWwvY29zcy1jb20tdWkvMnVHRHQyUnZCVGtZY2RKdHNZcE0zamQ1NmNlTSIsInByZXZpZXdVcmwiOiJjb3NzLWNvbS11aS1naXQtY29kZXgtY29tcG9zZXItY2FsLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifSx7Im5hbWUiOiJjb3NzLWNvbS1vcmlnaW4iLCJwcm9qZWN0SWQiOiJwcmpfejBkeFJ2WWM5cWtmU25SUEpoaHhPcGR4ZXJtVSIsInJvb3REaXJlY3RvcnkiOiJhcHBzL29yaWdpbiIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NhbC9jb3NzLWNvbS1vcmlnaW4vOFBibnhpOWl0TkZWRm03YkwzdERycjVHcHNYZiIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVz
  > Hey there and thank you for opening this pull request! 👋🏼  We require pull request titles to follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/) and it looks like your proposed title needs to be adjusted.  Details:  ``` No release type found in pull request title "Add composable chat composer and keyboard-aware drawer". Add a prefix to indicate what kind of release this pull request corresponds to. For reference, see https://www.conventionalcommits.org/  Available types:  - feat: A new feature  - fix: A bug fix  - docs: Documentation only changes  - style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)  - refactor: A code change that neither fixes a bug nor adds a feature  - perf: A code change that improves performance  - test: Adding missing tests or correcting existing tests  - build: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
  > <!-- linear-linkback --> <p><a href="https://linear.app/calcom/issue/PRO-2509">PRO-2509</a></p>

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

### Incident Patch 1: `28645cd8` (2026-10-12)
**Commit Message**: fix(ui): preserve composer focus and align border radii (#867)

**File**: `apps/ui/public/r/composer.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/composer.tsx",
-      "content": "\"use client\";\n\nimport { Button as ButtonPrimitive } from \"@base-ui/react/button\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Popover as PopoverPrimitive } from \"@base-ui/react/popover\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport type {\n  ComponentProps,\n  MouseEvent,\n  ReactElement,\n  ReactNode,\n} from \"react\";\nimport { createPortal } from \"react-dom\";\nimport {\n  type ComposerEditorOptions,\n  ComposerEditorProvider,\n  type ComposerItemValue,\n  type ComposerTokenPart,\n  focusComposerInput,\n  getComposerText,\n  useComposerAnchorContext,\n  useComposerEditorContext,\n  useComposerInputLayout,\n  useComposerItem,\n  useComposerSuggestionsContext,\n} from \"@/registry/default/lib/composer-editor\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype ComposerPopupProps = ComponentProps<typeof PopoverPrimitive.Popup> & {\n  anchor?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"anchor\"];\n  side?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"side\"];\n  align?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"align\"];\n  sideOffset?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"sideOffset\"];\n  alignOffset?: ComponentProps<\n    typeof PopoverPrimitive.Positioner\n  >[\"alignOffset\"];\n  positionerClassName?: string;\n  portalProps?: ComponentProps<typeof PopoverPrimitive.Portal>;\n};\n\ntype ComposerFormProps = useRender.ComponentProps<\"form\">;\ntype ComposerLayout = \"stacked\" | \"adaptive\";\ntype ComposerTokenVariant = \"default\" | \"chip\";\nconst composerTokenClassName =\n  \"wrap-break-word inline cursor-default align-baseline font-normal text-primary data-[variant=default]:font-medium data-[variant=chip]:box-decoration-clone data-[variant=chip]:rounded-md data-[variant=chip]:bg-accent data-[variant=chip]:px-1.5 data-[variant=chip]:py-px data-[variant=chip]:text-accent-foreground [&_[data-slot=composer-token-icon]:empty]:hidden [&_[data-slot=composer-token-icon]>svg]:size-3.5\";\n\nfunction ComposerFrame({\n  className,\n  layout = \"stacked\",\n  render,\n  ref,\n  name,\n  children,\n  ...props\n}: ComposerFormProps & { layout?: ComposerLayout }): ReactElement {\n  const editor = useComposerEditorContext();\n  const anchorRef = useComposerAnchorContext();\n  const defaultProps = {\n    \"data-slot\": \"composer\",\n    \"data-layout\": layout,\n    \"data-base-ui-swipe-ignore\": \"\",\n    onMouseDown: (event: MouseEvent<HTMLFormElement>): void => {\n      focusComposerInput(event, true);\n    },\n    onClick: (event: MouseEvent<HTMLFormElement>): void => {\n      focusComposerInput(event, false);\n    },\n    \"data-disabled\": editor?.disabled ? \"\" : undefined,\n    \"data-readonly\": editor?.readOnly ? \"\" : undefined,\n    children: (\n      <>\n        {children}\n        {name && (\n          <input\n            type=\"hidden\"\n            name={name}\n            value={getComposerText(editor?.value ?? [])}\n            disabled={editor?.disabled}\n          />\n        )}\n      </>\n    ),\n    className: cn(\n      \"relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]\",\n      \"data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(2)-1px)] data-[layout=adaptive]:not-data-multiline:pt-[calc(var(--composer-padding)-1px)]\",\n      className,\n    ),\n  };\n  return useRen
```

**File**: `apps/ui/registry/default/ui/composer.tsx` (modified, +13/-1)
```diff
@@ -7,6 +7,7 @@ import { useRender } from "@base-ui/react/use-render";
 import type {
   ComponentProps,
   MouseEvent,
+  PointerEvent,
   ReactElement,
   ReactNode,
 } from "react";
@@ -82,7 +83,7 @@ function ComposerFrame({
       </>
     ),
     className: cn(
-      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]",
+      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-(--composer-radius) border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] [--composer-radius:var(--radius-xl)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--composer-radius)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]",
       "data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(2)-1px)] data-[layout=adaptive]:not-data-multiline:pt-[calc(var(--composer-padding)-1px)]",
       className,
     ),
@@ -460,6 +461,17 @@ export function ComposerSubmit({
     "data-slot": "composer-submit",
     type: "button" as const,
     disabled: disabled ?? !editor?.canSubmit,
+    onPointerDown: (event: PointerEvent<HTMLButtonElement>): void => {
+      const input = editor?.rootRef.current?.querySelector(
+        '[data-slot="composer-input"]',
+      );
+      if (
+        event.button === 0 &&
+        input === event.currentTarget.ownerDocument.activeElement
+      ) {
+        event.preventDefault();
+      }
+    },
     onClick: (event: MouseEvent<HTMLButtonElement>): void => {
       if (event.defaultPrevented || disabled) return;
       event.preventDefault();
```

**File**: `packages/ui/src/components/composer.tsx` (modified, +13/-1)
```diff
@@ -22,6 +22,7 @@ import { cn } from "@coss/ui/lib/utils";
 import type {
   ComponentProps,
   MouseEvent,
+  PointerEvent,
   ReactElement,
   ReactNode,
 } from "react";
@@ -82,7 +83,7 @@ function ComposerFrame({
       </>
     ),
     className: cn(
-      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]",
+      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-(--composer-radius) border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] [--composer-radius:var(--radius-xl)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--composer-radius)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]",
       "data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(2)-1px)] data-[layout=adaptive]:not-data-multiline:pt-[calc(var(--composer-padding)-1px)]",
       className,
     ),
@@ -460,6 +461,17 @@ export function ComposerSubmit({
     "data-slot": "composer-submit",
     type: "button" as const,
     disabled: disabled ?? !editor?.canSubmit,
+    onPointerDown: (event: PointerEvent<HTMLButtonElement>): void => {
+      const input = editor?.rootRef.current?.querySelector(
+        '[data-slot="composer-input"]',
+      );
+      if (
+        event.button === 0 &&
+        input === event.currentTarget.ownerDocument.activeElement
+      ) {
+        event.preventDefault();
+      }
+    },
     onClick: (event: MouseEvent<HTMLButtonElement>): void => {
       if (event.defaultPrevented || disabled) return;
       event.preventDefault();
```

---

### Incident Patch 2: `22430889` (2026-10-12)
**Commit Message**: chore: add @pasqualevitiello as CODEOWNER for apps/ui (#866)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/CODEOWNERS` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+/apps/ui/ @pasqualevitiello
```

---

### Incident Patch 3: `b43d83bf` (2026-10-12)
**Commit Message**: style(ui): match composer chrome to textarea (#865)

Give the composer frame the same inner border highlight, dark input fill, and focus/disabled/invalid treatments as other form controls.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `apps/ui/public/r/composer.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/composer.tsx",
-      "content": "\"use client\";\n\nimport { Button as ButtonPrimitive } from \"@base-ui/react/button\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Popover as PopoverPrimitive } from \"@base-ui/react/popover\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport type {\n  ComponentProps,\n  MouseEvent,\n  ReactElement,\n  ReactNode,\n} from \"react\";\nimport { createPortal } from \"react-dom\";\nimport {\n  type ComposerEditorOptions,\n  ComposerEditorProvider,\n  type ComposerItemValue,\n  type ComposerTokenPart,\n  focusComposerInput,\n  getComposerText,\n  useComposerAnchorContext,\n  useComposerEditorContext,\n  useComposerInputLayout,\n  useComposerItem,\n  useComposerSuggestionsContext,\n} from \"@/registry/default/lib/composer-editor\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype ComposerPopupProps = ComponentProps<typeof PopoverPrimitive.Popup> & {\n  anchor?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"anchor\"];\n  side?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"side\"];\n  align?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"align\"];\n  sideOffset?: ComponentProps<typeof PopoverPrimitive.Positioner>[\"sideOffset\"];\n  alignOffset?: ComponentProps<\n    typeof PopoverPrimitive.Positioner\n  >[\"alignOffset\"];\n  positionerClassName?: string;\n  portalProps?: ComponentProps<typeof PopoverPrimitive.Portal>;\n};\n\ntype ComposerFormProps = useRender.ComponentProps<\"form\">;\ntype ComposerLayout = \"stacked\" | \"adaptive\";\ntype ComposerTokenVariant = \"default\" | \"chip\";\nconst composerTokenClassName =\n  \"wrap-break-word inline cursor-default align-baseline font-normal text-primary data-[variant=default]:font-medium data-[variant=chip]:box-decoration-clone data-[variant=chip]:rounded-md data-[variant=chip]:bg-accent data-[variant=chip]:px-1.5 data-[variant=chip]:py-px data-[variant=chip]:text-accent-foreground [&_[data-slot=composer-token-icon]:empty]:hidden [&_[data-slot=composer-token-icon]>svg]:size-3.5\";\n\nfunction ComposerFrame({\n  className,\n  layout = \"stacked\",\n  render,\n  ref,\n  name,\n  children,\n  ...props\n}: ComposerFormProps & { layout?: ComposerLayout }): ReactElement {\n  const editor = useComposerEditorContext();\n  const anchorRef = useComposerAnchorContext();\n  const defaultProps = {\n    \"data-slot\": \"composer\",\n    \"data-layout\": layout,\n    \"data-base-ui-swipe-ignore\": \"\",\n    onMouseDown: (event: MouseEvent<HTMLFormElement>): void => {\n      focusComposerInput(event, true);\n    },\n    onClick: (event: MouseEvent<HTMLFormElement>): void => {\n      focusComposerInput(event, false);\n    },\n    \"data-disabled\": editor?.disabled ? \"\" : undefined,\n    \"data-readonly\": editor?.readOnly ? \"\" : undefined,\n    children: (\n      <>\n        {children}\n        {name && (\n          <input\n            type=\"hidden\"\n            name={name}\n            value={getComposerText(editor?.value ?? [])}\n            disabled={editor?.disabled}\n          />\n        )}\n      </>\n    ),\n    className: cn(\n      \"relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background pb-(--composer-padding) text-foreground shadow-xs/5 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] has-[[data-slot=composer-input]:focus-visible]:border-ring has-[[data-slot=composer-input]:focus-visible]:ring-[3px] has-[[data-slot=composer-input]:focus-visible]:ring-ring/24 md:[--composer-max-rows:8]\",\n      \"data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-2 data-[layout=adaptive]:not-data-multiline:pt-(--composer-padding)\",\n      className,\n    ),\n  };\n  return useRender({\n    defaultTagName: \"form\",\n    render,\n    ref: [anchorRef ?? null, ref ?? null],\n    props: mergeProps<\"form\">(defaultProps, editor?.formProps ?? {}, props),\n  });\n}\n\nexport type ComposerProps = Omit<\n  ComposerFormProps,\n  \"defaultValue\" | \"onSubmit\" | \"name\"\n> &\n  ComposerEditorOptions & { layout?: ComposerLayout };\n\nexport function Composer({\n  layout,\n  value,\n  defaultValue,\n  onValueChange,\n  onSubmit,\n  onQueryChange,\n  triggers,\n  disabled,\n  readOnly,\n  submitDisabled,\n  allowEmpty,\n  submitOnEnter,\n  name,\n  getSuggestionsAnnouncement,\n  ...frameProps\n}: ComposerProps): ReactElement {\n  return (\n    <ComposerEditorProvider\n      value={value}\n      defaultValue={defaultValue}\n      onValueChange={onValueChange}\n      onSubmit={onSubmit}\n      onQueryChange={onQueryChange}\n      triggers={triggers}\n      disabled={disabled}\n      readOnly={r
```

**File**: `apps/ui/public/r/p-composer-11.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "registry/default/particles/p-composer-11.tsx",
-      "content": "\"use client\";\n\nimport { ArrowUpIcon } from \"lucide-react\";\nimport { useState } from \"react\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport {\n  Composer,\n  ComposerActionGroup,\n  ComposerActions,\n  ComposerInput,\n  ComposerSubmit,\n  type ComposerValue,\n  getComposerText,\n} from \"@/registry/default/ui/composer\";\n\nexport default function Particle() {\n  const [value, setValue] = useState<ComposerValue>([]);\n  const [notice, setNotice] = useState(\"\");\n\n  return (\n    <div className=\"flex w-full max-w-xl flex-col gap-2\">\n      <Composer\n        className=\"rounded-[calc(--spacing(5.5)+1px)] [--composer-padding:--spacing(1)] data-[layout=adaptive]:not-data-multiline:px-1 sm:rounded-[calc(--spacing(5)+1px)]\"\n        layout=\"adaptive\"\n        value={value}\n        onValueChange={setValue}\n        onSubmit={(draft) => {\n          setNotice(`Sent: ${getComposerText(draft)}`);\n          setValue([]);\n        }}\n      >\n        <ComposerInput\n          aria-label=\"Message\"\n          className=\"px-2\"\n          placeholder=\"Write a message…\"\n        />\n        <ComposerActions className=\"mx-1\">\n          <ComposerActionGroup align=\"end\">\n            <ComposerSubmit\n              render={\n                <Button\n                  aria-label=\"Send message\"\n                  className=\"rounded-full\"\n                  size=\"icon\"\n                >\n                  <ArrowUpIcon aria-hidden=\"true\" />\n                </Button>\n              }\n            />\n          </ComposerActionGroup>\n        </ComposerActions>\n      </Composer>\n      <p className=\"min-h-5 text-muted-foreground text-sm\" role=\"status\">\n        {notice}\n      </p>\n    </div>\n  );\n}\n",
+      "content": "\"use client\";\n\nimport { ArrowUpIcon } from \"lucide-react\";\nimport { useState } from \"react\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport {\n  Composer,\n  ComposerActionGroup,\n  ComposerActions,\n  ComposerInput,\n  ComposerSubmit,\n  type ComposerValue,\n  getComposerText,\n} from \"@/registry/default/ui/composer\";\n\nexport default function Particle() {\n  const [value, setValue] = useState<ComposerValue>([]);\n  const [notice, setNotice] = useState(\"\");\n\n  return (\n    <div className=\"flex w-full max-w-xl flex-col gap-2\">\n      <Composer\n        className=\"rounded-[calc(--spacing(5.5)+1px)] [--composer-padding:--spacing(1)] before:rounded-[--spacing(5.5)] data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(1)-1px)] sm:rounded-[calc(--spacing(5)+1px)] sm:before:rounded-[--spacing(5)]\"\n        layout=\"adaptive\"\n        value={value}\n        onValueChange={setValue}\n        onSubmit={(draft) => {\n          setNotice(`Sent: ${getComposerText(draft)}`);\n          setValue([]);\n        }}\n      >\n        <ComposerInput\n          aria-label=\"Message\"\n          className=\"px-2\"\n          placeholder=\"Write a message…\"\n        />\n        <ComposerActions className=\"mx-[calc(--spacing(1)-1px)]\">\n          <ComposerActionGroup align=\"end\">\n            <ComposerSubmit\n              render={\n                <Button\n                  aria-label=\"Send message\"\n                  className=\"rounded-full\"\n                  size=\"icon\"\n                >\n                  <ArrowUpIcon aria-hidden=\"true\" />\n                </Button>\n              }\n            />\n          </ComposerActionGroup>\n        </ComposerActions>\n      </Composer>\n      <p className=\"min-h-5 text-muted-foreground text-sm\" role=\"status\">\n        {notice}\n      </p>\n    </div>\n  );\n}\n",
       "type": "registry:block"
     }
   ],
```

**File**: `apps/ui/public/r/p-composer-9.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "registry/default/particles/p-composer-9.tsx",
-      "content": "\"use client\";\n\nimport { ArrowUpIcon, PlusIcon } from \"lucide-react\";\nimport { useState } from \"react\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport {\n  Composer,\n  ComposerActionGroup,\n  ComposerActions,\n  ComposerInput,\n  ComposerSubmit,\n  type ComposerValue,\n  getComposerText,\n} from \"@/registry/default/ui/composer\";\n\nexport default function Particle() {\n  const [value, setValue] = useState<ComposerValue>([]);\n  const [notice, setNotice] = useState(\"\");\n\n  return (\n    <div className=\"flex w-full max-w-xl flex-col gap-2\">\n      <Composer\n        className=\"rounded-[calc(--spacing(6.5)+1px)] sm:rounded-[calc(--spacing(6)+1px)]\"\n        layout=\"adaptive\"\n        value={value}\n        onValueChange={setValue}\n        onSubmit={(draft) => {\n          setNotice(`Sent: ${getComposerText(draft)}`);\n          setValue([]);\n        }}\n      >\n        <ComposerInput aria-label=\"Message\" placeholder=\"Write a message…\" />\n        <ComposerActions>\n          <ComposerActionGroup>\n            <Button\n              aria-label=\"Add an attachment\"\n              className=\"rounded-full\"\n              size=\"icon\"\n              type=\"button\"\n              variant=\"ghost\"\n              onClick={() => setNotice(\"Add an attachment\")}\n            >\n              <PlusIcon aria-hidden=\"true\" />\n            </Button>\n          </ComposerActionGroup>\n          <ComposerActionGroup align=\"end\">\n            <ComposerSubmit\n              render={\n                <Button\n                  aria-label=\"Send message\"\n                  className=\"rounded-full\"\n                  size=\"icon\"\n                >\n                  <ArrowUpIcon aria-hidden=\"true\" />\n                </Button>\n              }\n            />\n          </ComposerActionGroup>\n        </ComposerActions>\n      </Composer>\n      <p className=\"min-h-5 text-muted-foreground text-sm\" role=\"status\">\n        {notice}\n      </p>\n    </div>\n  );\n}\n",
+      "content": "\"use client\";\n\nimport { ArrowUpIcon, PlusIcon } from \"lucide-react\";\nimport { useState } from \"react\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport {\n  Composer,\n  ComposerActionGroup,\n  ComposerActions,\n  ComposerInput,\n  ComposerSubmit,\n  type ComposerValue,\n  getComposerText,\n} from \"@/registry/default/ui/composer\";\n\nexport default function Particle() {\n  const [value, setValue] = useState<ComposerValue>([]);\n  const [notice, setNotice] = useState(\"\");\n\n  return (\n    <div className=\"flex w-full max-w-xl flex-col gap-2\">\n      <Composer\n        className=\"rounded-[calc(--spacing(6.5)+1px)] before:rounded-[--spacing(6.5)] sm:rounded-[calc(--spacing(6)+1px)] sm:before:rounded-[--spacing(6)]\"\n        layout=\"adaptive\"\n        value={value}\n        onValueChange={setValue}\n        onSubmit={(draft) => {\n          setNotice(`Sent: ${getComposerText(draft)}`);\n          setValue([]);\n        }}\n      >\n        <ComposerInput aria-label=\"Message\" placeholder=\"Write a message…\" />\n        <ComposerActions>\n          <ComposerActionGroup>\n            <Button\n              aria-label=\"Add an attachment\"\n              className=\"rounded-full\"\n              size=\"icon\"\n              type=\"button\"\n              variant=\"ghost\"\n              onClick={() => setNotice(\"Add an attachment\")}\n            >\n              <PlusIcon aria-hidden=\"true\" />\n            </Button>\n          </ComposerActionGroup>\n          <ComposerActionGroup align=\"end\">\n            <ComposerSubmit\n              render={\n                <Button\n                  aria-label=\"Send message\"\n                  className=\"rounded-full\"\n                  size=\"icon\"\n                >\n                  <ArrowUpIcon aria-hidden=\"true\" />\n                </Button>\n              }\n            />\n          </ComposerActionGroup>\n        </ComposerActions>\n      </Composer>\n      <p className=\"min-h-5 text-muted-foreground text-sm\" role=\"status\">\n        {notice}\n      </p>\n    </div>\n  );\n}\n",
       "type": "registry:block"
     }
   ],
```

**File**: `apps/ui/registry/default/particles/p-composer-11.tsx` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@ export default function Particle() {
   return (
     <div className="flex w-full max-w-xl flex-col gap-2">
       <Composer
-        className="rounded-[calc(--spacing(5.5)+1px)] [--composer-padding:--spacing(1)] data-[layout=adaptive]:not-data-multiline:px-1 sm:rounded-[calc(--spacing(5)+1px)]"
+        className="rounded-[calc(--spacing(5.5)+1px)] [--composer-padding:--spacing(1)] before:rounded-[--spacing(5.5)] data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(1)-1px)] sm:rounded-[calc(--spacing(5)+1px)] sm:before:rounded-[--spacing(5)]"
         layout="adaptive"
         value={value}
         onValueChange={setValue}
@@ -34,7 +34,7 @@ export default function Particle() {
           className="px-2"
           placeholder="Write a message…"
         />
-        <ComposerActions className="mx-1">
+        <ComposerActions className="mx-[calc(--spacing(1)-1px)]">
           <ComposerActionGroup align="end">
             <ComposerSubmit
               render={
```

**File**: `apps/ui/registry/default/particles/p-composer-9.tsx` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ export default function Particle() {
   return (
     <div className="flex w-full max-w-xl flex-col gap-2">
       <Composer
-        className="rounded-[calc(--spacing(6.5)+1px)] sm:rounded-[calc(--spacing(6)+1px)]"
+        className="rounded-[calc(--spacing(6.5)+1px)] before:rounded-[--spacing(6.5)] sm:rounded-[calc(--spacing(6)+1px)] sm:before:rounded-[--spacing(6)]"
         layout="adaptive"
         value={value}
         onValueChange={setValue}
```

**File**: `apps/ui/registry/default/ui/composer.tsx` (modified, +5/-5)
```diff
@@ -82,8 +82,8 @@ function ComposerFrame({
       </>
     ),
     className: cn(
-      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background pb-(--composer-padding) text-foreground shadow-xs/5 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] has-[[data-slot=composer-input]:focus-visible]:border-ring has-[[data-slot=composer-input]:focus-visible]:ring-[3px] has-[[data-slot=composer-input]:focus-visible]:ring-ring/24 md:[--composer-max-rows:8]",
-      "data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-2 data-[layout=adaptive]:not-data-multiline:pt-(--composer-padding)",
+      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]",
+      "data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(2)-1px)] data-[layout=adaptive]:not-data-multiline:pt-[calc(var(--composer-padding)-1px)]",
       className,
     ),
   };
@@ -171,7 +171,7 @@ export function ComposerInput({
     "data-placeholder": placeholder,
     "aria-placeholder": editor ? placeholder : undefined,
     className: cn(
-      "field-sizing-content wrap-anywhere relative block min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] w-full min-w-0 resize-none whitespace-pre-wrap border-0 bg-transparent in-[[data-layout=adaptive]:not([data-multiline])]:px-1 px-3 py-1 outline-none placeholder:text-muted-foreground/72 data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-muted-foreground/72 data-empty:before:content-[attr(data-placeholder)] md:in-data-[layout=adaptive]:min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] md:min-h-[calc(var(--composer-min-rows,2)*1lh+--spacing(2))]",
+      "field-sizing-content wrap-anywhere relative block min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] w-full min-w-0 resize-none whitespace-pre-wrap border-0 bg-transparent in-[[data-layout=adaptive]:not([data-multiline])]:px-1 px-[calc(--spacing(3)-1px)] py-1 outline-none placeholder:text-muted-foreground/72 data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-muted-foreground/72 data-empty:before:content-[attr(data-placeholder)] md:in-data-[layout=adaptive]:min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] md:min-h-[calc(var(--composer-min-rows,2)*1lh+--spacing(2))]",
       className,
     ),
   };
@@ -198,7 +198,7 @@ export function ComposerInput({
       {/* The drawer reserves keyboard space; its nested input scroller needs no extra bottom padding. */}
       <ScrollArea
         ref={scrollRef}
-        className="in-[[data-layout=adaptive][data-multiline]]:col-span-full in-[[data-layout=adaptive][data-multiline]]:col-start-1 in-data-[layout=adaptive]:col-start-2 in-data-[layout=adaptive]:row-start-1 flex h-auto! min-h-0 min-w-0 flex-col in-[[data-layout=adaptive][data-multiline]]:self-stretch rounded-t-[inherit] text-base [--composer-scroll-padding:var(--composer-padding)] in-[[data-layout=adaptive]:not([data-multiline])]:[--composer-scroll-padding:0px] **:data-[slot=scroll-area-viewport]:h-auto! **:data-[slot=scroll-area-viewport]:max-h-[min(var(--composer-max-height,calc(var(--composer-max-rows,8)*var(--composer-line-height,1lh)+var(--composer-input-padding,--spacing(2))+var(--composer-scroll-padding))),50dvh)] **:data-[slot=scroll-area-viewport]:min-h-0 **:data-[slot=scroll-area-conten
```

**File**: `packages/ui/src/components/composer.tsx` (modified, +5/-5)
```diff
@@ -82,8 +82,8 @@ function ComposerFrame({
       </>
     ),
     className: cn(
-      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background pb-(--composer-padding) text-foreground shadow-xs/5 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] has-[[data-slot=composer-input]:focus-visible]:border-ring has-[[data-slot=composer-input]:focus-visible]:ring-[3px] has-[[data-slot=composer-input]:focus-visible]:ring-ring/24 md:[--composer-max-rows:8]",
-      "data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-2 data-[layout=adaptive]:not-data-multiline:pt-(--composer-padding)",
+      "relative flex min-h-0 min-w-0 cursor-text flex-col rounded-xl border border-input bg-background not-dark:bg-clip-padding pb-[calc(var(--composer-padding)-1px)] text-foreground shadow-xs/5 ring-ring/24 transition-shadow [--composer-max-rows:4] [--composer-padding:--spacing(2)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:border-destructive/64 has-[[data-slot=composer-input]:focus-visible]:has-aria-invalid:ring-destructive/16 has-[[data-slot=composer-input]:focus-visible]:border-ring has-aria-invalid:border-destructive/36 has-[[data-slot=composer-input]:focus-visible]:shadow-none has-aria-invalid:shadow-none has-[[data-slot=composer-input]:focus-visible]:ring-[3px] aria-invalid:border-destructive/36 aria-invalid:shadow-none data-disabled:opacity-64 data-disabled:shadow-none dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-has-[[data-slot=composer-input]:focus-visible]:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] md:[--composer-max-rows:8]",
+      "data-[layout=adaptive]:data-multiline:grid-rows-[minmax(0,1fr)_auto] data-[layout=adaptive]:grid data-[layout=adaptive]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=adaptive]:items-center data-[layout=adaptive]:not-data-multiline:px-[calc(--spacing(2)-1px)] data-[layout=adaptive]:not-data-multiline:pt-[calc(var(--composer-padding)-1px)]",
       className,
     ),
   };
@@ -171,7 +171,7 @@ export function ComposerInput({
     "data-placeholder": placeholder,
     "aria-placeholder": editor ? placeholder : undefined,
     className: cn(
-      "field-sizing-content wrap-anywhere relative block min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] w-full min-w-0 resize-none whitespace-pre-wrap border-0 bg-transparent in-[[data-layout=adaptive]:not([data-multiline])]:px-1 px-3 py-1 outline-none placeholder:text-muted-foreground/72 data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-muted-foreground/72 data-empty:before:content-[attr(data-placeholder)] md:in-data-[layout=adaptive]:min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] md:min-h-[calc(var(--composer-min-rows,2)*1lh+--spacing(2))]",
+      "field-sizing-content wrap-anywhere relative block min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] w-full min-w-0 resize-none whitespace-pre-wrap border-0 bg-transparent in-[[data-layout=adaptive]:not([data-multiline])]:px-1 px-[calc(--spacing(3)-1px)] py-1 outline-none placeholder:text-muted-foreground/72 data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-muted-foreground/72 data-empty:before:content-[attr(data-placeholder)] md:in-data-[layout=adaptive]:min-h-[calc(var(--composer-min-rows,1)*1lh+--spacing(2))] md:min-h-[calc(var(--composer-min-rows,2)*1lh+--spacing(2))]",
       className,
     ),
   };
@@ -198,7 +198,7 @@ export function ComposerInput({
       {/* The drawer reserves keyboard space; its nested input scroller needs no extra bottom padding. */}
       <ScrollArea
         ref={scrollRef}
-        className="in-[[data-layout=adaptive][data-multiline]]:col-span-full in-[[data-layout=adaptive][data-multiline]]:col-start-1 in-data-[layout=adaptive]:col-start-2 in-data-[layout=adaptive]:row-start-1 flex h-auto! min-h-0 min-w-0 flex-col in-[[data-layout=adaptive][data-multiline]]:self-stretch rounded-t-[inherit] text-base [--composer-scroll-padding:var(--composer-padding)] in-[[data-layout=adaptive]:not([data-multiline])]:[--composer-scroll-padding:0px] **:data-[slot=scroll-area-viewport]:h-auto! **:data-[slot=scroll-area-viewport]:max-h-[min(var(--composer-max-height,calc(var(--composer-max-rows,8)*var(--composer-line-height,1lh)+var(--composer-input-padding,--spacing(2))+var(--composer-scroll-padding))),50dvh)] **:data-[slot=scroll-area-viewport]:min-h-0 **:data-[slot=scroll-area-conten
```

---

### Incident Patch 4: `a5a88935` (2026-10-12)
**Commit Message**: style(ui): use bold overlay and empty titles (#862)

**File**: `apps/ui/public/r/alert-dialog.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/alert-dialog.tsx",
-      "content": "\"use client\";\n\nimport { AlertDialog as AlertDialogPrimitive } from \"@base-ui/react/alert-dialog\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport const AlertDialogCreateHandle: typeof AlertDialogPrimitive.createHandle =\n  AlertDialogPrimitive.createHandle;\n\nexport const AlertDialog: typeof AlertDialogPrimitive.Root =\n  AlertDialogPrimitive.Root;\n\nexport const AlertDialogPortal: typeof AlertDialogPrimitive.Portal =\n  AlertDialogPrimitive.Portal;\n\nexport function AlertDialogTrigger(\n  props: AlertDialogPrimitive.Trigger.Props,\n): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Trigger data-slot=\"alert-dialog-trigger\" {...props} />\n  );\n}\n\nexport function AlertDialogBackdrop({\n  className,\n  ...props\n}: AlertDialogPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"alert-dialog-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogViewport({\n  className,\n  ...props\n}: AlertDialogPrimitive.Viewport.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4\",\n        className,\n      )}\n      data-slot=\"alert-dialog-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogPopup({\n  className,\n  bottomStickOnMobile = true,\n  portalProps,\n  ...props\n}: AlertDialogPrimitive.Popup.Props & {\n  bottomStickOnMobile?: boolean;\n  portalProps?: AlertDialogPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <AlertDialogPortal {...portalProps}>\n      <AlertDialogBackdrop />\n      <AlertDialogViewport\n        className={cn(\n          bottomStickOnMobile &&\n            \"max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12\",\n        )}\n      >\n        <AlertDialogPrimitive.Popup\n          className={cn(\n            \"relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-lg/5 transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            bottomStickOnMobile &&\n              \"max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none\",\n            className,\n          )}\n          data-slot=\"alert-dialog-popup\"\n          {...props}\n        />\n      </AlertDialogViewport>\n    </AlertDialogPortal>\n  );\n}\n\nexport function AlertDialogHeader({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex flex-col gap-2 p-6 text-center max-sm:pb-4 sm:text-left\",\n        className,\n      )}\n      data-slot=\"alert-dialog-header\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogFooter({\n  className,\n  variant = \"default\",\n  ...props\n}: React.ComponentProps<\"div\"> & {\n  variant?: \"default\" | \"bare\";\n}): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl)-1px)]\",\n        variant === \"default\" && \"border-t bg-muted/72 py-4\",\n        variant === \"bare\" && \"pb-6\",\n        className,\n      )}\n      data-slot=\"alert-dialog-footer\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogTitle({\n  className,\n  ...props\n}: AlertDialogPrimitive.Title.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Title\n      className={cn(\n        \"font-heading font-semibold text-xl leading-none\",\n        className,\n      )}\n      data-slot=\"alert-dialog-title\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogDescription({\n  className,\n  ...props\n}: AlertDialogPrimitive.Description.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Description\n      className={cn(\"text-muted-foregro
```

**File**: `apps/ui/public/r/dialog.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/dialog.tsx",
-      "content": "\"use client\";\n\nimport { Dialog as DialogPrimitive } from \"@base-ui/react/dialog\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const DialogCreateHandle: typeof DialogPrimitive.createHandle =\n  DialogPrimitive.createHandle;\n\nexport const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;\n\nexport const DialogPortal: typeof DialogPrimitive.Portal =\n  DialogPrimitive.Portal;\n\nexport function DialogTrigger(\n  props: DialogPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DialogPrimitive.Trigger data-slot=\"dialog-trigger\" {...props} />;\n}\n\nexport function DialogClose(\n  props: DialogPrimitive.Close.Props,\n): React.ReactElement {\n  return <DialogPrimitive.Close data-slot=\"dialog-close\" {...props} />;\n}\n\nexport function DialogBackdrop({\n  className,\n  ...props\n}: DialogPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DialogPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"dialog-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DialogViewport({\n  className,\n  ...props\n}: DialogPrimitive.Viewport.Props): React.ReactElement {\n  return (\n    <DialogPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4\",\n        className,\n      )}\n      data-slot=\"dialog-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DialogPopup({\n  className,\n  children,\n  showCloseButton = true,\n  bottomStickOnMobile = true,\n  closeProps,\n  portalProps,\n  ...props\n}: DialogPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  bottomStickOnMobile?: boolean;\n  closeProps?: DialogPrimitive.Close.Props;\n  portalProps?: DialogPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <DialogPortal {...portalProps}>\n      <DialogBackdrop />\n      <DialogViewport\n        className={cn(\n          bottomStickOnMobile &&\n            \"max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12\",\n        )}\n      >\n        <DialogPrimitive.Popup\n          className={cn(\n            \"relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            bottomStickOnMobile &&\n              \"max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none\",\n            className,\n          )}\n          data-slot=\"dialog-popup\"\n          {...props}\n        >\n          {children}\n          {showCloseButton && (\n            <DialogPrimitive.Close\n              aria-label=\"Close\"\n              className=\"absolute end-2 top-2\"\n              render={<Button size=\"icon\" variant=\"ghost\" />}\n              {...closeProps}\n            >\n              <XIcon />\n            </DialogPrimitive.Close>\n          )}\n        </DialogPrimitive.Popup>\n      </DialogViewport>\n    </DialogPortal>\n  );\n}\n\nexport function DialogHeader({\n  className,\n  render,\n  ...props\n}: useRender.ComponentProps<\"div\">): React.ReactElement {\n  const defaultProps = {\n    className: cn(\n      \"flex flex-col gap-2 p-6 in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-3 max-sm:pb-4\",\n      className,\n    ),\n    \"data-slot\": \"dialog-header\",\n  };\n\n  return useRender({\n    defaultTagName: \"div\",\n    props: mergeProps<\"div\">(defaultProps, props),\n    render,\n  });\n}\n\nexport function DialogFooter({\n  className,\n  variant = \"default\",\n  render,\n  ...props\n}: useRender.ComponentProps<\"div\"> & {\n  variant?: \"default\" | \"bare\";\n}): React.ReactElement {\
```

**File**: `apps/ui/public/r/drawer.json` (modified, +2/-2)
```diff
@@ -11,9 +11,9 @@
   "files": [
     {
       "path": "registry/default/ui/drawer.tsx",
-      "content": "\"use client\";\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\";\nimport { Drawer as DrawerPrimitive } from \"@base-ui/react/drawer\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Radio as RadioPrimitive } from \"@base-ui/react/radio\";\nimport { RadioGroup as RadioGroupPrimitive } from \"@base-ui/react/radio-group\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { ChevronRightIcon, XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { createContext, useContext } from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype DrawerPosition = \"right\" | \"left\" | \"top\" | \"bottom\";\n\nconst DrawerContext: React.Context<{ position: DrawerPosition }> =\n  createContext<{ position: DrawerPosition }>({\n    position: \"bottom\",\n  });\n\nconst directionMap: Record<\n  DrawerPosition,\n  DrawerPrimitive.Root.Props[\"swipeDirection\"]\n> = {\n  bottom: \"down\",\n  left: \"left\",\n  right: \"right\",\n  top: \"up\",\n};\n\nexport const DrawerCreateHandle: typeof DrawerPrimitive.createHandle =\n  DrawerPrimitive.createHandle;\n\nexport function Drawer({\n  swipeDirection,\n  position = \"bottom\",\n  ...props\n}: DrawerPrimitive.Root.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  return (\n    <DrawerContext.Provider value={{ position }}>\n      <DrawerPrimitive.Root\n        swipeDirection={swipeDirection ?? directionMap[position]}\n        {...props}\n      />\n    </DrawerContext.Provider>\n  );\n}\n\nexport const DrawerPortal: typeof DrawerPrimitive.Portal =\n  DrawerPrimitive.Portal;\n\nexport function DrawerTrigger(\n  props: DrawerPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Trigger data-slot=\"drawer-trigger\" {...props} />;\n}\n\nexport function DrawerClose(\n  props: DrawerPrimitive.Close.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Close data-slot=\"drawer-close\" {...props} />;\n}\n\nexport function DrawerSwipeArea({\n  className,\n  position: positionProp,\n  ...props\n}: DrawerPrimitive.SwipeArea.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  const { position: contextPosition } = useContext(DrawerContext);\n  const position = positionProp ?? contextPosition;\n\n  return (\n    <DrawerPrimitive.SwipeArea\n      className={cn(\n        \"fixed z-50 touch-none\",\n        position === \"bottom\" && \"inset-x-0 bottom-0 h-8\",\n        position === \"top\" && \"inset-x-0 top-0 h-8\",\n        position === \"left\" && \"inset-y-0 left-0 w-8\",\n        position === \"right\" && \"inset-y-0 right-0 w-8\",\n        className,\n      )}\n      data-slot=\"drawer-swipe-area\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerBackdrop({\n  className,\n  ...props\n}: DrawerPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DrawerPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-sm transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"drawer-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerViewport({\n  className,\n  position,\n  variant = \"default\",\n  ...props\n}: DrawerPrimitive.Viewport.Props & {\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <DrawerPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]\",\n        \"touch-none\",\n        position === \"bottom\" &&\n          \"grid grid-rows-[1fr_auto] pt-[max(--spacing(2),env(safe-area-inset-top,0px))]\",\n        position === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        position === \"left\" && \"flex justify-start\",\n        position === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"px-(--inset) sm:[--inset:--spacing(4)]\",\n        variant === \"inset\" && position !== \"bottom\" && \"pt-(--inset)\",\n        variant === \"inset\" && position !== \"top\" && \"pb-(--inset)\",\n        className,\n      )}\n      data-slot=\"drawer-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerPopup({\n  className,\n  children,\n  showCloseButton = false,\n  position: positionProp,\n  variant = \"default\",\n  showBar = false,\n  portalProps,\n  ...props\n}: DrawerPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  position?: DrawerPosition;\
```

**File**: `apps/ui/public/r/empty.json` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
   "files": [
     {
       "path": "registry/default/ui/empty.tsx",
-      "content": "import { cva, type VariantProps } from \"class-variance-authority\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nconst emptyMediaVariants = cva(\n  \"flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n  {\n    defaultVariants: {\n      variant: \"default\",\n    },\n    variants: {\n      variant: {\n        default: \"bg-transparent\",\n        icon: \"relative flex size-9 shrink-0 items-center justify-center rounded-md border bg-card not-dark:bg-clip-padding text-foreground shadow-sm/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5\",\n      },\n    },\n  },\n);\n\nexport function Empty({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance px-6 py-12 text-center md:py-20\",\n        className,\n      )}\n      data-slot=\"empty\"\n      {...props}\n    />\n  );\n}\n\nexport function EmptyHeader({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex max-w-sm flex-col items-center text-center\",\n        className,\n      )}\n      data-slot=\"empty-header\"\n      {...props}\n    />\n  );\n}\n\nexport function EmptyMedia({\n  className,\n  variant = \"default\",\n  ...props\n}: React.ComponentProps<\"div\"> &\n  VariantProps<typeof emptyMediaVariants>): React.ReactElement {\n  return (\n    <div\n      className={cn(\"relative mb-6\", className)}\n      data-slot=\"empty-media\"\n      data-variant={variant}\n      {...props}\n    >\n      {variant === \"icon\" && (\n        <>\n          <div\n            aria-hidden=\"true\"\n            className={cn(\n              emptyMediaVariants({ className, variant }),\n              \"pointer-events-none absolute bottom-px origin-bottom-left -translate-x-0.5 -rotate-10 scale-84 shadow-none\",\n            )}\n          />\n          <div\n            aria-hidden=\"true\"\n            className={cn(\n              emptyMediaVariants({ className, variant }),\n              \"pointer-events-none absolute bottom-px origin-bottom-right translate-x-0.5 rotate-10 scale-84 shadow-none\",\n            )}\n          />\n        </>\n      )}\n      <div\n        className={cn(emptyMediaVariants({ className, variant }))}\n        {...props}\n      />\n    </div>\n  );\n}\n\nexport function EmptyTitle({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\"font-heading font-semibold text-xl\", className)}\n      data-slot=\"empty-title\"\n      {...props}\n    />\n  );\n}\n\nexport function EmptyDescription({\n  className,\n  ...props\n}: React.ComponentProps<\"p\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"text-muted-foreground text-sm [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4 [[data-slot=empty-title]+&]:mt-1\",\n        className,\n      )}\n      data-slot=\"empty-description\"\n      {...props}\n    />\n  );\n}\n\nexport function EmptyContent({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm\",\n        className,\n      )}\n      data-slot=\"empty-content\"\n      {...props}\n    />\n  );\n}\n",
+      "content": "import { cva, type VariantProps } from \"class-variance-authority\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nconst emptyMediaVariants = cva(\n  \"flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n  {\n    defaultVariants: {\n      variant: \"default\",\n    },\n    variants: {\n      variant: {\n        default: \"bg-transparent\",\n        icon: \"relative flex size-9 shrink-0 items-center justify-center rounded-md border bg-card not-dark:bg-clip-padding text-foreground shadow-sm/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5\",\n      },\n    },\n  },\n);\n\nexport function Empty({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance px-6 py-12 text-center md:py-20\",\n        className,\n 
```

**File**: `apps/ui/public/r/sheet.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/sheet.tsx",
-      "content": "\"use client\";\n\nimport { Dialog as SheetPrimitive } from \"@base-ui/react/dialog\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const Sheet: typeof SheetPrimitive.Root = SheetPrimitive.Root;\n\nexport const SheetPortal: typeof SheetPrimitive.Portal = SheetPrimitive.Portal;\n\nexport function SheetTrigger(\n  props: SheetPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <SheetPrimitive.Trigger data-slot=\"sheet-trigger\" {...props} />;\n}\n\nexport function SheetClose(\n  props: SheetPrimitive.Close.Props,\n): React.ReactElement {\n  return <SheetPrimitive.Close data-slot=\"sheet-close\" {...props} />;\n}\n\nexport function SheetBackdrop({\n  className,\n  ...props\n}: SheetPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <SheetPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"sheet-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function SheetViewport({\n  className,\n  side,\n  variant = \"default\",\n  ...props\n}: SheetPrimitive.Viewport.Props & {\n  side?: \"right\" | \"left\" | \"top\" | \"bottom\";\n  variant?: \"default\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <SheetPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 grid\",\n        side === \"bottom\" && \"grid grid-rows-[1fr_auto] pt-12\",\n        side === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        side === \"left\" && \"flex justify-start\",\n        side === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"sm:p-4\",\n        className,\n      )}\n      data-slot=\"sheet-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function SheetPopup({\n  className,\n  children,\n  showCloseButton = true,\n  side = \"right\",\n  variant = \"default\",\n  closeProps,\n  portalProps,\n  ...props\n}: SheetPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  side?: \"right\" | \"left\" | \"top\" | \"bottom\";\n  variant?: \"default\" | \"inset\";\n  closeProps?: SheetPrimitive.Close.Props;\n  portalProps?: SheetPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <SheetPortal {...portalProps}>\n      <SheetBackdrop />\n      <SheetViewport side={side} variant={variant}>\n        <SheetPrimitive.Popup\n          className={cn(\n            \"relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 transition-[opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:before:hidden dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            side === \"bottom\" &&\n              \"row-start-2 border-t data-ending-style:translate-y-8 data-starting-style:translate-y-8\",\n            side === \"top\" &&\n              \"border-b data-ending-style:-translate-y-8 data-starting-style:-translate-y-8\",\n            side === \"left\" &&\n              \"w-[calc(100%-(--spacing(12)))] max-w-md border-e data-ending-style:-translate-x-8 data-starting-style:-translate-x-8\",\n            side === \"right\" &&\n              \"col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md border-s data-ending-style:translate-x-8 data-starting-style:translate-x-8\",\n            variant === \"inset\" &&\n              \"before:hidden sm:rounded-2xl sm:border sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=sheet-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]\",\n            className,\n          )}\n          data-slot=\"sheet-popup\"\n          {...props}\n        >\n          {children}\n          {showCloseButton && (\n            <SheetPrimitive.Close\n              aria-label=\"Close\"\n              className=\"absolute end-2 top-2\"\n              render={<Button size=\"icon\" variant=\"ghost\" />}\n              {...closeProps}\n            >\n              <XIcon />\n            </SheetPrimitive.Close>\n          )}\n        </SheetPrimitive.Popup>\n      </SheetViewport>\n    </SheetPortal>\n  );\n}\n\nexport function SheetHeader({\n  className,\n  render,\n  ...props\n}: useRender.ComponentProps<\"div\">): React.ReactElement {\n  const defaultProps = {\n    className: cn(\n      \"flex flex-col gap-2 p-6 
```

**File**: `apps/ui/registry/default/ui/alert-dialog.tsx` (modified, +1/-4)
```diff
@@ -129,10 +129,7 @@ export function AlertDialogTitle({
 }: AlertDialogPrimitive.Title.Props): React.ReactElement {
   return (
     <AlertDialogPrimitive.Title
-      className={cn(
-        "font-heading font-semibold text-xl leading-none",
-        className,
-      )}
+      className={cn("font-bold font-heading text-xl leading-none", className)}
       data-slot="alert-dialog-title"
       {...props}
     />
```

**File**: `apps/ui/registry/default/ui/dialog.tsx` (modified, +1/-4)
```diff
@@ -163,10 +163,7 @@ export function DialogTitle({
 }: DialogPrimitive.Title.Props): React.ReactElement {
   return (
     <DialogPrimitive.Title
-      className={cn(
-        "font-heading font-semibold text-xl leading-none",
-        className,
-      )}
+      className={cn("font-bold font-heading text-xl leading-none", className)}
       data-slot="dialog-title"
       {...props}
     />
```

**File**: `apps/ui/registry/default/ui/drawer.tsx` (modified, +1/-4)
```diff
@@ -296,10 +296,7 @@ export function DrawerTitle({
 }: DrawerPrimitive.Title.Props): React.ReactElement {
   return (
     <DrawerPrimitive.Title
-      className={cn(
-        "font-heading font-semibold text-xl leading-none",
-        className,
-      )}
+      className={cn("font-bold font-heading text-xl leading-none", className)}
       data-slot="drawer-title"
       {...props}
     />
```

---

### Incident Patch 5: `7faa1386` (2026-10-12)
**Commit Message**: fix(ui): handle bottom drawer keyboards automatically (#861)

* fix(ui): handle bottom drawer keyboards automatically

* fix: give drawer forms more space on mobile

**File**: `apps/ui/content/docs/components/drawer.mdx` (modified, +6/-0)
```diff
@@ -263,6 +263,12 @@ Primitive content wrapper used for polymorphic composition with the `render` pro
 
 <ComponentPreview name="p-drawer-6" />
 
+### Software keyboard
+
+Bottom drawers automatically handle software-keyboard focus and spacing for inputs, textareas, and contenteditable fields. No additional prop is needed. Drawers without a focused input keep their normal layout. With snap points, the drawer moves up as needed while the keyboard is open and returns to the selected snap point when it closes.
+
+Put scrolling fields in `DrawerPanel`. For a persistent input or action row, place it after the panel, outside its scroll area. Set `--drawer-height` on `DrawerPopup` when the layout needs a fixed height; keyboard handling does not set the drawer height.
+
 ### Nested drawers
 
 <ComponentPreview name="p-drawer-7" />
```

**File**: `apps/ui/public/r/drawer.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/drawer.tsx",
-      "content": "\"use client\";\n\nimport { Checkbox as CheckboxPrimitive } from \"@base-ui/react/checkbox\";\nimport { Drawer as DrawerPrimitive } from \"@base-ui/react/drawer\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { Radio as RadioPrimitive } from \"@base-ui/react/radio\";\nimport { RadioGroup as RadioGroupPrimitive } from \"@base-ui/react/radio-group\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { ChevronRightIcon, XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { createContext, useContext } from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\ntype DrawerPosition = \"right\" | \"left\" | \"top\" | \"bottom\";\n\nconst DrawerContext: React.Context<{ position: DrawerPosition }> =\n  createContext<{ position: DrawerPosition }>({\n    position: \"bottom\",\n  });\n\nconst directionMap: Record<\n  DrawerPosition,\n  DrawerPrimitive.Root.Props[\"swipeDirection\"]\n> = {\n  bottom: \"down\",\n  left: \"left\",\n  right: \"right\",\n  top: \"up\",\n};\n\nexport const DrawerCreateHandle: typeof DrawerPrimitive.createHandle =\n  DrawerPrimitive.createHandle;\n\nexport function Drawer({\n  swipeDirection,\n  position = \"bottom\",\n  ...props\n}: DrawerPrimitive.Root.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  return (\n    <DrawerContext.Provider value={{ position }}>\n      <DrawerPrimitive.Root\n        swipeDirection={swipeDirection ?? directionMap[position]}\n        {...props}\n      />\n    </DrawerContext.Provider>\n  );\n}\n\nexport const DrawerPortal: typeof DrawerPrimitive.Portal =\n  DrawerPrimitive.Portal;\n\nexport function DrawerTrigger(\n  props: DrawerPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Trigger data-slot=\"drawer-trigger\" {...props} />;\n}\n\nexport function DrawerClose(\n  props: DrawerPrimitive.Close.Props,\n): React.ReactElement {\n  return <DrawerPrimitive.Close data-slot=\"drawer-close\" {...props} />;\n}\n\nexport function DrawerSwipeArea({\n  className,\n  position: positionProp,\n  ...props\n}: DrawerPrimitive.SwipeArea.Props & {\n  position?: DrawerPosition;\n}): React.ReactElement {\n  const { position: contextPosition } = useContext(DrawerContext);\n  const position = positionProp ?? contextPosition;\n\n  return (\n    <DrawerPrimitive.SwipeArea\n      className={cn(\n        \"fixed z-50 touch-none\",\n        position === \"bottom\" && \"inset-x-0 bottom-0 h-8\",\n        position === \"top\" && \"inset-x-0 top-0 h-8\",\n        position === \"left\" && \"inset-y-0 left-0 w-8\",\n        position === \"right\" && \"inset-y-0 right-0 w-8\",\n        className,\n      )}\n      data-slot=\"drawer-swipe-area\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerBackdrop({\n  className,\n  ...props\n}: DrawerPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DrawerPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-sm transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute\",\n        className,\n      )}\n      data-slot=\"drawer-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerViewport({\n  className,\n  position,\n  variant = \"default\",\n  ...props\n}: DrawerPrimitive.Viewport.Props & {\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <DrawerPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]\",\n        \"touch-none\",\n        position === \"bottom\" && \"grid grid-rows-[1fr_auto] pt-12\",\n        position === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        position === \"left\" && \"flex justify-start\",\n        position === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"px-(--inset) sm:[--inset:--spacing(4)]\",\n        variant === \"inset\" && position !== \"bottom\" && \"pt-(--inset)\",\n        variant === \"inset\" && position !== \"top\" && \"pb-(--inset)\",\n        className,\n      )}\n      data-slot=\"drawer-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DrawerPopup({\n  className,\n  children,\n  showCloseButton = false,\n  position: positionProp,\n  variant = \"default\",\n  showBar = false,\n  portalProps,\n  ...props\n}: DrawerPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  position?: DrawerPosition;\n  variant?: \"default\" | \"straight\" | \"inset\";\n  s
```

**File**: `apps/ui/public/r/p-drawer-12.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
   "files": [
     {
       "path": "registry/default/particles/p-drawer-12.tsx",
-      "content": "\"use client\";\n\nimport { useMediaQuery } from \"@/registry/default/hooks/use-media-query\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport {\n  Dialog,\n  DialogClose,\n  DialogDescription,\n  DialogFooter,\n  DialogHeader,\n  DialogPanel,\n  DialogPopup,\n  DialogTitle,\n  DialogTrigger,\n} from \"@/registry/default/ui/dialog\";\nimport {\n  Drawer,\n  DrawerClose,\n  DrawerDescription,\n  DrawerFooter,\n  DrawerHeader,\n  DrawerPanel,\n  DrawerPopup,\n  DrawerTitle,\n  DrawerTrigger,\n} from \"@/registry/default/ui/drawer\";\nimport { Field, FieldLabel } from \"@/registry/default/ui/field\";\nimport { Form } from \"@/registry/default/ui/form\";\nimport { Input } from \"@/registry/default/ui/input\";\n\nconst FORM_TITLE = \"Edit profile\";\nconst FORM_DESCRIPTION =\n  \"Make changes to your profile here. Click save when you're done.\";\nconst TRIGGER_LABEL = \"Open\";\nconst CANCEL_LABEL = \"Cancel\";\nconst SAVE_LABEL = \"Save\";\n\nconst formFields = (\n  <>\n    <Field>\n      <FieldLabel>Name</FieldLabel>\n      <Input defaultValue=\"Margaret Welsh\" type=\"text\" />\n    </Field>\n    <Field>\n      <FieldLabel>Username</FieldLabel>\n      <Input defaultValue=\"@maggie.welsh\" type=\"text\" />\n    </Field>\n  </>\n);\n\nexport default function Particle() {\n  const isMobile = useMediaQuery(\"max-md\");\n\n  if (isMobile) {\n    return (\n      <Drawer>\n        <DrawerTrigger render={<Button variant=\"outline\" />}>\n          {TRIGGER_LABEL}\n        </DrawerTrigger>\n        <DrawerPopup showBar>\n          <DrawerHeader>\n            <DrawerTitle>{FORM_TITLE}</DrawerTitle>\n            <DrawerDescription>{FORM_DESCRIPTION}</DrawerDescription>\n          </DrawerHeader>\n          <Form className=\"contents\">\n            <DrawerPanel className=\"grid gap-4\" scrollable={false}>\n              {formFields}\n            </DrawerPanel>\n            <DrawerFooter>\n              <DrawerClose render={<Button variant=\"ghost\" />}>\n                {CANCEL_LABEL}\n              </DrawerClose>\n              <Button type=\"submit\">{SAVE_LABEL}</Button>\n            </DrawerFooter>\n          </Form>\n        </DrawerPopup>\n      </Drawer>\n    );\n  }\n\n  return (\n    <Dialog>\n      <DialogTrigger render={<Button variant=\"outline\" />}>\n        {TRIGGER_LABEL}\n      </DialogTrigger>\n      <DialogPopup className=\"sm:max-w-sm\">\n        <DialogHeader>\n          <DialogTitle>{FORM_TITLE}</DialogTitle>\n          <DialogDescription>{FORM_DESCRIPTION}</DialogDescription>\n        </DialogHeader>\n        <Form className=\"contents\">\n          <DialogPanel className=\"grid gap-4\">{formFields}</DialogPanel>\n          <DialogFooter>\n            <DialogClose render={<Button variant=\"ghost\" />}>\n              {CANCEL_LABEL}\n            </DialogClose>\n            <Button type=\"submit\">{SAVE_LABEL}</Button>\n          </DialogFooter>\n        </Form>\n      </DialogPopup>\n    </Dialog>\n  );\n}\n",
+      "content": "\"use client\";\n\nimport { useMediaQuery } from \"@/registry/default/hooks/use-media-query\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport {\n  Dialog,\n  DialogClose,\n  DialogDescription,\n  DialogFooter,\n  DialogHeader,\n  DialogPanel,\n  DialogPopup,\n  DialogTitle,\n  DialogTrigger,\n} from \"@/registry/default/ui/dialog\";\nimport {\n  Drawer,\n  DrawerClose,\n  DrawerDescription,\n  DrawerHeader,\n  DrawerPanel,\n  DrawerPopup,\n  DrawerTitle,\n  DrawerTrigger,\n} from \"@/registry/default/ui/drawer\";\nimport { Field, FieldLabel } from \"@/registry/default/ui/field\";\nimport { Form } from \"@/registry/default/ui/form\";\nimport { Input } from \"@/registry/default/ui/input\";\n\nconst FORM_TITLE = \"Edit profile\";\nconst FORM_DESCRIPTION =\n  \"Make changes to your profile here. Click save when you're done.\";\nconst TRIGGER_LABEL = \"Open\";\nconst CANCEL_LABEL = \"Cancel\";\nconst SAVE_LABEL = \"Save\";\n\nconst formFields = (\n  <>\n    <Field>\n      <FieldLabel>Name</FieldLabel>\n      <Input defaultValue=\"Margaret Welsh\" type=\"text\" />\n    </Field>\n    <Field>\n      <FieldLabel>Username</FieldLabel>\n      <Input defaultValue=\"@maggie.welsh\" type=\"text\" />\n    </Field>\n  </>\n);\n\nexport default function Particle() {\n  const isMobile = useMediaQuery(\"max-md\");\n\n  if (isMobile) {\n    return (\n      <Drawer>\n        <DrawerTrigger render={<Button variant=\"outline\" />}>\n          {TRIGGER_LABEL}\n        </DrawerTrigger>\n        <DrawerPopup showBar>\n          <DrawerHeader>\n            <DrawerTitle>{FORM_TITLE}</DrawerTitle>\n            <DrawerDescription>{FORM_DESCRIPTION}</DrawerDescription>\n          </DrawerHeader>\n          <Form className=\"contents\">\n            <DrawerPanel className=\"grid gap-4\">\n              {formFields}\n              <div className=\"flex 
```

**File**: `apps/ui/registry/default/particles/p-drawer-12.tsx` (modified, +7/-8)
```diff
@@ -17,7 +17,6 @@ import {
   Drawer,
   DrawerClose,
   DrawerDescription,
-  DrawerFooter,
   DrawerHeader,
   DrawerPanel,
   DrawerPopup,
@@ -63,15 +62,15 @@ export default function Particle() {
             <DrawerDescription>{FORM_DESCRIPTION}</DrawerDescription>
           </DrawerHeader>
           <Form className="contents">
-            <DrawerPanel className="grid gap-4" scrollable={false}>
+            <DrawerPanel className="grid gap-4">
               {formFields}
+              <div className="flex flex-col-reverse gap-2">
+                <DrawerClose render={<Button variant="ghost" />}>
+                  {CANCEL_LABEL}
+                </DrawerClose>
+                <Button type="submit">{SAVE_LABEL}</Button>
+              </div>
             </DrawerPanel>
-            <DrawerFooter>
-              <DrawerClose render={<Button variant="ghost" />}>
-                {CANCEL_LABEL}
-              </DrawerClose>
-              <Button type="submit">{SAVE_LABEL}</Button>
-            </DrawerFooter>
           </Form>
         </DrawerPopup>
       </Drawer>
```

**File**: `apps/ui/registry/default/ui/drawer.tsx` (modified, +14/-4)
```diff
@@ -121,7 +121,8 @@ export function DrawerViewport({
       className={cn(
         "fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]",
         "touch-none",
-        position === "bottom" && "grid grid-rows-[1fr_auto] pt-12",
+        position === "bottom" &&
+          "grid grid-rows-[1fr_auto] pt-[max(--spacing(2),env(safe-area-inset-top,0px))]",
         position === "top" && "grid grid-rows-[auto_1fr] pb-12",
         position === "left" && "flex justify-start",
         position === "right" && "flex justify-end",
@@ -155,7 +156,7 @@ export function DrawerPopup({
   const { position: contextPosition } = useContext(DrawerContext);
   const position = positionProp ?? contextPosition;
 
-  return (
+  const popup = (
     <DrawerPortal {...portalProps}>
       <DrawerBackdrop />
       <DrawerViewport position={position} variant={variant}>
@@ -164,7 +165,7 @@ export function DrawerPopup({
             "relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 outline-none transition-[transform,box-shadow,height,background-color] duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform [--peek:calc(--spacing(6)-1px)] [--scale-base:calc(max(0,1-(var(--nested-drawers)*var(--stack-step))))] [--scale:clamp(0,calc(var(--scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--shrink:calc(1-var(--scale))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-step:0.05] before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] after:pointer-events-none after:absolute after:bg-popover data-swiping:select-none data-nested-drawer-open:overflow-hidden data-nested-drawer-open:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(2%*(var(--nested-drawers)-var(--stack-progress))))] data-ending-style:shadow-transparent data-starting-style:shadow-transparent data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] dark:data-nested-drawer-open:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(6%*(var(--nested-drawers)-var(--stack-progress))))] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
             "touch-none",
             position === "bottom" &&
-              "transform-[translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] data-ending-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] data-starting-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] row-start-2 -mb-[max(0px,calc(var(--drawer-snap-point-offset,0px)+clamp(0,1,var(--drawer-snap-point-offset,0px)/1px)*var(--drawer-swipe-movement-y,0px)))] border-t pb-[max(0px,calc(env(safe-area-inset-bottom,0px)+var(--drawer-snap-point-offset,0px)+clamp(0,1,var(--drawer-snap-point-offset,0px)/1px)*var(--drawer-swipe-movement-y,0px)))] not-data-starting-style:not-data-ending-style:transition-[transform,box-shadow,height,background-color,margin,padding] after:inset-x-0 after:top-full after:h-(--bleed) has-data-[slot=drawer-bar]:pt-2 data-ending-style:mb-0 data-starting-style:mb-0 data-ending-style:pb-0 data-starting-style:pb-0",
+              "transform-[translateY(calc(var(--keyboard-snap-offset)+var(--drawer-swipe-movement-y)))] data-ending-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] data-starting-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] row-start-2 -mb-[max(0px,calc(var(--keyboard-snap-offset)+clamp(0,1,var(--keyboard-snap-offset)/1px)*var(--drawer-swipe-movement-y,0px)))] border-t pb-[max(0px,calc(max(env(safe-area-inset-bottom,0px),var(--drawer-keyboard-inset,0px))+var(--keyboard-snap-offset)+clamp(0,1,var(--keyboard-snap-offset)/1px)*var(--drawer-swipe-movement-y,0px)))] not-data-starting-style:not-data-ending-style:transition-[transform,box-shadow,height,background-color,margin,padding] [--keyboard-snap-offset:max(0px,calc(var(--drawer-snap-point-offset,0px)-var(--drawer-keyboard-inset,0px)))] after:inset-x-0 after:top-full after:h-(--bleed) has-data-[slot=drawer-bar]:pt-2 data-ending-style:mb-0 data-starting-style:mb-0 data-ending-style:pb-0 data-starting-style:pb-0",
             position === "top" &&
               "data-starting-style:transform-[translateY(calc(-100%-var(--inset)))] data-ending-style:transform-[translateY(calc(-100%-var(--inset)))] transform-[translateY(var(--drawer-swipe-movement-y))] border-b after:inset-x-0 after:bottom-full after:h-(--bleed) has-data-[slot=drawer-bar]:pb-2",
             position === "left" &&
@@ -225,6 +226,14 @@ export function DrawerPopup({
       </DrawerViewport>
     </DrawerPortal>
   );
+
+  return position === "bottom" ? (
+    <DrawerPrimitive.VirtualKeyboardProvider>
+      {popup}
+    </DrawerPrimitive.VirtualKeyboardProvider>
+  ) : (

```

**File**: `packages/ui/src/components/drawer.tsx` (modified, +14/-4)
```diff
@@ -121,7 +121,8 @@ export function DrawerViewport({
       className={cn(
         "fixed inset-0 z-50 [--bleed:--spacing(12)] [--inset:0px]",
         "touch-none",
-        position === "bottom" && "grid grid-rows-[1fr_auto] pt-12",
+        position === "bottom" &&
+          "grid grid-rows-[1fr_auto] pt-[max(--spacing(2),env(safe-area-inset-top,0px))]",
         position === "top" && "grid grid-rows-[auto_1fr] pb-12",
         position === "left" && "flex justify-start",
         position === "right" && "flex justify-end",
@@ -155,7 +156,7 @@ export function DrawerPopup({
   const { position: contextPosition } = useContext(DrawerContext);
   const position = positionProp ?? contextPosition;
 
-  return (
+  const popup = (
     <DrawerPortal {...portalProps}>
       <DrawerBackdrop />
       <DrawerViewport position={position} variant={variant}>
@@ -164,7 +165,7 @@ export function DrawerPopup({
             "relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 outline-none transition-[transform,box-shadow,height,background-color] duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform [--peek:calc(--spacing(6)-1px)] [--scale-base:calc(max(0,1-(var(--nested-drawers)*var(--stack-step))))] [--scale:clamp(0,calc(var(--scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--shrink:calc(1-var(--scale))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-step:0.05] before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] after:pointer-events-none after:absolute after:bg-popover data-swiping:select-none data-nested-drawer-open:overflow-hidden data-nested-drawer-open:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(2%*(var(--nested-drawers)-var(--stack-progress))))] data-ending-style:shadow-transparent data-starting-style:shadow-transparent data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] dark:data-nested-drawer-open:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(6%*(var(--nested-drawers)-var(--stack-progress))))] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
             "touch-none",
             position === "bottom" &&
-              "transform-[translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] data-ending-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] data-starting-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] row-start-2 -mb-[max(0px,calc(var(--drawer-snap-point-offset,0px)+clamp(0,1,var(--drawer-snap-point-offset,0px)/1px)*var(--drawer-swipe-movement-y,0px)))] border-t pb-[max(0px,calc(env(safe-area-inset-bottom,0px)+var(--drawer-snap-point-offset,0px)+clamp(0,1,var(--drawer-snap-point-offset,0px)/1px)*var(--drawer-swipe-movement-y,0px)))] not-data-starting-style:not-data-ending-style:transition-[transform,box-shadow,height,background-color,margin,padding] after:inset-x-0 after:top-full after:h-(--bleed) has-data-[slot=drawer-bar]:pt-2 data-ending-style:mb-0 data-starting-style:mb-0 data-ending-style:pb-0 data-starting-style:pb-0",
+              "transform-[translateY(calc(var(--keyboard-snap-offset)+var(--drawer-swipe-movement-y)))] data-ending-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] data-starting-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] row-start-2 -mb-[max(0px,calc(var(--keyboard-snap-offset)+clamp(0,1,var(--keyboard-snap-offset)/1px)*var(--drawer-swipe-movement-y,0px)))] border-t pb-[max(0px,calc(max(env(safe-area-inset-bottom,0px),var(--drawer-keyboard-inset,0px))+var(--keyboard-snap-offset)+clamp(0,1,var(--keyboard-snap-offset)/1px)*var(--drawer-swipe-movement-y,0px)))] not-data-starting-style:not-data-ending-style:transition-[transform,box-shadow,height,background-color,margin,padding] [--keyboard-snap-offset:max(0px,calc(var(--drawer-snap-point-offset,0px)-var(--drawer-keyboard-inset,0px)))] after:inset-x-0 after:top-full after:h-(--bleed) has-data-[slot=drawer-bar]:pt-2 data-ending-style:mb-0 data-starting-style:mb-0 data-ending-style:pb-0 data-starting-style:pb-0",
             position === "top" &&
               "data-starting-style:transform-[translateY(calc(-100%-var(--inset)))] data-ending-style:transform-[translateY(calc(-100%-var(--inset)))] transform-[translateY(var(--drawer-swipe-movement-y))] border-b after:inset-x-0 after:bottom-full after:h-(--bleed) has-data-[slot=drawer-bar]:pb-2",
             position === "left" &&
@@ -225,6 +226,14 @@ export function DrawerPopup({
       </DrawerViewport>
     </DrawerPortal>
   );
+
+  return position === "bottom" ? (
+    <DrawerPrimitive.VirtualKeyboardProvider>
+      {popup}
+    </DrawerPrimitive.VirtualKeyboardProvider>
+  ) : (

```

---

### Incident Patch 6: `28135b07` (2026-10-11)
**Commit Message**: fix(ui): prevent iOS Safari clipping after modal dismissal (#860)

* fix(ui): prevent iOS Safari clipping after modal dismissal

* chore(ui): remove layout explanation comment

* docs: add iOS Safari before and after screenshots

* chore: remove PR screenshots from diff

**File**: `apps/ui/app/layout.tsx` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ export default function RootLayout({
                 />
                 <div
                   aria-hidden="true"
-                  className="container pointer-events-none fixed inset-0 z-45 before:absolute before:top-[calc(var(--header-height)-4.5px)] before:-left-[11.5px] before:z-1 before:-ml-1 before:size-2 before:rounded-[2px] before:border before:border-border before:bg-popover before:bg-clip-padding before:shadow-xs/5 after:absolute after:top-[calc(var(--header-height)-4.5px)] after:-right-[11.5px] after:z-1 after:-mr-1 after:size-2 after:rounded-[2px] after:border after:border-border after:bg-background after:bg-clip-padding after:shadow-xs/5 dark:after:bg-clip-border dark:before:bg-clip-border"
+                  className="container pointer-events-none fixed inset-x-0 top-0 z-45 h-(--header-height) before:absolute before:top-[calc(var(--header-height)-4.5px)] before:-left-[11.5px] before:z-1 before:-ml-1 before:size-2 before:rounded-[2px] before:border before:border-border before:bg-popover before:bg-clip-padding before:shadow-xs/5 after:absolute after:top-[calc(var(--header-height)-4.5px)] after:-right-[11.5px] after:z-1 after:-mr-1 after:size-2 after:rounded-[2px] after:border after:border-border after:bg-background after:bg-clip-padding after:shadow-xs/5 dark:after:bg-clip-border dark:before:bg-clip-border"
                 />
                 <SiteHeader />
                 {children}
```

**File**: `apps/ui/public/r/alert-dialog.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
   "files": [
     {
       "path": "registry/default/ui/alert-dialog.tsx",
-      "content": "\"use client\";\n\nimport { AlertDialog as AlertDialogPrimitive } from \"@base-ui/react/alert-dialog\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\n\nexport const AlertDialogCreateHandle: typeof AlertDialogPrimitive.createHandle =\n  AlertDialogPrimitive.createHandle;\n\nexport const AlertDialog: typeof AlertDialogPrimitive.Root =\n  AlertDialogPrimitive.Root;\n\nexport const AlertDialogPortal: typeof AlertDialogPrimitive.Portal =\n  AlertDialogPrimitive.Portal;\n\nexport function AlertDialogTrigger(\n  props: AlertDialogPrimitive.Trigger.Props,\n): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Trigger data-slot=\"alert-dialog-trigger\" {...props} />\n  );\n}\n\nexport function AlertDialogBackdrop({\n  className,\n  ...props\n}: AlertDialogPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0\",\n        className,\n      )}\n      data-slot=\"alert-dialog-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogViewport({\n  className,\n  ...props\n}: AlertDialogPrimitive.Viewport.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4\",\n        className,\n      )}\n      data-slot=\"alert-dialog-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogPopup({\n  className,\n  bottomStickOnMobile = true,\n  portalProps,\n  ...props\n}: AlertDialogPrimitive.Popup.Props & {\n  bottomStickOnMobile?: boolean;\n  portalProps?: AlertDialogPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <AlertDialogPortal {...portalProps}>\n      <AlertDialogBackdrop />\n      <AlertDialogViewport\n        className={cn(\n          bottomStickOnMobile &&\n            \"max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12\",\n        )}\n      >\n        <AlertDialogPrimitive.Popup\n          className={cn(\n            \"relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-lg/5 transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            bottomStickOnMobile &&\n              \"max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none\",\n            className,\n          )}\n          data-slot=\"alert-dialog-popup\"\n          {...props}\n        />\n      </AlertDialogViewport>\n    </AlertDialogPortal>\n  );\n}\n\nexport function AlertDialogHeader({\n  className,\n  ...props\n}: React.ComponentProps<\"div\">): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex flex-col gap-2 p-6 text-center max-sm:pb-4 sm:text-left\",\n        className,\n      )}\n      data-slot=\"alert-dialog-header\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogFooter({\n  className,\n  variant = \"default\",\n  ...props\n}: React.ComponentProps<\"div\"> & {\n  variant?: \"default\" | \"bare\";\n}): React.ReactElement {\n  return (\n    <div\n      className={cn(\n        \"flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl)-1px)]\",\n        variant === \"default\" && \"border-t bg-muted/72 py-4\",\n        variant === \"bare\" && \"pb-6\",\n        className,\n      )}\n      data-slot=\"alert-dialog-footer\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogTitle({\n  className,\n  ...props\n}: AlertDialogPrimitive.Title.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Title\n      className={cn(\n        \"font-heading font-semibold text-xl leading-none\",\n        className,\n      )}\n      data-slot=\"alert-dialog-title\"\n      {...props}\n    />\n  );\n}\n\nexport function AlertDialogDescription({\n  className,\n  ...props\n}: AlertDialogPrimitive.Description.Props): React.ReactElement {\n  return (\n    <AlertDialogPrimitive.Description\n      className={cn(\"text-muted-foreground text-sm\", className)}\n      data-slot=\"a
```

**File**: `apps/ui/public/r/command.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
   "files": [
     {
       "path": "registry/default/ui/command.tsx",
-      "content": "\"use client\";\n\nimport { Dialog as CommandDialogPrimitive } from \"@base-ui/react/dialog\";\nimport { SearchIcon } from \"lucide-react\";\nimport type * as React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport {\n  Autocomplete,\n  AutocompleteCollection,\n  AutocompleteEmpty,\n  AutocompleteGroup,\n  AutocompleteGroupLabel,\n  AutocompleteInput,\n  AutocompleteItem,\n  AutocompleteList,\n  AutocompleteSeparator,\n} from \"@/registry/default/ui/autocomplete\";\n\nexport const CommandDialog: typeof CommandDialogPrimitive.Root =\n  CommandDialogPrimitive.Root;\n\nexport const CommandDialogPortal: typeof CommandDialogPrimitive.Portal =\n  CommandDialogPrimitive.Portal;\n\nexport const CommandCreateHandle: typeof CommandDialogPrimitive.createHandle =\n  CommandDialogPrimitive.createHandle;\n\nexport function CommandDialogTrigger(\n  props: CommandDialogPrimitive.Trigger.Props,\n): React.ReactElement {\n  return (\n    <CommandDialogPrimitive.Trigger\n      data-slot=\"command-dialog-trigger\"\n      {...props}\n    />\n  );\n}\n\nexport function CommandDialogBackdrop({\n  className,\n  ...props\n}: CommandDialogPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <CommandDialogPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0\",\n        className,\n      )}\n      data-slot=\"command-dialog-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function CommandDialogViewport({\n  className,\n  ...props\n}: CommandDialogPrimitive.Viewport.Props): React.ReactElement {\n  return (\n    <CommandDialogPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 flex flex-col items-center px-4 py-[max(--spacing(4),4vh)] sm:py-[10vh]\",\n        className,\n      )}\n      data-slot=\"command-dialog-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function CommandDialogPopup({\n  className,\n  children,\n  portalProps,\n  ...props\n}: CommandDialogPrimitive.Popup.Props & {\n  portalProps?: CommandDialogPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <CommandDialogPortal {...portalProps}>\n      <CommandDialogBackdrop />\n      <CommandDialogViewport>\n        <CommandDialogPrimitive.Popup\n          className={cn(\n            \"relative row-start-2 flex max-h-105 min-h-0 w-full min-w-0 max-w-xl -translate-y-[calc(1.25rem*var(--nested-dialogs))] scale-[calc(1-0.1*var(--nested-dialogs))] flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-0.1*var(--nested-dialogs))] shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] data-nested:data-ending-style:translate-y-8 data-nested:data-starting-style:translate-y-8 data-nested-dialog-open:origin-top data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 **:data-[slot=scroll-area-viewport]:data-has-overflow-y:pe-1 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            className,\n          )}\n          data-slot=\"command-dialog-popup\"\n          {...props}\n        >\n          {children}\n        </CommandDialogPrimitive.Popup>\n      </CommandDialogViewport>\n    </CommandDialogPortal>\n  );\n}\n\nexport function Command({\n  autoHighlight = \"always\",\n  keepHighlight = true,\n  ...props\n}: React.ComponentProps<typeof Autocomplete>): React.ReactElement {\n  return (\n    <Autocomplete\n      autoHighlight={autoHighlight}\n      inline\n      keepHighlight={keepHighlight}\n      open\n      {...props}\n    />\n  );\n}\n\nexport function CommandInput({\n  className,\n  placeholder = undefined,\n  ...props\n}: React.ComponentProps<typeof AutocompleteInput>): React.ReactElement {\n  return (\n    <div className=\"px-2.5 py-1.5\">\n      <AutocompleteInput\n        autoFocus\n        className={cn(\n          \"border-transparent! bg-transparent! shadow-none before:hidden has-focus-visible:ring-0\",\n          className,\n        )}\n        placeholder={placeholder}\n        size=\"lg\"\n        startAddon={<SearchIcon />}\n        {...props}\n      />\n    </div>\n  );\n}\n\nexport function CommandList({\n  className,\n  ...props\n}: React.ComponentProps<typeof AutocompleteList>): React.ReactElement {\n  return (\n    <AutocompleteList\n      className={cn(\"not-empty:scroll-py-2 not-empty:p-2\", className)}\n      data-slot=\"command-list\"\n      {...props}\n    />\n  );\n}\n\nexport function CommandEmpty({\n  className,\n  ...props\n}: React.ComponentProps<typeof AutocompleteEmpty>): React.ReactElement {\
```

**File**: `apps/ui/public/r/dialog.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/dialog.tsx",
-      "content": "\"use client\";\n\nimport { Dialog as DialogPrimitive } from \"@base-ui/react/dialog\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const DialogCreateHandle: typeof DialogPrimitive.createHandle =\n  DialogPrimitive.createHandle;\n\nexport const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;\n\nexport const DialogPortal: typeof DialogPrimitive.Portal =\n  DialogPrimitive.Portal;\n\nexport function DialogTrigger(\n  props: DialogPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <DialogPrimitive.Trigger data-slot=\"dialog-trigger\" {...props} />;\n}\n\nexport function DialogClose(\n  props: DialogPrimitive.Close.Props,\n): React.ReactElement {\n  return <DialogPrimitive.Close data-slot=\"dialog-close\" {...props} />;\n}\n\nexport function DialogBackdrop({\n  className,\n  ...props\n}: DialogPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <DialogPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0\",\n        className,\n      )}\n      data-slot=\"dialog-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function DialogViewport({\n  className,\n  ...props\n}: DialogPrimitive.Viewport.Props): React.ReactElement {\n  return (\n    <DialogPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4\",\n        className,\n      )}\n      data-slot=\"dialog-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function DialogPopup({\n  className,\n  children,\n  showCloseButton = true,\n  bottomStickOnMobile = true,\n  closeProps,\n  portalProps,\n  ...props\n}: DialogPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  bottomStickOnMobile?: boolean;\n  closeProps?: DialogPrimitive.Close.Props;\n  portalProps?: DialogPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <DialogPortal {...portalProps}>\n      <DialogBackdrop />\n      <DialogViewport\n        className={cn(\n          bottomStickOnMobile &&\n            \"max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12\",\n        )}\n      >\n        <DialogPrimitive.Popup\n          className={cn(\n            \"relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            bottomStickOnMobile &&\n              \"max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none\",\n            className,\n          )}\n          data-slot=\"dialog-popup\"\n          {...props}\n        >\n          {children}\n          {showCloseButton && (\n            <DialogPrimitive.Close\n              aria-label=\"Close\"\n              className=\"absolute end-2 top-2\"\n              render={<Button size=\"icon\" variant=\"ghost\" />}\n              {...closeProps}\n            >\n              <XIcon />\n            </DialogPrimitive.Close>\n          )}\n        </DialogPrimitive.Popup>\n      </DialogViewport>\n    </DialogPortal>\n  );\n}\n\nexport function DialogHeader({\n  className,\n  render,\n  ...props\n}: useRender.ComponentProps<\"div\">): React.ReactElement {\n  const defaultProps = {\n    className: cn(\n      \"flex flex-col gap-2 p-6 in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-3 max-sm:pb-4\",\n      className,\n    ),\n    \"data-slot\": \"dialog-header\",\n  };\n\n  return useRender({\n    defaultTagName: \"div\",\n    props: mergeProps<\"div\">(defaultProps, props),\n    render,\n  });\n}\n\nexport function DialogFooter({\n  className,\n  variant = \"default\",\n  render,\n  ...props\n}: useRender.ComponentProps<\"div\"> & {\n  variant?: \"default\" | \"bare\";\n}): React.ReactElement {\n  const defaultProps = {\n    className: cn(\n
```

**File**: `apps/ui/public/r/sheet.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "registry/default/ui/sheet.tsx",
-      "content": "\"use client\";\n\nimport { Dialog as SheetPrimitive } from \"@base-ui/react/dialog\";\nimport { mergeProps } from \"@base-ui/react/merge-props\";\nimport { useRender } from \"@base-ui/react/use-render\";\nimport { XIcon } from \"lucide-react\";\nimport type React from \"react\";\nimport { cn } from \"@/registry/default/lib/utils\";\nimport { Button } from \"@/registry/default/ui/button\";\nimport { ScrollArea } from \"@/registry/default/ui/scroll-area\";\n\nexport const Sheet: typeof SheetPrimitive.Root = SheetPrimitive.Root;\n\nexport const SheetPortal: typeof SheetPrimitive.Portal = SheetPrimitive.Portal;\n\nexport function SheetTrigger(\n  props: SheetPrimitive.Trigger.Props,\n): React.ReactElement {\n  return <SheetPrimitive.Trigger data-slot=\"sheet-trigger\" {...props} />;\n}\n\nexport function SheetClose(\n  props: SheetPrimitive.Close.Props,\n): React.ReactElement {\n  return <SheetPrimitive.Close data-slot=\"sheet-close\" {...props} />;\n}\n\nexport function SheetBackdrop({\n  className,\n  ...props\n}: SheetPrimitive.Backdrop.Props): React.ReactElement {\n  return (\n    <SheetPrimitive.Backdrop\n      className={cn(\n        \"fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0\",\n        className,\n      )}\n      data-slot=\"sheet-backdrop\"\n      {...props}\n    />\n  );\n}\n\nexport function SheetViewport({\n  className,\n  side,\n  variant = \"default\",\n  ...props\n}: SheetPrimitive.Viewport.Props & {\n  side?: \"right\" | \"left\" | \"top\" | \"bottom\";\n  variant?: \"default\" | \"inset\";\n}): React.ReactElement {\n  return (\n    <SheetPrimitive.Viewport\n      className={cn(\n        \"fixed inset-0 z-50 grid\",\n        side === \"bottom\" && \"grid grid-rows-[1fr_auto] pt-12\",\n        side === \"top\" && \"grid grid-rows-[auto_1fr] pb-12\",\n        side === \"left\" && \"flex justify-start\",\n        side === \"right\" && \"flex justify-end\",\n        variant === \"inset\" && \"sm:p-4\",\n        className,\n      )}\n      data-slot=\"sheet-viewport\"\n      {...props}\n    />\n  );\n}\n\nexport function SheetPopup({\n  className,\n  children,\n  showCloseButton = true,\n  side = \"right\",\n  variant = \"default\",\n  closeProps,\n  portalProps,\n  ...props\n}: SheetPrimitive.Popup.Props & {\n  showCloseButton?: boolean;\n  side?: \"right\" | \"left\" | \"top\" | \"bottom\";\n  variant?: \"default\" | \"inset\";\n  closeProps?: SheetPrimitive.Close.Props;\n  portalProps?: SheetPrimitive.Portal.Props;\n}): React.ReactElement {\n  return (\n    <SheetPortal {...portalProps}>\n      <SheetBackdrop />\n      <SheetViewport side={side} variant={variant}>\n        <SheetPrimitive.Popup\n          className={cn(\n            \"relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 transition-[opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:before:hidden dark:before:shadow-[0_-1px_--theme(--color-white/6%)]\",\n            side === \"bottom\" &&\n              \"row-start-2 border-t data-ending-style:translate-y-8 data-starting-style:translate-y-8\",\n            side === \"top\" &&\n              \"border-b data-ending-style:-translate-y-8 data-starting-style:-translate-y-8\",\n            side === \"left\" &&\n              \"w-[calc(100%-(--spacing(12)))] max-w-md border-e data-ending-style:-translate-x-8 data-starting-style:-translate-x-8\",\n            side === \"right\" &&\n              \"col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md border-s data-ending-style:translate-x-8 data-starting-style:translate-x-8\",\n            variant === \"inset\" &&\n              \"before:hidden sm:rounded-2xl sm:border sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=sheet-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]\",\n            className,\n          )}\n          data-slot=\"sheet-popup\"\n          {...props}\n        >\n          {children}\n          {showCloseButton && (\n            <SheetPrimitive.Close\n              aria-label=\"Close\"\n              className=\"absolute end-2 top-2\"\n              render={<Button size=\"icon\" variant=\"ghost\" />}\n              {...closeProps}\n            >\n              <XIcon />\n            </SheetPrimitive.Close>\n          )}\n        </SheetPrimitive.Popup>\n      </SheetViewport>\n    </SheetPortal>\n  );\n}\n\nexport function SheetHeader({\n  className,\n  render,\n  ...props\n}: useRender.ComponentProps<\"div\">): React.ReactElement {\n  const defaultProps = {\n    className: cn(\n      \"flex flex-col gap-2 p-6 in-[[data-slot=sheet-popup]:has([data-slot=shee
```

**File**: `apps/ui/registry/default/ui/alert-dialog.tsx` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export function AlertDialogBackdrop({
   return (
     <AlertDialogPrimitive.Backdrop
       className={cn(
-        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
+        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute",
         className,
       )}
       data-slot="alert-dialog-backdrop"
```

**File**: `apps/ui/registry/default/ui/command.tsx` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export function CommandDialogBackdrop({
   return (
     <CommandDialogPrimitive.Backdrop
       className={cn(
-        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
+        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute",
         className,
       )}
       data-slot="command-dialog-backdrop"
```

**File**: `apps/ui/registry/default/ui/dialog.tsx` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ export function DialogBackdrop({
   return (
     <DialogPrimitive.Backdrop
       className={cn(
-        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
+        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute",
         className,
       )}
       data-slot="dialog-backdrop"
```

---

### Incident Patch 7: `81151ba8` (2026-10-07)
**Commit Message**: feat(ui): update Cal Sans to 2.010 (#857)

Pick up the latest cossui cut so product UI gets the 2.010 kerning and accent fixes.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `packages/ui/src/fonts/README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ export default function RootLayout({ children }) {
 
 ## Available Fonts
 
-- `fontSans` — Cal Sans 2.0 variable font (`CalSansVF.woff2` upright, `CalSansVF-Italic.woff2` italic)
+- `fontSans` — Cal Sans 2.010 variable font (`CalSansVF.woff2` upright, `CalSansVF-Italic.woff2` italic)
 - `fontHeading` — Alias of `fontSans`; use when wiring a separate `--font-heading` variable
 - `fontMono` — Paper Mono for code and monospace UI
 
```

---

### Incident Patch 8: `dd49ec9c` (2026-09-30)
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

### Incident Patch 9: `8423f18a` (2026-09-27)
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

### Incident Patch 10: `59e8c88c` (2026-09-22)
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

### Incident Patch 11: `60b6b444` (2026-09-21)
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

### Incident Patch 12: `81634815` (2026-09-16)
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

### Incident Patch 13: `3bab6543` (2026-09-07)
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

### Incident Patch 14: `4b1240be` (2026-09-07)
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

### Incident Patch 15: `705cb737` (2026-09-05)
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

#### Recent Merged Pull Requests:
- **PR #867** (2026-10-12): fix(ui): preserve composer focus and align border radii (@pasqualevitiello)
- **PR #866** (2026-10-12): chore: add @pasqualevitiello as CODEOWNER for apps/ui (@keithwillcode)
- **PR #865** (2026-10-12): style(ui): match composer chrome to textarea (@pasqualevitiello)
- **PR #863** (2026-10-12): feat(shipyard): shipyard's website and docs at coss.com/shipyard (@PeerRich)
- **PR #862** (2026-10-12): style(ui): use bold titles for overlays and empty states (@pasqualevitiello)
- **PR #861** (2026-10-12): fix(ui): handle bottom drawer keyboards automatically (@pasqualevitiello)
- **PR #860** (2026-10-11): fix(ui): prevent iOS Safari clipping after modal dismissal (@pasqualevitiello)
- **PR #859** (2026-10-12): feat: add composable chat composer (@pasqualevitiello)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
