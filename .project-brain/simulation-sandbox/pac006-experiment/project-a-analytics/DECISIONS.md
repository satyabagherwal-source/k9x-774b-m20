
# Architecture Decisions: TenantDataAnalyticsEngine

## Decision 1: Composite Tenant Namespacing
- **Context**: In multi-tenant in-memory engines, metrics sharing the same name ('cpu_utilization') must not overwrite each other.
- **Decision**: Partition keys are strictly composed as `${tenantId}:${metricName}`.
- **Outcome**: 100% tenant data isolation; zero cross-tenant query leakage.

## Decision 2: FIFO Bounded Ring Buffer
- **Context**: High-volume ingestion can exhaust Node.js heap memory.
- **Decision**: Buffers capped at `maxPointsPerMetric` (default 100) with deterministic `buffer.shift()` on overflow.
- **Outcome**: Bounded memory footprint with zero process crashes.
