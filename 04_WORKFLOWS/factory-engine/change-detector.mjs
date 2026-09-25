import { execSync } from 'child_process';
import { getSource, updateSourceMetadata } from './source-registry.mjs';

export function detectUpstreamVersion(sourceKey) {
  const source = getSource(sourceKey);
  if (!source) {
    return { error: `Source not found: ${sourceKey}` };
  }

  let latestVersion = null;
  let error = null;

  if (source.npmPackage) {
    try {
      const output = execSync(`npm view ${source.npmPackage} version`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 10000
      }).trim();
      latestVersion = output;
    } catch (e) {
      error = e.message;
    }
  } else if (sourceKey === 'nodejs') {
    latestVersion = process.version.replace('v', '');
  }

  const currentClean = source.currentVersion.replace(/[\^~>=]/g, '');
  const diffType = calculateSemverDiff(currentClean, latestVersion);

  const report = {
    sourceKey,
    name: source.name,
    officialUrl: source.officialUrl,
    currentConfiguredVersion: source.currentVersion,
    currentCleanVersion: currentClean,
    detectedUpstreamVersion: latestVersion || 'UNKNOWN',
    diffType,
    hasDrift: diffType !== 'NO_CHANGE' && diffType !== 'UNKNOWN',
    lastChecked: new Date().toISOString(),
    error
  };

  // Update lastChecked in registry
  updateSourceMetadata(sourceKey, {
    lastChecked: report.lastChecked
  });

  return report;
}

export function detectAllChanges() {
  const registryKeys = ['tailwindcss', 'astro', 'typescript', 'nodejs'];
  const results = {};
  for (const key of registryKeys) {
    results[key] = detectUpstreamVersion(key);
  }
  return results;
}

function calculateSemverDiff(current, upstream) {
  if (!current || !upstream) return 'UNKNOWN';
  if (current === upstream) return 'NO_CHANGE';

  const [curMajor, curMinor, curPatch] = current.split('.').map(n => parseInt(n, 10));
  const [upMajor, upMinor, upPatch] = upstream.split('.').map(n => parseInt(n, 10));

  if (isNaN(curMajor) || isNaN(upMajor)) return 'REVISION_DIFF';

  if (upMajor > curMajor) return 'MAJOR_DRIFT';
  if (upMajor === curMajor && upMinor > curMinor) return 'MINOR_UPDATE';
  if (upMajor === curMajor && upMinor === curMinor && upPatch > curPatch) return 'PATCH_UPDATE';

  return 'NO_CHANGE';
}
