import fs from 'fs';

function findInFile(filePath, term) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const idx = content.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 100);
  const end = Math.min(content.length, idx + 500);
  return content.slice(start, end);
}

console.log('--- NUCLEOID ---');
console.log(findInFile('07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md', 'exception'));

console.log('--- REACT-I18NEXT ---');
console.log(findInFile('07_PROJECT_LEARNING/i18next-react-i18next-learnings.md', 'defaultVariables'));

console.log('--- TURSO / LIMBO ---');
console.log(findInFile('07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md', 'concurrency'));

console.log('--- MINICPM-V ---');
console.log(findInFile('07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-1b-learnings.md', 'Patch Size'));

console.log('--- PHOCINAE ---');
console.log(findInFile('07_PROJECT_LEARNING/hf-phocinae-phocinae-largha-150m-v1-learnings.md', 'Multi-Choice'));

