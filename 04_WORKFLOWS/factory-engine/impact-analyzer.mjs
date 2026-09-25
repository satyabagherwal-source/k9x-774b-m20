import { getSource } from './source-registry.mjs';

export function analyzeImpact(changeReport) {
  const source = getSource(changeReport.sourceKey);
  if (!source) {
    return { error: 'Source not found' };
  }

  const analysis = {
    sourceKey: changeReport.sourceKey,
    name: source.name,
    diffType: changeReport.diffType,
    fromVersion: changeReport.currentConfiguredVersion,
    toVersion: changeReport.detectedUpstreamVersion,
    affectedComponents: source.affectedComponents || [],
    severity: 'LOW',
    adaptationPolicy: source.autoUpdatePolicy,
    actionRecommended: 'NO_ACTION_NEEDED',
    breakingRisk: 'LOW',
    invariantsToVerify: [
      'Zero-JS production build exit code 0',
      'Dev-server socket probe HTTP 200',
      'Responsive design tokens intact',
      'SEO canonical and meta tags unaffected'
    ]
  };

  switch (changeReport.diffType) {
    case 'MAJOR_DRIFT':
      analysis.severity = 'CRITICAL';
      analysis.breakingRisk = 'HIGH';
      analysis.actionRecommended = 'REVIEW_REQUIRED';
      analysis.reason = `Major version upgrade detected from ${changeReport.currentConfiguredVersion} to ${changeReport.detectedUpstreamVersion}. Potential architectural or breaking syntax changes. Automatic update is strictly forbidden by Dynamic Knowledge Governance.`;
      break;

    case 'MINOR_UPDATE':
      analysis.severity = 'MEDIUM';
      analysis.breakingRisk = 'LOW';
      analysis.actionRecommended = source.autoUpdatePolicy === 'MINOR_PATCH_TESTED' ? 'SANDBOX_VERIFY_AND_UPDATE' : 'REVIEW_REQUIRED';
      analysis.reason = `Minor feature release detected (${changeReport.detectedUpstreamVersion}). Recommended to run compatibility sandbox verification before template adoption.`;
      break;

    case 'PATCH_UPDATE':
      analysis.severity = 'LOW';
      analysis.breakingRisk = 'NEGLIGIBLE';
      analysis.actionRecommended = 'SANDBOX_VERIFY_AND_UPDATE';
      analysis.reason = `Patch release detected (${changeReport.detectedUpstreamVersion}). Non-breaking bugfix or security patch. Safe to verify and update.`;
      break;

    case 'NO_CHANGE':
    default:
      analysis.severity = 'NONE';
      analysis.breakingRisk = 'NONE';
      analysis.actionRecommended = 'UP_TO_DATE';
      analysis.reason = 'Current template version matches upstream release.';
      break;
  }

  return analysis;
}
