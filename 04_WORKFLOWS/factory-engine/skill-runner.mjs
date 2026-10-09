/**
 * Universal Executable Skill Runner & Registry
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\skill-runner.mjs
 * Purpose: Parses declarative markdown playbooks from 03_SKILLS/ into executable
 *          specifications, extracting invariants, action pipelines, and verification probes.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(BRAIN_ROOT, '03_SKILLS');

/**
 * Lists all registered skills available in 03_SKILLS/
 * 
 * @returns {Array<object>} Registered skills with metadata
 */
export function listRegisteredSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md') && f !== '.gitkeep');

  return files.map(file => {
    const slug = file.replace('.md', '');
    const fullPath = path.join(SKILLS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : slug;

    // Detect category based on title/slug
    let category = 'GENERAL_ENGINEERING';
    if (slug.includes('tailwind') || slug.includes('css') || slug.includes('design')) category = 'FRONTEND_DESIGN';
    else if (slug.includes('astro') || slug.includes('seo') || slug.includes('adsense') || slug.includes('multilingual')) category = 'WEB_ARCHITECTURE';
    else if (slug.includes('systems') || slug.includes('compiler') || slug.includes('performance')) category = 'SYSTEMS_COMPILERS';
    else if (slug.includes('git') || slug.includes('lifecycle')) category = 'DEVOPS_LIFECYCLE';
    else if (slug.includes('error') || slug.includes('correction') || slug.includes('regression')) category = 'QUALITY_ASSURANCE';

    return {
      skill_id: slug,
      title,
      category,
      file_path: `03_SKILLS/${file}`,
      byte_size: content.length
    };
  });
}

/**
 * Parses a specific skill markdown document into an executable specification
 * 
 * @param {string} skillId - Name or slug of the skill
 * @returns {object|null} Structured skill definition
 */
export function getSkillDefinition(skillId) {
  const normalizedId = skillId.replace(/\.md$/, '');
  const filePath = path.join(SKILLS_DIR, `${normalizedId}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : normalizedId;

  // 1. Extract Invariants / Non-negotiables
  const invariants = [];
  const invariantRegex = /(?:invariants?|rules?|non-negotiables?|laws?)[\s\S]*?(?=\n##|\Z)/i;
  const invariantMatch = content.match(invariantRegex);
  if (invariantMatch) {
    const invLines = invariantMatch[0].split(/\r?\n/);
    for (const line of invLines) {
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) invariants.push(bullet[1].trim());
    }
  }

  // 2. Extract Execution / Implementation Steps
  const executionSteps = [];
  const stepRegex = /(?:##\s+(?:\d+\.|\d+\s+)?(?:Steps|Pipeline|Implementation|Workflow|Phases)[\s\S]*?)(?=\n##\s+(?:Verification|Quality|Audit)|\Z)/i;
  const stepMatch = content.match(stepRegex);
  if (stepMatch) {
    const stepLines = stepMatch[0].split(/\r?\n/);
    for (const line of stepLines) {
      const stepItem = line.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
      if (stepItem && stepItem[1].length > 10) {
        executionSteps.push(stepItem[1].trim());
      }
    }
  }

  // 3. Extract Verification Probes
  const verificationProbes = [];
  const verifyRegex = /(?:verification|audit|checks|quality gate)[\s\S]*?(?=\n##|\Z)/i;
  const verifyMatch = content.match(verifyRegex);
  if (verifyMatch) {
    const vLines = verifyMatch[0].split(/\r?\n/);
    for (const line of vLines) {
      const probe = line.match(/`([^`]+)`/);
      if (probe && (probe[1].includes('npm') || probe[1].includes('build') || probe[1].includes('test') || probe[1].includes('curl') || probe[1].includes('node'))) {
        verificationProbes.push(probe[1]);
      }
    }
  }

  // Default probes if none explicitly extracted
  if (verificationProbes.length === 0) {
    verificationProbes.push('npm run build', 'npm test');
  }

  return {
    skill_id: normalizedId,
    title,
    file_path: `03_SKILLS/${normalizedId}.md`,
    invariants: invariants.length > 0 ? invariants : ['Enforce zero-regression surgical edits.'],
    execution_steps: executionSteps.length > 0 ? executionSteps : ['Implement required changes adhering to skill specifications.'],
    verification_probes: Array.from(new Set(verificationProbes))
  };
}

/**
 * Binds an executable skill directly to a Task Contract
 * 
 * @param {object} contract - The task contract
 * @param {string} skillId - The skill identifier
 * @returns {object} Updated contract with injected skill execution plan & invariants
 */
export function bindSkillToTask(contract, skillId) {
  const skill = getSkillDefinition(skillId);
  if (!skill) {
    throw new Error(`Skill "${skillId}" not found in 03_SKILLS/ registry.`);
  }

  // Inject skill into context
  if (!contract.context.applicable_skills) contract.context.applicable_skills = [];
  if (!contract.context.applicable_skills.includes(skill.file_path)) {
    contract.context.applicable_skills.push(skill.file_path);
  }

  // Inject skill invariants into negative constraints
  for (const inv of skill.invariants) {
    if (!contract.constraints.negative_constraints.includes(inv)) {
      contract.constraints.negative_constraints.push(`[${skill.title}] ${inv}`);
    }
  }

  // Convert skill execution steps into DAG plan steps if execution_plan is empty
  if (contract.execution_plan.length === 0) {
    contract.execution_plan = skill.execution_steps.map((action, idx) => ({
      step_id: idx + 1,
      title: action.slice(0, 50),
      action,
      depends_on: idx === 0 ? [] : [idx],
      verification_probe: skill.verification_probes[idx % skill.verification_probes.length] || 'npm run build',
      status: 'PENDING'
    }));
    contract.checkpoint.total_steps = contract.execution_plan.length;
  }

  return contract;
}
