import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_FILE = path.join(__dirname, 'sources-registry.json');

export const DEFAULT_SOURCES = {
  "tailwindcss": {
    "name": "Tailwind CSS",
    "officialUrl": "https://tailwindcss.com/docs",
    "sourceType": "css-engine",
    "technology": "tailwindcss",
    "npmPackage": "tailwindcss",
    "currentVersion": "^4.0.0",
    "lastChecked": "2026-09-25T16:00:00.000Z",
    "lastVerified": "2026-09-25T16:00:00.000Z",
    "revisionIdentifier": "v4.0.0",
    "updateFrequency": "bi-weekly",
    "changeSeverity": "MAJOR",
    "affectedComponents": [
      "templates/astro-tailwind-v4/src/styles/global.css",
      "templates/astro-tailwind-v4/astro.config.mjs",
      "docs/TAILWIND_V4_GUIDE.md"
    ],
    "verificationMethod": "build-and-runtime",
    "autoUpdatePolicy": "MINOR_PATCH_TESTED",
    "reviewRequirement": "MAJOR_OR_BREAKING"
  },
  "astro": {
    "name": "Astro",
    "officialUrl": "https://docs.astro.build",
    "sourceType": "web-framework",
    "technology": "astro",
    "npmPackage": "astro",
    "currentVersion": "^5.4.0",
    "lastChecked": "2026-09-25T16:00:00.000Z",
    "lastVerified": "2026-09-25T16:00:00.000Z",
    "revisionIdentifier": "v5.4.0",
    "updateFrequency": "weekly",
    "changeSeverity": "MAJOR",
    "affectedComponents": [
      "templates/astro-tailwind-v4/package.json",
      "templates/astro-tailwind-v4/astro.config.mjs",
      "templates/astro-tailwind-v4/src/pages/index.astro",
      "docs/ASTRO_ARCHITECTURE_GUIDE.md"
    ],
    "verificationMethod": "build-and-runtime",
    "autoUpdatePolicy": "MINOR_PATCH_TESTED",
    "reviewRequirement": "MAJOR_OR_BREAKING"
  },
  "vercel": {
    "name": "Vercel Platform",
    "officialUrl": "https://vercel.com/docs",
    "sourceType": "deployment-platform",
    "technology": "vercel",
    "npmPackage": "vercel",
    "currentVersion": "astro-preset",
    "lastChecked": "2026-09-25T16:00:00.000Z",
    "lastVerified": "2026-09-25T16:00:00.000Z",
    "revisionIdentifier": "cleanUrls-v1",
    "updateFrequency": "monthly",
    "changeSeverity": "MEDIUM",
    "affectedComponents": [
      "templates/astro-tailwind-v4/vercel.json",
      "docs/VERCEL_SETUP_GUIDE.md"
    ],
    "verificationMethod": "json-schema-and-build",
    "autoUpdatePolicy": "MINOR_PATCH_TESTED",
    "reviewRequirement": "MAJOR_OR_BREAKING"
  },
  "nodejs": {
    "name": "Node.js Runtime",
    "officialUrl": "https://nodejs.org/api/",
    "sourceType": "runtime",
    "technology": "node",
    "currentVersion": ">=18.0.0",
    "lastChecked": "2026-09-25T16:00:00.000Z",
    "lastVerified": "2026-09-25T16:00:00.000Z",
    "revisionIdentifier": "LTS-20+",
    "updateFrequency": "monthly",
    "changeSeverity": "MAJOR",
    "affectedComponents": [
      "lib/env-checker.mjs",
      "protocols/PROJECT_READY_CERTIFICATION.md"
    ],
    "verificationMethod": "cli-env-probe",
    "autoUpdatePolicy": "MANUAL",
    "reviewRequirement": "MAJOR_OR_BREAKING"
  },
  "typescript": {
    "name": "TypeScript",
    "officialUrl": "https://www.typescriptlang.org/docs/",
    "sourceType": "language",
    "technology": "typescript",
    "npmPackage": "typescript",
    "currentVersion": "^5.7.0",
    "lastChecked": "2026-09-25T16:00:00.000Z",
    "lastVerified": "2026-09-25T16:00:00.000Z",
    "revisionIdentifier": "v5.7.0",
    "updateFrequency": "monthly",
    "changeSeverity": "MEDIUM",
    "affectedComponents": [
      "templates/astro-tailwind-v4/tsconfig.json",
      "templates/astro-tailwind-v4/package.json"
    ],
    "verificationMethod": "typecheck-and-build",
    "autoUpdatePolicy": "MINOR_PATCH_TESTED",
    "reviewRequirement": "MAJOR_OR_BREAKING"
  }
};

export function loadSourceRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    saveSourceRegistry(DEFAULT_SOURCES);
    return DEFAULT_SOURCES;
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  } catch (e) {
    return DEFAULT_SOURCES;
  }
}

export function saveSourceRegistry(data) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export function getSource(key) {
  const registry = loadSourceRegistry();
  return registry[key] || null;
}

export function updateSourceMetadata(key, updates) {
  const registry = loadSourceRegistry();
  if (registry[key]) {
    registry[key] = {
      ...registry[key],
      ...updates,
      lastChecked: new Date().toISOString()
    };
    saveSourceRegistry(registry);
    return registry[key];
  }
  return null;
}
