# Forensic Learning Record (Deep Inspection): mantinedev/mantine

> **Canonical Artifact**: `07_PROJECT_LEARNING/mantinedev-mantine-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mantinedev/mantine](https://github.com/mantinedev/mantine))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:26:22.943Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mantinedev/mantine`
- **Description**: A fully featured React components library
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 31804 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/mantine.dev/src/combobox-examples/examples/MultiSelectValueRenderer/CountryPill.tsx`
```
import { CloseButton } from '@mantine/core';
import { countriesData, flags } from './countries-data';
import classes from './CountryPill.module.css';

interface CountryPillProps extends React.ComponentProps<'div'> {
  value: string;
  onRemove?: () => void;
}

export function CountryPill({ value, onRemove, ...others }: CountryPillProps) {
  const OptionFlag = flags[value];
  const country = countriesData.find((item) => item.value === value);

  return (
    <div className={classes.pill} {...others}>
      <div className={classes.flag}>
        <OptionFlag />
      </div>
      <div className={classes.label}>{country?.label}</div>
      <CloseButton
        onMouseDown={onRemove}
        variant="transparent"
        color="gray"
        size={22}
        iconSize={14}
        tabIndex={-1}
      />
    </div>
  );
}

```

### Core Architecture Module: `apps/mantine.dev/src/combobox-examples/examples/MultiSelectValueRenderer/MultiSelectValueRenderer.tsx`
```
import { useState } from 'react';
import { CheckIcon, Combobox, Group, Input, Pill, PillsInput, useCombobox } from '@mantine/core';
import { countriesData, flags } from './countries-data';
import { CountryPill } from './CountryPill';

export function MultiSelectValueRenderer() {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
  });

  const [value, setValue] = useState<string[]>([]);

  const handleValueSelect = (val: string) =>
    setValue((current) =>
      current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
    );

  const handleValueRemove = (val: string) =>
    setValue((current) => current.filter((v) => v !== val));

  const values = value.map((item) => (
    <CountryPill key={item} value={item} onRemove={() => handleValueRemove(item)}>
      {item}
    </CountryPill>
  ));

  const options = countriesData.map((item) => {
    const OptionFlag = flags[item.value];
    return (
      <Combobox.Option value={item.value} key={item.value} active={value.includes(item.value)}>
        <Group gap="sm">
          {value.includes(item.value) ? <CheckIcon size={12} /> : null}
          <Group gap={7}>
            <OptionFlag />
            <span>{item.label}</span>
          </Group>
        </Group>
      </Combobox.Option>
    );
  });

  return (
    <Combobox store={combobox} onOptionSubmit={handleValueSelect} withinPortal={false}>
      <Combobox.DropdownTarget>
        <PillsInput pointer onClick={() => combobox.toggleDropdown()}>
          <Pill.Group>
            {values.length > 0 ? (
              values
            ) : (
              <Input.Placeholder>Pick one or more values</Input.Placeholder>
            )}

            <Combobox.EventsTarget>
              <PillsInput.Field
                type="hidden"
                onBlur={() => combobox.closeDropdown()}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' && value.length > 0) {
                    event.preventDefault();
                    handleValueRemove(value[value.length - 1]);
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>{options}</Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

```

### Core Architecture Module: `apps/mantine.dev/src/combobox-examples/examples/MultiSelectValueRenderer/countries-data.tsx`
```
const flagProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 640 480',
  style: { display: 'block', width: 16 },
};

function UsFlag() {
  return (
    <svg {...flagProps}>
      <defs>
        <clipPath id="us-flag">
          <path fillOpacity=".7" d="M0 0h682.7v512H0z" />
        </clipPath>
      </defs>
      <g fillRule="evenodd" clipPath="url(#us-flag)" transform="scale(.9375)">
        <g strokeWidth="1pt">
          <path
            fill="#bd3d44"
            d="M0 0h972.8v39.4H0zm0 78.8h972.8v39.4H0zm0 78.7h972.8V197H0zm0 78.8h972.8v39.4H0zm0 78.8h972.8v39.4H0zm0 78.7h972.8v39.4H0zm0 78.8h972.8V512H0z"
          />
          <path
            fill="#fff"
            d="M0 39.4h972.8v39.4H0zm0 78.8h972.8v39.3H0zm0 78.7h972.8v39.4H0zm0 78.8h972.8v39.4H0zm0 78.8h972.8v39.4H0zm0 78.7h972.8v39.4H0z"
          />
        </g>
        <path fill="#192f5d" d="M0 0h389.1v275.7H0z" />
        <path
          fill="#fff"
          d="M32.4 11.8L36 22.7h11.4l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.3-6.7H29zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7h11.4zm64.8 0l3.6 10.9H177l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.3-6.7h11.5zm64.9 0l3.5 10.9H242l-9.3 6.7 3.6 11-9.3-6.8-9.3 6.7 3.6-10.9-9.3-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.2-6.7h11.4zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.6 11-9.3-6.8-9.3 6.7 3.6-10.9-9.3-6.7h11.5zM64.9 39.4l3.5 10.9h11.5L70.6 57 74 67.9l-9-6.7-9.3 6.7L59 57l-9-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.3 6.7 3.6 10.9-9.3-6.7-9.3 6.7L124 57l-9.3-6.7h11.5zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 10.9-9.2-6.7-9.3 6.7 3.5-10.9-9.2-6.7H191zm64.8 0l3.6 10.9h11.4l-9.3 6.7 3.6 10.9-9.3-6.7-9.2 6.7 3.5-10.9-9.3-6.7H256zm64.9 0l3.5 10.9h11.5L330 57l3.5 10.9-9.2-6.7-9.3 6.7 3.5-10.9-9.2-6.7h11.4zM32.4 66.9L36 78h11.4l-9.2 6.7 3.5 10.9-9.3-6.8-9.2 6.8 3.5-11-9.3-6.7H29zm64.9 0l3.5 11h11.5l-9.3 6.7 3.5 10.9-9.2-6.8-9.3 6.8 3.5-11-9.2-6.7h11.4zm64.8 0l3.6 11H177l-9.2 6.7 3.5 10.9-9.3-6.8-9.2 6.8 3.5-11-9.3-6.7h11.5zm64.9 0l3.5 11H242l-9.3 6.7 3.6 10.9-9.3-6.8-9.3 6.8 3.6-11-9.3-6.7h11.4zm64.8 0l3.6 11h11.4l-9.2 6.7 3.5 10.9-9.3-6.8-9.2 6.8 3.5-11-9.2-6.7h11.4zm64.9 0l3.5 11h11.5l-9.3 6.7 3.6 10.9-9.3-6.8-9.3 6.8 3.6-11-9.3-6.7h11.5zM64.9 94.5l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.3 6.7 3.6 11-9.3-6.8-9.3 6.7 3.6-10.9-9.3-6.7h11.5zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7H191zm64.8 0l3.6 10.9h11.4l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.3-6.7H256zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7h11.4zM32.4 122.1L36 133h11.4l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.3-6.7H29zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 10.9-9.2-6.7-9.3 6.7 3.5-10.9-9.2-6.7h11.4zm64.8 0l3.6 10.9H177l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.3-6.7h11.5zm64.9 0l3.5 10.9H242l-9.3 6.7 3.6 11-9.3-6.8-9.3 6.7 3.6-10.9-9.3-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.2-6.7h11.4zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.6 11-9.3-6.8-9.3 6.7 3.6-10.9-9.3-6.7h11.5zM64.9 149.7l3.5 10.9h11.5l-9.3 6.7 3.5 10.9-9.2-6.8-9.3 6.8 3.5-11-9.2-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.3 6.7 3.6 10.9-9.3-6.8-9.3 6.8 3.6-11-9.3-6.7h11.5zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 10.9-9.2-6.8-9.3 6.8 3.5-11-9.2-6.7H191zm64.8 0l3.6 10.9h11.4l-9.2 6.7 3.5 10.9-9.3-6.8-9.2 6.8 3.5-11-9.3-6.7H256zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 10.9-9.2-6.8-9.3 6.8 3.5-11-9.2-6.7h11.4zM32.4 177.2l3.6 11h11.4l-9.2 6.7 3.5 10.8-9.3-6.7-9.2 6.7 3.5-10.9-9.3-6.7H29zm64.9 0l3.5 11h11.5l-9.3 6.7 3.6 10.8-9.3-6.7-9.3 6.7 3.6-10.9-9.3-6.7h11.4zm64.8 0l3.6 11H177l-9.2 6.7 3.5 10.8-9.3-6.7-9.2 6.7 3.5-10.9-9.3-6.7h11.5zm64.9 0l3.5 11H242l-9.3 6.7 3.6 10.8-9.3-6.7-9.3 6.7 3.6-10.9-9.3-6.7h11.4zm64.8 0l3.6 11h11.4l-9.2 6.7 3.5 10.8-9.3-6.7-9.2 6.7 3.5-10.9-9.2-6.7h11.4zm64.9 0l3.5 11h11.5l-9.3 6.7 3.6 10.8-9.3-6.7-9.3 6.7 3.6-10.9-9.3-6.7h11.5zM64.9 204.8l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.3 6.7 3.6 11-9.3-6.8-9.3 6.7 3.6-10.9-9.3-6.7h11.5zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7H191zm64.8 0l3.6 10.9h11.4l-9.2 6.7 3.5 11-9.3-6.8-9.2 6.7 3.5-10.9-9.3-6.7H256zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.5 11-9.2-6.8-9.3 6.7 3.5-10.9-9.2-6.7h11.4zM32.4 232.4l3.6 10.9h11.4l-9.2 6.7 3.5 10.9-9.3-6.7-9.2 6.7 3.5-11-9.3-6.7H29zm64.9 0l3.5 10.9h11.5L103 250l3.6 10.9-9.3-6.7-9.3 6.7 3.6-11-9.3-6.7h11.4zm64.8 0l3.6 10.9H177l-9 6.7 3.5 10.9-9.3-6.7-9.2 6.7 3.5-11-9.3-6.7h11.5zm64.9 0l3.5 10.9H242l-9.3 6.7 3.6 10.9-9.3-6.7-9.3 6.7 3.6-11-9.3-6.7h11.4zm64.8 0l3.6 10.9h11.4l-9.2 6.7 3.5 10.9-9.3-6.7-9.2 6.7 3.5-11-9.2-6.7h11.4zm64.9 0l3.5 10.9h11.5l-9.3 6.7 3.6 10.9-9.3-6.7-9.3 6.7 3.6-11-9.3-6.7h11.5z"
        />
      </g>
    </svg>
  );
}

function GbFlag() {
  return (
    <svg {...flagProps}>
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#FFF"
        d="M75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"
      />
      <path
        fill="#C8102E"
        d="M424 281l216 159v40L369 281h55zm-184 20l6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"
      />
      <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z" />
      <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z" />
    </svg>
  );
}

function FiFlag() {
  return (
    <svg {...flagProps}>
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#003580" d="M0 174.5h640v131H0z" />
      <path fill="#003580" d="M175.5 0h130.9v480h-131z" />
    </svg>
  );
}

function FrFlag() {
  return (
    <svg {...flagProps}>
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#fff" d="M0 0h640v480H0z" />
        <path fill="#00267f" d="M0 0h213.3v480H0z" />
        <path fill="#f31830" d="M426.7 0H640v480H426.7z" />
      </g>
    </svg>
  );
}

function RuFlag() {
  return (
    <svg {...flagProps} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#fff" d="M0 0h640v480H0z" />
        <path fill="#0039a6" d="M0 160h640v320H0z" />
        <path fill="#d52b1e" d="M0 320h640v160H0z" />
      </g>
    </svg>
  );
}

export const countriesData = [
  { label: 'United States', value: 'US' },
  { label: 'Great Britain', value: 'GB' },
  { label: 'Finland', value: 'FI' },
  { label: 'France', value: 'FR' },
  { label: 'Russia', value: 'RU' },
];

export const flags: Record<string, React.FC> = {
  US: UsFlag,
  GB: GbFlag,
  FI: FiFlag,
  FR: FrFlag,
  RU: RuFlag,
};

```

### Core Architecture Module: `apps/mantine.dev/src/components/HomePage/HomePageHooks/HomePageHooks.tsx`
```
import Link from 'next/link';
import { SimpleGrid, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Demo } from '@mantinex/demo';
import {
  SliderDemos,
  UseEyeDropperDemos,
  UseHotkeysDemos,
  UseResizeObserverDemos,
} from '@docs/demos';
import { HomePageContainer } from '../shared/HomePageContainer/HomePageContainer';
import { HomePageDescription } from '../shared/HomePageDescription/HomePageDescription';
import { HomePageLearnMore } from '../shared/HomePageLearnMore/HomePageLearnMore';
import { HomePageTitle } from '../shared/HomePageTitle/HomePageTitle';
import classes from './HomePageHooks.module.css';

interface DemoColumnProps {
  children: React.ReactNode;
  title: string;
  description: string;
  link: string;
}

function DemoColumn({ children, title, description, link }: DemoColumnProps) {
  return (
    <section className={classes.column}>
      <header className={classes.header}>
        <Title order={3} className={classes.title}>
          <Link href={link} className={classes.titleLink}>
            {title}
          </Link>
        </Title>

        <Text className={classes.description}>{description}</Text>
      </header>

      {children}
    </section>
  );
}

export function HomePageHooks() {
  const isMobile = useMediaQuery('(max-width: 62em)');

  return (
    <section className={classes.root}>
      <HomePageContainer>
        <HomePageTitle order={2}>Hooks library</HomePageTitle>
        <HomePageDescription>
          70+ hooks for handling tricky and common parts of your application
        </HomePageDescription>

        <HomePageLearnMore href="/hooks/package">Browse all hooks</HomePageLearnMore>

        <SimpleGrid cols={{ md: 2 }} className={classes.demos} spacing="xl">
          <DemoColumn
            title="use-move"
            description="use-move hook handles move behavior over given element, can be used to build custom sliders"
            link="/hooks/use-move"
          >
            <Demo
              data={SliderDemos.customSlider}
              demoProps={{ defaultExpanded: false, maxCollapsedHeight: isMobile ? 150 : 480 }}
            />
          </DemoColumn>

          <DemoColumn
            title="use-resize-observer"
            description="use-resize-observer hook tracks element size and position changes"
            link="/hooks/use-resize-observer"
          >
            <Demo data={UseResizeObserverDemos.usage} demoProps={{ defaultExpanded: false }} />
          </DemoColumn>

          <DemoColumn
            title="use-hotkeys"
            description="use-hotkeys hook allows binding keyboard shortcuts to actions"
            link="/hooks/use-hotkeys"
          >
            <Demo data={UseHotkeysDemos.index} demoProps={{ defaultExpanded: false }} />
          </DemoColumn>

          <DemoColumn
            title="use-eye-dropper"
            description="use-eye-dropper hook allows picking colors from anywhere on the screen"
            link="/hooks/use-eye-dropper"
          >
            <Demo
              data={UseEyeDropperDemos.usage}
              demoProps={{ defaultExpanded: false, maxCollapsedHeight: isMobile ? 150 : 256 }}
            />
          </DemoColumn>
        </SimpleGrid>
      </HomePageContainer>
    </section>
  );
}

```

### Core Architecture Module: `apps/mantine.dev/src/mdx/data/mdx-core-data.ts`
```
import { Frontmatter } from '@/types';

export const MDX_CORE_DATA: Record<string, Frontmatter> = {
  CorePackage: {
    title: 'Get started',
    slug: '/core/package',
    hideInSearch: true,
    hideHeader: true,
  },

  Box: {
    title: 'Box',
    package: '@mantine/core',
    slug: '/core/box',
    description: 'Base component for all Mantine components',
    source: '@mantine/core/src/core/Box/Box.tsx',
    docs: 'core/box.mdx',
    searchTags: 'div, wrapper, base component, polymorphic box, style props',
  },

  Button: {
    title: 'Button',
    package: '@mantine/core',
    slug: '/core/button',
    description: 'Button component to render button or link',
    componentPrefix: 'Button',
    props: ['Button', 'ButtonGroup', 'ButtonGroupSection'],
    styles: ['Button', 'ButtonGroup', 'ButtonGroupSection'],
    source: '@mantine/core/src/components/Button/Button.tsx',
    docs: 'core/button.mdx',
    searchTags: 'action, cta, submit, button group, link button',
  },
  Loader: {
    title: 'Loader',
    package: '@mantine/core',
    slug: '/core/loader',
    description: 'Indicate loading state',
    props: ['Loader'],
    styles: ['Loader'],
    source: '@mantine/core/src/components/Loader/Loader.tsx',
    docs: 'core/loader.mdx',
    searchTags: 'spinner, loading, progress, activity indicator, busy',
  },
  Container: {
    title: 'Container',
    package: '@mantine/core',
    slug: '/core/container',
    description: 'Center content with padding and max-width',
    props: ['Container'],
    styles: ['Container'],
    source: '@mantine/core/src/components/Container/Container.tsx',
    docs: 'core/container.mdx',
    searchTags: 'wrapper, max width, layout, centered content, page width',
  },
  Anchor: {
    title: 'Anchor',
    package: '@mantine/core',
    slug: '/core/anchor',
    description: 'Display link with theme styles',
    props: ['Anchor'],
    styles: ['Anchor'],
    source: '@mantine/core/src/components/Anchor/Anchor.tsx',
    docs: 'core/anchor.mdx',
    searchTags: 'link, hyperlink, a tag, href, url',
  },
  Input: {
    title: 'Input',
    package: '@mantine/core',
    slug: '/core/input',
    description: 'Base component to create custom inputs',
    componentPrefix: 'Input',
    props: ['Input', 'InputWrapper', 'InputLabel', 'InputDescription', 'InputError'],
    styles: ['Input', 'InputWrapper'],
    polymorphic: true,
    source: '@mantine/core/src/components/Input/Input.tsx',
    docs: 'core/input.mdx',
    searchTags: 'form field, base input, input wrapper, label, error, description',
  },
  ActionIcon: {
    title: 'ActionIcon',
    package: '@mantine/core',
    slug: '/core/action-icon',
    description: 'Icon button',
    componentPrefix: 'ActionIcon',
    props: ['ActionIcon', 'ActionIconGroup'],
    styles: ['ActionIcon', 'ActionIconGroup'],
    polymorphic: true,
    source: '@mantine/core/src/components/ActionIcon/ActionIcon.tsx',
    docs: 'core/action-icon.mdx',
    searchTags: 'icon button, clickable icon, square button, toolbar button',
  },
  ActionBar: {
    title: 'ActionBar',
    package: '@mantine/core',
    slug: '/core/action-bar',
    description: 'A fixed-position bottom bar for bulk selection actions',
    props: ['ActionBar'],
    styles: ['ActionBar'],
    source: '@mantine/core/src/components/ActionBar/ActionBar.tsx',
    docs: 'core/action-bar.mdx',
  },
  CloseButton: {
    title: 'CloseButton',
    package: '@mantine/core',
    slug: '/core/close-button',
    description: 'Button with close icon',
    props: ['CloseButton'],
    styles: ['CloseButton'],
    polymorphic: true,
    source: '@mantine/core/src/components/CloseButton/CloseButton.tsx',
    docs: 'core/close-button.mdx',
    searchTags: 'x button, dismiss, cancel, close icon, clear button',
  },
  CopyButton: {
    title: 'CopyButton',
    package: '@mantine/core',
    slug: '/core/copy-button',
    description: 'Copies given text to clipboard',
    props: ['CopyButton'],
    source: '@mantine/core/src/components/CopyButton/CopyButton.tsx',
    docs: 'core/copy-button.mdx',
    searchTags: 'clipboard, copy to clipboard, duplicate text',
  },
  FileButton: {
    title: 'FileButton',
    package: '@mantine/core',
    slug: '/core/file-button',
    description: 'Open file picker with a button click',
    props: ['FileButton'],
    source: '@mantine/core/src/components/FileButton/FileButton.tsx',
    docs: 'core/file-button.mdx',
    searchTags: 'upload, attach file, file picker, browse files, upload button',
  },
  UnstyledButton: {
    title: 'UnstyledButton',
    package: '@mantine/core',
    slug: '/core/unstyled-button',
    description: 'Unstyled polymorphic button',
    polymorphic: true,
    source: '@mantine/core/src/components/UnstyledButton/UnstyledButton.tsx',
    docs: 'core/unstyled-button.mdx',
    searchTags: 'plain button, reset button, base button, clickable',
  },
  Tabs: {
    title: 'Tabs',
    package: '@mantine/core',
    slug: '/core/tabs',
    props: ['Tabs', 'TabsList', 'TabsTab', 'TabsPanel'],
    styles: ['Tabs'],
    description: 'Switch between different views',
    source: '@mantine/core/src/components/Tabs/Tabs.tsx',
    docs: 'core/tabs.mdx',
    searchTags: 'tab, tabbed, panels, sections, switcher',
  },
  BackgroundImage: {
    title: 'BackgroundImage',
    package: '@mantine/core',
    slug: '/core/background-image',
    description: 'Displays image as background',
    polymorphic: true,
    props: ['BackgroundImage'],
    styles: ['BackgroundImage'],
    source: '@mantine/core/src/components/BackgroundImage/BackgroundImage.tsx',
    docs: 'core/background-image.mdx',
    searchTags: 'background, bg image, hero image, banner, cover image',
  },
  Blockquote: {
    title: 'Blockquote',
    package: '@mantine/core',
    slug: '/core/blockquote',
    props: ['Blockquote'],
    styles: ['Blockquote'],
    description: 'Blockquote with optional cite',
    source: '@mantine/core/src/components/Blockquote/Blockquote.tsx',
    docs: 'core/blockquote.mdx',
    searchTags: 'quote, citation, pull quote, cite',
  },
  Breadcrumbs: {
    title: 'Breadcrumbs',
    package: '@mantine/core',
    slug: '/core/breadcrumbs',
    props: ['Breadcrumbs'],
    styles: ['Breadcrumbs'],
    description: 'Separates list of react nodes with given separator',
    source: '@mantine/core/src/components/Breadcrumbs/Breadcrumbs.tsx',
    docs: 'core/breadcrumbs.mdx',
    searchTags: 'breadcrumb, path, trail, navigation, hierarchy',
  },
  Burger: {
    title: 'Burger',
    package: '@mantine/core',
    slug: '/core/burger',
    props: ['Burger'],
    styles: ['Burger'],
    description: 'Open/close navigation button',
    source: '@mantine/core/src/components/Burger/Burger.tsx',
    docs: 'core/burger.mdx',
    searchTags: 'hamburger, menu icon, mobile menu, nav toggle, three lines',
  },
  Center: {
    title: 'Center',
    package: '@mantine/core',
    slug: '/core/center',
    props: ['Center'],
    styles: ['Center'],
    polymorphic: true,
    description: 'Centers content vertically and horizontally',
    source: '@mantine/core/src/components/Center/Center.tsx',
    docs: 'core/center.mdx',
    searchTags: 'align center, middle, centering, flex center',
  },
  Code: {
    title: 'Code',
    package: '@mantine/core',
    slug: '/core/code',
    props: ['Code'],
    styles: ['Code'],
    description: 'Inline and block code',
    source: '@mantine/core/src/components/Code/Code.tsx',
    docs: 'core/code.mdx',
    searchTags: 'snippet, monospace, pre, inline code, code block',
  },
  Collapse: {
    title: 'Collapse',
    package: '@mantine/core',
    slug: '/core/collapse',
    props: ['Collapse'],
    description: 'Animate presence with slide down/up transition',
    source: '@mantine/core/src/components/Collapse/Collapse.tsx',
    docs: 'core/collapse.mdx',
    searchTags: 'expand, toggle visibility, show hide, slide, reveal, disclosure',
  },
  ColorPicker: {
    title: 'ColorPicker',
    package: '@mantine/core',
    slug: '/core/color-picker',
    props: ['ColorPicker'],
    styles: ['ColorPicker'],
    description: 'Pick colors in hex(a), rgb(a), hsl(a) and hsv(a) formats',
    source: '@mantine/core/src/components/ColorPicker/ColorPicker.tsx',
    docs: 'core/color-picker.mdx',
    searchTags: 'color, hex, rgb, rgba, hsl, hsv, palette, swatch, eye dropper',
  },
  ColorSwatch: {
    title: 'ColorSwatch',
    package: '@mantine/core',
    slug: '/core/color-swatch',
    props: ['ColorSwatch'],
    styles: ['ColorSwatch'],
    polymorphic: true,
    description: 'Displays color',
    source: '@mantine/core/src/components/ColorSwatch/ColorSwatch.tsx',
    docs: 'core/color-swatch.mdx',
    searchTags: 'color chip, color sample, color dot, palette item',
  },
  FocusTrap: {
    title: 'FocusTrap',
    package: '@mantine/core',
    slug: '/core/focus-trap',
    props: ['FocusTrap'],
    description: 'Trap focus at child node',
    source: '@mantine/core/src/components/FocusTrap/FocusTrap.tsx',
    docs: 'core/focus-trap.mdx',
    searchTags: 'focus management, accessibility, a11y, keyboard, tab navigation',
  },
  Group: {
    title: 'Group',
    package: '@mantine/core',
    slug: '/core/group',
    props: ['Group'],
    styles: ['Group'],
    description: 'Compose elements and components in a horizontal flex container',
    source: '@mantine/core/src/components/Group/Group.tsx',
    docs: 'core/group.mdx',
    searchTags: 'row, inline, horizontal flex, hstack, flex row',
  },
  Highlight: {
    title: 'Highlight',
    package: '@mantine/core',
    slug: '/core/highlight',
    props: ['Highlight'],
    styles: ['Highlight'],
    polymorphic: true,
    description: 'Highlight given part of a string with mark',
    source: '@mantine/core/src/components/Highlight/Highlight.tsx',
    docs: 'core/highlight.mdx',
    searchTags: 'mark text, search highlight, emphasize, yellow highlight',
  },
  Kbd: {
    title: 'Kbd',
    package: '@mantine/core',
    slug: '/core/kbd',
    props: ['Kbd'],
 
```

### Core Architecture Module: `apps/mantine.dev/src/mdx/data/mdx-hooks-data.ts`
```
import { Frontmatter } from '@/types';

function hDocs(hook: string, description: string): Frontmatter {
  const name = hook.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return {
    title: name,
    package: '@mantine/hooks',
    slug: `/hooks/${name}`,
    description,
    source: `@mantine/hooks/src/${name}/${name}.ts`,
    docs: `hooks/${name}.mdx`,
    searchTags: `${hook} ${name.split('-').join(' ')}`,
  };
}

export const MDX_HOOKS_DATA: Record<string, Frontmatter> = {
  HooksPackage: {
    title: 'Get started',
    slug: '/hooks/package',
    hideInSearch: true,
    hideHeader: true,
  },

  useClickOutside: hDocs(
    'useClickOutside',
    'Detects click and touch events outside of given element or elements group'
  ),

  useClipboard: hDocs('useClipboard', 'Copy to clipboard with feedback timeout'),

  useColorScheme: hDocs(
    'useColorScheme',
    'Returns OS color scheme preference and subscribes to changes'
  ),

  useCounter: hDocs('useCounter', 'Increments/decrements state within given boundaries'),
  useDebouncedState: hDocs('useDebouncedState', 'Debounces value changes'),
  useDebouncedValue: hDocs('useDebouncedValue', 'Debounces value changes'),

  useDidUpdate: hDocs(
    'useDidUpdate',
    'Calls given function in useEffect when value changes, but not when the component mounts'
  ),

  useDisclosure: hDocs(
    'useDisclosure',
    'Manages boolean state, provides open, close and toggle handlers, usually used with modals, drawers and popovers'
  ),
  useDocumentTitle: hDocs('useDocumentTitle', 'Sets document.title to given string'),
  useDocumentVisibility: hDocs('useDocumentVisibility', 'Detects if the current tab is active'),

  useElementSize: {
    title: 'use-element-size',
    package: '@mantine/hooks',
    slug: '/hooks/use-element-size',
    description: 'Returns element width and height and observes changes with ResizeObserver',
    source: '@mantine/hooks/src/use-resize-observer/use-resize-observer.ts',
    docs: 'hooks/use-element-size.mdx',
  },

  useEventListener: hDocs('useEventListener', 'Subscribes to events of a given element with a ref'),
  useEyeDropper: hDocs('useEyeDropper', 'Pick color from any pixel on the screen'),
  useFavicon: hDocs('useFavicon', 'Changes favicon'),

  useFocusReturn: hDocs(
    'useFocusReturn',
    'Captures last focused element on the page and returns focus to it once given condition is met'
  ),

  useFocusTrap: hDocs('useFocusTrap', 'Traps focus inside given element'),
  useFocusWithin: hDocs(
    'useFocusWithin',
    'Detects if any element within the given element has focus'
  ),
  useForceUpdate: hDocs('useForceUpdate', 'Forces the component to rerender without state change'),
  useFullscreen: hDocs(
    'useFullscreen',
    'Enter/exit fullscreen mode with given element or entire page'
  ),
  useHash: hDocs('useHash', 'Get and set hash value in the URL'),

  useHeadroom: hDocs(
    'useHeadroom',
    'Create headers that are hidden after user scrolls past given distance'
  ),

  useScrollDirection: hDocs(
    'useScrollDirection',
    'Detects whether the user is scrolling up or down'
  ),

  useHotkeys: hDocs('useHotkeys', 'Listen for keys combinations on document element'),
  useHover: hDocs('useHover', 'Detects if given element is hovered'),
  useId: hDocs('useId', 'Generates memoized random id'),
  useIdle: hDocs('useIdle', 'Detects if the user does nothing on the page'),
  useInputState: hDocs('useInputState', 'Manages input state'),
  useIntersection: hDocs(
    'useIntersection',
    'Detects if given element is visible in the viewport or other element with IntersectionObserver'
  ),
  useInterval: hDocs('useInterval', 'Calls function with a given interval'),

  useIsomorphicEffect: hDocs('useIsomorphicEffect', 'useLayoutEffect replacement'),

  useListState: hDocs('useListState', 'Manages array state'),

  useLocalStorage: hDocs(
    'useLocalStorage',
    'Exposes localStorage value as react state, syncs state across opened tabs'
  ),

  useLogger: hDocs('useLogger', 'Logs given values to console when component renders'),
  useMediaQuery: hDocs('useMediaQuery', 'Subscribes to media queries with window.matchMedia'),
  useMergedRef: hDocs(
    'useMergedRef',
    'Merges multiple refs objects or functions into one ref callback'
  ),
  useMouse: hDocs('useMouse', 'Tracks mouse position over the viewport or given element'),

  useMove: hDocs(
    'useMove',
    'Handles move behavior over given element, can be used to build custom sliders'
  ),

  useNetwork: hDocs('useNetwork', 'Returns current connection status'),
  useOs: hDocs('useOs', 'Detects user operating system'),
  usePageLeave: hDocs('usePageLeave', 'Calls given function when the mouse leaves the page'),
  usePrevious: hDocs('usePrevious', 'Returns previous value of given state'),
  useQueue: hDocs('useQueue', 'Manages queue of values'),
  useReducedMotion: hDocs('useReducedMotion', 'Detects if user prefers to reduce motion'),
  useResizeObserver: hDocs(
    'useResizeObserver',
    'Tracks element size and position changes with ResizeObserver'
  ),
  useScrollIntoView: hDocs('useScrollIntoView', 'Scrolls given element into view'),
  useSetState: hDocs('useSetState', 'Manages state with setState-like API'),

  useShallowEffect: hDocs(
    'useShallowEffect',
    'useEffect drop in replacement with dependencies shallow comparison'
  ),

  useTextSelection: hDocs('useTextSelection', 'Returns current selected text on the page'),
  useTimeout: hDocs('useTimeout', 'Calls function in given timeout'),
  useToggle: hDocs('useToggle', 'Switches between given values'),

  useUncontrolled: hDocs(
    'useUncontrolled',
    'Manage state of both controlled and uncontrolled components'
  ),

  useValidatedState: hDocs('useValidatedState', 'Manages state with validation'),
  useViewportSize: hDocs(
    'useViewportSize',
    'Returns viewport width and height and subscribes to changes'
  ),

  useWindowEvent: hDocs(
    'useWindowEvent',
    'Adds event listener to the window object on component mount and removes the event when the component unmounts'
  ),

  useWindowScroll: hDocs('useWindowScroll', 'Tracks window scroll position'),
  usePagination: hDocs('usePagination', 'Manages pagination state'),
  useInViewport: hDocs('useInViewport', 'Detects if element is visible in the viewport'),
  useMutationObserver: hDocs(
    'useMutationObserver',
    'Subscribe to changes being made to the DOM tree'
  ),
  useMounted: hDocs('useMounted', 'Returns true if the component is mounted'),
  useStateHistory: hDocs('useStateHistory', 'Move back/forward in state history'),
  useOrientation: hDocs(
    'useOrientation',
    'Detects device orientation and subscribe to its changes'
  ),
  useFetch: hDocs('useFetch', 'Fetch data with built-in loading and error states'),
  useIsFirstRender: hDocs(
    'useIsFirstRender',
    'Detects if the component is rendered for the first time'
  ),
  useThrottledState: hDocs('useThrottledState', 'Throttles state changes'),
  useThrottledValue: hDocs('useThrottledValue', 'Throttles value changes'),
  useThrottledCallback: hDocs('useThrottledCallback', 'Throttles function calls'),
  useDebouncedCallback: hDocs(
    'useDebouncedCallback',
    'Creates debounced version of the given function'
  ),
  useSet: hDocs('useSet', 'Use Set as React state'),
  useMap: hDocs('useMap', 'Use Map as React state'),
  useRadialMove: hDocs(
    'useRadialMove',
    'Handles radial move behavior over given element, can be used to build custom radial sliders'
  ),
  useScrollSpy: hDocs(
    'useScrollSpy',
    'Track scroll position and detect which heading is currently in the viewport, can be used for table of contents'
  ),
  useScroller: hDocs(
    'useScroller',
    'Manages horizontal scroll behavior with scroll state tracking and drag-to-scroll functionality'
  ),
  useFloatingWindow: hDocs('useFloatingWindow', 'Create draggable floating area'),
  useFileDialog: hDocs('useFileDialog', 'Capture one or more files from the user'),
  useLongPress: hDocs('useLongPress', 'Call function on long press'),
  useSelection: hDocs('useSelection', 'Manages selection state of given dataset'),
  useCollapse: hDocs('useCollapse', 'Animate height from 0 to auto and vice versa'),
  useMask: hDocs('useMask', 'Attach real-time input masking to any input element'),
  useRovingIndex: hDocs('useRovingIndex', 'Implement roving tabindex keyboard navigation pattern'),
  useDrag: hDocs(
    'useDrag',
    'Handle pointer drag gestures with movement, velocity, direction and axis constraints'
  ),
  useSplitter: hDocs(
    'useSplitter',
    'Create resizable split pane layouts with keyboard support, collapsible panels and constraints'
  ),
};

```

### Core Architecture Module: `packages/@mantine/charts/src/utils/get-pie-chart-data/get-pie-chart-data.ts`
```
import { getThemeColor, MantineColor, MantineTheme } from '@mantine/core';

interface PieChartDataItem {
  color: MantineColor;
  [key: string]: any;
}

interface GetPieChartDataInput<T extends PieChartDataItem> {
  data: T[];
  theme: MantineTheme;
  strokeWidth: number | undefined;
  highlightedIndex: number | null;
  cellProps:
    | ((item: T) => Partial<Omit<React.SVGProps<SVGElement>, 'ref'>>)
    | Partial<Omit<React.SVGProps<SVGElement>, 'ref'>>
    | undefined;
}

export function getPieChartData<T extends PieChartDataItem>({
  data,
  theme,
  strokeWidth,
  highlightedIndex,
  cellProps,
}: GetPieChartDataInput<T>) {
  return data.map((item, index) => ({
    ...item,
    __segmentIndex: index,
    fill: getThemeColor(item.color, theme),
    stroke: 'var(--chart-stroke-color, var(--mantine-color-body))',
    strokeWidth,
    ...(typeof cellProps === 'function' ? cellProps(item) : cellProps),
    ...(highlightedIndex !== null ? { fillOpacity: highlightedIndex === index ? 1 : 0.2 } : null),
  }));
}

```

### Core Architecture Module: `packages/@mantine/charts/src/utils/get-series-labels/get-series-labels.ts`
```
import { ChartSeries } from '../../types';

type ChartSeriesLabels = Record<string, string | undefined>;

export function getSeriesLabels(series: ChartSeries[] | undefined): ChartSeriesLabels {
  if (!series) {
    return {};
  }

  return series.reduce<ChartSeriesLabels>((acc, item) => {
    const matchFound = item.name.search(/\./);
    if (matchFound >= 0) {
      const key = item.name.substring(matchFound + 1);
      acc[key] = item.label;
      return acc;
    }
    acc[item.name] = item.label;
    return acc;
  }, {});
}

```

### Core Architecture Module: `packages/@mantine/charts/src/utils/index.ts`
```
export { getPieChartData } from './get-pie-chart-data/get-pie-chart-data';
export { getSeriesLabels } from './get-series-labels/get-series-labels';

```

### Core Architecture Module: `packages/@mantine/code-highlight/src/JsonViewer/json-viewer-utils.ts`
```
export const PATH_SEPARATOR = '\0';

export function serializePath(segments: string[]): string {
  return segments.join(PATH_SEPARATOR);
}

export interface JsonViewerArrayChunk {
  start: number;
  end: number;
}

export function getArrayChunks(
  length: number,
  groupArraysAfterLength: number | false
): JsonViewerArrayChunk[] | null {
  if (groupArraysAfterLength === false) {
    return null;
  }

  const size = Math.floor(groupArraysAfterLength);
  if (!(size >= 1) || length <= groupArraysAfterLength) {
    return null;
  }

  const chunks: JsonViewerArrayChunk[] = [];
  for (let start = 0; start < length; start += size) {
    chunks.push({ start, end: Math.min(start + size, length) - 1 });
  }
  return chunks;
}

export function getChunkSegment(chunk: JsonViewerArrayChunk): string {
  return `[${chunk.start}...${chunk.end}]`;
}

export function resolveDisplayValue(value: any): any {
  if (value !== null && typeof value === 'object' && typeof value.toJSON === 'function') {
    try {
      return value.toJSON();
    } catch {
      return value;
    }
  }
  return value;
}

export function isExpandableValue(value: any): value is object {
  return value !== null && typeof value === 'object';
}

export function getEntries(value: object): [string, any][] {
  return Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
}

export interface GetExpandablePathsOptions {
  depth?: number;
  groupArraysAfterLength?: number | false;
}

export function getExpandablePaths(
  value: any,
  { depth = Infinity, groupArraysAfterLength = false }: GetExpandablePathsOptions = {}
): string[] {
  const paths: string[] = [];
  const ancestors = new WeakSet<object>();

  const visitChildren = (entries: [string, any][], path: string[], childLevel: number) => {
    for (const [key, child] of entries) {
      visit(child, [...path, key], childLevel);
    }
  };

  const visit = (node: any, path: string[], level: number) => {
    const resolved = resolveDisplayValue(node);
    if (!isExpandableValue(resolved) || ancestors.has(resolved) || level > depth) {
      return;
    }

    const entries = getEntries(resolved);
    if (entries.length === 0) {
      return;
    }

    if (path.length > 0) {
      paths.push(serializePath(path));
    }

    ancestors.add(resolved);
    const chunks = Array.isArray(resolved)
      ? getArrayChunks(entries.length, groupArraysAfterLength)
      : null;

    if (chunks) {
      if (level + 1 <= depth) {
        for (const chunk of chunks) {
          paths.push(serializePath([...path, getChunkSegment(chunk)]));
          visitChildren(entries.slice(chunk.start, chunk.end + 1), path, level + 2);
        }
      }
    } else {
      visitChildren(entries, path, level + 1);
    }
    ancestors.delete(resolved);
  };

  visit(value, [], 1);
  return paths;
}

export function getValueType(value: any): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

export function getTypeLabel(value: any): string {
  const type = getValueType(value);
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return Number.isInteger(value) ? 'int' : 'float';
    case 'boolean':
      return 'bool';
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return type;
  }
}

export function formatValue(
  value: any,
  withQuotes: boolean,
  collapseStringsAfterLength: number | false
): { display: string; collapsed: boolean } {
  if (value === null) {
    return { display: 'null', collapsed: false };
  }
  if (value === undefined) {
    return { display: 'undefined', collapsed: false };
  }
  if (typeof value === 'boolean') {
    return { display: String(value), collapsed: false };
  }
  if (typeof value === 'number') {
    return { display: String(value), collapsed: false };
  }
  if (typeof value === 'string') {
    if (collapseStringsAfterLength !== false && value.length > collapseStringsAfterLength) {
      const splitsPair = /^[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(
        value.slice(collapseStringsAfterLength - 1)
      );
      const truncated = value.slice(0, collapseStringsAfterLength - (splitsPair ? 1 : 0));
      return {
        display: withQuotes ? `${JSON.stringify(truncated).slice(0, -1)}..."` : `${truncated}...`,
        collapsed: true,
      };
    }
    return { display: withQuotes ? JSON.stringify(value) : value, collapsed: false };
  }
  return { display: String(value), collapsed: false };
}

function createStringifyReplacer() {
  const ancestors: object[] = [];
  return function replacer(this: any, _key: string, value: any) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return '[Circular]';
    }
    ancestors.push(value);
    return value;
  };
}

export function safeStringify(value: any): string {
  try {
    return JSON.stringify(value, createStringifyReplacer(), 2) ?? String(value);
  } catch {
    return String(value);
  }
}

```

### Core Architecture Module: `packages/@mantine/core/src/components/Accordion/Accordion.context.ts`
```
import { createSafeContext, GetStylesApi } from '../../core';
import type { AccordionFactory } from './Accordion';
import { AccordionChevronPosition, AccordionHeadingOrder } from './Accordion.types';

export interface AccordionContextValue {
  loop: boolean | undefined;
  transitionDuration: number | undefined;
  disableChevronRotation: boolean | undefined;
  chevronPosition: AccordionChevronPosition | undefined;
  order: AccordionHeadingOrder | undefined;
  chevron: React.ReactNode;
  onChange: (value: string) => void;
  isItemActive: (value: string) => boolean;
  getControlId: (value: string) => string;
  getRegionId: (value: string) => string;
  getStyles: GetStylesApi<AccordionFactory>;
  variant: string | undefined;
  unstyled: boolean | undefined;
  keepMounted: boolean | undefined;
  keepMountedMode: 'activity' | 'display-none' | undefined;
}

export const [AccordionProvider, useAccordionContext] = createSafeContext<AccordionContextValue>(
  'Accordion component was not found in the tree'
);

```

### Core Architecture Module: `packages/@mantine/core/src/components/Accordion/Accordion.story.tsx`
```
import { useEffect, useState } from 'react';
import { TextInput } from '../TextInput';
import { Accordion } from './Accordion';

export default { title: 'Accordion' };

const _items = (
  <>
    <Accordion.Item value="customize">
      <Accordion.Control>Customization</Accordion.Control>
      <Accordion.Panel>
        Colors, fonts, shadows and many other parts are customizable to fit your design needs
      </Accordion.Panel>
    </Accordion.Item>

    <Accordion.Item value="flex">
      <Accordion.Control>Flexibility</Accordion.Control>
      <Accordion.Panel>
        Configure components appearance and behavior with vast amount of settings or overwrite any
        part of component styles
      </Accordion.Panel>
    </Accordion.Item>

    <Accordion.Item value="focus">
      <Accordion.Control>No annoying focus ring</Accordion.Control>
      <Accordion.Panel>
        With new :focus-visible pseudo-class focus ring appears only when user navigates with
        keyboard
      </Accordion.Panel>
    </Accordion.Item>
  </>
);

export function Variants() {
  return (
    <>
      <Accordion
        defaultValue="flex"
        style={{ maxWidth: 400 }}
        mx="auto"
        mt="xl"
        variant="default"
        keepMounted={false}
      >
        {_items}
      </Accordion>

      <Accordion
        defaultValue="flex"
        style={{ maxWidth: 400 }}
        mx="auto"
        mt={50}
        variant="contained"
        radius="lg"
      >
        {_items}
      </Accordion>

      <Accordion defaultValue="flex" style={{ maxWidth: 400 }} mx="auto" mt={50} variant="filled">
        {_items}
      </Accordion>

      <Accordion
        defaultValue="flex"
        style={{ maxWidth: 400 }}
        mx="auto"
        mt={50}
        variant="separated"
      >
        {_items}
      </Accordion>
    </>
  );
}

export function NestedAccordions() {
  return (
    <Accordion multiple style={{ maxWidth: 400 }} mx="auto">
      <Accordion.Item value="item-1">
        <Accordion.Control>Nested 1</Accordion.Control>
        <Accordion.Panel>
          <Accordion>{_items}</Accordion>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="item-2">
        <Accordion.Control>Nested 2</Accordion.Control>
        <Accordion.Panel>
          <Accordion>{_items}</Accordion>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

export function WithInputs() {
  return (
    <div style={{ maxWidth: 400, padding: 40 }}>
      <Accordion multiple>
        <Accordion.Item value="item-1">
          <Accordion.Control>First item</Accordion.Control>
          <Accordion.Panel>
            <TextInput label="Text input" placeholder="Text input" />
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="item-2">
          <Accordion.Control>Second item</Accordion.Control>
          <Accordion.Panel>
            <TextInput label="Text input" placeholder="Text input" />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <TextInput label="Text input" />
    </div>
  );
}

function Timer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{ padding: 10, background: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
      Timer running: {seconds}s
    </div>
  );
}

export function KeepMountedMode() {
  return (
    <div style={{ maxWidth: 500, margin: 'auto', padding: 40 }}>
      <h3>keepMountedMode="display-none" (Timer keeps running when collapsed)</h3>
      <Accordion keepMounted keepMountedMode="display-none" defaultValue="item-1">
        <Accordion.Item value="item-1">
          <Accordion.Control>Panel with Timer (Keep mounted display-none)</Accordion.Control>
          <Accordion.Panel>
            <Timer />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <h3 style={{ marginTop: 40 }}>
        keepMountedMode="activity" (Timer pauses/resets when collapsed)
      </h3>
      <Accordion keepMounted keepMountedMode="activity" defaultValue="item-1">
        <Accordion.Item value="item-1">
          <Accordion.Control>Panel with Timer (Keep mounted activity)</Accordion.Control>
          <Accordion.Panel>
            <Timer />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

export function VariantsWithOrder() {
  return (
    <>
      {(['default', 'contained', 'filled', 'separated'] as const).map((variant) => (
        <Accordion
          key={variant}
          defaultValue="flex"
          style={{ maxWidth: 400 }}
          mx="auto"
          mt={50}
          variant={variant}
          radius="lg"
          order={3}
        >
          {_items}
        </Accordion>
      ))}
    </>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9255** (2026-10-06): **[@mantine/schedule] Fix startScrollTime scroll position**
  *Symptoms*: `startScrollTime` is applied by measuring the target slot relative to the viewport's visible rect, without the current scroll offset. When the mount effect runs twice (React StrictMode in development), the second run scrolls back: e.g. `ResourcesDayView` scrolls to 800px, then to 44px.  - DayView, WeekView, ResourcesDayView: add the current `scrollTop` / `scrollLeft` to the computed offset, so the effect is idempotent. - WeekView: subtract the sticky header height, otherwise the target slot is hidden under it (same approach as the `resourcesDayViewCorner` width in ResourcesDayView).  _Editted with AI_
  **Post-Mortem & Fix Analysis**:
  > 🤖 Beep boop, Claude (Fable 5.1) speaking! Here are changes I've made in this PR:  - `ResourcesWeekView`: added the current `scrollLeft` to the `startScrollDateTime` scroll offset, same formula as `ResourcesDayView` in this PR. - `ResourcesMonthView`: added the current `scrollLeft` in `scrollToDay`, which backs both `startScrollDate` and the header "Today" button. Without it, pressing "Today" after a manual scroll landed on the wrong day.  Verified in the browser with each view mounted in its own `createRoot` under `StrictMode` (Storybook does not double-invoke effects, so the repro needs a plain root): on master the second effect run reset the scroll to 0 in DayView, WeekView and all three Resources views, and the WeekView target slot sat under the 59px sticky header. With this PR plus the two sibling views, every view ends at the target slot in both StrictMode and plain mounts, and non-StrictMode behavior is unchanged apart from the WeekView header offset. 
  > Thanks!

- **Issue #9254** (2026-10-06): **[core] Apply rem scaling to per-component CSS**
  *Symptoms*: Matched per-component CSS generation to the bundled stylesheet's rem scaling, including the layer variants. Added regression coverage and made CSS generation wait for its file writes.  Fixes #9253.  Validation: script tests (66 passed), full typecheck, changed-file lint/format, and all 30 package builds passed. Compared Button, Input, and Loader computed styles across all four CSS import variants in Chromium with 12/16/20px root fonts, scale 1/1.25, and light/dark themes; all 12 scenarios matched. 
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #9253** (2026-10-06): **Per-component CSS files (@mantine/core/styles/*.css) use px instead of rem * var(--mantine-scale), so they don't match styles.css**
  *Symptoms*: ### Dependencies check up  - [x] I have verified that the issue persists in the latest version of the package  ### What version of @mantine/* packages do you have in package.json?  9.3.2. Also reproduced in 9.7.0 and 8.3.14.  ### What package has an issue?  @mantine/core  ### What framework do you use?  Next.js  ### In which browsers you can reproduce the issue?  All  ### Describe the bug  The per-component CSS files described in [CSS files list](https://mantine.dev/styles/css-files-list/) contain raw `px` values. The same rules in `@mantine/core/styles.css` are converted to `calc(Xrem * var(--mantine-scale))`.  Examples from `@mantine/core@9.7.0`:  | Variable | `styles/<Component>.css` | `styles.css` | | --- | --- | --- | | `--button-height-sm` (`Button.css`) | `36px` | `calc(2.25rem * var(--mantine-scale))` | | `--loader-size-md` (`Loader.css`) | `36px` | `calc(2.25rem * var(--mantine-scale))` | | `--input-padding-y-sm` (`Input.css`) | `6px` | `calc(0.375rem * var(--mantine-scale))` | | `--right-section-end` (`Input.css`) | `1px` | `calc(0.0625rem * var(--mantine-scale))` |  There are about 670 `px` values across the per-component files and 71 in `styles.css`. The `.layer.css` variants behave the same way.  When the root font size is 16px, both sets of files render identically. When the root font size changes, which the [rem docs](https://mantine.dev/styles/rem/) support with `--mantine-scale`, components styled by the per-component files no longer scale. They look differen

- **Issue #9251** (2026-10-06): **[@mantine/core] RollingNumber: Fix sub-pixel digit misalignment at fractional zoom levels**
  *Symptoms*: Fixes #9239 Followup to #9241 (closed) – implements the approach suggested by @rtivital.  ## Problem  `DigitColumn` positions each digit by shifting a 0–9 strip with `transform: translateY(-{digit}em)`. When `1em` is a fractional number of device pixels (non-100% browser zoom, OS fractional scaling like Windows 125%/150%), each digit's shift has a different fractional part and is rounded to device pixels differently. This causes some digits to sit ~1px above or below the others.  ## Fix  Move the resting offset from `transform` into layout:  ```diff - transform: `translateY(${-digitIndex}em)` + position: 'relative' + top: `${-digitIndex}em` 
  **Post-Mortem & Fix Analysis**:
  > 🤖 Beep boop, Claude (Fable 5.1) speaking! Here are changes I've made in this PR:  - Moved `position: relative` from the inline style of each digit column to the `.digitColumn` rule in `RollingNumber.module.css`, so the inline style only carries `top` and the two roll variables. - Restored the original `renders a 12-cell wraparound strip in each column` test: the strip always has 12 cells, the extra rerender was not needed. - Replaced the removed transform test with `positions digit columns with top offset instead of transform`, which asserts the resting offset is on `top` and `transform` stays empty. This is the regression test for the fix. - Added the `--rn-roll-from` assertion to the "does not wrap when value direction is down" test.  Verified in the browser at 23.4px and 28.6px font sizes: digits 3/8 and 1/2/7 were 1 device pixel off on master, all digits are aligned with this PR. Roll animation, wraparound and copy behavior are unchanged. 
  > Thanks!

- **Issue #9250** (2026-10-06): **[core] Restore per-component Storybook filter for Storybook 10**
  *Symptoms*: ## Summary  - Storybook 10 rejects extra CLI arguments, so `npm run storybook Tooltip` never starts and the filter in `.storybook/main.ts` never runs. - Read `COMPONENT` from the environment instead, and load only that component’s stories. - Update the contributing docs to `COMPONENT=Tooltip npm run storybook`.  Fixes #9249   ## Test plan  - [x] `npm run storybook` still starts with all stories - [x] `COMPONENT=Tooltip npm run storybook` starts and shows only Tooltip stories - [x] `npm run storybook Tooltip` still fails (Storybook 10 CLI) - [x] Contributing docs look correct on the local docs server
  **Post-Mortem & Fix Analysis**:
  > 🤖 Beep boop, Claude (Fable 5.1) speaking! Pull request is perfect, no changes needed! Verified label added. 
  > Thanks!

- **Issue #9249** (2026-10-06): **Storybook per-component filter command is broken after Storybook 10**
  *Symptoms*: ### What is the expected behavior?  The contributing docs say you can start Storybook for one component:  ```bash npm run storybook Tooltip ```  That should start Storybook on port 2356 and load only that component’s stories (`Tooltip.story.tsx` and `Tooltip.demos.story.tsx`).  `.storybook/main.ts` still has this filter: it reads an extra CLI argument and narrows the story globs.  ### What is the current behavior?  The command fails immediately:  ```text > storybook dev -p 2356 Tooltip  error: too many arguments for 'dev'. Expected 0 arguments but got 1. ```  Storybook never starts, so the filter in `.storybook/main.ts` never runs.  `npm run storybook` (all stories) still works.  ### Possible cause  This does not look like an intentional removal of the feature.  Mantine upgraded Storybook to 10.x in https://github.com/mantinedev/mantine/commit/34e779369b8ae360d9410ccd7b80fcc67e8deee4 and kept the `argv._[1]` filter. Contribute docs were not updated.  Storybook 10’s `dev` command no longer accepts extra positional arguments (`storybook dev [options]` only), so the old shortcut is rejected by the CLI.  ### Reproduction  1. Follow local setup (`yarn`, `npm run setup`, `npm run build`). 2. Run `npm run storybook Tooltip` 3. Observe the Storybook CLI error above.
  **Post-Mortem & Fix Analysis**:
  > hi can i take up the issue ? 
  > > hi can i take up the issue ?   I have already attached a fix PR with this.

- **Issue #9248** (2026-10-04): **9.7**
  *Symptoms*: 

- **Issue #9247** (2026-10-06): **[@mantine/core] Tree: Add aria-expanded to tree items with children**
  *Symptoms*: ## Bug  `Tree` nodes with children render as `role="treeitem"` without `aria-expanded`, so assistive technology cannot distinguish a collapsed branch from a leaf or announce expand/collapse. The WAI-ARIA tree view pattern requires it. `FlatTreeNode` (virtualized tree) already sets it; the default `TreeNode` did not.  ## Fix  Add `aria-expanded={hasChildren ? isExpanded : undefined}` to the treeitem in `TreeNode.tsx`, matching `FlatTreeNode.tsx`. Leaf nodes still omit the attribute.  Closes #9246  ## Testing  - `Tree.test.tsx`: `sets aria-expanded on nodes with children` — checks `false` → `true` → `false` across two clicks; fails on master (`Received: null`), passes with the fix. - `Tree.test.tsx`: `does not set aria-expanded on leaf nodes` — guards against emitting the attribute on nodes without children. - Full `Tree` suite: 65 passed. `oxlint`, `format:write:files`, and root `tsc --noEmit` clean. 
  **Post-Mortem & Fix Analysis**:
  > Thanks!

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

### Incident Patch 1: `bb3067f6` (2026-10-06)
**Commit Message**: [@mantine/schedule] Fix startScrollTime scroll position (#9255)

**File**: `packages/@mantine/schedule/src/components/DayView/DayView.tsx` (modified, +4/-1)
```diff
@@ -473,7 +473,10 @@ export const DayView = factory<DayViewFactory>((_props) => {
 
     const slotRect = targetSlot.getBoundingClientRect();
     const viewportRect = viewportRef.current.getBoundingClientRect();
-    viewportRef.current.scrollTo({ left: 0, top: slotRect.top - viewportRect.top });
+    viewportRef.current.scrollTo({
+      left: 0,
+      top: slotRect.top - viewportRect.top + viewportRef.current.scrollTop,
+    });
   }, []);
 
   const dragOffsetRef = useRef<{ offset: number; size: number }>({ offset: 0, size: 0 });
```

**File**: `packages/@mantine/schedule/src/components/ResourcesDayView/ResourcesDayView.tsx` (modified, +1/-1)
```diff
@@ -742,7 +742,7 @@ export const ResourcesDayView = factory<ResourcesDayViewFactory>((_props) => {
     const cornerEl = viewportRef.current.querySelector(`.${classes.resourcesDayViewCorner}`);
     const labelWidth = cornerEl ? cornerEl.getBoundingClientRect().width : 0;
     viewportRef.current.scrollTo({
-      left: slotRect.left - viewportRect.left - labelWidth,
+      left: slotRect.left - viewportRect.left + viewportRef.current.scrollLeft - labelWidth,
       top: 0,
     });
   }, []);
```

**File**: `packages/@mantine/schedule/src/components/ResourcesMonthView/ResourcesMonthView.tsx` (modified, +1/-1)
```diff
@@ -490,7 +490,7 @@ export const ResourcesMonthView = factory<ResourcesMonthViewFactory>((_props) =>
       const viewportRect = viewportRef.current.getBoundingClientRect();
       const labelWidth = resourceLabelRef.current?.getBoundingClientRect().width ?? 0;
       viewportRef.current.scrollTo({
-        left: labelRect.left - viewportRect.left - labelWidth,
+        left: labelRect.left - viewportRect.left + viewportRef.current.scrollLeft - labelWidth,
         top: 0,
       });
     },
```

**File**: `packages/@mantine/schedule/src/components/ResourcesWeekView/ResourcesWeekView.tsx` (modified, +1/-1)
```diff
@@ -757,7 +757,7 @@ export const ResourcesWeekView = factory<ResourcesWeekViewFactory>((_props) => {
     const cornerEl = viewportRef.current.querySelector(`.${classes.resourcesWeekViewCorner}`);
     const labelWidth = cornerEl ? cornerEl.getBoundingClientRect().width : 0;
     viewportRef.current.scrollTo({
-      left: slotRect.left - viewportRect.left - labelWidth,
+      left: slotRect.left - viewportRect.left + viewportRef.current.scrollLeft - labelWidth,
       top: 0,
     });
   }, []);
```

**File**: `packages/@mantine/schedule/src/components/WeekView/WeekView.tsx` (modified, +6/-1)
```diff
@@ -770,7 +770,12 @@ export const WeekView = factory<WeekViewFactory>((_props) => {
 
     const slotRect = targetSlot.getBoundingClientRect();
     const viewportRect = viewportRef.current.getBoundingClientRect();
-    viewportRef.current.scrollTo({ left: 0, top: slotRect.top - viewportRect.top });
+    const headerEl = viewportRef.current.querySelector(`.${classes.weekViewHeader}`);
+    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
+    viewportRef.current.scrollTo({
+      left: 0,
+      top: slotRect.top - viewportRect.top + viewportRef.current.scrollTop - headerHeight,
+    });
   }, []);
 
   const getSlotIndexFromDragPoint = useCallback((event: React.DragEvent, dayIndex: number) => {
```

---

### Incident Patch 2: `1ccd3910` (2026-10-06)
**Commit Message**: [core] Apply rem scaling to per-component CSS (#9254)

**File**: `scripts/build/generate-css.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ async function processFile(
   outputFolder: string
 ) {
   const result = await postcss([
-    postcssPresetMantine,
+    postcssPresetMantine({ autoRem: true }),
     postcssModules({ generateScopedName, getJSON: () => {}, scopeBehaviour }),
   ]).process(fs.readFileSync(filePath, 'utf-8'), { from: path.basename(filePath) });
 
```

---

### Incident Patch 3: `7dc25c4e` (2026-10-06)
**Commit Message**: [@mantine/core] RollingNumber: Fix sub-pixel digit misalignment at fractional zoom levels (#9251)

**File**: `packages/@mantine/core/src/components/RollingNumber/DigitColumn.tsx` (modified, +3/-3)
```diff
@@ -40,9 +40,9 @@ export function DigitColumn({
         {...columnStyles}
         style={{
           ...columnStyles.style,
-          transform: `translateY(${-digitIndex}em)`,
-          ['--rn-roll-from' as any]: `translateY(${-previousDigitIndex}em)`,
-          ['--rn-roll-to' as any]: `translateY(${-animateToIndex}em)`,
+          top: `${-digitIndex}em`,
+          ['--rn-roll-from' as any]: `translateY(${digitIndex - previousDigitIndex}em)`,
+          ['--rn-roll-to' as any]: `translateY(${digitIndex - animateToIndex}em)`,
         }}
         data-direction={direction}
       >
```

**File**: `packages/@mantine/core/src/components/RollingNumber/RollingNumber.module.css` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@
 }
 
 .digitColumn {
+  position: relative;
   display: flex;
   flex-direction: column;
   animation: mantine-rolling-number-roll var(--rn-duration) var(--rn-timing-function);
```

**File**: `packages/@mantine/core/src/components/RollingNumber/RollingNumber.test.tsx` (modified, +13/-10)
```diff
@@ -115,11 +115,13 @@ describe('@mantine/core/RollingNumber', () => {
     });
   });
 
-  it('renders digit columns with correct transform', () => {
+  it('positions digit columns with top offset instead of transform', () => {
     const { container } = render(<RollingNumber value={35} />);
-    const columns = container.querySelectorAll('.mantine-RollingNumber-digitColumn');
-    expect(columns[0]).toHaveStyle({ transform: 'translateY(-3em)' });
-    expect(columns[1]).toHaveStyle({ transform: 'translateY(-5em)' });
+    const columns = container.querySelectorAll<HTMLElement>('.mantine-RollingNumber-digitColumn');
+    expect(columns[0].style.top).toBe('-3em');
+    expect(columns[1].style.top).toBe('-5em');
+    expect(columns[0].style.transform).toBe('');
+    expect(columns[1].style.transform).toBe('');
   });
 
   it('renders a 12-cell wraparound strip in each column', () => {
@@ -138,17 +140,17 @@ describe('@mantine/core/RollingNumber', () => {
     const onesColumn = columns[columns.length - 1] as HTMLElement;
     expect(onesColumn.style.getPropertyValue('--rn-roll-from')).toBe('translateY(-9em)');
     expect(onesColumn.style.getPropertyValue('--rn-roll-to')).toBe('translateY(-10em)');
-    expect(onesColumn.style.transform).toBe('translateY(0em)');
+    expect(onesColumn.style.getPropertyValue('top')).toBe('0em');
   });
 
   it('does not use the wraparound cell on a normal forward step', () => {
     const { container, rerender } = render(<RollingNumber value={3} />);
     rerender(<RollingNumber value={3} />);
     rerender(<RollingNumber value={5} />);
     const onesColumn = container.querySelector('.mantine-RollingNumber-digitColumn') as HTMLElement;
-    expect(onesColumn.style.getPropertyValue('--rn-roll-from')).toBe('translateY(-3em)');
-    expect(onesColumn.style.getPropertyValue('--rn-roll-to')).toBe('translateY(-5em)');
-    expect(onesColumn.style.transform).toBe('translateY(-5em)');
+    expect(onesColumn.style.getPropertyValue('--rn-roll-from')).toBe('translateY(2em)');
+    expect(onesColumn.style.getPropertyValue('--rn-roll-to')).toBe('translateY(0em)');
+    expect(onesColumn.style.getPropertyValue('top')).toBe('-5em');
   });
 
   it('does not wrap when value direction is down', () => {
@@ -157,8 +159,9 @@ describe('@mantine/core/RollingNumber', () => {
     rerender(<RollingNumber value={9} />);
     const columns = container.querySelectorAll('.mantine-RollingNumber-digitColumn');
     const onesColumn = columns[columns.length - 1] as HTMLElement;
-    expect(onesColumn.style.getPropertyValue('--rn-roll-to')).toBe('translateY(-9em)');
-    expect(onesColumn.style.transform).toBe('translateY(-9em)');
+    expect(onesColumn.style.getPropertyValue('--rn-roll-from')).toBe('translateY(9em)');
+    expect(onesColumn.style.getPropertyValue('--rn-roll-to')).toBe('translateY(0em)');
+    expect(onesColumn.style.getPropertyValue('top')).toBe('-9em');
   });
 
   it('handles negative values', () => {
```

---

### Incident Patch 4: `e4922008` (2026-10-06)
**Commit Message**: [@mantine/core] SegmentedControl: Do not call Math.random during render (#9245)

**File**: `packages/@mantine/core/src/components/SegmentedControl/SegmentedControl.test.tsx` (modified, +16/-0)
```diff
@@ -1,5 +1,7 @@
 import { useState } from 'react';
+import { renderToString } from 'react-dom/server';
 import { render, screen, tests, userEvent } from '@mantine-tests/core';
+import { MantineProvider } from '../../core';
 import {
   SegmentedControl,
   SegmentedControlProps,
@@ -25,6 +27,20 @@ describe('@mantine/core/SegmentedControl', () => {
     stylesApiSelectors: ['root', 'label', 'input', 'control', 'indicator', 'innerLabel'],
   });
 
+  it('does not call Math.random during server rendering', () => {
+    const spy = jest.spyOn(Math, 'random');
+    try {
+      renderToString(
+        <MantineProvider>
+          <SegmentedControl {...defaultProps} />
+        </MantineProvider>
+      );
+      expect(spy).not.toHaveBeenCalled();
+    } finally {
+      spy.mockRestore();
+    }
+  });
+
   it('prevents value changes when readOnly is true', async () => {
     const spy = jest.fn();
     render(<SegmentedControl {...defaultProps} value="First" onChange={spy} readOnly />);
```

**File**: `packages/@mantine/core/src/components/SegmentedControl/SegmentedControl.tsx` (modified, +3/-10)
```diff
@@ -1,12 +1,5 @@
 import { useState } from 'react';
-import {
-  randomId,
-  useId,
-  useMergedRef,
-  useMounted,
-  useShallowEffect,
-  useUncontrolled,
-} from '@mantine/hooks';
+import { useId, useMergedRef, useMounted, useShallowEffect, useUncontrolled } from '@mantine/hooks';
 import {
   Box,
   BoxProps,
@@ -190,7 +183,7 @@ export const SegmentedControl = genericFactory<SegmentedControlFactory>((_props)
   const _data = data.map((item) => (isPrimitive(item) ? { label: `${item}`, value: item } : item));
 
   const initialized = useMounted();
-  const [key, setKey] = useState(randomId());
+  const [key, setKey] = useState(0);
   const [parent, setParent] = useState<HTMLElement | null>(null);
   const [refs, setRefs] = useState<Record<string, HTMLElement | null>>({});
   const setElementRef = (element: HTMLElement | null, val: string) => {
@@ -258,7 +251,7 @@ export const SegmentedControl = genericFactory<SegmentedControlFactory>((_props)
   const mergedRef = useMergedRef(ref, setParent);
 
   useShallowEffect(() => {
-    setKey(randomId());
+    setKey((current) => current + 1);
   }, [data.length]);
 
   useShallowEffect(() => {
```

---

### Incident Patch 5: `02a79d2e` (2026-10-06)
**Commit Message**: [@mantine/form] Fix clearing state of unrelated fields (#9242)

**File**: `packages/@mantine/form/src/lists/clear-list-state.test.ts` (modified, +17/-0)
```diff
@@ -21,6 +21,23 @@ const TEST_ERRORS = {
 };
 
 describe('@mantine/form/clear-list-state', () => {
+  it('does not clear state of unrelated fields with matching path suffixes', () => {
+    const state = {
+      items: true,
+      'items.0.name': true,
+      'lineitems.0.name': true,
+      'billing.items.0.name': true,
+      'itemsExtra.0.name': true,
+    };
+
+    expect(clearListState('items', state)).toStrictEqual({
+      items: true,
+      'lineitems.0.name': true,
+      'billing.items.0.name': true,
+      'itemsExtra.0.name': true,
+    });
+  });
+
   it('clears list errors of given field', () => {
     expect(clearListState('fruits', TEST_ERRORS)).toStrictEqual({
       name: 'name-error',
```

**File**: `packages/@mantine/form/src/lists/clear-list-state.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ export function clearListState<T extends Record<PropertyKey, any>>(
 
   const clone = { ...state };
   Object.keys(state).forEach((errorKey) => {
-    if (errorKey.includes(`${String(field)}.`)) {
+    if (errorKey.startsWith(`${String(field)}.`)) {
       delete clone[errorKey];
     }
   });
```

**File**: `packages/@mantine/form/src/tests/use-form/removeListItem.test.ts` (modified, +35/-0)
```diff
@@ -96,6 +96,41 @@ function tests(mode: FormMode) {
     });
   });
 
+  it('keeps errors and dirty state of unrelated fields when removing a list item', () => {
+    const hook = renderHook(() =>
+      useForm({
+        mode,
+        initialValues: {
+          items: [{ name: 'first' }, { name: 'second' }],
+          lineitems: [{ name: 'other' }],
+          billing: { items: [{ name: 'nested' }] },
+        },
+        initialErrors: {
+          'items.0.name': 'removed-error',
+          'items.1.name': 'remaining-error',
+          'lineitems.0.name': 'other-error',
+          'billing.items.0.name': 'nested-error',
+        },
+        initialDirty: {
+          'items.0.name': true,
+          'lineitems.0.name': true,
+          'billing.items.0.name': true,
+        },
+      })
+    );
+
+    act(() => hook.result.current.removeListItem('items', 0));
+    expect(hook.result.current.errors).toStrictEqual({
+      'items.0.name': 'remaining-error',
+      'lineitems.0.name': 'other-error',
+      'billing.items.0.name': 'nested-error',
+    });
+    expect(hook.result.current.getDirty()).toStrictEqual({
+      'lineitems.0.name': true,
+      'billing.items.0.name': true,
+    });
+  });
+
   it('calls onValuesChange when removeListItem is called', () => {
     const spy = jest.fn();
     const hook = renderHook(() =>
```

---

### Incident Patch 6: `07243334` (2026-10-06)
**Commit Message**: [@mantine/form] Fix reorderListItem moving errors of items whose index shares a prefix with the reordered index (#9235)

**File**: `packages/@mantine/form/src/lists/reorder-errors.test.ts` (modified, +20/-0)
```diff
@@ -49,6 +49,26 @@ describe('@mantine/form/reorder-errors', () => {
     });
   });
 
+  it('does not move errors of items whose index starts with the same digits', () => {
+    expect(
+      reorderErrors(
+        'items',
+        { from: 1, to: 0 },
+        {
+          'items.0.name': 'Error 0',
+          'items.1.name': 'Error 1',
+          'items.10.name': 'Error 10',
+          'items.12': 'Error 12',
+        }
+      )
+    ).toStrictEqual({
+      'items.0.name': 'Error 1',
+      'items.1.name': 'Error 0',
+      'items.10.name': 'Error 10',
+      'items.12': 'Error 12',
+    });
+  });
+
   it('returns unchanged object if path does not exist', () => {
     const errors = { 'a.0': true };
     expect(reorderErrors('c', { from: 1, to: 2 }, errors)).toStrictEqual(errors);
```

**File**: `packages/@mantine/form/src/lists/reorder-errors.ts` (modified, +6/-2)
```diff
@@ -1,5 +1,9 @@
 import { ReorderPayload } from '../types';
 
+function isItemKey(key: string, keyStart: string) {
+  return key === keyStart || key.startsWith(`${keyStart}.`);
+}
+
 export function reorderErrors<T>(path: unknown, { from, to }: ReorderPayload, errors: T): T {
   const oldKeyStart = `${path}.${from}`;
   const newKeyStart = `${path}.${to}`;
@@ -15,10 +19,10 @@ export function reorderErrors<T>(path: unknown, { from, to }: ReorderPayload, er
     let oldKey;
     let newKey;
 
-    if (key.startsWith(oldKeyStart)) {
+    if (isItemKey(key, oldKeyStart)) {
       oldKey = key;
       newKey = key.replace(oldKeyStart, newKeyStart);
-    } else if (key.startsWith(newKeyStart)) {
+    } else if (isItemKey(key, newKeyStart)) {
       oldKey = key.replace(newKeyStart, oldKeyStart);
       newKey = key;
     }
```

---

### Incident Patch 7: `bf3d3c08` (2026-10-06)
**Commit Message**: [@mantine/schedule] MonthView: Fix quadratic row assignment for weeks with many events (#9232)

**File**: `packages/@mantine/schedule/src/components/MonthView/get-month-view-events/find-available-row.test.ts` (removed, +0/-228)
```diff
@@ -1,228 +0,0 @@
-import dayjs from 'dayjs';
-import { testUtils } from '../../../test-utils';
-import { findAvailableRow } from './find-available-row';
-
-describe('@mantine/schedule/find-available-row', () => {
-  const weekStart = dayjs('2025-01-13');
-
-  it('returns row 0 when no existing events', () => {
-    const result = findAvailableRow({
-      existingEvents: [],
-      startDayIndex: 2,
-      daysSpanned: 1,
-      weekStart,
-    });
-
-    expect(result).toBe(0);
-  });
-
-  it('returns row 0 when event does not overlap with existing events', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-13 10:00:00',
-          end: '2025-01-14 12:00:00',
-        }),
-        position: {
-          startOffset: 0,
-          width: (1 / 7) * 100,
-          weekIndex: 0,
-          row: 0,
-          hanging: 'none' as const,
-        },
-      },
-    ];
-
-    const result = findAvailableRow({
-      existingEvents,
-      startDayIndex: 3,
-      daysSpanned: 1,
-      weekStart,
-    });
-
-    expect(result).toBe(0);
-  });
-
-  it('returns row 1 when event overlaps with existing event in row 0', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-15 10:00:00',
-          end: '2025-01-17 12:00:00',
-        }),
-        position: {
-          startOffset: (2 / 7) * 100,
-          width: (3 / 7) * 100,
-          weekIndex: 0,
-          row: 0,
-          hanging: 'none' as const,
-        },
-      },
-    ];
-
-    const result = findAvailableRow({
-      existingEvents,
-      startDayIndex: 3,
-      daysSpanned: 2,
-      weekStart,
-    });
-
-    expect(result).toBe(1);
-  });
-
-  it('returns row 2 when events in rows 0 and 1 overlap', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-15 10:00:00',
-          end: '2025-01-17 12:00:00',
-        }),
-        position: {
-          startOffset: (2 / 7) * 100,
-          width: (3 / 7) * 100,
-          weekIndex: 0,
-          row: 0,
-          hanging: 'none' as const,
-        },
-      },
-      {
-        ...testUtils.createEvent({
-          id: 2,
-          start: '2025-01-16 10:00:00',
-          end: '2025-01-18 12:00:00',
-        }),
-        position: {
-          startOffset: (3 / 7) * 100,
-          width: (3 / 7) * 100,
-          weekIndex: 0,
-          row: 1,
-          hanging: 'none' as const,
-        },
-      },
-    ];
-
-    const result = findAvailableRow({
-      existingEvents,
-      startDayIndex: 3,
-      daysSpanned: 2,
-      weekStart,
-    });
-
-    expect(result).toBe(2);
-  });
-
-  it('handles events that start before week', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-10 10:00:00',
-          end: '2025-01-15 12:00:00',
-        }),
-        position: {
-          startOffset: 0,
-          width: (2 / 7) * 100,
-          weekIndex: 0,
-          row: 0,
-          hanging: 'start' as const,
-        },
-      },
-    ];
-
-    const result = findAvailableRow({
-      existingEvents,
-      startDayIndex: 1,
-      daysSpanned: 2,
-      weekStart,
-    });
-
-    expect(result).toBe(1);
-  });
-
-  it('correctly calculates overlap with events of different widths', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-13 10:00:00',
-          end: '2025-01-16 12:00:00',
-        }),
-        position: {
-          startOffset: 0,
-          width: (3 / 7) * 100,
-          weekIndex: 0,
-          row: 0,
-          hanging: 'none' as const,
-        },
-      },
-    ];
-
-    const result = findAvailableRow({
-      existingEvents,
-      startDayIndex: 2,
-      daysSpanned: 3,
-      weekStart,
-    });
-
-    expect(result).toBe(1);
-  });
-
-  it('handles single-day events correctly', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-15 10:00:00',
-          end: '2025-01-15 12:00:00',
-        }),
-        position: {
-          startOffset: (2 / 7) * 100,
-          width: (1 / 7) * 100,
-          weekIndex: 0,
-          row: 0,
-          hanging: 'none' as const,
-        },
-      },
-    ];
-
-    const result = findAvailableRow({
-      existingEvents,
-      startDayIndex: 2,
-      daysSpanned: 1,
-      weekStart,
-    });
-
-    expect(result).toBe(1);
-  });
-
-  it('allows events on adjacent days without overlap', () => {
-    const existingEvents = [
-      {
-        ...testUtils.createEvent({
-          id: 1,
-          start: '2025-01-13 10:00:00',
-          end: '2025-01-14 12:00:00',
-        }),
-        position: {
-          startOffset: 0,
-          width: (1 / 7) * 100,
-          weekIndex: 0,
-     
```

**File**: `packages/@mantine/schedule/src/components/MonthView/get-month-view-events/find-available-row.ts` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-import dayjs from 'dayjs';
-import { MonthPositionedEventData } from '../../../types';
-
-interface FindAvailableRowInput {
-  existingEvents: MonthPositionedEventData[];
-  startDayIndex: number;
-  daysSpanned: number;
-  weekStart: dayjs.Dayjs;
-}
-
-export function findAvailableRow({
-  existingEvents,
-  startDayIndex,
-  daysSpanned,
-  weekStart,
-}: FindAvailableRowInput): number {
-  let row = 0;
-
-  for (const existing of existingEvents) {
-    const existingStart = dayjs(existing.start).startOf('day');
-    const existingDisplayStart =
-      existingStart.isBefore(weekStart) || existingStart.isSame(weekStart, 'day')
-        ? weekStart
-        : existingStart;
-    const existingDayIndex = existingDisplayStart.diff(weekStart, 'day');
-    const existingWidth = existing.position?.width || 0;
-    const existingDaysSpanned = (existingWidth / 100) * 7;
-
-    if (
-      existingDayIndex + existingDaysSpanned > startDayIndex &&
-      existingDayIndex < startDayIndex + daysSpanned
-    ) {
-      row = Math.max(row, (existing.position?.row || 0) + 1);
-    }
-  }
-
-  return row;
-}
```

**File**: `packages/@mantine/schedule/src/components/MonthView/get-month-view-events/get-month-positioned-events.test.ts` (modified, +121/-0)
```diff
@@ -1,5 +1,6 @@
 import dayjs from 'dayjs';
 import { testUtils } from '../../../test-utils';
+import { MonthPositionedEventData } from '../../../types';
 import { getMonthPositionedEvents } from './get-month-positioned-events';
 
 describe('@mantine/schedule/get-month-positioned-events', () => {
@@ -828,4 +829,124 @@ describe('@mantine/schedule/get-month-positioned-events', () => {
       expect(typeof dayEvents[0].position?.weekIndex).toBe('number');
     });
   });
+
+  describe('row assignment equivalence', () => {
+    function createRandom(seed: number) {
+      let state = seed;
+      return (max: number) => {
+        state = (state + 0x6d2b79f5) | 0;
+        let t = Math.imul(state ^ (state >>> 15), 1 | state);
+        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
+        return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
+      };
+    }
+
+    function generateEvents(seed: number) {
+      const random = createRandom(seed);
+      const rangeStart = dayjs('2024-12-28');
+
+      return Array.from({ length: 400 }, (_, id) => {
+        const kind = random(6);
+        const start = rangeStart
+          .add(random(45), 'day')
+          .hour(random(24))
+          .minute(15 * random(4));
+
+        const eventStart = kind === 0 ? start.startOf('day') : start;
+        const end =
+          kind === 0
+            ? eventStart.add(1 + random(3), 'day')
+            : kind === 1
+              ? start.add(1 + random(14), 'day')
+              : kind === 2
+                ? start.add(1 + random(3), 'day').startOf('day')
+                : start.add(1 + random(120), 'minute');
+
+        return testUtils.createEvent({
+          id,
+          start: eventStart.format('YYYY-MM-DD HH:mm:ss'),
+          end: end.format('YYYY-MM-DD HH:mm:ss'),
+          display: kind === 5 && random(2) === 0 ? 'background' : undefined,
+        });
+      });
+    }
+
+    function getDayRange(event: MonthPositionedEventData) {
+      return {
+        startDayIndex: Math.round((event.position.startOffset / 100) * 7),
+        daysSpanned: Math.round((event.position.width / 100) * 7),
+      };
+    }
+
+    function getReferenceRow(
+      existingEvents: MonthPositionedEventData[],
+      startDayIndex: number,
+      daysSpanned: number
+    ) {
+      let row = 0;
+
+      for (const existing of existingEvents) {
+        const existingRange = getDayRange(existing);
+
+        if (
+          existingRange.startDayIndex + existingRange.daysSpanned > startDayIndex &&
+          existingRange.startDayIndex < startDayIndex + daysSpanned
+        ) {
+          row = Math.max(row, existing.position.row + 1);
+        }
+      }
+
+      return row;
+    }
+
+    it.each([
+      [1, 0],
+      [1, 1],
+      [2, 6],
+      [3, 1],
+    ] as const)(
+      'assigns the same rows as a full overlap scan (seed %s, firstDayOfWeek %s)',
+      (seed, firstDayOfWeek) => {
+        const range = { start: '2024-12-30 00:00:00', end: '2025-02-09 23:59:59' };
+        const result = getMonthPositionedEvents({
+          date: testMonth,
+          events: generateEvents(seed),
+          firstDayOfWeek,
+          range,
+        });
+
+        let placedEvents = 0;
+        let hangingEvents = 0;
+        let backgroundEvents = 0;
+
+        Object.entries(result.groupedByWeek).forEach(([weekIdx, weekEvents]) => {
+          weekEvents.forEach((event, index) => {
+            const { startDayIndex, daysSpanned } = getDayRange(event);
+            expect(event.position.row).toBe(
+              getReferenceRow(weekEvents.slice(0, index), startDayIndex, daysSpanned)
+            );
+          });
+
+          for (const event of result.backgroundByWeek[weekIdx]) {
+            expect(event.position.row).toBe(0);
+          }
+
+          placedEvents += weekEvents.length;
+          hangingEvents += weekEvents.filter((event) => event.position.hanging !== 'none').length;
+          backgroundEvents += result.backgroundByWeek[weekIdx].length;
+        });
+
+        expect(placedEvents).toBeGreaterThan(400);
+        expect(hangingEvents).toBeGreaterThan(50);
+        expect(backgroundEvents).toBeGreaterThan(10);
+        expect(
+          Math.max(
+            ...Object.values(result.groupedByWeek)
+              .flat()
+              .map((event) => event.position.row)
+          )
+        ).toBeGreaterThan(3);
+      }
+    );
+  });
 });
```

**File**: `packages/@mantine/schedule/src/components/MonthView/get-month-view-events/get-month-positioned-events.ts` (modified, +10/-7)
```diff
@@ -8,8 +8,8 @@ import {
 } from '../../../types';
 import { addEventToDayGroups } from './add-event-to-day-groups';
 import { calculateEventPositionInWeek } from './calculate-event-position-in-week';
-import { findAvailableRow } from './find-available-row';
 import { getWeeksInRange } from './get-weeks-in-range';
+import { reserveRow } from './reserve-row';
 
 interface GetMonthPositionedEventsInput {
   /** Date (month start) at which events are positioned */
@@ -65,6 +65,12 @@ export function getMonthPositionedEvents({
     firstDayOfWeek,
   });
 
+  const weekStates = weeks.map((week) => ({
+    weekStart: dayjs(week[0]).startOf('day'),
+    weekEnd: dayjs(week[6]).endOf('day'),
+    nextRowByDay: new Array<number>(7).fill(0),
+  }));
+
   for (let i = 0; i < weeks.length; i++) {
     groupedByWeek[i.toString()] = [];
     backgroundByWeek[i.toString()] = [];
@@ -80,9 +86,7 @@ export function getMonthPositionedEvents({
     const isMultiday = eventEnd.isAfter(eventStart);
 
     for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
-      const week = weeks[weekIdx];
-      const weekStart = dayjs(week[0]).startOf('day');
-      const weekEnd = dayjs(week[6]).endOf('day');
+      const { weekStart, weekEnd, nextRowByDay } = weekStates[weekIdx];
 
       if (
         (eventStart.isBefore(weekEnd) || eventStart.isSame(weekEnd, 'day')) &&
@@ -111,11 +115,10 @@ export function getMonthPositionedEvents({
           continue;
         }
 
-        const row = findAvailableRow({
-          existingEvents: groupedByWeek[weekIdx.toString()],
+        const row = reserveRow({
+          nextRowByDay,
           startDayIndex,
           daysSpanned,
-          weekStart,
         });
 
         const positionedEvent: MonthPositionedEventData = {
```

**File**: `packages/@mantine/schedule/src/components/MonthView/get-month-view-events/reserve-row.test.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { reserveRow } from './reserve-row';
+
+describe('@mantine/schedule/reserve-row', () => {
+  it('returns row 0 when no events are placed', () => {
+    const nextRowByDay = [0, 0, 0, 0, 0, 0, 0];
+    expect(reserveRow({ nextRowByDay, startDayIndex: 2, daysSpanned: 1 })).toBe(0);
+    expect(nextRowByDay).toEqual([0, 0, 1, 0, 0, 0, 0]);
+  });
+
+  it('returns row 0 when event does not overlap with placed events', () => {
+    const nextRowByDay = [1, 0, 0, 0, 0, 0, 0];
+    expect(reserveRow({ nextRowByDay, startDayIndex: 3, daysSpanned: 1 })).toBe(0);
+  });
+
+  it('allows events on adjacent days without overlap', () => {
+    const nextRowByDay = [0, 0, 0, 0, 0, 0, 0];
+    reserveRow({ nextRowByDay, startDayIndex: 0, daysSpanned: 2 });
+    expect(reserveRow({ nextRowByDay, startDayIndex: 2, daysSpanned: 1 })).toBe(0);
+  });
+
+  it('returns the row below the highest overlapping event', () => {
+    const nextRowByDay = [0, 0, 0, 0, 0, 0, 0];
+    expect(reserveRow({ nextRowByDay, startDayIndex: 2, daysSpanned: 3 })).toBe(0);
+    expect(reserveRow({ nextRowByDay, startDayIndex: 3, daysSpanned: 3 })).toBe(1);
+    expect(reserveRow({ nextRowByDay, startDayIndex: 3, daysSpanned: 2 })).toBe(2);
+    expect(nextRowByDay).toEqual([0, 0, 1, 3, 3, 2, 0]);
+  });
+
+  it('places a multi-day event below all events it overlaps', () => {
+    const nextRowByDay = [0, 0, 0, 0, 0, 0, 0];
+    reserveRow({ nextRowByDay, startDayIndex: 1, daysSpanned: 1 });
+    reserveRow({ nextRowByDay, startDayIndex: 5, daysSpanned: 1 });
+    reserveRow({ nextRowByDay, startDayIndex: 5, daysSpanned: 1 });
+    expect(reserveRow({ nextRowByDay, startDayIndex: 0, daysSpanned: 7 })).toBe(2);
+    expect(nextRowByDay).toEqual([3, 3, 3, 3, 3, 3, 3]);
+  });
+});
```

**File**: `packages/@mantine/schedule/src/components/MonthView/get-month-view-events/reserve-row.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+interface ReserveRowInput {
+  nextRowByDay: number[];
+  startDayIndex: number;
+  daysSpanned: number;
+}
+
+export function reserveRow({ nextRowByDay, startDayIndex, daysSpanned }: ReserveRowInput): number {
+  const endDayIndex = startDayIndex + daysSpanned;
+  const row = Math.max(...nextRowByDay.slice(startDayIndex, endDayIndex));
+  nextRowByDay.fill(row + 1, startDayIndex, endDayIndex);
+  return row;
+}
```

---

### Incident Patch 8: `6d583b32` (2026-10-06)
**Commit Message**: [@mantine/hooks] use-pagination: Fix single page being replaced with dots on the right side (#9229)

**File**: `packages/@mantine/hooks/src/use-pagination/use-pagination.test.ts` (modified, +18/-0)
```diff
@@ -79,6 +79,24 @@ describe('@mantine/hooks/use-pagination', () => {
     });
   });
 
+  it('does not hide a single page behind dots', () => {
+    const { result } = renderHook(() => usePagination({ total: 10, initialPage: 7 }));
+    expect(result.current.range).toStrictEqual([1, 'dots', 6, 7, 8, 9, 10]);
+  });
+
+  it('does not hide a single page behind dots with custom parameters', () => {
+    const { result } = renderHook(() =>
+      usePagination({
+        total: 20,
+        siblings: 2,
+        boundaries: 2,
+        initialPage: 15,
+      })
+    );
+
+    expect(result.current.range).toStrictEqual([1, 2, 'dots', 13, 14, 15, 16, 17, 18, 19, 20]);
+  });
+
   it('truncates total value', () => {
     const hook = renderHook(() => usePagination({ total: 45.21 }));
     expect(hook.result.current.range).toStrictEqual([1, 2, 3, 4, 5, 'dots', 45]);
```

**File**: `packages/@mantine/hooks/src/use-pagination/use-pagination.ts` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ export function usePagination({
     const rightSiblingIndex = Math.min(activePage + siblings, _endValue - boundaries);
 
     const shouldShowLeftDots = leftSiblingIndex > _startValue + boundaries + 1;
-    const shouldShowRightDots = rightSiblingIndex < _endValue - boundaries;
+    const shouldShowRightDots = rightSiblingIndex < _endValue - (boundaries + 1);
 
     if (!shouldShowLeftDots && shouldShowRightDots) {
       const leftItemCount = siblings * 2 + boundaries + 2;
```

---

### Incident Patch 9: `be0ee1f8` (2026-10-06)
**Commit Message**: [@mantine/core] ScrollArea: Fix wheel listener on document blocking compositor scrolling for the whole page (#9225)

**File**: `packages/@mantine/core/src/components/ScrollArea/ScrollAreaScrollbar/Scrollbar.tsx` (modified, +11/-12)
```diff
@@ -40,9 +40,10 @@ export function Scrollbar(props: ScrollbarProps) {
   const composeRefs = useMergedRef(ref, setScrollbar);
   const rectRef = useRef<DOMRect | null>(null);
   const prevWebkitUserSelectRef = useRef<string>('');
-  const { viewport } = context;
   const maxScrollPos = sizes.content - sizes.viewport;
-  const handleWheelScroll = useEffectEvent(onWheelScroll);
+  const handleWheelScroll = useEffectEvent((event: WheelEvent) =>
+    onWheelScroll(event, maxScrollPos)
+  );
   const handleThumbPositionChange = useCallbackRef(onThumbPositionChange);
   const handleResize = useDebouncedCallback(onResize, 10);
 
@@ -55,16 +56,14 @@ export function Scrollbar(props: ScrollbarProps) {
   };
 
   useEffect(() => {
-    const handleWheel = (event: WheelEvent) => {
-      const element = event.target as HTMLElement;
-      const isScrollbarWheel = scrollbar?.contains(element);
-      if (isScrollbarWheel) {
-        handleWheelScroll(event, maxScrollPos);
-      }
-    };
-    document.addEventListener('wheel', handleWheel, { passive: false });
-    return () => document.removeEventListener('wheel', handleWheel, { passive: false } as any);
-  }, [viewport, scrollbar, maxScrollPos]);
+    if (!scrollbar) {
+      return undefined;
+    }
+
+    const handleWheel = (event: WheelEvent) => handleWheelScroll(event);
+    scrollbar.addEventListener('wheel', handleWheel, { passive: false });
+    return () => scrollbar.removeEventListener('wheel', handleWheel);
+  }, [scrollbar]);
 
   useEffect(handleThumbPositionChange, [sizes, handleThumbPositionChange]);
 
```

---

### Incident Patch 10: `1a560ba1` (2026-10-06)
**Commit Message**: [@mantine/dates] DateTimePicker: Fix time not being limited by minDate and maxDate (#9221)

**File**: `packages/@mantine/dates/src/components/DateTimePicker/get-min-max-time/get-min-max-time.test.ts` (modified, +34/-8)
```diff
@@ -9,11 +9,24 @@ describe('@mantine/dates/get-min-max-time', () => {
       expect(getMinTime({ minDate, value })).toBe('00:30:00');
     });
 
-    it('returns undefined when value does not equal minDate', () => {
-      const minDate = '2022-04-11 00:30:00';
-      const value = '2022-04-11 00:00:00';
+    it('returns min time when value is on the same day as minDate', () => {
+      expect(getMinTime({ minDate: '2022-04-11 00:30:00', value: '2022-04-11 00:00:00' })).toBe(
+        '00:30:00'
+      );
+      expect(getMinTime({ minDate: '2022-04-11 00:30:00', value: '2022-04-11 18:00:00' })).toBe(
+        '00:30:00'
+      );
+    });
 
-      expect(getMinTime({ minDate, value })).toBe(undefined);
+    it('returns min time when minDate is a Date object', () => {
+      const minDate = new Date(2022, 3, 11, 10, 30);
+      expect(getMinTime({ minDate, value: '2022-04-11 12:00:00' })).toBe('10:30:00');
+    });
+
+    it('returns undefined when value is not on the same day as minDate', () => {
+      const minDate = '2022-04-11 00:30:00';
+      expect(getMinTime({ minDate, value: '2022-04-12 00:00:00' })).toBe(undefined);
+      expect(getMinTime({ minDate, value: '2022-04-10 23:59:59' })).toBe(undefined);
     });
 
     it('returns undefined when minDate is undefined', () => {
@@ -37,11 +50,24 @@ describe('@mantine/dates/get-min-max-time', () => {
       expect(getMaxTime({ maxDate, value })).toBe('22:30:00');
     });
 
-    it('returns undefined when value does not equal maxDate', () => {
-      const maxDate = '2022-04-11 22:30:00';
-      const value = '2022-04-11 22:00:00';
+    it('returns max time when value is on the same day as maxDate', () => {
+      expect(getMaxTime({ maxDate: '2022-04-11 22:30:00', value: '2022-04-11 22:00:00' })).toBe(
+        '22:30:00'
+      );
+      expect(getMaxTime({ maxDate: '2022-04-11 22:30:00', value: '2022-04-11 23:00:00' })).toBe(
+        '22:30:00'
+      );
+    });
 
-      expect(getMaxTime({ maxDate, value })).toBe(undefined);
+    it('returns max time when maxDate is a Date object', () => {
+      const maxDate = new Date(2022, 3, 11, 18, 15);
+      expect(getMaxTime({ maxDate, value: '2022-04-11 12:00:00' })).toBe('18:15:00');
+    });
+
+    it('returns undefined when value is not on the same day as maxDate', () => {
+      const maxDate = '2022-04-11 22:30:00';
+      expect(getMaxTime({ maxDate, value: '2022-04-10 22:30:00' })).toBe(undefined);
+      expect(getMaxTime({ maxDate, value: '2022-04-12 00:00:00' })).toBe(undefined);
     });
 
     it('returns undefined when maxDate is undefined', () => {
```

**File**: `packages/@mantine/dates/src/components/DateTimePicker/get-min-max-time/get-min-max-time.ts` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ interface GetMinTimeInput {
 
 export function getMinTime({ minDate, value }: GetMinTimeInput): string | undefined {
   const minTime = minDate ? dayjs(minDate).format('HH:mm:ss') : null;
-  return value && minDate && value === minDate
+  return value && minDate && dayjs(value).isSame(minDate, 'day')
     ? minTime != null
       ? minTime
       : undefined
@@ -22,7 +22,7 @@ interface GetMaxTimeInput {
 
 export function getMaxTime({ maxDate, value }: GetMaxTimeInput): string | undefined {
   const maxTime = maxDate ? dayjs(maxDate).format('HH:mm:ss') : null;
-  return value && maxDate && value === maxDate
+  return value && maxDate && dayjs(value).isSame(maxDate, 'day')
     ? maxTime != null
       ? maxTime
       : undefined
```

**File**: `packages/@mantine/dates/src/components/InlineDateTimePicker/InlineDateTimePicker.test.tsx` (modified, +36/-0)
```diff
@@ -108,6 +108,42 @@ describe('@mantine/dates/InlineDateTimePicker', () => {
     expect(screen.queryByLabelText('test-time-picker-hours')).not.toBeInTheDocument();
   });
 
+  it('does not allow time before minDate time when value is on the minDate day', async () => {
+    const spy = jest.fn();
+    render(
+      <InlineDateTimePicker
+        {...defaultProps}
+        minDate="2022-04-11 10:30:00"
+        defaultValue="2022-04-11 12:00:00"
+        onChange={spy}
+      />
+    );
+
+    await userEvent.clear(getTimePicker());
+    await userEvent.type(getTimePicker(), '08');
+    await userEvent.click(document.body);
+
+    expect(spy).toHaveBeenLastCalledWith('2022-04-11 10:30:00');
+  });
+
+  it('does not allow time after maxDate time when value is on the maxDate day', async () => {
+    const spy = jest.fn();
+    render(
+      <InlineDateTimePicker
+        {...defaultProps}
+        maxDate={new Date(2022, 3, 11, 18, 15)}
+        defaultValue="2022-04-11 12:00:00"
+        onChange={spy}
+      />
+    );
+
+    await userEvent.clear(getTimePicker());
+    await userEvent.type(getTimePicker(), '20');
+    await userEvent.click(document.body);
+
+    expect(spy).toHaveBeenLastCalledWith('2022-04-11 18:15:00');
+  });
+
   describe('range type', () => {
     const rangeProps: any = {
       ...defaultProps,
```

---

### Incident Patch 11: `bdf802ec` (2026-10-06)
**Commit Message**: [@mantine/core] Select, MultiSelect, Autocomplete, TagsInput: Fix listbox aria-labelledby referencing a missing label element (#9219) (#9220)

**File**: `packages/@mantine/core/src/components/Autocomplete/Autocomplete.test.tsx` (modified, +41/-1)
```diff
@@ -1,4 +1,10 @@
-import { inputDefaultProps, inputStylesApiSelectors, tests } from '@mantine-tests/core';
+import {
+  inputDefaultProps,
+  inputStylesApiSelectors,
+  render,
+  screen,
+  tests,
+} from '@mantine-tests/core';
 import { Autocomplete, AutocompleteProps, AutocompleteStylesNames } from './Autocomplete';
 
 const defaultProps: AutocompleteProps = {
@@ -44,4 +50,38 @@ describe('@mantine/core/Autocomplete', () => {
     props: defaultProps,
     componentName: 'Autocomplete',
   });
+
+  it('links listbox to the rendered label with aria-labelledby', () => {
+    const { rerender } = render(
+      <Autocomplete label="Test label" data={['test-1', 'test-2']} dropdownOpened />
+    );
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+
+    rerender(
+      <>
+        <Autocomplete
+          label="Test label"
+          labelProps={{ id: 'custom-label-id' }}
+          data={['test-1', 'test-2']}
+          dropdownOpened
+        />
+      </>
+    );
+    expect(screen.getByRole('listbox')).toHaveAttribute('aria-labelledby', 'custom-label-id');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+  });
+
+  it('does not reference label in aria-labelledby when label is excluded from inputWrapperOrder', () => {
+    render(
+      <Autocomplete
+        label="Test label"
+        aria-label="Test aria-label"
+        inputWrapperOrder={['input']}
+        data={['test-1', 'test-2']}
+        dropdownOpened
+      />
+    );
+    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-labelledby');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test aria-label');
+  });
 });
```

**File**: `packages/@mantine/core/src/components/Autocomplete/Autocomplete.tsx` (modified, +9/-2)
```diff
@@ -23,6 +23,7 @@ import {
   OptionsFilter,
   useCombobox,
 } from '../Combobox';
+import { getComboboxLabelId } from '../Combobox/get-combobox-label-id/get-combobox-label-id';
 import {
   __BaseInputProps,
   __InputStylesNames,
@@ -141,6 +142,12 @@ export const Autocomplete = factory<AutocompleteFactory>((_props) => {
   } = props;
 
   const _id = useId(id);
+  const comboboxLabelId = getComboboxLabelId({
+    id: _id,
+    label: others.label,
+    labelProps: others.labelProps,
+    inputWrapperOrder: others.inputWrapperOrder,
+  });
   const parsedData = getParsedComboboxData(data);
   const optionsLockup = getOptionsLockup(parsedData);
 
@@ -264,8 +271,8 @@ export const Autocomplete = factory<AutocompleteFactory>((_props) => {
         withScrollArea={withScrollArea}
         maxDropdownHeight={maxDropdownHeight}
         unstyled={unstyled}
-        labelId={others.label ? `${_id}-label` : undefined}
-        aria-label={others.label ? undefined : others['aria-label']}
+        labelId={comboboxLabelId}
+        aria-label={comboboxLabelId ? undefined : others['aria-label']}
         renderOption={renderOption}
         scrollAreaProps={scrollAreaProps}
       />
```

**File**: `packages/@mantine/core/src/components/Combobox/get-combobox-label-id/get-combobox-label-id.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import type { __InputWrapperProps } from '../../Input';
+
+interface GetComboboxLabelIdInput {
+  id: string;
+  label: React.ReactNode;
+  labelProps?: __InputWrapperProps['labelProps'];
+  inputWrapperOrder?: __InputWrapperProps['inputWrapperOrder'];
+}
+
+export function getComboboxLabelId({
+  id,
+  label,
+  labelProps,
+  inputWrapperOrder,
+}: GetComboboxLabelIdInput) {
+  if (!label) {
+    return undefined;
+  }
+
+  if (inputWrapperOrder && !inputWrapperOrder.includes('label')) {
+    return undefined;
+  }
+
+  return labelProps?.id || `${id}-label`;
+}
```

**File**: `packages/@mantine/core/src/components/MultiSelect/MultiSelect.test.tsx` (modified, +34/-0)
```diff
@@ -601,4 +601,38 @@ describe('@mantine/core/MultiSelect', () => {
       expect(getHiddenInput()).toHaveValue('');
     });
   });
+
+  it('links listbox to the rendered label with aria-labelledby', () => {
+    const { rerender } = render(
+      <MultiSelect label="Test label" data={['test-1', 'test-2']} dropdownOpened />
+    );
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+
+    rerender(
+      <>
+        <MultiSelect
+          label="Test label"
+          labelProps={{ id: 'custom-label-id' }}
+          data={['test-1', 'test-2']}
+          dropdownOpened
+        />
+      </>
+    );
+    expect(screen.getByRole('listbox')).toHaveAttribute('aria-labelledby', 'custom-label-id');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+  });
+
+  it('does not reference label in aria-labelledby when label is excluded from inputWrapperOrder', () => {
+    render(
+      <MultiSelect
+        label="Test label"
+        aria-label="Test aria-label"
+        inputWrapperOrder={['input']}
+        data={['test-1', 'test-2']}
+        dropdownOpened
+      />
+    );
+    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-labelledby');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test aria-label');
+  });
 });
```

**File**: `packages/@mantine/core/src/components/MultiSelect/MultiSelect.tsx` (modified, +9/-2)
```diff
@@ -27,6 +27,7 @@ import {
   useCombobox,
   usePillsReorder,
 } from '../Combobox';
+import { getComboboxLabelId } from '../Combobox/get-combobox-label-id/get-combobox-label-id';
 import { getOptionByLabel } from '../Combobox/get-options-lockup/get-option-by-label';
 import { isExternalInputChange } from '../Combobox/is-external-input-change/is-external-input-change';
 import {
@@ -261,6 +262,12 @@ export const MultiSelect = genericFactory<MultiSelectFactory>((_props) => {
   } = props;
 
   const _id = useId(id);
+  const comboboxLabelId = getComboboxLabelId({
+    id: _id,
+    label,
+    labelProps,
+    inputWrapperOrder,
+  });
   const parsedData = getParsedComboboxData(data);
   const optionsLockup = getOptionsLockup(parsedData);
   const retainedSelectedOptions = useRef<Record<string, ComboboxItem<Primitive>>>({});
@@ -583,8 +590,8 @@ export const MultiSelect = genericFactory<MultiSelectFactory>((_props) => {
           withAlignedLabels={withAlignedLabels}
           nothingFoundMessage={nothingFoundMessage}
           unstyled={unstyled}
-          labelId={label ? `${_id}-label` : undefined}
-          aria-label={label ? undefined : others['aria-label']}
+          labelId={comboboxLabelId}
+          aria-label={comboboxLabelId ? undefined : others['aria-label']}
           renderOption={renderOption}
           scrollAreaProps={scrollAreaProps}
         />
```

**File**: `packages/@mantine/core/src/components/Select/Select.test.tsx` (modified, +34/-0)
```diff
@@ -515,4 +515,38 @@ describe('@mantine/core/Select', () => {
       expect(getHiddenInput()).toHaveValue('');
     });
   });
+
+  it('links listbox to the rendered label with aria-labelledby', () => {
+    const { rerender } = render(
+      <Select label="Test label" data={['test-1', 'test-2']} dropdownOpened />
+    );
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+
+    rerender(
+      <>
+        <Select
+          label="Test label"
+          labelProps={{ id: 'custom-label-id' }}
+          data={['test-1', 'test-2']}
+          dropdownOpened
+        />
+      </>
+    );
+    expect(screen.getByRole('listbox')).toHaveAttribute('aria-labelledby', 'custom-label-id');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+  });
+
+  it('does not reference label in aria-labelledby when label is excluded from inputWrapperOrder', () => {
+    render(
+      <Select
+        label="Test label"
+        aria-label="Test aria-label"
+        inputWrapperOrder={['input']}
+        data={['test-1', 'test-2']}
+        dropdownOpened
+      />
+    );
+    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-labelledby');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test aria-label');
+  });
 });
```

**File**: `packages/@mantine/core/src/components/Select/Select.tsx` (modified, +9/-2)
```diff
@@ -23,6 +23,7 @@ import {
   OptionsFilter,
   useCombobox,
 } from '../Combobox';
+import { getComboboxLabelId } from '../Combobox/get-combobox-label-id/get-combobox-label-id';
 import { getOptionByLabel } from '../Combobox/get-options-lockup/get-option-by-label';
 import { isExternalInputChange } from '../Combobox/is-external-input-change/is-external-input-change';
 import {
@@ -194,6 +195,12 @@ export const Select = genericFactory<SelectFactory>((_props) => {
   const retainedSelectedOptions = useRef<Record<string, ComboboxItem<Primitive>>>({});
   const optionsLockup = useMemo(() => getOptionsLockup(parsedData), [parsedData]);
   const _id = useId(id);
+  const comboboxLabelId = getComboboxLabelId({
+    id: _id,
+    label: others.label,
+    labelProps: others.labelProps,
+    inputWrapperOrder: others.inputWrapperOrder,
+  });
 
   const [_value, setValue, controlled] = useUncontrolled({
     value,
@@ -419,8 +426,8 @@ export const Select = genericFactory<SelectFactory>((_props) => {
           withAlignedLabels={withAlignedLabels}
           nothingFoundMessage={nothingFoundMessage}
           unstyled={unstyled}
-          labelId={others.label ? `${_id}-label` : undefined}
-          aria-label={others.label ? undefined : others['aria-label']}
+          labelId={comboboxLabelId}
+          aria-label={comboboxLabelId ? undefined : others['aria-label']}
           renderOption={renderOption}
           scrollAreaProps={scrollAreaProps}
         />
```

**File**: `packages/@mantine/core/src/components/TagsInput/TagsInput.test.tsx` (modified, +34/-0)
```diff
@@ -452,4 +452,38 @@ describe('@mantine/core/TagsInput', () => {
       expect(document.querySelector('input[name="test"]')).toHaveValue('new-tag');
     });
   });
+
+  it('links listbox to the rendered label with aria-labelledby', () => {
+    const { rerender } = render(
+      <TagsInput label="Test label" data={['test-1', 'test-2']} dropdownOpened />
+    );
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+
+    rerender(
+      <>
+        <TagsInput
+          label="Test label"
+          labelProps={{ id: 'custom-label-id' }}
+          data={['test-1', 'test-2']}
+          dropdownOpened
+        />
+      </>
+    );
+    expect(screen.getByRole('listbox')).toHaveAttribute('aria-labelledby', 'custom-label-id');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test label');
+  });
+
+  it('does not reference label in aria-labelledby when label is excluded from inputWrapperOrder', () => {
+    render(
+      <TagsInput
+        label="Test label"
+        aria-label="Test aria-label"
+        inputWrapperOrder={['input']}
+        data={['test-1', 'test-2']}
+        dropdownOpened
+      />
+    );
+    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-labelledby');
+    expect(screen.getByRole('listbox')).toHaveAccessibleName('Test aria-label');
+  });
 });
```

---

### Incident Patch 12: `f61997eb` (2026-10-06)
**Commit Message**: [@mantine/hooks] use-debounced-state: Fix leading edge firing only once (#9214)

**File**: `packages/@mantine/hooks/src/use-debounced-state/use-debounced-state.test.ts` (modified, +28/-0)
```diff
@@ -73,4 +73,32 @@ describe('use-debounced-state', () => {
     act(() => hook.unmount());
     expect(clearTimeout).toHaveBeenCalledTimes(1);
   });
+
+  it('should treat a call made after wait as leading with leading=true', () => {
+    timeoutCallback = () => {};
+
+    const hook = renderHook(() => useDebouncedState('test1', 100, { leading: true }));
+
+    act(() => hook.result.current[1]('test2'));
+    expect(hook.result.current[0]).toEqual('test2');
+
+    act(() => timeoutCallback());
+    expect(hook.result.current[0]).toEqual('test2');
+
+    act(() => hook.result.current[1]('test3'));
+    expect(hook.result.current[0]).toEqual('test3');
+  });
+
+  it('should not reapply the leading value when wait elapses with leading=true', () => {
+    timeoutCallback = () => {};
+
+    const hook = renderHook(() => useDebouncedState('test', 100, { leading: true }));
+
+    act(() => hook.result.current[1]((prev) => `${prev}0`));
+    expect(hook.result.current[0]).toEqual('test0');
+    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
+
+    act(() => timeoutCallback());
+    expect(hook.result.current[0]).toEqual('test0');
+  });
 });
```

**File**: `packages/@mantine/hooks/src/use-debounced-state/use-debounced-state.ts` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ export function useDebouncedState<T = any>(
       clearTimeout();
       if (leadingRef.current && options.leading) {
         setValue(newValue);
+        timeoutRef.current = window.setTimeout(() => {
+          leadingRef.current = true;
+        }, wait);
       } else {
         timeoutRef.current = window.setTimeout(() => {
           leadingRef.current = true;
```

---

### Incident Patch 13: `dd47810b` (2026-10-06)
**Commit Message**: [refactor] Fix warnings in tests

**File**: `packages/@mantine/core/src/components/HoverCard/HoverCard.test.tsx` (modified, +4/-2)
```diff
@@ -295,8 +295,10 @@ describe('@mantine/core/HoverCard', () => {
     expect(screen.queryByText('test-dropdown')).not.toBeInTheDocument();
   });
 
-  it('does not close dropdown on outside press if closeOnClickOutside is false', () => {
-    render(<TestContainer initiallyOpened closeOnClickOutside={false} events={{ focus: false }} />);
+  it('does not close dropdown on outside press if closeOnClickOutside is false', async () => {
+    await renderWithAct(
+      <TestContainer initiallyOpened closeOnClickOutside={false} events={{ focus: false }} />
+    );
     fireEvent.pointerDown(document.body);
     expect(screen.getByText('test-dropdown')).toBeInTheDocument();
   });
```

---

### Incident Patch 14: `0ef32d9f` (2026-10-04)
**Commit Message**: [mantine.dev] Fix Corepack install instructions in contributing guide

**File**: `apps/mantine.dev/src/pages/contribute.mdx` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ First of all, thank you for showing interest in contributing to Mantine! All you
 - Install the [editorconfig](https://editorconfig.org/) extension for your editor.
 - Fork the [repository](https://github.com/mantinedev/mantine), then clone or download your fork.
 - Run `nvm use` to switch to the Node version specified in `.nvmrc` file ([install nvm](https://github.com/nvm-sh/nvm)).
-- Run `corepack enable` to use the Yarn version specified in `package.json` ([Corepack](https://github.com/nodejs/corepack) is included with Node.js).
+- Install [Corepack](https://github.com/nodejs/corepack) and enable it to use the Yarn version specified in `package.json` – `npm install -g corepack && corepack enable`
 - Install dependencies with yarn – `yarn`
 - Setup project – `npm run setup`
 - Build local version of all packages – `npm run build`
```

---

### Incident Patch 15: `fdbec691` (2026-10-04)
**Commit Message**: [mantine.dev] Add Corepack setup step to contributing guide

**File**: `apps/mantine.dev/src/pages/contribute.mdx` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ First of all, thank you for showing interest in contributing to Mantine! All you
 - Install the [editorconfig](https://editorconfig.org/) extension for your editor.
 - Fork the [repository](https://github.com/mantinedev/mantine), then clone or download your fork.
 - Run `nvm use` to switch to the Node version specified in `.nvmrc` file ([install nvm](https://github.com/nvm-sh/nvm)).
+- Run `corepack enable` to use the Yarn version specified in `package.json` ([Corepack](https://github.com/nodejs/corepack) is included with Node.js).
 - Install dependencies with yarn – `yarn`
 - Setup project – `npm run setup`
 - Build local version of all packages – `npm run build`
```

#### Recent Merged Pull Requests:
- **PR #9255** (2026-10-06): [@mantine/schedule] Fix startScrollTime scroll position (@balzdur)
- **PR #9254** (2026-10-06): [core] Apply rem scaling to per-component CSS (@minwookshin)
- **PR #9251** (2026-10-06): [@mantine/core] RollingNumber: Fix sub-pixel digit misalignment at fractional zoom levels (@rajat12826)
- **PR #9250** (2026-10-06): [core] Restore per-component Storybook filter for Storybook 10 (@arishgithub)
- **PR #9248** (2026-10-04): 9.7 (@rtivital)
- **PR #9247** (2026-10-06): [@mantine/core] Tree: Add aria-expanded to tree items with children (@lavinhoque33)
- **PR #9245** (2026-10-06): [@mantine/core] SegmentedControl: Do not call Math.random during render (@joaomlneto)
- **PR #9243** (2026-10-06): [@mantine/core] Popover: Add capture prop to control events capturing phase (@StepanSnigur)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
