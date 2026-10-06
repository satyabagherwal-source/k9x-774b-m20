# Forensic Learning Record (Deep Inspection): cloudscape-design/components

> **Canonical Artifact**: `07_PROJECT_LEARNING/cloudscape-design-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cloudscape-design/components](https://github.com/cloudscape-design/components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:21:37.878Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cloudscape-design/components`
- **Description**: React components for Cloudscape Design System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2654 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pages/anchor-navigation/utils.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from 'react';

export const navigateToItem = (id: string) => {
  if (id) {
    const el = document.getElementById(id.slice(1));
    el?.scrollIntoView();
  }
};

export const TextSample = () => (
  <p>
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum sit amet arcu dapibus, pellentesque ipsum eget,
    cursus tellus. Mauris porta maximus dolor eget gravida. Curabitur pulvinar neque sed lectus commodo, nec efficitur
    orci pretium. Phasellus ultrices lorem non turpis egestas, a tincidunt turpis lobortis. Nulla a est quis eros tempus
    consectetur. Vivamus ultricies pharetra porta. Etiam id rutrum neque. Praesent sagittis ipsum in lorem pretium, ut
    auctor nulla consectetur. Quisque aliquam sollicitudin consectetur. Orci varius natoque penatibus et magnis dis
    parturient montes, nascetur ridiculus mus. Vivamus quam risus, iaculis eget arcu eu, porttitor blandit est. Cras
    quam ligula, efficitur vitae pulvinar vitae, luctus eget velit. Proin mattis sed purus sit amet gravida. Donec nec
    hendrerit nibh, eu dapibus sapien. Aenean sollicitudin ante quis vestibulum eleifend. Praesent quis porta lectus.
    Phasellus in nunc commodo, convallis ante eu, efficitur purus. Fusce vitae accumsan justo, sit amet pellentesque
    elit. Mauris rhoncus eros in pulvinar semper. Sed luctus, dui sit amet ultricies vulputate, mauris orci ullamcorper
    ipsum, in fermentum arcu turpis eget neque. Maecenas in arcu sit amet est tempor tincidunt quis vitae nibh.
    Vestibulum id blandit tortor. Nulla sed pharetra purus, at imperdiet magna. Suspendisse venenatis, lacus at sodales
    volutpat, diam dui dictum lacus, a ultricies neque lorem id sapien. Vestibulum viverra aliquet dolor, eu
    sollicitudin enim dapibus non. Pellentesque quis augue egestas nibh tempor ornare. Vivamus posuere tincidunt ipsum
    eu hendrerit. Aliquam ante dolor, pulvinar at dapibus vitae, efficitur ut elit. Vivamus nisi est, tincidunt sit amet
    congue quis, ultrices dictum risus. Curabitur mollis at enim vitae rutrum. Class aptent taciti sociosqu ad litora
    torquent per conubia nostra, per inceptos himenaeos. Donec dictum felis ac tortor dignissim, quis aliquam quam
    sagittis. Sed lacinia molestie risus, id elementum nibh posuere sed. Suspendisse ante odio, euismod vel mauris id,
    pellentesque rhoncus massa. Vivamus ultrices erat eros, non eleifend dolor tempor a. Fusce placerat vehicula nulla
    et tempor. Sed scelerisque ipsum id lorem suscipit faucibus. Sed suscipit tortor lectus, et dignissim elit dignissim
    ut. Nunc dictum ex quis condimentum lobortis. Morbi non aliquet metus, eu congue est. Suspendisse volutpat dui sit
    amet nulla semper, a aliquet sem rhoncus. Mauris eu magna elementum augue luctus pellentesque. Vivamus risus lectus,
    mattis nec aliquam a, tincidunt eu erat. Duis volutpat eu tellus quis euismod. Fusce congue justo ut leo sodales
    volutpat. Nullam elit magna, ultricies in fermentum sed, semper ac lorem. Sed odio odio, fermentum nec fringilla at,
    ullamcorper in ipsum. Pellentesque a magna lorem. Donec eu sapien tincidunt, fringilla leo sit amet, consequat leo.
    Suspendisse iaculis ipsum et quam vehicula, ac rutrum purus gravida. Curabitur non commodo sem. Proin accumsan, orci
    non porttitor pharetra, tortor augue commodo tellus, in pharetra ante mi non mi. Morbi eget malesuada lorem. Mauris
    erat est, hendrerit sed sem non, ornare ultrices dolor. Sed nec eros ac leo auctor tincidunt. Vestibulum euismod
    ante sed blandit interdum. Donec aliquam libero eu mi posuere tempor. Vestibulum non nunc ut augue malesuada
    tincidunt. Cras sit amet dui placerat, blandit odio eget, vehicula erat. Cras turpis diam, pharetra vel malesuada
    eu, rutrum ut magna. Donec eget turpis quis dui pellentesque commodo id sit amet nisl. Integer sit amet iaculis
    turpis. Aenean vitae porta nulla. Mauris vitae ligula sit amet diam molestie mattis. Aliquam venenatis eget dolor eu
    aliquet. Sed interdum rutrum risus eget dignissim. Nunc porttitor faucibus dignissim. Orci varius natoque penatibus
    et magnis dis parturient montes, nascetur ridiculus mus. Nullam scelerisque eu velit ac lobortis. Mauris finibus, ex
    a auctor auctor, orci massa dapibus dolor, ac varius orci ex fermentum mauris. Ut imperdiet bibendum eros, non
    fringilla mauris porttitor nec. Nunc eleifend felis nunc, vel pellentesque nunc mattis nec. Morbi in maximus lectus,
    quis dictum leo. Aliquam sollicitudin est felis, nec tristique mauris molestie vel. Quisque vel est at lectus
    egestas scelerisque tincidunt id lectus. Nam sed ullamcorper mauris, sed lobortis lacus. Ut venenatis nisl lorem,
    vel viverra ipsum scelerisque ut. Aliquam vitae consequat justo, sit amet tristique arcu. Donec tempus auctor velit,
    quis elementum velit ultricies non. Morbi semper eu neque sed ultricies. Pellentesque congue quam vel varius
    interdum. Suspendisse potenti. Suspendisse vel tortor non libero dapibus egestas commodo sit amet nisl. Sed velit
    nulla, finibus vel porttitor vitae, hendrerit sit amet magna. Cras massa nulla, euismod at fringilla quis, ornare
    varius libero. Nunc in ante in nibh hendrerit cursus ac ut turpis. Maecenas vitae odio sed quam suscipit convallis
    vel et urna. Maecenas metus velit, dapibus nec aliquam vel, bibendum eget eros. Integer dignissim, sapien in
    imperdiet consequat, eros risus rhoncus enim, ac sollicitudin velit eros ac nunc. Sed ut dolor in nulla iaculis
    pretium. Curabitur ligula turpis, sollicitudin nec turpis eget, cursus varius turpis. Donec risus odio, varius in
    egestas ut, cursus viverra purus. Cras vitae nisi vulputate, consectetur ante non, egestas urna. Suspendisse
    tristique ante arcu, porttitor ultrices tellus laoreet sit amet. Vestibulum neque turpis, posuere sed cursus quis,
    maximus ac neque. Sed ac dui scelerisque, luctus sapien id, faucibus nibh. Aliquam eu metus pellentesque, rutrum ex
    vel, ornare sapien. Nullam eleifend leo vel magna maximus congue. Etiam a purus quis est porttitor scelerisque sed
    eu dolor. Nam at auctor nisl. Ut blandit blandit mauris, in aliquet felis. Praesent vitae leo laoreet, congue dolor
    sit amet, maximus magna. Duis aliquam mollis eros, ut ultricies augue dignissim sit amet. Nulla rutrum, nisi sed
    varius tincidunt, lacus ligula gravida leo, ut sollicitudin ante eros vitae erat. Quisque laoreet sodales enim sit
    amet tempor. Proin auctor mollis urna ac condimentum. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla
    eget ipsum fringilla, dapibus ex vitae, egestas diam. Mauris tempus sollicitudin semper. Aenean in massa vel lorem
    varius tincidunt. Vivamus hendrerit venenatis tempor. Orci varius natoque penatibus et magnis dis parturient montes,
    nascetur ridiculus mus. Cras suscipit est ut pulvinar malesuada. Aenean facilisis ipsum vitae neque tincidunt, eu
    faucibus diam placerat. In ullamcorper ante urna, vitae auctor tellus placerat non. Donec augue nibh, accumsan eget
    fringilla a, sodales ac elit. Curabitur eros massa, ullamcorper nec neque ut, venenatis eleifend tellus.
    Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Fusce non blandit mi.
    Maecenas lacinia nulla quis lobortis convallis. Vestibulum commodo, dui et porta interdum, lacus ipsum hendrerit
    risus, sed pellentesque tellus magna non justo. Sed vel ex quis quam luctus pellentesque. Cras euismod, nisl nec
    lacinia luctus, lectus turpis auctor risus, dictum varius sapien elit eu mi. Etiam sit amet libero velit.
    Suspendisse dignissim ligula elit, eget viverra diam suscipit a. Aenean ac odio sed tellus mattis hendrerit.
    Phasellus metus tellus, pellentesque a efficitur id, sollicitudin vel ipsum. Integer ultricies nisl metus, nec
    consequat tortor iaculis a. Fusce interdum ut augue eu molestie. Nunc eu congue mi. Nullam scelerisque, nisi eget
    ullamcorper lacinia, enim eros cursus arcu, gravida rhoncus dui augue id eros. Sed euismod lacus eget mauris
    tincidunt, sit amet finibus risus rhoncus. Donec sed hendrerit felis. Aliquam metus diam, congue eu porttitor id,
    gravida in libero. Aliquam convallis tempor ultrices. Praesent eleifend ultricies felis vitae ullamcorper. Nam eu
    nisi odio. Morbi a urna ut felis pulvinar dapibus. Proin varius varius augue et sollicitudin. Nulla augue nisl,
    euismod sit amet lobortis ut, pharetra vitae sem. Mauris luctus viverra felis, non consectetur leo. Suspendisse
    potenti. Pellentesque fermentum et eros sit amet tincidunt. Aliquam quis vulputate justo, eget rhoncus turpis.
    Phasellus luctus lacus id nisl vulputate malesuada. Cras aliquet, mauris non convallis lacinia, turpis est eleifend
    ipsum, quis rutrum risus turpis eget metus. Quisque finibus ut erat sit amet mollis. Donec purus magna, vehicula
    eget ultricies nec, rutrum eu dui. Vestibulum enim justo, bibendum nec auctor eget, tempor ac augue. Donec nec nulla
    sed diam auctor tempor eu quis diam. Curabitur vitae congue tortor. Duis consectetur sem quis mattis convallis.
    Etiam dapibus metus eu dui luctus egestas. Nam aliquam, metus eu faucibus mollis, eros magna congue quam, nec
    hendrerit nunc risus ac est. Pellentesque a velit a leo porttitor tristique a eu enim. Curabitur varius, sapien non
    mattis pretium, tellus nisl vestibulum lectus, sed auctor justo leo ut leo. Ut volutpat, nisi eget feugiat finibus,
    odio ex vestibulum nisi, eu gravida dui erat elementum erat. Donec sed est a odio cursus ultricies. Pellentesque sed
    dolor vulputate, tristique ex at, luctus lacus. Etiam cursus finibus dui eget ultricies. Etiam feugiat feugiat
    purus, sed malesuada nibh scelerisque sit amet. Ut consectetur enim metus, non cursus massa rutrum at. Etiam purus
    leo, placerat et dol
```

### Core Architecture Module: `pages/app-layout/runtime-drawers-persist-open-state.page.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useState } from 'react';

import AppLayout from '~components/app-layout';
import Header from '~components/header';
import HelpPanel from '~components/help-panel';
import awsuiPlugins from '~components/internal/plugins';
import { mount, unmount } from '~mount';

import { Breadcrumbs, Counter } from './utils/content-blocks';
import appLayoutLabels from './utils/labels';

awsuiPlugins.appLayout.registerDrawer({
  id: 'runtime-drawer-persist-open-state',
  type: 'global',

  trigger: {
    iconSvg: `<svg viewBox="0 0 16 16" focusable="false">
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="7" />
      <rect fill="currentColor" x="5" y="5" width="6" height="6" />
    </svg>`,
  },

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Content',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
  },

  mountContent: (container, { onVisibilityChange }) => {
    awsuiPlugins.appLayout.updateDrawer({ id: 'runtime-drawer-persist-open-state', defaultActive: true });
    onVisibilityChange(isVisible => {
      awsuiPlugins.appLayout.updateDrawer({ id: 'runtime-drawer-persist-open-state', defaultActive: isVisible });
    });
    mount(<Counter id="runtime-drawer-persist-open-state" />, container);
  },
  unmountContent: container => {
    unmount(container);
  },
});

export default function () {
  const [key, setKey] = useState(0);
  return (
    <AppLayout
      key={key}
      ariaLabels={appLayoutLabels}
      breadcrumbs={<Breadcrumbs />}
      content={
        <>
          <Header variant="h1" description="This drawer can automatically reopen after app layout instance changes">
            Drawer with state persistence
          </Header>
          <button data-testid="remount-app-layout" onClick={() => setKey(key => key + 1)}>
            Remount app layout
          </button>
        </>
      }
      tools={<HelpPanel header={<h2>Info</h2>}>Here is some info for you</HelpPanel>}
    />
  );
}

```

### Core Architecture Module: `pages/app-layout/stateful.page.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from 'react';

import AppLayout from '~components/app-layout';
import Header from '~components/header';

import { Counter } from './utils/content-blocks';
import labels from './utils/labels';

export default function AppLayoutStatefulDemo() {
  return (
    <AppLayout
      ariaLabels={labels}
      breadcrumbs={
        <nav aria-label="Breadcrumbs">
          <Counter id="breadcrumbs" />
        </nav>
      }
      navigation={<Counter id="navigation" />}
      tools={<Counter id="tools" />}
      content={
        <>
          <div style={{ marginBlockEnd: '1rem' }}>
            <Header variant="h1" description="Basic demo">
              Stateful components demo
            </Header>
          </div>
          <Counter id="content" />
        </>
      }
    />
  );
}

```

### Core Architecture Module: `pages/app-layout/utils/content-blocks.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useState } from 'react';
import clsx from 'clsx';
import range from 'lodash/range';

import { getIsRtl } from '@cloudscape-design/component-toolkit/internal';

import { Box } from '~components';
import BreadcrumbGroup from '~components/breadcrumb-group';
import Button from '~components/button';
import Container from '~components/container';
import Flashbar, { FlashbarProps } from '~components/flashbar';
import Header from '~components/header';
import HelpPanel from '~components/help-panel';
import SideNavigation from '~components/side-navigation';
import SpaceBetween from '~components/space-between';
import TextContent from '~components/text-content';

import styles from '../styles.scss';

export function Breadcrumbs() {
  return (
    <BreadcrumbGroup
      items={[
        { text: 'Home', href: '#' },
        { text: 'Service', href: '#' },
      ]}
    />
  );
}

export function Containers() {
  const [count, setCount] = useState(2);
  return (
    <SpaceBetween size="l">
      {range(count).map(i => (
        <Container
          key={i}
          header={
            <Header variant="h2" actions={<Button onClick={() => setCount(count - 1)}>Remove</Button>}>
              Demo container #{i + 1}
            </Header>
          }
        >
          <div className={styles.contentPlaceholder} />
        </Container>
      ))}
      <Button onClick={() => setCount(count + 1)}>Add container</Button>
    </SpaceBetween>
  );
}

export function Tools({ children }: { children: React.ReactNode }) {
  return <HelpPanel header={<h2>Overview</h2>}>{children}</HelpPanel>;
}

export function Navigation() {
  return (
    <SideNavigation
      header={{
        href: '#',
        text: 'Service name',
      }}
      items={range(30).map(i => ({ type: 'link', text: `Navigation #${i + 1}`, href: `#item-${i}` }))}
    />
  );
}

export function Notifications() {
  const [visible, setVisible] = useState(true);
  const demoNotification: FlashbarProps.MessageDefinition = {
    type: 'success',
    header: 'Success message',
    statusIconAriaLabel: 'success',
    dismissLabel: 'Dismiss notification',
    dismissible: true,
    onDismiss: () => setVisible(false),
  };
  return <Flashbar items={visible ? [demoNotification] : []} />;
}

export function Footer({ legacyConsoleNav }: { legacyConsoleNav: boolean }) {
  return (
    <>
      <footer id="f" className={clsx(styles.footer, legacyConsoleNav && styles.legacyNav)}>
        © 2008 - 2020, Amazon Web Services, Inc. or its affiliates. All rights reserved
      </footer>
    </>
  );
}

export function ScrollableDrawerContent({ contentType = 'text' }: { contentType?: 'text' | 'image' }) {
  return contentType === 'image' ? (
    <SpaceBetween size="l">
      <div className={styles.contentPlaceholder} />
      <div className={styles.contentPlaceholder} />
      <div className={styles.contentPlaceholder} />
    </SpaceBetween>
  ) : (
    <TextContent>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
        magna aliqua. Augue neque gravida in fermentum. Suspendisse sed nisi lacus sed viverra tellus in hac. Nec
        sagittis aliquam malesuada bibendum arcu vitae elementum. Lectus proin nibh nisl condimentum id venenatis.
        Penatibus et magnis dis parturient montes nascetur ridiculus mus mauris. Nisi porta lorem mollis aliquam ut
        porttitor leo a. Facilisi morbi tempus iaculis urna. Odio tempor orci dapibus ultrices in iaculis nunc.
      </p>
      <div data-testid="scroll-me">The end</div>
      <p>
        Ut diam quam nulla porttitor massa id neque. Duis at tellus at urna condimentum mattis pellentesque id nibh.
        Metus vulputate eu scelerisque felis imperdiet proin fermentum.
      </p>
      <h3>Another h3</h3>
      <p>
        Orci porta non pulvinar neque laoreet suspendisse interdum consectetur libero. Varius quam quisque id diam vel.
        Risus viverra adipiscing at in. Orci sagittis eu volutpat odio facilisis mauris. Mauris vitae ultricies leo
        integer malesuada nunc. Sem et tortor consequat id porta nibh. Semper auctor neque vitae tempus quam
        pellentesque.
      </p>
      <p>Ante in nibh mauris cursus mattis molestie.</p>
      <p>
        Pharetra et ultrices neque ornare. Bibendum neque egestas congue quisque egestas diam in arcu cursus. Porttitor
        eget dolor morbi non arcu risus quis. Integer quis auctor elit sed vulputate mi sit. Mauris nunc congue nisi
        vitae suscipit tellus mauris a diam. Diam donec adipiscing tristique risus nec feugiat in. Arcu felis bibendum
        ut tristique et egestas quis. Nulla porttitor massa id neque aliquam vestibulum morbi blandit. In hac habitasse
        platea dictumst quisque sagittis. Sollicitudin tempor id eu nisl nunc mi ipsum. Ornare aenean euismod elementum
        nisi quis. Elementum curabitur vitae nunc sed velit dignissim sodales. Amet tellus cras adipiscing enim eu. Id
        interdum velit laoreet id donec ultrices tincidunt. Ullamcorper eget nulla facilisi etiam. Sodales neque sodales
        ut etiam sit amet nisl purus. Auctor urna nunc id cursus metus aliquam eleifend mi in. Urna condimentum mattis
        pellentesque id. Porta lorem mollis aliquam ut porttitor leo a. Lectus quam id leo in vitae turpis massa sed.
        Pharetra pharetra massa massa ultricies mi.
      </p>
    </TextContent>
  );
}

export function ContentFill() {
  return (
    <div style={{ minBlockSize: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          insetBlockStart: '50%',
          insetInlineStart: '50%',
          transform: getIsRtl(document.body) ? 'translate(50%, -50%)' : 'translate(-50%, -50%)',
        }}
      >
        <Box fontSize="heading-m">
          In Visual Refresh, there should be a cross exactly in each corner of <br />
          the content area, without any scrollbars.
        </Box>
      </div>
      <CornerMarker insetBlockStart={0} insetInlineStart={0} />
      <CornerMarker insetBlockEnd={0} insetInlineStart={0} />
      <CornerMarker insetBlockStart={0} insetInlineEnd={0} />
      <CornerMarker insetBlockEnd={0} insetInlineEnd={0} />
    </div>
  );
}

function CornerMarker(props: {
  insetBlockStart?: number;
  insetInlineEnd?: number;
  insetInlineStart?: number;
  insetBlockEnd?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 10 10"
      style={{ inlineSize: '50px', blockSize: '50px', position: 'absolute', ...props }}
      focusable="false"
    >
      <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
      <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function CustomDrawerContent() {
  return (
    <div className={styles['custom-drawer-wrapper']}>
      <div className={styles['drawer-sticky-header']} data-testid="drawer-sticky-header">
        <Box variant="h3" tagOverride="h2" padding="n">
          <span id="custom-drawer-heading">Sticky header</span>
        </Box>
      </div>
      <div
        className={styles['drawer-scrollable-content']}
        role="region"
        aria-labelledby="custom-drawer-heading"
        tabIndex={0}
      >
        <ScrollableDrawerContent />
      </div>
      <div className={styles['drawer-sticky-footer']} data-testid="drawer-sticky-footer">
        <p>This is a sticky footer, it should always be visisble when the panel is open.</p>
      </div>
    </div>
  );
}

export function Counter({ id }: { id: string }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span id={`${id}-text`}>Clicked: {count}</span>
      <button id={`${id}-button`} onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}

```

### Core Architecture Module: `pages/app-layout/utils/contents.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from 'react';

import { Box, ButtonGroup, Link, SpaceBetween } from '~components';
import Icon from '~components/icon';
import PromptInput from '~components/prompt-input';

export const longContent = (
  <>
    <span>
      Content: When you want to use CloudFront to distribute your content, you create a distribution and choose the
      configuration settings you want. For example:
    </span>
    <ul>
      <li>
        Your content origin—that is, the Amazon S3 bucket, MediaPackage channel, or HTTP server from which CloudFront
        gets the files to distribute. You can specify any combination of up to 25 Amazon S3 buckets, channels, and/or
        HTTP servers as your origins.
      </li>
      <li>
        Your content origin—that is, the Amazon S3 bucket, MediaPackage channel, or HTTP server from which CloudFront
        gets the files to distribute. You can specify any combination of up to 25 Amazon S3 buckets, channels, and/or
        HTTP servers as your origins.
      </li>
      <li>
        Your content origin—that is, the Amazon S3 bucket, MediaPackage channel, or HTTP server from which CloudFront
        gets the files to distribute. You can specify any combination of up to 25 Amazon S3 buckets, channels, and/or
        HTTP servers as your origins.
      </li>
      <li>Access—whether you want the files to be available to everyone or restrict access to some users.</li>
      <li>Security—whether you want CloudFront to require users to use HTTPS to access your content.</li>
      <li>
        Cookie or query-string forwarding—whether you want CloudFront to forward cookies or query strings to your
        origin.
      </li>
      <li>
        Geo-restrictions—whether you want CloudFront to prevent users in selected countries from accessing your content.
      </li>
      <li>Access logs—whether you want CloudFront to create access logs that show viewer activity.</li>
    </ul>
    <h3>
      Learn more <Icon name="external" />
    </h3>
    <ul>
      <li>
        <a
          href="https://docs.aws.amazon.com/en_pv/AmazonCloudFront/latest/DeveloperGuide/distribution-overview.html"
          rel="noopener noreferrer"
          target="_blank"
        >
          Overview of Distributions
        </a>
      </li>
    </ul>
  </>
);

export const shortContent = (
  <span>
    Content: You can configure CloudFront to return a specific object (the default root object) when a user requests the
    root URL for your web distribution instead of requesting an object in your distribution. Specifying a default root
    object lets you avoid exposing the contents of your distribution or returning an error.
  </span>
);

export const longHeader = <h2>Header: Lorem nesciunt praesentium voluptatem, molestias aliquid animi aspernatur!</h2>;

export const shortHeader = <h2>Header: Lorem nesciunt!</h2>;

export const longFooter = (
  <span>
    <SpaceBetween size="xs">
      <PromptInput
        value="Hey there, can you help me write some integration tests."
        disableSecondaryActionsPaddings={true}
        actionButtonAriaLabel={'Need Help?'}
        actionButtonIconName={'stop-circle'}
        maxRows={3}
        secondaryActions={
          <Box padding={{ left: 'xxs', top: 'xs' }}>
            <ButtonGroup
              ariaLabel="Additional chat input actions"
              items={[
                {
                  type: 'icon-button',
                  id: 'upload-files',
                  iconName: 'upload',
                  text: 'Upload files',
                },
                {
                  type: 'icon-button',
                  id: 'add-reference',
                  iconName: 'at-symbol',
                  text: 'Add reference or citation',
                },
              ]}
              variant="icon"
            />
          </Box>
        }
      />
      <Box fontSize="body-s" color="text-body-secondary">
        Use of this service is subject to the{' '}
        <Link external={true} variant="primary" href="https://aws.amazon.com/machine-learning/responsible-ai/policy/">
          AWS Responsible AI Policy
        </Link>
      </Box>
    </SpaceBetween>
  </span>
);

export const shortFooter = <span>Footer: Lorem nesciuntnatur!</span>;

```

### Core Architecture Module: `pages/app-layout/utils/drawer-ids.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
export const drawerIds = {
  security: 'security',
  proHelp: 'pro-help',
  links: 'links',
  test1: 'test-1',
  test2: 'test-2',
  test3: 'test-3',
  test4: 'test-4',
  test5: 'test-5',
  test6: 'test-6',
};

```

### Core Architecture Module: `pages/app-layout/utils/drawers.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from 'react';

import { AppLayoutProps, Box, Drawer, SpaceBetween } from '~components';

import { drawerIds } from './drawer-ids';

import styles from '../styles.scss';

const getAriaLabels = (title: string, badge: boolean) => {
  return {
    closeButton: `${title} close button`,
    drawerName: `${title}`,
    triggerButton: `${title} trigger button${badge ? ' (Unread notifications)' : ''}`,
    resizeHandle: `${title} resize handle`,
    resizeHandleTooltipText: 'Drag or select to resize',
  };
};

function Security() {
  return (
    <Drawer header={<h2>Security</h2>}>
      <SpaceBetween size="l">
        <div className={styles.contentPlaceholder} />
        <div className={styles.contentPlaceholder} />
        <div className={styles.contentPlaceholder} />
        <Box float="right">
          <button data-testid="drawer-button">🦆</button>
        </Box>
      </SpaceBetween>
    </Drawer>
  );
}

export const drawerItems: Array<AppLayoutProps.Drawer> = [
  {
    ariaLabels: getAriaLabels('Security', false),
    content: <Security />,
    id: drawerIds.security,
    resizable: true,
    onResize: (event: any) => {
      // A drawer implementer may choose to listen to THEIR drawer's
      // resize event,should they want to persist, or otherwise respond
      // to their drawer being resized.
      console.log('Security Drawer is now: ', event.detail.size);
    },
    trigger: {
      iconName: 'security',
    },
  },
  {
    ariaLabels: getAriaLabels('Pro help', true),
    content: <Drawer header={<h2>Pro help</h2>}>Pro help.</Drawer>,
    badge: true,
    defaultSize: 600,
    id: drawerIds.proHelp,
    trigger: {
      iconName: 'contact',
    },
  },
  {
    ariaLabels: getAriaLabels('Links', false),
    resizable: true,
    defaultSize: 500,
    content: <Drawer header={<h2>Links</h2>}>Links.</Drawer>,
    id: drawerIds.links,
    trigger: {
      iconName: 'share',
    },
  },
  {
    ariaLabels: getAriaLabels('Test 1', true),
    content: <Drawer header={<h2>Test 1</h2>}>Test 1.</Drawer>,
    badge: true,
    id: drawerIds.test1,
    trigger: {
      iconName: 'contact',
    },
  },
  {
    ariaLabels: getAriaLabels('Test 2', false),
    resizable: true,
    defaultSize: 500,
    content: <Drawer header={<h2>Test 2</h2>}>Test 2.</Drawer>,
    id: drawerIds.test2,
    trigger: {
      iconName: 'share',
    },
  },
  {
    ariaLabels: getAriaLabels('Test 3', true),
    content: <Drawer header={<h2>Test 3</h2>}>Test 3.</Drawer>,
    badge: true,
    id: drawerIds.test3,
    trigger: {
      iconName: 'contact',
    },
  },
  {
    ariaLabels: getAriaLabels('Test 4', false),
    resizable: true,
    defaultSize: 500,
    content: <Drawer header={<h2>Test 4</h2>}>Test 4.</Drawer>,
    id: drawerIds.test4,
    trigger: {
      iconName: 'edit',
    },
  },
  {
    ariaLabels: getAriaLabels('Test 5', false),
    resizable: true,
    defaultSize: 500,
    content: <Drawer header={<h2>Test 5</h2>}>Test 5.</Drawer>,
    id: drawerIds.test5,
    trigger: {
      iconName: 'add-plus',
    },
  },
  {
    ariaLabels: getAriaLabels('Test 6', false),
    resizable: true,
    defaultSize: 500,
    content: <Drawer header={<h2>Test 6</h2>}>Test 6.</Drawer>,
    id: drawerIds.test6,
    trigger: {
      iconName: 'call',
    },
  },
];

export const drawerLabels = {
  drawers: 'Drawers',
  drawersOverflow: 'Drawers overflow',
  drawersOverflowWithBadge: 'Drawers overflow with badge',
};

```

### Core Architecture Module: `pages/app-layout/utils/external-global-left-panel-widget.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useState } from 'react';

import { Box, Button, PanelLayout } from '~components';
import { registerLeftDrawer, updateDrawer } from '~components/internal/plugins/widget';
import { DrawerPayload } from '~components/internal/plugins/widget/interfaces';
import { mount, unmount } from '~mount';

import styles from '../styles.scss';

const DEFAULT_SIZE = 360;
const CHAT_SIZE = 280;
const MIN_CHAT_SIZE = 150;
const MIN_ARTIFACT_SIZE = 360;

const AIDrawer = () => {
  const [hasArtifact, setHasArtifact] = useState(false);
  const [artifactLoaded, setArtifactLoaded] = useState(false);
  const [chatSize, setChatSize] = useState(CHAT_SIZE);
  const [maxPanelSize, setMaxPanelSize] = useState(Number.MAX_SAFE_INTEGER);
  const constrainedChatSize = Math.min(chatSize, maxPanelSize);
  const collapsed = constrainedChatSize < MIN_CHAT_SIZE;

  const chatContent = (
    <Box padding="m">
      <Box variant="h2" padding={{ bottom: 'm' }}>
        Chat demo
      </Box>
      <Button
        onClick={() => {
          setHasArtifact(true);
          updateDrawer({ type: 'expandDrawer', payload: { id: 'ai-panel' } });
          updateDrawer({
            type: 'updateDrawerConfig',
            payload: {
              id: 'ai-panel',
              defaultSize: DEFAULT_SIZE + CHAT_SIZE,
              minSize: DEFAULT_SIZE + CHAT_SIZE,
            } as any,
          });
        }}
      >
        Open artifact
      </Button>
      <Button
        onClick={() => {
          updateDrawer({ type: 'exitExpandedMode' });
        }}
      >
        exit expanded mode
      </Button>
      <Button
        className="resize-to-max-width"
        onClick={() => {
          updateDrawer({ type: 'resizeDrawer', payload: { id: 'ai-panel', size: window.innerWidth + 1000 } });
        }}
      >
        resize to window.innerWidth + 1000
      </Button>
      {new Array(100).fill(null).map((_, index) => (
        <div key={index}>Tela chat content</div>
      ))}
    </Box>
  );
  const artifactContent = (
    <Box padding="m">
      <Box variant="h2" padding={{ bottom: 'm' }}>
        Artifact
      </Box>
      <Button
        onClick={() => {
          setHasArtifact(false);
          updateDrawer({ type: 'exitExpandedMode' });
          updateDrawer({
            type: 'updateDrawerConfig',
            payload: { id: 'ai-panel', defaultSize: DEFAULT_SIZE, minSize: DEFAULT_SIZE } as any,
          });
        }}
      >
        Close artifact panel
      </Button>
      <Button onClick={() => setArtifactLoaded(true)}>Load artifact details</Button>
      {artifactLoaded && new Array(100).fill(null).map((_, index) => <div key={index}>Tela content</div>)}
    </Box>
  );
  return (
    <PanelLayout
      resizable={true}
      panelSize={constrainedChatSize}
      maxPanelSize={maxPanelSize}
      minPanelSize={MIN_CHAT_SIZE}
      onPanelResize={({ detail }) => setChatSize(detail.panelSize)}
      onLayoutChange={({ detail }) => setMaxPanelSize(detail.totalSize - MIN_ARTIFACT_SIZE)}
      panelContent={chatContent}
      mainContent={<div className={styles['ai-artifact-panel']}>{artifactContent}</div>}
      display={hasArtifact ? (collapsed ? 'main-only' : 'all') : 'panel-only'}
    />
  );
};

export const leftDrawerPayload: DrawerPayload = {
  id: 'ai-panel',
  resizable: true,
  isExpandable: true,
  defaultSize: DEFAULT_SIZE,
  preserveInactiveContent: true,

  ariaLabels: {
    closeButton: 'Close AI Panel drawer',
    content: 'AI Panel',
    triggerButton: 'AI Panel',
    resizeHandle: 'Resize handle',
    expandedModeButton: 'Expanded mode button',
    exitExpandedModeButton: 'Console',
  },

  exitExpandedModeTrigger: {
    customIcon: `
      <svg width="94" height="24" viewBox="0 0 94 24" fill="none" focusable="false" aria-hidden="true">
        <rect width="94" height="24" rx="4" fill="url(#paint0_linear_145_32649)"/>
        <defs>
          <linearGradient id="paint0_linear_145_32649" x1="135.919" y1="21" x2="108.351" y2="74.1863" gradientUnits="userSpaceOnUse">
            <stop stop-color="#B8E7FF"/>
            <stop offset="0.255" stop-color="#0099FF"/>
            <stop offset="0.514134" stop-color="#5C7FFF"/>
            <stop offset="0.732534" stop-color="#8575FF"/>
            <stop offset="1" stop-color="#962EFF"/>
          </linearGradient>
        </defs>
      </svg>
    `,
  },

  onResize: event => {
    console.log('resize', event.detail);
  },
  onToggle: event => {
    console.log('toggle', event.detail);
  },

  mountContent: container => {
    mount(<AIDrawer />, container);
  },
  unmountContent: container => unmount(container),

  mountHeader: container => {
    mount(<div className={styles['ai-panel-logo']}>AI Panel</div>, container);
  },
  unmountHeader: container => unmount(container),

  headerActions: [
    {
      type: 'menu-dropdown',
      id: 'more-actions',
      text: 'More actions',
      items: [
        {
          id: 'add',
          iconName: 'add-plus',
          text: 'Add',
        },
        {
          id: 'remove',
          iconName: 'remove',
          text: 'Remove',
        },
      ],
    },
    {
      type: 'icon-button',
      id: 'add',
      iconName: 'add-plus',
      text: 'Add',
    },
  ],

  onHeaderActionClick: ({ detail }) => {
    console.log('onHeaderActionClick: ', detail);
  },

  onToggleFocusMode: ({ detail }) => {
    console.log('onToggleFocusMode: ', detail);
  },
};

const leftDrawerTrigger = {
  trigger: {
    customIcon: `
      <svg width="94" height="24" viewBox="0 0 94 24" fill="none" focusable="false" aria-hidden="true">
        <rect width="94" height="24" rx="4" fill="url(#paint0_linear_145_32649)"/>
        <defs>
          <linearGradient id="paint0_linear_145_32649" x1="135.919" y1="21" x2="108.351" y2="74.1863" gradientUnits="userSpaceOnUse">
            <stop stop-color="#B8E7FF"/>
            <stop offset="0.255" stop-color="#0099FF"/>
            <stop offset="0.514134" stop-color="#5C7FFF"/>
            <stop offset="0.732534" stop-color="#8575FF"/>
            <stop offset="1" stop-color="#962EFF"/>
          </linearGradient>
        </defs>
      </svg>
    `,
  },
};

registerLeftDrawer({ ...leftDrawerPayload, ...leftDrawerTrigger });

```

### Core Architecture Module: `pages/app-layout/utils/external-sidecar-widget-demo.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from 'react';

import { BarChart, Box, ColumnLayout, Drawer, FormField, Input, SpaceBetween, Textarea, Tiles } from '~components';
import ButtonDropdown from '~components/button-dropdown';
import awsuiPlugins from '~components/internal/plugins';
import { mount, unmount } from '~mount';

function Details() {
  const [value, setValue] = React.useState('item1');
  const [inputValue, setInputValue] = React.useState('');
  const [valueText, setValueText] = React.useState('');
  return (
    <SpaceBetween size="xl">
      <Tiles
        onChange={({ detail }) => setValue(detail.value)}
        value={value}
        items={[
          {
            label: 'Start a new investigation',
            value: 'item1',
          },
          {
            label: 'Add to an existing investigation',
            value: 'item2',
          },
        ]}
      />
      <ColumnLayout borders="horizontal">
        <SpaceBetween size="xs">
          <Box variant="h4">Investigation details</Box>
          <Box padding={{ bottom: 's' }}>
            <FormField label="Investigation name" description="Enter a unique name for this investigation">
              <Input
                value={inputValue}
                onChange={event => setInputValue(event.detail.value)}
                placeholder="Enter name of investigation"
                ariaLabel="Investigation name input"
              />
            </FormField>
          </Box>
        </SpaceBetween>
        <SpaceBetween size="xs">
          <Box variant="h4">New finding details</Box>
          <BarChart
            series={[
              {
                title: 'Site 1',
                type: 'bar',
                data: [
                  { x: new Date(1601071200000), y: 34503 },
                  { x: new Date(1601078400000), y: 25832 },
                  { x: new Date(1601085600000), y: 4012 },
                  { x: new Date(1601092800000), y: -5602 },
                  { x: new Date(1601100000000), y: 17839 },
                ],
                valueFormatter: e =>
                  '$' +
                  e.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
              },
              {
                title: 'Average revenue',
                type: 'threshold',
                y: 19104,
                valueFormatter: e =>
                  '$' +
                  e.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
              },
            ]}
            xDomain={[
              new Date(1601071200000),
              new Date(1601078400000),
              new Date(1601085600000),
              new Date(1601092800000),
              new Date(1601100000000),
            ]}
            yDomain={[-10000, 40000]}
            i18nStrings={{
              xTickFormatter: e =>
                e
                  .toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: !1,
                  })
                  .split(',')
                  .join('\n'),
              yTickFormatter: function o(e) {
                return Math.abs(e) >= 1e9
                  ? (e / 1e9).toFixed(1).replace(/\.0$/, '') + 'G'
                  : Math.abs(e) >= 1e6
                    ? (e / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
                    : Math.abs(e) >= 1e3
                      ? (e / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
                      : e.toFixed(2);
              },
            }}
            ariaLabel="Revenue chart showing Site 1 performance and average revenue threshold"
            height={300}
            hideFilter={true}
            hideLegend={true}
            xTitle="Time (UTC)"
            yTitle="Revenue (USD)"
          />
          <Box padding={{ bottom: 's' }}>
            <FormField label="Finding details" description="Provide detailed information about the finding">
              <Textarea
                onChange={({ detail }) => setValueText(detail.value)}
                value={valueText}
                placeholder="Enter detailed information about the finding"
                ariaLabel="Finding details input"
              />
            </FormField>
          </Box>
        </SpaceBetween>
      </ColumnLayout>
    </SpaceBetween>
  );
}

awsuiPlugins.appLayout.registerDrawer({
  id: 'bolt-global',
  type: 'global',
  defaultActive: false,
  resizable: true,
  defaultSize: 350,
  preserveInactiveContent: true,

  isExpandable: true,

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Content',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
    expandedModeButton: 'Expanded mode button',
  },
  onToggle: event => {
    console.log('circle-global drawer on toggle', event.detail);
  },

  trigger: {
    iconSvg: `<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true" role="presentation">
<path d="M11.5 1H6L2 9.5H6.4L7.4 15L14 6.26923L9 6.26923L11.5 1Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>
`,
  },

  onResize: event => {
    console.log('resize', event.detail);
  },

  mountContent: container => {
    mount(
      <Drawer
        header={<Box variant="h3">Investigate Cold Start Chaser</Box>}
        headerActions={
          <ButtonDropdown items={[{ id: 'settings', text: 'Settings' }]} ariaLabel="Control drawer" variant="icon" />
        }
      >
        <Details />
      </Drawer>,
      container
    );
  },
  unmountContent: container => unmount(container),
});

```

### Core Architecture Module: `pages/app-layout/utils/external-widget.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';

import Box from '~components/box';
import Drawer from '~components/drawer';
import awsuiPlugins from '~components/internal/plugins';
import { registerBottomDrawer } from '~components/internal/plugins/widget/index';
import { mount, unmount } from '~mount';

import { IframeWrapper } from '../../utils/iframe-wrapper';
import { Counter, CustomDrawerContent } from './content-blocks';

const searchParams = new URL(location.hash.substring(1), location.href).searchParams;

const Content = React.forwardRef((props, ref) => {
  const [resized, setResized] = useState(false);

  useImperativeHandle(ref, () => setResized);

  useEffect(() => {
    console.log('mounted');
    return () => console.log('unmounted');
  }, []);
  return (
    <Drawer header={<h2>Security</h2>}>
      I am runtime drawer, <span data-testid="current-size">resized: {`${resized}`}</span>
    </Drawer>
  );
});

const setSizeRef = React.createRef<(resized: boolean) => void>();

awsuiPlugins.appLayout.registerDrawer({
  id: 'security',

  ariaLabels: {
    closeButton: 'Security close button',
    content: 'Security drawer content',
    triggerButton: 'Security trigger button',
    resizeHandle: 'Security resize handle',
  },

  trigger: {
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <rect x="2" y="7" width="12" height="7" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M4,7V5a4,4,0,0,1,8,0V7" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>`,
  },

  defaultActive: !!searchParams.get('force-default-active'),
  onToggle: event => {
    console.log('security drawer on toggle', event.detail);
    awsuiPlugins.appLayout.updateDrawer({ id: 'security', defaultActive: event.detail.isOpen });
  },

  resizable: true,
  defaultSize: 320,

  onResize: event => {
    setSizeRef.current?.(true);
    console.log('resize', event.detail);
    awsuiPlugins.appLayout.updateDrawer({ id: 'security', defaultSize: event.detail.size });
  },

  mountContent: container => {
    mount(<Content ref={setSizeRef} />, container);
  },
  unmountContent: container => unmount(container),
  headerActions: [
    {
      type: 'icon-button',
      id: 'add',
      iconName: 'add-plus',
      text: 'Add',
    },
  ],
  onHeaderActionClick: ({ detail }) => {
    console.log('onHeaderActionClick: ', detail);
  },
});

awsuiPlugins.appLayout.registerDrawer({
  id: 'circle',

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Content',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
  },

  trigger: {
    iconSvg: `<svg viewBox="0 0 16 16" focusable="false">
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="7" />
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="3" />
    </svg>`,
  },

  mountContent: container => {
    mount(<div>Nothing to see here</div>, container);
  },
  unmountContent: container => unmount(container),
});

const AutoIncrementCounter: React.FC<{
  onVisibilityChange?: (callback: (isVisible: boolean) => void) => void;
}> = ({ children, onVisibilityChange }) => {
  const [count, setCount] = useState(0);
  const isPaused = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused.current) {
        setCount(prevCount => prevCount + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange((isVisible: boolean) => {
        isPaused.current = !isVisible;
      });
    }
  }, [onVisibilityChange]);

  return (
    <div>
      <h3>Auto Increment Counter</h3>
      <div>Count: {count}</div>
      {children}
    </div>
  );
};

awsuiPlugins.appLayout.registerDrawer({
  id: 'circle-global',
  type: 'global',
  defaultActive: false,
  resizable: true,
  defaultSize: 350,
  preserveInactiveContent: true,

  isExpandable: true,

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Content',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
    expandedModeButton: 'Expanded mode button',
  },
  onToggle: event => {
    console.log('circle-global drawer on toggle', event.detail);
  },

  trigger: {
    iconSvg: `<svg viewBox="0 0 16 16" focusable="false">
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="7" />
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="3" />
    </svg>`,
  },

  onResize: event => {
    console.log('resize', event.detail);
  },

  mountContent: (container, mountContext) => {
    mount(
      <Drawer header={<Box variant="h2">Global drawer</Box>}>
        <AutoIncrementCounter onVisibilityChange={mountContext?.onVisibilityChange}>
          global widget content circle 1
          {new Array(100).fill(null).map((_, index) => (
            <div key={index}>{index}</div>
          ))}
          <div data-testid="circle-global-bottom-content">circle-global bottom content</div>
        </AutoIncrementCounter>
      </Drawer>,
      container
    );
  },
  unmountContent: container => unmount(container),
  headerActions: [
    {
      type: 'icon-button',
      id: 'add',
      iconName: 'add-plus',
      text: 'Add',
    },
  ],
  onHeaderActionClick: ({ detail }) => {
    console.log('onHeaderActionClick: ', detail);
  },
});

awsuiPlugins.appLayout.registerDrawer({
  id: 'global-with-stored-state',
  type: 'global',
  defaultActive: false,
  resizable: true,
  defaultSize: 320,

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Drawer with counter',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
  },

  trigger: {
    iconSvg: `<svg viewBox="0 0 16 16" focusable="false">
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="7" />
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="3" />
    </svg>`,
  },

  onToggle(event) {
    awsuiPlugins.appLayout.updateDrawer({ id: 'global-with-stored-state', defaultActive: event.detail.isOpen });
  },

  mountContent: container => {
    mount(
      <>
        <Counter id="global-with-stored-state" />
        global widget content circle 2
      </>,
      container
    );
  },
  unmountContent: container => unmount(container),
});

awsuiPlugins.appLayout.registerDrawer({
  id: 'circle3-global',
  type: 'global',
  defaultActive: false,
  resizable: true,
  defaultSize: 320,

  isExpandable: true,

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Content',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
  },

  trigger: {
    iconSvg: `<svg viewBox="0 0 16 16" focusable="false">
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="7" />
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="3" />
    </svg>`,
  },

  mountContent: container => {
    mount(
      <IframeWrapper
        id="circle3-global"
        AppComponent={() => (
          <>
            <Counter id="circle3-global" />
            global widget content circle 3
          </>
        )}
      />,
      container
    );
  },
  unmountContent: container => unmount(container),
});

awsuiPlugins.appLayout.registerDrawer({
  id: 'circle4-global',
  type: 'global',
  defaultActive: false,
  resizable: true,
  defaultSize: 320,

  ariaLabels: {
    closeButton: 'Close button',
    content: 'Content',
    triggerButton: 'Trigger button',
    resizeHandle: 'Resize handle',
  },
  onToggle: event => {
    console.log('circle4-global drawer on toggle', event.detail);
  },

  mountContent: container => {
    mount(<CustomDrawerContent />, container);
  },
  unmountContent: container => unmount(container),
});

export const registerRuntimeBottomDrawer = () => {
  registerBottomDrawer({
    id: 'circle5-global-bottom',
    position: 'bottom',
    defaultActive: false,
    resizable: true,
    defaultSize: 350,
    preserveInactiveContent: true,

    isExpandable: true,

    ariaLabels: {
      closeButton: 'Close button',
      content: 'Content bottom',
      triggerButton: 'Trigger button',
      resizeHandle: 'Resize handle',
      expandedModeButton: 'Expanded mode button',
      resizeHandleTooltipText: 'Drag or select to resize',
    },
    onToggle: event => {
      console.log('circle-global drawer on toggle', event.detail);
    },

    trigger: {
      iconSvg: `<svg viewBox="0 0 16 16" focusable="false">
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="7" />
      <circle stroke-width="2" stroke="currentColor" fill="none" cx="8" cy="8" r="3" />
    </svg>`,
    },

    onResize: event => {
      console.log('resize', event.detail);
    },

    mountContent: (container, mountContext) => {
      mount(
        <Box padding={{ left: 'm' }}>
          <AutoIncrementCounter onVisibilityChange={mountContext?.onVisibilityChange}>
            global bottom panel
            {new Array(100).fill(null).map((_, index) => (
              <div key={index}>{index}</div>
            ))}
            <div data-testid="circle-global-bottom-content">circle-global bottom content</div>
          </AutoIncrementCounter>
        </Box>,
        container
      );
    },
    unmountContent: container => unmount(container),
    mountHeader: container => {
      mount(
        <Box variant="h2" padding="m">
          Global drawer
        </Box>,
        container
      );
    },
    unmountHeader: container => unmount(container),
    headerActions: [
      {
        type: 'icon-button',
        id: 'add',
        iconName: 'add-plus',
        text: 'Add',
      },
    ],
    onHeaderActionClick: ({ detail }) => {
      console.log('onHeaderActionClick: ', detail);
    },
  })
```

### Core Architecture Module: `pages/app-layout/utils/labels.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const labels = {
  navigation: 'Side navigation',
  navigationToggle: 'Open navigation',
  navigationClose: 'Close navigation',
  notifications: 'Notifications',
  tools: 'Tools',
  toolsToggle: 'Open tools',
  toolsClose: 'Close tools',
};

export default labels;

```

### Core Architecture Module: `pages/app-layout/utils/strings.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { SplitPanelProps } from '~components/split-panel';

export const discreetSplitPanelI18nStrings: SplitPanelProps.I18nStrings = {
  closeButtonAriaLabel: 'Close panel',
  resizeHandleAriaLabel: 'Slider',
  resizeHandleTooltipText: 'Drag or select to resize',
};

export const splitPaneli18nStrings: SplitPanelProps.I18nStrings = {
  ...discreetSplitPanelI18nStrings,
  openButtonAriaLabel: 'Open panel',
  preferencesTitle: 'Preferences',
  preferencesPositionLabel: 'Split panel position',
  preferencesPositionDescription: 'Choose the default split panel position for the service.',
  preferencesPositionSide: 'Side',
  preferencesPositionBottom: 'Bottom',
  preferencesConfirm: 'Confirm',
  preferencesCancel: 'Cancel',
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5058** (2026-09-28): **New 1**
  *Symptoms*: ### Describe the bug  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate requests

- **Issue #4905** (2026-09-02): **[Bug]: Published CSS contains 30-50 duplicate license headers per file (26% of CSS bytes)**
  *Symptoms*: ### Browser  _No response_  ### Package version  v3.0.1345  ### React version  _No response_  ### Description  Every stylesheet published in `lib/components` contains the Apache license comment repeated 30-50 times.  Measured on a local `npm run build` of `c4816f9f1`:  | ---------------- | -------------------------------------------------------- | | stylesheets      | 227                                                      | | total CSS        | 2269 KB                                                  | | license comments | 598 KB (**26.4%**)                                       | | blocks per file  | median 35, max 51 (`file-token-group/styles.scoped.css`) |  Example: `popover/styles.scoped.css` is 27,483 bytes and holds 43 copies of the same 4-line comment.  ### Cause  318 of the 319 `.scss` files in `src/` open with a loud CSS comment (`/* ... */`) rather than a Sass silent comment (`// ...`). Sass preserves loud comments, and `theming-build` compiles with `style: 'expanded'`, so every module a `styles.scss` entry point transitively `@use`s contributes its header to that entry's output. `src/popover/styles.scss` loads 25+ modules, hence 43 headers. Most of those modules emit no CSS rules at all: for files like `src/internal/styles/typography/constants.scss` the header is the module's entire contribution to the compiled output.  ### Impact  Minifiers drop the comments, so the impact on end users is zero for apps that have a proper build pipeline.  Where this really hurts 
  **Post-Mortem & Fix Analysis**:
  > I've sent over a pair of PRs to fix this:  * https://github.com/cloudscape-design/build-tools/pull/75 (needs to land first) * https://github.com/cloudscape-design/components/pull/4906 (draft, will publish once the first PR is merged)
  > Hey Trevor,  Thanks for contributing! Our team will take a look at the proposed changes.

- **Issue #4551** (2026-06-08): **[Bug]: allowSkipTo doesn't enable navigation to immediately-next step when current step is optional**
  *Symptoms*: ### Browser  Safari  ### Package version  3.0.1011  ### React version  18.2.0  ### Description  - canSkip(fromIndex, toIndex) returns false when fromIndex >= toIndex (line: if (fromIndex >= toIndex) return false) - When on step N-1 targeting step N, it calls canSkip(N, N) which hits this guard - The fallback only allows it if the target is isOptional, but the target being mandatory shouldn't prevent navigation when the current step is optional - This creates inconsistency: Step 4 is clickable from Steps 1 and 2 (via intermediate optional checks) but not from Step 3 (the step right before it) - Expected: If I can skip to Step 4 from Step 1 (because Steps 2/3 are optional), I should also be able to skip to Step 4 from Step 3 (since the current step is optional and there are no intermediates to block) - Workaround: Mark the target step as isOptional: true, but this adds an unwanted "- optional" label  ### Source code  _No response_  ### Reproduction  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate problems
  **Post-Mortem & Fix Analysis**:
  > Hey, Thanks for submitting this bug report.  I was able to reproduce the bug. Can you verify that this is what you mean (see video below)?  Best regards,  Simon
  > https://github.com/user-attachments/assets/82628e2b-5053-4242-b384-68f618539c10
  > Hello, Yes, this is exactly it. Please do look into it as this is a component in our production console. Thanks for the quick repro!

- **Issue #4440** (2026-05-04): **[Bug]: `Box` with `awsui-inline-code` variant should support relative font sizing**
  *Symptoms*: ### Browser  _No response_  ### Package version  latest  ### React version  _No response_  ### Description  # `Box` with `awsui-inline-code` variant should support relative font sizing  ## Description  The `awsui-inline-code` variant on `Box` hardcodes `font-size: 12px` (via `--font-size-body-s`). This means inline code inside headings, headers, or any large-text context renders at body-text size instead of scaling with its parent.  The `fontSize` prop only accepts predefined sizes (`body-s`, `body-m`, `heading-xs`, etc.) — there's no way to set `inherit` or a relative value like `85%` without resorting to `nativeAttributes`.  ## Example  ```tsx import { Box, Header } from "@cloudscape-design/components";  <Header variant="h1">   OpenSearch Schema Mapping for <Box variant="awsui-inline-code">getBookings</Box> API </Header> ```  <img width="923" height="150" alt="Image" src="https://github.com/user-attachments/assets/30af1c89-11a6-4e80-95b1-a6afb70c9a6d" />  **Expected:** The inline code `getBookings` scales with the h1 heading size.  **Actual:** `getBookings` renders at 12px while the rest of the heading is much larger.  ## Current workaround  ```tsx <Box   variant="awsui-inline-code"   nativeAttributes={{ style: { fontSize: "85%" } }} >   getBookings </Box> ```  ## Suggestion  Either:  1. Add `"inherit"` as a valid `fontSize` option on `Box` 2. Make the `awsui-inline-code` variant use a relative font size (e.g. `0.85em`) by default so it scales with its context   ### Source 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for reaching out!                                                                                                                                                                                                                                                                                                                                                                                                              One option that might work well here is using the `fontSize` property on the Box component. Setting it one step below the heading size, for example `heading-l` for an h1, can give you a more proportionate inline code size:                                                                                                                                                                                                   ```tsx <Header variant="h1">   OpenSearch Schema Mapping for <Box fontSize="heading-l" variant="awsui-inline-code">getBookings</Box> API </Header> ``` Hope t

- **Issue #4411** (2026-05-07): **[Bug]: Text in read-only date range picker is unselectable**
  *Symptoms*: ### Browser  _No response_  ### Package version  v3.0.1267  ### React version  v19.2.3  ### Description  I'm displaying a date range using a `DateRangePicker` with `readOnly={true}`:  <img width="452" height="52" alt="Image" src="https://github.com/user-attachments/assets/1d233fc1-1bd7-4d67-9b6f-108eda2cfba5" />  When I do this, the text shown in the widget is unselectable by the user. This is perhaps expected for a `disabled` component, but not for a `readOnly` one. It's a usability issue, and potentially an accessibility issue as well.  ### Source code  _No response_  ### Reproduction  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate problems
  **Post-Mortem & Fix Analysis**:
  > Hey Trevor,  Thanks for reporting! The issue looks valid, our team is working on it now.
  > Update: just saw your PR, thanks for contributing! ❤️ 
  > Hi @TrevorBurnham , thanks again for the contribution. Note that I have submitted a couple of comments in the PR.

- **Issue #4357** (2026-03-24): **[Bug]: PanelLayout overflow content is hidden when display is set to panel-only**
  *Symptoms*: ### Browser  _No response_  ### Package version  latest  ### React version  _No response_  ### Description  ### Steps to reproduce this issue  Open https://cloudscape.design/components/panel-layout/?tabId=playground, set `display` to `panel-only` and `panelContent` to   ``` <table style={{width: 3000, borderCollapse: "collapse" }}>     <thead>         <tr>             {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (             <th key={i} style={{border: "1px solid #ccc" , padding: "8px 16px" , whiteSpace: "nowrap" }}>                 Column {i}             </th>             ))}         </tr>     </thead>     <tbody>         {[1,2,3].map(row => (         <tr key={row}>             {[1,2,3,4,5,6,7,8,9,10,11,12].map(col => (             <td key={col} style={{border: "1px solid #ccc" , padding: "8px 16px" , whiteSpace: "nowrap" }}>                 Row {row}, Cell {col}             </td>             ))}         </tr>         ))}     </tbody> </table> ```  <img width="1397" height="491" alt="Image" src="https://github.com/user-attachments/assets/d3ae9210-9212-432a-993e-cc4280bb24f8" />  ### Source code  _No response_  ### Reproduction  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate problems
  **Post-Mortem & Fix Analysis**:
  > Hi Zhang,  Thank you for creating the bug report and providing steps to reproduce the issue! Cloudscape team is now working on the fix.

- **Issue #4264** (2026-03-02): **[Bug]: Rollup error - "validateProps" is not exported**
  *Symptoms*: ### Browser  _No response_  ### Package version  3.0.1204  ### React version  19.1.0  ### Description  I am building a TS library that provides reusable react components that use CloudScape components. I am bundling this library with TSUP. The library itself builds without issues. However, if I am using this library in another project, I am getting an error when running yarn build:  ``` x Build failed in 16.76s error during build: node_modules/@cloudscape-design/components/alert/index.js (7:9): "validateProps" is not exported by "node_modules/@cloudscape-design/components/node_modules/@cloudscape-design/component-toolkit/internal/index.js", imported by "node_modules/@cloudscape-design/components/alert/index.js". file: /myproject/node_modules/@cloudscape-design/components/alert/index.js:7:9  5: import CoreComponent from './internal-do-not-use-core'; 6: import { applyDisplayName } from '../internal/utils/apply-display-name'; 7: import { validateProps } from '@cloudscape-design/component-toolkit/internal';             ^      at getRollupError (file:///myproject/node_modules/rollup/dist/es/shared/parseAst.js:401:41)     at error (file:///myproject/node_modules/rollup/dist/es/shared/parseAst.js:397:42)     at Module.error (file:///myproject/node_modules/rollup/dist/es/shared/node-entry.js:16875:16)     at Module.traceVariable (file:///myproject/node_modules/rollup/dist/es/shared/node-entry.js:17327:29)     at ModuleScope.findVariable (file:///myproject/node_modules/rollup/dist/es/
  **Post-Mortem & Fix Analysis**:
  > Hey, Thanks for creating this bug report. Could you share the version of `@cloudscape-design/component-toolkit` that gets installed as a peer dependency of `@cloudscape-design/components`?  I checked the latest component-toolkit version whether`validateProps` is being exported and this seems to be the case. You can validate this here: `node_modules/@cloudscape-design/component-toolkit/internal/index.js`.  From your error logs: `node_modules/@cloudscape-design/components/node_modules/@cloudscape-design/component-toolkit/internal/index.js` This line lets me suspect there could be a problem in how the paths are being resolved in tsup. This should be `node_modules/@cloudscape-design/component-toolkit/internal/index.js` instead because component-toolkit and components should live in the same node_modules folder.
  > Could you possibly share a minimum setup example repository with your configuration where this error occurs? 
  > Hi @SpyZzey , thanks for the quick response!  The version where this occurs is "@cloudscape-design/component-toolkit": "^1.0.0-beta.138"  Do you indicate this is fixed in newer versions?  I cannot see `validateProps` being exported in that index.js, neither in "1.0.0-beta.111" nor in "1.0.0-beta.138".  I will try to come up with a minimum example over the weekend, but not sure how much effort it is.  Thanks!

- **Issue #4236** (2026-03-12): **[Bug]: resizableColumns: dynamically added columns ignore minWidth, fall back to DEFAULT_COLUMN_WIDTH**
  *Symptoms*: ### Browser  Chrome  ### Package version  v3.0.0 (@amzn/awsui-components-console)  ### React version  v19.2.3  ### Description  When using `resizableColumns` on a `<Table>`, columns that are dynamically added to `columnDefinitions` (e.g. swapping visible columns based on a filter/toggle) do not respect their `minWidth`. They are instead assigned `DEFAULT_COLUMN_WIDTH` (120px).  The issue is in [`use-column-widths.tsx` L171](https://github.com/cloudscape-design/components/blob/9a1b7c5bf8e597df72f40a152f58bee9d09d2ac8/src/table/use-column-widths.tsx#L171):  ```ts newColumnWidths.set(column.id, column.width || DEFAULT_COLUMN_WIDTH); ```  This only checks `column.width` and ignores `column.minWidth`. A column defined with `{ minWidth: 250 }` but no explicit `width` will get 120px when dynamically added.  The initial render handles this correctly in `readWidths` ([L28-L41](https://github.com/cloudscape-design/components/blob/9a1b7c5bf8e597df72f40a152f58bee9d09d2ac8/src/table/use-column-widths.tsx#L28-L41)) by doing `Math.max(width, minWidth)`, but the dynamic column path does not.  ### Expected behavior  Dynamically added columns should respect `minWidth`, consistent with the initial render behavior. The fix would be something like:  ```ts const minWidth = column.minWidth || column.width || DEFAULT_COLUMN_WIDTH; newColumnWidths.set(column.id, Math.max(column.width || DEFAULT_COLUMN_WIDTH, minWidth)); ```  ### Workaround  Set an explicit `width` equal to `minWidth` on affected colu
  **Post-Mortem & Fix Analysis**:
  > Hello Miles,  Thank you for reporting that, the issue seems valid.  I see that there is already a contribution request open for it: https://github.com/cloudscape-design/components/pull/4241. Our team is evaluating it now.

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

### Incident Patch 1: `163e9b6f` (2026-10-05)
**Commit Message**: fix: Remove top margin from custom vertical steps connector (#5102)

**File**: `src/steps/styles.scss` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@
       block-size: auto;
       min-block-size: awsui.$space-static-xs;
       inset-inline-end: 0;
-      margin-block: awsui.$space-static-xxs 0;
+      margin-block: 0;
     }
   }
 
```

---

### Incident Patch 2: `b6e80189` (2026-10-05)
**Commit Message**: chore: Let multiselect render tokens inline when grouped (#5091)

**File**: `src/multiselect/__tests__/control-group.test.tsx` (modified, +20/-2)
```diff
@@ -8,14 +8,17 @@ import Multiselect from '../../../lib/components/multiselect';
 import createWrapper from '../../../lib/components/test-utils/dom';
 import { PositionProbe } from '../../internal/components/control-group/__tests__/common';
 
+const options = [{ value: '1', label: 'One' }];
+const noop = () => {};
+
 describe('Multiselect in control group', () => {
   test('resets the context for a custom dropdown footer', () => {
     const { container, getByTestId } = render(
       <ControlGroup>
         <Multiselect
           selectedOptions={[]}
-          options={[{ value: '1', label: 'One' }]}
-          onChange={() => {}}
+          options={options}
+          onChange={noop}
           renderDropdownFooter={() => <PositionProbe />}
         />
       </ControlGroup>
@@ -24,4 +27,19 @@ describe('Multiselect in control group', () => {
 
     expect(getByTestId('probe')).toHaveTextContent('none');
   });
+
+  it('renders inline tokens even if `inlineTokens` is not set', () => {
+    const { container } = render(
+      <ControlGroup>
+        <Multiselect selectedOptions={[options[0]]} options={options} onChange={() => {}} />
+      </ControlGroup>
+    );
+
+    const multiselect = createWrapper(container).findMultiselect()!;
+    const inlineTokens = multiselect.findInlineTokens();
+
+    expect(inlineTokens).toHaveLength(1);
+    expect(inlineTokens[0].findLabel().getElement()).toHaveTextContent('One');
+    expect(multiselect.findTokens()).toHaveLength(0);
+  });
 });
```

**File**: `src/multiselect/internal.tsx` (modified, +7/-2)
```diff
@@ -78,6 +78,11 @@ const InternalMultiselect = React.forwardRef(
     const { position: groupedControlPosition } = useGroupedControlContext();
     const i18n = useInternalI18n('multiselect');
 
+    // When rendered inside a control group, tokens are always shown inline in the
+    // trigger regardless of the `inlineTokens` prop, since there is no room to
+    // display tokens below the control within a group.
+    const showTokensInline = inlineTokens || groupedControlPosition !== null;
+
     const selfControlId = useUniqueId('trigger');
     const controlId = formFieldContext.controlId ?? selfControlId;
     const ariaLabelId = useUniqueId('multiselect-ariaLabel-');
@@ -138,7 +143,7 @@ const InternalMultiselect = React.forwardRef(
         triggerProps={multiselectProps.getTriggerProps(disabled, autoFocus)}
         selectedOption={null}
         selectedOptions={selectedOptions}
-        triggerVariant={inlineTokens ? 'tokens' : 'placeholder'}
+        triggerVariant={showTokensInline ? 'tokens' : 'placeholder'}
         isOpen={multiselectProps.isOpen}
         groupedControlPosition={groupedControlPosition}
         inlineLabelText={inlineLabelText}
@@ -166,7 +171,7 @@ const InternalMultiselect = React.forwardRef(
 
     const ListComponent = virtualScroll ? VirtualList : PlainList;
 
-    const showTokens = !hideTokens && !inlineTokens && tokens.length > 0;
+    const showTokens = !hideTokens && !showTokensInline && tokens.length > 0;
 
     const tokenGroupI18nStrings: TokenGroupProps.I18nStrings = {
       limitShowFewer: i18nStrings?.tokenLimitShowFewer,
```

---

### Incident Patch 3: `53fca8df` (2026-10-05)
**Commit Message**: fix: Fixes prompt input styling for font size and weight (#5092)

**File**: `pages/prompt-input/style-permutations.page.tsx` (modified, +2/-2)
```diff
@@ -42,8 +42,8 @@ const style1: PromptInputProps.Style = {
       disabled: '#7dd3fc',
       readonly: 'light-dark(#0369a1, #7dd3fc)',
     },
-    fontSize: '14px',
-    fontWeight: '400',
+    fontSize: '16px',
+    fontWeight: '600',
     paddingBlock: '4px',
     paddingInline: '8px',
   },
```

**File**: `src/prompt-input/styles.scss` (modified, +4/-0)
```diff
@@ -156,6 +156,8 @@ $invalid-border-offset: constants.$invalid-control-left-padding;
   @include styles.styles-reset;
   @include styles.control-border-radius-full();
   @include styles.font-body-m;
+  font-size: inherit;
+  font-weight: inherit;
   // Restore browsers' default resize values
   resize: none;
   // Restore default text cursor
@@ -394,4 +396,6 @@ $invalid-border-offset: constants.$invalid-control-left-padding;
   white-space: pre-wrap;
   // Inherit color from parent (textarea) for disabled/readonly states
   color: inherit;
+  font-size: inherit;
+  font-weight: inherit;
 }
```

---

### Incident Patch 4: `eac1b178` (2026-10-05)
**Commit Message**: chore: Remediate 11 Dependabot security alerts (lockfile only) (#5101)

**File**: `package-lock.json` (modified, +24/-22)
```diff
@@ -5383,9 +5383,9 @@
       }
     },
     "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion": {
-      "version": "2.1.4",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz",
-      "integrity": "sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==",
+      "version": "2.1.7",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.7.tgz",
+      "integrity": "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -5521,9 +5521,9 @@
       }
     },
     "node_modules/@wdio/config/node_modules/brace-expansion": {
-      "version": "2.1.4",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz",
-      "integrity": "sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==",
+      "version": "2.1.7",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.7.tgz",
+      "integrity": "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -6867,9 +6867,9 @@
       "license": "MIT"
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -11816,9 +11816,9 @@
       }
     },
     "node_modules/html-validate/node_modules/brace-expansion": {
-      "version": "2.1.4",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz",
-      "integrity": "sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==",
+      "version": "2.1.7",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.7.tgz",
+      "integrity": "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -15252,9 +15252,9 @@
       }
     },
     "node_modules/minimatch/node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -15329,7 +15329,9 @@
       }
     },
     "node_modules/moment": {
-      "version": "2.30.1",
+      "version": "2.31.0",
+      "resolved": "https://registry.npmjs.org/moment/-/moment-2.31.0.tgz",
+      "integrity": "sha512-0acOTfMiWOheYS4eoWb80yYMb/JLvVv9SHbs2PehaDzfUG0Bw855SKyk0IKTnPGa5+U2bmi3W68l1+sGLX/pvw==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -20885,9 +20887,9 @@
       }
     },
     "node_modules/undici": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-7.29.0.tgz",
-      "integrity": "sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==",
+      "version": "7.30.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-7.30.0.tgz",
+      "integrity": "sha512-dkrQXeHSaoamnItlYbmzG0wFYrM0ZwDxCIg0A7aKjTyyhh9svRzCNFEzV+Vm05/yehjCzjDZ31KXfGEjYSztDQ==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -21260,9 +21262,9 @@
       }
     },
     "node_modules/webdriver/node_modules/undici": {
-      "version": "6.28.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-6.28.0.tgz",
-      "integrity": "sha512-LIY910g9TI13YS95lrMFrs8Rm/u/irgHeTWoKCoteeJ04CUJ92eEfj0rVn+7VKMPBpUPiUoBKfhNyLI23EE/KA==",
+      "version": "6.29.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-6.29.0.tgz",
+      "integrity": "sha512-R+RODBqp6i2pPflGdq+xIOUkl+RNfGgHwoinecKu/JCuf2uO06cOKoDbI2P7Dn6KcswdKwrczbU6IYJ6K8X+wg==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

---

### Incident Patch 5: `3bc1f014` (2026-10-01)
**Commit Message**: fix: Side navigation collapsed state for parent items extending state and using colorBackgroundSideNavigationItemActive (#5079)

**File**: `src/expandable-section/__tests__/expandable-section.test.tsx` (modified, +4/-0)
```diff
@@ -52,6 +52,10 @@ describe('Expandable Section', () => {
       expect(wrapper.findAll('button').length).toBe(1);
       expect(wrapper.findAll('div[role=button]').length).toBe(0);
     });
+    test('does not mark the non-interactive header wrapper as a click target for variant navigation', () => {
+      const wrapper = renderExpandableSection({ variant: 'navigation', headerText: 'Test Header' });
+      expect(wrapper.findHeader().getElement()).not.toHaveClass(styles['click-target']);
+    });
     describe('has no trigger button and div=[role=button]', () => {
       for (const variant of containerizedVariants) {
         test(`${variant} variant`, () => {
```

**File**: `src/expandable-section/expandable-section-header.tsx` (modified, +0/-1)
```diff
@@ -209,7 +209,6 @@ const ExpandableNavigationHeader = ({
       id={id}
       className={clsx(
         className,
-        styles['click-target'],
         analyticsSelectors['header-label'],
         expandIconPosition === 'end' && styles['header-icon-end']
       )}
```

**File**: `src/side-navigation/styles.scss` (modified, +13/-6)
```diff
@@ -333,8 +333,20 @@ $content-exit-clip-delay: $content-exit-duration;
   box-sizing: content-box;
 }
 
+// Icon layout: drop the navigation header's 1px alignment border so the icon lines up with plain links.
+// (The icon-less layout compensates for it via $expandable-icon-negative-margin.)
+.expandable-link-group--expand-icon-end > div:first-child {
+  border-inline-start-width: 0;
+}
+
+// Collapsed: shrink the header wrapper to the icon square.
+.expandable-link-group--collapsed > div:first-child {
+  padding-inline: 0;
+  margin-inline: 0;
+}
+
 // Targets the ExpandableSection header wrapper (first child div of the component root).
-.expandable-link-group--active > div:first-child {
+.expandable-link-group--active:not(.expandable-link-group--collapsed) > div:first-child {
   background-color: awsui.$color-background-side-navigation-item-active;
 }
 
@@ -371,11 +383,6 @@ $content-exit-clip-delay: $content-exit-duration;
         padding-block $content-exit-motion;
     }
   }
-
-  > :first-child {
-    padding-inline: 0;
-    margin-inline: 0;
-  }
 }
 
 .section {
```

---

### Incident Patch 6: `58059a42` (2026-10-01)
**Commit Message**: fix: Do not round attached borders of containers with custom border radius (#5064)

**File**: `build-tools/utils/custom-css-properties.js` (modified, +2/-0)
```diff
@@ -202,5 +202,7 @@ const customCssPropertiesList = [
   'styleItemCardBoxShadowDefault',
   // Inline label
   'inlineLabelBackgroundColor',
+  // Container style API
+  'containerStyleBorderRadius',
 ];
 module.exports = customCssPropertiesList;
```

**File**: `pages/container/stacked-custom-radius.page.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+import React from 'react';
+
+import { Container } from '~components';
+
+import { SimplePage } from '../app/templates';
+
+// Stacked containers with a custom border radius. Outer corners use the radius; adjacent
+// corners stay flat. Drives the stacked-custom-radius integ test.
+export default function StackedCustomRadiusContainer() {
+  return (
+    <SimplePage title="Stacked containers with a custom border radius" screenshotArea={{}}>
+      <div style={{ inlineSize: 400 }}>
+        <Container
+          data-testid="bg-first"
+          header="First stacked container"
+          variant="stacked"
+          style={{ root: { borderRadius: '24px', background: 'light-dark(#f0f8ff, #000)' } }}
+        >
+          Container content
+        </Container>
+        <Container
+          data-testid="bg-middle"
+          header="Middle stacked container"
+          variant="stacked"
+          style={{ root: { borderRadius: '24px', background: 'light-dark(#fff8f0, #000)' } }}
+        >
+          Container content
+        </Container>
+        <Container
+          data-testid="bg-last"
+          header="Last stacked container"
+          variant="stacked"
+          style={{ root: { borderRadius: '24px', background: 'light-dark(#f0fff8, #000)' } }}
+        >
+          Container content
+        </Container>
+      </div>
+    </SimplePage>
+  );
+}
```

**File**: `src/container/__tests__/__snapshots__/styles.test.tsx.snap` (modified, +2/-6)
```diff
@@ -50,24 +50,22 @@ exports[`getFooterStyles handles all possible style configurations 3`] = `
 
 exports[`getHeaderStyles handles all possible style configurations 1`] = `
 {
-  "borderRadius": undefined,
   "paddingBlock": undefined,
   "paddingInline": undefined,
 }
 `;
 
 exports[`getHeaderStyles handles all possible style configurations 2`] = `
 {
-  "borderRadius": undefined,
   "paddingBlock": undefined,
   "paddingInline": undefined,
 }
 `;
 
 exports[`getHeaderStyles handles all possible style configurations 3`] = `
 {
+  "--awsui-container-style-border-radius-ka4djm": "8px",
   "background": "transparent",
-  "borderRadius": "8px",
   "paddingBlock": "12px",
   "paddingInline": "20px",
 }
@@ -125,7 +123,6 @@ exports[`getRootStyles handles all possible style configurations 1`] = `
 {
   "background": undefined,
   "borderColor": undefined,
-  "borderRadius": undefined,
   "borderWidth": undefined,
   "boxShadow": undefined,
   "color": undefined,
@@ -136,7 +133,6 @@ exports[`getRootStyles handles all possible style configurations 2`] = `
 {
   "background": undefined,
   "borderColor": undefined,
-  "borderRadius": undefined,
   "borderWidth": undefined,
   "boxShadow": undefined,
   "color": undefined,
@@ -145,9 +141,9 @@ exports[`getRootStyles handles all possible style configurations 2`] = `
 
 exports[`getRootStyles handles all possible style configurations 3`] = `
 {
+  "--awsui-container-style-border-radius-ka4djm": "8px",
   "background": "#ffffff",
   "borderColor": "#e0e0e0",
-  "borderRadius": "8px",
   "borderWidth": "1px",
   "boxShadow": "0 1px 3px rgba(0,0,0,0.1)",
   "color": "#000000",
```

**File**: `src/container/__tests__/container.test.tsx` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ import React from 'react';
 import { fireEvent, render } from '@testing-library/react';
 
 import Container, { ContainerProps } from '../../../lib/components/container';
+import customCssProps from '../../../lib/components/internal/generated/custom-css-properties';
 import createWrapper from '../../../lib/components/test-utils/dom';
 
 import styles from '../../../lib/components/container/styles.css.js';
@@ -170,7 +171,9 @@ describe('Style API', () => {
 
     expect(getComputedStyle(wrapper.getElement()).getPropertyValue('background')).toBe('rgb(240, 240, 235)');
     expect(getComputedStyle(wrapper.getElement()).getPropertyValue('border-color')).toBe('purple');
-    expect(getComputedStyle(wrapper.getElement()).getPropertyValue('border-radius')).toBe('240px');
+    expect(getComputedStyle(wrapper.getElement()).getPropertyValue(customCssProps.containerStyleBorderRadius)).toBe(
+      '240px'
+    );
     expect(getComputedStyle(wrapper.getElement()).getPropertyValue('border-width')).toBe('6px');
     expect(
       getComputedStyle(wrapper.findByClassName(styles['content-inner'])!.getElement()).getPropertyValue('padding-block')
```

**File**: `src/container/style.tsx` (modified, +6/-2)
```diff
@@ -1,6 +1,7 @@
 // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 // SPDX-License-Identifier: Apache-2.0
 import { SYSTEM } from '../internal/environment';
+import customCssProps from '../internal/generated/custom-css-properties';
 import { ContainerProps } from './interfaces';
 
 export function getRootStyles(style: ContainerProps.Style | undefined) {
@@ -11,7 +12,9 @@ export function getRootStyles(style: ContainerProps.Style | undefined) {
   return {
     background: style?.root?.background,
     borderColor: style?.root?.borderColor,
-    borderRadius: style?.root?.borderRadius,
+    // Set as a custom property, not inline `border-radius`, so stacked containers can still
+    // flatten their adjacent corners in CSS.
+    ...(style?.root?.borderRadius && { [customCssProps.containerStyleBorderRadius]: style.root.borderRadius }),
     borderWidth: style?.root?.borderWidth,
     boxShadow: style?.root?.boxShadow,
     color: style?.root?.color,
@@ -36,7 +39,8 @@ export function getHeaderStyles(style: ContainerProps.Style | undefined) {
 
   return {
     ...(style?.root?.background && { background: 'transparent' }), // Fix for AWSUI-61442
-    borderRadius: style?.root?.borderRadius,
+    // Same as the root: use a custom property so stacked headers can still flatten corners in CSS.
+    ...(style?.root?.borderRadius && { [customCssProps.containerStyleBorderRadius]: style.root.borderRadius }),
     paddingBlock: style?.header?.paddingBlock,
     paddingInline: style?.header?.paddingInline,
   };
```

**File**: `src/container/styles.scss` (modified, +5/-4)
```diff
@@ -138,8 +138,9 @@
 
 .header {
   background-color: awsui.$color-background-container-header;
-  border-start-start-radius: awsui.$border-radius-container;
-  border-start-end-radius: awsui.$border-radius-container;
+  $border-radius: var(#{custom-props.$containerStyleBorderRadius}, #{awsui.$border-radius-container});
+  border-start-start-radius: $border-radius;
+  border-start-end-radius: $border-radius;
   &.header-full-page {
     background-color: awsui.$color-background-layout-main;
   }
@@ -206,8 +207,8 @@
   }
 
   &.with-hidden-content {
-    border-end-start-radius: awsui.$border-radius-container;
-    border-end-end-radius: awsui.$border-radius-container;
+    border-end-start-radius: $border-radius;
+    border-end-end-radius: $border-radius;
   }
 
   &-variant-cards {
```

**File**: `src/dropdown/__tests__/__snapshots__/styles.test.tsx.snap` (modified, +3/-3)
```diff
@@ -6,9 +6,9 @@ exports[`getDropdownStyles handles all possible style configurations 2`] = `unde
 
 exports[`getDropdownStyles handles all possible style configurations 3`] = `
 {
-  "--awsui-dropdown-content-border-color-66120l": "rgb(0, 0, 0)",
-  "--awsui-dropdown-content-border-radius-66120l": "8px",
-  "--awsui-dropdown-content-border-width-66120l": "2px",
+  "--awsui-dropdown-content-border-color-ka4djm": "rgb(0, 0, 0)",
+  "--awsui-dropdown-content-border-radius-ka4djm": "8px",
+  "--awsui-dropdown-content-border-width-ka4djm": "2px",
   "background": "rgb(255, 255, 255)",
 }
 `;
```

**File**: `src/input/__tests__/__snapshots__/styles.test.tsx.snap` (modified, +72/-72)
```diff
@@ -2,30 +2,30 @@
 
 exports[`getInputStyles handles all possible style configurations 1`] = `
 {
-  "--awsui-style-background-default-66120l": undefined,
-  "--awsui-style-background-disabled-66120l": undefined,
-  "--awsui-style-background-focus-66120l": undefined,
-  "--awsui-style-background-hover-66120l": undefined,
-  "--awsui-style-background-readonly-66120l": undefined,
-  "--awsui-style-border-color-default-66120l": undefined,
-  "--awsui-style-border-color-disabled-66120l": undefined,
-  "--awsui-style-border-color-focus-66120l": undefined,
-  "--awsui-style-border-color-hover-66120l": undefined,
-  "--awsui-style-border-color-readonly-66120l": undefined,
-  "--awsui-style-box-shadow-default-66120l": undefined,
-  "--awsui-style-box-shadow-disabled-66120l": undefined,
-  "--awsui-style-box-shadow-focus-66120l": undefined,
-  "--awsui-style-box-shadow-hover-66120l": undefined,
-  "--awsui-style-box-shadow-readonly-66120l": undefined,
-  "--awsui-style-color-default-66120l": undefined,
-  "--awsui-style-color-disabled-66120l": undefined,
-  "--awsui-style-color-focus-66120l": undefined,
-  "--awsui-style-color-hover-66120l": undefined,
-  "--awsui-style-color-readonly-66120l": undefined,
-  "--awsui-style-placeholder-color-66120l": undefined,
-  "--awsui-style-placeholder-font-size-66120l": undefined,
-  "--awsui-style-placeholder-font-style-66120l": undefined,
-  "--awsui-style-placeholder-font-weight-66120l": undefined,
+  "--awsui-style-background-default-ka4djm": undefined,
+  "--awsui-style-background-disabled-ka4djm": undefined,
+  "--awsui-style-background-focus-ka4djm": undefined,
+  "--awsui-style-background-hover-ka4djm": undefined,
+  "--awsui-style-background-readonly-ka4djm": undefined,
+  "--awsui-style-border-color-default-ka4djm": undefined,
+  "--awsui-style-border-color-disabled-ka4djm": undefined,
+  "--awsui-style-border-color-focus-ka4djm": undefined,
+  "--awsui-style-border-color-hover-ka4djm": undefined,
+  "--awsui-style-border-color-readonly-ka4djm": undefined,
+  "--awsui-style-box-shadow-default-ka4djm": undefined,
+  "--awsui-style-box-shadow-disabled-ka4djm": undefined,
+  "--awsui-style-box-shadow-focus-ka4djm": undefined,
+  "--awsui-style-box-shadow-hover-ka4djm": undefined,
+  "--awsui-style-box-shadow-readonly-ka4djm": undefined,
+  "--awsui-style-color-default-ka4djm": undefined,
+  "--awsui-style-color-disabled-ka4djm": undefined,
+  "--awsui-style-color-focus-ka4djm": undefined,
+  "--awsui-style-color-hover-ka4djm": undefined,
+  "--awsui-style-color-readonly-ka4djm": undefined,
+  "--awsui-style-placeholder-color-ka4djm": undefined,
+  "--awsui-style-placeholder-font-size-ka4djm": undefined,
+  "--awsui-style-placeholder-font-style-ka4djm": undefined,
+  "--awsui-style-placeholder-font-weight-ka4djm": undefined,
   "borderRadius": undefined,
   "borderWidth": undefined,
   "fontSize": undefined,
@@ -37,30 +37,30 @@ exports[`getInputStyles handles all possible style configurations 1`] = `
 
 exports[`getInputStyles handles all possible style configurations 2`] = `
 {
-  "--awsui-style-background-default-66120l": undefined,
-  "--awsui-style-background-disabled-66120l": undefined,
-  "--awsui-style-background-focus-66120l": undefined,
-  "--awsui-style-background-hover-66120l": undefined,
-  "--awsui-style-background-readonly-66120l": undefined,
-  "--awsui-style-border-color-default-66120l": undefined,
-  "--awsui-style-border-color-disabled-66120l": undefined,
-  "--awsui-style-border-color-focus-66120l": undefined,
-  "--awsui-style-border-color-hover-66120l": undefined,
-  "--awsui-style-border-color-readonly-66120l": undefined,
-  "--awsui-style-box-shadow-default-66120l": undefined,
-  "--awsui-style-box-shadow-disabled-66120l": undefined,
-  "--awsui-style-box-shadow-focus-66120l": undefined,
-  "--awsui-style-box-shadow-hover-66120l": undefined,
-  "--awsui-style-box-shadow-readonly-66120l": undefined,
-  "--awsui-style-color-default-66120l": undefined,
-  "--awsui-style-color-disabled-66120l": undefined,
-  "--awsui-style-color-focus-66120l": undefined,
-  "--awsui-style-color-hover-66120l": undefined,
-  "--awsui-style-color-readonly-66120l": undefined,
-  "--awsui-style-placeholder-color-66120l": undefined,
-  "--awsui-style-placeholder-font-size-66120l": undefined,
-  "--awsui-style-placeholder-font-style-66120l": undefined,
-  "--awsui-style-placeholder-font-weight-66120l": undefined,
+  "--awsui-style-background-default-ka4djm": undefined,
+  "--awsui-style-background-disabled-ka4djm": undefined,
+  "--awsui-style-background-focus-ka4djm": undefined,
+  "--awsui-style-background-hover-ka4djm": undefined,
+  "--awsui-style-background-readonly-ka4djm": undefined,
+  "--awsui-style-border-color-default-ka4djm": undefined,
+  "--awsui-style-border-color-disabled-ka4djm": undefined,
+  "--awsui-style-border-color-focus-ka4djm": undefined,
+  "--awsui-style-border-color-hover-ka4djm": undefined,
+  "--awsui-style-border-color-readonly-ka4djm": undefined,
```

---

### Incident Patch 7: `818f03b7` (2026-09-28)
**Commit Message**: fix: Degrade gracefully instead of crashing on malformed locale messages (#5052)

**File**: `src/i18n/__tests__/i18n.test.tsx` (modified, +76/-0)
```diff
@@ -6,10 +6,17 @@ import { render } from '@testing-library/react';
 import * as IntlMessageFormat from 'intl-messageformat';
 import range from 'lodash/range';
 
+import { warnOnce } from '@cloudscape-design/component-toolkit/internal';
+
 import { I18nProvider, I18nProviderProps } from '../../../lib/components/i18n';
 import { namespace } from '../../../lib/components/i18n/context';
 import { MESSAGES, TestComponent } from './test-component';
 
+jest.mock('@cloudscape-design/component-toolkit/internal', () => ({
+  ...jest.requireActual('@cloudscape-design/component-toolkit/internal'),
+  warnOnce: jest.fn(),
+}));
+
 afterEach(() => {
   jest.restoreAllMocks();
 });
@@ -176,3 +183,72 @@ it('initializes an IntlMessageFormat instance once per message per render', () =
   );
   expect(constructorSpy).toHaveBeenCalledTimes(8);
 });
+
+describe('resilience against malformed messages', () => {
+  // AWSUI-62316: a message with a stale variable contract used to crash the whole page.
+
+  it('renders the component tree when a message references variables the component does not provide', () => {
+    const brokenMessages: I18nProviderProps.Messages = {
+      [namespace]: {
+        en: {
+          'test-component': {
+            topLevelFunction: '{operator, select, equals {equals} other {other}} label',
+          },
+        },
+      },
+    };
+
+    const { container } = render(
+      <I18nProvider messages={[brokenMessages]} locale="en">
+        <TestComponent />
+      </I18nProvider>
+    );
+
+    // Broken message degrades to empty string; the rest of the tree still renders.
+    expect(container.querySelector('#top-level-function')).toHaveTextContent('');
+    expect(container.querySelector('#top-level-string')).toBeInTheDocument();
+    expect(warnOnce).toHaveBeenCalledWith('I18nProvider', expect.stringContaining('Failed to format message'));
+  });
+
+  it('renders the component tree when a message has invalid ICU syntax', () => {
+    const brokenMessages: I18nProviderProps.Messages = {
+      [namespace]: {
+        en: {
+          'test-component': {
+            topLevelString: 'Unclosed {argument',
+          },
+        },
+      },
+    };
+
+    const { container } = render(
+      <I18nProvider messages={[MESSAGES, brokenMessages]} locale="en">
+        <TestComponent />
+      </I18nProvider>
+    );
+
+    // Unparseable message falls back; sibling messages are unaffected.
+    expect(container.querySelector('#top-level-string')).toHaveTextContent('');
+    expect(container.querySelector('#nested-string')).toHaveTextContent('nested string');
+  });
+
+  it('renders the component tree when a message is malformed and the value is provided via props', () => {
+    const brokenMessages: I18nProviderProps.Messages = {
+      [namespace]: {
+        en: {
+          'test-component': {
+            topLevelString: 'Unclosed {argument',
+          },
+        },
+      },
+    };
+
+    const { container } = render(
+      <I18nProvider messages={[brokenMessages]} locale="en">
+        <TestComponent topLevelString="Provided string" />
+      </I18nProvider>
+    );
+
+    expect(container.querySelector('#top-level-string')).toHaveTextContent('Provided string');
+  });
+});
```

**File**: `src/i18n/utils/__tests__/i18n-formatter.test.ts` (modified, +115/-0)
```diff
@@ -1,8 +1,19 @@
 // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 // SPDX-License-Identifier: Apache-2.0
 
+import { warnOnce } from '@cloudscape-design/component-toolkit/internal';
+
 import { I18nFormatter, I18nMessages } from '../i18n-formatter';
 
+jest.mock('@cloudscape-design/component-toolkit/internal', () => ({
+  ...jest.requireActual('@cloudscape-design/component-toolkit/internal'),
+  warnOnce: jest.fn(),
+}));
+
+afterEach(() => {
+  jest.clearAllMocks();
+});
+
 const NAMESPACE = 'test-ns';
 const COMPONENT = 'my-component';
 
@@ -59,4 +70,108 @@ describe('I18nFormatter', () => {
 
     expect(result).toBe('5 items');
   });
+
+  describe('resilience against malformed messages', () => {
+    test('does not warn for well-formed messages', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name}' }));
+      formatter.format<string | undefined, { name: string }>(NAMESPACE, COMPONENT, 'greeting', undefined, formatFn =>
+        formatFn({ name: 'World' })
+      );
+      expect(warnOnce).not.toHaveBeenCalled();
+    });
+
+    test('returns undefined and warns when a message has invalid ICU syntax', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name' }));
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Malformed message "${NAMESPACE}.${COMPONENT}.greeting" for locale "en"`)
+      );
+    });
+
+    test('returns undefined and warns when a message references a variable that is not provided', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name}' }));
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Failed to format message "${NAMESPACE}.${COMPONENT}.greeting" for locale "en"`)
+      );
+    });
+
+    test('formatting function returns an empty string and warns when formatting with a customHandler fails', () => {
+      // AWSUI-62316: the message demands variables the component no longer provides.
+      const messages = makeMessages('en', {
+        removeLabel: 'Remove filter, {token__operator, select, equals {equals} other {other}} {token__value}',
+      });
+      const formatter = new I18nFormatter('en', messages);
+
+      const result = formatter.format<string | undefined, { token__formattedText: string }>(
+        NAMESPACE,
+        COMPONENT,
+        'removeLabel',
+        undefined,
+        formatFn => formatFn({ token__formattedText: 'Name = foo' })
+      );
+
+      expect(result).toBe('');
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Failed to format message "${NAMESPACE}.${COMPONENT}.removeLabel" for locale "en"`)
+      );
+    });
+
+    test('formatting function returned by customHandler is guarded when invoked after render', () => {
+      // Parses fine, but "itemCount" isn't passed, so it throws at format time.
+      const formatter = new I18nFormatter('en', makeMessages('en', { itemCount: '{itemCount} items' }));
+
+      // formatFn is invoked later, outside the formatter's call stack. It must not throw even then.
+      const lateFormatFn = formatter.format<((count: number) => string) | undefined, { count: number }>(
+        NAMESPACE,
+        COMPONENT,
+        'itemCount',
+        undefined,
+        formatFn => count => formatFn({ count })
+      );
+
+      expect(() => lateFormatFn!(5)).not.toThrow();
+      expect(lateFormatFn!(5)).toBe('');
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Failed to format message "${NAMESPACE}.${COMPONENT}.itemCount" for locale "en"`)
+      );
+    });
+
+    test('recovers on every render when the formatter instance is cached', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name}' }));
+
+      // Second call exercises the cached-formatter path.
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+    });
+
+    test('caches a parse failure so a malformed message is not re-parsed on later calls', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name' }));
+      const cacheKey = `${NAMESPACE}.${COMPONENT}.greeting`;
+      const cache = (formatter as unknown as { _localeFormatterCache: Map<string, unknown> })._localeFormatterCache;
+
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+      // The failed parse is recorded as a null sentinel in the shared cache, so a later

```

**File**: `src/i18n/utils/i18n-formatter.ts` (modified, +35/-6)
```diff
@@ -4,6 +4,8 @@
 import { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
 import IntlMessageFormat from 'intl-messageformat';
 
+import { warnOnce } from '@cloudscape-design/component-toolkit/internal';
+
 import { CustomHandler } from '../context';
 import { getMatchableLocales } from './locales';
 import { normalizeMessages } from './messages';
@@ -37,7 +39,7 @@ export class I18nFormatter {
   // Not memoizing it allows us to reset the cache when the component rerenders
   // with potentially different locale or messages. We expect this component to
   // be placed above AppLayout and therefore rerender very infrequently.
-  private _localeFormatterCache = new Map<string, IntlMessageFormat>();
+  private _localeFormatterCache = new Map<string, IntlMessageFormat | null>();
 
   constructor(locale: string, messages: I18nMessages) {
     this._locale = locale.toLowerCase();
@@ -62,6 +64,10 @@ export class I18nFormatter {
     let intlMessageFormat: IntlMessageFormat;
 
     const cachedFormatter = this._localeFormatterCache.get(cacheKey);
+    // A null entry means this message already failed to parse; don't retry.
+    if (cachedFormatter === null) {
+      return provided;
+    }
     if (cachedFormatter) {
       // If an IntlMessageFormat instance was cached for this locale, just use that.
       intlMessageFormat = cachedFormatter;
@@ -83,14 +89,37 @@ export class I18nFormatter {
       }
 
       // Lazily create an IntlMessageFormat object for this key.
-      intlMessageFormat = new IntlMessageFormat(message, this._locale);
-      this._localeFormatterCache.set(cacheKey, intlMessageFormat);
+      // Invalid ICU syntax falls back to the provided value instead of crashing the render.
+      try {
+        intlMessageFormat = new IntlMessageFormat(message, this._locale);
+        this._localeFormatterCache.set(cacheKey, intlMessageFormat);
+      } catch (error) {
+        warnOnce('I18nProvider', `Malformed message "${cacheKey}" for locale "${this._locale}": ${error}`);
+        this._localeFormatterCache.set(cacheKey, null);
+        return provided;
+      }
     }
 
+    // Formatting can throw at runtime (e.g. a message/component contract mismatch),
+    // so degrade gracefully instead of crashing the consumer's page.
     if (customHandler) {
-      return customHandler(args => intlMessageFormat.format(args) as string);
+      // The returned formatFn may be invoked later during render, so guard it. It must return a string.
+      return customHandler(args => {
+        try {
+          return intlMessageFormat.format(args) as string;
+        } catch (error) {
+          warnOnce('I18nProvider', `Failed to format message "${cacheKey}" for locale "${this._locale}": ${error}`);
+          return '';
+        }
+      });
+    }
+    try {
+      // Assuming `ReturnValue extends string` since a customHandler wasn't provided.
+      return intlMessageFormat.format() as ReturnValue;
+    } catch (error) {
+      warnOnce('I18nProvider', `Failed to format message "${cacheKey}" for locale "${this._locale}": ${error}`);
+      // Fall back so the component's own default string logic takes over.
+      return provided;
     }
-    // Assuming `ReturnValue extends string` since a customHandler wasn't provided.
-    return intlMessageFormat.format() as ReturnValue;
   }
 }
```

---

### Incident Patch 8: `aa76658c` (2026-09-25)
**Commit Message**: fix: Fixes table sticky columns flickering (#5044)

**File**: `src/table/sticky-columns/__tests__/use-sticky-columns.test.tsx` (modified, +41/-0)
```diff
@@ -157,6 +157,47 @@ test('generates empty sticky cell state if not enough scrollable space', () => {
   });
 });
 
+test('allows for the padding the first sticky cell gets when scrolled', () => {
+  const { result, rerender } = renderHook(() =>
+    useStickyColumns({ visibleColumns: [1, 2, 3], stickyColumnsFirst: 1, stickyColumnsLast: 0 })
+  );
+  // Sticky cell 100px + minimum scrollable space 148px + table padding 20px = 268px.
+  const { wrapper, table, cells } = createMockTable(result.current, 268, 500, 100, 200, 200);
+  table.style.paddingInlineStart = table.style.paddingInlineEnd = '10px';
+  const isEnabled = () => result.current.store.get().cellState.size > 0;
+  const setWidth = (element: HTMLElement, width: number) =>
+    jest.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({ width }) as DOMRect);
+  const scroll = () => wrapper.dispatchEvent(new UIEvent('scroll'));
+
+  // Wait for effect
+  rerender({});
+  expect(isEnabled()).toBe(false);
+
+  setWidth(wrapper, 269);
+  scroll();
+  expect(isEnabled()).toBe(true);
+
+  // Scrolling applies the padding and widens the first cell, which must not disable the feature.
+  wrapper.scrollLeft = 20;
+  scroll();
+  setWidth(cells[0], 118);
+  scroll();
+  expect(result.current.store.get().cellState.get(1)?.padInlineStart).toBe(true);
+  expect(isEnabled()).toBe(true);
+
+  // With selection the padding is set but the first cell does not grow: narrowing the wrapper while scrolled keeps
+  // the feature (100px + 124px + 20px = 244px), scrolling back disables it as the wrapper is below 268px.
+  setWidth(cells[0], 100);
+  setWidth(wrapper, 260);
+  scroll();
+  expect(isEnabled()).toBe(true);
+  wrapper.scrollLeft = 0;
+  // The first update removes the padding, the next one (any later scroll or resize) evaluates without it.
+  scroll();
+  scroll();
+  expect(isEnabled()).toBe(false);
+});
+
 test('generates non-empty styles for sticky cells', () => {
   const { result, rerender } = renderHook(() =>
     useStickyColumns({ visibleColumns: [1, 2, 3], stickyColumnsFirst: 0, stickyColumnsLast: 1 })
```

**File**: `src/table/sticky-columns/use-sticky-columns.ts` (modified, +12/-4)
```diff
@@ -20,6 +20,12 @@ import { isCellStatesEqual, isWrapperStatesEqual, updateCellOffsets } from './ut
 // We allow the table to have a minimum of 148px of available space besides the sum of the widths of the sticky columns
 // This value is an UX recommendation and is approximately 1/3 of our smallest breakpoint (465px)
 const MINIMUM_SCROLLABLE_SPACE = 148;
+// The first sticky cell gets extra padding when the table is scrolled (see padInlineStart), which is then included in
+// the measured sticky width. A lower minimum applies in that case, so that applying the padding cannot disable the
+// feature. The difference must not be smaller than the padding in any theme or density mode. Removing the padding can
+// disable the feature within a range of wrapper widths up to that difference (largest for tables with selection, where
+// the padding is set but does not change the cell width).
+const MINIMUM_SCROLLABLE_SPACE_WHILE_STUCK = MINIMUM_SCROLLABLE_SPACE - 24;
 
 export interface StickyColumnsModel {
   store: ReadonlyAsyncStore<StickyColumnsState>;
@@ -367,10 +373,12 @@ class StickyColumnsStore extends AsyncStore<StickyColumnsState> {
     }
 
     const totalStickySpace = this.cellOffsets.stickyWidthInlineStart + this.cellOffsets.stickyWidthInlineEnd;
-    const tablePaddingLeft = parseFloat(getComputedStyle(props.table).paddingLeft) || 0;
-    const tablePaddingRight = parseFloat(getComputedStyle(props.table).paddingRight) || 0;
-    const hasEnoughScrollableSpace =
-      totalStickySpace + MINIMUM_SCROLLABLE_SPACE + tablePaddingLeft + tablePaddingRight < wrapperWidth;
+    const tablePaddingInlineStart = parseFloat(getComputedStyle(props.table).paddingInlineStart) || 0;
+    const tablePaddingInlineEnd = parseFloat(getComputedStyle(props.table).paddingInlineEnd) || 0;
+    const tablePaddings = tablePaddingInlineStart + tablePaddingInlineEnd;
+    const isFirstCellPadded = this.get().cellState.get(props.visibleColumns[0])?.padInlineStart ?? false;
+    const minimumScrollableSpace = isFirstCellPadded ? MINIMUM_SCROLLABLE_SPACE_WHILE_STUCK : MINIMUM_SCROLLABLE_SPACE;
+    const hasEnoughScrollableSpace = minimumScrollableSpace < wrapperWidth - totalStickySpace - tablePaddings;
     if (!hasEnoughScrollableSpace) {
       return false;
     }
```

---

### Incident Patch 9: `6208f4ae` (2026-09-25)
**Commit Message**: fix: Migrate th locale PropertyFilter messages to current contract (#5050)

Co-authored-by: Nathnael Dereje <[REDACTED_EMAIL]>

**File**: `src/i18n/messages/all.th.json` (modified, +1/-1)
```diff
@@ -199,7 +199,7 @@
     "i18nStrings.tokenLimitShowFewer": "แสดงน้อยลง",
     "i18nStrings.tokenLimitShowMore": "แสดงเพิ่มเติม",
     "i18nStrings.valueText": "ค่า",
-    "i18nStrings.removeTokenButtonAriaLabel": "{token__operator, select, equals {ลบตัวกรอง {token__propertyLabel} เท่ากับ {token__value}} not_equals {ลบตัวกรอง {token__propertyLabel} ไม่เท่ากับ {token__value}} greater_than {ลบตัวกรอง {token__propertyLabel} มากกว่า {token__value}} greater_than_equal {ลบตัวกรอง {token__propertyLabel} มากกว่าหรือเท่ากับ {token__value}} less_than {ลบตัวกรอง {token__propertyLabel} น้อยกว่า {token__value}} less_than_equal {ลบตัวกรอง {token__propertyLabel} น้อยกว่าหรือเท่ากับ {token__value}} contains {ลบตัวกรอง {token__propertyLabel} ประกอบด้วย {token__value}} not_contains {ลบตัวกรอง {token__propertyLabel} ไม่มี {token__value}} starts_with {ลบตัวกรอง {token__propertyLabel} เริ่มต้นด้วย {token__value}} other {}}"
+    "i18nStrings.removeTokenButtonAriaLabel": "ลบตัวกรอง {token__formattedText}"
   },
   "s3-resource-selector": {
     "i18nStrings.inContextSelectPlaceholder": "เลือกเวอร์ชัน",
```

---

### Incident Patch 10: `3fb837bc` (2026-09-22)
**Commit Message**: fix: Align container header with description in One Theme (#5035)

**File**: `src/expandable-section/styles.scss` (modified, +16/-0)
```diff
@@ -30,6 +30,12 @@ $icon-offset-container: awsui.$space-xxs;
 // Useful to keep elements correctly aligned.
 $icon-total-space-normal: calc(#{$icon-width-normal} + #{$icon-margin-left} + #{$icon-margin-right-normal});
 $icon-total-space-medium: calc(#{$icon-width-medium} + #{$icon-margin-left} + #{$icon-margin-right-medium});
+// In One Theme the container caret is an x-small (12px) icon with no start margin and
+// $icon-margin-right-small as end margin (see .icon-container below), so it occupies less
+// space than the medium caret. Keep in sync with that rule and with the icon size chosen
+// in expandable-section-header.tsx.
+$icon-width-x-small: 12px;
+$icon-total-space-container-one-theme: calc(#{$icon-width-x-small} + #{$icon-margin-right-small});
 
 // Extra inline padding that widens the navigation caret pointer target to 24px (WCAG 2.5.8).
 $nav-caret-pad-normal: calc(24px - #{$icon-width-normal});
@@ -200,6 +206,9 @@ $nav-caret-pad-one-theme: 12px; // 24px minus the one-theme x-small (12px) icon
     }
     &:not(.header-deprecated) {
       padding-inline-start: calc(#{container.$header-padding-horizontal} + #{$icon-total-space-medium});
+      @include theming.one-theme-only {
+        padding-inline-start: calc(#{container.$header-padding-horizontal} + #{$icon-total-space-container-one-theme});
+      }
     }
 
     @include focus-visible.when-visible {
@@ -252,6 +261,13 @@ $nav-caret-pad-one-theme: 12px; // 24px minus the one-theme x-small (12px) icon
 
   &-container-button {
     margin-inline-start: calc(-1 * #{$icon-total-space-medium});
+    // Only when the caret is at the start. The end-icon layout resets this margin
+    // below (.header-button-icon-end) and a theme-scoped rule would outrank that reset.
+    &:not(.header-button-icon-end) {
+      @include theming.one-theme-only {
+        margin-inline-start: calc(-1 * #{$icon-total-space-container-one-theme});
+      }
+    }
   }
 
   &-container {
```

---

### Incident Patch 11: `7fbd2ff6` (2026-09-21)
**Commit Message**: chore: Report success for visual regression in the merge queue (#5036)

**File**: `.github/workflows/visual-regression-merge-queue.yml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+name: Visual regression (merge queue)
+
+# Reports the required "Visual regression result" check on the merge-queue branch.
+# The real comparison runs on pull_request (deploy.yml); it is not run again in the merge queue.
+
+on:
+  merge_group:
+
+permissions:
+  contents: read
+
+jobs:
+  visual-regression-result:
+    name: Visual regression result
+    runs-on: ubuntu-latest
+    steps:
+      - name: Pass in merge queue
+        run: echo "Visual regression not re-run; already validated on the PR head. Marking as passed."
```

---

### Incident Patch 12: `dedd0713` (2026-09-17)
**Commit Message**: fix: Show table empty state when skeleton is enabled and load completes with no items (#5013)

**File**: `src/table/__tests__/skeleton.test.tsx` (modified, +11/-0)
```diff
@@ -49,6 +49,17 @@ describe('Table skeleton loading', () => {
       expect(rows).toHaveLength(0);
     });
 
+    test('renders the empty state when loading has finished with no items', () => {
+      const wrapper = renderTable({
+        items: [],
+        loading: false,
+        skeleton: { totalRows: 5 },
+        empty: 'No resources',
+      });
+      expect(wrapper.findAll('tr[aria-hidden="true"]')).toHaveLength(0);
+      expect(wrapper.findTable()!.findEmptySlot()!.getElement()).toHaveTextContent('No resources');
+    });
+
     test('renders a screen-reader-only loading announcement', () => {
       const wrapper = renderTable({
         items: [],
```

**File**: `src/table/internal.tsx` (modified, +1/-1)
```diff
@@ -681,7 +681,7 @@ const InternalTable = React.forwardRef(
                           colIndexOffset={colIndexOffset}
                           renderCell={skeleton?.renderCell}
                         />
-                      ) : !skeleton && (loading || allItems.length === 0) ? (
+                      ) : allItems.length === 0 || (loading && !skeleton) ? (
                         <tr>
                           <NoDataCell
                             totalColumnsCount={totalColumnsCount}
```

---

### Incident Patch 13: `ac914645` (2026-09-17)
**Commit Message**: fix: Aligns locale fallback handling in calendar and date range picker (#5017)

**File**: `src/__tests__/snapshot-tests/__snapshots__/documenter.test.ts.snap` (modified, +6/-3)
```diff
@@ -7746,7 +7746,8 @@ as you would for other form elements.",
     {
       "defaultValue": "''",
       "description": "Specifies the locale to use to render month names and determine the starting day of the week.
-If you don't provide this, the locale is determined by the page and browser locales.
+If you don't provide this, the locale is determined by the locale of the surrounding I18nProvider,
+or the page and browser locales otherwise.
 Supported values and formats are listed in the
 [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).",
       "name": "locale",
@@ -11416,7 +11417,8 @@ as you would for other form elements.",
     },
     {
       "description": "Specifies the locale to use to render month names and determine the starting day of the week.
-If you don't provide this, the locale is determined by the page and browser locales.
+If you don't provide this, the locale is determined by the locale of the surrounding I18nProvider,
+or the page and browser locales otherwise.
 Supported values and formats are listed in the
 [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).",
       "name": "locale",
@@ -12149,7 +12151,8 @@ Ensure that your function checks for missing fields in the value.",
       "defaultValue": "''",
       "description": "The locale to be used for rendering month names and defining the
 starting date of the week. If not provided, it will be determined
-from the page and browser locales. Supported values and formats
+from the locale of the surrounding I18nProvider,
+or the page and browser locales otherwise. Supported values and formats
 are as-per the [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).",
       "name": "locale",
       "optional": true,
```

**File**: `src/calendar/__tests__/calendar.test.tsx` (modified, +24/-0)
```diff
@@ -9,6 +9,7 @@ import MockDate from 'mockdate';
 
 import '../../__a11y__/to-validate-a11y';
 import Calendar, { CalendarProps } from '../../../lib/components/calendar';
+import TestI18nProvider from '../../../lib/components/i18n/testing';
 import { KeyCode } from '../../../lib/components/internal/keycode';
 import createWrapper, { CalendarWrapper } from '../../../lib/components/test-utils/dom';
 
@@ -99,6 +100,29 @@ describe('Calendar locale DE', () => {
   });
 });
 
+describe('Calendar I18nProvider locale', () => {
+  function renderWithProvider(props: CalendarProps = defaultProps) {
+    const { container } = render(
+      <TestI18nProvider messages={{}} locale="de-DE">
+        <Calendar {...props} />
+      </TestI18nProvider>
+    );
+    return createWrapper(container).findCalendar()!;
+  }
+
+  test('uses I18nProvider locale when no locale property is provided', () => {
+    const wrapper = renderWithProvider({ ...defaultProps, value: '2022-01-07' });
+    expect(findCalendarWeekdays(wrapper)[0]).toBe('Mo');
+    expect(wrapper.findHeader().getElement()).toHaveTextContent('Januar 2022');
+  });
+
+  test('explicit locale property takes precedence over I18nProvider locale', () => {
+    const wrapper = renderWithProvider({ ...defaultProps, value: '2022-01-07', locale: 'en-US' });
+    expect(findCalendarWeekdays(wrapper)[0]).toBe('Sun');
+    expect(wrapper.findHeader().getElement()).toHaveTextContent('January 2022');
+  });
+});
+
 describe('aria labels', () => {
   describe('aria-label', () => {
     test('can be set', () => {
```

**File**: `src/calendar/interfaces.ts` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ export interface CalendarProps extends BaseComponentProps {
 
   /**
    * Specifies the locale to use to render month names and determine the starting day of the week.
-   * If you don't provide this, the locale is determined by the page and browser locales.
+   * If you don't provide this, the locale is determined by the locale of the surrounding I18nProvider,
+   * or the page and browser locales otherwise.
    * Supported values and formats are listed in the
    * [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).
    */
```

**File**: `src/calendar/internal.tsx` (modified, +3/-1)
```diff
@@ -7,6 +7,7 @@ import { addMonths, addYears, isSameDay, isSameMonth, isSameYear } from 'date-fn
 
 import { useUniqueId } from '@cloudscape-design/component-toolkit/internal';
 
+import { useLocale } from '../i18n/context.js';
 import { getBaseProps } from '../internal/base-component';
 import { fireNonCancelableEvent } from '../internal/events/index.js';
 import checkControlled from '../internal/hooks/check-controlled/index.js';
@@ -50,7 +51,8 @@ export default function Calendar({
   checkControlled('Calendar', 'value', value, 'onChange', onChange);
 
   const baseProps = getBaseProps(rest);
-  const normalizedLocale = normalizeLocale('Calendar', locale);
+  const contextLocale = useLocale();
+  const normalizedLocale = normalizeLocale('Calendar', locale || contextLocale);
 
   const gridWrapperRef = useRef<HTMLDivElement>(null);
   const [focusedDate, setFocusedDate] = useState<Date | null>(null);
```

**File**: `src/date-range-picker/__tests__/date-range-picker.test.tsx` (modified, +29/-0)
```diff
@@ -586,6 +586,35 @@ describe('Date range picker', () => {
   });
 });
 
+describe('I18nProvider locale', () => {
+  const value: DateRangePickerProps.Value = {
+    type: 'absolute',
+    startDate: '2020-03-02T05:00:00+00:00',
+    endDate: '2020-03-12T13:05:21+00:00',
+  };
+
+  function renderWithProviderLocale(props?: Partial<DateRangePickerProps>) {
+    const { container } = render(
+      <TestI18nProvider messages={{}} locale="de-DE">
+        <DateRangePicker {...defaultProps} locale={undefined} value={value} {...props} />
+      </TestI18nProvider>
+    );
+    const wrapper = createWrapper(container).findDateRangePicker()!;
+    wrapper.openDropdown();
+    return wrapper;
+  }
+
+  test('uses I18nProvider locale when no locale property is provided', () => {
+    const wrapper = renderWithProviderLocale();
+    expect(wrapper.findDropdown()!.findHeader().getElement()).toHaveTextContent('März 2020');
+  });
+
+  test('explicit locale property takes precedence over I18nProvider locale', () => {
+    const wrapper = renderWithProviderLocale({ locale: 'en-US' });
+    expect(wrapper.findDropdown()!.findHeader().getElement()).toHaveTextContent('March 2020');
+  });
+});
+
 describe('renderTriggerContent', () => {
   test('renders custom trigger content when provided', () => {
     const { wrapper } = renderDateRangePicker({
```

**File**: `src/date-range-picker/index.tsx` (modified, +3/-2)
```diff
@@ -7,7 +7,7 @@ import clsx from 'clsx';
 import { useMergeRefs, useUniqueId, warnOnce } from '@cloudscape-design/component-toolkit/internal';
 
 import Dropdown from '../dropdown/internal';
-import { useInternalI18n } from '../i18n/context';
+import { useInternalI18n, useLocale } from '../i18n/context';
 import InternalIcon from '../icon/internal';
 import { getBaseProps } from '../internal/base-component';
 import ButtonTrigger from '../internal/components/button-trigger';
@@ -175,7 +175,8 @@ const DateRangePicker = React.forwardRef(
 
     const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(false);
 
-    const normalizedLocale = normalizeLocale('DateRangePicker', locale);
+    const contextLocale = useLocale();
+    const normalizedLocale = normalizeLocale('DateRangePicker', locale || contextLocale);
 
     const closeDropdown = (focusTrigger = false) => {
       setIsDropDownOpen(false);
```

**File**: `src/date-range-picker/interfaces.ts` (modified, +2/-1)
```diff
@@ -41,7 +41,8 @@ export interface DateRangePickerBaseProps {
   /**
    * The locale to be used for rendering month names and defining the
    * starting date of the week. If not provided, it will be determined
-   * from the page and browser locales. Supported values and formats
+   * from the locale of the surrounding I18nProvider,
+   * or the page and browser locales otherwise. Supported values and formats
    * are as-per the [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).
    */
   locale?: string;
```

**File**: `src/internal/utils/locale/__tests__/normalize-locale.test.ts` (modified, +6/-0)
```diff
@@ -40,6 +40,12 @@ describe('normalizeLocale', () => {
     expect(normalizeLocale('DatePickerTest', 'zh_CN')).toBe('zh-CN');
   });
 
+  test('should normalize casing to aa-BB', () => {
+    expect(normalizeLocale('DatePickerTest', 'de-de')).toBe('de-DE');
+    expect(normalizeLocale('DatePickerTest', 'DE-DE')).toBe('de-DE');
+    expect(normalizeLocale('DatePickerTest', 'EN')).toBe('en-US');
+  });
+
   test('should warn if the provided value is in invalid format', () => {
     expect(normalizeLocale('DatePickerTest', 'not-locale')).toBe('en-US');
     expect(consoleSpy).toHaveBeenCalledWith(
```

---

### Incident Patch 14: `3dc4191d` (2026-09-16)
**Commit Message**: chore: Add workflow to override visual regression test results (#4954)

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `.github/workflows/deploy.yml` (modified, +53/-0)
```diff
@@ -15,6 +15,7 @@ permissions:
   id-token: write
   actions: read
   contents: read
+  statuses: read # Needed to check if the visual regression test result has been overridden
   deployments: write
 
 jobs:
@@ -135,3 +136,55 @@ jobs:
       test-utils-artifact-name: test-utils-selectors
       baseline-artifact-name: visual-baseline-pages
       caller-run-id: ${{ github.run_id }}
+      commit-sha: ${{ github.event.pull_request.head.sha }}
+
+  # Required status check for branch protection. Runs for every PR so the context
+  # is always reported.
+  #
+  # It passes when any of these hold:
+  #   - the PR is from a fork (visual regression cannot run, so it is skipped);
+  #   - the visual job succeeded;
+  #   - the commit has a maintainer override status.
+  #
+  # The override is checked directly here (not only via the visual job result) so
+  # that after an override this job can be re-run on its own to turn the check
+  # green, without rebuilding or redeploying the (unchanged) pages.
+  visual-regression-result:
+    name: Visual regression result
+    needs: [visual]
+    if: always()
+    runs-on: ubuntu-latest
+    steps:
+      - name: Evaluate result
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ github.event.pull_request.head.sha }}
+          IS_FORK: ${{ github.event.pull_request.head.repo.full_name != github.repository }}
+          VISUAL_RESULT: ${{ needs.visual.result }}
+        run: |
+          if [ "$IS_FORK" = "true" ]; then
+            echo "::notice::Fork pull request: visual regression does not run. Marking as passed."
+            exit 0
+          fi
+
+          if [ "$VISUAL_RESULT" = "success" ]; then
+            echo "Visual regression passed."
+            exit 0
+          fi
+
+          if [ "$VISUAL_RESULT" = "skipped" ] || [ "$VISUAL_RESULT" = "cancelled" ]; then
+            echo "::error::Visual regression did not run (result: ${VISUAL_RESULT})."
+            exit 1
+          fi
+
+          OVERRIDDEN=$(gh api \
+            "repos/${REPO}/commits/${SHA}/status" \
+            --jq 'any(.statuses[]; .context == "visual-regression-override" and .state == "success")' 2>/dev/null || echo "false")
+          if [ "$OVERRIDDEN" = "true" ]; then
+            echo "::notice::Visual regression was overridden for this commit by a maintainer. Marking as passed."
+            exit 0
+          fi
+
+          echo "::error::Visual regression did not pass (result: ${VISUAL_RESULT}). If the differences are intentional, comment '/override-visual-regression <justification>' on the PR."
+          exit 1
```

**File**: `.github/workflows/visual-regression-override.yml` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+name: Override visual regression
+
+# Overrides the mandatory visual regression check when the visual differences are
+# intentional.
+#
+# The override is scoped to a single commit: pushing a new commit produces a new
+# SHA with no override status, so the comparison runs again.
+#
+# Two ways to trigger it:
+#   1. Comment `/override-visual-regression <justification>` on the pull request
+#      (right from the PR page). Only users with write or admin access can do this.
+#   2. Run it manually from the Actions tab, passing a commit SHA.
+
+on:
+  issue_comment:
+    types: [created]
+  workflow_dispatch:
+    inputs:
+      commit-sha:
+        description: 'The commit SHA whose visual changes are intentional.'
+        required: true
+        type: string
+
+# Run one override at a time per PR (comment) or per commit (manual dispatch).
+concurrency:
+  group: visual-regression-override@${{ github.event.issue.number || inputs.commit-sha }}
+  cancel-in-progress: true
+
+permissions:
+  statuses: write # Needed to post the override commit status
+  actions: write # Needed to re-run the deploy workflow
+  pull-requests: read # Needed to resolve PR head SHA for issue_comment overrides
+
+jobs:
+  override:
+    name: Apply visual regression override
+    # Override comments must be posted on a PR and start with the command; the trailing
+    # space requires text after it, which serves as the override justification
+    # (for example: "/override-visual-regression Expected padding changes in Container border radii").
+    # Manual runs (workflow_dispatch) skip the comment check.
+    if: >-
+      github.event_name == 'workflow_dispatch' ||
+      (github.event.issue.pull_request != null &&
+       startsWith(github.event.comment.body, '/override-visual-regression '))
+    runs-on: ubuntu-latest
+    steps:
+      - name: Authorize commenter
+        if: github.event_name == 'issue_comment'
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          ACTOR: ${{ github.actor }}
+        run: |
+          PERMISSION=$(gh api "repos/${REPO}/collaborators/${ACTOR}/permission" --jq '.permission' 2>/dev/null || echo "none")
+          echo "@${ACTOR} has '${PERMISSION}' permission."
+          case "$PERMISSION" in
+            admin|write|maintain)
+              echo "Authorized." ;;
+            *)
+              echo "::error::@${ACTOR} is not authorized to override the visual regression check (requires admin, write or maintain access)."
+              exit 1 ;;
+          esac
+
+      - name: Resolve the commit SHA
+        id: resolve
+        if: success()
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          EVENT_NAME: ${{ github.event_name }}
+          INPUT_SHA: ${{ inputs.commit-sha }}
+          COMMENT_PR: ${{ github.event.issue.number }}
+        run: |
+          if [ "$EVENT_NAME" = "issue_comment" ]; then
+            # Resolve the head commit of the PR the command was posted on.
+            RESOLVED=$(gh api "repos/${REPO}/pulls/${COMMENT_PR}" --jq '.head.sha')
+          else
+            # workflow_dispatch: the SHA is provided directly.
+            RESOLVED="$INPUT_SHA"
+          fi
+
+          if [ -z "$RESOLVED" ]; then
+            echo "::error::Could not resolve a commit SHA to override."
+            exit 1
+          fi
+
+          echo "Overriding visual regression for commit ${RESOLVED}."
+          echo "sha=${RESOLVED}" >> "$GITHUB_OUTPUT"
+
+      - name: Post override commit status
+        if: steps.resolve.outputs.sha != ''
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ steps.resolve.outputs.sha }}
+          ACTOR: ${{ github.actor }}
+          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
+        run: |
+          gh api --method POST "repos/${REPO}/statuses/${SHA}" \
+            -f state="success" \
+            -f context="visual-regression-override" \
+            -f description="Visual changes reviewed and approved by @${ACTOR}" \
+            -f target_url="${RUN_URL}" >/dev/null
+          echo "Posted visual-regression-override success status on ${SHA}, approved by @${ACTOR}."
+
+      - name: Re-run the failed check to pick up the override
+        if: steps.resolve.outputs.sha != ''
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ steps.resolve.outputs.sha }}
+        run: |
+          RUN_ID=$(gh api \
+            "repos/${REPO}/actions/workflows/deploy.yml/runs?head_sha=${SHA}&per_page=1" \
+            --jq '.workflow_runs[0].id // empty')
+
+          if [ -n "$RUN_ID" ]; then
+            # Re-run only the failed jobs (the "Visual regression result" gate),
+            # not the whole run, so the build and deploy jobs are not repeated.
+            ec
```

**File**: `.github/workflows/visual-regression.yml` (modified, +42/-4)
```diff
@@ -15,6 +15,10 @@ on:
         description: 'Name of the artifact containing baseline pages (built by the caller workflow).'
         required: true
         type: string
+      commit-sha:
+        description: 'The commit SHA under test, used to check for a per-commit override.'
+        required: false
+        type: string
 
 defaults:
   run:
@@ -24,11 +28,45 @@ permissions:
   id-token: write
   contents: read
   actions: read
+  statuses: read
   deployments: write
 
 jobs:
+  # Checks whether a maintainer has explicitly approved the visual changes for
+  # this exact commit via the manual override workflow
+  # (.github/workflows/visual-regression-override.yml). The approval is a commit
+  # status posted on the head SHA, so it applies only to that commit: a new push
+  # produces a new SHA with no override and the comparison runs again.
+  check-override:
+    name: Check for commit override
+    runs-on: ubuntu-latest
+    outputs:
+      overridden: ${{ steps.status.outputs.overridden }}
+    steps:
+      - name: Look for override commit status
+        id: status
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ inputs.commit-sha }}
+        run: |
+          if [ -z "$SHA" ]; then
+            echo "No commit SHA provided; treating as not overridden."
+            echo "overridden=false" >> "$GITHUB_OUTPUT"
+            exit 0
+          fi
+          OVERRIDDEN=$(gh api \
+            "repos/${REPO}/commits/${SHA}/status" \
+            --jq 'any(.statuses[]; .context == "visual-regression-override" and .state == "success")' 2>/dev/null || echo "false")
+          echo "Override status present for ${SHA}: ${OVERRIDDEN}"
+          echo "overridden=${OVERRIDDEN}" >> "$GITHUB_OUTPUT"
+
   visual:
     name: Visual regression (shard ${{ matrix.shard }})
+    needs: check-override
+    # Skip the (expensive) screenshot comparison when the changes have been
+    # explicitly overridden by a maintainer.
+    if: ${{ needs.check-override.outputs.overridden != 'true' }}
     runs-on: ubuntu-latest
     strategy:
       fail-fast: false
@@ -130,8 +168,8 @@ jobs:
 
   report:
     name: Generate Allure Report
-    if: always()
-    needs: [visual]
+    if: ${{ always() && needs.check-override.outputs.overridden != 'true' }}
+    needs: [check-override, visual]
     runs-on: ubuntu-latest
     steps:
       - name: Setup Node.js
@@ -158,8 +196,8 @@ jobs:
 
   deploy-report:
     name: Deploy Allure Report
-    if: always()
-    needs: [report]
+    if: ${{ always() && needs.check-override.outputs.overridden != 'true' }}
+    needs: [check-override, report]
     uses: cloudscape-design/actions/.github/workflows/deploy.yml@main
     secrets: inherit
     with:
```

**File**: `docs/RUNNING_TESTS.md` (modified, +25/-5)
```diff
@@ -75,14 +75,34 @@ The deploy workflow (`.github/workflows/deploy.yml`) orchestrates the full pipel
 
 The visual regression workflow (`.github/workflows/visual-regression.yml`):
 
-1. Resolves the PR deployment URL from the GitHub Deployments API.
-2. Serves the baseline pages locally.
-3. Runs the test suite sharded across multiple runners. Each test navigates to a page on both hosts, captures screenshots, and compares them pixel-by-pixel.
-4. Produces an Allure report with image diffs for any failures, deployed to a preview environment.
+1. Checks the commit for a `visual-regression-override` status (see [Overriding](#overriding-intentional-visual-changes) below).
+2. Resolves the PR deployment URL from the GitHub Deployments API.
+3. Serves the baseline pages locally.
+4. Runs the test suite sharded across multiple runners. Each test navigates to a page on both hosts, captures screenshots, and compares them pixel-by-pixel.
+5. Produces an Allure report with image diffs for any failures, deployed to a preview environment.
+6. The deploy workflow's `Visual regression result` job surfaces the pass/fail outcome as the required check.
+
+The `Visual regression result` check (from `deploy.yml`) passes when every shard passes, when the commit is overridden (see below), or for fork PRs where visual regression is skipped.
 
 ### Reviewing failures
 
-When the CI job fails, check the deployed Allure report (linked from the GitHub deployment). It shows expected vs actual vs diff images for each failing test. If the diff is expected (intentional visual change), note it in your PR description.
+When the CI job fails, check the deployed Allure report (linked from the GitHub deployment). It shows expected vs actual vs diff images for each failing test. If the diff is expected (intentional visual change), override the check as described below.
+
+### Overriding intentional visual changes
+
+Because baselines are rebuilt from `origin/main` at run time (there are no committed
+screenshots to update), an intentional visual change is approved by overriding the
+check rather than by updating snapshots.
+
+The override is **scoped to a single commit**. It approves the exact SHA you reviewed;
+pushing a new commit produces a new SHA with no override, so the comparison runs again.
+
+To override, first confirm the diffs in the Allure report are intentional, then use either method:
+
+- **From the PR page (recommended):** comment `/override-visual-regression <Reason to override>` on the pull request.
+- **From the Actions tab:** run the **Override visual regression** workflow (`.github/workflows/visual-regression-override.yml`) manually, passing the commit SHA to approve.
+
+Either way the workflow posts a `visual-regression-override` success commit status on that SHA and re-runs the deploy workflow. On the re-run, the screenshot comparison is skipped and the `Visual regression result` check passes.
 
 ### Adding tests for a new component
 
```

---

### Incident Patch 15: `e26ae03c` (2026-09-16)
**Commit Message**: chore: Add visual regression test for input inline label (#4979)

**File**: `test/definitions/visual/input.ts` (modified, +5/-0)
```diff
@@ -16,6 +16,11 @@ const suite: TestSuite = {
       path: 'input/style-permutations',
       screenshotType: 'permutations',
     },
+    {
+      description: 'Inline label permutations',
+      path: 'input/inline-label-permutations',
+      screenshotType: 'permutations',
+    },
   ],
 };
 
```

#### Recent Merged Pull Requests:
- **PR #5102** (2026-10-05): fix: Remove top margin from custom vertical steps connector (@lasley)
- **PR #5101** (2026-10-05): chore: Remediate 11 Dependabot security alerts (lockfile only) (@amanabiy)
- **PR #5099** (2026-10-05): chore: Add visual test definition for control group (@jperals)
- **PR #5097** (closed): chore: Bump brace-expansion (@dependabot[bot])
- **PR #5096** (closed): chore: Bump undici (@dependabot[bot])
- **PR #5095** (2026-10-02): chore: Move visual test writing docs to a better fitting file (@jperals)
- **PR #5094** (2026-10-02): chore: Bump axios from 1.18.1 to 1.20.0 (@dependabot[bot])
- **PR #5093** (closed): chore: Bump moment from 2.30.1 to 2.31.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
