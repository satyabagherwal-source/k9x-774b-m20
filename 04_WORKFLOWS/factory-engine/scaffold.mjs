import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { initializeProjectBrainBridge, resolveMasterBrainPath } from './brain-bridge.mjs';
import { detectProjectClass } from './profile-engine.mjs';
import { generateProjectBrainFiles, writeProjectBrainFiles } from './project-brain-schemas.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function copyTemplateFiles(templateDir, targetDir, replacements = {}) {
  const writtenFiles = [];

  function walk(currentSrc, currentDest) {
    if (!fs.existsSync(currentDest)) {
      fs.mkdirSync(currentDest, { recursive: true });
    }

    const items = fs.readdirSync(currentSrc, { withFileTypes: true });

    for (const item of items) {
      const srcItem = path.join(currentSrc, item.name);
      const destItem = path.join(currentDest, item.name);

      if (item.isDirectory()) {
        walk(srcItem, destItem);
      } else {
        const ext = path.extname(item.name);
        const textExtensions = ['.json', '.md', '.mjs', '.js', '.ts', '.tsx', '.astro', '.css', '.html', '.gitignore', '.txt'];

        if (textExtensions.includes(ext) || item.name.startsWith('.')) {
          let content = fs.readFileSync(srcItem, 'utf-8');
          for (const [placeholder, val] of Object.entries(replacements)) {
            content = content.replaceAll(placeholder, val);
          }
          fs.writeFileSync(destItem, content, 'utf-8');
        } else {
          fs.copyFileSync(srcItem, destItem);
        }
        writtenFiles.push(destItem);
      }
    }
  }

  if (fs.existsSync(templateDir)) {
    walk(templateDir, targetDir);
  }
  return writtenFiles;
}

export function scaffoldProject(targetDir, projectName, options = {}) {
  const rootDir = path.resolve(targetDir);
  const factoryRoot = path.resolve(__dirname, '..');
  
  // Resolve profile
  const profile = options.profile || detectProjectClass({ name: projectName, type: options.type, intent: options.intent });
  const blueprintName = profile.blueprint || 'astro-tailwind-v4';
  const templateDir = path.join(factoryRoot, 'blueprints', blueprintName);

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  const creationDate = new Date().toISOString();
  const replacements = {
    '{{PROJECT_NAME}}': projectName,
    '{{CREATION_DATE}}': creationDate
  };

  // 1. Copy template files with placeholder replacements
  const files = copyTemplateFiles(templateDir, rootDir, replacements);

  // 2. Resolve Master Brain and initialize Brain Bridge
  const masterBrainPath = resolveMasterBrainPath(options.masterBrainPath);
  initializeProjectBrainBridge(rootDir, masterBrainPath, projectName, profile);

  // 3. Generate all 11 Project-Local Brain & OS files
  const brainFiles = generateProjectBrainFiles(rootDir, projectName, profile, {
    masterBrainPath,
    env: options.env
  });
  const writtenBrainFiles = writeProjectBrainFiles(rootDir, brainFiles);

  // 4. Run npm install if requested (default: true)
  let npmInstallSuccess = false;
  let npmOutput = '';
  if (options.skipInstall !== true) {
    try {
      npmOutput = execSync('npm install', {
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      npmInstallSuccess = true;
    } catch (err) {
      npmOutput = err.stderr || err.stdout || err.message;
      npmInstallSuccess = false;
    }
  }

  return {
    targetDir: rootDir,
    projectName,
    profile,
    blueprintName,
    filesCreated: files.length + writtenBrainFiles.length,
    brainFilesCreated: writtenBrainFiles.length,
    masterBrainPath,
    brainConnected: Boolean(masterBrainPath),
    npmInstallSuccess,
    npmOutput
  };
}
