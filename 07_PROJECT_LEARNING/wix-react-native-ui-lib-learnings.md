# Forensic Learning Record (Deep Inspection): wix/react-native-ui-lib

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-ui-lib-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-ui-lib](https://github.com/wix/react-native-ui-lib))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:34.711Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-ui-lib`
- **Description**: UI Components Library for React Native
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7157 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  extends: ['plugin:@typescript-eslint/recommended', 'wix/react-native', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  // plugins: ['@typescript-eslint'],
  rules: {
    /* Disabled rules for typescript */
    'no-dupe-class-members': 'off',
    'no-undef': 'off',
    /* Other Rules */
    'no-unused-expressions': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: `CallExpression[callee.object.name='console'][callee.property.name='error']`,
        message: 'Using console.error is not allowed as it is sent to Sentry, please use LogService.error instead'
      }
    ],
    'arrow-parens': 'off',
    // TODO: remove after migration of legacy lifecycle methods
    camelcase: 'off',
    'comma-dangle': ['error', 'never'],
    complexity: ['warn', {max: 25}],
    'no-mixed-operators': ['off'],
    'no-trailing-spaces': 'off',
    'operator-linebreak': 'off',
    'max-len': ['warn', {code: 120, ignoreComments: true, ignoreStrings: true}],
    'react/jsx-no-bind': [
      'off',
      {
        ignoreRefs: true,
        allowArrowFunctions: false,
        allowBind: false
      }
    ],
    'function-paren-newline': ['warn', 'never'],
    'new-cap': ['off'], // TODO: fix this in colors.js and remove this
    'default-case': ['off'],
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/member-delimiter-style': 0,
    '@typescript-eslint/no-unused-vars': [2, {args: 'all', argsIgnorePattern: '^_'}],
    // "@typescript-eslint/no-unused-vars": 0, //todo: uncomment this line and use the the better unused rule above ^
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/explicit-member-accessibility': 0,
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/ban-ts-ignore': 0,
    '@typescript-eslint/ban-ts-comment': 0,
    '@typescript-eslint/ban-types': 0,
    '@typescript-eslint/no-empty-function': 0,
    '@typescript-eslint/camelcase': 0,
    '@typescript-eslint/indent': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0
  }
};

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    test: {
      presets: [
        [
          'module:@react-native/babel-preset',
          {
            disableStaticViewConfigsCodegen: true
          }
        ]
      ]
    }
  },
  plugins: [
    'react-native-reanimated/plugin',
    [
      'module-resolver',
      {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        root: ['.'],
        alias: {
          'react-native-ui-lib': './src/index.ts',
          commons: './src/commons',
          helpers: './src/helpers',
          utils: './src/utils',
          hooks: './src/hooks',
          optionalDeps: './src/optionalDependencies',
          services: './src/services',
          style: './src/style'
        }
      }
    ]
  ]
};

```

### Core Architecture Module: `demo/scripts/releaseDemo.js`
```
const exec = require('shell-utils').exec;
const semver = require('semver');
const _ = require('lodash');
const p = require('path');
const cp = require('child_process');

// Workaround JS

const isRelease = process.env.BUILDKITE_MESSAGE.match(/^release$/i);
let VERSION;
if (isRelease) {
  VERSION = cp.execSync(`buildkite-agent meta-data get version`).toString();
}

const VERSION_TAG = isRelease ? 'latest' : 'snapshot';
const VERSION_INC = 'patch';

function run() {
  if (!validateEnv()) {
    console.log('Do not release demo');
    return;
  }

  console.log('Release demo');
  createNpmRc();
  versionTagAndPublish();
}

function validateEnv() {
  if (!process.env.CI) {
    throw new Error('releasing is only available from CI');
  }
  return (
    process.env.BUILDKITE_BRANCH === 'master' ||
    process.env.BUILDKITE_MESSAGE?.match?.(/^release$/i) ||
    process.env.BUILDKITE_MESSAGE === 'snapshot'
  );
}

function createNpmRc() {
  exec.execSync('rm -f package-lock.json');
  const npmrcPath = p.resolve(`${__dirname}/.npmrc`);
  exec.execSync(`cp -rf ${npmrcPath} .`);
}

function versionTagAndPublish() {
  const currentPublished = findCurrentPublishedVersion();
  console.log(`current published version: ${currentPublished}`);

  const version = isRelease ? VERSION : `${currentPublished}-snapshot.${process.env.BUILDKITE_BUILD_NUMBER}`;
  console.log(`Publishing version: ${version}`);

  tryPublishAndTag(version);
}

function findCurrentPublishedVersion() {
  const pkg = isRelease ? process.env.npm_package_name : 'react-native-ui-lib';
  return exec.execSyncRead(`npm view ${pkg} dist-tags.latest`);
}

function tryPublishAndTag(version) {
  let theCandidate = version;
  for (let retry = 0; retry < 5; retry++) {
    try {
      tagAndPublish(theCandidate);
      console.log(`Released ${theCandidate}`);
      return;
    } catch (err) {
      const alreadyPublished = _.includes(err.toString(), 'You cannot publish over the previously published version');
      if (!alreadyPublished) {
        throw err;
      }
      console.log(`previously published. retrying with increased ${VERSION_INC}...`);
      theCandidate = semver.inc(theCandidate, VERSION_INC);
    }
  }
}

function tagAndPublish(newVersion) {
  console.log(`trying to publish ${newVersion}...`);
  exec.execSync(`npm --no-git-tag-version version ${newVersion}`);
  exec.execSync(`npm publish --tag ${VERSION_TAG}`);
}

run();

```

### Core Architecture Module: `demo/src/configurations.js`
```
import {Assets, Colors, Typography, Spacings} from 'react-native-ui-lib'; // eslint-disable-line

export const loadDemoConfigurations = () => {
  Assets.loadAssetsGroup('icons.demo', {
    chevronDown: require('./assets/icons/chevronDown.png'),
    chevronRight: require('./assets/icons/chevronRight.png'),
    add: require('./assets/icons/add.png'),
    camera: require('./assets/icons/cameraSelected.png'),
    close: require('./assets/icons/close.png'),
    dashboard: require('./assets/icons/dashboard.png'),
    drag: require('./assets/icons/drag.png'),
    image: require('./assets/icons/image.png'),
    plus: require('./assets/icons/plus.png'),
    refresh: require('./assets/icons/refresh.png'),
    search: require('./assets/icons/search.png'),
    settings: require('./assets/icons/settings.png'),
    share: require('./assets/icons/share.png'),
    info: require('./assets/icons/info.png'),
    exclamation: require('./assets/icons/exclamationFillSmall.png'),
    check: require('./assets/icons/check.png'),
    x: require('./assets/icons/x.png'),
    minus: require('./assets/icons/minusSmall.png')
  });

  Assets.loadAssetsGroup('images.demo', {
    brokenImage: require('./assets/images/placeholderMissingImage.png')
  });

  Assets.loadAssetsGroup('svgs.demo', {
    logo: require('./assets/svgs/headerLogo.svg').default
  });

  Typography.loadTypographies({
    h1: {...Typography.text40},
    h2: {...Typography.text50},
    h3: {...Typography.text70M},
    body: Typography.text70,
    bodySmall: Typography.text80
  });

  Spacings.loadSpacings({
    page: Spacings.s5
  });

  /* Dark Mode Schemes */
  Colors.loadSchemes({
    light: {
      screenBG: Colors.white,
      textColor: Colors.grey10,
      moonOrSun: Colors.yellow30,
      mountainForeground: Colors.green30,
      mountainBackground: Colors.green50
    },
    dark: {
      screenBG: Colors.grey10,
      textColor: Colors.white,
      moonOrSun: Colors.grey80,
      mountainForeground: Colors.violet10,
      mountainBackground: Colors.violet20
    }
  });

};

```

### Core Architecture Module: `demo/src/data/conversations.ts`
```
const conversations = [
  {
    name: 'rallylongmailname@wix.com',
    text: 'Made a purchase in the total of 7.00$',
    timestamp: '7/14/2016',
    thumbnail: 'https://i.pravatar.cc/150?img=1',
    leftTitleBadge: 'badgeOfficial'
  },
  {
    name: 'Johnny Gibson',
    text: 'Do you also carry these shoes in black?',
    timestamp: '36 min',
    count: '5',
    thumbnail: 'https://i.pravatar.cc/150?img=2',
    isNew: false
  },
  {
    name: 'Jennifer Clark',
    text: 'This might be the subject\nAnd the content is on a new line',
    timestamp: '2 hours',
    count: '1',
    thumbnail: 'https://i.pravatar.cc/150?img=3',
    isNew: true
  },
  {
    name: 'Rebecka',
    text: 'Yep',
    timestamp: '3 hours',
    count: '12',
    thumbnail: 'https://i.pravatar.cc/150?img=4',
    isNew: true,
    leftTitleBadge: 'badgeOfficial'
  },
  {
    name: 'Murphy',
    text: 'Do you have international shipping?',
    timestamp: '1 Day',
    count: '2',
    thumbnail: 'https://i.pravatar.cc/150?img=5',
    isNew: false
  },
  {
    name: 'Matttt',
    text: 'will get to you next week with that',
    timestamp: '1 Week',
    count: '99',
    thumbnail: 'https://i.pravatar.cc/150?img=6',
    isNew: true,
    leftTitleBadge: 'twitterOn'
  },
  {
    name: 'Brad Taylor',
    text: 'Will I be able to receive it before July 3rd?',
    timestamp: '1 Week',
    count: '99',
    thumbnail:
      'https://static.wixstatic.com/media/7c69c135804b473c9788266540cd90d3.jpg/v1/fit/w_750,h_750/7c69c135804b473c9788266540cd90d3.jpg',
    isNew: false
  },
  {
    name: 'Lina Mayer',
    text: 'When will you have them back in stock?',
    timestamp: '1 Week',
    count: '',
    thumbnail:
      'https://static.wixstatic.com/media/a7adbc41a9f24a64803cac9aec2deb6b.jpg/v1/fit/w_750,h_750/a7adbc41a9f24a64803cac9aec2deb6b.jpg',
    isNew: true,
    leftTitleBadge: 'facebookOn'
  },
  {
    name: 'Marissa Mayer',
    text: 'When will you have them back in stock?',
    timestamp: '1 Week',
    count: '',
    thumbnail: '',
    isNew: true
  },
  {
    name: 'Elliot Brown',
    text: '2 - 3 weeks',
    timestamp: '1 Week',
    count: '',
    thumbnail:
      'https://static.wixstatic.com/media/66003687fdce4e6197cbaf816ca8fd17.jpg/v1/fit/w_750,h_750/66003687fdce4e6197cbaf816ca8fd17.jpg',
    isNew: true
  },
  {
    name: 'Vanessa Campbell',
    text: 'Do you have these in other colors?',
    timestamp: '1 Week',
    count: '',
    thumbnail:
      'https://static.wixstatic.com/media/d4367b20ae2e4036b18c34262d5ed031.jpg/v1/fit/w_750,h_750/d4367b20ae2e4036b18c34262d5ed031.jpg',
    isNew: true,
    leftTitleBadge: 'twitterOn'
  },
  {
    name: 'Sir Robert Walpole',
    text: 'Made a purchase in the total of 7.00$',
    timestamp: '7/14/2016',
    thumbnail:
      'https://static.wixstatic.com/media/87994e3d0dda4479a7f4d8c803e1323e.jpg/v1/fit/w_750,h_750/87994e3d0dda4479a7f4d8c803e1323e.jpg',
    leftTitleBadge: 'badgeOfficial'
  },
  {
    name: 'A. Schwarzenegger',
    text: 'Get to the chopper',
    timestamp: 'Jul 19th 214'
  },
  {
    name: 'Johnny Gibson',
    text: 'Do you also carry these shoes in black?',
    timestamp: '36 min',
    count: '5',
    // thumbnail: 'https://static.wixstatic.com/media/87994e3d0dda4479a7f4d8c803e1323e.jpg/v1/fit/w_750,h_750/87994e3d0dda4479a7f4d8c803e1323e.jpg',
    isNew: false
  },
  {
    name: 'Jennifer Clark',
    text: 'This might be the subject\nAnd the content is on a new line',
    timestamp: '2 hours',
    count: '1',
    thumbnail:
      'https://static.wixstatic.com/media/c1ca83a468ae4c998fe4fddea60ea84d.jpg/v1/fit/w_750,h_750/c1ca83a468ae4c998fe4fddea60ea84d.jpg',
    isNew: true
  },
  {
    name: 'Rebecka',
    text: 'Yep',
    timestamp: '3 hours',
    count: '12',
    thumbnail:
      'https://static.wixstatic.com/media/43cddb4301684a01a26eaea100162934.jpeg/v1/fit/w_750,h_750/43cddb4301684a01a26eaea100162934.jpeg',
    isNew: true,
    leftTitleBadge: 'badgeOfficial'
  },
  {
    name: 'Murphy',
    text: 'Do you have international shipping?',
    timestamp: '1 Day',
    count: '2',
    thumbnail:
      'https://static.wixstatic.com/media/84e86e9bec8d46dd8296c510629a8d97.jpg/v1/fit/w_750,h_750/84e86e9bec8d46dd8296c510629a8d97.jpg',
    isNew: false
  },
  {
    name: 'Matttt',
    text: 'will get to you next week with that',
    timestamp: '1 Week',
    count: '99',
    thumbnail:
      'https://static.wixstatic.com/media/b27921b8c46841b48032f11c16d6e009.jpg/v1/fit/w_750,h_750/b27921b8c46841b48032f11c16d6e009.jpg',
    isNew: true,
    leftTitleBadge: 'twitterOn'
  },
  {
    name: 'Brad Taylor',
    text: 'Will I be able to receive it before July 3rd?',
    timestamp: '1 Week',
    count: '99',
    thumbnail:
      'https://static.wixstatic.com/media/7c69c135804b473c9788266540cd90d3.jpg/v1/fit/w_750,h_750/7c69c135804b473c9788266540cd90d3.jpg',
    isNew: false
  },
  {
    name: 'Lina Mayer',
    text: 'When will you have them back in stock?',
    timestamp: '1 Week',
    count: '',
    thumbnail:
      'https://static.wixstatic.com/media/a7adbc41a9f24a64803cac9aec2deb6b.jpg/v1/fit/w_750,h_750/a7adbc41a9f24a64803cac9aec2deb6b.jpg',
    isNew: true,
    leftTitleBadge: 'facebookOn'
  },
  {
    name: 'Marissa Mayer',
    text: 'When will you have them back in stock?',
    timestamp: '1 Week',
    count: '',
    thumbnail: '',
    isNew: true
  },
  {
    name: 'Elliot Brown',
    text: '2 - 3 weeks',
    timestamp: '1 Week',
    count: '',
    thumbnail:
      'https://static.wixstatic.com/media/66003687fdce4e6197cbaf816ca8fd17.jpg/v1/fit/w_750,h_750/66003687fdce4e6197cbaf816ca8fd17.jpg',
    isNew: true
  },
  {
    name: 'Vanessa Campbell',
    text: 'Do you have these in other colors?',
    timestamp: '1 Week',
    count: '',
    thumbnail:
      'https://static.wixstatic.com/media/d4367b20ae2e4036b18c34262d5ed031.jpg/v1/fit/w_750,h_750/d4367b20ae2e4036b18c34262d5ed031.jpg',
    isNew: true,
    leftTitleBadge: 'twitterOn'
  },
  {
    name: 'Spencer Compton',
    text: 'Made a purchase in the total of 7.00$',
    timestamp: '7/14/2016',
    thumbnail:
      'https://static.wixstatic.com/media/87994e3d0dda4479a7f4d8c803e1323e.jpg/v1/fit/w_750,h_750/87994e3d0dda4479a7f4d8c803e1323e.jpg',
    leftTitleBadge: 'badgeOfficial'
  },
  {
    name: 'Arnold S.',
    text: 'Get to the chopper',
    timestamp: 'Jul 19th 214'
  },
  {
    name: 'Johnny Gibson',
    text: 'Do you also carry these shoes in black?',
    timestamp: '36 min',
    count: '5',
    // thumbnail: 'https://static.wixstatic.com/media/87994e3d0dda4479a7f4d8c803e1323e.jpg/v1/fit/w_750,h_750/87994e3d0dda4479a7f4d8c803e1323e.jpg',
    isNew: false
  },
  {
    name: 'Jennifer Clark',
    text: 'This might be the subject\nAnd the content is on a new line',
    timestamp: '2 hours',
    count: '1',
    thumbnail:
      'https://static.wixstatic.com/media/c1ca83a468ae4c998fe4fddea60ea84d.jpg/v1/fit/w_750,h_750/c1ca83a468ae4c998fe4fddea60ea84d.jpg',
    isNew: true
  },
  {
    name: 'Rebecka',
    text: 'Yep',
    timestamp: '3 hours',
    count: '12',
    thumbnail:
      'https://static.wixstatic.com/media/43cddb4301684a01a26eaea100162934.jpeg/v1/fit/w_750,h_750/43cddb4301684a01a26eaea100162934.jpeg',
    isNew: true,
    leftTitleBadge: 'badgeOfficial'
  },
  {
    name: 'Murphy',
    text: 'Do you have international shipping?',
    timestamp: '1 Day',
    count: '2',
    thumbnail:
      'https://static.wixstatic.com/media/84e86e9bec8d46dd8296c510629a8d97.jpg/v1/fit/w_750,h_750/84e86e9bec8d46dd8296c510629a8d97.jpg',
    isNew: false
  },
  {
    name: 'Matttt',
    text: 'will get to you next week with that',
    timestamp: '1 Week',
    count: '99',
    thumbnail:
      'https://static.wixstatic.com/media/b27921b8c46841b48032f11c16d6e009.jpg/v1/fit/w_750,h_750/b27921b8c46841b48032f11c16d6e009.jpg',
    isNew: true,
    leftTitleBadge: 'twitterOn'
  },
  {
    name: 'Brad Taylor',
    text: 'Will I be able to receive it before July 3rd?',
    timestamp: '1 Week',
    cou
```

### Core Architecture Module: `demo/src/data/orders.ts`
```
type InventoryType = {
  trackingMethod: string;
  status: string;
  quantity: number;
}

export type OrderType = {
  name: string;
  formattedPrice: string;
  inventory: InventoryType
  mediaUrl: string;
}

const orders: Array<OrderType> = [
  {
    name: '#100201',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Paid',
      quantity: 1
    },
    mediaUrl: 'https://static.wixstatic.com/media/d911269bdf7972c9a59ba30440cb3789.jpg_128'
  },
  {
    name: '#100203',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Paid',
      quantity: 2
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_5c6d2cd3b71a41caa54309301e1dd0d7.jpg_128'
  },
  {
    name: '#100207',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Unpaid',
      quantity: 1
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_7153ff06297c484498f9d6662e26d6d5.jpg_128'
  },
  {
    name: '#100208',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Out of Stock',
      quantity: 0
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_e008aa7681f443b3be63a1fe86c10cfd.jpg_128'
  },
  {
    name: '#100209',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Paid',
      quantity: 3
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_f9de629d8c97416f82b398725bd49918.jpg_128'
  },
  {
    name: '#100205',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Unpaid',
      quantity: 0
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_1782572f1dfc49d397e830918d912568.jpg_128'
  },
  {
    name: '#100200',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Unpaid',
      quantity: 10
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_03906910d07749199b09e443ce9fed6c.jpg_128'
  },
  {
    name: '#100206',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Paid',
      quantity: 11
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_9d3e5b8fc70e4d2997806ece35e7de54.jpg_128'
  },
  {
    name: '#100212',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Unpaid',
      quantity: 10
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_db24e0568cdc4a82be0a8559fb123b55.jpg_128'
  },
  {
    name: '#100211',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Unpaid',
      quantity: 2
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_085a5f9575ba4b208f6091b26cbda4c4.jpg_128'
  },
  {
    name: '#10022',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Paid',
      quantity: 8
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_82d66fece3e54a7aa10d49bda4d98259.jpg_128'
  },
  {
    name: '#10023',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Paid',
      quantity: 8
    },
    mediaUrl: 'https://static.wixstatic.com/media/84770f_c611ded729fd4461a1bb57134d4e9dd2.png_128'
  }
];

export default orders;

```

### Core Architecture Module: `demo/src/data/posts.js`
```
const localImageSource = require('../assets/images/empty-state.jpg'); // eslint-disable-line
const posts = [
  {
    coverImage: localImageSource,
    title: 'Amazing Desert',
    status: 'Published',
    timestamp: '31 August 2016',
    description: 'Reference this table when designing your app’s interface, and make sure',
    likes: 345,
  },
  {
    title: 'New Post',
    status: 'Draft',
    timestamp: '07 March 2017',
    description: 'This is the beginning of a new post',
    likes: 0,
  },
];

export default posts;

```

### Core Architecture Module: `demo/src/data/products.ts`
```
const products = [
  {
    id: 'a',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 1
    },
    mediaUrl: 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=200'
  },
  {
    id: 'b',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 2
    },
    mediaUrl: 'https://images.pexels.com/photos/3737604/pexels-photo-3737604.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=200'
  },
  {
    id: 'c',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 1
    },
    mediaUrl: 'https://images.pexels.com/photos/3685538/pexels-photo-3685538.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=200'
  },
  {
    id: 'd',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'Out of Stock',
      quantity: 0
    },
    mediaUrl: 'https://images.pexels.com/photos/4202467/pexels-photo-4202467.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=200'
  },
  {
    id: 'e',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 3
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_f9de629d8c97416f82b398725bd49918.jpg_128'
  },
  {
    id: 'f',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'statu',
      status: 'Out of Stock',
      quantity: 0
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_1782572f1dfc49d397e830918d912568.jpg_128'
  },
  {
    id: 'g',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 10
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_03906910d07749199b09e443ce9fed6c.jpg_128'
  },
  {
    id: 'h',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 11
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_9d3e5b8fc70e4d2997806ece35e7de54.jpg_128'
  },
  {
    id: 'i',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 10
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_db24e0568cdc4a82be0a8559fb123b55.jpg_128'
  },
  {
    id: 'j',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 2
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_085a5f9575ba4b208f6091b26cbda4c4.jpg_128'
  },
  {
    id: 'k',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 8
    },
    mediaUrl: 'https://static.wixstatic.com/media/cda177_82d66fece3e54a7aa10d49bda4d98259.jpg_128'
  },
  {
    id: 'l',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 8
    },
    mediaUrl: 'https://static.wixstatic.com/media/84770f_c611ded729fd4461a1bb57134d4e9dd2.png_128'
  },
  {
    id: 'm',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 3
    },
    mediaUrl: 'https://images.pexels.com/photos/3612182/pexels-photo-3612182.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=150'
  },
  {
    id: 'n',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 22
    },
    mediaUrl: 'https://images.pexels.com/photos/4841529/pexels-photo-4841529.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=150'
  },
  {
    id: 'o',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 10
    },
    mediaUrl: 'https://images.pexels.com/photos/4173450/pexels-photo-4173450.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=150'
  },
  {
    id: 'p',
    name: 'I\'m a Product',
    formattedPrice: '$19.99',
    inventory: {
      trackingMethod: 'status',
      status: 'In Stock',
      quantity: 10
    },
    mediaUrl: 'https://images.pexels.com/photos/10513273/pexels-photo-10513273.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=150'
  }
];

export default products;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3924** (2026-02-02): **iOS swipe back gesture not triggering onPopScreen (UILib)**
  *Symptoms*: https://github.com/wix-private/wix-react-native-ui-lib/pull/5960/changes

- **Issue #3849** (2026-03-08): **Search Not Found**
  *Symptoms*: website: click search -> display information -> choose Information -> Page Not Found We could not find what you were looking for. Please contact the owner of the site that linked you to the original URL and let them know their link is broken. 
  **Post-Mortem & Fix Analysis**:
  > @TienNguyen79 you should check the route page first
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #3848** (2026-03-08): **Demo app is broken**
  *Symptoms*: Demo is broken. Would you please fix it?
  **Post-Mortem & Fix Analysis**:
  > I've create a new repository using expo last version, so you can clone this repository and run with expo https://github.com/Vn-ChemGio/react-native-ui-lib
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #3846** (2025-11-20): **Fix for https://github.com/wix/react-native-ui-lib/issues/3845**
  *Symptoms*: ## Description KeyboardTrackingView - fix  ## Changelog KeyboardTrackingView - fix  ## Additional info None 
  **Post-Mortem & Fix Analysis**:
  > ## ✅ PR Description Validation Passed  All required sections are properly filled out:  - ✅ **Description** - ✅ **Changelog** - ✅ **Additional info**  Your PR is good for review! 🚀  --- _This validation ensures all sections from the [PR template](/wix/react-native-ui-lib/blob/master/.github/pull_request_template.md) are properly filled._

- **Issue #3845** (2025-11-20): **UI Lib keyboard tracking bug**
  *Symptoms*: UILib Keyboard tracking is broken because of a previous fix

- **Issue #3834** (2025-11-12): **4**
  *Symptoms*: 

- **Issue #3827** (2025-11-09): **ConnectedKeyboardAccessoryView tracks incorrectly when used with Navigation.showModal**
  *Symptoms*: https://wix.atlassian.net/browse/MADS-4861

- **Issue #3822** (2026-03-08): **ChipsInput's nested TextInput inherits height of entire container even when leadingAccessory causes a flex-wrap**
  *Symptoms*: <!-- NOTE: please submit only bug reports here, any new questions or feature requests should be submitted in Discussions: https://github.com/wix/react-native-ui-lib/discussions  -->  ## Description  <!-- A clear and concise description of what is the bug. -->  - When using Chips Input, when the chips cause a wrap, the TextInput component inherits the resulting parent container height and overflows.  - This is seemingly due to the [nested View for the TextInput compoenent using the centerV prop](https://github.com/wix/react-native-ui-lib/blob/00480e9c6e4b55130145d53371c6b8e4bec449f4/src/components/textField/index.tsx#L168)  <img width="272" height="101" alt="Image" src="https://github.com/user-attachments/assets/12039181-d559-49ae-80a2-7cbaa6b2e99e" />  - Initial chips input  - Text field shown in red for visual clairty  <img width="266" height="56" alt="Image" src="https://github.com/user-attachments/assets/92d1a74c-5607-4aad-b5ad-91a202cc44fb" />  - When not wrapping behaves as expected  <img width="268" height="96" alt="Image" src="https://github.com/user-attachments/assets/24f896b5-403f-4613-8497-f9e899d4c3fd" />  - When wrapped, the TextInput component inherited the parent components height, and overflows. (Chips/"Suggested" text from the 3rd row in the image are from a seperate component) - Also causes unwanted spacing from first and second row  - Can work on/provide a PR for fix if requested!  ### Related to  - [x] Components - [ ] Demo - [ ] Docs - [ ] Typings  ### Ste
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

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

### Incident Patch 1: `0cde3008` (2026-09-06)
**Commit Message**: fix: TabController - clear stuck press feedback when a tap is cancelled on iOS (#4042)

TabBarItem latches its press feedback in the `isPressed` shared value from
`onTouchesDown` and cleared it only in `onFinalize`.

On iOS a cancelled tap (e.g. when the enclosing horizontal ScrollView claims the
touch after a few pixels of finger drift) transitions the recognizer straight
from POSSIBLE to CANCELLED. UIKit emits no action message for that transition,
and RNGestureHandler's RNTapHandler only compensates manually for FAILED - so no
state change event reaches JS and `onFinalize` never runs. `isPressed` stayed
true, leaving `activeBackgroundColor` painted on the item indefinitely, also
after another tab was selected (every item owns its own `isPressed`).

Android is unaffected: `GestureHandler.cancel()` goes through `moveToState`,
which dispatches the state change, so `onFinalize` runs.

Clearing `isPressed` from `onTouchesCancelled` as well covers the cancel path,
which does reach JS as a touch event. The extra call on Android is idempotent
(both handlers write `false`) and can only fire on a terminal transition, so the
feedback is never released mid-press.

Co-authored-by: Claude Opu

**File**: `packages/react-native-ui-lib/src/components/tabController/TabBarItem.tsx` (modified, +7/-0)
```diff
@@ -224,6 +224,13 @@ export default function TabBarItem({
     })
     .onTouchesDown(() => {
       isPressed.value = true;
+    })
+    // NOTE: On iOS a cancelled tap (i.e. when the enclosing ScrollView claims the touch) transitions the
+    //       recognizer straight from POSSIBLE to CANCELLED, which emits no state change event, so onFinalize
+    //       is never called and the press feedback stays on the item.
+    //       Releasing it from the touch stream as well makes sure it is always cleared.
+    .onTouchesCancelled(() => {
+      isPressed.value = false;
     });
 
   return (
```

---

### Incident Patch 2: `2af5663e` (2026-09-01)
**Commit Message**: fix: Dialog - prevent open animation interruption by residual touch on Android (#4038)

* fix: Dialog - prevent open animation interruption by residual touch on Android (minDistance)

A bottom Dialog/ActionSheet opened from a gesture-driven trigger (e.g. List.Item's
TapGestureHandler firing onPress on END) can rest part-way open on Android: the residual
touch leaks into the Dialog's own panGesture and drives `visibility` mid-open, interrupting
the open spring. Adding a minDistance activation threshold to the pan prevents a near-static
residual touch from engaging it, while drag-to-dismiss keeps working.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

* ci: trigger snapshot build

* fix: clarify minDistance rationale (MOBAPP-2994)

* test: add minDistance to Pan gesture jest mock (MOBAPP-2994)

* fix: Dialog - add open-animation watchdog for stranded Android opens

Two Android-only failure modes share this remedy, both traced to RN 0.79's
ModalHostViewScreenSize() returning Size{0,0} on Android while iOS returns a
real RCTScreenSize (facebook/react-native#51048, fixed only in RN 0.81):
the dialog's open() call is gated on onLayout measuring a non-zero size, so
inside a 0x0

**File**: `packages/react-native-ui-lib/jestSetup/jest-setup.js` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ jest.mock('react-native-gesture-handler',
       PanMock.onFinalize = getDefaultMockedHandler('onFinalize');
       PanMock.activateAfterLongPress = getDefaultMockedHandler('activateAfterLongPress');
       PanMock.enabled = getDefaultMockedHandler('enabled');
+      PanMock.minDistance = getDefaultMockedHandler('minDistance');
       PanMock.hitSlop = getDefaultMockedHandler('hitSlop');
       PanMock.onTouchesMove = getDefaultMockedHandler('onTouchesMove');
       PanMock.prepare = jest.fn();
```

**File**: `packages/react-native-ui-lib/src/components/dialog/__tests__/index.new.spec.tsx` (modified, +74/-0)
```diff
@@ -1,5 +1,6 @@
 import React, {useRef, useState, useEffect, useCallback} from 'react';
 import {render, act} from '@testing-library/react-native';
+import * as Reanimated from 'react-native-reanimated';
 import Dialog, {DialogProps} from '../index';
 import {DialogDriver} from '../Dialog.driver.new';
 import View from '../../../components/view';
@@ -109,3 +110,76 @@ describe('Dialog sanity checks', () => {
     expect(dialogDriver.isVisible()).toBeFalsy();
   });
 });
+
+// Mirrors the non-exported constants in index.tsx.
+const WATCHDOG_INTERVAL_MS = 400;
+const WATCHDOG_MAX_ATTEMPTS = 8;
+
+// Mounted already `visible` so open/close and the watchdog share one render. Reanimated's mock
+// useSharedValue returns a new value per call (the real one is ref-backed for the component's
+// lifetime), so a post-mount `visible` flip would have them reading different values.
+describe('Dialog open animation watchdog', () => {
+  afterEach(() => {
+    jest.useRealTimers();
+    jest.restoreAllMocks();
+  });
+
+  it('recovers a dialog that never opens, then stops once it reaches full visibility', () => {
+    jest.useFakeTimers();
+    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
+    const {dialogDriver} = getDriver(<TestCase1 visible/>);
+    expect(dialogDriver.isVisible()).toBeTruthy();
+    expect(withSpringSpy).not.toHaveBeenCalled();
+
+    // Stuck at 0 since mount - the watchdog opens it.
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS);
+    });
+    expect(withSpringSpy).toHaveBeenCalledTimes(1);
+
+    // Reached 1, so the watchdog clears itself for good.
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * (WATCHDOG_MAX_ATTEMPTS + 3));
+    });
+    expect(withSpringSpy).toHaveBeenCalledTimes(1);
+  });
+
+  it('keeps retrying while the open animation stays frozen, then permanently gives up at the attempt cap', () => {
+    jest.useFakeTimers();
+    // open() always lands on the same value, so visibility never advances: the frozen-open failure.
+    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring').mockReturnValue(0.5);
+    getDriver(<TestCase1 visible/>);
+
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * (WATCHDOG_MAX_ATTEMPTS + 3));
+    });
+    const attemptsMade = withSpringSpy.mock.calls.length;
+    expect(attemptsMade).toBeGreaterThan(1);
+    expect(attemptsMade).toBeLessThanOrEqual(WATCHDOG_MAX_ATTEMPTS + 1);
+
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * 5);
+    });
+    // No growth long after the cap: permanently given up, not paused.
+    expect(withSpringSpy).toHaveBeenCalledTimes(attemptsMade);
+  });
+
+  it('does not re-open while the dialog is closing (visibility decreasing)', () => {
+    jest.useFakeTimers();
+    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
+    // Drive visibility down as an in-progress close() would, without the completion callback -
+    // so modalVisibility stays true, matching a close that is still animating.
+    const withTimingSpy = jest.spyOn(Reanimated, 'withTiming').mockReturnValue(-0.1);
+    const {dialogDriver} = getDriver(<TestCase1 visible/>);
+
+    act(() => {
+      dialogDriver.pressOnBackground();
+    });
+    expect(withTimingSpy).toHaveBeenCalledTimes(1);
+
+    act(() => {
+      jest.advanceTimersByTime(WATCHDOG_INTERVAL_MS * 3);
+    });
+    expect(withSpringSpy).not.toHaveBeenCalled();
+  });
+});
```

**File**: `packages/react-native-ui-lib/src/components/dialog/index.tsx` (modified, +35/-0)
```diff
@@ -29,6 +29,9 @@ import {DialogProps, DialogDirections, DialogDirectionsEnum, DialogHeaderProps}
 export {DialogProps, DialogDirections, DialogDirectionsEnum, DialogHeaderProps};
 
 const THRESHOLD_VELOCITY = 750;
+// Longer than a healthy open (~240ms), so a normal open always wins and the watchdog no-ops.
+const OPEN_WATCHDOG_INTERVAL_MS = 400;
+const OPEN_WATCHDOG_MAX_ATTEMPTS = 8;
 
 export interface DialogStatics {
   directions: typeof DialogDirectionsEnum;
@@ -123,6 +126,34 @@ const Dialog = (props: DialogProps, ref: ForwardedRef<DialogImperativeMethods>)
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [modalVisibility, wasMeasured]);
 
+  // Recovers a dialog whose open animation never completes. On Android with RN 0.79 the Modal's
+  // Fabric state can start 0x0 (facebook/react-native#51048, fixed in RN 0.81), so the dialog
+  // either never opens - `open()` above is gated on `wasMeasured`, which never flips - or opens
+  // part-way and freezes. Armed on `modalVisibility` alone, since gating on measurement is the
+  // bug being worked around. Re-opens a frozen animation only: `close()` animates while
+  // `modalVisibility` is still true, so a decreasing value is a dismiss in progress, not a strand.
+  useEffect(() => {
+    if (!modalVisibility) {
+      return;
+    }
+    let attempts = 0;
+    let previous = visibility.value;
+    const interval = setInterval(() => {
+      const current = visibility.value;
+      attempts += 1;
+      if (current >= 1 || current < previous || attempts > OPEN_WATCHDOG_MAX_ATTEMPTS) {
+        clearInterval(interval);
+        return;
+      }
+      if (current === previous) {
+        open();
+      }
+      previous = current;
+    }, OPEN_WATCHDOG_INTERVAL_MS);
+    return () => clearInterval(interval);
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [modalVisibility]);
+
   const alignmentStyle = useMemo(() => {
     return {flex: 1, alignItems: 'center', ...extractAlignmentsValues(props)};
     // eslint-disable-next-line react-hooks/exhaustive-deps
@@ -190,6 +221,10 @@ const Dialog = (props: DialogProps, ref: ForwardedRef<DialogImperativeMethods>)
   };
 
   const panGesture = Gesture.Pan()
+    // MOBAPP-2994: require a deliberate drag before the pan engages. On Android/Fabric the residual
+    // touch from a gesture-handler trigger (e.g. List.Item) otherwise leaks into this freshly-mounted
+    // pan and drives `visibility` mid-open, interrupting the open spring so the sheet rests part-way.
+    .minDistance(10)
     .onStart(event => {
       initialTranslation.value =
         getTranslationReverseInterpolation(isVertical ? event.translationY : event.translationX) - visibility.value;
```

---

### Incident Patch 3: `4c988b56` (2026-07-29)
**Commit Message**: fix: ScreenFooter - correct initial opacity for animationType 'none' (Android touch blocking) (#4035)

**File**: `packages/react-native-ui-lib/src/components/screenFooter/useAnimatedFooterStyle.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ const useAnimatedFooterStyle = (
   });
 
   const [height, setHeight] = useState(0);
-  const animatedValue = useSharedValue(animationType === 'fade' && visible ? 1 : 0);
+  const animatedValue = useSharedValue(animationType !== 'slide' && visible ? 1 : 0);
 
   useEffect(() => {
     if (animationType === 'slide') {
```

---

### Incident Patch 4: `373b4c78` (2026-07-28)
**Commit Message**: fix: guard isGravatarUrl against invalid URL strings (#4034)

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `packages/react-native-ui-lib/src/helpers/AvatarHelper.ts` (modified, +6/-2)
```diff
@@ -90,8 +90,12 @@ export function getBackgroundColor(name?: string,
 }
 
 export function isGravatarUrl(url: string) {
-  const {hostname, pathname} = new URL(url);
-  return _.split(hostname, '.').includes('gravatar') && pathname.startsWith('/avatar/');
+  try {
+    const {hostname, pathname} = new URL(url);
+    return _.split(hostname, '.').includes('gravatar') && pathname.startsWith('/avatar/');
+  } catch {
+    return false;
+  }
 }
 
 export function isBlankGravatarUrl(url: string) {
```

**File**: `packages/react-native-ui-lib/src/helpers/__tests__/AvatarHelper.spec.js` (modified, +6/-0)
```diff
@@ -114,6 +114,12 @@ describe('services/AvatarService', () => {
       expect(uut.isGravatarUrl('https://www.gravatars.com/avatar/00000000000000000000000000000000')).toEqual(false);
       expect(uut.isGravatarUrl('https://www.grava.tar/avatar/00000000000000000000000000000000')).toEqual(false);
     });
+
+    it('should return false for an invalid url', () => {
+      expect(uut.isGravatarUrl('fakeUrl')).toEqual(false);
+      expect(uut.isGravatarUrl('fakeUri1')).toEqual(false);
+      expect(uut.isGravatarUrl('')).toEqual(false);
+    });
   });
 
   describe('isBlankGravatarUrl', () => {
```

---

### Incident Patch 5: `5110454d` (2026-07-19)
**Commit Message**: fix: replace url-parse with native URL API (#4033)

Remove the url-parse dependency and use the built-in URL and
URLSearchParams APIs in AvatarHelper instead.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `package.json` (modified, +0/-1)
```diff
@@ -49,7 +49,6 @@
     "@types/react": "19.0.0",
     "@types/react-test-renderer": "^19.0.0",
     "@types/tinycolor2": "^1.4.2",
-    "@types/url-parse": "^1.4.3",
     "@typescript-eslint/eslint-plugin": "^5.62.0",
     "@typescript-eslint/parser": "^5.62.0",
     "@welldone-software/why-did-you-render": "^3.2.1",
```

**File**: `packages/react-native-ui-lib/package.json` (modified, +0/-2)
```diff
@@ -39,7 +39,6 @@
         "react-native-redash": "^12.0.3",
         "semver": "^5.5.0",
         "tinycolor2": "^1.4.2",
-        "url-parse": "^1.2.0",
         "wix-react-native-text-size": "1.0.9"
     },
     "devDependencies": {
@@ -71,7 +70,6 @@
         "@types/react": "19.0.0",
         "@types/react-test-renderer": "19.0.0",
         "@types/tinycolor2": "^1.4.2",
-        "@types/url-parse": "^1.4.3",
         "@welldone-software/why-did-you-render": "^3.2.1",
         "babel-plugin-lodash": "^3.3.4",
         "babel-plugin-module-resolver": "^5.0.0",
```

**File**: `packages/react-native-ui-lib/src/helpers/AvatarHelper.ts` (modified, +3/-6)
```diff
@@ -1,5 +1,4 @@
 import _ from 'lodash';
-import URL from 'url-parse';
 import Colors from '../style/colors';
 import {Typography} from 'style';
 
@@ -100,10 +99,8 @@ export function isBlankGravatarUrl(url: string) {
 }
 
 export function patchGravatarUrl(gravatarUrl: string) {
-  const url = new URL(gravatarUrl, true);
-  const {query} = url;
-  query.d = '404';
-  delete query.default;
-  url.set('query', query);
+  const url = new URL(gravatarUrl);
+  url.searchParams.set('d', '404');
+  url.searchParams.delete('default');
   return url.toString();
 }
```

**File**: `yarn.lock` (modified, +0/-34)
```diff
@@ -3088,13 +3088,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@types/url-parse@npm:^1.4.3":
-  version: 1.4.11
-  resolution: "@types/url-parse@npm:1.4.11"
-  checksum: 10c0/24a470a28393871c83e94006a80f6fb2e7c6dd9c0b031ee575fe792291cf28aec1f0523512b77a09190a4918158e7c68c03c04b8aa97e76b0153aec52f767bd6
-  languageName: node
-  linkType: hard
-
 "@types/yargs-parser@npm:*":
   version: 21.0.3
   resolution: "@types/yargs-parser@npm:21.0.3"
@@ -9351,13 +9344,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"querystringify@npm:^2.1.1":
-  version: 2.2.0
-  resolution: "querystringify@npm:2.2.0"
-  checksum: 10c0/3258bc3dbdf322ff2663619afe5947c7926a6ef5fb78ad7d384602974c467fadfc8272af44f5eb8cddd0d011aae8fabf3a929a8eee4b86edcc0a21e6bd10f9aa
-  languageName: node
-  linkType: hard
-
 "queue-microtask@npm:^1.2.2":
   version: 1.2.3
   resolution: "queue-microtask@npm:1.2.3"
@@ -9659,7 +9645,6 @@ __metadata:
     "@types/react": "npm:19.0.0"
     "@types/react-test-renderer": "npm:^19.0.0"
     "@types/tinycolor2": "npm:^1.4.2"
-    "@types/url-parse": "npm:^1.4.3"
     "@typescript-eslint/eslint-plugin": "npm:^5.62.0"
     "@typescript-eslint/parser": "npm:^5.62.0"
     "@welldone-software/why-did-you-render": "npm:^3.2.1"
@@ -9710,7 +9695,6 @@ __metadata:
     "@types/react": "npm:19.0.0"
     "@types/react-test-renderer": "npm:19.0.0"
     "@types/tinycolor2": "npm:^1.4.2"
-    "@types/url-parse": "npm:^1.4.3"
     "@welldone-software/why-did-you-render": "npm:^3.2.1"
     babel-plugin-lodash: "npm:^3.3.4"
     babel-plugin-module-resolver: "npm:^5.0.0"
@@ -9753,7 +9737,6 @@ __metadata:
     tinycolor2: "npm:^1.4.2"
     typescript: "npm:5.0.4"
     uilib-native: "workspace:*"
-    url-parse: "npm:^1.2.0"
     wix-react-native-text-size: "npm:1.0.9"
   peerDependencies:
     react: ">=19.0.0"
@@ -10077,13 +10060,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"requires-port@npm:^1.0.0":
-  version: 1.0.0
-  resolution: "requires-port@npm:1.0.0"
-  checksum: 10c0/b2bfdd09db16c082c4326e573a82c0771daaf7b53b9ce8ad60ea46aa6e30aaf475fe9b164800b89f93b748d2c234d8abff945d2551ba47bf5698e04cd7713267
-  languageName: node
-  linkType: hard
-
 "reselect@npm:^4.1.7":
   version: 4.1.8
   resolution: "reselect@npm:4.1.8"
@@ -11421,16 +11397,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"url-parse@npm:^1.2.0":
-  version: 1.5.10
-  resolution: "url-parse@npm:1.5.10"
-  dependencies:
-    querystringify: "npm:^2.1.1"
-    requires-port: "npm:^1.0.0"
-  checksum: 10c0/bd5aa9389f896974beb851c112f63b466505a04b4807cea2e5a3b7092f6fbb75316f0491ea84e44f66fed55f1b440df5195d7e3a8203f64fcefa19d182f5be87
-  languageName: node
-  linkType: hard
-
 "use-memo-one@npm:^1.1.1":
   version: 1.1.3
   resolution: "use-memo-one@npm:1.1.3"
```

---

### Incident Patch 6: `78dfad36` (2026-07-19)
**Commit Message**: fix/DynamicFontModule - double callback invocation causing SIGABRT on Android (#4030)

* DynamicFontModule - fix double callback invocation causing SIGABRT on Android

The `finally` block unconditionally called `callback.invoke(null, name)` after
every execution path, including after the `catch` block already invoked the
callback on error. React Native enforces single-use callbacks and throws a fatal
SIGABRT when a callback is invoked more than once.

Fix: move the success callback into the `try` block and remove the `finally`.
The callback is now invoked exactly once — on success inside `try`, or on
failure inside `catch`.

Reproduces intermittently on Android (branded apps) when an exception is thrown
during font loading (e.g. `Typeface.createFromFile` failing on certain devices),
causing the app to crash ~4 seconds after launch before any UI interaction.

* fix: move success callback outside try/catch to prevent double invocation on bridge teardown

Previously callback.invoke(null, name) was inside the try block, meaning any
RuntimeException thrown by the RN bridge during invocation (e.g. activity destroyed
mid-load) would be caught and trigger a second callback.invoke() call — 

**File**: `packages/uilib-native/android/src/main/java/com/wix/reactnativeuilib/dynamicfont/DynamicFontModule.java` (modified, +2/-2)
```diff
@@ -132,8 +132,8 @@ public void loadFont(final ReadableMap options, final Callback callback) throws
       cacheFile.delete();
     } catch(Exception e) {
       callback.invoke(e.getMessage());
-    } finally {
-      callback.invoke(null, name);
+      return;
     }
+    callback.invoke(null, name);
   }
 }
```

---

### Incident Patch 7: `82736d71` (2026-05-25)
**Commit Message**: ScrollFooter - fix another issue with touch not working after scroll (Android real device) | no animation + hide on scroll (#4019)

**File**: `packages/react-native-ui-lib/src/components/screenFooter/useAnimatedFooterStyle.ts` (modified, +2/-2)
```diff
@@ -42,15 +42,15 @@ const useAnimatedFooterStyle = (
     let translateY = 0;
     if (animationType === 'slide') {
       translateY = animatedValue.value;
-    } else if (animationType === 'fade') {
+    } else {
       style = {opacity: animatedValue.value};
     }
 
     if (keyboardBehavior === 'sticky' && Constants.isAndroid) {
       translateY += keyboard.height.value;
     }
 
-    if (animationType === 'slide' || translateY !== 0) {
+    if (translateY !== 0) {
       style.transform = [{translateY}];
     }
 
```

---

### Incident Patch 8: `d0e3857f` (2026-05-24)
**Commit Message**: Fix demo release script (2) (#4018)

**File**: `demo/scripts/releaseDemo.js` (modified, +2/-1)
```diff
@@ -54,7 +54,8 @@ function versionTagAndPublish() {
 }
 
 function findCurrentPublishedVersion() {
-  return exec.execSyncRead(`npm view ${process.env.npm_package_name} dist-tags.latest`);
+  const pkg = isRelease ? process.env.npm_package_name : 'react-native-ui-lib';
+  return exec.execSyncRead(`npm view ${pkg} dist-tags.latest`);
 }
 
 function tryPublishAndTag(version) {
```

---

### Incident Patch 9: `8d24a497` (2026-05-24)
**Commit Message**: Fix demo release script (#4017)

**File**: `demo/scripts/releaseDemo.js` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ function validateEnv() {
   }
   return (
     process.env.BUILDKITE_BRANCH === 'master' ||
-    process.env.BUILDKITE_BRANCH === 'release' ||
+    process.env.BUILDKITE_MESSAGE?.match?.(/^release$/i) ||
     process.env.BUILDKITE_MESSAGE === 'snapshot'
   );
 }
```

---

### Incident Patch 10: `1774e304` (2026-05-24)
**Commit Message**: Infra/fix release script 24 05 26 (#4015)

* Fix release script

* Add release script tests

**File**: `package.json` (modified, +3/-1)
```diff
@@ -11,11 +11,12 @@
     "android": "yarn workspace react-native-ui-lib android",
     "iPad": "yarn workspace react-native-ui-lib iPad",
     "test": "yarn workspace react-native-ui-lib test",
+    "test:releaseScript": "jest scripts/release/__tests__",
     "pretest": "yarn lint",
     "lint": "eslint packages -c .eslintrc.js --ext .tsx,.ts,.js",
     "lint:fix": "eslint packages -c .eslintrc.js --fix",
     "build:dev": "tsc --p tsconfig.dev.json",
-    "pre-push": "yarn build:dev && yarn test",
+    "pre-push": "yarn build:dev && yarn test && yarn test:releaseScript",
     "prepush": "node ./scripts/prepush.js",
     "build": "yarn workspace react-native-ui-lib build",
     "build:local": "yarn workspace react-native-ui-lib build:local",
@@ -61,6 +62,7 @@
     "eslint-plugin-react": "^7.24.0",
     "eslint-plugin-react-hooks": "^4.0.4",
     "eslint-plugin-react-native": "^4.0.0",
+    "jest": "^29.6.3",
     "prettier-eslint": "16.3.0",
     "typescript": "5.0.4"
   }
```

**File**: `scripts/release/__tests__/release.spec.js` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+const {execSync} = require('child_process');
+const fs = require('fs');
+const path = require('path');
+
+const REPO_ROOT = path.resolve(__dirname, '../../..');
+
+jest.setTimeout(30000);
+
+function revertPackageJsons() {
+  const cmd = 'git checkout -- packages/react-native-ui-lib/package.json packages/uilib-native/package.json';
+  execSync(cmd, {cwd: REPO_ROOT, stdio: 'pipe'});
+}
+
+function setPackageJsonVersion(pkgName, version) {
+  const pkgPath = path.join(REPO_ROOT, 'packages', pkgName, 'package.json');
+  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
+  pkg.version = version;
+  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
+}
+
+function npmLatest(pkgName) {
+  return execSync(`npm view ${pkgName} dist-tags.latest`, {encoding: 'utf8'}).trim();
+}
+
+function runRelease(flags) {
+  const out = execSync(`node scripts/release/release.js ${flags.join(' ')}`, {
+    cwd: REPO_ROOT,
+    env: {...process.env, CI: '1', BUILDKITE_BUILD_NUMBER: '99999'},
+    encoding: 'utf8'
+  });
+  const match = out.match(/Packages information:\s*(\[[\s\S]*?\n\])/);
+  if (!match) {
+    throw new Error('Could not parse Packages information JSON from output:\n' + out);
+  }
+  return JSON.parse(match[1]);
+}
+
+const find = (pkgs, name) => pkgs.find(p => p.name === name);
+
+afterEach(() => revertPackageJsons());
+
+describe('react-native-ui-lib', () => {
+  test('release: BK version > npm latest -> releases at BK version', () => {
+    const pkgs = runRelease(['-release', '-bkVersion=99.0.0']);
+    const p = find(pkgs, 'react-native-ui-lib');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toBe('99.0.0');
+  });
+
+  test('release: BK version == npm latest -> does NOT release', () => {
+    const latest = npmLatest('react-native-ui-lib');
+    const pkgs = runRelease(['-release', `-bkVersion=${latest}`]);
+    expect(find(pkgs, 'react-native-ui-lib').shouldRelease).toBe(false);
+  });
+
+  test('release: package.json > npm latest -> releases (OR-fallback gate)', () => {
+    setPackageJsonVersion('react-native-ui-lib', '99.0.0');
+    const pkgs = runRelease(['-release', '-bkVersion=0.0.0']);
+    expect(find(pkgs, 'react-native-ui-lib').shouldRelease).toBe(true);
+  });
+
+  test('master -> releases a snapshot', () => {
+    const pkgs = runRelease(['-master']);
+    const p = find(pkgs, 'react-native-ui-lib');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toMatch(/-snapshot\.99999$/);
+  });
+
+  test('snapshot -> releases a snapshot', () => {
+    const pkgs = runRelease(['-snapshot']);
+    const p = find(pkgs, 'react-native-ui-lib');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toMatch(/-snapshot\.99999$/);
+  });
+});
+
+describe('uilib-native', () => {
+  test('release: BK version > npm latest -> does NOT release (BK does not apply)', () => {
+    const pkgs = runRelease(['-release', '-bkVersion=99.0.0']);
+    expect(find(pkgs, 'uilib-native').shouldRelease).toBe(false);
+  });
+
+  test('release: BK version == npm latest -> does NOT release', () => {
+    const latest = npmLatest('react-native-ui-lib');
+    const pkgs = runRelease(['-release', `-bkVersion=${latest}`]);
+    expect(find(pkgs, 'uilib-native').shouldRelease).toBe(false);
+  });
+
+  test('release: package.json > npm latest -> releases at package.json version', () => {
+    setPackageJsonVersion('uilib-native', '99.0.0');
+    const pkgs = runRelease(['-release', '-bkVersion=0.0.0']);
+    const p = find(pkgs, 'uilib-native');
+    expect(p.shouldRelease).toBe(true);
+    expect(p.version).toBe('99.0.0');
+  });
+
+  test('master -> does NOT release', () => {
+    const pkgs = runRelease(['-master']);
+    expect(find(pkgs, 'uilib-native').shouldRelease).toBe(false);
+  });
+
+  test('snapshot -> releases a snapshot', () => {
+    const pkgs = runRelease(['-snapshot']);
+    const p = find(pkgs, 'uilib-native');
+    expect(p.shouldRelease).toBe(true);
+    exp
```

**File**: `scripts/release/release.js` (modified, +9/-3)
```diff
@@ -38,14 +38,22 @@ const PACKAGES = [
     shouldUpdatePackageJson: true,
     releaseVersionStrategy: isRelease ? 'buildKiteVersion' : 'packageJsonVersion',
     workspaceDeps: ['uilib-native'],
-    shouldRelease: pkg => (isMaster || isRelease ? semver.gt(pkg.packageJsonVersion, pkg.publishedVersion) : !!isSnapshot)
+    shouldRelease: pkg => {
+      if (isRelease) {
+        return semver.gt(pkg.packageJsonVersion, pkg.publishedVersion)
+          || semver.gt(pkg.version, pkg.publishedVersion);
+      }
+      return isMaster || !!isSnapshot;
+    }
   }
 ];
 
 logDebug('Checking if packages should be released...');
 PACKAGES.forEach(package => {
   package.publishedVersion = getPublishedVersion(package.name);
   package.packageJsonVersion = getPackageJsonVersion(package.name);
+  package.path = `packages/${package.name}`;
+  package.version = getVersion(package, dryRun);
   package.shouldRelease = package.shouldRelease(package);
 });
 
@@ -60,8 +68,6 @@ if (!PACKAGES.some(package => package.shouldRelease)) {
 
 logDebug('Getting packages information...');
 PACKAGES.forEach(package => {
-  package.path = `packages/${package.name}`;
-  package.version = getVersion(package, dryRun);
   if (package.workspaceDeps?.length > 0) {
     package.workSpaceTempDeps = [];
     package.workspaceDeps.forEach(dep => {
```

**File**: `scripts/release/releaseUtils.js` (modified, +3/-1)
```diff
@@ -24,6 +24,8 @@ let testSnapshot =
   (process.argv?.find(arg => arg.toLowerCase().includes('-snap'))?.length ?? 0) > 0 ||
   (process.argv?.find(arg => arg.toLowerCase().includes('-s'))?.length ?? 0) > 0;
 
+const bkVersionArg = process.argv.find(arg => arg.startsWith('-bkVersion='))?.split('=')[1];
+
 if (testRelease || testMaster || testSnapshot) {
   dryRun = true;
 }
@@ -58,7 +60,7 @@ function getVersion(package, dryRun) {
       break;
     case 'buildKiteVersion':
       releaseVersion = dryRun
-        ? `${semver.inc(package.packageJsonVersion, 'patch')}-dry-run`
+        ? (bkVersionArg ?? `${semver.inc(package.packageJsonVersion, 'patch')}-dry-run`)
         : childProcess.execSync(`buildkite-agent meta-data get version`).toString();
       break;
   }
```

**File**: `yarn.lock` (modified, +1/-0)
```diff
@@ -9672,6 +9672,7 @@ __metadata:
     eslint-plugin-react: "npm:^7.24.0"
     eslint-plugin-react-hooks: "npm:^4.0.4"
     eslint-plugin-react-native: "npm:^4.0.0"
+    jest: "npm:^29.6.3"
     prettier-eslint: "npm:16.3.0"
     typescript: "npm:5.0.4"
   languageName: unknown
```

#### Recent Merged Pull Requests:
- **PR #4042** (2026-09-06): fix: TabController - clear stuck press feedback when a tap is cancelled on iOS (@mika-bejerano)
- **PR #4038** (2026-09-01): fix: Dialog - prevent open animation interruption by residual touch on Android (@Yoavpagir)
- **PR #4037** (closed): fix: Dialog - prevent open animation interruption by residual touch on Android (@Yoavpagir)
- **PR #4036** (closed): fix(ScreenFooter): init animatedValue to 1 for opacity-based animations when visible (@adids1221)
- **PR #4035** (2026-07-29): fix: ScreenFooter - correct initial opacity for animationType 'none' (Android touch blocking) (@adids1221)
- **PR #4034** (2026-07-28): fix: guard isGravatarUrl against invalid URL strings (@adids1221)
- **PR #4033** (2026-07-19): fix: replace url-parse with native URL API (@alexandergolbergwix)
- **PR #4032** (closed): fix: bump url-parse to ^1.5.10 to resolve OSV vulnerability (@adids1221)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
