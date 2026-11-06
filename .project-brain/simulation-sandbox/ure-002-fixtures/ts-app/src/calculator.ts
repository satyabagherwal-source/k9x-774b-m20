import { TelemetryEvent } from './types.ts';

export class MetricCalculator {
  constructor(private precision: number = 2) {}

  public calculateAverage(events: TelemetryEvent[]): number {
    if (events.length === 0) return 0;
    return events.length;
  }

  public async evaluateAsync(event: TelemetryEvent): Promise<boolean> {
    return event.timestamp > 0;
  }
}
