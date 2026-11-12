import { execSync } from 'child_process';

const commits = execSync('git log --pretty=format:"%h|%ad|%s" --date=iso -n 35', { encoding: 'utf8' }).trim().split('\n');

console.log('Tracing commit history for registry changes...');
console.log('Hash | Date | Dom Records | CD Directives | Subject');
console.log('--------------------------------------------------------------------------------');

const results = [];

for (const line of commits) {
  const [hash, date, subject] = line.split('|');
  let domCount = 'N/A';
  let cdCount = 'N/A';
  try {
    const domRaw = execSync(`git show ${hash}:05_KNOWLEDGE/domain-intelligence/domain-registry.json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const dom = JSON.parse(domRaw);
    domCount = dom.total_records || Object.keys(dom.records || {}).length;
  } catch (e) {}

  try {
    const cdRaw = execSync(`git show ${hash}:11_INBOX/candidate-directives-registry.json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const cd = JSON.parse(cdRaw);
    cdCount = (cd.directives || []).length;
  } catch (e) {}

  console.log(`${hash} | ${date.slice(0, 19)} | Dom: ${String(domCount).padStart(3)} | CD: ${String(cdCount).padStart(3)} | ${subject.slice(0, 45)}`);
  results.push({ hash, date, domCount, cdCount, subject });
}

