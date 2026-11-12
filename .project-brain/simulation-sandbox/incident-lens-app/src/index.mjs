import { fileURLToPath } from 'url';
import { HeadlessApiRouter } from './core/engine.mjs';
import { createServer } from './server.mjs';
import { IncidentStore } from './storage/incident-store.mjs';
import { RUNBOOKS, getRunbook, listRunbooks } from './core/runbook-library.mjs';
import { generateIncidentAutopsy } from './core/autopsy-generator.mjs';
import { renderDashboardHtml } from './ui/dashboard-html.mjs';

const __filename = fileURLToPath(import.meta.url);

export function createApplication(options = {}) {
  return createServer(options);
}

export {
  HeadlessApiRouter,
  createServer,
  IncidentStore,
  RUNBOOKS,
  getRunbook,
  listRunbooks,
  generateIncidentAutopsy,
  renderDashboardHtml
};

export default createApplication;

if (process.argv[1] === __filename) {
  const PORT = process.env.PORT || 3456;
  const { server } = createServer();
  server.listen(PORT, () => {
    console.log(`IncidentLens workstation listening on http://localhost:${PORT}`);
  });
}
