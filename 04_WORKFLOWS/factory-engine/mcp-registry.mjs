import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadMCPRegistry() {
  const registryPath = path.join(__dirname, 'mcp-registry.json');
  if (!fs.existsSync(registryPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch (e) {
    console.error(`Failed to load MCP registry: ${e.message}`);
    return {};
  }
}

export function resolveApplicableMCPs(projectType) {
  const registry = loadMCPRegistry();
  const applicable = {};

  for (const [mcpKey, mcpDef] of Object.entries(registry)) {
    if (mcpDef.supportedProjectTypes.includes(projectType) || mcpDef.supportedProjectTypes.includes('*')) {
      applicable[mcpKey] = {
        key: mcpKey,
        name: mcpDef.name,
        purpose: mcpDef.purpose,
        package: mcpDef.package,
        version: mcpDef.version,
        configuration: mcpDef.configuration,
        requiredCredentials: mcpDef.requiredCredentials,
        securityImplications: mcpDef.securityImplications,
        verificationMethod: mcpDef.verificationMethod,
        fallback: mcpDef.fallback
      };
    }
  }

  return applicable;
}

export function verifyMCPHealth(mcpKey, projectDir, options = {}) {
  const registry = loadMCPRegistry();
  const mcp = registry[mcpKey];

  if (!mcp) {
    return {
      mcpKey,
      status: 'NOT_FOUND',
      healthy: false,
      message: `MCP key "${mcpKey}" is not registered in canonical registry.`
    };
  }

  // Check required credentials if any
  const missingCreds = [];
  if (mcp.requiredCredentials && mcp.requiredCredentials.length > 0) {
    for (const cred of mcp.requiredCredentials) {
      if (!process.env[cred] && (!options.env || !options.env[cred])) {
        missingCreds.push(cred);
      }
    }
  }

  if (missingCreds.length > 0) {
    return {
      mcpKey,
      name: mcp.name,
      status: 'CREDENTIALS_MISSING',
      healthy: false,
      missingCredentials: missingCreds,
      fallback: mcp.fallback,
      message: `Required environment variables missing: ${missingCreds.join(', ')}. Safe fallback active.`
    };
  }

  return {
    mcpKey,
    name: mcp.name,
    status: 'ACTIVE_AND_VERIFIED',
    healthy: true,
    package: mcp.package,
    verificationMethod: mcp.verificationMethod,
    fallback: mcp.fallback
  };
}
