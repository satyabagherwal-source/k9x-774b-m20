# Forensic Learning Record (Deep Inspection): devlikeapro/waha

> **Canonical Artifact**: `07_PROJECT_LEARNING/devlikeapro-waha-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/devlikeapro/waha](https://github.com/devlikeapro/waha))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:41:20.151Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `devlikeapro/waha`
- **Description**: WAHA - WhatsApp HTTP API (REST API) that you can configure in a click! Multiple engines: WEBJS (browser based), NOWEB (websocket nodejs), GOWS (websocket go), WPP (browser)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 7519 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.precommit/validate_commit_message.py`
```
import subprocess
import sys


def get_staged_files():
    result = subprocess.run(["git", "diff", "--cached", "--name-only"], stdout=subprocess.PIPE, text=True)
    files = result.stdout.splitlines()
    return files


def get_commit_message(commit_msg_filepath):
    with open(commit_msg_filepath, 'r') as f:
        return f.readline().strip()


def main():
    commit_msg_filepath = sys.argv[1]
    commit_message = get_commit_message(commit_msg_filepath)
    staged_files = get_staged_files()

    has_plus_changes = any(f.startswith('src/plus') for f in staged_files)
    print(commit_message)
    starts_with_plus = commit_message.startswith('[PLUS]')

    if has_plus_changes and not starts_with_plus:
        print("'[PLUS]' not found in commit message, but there's changes are from 'src/plus'.")
        return 1

    if starts_with_plus and not all(f.startswith('src/plus') for f in staged_files):
        print("'[PLUS]' found in commit message, but there's changes from other directories. \n"
              "Changes MUST be only from 'src/plus'.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `examples/python/whatsapp_download_files_bot.py`
```
from os.path import abspath
from pprint import pprint

import requests
from flask import Flask
from flask import request

app = Flask(__name__)


def send_message(chat_id, text):
    """
    Send message to chat_id.
    :param chat_id: Phone number + "@c.us" suffix - 1231231231@c.us
    :param text: Message for the recipient
    """
    # Send a text back via WhatsApp HTTP API
    response = requests.post(
        "http://localhost:3000/api/sendText",
        json={
            "chatId": chat_id,
            "text": text,
            "session": "default",
        },
    )
    response.raise_for_status()

def send_seen(chat_id, message_id, participant):
    response = requests.post(
        "http://localhost:3000/api/sendSeen",
        json={
            "session": "default",
            "chatId": chat_id,
            "messageId": message_id,
            "participant": participant,
        },
    )
    response.raise_for_status()

@app.route("/")
def whatsapp_echo():
    return "WhatsApp Download Files Bot is ready!"


@app.route("/bot", methods=["GET", "POST"])
def whatsapp_webhook():
    if request.method == "GET":
        return "WhatsApp Download Files Bot is ready!"

    data = request.get_json()
    pprint(data)
    if data["event"] != "message":
        # We can't process other event yet
        return f"Unknown event {data['event']}"

    payload = data["payload"]
    # Ignore messages without files
    if not payload.get("mediaUrl", None):
        return "No files in the message"

    # Number in format 791111111@c.us
    chat_id = payload["from"]
    # Message ID - false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    message_id = payload['id']
    # For groups - who sent the message
    participant = payload.get('participant')
    # IMPORTANT - Always send seen before sending new message
    send_seen(chat_id=chat_id, message_id=message_id, participant=participant)

    # Download the file and download it to the current folder
    client_url = payload["mediaUrl"]
    filename = client_url.split("/")[-1]
    path = abspath("./" + filename)
    r = requests.get(client_url)
    with open(path, "wb") as f:
        f.write(r.content)

    # Send a text back via WhatsApp HTTP API
    text = f"We have downloaded file here: {path}"
    print(text)
    send_message(chat_id=chat_id, text=text)

    # Send OK back
    return "OK"

```

### Core Architecture Module: `examples/python/whatsapp_echo_bot.py`
```
import random
from pprint import pprint
from time import sleep

import requests
from flask import Flask
from flask import request

app = Flask(__name__)


def send_message(chat_id, text):
    """
    Send message to chat_id.
    :param chat_id: Phone number + "@c.us" suffix - 1231231231@c.us
    :param text: Message for the recipient
    """
    # Send a text back via WhatsApp HTTP API
    response = requests.post(
        "http://localhost:3000/api/sendText",
        json={
            "chatId": chat_id,
            "text": text,
            "session": "default",
        },
    )
    response.raise_for_status()

def reply(chat_id, message_id, text):
    response = requests.post(
        "http://localhost:3000/api/reply",
        json={
            "chatId": chat_id,
            "text": text,
            "reply_to": message_id,
            "session": "default",
        },
    )
    response.raise_for_status()


def send_seen(chat_id, message_id, participant):
    response = requests.post(
        "http://localhost:3000/api/sendSeen",
        json={
            "session": "default",
            "chatId": chat_id,
            "messageId": message_id,
            "participant": participant,
        },
    )
    response.raise_for_status()

def start_typing(chat_id):
    response = requests.post(
        "http://localhost:3000/api/startTyping",
        json={
            "session": "default",
            "chatId": chat_id,
        },
    )
    response.raise_for_status()

def stop_typing(chat_id):
    response = requests.post(
        "http://localhost:3000/api/stopTyping",
        json={
            "session": "default",
            "chatId": chat_id,
        },
    )
    response.raise_for_status()

def typing(chat_id, seconds):
    start_typing(chat_id=chat_id)
    sleep(seconds)
    stop_typing(chat_id=chat_id)

@app.route("/")
def whatsapp_echo():
    return "WhatsApp Echo Bot is ready!"


@app.route("/bot", methods=["GET", "POST"])
def whatsapp_webhook():
    if request.method == "GET":
        return "WhatsApp Echo Bot is ready!"

    data = request.get_json()
    pprint(data)
    if data["event"] != "message":
        # We can't process other event yet
        return f"Unknown event {data['event']}"

    # Payload that we've got
    payload = data["payload"]
    # The text
    text = payload.get("body")
    if not text:
        # We can't process non-text messages yet
        print("No text in message")
        print(payload)
        return "OK"
    # Number in format 1231231231@c.us or @g.us for group
    chat_id = payload["from"]
    # Message ID - false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    message_id = payload['id']
    # For groups - who sent the message
    participant = payload.get('participant')
    # IMPORTANT - Always send seen before sending new message
    send_seen(chat_id=chat_id, message_id=message_id, participant=participant)


    # Send a text back via WhatsApp HTTP API
    typing(chat_id=chat_id, seconds=random.random() * 3)
    send_message(chat_id=chat_id, text=text)

    # OR reply on the message
    typing(chat_id=chat_id, seconds=random.random() * 3)
    reply(chat_id=chat_id, message_id=message_id, text=text)

    # Send OK back
    return "OK"

```

### Core Architecture Module: `scripts/_find_unused_i18n.js`
```
#!/usr/bin/env node
const { readFileSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
const YAML = require('yaml');

const repoRoot = path.resolve(__dirname, '..');
const enPath = path.join(repoRoot, 'src/apps/chatwoot/i18n/locales/en-US.yaml');
const contents = readFileSync(enPath, 'utf8');
const document = YAML.parse(contents);

const flatten = (node, prefix = '') => {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    return Object.entries(node).reduce((acc, [key, value]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return acc.concat(flatten(value, next));
    }, []);
  }

  return [prefix];
};

const allKeys = flatten(document).filter(Boolean);

const ignoredPrefixes = ['datetime.', 'locale.'];

const ignored = new Set();
const unused = [];

const searchRoots = ['src', 'tests'];

for (const key of allKeys) {
  if (
    ignoredPrefixes.some((prefix) => key.startsWith(prefix)) ||
    !key.includes('.')
  ) {
    ignored.add(key);
    continue;
  }

  const result = spawnSync(
    'rg',
    [
      '--files-with-matches',
      '--fixed-strings',
      key,
      ...searchRoots,
      '--glob',
      '!apps/chatwoot/i18n/locales/*.yaml',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    unused.push(key);
  }
}

const message = [
  `Scanned ${allKeys.length} keys.`,
  `Ignored ${ignored.size} keys (datetime.*, locale.*, or without dot).`,
  unused.length
    ? `Found ${unused.length} potentially unused keys:\n - ${unused.join(
        '\n - ',
      )}`
    : 'No unused keys detected.',
];

console.log(message.join('\n'));

```

### Core Architecture Module: `scripts/gows-proto.js`
```
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yargs = require('yargs');

// Defaults
const CONFIG_FILE = 'waha.config.json';
// Load defaults from package.json
gows = (() => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return config.waha.gows || {};
  } catch (error) {
    return {};
  }
})();

const DEFAULT_REPO = gows.repo;
if (!DEFAULT_REPO) {
  throw new Error(`Missing default repo in ${CONFIG_FILE}`);
}
const DEFAULT_REF = gows.ref;
if (!DEFAULT_REF) {
  throw new Error('Missing default ref in ${CONFIG_FILE}');
}
const DEFAULT_DIR = './src/core/engines/gows/proto';

const PROTO_FILES = ['gows.proto'];
const PROTO_OUTPUT = './src/core/engines/gows/grpc';

// Helper function to clean directory
function cleanDirectory(directory, suffix) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    return;
  }

  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    if (file.endsWith(suffix)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Helper function to download files
async function downloadFiles(repo, ref, directory) {
  for (const file of PROTO_FILES) {
    const url = `https://github.com/${repo}/releases/download/${ref}/${file}`;
    const filePath = path.join(directory, file);
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      fs.writeFileSync(filePath, response.data);
      console.log(`Downloaded: ${file}`);
    } catch (error) {
      console.error(`Failed to download ${file}: ${error.message}`);
    }
  }
}

// Handler for fetch command
async function handleFetch(repo, ref, dir) {
  console.log(`Fetching .proto files from ${repo}@${ref} to ${dir}...`);
  cleanDirectory(dir, '.proto');
  await downloadFiles(repo, ref, dir);
}

// Handler for build command
function handleBuild(dir) {
  console.log('Building gRPC files...');
  cleanDirectory(PROTO_OUTPUT);

  const command = `grpc_tools_node_protoc \
        --plugin=protoc-gen-ts=node_modules/.bin/protoc-gen-ts \
        --plugin=protoc-gen-grpc=node_modules/.bin/grpc_tools_node_protoc_plugin \
        --js_out=import_style=commonjs,binary:${PROTO_OUTPUT} \
        --grpc_out=grpc_js:${PROTO_OUTPUT} \
        --ts_out=grpc_js:${PROTO_OUTPUT} \
        -I ${dir} ${dir}/gows.proto`;

  try {
    execSync(command, { stdio: 'inherit' });
    console.log('gRPC files built successfully.');
  } catch (error) {
    console.error(`Failed to build gRPC files: ${error.message}`);
  }
}

//
// Commands
//

// fetch
yargs.command(
  'fetch',
  'Fetch .proto files from GitHub',
  (yargs) => {
    yargs
      .option('repo', {
        describe: 'GitHub repository (owner/repo)',
        type: 'string',
        default: DEFAULT_REPO,
      })
      .option('ref', {
        describe: 'Git reference (branch or commit SHA)',
        type: 'string',
        default: DEFAULT_REF,
      })
      .option('dir', {
        describe: 'Directory to output .proto files',
        type: 'string',
        default: DEFAULT_DIR,
      });
  },
  async (argv) => {
    await handleFetch(argv.repo, argv.ref, argv.dir);
  },
);

// build
yargs.command(
  'build',
  'Build gRPC files from .proto files',
  (yargs) => {
    yargs.option('dir', {
      describe: 'Directory containing .proto files',
      type: 'string',
      default: DEFAULT_DIR,
    });
  },
  (argv) => {
    handleBuild(argv.dir);
  },
);

// Parse arguments
yargs.parse();

```

### Core Architecture Module: `scripts/init-waha.js`
```
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const forceIndex = args.indexOf('--force');
const forceOverwrite = forceIndex !== -1;

if (forceOverwrite) {
  args.splice(forceIndex, 1);
}

const folderArg = args[0] || '.';
const sourceArgRaw = args[1];
const targetArg = args[2] || '.env';

const envDir = path.resolve(process.cwd(), folderArg);
const sourceArg = sourceArgRaw || '.env.example';
const templateBaseDir = sourceArgRaw ? envDir : projectRoot;
const templatePath = path.isAbsolute(sourceArg)
  ? sourceArg
  : path.resolve(templateBaseDir, sourceArg);
const targetPath = path.isAbsolute(targetArg)
  ? targetArg
  : path.resolve(envDir, targetArg);

function exitWithMessage(message, code = 1) {
  console.error(message);
  process.exit(code);
}

if (!fs.existsSync(envDir)) {
  exitWithMessage(`Target directory does not exist: ${envDir}`);
}

if (!fs.existsSync(templatePath)) {
  exitWithMessage(`Missing template file: ${templatePath}`);
}

if (!forceOverwrite && fs.existsSync(targetPath)) {
  const stats = fs.statSync(targetPath);
  if (stats.size > 0) {
    exitWithMessage(
      `${targetPath} already exists and is not empty. Remove it manually or rerun with --force to overwrite.`,
    );
  }
}

const exampleContent = fs.readFileSync(templatePath, 'utf8');

function generateSecret() {
  return crypto.randomUUID({ disableEntropyCache: true }).replace(/-/g, '');
}

const apiKey = generateSecret();
const adminPassword = generateSecret();

const updatedContent = exampleContent
  .replace(/^WAHA_API_KEY=.*/m, `WAHA_API_KEY=${apiKey}`)
  .replace(/^WAHA_API_KEY_PLAIN=.*/m, `WAHA_API_KEY_PLAIN=${apiKey}`)
  .replace(/^WAHA_DASHBOARD_USERNAME=.*/m, 'WAHA_DASHBOARD_USERNAME=admin')
  .replace(
    /^WAHA_DASHBOARD_PASSWORD=.*/m,
    `WAHA_DASHBOARD_PASSWORD=${adminPassword}`,
  )
  .replace(/^WHATSAPP_SWAGGER_USERNAME=.*/m, 'WHATSAPP_SWAGGER_USERNAME=admin')
  .replace(
    /^WHATSAPP_SWAGGER_PASSWORD=.*/m,
    `WHATSAPP_SWAGGER_PASSWORD=${adminPassword}`,
  );

fs.writeFileSync(targetPath, updatedContent, { encoding: 'utf8' });

const generatedEnvValues = [
  `WAHA_API_KEY=${apiKey}`,
  `WAHA_API_KEY_PLAIN=${apiKey}`,
  'WAHA_DASHBOARD_USERNAME=admin',
  `WAHA_DASHBOARD_PASSWORD=${adminPassword}`,
  'WHATSAPP_SWAGGER_USERNAME=admin',
  `WHATSAPP_SWAGGER_PASSWORD=${adminPassword}`,
];

const lines = [
  'Credentials generated.',
  '',
  'Generated env values:',
  ...generatedEnvValues.map((line) => `  - ${line}`),
  '',
  'Use these credentials to login in Dashboard or Swagger:',
  '  - Username: admin',
  `  - Password: ${adminPassword}`,
  '',
  'Use this API key in the x-api-key header:',
  `  - ${apiKey}`,
  '',
  'Read more:',
  '  - https://waha.devlike.pro/docs/how-to/dashboard/#api-key',
  '  - https://waha.devlike.pro/docs/how-to/security/',
];

console.log(lines.join('\n'));

```

### Core Architecture Module: `scripts/release.js`
```
#!/usr/bin/env node
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execFileSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const readline = require('readline');

const DEV_BRANCH = process.env.WAHA_DEV_BRANCH || 'dev';
const CORE_BRANCH = process.env.WAHA_CORE_BRANCH || 'core';
const PLUS_BRANCH = process.env.WAHA_PLUS_BRANCH || 'plus';

const CORE_PREFIX = '[core]';
const PLUS_PREFIX = '[PLUS]';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const assumeYes = args.includes('--yes') || args.includes('-y');

function git(gitArgs, options) {
  const opts = options || {};
  return execFileSync('git', gitArgs, {
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

function gitOut(gitArgs) {
  return git(gitArgs, { inherit: false }).trim();
}

function log(message) {
  console.log(message);
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function ensureCleanTree() {
  const status = gitOut(['status', '--porcelain']);
  if (status) {
    fail(
      'Working tree is not clean. Commit or stash your changes before releasing.',
    );
  }
}

function ensureBranchExists(branch) {
  try {
    git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  } catch {
    fail(`Branch "${branch}" does not exist locally.`);
  }
}

// Non-merge commits in `boundary..head`, oldest first, whose subject starts
// with prefix. The boundary is the last-released plus tip: dev is rebased onto
// plus every release, so `plus..dev` is exactly the new, unreleased work.
// We intentionally do not use `git cherry` (patch-id matching) because core is
// a rewritten history whose old commits share no patch-ids with dev.
function commitsToCherryPick(boundary, head, prefix) {
  const format = '%H%x09%s';
  const output = gitOut([
    'rev-list',
    '--reverse',
    '--no-merges',
    `--format=${format}`,
    `${boundary}..${head}`,
  ]);
  if (!output) {
    return [];
  }
  const picks = [];
  for (const line of output.split('\n')) {
    // rev-list --format prefixes each entry with a "commit <sha>" header line.
    if (!line || line.startsWith('commit ')) {
      continue;
    }
    const tab = line.indexOf('\t');
    const sha = line.slice(0, tab);
    const subject = line.slice(tab + 1);
    if (subject.startsWith(prefix)) {
      picks.push({ sha: sha, subject: subject });
    }
  }
  return picks;
}

function cherryPickAll(picks) {
  for (const pick of picks) {
    log(`  cherry-pick ${pick.sha.slice(0, 9)} ${pick.subject}`);
    if (dryRun) {
      continue;
    }
    try {
      git(['cherry-pick', pick.sha], { inherit: true });
    } catch {
      git(['cherry-pick', '--abort'], { inherit: true });
      fail(
        `Cherry-pick of ${pick.sha.slice(0, 9)} failed (conflict). ` +
          `Aborted the cherry-pick — resolve manually and re-run.`,
      );
    }
  }
}

function checkout(branch) {
  log(`\n→ checkout ${branch}`);
  if (!dryRun) {
    git(['checkout', branch], { inherit: true });
  }
}

function confirm(question) {
  if (assumeYes || dryRun) {
    return Promise.resolve(true);
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(function resolver(resolve) {
    rl.question(`${question} [y/N] `, function onAnswer(answer) {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function main() {
  ensureCleanTree();
  [DEV_BRANCH, CORE_BRANCH, PLUS_BRANCH].forEach(ensureBranchExists);

  const startBranch = gitOut(['rev-parse', '--abbrev-ref', 'HEAD']);

  if (dryRun) {
    log('Running in --dry-run mode: no branches will be modified.\n');
  }

  // Capture the last-released plus tip before we touch anything. Step 3 merges
  // core into plus and moves the branch, so both pick sets must be computed
  // against this saved boundary, not the live plus ref.
  const boundary = gitOut(['rev-parse', PLUS_BRANCH]);
  log(`Boundary (last released ${PLUS_BRANCH}): ${boundary.slice(0, 9)}\n`);

  const corePicks = commitsToCherryPick(boundary, DEV_BRANCH, CORE_PREFIX);
  log(
    `Found ${corePicks.length} "${CORE_PREFIX}" commit(s) in ` +
      `${DEV_BRANCH} since last ${PLUS_BRANCH} release.`,
  );

  // Step 1 + 2: bring missing [core] commits onto core.
  checkout(CORE_BRANCH);
  cherryPickAll(corePicks);

  // Step 3: merge the freshly updated core into plus.
  checkout(PLUS_BRANCH);
  log(`\n→ merge ${CORE_BRANCH} into ${PLUS_BRANCH}`);
  if (!dryRun) {
    try {
      git(['merge', '--no-edit', CORE_BRANCH], { inherit: true });
    } catch {
      git(['merge', '--abort'], { inherit: true });
      fail(
        `Merge of ${CORE_BRANCH} into ${PLUS_BRANCH} failed (conflict). ` +
          `Aborted the merge — resolve manually and re-run.`,
      );
    }
  }

  // Step 4: bring missing [PLUS] commits onto plus (same saved boundary).
  const plusPicks = commitsToCherryPick(boundary, DEV_BRANCH, PLUS_PREFIX);
  log(
    `\nFound ${plusPicks.length} "${PLUS_PREFIX}" commit(s) in ` +
      `${DEV_BRANCH} since last ${PLUS_BRANCH} release.`,
  );
  cherryPickAll(plusPicks);

  // Step 5: rebase dev onto the freshly built plus.
  log(`\n→ rebase ${DEV_BRANCH} onto ${PLUS_BRANCH} (rewrites ${DEV_BRANCH})`);
  const proceed = await confirm(
    `This will force-rewrite "${DEV_BRANCH}". Continue?`,
  );
  if (!proceed) {
    fail('Aborted before rebasing dev. core/plus changes are kept.');
  }
  checkout(DEV_BRANCH);
  if (!dryRun) {
    try {
      git(['rebase', PLUS_BRANCH], { inherit: true });
    } catch {
      git(['rebase', '--abort'], { inherit: true });
      fail(
        `Rebase of ${DEV_BRANCH} onto ${PLUS_BRANCH} failed (conflict). ` +
          `Aborted the rebase — resolve manually and re-run.`,
      );
    }
  }

  if (dryRun) {
    checkout(startBranch);
    log('\nDry run complete. Re-run without --dry-run to apply.');
  } else {
    log(
      `\n✓ Release complete. ${DEV_BRANCH} now sits on top of ${PLUS_BRANCH}.`,
    );
    log(
      `  Push when ready: git push origin ${CORE_BRANCH} ${PLUS_BRANCH} ` +
        `&& git push --force-with-lease origin ${DEV_BRANCH}`,
    );
  }
}

main().catch(function onError(error) {
  fail(error.message || String(error));
});

```

### Core Architecture Module: `scripts/up-dashboard.js`
```
#!/usr/bin/env node
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');

const CONFIG_FILE = 'waha.config.json';

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const { repo } = config.waha.dashboard;
if (!repo) {
  console.error(`Missing dashboard.repo in ${CONFIG_FILE}`);
  process.exit(1);
}

const branch = 'gh-pages';
console.log(`Fetching latest commit for ${repo}@${branch}...`);

const output = execSync(
  `git ls-remote https://github.com/${repo} refs/heads/${branch}`,
  { encoding: 'utf8' },
);

const sha = output.split('\t')[0].trim();
if (!sha) {
  console.error(`Could not resolve ref ${branch} for ${repo}`);
  process.exit(1);
}

config.waha.dashboard.ref = sha;
fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log(`Updated ${CONFIG_FILE}: dashboard.ref = ${sha}`);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2277** (2026-09-24): **[WEBJS] - /api/sendImage fails with "Data passed to getter must include an id property ... but got undefined"**
  *Symptoms*: ### Describe the bug  Sending an image via `POST /api/sendImage` fails with a 500 error.  The failure happens inside the WEBJS engine while evaluating `window.WWebJS.sendMessage` against WhatsApp Web. WhatsApp Web throws:  `Data passed to getter must include an id property (it's how we memoize) but got undefined`  ### Version  ```json {   "version": "2026.7.1",   "engine": "WEBJS",   "tier": "PLUS",   "browser": "Chrome",   "platform": "linux/x64" } ```  ## Steps  **To Reproduce** Steps to reproduce the behavior:  1. Run WAHA with engine `WEBJS`. 2. Start and authenticate a session (QR pairing), state `WORKING`. 3. Send a `POST /api/sendImage` request to a channel chat (`…@newsletter`):  ```json {   "session": "***",   "chatId": "***@newsletter",   "file": {     "mimetype": "image/jpeg",     "filename": "filename.jpg",     "url": "https://***"   },   "caption": "string" } ```  4. Observe the 500 response / log error below.  ### Error Response / Log  ```text [15:15:21.698] INFO (48): request errored {"reqId":260,"req":{"id":260,"method":"POST","url":"/api/sendImage","query":{},"params":{"path":["api","sendImage"]}},"res":{"statusCode":500},"responseTime":1495}     err: {       "type": "Error",       "message": "Data passed to getter must include an id property (it's how we memoize) but got undefined\ns (https://static.whatsapp.net/rsrc.php/v4/y8/r/utfPCwANvyO.js:85:180)",       "stack":           Error: Data passed to getter must include an id property (it's how we memoize) bu
  **Post-Mortem & Fix Analysis**:
  > @devlikepro Hi, can you estimate how long it will take to solve the problem? We've been using WAHA for quite a long time and have some problems with ours customers right now. Looking forward to a good solution as always, thanks :)
  > Topic is urgent for me as well
  > You need to update WAHA; the issue has been fixed in the latest version.  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

- **Issue #2271** (2026-09-22): **[WEBJS] - Data passed to getter must include an id property (it's how we memoize) but got undefined**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is. Feel free to remove sections that you don't feel to make the text shorter!  ### Version  Get the WAHA version by calling `GET /api/version`  ```json { "version":"2026.8.2", "engine":"WEBJS", "tier":"PLUS","browser":"/usr/bin/google-chrome", "platform":"linux/x64", "worker":  {"id":null} } ```  Try to update to [the latest version](https://github.com/devlikeapro/waha/releases) before creating an issue!  ## Steps  **To Reproduce** Steps to reproduce the behavior:  Send messages  **Error message** ```json "stack\\\":\\\"Error: Data passed to getter must include an id property (it's how we memoize) but got undefined\\ns (https://static.whatsapp.net/rsrc.php/v4/ys/r/cmqMr-wgNWt.js:84:180)\\n    at #evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/ExecutionContext.js:391:56)\\n    at async ExecutionContext.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/ExecutionContext.js:277:16)\\n    at async IsolatedWorld.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/IsolatedWorld.js:100:16)\\n    at async CdpFrame.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/api/Frame.js:362:20)\\n    at async CdpPage.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/api/Page.js:818:20)\\n    at async WPage.evaluate (/app/dist/core/engines/webjs/WPage.js:13:20)\\n    at async WebjsClientCore.sendMessage (/app/node_modules/whatsapp-web.js/src/Client.js:1831:25)
  **Post-Mortem & Fix Analysis**:
  > i had the same issue when use sendFile api  "message": "Data passed to getter must include an id property (it's how we memoize) but got undefined\ns (https://static.whatsapp.net/rsrc.php/v4/ys/r/cmqMr-wgNWt.js:84:180)"
  > I was using it inside an n8n build in Docker Compose, and i am having the same issue when using the SendFile API.  500 - "{\"statusCode\":500,\"timestamp\":\"2026-09-18T12:12:40.919Z\",\"exception\":{\"message\":\"Data passed to getter must include an id property (it's how we memoize) but got undefined\\ns (https://static.whatsapp.net/rsrc.php/v4/yL/r/6-eerGMZKhM.js:84:180)
  > The bug seems to be fixed on the web.js side: https://github.com/wwebjs/whatsapp-web.js/issues/201922. @devlikepro, can we get a hotfix for this?

- **Issue #2269** (2026-09-17): **[WEBJS] - Dashboard sends WHATSAPP_SWAGGER_USERNAME as x-api-key header instead of WAHA_API_KEY**
  *Symptoms*: Environment  WAHA version: 2026.8.2 Engine: WEBJS Tier: CORE Platform: linux/x64 Installed via: Docker (devlikeapro/waha)  Description  When WAHA_API_KEY and WHATSAPP_SWAGGER_USERNAME are both configured, the dashboard sends the value of WHATSAPP_SWAGGER_USERNAME as the x-api-key request header instead of WAHA_API_KEY. This causes all dashboard API requests to return 401 Unauthorized.  Steps to Reproduce  Run WAHA Core with the following environment variables set: WAHA_API_KEY=<some_key> WHATSAPP_SWAGGER_USERNAME=admin WHATSAPP_SWAGGER_PASSWORD=<some_password> Open the dashboard in a browser Complete Basic Auth login with WHATSAPP_SWAGGER_USERNAME / WHATSAPP_SWAGGER_PASSWORD Open browser DevTools → Network tab Inspect the request headers of any API call made by the dashboard (e.g. GET /api/sessions)  Expected Behavior  The dashboard should send the value of WAHA_API_KEY in the x-api-key header.  Actual Behavior  The x-api-key header contains the value of WHATSAPP_SWAGGER_USERNAME instead of WAHA_API_KEY:  x-api-key: admin  This causes all dashboard requests to return 401 Unauthorized when WAHA_API_KEY !== WHATSAPP_SWAGGER_USERNAME.  Workaround  Set WAHA_API_KEY to the same value as WHATSAPP_SWAGGER_USERNAME:  WAHA_API_KEY=admin WHATSAPP_SWAGGER_USERNAME=admin  This is obviously not ideal from a security standpoint, as it forces the API key to be a predictable value.  Additional Notes  The API itself works correctly — requests made directly with curl using the proper X-Api-Key
  **Post-Mortem & Fix Analysis**:
  > https://waha.devlike.pro/docs/how-to/dashboard/#api-key  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > "After reading the docs more carefully, I realized the issue was on my end. The correct environment variables are WAHA_DASHBOARD_USERNAME / WAHA_DASHBOARD_PASSWORD (not WHATSAPP_SWAGGER_*), and the API key needs to be entered manually in the dashboard UI. The dashboard was sending the username as the API key because no key was configured in the UI. Closing as user error — leaving this open for others who might hit the same confusion."

- **Issue #2266** (2026-09-22): **[WEBJS] - POST /api/{session}/groups/join fails with joinGroupViaInvite is undefined**
  *Symptoms*: ### Describe the bug  Joining a WhatsApp group using the documented endpoint fails with HTTP 500 on the WEBJS engine.  The invite code is valid because `groups/join-info` successfully returns the group information, but `groups/join` fails inside whatsapp-web.js.  The issue reproduces on both WAHA 2026.7.1 and 2026.8.2.  ### Version  Get the WAHA version by calling `GET /api/version`  ```json {     "version": "2026.8.2",     "engine": "WEBJS",     "tier": "CORE",     "browser": "/usr/bin/chromium",     "platform": "linux/x64",     "worker": {         "id": null     } } ```  Try to update to [the latest version](https://github.com/devlikeapro/waha/releases) before creating an issue!  ## Steps  **To Reproduce** Steps to reproduce the behavior: 1. Start an authenticated WEBJS session. 2. Obtain a valid WhatsApp group invite link. 3. Verify the invite:     GET /api/{session}/groups/join-info?code=REDACTED  4. The endpoint returns HTTP 200 with valid group information. 5. Attempt to join:     POST /api/{session}/groups/join  The endpoint returns HTTP 500:  Cannot read properties of undefined (reading 'joinGroupViaInvite')  ### Expected behavior  The account should join the group, or a membership approval request should be created when admin approval is enabled  ### Docker Logs  {   "level": 30,   "req": {     "method": "GET",     "url": "/api/{session}/groups/join-info?code=<REDACTED_INVITE_CODE>",     "query": {       "code": "<REDACTED_INVITE_CODE>"     }   },   "res": {     "sta
  **Post-Mortem & Fix Analysis**:
  > It seems the problem is in whatsapp-web.js
  > **Let's try dev image** 🤞🏻  Make sure to select the [**engine**](https://waha.devlike.pro/docs/how-to/engines/) via the environment variable - `WHATSAPP_DEFAULT_ENGINE=WEBJS|GOWS|NOWEB`:  -   `devlikeapro/waha:dev` -   `devlikeapro/waha:dev-chrome` -   `devlikeapro/waha:dev-arm`  🚀 Will be included in the next release!  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

- **Issue #2246** (2026-09-01): **[GOWS][Chatwoot] #2208 still not fixed in 2026.8.1 – duplicate contact created for same LID without phone number**
  *Symptoms*: ### Related issue  This is a continuation of #2208.  The issue was closed after the fixes released in `2026.8.1`, but unfortunately the original problem is still happening with GOWS + the native Chatwoot integration.  I am currently working around the issue manually, and while doing this I discovered another consequence when the customer already exists in Chatwoot.  ### The original #2208 problem is still happening  Incoming messages are still creating Chatwoot contacts using only the LID, without the correct phone number being passed/resolved by the native integration.  For example, an incoming message creates a contact using:  ```text id="qg61xk" 7876986835002@lid ```  But if I manually query WAHA for exactly the same LID, WAHA correctly resolves it:  ```json id="mlw16a" [   {     "lid": "7876986835002@lid",     "pn": "5511986435945@c.us"   } ] ```  So WAHA knows:  ```text id="q5w0ox" 7876986835002@lid         ↓ 5511986435945@c.us ```  However, this phone number is still not being correctly passed/used by the native Chatwoot integration.  This means the original issue reported in #2208 does not appear to be fully fixed.  ### When the customer does NOT already exist in Chatwoot  If this is a new customer and there is no existing Chatwoot contact with that phone number, I can work around the problem manually.  I resolve the LID using WAHA:  ```text id="5l1qfn" 7876986835002@lid → 5511986435945@c.us ```  and then manually update the Chatwoot contact with:  ```text id="b6rkp6" 
  **Post-Mortem & Fix Analysis**:
  > `2026.8.2` - match existing contacts by resolved phone number for `@lid` chats and backfill missing `phone_number` - [#2208](https://github.com/devlikeapro/waha/issues/2208)  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

- **Issue #2241** (2026-09-01): **[GOWS][Chatwoot] - 2026.8.1 maps mirrored fromMe messages to the wrong contact/conversation**
  *Symptoms*: ### Describe the bug  After upgrading WAHA GOWS from `2026.7.1` to `2026.8.1`, outgoing messages sent directly from the linked WhatsApp mobile/desktop client to different 1:1 contacts were mirrored into Chatwoot under the same incorrect contact/conversation.  Incoming replies continued to arrive under their own contact conversations. WhatsApp itself displayed the recipients and history correctly; the incorrect association occurred in the WAHA-to-Chatwoot synchronization.  **This affected an existing production integration that had been working correctly on `2026.7.1`. The impact was immediate on ongoing conversations and created a data-integrity/privacy risk, so we could not keep `2026.8.1` deployed. We had to perform an emergency rollback to `2026.7.1`. Without changing configuration or session data, the rollback restored correct conversation routing.**  ### Version  ```json {   "version": "2026.8.1",   "engine": "GOWS",   "tier": "CORE" } ```  - Regressing image: `devlikeapro/waha:gows-2026.8.1` - Regressing manifest: `sha256:853dfeda32bb46f07423b61e562b164b503f242d3fa21aeb8e67e2c42b2087d5` - Known-good image after rollback: `devlikeapro/waha:gows-2026.7.1` - Known-good manifest: `sha256:8f3a7b11310594b973a588b2f7de061864c83532ae2cdff43280db0402bead29` - Deployment: Docker Swarm - Chatwoot-compatible application: v4.20.0 - Existing authenticated session and persistent volumes were preserved.  ### Steps to reproduce  1. Run an authenticated GOWS session on `2026.7.1` with th
  **Post-Mortem & Fix Analysis**:
  > `2026.8.2` - **GOWS** - `fromMe` messages mirrored to the wrong contact/conversation - [#2241](https://github.com/devlikeapro/waha/issues/2241)  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > Please reopen #2241: the same user-visible routing failure occurs with GOWS 2026.8.2 in our existing Chatwoot-compatible integration.  We upgraded from 2026.7.1 to 2026.8.2 on September 10 after the release notes declared this fixed. On September 16 a user reported native WhatsApp outgoing messages to different recipients appearing in one incorrect conversation, while incoming replies appeared separately.  Read-only database checks show the problem is not confined to the reporting account. For mirrored outgoing AgentBot messages during comparable six-day windows before/after the deployment:  | Anonymized inbox | Before: messages / distinct conversations | After: messages / distinct conversations | After: messages assigned to own-number contact | | --- | --- | --- | --- | | A | 472 / 87 | 555 / 1 | 555 | | B | 117 / 15 | 98 / 1 | 98 | | C | 2 / 2 | 3 / 1 | 3 |  Inbox C has too little traffic to establish misrouting independently. Inbox B shows a strong matching pattern, although we have
  > @devlikepro, could you please review our September 16 follow-up above? We reproduced the wrong-conversation routing with GOWS 2026.8.2 in our Chatwoot-compatible native webhook integration and rolled back to 2026.7.1. Issue #2241 is still closed, and the 2026.9.1 release notes do not mention a fix for this recurrence.  Could you confirm whether 2026.9.1 changes the recipient identity fields for native-client `fromMe` events, or advise which sanitized fields you need to distinguish a GOWS event issue from our webhook consumer's normalization? We can provide an anonymized field comparison. We are holding the update until this routing behavior can be verified safely. Thank you.

- **Issue #2239** (2026-09-22): **[NOWEB] - Some webp files fail to download or display correctly.**
  *Symptoms*: ```  {     "id": "evt_01m0xx31cj9qweg9zxaf51mbp9",     "timestamp": 1787709982098,     "event": "message.any",     "session": "036322",     "metadata": {},     "me": {       "id": "xxx@c.us",       "pushName": "leo",       "lid": "172078351257794@lid",       "reachoutTimelock": null,       "messageCapping": {         "cappingStatus": "NONE",         "totalQuota": 0,         "usedQuota": 0,         "cycleStart": 0,         "cycleEnd": 1,         "mvStatus": "NOT_ELIGIBLE",         "oteStatus": "NOT_ELIGIBLE"       }     },     "payload": {       "id": "xxx@g.us_AC6C100E31E2E6127D13CA7EA296C897_172078351257794@lid",       "timestamp": 1787709981,       "from": "xxx@g.us",       "fromMe": true,       "source": "app",       "body": null,       "to": "xxx@g.us",       "participant": "172078351257794@lid",       "hasMedia": true,       "media": {         "url": "http://localhost:3000/api/files/036322/AC6C100E31E2E6127D13CA7EA296C897.webp",         "filename": "AC6C100E31E2E6127D13CA7EA296C897.webp",         "mimetype": "image/webp"       },       "ack": 1,       "ackName": "SERVER",       "location": null,       "vCards": null,       "replyTo": null,       "_data": {         "key": {           "remoteJid": "xxx@g.us",           "fromMe": true,           "id": "AC6C100E31E2E6127D13CA7EA296C897",           "participant": "xxx@lid",           "addressingMode": "lid"         },         "messageTimestamp": 1787709981,         "pushName": "leo",         "broadcast": false,         "statu
  **Post-Mortem & Fix Analysis**:
  > Hi! Is there any logs?  I see webp in `media.url` and I also converted it correctly from `stickerMessage.url` in your example locally, but perhaps there was some error in logs?  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > Could you check if `http://localhost:3000/api/files/036322/AC6C100E31E2E6127D13CA7EA296C897.webp"` is an archive actually?  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > > Could you check if `http://localhost:3000/api/files/036322/AC6C100E31E2E6127D13CA7EA296C897.webp"` is an archive actually? >  > [![patron:PRO](https://camo.githubusercontent.com/f603a6a99a2dbd219edd08c5cfb2b5edf01581c2e2e5e21a5d50298508c04a6f/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f706174726f6e2d50524f2d313838613432)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)  <img width="510" height="383" alt="Image" src="https://github.com/user-attachments/assets/da644aed-b60f-4e18-8345-ded4e5b633b2" />  This is what it looks like when I access it from Chrome, but I'm not sure why. 

- **Issue #2236** (2026-09-01): **[WEBJS] - Deleting a message in a WhatsApp Channel/Newsletter fails**
  *Symptoms*: ### Describe the bug  When attempting to delete a message sent inside a WhatsApp Channel (@newsletter) using the DELETE /api/{session}/chats/{chatId}/messages/{messageId} endpoint, the API throws a 500 Internal Server Error.  The underlying engine crashes inside whatsapp-web.js with a TypeError: this.findImpl is not a function. This prevents admin/owner from deleting messages posted to a channel  ### Version  Get the WAHA version by calling `GET /api/version`  ```json {     "version": "2026.8.1",     "engine": "WEBJS",     "tier": "CORE",     "browser": "/usr/bin/chromium",     "platform": "linux/x64",     "worker": { "id": null } } ```   ## Steps  **To Reproduce** Steps to reproduce the behavior:  1. Send a message to a WhatsApp Channel (120363409567938821@newsletter) where the session account is an Owner/Admin.  2. Obtain the message ID from the response (e.g., true_120363409567938821@newsletter_3EB0637ECFE7D419FE99B2).  3. Send a DELETE request to remove the message using proper URL-encoding for the @ symbols (%40):  ```bash curl -X 'DELETE' \   'http://localhost:3000/api/Default/chats/120363409567938821%40newsletter/messages/true_120363409567938821%40newsletter_3EB0637ECFE7D419FE99B2' \   -H 'accept: */*' \   -H 'x-api-key: [REDACTED]' ```  ### Expected behavior  The message should be successfully revoked and deleted from the WhatsApp Channel.  ### Requests - Responses  The API returns a 500 Internal Server Error, failing to delete the message due to a library-level DOM e
  **Post-Mortem & Fix Analysis**:
  > `2026.8.2` - **WEBJS** - Channels - deleting a message in a channel failed - [#2236](https://github.com/devlikeapro/waha/issues/2236)  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

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

### Incident Patch 1: `7d7d3311` (2026-09-30)
**Commit Message**: fix(NOWEB): fix deleting channel message - fix #2038 (#2284)

**File**: `src/core/engines/noweb/session.noweb.core.ts` (modified, +4/-0)
```diff
@@ -1148,6 +1148,10 @@ export class WhatsappSessionNoWebCore extends WhatsappSession {
     const options = {
       messageId: this.generateMessageID(),
     };
+    if (isJidNewsletter(jid)) {
+      // Newsletter deletes reuse the original message ID
+      options.messageId = key.id;
+    }
     return this.sock.sendMessage(jid, { delete: key }, options);
   }
 
```

---

### Incident Patch 2: `55a7d78e` (2026-09-22)
**Commit Message**: fix(NOWEB): template message with image header — hasMedia:true but download fails - fix #2275

**File**: `src/core/engines/noweb/session.noweb.core.ts` (modified, +16/-2)
```diff
@@ -3794,6 +3794,20 @@ export class NOWEBEngineMediaProcessor implements IMediaEngineProcessor<any> {
       content.url = null;
     }
 
+    // Baileys unwraps hydratedTemplate only, so download the interactive template header as a plain media message
+    const header = extractMessageContent(message.message)?.templateMessage
+      ?.interactiveMessageTemplate?.header;
+    if (header) {
+      message = {
+        key: message.key,
+        message: lodash.pick(header, [
+          'imageMessage',
+          'videoMessage',
+          'documentMessage',
+        ]),
+      };
+    }
+
     // Use 'stream' mode instead of 'buffer' to fix 0-byte audio files
     // 'buffer' mode silently returns empty buffer for audio/voice messages
     // See: https://github.com/devlikeapro/waha/issues/1996
@@ -3826,8 +3840,8 @@ export class NOWEBEngineMediaProcessor implements IMediaEngineProcessor<any> {
   }
 
   getFilename(message: any): string | null {
-    const content = extractMessageContent(message.message);
-    return content?.documentMessage?.fileName || null;
+    const content = extractMediaContent(message.message);
+    return content?.fileName || null;
   }
 }
 
```

**File**: `src/core/engines/noweb/utils.ts` (modified, +4/-1)
```diff
@@ -36,7 +36,10 @@ export function extractMediaContent(
     content?.templateMessage?.hydratedTemplate?.videoMessage ||
     content?.templateMessage?.interactiveMessageTemplate?.header
       ?.imageMessage ||
-    content?.templateMessage?.interactiveMessageTemplate?.header?.videoMessage;
+    content?.templateMessage?.interactiveMessageTemplate?.header
+      ?.videoMessage ||
+    content?.templateMessage?.interactiveMessageTemplate?.header
+      ?.documentMessage;
   if (mediaContent) {
     return mediaContent;
   }
```

---

### Incident Patch 3: `82046700` (2026-09-22)
**Commit Message**: up: WEBJS - fix "Data passed to getter must include an id property (it's how we memoize) but got undefined" - fix #2271 fix #2273

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -14381,7 +14381,7 @@ __metadata:
 
 "whatsapp-web.js@github:devlikeapro/whatsapp-web.js#fork-main-2026-06-26":
   version: 1.34.7
-  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=55a5d3a58a6cbdb8d6927f7de25c790e26257519"
+  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=481db6c749f9ca1a2afad34f520769eace9d8f29"
   dependencies:
     archiver: "npm:7.0.1"
     fluent-ffmpeg: "npm:2.1.3"
@@ -14398,7 +14398,7 @@ __metadata:
       optional: true
     unzipper:
       optional: true
-  checksum: 10/7f74f507c4180b0f4f2e273eded05f09583864004e4bf0af3cc4024b72754bf0df23a6e8f508f8ccc3bced1942d7ab56e9787b1b6e78cdba89affdc96e32c680
+  checksum: 10/917a28428c55aeaf548b726c4afe1a56100cddac5facc4d9306123a06f34f62f36df19094350bd7623668f5065fa891e81c29c8b7615369f773657bb00fa463a
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 4: `0e73561b` (2026-09-17)
**Commit Message**: fix(openapi): tags for apps

**File**: `src/apps/argentine-phone-numbers/app.module.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { ArgentinePhoneNumbersAppService } from '@waha/apps/argentine-phone-numb
 const argentinephonenumbersAppModule: AppModule = {
   name: AppName.argentinePhoneNumbers,
   openapi: {
-    title: 'Argentine Phone Numbers',
+    title: 'Phone Numbers: Argentina',
     description:
       'Resolve Argentine phone numbers (with and without the mobile 9)',
   },
```

**File**: `src/apps/brazilian-phone-numbers/app.module.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { BrazilianPhoneNumbersAppService } from '@waha/apps/brazilian-phone-numb
 const brazilianphonenumbersAppModule: AppModule = {
   name: AppName.brazilianPhoneNumbers,
   openapi: {
-    title: 'Brazilian Phone Numbers',
+    title: 'Phone Numbers: Brazil',
     description: 'Resolve Brazilian phone numbers (with and without 9 digit)',
   },
   definition: {
```

---

### Incident Patch 5: `f1f25cf8` (2026-09-16)
**Commit Message**: up(NOWEB): fix thumbnails in history

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ __metadata:
 
 "@adiwajshing/baileys@github:devlikeapro/Baileys#fork-master-2026-04-28":
   version: 7.0.0-rc14
-  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=50da8378cf23b654334963769b6ca6989e6c47ca"
+  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=94d2d1be16f2a316d388a9a273e43ac38a731b5d"
   dependencies:
     "@cacheable/node-cache": "npm:^1.4.0"
     "@hapi/boom": "npm:^9.1.3"
@@ -32,7 +32,7 @@ __metadata:
       optional: true
     link-preview-js:
       optional: true
-  checksum: 10/4e202009324a3c2636c9aac4631da60ff3a908e078f1fb197dff1210687825320366b10145e0c2b71d5e84efd595f409fb814eef9128a4e7db558fbf34d51279
+  checksum: 10/6573177fd2fded5a674ae13f397a837ea976a5cde9b3f4021c9700921b986a7c2030ce4cce66008c879ce8e016e94eb67999ae61fa514cae321c32d6c149ff01
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 6: `8b73f512` (2026-09-16)
**Commit Message**: fix: logger args

**File**: `src/apps/app_sdk/JobLoggerWrapper.ts` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ export class JobLoggerWrapper implements ILogger {
     this.job
       .log(`[${timestamp}] ${level.toUpperCase()}: ${msg}`)
       .catch((err) => {
-        this.logger.error('Error logging message to job', err);
+        this.logger.error(err, 'Error logging message to job');
       });
   }
 }
```

**File**: `src/core/media/local/MediaLocalStorage.ts` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ export class MediaLocalStorage implements IMediaStorage {
         const remaining = expired ? jitter : left;
         this.postponeRemoval(filepath, remaining);
       } catch (err) {
-        this.log.warn(`Failed to schedule removal for file ${entry}`, err);
+        this.log.warn(err, `Failed to schedule removal for file ${entry}`);
       }
     }
   }
```

**File**: `src/main.ts` (modified, +3/-3)
```diff
@@ -29,17 +29,17 @@ const logger: Logger = pino({
 }).child({ name: 'Bootstrap' });
 
 process.on('uncaughtException', (err) => {
-  logger.error('Uncaught Exception:', err);
+  logger.error(err, 'Uncaught Exception');
   if (err instanceof Error) {
     logger.error(err.stack);
   }
 });
 process.on('unhandledRejection', (reason, promise) => {
-  logger.error('Unhandled Rejection at:', promise);
+  logger.error({ promise: promise }, 'Unhandled Rejection at');
   if (reason instanceof Error) {
     logger.error(reason.stack);
   } else {
-    logger.error('Unhandled rejection reason:', reason);
+    logger.error(reason, 'Unhandled rejection reason');
   }
 });
 logger.info('NODE - Catching unhandled rejections and exceptions enabled');
```

**File**: `src/modules/waha-maintain-online-status/MaintainOnlineStatusPlugin.ts` (modified, +2/-2)
```diff
@@ -69,7 +69,7 @@ export class MaintainOnlineStatusPlugin extends SessionPlugin<MaintainOnlineStat
         await this.session.setPresence(WAHAPresenceStatus.ONLINE);
         this.logger.debug('Set presence to ONLINE due to activity');
       } catch (error) {
-        this.logger.debug('Failed to set presence ONLINE', error);
+        this.logger.debug(error, 'Failed to set presence ONLINE');
         return;
       }
     }
@@ -91,7 +91,7 @@ export class MaintainOnlineStatusPlugin extends SessionPlugin<MaintainOnlineStat
         );
       } catch (error) {
         this.session.presence = WAHAPresenceStatus.OFFLINE;
-        this.logger.debug('Failed to set presence OFFLINE', error);
+        this.logger.debug(error, 'Failed to set presence OFFLINE');
       }
       this.cleanupPresenceTimeout();
     }, this.config.duration);
```

**File**: `src/nestjs/HttpsExpress.ts` (modified, +3/-3)
```diff
@@ -26,13 +26,13 @@ export class HttpsExpress {
 
   readSync() {
     this.logger.info('Reading HTTPS certificates...');
-    this.logger.info('HTTPS Key Path:', this.keyPath);
+    this.logger.info(`HTTPS Key Path: ${this.keyPath}`);
     const key = fs.readFileSync(this.keyPath);
 
-    this.logger.info('HTTPS Cert Path:', this.certPath);
+    this.logger.info(`HTTPS Cert Path: ${this.certPath}`);
     const cert = fs.readFileSync(this.certPath);
 
-    this.logger.info('HTTPS CA Path:', this.caPath);
+    this.logger.info(`HTTPS CA Path: ${this.caPath}`);
     const ca = this.caPath ? fs.readFileSync(this.caPath) : undefined;
 
     this.logger.info('HTTPS certificates read successfully');
```

---

### Incident Patch 7: `b1a87b43` (2026-09-16)
**Commit Message**: fix(NOWEB): fix media reupload - fix #2265

**File**: `src/core/engines/noweb/session.noweb.core.ts` (modified, +29/-10)
```diff
@@ -3732,6 +3732,16 @@ function hasPath(url: string) {
   }
 }
 
+// Definitive download failures - retrying would only send another re-upload receipt to the phone
+const NON_RETRIABLE_DOWNLOAD_MEDIA_STATUSES: Set<number> = new Set([
+  403, // CDN forbidden
+  404, // CDN not found / phone: NOT_FOUND
+  408, // phone did not answer the re-upload request in time
+  410, // CDN gone
+  412, // phone: DECRYPTION_ERROR
+  418, // phone: GENERAL_ERROR
+]);
+
 export class NOWEBEngineMediaProcessor implements IMediaEngineProcessor<any> {
   private readonly logger: ILogger;
 
@@ -3787,18 +3797,27 @@ export class NOWEBEngineMediaProcessor implements IMediaEngineProcessor<any> {
     // Use 'stream' mode instead of 'buffer' to fix 0-byte audio files
     // 'buffer' mode silently returns empty buffer for audio/voice messages
     // See: https://github.com/devlikeapro/waha/issues/1996
-    const stream = await downloadMediaMessage(
-      message,
-      'stream',
-      {},
-      {
-        logger: this.logger,
-        reuploadRequest: this.session.sock.updateMediaMessage,
-      },
-    ).finally(() => {
+    let stream;
+    try {
+      stream = await downloadMediaMessage(
+        message,
+        'stream',
+        {},
+        {
+          logger: this.logger,
+          reuploadRequest: this.session.sock.updateMediaMessage,
+        },
+      );
+    } catch (err) {
+      if (NON_RETRIABLE_DOWNLOAD_MEDIA_STATUSES.has(err?.output?.statusCode)) {
+        // Retrying won't help and would send yet another re-upload receipt to the phone
+        err.nonRetriable = true;
+      }
+      throw err;
+    } finally {
       // Set url back in case we removed it
       content.url = url;
-    });
+    }
     const chunks: Buffer[] = [];
     for await (const chunk of stream) {
       chunks.push(chunk);
```

**File**: `yarn.lock` (modified, +165/-116)
```diff
@@ -7,7 +7,7 @@ __metadata:
 
 "@adiwajshing/baileys@github:devlikeapro/Baileys#fork-master-2026-04-28":
   version: 7.0.0-rc14
-  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=738b4505a02b02dfe039df4b2e440cb5be8c85ad"
+  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=50da8378cf23b654334963769b6ca6989e6c47ca"
   dependencies:
     "@cacheable/node-cache": "npm:^1.4.0"
     "@hapi/boom": "npm:^9.1.3"
@@ -32,7 +32,7 @@ __metadata:
       optional: true
     link-preview-js:
       optional: true
-  checksum: 10/2012c64a669b7b6f88f3fd96b1faed166d9ad616966f1f09332df95c7fc9f6248c1ecc808117adffd12cda5f456b192b25ffd58654cd2be1e3bda2d6e427bae2
+  checksum: 10/4e202009324a3c2636c9aac4631da60ff3a908e078f1fb197dff1210687825320366b10145e0c2b71d5e84efd595f409fb814eef9128a4e7db558fbf34d51279
   languageName: node
   linkType: hard
 
@@ -1172,13 +1172,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@borewit/text-codec@npm:^0.1.0":
-  version: 0.1.1
-  resolution: "@borewit/text-codec@npm:0.1.1"
-  checksum: 10/94c1fef259292d77c98ad1c2ffa66e366d752153962d37a7999489ada9632a9d36d3fe291759791705b1f501e33cd7b65128d193e0ca8a955107fe5cd8fde548
-  languageName: node
-  linkType: hard
-
 "@borewit/text-codec@npm:^0.2.1, @borewit/text-codec@npm:^0.2.2":
   version: 0.2.2
   resolution: "@borewit/text-codec@npm:0.2.2"
@@ -1232,14 +1225,36 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@cacheable/memory@npm:^2.2.0":
+  version: 2.2.0
+  resolution: "@cacheable/memory@npm:2.2.0"
+  dependencies:
+    "@cacheable/utils": "npm:^2.5.0"
+    "@keyv/bigmap": "npm:^1.3.1"
+    hookified: "npm:^1.15.1"
+    keyv: "npm:^5.6.0"
+  checksum: 10/97db83d7a74979accca9de56cf278e42c22b4273e752d7e23c44fbec4a47450716c4920903424fd19184a7bee6325064b6c453afc6f96bf92b39eecfe0b40648
+  languageName: node
+  linkType: hard
+
 "@cacheable/node-cache@npm:^1.4.0":
-  version: 1.5.6
-  resolution: "@cacheable/node-cache@npm:1.5.6"
+  version: 1.7.6
+  resolution: "@cacheable/node-cache@npm:1.7.6"
+  dependencies:
+    cacheable: "npm:^2.3.1"
+    hookified: "npm:^1.14.0"
+    keyv: "npm:^5.5.5"
+  checksum: 10/332cc20f9224545cbbf235a2e6dda6116498c97f21d08cfcf35867097b64a0006a685ebd455c5b0d482206497e72421aa7c63cbf9546855a107b9875e834437a
+  languageName: node
+  linkType: hard
+
+"@cacheable/utils@npm:^2.5.0":
+  version: 2.5.0
+  resolution: "@cacheable/utils@npm:2.5.0"
   dependencies:
-    cacheable: "npm:^1.10.0"
-    hookified: "npm:^1.9.1"
-    keyv: "npm:^5.3.3"
-  checksum: 10/17217248b6ef31245005834b11a24d6481091f917690dddcfa612310f0cf5bdd1b089125fad8c87a61d122a0bf2020bf033613b46bbd38f56476a01b724ff0dc
+    hashery: "npm:^1.5.1"
+    keyv: "npm:^5.6.0"
+  checksum: 10/a77a7e682926b984cb28b6993f4595638ce8799de3223dbdcdb796a077a02de763687bdc5669779019aba44d27693260ef92d860a19330d7eaa4dfcca3433c3b
   languageName: node
   linkType: hard
 
@@ -2263,12 +2278,22 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@keyv/serialize@npm:^1.0.3":
-  version: 1.0.3
-  resolution: "@keyv/serialize@npm:1.0.3"
+"@keyv/bigmap@npm:^1.3.1":
+  version: 1.3.1
+  resolution: "@keyv/bigmap@npm:1.3.1"
   dependencies:
-    buffer: "npm:^6.0.3"
-  checksum: 10/d6a9194dd781bc26cc4d55f392d843810c1fdc0da81e69203e633cb289fc0a8edc8bc6466f66c4cbb55da0a5b405e89f14a68b48d6e73919ae82f8249fb5e444
+    hashery: "npm:^1.4.0"
+    hookified: "npm:^1.15.0"
+  peerDependencies:
+    keyv: ^5.6.0
+  checksum: 10/9745786a94729117460b5399a964ec151e94a89db0e5ed573419c4c620f0595f05d7ad87d596bb7e212a4f3ad2335271694fddcfaa8400013f7b64e11669a884
+  languageName: node
+  linkType: hard
+
+"@keyv/serialize@npm:^1.1.1":
+  version: 1.1.1
+  resolution: "@keyv/serialize@npm:1.1.1"
+  checksum: 10/e3b2cb1377863342acedd5ff785af3e69269bee9b44707c617d1c8bc14eeb5ac763159d6455903ffe92f143c2238e1e783c4f113f9c8910eacccf172894472da
   languageName: node
   linkType: hard
 
@@ -3447,6 +3472,13 @@ __metadata:
   languageName: n
```

---

### Incident Patch 8: `7b6cf270` (2026-09-16)
**Commit Message**: up(WEBJS) - fix "POST /api/{session}/groups/join fails with joinGroupViaInvite is undefined" fix #2266

**File**: `yarn.lock` (modified, +78/-48)
```diff
@@ -5605,10 +5605,15 @@ __metadata:
   languageName: node
   linkType: hard
 
-"b4a@npm:^1.6.4":
-  version: 1.6.7
-  resolution: "b4a@npm:1.6.7"
-  checksum: 10/1ac056e3bce378d4d3e570e57319360a9d3125ab6916a1921b95bea33d9ee646698ebc75467561fd6fcc80ff697612124c89bb9b95e80db94c6dc23fcb977705
+"b4a@npm:^1.6.4, b4a@npm:^1.8.1":
+  version: 1.9.0
+  resolution: "b4a@npm:1.9.0"
+  peerDependencies:
+    react-native-b4a: "*"
+  peerDependenciesMeta:
+    react-native-b4a:
+      optional: true
+  checksum: 10/9b52d2d6614b10cce3b5473472be17d6db189010f41e3b914b8a2eaf177eeec668edceaecc957a143a9a435c1c0549b7d70b8059e37fc07cbad0ac82d588c30c
   languageName: node
   linkType: hard
 
@@ -5698,16 +5703,21 @@ __metadata:
   languageName: node
   linkType: hard
 
-"bare-events@npm:^2.2.0, bare-events@npm:^2.5.4":
-  version: 2.5.4
-  resolution: "bare-events@npm:2.5.4"
-  checksum: 10/135ef380b13f554ca2c6905bdbcfac8edae08fce85b7f953fa01f09a9f5b0da6a25e414111659bc9a6118216f0dd1f732016acd11ce91517f2afb26ebeb4b721
+"bare-events@npm:^2.5.4, bare-events@npm:^2.7.0":
+  version: 2.9.2
+  resolution: "bare-events@npm:2.9.2"
+  peerDependencies:
+    bare-abort-controller: "*"
+  peerDependenciesMeta:
+    bare-abort-controller:
+      optional: true
+  checksum: 10/28b1571b49bce4fb6ea7701f201aa364134607a5840d79285c2fa4a17d9248781bc14a6da16b4004b3bc6e87fd0de6eadf4f5f30346c1617845ef8d4b91fd3b9
   languageName: node
   linkType: hard
 
 "bare-fs@npm:^4.5.5":
-  version: 4.7.2
-  resolution: "bare-fs@npm:4.7.2"
+  version: 4.8.1
+  resolution: "bare-fs@npm:4.8.1"
   dependencies:
     bare-events: "npm:^2.5.4"
     bare-path: "npm:^3.0.0"
@@ -5719,49 +5729,45 @@ __metadata:
   peerDependenciesMeta:
     bare-buffer:
       optional: true
-  checksum: 10/a0fafaf46e6a3b77e7d36ff34f1f71e417d548c4ebac90238a0e42376b8efa1698f820133fbf8a09f6b6cb14cbd19f782d9c8bb8263cdf3c8e55e27ad2c1d648
-  languageName: node
-  linkType: hard
-
-"bare-os@npm:^3.0.1":
-  version: 3.6.1
-  resolution: "bare-os@npm:3.6.1"
-  checksum: 10/285d95c391250166128e64da2947f4a348ae127de680afffec1f6c82445856be0d1f259672b471afe06517e4cd3831183c373a1d63ef7799ed4aaa1321b86b67
+  checksum: 10/e6797ff2ed0581f8270b8da4998a3ddf77a65ffa8bac49b315c38c39c6c17df1a9a0db5f5e33b320f0c72cfa1cfc41a3d2ebe0d9b7f6528202ea7e74cd5326b1
   languageName: node
   linkType: hard
 
 "bare-path@npm:^3.0.0":
-  version: 3.0.0
-  resolution: "bare-path@npm:3.0.0"
-  dependencies:
-    bare-os: "npm:^3.0.1"
-  checksum: 10/712d90e9cd8c3263cc11b0e0d386d1531a452706d7840c081ee586b34b00d72544e65df7a40013d47c1b177277495225deeede65cb2984db88a979cb65aaa2ff
+  version: 3.1.2
+  resolution: "bare-path@npm:3.1.2"
+  checksum: 10/f596ee6528eb2f011df8f67c5af0d159dfc028b9ac63c7a24e95947ff0d2b19864019c893bc4c4d10463b7f7161fb55c2db04181a95e5a37b0165b42af096fad
   languageName: node
   linkType: hard
 
 "bare-stream@npm:^2.6.4":
-  version: 2.6.5
-  resolution: "bare-stream@npm:2.6.5"
+  version: 2.13.4
+  resolution: "bare-stream@npm:2.13.4"
   dependencies:
-    streamx: "npm:^2.21.0"
+    b4a: "npm:^1.8.1"
+    streamx: "npm:^2.25.0"
+    teex: "npm:^1.0.1"
   peerDependencies:
+    bare-abort-controller: "*"
     bare-buffer: "*"
     bare-events: "*"
   peerDependenciesMeta:
+    bare-abort-controller:
+      optional: true
     bare-buffer:
       optional: true
     bare-events:
       optional: true
-  checksum: 10/0f5ca2167fbbccc118157bce7c53a933e21726268e03d751461211550d72b2d01c296b767ccf96aae8ab28e106b126407c6fe0d29f915734b844ffe6057f0a08
+  checksum: 10/9b7b03d134072697f13b3e28ce7feb0a743b9cd8640659ff502d0e7d222f033459c723d57682288eb09b61ff6e0652e0c7efb87d539696f64a8203622949c29b
   languageName: node
   linkType: hard
 
 "bare-url@npm:^2.2.2":
-  version: 2.4.5
-  resolution: "bare-url@npm:2.4.5"
+  version: 2.5.4
+  resolution: "bare-url@npm:2.5.4"
   dependencies:
     bare-path: "npm:^3.0.0"
-  checksum: 10/65d7a906dae5051ba37d8b96fd3cd1ba8b8e1a7f74340a363c6b45123908d707a4d58c4e21c97f6735c4dfcd6c499d353a67cc8a4ff638d4
```

---

### Incident Patch 9: `d86ea302` (2026-09-16)
**Commit Message**: fix: parse invite code without query params

**File**: `src/core/abc/session.abc.test.ts` (modified, +26/-1)
```diff
@@ -1,4 +1,8 @@
-import { WhatsappSession } from '@waha/core/abc/session.abc';
+import {
+  parseChannelInviteLink,
+  parseGroupInviteLink,
+  WhatsappSession,
+} from '@waha/core/abc/session.abc';
 import { WAHAEvents, WAHASessionStatus } from '@waha/structures/enums.dto';
 import {
   MeInfo,
@@ -161,3 +165,24 @@ describe('WhatsappSession reachout timelock', () => {
     }
   });
 });
+
+describe('parseGroupInviteLink', () => {
+  it.each([
+    ['AbCdEf123', 'AbCdEf123'],
+    ['https://chat.whatsapp.com/AbCdEf123', 'AbCdEf123'],
+    ['https://chat.whatsapp.com/AbCdEf123?s=sw&p=a&mlu=4&ilr=4', 'AbCdEf123'],
+    ['https://chat.whatsapp.com/AbCdEf123#ref', 'AbCdEf123'],
+    ['AbCdEf123?s=sw', 'AbCdEf123'],
+  ])('%s => %s', (link, code) => {
+    expect(parseGroupInviteLink(link)).toBe(code);
+  });
+});
+
+describe('parseChannelInviteLink', () => {
+  it.each([
+    ['https://whatsapp.com/channel/AbCdEf123', 'AbCdEf123'],
+    ['https://www.whatsapp.com/channel/AbCdEf123?utm=x', 'AbCdEf123'],
+  ])('%s => %s', (link, code) => {
+    expect(parseChannelInviteLink(link)).toBe(code);
+  });
+});
```

**File**: `src/core/abc/session.abc.ts` (modified, +9/-4)
```diff
@@ -1300,8 +1300,8 @@ export function getGroupInviteLink(code: string) {
 }
 
 export function parseGroupInviteLink(link: string) {
-  // https://chat.whatsapp.com/123 => 123
-  return link.split('/').pop();
+  // https://chat.whatsapp.com/123?s=sw&p=a => 123
+  return parseInviteCode(link);
 }
 
 export function getChannelInviteLink(code: string) {
@@ -1310,8 +1310,13 @@ export function getChannelInviteLink(code: string) {
 
 export function parseChannelInviteLink(link: string): string {
   // https://www.whatsapp.com/channel/123 => 123
-  const code = link.split('/').pop();
-  return code;
+  return parseInviteCode(link);
+}
+
+function parseInviteCode(link: string): string {
+  // last path segment, without share tracking query params and hash
+  const path = link.split(/[?#]/)[0];
+  return path.split('/').pop();
 }
 
 export function getPublicUrlFromDirectPath(directPath: string) {
```

---

### Incident Patch 10: `3a4cb909` (2026-09-16)
**Commit Message**: fix(chatwoot): remove tier check messages from Chatwoot

**File**: `src/apps/chatwoot/services/ChatWootScheduleService.ts` (modified, +20/-11)
```diff
@@ -31,7 +31,9 @@ export class ChatWootScheduleService {
     await messageCleanupQueue.upsertJobScheduler(
       this.JobId(QueueName.SCHEDULED_MESSAGE_CLEANUP, appId),
       // Every day at 17:00
-      { pattern: '0 0 17 * * *' },
+      {
+        pattern: '0 0 17 * * *',
+      },
       {
         data: {
           app: appId,
@@ -46,7 +48,9 @@ export class ChatWootScheduleService {
     await checkVersionQueue.upsertJobScheduler(
       this.JobId(QueueName.SCHEDULED_CHECK_VERSION, appId),
       // Every Wednesday (3) at 18:00
-      { pattern: '0 0 18 * * 3' },
+      {
+        pattern: '0 0 18 * * 3',
+      },
       {
         data: {
           app: appId,
@@ -58,17 +62,22 @@ export class ChatWootScheduleService {
     const checkTierQueue = this.queueRegistry.queue(
       QueueName.SCHEDULED_CHECK_TIER,
     );
-    await checkTierQueue.upsertJobScheduler(
+    // Disabled - since we do not have PLUS version anymore
+    await checkTierQueue.removeJobScheduler(
       this.JobId(QueueName.SCHEDULED_CHECK_TIER, appId),
-      // Every Monday (1) at 14:00
-      { pattern: '0 0 14 * * 1' },
-      {
-        data: {
-          app: appId,
-          session: sessionName,
-        },
-      },
     );
+    // Enabled
+    // await checkTierQueue.upsertJobScheduler(
+    //   this.JobId(QueueName.SCHEDULED_CHECK_TIER, appId),
+    //   // Every Monday (1) at 14:00
+    //   { pattern: '0 0 14 * * 1' },
+    //   {
+    //     data: {
+    //       app: appId,
+    //       session: sessionName,
+    //     },
+    //   },
+    // );
   }
 
   async unschedule(appId: string, sessionName: string): Promise<void> {
```

#### Recent Merged Pull Requests:
- **PR #2286** (closed): Fix/remove gows from image (@hilisevir)
- **PR #2284** (2026-09-30): [core] fix(NOWEB): reuse original message id when deleting channel messages - fix #2038 (@BrianB3)
- **PR #2283** (2026-09-30): [core] feat(NOWEB): expose group member-share-history-mode as a settable endpoint (@alisonmwhite)
- **PR #2280** (closed): feat: First release & production deploy setup (@DECode-studio)
- **PR #2270** (2026-09-22): [core] Expose mentions in the OpenAPI spec (@Jeparre)
- **PR #2264** (closed): [core] Fix native Chatwoot outgoing message delivery status (@lucirlei)
- **PR #2262** (closed): [core] Fix WEBJS presence subscriptions and LID lookup (@vrodriguezf)
- **PR #2260** (closed): [core] Add Argentine Phone Numbers app for outbound resolution (@ropu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
