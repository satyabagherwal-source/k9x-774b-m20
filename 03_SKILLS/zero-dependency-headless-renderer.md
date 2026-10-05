# Skill: Zero-Dependency Headless Chromium Native Rendering & Binary IHDR Inspection

## Metadata
- **Domain**: High-Performance Developer Tooling & CI/CD Graphics
- **Source**: `modu-ai/moai-adk`
- **Applicability**: Automated diagram rendering, SVG to PNG export, social preview cards, documentation graphs, and containerized CI environments.

## Purpose & Goal
Render SVGs, HTML diagrams, or dynamic charts into pixel-perfect PNG images in CI/CD without downloading 300MB+ Puppeteer or Playwright browser bundles. Uses the machine's existing Chromium-family browser (Chrome, Edge, Chromium, Brave) via standard headless flags, and performs cryptographic byte-level verification of the generated PNG file's binary `IHDR` header to guarantee dimensions.

## Step-by-Step Execution Protocol

### Step 1: Discover Local Chromium Family Executable
Use platform path heuristics to locate an existing browser without downloading any binaries:
```javascript
import { existsSync } from 'node:fs';
import { platform } from 'node:os';

export function findSystemChromium() {
  const os = platform();
  const candidates = [];
  if (os === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    );
  } else if (os === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge'
    );
  } else if (os === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  }
  return candidates.find(existsSync) || null;
}
```

### Step 2: Invoke Headless Rendering with Viewport Scaling
```javascript
import { spawnSync } from 'node:child_process';

export function renderSvgToPng(browserPath, inputSvgPath, outputPngPath, scale = 2) {
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`,
    `--screenshot=${outputPngPath}`,
    inputSvgPath
  ];

  const res = spawnSync(browserPath, args, { timeout: 15000 });
  if (res.status !== 0) {
    throw new Error(`Headless render failed with code ${res.status}`);
  }
}
```

### Step 3: Binary IHDR Header Verification
Never trust file existence alone. Inspect the binary PNG header:
```javascript
import { openSync, readSync, closeSync } from 'node:fs';

export function verifyPngIhdr(pngPath, expectedWidth, expectedHeight) {
  const fd = openSync(pngPath, 'r');
  const buf = Buffer.alloc(24);
  try {
    readSync(fd, buf, 0, 24, 0);
    // PNG Magic: 0x89 0x50 0x4E 0x47
    if (buf.readUInt32BE(0) !== 0x89504E47) {
      throw new Error('Invalid PNG signature');
    }
    // IHDR dimensions: byte 16 (width), byte 20 (height)
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w !== expectedWidth || h !== expectedHeight) {
      throw new Error(`Dimension mismatch: expected ${expectedWidth}x${expectedHeight}, got ${w}x${h}`);
    }
    return { width: w, height: h, valid: true };
  } finally {
    closeSync(fd);
  }
}
```
