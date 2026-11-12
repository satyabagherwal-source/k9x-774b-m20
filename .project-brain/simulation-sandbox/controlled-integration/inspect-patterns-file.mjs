import fs from 'fs';

const content = fs.readFileSync('05_KNOWLEDGE/engineering-patterns.md', 'utf8');
console.log('engineering-patterns.md size:', content.length, 'bytes');

const idx68 = content.indexOf('Rule 68');
console.log('Index of "Rule 68":', idx68);
if (idx68 !== -1) {
  console.log('--- Rule 68 snippet ---');
  console.log(content.slice(idx68 - 100, idx68 + 400));
}

const idx69 = content.indexOf('Rule 69');
console.log('Index of "Rule 69":', idx69);

const idx70 = content.indexOf('Rule 70');
console.log('Index of "Rule 70":', idx70);

const idx71 = content.indexOf('Rule 71');
console.log('Index of "Rule 71":', idx71);

// Look for how sections are structured
const lines = content.split(/\r?\n/);
const sectionHeaders = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('# ') || lines[i].startsWith('## ')) {
    sectionHeaders.push({ line: i + 1, text: lines[i] });
  }
}
console.log('Total # and ## headers:', sectionHeaders.length);
console.log('First 5 headers:', sectionHeaders.slice(0, 5));
console.log('Last 5 headers:', sectionHeaders.slice(-5));

