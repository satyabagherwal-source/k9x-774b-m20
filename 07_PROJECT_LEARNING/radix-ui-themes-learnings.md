# Forensic Learning Record (Deep Inspection): radix-ui/themes

> **Canonical Artifact**: `07_PROJECT_LEARNING/radix-ui-themes-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/radix-ui/themes](https://github.com/radix-ui/themes))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:59.784Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `radix-ui/themes`
- **Description**: Radix Themes is an open-source component library optimized for fast development, easy maintenance, and accessibility. Maintained by @workos.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8746 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/playground/app/(themeable)/sink/_utils.tsx`
```
export function upperFirst(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const colorsRegular = [
  'tomato',
  'red',
  'ruby',
  'crimson',
  'pink',
  'plum',
  'purple',
  'violet',
  'iris',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'jade',
  'green',
  'grass',
  'brown',
  'orange',
] as const;
export const colorsBright = ['sky', 'mint', 'lime', 'yellow', 'amber'] as const;
export const colorsMetal = ['gold', 'bronze'] as const;
export const accentColorsGrouped = [
  { label: 'Regulars', values: colorsRegular },
  { label: 'Brights', values: colorsBright },
  { label: 'Metals', values: colorsMetal },
  { label: 'Gray', values: ['gray'] as const },
];

```

### Core Architecture Module: `apps/playground/app/(static-theme)/layout.tsx`
```
import { Theme } from './theme';

export default function Layout({ children }: LayoutProps<'/'>) {
  return <Theme>{children}</Theme>;
}

```

### Core Architecture Module: `apps/playground/app/(static-theme)/theme.tsx`
```
'use client';

import * as React from 'react';
import { Theme as RadixTheme, ThemeProps } from '@radix-ui/themes';
import { accentColors, appearances, radii, scalings } from '@radix-ui/themes/props';
import { useSearchParams } from 'next/navigation';

function ThemeImpl({
  appearance,
  accentColor,
  radius,
  scaling,
  ...props
}: ThemeProps & {
  appearance: (typeof appearances)[number] | undefined;
  accentColor: (typeof accentColors)[number] | undefined;
  radius: (typeof radii)[number] | undefined;
  scaling: (typeof scalings)[number] | undefined;
}) {
  return (
    <RadixTheme
      appearance={appearance}
      accentColor={accentColor}
      radius={radius}
      scaling={scaling}
      {...props}
    />
  );
}

function Themeable(props: ThemeProps) {
  const searchParams = useSearchParams();
  const appearance = searchParams.get('appearance');
  const accentColor = searchParams.get('accentColor') ?? 'violet';
  const radius = searchParams.get('radius');
  const scaling = searchParams.get('scaling');
  return (
    <ThemeImpl
      appearance={isAppearance(appearance) ? appearance : 'dark'}
      accentColor={isAccentColor(accentColor) ? accentColor : 'violet'}
      radius={isRadius(radius) ? radius : undefined}
      scaling={isScaling(scaling) ? scaling : undefined}
      {...props}
    />
  );
}

export function Theme(props: ThemeProps) {
  return (
    <React.Suspense
      fallback={
        <ThemeImpl appearance="dark" accentColor="violet" radius={undefined} scaling={undefined} />
      }
    >
      <Themeable {...props} />
    </React.Suspense>
  );
}

function isAppearance(value: unknown): value is (typeof appearances)[number] {
  return isString(value) && appearances.includes(value as (typeof appearances)[number]);
}

function isAccentColor(value: unknown): value is (typeof accentColors)[number] {
  return isString(value) && accentColors.includes(value as (typeof accentColors)[number]);
}

function isRadius(value: unknown): value is (typeof radii)[number] {
  return isString(value) && radii.includes(value as (typeof radii)[number]);
}

function isScaling(value: unknown): value is (typeof scalings)[number] {
  return isString(value) && scalings.includes(value as (typeof scalings)[number]);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/demo/page.tsx`
```
import * as React from 'react';
import {
  Avatar,
  Flex,
  Separator,
  Text,
  Button,
  IconButton,
  Dialog,
  TextField,
  Select,
  Box,
  Container,
} from '@radix-ui/themes';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { users } from './users';

export default function Demo() {
  return (
    <Container size="1" py="8" mx="4">
      {users.map((user) => {
        return (
          <React.Fragment key={user.id}>
            <Flex align="center" justify="between">
              <Flex align="center" gap="3">
                <Avatar src={user.image} fallback={user.name[0]} radius="full" />
                <Flex direction="column">
                  <Text size="2">{user.name}</Text>
                  <Text size="1" color="gray">
                    {user.handle}
                  </Text>
                </Flex>
              </Flex>
              <Dialog.Root>
                <Dialog.Trigger>
                  <IconButton aria-label="Edit user" variant="soft">
                    <Pencil1Icon />
                  </IconButton>
                </Dialog.Trigger>
                <Dialog.Content>
                  <Flex direction="column" gap="5">
                    <Box>
                      <Dialog.Title>{user.name}</Dialog.Title>
                      <Dialog.Description>Edit and save details below.</Dialog.Description>
                    </Box>
                    <Flex direction="column">
                      <Flex direction="column">
                        <Text
                          size="1"
                          weight="bold"
                          color="gray"
                          mb="1"
                          as="label"
                          htmlFor={`name-field-${user.id}`}
                        >
                          Name
                        </Text>
                        <TextField.Root
                          defaultValue={user.name}
                          mb="2"
                          id={`name-field-${user.id}`}
                        />
                      </Flex>
                      <Flex direction="column">
                        <Text
                          size="1"
                          weight="bold"
                          color="gray"
                          mb="1"
                          id={`role-label-${user.id}`}
                          as="label"
                        >
                          Role
                        </Text>
                        <Select.Root defaultValue={user.role}>
                          <Select.Trigger aria-labelledby={`role-label-${user.id}`} />
                          <Select.Content variant="soft" color="gray">
                            <Select.Item value="viewer">Viewer</Select.Item>
                            <Select.Item value="maintainer">Maintainer</Select.Item>
                            <Select.Item value="contributor">Contributor</Select.Item>
                            <Select.Item value="admin">Admin</Select.Item>
                          </Select.Content>
                        </Select.Root>
                      </Flex>
                    </Flex>
                    <Flex justify="end" gap="3">
                      <Dialog.Close>
                        <Button variant="soft" color="gray">
                          Cancel
                        </Button>
                      </Dialog.Close>
                      <Dialog.Close>
                        <Button variant="solid">Save</Button>
                      </Dialog.Close>
                    </Flex>
                  </Flex>
                </Dialog.Content>
              </Dialog.Root>
            </Flex>
            <Separator size="4" my="3" />
          </React.Fragment>
        );
      })}
    </Container>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/demo/users.ts`
```
type User = {
  id: string;
  image?: string;
  name: string;
  handle: string;
  role: 'admin' | 'maintainer' | 'contributor' | 'viewer';
};

export const users: User[] = [
  {
    id: 'user1',
    image: avatar('1544005313-94ddf0286df2'),
    name: 'Emmeline Labrie',
    handle: '@emmeline_labrie',
    role: 'contributor',
  },
  {
    id: 'user2',
    image: avatar('1522075469751-3a6694fb2f61'),
    name: 'Zac Wight',
    handle: '@zacwight',
    role: 'admin',
  },
  {
    id: 'user3',
    image: avatar('1632765854612-9b02b6ec2b15', { x: 0.4, y: 0.35, zoom: 1.05 }),
    name: 'Zahra Ambessa',
    handle: '@zahraambessa',
    role: 'viewer',
  },
  {
    id: 'user4',
    image: avatar('1533933269825-da140ad3132f', { y: 0.46, zoom: 1.25 }),
    name: 'Tilde Thygesen',
    handle: '@tildethygesen',
    role: 'maintainer',
  },
  {
    id: 'user5',
    name: 'Joaquin Verdugo',
    handle: '@joaquinverdugo',
    role: 'viewer',
  },
  {
    id: 'user6',
    image: avatar('1496345875659-11f7dd282d1d', { x: 0.49, y: 0.5, zoom: 2.5 }),
    name: 'Craig Caldwell',
    handle: '@craigcaldwell',
    role: 'contributor',
  },
  {
    id: 'user7',
    name: 'Harrison Mellor',
    handle: '@harrison_mellor',
    role: 'viewer',
  },
];

//
//
//
//
//
//
//
function avatar(id: string, params?: { x?: number; y?: number; zoom?: number }) {
  let crop = '';
  if (params === undefined) {
    crop = 'faces';
  } else {
    const { x = 0.5, y = 0.5, zoom = 1 } = params ?? {};
    crop = `focalpoint&fp-x=${x}&fp-y=${y}&fp-z=${zoom}`;
  }
  return `https://images.unsplash.com/photo-${id}?&w=64&h=64&dpr=2&q=70&crop=${crop}&fit=crop`;
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/ghost-balance/page.tsx`
```
import * as React from 'react';
import {
  Section,
  Flex,
  Grid,
  Button,
  IconButton,
  Link,
  Popover,
  Container,
} from '@radix-ui/themes';
import {
  ChatBubbleIcon,
  DotsHorizontalIcon,
  FileTextIcon,
  QuestionMarkCircledIcon,
  SunIcon,
} from '@radix-ui/react-icons';

export default function Ghost() {
  return (
    <Container py="8" mx="4">
      <Flex wrap="wrap" width="100%">
        <Grid columns="2">
          {(['row', 'column'] as const).map((direction) => (
            <Section key={direction}>
              <Flex direction={direction === 'row' ? 'column' : 'row'} gap="7">
                <Flex
                  direction={direction}
                  align={direction === 'row' ? 'center' : 'start'}
                  gap="4"
                >
                  <Button variant="ghost" size="1">
                    Action
                  </Button>
                  <Button variant="ghost" size="1">
                    Cancel
                  </Button>
                  <Button size="1">Save</Button>
                  <Button size="1">Delete</Button>
                  <IconButton variant="ghost" size="1" radius="full">
                    <SunIcon />
                  </IconButton>
                </Flex>

                <Flex
                  direction={direction}
                  align={direction === 'row' ? 'center' : 'start'}
                  gap="4"
                >
                  <Button variant="ghost" size="2">
                    Action
                  </Button>
                  <Button variant="ghost" size="2">
                    Cancel
                  </Button>
                  <Button size="2">Save</Button>
                  <Button size="2">Delete</Button>
                  <IconButton variant="ghost" size="2" radius="full">
                    <SunIcon />
                  </IconButton>
                </Flex>

                <Flex
                  direction={direction}
                  align={direction === 'row' ? 'center' : 'start'}
                  gap="5"
                >
                  <Button variant="ghost" size="3">
                    Action
                  </Button>
                  <Button variant="ghost" size="3">
                    Cancel
                  </Button>
                  <Button size="3">Save</Button>
                  <Button size="3">Delete</Button>
                  <IconButton variant="ghost" size="3" radius="full">
                    <SunIcon />
                  </IconButton>
                </Flex>

                <Flex
                  direction={direction}
                  align={direction === 'row' ? 'center' : 'start'}
                  gap="4"
                >
                  <Button variant="ghost" size="2">
                    <QuestionMarkCircledIcon />
                    Help
                  </Button>
                  <Button variant="ghost" size="2">
                    <ChatBubbleIcon />
                    Feedback
                  </Button>
                  <Flex asChild align="center" gap="1">
                    <Link size="2" href="#">
                      <FileTextIcon />
                      Docs
                    </Link>
                  </Flex>
                  <IconButton variant="ghost" size="2" radius="full">
                    <SunIcon />
                  </IconButton>
                </Flex>

                <Flex
                  direction={direction}
                  align={direction === 'row' ? 'center' : 'start'}
                  gap="4"
                >
                  <Popover.Root>
                    <Popover.Trigger>
                      <Button variant="ghost">Open</Button>
                    </Popover.Trigger>
                    <Popover.Content sideOffset={0} style={{ padding: 100 }} />
                  </Popover.Root>

                  <Popover.Root>
                    <Popover.Trigger>
                      <IconButton variant="ghost">
                        <DotsHorizontalIcon />
                      </IconButton>
                    </Popover.Trigger>
                    <Popover.Content sideOffset={0} style={{ padding: 100 }} />
                  </Popover.Root>
                </Flex>
              </Flex>
            </Section>
          ))}
        </Grid>
        <Flex direction="column" gap="2" mb="5">
          <Flex align="center" gap="5">
            <Button variant="ghost">Cancel</Button>
            <Button>Save</Button>
          </Flex>

          <Flex align="center">
            <Button variant="ghost" mr="5">
              Cancel
            </Button>
            <Button>Save</Button>
          </Flex>
        </Flex>
        <Flex direction="column" gap="2" style={{ width: 500 }}>
          <Flex align="center" justify="between">
            <Button variant="ghost">Cancel</Button>
            <Button>Save</Button>
          </Flex>

          <Flex align="center">
            <Button variant="ghost" mr="auto">
              Cancel
            </Button>
            <Button>Save</Button>
          </Flex>
        </Flex>
      </Flex>
    </Container>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/layout.tsx`
```
import { Theme, ThemePanel } from '@radix-ui/themes';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <Theme appearance="dark" accentColor="violet">
      {children}
      <ThemePanel defaultOpen={false} />
    </Theme>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/sink/_components.tsx`
```
import type * as React from 'react';
import {
  ContextMenu,
  DropdownMenu,
  Flex,
  Grid,
  Select,
  Switch,
  Table,
  Text,
  TextArea,
  TextField,
  Button,
  Heading,
} from '@radix-ui/themes';

export function DropdownMenuContentDemo(props: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Content {...props}>
      <DropdownMenu.Item shortcut="⌘+T">New Tab</DropdownMenu.Item>
      <DropdownMenu.Item shortcut="⌘+N">New Window</DropdownMenu.Item>
      <DropdownMenu.Item shortcut="⇧+⌘+N" disabled>
        New Private Window
      </DropdownMenu.Item>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>More Tools</DropdownMenu.SubTrigger>

        <DropdownMenu.SubContent>
          <DropdownMenu.Item shortcut="⌘+S">Save Page As…</DropdownMenu.Item>
          <DropdownMenu.Item>Create Shortcut…</DropdownMenu.Item>
          <DropdownMenu.Item>Name Window…</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item>Developer Tools</DropdownMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>

      <DropdownMenu.Separator />
      <DropdownMenu.Group>
        <DropdownMenu.Label>Other</DropdownMenu.Label>
        <DropdownMenu.Item shortcut="⌘+P">Print</DropdownMenu.Item>
        <DropdownMenu.Item shortcut="⌘+Q" asChild>
          <a href="#logout">Logout</a>
        </DropdownMenu.Item>
      </DropdownMenu.Group>

      {props.variant === 'solid' && (
        <>
          <DropdownMenu.Separator />

          <DropdownMenu.CheckboxItem shortcut="⌘+B" checked>
            Show Bookmarks
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem>Show Full URLs</DropdownMenu.CheckboxItem>

          <DropdownMenu.Separator />

          <DropdownMenu.Label>People</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value="pedro">
            <DropdownMenu.RadioItem value="pedro">Pedro Duarte</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="colm">Colm Tuite</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>

          <DropdownMenu.Separator />

          <DropdownMenu.Item color="red">Delete</DropdownMenu.Item>
        </>
      )}
    </DropdownMenu.Content>
  );
}

export function ContextMenuContentDemo(props: React.ComponentProps<typeof ContextMenu.Content>) {
  return (
    <ContextMenu.Content {...props}>
      <ContextMenu.Item shortcut="⌘+T">New Tab</ContextMenu.Item>
      <ContextMenu.Item shortcut="⌘+N">New Window</ContextMenu.Item>
      <ContextMenu.Item shortcut="⇧+⌘+N" disabled>
        New Private Window
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger>More Tools</ContextMenu.SubTrigger>

        <ContextMenu.SubContent>
          <ContextMenu.Item shortcut="⌘+S">Save Page As…</ContextMenu.Item>
          <ContextMenu.Item>Create Shortcut…</ContextMenu.Item>
          <ContextMenu.Item>Name Window…</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item>Developer Tools</ContextMenu.Item>
        </ContextMenu.SubContent>
      </ContextMenu.Sub>

      <ContextMenu.Separator />
      <ContextMenu.Group>
        <ContextMenu.Label>Other</ContextMenu.Label>
        <ContextMenu.Item shortcut="⌘+P">Print</ContextMenu.Item>
        <ContextMenu.Item shortcut="⌘+Q" asChild>
          <a href="#logout">Logout</a>
        </ContextMenu.Item>
      </ContextMenu.Group>

      {props.variant === 'solid' && (
        <>
          <ContextMenu.Separator />

          <ContextMenu.CheckboxItem shortcut="⌘+B" checked>
            Show Bookmarks
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem>Show Full URLs</ContextMenu.CheckboxItem>

          <ContextMenu.Separator />

          <ContextMenu.Label>People</ContextMenu.Label>
          <ContextMenu.RadioGroup value="pedro">
            <ContextMenu.RadioItem value="pedro">Pedro Duarte</ContextMenu.RadioItem>
            <ContextMenu.RadioItem value="colm">Colm Tuite</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>

          <DropdownMenu.Separator />

          <ContextMenu.Item color="red">Delete</ContextMenu.Item>
        </>
      )}
    </ContextMenu.Content>
  );
}

type RightClickAreaProps = React.ComponentProps<typeof Grid> & {
  size: '1' | '2';
};
export function RightClickArea({ size = '2', ...props }: RightClickAreaProps) {
  return (
    <Grid
      height={size === '2' ? '48px' : '32px'}
      px="3"
      {...props}
      style={{
        placeItems: 'center',
        borderRadius: 'var(--radius-3)',
        border: '1px dashed var(--accent-6)',
        cursor: 'default',
        ...props.style,
      }}
    >
      <Text size="1" color="gray">
        Right-click here
      </Text>
    </Grid>
  );
}

export function SelectItemsDemo() {
  return (
    <>
      <Select.Group>
        <Select.Label>Fruits</Select.Label>
        <Select.Item value="orange">Orange</Select.Item>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="grapes" disabled>
          Grape
        </Select.Item>
      </Select.Group>

      <Select.Separator />

      <Select.Group>
        <Select.Label>Vegetables</Select.Label>
        <Select.Item value="carrot">Carrot</Select.Item>
        <Select.Item value="potato">Potato</Select.Item>
      </Select.Group>
    </>
  );
}

export function AspectRatioImage() {
  return (
    <img
      src="https://images.unsplash.com/photo-1605030753481-bb38b08c384a?&auto=format&fit=crop&w=400&q=80"
      alt="A house in a forest"
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
    />
  );
}

export function CustomUserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: '60%', height: '60%' }}
    >
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SampleNestedUI({
  children,
  title,
  ...props
}: React.ComponentPropsWithRef<typeof Flex>) {
  return (
    <Flex
      p="5"
      gap="9"
      {...props}
      style={{
        boxShadow: '0 0 0 1px var(--gray-a6)',
        borderRadius: 'var(--radius-2)',
      }}
    >
      <div>
        <Heading size="2" trim="start" mb="3">
          {title}
        </Heading>
        <Flex direction="column" gap="3">
          <Grid gap="1">
            <Text as="p" weight="bold">
              Feedback
            </Text>
            <TextArea variant="classic" placeholder="Your feedback" />
          </Grid>
          <Flex asChild justify="between">
            <label>
              <Text color="gray" size="2">
                Attach screenshot?
              </Text>
              <Switch size="1" variant="classic" defaultChecked highContrast />
            </label>
          </Flex>
          <Grid columns="2" gap="2">
            <Button variant="surface">Back</Button>
            <Button variant="classic">Submit</Button>
          </Grid>
        </Flex>
      </div>

      {children}
    </Flex>
  );
}

export function PlaygroundForm({
  size,
  ...props
}: React.ComponentProps<typeof Flex> & {
  size?: React.ComponentProps<typeof TextField.Root>['size'];
}) {
  return (
    <Flex direction="column" gap="3" {...props}>
      <Grid gap="1">
        <Text size={size} weight="bold">
          Email
        </Text>
        <TextField.Root size={size} variant="classic" placeholder="Your email" />
      </Grid>
      <Grid gap="1">
        <Text size={size} weight="bold">
          Subject
        </Text>
        <Select.Root defaultValue="customer" size={size}>
          <Select.Trigger variant="classic" />
          <Select.Content>
            <Select.Item value="customer">Customer feedback</Select.Item>
            <Select.Item value="help">Help</Select.Item>
          </Select.Content>
        </Select.Root>
      </Grid>
      <Grid gap="1">
        <Text size={size} weight="bold">
          Feedback
        </Text>
        <TextArea size={size} variant="classic" placeholder="Your feedback" />
      </Grid>
      <Grid columns="2" gap="2">
        <Button size={size} variant="surface">
          Back
        </Button>
        <Button size={size} variant="classic">
          Submit
        </Button>
      </Grid>
    </Flex>
  );
}

export function TableExample(
  props: React.ComponentProps<typeof Table.Root> & { noEmail?: boolean },
) {
  const { noEmail, ...rootProps } = props;
  return (
    <Table.Root {...rootProps}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Full name</Table.ColumnHeaderCell>
          {!noEmail && <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>}
          <Table.ColumnHeaderCell>Group</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.RowHeaderCell>Andy</Table.RowHeaderCell>
          {!noEmail && <Table.Cell>andy@workos.com</Table.Cell>}
          <Table.Cell>Developer</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.RowHeaderCell>Benoit</Table.RowHeaderCell>
          {!noEmail && <Table.Cell>benoit@workos.com</Table.Cell>}
          <Table.Cell>Admin</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.RowHeaderCell>Lucas</Table.RowHeaderCell>
          {!noEmail && <Table.Cell>lucas@workos.com</Table.Cell>}
          <Table.Cell>Developer</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.RowHeaderCell>Vlad</Table.RowHeaderCell>
          {!noEmail && <Table.Cell>vlad@workos.com</Table.Cell>}
          <Table.Cell>Designer</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/sink/alert-dialog/page.tsx`
```
import { AlertDialog, Button, Flex } from '@radix-ui/themes';
import { DocsSection, DocsSectionBody, DocsSectionHeading } from '../docs-section';

export default function AlertDialogPage() {
  return (
    <DocsSection>
      <DocsSectionHeading>AlertDialog</DocsSectionHeading>
      <DocsSectionBody>
        <AlertDialog.Root>
          <AlertDialog.Trigger>
            <Button variant="solid">Open</Button>
          </AlertDialog.Trigger>
          <AlertDialog.Content maxWidth="450px">
            <Flex direction="column" gap="3">
              <AlertDialog.Title>Revoke setup link</AlertDialog.Title>
              <AlertDialog.Description>
                The setup link will no longer be accessible and any existing setup sessions will be
                revoked.
              </AlertDialog.Description>
              <Flex gap="3" mt="4" justify="end">
                <AlertDialog.Cancel>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action>
                  <Button variant="solid" color="red">
                    Revoke link
                  </Button>
                </AlertDialog.Action>
              </Flex>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </DocsSectionBody>
    </DocsSection>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/sink/avatar/page.tsx`
```
import { Fragment } from 'react';
import { Avatar, Box, Code, Flex, Table, Text } from '@radix-ui/themes';
import { avatarPropDefs } from '@radix-ui/themes/props';
import { DocsSection, DocsSectionBody, DocsSectionHeading } from '../docs-section';
import { CustomUserIcon } from '../_components';
import { accentColorsGrouped } from '../_utils';

export default function AvatarPage() {
  return (
    <DocsSection>
      <DocsSectionHeading>Avatar</DocsSectionHeading>
      <DocsSectionBody>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell />
              <Table.ColumnHeaderCell>image</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>1 letter</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>2 letters</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>icon</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>+ high-contrast</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>gray</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>+ high-contrast</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {avatarPropDefs.variant.values.map((variant) => (
              <Table.Row key={variant}>
                <Table.RowHeaderCell>{variant}</Table.RowHeaderCell>
                <Table.Cell>
                  <Avatar variant={variant} src="./api/avatar" fallback="D" />
                </Table.Cell>
                <Table.Cell>
                  <Avatar variant={variant} fallback="D" />
                </Table.Cell>
                <Table.Cell>
                  <Avatar variant={variant} fallback="BG" />
                </Table.Cell>
                <Table.Cell>
                  <Avatar variant={variant} fallback={<CustomUserIcon />} />
                </Table.Cell>
                <Table.Cell>
                  <Avatar variant={variant} highContrast fallback="D" />
                </Table.Cell>
                <Table.Cell>
                  <Avatar variant={variant} color="gray" fallback="D" />
                </Table.Cell>
                <Table.Cell>
                  <Avatar variant={variant} color="gray" highContrast fallback="D" />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <Table.Root>
          <Table.Body>
            {avatarPropDefs.size.values.map((size) => (
              <Table.Row key={size}>
                <Table.RowHeaderCell>{size}</Table.RowHeaderCell>
                <Table.Cell>
                  <Flex gap="3">
                    <Avatar size={size} src="./api/avatar" fallback="D" />
                    <Avatar size={size} fallback="D" />
                    <Avatar size={size} fallback="BG" />
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <Text as="p" my="5">
          <Code>radius</Code> can be set per instance:
        </Text>

        <details>
          <summary>
            <Text size="2" color="gray">
              See specific radius examples
            </Text>
          </summary>
          <Box mt="3">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell />
                  {avatarPropDefs.size.values.map((size) => (
                    <Table.ColumnHeaderCell key={size}>size {size}</Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {avatarPropDefs.radius.values.map((radius) => (
                  <Table.Row key={radius}>
                    <Table.RowHeaderCell>{radius}</Table.RowHeaderCell>
                    {avatarPropDefs.size.values.map((size) => (
                      <Table.Cell key={size}>
                        <Avatar size={size} radius={radius} src="./api/avatar" fallback="D" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </details>

        <Text as="p" my="5">
          <Code>color</Code> can be set per instance:
        </Text>

        <details>
          <summary>
            <Text size="2" color="gray">
              See colors & variants combinations
            </Text>
          </summary>
          {accentColorsGrouped.map(({ label, values }) => (
            <Fragment key={label}>
              <Text as="p" weight="bold" mt="6" mb="4">
                {label}
              </Text>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell />
                    {avatarPropDefs.variant.values.map((variant) => (
                      <Table.ColumnHeaderCell key={variant}>{variant}</Table.ColumnHeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {values.map((color) => (
                    <Table.Row key={color}>
                      <Table.RowHeaderCell>{color}</Table.RowHeaderCell>
                      {avatarPropDefs.variant.values.map((variant) => (
                        <Table.Cell key={variant}>
                          <Avatar variant={variant} color={color} fallback="D" />
                          <Avatar
                            variant={variant}
                            color={color}
                            highContrast
                            fallback="D"
                            ml="2"
                          />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Fragment>
          ))}
        </details>
      </DocsSectionBody>
    </DocsSection>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/sink/badge/page.tsx`
```
import { Fragment } from 'react';
import { Badge, Box, Code, Flex, Text, Table } from '@radix-ui/themes';
import { badgePropDefs } from '@radix-ui/themes/props';
import { DocsSection, DocsSectionBody, DocsSectionHeading } from '../docs-section';
import { accentColorsGrouped, upperFirst } from '../_utils';

export default function BadgePage() {
  return (
    <DocsSection>
      <DocsSectionHeading>Badge</DocsSectionHeading>
      <DocsSectionBody>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell />
              {badgePropDefs.size.values.map((size) => (
                <Table.ColumnHeaderCell key={size}>size {size}</Table.ColumnHeaderCell>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {badgePropDefs.variant.values.map((variant) => (
              <Table.Row key={variant}>
                <Table.RowHeaderCell>{variant}</Table.RowHeaderCell>
                {badgePropDefs.size.values.map((size) => (
                  <Table.Cell key={size}>
                    <Flex key={variant} gap="3" wrap="wrap" style={{ maxWidth: 600 }}>
                      {(['orange', 'violet', 'cyan', 'gray'] as const).map((color) => (
                        <Flex key={color} direction="column" gap="1">
                          <Badge size={size} variant={variant} color={color}>
                            {upperFirst(color)}
                          </Badge>
                        </Flex>
                      ))}
                    </Flex>
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <Text as="p" my="5">
          <Code>radius</Code> can be set per instance:
        </Text>

        <details>
          <summary>
            <Text size="2" color="gray">
              See specific radius examples
            </Text>
          </summary>
          <Box mt="3">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell />
                  {badgePropDefs.size.values.map((size) => (
                    <Table.ColumnHeaderCell key={size}>size {size}</Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {badgePropDefs.radius.values.map((radius) => (
                  <Table.Row key={radius}>
                    <Table.RowHeaderCell>{radius}</Table.RowHeaderCell>
                    {badgePropDefs.size.values.map((size) => (
                      <Table.Cell key={size}>
                        <Badge size={size} radius={radius}>
                          {upperFirst(radius)}
                        </Badge>
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </details>

        <Text as="p" my="5">
          <Code>color</Code> can be set per instance:
        </Text>

        <details>
          <summary>
            <Text size="2" color="gray">
              See colors & variants combinations
            </Text>
          </summary>
          {accentColorsGrouped.map(({ label, values }) => (
            <Fragment key={label}>
              <Text as="p" weight="bold" mt="6" mb="4">
                {label}
              </Text>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell />
                    {badgePropDefs.variant.values.map((variant) => (
                      <Table.ColumnHeaderCell key={variant}>{variant}</Table.ColumnHeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {values.map((color) => (
                    <Table.Row key={color}>
                      <Table.RowHeaderCell>{color}</Table.RowHeaderCell>
                      {badgePropDefs.variant.values.map((variant) => (
                        <Table.Cell key={variant}>
                          <Flex direction="column" align="start" gap="1">
                            <Badge variant={variant} color={color}>
                              {color}
                            </Badge>
                            <Badge variant={variant} color={color} highContrast>
                              {color}
                            </Badge>
                          </Flex>
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Fragment>
          ))}
        </details>
      </DocsSectionBody>
    </DocsSection>
  );
}

```

### Core Architecture Module: `apps/playground/app/(themeable)/sink/blockquote/page.tsx`
```
import { Blockquote, Flex, Text } from '@radix-ui/themes';
import { DocsSection, DocsSectionBody, DocsSectionHeading } from '../docs-section';

export default function BlockquotePage() {
  return (
    <DocsSection>
      <DocsSectionHeading>Blockquote</DocsSectionHeading>
      <DocsSectionBody>
        <Flex direction="column" align="start" gap="5">
          <Blockquote size="6" style={{ maxWidth: '50ch' }}>
            The goal of typography is to relate font size, line height, and line width in a
            proportional way that maximizes beauty and makes reading easier and more pleasant. The
            question is: What proportion(s) will give us the best results?
          </Blockquote>

          <Blockquote size="4" style={{ maxWidth: '50ch' }} color="gray" highContrast>
            The goal of typography is to relate font size, line height, and line width in a
            proportional way that maximizes <Text color="pink">beauty</Text> and makes reading
            easier and more pleasant. The question is: What proportion(s) will give us the best
            results?
          </Blockquote>

          <Blockquote size="2" style={{ maxWidth: '50ch' }} color="blue">
            The goal of typography is to relate font size, line height, and line width in a
            proportional way that maximizes <Text highContrast>beauty</Text> and makes reading
            easier and more pleasant. The question is: What proportion(s) will give us the best
            results?
          </Blockquote>
        </Flex>
      </DocsSectionBody>
    </DocsSection>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #452** (2024-04-12): **Safari MacOS: thin borders are blurry and inconsistent**
  *Symptoms*: In Safari (my Version is 17.4.1) borders are blurred:  <img width="529" alt="Screenshot 2024-04-12 at 07 49 49" src="https://github.com/radix-ui/themes/assets/33868262/5f26e5be-f033-4dcd-969a-39254159ea25">  This is well visible both on a 4k screen and the high-resolution internal MacBook display. I wasn't able to test this on a 1x monitor. This issue occurs only on MacOS. iOS looks fine.  If I replace the `box-shadow`s with `border: 1px solid ...` the effect disappears: <img width="543" alt="Screenshot 2024-04-12 at 07 49 20" src="https://github.com/radix-ui/themes/assets/33868262/230e7495-0572-4bc5-8aa8-b81cafd8e7c9"> 
  **Post-Mortem & Fix Analysis**:
  > Looks like you are zoomed in and Safari doesn't seem to handle it gracefully compared to other browsers. I don't think it warrants the work to reevaluate our use of box-shadows across the components as it looks fine at 100% zoom.

- **Issue #429** (2024-04-03): **.rt-reset causes trouble for TextArea components**
  *Symptoms*: Seems like using `unset: all` disables both regular spaces and line-breaks on `<TextArea />`s.
  **Post-Mortem & Fix Analysis**:
  > Released 3.0.2 with the fix
  > Thanks! Fyi: seemed to happen in chromium and chrome as well
  > Not seeing it in Chrome and Safari myself, what version and OS do you have?

- **Issue #428** (2024-04-03): **Support hover style for Link without href attribute**
  *Symptoms*: Before v3 the Link component didn't require the href attribute to be show the hover style and underline. I found this convenient as I often use it as an inline button of sorts.  This is related to the `any-link` pseudo selector.  Workaround: ```tsx <Link href="" onClick={(e) => [e.preventDefault(), ...]}>     ... </Link> ```
  **Post-Mortem & Fix Analysis**:
  > Released 3.0.2 with a fix that makes it so that links rendered as buttons retain hover styles.  To clarify, what you seem to be doing is not accessible. You should use the `asChild` prop to render link with `button` tags:  ```jsx <Link asChild>   <button onClick={...}>Button that looks like link</button> </Link> ```
  > That's fair, this works great. Thanks!

- **Issue #414** (2024-03-25): **SassError: expected selector. 3.0.0**
  *Symptoms*: Build fails with Next.js 14.1.0 after upgrading @radix-ui/themes to 3.0.0  It works if I remove the comma from `[type='range'],) {` in `node_modules/@radix-ui/themes/styles.css` ``` Failed to compile. ./node_modules/next/dist/build/webpack/loaders/css-loader/src/index.js?? ruleSet[1].rules[11].oneOf[13].use[2]!./node_modules/next/dist/build/webpack/loaders/postcss-loader/src/index.js?? ruleSet[1].rules[11].oneOf[13].use[3]!./node_modules/next/dist/build/webpack/loaders/resolve-url-loader/index.js?? ruleSet[1].rules[11].oneOf[13].use[4]!./node_modules/next/dist/compiled/sass-loader/cjs.js?? ruleSet[1].rules[11].oneOf[13].use[5]!./node_modules/@radix-ui/themes/styles.css SassError: expected selector.      ╷ 4807 │       [type='range'],) {      │                      ^      ╵ node_modules/@radix-ui/themes/styles.css 4807:22  root stylesheet Import trace for requested module: ./node_modules/next/dist/build/webpack/loaders/css-loader/src/index.js?? ruleSet[1].rules[11].oneOf[13].use[2]!./node_modules/next/dist/build/webpack/loaders/postcss-loader/src/index.js?? ruleSet[1].rules[11].oneOf[13].use[3]!./node_modules/next/dist/build/webpack/loaders/resolve-url-loader/index.js?? ruleSet[1].rules[11].oneOf[13].use[4]!./node_modules/next/dist/compiled/sass-loader/cjs.js?? ruleSet[1].rules[11].oneOf[13].use[5]!./node_modules/@radix-ui/themes/styles.css ./styles/globals.scss.webpack[javascript/auto]!=!./node_modules/next/dist/build/webpack/loaders/css-loader/src/index
  **Post-Mortem & Fix Analysis**:
  > We just fixed this in `3.0.1`

- **Issue #413** (2024-03-26): **RadioGroup disabled cursor style doesn't work in Safari**
  *Symptoms*: Before v3 the disabled cursor was applied directly to the radio group button but seems to have changed to use the ::before selector  https://github.com/radix-ui/themes/blob/481375cfbcf5d966ff6861936b716d9a45df4f4c/packages/radix-ui-themes/src/components/base-radio.css#L42  Making the following change brings back the previous behaviour  ```diff - &:where(:disabled, [data-disabled])::before {  + &:where(:disabled, [data-disabled]) {  ```  From the docs website <img width="562" alt="image" src="https://github.com/radix-ui/themes/assets/11774195/b02f61bd-4d0b-4a49-8e33-ccbbb32b728c">

- **Issue #280** (2024-02-06): **[Theme Appearance] The appearance is always `light` in Next.js `not-found` and `error` pages**
  *Symptoms*: I have a Next.js 14 project in development, and I am having this issue. I have my Radix Theme provider setup correctly in the root layout with a dark appearance and everything's working great. However, in the Next.js `not-found` and `error` pages, the appearance is always light unless I manually add again the provider to those pages, and end up having two radix providers on top of each other. I noticed the `dark` class name disappear from the html element, and that's maybe due to how Next.js behave in those routes or maybe a Radix Theme bug?
  **Post-Mortem & Fix Analysis**:
  > This is probably a Next.js quirk. I vaguely remember that we ran into a similar issue in one of our projects, but can’t remember the exact resolution because we've changed more to how theming works there after. Some ideas I'd suggest, assuming you are using dark mode only: - Remove `appearance="dark"` from the `Theme` provider and manually set `<html className="dark" style={{ color-scheme: "dark" }}>` in your root layout. - Or, if the workaround with nested Theme providers works, continue using that—it’s fine technically, they are designed to be nested.
  > Yes it's probably a Next.js thing since those pages are shown after a thrown error so that would probably be it. I'd rather keep the nested Theme providers, since it's a component export and thus will keep consistency across the whole codebase. Thank you!

- **Issue #269** (2024-01-31): **Runtime error when using asChild on Tabs trigger**
  *Symptoms*: Say I have an app, where tabs link to different routes (or query string changes), and I:  - want users to be able to right click and open tabs in a new window (but keep radix behaviour with a preventDefault when not opening in a new window) - improve SEO for these pages by ensuring links to them are picked up by a crawler  Then it's reasonable to want to configure the tabs component so that each tab is an anchor with an href instead of a button element.   Tabs trigger has an asChild prop which indicates this should be possible, however when it is used like this:  ```tsx <RadixThemes.Tabs.Trigger value={view} asChild>   <a href={`?${urlParams.toString()}`} onClick={(e) => e.preventDefault()}>     Some Tab   </a> </RadixThemes.Tabs.Trigger> ```  Then I get a runtime error:  ```console Unhandled Runtime Error Error: React.Children.only expected to receive a single React element child. ```  I think this is related the tabs trigger's children being duplicated to create rt-TabsTriggerInner and rt-TabsTriggerInnerHidden.  I have tried wrapping the children inside an anchor, without using asChild, which works but the click area for the link is smaller than the tab button (with hover effect) which is not ideal. 
  **Post-Mortem & Fix Analysis**:
  > Hey @penx, thanks for reporting.  Yes, we should fix this.  We have actually introduced a new `TabNav` component which will be much better for your use case, tabbed navigation (real links) but still has arrow keys support, etc. (we deal with that issue in that one too)  You can try it in the recently released RC [2.1.0-rc.5](https://www.npmjs.com/package/@radix-ui/themes/v/2.1.0-rc.5)
  > Awesome, thanks!  Do the docs or playground for release candidates get published anywhere?
  > No docs yet no, we'll update the docs when we release the public version.

- **Issue #217** (2024-01-05): **[<Select.Trigger>] Issue placeholder   **
  *Symptoms*: "use client" import { User } from "@prisma/client"; import { Select } from "@radix-ui/themes" import axios from "axios"; import { useEffect, useState } from "react";  const AssigneeSelect = () => {   const [users, setUsers] = useState<User[]>([]);    useEffect(() => {     const fetchUsers = async() => {       const { data } = await axios.get<User[]>('/api/users');       setUsers(data);     }     fetchUsers();     }, [])   return (     <Select.Root >           <Select.Trigger placeholder="Assignee..." />           <Select.Content >               <Select.Group>               <Select.Label>                    Suggestions                   </Select.Label>           {users.map(user =>             <Select.Item               key={user.id} value={user.id}>               {user.name}             </Select.Item>           )}               </Select.Group>           </Select.Content>                               </Select.Root>   ) }  export default AssigneeSelect;    Type '{ placeholder: string; }' is not assignable to type 'IntrinsicAttributes & Omit<SelectTriggerProps, "ref"> & RefAttributes<HTMLButtonElement>'.   Property 'placeholder' does not exist on type 'IntrinsicAttributes & Omit<SelectTriggerProps, "ref"> & RefAttributes<HTMLButtonElement>'.ts(2322) (property) placeholder: string           getting this error in my editor
  **Post-Mortem & Fix Analysis**:
  > This was fixed in 2.0.3, please update to the latest version.

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

### Incident Patch 1: `ce55c6ab` (2026-04-10)
**Commit Message**: update build script

**File**: `packages/radix-ui-themes/scripts/build-css.mjs` (modified, +1/-12)
```diff
@@ -10,18 +10,7 @@ const require = createRequire(import.meta.url);
 const __dirname = dirname(fileURLToPath(import.meta.url));
 const root = resolve(__dirname, '..');
 
-// Mirror the plugin pipeline from postcss.config.cjs
-const plugins = [
-  require('postcss-import')({ path: [resolve(root, '..')] }),
-  require('postcss-nesting'),
-  require(resolve(root, 'postcss-breakpoints.cjs')),
-  require('postcss-custom-media'),
-  require('postcss-combine-duplicated-selectors'),
-  require('postcss-discard-empty'),
-  require(resolve(root, 'postcss-whitespace.cjs')),
-  require('autoprefixer'),
-];
-
+const { plugins } = require(resolve(root, 'postcss.config.cjs'));
 const processor = postcss(plugins);
 
 // ---------------------------------------------------------------------------
```

---

### Incident Patch 2: `275e4edf` (2026-04-10)
**Commit Message**: update css build script

**File**: `packages/radix-ui-themes/package.json` (modified, +1/-13)
```diff
@@ -73,19 +73,7 @@
     "build:js:cjs:types": "tsc --outdir dist/cjs",
     "build:js:esm": "node scripts/esbuild-esm.js",
     "build:js:esm:types": "tsc --outdir dist/esm",
-    "build:css": "pnpm build:css:index && pnpm build:css:tokens && pnpm build:css:components && pnpm build:css:utilities && pnpm build:css:layout",
-    "build:css:index": "postcss src/styles/index.css -o styles.css",
-    "build:css:components": "postcss src/components/index.css -o components.css",
-    "build:css:utilities": "postcss src/styles/utilities/index.css -o utilities.css",
-    "build:css:tokens": "pnpm build:css:tokens:index && pnpm build:css:tokens:base && pnpm build:css:tokens:colors",
-    "build:css:tokens:index": "postcss src/styles/tokens/index.css -o tokens.css",
-    "build:css:tokens:base": "postcss src/styles/tokens/base.css -o tokens/base.css",
-    "build:css:tokens:colors": "postcss src/styles/tokens/colors/*.css --dir tokens/colors",
-    "build:css:layout": "pnpm build:css:layout:index && pnpm build:css:layout:tokens && pnpm build:css:layout:components && pnpm build:css:layout:utilities",
-    "build:css:layout:index": "postcss src/styles/layout.css -o layout.css",
-    "build:css:layout:tokens": "postcss src/styles/tokens/layout.css -o layout/tokens.css",
-    "build:css:layout:components": "postcss src/components/layout.css -o layout/components.css",
-    "build:css:layout:utilities": "postcss src/styles/utilities/layout.css -o layout/utilities.css",
+    "build:css": "node scripts/build-css.mjs",
     "dev": "pnpm dev:js & pnpm dev:css",
     "dev:js": "pnpm dev:js:cjs & pnpm dev:js:esm & pnpm dev:js:cjs:types & pnpm dev:js:esm:types",
     "dev:js:cjs": "node scripts/esbuild-cjs.js watch=true",
```

**File**: `packages/radix-ui-themes/scripts/build-css.mjs` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+// @ts-check
+import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
+import { createRequire } from 'node:module';
+import { dirname, resolve, join } from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { styleText } from 'node:util';
+import postcss from 'postcss';
+
+const require = createRequire(import.meta.url);
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const root = resolve(__dirname, '..');
+
+// Mirror the plugin pipeline from postcss.config.cjs
+const plugins = [
+  require('postcss-import')({ path: [resolve(root, '..')] }),
+  require('postcss-nesting'),
+  require(resolve(root, 'postcss-breakpoints.cjs')),
+  require('postcss-custom-media'),
+  require('postcss-combine-duplicated-selectors'),
+  require('postcss-discard-empty'),
+  require(resolve(root, 'postcss-whitespace.cjs')),
+  require('autoprefixer'),
+];
+
+const processor = postcss(plugins);
+
+// ---------------------------------------------------------------------------
+// Target definitions
+//
+//   group              – expands to a list of other target names
+//   input/output       – single file → single file
+//   inputDir/outputDir – every *.css in dir → same filename in output dir
+// ---------------------------------------------------------------------------
+const targets = {
+  index: { input: 'src/styles/index.css', output: 'styles.css' },
+  components: { input: 'src/components/index.css', output: 'components.css' },
+  utilities: { input: 'src/styles/utilities/index.css', output: 'utilities.css' },
+
+  tokens: { group: ['tokens/index', 'tokens/base', 'tokens/colors'] },
+  'tokens/index': { input: 'src/styles/tokens/index.css', output: 'tokens.css' },
+  'tokens/base': { input: 'src/styles/tokens/base.css', output: 'tokens/base.css' },
+  'tokens/colors': { inputDir: 'src/styles/tokens/colors', outputDir: 'tokens/colors' },
+
+  layout: { group: ['layout/index', 'layout/tokens', 'layout/components', 'layout/utilities'] },
+  'layout/index': { input: 'src/styles/layout.css', output: 'layout.css' },
+  'layout/tokens': { input: 'src/styles/tokens/layout.css', output: 'layout/tokens.css' },
+  'layout/components': { input: 'src/components/layout.css', output: 'layout/components.css' },
+  'layout/utilities': { input: 'src/styles/utilities/layout.css', output: 'layout/utilities.css' },
+};
+
+const defaultTargets = ['index', 'components', 'utilities', 'tokens', 'layout'];
+
+// ---------------------------------------------------------------------------
+// Build helpers
+// ---------------------------------------------------------------------------
+
+async function processFile(input, output) {
+  const inputPath = resolve(root, input);
+  const outputPath = resolve(root, output);
+  const css = await readFile(inputPath, 'utf-8');
+  const result = await processor.process(css, { from: inputPath, to: outputPath });
+  await mkdir(dirname(outputPath), { recursive: true });
+  await writeFile(outputPath, result.css);
+  console.log(`  ${styleText('gray', input)} → ${styleText('blue', output)}`);
+}
+
+async function processDir(inputDir, outputDir) {
+  const absIn = resolve(root, inputDir);
+  const files = (await readdir(absIn)).filter((f) => f.endsWith('.css'));
+  await mkdir(resolve(root, outputDir), { recursive: true });
+  for (const file of files) {
+    await processFile(join(inputDir, file), join(outputDir, file));
+  }
+}
+
+async function build(name) {
+  const target = targets[name];
+  if (!target) {
+    console.log(styleText('red', `Unknown target: "${name}"`));
+    console.log(`Available targets: ${Object.keys(targets).join(', ')}`);
+    process.exit(1);
+  }
+  if (target.group) {
+    for (const sub of target.group) {
+      await build(sub);
+    }
+  } else if (target.inputDir) {
+    await processDir(target.inputDir, target.outputDir);
+  } else {
+    await processFile(target.input, target.output);
+  }
+}
+
+// ---------------------------------------------------------------------------
+// CLI – accepts target names as positional args (with optional leading --)
+//
+//   node scripts/build-css.mjs                  # build everything
+//   node scripts/build-css.mjs layout           # build all layout targets
+//   node scripts/build-css.mjs --layout/index   # build a single target
+//   node scripts/build-css.mjs tokens layout    # multiple targets
+// ---------------------------------------------------------------------------
+const args = process.argv.slice(2).map((a) => a.replace(/^--/, ''));
+const names = args.length > 0 ? args : defaultTargets;
+
+if (names.length === 0) {
+  console.log(styleText('red', 'No targets specified'));
+  console.log(styleText('gray', 'Available targets:'), Object.keys(targets).join(', '));
+  process.exit(1);
+}
+
+console.log(styleText('yellow', 'Building CSS…'));
+console.log(styleText('gray', '-'.repeat(80)));
+for (const name of names) {
+  await build(name);
+}
+console.log(styleText('gray', '-'.
```

---

### Incident Patch 3: `4aaa40f8` (2026-02-03)
**Commit Message**: Run tests against prod build of Next (#791)

**File**: `apps/playground/playwright.config.ts` (modified, +2/-2)
```diff
@@ -23,9 +23,9 @@ export default defineConfig({
     },
   },
 
-  // Run the local dev server before starting tests
+  // Build and run the production server before starting tests
   webServer: {
-    command: 'pnpm --filter "playground" dev',
+    command: 'pnpm --filter "playground" build && pnpm --filter "playground" start',
     url: 'http://localhost:3000',
     reuseExistingServer: !process.env.CI,
     timeout: 120 * 1000,
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
     "build:pkg": "pnpm --filter \"@radix-ui/*\" build",
     "dev": "turbo run dev --no-cache --continue",
     "test:vr": "pnpm -r test:vr",
+    "test:vr:update": "pnpm -r test:vr:update",
     "lint": "turbo run lint",
     "clean": "turbo run clean && rm -rf node_modules .turbo",
     "format": "prettier --write .",
```

---

### Incident Patch 4: `556adc4a` (2026-02-03)
**Commit Message**: Update `postcss-custom-media` and `postcss-nesting` (#784)

**File**: `packages/radix-ui-themes/package.json` (modified, +2/-2)
```diff
@@ -134,10 +134,10 @@
     "postcss": "8.5.6",
     "postcss-cli": "11.0.1",
     "postcss-combine-duplicated-selectors": "10.0.3",
-    "postcss-custom-media": "10.0.2",
+    "postcss-custom-media": "12.0.0",
     "postcss-discard-empty": "7.0.1",
     "postcss-import": "16.1.1",
-    "postcss-nesting": "12.0.2",
+    "postcss-nesting": "14.0.0",
     "radix-ui": "^1.4.3",
     "react": "^19.2.4",
     "react-dom": "^19.2.4",
```

**File**: `pnpm-lock.yaml` (modified, +84/-26)
```diff
@@ -128,17 +128,17 @@ importers:
         specifier: 10.0.3
         version: 10.0.3(postcss@8.5.6)
       postcss-custom-media:
-        specifier: 10.0.2
-        version: 10.0.2(postcss@8.5.6)
+        specifier: 12.0.0
+        version: 12.0.0(postcss@8.5.6)
       postcss-discard-empty:
         specifier: 7.0.1
         version: 7.0.1(postcss@8.5.6)
       postcss-import:
         specifier: 16.1.1
         version: 16.1.1(postcss@8.5.6)
       postcss-nesting:
-        specifier: 12.0.2
-        version: 12.0.2(postcss@8.5.6)
+        specifier: 14.0.0
+        version: 14.0.0(postcss@8.5.6)
       react:
         specifier: ^19.2.4
         version: 19.2.4
@@ -236,36 +236,65 @@ packages:
     resolution: {integrity: sha512-0ZrskXVEHSWIqZM/sQZ4EV3jZJXRkio/WCxaqKZP1g//CEWEPSfeZFcms4XeKBCHU0ZKnIkdJeU/kF+eRp5lBg==}
     engines: {node: '>=6.9.0'}
 
-  '@csstools/cascade-layer-name-parser@1.0.13':
-    resolution: {integrity: sha512-MX0yLTwtZzr82sQ0zOjqimpZbzjMaK/h2pmlrLK7DCzlmiZLYFpoO94WmN1akRVo6ll/TdpHb53vihHLUMyvng==}
-    engines: {node: ^14 || ^16 || >=18}
+  '@csstools/cascade-layer-name-parser@3.0.0':
+    resolution: {integrity: sha512-/3iksyevwRfSJx5yH0RkcrcYXwuhMQx3Juqf40t97PeEy2/Mz2TItZ/z/216qpe4GgOyFBP8MKIwVvytzHmfIQ==}
+    engines: {node: '>=20.19.0'}
     peerDependencies:
-      '@csstools/css-parser-algorithms': ^2.7.1
-      '@csstools/css-tokenizer': ^2.4.1
+      '@csstools/css-parser-algorithms': ^4.0.0
+      '@csstools/css-tokenizer': ^4.0.0
 
   '@csstools/css-parser-algorithms@2.7.1':
     resolution: {integrity: sha512-2SJS42gxmACHgikc1WGesXLIT8d/q2l0UFM7TaEeIzdFCE/FPMtTiizcPGGJtlPo2xuQzY09OhrLTzRxqJqwGw==}
     engines: {node: ^14 || ^16 || >=18}
     peerDependencies:
       '@csstools/css-tokenizer': ^2.4.1
 
+  '@csstools/css-parser-algorithms@4.0.0':
+    resolution: {integrity: sha512-+B87qS7fIG3L5h3qwJ/IFbjoVoOe/bpOdh9hAjXbvx0o8ImEmUsGXN0inFOnk2ChCFgqkkGFQ+TpM5rbhkKe4w==}
+    engines: {node: '>=20.19.0'}
+    peerDependencies:
+      '@csstools/css-tokenizer': ^4.0.0
+
   '@csstools/css-tokenizer@2.4.1':
     resolution: {integrity: sha512-eQ9DIktFJBhGjioABJRtUucoWR2mwllurfnM8LuNGAqX3ViZXaUchqk+1s7jjtkFiT9ySdACsFEA3etErkALUg==}
     engines: {node: ^14 || ^16 || >=18}
 
+  '@csstools/css-tokenizer@4.0.0':
+    resolution: {integrity: sha512-QxULHAm7cNu72w97JUNCBFODFaXpbDg+dP8b/oWFAZ2MTRppA3U00Y2L1HqaS4J6yBqxwa/Y3nMBaxVKbB/NsA==}
+    engines: {node: '>=20.19.0'}
+
   '@csstools/media-query-list-parser@2.1.13':
     resolution: {integrity: sha512-XaHr+16KRU9Gf8XLi3q8kDlI18d5vzKSKCY510Vrtc9iNR0NJzbY9hhTmwhzYZj/ZwGL4VmB3TA9hJW0Um2qFA==}
     engines: {node: ^14 || ^16 || >=18}
     peerDependencies:
       '@csstools/css-parser-algorithms': ^2.7.1
       '@csstools/css-tokenizer': ^2.4.1
 
+  '@csstools/media-query-list-parser@5.0.0':
+    resolution: {integrity: sha512-T9lXmZOfnam3eMERPsszjY5NK0jX8RmThmmm99FZ8b7z8yMaFZWKwLWGZuTwdO3ddRY5fy13GmmEYZXB4I98Eg==}
+    engines: {node: '>=20.19.0'}
+    peerDependencies:
+      '@csstools/css-parser-algorithms': ^4.0.0
+      '@csstools/css-tokenizer': ^4.0.0
+
+  '@csstools/selector-resolve-nested@4.0.0':
+    resolution: {integrity: sha512-9vAPxmp+Dx3wQBIUwc1v7Mdisw1kbbaGqXUM8QLTgWg7SoPGYtXBsMXvsFs/0Bn5yoFhcktzxNZGNaUt0VjgjA==}
+    engines: {node: '>=20.19.0'}
+    peerDependencies:
+      postcss-selector-parser: ^7.1.1
+
   '@csstools/selector-specificity@3.1.1':
     resolution: {integrity: sha512-a7cxGcJ2wIlMFLlh8z2ONm+715QkPHiyJcxwQlKOz/03GPw1COpfhcmC9wm4xlZfp//jWHNNMwzjtqHXVWU9KA==}
     engines: {node: ^14 || ^16 || >=18}
     peerDependencies:
       postcss-selector-parser: ^6.0.13
 
+  '@csstools/selector-specificity@6.0.0':
+    resolution: {integrity: sha512-4sSgl78OtOXEX/2d++8A83zHNTgwCJMaR24FvsYL7Uf/VS8HZk9PTwR51elTbGqMuwH3szLvvOXEaVnqn0Z3zA==}
+    engines: {node: '>=20.19.0'}
+    peerDependencies:
+      postcss-selector-parser: ^7.1.1
+
   '@dual-bundle/import-meta-resolve@4.1.0':
     resolution: {integrity: sha512-+nxncfwHM5SgAtrVzgpzJOI1ol0PkumhVo469KCf9lUi21IGcY90G98VuHm9VRrUypmAzawAHO9bs6hqeADaVg==}
 
@@ -3470,9 +3499,9 @@ packages:
     peerDependencies:
       postcss: ^8.1.0
 
-  postcss-custom-media@10.0.2:
-    resolution: {integrity: sha512-zcEFNRmDm2fZvTPdI1pIW3W//UruMcLosmMiCdpQnrCsTRzWlKQPYMa1ud9auL0BmrryKK1+JjIGn19K0UjO/w==}
-    engines: {node: ^14 || ^16 || >=18}
+  postcss-custom-media@12.0.0:
+    resolution: {integrity: sha512-jIgEvqceN6ru2uQ0f75W1g+JDi0UyECFeJKjPG7UcSkW3+03LDKH2c6h+9C0XuDTV4y2pEHmD5AJtVBq1OGnZA==}
+    engines: {node: '>=20.19.0'}
     peerDependencies:
       postcss: ^8.4
 
@@ -3503,9 +3532,9 @@ packages:
       tsx:
         optional: true
 
-  postcss-nesting@12.0.2:
-    resolution: {integrity: sha512-63PpJHSeNs93S3ZUIyi+7kKx4JqOIEJ6QYtG3x+0qA4J03+4n0iwsyA1GAHyWxsHYljQS4/4ZK1o2sMi70b5wQ==}
-    engines: {node: ^14 || ^16 || >=18}
+  postcss-nesting@14.0.0:
+    resolution: {integrity: sha512-YGFOfVrjxYfeGTS5XctP1WCI5hu8Lr9SmntjfRC+iX5hCihEO+QZl9Ra+pkjqkgoVdDKvb2JccpEl
```

---

### Incident Patch 5: `6827b132` (2026-02-01)
**Commit Message**: Ensure loading button with `asChild` renders the correct element (#752)

**File**: `apps/playground/app/test-as-child/page.tsx` (modified, +30/-0)
```diff
@@ -4,6 +4,7 @@ import {
   Avatar,
   Badge,
   Box,
+  Button,
   Card,
   Code,
   Container,
@@ -17,6 +18,8 @@ import {
   TabNav,
   Text,
   Theme,
+  IconButton,
+  Heading,
 } from '@radix-ui/themes';
 import { NextThemeProvider } from '../next-theme-provider';
 import NextLink from 'next/link';
@@ -133,6 +136,33 @@ export default function Test() {
                     <Container asChild>
                       <section>Container as child</section>
                     </Container>
+
+                    <Flex direction="column" gap="2">
+                      <Flex gap="2">
+                        <Button asChild>
+                          <button>Button as child</button>
+                        </Button>
+                        <Button asChild>
+                          <a href="#">Button as child (link)</a>
+                        </Button>
+                      </Flex>
+                      <Flex gap="2">
+                        <Button asChild disabled>
+                          <button>Button as child</button>
+                        </Button>
+                        <Button asChild disabled>
+                          <a href="#">Button as child (link)</a>
+                        </Button>
+                      </Flex>
+                      <Flex gap="2">
+                        <Button asChild loading>
+                          <button>Button as child</button>
+                        </Button>
+                        <Button asChild loading>
+                          <a href="#">Button as child (link)</a>
+                        </Button>
+                      </Flex>
+                    </Flex>
                   </Flex>
                 </Section>
               </Container>
```

**File**: `packages/radix-ui-themes/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 3.3.1
 
 - Expand the prop type for `Select`'s `placeholder` prop to accept any `ReactNode` ([#693](https://github.com/radix-ui/themes/pull/693))
+- Fix broken loading state for `Button` and `IconButton` components using `asChild` ([#752](https://github.com/radix-ui/themes/pull/752))
 - Fix incorrect Firefox vendor prefix for `:placeholder-shown` pseudo-element ([#783](https://github.com/radix-ui/themes/pull/783), https://github.com/postcss/autoprefixer/pull/1532)
 - Improve responsiveness and consistency of styling in `ThemePanel`
 - Fix nested `Container` components not respecting the `size` prop ([#593](https://github.com/radix-ui/themes/pull/593))
```

**File**: `packages/radix-ui-themes/src/components/_internal/base-button.tsx` (modified, +47/-23)
```diff
@@ -1,3 +1,5 @@
+'use client';
+
 import * as React from 'react';
 import classNames from 'classnames';
 import { Slot } from 'radix-ui';
@@ -30,6 +32,25 @@ const BaseButton = React.forwardRef<BaseButtonElement, BaseButtonProps>((props,
     ...baseButtonProps
   } = extractProps(props, baseButtonPropDefs, marginPropDefs);
   const Comp = asChild ? Slot.Root : 'button';
+  let child = children;
+  if (props.loading) {
+    // Loading buttons will wrap the contents of the button for hiding them
+    // visually while retaining the button's size. This does not work with the
+    // Radix Slot since the slot root expects the slottable content to be one of
+    // its direct descendants. To get around this we need to clone the child
+    // with its wrapped inner children.
+    if (asChild && React.isValidElement(children)) {
+      const props = children.props as { children?: React.ReactNode };
+      const childNode = props.children;
+      child = React.cloneElement<any>(children, {
+        ...props,
+        children: renderLoadingButtonContents(childNode, size),
+      });
+    } else {
+      child = renderLoadingButtonContents(children, size);
+    }
+  }
+
   return (
     <Comp
       // The `data-disabled` attribute enables correct styles when doing `<Button asChild disabled>`
@@ -41,33 +62,36 @@ const BaseButton = React.forwardRef<BaseButtonElement, BaseButtonProps>((props,
       className={classNames('rt-reset', 'rt-BaseButton', className)}
       disabled={disabled}
     >
-      {props.loading ? (
-        <>
-          {/**
-           * We need a wrapper to set `visibility: hidden` to hide the button content whilst we show the `Spinner`.
-           * The button is a flex container with a `gap`, so we use `display: contents` to ensure the correct flex layout.
-           *
-           * However, `display: contents` removes the content from the accessibility tree in some browsers,
-           * so we force remove it with `aria-hidden` and re-add it in the tree with `VisuallyHidden`
-           */}
-          <span style={{ display: 'contents', visibility: 'hidden' }} aria-hidden>
-            {children}
-          </span>
-          <VisuallyHidden>{children}</VisuallyHidden>
-
-          <Flex asChild align="center" justify="center" position="absolute" inset="0">
-            <span>
-              <Spinner size={mapResponsiveProp(size, mapButtonSizeToSpinnerSize)} />
-            </span>
-          </Flex>
-        </>
-      ) : (
-        children
-      )}
+      {child}
     </Comp>
   );
 });
 BaseButton.displayName = 'BaseButton';
 
 export { BaseButton };
 export type { BaseButtonProps };
+
+function renderLoadingButtonContents(children: React.ReactNode, size: BaseButtonProps['size']) {
+  return (
+    <>
+      {/*
+       * We need a wrapper to set `visibility: hidden` to hide the button content
+       * whilst we show the `Spinner`. The button is a flex container with a `gap`,
+       * so we use `display: contents` to ensure the correct flex layout.
+       *
+       * However, `display: contents` removes the content from the accessibility
+       * tree in some browsers, so we force remove it with `aria-hidden` and
+       * re-add it in the tree with `VisuallyHidden`
+       */}
+      <span style={{ display: 'contents', visibility: 'hidden' }} aria-hidden>
+        {children}
+      </span>
+      <VisuallyHidden>{children}</VisuallyHidden>
+      <Flex asChild align="center" justify="center" position="absolute" inset="0">
+        <span>
+          <Spinner size={mapResponsiveProp(size, mapButtonSizeToSpinnerSize)} />
+        </span>
+      </Flex>
+    </>
+  );
+}
```

---

### Incident Patch 6: `46776fb1` (2026-01-31)
**Commit Message**: fix: allow nesting sized containers (#593)

before this commit, it was not always possible to correctly nest container components with `size` set - for example, having a smaller container inside of a larger container. in these cases, css precedence meant the smaller size would never be applied.

**File**: `apps/playground/app/sink/page.tsx` (modified, +31/-0)
```diff
@@ -5924,6 +5924,37 @@ export default function Sink() {
                       </Flex>
                     </Flex>
                   </DocsSection>
+
+                  <DocsSection title="Container">
+                    <Text as="p" my="5">
+                      <Code>size</Code> can be set on nested <Code>Container</Code> instances:
+                    </Text>
+
+                    <Container size="4">
+                      <Box
+                        style={{
+                          backgroundColor: 'var(--color-panel-solid)',
+                          borderRadius: 'var(--radius-2)',
+                          boxShadow: 'inset 0 0 0 1px var(--gray-a4)',
+                        }}
+                        p="2"
+                      >
+                        <Text>This should be size 4</Text>
+                      </Box>
+                      <Container size="1">
+                        <Box
+                          style={{
+                            backgroundColor: 'var(--color-panel-solid)',
+                            borderRadius: 'var(--radius-2)',
+                            boxShadow: 'inset 0 0 0 1px var(--gray-a4)',
+                          }}
+                          p="2"
+                        >
+                          <Text>This should be size 1</Text>
+                        </Box>
+                      </Container>
+                    </Container>
+                  </DocsSection>
                 </main>
               </Box>
             </div>
```

**File**: `packages/radix-ui-themes/src/components/container.css` (modified, +4/-4)
```diff
@@ -26,16 +26,16 @@
 
 @breakpoints {
   .rt-ContainerInner {
-    :where(.rt-Container.rt-r-size-1) & {
+    :where(.rt-Container.rt-r-size-1) > & {
       max-width: var(--container-1);
     }
-    :where(.rt-Container.rt-r-size-2) & {
+    :where(.rt-Container.rt-r-size-2) > & {
       max-width: var(--container-2);
     }
-    :where(.rt-Container.rt-r-size-3) & {
+    :where(.rt-Container.rt-r-size-3) > & {
       max-width: var(--container-3);
     }
-    :where(.rt-Container.rt-r-size-4) & {
+    :where(.rt-Container.rt-r-size-4) > & {
       max-width: var(--container-4);
     }
   }
```

---

### Incident Patch 7: `4e3613aa` (2026-01-31)
**Commit Message**: fix theme panel regression

**File**: `packages/radix-ui-themes/src/components/index.tsx` (modified, +6/-1)
```diff
@@ -58,7 +58,12 @@ export * as Tabs from './tabs.js';
 export { TextArea, type TextAreaProps } from './text-area.js';
 export * as TextField from './text-field.js';
 export { Text, type TextProps } from './text.js';
-export { ThemePanel, type ThemePanelProps } from './theme-panel.js';
+export {
+  ThemePanel,
+  type ThemePanelProps,
+  ThemePanelContent as unstable_ThemePanelContent,
+  type ThemePanelContentProps as unstable_ThemePanelContentProps,
+} from './theme-panel.js';
 export { Theme, ThemeContext, type ThemeProps, useThemeContext } from './theme.js';
 export { Tooltip, type TooltipProps } from './tooltip.js';
 export { VisuallyHidden, type VisuallyHiddenProps } from './visually-hidden.js';
```

**File**: `packages/radix-ui-themes/src/components/theme-panel.tsx` (modified, +506/-492)
```diff
@@ -15,7 +15,7 @@ import * as Popover from './popover.js';
 import { ScrollArea } from './scroll-area.js';
 import { Text } from './text.js';
 import { Tooltip } from './tooltip.js';
-import { Theme, useThemeContext } from './theme.js';
+import { Theme, useThemeContext, type ThemeContextValue } from './theme.js';
 import { inert } from '../helpers/inert.js';
 import { getMatchingGrayColor } from '../helpers/get-matching-gray-color.js';
 import { themePropDefs } from './theme.props.js';
@@ -24,29 +24,141 @@ import type { ComponentPropsWithout, RemovedProps } from '../helpers/component-p
 import type { GetPropDefTypes } from '../props/prop-def.js';
 
 interface ThemePanelProps extends Omit<ThemePanelImplProps, keyof ThemePanelImplPrivateProps> {
+  onAppearanceChange?: (value: 'light' | 'dark') => void;
   defaultOpen?: boolean;
 }
+
+const keyboardInputElement = `
+      [contenteditable],
+      [role="combobox"],
+      [role="listbox"],
+      [role="menu"],
+      input:not([type="radio"], [type="checkbox"]),
+      select,
+      textarea
+    `;
+
 const ThemePanel = React.forwardRef<ThemePanelImplElement, ThemePanelProps>(
   ({ defaultOpen = true, ...props }, forwardedRef) => {
     const [open, setOpen] = React.useState(defaultOpen);
-    return <ThemePanelImpl {...props} ref={forwardedRef} open={open} onOpenChange={setOpen} />;
+
+    // quickly show/hide using "T" keypress
+    React.useEffect(() => {
+      function handleKeydown(event: KeyboardEvent) {
+        const isModifierActive = event.altKey || event.ctrlKey || event.shiftKey || event.metaKey;
+        const isKeyboardInputActive = document.activeElement?.closest(keyboardInputElement);
+        const isKeyT = event.key?.toUpperCase() === 'T' && !isModifierActive;
+        if (isKeyT && !isKeyboardInputActive) {
+          setOpen((open) => !open);
+        }
+      }
+      document.addEventListener('keydown', handleKeydown);
+      return () => document.removeEventListener('keydown', handleKeydown);
+    }, []);
+
+    return (
+      <ThemePanelImpl
+        {...props}
+        ref={forwardedRef}
+        open={open}
+        shortcut={
+          <Tooltip content="Press T to show/hide the Theme Panel" side="bottom" sideOffset={6}>
+            <Kbd asChild size="3" tabIndex={0} className="rt-ThemePanelShortcut">
+              <button type="button" onClick={() => setOpen((open) => !open)}>
+                T
+              </button>
+            </Kbd>
+          </Tooltip>
+        }
+      />
+    );
   },
 );
 ThemePanel.displayName = 'ThemePanel';
 
 type ThemePanelImplElement = React.ElementRef<'div'>;
 interface ThemePanelImplPrivateProps {
   open: boolean;
-  onOpenChange: (open: boolean) => void;
+  shortcut: React.ReactNode;
 }
 interface ThemePanelImplProps
   extends ComponentPropsWithout<'div', RemovedProps>, ThemePanelImplPrivateProps {
   onAppearanceChange?: (value: 'light' | 'dark') => void;
 }
 const ThemePanelImpl = React.forwardRef<ThemePanelImplElement, ThemePanelImplProps>(
   (props, forwardedRef) => {
-    const { open, onOpenChange, onAppearanceChange: onAppearanceChangeProp, ...panelProps } = props;
+    const { open, onAppearanceChange, shortcut, ...panelProps } = props;
     const themeContext = useThemeContext();
+    return (
+      <Theme asChild radius="medium" scaling="100%">
+        <Flex
+          direction="column"
+          position="fixed"
+          top="0"
+          right="0"
+          mr={{ initial: '2', sm: '4' }}
+          mt={{ initial: '2', sm: '4' }}
+          width={{ initial: '360px' }}
+          maxHeight={{
+            initial: 'calc(100svh - var(--space-2) - var(--space-2))',
+            sm: 'calc(100svh - var(--space-4) - var(--space-4))',
+          }}
+          maxWidth={{
+            initial: 'calc(100svw - var(--space-2) - var(--space-2))',
+            sm: 'calc(100svw - var(--space-4) - var(--space-4))',
+          }}
+          inert={open ? undefined : inert}
+          {...panelProps}
+          ref={forwardedRef}
+          style={{
+            zIndex: 999999999,
+            overflow: 'hidden',
+            borderRadius: 'var(--radius-4)',
+            backgroundColor: 'var(--color-panel-solid)',
+            transformOrigin: 'top center',
+            transitionProperty: 'transform, box-shadow',
+            transitionDuration: '200ms',
+            transitionTimingFunction: open ? 'ease-out' : 'ease-in',
+            transform: open ? 'none' : 'translateX(105%)',
+            boxShadow: open ? 'var(--shadow-5)' : 'var(--shadow-2)',
+            ...props.style,
+          }}
+        >
+          <ScrollArea>
+            <Box flexGrow="1" p={{ initial: '4', xs: '5' }} position="relative">
+              {!!shortcut && (
+                <Box position="absolute" top="0" right="0" m="2">
+                  {shortcut}
+                </Box>
+              )}
+              <ThemePanelContent onAppearanceChange={onAppearanceChange} context={themeContext} />
+   
```

**File**: `packages/radix-ui-themes/src/components/theme.tsx` (modified, +1/-1)
```diff
@@ -218,4 +218,4 @@ const ThemeImpl = React.forwardRef<ThemeImplElement, ThemeImplProps>((props, for
 ThemeImpl.displayName = 'ThemeImpl';
 
 export { Theme, ThemeContext, useThemeContext };
-export type { ThemeProps };
+export type { ThemeProps, ThemeContextValue };
```

---

### Incident Patch 8: `6ff0b368` (2026-01-31)
**Commit Message**: Fix inert helper typing

**File**: `packages/radix-ui-themes/src/components/skeleton.tsx` (modified, +0/-1)
```diff
@@ -33,7 +33,6 @@ const Skeleton = React.forwardRef<SkeletonElement, SkeletonProps>((props, forwar
       className={classNames('rt-Skeleton', className)}
       data-inline-skeleton={React.isValidElement(children) ? undefined : true}
       tabIndex={-1}
-      // @ts-expect-error
       inert={inert}
       {...skeletonProps}
     >
```

**File**: `packages/radix-ui-themes/src/helpers/inert.ts` (modified, +2/-1)
```diff
@@ -2,4 +2,5 @@ import * as React from 'react';
 
 // "inert" works differently between React versions
 // https://github.com/facebook/react/pull/24730
-export const inert = parseFloat(React.version) >= 19 || '';
+export const inert = (Number.parseFloat(React.version) >= 19 ||
+  '') as React.HTMLAttributes<unknown>['inert'];
```

---

### Incident Patch 9: `98628b5e` (2026-01-31)
**Commit Message**: Update autoprefixer to fix incorrect FF prefix (#783)

**File**: `packages/radix-ui-themes/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 3.3.1
 
 - Expand the prop type for `Select`'s `placeholder` prop to accept any `ReactNode` ([#693](https://github.com/radix-ui/themes/pull/693))
+- Fix incorrect Firefox vendor prefix for `:placeholder-shown` pseudo-element ([#783](https://github.com/radix-ui/themes/pull/783), https://github.com/postcss/autoprefixer/pull/1532)
 
 ## 3.3.0
 
```

**File**: `packages/radix-ui-themes/package.json` (modified, +5/-5)
```diff
@@ -124,19 +124,19 @@
     "@eslint/js": "^9.39.2",
     "@types/react": "^19.2.10",
     "@types/react-dom": "^19.2.3",
-    "autoprefixer": "10.4.19",
+    "autoprefixer": "10.4.24",
     "esbuild": "0.20.0",
     "eslint": "^9.39.2",
     "eslint-plugin-jsx-a11y": "^6.10.2",
     "eslint-plugin-react": "^7.37.5",
     "eslint-plugin-react-hooks": "^7.0.1",
     "globals": "^17.2.0",
-    "postcss": "8.4.33",
-    "postcss-cli": "11.0.0",
+    "postcss": "8.5.6",
+    "postcss-cli": "11.0.1",
     "postcss-combine-duplicated-selectors": "10.0.3",
     "postcss-custom-media": "10.0.2",
-    "postcss-discard-empty": "6.0.1",
-    "postcss-import": "16.0.0",
+    "postcss-discard-empty": "7.0.1",
+    "postcss-import": "16.1.1",
     "postcss-nesting": "12.0.2",
     "react": "^19.2.4",
     "react-dom": "^19.2.4",
```

**File**: `pnpm-lock.yaml` (modified, +110/-118)
```diff
@@ -92,8 +92,8 @@ importers:
         specifier: ^19.2.3
         version: 19.2.3(@types/react@19.2.10)
       autoprefixer:
-        specifier: 10.4.19
-        version: 10.4.19(postcss@8.4.33)
+        specifier: 10.4.24
+        version: 10.4.24(postcss@8.5.6)
       esbuild:
         specifier: 0.20.0
         version: 0.20.0
@@ -113,26 +113,26 @@ importers:
         specifier: ^17.2.0
         version: 17.2.0
       postcss:
-        specifier: 8.4.33
-        version: 8.4.33
+        specifier: 8.5.6
+        version: 8.5.6
       postcss-cli:
-        specifier: 11.0.0
-        version: 11.0.0(postcss@8.4.33)
+        specifier: 11.0.1
+        version: 11.0.1(postcss@8.5.6)
       postcss-combine-duplicated-selectors:
         specifier: 10.0.3
-        version: 10.0.3(postcss@8.4.33)
+        version: 10.0.3(postcss@8.5.6)
       postcss-custom-media:
         specifier: 10.0.2
-        version: 10.0.2(postcss@8.4.33)
+        version: 10.0.2(postcss@8.5.6)
       postcss-discard-empty:
-        specifier: 6.0.1
-        version: 6.0.1(postcss@8.4.33)
+        specifier: 7.0.1
+        version: 7.0.1(postcss@8.5.6)
       postcss-import:
-        specifier: 16.0.0
-        version: 16.0.0(postcss@8.4.33)
+        specifier: 16.1.1
+        version: 16.1.1(postcss@8.5.6)
       postcss-nesting:
         specifier: 12.0.2
-        version: 12.0.2(postcss@8.4.33)
+        version: 12.0.2(postcss@8.5.6)
       react:
         specifier: ^19.2.4
         version: 19.2.4
@@ -1366,10 +1366,6 @@ packages:
   '@rtsao/scc@1.1.0':
     resolution: {integrity: sha512-zt6OdqaDoOnJ1ZYsCYGt9YmWzDXl4vQdKTyJev62gFhRGKdx7mcT54V9KIjg+d2wi9EXsPvAPKe7i7WjfVWB8g==}
 
-  '@sindresorhus/merge-streams@2.3.0':
-    resolution: {integrity: sha512-LtoMMhxAlorcGhmFYI+LhPgbPZCkgP6ra1YL604EeF6U98pLlQ3iWIGMdWSC+vWmPBWBNgmDBAhnAobLROJmwg==}
-    engines: {node: '>=18'}
-
   '@swc/helpers@0.5.15':
     resolution: {integrity: sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==}
 
@@ -1650,8 +1646,8 @@ packages:
     resolution: {integrity: sha512-hsU18Ae8CDTR6Kgu9DYf0EbCr/a5iGL0rytQDobUcdpYOKokk8LEjVphnXkDkgpi0wYVsqrXuP0bZxJaTqdgoA==}
     engines: {node: '>= 0.4'}
 
-  autoprefixer@10.4.19:
-    resolution: {integrity: sha512-BaENR2+zBZ8xXhM4pUaKUxlVdxZ0EZhjvbopwnXmxRUfqDmwSpC2lAi/QXvx7NRdPCo1WKEcEF6mV64si1z4Ew==}
+  autoprefixer@10.4.24:
+    resolution: {integrity: sha512-uHZg7N9ULTVbutaIsDRoUkoS8/h3bdsmVJYZ5l3wv8Cp/6UIIoRDm90hZ+BwxUj/hGBEzLxdHNSKuFpn8WOyZw==}
     engines: {node: ^10 || ^12 || >=14}
     hasBin: true
     peerDependencies:
@@ -1698,6 +1694,11 @@ packages:
     engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
     hasBin: true
 
+  browserslist@4.28.1:
+    resolution: {integrity: sha512-ZC5Bd0LgJXgwGqUknZY/vkUQ04r8NXnJZ3yYi4vDmSiZmC/pdSN0NbNRPxZpbtO4uAfDUAFffO8IZoM3Gj8IkA==}
+    engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
+    hasBin: true
+
   call-bind-apply-helpers@1.0.1:
     resolution: {integrity: sha512-BhYE+WDaywFg2TBWYNXAE+8B1ATnThNBqXHP5nQu0jWJdVvY2hvkpyB3qOmtmDePiS5/BDQ8wASEWGMWRG148g==}
     engines: {node: '>= 0.4'}
@@ -1725,6 +1726,9 @@ packages:
   caniuse-lite@1.0.30001695:
     resolution: {integrity: sha512-vHyLade6wTgI2u1ec3WQBxv+2BrTERV28UXQu9LO6lZ9pYeMk34vjXFLOxo1A4UBA8XTL4njRQZdno/yYaSmWw==}
 
+  caniuse-lite@1.0.30001766:
+    resolution: {integrity: sha512-4C0lfJ0/YPjJQHagaE9x2Elb69CIqEPZeG0anQt9SIvIoOH4a4uaRl73IavyO+0qZh6MDLH//DrXThEYKHkmYA==}
+
   chalk@4.1.2:
     resolution: {integrity: sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==}
     engines: {node: '>=10'}
@@ -1853,9 +1857,9 @@ packages:
     resolution: {integrity: sha512-8QmQKqEASLd5nx0U1B1okLElbUuuttJ/AnYmRXbbbGDWh6uS208EjD4Xqq/I9wK7u0v6O08XhTWnt5XtEbR6Dg==}
     engines: {node: '>= 0.4'}
 
-  dependency-graph@0.11.0:
-    resolution: {integrity: sha512-JeMq7fEshyepOWDfcfHK06N3MhyPhz++vtqWhMT5O9A3K42rdsEDpfdVqjaqaAhsw6a+ZqeDvQVtD0hFHQWrzg==}
-    engines: {node: '>= 0.6.0'}
+  dependency-graph@1.0.0:
+    resolution: {integrity: sha512-cW3gggJ28HZ/LExwxP2B++aiKxhJXMSIt9K48FOXQkm+vuG5gyatXnLsONRJdzO/7VfjDIiaOOa/bs4l464Lwg==}
+    engines: {node: '>=4'}
 
   detect-libc@2.1.2:
     resolution: {integrity: sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==}
@@ -1876,6 +1880,9 @@ packages:
     resolution: {integrity: sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==}
     engines: {node: '>= 0.4'}
 
+  electron-to-chromium@1.5.283:
+    resolution: {integrity: sha512-3vifjt1HgrGW/h76UEeny+adYApveS9dH2h3p57JYzBSXJIKUJAvtmIytDKjcSCt9xHfrNCFJ7gts6vkhuq++w==}
+
   electron-to-chromium@1.5.86:
     resolution: {integrity: sha512-/D7GAAaCRBQFBBcop6SfAAGH37djtpWkOuYhyAajw0l5vsfeSsUQYxaFPwr1c/mC/flARCDdKFo5gpFqNI+18w==}
 
@@ -2145,8 +2152,8 @@ packages:
     resolution: {integrity: sha512-dKx12eRCVIzqCxFGplyFK
```

---

### Incident Patch 10: `89c40982` (2026-01-31)
**Commit Message**: fix: animation properties not vendor prefixed (#716)

**File**: `packages/radix-ui-themes/.browserslistrc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-last 2 years
+last 2 years, last 2 versions
```

---

### Incident Patch 11: `6ff886b2` (2025-05-05)
**Commit Message**: Revert "Prevent RadioCard chop when zooming browser out (#710)"

This reverts commit 06edc27518325ad5c626724574dd5eae87b84487.

**File**: `packages/radix-ui-themes/src/components/radio-cards.css` (modified, +0/-2)
```diff
@@ -18,8 +18,6 @@
   align-items: center;
   justify-content: center;
   gap: var(--space-2);
-  contain: layout;
-  overflow: visible;
 
   & > * {
     /* Avoid unintentional drag interactions (e.g. on images) */
```

---

### Incident Patch 12: `8be09f55` (2025-01-25)
**Commit Message**: revert publishConfig exports overrides

**File**: `packages/radix-ui-themes/package.json` (modified, +39/-59)
```diff
@@ -2,79 +2,59 @@
   "name": "@radix-ui/themes",
   "version": "3.2.0",
   "type": "commonjs",
-  "main": "./src/index.ts",
-  "types": "./src/index.ts",
-  "module": "./src/index.ts",
+  "main": "./dist/cjs/index.js",
+  "types": "./dist/cjs/index.d.ts",
+  "module": "./dist/esm/index.js",
   "style": "./styles.css",
   "exports": {
     ".": {
-      "require": "./src/index.ts",
-      "import": "./src/index.ts"
+      "require": {
+        "types": "./dist/cjs/index.d.ts",
+        "default": "./dist/cjs/index.js"
+      },
+      "import": {
+        "types": "./dist/esm/index.d.ts",
+        "default": "./dist/esm/index.js"
+      }
     },
     "./components/*": {
-      "require": "./src/components/*.tsx",
-      "import": "./src/components/*.tsx"
+      "require": {
+        "types": "./dist/cjs/components/*.d.ts",
+        "default": "./dist/cjs/components/*.js"
+      },
+      "import": {
+        "types": "./dist/esm/components/*.d.ts",
+        "default": "./dist/esm/components/*.js"
+      }
     },
     "./helpers": {
-      "require": "./src/helpers/index.ts",
-      "import": "./src/helpers/index.ts"
+      "require": {
+        "types": "./dist/cjs/helpers/index.d.ts",
+        "default": "./dist/cjs/helpers/index.js"
+      },
+      "import": {
+        "types": "./dist/esm/helpers/index.d.ts",
+        "default": "./dist/esm/helpers/index.js"
+      }
     },
     "./props": {
-      "require": "./src/props/index.ts",
-      "import": "./src/props/index.ts"
+      "require": {
+        "types": "./dist/cjs/props/index.d.ts",
+        "default": "./dist/cjs/props/index.js"
+      },
+      "import": {
+        "types": "./dist/esm/props/index.d.ts",
+        "default": "./dist/esm/props/index.js"
+      }
     },
     "./*": "./*"
   },
   "publishConfig": {
-    "access": "public",
-    "main": "./dist/cjs/index.js",
-    "types": "./dist/cjs/index.d.ts",
-    "module": "./dist/esm/index.js",
-    "exports": {
-      ".": {
-        "require": {
-          "types": "./dist/cjs/index.d.ts",
-          "default": "./dist/cjs/index.js"
-        },
-        "import": {
-          "types": "./dist/esm/index.d.ts",
-          "default": "./dist/esm/index.js"
-        }
-      },
-      "./components/*": {
-        "require": {
-          "types": "./dist/cjs/components/*.d.ts",
-          "default": "./dist/cjs/components/*.js"
-        },
-        "import": {
-          "types": "./dist/esm/components/*.d.ts",
-          "default": "./dist/esm/components/*.js"
-        }
-      },
-      "./helpers": {
-        "require": {
-          "types": "./dist/cjs/helpers/index.d.ts",
-          "default": "./dist/cjs/helpers/index.js"
-        },
-        "import": {
-          "types": "./dist/esm/helpers/index.d.ts",
-          "default": "./dist/esm/helpers/index.js"
-        }
-      },
-      "./props": {
-        "require": {
-          "types": "./dist/cjs/props/index.d.ts",
-          "default": "./dist/cjs/props/index.js"
-        },
-        "import": {
-          "types": "./dist/esm/props/index.d.ts",
-          "default": "./dist/esm/props/index.js"
-        }
-      },
-      "./*": "./*"
-    }
+    "access": "public"
   },
-  "sideEffects": ["*.css"],
+  "sideEffects": [
+    "*.css"
+  ],
   "license": "MIT",
   "files": [
     "src/**",
```

**File**: `packages/radix-ui-themes/tsconfig.json` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
     "lib": ["DOM", "ESNext", "DOM.Iterable"],
     "jsx": "react",
     "declaration": true,
+    "declarationMap": true,
     "emitDeclarationOnly": true,
     "outDir": "dist",
     "strict": true,
```

---

### Incident Patch 13: `a3bf592f` (2025-01-24)
**Commit Message**: fix `sideEffects` declaration (#659)

**File**: `packages/radix-ui-themes/esbuild-esm.mjs` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 import esbuild from 'esbuild';
 import fs from 'fs';
 import path from 'path';
+import pkg from './package.json' with { type: 'json' };
 
 const dir = 'dist/esm';
 
@@ -30,6 +31,6 @@ if (!fs.existsSync(dir)) {
 }
 fs.writeFileSync(
   path.join(dir, 'package.json'),
-  JSON.stringify({ type: 'module' }, null, 2) + '\n',
+  JSON.stringify({ type: 'module', sideEffects: pkg.sideEffects }, null, 2) + '\n',
   'utf-8'
 );
```

**File**: `packages/radix-ui-themes/package.json` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@
       "./*": "./*"
     }
   },
-  "sideEffects": false,
+  "sideEffects": ["*.css"],
   "license": "MIT",
   "files": [
     "src/**",
```

---

### Incident Patch 14: `b4515d7e` (2025-01-23)
**Commit Message**: fix imports

**File**: `packages/radix-ui-themes/src/components/radio.tsx` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@
 
 import * as React from 'react';
 import classNames from 'classnames';
-import { composeEventHandlers } from '@radix-ui/primitive';
-import { composeRefs } from 'radix-ui/internal';
+import { composeEventHandlers, composeRefs } from 'radix-ui/internal';
 
 import { radioPropDefs } from './radio.props';
 import { marginPropDefs } from '../props/margin.props';
```

---

### Incident Patch 15: `b8fa908a` (2025-01-23)
**Commit Message**: Update all imports from `radix-ui` package

**File**: `packages/radix-ui-themes/src/components/_internal/base-button.props.ts` (modified, +5/-5)
```diff
@@ -1,9 +1,9 @@
-import { asChildPropDef } from '../../props/as-child.prop.js';
-import { accentColorPropDef } from '../../props/color.prop.js';
-import { highContrastPropDef } from '../../props/high-contrast.prop.js';
-import { radiusPropDef } from '../../props/radius.prop.js';
+import { asChildPropDef } from '../../props/as-child.prop';
+import { accentColorPropDef } from '../../props/color.prop';
+import { highContrastPropDef } from '../../props/high-contrast.prop';
+import { radiusPropDef } from '../../props/radius.prop';
 
-import type { PropDef } from '../../props/prop-def.js';
+import type { PropDef } from '../../props/prop-def';
 
 const sizes = ['1', '2', '3', '4'] as const;
 const variants = ['classic', 'solid', 'soft', 'surface', 'outline', 'ghost'] as const;
```

**File**: `packages/radix-ui-themes/src/components/_internal/base-button.tsx` (modified, +12/-12)
```diff
@@ -1,18 +1,18 @@
 import * as React from 'react';
 import classNames from 'classnames';
-import { Slot } from '@radix-ui/react-slot';
+import { Slot } from 'radix-ui';
 
-import { baseButtonPropDefs } from './base-button.props.js';
-import { Flex } from '../flex.js';
-import { Spinner } from '../spinner.js';
-import { VisuallyHidden } from '../visually-hidden.js';
-import { extractProps } from '../../helpers/extract-props.js';
-import { mapResponsiveProp, mapButtonSizeToSpinnerSize } from '../../helpers/map-prop-values.js';
-import { marginPropDefs } from '../../props/margin.props.js';
+import { baseButtonPropDefs } from './base-button.props';
+import { Flex } from '../flex';
+import { Spinner } from '../spinner';
+import { VisuallyHidden } from '../visually-hidden';
+import { extractProps } from '../../helpers/extract-props';
+import { mapResponsiveProp, mapButtonSizeToSpinnerSize } from '../../helpers/map-prop-values';
+import { marginPropDefs } from '../../props/margin.props';
 
-import type { MarginProps } from '../../props/margin.props.js';
-import type { ComponentPropsWithout, RemovedProps } from '../../helpers/component-props.js';
-import type { GetPropDefTypes } from '../../props/prop-def.js';
+import type { MarginProps } from '../../props/margin.props';
+import type { ComponentPropsWithout, RemovedProps } from '../../helpers/component-props';
+import type { GetPropDefTypes } from '../../props/prop-def';
 
 type BaseButtonElement = React.ElementRef<'button'>;
 type BaseButtonOwnProps = GetPropDefTypes<typeof baseButtonPropDefs>;
@@ -31,7 +31,7 @@ const BaseButton = React.forwardRef<BaseButtonElement, BaseButtonProps>((props,
     disabled = props.loading,
     ...baseButtonProps
   } = extractProps(props, baseButtonPropDefs, marginPropDefs);
-  const Comp = asChild ? Slot : 'button';
+  const Comp = asChild ? Slot.Root : 'button';
   return (
     <Comp
       // The `data-disabled` attribute enables correct styles when doing `<Button asChild disabled>`
```

**File**: `packages/radix-ui-themes/src/components/_internal/base-checkbox.props.ts` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
-import { colorPropDef } from '../../props/color.prop.js';
-import { highContrastPropDef } from '../../props/high-contrast.prop.js';
+import { colorPropDef } from '../../props/color.prop';
+import { highContrastPropDef } from '../../props/high-contrast.prop';
 
-import type { PropDef } from '../../props/prop-def.js';
+import type { PropDef } from '../../props/prop-def';
 
 const sizes = ['1', '2', '3'] as const;
 const variants = ['classic', 'surface', 'soft'] as const;
```

**File**: `packages/radix-ui-themes/src/components/_internal/base-menu.props.ts` (modified, +4/-4)
```diff
@@ -1,8 +1,8 @@
-import { asChildPropDef } from '../../props/as-child.prop.js';
-import { colorPropDef } from '../../props/color.prop.js';
-import { highContrastPropDef } from '../../props/high-contrast.prop.js';
+import { asChildPropDef } from '../../props/as-child.prop';
+import { colorPropDef } from '../../props/color.prop';
+import { highContrastPropDef } from '../../props/high-contrast.prop';
 
-import type { PropDef } from '../../props/prop-def.js';
+import type { PropDef } from '../../props/prop-def';
 
 const contentSizes = ['1', '2'] as const;
 const contentVariants = ['solid', 'soft'] as const;
```

**File**: `packages/radix-ui-themes/src/components/_internal/base-radio.props.ts` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
-import { colorPropDef } from '../../props/color.prop.js';
-import { highContrastPropDef } from '../../props/high-contrast.prop.js';
+import { colorPropDef } from '../../props/color.prop';
+import { highContrastPropDef } from '../../props/high-contrast.prop';
 
-import type { PropDef } from '../../props/prop-def.js';
+import type { PropDef } from '../../props/prop-def';
 
 const sizes = ['1', '2', '3'] as const;
 const variants = ['classic', 'surface', 'soft'] as const;
```

**File**: `packages/radix-ui-themes/src/components/_internal/base-tab-list.props.ts` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
-import { colorPropDef } from '../../props/color.prop.js';
-import { highContrastPropDef } from '../../props/high-contrast.prop.js';
+import { colorPropDef } from '../../props/color.prop';
+import { highContrastPropDef } from '../../props/high-contrast.prop';
 
-import type { PropDef } from '../../props/prop-def.js';
+import type { PropDef } from '../../props/prop-def';
 
 const sizes = ['1', '2'] as const;
 const wrapValues = ['nowrap', 'wrap', 'wrap-reverse'] as const;
```

**File**: `packages/radix-ui-themes/src/components/accessible-icon.tsx` (modified, +2/-1)
```diff
@@ -1 +1,2 @@
-export { AccessibleIcon } from '@radix-ui/react-accessible-icon';
+import { AccessibleIcon as AccessibleIconPrimitive } from 'radix-ui';
+export const AccessibleIcon = AccessibleIconPrimitive.Root;
```

**File**: `packages/radix-ui-themes/src/components/alert-dialog.props.ts` (modified, +2/-2)
```diff
@@ -1,2 +1,2 @@
-export { dialogContentPropDefs as alertDialogContentPropDefs } from './dialog.props.js';
-export type { DialogContentOwnProps as AlertDialogContentOwnProps } from './dialog.props.js';
+export { dialogContentPropDefs as alertDialogContentPropDefs } from './dialog.props';
+export type { DialogContentOwnProps as AlertDialogContentOwnProps } from './dialog.props';
```

#### Recent Merged Pull Requests:
- **PR #818** (closed): Fix readOnly TextField and TextArea looking disabled (#764) (@cpruijsen)
- **PR #817** (closed): Prevent Checkbox from submitting forms when given a type prop (#711) (@cpruijsen)
- **PR #816** (closed): Fix ScrollArea ignoring the dir prop (@cpruijsen)
- **PR #800** (closed): Update README.md (@studiowild)
- **PR #794** (2026-02-03): Add `ghost-offset` variants (@chaance)
- **PR #793** (2026-02-03): Add `select` page back to VR tests (@chaance)
- **PR #792** (2026-02-03): Use ESM for next.config (@chaance)
- **PR #791** (2026-02-03): Run tests against prod build of Next (@chaance)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
