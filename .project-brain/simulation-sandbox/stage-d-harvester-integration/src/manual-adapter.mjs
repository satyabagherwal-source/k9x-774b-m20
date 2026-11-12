/**
 * manual-adapter.mjs
 * 
 * Manual Harvester Adapter for Stage D
 * Connects manual/batch repo cloning and local daemon harvester to the shared pipeline.
 */

import { normalizeHarvestInput, HARVEST_ORIGINS } from './normalized-input.mjs';

export class ManualHarvesterAdapter {
  /**
   * @param {SharedHarvestingPipeline} sharedPipeline 
   */
  constructor(sharedPipeline) {
    this.sharedPipeline = sharedPipeline;
  }

  /**
   * Adapts raw Manual Harvester extraction result and submits to shared pipeline.
   * @param {object} manualRawPayload 
   * @returns {Promise<object>}
   */
  async submitHarvest(manualRawPayload) {
    const normalized = normalizeHarvestInput(manualRawPayload, HARVEST_ORIGINS.MANUAL);
    return await this.sharedPipeline.processHarvest(normalized);
  }
}

