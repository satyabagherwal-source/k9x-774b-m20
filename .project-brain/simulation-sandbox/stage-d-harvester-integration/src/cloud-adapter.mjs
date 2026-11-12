/**
 * cloud-adapter.mjs
 * 
 * Cloud Harvester Adapter for Stage D
 * Connects zero-clone multi-agent fleet harvesting output to the shared pipeline.
 */

import { normalizeHarvestInput, HARVEST_ORIGINS } from './normalized-input.mjs';

export class CloudHarvesterAdapter {
  /**
   * @param {SharedHarvestingPipeline} sharedPipeline 
   */
  constructor(sharedPipeline) {
    this.sharedPipeline = sharedPipeline;
  }

  /**
   * Adapts raw Cloud Harvester extraction result and submits to shared pipeline.
   * @param {object} cloudRawPayload 
   * @returns {Promise<object>}
   */
  async submitHarvest(cloudRawPayload) {
    const normalized = normalizeHarvestInput(cloudRawPayload, HARVEST_ORIGINS.CLOUD);
    return await this.sharedPipeline.processHarvest(normalized);
  }
}

